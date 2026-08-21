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

  /* ============================================================
     Tutorial de quem chega agora

     Mesma ideia do portal do cliente, e pelo mesmo motivo: quem
     abre esta tela pela primeira vez vê oito abas e nenhuma pista
     de por onde começar. Um passo por assunto, em linguagem de
     gente, e some quando a pessoa já viu.

     O "já viu" fica no SERVIDOR, no documento da pessoa em
     /usuarios. Guardar no navegador faria o tutorial voltar toda
     vez que ela trocasse de computador — e neste escritório isso
     acontece.

     O texto fala do TRABALHO, não dos botões. "Aqui ficam os
     clientes" não ajuda ninguém; "a lista vem ordenada por quem
     está parado há mais tempo" ajuda.
     ============================================================ */
  var PASSOS = [
    { alvo: null,
      titulo: "Bem-vindo ao painel",
      texto: "Em um minuto eu mostro onde fica cada coisa. Dá para sair quando quiser, e o " +
             "botão \"Ver o tutorial\", no topo, traz de volta." },
    { alvo: '.sidenav__item[data-aba="inicio"]',
      titulo: "Comece sempre pelo Início",
      texto: "Ele cruza as outras abas e responde uma pergunta só: o que precisa de você agora. " +
             "Mensagem sem resposta, documento esperando conferência e cliente parado há dias " +
             "aparecem aqui, em ordem de urgência." },
    { alvo: '.sidenav__item[data-aba="clientes"]',
      titulo: "Clientes, do mais parado para o menos",
      texto: "A lista não é por nome: quem está há mais tempo sem dar sinal fica no topo. " +
             "Abrir um cliente mostra a ficha dele — documentos, cadastro e conversa." },
    { alvo: '.sidenav__item[data-aba="pendencias"]',
      titulo: "O que falta, e como cobrar",
      texto: "Aqui fica tudo o que ainda não chegou, empresa por empresa. O botão Cobrar monta " +
             "o texto pronto com a lista do que falta — você escolhe mandar pelo portal, pelo " +
             "WhatsApp ou por e-mail." },
    { alvo: '.sidenav__item[data-aba="novo"]',
      titulo: "Para entrar um cliente novo",
      texto: "Preencha razão social e CNPJ e o painel devolve um link. O cliente abre esse link, " +
             "cria a senha dele e o portal já nasce com os dados certos." },
    { alvo: '.sidenav__item[data-aba="conteudo"]',
      titulo: "Nada se muda por código",
      texto: "Textos, documentos do checklist, vídeos, perguntas frequentes — tudo o que o " +
             "cliente vê se altera nesta aba." },
    { alvo: "#pnQuem",
      titulo: "Seu nome fica registrado",
      texto: "Cada documento aprovado e cada senha aberta guarda quem fez e quando. Por isso o " +
             "acesso é nominal: confira aqui em cima que é você antes de conferir documento." }
  ];

  /* Abre sozinho na primeira vez. Se a pessoa sair no meio, conta
     como visto — quem já entendeu não precisa ser interrompido de
     novo, e o botão traz de volta. */
  function abrirTutorial() {
    var FB = global.FB;
    if (!global.Tour || global.Tour.aberto) return;
    global.Tour.iniciar({
      passos: PASSOS,
      aoFim: function () { if (FB && FB.marcarTutorialEquipe) FB.marcarTutorialEquipe("painel"); }
    });
  }

  function talvezTutorial() {
    var FB = global.FB;
    if (!global.Tour || !FB || !FB.equipe) return;
    if (FB.tutorialEquipeVisto("painel")) return;
    /* Deixa a tela assentar antes de escurecer tudo: abrir o
       tutorial em cima de um painel meio desenhado aponta para
       lugares que ainda vão mudar de posição. */
    setTimeout(function () {
      if (FB.equipe && !FB.tutorialEquipeVisto("painel")) abrirTutorial();
    }, 1200);
  }

  /* ---------- Entrar e sair ---------- */
  function mostrarPainel(dentro) {
    var painel = $("#painel"), porta = $("#pnPorta"), tabbar = $("#pnTabbar");
    if (painel) painel.hidden = !dentro;
    if (porta) porta.hidden = dentro;
    if (tabbar) tabbar.hidden = !dentro;
    if (dentro) { aplicar(abaDaURL(), true); talvezTutorial(); }
  }

  function ligar() {
    document.addEventListener("click", function (ev) {
      var t = ev.target.closest("[data-tutorial-painel]");
      if (t) { ev.preventDefault(); abrirTutorial(); return; }

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
