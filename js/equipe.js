/* ============================================================
   Totali · Portal de Onboarding
   equipe.js — gerador do link de convite (uso interno)

   Esta página não lê nem grava dado de cliente. Ela apenas monta
   um endereço com os dados da EMPRESA embutidos, para que o
   portal já abra preenchido.

   [FIREBASE] Quando o servidor entrar, esta tela vira o painel
   interno com login, o cadastro passa a ser gravado no Firestore
   e o link leva apenas um código de convite.
   ============================================================ */
(function (global) {
  "use strict";

  var U = global.U, UI = global.UI;
  var $ = UI.$;
  var CHAVE_BASE = "totali.onboarding.equipe.base";

  function enderecoPadrao() {
    var salvo = null;
    try { salvo = localStorage.getItem(CHAVE_BASE); } catch (e) { salvo = null; }
    if (salvo) return salvo;
    /* Mesma pasta desta página, trocando equipe.html por index.html */
    return location.href.replace(/equipe\.html.*$/, "").replace(/[?#].*$/, "");
  }

  function montarLink(base, dados) {
    var limpo = String(base || "").trim().replace(/[?#].*$/, "");
    if (!limpo) limpo = enderecoPadrao();
    if (!/\/$/.test(limpo) && !/\.html$/i.test(limpo)) limpo += "/";
    return limpo + "?c=" + U.textoParaB64url(JSON.stringify(dados)) + "#/inicio";
  }

  function mensagemPronta(nomeEmpresa, link) {
    return "Olá! Seja bem-vindo à Totali Soluções Contábeis.\n\n" +
      "Preparamos o portal de " + nomeEmpresa + " para organizarmos a entrada da sua empresa " +
      "aqui no escritório. Nele você vê a lista de documentos que precisamos, envia tudo pelo " +
      "próprio celular e acompanha cada etapa.\n\n" +
      link + "\n\n" +
      "Dá para instalar como aplicativo: abra o link e toque em \"Instalar\".\n" +
      "Qualquer dúvida, fale com a gente por lá mesmo, na aba Mensagens.";
  }

  function copiar(texto, rotulo) {
    var terminar = function (ok) {
      UI.toast(ok ? rotulo + " copiado." : "Não foi possível copiar. Selecione e copie à mão.",
               ok ? "ok" : "erro");
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(function () { terminar(true); },
                                                function () { terminar(false); });
      return;
    }
    try {
      var t = document.createElement("textarea");
      t.value = texto;
      t.style.position = "fixed";
      t.style.opacity = "0";
      document.body.appendChild(t);
      t.select();
      var ok = document.execCommand("copy");
      document.body.removeChild(t);
      terminar(ok);
    } catch (e) { terminar(false); }
  }

  function iniciar() {
    var razao = $("#cRazao"), fantasia = $("#cFantasia"), cnpj = $("#cCnpj"),
        regime = $("#cRegime"), base = $("#cBase"),
        erroCnpj = $("#cErrCnpj"), resultado = $("#cResultado"),
        campoLink = $("#cLink"), campoMsg = $("#cMensagem");

    base.value = enderecoPadrao();

    cnpj.addEventListener("input", function () {
      cnpj.value = U.mascaraCNPJ(cnpj.value);
      erroCnpj.hidden = true;
      cnpj.removeAttribute("aria-invalid");
    });

    $("#cGerar").addEventListener("click", function () {
      var r = razao.value.trim();
      var c = cnpj.value.trim();

      if (!r) { razao.focus(); UI.toast("Informe a razão social.", "erro"); return; }
      if (!U.validaCNPJ(c)) {
        erroCnpj.hidden = false;
        cnpj.setAttribute("aria-invalid", "true");
        cnpj.focus();
        return;
      }

      try { localStorage.setItem(CHAVE_BASE, base.value.trim()); } catch (e) { /* segue */ }

      var dados = {
        v: 1,
        id: U.uid(),
        r: r,
        f: fantasia.value.trim(),
        c: c,
        g: regime.value,
        em: Date.now()
      };
      var link = montarLink(base.value, dados);
      var nome = dados.f || dados.r;

      campoLink.value = link;
      campoMsg.value = mensagemPronta(nome, link);
      $("#cWhats").href = "https://wa.me/?text=" + encodeURIComponent(campoMsg.value);

      resultado.hidden = false;
      resultado.scrollIntoView({ behavior: "smooth", block: "start" });
      UI.toast("Link gerado para " + nome + ".", "ok");
    });

    $("#cCopiar").addEventListener("click", function () { copiar(campoLink.value, "Link"); });
    $("#cCopiarMsg").addEventListener("click", function () { copiar(campoMsg.value, "Mensagem"); });

    iniciarChaves();
  }

  /* ---------- Par de chaves do canal seguro ---------- */
  function iniciarChaves() {
    var C = global.Cripto;
    var status = $("#kStatus");
    var privadaGerada = null;

    function mostrarStatus(classe, texto) {
      status.className = "notice " + classe;
      status.lastElementChild.innerHTML = texto;
    }

    if (!C || !C.disponivel) {
      mostrarStatus("notice--warn", "Este navegador não tem os recursos de criptografia. " +
        "Use Chrome ou Edge atualizado.");
      $("#kGerar").disabled = true;
      return;
    }

    if (C.configurada) {
      C.impressaoDigital(global.CHAVE_PUBLICA).then(function (imp) {
        mostrarStatus("notice--ok", "<strong>Canal seguro ativo.</strong> O portal já aceita " +
          "senhas. Impressão digital da chave: <strong>" + U.esc(imp) + "</strong>");
      });
    } else {
      mostrarStatus("notice--warn", "<strong>Canal seguro não configurado.</strong> " +
        "Enquanto isso, o portal não aceita senha nenhuma — ele avisa o cliente em vez de " +
        "guardar às claras.");
    }

    $("#kGerar").addEventListener("click", function () {
      var b = $("#kGerar");
      b.disabled = true;
      b.textContent = "Gerando…";
      C.gerarPar().then(function (par) {
        privadaGerada = par.privada;
        $("#kPub").value = "window.CHAVE_PUBLICA = " +
          JSON.stringify(par.publica, null, 2) + ";";
        $("#kResultado").hidden = false;
        b.textContent = "Gerar outro par";
        b.disabled = false;
        return C.impressaoDigital(par.publica);
      }).then(function (imp) {
        $("#kImpressao").textContent = imp;
        UI.toast("Par gerado. Baixe a chave privada antes de sair desta página.", "ok", 9000);
        $("#kResultado").scrollIntoView({ behavior: "smooth", block: "start" });
      }).catch(function () {
        b.disabled = false;
        b.textContent = "Gerar par de chaves";
        UI.toast("Não foi possível gerar o par de chaves.", "erro");
      });
    });

    $("#kCopiarPub").addEventListener("click", function () { copiar($("#kPub").value, "Chave pública"); });

    $("#kBaixarPriv").addEventListener("click", function () {
      if (!privadaGerada) return;
      var conteudo = JSON.stringify({
        aviso: "CHAVE PRIVADA DA TOTALI. Guarde em cofre de senhas e mantenha uma copia offline. " +
               "Nao envie por e-mail, nao coloque em repositorio, nao deixe no computador de trabalho. " +
               "Sem ela nao ha como ler as senhas enviadas pelos clientes.",
        geradaEm: new Date().toISOString(),
        chave: privadaGerada
      }, null, 2);
      var blob = new Blob([conteudo], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "totali-chave-privada-NAO-COMPARTILHAR.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      UI.toast("Chave privada baixada. Guarde agora em local seguro.", "ok", 9000);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})(window);
