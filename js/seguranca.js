/* ============================================================
   Totali · Portal do Cliente
   seguranca.js — defesas que vivem no navegador

   O que protege o sistema de verdade são as REGRAS do Firestore e
   do Storage, o App Check e as Cloud Functions (docs/02-seguranca.md).
   Este arquivo cuida do que só o navegador pode fazer:

     1. A sessão fica aberta até a pessoa tocar em Sair (não expira
        por inatividade).
     2. A página recusa ser embutida por outro site (clickjacking).
        A CSP em <meta> não aceita frame-ancestors; então é aqui.
     3. Senha nova: tamanho mínimo, variedade e conferência contra a
        base de senhas vazadas (Have I Been Pwned, por k-anonimato:
        só os 5 primeiros caracteres do SHA-1 saem do aparelho).
     4. Segredos na tela (senha aberta no cofre) somem quando a aba
        perde o foco ou fica escondida, e a área de transferência é
        limpa 30 s depois de copiar.
     5. Sair limpa tudo o que ficou no aparelho: preferências de
        vitrine, rascunhos, caches de tela.
     6. Trocar a própria senha (Perfil): confirma a atual, aplica as
        mesmas regras da senha nova e grava no Firebase Auth.
   ============================================================ */
(function (global) {
  "use strict";
  var UI = global.UI, U = global.U;

  /* ---------- 2. Anti-clickjacking ---------- */
  /* Só outra ORIGEM é clickjacking; uma prévia interna (design/) na mesma origem pode embutir. */
  try { if (global.top !== global.self && global.top.location.origin !== global.location.origin) { global.top.location = global.self.location; } } catch (e) { try { global.top.location = global.self.location; } catch (e2) { document.documentElement.innerHTML = ""; } }

  /* ---------- 1. Sessão ---------- */
  /* Sem encerramento por inatividade (pedido do Raoni, 25/09/2026): a sessão fica aberta até a pessoa tocar em Sair.
     Continuam valendo: segredos do cofre somem ao trocar de aba (item 4) e Sair limpa o aparelho (item 5). */

  /* ---------- 4. Segredos na tela ---------- */
  function esconderSegredos() {
    document.querySelectorAll("[data-segredo]").forEach(function (el) { el.textContent = "••••••••••"; el.classList.remove("txt-gold"); el.removeAttribute("data-segredo"); });
  }
  document.addEventListener("visibilitychange", function () { if (document.hidden) esconderSegredos(); });
  global.addEventListener("blur", esconderSegredos);

  /* ---------- 3. Senhas ---------- */
  var COMUNS = ["12345678", "123456789", "1234567890", "senha1234", "password", "qwertyuiop", "abcd1234", "totali123", "contabil", "12341234", "11111111", "00000000"];
  function avaliarSenha(s) {
    s = String(s || "");
    if (s.length < 10) return { ok: false, motivo: "Use pelo menos 10 caracteres." };
    if (COMUNS.indexOf(s.toLowerCase()) > -1 || /^(\d)\1+$/.test(s)) return { ok: false, motivo: "Essa senha é muito comum." };
    var tipos = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(function (r) { return r.test(s); }).length;
    if (tipos < 2 && s.length < 16) return { ok: false, motivo: "Misture letras, números ou símbolos (ou use uma frase longa)." };
    return { ok: true, forca: s.length >= 16 && tipos >= 3 ? "forte" : "boa" };
  }
  /* Have I Been Pwned, k-anonimato: manda 5 caracteres do hash, recebe a lista e compara aqui. Falha de rede = não bloqueia. */
  function senhaVazada(s) {
    if (!global.crypto || !global.crypto.subtle) return Promise.resolve(false);
    return global.crypto.subtle.digest("SHA-1", new TextEncoder().encode(s)).then(function (h) {
      var hex = Array.prototype.map.call(new Uint8Array(h), function (b) { return (b + 0x100).toString(16).slice(1); }).join("").toUpperCase();
      var prefixo = hex.slice(0, 5), resto = hex.slice(5);
      return fetch("https://api.pwnedpasswords.com/range/" + prefixo, { headers: { "Add-Padding": "true" } }).then(function (r) { return r.ok ? r.text() : ""; })
        .then(function (t) { return t.split("\n").some(function (l) { var p = l.trim().split(":"); return p[0] === resto && Number(p[1]) > 0; }); });
    }).catch(function () { return false; });
  }

  /* ---------- 4b. Copiar segredo e limpar ---------- */
  function copiarSegredo(texto) {
    return navigator.clipboard.writeText(texto).then(function () {
      UI.toast("Copiado. A área de transferência é limpa em 30 s.", "info");
      setTimeout(function () { navigator.clipboard.writeText(" ").catch(function () {}); }, 30000);
    });
  }

  /* ---------- 5. Limpeza ao sair ---------- */
  function limparAparelho() {
    try { ["totali-portal-vitrine", "totali-portal-mini"].forEach(function (k) { localStorage.removeItem(k); }); } catch (e) {}
    try { sessionStorage.clear(); } catch (e) {}
  }

  /* ---------- 6. Trocar a própria senha (portal e painel) ---------- */
  function abrirTrocaDeSenha() {
    var ic = global.ic, enviando = false;
    function campo(id, rotulo, auto, ajuda) {
      return '<div class="campo"><label class="campo__rotulo" for="' + id + '">' + rotulo + '</label><div class="input--icone">' + ic("key") + '<input class="input" id="' + id + '" type="password" autocomplete="' + auto + '" required><button type="button" class="acao" data-ver="' + id + '">mostrar</button></div>' + (ajuda ? '<span class="campo__ajuda">' + ajuda + "</span>" : "") + "</div>";
    }
    var m = UI.modal({
      titulo: "Alterar senha",
      corpo: '<form class="pilha" id="formSenha" novalidate>' +
        campo("sAtual", "Senha atual", "current-password") +
        campo("sNova", "Nova senha", "new-password", "Mínimo de 10 caracteres, misturando letras e números. Conferimos contra senhas vazadas.") +
        campo("sConf", "Repita a nova senha", "new-password") +
        '<p class="campo__erro" id="erroSenha" hidden role="alert"></p>' +
        '<button type="submit" hidden></button></form>',
      acoes: [{ rotulo: "Cancelar", classe: "btn--fantasma" }, { rotulo: "Salvar nova senha", classe: "btn--primario", manter: true, ao: function () { m.corpo.querySelector("#formSenha").requestSubmit(); return false; } }]
    });
    var c = m.corpo, erro = c.querySelector("#erroSenha");
    UI.$$("[data-ver]", c).forEach(function (b) { b.addEventListener("click", function () { var i = c.querySelector("#" + b.dataset.ver); i.type = i.type === "password" ? "text" : "password"; b.textContent = i.type === "password" ? "mostrar" : "ocultar"; }); });
    function falhar(t, foco) { erro.textContent = t; erro.hidden = false; if (foco) c.querySelector(foco).focus(); }
    c.querySelector("#formSenha").addEventListener("submit", function (e) {
      e.preventDefault(); if (enviando) return; erro.hidden = true;
      var atual = c.querySelector("#sAtual").value, nova = c.querySelector("#sNova").value, conf = c.querySelector("#sConf").value;
      if (!atual) return falhar("Informe a senha atual.", "#sAtual");
      var av = avaliarSenha(nova); if (!av.ok) return falhar(av.motivo, "#sNova");
      if (nova !== conf) return falhar("As duas senhas novas não são iguais.", "#sConf");
      if (nova === atual) return falhar("A nova senha precisa ser diferente da atual.", "#sNova");
      enviando = true;
      var botao = m.el.querySelector(".modal__acoes .btn--primario"); botao.disabled = true; botao.textContent = "Salvando…";
      senhaVazada(nova).then(function (vazou) {
        if (vazou) throw new Error("Essa senha já apareceu em vazamentos na internet. Escolha outra.");
        return global.Dados.trocarSenha(atual, nova);
      }).then(function () {
        m.fechar(); UI.toast("Senha alterada. Use a nova no próximo login.", "ok"); UI.vibrar();
      }).catch(function (err) {
        falhar(U.msgErro(err, "Não foi possível alterar a senha agora. Tente de novo."), /atual/.test(err && err.message || "") ? "#sAtual" : null);
      }).then(function () { enviando = false; if (botao.isConnected) { botao.disabled = false; botao.textContent = "Salvar nova senha"; } });
    });
  }

  global.Seguranca = { avaliarSenha: avaliarSenha, senhaVazada: senhaVazada, copiarSegredo: copiarSegredo, esconderSegredos: esconderSegredos, limparAparelho: limparAparelho, abrirTrocaDeSenha: abrirTrocaDeSenha };
})(window);
