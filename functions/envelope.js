/* ============================================================
   Totali · Portal de Onboarding
   functions/envelope.js — abrir e fechar o envelope das senhas

   Vive separado de senhas.js por um motivo prático: aqui não há
   Firebase nenhum, então dá para testar de verdade, rodando as
   duas pontas contra o mesmo dado. E era preciso — este é o
   ponto onde um erro de formato não aparece em teste de tela:
   passa batido até alguém clicar em "ver senha" e não ver nada.

   O formato é o que js/cripto.js monta no navegador:
     RSA-OAEP-256 tranca uma chave AES-256-GCM, que tranca o
     conteúdo. No WebCrypto a etiqueta de autenticação vem colada
     no fim do texto cifrado; no Node, separada. É essa diferença
     que os dois lados precisam respeitar.

   NÃO é exportado por index.js de propósito: o Firebase publica
   tudo o que sai de lá, e isto não é uma função, é uma peça.
   ============================================================ */
"use strict";

const crypto = require("crypto");

function b64(v) { return Buffer.from(v, "base64"); }

/* Abre o envelope da Totali: RSA-OAEP solta a chave AES, e a
   AES-GCM solta o conteúdo. Mesmo formato que o navegador do
   cliente montou (js/cripto.js). */
function abrirEnvelope(pacote, jwk) {
  const chaveRSA = crypto.createPrivateKey({ key: jwk, format: "jwk" });
  const chaveAES = crypto.privateDecrypt(
    { key: chaveRSA, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
    b64(pacote.chave)
  );

  const dados = b64(pacote.dados);
  /* No AES-GCM do WebCrypto a etiqueta de autenticação vem colada
     no fim do texto cifrado; o Node espera as duas separadas. */
  const etiqueta = dados.subarray(dados.length - 16);
  const corpo = dados.subarray(0, dados.length - 16);

  const d = crypto.createDecipheriv("aes-256-gcm", chaveAES, b64(pacote.iv));
  d.setAuthTag(etiqueta);
  return JSON.parse(Buffer.concat([d.update(corpo), d.final()]).toString("utf8"));
}

/* Fecha de novo, agora para a chave descartável daquela aba.
   Monta exatamente o formato que js/cripto.js sabe abrir. */
function fecharPara(conteudo, jwkPublica) {
  const pub = crypto.createPublicKey({ key: jwkPublica, format: "jwk" });
  const chaveAES = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);

  const c = crypto.createCipheriv("aes-256-gcm", chaveAES, iv);
  const corpo = Buffer.concat([
    c.update(Buffer.from(JSON.stringify(conteudo), "utf8")),
    c.final()
  ]);

  const chaveTrancada = crypto.publicEncrypt(
    { key: pub, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
    chaveAES
  );

  return {
    v: 1,
    alg: "RSA-OAEP-256+AES-GCM-256",
    iv: iv.toString("base64"),
    chave: chaveTrancada.toString("base64"),
    /* Corpo e etiqueta juntos, como o WebCrypto espera. */
    dados: Buffer.concat([corpo, c.getAuthTag()]).toString("base64"),
    em: Date.now()
  };
}

module.exports = { abrirEnvelope, fecharPara };
