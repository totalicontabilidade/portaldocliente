/* ============================================================
   Totali · Portal de Onboarding
   pwa.js — instalação, service worker e proteções de contexto
   ============================================================ */
(function (global) {
  "use strict";

  /* ---------- 1. Proteção contra enquadramento (clickjacking) ----------
     O GitHub Pages não permite enviar cabeçalhos HTTP, então não dá
     para usar frame-ancestors nem X-Frame-Options. Esta verificação
     em JavaScript é a defesa possível: se a página for carregada
     dentro de um iframe de outro site, o conteúdo é bloqueado.
  --------------------------------------------------------------------- */
  try {
    if (global.top !== global.self) {
      document.documentElement.innerHTML =
        '<body style="margin:0;font-family:system-ui,sans-serif;background:#0e1f30;color:#fff;' +
        'display:grid;place-items:center;height:100vh;text-align:center;padding:24px">' +
        '<div><p style="font-size:16px;font-weight:600;margin:0 0 8px">Página bloqueada</p>' +
        '<p style="font-size:14px;opacity:.8;margin:0">Por segurança, o Portal do Cliente da Totali ' +
        'não pode ser exibido dentro de outro site.</p></div></body>';
      try { global.top.location = global.self.location.href; } catch (e) { /* origem cruzada */ }
      return;
    }
  } catch (e) {
    /* Acessar global.top já lança erro em origem cruzada: também é iframe. */
  }

  /* ---------- 2. Aviso de conexão insegura ---------- */
  var seguro = location.protocol === "https:" ||
               location.hostname === "localhost" ||
               location.hostname === "127.0.0.1" ||
               location.protocol === "file:";
  if (!seguro) {
    global.addEventListener("load", function () {
      if (global.UI) {
        global.UI.toast("Esta conexão não é segura. Acesse o portal pelo endereço com https.", "erro", 12000);
      }
    });
  }

  /* ---------- 3. Botão instalar ---------- */
  var promptDiferido = null;
  var btn = document.getElementById("btnInstalar");

  global.addEventListener("beforeinstallprompt", function (ev) {
    ev.preventDefault();
    promptDiferido = ev;
    if (btn) btn.hidden = false;
  });

  if (btn) {
    btn.addEventListener("click", function () {
      if (!promptDiferido) return;
      promptDiferido.prompt();
      promptDiferido.userChoice.then(function (r) {
        if (r && r.outcome === "accepted" && global.UI) {
          global.UI.toast("Portal instalado. Procure o ícone da Totali na sua tela inicial.", "ok");
        }
        promptDiferido = null;
        btn.hidden = true;
      });
    });
  }

  global.addEventListener("appinstalled", function () {
    promptDiferido = null;
    if (btn) btn.hidden = true;
  });

  /* ---------- 4. Service worker ---------- */
  if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
    global.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").then(function (reg) {
        reg.addEventListener("updatefound", function () {
          var novo = reg.installing;
          if (!novo) return;
          novo.addEventListener("statechange", function () {
            if (novo.state === "installed" && navigator.serviceWorker.controller && global.UI) {
              global.UI.toast("Há uma versão nova do portal. Feche e abra novamente para atualizar.", "info", 9000);
            }
          });
        });
      }).catch(function () { /* sem service worker o portal continua funcionando */ });
    });
  }
})(window);
