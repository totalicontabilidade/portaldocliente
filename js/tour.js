/* ============================================================
   Totali · Portal de Onboarding
   tour.js — tutorial guiado, passo a passo

   PARA QUEM ISTO FOI FEITO
   ------------------------
   Boa parte dos nossos clientes não tem intimidade com sistema
   nenhum. Uma tela cheia de campos, sem ninguém ao lado
   explicando, é onde a pessoa desiste. Aqui o portal escurece
   tudo, acende UMA parte da tela e diz, em linguagem de gente,
   o que fazer ali. Um assunto por vez.

   REGRAS QUE ESTE ARQUIVO SEGUE
   -----------------------------
   • Um passo mostra um lugar só. Sem texto comprido.
   • Dá para sair a qualquer momento, e dá para rever depois.
   • Se o elemento não existir naquela tela, o passo é pulado em
     silêncio — tutorial nenhum pode travar o portal.
   • Nada de texto do cliente entra aqui sem escape.
   ============================================================ */
(function (global) {
  "use strict";

  var U = global.U;
  var LARGURA_BALAO = 420;

  var atual = null;   /* sessão de tutorial em andamento */

  function criarNo(tag, classe) {
    var n = document.createElement(tag);
    if (classe) n.className = classe;
    return n;
  }

  /* Elementos que existem e estão visíveis. Um seletor pode
     apontar para algo que aquela tela não montou — trilha vazia,
     vídeo ainda não publicado, lista sem pendência. */
  function alvoDe(seletor) {
    if (!seletor) return null;
    var n;
    try { n = document.querySelector(seletor); } catch (e) { return null; }
    if (!n) return null;
    var r = n.getBoundingClientRect();
    if (!r.width && !r.height) return null;
    return n;
  }

  function fechar(concluido) {
    if (!atual) return;
    var s = atual;
    atual = null;
    document.removeEventListener("keydown", s.aoTeclar, true);
    global.removeEventListener("resize", s.aoMudar);
    global.removeEventListener("orientationchange", s.aoMudar);
    global.removeEventListener("scroll", s.aoMudar);
    if (s.caixa.parentNode) s.caixa.parentNode.removeChild(s.caixa);
    document.body.classList.remove("tour-aberto");
    if (s.origem && document.contains(s.origem)) {
      try { s.origem.focus(); } catch (e) { /* pode ter sumido no render */ }
    }
    if (typeof s.aoFim === "function") s.aoFim(concluido === true);
  }

  function posicionar(s) {
    var passo = s.passos[s.i];
    var alvo = alvoDe(passo.alvo);
    var spot = s.spot, balao = s.balao;
    var vh = global.innerHeight, vw = global.innerWidth;

    if (!alvo) {
      spot.hidden = true;
      s.caixa.classList.add("tour--cheio");
      balao.style.left = Math.max(12, (vw - Math.min(LARGURA_BALAO, vw - 24)) / 2) + "px";
      balao.style.top = "";
      balao.style.bottom = "";
      balao.style.transform = "translateY(-50%)";
      balao.style.top = Math.round(vh / 2) + "px";
      return;
    }

    var r = alvo.getBoundingClientRect();
    var folga = 8;

    /* A largura precisa ser aplicada ANTES de medir a altura: o
       mesmo texto ocupa mais linhas num balão estreito, e medir
       com a largura antiga erra a conta do espaço disponível. */
    var largura = Math.min(LARGURA_BALAO, vw - 24);
    balao.style.width = Math.round(largura) + "px";
    var alturaBalao = balao.offsetHeight || 190;

    spot.hidden = false;
    s.caixa.classList.remove("tour--cheio");

    /* Numa tela de celular, uma seção inteira pode ser mais alta
       do que a tela toda. Nesse caso acendemos só o começo dela:
       a pessoa vê onde é, e ainda sobra espaço para o balão sem
       cobrir justamente o que estamos apontando. */
    var topoSpot = Math.max(0, r.top - folga);
    var alturaMax = Math.max(110, vh - topoSpot - alturaBalao - 30);
    var alturaSpot = Math.min(r.height + folga * 2, alturaMax, vh - topoSpot);

    spot.style.left = Math.max(0, r.left - folga) + "px";
    spot.style.top = topoSpot + "px";
    spot.style.width = Math.min(vw, r.width + folga * 2) + "px";
    spot.style.height = alturaSpot + "px";

    /* O balão fica do lado onde sobra espaço. */
    var esquerda = r.left + r.width / 2 - largura / 2;
    esquerda = Math.max(12, Math.min(esquerda, vw - largura - 12));

    var abaixo = vh - (topoSpot + alturaSpot) - 14;
    var acima = topoSpot - 14;
    var topo;
    if (abaixo >= alturaBalao) topo = topoSpot + alturaSpot + 14;
    else if (acima >= alturaBalao) topo = topoSpot - 14 - alturaBalao;
    else topo = vh - alturaBalao - 16;
    /* Nada de balão pela metade fora da tela, aconteça o que
       acontecer com o tamanho do elemento aceso. */
    topo = Math.max(12, Math.min(topo, vh - alturaBalao - 12));

    balao.style.transform = "";
    balao.style.left = Math.round(esquerda) + "px";
    balao.style.top = Math.round(topo) + "px";
  }

  function desenhar(s) {
    var passo = s.passos[s.i];
    var ultimo = s.i === s.passos.length - 1;

    s.balao.innerHTML =
      '<div class="tour__conta">Passo ' + (s.i + 1) + ' de ' + s.passos.length + '</div>' +
      '<h2 class="tour__titulo" id="tourTitulo">' + U.esc(passo.titulo) + '</h2>' +
      '<p class="tour__texto">' + U.esc(passo.texto) + '</p>' +
      '<div class="tour__pontos" aria-hidden="true">' +
        s.passos.map(function (_, i) {
          return '<span class="tour__ponto' + (i === s.i ? " tour__ponto--on" : "") + '"></span>';
        }).join("") +
      '</div>' +
      '<div class="tour__acoes">' +
        '<button type="button" class="btn btn--quiet btn--sm" data-tour="sair">Sair do tutorial</button>' +
        '<span class="tour__espaco"></span>' +
        (s.i > 0
          ? '<button type="button" class="btn btn--ghost btn--sm" data-tour="voltar">Voltar</button>'
          : '') +
        '<button type="button" class="btn btn--primary btn--sm" data-tour="proximo">' +
          (ultimo ? "Entendi" : "Próximo") + '</button>' +
      '</div>';

    Array.prototype.forEach.call(s.balao.querySelectorAll("[data-tour]"), function (b) {
      b.addEventListener("click", function () {
        var acao = b.getAttribute("data-tour");
        if (acao === "sair") { fechar(false); return; }
        if (acao === "voltar") { ir(s, s.i - 1); return; }
        if (s.i >= s.passos.length - 1) { fechar(true); return; }
        ir(s, s.i + 1);
      });
    });

    posicionar(s);
    var foco = s.balao.querySelector('[data-tour="proximo"]');
    if (foco) setTimeout(function () { try { foco.focus(); } catch (e) {} }, 30);
  }

  function ir(s, indice) {
    /* Passo cujo elemento não está naquela tela é pulado, no
       sentido em que a pessoa estava indo. */
    var passo = indice > s.i ? 1 : -1;
    var i = indice;
    while (i >= 0 && i < s.passos.length) {
      if (!s.passos[i].alvo || alvoDe(s.passos[i].alvo)) break;
      i += passo;
    }
    if (i < 0 || i >= s.passos.length) { fechar(true); return; }
    s.i = i;

    var alvo = alvoDe(s.passos[i].alvo);
    if (alvo) {
      levarAte(alvo);
      setTimeout(function () { if (atual === s) desenhar(s); }, 320);
    } else {
      desenhar(s);
    }
  }

  /* Rolagem própria em vez de scrollIntoView: precisamos deixar
     espaço para o cabeçalho fixo, que senão cobre justamente o
     começo do que estamos apontando. Elemento alto encosta no
     topo; elemento baixo fica centralizado. */
  function levarAte(alvo) {
    var r = alvo.getBoundingClientRect();
    var vh = global.innerHeight;
    var abaixoDoCabecalho = 92;
    var topoNaPagina = global.scrollY + r.top;
    var destino = (r.height + 40 >= vh - 240)
      ? topoNaPagina - abaixoDoCabecalho
      : topoNaPagina - Math.max(abaixoDoCabecalho, (vh - r.height) / 2);
    try { global.scrollTo({ top: Math.max(0, destino), behavior: "smooth" }); }
    catch (e) { global.scrollTo(0, Math.max(0, destino)); }
  }

  /* opcoes: { passos: [{alvo, titulo, texto}], aoFim: fn } */
  function iniciar(opcoes) {
    /* Só entram os passos que têm onde pousar nesta tela. O
       tutorial é montado para vários cenários — cliente sem
       pendência, vídeo ainda não publicado, celular em vez de
       computador — e a contagem ("passo 2 de 5") precisa bater
       com o que a pessoa realmente vai ver. */
    var passos = (opcoes && opcoes.passos || []).filter(function (p) {
      return p && p.titulo && p.texto && (!p.alvo || alvoDe(p.alvo));
    });
    if (!passos.length) return false;

    fechar(false);

    var caixa = criarNo("div", "tour");
    var spot = criarNo("div", "tour__spot");
    var balao = criarNo("div", "tour__balao");
    balao.setAttribute("role", "dialog");
    balao.setAttribute("aria-modal", "true");
    balao.setAttribute("aria-labelledby", "tourTitulo");
    spot.hidden = true;
    caixa.appendChild(spot);
    caixa.appendChild(balao);
    document.body.appendChild(caixa);
    document.body.classList.add("tour-aberto");

    var s = {
      passos: passos, i: 0, caixa: caixa, spot: spot, balao: balao,
      aoFim: opcoes.aoFim, origem: document.activeElement
    };

    s.aoTeclar = function (ev) {
      if (ev.key === "Escape") { ev.preventDefault(); fechar(false); return; }
      if (ev.key === "Tab") {
        /* O foco não sai do balão: atrás dele está tudo apagado. */
        var f = Array.prototype.slice.call(balao.querySelectorAll("button"));
        if (!f.length) return;
        var primeiro = f[0], ultimo = f[f.length - 1];
        if (ev.shiftKey && document.activeElement === primeiro) { ev.preventDefault(); ultimo.focus(); }
        else if (!ev.shiftKey && document.activeElement === ultimo) { ev.preventDefault(); primeiro.focus(); }
      }
    };
    s.aoMudar = function () { if (atual === s) posicionar(s); };

    document.addEventListener("keydown", s.aoTeclar, true);
    global.addEventListener("resize", s.aoMudar);
    global.addEventListener("orientationchange", s.aoMudar);
    /* A área acesa acompanha a rolagem. Também é o que corrige a
       posição enquanto a tela ainda está deslizando até o alvo. */
    global.addEventListener("scroll", s.aoMudar, { passive: true });

    /* Clicar no escuro não fecha por acidente: quem quer sair
       usa o botão. Evita perder o tutorial num toque errado. */
    caixa.addEventListener("click", function (ev) {
      if (ev.target === caixa || ev.target === spot) ev.stopPropagation();
    });

    atual = s;
    ir(s, 0);
    return true;
  }

  global.Tour = {
    iniciar: iniciar,
    fechar: function () { fechar(false); },
    get aberto() { return !!atual; }
  };
})(window);
