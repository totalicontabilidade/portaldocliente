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

  /* ============================================================
     MENU DE CONTEXTO

     Clique direito no computador, toque longo no celular. Existe
     porque as duas telas de conversa precisam da mesma coisa, e
     duplicar isso significaria consertar toque longo duas vezes.

     TOQUE LONGO É MAIS CHATO DO QUE PARECE, e as três medidas
     abaixo saem de erros clássicos:

       • rolar a conversa com o dedo em cima de uma bolha NÃO pode
         abrir menu — por isso o movimento cancela;
       • depois que o menu abre, o navegador ainda dispara o clique
         do dedo, que fecharia o menu na mesma hora — por isso o
         `engolirProximoClique`;
       • o menu do próprio navegador (copiar, colar) apareceria por
         cima no clique direito — por isso o preventDefault.
     ============================================================ */
  var menuAberto = null;

  function fecharMenu() {
    if (!menuAberto) return;
    var n = menuAberto;
    menuAberto = null;
    document.removeEventListener("keydown", n.onKey, true);
    if (n.el.parentNode) n.el.parentNode.removeChild(n.el);
  }

  /* opcoes = { x, y, itens: [{ rotulo, icone, perigo, onClick }] } */
  function menu(opcoes) {
    fecharMenu();
    var itens = (opcoes.itens || []).filter(Boolean);
    if (!itens.length) return null;

    var el = document.createElement("div");
    el.className = "menuctx";
    el.setAttribute("role", "menu");
    el.innerHTML = itens.map(function (it, i) {
      return '<button type="button" role="menuitem" class="menuctx__i' +
        (it.perigo ? " menuctx__i--perigo" : "") + '" data-i="' + i + '">' +
        (it.icone ? icone(it.icone) : "") + U.esc(it.rotulo) + '</button>';
    }).join("");
    document.body.appendChild(el);

    /* Encostar na borda deixaria metade do menu fora da tela. */
    var larg = el.offsetWidth, alt = el.offsetHeight;
    var x = Math.min(opcoes.x, window.innerWidth - larg - 8);
    var y = Math.min(opcoes.y, window.innerHeight - alt - 8);
    el.style.left = Math.max(8, x) + "px";
    el.style.top = Math.max(8, y) + "px";

    $$("[data-i]", el).forEach(function (b) {
      b.addEventListener("click", function () {
        var it = itens[Number(b.getAttribute("data-i"))];
        fecharMenu();
        if (it && typeof it.onClick === "function") it.onClick();
      });
    });

    var onKey = function (ev) { if (ev.key === "Escape") fecharMenu(); };
    document.addEventListener("keydown", onKey, true);
    menuAberto = { el: el, onKey: onKey };

    setTimeout(function () {
      document.addEventListener("pointerdown", function fora(ev) {
        if (menuAberto && menuAberto.el.contains(ev.target)) return;
        document.removeEventListener("pointerdown", fora, true);
        fecharMenu();
      }, true);
    }, 0);

    var primeiro = el.querySelector("button");
    if (primeiro) { try { primeiro.focus(); } catch (e) {} }
    return { fechar: fecharMenu };
  }

  /* Balão de leitura: um texto que não cabe na linha e não merece
     uma janela inteira.

     É CLIQUE, e não passar o mouse, de propósito: no celular não
     existe passar o mouse, e uma dica que só funciona no
     computador é meia dica. Clique funciona nos dois, e a mesma
     peça serve para as duas telas.

     Reaproveita o posicionamento do menu — inclusive a correção de
     borda, que é onde esse tipo de coisa costuma vazar da tela. */
  function balao(opcoes) {
    fecharMenu();
    var el = document.createElement("div");
    el.className = "balao";
    el.setAttribute("role", "dialog");
    el.innerHTML =
      (opcoes.titulo ? '<div class="balao__t">' + U.esc(opcoes.titulo) + '</div>' : '') +
      '<div class="balao__c">' + U.esc(opcoes.texto || "") + '</div>';
    document.body.appendChild(el);

    var larg = el.offsetWidth, alt = el.offsetHeight;
    var x = Math.min(opcoes.x - larg / 2, window.innerWidth - larg - 10);
    var y = opcoes.y - alt - 12;
    /* Sem espaço em cima, abre para baixo em vez de sair da tela. */
    if (y < 10) y = opcoes.y + 20;
    el.style.left = Math.max(10, x) + "px";
    el.style.top = Math.min(y, window.innerHeight - alt - 10) + "px";

    var onKey = function (ev) { if (ev.key === "Escape") fecharMenu(); };
    document.addEventListener("keydown", onKey, true);
    menuAberto = { el: el, onKey: onKey };

    setTimeout(function () {
      document.addEventListener("pointerdown", function fora(ev) {
        if (menuAberto && menuAberto.el.contains(ev.target)) return;
        document.removeEventListener("pointerdown", fora, true);
        fecharMenu();
      }, true);
    }, 0);
    return { fechar: fecharMenu };
  }

  /* Liga clique direito e toque longo num container, para os
     elementos que casarem com `seletor`. `montar(alvo)` devolve a
     lista de itens — ou nada, e aí nenhum menu abre. */
  function ligarMenuDeContexto(container, seletor, montar) {
    if (!container) return;
    var TEMPO_TOQUE_MS = 500;
    var TOLERANCIA_PX = 10;
    var relogio = null, partiu = null, engolirProximoClique = false;

    function cancelar() {
      if (relogio) { clearTimeout(relogio); relogio = null; }
      partiu = null;
    }

    function abrirEm(alvo, x, y) {
      var itens = montar(alvo);
      if (itens && itens.length) menu({ x: x, y: y, itens: itens });
    }

    container.addEventListener("contextmenu", function (ev) {
      var alvo = ev.target.closest(seletor);
      if (!alvo || !container.contains(alvo)) return;
      ev.preventDefault();
      abrirEm(alvo, ev.clientX, ev.clientY);
    });

    container.addEventListener("touchstart", function (ev) {
      var alvo = ev.target.closest(seletor);
      if (!alvo || ev.touches.length !== 1) return;
      var t = ev.touches[0];
      partiu = { x: t.clientX, y: t.clientY };
      relogio = setTimeout(function () {
        relogio = null;
        engolirProximoClique = true;
        abrirEm(alvo, partiu.x, partiu.y);
      }, TEMPO_TOQUE_MS);
    }, { passive: true });

    container.addEventListener("touchmove", function (ev) {
      if (!partiu || !relogio) return;
      var t = ev.touches[0];
      if (Math.abs(t.clientX - partiu.x) > TOLERANCIA_PX ||
          Math.abs(t.clientY - partiu.y) > TOLERANCIA_PX) cancelar();
    }, { passive: true });

    container.addEventListener("touchend", cancelar, { passive: true });
    container.addEventListener("touchcancel", cancelar, { passive: true });

    container.addEventListener("click", function (ev) {
      if (!engolirProximoClique) return;
      engolirProximoClique = false;
      ev.preventDefault();
      ev.stopPropagation();
    }, true);
  }

  /* ---------- Confirmação ---------- */
  function confirmar(opcoes) {
    return new Promise(function (resolve) {
      var decidiu = false;
      modal({
        titulo: opcoes.titulo || "Confirmar",
        corpoHTML: '<p style="font-size:14px;line-height:1.65;color:var(--txt-2)">' +
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

  /* ============================================================
     Barra de progresso de envio

     Fica presa no rodapé, acima da barra de abas, e não bloqueia a
     tela: quem está enviando um documento pode continuar lendo o
     resto do portal enquanto sobe.

     Não usa <dialog> de propósito — janela modal durante upload
     dá a impressão de que o sistema travou, que é justamente o que
     esta barra existe para evitar.
     ============================================================ */
  function progresso(titulo) {
    var caixa = document.createElement("div");
    caixa.className = "envio";
    caixa.setAttribute("role", "status");
    caixa.setAttribute("aria-live", "polite");
    caixa.innerHTML =
      '<div class="envio__topo">' +
        '<span class="envio__t"></span>' +
        '<span class="envio__pct">0%</span>' +
      '</div>' +
      '<div class="envio__trilho"><i class="envio__barra"></i></div>' +
      '<div class="envio__nota">Pode continuar usando o portal. Não feche esta página.</div>';
    document.body.appendChild(caixa);

    var elT = caixa.querySelector(".envio__t");
    var elP = caixa.querySelector(".envio__pct");
    var elB = caixa.querySelector(".envio__barra");
    elT.textContent = titulo || "Enviando";

    /* Entrada com timer, e NÃO com requestAnimationFrame.

       rAF não dispara em aba de segundo plano — e trocar de aba
       durante um envio é o caso mais comum de todos: a pessoa
       manda o documento e vai fazer outra coisa. Com rAF, a barra
       nunca ganhava a classe de entrada e ficava invisível
       justamente em quem mais precisa dela. Timer é throttled em
       segundo plano, mas dispara. */
    setTimeout(function () { caixa.classList.add("envio--on"); }, 20);

    return {
      titulo: function (t) { elT.textContent = t; },
      pct: function (v) {
        var n = Math.max(0, Math.min(100, Math.round(v || 0)));
        elB.style.width = n + "%";
        elP.textContent = n + "%";
      },
      fechar: function () {
        caixa.classList.remove("envio--on");
        setTimeout(function () {
          if (caixa.parentNode) caixa.parentNode.removeChild(caixa);
        }, 320);
      }
    };
  }

  global.UI = {
    $: $, $$: $$, el: el,
    icone: icone,
    toast: toast,
    modal: modal,
    fecharModal: fecharModal,
    menu: menu,
    balao: balao,
    fecharMenu: fecharMenu,
    ligarMenuDeContexto: ligarMenuDeContexto,
    confirmar: confirmar,
    progresso: progresso
  };
})(window);
