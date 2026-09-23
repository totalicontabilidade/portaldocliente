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

   Projeto: portal-cliente-totali ("Portal do Cliente"), criado em
   23/09/2026, separado do Academy (totali-academy). Para voltar ao
   modo demo local, basta trocar os valores por "COLE_AQUI".
   ============================================================ */
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyBvldSKE8hMyA7JrZTUAHaMz4w7l5wLhW0",
  authDomain: "portal-cliente-totali.firebaseapp.com",
  projectId: "portal-cliente-totali",
  storageBucket: "portal-cliente-totali.firebasestorage.app",
  messagingSenderId: "96139869297",
  appId: "1:96139869297:web:e130b35ba5d1521542afd0"
};

/* App Check: chave do site reCAPTCHA v3 (ou Enterprise) criada no console do
   Firebase. Com ela, só o nosso site consegue falar com Firestore, Storage e
   Functions. Vazia = App Check desligado (aceitável só em desenvolvimento). */
window.APP_CHECK_SITE_KEY = "";
