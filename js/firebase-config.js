/* ============================================================
   Totali · Portal do Cliente
   firebase-config.js — o endereço do projeto no Firebase

   Enquanto estiver com "COLE_", o portal roda em MODO LOCAL (demo):
   tudo fica no navegador, com dados de exemplo, e nada vai para
   servidor nenhum. É assim que a tela pode ser vista e avaliada
   antes de o projeto existir.

   Para ligar: crie o projeto no console do Firebase (região
   southamerica-east1), ative Authentication (e-mail/senha),
   Firestore e Storage, e cole aqui a configuração web. A apiKey
   não é senha: é o endereço do projeto. Quem protege o banco são
   as regras (firestore.rules e storage.rules).

   Sugestão: reaproveitar o projeto do Academy (portaldocliente-8cc7d)
   para o cliente ter UM login só nos dois sistemas e a chave pública
   de senhas ser a mesma. Ver docs/01-arquitetura.md, seção Firebase.
   ============================================================ */
window.FIREBASE_CONFIG = {
  apiKey: "COLE_AQUI",
  authDomain: "COLE_AQUI.firebaseapp.com",
  projectId: "COLE_AQUI",
  storageBucket: "COLE_AQUI.firebasestorage.app",
  messagingSenderId: "COLE_AQUI",
  appId: "COLE_AQUI"
};

/* App Check: chave do site reCAPTCHA v3 (ou Enterprise) criada no console do
   Firebase. Com ela, só o nosso site consegue falar com Firestore, Storage e
   Functions. Vazia = App Check desligado (aceitável só em desenvolvimento). */
window.APP_CHECK_SITE_KEY = "";
