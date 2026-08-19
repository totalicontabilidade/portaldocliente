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

   COMO MUDAR O TEXTO
   ------------------
   Está em TEXTO, aqui embaixo. É de propósito que ele seja curto
   e diga o número: "faltam 4 documentos" é acionável; "não se
   esqueça de nós" é ruído.
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

function TEXTO(nome, quantos) {
  const saudacao = nome ? "Olá, " + nome + "!" : "Olá!";
  return saudacao + " Passando para lembrar que ainda " +
    (quantos === 1
      ? "falta 1 documento obrigatório"
      : "faltam " + quantos + " documentos obrigatórios") +
    " para concluirmos a entrada da sua empresa aqui na Totali.\n\n" +
    "É só abrir o portal e enviar — dá para tirar foto pelo celular. " +
    "Se algum deles não se aplica à sua empresa, ou se você precisar de ajuda, " +
    "responda por aqui mesmo que a gente resolve.";
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
    schedule: "0 13 * * 1-5",        /* 10h em Brasília, dias úteis */
    timeZone: "America/Sao_Paulo",
    region: REGIAO
  },
  async () => {
    const db = getFirestore();
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

      const texto = TEXTO(primeiroNome(e.responsavelNome), faltam);

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
  }
);
