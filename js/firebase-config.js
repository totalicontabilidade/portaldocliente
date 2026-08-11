/* ============================================================
   Totali · Portal de Onboarding
   firebase-config.js — endereço do projeto no Firebase

   Estas chaves são PÚBLICAS por natureza. Elas só dizem "qual
   projeto" — não dão permissão nenhuma. Quem decide o que cada
   um pode ler e escrever são as regras do Firestore e do
   Storage. Por isso este arquivo pode ficar no repositório sem
   problema.

   O que NUNCA pode entrar aqui: chave de conta de serviço
   (aquela que começa com "-----BEGIN PRIVATE KEY"), token do
   Admin SDK, ou a chave privada da criptografia das senhas.
   ============================================================ */
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyAe3WcxKguZNLmA5J84SVY0XB1L6DQDXTM",
  authDomain: "portaldocliente-8cc7d.firebaseapp.com",
  projectId: "portaldocliente-8cc7d",
  storageBucket: "portaldocliente-8cc7d.firebasestorage.app",
  messagingSenderId: "114944286344",
  appId: "1:114944286344:web:90f35c18663b6e5eb0c93d"
};

/* Analytics foi deixado de fora de propósito: ele instala
   rastreamento de terceiros no portal do cliente, o que pede
   aviso de cookies e conversa com a LGPD sem trazer nada que a
   gente precise. Se um dia quiser medir uso, dá para contar o
   que interessa no próprio Firestore, sem rastrear ninguém. */
