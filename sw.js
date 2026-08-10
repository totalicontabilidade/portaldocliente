/* ============================================================
   Totali · Portal de Onboarding
   sw.js — service worker (funcionamento offline)

   Estratégia:
     • Navegação (HTML)  → rede primeiro, cache como reserva.
       Garante que o cliente sempre veja a versão mais recente
       quando estiver online.
     • Demais recursos   → cache primeiro, atualizando em segundo
       plano. Deixa o portal instantâneo depois da primeira visita.

   Segurança:
     • Só entram no cache respostas da MESMA origem, com status 200
       e método GET. Nada de terceiros, nada de resposta opaca.

   Ao alterar qualquer arquivo do app, suba o número da versão —
   é o que faz o navegador do cliente buscar o conteúdo novo.
   ============================================================ */
var VERSAO = "v2";
var CACHE = "totali-onboarding-" + VERSAO;

var SHELL = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/util.js",
  "./js/data.js",
  "./js/store.js",
  "./js/ui.js",
  "./js/motion.js",
  "./js/app.js",
  "./js/pwa.js",
  "./manifest.webmanifest",
  "./assets/totali-logo-branca.png",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/favicon-32.png",
  "./assets/apple-touch-icon.png"
];

self.addEventListener("install", function (ev) {
  ev.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(SHELL.map(function (u) {
        return c.add(new Request(u, { cache: "reload" })).catch(function () { /* segue sem travar */ });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (ev) {
  ev.waitUntil(
    caches.keys().then(function (nomes) {
      return Promise.all(nomes.map(function (n) {
        if (n !== CACHE && n.indexOf("totali-onboarding-") === 0) return caches.delete(n);
        return null;
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

function mesmaOrigem(req) {
  try { return new URL(req.url).origin === self.location.origin; }
  catch (e) { return false; }
}

function guardavel(resp) {
  return resp && resp.status === 200 && resp.type === "basic";
}

self.addEventListener("fetch", function (ev) {
  var req = ev.request;

  if (req.method !== "GET" || !mesmaOrigem(req)) return;

  /* Navegação: rede primeiro. */
  if (req.mode === "navigate") {
    ev.respondWith(
      fetch(req).then(function (resp) {
        if (guardavel(resp)) {
          var copia = resp.clone();
          caches.open(CACHE).then(function (c) { c.put("./index.html", copia); });
        }
        return resp;
      }).catch(function () {
        return caches.match("./index.html").then(function (r) {
          return r || caches.match("./");
        });
      })
    );
    return;
  }

  /* Demais recursos: cache primeiro, revalidando em segundo plano. */
  ev.respondWith(
    caches.match(req).then(function (cacheado) {
      var busca = fetch(req).then(function (resp) {
        if (guardavel(resp)) {
          var copia = resp.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copia); });
        }
        return resp;
      }).catch(function () { return cacheado; });
      return cacheado || busca;
    })
  );
});
