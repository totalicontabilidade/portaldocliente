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
   Só administrador. E isso não é a tela que decide: a regra do
   servidor exige `ehAdmin()` para escrever em /usuarios/{uid}.
   Esconder o formulário é conveniência; a barreira é a regra.

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

  /* ---------- Leitura ---------- */
  function carregar() {
    if (!FB || !FB.ligado || !souAdmin()) { desenhar(); return Promise.resolve(); }
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

  /* ---------- Tela ---------- */
  function desenhar() {
    var caixa = $("#eqLista");
    if (!caixa) return;

    if (!souAdmin()) {
      caixa.innerHTML = '<div class="card card--pad"><p class="text-sm text-muted">' +
        'Só quem é administrador vê e altera a lista da equipe. Se você precisa incluir ' +
        'alguém, peça a um administrador.</p></div>';
      var b = $("#eqAdicionar");
      if (b) b.hidden = true;
      return;
    }

    var botao = $("#eqAdicionar");
    if (botao) botao.hidden = false;

    if (carregando) {
      caixa.innerHTML = '<div class="card card--pad"><p class="text-sm text-muted">' +
        'Carregando…</p></div>';
      return;
    }

    if (!membros.length) {
      caixa.innerHTML = '<div class="card"><div class="empty">' +
        '<div class="empty__icon">' + ic("ic-users") + '</div>' +
        '<div class="empty__title">Nenhum membro cadastrado</div>' +
        '<div class="empty__desc">Estranho: você está usando o painel, então deveria haver ' +
        'ao menos um. Recarregue a página.</div></div></div>';
      return;
    }

    caixa.innerHTML = '<div class="card">' + membros.map(function (m) {
      var euMesmo = equipe && m.uid === equipe.uid;
      return '<div class="item"><div class="item__top">' +
        '<span class="group__icon">' + ic(m.papel === "admin" ? "ic-shield" : "ic-users") + '</span>' +
        '<div class="item__main">' +
          '<div class="item__name">' + U.esc(m.nome || m.email || "sem nome") +
            (euMesmo ? ' <span class="text-xs text-muted">· você</span>' : '') + '</div>' +
          '<div class="item__row">' +
            '<span class="badge ' + (m.papel === "admin" ? "badge--aprovado" : "badge--analise") + '">' +
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
          '</div>' +
          '<div class="item__actions">' +
            '<button type="button" class="btn btn--quiet btn--sm" data-deptos="' +
              U.escAttr(m.uid) + '">Departamentos</button>' +
            (euMesmo
              ? '<span class="text-xs text-muted">Você não pode alterar o próprio papel — ' +
                'é o que impede o painel de ficar sem administrador.</span>'
              : '<button type="button" class="btn btn--ghost btn--sm" data-papel="' +
                  U.escAttr(m.uid) + '">' +
                  (m.papel === "admin" ? "Tornar equipe" : "Tornar administrador") + '</button>' +
                '<button type="button" class="btn btn--quiet btn--sm" data-remover-membro="' +
                  U.escAttr(m.uid) + '">Remover</button>') +
          '</div>' +
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
        '<div class="field__hint">Pelo menos 6 caracteres.</div></div>' +
      '<div class="field">' +
        '<label class="field__label" for="mbPapel">Papel</label>' +
        '<select class="select" id="mbPapel">' +
          '<option value="equipe">Equipe — vê clientes, confere documentos, conversa e cobra</option>' +
          '<option value="admin">Administrador — tudo isso, mais abrir senhas e gerenciar a equipe</option>' +
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
      UI.toast("A gravação está demorando demais. Verifique a internet. Se a conta chegou a ser " +
               "criada, ela aparece em Authentication, no console do Firebase — apague-a de lá " +
               "e cadastre de novo por aqui.", "erro", 14000);
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
      var msg = (e && e.code === "auth/email-already-in-use")
        ? "Já existe uma conta de login com este e-mail, sem acesso ao painel. Apague-a em " +
          "Authentication, no console do Firebase, e cadastre de novo por aqui."
        : FB.explicar(e);
      UI.toast(msg, "erro", 11000);
    });
  }

  function gravarMembro(uid, nome, email, papel, deptos, m) {
    if (membros.some(function (x) { return x.uid === uid; })) {
      UI.toast(FB.explicar(new Error("ja-e-membro")), "erro");
      return;
    }
    ocupar(m, true, "Gravando…");

    comLimite(FB.db.collection("usuarios").doc(uid).set({
      nome: nome, email: email, papel: papel, departamentos: deptos || []
    }), m).then(function () {
      UI.fecharModal();
      UI.toast(nome + " agora tem acesso ao painel.", "ok", 7000);
      carregar();
    }, function (e) {
      ocupar(m, false);
      /* A conta de login nasceu e o crachá não. Ela fica órfã e
         invisível aqui dentro — cadastrar de novo esbarraria em
         "e-mail já em uso". Por isso a saída é o console. */
      UI.toast("A conta de login foi criada, mas o acesso ao painel não: " + FB.explicar(e) +
               " Apague a conta em Authentication, no console do Firebase, e cadastre de novo.",
               "erro", 14000);
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
      FB.db.collection("usuarios").doc(uid).set({
        nome: alvo.nome, email: alvo.email, papel: novo,
        departamentos: alvo.departamentos || []
      }).then(function () {
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
      FB.db.collection("usuarios").doc(uid).delete().then(function () {
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
