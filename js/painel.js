/* ============================================================
   Totali · Portal de Onboarding
   painel.js — esqueleto do painel da equipe

   POR QUE EXISTE
   --------------
   O painel era uma página só, com tudo empilhado: cadastro,
   chaves, conteúdo, clientes. Quem trabalha nele o dia inteiro
   rolava a tela procurando onde estava a coisa. Agora cada
   assunto é uma aba, e este arquivo cuida de três coisas:

     1. Qual aba está aberta (pelo endereço, então dá para
        recarregar a página e voltar no mesmo lugar).
     2. Quem está usando o painel — nome sempre visível no
        cabeçalho. Num sistema interno isso não é enfeite: é o
        que evita aprovar documento em nome de outra pessoa.
     3. Mostrar o painel só depois do login.

   As abas em si são desenhadas por outros arquivos
   (equipe.js, painel-conteudo.js, painel-clientes.js). Aqui só
   se decide o que aparece.
   ============================================================ */
(function (global) {
  "use strict";

  var UI = global.UI, U = global.U;
  var $ = UI.$, $$ = UI.$$;

  var ABAS = ["inicio", "clientes", "pendencias", "mensagens", "novo", "conteudo",
              "usuarios", "seguranca"];
  /* Abrir no Início, e não na lista de clientes: a primeira
     pergunta de quem senta no painel é "o que eu faço agora", não
     "quem são meus clientes". */
  var PADRAO = "inicio";
  var TITULOS = {
    inicio: "Início",
    clientes: "Clientes",
    pendencias: "Pendências",
    mensagens: "Mensagens",
    novo: "Novo cliente",
    conteudo: "Conteúdo do portal",
    usuarios: "Usuários",
    seguranca: "Segurança"
  };

  var abaAtual = "";
  var ouvintes = [];

  function abaValida(id) {
    return ABAS.indexOf(id) > -1 ? id : PADRAO;
  }

  function abaDaURL() {
    return abaValida((location.hash || "").replace(/^#\/?/, "").split("?")[0]);
  }

  function abrir(id, semRolar) {
    var alvo = abaValida(id);
    if (location.hash !== "#/" + alvo) { location.hash = "#/" + alvo; return; }
    aplicar(alvo, semRolar);
  }

  function aplicar(alvo, semRolar) {
    var mudou = abaAtual !== alvo;
    abaAtual = alvo;

    $$("[data-painel]").forEach(function (s) {
      s.hidden = s.getAttribute("data-painel") !== alvo;
    });

    $$("[data-aba]").forEach(function (b) {
      /* A logo do cabeçalho é atalho, não item de menu: nunca
         fica marcada como página atual. */
      if (b.classList.contains("brand")) return;
      if (b.getAttribute("data-aba") === alvo) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });

    document.title = TITULOS[alvo] + " · Painel da equipe · Totali";

    if (mudou && !semRolar) global.scrollTo({ top: 0, behavior: "auto" });
    if (mudou) ouvintes.forEach(function (fn) {
      try { fn(alvo); } catch (e) { /* um ouvinte com erro não derruba os outros */ }
    });
  }

  /* ---------- Identidade de quem está usando ---------- */
  function iniciais(nome) {
    var partes = String(nome || "").trim().split(/\s+/).filter(Boolean);
    if (!partes.length) return "?";
    if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
  }

  function mostrarQuem(equipe) {
    var acoes = $("#pnAcoes");
    if (!acoes) return;
    if (!equipe) { acoes.hidden = true; return; }

    var nome = equipe.nome || (equipe.email || "").split("@")[0] || "Equipe";
    acoes.hidden = false;
    $("#pnNome").textContent = nome;
    $("#pnPapel").textContent = equipe.papel === "admin" ? "Administrador" : "Equipe";
    $("#pnIniciais").textContent = iniciais(equipe.nome || equipe.email);
    $("#pnQuem").title = equipe.email || "";
  }

  /* ---------- Avisos no menu ----------
     Cada aba pode carregar um número: quantos clientes esperam
     conferência, quantas pendências existem, quantas mensagens
     não foram lidas. É o que faz a pessoa saber onde tem
     trabalho sem abrir aba por aba. */
  function marcarBadges(contas) {
    Object.keys(contas || {}).forEach(function (chave) {
      var n = contas[chave];
      $$("[data-badge-" + chave + "]").forEach(function (el) {
        if (n > 0) { el.hidden = false; el.textContent = n > 99 ? "99+" : String(n); }
        else el.hidden = true;
      });
    });
  }

  function marcarAtencao(quantos) { marcarBadges({ atencao: quantos }); }

  /* ---------- Entrar e sair ---------- */
  function mostrarPainel(dentro) {
    var painel = $("#painel"), porta = $("#pnPorta"), tabbar = $("#pnTabbar");
    if (painel) painel.hidden = !dentro;
    if (porta) porta.hidden = dentro;
    if (tabbar) tabbar.hidden = !dentro;
    if (dentro) aplicar(abaDaURL(), true);
  }

  function ligar() {
    document.addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-aba]");
      if (!b || b.disabled) return;
      ev.preventDefault();
      abrir(b.getAttribute("data-aba"));
    });

    global.addEventListener("hashchange", function () { aplicar(abaDaURL()); });
  }

  function iniciar() {
    if (!$("#painel")) return;
    ligar();
    if (!location.hash) {
      try { history.replaceState({}, "", location.pathname + "#/" + PADRAO); }
      catch (e) { location.hash = "#/" + PADRAO; }
    }
    aplicar(abaDaURL(), true);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();

  global.Painel = {
    abrir: abrir,
    get aba() { return abaAtual; },
    /* Chamado quando alguém entra ou sai — é o que liga e desliga
       o painel inteiro. */
    sessao: function (equipe) {
      mostrarQuem(equipe);
      mostrarPainel(!!equipe);
    },
    mostrarPainel: mostrarPainel,
    marcarAtencao: marcarAtencao,
    marcarBadges: marcarBadges,
    /* Avisa quem precisa saber que a aba mudou — a lista de
       clientes usa para carregar só quando é olhada. */
    aoTrocar: function (fn) { if (typeof fn === "function") ouvintes.push(fn); }
  };
})(window);
