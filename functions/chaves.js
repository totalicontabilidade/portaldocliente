/* ============================================================
   Totali · Portal do Cliente
   functions/chaves.js — as chaves privadas do cofre

   A chave privada mora no Secret Manager (segredo
   `chave-privada-credenciais`). Desde 25/09/2026 ela pode ser
   TROCADA pelo painel (Segurança › Trocar a chave do cofre), e a
   troca cria uma versão nova do segredo. Por isso aqui não se lê só
   a "latest": lê as versões ATIVAS, da mais nova para a mais velha,
   e tenta cada uma. Assim nada fica ilegível no meio da troca
   (credencial ainda na chave velha, ou um cliente que guardou uma
   senha com a chave pública antiga aberta no navegador).

   Não é exportado por index.js: é peça, não função.
   ============================================================ */
"use strict";

const { abrirEnvelope } = require("./envelope");

const SEGREDO = "chave-privada-credenciais";
let cache = null;

function projeto() { return process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT; }
function cliente() {
  const { SecretManagerServiceClient } = require("@google-cloud/secret-manager");
  return new SecretManagerServiceClient();
}
function numero(nome) { return Number(String(nome).split("/").pop()) || 0; }

/* Lista das chaves privadas ativas (JWK), a mais nova primeiro. Fica em memória
   na instância; `forcar` busca de novo (depois de uma troca, ou se nenhuma abriu). */
async function chavesPrivadas(forcar) {
  if (cache && !forcar) return cache;
  const c = cliente(), pai = `projects/${projeto()}/secrets/${SEGREDO}`;
  let nomes;
  try {
    const [versoes] = await c.listSecretVersions({ parent: pai, filter: "state:ENABLED" });
    nomes = versoes.map((v) => v.name).sort((a, b) => numero(b) - numero(a)).slice(0, 5);
  } catch (e) {
    /* sem permissão para listar: fica só com a mais nova, como antes */
    nomes = [pai + "/versions/latest"];
  }
  const chaves = [];
  for (const nome of nomes) {
    const [v] = await c.accessSecretVersion({ name: nome });
    chaves.push(JSON.parse(v.payload.data.toString("utf8")));
  }
  cache = chaves;
  return chaves;
}

/* Abre um envelope com a primeira chave ativa que servir. */
async function abrir(pacote) {
  for (const forcar of [false, true]) {
    const chaves = await chavesPrivadas(forcar);
    for (const k of chaves) {
      try { return abrirEnvelope(pacote, k); } catch (e) { /* tenta a próxima */ }
    }
  }
  throw new Error("nenhuma chave ativa abre este envelope");
}

/* Guarda uma chave privada nova como versão mais recente do segredo. */
async function adicionarVersao(jwk) {
  const [v] = await cliente().addSecretVersion({
    parent: `projects/${projeto()}/secrets/${SEGREDO}`,
    payload: { data: Buffer.from(JSON.stringify(jwk), "utf8") }
  });
  cache = null;
  return v.name;
}

module.exports = { chavesPrivadas, abrir, adicionarVersao, SEGREDO };
