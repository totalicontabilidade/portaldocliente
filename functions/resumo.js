/* ============================================================
   Totali · Portal do Cliente
   functions/resumo.js — o que roda por horário

   1. resumoDeUso (dia 1 de cada mês, 7h): agrega /uso do mês
      anterior por empresa × sistema em /resumos/{anoMes}, para a
      cobrança não depender de varrer milhares de registros.

   2. resumoDoMes (dia 1 de cada mês, 8h): escreve na conversa de
      cada empresa ativa um resumo do mês anterior (documentos,
      aprovações, checklist, mensagens) e grava em
      empresas/{id}/resumos/{anoMes}. É o "peak-end" do mês: termina
      bem, com o que foi feito e o próximo passo. Sem propaganda.
   ============================================================ */
"use strict";

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const REGIAO = "southamerica-east1";
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
function mesAnterior() { const a = new Date(); a.setDate(1); a.setHours(0, 0, 0, 0); const fim = a.getTime(); const ini = new Date(a.getFullYear(), a.getMonth() - 1, 1); return { inicio: ini.getTime(), fim, anoMes: ini.toISOString().slice(0, 7), nome: MESES[ini.getMonth()] }; }
const ms = (v) => (!v ? 0 : typeof v === "number" ? v : v.toMillis ? v.toMillis() : 0);

exports.resumoDeUso = onSchedule({ schedule: "0 7 1 * *", timeZone: "America/Maceio", region: REGIAO }, async () => {
  const db = getFirestore(), m = mesAnterior();
  const snap = await db.collection("uso").where("em", ">=", new Date(m.inicio)).where("em", "<", new Date(m.fim)).get();
  const mapa = {};
  snap.forEach((d) => {
    const u = d.data(); if (u.tipo === "vitrine") return;
    const sis = u.sistemaId || (u.tipo === "tela" ? "portal" : ""); if (!sis) return;
    const k = u.empresaId + "|" + sis;
    const r = mapa[k] || (mapa[k] = { empresaId: u.empresaId, sistemaId: sis, aberturas: 0, segundos: 0, pessoas: {}, dias: {} });
    if (u.tipo === "abrir" || (u.tipo === "tela" && sis === "portal")) r.aberturas++;
    if (u.duracaoS) r.segundos += Number(u.duracaoS) || 0;
    if (u.uid) r.pessoas[u.uid] = 1;
    r.dias[new Date(ms(u.em)).toISOString().slice(0, 10)] = 1;
  });
  const linhas = Object.values(mapa).map((r) => ({ empresaId: r.empresaId, sistemaId: r.sistemaId, aberturas: r.aberturas, segundos: r.segundos, pessoas: Object.keys(r.pessoas).length, diasAtivos: Object.keys(r.dias).length }));
  await db.collection("resumos").doc(m.anoMes).set({ anoMes: m.anoMes, geradoEm: FieldValue.serverTimestamp(), linhas });
});

exports.resumoDoMes = onSchedule({ schedule: "0 8 1 * *", timeZone: "America/Maceio", region: REGIAO }, async () => {
  const db = getFirestore(), m = mesAnterior();
  const emps = await db.collection("empresas").where("ativa", "==", true).get();
  for (const doc of emps.docs) {
    const e = doc.data();
    if (ms(e.criadaEm) > m.fim) continue;
    const docs = await doc.ref.collection("documentos").where("em", ">=", new Date(m.inicio)).where("em", "<", new Date(m.fim)).get();
    const msgs = await doc.ref.collection("mensagens").where("em", ">=", new Date(m.inicio)).where("em", "<", new Date(m.fim)).get();
    const check = await doc.ref.collection("checklist").doc(m.anoMes).get();
    const total = docs.size, aprovados = docs.docs.filter((d) => d.data().situacao === "aprovado").length;
    const ok = check.exists && !!check.data().concluidoEm;
    const itens = check.exists ? (check.data().itens || []) : [];
    const feitos = itens.filter((i) => i.feito).length;
    const resumo = { anoMes: m.anoMes, documentos: total, aprovados, mensagens: msgs.size, checklistConcluido: ok, checklistFeitos: feitos, checklistTotal: itens.length, geradoEm: FieldValue.serverTimestamp() };
    await doc.ref.collection("resumos").doc(m.anoMes).set(resumo);
    if (!total && !msgs.size && !itens.length) continue;
    const texto = "Resumo de " + m.nome + "\n• " + total + " documento" + (total === 1 ? "" : "s") + " enviado" + (total === 1 ? "" : "s") + ", " + aprovados + " aprovado" + (aprovados === 1 ? "" : "s") + "\n• Checklist do mês: " + (ok ? "100% em dia" : itens.length ? feitos + " de " + itens.length + " itens" : "não iniciado") + "\n• " + msgs.size + " mensagem" + (msgs.size === 1 ? "" : "ns") + " trocada" + (msgs.size === 1 ? "" : "s") + "\n\nPróximo passo: " + (ok ? "manter o ritmo no checklist deste mês." : "enviar o que falta no Checklist do mês até o dia 20.") + " A linha do tempo completa está no portal, em Linha do tempo.";
    await doc.ref.collection("mensagens").add({ autor: { uid: "sistema", nome: "Totali", lado: "equipe", sistema: true }, texto, anexos: [], em: FieldValue.serverTimestamp(), lidaPor: {}, reacoes: {}, lidaEquipe: true });
  }
});
