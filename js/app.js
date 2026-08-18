/* ============================================================
   Totali · Portal de Onboarding
   app.js — rotas, telas e comportamento

   Regra de ouro deste arquivo: nenhuma string vinda do cliente
   entra em innerHTML sem passar por U.esc().
   ============================================================ */
(function (global) {
  "use strict";

  var U = global.U, UI = global.UI, DATA = global.DATA, Store = global.Store;
  var $ = UI.$, $$ = UI.$$, ic = UI.icone;

  /* ---------- Rotas ---------- */
  var ROTAS = [
    { id: "inicio",      titulo: "Início",     icone: "ic-home",     nav: true },
    { id: "documentos",  titulo: "Documentos", icone: "ic-folder",   nav: true },
    { id: "financeiro",  titulo: "Bancos e maquininhas", icone: "ic-card", nav: true },
    { id: "mensagens",   titulo: "Mensagens",  icone: "ic-chat",     nav: true },
    { id: "academy",     titulo: "Academy",    icone: "ic-play",     nav: true },
    { id: "empresa",     titulo: "Empresa",    icone: "ic-building", nav: true },
    { id: "ajuda",       titulo: "Ajuda",      icone: "ic-help",     nav: true },
    { id: "privacidade", titulo: "Privacidade e segurança", icone: "ic-shield", nav: false },
    { id: "boas-vindas", titulo: "Boas-vindas", icone: "ic-home",    nav: false }
  ];

  var estadoUI = {
    gruposAbertos: {},
    trilhaAberta: "",
    faqAberta: {},
    rota: "inicio",
    /* Documento para onde a próxima tela deve rolar. Vive um
       desenho só e some — é um destino de viagem, não um estado. */
    destacar: ""
  };

  function rotaValida(id) {
    return ROTAS.some(function (r) { return r.id === id; }) ? id : "inicio";
  }

  function rotaDaURL() {
    var h = (location.hash || "").replace(/^#\/?/, "").split("?")[0];
    return rotaValida(h);
  }

  function navegar(id, semScroll) {
    var alvo = rotaValida(id);
    if (location.hash !== "#/" + alvo) location.hash = "#/" + alvo;
    else render();
    if (!semScroll) global.scrollTo({ top: 0, behavior: "auto" });
  }

  /* ============================================================
     Blocos visuais reutilizáveis
     ============================================================ */

  /* O anel nasce vazio (dashoffset = circunferência) e o motion.js
     solta o valor final no quadro seguinte, para que ele "desenhe". */
  /* O anel mostra CONTAGEM, não porcentagem.

     "4%" é uma nota, e nota baixa desanima logo na primeira tela —
     ainda por cima sem dizer o que fazer. "1 de 26" é a mesma
     informação lida como progresso: dá para ver quanto já andou e
     quanto falta, e cada documento enviado muda o número de um
     jeito visível. O arco continua desenhando a proporção. */
  function anelHTML(resumo) {
    var pct = resumo.pct;
    var r = 39, c = 2 * Math.PI * r;
    var off = c - (U.clamp(pct, 0, 100) / 100) * c;
    return '' +
      '<div class="ring">' +
        '<svg width="92" height="92" viewBox="0 0 92 92" aria-hidden="true">' +
          '<defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">' +
            '<stop offset="0%" stop-color="#22456c"/>' +
            '<stop offset="55%" stop-color="#c2a250"/>' +
            '<stop offset="100%" stop-color="#f2e2b8"/>' +
          '</linearGradient></defs>' +
          '<circle class="ring__track" cx="46" cy="46" r="' + r + '" fill="none" stroke-width="7.5"/>' +
          '<circle class="ring__bar" cx="46" cy="46" r="' + r + '" fill="none" stroke-width="7.5" ' +
                  'stroke-dasharray="' + c.toFixed(1) + '" ' +
                  'stroke-dashoffset="' + c.toFixed(1) + '" data-off="' + off.toFixed(1) + '"/>' +
        '</svg>' +
        '<div class="ring__value">' +
          '<span class="ring__num" data-count="' + resumo.ok + '">0</span>' +
          '<small>de ' + resumo.total + '</small>' +
        '</div>' +
        '<span class="sr-only">' + resumo.ok + ' de ' + resumo.total +
          ' documentos enviados</span>' +
      '</div>';
  }

  /* Trilha do onboarding. Cada etapa liberada é um botão que leva
     à tela dela; as ainda bloqueadas ficam inertes, com o motivo
     visível — o cliente nunca fica sem saber o que falta. */
  function trilhaHTML(opcoes) {
    var o = opcoes || {};
    var passos = Store.trilha();
    var feitas = passos.filter(function (p) { return p.situacao === "concluida"; }).length;

    var itens = passos.map(function (p, i) {
      var cls = p.situacao === "concluida" ? "rail__step--done"
              : p.situacao === "atual" ? "rail__step--current"
              : "rail__step--todo";
      var marca = p.situacao === "concluida" ? ic("ic-check") : String(i + 1);
      var interno =
        '<span class="rail__dot">' + marca + '</span>' +
        '<span class="rail__title">' + U.esc(p.titulo) +
          (p.situacao === "atual" && p.acao
            ? ' <span class="rail__acao">' + U.esc(p.acao) + '</span>' : '') + '</span>' +
        '<span class="rail__desc">' + U.esc(p.desc) + '</span>';

      if (o.clicavel && p.podeAbrir) {
        return '<button type="button" class="rail__step rail__step--link ' + cls + '" ' +
          'data-rota="' + U.escAttr(p.rota) + '">' + interno +
          '<span class="rail__chev">' + ic("ic-chevron-right") + '</span></button>';
      }
      return '<div class="rail__step ' + cls + '">' + interno +
        (p.situacao === "bloqueada"
          ? '<span class="rail__trava">Conclua a etapa anterior</span>' : '') + '</div>';
    }).join("");

    return '<section class="section"' + (o.id ? ' id="' + U.escAttr(o.id) + '"' : '') + '>' +
      '<div class="section__head"><div>' +
        '<h2 class="section__title">' + U.esc(o.titulo || "Como vai funcionar") + '</h2>' +
        '<p class="section__desc">' +
          (o.clicavel
            ? "Toque em uma etapa liberada para ir direto até ela. " + feitas + " de " +
              passos.length + " concluídas."
            : "A migração acontece em " + passos.length + " etapas.") +
        '</p>' +
      '</div>' +
      (o.tutorial ? botaoTutorial(o.tutorial, "Ver o tutorial") : '') +
      '</div>' +
      '<div class="card card--pad"><div class="rail">' + itens + '</div></div>' +
    '</section>';
  }

  var ROTULO_SITUACAO = {
    enviado:     { texto: "Enviado",           cls: "badge--enviado" },
    analise:     { texto: "Em análise",        cls: "badge--analise" },
    aprovado:    { texto: "Aprovado",          cls: "badge--aprovado" },
    pendencia:   { texto: "Precisa corrigir",  cls: "badge--pendencia" },
    substituido: { texto: "Coberto pela CNH",  cls: "badge--aprovado" },
    na:          { texto: "Não se aplica",     cls: "badge--na" },
    pendente:    { texto: "Pendente",          cls: "badge--pendente" }
  };

  function badgeSituacao(sit) {
    var m = ROTULO_SITUACAO[sit] || ROTULO_SITUACAO.pendente;
    return '<span class="badge ' + m.cls + '"><span class="dot"></span>' + m.texto + '</span>';
  }

  /* ============================================================
     Porta de entrada do cliente

     O link do convite serve uma vez, para criar a senha. Depois
     disso o cliente entra por e-mail e senha, e o link não vale
     mais para ninguém.
     ============================================================ */
  var porta = { modo: "", codigo: "", empresaNome: "", ocupado: false };

  function portaHTML() {
    var cadastro = porta.modo === "cadastro";
    return '<section class="section">' +
      '<div class="card card--pad" style="max-width:440px;margin:24px auto">' +
        /* Porta de entrada: aqui cabe a marca inteira, e é onde
           ela mais faz falta — é a primeira tela do sistema. */
        '<img src="assets/totali-portal-branca.png" alt="Totali · Portal do Cliente" ' +
          'width="660" height="235" class="marca-porta">' +
        '<div class="eyebrow">' + (cadastro ? "Bem-vindo" : "Portal do Cliente") + '</div>' +
        '<h1 class="section__title" style="font-size:21px;margin:8px 0 6px">' +
          (cadastro ? "Crie o seu acesso" : "Entrar") + '</h1>' +
        '<p class="section__desc" style="margin-bottom:20px">' +
          (cadastro
            ? (porta.empresaNome
                ? "Você foi convidado por " + U.esc(DATA.ORG.curto) + " para o portal de " +
                  "<strong>" + U.esc(porta.empresaNome) + "</strong>. Escolha uma senha — é com " +
                  "ela que você vai entrar daqui em diante."
                : "Escolha uma senha para acessar o seu portal.")
            : "Use o e-mail e a senha que você cadastrou.") +
        '</p>' +

        '<div class="field">' +
          '<label class="field__label" for="ptEmail">E-mail</label>' +
          '<input type="email" class="input" id="ptEmail" inputmode="email" ' +
            'autocomplete="' + (cadastro ? "username" : "username") + '" ' +
            'placeholder="voce@suaempresa.com.br">' +
        '</div>' +

        '<div class="field">' +
          '<label class="field__label" for="ptSenha">Senha</label>' +
          '<div class="campo-senha">' +
            '<input type="password" class="input" id="ptSenha" ' +
              'autocomplete="' + (cadastro ? "new-password" : "current-password") + '">' +
            '<button type="button" class="campo-senha__ver" data-ver-porta="1" ' +
              'aria-label="Mostrar senha">' + ic("ic-olho") + '</button>' +
          '</div>' +
          (cadastro ? '<div class="field__hint">Pelo menos 6 caracteres.</div>' : '') +
        '</div>' +

        (cadastro
          ? '<div class="field">' +
              '<label class="field__label" for="ptSenha2">Repita a senha</label>' +
              '<input type="password" class="input" id="ptSenha2" autocomplete="new-password">' +
            '</div>'
          : '') +

        '<div class="notice notice--warn" id="ptErro" hidden style="margin-bottom:14px">' +
          '<span class="notice__icon">' + ic("ic-alert") + '</span>' +
          '<span id="ptErroTxt"></span>' +
        '</div>' +

        '<button type="button" class="btn btn--primary btn--block" id="ptEnviar">' +
          (cadastro ? "Criar meu acesso" : "Entrar") + '</button>' +

        (cadastro
          ? '<p class="text-xs text-muted" style="margin-top:14px;text-align:center">' +
            'Já criou seu acesso? <a href="#" data-porta-modo="login">Entrar</a></p>'
          : '<p class="text-xs text-muted" style="margin-top:14px;text-align:center">' +
            '<a href="#" data-esqueci="1">Esqueci minha senha</a></p>') +
      '</div>' +
    '</section>' + rodape();
  }

  function erroPorta(texto) {
    var caixa = $("#ptErro");
    if (!caixa) return;
    caixa.hidden = !texto;
    if (texto) $("#ptErroTxt").textContent = texto;
  }

  function bindPorta() {
    var FB = global.FB;
    var enviar = $("#ptEnviar");
    if (!enviar) return;

    $$("[data-ver-porta]").forEach(function (b) {
      b.addEventListener("click", function () {
        var campo = b.parentNode.querySelector("input");
        campo.type = campo.type === "password" ? "text" : "password";
        b.classList.toggle("campo-senha__ver--on", campo.type === "text");
      });
    });

    $$("[data-porta-modo]").forEach(function (a) {
      a.addEventListener("click", function (ev) {
        ev.preventDefault();
        porta.modo = a.getAttribute("data-porta-modo");
        render();
      });
    });

    var esqueci = $("[data-esqueci]");
    if (esqueci) esqueci.addEventListener("click", function (ev) {
      ev.preventDefault();
      var email = ($("#ptEmail").value || "").trim();
      if (!U.validaEmail(email)) {
        erroPorta("Digite seu e-mail no campo acima para receber o link de recuperação.");
        $("#ptEmail").focus();
        return;
      }
      FB.recuperarSenha(email).then(function () {
        erroPorta("");
        UI.toast("Enviamos um link de recuperação para " + email + ".", "ok", 9000);
      }, function (e) { erroPorta(FB.explicar(e)); });
    });

    var agir = function () {
      if (porta.ocupado) return;
      var email = ($("#ptEmail").value || "").trim();
      var senha = $("#ptSenha").value || "";

      if (!U.validaEmail(email)) { erroPorta("Digite um e-mail válido."); return; }
      if (!senha) { erroPorta("Digite sua senha."); return; }

      if (porta.modo === "cadastro") {
        if (senha.length < 6) { erroPorta("A senha precisa ter pelo menos 6 caracteres."); return; }
        if (senha !== ($("#ptSenha2").value || "")) { erroPorta("As duas senhas não são iguais."); return; }
      }

      erroPorta("");
      porta.ocupado = true;
      enviar.disabled = true;
      enviar.textContent = porta.modo === "cadastro" ? "Criando…" : "Entrando…";

      var acao = porta.modo === "cadastro"
        ? FB.cadastrarCliente(porta.codigo, email, senha)
        : FB.entrarComoCliente(email, senha);

      acao.then(function () {
        porta.ocupado = false;
        /* Depois do login, quem manda é a lista de empresas do
           login — não o id que a entrada devolveu. É o que faz
           quem tem dois CNPJs cair na empresa certa. */
        return descobrirEmpresas().then(function (id) {
          return entrarNaEmpresa(id).then(function (ok) {
            if (!ok) throw new Error("empresa-nao-carregou");
          });
        });
      }).then(function () {
        porta.modo = "";
        porta.codigo = "";
        render();
        UI.toast("Tudo certo. Bem-vindo!", "ok");
      }, function (e) {
        porta.ocupado = false;
        enviar.disabled = false;
        enviar.textContent = porta.modo === "cadastro" ? "Criar meu acesso" : "Entrar";
        erroPorta(FB.explicar(e));
      });
    };

    enviar.addEventListener("click", agir);
    var ultimo = $("#ptSenha2") || $("#ptSenha");
    ultimo.addEventListener("keydown", function (ev) { if (ev.key === "Enter") agir(); });
  }

  /* ============================================================
     Uma pessoa, várias empresas

     É comum o mesmo dono ter dois ou três CNPJs. Cada um tem o
     próprio checklist, o próprio progresso e a própria conversa —
     juntar tudo numa tela só seria errado, porque a documentação
     é por empresa. Então o portal abre uma de cada vez e troca
     pelo cabeçalho.

     A escolha fica guardada por login: quem trabalha o dia todo
     num CNPJ não quer reescolher a cada visita.
     ============================================================ */
  var empresasDaConta = [];   /* [{id, nome}] */

  function chaveEscolha() {
    var FB = global.FB;
    var u = FB && FB.auth && FB.auth.currentUser;
    return u ? "totali.onboarding.empresa." + u.uid : "";
  }

  function empresaLembrada() {
    var k = chaveEscolha();
    if (!k) return "";
    try { return localStorage.getItem(k) || ""; } catch (e) { return ""; }
  }

  function lembrarEmpresa(id) {
    var k = chaveEscolha();
    if (!k) return;
    try { localStorage.setItem(k, id); } catch (e) { /* segue */ }
  }

  function esquecerEmpresa() {
    var k = chaveEscolha();
    if (!k) return;
    try { localStorage.removeItem(k); } catch (e) { /* segue */ }
  }

  /* Carrega a lista de empresas do login e devolve qual abrir. */
  function descobrirEmpresas() {
    var FB = global.FB;
    var u = FB && FB.auth && FB.auth.currentUser;
    if (!u) return Promise.resolve("");

    return FB.empresasDoCliente(u.uid).then(function (ids) {
      if (!ids.length) throw new Error("sem-empresa");

      /* Nome de cada uma, para o seletor não mostrar códigos. */
      return Promise.all(ids.map(function (id) {
        return FB.db.collection("empresas").doc(id).get().then(function (d) {
          var e = d.exists ? (d.data() || {}) : {};
          return { id: id, nome: (e.nomeFantasia || e.razaoSocial || "Empresa").trim() };
        }, function () { return { id: id, nome: "Empresa" }; });
      })).then(function (lista) {
        empresasDaConta = lista.sort(function (a, b) {
          return a.nome.localeCompare(b.nome, "pt-BR");
        });
        var lembrada = empresaLembrada();
        var vale = empresasDaConta.some(function (x) { return x.id === lembrada; });
        return vale ? lembrada : empresasDaConta[0].id;
      });
    });
  }

  function abrirSeletorEmpresas() {
    if (empresasDaConta.length < 2) return;
    var atual = Store.estado.empresaId;

    UI.modal({
      titulo: "Suas empresas",
      corpoHTML:
        '<p style="font-size:13.5px;line-height:1.65;color:var(--txt-2);margin-bottom:12px">' +
          'Cada empresa tem a própria lista de documentos e a própria conversa com a ' +
          U.esc(DATA.ORG.curto) + '.</p>' +
        '<div class="card">' + empresasDaConta.map(function (e) {
          var aqui = e.id === atual;
          return '<button type="button" class="cliente" data-trocar-empresa="' +
            U.escAttr(e.id) + '"' + (aqui ? ' disabled' : '') +
            ' style="border-bottom:1px solid var(--stroke)">' +
            '<span class="group__icon">' + ic("ic-building") + '</span>' +
            '<span class="cliente__info">' +
              '<span class="cliente__nome">' + U.esc(e.nome) + '</span>' +
              '<span class="cliente__meta">' +
                (aqui ? "Você está aqui" : "Tocar para abrir") + '</span>' +
            '</span>' +
            (aqui ? badgeSituacao("aprovado") : '<span class="cliente__chev">' +
              ic("ic-chevron-right") + '</span>') +
          '</button>';
        }).join("") + '</div>',
      acoes: [{ rotulo: "Fechar", classe: "btn--ghost" }]
    });
  }

  function trocarEmpresa(id) {
    if (!id || id === Store.estado.empresaId) { UI.fecharModal(); return; }
    UI.fecharModal();
    Store.flush();
    lembrarEmpresa(id);
    entrarNaEmpresa(id).then(function (ok) {
      if (!ok) { UI.toast("Não foi possível abrir esta empresa.", "erro"); return; }
      estadoUI.gruposAbertos = {};
      estadoUI.trilhaAberta = "";
      navegar("inicio");
      var nome = (empresasDaConta.filter(function (x) { return x.id === id; })[0] || {}).nome || "";
      UI.toast("Você está em " + nome + ".", "ok");
    }, function () {
      UI.toast("Não foi possível abrir esta empresa.", "erro");
    });
  }

  /* Entrar na empresa: daqui em diante o portal grava no servidor.

     É esta linha que faz o progresso deixar de morar no navegador.
     Tudo o que o cliente já enviou volta do servidor — de qualquer
     aparelho, em qualquer janela — e o que ele fizer agora sobe
     para lá. Se falhar, avisamos: fingir que salvou seria pior. */
  function entrarNaEmpresa(empresaId) {
    var FB = global.FB;
    if (!FB || !FB.ligado || !empresaId) return Promise.resolve(false);
    return Store.usarServidor(empresaId).then(function (ok) {
      if (ok) atualizarCabecalho();
      return ok;
    });
  }

  /* ============================================================
     Tela: Boas-vindas (primeira visita)
     ============================================================ */
  function viewBoasVindas() {
    return '' +
    '<section class="hero">' +
      '<div class="eyebrow">Seja bem-vindo</div>' +
      '<h1 class="hero__title">Sua contabilidade começa aqui</h1>' +
      '<p class="hero__desc">Este é o portal onde você envia a documentação da sua empresa, ' +
        'acompanha cada etapa da migração e aprende a usar os serviços da ' + U.esc(DATA.ORG.curto) + '. ' +
        'Leva poucos minutos para começar.</p>' +
    '</section>' +

    /* O aceite vem ANTES de tudo o que é explicação. Embaixo da
       página, ele virava um detalhe no fim de um texto longo e o
       cliente ficava parado sem saber o que fazer. Aqui é a
       primeira coisa depois da saudação, e diz em voz alta o que
       fazer. */
    '<section class="section">' +
      '<div class="card card--pad aceite">' +
        '<div class="eyebrow">Só falta isto</div>' +
        '<h2 class="aceite__titulo">Um passo para liberar seu portal</h2>' +

        '<label class="aceite__caixa" for="aceiteLgpd">' +
          '<input type="checkbox" id="aceiteLgpd" class="aceite__check">' +
          '<span class="aceite__txt">' +
            '<span class="aceite__chamada">' + ic("ic-check") +
              'Clique aqui para concordar e prosseguir</span>' +
            '<span class="aceite__lei">Li e concordo que a ' + U.esc(DATA.ORG.nome) +
              ' trate os dados e documentos que eu enviar para a prestação dos serviços ' +
              'contábeis, conforme a Lei Geral de Proteção de Dados. ' +
              '<a href="#/privacidade" data-rota="privacidade">Ler a política completa</a>.</span>' +
          '</span>' +
        '</label>' +

        '<button type="button" class="btn btn--gold btn--block aceite__btn" id="btnComecar" disabled>' +
          'Começar' + ic("ic-arrow-right") +
        '</button>' +
        '<p class="aceite__dica" id="aceiteDica">Marque a caixa acima para liberar o botão.</p>' +
      '</div>' +
    '</section>' +

    '<section class="section">' +
      '<div class="notice notice--info">' +
        '<span class="notice__icon">' + ic("ic-shield") + '</span>' +
        '<span><strong>Seus dados ficam protegidos.</strong> O que você enviar fica guardado no ' +
        'servidor da ' + U.esc(DATA.ORG.curto) + ', ligado só à sua empresa, e volta para você em ' +
        'qualquer aparelho onde entrar com sua senha. As senhas que você informar são embaralhadas ' +
        'ainda no seu aparelho: só a Totali consegue abrir.</span>' +
      '</div>' +
    '</section>' +

    trilhaHTML({ titulo: "Como vai funcionar", clicavel: false });
  }

  function bindBoasVindas() {
    var chk = $("#aceiteLgpd"), btn = $("#btnComecar");
    if (!chk || !btn) return;

    var dica = $("#aceiteDica");
    var caixa = chk.closest(".aceite__caixa");

    var refletir = function () {
      btn.disabled = !chk.checked;
      if (caixa) caixa.classList.toggle("aceite__caixa--on", chk.checked);
      if (dica) {
        dica.textContent = chk.checked
          ? "Pronto. Toque em Começar."
          : "Marque a caixa acima para liberar o botão.";
      }
    };
    chk.addEventListener("change", refletir);
    refletir();
    btn.addEventListener("click", function () {
      if (!chk.checked) return;
      Store.commit(function (st) { st.aceiteLGPD = Date.now(); }, "aceite");
      Store.registrarEvento("lgpd:aceite", "", "consentimento registrado no portal");
      Store.flush();
      UI.toast("Tudo pronto. Vamos começar pelos dados da empresa.", "ok");
      navegar("empresa");
    });
  }

  /* ============================================================
     Tela: Início
     ============================================================ */
  /* Correções pedidas pela Totali vêm primeiro: são o que trava a
     migração. Depois, os obrigatórios que ainda não chegaram. */
  function proximosPendentes(limite) {
    return global.Situacao.pendencias(Store.dadosSituacao(), DATA.GRUPOS)
      /* As correções saem daqui: elas ganharam bloco próprio, no
         alto da tela. Repetidas nos dois lugares, viravam ruído. */
      .filter(function (p) { return p.sit !== "pendencia"; })
      .slice(0, limite || 4)
      .map(function (p) {
        return {
          grupo: p.grupo, item: p.item, sit: p.sit, chave: p.chave,
          sufixo: p.socio ? (U.primeiroNome(p.socio.nome) || "sócio") : ""
        };
      });
  }

  /* O próximo passo concreto, com endereço.

     Sem isto, "Enviar documentos" larga o cliente na lista inteira
     e ele tem que descobrir sozinho onde parou — que é exatamente
     o momento em que as pessoas desistem. Correção pedida vem na
     frente, porque é o que está travando a migração. */
  /* O próximo documento a cobrar da pessoa.

     Pula o que ela mesma marcou para depois, enquanto o dia não
     chega: insistir num item que a pessoa acabou de adiar é
     ignorar o que ela disse, e o "Continuar de onde parei"
     passaria a apontar sempre para a mesma parede. Vencido o
     prazo, o item volta para a fila normalmente. Se TODOS os
     pendentes estiverem adiados, mostramos o primeiro mesmo
     assim — melhor que uma tela sem próximo passo. */
  function proximoPasso() {
    var l = global.Situacao.pendencias(Store.dadosSituacao(), DATA.GRUPOS);
    if (!l.length) return null;
    var agora = Date.now();
    var livre = l.filter(function (p) {
      var ms = (Store.estado.itens[p.chave] || {}).lembrete || 0;
      return !ms || ms <= agora;
    });
    return livre.length ? livre[0] : l[0];
  }

  /* Documentos que a equipe devolveu, já com o motivo que ela
     escreveu. O motivo é a parte útil: "voltou" sem "por quê" só
     gera uma mensagem perguntando o porquê. */
  function correcoesPedidas() {
    return global.Situacao.pendencias(Store.dadosSituacao(), DATA.GRUPOS)
      .filter(function (p) { return p.sit === "pendencia"; })
      .map(function (p) {
        var rev = (Store.estado.itens[p.chave] || {}).revisao || {};
        p.motivo = rev.motivo || "";
        p.em = rev.em || 0;
        return p;
      });
  }

  function nomeComSocio(p) {
    return U.esc(p.item.nome) +
      (p.socio ? ' <span class="text-xs text-muted">· ' +
        U.esc(U.primeiroNome(p.socio.nome) || "sócio") + '</span>' : '');
  }

  /* O botão principal da tela inicial.

     Ele leva ao documento exato, não à lista. E diz qual é, logo
     abaixo: prometer "continuar" sem mostrar o quê obriga a pessoa
     a clicar para descobrir se vale o esforço. */
  function acoesDoHero(passo) {
    var principal = passo
      ? '<button type="button" class="btn btn--gold" data-rota="documentos" data-grupo="' +
          U.escAttr(passo.grupo.id) + '" data-alvo="' + U.escAttr(passo.chave) + '">' +
          ic("ic-chevron-right") + 'Continuar de onde parei</button>'
      : '<button type="button" class="btn btn--gold" data-rota="documentos">' +
          ic("ic-upload") + 'Enviar documentos</button>';

    return '<div class="hero__actions">' + principal +
        '<button type="button" class="btn btn--ghost" data-rota="ajuda">' +
          ic("ic-help") + 'Preciso de ajuda</button>' +
      '</div>' +
      (passo
        ? '<p class="hero__proximo">Próximo: <strong>' + U.esc(passo.item.nome) + '</strong>' +
          (passo.socio ? ' — ' + U.esc(U.primeiroNome(passo.socio.nome) || "sócio") : '') +
          (passo.sit === "pendencia" ? ' <span class="hero__proximo-tag">para corrigir</span>' : '') +
          '</p>'
        : '');
  }

  function viewInicio() {
    var st = Store.estado;
    var resumo = Store.resumoGeral();
    var etapaId = Store.etapaAtual();
    var idxEtapa = DATA.ETAPAS.findIndex(function (e) { return e.id === etapaId; });
    var nome = U.primeiroNome(st.empresa.responsavelNome);
    var empresaNome = st.empresa.nomeFantasia || st.empresa.razaoSocial;
    var passo = proximoPasso();

    var html = '' +
    '<section class="hero">' +
      '<div class="hero__greeting">' + U.esc(U.saudacao()) + (nome ? ", " + U.esc(nome) : "") + '</div>' +
      '<h1 class="hero__title">' + (empresaNome ? U.esc(empresaNome) : "Vamos organizar sua migração") + '</h1>' +
      '<p class="hero__desc">' +
        (resumo.total === 0
          ? "Comece cadastrando os dados da empresa. Em seguida a lista de documentos aparece aqui."
          : resumo.pendentes === 0
            ? "Documentação completa. Nossa equipe já pode conferir tudo."
            : "Faltam " + resumo.pendentes + " " + U.plural(resumo.pendentes, "documento", "documentos") +
              " para concluirmos sua migração. Você pode enviar aos poucos.") +
      '</p>' +
      '<div class="hero__row" id="blocoResumo">' +
        anelHTML(resumo) +
        '<div class="hero__stats">' +
          '<div><div class="stat__num" data-count="' + resumo.ok + '">0</div>' +
            '<div class="stat__lbl">Já enviados</div></div>' +
          '<div><div class="stat__num" data-count="' + resumo.pendentes + '">0</div>' +
            '<div class="stat__lbl">Ainda faltam</div></div>' +
          '<div><div class="stat__num" data-count="' + resumo.pendentesObrigatorios + '">0</div>' +
            '<div class="stat__lbl">Obrigatórios a enviar</div></div>' +
        '</div>' +
      '</div>' +
      acoesDoHero(passo) +
    '</section>';

    /* ---- Devoluções da equipe ----

       Vem antes de tudo, inclusive do vídeo: é a única coisa da
       tela em que o cliente já fez a parte dele e mesmo assim
       precisa agir de novo. Antes ficava só no meio da lista de
       "próximos passos", sem o motivo, e o cliente descobria que
       algo tinha voltado só se abrisse o documento certo. */
    var correcoes = correcoesPedidas();
    if (correcoes.length) {
      html +=
      '<section class="section" id="blocoCorrecoes">' +
        '<div class="card card--atencao">' +
          '<div class="atencao__cab">' +
            '<span class="atencao__icone">' + ic("ic-alert") + '</span>' +
            '<span class="atencao__txt">' +
              '<span class="atencao__titulo">' +
                (correcoes.length === 1
                  ? "Um documento voltou para você"
                  : correcoes.length + " documentos voltaram para você") + '</span>' +
              '<span class="atencao__desc">Nossa equipe conferiu e precisa que você envie de ' +
                'novo. É o que está segurando a sua migração.</span>' +
            '</span>' +
          '</div>' +
          correcoes.map(function (p) {
            return '<button type="button" class="corr" data-rota="documentos" data-grupo="' +
                U.escAttr(p.grupo.id) + '" data-alvo="' + U.escAttr(p.chave) + '">' +
              '<span class="corr__info">' +
                '<span class="corr__nome">' + nomeComSocio(p) + '</span>' +
                '<span class="corr__motivo">' +
                  (p.motivo
                    ? U.esc(p.motivo)
                    : "A equipe não escreveu o motivo. Se ficar em dúvida, pergunte pelas Mensagens.") +
                '</span>' +
              '</span>' +
              '<span class="corr__acao">Reenviar' + ic("ic-chevron-right") + '</span>' +
            '</button>';
          }).join("") +
        '</div>' +
      '</section>';
    }

    /* ---- O que o próprio cliente marcou para hoje ----

       Fica logo abaixo das devoluções porque é um compromisso
       que ele assumiu, não uma cobrança da Totali. O tom muda por
       isso: lembra, não pressiona, e o botão de remarcar está ali
       do lado para quem não conseguiu. */
    var vencidos = lembretesVencidos();
    if (vencidos.length) {
      html +=
      '<section class="section" id="blocoLembretes">' +
        '<div class="card card--pad">' +
          '<div class="atencao__cab" style="margin-bottom:12px">' +
            '<span class="atencao__icone">' + ic("ic-clock") + '</span>' +
            '<span class="atencao__txt">' +
              '<span class="atencao__titulo">' +
                (vencidos.length === 1
                  ? "Você marcou este documento para hoje"
                  : "Você marcou " + vencidos.length + " documentos para hoje") + '</span>' +
              '<span class="atencao__desc">Foi o dia que você mesmo escolheu. Se ainda não ' +
                'conseguiu, é só marcar outro — sem problema nenhum.</span>' +
            '</span>' +
          '</div>' +
          vencidos.map(function (p) {
            return '<button type="button" class="group__head group__head--selo" ' +
                'data-rota="documentos" data-grupo="' + U.escAttr(p.grupo.id) + '" ' +
                'data-alvo="' + U.escAttr(p.chave) + '" ' +
                'style="border-bottom:1px solid var(--stroke)">' +
              '<span class="group__icon">' + ic(p.grupo.icone) + '</span>' +
              '<span class="group__info">' +
                '<span class="group__title" style="display:block;font-size:14px">' +
                  nomeComSocio(p) + '</span>' +
                '<span class="group__meta">' + U.esc(p.grupo.titulo) + '</span>' +
              '</span>' +
              '<span class="group__chev">' + ic("ic-chevron-right") + '</span>' +
            '</button>';
          }).join("") +
        '</div>' +
      '</section>';
    }

    var passos = Store.trilha();
    var enviouTudo = passos.filter(function (p) {
      return (p.id === "documentos" || p.id === "financeiro") && p.situacao === "concluida";
    }).length === 2;

    /* Vídeo de apresentação do portal. Enquanto não houver vídeo
       publicado, o espaço só é ocupado durante o onboarding — depois
       dele, não faz sentido manter um "em breve" na tela inicial. */
    var vi = DATA.VIDEO_INICIO;
    if (vi && (idYoutubeValido(vi.youtube) || !enviouTudo)) {
      html += '<section class="section" id="blocoVideo">' +
        '<div class="card">' +
          videoHTML(vi.youtube, vi.titulo, "video--largo") +
          '<div style="padding:15px 17px 17px">' +
            '<div class="tile__kicker">Comece por aqui</div>' +
            '<h2 class="tile__title" style="font-size:16px">' + U.esc(vi.titulo) + '</h2>' +
            '<p class="tile__desc">' + U.esc(vi.desc) + '</p>' +
            (vi.duracao ? '<div class="tile__foot"><span class="text-xs text-muted">' +
              U.esc(vi.duracao) + '</span></div>' : '') +
          '</div>' +
        '</div>' +
      '</section>';
    }

    /* Envio concluído: a Academy sobe para o topo da tela. */
    if (enviouTudo) html += academyDestaqueHTML();

    /* Próximos passos */
    var pendentes = proximosPendentes(4);
    if (pendentes.length) {
      html +=
      '<section class="section" id="blocoPendentes">' +
        '<div class="section__head"><div>' +
          '<h2 class="section__title">Próximos passos</h2>' +
          '<p class="section__desc">Comece por aqui. São os documentos que mais travam a ' +
            'migração — toque em um para ir direto a ele.</p>' +
        '</div></div>' +
        '<div class="card">' +
          pendentes.map(function (p) {
            return '<button type="button" class="group__head group__head--selo" ' +
                     'data-rota="documentos" data-grupo="' + U.escAttr(p.grupo.id) + '" ' +
                     'data-alvo="' + U.escAttr(p.chave) + '" ' +
                     'style="border-bottom:1px solid var(--stroke)">' +
              '<span class="group__icon">' + ic(p.grupo.icone) + '</span>' +
              '<span class="group__info">' +
                '<span class="group__title" style="display:block;font-size:14px">' + U.esc(p.item.nome) +
                  (p.sufixo ? ' <span class="text-xs text-muted">· ' + U.esc(p.sufixo) + '</span>' : '') + '</span>' +
                '<span class="group__meta">' + U.esc(p.item.resumo || "") + '</span>' +
              '</span>' +
              '<span class="group__chev">' + ic("ic-chevron-right") + '</span>' +
            '</button>';
          }).join("") +
        '</div>' +
      '</section>';
    }

    /* Atalhos — no celular, "Empresa" não cabe na barra inferior. */
    var cadastroIncompleto = !st.empresa.razaoSocial || !st.empresa.cnpj || !st.empresa.responsavelNome;
    var naoLidas = Store.naoLidas("cliente");
    html +=
    '<section class="section">' +
      '<div class="card">' +
        '<button type="button" class="group__head group__head--selo" data-rota="empresa" ' +
          'style="border-bottom:1px solid var(--stroke)">' +
          '<span class="group__icon">' + ic("ic-building") + '</span>' +
          '<span class="group__info">' +
            '<span class="group__title" style="font-size:14px">Dados da empresa</span>' +
            '<span class="group__meta">' +
              (cadastroIncompleto ? "Faltam informações do cadastro" : "Cadastro, sócios e responsável") +
            '</span>' +
          '</span>' +
          (cadastroIncompleto
            ? '<span class="badge badge--analise"><span class="dot"></span>Completar</span>' : '') +
          '<span class="group__chev">' + ic("ic-chevron-right") + '</span>' +
        '</button>' +
        '<button type="button" class="group__head group__head--selo" data-rota="mensagens">' +
          '<span class="group__icon">' + ic("ic-chat") + '</span>' +
          '<span class="group__info">' +
            '<span class="group__title" style="font-size:14px">Mensagens</span>' +
            '<span class="group__meta">Fale com quem cuida da sua empresa</span>' +
          '</span>' +
          (naoLidas
            ? '<span class="badge badge--pendencia"><span class="dot"></span>' + naoLidas + ' ' +
              U.plural(naoLidas, "nova", "novas") + '</span>' : '') +
          '<span class="group__chev">' + ic("ic-chevron-right") + '</span>' +
        '</button>' +
      '</div>' +
    '</section>';

    /* Trilha das etapas — cada uma leva à sua tela. */
    html += trilhaHTML({
      titulo: "Onde você está", clicavel: true,
      id: "blocoTrilha", tutorial: "inicio"
    });

    /* Academy — discreta durante o envio, protagonista depois dele. */
    html +=
    '<section class="section">' +
      '<div class="section__head"><div>' +
        '<h2 class="section__title">Totali Academy</h2>' +
        '<p class="section__desc">Vídeos curtos que ensinam a rotina da sua empresa com a gente.</p>' +
      '</div>' +
      '<button type="button" class="btn btn--ghost btn--sm" data-rota="academy">Ver trilhas</button></div>' +
      '<div class="tiles">' + DATA.ACADEMY.slice(0, 2).map(tileAcademy).join("") + '</div>' +
    '</section>';

    return html + rodape();
  }

  /* Quando o envio termina, a Academy deixa de ser rodapé e vira o
     motivo de o cliente voltar ao portal. */
  function academyDestaqueHTML() {
    return '<section class="section">' +
      '<div class="hero" style="padding-bottom:22px">' +
        '<div class="eyebrow">Totali Academy</div>' +
        '<h2 class="hero__title" style="font-size:22px">Agora é a sua vez de dominar a rotina</h2>' +
        '<p class="hero__desc">Documentação entregue. Daqui em diante o portal vira o seu ponto de ' +
          'apoio: trilhas curtas sobre notas fiscais, impostos, folha e o que enviar todo mês.</p>' +
        '<div class="hero__actions">' +
          '<button type="button" class="btn btn--gold" data-rota="academy">' +
            ic("ic-play") + 'Começar pela primeira trilha</button>' +
        '</div>' +
      '</div>' +
      '<div class="tiles" style="margin-top:14px">' +
        DATA.ACADEMY.slice(0, 3).map(tileAcademy).join("") +
      '</div>' +
    '</section>';
  }

  /* ============================================================
     Tela: Documentos
     ============================================================ */
  function itemHTML(grupo, item, socio) {
    var socioId = socio ? socio.id : null;
    var chave = Store.chaveItem(grupo.id, item.id, socioId);
    var reg = Store.estado.itens[chave] || { arquivos: [], valor: "", na: false, forma: "" };
    var sit = Store.situacao(grupo, item, socioId);
    var pronto = Store.resolvida(sit);
    var grupoNA = !!Store.estado.gruposNA[grupo.id];

    /* A Totali já disse se este documento se aplica a esta
       empresa. Quando disse, o cliente não decide mais — some o
       botão de "não se aplica" e entra um aviso no lugar.

       É a diferença entre esconder e explicar: sem o aviso, o
       cliente que tivesse marcado antes veria a marca dele mudar
       sozinha e não entenderia por quê. */
    var travado = typeof reg.naEquipe === "boolean";
    var botaoNA = travado
      ? ''
      : '<button type="button" class="btn btn--quiet btn--sm" data-na="1">Não se aplica</button>';

    var html = '<div class="item ' + (pronto ? "item--done " : "") +
               (sit === "na" ? "item--na " : "") + (sit === "pendencia" ? "item--pendencia" : "") +
               '" data-chave="' + U.escAttr(chave) + '">' +
      '<div class="item__top">' +
        '<span class="item__mark" aria-hidden="true">' + ic("ic-check") + '</span>' +
        '<div class="item__main">' +
          '<div class="item__name">' + U.esc(item.nome) +
            (item.obrigatorio ? '' : ' <span class="opt">opcional</span>') + '</div>' +
          '<div class="item__row">' + badgeSituacao(sit) +
            '<button type="button" class="help-btn" data-ajuda="' + U.escAttr(grupo.id + "|" + item.id) + '">' +
              ic("ic-info") + 'Entenda este documento</button>' +
          '</div>' +
          (item.resumo ? '<div class="item__desc">' + U.esc(item.resumo) + '</div>' : '');

    /* Recado da equipe quando o documento voltou para correção. */
    if (sit === "pendencia") {
      html += '<div class="notice notice--warn" style="margin-top:10px;padding:11px 13px;font-size:12.5px">' +
          '<span class="notice__icon">' + ic("ic-alert") + '</span>' +
          '<span><strong>A Totali pediu uma correção.</strong>' +
          (reg.revisao && reg.revisao.motivo ? ' ' + U.esc(reg.revisao.motivo) : '') +
          (reg.revisao && reg.revisao.em
            ? ' <span class="text-xs" style="opacity:.75">— ' + U.esc(U.dataCurta(reg.revisao.em)) + '</span>'
            : '') +
          '</span></div>';
    }
    if (sit === "aprovado" && reg.revisao && reg.revisao.em) {
      html += '<div class="item__desc" style="color:var(--ok)">Conferido pela Totali em ' +
              U.esc(U.dataCurta(reg.revisao.em)) + '.</div>';
    }

    /* A Totali definiu. Vale tanto para tirar da lista quanto
       para devolver: "não precisa" e "precisa sim" são as duas
       respostas que o cliente não tem como saber sozinho. */
    if (travado && !grupoNA) {
      html += reg.naEquipe
        ? '<div class="notice notice--ok" style="margin-top:10px;padding:10px 12px;font-size:12.5px">' +
            '<span class="notice__icon">' + ic("ic-check-circle") + '</span>' +
            '<span><strong>A ' + U.esc(DATA.ORG.curto) + ' verificou: este documento não se ' +
            'aplica à sua empresa.</strong> Você não precisa enviar nada aqui.</span></div>'
        : '<div class="notice notice--info" style="margin-top:10px;padding:10px 12px;font-size:12.5px">' +
            '<span class="notice__icon">' + ic("ic-info") + '</span>' +
            '<span>A ' + U.esc(DATA.ORG.curto) + ' confirmou que este documento é necessário ' +
            'para a sua empresa. Se você acha que não se aplica, fale pelas Mensagens.</span></div>';
    }

    if (grupoNA) {
      html += '<div class="item__desc">Este grupo foi marcado como não aplicável.</div>';
    } else if (sit === "substituido") {
      html += '<div class="notice notice--ok" style="margin-top:10px;padding:9px 11px;font-size:12.5px">' +
                '<span class="notice__icon">' + ic("ic-check-circle") + '</span>' +
                '<span>A CNH enviada já cobre este documento.</span></div>';
    } else {

      /* ---- tipo ARQUIVO ---- */
      if (item.kind === "arquivo") {
        if (reg.arquivos.length) {
          html += '<div class="files">' + reg.arquivos.map(function (a) {
            var ext = U.extensao(a.nome);
            return '<div class="file">' +
              '<span class="file__icon">' + ic(U.iconePorExtensao(ext)) + '</span>' +
              '<span class="file__info">' +
                '<span class="file__name">' + U.esc(a.nome) + '</span>' +
                '<span class="file__meta">' + U.esc(U.bytes(a.tamanho)) + ' · enviado em ' +
                  U.esc(U.dataCurta(a.em)) + '</span>' +
              '</span>' +
              '<button type="button" class="file__del" data-baixar="' + U.escAttr(a.id) +
                '" aria-label="Abrir arquivo">' + ic("ic-download") + '</button>' +
              '<button type="button" class="file__del" data-remover="' + U.escAttr(a.id) +
                '" aria-label="Remover arquivo">' + ic("ic-trash") + '</button>' +
            '</div>';
          }).join("") + '</div>';
        }
        html += '<div class="item__actions">' +
          (temCamera()
            ? '<button type="button" class="btn btn--ghost btn--sm" data-foto="1">' +
              ic("ic-camera") + 'Tirar foto</button>'
            : '') +
          '<button type="button" class="btn btn--ghost btn--sm" data-enviar="1">' +
            ic("ic-upload") + (reg.arquivos.length ? "Adicionar outro" : "Enviar arquivo") + '</button>' +
          (!reg.arquivos.length ? botaoNA : '') +
        '</div>';
      }

      /* ---- tipo DADO ---- */
      if (item.kind === "dado") {
        if (item.formato === "selecao") {
          html += '<div style="margin-top:10px"><select class="select" data-dado="1" ' +
            'aria-label="' + U.escAttr(item.nome) + '">' +
            '<option value="">Selecione…</option>' +
            item.opcoes.map(function (o) {
              return '<option value="' + U.escAttr(o) + '"' +
                     (reg.valor === o ? ' selected' : '') + '>' + U.esc(o) + '</option>';
            }).join("") + '</select></div>';
        } else {
          html += '<div style="margin-top:10px"><input type="text" class="input" data-dado="1" ' +
            'inputmode="numeric" autocomplete="off" spellcheck="false" ' +
            'maxlength="' + (item.maxlen || 60) + '" ' +
            'placeholder="' + U.escAttr(item.placeholder || "") + '" ' +
            'aria-label="' + U.escAttr(item.nome) + '" ' +
            'value="' + U.escAttr(reg.valor || "") + '"></div>';
        }
        if (!item.obrigatorio) {
          html += '<div class="item__actions">' + botaoNA + '</div>';
        }
      }

      /* ---- tipo ACESSO ---- */
      if (item.kind === "acesso") {
        var FORMAS = [
          { id: "informar",   rot: "Informar o acesso agora" },
          { id: "procuracao", rot: "Vou conceder procuração eletrônica" },
          { id: "entregue",   rot: "Já está com a Totali" }
        ];
        html += '<div class="notice notice--info" style="margin-top:10px;padding:10px 12px;font-size:12.5px">' +
            '<span class="notice__icon">' + ic("ic-lock") + '</span>' +
            '<span><strong>Pode informar com tranquilidade.</strong> A senha é embaralhada aqui ' +
            'no seu aparelho antes de sair. Nem no seu celular, nem no nosso banco de dados ela ' +
            'fica legível — só a Totali consegue abrir.</span>' +
          '</div>' +
          '<div class="item__actions">' +
            FORMAS.map(function (f) {
              var ativo = reg.forma === f.id;
              return '<button type="button" class="btn btn--sm ' +
                (ativo ? "btn--primary" : "btn--ghost") + '" data-forma="' + U.escAttr(f.id) + '">' +
                (ativo ? ic("ic-check") : "") + U.esc(f.rot) + '</button>';
            }).join("") +
            botaoNA +
          '</div>';

        if (reg.forma === "informar" && item.credenciais) {
          html += credenciaisHTML(chave, item.credenciais, { titulo: "Dados de acesso" });
        }
      }
    }

    if (sit === "na" && !grupoNA && !travado) {
      html += '<div class="item__actions">' +
        '<button type="button" class="btn btn--quiet btn--sm" data-reativar="1">Reativar este item</button></div>';
    }

    /* ---- "Enviar depois" ----
       Só faz sentido no que ainda falta. Em documento resolvido,
       marcado como não aplicável ou coberto pela CNH, seria um
       botão que não leva a lugar nenhum. */
    if (!pronto && !grupoNA && sit !== "na" && sit !== "substituido") {
      html += lembreteHTML(chave, reg.lembrete || 0);
    }

    html += '</div></div></div>';
    return html;
  }

  /* ============================================================
     "Enviar depois"

     Três opções fechadas em vez de um calendário: escolher uma
     data no celular é trabalhoso, e o que a pessoa quer dizer
     quase sempre é "não é agora". Datas soltas também virariam
     lembretes espalhados por meses.

     A data cai sempre às 9h — hora de expediente, não a hora em
     que a pessoa por acaso clicou.
     ============================================================ */
  var PRAZOS = [
    { id: "amanha",  rot: "Amanhã",           dias: 1 },
    { id: "3dias",   rot: "Em 3 dias",        dias: 3 },
    { id: "semana",  rot: "Na próxima semana", dias: 7 }
  ];

  function daquiADias(dias) {
    var d = new Date();
    d.setDate(d.getDate() + dias);
    d.setHours(9, 0, 0, 0);
    return d.getTime();
  }

  function lembreteVencido(ms) { return ms > 0 && ms <= Date.now(); }

  function lembreteHTML(chave, ms) {
    if (ms > 0) {
      var venceu = lembreteVencido(ms);
      return '<div class="notice ' + (venceu ? "notice--warn" : "notice--info") +
          '" style="margin-top:10px;padding:10px 12px;font-size:12.5px">' +
          '<span class="notice__icon">' + ic("ic-clock") + '</span>' +
          '<span>' +
            (venceu
              ? '<strong>Você tinha marcado este documento para ' + U.esc(U.dataCurta(ms)) +
                '.</strong> Chegou o dia — se ainda não conseguiu, é só remarcar.'
              : '<strong>Combinado: você volta neste documento em ' +
                U.esc(U.dataCurta(ms)) + '.</strong> Vamos te lembrar no dia.') +
            '<span class="lembrete__acoes">' +
              '<button type="button" class="btn btn--quiet btn--sm" data-lembrar="abrir">' +
                'Mudar a data</button>' +
              '<button type="button" class="btn btn--quiet btn--sm" data-lembrar="limpar">' +
                'Cancelar</button>' +
            '</span>' +
          '</span></div>';
    }
    return '<div class="item__actions">' +
      '<button type="button" class="btn btn--quiet btn--sm" data-lembrar="abrir">' +
        ic("ic-clock") + 'Enviar depois</button>' +
    '</div>';
  }

  function pedirLembrete(chave, nomeItem) {
    var atual = Store.lembreteDe(chave);
    UI.modal({
      titulo: "Quando você volta neste documento?",
      corpoHTML:
        '<p style="font-size:13.5px;line-height:1.6;color:var(--txt-2);margin-bottom:14px">' +
          'Sem problema não ter agora. Escolha um dia e a gente te lembra — ' +
          U.esc(nomeItem || "este documento") + ' continua na lista até chegar.</p>' +
        '<div class="prazos">' +
          PRAZOS.map(function (p) {
            return '<button type="button" class="btn btn--ghost prazo" data-prazo="' +
              U.escAttr(p.id) + '" data-prazo-chave="' + U.escAttr(chave) + '">' +
              '<span class="prazo__rot">' + U.esc(p.rot) + '</span>' +
              '<span class="prazo__dia">' + U.esc(U.dataCurta(daquiADias(p.dias))) + '</span>' +
            '</button>';
          }).join("") +
        '</div>',
      acoes: (atual
        ? [{
            rotulo: "Cancelar o lembrete", classe: "btn--quiet",
            onClick: function () { limparLembrete(chave); }
          }]
        : []
      ).concat([{ rotulo: "Fechar", classe: "btn--ghost" }])
    });
  }

  /* Os botões de prazo vivem dentro do modal e são tratados pelo
     ouvinte geral de cliques, no fim deste arquivo — mesmo
     caminho do seletor de empresas. */
  function escolherPrazo(chave, prazoId) {
    var escolha = PRAZOS.filter(function (p) { return p.id === prazoId; })[0];
    if (!escolha) return;
    var quando = daquiADias(escolha.dias);
    Store.marcarLembrete(chave, quando);
    UI.fecharModal();
    UI.toast("Combinado. Te lembramos em " + U.dataCurta(quando) + ".", "ok", 4000);
    render();
  }

  function limparLembrete(chave) {
    Store.marcarLembrete(chave, 0);
    UI.toast("Lembrete cancelado.", "ok", 3000);
    render();
  }

  /* Documentos cujo dia combinado já chegou. */
  function lembretesVencidos() {
    var agora = Date.now();
    return global.Situacao.pendencias(Store.dadosSituacao(), DATA.GRUPOS)
      .filter(function (p) {
        var ms = (Store.estado.itens[p.chave] || {}).lembrete || 0;
        return ms > 0 && ms <= agora;
      });
  }

  /* Avisa uma vez por dia, não a cada abertura do portal.

     O aviso vale enquanto o documento não chega, e quem abre o
     portal cinco vezes num dia não precisa de cinco notificações.
     A marca do último aviso fica só neste aparelho: é preferência
     de aparelho, não dado do cliente, e não tem por que ocupar
     espaço no servidor. */
  var CHAVE_AVISO = "totali:lembrete:ultimoAviso";

  function conferirLembretes() {
    var vencidos = lembretesVencidos();
    if (!vencidos.length) return;

    var N = global.Notif;
    if (!N || !N.ativo) return;

    var hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    var marca = String(hoje.getTime());
    try {
      if (localStorage.getItem(CHAVE_AVISO) === marca) return;
      localStorage.setItem(CHAVE_AVISO, marca);
    } catch (e) { /* sem armazenamento: avisa e segue */ }

    N.lembreteDoCliente(vencidos[0].item.nome, vencidos.length, estadoUI.rota);
  }

  function grupoHTML(grupo) {
    var resumo = Store.resumoGrupo(grupo);
    var aberto = !!estadoUI.gruposAbertos[grupo.id];
    var grupoNA = !!Store.estado.gruposNA[grupo.id];
    var socios = Store.estado.socios;

    var meta;
    if (grupoNA) meta = "Marcado como não aplicável";
    else if (grupo.escopo === "socio" && !socios.length) meta = "Cadastre os sócios para liberar esta lista";
    else meta = resumo.ok + " de " + resumo.total + " " + U.plural(resumo.total, "documento", "documentos");

    /* Grupo já resolvido recua um pouco: o olho vai direto para o
       que ainda falta, em vez de varrer tudo com o mesmo peso. */
    var pronto = (resumo.completo && !resumo.vazio) || grupoNA;

    var html = '<section class="card group' + (pronto ? " group--pronto" : "") +
               '" data-open="' + (aberto ? "true" : "false") +
               '" data-grupo="' + U.escAttr(grupo.id) + '">' +
      '<button type="button" class="group__head" data-toggle="1" aria-expanded="' + (aberto ? "true" : "false") + '">' +
        '<span class="group__icon">' + ic(grupo.icone) + '</span>' +
        '<span class="group__info">' +
          '<span class="group__title">' + U.esc(grupo.titulo) + '</span>' +
          '<span class="group__meta">' + U.esc(meta) + '</span>' +
        '</span>' +
        (resumo.completo && !grupoNA ? '<span class="badge badge--aprovado"><span class="dot"></span>Completo</span>' : '') +
        '<span class="group__chev">' + ic("ic-chevron-down") + '</span>' +
      '</button>';

    if (!grupoNA && !resumo.vazio) {
      html += '<div class="group__progress"><div class="pbar"><div class="pbar__fill" style="width:' +
              resumo.pct + '%"></div></div></div>';
    }

    if (aberto) {
      html += '<div class="group__body">';
      html += '<div style="padding:15px 16px;border-bottom:1px solid var(--stroke)">' +
                '<p class="text-sm text-muted" style="line-height:1.55">' + U.esc(grupo.desc) + '</p>';
      if (grupo.permiteGrupoNA) {
        html += '<label class="row" style="margin-top:11px;cursor:pointer;gap:9px">' +
          '<input type="checkbox" data-grupona="1" ' + (grupoNA ? "checked" : "") +
          ' style="width:18px;height:18px">' +
          '<span class="text-sm" style="color:var(--txt-2)">' + U.esc(grupo.textoGrupoNA) + '</span></label>';
      }
      html += '</div>';

      if (grupoNA) {
        html += '<div class="empty"><div class="empty__icon">' + ic("ic-check-circle") + '</div>' +
                '<div class="empty__title">Nada a enviar neste grupo</div>' +
                '<div class="empty__desc">Desmarque a opção acima se a situação mudar.</div></div>';
      } else if (grupo.escopo === "socio") {
        if (!socios.length) {
          html += '<div class="empty">' +
            '<div class="empty__icon">' + ic("ic-users") + '</div>' +
            '<div class="empty__title">Nenhum sócio cadastrado</div>' +
            '<div class="empty__desc">Cadastre os sócios da empresa para que cada um receba a própria lista de documentos.</div>' +
            '<button type="button" class="btn btn--primary btn--sm" style="margin-top:14px" data-rota="empresa">' +
              ic("ic-plus") + 'Cadastrar sócios</button></div>';
        } else {
          socios.forEach(function (s) {
            var r = { total: 0, ok: 0 };
            grupo.itens.forEach(function (it) {
              var sit = Store.situacao(grupo, it, s.id);
              if (sit === "na") return;
              r.total++;
              if (Store.resolvida(sit)) r.ok++;
            });
            html += '<div style="padding:13px 16px;background:rgba(194,162,80,.06);' +
              'border-top:1px solid var(--stroke);border-bottom:1px solid var(--stroke)">' +
              '<div class="row" style="justify-content:space-between">' +
                '<div><div style="font-size:13.5px;font-weight:680;color:var(--gold-2)">' +
                  U.esc(s.nome || "Sócio sem nome") + '</div>' +
                  (s.cpf ? '<div class="text-xs text-muted">CPF ' + U.esc(s.cpf) + '</div>' : '') +
                '</div>' +
                '<span class="badge ' + (r.total && r.ok === r.total ? "badge--aprovado" : "badge--pendente") + '">' +
                  r.ok + '/' + r.total + '</span>' +
              '</div></div>';
            grupo.itens.forEach(function (it) { html += itemHTML(grupo, it, s); });
          });
        }
      } else {
        grupo.itens.forEach(function (it) { html += itemHTML(grupo, it, null); });
      }
      html += '</div>';
    }
    html += '</section>';
    return html;
  }

  function viewDocumentos() {
    var resumo = Store.resumoGeral();
    var usado = Store.bytesUsados();

    var html = '' +
    '<section class="section">' +
      '<div class="section__head"><div>' +
        '<div class="eyebrow">Etapa 3</div>' +
        '<h1 class="section__title" style="font-size:20px;margin-top:4px">Envio de documentos</h1>' +
        '<p class="section__desc">Toque em um grupo para abrir a lista. Cada item explica o que é, ' +
          'onde conseguir e como enviar.</p>' +
      '</div></div>' +
      '<div class="card card--pad" style="margin-bottom:16px">' +
        '<div class="row" style="justify-content:space-between;margin-bottom:9px">' +
          '<span class="text-sm" style="font-weight:600">Progresso geral</span>' +
          '<span class="text-sm text-muted">' + resumo.ok + ' de ' + resumo.total + '</span>' +
        '</div>' +
        '<div class="pbar"><div class="pbar__fill" style="width:' + resumo.pct + '%"></div></div>' +
        (usado ? '<div class="text-xs text-muted" style="margin-top:9px">' +
          U.esc(U.bytes(usado)) + ' enviados até agora</div>' : '') +
      '</div>' +
    '</section>';

    html += DATA.GRUPOS.map(grupoHTML).join("");

    html +=
    '<section class="section">' +
      '<div class="notice notice--info">' +
        '<span class="notice__icon">' + ic("ic-info") + '</span>' +
        '<span>Não encontrou algum documento com o contador anterior? ' +
        '<a href="#/ajuda" data-rota="ajuda">Fale com a gente</a> — a maioria pode ser obtida ' +
        'direto nos portais oficiais e nós ajudamos nesse caminho.</span>' +
      '</div>' +
    '</section>';

    return html + rodape();
  }

  /* ---------- Modal de ajuda de um item ---------- */
  function abrirAjudaItem(grupoId, itemId) {
    var grupo = DATA.GRUPOS.filter(function (g) { return g.id === grupoId; })[0];
    if (!grupo) return;
    var item = grupo.itens.filter(function (i) { return i.id === itemId; })[0];
    if (!item || !item.ajuda) return;
    var a = item.ajuda;

    var corpo = '';
    if (a.oque) {
      corpo += '<div class="help-block"><div class="help-block__t">O que é</div>' +
               '<div class="help-block__c">' + U.esc(a.oque) + '</div></div>';
    }
    if (a.onde && a.onde.length) {
      corpo += '<div class="help-block"><div class="help-block__t">Onde conseguir</div>' +
               '<ul class="help-list">' + a.onde.map(function (o) {
                 return '<li>' + U.esc(o) + '</li>';
               }).join("") + '</ul></div>';
    }
    if (a.dica) {
      corpo += '<div class="help-block"><div class="notice notice--warn">' +
               '<span class="notice__icon">' + ic("ic-info") + '</span>' +
               '<span>' + U.esc(a.dica) + '</span></div></div>';
    }
    /* Passo a passo para o cliente resolver sozinho. */
    if (a.passos && a.passos.length) {
      corpo += '<div class="help-block">' +
        '<div class="help-block__t">' + U.esc(a.passosTitulo || "Passo a passo") + '</div>' +
        '<ol class="passos">' + a.passos.map(function (p) {
          return '<li>' + U.esc(p) + '</li>';
        }).join("") + '</ol>' +
        (a.passosNota
          ? '<div class="help-block__c" style="margin-top:10px;color:var(--txt-3);font-size:12.5px">' +
            U.esc(a.passosNota) + '</div>'
          : '') +
      '</div>';
    }
    if (item.kind === "arquivo") {
      corpo += '<div class="help-block"><div class="help-block__t">Como enviar</div>' +
        '<div class="help-block__c">Aceitamos PDF, foto (JPG, PNG, WEBP), planilhas e documentos do ' +
        'Office, além de TXT e XML. Cada arquivo pode ter até ' + U.bytes(U.MAX_ARQUIVO) + '. ' +
        'Você pode anexar quantos arquivos precisar no mesmo item.</div></div>';
    }
    if (item.kind === "acesso") {
      corpo += '<div class="help-block"><div class="notice notice--ok">' +
        '<span class="notice__icon">' + ic("ic-shield") + '</span>' +
        '<span><strong>Como a senha fica protegida.</strong> Ao tocar em "Guardar com segurança", ' +
        'ela é embaralhada dentro do seu aparelho, antes de sair. O portal só tem a chave que ' +
        'tranca; a que abre fica com a ' + U.esc(DATA.ORG.curto) + ', fora do sistema. ' +
        'Nem neste aparelho, nem no nosso banco de dados a senha existe de forma legível. ' +
        'Se preferir não digitar senha, use a procuração eletrônica — o passo a passo está ' +
        'logo acima.</span></div></div>';
    }

    UI.modal({ titulo: item.nome, corpoHTML: corpo, acoes: [{ rotulo: "Entendi", classe: "btn--primary" }] });
  }

  /* ============================================================
     Credenciais

     O que o cliente digita aqui NUNCA é gravado em texto legível.
     Ao salvar, os valores são cifrados no próprio aparelho com a
     chave pública da Totali (js/cripto.js) e só o envelope
     fechado entra no estado. Os campos são limpos da tela na
     sequência — nem no formulário a senha fica parada.
     ============================================================ */
  function avisoCanalSeguro() {
    var C = global.Cripto;
    var motivo = C ? C.motivo() : "Recurso de criptografia indisponível.";
    if (!motivo) return "";
    return '<div class="notice notice--warn" style="margin-top:11px">' +
      '<span class="notice__icon">' + ic("ic-alert") + '</span>' +
      '<span><strong>Envio de senha indisponível.</strong> ' + U.esc(motivo) + '</span></div>';
  }

  function credenciaisHTML(chave, campos, opcoes) {
    var o = opcoes || {};
    var C = global.Cripto;
    var guardada = Store.temCredencial(chave);
    var reg = Store.credencial(chave);

    if (guardada) {
      return '<div class="cofre cofre--ok" data-cred="' + U.escAttr(chave) + '">' +
        '<span class="cofre__icone">' + ic("ic-lock") + '</span>' +
        '<span class="cofre__txt">' +
          '<span class="cofre__t">Acesso guardado com segurança</span>' +
          '<span class="cofre__d">' + U.esc(reg.campos.length) + ' ' +
            U.plural(reg.campos.length, "dado protegido", "dados protegidos") +
            (reg.atualizadoEm ? " · " + U.esc(U.dataCurta(reg.atualizadoEm)) : "") +
            '. Nem a senha nem o login ficam legíveis neste aparelho.</span>' +
        '</span>' +
        '<span class="cofre__acoes">' +
          '<button type="button" class="btn btn--ghost btn--sm" data-cred-trocar="1">Substituir</button>' +
          '<button type="button" class="btn btn--quiet btn--sm" data-cred-apagar="1">Apagar</button>' +
        '</span>' +
      '</div>';
    }

    if (!C || !C.configurada) return avisoCanalSeguro();

    var html = '<div class="cofre" data-cred="' + U.escAttr(chave) + '">' +
      '<div class="cofre__cabeca">' +
        '<span class="cofre__icone">' + ic("ic-lock") + '</span>' +
        '<span class="cofre__t">' + U.esc(o.titulo || "Informe o acesso") + '</span>' +
      '</div>';

    campos.forEach(function (c) {
      var id = "cred-" + chave.replace(/[^a-zA-Z0-9]/g, "-") + "-" + c.id;
      html += '<div class="field" style="margin-bottom:11px">' +
        '<label class="field__label" for="' + U.escAttr(id) + '">' + U.esc(c.rotulo) + '</label>';
      if (c.tipo === "senha") {
        html += '<div class="campo-senha">' +
          '<input type="password" class="input" id="' + U.escAttr(id) + '" ' +
            'data-cred-campo="' + U.escAttr(c.id) + '" maxlength="300" ' +
            'autocomplete="new-password" autocapitalize="none" spellcheck="false" ' +
            'placeholder="••••••••">' +
          '<button type="button" class="campo-senha__ver" data-ver-senha="1" ' +
            'aria-label="Mostrar senha">' + ic("ic-olho") + '</button>' +
        '</div>';
      } else {
        html += '<input type="text" class="input" id="' + U.escAttr(id) + '" ' +
          'data-cred-campo="' + U.escAttr(c.id) + '" maxlength="300" ' +
          'autocomplete="off" autocapitalize="none" spellcheck="false" ' +
          'placeholder="' + U.escAttr(c.placeholder || "") + '">';
      }
      if (c.dica) html += '<div class="field__hint">' + U.esc(c.dica) + '</div>';
      html += '</div>';
    });

    html += '<button type="button" class="btn btn--primary btn--sm btn--block" data-cred-salvar="1">' +
        ic("ic-lock") + 'Guardar com segurança</button>' +
      '<p class="cofre__nota">Ao guardar, os dados são embaralhados aqui no seu aparelho. ' +
        'Só a Totali consegue abrir — nem quem tiver acesso a este celular consegue ler.</p>' +
    '</div>';
    return html;
  }

  function lerCredenciais(caixa) {
    var valores = {};
    $$("[data-cred-campo]", caixa).forEach(function (i) {
      var v = String(i.value || "").trim();
      if (v) valores[i.getAttribute("data-cred-campo")] = v;
    });
    return valores;
  }

  function limparCredenciais(caixa) {
    $$("[data-cred-campo]", caixa).forEach(function (i) { i.value = ""; });
  }

  function ligarCredenciais() {
    $$("[data-ver-senha]").forEach(function (b) {
      b.addEventListener("click", function () {
        var campo = b.parentNode.querySelector("input");
        if (!campo) return;
        var mostrando = campo.type === "text";
        campo.type = mostrando ? "password" : "text";
        b.setAttribute("aria-label", mostrando ? "Mostrar senha" : "Ocultar senha");
        b.classList.toggle("campo-senha__ver--on", !mostrando);
      });
    });

    $$("[data-cred-salvar]").forEach(function (b) {
      b.addEventListener("click", function () {
        var caixa = b.closest("[data-cred]");
        var chave = caixa.getAttribute("data-cred");
        var valores = lerCredenciais(caixa);
        if (!Object.keys(valores).length) {
          UI.toast("Preencha pelo menos um campo.", "erro");
          return;
        }
        b.disabled = true;
        Store.guardarCredencial(chave, valores).then(function (ok) {
          limparCredenciais(caixa);   /* some da tela imediatamente */
          Store.flush();
          if (ok) UI.toast("Acesso guardado com segurança.", "ok");
          render();
        }, function () {
          b.disabled = false;
          limparCredenciais(caixa);
          UI.toast("Não foi possível guardar com segurança. Nada foi salvo.", "erro");
        });
      });
    });

    $$("[data-cred-trocar]").forEach(function (b) {
      b.addEventListener("click", function () {
        var chave = b.closest("[data-cred]").getAttribute("data-cred");
        Store.removerCredencial(chave);
        Store.flush();
        render();
      });
    });

    $$("[data-cred-apagar]").forEach(function (b) {
      b.addEventListener("click", function () {
        var chave = b.closest("[data-cred]").getAttribute("data-cred");
        UI.confirmar({
          titulo: "Apagar acesso",
          mensagem: "Os dados de acesso guardados serão removidos. Você pode informar de novo depois.",
          confirmar: "Apagar", perigo: true
        }).then(function (ok) {
          if (!ok) return;
          Store.removerCredencial(chave);
          Store.flush();
          UI.toast("Acesso apagado.", "ok");
          render();
        });
      });
    });
  }

  /* ============================================================
     Tela: Financeiro (bancos e maquininhas)

     Conteúdo herdado do sistema "checklist financeiro" da Totali,
     que deixa de ter link próprio. Diferença importante em relação
     ao original: o login e a senha da maquininha são cifrados no
     aparelho do cliente antes de sair (js/cripto.js). No sistema
     antigo eles iam em texto legível para o banco de dados.
     ============================================================ */
  /* Orientações de acesso, vindas do catálogo.

     Só entram as instituições que o cliente MARCOU. Mostrar o passo
     a passo de dezesseis bancos, sendo que ele usa dois, é a
     maneira mais rápida de fazer alguém parar de ler. */
  function orientacoesHTML(catalogo, marcados, preposicao) {
    var comTexto = (marcados || []).map(function (nome) {
      return DATA.acharNoCatalogo(catalogo, nome);
    }).filter(function (i) { return i && i.orientacao; });

    if (!comTexto.length) return "";

    return comTexto.map(function (i) {
      return '<div class="orienta">' +
        '<div class="orienta__t">' + ic("ic-info") + 'Como liberar o acesso ' +
          preposicao + ' ' + U.esc(i.nome) + '</div>' +
        '<div class="orienta__c">' + U.paragrafos(i.orientacao) + '</div>' +
      '</div>';
    }).join("");
  }

  function caixaSelecao(nome, valor, marcado, rotulo) {
    return '<label class="opcao' + (marcado ? " opcao--on" : "") + '">' +
      '<input type="checkbox" data-' + nome + '="' + U.escAttr(valor) + '"' +
      (marcado ? " checked" : "") + '>' +
      '<span>' + U.esc(rotulo) + '</span></label>';
  }

  function botaoSimNao(campo, valorAtual) {
    return '<div class="segm" role="group">' +
      ['sim', 'nao'].map(function (v) {
        return '<button type="button" class="segm__b' + (valorAtual === v ? " segm__b--on" : "") +
          '" data-simnao="' + campo + '" data-valor="' + v + '">' +
          (v === "sim" ? "Sim" : "Não") + '</button>';
      }).join("") +
    '</div>';
  }

  function viewFinanceiro() {
    var f = Store.estado.financeiro;
    var respondido = Store.financeiroRespondido();
    var concluido = !!f.concluidoEm;

    var html = '<section class="section">' +
      '<div class="section__head"><div>' +
        '<div class="eyebrow">Etapa 4</div>' +
        '<h1 class="section__title" style="font-size:20px;margin-top:4px">Bancos e maquininhas</h1>' +
        '<p class="section__desc">Precisamos saber por onde entra e sai o dinheiro da empresa. ' +
          'São três perguntas rápidas.</p>' +
      '</div></div>';

    if (concluido) {
      html += '<div class="recibo">' +
        '<div class="recibo__marca">' + ic("ic-check") + '</div>' +
        '<div class="recibo__t">Recebemos, obrigado!</div>' +
        '<div class="recibo__d">A equipe da Totali já foi avisada e entra em contato se ' +
          'faltar alguma coisa.</div>' +
        (f.protocolo
          ? '<div class="recibo__prot">' +
              '<span class="recibo__prot-r">Guarde este número de protocolo</span>' +
              '<span class="recibo__prot-n">' + U.esc(f.protocolo) + '</span>' +
            '</div>'
          : '') +
        (f.formaRelatorio === "envio"
          ? '<div class="recibo__termo">' +
              '<div class="recibo__termo-t">Lembrete do seu compromisso</div>' +
              '<ol class="compromisso__lista">' +
                DATA.COMPROMISSO.itens.map(function (item, i) {
                  return '<li><span class="compromisso__n">' + (i + 1) + '</span>' +
                         U.esc(item) + '</li>';
                }).join("") +
              '</ol>' +
              '<button type="button" class="btn btn--gold btn--sm" id="btnTermo">' +
                ic("ic-download") + (f.termo && f.termo.id
                  ? "Baixar meu termo de compromisso (PDF)"
                  : "Gerar meu termo de compromisso (PDF)") + '</button>' +
            '</div>'
          : '') +
        '<div class="recibo__nota">Respondido em ' + U.esc(U.dataCurta(f.concluidoEm)) +
          '. Mudou alguma coisa? Pode alterar aqui embaixo e enviar de novo.</div>' +
      '</div>';
    }

    /* --- Bancos --- */
    html += '<div class="card card--pad" style="margin-bottom:14px">' +
      '<h2 class="section__title" style="font-size:16px">A empresa tem conta em banco?</h2>' +
      '<p class="section__desc" style="margin-bottom:12px">Considere todas as contas usadas pela ' +
        'empresa, inclusive as digitais.</p>' +
      botaoSimNao("temBanco", f.temBanco);

    if (f.temBanco === "sim") {
      html += '<div class="hr"></div>' +
        '<div class="field__label">Marque os bancos que a empresa usa</div>' +
        '<div class="opcoes">' +
          DATA.BANCOS.map(function (b) {
            return caixaSelecao("banco", b.nome, f.bancos.indexOf(b.nome) > -1, b.nome);
          }).join("") +
        '</div>' +
        orientacoesHTML(DATA.BANCOS, f.bancos, "no") +
        '<div class="field" style="margin-top:14px;margin-bottom:0">' +
          '<label class="field__label" for="fBancoOutro">Algum banco fora da lista?</label>' +
          '<input type="text" class="input" id="fBancoOutro" data-fin="bancoOutro" maxlength="200" ' +
          'autocomplete="off" value="' + U.escAttr(f.bancoOutro) + '" placeholder="Opcional"></div>';
    }
    html += '</div>';

    /* --- Maquininhas --- */
    html += '<div class="card card--pad" style="margin-bottom:14px">' +
      '<h2 class="section__title" style="font-size:16px">A empresa recebe por maquininha?</h2>' +
      '<p class="section__desc" style="margin-bottom:12px">Cartão de crédito, débito, Pix por ' +
        'maquininha ou link de pagamento.</p>' +
      botaoSimNao("temMaquineta", f.temMaquineta);

    if (f.temMaquineta === "sim") {
      html += '<div class="hr"></div>' +
        '<div class="field__label">Marque as maquininhas que a empresa usa</div>' +
        '<div class="opcoes">' +
          DATA.MAQUINETAS.map(function (m) {
            return caixaSelecao("maquineta", m.nome, f.maquinetas.indexOf(m.nome) > -1, m.nome);
          }).join("") +
        '</div>' +
        orientacoesHTML(DATA.MAQUINETAS, f.maquinetas, "na") +
        '<div class="field" style="margin-top:14px">' +
          '<label class="field__label" for="fMaqOutra">Alguma maquininha fora da lista?</label>' +
          '<input type="text" class="input" id="fMaqOutra" data-fin="maquinetaOutra" maxlength="200" ' +
          'autocomplete="off" value="' + U.escAttr(f.maquinetaOutra) + '" placeholder="Opcional"></div>' +
        '</div>' +

        '<div class="card card--pad" style="margin-bottom:14px">' +
        '<h2 class="section__title" style="font-size:16px">Como vamos receber os relatórios de venda?</h2>' +
        '<p class="section__desc" style="margin-bottom:14px">Todo mês precisamos do relatório de ' +
          'vendas, do de recebimentos e do de antecipações de cada maquininha. Sem eles, o ' +
          'faturamento do cartão não entra na contabilidade.</p>' +
        '<div class="escolhas">' +
          DATA.FORMAS_RELATORIO.map(function (o) {
            var on = f.formaRelatorio === o.id;
            return '<button type="button" class="escolha' + (on ? " escolha--on" : "") +
              '" data-forma-rel="' + U.escAttr(o.id) + '">' +
              '<span class="escolha__marca">' + (on ? ic("ic-check") : "") + '</span>' +
              '<span class="escolha__txt">' +
                '<span class="escolha__t">' + U.esc(o.titulo) +
                  (o.recomendado ? ' <span class="badge badge--aprovado" style="margin-left:6px">' +
                    'Mais prático</span>' : '') + '</span>' +
                '<span class="escolha__d">' + U.esc(o.desc) + '</span>' +
              '</span></button>';
          }).join("") +
        '</div>';

      if (f.formaRelatorio === "envio") {
        /* A lista fica aqui, na tela, e não só no PDF: muita
           gente não abre o termo, e precisa saber o que enviar. */
        var C = DATA.COMPROMISSO;
        html += '<div class="compromisso">' +
          '<div class="compromisso__topo">' +
            '<span class="compromisso__icone">' + ic("ic-check-circle") + '</span>' +
            '<span class="compromisso__t">' + U.esc(C.titulo) + '</span>' +
          '</div>' +
          '<p class="compromisso__chamada">' + U.esc(C.chamada) + '</p>' +
          '<ol class="compromisso__lista">' +
            C.itens.map(function (item, i) {
              return '<li><span class="compromisso__n">' + (i + 1) + '</span>' +
                     U.esc(item) + '</li>';
            }).join("") +
          '</ol>' +
          '<p class="compromisso__fecho">' + U.esc(C.fecho) + '</p>' +
          '<p class="compromisso__nota">' + ic("ic-file") +
            'Ao concluir esta etapa, geramos um termo em PDF com esse compromisso, ' +
            'para você guardar.</p>' +
        '</div>';
      }
      if (f.formaRelatorio === "acesso") {
        html += '<div class="notice notice--info" style="margin-top:14px">' +
          '<span class="notice__icon">' + ic("ic-lock") + '</span>' +
          '<span><strong>Para que serve o acesso.</strong> Usamos só para baixar os relatórios do ' +
          'mês. Nunca movimentamos dinheiro, não fazemos transferência e não alteramos nada. ' +
          '<br><strong>Dica:</strong> várias maquininhas (Stone e Cielo, por exemplo) permitem criar ' +
          'um usuário só de consulta — se puder, crie um para nós. ' +
          '<br><strong>A Totali nunca pede a senha do seu banco.</strong></span></div>';

        var escolhidas = f.maquinetas.slice();
        if (f.maquinetaOutra.trim()) escolhidas.push(f.maquinetaOutra.trim());

        if (!escolhidas.length) {
          html += '<div class="notice" style="margin-top:12px">' +
            '<span class="notice__icon">' + ic("ic-info") + '</span>' +
            '<span>Marque acima quais maquininhas você usa para informar o acesso de cada uma.</span></div>';
        } else {
          escolhidas.forEach(function (nome) {
            var cat = DATA.acharNoCatalogo(DATA.MAQUINETAS, nome);
            html += '<div style="margin-top:14px">' +
              '<div class="field__label" style="font-size:13px;color:var(--gold-2)">' +
                U.esc(nome) + '</div>';

            /* MODO CONTADOR — operadora que libera a contabilidade
               por dentro do próprio aplicativo. Não existe login e
               senha para digitar; pedir isso trava o formulário de
               quem não tem o que preencher. */
            if (cat && cat.semCredencial) {
              var confirmado = (f.modoContador || {})[nome] === true;
              html += '<label class="modo-contador' + (confirmado ? " modo-contador--on" : "") + '">' +
                  '<input type="checkbox" data-modo-contador="' + U.escAttr(nome) + '"' +
                    (confirmado ? " checked" : "") + '>' +
                  '<span class="modo-contador__txt">' +
                    '<span class="modo-contador__t">Já fiz o cadastro no Modo Contador da ' +
                      U.esc(nome) + '</span>' +
                    '<span class="modo-contador__d">Esta operadora libera a contabilidade pelo ' +
                      'próprio aplicativo, então não há senha para informar. Marque quando tiver ' +
                      'feito o cadastro.</span>' +
                  '</span>' +
                '</label>';
            } else {
              html += credenciaisHTML("financeiro/maquineta/" + nome, [
                { id: "login", rotulo: "Login / usuário", tipo: "texto",
                  placeholder: "E-mail ou CNPJ de acesso" },
                { id: "senha", rotulo: "Senha", tipo: "senha" }
              ], { titulo: "Acesso da " + nome });
            }
            html += '</div>';
          });
        }
      }
      html += '</div>';
    }

    /* --- Observações e conclusão --- */
    html += '<div class="card card--pad">' +
      '<div class="field">' +
        '<label class="field__label" for="fObs">Quer nos contar mais alguma coisa?</label>' +
        '<textarea class="textarea" id="fObs" data-fin="observacoes" maxlength="2000" ' +
          'placeholder="Opcional. Qualquer detalhe que ajude a entender o financeiro da empresa.">' +
          U.esc(f.observacoes) + '</textarea>' +
      '</div>' +
      '<button type="button" class="btn btn--primary btn--block" id="btnConcluirFin"' +
        (respondido ? "" : " disabled") + '>' +
        (concluido ? "Salvar alterações" : "Concluir esta etapa") + ic("ic-arrow-right") + '</button>' +
      (respondido ? "" :
        '<p class="text-xs text-muted" style="margin-top:10px;text-align:center">' +
        'Responda as perguntas acima para concluir.</p>') +
    '</div></section>';

    return html + rodape();
  }

  function bindFinanceiro() {
    $$("[data-simnao]").forEach(function (b) {
      b.addEventListener("click", function () {
        var campo = b.getAttribute("data-simnao");
        var valor = b.getAttribute("data-valor");
        var atual = Store.estado.financeiro[campo];
        Store.definirFinanceiro(campo, atual === valor ? "" : valor);
        Store.flush();
        render();
      });
    });

    ["banco", "maquineta"].forEach(function (tipo) {
      $$("[data-" + tipo + "]").forEach(function (c) {
        c.addEventListener("change", function () {
          var nome = c.getAttribute("data-" + tipo);
          var lista = tipo === "banco" ? "bancos" : "maquinetas";
          var jaTem = Store.estado.financeiro[lista].indexOf(nome) > -1;
          /* Só alterna quando o estado e a caixa discordam. */
          if (c.checked !== jaTem) {
            if (!Store.alternarFinanceiro(tipo, nome)) { c.checked = jaTem; return; }
            Store.flush();
          }
          c.closest(".opcao").classList.toggle("opcao--on", c.checked);
          atualizarBotaoFinanceiro();
        });
      });
    });

    $$("[data-forma-rel]").forEach(function (b) {
      b.addEventListener("click", function () {
        var v = b.getAttribute("data-forma-rel");
        var atual = Store.estado.financeiro.formaRelatorio;
        Store.definirFinanceiro("formaRelatorio", atual === v ? "" : v);
        Store.flush();
        render();
      });
    });

    /* Modo Contador: não há senha para guardar, então o que fica
       registrado é a confirmação do cliente. */
    $$("[data-modo-contador]").forEach(function (c) {
      c.addEventListener("change", function () {
        Store.definirModoContador(c.getAttribute("data-modo-contador"), c.checked);
        Store.flush();
        var caixa = c.closest(".modo-contador");
        if (caixa) caixa.classList.toggle("modo-contador--on", c.checked);
        atualizarBotaoFinanceiro();
      });
    });

    $$("[data-fin]").forEach(function (campo) {
      campo.addEventListener("change", function () {
        Store.definirFinanceiro(campo.getAttribute("data-fin"), campo.value);
        Store.flush();
        atualizarBotaoFinanceiro();
      });
    });

    var btn = $("#btnConcluirFin");
    if (btn) btn.addEventListener("click", function () {
      if (!Store.concluirFinanceiro()) {
        UI.toast("Responda todas as perguntas antes de concluir.", "erro");
        return;
      }
      Store.flush();
      UI.toast("Etapa concluída. Obrigado!", "ok");
      render();
      global.scrollTo({ top: 0, behavior: "smooth" });
    });

    var btnTermo = $("#btnTermo");
    if (btnTermo) btnTermo.addEventListener("click", function () {
      var fin = Store.estado.financeiro;

      /* Já existe? Só entrega de novo, sem gerar outro. */
      if (fin.termo && fin.termo.id) {
        abrirArquivo(fin.termo.id, fin.termo.nome);
        return;
      }
      if (!global.Termo || !global.Termo.disponivel()) {
        UI.toast("Não foi possível gerar o PDF neste navegador. Fale com a Totali.", "erro");
        return;
      }

      btnTermo.disabled = true;
      var antes = btnTermo.innerHTML;
      btnTermo.textContent = "Gerando…";

      var maq = fin.maquinetas.slice();
      if (fin.maquinetaOutra.trim()) maq.push(fin.maquinetaOutra.trim());

      global.Termo.gerar({
        empresa: Store.estado.empresa.razaoSocial || Store.estado.empresa.nomeFantasia,
        cnpj: Store.estado.empresa.cnpj,
        protocolo: fin.protocolo,
        maquinetas: maq,
        em: fin.concluidoEm || Date.now()
      }).then(function (r) {
        return Store.guardarTermo(r.blob, r.nome, r.em).then(function (id) {
          Store.flush();
          abrirArquivo(id, r.nome);
          UI.toast("Termo gerado. Guarde o arquivo com você.", "ok");
          render();
        });
      }, function () {
        btnTermo.disabled = false;
        btnTermo.innerHTML = antes;
        UI.toast("Não foi possível gerar o termo. Tente de novo.", "erro");
      });
    });
  }

  function atualizarBotaoFinanceiro() {
    var btn = $("#btnConcluirFin");
    if (btn) btn.disabled = !Store.financeiroRespondido();
  }

  /* ============================================================
     Tela: Mensagens
     ============================================================ */

  /* Descobre o nome legível de um documento a partir da chave. */
  function nomeDoItem(chave) {
    if (!chave) return "";
    var partes = String(chave).split("/");
    var grupo = DATA.GRUPOS.filter(function (g) { return g.id === partes[0]; })[0];
    if (!grupo) return "";
    var item = grupo.itens.filter(function (i) { return i.id === partes[partes.length - 1]; })[0];
    if (!item) return "";
    if (partes.length === 3) {
      var socio = Store.estado.socios.filter(function (s) { return s.id === partes[1]; })[0];
      if (socio && socio.nome) return item.nome + " · " + U.primeiroNome(socio.nome);
    }
    return item.nome;
  }

  function cartaoNotificacoes() {
    var N = global.Notif;
    if (!N || !N.suportado) return "";
    if (N.ativo) return "";
    var motivo = N.motivo();
    if (motivo) {
      return '<div class="notice notice--info" style="margin-bottom:16px">' +
        '<span class="notice__icon">' + ic("ic-bell") + '</span>' +
        '<span>' + U.esc(motivo) + '</span></div>';
    }
    return '<div class="notif" style="margin-bottom:16px">' +
      '<span class="notif__icon">' + ic("ic-bell") + '</span>' +
      '<span class="notif__txt">' +
        '<span class="notif__t">Quer ser avisado?</span>' +
        '<span class="notif__d">Ative os avisos e receba no celular quando pedirmos um documento, ' +
        'revisarmos um envio ou mandarmos uma mensagem.</span>' +
      '</span>' +
      '<button type="button" class="btn btn--primary btn--sm" id="btnAtivarAvisos">Ativar</button>' +
    '</div>';
  }

  function viewMensagens() {
    var msgs = Store.mensagens();
    var org = DATA.ORG;

    var html = '<section class="section">' +
      '<div class="section__head"><div>' +
        '<h1 class="section__title" style="font-size:20px">Mensagens</h1>' +
        '<p class="section__desc">Fale direto com quem cuida da sua empresa. ' +
          U.esc(org.horario) + '.</p>' +
      '</div></div>' +
      cartaoNotificacoes();

    if (!msgs.length) {
      html += '<div class="card"><div class="empty">' +
        '<div class="empty__icon">' + ic("ic-chat") + '</div>' +
        '<div class="empty__title">Nenhuma mensagem ainda</div>' +
        '<div class="empty__desc">Escreva abaixo se tiver qualquer dúvida sobre um documento ' +
        'ou sobre a migração. Respondemos por aqui mesmo.</div>' +
      '</div></div>';
    } else {
      var ultimoDia = "";
      html += '<div class="chat">';
      msgs.forEach(function (m) {
        var dia = U.dataCurta(m.em);
        if (dia && dia !== ultimoDia) {
          ultimoDia = dia;
          html += '<div class="chat__dia">' + U.esc(dia) + '</div>';
        }
        var doc = m.chave ? nomeDoItem(m.chave) : "";
        /* Aqui quem olha é o CLIENTE: mensagem dele à direita. */
        html += '<div class="msg msg--' + (m.autor === "equipe" ? "dele" : "minha") +
                (m.autor === "equipe" && !m.lidaEm ? " msg--nova" : "") + '">' +
          (m.autor === "equipe"
            ? '<div class="msg__autor">' + U.esc(m.autorNome || org.curto) + '</div>' : '') +
          (doc
            ? '<button type="button" class="msg__ref" data-rota="documentos" data-grupo="' +
              U.escAttr(String(m.chave).split("/")[0]) + '">' + ic("ic-file") + U.esc(doc) + '</button>'
            : '') +
          (m.anexos && m.anexos.length ? anexosHTML(m.anexos) : '') +
          (m.texto ? '<div>' + U.esc(m.texto).replace(/\n/g, "<br>") + '</div>' : '') +
          '<div class="msg__hora">' + U.esc(U.dataHora(m.em).split(" às ")[1] || "") + '</div>' +
        '</div>';
      });
      html += '</div>';
    }

    html += '<div class="composer">' +
        '<div class="composer__anexos" id="msgAnexos" hidden></div>' +
        '<div class="composer__linha">' +
          '<button type="button" class="composer__acao" id="btnAnexar" ' +
            'aria-label="Anexar arquivo, imagem ou áudio">' + ic("ic-clipe") + '</button>' +
          '<button type="button" class="composer__acao" id="btnCamera" aria-label="Tirar foto">' +
            ic("ic-camera") + '</button>' +
          '<textarea class="textarea" id="msgTexto" rows="1" maxlength="4000" ' +
            'placeholder="Escreva sua mensagem…" aria-label="Escreva sua mensagem"></textarea>' +
          '<button type="button" class="composer__send" id="btnEnviarMsg" disabled aria-label="Enviar">' +
            ic("ic-send") + '</button>' +
        '</div>' +
      '</div>' +
      '<p class="text-xs text-muted" style="margin-top:10px;text-align:center">' +
        'Precisa de resposta imediata? ' +
        '<a href="https://wa.me/' + U.escAttr(org.whatsapp) + '" target="_blank" rel="noopener noreferrer">' +
        'Chame no WhatsApp</a>.</p>' +
    '</section>';

    return html;
  }

  /* ---------- Anexos das mensagens ---------- */
  function ehImagem(tipo) { return /^image\//.test(tipo || ""); }
  function ehAudio(tipo) { return /^audio\//.test(tipo || ""); }

  function anexosHTML(anexos) {
    return '<div class="msg__anexos">' + anexos.map(function (a) {
      if (ehImagem(a.tipo)) {
        return '<button type="button" class="anexo anexo--img" data-anexo="' + U.escAttr(a.id) +
          '" data-nome="' + U.escAttr(a.nome) + '" data-tipo="' + U.escAttr(a.tipo) + '">' +
          '<img alt="' + U.escAttr(a.nome) + '"></button>';
      }
      if (ehAudio(a.tipo)) {
        return '<div class="anexo anexo--audio" data-anexo="' + U.escAttr(a.id) +
          '" data-tipo="' + U.escAttr(a.tipo) + '">' +
          '<audio controls preload="none"></audio></div>';
      }
      return '<button type="button" class="anexo anexo--arq" data-anexo="' + U.escAttr(a.id) +
        '" data-nome="' + U.escAttr(a.nome) + '" data-tipo="' + U.escAttr(a.tipo) + '">' +
        '<span class="file__icon">' + ic(U.iconePorExtensao(U.extensao(a.nome))) + '</span>' +
        '<span class="file__info"><span class="file__name">' + U.esc(a.nome) + '</span>' +
        '<span class="file__meta">' + U.esc(U.bytes(a.tamanho)) + '</span></span></button>';
    }).join("") + '</div>';
  }

  /* Os blobs vivem no IndexedDB; aqui viram endereços temporários
     só enquanto a tela existe. */
  var urlsTemporarias = [];
  function soltarURLs() {
    urlsTemporarias.forEach(function (u) { URL.revokeObjectURL(u); });
    urlsTemporarias = [];
  }

  function hidratarAnexos() {
    soltarURLs();
    $$("[data-anexo]").forEach(function (no) {
      var id = no.getAttribute("data-anexo");
      var aplicar = function (url) {
        if (!url) return;
        var img = no.querySelector("img");
        if (img) { img.src = url; return; }
        var som = no.querySelector("audio");
        if (som) { som.src = url; }
      };
      Store.baixarArquivo(id, "mensagem").then(function (blob) {
        if (blob) {
          var url = URL.createObjectURL(blob);
          urlsTemporarias.push(url);
          aplicar(url);
          return null;
        }
        /* Sem os bytes aqui, a prévia vem direto do servidor. */
        return Store.urlArquivo(id, "mensagem").then(aplicar);
      }, function () { /* anexo ausente: o cartão fica sem prévia */ });
    });
  }

  function bindMensagens() {
    var campo = $("#msgTexto"), botao = $("#btnEnviarMsg");
    if (!campo || !botao) return;

    hidratarAnexos();

    var pendentes = [];      /* File[] ainda não enviados */
    var listaAnexos = $("#msgAnexos");

    function podeEnviar() {
      botao.disabled = !campo.value.trim() && !pendentes.length;
    }

    function desenharPendentes() {
      if (!pendentes.length) { listaAnexos.hidden = true; listaAnexos.innerHTML = ""; podeEnviar(); return; }
      listaAnexos.hidden = false;
      listaAnexos.innerHTML = pendentes.map(function (f, i) {
        var rot = ehAudio(f.type) ? "Áudio gravado" : U.nomeSeguro(f.name);
        return '<span class="pendente">' +
          ic(ehImagem(f.type) ? "ic-image" : ehAudio(f.type) ? "ic-som" : "ic-file") +
          '<span class="pendente__n">' + U.esc(rot) + '</span>' +
          '<span class="pendente__t">' + U.esc(U.bytes(f.size)) + '</span>' +
          '<button type="button" class="pendente__x" data-tirar="' + i + '" ' +
            'aria-label="Remover anexo">' + ic("ic-x") + '</button></span>';
      }).join("");
      $$("[data-tirar]", listaAnexos).forEach(function (b) {
        b.addEventListener("click", function () {
          pendentes.splice(parseInt(b.getAttribute("data-tirar"), 10), 1);
          desenharPendentes();
        });
      });
      podeEnviar();
    }

    function juntar(arquivos) {
      var usado = Store.bytesUsados();
      Array.prototype.slice.call(arquivos || []).forEach(function (f) {
        var erro = U.validaArquivo(f, usado);
        if (erro) { UI.toast(U.nomeSeguro(f.name) + ": " + erro, "erro"); return; }
        if (pendentes.length >= 10) { UI.toast("Máximo de 10 anexos por mensagem.", "erro"); return; }
        usado += f.size;
        pendentes.push(f);
      });
      desenharPendentes();
    }

    /* --- anexar e câmera --- */
    function escolher(aceita, camera) {
      var entrada = document.createElement("input");
      entrada.type = "file";
      entrada.multiple = !camera;
      entrada.accept = aceita;
      if (camera) entrada.capture = "environment";
      entrada.style.display = "none";
      entrada.addEventListener("change", function () {
        juntar(entrada.files);
        entrada.remove();
      });
      document.body.appendChild(entrada);
      entrada.click();
    }
    $("#btnAnexar").addEventListener("click", function () { escolher(U.ACCEPT_ATTR, false); });
    $("#btnCamera").addEventListener("click", function () { escolher("image/*", true); });

    var ajustarAltura = function () {
      campo.style.height = "auto";
      campo.style.height = Math.min(campo.scrollHeight, 150) + "px";
      podeEnviar();
    };
    campo.addEventListener("input", ajustarAltura);

    var enviar = function () {
      var texto = campo.value.trim();
      if (!texto && !pendentes.length) return;
      botao.disabled = true;

      var guardar = pendentes.map(function (f) { return Store.guardarAnexo(f); });
      Promise.all(guardar).then(function (metas) {
        Store.enviarMensagem(texto, {
          autor: "cliente",
          autorNome: Store.estado.empresa.responsavelNome || "",
          anexos: metas
        });
        Store.flush();
        pendentes = [];
        campo.value = "";
        render();
        var novo = $("#msgTexto");
        if (novo) novo.focus();
        irParaFimDaConversa();
      }, function () {
        botao.disabled = false;
        UI.toast("Não foi possível anexar. Tente de novo.", "erro");
      });
    };

    botao.addEventListener("click", enviar);
    campo.addEventListener("keydown", function (ev) {
      /* Enter envia no computador; no celular, quebra linha. */
      if (ev.key === "Enter" && !ev.shiftKey && global.innerWidth >= 900) {
        ev.preventDefault();
        enviar();
      }
    });

    if (Store.marcarLidas("cliente")) {
      Store.flush();
      atualizarNav(estadoUI.rota);
    }
    irParaFimDaConversa();

    var btnAvisos = $("#btnAtivarAvisos");
    if (btnAvisos && global.Notif) {
      btnAvisos.addEventListener("click", function () {
        global.Notif.pedirPermissao().then(function (ok) {
          if (ok) {
            UI.toast("Avisos ativados. Você será notificado neste aparelho.", "ok");
            global.Notif.avisar({
              titulo: "Avisos ativados",
              corpo: "É assim que a Totali vai te avisar sobre documentos e mensagens.",
              tag: "teste", rota: "mensagens"
            });
          } else {
            UI.toast("Não foi possível ativar. Verifique as permissões do navegador.", "erro");
          }
          render();
        });
      });
    }
  }

  function irParaFimDaConversa() {
    var chat = $(".chat");
    if (!chat) return;
    var ultimo = chat.lastElementChild;
    if (ultimo && ultimo.scrollIntoView) {
      try { ultimo.scrollIntoView({ block: "center", behavior: "auto" }); } catch (e) {}
    }
  }

  /* ============================================================
     Tela: Academy

     Os vídeos ficam no YouTube (não listados) e só carregam
     quando o cliente toca em assistir — antes disso o YouTube
     não recebe nada dele. Usamos o domínio youtube-nocookie.
     ============================================================ */

  /* Só passa adiante o que tem cara de identificador do YouTube.
     Nunca montar a URL do player com texto arbitrário. */
  function idYoutubeValido(id) {
    return typeof id === "string" && /^[A-Za-z0-9_-]{11}$/.test(id);
  }

  function trilhaLiberada(t) {
    return (t.videos || []).some(function (v) { return idYoutubeValido(v.youtube); });
  }

  function contarLiberados(t) {
    return (t.videos || []).filter(function (v) { return idYoutubeValido(v.youtube); }).length;
  }

  /* Bloco de vídeo: capa própria + botão. O player entra depois. */
  function videoHTML(idYt, titulo, classe) {
    if (!idYoutubeValido(idYt)) {
      return '<div class="video ' + (classe || "") + '">' +
        '<div class="video__capa video__capa--soon">' +
          '<span class="tile__play">' + ic("ic-play") + '</span>' +
          '<span class="video__soon">Em breve</span>' +
        '</div></div>';
    }
    return '<div class="video ' + (classe || "") + '" data-video="' + U.escAttr(idYt) + '" ' +
        'data-video-titulo="' + U.escAttr(titulo || "Vídeo") + '">' +
      '<button type="button" class="video__capa" data-tocar="1" ' +
        'aria-label="Assistir: ' + U.escAttr(titulo || "vídeo") + '">' +
        '<span class="tile__play">' + ic("ic-play") + '</span>' +
        '<span class="video__rot">Assistir</span>' +
      '</button></div>';
  }

  /* Capa própria: só caminho relativo dentro do próprio site.
     Endereço externo, javascript: e afins não passam daqui —
     a CSP também barraria, mas não dependemos só dela. */
  function capaPropriaValida(caminho) {
    return typeof caminho === "string" &&
           /^[A-Za-z0-9_\-./]{1,160}$/.test(caminho) &&
           caminho.indexOf("..") === -1 &&
           caminho.charAt(0) !== "/" &&
           /\.(png|jpe?g|webp)$/i.test(caminho);
  }

  /* A capa vem, nesta ordem: imagem própria enviada pela equipe,
     miniatura do YouTube, ou a capa desenhada por nós. */
  function capaHTML(item, classe) {
    var url = "";
    if (capaPropriaValida(item.capa)) url = item.capa;
    else if (idYoutubeValido(item.youtube)) {
      url = "https://i.ytimg.com/vi/" + item.youtube + "/hqdefault.jpg";
    }
    if (url) {
      return '<span class="capa ' + (classe || "") + '">' +
        '<img src="' + U.escAttr(url) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' +
        '<span class="capa__veu"></span>' +
        '<span class="tile__play">' + ic("ic-play") + '</span></span>';
    }
    return '<span class="capa capa--vazia ' + (classe || "") + '">' +
      '<span class="tile__play">' + ic("ic-play") + '</span></span>';
  }

  /* Capa da trilha: a própria, ou a do primeiro vídeo publicado. */
  function capaDaTrilha(t) {
    if (t.capa) return { capa: t.capa };
    var comVideo = (t.videos || []).filter(function (v) { return idYoutubeValido(v.youtube); })[0];
    return comVideo || { capa: "", youtube: "" };
  }

  function tileAcademy(t) {
    var liberada = trilhaLiberada(t);
    var n = (t.videos || []).length;
    var prontos = contarLiberados(t);
    return '<article class="tile' + (liberada ? " tile--link" : " tile--soon") + '"' +
        (liberada ? ' data-trilha="' + U.escAttr(t.id) + '" data-abrir-trilha="1" tabindex="0" role="button"' : '') + '>' +
      capaHTML(capaDaTrilha(t), "capa--tile") +
      '<div class="tile__body">' +
        '<div class="tile__kicker">' + U.esc(t.kicker) + '</div>' +
        '<h3 class="tile__title">' + U.esc(t.titulo) + '</h3>' +
        '<p class="tile__desc">' + U.esc(t.desc) + '</p>' +
        '<div class="tile__foot">' +
          (liberada
            ? '<span class="badge badge--aprovado"><span class="dot"></span>Disponível</span>'
            : '<span class="badge badge--pendente"><span class="dot"></span>Em breve</span>') +
          '<span class="text-xs text-muted">' +
            (liberada ? prontos + " de " + n + " " + U.plural(n, "aula", "aulas")
                      : n + " " + U.plural(n, "aula", "aulas")) + '</span>' +
        '</div>' +
      '</div>' +
    '</article>';
  }

  /* Dentro de uma trilha, cada aula também é um cartão com capa. */
  function cartaoAula(v, i) {
    var ok = idYoutubeValido(v.youtube);
    return '<article class="tile' + (ok ? " tile--link" : " tile--soon") + '"' +
        (ok ? ' data-video="' + U.escAttr(v.youtube) + '" data-video-titulo="' +
              U.escAttr(v.titulo) + '" data-tocar="1" tabindex="0" role="button"' : '') + '>' +
      capaHTML(v, "capa--tile") +
      '<div class="tile__body">' +
        '<div class="tile__kicker">Aula ' + (i + 1) + '</div>' +
        '<h3 class="tile__title">' + U.esc(v.titulo) + '</h3>' +
        (v.desc ? '<p class="tile__desc">' + U.esc(v.desc) + '</p>' : '') +
        '<div class="tile__foot">' +
          (ok
            ? '<span class="badge badge--aprovado"><span class="dot"></span>Assistir</span>'
            : '<span class="badge badge--pendente"><span class="dot"></span>Em breve</span>') +
          (v.duracao ? '<span class="text-xs text-muted">' + U.esc(v.duracao) + '</span>' : '') +
        '</div>' +
      '</div>' +
    '</article>';
  }

  function viewAcademy() {
    var total = DATA.ACADEMY.reduce(function (a, t) { return a + (t.videos || []).length; }, 0);
    var prontos = DATA.ACADEMY.reduce(function (a, t) { return a + contarLiberados(t); }, 0);
    var aberta = estadoUI.trilhaAberta
      ? DATA.ACADEMY.filter(function (t) { return t.id === estadoUI.trilhaAberta; })[0]
      : null;

    /* --- Dentro de uma trilha --- */
    if (aberta) {
      return '<section class="section">' +
        '<button type="button" class="btn btn--ghost btn--sm" data-voltar-trilhas="1" ' +
          'style="margin-bottom:16px">' + ic("ic-chevron-right", "gira180") + 'Todas as trilhas</button>' +
        '<div class="hero">' +
          '<div class="eyebrow">' + U.esc(aberta.kicker) + '</div>' +
          '<h1 class="hero__title">' + U.esc(aberta.titulo) + '</h1>' +
          '<p class="hero__desc">' + U.esc(aberta.desc) + '</p>' +
        '</div>' +
      '</section>' +
      '<section class="section">' +
        '<div class="section__head"><div>' +
          '<h2 class="section__title">Aulas</h2>' +
          '<p class="section__desc">' + contarLiberados(aberta) + ' de ' +
            (aberta.videos || []).length + ' disponíveis.</p>' +
        '</div></div>' +
        '<div class="tiles">' + (aberta.videos || []).map(cartaoAula).join("") + '</div>' +
      '</section>' + rodape();
    }

    /* --- Grade de trilhas --- */
    return '' +
    '<section class="hero">' +
      '<div class="eyebrow">Totali Academy</div>' +
      '<h1 class="hero__title">Aprenda a rotina da sua empresa</h1>' +
      '<p class="hero__desc">Trilhas curtas e diretas sobre notas fiscais, impostos, folha de pagamento ' +
        'e o que enviar todo mês. Sem juridiquês.</p>' +
      '<div class="hero__row">' +
        '<div class="hero__stats">' +
          '<div><div class="stat__num" data-count="' + prontos + '">0</div>' +
            '<div class="stat__lbl">Disponíveis</div></div>' +
          '<div><div class="stat__num" data-count="' + total + '">0</div>' +
            '<div class="stat__lbl">No total</div></div>' +
        '</div>' +
      '</div>' +
    '</section>' +
    '<section class="section">' +
      '<div class="section__head"><div>' +
        '<h2 class="section__title">Trilhas</h2>' +
        '<p class="section__desc">' +
          (prontos
            ? "Toque numa trilha para ver as aulas."
            : "Estamos gravando. Assim que uma aula for publicada, ela aparece liberada aqui.") +
        '</p>' +
      '</div></div>' +
      '<div class="tiles">' + DATA.ACADEMY.map(tileAcademy).join("") + '</div>' +
    '</section>' + rodape();
  }

  /* Player em janela: só aqui o YouTube é chamado. */
  function abrirVideo(idYt, titulo) {
    if (!idYoutubeValido(idYt)) return;
    var src = "https://www.youtube-nocookie.com/embed/" + idYt +
              "?rel=0&modestbranding=1&playsinline=1&autoplay=1";
    UI.modal({
      titulo: titulo || "Vídeo",
      corpoHTML: '<div class="player">' +
        '<iframe src="' + U.escAttr(src) + '" title="' + U.escAttr(titulo || "Vídeo") + '" ' +
        'referrerpolicy="no-referrer" allowfullscreen ' +
        'allow="accelerometer; encrypted-media; picture-in-picture; fullscreen"></iframe>' +
      '</div>'
    });
  }

  /* ============================================================
     Tela: Empresa
     ============================================================ */
  var REGIMES = ["Simples Nacional", "Lucro Presumido", "Lucro Real", "MEI", "Não sei informar"];

  function viewEmpresa() {
    var e = Store.estado.empresa;
    var socios = Store.estado.socios;
    /* Empresa cadastrada pela Totali: o cliente confere, não digita. */
    var trava = Store.estado.cadastroPelaEquipe;
    var ro = trava ? " readonly" : "";

    var html = '' +
    '<section class="section">' +
      '<div class="section__head"><div>' +
        '<div class="eyebrow">Etapa 2</div>' +
        '<h1 class="section__title" style="font-size:20px;margin-top:4px">Dados da empresa</h1>' +
        '<p class="section__desc">' +
          (trava
            ? "Confira se está tudo certo e complete quem será o nosso contato."
            : "Confirme as informações básicas. É com elas que abrimos seu cadastro nos nossos sistemas.") +
        '</p>' +
      '</div>' + botaoTutorial("empresa", "Ver o tutorial") + '</div>' +

      '<div class="card card--pad">' +
        (trava
          ? '<div class="notice notice--ok" style="margin-bottom:18px">' +
              '<span class="notice__icon">' + ic("ic-check-circle") + '</span>' +
              '<span><strong>Cadastro feito pela Totali.</strong> Os dados da empresa já vieram ' +
              'preenchidos. Se algo estiver errado, avise pelas ' +
              '<a href="#/mensagens" data-rota="mensagens">Mensagens</a> que corrigimos.</span>' +
            '</div>'
          : '') +
        '<div id="blocoEmpresa">' +
        '<div class="field"><label class="field__label" for="fRazao">Razão social' +
          '<span class="field__req">*</span></label>' +
          '<input type="text" class="input" id="fRazao" data-emp="razaoSocial" maxlength="150" ' +
          'autocomplete="organization" value="' + U.escAttr(e.razaoSocial) + '" ' +
          'placeholder="Nome da empresa no contrato social"' + ro + '></div>' +

        '<div class="field"><label class="field__label" for="fFantasia">Nome fantasia</label>' +
          '<input type="text" class="input" id="fFantasia" data-emp="nomeFantasia" maxlength="120" ' +
          'value="' + U.escAttr(e.nomeFantasia) + '" placeholder="Como sua empresa é conhecida"' + ro + '></div>' +

        '<div class="grid-2">' +
          '<div class="field"><label class="field__label" for="fCnpj">CNPJ' +
            '<span class="field__req">*</span></label>' +
            '<input type="text" class="input" id="fCnpj" data-emp="cnpj" data-mascara="cnpj" ' +
            'inputmode="numeric" maxlength="18" value="' + U.escAttr(e.cnpj) + '" ' +
            'placeholder="00.000.000/0000-00"' + ro + '>' +
            '<div class="field__error" id="errCnpj" hidden>CNPJ inválido. Confira os números.</div></div>' +

          '<div class="field"><label class="field__label" for="fRegime">Regime tributário</label>' +
            '<select class="select" id="fRegime" data-emp="regime"' + (trava ? " disabled" : "") + '>' +
              '<option value="">Selecione…</option>' +
              REGIMES.map(function (r) {
                return '<option value="' + U.escAttr(r) + '"' + (e.regime === r ? " selected" : "") + '>' +
                       U.esc(r) + '</option>';
              }).join("") +
            '</select></div>' +
        '</div>' +

        '</div>' +

        '<div id="blocoResponsavel">' +
        '<hr class="hr">' +
        '<h3 style="font-size:14px;font-weight:650;margin-bottom:4px">Responsável pelo contato</h3>' +
        '<p class="text-xs text-muted" style="margin-bottom:14px">Quem a Totali procura quando precisar ' +
          'de alguma informação.</p>' +

        '<div class="grid-2">' +
          '<div class="field"><label class="field__label" for="fRespNome">Nome completo' +
            '<span class="field__req">*</span></label>' +
            '<input type="text" class="input" id="fRespNome" data-emp="responsavelNome" maxlength="120" ' +
            'autocomplete="name" value="' + U.escAttr(e.responsavelNome) + '"></div>' +

          '<div class="field"><label class="field__label" for="fRespCargo">Função na empresa</label>' +
            '<input type="text" class="input" id="fRespCargo" data-emp="responsavelCargo" maxlength="80" ' +
            'value="' + U.escAttr(e.responsavelCargo) + '" placeholder="Sócio, gerente, financeiro…"></div>' +
        '</div>' +

        '<div class="grid-2">' +
          '<div class="field"><label class="field__label" for="fRespEmail">E-mail' +
            '<span class="field__req">*</span></label>' +
            '<input type="email" class="input" id="fRespEmail" data-emp="responsavelEmail" maxlength="120" ' +
            'autocomplete="email" inputmode="email" value="' + U.escAttr(e.responsavelEmail) + '">' +
            '<div class="field__error" id="errEmail" hidden>E-mail inválido.</div></div>' +

          '<div class="field"><label class="field__label" for="fRespTel">Telefone / WhatsApp' +
            '<span class="field__req">*</span></label>' +
            '<input type="tel" class="input" id="fRespTel" data-emp="responsavelTelefone" ' +
            'data-mascara="telefone" inputmode="tel" maxlength="15" ' +
            'value="' + U.escAttr(e.responsavelTelefone) + '" placeholder="(00) 00000-0000"></div>' +
        '</div>' +

        '<div class="notice" style="margin-top:4px">' +
          '<span class="notice__icon">' + ic("ic-check-circle") + '</span>' +
          '<span>As alterações são salvas sozinhas assim que você sai do campo.</span>' +
        '</div>' +
        '</div>' +
      '</div>' +
    '</section>';

    /* Sócios */
    html +=
    '<section class="section" id="blocoSocios">' +
      '<div class="section__head"><div>' +
        '<h2 class="section__title">Sócios</h2>' +
        '<p class="section__desc">Cada sócio cadastrado ganha a própria lista de documentos.</p>' +
      '</div>' +
      '<button type="button" class="btn btn--primary btn--sm" id="btnAddSocio">' +
        ic("ic-plus") + 'Adicionar</button></div>';

    if (!socios.length) {
      html += '<div class="card"><div class="empty">' +
        '<div class="empty__icon">' + ic("ic-users") + '</div>' +
        '<div class="empty__title">Nenhum sócio cadastrado</div>' +
        '<div class="empty__desc">Adicione todos os sócios que constam do contrato social.</div>' +
      '</div></div>';
    } else {
      html += '<div class="card">' + socios.map(function (s, i) {
        var r = { total: 0, ok: 0 };
        var g = DATA.GRUPOS.filter(function (x) { return x.escopo === "socio"; })[0];
        if (g) g.itens.forEach(function (it) {
          var sit = Store.situacao(g, it, s.id);
          if (sit === "na") return;
          r.total++;
          if (Store.resolvida(sit)) r.ok++;
        });
        return '<div class="item">' +
          '<div class="item__top">' +
            '<span class="group__icon" style="width:34px;height:34px;border-radius:10px">' +
              ic("ic-badge") + '</span>' +
            '<div class="item__main">' +
              '<div class="item__name">' + U.esc(s.nome || "Sócio " + (i + 1)) + '</div>' +
              '<div class="item__row">' +
                '<span class="badge ' + (r.total && r.ok === r.total ? "badge--aprovado" : "badge--pendente") + '">' +
                  '<span class="dot"></span>' + r.ok + ' de ' + r.total + ' documentos</span>' +
                (s.cpf ? '<span class="text-xs text-muted">CPF ' + U.esc(s.cpf) + '</span>' : '') +
              '</div>' +
              '<div class="item__actions">' +
                '<button type="button" class="btn btn--ghost btn--sm" data-editar-socio="' +
                  U.escAttr(s.id) + '">Editar</button>' +
                '<button type="button" class="btn btn--quiet btn--sm" data-remover-socio="' +
                  U.escAttr(s.id) + '">Remover</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>';
      }).join("") + '</div>';
    }
    html += '</section>';

    /* Fecho da etapa: enquanto falta algo, diz exatamente o quê;
       quando tudo chega, leva de volta para a trilha. Sem isto a
       tela terminava no vazio e o cliente não sabia o que fazer. */
    html += '<section class="section" id="blocoEtapa">' + blocoEtapaEmpresa() + '</section>';

    return html + rodape();
  }

  /* Campos obrigatórios da etapa "cadastro", na mesma ordem em que
     aparecem na tela. É a mesma conta que a trilha do início faz. */
  var OBRIGATORIOS_EMPRESA = [
    { campo: "razaoSocial", nome: "a razão social" },
    { campo: "cnpj", nome: "o CNPJ" },
    { campo: "responsavelNome", nome: "o nome do responsável" },
    { campo: "responsavelEmail", nome: "o e-mail do responsável" },
    { campo: "responsavelTelefone", nome: "o telefone do responsável" }
  ];

  function camposFaltando() {
    var e = Store.estado.empresa;
    return OBRIGATORIOS_EMPRESA.filter(function (o) {
      return !String(e[o.campo] || "").trim();
    }).map(function (o) { return o.nome; });
  }

  /* Sócio faz parte da etapa, não é extra: é o cadastro do sócio
     que cria a lista de documentos dele. Fechar a etapa sem
     nenhum deixaria o cliente achando que entregou tudo. */
  function faltamSocios() {
    return Store.estado.socios.length === 0;
  }

  function faltamNoCadastro() {
    var lista = camposFaltando();
    if (faltamSocios()) lista.push("socios");
    return lista;
  }

  function listaEmTexto(itens) {
    if (itens.length === 1) return itens[0];
    return itens.slice(0, -1).join(", ") + " e " + itens[itens.length - 1];
  }

  function blocoEtapaEmpresa() {
    var campos = camposFaltando();
    var semSocio = faltamSocios();

    if (campos.length || semSocio) {
      var texto;
      if (campos.length && semSocio) {
        texto = "Preencha " + listaEmTexto(campos) + ". Depois, cadastre pelo menos um sócio — " +
                "é o cadastro do sócio que cria a lista de documentos dele.";
      } else if (campos.length) {
        texto = "Para concluir esta etapa, preencha " + listaEmTexto(campos) + ".";
      } else {
        texto = "Falta cadastrar os sócios. Adicione todos os que constam do contrato social — " +
                "é o cadastro do sócio que cria a lista de documentos dele.";
      }
      return '<div class="feito feito--falta">' +
        '<span class="feito__icone feito__icone--falta">' + ic("ic-info") + '</span>' +
        '<span class="feito__txt">' +
          '<span class="feito__t">Ainda falta um pouco</span>' +
          '<span class="feito__d">' + U.esc(texto) + '</span>' +
          (campos.length ? '' :
            '<span class="feito__acoes">' +
              '<button type="button" class="btn btn--primary" id="btnAddSocioEtapa">' +
                ic("ic-plus") + 'Adicionar sócio</button>' +
            '</span>') +
        '</span>' +
      '</div>';
    }

    return '<div class="feito">' +
      '<span class="feito__icone">' + ic("ic-check-circle") + '</span>' +
      '<span class="feito__txt">' +
        '<span class="feito__t">Etapa concluída: dados da empresa</span>' +
        '<span class="feito__d">Recebemos o cadastro, o contato do responsável e os sócios. ' +
          'O próximo passo é enviar os documentos — a tela de início mostra quais são ' +
          'e por onde começar.</span>' +
        '<span class="feito__acoes">' +
          '<button type="button" class="btn btn--gold" data-rota="inicio">' +
            ic("ic-home") + 'Voltar ao início</button>' +
          '<button type="button" class="btn btn--ghost" data-rota="documentos">' +
            'Ir para os documentos</button>' +
        '</span>' +
      '</span>' +
    '</div>';
  }

  function formSocio(socio) {
    var s = socio || { id: "", nome: "", cpf: "" };
    return '<div class="field"><label class="field__label" for="sNome">Nome completo' +
        '<span class="field__req">*</span></label>' +
        '<input type="text" class="input" id="sNome" maxlength="120" data-focus ' +
        'autocomplete="off" value="' + U.escAttr(s.nome) + '"></div>' +
      '<div class="field"><label class="field__label" for="sCpf">CPF</label>' +
        '<input type="text" class="input" id="sCpf" inputmode="numeric" maxlength="14" ' +
        'autocomplete="off" value="' + U.escAttr(s.cpf) + '" placeholder="000.000.000-00">' +
        '<div class="field__hint">Usamos o CPF apenas para identificar os documentos de cada sócio.</div>' +
        '<div class="field__error" id="errCpf" hidden>CPF inválido. Confira os números.</div></div>';
  }

  function abrirFormSocio(socioId) {
    var socio = socioId
      ? Store.estado.socios.filter(function (s) { return s.id === socioId; })[0]
      : null;

    var m = UI.modal({
      titulo: socio ? "Editar sócio" : "Adicionar sócio",
      corpoHTML: formSocio(socio),
      acoes: [
        { rotulo: "Cancelar", classe: "btn--ghost" },
        {
          rotulo: "Salvar", classe: "btn--primary", fecharAntes: false,
          onClick: function () {
            var caixa = m.caixa;
            var nome = $("#sNome", caixa).value.trim();
            var cpfCampo = $("#sCpf", caixa);
            var cpf = cpfCampo.value.trim();
            var erroCpf = $("#errCpf", caixa);

            if (!nome) { $("#sNome", caixa).focus(); UI.toast("Informe o nome do sócio.", "erro"); return; }
            if (cpf && !U.validaCPF(cpf)) {
              erroCpf.hidden = false;
              cpfCampo.setAttribute("aria-invalid", "true");
              cpfCampo.focus();
              return;
            }
            /* Guardado ANTES da mudança: é a comparação que diz se
               esta foi a ação que fechou a etapa. */
            var faltavam = faltamNoCadastro().length;

            if (socio) {
              Store.commit(function (st) {
                var alvo = st.socios.filter(function (x) { return x.id === socio.id; })[0];
                if (alvo) { alvo.nome = nome; alvo.cpf = cpf; }
              }, "socios");
            } else {
              Store.adicionarSocio(nome, cpf);
            }
            Store.flush();
            UI.fecharModal();
            UI.toast(socio ? "Sócio atualizado." : "Sócio adicionado.", "ok");
            render();
            if (estadoUI.rota === "empresa") conferirEtapaEmpresa(faltavam);
          }
        }
      ]
    });

    var campoCpf = $("#sCpf", m.caixa);
    campoCpf.addEventListener("input", function () {
      campoCpf.value = U.mascaraCPF(campoCpf.value);
      $("#errCpf", m.caixa).hidden = true;
      campoCpf.removeAttribute("aria-invalid");
    });
  }

  /* ============================================================
     Tela: Ajuda
     ============================================================ */
  function viewAjuda() {
    var org = DATA.ORG;
    var html = voltarBoasVindas() +
    '<section class="section">' +
      '<div class="section__head"><div>' +
        '<h1 class="section__title" style="font-size:20px">Estamos por perto</h1>' +
        '<p class="section__desc">Se algo não estiver claro, fale com a gente. ' + U.esc(org.horario) + '.</p>' +
      '</div></div>' +
      '<div class="contact-grid">' +
        '<a class="contact" href="https://wa.me/' + U.escAttr(org.whatsapp) + '" target="_blank" rel="noopener noreferrer">' +
          '<span class="contact__icon">' + ic("ic-phone") + '</span>' +
          '<span class="contact__txt"><span class="contact__lbl">WhatsApp</span>' +
          '<span class="contact__val">' + U.esc(org.telefoneExibicao) + '</span></span></a>' +
        '<a class="contact" href="mailto:' + U.escAttr(org.email) + '">' +
          '<span class="contact__icon">' + ic("ic-mail") + '</span>' +
          '<span class="contact__txt"><span class="contact__lbl">E-mail</span>' +
          '<span class="contact__val" style="font-size:13px">' + U.esc(org.email) + '</span></span></a>' +
        '<a class="contact" href="' + U.escAttr(org.site) + '" target="_blank" rel="noopener noreferrer">' +
          '<span class="contact__icon">' + ic("ic-external") + '</span>' +
          '<span class="contact__txt"><span class="contact__lbl">Site</span>' +
          '<span class="contact__val" style="font-size:13px">totalicontabilidade.com.br</span></span></a>' +
      '</div>' +
    '</section>' +

    /* Onde estamos. O mapa só é carregado se o cliente pedir —
       antes disso o Google não recebe o endereço de IP dele. */
    '<section class="section">' +
      '<div class="section__head"><div>' +
        '<h2 class="section__title">Onde estamos</h2>' +
        '<p class="section__desc">Se preferir resolver pessoalmente, você é bem-vindo.</p>' +
      '</div></div>' +
      '<div class="card">' +
        '<div class="mapa" id="mapaCaixa">' +
          '<div class="mapa__previa">' +
            '<span class="mapa__pino">' + ic("ic-pino") + '</span>' +
            '<span class="mapa__txt">' +
              '<span class="mapa__t">' + U.esc(org.local.nome) + '</span>' +
              '<span class="mapa__d">' +
                (org.local.endereco ? U.esc(org.local.endereco) + '<br>' : '') +
                U.esc(org.local.cidade) +
                (org.local.cep ? ' · CEP ' + U.esc(org.local.cep) : '') + '</span>' +
            '</span>' +
            '<button type="button" class="btn btn--ghost btn--sm" id="btnMapa">Ver o mapa</button>' +
          '</div>' +
        '</div>' +
        '<div style="padding:14px 16px;display:flex;gap:9px;flex-wrap:wrap">' +
          '<a class="btn btn--primary btn--sm" href="' + U.escAttr(org.local.link) + '" ' +
            'target="_blank" rel="noopener noreferrer">' + ic("ic-pino") + 'Abrir no Google Maps</a>' +
          '<a class="btn btn--ghost btn--sm" href="https://www.google.com/maps/dir/?api=1&destination=' +
            U.escAttr(org.local.lat + "," + org.local.lng) + '" target="_blank" rel="noopener noreferrer">' +
            ic("ic-arrow-right") + 'Traçar rota</a>' +
        '</div>' +
      '</div>' +
    '</section>' +

    '<section class="section">' +
      '<div class="section__head"><div>' +
        '<h2 class="section__title">Perguntas frequentes</h2>' +
      '</div></div>' +
      DATA.FAQ.map(function (f, i) {
        var aberta = !!estadoUI.faqAberta[i];
        return '<div class="card faq" data-open="' + (aberta ? "true" : "false") + '" style="margin-bottom:9px">' +
          '<button type="button" class="faq__q" data-faq="' + i + '" aria-expanded="' + aberta + '">' +
            '<span style="flex:1">' + U.esc(f.q) + '</span>' + ic("ic-chevron-down") +
          '</button>' +
          (aberta ? '<div class="faq__a">' + U.esc(f.a) + '</div>' : '') +
        '</div>';
      }).join("") +
    '</section>' +

    '<section class="section">' +
      '<div class="card card--pad">' +
        '<h2 class="section__title" style="font-size:15px">Privacidade e segurança</h2>' +
        '<p class="section__desc" style="margin-bottom:14px">Entenda como tratamos seus dados, ' +
          'onde eles ficam guardados e como suas senhas são protegidas.</p>' +
        '<button type="button" class="btn btn--ghost btn--sm" data-rota="privacidade">' +
          ic("ic-shield") + 'Abrir política</button>' +
      '</div>' +
    '</section>' + rodape();

    return html;
  }

  /* ============================================================
     Tela: Privacidade
     ============================================================ */
  function viewPrivacidade() {
    var org = DATA.ORG;
    var usado = Store.bytesUsados();
    return voltarBoasVindas() +
    '<section class="section">' +
      '<div class="section__head"><div>' +
        '<div class="eyebrow">Transparência</div>' +
        '<h1 class="section__title" style="font-size:20px;margin-top:4px">Privacidade e segurança</h1>' +
      '</div></div>' +

      '<div class="card card--pad stack">' +
        '<div class="notice notice--ok">' +
          '<span class="notice__icon">' + ic("ic-shield") + '</span>' +
          (Store.noServidor
            ? '<span><strong>Onde estão seus documentos.</strong> Tudo o que você envia vai para o ' +
              'servidor da ' + U.esc(org.curto) + ', ligado exclusivamente à sua empresa, por ' +
              'conexão protegida. Só quem tem o seu login, ou a nossa equipe, enxerga esses ' +
              'arquivos. Uma cópia fica também neste aparelho, para o portal abrir rápido e ' +
              'funcionar sem sinal — sair da conta apaga essa cópia.</span>'
            : '<span><strong>Onde estão seus documentos agora.</strong> Esta sessão está sem ' +
              'conexão com o servidor. Tudo o que você anexa fica guardado apenas neste aparelho, ' +
              'no armazenamento do próprio navegador, até a conexão voltar.</span>') +
        '</div>' +

        '<div class="help-block"><div class="help-block__t">Como protegemos suas senhas</div>' +
          '<div class="help-block__c">As senhas que você informa no portal são embaralhadas dentro ' +
          'do seu próprio aparelho, antes de saírem dele. O portal carrega apenas a chave que ' +
          'tranca; a que abre fica com a ' + U.esc(org.curto) + ', guardada fora do sistema. ' +
          'Por isso, nem neste aparelho, nem no nosso banco de dados, nem em cópia de segurança a ' +
          'senha existe de forma legível — só a nossa equipe consegue abrir.<br><br>' +
          'Usamos esses acessos apenas para emitir e transmitir o que a sua empresa precisa entregar, ' +
          'baixar relatórios de venda e consultar a situação fiscal. <strong>Nunca movimentamos ' +
          'dinheiro e nunca pedimos a senha do seu banco.</strong><br><br>' +
          'Se preferir não digitar senha nenhuma, os itens de acesso oferecem alternativas: ' +
          'procuração eletrônica no e-CAC, com passo a passo dentro do portal, ou avisar que a ' +
          U.esc(org.curto) + ' já tem acesso.</div></div>' +

        '<div class="help-block"><div class="help-block__t">Você pode apagar quando quiser</div>' +
          '<div class="help-block__c">Cada acesso guardado tem os botões <strong>Substituir</strong> ' +
          'e <strong>Apagar</strong> na própria tela do documento. Trocou a senha no sistema? ' +
          'Substitua aqui. Não quer mais deixar o acesso conosco? Apague e avise a equipe.</div></div>' +

        '<div class="help-block"><div class="help-block__t">Para que usamos seus dados</div>' +
          '<div class="help-block__c">Exclusivamente para prestar os serviços contábeis, fiscais e ' +
          'trabalhistas contratados e para cumprir as obrigações legais que recaem sobre a sua empresa. ' +
          'Não vendemos, não compartilhamos com terceiros para fins comerciais e não usamos seus ' +
          'documentos para nenhuma outra finalidade.</div></div>' +

        '<div class="help-block"><div class="help-block__t">Seus direitos</div>' +
          '<ul class="help-list">' +
            '<li>Saber quais dados seus nós tratamos.</li>' +
            '<li>Corrigir informações incompletas ou desatualizadas.</li>' +
            '<li>Pedir a exclusão dos dados que não somos obrigados a guardar por lei.</li>' +
            '<li>Revogar o consentimento, ciente de que isso pode impedir a prestação do serviço.</li>' +
          '</ul>' +
          '<div class="help-block__c" style="margin-top:8px">Para exercer qualquer um deles, escreva ' +
          'para <a href="mailto:' + U.escAttr(org.email) + '">' + U.esc(org.email) + '</a>.</div></div>' +

        '<div class="help-block"><div class="help-block__t">Cuidado com o aparelho compartilhado</div>' +
          '<div class="help-block__c">Se você estiver usando um computador de uso comum, saia do ' +
          'portal e feche o navegador ao terminar. Em caso de dúvida, fale com a gente.</div></div>' +
      '</div>' +
    '</section>' +

    /* O cliente não apaga os próprios dados: documento de migração
       some por engano é um estrago que ninguém desfaz. O direito da
       LGPD continua garantido — a exclusão é feita pela equipe,
       mediante pedido. */
    '<section class="section">' +
      '<div class="card card--pad">' +
        '<h2 class="section__title" style="font-size:15px">Quer apagar seus dados?</h2>' +
        '<p class="section__desc" style="margin-bottom:14px">É um direito seu. Peça pelas ' +
          'Mensagens ou escreva para <a href="mailto:' + U.escAttr(org.email) + '">' +
          U.esc(org.email) + '</a>. Nossa equipe cuida da exclusão e confirma quando estiver ' +
          'feito.<br><br>Fazemos assim, e não com um botão aqui, para que um toque acidental não ' +
          'apague documentos que você levou dias reunindo. Guardamos apenas o que a lei exige ' +
          'que a contabilidade mantenha.' +
          (usado ? '<br><br>Neste aparelho há ' + U.esc(U.bytes(usado)) + ' de arquivos seus.' : '') +
        '</p>' +
        '<button type="button" class="btn btn--ghost" data-rota="mensagens">' +
          ic("ic-chat") + 'Pedir pelas Mensagens</button>' +
      '</div>' +
    '</section>' + rodape();
  }

  /* Enquanto o cliente não aceitou os termos, as telas livres
     precisam de um caminho de volta — o menu está bloqueado. */
  function voltarBoasVindas() {
    /* Na tela de entrada quem desenha o botão de volta é o
       render, com o texto certo para aquele contexto. Aqui sairia
       um segundo botão dizendo só "Voltar". */
    if (porta.modo) return "";
    if (Store.estado.aceiteLGPD) return "";
    return '<div style="margin-bottom:14px">' +
      '<button type="button" class="btn btn--ghost btn--sm" data-rota="boas-vindas">' +
        ic("ic-chevron-right", "gira180") + 'Voltar</button></div>';
  }

  /* Volta da política ou da ajuda para a tela de login.

     Serve qualquer rota que NÃO esteja liberada durante a porta:
     o render vê o modo porta ligado e desenha o formulário de
     entrada de novo. "inicio" é a mais óbvia de ler no código. */
  function voltarParaEntradaHTML() {
    return '<div style="margin-bottom:14px">' +
      '<button type="button" class="btn btn--ghost btn--sm" data-rota="inicio">' +
        ic("ic-chevron-right", "gira180") + 'Voltar para a entrada</button></div>';
  }

  /* ---------- Rodapé ---------- */
  function rodape() {
    return '<footer class="foot">' +
      '<strong>' + U.esc(DATA.ORG.nome) + '</strong><br>' +
      U.esc(DATA.ORG.telefoneExibicao) + ' · ' + U.esc(DATA.ORG.email) + '<br>' +
      '<a href="#/privacidade" data-rota="privacidade">Privacidade e segurança</a>' +
    '</footer>';
  }

  /* ============================================================
     Tutoriais guiados

     Texto curto, uma ideia por passo, sem palavra de informática.
     A pessoa do outro lado pode nunca ter usado um portal na
     vida — e não deveria precisar aprender nada além de "leia
     isto e toque ali".
     ============================================================ */
  var TUTORIAIS = {
    empresa: [
      { alvo: null,
        titulo: "Vamos preencher juntos",
        texto: "Esta tela tem três partes: conferir os dados da empresa, dizer quem conversa " +
               "com a gente e cadastrar os sócios. Vou mostrar uma de cada vez." },
      { alvo: "#blocoEmpresa",
        titulo: "1. Confira o que já veio pronto",
        texto: "A Totali preencheu a razão social e o CNPJ para você. Aqui é só conferir. " +
               "Se encontrar algum erro, avise pelas Mensagens que a gente corrige." },
      { alvo: "#blocoResponsavel",
        titulo: "2. Quem fala com a gente",
        texto: "Escreva o nome completo de quem cuida disso na empresa — pode ser você mesmo. " +
               "Depois o e-mail e o telefone com WhatsApp. É por esses contatos que a Totali " +
               "procura você." },
      { alvo: "#blocoSocios",
        titulo: "3. Cadastre os sócios",
        texto: "Toque em Adicionar e escreva o nome de um sócio do contrato social. Repita para " +
               "cada um. Este passo é necessário: é o cadastro do sócio que cria a lista de " +
               "documentos dele." },
      { alvo: "#blocoEtapa",
        titulo: "Não existe botão de salvar",
        texto: "Cada campo é guardado sozinho assim que você sai dele. Este quadro mostra o que " +
               "ainda falta e, quando estiver tudo certo, te leva para o próximo passo." }
    ],

    inicio: [
      { alvo: null,
        titulo: "Este é o seu portal",
        texto: "Em menos de um minuto eu mostro onde fica cada coisa. Se quiser rever depois, " +
               "o botão \"Ver o tutorial\" fica logo abaixo, na parte das etapas." },
      { alvo: "#blocoVideo",
        titulo: "Comece pelo vídeo",
        texto: "Toque na imagem para assistir. Em poucos minutos a gente explica como funciona a " +
               "sua migração para a Totali." },
      { alvo: "#blocoResumo",
        titulo: "Quanto já foi entregue",
        texto: "Este círculo mostra a porcentagem do que você já enviou. Os números ao lado " +
               "contam quantos documentos chegaram e quantos ainda faltam." },
      { alvo: "#blocoPendentes",
        titulo: "O que falta enviar",
        texto: "Estes são os documentos mais importantes que ainda não chegaram. Toque em um " +
               "deles para ir direto ao ponto de enviar — pode ser foto pelo celular." },
      { alvo: "#blocoTrilha",
        titulo: "Onde você está",
        texto: "A migração acontece por etapas. A que está acesa é a sua vez; as concluídas " +
               "ficam com um visto. Pode tocar em qualquer etapa liberada." },
      { alvo: ".tabbar",
        titulo: "O menu fica aqui embaixo",
        texto: "Por esta barra você vai para os documentos, para as mensagens com a nossa equipe " +
               "e para os vídeos do Academy." },
      { alvo: ".sidenav",
        titulo: "O menu fica aqui do lado",
        texto: "Por este menu você vai para os documentos, para as mensagens com a nossa equipe " +
               "e para os vídeos do Academy." }
    ]
  };

  function abrirTutorial(nome) {
    var passos = TUTORIAIS[nome];
    if (!passos || !global.Tour) return;
    global.Tour.iniciar({
      passos: passos,
      /* Vale como visto mesmo se a pessoa sair no meio: quem já
         entendeu não precisa ser interrompido de novo. E quem
         quiser rever tem o botão. */
      aoFim: function () {
        if (Store.marcarTutorial(nome)) Store.flush();
      }
    });
  }

  /* Primeira vez naquela tela: o tutorial abre sozinho. Depois,
     só quando a pessoa pedir. */
  function talvezTutorial(rota) {
    if (!global.Tour || global.Tour.aberto) return;
    if (!Store.estado.aceiteLGPD) return;
    if (rota !== "inicio" && rota !== "empresa") return;
    if (Store.tutorialVisto(rota)) return;
    setTimeout(function () {
      /* Entre o pedido e a hora de abrir, a pessoa pode ter
         mudado de tela. */
      if (estadoUI.rota === rota && !Store.tutorialVisto(rota)) abrirTutorial(rota);
    }, 500);
  }

  function botaoTutorial(nome, rotulo) {
    return '<button type="button" class="btn btn--ghost btn--sm" data-tutorial="' +
      U.escAttr(nome) + '">' + ic("ic-bussola") + U.esc(rotulo || "Ver o tutorial") + '</button>';
  }

  /* ============================================================
     Sair da conta
     ============================================================ */
  function sairDaConta() {
    UI.confirmar({
      titulo: "Sair da conta",
      mensagem: "Tudo o que você já enviou fica guardado com a Totali. Para voltar, é só entrar " +
                "com o mesmo e-mail e senha — deste ou de qualquer outro aparelho.",
      confirmar: "Sair"
    }).then(function (ok) {
      if (!ok) return;
      var FB = global.FB;
      esquecerEmpresa();
      empresasDaConta = [];
      /* Grava o que estiver pendente ANTES de encerrar a sessão:
         depois do logout o servidor não aceita mais escrita. Sem
         internet a gravação fica pendurada, então esperamos no
         máximo alguns segundos — sair não pode travar. */
      Promise.race([
        Promise.resolve(Store.flush()),
        new Promise(function (r) { setTimeout(r, 4000); })
      ]).then(function () {
        return FB && FB.ligado ? FB.sair().catch(function () {}) : null;
      }).then(function () {
        /* Limpa a cópia deste aparelho. O próximo a usar este
           computador não pode ver nada da empresa anterior. */
        return Store.sairDaConta();
      }).then(function () {
        porta.modo = "login";
        porta.codigo = "";
        porta.empresaNome = "";
        if (location.hash !== "#/inicio") location.hash = "#/inicio";
        else render();
        UI.toast("Você saiu da sua conta.", "ok");
      });
    });
  }

  /* ============================================================
     Render
     ============================================================ */
  /* Telas acessíveis antes do aceite: o cliente sempre pode ler a
     política e pedir ajuda sem ter concordado com nada. */
  var ROTAS_LIVRES = ["boas-vindas", "privacidade", "ajuda"];

  function render() {
    var rota = rotaDaURL();

    if (!Store.estado.aceiteLGPD && ROTAS_LIVRES.indexOf(rota) === -1) rota = "boas-vindas";
    estadoUI.rota = rota;

    var alvo = $("#view");
    var html;

    /* Cadastro ou login pendente vence qualquer rota — com duas
       exceções.

       Antes não havia exceção nenhuma, e isso quebrava o link
       "Privacidade e segurança" do rodapé da tela de entrada: o
       clique trocava o endereço, o desenho recomeçava, o modo
       porta continuava ligado e a mesma tela de login aparecia de
       novo. Para quem clicava, o link simplesmente não fazia
       nada.

       Política de privacidade e ajuda são justamente o que
       alguém precisa ler ANTES de entrar, ou quando não consegue
       entrar. Elas abrem, com um botão de voltar para a entrada.
       Qualquer outra rota continua caindo na porta. */
    if (porta.modo) {
      document.body.classList.add("porta-aberta");

      var livreNaPorta = rota === "privacidade" || rota === "ajuda";
      alvo.className = "view";

      if (livreNaPorta) {
        alvo.innerHTML = voltarParaEntradaHTML() +
                         (rota === "privacidade" ? viewPrivacidade() : viewAjuda());
      } else {
        alvo.innerHTML = portaHTML();
      }

      $$("#view > *").forEach(function (n) { n.classList.add("reveal"); });
      if (global.Motion) global.Motion.aplicar(alvo);

      document.title = (livreNaPorta
        ? (rota === "privacidade" ? "Privacidade e segurança" : "Ajuda")
        : (porta.modo === "cadastro" ? "Criar acesso" : "Entrar")) +
        " · Portal do Cliente · " + DATA.ORG.curto;

      atualizarCabecalho();
      atualizarNav("");
      if (livreNaPorta) {
        if (rota === "ajuda") bindAjuda();
        if (rota === "privacidade") bindPrivacidade();
      } else {
        bindPorta();
      }
      return;
    }
    document.body.classList.remove("porta-aberta");

    switch (rota) {
      case "boas-vindas": html = viewBoasVindas(); break;
      case "documentos":  html = viewDocumentos(); break;
      case "financeiro":  html = viewFinanceiro(); break;
      case "mensagens":   html = viewMensagens(); break;
      case "academy":     html = viewAcademy(); break;
      case "empresa":     html = viewEmpresa(); break;
      case "ajuda":       html = viewAjuda(); break;
      case "privacidade": html = viewPrivacidade(); break;
      default:            html = viewInicio();
    }
    alvo.className = "view";
    alvo.innerHTML = html;

    /* Cada bloco de primeiro nível entra com fade e leve subida;
       os cartões da Academy entram em cascata. */
    $$("#view > *").forEach(function (n) { n.classList.add("reveal"); });
    $$("#view .tile").forEach(function (n) { n.classList.add("reveal"); });
    if (global.Motion) global.Motion.aplicar(alvo);

    var meta = ROTAS.filter(function (r) { return r.id === rota; })[0];
    document.title = (meta ? meta.titulo + " · " : "") + "Portal do Cliente · " + DATA.ORG.curto;

    atualizarCabecalho();
    atualizarNav(rota);
    ligarCredenciais();
    if (rota === "documentos") irAteODocumento();
    if (rota === "boas-vindas") bindBoasVindas();
    if (rota === "empresa") bindEmpresa();
    if (rota === "financeiro") bindFinanceiro();
    if (rota === "mensagens") bindMensagens();
    if (rota === "ajuda") bindAjuda();
    if (rota === "privacidade") bindPrivacidade();
    talvezTutorial(rota);
  }

  /* Rola até o documento pedido e o pisca uma vez.

     A lista tem 26 itens em cinco grupos; abrir o grupo certo não
     basta, porque o item pode estar fora da tela. O destaque some
     sozinho: serve para o olho encontrar, não para virar mais uma
     marcação permanente na tela. */
  function irAteODocumento() {
    var chave = estadoUI.destacar;
    estadoUI.destacar = "";
    if (!chave) return;

    /* Procura comparando o atributo em vez de montar um seletor
       com a chave dentro: chave é dado, e dado dentro de seletor
       é a mesma classe de erro que dado dentro de HTML. */
    var no = null;
    $$("[data-chave]").some(function (n) {
      if (n.getAttribute("data-chave") !== chave) return false;
      no = n;
      return true;
    });
    if (!no) return;

    /* Espera o desenho assentar; senão a posição calculada é a de
       antes das animações de entrada. */
    setTimeout(function () {
      try { no.scrollIntoView({ behavior: "smooth", block: "center" }); }
      catch (e) { no.scrollIntoView(); }
      no.classList.add("item--alvo");
      setTimeout(function () { no.classList.remove("item--alvo"); }, 2800);
    }, 60);
  }

  /* O cabeçalho mostra a empresa do cliente assim que ela é
     conhecida. Antes disso, mantém o nome do portal. */
  function atualizarCabecalho() {
    var e = Store.estado.empresa;
    var nome = (e.nomeFantasia || e.razaoSocial || "").trim();
    var titulo = $("#brandTitulo"), sub = $("#brandSub");
    if (!titulo || !sub) return;
    if (nome) {
      titulo.textContent = nome;
      titulo.title = e.razaoSocial || nome;
      sub.textContent = "Portal do Cliente";
    } else {
      titulo.textContent = "Portal do Cliente";
      titulo.removeAttribute("title");
      sub.textContent = "Onboarding";
    }
  }

  /* Identidade da conta no cabeçalho. O nome da empresa já está
     na marca; aqui aparece a PESSOA que entrou — é o que evita
     alguém mexer no portal achando que está na própria conta,
     num computador compartilhado. */
  function atualizarConta(temSessao) {
    var caixa = $("#ctQuem");
    if (!caixa) return;
    var FB = global.FB;
    var u = FB && FB.auth && FB.auth.currentUser;
    var email = (u && u.email) || "";
    if (!temSessao || !email) { caixa.hidden = true; return; }

    var apelido = email.split("@")[0];
    caixa.hidden = false;
    caixa.title = email;
    $("#ctNome").textContent = apelido;
    $("#ctIniciais").textContent = apelido.slice(0, 2).toUpperCase();
  }

  function atualizarNav(rota) {
    var resumo = Store.resumoGeral();
    var gate = !Store.estado.aceiteLGPD;

    /* Sair só faz sentido com sessão de verdade. Sem servidor não
       há de onde sair, e o botão só confundiria. */
    var temSessao = Store.noServidor && !porta.modo;
    [$("#btnSair"), $("#btnSairMenu")].forEach(function (b) {
      if (b) b.hidden = !temSessao;
    });

    atualizarConta(temSessao);

    /* O seletor só existe para quem tem mais de uma empresa. */
    var btnEmp = $("#btnEmpresas");
    if (btnEmp) btnEmp.hidden = !(temSessao && empresasDaConta.length > 1);

    $$("[data-nav]").forEach(function (b) {
      var id = b.getAttribute("data-nav");
      if (id === rota) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
      /* A logo do cabeçalho é atalho para o início e nunca fica
         apagada — ela precisa parecer sempre viva. */
      if (b.classList.contains("brand")) return;
      var bloqueado = gate && ROTAS_LIVRES.indexOf(id) === -1;
      b.toggleAttribute("disabled", bloqueado);
      b.style.opacity = bloqueado ? ".45" : "";
    });

    $$("[data-badge-pendentes]").forEach(function (n) {
      var v = resumo.pendentes;
      if (v > 0 && !gate) { n.hidden = false; n.textContent = v > 99 ? "99+" : String(v); }
      else n.hidden = true;
    });

    $$("[data-badge-mensagens]").forEach(function (n) {
      var v = Store.naoLidas("cliente");
      if (v > 0 && !gate) { n.hidden = false; n.textContent = v > 99 ? "99+" : String(v); }
      else n.hidden = true;
    });
  }

  /* ============================================================
     Eventos
     ============================================================ */
  var inputArquivo = null;
  var inputFoto = null;
  var chaveDestino = null;

  function iniciarUploadInput(chave) {
    chaveDestino = chave;
    inputArquivo.value = "";
    inputArquivo.click();
  }

  /* Caminho da câmera.

     RG, CNH e comprovante de endereço quase nunca existem em
     arquivo — existem em papel, na mão da pessoa. Mandando pelo
     seletor de arquivos, ela precisa sair do portal, abrir a
     câmera, tirar a foto, voltar e procurar a imagem na galeria.
     Com `capture`, o celular abre a câmera direto e volta com a
     foto. É um toque em vez de cinco. */
  function iniciarFotoInput(chave) {
    chaveDestino = chave;
    inputFoto.value = "";
    inputFoto.click();
  }

  /* Só oferece a câmera onde existe câmera de verdade. Num
     computador de mesa o botão abriria o mesmo seletor de
     arquivos e só duplicaria a escolha. */
  function temCamera() {
    try {
      return (navigator.maxTouchPoints || 0) > 0 &&
             global.matchMedia("(pointer: coarse)").matches;
    } catch (e) { return false; }
  }

  /* ============================================================
     Conferir antes de enviar

     Foto tremida, cortada ou do documento errado é o motivo nº 1
     de devolução — e a devolução custa dias: a equipe confere,
     escreve o motivo, o cliente volta ao portal, refotografa. Ver
     a imagem antes de enviar corta esse ciclo inteiro no ponto
     mais barato.

     Só vale para imagem. PDF e planilha não têm o que conferir de
     olho, e uma janela a mais neles seria só um clique extra.
     ============================================================ */
  function ehImagem(f) {
    return /^image\//.test(f.type || "");
  }

  function conferirAntes(arquivos) {
    var imagens = arquivos.filter(ehImagem);
    if (!imagens.length) return Promise.resolve(true);

    var urls = imagens.map(function (f) { return URL.createObjectURL(f); });
    var soltar = function () {
      urls.forEach(function (u) { try { URL.revokeObjectURL(u); } catch (e) {} });
    };

    return new Promise(function (resolve) {
      UI.modal({
        titulo: imagens.length === 1 ? "Confira a foto antes de enviar"
                                     : "Confira as " + imagens.length + " fotos",
        corpoHTML:
          '<p style="font-size:13.5px;line-height:1.6;color:var(--txt-2);margin-bottom:12px">' +
            'Dá para ler tudo? As quatro bordas do documento aparecem? Se estiver tremida ou ' +
            'cortada, é melhor tirar de novo agora do que receber de volta depois.</p>' +
          '<div class="previas">' +
            urls.map(function (u, i) {
              return '<figure class="previa">' +
                '<img src="' + u + '" alt="Prévia de ' + U.escAttr(imagens[i].name) + '">' +
                '<figcaption>' + U.esc(U.nomeSeguro(imagens[i].name)) + ' · ' +
                  U.esc(U.bytes(imagens[i].size)) + '</figcaption>' +
              '</figure>';
            }).join("") +
          '</div>',
        acoes: [
          { rotulo: "Tirar de novo", classe: "btn--ghost",
            onClick: function () { soltar(); resolve(false); } },
          { rotulo: "Está boa, enviar", classe: "btn--primary",
            onClick: function () { soltar(); resolve(true); } }
        ]
      });
    });
  }

  function receberArquivos(chave, lista) {
    var arquivos = Array.prototype.slice.call(lista || []);
    if (!arquivos.length) return;

    conferirAntes(arquivos).then(function (segue) {
      if (segue) enviarArquivos(chave, arquivos);
    });
  }

  function enviarArquivos(chave, arquivos) {
    var usado = Store.bytesUsados();
    var fila = Promise.resolve();
    var enviados = 0, erros = 0;

    /* Barra de progresso real, no lugar do aviso genérico. Em 4G
       ruim, um PDF de 15 MB parecia travamento — e travamento faz
       a pessoa tocar de novo e mandar o mesmo documento duas
       vezes. */
    var barra = Store.noServidor ? UI.progresso("Enviando documento") : null;

    arquivos.forEach(function (f, i) {
      fila = fila.then(function () {
        var erro = U.validaArquivo(f, usado);
        if (erro) {
          erros++;
          UI.toast(U.nomeSeguro(f.name) + ": " + erro, "erro");
          return null;
        }
        usado += f.size;

        if (barra) {
          barra.titulo(arquivos.length > 1
            ? "Enviando " + (i + 1) + " de " + arquivos.length + " · " + U.nomeSeguro(f.name)
            : "Enviando " + U.nomeSeguro(f.name));
          barra.pct(0);
        }

        return Store.anexar(chave, f, barra ? barra.pct : null)
          .then(function () { enviados++; }, function () {
            erros++;
            UI.toast("Não foi possível salvar " + U.nomeSeguro(f.name) + ".", "erro");
          });
      });
    });

    fila.then(function () {
      if (barra) barra.fechar();
      if (enviados) {
        Store.flush();
        UI.toast(enviados + " " + U.plural(enviados, "arquivo anexado", "arquivos anexados") + ".", "ok");
      }
      if (enviados || erros) render();
    });
  }

  /* Abrir um arquivo tem dois caminhos.

     Se os bytes estiverem aqui — porque foi este aparelho que
     enviou, ou porque o download direto está liberado — abrimos do
     próprio aparelho, já com o nome certo.

     Se não, abrimos pelo endereço do servidor, em outra aba. É o
     que faz o cliente conseguir rever, do celular, o documento que
     mandou do computador. */
  function abrirArquivo(id, nome, tipo) {
    Store.baixarArquivo(id, tipo).then(function (blob) {
      if (blob) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = U.nomeSeguro(nome || "documento");
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
        return null;
      }
      return Store.urlArquivo(id, tipo).then(function (endereco) {
        if (!endereco) {
          UI.toast("Não foi possível abrir este arquivo. Verifique a conexão.", "erro");
          return;
        }
        var b = document.createElement("a");
        b.href = endereco;
        b.target = "_blank";
        b.rel = "noopener noreferrer";
        document.body.appendChild(b);
        b.click();
        document.body.removeChild(b);
      });
    }, function () {
      UI.toast("Não foi possível abrir o arquivo.", "erro");
    });
  }

  function contextoItem(no) {
    var caixaItem = no.closest("[data-chave]");
    var caixaGrupo = no.closest("[data-grupo]");
    if (!caixaItem || !caixaGrupo) return null;
    var chave = caixaItem.getAttribute("data-chave");
    var partes = chave.split("/");
    var grupo = DATA.GRUPOS.filter(function (g) { return g.id === partes[0]; })[0];
    if (!grupo) return null;
    var itemId = partes[partes.length - 1];
    var item = grupo.itens.filter(function (i) { return i.id === itemId; })[0];
    if (!item) return null;
    return { chave: chave, grupo: grupo, item: item };
  }

  function ligarEventosGlobais() {
    /* Navegação por atributo data-rota (funciona em botões e links). */
    document.addEventListener("click", function (ev) {
      if (ev.target.closest("#btnSair") || ev.target.closest("#btnSairMenu")) {
        sairDaConta();
        return;
      }

      if (ev.target.closest("#btnEmpresas")) { abrirSeletorEmpresas(); return; }

      var trocar = ev.target.closest("[data-trocar-empresa]");
      if (trocar && !trocar.disabled) {
        trocarEmpresa(trocar.getAttribute("data-trocar-empresa"));
        return;
      }

      var prazo = ev.target.closest("[data-prazo]");
      if (prazo) {
        escolherPrazo(prazo.getAttribute("data-prazo-chave"), prazo.getAttribute("data-prazo"));
        return;
      }

      var verTutorial = ev.target.closest("[data-tutorial]");
      if (verTutorial) {
        abrirTutorial(verTutorial.getAttribute("data-tutorial"));
        return;
      }

      var navBtn = ev.target.closest("[data-nav]");
      if (navBtn && !navBtn.disabled) {
        ev.preventDefault();
        navegar(navBtn.getAttribute("data-nav"));
        return;
      }

      var rotaBtn = ev.target.closest("[data-rota]");
      if (rotaBtn) {
        ev.preventDefault();
        var grupoAlvo = rotaBtn.getAttribute("data-grupo");
        if (grupoAlvo) estadoUI.gruposAbertos[grupoAlvo] = true;
        estadoUI.destacar = rotaBtn.getAttribute("data-alvo") || "";
        navegar(rotaBtn.getAttribute("data-rota"));
        return;
      }

      /* --- Documentos --- */
      var toggle = ev.target.closest("[data-toggle]");
      if (toggle) {
        var g = toggle.closest("[data-grupo]").getAttribute("data-grupo");
        estadoUI.gruposAbertos[g] = !estadoUI.gruposAbertos[g];
        render();
        return;
      }

      var ajuda = ev.target.closest("[data-ajuda]");
      if (ajuda) {
        var p = ajuda.getAttribute("data-ajuda").split("|");
        abrirAjudaItem(p[0], p[1]);
        return;
      }

      var foto = ev.target.closest("[data-foto]");
      if (foto) {
        var cxf = contextoItem(foto);
        if (cxf) iniciarFotoInput(cxf.chave);
        return;
      }

      var enviar = ev.target.closest("[data-enviar]");
      if (enviar) {
        var cx = contextoItem(enviar);
        if (cx) iniciarUploadInput(cx.chave);
        return;
      }

      var baixar = ev.target.closest("[data-baixar]");
      if (baixar) {
        var cxb = contextoItem(baixar);
        var idb = baixar.getAttribute("data-baixar");
        var meta = cxb && (Store.estado.itens[cxb.chave] || {}).arquivos || [];
        var achou = meta.filter(function (a) { return a.id === idb; })[0];
        abrirArquivo(idb, achou ? achou.nome : "documento");
        return;
      }

      /* Anexo de mensagem: abre a imagem ou baixa o arquivo. */
      var anexo = ev.target.closest("[data-anexo]");
      if (anexo && anexo.tagName === "BUTTON") {
        abrirArquivo(anexo.getAttribute("data-anexo"), anexo.getAttribute("data-nome"), "mensagem");
        return;
      }

      var remover = ev.target.closest("[data-remover]");
      if (remover) {
        var cxr = contextoItem(remover);
        if (!cxr) return;
        UI.confirmar({
          titulo: "Remover arquivo",
          mensagem: "O arquivo será removido do portal. Você poderá enviar outro no lugar.",
          confirmar: "Remover", perigo: true
        }).then(function (ok) {
          if (!ok) return;
          Store.removerArquivo(cxr.chave, remover.getAttribute("data-remover")).then(function () {
            Store.flush(); render();
          });
        });
        return;
      }

      var na = ev.target.closest("[data-na]");
      if (na) {
        var cxn = contextoItem(na);
        if (!cxn) return;
        Store.commit(function () {
          var r = Store.item(cxn.chave);
          r.na = true; r.atualizadoEm = Date.now();
        }, "na");
        Store.registrarEvento("item:naoSeAplica", cxn.chave, cxn.item.nome);
        Store.flush(); render();
        return;
      }

      var lembrar = ev.target.closest("[data-lembrar]");
      if (lembrar) {
        var cxl = contextoItem(lembrar);
        if (!cxl) return;
        if (lembrar.getAttribute("data-lembrar") === "limpar") limparLembrete(cxl.chave);
        else pedirLembrete(cxl.chave, cxl.item.nome);
        return;
      }

      var reativar = ev.target.closest("[data-reativar]");
      if (reativar) {
        var cxa = contextoItem(reativar);
        if (!cxa) return;
        Store.commit(function () {
          var r = Store.item(cxa.chave);
          r.na = false; r.atualizadoEm = Date.now();
        }, "na");
        Store.flush(); render();
        return;
      }

      var forma = ev.target.closest("[data-forma]");
      if (forma) {
        var cxf = contextoItem(forma);
        if (!cxf) return;
        var valor = forma.getAttribute("data-forma");
        Store.commit(function () {
          var r = Store.item(cxf.chave);
          r.forma = (r.forma === valor) ? "" : valor;
          r.na = false;
          r.atualizadoEm = Date.now();
          r.revisao = { status: "", motivo: "", por: "", em: 0 };
        }, "acesso");
        Store.registrarEvento("acesso:forma", cxf.chave, valor);
        Store.flush(); render();
        if (valor === "procuracao") {
          UI.toast("Combinado. Nossa equipe entra em contato para orientar a procuração.", "ok");
        }
        return;
      }

      /* --- Sócios --- */
      if (ev.target.closest("#btnAddSocio") || ev.target.closest("#btnAddSocioEtapa")) {
        abrirFormSocio(null);
        return;
      }

      var editar = ev.target.closest("[data-editar-socio]");
      if (editar) { abrirFormSocio(editar.getAttribute("data-editar-socio")); return; }

      var remSocio = ev.target.closest("[data-remover-socio]");
      if (remSocio) {
        var sid = remSocio.getAttribute("data-remover-socio");
        var s = Store.estado.socios.filter(function (x) { return x.id === sid; })[0];
        UI.confirmar({
          titulo: "Remover sócio",
          mensagem: "Todos os documentos de " + (s && s.nome ? s.nome : "deste sócio") +
                    " serão removidos do portal.",
          confirmar: "Remover", perigo: true
        }).then(function (ok) {
          if (!ok) return;
          Store.removerSocio(sid);
          Store.flush();
          UI.toast("Sócio removido.", "ok");
          render();
        });
        return;
      }

      /* --- Academy --- */
      var tocar = ev.target.closest("[data-tocar]");
      if (tocar) {
        var caixa = tocar.closest("[data-video]") || tocar;
        if (caixa.getAttribute("data-video")) {
          abrirVideo(caixa.getAttribute("data-video"), caixa.getAttribute("data-video-titulo"));
          return;
        }
      }

      var abrirTrilha = ev.target.closest("[data-abrir-trilha]");
      if (abrirTrilha) {
        var alvoTrilha = abrirTrilha.closest("[data-trilha]") || abrirTrilha;
        estadoUI.trilhaAberta = alvoTrilha.getAttribute("data-trilha");
        navegar("academy");
        return;
      }

      if (ev.target.closest("[data-voltar-trilhas]")) {
        estadoUI.trilhaAberta = "";
        render();
        global.scrollTo({ top: 0, behavior: "auto" });
        return;
      }

      /* --- FAQ --- */
      var faq = ev.target.closest("[data-faq]");
      if (faq) {
        var i = faq.getAttribute("data-faq");
        estadoUI.faqAberta[i] = !estadoUI.faqAberta[i];
        render();
        return;
      }
    });

    /* Campos de "dado" e checkbox de grupo não aplicável */
    document.addEventListener("change", function (ev) {
      var grupoNA = ev.target.closest("[data-grupona]");
      if (grupoNA) {
        var gid = grupoNA.closest("[data-grupo]").getAttribute("data-grupo");
        var marcado = grupoNA.checked;
        Store.commit(function (st) {
          if (marcado) st.gruposNA[gid] = true;
          else delete st.gruposNA[gid];
        }, "grupona");
        Store.flush(); render();
        return;
      }

      var dado = ev.target.closest("[data-dado]");
      if (dado) {
        var cx = contextoItem(dado);
        if (!cx) return;
        var v = String(dado.value || "").slice(0, 400);
        Store.commit(function () {
          var r = Store.item(cx.chave);
          r.valor = v;
          if (v) r.na = false;
          r.atualizadoEm = Date.now();
        }, "dado");
        Store.flush(); render();
      }
    });

    /* Máscara ao digitar no campo do PIS */
    document.addEventListener("input", function (ev) {
      var dado = ev.target.closest("[data-dado]");
      if (dado && dado.tagName === "INPUT") {
        var cx = contextoItem(dado);
        if (cx && cx.item.id === "pis") {
          var pos = dado.selectionStart;
          var antes = dado.value.length;
          dado.value = U.mascaraPIS(dado.value);
          if (pos !== null) {
            var delta = dado.value.length - antes;
            try { dado.setSelectionRange(pos + delta, pos + delta); } catch (e) {}
          }
        }
      }
    });

    /* Arrastar e soltar sobre um item */
    ["dragenter", "dragover"].forEach(function (tipo) {
      document.addEventListener(tipo, function (ev) {
        var alvo = ev.target.closest ? ev.target.closest("[data-chave]") : null;
        if (!alvo) return;
        ev.preventDefault();
        alvo.classList.add("drop--over");
      });
    });
    ["dragleave", "drop"].forEach(function (tipo) {
      document.addEventListener(tipo, function (ev) {
        var alvo = ev.target.closest ? ev.target.closest("[data-chave]") : null;
        if (!alvo) return;
        alvo.classList.remove("drop--over");
      });
    });
    document.addEventListener("drop", function (ev) {
      var alvo = ev.target.closest ? ev.target.closest("[data-chave]") : null;
      if (!alvo) return;
      ev.preventDefault();
      var chave = alvo.getAttribute("data-chave");
      var partes = chave.split("/");
      var grupo = DATA.GRUPOS.filter(function (g) { return g.id === partes[0]; })[0];
      var item = grupo && grupo.itens.filter(function (i) { return i.id === partes[partes.length - 1]; })[0];
      if (!item || item.kind !== "arquivo") return;
      receberArquivos(chave, ev.dataTransfer && ev.dataTransfer.files);
    });

    /* Impede que um arquivo solto fora de um item abra no navegador */
    global.addEventListener("dragover", function (ev) { ev.preventDefault(); });
    global.addEventListener("drop", function (ev) { ev.preventDefault(); });

    /* Cartão com role="button" precisa responder a Enter e espaço. */
    document.addEventListener("keydown", function (ev) {
      if (ev.key !== "Enter" && ev.key !== " ") return;
      var alvo = ev.target.closest && ev.target.closest('[role="button"][tabindex]');
      if (!alvo) return;
      ev.preventDefault();
      alvo.click();
    });

    global.addEventListener("hashchange", render);
    global.addEventListener("beforeunload", function () { Store.flush(); });
  }

  /* Chamada depois de qualquer mudança na tela de Empresa, com a
     contagem de pendências de ANTES. Assim a janela de etapa
     concluída aparece exatamente na virada — nunca a cada visita,
     nunca duas vezes. */
  function conferirEtapaEmpresa(faltavam) {
    var faltam = faltamNoCadastro().length;
    var caixa = $("#blocoEtapa");
    if (caixa && faltam !== faltavam) caixa.innerHTML = blocoEtapaEmpresa();
    if (faltavam > 0 && faltam === 0) celebrarCadastro();
  }

  function celebrarCadastro() {
    UI.modal({
      titulo: "Pronto! Etapa concluída",
      corpoHTML:
        '<p style="font-size:14px;line-height:1.7;color:var(--txt-2)">' +
          'Os dados da sua empresa, o contato do responsável e os sócios já estão com a Totali. ' +
          'Não precisa salvar nada — já está guardado.</p>' +
        '<p style="font-size:14px;line-height:1.7;color:var(--txt-2);margin-top:10px">' +
          '<strong style="color:var(--txt)">O próximo passo é enviar os documentos.</strong> ' +
          'Na tela de início você vê a lista do que falta e a ordem sugerida.</p>',
      acoes: [
        { rotulo: "Continuar aqui", classe: "btn--ghost" },
        {
          rotulo: "Voltar ao início", classe: "btn--primary",
          onClick: function () { navegar("inicio"); }
        }
      ]
    });
  }

  function bindEmpresa() {
    $$("[data-emp]").forEach(function (campo) {
      var chave = campo.getAttribute("data-emp");
      var mascara = campo.getAttribute("data-mascara");

      if (mascara) {
        campo.addEventListener("input", function () {
          campo.value = mascara === "cnpj" ? U.mascaraCNPJ(campo.value) : U.mascaraTelefone(campo.value);
        });
      }

      campo.addEventListener("change", function () {
        /* Campo preenchido pela Totali não é gravado, mesmo que o
           evento chegue por outro caminho que não a digitação. */
        if (campo.readOnly || campo.disabled) {
          campo.value = Store.estado.empresa[chave] || "";
          return;
        }
        var v = String(campo.value || "").slice(0, 200);

        if (chave === "cnpj" && v && !U.validaCNPJ(v)) {
          var e1 = $("#errCnpj"); if (e1) e1.hidden = false;
          campo.setAttribute("aria-invalid", "true");
        } else if (chave === "cnpj") {
          var e2 = $("#errCnpj"); if (e2) e2.hidden = true;
          campo.removeAttribute("aria-invalid");
        }

        if (chave === "responsavelEmail" && v && !U.validaEmail(v)) {
          var e3 = $("#errEmail"); if (e3) e3.hidden = false;
          campo.setAttribute("aria-invalid", "true");
        } else if (chave === "responsavelEmail") {
          var e4 = $("#errEmail"); if (e4) e4.hidden = true;
          campo.removeAttribute("aria-invalid");
        }

        var faltavam = faltamNoCadastro().length;
        Store.commit(function (st) { st.empresa[chave] = v; }, "empresa");
        Store.flush();
        atualizarNav(estadoUI.rota);

        /* Só o quadro do fim é redesenhado. Redesenhar a tela
           inteira aqui tiraria o foco de quem está andando de
           campo em campo pelo Tab. */
        conferirEtapaEmpresa(faltavam);
      });
    });
  }

  function bindAjuda() {
    var btn = $("#btnMapa");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var caixa = $("#mapaCaixa");
      var l = DATA.ORG.local;
      var quadro = document.createElement("iframe");
      quadro.className = "mapa__quadro";
      quadro.title = "Mapa da localização da " + l.nome;
      quadro.loading = "lazy";
      quadro.referrerPolicy = "no-referrer";
      quadro.setAttribute("allowfullscreen", "");
      quadro.src = "https://maps.google.com/maps?q=" +
                   encodeURIComponent(l.lat + "," + l.lng) + "&z=16&output=embed";
      caixa.innerHTML = "";
      caixa.appendChild(quadro);
    });
  }

  /* Store.apagarTudo() continua existindo — quem chama é a equipe,
     pelo painel interno. O cliente não tem esse botão. */
  function bindPrivacidade() { /* nada a ligar por enquanto */ }

  /* ============================================================
     Convite gerado pela equipe
     ============================================================
     O link chega como `?c=<dados>` e traz apenas informação da
     EMPRESA (razão social, fantasia, CNPJ, regime) — nunca dado
     pessoal, porque endereço de página fica em histórico, em
     captura de tela e em quem mais receber o link encaminhado.

     [FIREBASE] Quando o servidor entrar, o link passa a levar só
     um código de convite e os dados vêm do Firestore. Aí some
     até essa informação da URL.
  ------------------------------------------------------------ */
  /* Convite pelo servidor: o link traz só o código (?k=). O portal
     entra como visitante anônimo, registra o acesso e busca a
     empresa no banco. Reabrir o mesmo link em outro aparelho
     funciona — é assim que o cliente não perde nada ao trocar de
     celular ou limpar o navegador. */
  /* Insiste na retomada antes de desistir.

     A leitura pode falhar por causa da credencial ainda fria, e
     nesse caso a segunda tentativa quase sempre passa. Três
     tentativas em ~2,5s são invisíveis para quem está abrindo o
     portal e evitam mandar para a tela de login alguém que está
     logado. */
  function retomarComPaciencia() {
    var FB = global.FB;
    var espera = function (ms) {
      return new Promise(function (r) { setTimeout(r, ms); });
    };
    var tentar = function (restam) {
      return FB.retomarCliente().then(function (r) {
        if (r.estado !== "falhou" || restam <= 0) return r;
        return espera(800).then(function () { return tentar(restam - 1); });
      });
    };
    return tentar(3);
  }

  function aplicarConviteDoServidor() {
    var FB = global.FB;
    if (!FB || !FB.ligado) return Promise.resolve(false);

    var codigo = null;
    try { codigo = new URLSearchParams(location.search).get("k"); } catch (e) { codigo = null; }

    /* Sem código: ou já existe sessão aberta neste aparelho, ou
       a pessoa precisa entrar. Com o servidor no ar, o portal é
       de acesso restrito — ninguém vê nada sem senha. */
    if (!codigo) {
      return retomarComPaciencia().then(function (r) {
        if (r.estado === "pronto") return descobrirEmpresas().then(entrarNaEmpresa);
        if (FB.equipe) return false;      /* equipe testando: deixa passar */

        /* Só vai para a porta quem realmente não tem sessão.
           Sessão viva com leitura falhando NÃO é motivo para pedir
           senha de novo — era o que fazia o cliente achar que
           tinha sido desconectado. */
        if (r.estado === "falhou") {
          porta.modo = "";
          setTimeout(function () {
            UI.toast("A conexão com o servidor está instável. Seus dados estão salvos — " +
                     "atualize a página em alguns segundos.", "erro", 12000);
          }, 600);
          return true;
        }
        porta.modo = "login";
        return true;
      });
    }

    try { history.replaceState({}, "", location.pathname + location.hash); } catch (e) {}

    /* Com código: mostra a tela de criar acesso, já dizendo de
       qual empresa é o convite. */
    return FB.lerConvite(codigo).then(function (c) {
      return FB.db.collection("empresas").doc(c.empresaId).get().then(function (doc) {
        var d = doc.exists ? (doc.data() || {}) : {};
        porta.modo = "cadastro";
        porta.codigo = c.codigo;
        porta.empresaNome = d.nomeFantasia || d.razaoSocial || "";
        return true;
      }, function () {
        porta.modo = "cadastro";
        porta.codigo = c.codigo;
        return true;
      });
    }, function (e) {
      /* Convite já usado: provavelmente é o próprio cliente
         reabrindo o link antigo. Manda para o login. */
      var msg = FB.explicar(e);
      return retomarComPaciencia().then(function (r) {
        if (r.estado === "pronto") return descobrirEmpresas().then(entrarNaEmpresa);
        porta.modo = "login";
        setTimeout(function () { UI.toast(msg, "erro", 9000); }, 700);
        return true;
      });
    });
  }

  function aplicarConviteDaURL() {
    var codigo = null;
    try { codigo = new URLSearchParams(location.search).get("c"); } catch (e) { codigo = null; }
    if (!codigo) return;

    /* Tira o convite da barra de endereço antes de qualquer coisa. */
    try { history.replaceState({}, "", location.pathname + location.hash); } catch (e) {}

    var dados = null;
    try { dados = JSON.parse(U.b64urlParaTexto(codigo)); } catch (e) { dados = null; }

    var resultado = Store.aplicarConvite(dados);
    if (resultado === "aplicado" || resultado === "atualizado") {
      Store.flush();
      return;
    }
    setTimeout(function () {
      if (resultado === "outra") {
        UI.toast("Este link é de outra empresa. Os dados já existentes neste aparelho foram mantidos.", "erro", 9000);
      } else {
        UI.toast("O link de acesso não pôde ser lido. Peça um novo à Totali.", "erro", 9000);
      }
    }, 700);
  }

  /* ============================================================
     Boot
     ============================================================ */
  function iniciar() {
    inputArquivo = document.createElement("input");
    inputArquivo.type = "file";
    inputArquivo.multiple = true;
    inputArquivo.accept = U.ACCEPT_ATTR;
    inputArquivo.style.display = "none";
    inputArquivo.addEventListener("change", function () {
      if (chaveDestino) receberArquivos(chaveDestino, inputArquivo.files);
      chaveDestino = null;
    });
    document.body.appendChild(inputArquivo);

    /* Entrada separada para a câmera: `capture` e `multiple` não
       convivem — com os dois, o celular ignora a câmera e abre a
       galeria. Por isso são dois inputs, não um com atributo
       trocado na hora. */
    inputFoto = document.createElement("input");
    inputFoto.type = "file";
    inputFoto.accept = "image/*";
    inputFoto.capture = "environment";
    inputFoto.style.display = "none";
    inputFoto.addEventListener("change", function () {
      if (chaveDestino) receberArquivos(chaveDestino, inputFoto.files);
      chaveDestino = null;
    });
    document.body.appendChild(inputFoto);

    ligarEventosGlobais();

    /* Avisos ao cliente. Só notificamos o que veio da Totali —
       ninguém precisa ser avisado da própria ação. */
    Store.notificador = function (ev) {
      var N = global.Notif;
      if (!N || !N.ativo) return;

      if (ev.tipo === "mensagem" && ev.mensagem && ev.mensagem.autor === "equipe") {
        N.novaMensagem(ev.mensagem.autorNome, ev.mensagem.texto, estadoUI.rota);
        return;
      }
      if (ev.tipo === "revisao" && ev.status) {
        var nome = nomeDoItem(ev.chave) || "um documento";
        if (ev.status === "pendencia") {
          N.documentoRevisado(nome + (ev.motivo ? " — " + ev.motivo : ""), "pendencia", estadoUI.rota);
        } else {
          N.documentoRevisado(nome, ev.status, estadoUI.rota);
        }
      }
    };

    Store.on(function (_, motivo) {
      if (motivo === "mensagens" || motivo === "revisao") atualizarNav(estadoUI.rota);

      /* Mensagem que chegou do servidor precisa aparecer na hora.
         Só redesenho quando a conversa está aberta — redesenhar a
         tela inteira enquanto a pessoa preenche um formulário
         apagaria o que ela está digitando. */
      if (motivo === "mensagens" && estadoUI.rota === "mensagens") {
        var caixa = $("#msgTexto");
        var rascunho = caixa ? caixa.value : "";
        var foco = caixa && document.activeElement === caixa;
        render();
        var nova = $("#msgTexto");
        if (nova && rascunho) {
          nova.value = rascunho;
          if (foco) { nova.focus(); nova.setSelectionRange(rascunho.length, rascunho.length); }
        }
      }
      if (motivo === "erro-persistencia") {
        UI.toast(Store.noServidor
          ? "Não conseguimos salvar no servidor agora. Verifique a internet — o que você digitou " +
            "não se perde, tentamos de novo sozinhos."
          : "Não foi possível salvar neste aparelho. O armazenamento pode estar cheio ou " +
            "o navegador está em modo privado.", "erro", 9000);
      }
    });

    Store.iniciar().then(function () {
      aplicarConviteDaURL();
      if (!location.hash) location.replace("#/inicio");
      render();
      document.body.classList.add("pronto");
      conferirLembretes();

      /* O convite do servidor depende de rede, então roda depois
         da primeira pintura: a tela nunca fica esperando. */
      var FB = global.FB;
      if (FB) {
        FB.pronto.then(function () {
          if (!FB.ligado) return false;
          /* Espera o Firebase decidir se já há sessão aberta,
             senão a tela pisca do login para o portal. */
          return new Promise(function (resolve) {
            var parar = FB.auth.onAuthStateChanged(function () {
              parar();
              resolve(aplicarConviteDoServidor());
            });
          });
        }).then(function (mudou) {
          if (mudou) render();
        }, function (e) {
          /* PEDIR A SENHA DE NOVO É A ÚLTIMA COISA A SE FAZER, e
             só quando se sabe que ela é mesmo necessária.

             Antes, qualquer rejeição daqui caía na tela de entrada
             — inclusive a mais comum de todas, que é a listagem
             das empresas falhando por rede. A pessoa estava
             logada, continuava logada, e ainda assim via a tela
             de senha. É o "deslogou sozinho".

             Só o `sem-empresa` justifica a porta: aí a conta
             existe e realmente não está ligada a nada, e a saída é
             abrir o convite. O resto é problema de leitura, e
             problema de leitura se resolve tentando de novo. */
          var codigo = (e && (e.code || e.message)) || "";
          var semSessao = !(global.FB.auth && global.FB.auth.currentUser);
          var ACABOU = ["sem-empresa", "empresa-inexistente"];

          if (ACABOU.indexOf(codigo) > -1 || semSessao) {
            porta.modo = "login";
            render();
            UI.toast(global.FB.explicar(e), "erro", 9000);
            return;
          }

          UI.toast("A conexão com o servidor está instável. Você continua conectado — " +
                   "atualize a página em alguns segundos.", "erro", 12000);
        });
      }
    }, function () {
      $("#view").innerHTML =
        '<div class="card card--pad"><div class="notice notice--warn">' +
        '<span class="notice__icon">' + ic("ic-alert") + '</span>' +
        '<span>Não foi possível iniciar o portal neste navegador. Tente novamente ou fale com a ' +
        U.esc(DATA.ORG.curto) + '.</span></div></div>';
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();

  global.APP = { navegar: navegar, render: render };
})(window);
