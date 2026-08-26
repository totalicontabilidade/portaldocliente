/* ============================================================
   Totali · Portal de Onboarding
   aplicacao.js — quais documentos se aplicam a esta empresa

   POR QUE EXISTE
   --------------
   A lista de documentos é a mesma para todo mundo, e nunca é a
   mesma para ninguém: uma empresa sem funcionário não tem folha
   de pagamento, uma do Simples não tem livro de apuração, um MEI
   não tem balanço. Até agora só o CLIENTE podia tirar um item da
   lista — e ele é justamente quem menos sabe o que se aplica.

   O resultado prático era o cliente parado numa lista com onze
   documentos, três dos quais nunca vão existir, sem coragem de
   marcar "não se aplica" por medo de errar.

   COMO CONVIVE COM O QUE O CLIENTE MARCA
   --------------------------------------
   São dois campos separados, de propósito:

     na         o que o cliente marcou
     naEquipe   o que a Totali definiu  (true, false ou ausente)

   Quando `naEquipe` existe, ela decide sozinha e o botão some do
   portal. `true` tira da lista; `false` devolve — e "precisa
   sim" é tão útil quanto "não precisa", porque destrava o
   cliente que marcou errado e ficou com o documento escondido.

   Ausente quer dizer "a equipe não opinou", que é o estado de
   tudo o que já existia antes deste arquivo. Nada muda sozinho.

   ONDE APARECE
   ------------
   Na ficha do cliente e na tela de novo cliente, antes de gerar
   o link — que é o melhor momento, porque é quando alguém da
   equipe está olhando o CNPJ e o regime.
   ============================================================ */
(function (global) {
  "use strict";

  var U = global.U, UI = global.UI;
  var $ = UI.$, $$ = UI.$$;
  var ic = UI.icone;

  /* Todos os documentos, achatados: um por linha, já com o rótulo
     que a equipe reconhece. Itens de sócio aparecem UMA vez, sem
     repetir por sócio — a definição vale para todos eles. */
  function catalogo() {
    var saida = [];
    (global.DATA.GRUPOS || []).forEach(function (g) {
      g.itens.forEach(function (item) {
        saida.push({
          grupo: g, item: item,
          porSocio: g.escopo === "socio",
          nome: item.nome,
          obrigatorio: !!item.obrigatorio
        });
      });
    });
    return saida;
  }

  /* As chaves reais no banco. Um item de sócio vira uma chave por
     sócio; o resto vira uma só. */
  function chavesDe(linha, socios) {
    var S = global.Situacao;
    if (!linha.porSocio) return [S.chaveItem(linha.grupo.id, linha.item.id, null)];
    return (socios || []).map(function (s) {
      return S.chaveItem(linha.grupo.id, linha.item.id, s.id);
    });
  }

  /* O estado atual de uma linha: true (fora), false (dentro por
     decisão da equipe) ou null (a equipe não opinou).

     Com vários sócios pode haver divergência entre as chaves. Aí
     o valor é null — e a tela mostra o item como indefinido, que
     é a verdade. */
  function estadoDa(linha, itens, socios) {
    var chaves = chavesDe(linha, socios);
    if (!chaves.length) return null;
    var primeiro = (itens[chaves[0]] || {}).naEquipe;
    var todosIguais = chaves.every(function (k) {
      return (itens[k] || {}).naEquipe === primeiro;
    });
    if (!todosIguais) return null;
    return typeof primeiro === "boolean" ? primeiro : null;
  }

  /* ------------------------------------------------------------
     A tela
     ------------------------------------------------------------ */
  var TRES = [
    { v: "sim",  rot: "Se aplica",     dica: "O cliente precisa entregar" },
    { v: "nao",  rot: "Não se aplica", dica: "Sai da lista do cliente" },
    { v: "auto", rot: "Deixar com ele", dica: "O cliente decide, como era antes" }
  ];

  /* Os atalhos do topo, que resolvem a lista inteira de uma vez.

     "Marcar tudo como não se aplica" é diferente dos outros dois:
     ele ESVAZIA a lista do cliente. Os outros deixam trabalho para
     alguém fazer; esse faz o portal daquela empresa não pedir mais
     nada. Por isso, e só ele, pergunta antes. */
  var TODOS = [
    { v: "auto", rot: "Deixar tudo com o cliente" },
    { v: "sim",  rot: "Marcar tudo como necessário" },
    { v: "nao",  rot: "Marcar tudo como não se aplica", pergunta: true }
  ];

  function barraTodosHTML() {
    return TODOS.map(function (t) {
      return '<button type="button" class="btn btn--quiet btn--sm" data-aplic-todos="' +
        U.escAttr(t.v) + '">' + U.esc(t.rot) + '</button>';
    }).join("");
  }

  /* A pergunta mora DENTRO desta janela, e não numa por cima.

     UI.confirmar() abre um modal novo, e UI.modal() começa fechando
     o que já estiver aberto — só existe um `modalAberto`. Chamar de
     dentro daqui derrubaria esta tela e levaria junto tudo o que a
     pessoa marcou e ainda não salvou. */
  function certezaHTML(quantos, semSocios) {
    var doc = quantos === 1 ? "documento" : "documentos";
    return '<div class="notice notice--warn" style="display:block">' +
      '<div class="row" style="flex-wrap:nowrap;align-items:flex-start;gap:12px">' +
        '<span class="notice__icon">' + ic("ic-alert") + '</span>' +
        '<span>Isso tira <strong>os ' + quantos + ' ' + doc + ' desta lista</strong> da tela ' +
        'do cliente. Ele abre o portal e não encontra documento nenhum para enviar.' +
        (semSocios
          ? ' Os documentos de sócio ficam de fora desta marcação: eles ainda não existem, ' +
            'e vão aparecer quando ele cadastrar os sócios.'
          : '') +
        ' Tem certeza?</span>' +
      '</div>' +
      '<div class="row" style="margin-top:12px">' +
        '<button type="button" class="btn btn--ghost btn--sm" data-aplic-certeza="nao">' +
          'Cancelar</button>' +
        '<button type="button" class="btn btn--danger btn--sm" data-aplic-certeza="sim">' +
          'Sim, tirar todos</button>' +
      '</div>' +
    '</div>';
  }

  function linhaHTML(linha, valor, i) {
    return '<div class="aplic">' +
      '<div class="aplic__cab">' +
        '<span class="group__icon">' + ic(linha.grupo.icone) + '</span>' +
        '<span class="aplic__txt">' +
          '<span class="aplic__nome">' + U.esc(linha.nome) +
            (linha.obrigatorio ? '' : ' <span class="opt">opcional</span>') + '</span>' +
          '<span class="aplic__grupo">' + U.esc(linha.grupo.titulo) +
            (linha.porSocio ? ' · vale para todos os sócios' : '') + '</span>' +
        '</span>' +
      '</div>' +
      '<div class="aplic__opcoes" role="radiogroup" aria-label="' + U.escAttr(linha.nome) + '">' +
        TRES.map(function (o) {
          var ligado = valor === o.v;
          return '<button type="button" class="aplic__op' + (ligado ? " aplic__op--on" : "") +
            '" role="radio" aria-checked="' + (ligado ? "true" : "false") +
            '" data-aplic="' + i + '" data-valor="' + o.v + '" title="' + U.escAttr(o.dica) + '">' +
            U.esc(o.rot) + '</button>';
        }).join("") +
      '</div>' +
    '</div>';
  }

  function valorDe(estado) {
    if (estado === true) return "nao";
    if (estado === false) return "sim";
    return "auto";
  }

  /* Abre o editor.

     opcoes = {
       titulo, itens, socios,
       aoSalvar(mudancas) -> Promise    mudancas: [{chaves, naEquipe}]
     }
     `naEquipe` vem null quando a escolha foi "deixar com ele" —
     e null, no Firestore, precisa virar delete do campo. Quem
     grava resolve isso; aqui só se diz o que se quer. */
  function abrir(opcoes) {
    var o = opcoes || {};
    var itens = o.itens || {};
    var socios = o.socios || [];

    /* Documento de sócio só ganha chave depois que o sócio
       existe, e quem cadastra sócio é o cliente. Antes disso a
       escolha não teria onde ser gravada — e gravar em lugar
       nenhum, calado, é pior que não oferecer.

       Some da tela de novo cliente e volta na ficha, assim que
       houver sócio. */
    var semSocios = !socios.length;
    var linhas = catalogo().filter(function (l) { return !(l.porSocio && semSocios); });
    var escolha = linhas.map(function (l) { return valorDe(estadoDa(l, itens, socios)); });

    var m = UI.modal({
      titulo: o.titulo || "Documentos deste cliente",
      corpoHTML:
        '<p style="font-size:13.5px;line-height:1.65;color:var(--txt-2);margin-bottom:8px">' +
          'Marque o que <strong>não</strong> se aplica a esta empresa. O documento sai da lista ' +
          'do cliente e para de contar no progresso — ele não fica esperando por uma folha de ' +
          'pagamento que a empresa nunca vai ter.</p>' +
        (semSocios
          ? '<div class="notice notice--info" style="margin-bottom:12px;padding:10px 12px;' +
              'font-size:12.5px"><span class="notice__icon">' + ic("ic-info") + '</span>' +
              '<span>Os documentos de sócio ainda não aparecem aqui: eles só existem depois que ' +
              'o cliente cadastrar os sócios. Você define esses na ficha dele.</span></div>'
          : '') +
        '<div class="row" id="aplicTodos" style="margin-bottom:12px">' +
          barraTodosHTML() +
        '</div>' +
        '<div class="aplics" id="aplicLista">' +
          linhas.map(function (l, i) { return linhaHTML(l, escolha[i], i); }).join("") +
        '</div>',
      acoes: [
        { rotulo: "Cancelar", classe: "btn--ghost" },
        {
          rotulo: "Salvar", classe: "btn--primary", fecharAntes: false,
          onClick: function () { salvar(); }
        }
      ]
    });

    function redesenhar() {
      var lista = $("#aplicLista", m.caixa);
      if (lista) {
        lista.innerHTML = linhas.map(function (l, i) {
          return linhaHTML(l, escolha[i], i);
        }).join("");
      }
    }

    /* Troca a barra de atalhos pela pergunta, e vice-versa.

       `focar` só é verdadeiro quando a troca É a resposta ao clique.
       Quando ela acontece de lado — a pessoa mexeu num item e a
       pergunta foi embora junto — puxar o foco para cá tiraria o
       cursor de onde ela está trabalhando. */
    function barra(html, focar) {
      var alvo = $("#aplicTodos", m.caixa);
      if (!alvo) return;
      alvo.innerHTML = html;
      if (!focar) return;
      var primeiro = alvo.querySelector("button");
      if (primeiro) { try { primeiro.focus(); } catch (e) { /* sem foco, segue */ } }
    }

    function aplicarATodos(v) {
      escolha = escolha.map(function () { return v; });
      redesenhar();
    }

    m.caixa.addEventListener("click", function (ev) {
      var certeza = ev.target.closest("[data-aplic-certeza]");
      if (certeza) {
        if (certeza.getAttribute("data-aplic-certeza") === "sim") {
          aplicarATodos("nao");
          UI.toast("Todos marcados como “não se aplica”. Nada foi gravado ainda — " +
                   "confirme em Salvar.", "ok", 6000);
        }
        barra(barraTodosHTML(), true);
        return;
      }

      var todos = ev.target.closest("[data-aplic-todos]");
      if (todos) {
        var v = todos.getAttribute("data-aplic-todos");
        var pede = TODOS.some(function (t) { return t.v === v && t.pergunta; });
        if (pede) { barra(certezaHTML(linhas.length, semSocios), true); return; }
        aplicarATodos(v);
        return;
      }

      var b = ev.target.closest("[data-aplic]");
      if (!b) return;
      /* Mexer num item sozinho enquanto a pergunta está na tela
         deixaria uma confirmação órfã, sobre uma lista que já
         mudou. Some com ela. */
      if ($("[data-aplic-certeza]", m.caixa)) barra(barraTodosHTML());
      escolha[Number(b.getAttribute("data-aplic"))] = b.getAttribute("data-valor");
      redesenhar();
    });

    function salvar() {
      var mudancas = [];
      linhas.forEach(function (l, i) {
        var antes = valorDe(estadoDa(l, itens, socios));
        if (escolha[i] === antes) return;      /* nada a gravar */
        mudancas.push({
          chaves: chavesDe(l, socios),
          nome: l.nome,
          naEquipe: escolha[i] === "nao" ? true : escolha[i] === "sim" ? false : null
        });
      });

      if (!mudancas.length) { UI.fecharModal(); return; }

      var botao = $('[data-acao="1"]', m.caixa);
      if (botao) { botao.disabled = true; botao.textContent = "Salvando…"; }

      Promise.resolve(o.aoSalvar ? o.aoSalvar(mudancas) : null).then(function () {
        UI.fecharModal();
      }, function () {
        if (botao) { botao.disabled = false; botao.textContent = "Salvar"; }
      });
    }
  }

  global.Aplicacao = { abrir: abrir, catalogo: catalogo, chavesDe: chavesDe };
})(window);
