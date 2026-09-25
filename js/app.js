/* ============================================================
   Totali · Portal do Cliente
   app.js — o portal que o CLIENTE vê: rotas, telas e eventos

   Telas: entrar · convite · inicio · jornada · sistemas ·
   sistemas/:id (prévia ou abrir) · abrir/:id (embutido) ·
   checklist · documentos · cofre · chat · perfil.

   Decisões de produto (docs/00-pesquisa-engajamento.md):
     • tela inicial com 4 ações e UM próximo passo (goal-gradient);
     • a jornada nasce com o D0 feito (endowed progress);
     • vitrine: um sistema por vez, no máximo 2 impressões por
       campanha, some por 14 dias ao fechar, gatilho por assunto;
     • celebração só em marco: 1º documento, D15, D30, mês em dia;
     • cada documento mostra "visto por X às HH:MM" (recibo).
   ============================================================ */
(function (global) {
  "use strict";
  var U = global.U, UI = global.UI, ic = global.ic, Dados = global.Dados, Shell = global.Shell, JORNADA = global.JORNADA, CATALOGO = global.CATALOGO, Uso = global.Uso, Chat = global.Chat, Cripto = global.Cripto;

  var TITULO = "Portal do Cliente · Totali";
  var app = document.getElementById("app");
  var sessao = null, empresa = null, chatAtual = null, docsCache = null, credCache = null, msgsCache = null;
  var GRUPOS_DOC = [
    { id: "certificado", rotulo: "Certificado digital", desc: "Arquivo A1 (.pfx) ou dados do A3" },
    { id: "societario", rotulo: "Societário", desc: "Contrato social, alterações, cartão CNPJ, alvará" },
    { id: "socios", rotulo: "Documentos dos sócios", desc: "RG, CPF ou CNH, comprovante de endereço, IR" },
    { id: "contabil", rotulo: "Contábil", desc: "Balancetes, balanço, livro razão" },
    { id: "fiscal", rotulo: "Fiscal", desc: "Declarações, SPED, guias pagas" },
    { id: "pessoal", rotulo: "Departamento pessoal", desc: "Fichas de registro, folha, rescisões" },
    { id: "mensal", rotulo: "Documentos do mês", desc: "Extratos, notas, maquininhas, comprovantes" },
    { id: "outros", rotulo: "Outros", desc: "Qualquer outro arquivo" }
  ];

  /* ============================================================
     Sessão e arranque
     ============================================================ */
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
      if (t === "sessao") { var s = Dados.sessao(); if (!!s !== !!sessao || (s && sessao && s.uid !== sessao.uid)) { sessao = s; empresa = null; (s ? carregarConteudo() : Promise.resolve()).then(rotear); } return; }
      if (["mensagem", "lidas", "remoto"].indexOf(t) > -1) atualizarBadges();
      if (["empresa", "liberacao", "jornada", "documento", "remoto", "conteudo", "checklist"].indexOf(t) > -1 && sessao && sessao.papel === "cliente") {
        var r = Shell.rota().nome; if (["inicio", "jornada", "sistemas", "documentos", "checklist", "cofre"].indexOf(r) > -1) carregarEmpresa(true).then(rotear);
      }
    });
  }

  /* Uma carga por vez: login dispara rotear() por três caminhos (evento de
     sessão, retorno da promessa e hashchange) e as microtarefas se
     intercalam. Sem esta trava, um caminho zerava `empresa` entre a
     resolução e o uso do outro. */
  var carregando = null;
  function carregarEmpresa(forcar) {
    if (empresa && !forcar) return Promise.resolve(empresa);
    if (carregando && !forcar) return carregando;
    carregando = Dados.empresa(sessao.empresaId).then(function (e) { empresa = e; docsCache = null; credCache = null; carregando = null; return e; }, function (err) { carregando = null; throw err; });
    return carregando;
  }

  /* A empresa aberta não está mais disponível (a equipe tirou o acesso): abre outra da pessoa; sem nenhuma, avisa e sai. */
  function semEmpresa() {
    var outras = (sessao.empresas || []).filter(function (id) { return id && id !== sessao.empresaId; });
    if (outras.length) { Dados.trocarEmpresa(outras[0]).then(function (s) { sessao = s; sessao.empresas = outras; empresa = null; rotear(); }, function () { location.reload(); }); return; }
    UI.toast("Sua conta não está ligada a nenhuma empresa. Fale com a Totali.", "erro", null, 9000); sair();
  }
  function rotear() {
    var r = Shell.rota();
    if (/[?&]previa=login/.test(location.search)) return telaEntrar();   /* prévia de design: só a tela de login */
    if (r.nome === "convite") return telaConvite(r.param);
    if (r.nome === "sair") { sair(); return; }
    if (!sessao || sessao.papel !== "cliente") { document.body.classList.remove("logado"); return telaEntrar(); }
    if (!empresa) return carregarEmpresa().then(function (e) { if (!e || !empresa) { if (!e) semEmpresa(); return; } if (!Shell.view()) montarShell(); rotear(); }, function () { semEmpresa(); });
    if (!Shell.view()) montarShell();
    var telas = { "": telaInicio, inicio: telaInicio, jornada: telaInicio, feedback: telaFeedback, sistemas: r.param ? telaSistema : telaSistemas, abrir: telaAbrir, checklist: telaChecklist, documentos: telaDocumentos, cofre: telaCofre, chat: telaChat, perfil: telaPerfil, anterior: telaAnteriorInfo };
    if (chatAtual && r.nome !== "chat") { chatAtual.destruir(); chatAtual = null; }
    if (r.nome !== "abrir") Uso.fechar();
    var extra = global.TelasPortal || {};
    var fn = telas[r.nome] || extra[r.nome] || telaInicio;
    Uso.tela(r.nome || "inicio");
    fn(r);
  }

  /* Contexto que os módulos (onboarding, financeiro, agenda, relacionamento…) usam sem tocar neste arquivo */
  global.Portal = {
    get sessao() { return sessao; }, get empresa() { return empresa; },
    liberado: liberado, recarregar: function () { return carregarEmpresa(true); }, prepararAuto: prepararAuto,
    docs: function () { return docsCache; }, invalidar: function () { docsCache = null; credCache = null; },
    abrirFeedback: function () { abrirFeedback(); }, telaInicio: function () { telaInicio(); }, sair: function () { sair(); }
  };

  /* Pessoa com várias empresas: escolhe aqui (topo da tela, menu lateral e Perfil). Recarrega para tudo
     (chat, avisos, documentos) passar a olhar a empresa nova. */
  function escolherEmpresa() {
    Dados.nomesEmpresas(sessao.empresas || []).then(function (lista) {
      UI.modal({ titulo: "Trocar de empresa", corpo: '<p class="f-13 txt-2">Você acompanha estas empresas no portal. Escolha qual abrir.</p><div class="pilha mt-8" style="gap:6px">' + lista.map(function (x) { var atual = x.id === empresa.id; return '<button type="button" class="btn ' + (atual ? "btn--primario" : "btn--contorno") + ' btn--bloco" style="justify-content:flex-start" data-emp="' + U.esc(x.id) + '"' + (atual ? ' aria-current="true"' : "") + ">" + ic("building", "ic--sm") + U.esc(x.nome) + (atual ? ' <span class="f-12" style="margin-left:auto;opacity:.8">aberta agora</span>' : "") + "</button>"; }).join("") + "</div>", acoes: [{ rotulo: "Fechar" }] });
      setTimeout(function () {
        UI.$$(".modal [data-emp]").forEach(function (b) { b.addEventListener("click", function () { var id = b.dataset.emp; if (id === empresa.id) { var f = UI.$(".modal .modal__fechar"); if (f) f.click(); return; } b.disabled = true; Dados.trocarEmpresa(id).then(function () { location.hash = "#/inicio"; location.reload(); }); }); });
      }, 0);
    });
  }
  function montarShell() {
    document.body.classList.add("logado");
    Shell.montar({
      raiz: app, org: empresa.fantasia, usuario: sessao, titulo: "Início",
      trocaEmpresa: (sessao.empresas || []).length > 1, aoTrocarEmpresa: escolherEmpresa,
      nav: [
        { grupo: "Minha empresa", itens: [
          { href: "#/inicio", rotulo: "Início", icone: "home" },
          { href: "#/entrada", rotulo: "Lista de documentos", icone: "clipboard", oculto: !!empresa.migracaoConcluidaEm && !!(empresa.financeiro && empresa.financeiro.concluidoEm) },
          { href: "#/agenda", rotulo: "Agenda do mês", icone: "calendar" },
          { href: "#/chat", rotulo: "Chat com a Totali", icone: "chat" },
          { href: "#/documentos", rotulo: "Meus arquivos", icone: "folder" },
          { href: "#/cofre", rotulo: "Cofre de senhas", icone: "key" }
        ] },
        { grupo: "Ferramentas", itens: [
          { href: "#/checklist", rotulo: "Envio do mês", icone: "list-check", oculto: !liberado("checklist") },
          { href: "#/sistemas", rotulo: "Meus sistemas", icone: "grid" },
          { href: "#/historico", rotulo: "Histórico", icone: "history" }
        ] },
        { grupo: "Totali", itens: [
          { href: "#/indicar", rotulo: "Indicar um amigo", icone: "gift" },
          { href: "#/ajuda", rotulo: "Ajuda e contatos", icone: "info" }
        ] }
      ],
      tabbar: [
        { href: "#/inicio", rotulo: "Início", icone: "home" },
        { href: "#/chat", rotulo: "Chat", icone: "chat" },
        { href: "#/documentos", rotulo: "Arquivos", icone: "folder" },
        { href: "#/sistemas", rotulo: "Sistemas", icone: "grid" },
        { menu: true }
      ],
      destaque: destaqueSidebar(),
      aoNavegar: function () {}
    });
    Uso.iniciar(sessao, empresa.id);
    atualizarBadges();
    if (global.Notificacoes) global.Notificacoes.iniciar({ empresaId: empresa.id, uid: sessao.uid, lado: "cliente", empresa: empresa, envio: liberado("checklist") });
  }

  /* O rodapé da sidebar é o espaço permanente de banners dos sistemas que o
     cliente ainda não contratou (pedido do Raoni, 21/09/2026). Rotaciona. */
  function destaqueSidebar() { return '<div class="sidebar__banner" id="bannerSidebar"></div>'; }

  function liberado(sistemaId) {
    if (sistemaId === "checklist") return true; /* Envio do mês é parte do portal, não sistema: sempre aberto */
    var l = empresa && empresa.liberacoes && empresa.liberacoes[sistemaId];
    if (!l || !l.ativo) return false;
    if (l.ate && U.ms(l.ate) < Date.now()) return false;
    return true;
  }

  function atualizarBadges() {
    if (!sessao || !empresa) return;
    Dados.naoLidas(empresa.id, sessao.uid, "cliente").then(function (n) { Shell.badge("#/chat", n); UI.titulo(TITULO, n); });
  }

  /* Quem cuida da empresa: um responsável por setor (fiscal, contábil, pessoal...). Não existe uma pessoa única para a empresa. */
  function cardEquipe() {
    var lista = CATALOGO.responsaveis(empresa);
    var corpo = lista.length
      ? lista.map(function (p) { return '<div class="linha" style="flex-wrap:nowrap;gap:10px">' + UI.avatar(p.nome, "avatar--gold") + '<div class="lista__texto"><b class="f-13">' + U.esc(p.nome) + '</b><span class="lista__sub">' + U.esc(p.rotulo) + "</span></div></div>"; }).join("")
      : '<div class="linha" style="flex-wrap:nowrap;gap:10px">' + UI.avatar("Totali", "avatar--gold") + '<div class="lista__texto"><b class="f-13">Equipe Totali</b><span class="lista__sub">Fale com a gente pelo chat, em horário comercial</span></div></div>';
    return '<div class="card"><div class="card__cab"><h2>Quem cuida da sua empresa</h2></div><div class="card__corpo pilha" style="padding-top:10px;gap:10px">' + corpo + '<a class="f-13 f-700" href="#/chat">Mandar mensagem →</a></div></div>';
  }

  /* Fatos que a jornada marca sozinha (JORNADA.AUTOMACOES) */
  function autoFn(id) {
    var e = empresa || {};
    switch (id) {
      case "cadastro": return true;
      case "convite": case "entrou": return true;
      case "canal": return !!e.canalPreferido;
      case "certificado": return (docsCache || []).some(function (d) { return d.grupo === "certificado" && d.situacao !== "pendencia"; });
      case "senhas": return (credCache || []).length > 0;
      case "documentos": return (docsCache || []).filter(function (d) { return d.origem === "cliente"; }).length >= 3;
      case "anterior": return (docsCache || []).some(function (d) { return d.origem === "anterior"; });
      case "migracao": return !!e.migracaoConcluidaEm;
      case "trilha": return !!(e.marcos && e.marcos.academy);
      case "relatorios": return !!e.formaRelatorio;
      case "feedback": return !!(e.feedback30 && e.feedback30.texto) || !!e._feedback;
      default: return false;
    }
  }
  function prepararAuto() {
    return Promise.all([docsCache ? docsCache : Dados.documentos(empresa.id), credCache ? credCache : Dados.credenciais(empresa.id), Dados.feedback(empresa.id)])
      .then(function (r) { docsCache = r[0]; credCache = r[1]; empresa._feedback = r[2]; });
  }

  /* ============================================================
     Login e convite
     ============================================================ */
  function telaEntrar() {
    Shell.desmontar();
    var demo = Dados.ehDemo();
    app.innerHTML =
      '<div class="login">' +
        '<section class="login__painel" aria-hidden="true"><div class="puzzle-layer puzzle-login"><div class="puzzle-piece" aria-hidden="true"></div></div><div class="veu"></div><div class="brilho"></div>' +
          '<img class="login__logo-painel" src="assets/brand/logo-escuro.png" alt="Totali · Portal do Cliente">' +
          '<h1 class="login__frase">Sua empresa, <b>organizada</b> e <b>em dia</b>, num só lugar.</h1>' +
          '<p class="login__desc">Fale com quem cuida da sua contabilidade, envie documentos pelo celular, acompanhe prazos e use os sistemas da Totali com um login só.</p>' +
          '<ol class="login__etapas">' + [["done", "Convite da Totali"], ["done", "Criar minha senha"], ["now", "Enviar os documentos de entrada"], ["", "Bancos e maquininhas"], ["", "Análise da Totali"], ["", "Contabilidade ativa: rotina do mês"]].map(function (e) { return '<li class="login__etapa" data-e="' + e[0] + '"><i>' + (e[0] === "done" ? ic("check", "ic--sm") : "") + "</i><span>" + e[1] + "</span></li>"; }).join("") + "</ol>" +
          '<div class="login__powered">powered by <b>Totali</b></div></section>' +
        '<section class="login__form"><form class="login__caixa" id="formEntrar" novalidate>' +
          '<img class="login__logo" src="assets/brand/logo-claro.png" alt="Totali · Portal do Cliente">' +
          '<div><h2 class="login__titulo">Entrar</h2><p class="sub">Use o e-mail e a senha que você criou pelo convite da Totali.</p></div>' +
          '<div class="campo"><label class="campo__rotulo" for="email">E-mail</label><div class="input--icone">' + ic("mail") + '<input class="input" id="email" type="email" autocomplete="email" required inputmode="email" placeholder="voce@suaempresa.com.br"></div></div>' +
          '<div class="campo"><label class="campo__rotulo" for="senha">Senha</label><div class="input--icone">' + ic("key") + '<input class="input" id="senha" type="password" autocomplete="current-password" required><button type="button" class="acao" data-acao="mostrar">mostrar</button></div></div>' +
          '<p class="campo__erro" id="erroEntrar" hidden role="alert"></p>' +
          '<button class="btn btn--primario btn--bloco" type="submit" style="height:44px">Entrar</button>' +
          '<a href="#/recuperar" class="centro f-13 f-700" data-acao="recuperar">Esqueci a senha</a>' +
          (demo ? '<div class="aviso aviso--info mt-8">' + ic("info") + "<div><b>Modo demonstração</b>Sem servidor ligado: os dados são fictícios e ficam só neste navegador.</div></div><div class=\"login__demo\"><button type=\"button\" class=\"chip\" data-acao=\"demo\" data-qual=\"cliente\">Entrar como Padaria Estrela do Sul</button><button type=\"button\" class=\"chip\" data-acao=\"demo\" data-qual=\"agencia\">Entrar como Studio Vega</button></div>" : "") +
          '<p class="login__rodape">Ainda não tem acesso? Peça o convite à sua equipe na Totali.</p>' +
        "</form>" + '<div class="login__copy">© ' + new Date().getFullYear() + " Totali Soluções Contábeis</div></section></div>";
    var form = UI.$("#formEntrar"), erro = UI.$("#erroEntrar");
    UI.delegar(app, {
      mostrar: function (b) { var i = UI.$("#senha"); i.type = i.type === "password" ? "text" : "password"; b.textContent = i.type === "password" ? "mostrar" : "ocultar"; },
      demo: function (b) { Dados.entrarDemo(b.dataset.qual).then(function (s) { sessao = s; location.hash = "#/inicio"; rotear(); }).catch(mostrarErro); },
      recuperar: function () { UI.modal({ titulo: "Esqueci a senha", corpo: "<p class=\"txt-2\">Fale com a sua equipe na Totali pelo WhatsApp ou e-mail: enviamos um link para você criar uma senha nova.</p>" + (demo ? '<p class="txt-mudo f-12 mt-8">No modo demonstração não há envio de e-mail.</p>' : ""), acoes: [{ rotulo: "Entendi", classe: "btn--primario" }] }); }
    });
    function mostrarErro(e) { erro.textContent = e.message || "Não foi possível entrar."; erro.hidden = false; }
    form.addEventListener("submit", function (e) {
      e.preventDefault(); erro.hidden = true;
      var b = form.querySelector('[type="submit"]'); b.disabled = true; b.textContent = "Entrando…";
      Dados.entrar(UI.$("#email").value, UI.$("#senha").value).then(function (s) { sessao = s; location.hash = "#/inicio"; rotear(); })
        .catch(mostrarErro).then(function () { b.disabled = false; b.textContent = "Continuar"; });
    });
  }

  function telaConvite(codigo) {
    Shell.desmontar();
    app.innerHTML = '<div class="login"><section class="login__painel"><div class="puzzle-layer puzzle-login"><div class="puzzle-piece" aria-hidden="true"></div></div><div class="veu"></div><div class="brilho"></div><img class="login__logo-painel" src="assets/brand/logo-escuro.png" alt="Totali" style="height:52px"><p class="login__frase">Bem-vindo à <b>Totali</b>.</p><p class="f-12" style="color:var(--sidebar-muted)">powered by <b style="color:var(--gold)">Totali</b></p></section><section class="login__form"><div class="login__caixa" id="caixaConvite">' + UI.esqueleto(4) + "</div></section></div>";
    Dados.convite(codigo).then(function (c) {
      var caixa = UI.$("#caixaConvite");
      if (!c) { caixa.innerHTML = '<img class="login__logo" src="assets/brand/logo-claro.png" alt="Totali · Portal do Cliente"><h1>Convite inválido</h1><p class="sub">Este link já foi usado ou não existe. Peça um novo à sua equipe na Totali.</p><a class="btn btn--primario" href="#/entrar">Ir para o login</a>'; return; }
      var nomes = (c.nomes && c.nomes.length ? c.nomes : [c.empresa]).filter(Boolean), quais = nomes.map(function (n) { return "<b>" + U.esc(n) + "</b>"; });
      var paraQuem = quais.length > 1 ? "das empresas " + quais.slice(0, -1).join(", ") + " e " + quais[quais.length - 1] : "de " + (quais[0] || "sua empresa");
      caixa.innerHTML = '<img class="login__logo" src="assets/brand/logo-claro.png" alt="Totali · Portal do Cliente"><h1>Criar meu acesso</h1><p class="sub">Você foi convidado para o portal ' + paraQuem + ". Crie sua senha: a partir daqui você entra com e-mail e senha, de qualquer aparelho." + (quais.length > 1 ? " Dentro do portal você troca de uma empresa para outra pelo topo da tela." : "") + "</p>" +
        '<form id="formConvite" class="pilha" novalidate>' +
        '<div class="campo"><label class="campo__rotulo" for="nome">Seu nome</label><input class="input" id="nome" required autocomplete="name"></div>' +
        '<div class="campo"><label class="campo__rotulo" for="email">Seu e-mail</label><input class="input" id="email" type="email" required autocomplete="email"></div>' +
        '<div class="campo"><label class="campo__rotulo" for="senha">Crie uma senha</label><input class="input" id="senha" type="password" required minlength="10" autocomplete="new-password"><span class="campo__ajuda">Mínimo de 10 caracteres, misturando letras e números. Conferimos contra senhas vazadas.</span></div>' +
        '<p class="campo__erro" id="erroConvite" hidden role="alert"></p>' +
        '<button class="btn btn--primario btn--bloco" type="submit" style="height:44px">Criar acesso e entrar</button>' +
        '<button type="button" class="btn btn--fantasma btn--bloco" id="jaTenho">Já tenho conta no portal</button></form>' +
        /* quem já usa o portal (outra empresa) entra com a senha de sempre e as empresas do convite somam às dele */
        '<form id="formJaTenho" class="pilha" novalidate hidden><p class="f-13 txt-2">Entre com o e-mail e a senha que você já usa no portal. ' + (quais.length > 1 ? "As empresas deste convite" : "A empresa deste convite") + " passa" + (quais.length > 1 ? "m" : "") + ' a aparecer na sua conta.</p>' +
        '<div class="campo"><label class="campo__rotulo" for="emailJa">Seu e-mail</label><input class="input" id="emailJa" type="email" required autocomplete="email"></div>' +
        '<div class="campo"><label class="campo__rotulo" for="senhaJa">Sua senha</label><input class="input" id="senhaJa" type="password" required autocomplete="current-password"></div>' +
        '<p class="campo__erro" id="erroJa" hidden role="alert"></p>' +
        '<button class="btn btn--primario btn--bloco" type="submit" style="height:44px">Entrar e adicionar</button>' +
        '<button type="button" class="btn btn--fantasma btn--bloco" id="criarNovo">Ainda não tenho conta</button></form>';
      function modoJaTenho(sim, email, aviso) {
        UI.$("#formConvite").hidden = sim; UI.$("#formJaTenho").hidden = !sim; UI.$("h1", caixa).textContent = sim ? "Entrar e adicionar" : "Criar meu acesso";
        if (sim) { if (email) UI.$("#emailJa").value = email; var ej = UI.$("#erroJa"); ej.hidden = !aviso; ej.textContent = aviso || ""; UI.$(email ? "#senhaJa" : "#emailJa").focus(); }
      }
      UI.$("#jaTenho").addEventListener("click", function () { modoJaTenho(true, UI.$("#email").value.trim()); });
      UI.$("#criarNovo").addEventListener("click", function () { modoJaTenho(false); });
      UI.$("#formJaTenho").addEventListener("submit", function (e) {
        e.preventDefault(); var erro = UI.$("#erroJa"), email = UI.$("#emailJa").value.trim(), senha = UI.$("#senhaJa").value;
        if (!U.emailValido(email) || !senha) { erro.textContent = "Informe o e-mail e a senha."; erro.hidden = false; return; }
        Dados.entrarComConvite(codigo, email, senha).then(function (s) { sessao = s; empresa = null; history.replaceState(null, "", location.pathname); location.hash = "#/inicio"; rotear(); UI.vibrar(); })
          .catch(function (err) { erro.textContent = err.message; erro.hidden = false; });
      });
      UI.$("#formConvite").addEventListener("submit", function (e) {
        e.preventDefault();
        var nome = UI.$("#nome").value.trim(), email = UI.$("#email").value.trim(), senha = UI.$("#senha").value, erro = UI.$("#erroConvite");
        if (!nome || !U.emailValido(email)) { erro.textContent = "Confira nome e e-mail."; erro.hidden = false; return; }
        var av = global.Seguranca.avaliarSenha(senha); if (!av.ok) { erro.textContent = av.motivo; erro.hidden = false; return; }
        global.Seguranca.senhaVazada(senha).then(function (vazou) {
          if (vazou) { erro.textContent = "Essa senha já apareceu em vazamentos na internet. Escolha outra."; erro.hidden = false; return; }
          return Dados.usarConvite(codigo, { nome: nome, email: email, senha: senha }).then(function (s) { sessao = s; empresa = null; history.replaceState(null, "", location.pathname); location.hash = "#/inicio"; rotear(); UI.vibrar(); })
          .catch(function (err) { if (err && err.jaTemConta) return modoJaTenho(true, email, err.message); erro.textContent = err.message; erro.hidden = false; });
        });
      });
    }).catch(function (err) {
      console.warn("convite", err);
      UI.$("#caixaConvite").innerHTML = '<img class="login__logo" src="assets/brand/logo-claro.png" alt="Totali · Portal do Cliente"><h1>Não foi possível abrir o convite</h1><p class="sub">Tente de novo em instantes. Se continuar, peça um novo link à sua equipe na Totali.</p><a class="btn btn--primario" href="#/entrar">Ir para o login</a>';
    });
  }

  function sair() { if (Banners._timer) clearInterval(Banners._timer); if (chatAtual) { chatAtual.destruir(); chatAtual = null; } Uso.parar(); Dados.sair().then(function () { sessao = null; empresa = null; location.hash = "#/entrar"; rotear(); }); }

  /* ============================================================
     Vitrine (propaganda ética)
     ============================================================ */
  var Vitrine = {
    chave: "totali-portal-vitrine",
    estado: function () { try { return JSON.parse(localStorage.getItem(Vitrine.chave) || "{}"); } catch (e) { return {}; } },
    salvar: function (s) { try { localStorage.setItem(Vitrine.chave, JSON.stringify(s)); } catch (e) {} },
    campanhas: function () {
      return Dados.vitrine().then(function (proprias) {
        var todas = (proprias || []).concat(CATALOGO.VITRINE);
        var st = Vitrine.estado(), agora = Date.now();
        return todas.filter(function (c) {
          if (!c.ativo) return false;
          var s = CATALOGO.por(c.sistemaId); if (!s || s.oculto) return false;
          if (c.inicio && agora < U.ms(c.inicio)) return false;
          if (c.fim && agora > U.ms(c.fim)) return false;
          if (c.publico === "sem-sistema" && liberado(c.sistemaId)) return false;
          if (c.empresas && c.empresas.length && c.empresas.indexOf(empresa.id) === -1) return false;
          var perfis = empresa.perfis || [];
          if (!(s.publico.indexOf("todos") > -1 || s.publico.some(function (p) { return perfis.indexOf(p) > -1; }))) return false;
          var e = st[c.id] || {};
          if (e.fechadaEm && agora - e.fechadaEm < 14 * U.DIA_MS) return false;
          if ((e.impressoes || 0) >= 2 && !c.gatilho) return false;
          if (c.gatilho && !e.gatilhoEm) return false;
          return true;
        }).sort(function (a, b) { return (a.prioridade || 9) - (b.prioridade || 9); });
      });
    },
    /* O chat chama isto quando o cliente fala de um assunto que um sistema resolve (ex.: demissão → GE Rescisão) */
    gatilho: function (textoMsg) {
      var t = String(textoMsg || "").toLowerCase(), st = Vitrine.estado();
      CATALOGO.visiveis().forEach(function (s) {
        if (liberado(s.id)) return;
        if ((s.gatilhos || []).some(function (g) { return t.indexOf(g) > -1; })) {
          CATALOGO.VITRINE.concat([]).forEach(function (c) { if (c.sistemaId === s.id && c.gatilho) { st[c.id] = Object.assign(st[c.id] || {}, { gatilhoEm: Date.now(), impressoes: 0 }); } });
        }
      });
      Vitrine.salvar(st);
    },
    html: function (c, faixa) {
      var s = CATALOGO.por(c.sistemaId);
      var st = Vitrine.estado(); st[c.id] = st[c.id] || {}; st[c.id].impressoes = (st[c.id].impressoes || 0) + 1; Vitrine.salvar(st);
      Uso.vitrine(c.id, c.sistemaId, "impressao");
      return '<div class="vitrine' + (faixa ? " vitrine--faixa" : "") + ' entra" data-campanha="' + U.esc(c.id) + '" data-sistema="' + U.esc(c.sistemaId) + '">' +
        '<button type="button" class="vitrine__fechar" data-acao="vitrine-fechar" aria-label="Não mostrar de novo">' + ic("x", "ic--sm") + "</button>" +
        '<div class="vitrine__corpo">' +
          '' + CATALOGO.selo(s) +
          '<div style="flex:1;min-width:0"><span class="vitrine__kicker">' + ic("sparkles", "ic--sm") + (liberado(s.id) ? "Dica · " : "Sugestão para sua empresa · ") + U.esc(s.nome) + '</span><div class="vitrine__titulo">' + U.esc(c.titulo) + '</div><div class="vitrine__texto">' + U.esc(c.texto) + "</div>" +
          (s.prova > 0 ? '<div class="vitrine__prova mt-4">' + ic("users", "ic--sm") + U.num(s.prova) + " clientes da Totali já usam</div>" : "") +
          '<div class="vitrine__acoes"><a class="btn btn--sm btn--gold" href="#/sistemas/' + s.id + '" data-acao="vitrine-clique">' + U.esc(c.cta || "Conhecer") + '</a><button type="button" class="btn btn--sm btn--fantasma" data-acao="vitrine-fechar">Agora não</button></div></div>' +
        "</div></div>";
    },
    ligar: function (raiz) {
      UI.delegar(raiz, {
        "vitrine-fechar": function (b) { var v = b.closest(".vitrine"); var st = Vitrine.estado(); st[v.dataset.campanha] = Object.assign(st[v.dataset.campanha] || {}, { fechadaEm: Date.now() }); Vitrine.salvar(st); Uso.vitrine(v.dataset.campanha, v.dataset.sistema, "fechou"); v.style.transition = "opacity .2s"; v.style.opacity = "0"; setTimeout(function () { v.remove(); }, 200); },
        "vitrine-clique": function (a) { var v = a.closest(".vitrine"); Uso.vitrine(v.dataset.campanha, v.dataset.sistema, "clique"); location.hash = a.getAttribute("href"); }
      });
    }
  };

  /* ============================================================
     Banners: o espaço permanente dos sistemas ainda não contratados

     Diferente da vitrine (uma campanha, com limite de impressões),
     este espaço FICA: rotaciona a cada 9 s entre as campanhas ativas
     e, na falta delas, entre os sistemas não contratados do catálogo.
     Continua respeitando o que a pesquisa manda: sem som, sem
     vibração, sem escassez falsa, e "agora não" esconde aquele item
     por 14 dias. Vive na sidebar (desktop), no Início e em Sistemas.
     ============================================================ */
  /* ponto de foco escolhido no painel (arrastando o recorte): object-position em % */
  function focoEstilo(f) {
    if (!f) return "";
    var x = Math.max(0, Math.min(100, Math.round(Number(f.x)))), y = Math.max(0, Math.min(100, Math.round(Number(f.y))));
    return isNaN(x) || isNaN(y) ? "" : ' style="object-position:' + x + "% " + y + '%"';
  }
  var Banners = {
    _vistos: {},
    itens: function (campanhas) {
      var lista = (campanhas || []).map(function (c) { var s = CATALOGO.por(c.sistemaId); return { id: c.id, sistema: s, titulo: c.titulo, texto: c.texto, cta: c.cta || "Conhecer", campanha: true, imagem: c.imagem && c.imagem.url ? c.imagem.url : "", foco: c.foco }; });
      var perfis = empresa.perfis || [], st = Vitrine.estado();
      CATALOGO.visiveis().forEach(function (s) {
        if (liberado(s.id) || lista.some(function (x) { return x.sistema.id === s.id; })) return;
        if (!(s.publico.indexOf("todos") > -1 || s.publico.some(function (p) { return perfis.indexOf(p) > -1; }))) return;
        var e = st["b-" + s.id] || {}; if (e.fechadaEm && Date.now() - e.fechadaEm < 14 * U.DIA_MS) return;
        lista.push({ id: "b-" + s.id, sistema: s, titulo: s.tagline, texto: (s.previa && s.previa.texto) || s.desc, cta: s.status === "breve" ? "Lista de espera" : "Ver como funciona", campanha: false });
      });
      return lista;
    },
    html: function (it, compacto, lateral) {
      var s = it.sistema;
      /* campanha com arte própria: a imagem inteira é o banner (clicável); o título vira o texto alternativo.
         Só no menu lateral ela é recortada no centro (4:3); no Início e em Sistemas aparece inteira. */
      if (it.imagem) return '<div class="banner banner--imagem' + (lateral ? " banner--compacto" : "") + '" data-id="' + U.esc(it.id) + '" data-sistema="' + s.id + '">' +
        '<button type="button" class="banner__fechar" data-acao="banner-fechar" aria-label="Agora não">' + ic("x", "ic--sm") + "</button>" +
        '<a class="banner__arte" href="#/sistemas/' + s.id + '" data-acao="banner-clique"><img src="' + U.esc(it.imagem) + '" alt="' + U.esc(it.titulo) + '" loading="lazy"' + focoEstilo(it.foco) + "></a></div>";
      return '<div class="banner' + (compacto ? " banner--compacto" : "") + '" data-id="' + U.esc(it.id) + '" data-sistema="' + s.id + '" style="--cor:' + s.cor + '">' +
        '<button type="button" class="banner__fechar" data-acao="banner-fechar" aria-label="Agora não">' + ic("x", "ic--sm") + "</button>" +
        '' + CATALOGO.selo(s) +
        '<div class="banner__texto"><span class="banner__kicker">' + (s.status === "breve" ? "Em breve" : "Sugestão para sua empresa") + " · " + U.esc(s.nome) + '</span><b class="banner__titulo">' + U.esc(it.titulo) + "</b>" + (compacto ? "" : '<span class="banner__desc">' + U.esc(it.texto) + "</span>") +
        '<a class="btn btn--xs btn--gold banner__cta" href="#/sistemas/' + s.id + '" data-acao="banner-clique">' + U.esc(it.cta) + "</a></div></div>";
    },
    montar: function (el, campanhas, compacto) {
      var itens = Banners.itens(campanhas);
      var alvos = [el, UI.$("#bannerSidebar")].filter(Boolean);
      if (Banners._timer) { clearInterval(Banners._timer); Banners._timer = null; }
      if (!itens.length) { alvos.forEach(function (a) { a.innerHTML = ""; }); return; }
      /* começa pela campanha feita pela equipe (a de maior prioridade); sem campanha, sorteia entre as sugestões */
      var i = itens[0] && itens[0].campanha ? 0 : Math.floor(Math.random() * itens.length);
      function desenhar() {
        var it = itens[i % itens.length];
        alvos.forEach(function (a) { if (!document.body.contains(a)) return; a.innerHTML = Banners.html(it, a.id === "bannerSidebar" || compacto, a.id === "bannerSidebar") + (itens.length > 1 ? '<div class="banner__pontos">' + itens.map(function (_, k) { return '<i' + (k === i % itens.length ? ' class="on"' : "") + "></i>"; }).join("") + "</div>" : ""); });
        /* conta a impressão uma vez por banner em cada abertura do portal, não a cada rodízio de 9 s
           (aba esquecida aberta gravava ~400 registros por hora) */
        if (!Banners._vistos[it.id]) { Banners._vistos[it.id] = true; Uso.vitrine(it.id, it.sistema.id, "impressao"); }
      }
      desenhar();
      Banners._timer = setInterval(function () { if (document.hidden) return; i++; desenhar(); }, 9000);
      alvos.forEach(function (a) {
        if (a._ligado) return; a._ligado = true;
        UI.delegar(a, {
          "banner-fechar": function (b) { var v = b.closest(".banner"); var st = Vitrine.estado(); st[v.dataset.id] = Object.assign(st[v.dataset.id] || {}, { fechadaEm: Date.now() }); Vitrine.salvar(st); Uso.vitrine(v.dataset.id, v.dataset.sistema, "fechou"); itens = itens.filter(function (x) { return x.id !== v.dataset.id; }); if (!itens.length) { clearInterval(Banners._timer); alvos.forEach(function (x) { x.innerHTML = ""; }); } else desenhar(); },
          "banner-clique": function (link) { var v = link.closest(".banner"); Uso.vitrine(v.dataset.id, v.dataset.sistema, "clique"); location.hash = link.getAttribute("href"); }
        });
      });
    }
  };

  /* ============================================================
     Início
     ============================================================ */
  function telaInicio() {
    Shell.titulo("Início");
    var v = Shell.render(UI.esqueleto(6));
    Promise.all([prepararAuto(), Dados.checklist(empresa.id, U.anoMes(Date.now())), Vitrine.campanhas(), Dados.mensagens(empresa.id)]).then(function (r) {
      var check = (liberado("checklist") && global.Envio) ? global.Envio.mes(empresa, r[1], U.anoMes(Date.now())) : null, campanhas = r[2], msgs = r[3];
      var rEnvio = check ? global.Envio.resumo(check) : null;
      var naoLidas = msgs.filter(function (m) { return m.autor.lado === "equipe" && !(m.lidaPor || {})[sessao.uid]; }).length;
      var pendencias = docsCache.filter(function (d) { return d.situacao === "pendencia"; });
      var aprovados = docsCache.filter(function (d) { return d.situacao === "aprovado"; }).length;
      var emAnalise = docsCache.filter(function (d) { return d.situacao === "enviado" || d.situacao === "analise"; }).length;
      var itensCheck = check ? check.itens : [], feitosCheck = itensCheck.filter(function (i) { return i.feito; }).length;
      var sistemasLib = CATALOGO.visiveis().filter(function (s) { return liberado(s.id); });

      /* "Hoje": um passo só, o mais urgente (goal-gradient) */
      var hoje = "";
      if (pendencias.length) hoje = cardHoje("alert", "erro", "Um documento precisa de correção", pendencias[0].nome + ": " + (pendencias[0].revisao && pendencias[0].revisao.motivo || ""), "#/documentos", "Reenviar agora");
      else if (naoLidas) hoje = cardHoje("chat", "gold", U.plural(naoLidas, "Sua equipe respondeu", "Você tem " + naoLidas + " mensagens novas"), "Toque para ler e responder.", "#/chat", "Abrir o chat");
      else if (rEnvio && rEnvio.atrasados.length) hoje = cardHoje("list-check", "erro", "Envio do mês: " + U.plural(rEnvio.atrasados.length, "1 item passou do prazo", rEnvio.atrasados.length + " itens passaram do prazo"), rEnvio.atrasados[0].texto + ". Anexe pelo portal e o item fecha sozinho.", "#/checklist", "Abrir envio do mês");
      else if (rEnvio && rEnvio.proximos.length) hoje = cardHoje("list-check", "info", "Envio do mês: " + rEnvio.proximos[0].texto, (function (d) { return d === 0 ? "Vence hoje." : d === 1 ? "Vence amanhã." : "Vence em " + d + " dias."; })(global.Envio.diasParaPrazo(rEnvio.proximos[0], check.anoMes)) + " Anexe pelo portal e o item fecha sozinho.", "#/checklist", "Abrir envio do mês");
      else hoje = cardHoje("check-circle", "ok", "Tudo em dia por aqui", "Nada pendente para você hoje. Que tal uma aula rápida no Academy?", "#/sistemas/academy", "Ver o Academy");

      var ganchos = (global.InicioExtras || []).map(function (f) { try { return f({ docs: docsCache, check: check, msgs: msgs, pendencias: pendencias, naoLidas: naoLidas }) || ""; } catch (e) { console.warn(e); return ""; } });
      if (ganchos.some(function (g) { return g && g.hoje; }) && !pendencias.length && !naoLidas) hoje = ganchos.filter(function (g) { return g.hoje; })[0].hoje;
      var html = '<div class="pagina">' +
        '<div class="cabecalho"><div><div class="cabecalho__kicker">' + U.esc(empresa.fantasia) + "</div><h1>" + U.saudacao() + ", " + U.esc(U.primeiroNome(sessao.nome)) + "</h1><p>" + (function (d) { return d < 1 ? "Bem-vindo à Totali! Aqui está o que importa hoje." : "Cliente da Totali há " + U.plural(d, "1 dia", U.num(d) + " dias") + ". Aqui está o que importa hoje."; })(U.diasEntre(empresa.criadaEm, Date.now())) + "</p></div></div>" +
        hoje +
        ganchos.map(function (g) { return g && g.topo ? g.topo : ""; }).join("") +
        /* 4 ações primárias */
        '<div class="grade grade--4">' +
          acao("#/chat", "chat", "Chat", naoLidas ? U.plural(naoLidas, "1 nova", naoLidas + " novas") : "Fale com a equipe", naoLidas) +
          acao("#/documentos", "folder", "Documentos", pendencias.length ? U.plural(pendencias.length, "1 para corrigir", pendencias.length + " para corrigir") : emAnalise ? U.plural(emAnalise, "1 em análise", emAnalise + " em análise") : docsCache.length ? U.plural(aprovados, "1 aprovado", aprovados + " aprovados") : "Enviar documentos", pendencias.length) +
          (liberado("checklist") ? acao("#/checklist", "list-check", "Envio", itensCheck.length ? feitosCheck + "/" + itensCheck.length + " do mês" : "nada este mês") : acao("#/cofre", "key", "Cofre", "senhas protegidas")) +
          acao("#/sistemas", "grid", "Sistemas", sistemasLib.length + " liberados") +
        "</div>" +
        '<div class="grade grade--lado">' +
          '<div class="pilha">' +
            ganchos.map(function (g) { return g && g.colunaTopo && g.hoje !== hoje ? g.colunaTopo : ""; }).join("") +
            /* Envio do mês */
            (liberado("checklist") && itensCheck.length ? '<div class="card"><div class="card__cab"><h2>Envio de ' + U.esc(nomeMes(U.anoMes(Date.now()))) + '</h2><a class="btn btn--xs btn--contorno" href="#/checklist">Abrir</a></div><div class="card__corpo" style="padding-top:10px"><div class="linha linha--entre f-13 txt-2"><span>' + feitosCheck + " de " + U.plural(itensCheck.length, "1 item enviado", itensCheck.length + " itens enviados") + "</span>" + (check && check.concluidoEm ? UI.badge("Mês em dia", "ok", "check") : "<span>" + U.plural(itensCheck.length - feitosCheck, "falta 1", "faltam " + (itensCheck.length - feitosCheck)) + "</span>") + "</div>" + UI.barra(U.pct(feitosCheck, itensCheck.length || 1), feitosCheck === itensCheck.length ? "barra--ok" : (U.pct(feitosCheck, itensCheck.length || 1) >= 70 ? "barra--gold" : "")) + "</div></div>" : "") +
            ganchos.map(function (g) { return g && g.coluna ? g.coluna : ""; }).join("") +
            /* Últimas mensagens */
            '<div class="card"><div class="card__cab"><h2>Conversa com a Totali</h2><a class="btn btn--xs btn--contorno" href="#/chat">Abrir chat</a></div><div class="lista" style="padding-top:6px">' + (msgs.slice(-3).map(function (m) { return '<a class="lista__item" href="#/chat">' + UI.avatar(m.autor.nome, m.autor.lado === "equipe" ? "avatar--gold avatar--sm" : "avatar--sm") + '<div class="lista__texto"><span class="lista__titulo">' + U.esc(m.autor.lado === "equipe" ? m.autor.nome + " · Totali" : "Você") + '</span><span class="lista__sub">' + U.esc(m.texto || "Anexo") + '</span></div><span class="lista__meta">' + U.relativo(m.em) + "</span></a>"; }).join("") || '<div class="card__corpo txt-2 f-13">Nenhuma mensagem ainda. Sua equipe está a uma mensagem de distância.</div>') + "</div></div>" +
          "</div>" +
          '<div class="pilha">' +
            /* Minha equipe (reciprocidade, rosto conhecido) */
            cardEquipe() +
            /* Patrimônio (endowment) */
            '<div class="card"><div class="card__corpo"><div class="f-12 f-800 txt-2" style="letter-spacing:.08em;text-transform:uppercase">Sua empresa na Totali</div><div class="grade grade--2 mt-8" style="gap:8px">' + kpiMini(docsCache.length, "documentos guardados") + kpiMini(aprovados, "aprovados pela equipe") + kpiMini(sistemasLib.length, "sistemas ativos") + kpiMini(U.diasEntre(empresa.criadaEm, Date.now()), "dias com a Totali") + "</div></div></div>" +
            ganchos.map(function (g) { return g && g.lado ? g.lado : ""; }).join("") +
            /* Banners dos sistemas ainda não contratados (rotativo) */
            '<div id="bannerInicio"></div>' +
          "</div>" +
        "</div></div>";
      Shell.render(html); Vitrine.ligar(Shell.view());
      Banners.montar(UI.$("#bannerInicio"), campanhas);
      (global.InicioExtras || []).forEach(function (f) { if (f.ligar) f.ligar(Shell.view()); });
      if (global.Tour) global.Tour.talvez("portal-inicio");
    });
    function cardHoje(icone, tipo, titulo, texto, href, cta) {
      return '<a class="card card--clicavel card--hoje entra" href="' + href + '" style="text-decoration:none;color:inherit;--tom:var(--' + ({ erro: "danger", gold: "gold", info: "info", ok: "success" }[tipo]) + ');border-left:4px solid var(--' + ({ erro: "danger", gold: "gold", info: "info", ok: "success" }[tipo]) + ')"><div class="card__corpo" style="display:flex;gap:14px;align-items:center"><span class="selo-sistema" style="background:var(--' + ({ erro: "danger-soft", gold: "gold-soft", info: "info-soft", ok: "success-soft" }[tipo]) + ');color:var(--' + ({ erro: "danger", gold: "gold-text", info: "info", ok: "success" }[tipo]) + ')">' + ic(icone) + '</span><div style="flex:1;min-width:0"><div class="f-12 f-800 txt-2" style="letter-spacing:.08em;text-transform:uppercase">Hoje</div><div class="f-15 f-800">' + U.esc(titulo) + '</div><div class="f-13 txt-2">' + U.esc(texto) + '</div></div><span class="btn btn--sm btn--primario so-desktop">' + U.esc(cta) + "</span>" + ic("chevron-right", "so-mobile") + "</div></a>";
    }
    function acao(href, icone, rotulo, sub, badge) {
      return '<a class="card card--clicavel acao-card entra" href="' + href + '" style="text-decoration:none;color:inherit"><div class="card__corpo" style="display:flex;flex-direction:column;gap:8px;position:relative"><span class="selo-sistema" style="background:var(--primary-soft);color:var(--primary);width:40px;height:40px">' + ic(icone) + "</span>" + (badge ? '<span class="badge badge--erro" style="position:absolute;right:12px;top:12px">' + badge + "</span>" : "") + '<div><div class="f-800">' + rotulo + '</div><div class="f-12 txt-2">' + U.esc(sub) + "</div></div></div></a>";
    }
    function kpiMini(n, rotulo) { return '<div><div class="f-800" style="font-size:22px;font-variant-numeric:tabular-nums">' + U.num(n) + '</div><div class="f-12 txt-2">' + rotulo + "</div></div>"; }
  }
  var MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  function nomeMes(anoMes) { var p = anoMes.split("-"); return MESES[Number(p[1]) - 1] + " de " + p[0]; }

  /* ============================================================
     Jornada de 30 dias (visão do cliente)
     ============================================================ */
  /* A jornada de 30 dias é controle interno de onboarding (decisão do Raoni,
     21/09/2026): o cliente não a vê. O portal é dele para sempre, enquanto for
     cliente; a jornada só existe no painel. */
  function telaFeedback() { telaInicio(); setTimeout(abrirFeedback, 400); }
  function abrirFeedback() {
    UI.modal({ titulo: "Como foram seus 30 dias?", corpo: '<p class="txt-2 f-13">Uma pergunta só, e a gente lê de verdade. O que mais funcionou e o que a Totali poderia fazer melhor?</p><div class="segmentos mt-12" id="nota">' + [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" data-n="' + n + '" aria-pressed="false">' + n + "</button>"; }).join("") + '</div><span class="campo__ajuda">1 = ruim · 5 = excelente</span><textarea class="textarea mt-8" id="fbTexto" placeholder="Escreva com suas palavras…"></textarea>',
      acoes: [{ rotulo: "Depois" }, { rotulo: "Enviar", classe: "btn--primario", icone: "send", ao: function (c) { var t = c.querySelector("#fbTexto").value.trim(); var n = Number((c.querySelector('#nota [aria-pressed="true"]') || {}).dataset && c.querySelector('#nota [aria-pressed="true"]').dataset.n) || 0; if (!t) { UI.toast("Escreva pelo menos uma frase.", "aviso"); return false; } Dados.salvarFeedback(empresa.id, t, n, sessao).then(function () { empresa._feedback = { texto: t }; UI.celebrar("Obrigado! Seu feedback chegou à equipe."); telaInicio(); }); } }] });
    UI.$$("#nota button").forEach(function (b) { b.addEventListener("click", function () { UI.$$("#nota button").forEach(function (x) { x.setAttribute("aria-pressed", "false"); }); b.setAttribute("aria-pressed", "true"); }); });
  }

  /* ============================================================
     Sistemas (meus sistemas + vitrine)
     ============================================================ */
  function cardSistema(s, lib) {
    var l = empresa.liberacoes && empresa.liberacoes[s.id];
    var ate = l && l.ate ? U.ms(l.ate) : 0;
    return '<div class="card sistema entra' + (lib ? "" : " sistema--bloqueado") + '"><div class="sistema__topo">' + CATALOGO.selo(s) + '<div style="flex:1;min-width:0"><div class="sistema__nome">' + U.esc(s.nome) + '</div><div class="sistema__tag">' + U.esc(s.tagline) + "</div></div>" + (s.status === "breve" ? UI.badge("Em breve", "info") : lib ? UI.badge(ate ? "até " + U.dataCurta(ate) : "Ativo", ate && ate - Date.now() < 7 * U.DIA_MS ? "aviso" : "ok", "check") : UI.badge("Conheça", "gold")) + "</div>" +
      '<div class="sistema__desc">' + U.esc(s.desc) + "</div>" +
      (lib ? "" : '<ul class="sistema__beneficios">' + s.beneficios.map(function (b) { return "<li>" + ic("check", "ic--sm") + U.esc(b) + "</li>"; }).join("") + "</ul>") +
      '<div class="sistema__acoes">' + (lib ? '<a class="btn btn--sm btn--primario" href="#/sistemas/' + s.id + '">' + ic(s.modo === "externo" ? "external" : "arrow-right") + "Abrir</a>" : '<a class="btn btn--sm btn--gold" href="#/sistemas/' + s.id + '">' + ic("eye") + (s.status === "breve" ? "Entrar na lista de espera" : "Ver como funciona") + "</a>") + (s.prova > 0 ? '<span class="sistema__uso">' + U.num(s.prova) + " clientes usam</span>" : "") + "</div></div>";
  }
  function telaSistemas() {
    Shell.titulo("Meus sistemas");
    var perfis = empresa.perfis || [];
    var todos = CATALOGO.visiveis().filter(function (s) { return liberado(s.id) || s.publico.indexOf("todos") > -1 || s.publico.some(function (p) { return perfis.indexOf(p) > -1; }); });
    var libs = todos.filter(function (s) { return liberado(s.id); }), outros = todos.filter(function (s) { return !liberado(s.id); });
    Shell.render('<div class="pagina"><div class="cabecalho"><div><div class="cabecalho__kicker">Ferramentas</div><h1>Meus sistemas</h1><p>Tudo o que a Totali disponibilizou para a sua empresa, com um login só. Os demais você pode conhecer aqui.</p></div></div>' +
      '<div id="bannerSistemas"></div>' +
      (libs.length ? '<div class="grade grade--3">' + libs.map(function (s) { return cardSistema(s, true); }).join("") + "</div>" : UI.vazio("grid", "Nenhum sistema liberado ainda", "Sua equipe libera os sistemas conforme a contratação. Fale com a gente pelo chat.")) +
      (outros.length ? '<h2 class="mt-8">Conheça também</h2><div class="grade grade--3">' + outros.map(function (s) { return cardSistema(s, false); }).join("") + "</div>" : "") +
      "</div>");
    Vitrine.campanhas().then(function (c) { Banners.montar(UI.$("#bannerSistemas"), c, true); });
  }
  function telaSistema(r) {
    if (r.param === "checklist") { location.hash = "#/checklist"; return; }
    var s = CATALOGO.por(r.param); if (!s || s.oculto) return telaSistemas();
    Shell.titulo(s.nome);
    if (liberado(s.id) && s.status !== "breve") {
      if (s.modo === "interno") { location.hash = "#/" + s.id; return; }
      if (s.modo === "embutido" && s.url) { location.hash = "#/abrir/" + s.id; return; }
      if (s.modo === "externo" || (s.modo === "embutido" && !s.url)) {
        Uso.abrir(s.id, "externo");
        if (s.id === "academy") Dados.salvarEmpresa(empresa.id, { marcos: Object.assign(empresa.marcos || {}, { academy: Date.now() }) });
        Shell.render('<div class="pagina"><div class="cabecalho"><div><div class="cabecalho__kicker">Sistema</div><h1>' + U.esc(s.nome) + "</h1><p>" + U.esc(s.tagline) + '</p></div></div><div class="card"><div class="card__corpo pilha" style="align-items:flex-start">' + (s.url ? '<p class="txt-2 f-13">O ' + U.esc(s.nome) + " abre em uma aba nova. Seu acesso já está liberado.</p><a class=\"btn btn--primario\" href=\"" + U.esc(s.url) + '" target="_blank" rel="noopener">' + ic("external") + "Abrir " + U.esc(s.nome) + "</a>" : '<div class="aviso aviso--info">' + ic("info") + "<div><b>Endereço em configuração</b>A equipe da Totali ainda está publicando o endereço deste sistema. Fale pelo chat que a gente libera na hora.</div></div>") + "</div></div></div>");
        return;
      }
    }
    /* Não contratado: empty state que vende (prévia + CTA), sem punir */
    var p = s.previa || {};
    Uso.vitrine("previa", s.id, "previa");
    Shell.render('<div class="pagina"><div class="cabecalho"><div><div class="cabecalho__kicker">' + (s.status === "breve" ? "Em desenvolvimento" : "Ainda não contratado") + "</div><h1>" + U.esc(s.nome) + "</h1><p>" + U.esc(s.desc) + '</p></div></div>' +
      '<div class="grade grade--lado"><div class="pilha">' +
        '<div class="card"><div class="card__cab"><h2>' + U.esc(p.titulo || "Como funciona") + '</h2></div><div class="card__corpo" style="padding-top:10px"><p class="txt-2 f-13">' + U.esc(p.texto || "") + '</p><div class="pilha mt-12" style="gap:6px">' + (p.itens || []).map(function (it, i) { return '<div class="passo" style="cursor:default"><span class="passo__p">' + (i + 1) + '</span><span class="passo__texto">' + U.esc(it) + "</span></div>"; }).join("") + "</div></div></div>" +
        '<div class="card"><div class="card__corpo"><h3>O que você ganha</h3><ul class="sistema__beneficios mt-8">' + s.beneficios.map(function (b) { return "<li>" + ic("check") + U.esc(b) + "</li>"; }).join("") + "</ul></div></div>" +
      '</div><div class="pilha">' +
        '<div class="card card--gold"><div class="card__corpo pilha">' + CATALOGO.selo(s) + '<div class="f-800 f-15">' + (s.status === "breve" ? "Quer ser dos primeiros?" : "Quer ver funcionando na sua empresa?") + '</div><p class="f-13 txt-2">' + (s.status === "breve" ? "Entre na lista de espera. Quem entra agora ajuda a definir o que vem primeiro." : "Sem compromisso: a gente mostra em 15 minutos, pelo chat ou por chamada.") + '</p><button type="button" class="btn btn--gold btn--bloco" data-acao="interesse">' + ic("chat") + (s.status === "breve" ? "Entrar na lista de espera" : "Quero conhecer o " + U.esc(s.nome)) + "</button>" + (s.prova > 0 ? '<div class="vitrine__prova">' + ic("users", "ic--sm") + U.num(s.prova) + " clientes da Totali já usam</div>" : "") + "</div></div>" +
        '<a class="btn btn--contorno btn--bloco" href="#/sistemas">' + ic("arrow-left") + "Voltar aos sistemas</a>" +
      "</div></div></div>");
    UI.delegar(Shell.view(), { interesse: function (b) {
      b.disabled = true;
      var texto = s.status === "breve" ? "Quero entrar na lista de espera do " + s.nome + "." : "Quero conhecer o " + s.nome + ". Podem me mostrar como funciona?";
      Dados.enviarMensagem(empresa.id, { autor: { uid: sessao.uid, nome: sessao.nome, lado: "cliente" }, texto: texto }).then(function () { Uso.vitrine("previa", s.id, "interesse"); UI.toast("Pedido enviado pelo chat. A equipe responde em horário comercial.", "ok"); location.hash = "#/chat"; });
    } });
  }
  function telaAbrir(r) {
    var s = CATALOGO.por(r.param);
    if (!s || !liberado(s.id) || !s.url) { location.hash = "#/sistemas"; return; }
    Shell.titulo(s.nome);
    Uso.abrir(s.id, "embutido");
    if (s.id === "academy" && !(empresa.marcos && empresa.marcos.academy)) Dados.salvarEmpresa(empresa.id, { marcos: Object.assign(empresa.marcos || {}, { academy: Date.now() }) }).then(function () { empresa.marcos = Object.assign(empresa.marcos || {}, { academy: Date.now() }); });
    Shell.render('<div class="embutido"><div class="embutido__barra"><a class="btn btn--xs btn--fantasma" href="#/sistemas">' + ic("arrow-left") + 'Sistemas</a>' + CATALOGO.selo(s, "selo-sistema--sm") + '<b class="f-13">' + U.esc(s.nome) + '</b><span class="esp"></span><a class="btn btn--xs btn--contorno" href="' + U.esc(s.url) + '" target="_blank" rel="noopener">' + ic("external", "ic--sm") + 'Abrir em nova aba</a></div><iframe src="' + U.esc(s.url) + '" title="' + U.esc(s.nome) + '" allow="camera; microphone; geolocation" referrerpolicy="no-referrer"></iframe></div>');
  }

  /* ============================================================
     Envio do mês (itens e regras em js/envio.js; registro em checklist/{anoMes})
     ============================================================ */
  function telaChecklist(r) {
    if (!liberado("checklist")) { location.hash = "#/sistemas/checklist"; return; }
    Shell.titulo("Envio do mês");
    var anoMes = r.query.mes || U.anoMes(Date.now());
    Uso.abrir("checklist", "interno");
    Shell.render(UI.esqueleto(6));
    Promise.all([Dados.checklist(empresa.id, anoMes), Dados.checklists(empresa.id)]).then(function (res) {
      var c = global.Envio.mes(empresa, res[0], anoMes);
      var hist = res[1];
      var feitos = c.itens.filter(function (i) { return i.feito; }).length, pct = U.pct(feitos, c.itens.length);
      var meses = []; for (var i = 0; i < 6; i++) { var d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); meses.push(U.anoMes(d)); }
      var emDia = hist.filter(function (h) { return h.concluidoEm; }).length;
      var partes = anoMes.split("-");
      var ref = new Date(Number(partes[0]), Number(partes[1]) - 2, 1), mesRef = MESES[ref.getMonth()];
      var proxRef = new Date(Number(partes[0]), Number(partes[1]), 1), mesProx = MESES[proxRef.getMonth()];
      var html = '<div class="pagina"><div class="cabecalho"><div><div class="cabecalho__kicker">' + U.esc(nomeMes(anoMes)) + " · documentos de " + mesRef + '</div><h1>Envio do mês</h1><p>É o que a Totali precisa receber de você todo mês para fechar a contabilidade da empresa: extratos, notas, comprovantes. Toque em <b>Anexar</b> no item e envie o arquivo; o item fica marcado sozinho. A Totali confere e dá o aceite.</p></div>' +
        '<div class="cabecalho__acoes"><select class="select" id="selMes" style="min-height:36px;width:auto">' + meses.map(function (m) { return '<option value="' + m + '"' + (m === anoMes ? " selected" : "") + ">" + nomeMes(m) + "</option>"; }).join("") + "</select></div></div>" +
        '<div class="grade grade--lado"><div class="pilha">' +
          (!c.itens.length ? UI.vazio("calendar", "Nada para enviar em " + nomeMes(anoMes).split(" de ")[0], "Os prazos deste mês venceram antes de a sua empresa entrar na Totali. O primeiro envio é em " + mesProx + ": a lista aparece aqui no dia 1.") : "") +
          '<div class="card"' + (c.itens.length ? "" : " hidden") + '><div class="card__corpo"><div class="linha linha--entre"><div><div class="f-800 f-15">' + feitos + " de " + U.plural(c.itens.length, "1 item", c.itens.length + " itens") + '</div><div class="f-12 txt-2">' + (c.concluidoEm ? "Concluído em " + U.data(c.concluidoEm) : U.plural(c.itens.length - feitos, "falta 1", "faltam " + (c.itens.length - feitos))) + "</div></div>" + (c.concluidoEm ? '<span class="badge badge--ok">' + ic("check") + "Mês em dia</span>" : UI.anel(pct, "", 56)) + "</div>" + UI.barra(pct, pct === 100 ? "barra--ok" : pct >= 70 ? "barra--gold" : "") + "</div></div>" +
          '<div class="pilha" style="gap:6px">' + c.itens.map(function (it, i) {
            var prazo = new Date(Number(partes[0]), Number(partes[1]) - 1, it.prazoDia).getTime();
            var atrasado = !it.feito && Date.now() > prazo + U.DIA_MS * 2;
            return '<button type="button" class="passo entra" data-feito="' + (it.feito ? 1 : 0) + '" data-acao="item" data-i="' + i + '"><span class="passo__check">' + ic("check", "ic--sm") + '</span><span class="passo__texto">' + U.esc(it.texto) + '<div class="passo__meta">até dia ' + it.prazoDia + (it.feito ? " · enviado " + U.relativo(it.feitoEm) : atrasado ? ' · <span class="txt-erro f-700">passou do prazo</span>' : "") + (it.aceite ? ' · <span class="txt-ok f-700">aceito por ' + U.esc(it.aceite.por) + "</span>" : it.feito ? (it.origem === "documento" ? " · pelo arquivo anexado" : "") + " · aguardando conferência" : "") + '</div></span><a class="btn btn--xs btn--contorno" href="#/documentos?grupo=' + (it.grupo || "mensal") + '&item=' + encodeURIComponent(it.id) + '" data-acao="anexar">' + ic("upload", "ic--sm") + "Anexar</a></button>";
          }).join("") + "</div>" +
        '</div><div class="pilha">' +
          '<div class="card"><div class="card__cab"><h2>Meses em dia</h2></div><div class="card__corpo" style="padding-top:10px"><div class="f-800" style="font-size:28px">' + emDia + ' <small class="f-13 txt-2">' + U.plural(emDia, "mês", "meses") + ' completo' + (emDia === 1 ? "" : "s") + '</small></div><div class="pilha mt-8" style="gap:4px">' + hist.slice(0, 6).map(function (h) { if (h.anoMes === anoMes) h = c; var f = h.itens.filter(function (x) { return x.feito; }).length; return '<a class="linha linha--entre f-13" href="#/checklist?mes=' + h.anoMes + '" style="text-decoration:none;color:inherit"><span>' + nomeMes(h.anoMes) + "</span>" + (h.concluidoEm ? UI.badge("em dia", "ok", "check") : UI.badge(f + "/" + h.itens.length, "aviso")) + "</a>"; }).join("") + "</div></div></div>" +
          '<div class="aviso aviso--info">' + ic("info") + "<div><b>Tolerância de 48 h</b>Um atraso de um dia não tira o seu selo. Avisamos antes, e o mês só conta como atrasado depois de dois dias.</div></div>" +
        "</div></div></div>";
      var v = Shell.render(html);
      UI.$("#selMes", v).addEventListener("change", function () { location.hash = "#/checklist?mes=" + this.value; });
      UI.delegar(v, {
        anexar: function (a, e) { e.stopPropagation(); location.hash = a.getAttribute("href"); },
        item: function (b, e) {
          if (e.target.closest("[data-acao=anexar]")) return;
          var i = Number(b.dataset.i); var it = c.itens[i];
          var novo = !it.feito;
          /* marcar sem anexar é para quem já mandou por outro caminho: pergunta, para um toque acidental não dar o item como enviado */
          if (novo && !b.dataset.confirmado) { UI.confirmar("Marcar como enviado?", "Use só se você já mandou “" + it.texto + "” por outro caminho (e-mail, WhatsApp, em mãos). Para enviar pelo portal, toque em Anexar.", { ok: "Já enviei" }).then(function (ok) { if (ok) { b.dataset.confirmado = "1"; b.click(); } }); return; }
          it.feito = novo; it.feitoEm = novo ? Date.now() : 0; if (!novo) it.aceite = null;
          var todos = c.itens.every(function (x) { return x.feito; });
          Dados.salvarChecklist(empresa.id, anoMes, { itens: c.itens }).then(function () {
            if (novo) UI.vibrar(12);
            if (novo && todos) UI.celebrar("Mês de " + nomeMes(anoMes).split(" de ")[0] + " 100% em dia!");
            telaChecklist(r);
          });
        }
      });
    });
  }

  /* ============================================================
     Documentos (cliente + contabilidade anterior) e recibos
     ============================================================ */
  function iconeDoc(d) { return U.ehImagem(d.arquivo && d.arquivo.mime, d.nome) ? "image" : "file"; }
  function situacaoBadge(s) { return { enviado: UI.badge("Enviado", "info", "upload"), analise: UI.badge("Em análise", "info", "eye"), aprovado: UI.badge("Aprovado", "ok", "check"), pendencia: UI.badge("Precisa de correção", "erro", "alert") }[s] || UI.badge(s); }
  function docHtml(d, podeRemover) {
    var visto = (d.vistos || [])[0];
    return '<div class="doc entra" data-id="' + d.id + '"><span class="doc__icone">' + ic(iconeDoc(d)) + '</span><div style="flex:1;min-width:0"><div class="doc__nome">' + U.esc(d.nome) + '</div><div class="doc__meta">' + U.esc((GRUPOS_DOC.filter(function (g) { return g.id === d.grupo; })[0] || {}).rotulo || d.grupo) + " · " + (d.origem === "anterior" ? "contabilidade anterior" : d.origem === "equipe" ? "Totali" : "você") + " · " + U.relativo(d.em) + (d.arquivo && d.arquivo.tamanho ? " · " + U.tamanho(d.arquivo.tamanho) : "") + "</div>" +
      (visto ? '<div class="doc__meta txt-ok">' + ic("checkcheck", "ic--sm") + " visto por " + U.esc(visto.por) + " às " + U.hora(visto.em) + " de " + U.dataCurta(visto.em) + "</div>" : d.origem !== "equipe" ? '<div class="doc__meta">' + ic("clock", "ic--sm") + " ainda não visto pela equipe</div>" : "") +
      (d.situacao === "pendencia" && d.revisao ? '<div class="aviso aviso--erro mt-4" style="padding:6px 10px">' + ic("alert", "ic--sm") + "<span>" + U.esc(d.revisao.motivo) + " <b>· " + U.esc(d.revisao.por) + "</b></span></div>" : "") +
      '</div><div class="pilha" style="gap:6px;align-items:flex-end">' + situacaoBadge(d.situacao) + '<div class="linha" style="gap:4px"><button type="button" class="btn btn--xs btn--contorno" data-acao="ver" data-id="' + d.id + '">' + ic("eye", "ic--sm") + "Ver</button>" + (podeRemover && d.situacao !== "aprovado" ? '<button type="button" class="btn btn--xs btn--fantasma" data-acao="remover" data-id="' + d.id + '" aria-label="Remover">' + ic("trash", "ic--sm") + "</button>" : "") + "</div></div></div>";
  }
  function telaDocumentos(r) {
    Shell.titulo("Meus arquivos");
    var aba = r.query.aba || "meus";
    Shell.render(UI.esqueleto(6));
    Dados.documentos(empresa.id).then(function (docs) {
      docsCache = docs;
      var meus = docs.filter(function (d) { return d.origem !== "anterior"; }), anteriores = docs.filter(function (d) { return d.origem === "anterior"; });
      var pend = docs.filter(function (d) { return d.situacao === "pendencia"; });
      var html = '<div class="pagina"><div class="cabecalho"><div><div class="cabecalho__kicker">Minha empresa</div><h1>Meus arquivos</h1><p>Tudo o que já foi enviado, por você ou pela sua contabilidade anterior, com a situação de cada um. Para saber o que ainda falta, use a Lista de documentos.</p></div><div class="cabecalho__acoes"><a class="btn btn--contorno btn--sm" href="#/cofre">' + ic("key") + 'Cofre de senhas</a></div></div>' +
        (pend.length ? '<div class="aviso aviso--erro">' + ic("alert") + "<div><b>" + pend.length + " documento" + (pend.length > 1 ? "s precisam" : " precisa") + " de correção</b>Veja o motivo no card e reenvie.</div></div>" : "") +
        '<div class="abas" role="tablist"><button type="button" role="tab" aria-selected="' + (aba === "meus") + '" data-acao="aba" data-aba="meus">Meus documentos <span class="badge">' + meus.length + '</span></button><button type="button" role="tab" aria-selected="' + (aba === "anterior") + '" data-acao="aba" data-aba="anterior">Da contabilidade anterior <span class="badge">' + anteriores.length + "</span></button></div>" +
        (aba === "meus" ?
          '<div class="grade grade--lado"><div class="pilha">' +
            '<div class="solta" id="solta" tabindex="0" role="button" aria-label="Enviar documento">' + ic("upload") + "<b>Toque para enviar</b><span class=\"f-13\">ou arraste arquivos aqui · PDF, foto, XML, planilha · até 25 MB</span></div>" +
            '<input type="file" id="arqInput" multiple hidden><input type="file" id="camInput" accept="image/*" capture="environment" hidden>' +
            '<div class="linha so-mobile"><button type="button" class="btn btn--contorno btn--sm" data-acao="camera">' + ic("camera") + "Tirar foto do documento</button></div>" +
            (meus.length ? '<div class="pilha" style="gap:6px">' + meus.map(function (d) { return docHtml(d, true); }).join("") + "</div>" : UI.vazio("folder", "Nenhum documento seu ainda", "Toque em Enviar, escolha o arquivo ou tire uma foto.")) +
          '</div><div class="pilha"><a class="card card--clicavel card--gold" href="#/entrada" style="text-decoration:none;color:inherit"><div class="card__corpo linha" style="flex-wrap:nowrap"><span class="selo-sistema" style="background:var(--gold);color:var(--gold-foreground)">' + ic("clipboard") + '</span><div class="lista__texto"><b>Lista de documentos</b><span class="lista__sub">O que a Totali ainda precisa de você, item por item, com ajuda em cada um.</span></div>' + ic("chevron-right") + '</div></a><div class="card"><div class="card__corpo pilha"><h3>Como enviar</h3><ul class="sistema__beneficios"><li>' + ic("check", "ic--sm") + 'Toque em "Toque para enviar" e escolha o arquivo, ou tire uma foto pelo celular.</li><li>' + ic("check", "ic--sm") + 'Diga o que é o documento na lista que abre.</li><li>' + ic("check", "ic--sm") + 'A equipe confere e você vê o aceite aqui, com nome e hora.</li></ul></div></div></div></div>'
        :
          '<div class="grade grade--lado"><div class="pilha">' + (anteriores.length ? '<div class="pilha" style="gap:6px">' + anteriores.map(function (d) { return docHtml(d, false); }).join("") + "</div>" : UI.vazio("inbox", "Nada chegou da contabilidade anterior ainda", "Quando a Totali mandar o link para eles e o primeiro arquivo chegar, ele aparece aqui, e você é avisado.")) +
          '</div><div class="pilha"><div class="card"><div class="card__corpo pilha"><h3>Como funciona</h3><p class="f-13 txt-2">A Totali envia um link seguro para a sua contabilidade anterior. Eles enviam contrato, balanços, livros e folha sem precisar criar conta. Você não precisa cobrar ninguém: é obrigação profissional deles entregar, e a gente conduz a conversa.</p><a class="btn btn--sm btn--contorno" href="#/chat">' + ic("chat") + "Perguntar sobre a transição</a></div></div></div></div>") +
        "</div>";
      var v = Shell.render(html);
      var solta = UI.$("#solta", v), inp = UI.$("#arqInput", v), cam = UI.$("#camInput", v);
      var grupoPre = r.query.grupo || "";
      var itensMes = (liberado("checklist") && global.Envio) ? global.Envio.itensPara(empresa) : [];
      function enviar(files, grupo) {
        var lista = Array.prototype.slice.call(files || []); if (!lista.length) return;
        var itemPre = r.query.item || "";
        var itemSel = itensMes.length ? '<div class="campo"><label class="campo__rotulo" for="itemMes">É um item do envio do mês?</label><select class="select" id="itemMes"><option value="">Não, é outro documento</option>' + itensMes.map(function (i) { return '<option value="' + i.id + '"' + (i.id === itemPre ? " selected" : "") + ">" + U.esc(i.texto) + "</option>"; }).join("") + "</select></div>" : "";
        var erros = lista.map(U.validarArquivo).filter(Boolean); if (erros.length) return UI.toast(erros[0], "erro");
        UI.modal({ titulo: "Enviar " + lista.length + " arquivo" + (lista.length > 1 ? "s" : ""), corpo: '<div class="pilha"><div class="campo"><label class="campo__rotulo" for="grp">O que é</label><select class="select" id="grp">' + GRUPOS_DOC.map(function (g) { return '<option value="' + g.id + '"' + (g.id === (grupo || grupoPre) ? " selected" : "") + ">" + U.esc(g.rotulo) + "</option>"; }).join("") + '</select></div>' + itemSel + '<div class="campo"><label class="campo__rotulo" for="obs">Observação (opcional)</label><input class="input" id="obs" placeholder="Ex.: RG da sócia Joana"></div><div class="pilha" style="gap:4px">' + lista.map(function (f) { return '<div class="f-13 linha">' + ic("file", "ic--sm") + U.esc(f.name) + ' <span class="txt-mudo">' + U.tamanho(f.size) + "</span></div>"; }).join("") + "</div></div>",
          acoes: [{ rotulo: "Cancelar" }, { rotulo: "Enviar", classe: "btn--primario", icone: "upload", ao: function (c) {
            var grp = c.querySelector("#grp").value, obs = c.querySelector("#obs").value;
            var selItem = c.querySelector("#itemMes"), itemId = selItem ? selItem.value : "";
            var primeiro = docsCache.filter(function (d) { return d.origem === "cliente"; }).length === 0;
            Promise.all(lista.map(function (f) { return Dados.enviarDocumento(empresa.id, { file: f, grupo: grp, origem: "cliente", por: sessao.nome, observacao: obs, item: itemId }); })).then(function () {
              if (primeiro) UI.celebrar("Primeiro documento enviado. A equipe já foi avisada."); else { UI.toast("Enviado. A equipe confere e você recebe o aceite aqui.", "ok"); UI.vibrar(); }
              if (itemId) { r.query.item = ""; global.Envio.marcar(empresa, U.anoMes(Date.now()), itemId, "documento").then(function (m) { if (m.completou) UI.celebrar("Mês de " + nomeMes(m.check.anoMes).split(" de ")[0] + " 100% em dia!"); else if (m.mudou) UI.toast("Marcado no envio do mês. Faltam " + global.Envio.resumo(m.check).faltam + ".", "ok"); }); }
              docsCache = null; telaDocumentos(r);
            }).catch(function (e) { UI.toast(e.message || "Falha no envio.", "erro"); });
          } }] });
      }
      if (solta) {
        solta.addEventListener("click", function () { inp.click(); });
        solta.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inp.click(); } });
        ["dragenter", "dragover"].forEach(function (ev) { solta.addEventListener(ev, function (e) { e.preventDefault(); solta.setAttribute("data-sobre", ""); }); });
        ["dragleave", "drop"].forEach(function (ev) { solta.addEventListener(ev, function (e) { e.preventDefault(); solta.removeAttribute("data-sobre"); }); });
        solta.addEventListener("drop", function (e) { enviar(e.dataTransfer.files); });
        inp.addEventListener("change", function () { enviar(inp.files); inp.value = ""; });
        cam.addEventListener("change", function () { enviar(cam.files); cam.value = ""; });
        if (grupoPre && !r.query.aba) setTimeout(function () { UI.toast(r.query.item ? "Anexe o arquivo: o item do envio do mês fecha sozinho." : "Anexe o arquivo: já deixei o tipo selecionado.", "info"); }, 200);
      }
      UI.delegar(v, {
        aba: function (b) { location.hash = "#/documentos?aba=" + b.dataset.aba; },
        camera: function () { cam.click(); },
        "enviar-grupo": function (b) { grupoPre = b.dataset.grupo; inp.click(); },
        ver: function (b) { var d = docs.filter(function (x) { return x.id === b.dataset.id; })[0]; Dados.urlArquivo(d).then(function (u) { if (u) global.open(u, "_blank", "noopener"); else UI.toast("Este arquivo de exemplo não tem conteúdo. Envie um arquivo real para ver a prévia.", "info"); }); },
        remover: function (b) { UI.confirmar("Remover documento?", "Você pode enviar outro depois.", { ok: "Remover", perigo: true }).then(function (ok) { if (ok) Dados.removerDocumento(empresa.id, b.dataset.id).then(function () { docsCache = null; telaDocumentos(r); }); }); }
      });
    });
  }
  function telaAnteriorInfo() { location.hash = "#/documentos?aba=anterior"; }

  /* ============================================================
     Cofre de senhas (criptografia ponta a ponta, do Academy)
     ============================================================ */
  var TIPOS_CRED = [["certificado", "Senha do certificado digital"], ["simples", "Simples Nacional (código de acesso)"], ["sefaz", "SEFAZ / Nota fiscal eletrônica"], ["empregador", "Empregador Web / eSocial"], ["prefeitura", "Prefeitura (NFS-e / ISS)"], ["maquininha", "Maquininha (perfil de consulta)"], ["banco", "Internet banking (perfil de consulta)"], ["outro", "Outro sistema"]];
  function telaCofre() {
    Shell.titulo("Cofre de senhas");
    Shell.render(UI.esqueleto(4));
    Dados.credenciais(empresa.id).then(function (creds) {
      credCache = creds;
      var pronto = Cripto.configurada || Dados.ehDemo();
      Shell.render('<div class="pagina"><div class="cabecalho"><div><div class="cabecalho__kicker">Segurança</div><h1>Cofre de senhas</h1><p>Guarde aqui as senhas que a Totali precisa para trabalhar pela sua empresa (certificado, Simples, SEFAZ). Elas são embaralhadas <b>no seu aparelho</b> antes de sair: ninguém no caminho consegue ler, e cada vez que alguém da equipe abre uma senha fica registrado com nome e hora.</p></div><div class="cabecalho__acoes"><button type="button" class="btn btn--primario" data-acao="nova"' + (pronto ? "" : " disabled") + ">" + ic("plus") + "Guardar senha</button></div></div>" +
        (pronto ? "" : '<div class="aviso aviso--aviso">' + ic("alert") + "<div><b>Canal seguro em configuração</b>" + U.esc(Cripto.motivo()) + "</div></div>") +
        (Dados.ehDemo() && !Cripto.configurada ? '<div class="aviso aviso--info">' + ic("info") + "<div><b>Modo demonstração</b>Sem chave pública configurada, as senhas ficam apenas neste navegador, marcadas como demonstração.</div></div>" : "") +
        '<div class="grade grade--lado"><div class="pilha">' + (creds.length ? '<div class="pilha" style="gap:6px">' + creds.map(function (c) { return '<div class="doc entra"><span class="doc__icone" style="background:var(--gold-soft);color:var(--gold-text)">' + ic("lock") + '</span><div style="flex:1;min-width:0"><div class="doc__nome">' + U.esc(c.rotulo) + '</div><div class="doc__meta">' + (c.usuario ? "usuário: " + U.esc(c.usuario) + " · " : "") + "guardada " + U.relativo(c.em) + '</div><div class="doc__meta senha-campo">••••••••••</div></div><button type="button" class="btn btn--xs btn--fantasma" data-acao="remover" data-id="' + c.id + '" aria-label="Remover">' + ic("trash", "ic--sm") + "</button></div>"; }).join("") + "</div>" : UI.vazio("key", "Nenhuma senha guardada", "Certificado, Simples Nacional, SEFAZ… guarde aqui em vez de mandar por WhatsApp.")) +
        '</div><div class="pilha"><div class="card"><div class="card__corpo pilha"><h3>' + ic("shield") + ' Como protegemos</h3><ul class="sistema__beneficios"><li>' + ic("check", "ic--sm") + "Cifrado no seu aparelho com a chave pública da Totali</li><li>" + ic("check", "ic--sm") + "Só a chave privada, guardada no cofre do servidor, abre</li><li>" + ic("check", "ic--sm") + "Cada abertura pela equipe fica registrada</li><li>" + ic("check", "ic--sm") + "Prefira perfis de consulta, que não movimentam dinheiro</li></ul></div></div></div></div></div>");
      UI.delegar(Shell.view(), {
        nova: function () {
          UI.modal({ titulo: "Guardar senha com segurança", corpo: '<div class="pilha"><div class="campo"><label class="campo__rotulo" for="ct">Qual sistema</label><select class="select" id="ct">' + TIPOS_CRED.map(function (t) { return '<option value="' + t[0] + '">' + t[1] + "</option>"; }).join("") + '</select></div><div class="campo"><label class="campo__rotulo" for="cr">Nome (como você chama)</label><input class="input" id="cr" placeholder="Ex.: Senha do certificado A1"></div><div class="campo"><label class="campo__rotulo" for="cu">Usuário / login (opcional)</label><input class="input" id="cu" autocomplete="off"></div><div class="campo"><label class="campo__rotulo" for="cs">Senha</label><input class="input senha-campo" id="cs" type="password" autocomplete="new-password"></div><div class="campo"><label class="campo__rotulo" for="co">Observação (opcional)</label><input class="input" id="co" placeholder="Ex.: pede código por SMS"></div></div>',
            acoes: [{ rotulo: "Cancelar" }, { rotulo: "Guardar com segurança", classe: "btn--primario", icone: "lock", ao: function (c) {
              var rot = c.querySelector("#cr").value.trim() || TIPOS_CRED.filter(function (t) { return t[0] === c.querySelector("#ct").value; })[0][1];
              var senha = c.querySelector("#cs").value; if (!senha) { UI.toast("Digite a senha.", "aviso"); return false; }
              var dados = { senha: senha, usuario: c.querySelector("#cu").value.trim(), obs: c.querySelector("#co").value.trim(), tipo: c.querySelector("#ct").value };
              var p = Cripto.configurada ? Cripto.cifrar(dados) : Promise.resolve({ demo: true, segredo: btoa(unescape(encodeURIComponent(senha))) });
              p.then(function (pacote) { return Dados.salvarCredencial(empresa.id, { rotulo: rot, tipo: dados.tipo, usuario: dados.usuario, pacote: pacote, por: sessao.nome }); })
                .then(function () { c.querySelector("#cs").value = ""; UI.toast("Guardada. Só a Totali consegue abrir, e cada abertura fica registrada.", "ok"); UI.vibrar(); credCache = null; telaCofre(); })
                .catch(function (e) { UI.toast(e.message || "Não foi possível guardar.", "erro"); });
            } }] });
        },
        remover: function (b) { UI.confirmar("Remover esta senha do cofre?", "A Totali deixa de ter acesso a ela.", { ok: "Remover", perigo: true }).then(function (ok) { if (ok) Dados.removerCredencial(empresa.id, b.dataset.id, sessao).then(function () { credCache = null; telaCofre(); }); }); }
      });
    });
  }

  /* ============================================================
     Chat
     ============================================================ */
  function telaChat() {
    Shell.titulo("Chat com a Totali");
    var v = Shell.render("");
    var cab = '<div class="chat__cab">' + UI.avatar("Totali", "avatar--gold") + '<div class="lista__texto"><span class="lista__titulo">Equipe Totali</span><span class="chat__online">' + U.esc(CATALOGO.responsaveisTexto(empresa) || "Responde em horário comercial") + '</span></div><a class="btn btn--xs btn--contorno so-desktop" href="#/documentos">' + ic("folder", "ic--sm") + "Documentos</a></div>";
    chatAtual = Chat.montar(v, { empresaId: empresa.id, eu: { uid: sessao.uid, nome: sessao.nome, lado: "cliente" }, cabecalho: cab,
      aoEnviar: function (m) { Vitrine.gatilho(m.texto); atualizarBadges(); },
      aoReceber: function () { atualizarBadges(); } });
  }

  /* ============================================================
     Perfil e preferências
     ============================================================ */
  function telaPerfil() {
    Shell.titulo("Perfil");
    var pref = UI.pref(), tema = global.Tema.atual();
    var meu = (empresa.acessos || []).filter(function (a) { return a.uid === sessao.uid; })[0] || {};
    Shell.render('<div class="pagina"><div class="cabecalho"><div><div class="cabecalho__kicker">Você</div><h1>' + U.esc(sessao.nome) + "</h1><p>" + U.esc(sessao.email) + " · " + U.esc(empresa.fantasia) + "</p></div><div class=\"cabecalho__acoes\"><button type=\"button\" class=\"btn btn--contorno\" data-acao=\"sair\">" + ic("log-out") + "Sair</button></div></div>" +
      '<div class="grade grade--2">' +
        '<div class="card"><div class="card__cab"><h2>Como falar com você</h2></div><div class="card__corpo pilha" style="padding-top:10px"><div class="campo"><span class="campo__rotulo">Canal preferido</span><div class="segmentos" id="canal">' + [["whatsapp", "WhatsApp"], ["portal", "Portal"], ["telefone", "Telefone"], ["email", "E-mail"]].map(function (c) { return '<button type="button" data-v="' + c[0] + '" aria-pressed="' + (empresa.canalPreferido === c[0]) + '">' + c[1] + "</button>"; }).join("") + "</div></div>" +
          '<div class="campo"><label class="campo__rotulo" for="meuWhats">Seu WhatsApp</label><div class="linha" style="flex-wrap:nowrap;gap:6px"><input class="input" id="meuWhats" inputmode="tel" autocomplete="tel" placeholder="(79) 99999-9999" value="' + U.esc(meu.whatsapp || "") + '"><button type="button" class="btn btn--sm btn--contorno" data-acao="salvar-whats">Salvar</button></div><span class="campo__ajuda">Para a Totali falar com você pelo WhatsApp.</span></div>' +
          '<label class="interruptor"><input type="checkbox" id="pEmail"' + (meu.avisosEmail !== false ? " checked" : "") + '><span class="interruptor__pista"></span>' + ic("mail") + " Avisos por e-mail</label>" +
          '<p class="f-12 txt-mudo">Chegam em ' + U.esc(sessao.email) + ": mensagem nova da Totali, documento para corrigir e lembretes de prazo.</p>" +
          '<div class="campo"><span class="campo__rotulo">Como quer receber os relatórios do mês</span><div class="segmentos" id="relatorios">' + [["portal", "No portal"], ["email", "E-mail"], ["whatsapp", "WhatsApp"]].map(function (c) { return '<button type="button" data-v="' + c[0] + '" aria-pressed="' + (empresa.formaRelatorio === c[0]) + '">' + c[1] + "</button>"; }).join("") + "</div></div>" +
          (sessao.empresas && sessao.empresas.length > 1 ? '<div class="campo"><span class="campo__rotulo">Empresa aberta</span><div class="linha" style="gap:8px"><b>' + U.esc(empresa.fantasia) + '</b><button type="button" class="btn btn--sm btn--contorno" data-acao="trocar-emp">' + ic("building", "ic--sm") + "Trocar de empresa</button></div><span class=\"campo__ajuda\">Você acompanha " + sessao.empresas.length + " empresas no portal.</span></div>" : "") +
        "</div></div>" +
        '<div class="card"><div class="card__cab"><h2>Aparência e avisos</h2></div><div class="card__corpo pilha" style="padding-top:10px">' +
          '<div class="campo"><span class="campo__rotulo">Tema</span><div class="segmentos" id="tema">' + [["claro", "sun", "Claro"], ["escuro", "moon", "Escuro"], ["sistema", "monitor", "Sistema"]].map(function (t) { return '<button type="button" data-v="' + t[0] + '" aria-pressed="' + (tema === t[0]) + '">' + ic(t[1], "ic--sm") + " " + t[2] + "</button>"; }).join("") + "</div></div>" +
          '<label class="interruptor"><input type="checkbox" id="pSom"' + (pref.som !== false ? " checked" : "") + '><span class="interruptor__pista"></span>' + ic("volume") + " Som ao enviar e receber mensagem</label>" +
          '<label class="interruptor"><input type="checkbox" id="pHap"' + (pref.haptica !== false ? " checked" : "") + '><span class="interruptor__pista"></span>' + ic("vibrate") + " Vibração curta ao confirmar (celular)</label>" +
          '<p class="f-12 txt-mudo">Som e vibração só acontecem no que você faz ou recebe. Nunca em propaganda.</p>' +
          (global.Notificacoes && global.Notificacoes.suportado() ? '<label class="interruptor"><input type="checkbox" id="pAvisos"' + (global.Notificacoes.permissao() === "granted" && pref.avisos !== false ? " checked" : "") + (global.Notificacoes.permissao() === "denied" ? " disabled" : "") + '><span class="interruptor__pista"></span>' + ic("bell") + " Avisos no aparelho quando a Totali responder</label>" + (global.Notificacoes.permissao() === "denied" ? '<p class="f-12 txt-aviso">Bloqueado no navegador. Libere nas configurações do site.</p>' : /iPhone|iPad/.test(navigator.userAgent) ? '<p class="f-12 txt-mudo">No iPhone, os avisos só funcionam com o portal instalado na tela de início.</p>' : "") : "") +
          '<div class="linha"><button type="button" class="btn btn--sm btn--contorno" data-acao="tour">' + ic("play") + 'Rever tutorial</button>' + (global.__instalar ? '<button type="button" class="btn btn--sm btn--gold" data-acao="instalar">' + ic("download") + "Instalar como aplicativo</button>" : "") + "</div>" +
        "</div></div>" +
        '<div class="card"><div class="card__cab"><h2>Minha empresa</h2></div><div class="card__corpo pilha" style="padding-top:10px;gap:6px"><div class="linha linha--entre f-13"><span class="txt-2">Razão social</span><b>' + U.esc(empresa.nome) + '</b></div><div class="linha linha--entre f-13"><span class="txt-2">CNPJ</span><b class="num">' + U.esc(empresa.cnpj) + '</b></div><div class="linha linha--entre f-13"><span class="txt-2">Regime</span><b>' + U.esc(empresa.regime) + '</b></div>' + CATALOGO.responsaveis(empresa).map(function (p) { return '<div class="linha linha--entre f-13"><span class="txt-2">' + U.esc(p.rotulo) + '</span><b>' + U.esc(p.nome) + "</b></div>"; }).join("") + '<p class="f-12 txt-mudo mt-8">Algo errado? Avise pelo chat que a equipe corrige.</p></div></div>' +
        '<div class="card"><div class="card__cab"><h2>Privacidade</h2></div><div class="card__corpo pilha" style="padding-top:10px"><p class="f-13 txt-2">A Totali registra quais telas e sistemas você usa, para melhorar o atendimento e para a cobrança do que foi contratado. Nunca registra o conteúdo das mensagens, dos arquivos ou das senhas. Você pode pedir a exportação ou a exclusão dos seus dados pelo chat (LGPD, art. 18).</p>' + (Dados.ehDemo() ? '<button type="button" class="btn btn--sm btn--perigo" data-acao="zerar">' + ic("refresh") + "Zerar dados da demonstração</button>" : "") + "</div></div>" +
      "</div></div>");
    var v = Shell.view();
    function segm(id, aoEscolher) { UI.$$("#" + id + " button", v).forEach(function (b) { b.addEventListener("click", function () { UI.$$("#" + id + " button", v).forEach(function (x) { x.setAttribute("aria-pressed", "false"); }); b.setAttribute("aria-pressed", "true"); aoEscolher(b.dataset.v); }); }); }
    segm("canal", function (val) { Dados.salvarEmpresa(empresa.id, { canalPreferido: val }).then(function () { empresa.canalPreferido = val; UI.toast("Canal preferido salvo.", "ok"); UI.vibrar(); }); });
    segm("relatorios", function (val) { Dados.salvarEmpresa(empresa.id, { formaRelatorio: val }).then(function () { empresa.formaRelatorio = val; UI.toast("Forma de receber relatórios salva.", "ok"); UI.vibrar(); }); });
    segm("tema", function (val) { global.Tema.definir(val); Shell.redesenhar(); telaPerfil(); });
    UI.$("#pSom", v).addEventListener("change", function () { UI.definirPref("som", this.checked); if (this.checked) UI.som("enviado"); });
    UI.$("#pHap", v).addEventListener("change", function () { UI.definirPref("haptica", this.checked); if (this.checked) UI.vibrar(); });
    var pAv = UI.$("#pAvisos", v); if (pAv) pAv.addEventListener("change", function () { var el = this; if (el.checked) { global.Notificacoes.pedir().then(function (p) { UI.definirPref("avisos", p === "granted"); if (p !== "granted") { el.checked = false; UI.toast("Avisos não autorizados pelo navegador.", "aviso"); } }); } else UI.definirPref("avisos", false); });
    UI.$("#pEmail", v).addEventListener("change", function () { var val = this.checked; Dados.salvarMeuAcesso(empresa.id, sessao.uid, { avisosEmail: val }).then(function () { meu.avisosEmail = val; UI.toast(val ? "Avisos por e-mail ligados." : "Avisos por e-mail desligados.", "ok"); }).catch(function () { UI.toast("Não foi possível salvar agora.", "erro"); }); });
    UI.delegar(v, { "trocar-emp": function () { escolherEmpresa(); }, "salvar-whats": function () { var inp = UI.$("#meuWhats", v), n = inp.value.replace(/\D/g, ""); if (n && (n.length < 10 || n.length > 13)) { UI.toast("Confira o número: DDD e telefone.", "aviso"); inp.focus(); return; } Dados.salvarMeuAcesso(empresa.id, sessao.uid, { whatsapp: inp.value.trim() }).then(function () { meu.whatsapp = inp.value.trim(); UI.toast(n ? "WhatsApp salvo." : "WhatsApp removido.", "ok"); }).catch(function () { UI.toast("Não foi possível salvar agora.", "erro"); }); },
      tour: function () { location.hash = "#/inicio"; setTimeout(function () { global.Tour.iniciar("portal-inicio"); }, 500); }, instalar: function () { if (global.__instalar) { global.__instalar.prompt(); global.__instalar = null; } }, sair: sair, zerar: function () { UI.confirmar("Zerar a demonstração?", "Apaga os dados fictícios deste navegador e recria a semente.", { ok: "Zerar", perigo: true }).then(function (ok) { if (ok) Dados.zerar().then(function () { location.hash = "#/entrar"; location.reload(); }); }); } });
  }

  iniciar();
})(window);
