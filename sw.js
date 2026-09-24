/* ============================================================
   Totali · Portal do Cliente
   sw.js — service worker (shell offline)

   HTML, JS e CSS da própria origem: REDE PRIMEIRO, cache só como
   reserva (offline). Foi a lição do GitHub Pages em 23/09/2026: com
   cache primeiro, quem já tinha o portal aberto ficava com código
   velho por vários acessos, misturando arquivos de versões diferentes
   (tela do convite carregando para sempre, logo esticada).
   Fontes, imagens e as bibliotecas do Firebase (lib/): cache primeiro,
   porque não mudam entre publicações. Nada de terceiros no cache.
   A VERSAO só serve para limpar a reserva antiga; suba quando quiser.
   ============================================================ */
var VERSAO = "2026-09-24d";
var CACHE = "totali-portal-" + VERSAO;
var SHELL = ["./", "./index.html", "./equipe.html", "./anterior.html", "./extratos.html", "./css/tokens.css", "./css/app.css", "./assets/fonts/manrope-variable.woff2",
  "./js/tema.js", "./js/util.js", "./js/icones.js", "./js/ui.js", "./js/seguranca.js", "./js/cripto.js", "./js/catalogo.js", "./js/jornada.js", "./js/dados.js", "./js/uso.js", "./js/chat.js", "./js/shell.js", "./js/tour.js", "./js/notificacoes.js", "./js/pdf.js", "./js/onboarding.js", "./js/financeiro.js", "./js/extratos.js", "./js/agenda.js", "./js/relacionamento.js", "./js/video.js", "./js/conteudo-extra.js", "./js/app.js", "./js/painel.js", "./js/anterior.js", "./js/pwa.js", "./js/firebase-config.js", "./js/chave-publica.js",
  "./lib/firebase-app-compat.js", "./lib/firebase-app-check-compat.js", "./lib/firebase-auth-compat.js", "./lib/firebase-firestore-compat.js", "./lib/firebase-storage-compat.js",
  "./assets/brand/puzzle-menu.svg", "./assets/brand/puzzle-login.svg", "./assets/brand/piece.svg", "./assets/brand/logo-escuro.png", "./assets/brand/logo-claro.png", "./assets/brand/simbolo.png", "./assets/icon-192.png", "./assets/favicon-32.png", "./manifest.webmanifest"];

self.addEventListener("install", function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener("activate", function (e) { e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); })); });
self.addEventListener("fetch", function (e) {
  var req = e.request; if (req.method !== "GET") return;
  var url = new URL(req.url); if (url.origin !== location.origin) return;
  var guardar = function (r) { if (r && r.status === 200 && r.type === "basic") { var c = r.clone(); caches.open(CACHE).then(function (ca) { ca.put(req, c); }); } return r; };
  var codigo = req.mode === "navigate" || /\.(html|js|css|webmanifest|json)$/.test(url.pathname) || /\/$/.test(url.pathname);
  if (codigo) {
    /* rede primeiro: o que está publicado é o que vale; cache só se a rede falhar */
    e.respondWith(fetch(req, { cache: "no-cache" }).then(guardar).catch(function () { return caches.match(req).then(function (hit) { return hit || (req.mode === "navigate" ? caches.match("./index.html") : Response.error()); }); }));
    return;
  }
  /* imagens, fontes e lib/: cache primeiro, atualizando por baixo */
  e.respondWith(caches.match(req).then(function (hit) {
    var rede = fetch(req).then(guardar).catch(function () { return hit; });
    return hit || rede;
  }));
});
self.addEventListener("push", function (e) {
  var d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) {}
  e.waitUntil(self.registration.showNotification(d.titulo || "Totali", { body: d.texto || "Você tem uma novidade no portal.", icon: "./assets/icon-192.png", badge: "./assets/favicon-32.png", data: { url: d.url || "./#/inicio" } }));
});
self.addEventListener("notificationclick", function (e) { e.notification.close(); e.waitUntil(self.clients.openWindow(e.notification.data && e.notification.data.url || "./")); });
