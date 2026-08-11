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
window.CHAVE_PUBLICA = {
  "alg": "RSA-OAEP-256",
  "e": "AQAB",
  "ext": true,
  "key_ops": [
    "encrypt"
  ],
  "kty": "RSA",
  "n": "s2g9h268y_rtSsPd5P9-CQUqYTdGUKLJ6LcFVIXQonoi1nHAgnjm7IBETl8B72cH3s0lFUSRxcz3ppZK9-MwOLFwYqVyG-zwWJcWZSLqxCkdb1ADS1tCoZ9Fmpo3eLUonj2yMZbA5RdbPlHHlRRypmRD62aF81vbXvAJ_XyWYBQ3RqOwddlkSw-3R-E9Gha9mXVXnxu8a0XRA5sa_xgimyxRZWF4GOuzeidZijhk54L8qyH7KscOGztde40zcUxDx6BpoN01QIp4SW0cCcTmkv3H7HRvgOwDtnHoc7qKQ2OLICJp82ArgXEzyBc2K1TauLfEA40lZ0waJfMYeDBQd2ZFyKhMeRm9bvtDO70h9kFTnoYXTFQ0hwdYZaR8-a4rnqVnNfOleQoD0uvShvxUpDJF4nZPViFqaq7MwvzH5a_hijf_ifk_OUFckqZ3iPnaXPuaM3dIKF_CKiTkaRqFDrxbOCUH6elyfE7bGSfsG1yZbJNydlS2B_cbZf0KelMX"
};

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
