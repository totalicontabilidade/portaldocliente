/* ============================================================
   Totali · Portal do Cliente
   functions/resumo.js — o que roda por horário

   1. resumoDeUso (dia 1 de cada mês, 7h): agrega /uso do mês
      anterior por empresa × sistema em /resumos/{anoMes}, para a
      cobrança não depender de varrer 5.000 registros no painel.

   2. lembreteJornada (dias úteis, 9h): para cada empresa com
      jornada aberta, grava em empresas/{id}/mensagens um aviso de
      sistema quando há passo do CLIENTE vencido há 2+ dias
      (tolerância de 48 h). Um aviso por dia, no máximo; nunca
      propaganda (docs/00-pesquisa-engajamento.md, tema 2, item 6).
   ============================================================ */
"use strict";

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const REGIAO = "southamerica-east1";
const DIA = 86400000;

exports.resumoDeUso = onSchedule({ schedule: "0 7 1 * *", timeZone: "America/Maceio", region: REGIAO }, async () => {
  const db = getFirestore();
  const agora = new Date(); agora.setDate(1); agora.setHours(0, 0, 0, 0);
  const fim = agora.getTime(), inicio = new Date(agora.getFullYear(), agora.getMonth() - 1, 1).getTime();
  const anoMes = new Date(inicio).toISOString().slice(0, 7);
  const snap = await db.collection("uso").where("em", ">=", new Date(inicio)).where("em", "<", new Date(fim)).get();
  const mapa = {};
  snap.forEach((d) => {
    const u = d.data(); if (u.tipo === "vitrine") return;
    const sis = u.sistemaId || (u.tipo === "tela" ? "portal" : ""); if (!sis) return;
    const k = u.empresaId + "|" + sis;
    const r = mapa[k] || (mapa[k] = { empresaId: u.empresaId, sistemaId: sis, aberturas: 0, segundos: 0, pessoas: {}, dias: {} });
    if (u.tipo === "abrir" || (u.tipo === "tela" && sis === "portal")) r.aberturas++;
    if (u.tipo === "sessao") r.segundos += Number(u.duracaoS) || 0;
    if (u.uid) r.pessoas[u.uid] = 1;
    const em = u.em && u.em.toDate ? u.em.toDate() : new Date(u.em);
    r.dias[em.toISOString().slice(0, 10)] = 1;
  });
  const linhas = Object.values(mapa).map((r) => ({ ...r, pessoas: Object.keys(r.pessoas).length, diasAtivos: Object.keys(r.dias).length, dias: undefined }));
  await db.collection("resumos").doc(anoMes).set({ anoMes, geradoEm: FieldValue.serverTimestamp(), linhas });
});

exports.lembreteJornada = onSchedule({ schedule: "0 9 * * 1-5", timeZone: "America/Maceio", region: REGIAO }, async () => {
  const db = getFirestore();
  const conteudo = await db.collection("conteudo").doc("jornada").get();
  const dias = (conteudo.exists && conteudo.data().dias) || [];
  if (!dias.length) return;   /* sem jornada publicada, o padrão vive só no navegador; nada a cobrar daqui */
  const emps = await db.collection("empresas").where("ativa", "==", true).get();
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  for (const doc of emps.docs) {
    const e = doc.data(); const j = e.jornada || {};
    if (j.concluidaEm || !j.aceiteEm) continue;
    const aceite = typeof j.aceiteEm === "number" ? j.aceiteEm : (j.aceiteEm.toMillis ? j.aceiteEm.toMillis() : 0);
    if (!aceite) continue;
    const passos = j.passos || {};
    const vencidos = [];
    dias.forEach((d) => {
      const prazo = aceite + (Number(d.dia) || 0) * DIA;
      if (hoje.getTime() - prazo < 2 * DIA) return;   /* tolerância de 48 h */
      (d.cliente || []).forEach((p, i) => { if (!passos[d.id + ".c." + i] && !p.auto) vencidos.push("D" + d.dia + " · P" + (i + 1) + ": " + p.texto); });
    });
    if (!vencidos.length) continue;
    const ultimo = j.ultimoLembreteEm && j.ultimoLembreteEm.toMillis ? j.ultimoLembreteEm.toMillis() : (j.ultimoLembreteEm || 0);
    if (Date.now() - ultimo < DIA) continue;
    await doc.ref.collection("mensagens").add({
      autor: { uid: "sistema", nome: "Totali", lado: "equipe", sistema: true },
      texto: "Oi! Passando para lembrar dos passos da sua jornada que ficaram para trás:\n• " + vencidos.slice(0, 3).join("\n• ") + (vencidos.length > 3 ? "\n• e mais " + (vencidos.length - 3) : "") + "\n\nQualquer dúvida, é só responder aqui. 🙂",
      anexos: [], em: FieldValue.serverTimestamp(), lidaPor: {}, reacoes: {}, lidaEquipe: true
    });
    await doc.ref.update({ "jornada.ultimoLembreteEm": FieldValue.serverTimestamp() });
  }
});
