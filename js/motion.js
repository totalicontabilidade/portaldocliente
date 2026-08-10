/* ============================================================
   Totali · Portal de Onboarding
   motion.js — animações de entrada e de valores

   Princípio: a animação nunca pode esconder conteúdo.
   O CSS só oculta os blocos quando este arquivo marca o <html>
   com a classe "motion", e mesmo assim há uma rede de segurança
   que revela tudo se as animações não dispararem (aba em
   segundo plano, navegador antigo, JavaScript com erro).
   ============================================================ */
(function (global) {
  "use strict";

  var reduzido = false;
  try {
    reduzido = global.matchMedia &&
               global.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) { reduzido = false; }

  var podeAnimar = !reduzido && !!global.IntersectionObserver && !!global.requestAnimationFrame;
  if (podeAnimar) document.documentElement.classList.add("motion");

  var observador = null;
  var redeSeguranca = null;

  /* ---------- Rede de segurança ---------- */
  function revelarTudo() {
    var pendentes = document.querySelectorAll(".reveal:not(.is-in)");
    Array.prototype.forEach.call(pendentes, function (n) {
      n.classList.add("is-in");
      contarNumeros(n);
    });
  }

  function armarRede() {
    clearTimeout(redeSeguranca);
    redeSeguranca = setTimeout(revelarTudo, 1600);
  }

  /* Aba escondida não dispara IntersectionObserver: ao voltar,
     garante que nada ficou invisível. */
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) revelarTudo();
  });

  function criarObservador() {
    return new IntersectionObserver(function (entradas, obs) {
      entradas.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-in");
        obs.unobserve(e.target);
        contarNumeros(e.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
  }

  /* ---------- Contagem animada ---------- */
  function contarUm(no) {
    var alvo = parseFloat(no.getAttribute("data-count"));
    if (isNaN(alvo)) return;
    var sufixo = no.getAttribute("data-count-sufixo") || "";
    if (!podeAnimar || alvo === 0) { no.textContent = alvo + sufixo; return; }

    var duracao = Math.min(1100, 380 + alvo * 22);
    var inicio = null;

    function passo(agora) {
      if (inicio === null) inicio = agora;
      var t = Math.min(1, (agora - inicio) / duracao);
      var suave = 1 - Math.pow(1 - t, 3);           /* ease-out cúbico */
      no.textContent = Math.round(alvo * suave) + sufixo;
      if (t < 1) global.requestAnimationFrame(passo);
    }
    no.textContent = "0" + sufixo;
    global.requestAnimationFrame(passo);
  }

  function contarNumeros(raiz) {
    if (!raiz || !raiz.querySelectorAll) return;
    var nos = raiz.querySelectorAll("[data-count]:not([data-contado])");
    Array.prototype.forEach.call(nos, function (n) {
      n.setAttribute("data-contado", "1");
      contarUm(n);
    });
    /* A própria raiz pode ser o contador. */
    if (raiz.hasAttribute && raiz.hasAttribute("data-count") && !raiz.hasAttribute("data-contado")) {
      raiz.setAttribute("data-contado", "1");
      contarUm(raiz);
    }
  }

  /* ---------- Anel de progresso ----------
     Nasce com o traço vazio; o valor final é solto no quadro
     seguinte para que a transição do CSS desenhe o arco.
  ------------------------------------------- */
  function animarAneis(raiz) {
    var barras = (raiz || document).querySelectorAll(".ring__bar[data-off]");
    if (!barras.length) return;

    var soltar = function () {
      Array.prototype.forEach.call(barras, function (b) {
        b.setAttribute("stroke-dashoffset", b.getAttribute("data-off"));
        b.removeAttribute("data-off");
      });
    };
    if (!podeAnimar) { soltar(); return; }
    global.requestAnimationFrame(function () {
      global.requestAnimationFrame(soltar);
    });
  }

  /* ---------- Aplicação após cada render ---------- */
  function aplicar(raiz) {
    var base = raiz || document.getElementById("view") || document;
    var alvos = base.querySelectorAll(".reveal:not(.is-in)");

    if (!podeAnimar) {
      Array.prototype.forEach.call(alvos, function (n) { n.classList.add("is-in"); });
      contarNumeros(base);
      animarAneis(base);
      return;
    }

    if (!observador) observador = criarObservador();

    var altura = global.innerHeight || document.documentElement.clientHeight || 800;
    var porPai = [];   /* [elementoPai, quantidade] — cascata por grupo visual */

    function indiceNoPai(no) {
      var pai = no.parentElement;
      for (var k = 0; k < porPai.length; k++) {
        if (porPai[k][0] === pai) return porPai[k][1]++;
      }
      porPai.push([pai, 1]);
      return 0;
    }

    Array.prototype.forEach.call(alvos, function (n) {
      /* A cascata é contada dentro de cada grupo (as seções entre si,
         os cartões entre si) e limitada, para que o último item de uma
         lista longa não demore quase um segundo para aparecer. */
      n.style.setProperty("--d", String(Math.min(indiceNoPai(n), 5)));
      var caixa = n.getBoundingClientRect();
      if (caixa.top < altura * 0.96) {
        n.classList.add("is-in");     /* já está na tela: entra de imediato */
        contarNumeros(n);
      } else {
        observador.observe(n);
      }
    });

    contarNumeros(base);
    animarAneis(base);
    armarRede();
  }

  global.Motion = { aplicar: aplicar, revelarTudo: revelarTudo, animado: podeAnimar };
})(window);
