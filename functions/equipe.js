/* ============================================================
   Totali · Portal do Cliente
   functions/equipe.js — colocar alguém na equipe pelo painel

   Pedido do Raoni: tudo pela interface. Antes, para dar acesso ao
   painel era preciso criar a pessoa no console do Firebase e copiar
   o UID. Agora o administrador preenche nome, e-mail, papel e setor
   em Painel › Equipe; o painel grava pedidosDeMembro/{id} e esta
   função (não é onCall: a política da organização proíbe invocação
   pública no Cloud Run):
     1. confere que quem pediu é administrador;
     2. cria o login (ou reaproveita, se o e-mail já existe e não é
        de cliente do portal);
     3. grava /usuarios/{uid} (é o que dá acesso ao painel);
     4. gera o link para a pessoa criar a própria senha e manda por
        e-mail (pelo SMTP de Conteúdo › E-mail); o link também volta
        para o painel, para mandar pelo WhatsApp se o e-mail falhar.
   Ninguém escolhe senha pela pessoa. Tudo fica em /auditoria.
   ============================================================ */
"use strict";

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const crypto = require("crypto");

const REGIAO = "southamerica-east1";
const PAINEL_PADRAO = "https://totalicontabilidade.github.io/portaldocliente/equipe.html";
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

exports.processarPedidoDeMembro = onDocumentCreated({ document: "pedidosDeMembro/{pedidoId}", region: REGIAO }, async (event) => {
  const snap = event.data; if (!snap) return;
  const p = snap.data() || {}, db = admin.firestore();
  const responder = (d) => snap.ref.set({ ...d, concluidoEm: admin.firestore.FieldValue.serverTimestamp(), expiraEm: new Date(Date.now() + 3600 * 1000) }, { merge: true });

  const quem = String(p.pedidoPor || "");
  const autor = quem ? await db.collection("usuarios").doc(quem).get() : null;
  if (!autor || !autor.exists || (autor.data() || {}).papel !== "admin") return responder({ erro: "Só um administrador pode colocar alguém na equipe." });

  const nome = String(p.nome || "").trim().slice(0, 80);
  const email = String(p.email || "").trim().toLowerCase().slice(0, 120);
  const papel = p.papel === "admin" ? "admin" : "equipe";
  const setor = String(p.setor || "").trim().slice(0, 60);
  const setores = (Array.isArray(p.setores) ? p.setores : []).filter((x) => typeof x === "string").map((x) => x.slice(0, 30)).slice(0, 10);
  if (!nome || !EMAIL_OK.test(email)) return responder({ erro: "Informe o nome e um e-mail válido." });

  try {
    let user = null, novo = false;
    try { user = await admin.auth().getUserByEmail(email); }
    catch (e) { if (!e || e.code !== "auth/user-not-found") throw e; }
    if (user) {
      /* um mesmo login não pode ser cliente e equipe: o portal e o painel se confundiriam */
      if ((await db.collection("clientes").doc(user.uid).get()).exists) return responder({ erro: "Este e-mail já é de um cliente do portal. Use outro e-mail para a equipe." });
    } else {
      user = await admin.auth().createUser({ email, displayName: nome, password: crypto.randomBytes(24).toString("base64url"), emailVerified: false });
      novo = true;
    }
    await db.collection("usuarios").doc(user.uid).set({ nome, email, papel, setor, setores, criadoEm: admin.firestore.FieldValue.serverTimestamp(), criadoPor: (autor.data() || {}).nome || quem }, { merge: true });

    /* link para a própria pessoa criar a senha (vale por pouco tempo, regra do Firebase) */
    const cfgSnap = await db.doc("configPrivada/email").get(), cfg = cfgSnap.exists ? (cfgSnap.data() || {}) : {};
    const painel = cfg.linkPortal ? String(cfg.linkPortal).replace(/[^/]*$/, "") + "equipe.html" : PAINEL_PADRAO;
    let link = "";
    try { link = await admin.auth().generatePasswordResetLink(email, { url: painel }); }
    catch (e) { link = await admin.auth().generatePasswordResetLink(email); }
    /* a página de criar a senha abre em português (o Firebase manda lang=en) */
    link = /[?&]lang=/.test(link) ? link.replace(/([?&])lang=[^&]*/, "$1lang=pt-BR") : link + "&lang=pt-BR";

    /* e-mail pelo mesmo caminho dos outros avisos (pedidosDeEmail, tipo "membro") */
    await db.collection("pedidosDeEmail").add({
      pedidoPor: quem, tipo: "membro", para: email, nome, link, novo,
      em: admin.firestore.FieldValue.serverTimestamp(), expiraEm: new Date(Date.now() + 3600 * 1000)
    });
    await db.collection("auditoria").add({ tipo: "equipe:adicionada", detalhe: nome + " <" + email + "> · " + papel + (novo ? " · login criado" : " · login já existia"), uid: user.uid, por: (autor.data() || {}).nome || quem, em: admin.firestore.FieldValue.serverTimestamp() });
    return responder({ erro: "", uid: user.uid, novo, link });
  } catch (e) {
    console.error("pedido de membro falhou", e && e.message);
    return responder({ erro: "Não foi possível criar o acesso agora. Tente de novo em instantes." });
  }
});
