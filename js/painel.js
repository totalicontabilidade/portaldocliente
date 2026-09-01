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
    if (ABAS.indexOf(id) === -1) return PADRAO;
    /* Rota digitada à mão para uma aba que não é dela cai no
       Início, em vez de abrir uma tela que só saberia recusar. */
    if (SO_ADMIN.indexOf(id) > -1 && !souAdmin) return PADRAO;
    return id;
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

    /* No celular, as quatro abas do "Mais" não estão na barra —
       sem isto, estando em Conteúdo a barra ficaria sem nenhum
       item aceso, e a pessoa não saberia dizer onde está. */
    var mais = $("#pnMaisAbas");
    if (mais) {
      var eDoMais = ABAS_DO_MAIS.some(function (a) { return a.id === alvo; });
      if (eDoMais) mais.setAttribute("aria-current", "page");
      else mais.removeAttribute("aria-current");
    }

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
    aplicarPermissoes(equipe);
  }

  /* ---------- O que cada papel enxerga no menu ----------

     ABAS SÓ DE ADMINISTRADOR. A tela de Segurança é onde se gera o
     par de chaves que tranca as senhas dos clientes: publicar uma
     chave nova torna ilegível tudo o que já foi enviado, e isso
     não é decisão de quem está conferindo documento. Some do menu
     para quem não é administrador.

     Esconder é conforto, não proteção — a regra do Firestore e o
     Secret Manager é que decidem de verdade, e continuam decidindo
     mesmo que alguém digite a rota na barra de endereço. O que
     esta função evita é a pessoa entrar numa tela que só teria
     como lhe dizer não. */
  var SO_ADMIN = ["seguranca"];

  /* UMA FONTE SÓ para o papel de quem está usando.

     Antes o menu escondia a aba olhando o objeto que chegou em
     `sessao()`, e a validação da rota olhava `FB.equipe`. Em
     produção são o mesmo objeto e ninguém veria diferença — até o
     dia em que não fossem, e aí a aba estaria escondida no menu e
     aberta pela barra de endereço. Duas leituras da mesma coisa é
     como uma delas fica para trás. */
  var souAdmin = false;

  /* As abas que saem da barra do celular e vêm pelo "Mais". A
     ordem é a mesma do menu lateral, para quem trocar de aparelho
     não ter que reaprender. */
  var ABAS_DO_MAIS = [
    { id: "novo", rotulo: "Novo cliente", icone: "ic-plus" },
    { id: "conteudo", rotulo: "Conteúdo do portal", icone: "ic-folder" },
    { id: "usuarios", rotulo: "Usuários", icone: "ic-badge" },
    { id: "seguranca", rotulo: "Segurança", icone: "ic-shield" }
  ];

  function abrirMaisAbas(botao) {
    var itens = ABAS_DO_MAIS.filter(function (a) {
      return SO_ADMIN.indexOf(a.id) === -1 || souAdmin;
    }).map(function (a) {
      return { rotulo: a.rotulo, icone: a.icone, onClick: function () { abrir(a.id); } };
    });
    var r = botao.getBoundingClientRect();
    /* `limiteInferior` é o topo da barra: sem ele o menu pousaria
       em cima dela e cobriria o próprio botão que foi tocado. */
    UI.menu({ x: r.left, y: r.top, limiteInferior: r.top, itens: itens });
  }

  function aplicarPermissoes(equipe) {
    souAdmin = !!(equipe && equipe.papel === "admin");
    var admin = souAdmin;
    SO_ADMIN.forEach(function (aba) {
      $$('[data-aba="' + aba + '"]').forEach(function (b) { b.hidden = !admin; });
    });
    /* Já estava numa aba que deixou de existir para ela — acontece
       quando o próprio papel muda com o painel aberto. */
    if (!admin && SO_ADMIN.indexOf(abaAtual) > -1) abrir(PADRAO);
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
  /* O tutorial da ROTINA. Vale para todo mundo, e descreve o dia
     de trabalho na ordem em que ele acontece: chegar, ver o que
     precisa de você, conferir o que chegou, cobrar o que falta,
     responder quem escreveu. Nada de explicar a arquitetura do
     sistema — quem senta aqui quer saber o que fazer agora. */
  var PASSOS = [
    { alvo: null,
      titulo: "Bem-vindo ao painel",
      texto: "Em um minuto eu mostro como é o dia aqui dentro. Dá para sair quando quiser, e o " +
             "botão Tutorial, no topo, traz de volta." },
    { alvo: '.sidenav__item[data-aba="inicio"]',
      titulo: "Comece sempre por aqui",
      texto: "O Início responde uma pergunta só: o que precisa de você agora. Ele junta o que " +
             "está espalhado nas outras abas e põe em ordem de urgência. Se você abrir o painel " +
             "e não souber por onde começar, é esta a tela." },
    { alvo: '.sidenav__item[data-aba="clientes"]',
      titulo: "Conferir o que chegou",
      texto: "A lista vem ordenada por quem está parado há mais tempo, não por nome. Abra um " +
             "cliente e você vê os documentos dele: aprovar, pedir correção com o motivo, ou " +
             "tirar a marcação se errou. O que você aprova fica no nome de quem aprovou. " +
             "Documento que você devolveu continua ali para abrir e aprovar depois." },
    { alvo: '.sidenav__item[data-aba="clientes"]',
      titulo: "E encerrar quando acabar",
      texto: "Quando não sobrar nada pendente, aparece Concluir migração na ficha. É esse " +
             "botão que diz ao cliente que terminou — sem ele, o portal dele segue mostrando " +
             "\"em análise pela Totali\" para sempre, esperando uma palavra que ninguém deu." },
    { alvo: '.sidenav__item[data-aba="pendencias"]',
      titulo: "Cobrar o que falta",
      texto: "Aqui está tudo o que ainda não chegou, empresa por empresa. O botão Cobrar monta " +
             "o texto pronto com a lista — você escolhe mandar pelo portal, pelo WhatsApp ou " +
             "por e-mail. Dá para cobrar tudo de uma vez ou só um documento." },
    { alvo: '.sidenav__item[data-aba="mensagens"]',
      titulo: "Responder quem escreveu",
      texto: "Todas as conversas em um lugar, com filtro de não lidas e de a resolver. Quando " +
             "terminar de tratar uma, marque como resolvida para ela sair da sua frente." },
    { alvo: '.sidenav__item[data-aba="mensagens"]',
      titulo: "Errou ao mandar?",
      texto: "Clique com o botão direito na sua mensagem — no celular, segure o dedo nela. Dá " +
             "para corrigir o texto nos primeiros 5 minutos e apagar nos primeiros 15. Só a " +
             "sua, e apagada ela vira \"Mensagem apagada\" no seu nome: a conversa é o " +
             "registro do que foi combinado, e nada some sem deixar rastro." },
    { alvo: '.sidenav__item[data-aba="novo"]',
      titulo: "Entrar um cliente novo",
      texto: "Preencha razão social e CNPJ e o painel devolve um link. O cliente abre o link, " +
             "cria a senha dele e o portal já nasce com os dados certos." },
    /* Faltava. Quem faz a rotina precisa saber que o portal do
       cliente se muda por aqui — senão pede a alguém "que mexe no
       sistema" o que ela mesma faria em dois minutos. */
    { alvo: '.sidenav__item[data-aba="conteudo"]',
      titulo: "O portal do cliente se muda aqui",
      texto: "Vídeo de abertura, aulas do Academy, a lista de documentos do checklist, os " +
             "bancos e maquininhas e o aviso automático de cobrança: tudo isso você altera " +
             "nesta aba, sem pedir para ninguém. Vale depois de tocar em Publicar para os " +
             "clientes. Mexer no checklist muda o que TODO cliente precisa enviar — nesse, " +
             "combine antes." },
    { alvo: "#pnQuem",
      titulo: "Seu nome fica registrado",
      texto: "Cada documento aprovado e cada senha de maquininha aberta guarda quem fez e " +
             "quando. Confira aqui em cima que é você antes de conferir documento — e nunca " +
             "trabalhe na conta de outra pessoa." }
  ];

  /* O tutorial de ADMINISTRADOR, e só ele. Não repete a rotina:
     mostra o que muda por ser admin, que é justamente o que a
     pessoa não descobre sozinha — as três coisas que ela pode
     fazer e mais ninguém, e o peso de cada uma. */
  var PASSOS_ADMIN = [
    { alvo: null,
      titulo: "Você é administrador",
      texto: "A rotina é a mesma de todo mundo. O que muda são cinco poderes que só você tem, " +
             "e que ninguém da equipe consegue usar. Vou mostrar quais são." },
    { alvo: '.sidenav__item[data-aba="usuarios"]',
      titulo: "1. Quem entra no painel",
      texto: "Só administrador cria, remove ou muda o papel de alguém. Ao desligar uma pessoa, " +
             "remova a conta dela aqui: o acesso morre na hora. Use e-mail nominal, nunca caixa " +
             "de setor — é este nome que fica em cada documento aprovado." },
    { alvo: '.sidenav__item[data-aba="usuarios"]',
      titulo: "Administrador ou equipe?",
      texto: "Quem é da equipe faz a rotina inteira: confere documento, cobra, responde, cria " +
             "cliente e abre senha de maquininha. O que ele NÃO faz é mexer nesta lista, " +
             "excluir cliente definitivamente, apagar mensagem de outra pessoa, entrar em " +
             "Segurança nem editar as quatro seções de Conteúdo que são suas. Ele também não " +
             "vê o papel dos colegas nesta lista — só os nomes. Na dúvida, cadastre como " +
             "equipe." },
    { alvo: '.sidenav__item[data-aba="clientes"]',
      titulo: "2. Excluir um cliente de vez",
      texto: "Dentro da ficha, em Encerrar cliente, só você vê o botão de excluir. Ele apaga " +
             "documentos, mensagens, senhas e o acesso — sem volta e sem backup. Para encerrar " +
             "atendimento, arquivar resolve e preserva tudo; documento de cliente tem prazo de " +
             "guarda." },
    { alvo: '.sidenav__item[data-aba="mensagens"]',
      titulo: "3. Apagar qualquer mensagem",
      texto: "Cada um apaga a própria mensagem, e só nos primeiros 15 minutos. Você apaga " +
             "qualquer uma, inclusive do cliente, a qualquer tempo — é a saída para algo " +
             "indevido que ninguém descobre em 15 minutos. Nada some de vez: fica " +
             "\"Mensagem apagada\" no seu nome. E editar mensagem alheia ninguém faz, nem " +
             "você: apagar tira algo do registro, editar põe palavra na boca dos outros." },
    { alvo: '.sidenav__item[data-aba="seguranca"]',
      titulo: "4. As chaves do canal seguro",
      texto: "É o par de chaves que deixa o cliente mandar senha sem ela ficar legível. Já está " +
             "funcionando; você só volta aqui se precisar trocar. Perder a chave privada torna " +
             "ilegível tudo o que os clientes já enviaram." },
    /* O registro ganhou tela agora; sem este passo, o administrador
       continuaria sem saber que ela existe — e era exatamente esse
       o problema que a tela veio resolver. */
    { alvo: '.sidenav__item[data-aba="seguranca"]',
      titulo: "E o registro do servidor, na mesma tela",
      texto: "Mais abaixo em Segurança fica tudo o que aconteceu: cada senha aberta, cada " +
             "documento aprovado, cada acesso criado — com quem fez e quando. Quem escreve é o " +
             "servidor, com o relógio dele: nem você consegue alterar, e é isso que faz o " +
             "registro valer como prova. É onde se olha quando um cliente pergunta quem " +
             "acessou o que, e quando se desliga alguém." },
    /* O texto dizia "toda a equipe pode mexer", e deixou de ser
       verdade quando quatro seções passaram a ser só de admin. */
    { alvo: '.sidenav__item[data-aba="conteudo"]',
      titulo: "5. As quatro seções que só você edita",
      texto: "Em Conteúdo do portal, a equipe cuida do vídeo, do Academy, do checklist e dos " +
             "catálogos. Só você vê e altera as Etapas da migração, as Perguntas frequentes, o " +
             "Compromisso e termo e os Contatos e endereço — são os textos que falam pela " +
             "empresa inteira ou que o cliente assina." }
  ];

  /* Abre sozinho na primeira vez. Se a pessoa sair no meio, conta
     como visto — quem já entendeu não precisa ser interrompido de
     novo, e o botão traz de volta. */
  function abrirTutorial(qual) {
    var FB = global.FB;
    if (!global.Tour || global.Tour.aberto) return;
    var nome = qual === "admin" ? "admin" : "painel";
    global.Tour.iniciar({
      passos: nome === "admin" ? PASSOS_ADMIN : PASSOS,
      aoFim: function () { if (FB && FB.marcarTutorialEquipe) FB.marcarTutorialEquipe(nome); }
    });
  }

  /* O botão do cabeçalho. Para quem é da equipe existe um tutorial
     só, e perguntar qual seria pergunta boba. Para administrador
     existem dois, e ele precisa conseguir chegar no segundo depois
     de já ter visto — senão o de administrador some para sempre no
     dia em que ele o fecha. */
  function pedirTutorial() {
    var FB = global.FB;
    if (!FB || !FB.equipe || FB.equipe.papel !== "admin") { abrirTutorial("painel"); return; }

    UI.modal({
      titulo: "Ver o tutorial",
      corpoHTML: '<p style="font-size:13.5px;line-height:1.65;color:var(--txt-2)">' +
        'Qual deles?</p>',
      acoes: [
        { rotulo: "Cancelar", classe: "btn--ghost" },
        { rotulo: "A rotina do painel", classe: "btn--ghost",
          onClick: function () { setTimeout(function () { abrirTutorial("painel"); }, 250); } },
        { rotulo: "O que muda sendo administrador", classe: "btn--primary",
          onClick: function () { setTimeout(function () { abrirTutorial("admin"); }, 250); } }
      ]
    });
  }

  /* Na primeira vez: a rotina primeiro, para todo mundo. O de
     administrador vem depois, na visita seguinte — dois tutoriais
     seguidos no primeiro login seria demais, e o segundo só faz
     sentido depois de a pessoa ter visto o painel funcionando. */
  function talvezTutorial() {
    var FB = global.FB;
    if (!global.Tour || !FB || !FB.equipe) return;
    var falta = !FB.tutorialEquipeVisto("painel") ? "painel"
              : (FB.equipe.papel === "admin" && !FB.tutorialEquipeVisto("admin")) ? "admin"
              : "";
    if (!falta) return;
    /* Deixa a tela assentar antes de escurecer tudo: abrir o
       tutorial em cima de um painel meio desenhado aponta para
       lugares que ainda vão mudar de posição. */
    setTimeout(function () {
      if (FB.equipe && !FB.tutorialEquipeVisto(falta)) abrirTutorial(falta);
    }, 1200);
  }

  /* ---------- Entrar e sair ---------- */
  /* A MARCA DO CABEÇALHO, igual ao que já vale no portal do cliente.

     Na tela de entrada fica o SÍMBOLO: o cartão de login logo abaixo
     já traz a marca grande, e repetir a um palmo de distância não
     reforça nada. Com a pessoa dentro, o cartão sumiu e o alto da
     tela vira o único lugar com identidade — aí entra a logo
     completa da contabilidade.

     Aqui é a marca da TOTALI, não a do Portal do Cliente: este
     painel é ferramenta interna do escritório, não daquele produto. */
  var MARCA_SIMBOLO = { src: "assets/totali-simbolo.png", w: 220, h: 230 };
  var MARCA_CHEIA   = { src: "assets/totali-contabil-branca.png", w: 730, h: 277 };

  function trocarMarca(cheia) {
    var img = $("#pnLogo");
    if (!img) return;
    var qual = cheia ? "cheia" : "simbolo";
    /* Só mexe se mudou: reatribuir o mesmo `src` faz o navegador
       repintar e a marca pisca a cada chamada. */
    if (img.getAttribute("data-marca") === qual) return;
    var m = cheia ? MARCA_CHEIA : MARCA_SIMBOLO;
    img.setAttribute("data-marca", qual);
    img.width = m.w;
    img.height = m.h;
    img.src = m.src;
    img.classList.toggle("brand__logo--cheia", !!cheia);
  }

  function mostrarPainel(dentro) {
    var painel = $("#painel"), porta = $("#pnPorta"), tabbar = $("#pnTabbar");
    if (painel) painel.hidden = !dentro;
    if (porta) porta.hidden = dentro;
    if (tabbar) tabbar.hidden = !dentro;
    trocarMarca(!!dentro);
    document.body.classList.toggle("porta-aberta", !dentro);
    if (dentro) { aplicar(abaDaURL(), true); talvezTutorial(); }
  }

  function ligar() {
    document.addEventListener("click", function (ev) {
      var t = ev.target.closest("[data-tutorial-painel]");
      if (t) { ev.preventDefault(); pedirTutorial(); return; }

      var mais = ev.target.closest("#pnMaisAbas");
      if (mais) { ev.preventDefault(); abrirMaisAbas(mais); return; }

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
