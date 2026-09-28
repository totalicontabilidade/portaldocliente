/* ============================================================
   Totali · Portal do Cliente
   cofre.js — guardar e ver senha (portal e painel usam o mesmo)

   28/09/2026, pedido do Raoni:
     • o cliente vê as senhas da empresa dele (antes só a Totali);
     • a contabilidade também guarda senhas que ela mesma criou para
       o cliente (sites, certificado).
   Como protege: a senha é cifrada no aparelho com a chave pública da
   Totali; para ver, esta aba cria uma chave descartável, o servidor
   abre com a chave privada e devolve recifrada só para esta aba
   (functions/senhas.js). Cada abertura fica na auditoria com o nome
   de quem abriu. Na tela, a senha some em 45 s ou ao trocar de
   janela; Copiar limpa a área de transferência em 30 s.
   ============================================================ */
(function (global) {
  "use strict";
  var U = global.U, UI = global.UI, ic = global.ic;

  var TIPOS = [["certificado", "Senha do certificado digital"], ["simples", "Simples Nacional (código de acesso)"], ["sefaz", "SEFAZ / Nota fiscal eletrônica"], ["empregador", "Empregador Web / eSocial"], ["prefeitura", "Prefeitura (NFS-e / ISS)"], ["gov", "Gov.br"], ["maquininha", "Maquininha (perfil de consulta)"], ["banco", "Internet banking (perfil de consulta)"], ["outro", "Outro sistema"]];

  /* Janela de guardar. opts: { empresaId, sessao, lado: "cliente"|"equipe", aoSalvar } */
  function guardar(opts) {
    var Dados = global.Dados, Cripto = global.Cripto;
    if (!Cripto.configurada && !Dados.ehDemo()) return UI.toast(Cripto.motivo(), "aviso");
    var equipe = opts.lado === "equipe";
    UI.modal({ titulo: equipe ? "Guardar senha para o cliente" : "Guardar senha com segurança", corpo:
      '<div class="pilha">' + (equipe ? '<p class="f-13 txt-2">Para senhas que a Totali criou para o cliente (sites, certificado). O cliente vê no portal, e cada abertura fica registrada.</p>' : "") +
      '<div class="campo"><label class="campo__rotulo" for="ct">Qual sistema</label><select class="select" id="ct">' + TIPOS.map(function (t) { return '<option value="' + t[0] + '">' + t[1] + "</option>"; }).join("") + "</select></div>" +
      '<div class="campo"><label class="campo__rotulo" for="cr">Nome' + (equipe ? "" : " (como você chama)") + '</label><input class="input" id="cr" maxlength="80" placeholder="Ex.: Senha do certificado A1"></div>' +
      '<div class="campo"><label class="campo__rotulo" for="cu">Usuário / login (opcional)</label><input class="input" id="cu" autocomplete="off"></div>' +
      '<div class="campo"><label class="campo__rotulo" for="cs">Senha</label><input class="input senha-campo" id="cs" type="password" autocomplete="new-password"></div>' +
      '<div class="campo"><label class="campo__rotulo" for="co">Observação (opcional)</label><input class="input" id="co" placeholder="Ex.: pede código por SMS; vence em 12/2027"></div></div>',
      acoes: [{ rotulo: "Cancelar" }, { rotulo: "Guardar com segurança", classe: "btn--primario", icone: "lock", ao: function (c) {
        var tipo = c.querySelector("#ct").value, rot = c.querySelector("#cr").value.trim() || TIPOS.filter(function (t) { return t[0] === tipo; })[0][1];
        var senha = c.querySelector("#cs").value; if (!senha) { UI.toast("Digite a senha.", "aviso"); return false; }
        var dados = { senha: senha, usuario: c.querySelector("#cu").value.trim(), obs: c.querySelector("#co").value.trim(), tipo: tipo };
        var p = Cripto.configurada ? Cripto.cifrar(dados) : Promise.resolve({ demo: true, segredo: btoa(unescape(encodeURIComponent(senha))) });
        p.then(function (pacote) { return Dados.salvarCredencial(opts.empresaId, { rotulo: rot, tipo: tipo, usuario: dados.usuario, pacote: pacote, por: opts.sessao.nome + (equipe ? " · Totali" : "") }); })
          .then(function () { c.querySelector("#cs").value = ""; UI.toast(equipe ? "Guardada. O cliente já vê no portal." : "Guardada com segurança.", "ok"); UI.vibrar(); if (opts.aoSalvar) opts.aoSalvar(); })
          .catch(function (e) { UI.toast(U.msgErro(e, "Não foi possível guardar."), "erro"); });
      } }] });
  }

  /* Ver senha: b = botão "Ver senha", alvo = elemento com os ••••. Mesmo padrão para cliente e equipe. */
  function ver(b, empresaId, credId, sessao, alvo) {
    var Dados = global.Dados, Cripto = global.Cripto, Seg = global.Seguranca;
    b.disabled = true; var rot = b.innerHTML; b.textContent = "Abrindo…";
    var p = Dados.ehDemo() ? Dados.abrirCredencial(empresaId, credId, sessao)
      : Cripto.gerarPar().then(function (par) { return Dados.abrirCredencial(empresaId, credId, sessao, par.publica).then(function (r) { return Cripto.decifrar(r.resposta, par.privada); }); });
    p.then(function (dados) {
      b.innerHTML = rot;
      alvo.textContent = dados.senha + (dados.obs ? "  (" + dados.obs + ")" : ""); alvo.classList.add("txt-gold"); alvo.setAttribute("data-segredo", "1"); b.setAttribute("data-segredo-botao", "1");
      /* copiar é o uso real (colar no site); ao trocar de janela a senha some da tela, mas a cópia vale 30 s */
      var cp = document.createElement("button"); cp.type = "button"; cp.className = "btn btn--xs btn--contorno"; cp.setAttribute("data-segredo-copiar", "1"); cp.innerHTML = ic("copy", "ic--sm") + "Copiar";
      cp.addEventListener("click", function (ev) { ev.stopPropagation(); Seg.copiarSegredo(dados.senha); }); b.parentNode.insertBefore(cp, b);
      UI.toast("Aberta e registrada. Ela some em 45 s ou ao trocar de janela; use Copiar.", "info", null, 6000);
      setTimeout(function () { Seg.esconderSegredos(); }, 45000);
    }).catch(function (err) { b.innerHTML = rot; b.disabled = false; UI.toast(U.msgErro(err, "Não foi possível abrir agora. Tente de novo."), "erro", null, 6000); });
  }

  global.Cofre = { TIPOS: TIPOS, guardar: guardar, ver: ver };
})(window);
