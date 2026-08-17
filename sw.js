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
var VERSAO = "v30";
var CACHE = "totali-onboarding-" + VERSAO;

var SHELL = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./lib/firebase-app-compat.js",
  "./lib/firebase-auth-compat.js",
  "./lib/firebase-firestore-compat.js",
  "./lib/firebase-storage-compat.js",
  "./js/firebase-config.js",
  "./js/firebase.js",
  "./js/chave-publica.js",
  "./js/cripto.js",
  "./js/util.js",
  "./js/conteudo.js",
  "./js/data.js",
  "./js/situacao.js",
  "./js/nuvem.js",
  "./js/store.js",
  "./js/ui.js",
  "./js/tour.js",
  "./js/motion.js",
  "./js/notificacoes.js",
  "./lib/jspdf.umd.min.js",
  "./js/termo.js",
  "./js/app.js",
  "./js/pwa.js",
  "./manifest.webmanifest",
  "./assets/totali-simbolo.png",
  "./assets/totali-portal-branca.png",
  "./assets/totali-portal-cor.png",
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

/* ============================================================
   Notificações

   O ouvinte de "push" só entra em ação quando o Firebase Cloud
   Messaging estiver ligado — é ele que entrega a mensagem com o
   aplicativo fechado. Até lá, quem dispara os avisos é o
   js/notificacoes.js, com o portal aberto ou em segundo plano.

   Nunca confiamos no conteúdo do push para montar HTML: os
   campos são usados apenas como texto da notificação.
   ============================================================ */
self.addEventListener("push", function (ev) {
  var dados = { titulo: "Totali", corpo: "", rota: "inicio", tag: "totali" };
  if (ev.data) {
    try {
      var recebido = ev.data.json();
      if (recebido && typeof recebido === "object") {
        if (typeof recebido.titulo === "string") dados.titulo = recebido.titulo.slice(0, 120);
        if (typeof recebido.corpo === "string") dados.corpo = recebido.corpo.slice(0, 300);
        if (typeof recebido.rota === "string") dados.rota = recebido.rota.slice(0, 40);
        if (typeof recebido.tag === "string") dados.tag = recebido.tag.slice(0, 40);
      }
    } catch (e) {
      dados.corpo = String(ev.data.text() || "").slice(0, 300);
    }
  }
  ev.waitUntil(
    self.registration.showNotification(dados.titulo, {
      body: dados.corpo,
      icon: "assets/icon-192.png",
      badge: "assets/icon-192.png",
      tag: dados.tag,
      renotify: true,
      lang: "pt-BR",
      data: { rota: dados.rota }
    })
  );
});

/* Tocar no aviso abre o portal já na tela certa — reaproveitando
   a aba aberta, se houver. */
self.addEventListener("notificationclick", function (ev) {
  ev.notification.close();
  var rota = (ev.notification.data && ev.notification.data.rota) || "inicio";
  var destino = new URL("./#/" + rota, self.location.href).href;

  ev.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (janelas) {
      for (var i = 0; i < janelas.length; i++) {
        var j = janelas[i];
        if (j.url.indexOf(self.registration.scope) === 0 && "focus" in j) {
          if ("navigate" in j) { return j.navigate(destino).then(function (c) { return c && c.focus(); }); }
          return j.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(destino);
      return null;
    })
  );
});
