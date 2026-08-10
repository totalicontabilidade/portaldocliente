/* ============================================================
   Totali · Portal de Onboarding
   chave-publica.js — chave pública da Totali

   É com esta chave que o portal TRANCA as senhas enviadas pelo
   cliente. Ela é pública de propósito: publicar não é problema,
   porque com ela só dá para trancar, nunca para abrir.

   COMO PREENCHER
   --------------
   1. Abra equipe.html e clique em "Gerar par de chaves".
   2. Baixe o arquivo da chave PRIVADA e guarde em lugar seguro
      (cofre de senhas + uma cópia offline). Ela nunca entra
      neste repositório nem em nenhum servidor.
   3. Copie o bloco da chave PÚBLICA e cole abaixo, no lugar do
      null.

   ENQUANTO ESTIVER null, o portal não aceita senha nenhuma —
   ele avisa o cliente que o canal seguro não está pronto, em
   vez de guardar a senha às claras.

   Trocar a chave depois NÃO reabre o que já foi enviado: o que
   está guardado só abre com a chave privada correspondente.
   Guarde as chaves antigas enquanto houver dado cifrado com elas.
   ============================================================ */
window.CHAVE_PUBLICA = null;

/* Exemplo do formato esperado:

window.CHAVE_PUBLICA = {
  "kty": "RSA",
  "n": "vX3...",
  "e": "AQAB",
  "alg": "RSA-OAEP-256",
  "ext": true,
  "key_ops": ["encrypt"]
};

*/
