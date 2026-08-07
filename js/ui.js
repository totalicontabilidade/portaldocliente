/* ============================================================
   Totali · Portal de Onboarding
   ui.js — componentes de interface reutilizáveis
   (ícones, avisos, janelas modais, confirmação)
   ============================================================ */
(function (global) {
  "use strict";

  var U = global.U;

  /* ---------- Helpers de DOM ---------- */
  function $(sel, raiz) { return (raiz || document).querySelector(sel); }
  function $$(sel, raiz) { return Array.prototype.slice.call((raiz || document).querySelectorAll(sel)); }

  function el(tag, attrs, filhos) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "class") n.className = attrs[k];
      else if (k === "text") n.textContent = attrs[k];
      else if (k === "html") n.innerHTML = attrs[k];
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
    });
    (filhos || []).forEach(function (f) { if (f) n.appendChild(f); });
    return n;
  }

  /* Ícone do sprite SVG. `nome` é sempre um literal do código —
     nunca vem do usuário. */
  function icone(nome, classe) {
    return '<svg class="ic ' + (classe || "") + '" aria-hidden="true" focusable="false">' +
           '<use href="#' + nome + '"></use></svg>';
  }

  /* ---------- Toasts ---------- */
  function toast(mensagem, tipo, ms) {
    var caixa = $("#toasts");
    if (!caixa) return;
    var ic = tipo === "erro" ? "ic-alert" : tipo === "ok" ? "ic-check-circle" : "ic-info";
    var cls = tipo === "erro" ? "toast--err" : tipo === "ok" ? "toast--ok" : "";
    var n = el("div", {
      class: "toast " + cls,
      role: tipo === "erro" ? "alert" : "status",
      html: icone(ic) + "<span>" + U.esc(mensagem) + "</span>"
    });
    caixa.appendChild(n);
    var fecha = function () {
      n.classList.add("toast--out");
      setTimeout(function () { if (n.parentNode) n.parentNode.removeChild(n); }, 260);
    };
    setTimeout(fecha, ms || (tipo === "erro" ? 6500 : 3800));
    n.addEventListener("click", fecha);
  }

  /* ---------- Modal ----------
     Foco preso dentro da janela, ESC fecha, foco volta para o
     elemento que abriu. `corpoHTML` deve chegar já escapado.
  ------------------------------------------------ */
  var modalAberto = null;

  function fecharModal() {
    if (!modalAberto) return;
    var m = modalAberto;
    modalAberto = null;
    document.removeEventListener("keydown", m.onKey, true);
    if (m.backdrop.parentNode) m.backdrop.parentNode.removeChild(m.backdrop);
    document.body.style.overflow = "";
    if (m.origem && document.contains(m.origem)) {
      try { m.origem.focus(); } catch (e) { /* elemento pode ter sumido */ }
    }
  }

  function modal(opcoes) {
    fecharModal();
    var titulo = opcoes.titulo || "";
    var corpo = opcoes.corpoHTML || "";
    var acoes = opcoes.acoes || [];
    var origem = document.activeElement;

    var backdrop = el("div", { class: "modal-backdrop", role: "presentation" });
    var caixa = el("div", {
      class: "modal",
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": "modalTitulo"
    });

    var html =
      '<div class="modal__grip" aria-hidden="true"></div>' +
      '<div class="modal__head">' +
        '<h2 class="modal__title" id="modalTitulo">' + U.esc(titulo) + '</h2>' +
        '<button type="button" class="modal__close" data-fechar aria-label="Fechar">' + icone("ic-x") + '</button>' +
      '</div>' +
      '<div class="modal__body">' + corpo + '</div>';

    if (acoes.length) {
      html += '<div class="modal__foot">' + acoes.map(function (a, i) {
        return '<button type="button" class="btn ' + (a.classe || "btn--ghost") + '" data-acao="' + i + '">' +
               U.esc(a.rotulo) + '</button>';
      }).join("") + '</div>';
    }
    caixa.innerHTML = html;
    backdrop.appendChild(caixa);
    document.body.appendChild(backdrop);
    document.body.style.overflow = "hidden";

    $$("[data-fechar]", caixa).forEach(function (b) { b.addEventListener("click", fecharModal); });
    acoes.forEach(function (a, i) {
      var b = $('[data-acao="' + i + '"]', caixa);
      if (b) b.addEventListener("click", function () {
        if (a.fecharAntes !== false) fecharModal();
        if (typeof a.onClick === "function") a.onClick();
      });
    });
    backdrop.addEventListener("mousedown", function (ev) {
      if (ev.target === backdrop) fecharModal();
    });

    function focaveis() {
      return $$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', caixa)
        .filter(function (n) { return n.offsetParent !== null && !n.disabled; });
    }

    var onKey = function (ev) {
      if (ev.key === "Escape") { ev.preventDefault(); fecharModal(); return; }
      if (ev.key !== "Tab") return;
      var f = focaveis();
      if (!f.length) return;
      var primeiro = f[0], ultimo = f[f.length - 1];
      if (ev.shiftKey && document.activeElement === primeiro) { ev.preventDefault(); ultimo.focus(); }
      else if (!ev.shiftKey && document.activeElement === ultimo) { ev.preventDefault(); primeiro.focus(); }
    };
    document.addEventListener("keydown", onKey, true);

    modalAberto = { backdrop: backdrop, onKey: onKey, origem: origem };

    var alvo = $("[data-focus]", caixa) || focaveis()[0];
    if (alvo) setTimeout(function () { try { alvo.focus(); } catch (e) {} }, 40);

    return { fechar: fecharModal, caixa: caixa };
  }

  /* ---------- Confirmação ---------- */
  function confirmar(opcoes) {
    return new Promise(function (resolve) {
      var decidiu = false;
      modal({
        titulo: opcoes.titulo || "Confirmar",
        corpoHTML: '<p style="font-size:14px;line-height:1.6;color:var(--ink-2)">' +
                   U.esc(opcoes.mensagem || "") + '</p>',
        acoes: [
          {
            rotulo: opcoes.cancelar || "Cancelar",
            classe: "btn--ghost",
            onClick: function () { decidiu = true; resolve(false); }
          },
          {
            rotulo: opcoes.confirmar || "Confirmar",
            classe: opcoes.perigo ? "btn--danger" : "btn--primary",
            onClick: function () { decidiu = true; resolve(true); }
          }
        ]
      });
      var obs = new MutationObserver(function () {
        if (!document.querySelector(".modal-backdrop")) {
          obs.disconnect();
          if (!decidiu) resolve(false);
        }
      });
      obs.observe(document.body, { childList: true });
    });
  }

  global.UI = {
    $: $, $$: $$, el: el,
    icone: icone,
    toast: toast,
    modal: modal,
    fecharModal: fecharModal,
    confirmar: confirmar
  };
})(window);
