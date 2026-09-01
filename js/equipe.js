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

  /* Prazo de UMA tentativa na Receita. Oito segundos é folgado para
     uma consulta que costuma levar menos de um décimo disso, e curto
     o bastante para não parecer travado. Com duas repetições, o pior
     caso até o aviso de falha fica em torno de meio minuto. */
  var LIMITE_RECEITA_MS = 8000;

  /* Só serve endereço de verdade. Caminho de arquivo no disco
     (file://) gera link que abre a pasta em vez do portal — foi
     o que aconteceu antes de existir esta checagem. */
  function enderecoValido(url) {
    return /^https?:\/\/[^\s]+$/i.test(String(url || "").trim());
  }

  /* A PASTA DO PORTAL, tirando a página do painel do caminho.

     Aqui morava um defeito que só aparecia no ar: o GitHub Pages
     serve `equipe.html` TAMBÉM em `/equipe`, sem extensão. Quem
     abrisse o painel por esse endereço — e é o que acontece quando
     se digita à mão ou se salva o atalho — gerava convite para
     `.../portaldocliente/equipe/?k=...`, uma pasta que não existe.
     O cliente recebia um link morto, e ninguém do lado de cá tinha
     como perceber.

     Agora o corte é no ÚLTIMO TRECHO do caminho, com ou sem
     extensão, e sempre sobra a pasta terminada em barra. */
  function tirarPaginaDoPainel(caminho) {
    return String(caminho || "/").replace(/\/equipe(?:\.html)?\/?$/i, "/");
  }

  function normalizarBase(url) {
    try {
      var u = new URL(String(url).trim());
      var p = tirarPaginaDoPainel(u.pathname.replace(/[?#].*$/, ""));
      if (!/\/$/.test(p) && !/\.html$/i.test(p)) p += "/";
      return u.origin + p;
    } catch (e) { return ""; }
  }

  function enderecoDaPagina() {
    var daPagina = normalizarBase(location.href);
    return enderecoValido(daPagina) ? daPagina : "";
  }

  function mesmaOrigem(url) {
    try { return new URL(url).origin === location.origin; } catch (e) { return false; }
  }

  function enderecoPadrao() {
    var salvo = null;
    try { salvo = localStorage.getItem(CHAVE_BASE); } catch (e) { salvo = null; }

    /* O endereço salvo só vale se for do MESMO servidor em que o
       painel está rodando agora. Sem isso, quem testou em
       localhost e depois abriu o painel publicado continuaria
       gerando links de localhost — que só abrem na máquina dele,
       e o cliente receberia um link morto. */
    /* O que estiver guardado passa pelo mesmo saneamento. Quem já
       gerou convite antes desta correção tem o endereço errado
       salvo no navegador, e sem isto continuaria gerando link
       morto para sempre. */
    var limpoSalvo = normalizarBase(salvo);
    if (enderecoValido(limpoSalvo) && mesmaOrigem(limpoSalvo)) return limpoSalvo;
    return enderecoDaPagina();
  }

  function baseLimpa(base) {
    var limpo = normalizarBase(base);
    if (!limpo) limpo = enderecoPadrao();
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

  /* Link da página de liberação de extratos.

     `baseLimpa` devolve ou uma pasta terminada em barra, ou um
     arquivo `.html` — o segundo caso acontece quando o painel foi
     aberto por `.../index.html`. Trocar o arquivo pelo nosso cobre
     os dois; emendar direto quebraria no segundo. */
  function montarLinkExtratos(base, codigo) {
    var b = baseLimpa(base).replace(/[^/]*\.html$/i, "");
    return b + "extratos.html?c=" + encodeURIComponent(codigo);
  }

  function mensagemExtratos(nomeEmpresa, link) {
    return "Olá! Aqui é a Totali Soluções Contábeis.\n\n" +
      "Para lançarmos a contabilidade de " + nomeEmpresa + " sem precisar pedir extrato todo " +
      "mês, precisamos da sua autorização para ler o extrato bancário pelo Open Finance — o " +
      "mesmo sistema do Banco Central que você usa ao conectar um banco no aplicativo de " +
      "outro.\n\n" +
      "Abra o link abaixo, confirme o CNPJ da empresa e siga o passo a passo de cada banco. " +
      "Leva uns três minutos por banco e dá para fazer pelo celular.\n\n" +
      link + "\n\n" +
      "É só leitura: não movimentamos dinheiro, não fazemos transferência e não alteramos " +
      "nada na sua conta. Você pode cancelar quando quiser, pelo aplicativo do banco.";
  }

  /* ============================================================
     Página de liberação de extratos: gravar e reaproveitar

     UM CÓDIGO POR EMPRESA, e não um a cada geração. A equipe volta
     aqui toda vez que o cliente abre conta nova ou troca de banco,
     e um código novo a cada vez deixaria vivos os links antigos —
     dois endereços mostrando listas diferentes, com o cliente
     seguindo o que estiver mais acima na conversa. Reaproveitando,
     o link que ele já tem passa a mostrar o banco novo.

     O código fica gravado na empresa (`extratosCodigo`) porque é
     dali que a ficha, e o portal do cliente, o encontram depois.
     ============================================================ */
  function salvarExtratos(empresa, bancos) {
    var FB = global.FB;
    if (!FB || !FB.ligado || !FB.equipe) return Promise.reject(new Error("sem-conexao"));

    var limpos = (bancos || []).map(function (b) {
      return { nome: String((b && b.nome) || "").slice(0, 80), link: U.linkOttimizza(b && b.link) };
    }).filter(function (b) { return b.nome && b.link; });

    var codigo = String(empresa.extratosCodigo || "") || FB.novoCodigo();

    return U.hashCNPJ(empresa.cnpj).then(function (hash) {
      return FB.db.collection("extratos").doc(codigo).set({
        empresaId: empresa.id,
        nome: String(empresa.nomeFantasia || empresa.razaoSocial || "").slice(0, 120),
        cnpjHash: hash,
        bancos: limpos,
        ativo: true,
        criadoPor: FB.equipe.uid,
        atualizadoEm: FB.agora()
      }, { merge: true });
    }).then(function () {
      /* O código na empresa é o que liga as duas pontas. Falhando
         aqui, o documento acima já existe e a gravação seguinte
         criaria OUTRO código — por isso o erro sobe em vez de ser
         engolido. */
      return FB.db.collection("empresas").doc(empresa.id)
        .set({ extratosCodigo: codigo }, { merge: true });
    }).then(function () {
      var link = montarLinkExtratos(enderecoPadrao(), codigo);
      return {
        codigo: codigo,
        link: link,
        quantos: limpos.length,
        mensagem: mensagemExtratos(
          empresa.nomeFantasia || empresa.razaoSocial || "sua empresa", link)
      };
    });
  }

  /* "o portal de FULANO" dava a entender que o portal era da
     empresa. Ele é o Portal do Cliente da Totali, PREPARADO para
     ela — e a diferença importa na primeira impressão.

     O aviso de instalação também mudou: o botão perdeu o rótulo
     "Instalar" e virou só o ícone, então mandar procurar por uma
     palavra que não existe mais na tela seria pior que não dizer
     nada. */
  function mensagemPronta(nomeEmpresa, link) {
    return "Olá! Seja bem-vindo à Totali Soluções Contábeis.\n\n" +
      "Preparamos o Portal do Cliente para " + nomeEmpresa + ", para organizarmos a entrada " +
      "da sua empresa aqui no escritório. Nele você vê a lista de documentos que precisamos, " +
      "envia tudo pelo próprio celular e acompanha cada etapa.\n\n" +
      link + "\n\n" +
      "Dá para deixar como aplicativo no celular: abra o link e toque no ícone de download, " +
      "no alto da tela.\n" +
      "Qualquer dúvida, fale com a gente por lá mesmo, na aba Mensagens.";
  }

  function mensagemNovoAcesso(nomeEmpresa, link) {
    return "Olá! Aqui é a Totali Soluções Contábeis.\n\n" +
      "Segue um link novo para o acesso de " + nomeEmpresa + " ao Portal do Cliente. " +
      "Ele serve uma vez só: ao abrir, você define a senha e o acesso fica valendo daí em " +
      "diante, de qualquer aparelho.\n\n" +
      link + "\n\n" +
      "Se você já tinha acesso, tudo o que enviou continua lá — nada se perde.";
  }

  /* ============================================================
     Gerar convite para uma empresa QUE JÁ EXISTE

     Serve quando o vínculo do cliente se perde, quando muda a
     pessoa responsável na empresa, ou quando o link antigo se
     perdeu antes de ser usado. Sem isto, um vínculo desfeito não
     tinha conserto: a regra do servidor não deixa a equipe criar
     `clientes/{uid}` — só o próprio cliente cria, e só abrindo um
     convite.
     ============================================================ */
  function gerarConvite(empresaId, nomeEmpresa) {
    var FB = global.FB;
    if (!FB || !FB.ligado || !FB.equipe) return Promise.reject(new Error("sem-conexao"));

    var base = enderecoPadrao();
    var campo = $("#cBase");
    if (campo && enderecoValido(campo.value)) base = campo.value;
    if (!enderecoValido(base)) return Promise.reject(new Error("endereco-invalido"));

    /* `empresas` sempre presente, mesmo com uma só. Convite que
       às vezes tem a lista e às vezes não obriga todo mundo que
       lê a tratar os dois casos — e um deles acaba esquecido. */
    var codigo = FB.novoCodigo();
    return FB.db.collection("convites").doc(codigo).set({
      empresaId: empresaId,
      empresas: [empresaId],
      /* O NOME VIAJA NO CONVITE, e isso conserta um defeito antigo.

         O portal tentava ler o documento da empresa para dizer
         "portal de Fulano" na tela de criar acesso. Só que quem
         chega pelo convite AINDA NÃO TEM CONTA, e a regra da
         empresa só deixa equipe ou dono lerem — dava
         permission-denied, e todo cliente de verdade via a
         mensagem genérica. Passou despercebido porque, testando
         com a sessão da equipe aberta, o nome aparecia.

         O convite já é legível por quem tem o código (é assim que
         o fluxo funciona), então o nome é a informação certa para
         guardar aqui. */
      nome: String(nomeEmpresa || "").slice(0, 120),
      ativo: true,
      criadoPor: FB.equipe.uid,
      criadoEm: FB.agora()
    }).then(function () {
      var link = montarLinkCodigo(base, codigo);
      return { codigo: codigo, link: link, mensagem: mensagemNovoAcesso(nomeEmpresa || "sua empresa", link) };
    });
  }

  /* `aviso` é a frase pronta. Emendar " copiado." num rótulo
     erra o gênero em "Mensagem" e "Chave pública". */
  function copiar(texto, aviso) {
    var terminar = function (ok) {
      UI.toast(ok ? (aviso || "Copiado.") : "Não foi possível copiar. Selecione e copie à mão.",
               ok ? "ok" : "erro");
    };
    /* O jeito antigo cobre DOIS casos, não um: o `clipboard` não
       existir, e ele existir mas recusar — aba sem foco, página
       fora de https, política do navegador. A versão anterior só
       tratava o primeiro, e desistia calada no segundo. */
    var peloAntigo = function () {
      try {
        var t = document.createElement("textarea");
        t.value = texto;
        t.setAttribute("readonly", "readonly");
        t.style.position = "fixed";
        t.style.top = "0";
        t.style.opacity = "0";
        document.body.appendChild(t);
        t.select();
        t.setSelectionRange(0, texto.length);
        var ok = document.execCommand("copy");
        document.body.removeChild(t);
        return ok;
      } catch (e) { return false; }
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(function () { terminar(true); },
                                                function () { terminar(peloAntigo()); });
      return;
    }
    terminar(peloAntigo());
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

    /* Membro novo entra com senha provisória e troca por aqui.
       Sem isto, a senha combinada por mensagem ficaria valendo
       para sempre. */
    var esqueci = $("#lgEsqueci");
    if (esqueci) esqueci.addEventListener("click", function (ev) {
      ev.preventDefault();
      var email = ($("#lgEmail").value || "").trim();
      if (!U.validaEmail(email)) {
        erroLogin("Digite seu e-mail no campo acima para receber o link de troca de senha.");
        $("#lgEmail").focus();
        return;
      }
      FB.recuperarSenha(email).then(function () {
        erroLogin("");
        UI.toast("Enviamos um link para " + email + ". Confira também o lixo eletrônico.", "ok", 9000);
      }, function (e) { erroLogin(FB.explicar(e)); });
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

    var aviso = $("#cBuscaEstado");
    var rebuscar = $("#cRebuscar");
    var AVISO_PADRAO = aviso ? aviso.textContent : "";
    var buscado = "";      /* último CNPJ já consultado */

    function dizer(texto, cor) {
      if (!aviso) return;
      aviso.textContent = texto;
      aviso.style.color = cor || "";
    }

    /* Preenche só o que está VAZIO. Se alguém já digitou a razão
       social à mão, a Receita não passa por cima — quem está na
       frente da tela sabe mais do que o cadastro. */
    function preencherSeVazio(campo, valor) {
      if (!campo || !valor) return false;
      if (String(campo.value || "").trim()) return false;
      campo.value = String(valor).slice(0, campo.maxLength > 0 ? campo.maxLength : 200);
      return true;
    }

    /* UMA tentativa, com prazo. Sem o prazo, uma conexão que abre e
       não responde deixa o aviso em "Buscando…" para sempre — e foi
       exatamente essa a queixa: parecia que nada acontecia. */
    function tentarReceita(so) {
      var corta = null;
      var controle = global.AbortController ? new global.AbortController() : null;
      var opcoes = controle ? { signal: controle.signal } : {};

      var pedido = fetch("https://brasilapi.com.br/api/cnpj/v1/" + so, opcoes)
        .then(function (r) {
          if (r.ok) return r.json();
          /* 404 é resposta, não falha: o número não existe lá e
             insistir não muda nada. O resto pode melhorar sozinho. */
          var e = new Error(r.status === 404 ? "nao-encontrado" : "falhou");
          e.definitivo = r.status === 404;
          e.status = r.status;
          throw e;
        });

      var prazo = new Promise(function (_, rejeitar) {
        corta = setTimeout(function () {
          if (controle) controle.abort();
          var e = new Error("demorou");
          rejeitar(e);
        }, LIMITE_RECEITA_MS);
      });

      return Promise.race([pedido, prazo]).then(function (d) {
        clearTimeout(corta);
        return d;
      }, function (e) {
        clearTimeout(corta);
        throw e;
      });
    }

    /* Repete sozinha antes de desistir. A queixa era ter de colar o
       número três vezes até funcionar; se três tentativas resolvem,
       quem deve fazer as três é o programa, não a pessoa. */
    function comInsistencia(so, restam) {
      return tentarReceita(so).catch(function (e) {
        if (e && e.definitivo) throw e;
        if (restam <= 0) throw e;
        return new Promise(function (ok) { setTimeout(ok, restam === 2 ? 700 : 1600); })
          .then(function () { return comInsistencia(so, restam - 1); });
      });
    }

    function buscarNaReceita(numero) {
      var so = U.soDigitos(numero);
      if (so.length !== 14 || so === buscado) return;
      buscado = so;
      if (rebuscar) rebuscar.hidden = true;
      dizer("Buscando na Receita Federal…");

      /* Sem chave e sem cadastro: a BrasilAPI repassa o cadastro
         público da Receita. Se sair do ar, o formulário continua
         inteiro — isto é atalho, não dependência. */
      comInsistencia(so, 2)
        .then(function (d) {
          var mudou = [];
          if (preencherSeVazio(razao, d.razao_social)) mudou.push("razão social");
          if (preencherSeVazio(fantasia, d.nome_fantasia)) mudou.push("nome fantasia");

          /* MEI a Receita diz de forma confiável. Simples Nacional
             ela também informa; o resto é escolha do escritório e
             fica para a pessoa marcar. */
          if (regime && !regime.value) {
            if (d.opcao_pelo_mei === true) regime.value = "MEI";
            else if (d.opcao_pelo_simples === true) regime.value = "Simples Nacional";
            if (regime.value) mudou.push("regime");
          }

          var situacao = String(d.descricao_situacao_cadastral || "").toUpperCase();
          if (situacao && situacao.indexOf("ATIVA") === -1) {
            dizer("Atenção: na Receita esta empresa consta como " +
                  d.descricao_situacao_cadastral + ".", "var(--danger)");
            return;
          }
          dizer(mudou.length
            ? "Preenchido pela Receita: " + mudou.join(", ") + ". Confira e ajuste se precisar."
            : "Encontrado na Receita, mas os campos já estavam preenchidos — nada foi trocado.");
        })
        .catch(function (e) {
          buscado = "";      /* deixa tentar de novo */
          var motivo = e && e.message;

          if (motivo === "nao-encontrado") {
            dizer("CNPJ não encontrado na Receita. Preencha à mão.", "var(--txt-3)");
            return;                       /* insistir não adianta */
          }

          /* Dizer QUAL foi o problema. "Não deu certo" não deixa a
             pessoa fazer nada; "você está sem internet" deixa. */
          var recado;
          if (!navigator.onLine) {
            recado = "Sem internet no momento. Reconecte e toque em Buscar de novo.";
          } else if (motivo === "demorou") {
            recado = "A Receita não respondeu a tempo. Toque em Buscar de novo ou preencha à mão.";
          } else if (e && e.status === 429) {
            recado = "Muitas consultas seguidas. Espere alguns segundos e toque em Buscar de novo.";
          } else {
            recado = "Não deu para consultar a Receita agora. Toque em Buscar de novo ou preencha à mão.";
          }
          dizer(recado, "var(--txt-3)");
          if (rebuscar) rebuscar.hidden = false;
        });
    }

    cnpj.addEventListener("input", function () {
      cnpj.value = U.mascaraCNPJ(cnpj.value);
      erroCnpj.hidden = true;
      cnpj.removeAttribute("aria-invalid");
      if (aviso && U.soDigitos(cnpj.value).length < 14) {
        buscado = "";
        if (rebuscar) rebuscar.hidden = true;
        dizer(AVISO_PADRAO);
      }
      /* Busca sozinha ao completar o número — sem esperar o campo
         perder o foco, que é o momento em que a pessoa já foi
         digitar a razão social à mão. */
      if (U.validaCNPJ(cnpj.value)) buscarNaReceita(cnpj.value);
    });

    cnpj.addEventListener("blur", function () {
      if (U.validaCNPJ(cnpj.value)) buscarNaReceita(cnpj.value);
    });

    if (rebuscar) {
      rebuscar.addEventListener("click", function () {
        rebuscar.hidden = true;
        buscado = "";                     /* libera o mesmo número */
        if (U.validaCNPJ(cnpj.value)) buscarNaReceita(cnpj.value);
        else dizer("Confira o CNPJ antes de buscar.", "var(--txt-3)");
      });
    }

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

        /* LIMPA A BUSCA DAS EMPRESAS EXTRAS.

           O formulário não se apaga depois de gerar um link — os
           campos ficam de pé, e sempre foi assim. O que não pode
           ficar é um filtro ativo: quem cadastrar o próximo
           cliente veria uma lista curta, sem enxergar as empresas
           que continuam marcadas fora do filtro, e mandaria para
           ele um acesso que não era para ele. Sem filtro, o que
           está escolhido está à vista. */
        limparBuscaDeOutras();
      };

      var botao = $("#cGerar");

      /* O que a equipe já escolheu nesta tela, ainda sem empresa
         no banco. Vira gravação logo depois de a empresa nascer. */
      var docsEscolhidos = global.__docsNovoCliente || [];

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
          /* `empresaId` é a principal — é o nome que a tela de
             cadastro mostra ao cliente. `empresas` traz ela e as
             extras, e é o que a regra do servidor confere na hora
             de registrar cada acesso. */
          /* Vem de `outrasEscolhidas`, e não das caixas marcadas na
             tela: com a busca ligada, a empresa escolhida pode não
             estar mais no DOM. Ver a nota em `desenharOutras`. */
          var extras = Object.keys(outrasEscolhidas).filter(function (id) {
            return outrasEscolhidas[id];
          });

          return FB.db.collection("convites").doc(codigo).set({
            empresaId: refEmpresa.id,
            empresas: [refEmpresa.id].concat(extras).slice(0, 20),
            /* Mesmo motivo do outro ponto que cria convite: quem
               chega pelo link não consegue ler a empresa. */
            nome: String(nome || "").slice(0, 120),
            ativo: true,
            criadoPor: FB.equipe.uid,
            criadoEm: FB.agora()
          });
        }).then(function () {
          /* Os documentos escolhidos nascem junto com a empresa,
             para o cliente já abrir o portal com a lista certa —
             e não com a lista cheia que encolhe depois. */
          if (!docsEscolhidos.length) return null;
          var lote = FB.db.batch();
          docsEscolhidos.forEach(function (mu) {
            mu.chaves.forEach(function (chave) {
              lote.set(refEmpresa.collection("itens").doc(global.Nuvem.codificar(chave)),
                       { naEquipe: mu.naEquipe }, { merge: true });
            });
          });
          return lote.commit().catch(function () {
            /* A empresa e o link já existem e valem. Se só isto
               falhar, dá para refazer na ficha — melhor que
               derrubar o cadastro inteiro. */
            UI.toast("A empresa foi criada, mas a lista de documentos não foi salva. " +
                     "Ajuste na ficha do cliente.", "erro", 11000);
          });
        }).then(function () {
          botao.disabled = false;
          botao.textContent = "Gerar link do cliente";
          mostrarResultado(montarLinkCodigo(base.value, codigo));
          UI.toast("Empresa criada e link gerado para " + nome + ".", "ok");

          /* A lista de clientes vive em memória e não sabe que
             nasceu uma empresa agora. Sem esta linha, quem manda o
             convite e vai conferir em Clientes não encontra o
             cliente e acha que deu errado. */
          if (global.PainelClientes && global.PainelClientes.recarregar) {
            global.PainelClientes.recarregar();
          }
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

    /* ---------- Empresas extras no mesmo link ----------

       A lista vem da aba Clientes, que já carregou tudo. Se ela
       ainda não carregou (a pessoa abriu direto em "Novo"), o
       bloco fica com um aviso em vez de uma lista vazia mentindo
       que não há empresa nenhuma. */
    /* A ESCOLHA MORA AQUI, NÃO NO DOM.

       Antes ela era lida das caixas marcadas na hora de gerar o
       link. Com busca isso quebraria na primeira letra digitada:
       a empresa marcada sai da tela pelo filtro, o `checked`
       morre com o elemento, e o link nasce sem ela — sem ninguém
       perceber. Guardando aqui, filtrar é só filtrar. */
    var outrasEscolhidas = {};

    function contarEscolhidas() {
      return Object.keys(outrasEscolhidas).filter(function (k) {
        return outrasEscolhidas[k];
      }).length;
    }

    var buscaOutras = "";

    function limparBuscaDeOutras() {
      if (!buscaOutras) return;
      buscaOutras = "";
      desenharOutras();
    }

    function desenharOutras() {
      var caixa = $("#cOutras");
      if (!caixa) return;
      var PC = global.PainelClientes;

      if (!PC || PC.carregando) {
        caixa.innerHTML = '<p class="text-xs text-muted" style="margin:6px 0 0">' +
          'Carregando as empresas…</p>';
        return;
      }

      var lista = PC.empresas.filter(function (c) { return !PC.arquivada(c); });
      if (!lista.length) {
        caixa.innerHTML = '<p class="text-xs text-muted" style="margin:6px 0 0">' +
          'Ainda não há outra empresa cadastrada.</p>';
        return;
      }

      /* A BUSCA SÓ APARECE QUANDO PESA. Campo de busca sobre três
         empresas é enfeite que rouba um toque de quem ia clicar
         direto. */
      var temBusca = lista.length > 6;
      var termo = String(buscaOutras).trim().toLowerCase();

      /* CNPJ digitado sem pontuação, que é como as pessoas
         digitam. Só vale quando o que se digitou NÃO TEM LETRA:
         com a regra frouxa, "teste 7" virava busca pelo dígito 7 e
         trazia toda empresa com um 7 no CNPJ — quase todas. */
      var soNumero = !!termo && !/[a-z]/.test(termo);
      var digitos = soNumero ? termo.replace(/\D+/g, "") : "";

      var visiveis = !termo ? lista : lista.filter(function (c) {
        var cnpj = String(c.empresa.cnpj || "");
        if ((PC.nomeDe(c) + " " + cnpj).toLowerCase().indexOf(termo) > -1) return true;
        return !!digitos && cnpj.replace(/\D+/g, "").indexOf(digitos) > -1;
      });

      var quantas = contarEscolhidas();

      caixa.innerHTML =
        (temBusca
          ? '<div class="row" style="gap:8px;align-items:center;margin:6px 0 8px">' +
              '<input type="search" class="input" id="cBuscaOutra" ' +
                'placeholder="Buscar por nome ou CNPJ" autocomplete="off" ' +
                'value="' + U.escAttr(buscaOutras) + '" style="flex:1">' +
              (quantas
                ? '<span class="badge badge--analise" style="flex:none">' +
                  quantas + ' ' + U.plural(quantas, "escolhida", "escolhidas") + '</span>'
                : '') +
            '</div>'
          : '') +

        /* ROLA DENTRO DE SI, e a página para de crescer. Era esse o
           problema: cinquenta empresas empurravam o botão de gerar
           o link para fora da tela. */
        '<div class="deptos deptos--rola">' +
          (visiveis.length
            ? visiveis.map(function (c) {
                var on = !!outrasEscolhidas[c.id];
                return '<label class="depto' + (on ? ' depto--on' : '') + '">' +
                  '<input type="checkbox" data-outra="' + U.escAttr(c.id) + '"' +
                    (on ? ' checked' : '') + '>' +
                  '<span class="depto__txt">' + U.esc(PC.nomeDe(c)) +
                    (c.empresa.cnpj ? ' <span class="text-xs text-muted">· ' +
                      U.esc(c.empresa.cnpj) + '</span>' : '') + '</span>' +
                '</label>';
              }).join("")
            : '<p class="text-xs text-muted" style="margin:8px 4px">' +
              'Nenhuma empresa com esse nome ou CNPJ.</p>') +
        '</div>' +

        /* O que está escolhido e sumiu no filtro precisa continuar
           dito em algum lugar — senão a pessoa marca, busca outra e
           fica sem saber o que já escolheu. */
        (termo && quantas
          ? '<p class="text-xs text-muted" style="margin:8px 0 0">' +
            quantas + ' ' + U.plural(quantas, "empresa escolhida", "empresas escolhidas") +
            ' no total, contando as que a busca escondeu.</p>'
          : '');

      var campo = $("#cBuscaOutra");
      if (campo && buscaOutras) {
        /* Redesenhar tira o foco do campo no meio da digitação. */
        campo.focus();
        campo.setSelectionRange(campo.value.length, campo.value.length);
      }
    }

    desenharOutras();

    /* O OUVINTE PRECISA ESPERAR O MÓDULO EXISTIR.

       Era `if (global.PainelClientes) ...aoAtualizar(...)`, e a
       condição nunca era verdadeira: no equipe.html este arquivo
       vem ANTES de painel-clientes.js, então na hora em que esta
       linha roda o módulo ainda não nasceu. O ouvinte não era
       registrado, e quem abria o painel direto em "Novo cliente"
       ficava com "Carregando as empresas…" para sempre — a lista
       chegava e ninguém redesenhava.

       Trocar a ordem dos <script> resolveria e quebraria outra
       coisa qualquer daqui a seis meses; esperar o módulo aparecer
       é local e não depende de ordem nenhuma. */
    var tentativas = 0;
    (function ligarNaLista() {
      if (global.PainelClientes) {
        global.PainelClientes.aoAtualizar(desenharOutras);
        desenharOutras();
        return;
      }
      if (++tentativas > 25) return;   /* ~5s: passou disso, não vem */
      setTimeout(ligarNaLista, 200);
    })();

    if (global.Painel) global.Painel.aoTrocar(function (aba) {
      if (aba === "novo") desenharOutras();
    });

    var caixaOutras = $("#cOutras");
    if (caixaOutras) {
      caixaOutras.addEventListener("change", function (ev) {
        var c = ev.target.closest("[data-outra]");
        if (!c) return;
        outrasEscolhidas[c.getAttribute("data-outra")] = c.checked;
        var rotulo = c.closest(".depto");
        if (rotulo) rotulo.classList.toggle("depto--on", c.checked);
        /* Só redesenha quando há contador para atualizar; mexer no
           DOM a cada clique tiraria o foco de quem usa o teclado. */
        if ($("#cBuscaOutra")) desenharOutras();
      });

      caixaOutras.addEventListener("input", function (ev) {
        if (ev.target.id !== "cBuscaOutra") return;
        buscaOutras = ev.target.value;
        desenharOutras();
      });
    }

    /* Escolher os documentos antes de a empresa existir. A
       escolha fica em memória e é aplicada logo após o cadastro.
       Guardar num global é feio, mas é o que evita reescrever o
       fluxo inteiro do "Gerar link" só por causa disto. */
    var btnDocs = $("#cDocs");
    if (btnDocs) btnDocs.addEventListener("click", function () {
      var jaEscolhido = {};
      (global.__docsNovoCliente || []).forEach(function (mu) {
        mu.chaves.forEach(function (k) { jaEscolhido[k] = { naEquipe: mu.naEquipe }; });
      });

      global.Aplicacao.abrir({
        titulo: "Documentos deste cliente",
        itens: jaEscolhido,
        /* Sem sócios ainda: quem cadastra os sócios é o cliente.
           A definição de item de sócio fica guardada e vale para
           os que ele criar. */
        socios: [],
        aoSalvar: function (mudancas) {
          global.__docsNovoCliente = mudancas;
          var fora = mudancas.filter(function (m) { return m.naEquipe === true; }).length;
          var resumo = $("#cDocsResumo");
          if (resumo) {
            resumo.textContent = fora
              ? fora + " " + U.plural(fora, "documento fora da lista", "documentos fora da lista")
              : "Todos, por enquanto";
          }
          UI.toast("Escolha guardada. Ela é aplicada quando você gerar o link.", "ok", 6000);
          return true;
        }
      });
    });

    $("#cCopiar").addEventListener("click", function () { copiar(campoLink.value, "Link copiado."); });
    $("#cCopiarMsg").addEventListener("click", function () { copiar(campoMsg.value, "Mensagem copiada."); });

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

    /* TROCAR A CHAVE COM O CANAL ATIVO APAGA O PASSADO.

       Gerar um par aqui não publica nada — o par novo só vale
       depois que alguém cola a chave pública no código e sobe. Mas
       o botão fica em primeiro lugar numa tela que diz "canal
       ativo", e quem seguir o caminho até o fim torna ilegível
       TODA senha que os clientes já enviaram: elas foram trancadas
       com a chave antiga, e só a chave antiga abre.

       Não dá para desfazer nem para avisar depois. Então avisa
       antes, uma vez, e só quando já existe canal. */
    function gerarPar() {
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
    }

    $("#kGerar").addEventListener("click", function () {
      if (!C.configurada) { gerarPar(); return; }
      UI.modal({
        titulo: "Já existe um canal seguro",
        corpoHTML:
          '<p style="font-size:13.5px;line-height:1.65;color:var(--txt-2)">' +
            'As senhas que os clientes já enviaram foram trancadas com a chave atual, e ' +
            '<strong>só ela abre</strong>. Se você publicar uma chave nova no lugar, essas ' +
            'senhas deixam de poder ser lidas — não há como desfazer.</p>' +
          '<p style="font-size:13.5px;line-height:1.65;color:var(--txt-2);margin-top:10px">' +
            'Gerar aqui não muda nada sozinho: o par novo só passa a valer quando alguém ' +
            'cola a chave pública no código e publica. Siga só se for isso mesmo que você ' +
            'quer fazer.</p>',
        acoes: [
          { rotulo: "Cancelar", classe: "btn--ghost" },
          { rotulo: "Gerar mesmo assim", classe: "btn--primary", onClick: gerarPar }
        ]
      });
    });

    $("#kCopiarPub").addEventListener("click", function () { copiar($("#kPub").value, "Chave pública copiada."); });

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

  /* O que a ficha do cliente precisa para reemitir um acesso. */
  global.Convite = {
    gerar: gerarConvite,
    copiar: copiar,
    enderecoPadrao: enderecoPadrao
  };

  /* A liberação de extratos é montada na ficha do cliente, que é
     onde a equipe já está quando vai atrás disso. O que ela precisa
     daqui é só gravar e devolver o link pronto. */
  global.Extratos = {
    salvar: salvarExtratos,
    link: function (codigo) { return montarLinkExtratos(enderecoPadrao(), codigo); },
    mensagem: mensagemExtratos
  };
})(window);
