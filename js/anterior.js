/* ============================================================
   Totali · Portal do Cliente
   anterior.js — a página da CONTABILIDADE ANTERIOR (sem login)

   Aberta por link (anterior.html?c=CODIGO) gerado na ficha do
   cliente. Quem tem o link envia contrato, balanços, livros e
   folha; cada arquivo entra em empresas/{id}/documentos com
   origem "anterior" e o cliente vê chegar no portal.

   Por que uma página, e não uma tela do portal: o contador
   anterior não deveria criar conta e aprender um portal para
   entregar o que é obrigação profissional dele entregar. Mesma
   decisão do extratos.html do Academy.

   O que protege: o código de 22 caracteres sorteados. A página
   mostra só o nome fantasia; nenhum dado pessoal, nenhuma senha.
   ============================================================ */
(function (global) {
  "use strict";
  var U = global.U, UI = global.UI, ic = global.ic, Dados = global.Dados;
  var app = document.getElementById("app");
  var GRUPOS = [["societario", "Contrato social e alterações"], ["contabil", "Balancetes, balanço e livros"], ["fiscal", "Declarações, SPED e guias"], ["pessoal", "Folha, fichas de registro e rescisões"], ["certificado", "Certificado digital"], ["outros", "Outros arquivos"]];

  function cabecalho(titulo, sub) {
    return '<div class="login__painel" style="display:flex;min-height:200px;padding:28px"><div class="puzzle-layer puzzle-login"></div><div class="veu"></div><div class="brilho"></div><img src="assets/brand/logo-escuro.png" alt="Totali · Portal do Cliente" style="height:48px;width:auto"><div><p class="login__frase" style="font-size:24px">' + titulo + '</p><p class="f-13" style="color:var(--sidebar-foreground);margin-top:8px">' + sub + "</p></div></div>";
  }
  var codigo = new URLSearchParams(location.search).get("c") || "";
  history.replaceState(null, "", location.pathname);
  app.innerHTML = '<div class="pagina" style="max-width:760px">' + cabecalho("Envio de documentos", "Carregando…") + "</div>";

  Dados.pronto().then(function () { return codigo ? Dados.anterior(codigo) : null; }).then(function (a) {
    if (!a) { app.innerHTML = '<div class="pagina" style="max-width:760px">' + cabecalho("Link inválido", "Este link não existe ou foi desativado. Peça um novo à Totali.") + "</div>"; return; }
    desenhar(a, []);
  });

  function desenhar(a, enviados) {
    app.innerHTML = '<div class="pagina" style="max-width:760px">' + cabecalho("Documentos de <b>" + U.esc(a.empresa) + "</b>", "A Totali Soluções Contábeis assumiu a contabilidade desta empresa. Agradecemos pelo envio dos documentos abaixo: eles entram direto na ficha do cliente, com recibo de recebimento.") +
      '<div class="card"><div class="card__corpo pilha"><div class="campo"><label class="campo__rotulo" for="quem">Quem está enviando (escritório e responsável)</label><input class="input" id="quem" placeholder="Ex.: Contabilidade Silva · Maria" required></div>' +
      '<div class="campo"><label class="campo__rotulo" for="grupo">Tipo de documento</label><select class="select" id="grupo">' + GRUPOS.map(function (g) { return '<option value="' + g[0] + '">' + g[1] + "</option>"; }).join("") + "</select></div>" +
      '<div class="solta" id="solta" tabindex="0" role="button">' + ic("upload") + "<b>Toque para escolher os arquivos</b><span class=\"f-13\">ou arraste aqui · PDF, XML, planilha, imagem, ZIP · até 25 MB cada</span></div><input type=\"file\" id=\"inp\" multiple hidden>" +
      '<div id="lista" class="pilha" style="gap:6px"></div></div></div>' +
      (enviados.length ? '<div class="card"><div class="card__cab"><h2>Enviados agora</h2></div><div class="card__corpo pilha" style="gap:6px;padding-top:10px">' + enviados.map(function (n) { return '<div class="linha f-13">' + ic("check-circle", "txt-ok") + U.esc(n) + "</div>"; }).join("") + '<div class="aviso aviso--ok mt-8">' + ic("check") + "<div><b>Recebido.</b>A Totali e o cliente já veem estes arquivos. Obrigado.</div></div></div></div>" : "") +
      '<p class="login__rodape">Dúvidas: fale com a Totali pelos canais de sempre. Este link é pessoal e pode ser desativado a qualquer momento.</p></div>';
    var solta = UI.$("#solta"), inp = UI.$("#inp"), lista = UI.$("#lista");
    solta.addEventListener("click", function () { inp.click(); });
    solta.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inp.click(); } });
    ["dragenter", "dragover"].forEach(function (ev) { solta.addEventListener(ev, function (e) { e.preventDefault(); solta.setAttribute("data-sobre", ""); }); });
    ["dragleave", "drop"].forEach(function (ev) { solta.addEventListener(ev, function (e) { e.preventDefault(); solta.removeAttribute("data-sobre"); }); });
    solta.addEventListener("drop", function (e) { enviar(e.dataTransfer.files); });
    inp.addEventListener("change", function () { enviar(inp.files); inp.value = ""; });
    function enviar(files) {
      var quem = UI.$("#quem").value.trim(); if (!quem) { UI.toast("Informe quem está enviando.", "aviso"); UI.$("#quem").focus(); return; }
      var arquivos = Array.prototype.slice.call(files || []); if (!arquivos.length) return;
      var erros = arquivos.map(U.validarArquivo).filter(Boolean); if (erros.length) return UI.toast(erros[0], "erro");
      lista.innerHTML = arquivos.map(function (f) { return '<div class="doc"><span class="doc__icone">' + ic("file") + '</span><div style="flex:1"><div class="doc__nome">' + U.esc(f.name) + '</div><div class="doc__meta">enviando… ' + U.tamanho(f.size) + "</div></div></div>"; }).join("");
      var grupo = UI.$("#grupo").value;
      Dados.entrarAnonimo().then(function () { return Promise.all(arquivos.map(function (f) { return Dados.enviarDocumento(a.empresaId, { file: f, grupo: grupo, origem: "anterior", por: quem, codigo: codigo }); })); })
        .then(function () { UI.toast("Recebido. Obrigado!", "ok"); desenhar(a, enviados.concat(arquivos.map(function (f) { return f.name; }))); })
        .catch(function (e) { UI.toast(e.message || "Falha no envio. Tente de novo.", "erro"); lista.innerHTML = ""; });
    }
  }
})(window);
