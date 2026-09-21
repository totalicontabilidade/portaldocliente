/* ============================================================
   Totali · Portal do Cliente
   chave-publica.js — a chave PÚBLICA da Totali para o cofre de senhas

   Com ela o portal TRANCA; só a chave privada (Secret Manager,
   segredo `chave-privada-credenciais`) ABRE. Cole aqui o JWK
   público gerado no painel (Segurança › Gerar par de chaves) — ou
   o mesmo do Academy, se o projeto Firebase for compartilhado.

   Enquanto for null, o cofre avisa que o canal seguro não está
   configurado e não deixa guardar senha.
   ============================================================ */
window.CHAVE_PUBLICA = null;
