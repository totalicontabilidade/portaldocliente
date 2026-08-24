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

  /* ---------- 4. Service worker ----------

     QUANDO ATUALIZAR SOZINHO, E QUANDO PERGUNTAR

     A versão nova instalava e ESPERAVA sempre, e isso existia por
     um bom motivo: trocar o service worker no meio de um envio
     mata o envio. Foi um problema real relatado aqui.

     Só que a espera valia também para quem tinha ACABADO de abrir
     a página e não estava fazendo nada — e aí o aviso vira um
     pedido sem sentido: a pessoa abriu agora, não há o que
     interromper. Era a reclamação do Raoni.

     A regra passa a ser esta: se ninguém tocou na tela desde que a
     página abriu, não há trabalho para proteger, e a versão nova
     assume na hora. Bastou um toque, um clique ou uma tecla — pode
     haver algo em andamento — e volta a perguntar.

     O sinal é grosseiro de propósito. Errar para o lado de
     perguntar custa um aviso; errar para o outro custa o documento
     que o cliente estava mandando. */
  var mexeu = false;
  ["pointerdown", "keydown", "touchstart"].forEach(function (ev) {
    global.addEventListener(ev, function () { mexeu = true; }, { once: true, passive: true });
  });

  if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
    global.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").then(function (reg) {

        /* Já havia uma versão nova esperando de uma visita
           anterior. Este é o caso mais comum do "abri e ele me
           pediu para atualizar": a página acabou de carregar, e
           não existe nada em andamento para proteger. */
        if (reg.waiting && navigator.serviceWorker.controller && !mexeu) {
          reg.waiting.postMessage("assumir-agora");
        }
        /* Procura versão nova sempre que a pessoa volta ao portal.
           Sem isso, o navegador só verifica de tempos em tempos e
           uma correção pode demorar horas para chegar. */
        var conferir = function () {
          if (document.visibilityState === "visible") reg.update().catch(function () {});
        };
        document.addEventListener("visibilitychange", conferir);

        /* Recarrega UMA vez, quando o service worker novo assume.
           Sem esta trava, o navegador pode disparar o evento mais
           de uma vez e a página entraria em laço de recarga. */
        var recarregando = false;
        navigator.serviceWorker.addEventListener("controllerchange", function () {
          if (recarregando) return;
          recarregando = true;
          location.reload();
        });

        reg.addEventListener("updatefound", function () {
          var novo = reg.installing;
          if (!novo) return;
          novo.addEventListener("statechange", function () {
            /* Só avisa quando JÁ existia uma versão rodando —
               na primeira visita não há o que atualizar. */
            if (novo.state !== "installed" || !navigator.serviceWorker.controller) return;

            /* Ninguém tocou na tela desde que a página abriu: não
               há envio, digitação nem leitura para interromper.
               Assume calado — a pessoa nem percebe. */
            if (!mexeu) {
              if (reg.waiting) reg.waiting.postMessage("assumir-agora");
              return;
            }

            if (!global.UI) return;

            /* Daqui para baixo, alguém está usando o portal. A
               versão nova fica ESPERANDO e quem decide a hora é a
               pessoa, tocando no aviso. É o que garante que uma
               publicação nossa não interrompa um envio em
               andamento do outro lado. */
            global.UI.toast("Nova versão do portal pronta. Toque aqui quando quiser atualizar — " +
                            "nada do que você está fazendo se perde.", "ok", 30000);
            var avisos = document.querySelectorAll("#toasts .toast");
            var ultimo = avisos[avisos.length - 1];
            if (ultimo) {
              ultimo.style.cursor = "pointer";
              ultimo.addEventListener("click", function () {
                if (reg.waiting) reg.waiting.postMessage("assumir-agora");
                else location.reload();
              });
            }
          });
        });
      }).catch(function () { /* sem service worker o portal continua funcionando */ });
    });
  }
})(window);
