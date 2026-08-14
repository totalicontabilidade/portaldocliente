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

  /* Só serve endereço de verdade. Caminho de arquivo no disco
     (file://) gera link que abre a pasta em vez do portal — foi
     o que aconteceu antes de existir esta checagem. */
  function enderecoValido(url) {
    return /^https?:\/\/[^\s]+$/i.test(String(url || "").trim());
  }

  function enderecoPadrao() {
    var salvo = null;
    try { salvo = localStorage.getItem(CHAVE_BASE); } catch (e) { salvo = null; }
    if (enderecoValido(salvo)) return salvo;
    /* Mesma pasta desta página, trocando equipe.html por index.html */
    var daPagina = location.href.replace(/equipe\.html.*$/, "").replace(/[?#].*$/, "");
    return enderecoValido(daPagina) ? daPagina : "";
  }

  function baseLimpa(base) {
    var limpo = String(base || "").trim().replace(/[?#].*$/, "");
    if (!limpo) limpo = enderecoPadrao();
    if (!/\/$/.test(limpo) && !/\.html$/i.test(limpo)) limpo += "/";
    return limpo;
  }

  /* Link do modo local: carrega os dados da empresa embutidos. */
  function montarLink(base, dados) {
    return baseLimpa(base) + "?c=" + U.textoParaB64url(JSON.stringify(dados)) + "#/inicio";
  }

  /* Link do modo servidor: leva só o código do convite. Nenhum
     dado da empresa passa pela barra de endereço. */
  function montarLinkCodigo(base, codigo) {
    return baseLimpa(base) + "?k=" + encodeURIComponent(codigo) + "#/inicio";
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

  /* ---------- Porta de entrada ---------- */
  function mostrar(id, sim) {
    var el = $(id);
    if (el) el.hidden = !sim;
  }

  function erroLogin(texto) {
    var caixa = $("#lgErro");
    if (!caixa) return;
    caixa.hidden = !texto;
    if (texto) $("#lgErroTxt").textContent = texto;
  }

  function iniciarPorta() {
    var FB = global.FB;
    var P = global.Painel;

    /* Sem servidor configurado, o painel abre em modo local —
       gera link e monta conteúdo, mas nada chega ao cliente. */
    if (!FB || !FB.ligado) {
      mostrar("#secSemConexao", true);
      if (P) P.mostrarPainel(true);
      var motivo = {
        "biblioteca-ausente": "A biblioteca do Firebase não carregou.",
        "nao-configurado": "O projeto ainda não foi configurado.",
        "falha-init": "Não foi possível iniciar a conexão.",
        "": location.protocol === "file:"
          ? "A página foi aberta direto do computador, e nesse modo o Firebase não funciona."
          : ""
      }[(FB && FB.erro) || ""] || "";
      if ($("#scMotivo")) $("#scMotivo").textContent = motivo;
      return;
    }

    FB.observarSessao(function (equipe) {
      mostrar("#secLogin", !equipe);
      if (P) P.sessao(equipe);
    });

    var btn = $("#lgEntrar");
    var entrar = function () {
      var email = $("#lgEmail").value.trim();
      var senha = $("#lgSenha").value;
      if (!email || !senha) { erroLogin("Preencha e-mail e senha."); return; }
      erroLogin("");
      btn.disabled = true;
      btn.textContent = "Entrando…";
      FB.entrarComoEquipe(email, senha).then(function () {
        $("#lgSenha").value = "";
        btn.disabled = false;
        btn.textContent = "Entrar";
      }, function (e) {
        btn.disabled = false;
        btn.textContent = "Entrar";
        erroLogin(FB.explicar(e));
      });
    };
    btn.addEventListener("click", entrar);
    $("#lgSenha").addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") entrar();
    });

    $("#pnSair").addEventListener("click", function () {
      UI.confirmar({
        titulo: "Sair do painel",
        mensagem: "Você volta para a tela de entrar. Nada do que já foi gravado se perde.",
        confirmar: "Sair"
      }).then(function (ok) { if (ok) FB.sair(); });
    });
  }

  function iniciar() {
    iniciarPorta();

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
      if (!enderecoValido(base.value)) {
        base.focus();
        base.setAttribute("aria-invalid", "true");
        UI.toast("O endereço do portal precisa começar com http:// ou https://. " +
                 "Sem isso o link abre a pasta do computador, não o portal.", "erro", 9000);
        return;
      }
      base.removeAttribute("aria-invalid");

      try { localStorage.setItem(CHAVE_BASE, base.value.trim()); } catch (e) { /* segue */ }

      var empresa = {
        razaoSocial: r,
        nomeFantasia: fantasia.value.trim(),
        cnpj: c,
        regime: regime.value
      };
      var nome = empresa.nomeFantasia || empresa.razaoSocial;
      var FB = global.FB;

      var mostrarResultado = function (link) {
        campoLink.value = link;
        campoMsg.value = mensagemPronta(nome, link);
        $("#cWhats").href = "https://wa.me/?text=" + encodeURIComponent(campoMsg.value);
        resultado.hidden = false;
        resultado.scrollIntoView({ behavior: "smooth", block: "start" });
      };

      var botao = $("#cGerar");

      /* Com servidor: cria a empresa e o convite no banco. O link
         leva só o código — nenhum dado da empresa passa pela URL. */
      if (FB && FB.ligado && FB.equipe) {
        botao.disabled = true;
        botao.textContent = "Criando…";

        var codigo = FB.novoCodigo();
        var refEmpresa = FB.db.collection("empresas").doc();

        refEmpresa.set({
          razaoSocial: empresa.razaoSocial,
          nomeFantasia: empresa.nomeFantasia,
          cnpj: empresa.cnpj,
          regime: empresa.regime,
          responsavelNome: "", responsavelEmail: "",
          responsavelTelefone: "", responsavelCargo: "",
          etapa: "boas-vindas",
          aceiteLGPD: null,
          criadaPor: FB.equipe.uid,
          criadaEm: FB.agora(),
          atualizadoEm: FB.agora()
        }).then(function () {
          return FB.db.collection("convites").doc(codigo).set({
            empresaId: refEmpresa.id,
            ativo: true,
            criadoPor: FB.equipe.uid,
            criadoEm: FB.agora()
          });
        }).then(function () {
          botao.disabled = false;
          botao.textContent = "Gerar link do cliente";
          mostrarResultado(montarLinkCodigo(base.value, codigo));
          UI.toast("Empresa criada e link gerado para " + nome + ".", "ok");
        }, function (e) {
          botao.disabled = false;
          botao.textContent = "Gerar link do cliente";
          UI.toast("Não foi possível criar: " + FB.explicar(e), "erro", 9000);
        });
        return;
      }

      /* Sem servidor: link com os dados embutidos, como antes. */
      mostrarResultado(montarLink(base.value, {
        v: 1, id: U.uid(), r: empresa.razaoSocial, f: empresa.nomeFantasia,
        c: empresa.cnpj, g: empresa.regime, em: Date.now()
      }));
      UI.toast("Link gerado em modo local para " + nome + ".", "ok");
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
