/* ============================================================
   Totali · Portal do Cliente
   tema.js — claro, escuro ou sistema (mesma regra do Agência 100K)

   Carregado ANTES do CSS pintar, sem defer, para não piscar. Lê a
   preferência do localStorage; "sistema" segue prefers-color-scheme.
   O modo claro é o padrão (pesquisa de ergonomia do Agência 100K).
   ============================================================ */
(function (global) {
  "use strict";
  var CHAVE = "totali-portal-tema";
  var OPCOES = ["claro", "escuro", "sistema"];
  var mq = global.matchMedia ? global.matchMedia("(prefers-color-scheme: dark)") : null;

  function ler() {
    try { var v = localStorage.getItem(CHAVE); return OPCOES.indexOf(v) > -1 ? v : "sistema"; } catch (e) { return "sistema"; }
  }
  function escuro(t) { return t === "escuro" || (t === "sistema" && mq && mq.matches); }
  function aplicar(t) {
    var d = escuro(t);
    document.documentElement.classList.toggle("dark", d);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", d ? "#0b1220" : "#182c43");
  }
  var Tema = {
    OPCOES: OPCOES,
    atual: ler,
    escuro: function () { return escuro(ler()); },
    definir: function (t) {
      if (OPCOES.indexOf(t) === -1) t = "sistema";
      try { localStorage.setItem(CHAVE, t); } catch (e) {}
      aplicar(t);
      document.dispatchEvent(new CustomEvent("tema:mudou", { detail: { tema: t, escuro: escuro(t) } }));
    },
    alternar: function () { Tema.definir(Tema.escuro() ? "claro" : "escuro"); }
  };
  aplicar(ler());
  if (mq && mq.addEventListener) mq.addEventListener("change", function () { if (ler() === "sistema") aplicar("sistema"); });
  global.Tema = Tema;
})(window);
