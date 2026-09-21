/* ============================================================
   Totali · Portal do Cliente
   functions/lembretes.js — a cobrança automática que segue a jornada

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
  ligado: true, hora: 10, diasUteis: true,
  saudacaoCom: "Olá, {nome}!", saudacaoSem: "Olá!",
  corpo: "Passando para lembrar que ainda {faltam} para concluirmos a entrada da sua empresa aqui na Totali.\n\nÉ só abrir o portal, em Entrada na Totali, e enviar: dá para tirar foto pelo celular. Se algum item não se aplica à sua empresa, marque \"não se aplica\". Qualquer dúvida, responda por aqui mesmo que a gente resolve."
};
const texto = (v, max) => (typeof v === "string" && v.trim() ? v.slice(0, max) : "");
async function configuracao(db) {
  try { const d = await db.collection("conteudo").doc("lembretes").get(); if (!d.exists) return PADRAO; const c = d.data() || {}; const h = Number(c.hora); return { ligado: c.ligado !== false, hora: Number.isInteger(h) && h >= 0 && h <= 23 ? h : PADRAO.hora, diasUteis: c.diasUteis !== false, saudacaoCom: texto(c.saudacaoCom, 200) || PADRAO.saudacaoCom, saudacaoSem: texto(c.saudacaoSem, 200) || PADRAO.saudacaoSem, corpo: texto(c.corpo, 2000) || PADRAO.corpo }; }
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
