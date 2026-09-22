/* ============================================================
   Totali · Portal do Cliente
   sw.js — service worker (shell offline)

   Navegação (HTML): rede primeiro, cache como reserva.
   Demais recursos da própria origem: cache primeiro, atualizando
   por baixo. Nada de terceiros no cache. Suba a VERSAO a cada
   publicação.
   ============================================================ */
var VERSAO = "v1";
var CACHE = "totali-portal-" + VERSAO;
var SHELL = ["./", "./index.html", "./equipe.html", "./anterior.html", "./extratos.html", "./css/tokens.css", "./css/app.css", "./assets/fonts/manrope-variable.woff2",
  "./js/tema.js", "./js/util.js", "./js/icones.js", "./js/ui.js", "./js/seguranca.js", "./js/cripto.js", "./js/catalogo.js", "./js/jornada.js", "./js/dados.js", "./js/uso.js", "./js/chat.js", "./js/shell.js", "./js/tour.js", "./js/notificacoes.js", "./js/pdf.js", "./js/onboarding.js", "./js/financeiro.js", "./js/extratos.js", "./js/agenda.js", "./js/relacionamento.js", "./js/video.js", "./js/conteudo-extra.js", "./js/app.js", "./js/painel.js", "./js/anterior.js", "./js/pwa.js", "./js/firebase-config.js", "./js/chave-publica.js",
  "./lib/firebase-app-compat.js", "./lib/firebase-app-check-compat.js", "./lib/firebase-auth-compat.js", "./lib/firebase-firestore-compat.js", "./lib/firebase-storage-compat.js",
  "./assets/brand/calc-menu.svg", "./assets/brand/calc-login.svg", "./assets/brand/calc-piece.svg", "./assets/totali-contabil-branca.png", "./assets/totali-portal-cor.png", "./assets/totali-simbolo.png", "./assets/icon-192.png", "./assets/favicon-32.png", "./manifest.webmanifest"];

self.addEventListener("install", function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener("activate", function (e) { e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); })); });
self.addEventListener("fetch", function (e) {
  var req = e.request; if (req.method !== "GET") return;
  var url = new URL(req.url); if (url.origin !== location.origin) return;
  if (req.mode === "navigate") { e.respondWith(fetch(req).then(function (r) { var c = r.clone(); caches.open(CACHE).then(function (ca) { ca.put(req, c); }); return r; }).catch(function () { return caches.match(req).then(function (r) { return r || caches.match("./index.html"); }); })); return; }
  e.respondWith(caches.match(req).then(function (hit) {
    var rede = fetch(req).then(function (r) { if (r && r.status === 200) { var c = r.clone(); caches.open(CACHE).then(function (ca) { ca.put(req, c); }); } return r; }).catch(function () { return hit; });
    return hit || rede;
  }));
});
self.addEventListener("push", function (e) {
  var d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) {}
  e.waitUntil(self.registration.showNotification(d.titulo || "Totali", { body: d.texto || "Você tem uma novidade no portal.", icon: "./assets/icon-192.png", badge: "./assets/favicon-32.png", data: { url: d.url || "./#/inicio" } }));
});
self.addEventListener("notificationclick", function (e) { e.notification.close(); e.waitUntil(self.clients.openWindow(e.notification.data && e.notification.data.url || "./")); });
