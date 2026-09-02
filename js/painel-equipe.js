/* ============================================================
   Totali · Portal de Onboarding
   painel-equipe.js — quem tem acesso ao painel

   O QUE ISTO RESOLVE
   ------------------
   Antes, incluir alguém na equipe exigia abrir o console do
   Firebase, criar a conta na mão, copiar o UID e montar um
   documento campo por campo. Quem não tinha acesso ao console
   dependia de quem tinha, e um erro de digitação no UID rendia
   meia hora de confusão sem nenhuma mensagem útil.

   QUEM PODE
   ---------
   ALTERAR, só administrador. E isso não é a tela que decide: a
   regra do servidor exige `ehAdmin()` para escrever em
   /usuarios/{uid}. Esconder o formulário é conveniência; a
   barreira é a regra.

   VER, qualquer pessoa da equipe. Antes esta aba mostrava a quem
   não é admin uma frase — "peça a um administrador" — e mais
   nada: um item de menu que não fazia nada. Saber quem são os
   colegas, de que setor cada um cuida e quem é administrador é
   justamente o que se procura aqui quando não se vem para mexer
   em nada.

   E CADA UM CUIDA DO PRÓPRIO
   --------------------------
   Nome de exibição e senha da própria conta são de quem é a
   conta, admin ou não. Ficam num bloco separado, no alto, antes
   da lista — é o que a pessoa vem fazer aqui com mais frequência.

   O QUE É CADA PAPEL
   ------------------
   equipe  vê clientes, confere documentos, conversa e cobra
   admin   tudo isso, mais abrir as senhas cifradas e gerenciar
           quem entra no painel

   POR QUE NINGUÉM SE REMOVE
   -------------------------
   A regra recusa apagar o próprio documento. É o que impede o
   último administrador de se desligar por engano e trancar o
   painel para todo mundo — foi exatamente o que aconteceu quando
   a coleção `usuarios` sumiu.
   ============================================================ */
(function (global) {
  "use strict";

  var U = global.U, UI = global.UI;
  var $ = UI.$, $$ = UI.$$;
  var ic = UI.icone;

  var FB = null;
  var equipe = null;
  var membros = [];
  var carregando = false;

  function souAdmin() {
    return !!(equipe && equipe.papel === "admin");
  }

  /* QUEM FEZ A MUDANÇA, carimbado na própria gravação.

     A trilha de /auditoria é escrita por uma função que observa o
     documento mudar, e um gatilho do Firestore não recebe o
     usuário que gravou. Sem este carimbo, a trilha saberia dizer
     que alguém virou administrador e não quem o promoveu — que é
     justamente a pergunta que se faz depois.

     Não é declaração de boa fé: a regra do servidor exige que
     `porUid` seja o uid de quem está gravando. Mesmo desenho já
     usado nos documentos do checklist. */
  function assinado(dados) {
    var eu = (FB && FB.equipe) || equipe;
    if (!eu || !eu.uid) return dados;
    dados.porUid = eu.uid;
    dados.porNome = String(eu.nome || eu.email || "").slice(0, 120);
    return dados;
  }

  /* ---------- Leitura ---------- */
  function carregar() {
    /* Já não depende de ser admin: a lista é de leitura para
       qualquer pessoa da equipe (ver o cabeçalho deste arquivo). */
    if (!FB || !FB.ligado || !FB.equipe) { desenhar(); return Promise.resolve(); }
    carregando = true;
    desenhar();
    return FB.db.collection("usuarios").get().then(function (snap) {
      membros = [];
      snap.forEach(function (d) {
        var m = d.data() || {};
        membros.push({
          uid: d.id,
          nome: m.nome || "",
          email: m.email || "",
          papel: m.papel === "admin" ? "admin" : "equipe",
          departamentos: Array.isArray(m.departamentos) ? m.departamentos : []
        });
      });
      membros.sort(function (a, b) {
        return (a.nome || a.email).localeCompare(b.nome || b.email, "pt-BR");
      });
      carregando = false;
      desenhar();
    }, function (e) {
      carregando = false;
      membros = [];
      desenhar();
      UI.toast("Não foi possível carregar a equipe: " + FB.explicar(e), "erro", 9000);
    });
  }

  /* ---------- A própria conta ----------

     Vem antes da lista porque é o que a pessoa mais faz aqui —
     e porque, para quem não é administrador, era a única coisa
     que esta aba tinha para oferecer e não oferecia.

     Nome de exibição e senha são da CONTA, não do papel: admin e
     equipe mexem nos seus do mesmo jeito. Trocar a senha pede a
     senha atual, e isso não é burocracia: é o que impede que uma
     tela deixada aberta vire uma conta tomada. */
  function minhaContaHTML() {
    if (!equipe) return "";
    var nome = equipe.nome || "";
    var email = equipe.email || "";
    return '<div class="card card--pad" style="margin-bottom:12px">' +
      '<div class="eyebrow">Sua conta</div>' +
      '<div class="item__top" style="align-items:center;gap:12px;margin-top:8px">' +
        '<span class="group__icon">' + ic("ic-badge") + '</span>' +
        '<div class="item__main">' +
          '<div class="item__name">' + U.esc(nome || email || "você") + '</div>' +
          '<div class="item__row">' +
            '<span class="text-xs text-muted">' + U.esc(email) + '</span>' +
            '<span class="badge ' + (souAdmin() ? "badge--aprovado" : "badge--analise") + '">' +
              '<span class="dot"></span>' +
              (souAdmin() ? "Administrador" : "Equipe") + '</span>' +
          '</div>' +
          '<div class="item__actions">' +
            '<button type="button" class="btn btn--quiet btn--sm" id="eqMeuNome">' +
              'Trocar nome de exibição</button>' +
            '<button type="button" class="btn btn--quiet btn--sm" id="eqMinhaSenha">' +
              'Trocar minha senha</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ---------- Tela ---------- */
  function desenhar() {
    var caixa = $("#eqLista");
    if (!caixa) return;

    var botao = $("#eqAdicionar");
    if (botao) botao.hidden = !souAdmin();

    if (carregando) {
      caixa.innerHTML = minhaContaHTML() +
        '<div class="card card--pad"><p class="text-sm text-muted">Carregando…</p></div>';
      return;
    }

    if (!membros.length) {
      caixa.innerHTML = minhaContaHTML() + '<div class="card"><div class="empty">' +
        '<div class="empty__icon">' + ic("ic-users") + '</div>' +
        '<div class="empty__title">Nenhum membro cadastrado</div>' +
        '<div class="empty__desc">Estranho: você está usando o painel, então deveria haver ' +
        'ao menos um. Recarregue a página.</div></div></div>';
      return;
    }

    caixa.innerHTML = minhaContaHTML() + '<div class="card">' + membros.map(function (m) {
      var euMesmo = equipe && m.uid === equipe.uid;
      var podeMexer = souAdmin();
      return '<div class="item"><div class="item__top">' +
        /* O ESCUDO DENUNCIA O PAPEL. Sem poder de mexer, o ícone
           volta a ser o mesmo para todo mundo — ver a nota abaixo. */
        '<span class="group__icon">' +
          ic(podeMexer && m.papel === "admin" ? "ic-shield" : "ic-users") + '</span>' +
        '<div class="item__main">' +
          '<div class="item__name">' + U.esc(m.nome || m.email || "sem nome") +
            (euMesmo ? ' <span class="text-xs text-muted">· você</span>' : '') + '</div>' +

          /* QUEM NÃO É ADMINISTRADOR VÊ SÓ O NOME (pedido dele).
             Papel, e-mail e setor são informação de gestão: quem
             não administra a lista não precisa saber quem manda
             nem em que setor cada um está para fazer o trabalho.
             Sobra o que serve — a lista de quem é da casa. */
          (podeMexer
            ? '<div class="item__row">' +
                '<span class="badge ' +
                  (m.papel === "admin" ? "badge--aprovado" : "badge--analise") + '">' +
                  '<span class="dot"></span>' +
                  (m.papel === "admin" ? "Administrador" : "Equipe") + '</span>' +
                '<span class="text-xs text-muted">' + U.esc(m.email || "sem e-mail") + '</span>' +
              '</div>' +
              /* O setor fica na linha de baixo, junto do papel: é a
                 segunda coisa que se quer saber ao olhar a lista. */
              '<div class="item__row">' +
                '<span class="text-xs" style="color:var(--gold-2);font-weight:600">' +
                  (m.departamentos.length
                    ? U.esc(global.Departamentos.nomesDos(m.departamentos))
                    : "Todos os departamentos") + '</span>' +
              '</div>'
            : '') +
          /* Sem poder de mexer, a linha é só informação: nome,
             papel, setor. Botões desligados seriam pior que botão
             nenhum — convidam ao clique e respondem "não pode". */
          (podeMexer
            ? '<div class="item__actions">' +
                '<button type="button" class="btn btn--quiet btn--sm" data-deptos="' +
                  U.escAttr(m.uid) + '">Departamentos</button>' +
                (euMesmo
                  ? '<span class="text-xs text-muted">Você não pode alterar o próprio papel — ' +
                    'é o que impede o painel de ficar sem administrador.</span>'
                  : '<button type="button" class="btn btn--ghost btn--sm" data-papel="' +
                      U.escAttr(m.uid) + '">' +
                      (m.papel === "admin" ? "Tornar equipe" : "Tornar administrador") + '</button>' +
                    '<button type="button" class="btn btn--quiet btn--sm" data-trocar-senha="' +
                      U.escAttr(m.uid) + '">Trocar senha</button>' +
                    '<button type="button" class="btn btn--quiet btn--sm" data-remover-membro="' +
                      U.escAttr(m.uid) + '">Remover</button>') +
              '</div>'
            : '') +
        '</div>' +
      '</div></div>';
    }).join("") + '</div>';
  }

  /* ---------- Adicionar ---------- */
  function formularioHTML() {
    /* Era "senha provisória", e o nome prometia o que o sistema não
       faz: nada obriga a troca no primeiro acesso. A senha que você
       digita aqui é a senha da pessoa até ela decidir trocar. */
    return '<p style="font-size:13.5px;line-height:1.65;color:var(--txt-2);margin-bottom:14px">' +
        'Combine a senha por um canal separado do e-mail. Quem quiser trocar usa ' +
        '"Esqueci minha senha" na tela de entrada.</p>' +
      '<div class="field">' +
        '<label class="field__label" for="mbNome">Nome<span class="field__req">*</span></label>' +
        '<input type="text" class="input" id="mbNome" maxlength="120" data-focus ' +
          'autocomplete="off" placeholder="Como aparece nas conferências"></div>' +
      '<div class="field">' +
        '<label class="field__label" for="mbEmail">E-mail<span class="field__req">*</span></label>' +
        '<input type="email" class="input" id="mbEmail" maxlength="160" ' +
          'autocomplete="off" inputmode="email" placeholder="pessoa@totalicontabilidade.com.br">' +
        '<div class="field__hint">Use e-mail nominal, não caixa de setor. É este nome que fica ' +
          'registrado em cada documento aprovado.</div></div>' +
      '<div class="field">' +
        '<label class="field__label" for="mbSenha">Senha<span class="field__req">*</span></label>' +
        '<input type="text" class="input" id="mbSenha" maxlength="60" autocomplete="off">' +
        /* Curto de propósito: é informação que quase nunca vai ser
           necessária, e um parágrafo aqui atrapalharia o uso de
           todo dia. Quem precisar, a mensagem de erro explica o
           resto na hora. */
        '<div class="field__hint">Pelo menos 6 caracteres. Se a pessoa já tiver login, digite a ' +
          'senha atual dela — o painel aproveita a conta em vez de criar outra.</div></div>' +
      '<div class="field">' +
        '<label class="field__label" for="mbPapel">Papel</label>' +
        '<select class="select" id="mbPapel">' +
          /* "Mais abrir senhas" estava errado e enganava na hora de
             escolher o papel: abrir senha de maquininha é da EQUIPE
             inteira desde sempre — ver functions/senhas.js, que só
             exige estar em /usuarios. O que é exclusivo do admin é
             gerir a equipe, excluir cliente de vez e apagar
             mensagem de outra pessoa. */
          '<option value="equipe">Equipe — vê clientes, confere documentos, conversa, cobra e ' +
            'abre senhas</option>' +
          '<option value="admin">Administrador — tudo isso, mais gerenciar a equipe, excluir ' +
            'cliente e apagar qualquer mensagem</option>' +
        '</select></div>' +
      '<div class="field">' +
        '<span class="field__label">Departamentos</span>' +
        '<div class="deptos">' +
          global.Departamentos.todos().map(function (g) {
            return '<label class="depto">' +
              '<input type="checkbox" data-depto="' + U.escAttr(g.id) + '">' +
              '<span class="depto__txt">' + U.esc(g.titulo) + '</span>' +
            '</label>';
          }).join("") +
        '</div>' +
        '<div class="field__hint">A tela de início mostra primeiro o que é destes setores. ' +
          'Nenhum marcado = cuida de todos.</div></div>';
  }

  function abrirFormulario() {
    if (!souAdmin()) { UI.toast(FB.explicar(new Error("so-admin")), "erro"); return; }

    var m = UI.modal({
      titulo: "Adicionar membro da equipe",
      corpoHTML: formularioHTML(),
      acoes: [
        { rotulo: "Cancelar", classe: "btn--ghost" },
        {
          rotulo: "Adicionar", classe: "btn--primary", fecharAntes: false,
          onClick: function () { salvarNovo(m); }
        }
      ]
    });
  }

  /* O botão nunca pode ficar preso em "Criando…".

     Gravação no Firestore só resolve quando o servidor confirma:
     com a rede ruim, a promessa fica pendurada sem erro e sem
     sucesso, e a tela morre com o botão desabilitado. Aconteceu
     de verdade. Este relógio devolve o controle e diz o que
     conferir — porque a conta pode ter sido criada mesmo assim. */
  var LIMITE_MS = 20000;

  function ocupar(m, ocupado, rotulo) {
    var b = $('[data-acao="1"]', m.caixa);
    if (!b) return;
    b.disabled = ocupado;
    b.textContent = rotulo || (ocupado ? "Criando…" : "Adicionar");
  }

  function comLimite(promessa, m) {
    var terminou = false;
    var relogio = setTimeout(function () {
      if (terminou) return;
      ocupar(m, false);
      UI.toast("A gravação está demorando demais. Verifique a internet e tente de novo com o " +
               "mesmo e-mail e a mesma senha — se a conta chegou a ser criada, o painel conclui " +
               "o que faltou em vez de reclamar.", "erro", 14000);
    }, LIMITE_MS);
    return promessa.then(function (v) {
      terminou = true; clearTimeout(relogio); return v;
    }, function (e) {
      terminou = true; clearTimeout(relogio); throw e;
    });
  }

  function salvarNovo(m) {
    var nome = $("#mbNome", m.caixa).value.trim();
    var email = $("#mbEmail", m.caixa).value.trim();
    var senha = $("#mbSenha", m.caixa).value;
    var papel = $("#mbPapel", m.caixa).value === "admin" ? "admin" : "equipe";
    var deptos = [];
    UI.$$("[data-depto]", m.caixa).forEach(function (c) {
      if (c.checked) deptos.push(c.getAttribute("data-depto"));
    });
    if (!nome) { $("#mbNome", m.caixa).focus(); UI.toast("Informe o nome.", "erro"); return; }

    /* O CAMPO DE UID SAIU DAQUI, em 2026-08-24.

       Ele servia para vincular alguém que já tivesse conta de
       login sem crachá — situação que era comum porque remover um
       membro apagava só o crachá e deixava a conta para trás.
       Agora remover apaga as duas coisas, então essa situação
       praticamente não acontece mais, e o campo só somava um passo
       confuso a um formulário que precisa ser óbvio.

       Sobra um caso raro: a conta de login nascer e a gravação do
       crachá falhar por rede no mesmo instante. Aí a conta fica
       órfã e invisível no painel. A saída, que as mensagens de
       erro abaixo explicam, é apagá-la em Authentication e
       cadastrar de novo. Um caminho de recuperação a menos, mas um
       formulário mais simples — e é o formulário que se usa
       sempre. */
    if (!U.validaEmail(email)) {
      $("#mbEmail", m.caixa).focus();
      UI.toast("Digite um e-mail válido.", "erro");
      return;
    }
    if (!senha || senha.length < 6) {
      $("#mbSenha", m.caixa).focus();
      UI.toast("A senha precisa ter pelo menos 6 caracteres.", "erro");
      return;
    }

    ocupar(m, true);

    comLimite(FB.criarContaEquipe(email, senha), m).then(function (uid) {
      gravarMembro(uid, nome, email, papel, deptos, m);
    }, function (e) {
      ocupar(m, false);
      var msg = FB.explicar(e);
      UI.toast(msg, "erro", 11000);
    });
  }

  function gravarMembro(uid, nome, email, papel, deptos, m) {
    if (membros.some(function (x) { return x.uid === uid; })) {
      UI.toast(FB.explicar(new Error("ja-e-membro")), "erro");
      return;
    }
    ocupar(m, true, "Gravando…");

    comLimite(FB.db.collection("usuarios").doc(uid).set(assinado({
      nome: nome, email: email, papel: papel, departamentos: deptos || []
    })), m).then(function () {
      UI.fecharModal();
      UI.toast(nome + " agora tem acesso ao painel.", "ok", 7000);
      carregar();
    }, function (e) {
      ocupar(m, false);
      /* A conta de login nasceu e o crachá não. Cadastrar de novo
         com os MESMOS dados conclui: a criação entra na conta que
         já existe, descobre o uid e grava o crachá que faltou. */
      UI.toast("A conta de login foi criada, mas o acesso ao painel não: " + FB.explicar(e) +
               " Tente cadastrar de novo com o mesmo e-mail e a mesma senha — o painel conclui " +
               "o que faltou.", "erro", 14000);
    });
  }

  /* ---------- Departamentos ----------

     Marcar NENHUM é uma escolha válida e quer dizer "cuida de
     todos" — está escrito na tela, porque um formulário todo
     desmarcado normalmente significa o contrário. */
  function abrirDepartamentos(uid) {
    if (!souAdmin()) { UI.toast(FB.explicar(new Error("so-admin")), "erro"); return; }
    var alvo = membros.filter(function (x) { return x.uid === uid; })[0];
    if (!alvo) return;

    var lista = global.Departamentos.todos();
    var m = UI.modal({
      titulo: "Departamentos de " + (alvo.nome || alvo.email),
      corpoHTML:
        '<p style="font-size:13.5px;line-height:1.65;color:var(--txt-2);margin-bottom:14px">' +
          'A tela de início mostra primeiro o que é dos setores marcados. Mexer em documento ' +
          'de outro setor continua permitido — só aparece um aviso antes.</p>' +
        '<div class="deptos">' +
          lista.map(function (g) {
            var ligado = alvo.departamentos.indexOf(g.id) > -1;
            return '<label class="depto' + (ligado ? " depto--on" : "") + '">' +
              '<input type="checkbox" data-depto="' + U.escAttr(g.id) + '"' +
                (ligado ? " checked" : "") + '>' +
              '<span class="depto__txt">' + U.esc(g.titulo) + '</span>' +
            '</label>';
          }).join("") +
        '</div>' +
        '<p class="text-xs text-muted" style="margin-top:12px">Nenhum marcado = cuida de todos ' +
          'os departamentos.</p>',
      acoes: [
        { rotulo: "Cancelar", classe: "btn--ghost" },
        {
          rotulo: "Salvar", classe: "btn--primary", fecharAntes: false,
          onClick: function () {
            var escolhidos = [];
            UI.$$("[data-depto]", m.caixa).forEach(function (c) {
              if (c.checked) escolhidos.push(c.getAttribute("data-depto"));
            });
            salvarDepartamentos(alvo, escolhidos, m);
          }
        }
      ]
    });

    /* O contorno aceso segue a caixa marcada, senão o estado só
       aparece no quadradinho e some de longe. */
    m.caixa.addEventListener("change", function (ev) {
      var c = ev.target.closest("[data-depto]");
      if (!c) return;
      c.closest(".depto").classList.toggle("depto--on", c.checked);
    });
  }

  function salvarDepartamentos(alvo, escolhidos, m) {
    ocupar(m, true, "Salvando…");
    comLimite(FB.db.collection("usuarios").doc(alvo.uid).set({
      nome: alvo.nome, email: alvo.email, papel: alvo.papel,
      departamentos: escolhidos
    }), m).then(function () {
      UI.fecharModal();
      UI.toast(escolhidos.length
        ? (alvo.nome || alvo.email) + " agora cuida de " +
          global.Departamentos.nomesDos(escolhidos) + "."
        : (alvo.nome || alvo.email) + " passa a cuidar de todos os departamentos.", "ok", 7000);
      carregar();
      /* Mudou o próprio setor: a tela de início precisa refazer a
         conta na hora, senão continua mostrando a fila antiga. */
      if (equipe && alvo.uid === equipe.uid) {
        equipe.departamentos = escolhidos;
        if (global.PainelInicio) global.PainelInicio.redesenhar();
      }
    }, function (e) {
      ocupar(m, false, "Salvar");
      UI.toast("Não foi possível salvar: " + FB.explicar(e), "erro", 9000);
    });
  }

  /* ---------- Alterar e remover ---------- */
  function trocarPapel(uid) {
    var alvo = membros.filter(function (x) { return x.uid === uid; })[0];
    if (!alvo) return;
    var novo = alvo.papel === "admin" ? "equipe" : "admin";

    UI.confirmar({
      titulo: novo === "admin" ? "Tornar administrador" : "Tornar equipe",
      mensagem: novo === "admin"
        ? U.esc(alvo.nome || alvo.email) + " passa a abrir as senhas dos clientes e a " +
          "gerenciar quem entra no painel."
        : U.esc(alvo.nome || alvo.email) + " deixa de abrir senhas e de gerenciar a equipe. " +
          "Continua vendo clientes e conferindo documentos.",
      confirmar: "Confirmar"
    }).then(function (ok) {
      if (!ok) return;
      /* `departamentos` vai junto de propósito: este `set` grava o
         documento inteiro, e sem repetir o campo a troca de papel
         apagaria os setores da pessoa sem ninguém notar. */
      FB.db.collection("usuarios").doc(uid).set(assinado({
        nome: alvo.nome, email: alvo.email, papel: novo,
        departamentos: alvo.departamentos || []
      })).then(function () {
        UI.toast("Papel alterado.", "ok");
        carregar();
      }, function (e) {
        UI.toast("Não foi possível alterar: " + FB.explicar(e), "erro", 9000);
      });
    });
  }

  function remover(uid) {
    var alvo = membros.filter(function (x) { return x.uid === uid; })[0];
    if (!alvo) return;

    UI.confirmar({
      titulo: "Remover do painel",
      mensagem: (alvo.nome || alvo.email) + " perde o acesso na hora, e a conta de login é " +
                "apagada junto. Não fica nada para trás. Para devolver o acesso depois, é " +
                "cadastrar de novo — com senha nova.",
      confirmar: "Remover", perigo: true
    }).then(function (ok) {
      if (!ok) return;

      /* O CRACHÁ SAI PRIMEIRO, e a ordem importa: a função do
         servidor recusa apagar quem tem documento em /usuarios —
         é a trava que impede uma exclusão de cliente derrubar
         alguém da equipe por engano. Com o crachá fora, a conta
         deixa de ser da equipe e a exclusão passa. */
      /* O CARIMBO VEM ANTES DA EXCLUSÃO, e não é capricho: quando
         o documento some, some junto qualquer chance de saber quem
         mandou removê-lo — o gatilho que escreve a trilha só tem o
         "antes" para olhar. Assinando primeiro, o "antes" já chega
         nomeado. Esta gravação não gera evento nenhum: nada de
         papel mudou, e o documento não nasceu nem morreu aqui. */
      FB.db.collection("usuarios").doc(uid).set(assinado({}), { merge: true })
        .catch(function () { /* sem autoria é pior que sem remoção: segue */ })
        .then(function () {
          return FB.db.collection("usuarios").doc(uid).delete();
        }).then(function () {
        carregar();
        return FB.db.collection("exclusoesDeConta").doc().set({
          pedidoPor: (FB.equipe && FB.equipe.uid) || "",
          uids: [uid],
          em: FB.agora()
        });
      }).then(function () {
        UI.toast("Acesso removido e conta de login apagada.", "ok", 6000);
      }, function (e) {
        /* O crachá pode ter saído e a conta não. Dizer qual das
           duas coisas falhou é o que evita alguém achar que a
           pessoa ainda entra no painel — ela não entra. */
        carregar();
        UI.toast("O acesso ao painel foi removido, mas a conta de login pode ter ficado: " +
                 FB.explicar(e) + " Confira em Authentication, no console do Firebase.",
                 "erro", 12000);
      });
    });
  }

  /* ============================================================
     A própria conta
     ============================================================ */
  function trocarMeuNome() {
    if (!equipe) return;
    var m = UI.modal({
      titulo: "Seu nome de exibição",
      corpoHTML:
        '<p style="font-size:13.5px;line-height:1.65;color:var(--txt-2);margin-bottom:12px">' +
          'É como você aparece no painel e como o cliente vê quem pediu uma correção ou ' +
          'aprovou um documento.</p>' +
        '<div class="field" style="margin-bottom:0">' +
          '<input type="text" class="input" id="eqNomeNovo" maxlength="120" data-focus ' +
            'autocomplete="name" value="' + U.escAttr(equipe.nome || "") + '">' +
        '</div>',
      acoes: [
        { rotulo: "Cancelar", classe: "btn--ghost" },
        {
          rotulo: "Salvar", classe: "btn--primary",
          onClick: function () {
            var novo = $("#eqNomeNovo", m.caixa).value.trim();
            if (!novo) { UI.toast("Escreva um nome.", "erro"); return; }
            FB.db.collection("usuarios").doc(equipe.uid)
              .set({ nome: novo.slice(0, 120) }, { merge: true })
              .then(function () {
                equipe.nome = novo;
                carregar();
                UI.toast("Nome atualizado.", "ok");
              }, function (e) {
                UI.toast("Não foi possível salvar: " + FB.explicar(e), "erro", 9000);
              });
          }
        }
      ]
    });
  }

  /* A senha atual é pedida de propósito.

     O Firebase exige reautenticação para trocar senha depois de um
     tempo de sessão, e pedir sempre evita a mensagem críptica que
     aparece quando ele resolve exigir. Mais importante: é o que
     impede que um painel deixado aberto numa mesa vire uma conta
     tomada por quem passar por ali. */
  function trocarMinhaSenha() {
    if (!equipe) return;
    var m = UI.modal({
      titulo: "Trocar minha senha",
      corpoHTML:
        '<div class="field">' +
          '<label class="field__label" for="eqSenhaAtual">Senha atual</label>' +
          '<input type="password" class="input" id="eqSenhaAtual" data-focus ' +
            'autocomplete="current-password"></div>' +
        '<div class="field">' +
          '<label class="field__label" for="eqSenhaNova">Senha nova</label>' +
          '<input type="password" class="input" id="eqSenhaNova" minlength="6" ' +
            'autocomplete="new-password"></div>' +
        '<div class="field" style="margin-bottom:0">' +
          '<label class="field__label" for="eqSenhaConf">Repita a senha nova</label>' +
          '<input type="password" class="input" id="eqSenhaConf" minlength="6" ' +
            'autocomplete="new-password"></div>',
      acoes: [
        { rotulo: "Cancelar", classe: "btn--ghost" },
        {
          rotulo: "Trocar", classe: "btn--primary",
          onClick: function () {
            var atual = $("#eqSenhaAtual", m.caixa).value;
            var nova = $("#eqSenhaNova", m.caixa).value;
            var conf = $("#eqSenhaConf", m.caixa).value;
            if (nova.length < 6) { UI.toast("A senha nova precisa de 6 caracteres ou mais.", "erro"); return; }
            if (nova !== conf) { UI.toast("As duas senhas novas não são iguais.", "erro"); return; }
            FB.trocarMinhaSenha(atual, nova).then(function () {
              UI.toast("Senha trocada. Ela vale a partir de agora, em todos os aparelhos.", "ok", 7000);
            }, function (e) {
              UI.toast("Não foi possível trocar: " + FB.explicar(e), "erro", 9000);
            });
          }
        }
      ]
    });
  }

  /* ============================================================
     Trocar a senha de outra pessoa (só administrador)

     Quem esqueceu a senha e também não tem mais o e-mail de
     trabalho à mão não conseguia voltar sozinho, e o administrador
     não tinha por onde ajudar sem abrir o console do Firebase.

     A senha vai SELADA com a chave pública da Totali e é aberta
     dentro da Cloud Function. Não passa legível pelo Firestore em
     momento nenhum — ver a nota em functions/senhas.js.
     ============================================================ */
  function trocarSenhaDe(uid) {
    var alvo = membros.filter(function (x) { return x.uid === uid; })[0];
    if (!alvo || !souAdmin()) return;

    var C = global.Cripto;
    if (!C || !C.disponivel || !C.configurada) {
      UI.toast("O canal seguro não está configurado — sem ele a senha viajaria às claras. " +
               "Configure em Segurança.", "erro", 10000);
      return;
    }

    var m = UI.modal({
      titulo: "Trocar a senha de " + (alvo.nome || alvo.email),
      corpoHTML:
        '<p style="font-size:13.5px;line-height:1.65;color:var(--txt-2);margin-bottom:12px">' +
          'A senha atual desta pessoa deixa de valer na hora, em todos os aparelhos. ' +
          'Combine a nova por um canal separado do e-mail — e peça que ela troque depois, ' +
          'em <strong>Sua conta</strong>.</p>' +
        '<div class="field">' +
          '<label class="field__label" for="eqNovaDele">Senha nova</label>' +
          '<input type="password" class="input" id="eqNovaDele" minlength="6" data-focus ' +
            'autocomplete="new-password"></div>' +
        '<div class="field" style="margin-bottom:0">' +
          '<label class="field__label" for="eqNovaDeleConf">Repita a senha nova</label>' +
          '<input type="password" class="input" id="eqNovaDeleConf" minlength="6" ' +
            'autocomplete="new-password"></div>',
      acoes: [
        { rotulo: "Cancelar", classe: "btn--ghost" },
        {
          rotulo: "Trocar senha", classe: "btn--primary",
          onClick: function () {
            var nova = $("#eqNovaDele", m.caixa).value;
            var conf = $("#eqNovaDeleConf", m.caixa).value;
            if (nova.length < 6) { UI.toast("A senha precisa de 6 caracteres ou mais.", "erro"); return; }
            if (nova !== conf) { UI.toast("As duas senhas não são iguais.", "erro"); return; }
            enviarTrocaDeSenha(alvo, nova);
          }
        }
      ]
    });
  }

  function enviarTrocaDeSenha(alvo, nova) {
    var C = global.Cripto;
    UI.toast("Trocando a senha…", "info", 8000);

    /* `cifrar` recebe um objeto, e é o mesmo formato que a função
       do servidor sabe abrir — o envelope das credenciais do
       cliente também viaja assim. */
    C.cifrar({ senha: nova }).then(function (pacote) {
      var ref = FB.db.collection("pedidosDeTrocaDeSenha").doc();
      var parar = null;
      var relogio = null;
      var respondido = false;

      var soltar = function (msg, tipo) {
        if (respondido) return;
        respondido = true;
        if (parar) { try { parar(); } catch (e) {} }
        if (relogio) clearTimeout(relogio);
        if (msg) UI.toast(msg, tipo || "ok", tipo === "erro" ? 10000 : 7000);
      };

      /* A resposta vem da função, no mesmo documento. Escutar é o
         que existe: `onCall` não é possível neste projeto. */
      var escutar = function () {
        parar = ref.onSnapshot(function (d) {
          var r = d.data() || {};
          if (!r.concluidoEm) return;
          if (r.erro) soltar(r.erro, "erro");
          else soltar("Senha trocada. Avise " + (alvo.nome || alvo.email) +
                      " por um canal separado do e-mail.", "ok");
        }, function () {
          soltar("Não foi possível acompanhar o resultado. Confira em instantes.", "erro");
        });
        relogio = setTimeout(function () {
          soltar("O servidor não respondeu a tempo. Confira se a senha trocou antes de tentar de novo.",
                 "erro");
        }, 30000);
      };

      return ref.set({
        pedidoPor: (equipe && equipe.uid) || "",
        alvo: alvo.uid,
        pacote: pacote,
        em: FB.agora()
      }).then(escutar, function (e) {
        soltar("Não foi possível pedir: " + FB.explicar(e), "erro");
      });
    }, function () {
      UI.toast("Este navegador não conseguiu selar a senha com segurança.", "erro", 9000);
    });
  }

  /* ---------- Início ---------- */
  function ligar() {
    var b = $("#eqAdicionar");
    if (b) b.addEventListener("click", abrirFormulario);

    document.addEventListener("click", function (ev) {
      var alvo = ev.target.closest ? ev.target : null;
      if (!alvo) return;
      var dp = alvo.closest("[data-deptos]");
      if (dp) { abrirDepartamentos(dp.getAttribute("data-deptos")); return; }
      var p = alvo.closest("[data-papel]");
      if (p) { trocarPapel(p.getAttribute("data-papel")); return; }
      var r = alvo.closest("[data-remover-membro]");
      if (r) { remover(r.getAttribute("data-remover-membro")); return; }
      var ts = alvo.closest("[data-trocar-senha]");
      if (ts) { trocarSenhaDe(ts.getAttribute("data-trocar-senha")); return; }
      if (alvo.closest("#eqMeuNome")) { trocarMeuNome(); return; }
      if (alvo.closest("#eqMinhaSenha")) { trocarMinhaSenha(); return; }
    });
  }

  function iniciar() {
    if (!$("#eqLista")) return;
    FB = global.FB;
    if (!FB || !FB.ligado) {
      $("#eqLista").innerHTML = '<div class="card card--pad"><p class="text-sm text-muted">' +
        'A lista da equipe precisa de conexão com o servidor.</p></div>';
      return;
    }
    ligar();
    FB.observarSessao(function (quem) {
      equipe = quem;
      if (quem) carregar();
      else { membros = []; desenhar(); }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})(window);
