/* ============================================================
   Totali · Portal do Cliente
   functions/exclusao.js — apagar a conta de login de um cliente

   Trazido do Academy. Encerrar um cliente pelo painel arquiva a
   empresa; a CONTA DE LOGIN fica no Authentication, e só um
   administrador do projeto pode apagá-la. O painel grava um pedido
   em exclusoesDeConta/ e esta função reage (não é onCall: a
   política da organização proíbe invocação pública no Cloud Run).

   Travas: só admin pede; ninguém apaga a própria conta; conta da
   equipe (existe em /usuarios) nunca é apagada; conta que ainda
   acessa outra empresa ativa não é apagada.
   ============================================================ */
"use strict";

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

const REGIAO = "southamerica-east1", LIMITE = 20;

async function aindaTemEmpresa(uid) {
  const db = admin.firestore();
  const c = await db.collection("clientes").doc(uid).get();
  const emps = c.exists ? (c.data().empresas || []) : [];
  for (const id of emps) { const e = await db.collection("empresas").doc(id).get(); if (e.exists && e.data().ativa !== false) return true; }
  return false;
}

exports.processarExclusaoDeConta = onDocumentCreated({ document: "exclusoesDeConta/{pedidoId}", region: REGIAO }, async (event) => {
  const snap = event.data; if (!snap) return;
  const pedido = snap.data() || {}, apagadas = [], recusadas = [];
  const encerrar = (erro) => snap.ref.set({ concluidoEm: admin.firestore.FieldValue.serverTimestamp(), apagadas, recusadas, erro: erro || "" }, { merge: true });
  const quem = String(pedido.pedidoPor || ""); if (!quem) return encerrar("pedido sem autor");
  const autor = await admin.firestore().collection("usuarios").doc(quem).get();
  if (!autor.exists || (autor.data() || {}).papel !== "admin") return encerrar("quem pediu não é administrador");
  const uids = (Array.isArray(pedido.uids) ? pedido.uids : []).filter((u) => typeof u === "string" && u && u.length <= 128 && u !== quem);
  if (!uids.length) return encerrar("nenhuma conta informada");
  if (uids.length > LIMITE) return encerrar(`no máximo ${LIMITE} contas por vez`);
  for (const uid of uids) {
    if ((await admin.firestore().collection("usuarios").doc(uid).get()).exists) { recusadas.push({ uid, motivo: "conta da equipe" }); continue; }
    if (await aindaTemEmpresa(uid)) { recusadas.push({ uid, motivo: "ainda acessa outra empresa ativa" }); continue; }
    try { await admin.auth().deleteUser(uid); apagadas.push(uid); }
    catch (e) { if (e && e.code === "auth/user-not-found") apagadas.push(uid); else recusadas.push({ uid, motivo: (e && e.message) || "erro ao apagar" }); }
    await admin.firestore().collection("auditoria").add({ empresaId: String(pedido.empresaId || ""), tipo: "conta:apagada", uid, por: (autor.data() || {}).nome || quem, em: admin.firestore.FieldValue.serverTimestamp() });
  }
  return encerrar("");
});
