/* ============================================================
   Totali · Portal do Cliente
   shell.js — a casca da aplicação (portal e painel usam a mesma)

   Mobile first, igual ao Agência 100K: no celular o menu vira
   gaveta e há uma barra inferior com as 4 ações principais; a
   partir de 1024 px a sidebar navy fica fixa e recolhível.
   Roteador por hash: #/tela/parametro.
   ============================================================ */
(function (global) {
  "use strict";
  var U = global.U, UI = global.UI, ic = global.ic, Tema = global.Tema;

  var estado = { nav: [], tabbar: [], titulo: "", org: "", usuario: null, badges: {}, aoNavegar: null, aoSair: null, destaque: "", logo: "", subtitulo: "", mini: false };
  var raiz = null;

  function rota() {
    var h = location.hash.replace(/^#\/?/, "");
    var q = {}; var i = h.indexOf("?");
    if (i > -1) { h.slice(i + 1).split("&").forEach(function (p) { var kv = p.split("="); q[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || ""); }); h = h.slice(0, i); }
    var partes = h.split("/").filter(Boolean).map(decodeURIComponent);
    return { nome: partes[0] || "", partes: partes, param: partes[1] || "", sub: partes[2] || "", query: q, hash: "#/" + partes.join("/") };
  }
  function navegar(h) { if (location.hash !== h) location.hash = h; else desenharAtivo(); }

  function sidebarHtml() {
    var grupos = estado.nav.map(function (g) {
      var itens = g.itens.filter(function (i) { return !i.oculto; });
      if (!itens.length) return "";
      return '<div class="sidebar__grupo">' + U.esc(g.grupo) + "</div>" + itens.map(function (i) {
        var b = estado.badges[i.href];
        return '<a class="sidebar__item" href="' + i.href + '" title="' + U.esc(i.rotulo) + '">' + ic(i.icone) + "<span>" + U.esc(i.rotulo) + "</span>" + (i.sensivel ? ic("lock", "cadeado") : "") + (b ? '<span class="sidebar__badge">' + (b > 99 ? "99+" : b) + "</span>" : "") + "</a>";
      }).join("");
    }).join("");
    return '<aside class="sidebar"' + (estado.mini ? " data-mini" : "") + '>' +
      '<div class="puzzle-layer puzzle-menu" aria-hidden="true"></div><div class="sidebar__veu" aria-hidden="true"></div><div class="sidebar__brilho" aria-hidden="true"></div>' +
      '<div class="sidebar__in">' +
        '<div class="sidebar__topo"><a href="#/inicio" title="Tela inicial" style="min-width:0;display:flex;flex-direction:column;gap:4px">' +
          '<img class="sidebar__logo" src="' + (estado.logo || "assets/brand/logo-escuro.png") + '" alt="Totali · Portal do Cliente">' +
          '<img class="sidebar__simbolo" src="assets/brand/simbolo.png" alt="">' +
          '<span class="sidebar__org">' + U.esc(estado.org) + "</span></a>" +
          '<button type="button" class="sidebar__recolher" data-acao="recolher" aria-label="Recolher menu">' + ic("chevron-left", "ic--sm") + "</button></div>" +
        grupos + '<div class="esp"></div>' +
        (estado.destaque || "") +
        '<a class="sidebar__item" href="#/perfil" title="Perfil e preferências">' + ic("settings") + "<span>" + (estado.usuario && estado.usuario.papel !== "cliente" ? "Configurações" : "Perfil") + "</span></a>" +
        '<div class="sidebar__rodape"><span>powered by </span><b>Totali</b></div>' +
      "</div></aside>";
  }
  function tabbarHtml() {
    return '<nav class="tabbar" aria-label="Navegação principal">' + estado.tabbar.map(function (t) {
      if (t.menu) return '<button type="button" class="tabbar__item" data-acao="menu">' + ic("menu") + "Menu</button>";
      var b = estado.badges[t.href];
      return '<a class="tabbar__item" href="' + t.href + '">' + ic(t.icone) + U.esc(t.rotulo) + (b ? '<span class="pontinho">' + (b > 99 ? "99+" : b) + "</span>" : "") + "</a>";
    }).join("") + "</nav>";
  }
  function topbarHtml() {
    var u = estado.usuario || {};
    var bChat = estado.badges["#/chat"] || estado.badges["#/mensagens"] || 0;
    return '<header class="topbar">' +
      '<button type="button" class="topbar__menu" data-acao="menu" aria-label="Abrir menu">' + ic("menu", "ic--lg") + "</button>" +
      '<div class="topbar__titulo" id="topbarTitulo">' + U.esc(estado.titulo) + "</div>" +
      (estado.busca ? '<button type="button" class="topbar__busca" data-acao="busca" aria-label="Buscar">' + ic("search") + "<span>Buscar cliente ou tela…</span><kbd>Ctrl K</kbd></button>" : "") +
      '<div class="topbar__esp"></div>' +
      '<button type="button" class="topbar__btn" data-acao="tema" aria-label="Alternar tema" title="Claro / escuro">' + ic(Tema.escuro() ? "sun" : "moon") + "</button>" +
      '<a class="topbar__btn" href="' + (u.papel === "cliente" ? "#/chat" : "#/mensagens") + '" aria-label="Mensagens">' + ic("bell") + (bChat ? '<span class="pontinho">' + (bChat > 99 ? "99+" : bChat) + "</span>" : "") + "</a>" +
      '<a class="topbar__avatar" href="#/perfil" aria-label="Perfil">' + UI.avatar(u.nome || "?", "avatar--sm " + (u.papel === "cliente" ? "" : "avatar--gold")) + "<span>" + U.esc(U.primeiroNome(u.nome)) + "</span></a>" +
      "</header>";
  }

  function desenhar() {
    /* Redesenhar a casca (badge, destaque, tema) não pode apagar a tela
       que está aberta: o <main> antigo é movido para a casca nova. */
    var antigo = raiz.querySelector("#view");
    raiz.innerHTML =
      '<div class="shell">' +
        '<div class="shell__side">' + sidebarHtml() + "</div>" +
        '<div class="shell__main">' + topbarHtml() + '<main class="shell__conteudo" id="view" tabindex="-1"></main>' + tabbarHtml() + "</div>" +
      "</div>" +
      '<div class="gaveta" id="gaveta"><div class="gaveta__fundo" data-acao="fechar-menu"></div><div class="gaveta__painel">' + sidebarHtml() + "</div></div>";
    if (antigo) raiz.querySelector("#view").replaceWith(antigo);
    desenharAtivo();
  }
  function desenharAtivo() {
    if (!raiz) return;
    var r = rota(); var atual = "#/" + (r.nome || "inicio");
    UI.$$(".sidebar__item, .tabbar__item", raiz).forEach(function (a) {
      var href = a.getAttribute("href") || "";
      var ativo = href && (href === atual || (href !== "#/inicio" && r.nome && href.indexOf("#/" + r.nome) === 0));
      if (ativo) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    var g = UI.$("#gaveta"); if (g) g.removeAttribute("open");
  }

  var Shell = {
    rota: rota, navegar: navegar,
    montar: function (opts) {
      raiz = opts.raiz; Object.assign(estado, opts);
      try { estado.mini = localStorage.getItem("totali-portal-mini") === "1"; } catch (e) {}
      desenhar();
      UI.delegar(raiz, {
        menu: function () { UI.$("#gaveta").setAttribute("open", ""); },
        "fechar-menu": function () { UI.$("#gaveta").removeAttribute("open"); },
        recolher: function () { estado.mini = !estado.mini; try { localStorage.setItem("totali-portal-mini", estado.mini ? "1" : "0"); } catch (e) {} UI.$$(".sidebar", raiz).forEach(function (s) { s.toggleAttribute("data-mini", estado.mini); }); },
        tema: function (b) { Tema.alternar(); b.innerHTML = ic(Tema.escuro() ? "sun" : "moon"); },
        busca: function () { if (estado.aoBuscar) estado.aoBuscar(); }
      });
      global.addEventListener("hashchange", function () { desenharAtivo(); if (estado.aoNavegar) estado.aoNavegar(rota()); });
      document.addEventListener("keydown", function (e) { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k" && estado.aoBuscar) { e.preventDefault(); estado.aoBuscar(); } });
    },
    desmontar: function () { if (raiz) raiz.innerHTML = ""; },
    titulo: function (t) { estado.titulo = t; var el = UI.$("#topbarTitulo"); if (el) el.textContent = t; },
    badge: function (href, n) { estado.badges[href] = n; if (raiz && UI.$(".shell", raiz)) desenhar(); },
    badges: function (obj) { Object.assign(estado.badges, obj); if (raiz && UI.$(".shell", raiz)) desenhar(); },
    redesenhar: function (opts) { if (opts) Object.assign(estado, opts); if (raiz) desenhar(); },
    render: function (html) {
      var v = UI.$("#view"); if (!v) return null;
      v.innerHTML = html; v.scrollTop = 0;
      vigiar(v);
      return v;
    },
    view: function () { return UI.$("#view"); },
    estado: estado
  };
  /* Rede de segurança (23/09/2026): se uma tela fica só no esqueleto de carregamento, é porque uma consulta
     falhou (permissão, índice, rede). Em vez de carregar para sempre, mostra o motivo e um botão para tentar de novo. */
  var vigia = { timer: 0, erro: "" };
  function soEsqueleto(v) { return !!(v && v.querySelector(".esqueleto") && !v.querySelector("h1, h2, .card, form, table, .vazio")); }
  function telaDeErro(v, motivo) {
    if (!soEsqueleto(v)) return;
    v.innerHTML = '<div class="pagina"><div class="card"><div class="card__corpo pilha"><h2>Esta tela não abriu</h2><p class="f-13 txt-2">Algo impediu o carregamento. Tente de novo; se continuar, mande esta mensagem para a Totali pelo chat.</p>' + (motivo ? '<div class="codigo f-12">' + String(motivo).replace(/[<>&]/g, "") .slice(0, 300) + "</div>" : "") + '<div class="linha"><button type="button" class="btn btn--primario btn--sm" id="tentarDeNovo">Tentar de novo</button><a class="btn btn--contorno btn--sm" href="#/inicio">Ir para o início</a></div></div></div></div>';
    var b = v.querySelector("#tentarDeNovo"); if (b) b.addEventListener("click", function () { global.dispatchEvent(new HashChangeEvent("hashchange")); });
  }
  function vigiar(v) {
    clearTimeout(vigia.timer); vigia.erro = "";
    if (!soEsqueleto(v)) return;
    vigia.timer = setTimeout(function () { telaDeErro(v, vigia.erro || "A tela demorou mais de 20 segundos para responder."); }, 20000);
  }
  global.addEventListener("unhandledrejection", function (e) {
    var r = e.reason || {}; vigia.erro = (r.code ? r.code + ": " : "") + (r.message || String(r));
    var v = document.getElementById("view");
    if (soEsqueleto(v)) { clearTimeout(vigia.timer); telaDeErro(v, vigia.erro); }
  });

  global.Shell = Shell;
})(window);
