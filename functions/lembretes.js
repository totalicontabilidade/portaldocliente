/* ============================================================
   Totali · Portal de Onboarding
   functions/lembretes.js — item 9: o aviso que a equipe não
   precisa lembrar de dar

   O PROBLEMA
   ----------
   Cobrança de documento depende de alguém lembrar de cobrar. Nas
   duas primeiras semanas todo mundo lembra; no mês seguinte o
   cliente que parou some da cabeça de todo mundo, e a migração
   fica parada sem ninguém decidir que ficaria.

   O QUE ESTA FUNÇÃO FAZ
   ---------------------
   Uma vez por dia ela olha cada empresa ativa e escreve uma
   MENSAGEM NA CONVERSA quando as duas coisas forem verdade:

     • falta documento obrigatório, e
     • ninguém mexe naquela empresa há DIAS_PARADO dias, e
     • já se passaram DIAS_ENTRE_AVISOS desde o último aviso
       automático daquela empresa.

   A mensagem entra como qualquer outra da Totali: o cliente a lê
   no portal, recebe a notificação se tiver ativado, e a equipe a
   vê na aba Mensagens. Não é um canal novo — é a mesma conversa.

   O QUE ELA NÃO FAZ, E POR QUÊ
   ----------------------------
   Não manda WhatsApp nem e-mail. Isso continua sendo escolha de
   uma pessoa, na tela de cobrança, porque texto automático que
   chega no WhatsApp de um cliente cansa rápido — e quem paga a
   antipatia é a relação, não o sistema.

   Não avisa quem está só com documento OPCIONAL faltando: não é
   pendência, é escolha.

   Não avisa duas vezes na mesma semana. O silêncio entre um
   aviso e outro é o que faz o aviso valer alguma coisa.

   Não avisa empresa arquivada, nem empresa em que o cliente
   nunca entrou — para essa, o problema é outro (o convite) e
   quem resolve é a equipe.

   COMO MUDAR A HORA E O TEXTO
   ---------------------------
   No painel: Conteúdo do portal › Aviso automático. Hora, dias,
   ligado/desligado e o texto saem de lá. O que está aqui embaixo,
   em PADRAO, é só a reserva para quando não houver nada gravado.

   O texto é curto e diz o número de propósito: "faltam 4
   documentos" é acionável; "não se esqueça de nós" é ruído.
   ============================================================ */
"use strict";

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const REGIAO = "southamerica-east1";
const DIA = 86400000;

/* Quanto tempo parado antes do primeiro aviso. Uma semana é o
   ponto em que "ele deve estar juntando os papéis" vira "ele
   esqueceu". */
const DIAS_PARADO = 7;

/* Nunca dois avisos mais perto que isto. */
const DIAS_ENTRE_AVISOS = 7;

/* Trava de segurança: se algo estiver errado na conta de dias, é
   melhor a função não escrever em cinquenta conversas de uma vez.
   Ela para e a equipe percebe pelo log. */
const MAXIMO_POR_DIA = 20;

/* ============================================================
   O QUE A EQUIPE CONTROLA DAQUI, PELO PAINEL

   Antes, mudar a hora do aviso — ou o texto dele — era editar
   este arquivo e publicar as funções. Hora de aviso é decisão de
   atendimento, não de programação: quem sabe se 10h é cedo demais
   para os clientes é quem atende.

   COMO A HORA FUNCIONA AGORA. O Cloud Scheduler não deixa mudar o
   cron sem publicar de novo, então a função passou a ACORDAR DE
   HORA EM HORA e só trabalhar quando o relógio de Brasília bate
   com a hora escolhida. Custa 24 despertares por dia em vez de 1
   — barato — e a trava que já existia continua valendo: cada
   empresa tem `avisoAutomaticoEm`, e ninguém é avisado duas vezes
   dentro do intervalo, mesmo que a função rode mil vezes.

   O padrão abaixo vale quando não há nada gravado, e é o que o
   sistema fazia antes: 10h, dias úteis, ligado.
   ============================================================ */
const PADRAO = {
  ligado: true,
  hora: 10,
  diasUteis: true,
  saudacaoCom: "Olá, {nome}!",
  saudacaoSem: "Olá!",
  corpo: "Passando para lembrar que ainda {faltam} para concluirmos a entrada da sua " +
         "empresa aqui na Totali.\n\nÉ só abrir o portal e enviar — dá para tirar foto pelo " +
         "celular. Se algum deles não se aplica à sua empresa, ou se você precisar de ajuda, " +
         "responda por aqui mesmo que a gente resolve."
};

async function configuracao(db) {
  try {
    /* Mora no MESMO documento do resto do conteúdo do portal, e
       não num documento só seu: assim vale o mesmo botão de
       publicar, e a equipe não fica com dois lugares que salvam
       de jeitos diferentes. */
    const d = await db.collection("conteudo").doc("portal").get();
    if (!d.exists) return PADRAO;
    const c = ((d.data() || {}).blocos || {}).lembretes || {};
    const hora = Number(c.hora);
    return {
      ligado: c.ligado !== false,
      hora: (Number.isInteger(hora) && hora >= 0 && hora <= 23) ? hora : PADRAO.hora,
      diasUteis: c.diasUteis !== false,
      saudacaoCom: texto(c.saudacaoCom, 200) || PADRAO.saudacaoCom,
      saudacaoSem: texto(c.saudacaoSem, 200) || PADRAO.saudacaoSem,
      corpo: texto(c.corpo, 2000) || PADRAO.corpo
    };
  } catch (e) {
    /* Sem conseguir ler, vale o padrão: é melhor avisar no horário
       de sempre do que deixar de avisar. */
    console.error("nao consegui ler a configuracao de lembretes", e && e.message);
    return PADRAO;
  }
}

function texto(v, max) {
  return (typeof v === "string" && v.trim()) ? v.slice(0, max) : "";
}

/* Que horas são em Brasília, e que dia da semana. O relógio do
   servidor é UTC; perguntar ao Intl é o jeito de não ter que
   lembrar de fuso nem de horário de verão. */
function agoraEmBrasilia() {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    hour: "numeric", hour12: false, weekday: "short"
  }).formatToParts(new Date());
  const achar = (t) => (partes.find((p) => p.type === t) || {}).value;
  const dia = String(achar("weekday") || "");
  return {
    hora: Number(achar("hour")),
    fimDeSemana: dia === "Sat" || dia === "Sun"
  };
}

function TEXTO(cfg, nome, quantos) {
  const saudacao = nome
    ? String(cfg.saudacaoCom).replace(/\{nome\}/g, nome)
    : String(cfg.saudacaoSem);
  const faltam = quantos === 1
    ? "falta 1 documento obrigatório"
    : "faltam " + quantos + " documentos obrigatórios";
  return saudacao + " " + String(cfg.corpo).replace(/\{faltam\}/g, faltam);
}

function emMs(v) {
  if (!v) return 0;
  if (typeof v === "number") return v;
  if (typeof v.toMillis === "function") { try { return v.toMillis(); } catch (e) { return 0; } }
  if (typeof v.seconds === "number") return v.seconds * 1000;
  const t = Date.parse(v);
  return isNaN(t) ? 0 : t;
}

function primeiroNome(v) {
  return String(v || "").trim().split(/\s+/)[0] || "";
}

/* Quantos documentos obrigatórios ainda faltam.

   Esta função NÃO conhece a lista de documentos — ela está no
   navegador, em js/data.js, e é editável pela equipe na aba
   Conteúdo. Duplicá-la aqui criaria duas verdades que divergem
   no dia em que alguém acrescentar um documento.

   Então a conta é feita ao contrário: o que existe em /itens diz
   o que já foi resolvido; o total vem do resumo que o próprio
   portal grava em /financeiro/geral quando o cliente mexe. Se
   esse resumo não existir, a função não avisa — é melhor não
   avisar do que avisar errado. */
async function faltamObrigatorios(empresaRef) {
  const geral = await empresaRef.collection("financeiro").doc("geral").get();
  if (!geral.exists) return null;
  const g = geral.data() || {};
  const r = g.resumo;
  if (!r || typeof r.pendentesObrigatorios !== "number") return null;
  return r.pendentesObrigatorios;
}

exports.avisarPendencias = onSchedule(
  {
    /* DE HORA EM HORA, e quem decide a hora é o painel.

       Era "0 10 * * 1-5" — 10h, dias úteis, fixo no código. Mudar
       exigia publicar as funções, e hora de aviso é decisão de
       atendimento. Agora a função acorda toda hora cheia e só
       trabalha quando o relógio de Brasília bate com a hora
       escolhida em Conteúdo do portal.

       ERRO QUE JÁ ESTEVE AQUI, e que a `timeZone` abaixo ainda
       resolve: o cron dizia "0 13" com esta mesma timeZone. O 13
       fora calculado como se fosse UTC (10h BRT = 13h UTC), mas o
       Cloud Scheduler lê o cron no fuso informado — virava 13h de
       Brasília. Ou se escreve a hora local, ou se tira a timeZone.
       Não os dois. */
    schedule: "0 * * * *",
    timeZone: "America/Sao_Paulo",
    region: REGIAO
  },
  async () => {
    const db = getFirestore();
    const cfg = await configuracao(db);

    if (!cfg.ligado) return;

    const agora = agoraEmBrasilia();
    if (agora.hora !== cfg.hora) return;
    if (cfg.diasUteis && agora.fimDeSemana) return;

    /* Daqui para baixo é a execução de verdade — e só ela anota a
       saúde. Anotar a cada despertar faria o painel dizer "rodou
       agora" o dia inteiro, e o aviso de rotina parada, que existe
       para gritar quando ela morre, nunca mais gritaria. */
    try {
      const r = await rodarAvisos(db, cfg);
      await anotarSaude(db, "avisarPendencias", { ok: true, detalhe: r });
    } catch (e) {
      await anotarSaude(db, "avisarPendencias", {
        ok: false, erro: String((e && e.message) || e).slice(0, 300)
      });
      throw e;      /* o erro precisa continuar aparecendo no log */
    }
  }
);

/* ============================================================
   SAÚDE DAS ROTINAS DO SERVIDOR

   Esta função roda sozinha, às 10h, sem ninguém olhando. Até agora
   ela só escrevia no log do Google: se parasse de funcionar, os
   clientes simplesmente deixavam de ser cobrados e ninguém ficaria
   sabendo — falha silenciosa, que é a pior espécie.

   Agora cada execução deixa um registro em /saude, e o painel da
   equipe mostra um aviso quando algo falhou ou quando faz dias
   demais que a rotina não roda. O documento é sempre o mesmo por
   rotina, então não acumula.

   Nunca deixar isto derrubar a função: o trabalho dela é avisar os
   clientes, e falhar em anotar a saúde não pode custar isso. */
async function anotarSaude(db, rotina, dados) {
  try {
    await db.collection("saude").doc(rotina).set({
      ok: dados.ok !== false,
      erro: dados.erro || "",
      detalhe: dados.detalhe || null,
      em: FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (e) {
    console.error("nao consegui anotar a saude de " + rotina, e && e.message);
  }
}

async function rodarAvisos(db, cfg) {
  {
    const agora = Date.now();
    let enviados = 0, olhadas = 0, pulados = 0;

    const empresas = await db.collection("empresas").get();

    for (const emp of empresas.docs) {
      if (enviados >= MAXIMO_POR_DIA) {
        console.warn("Limite diário de avisos atingido; o resto fica para amanhã.");
        break;
      }
      olhadas++;

      const e = emp.data() || {};
      if (e.arquivadaEm) { pulados++; continue; }

      /* Ninguém entrou ainda: o problema é o convite, não a
         cobrança. Mandar mensagem para quem não tem como ler é
         só encher a conversa. */
      const acessos = await emp.ref.collection("acessos").limit(1).get();
      if (acessos.empty) { pulados++; continue; }

      const faltam = await faltamObrigatorios(emp.ref);
      if (faltam === null || faltam <= 0) { pulados++; continue; }

      /* Há quanto tempo ninguém mexe. Vale a última mensagem de
         qualquer um dos lados e a última alteração da empresa —
         se a equipe escreveu ontem, não é hora de o robô falar. */
      const ultimas = await emp.ref.collection("mensagens")
        .orderBy("em", "desc").limit(1).get();
      const ultimaMensagem = ultimas.empty ? 0 : emMs(ultimas.docs[0].data().em);
      const mexeu = Math.max(emMs(e.atualizadoEm), ultimaMensagem);

      if (mexeu && agora - mexeu < DIAS_PARADO * DIA) { pulados++; continue; }

      /* Já avisamos esta semana? A marca fica na própria empresa,
         escrita por esta função. */
      const ultimoAviso = emMs(e.avisoAutomaticoEm);
      if (ultimoAviso && agora - ultimoAviso < DIAS_ENTRE_AVISOS * DIA) { pulados++; continue; }

      const texto = TEXTO(cfg, primeiroNome(e.responsavelNome), faltam);

      await emp.ref.collection("mensagens").add({
        autor: "equipe",
        autorNome: "Totali",
        texto: texto,
        chave: "",
        anexos: [],
        em: Date.now(),
        lidaEm: 0,
        /* Marca de origem: a equipe precisa distinguir o que ela
           escreveu do que o sistema escreveu, principalmente ao
           ler a conversa meses depois. */
        automatico: true
      });

      await emp.ref.set({ avisoAutomaticoEm: FieldValue.serverTimestamp() }, { merge: true });

      await db.collection("auditoria").add({
        empresaId: emp.id,
        tipo: "aviso:automatico",
        faltavam: faltam,
        em: FieldValue.serverTimestamp()
      });

      enviados++;
    }

    console.log("Avisos: " + enviados + " enviados, " + pulados +
                " pulados, de " + olhadas + " empresa(s).");
    return { enviados: enviados, pulados: pulados, olhadas: olhadas };
  }
}
