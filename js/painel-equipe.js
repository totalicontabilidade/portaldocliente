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
          papel: m.papel === "admin" ? "admin" : "equipe"
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
          '<div class="item__actions">' +
            (euMesmo
              ? '<span class="text-xs text-muted">Você não pode alterar o próprio acesso — ' +
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
    return '<p style="font-size:13.5px;line-height:1.65;color:var(--txt-2);margin-bottom:14px">' +
        'A pessoa recebe uma senha provisória e troca no primeiro acesso, em ' +
        '"Esqueci minha senha".</p>' +
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
        '<label class="field__label" for="mbSenha">Senha provisória<span class="field__req">*</span></label>' +
        '<input type="text" class="input" id="mbSenha" maxlength="60" autocomplete="off">' +
        '<div class="field__hint">Pelo menos 6 caracteres. Combine por um canal seguro e peça ' +
          'para trocar no primeiro acesso.</div></div>' +
      '<div class="field">' +
        '<label class="field__label" for="mbPapel">Papel</label>' +
        '<select class="select" id="mbPapel">' +
          '<option value="equipe">Equipe — vê clientes, confere documentos, conversa e cobra</option>' +
          '<option value="admin">Administrador — tudo isso, mais abrir senhas e gerenciar a equipe</option>' +
        '</select></div>' +
      '<hr class="hr">' +
      '<div class="field" style="margin-bottom:0">' +
        '<label class="field__label" for="mbUid">Já tem conta? Cole o UID</label>' +
        '<input type="text" class="input" id="mbUid" maxlength="128" autocomplete="off" ' +
          'placeholder="deixe vazio para criar uma conta nova">' +
        '<div class="field__hint">Se a pessoa já tem login no Firebase, copie o UID em ' +
          'Authentication e cole aqui. Nesse caso, e-mail e senha acima são ignorados.</div></div>';
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

  function salvarNovo(m) {
    var nome = $("#mbNome", m.caixa).value.trim();
    var email = $("#mbEmail", m.caixa).value.trim();
    var senha = $("#mbSenha", m.caixa).value;
    var papel = $("#mbPapel", m.caixa).value === "admin" ? "admin" : "equipe";
    var uidColado = $("#mbUid", m.caixa).value.trim();

    if (!nome) { $("#mbNome", m.caixa).focus(); UI.toast("Informe o nome.", "erro"); return; }

    /* Caminho 1: a pessoa já tem conta e o admin colou o UID. */
    if (uidColado) {
      if (!/^[A-Za-z0-9]{20,128}$/.test(uidColado)) {
        UI.toast(FB.explicar(new Error("uid-invalido")), "erro", 9000);
        return;
      }
      gravarMembro(uidColado, nome, email, papel, m);
      return;
    }

    /* Caminho 2: cria a conta e o vínculo. */
    if (!U.validaEmail(email)) {
      $("#mbEmail", m.caixa).focus();
      UI.toast("Digite um e-mail válido.", "erro");
      return;
    }
    if (!senha || senha.length < 6) {
      $("#mbSenha", m.caixa).focus();
      UI.toast("A senha provisória precisa ter pelo menos 6 caracteres.", "erro");
      return;
    }

    var botao = $('[data-acao="1"]', m.caixa);
    if (botao) { botao.disabled = true; botao.textContent = "Criando…"; }

    FB.criarContaEquipe(email, senha).then(function (uid) {
      gravarMembro(uid, nome, email, papel, m);
    }, function (e) {
      if (botao) { botao.disabled = false; botao.textContent = "Adicionar"; }
      var msg = (e && e.code === "auth/email-already-in-use")
        ? "Já existe uma conta com este e-mail. Copie o UID dela em Authentication e cole no " +
          "campo do fim do formulário."
        : FB.explicar(e);
      UI.toast(msg, "erro", 11000);
    });
  }

  function gravarMembro(uid, nome, email, papel, m) {
    if (membros.some(function (x) { return x.uid === uid; })) {
      UI.toast(FB.explicar(new Error("ja-e-membro")), "erro");
      return;
    }
    FB.db.collection("usuarios").doc(uid).set({
      nome: nome, email: email, papel: papel
    }).then(function () {
      UI.fecharModal();
      UI.toast(nome + " agora tem acesso ao painel.", "ok", 7000);
      carregar();
    }, function (e) {
      var botao = $('[data-acao="1"]', m.caixa);
      if (botao) { botao.disabled = false; botao.textContent = "Adicionar"; }
      UI.toast("Conta criada, mas não foi possível dar o acesso: " + FB.explicar(e), "erro", 11000);
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
      FB.db.collection("usuarios").doc(uid).set({
        nome: alvo.nome, email: alvo.email, papel: novo
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
      mensagem: (alvo.nome || alvo.email) + " perde o acesso ao painel na hora. A conta de " +
                "login continua existindo, mas sem poder nenhum aqui dentro. Para devolver o " +
                "acesso depois, basta adicionar de novo com o UID.",
      confirmar: "Remover", perigo: true
    }).then(function (ok) {
      if (!ok) return;
      FB.db.collection("usuarios").doc(uid).delete().then(function () {
        UI.toast("Acesso removido.", "ok");
        carregar();
      }, function (e) {
        UI.toast("Não foi possível remover: " + FB.explicar(e), "erro", 9000);
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
