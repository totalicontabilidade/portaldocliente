/* ============================================================
   Totali · Portal de Onboarding
   extratos.js — a página de liberação do extrato bancário

   O QUE ESTA PÁGINA É, e por que ela não é uma tela do portal.

   A Totali lê o extrato das empresas pelo Ottimizza, e para isso o
   cliente precisa autorizar o compartilhamento no site do próprio
   banco, uma vez por banco. A equipe gera no integrador um link
   por BANCO e por CNPJ, e até aqui mandava esse link solto no
   WhatsApp — sem contexto, sem o passo a passo, e sem ninguém
   saber depois quais bancos já tinham sido autorizados.

   Ela abre SEM LOGIN de propósito. Quem só precisa autorizar o
   banco não deveria ter que criar conta, escolher senha e aprender
   um portal por causa disso — inclusive porque boa parte de quem
   recebe este link é cliente antigo, que não usa o portal.

   O preço de abrir sem login é que o endereço é a única chave, e é
   por isso que o código tem 22 caracteres sorteados e que o
   documento do outro lado guarda o mínimo: nome da empresa e os
   links. A conferência de CNPJ que vem antes segura o link
   encaminhado por engano; ela não é uma senha, e o comentário em
   `U.hashCNPJ` explica por quê.
   ============================================================ */
(function (global) {
  "use strict";

  var U = global.U, UI = global.UI, DATA = global.DATA;

  function $(sel, raiz) { return (raiz || document).querySelector(sel); }
  function $$(sel, raiz) {
    return Array.prototype.slice.call((raiz || document).querySelectorAll(sel));
  }
  function ic(nome) {
    return '<svg class="ic" aria-hidden="true" focusable="false"><use href="#' + nome +
           '"></use></svg>';
  }

  var db = null;
  var codigo = "";
  var registro = null;      /* o documento de extratos/{codigo}   */
  var confirmacoes = {};    /* slug do banco -> { confirmado, em, por } */

  /* Memória de que o CNPJ já foi conferido NESTE aparelho. É
     conveniência, não credencial: quem apagar isso só vai digitar
     o CNPJ de novo. */
  function chaveLembranca() { return "totali.extratos." + codigo; }

  function jaConferiu() {
    try { return global.localStorage.getItem(chaveLembranca()) === "1"; }
    catch (e) { return false; }   /* aba privada: pede o CNPJ toda vez */
  }
  function lembrarQueConferiu() {
    try { global.localStorage.setItem(chaveLembranca(), "1"); } catch (e) {}
  }

  /* ---------- Telas ---------- */

  function pintar(html) {
    $("#view").innerHTML = html;
  }

  function telaAviso(titulo, corpo, icone) {
    pintar(
      '<div class="card card--pad ext-aviso">' +
        '<div style="display:flex;gap:11px;align-items:flex-start">' +
          '<span style="color:var(--gold);flex:none;margin-top:2px">' + ic(icone || "ic-info") + '</span>' +
          '<div>' +
            '<h1 class="section__title">' + U.esc(titulo) + '</h1>' +
            '<div class="section__desc" style="margin-top:8px">' + corpo + '</div>' +
          '</div>' +
        '</div>' +
      '</div>');
  }

  function telaLinkInvalido() {
    telaAviso("Este link não abre",
      "Ele pode ter sido copiado pela metade, ou a Totali pode tê-lo substituído por um novo. " +
      "Fale com a gente pelo WhatsApp <b>(79) 99841-2107</b> que enviamos o link certo.",
      "ic-alert");
  }

  /* ---------- Conferência do CNPJ ---------- */

  function telaCNPJ(erro) {
    pintar(
      '<div class="card card--pad">' +
        '<div class="eyebrow">Liberação de extrato</div>' +
        '<h1 class="section__title" style="margin-top:4px">Confirme o CNPJ da empresa</h1>' +
        '<p class="section__desc" style="margin-bottom:16px">É só para termos certeza de que o ' +
          'link chegou a quem devia. Digite o CNPJ da empresa que você representa.</p>' +
        '<div class="field" style="margin-bottom:12px">' +
          '<label class="field__label" for="cnpj">CNPJ</label>' +
          '<input type="text" class="input" id="cnpj" inputmode="numeric" autocomplete="off" ' +
            'maxlength="18" placeholder="00.000.000/0000-00"' +
            (erro ? ' aria-invalid="true"' : '') + '>' +
        '</div>' +
        (erro ? '<p class="text-sm" style="color:var(--danger);margin:0 0 14px">' + U.esc(erro) + '</p>' : '') +
        '<button type="button" class="btn btn--gold btn--block" id="btnConferir">Continuar</button>' +
      '</div>');

    var campo = $("#cnpj");
    campo.addEventListener("input", function () {
      campo.value = U.mascaraCNPJ(campo.value);
    });
    campo.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") { ev.preventDefault(); conferir(); }
    });
    $("#btnConferir").addEventListener("click", conferir);
    campo.focus();
  }

  function conferir() {
    var valor = $("#cnpj").value;
    var btn = $("#btnConferir");

    /* O dígito verificador é conferido aqui, antes do resumo: erro
       de digitação merece "confira os números", não "essa empresa
       não é a do link", que manda a pessoa procurar problema onde
       não há. */
    if (!U.validaCNPJ(valor)) {
      telaCNPJ("Esse CNPJ não confere. Verifique os números e tente de novo.");
      return;
    }

    btn.disabled = true;
    btn.textContent = "Conferindo…";

    U.hashCNPJ(valor).then(function (hash) {
      if (hash && hash === registro.cnpjHash) {
        lembrarQueConferiu();
        telaBancos();
        return;
      }
      telaCNPJ("Este link não é da empresa desse CNPJ. Confira se o link é mesmo o seu.");
    }, function () {
      telaAviso("Não dá para abrir por aqui",
        "Esta página precisa de uma conexão segura (https) para conferir o CNPJ. Abra o link " +
        "pelo endereço que a Totali enviou, sem alterá-lo.", "ic-alert");
    });
  }

  /* ---------- Lista de bancos ---------- */

  /* O que a página mostra é o que a equipe cadastrou COM LINK.
     Banco sem link seria um cartão com botão morto — e o cliente
     não tem como saber que o que falta é do nosso lado. */
  function bancosValidos() {
    return (registro.bancos || [])
      .map(function (b) {
        return { nome: String((b && b.nome) || ""), link: U.linkOttimizza(b && b.link) };
      })
      .filter(function (b) { return b.nome && b.link; });
  }

  function estaConfirmado(nome) {
    var c = confirmacoes[U.slug(nome)];
    return !!(c && c.confirmado);
  }

  function telaBancos() {
    var lista = bancosValidos();
    var feitos = lista.filter(function (b) { return estaConfirmado(b.nome); }).length;

    var html =
      '<div class="section">' +
        '<div class="eyebrow">Liberação de extrato</div>' +
        '<h1 class="section__title" style="font-size:20px;margin-top:4px">Autorize o acesso ao ' +
          'seu extrato</h1>' +
        '<p class="section__desc">' + U.esc(registro.nome || "Sua empresa") +
          ' · ' + lista.length + ' ' + U.plural(lista.length, "banco", "bancos") +
          (feitos ? ' · <b style="color:var(--ok)">' + feitos + ' já ' +
            U.plural(feitos, "autorizado", "autorizados") + '</b>' : '') +
        '</p>' +
      '</div>';

    if (!lista.length) {
      html += '<div class="card card--pad" style="margin-top:16px">' +
        '<p class="text-sm text-muted">Ainda não há banco preparado para autorização. ' +
        'A Totali avisa você assim que estiver pronto.</p></div>';
      pintar(html);
      return;
    }

    /* A segurança vem ANTES dos botões, e não no rodapé.

       A pergunta que trava o cliente é "o que eles vão poder fazer
       na minha conta?". Respondida depois do botão, ela vira
       mensagem no WhatsApp — ou desistência calada. */
    html += '<div class="orienta" style="margin-top:16px">' +
      '<div class="orienta__t">' + ic("ic-shield") + 'O que você está autorizando</div>' +
      '<div class="orienta__c">' + U.paragrafos(DATA.EXTRATOS.seguranca) + '</div>' +
    '</div>';

    html += lista.map(function (b) {
      var feito = estaConfirmado(b.nome);
      return '<div class="card card--pad" style="margin-top:12px">' +
        '<div class="ext-banco">' +
          '<div class="ext-banco__topo">' +
            '<span style="color:var(--gold);flex:none">' + ic("ic-card") + '</span>' +
            '<span class="ext-banco__nome">' + U.esc(b.nome) + '</span>' +
            (feito
              ? '<span class="badge badge--aprovado">' + ic("ic-check") + 'Autorizado</span>'
              : '') +
          '</div>' +
          '<div class="ext-banco__acoes">' +
            '<button type="button" class="btn btn--ghost btn--sm" data-passos="' +
              U.escAttr(b.nome) + '">' + ic("ic-info") + 'Ver o passo a passo</button>' +
            /* `noopener` não é enfeite: sem ele a aba aberta recebe
               `window.opener` e pode reescrever o endereço desta. */
            '<a class="btn ' + (feito ? "btn--ghost" : "btn--gold") + ' btn--sm" href="' +
              U.escAttr(b.link) + '" target="_blank" rel="noopener noreferrer" ' +
              'data-abriu="' + U.escAttr(b.nome) + '">' +
              ic("ic-external") + (feito ? "Autorizar de novo" : "Abrir a autorização") + '</a>' +
          '</div>' +
          '<label class="opcao' + (feito ? " opcao--on" : "") + '" style="margin:0">' +
            '<input type="checkbox" data-feito="' + U.escAttr(b.nome) + '"' +
              (feito ? " checked" : "") + '>' +
            '<span>Já autorizei este banco</span>' +
          '</label>' +
        '</div>' +
      '</div>';
    }).join("");

    html += '<p class="text-sm text-muted" style="margin-top:18px;line-height:1.6">' +
      'Alguma coisa não funcionou? Fale com a Totali no WhatsApp <b>(79) 99841-2107</b> ' +
      'que a gente acompanha com você.</p>';

    pintar(html);
    ligarEventos(lista);
  }

  function ligarEventos(lista) {
    var porNome = {};
    lista.forEach(function (b) { porNome[b.nome] = b; });

    $$("[data-passos]").forEach(function (botao) {
      botao.addEventListener("click", function () {
        abrirPassos(porNome[botao.getAttribute("data-passos")]);
      });
    });

    /* Abrir a autorização sugere o passo seguinte sem cobrar nada:
       o cliente volta para esta aba com a caixa esperando por ele,
       em vez de encontrar a tela igualzinha a como deixou. */
    $$("[data-abriu]").forEach(function (link) {
      link.addEventListener("click", function () {
        UI.toast("Ao terminar no banco, volte aqui e marque “Já autorizei”.", "", 7000);
      });
    });

    $$("[data-feito]").forEach(function (caixa) {
      caixa.addEventListener("change", function () {
        marcar(caixa.getAttribute("data-feito"), caixa.checked, caixa);
      });
    });
  }

  /* ---------- O passo a passo ---------- */

  function abrirPassos(banco) {
    if (!banco) return;
    var noCatalogo = DATA.acharNoCatalogo(DATA.BANCOS, banco.nome) || {};
    var manual = noCatalogo.manual || "";

    var corpo =
      '<p class="section__desc" style="margin:0 0 16px">' + U.esc(DATA.EXTRATOS.chamada) + '</p>' +
      '<ol class="ext-passos">' +
        DATA.EXTRATOS.passos.map(function (p) { return '<li>' + U.esc(p) + '</li>'; }).join("") +
      '</ol>';

    /* O PDF do banco entra DEPOIS dos passos comuns, e é opcional.

       Lendo o manual do Banco do Brasil se vê que a maior parte
       dele nem é do banco: é a tela da Ottimizza, igual para
       todos. E o tropeço que mais derruba o cliente — o navegador
       bloqueando o pop-up — está justamente nessa parte comum. Por
       isso ele está na lista acima, na tela, e não escondido na
       página 2 de um anexo que muita gente não abre. */
    if (manual) {
      corpo += '<hr class="hr">' +
        '<p class="text-sm text-muted" style="margin:0 0 12px">As telas do ' +
          U.esc(banco.nome) + ', com as imagens de cada passo, estão neste guia:</p>' +
        '<a class="btn btn--ghost btn--block" href="' + U.escAttr(manual) + '" ' +
          'target="_blank" rel="noopener noreferrer">' + ic("ic-file") +
          'Abrir o guia do ' + U.esc(banco.nome) + '</a>';
    }

    UI.modal({
      titulo: DATA.EXTRATOS.titulo + " · " + banco.nome,
      corpoHTML: corpo,
      acoes: [
        { rotulo: "Fechar", classe: "btn--ghost" },
        {
          rotulo: "Abrir a autorização", classe: "btn--gold",
          onClick: function () {
            /* `noopener` também aqui: `window.open` sem ele entrega
               a referência desta página para a aba nova. */
            global.open(banco.link, "_blank", "noopener,noreferrer");
            UI.toast("Ao terminar no banco, volte aqui e marque “Já autorizei”.", "", 7000);
          }
        }
      ]
    });
  }

  /* ---------- Marcação do cliente ---------- */

  function marcar(nome, confirmado, caixa) {
    var slug = U.slug(nome);
    var antes = confirmacoes[slug];

    caixa.disabled = true;
    db.collection("extratos").doc(codigo).collection("confirmacoes").doc(slug).set({
      banco: String(nome).slice(0, 80),
      confirmado: !!confirmado,
      em: Date.now(),
      por: "cliente"
    }).then(function () {
      confirmacoes[slug] = { banco: nome, confirmado: !!confirmado, em: Date.now(), por: "cliente" };
      UI.toast(confirmado ? "Anotado. A Totali confere e avisa se faltar algo."
                          : "Desmarcado.", "ok");
      telaBancos();
    }, function () {
      /* Sem rede, a caixa volta ao que era: marca que não chegou ao
         servidor é marca que a equipe nunca vai ver, e o cliente
         iria embora achando que avisou. */
      caixa.checked = !!(antes && antes.confirmado);
      caixa.disabled = false;
      UI.toast("Não consegui salvar agora. Confira a internet e tente de novo.", "erro", 6000);
    });
  }

  /* ---------- Início ---------- */

  function codigoDaURL() {
    var c = "";
    try { c = new URLSearchParams(global.location.search).get("c") || ""; } catch (e) {}
    return /^[A-Za-z0-9]{16,40}$/.test(c) ? c : "";
  }

  function iniciarFirebase() {
    if (!global.firebase || !global.FIREBASE_CONFIG) return false;
    try {
      /* Nome próprio: esta página pode estar aberta ao lado do
         portal, e dois `initializeApp` sem nome brigariam pelo app
         padrão. */
      var app = global.firebase.initializeApp(global.FIREBASE_CONFIG, "extratos");

      if (global.APP_CHECK_SITE_KEY && global.firebase.appCheck) {
        try {
          global.firebase.appCheck(app).activate(global.APP_CHECK_SITE_KEY, true);
        } catch (e) { /* segue sem App Check, como o portal faz */ }
      }

      db = global.firebase.firestore(app);
      return true;
    } catch (e) {
      return false;
    }
  }

  /* O catálogo publicado pelo painel é o que traz o PDF de cada
     banco. Falhando, seguem os padrões de `js/data.js` — a página
     continua de pé, só sem o guia. */
  function buscarCatalogo() {
    return db.collection("conteudo").doc("portal").get().then(function (d) {
      if (!d.exists) return;
      var dados = d.data() || {};
      if (dados.blocos) DATA.aplicarConteudo(dados.blocos);
    }, function () {});
  }

  function buscarConfirmacoes() {
    return db.collection("extratos").doc(codigo).collection("confirmacoes").get()
      .then(function (snap) {
        snap.forEach(function (d) { confirmacoes[d.id] = d.data() || {}; });
      }, function () { /* sem isso a página ainda funciona, só sem as marcas */ });
  }

  function iniciar() {
    codigo = codigoDaURL();
    if (!codigo) return telaLinkInvalido();
    if (!iniciarFirebase()) {
      return telaAviso("Não consegui conectar",
        "Recarregue a página. Se continuar, fale com a Totali pelo WhatsApp " +
        "<b>(79) 99841-2107</b>.", "ic-alert");
    }

    db.collection("extratos").doc(codigo).get().then(function (d) {
      if (!d.exists) return telaLinkInvalido();
      registro = d.data() || {};
      if (registro.ativo === false) {
        return telaAviso("Este link foi encerrado",
          "A Totali substituiu este link por um novo. Fale com a gente pelo WhatsApp " +
          "<b>(79) 99841-2107</b> que enviamos o atual.", "ic-alert");
      }

      return Promise.all([buscarCatalogo(), buscarConfirmacoes()]).then(function () {
        /* Sem CNPJ gravado não há o que conferir — e é melhor abrir
           do que travar o cliente por causa de um cadastro que a
           equipe fez antes deste campo existir. */
        if (!registro.cnpjHash || jaConferiu()) telaBancos();
        else telaCNPJ("");
      });
    }, function () {
      telaLinkInvalido();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }
})(window);
