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

    var q = FB.db.collection("auditoria").orderBy("em", "desc").limit(pagina);
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
  function visiveis() {
    if (filtro === "todos") return eventos;
    return eventos.filter(function (r) { return grupoDe(r.tipo) === filtro; });
  }

  function desenharFiltros() {
    var caixa = $("#trFiltros");
    if (!caixa) return;
    caixa.innerHTML = FILTROS.map(function (f) {
      var n = f.id === "todos" ? eventos.length
            : eventos.filter(function (r) { return grupoDe(r.tipo) === f.id; }).length;
      return '<button type="button" class="filtro' + (filtro === f.id ? " filtro--on" : "") +
        '" data-ftrilha="' + U.escAttr(f.id) + '">' + U.esc(f.rotulo) + ' <b>' + n + '</b></button>';
    }).join("");
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
          (eventos.length ? "Nada deste tipo nesta parte do registro" : "O registro está vazio") +
        '</div>' +
        '<div class="empty__desc">' +
          (eventos.length
            ? "Foram lidos " + eventos.length + " eventos, e nenhum é deste tipo. " +
              "Toque em Ler mais para ir mais para trás."
            : "Nada foi registrado ainda, ou as funções do servidor não estão publicadas.") +
        '</div></div>';
    } else {
      caixa.innerHTML = '<div class="trilha">' + lista.map(linhaHTML).join("") + '</div>';
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
      if (ev.target.closest("#trLerMais")) { carregar(true); return; }
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
