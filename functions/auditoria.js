/* ============================================================
   Totali · Portal do Cliente
   functions/auditoria.js — a trilha que vale como prova

   Observa as gravações que já acontecem e escreve a versão dela
   em /auditoria, com a hora do SERVIDOR. A regra do Firestore
   fecha /auditoria para escrita de todo mundo; só esta função
   escreve. A equipe lê.

   O que registra
     documento:enviado / removido / aprovado / correcao / visto
     credencial:guardada / removida        (a abertura é em senhas.js)
     liberacao:ativada / desativada        (por sistema)
     acesso:criado / revogado
     equipe:entrou / saiu / promovido / rebaixado
     jornada:concluida
   O que NÃO registra, de propósito: conteúdo. Nunca o texto de uma
   mensagem, nunca o pacote de uma credencial, nunca o arquivo.

   Quem fez: os documentos carregam `revisao.uid`, `por` ou o uid
   em `vistos`; quando não há, fica o nome informado.
   ============================================================ */
"use strict";

const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const REGIAO = "southamerica-east1";

async function anotar(empresaId, tipo, detalhe) {
  await getFirestore().collection("auditoria").add({ empresaId: String(empresaId || ""), tipo, em: FieldValue.serverTimestamp(), ...detalhe });
}
const texto = (v, max) => (typeof v === "string" ? v.slice(0, max || 200) : "");

exports.auditarDocumento = onDocumentWritten({ document: "empresas/{empresaId}/documentos/{docId}", region: REGIAO }, async (event) => {
  const antes = event.data.before.exists ? event.data.before.data() : null;
  const depois = event.data.after.exists ? event.data.after.data() : null;
  const empresaId = event.params.empresaId;
  if (!antes && depois) return anotar(empresaId, "documento:enviado", { por: texto(depois.por), detalhe: texto(depois.nome) + " (" + texto(depois.origem) + ")", grupo: texto(depois.grupo) });
  if (antes && !depois) return anotar(empresaId, "documento:removido", { detalhe: texto(antes.nome) });
  if (antes.situacao !== depois.situacao && (depois.situacao === "aprovado" || depois.situacao === "pendencia")) {
    const r = depois.revisao || {};
    return anotar(empresaId, depois.situacao === "aprovado" ? "documento:aprovado" : "documento:correcao", { por: texto(r.por), uid: texto(r.uid), detalhe: texto(depois.nome) });
  }
  const va = (antes.vistos || []).length, vd = (depois.vistos || []).length;
  if (vd > va) { const v = depois.vistos[vd - 1] || {}; return anotar(empresaId, "documento:visto", { por: texto(v.por), detalhe: texto(depois.nome) }); }
});

exports.auditarCredencial = onDocumentWritten({ document: "empresas/{empresaId}/credenciais/{id}", region: REGIAO }, async (event) => {
  const antes = event.data.before.exists ? event.data.before.data() : null;
  const depois = event.data.after.exists ? event.data.after.data() : null;
  if (!antes && depois) return anotar(event.params.empresaId, "credencial:guardada", { por: texto(depois.por), detalhe: texto(depois.rotulo) });
  if (antes && !depois) return anotar(event.params.empresaId, "credencial:removida", { detalhe: texto(antes.rotulo) });
});

exports.auditarEmpresa = onDocumentWritten({ document: "empresas/{empresaId}", region: REGIAO }, async (event) => {
  const antes = event.data.before.exists ? event.data.before.data() : {};
  const depois = event.data.after.exists ? event.data.after.data() : null;
  if (!depois) return;
  const la = antes.liberacoes || {}, ld = depois.liberacoes || {};
  for (const k of new Set([...Object.keys(la), ...Object.keys(ld)])) {
    const a = !!(la[k] && la[k].ativo), d = !!(ld[k] && ld[k].ativo);
    if (a !== d) await anotar(event.params.empresaId, d ? "liberacao:ativada" : "liberacao:desativada", { detalhe: k, plano: texto((ld[k] || {}).plano) });
  }
  const ja = (antes.jornada || {}).concluidaEm, jd = (depois.jornada || {}).concluidaEm;
  if (!ja && jd) await anotar(event.params.empresaId, "jornada:concluida", {});
});

exports.auditarAcesso = onDocumentWritten({ document: "empresas/{empresaId}/acessos/{uid}", region: REGIAO }, async (event) => {
  const antes = event.data.before.exists, depois = event.data.after.exists;
  const d = depois ? event.data.after.data() : event.data.before.data();
  if (!antes && depois) return anotar(event.params.empresaId, "acesso:criado", { uid: event.params.uid, detalhe: texto(d.email) });
  if (antes && !depois) return anotar(event.params.empresaId, "acesso:revogado", { uid: event.params.uid, detalhe: texto(d.email) });
});

exports.auditarEquipe = onDocumentWritten({ document: "usuarios/{uid}", region: REGIAO }, async (event) => {
  const antes = event.data.before.exists ? event.data.before.data() : null;
  const depois = event.data.after.exists ? event.data.after.data() : null;
  if (!antes && depois) return anotar("", "equipe:entrou", { uid: event.params.uid, detalhe: texto(depois.email) });
  if (antes && !depois) return anotar("", "equipe:saiu", { uid: event.params.uid, detalhe: texto(antes.email) });
  if (antes.papel !== depois.papel) return anotar("", depois.papel === "admin" ? "equipe:promovido" : "equipe:rebaixado", { uid: event.params.uid, detalhe: texto(depois.email) });
});
