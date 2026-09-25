/* ============================================================
   Totali · Portal do Cliente
   functions/lembretes.js — a cobrança automática que segue a jornada
                           + a cobrança do Envio do mês (item que passou do prazo)

   O TEMPO VEM DA JORNADA DE 30 DIAS (decisão do Raoni, 21/09/2026):
     • D5 é "Documentos, acessos e autorizações". A partir do D5,
       com 48 h de tolerância (D7), o portal cobra sozinho o que
       falta na entrada, UMA VEZ POR SEMANA, como o D5 do treinamento
       diz ("o portal cobra sozinho o que falta, uma vez por semana").
     • Enquanto a jornada estiver aberta (até o D30), a cobrança
       segue esse ritmo. Depois do D30, se ainda faltar item
       obrigatório, continua semanal até a entrada ficar completa.
     • Nunca dois avisos com menos de 7 dias entre si por empresa.
     • Não cobra empresa arquivada, nem empresa em que o cliente
       nunca entrou (aí o problema é o convite; quem resolve é a
       equipe, e o painel mostra "sem acesso").
     • Não cobra item opcional: não é pendência, é escolha.
   A mensagem entra na conversa, como qualquer outra da Totali. Não
   manda WhatsApp nem e-mail (texto automático em WhatsApp cansa).

   Hora, dias úteis, ligado/desligado e o texto vêm de
   conteudo/lembretes (Painel › Conteúdo › Aviso automático). A
   função acorda de hora em hora e só trabalha na hora escolhida.
   ============================================================ */
"use strict";

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const REGIAO = "southamerica-east1";
const DIA = 86400000;
const DIA_INICIO = 5, TOLERANCIA_DIAS = 2, DIAS_ENTRE_AVISOS = 7, MAXIMO_POR_RODADA = 30;

const PADRAO = {
  ligado: true, hora: 10, diasUteis: true, envioLigado: true,
  envioCorpo: "Passando para lembrar que ainda {faltam}. É só abrir o portal, em Envio do mês, e anexar: dá para tirar foto pelo celular, e o item fecha sozinho. Qualquer dúvida, responda por aqui.",
  saudacaoCom: "Olá, {nome}!", saudacaoSem: "Olá!",
  corpo: "Passando para lembrar que ainda {faltam} para concluirmos a entrada da sua empresa aqui na Totali.\n\nÉ só abrir o portal, em Entrada na Totali, e enviar: dá para tirar foto pelo celular. Se algum item não se aplica à sua empresa, marque \"não se aplica\". Qualquer dúvida, responda por aqui mesmo que a gente resolve."
};
const texto = (v, max) => (typeof v === "string" && v.trim() ? v.slice(0, max) : "");
async function configuracao(db) {
  try { const d = await db.collection("conteudo").doc("lembretes").get(); if (!d.exists) return PADRAO; const c = d.data() || {}; const h = Number(c.hora); return { envioLigado: c.envioLigado !== false, envioCorpo: texto(c.envioCorpo, 1500) || PADRAO.envioCorpo, ligado: c.ligado !== false, hora: Number.isInteger(h) && h >= 0 && h <= 23 ? h : PADRAO.hora, diasUteis: c.diasUteis !== false, saudacaoCom: texto(c.saudacaoCom, 200) || PADRAO.saudacaoCom, saudacaoSem: texto(c.saudacaoSem, 200) || PADRAO.saudacaoSem, corpo: texto(c.corpo, 2000) || PADRAO.corpo }; }
  catch (e) { console.error("configuracao de lembretes", e && e.message); return PADRAO; }
}
function agoraEmMaceio() { const p = new Intl.DateTimeFormat("en-US", { timeZone: "America/Maceio", hour: "numeric", hour12: false, weekday: "short" }).formatToParts(new Date()); const o = {}; p.forEach((x) => { o[x.type] = x.value; }); return { hora: Number(o.hour) % 24, fimDeSemana: o.weekday === "Sat" || o.weekday === "Sun" }; }
const ms = (v) => (!v ? 0 : typeof v === "number" ? v : v.toMillis ? v.toMillis() : 0);

/* Itens obrigatórios que faltam na entrada. Reproduz a regra de
   js/onboarding.js: grupo dispensado não conta; item "não se aplica"
   não conta; CNH atende RG e CPF. A lista de itens vem de
   conteudo/entrada (se a equipe editar) ou do padrão embutido. */
const OBRIGATORIOS_PADRAO = [
  ["societario", "contrato-social", "Contrato social"], ["contabil", "balancos", "Balanços anteriores"], ["contabil", "dre", "DRE"],
  ["fiscal", "certificado-digital", "Certificado digital"],
  ["trabalhista", "fichas-funcionarios", "Fichas dos funcionários"], ["trabalhista", "folhas-12m", "Folhas dos últimos 12 meses"], ["trabalhista", "ferias", "Relação de férias"], ["trabalhista", "ficha-financeira", "Ficha financeira"], ["trabalhista", "extrato-folha", "Extrato analítico da folha"],
  ["socios", "comprovante-endereco", "Comprovante de endereço do sócio"], ["socios", "rg", "RG do sócio"], ["socios", "cpf", "CPF do sócio"]
];
const CONTA = ["enviado", "analise", "aprovado"];
function faltando(en) {
  const itens = en.itens || {}, na = en.gruposNA || {}, socios = en.socios || [];
  const out = [];
  OBRIGATORIOS_PADRAO.forEach(([g, id, nome]) => {
    if (na[g]) return;
    const alvos = g === "socios" ? socios.map((s) => s.id) : [null];
    if (g === "socios" && !alvos.length) { if (!out.some((x) => x === "cadastro dos sócios")) out.push("cadastro dos sócios"); return; }
    alvos.forEach((sid) => {
      const k = sid ? `socios/${sid}/${id}` : `${g}/${id}`;
      const reg = itens[k] || {};
      if (reg.na || CONTA.includes(reg.situacao)) return;
      if ((id === "rg" || id === "cpf") && sid) { const cnh = itens[`socios/${sid}/cnh`] || {}; if (CONTA.includes(cnh.situacao)) return; }
      const s = sid ? socios.find((x) => x.id === sid) : null;
      out.push(nome + (s ? " (" + s.nome.split(" ")[0] + ")" : ""));
    });
  });
  return out;
}

exports.cobrarEntrada = onSchedule({ schedule: "0 * * * *", timeZone: "America/Maceio", region: REGIAO }, async () => {
  const db = getFirestore();
  const cfg = await configuracao(db);
  if (!cfg.ligado) return;
  const agora = agoraEmMaceio();
  if (agora.hora !== cfg.hora || (cfg.diasUteis && agora.fimDeSemana)) return;
  const emps = await db.collection("empresas").where("ativa", "==", true).get();
  let enviados = 0;
  for (const doc of emps.docs) {
    if (enviados >= MAXIMO_POR_RODADA) { console.warn("limite por rodada atingido"); break; }
    const e = doc.data(); const j = e.jornada || {}; const en = e.entrada || {};
    if (e.migracaoConcluidaEm) continue;
    const aceite = ms(j.aceiteEm) || ms(e.criadaEm); if (!aceite) continue;
    const diaHoje = Math.floor((Date.now() - aceite) / DIA);
    if (diaHoje < DIA_INICIO + TOLERANCIA_DIAS) continue;                  /* antes do D7 ninguém cobra */
    const acessos = await doc.ref.collection("acessos").limit(1).get(); if (acessos.empty) continue;   /* nunca entrou: problema é o convite */
    const ultimo = ms(en.avisoAutomaticoEm); if (ultimo && Date.now() - ultimo < DIAS_ENTRE_AVISOS * DIA) continue;
    const faltam = faltando(en); if (!faltam.length) continue;
    const primeiro = acessos.docs[0].data().nome || "";
    const saud = primeiro ? cfg.saudacaoCom.replace("{nome}", primeiro.split(" ")[0]) : cfg.saudacaoSem;
    const lista = faltam.length === 1 ? "falta 1 item obrigatório (" + faltam[0] + ")" : "faltam " + faltam.length + " itens obrigatórios (" + faltam.slice(0, 3).join(", ") + (faltam.length > 3 ? " e mais " + (faltam.length - 3) : "") + ")";
    await doc.ref.collection("mensagens").add({ autor: { uid: "sistema", nome: "Totali", lado: "equipe", sistema: true }, texto: saud + " " + cfg.corpo.replace("{faltam}", lista), anexos: [], em: FieldValue.serverTimestamp(), lidaPor: {}, reacoes: {}, lidaEquipe: true });
    await doc.ref.update({ "entrada.avisoAutomaticoEm": FieldValue.serverTimestamp() });
    enviados++;
  }
});

/* ============================================================
   Envio do mês: o que passou do prazo (+2 dias de tolerância),
   uma vez por semana por empresa, no mesmo horário do outro aviso.
   Reproduz js/envio.js: itens de conteudo/envio (ou o padrão) e
   cada empresa só responde pelo que vale para ela.
   ============================================================ */
const ENVIO_PADRAO = [
  { id: "extratos", texto: "Extratos bancários de todas as contas", prazoDia: 5, so: "banco" },
  { id: "notas-venda", texto: "Notas fiscais de venda (XML ou relatório)", prazoDia: 8, so: "todos" },
  { id: "notas-compra", texto: "Notas de compra e despesas", prazoDia: 8, so: "todos" },
  { id: "maquininhas", texto: "Relatório das maquininhas", prazoDia: 8, so: "maquininhas" },
  { id: "folha", texto: "Alterações na folha (admissão, férias, faltas)", prazoDia: 10, so: "funcionarios" },
  { id: "impostos", texto: "Comprovantes dos impostos pagos", prazoDia: 20, so: "todos" }
];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
function anoMesMaceio() { const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Maceio", year: "numeric", month: "2-digit" }).format(new Date()); return p.slice(0, 7); }
async function itensEnvio(db) {
  try {
    const d = await db.collection("conteudo").doc("envio").get();
    const lista = d.exists && Array.isArray(d.data().itens) ? d.data().itens : [];
    const ok = lista.map((i) => ({ id: String(i.id || "").slice(0, 40), texto: texto(i.texto, 120), prazoDia: Number(i.prazoDia), so: i.so })).filter((i) => i.id && i.texto && i.prazoDia >= 1 && i.prazoDia <= 28);
    return ok.length ? ok : ENVIO_PADRAO;
  } catch (e) { console.error("conteudo/envio", e && e.message); return ENVIO_PADRAO; }
}
function valePara(item, e) {
  const f = e.financeiro || {};
  if (item.so === "funcionarios") return (e.perfis || []).includes("com-funcionarios");
  if (item.so === "maquininhas") return f.temMaquineta === true;
  if (item.so === "banco") return f.temBanco !== false;
  return true;
}

exports.cobrarEnvio = onSchedule({ schedule: "30 * * * *", timeZone: "America/Maceio", region: REGIAO }, async () => {
  const db = getFirestore();
  const cfg = await configuracao(db);
  if (!cfg.envioLigado) return;
  const agora = agoraEmMaceio();
  if (agora.hora !== cfg.hora || (cfg.diasUteis && agora.fimDeSemana)) return;
  const anoMes = anoMesMaceio(); const [ano, mes] = anoMes.split("-").map(Number);
  const catalogo = await itensEnvio(db);
  const emps = await db.collection("empresas").where("ativa", "==", true).get();
  let enviados = 0;
  for (const doc of emps.docs) {
    if (enviados >= MAXIMO_POR_RODADA) { console.warn("limite por rodada atingido (envio)"); break; }
    const e = doc.data();
    /* Envio do mês é parte do portal (não é sistema contratado): vale para toda empresa ativa com acesso */
    const acessos = await doc.ref.collection("acessos").limit(1).get(); if (acessos.empty) continue;
    const ref = doc.ref.collection("checklist").doc(anoMes);
    const salvo = await ref.get(); const reg = salvo.exists ? salvo.data() : {};
    const ultimo = ms(reg.avisoAutomaticoEm); if (ultimo && Date.now() - ultimo < DIAS_ENTRE_AVISOS * DIA) continue;
    const feitos = new Set((reg.itens || []).filter((i) => i.feito).map((i) => i.id));
    const atrasados = catalogo.filter((i) => valePara(i, e) && !feitos.has(i.id) && Date.now() > new Date(ano, mes - 1, i.prazoDia, 23, 59, 59).getTime() + TOLERANCIA_DIAS * DIA);
    if (!atrasados.length) continue;
    const primeiro = acessos.docs[0].data().nome || "";
    const saud = primeiro ? cfg.saudacaoCom.replace("{nome}", primeiro.split(" ")[0]) : cfg.saudacaoSem;
    const nomes = atrasados.map((i) => i.texto.toLowerCase());
    const lista = (atrasados.length === 1 ? "falta 1 item de " : "faltam " + atrasados.length + " itens de ") + MESES[mes - 1] + " (" + nomes.slice(0, 3).join(", ") + (nomes.length > 3 ? " e mais " + (nomes.length - 3) : "") + ")";
    await doc.ref.collection("mensagens").add({ autor: { uid: "sistema", nome: "Totali", lado: "equipe", sistema: true }, texto: saud + " " + cfg.envioCorpo.replace("{faltam}", lista), anexos: [], em: FieldValue.serverTimestamp(), lidaPor: {}, reacoes: {} });
    await ref.set({ empresaId: doc.id, anoMes, avisoAutomaticoEm: FieldValue.serverTimestamp() }, { merge: true });
    enviados++;
  }
});
