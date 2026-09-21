/* ============================================================
   Totali · Portal do Cliente
   notificacoes.js — avisos no aparelho (trazido do Academy)

   Dois tipos: (1) aviso local, com o portal aberto ou em segundo
   plano, funcionando aqui; (2) push com o app fechado, que exige
   Firebase Cloud Messaging (ouvintes já estão no sw.js).
   Limite do iPhone: só com o portal instalado na tela de início.

   Só avisa quando a pessoa NÃO está olhando a tela em questão, e
   nunca avisa da própria ação. Som só para mensagem da equipe e
   prazo em 24 h (docs/00-pesquisa-engajamento.md). Sem propaganda.
   ============================================================ */
(function (global) {
  "use strict";
  var U = global.U, UI = global.UI, Dados = global.Dados;
  var ctx = null, parar = null, ultimo = "";
  function podeAvisar() { return "Notification" in global && Notification.permission === "granted" && UI.pref().avisos !== false; }
  function avisar(titulo, texto, url) {
    if (!podeAvisar()) return;
    try { var n = new Notification(titulo, { body: texto, icon: "assets/icon-192.png", badge: "assets/favicon-32.png", tag: "totali-" + (url || "x") }); n.onclick = function () { global.focus(); if (url) location.hash = url; n.close(); }; } catch (e) {}
  }
  var Notificacoes = {
    suportado: function () { return "Notification" in global; },
    permissao: function () { return "Notification" in global ? Notification.permission : "unsupported"; },
    pedir: function () { if (!("Notification" in global)) return Promise.resolve("unsupported"); return Notification.requestPermission().then(function (p) { if (p === "granted") avisar("Avisos ligados", "Você recebe um aviso quando a Totali responder.", "#/chat"); return p; }); },
    iniciar: function (o) {
      ctx = o; if (parar) parar();
      if (o.lado === "cliente" && o.empresaId) {
        parar = Dados.ouvirMensagens(o.empresaId, function (ms) {
          var novas = ms.filter(function (m) { return m.autor.lado === "equipe" && !(m.lidaPor || {})[o.uid]; });
          var ult = novas[novas.length - 1];
          if (ult && ult.id !== ultimo) { if (ultimo && (document.hidden || location.hash.indexOf("#/chat") !== 0)) avisar(ult.autor.nome + " · Totali", ult.texto || "📎 anexo", "#/chat"); ultimo = ult.id; }
          else if (!ultimo && ult) ultimo = ult.id;
        });
      }
      if (o.lado === "equipe") {
        var ultimoTotal = -1;
        var h = function () { Dados.todasConversas().then(function (cs) { var n = U.soma(cs, function (c) { return c.naoLidas; }); if (ultimoTotal >= 0 && n > ultimoTotal && (document.hidden || location.hash.indexOf("#/mensagens") !== 0)) { var c = cs.filter(function (x) { return x.naoLidas; })[0]; avisar("Mensagem de " + (c ? c.empresa : "cliente"), c && c.ultima ? c.ultima.texto : "", "#/mensagens" + (c ? "/" + c.empresaId : "")); } ultimoTotal = n; }); };
        document.addEventListener("dados:mudou", function (e) { if (e.detail && ["mensagem", "remoto"].indexOf(e.detail.tipo) > -1) h(); });
        h(); var t = setInterval(h, 20000); parar = function () { clearInterval(t); };
      }
    },
    parar: function () { if (parar) parar(); parar = null; }
  };
  global.Notificacoes = Notificacoes;
})(window);
