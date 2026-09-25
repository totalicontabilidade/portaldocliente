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
   ============================================================ */
(function (global) {
  "use strict";
  var UI = global.UI;

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

  global.Seguranca = { avaliarSenha: avaliarSenha, senhaVazada: senhaVazada, copiarSegredo: copiarSegredo, esconderSegredos: esconderSegredos, limparAparelho: limparAparelho };
})(window);
