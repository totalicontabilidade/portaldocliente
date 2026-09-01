/* ============================================================
   Totali · Portal de Onboarding
   painel-trilha.js — o registro do servidor, na tela

   O QUE ISTO RESOLVE
   ------------------
   A trilha em /auditoria existe desde que as Cloud Functions
   entraram, e nunca teve tela. Para saber quem abriu qual senha,
   só abrindo o console do Firebase — exatamente o que este painel
   promete não exigir de ninguém.

   E era pior que uma ausência: a tela de Segurança diz ao
   administrador "veja no registro o que ela abriu", e o registro
   não tinha onde ser visto. Prometer e não entregar é o tipo de
   coisa que faz a pessoa desconfiar do resto.

   POR QUE ESTA TRILHA VALE MAIS QUE A OUTRA
   -----------------------------------------
   Existe uma segunda trilha, em /empresas/{id}/eventos, escrita
   pelo NAVEGADOR. Ela serve para acompanhar e depurar, e está
   escrito na própria regra que não tem valor probatório: a regra
   impede apagar, não impede inventar.

   Esta aqui é escrita por Cloud Function, com a hora do servidor,
   e a regra fecha a escrita para todo mundo — cliente, equipe e
   administrador. Quem é parte interessada não escreve. É isso, e
   só isso, que faz o registro valer alguma coisa.

   SÓ ADMINISTRADOR VÊ ESTA TELA
   -----------------------------
   Ela mora dentro da aba Segurança, que já é só de administrador
   (ver SO_ADMIN em painel.js). A regra do Firestore continua
   liberando a LEITURA para a equipe inteira, e de propósito: o
   Dossiê de entrada em PDF lê a mesma coleção para dizer quando
   cada documento chegou e quem aprovou, e qualquer pessoa da
   equipe gera esse PDF. Fechar a coleção para admin faria o
   dossiê sair mudo, calado, sem ninguém entender por quê.

   POR QUE O FILTRO É FEITO AQUI, E NÃO NA CONSULTA
   ------------------------------------------------
   Filtrar por tipo no servidor exigiria índice composto
   (`tipo` + `em`), e índice é mais uma coisa para publicar à mão
   quando alguém acrescentar um tipo de evento. A consulta traz a
   página por data e o filtro se aplica sobre o que veio. Em
   compensação, uma página filtrada pode vir curta — por isso o
   rodapé diz quantos daquela página passaram no filtro.
   ============================================================ */
(function (global) {
  "use strict";

  var U = global.U, UI = global.UI;
  var $ = UI.$;
  var ic = UI.icone;

  var FB = null;
  var pagina = 100;        /* eventos por leitura */
  var eventos = [];        /* o que já foi lido, em ordem */
  var ultimoDoc = null;    /* onde a próxima leitura recomeça */
  var acabou = false;
  var carregando = false;
  var filtro = "todos";
  var busca = "";
  var periodo = 30;        /* dias; 0 = desde o começo */

  /* QUANTAS LINHAS CHEGAM A EXISTIR NO HTML.

     A lista rola dentro de uma caixa, então a página não cresce
     mais — mas o navegador continua desenhando cada linha lida, e
     com alguns milhares isso pesa mesmo dentro da caixa. O teto
     abaixo é o que impede a tela de ficar lenta em silêncio;
     passando dele, o caminho é filtrar, e a tela diz isso. */
  var TETO_NA_TELA = 300;

  /* O PERÍODO É O QUE MAIS SEGURA O PESO, porque corta na
     CONSULTA — não adianta desenhar menos se o navegador já
     baixou tudo.

     Trinta dias por padrão: é o que responde "o que andou
     acontecendo por aqui". Quem procura um fato antigo escolhe o
     período maior de propósito, sabendo que vai esperar mais. */
  var PERIODOS = [
    { id: 7,  rotulo: "7 dias" },
    { id: 30, rotulo: "30 dias" },
    { id: 90, rotulo: "90 dias" },
    { id: 0,  rotulo: "Desde o começo" }
  ];

  /* ---------- Como cada evento se chama em português ----------

     A chave é o `tipo` gravado pela função. O texto é o que a
     pessoa lê: verbo no passado, porque é um fato consumado, e
     sem jargão do sistema — "Senha aberta", não
     "credencial:aberta". */
  var NOMES = {
    "credencial:aberta":   { texto: "Senha aberta",            icone: "ic-lock",         peso: "forte" },
    "credencial:guardada": { texto: "Senha guardada",          icone: "ic-lock",         grupo: "senhas" },
    "credencial:apagada":  { texto: "Senha apagada",           icone: "ic-trash",        grupo: "senhas", peso: "forte" },
    "item:enviado":        { texto: "Documento enviado",       icone: "ic-clipe",        grupo: "documentos" },
    "item:removido":       { texto: "Documento removido",      icone: "ic-trash",        grupo: "documentos", peso: "forte" },
    "item:valor":          { texto: "Dado preenchido",         icone: "ic-file",         grupo: "documentos" },
    "item:aprovado":       { texto: "Documento aprovado",      icone: "ic-check-circle", grupo: "documentos" },
    "item:correcao":       { texto: "Correção pedida",         icone: "ic-alert",        grupo: "documentos" },
    "item:analise":        { texto: "Documento em análise",    icone: "ic-clock",        grupo: "documentos" },
    "item:revisao":        { texto: "Revisão alterada",        icone: "ic-refresh",      grupo: "documentos" },
    "item:naEquipe":       { texto: "Documento dispensado",    icone: "ic-folder",       grupo: "documentos" },
    "acesso:criado":       { texto: "Acesso criado",           icone: "ic-users",        grupo: "acessos" },
    "acesso:revogado":     { texto: "Acesso revogado",         icone: "ic-users",        grupo: "acessos", peso: "forte" },
    "equipe:senha-trocada":{ texto: "Senha da equipe trocada", icone: "ic-badge",        grupo: "equipe", peso: "forte" },
    "aviso:automatico":    { texto: "Aviso automático enviado", icone: "ic-send",        grupo: "sistema" }
  };

  /* O filtro "senhas" junta abertura, guarda e apagamento: quem
     vem aqui atrás de senha quer as três coisas, não uma. */
  var FILTROS = [
    { id: "todos",      rotulo: "Tudo" },
    { id: "senhas",     rotulo: "Senhas" },
    { id: "documentos", rotulo: "Documentos" },
    { id: "acessos",    rotulo: "Acessos" },
    { id: "equipe",     rotulo: "Equipe" }
  ];

  function nomeDe(tipo) {
    return NOMES[tipo] || { texto: tipo || "Evento", icone: "ic-info" };
  }

  function grupoDe(tipo) {
    var n = NOMES[tipo];
    if (!n) return "sistema";
    return n.grupo || "senhas";
  }

  /* A hora vem como Timestamp do servidor. Registro sem hora não
     deveria existir, mas se existir é melhor dizer "sem data" do
     que mostrar 31/12/1969. */
  function emMs(v) {
    if (!v) return 0;
    if (typeof v === "number") return v;
    if (typeof v.toMillis === "function") { try { return v.toMillis(); } catch (e) { return 0; } }
    if (typeof v.seconds === "number") return v.seconds * 1000;
    var t = Date.parse(v);
    return isNaN(t) ? 0 : t;
  }

  /* O nome da empresa, quando a lista de clientes já carregou. Sem
     ela, o id cru — que é feio e ainda assim melhor que nada,
     porque permite procurar. */
  function empresaDe(id) {
    if (!id) return "";
    var PC = global.PainelClientes;
    if (PC && PC.empresas) {
      var achou = PC.empresas.filter(function (c) { return c.id === id; })[0];
      if (achou) return PC.nomeDe(achou);
    }
    return id;
  }

  /* O detalhe muda com o tipo: no documento é a chave, na senha é
     a credencial, no acesso é quem entrou. Uma função só evita
     quinze condicionais espalhadas pelo desenho. */
  function detalheDe(r) {
    if (r.chave) {
      var extra = "";
      if (r.tipo === "item:enviado" && Array.isArray(r.arquivos) && r.arquivos.length) {
        extra = " · " + r.arquivos.join(", ");
      }
      if (r.tipo === "item:correcao" && r.motivo) extra = " · " + r.motivo;
      if (r.tipo === "item:naEquipe") {
        extra = r.seAplica === null ? " · voltou a valer o que o cliente marcou"
              : r.seAplica ? " · passou a ser exigido" : " · deixou de ser exigido";
      }
      return r.chave + extra;
    }
    if (r.tipo === "equipe:senha-trocada") return "de " + (r.alvo || r.alvoUid || "alguém");
    if (r.tipo === "acesso:criado") {
      return (r.origem === "equipe" ? "criado pela equipe" : "pelo convite") +
             (r.uid ? " · " + String(r.uid).slice(0, 10) + "…" : "");
    }
    if (r.tipo === "acesso:revogado" && r.uid) return String(r.uid).slice(0, 10) + "…";
    if (r.tipo === "aviso:automatico") return r.faltavam ? r.faltavam + " documentos faltando" : "";
    return "";
  }

  /* ---------- Leitura ---------- */
  function carregar(maisUma) {
    if (carregando || (acabou && maisUma)) return Promise.resolve();
    FB = global.FB;
    if (!FB || !FB.ligado || !FB.equipe) { desenhar(); return Promise.resolve(); }

    carregando = true;
    if (!maisUma) { eventos = []; ultimoDoc = null; acabou = false; }
    desenhar();

    /* O corte por data usa o MESMO campo da ordenação, e é por
       isso que não precisa de índice composto no Firestore —
       índice é mais uma coisa para publicar à mão, e some da
       cabeça de quem mantém o sistema depois. */
    var q = FB.db.collection("auditoria");
    if (periodo > 0) {
      q = q.where("em", ">=", new Date(Date.now() - periodo * 86400000));
    }
    q = q.orderBy("em", "desc").limit(pagina);
    if (maisUma && ultimoDoc) q = q.startAfter(ultimoDoc);

    return q.get().then(function (snap) {
      snap.forEach(function (d) {
        var r = d.data() || {};
        r.__id = d.id;
        eventos.push(r);
      });
      ultimoDoc = snap.docs.length ? snap.docs[snap.docs.length - 1] : ultimoDoc;
      if (snap.size < pagina) acabou = true;
      carregando = false;
      desenhar();
    }, function (e) {
      carregando = false;
      acabou = true;
      desenhar();
      UI.toast("Não foi possível ler o registro: " + FB.explicar(e), "erro", 9000);
    });
  }

  /* ---------- Desenho ---------- */
  /* A BUSCA VARRE O QUE JÁ FOI LIDO, não o banco inteiro.

     Procurar por nome no servidor exigiria índice composto
     (`uid` + `em`) e, mesmo assim, só acharia por uid — não por
     "Raoni", nem por empresa, nem por nome de arquivo. Varrendo o
     que está na mão, a mesma caixa acha as quatro coisas.

     O preço é honesto e está dito na tela: ela procura dentro do
     período escolhido. Quem não achar aumenta o período. */
  function combina(r) {
    if (!busca) return true;
    var alvo = [
      nomeDe(r.tipo).texto, r.por || "", empresaDe(r.empresaId),
      r.chave || "", detalheDe(r)
    ].join(" ").toLowerCase();
    return alvo.indexOf(busca) > -1;
  }

  function visiveis() {
    return eventos.filter(function (r) {
      return (filtro === "todos" || grupoDe(r.tipo) === filtro) && combina(r);
    });
  }

  function desenharFiltros() {
    var caixa = $("#trFiltros");
    if (!caixa) return;

    /* O período em cima porque decide o que é BAIXADO; o assunto
       e a busca embaixo porque só recortam o que já veio. A ordem
       na tela é a ordem em que as decisões acontecem. */
    var linhaPeriodo = '<div class="row" style="gap:8px;align-items:center;flex-wrap:wrap">' +
      '<span class="text-xs text-muted" style="flex:none">Período</span>' +
      PERIODOS.map(function (p) {
        return '<button type="button" class="filtro' + (periodo === p.id ? " filtro--on" : "") +
          '" data-ptrilha="' + p.id + '">' + U.esc(p.rotulo) + '</button>';
      }).join("") +
    '</div>';

    var linhaAssunto = '<div class="row" style="gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px">' +
      FILTROS.map(function (f) {
        var n = eventos.filter(function (r) {
          return f.id === "todos" || grupoDe(r.tipo) === f.id;
        }).length;
        return '<button type="button" class="filtro' + (filtro === f.id ? " filtro--on" : "") +
          '" data-ftrilha="' + U.escAttr(f.id) + '">' + U.esc(f.rotulo) + ' <b>' + n + '</b></button>';
      }).join("") +
    '</div>';

    var linhaBusca = '<div style="margin-top:10px">' +
      '<input type="search" class="input" id="trBusca" autocomplete="off" ' +
        'placeholder="Procurar por pessoa, empresa ou documento" ' +
        'value="' + U.escAttr(busca) + '">' +
      '<div class="field__hint">Procura dentro do período escolhido. Não achou? Aumente o ' +
        'período acima.</div>' +
    '</div>';

    caixa.innerHTML = linhaPeriodo + linhaAssunto + linhaBusca;

    var campo = $("#trBusca");
    if (campo && busca) {
      campo.focus();
      campo.setSelectionRange(campo.value.length, campo.value.length);
    }
  }

  function linhaHTML(r) {
    var n = nomeDe(r.tipo);
    var quando = emMs(r.em);
    var quem = r.por || (r.uid ? String(r.uid).slice(0, 10) + "…" : "");
    var emp = empresaDe(r.empresaId);
    var det = detalheDe(r);

    return '<div class="trilha__l">' +
      '<span class="trilha__i' + (n.peso === "forte" ? " trilha__i--forte" : "") + '">' +
        ic(n.icone) + '</span>' +
      '<div class="trilha__c">' +
        '<div class="trilha__t">' + U.esc(n.texto) +
          (quem ? ' <span class="trilha__quem">· ' + U.esc(quem) + '</span>' : '') +
        '</div>' +
        (emp || det
          ? '<div class="trilha__d">' +
              (emp ? U.esc(emp) : "") +
              (emp && det ? " · " : "") +
              (det ? U.esc(det) : "") +
            '</div>'
          : '') +
      '</div>' +
      '<span class="trilha__q">' +
        (quando ? U.esc(U.dataHora(quando)) : "sem data") + '</span>' +
    '</div>';
  }

  function desenhar() {
    var caixa = $("#trLista");
    if (!caixa) return;
    desenharFiltros();

    if (carregando && !eventos.length) {
      caixa.innerHTML = '<p class="text-sm text-muted" style="margin:0">Lendo o registro…</p>';
      $("#trMais").innerHTML = "";
      return;
    }

    var lista = visiveis();

    if (!lista.length) {
      caixa.innerHTML = '<div class="empty" style="padding:26px 10px">' +
        '<div class="empty__icon">' + ic("ic-scroll") + '</div>' +
        '<div class="empty__title">' +
          (eventos.length ? "Nada com esse recorte" : "Nada neste período") +
        '</div>' +
        '<div class="empty__desc">' +
          (eventos.length
            ? "Foram lidos " + eventos.length + " eventos no período, e nenhum passa nos " +
              "filtros. Tente um período maior ou limpe a busca."
            : periodo > 0
              ? "Nada foi registrado nos últimos " + periodo + " dias. Escolha um período " +
                "maior para ver mais atrás."
              : "Nada foi registrado ainda, ou as funções do servidor não estão publicadas.") +
        '</div></div>';
    } else {
      /* A CAIXA ROLA, E A PÁGINA PARA DE CRESCER.

         Com 80 eventos a lista media 5 metros de altura e a página
         quase 7 — cada evento novo empurrava o rodapé mais para
         baixo, para sempre. Agora a lista tem altura fixa e rola
         dentro de si, com a barra à vista. */
      var mostradas = lista.slice(0, TETO_NA_TELA);
      caixa.innerHTML =
        '<div class="trilha trilha--rola">' + mostradas.map(linhaHTML).join("") + '</div>' +
        (lista.length > mostradas.length
          ? '<p class="text-xs text-muted" style="margin:10px 0 0">Mostrando as ' +
            TETO_NA_TELA + ' mais recentes de ' + lista.length + ' que passaram no filtro. ' +
            'Para chegar às outras, estreite a busca ou o período.</p>'
          : '');
    }

    var pe = $("#trMais");
    if (!pe) return;
    if (acabou) {
      pe.innerHTML = '<p class="text-xs text-muted" style="margin:0">' +
        'Fim do registro — ' + eventos.length + ' ' +
        U.plural(eventos.length, "evento", "eventos") + ' ao todo.</p>';
    } else {
      pe.innerHTML = '<button type="button" class="btn btn--quiet btn--sm" id="trLerMais"' +
        (carregando ? " disabled" : "") + '>' +
        (carregando ? "Lendo…" : "Ler mais") + '</button>' +
        '<span class="text-xs text-muted" style="margin-left:10px">' +
          eventos.length + ' ' + U.plural(eventos.length, "evento lido", "eventos lidos") + '</span>';
    }
  }

  /* ---------- Início ---------- */
  function ligar() {
    document.addEventListener("click", function (ev) {
      var f = ev.target.closest("[data-ftrilha]");
      if (f) { filtro = f.getAttribute("data-ftrilha"); desenhar(); return; }

      var p = ev.target.closest("[data-ptrilha]");
      if (p) {
        var novo = Number(p.getAttribute("data-ptrilha"));
        if (novo === periodo) return;
        periodo = novo;
        /* Trocar o período muda o que se BAIXA, então recomeça do
           zero — aproveitar o que já veio misturaria dois recortes
           e o rodapé passaria a contar errado. */
        carregar(false);
        return;
      }

      if (ev.target.closest("#trLerMais")) { carregar(true); return; }
    });

    document.addEventListener("input", function (ev) {
      if (!ev.target || ev.target.id !== "trBusca") return;
      busca = String(ev.target.value || "").trim().toLowerCase();
      desenhar();
    });

    /* Só lê quando a aba é aberta. O registro cresce para sempre e
       não faz sentido puxar cem eventos em toda entrada no painel
       de quem nunca vai olhar isto. */
    if (global.Painel) {
      global.Painel.aoTrocar(function (aba) {
        if (aba === "seguranca" && !eventos.length) carregar(false);
      });
    }

    /* A lista de clientes chega depois e é ela que troca o id da
       empresa pelo nome. Sem redesenhar, o registro ficaria com
       identificadores crus até alguém trocar de aba. */
    var tentativas = 0;
    (function esperarClientes() {
      if (global.PainelClientes) {
        global.PainelClientes.aoAtualizar(function () { if (eventos.length) desenhar(); });
        return;
      }
      if (++tentativas > 25) return;
      setTimeout(esperarClientes, 200);
    })();
  }

  function iniciar() {
    if (!$("#trLista")) return;
    ligar();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})(window);
