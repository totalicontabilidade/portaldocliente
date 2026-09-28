/* ============================================================
   Totali · Portal do Cliente
   functions/avisos.js — avisos por e-mail ao cliente

   Pedido do Raoni (25/09/2026): aviso por e-mail como PADRÃO em
   tudo o que o cliente precisa saber, sem depender de ele ter
   liberado as notificações do navegador. Liga-se em
   Painel › Conteúdo do portal › E-mail (servidor SMTP da Totali,
   configurado pela tela; a senha chega selada com a chave do cofre
   e só esta função abre).

   Quando manda (cada um pode ser desligado no painel):
     • mensagem da equipe no chat que o cliente NÃO leu em 10 min
       (sugestão aceita em 25/09/2026: quem está conversando no portal
       não recebe e-mail; várias mensagens seguidas viram um e-mail só,
       e no máximo 1 a cada 20 min por empresa);
     • cobranças e avisos automáticos (mensagens do sistema);
     • documento novo que a Totali mandou ao portal;
     • documento que a equipe devolveu pedindo correção;
     • pedidos do painel: "Enviar por e-mail" (cobrança pronta,
       convite) e o e-mail de teste da configuração.
   O cliente pode desligar para si em Perfil (acessos/{uid}.avisosEmail).
   Cada envio fica em /auditoria (tipo email:*), sem o texto.
   ============================================================ */
"use strict";

const { onDocumentCreated, onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { PADRAO, configuracao, enviar, destinatarios, trecho } = require("./email");

const REGIAO = "southamerica-east1";
const INTERVALO_CHAT_MS = 20 * 60 * 1000;
/* mensagem da equipe só vira e-mail se o cliente não ler em 10 min (quem está no portal conversando não recebe nada) */
const ESPERA_LEITURA_MS = 10 * 60 * 1000;

/* 1. Mensagem da Totali no chat.
   Automática (cobrança, resumo): e-mail na hora.
   Da equipe: fica pendente em avisosPendentes/{empresa}; a rodada de 5 em 5 min manda só se ninguém da empresa leu em 10 min. */
exports.avisarMensagemPorEmail = onDocumentCreated({ document: "empresas/{empresaId}/mensagens/{msgId}", region: REGIAO }, async (event) => {
  const m = (event.data && event.data.data()) || {};
  if (!m.autor || m.autor.lado !== "equipe") return;
  const db = getFirestore(), empresaId = event.params.empresaId;
  const cfg = await configuracao(db);
  if (!cfg || !cfg.ligado) return;
  const automatica = !!m.autor.sistema;
  if (!automatica) {
    if (!cfg.eventos.chat) return;
    await db.doc("avisosPendentes/" + empresaId).set({ empresaId, desde: FieldValue.serverTimestamp(), msgs: FieldValue.arrayUnion(event.params.msgId) }, { merge: true })
      .then(() => db.doc("avisosPendentes/" + empresaId).get())
      .then((p) => { const d = p.data() || {}; if (d.primeira) return null; return p.ref.set({ primeira: Date.now() }, { merge: true }); });
    return;
  }
  if (!cfg.eventos.cobrancas) return;
  const para = await destinatarios(db, empresaId);
  if (!para.length) return;
  try {
    await enviar(db, cfg, para, cfg.assuntos.cobrancas, {
      titulo: "Aviso da Totali",
      texto: trecho(m.texto || "", 900),
      botao: "Abrir a conversa", link: cfg.linkPortal + "#/chat"
    }, { tipo: "cobrancas", empresaId });
  } catch (e) { console.error("e-mail de aviso automático não saiu", empresaId, e && e.message); }
});

/* Rodada de 5 em 5 min: mensagens da equipe que ninguém da empresa leu em 10 min viram um e-mail só. */
exports.enviarAvisosDoChat = onSchedule({ schedule: "*/5 * * * *", timeZone: "America/Maceio", region: REGIAO }, async () => {
  const db = getFirestore();
  const pend = await db.collection("avisosPendentes").where("primeira", "<=", Date.now() - ESPERA_LEITURA_MS).limit(100).get();
  if (pend.empty) return;
  const cfg = await configuracao(db);
  for (const p of pend.docs) {
    const d = p.data() || {}, empresaId = d.empresaId || p.id;
    try {
      if (!cfg || !cfg.ligado || !cfg.eventos.chat) { await p.ref.delete(); continue; }
      const emp = db.collection("empresas").doc(empresaId);
      const acessos = await emp.collection("acessos").get();
      const clientes = new Set(acessos.docs.map((a) => a.id));
      const naoLidas = [];
      for (const id of (d.msgs || []).slice(-20)) {
        const s = await emp.collection("mensagens").doc(id).get();
        if (!s.exists) continue;
        const m = s.data() || {};
        const leu = Object.keys(m.lidaPor || {}).some((uid) => clientes.has(uid));
        if (!leu) naoLidas.push(Object.assign({ _id: id, _em: (m.em && m.em.toMillis) ? m.em.toMillis() : Number(m.em) || 0 }, m));
      }
      if (!naoLidas.length) { await p.ref.delete(); continue; }
      /* os 10 min contam de cada mensagem não lida (28/09/2026: a pendência guardava a hora de uma mensagem já lida,
         e a seguinte virou e-mail com 8 min). Nenhuma não lida com 10 min ainda: a pendência espera, contando da mais antiga não lida. */
      if (!naoLidas.some((m) => m._em && m._em <= Date.now() - ESPERA_LEITURA_MS)) {
        /* só a hora muda: a lista de mensagens não é regravada (uma mensagem nova chegando agora não se perde) */
        await p.ref.set({ primeira: Math.min.apply(null, naoLidas.map((m) => m._em || Date.now())) }, { merge: true });
        continue;
      }
      /* conversa não vira enxurrada: no máximo 1 e-mail de chat a cada 20 min por empresa (a pendência espera) */
      const marca = db.doc("avisosEmail/" + empresaId);
      const ult = await marca.get();
      if (Date.now() - (ult.exists ? Number((ult.data() || {}).ultimoChat) || 0 : 0) < INTERVALO_CHAT_MS) continue;
      const para = acessos.docs.map((a) => a.data() || {}).filter((x) => x.email && x.avisosEmail !== false).map((x) => x.email);
      await p.ref.delete();
      if (!para.length) continue;
      const ultima = naoLidas[naoLidas.length - 1];
      const quem = (ultima.autor && ultima.autor.nome) || "A Totali";
      await enviar(db, cfg, para, cfg.assuntos.chat, {
        titulo: naoLidas.length > 1 ? "Você tem " + naoLidas.length + " mensagens da Totali" : quem + " respondeu no portal",
        texto: trecho(ultima.texto || (ultima.anexos && ultima.anexos.length ? "Mandamos um arquivo para você no chat." : ""), 900) + (naoLidas.length > 1 ? "\n\n(e mais " + (naoLidas.length - 1) + " no chat)" : ""),
        botao: "Abrir a conversa", link: cfg.linkPortal + "#/chat"
      }, { tipo: "chat", empresaId });
      await marca.set({ ultimoChat: Date.now() }, { merge: true });
    } catch (e) { console.error("aviso de chat não saiu", empresaId, e && e.message); }
  }
});

/* 2. Documento novo da Totali, ou documento devolvido para correção */
exports.avisarDocumentoPorEmail = onDocumentWritten({ document: "empresas/{empresaId}/documentos/{docId}", region: REGIAO }, async (event) => {
  const antes = event.data.before.exists ? event.data.before.data() : null;
  const depois = event.data.after.exists ? event.data.after.data() : null;
  if (!depois) return;
  const novoDaTotali = !antes && depois.origem === "equipe";
  const correcao = depois.situacao === "pendencia" && (!antes || antes.situacao !== "pendencia");
  if (!novoDaTotali && !correcao) return;
  const db = getFirestore(), empresaId = event.params.empresaId;
  const cfg = await configuracao(db);
  const tipo = correcao ? "correcao" : "documentos";
  if (!cfg || !cfg.ligado || !cfg.eventos[tipo]) return;
  const para = await destinatarios(db, empresaId);
  if (!para.length) return;
  const nome = depois.nome || (depois.arquivo && depois.arquivo.nome) || "documento";
  const motivo = depois.revisao && depois.revisao.motivo;
  try {
    await enviar(db, cfg, para, cfg.assuntos[tipo], correcao
      ? { titulo: "Um documento precisa de correção", texto: "O documento " + nome + " voltou para você." + (motivo ? "\nMotivo: " + motivo : "") + "\nÉ só abrir Meus arquivos no portal e enviar de novo.", botao: "Ver o documento", link: cfg.linkPortal + "#/documentos" }
      : { titulo: "A Totali mandou um documento", texto: nome + " está disponível no seu portal, em Meus arquivos.", botao: "Ver o documento", link: cfg.linkPortal + "#/documentos" },
    { tipo, empresaId });
  } catch (e) { console.error("e-mail de documento não saiu", empresaId, e && e.message); }
});

/* 3. Pedidos do painel: teste da configuração, cobrança pronta, convite */
exports.enviarEmailPedido = onDocumentCreated({ document: "pedidosDeEmail/{pedidoId}", region: REGIAO }, async (event) => {
  const snap = event.data; if (!snap) return;
  const p = snap.data() || {}, db = getFirestore();
  const responder = (d) => snap.ref.set({ ...d, concluidoEm: FieldValue.serverTimestamp(), expiraEm: new Date(Date.now() + 3600 * 1000) }, { merge: true });
  const autor = p.pedidoPor ? await db.collection("usuarios").doc(String(p.pedidoPor)).get() : null;
  if (!autor || !autor.exists) return responder({ erro: "quem pediu não é da equipe" });
  const cfg = await configuracao(db);
  if (!cfg) return responder({ erro: "O e-mail ainda não foi configurado (Conteúdo do portal › E-mail)." });
  if (p.tipo !== "teste" && !cfg.ligado) return responder({ erro: "O envio de e-mail está desligado (Conteúdo do portal › E-mail)." });
  try {
    let para = [], assunto = "", conteudo = null;
    if (p.tipo === "teste") {
      para = [(autor.data() || {}).email].filter(Boolean);
      assunto = "Teste do e-mail do Portal da Totali";
      conteudo = { titulo: "Está funcionando", texto: "Este é o e-mail de teste do Portal do Cliente. Se você recebeu, os avisos automáticos podem ser ligados.", botao: "Abrir o portal", link: cfg.linkPortal };
    } else if (p.tipo === "aviso") {
      /* aviso a uma pessoa só (ex.: a equipe deu acesso a mais uma empresa para quem já usa o portal) */
      para = [String(p.para || "").trim()].filter((x) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x));
      assunto = trecho(p.assunto || "Aviso da Totali", 120);
      conteudo = { titulo: assunto, texto: trecho(p.texto, 3000), botao: "Abrir o portal", link: cfg.linkPortal + (p.rota || "") };
    } else if (p.tipo === "membro") {
      /* criado pela função equipe.js (pessoa nova na equipe): link para criar a própria senha */
      para = [String(p.para || "").trim()].filter((x) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x));
      assunto = "Seu acesso ao painel da equipe Totali";
      conteudo = { titulo: "Olá, " + trecho(p.nome || "", 60) + "!", texto: "Você agora faz parte da equipe no Portal do Cliente da Totali. Toque no botão para criar a sua senha. O link vale por pouco tempo; se expirar, peça um novo ao administrador.", botao: "Criar minha senha", link: String(p.link || "") };
    } else if (p.tipo === "convite") {
      para = [String(p.para || "").trim()].filter((x) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x));
      assunto = "Seu acesso ao Portal do Cliente da Totali";
      conteudo = { titulo: "Bem-vindo ao portal da Totali", texto: trecho(p.texto, 2000), botao: "Criar meu acesso", link: String(p.link || "") };
    } else {
      para = p.empresaId ? await destinatarios(db, String(p.empresaId)) : [];
      assunto = trecho(p.assunto || "Mensagem da Totali", 120);
      conteudo = { titulo: assunto, texto: trecho(p.texto, 3000), botao: "Abrir o portal", link: cfg.linkPortal + (p.rota || "") };
    }
    if (!para.length) return responder({ erro: p.tipo === "convite" ? "E-mail do destinatário inválido." : "Ninguém desta empresa tem e-mail para receber (ou todos desligaram os avisos)." });
    const n = await enviar(db, cfg, para, assunto, conteudo, { tipo: p.tipo || "mensagem", empresaId: p.empresaId || "" });
    return responder({ erro: "", enviados: n });
  } catch (e) {
    console.error("pedido de e-mail falhou", e && e.message);
    return responder({ erro: "O servidor de e-mail recusou: " + trecho(e && e.message, 200) });
  }
});
