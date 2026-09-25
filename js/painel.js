/* ============================================================
   Totali · Portal do Cliente
   painel.js — o PAINEL DA EQUIPE (equipe.html)

   O intuito do painel é ALIMENTAR o portal do cliente: cadastrar
   empresas, liberar sistemas, conduzir a jornada de 30 dias,
   responder o chat, conferir documentos, abrir senhas, publicar
   campanhas da vitrine e ver quem usa o quê (para cobrar).

   Telas: inicio · clientes · clientes/:id (abas) · jornadas ·
   mensagens · checklist · vitrine · uso · equipe · conteudo ·
   seguranca · perfil.
   ============================================================ */
(function (global) {
  "use strict";
  var U = global.U, UI = global.UI, ic = global.ic, Dados = global.Dados, Shell = global.Shell, JORNADA = global.JORNADA, CATALOGO = global.CATALOGO, Uso = global.Uso, Chat = global.Chat, Cripto = global.Cripto;

  var TITULO = "Painel da equipe · Portal do Cliente";
  var app = document.getElementById("app");
  var sessao = null, empresas = [], chatAtual = null;
  var MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  function nomeMes(am) { var p = am.split("-"); return MESES[Number(p[1]) - 1] + " de " + p[0]; }
  function admin() { return sessao && sessao.papel === "admin"; }

  /* O que a equipe publica (conteudo/*) só pode ser lido logado: carrega quando a sessão existe, inclusive logo após o login. */
  function carregarConteudo() {
    return Promise.all([Dados.conteudo("jornada"), Dados.conteudo("catalogo"), Dados.conteudo("agenda"), Dados.conteudo("ajuda"), Dados.conteudo("video"), Dados.conteudo("financeiro"), Dados.conteudo("envio")]).then(function (r) { if (r[6] && global.Envio) global.Envio.aplicar(r[6]); if (r[0]) JORNADA.aplicar(r[0]); if (r[1]) CATALOGO.aplicar(r[1]); if (r[2] && global.Agenda) global.Agenda.aplicar(r[2]); if (r[3] && global.Relacionamento) global.Relacionamento.aplicarConteudo(r[3]); if (r[4] && global.Video) global.Video.aplicar(r[4]); if (r[5] && global.Financeiro) global.Financeiro.aplicarCatalogo(r[5]); }).catch(function () {});
  }
  function iniciar() {
    Dados.pronto().then(function () {
      sessao = Dados.sessao();
      (sessao ? carregarConteudo() : Promise.resolve()).then(rotear);
    });
    global.addEventListener("hashchange", rotear);
    document.addEventListener("dados:mudou", function (e) {
      var t = e.detail && e.detail.tipo;
      if (t === "sessao") { var s = Dados.sessao(); if (!!s !== !!sessao || (s && sessao && s.uid !== sessao.uid)) { sessao = s; (s ? carregarConteudo() : Promise.resolve()).then(rotear); } return; }
      if (["mensagem", "remoto", "lidas"].indexOf(t) > -1) atualizarBadges();
      if (t === "remoto") { var r = Shell.rota().nome; if (["inicio", "clientes", "jornadas", "checklist", "uso"].indexOf(r) > -1) rotear(); }
    });
  }
  function carregarEmpresas() { return Dados.listarEmpresas().then(function (l) { empresas = l; return l; }); }
  function rotear() {
    var r = Shell.rota();
    if (r.nome === "sair") { sair(); return; }
    if (!sessao || sessao.papel === "cliente") { document.body.classList.remove("logado"); return telaEntrar(); }
    if (!Shell.view()) { montarShell(); }
    if (chatAtual && !(r.nome === "mensagens" || (r.nome === "clientes" && r.sub === "conversa"))) { chatAtual.destruir(); chatAtual = null; }
    var telas = { "": telaInicio, inicio: telaInicio, clientes: r.param === "novo" ? telaNovoCliente : r.param ? telaCliente : telaClientes, jornadas: telaJornadas, mensagens: telaMensagens, checklist: telaChecklist, vitrine: telaVitrine, uso: telaUso, equipe: telaEquipe, conteudo: telaConteudo, seguranca: telaSeguranca, perfil: telaPerfil, documentos: telaDocumentosGeral };
    carregarEmpresas().then(function () { (telas[r.nome] || (global.TelasPainel || {})[r.nome] || telaInicio)(r); });
  }
  global.Painel = {
    get sessao() { return sessao; }, get empresas() { return empresas; },
    admin: admin, autoFnDe: autoFnDe, mensagemPronta: mensagemPronta, whatsappDe: whatsappDe, carregarAuto: carregarAuto, recarregar: carregarEmpresas, mostrarConvite: mostrarConvite, nomeMes: nomeMes,
    empresa: function (id) { return empresas.filter(function (x) { return x.id === id; })[0] || null; }
  };
  function montarShell() {
    document.body.classList.add("logado");
    Shell.montar({
      raiz: app, org: "Painel da equipe", usuario: sessao, titulo: "Início", busca: true, logo: "assets/brand/logo-escuro.png",
      nav: [
        { grupo: "Atendimento", itens: [
          { href: "#/inicio", rotulo: "Início", icone: "home" },
          { href: "#/clientes", rotulo: "Clientes", icone: "building" },
          { href: "#/mensagens", rotulo: "Mensagens", icone: "chat" },
          { href: "#/documentos", rotulo: "Documentos a conferir", icone: "inbox" },
          { href: "#/jornadas", rotulo: "Onboarding · 30 dias", icone: "route" }
        ] },
        { grupo: "Sistemas", itens: [
          { href: "#/checklist", rotulo: "Envio do mês", icone: "list-check" },
          { href: "#/financeiro", rotulo: "Checklist Financeiro", icone: "credit-card" },
          { href: "#/entrada", rotulo: "Entrada (documentos)", icone: "clipboard" },
          { href: "#/indicacoes", rotulo: "Indicações", icone: "gift" },
          { href: "#/vitrine", rotulo: "Vitrine e campanhas", icone: "megaphone" },
          { href: "#/uso", rotulo: "Uso e cobrança", icone: "bar-chart", sensivel: true }
        ] },
        { grupo: "Administração", itens: [
          { href: "#/conteudo", rotulo: "Conteúdo do portal", icone: "pencil" },
          { href: "#/equipe", rotulo: "Equipe", icone: "users", oculto: !admin() },
          { href: "#/seguranca", rotulo: "Segurança", icone: "shield", oculto: !admin() }
        ] }
      ],
      tabbar: [
        { href: "#/inicio", rotulo: "Início", icone: "home" },
        { href: "#/clientes", rotulo: "Clientes", icone: "building" },
        { href: "#/mensagens", rotulo: "Mensagens", icone: "chat" },
        { href: "#/jornadas", rotulo: "Jornadas", icone: "route" },
        { menu: true }
      ],
      destaque: '<a class="sidebar__destaque" href="#/clientes/novo"><b>' + ic("plus") + "<span>Novo cliente</span></b><small>Cadastro e link de convite</small><span class=\"cta\">Cadastrar</span></a>",
      aoBuscar: abrirBusca
    });
    atualizarBadges();
    if (global.Notificacoes) global.Notificacoes.iniciar({ uid: sessao.uid, lado: "equipe" });
    if (global.Tour) setTimeout(function () { global.Tour.talvez("painel-inicio"); }, 800);
  }
  function atualizarBadges() {
    Dados.todasConversas().then(function (cs) { var n = U.soma(cs, function (c) { return c.naoLidas; }); Shell.badge("#/mensagens", n); UI.titulo(TITULO, n); });
  }
  function sair() { if (chatAtual) { chatAtual.destruir(); chatAtual = null; } Dados.sair().then(function () { sessao = null; location.hash = "#/entrar"; rotear(); }); }

  function abrirBusca() {
    var m = UI.modal({ titulo: "Buscar", corpo: '<input class="input" id="qBusca" placeholder="Cliente, CNPJ ou tela…" autocomplete="off"><div class="lista mt-8" id="resBusca"></div>' });
    var q = UI.$("#qBusca", m.corpo), res = UI.$("#resBusca", m.corpo);
    var telas = [["#/clientes", "Clientes", "building"], ["#/mensagens", "Mensagens", "chat"], ["#/jornadas", "Jornadas", "route"], ["#/checklist", "Envio do mês", "list-check"], ["#/vitrine", "Vitrine", "megaphone"], ["#/uso", "Uso e cobrança", "bar-chart"], ["#/conteudo", "Conteúdo", "pencil"], ["#/clientes/novo", "Novo cliente", "plus"]];
    function desenhar() {
      var t = q.value.trim().toLowerCase();
      var emps = empresas.filter(function (e) { return !t || (e.fantasia + " " + e.nome + " " + e.cnpj).toLowerCase().indexOf(t) > -1; }).slice(0, 6);
      var ts = telas.filter(function (x) { return !t || x[1].toLowerCase().indexOf(t) > -1; }).slice(0, 4);
      res.innerHTML = emps.map(function (e) { return '<a class="lista__item" href="#/clientes/' + e.id + '" data-acao="ir">' + UI.avatar(e.fantasia, "avatar--sm") + '<div class="lista__texto"><span class="lista__titulo">' + U.esc(e.fantasia) + '</span><span class="lista__sub">' + U.esc(e.cnpj) + " · " + U.esc(e.regime) + "</span></div></a>"; }).join("") + ts.map(function (x) { return '<a class="lista__item" href="' + x[0] + '" data-acao="ir">' + ic(x[2]) + '<div class="lista__texto"><span class="lista__titulo">' + x[1] + "</span></div></a>"; }).join("");
    }
    q.addEventListener("input", desenhar); desenhar();
    UI.delegar(m.corpo, { ir: function (a) { location.hash = a.getAttribute("href"); m.fechar(); } });
  }

  /* ============================================================
     Login
     ============================================================ */
  function telaEntrar() {
    Shell.desmontar();
    var demo = Dados.ehDemo();
    app.innerHTML = '<div class="login"><section class="login__painel"><div class="puzzle-layer puzzle-login"><div class="puzzle-piece" aria-hidden="true"></div></div><div class="veu"></div><div class="brilho"></div>' +
      '<img class="login__logo-painel" src="assets/brand/logo-escuro.png" alt="Totali · Portal do Cliente">' +
      '<h1 class="login__frase">O painel que <b>alimenta</b> o portal do cliente.</h1>' +
      '<p class="login__desc">Cadastre, libere sistemas, conduza os 30 dias de cada cliente, confira documentos e saiba quem usa o quê.</p>' +
      '<ol class="login__etapas">' + [["done", "Cadastrar o cliente e enviar o convite"], ["done", "Conduzir a jornada de 30 dias"], ["now", "Conferir documentos e responder o chat"], ["", "Liberar sistemas e publicar campanhas"], ["", "Medir o uso e cobrar"]].map(function (e) { return '<li class="login__etapa" data-e="' + e[0] + '"><i>' + (e[0] === "done" ? ic("check", "ic--sm") : "") + "</i><span>" + e[1] + "</span></li>"; }).join("") + "</ol>" +
      '<div class="login__powered">powered by <b>Totali</b></div></section>' +
      '<section class="login__form"><form class="login__caixa" id="formEntrar" novalidate><img class="login__logo" src="assets/brand/logo-claro.png" alt="Totali · Portal do Cliente"><div><h2 class="login__titulo">Painel da equipe</h2><p class="sub">Uso interno da Totali. Entre com o seu e-mail da equipe.</p></div>' +
      '<div class="campo"><label class="campo__rotulo" for="email">E-mail</label><div class="input--icone">' + ic("mail") + '<input class="input" id="email" type="email" autocomplete="email" required></div></div>' +
      '<div class="campo"><label class="campo__rotulo" for="senha">Senha</label><div class="input--icone">' + ic("key") + '<input class="input" id="senha" type="password" autocomplete="current-password" required></div></div>' +
      '<p class="campo__erro" id="erroEntrar" hidden role="alert"></p><button class="btn btn--primario btn--bloco" type="submit" style="height:44px">Entrar</button>' +
      (demo ? '<div class="aviso aviso--info mt-8">' + ic("info") + '<div><b>Modo demonstração</b>Dados fictícios, só neste navegador.</div></div><div class="login__demo"><button type="button" class="chip" data-acao="demo" data-qual="admin">Entrar como administrador</button><button type="button" class="chip" data-acao="demo" data-qual="equipe">Entrar como Marina (fiscal)</button></div>' : "") +
      "</form>" + '<div class="login__copy">© ' + new Date().getFullYear() + " Totali Soluções Contábeis</div></section></div>";
    var erro = UI.$("#erroEntrar");
    UI.delegar(app, { demo: function (b) { Dados.entrarDemo(b.dataset.qual).then(function (s) { sessao = s; location.hash = "#/inicio"; rotear(); }).catch(function (e) { erro.textContent = e.message; erro.hidden = false; }); } });
    UI.$("#formEntrar").addEventListener("submit", function (e) {
      e.preventDefault(); erro.hidden = true;
      Dados.entrar(UI.$("#email").value, UI.$("#senha").value).then(function (s) { sessao = s; location.hash = "#/inicio"; rotear(); }).catch(function (err) { erro.textContent = err.message; erro.hidden = false; });
    });
  }

  /* ============================================================
     Início: o que precisa de você hoje
     ============================================================ */
  function telaInicio() {
    Shell.titulo("Início");
    Shell.render(UI.esqueleto(8));
    var semana = Date.now() - 7 * U.DIA_MS;
    Promise.all([Dados.todasConversas(), Dados.todosDocumentos(), Dados.usos({ desde: semana }), Dados.listarChecklists(U.anoMes(Date.now()))]).then(function (r) {
      var convs = r[0], docs = r[1], usos = r[2], checks = r[3];
      var naoLidas = U.soma(convs, function (c) { return c.naoLidas; });
      var aConferir = docs.filter(function (d) { return d.situacao === "enviado" || d.situacao === "analise"; });
      var jornadas = empresas.map(function (e) { var rs = JORNADA.resumo(e.jornada, autoFnDe(e), "equipe"); return { e: e, r: rs }; }).filter(function (x) { return !x.r.concluida; });
      var atrasadas = jornadas.filter(function (x) { return x.r.atrasados > 0; });
      var hoje = jornadas.filter(function (x) { return x.r.dias.some(function (d) { return d.estado === "hoje"; }); });
      var ativos = U.unicos(usos.map(function (u) { return u.empresaId; })).length;
      var checkOk = checks.filter(function (c) { return c.concluidoEm; }).length;
      var porDia = Uso.porDia(usos, 7);
      var max = Math.max.apply(null, Object.keys(porDia).map(function (k) { return porDia[k]; }).concat([1]));
      Shell.render('<div class="pagina"><div class="cabecalho"><div><div class="cabecalho__kicker">' + U.esc(U.diaSemana(Date.now())) + "</div><h1>" + U.saudacao() + ", " + U.esc(U.primeiroNome(sessao.nome)) + "</h1><p>O que precisa de você hoje, em ordem de urgência.</p></div><div class=\"cabecalho__acoes\"><a class=\"btn btn--primario\" href=\"#/clientes/novo\">" + ic("plus") + "Novo cliente</a></div></div>" +
        '<div class="grade grade--4">' +
          kpi("#/mensagens", "chat", naoLidas, "mensagens sem resposta", naoLidas ? "erro" : "") +
          kpi("#/documentos", "inbox", aConferir.length, "documentos a conferir", aConferir.length ? "aviso" : "") +
          kpi("#/jornadas", "route", atrasadas.length, "jornadas com atraso", atrasadas.length ? "erro" : "") +
          kpi("#/uso", "activity", ativos + "/" + empresas.length, "clientes ativos na semana", "gold") +
        "</div>" +
        '<div class="grade grade--lado"><div class="pilha">' +
          '<div class="card"><div class="card__cab"><h2>Jornadas: o que vence hoje ou atrasou</h2><a class="btn btn--xs btn--contorno" href="#/jornadas">Ver todas</a></div><div class="lista" style="padding-top:6px">' + (atrasadas.concat(hoje.filter(function (h) { return atrasadas.indexOf(h) === -1; })).slice(0, 6).map(function (x) { var d = x.r.dias.filter(function (y) { return y.estado === "atrasado" || y.estado === "hoje"; })[0]; var dia = JORNADA.por(d.id); return '<a class="lista__item" href="#/clientes/' + x.e.id + '/jornada">' + UI.avatar(x.e.fantasia, "avatar--sm") + '<div class="lista__texto"><span class="lista__titulo">' + U.esc(x.e.fantasia) + " · D" + dia.dia + " " + U.esc(dia.titulo) + '</span><span class="lista__sub">' + U.esc(dia.quem) + " · " + d.feitos + "/" + d.total + " passos</span></div>" + (d.estado === "atrasado" ? UI.badge(d.diasAtraso + "d atraso", "erro", "clock") : UI.badge("hoje", "gold")) + "</a>"; }).join("") || '<div class="card__corpo txt-2 f-13">Nenhuma jornada vencendo hoje.</div>') + "</div></div>" +
          '<div class="card"><div class="card__cab"><h2>Mensagens sem resposta</h2><a class="btn btn--xs btn--contorno" href="#/mensagens">Abrir caixa</a></div><div class="lista" style="padding-top:6px">' + (convs.filter(function (c) { return c.naoLidas; }).slice(0, 5).map(function (c) { return '<a class="lista__item" href="#/mensagens/' + c.empresaId + '">' + UI.avatar(c.empresa, "avatar--sm") + '<div class="lista__texto"><span class="lista__titulo">' + U.esc(c.empresa) + '</span><span class="lista__sub">' + U.esc(c.ultima ? c.ultima.texto || "Anexo" : "") + '</span></div><span class="badge badge--erro">' + c.naoLidas + '</span><span class="lista__meta">' + (c.ultima ? U.relativo(c.ultima.em) : "") + "</span></a>"; }).join("") || '<div class="card__corpo txt-2 f-13">Caixa zerada.</div>') + "</div></div>" +
          '<div class="card"><div class="card__cab"><h2>Documentos a conferir</h2><a class="btn btn--xs btn--contorno" href="#/documentos">Ver todos</a></div><div class="lista" style="padding-top:6px">' + (aConferir.slice(0, 5).map(function (d) { var e = empresas.filter(function (x) { return x.id === d.empresaId; })[0] || {}; return '<a class="lista__item" href="#/clientes/' + d.empresaId + '/documentos">' + ic("file") + '<div class="lista__texto"><span class="lista__titulo">' + U.esc(d.nome) + '</span><span class="lista__sub">' + U.esc(e.fantasia || "") + " · " + (d.origem === "anterior" ? "contabilidade anterior" : "cliente") + " · " + U.relativo(d.em) + "</span></div></a>"; }).join("") || '<div class="card__corpo txt-2 f-13">Nada para conferir.</div>') + "</div></div>" +
        '</div><div class="pilha">' +
          '<div class="card"><div class="card__cab"><h2>Uso do portal · 7 dias</h2></div><div class="card__corpo" style="padding-top:10px"><div style="display:flex;gap:4px;align-items:flex-end;height:80px">' + Object.keys(porDia).map(function (k) { var v = porDia[k]; return '<div title="' + k + ": " + v + '" style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:4px;height:100%"><div style="width:100%;border-radius:4px 4px 0 0;background:var(--primary);height:' + Math.max(4, Math.round(v / max * 64)) + 'px"></div><span class="f-12 txt-mudo">' + k.slice(0, 2) + "</span></div>"; }).join("") + '</div><p class="f-12 txt-2 mt-8">' + usos.filter(function (u) { return u.tipo === "abrir"; }).length + " aberturas de sistema · " + ativos + " empresas ativas</p></div></div>" +
          (function () { var notas = []; empresas.forEach(function (e) { (e.nps || []).forEach(function (n) { notas.push(n.nota); }); }); if (!notas.length) return ""; var prom = notas.filter(function (n) { return n >= 9; }).length, det = notas.filter(function (n) { return n <= 6; }).length; var nps = Math.round((prom - det) / notas.length * 100); return '<div class="card kpi kpi--gold"><span class="kpi__rotulo">' + ic("heart") + 'NPS (' + notas.length + ' respostas)</span><span class="kpi__valor">' + nps + '</span><span class="kpi__delta txt-2">' + prom + " promotores · " + det + " detratores</span></div>"; })() +
          '<div class="card"><div class="card__cab"><h2>Envio de ' + nomeMes(U.anoMes(Date.now())).split(" de ")[0] + '</h2><a class="btn btn--xs btn--contorno" href="#/checklist">Detalhar</a></div><div class="card__corpo" style="padding-top:10px"><div class="f-800" style="font-size:26px">' + checkOk + ' <small class="f-13 txt-2">de ' + empresas.filter(function (e) { return (e.liberacoes || {}).checklist && e.liberacoes.checklist.ativo; }).length + " concluíram</small></div>" + UI.barra(U.pct(checkOk, empresas.length || 1), "barra--ok") + "</div></div>" +
          '<div class="card card--navy"><div class="puzzle-layer" aria-hidden="true"></div><div class="veu"></div><div class="card__corpo pilha"><div class="f-12" style="color:var(--sidebar-muted);font-weight:800;letter-spacing:.1em;text-transform:uppercase">Atalhos</div><a class="btn btn--sm btn--gold" href="#/clientes/novo">' + ic("plus") + 'Cadastrar cliente</a><a class="btn btn--sm btn--contorno" style="background:rgba(255,255,255,.08);color:#fff;border-color:rgba(255,255,255,.2)" href="#/vitrine">' + ic("megaphone") + 'Nova campanha</a><a class="btn btn--sm btn--contorno" style="background:rgba(255,255,255,.08);color:#fff;border-color:rgba(255,255,255,.2)" href="#/uso">' + ic("download") + "Exportar uso (CSV)</a></div></div>" +
        "</div></div></div>");
    });
    function kpi(href, icone, valor, rotulo, tipo) { return '<a class="card card--clicavel kpi entra' + (tipo === "gold" ? " kpi--gold" : "") + '" href="' + href + '" style="text-decoration:none;color:inherit"><span class="kpi__rotulo">' + ic(icone) + rotulo + '</span><span class="kpi__valor' + (tipo === "erro" ? " txt-erro" : tipo === "aviso" ? " txt-aviso" : "") + '">' + valor + "</span></a>"; }
  }

  /* Fatos automáticos da jornada, avaliados com os dados da empresa (o painel tem documentos e credenciais carregados sob demanda) */
  var cacheAuto = {};
  function autoFnDe(e) {
    var c = cacheAuto[e.id] || {};
    return function (id) {
      switch (id) {
        case "cadastro": return true;
        case "convite": return true;
        case "entrou": return (e.acessos || []).length > 0;
        case "canal": return !!e.canalPreferido;
        case "certificado": return (c.docs || []).some(function (d) { return d.grupo === "certificado" && d.situacao !== "pendencia"; });
        case "senhas": return (c.creds || []).length > 0;
        case "documentos": return (c.docs || []).filter(function (d) { return d.origem === "cliente"; }).length >= 3;
        case "anterior": return (c.docs || []).some(function (d) { return d.origem === "anterior"; });
        case "migracao": return !!e.migracaoConcluidaEm;
        case "trilha": return !!(e.marcos && e.marcos.academy);
        case "relatorios": return !!e.formaRelatorio;
        case "feedback": return !!(c.feedback && c.feedback.texto) || !!(e.feedback30 && e.feedback30.texto);
        default: return false;
      }
    };
  }
  function carregarAuto(e) { return Promise.all([Dados.documentos(e.id), Dados.credenciais(e.id), Dados.feedback(e.id)]).then(function (r) { cacheAuto[e.id] = { docs: r[0], creds: r[1], feedback: r[2] }; return cacheAuto[e.id]; }); }

  /* ============================================================
     Clientes
     ============================================================ */
  function telaClientes() {
    Shell.titulo("Clientes");
    var lista = empresas.map(function (e) { var jr = JORNADA.resumo(e.jornada, autoFnDe(e), "equipe"); return { e: e, jr: jr }; });
    Shell.render('<div class="pagina"><div class="cabecalho"><div><div class="cabecalho__kicker">Atendimento</div><h1>Clientes</h1><p>' + empresas.length + " empresas no portal. Toque para abrir a ficha.</p></div><div class=\"cabecalho__acoes\"><input class=\"input\" id=\"filtro\" placeholder=\"Filtrar…\" style=\"min-height:36px;width:200px\"><a class=\"btn btn--primario\" href=\"#/clientes/novo\">" + ic("plus") + "Novo cliente</a></div></div>" +
      '<div class="tabela-wrap"><table class="tabela" id="tabClientes"><thead><tr><th>Empresa</th><th>Regime · trilha</th><th>Responsáveis</th><th>Jornada</th><th>Sistemas</th><th>Acesso</th></tr></thead><tbody>' + lista.map(function (x) {
        var e = x.e, jr = x.jr; var libs = Object.keys(e.liberacoes || {}).filter(function (k) { return e.liberacoes[k].ativo; });
        var ult = Math.max.apply(null, (e.acessos || []).map(function (a) { return U.ms(a.ultimoAcesso) || 0; }).concat([0]));
        return '<tr data-busca="' + U.esc((e.fantasia + " " + e.nome + " " + e.cnpj + " " + CATALOGO.responsaveisTexto(e)).toLowerCase()) + '" style="cursor:pointer" data-acao="abrir" data-id="' + e.id + '"><td><div class="linha" style="flex-wrap:nowrap">' + UI.avatar(e.fantasia, "avatar--sm") + '<div class="lista__texto"><b>' + U.esc(e.fantasia) + '</b><span class="lista__sub num">' + U.esc(e.cnpj) + '</span></div></div></td><td class="f-13">' + U.esc(e.regime) + ' · <b>' + U.esc(e.trilha || "A") + '</b></td><td class="f-13">' + respHtml(e) + '</td><td style="min-width:140px">' + (jr.concluida ? UI.badge("concluída", "ok", "check") : '<div class="f-12 txt-2">D' + jr.diaHoje + " · " + jr.pct + "%" + (jr.atrasados ? ' · <span class="txt-erro f-700">' + jr.atrasados + " atraso</span>" : "") + "</div>" + UI.barra(jr.pct, jr.atrasados ? "" : "barra--gold")) + '</td><td class="f-12">' + libs.map(function (k) { var s = CATALOGO.por(k); return s ? '<span class="badge" title="' + U.esc(s.nome) + '" style="margin:1px">' + U.esc(s.nome.split(" ")[0]) + "</span>" : ""; }).join("") + '</td><td class="f-12 txt-2">' + ((e.acessos || []).length ? (ult ? U.relativo(ult) : "nunca entrou") : '<span class="txt-aviso f-700">sem acesso</span>') + "</td></tr>";
      }).join("") + "</tbody></table></div></div>");
    var v = Shell.view();
    UI.$("#filtro", v).addEventListener("input", function () { var t = this.value.toLowerCase(); UI.$$("#tabClientes tbody tr", v).forEach(function (tr) { tr.hidden = t && tr.dataset.busca.indexOf(t) === -1; }); });
    UI.delegar(v, { abrir: function (tr) { location.hash = "#/clientes/" + tr.dataset.id; } });
  }

  function telaNovoCliente() {
    Shell.titulo("Novo cliente");
    Shell.render('<div class="pagina" style="max-width:720px"><div class="cabecalho"><div><div class="cabecalho__kicker">Cadastro</div><h1>Novo cliente</h1><p>Cadastre a empresa e gere o link de convite. O D0 da jornada nasce marcado: proposta aceita e cadastro criado.</p></div></div>' +
      '<form class="card" id="fNovo" novalidate><div class="card__corpo pilha">' +
        '<div class="grade grade--2"><div class="campo"><label class="campo__rotulo" for="nome">Razão social</label><input class="input" id="nome" required></div><div class="campo"><label class="campo__rotulo" for="fantasia">Nome fantasia</label><input class="input" id="fantasia"></div>' +
        '<div class="campo"><label class="campo__rotulo" for="cnpj">CNPJ</label><input class="input num" id="cnpj" inputmode="numeric" required></div><div class="campo"><label class="campo__rotulo" for="regime">Regime</label><select class="select" id="regime"><option>MEI</option><option selected>Simples Nacional</option><option>Lucro Presumido</option><option>Lucro Real</option></select></div>' +
        '<div class="campo"><label class="campo__rotulo" for="trilha">Trilha da jornada</label><select class="select" id="trilha"><option value="A">A · simples</option><option value="B">B · folha, presumido ou mais de um sócio</option><option value="C">C · real, grupo ou pendências</option></select><span class="campo__ajuda" id="ajTrilha">' + U.esc(JORNADA.TRILHAS.A) + '</span></div><div class="campo"><label class="campo__rotulo" for="aceite">Data do aceite da proposta</label><input class="input" id="aceite" type="date" value="' + new Date().toISOString().slice(0, 10) + '"><span class="campo__ajuda">O relógio dos 30 dias conta a partir daqui.</span></div></div>' +
        '<div class="campo"><span class="campo__rotulo">Perfil (define quais sistemas fazem sentido na vitrine)</span><div class="linha">' + CATALOGO.PERFIS.filter(function (p) { return p.id !== "todos"; }).map(function (p) { return '<label class="checar"><input type="checkbox" name="perfil" value="' + p.id + '"> ' + U.esc(p.rotulo) + "</label>"; }).join("") + "</div></div>" +
        '<div class="campo"><span class="campo__rotulo">Liberar de início</span><div class="linha">' + CATALOGO.visiveis().filter(function (s) { return s.status !== "breve" && s.id !== "academy"; }).map(function (s) { return '<label class="checar"><input type="checkbox" name="lib" value="' + s.id + '"> ' + U.esc(s.nome) + "</label>"; }).join("") + '</div><span class="campo__ajuda">Envio do mês e Academy já vêm para todo cliente. Os demais você também libera depois, na ficha.</span></div>' +
        '<div class="campo"><span class="campo__rotulo">Responsáveis por setor (opcional)</span><div class="grade grade--2" style="gap:8px">' + CATALOGO.SETORES.map(function (s) { return '<label class="f-12 txt-2">' + s[1] + '<select class="select mt-4" name="nResp" data-setor="' + s[0] + '"><option value="">—</option></select></label>'; }).join("") + '</div><span class="campo__ajuda">Aparecem para o cliente em "Quem cuida da sua empresa". Dá para mudar depois na ficha.</span></div>' +
        '<p class="campo__erro" id="erroNovo" hidden></p><div class="modal__acoes"><a class="btn btn--contorno" href="#/clientes">Cancelar</a><button class="btn btn--primario" type="submit">' + ic("check") + "Cadastrar e gerar convite</button></div></div></form></div>");
    var v = Shell.view();
    UI.$("#cnpj", v).addEventListener("input", function () { this.value = U.cnpj(this.value); });
    UI.$("#trilha", v).addEventListener("change", function () { UI.$("#ajTrilha", v).textContent = JORNADA.TRILHAS[this.value]; });
    Dados.equipe().then(function (eq) { UI.$$("[name=nResp]", v).forEach(function (sel) { var setor = sel.dataset.setor; eq.slice().sort(function (a, b) { return ((b.setores || []).indexOf(setor) > -1) - ((a.setores || []).indexOf(setor) > -1); }).forEach(function (m) { var o = document.createElement("option"); o.value = m.uid; o.textContent = m.nome; sel.appendChild(o); }); }); });
    UI.$("#fNovo", v).addEventListener("submit", function (e) {
      e.preventDefault(); var erro = UI.$("#erroNovo", v); erro.hidden = true;
      var nome = UI.$("#nome", v).value.trim(), cnpj = UI.$("#cnpj", v).value.trim();
      if (!nome) { erro.textContent = "Informe a razão social."; erro.hidden = false; return; }
      if (!U.cnpjValido(cnpj)) { erro.textContent = "CNPJ inválido."; erro.hidden = false; return; }
      var perfis = UI.$$('[name=perfil]:checked', v).map(function (i) { return i.value; }), libs = UI.$$('[name=lib]:checked', v).map(function (i) { return i.value; });
      var aceite = new Date(UI.$("#aceite", v).value + "T09:00:00").getTime() || Date.now();
      var resp = {}; UI.$$("[name=nResp]", v).forEach(function (sel) { if (sel.value) resp[sel.dataset.setor] = { uid: sel.value, nome: sel.options[sel.selectedIndex].textContent }; });
      Dados.criarEmpresa({ nome: nome, fantasia: UI.$("#fantasia", v).value.trim() || nome, cnpj: cnpj, regime: UI.$("#regime", v).value, trilha: UI.$("#trilha", v).value, perfis: perfis, aceiteEm: aceite, responsaveis: resp }, sessao).then(function (r) {
        return Promise.all(libs.filter(function (l) { return l !== "academy"; }).map(function (l) { return Dados.liberar(r.empresa.id, l, { ativo: true, plano: "mensal" }, sessao); })).then(function () { return r; });
      }).then(function (r) { mostrarConvite(r.empresa, r.convite); UI.toast("Cliente cadastrado. D0 marcado na jornada.", "ok"); }).catch(function (err) { erro.textContent = err.message; erro.hidden = false; });
    });
  }
  function linkConvite(codigo) { return location.origin + location.pathname.replace(/equipe\.html$/, "") + "index.html#/convite/" + codigo; }
  function mostrarConvite(e, codigo) {
    var link = linkConvite(codigo);
    var msg = "Olá! Aqui é da Totali. Criamos o portal da " + e.fantasia + ". Entre por este link para criar sua senha e acompanhar seus primeiros 30 dias com a gente: " + link;
    UI.modal({ titulo: "Convite do portal · " + e.fantasia, corpo: '<p class="f-13 txt-2">O link vale uma vez: ao abrir, o cliente cria a senha e o convite é queimado.</p><div class="codigo mt-8">' + U.esc(link) + '</div><div class="campo mt-12"><span class="campo__rotulo">Mensagem sugerida</span><textarea class="textarea" id="msgConv">' + U.esc(msg) + '</textarea></div><div class="campo"><label class="campo__rotulo" for="convEmail">E-mail do cliente (para enviar por e-mail)</label><input class="input" id="convEmail" type="email" placeholder="cliente@empresa.com.br"></div>',
      acoes: [{ rotulo: "Copiar link", icone: "copy", manter: true, ao: function () { UI.copiar(link, "Link copiado."); } }, { rotulo: "Copiar mensagem", icone: "copy", manter: true, ao: function (c) { UI.copiar(c.querySelector("#msgConv").value, "Mensagem copiada."); } }, { rotulo: "Abrir no WhatsApp", classe: "btn--gold", icone: "whatsapp", manter: true, ao: function (c) { global.open("https://wa.me/" + whatsappDe(e) + "?text=" + encodeURIComponent(c.querySelector("#msgConv").value), "_blank", "noopener"); } }, { rotulo: "Enviar por e-mail", icone: "mail", manter: true, ao: function (c) { var para = c.querySelector("#convEmail").value.trim(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(para)) { UI.toast("Informe o e-mail do cliente.", "aviso"); c.querySelector("#convEmail").focus(); return; } UI.toast("Enviando o convite…", "info"); Dados.pedirAoServidor("pedidosDeEmail", { tipo: "convite", para: para, empresaId: e.id, texto: c.querySelector("#msgConv").value, link: link }, 60000).then(function () { UI.toast("Convite enviado para " + para + ".", "ok"); }).catch(function (err) { UI.toast(err.message, "erro", null, 9000); }); } }, { rotulo: "Ir para a ficha", classe: "btn--primario", ao: function () { location.hash = "#/clientes/" + e.id; } }] });
  }

  /* ---------- Ficha do cliente ---------- */
  function telaCliente(r) {
    var e = empresas.filter(function (x) { return x.id === r.param; })[0];
    if (!e) return telaClientes();
    var aba = r.sub || "visao";
    Shell.titulo(e.fantasia);
    var abas = [["visao", "Visão geral", "eye"], ["liberacoes", "Liberações", "unlock"], ["jornada", "Jornada", "route"], ["entrada", "Entrada", "clipboard"], ["financeiro", "Financeiro", "credit-card"], ["documentos", "Documentos", "folder"], ["cofre", "Cofre", "key"], ["conversa", "Conversa", "chat"], ["uso", "Uso", "bar-chart"]];
    Shell.render('<div class="pagina pagina--larga" style="padding-bottom:0"><div class="cabecalho"><div class="linha" style="flex-wrap:nowrap;gap:12px">' + UI.avatar(e.fantasia, "avatar--lg") + '<div><div class="cabecalho__kicker">' + U.esc(e.regime) + " · trilha " + U.esc(e.trilha || "A") + "</div><h1>" + U.esc(e.fantasia) + '</h1><p class="f-13">' + U.esc(e.nome) + ' · <span class="num">' + U.esc(e.cnpj) + "</span>" + (CATALOGO.responsaveisTexto(e) ? " · " + U.esc(CATALOGO.responsaveisTexto(e)) : "") + "</p></div></div>" +
      '<div class="cabecalho__acoes"><a class="btn btn--sm btn--contorno" href="#/mensagens/' + e.id + '">' + ic("chat") + 'Chat</a><button type="button" class="btn btn--sm btn--contorno" data-acao="convite">' + ic("link") + 'Convite</button><button type="button" class="btn btn--sm btn--contorno" data-acao="anterior">' + ic("upload") + 'Link p/ contab. anterior</button><button type="button" class="btn btn--sm btn--fantasma" data-acao="editar">' + ic("pencil") + "Editar</button>" + (admin() ? '<button type="button" class="btn btn--sm btn--fantasma" data-acao="mais" aria-label="Mais">' + ic("more") + "</button>" : "") + "</div></div>" +
      '<div class="abas" role="tablist">' + abas.map(function (a) { return '<a role="tab" href="#/clientes/' + e.id + "/" + a[0] + '" aria-selected="' + (aba === a[0]) + '" class="btn btn--fantasma" style="border-radius:0;min-height:40px">' + ic(a[2], "ic--sm") + a[1] + "</a>"; }).join("") + '</div></div><div id="abaCorpo"></div>');
    var v = Shell.view();
    UI.delegar(v, {
      convite: function () { Dados.criarConvite(e.id, sessao).then(function (c) { mostrarConvite(e, c); }); },
      anterior: function () { Dados.criarLinkAnterior(e.id, sessao).then(function (c) { var link = location.origin + location.pathname.replace(/equipe\.html$/, "") + "anterior.html?c=" + c; UI.modal({ titulo: "Link para a contabilidade anterior", corpo: '<p class="f-13 txt-2">Página de envio sem login. Quem tiver o link envia contrato, balanços, livros e folha; os arquivos entram na ficha como origem "contabilidade anterior" e o cliente vê chegar.</p><div class="codigo mt-8">' + U.esc(link) + '</div><textarea class="textarea mt-12" id="msgAnt">Prezados, aqui é da Totali Soluções Contábeis. Assumimos a contabilidade da ' + U.esc(e.fantasia) + '. Para a transferência de responsabilidade técnica, pedimos a gentileza de enviar os documentos por este link seguro: ' + U.esc(link) + "</textarea>", acoes: [{ rotulo: "Copiar link", icone: "copy", manter: true, ao: function () { UI.copiar(link); } }, { rotulo: "Copiar mensagem", classe: "btn--primario", ao: function (c) { UI.copiar(c.querySelector("#msgAnt").value, "Mensagem copiada."); } }] }); }); },
      editar: function () { editarEmpresa(e); },
      mais: function () { if (global.FichaMais) global.FichaMais(e); }
    });
    var corpo = UI.$("#abaCorpo", v);
    var abasExtra = global.AbasFicha || {};
    ({ visao: abaVisao, liberacoes: abaLiberacoes, jornada: abaJornada, documentos: abaDocumentos, cofre: abaCofre, conversa: abaConversa, uso: abaUso }[aba] || abasExtra[aba] || abaVisao)(e, corpo, r);
  }
  /* Responsáveis por setor em duas linhas curtas: "Marina Santos · Fiscal" */
  function respHtml(e) {
    var l = CATALOGO.responsaveis(e);
    return l.length ? l.map(function (p) { return '<div style="white-space:nowrap">' + U.esc(p.nome) + ' <span class="txt-2">· ' + U.esc(p.rotulo) + "</span></div>"; }).join("") : '<span class="txt-2">—</span>';
  }
  /* A trilha de auditoria em português de gente (o código técnico continua gravado e sai no CSV) */
  var FRASES = { "liberacao:ativada": "Liberou o sistema", "liberacao:desativada": "Desligou o sistema", "documento:enviado": "Documento enviado", "documento:aprovado": "Documento aprovado", "documento:correcao": "Pediu correção do documento", "documento:visto": "Documento visto pela equipe", "documento:removido": "Documento removido", "credencial:guardada": "Senha guardada no cofre", "credencial:aberta": "Senha aberta pela equipe", "credencial:removida": "Senha removida do cofre", "acesso:criado": "Cliente criou o acesso ao portal", "acesso:revogado": "Acesso ao portal retirado", "jornada:concluida": "Jornada de 30 dias concluída", "empresa:criada": "Cliente cadastrado", "conta:apagada": "Conta apagada", "equipe:entrou": "Entrou na equipe", "equipe:saiu": "Saiu da equipe" };
  function frasePara(a) {
    var nomes = { checklist: "Envio do mês" }; (CATALOGO.SISTEMAS || []).forEach(function (s) { nomes[s.id] = s.nome; });
    var d = a.tipo && a.tipo.indexOf("liberacao:") === 0 ? (nomes[a.detalhe] || a.detalhe) : (a.detalhe || a.chave || "");
    return (FRASES[a.tipo] || a.tipo || "Registro") + (d ? ": " + d : "");
  }
  /* WhatsApp do cliente: o da ficha (Editar) ou o que ele informou no Perfil do portal. Só dígitos, com 55. */
  function whatsappDe(e) {
    var n = String((e && e.whatsapp) || ((e && e.acessos) || []).map(function (a) { return a.whatsapp; }).filter(Boolean)[0] || "").replace(/\D/g, "");
    if (n.length === 10 || n.length === 11) n = "55" + n;
    return n.length >= 12 ? n : "";
  }
  function whatsappTexto(n) { return n ? "+" + n.slice(0, 2) + " (" + n.slice(2, 4) + ") " + n.slice(4, n.length - 4) + "-" + n.slice(-4) : ""; }
  /* Mensagem pronta (pedido do Raoni, 25/09/2026): todo texto que o painel gera para cobrar ou avisar o cliente
     abre aqui, editável, com quatro saídas: copiar, WhatsApp (com o texto pronto), e-mail e chat do portal. */
  function mensagemPronta(e, o) {
    var num = whatsappDe(e);
    UI.modal({ titulo: o.titulo || "Mensagem pronta", larga: true, corpo: '<p class="f-13 txt-2">Revise o texto e escolha por onde mandar. Dá para usar mais de um.</p><textarea class="textarea" id="mpTexto" style="min-height:170px">' + U.esc(o.texto) + '</textarea><div class="f-12 txt-2 mt-4">' + ic("whatsapp", "ic--sm") + " " + (num ? "WhatsApp do cliente: " + whatsappTexto(num) : "Sem WhatsApp do cliente: o WhatsApp abre para você escolher o contato. Cadastre na ficha, em Editar.") + "</div>",
      acoes: [
        { rotulo: "Copiar texto", icone: "copy", manter: true, ao: function (c) { UI.copiar(c.querySelector("#mpTexto").value, "Texto copiado."); } },
        { rotulo: "WhatsApp", icone: "whatsapp", classe: "btn--gold", manter: true, ao: function (c) { global.open("https://wa.me/" + num + "?text=" + encodeURIComponent(c.querySelector("#mpTexto").value), "_blank", "noopener"); } },
        { rotulo: "E-mail", icone: "mail", manter: true, ao: function (c) { UI.toast("Enviando o e-mail…", "info"); Dados.pedirAoServidor("pedidosDeEmail", { tipo: "mensagem", empresaId: e.id, assunto: o.assunto || "Mensagem da Totali", texto: c.querySelector("#mpTexto").value, rota: o.rota || "" }, 60000).then(function (r) { UI.toast("E-mail enviado" + (r && r.enviados ? " para " + U.plural(r.enviados, "1 pessoa", r.enviados + " pessoas") : "") + ".", "ok"); }).catch(function (err) { UI.toast(err.message, "erro", null, 9000); }); } },
        { rotulo: "Enviar pelo chat", icone: "send", classe: "btn--primario", ao: function (c) { Dados.enviarMensagem(e.id, { autor: { uid: sessao.uid, nome: sessao.nome, lado: "equipe" }, texto: c.querySelector("#mpTexto").value }).then(function () { UI.toast("Enviado pelo chat do portal.", "ok"); if (o.depois) o.depois(); }); } }
      ] });
  }
  function editarEmpresa(e) {
    UI.modal({ titulo: "Editar " + e.fantasia, corpo: '<div class="pilha"><div class="campo"><label class="campo__rotulo">Nome fantasia</label><input class="input" id="eF" value="' + U.esc(e.fantasia) + '"></div><div class="campo"><label class="campo__rotulo">WhatsApp do cliente</label><input class="input" id="eW" inputmode="tel" value="' + U.esc(e.whatsapp || "") + '" placeholder="(79) 99999-9999"><span class="campo__ajuda">Usado nos botões de WhatsApp das cobranças.</span></div><div class="campo"><label class="campo__rotulo">Regime</label><select class="select" id="eR">' + ["MEI", "Simples Nacional", "Lucro Presumido", "Lucro Real"].map(function (x) { return "<option" + (x === e.regime ? " selected" : "") + ">" + x + "</option>"; }).join("") + '</select></div><div class="campo"><label class="campo__rotulo">Trilha</label><select class="select" id="eT">' + ["A", "B", "C"].map(function (x) { return '<option value="' + x + '"' + (x === e.trilha ? " selected" : "") + ">" + x + "</option>"; }).join("") + '</select></div><div class="campo"><span class="campo__rotulo">Responsáveis por setor</span><div class="grade grade--2" style="gap:8px">' + CATALOGO.SETORES.map(function (s) { return '<label class="f-12 txt-2">' + s[1] + '<select class="select mt-4" name="eResp" data-setor="' + s[0] + '"><option value="">—</option></select></label>'; }).join("") + '</div></div><div class="campo"><span class="campo__rotulo">Perfis</span><div class="linha">' + CATALOGO.PERFIS.filter(function (p) { return p.id !== "todos"; }).map(function (p) { return '<label class="checar"><input type="checkbox" name="ep" value="' + p.id + '"' + ((e.perfis || []).indexOf(p.id) > -1 ? " checked" : "") + "> " + U.esc(p.rotulo) + "</label>"; }).join("") + '</div></div><div class="campo"><label class="campo__rotulo">Dor principal (D2)</label><textarea class="textarea" id="eD">' + U.esc(e.dor || "") + '</textarea></div><label class="checar"><input type="checkbox" id="eM"' + (e.migracaoConcluidaEm ? " checked" : "") + "> Migração da contabilidade anterior concluída</label></div>",
      acoes: [{ rotulo: "Cancelar" }, { rotulo: "Salvar", classe: "btn--primario", ao: function (c) {
        var resp = {}; Array.prototype.forEach.call(c.querySelectorAll("[name=eResp]"), function (sel) { if (sel.value) resp[sel.dataset.setor] = { uid: sel.value, nome: sel.options[sel.selectedIndex].textContent }; });
        Dados.salvarEmpresa(e.id, { fantasia: c.querySelector("#eF").value.trim() || e.fantasia, whatsapp: c.querySelector("#eW").value.trim(), regime: c.querySelector("#eR").value, trilha: c.querySelector("#eT").value, responsaveis: resp, perfis: Array.prototype.map.call(c.querySelectorAll("[name=ep]:checked"), function (i) { return i.value; }), dor: c.querySelector("#eD").value.trim(), migracaoConcluidaEm: c.querySelector("#eM").checked ? (e.migracaoConcluidaEm || Date.now()) : 0 }).then(function () { UI.toast("Salvo.", "ok"); rotear(); });
      } }] });
    Dados.equipe().then(function (eq) {
      /* quem confere aquele departamento aparece primeiro; o resto da equipe vem depois */
      UI.$$("[name=eResp]").forEach(function (sel) {
        var setor = sel.dataset.setor, atual = (e.responsaveis || {})[setor] || {};
        var ordem = eq.slice().sort(function (a, b) { return ((b.setores || []).indexOf(setor) > -1) - ((a.setores || []).indexOf(setor) > -1); });
        sel.innerHTML = '<option value="">—</option>' + ordem.map(function (m) { return '<option value="' + m.uid + '"' + (m.uid === atual.uid ? " selected" : "") + ">" + U.esc(m.nome) + "</option>"; }).join("");
      });
    });
  }

  function abaVisao(e, corpo) {
    corpo.innerHTML = UI.esqueleto(4);
    Promise.all([carregarAuto(e), Dados.mensagens(e.id), Dados.checklists(e.id), Dados.usos({ empresaId: e.id, desde: Date.now() - 30 * U.DIA_MS }), Dados.auditoria({ empresaId: e.id })]).then(function (r) {
      var c = r[0], msgs = r[1], checks = r[2], usos = r[3], aud = r[4];
      var jrE = JORNADA.resumo(e.jornada, autoFnDe(e), "equipe"), jrC = JORNADA.resumo(e.jornada, autoFnDe(e), "cliente");
      var pend = c.docs.filter(function (d) { return d.situacao === "enviado" || d.situacao === "analise"; });
      corpo.innerHTML = '<div class="pagina pagina--larga"><div class="grade grade--4">' +
        '<div class="card kpi"><span class="kpi__rotulo">' + ic("route") + 'Jornada (equipe)</span><span class="kpi__valor">' + jrE.pct + '%</span><span class="kpi__delta txt-2">' + (jrE.concluida ? "concluída" : "D" + jrE.diaHoje + (jrE.atrasados ? " · " + jrE.atrasados + " atraso" : "")) + "</span></div>" +
        '<div class="card kpi"><span class="kpi__rotulo">' + ic("user") + 'Jornada (cliente)</span><span class="kpi__valor">' + jrC.pct + '%</span><span class="kpi__delta txt-2">' + jrC.feitos + "/" + jrC.total + " passos</span></div>" +
        '<div class="card kpi"><span class="kpi__rotulo">' + ic("folder") + 'Documentos</span><span class="kpi__valor">' + c.docs.length + '</span><span class="kpi__delta ' + (pend.length ? "txt-aviso" : "txt-2") + '">' + pend.length + " a conferir</span></div>" +
        '<div class="card kpi kpi--gold"><span class="kpi__rotulo">' + ic("activity") + 'Uso · 30 dias</span><span class="kpi__valor">' + usos.filter(function (u) { return u.tipo === "abrir"; }).length + '</span><span class="kpi__delta txt-2">aberturas · ' + U.duracao(U.soma(usos, function (u) { return u.duracaoS || 0; })) + "</span></div></div>" +
        '<div class="grade grade--lado"><div class="pilha">' +
          '<div class="card"><div class="card__cab"><h2>Acesso ao portal</h2><button type="button" class="btn btn--xs btn--contorno" data-acao="convite">' + ic("plus", "ic--sm") + 'Novo convite</button></div><div class="lista" style="padding-top:6px">' + ((e.acessos || []).map(function (a) { return '<div class="lista__item">' + UI.avatar(a.nome, "avatar--sm") + '<div class="lista__texto"><span class="lista__titulo">' + U.esc(a.nome) + '</span><span class="lista__sub">' + U.esc(a.email) + '</span></div><span class="lista__meta">' + (a.ultimoAcesso ? "entrou " + U.relativo(a.ultimoAcesso) : "nunca entrou") + "</span></div>"; }).join("") || '<div class="card__corpo aviso aviso--aviso">' + ic("alert") + "<div><b>Ninguém entrou ainda</b>Gere o convite e envie pelo WhatsApp. O D1 depende disso.</div></div>") + "</div></div>" +
          '<div class="card"><div class="card__cab"><h2>Notas da jornada</h2></div><div class="card__corpo pilha" style="padding-top:10px"><div class="f-13"><b>Dor principal (D2):</b> ' + (e.dor ? U.esc(e.dor) : '<span class="txt-mudo">ainda não anotada</span>') + "</div>" + Object.keys((e.jornada || {}).notas || {}).map(function (k) { return '<div class="f-13"><b>' + k.toUpperCase() + ":</b> " + U.esc(e.jornada.notas[k]) + "</div>"; }).join("") + (c.feedback ? '<div class="aviso aviso--ok">' + ic("heart") + "<div><b>Feedback dos 30 dias · nota " + (c.feedback.nota || "—") + "</b>" + U.esc(c.feedback.texto) + "</div></div>" : "") + "</div></div>" +
          '<div class="card"><div class="card__cab"><h2>Envio do mês</h2></div><div class="lista" style="padding-top:6px">' + (checks.slice(0, 4).map(function (h) { var f = h.itens.filter(function (x) { return x.feito; }).length; return '<div class="lista__item"><div class="lista__texto"><span class="lista__titulo">' + nomeMes(h.anoMes) + '</span><span class="lista__sub">' + f + "/" + h.itens.length + (h.itens.length === 1 ? " item" : " itens") + "</span></div>" + (h.concluidoEm ? UI.badge("em dia", "ok", "check") : UI.badge("aberto", "aviso")) + "</div>"; }).join("") || '<div class="card__corpo txt-2 f-13">Sem checklist.</div>') + "</div></div>" +
        '</div><div class="pilha">' +
          '<div class="card"><div class="card__cab"><h2>Sistemas liberados</h2><a class="btn btn--xs btn--contorno" href="#/clientes/' + e.id + '/liberacoes">Gerenciar</a></div><div class="card__corpo pilha" style="padding-top:10px;gap:6px">' + CATALOGO.SISTEMAS.map(function (s) { var l = (e.liberacoes || {})[s.id]; var on = l && l.ativo && !(l.ate && U.ms(l.ate) < Date.now()); return '<div class="linha linha--entre f-13"><span class="linha" style="gap:6px"><span class="ponto ' + (on ? "ponto--ok" : "") + '"></span>' + U.esc(s.nome) + "</span>" + (on ? '<span class="txt-2 f-12">' + U.esc(l.plano || "ativo") + (l.ate ? " até " + U.dataCurta(l.ate) : "") + "</span>" : '<span class="txt-mudo f-12">não</span>') + "</div>"; }).join("") + "</div></div>" +
          '<div class="card"><div class="card__cab"><h2>Trilha de auditoria</h2></div><div class="lista" style="padding-top:6px;max-height:320px;overflow:auto">' + (aud.slice(0, 12).map(function (a) { return '<div class="lista__item" style="min-height:0;padding:8px 16px"><div class="lista__texto"><span class="lista__titulo f-13">' + U.esc(frasePara(a)) + '</span><span class="lista__sub">' + U.esc(a.por || "") + " · " + U.dataHora(a.em) + "</span></div></div>"; }).join("") || '<div class="card__corpo txt-2 f-13">Nada registrado.</div>') + "</div></div>" +
        "</div></div></div>";
      UI.delegar(corpo, { convite: function () { Dados.criarConvite(e.id, sessao).then(function (c2) { mostrarConvite(e, c2); }); } });
    });
  }

  function abaLiberacoes(e, corpo) {
    corpo.innerHTML = '<div class="pagina pagina--larga"><div class="aviso aviso--info">' + ic("info") + "<div><b>Cada cliente só acessa o que você liberar aqui.</b>O que não estiver liberado aparece no portal como prévia (\"ver como funciona\"), com botão para pedir. Nada de venda casada: cada sistema é independente.</div></div><div class=\"grade grade--3\">" + CATALOGO.SISTEMAS.map(function (s) {
      var l = (e.liberacoes || {})[s.id] || {}; var on = !!l.ativo;
      return '<div class="card sistema"><div class="sistema__topo">' + CATALOGO.selo(s) + '<div style="flex:1"><div class="sistema__nome">' + U.esc(s.nome) + '</div><div class="sistema__tag">' + U.esc(s.tagline) + (s.oculto ? " · oculto no portal" : "") + '</div></div><label class="interruptor" title="Liberar"><input type="checkbox" data-acao="toggle" aria-label="Liberar ' + U.esc(s.nome) + '" data-s="' + s.id + '"' + (on ? " checked" : "") + (s.status === "breve" ? " disabled" : "") + '><span class="interruptor__pista"></span></label></div>' +
        (on ? '<div class="grade grade--2" style="gap:8px"><div class="campo"><label class="campo__rotulo">Plano</label><select class="select" data-acao="plano" data-s="' + s.id + '" style="min-height:36px">' + ["mensal", "anual", "avulso", "cortesia 30 dias", "cortesia"].map(function (p) { return "<option" + (p === l.plano ? " selected" : "") + ">" + p + "</option>"; }).join("") + '</select></div><div class="campo"><label class="campo__rotulo">Válido até</label><input class="input" type="date" data-acao="ate" data-s="' + s.id + '" style="min-height:36px" value="' + (l.ate ? new Date(U.ms(l.ate)).toISOString().slice(0, 10) : "") + '"></div></div><div class="f-12 txt-2">liberado ' + (l.desde ? U.relativo(l.desde) : "") + (l.ate && U.ms(l.ate) < Date.now() ? ' · <b class="txt-erro">vencido</b>' : "") + "</div>" : '<div class="f-12 txt-mudo">' + (s.status === "breve" ? "Em desenvolvimento: aparece como lista de espera." : "Não liberado. O cliente vê a prévia.") + "</div>") + "</div>";
    }).join("") + "</div></div>";
    /* onchange (e não addEventListener): esta aba se redesenha no mesmo elemento e cada desenho somava um ouvinte, então um clique liberava/desativava 2, 3 vezes */
    corpo.onchange = function (ev) {
      var t = ev.target, s = t.dataset.s; if (!s) return;
      var l = (e.liberacoes || {})[s] || {};
      var dados = t.dataset.acao === "toggle" ? { ativo: t.checked, plano: l.plano || "mensal" } : t.dataset.acao === "plano" ? { ativo: true, plano: t.value } : { ativo: true, ate: t.value ? new Date(t.value + "T23:59:59").getTime() : 0 };
      Dados.liberar(e.id, s, dados, sessao).then(function () { UI.toast((dados.ativo ? "Liberado: " : "Desativado: ") + CATALOGO.por(s).nome, "ok"); return carregarEmpresas(); }).then(function () { e = empresas.filter(function (x) { return x.id === e.id; })[0]; abaLiberacoes(e, corpo); });
    };
  }

  function abaJornada(e, corpo) {
    corpo.innerHTML = UI.esqueleto(6);
    carregarAuto(e).then(function () {
      var auto = autoFnDe(e), and = e.jornada || {};
      var jrE = JORNADA.resumo(and, auto, "equipe"), jrC = JORNADA.resumo(and, auto, "cliente");
      corpo.innerHTML = '<div class="pagina pagina--larga"><div class="grade grade--lado"><div class="pilha">' +
        '<div class="linha linha--entre"><div class="f-13 txt-2">Aceite em <b>' + U.data(and.aceiteEm) + "</b> · hoje é o D" + jrE.diaHoje + ' <button type="button" class="btn btn--xs btn--fantasma" data-acao="aceite">' + ic("pencil", "ic--sm") + "alterar</button></div>" + (jrE.concluida ? UI.badge("jornada concluída", "ok", "trophy") : "") + "</div>" +
        '<div class="jornada">' + JORNADA.DIAS.map(function (d, idx) {
          var est = jrE.dias[idx]; var estado = est.estado === "futuro" && jrE.atual && jrE.atual.id === d.id ? "atual" : est.estado;
          var estC = jrC.dias[idx];
          var passosE = d.equipe.map(function (p, i) { var f = JORNADA.passoFeito(and, auto, d.id, "equipe", i, p); return '<button type="button" class="passo" data-feito="' + (f.feito ? 1 : 0) + '" data-auto="' + (p.auto ? 1 : 0) + '" data-acao="passo" data-dia="' + d.id + '" data-i="' + i + '"><span class="passo__p">P' + (i + 1) + '</span><span class="passo__check">' + ic("check", "ic--sm") + '</span><span class="passo__texto">' + U.esc(p.texto) + (f.feito ? '<div class="passo__meta">' + (f.auto ? "confirmado pelo sistema" : "feito " + U.relativo(f.em) + " · " + U.esc(f.por)) + "</div>" : "") + "</span></button>"; }).join("");
          var passosC = d.cliente.map(function (p, i) { var f = JORNADA.passoFeito(and, auto, d.id, "cliente", i, p); return '<button type="button" class="passo" data-feito="' + (f.feito ? 1 : 0) + '" data-auto="' + (p.auto ? 1 : 0) + '" data-acao="passo" data-lado="cliente" data-dia="' + d.id + '" data-i="' + i + '" style="background:var(--muted)"><span class="passo__p">P' + (i + 1) + '</span><span class="passo__check">' + ic("check", "ic--sm") + '</span><span class="passo__texto f-13">' + U.esc(p.texto) + (f.feito ? '<div class="passo__meta">' + (f.auto ? "confirmado pelo sistema" : "feito " + U.relativo(f.em) + (f.por && f.por !== "cliente" ? " · " + U.esc(f.por) : "")) + "</div>" : "") + "</span></button>"; }).join("");
          return '<div class="dia" data-estado="' + estado + '"><div class="dia__marca"><div class="dia__d">D' + d.dia + "</div>" + (idx < JORNADA.DIAS.length - 1 ? '<div class="dia__linha"></div>' : "") + '</div><div class="dia__corpo"><div class="dia__cab"><span class="dia__titulo">' + U.esc(d.titulo) + "</span>" + (d.marco ? '<span class="badge badge--gold">' + ic("star") + "Marco</span>" : "") + (estado === "atrasado" ? UI.badge(est.diasAtraso + "d atraso", "erro", "clock") : estado === "hoje" ? UI.badge("hoje", "gold") : estado === "feito" ? UI.badge("feito", "ok", "check") : "") + '<span class="dia__quando">' + (est.prazo ? U.dataCurta(est.prazo) : "") + " · " + U.esc(d.quem) + '</span></div><div class="dia__objetivo">' + U.esc(d.objetivo) + '</div>' +
            '<div class="f-12 f-800 txt-2 mt-8" style="letter-spacing:.06em;text-transform:uppercase">A equipe faz</div><div class="passos">' + passosE + "</div>" +
            '<div class="f-12 f-800 txt-2 mt-8" style="letter-spacing:.06em;text-transform:uppercase">O cliente precisa fazer (controle interno; ele não vê esta lista) · ' + estC.feitos + "/" + estC.total + '</div><div class="passos">' + passosC + "</div>" +
            (d.id === "d30" ? '<button type="button" class="btn btn--xs btn--gold mt-8" data-acao="pedir-feedback">' + ic("heart", "ic--sm") + "Pedir o feedback dos 30 dias pelo chat</button>" : "") +
            (d.erro ? '<div class="dia__erro">' + ic("alert", "ic--sm") + "<span><b>Erro comum:</b> " + U.esc(d.erro) + "</span></div>" : "") +
            '<div class="dia__nota"><button type="button" class="btn btn--xs btn--fantasma" data-acao="nota" data-dia="' + d.id + '">' + ic("pencil", "ic--sm") + (and.notas && and.notas[d.id] ? "Editar anotação" : "Anotar") + "</button>" + (and.notas && and.notas[d.id] ? '<div class="f-13 txt-2 mt-4" style="white-space:pre-wrap">' + U.esc(and.notas[d.id]) + "</div>" : "") + "</div></div></div>";
        }).join("") + "</div></div>" +
        '<div class="pilha"><div class="card card--navy"><div class="puzzle-layer"></div><div class="veu"></div><div class="card__corpo" style="display:flex;gap:14px;align-items:center">' + UI.anel(jrE.pct, "equipe") + UI.anel(jrC.pct, "cliente") + "</div></div>" +
          '<div class="card"><div class="card__corpo pilha"><h3>Trilha ' + U.esc(e.trilha || "A") + '</h3><p class="f-13 txt-2">' + U.esc(JORNADA.TRILHAS[e.trilha || "A"]) + "</p></div></div>" +
          '<div class="card"><div class="card__corpo pilha"><h3>Os três marcos</h3><p class="f-13 txt-2">D0 (ligação em 2 h), D15 (primeira entrega de valor) e D30 (feedback) decidem a percepção do cliente. O resto sustenta.</p></div></div></div></div></div>';
      UI.delegar(corpo, {
        "pedir-feedback": function () { Dados.enviarMensagem(e.id, { autor: { uid: sessao.uid, nome: sessao.nome, lado: "equipe" }, texto: "Oi! Fechamos seus primeiros 30 dias com a Totali. Pode me contar em uma frase como foi? É só tocar aqui: " + location.origin + location.pathname.replace(/equipe\.html$/, "") + "index.html#/feedback" }).then(function () { UI.toast("Pedido enviado pelo chat.", "ok"); }); },
        passo: function (b) {
          var lado = b.dataset.lado || "equipe";
          var d = JORNADA.por(b.dataset.dia), i = Number(b.dataset.i), p = d[lado][i];
          var f = JORNADA.passoFeito(and, auto, d.id, lado, i, p);
          if (f.feito && f.auto) return UI.toast("Confirmado pelo sistema: " + (JORNADA.AUTOMACOES.filter(function (a) { return a.id === p.auto; })[0] || {}).como, "info", null, 5000);
          Dados.marcarPasso(e.id, JORNADA.chave(d.id, lado, i), !f.feito, sessao).then(function () { if (!f.feito) UI.vibrar(10); return carregarEmpresas(); }).then(function () { e = empresas.filter(function (x) { return x.id === e.id; })[0]; var r2 = JORNADA.resumo(e.jornada, auto, "equipe"); if (r2.concluida && !and.concluidaEm) { Dados.salvarJornada(e.id, { concluidaEm: Date.now() }); UI.celebrar("Jornada de " + e.fantasia + " concluída"); } abaJornada(e, corpo); });
        },
        nota: function (b) { var d = b.dataset.dia; UI.perguntar("Anotação · D" + JORNADA.por(d).dia, "O que vale lembrar", (and.notas || {})[d] || "", { longo: true, ok: "Salvar" }).then(function (t) { if (t === null) return; var notas = Object.assign({}, and.notas || {}); notas[d] = U.txt(t, 2000); Dados.salvarJornada(e.id, { notas: notas }).then(carregarEmpresas).then(function () { e = empresas.filter(function (x) { return x.id === e.id; })[0]; abaJornada(e, corpo); }); }); },
        aceite: function () { UI.perguntar("Data do aceite da proposta", "Data (AAAA-MM-DD)", new Date(U.ms(and.aceiteEm) || Date.now()).toISOString().slice(0, 10)).then(function (t) { if (!t) return; var ms = new Date(t + "T09:00:00").getTime(); if (!ms) return UI.toast("Data inválida.", "erro"); Dados.salvarJornada(e.id, { aceiteEm: ms }).then(carregarEmpresas).then(function () { e = empresas.filter(function (x) { return x.id === e.id; })[0]; abaJornada(e, corpo); }); }); }
      });
    });
  }

  var GRUPOS_DOC = { certificado: "Certificado digital", societario: "Societário", socios: "Sócios", contabil: "Contábil", fiscal: "Fiscal", pessoal: "Dep. pessoal", mensal: "Mês", outros: "Outros" };
  function situacaoBadge(s) { return { enviado: UI.badge("Enviado", "info", "upload"), analise: UI.badge("Em análise", "info", "eye"), aprovado: UI.badge("Aprovado", "ok", "check"), pendencia: UI.badge("Correção pedida", "erro", "alert") }[s] || UI.badge(s); }
  function docLinha(d, e) {
    var visto = (d.vistos || [])[0];
    return '<div class="doc" data-id="' + d.id + '"><span class="doc__icone">' + ic(U.ehImagem(d.arquivo && d.arquivo.mime, d.nome) ? "image" : "file") + '</span><div style="flex:1;min-width:0"><div class="doc__nome">' + U.esc(d.nome) + '</div><div class="doc__meta">' + (e ? U.esc(e.fantasia) + " · " : "") + U.esc(GRUPOS_DOC[d.grupo] || d.grupo) + " · " + (d.origem === "anterior" ? "contab. anterior" : d.origem === "equipe" ? "Totali" : U.esc(d.por || "cliente")) + " · " + U.relativo(d.em) + (d.observacao ? " · “" + U.esc(d.observacao) + "”" : "") + "</div>" + (visto ? '<div class="doc__meta txt-ok">visto por ' + U.esc(visto.por) + " " + U.relativo(visto.em) + "</div>" : "") + (d.revisao && d.revisao.motivo ? '<div class="doc__meta txt-erro">' + U.esc(d.revisao.motivo) + "</div>" : "") + '</div><div class="pilha" style="gap:6px;align-items:flex-end">' + situacaoBadge(d.situacao) + '<div class="linha" style="gap:4px;flex-wrap:nowrap"><button type="button" class="btn btn--xs btn--contorno" data-acao="ver" data-id="' + d.id + '" data-emp="' + d.empresaId + '">' + ic("eye", "ic--sm") + "Ver</button>" + (d.situacao !== "aprovado" ? '<button type="button" class="btn btn--xs btn--primario" data-acao="aprovar" data-id="' + d.id + '" data-emp="' + d.empresaId + '">' + ic("check", "ic--sm") + "Aprovar</button>" : "") + (d.situacao !== "pendencia" ? '<button type="button" class="btn btn--xs btn--perigo" data-acao="corrigir" data-id="' + d.id + '" data-emp="' + d.empresaId + '">' + ic("alert", "ic--sm") + "Pedir correção</button>" : "") + "</div></div></div>";
  }
  function ligarDocs(raiz, recarregar) {
    UI.delegar(raiz, {
      ver: function (b) { Dados.verDocumento(b.dataset.emp, b.dataset.id, sessao).then(function () { return Dados.documentos(b.dataset.emp); }).then(function (ds) { var d = ds.filter(function (x) { return x.id === b.dataset.id; })[0]; return Dados.urlArquivo(d); }).then(function (u) { if (u) global.open(u, "_blank", "noopener"); else UI.toast("Documento de exemplo sem arquivo. O recibo 'visto por' foi registrado.", "info"); recarregar(); }); },
      aprovar: function (b) { Dados.revisarDocumento(b.dataset.emp, b.dataset.id, "aprovado", "", sessao).then(function () { UI.toast("Aprovado. O cliente vê o aceite com seu nome.", "ok"); recarregar(); }); },
      corrigir: function (b) { UI.perguntar("Pedir correção", "Motivo (o cliente vai ler exatamente isto)", "", { longo: true, ok: "Enviar pedido", placeholder: "Ex.: a foto está cortada, reenvie mostrando o documento inteiro." }).then(function (t) { if (!t) return; Dados.revisarDocumento(b.dataset.emp, b.dataset.id, "pendencia", t, sessao).then(function () { UI.toast("Pedido enviado.", "ok"); recarregar(); }); }); }
    });
  }
  function abaDocumentos(e, corpo, r) {
    corpo.innerHTML = UI.esqueleto(5);
    Dados.documentos(e.id).then(function (docs) {
      var grupos = U.agrupar(docs, function (d) { return d.grupo; });
      corpo.innerHTML = '<div class="pagina pagina--larga"><div class="linha linha--entre"><div class="f-13 txt-2">' + docs.length + " documentos · " + docs.filter(function (d) { return d.situacao === "enviado"; }).length + ' a conferir</div><button type="button" class="btn btn--sm btn--contorno" data-acao="enviar-equipe">' + ic("upload") + "Enviar documento ao cliente</button></div>" + (docs.length ? Object.keys(grupos).map(function (g) { return '<h3 class="mt-8">' + U.esc(GRUPOS_DOC[g] || g) + '</h3><div class="pilha" style="gap:6px">' + grupos[g].map(function (d) { return docLinha(d); }).join("") + "</div>"; }).join("") : UI.vazio("folder", "Nenhum documento", "O cliente ainda não enviou nada.")) + '<input type="file" id="docEq" hidden></div>';
      ligarDocs(corpo, function () { abaDocumentos(e, corpo, r); });
      UI.delegar(corpo, { "enviar-equipe": function () { UI.$("#docEq", corpo).click(); } });
      UI.$("#docEq", corpo).addEventListener("change", function () { var f = this.files[0]; if (!f) return; var err = U.validarArquivo(f); if (err) return UI.toast(err, "erro"); Dados.enviarDocumento(e.id, { file: f, grupo: "outros", origem: "equipe", por: sessao.nome }).then(function () { UI.toast("Enviado ao portal do cliente.", "ok"); abaDocumentos(e, corpo, r); }); });
    });
  }
  function telaDocumentosGeral() {
    Shell.titulo("Documentos a conferir");
    Shell.render(UI.esqueleto(6));
    Dados.todosDocumentos().then(function (docs) {
      var porEmp = U.porChave(empresas, "id");
      var pend = docs.filter(function (d) { return d.situacao === "enviado" || d.situacao === "analise"; });
        var meus = (sessao.setores || []); var grupoSetor = { societario: "societario", contabil: "contabil", fiscal: "fiscal", pessoal: "trabalhista", socios: "socios", certificado: "fiscal", mensal: "contabil" };
      var doMeuSetor = meus.length ? pend.filter(function (d) { return meus.indexOf(grupoSetor[d.grupo] || "") > -1; }) : pend;
      var outros = pend.filter(function (d) { return doMeuSetor.indexOf(d) === -1; });
      pend = doMeuSetor;
    Shell.render('<div class="pagina"><div class="cabecalho"><div><div class="cabecalho__kicker">Atendimento</div><h1>Documentos a conferir</h1><p>' + pend.length + " aguardando" + (meus.length ? " no seu departamento" + (outros.length ? " · " + outros.length + " em outros departamentos" : "") : "") + ". Ver registra o recibo \"visto por você\" no portal do cliente; aprovar dá o aceite.</p></div></div>" + (pend.length ? '<div class="pilha" style="gap:6px">' + pend.map(function (d) { return docLinha(d, porEmp[d.empresaId]); }).join("") + "</div>" : UI.vazio("check-circle", "Tudo conferido", "Nenhum documento aguardando" + (meus.length ? " no seu departamento." : "."))) + (outros.length ? '<details class="card"><summary class="card__corpo f-13 f-700" style="cursor:pointer">Outros departamentos (' + outros.length + ')</summary><div class="card__corpo pilha" style="gap:6px;padding-top:0">' + outros.map(function (d) { return docLinha(d, porEmp[d.empresaId]); }).join("") + "</div></details>" : "") + "</div>");
      ligarDocs(Shell.view(), telaDocumentosGeral);
    });
  }

  function abaCofre(e, corpo) {
    corpo.innerHTML = UI.esqueleto(3);
    Dados.credenciais(e.id).then(function (creds) {
      corpo.innerHTML = '<div class="pagina pagina--larga"><div class="aviso aviso--info">' + ic("shield") + "<div><b>Toda abertura fica registrada na auditoria com seu nome e hora.</b>A senha é aberta pelo servidor e chega recifrada só para esta aba. Não copie para WhatsApp.</div></div>" + (creds.length ? '<div class="pilha" style="gap:6px">' + creds.map(function (c) { return '<div class="doc"><span class="doc__icone" style="background:var(--gold-soft);color:var(--gold-text)">' + ic("lock") + '</span><div style="flex:1;min-width:0"><div class="doc__nome">' + U.esc(c.rotulo) + '</div><div class="doc__meta">' + (c.usuario ? "usuário: <b class=\"num\">" + U.esc(c.usuario) + "</b> · " : "") + "guardada por " + U.esc(c.por || "cliente") + " " + U.relativo(c.em) + '</div><div class="doc__meta senha-campo" id="sen-' + c.id + '">••••••••••</div></div><button type="button" class="btn btn--xs btn--contorno" data-acao="abrir" data-id="' + c.id + '">' + ic("eye", "ic--sm") + "Ver senha</button></div>"; }).join("") + "</div>" : UI.vazio("key", "Nenhuma senha guardada", "O cliente guarda pelo portal, em Cofre de senhas.")) + "</div>";
      UI.delegar(corpo, { abrir: function (b) {
        b.disabled = true;
        var p;
        if (Dados.ehDemo()) p = Dados.abrirCredencial(e.id, b.dataset.id, sessao);
        else p = Cripto.gerarPar().then(function (par) { return Dados.abrirCredencial(e.id, b.dataset.id, sessao, par.publica).then(function (r) { return Cripto.decifrar(r.resposta, par.privada); }); });
        p.then(function (dados) { var el = UI.$("#sen-" + b.dataset.id, corpo); el.textContent = dados.senha + (dados.obs ? "  (" + dados.obs + ")" : ""); el.classList.add("txt-gold"); el.setAttribute("data-segredo", "1"); UI.toast("Aberta e registrada na auditoria.", "info"); setTimeout(function () { el.textContent = "••••••••••"; el.classList.remove("txt-gold"); el.removeAttribute("data-segredo"); b.disabled = false; }, 45000); })
          .catch(function (err) { UI.toast(err.message, "erro", null, 6000); b.disabled = false; });
      } });
    });
  }

  function abaConversa(e, corpo) {
    corpo.innerHTML = '<div style="padding:0 16px 16px"><div id="chatFicha"></div></div>';
    montarChatEquipe(UI.$("#chatFicha", corpo), e, true);
  }
  function montarChatEquipe(container, e, embutido) {
    if (chatAtual) chatAtual.destruir();
    var cab = '<div class="chat__cab">' + UI.avatar(e.fantasia) + '<div class="lista__texto"><span class="lista__titulo">' + U.esc(e.fantasia) + '</span><span class="lista__sub">' + U.esc((e.acessos || []).map(function (a) { return a.nome; }).join(", ") || "sem acesso ao portal") + '</span></div><button type="button" class="btn btn--xs btn--contorno" data-acao="resolver">' + ic("check", "ic--sm") + 'Resolver</button><a class="btn btn--xs btn--fantasma" href="#/clientes/' + e.id + '" title="Ficha">' + ic("building", "ic--sm") + "</a></div>";
    chatAtual = Chat.montar(container, { empresaId: e.id, eu: { uid: sessao.uid, nome: sessao.nome, lado: "equipe" }, whatsapp: whatsappDe(e), cabecalho: cab, embutido: embutido, aoReceber: atualizarBadges, aoEnviar: atualizarBadges });
    UI.delegar(container, { resolver: function () { UI.perguntar("Marcar como resolvida", "Próximo passo para o cliente (peak-end: a conversa termina com clareza)", "", { ok: "Resolver", placeholder: "Ex.: enviar o extrato de setembro até dia 5" }).then(function (t) { if (t === null) return; Dados.resolverConversa(e.id, sessao, t).then(function () { UI.toast("Conversa resolvida.", "ok"); atualizarBadges(); }); }); } });
  }
  /* "Cobrar" do Envio do mês: abre a conversa com a mensagem já escrita, listando o que falta. A pessoa revisa e envia. */
  function textoCobrancaEnvio(e, anoMes) {
    return Dados.checklist(e.id, anoMes).then(function (salvo) {
      var c = global.Envio.mes(e, salvo, anoMes), faltam = c.itens.filter(function (i) { return !i.feito; });
      var mes = nomeMes(anoMes).split(" de ")[0];
      return faltam.length
        ? "Olá! Para fecharmos a contabilidade de " + mes + ", ainda faltam:\n" + faltam.map(function (i) { return "• " + i.texto + " (até dia " + i.prazoDia + ")"; }).join("\n") + "\n\nÉ só abrir o portal, em Envio do mês, e tocar em Anexar no item: ele fica marcado sozinho. Qualquer dúvida, responda por aqui."
        : "Olá! O envio de " + mes + " está completo. Obrigado!";
    });
  }
  function rascunhoCobranca(cont, e, anoMes) {
    Dados.checklist(e.id, anoMes).then(function (salvo) {
      var c = global.Envio.mes(e, salvo, anoMes), faltam = c.itens.filter(function (i) { return !i.feito; });
      var caixa = cont.querySelector(".chat__caixa"); if (!caixa) return;
      var mes = nomeMes(anoMes).split(" de ")[0];
      caixa.value = faltam.length
        ? "Olá! Para fecharmos a contabilidade de " + mes + ", ainda faltam:\n" + faltam.map(function (i) { return "• " + i.texto + " (até dia " + i.prazoDia + ")"; }).join("\n") + "\n\nÉ só abrir o portal, em Envio do mês, e tocar em Anexar no item: ele fica marcado sozinho. Qualquer dúvida, responda por aqui."
        : "Olá! O envio de " + mes + " está completo. Obrigado!";
      caixa.dispatchEvent(new Event("input", { bubbles: true })); caixa.focus();
      UI.toast("Mensagem de cobrança pronta. Revise e toque em Enviar.", "info");
    });
  }
  function telaMensagens(r) {
    Shell.titulo("Mensagens");
    Shell.render(UI.esqueleto(6));
    Dados.todasConversas().then(function (convs) {
      var atual = r.param || "";
      Shell.render('<div class="conversas"' + (atual ? " data-aberta" : "") + '><div class="conversas__lista"><div class="lista">' + convs.map(function (c) { return '<a class="lista__item" href="#/mensagens/' + c.empresaId + '" aria-current="' + (c.empresaId === atual) + '">' + UI.avatar(c.empresa, "avatar--sm") + '<div class="lista__texto"><span class="lista__titulo">' + U.esc(c.empresa) + '</span><span class="lista__sub">' + (c.ultima ? (c.ultima.autor.lado === "equipe" ? "Você: " : "") + U.esc(c.ultima.texto || "📎 anexo") : "sem mensagens") + '</span></div><div class="pilha" style="gap:4px;align-items:flex-end"><span class="lista__meta">' + (c.ultima ? U.relativo(c.ultima.em) : "") + "</span>" + (c.naoLidas ? '<span class="badge badge--erro">' + c.naoLidas + "</span>" : c.resolvida ? UI.badge("resolvida", "ok", "check") : "") + "</div></a>"; }).join("") + '</div></div><div class="conversas__chat" id="chatArea">' + (atual ? "" : '<div class="vazio" style="height:100%;justify-content:center">' + ic("chat") + "<b>Escolha uma conversa</b><span>As não lidas aparecem com o contador vermelho.</span></div>") + "</div></div>");
      if (atual) { var e = empresas.filter(function (x) { return x.id === atual; })[0]; if (e) { var area = UI.$("#chatArea"); area.innerHTML = '<div id="chatMsgs"></div>'; var cont = UI.$("#chatMsgs"); montarChatEquipe(cont, e, false); if (r.query.cobrar === "envio") rascunhoCobranca(cont, e, r.query.mes || U.anoMes(Date.now())); var cab = cont.querySelector(".chat__cab"); if (cab) cab.insertAdjacentHTML("afterbegin", '<a class="btn btn--icone btn--fantasma so-mobile" href="#/mensagens" aria-label="Voltar">' + ic("arrow-left") + "</a>"); } }
    });
  }

  function abaUso(e, corpo) {
    corpo.innerHTML = UI.esqueleto(4);
    Dados.usos({ empresaId: e.id, desde: Date.now() - 30 * U.DIA_MS }).then(function (usos) {
      var ag = Uso.agregar(usos, [e]);
      corpo.innerHTML = '<div class="pagina pagina--larga"><div class="linha linha--entre"><div class="f-13 txt-2">Últimos 30 dias · ' + usos.filter(function (u) { return u.tipo === "abrir"; }).length + ' aberturas</div><button type="button" class="btn btn--sm btn--contorno" data-acao="csv">' + ic("download") + 'CSV</button></div><div class="tabela-wrap"><table class="tabela tabela--compacta"><thead><tr><th>Sistema</th><th class="num">Aberturas</th><th class="num">Minutos</th><th class="num">Dias ativos</th><th>Quem</th><th>Último uso</th><th>Dispositivo</th></tr></thead><tbody>' + (ag.map(function (r) { var s = CATALOGO.por(r.sistemaId); return "<tr><td><b>" + U.esc(CATALOGO.nomeDe(r.sistemaId)) + '</b></td><td class="num">' + r.aberturas + '</td><td class="num">' + Math.round(r.segundos / 60) + '</td><td class="num">' + r.diasAtivos + "</td><td class=\"f-12\">" + U.esc(Object.keys(r.pessoas).map(function (k) { return r.pessoas[k]; }).join(", ")) + '</td><td class="f-12">' + U.relativo(r.ultimo) + '</td><td class="f-12">' + (r.celular > r.computador ? "celular" : "computador") + "</td></tr>"; }).join("") || '<tr><td colspan="7" class="txt-2">Sem uso no período.</td></tr>') + "</tbody></table></div><h3 class=\"mt-12\">Últimos eventos</h3><div class=\"lista card\">" + usos.filter(function (u) { return u.tipo !== "sessao"; }).slice(0, 20).map(function (u) { var s = CATALOGO.por(u.sistemaId); return '<div class="lista__item" style="min-height:0;padding:8px 16px"><span class="ponto ' + (u.tipo === "abrir" ? "ponto--ok" : u.tipo === "vitrine" ? "ponto--gold" : "") + '"></span><div class="lista__texto"><span class="lista__titulo f-13">' + (u.tipo === "abrir" ? "abriu " + U.esc(s ? s.nome : u.sistemaId) : u.tipo === "tela" ? "tela " + U.esc(u.tela) : u.tipo === "vitrine" ? "vitrine · " + U.esc(u.acao) + " · " + U.esc(s ? s.nome : u.sistemaId) : u.tipo) + '</span><span class="lista__sub">' + U.esc(u.nome || "") + " · " + U.esc(u.dispositivo || "") + '</span></div><span class="lista__meta">' + U.dataHora(u.em) + "</span></div>"; }).join("") + "</div></div>";
      UI.delegar(corpo, { csv: function () { U.baixar("uso-" + U.slug(e.fantasia) + ".csv", Uso.csv(ag), "text/csv;charset=utf-8"); } });
    });
  }

  /* ============================================================
     Jornadas (visão geral de todos os clientes)
     ============================================================ */
  function telaJornadas() {
    Shell.titulo("Jornadas de 30 dias");
    Shell.render(UI.esqueleto(6));
    Promise.all(empresas.map(carregarAuto)).then(function () {
      var lista = empresas.map(function (e) { return { e: e, r: JORNADA.resumo(e.jornada, autoFnDe(e), "equipe"), c: JORNADA.resumo(e.jornada, autoFnDe(e), "cliente") }; });
      var abertas = lista.filter(function (x) { return !x.r.concluida; }).sort(function (a, b) { return b.r.atrasados - a.r.atrasados || a.r.diaHoje - b.r.diaHoje; });
      var concluidas = lista.filter(function (x) { return x.r.concluida; });
      Shell.render('<div class="pagina pagina--larga"><div class="cabecalho"><div><div class="cabecalho__kicker">Onboarding</div><h1>Jornadas de 30 dias</h1><p>' + abertas.length + " em andamento · " + concluidas.length + ' concluídas. Cada coluna é um dia (D); a célula mostra os passos feitos da equipe.</p></div><a class="btn btn--sm btn--contorno" href="#/conteudo">' + ic("pencil") + "Editar a jornada</a></div>" +
        '<div class="tabela-wrap"><table class="tabela tabela--compacta"><thead><tr><th>Cliente</th><th>Hoje</th>' + JORNADA.DIAS.map(function (d) { return '<th class="centro">D' + d.dia + "</th>"; }).join("") + "<th>Cliente fez</th></tr></thead><tbody>" + abertas.map(function (x) {
          return '<tr style="cursor:pointer" data-acao="abrir" data-id="' + x.e.id + '"><td><b>' + U.esc(x.e.fantasia) + '</b><div class="f-12 txt-2">' + U.esc(CATALOGO.responsaveisTexto(x.e)) + " · trilha " + U.esc(x.e.trilha || "A") + "</div></td><td>D" + x.r.diaHoje + "</td>" + x.r.dias.map(function (d) { var cor = d.estado === "feito" ? "var(--success-soft);color:var(--success)" : d.estado === "atrasado" ? "var(--danger-soft);color:var(--danger)" : d.estado === "hoje" || d.estado === "atual" ? "var(--gold-soft);color:var(--gold-text)" : "var(--muted);color:var(--muted-foreground)"; return '<td class="centro"><span class="badge" style="background:' + cor + '" title="' + d.estado + '">' + d.feitos + "/" + d.total + "</span></td>"; }).join("") + '<td style="min-width:110px"><div class="f-12 txt-2">' + x.c.pct + "%</div>" + UI.barra(x.c.pct, "barra--gold") + "</td></tr>";
        }).join("") + "</tbody></table></div>" +
        (concluidas.length ? '<h2 class="mt-8">Concluídas</h2><div class="grade grade--3">' + concluidas.map(function (x) { return '<a class="card card--clicavel" href="#/clientes/' + x.e.id + '/jornada" style="text-decoration:none;color:inherit"><div class="card__corpo linha" style="flex-wrap:nowrap">' + UI.avatar(x.e.fantasia, "avatar--sm") + '<div class="lista__texto"><b>' + U.esc(x.e.fantasia) + '</b><span class="lista__sub">concluída ' + (x.e.jornada.concluidaEm ? U.relativo(x.e.jornada.concluidaEm) : "") + "</span></div>" + UI.badge("100%", "ok", "trophy") + "</div></a>"; }).join("") + "</div>" : "") + "</div>");
      UI.delegar(Shell.view(), { abrir: function (tr) { location.hash = "#/clientes/" + tr.dataset.id + "/jornada"; } });
    });
  }

  /* ============================================================
     Envio do mês: quais empresas já mandaram tudo
     ============================================================ */
  function telaChecklist(r) {
    Shell.titulo("Envio do mês");
    var anoMes = r.query.mes || U.anoMes(Date.now());
    Shell.render(UI.esqueleto(6));
    Dados.listarChecklists(anoMes).then(function (checks) {
      var porEmp = U.porChave(checks, "empresaId");
      var comChecklist = empresas.filter(function (e) { return e.ativa !== false; }); /* Envio do mês vale para toda empresa ativa */
      var linhas = comChecklist.map(function (e) { var c = global.Envio.mes(e, porEmp[e.id], anoMes); var f = c.itens.filter(function (i) { return i.feito; }).length, t = c.itens.length; return { e: e, c: c, f: f, t: t, pct: t ? U.pct(f, t) : 100, ok: !!c.concluidoEm, nada: t === 0 }; }).sort(function (a, b) { return (a.nada - b.nada) || (a.pct - b.pct); });
      var comItens = linhas.filter(function (l) { return !l.nada; }), concl = comItens.filter(function (l) { return l.ok; }).length;
      var meses = []; for (var i = 0; i < 6; i++) { var d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); meses.push(U.anoMes(d)); }
      Shell.render('<div class="pagina"><div class="cabecalho"><div><div class="cabecalho__kicker">Todo mês</div><h1>Envio de ' + nomeMes(anoMes) + '</h1><p>Quais empresas já mandaram tudo, quais estão paradas e o que falta em cada uma.</p></div><div class="cabecalho__acoes"><select class="select" id="selMes" style="min-height:36px;width:auto">' + meses.map(function (m) { return '<option value="' + m + '"' + (m === anoMes ? " selected" : "") + ">" + nomeMes(m) + "</option>"; }).join("") + '</select><button type="button" class="btn btn--contorno" data-acao="csv">' + ic("download") + "CSV</button></div></div>" +
        '<div class="grade grade--3"><div class="card kpi"><span class="kpi__rotulo">' + ic("check-circle") + 'Concluíram</span><span class="kpi__valor txt-ok">' + concl + '<small> de ' + comItens.length + '</small></span></div><div class="card kpi"><span class="kpi__rotulo">' + ic("clock") + 'Em andamento</span><span class="kpi__valor">' + comItens.filter(function (l) { return !l.ok && l.f > 0; }).length + '</span></div><div class="card kpi"><span class="kpi__rotulo">' + ic("alert") + 'Não começaram</span><span class="kpi__valor txt-aviso">' + comItens.filter(function (l) { return !l.ok && l.f === 0; }).length + "</span></div></div>" +
        '<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Empresa</th><th>Responsáveis</th><th style="min-width:160px">Progresso</th><th>Faltando</th><th>Situação</th><th></th></tr></thead><tbody>' + linhas.map(function (l) { var faltam = l.c ? l.c.itens.filter(function (i) { return !i.feito; }).map(function (i) { return i.texto; }) : ["tudo"]; return '<tr><td><b>' + U.esc(l.e.fantasia) + '</b></td><td class="f-13">' + respHtml(l.e) + '</td><td><div class="f-12 txt-2">' + l.f + "/" + l.t + "</div>" + UI.barra(l.pct, l.ok ? "barra--ok" : "") + '</td><td class="f-12 txt-2">' + U.esc(faltam.slice(0, 2).join(", ")) + (faltam.length > 2 ? " +" + (faltam.length - 2) : "") + "</td><td>" + (l.nada ? UI.badge("nada este mês") : l.ok ? UI.badge("em dia", "ok", "check") : l.f === 0 ? UI.badge("não começou", "aviso") : UI.badge("em andamento", "info")) + '</td><td><div class="linha" style="gap:4px;flex-wrap:nowrap">' + (l.nada ? "" : '<button type="button" class="btn btn--xs btn--contorno" data-acao="cobrar-envio" data-id="' + l.e.id + '">' + ic("chat", "ic--sm") + "Cobrar</button>") + (l.c && !l.nada ? '<button type="button" class="btn btn--xs btn--contorno" data-acao="aceitar" data-id="' + l.e.id + '">' + ic("check", "ic--sm") + "Aceitar itens</button>" : "") + "</div></td></tr>"; }).join("") + "</tbody></table></div>" +
        '<div class="aviso aviso--info">' + ic("info") + "<div><b>Itens e prazos</b>Vêm de Conteúdo do portal › Envio do mês. Cada empresa só vê o que vale para ela: folha só com funcionários, maquininhas só quem tem. Quando o cliente anexa o arquivo em Meus arquivos dizendo qual item é, o item fecha sozinho; a cobrança automática avisa no chat o que passou do prazo.</div></div></div>");
      var v = Shell.view();
      UI.$("#selMes", v).addEventListener("change", function () { location.hash = "#/checklist?mes=" + this.value; });
      UI.delegar(v, {
        csv: function () { U.baixar("checklist-" + anoMes + ".csv", U.csv(linhas.map(function (l) { return [l.e.fantasia, l.e.cnpj, l.f, l.t, l.pct + "%", l.ok ? "concluído" : "aberto", l.c && l.c.concluidoEm ? U.data(l.c.concluidoEm) : ""]; }), ["Empresa", "CNPJ", "Feitos", "Total", "%", "Situação", "Concluído em"]), "text/csv;charset=utf-8"); },
        "cobrar-envio": function (b) { var l = linhas.filter(function (x) { return x.e.id === b.dataset.id; })[0]; textoCobrancaEnvio(l.e, anoMes).then(function (t) { mensagemPronta(l.e, { titulo: "Cobrar o Envio de " + nomeMes(anoMes) + " · " + l.e.fantasia, texto: t, assunto: "Envio do mês: o que falta de " + nomeMes(anoMes).split(" de ")[0], rota: "#/checklist" }); }); },
        aceitar: function (b) { var l = linhas.filter(function (x) { return x.e.id === b.dataset.id; })[0]; var itens = l.c.itens.map(function (i) { if (i.feito && !i.aceite) i.aceite = { por: sessao.nome, em: Date.now() }; return i; }); Dados.salvarChecklist(l.e.id, anoMes, { itens: itens }).then(function () { UI.toast("Itens enviados receberam o seu aceite.", "ok"); telaChecklist(r); }); }
      });
    });
  }

  /* ============================================================
     Vitrine e campanhas
     ============================================================ */
  /* Reduz a arte no navegador antes de subir (até 1600 px de largura, WebP ou JPEG): banner leve, portal rápido */
  function reduzirImagem(file, maxW) {
    return new Promise(function (res, rej) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var esc = Math.min(1, maxW / img.naturalWidth), w = Math.round(img.naturalWidth * esc), h = Math.round(img.naturalHeight * esc);
        var cv = document.createElement("canvas"); cv.width = w; cv.height = h; cv.getContext("2d").drawImage(img, 0, 0, w, h); URL.revokeObjectURL(url);
        cv.toBlob(function (b) { if (b && b.type === "image/webp") return res(b); cv.toBlob(function (j) { j ? res(j) : rej(new Error("imagem")); }, "image/jpeg", 0.86); }, "image/webp", 0.86);
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error("imagem")); };
      img.src = url;
    });
  }
  /* Prévia da arte nos lugares do portal: Início/Sistemas (inteira, 12:5) e menu lateral (recorte central 4:3).
     No quadro grande, o retângulo marca o que sobra no menu lateral. */
  function previaArte(url) {
    var u = U.esc(url), x = '<span class="banner__fechar" aria-hidden="true">' + ic("x", "ic--sm") + "</span>";
    return '<div class="imagem-banner__quadro"><img src="' + u + '" alt=""><span class="imagem-banner__guia" tabindex="0" role="slider" aria-label="Recorte do menu lateral: arraste ou use as setas" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50"><span class="imagem-banner__dica">' + ic("hand", "ic--sm") + "Arraste</span></span></div>" +
      '<div class="previa-arte"><div class="previa-arte__lugar"><span class="previa-arte__rotulo">Início e Sistemas · aparece inteira</span><div class="banner banner--imagem">' + x + '<span class="banner__arte"><img src="' + u + '" alt=""></span></div></div>' +
      '<div class="previa-arte__lugar previa-arte__lugar--lateral"><span class="previa-arte__rotulo">Menu lateral · só o retângulo</span><div class="previa-arte__menu"><div class="banner banner--imagem banner--compacto">' + x + '<span class="banner__arte"><img src="' + u + '" alt=""></span></div></div></div></div>';
  }
  /* Recorte arrastável: o retângulo marca o que aparece no menu lateral (4:3). A posição vira o ponto de foco
     da arte (object-position), que vale no menu lateral e, se a arte não for 12:5, também no Início. */
  function ligarRecorte(box, foco) {
    var q = box.querySelector(".imagem-banner__quadro"); if (!q) return;
    var img = q.querySelector("img"), g = q.querySelector(".imagem-banner__guia");
    var lim = function (n) { return Math.max(0, Math.min(100, n)); };
    function pronto() {
      var a = img.naturalWidth / img.naturalHeight || 2.4, gw = Math.min(1, (4 / 3) / a), gh = Math.min(1, a / (4 / 3)), ini = null;
      g.style.width = gw * 100 + "%"; g.style.height = gh * 100 + "%";
      function pos() {
        g.style.left = foco.x / 100 * (1 - gw) * 100 + "%"; g.style.top = foco.y / 100 * (1 - gh) * 100 + "%";
        g.setAttribute("aria-valuenow", Math.round(gw < 1 ? foco.x : foco.y));
        box.querySelectorAll(".previa-arte img").forEach(function (i) { i.style.objectPosition = Math.round(foco.x) + "% " + Math.round(foco.y) + "%"; });
      }
      box._centralizar = function () { foco.x = 50; foco.y = 50; pos(); };
      pos();
      g.addEventListener("pointerdown", function (ev) { ev.preventDefault(); try { g.setPointerCapture(ev.pointerId); } catch (e) {} var r = q.getBoundingClientRect(); ini = { px: ev.clientX, py: ev.clientY, x: foco.x, y: foco.y, w: r.width, h: r.height }; g.classList.add("arrastando"); });
      g.addEventListener("pointermove", function (ev) { if (!ini) return; var lx = (1 - gw) * ini.w, ly = (1 - gh) * ini.h; if (lx > 0) foco.x = lim(ini.x + (ev.clientX - ini.px) / lx * 100); if (ly > 0) foco.y = lim(ini.y + (ev.clientY - ini.py) / ly * 100); pos(); });
      var fim = function () { ini = null; g.classList.remove("arrastando"); };
      g.addEventListener("pointerup", fim); g.addEventListener("pointercancel", fim);
      g.addEventListener("keydown", function (ev) { var d = { ArrowLeft: [-2, 0], ArrowRight: [2, 0], ArrowUp: [0, -2], ArrowDown: [0, 2] }[ev.key]; if (!d) return; ev.preventDefault(); foco.x = lim(foco.x + d[0]); foco.y = lim(foco.y + d[1]); pos(); });
    }
    if (img.complete && img.naturalWidth) pronto(); else img.addEventListener("load", pronto);
  }
  function telaVitrine() {
    Shell.titulo("Vitrine e campanhas");
    Shell.render(UI.esqueleto(5));
    Promise.all([Dados.vitrine(), Dados.usos({ desde: Date.now() - 30 * U.DIA_MS })]).then(function (r) {
      var proprias = r[0], usos = r[1].filter(function (u) { return u.tipo === "vitrine"; });
      var stats = function (id) { var s = { impressao: 0, clique: 0, fechou: 0, interesse: 0 }; usos.forEach(function (u) { if (u.campanhaId === id && s[u.acao] !== undefined) s[u.acao]++; }); return s; };
      var card = function (c, padrao) { var s = CATALOGO.por(c.sistemaId); var st = stats(c.id); return '<div class="card sistema"><div class="sistema__topo">' + CATALOGO.selo(s) + '<div style="flex:1;min-width:0"><div class="sistema__nome">' + U.esc(c.titulo) + '</div><div class="sistema__tag">' + U.esc(s.nome) + " · " + (c.empresas && c.empresas.length ? U.plural(c.empresas.length, "só 1 empresa escolhida", "só " + c.empresas.length + " empresas escolhidas") : c.publico === "todos" ? "todas as empresas" : "quem não tem o sistema") + (c.gatilho ? " · por gatilho no chat" : "") + "</div></div>" + (c.ativo ? UI.badge("ativa", "ok") : UI.badge("pausada")) + '</div>' + (c.imagem && c.imagem.url ? '<img class="vitrine__miniatura" src="' + U.esc(c.imagem.url) + '" alt="' + U.esc(c.titulo) + '"' + (c.foco ? ' style="object-position:' + Number(c.foco.x) + "% " + Number(c.foco.y) + '%"' : "") + ">" : "") + '<div class="sistema__desc">' + U.esc(c.texto) + '</div><div class="f-12 txt-2">' + U.plural(st.impressao, "1 impressão", st.impressao + " impressões") + " · " + U.plural(st.clique, "1 clique", st.clique + " cliques") + " · " + st.fechou + " fechou · " + U.plural(st.interesse, "1 pedido", st.interesse + " pedidos") + '</div><div class="sistema__acoes">' + (padrao ? '<span class="badge">campanha pronta</span><button type="button" class="btn btn--xs btn--contorno" data-acao="clonar" data-id="' + c.id + '">' + ic("copy", "ic--sm") + 'Copiar e editar</button><button type="button" class="btn btn--xs btn--fantasma" data-acao="pausar-padrao" data-id="' + c.id + '">' + (c.ativo ? "Pausar" : "Ativar") + "</button>" : '<button type="button" class="btn btn--xs btn--contorno" data-acao="editar" data-id="' + c.id + '">' + ic("pencil", "ic--sm") + 'Editar</button><button type="button" class="btn btn--xs btn--fantasma" data-acao="remover" data-id="' + c.id + '" aria-label="Remover campanha" title="Remover campanha">' + ic("trash", "ic--sm") + "</button>") + "</div></div>"; };
      Shell.render('<div class="pagina"><div class="cabecalho"><div><div class="cabecalho__kicker">Propaganda ética</div><h1>Vitrine e campanhas</h1><p>Uma campanha por vez no portal, no máximo 2 impressões por pessoa, some 14 dias ao fechar. Sem som, sem vibração, sem escassez falsa.</p></div><div class="cabecalho__acoes"><button type="button" class="btn btn--primario" data-acao="nova">' + ic("plus") + "Nova campanha</button></div></div>" +
        '<h2>Suas campanhas</h2>' + (proprias.length ? '<div class="grade grade--3">' + proprias.map(function (c) { return card(c, false); }).join("") + "</div>" : UI.vazio("megaphone", "Nenhuma campanha própria", "Enquanto isso o portal usa as campanhas padrão abaixo.")) +
        '<h2 class="mt-8">Campanhas padrão</h2><div class="grade grade--3">' + CATALOGO.VITRINE.map(function (c) { return card(c, true); }).join("") + "</div>" +
        '<h2 class="mt-8">Quantos clientes já usam</h2><p class="f-13 txt-2">Os anúncios do portal mostram "N clientes da Totali já usam". Use o número real: quantas empresas têm o sistema liberado hoje.</p><div class="card"><div class="card__corpo grade grade--4">' + CATALOGO.visiveis().map(function (s) { var n = empresas.filter(function (e) { var l = (e.liberacoes || {})[s.id]; return l && l.ativo; }).length; return '<div class="f-13"><b>' + U.esc(s.nome) + '</b><div class="txt-2">' + U.plural(n, "1 cliente usa hoje", n + " clientes usam hoje") + " · o anúncio mostra " + s.prova + "</div>" + (n === s.prova ? '<span class="f-12 txt-ok mt-4" style="display:inline-block">' + ic("check", "ic--sm") + " atualizado</span>" : '<button type="button" class="btn btn--xs btn--contorno mt-4" data-acao="prova" data-s="' + s.id + '" data-n="' + n + '">Mostrar ' + n + " no anúncio</button>") + "</div>"; }).join("") + "</div></div></div>");
      var v = Shell.view();
      function editor(c) {
        c = c || { id: "c_" + U.id().slice(-8), sistemaId: "ponto", titulo: "", texto: "", cta: "Conhecer", publico: "sem-sistema", ativo: true, prioridade: 1, gatilho: false };
        var novaImagem = null, tirarImagem = false, foco = { x: c.foco && c.foco.x != null ? Number(c.foco.x) : 50, y: c.foco && c.foco.y != null ? Number(c.foco.y) : 50 };
        setTimeout(function () {
          var inp = document.getElementById("vImg"), box = document.getElementById("vImgBox"), tirar = document.getElementById("vImgTirar"), centro = document.getElementById("vImgCentro");
          if (box) ligarRecorte(box, foco);
          if (centro) centro.addEventListener("click", function () { if (box._centralizar) box._centralizar(); });
          if (inp) inp.addEventListener("change", function () {
            var f = inp.files[0]; if (!f) return;
            if (!/^image\/(png|jpeg|webp)$/.test(f.type)) return UI.toast("Use PNG, JPG ou WebP.", "aviso");
            reduzirImagem(f, 1600).then(function (blob) { novaImagem = blob; tirarImagem = false; foco.x = 50; foco.y = 50; box.innerHTML = previaArte(URL.createObjectURL(blob)); ligarRecorte(box, foco); if (centro) centro.hidden = false; UI.toast("Imagem pronta (" + Math.round(blob.size / 1024) + " KB). Confira a prévia e salve para publicar.", "ok"); }).catch(function () { UI.toast("Não consegui ler essa imagem.", "erro"); });
          });
          if (tirar) tirar.addEventListener("click", function () { tirarImagem = true; novaImagem = null; if (centro) centro.hidden = true; box.innerHTML = '<span class="f-12 txt-2">A imagem sai quando você salvar.</span>'; });
        }, 0);
        UI.modal({ titulo: c.titulo ? "Editar campanha" : "Nova campanha", corpo: '<div class="pilha"><div class="campo"><label class="campo__rotulo">Sistema</label><select class="select" id="vS">' + CATALOGO.visiveis().map(function (s) { return '<option value="' + s.id + '"' + (s.id === c.sistemaId ? " selected" : "") + ">" + U.esc(s.nome) + "</option>"; }).join("") + '</select></div>' + '<div class="campo"><span class="campo__rotulo">Imagem do banner (opcional)</span><div class="imagem-banner" id="vImgBox">' + (c.imagem && c.imagem.url ? previaArte(c.imagem.url) : '<span class="f-12 txt-2">Sem imagem: o banner usa o texto e as cores do sistema.</span>') + '</div><div class="linha" style="gap:6px"><label class="btn btn--sm btn--contorno" style="cursor:pointer">' + ic("upload", "ic--sm") + (c.imagem && c.imagem.url ? "Trocar imagem" : "Escolher imagem") + '<input type="file" id="vImg" accept="image/png,image/jpeg,image/webp" hidden></label>' + (c.imagem && c.imagem.url ? '<button type="button" class="btn btn--sm btn--fantasma" id="vImgTirar">' + ic("trash", "ic--sm") + "Tirar imagem</button>" : "") + '<button type="button" class="btn btn--sm btn--fantasma" id="vImgCentro"' + (c.imagem && c.imagem.url ? "" : " hidden") + ">" + ic("target", "ic--sm") + "Centralizar recorte</button>" + '</div><span class="campo__ajuda">Arte pronta, feita por vocês: 1200 × 500 px (PNG, JPG ou WebP). Com imagem, o banner mostra só a arte, clicável; no menu lateral aparece só o que está dentro do retângulo: arraste o retângulo sobre a imagem para escolher. O título abaixo vira a descrição da imagem para leitores de tela.</span></div>' +
          '<div class="campo"><label class="campo__rotulo">Título (até 90)</label><input class="input" id="vT" maxlength="90" value="' + U.esc(c.titulo) + '"></div><div class="campo"><label class="campo__rotulo">Texto (até 240)</label><textarea class="textarea" id="vX" maxlength="240">' + U.esc(c.texto) + '</textarea></div><div class="grade grade--2"><div class="campo"><label class="campo__rotulo">Botão</label><input class="input" id="vC" maxlength="40" value="' + U.esc(c.cta) + '"></div><div class="campo"><label class="campo__rotulo">Prioridade (1 = primeiro)</label><input class="input num" id="vP" type="number" min="1" max="9" value="' + (c.prioridade || 1) + '"></div><div class="campo"><label class="campo__rotulo">Público</label><select class="select" id="vPub"><option value="sem-sistema"' + (c.publico === "sem-sistema" ? " selected" : "") + '>Quem não tem o sistema</option><option value="todos"' + (c.publico === "todos" ? " selected" : "") + '>Todas as empresas</option></select></div><div class="campo"><label class="campo__rotulo">Só estas empresas (opcional)</label><select class="select" id="vE" multiple style="min-height:80px">' + empresas.map(function (e) { return '<option value="' + e.id + '"' + ((c.empresas || []).indexOf(e.id) > -1 ? " selected" : "") + ">" + U.esc(e.fantasia) + "</option>"; }).join("") + '</select></div><div class="campo"><label class="campo__rotulo">Início</label><input class="input" type="date" id="vI" value="' + (c.inicio ? new Date(c.inicio).toISOString().slice(0, 10) : "") + '"></div><div class="campo"><label class="campo__rotulo">Fim</label><input class="input" type="date" id="vF" value="' + (c.fim ? new Date(c.fim).toISOString().slice(0, 10) : "") + '"></div></div><label class="checar"><input type="checkbox" id="vG"' + (c.gatilho ? " checked" : "") + "> Só aparece por gatilho (quando o cliente fala do assunto no chat)</label><label class=\"checar\"><input type=\"checkbox\" id=\"vA\"" + (c.ativo ? " checked" : "") + "> Ativa</label></div>",
          acoes: [{ rotulo: "Cancelar" }, { rotulo: "Salvar", classe: "btn--primario", ao: function (x) { var t = x.querySelector("#vT").value.trim(); if (!t) { UI.toast("Título obrigatório.", "aviso"); return false; } var emps = Array.prototype.map.call(x.querySelector("#vE").selectedOptions, function (o) { return o.value; }); var antes = c.imagem || null;
            var passo = novaImagem ? Dados.guardarImagemVitrine(c.id, novaImagem).then(function (img) { if (antes && antes.path) Dados.removerImagemVitrine(antes.path); return img; }) : tirarImagem ? Dados.removerImagemVitrine(antes && antes.path).then(function () { return null; }) : Promise.resolve(antes);
            UI.toast(novaImagem ? "Enviando a imagem…" : "Salvando…", "info");
            passo.then(function (imagem) { return Dados.salvarCampanha({ id: c.id, imagem: imagem, foco: imagem ? { x: Math.round(foco.x), y: Math.round(foco.y) } : null, sistemaId: x.querySelector("#vS").value, titulo: t, texto: x.querySelector("#vX").value.trim(), cta: x.querySelector("#vC").value.trim() || "Conhecer", publico: x.querySelector("#vPub").value, empresas: emps.length ? emps : null, prioridade: Number(x.querySelector("#vP").value) || 1, gatilho: x.querySelector("#vG").checked, ativo: x.querySelector("#vA").checked, inicio: x.querySelector("#vI").value ? new Date(x.querySelector("#vI").value).getTime() : 0, fim: x.querySelector("#vF").value ? new Date(x.querySelector("#vF").value + "T23:59:59").getTime() : 0 }); }).then(function () { UI.toast("Campanha salva.", "ok"); telaVitrine(); }).catch(function (err) { UI.toast("Não foi possível salvar: " + (err && err.message || "erro"), "erro"); }); } }] });
      }
      UI.delegar(v, {
        nova: function () { editor(null); },
        editar: function (b) { editor(proprias.filter(function (c) { return c.id === b.dataset.id; })[0]); },
        clonar: function (b) { var c = U.clonar(CATALOGO.VITRINE.filter(function (x) { return x.id === b.dataset.id; })[0]); c.id = "c_" + U.id().slice(-8); editor(c); },
        remover: function (b) { UI.confirmar("Remover campanha?", "Ela some do portal na hora.", { ok: "Remover", perigo: true }).then(function (ok) { if (!ok) return; var c = proprias.filter(function (x) { return x.id === b.dataset.id; })[0]; Dados.removerCampanha(b.dataset.id).then(function () { if (c && c.imagem && c.imagem.path) Dados.removerImagemVitrine(c.imagem.path); telaVitrine(); }); }); },
        /* campanhas prontas também se pausam pela tela: a lista vai para conteudo/catalogo.vitrine */
        "pausar-padrao": function (b) { Dados.conteudo("catalogo").then(function (cat) { cat = cat || { sistemas: [] }; var lista = CATALOGO.VITRINE.map(function (x) { var y = U.clonar(x); if (y.id === b.dataset.id) y.ativo = !y.ativo; return y; }); return Dados.salvarConteudo("catalogo", { sistemas: cat.sistemas || [], vitrine: lista }, sessao).then(function () { CATALOGO.aplicar({ vitrine: lista }); UI.toast("Campanha " + (lista.filter(function (x) { return x.id === b.dataset.id; })[0].ativo ? "ativada." : "pausada."), "ok"); telaVitrine(); }); }); },
        prova: function (b) { Dados.conteudo("catalogo").then(function (cat) { cat = cat || { sistemas: [] }; var lista = (cat.sistemas || []).filter(function (s) { return s.id !== b.dataset.s; }); var atual = (cat.sistemas || []).filter(function (s) { return s.id === b.dataset.s; })[0] || { id: b.dataset.s }; atual.prova = Number(b.dataset.n); lista.push(atual); return Dados.salvarConteudo("catalogo", { sistemas: lista, vitrine: cat.vitrine || null }, sessao).then(function () { CATALOGO.aplicar({ sistemas: lista }); UI.toast("Prova social atualizada com o número real.", "ok"); telaVitrine(); }); }); }
      });
    });
  }

  /* ============================================================
     Uso e cobrança
     ============================================================ */
  function telaUso(r) {
    Shell.titulo("Uso e cobrança");
    var dias = Number(r.query.dias) || 30, sis = r.query.sistema || "", emp = r.query.empresa || "";
    Shell.render(UI.esqueleto(6));
    Dados.usos({ desde: Date.now() - dias * U.DIA_MS, sistemaId: sis || undefined, empresaId: emp || undefined }).then(function (usos) {
      var ag = Uso.agregar(usos, empresas);
      var porEmp = U.agrupar(ag, function (x) { return x.empresaId; });
      var totalAb = U.soma(ag, function (x) { return x.aberturas; }), totalMin = Math.round(U.soma(ag, function (x) { return x.segundos; }) / 60);
      var porDia = Uso.porDia(usos, Math.min(dias, 30)), max = Math.max.apply(null, Object.keys(porDia).map(function (k) { return porDia[k]; }).concat([1]));
      var q = function (o) { var p = { dias: dias, sistema: sis, empresa: emp }; Object.assign(p, o); return "#/uso?dias=" + p.dias + (p.sistema ? "&sistema=" + p.sistema : "") + (p.empresa ? "&empresa=" + p.empresa : ""); };
      Shell.render('<div class="pagina pagina--larga"><div class="cabecalho"><div><div class="cabecalho__kicker">Auditoria de uso</div><h1>Uso e cobrança</h1><p>Quem está usando o portal e cada sistema, quantas vezes, por quanto tempo e em que aparelho. Exporte para informar e cobrar.</p></div><div class="cabecalho__acoes"><button type="button" class="btn btn--primario" data-acao="csv">' + ic("download") + 'Exportar CSV</button><button type="button" class="btn btn--contorno" data-acao="cobranca">' + ic("receipt") + "Relatório de cobrança</button></div></div>" +
        '<div class="linha"><div class="segmentos">' + [7, 30, 90].map(function (d) { return '<button type="button" data-acao="ir" data-h="' + q({ dias: d }) + '" aria-pressed="' + (d === dias) + '">' + d + " dias</button>"; }).join("") + '</div><select class="select" style="min-height:36px;width:auto" data-acao="sel-sis"><option value="">Todos os sistemas</option>' + CATALOGO.SISTEMAS.map(function (s) { return '<option value="' + s.id + '"' + (s.id === sis ? " selected" : "") + ">" + U.esc(s.nome) + "</option>"; }).join("") + '<option value="checklist"' + (sis === "checklist" ? " selected" : "") + '>Envio do mês</option><option value="portal"' + (sis === "portal" ? " selected" : "") + '>Portal (telas)</option></select><select class="select" style="min-height:36px;width:auto" data-acao="sel-emp"><option value="">Todas as empresas</option>' + empresas.map(function (e) { return '<option value="' + e.id + '"' + (e.id === emp ? " selected" : "") + ">" + U.esc(e.fantasia) + "</option>"; }).join("") + "</select></div>" +
        '<div class="grade grade--4"><div class="card kpi"><span class="kpi__rotulo">' + ic("zap") + 'Aberturas</span><span class="kpi__valor">' + U.num(totalAb) + '</span></div><div class="card kpi"><span class="kpi__rotulo">' + ic("clock") + 'Minutos de uso</span><span class="kpi__valor">' + U.num(totalMin) + '</span></div><div class="card kpi"><span class="kpi__rotulo">' + ic("building") + 'Empresas ativas</span><span class="kpi__valor">' + Object.keys(porEmp).length + '<small>de ' + empresas.length + '</small></span></div><div class="card kpi kpi--gold"><span class="kpi__rotulo">' + ic("smile") + 'No celular</span><span class="kpi__valor">' + U.pct(U.soma(ag, function (x) { return x.celular; }), U.soma(ag, function (x) { return x.celular + x.computador; }) || 1) + "%</span></div></div>" +
        '<div class="card"><div class="card__cab"><h2>Aberturas por dia</h2></div><div class="card__corpo" style="padding-top:10px"><div style="display:flex;gap:3px;align-items:flex-end;height:90px">' + Object.keys(porDia).map(function (k) { var v = porDia[k]; return '<div title="' + k + ": " + v + '" style="flex:1;border-radius:3px 3px 0 0;background:var(--primary);height:' + Math.max(3, Math.round(v / max * 84)) + 'px"></div>'; }).join("") + "</div></div></div>" +
        '<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Empresa</th><th>Sistema</th><th class="num">Aberturas</th><th class="num">Minutos</th><th class="num">Dias ativos</th><th class="num">Pessoas</th><th>Último uso</th><th>Aparelho</th></tr></thead><tbody>' + (ag.map(function (x) { var s = CATALOGO.por(x.sistemaId); return '<tr><td><a href="#/clientes/' + x.empresaId + '/uso"><b>' + U.esc(x.empresa) + "</b></a></td><td>" + U.esc(CATALOGO.nomeDe(x.sistemaId)) + '</td><td class="num">' + x.aberturas + '</td><td class="num">' + Math.round(x.segundos / 60) + '</td><td class="num">' + x.diasAtivos + '</td><td class="num">' + x.qtdPessoas + '</td><td class="f-12">' + U.relativo(x.ultimo) + '</td><td class="f-12">' + (x.celular > x.computador ? "celular" : "computador") + "</td></tr>"; }).join("") || '<tr><td colspan="8" class="txt-2">Sem uso no período.</td></tr>') + "</tbody></table></div>" +
        '<h2>Sem uso no período</h2><div class="linha">' + empresas.filter(function (e) { return !porEmp[e.id]; }).map(function (e) { return '<a class="chip" href="#/mensagens/' + e.id + '">' + U.esc(e.fantasia) + "</a>"; }).join("") + "</div></div>");
      var v = Shell.view();
      v.querySelector("[data-acao=sel-sis]").addEventListener("change", function () { location.hash = q({ sistema: this.value }); });
      v.querySelector("[data-acao=sel-emp]").addEventListener("change", function () { location.hash = q({ empresa: this.value }); });
      UI.delegar(v, {
        ir: function (b) { location.hash = b.dataset.h; },
        csv: function () { U.baixar("uso-" + dias + "d.csv", Uso.csv(ag), "text/csv;charset=utf-8"); },
        cobranca: function () {
          var linhas = [];
          Object.keys(porEmp).forEach(function (id) { var e = empresas.filter(function (x) { return x.id === id; })[0] || {}; porEmp[id].forEach(function (x) { if (x.sistemaId === "portal") return; var l = (e.liberacoes || {})[x.sistemaId] || {}; linhas.push([e.fantasia, e.cnpj, CATALOGO.por(x.sistemaId) ? CATALOGO.por(x.sistemaId).nome : x.sistemaId, l.plano || "sem plano", x.aberturas, Math.round(x.segundos / 60), x.diasAtivos, U.data(x.ultimo)]); }); });
          U.baixar("cobranca-" + U.anoMes(Date.now()) + ".csv", U.csv(linhas, ["Empresa", "CNPJ", "Sistema", "Plano", "Aberturas", "Minutos", "Dias ativos", "Último uso"]), "text/csv;charset=utf-8");
          UI.toast("Relatório de cobrança gerado: um sistema por linha, com plano e uso.", "ok");
        }
      });
    });
  }

  /* ============================================================
     Equipe, conteúdo, segurança, perfil
     ============================================================ */
  function telaEquipe() {
    if (!admin()) { location.hash = "#/inicio"; return; }
    Shell.titulo("Equipe");
    Dados.equipe().then(function (eq) {
      Shell.render('<div class="pagina"><div class="cabecalho"><div><div class="cabecalho__kicker">Administração</div><h1>Equipe</h1><p>Quem entra no painel. Administrador vê Uso, Equipe e Segurança; os demais atendem.</p></div><div class="cabecalho__acoes"><button type="button" class="btn btn--primario" data-acao="novo">' + ic("plus") + 'Adicionar</button></div></div><div class="card"><div class="lista">' + eq.map(function (m) { return '<div class="lista__item">' + UI.avatar(m.nome, "avatar--gold avatar-sm") + '<div class="lista__texto"><span class="lista__titulo">' + U.esc(m.nome) + " " + (m.papel === "admin" ? UI.badge("admin", "gold") : "") + '</span><span class="lista__sub">' + U.esc(m.email) + " · " + U.esc(m.setor || "") + '</span></div><button type="button" class="btn btn--xs btn--contorno" data-acao="editar" data-uid="' + m.uid + '" aria-label="Editar ' + U.esc(m.nome) + '" title="Editar">' + ic("pencil", "ic--sm") + "</button>" + (m.uid !== sessao.uid ? '<button type="button" class="btn btn--xs btn--fantasma" data-acao="remover" data-uid="' + m.uid + '" aria-label="Remover ' + U.esc(m.nome) + ' da equipe" title="Remover da equipe">' + ic("trash", "ic--sm") + "</button>" : "") + "</div>"; }).join("") + "</div></div>" + (Dados.ehDemo() ? "" : '<div class="aviso aviso--info">' + ic("info") + "<div><b>No Firebase</b>a pessoa precisa existir no Authentication (e-mail/senha). Crie-a no console e informe aqui o UID: é o documento em /usuarios/{uid} que dá acesso ao painel.</div></div>") + "</div>");
      function editor(m) {
        m = m || { nome: "", email: "", papel: "equipe", setor: "" };
        UI.modal({ titulo: m.uid ? "Editar" : "Adicionar à equipe", corpo: '<div class="pilha"><div class="campo"><label class="campo__rotulo">Nome</label><input class="input" id="mN" value="' + U.esc(m.nome) + '"></div><div class="campo"><label class="campo__rotulo">E-mail</label><input class="input" id="mE" type="email" value="' + U.esc(m.email) + '"></div>' + (Dados.ehDemo() ? "" : '<div class="campo"><label class="campo__rotulo">UID (Authentication)</label><input class="input mono" id="mU" value="' + U.esc(m.uid || "") + '"' + (m.uid ? " readonly" : "") + "></div>") + '<div class="campo"><label class="campo__rotulo">Setor / função</label><input class="input" id="mS" value="' + U.esc(m.setor || "") + '"></div><div class="campo"><span class="campo__rotulo">Departamentos que confere (vazio = todos)</span><div class="linha">' + [["societario", "Societário"], ["contabil", "Contábil"], ["fiscal", "Fiscal"], ["trabalhista", "Dep. Pessoal"], ["socios", "Sócios"], ["financeiro", "Financeiro"]].map(function (d) { return '<label class="checar"><input type="checkbox" name="mDep" value="' + d[0] + '"' + ((m.setores || []).indexOf(d[0]) > -1 ? " checked" : "") + "> " + d[1] + "</label>"; }).join("") + "</div></div>" + '<div class="campo"><label class="campo__rotulo">Papel</label><select class="select" id="mP"><option value="equipe"' + (m.papel === "equipe" ? " selected" : "") + '>Equipe</option><option value="admin"' + (m.papel === "admin" ? " selected" : "") + ">Administrador</option></select></div></div>",
          acoes: [{ rotulo: "Cancelar" }, { rotulo: "Salvar", classe: "btn--primario", ao: function (c) { var dados = { uid: m.uid || (c.querySelector("#mU") ? c.querySelector("#mU").value.trim() : ""), nome: c.querySelector("#mN").value.trim(), email: c.querySelector("#mE").value.trim().toLowerCase(), setor: c.querySelector("#mS").value.trim(), papel: c.querySelector("#mP").value, setores: Array.prototype.map.call(c.querySelectorAll("[name=mDep]:checked"), function (i) { return i.value; }) }; if (!dados.nome || !U.emailValido(dados.email)) { UI.toast("Nome e e-mail válidos, por favor.", "aviso"); return false; } Dados.salvarMembro(dados, sessao).then(function () { UI.toast("Salvo.", "ok"); telaEquipe(); }).catch(function (e) { UI.toast(e.message, "erro"); }); } }] });
      }
      UI.delegar(Shell.view(), { novo: function () { editor(null); }, editar: function (b) { editor(eq.filter(function (m) { return m.uid === b.dataset.uid; })[0]); }, remover: function (b) { UI.confirmar("Remover da equipe?", "A pessoa perde o acesso ao painel na hora.", { ok: "Remover", perigo: true }).then(function (ok) { if (ok) Dados.removerMembro(b.dataset.uid, sessao).then(telaEquipe); }); } });
    });
  }

  /* Cartão de edição de um sistema (Conteúdo › Sistemas). Tudo pela interface: nome, cor, ícone, endereço, público, textos. */
  function cartaoSistema(s, novo) {
    s = s || { id: "", nome: "", cor: "#475569", icone: "grid", modo: "externo", url: "", status: "disponivel", publico: ["todos"], prova: 0, tagline: "", desc: "", beneficios: [], previa: { titulo: "", texto: "", itens: [] }, gatilhos: [], proprio: true };
    var p = s.previa || {}, campo = function (rot, html, ajuda) { return '<div class="campo"><label class="campo__rotulo">' + rot + "</label>" + html + (ajuda ? '<span class="campo__ajuda">' + ajuda + "</span>" : "") + "</div>"; };
    return '<details class="card sis-ed" data-s="' + U.esc(s.id) + '"' + (novo ? " open" : "") + '><summary class="card__corpo linha sis-ed__cab">' + CATALOGO.selo(s, "sis-ed__selo selo-sistema--sm") + '<b class="sis-ed__nome">' + (U.esc(s.nome) || "Novo sistema") + "</b>" + (s.status === "breve" ? UI.badge("em breve") : "") + (s.oculto ? UI.badge("oculto") : "") + (s.proprio ? UI.badge("criado pela equipe", "gold") : "") + '<span class="esp"></span>' + ic("chevron-down", "ic--sm sis-ed__seta") + "</summary>" +
      '<div class="card__corpo pilha" style="padding-top:0"><div class="grade grade--3">' +
        campo("Nome", '<input class="input" data-campo="nome" maxlength="40" value="' + U.esc(s.nome) + '" placeholder="Ex.: Precify">') +
        campo("Cor do selo", '<input class="input sis-ed__cor" type="color" data-campo="cor" value="' + U.esc(s.cor) + '">') +
        campo("Ícone (quando não há logo)", '<details class="sis-ed__icones"><summary class="btn btn--sm btn--contorno"><span class="sis-ed__ic-atual">' + ic(s.icone, "ic--sm") + "</span>Trocar ícone</summary><div class=\"sis-ed__grade\" role=\"radiogroup\" aria-label=\"Ícone\">" + (ic.nomes ? ic.nomes() : [s.icone]).map(function (n) { return '<label title="' + n + '"><input type="radio" name="ic-' + U.esc(s.id || "novo") + "-" + Math.random().toString(36).slice(2, 6) + '" value="' + n + '"' + (n === s.icone ? " checked" : "") + ">" + ic(n) + "</label>"; }).join("") + '</div></details><input type="hidden" data-campo="icone" value="' + U.esc(s.icone) + '">') +
      "</div>" +
        campo("Logo (opcional)", '<div class="linha sis-ed__logo"><span class="sis-ed__logo-previa">' + (s.logo && s.logo.url ? '<img src="' + U.esc(s.logo.url) + '" alt="">' : '<span class="f-12 txt-2">Sem logo: o selo usa o ícone e a cor.</span>') + '</span><label class="btn btn--sm btn--contorno" style="cursor:pointer">' + ic("upload", "ic--sm") + '<span data-rotulo-logo>' + (s.logo && s.logo.url ? "Trocar logo" : "Enviar logo") + '</span><input type="file" data-logo accept="image/png,image/jpeg,image/webp" hidden></label><button type="button" class="btn btn--sm btn--fantasma" data-acao="tirar-logo"' + (s.logo && s.logo.url ? "" : " hidden") + ">" + ic("trash", "ic--sm") + "Tirar logo</button></div>" + '<input type="hidden" data-campo="logoUrl" value="' + U.esc(s.logo && s.logo.url || "") + '"><input type="hidden" data-campo="logoPath" value="' + U.esc(s.logo && s.logo.path || "") + '">', "A logo real do sistema, no lugar do ícone. Quadrada e com fundo transparente fica melhor (PNG ou WebP).") +
      '<div class="grade grade--3">' +
        campo("Endereço (https)", '<input class="input" data-campo="url" value="' + U.esc(s.url) + '" placeholder="https://…">', "Vazio = ainda sem endereço.") +
        campo("Como abre", '<select class="select" data-campo="modo"><option value="externo"' + (s.modo !== "embutido" ? " selected" : "") + '>Em aba nova</option><option value="embutido"' + (s.modo === "embutido" ? " selected" : "") + ">Dentro do portal</option></select>") +
        campo("Situação", '<select class="select" data-campo="status"><option value="disponivel"' + (s.status !== "breve" ? " selected" : "") + '>Disponível</option><option value="breve"' + (s.status === "breve" ? " selected" : "") + ">Em breve (lista de espera)</option></select>") +
      "</div>" +
        campo("Para quem faz sentido", '<div class="linha">' + CATALOGO.PERFIS.map(function (x) { return '<label class="checar"><input type="checkbox" data-campo="publico" value="' + x.id + '"' + ((s.publico || []).indexOf(x.id) > -1 ? " checked" : "") + "> " + U.esc(x.rotulo) + "</label>"; }).join("") + "</div>", "Define em quais empresas o sistema aparece como sugestão.") +
      '<div class="grade grade--2">' +
        campo("Frase curta", '<input class="input" data-campo="tagline" maxlength="80" value="' + U.esc(s.tagline) + '">') +
        campo("Clientes usando hoje", '<input class="input num" type="number" min="0" data-campo="prova" value="' + (s.prova || 0) + '">', "Número real; aparece como \"N clientes da Totali já usam\".") +
      "</div>" +
        campo("Descrição", '<textarea class="textarea" data-campo="desc" maxlength="300" style="min-height:64px">' + U.esc(s.desc) + "</textarea>") +
        campo("O que o cliente ganha (um por linha)", '<textarea class="textarea" data-campo="beneficios" style="min-height:76px">' + U.esc((s.beneficios || []).join("\n")) + "</textarea>") +
      '<div class="grade grade--2">' +
        campo("Prévia para quem não tem: título", '<input class="input" data-campo="previaTitulo" maxlength="80" value="' + U.esc(p.titulo || "") + '">') +
        campo("Palavras no chat que sugerem este sistema", '<input class="input" data-campo="gatilhos" value="' + U.esc((s.gatilhos || []).join(", ")) + '" placeholder="ex.: preço, margem">', "Separe por vírgula.") +
      "</div>" +
        campo("Prévia: texto", '<textarea class="textarea" data-campo="previaTexto" maxlength="400" style="min-height:64px">' + U.esc(p.texto || "") + "</textarea>") +
        campo("Prévia: itens (um por linha)", '<textarea class="textarea" data-campo="previaItens" style="min-height:64px">' + U.esc((p.itens || []).join("\n")) + "</textarea>") +
      '<div class="linha"><label class="checar"><input type="checkbox" data-campo="oculto"' + (s.oculto ? " checked" : "") + "> Ocultar do portal (o cliente deixa de ver)</label><span class=\"esp\"></span>" + (s.proprio ? '<button type="button" class="btn btn--sm btn--perigo" data-acao="excluir-sis">' + ic("trash", "ic--sm") + "Excluir sistema</button>" : "") + "</div></div></details>";
  }
  function slugSistema(nome, usados) {
    var base = String(nome || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 26);
    if (base.length < 2 || ["checklist", "portal", "previa"].indexOf(base) > -1) base = "sis-" + U.id().slice(-5).toLowerCase().replace(/[^a-z0-9]/g, "x");
    var id = base, n = 2; while (usados[id] || CATALOGO.por(id)) { id = base + "-" + n++; }
    return id;
  }
  function telaConteudo(r) {
    Shell.titulo("Conteúdo do portal");
    var aba = r.param || "jornada";
    Shell.render(UI.esqueleto(6));
    Promise.all([Dados.conteudo("jornada"), Dados.conteudo("catalogo")]).then(function (res) {
      var conteudoJ = res[0], conteudoC = res[1];
      var html = '<div class="pagina"><div class="cabecalho"><div><div class="cabecalho__kicker">Administração</div><h1>Conteúdo do portal</h1><p>Nada por código: o que você salva aqui o portal lê na hora.</p></div></div><div class="abas"><a class="btn btn--fantasma" style="border-radius:0" role="tab" aria-selected="' + (aba === "jornada") + '" href="#/conteudo/jornada">Jornada de 30 dias</a><a class="btn btn--fantasma" style="border-radius:0" role="tab" aria-selected="' + (aba === "catalogo") + '" href="#/conteudo/catalogo">Sistemas</a>' + ((global.ConteudoExtra ? global.ConteudoExtra.ABAS : []).map(function (a) { return '<a class="btn btn--fantasma" style="border-radius:0" role="tab" aria-selected="' + (aba === a[0]) + '" href="#/conteudo/' + a[0] + '">' + a[1] + "</a>"; }).join("")) + '</div>';
      if (aba === "jornada") {
        html += '<div class="aviso aviso--info">' + ic("info") + '<div><b>Dias (D) e passos (P)</b>Edite o texto de cada passo. "Auto" liga o passo a um fato que o sistema confirma sozinho. Reordene pelos números dos dias.' + (conteudoJ ? " Última publicação: " + U.dataHora(conteudoJ.atualizadoEm) + " por " + U.esc(conteudoJ.por || "") : " Usando o padrão do treinamento.") + "</div></div>" +
          '<div class="pilha" id="edJornada">' + JORNADA.DIAS.map(function (d, di) {
            var passos = function (lado) { return d[lado].map(function (p, i) { return '<div class="linha" style="flex-wrap:nowrap;gap:6px"><span class="passo__p">P' + (i + 1) + '</span><input class="input" style="min-height:36px" aria-label="Passo ' + (i + 1) + (lado === "cliente" ? " do cliente" : " da equipe") + '" data-lado="' + lado + '" data-i="' + i + '" value="' + U.esc(p.texto) + '"><select class="select" style="min-height:36px;width:190px" aria-label="Como o passo ' + (i + 1) + ' é concluído" data-auto="' + lado + '" data-i="' + i + '"><option value="">manual</option>' + JORNADA.AUTOMACOES.map(function (a) { return '<option value="' + a.id + '"' + (a.id === p.auto ? " selected" : "") + ">auto: " + U.esc(a.rotulo) + "</option>"; }).join("") + '</select><button type="button" class="btn btn--icone btn--fantasma" data-acao="rm-passo" data-lado="' + lado + '" data-i="' + i + '" aria-label="Remover">' + ic("x", "ic--sm") + "</button></div>"; }).join("") + '<button type="button" class="btn btn--xs btn--contorno" data-acao="add-passo" data-lado="' + lado + '">' + ic("plus", "ic--sm") + "Passo</button>"; };
            return '<details class="card" data-di="' + di + '"' + (di === 0 ? " open" : "") + '><summary class="card__corpo linha" style="cursor:pointer"><b>D' + d.dia + " · " + U.esc(d.titulo) + "</b>" + (d.marco ? UI.badge("marco", "gold") : "") + '<span class="esp"></span><button type="button" class="btn btn--xs btn--fantasma" data-acao="rm-dia" aria-label="Remover dia">' + ic("trash", "ic--sm") + '</button></summary><div class="card__corpo pilha" style="padding-top:0"><div class="grade grade--2"><div class="campo"><label class="campo__rotulo">Dia (número)</label><input class="input num" type="number" min="0" max="120" data-campo="dia" value="' + d.dia + '"></div><div class="campo"><label class="campo__rotulo">Título</label><input class="input" data-campo="titulo" value="' + U.esc(d.titulo) + '"></div><div class="campo"><label class="campo__rotulo">Quem (equipe)</label><input class="input" data-campo="quem" value="' + U.esc(d.quem) + '"></div><div class="campo"><label class="checar" style="margin-top:22px"><input type="checkbox" data-campo="marco"' + (d.marco ? " checked" : "") + "> Marco</label></div></div>" +
              '<div class="campo"><label class="campo__rotulo">Objetivo (o cliente lê)</label><textarea class="textarea" data-campo="objetivo" style="min-height:60px">' + U.esc(d.objetivo) + '</textarea></div><div class="campo"><label class="campo__rotulo">Erro comum (só a equipe vê)</label><textarea class="textarea" data-campo="erro" style="min-height:60px">' + U.esc(d.erro) + "</textarea></div>" +
              '<div class="f-12 f-800 txt-2" style="letter-spacing:.06em;text-transform:uppercase">O cliente faz</div><div class="pilha" style="gap:6px" data-passos="cliente">' + passos("cliente") + '</div><div class="f-12 f-800 txt-2 mt-8" style="letter-spacing:.06em;text-transform:uppercase">A equipe faz</div><div class="pilha" style="gap:6px" data-passos="equipe">' + passos("equipe") + "</div></div></details>";
          }).join("") + '</div><div class="modal__acoes"><button type="button" class="btn btn--contorno" data-acao="add-dia">' + ic("plus") + 'Novo dia</button><button type="button" class="btn btn--contorno" data-acao="restaurar">' + ic("refresh") + 'Restaurar padrão</button><button type="button" class="btn btn--primario" data-acao="publicar">' + ic("check") + "Publicar jornada</button></div>";
      } else if (global.ConteudoExtra && global.ConteudoExtra[aba]) {
        html += '<div id="conteudoExtra">' + UI.esqueleto(4) + "</div>";
      } else {
        html += '<div class="aviso aviso--info">' + ic("info") + "<div><b>Sistemas que o cliente vê no portal</b>Crie, edite ou oculte. Cada sistema tem o seu cartão: toque para abrir. Endereço só https; <i>dentro do portal</i> exige que o sistema permita ser embutido, <i>aba nova</i> funciona com qualquer site. Nada vale até tocar em Publicar.</div></div>" +
          '<div class="linha"><button type="button" class="btn btn--contorno" data-acao="novo-sis">' + ic("plus") + 'Novo sistema</button></div><div class="pilha" id="edCat">' + CATALOGO.SISTEMAS.map(function (s) { return cartaoSistema(s, false); }).join("") + '</div><div class="modal__acoes"><button type="button" class="btn btn--primario" data-acao="publicar-cat">' + ic("check") + "Publicar sistemas</button></div>";
      }
      var v = Shell.render(html + "</div>");
      if (global.ConteudoExtra && global.ConteudoExtra[aba]) { global.ConteudoExtra[aba](UI.$("#conteudoExtra", v), sessao); return; }
      var ab = v.querySelector('.abas [aria-selected="true"]'); if (ab && ab.scrollIntoView) ab.scrollIntoView({ block: "nearest", inline: "center" });
      var edCat = UI.$("#edCat", v);
      if (edCat) edCat.addEventListener("input", function (ev) {
        var c = ev.target.closest("[data-s]"); if (!c) return; var k = ev.target.dataset.campo;
        if (k === "nome") c.querySelector(".sis-ed__nome").textContent = ev.target.value || "Novo sistema";
        if (ev.target.type === "radio" && ev.target.closest(".sis-ed__grade")) { c.querySelector('[data-campo="icone"]').value = ev.target.value; c.querySelector(".sis-ed__ic-atual").innerHTML = ic(ev.target.value, "ic--sm"); k = "icone"; }
        if ((k === "cor" || k === "icone") && !c.querySelector('[data-campo="logoUrl"]').value && !c._logoBlob) { var selo = c.querySelector(".sis-ed__selo"); selo.style.background = c.querySelector('[data-campo="cor"]').value; selo.innerHTML = ic(c.querySelector('[data-campo="icone"]').value, "ic--sm"); }
      });
      /* logo: reduz no navegador e só envia ao publicar */
      function mostrarLogo(c, url) {
        var selo = c.querySelector(".sis-ed__selo"), prev = c.querySelector(".sis-ed__logo-previa");
        if (url) { selo.classList.add("selo-sistema--logo"); selo.style.background = "#fff"; selo.innerHTML = '<img src="' + url + '" alt="">'; prev.innerHTML = '<img src="' + url + '" alt="">'; }
        else { selo.classList.remove("selo-sistema--logo"); selo.style.background = c.querySelector('[data-campo="cor"]').value; selo.innerHTML = ic(c.querySelector('[data-campo="icone"]').value, "ic--sm"); prev.innerHTML = '<span class="f-12 txt-2">Sem logo: o selo usa o ícone e a cor.</span>'; }
        c.querySelector('[data-acao="tirar-logo"]').hidden = !url; c.querySelector("[data-rotulo-logo]").textContent = url ? "Trocar logo" : "Enviar logo";
      }
      if (edCat) edCat.addEventListener("change", function (ev) {
        if (!ev.target.matches("[data-logo]")) return; var c = ev.target.closest("[data-s]"), f = ev.target.files[0]; if (!f) return;
        if (!/^image\/(png|jpeg|webp)$/.test(f.type)) return UI.toast("Use PNG, JPG ou WebP.", "aviso");
        reduzirImagem(f, 512).then(function (blob) { c._logoBlob = blob; c._tirarLogo = false; mostrarLogo(c, URL.createObjectURL(blob)); UI.toast("Logo pronta. Toque em Publicar sistemas para valer.", "ok"); }).catch(function () { UI.toast("Não consegui ler essa imagem.", "erro"); });
      });
      function lerJornada() {
        return UI.$$("#edJornada details", v).map(function (det, i) {
          var ler = function (c) { var el = det.querySelector('[data-campo="' + c + '"]'); return el ? (el.type === "checkbox" ? el.checked : el.value) : ""; };
          var passos = function (lado) { return UI.$$('[data-passos="' + lado + '"] input[data-lado]', det).map(function (inp) { var sel = det.querySelector('select[data-auto="' + lado + '"][data-i="' + inp.dataset.i + '"]'); return { texto: inp.value.trim(), auto: sel ? sel.value : "" }; }).filter(function (p) { return p.texto; }); };
          return { id: (JORNADA.DIAS[i] || {}).id || "d" + ler("dia"), dia: Number(ler("dia")), titulo: ler("titulo"), quem: ler("quem"), marco: ler("marco"), objetivo: ler("objetivo"), erro: ler("erro"), cliente: passos("cliente"), equipe: passos("equipe") };
        });
      }
      UI.delegar(v, {
        "add-passo": function (b) { var wrap = b.closest("[data-passos]"); var n = wrap.querySelectorAll("input[data-lado]").length; b.insertAdjacentHTML("beforebegin", '<div class="linha" style="flex-wrap:nowrap;gap:6px"><span class="passo__p">P' + (n + 1) + '</span><input class="input" style="min-height:36px" aria-label="Passo ' + (n + 1) + '" data-lado="' + b.dataset.lado + '" data-i="' + n + '" placeholder="Texto do passo"><select class="select" style="min-height:36px;width:190px" aria-label="Como o passo ' + (n + 1) + ' é concluído" data-auto="' + b.dataset.lado + '" data-i="' + n + '"><option value="">manual</option>' + JORNADA.AUTOMACOES.map(function (a) { return '<option value="' + a.id + '">auto: ' + U.esc(a.rotulo) + "</option>"; }).join("") + '</select><button type="button" class="btn btn--icone btn--fantasma" data-acao="rm-passo" aria-label="Remover">' + ic("x", "ic--sm") + "</button></div>"); },
        "rm-passo": function (b) { b.closest(".linha").remove(); },
        "rm-dia": function (b, e) { e.preventDefault(); b.closest("details").remove(); },
        "add-dia": function () { var dias = lerJornada(); dias.push({ id: "d" + U.id().slice(-4), dia: (dias[dias.length - 1] || { dia: 0 }).dia + 1, titulo: "Novo dia", quem: "", marco: false, objetivo: "", erro: "", cliente: [{ texto: "Primeiro passo" }], equipe: [{ texto: "Primeiro passo" }] }); JORNADA.aplicar({ dias: dias }); telaConteudo(r); },
        restaurar: function () { UI.confirmar("Restaurar a jornada padrão?", "Volta ao texto do treinamento. O andamento dos clientes não é apagado.", { ok: "Restaurar" }).then(function (ok) { if (!ok) return; JORNADA.aplicar({ dias: JORNADA.PADRAO }); Dados.salvarConteudo("jornada", { dias: JORNADA.PADRAO }, sessao).then(function () { UI.toast("Padrão restaurado.", "ok"); telaConteudo(r); }); }); },
        publicar: function () { var dias = lerJornada(); if (!JORNADA.aplicar({ dias: dias })) return UI.toast("Jornada inválida: cada dia precisa de título.", "erro"); Dados.salvarConteudo("jornada", { dias: JORNADA.DIAS.slice() }, sessao).then(function () { UI.toast("Jornada publicada. O portal já mostra.", "ok"); telaConteudo(r); }); },
        "tirar-logo": function (b) { var c = b.closest("[data-s]"); c._logoBlob = null; c._tirarLogo = true; c.querySelector('[data-campo="logoUrl"]').value = ""; mostrarLogo(c, ""); },
        "novo-sis": function () { var ed = UI.$("#edCat", v); ed.insertAdjacentHTML("afterbegin", cartaoSistema(null, true)); var novo = ed.firstElementChild; novo.open = true; novo.scrollIntoView({ block: "start", behavior: "smooth" }); var n = novo.querySelector('[data-campo="nome"]'); if (n) n.focus(); },
        "excluir-sis": function (b, ev) {
          ev.preventDefault(); var card = b.closest("[data-s]"), id = card.dataset.s;
          if (!id) { card.remove(); return; }
          var libs = empresas.filter(function (e) { var l = (e.liberacoes || {})[id]; return l && l.ativo; }).length;
          Dados.vitrine().then(function (camps) {
            var nc = camps.filter(function (c) { return c.sistemaId === id; }).length;
            if (libs || nc) return UI.toast("Não dá para excluir: " + [libs ? U.plural(libs, "1 cliente usa", libs + " clientes usam") : "", nc ? U.plural(nc, "1 campanha usa", nc + " campanhas usam") : ""].filter(Boolean).join(" e ") + ". Marque \"Ocultar do portal\" ou desligue antes.", "aviso", null, 8000);
            UI.confirmar("Excluir este sistema?", "Some do painel e do portal quando você publicar.", { ok: "Excluir", perigo: true }).then(function (ok) { if (ok) { card.remove(); UI.toast("Excluído. Toque em Publicar sistemas para confirmar.", "info"); } });
          });
        },
        "publicar-cat": function () {
          var ids = {}, erro = "";
          var cards = UI.$$("#edCat [data-s]", v);
          var sistemas = cards.map(function (c) {
            var ler = function (k) { var el = c.querySelector('[data-campo="' + k + '"]'); return el ? el.value : ""; };
            var lista = function (k) { return ler(k).split("\n").map(function (x) { return x.trim(); }).filter(Boolean); };
            var nome = ler("nome").trim(), id = c.dataset.s || slugSistema(nome, ids);
            if (!nome && !erro) { erro = "Todo sistema precisa de nome."; c.open = true; }
            ids[id] = true;
            return { id: id, nome: nome, cor: ler("cor"), icone: ler("icone"), url: ler("url").trim(), modo: ler("modo"), status: ler("status"), prova: Number(ler("prova")) || 0,
              publico: UI.$$('[data-campo="publico"]:checked', c).map(function (i) { return i.value; }), tagline: ler("tagline").trim(), desc: ler("desc").trim(), beneficios: lista("beneficios"),
              previa: { titulo: ler("previaTitulo").trim(), texto: ler("previaTexto").trim(), itens: lista("previaItens") }, gatilhos: ler("gatilhos").split(",").map(function (x) { return x.trim(); }).filter(Boolean),
              oculto: !!(c.querySelector('[data-campo="oculto"]') || {}).checked,
              logo: ler("logoUrl") ? { url: ler("logoUrl"), path: ler("logoPath") } : null };
          });
          if (erro) return UI.toast(erro, "erro");
          var ruim = sistemas.filter(function (s) { return s.url && !U.urlSegura(s.url); }); if (ruim.length) return UI.toast("Endereço inválido em " + ruim[0].nome + ": use https://", "erro");
          var excluidos = CATALOGO.SISTEMAS.filter(function (s) { return s.proprio && !ids[s.id]; });
          UI.toast("Publicando…", "info");
          Promise.all(cards.map(function (c, i) {
            var def = sistemas[i], antigo = c.querySelector('[data-campo="logoPath"]').value;
            if (c._logoBlob) return Dados.guardarLogoSistema(def.id, c._logoBlob).then(function (logo) { def.logo = logo; if (antigo) Dados.removerLogoSistema(antigo); });
            if (c._tirarLogo) { def.logo = null; if (antigo) Dados.removerLogoSistema(antigo); }
            return null;
          })).then(function () {
            excluidos.forEach(function (s) { if (s.logo && s.logo.path) Dados.removerLogoSistema(s.logo.path); CATALOGO.remover(s.id); });
            CATALOGO.aplicar({ sistemas: sistemas });
            return Dados.salvarConteudo("catalogo", { sistemas: sistemas, vitrine: (conteudoC || {}).vitrine || null }, sessao);
          }).then(function () { UI.toast("Sistemas publicados. O portal já mostra.", "ok"); telaConteudo(r); }).catch(function (err) { UI.toast("Não foi possível publicar: " + (err && err.message || "erro"), "erro"); });
        }
      });
    });
  }

  function telaSeguranca() {
    if (!admin()) { location.hash = "#/inicio"; return; }
    Shell.titulo("Segurança");
    Shell.render(UI.esqueleto(4));
    Promise.resolve(global.CHAVE_PUBLICA_PRONTA).then(function () { return Dados.chaveDoCofre ? Dados.chaveDoCofre().catch(function () { return null; }) : null; }).then(function (cofre) { telaSegurancaDesenhar(cofre); });
  }
  function telaSegurancaDesenhar(cofre) {
    if (cofre && cofre.chavePublica && cofre.chavePublica.n) global.CHAVE_PUBLICA = cofre.chavePublica;
    var pub = global.CHAVE_PUBLICA;
    Shell.render('<div class="pagina"><div class="cabecalho"><div><div class="cabecalho__kicker">Administração</div><h1>Segurança</h1><p>Estado do canal seguro de senhas e do modo de operação.</p></div></div><div class="grade grade--2">' +
      '<div class="card"><div class="card__cab"><h2>Modo de operação</h2></div><div class="card__corpo pilha" style="padding-top:10px">' + (Dados.ehDemo() ? '<div class="aviso aviso--aviso">' + ic("alert") + "<div><b>Modo local (demonstração)</b>Sem Firebase configurado. Dados fictícios só neste navegador. Para ligar: js/firebase-config.js.</div></div>" : '<div class="aviso aviso--ok">' + ic("check-circle") + "<div><b>Firebase ligado</b>Projeto " + U.esc(global.FIREBASE_CONFIG.projectId) + "</div></div>") + "</div></div>" +
      '<div class="card"><div class="card__cab"><h2>Cofre de senhas</h2></div><div class="card__corpo pilha" style="padding-top:10px">' + (pub ? '<div class="aviso aviso--ok">' + ic("shield") + '<div><b>Canal seguro ligado</b>Impressão digital da chave: <span class="mono" id="fp">…</span>' + (cofre && cofre.trocadaEm ? '<br><span class="f-12">Trocada ' + U.esc(U.relativo(cofre.trocadaEm)) + (cofre.por ? " por " + U.esc(cofre.por) : "") + "</span>" : "") + "</div></div>" : '<div class="aviso aviso--aviso">' + ic("alert") + "<div><b>Sem chave do cofre</b>O cofre não aceita senhas até existir uma chave. Toque em Criar a chave do cofre.</div></div>") + '<button type="button" class="btn btn--sm btn--contorno" data-acao="trocar-chave">' + ic("key") + (pub ? "Trocar a chave do cofre" : "Criar a chave do cofre") + '</button><p class="f-12 txt-mudo">O servidor cria uma chave nova, cifra de novo todas as senhas guardadas e passa a usar a nova. A chave de abrir nunca sai do servidor. Troque se desconfiar que a chave vazou ou se alguém com acesso de administrador saiu da Totali.</p></div></div>' +
      '<div class="card"><div class="card__cab"><h2>Auditoria</h2></div><div class="card__corpo pilha" style="padding-top:10px"><p class="f-13 txt-2">Duas trilhas: <b>/uso</b> (o que o cliente usa, escrita pelo navegador dele, só create) e <b>/auditoria</b> (aprovações, senhas abertas, liberações; escrita pela Cloud Function com hora do servidor, fechada para todos). A segunda é a que vale como prova.</p><a class="btn btn--sm btn--contorno" href="#/uso">' + ic("bar-chart") + "Ver uso</a></div></div></div></div>");
    if (pub) Cripto.impressaoDigital(pub).then(function (fp) { var el = UI.$("#fp"); if (el) el.textContent = fp; });
    UI.delegar(Shell.view(), { "trocar-chave": function (bt) {
      UI.confirmar(pub ? "Trocar a chave do cofre?" : "Criar a chave do cofre?", "Leva de alguns segundos a poucos minutos. As senhas guardadas continuam abrindo normalmente durante e depois da troca. Fica registrado na auditoria.", { ok: pub ? "Trocar agora" : "Criar agora" }).then(function (ok) {
        if (!ok) return; bt.disabled = true; var t = UI.toast("Pedindo ao servidor…", "info", null, 600000);
        Dados.pedirAoServidor("pedidosDeTrocaDeChave", {}, 540000, function (d) { var x = d.etapa && t && t.querySelector && t.querySelector("div"); if (x) x.textContent = "Trocando a chave: " + d.etapa + "…"; })
          .then(function (d) { if (t && t.remove) t.remove(); return Dados.chaveDoCofre().then(function (c) { if (c && c.chavePublica) global.CHAVE_PUBLICA = c.chavePublica; UI.toast("Chave trocada. " + U.plural(d.recifradas || 0, "1 senha cifrada de novo", (d.recifradas || 0) + " senhas cifradas de novo") + (d.falhas ? "; " + d.falhas + " não abriram (veja a auditoria)" : "") + ".", d.falhas ? "aviso" : "ok", null, 9000); telaSeguranca(); }); })
          .catch(function (err) { if (t && t.remove) t.remove(); bt.disabled = false; UI.toast(err.message, "erro", null, 10000); });
      });
    } });
  }

  function telaPerfil() {
    Shell.titulo("Configurações");
    var tema = global.Tema.atual(), pref = UI.pref();
    Shell.render('<div class="pagina"><div class="cabecalho"><div><div class="cabecalho__kicker">Você</div><h1>' + U.esc(sessao.nome) + "</h1><p>" + U.esc(sessao.email) + " · " + U.esc(sessao.setor || sessao.papel) + '</p></div><div class="cabecalho__acoes"><button type="button" class="btn btn--contorno" data-acao="sair">' + ic("log-out") + "Sair</button></div></div>" +
      '<div class="grade grade--2"><div class="card"><div class="card__cab"><h2>Aparência</h2></div><div class="card__corpo pilha" style="padding-top:10px"><div class="segmentos" id="tema">' + [["claro", "sun", "Claro"], ["escuro", "moon", "Escuro"], ["sistema", "monitor", "Sistema"]].map(function (t) { return '<button type="button" data-v="' + t[0] + '" aria-pressed="' + (tema === t[0]) + '">' + ic(t[1], "ic--sm") + " " + t[2] + "</button>"; }).join("") + '</div><label class="interruptor"><input type="checkbox" id="pSom"' + (pref.som !== false ? " checked" : "") + '><span class="interruptor__pista"></span>' + ic("volume") + ' Som ao receber mensagem</label></div></div><div class="card"><div class="card__cab"><h2>Atalhos</h2></div><div class="card__corpo pilha ajuda-cmd f-13" style="padding-top:10px"><div><kbd>Ctrl</kbd> + <kbd>K</kbd> buscar cliente ou tela</div><div><kbd>Enter</kbd> envia no chat · <kbd>Shift</kbd>+<kbd>Enter</kbd> quebra linha</div></div></div>' + (Dados.ehDemo() ? '<div class="card"><div class="card__cab"><h2>Demonstração</h2></div><div class="card__corpo" style="padding-top:10px"><button type="button" class="btn btn--sm btn--perigo" data-acao="zerar">' + ic("refresh") + "Zerar dados fictícios</button></div></div>" : "") + "</div></div>");
    var v = Shell.view();
    UI.$$("#tema button", v).forEach(function (b) { b.addEventListener("click", function () { global.Tema.definir(b.dataset.v); Shell.redesenhar(); telaPerfil(); }); });
    UI.$("#pSom", v).addEventListener("change", function () { UI.definirPref("som", this.checked); });
    UI.delegar(v, { sair: sair, zerar: function () { UI.confirmar("Zerar a demonstração?", "Recria os dados fictícios.", { ok: "Zerar", perigo: true }).then(function (ok) { if (ok) Dados.zerar().then(function () { location.reload(); }); }); } });
  }

  iniciar();
})(window);
