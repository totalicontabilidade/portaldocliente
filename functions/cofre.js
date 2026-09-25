/* ============================================================
   Totali · Portal do Cliente
   functions/cofre.js — trocar a chave do cofre pelo painel

   Antes, trocar a chave exigia gerar o par no navegador, colar a
   pública em js/chave-publica.js (código) e subir a privada no
   Secret Manager à mão. Regra do Raoni: nada por código. Agora o
   administrador toca em "Trocar a chave do cofre" (Segurança) e
   esta função faz tudo, sem a chave privada sair do servidor:

     1. gera o par novo aqui (RSA-OAEP 3072, mesmo formato do
        navegador) e guarda a privada como versão nova do segredo;
     2. abre cada senha guardada com a chave antiga e fecha de novo
        com a nova (credenciais de todas as empresas e a senha do
        e-mail automático);
     3. publica a chave pública em publico/cofre, de onde o portal,
        o painel e as páginas de link passam a lê-la.

   A versão antiga do segredo continua ativa (chaves.js tenta todas):
   quem estava com o portal aberto e guardar uma senha com a chave
   velha não perde nada. Mesmo padrão das outras funções deste
   projeto: o painel grava um pedido e a função reage (onCall exige
   allUsers, proibido pela política da organização).
   ============================================================ */
"use strict";

const crypto = require("crypto");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { fecharPara } = require("./envelope");
const { abrir, adicionarVersao, chavesPrivadas } = require("./chaves");

const REGIAO = "southamerica-east1";

function impressao(n) {
  const h = crypto.createHash("sha256").update(String(n), "utf8").digest("hex").slice(0, 16).toUpperCase();
  return h.replace(/(.{4})/g, "$1 ").trim();
}

exports.trocarChaveCofre = onDocumentCreated(
  { document: "pedidosDeTrocaDeChave/{pedidoId}", region: REGIAO, timeoutSeconds: 540, memory: "512MiB" },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const pedido = snap.data() || {};
    const db = getFirestore();
    const responder = (dados) => snap.ref.set({ ...dados, atualizadoEm: FieldValue.serverTimestamp(), expiraEm: new Date(Date.now() + 24 * 3600 * 1000) }, { merge: true });

    /* Só administrador. A regra já exige, mas isto troca a chave de todas as senhas. */
    const quem = String(pedido.pedidoPor || "");
    const autor = quem ? await db.collection("usuarios").doc(quem).get() : null;
    if (!autor || !autor.exists || (autor.data() || {}).papel !== "admin") {
      return responder({ erro: "só administrador troca a chave do cofre", concluidoEm: FieldValue.serverTimestamp() });
    }
    const nomeAutor = (autor.data() || {}).nome || (autor.data() || {}).email || quem;

    try {
      /* 1. par novo, gerado aqui; a privada nunca vai para o navegador */
      await responder({ etapa: "gerando a chave nova" });
      const par = crypto.generateKeyPairSync("rsa", { modulusLength: 3072, publicExponent: 0x10001 });
      const priv = Object.assign(par.privateKey.export({ format: "jwk" }), { alg: "RSA-OAEP-256", ext: true, key_ops: ["decrypt"] });
      const pj = par.publicKey.export({ format: "jwk" });
      const pub = { kty: pj.kty, n: pj.n, e: pj.e, alg: "RSA-OAEP-256", ext: true, key_ops: ["encrypt"] };
      await chavesPrivadas(true); /* garante que a antiga está carregada antes de virar "velha" */
      await adicionarVersao(priv);

      /* 2. recifra tudo o que está guardado */
      await responder({ etapa: "recifrando as senhas guardadas" });
      const creds = await db.collectionGroup("credenciais").get();
      let recifradas = 0, falhas = 0, lote = db.batch(), noLote = 0;
      for (const d of creds.docs) {
        const pacote = (d.data() || {}).pacote;
        if (!pacote || !pacote.dados) continue;
        try {
          const conteudo = await abrir(pacote);
          lote.update(d.ref, { pacote: fecharPara(conteudo, pub), recifradaEm: FieldValue.serverTimestamp() });
          recifradas++; noLote++;
          if (noLote >= 400) { await lote.commit(); lote = db.batch(); noLote = 0; }
        } catch (e) {
          falhas++;
          console.error("credencial que nenhuma chave abre", d.ref.path, e && e.message);
        }
      }
      const email = await db.doc("configPrivada/email").get();
      if (email.exists && (email.data() || {}).pacote) {
        try { lote.update(email.ref, { pacote: fecharPara(await abrir(email.data().pacote), pub) }); noLote++; } catch (e) { falhas++; }
      }
      if (noLote) await lote.commit();

      /* 3. publica a pública: portal, painel e páginas de link leem daqui */
      const fp = impressao(pub.n);
      await db.doc("publico/cofre").set({ chavePublica: pub, impressao: fp, trocadaEm: FieldValue.serverTimestamp(), por: nomeAutor });
      await responder({ etapa: "pronto", concluidoEm: FieldValue.serverTimestamp(), recifradas, falhas, impressao: fp, erro: "" });
      await db.collection("auditoria").add({ tipo: "cofre:chave-trocada", por: nomeAutor, uid: quem, detalhe: recifradas + (recifradas === 1 ? " senha recifrada" : " senhas recifradas") + (falhas ? ", " + falhas + " com falha" : ""), em: FieldValue.serverTimestamp() });
    } catch (e) {
      console.error("falha ao trocar a chave do cofre", e && e.message);
      await responder({ erro: "não foi possível trocar a chave: " + (e && e.message || "erro"), concluidoEm: FieldValue.serverTimestamp() });
    }
  }
);
