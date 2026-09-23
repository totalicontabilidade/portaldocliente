/* ============================================================
   Totali · Portal do Cliente
   pwa.js — instalação e service worker

   Registra o sw.js (offline do shell) e guarda o evento de
   instalação para oferecer "Adicionar à tela inicial" no Perfil.
   No iPhone a instalação é manual (Compartilhar › Tela de Início)
   e só com o app instalado há notificação (iOS 16.4+).
   ============================================================ */
(function (global) {
  "use strict";
  if (!("serviceWorker" in navigator)) return;
  /* Só em produção (https). Em localhost o cache do service worker esconde
     as alterações de código; para testar o offline localmente use ?sw=1. */
  if (location.protocol !== "https:" && location.search.indexOf("sw=1") === -1) {
    navigator.serviceWorker.getRegistrations().then(function (rs) { rs.forEach(function (r) { r.unregister(); }); });
    return;
  }
  /* Quando um service worker novo assume, recarrega uma vez: assim ninguém fica com código velho depois de uma publicação. */
  var recarregou = false;
  navigator.serviceWorker.addEventListener("controllerchange", function () { if (recarregou) return; recarregou = true; if (navigator.serviceWorker.controller) location.reload(); });
  global.addEventListener("load", function () {
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then(function (reg) {
      reg.addEventListener("updatefound", function () {
        var nw = reg.installing; if (!nw) return;
        nw.addEventListener("statechange", function () { if (nw.state === "installed" && navigator.serviceWorker.controller && global.UI) global.UI.toast("Nova versão disponível. Feche e abra o portal para atualizar.", "info", null, 6000); });
      });
    }).catch(function (e) { console.warn("sw", e); });
  });
  global.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); global.__instalar = e; });
})(window);
