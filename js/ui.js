/* ============================================================
   Totali · Portal do Cliente
   ui.js — toasts, modais, celebração, háptica, pequenos widgets

   Regras (docs/00-pesquisa-engajamento.md):
     • celebração só em marco, curta, nunca esconde conteúdo;
     • háptica e som só em confirmações do que o cliente já fez,
       nunca em propaganda; ambos desligáveis em Perfil.
   ============================================================ */
(function (global) {
  "use strict";
  var U = global.U, ic = global.ic;
  var PREF = "totali-portal-pref";

  function pref() { try { return JSON.parse(localStorage.getItem(PREF) || "{}") || {}; } catch (e) { return {}; } }
  function salvarPref(p) { try { localStorage.setItem(PREF, JSON.stringify(p)); } catch (e) {} }

  var UI = {
    $: function (sel, raiz) { return (raiz || document).querySelector(sel); },
    $$: function (sel, raiz) { return Array.prototype.slice.call((raiz || document).querySelectorAll(sel)); },
    pref: pref,
    salvarPref: salvarPref,
    definirPref: function (k, v) { var p = pref(); p[k] = v; salvarPref(p); },

    /* ---------- Toast ---------- */
    toast: function (texto, tipo, titulo, ms) {
      var caixa = UI.$(".toasts");
      if (!caixa) { caixa = document.createElement("div"); caixa.className = "toasts"; caixa.setAttribute("aria-live", "polite"); document.body.appendChild(caixa); }
      var icone = { ok: "check-circle", erro: "alert-circle", aviso: "alert", info: "info" }[tipo || "info"];
      var el = document.createElement("div");
      el.className = "toast toast--" + (tipo || "info");
      el.innerHTML = ic(icone) + "<div>" + (titulo ? "<b>" + U.esc(titulo) + "</b>" : "") + U.esc(texto) + "</div>";
      caixa.appendChild(el);
      setTimeout(function () { el.style.opacity = "0"; el.style.transition = "opacity .25s"; setTimeout(function () { el.remove(); }, 260); }, ms || 3600);
      return el;
    },

    /* ---------- Modal ---------- */
    modal: function (opts) {
      opts = opts || {};
      var wrap = document.createElement("div");
      wrap.className = "modal"; wrap.setAttribute("open", ""); wrap.setAttribute("role", "dialog"); wrap.setAttribute("aria-modal", "true");
      wrap.innerHTML =
        '<div class="modal__fundo"></div>' +
        '<div class="modal__caixa' + (opts.larga ? " modal__caixa--larga" : "") + '">' +
          '<div class="modal__cab"><h2>' + U.esc(opts.titulo || "") + '</h2><button type="button" class="modal__fechar" aria-label="Fechar">' + ic("x") + '</button></div>' +
          '<div class="modal__corpo"></div>' +
          (opts.acoes ? '<div class="modal__acoes"></div>' : "") +
        "</div>";
      var corpo = wrap.querySelector(".modal__corpo");
      if (typeof opts.corpo === "string") corpo.innerHTML = opts.corpo; else if (opts.corpo) corpo.appendChild(opts.corpo);
      var fechar = function (valor) {
        wrap.remove(); document.body.style.overflow = "";
        document.removeEventListener("keydown", esc);
        if (opts.aoFechar) opts.aoFechar(valor);
      };
      var esc = function (e) { if (e.key === "Escape") fechar(); };
      wrap.querySelector(".modal__fundo").addEventListener("click", function () { if (!opts.fixo) fechar(); });
      wrap.querySelector(".modal__fechar").addEventListener("click", function () { fechar(); });
      document.addEventListener("keydown", esc);
      (opts.acoes || []).forEach(function (a) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "btn " + (a.classe || "btn--contorno"); b.innerHTML = (a.icone ? ic(a.icone) : "") + U.esc(a.rotulo);
        b.addEventListener("click", function () {
          var r = a.ao ? a.ao(corpo, fechar) : true;
          if (r !== false && !a.manter) fechar(a.valor);
        });
        wrap.querySelector(".modal__acoes").appendChild(b);
      });
      document.body.appendChild(wrap);
      document.body.style.overflow = "hidden";
      var foco = corpo.querySelector("input, textarea, select, button");
      if (foco) setTimeout(function () { foco.focus(); }, 30);
      return { fechar: fechar, corpo: corpo, el: wrap };
    },
    confirmar: function (titulo, texto, opts) {
      opts = opts || {};
      return new Promise(function (res) {
        UI.modal({
          titulo: titulo,
          corpo: '<p class="txt-2">' + U.esc(texto) + "</p>",
          acoes: [
            { rotulo: opts.cancelar || "Cancelar", ao: function () { res(false); } },
            { rotulo: opts.ok || "Confirmar", classe: opts.perigo ? "btn--perigo" : "btn--primario", ao: function () { res(true); } }
          ],
          aoFechar: function (v) { if (v === undefined) res(false); }
        });
      });
    },
    perguntar: function (titulo, rotulo, valorInicial, opts) {
      opts = opts || {};
      return new Promise(function (res) {
        var id = U.id("q");
        UI.modal({
          titulo: titulo,
          corpo: '<div class="campo"><label class="campo__rotulo" for="' + id + '">' + U.esc(rotulo) + "</label>" +
            (opts.longo ? '<textarea class="textarea" id="' + id + '">' + U.esc(valorInicial || "") + "</textarea>"
                        : '<input class="input" id="' + id + '" value="' + U.esc(valorInicial || "") + '" placeholder="' + U.esc(opts.placeholder || "") + '">') +
            (opts.ajuda ? '<span class="campo__ajuda">' + U.esc(opts.ajuda) + "</span>" : "") + "</div>",
          acoes: [
            { rotulo: "Cancelar", ao: function () { res(null); } },
            { rotulo: opts.ok || "Salvar", classe: "btn--primario", ao: function (c) { res(c.querySelector("#" + id).value); } }
          ],
          aoFechar: function (v) { if (v === undefined) res(null); }
        });
      });
    },

    /* ---------- Sensorial: háptica, som, celebração ---------- */
    vibrar: function (padrao) {
      if (pref().haptica === false) return;
      try { if (navigator.vibrate) navigator.vibrate(padrao || 18); } catch (e) {}
    },
    som: function (tipo) {
      if (pref().som === false) return;
      try {
        var ctx = UI._audio || (UI._audio = new (global.AudioContext || global.webkitAudioContext)());
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "sine";
        o.frequency.value = tipo === "enviado" ? 880 : tipo === "recebido" ? 660 : 520;
        g.gain.value = 0.0001;
        o.connect(g); g.connect(ctx.destination);
        var t = ctx.currentTime;
        g.gain.exponentialRampToValueAtTime(0.06, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        o.start(t); o.stop(t + 0.2);
      } catch (e) {}
    },
    /* Confete: só em marcos (primeiro documento, D15, D30, mês em dia). */
    celebrar: function (texto) {
      if (global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches) { if (texto) UI.toast(texto, "ok"); return; }
      var c = document.createElement("div"); c.className = "confete";
      var cores = ["#c89d57", "#182c43", "#0f766e", "#7fa3d1", "#f7eedd"];
      for (var i = 0; i < 70; i++) {
        var p = document.createElement("i");
        p.style.left = Math.random() * 100 + "%";
        p.style.background = cores[i % cores.length];
        p.style.animationDelay = (Math.random() * 0.5) + "s";
        p.style.animationDuration = (1.1 + Math.random() * 0.8) + "s";
        p.style.transform = "rotate(" + Math.random() * 360 + "deg)";
        c.appendChild(p);
      }
      document.body.appendChild(c);
      UI.vibrar([20, 40, 30]);
      setTimeout(function () { c.remove(); }, 2200);
      if (texto) UI.toast(texto, "ok");
    },

    /* ---------- Widgets ---------- */
    avatar: function (nome, cls, foto) {
      return '<span class="avatar ' + (cls || "") + '" title="' + U.esc(nome) + '">' + (foto ? '<img src="' + U.esc(foto) + '" alt="">' : U.esc(U.iniciais(nome))) + "</span>";
    },
    anel: function (pct, rotulo, tam) {
      tam = tam || 84;
      var r = 34, c = 2 * Math.PI * r, off = c * (1 - Math.min(100, Math.max(0, pct)) / 100);
      return '<div class="anel" style="width:' + tam + 'px;height:' + tam + 'px" role="img" aria-label="' + pct + '%">' +
        '<svg viewBox="0 0 84 84"><circle class="anel__fundo" cx="42" cy="42" r="' + r + '"/><circle class="anel__valor" cx="42" cy="42" r="' + r + '" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '"/></svg>' +
        '<div class="anel__num">' + pct + "%" + (rotulo ? "<small>" + U.esc(rotulo) + "</small>" : "") + "</div></div>";
    },
    barra: function (pct, cls) {
      return '<div class="barra ' + (cls || "") + '" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + Math.min(100, Math.max(0, pct)) + '%"></i></div>';
    },
    badge: function (texto, tipo, icone) {
      return '<span class="badge' + (tipo ? " badge--" + tipo : "") + '">' + (icone ? ic(icone) : "") + U.esc(texto) + "</span>";
    },
    vazio: function (icone, titulo, texto, acaoHtml) {
      return '<div class="vazio">' + ic(icone || "inbox") + "<b>" + U.esc(titulo) + "</b>" + (texto ? "<span>" + U.esc(texto) + "</span>" : "") + (acaoHtml || "") + "</div>";
    },
    esqueleto: function (n) {
      var s = ""; for (var i = 0; i < (n || 3); i++) s += '<div class="esqueleto" style="width:' + (60 + Math.random() * 35) + '%"></div>';
      return '<div class="pilha" style="gap:8px">' + s + "</div>";
    },
    copiar: function (texto, aviso) {
      return navigator.clipboard.writeText(texto).then(function () { UI.toast(aviso || "Copiado.", "ok"); }, function () { UI.toast("Não deu para copiar. Selecione e copie à mão.", "aviso"); });
    },
    /* Título da aba com contador de não lidas */
    titulo: function (base, n) { document.title = (n ? "(" + n + ") " : "") + base; },
    /* Rolagem suave até um elemento, respeitando reduced motion */
    rolarPara: function (el) { if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); },
    /* Instala listeners por delegação num container: data-acao="x" */
    /* Um ouvinte por tela. O #view é o MESMO elemento a vida toda; sem esta trava, cada tela aberta deixava o
       seu ouvinte lá, e um clique disparava a ação de todas as telas já visitadas (bug de 23/09/2026: um
       "Enviar" virou 8 envios e a navegação ficava mais lenta a cada tela). O ouvinte lembra qual conteúdo
       existia quando foi ligado; se o conteúdo foi trocado, ele se desliga sozinho. */
    delegar: function (raiz, mapa) {
      var dono = raiz.firstElementChild;
      function h(e) {
        if (dono === null) dono = raiz.firstElementChild;
        if (!dono || !raiz.contains(dono)) { raiz.removeEventListener("click", h); return; }
        var alvo = e.target.closest("[data-acao]");
        if (!alvo || !raiz.contains(alvo)) return;
        var fn = mapa[alvo.dataset.acao];
        if (fn) { e.preventDefault(); fn(alvo, e); }
      }
      raiz.addEventListener("click", h);
    }
  };
  global.UI = UI;
})(window);
