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

   O que protege: o código de 22 caracteres sorteados, que vence
   em 30 dias (renovável na ficha). A página mostra só o nome
   fantasia; nenhum dado pessoal, nenhuma senha.

   28/09/2026: aceita qualquer arquivo (ZIP e RAR principalmente),
   até 300 MB, menos programas. Não pergunta o tipo: o servidor
   (functions/triagem.js) confere, extrai e manda cada arquivo ao
   item certo da Lista de documentos; na dúvida, a equipe escolhe.
   ============================================================ */
(function (global) {
  "use strict";
  var U = global.U, UI = global.UI, ic = global.ic, Dados = global.Dados;
  var app = document.getElementById("app");

  function cabecalho(titulo, sub) {
    return '<div class="login__painel" style="display:flex;min-height:200px;padding:28px"><div class="puzzle-layer puzzle-login"></div><div class="veu"></div><div class="brilho"></div><img src="assets/brand/logo-escuro.png" alt="Totali · Portal do Cliente" style="height:48px;width:auto"><div><p class="login__frase" style="font-size:24px">' + titulo + '</p><p class="f-13" style="color:var(--sidebar-foreground);margin-top:8px">' + sub + "</p></div></div>";
  }
  var codigo = new URLSearchParams(location.search).get("c") || "";
  history.replaceState(null, "", location.pathname);
  app.innerHTML = '<div class="pagina" style="max-width:760px">' + cabecalho("Envio de documentos", "Carregando…") + "</div>";

  Dados.pronto().then(function () { return codigo ? Dados.anterior(codigo) : null; }).then(function (a) {
    if (!a) { app.innerHTML = '<div class="pagina" style="max-width:760px">' + cabecalho("Link inválido", "Este link não existe ou foi desativado. Peça um novo à Totali.") + "</div>"; return; }
    if (a.expirado) { app.innerHTML = '<div class="pagina" style="max-width:760px">' + cabecalho("Link vencido", "Por segurança, este link valia por um prazo que já passou. Peça um novo à Totali: é rápido.") + "</div>"; return; }
    desenhar(a, []);
  });

  function desenhar(a, enviados) {
    app.innerHTML = '<div class="pagina" style="max-width:760px">' + cabecalho("Documentos de <b>" + U.esc(a.empresa) + "</b>", "A Totali Soluções Contábeis assumiu a contabilidade desta empresa. Agradecemos pelo envio dos documentos abaixo: eles entram direto na ficha do cliente, com recibo de recebimento.") +
      '<div class="card"><div class="card__corpo pilha"><div class="campo"><label class="campo__rotulo" for="quem">Quem está enviando (escritório e responsável)</label><input class="input" id="quem" placeholder="Ex.: Contabilidade Silva · Maria" required></div>' +
      '<div class="solta" id="solta" tabindex="0" role="button">' + ic("upload") + "<b>Toque para escolher os arquivos</b><span class=\"f-13\">ou arraste aqui · ZIP, RAR ou arquivos soltos (PDF, planilha, imagem, XML, certificado…) · até 300 MB cada</span></div><input type=\"file\" id=\"inp\" multiple hidden>" +
      '<p class="f-12 txt-2">Pode mandar tudo junto num ZIP ou RAR, com as pastas que vocês já usam: o sistema da Totali abre e organiza cada documento no lugar certo. Não precisa separar por tipo.' + (a.expiraEm ? " Este link vale até " + U.data(a.expiraEm) + "." : "") + "</p>" +
      '<div id="lista" class="pilha" style="gap:6px"></div></div></div>' +
      (enviados.length ? '<div class="card"><div class="card__cab"><h2>Enviados agora</h2></div><div class="card__corpo pilha" style="gap:6px;padding-top:10px">' + enviados.map(function (n) { return '<div class="linha f-13">' + ic("check-circle", "txt-ok") + U.esc(n) + "</div>"; }).join("") + '<div class="aviso aviso--ok mt-8">' + ic("check") + "<div><b>Recebido.</b>O sistema da Totali está abrindo e organizando os arquivos na ficha do cliente. Obrigado.</div></div></div></div>" : "") +
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
      var erros = arquivos.map(U.validarArquivoAnterior).filter(Boolean); if (erros.length) return UI.toast(erros[0], "erro", null, 8000);
      lista.innerHTML = arquivos.map(function (f, i) { return '<div class="doc"><span class="doc__icone">' + ic("file") + '</span><div style="flex:1;min-width:0"><div class="doc__nome">' + U.esc(f.name) + '</div><div class="doc__meta" id="prog' + i + '">enviando… 0% de ' + U.tamanho(f.size) + "</div></div></div>"; }).join("");
      solta.setAttribute("aria-disabled", "true"); solta.style.pointerEvents = "none";
      Dados.entrarAnonimo().then(function () { return Promise.all(arquivos.map(function (f, i) { return Dados.enviarDocumento(a.empresaId, { file: f, grupo: "outros", origem: "anterior", por: quem, codigo: codigo, aoProgresso: function (x) { var el = document.getElementById("prog" + i); if (el) el.textContent = "enviando… " + Math.round(x * 100) + "% de " + U.tamanho(f.size); } }); })); })
        .then(function () { UI.toast("Recebido. Obrigado!", "ok"); desenhar(a, enviados.concat(arquivos.map(function (f) { return f.name; }))); })
        .catch(function (e) { UI.toast(U.msgErro(e, "Falha no envio. Tente de novo."), "erro", null, 8000); lista.innerHTML = ""; solta.removeAttribute("aria-disabled"); solta.style.pointerEvents = ""; });
    }
  }
})(window);
