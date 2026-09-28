/* ============================================================
   Totali · Portal do Cliente
   functions/email.js — peça comum de e-mail (não é função)

   Configuração (configPrivada/email, senha selada pelo cofre),
   montagem do e-mail com a cara da Totali e envio pelo SMTP.
   Usada por avisos.js (clientes) e triagem.js (equipe).
   ============================================================ */
"use strict";

const { FieldValue } = require("firebase-admin/firestore");
const { abrir } = require("./chaves");

const PORTAL_PADRAO = "https://totalicontabilidade.github.io/portaldocliente/";

const PADRAO = {
  remetenteNome: "Totali Soluções Contábeis",
  eventos: { chat: true, cobrancas: true, documentos: true, correcao: true },
  assuntos: {
    chat: "Nova mensagem da Totali",
    cobrancas: "Lembrete da Totali",
    documentos: "Novo documento da Totali no seu portal",
    correcao: "Um documento precisa de correção"
  },
  assinatura: "Equipe Totali Soluções Contábeis"
};

async function configuracao(db) {
  const s = await db.doc("configPrivada/email").get();
  if (!s.exists) return null;
  const c = s.data() || {};
  const cfg = {
    ...PADRAO, ...c,
    eventos: { ...PADRAO.eventos, ...(c.eventos || {}) },
    assuntos: { ...PADRAO.assuntos, ...(c.assuntos || {}) },
    linkPortal: c.linkPortal || PORTAL_PADRAO
  };
  return cfg;
}

let transporteCache = null, chaveTransporte = "";
async function transporte(cfg) {
  if (!cfg.host || !cfg.usuario || !cfg.pacote) throw new Error("e-mail não configurado (servidor, usuário e senha)");
  const senha = (await abrir(cfg.pacote)).senha;
  const chave = [cfg.host, cfg.porta, cfg.usuario, senha].join("|");
  if (transporteCache && chave === chaveTransporte) return transporteCache;
  const nodemailer = require("nodemailer");
  const porta = Number(cfg.porta) || 587;
  transporteCache = nodemailer.createTransport({ host: cfg.host, port: porta, secure: porta === 465, auth: { user: cfg.usuario, pass: senha } });
  chaveTransporte = chave;
  return transporteCache;
}

function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }

/* E-mail simples, legível em qualquer cliente de e-mail: faixa azul da Totali, texto, botão dourado. */
function montar(cfg, { titulo, texto, botao, link, rodape }) {
  const corpo = esc(texto).replace(/\n/g, "<br>");
  const html = '<!doctype html><html><body style="margin:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;color:#1f2937">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:24px 12px"><tr><td align="center">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">' +
    '<tr><td style="background:#182c43;padding:18px 24px;color:#ffffff;font-size:18px;font-weight:bold">Totali <span style="color:#c89d57">·</span> Portal do Cliente</td></tr>' +
    '<tr><td style="padding:24px"><h1 style="margin:0 0 12px;font-size:20px;color:#182c43">' + esc(titulo) + "</h1>" +
    '<p style="margin:0 0 20px;font-size:15px;line-height:1.55">' + corpo + "</p>" +
    (link ? '<a href="' + esc(link) + '" style="display:inline-block;background:#c89d57;color:#182c43;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:8px">' + esc(botao || "Abrir o portal") + "</a>" : "") +
    '<p style="margin:24px 0 0;font-size:13px;color:#6b7280">' + esc(cfg.assinatura) + "</p></td></tr>" +
    '<tr><td style="padding:14px 24px;background:#f9fafb;font-size:12px;color:#9ca3af">' + esc(rodape || "Você recebe este aviso porque usa o portal da Totali. Para não receber mais por e-mail, desligue em Perfil › Avisos por e-mail.") + "</td></tr>" +
    "</table></td></tr></table></body></html>";
  const txt = titulo + "\n\n" + texto + (link ? "\n\n" + (botao || "Abrir o portal") + ": " + link : "") + "\n\n" + cfg.assinatura;
  return { html, text: txt };
}

async function enviar(db, cfg, para, assunto, conteudo, registro) {
  const t = await transporte(cfg);
  const de = '"' + String(cfg.remetenteNome || PADRAO.remetenteNome).replace(/"/g, "") + '" <' + (cfg.remetenteEmail || cfg.usuario) + ">";
  const m = montar(cfg, conteudo);
  let enviados = 0;
  for (const p of para) {
    await t.sendMail({ from: de, to: p, subject: assunto, text: m.text, html: m.html });
    enviados++;
  }
  await db.collection("auditoria").add({ tipo: "email:" + registro.tipo, empresaId: registro.empresaId || "", detalhe: assunto + " · " + enviados + " destinatário" + (enviados === 1 ? "" : "s"), em: FieldValue.serverTimestamp() });
  return enviados;
}

/* Quem da empresa recebe: cada acesso do portal com e-mail, menos quem desligou em Perfil. */
async function destinatarios(db, empresaId) {
  const a = await db.collection("empresas").doc(empresaId).collection("acessos").get();
  return a.docs.map((d) => d.data() || {}).filter((x) => x.email && x.avisosEmail !== false).map((x) => x.email);
}

function trecho(t, n) { t = String(t || "").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; }

/* Quem da equipe recebe avisos internos (triagem de arquivos): os administradores com e-mail. */
async function emailsDaEquipe(db) {
  const s = await db.collection("usuarios").where("papel", "==", "admin").get();
  return s.docs.map((d) => (d.data() || {}).email).filter(Boolean);
}

module.exports = { PADRAO, PORTAL_PADRAO, configuracao, enviar, destinatarios, trecho, esc, emailsDaEquipe };
