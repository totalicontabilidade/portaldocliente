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

/* ============================================================
   App Check — chave do site do reCAPTCHA v3

   Também é pública, e tem que ser: o navegador precisa dela para
   pedir o token ao Google. Quem valida é a chave SECRETA, que
   fica só no console do Firebase e nunca sai de lá.

   O que o App Check resolve: as chaves acima estão no código-
   fonte da página, como em qualquer aplicativo web. Sem App
   Check, alguém pode copiá-las e falar com o Firebase por fora
   do portal. As regras continuam impedindo que essa pessoa LEIA
   documento de cliente — mas não impedem que ela gaste a nossa
   cota criando contas ou lendo /conteudo em laço.

   O CUSTO, e ele é real: o reCAPTCHA carrega script do Google, e
   por isso a CSP das duas páginas deixou de ser "só a própria
   origem". Está limitada aos dois domínios exatos que o
   reCAPTCHA usa.

   Deixe vazio para desligar o App Check.
   ============================================================ */
window.APP_CHECK_SITE_KEY = "6Lfr7Y0tAAAAAGZOc7qAwmJ_1UuzJod12Oias56W";

/* Analytics foi deixado de fora de propósito: ele instala
   rastreamento de terceiros no portal do cliente, o que pede
   aviso de cookies e conversa com a LGPD sem trazer nada que a
   gente precise. Se um dia quiser medir uso, dá para contar o
   que interessa no próprio Firestore, sem rastrear ninguém. */
