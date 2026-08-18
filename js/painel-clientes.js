/* ============================================================
   Totali · Portal de Onboarding
   painel-clientes.js — a mesa de trabalho da equipe

   O QUE ESTA TELA RESOLVE
   -----------------------
   Do outro lado do portal tem gente esperando. Alguém da Totali
   precisa saber, sem abrir cliente por cliente: quem está parado,
   o que falta, o que chegou e ainda não foi conferido. E precisa
   conseguir agir dali mesmo — aprovar, pedir correção, cobrar.

   COMO SE LIGA AO RESTO
   ---------------------
   Lê e escreve as mesmas coleções que o portal do cliente. A
   conta de progresso vem de js/situacao.js, a mesma que o cliente
   usa — se divergisse, a equipe veria um número e o cliente outro.

   O QUE ESTA TELA NÃO FAZ
   -----------------------
   Não guarda senha de cliente em lugar nenhum. As credenciais
   chegam cifradas e só abrem com a chave privada, que a pessoa
   carrega na hora, fica na memória da aba e some ao fechar.

   Regra de ouro, igual à do portal: nada que veio do cliente
   entra em innerHTML sem passar por U.esc().
   ============================================================ */
(function (global) {
  "use strict";

  var U = global.U, UI = global.UI, DATA = global.DATA;
  var $ = UI.$, $$ = UI.$$, ic = UI.icone;

  var FB = null;
  var equipe = null;

  /* Lista de empresas e o que já foi carregado de cada uma. */
  var empresas = [];
  var carregando = false;
  var filtro = { texto: "", situacao: "todos" };

  /* Cliente aberto no momento. */
  var aberto = null;      /* {id, empresa, dados, mensagens, financeiro, credenciais} */

  /* Chave privada carregada nesta aba. Nunca é gravada. */
  var chavePrivada = null;

  /* =========================================================
     Leitura
     ========================================================= */

  /* Um cliente inteiro, em uma ida ao servidor por coleção. */
  function carregarCliente(id) {
    var raiz = FB.db.collection("empresas").doc(id);
    return Promise.all([
      raiz.get(),
      raiz.collection("itens").get(),
      raiz.collection("socios").get(),
      raiz.collection("mensagens").get(),
      raiz.collection("financeiro").get(),
      raiz.collection("acessos").get(),
      /* Convites em aberto desta empresa. Cada um é uma chave que
         ainda abre a porta — precisa estar visível e poder ser
         revogado, senão um link vazado só morre apagando a
         empresa inteira. */
      FB.db.collection("convites").where("empresaId", "==", id).get()
        .catch(function () { return { forEach: function () {} }; })
    ]).then(function (r) {
      var itens = {};
      r[1].forEach(function (d) { itens[global.Nuvem.decodificar(d.id)] = d.data() || {}; });

      var socios = [];
      r[2].forEach(function (d) {
        var s = d.data() || {};
        socios.push({ id: d.id, nome: s.nome || "", cpf: s.cpf || "" });
      });

      var mensagens = [];
      r[3].forEach(function (d) {
        var m = d.data() || {};
        m.id = d.id;
        mensagens.push(m);
      });
      mensagens.sort(function (a, b) { return (a.em || 0) - (b.em || 0); });

      var financeiro = null, gruposNA = {}, recibos = {};
      r[4].forEach(function (d) {
        if (d.id === "principal") financeiro = d.data() || {};
        if (d.id === "geral") {
          var g = d.data() || {};
          gruposNA = g.gruposNA || {};
          Object.keys(g.credenciaisEnviadas || {}).forEach(function (k) {
            recibos[global.Nuvem.decodificar(k)] = g.credenciaisEnviadas[k];
          });
        }
      });

      /* Quem tem acesso ao portal desta empresa. Vazio significa
         que ninguém abriu o convite ainda — ou que o vínculo se
         perdeu e precisa de link novo. */
      var acessos = [];
      r[5].forEach(function (d) {
        var a = d.data() || {};
        acessos.push({ uid: d.id, em: a.em, codigo: a.codigo || "" });
      });

      /* O e-mail que interessa aqui é o do LOGIN, não o do
         cadastro. São coisas diferentes e costumam divergir: o
         cadastro guarda o contato do responsável, e o acesso pode
         ter sido criado com outro endereço. Mandar redefinição de
         senha para o e-mail do cadastro erra o alvo — não existe
         conta naquele endereço.

         Ele está em clientes/{uid}, gravado quando o cliente abriu
         o convite. Uma leitura por acesso, e quase sempre há um só. */
      var buscarLogins = Promise.all(acessos.map(function (a) {
        return FB.db.collection("clientes").doc(a.uid).get().then(function (d) {
          a.email = d.exists ? String((d.data() || {}).email || "") : "";
        }, function () { a.email = ""; });
      }));

      var convites = [];
      r[6].forEach(function (d) {
        var v = d.data() || {};
        if (v.ativo !== true) return;   /* usado já não abre nada */
        convites.push({ codigo: d.id, criadoEm: v.criadoEm });
      });

      return buscarLogins.then(function () {
        return {
          id: id,
          acessos: acessos,
          convites: convites,
          empresa: r[0].exists ? (r[0].data() || {}) : {},
          dados: {
            itens: itens, socios: socios, gruposNA: gruposNA,
            temCredencial: function (chave) {
              var c = recibos[chave];
              return !!(c && c.campos && c.campos.length);
            }
          },
          recibos: recibos,
          mensagens: mensagens,
          financeiro: financeiro
        };
      });
    });
  }

  /* A lista precisa do progresso de cada empresa, e o progresso
     depende dos itens. São várias idas ao servidor — por isso a
     lista carrega uma vez e fica em memória até pedirem para
     atualizar. */
  function carregarLista() {
    if (carregando) return Promise.resolve();
    carregando = true;
    desenharLista();
    desenharPendencias();
    desenharMensagens();

    return FB.db.collection("empresas").get().then(function (snap) {
      var ids = [];
      snap.forEach(function (d) { ids.push(d.id); });

      return ids.reduce(function (fila, id) {
        return fila.then(function (acc) {
          return carregarCliente(id).then(function (c) {
            acc.push(c);
            return acc;
          }, function () { return acc; });
        });
      }, Promise.resolve([]));
    }).then(function (lista) {
      empresas = lista;
      carregando = false;
      desenharTudo();
    }, function (e) {
      carregando = false;
      empresas = [];
      desenharTudo();
      UI.toast("Não foi possível carregar os clientes: " + FB.explicar(e), "erro", 9000);
    });
  }

  /* As três abas comem da mesma carga de dados. Redesenhar todas
     evita o caso de trocar de aba e encontrar número velho. */
  function desenharTudo() {
    desenharLista();
    desenharPendencias();
    desenharMensagens();
    atualizarContadores();
  }

  function nomeDe(c) {
    return (c.empresa.nomeFantasia || c.empresa.razaoSocial || "Sem nome").trim();
  }

  /* =========================================================
     Há quanto tempo o cliente não mexe

     A lista era alfabética, e ordem alfabética não diz nada sobre
     quem precisa de atenção: o cliente que travou há três semanas
     ficava no meio, entre dois que estão em dia. Aqui a conta
     olha só para sinais do CLIENTE — documento que ele enviou,
     mensagem que ele escreveu, o aceite dele. Aprovação e recado
     da equipe de propósito não contam: se contassem, cobrar o
     cliente "zeraria" o tempo parado dele, que é o contrário do
     que a lista precisa mostrar.
     ========================================================= */
  /* Data em milissegundos, venha de onde vier.

     O portal do cliente grava número (Date.now no aparelho dele);
     o painel grava carimbo do servidor, que volta como objeto
     Timestamp. Comparar os dois sem converter dá sempre falso, e
     a empresa recém-criada apareceria como "sem atividade". */
  function emMs(v) {
    if (!v) return 0;
    if (typeof v === "number") return v;
    if (typeof v.toMillis === "function") return v.toMillis();
    if (typeof v.seconds === "number") return v.seconds * 1000;
    return 0;
  }

  function ultimaAtividade(c) {
    var t = 0;
    var e = c.empresa || {};

    Object.keys(c.dados.itens || {}).forEach(function (k) {
      var em = emMs((c.dados.itens[k] || {}).atualizadoEm);
      if (em > t) t = em;
    });
    (c.mensagens || []).forEach(function (m) {
      if (m.autor === "cliente" && emMs(m.em) > t) t = emMs(m.em);
    });
    if (emMs(e.aceiteLGPD) > t) t = emMs(e.aceiteLGPD);
    if (c.financeiro && emMs(c.financeiro.concluidoEm) > t) t = emMs(c.financeiro.concluidoEm);

    /* Nunca deu sinal de vida: conta a partir do cadastro. Sem
       isso, quem nunca entrou ficaria sem tempo nenhum e cairia
       no fim da fila — justamente quem mais precisa de um
       telefonema. `criadaEm` é do painel, `criadoEm` do portal. */
    if (!t) t = emMs(e.criadaEm) || emMs(e.criadoEm) || 0;
    return t;
  }

  var DIA = 86400000;

  function diasParado(c) {
    var t = ultimaAtividade(c);
    if (!t) return null;
    return Math.floor((Date.now() - t) / DIA);
  }

  function textoParado(c) {
    var d = diasParado(c);
    if (d === null) return "";
    if (d <= 0) return "mexeu hoje";
    if (d === 1) return "parado há 1 dia";
    return "parado há " + d + " dias";
  }

  /* Ordem de trabalho, não ordem de catálogo:
       1. arquivadas por último, sempre;
       2. quem ainda deve alguma coisa antes de quem já entregou;
       3. dentro de cada faixa, o mais parado no topo.
     É a fila de quem ligar primeiro. */
  function ordemDeTrabalho(a, b) {
    var arqA = arquivada(a) ? 1 : 0, arqB = arquivada(b) ? 1 : 0;
    if (arqA !== arqB) return arqA - arqB;

    var abertoA = estadoDoCliente(a).chave === "emdia" ? 1 : 0;
    var abertoB = estadoDoCliente(b).chave === "emdia" ? 1 : 0;
    if (abertoA !== abertoB) return abertoA - abertoB;

    var ta = ultimaAtividade(a) || 0, tb = ultimaAtividade(b) || 0;
    if (ta !== tb) return ta - tb;          /* mais antigo primeiro */
    return nomeDe(a).localeCompare(nomeDe(b), "pt-BR");
  }

  /* =========================================================
     Classificação do cliente
     ========================================================= */

  /* Em que ponto do onboarding o cliente está. É o que separa
     "ainda nem entrou" de "entregou tudo e está esperando". */
  function estadoDoCliente(c) {
    var resumo = global.Situacao.resumoGeral(c.dados, DATA.GRUPOS);
    var e = c.empresa;
    var cadastroOk = !!(e.razaoSocial && e.cnpj && e.responsavelNome &&
                        e.responsavelEmail && e.responsavelTelefone &&
                        c.dados.socios.length);

    var chave;
    if (e.arquivadaEm) chave = "arquivada";
    else if (!e.aceiteLGPD) chave = "naoentrou";
    else if (!cadastroOk) chave = "cadastro";
    else if (resumo.pendencias > 0) chave = "correcao";
    else if (resumo.pendentesObrigatorios > 0) chave = "faltando";
    else if (naoConferidos(c).length) chave = "conferir";
    else chave = "emdia";

    return { chave: chave, resumo: resumo, cadastroOk: cadastroOk };
  }

  /* Entregues que ainda não passaram pela conferência. É a fila
     de trabalho da equipe. */
  function naoConferidos(c) {
    var fora = [];
    DATA.GRUPOS.forEach(function (g) {
      var alvos = g.escopo === "socio"
        ? c.dados.socios.map(function (s) { return s.id; })
        : [null];
      alvos.forEach(function (socioId) {
        g.itens.forEach(function (item) {
          var sit = global.Situacao.de(c.dados, g, item, socioId);
          if (sit !== "enviado") return;
          fora.push({
            grupo: g, item: item, socioId: socioId,
            chave: global.Situacao.chaveItem(g.id, item.id, socioId)
          });
        });
      });
    });
    return fora;
  }

  var ROTULO_ESTADO = {
    naoentrou: { texto: "Ainda não entrou", cls: "badge--pendente" },
    cadastro:  { texto: "Preenchendo cadastro", cls: "badge--analise" },
    correcao:  { texto: "Aguardando correção", cls: "badge--pendencia" },
    faltando:  { texto: "Faltam documentos", cls: "badge--pendente" },
    conferir:  { texto: "Para conferir", cls: "badge--analise" },
    emdia:     { texto: "Em dia", cls: "badge--aprovado" },
    arquivada: { texto: "Arquivada", cls: "badge--na" }
  };

  var ROTULO_SITUACAO = {
    enviado:     { texto: "Para conferir",     cls: "badge--analise" },
    analise:     { texto: "Em análise",        cls: "badge--analise" },
    aprovado:    { texto: "Aprovado",          cls: "badge--aprovado" },
    pendencia:   { texto: "Correção pedida",   cls: "badge--pendencia" },
    substituido: { texto: "Coberto pela CNH",  cls: "badge--aprovado" },
    na:          { texto: "Não se aplica",     cls: "badge--na" },
    pendente:    { texto: "Não enviado",       cls: "badge--pendente" }
  };

  function badge(mapa, chave) {
    var m = mapa[chave] || { texto: chave, cls: "badge--pendente" };
    return '<span class="badge ' + m.cls + '"><span class="dot"></span>' + U.esc(m.texto) + '</span>';
  }

  /* =========================================================
     Tela 1 — lista de clientes
     ========================================================= */
  function arquivada(c) { return !!c.empresa.arquivadaEm; }

  function clientesFiltrados() {
    var t = filtro.texto.trim().toLowerCase();
    return empresas.filter(function (c) {
      /* Arquivada sai da lista de trabalho. Só aparece quando a
         pessoa pede — senão o encerramento não encerraria nada. */
      if (arquivada(c) && filtro.situacao !== "arquivada") return false;
      if (filtro.situacao !== "todos" && estadoDoCliente(c).chave !== filtro.situacao) return false;
      if (!t) return true;
      var alvo = [
        c.empresa.razaoSocial, c.empresa.nomeFantasia, c.empresa.cnpj,
        c.empresa.responsavelNome, c.empresa.responsavelEmail
      ].join(" ").toLowerCase();
      return alvo.indexOf(t) > -1;
    }).sort(ordemDeTrabalho);
  }

  function desenharLista() {
    var caixa = $("#clLista");
    if (!caixa) return;

    if (carregando) {
      caixa.innerHTML = '<div class="card card--pad"><p class="text-sm text-muted">' +
        'Carregando clientes…</p></div>';
      return;
    }

    if (!empresas.length) {
      caixa.innerHTML = '<div class="card"><div class="empty">' +
        '<div class="empty__icon">' + ic("ic-users") + '</div>' +
        '<div class="empty__title">Nenhum cliente cadastrado</div>' +
        '<div class="empty__desc">Cadastre a primeira empresa na seção acima e envie o link.</div>' +
      '</div></div>';
      atualizarPlacar();
      return;
    }

    var lista = clientesFiltrados();
    if (!lista.length) {
      caixa.innerHTML = '<div class="card"><div class="empty">' +
        '<div class="empty__title">Nenhum cliente nesse filtro</div>' +
        '<div class="empty__desc">Mude a busca ou volte para "todos".</div>' +
      '</div></div>';
      atualizarPlacar();
      return;
    }

    caixa.innerHTML =
      '<p class="text-xs text-muted" style="margin:0 0 8px 2px">Quem está parado há mais ' +
        'tempo aparece primeiro.</p>' +
      '<div class="card">' + lista.map(function (c) {
      var est = estadoDoCliente(c);
      var falta = est.resumo.pendentesObrigatorios;
      var conferir = naoConferidos(c).length;
      var naoLidas = c.mensagens.filter(function (m) {
        return m.autor === "cliente" && !m.lidaEm;
      }).length;

      /* O tempo parado é o motivo da ordem da lista. Se não
         estivesse escrito em cada linha, a ordem pareceria
         aleatória. Acima de 7 dias ganha destaque: é quando
         deixa de ser "está fazendo" e vira "travou". */
      var dias = diasParado(c);
      var alerta = est.chave !== "emdia" && !arquivada(c) && dias !== null && dias >= 7;

      return '<button type="button" class="cliente" data-cliente="' + U.escAttr(c.id) + '" ' +
        'style="border-bottom:1px solid var(--stroke)">' +
        '<span class="group__icon">' + ic("ic-building") + '</span>' +
        '<span class="cliente__info">' +
          '<span class="cliente__nome">' + U.esc(nomeDe(c)) + '</span>' +
          '<span class="cliente__meta">' + U.esc(c.empresa.cnpj || "sem CNPJ") + ' · ' +
            est.resumo.ok + ' de ' + est.resumo.total +
            (falta ? ' · faltam ' + falta : '') +
            (conferir ? ' · ' + conferir + ' para conferir' : '') +
            (naoLidas ? ' · ' + naoLidas + ' ' + U.plural(naoLidas, "mensagem nova", "mensagens novas") : '') +
            (textoParado(c)
              ? ' · <span class="cliente__parado' + (alerta ? " cliente__parado--alerta" : "") + '">' +
                U.esc(textoParado(c)) + '</span>'
              : '') +
          '</span>' +
        '</span>' +
        badge(ROTULO_ESTADO, est.chave) +
        '<span class="cliente__chev">' + ic("ic-chevron-right") + '</span>' +
      '</button>';
    }).join("") + '</div>';

    atualizarPlacar();
  }

  /* Os números do menu. Ficam fora do desenho de cada tela
     porque valem para todas: a pessoa precisa ver que tem
     mensagem nova mesmo estando na aba de conteúdo. */
  function atualizarContadores() {
    if (!global.Painel) return;
    var conferir = 0, correcao = 0, pendencias = 0, naoLidas = 0;

    /* Empresa arquivada não gera trabalho: contá-la faria o menu
       cobrar por cliente que já foi encerrado. */
    empresas.filter(function (c) { return !arquivada(c); }).forEach(function (c) {
      var est = estadoDoCliente(c);
      if (est.chave === "correcao") correcao++;
      else if (est.chave === "conferir") conferir++;
      pendencias += global.Situacao.pendencias(c.dados, DATA.GRUPOS).length;
      naoLidas += naoLidasDe(c);
    });

    global.Painel.marcarBadges({
      atencao: conferir + correcao,
      pendencias: pendencias,
      mensagens: naoLidas
    });
  }

  /* Contagem por situação — dá o panorama sem abrir ninguém. */
  function atualizarPlacar() {
    var placar = $("#clPlacar");
    if (!placar) return;

    var conta = {};
    empresas.forEach(function (c) {
      var k = estadoDoCliente(c).chave;
      conta[k] = (conta[k] || 0) + 1;
    });
    var ativas = empresas.filter(function (c) { return !arquivada(c); }).length;

    var ordem = ["correcao", "conferir", "faltando", "cadastro", "naoentrou", "emdia", "arquivada"];
    placar.innerHTML =
      '<button type="button" class="filtro' + (filtro.situacao === "todos" ? " filtro--on" : "") +
        '" data-filtro="todos">Todos <b>' + ativas + '</b></button>' +
      ordem.filter(function (k) { return conta[k]; }).map(function (k) {
        return '<button type="button" class="filtro' +
          (filtro.situacao === k ? " filtro--on" : "") + '" data-filtro="' + U.escAttr(k) + '">' +
          U.esc(ROTULO_ESTADO[k].texto) + ' <b>' + conta[k] + '</b></button>';
      }).join("");
  }

  /* =========================================================
     Aba Pendências — o que falta chegar, de todo mundo

     A lista de clientes responde "como está cada um". Esta
     responde outra pergunta, que é a do dia a dia: "quem eu
     cobro hoje, e do quê". Por isso ela ignora tudo o que já
     chegou e mostra só o que falta.
     ========================================================= */
  var filtroPendencia = "todas";
  var abertosPend = {};     /* empresas abertas   */
  var fechadosSetor = {};   /* setores fechados   */

  function pendenciasPorEmpresa() {
    return empresas.filter(function (c) { return !arquivada(c); }).map(function (c) {
      var lista = global.Situacao.pendencias(c.dados, DATA.GRUPOS);
      if (filtroPendencia === "correcao") {
        lista = lista.filter(function (p) { return p.sit === "pendencia"; });
      } else if (filtroPendencia === "faltando") {
        lista = lista.filter(function (p) { return p.sit !== "pendencia"; });
      }
      return { cliente: c, itens: lista };
    }).filter(function (x) { return x.itens.length; })
      .sort(function (a, b) {
        /* Quem tem correção pedida vem primeiro: é o cliente que
           já mandou algo e está preso esperando. */
        var ca = a.itens.filter(function (p) { return p.sit === "pendencia"; }).length;
        var cb = b.itens.filter(function (p) { return p.sit === "pendencia"; }).length;
        if (ca !== cb) return cb - ca;
        return b.itens.length - a.itens.length;
      });
  }

  function desenharPendencias() {
    var caixa = $("#pdLista");
    if (!caixa) return;

    if (carregando) {
      caixa.innerHTML = '<div class="card card--pad"><p class="text-sm text-muted">' +
        'Carregando…</p></div>';
      return;
    }

    var grupos = pendenciasPorEmpresa();
    var totalCorrecao = 0, totalFaltando = 0;
    empresas.forEach(function (c) {
      global.Situacao.pendencias(c.dados, DATA.GRUPOS).forEach(function (p) {
        if (p.sit === "pendencia") totalCorrecao++; else totalFaltando++;
      });
    });

    var filtros = $("#pdFiltros");
    if (filtros) {
      filtros.innerHTML = [
        { id: "todas", rotulo: "Todas", n: totalCorrecao + totalFaltando },
        { id: "correcao", rotulo: "Correções pedidas", n: totalCorrecao },
        { id: "faltando", rotulo: "Ainda não enviados", n: totalFaltando }
      ].map(function (f) {
        return '<button type="button" class="filtro' +
          (filtroPendencia === f.id ? " filtro--on" : "") +
          '" data-fpend="' + f.id + '">' + U.esc(f.rotulo) + ' <b>' + f.n + '</b></button>';
      }).join("");
    }

    if (!grupos.length) {
      caixa.innerHTML = '<div class="card"><div class="empty">' +
        '<div class="empty__icon">' + ic("ic-check-circle") + '</div>' +
        '<div class="empty__title">Nada pendente</div>' +
        '<div class="empty__desc">' +
          (empresas.length ? "Todo mundo entregou o que era obrigatório."
                           : "Ainda não há cliente cadastrado.") + '</div>' +
      '</div></div>';
      return;
    }

    caixa.innerHTML = grupos.map(cartaoPendencia).join("");
  }

  /* Cada empresa é um cartão que abre e fecha; dentro dela, um
     bloco por setor. Com dez clientes na tela, a lista aberta de
     uma vez viraria uma página impossível de percorrer. */
  function cartaoPendencia(g) {
    var c = g.cliente;
    var abertoEmp = !!abertosPend["emp:" + c.id];
    var correcoes = g.itens.filter(function (p) { return p.sit === "pendencia"; }).length;

    return '<div class="card pend" data-open="' + (abertoEmp ? "true" : "false") + '" ' +
        'style="margin-bottom:12px">' +
      '<div class="pend__topo">' +
        '<button type="button" class="pend__abrir" data-pemp="' + U.escAttr(c.id) + '">' +
          '<span class="group__icon">' + ic("ic-building") + '</span>' +
          '<span class="cliente__info">' +
            '<span class="cliente__nome">' + U.esc(nomeDe(c)) + '</span>' +
            '<span class="cliente__meta">' + g.itens.length + ' ' +
              U.plural(g.itens.length, "pendência", "pendências") +
              (c.empresa.responsavelNome ? ' · ' + U.esc(c.empresa.responsavelNome) : '') +
            '</span>' +
          '</span>' +
          (correcoes
            ? '<span class="badge badge--pendencia"><span class="dot"></span>' + correcoes + ' ' +
              U.plural(correcoes, "correção", "correções") + '</span>'
            : '') +
          '<span class="cliente__chev">' + ic("ic-chevron-down") + '</span>' +
        '</button>' +
        '<span class="pend__acoes">' +
          '<button type="button" class="btn btn--primary btn--sm" data-cobrar="' +
            U.escAttr(c.id) + '">' + ic("ic-send") + 'Cobrar</button>' +
          '<button type="button" class="btn btn--ghost btn--sm" data-cliente="' +
            U.escAttr(c.id) + '">Abrir ficha</button>' +
        '</span>' +
      '</div>' +
      (abertoEmp ? setoresHTML(c, g.itens) : '') +
    '</div>';
  }

  /* Dentro da empresa, um bloco por setor. Estes nascem ABERTOS:
     quem abriu a empresa quer ver o que falta, não clicar de novo
     em cada departamento. Fechar é a exceção, então guardamos os
     fechados, não os abertos. */
  function setoresHTML(c, itens) {
    var porSetor = [];
    var indice = {};
    itens.forEach(function (p) {
      if (!indice[p.grupo.id]) {
        indice[p.grupo.id] = { grupo: p.grupo, itens: [] };
        porSetor.push(indice[p.grupo.id]);
      }
      indice[p.grupo.id].itens.push(p);
    });

    return porSetor.map(function (s) {
      var chave = c.id + "|" + s.grupo.id;
      var fechado = !!fechadosSetor[chave];
      var correcoes = s.itens.filter(function (p) { return p.sit === "pendencia"; }).length;

      return '<div class="pend__setor" data-open="' + (fechado ? "false" : "true") + '">' +
        '<button type="button" class="group__head group__head--selo pend__setorCab" ' +
            'data-psetor="' + U.escAttr(chave) + '">' +
          '<span class="group__icon">' + ic(s.grupo.icone) + '</span>' +
          '<span class="group__info">' +
            '<span class="group__title" style="display:block;font-size:14px">' +
              U.esc(s.grupo.titulo) + '</span>' +
            '<span class="group__meta" style="display:block">' + s.itens.length + ' ' +
              U.plural(s.itens.length, "pendência", "pendências") + '</span>' +
          '</span>' +
          (correcoes
            ? '<span class="badge badge--pendencia"><span class="dot"></span>' + correcoes + ' ' +
              U.plural(correcoes, "correção", "correções") + '</span>'
            : '') +
          '<span class="group__chev">' + ic("ic-chevron-down") + '</span>' +
        '</button>' +
        (fechado ? '' : s.itens.map(function (p) {
          return '<div class="item"><div class="item__top">' +
            '<div class="item__main">' +
              '<div class="item__name">' + U.esc(p.item.nome) +
                (p.socio ? ' <span class="text-xs text-muted">· ' +
                  U.esc(p.socio.nome || "sócio") + '</span>' : '') + '</div>' +
              '<div class="item__row">' + badge(ROTULO_SITUACAO, p.sit) +
                (p.item.obrigatorio
                  ? '<span class="text-xs text-muted">obrigatório</span>' : '') +
              '</div>' +
            '</div>' +
          '</div></div>';
        }).join("")) +
      '</div>';
    }).join("");
  }

  /* =========================================================
     Aba Mensagens — caixa de entrada de todas as conversas

     Mensagem de cliente parada é cliente esperando resposta.
     Por isso o não lido não é um detalhe na lista: é a coisa
     mais visível da tela.
     ========================================================= */
  var filtroMensagem = "todas";
  var conversaAberta = null;

  function naoLidasDe(c) {
    return c.mensagens.filter(function (m) {
      return m.autor === "cliente" && !m.lidaEm;
    }).length;
  }

  function ultimaDe(c) {
    return c.mensagens.length ? c.mensagens[c.mensagens.length - 1] : null;
  }

  function conversas() {
    var lista = empresas.filter(function (c) {
      return c.mensagens.length && !arquivada(c);
    });
    if (filtroMensagem === "naolidas") {
      lista = lista.filter(function (c) { return naoLidasDe(c) > 0; });
    }
    return lista.sort(function (a, b) {
      var na = naoLidasDe(a), nb = naoLidasDe(b);
      if ((na > 0) !== (nb > 0)) return nb - na;
      return ((ultimaDe(b) || {}).em || 0) - ((ultimaDe(a) || {}).em || 0);
    });
  }

  function desenharMensagens() {
    var caixa = $("#msLista");
    if (!caixa) return;

    if (conversaAberta) { desenharConversa(); return; }

    $("#msTopo").hidden = false;
    $("#msConversa").hidden = true;
    caixa.hidden = false;

    if (carregando) {
      caixa.innerHTML = '<div class="card card--pad"><p class="text-sm text-muted">' +
        'Carregando…</p></div>';
      return;
    }

    var totalNaoLidas = empresas.reduce(function (a, c) { return a + naoLidasDe(c); }, 0);
    var comConversa = empresas.filter(function (c) { return c.mensagens.length; }).length;

    var filtros = $("#msFiltros");
    if (filtros) {
      filtros.innerHTML =
        '<button type="button" class="filtro' + (filtroMensagem === "todas" ? " filtro--on" : "") +
          '" data-fmsg="todas">Todas <b>' + comConversa + '</b></button>' +
        '<button type="button" class="filtro' + (filtroMensagem === "naolidas" ? " filtro--on" : "") +
          '" data-fmsg="naolidas">Não lidas <b>' + totalNaoLidas + '</b></button>';
    }

    var lista = conversas();
    if (!lista.length) {
      caixa.innerHTML = '<div class="card"><div class="empty">' +
        '<div class="empty__icon">' + ic("ic-chat") + '</div>' +
        '<div class="empty__title">' +
          (filtroMensagem === "naolidas" ? "Nenhuma mensagem esperando resposta"
                                         : "Nenhuma conversa ainda") + '</div>' +
        '<div class="empty__desc">' +
          (filtroMensagem === "naolidas"
            ? "Tudo o que os clientes escreveram já foi lido."
            : "Quando um cliente escrever pelo portal, a conversa aparece aqui.") + '</div>' +
      '</div></div>';
      return;
    }

    caixa.innerHTML = '<div class="card">' + lista.map(function (c) {
      var novas = naoLidasDe(c);
      var ultima = ultimaDe(c) || {};
      var dele = ultima.autor === "cliente";
      return '<button type="button" class="cliente' + (novas ? " cliente--novo" : "") +
          '" data-conversa="' + U.escAttr(c.id) + '" ' +
          'style="border-bottom:1px solid var(--stroke)">' +
        '<span class="group__icon">' + ic("ic-chat") + '</span>' +
        '<span class="cliente__info">' +
          '<span class="cliente__nome">' + U.esc(nomeDe(c)) + '</span>' +
          '<span class="cliente__meta">' +
            (dele ? "" : "Você: ") + U.esc(String(ultima.texto || "(anexo)").slice(0, 90)) +
          '</span>' +
          '<span class="cliente__meta">' + U.esc(U.dataHora(ultima.em)) + '</span>' +
        '</span>' +
        (novas
          ? '<span class="badge badge--pendencia"><span class="dot"></span>' + novas + ' ' +
            U.plural(novas, "nova", "novas") + '</span>'
          : '') +
        '<span class="cliente__chev">' + ic("ic-chevron-right") + '</span>' +
      '</button>';
    }).join("") + '</div>';
  }

  function abrirConversa(id) {
    var c = empresas.filter(function (x) { return x.id === id; })[0];
    if (!c) return;
    conversaAberta = c;
    desenharConversa();
    global.scrollTo({ top: 0, behavior: "auto" });
    marcarLidas(c);
  }

  function fecharConversa() {
    conversaAberta = null;
    desenharMensagens();
  }

  function desenharConversa() {
    var c = conversaAberta;
    if (!c) return;
    $("#msTopo").hidden = true;
    $("#msLista").hidden = true;
    var alvo = $("#msConversa");
    alvo.hidden = false;

    alvo.innerHTML =
      '<div class="row" style="margin-bottom:14px">' +
        '<button type="button" class="btn btn--ghost btn--sm" id="msVoltar">' +
          ic("ic-chevron-right", "gira180") + 'Todas as conversas</button>' +
        '<button type="button" class="btn btn--quiet btn--sm" data-cliente="' +
          U.escAttr(c.id) + '">Abrir ficha do cliente</button>' +
      '</div>' +
      '<div class="section__head"><div>' +
        '<div class="eyebrow">Conversa</div>' +
        '<h2 class="section__title" style="font-size:19px;margin-top:4px">' +
          U.esc(nomeDe(c)) + '</h2>' +
        '<p class="section__desc">' +
          (c.empresa.responsavelNome
            ? U.esc(c.empresa.responsavelNome) +
              (c.empresa.responsavelTelefone ? " · " + U.esc(c.empresa.responsavelTelefone) : "")
            : "Sem responsável informado") + '</p>' +
      '</div></div>' +
      '<div class="card card--pad">' +
        (c.mensagens.length
          ? '<div class="conversa conversa--alta">' + c.mensagens.map(function (m) {
              return '<div class="msg msg--' + (m.autor === "equipe" ? "equipe" : "cliente") + '">' +
                '<div class="msg__autor">' +
                  U.esc(m.autor === "equipe" ? (m.autorNome || "Totali") : "Cliente") + '</div>' +
                '<div>' + U.esc(m.texto) + '</div>' +
                '<div class="msg__hora">' + U.esc(U.dataHora(m.em)) + '</div>' +
                ((m.anexos || []).length
                  ? '<div class="arqs">' + m.anexos.map(function (a) {
                      return '<button type="button" class="arq" data-abrir="' + U.escAttr(a.id) +
                        '" data-nome="' + U.escAttr(a.nome) + '" data-tipo="mensagem">' +
                        ic("ic-clipe") + '<span class="arq__n">' + U.esc(a.nome) + '</span></button>';
                    }).join("") + '</div>'
                  : '') +
              '</div>';
            }).join("") + '</div>'
          : '<p class="text-sm text-muted">Nenhuma mensagem ainda.</p>') +
        '<div class="field" style="margin-top:14px">' +
          '<label class="field__label" for="msTexto">Responder</label>' +
          '<textarea class="textarea" id="msTexto" rows="3" maxlength="4000" ' +
            'placeholder="Escreva aqui…"></textarea>' +
        '</div>' +
        '<button type="button" class="btn btn--primary btn--sm" id="msEnviar">' +
          ic("ic-send") + 'Enviar</button>' +
      '</div>';

    var voltar = $("#msVoltar");
    if (voltar) voltar.addEventListener("click", fecharConversa);

    var enviar = $("#msEnviar");
    if (enviar) enviar.addEventListener("click", function () {
      var campo = $("#msTexto");
      if (!campo.value.trim()) { campo.focus(); return; }
      enviar.disabled = true;
      enviarMensagem(campo.value, "", c).then(function () { desenharConversa(); });
    });

    var fim = alvo.querySelector(".conversa");
    if (fim) fim.scrollTop = fim.scrollHeight;
  }

  /* Abrir a conversa marca como lidas as mensagens do cliente.
     A regra do servidor deixa a equipe alterar só o campo de
     leitura — nada mais da mensagem se reescreve. */
  function marcarLidas(c) {
    var pendentes = c.mensagens.filter(function (m) {
      return m.autor === "cliente" && !m.lidaEm;
    });
    if (!pendentes.length) return;

    var agora = Date.now();
    var lote = FB.db.batch();
    pendentes.forEach(function (m) {
      lote.set(FB.db.collection("empresas").doc(c.id).collection("mensagens").doc(m.id),
               { lidaEm: agora }, { merge: true });
    });

    lote.commit().then(function () {
      pendentes.forEach(function (m) { m.lidaEm = agora; });
      atualizarContadores();
      if (conversaAberta === c) desenharConversa();
    }, function () { /* segue mostrando como não lida */ });
  }

  /* =========================================================
     Tela 2 — ficha do cliente
     ========================================================= */
  function abrirCliente(id) {
    var c = empresas.filter(function (x) { return x.id === id; })[0];
    if (!c) return;
    aberto = c;
    /* Só "o que falta" nasce aberto: é o motivo de a equipe abrir
       a ficha. O resto fica recolhido, e o selo do cabeçalho diz
       onde tem trabalho esperando. */
    abertosFicha = { falta: true };
    $("#clLista").hidden = true;
    $("#clTopo").hidden = true;
    $("#clFicha").hidden = false;
    desenharFicha();
    global.scrollTo({ top: 0, behavior: "auto" });
  }

  function fecharCliente() {
    aberto = null;
    $("#clFicha").hidden = true;
    $("#clLista").hidden = false;
    $("#clTopo").hidden = false;
    desenharLista();
  }

  function linhaDado(rotulo, valor) {
    return '<div class="ficha__linha"><span class="ficha__rot">' + U.esc(rotulo) + '</span>' +
      '<span class="ficha__val">' + (valor ? U.esc(valor) : '<i>não informado</i>') + '</span></div>';
  }

  /* =========================================================
     Blocos recolhíveis da ficha

     A ficha de um cliente com 26 documentos vira uma página
     quilométrica. Aqui cada parte fecha, e o que está fechado
     avisa se tem coisa esperando — senão recolher viraria
     esconder trabalho.
     ========================================================= */
  var abertosFicha = {};

  function bloco(o) {
    var aberto = !!abertosFicha[o.id];
    return '<section class="card group" data-open="' + (aberto ? "true" : "false") + '" ' +
        'style="margin-bottom:12px">' +
      '<button type="button" class="group__head group__head--selo" data-bloco="' +
          U.escAttr(o.id) + '">' +
        '<span class="group__icon">' + ic(o.icone || "ic-file") + '</span>' +
        '<span class="group__info">' +
          '<span class="group__title" style="display:block">' + U.esc(o.titulo) + '</span>' +
          '<span class="group__meta" style="display:block">' + U.esc(o.resumo || "") + '</span>' +
        '</span>' +
        (o.selo
          ? '<span class="badge ' + (o.seloCls || "badge--analise") + '">' +
            '<span class="dot"></span>' + U.esc(o.selo) + '</span>'
          : '') +
        '<span class="group__chev">' + ic("ic-chevron-down") + '</span>' +
      '</button>' +
      (aberto ? '<div class="group__body" style="padding:16px">' + o.corpo() + '</div>' : '') +
    '</section>';
  }

  /* O que este grupo tem esperando a equipe. É o que aparece no
     cabeçalho quando o bloco está fechado. */
  function atencaoDoGrupo(c, g) {
    var conferir = 0, correcao = 0;
    var alvos = g.escopo === "socio"
      ? c.dados.socios.map(function (s) { return s.id; })
      : [null];
    alvos.forEach(function (socioId) {
      g.itens.forEach(function (item) {
        var sit = global.Situacao.de(c.dados, g, item, socioId);
        if (sit === "enviado") conferir++;
        if (sit === "pendencia") correcao++;
      });
    });
    return { conferir: conferir, correcao: correcao };
  }

  function desenharFicha() {
    var c = aberto;
    if (!c) return;
    var e = c.empresa;
    var est = estadoDoCliente(c);
    var pendentes = global.Situacao.pendencias(c.dados, DATA.GRUPOS);
    var filaToda = paraConferir(c);

    var html =
      '<div class="row" style="margin-bottom:14px">' +
        '<button type="button" class="btn btn--ghost btn--sm" id="clVoltar">' +
          ic("ic-chevron-right", "gira180") + 'Todos os clientes</button>' +
        '<button type="button" class="btn btn--quiet btn--sm" id="clRecarregar">Atualizar</button>' +
      '</div>' +

      '<section class="section">' +
        '<div class="section__head"><div>' +
          '<div class="eyebrow">Cliente</div>' +
          '<h2 class="section__title" style="font-size:20px;margin-top:4px">' + U.esc(nomeDe(c)) + '</h2>' +
          '<p class="section__desc">' + U.esc(e.razaoSocial || "") +
            (e.cnpj ? ' · ' + U.esc(e.cnpj) : '') + '</p>' +
        '</div>' + badge(ROTULO_ESTADO, est.chave) + '</div>' +

        '<div class="card card--pad">' +
          '<div class="pbar"><div class="pbar__fill" style="width:' + est.resumo.pct + '%"></div></div>' +
          '<div class="ficha__nums">' +
            '<span><b>' + est.resumo.ok + '</b> de ' + est.resumo.total + ' documentos</span>' +
            '<span><b>' + est.resumo.pendentesObrigatorios + '</b> ' +
              U.plural(est.resumo.pendentesObrigatorios,
                       "obrigatório faltando", "obrigatórios faltando") + '</span>' +
            '<span><b>' + est.resumo.aprovados + '</b> ' +
              U.plural(est.resumo.aprovados, "aprovado", "aprovados") + '</span>' +
            (textoParado(c) ? '<span>' + U.esc(textoParado(c)) + '</span>' : '') +
          '</div>' +
          /* A fila de conferência inteira, num botão só. Fica no
             topo porque é o motivo mais comum de abrir a ficha. */
          (filaToda.length
            ? '<div class="lote lote--topo">' +
                '<span class="lote__txt">' + filaToda.length + ' ' +
                  U.plural(filaToda.length, "documento chegou", "documentos chegaram") +
                  ' e ainda não ' + U.plural(filaToda.length, "foi conferido", "foram conferidos") +
                  '.</span>' +
                '<button type="button" class="btn btn--primary btn--sm" id="clAprovarTudo">' +
                  ic("ic-check") + 'Aprovar ' + filaToda.length + '</button>' +
              '</div>'
            : '') +
        '</div>' +
      '</section>' +

      /* ---- O que falta: único bloco que já nasce aberto, porque
             é o motivo de a equipe abrir esta ficha. ---- */
      bloco({
        id: "falta", icone: "ic-alert", titulo: "O que falta",
        resumo: pendentes.length
          ? "Correções pedidas primeiro, depois os obrigatórios"
          : "Tudo o que era obrigatório já chegou",
        selo: pendentes.length ? pendentes.length + " " +
          U.plural(pendentes.length, "item", "itens") : "",
        seloCls: est.resumo.pendencias ? "badge--pendencia" : "badge--pendente",
        corpo: function () {
          if (!pendentes.length) {
            return '<p class="text-sm text-muted">Nada pendente. Tudo o que era obrigatório ' +
              'já chegou.</p>';
          }
          return '<button type="button" class="btn btn--primary btn--sm" id="clCobrar" ' +
              'style="margin-bottom:14px">' + ic("ic-send") + 'Cobrar pelo portal</button>' +
            pendentes.map(function (p) {
              return '<div class="item"><div class="item__top">' +
                '<span class="group__icon">' + ic(p.grupo.icone) + '</span>' +
                '<div class="item__main">' +
                  '<div class="item__name">' + U.esc(p.item.nome) +
                    (p.socio ? ' <span class="text-xs text-muted">· ' +
                      U.esc(p.socio.nome || "sócio") + '</span>' : '') + '</div>' +
                  '<div class="item__row">' + badge(ROTULO_SITUACAO, p.sit) +
                    '<span class="text-xs text-muted">' + U.esc(p.grupo.titulo) + '</span></div>' +
                '</div>' +
              '</div></div>';
            }).join("");
        }
      }) +

      /* ---- Cadastro ---- */
      bloco({
        id: "cadastro", icone: "ic-building", titulo: "Cadastro e contato",
        resumo: (e.responsavelNome || "Sem responsável informado") +
          (e.responsavelTelefone ? " · " + e.responsavelTelefone : ""),
        selo: est.cadastroOk ? "" : "Incompleto", seloCls: "badge--pendente",
        corpo: function () {
          return linhaDado("Razão social", e.razaoSocial) +
            linhaDado("Nome fantasia", e.nomeFantasia) +
            linhaDado("CNPJ", e.cnpj) +
            linhaDado("Regime", e.regime) +
            '<hr class="hr">' +
            linhaDado("Responsável", e.responsavelNome) +
            linhaDado("Função", e.responsavelCargo) +
            linhaDado("E-mail", e.responsavelEmail) +
            linhaDado("Telefone", e.responsavelTelefone) +
            '<hr class="hr">' +
            linhaDado("Aceite da LGPD", e.aceiteLGPD ? U.dataHora(e.aceiteLGPD) : "") +
            '<div class="row" style="margin-top:12px">' +
              (e.responsavelEmail
                ? '<a class="btn btn--ghost btn--sm" href="mailto:' + U.escAttr(e.responsavelEmail) +
                  '">' + ic("ic-mail") + 'Enviar e-mail</a>' : '') +
              (e.responsavelTelefone
                ? '<a class="btn btn--ghost btn--sm" target="_blank" rel="noopener noreferrer" href="' +
                  U.escAttr("https://wa.me/55" + U.soDigitos(e.responsavelTelefone)) + '">' +
                  ic("ic-phone") + 'WhatsApp</a>' : '') +
            '</div>';
        }
      }) +

      /* ---- Sócios ---- */
      bloco({
        id: "socios", icone: "ic-badge", titulo: "Sócios",
        resumo: c.dados.socios.length
          ? c.dados.socios.map(function (s) { return s.nome || "sócio"; }).join(", ")
          : "Nenhum cadastrado",
        selo: c.dados.socios.length ? "" : "Falta cadastrar", seloCls: "badge--pendente",
        corpo: function () {
          return c.dados.socios.length
            ? c.dados.socios.map(function (s) {
                return linhaDado(s.nome || "Sócio", s.cpf || "");
              }).join("")
            : '<p class="text-sm text-muted">Nenhum sócio cadastrado — a lista de documentos ' +
              'de sócio ainda não existe para este cliente.</p>';
        }
      });

    html += acessoHTML(c);
    html += zonaDeRiscoHTML(c);

    /* ---- Documentos, um bloco por departamento ---- */
    html += '<div class="ficha__titulo">Documentos</div>' +
      DATA.GRUPOS.map(function (g) { return grupoHTML(c, g); }).join("");

    html += financeiroHTML(c);
    html += credenciaisHTML(c);
    html += mensagensHTML(c);

    $("#clFicha").innerHTML = html;
    ligarFicha();
  }

  function grupoHTML(c, g) {
    var resumo = global.Situacao.resumoGrupo(c.dados, g);
    var atencao = atencaoDoGrupo(c, g);
    var alvos = g.escopo === "socio"
      ? c.dados.socios.map(function (s) { return s.id; })
      : [null];

    /* O selo é a razão de o bloco poder ficar fechado: recolhido
       sem aviso, esconderia trabalho. */
    var selo = "", seloCls = "badge--analise";
    if (atencao.conferir) {
      selo = atencao.conferir + " para conferir";
    } else if (atencao.correcao) {
      selo = atencao.correcao + " " + U.plural(atencao.correcao, "correção", "correções");
      seloCls = "badge--pendencia";
    } else if (resumo.completo) {
      selo = "Completo";
      seloCls = "badge--aprovado";
    }

    return bloco({
      id: "grupo:" + g.id, icone: g.icone, titulo: g.titulo,
      resumo: alvos.length
        ? resumo.ok + " de " + resumo.total +
          (c.dados.gruposNA[g.id] ? " · marcado como não se aplica" : "")
        : "Depende dos sócios, e nenhum foi cadastrado",
      selo: selo, seloCls: seloCls,
      corpo: function () {
        if (!alvos.length) {
          return '<p class="text-sm text-muted">Este departamento tem um documento por sócio, ' +
            'e o cliente ainda não cadastrou nenhum.</p>';
        }
        var linhas = "";
        alvos.forEach(function (socioId) {
          var socio = socioId
            ? c.dados.socios.filter(function (s) { return s.id === socioId; })[0]
            : null;
          g.itens.forEach(function (item) {
            linhas += itemHTML(c, g, item, socio);
          });
        });

        var fila = paraConferir(c, g);
        var topo = fila.length
          ? '<div class="lote">' +
              '<span class="lote__txt">' + fila.length + ' ' +
                U.plural(fila.length, "documento chegou", "documentos chegaram") +
                ' e ' + U.plural(fila.length, "espera", "esperam") + ' conferência.</span>' +
              '<button type="button" class="btn btn--primary btn--sm" data-aprovar-grupo="' +
                U.escAttr(g.id) + '">Aprovar ' + fila.length + '</button>' +
            '</div>'
          : '';

        return topo + linhas;
      }
    });
  }

  function itemHTML(c, g, item, socio) {
    var chave = global.Situacao.chaveItem(g.id, item.id, socio ? socio.id : null);
    var sit = global.Situacao.de(c.dados, g, item, socio ? socio.id : null);
    var reg = c.dados.itens[chave] || {};
    var arquivos = reg.arquivos || [];
    var rev = reg.revisao || {};

    var corpo = "";
    if (arquivos.length) {
      corpo += '<div class="arqs">' + arquivos.map(function (a) {
        return '<button type="button" class="arq" data-abrir="' + U.escAttr(a.id) + '" ' +
          'data-nome="' + U.escAttr(a.nome) + '">' +
          ic(U.iconePorExtensao(U.extensao(a.nome))) +
          '<span class="arq__n">' + U.esc(a.nome) + '</span>' +
          '<span class="arq__t">' + U.esc(U.bytes(a.tamanho)) + '</span></button>';
      }).join("") + '</div>';
    }
    if (reg.valor) {
      corpo += '<div class="text-sm" style="margin-top:6px">Informado: <strong>' +
        U.esc(reg.valor) + '</strong></div>';
    }
    if (reg.forma) {
      corpo += '<div class="text-sm" style="margin-top:6px">Forma escolhida: <strong>' +
        U.esc(reg.forma) + '</strong></div>';
    }
    if (rev.status === "pendencia" && rev.motivo) {
      corpo += '<div class="text-xs" style="margin-top:6px;color:var(--danger)">Correção pedida: ' +
        U.esc(rev.motivo) + '</div>';
    }
    if (rev.por && rev.em) {
      corpo += '<div class="text-xs text-muted" style="margin-top:4px">' +
        U.esc(rev.por) + ' · ' + U.esc(U.dataHora(rev.em)) + '</div>';
    }

    /* Só faz sentido conferir o que chegou. */
    var podeRevisar = ["enviado", "analise", "aprovado", "pendencia"].indexOf(sit) > -1;
    var acoes = podeRevisar
      ? '<div class="item__actions">' +
          (sit !== "aprovado"
            ? '<button type="button" class="btn btn--primary btn--sm" data-aprovar="' +
              U.escAttr(chave) + '">Aprovar</button>' : '') +
          '<button type="button" class="btn btn--ghost btn--sm" data-pendencia="' +
            U.escAttr(chave) + '">Pedir correção</button>' +
          (sit !== "pendente"
            ? '<button type="button" class="btn btn--quiet btn--sm" data-limpar="' +
              U.escAttr(chave) + '">Tirar marcação</button>' : '') +
        '</div>'
      : '';

    return '<div class="item"><div class="item__top">' +
      '<div class="item__main">' +
        '<div class="item__name">' + U.esc(item.nome) +
          (socio ? ' <span class="text-xs text-muted">· ' + U.esc(socio.nome || "sócio") +
            '</span>' : '') + '</div>' +
        '<div class="item__row">' + badge(ROTULO_SITUACAO, sit) +
          (item.obrigatorio ? '<span class="text-xs text-muted">obrigatório</span>' : '') +
        '</div>' +
        corpo + acoes +
      '</div>' +
    '</div></div>';
  }

  /* ---------- Financeiro ---------- */
  function financeiroHTML(c) {
    var f = c.financeiro;

    return bloco({
      id: "financeiro", icone: "ic-card", titulo: "Bancos e maquininhas",
      resumo: !f ? "O cliente ainda não respondeu esta etapa"
        : f.concluidoEm ? "Concluído em " + U.dataCurta(f.concluidoEm) +
            (f.protocolo ? " · " + f.protocolo : "")
        : "Respondido em parte",
      selo: !f ? "Não respondido" : f.concluidoEm ? "" : "Em aberto",
      seloCls: "badge--pendente",
      corpo: function () {
        if (!f) {
          return '<p class="text-sm text-muted">O cliente ainda não respondeu esta etapa.</p>';
        }
        var forma = (DATA.FORMAS_RELATORIO || []).filter(function (x) {
          return x.id === f.formaRelatorio;
        })[0];
        var lista = function (arr, outro) {
          var todos = (arr || []).slice();
          if (outro) todos.push(outro);
          return todos.length ? todos.join(", ") : "";
        };
        /* Modo Contador: a operadora não tem senha, então o que
           existe é a confirmação do cliente. Sem isto na ficha, a
           equipe procuraria uma credencial que nunca vai existir. */
        var confirmadas = Object.keys(f.modoContador || {})
          .filter(function (k) { return f.modoContador[k] === true; });

        return linhaDado("Tem conta em banco",
                         f.temBanco === "sim" ? "Sim" : f.temBanco === "nao" ? "Não" : "") +
          linhaDado("Bancos", lista(f.bancos, f.bancoOutro)) +
          linhaDado("Tem maquininha",
                    f.temMaquineta === "sim" ? "Sim" : f.temMaquineta === "nao" ? "Não" : "") +
          linhaDado("Maquininhas", lista(f.maquinetas, f.maquinetaOutra)) +
          linhaDado("Envio dos relatórios", forma ? forma.titulo : "") +
          (confirmadas.length
            ? linhaDado("Modo Contador confirmado", confirmadas.join(", "))
            : "") +
          linhaDado("Observações", f.observacoes) +
          (f.termo && f.termo.id
            ? '<div class="row" style="margin-top:12px">' +
              '<button type="button" class="btn btn--ghost btn--sm" data-abrir="' +
                U.escAttr(f.termo.id) + '" data-nome="' +
                U.escAttr(f.termo.nome || "termo.pdf") + '">' +
                ic("ic-download") + 'Abrir termo de compromisso</button></div>'
            : '');
      }
    });
  }

  /* ---------- Acesso ao portal ----------

     O convite serve uma vez só e some depois de usado. Reemitir
     é o conserto para três casos que acontecem de verdade: o
     cliente nunca abriu o primeiro link, a pessoa responsável na
     empresa mudou, ou o vínculo se perdeu no banco. Sem isto,
     vínculo perdido não tinha conserto — a regra do servidor não
     deixa a equipe criar o vínculo, só o próprio cliente, e só
     abrindo um convite. */
  function acessoHTML(c) {
    var acessos = c.acessos || [];
    var convites = c.convites || [];

    return bloco({
      id: "acesso", icone: "ic-lock", titulo: "Acesso ao portal",
      resumo: (acessos.length
        ? acessos.length + " " + U.plural(acessos.length, "acesso criado", "acessos criados")
        : "Ninguém abriu o link de convite ainda") +
        (convites.length ? " · " + convites.length + " " +
          U.plural(convites.length, "link em aberto", "links em aberto") : ""),
      selo: convites.length
        ? convites.length + " " + U.plural(convites.length, "link ativo", "links ativos")
        : (acessos.length ? "" : "Sem acesso"),
      seloCls: convites.length ? "badge--analise" : "badge--pendente",
      corpo: function () {
        return (acessos.length
          ? acessos.map(function (a) {
              return '<div class="ficha__linha">' +
                  '<span class="ficha__rot">Entra com</span>' +
                  '<span class="ficha__val">' +
                    (a.email ? U.esc(a.email) : '<i>e-mail não registrado</i>') +
                    (a.email
                      ? ' <button type="button" class="btn btn--quiet btn--sm" ' +
                        'data-redefinir-senha="' + U.escAttr(a.email) + '" ' +
                        'style="margin-left:10px">Redefinir senha</button>'
                      : '') +
                  '</span>' +
                '</div>' +
                linhaDado("Acesso criado em",
                  a.em && a.em.seconds ? U.dataHora(a.em.seconds * 1000) : "data não registrada");
            }).join("")
          : '<p class="text-sm text-muted">Este cliente ainda não criou o acesso dele. ' +
            'Gere um link e envie — ao abrir, ele define a senha e passa a entrar por ' +
            'e-mail e senha.</p>') +

        /* Link em aberto é porta destrancada: enquanto não for
           usado, quem tiver o endereço entra. Por isso ele fica
           listado, com data e botão de revogar. */
        (convites.length
          ? '<hr class="hr">' +
            '<div class="notice notice--warn" style="margin-bottom:12px">' +
              '<span class="notice__icon">' + ic("ic-alert") + '</span>' +
              '<span><strong>' + convites.length + ' ' +
              U.plural(convites.length, "link ainda não foi usado", "links ainda não foram usados") +
              '.</strong> Enquanto isso, quem tiver o endereço consegue criar o acesso desta ' +
              'empresa. Revogue os que você não enviou ou que já se perderam.</span>' +
            '</div>' +
            convites.map(function (v) {
              return '<div class="ficha__linha">' +
                '<span class="ficha__rot">Link gerado em</span>' +
                '<span class="ficha__val">' +
                  U.esc(v.criadoEm && v.criadoEm.seconds
                    ? U.dataHora(v.criadoEm.seconds * 1000) : "data não registrada") +
                  ' <button type="button" class="btn btn--quiet btn--sm" ' +
                    'data-revogar-convite="' + U.escAttr(v.codigo) + '" ' +
                    'style="margin-left:10px">Revogar</button>' +
                '</span>' +
              '</div>';
            }).join("")
          : '') +

        '<div class="row" style="margin-top:14px">' +
          '<button type="button" class="btn btn--primary btn--sm" data-novo-link="' +
            U.escAttr(c.id) + '">' + ic("ic-send") +
            (acessos.length ? 'Gerar novo link de acesso' : 'Gerar link de acesso') + '</button>' +

        '</div>' +
        (acessos.length
          ? '<p class="field__hint" style="margin-top:10px">Senha esquecida não precisa de link ' +
            'novo: use <strong>Redefinir senha</strong> acima. O cliente escolhe outra no ' +
            'e-mail dele e continua com o mesmo acesso — a Totali nunca vê nem define a senha ' +
            'de ninguém.</p>'
          : '') +
        '<p class="field__hint" style="margin-top:10px;margin-bottom:0">' +
          'O link vale uma vez só e não apaga nada: o que o cliente já enviou continua no ' +
          'lugar. Serve quando ninguém abriu o primeiro link, quando muda a pessoa ' +
          'responsável na empresa, ou para refazer um acesso perdido.</p>';
      }
    });
  }

  /* Redefinição de senha do cliente.

     Quem troca a senha é ele, no e-mail — a equipe nunca vê nem
     escolhe senha de ninguém. Isso não é limitação: é o desenho
     certo. Trocar a senha de outra pessoa exigiria poder de
     administrador do projeto dentro do navegador, e "a Totali
     definiu sua senha" é exatamente o que não queremos poder
     dizer.

     O e-mail vai para o endereço do Authentication. Se o cadastro
     do responsável tiver outro e-mail, é o do login que vale — por
     isso o endereço aparece escrito na confirmação, para a equipe
     conferir antes de enviar. */
  function redefinirSenha(email) {
    var alvo = String(email || "").trim();
    if (!alvo) return;

    UI.confirmar({
      titulo: "Enviar redefinição de senha",
      mensagem: "Vamos enviar para " + alvo + " um e-mail com o link para o cliente criar " +
                "uma senha nova. O acesso atual continua valendo até ele trocar, e nenhum " +
                "documento é afetado.",
      confirmar: "Enviar e-mail"
    }).then(function (ok) {
      if (!ok) return;
      UI.toast("Enviando…", "", 4000);
      FB.recuperarSenha(alvo).then(function () {
        UI.toast("E-mail enviado para " + alvo + ". Peça para o cliente conferir também a " +
                 "caixa de spam.", "ok", 10000);
      }, function (e) {
        UI.toast("Não foi possível enviar: " + FB.explicar(e), "erro", 9000);
      });
    });
  }

  function revogarConvite(codigo) {
    var c = aberto;
    if (!c) return;
    UI.confirmar({
      titulo: "Revogar link",
      mensagem: "O link para de funcionar na hora. Quem já criou o acesso continua entrando " +
                "normalmente — isso só cancela o convite que ainda não foi usado.",
      confirmar: "Revogar", perigo: true
    }).then(function (ok) {
      if (!ok) return;
      FB.db.collection("convites").doc(codigo).delete().then(function () {
        c.convites = (c.convites || []).filter(function (v) { return v.codigo !== codigo; });
        desenharFicha();
        UI.toast("Link revogado.", "ok");
      }, function (e) {
        UI.toast("Não foi possível revogar: " + FB.explicar(e), "erro", 9000);
      });
    });
  }

  function abrirNovoLink(c) {
    if (!global.Convite) return;
    global.Convite.gerar(c.id, nomeDe(c)).then(function (r) {
      var m = UI.modal({
        titulo: "Link de acesso · " + nomeDe(c),
        corpoHTML:
          '<p style="font-size:13.5px;line-height:1.65;color:var(--txt-2);margin-bottom:12px">' +
            'Envie este link ao cliente. Ele vale <strong>uma vez só</strong>: ao abrir, o ' +
            'cliente define a senha e o acesso passa a valer daí em diante.</p>' +
          '<div class="field">' +
            '<label class="field__label" for="nlLink">Link</label>' +
            '<textarea class="textarea" id="nlLink" rows="3" readonly ' +
              'style="font-size:13px;line-height:1.5"></textarea>' +
          '</div>' +
          '<div class="field" style="margin-bottom:0">' +
            '<label class="field__label" for="nlMsg">Mensagem sugerida</label>' +
            '<textarea class="textarea" id="nlMsg" rows="7" readonly ' +
              'style="font-size:13px"></textarea>' +
          '</div>',
        acoes: [
          { rotulo: "Fechar", classe: "btn--ghost" },
          {
            rotulo: "Copiar mensagem", classe: "btn--primary", fecharAntes: false,
            onClick: function () { global.Convite.copiar(r.mensagem, "Mensagem"); }
          }
        ]
      });
      $("#nlLink", m.caixa).value = r.link;
      $("#nlMsg", m.caixa).value = r.mensagem;

      /* Recarrega o cliente: o convite novo ainda não virou
         acesso, mas a equipe deve ver o estado real ao voltar. */
      /* O link novo entra na lista de convites em aberto na
         hora — senão a equipe não veria a porta que acabou de
         destrancar. */
      carregarCliente(c.id).then(function (novo) {
        empresas = empresas.map(function (x) { return x.id === c.id ? novo : x; });
        if (aberto && aberto.id === c.id) { aberto = novo; desenharFicha(); }
      }, function () {});
    }, function (e) {
      var msg = e && e.message === "endereco-invalido"
        ? "Preencha o \"Endereço do portal\" na aba Novo cliente antes de gerar o link."
        : "Não foi possível gerar o link: " + FB.explicar(e);
      UI.toast(msg, "erro", 9000);
    });
  }

  /* ============================================================
     Encerrar um cliente

     ARQUIVAR é o caminho normal: corta o acesso do cliente na
     hora e tira a empresa da lista de trabalho, mas guarda tudo.
     Documento entregue a um escritório de contabilidade tem
     prazo de guarda — apagar por padrão seria irresponsável.

     EXCLUIR apaga mesmo, e a ordem importa mais do que parece:
     o que autoriza o cliente é o documento em `acessos`, não o
     documento da empresa. Apagar a empresa primeiro deixaria o
     cliente COM acesso a dados órfãos, que o console nem mostra.
     Por isso o acesso morre antes de tudo.
     ============================================================ */
  function zonaDeRiscoHTML(c) {
    var arquivada = !!c.empresa.arquivadaEm;
    var souAdmin = equipe && equipe.papel === "admin";

    return bloco({
      id: "risco", icone: "ic-alert", titulo: "Encerrar cliente",
      resumo: arquivada
        ? "Arquivada em " + U.dataCurta(c.empresa.arquivadaEm)
        : "Arquivar corta o acesso e guarda tudo; excluir apaga de vez",
      selo: arquivada ? "Arquivada" : "",
      seloCls: "badge--na",
      corpo: function () {
        return '<div class="notice notice--warn" style="margin-bottom:14px">' +
            '<span class="notice__icon">' + ic("ic-alert") + '</span>' +
            '<span><strong>Arquivar é quase sempre o certo.</strong> O cliente perde o acesso ' +
            'na hora e a empresa sai da sua lista de trabalho, mas os documentos continuam ' +
            'guardados — e documento de cliente tem prazo de guarda. Excluir não tem volta.' +
            '</span></div>' +
          (arquivada
            ? '<p class="text-sm text-muted" style="margin-bottom:14px">Esta empresa está ' +
              'arquivada. O cliente não consegue mais entrar. Para devolver o acesso, ' +
              'desarquive e gere um link novo em "Acesso ao portal".</p>'
            : '') +
          '<div class="row">' +
            (arquivada
              ? '<button type="button" class="btn btn--ghost btn--sm" data-desarquivar="' +
                U.escAttr(c.id) + '">Desarquivar</button>'
              : '<button type="button" class="btn btn--primary btn--sm" data-arquivar="' +
                U.escAttr(c.id) + '">Arquivar cliente</button>') +
            (souAdmin
              ? '<button type="button" class="btn btn--danger btn--sm" data-excluir="' +
                U.escAttr(c.id) + '">Excluir definitivamente</button>'
              : '') +
          '</div>' +
          (souAdmin ? '' :
            '<p class="field__hint" style="margin-top:10px;margin-bottom:0">Excluir ' +
            'definitivamente é só para administrador.</p>');
      }
    });
  }

  /* Cortar o acesso: some o vínculo dos dois lados e queima os
     convites que ainda não foram usados. */
  function cortarAcesso(c) {
    var raiz = FB.db.collection("empresas").doc(c.id);
    return raiz.collection("acessos").get().then(function (snap) {
      var uids = [];
      snap.forEach(function (d) { uids.push(d.id); });

      var passos = uids.map(function (uid) {
        return raiz.collection("acessos").doc(uid).delete().catch(function () {})
          .then(function () {
            return FB.db.collection("clientes").doc(uid).collection("empresas")
                     .doc(c.id).delete().catch(function () {});
          })
          .then(function () {
            /* O vínculo antigo, de uma empresa só, aponta para
               esta? Então ele também some. */
            return FB.db.collection("clientes").doc(uid).get().then(function (d) {
              if (d.exists && (d.data() || {}).empresaId === c.id) {
                return FB.db.collection("clientes").doc(uid).delete().catch(function () {});
              }
            }, function () {});
          });
      });

      passos.push(
        FB.db.collection("convites").where("empresaId", "==", c.id).get()
          .then(function (cs) {
            var fila = Promise.resolve();
            cs.forEach(function (d) {
              fila = fila.then(function () { return d.ref.delete().catch(function () {}); });
            });
            return fila;
          }, function () {})
      );

      return Promise.all(passos);
    });
  }

  function arquivar(c) {
    UI.confirmar({
      titulo: "Arquivar " + nomeDe(c),
      mensagem: "O cliente perde o acesso ao portal agora e a empresa sai da sua lista de " +
                "trabalho. Nenhum documento é apagado — dá para desarquivar depois.",
      confirmar: "Arquivar"
    }).then(function (ok) {
      if (!ok) return;
      UI.toast("Arquivando…", "", 5000);
      cortarAcesso(c).then(function () {
        return FB.db.collection("empresas").doc(c.id)
                 .set({ arquivadaEm: Date.now() }, { merge: true });
      }).then(function () {
        UI.toast(nomeDe(c) + " foi arquivada e o acesso do cliente foi cortado.", "ok", 8000);
        fecharCliente();
        carregarLista();
      }, function (e) {
        UI.toast("Não foi possível arquivar: " + FB.explicar(e), "erro", 9000);
      });
    });
  }

  function desarquivar(c) {
    FB.db.collection("empresas").doc(c.id)
      .set({ arquivadaEm: null }, { merge: true }).then(function () {
        UI.toast("Empresa desarquivada. Gere um link novo em \"Acesso ao portal\" para o " +
                 "cliente voltar a entrar.", "ok", 10000);
        carregarCliente(c.id).then(function (novo) {
          empresas = empresas.map(function (x) { return x.id === c.id ? novo : x; });
          aberto = novo;
          desenharFicha();
        }, function () {});
      }, function (e) {
        UI.toast("Não foi possível desarquivar: " + FB.explicar(e), "erro", 9000);
      });
  }

  /* =========================================================
     Apagar a conta de login junto com a empresa

     Tudo o que é do Firestore e do Storage o painel apaga
     sozinho. A conta de acesso, não: apagar a conta de outra
     pessoa exige poder de administrador do projeto, e esse poder
     não pode estar dentro de uma página web — quem abrisse o
     código-fonte teria a chave do projeto na mão.

     Por isso quem apaga é a função em functions/index.js, do lado
     do servidor. Aqui só a chamamos, mandando o crachá de quem
     está logado; ela confere no Firestore se é admin de verdade.

     A função é chamada por fetch, no protocolo das callable, em
     vez de carregar mais uma biblioteca do Firebase só para isso:
     é uma requisição, e uma requisição não justifica outro
     arquivo no cache de todo mundo.

     ENQUANTO ELA NÃO ESTIVER PUBLICADA nada quebra — a empresa é
     excluída igual, e o painel avisa quais contas ficaram e onde
     apagá-las à mão. É por isso que a promessa nunca rejeita.
     ========================================================= */
  var URL_FUNCOES = "https://southamerica-east1-" +
                    (global.FIREBASE_CONFIG && global.FIREBASE_CONFIG.projectId) +
                    ".cloudfunctions.net/";

  function excluirContasDeAcesso(uids) {
    if (!uids || !uids.length) return Promise.resolve({ disponivel: true, apagadas: [] });

    var u = FB.auth && FB.auth.currentUser;
    if (!u) return Promise.resolve({ disponivel: false, apagadas: [] });

    return u.getIdToken().then(function (token) {
      return fetch(URL_FUNCOES + "excluirAcessoDoCliente", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
        body: JSON.stringify({ data: { uids: uids } })
      });
    }).then(function (resp) {
      if (!resp.ok) return { disponivel: false, apagadas: [] };
      return resp.json().then(function (corpo) {
        var r = (corpo && corpo.result) || {};
        return {
          disponivel: true,
          apagadas: r.apagadas || [],
          recusadas: r.recusadas || []
        };
      });
    }).catch(function () {
      /* Função não publicada, sem rede, CORS: dá tudo no mesmo —
         a conta continua lá e quem resolve é a equipe. */
      return { disponivel: false, apagadas: [] };
    });
  }

  /* O que dizer depois de excluir, sem enfeitar: se a conta ficou,
     a pessoa precisa saber disso e saber onde apagar. */
  function avisarContasRestantes(nome, uids, resultado) {
    if (!uids.length) return;

    if (resultado.disponivel) {
      var sobraram = uids.filter(function (uid) {
        return (resultado.apagadas || []).indexOf(uid) === -1;
      });
      if (!sobraram.length) {
        UI.toast("A conta de acesso do cliente também foi apagada.", "ok", 8000);
        return;
      }
    }

    UI.modal({
      titulo: "A conta de login continua existindo",
      corpoHTML:
        '<p style="font-size:13.5px;line-height:1.65;color:var(--txt-2);margin-bottom:12px">' +
          U.esc(nome) + ' foi excluída, com todos os documentos e vínculos. ' +
          (resultado.disponivel
            ? 'Mas ' + U.plural(uids.length, "esta conta de acesso não pôde ser apagada",
                                             "estas contas de acesso não puderam ser apagadas") + ':'
            : 'A conta de acesso do cliente, porém, fica no Firebase Authentication — ' +
              'apagá-la depende de uma função no servidor que ainda não foi publicada ' +
              '(<code>functions/index.js</code>).') +
        '</p>' +
        '<div class="cred__par" style="flex-direction:column;align-items:stretch;gap:6px">' +
          uids.map(function (uid) {
            return '<code class="cred__v" style="word-break:break-all">' + U.esc(uid) + '</code>';
          }).join("") +
        '</div>' +
        '<p style="font-size:12.5px;line-height:1.6;color:var(--txt-3);margin-top:12px">' +
          'Sem vínculo em <code>acessos</code>, essa conta não abre mais nada — as regras do ' +
          'Firestore negam tudo. Ela só ocupa espaço na lista. Para apagar: console do ' +
          'Firebase → Authentication → Users → procure pelo identificador acima.</p>',
      acoes: [
        { rotulo: "Copiar identificadores", classe: "btn--ghost", fecharAntes: false,
          onClick: function () {
            if (!navigator.clipboard) { UI.toast("Copie à mão pela tela.", "erro"); return; }
            navigator.clipboard.writeText(uids.join("\n")).then(function () {
              UI.toast("Copiado.", "ok");
            }, function () { UI.toast("Não foi possível copiar.", "erro"); });
          } },
        { rotulo: "Entendi", classe: "btn--primary" }
      ]
    });
  }

  /* Apaga tudo, na ordem que não deixa buraco. */
  function excluirDeVez(c) {
    var raiz = FB.db.collection("empresas").doc(c.id);
    var subcolecoes = ["itens", "socios", "mensagens", "credenciais", "financeiro", "eventos"];

    /* Guardar os uids ANTES de cortar o acesso: depois disso o
       vínculo já não existe e não há como descobrir de quem era
       a conta. */
    var contas = (c.acessos || []).map(function (a) { return a.uid; });

    /* 1. O acesso morre primeiro. */
    return cortarAcesso(c).then(function () {
      /* 2. Arquivos do Storage, pelos metadados que temos. */
      var arquivos = [];
      Object.keys(c.dados.itens || {}).forEach(function (k) {
        (c.dados.itens[k].arquivos || []).forEach(function (a) {
          arquivos.push({ id: a.id, pasta: "documentos" });
        });
      });
      (c.mensagens || []).forEach(function (m) {
        (m.anexos || []).forEach(function (a) { arquivos.push({ id: a.id, pasta: "mensagens" }); });
      });
      if (c.financeiro && c.financeiro.termo && c.financeiro.termo.id) {
        arquivos.push({ id: c.financeiro.termo.id, pasta: "documentos" });
      }
      return Promise.all(arquivos.map(function (a) {
        return FB.storage.ref("empresas/" + c.id + "/" + a.pasta + "/" + a.id + "/arquivo")
                 .delete().catch(function () {});
      }));
    }).then(function () {
      /* 3. Subcoleções, uma a uma. */
      var fila = Promise.resolve();
      subcolecoes.forEach(function (nome) {
        fila = fila.then(function () {
          return raiz.collection(nome).get().then(function (snap) {
            var f = Promise.resolve();
            snap.forEach(function (d) {
              f = f.then(function () { return d.ref.delete().catch(function () {}); });
            });
            return f;
          }, function () {});
        });
      });
      return fila;
    }).then(function () {
      /* 4. A empresa. */
      return raiz.delete();
    }).then(function () {
      /* 5. E, por último, a conta de login — a única parte que
         depende do servidor. Falhar aqui não desfaz nada do que
         já foi apagado; só muda o aviso que a equipe recebe. */
      return excluirContasDeAcesso(contas).then(function (r) {
        return { contas: contas, resultado: r };
      });
    });
  }

  function pedirExclusao(c) {
    var nome = nomeDe(c);
    var m = UI.modal({
      titulo: "Excluir " + nome,
      corpoHTML:
        '<div class="notice notice--warn" style="margin-bottom:14px">' +
          '<span class="notice__icon">' + ic("ic-alert") + '</span>' +
          '<span><strong>Isto não tem volta.</strong> Some tudo: documentos enviados, sócios, ' +
          'mensagens, senhas guardadas, o termo e o acesso do cliente. Não há backup dentro do ' +
          'sistema.</span></div>' +
        '<p style="font-size:13.5px;line-height:1.65;color:var(--txt-2);margin-bottom:12px">' +
          'Se a intenção é só encerrar o atendimento, <strong>arquivar</strong> resolve e ' +
          'preserva os documentos.</p>' +
        '<div class="field" style="margin-bottom:0">' +
          '<label class="field__label" for="exNome">Para confirmar, escreva o nome da empresa: ' +
            '<strong>' + U.esc(nome) + '</strong></label>' +
          '<input type="text" class="input" id="exNome" autocomplete="off" data-focus>' +
        '</div>',
      acoes: [
        { rotulo: "Cancelar", classe: "btn--ghost" },
        {
          rotulo: "Excluir definitivamente", classe: "btn--danger", fecharAntes: false,
          onClick: function () {
            var digitado = $("#exNome", m.caixa).value.trim();
            if (digitado.toLowerCase() !== nome.trim().toLowerCase()) {
              UI.toast("O nome não confere. Escreva exatamente: " + nome, "erro", 9000);
              return;
            }
            var b = $('[data-acao="1"]', m.caixa);
            if (b) { b.disabled = true; b.textContent = "Excluindo…"; }
            excluirDeVez(c).then(function (saida) {
              UI.fecharModal();
              UI.toast(nome + " foi excluída.", "ok", 8000);
              fecharCliente();
              carregarLista();
              /* Uma janela por vez: a de confirmação precisa
                 terminar de fechar antes da próxima abrir. */
              setTimeout(function () {
                avisarContasRestantes(nome, saida.contas, saida.resultado);
              }, 350);
            }, function (e) {
              if (b) { b.disabled = false; b.textContent = "Excluir definitivamente"; }
              UI.toast("Não foi possível excluir por completo: " + FB.explicar(e) +
                       " O acesso do cliente já foi cortado.", "erro", 12000);
            });
          }
        }
      ]
    });
  }

  /* ---------- Credenciais ---------- */
  function credenciaisHTML(c) {
    var chaves = Object.keys(c.recibos || {});
    var souAdmin = equipe && equipe.papel === "admin";

    var corpo;
    if (!chaves.length) {
      corpo = '<p class="text-sm text-muted">Nenhum acesso enviado por este cliente.</p>';
    } else if (!souAdmin) {
      corpo = '<p class="text-sm text-muted">' + chaves.length + ' ' +
        U.plural(chaves.length, "acesso enviado", "acessos enviados") +
        '. Só o administrador consegue abrir.</p>';
    } else {
      corpo = chaves.map(function (chave) {
        var r = c.recibos[chave] || {};
        return '<div class="item"><div class="item__main">' +
          '<div class="item__name">' + U.esc(nomeDaChave(chave)) + '</div>' +
          '<div class="item__row"><span class="text-xs text-muted">' +
            U.esc((r.campos || []).join(", ")) +
            (r.em ? ' · enviado em ' + U.esc(U.dataCurta(r.em)) : '') + '</span></div>' +
          '<div class="item__actions">' +
            '<button type="button" class="btn btn--ghost btn--sm" data-abrir-cred="' +
              U.escAttr(chave) + '">Abrir com a chave privada</button>' +
          '</div>' +
          '<div class="cred__saida" data-cred-saida="' + U.escAttr(chave) + '" hidden></div>' +
        '</div></div>';
      }).join("");
    }

    return bloco({
      id: "credenciais", icone: "ic-lock", titulo: "Acessos e senhas",
      resumo: chaves.length
        ? "Abrir exige a chave privada, que fica só na memória desta aba"
        : "Nenhum acesso enviado",
      selo: chaves.length ? chaves.length + " " +
        U.plural(chaves.length, "guardado", "guardados") : "",
      seloCls: "badge--aprovado",
      corpo: function () { return corpo; }
    });
  }

  /* Nome legível de "fiscal/certificado-digital". */
  function nomeDaChave(chave) {
    var partes = String(chave).split("/");
    var grupo = DATA.GRUPOS.filter(function (g) { return g.id === partes[0]; })[0];
    if (!grupo) return chave;
    var itemId = partes[partes.length - 1];
    var item = grupo.itens.filter(function (i) { return i.id === itemId; })[0];
    return (item ? item.nome : itemId) + " · " + grupo.titulo;
  }

  /* ---------- Mensagens ---------- */
  function mensagensHTML(c) {
    var msgs = c.mensagens;
    var naoLidas = msgs.filter(function (m) {
      return m.autor === "cliente" && !m.lidaEm;
    }).length;

    return bloco({
      id: "mensagens", icone: "ic-chat", titulo: "Mensagens",
      resumo: msgs.length ? msgs.length + " " + U.plural(msgs.length, "mensagem", "mensagens") +
        " · o cliente lê no portal" : "Nenhuma mensagem ainda",
      selo: naoLidas ? naoLidas + " " + U.plural(naoLidas, "nova", "novas") : "",
      seloCls: "badge--pendencia",
      corpo: function () {
        return (msgs.length
          ? '<div class="conversa">' + msgs.slice(-30).map(function (m) {
              return '<div class="msg msg--' + (m.autor === "equipe" ? "equipe" : "cliente") + '">' +
                '<div class="msg__autor">' +
                  U.esc(m.autor === "equipe" ? (m.autorNome || "Totali") : "Cliente") + '</div>' +
                '<div>' + U.esc(m.texto) + '</div>' +
                '<div class="msg__hora">' + U.esc(U.dataHora(m.em)) + '</div>' +
                ((m.anexos || []).length
                  ? '<div class="arqs">' + m.anexos.map(function (a) {
                      return '<button type="button" class="arq" data-abrir="' + U.escAttr(a.id) +
                        '" data-nome="' + U.escAttr(a.nome) + '" data-tipo="mensagem">' +
                        ic("ic-clipe") + '<span class="arq__n">' + U.esc(a.nome) + '</span></button>';
                    }).join("") + '</div>'
                  : '') +
              '</div>';
            }).join("") + '</div>'
          : '<p class="text-sm text-muted">Nenhuma mensagem ainda.</p>') +

        '<div class="field" style="margin-top:14px;margin-bottom:8px">' +
          '<label class="field__label" for="clMsg">Escrever para o cliente</label>' +
          '<textarea class="textarea" id="clMsg" rows="4" maxlength="4000" ' +
            'placeholder="Escreva aqui, ou toque em um modelo abaixo…"></textarea>' +
        '</div>' +
        modelosHTML() +
        '<button type="button" class="btn btn--primary btn--sm" id="clEnviarMsg" ' +
          'style="margin-top:12px">' + ic("ic-send") + 'Enviar</button>';
      }
    });
  }

  /* =========================================================
     Ações
     ========================================================= */
  function revisar(chave, status, motivo) {
    var c = aberto;
    if (!c) return Promise.resolve(false);
    var doc = FB.db.collection("empresas").doc(c.id)
                .collection("itens").doc(global.Nuvem.codificar(chave));

    var revisao = {
      status: status,
      motivo: status === "pendencia" ? String(motivo || "").slice(0, 600) : "",
      por: (equipe && (equipe.nome || equipe.email)) || "equipe",
      em: Date.now()
    };

    return doc.set({ revisao: revisao }, { merge: true }).then(function () {
      /* Espelha na memória para a tela responder na hora, sem
         recarregar o cliente inteiro do servidor. */
      if (!c.dados.itens[chave]) c.dados.itens[chave] = {};
      c.dados.itens[chave].revisao = revisao;
      desenharFicha();
      return true;
    }, function (e) {
      UI.toast("Não foi possível gravar: " + FB.explicar(e), "erro", 9000);
      return false;
    });
  }

  /* =========================================================
     Modelos de mensagem

     A equipe escreve o mesmo recado várias vezes por semana —
     "faltam os balanços", "a foto ficou ilegível". Reescrever é
     lento e, pior, sai diferente a cada vez: um cliente recebe
     uma explicação completa e o outro recebe três palavras.

     Os modelos ficam no Firestore, em conteudo/modelosMensagem,
     e são editados aqui mesmo — nada de mexer em arquivo e
     publicar. Se o documento não existir ou vier quebrado, valem
     os padrões abaixo, então o recurso nunca fica sem conteúdo.

     Os campos entre chaves são trocados na hora de usar: quem
     escreve o modelo não precisa saber programar, só escrever
     {cliente} onde vai o nome.
     ========================================================= */
  var MODELOS_PADRAO = [
    {
      id: "faltantes",
      titulo: "Cobrar o que falta",
      texto: "Olá, {cliente}! Passando para lembrar do que ainda falta para concluirmos a " +
             "entrada da {empresa} aqui na Totali:\n\n{faltantes}\n\nÉ só enviar pelo portal, " +
             "na aba Documentos — dá para tirar foto pelo celular. Qualquer dúvida, responda " +
             "por aqui mesmo."
    },
    {
      id: "ilegivel",
      titulo: "Documento ilegível",
      texto: "Olá, {cliente}! Recebemos o documento, mas a imagem ficou difícil de ler.\n\n" +
             "Pode reenviar? Duas coisas ajudam bastante: apoiar o papel numa superfície plana " +
             "e conferir se as quatro bordas aparecem inteiras na foto."
    },
    {
      id: "recebido",
      titulo: "Confirmar recebimento",
      texto: "Olá, {cliente}! Recebemos os documentos e já estamos conferindo. Se faltar " +
             "alguma coisa, aviso por aqui. Obrigado!"
    },
    {
      id: "contador",
      titulo: "Pedir ao contador anterior",
      texto: "Olá, {cliente}! Boa parte do que falta fica com o contador anterior — ele já tem " +
             "esses arquivos prontos.\n\nSe preferir, encaminhe esta lista para ele:\n\n" +
             "{faltantes}\n\nQualquer dificuldade, a gente fala com ele direto. É só avisar."
    },
    {
      id: "concluido",
      titulo: "Migração concluída",
      texto: "Olá, {cliente}! Está tudo certo: recebemos e conferimos toda a documentação da " +
             "{empresa}.\n\nA partir de agora o portal vira o seu ponto de apoio — na aba " +
             "Academy tem vídeos curtos sobre a rotina do mês. Seja bem-vindo!"
    }
  ];

  var modelos = MODELOS_PADRAO.slice();

  function limparModelos(bruto) {
    if (!bruto || !bruto.length) return null;
    var saida = [];
    bruto.slice(0, 30).forEach(function (m, i) {
      var titulo = String((m && m.titulo) || "").trim().slice(0, 60);
      var texto = String((m && m.texto) || "").trim().slice(0, 4000);
      if (!titulo || !texto) return;
      saida.push({ id: String((m && m.id) || ("m" + i)).slice(0, 40), titulo: titulo, texto: texto });
    });
    return saida.length ? saida : null;
  }

  function carregarModelos() {
    return FB.db.collection("conteudo").doc("modelosMensagem").get().then(function (d) {
      var lista = d.exists ? limparModelos((d.data() || {}).lista) : null;
      if (lista) modelos = lista;
    }, function () { /* sem rede, seguem os padrões */ });
  }

  function salvarModelos(lista) {
    return FB.db.collection("conteudo").doc("modelosMensagem")
      .set({ lista: lista, atualizadoEm: Date.now() }, { merge: true })
      .then(function () {
        modelos = lista;
        return true;
      }, function (e) {
        UI.toast("Não foi possível salvar os modelos: " + FB.explicar(e), "erro", 9000);
        return false;
      });
  }

  /* Troca os campos entre chaves pelos dados deste cliente. O que
     não existir vira texto vazio — nunca deixa "{cliente}" cru
     chegar ao cliente. */
  function preencherModelo(texto, c) {
    var e = c.empresa || {};
    var faltantes = global.Situacao.pendencias(c.dados, DATA.GRUPOS).map(function (p) {
      return "• " + p.item.nome +
        (p.socio ? " (" + (p.socio.nome || "sócio") + ")" : "") +
        (p.sit === "pendencia" ? " — precisa corrigir e reenviar" : "");
    }).join("\n");

    var valores = {
      cliente: U.primeiroNome ? (U.primeiroNome(e.responsavelNome) || "tudo bem") : (e.responsavelNome || ""),
      empresa: nomeDe(c),
      faltantes: faltantes || "(nada pendente)",
      eu: (equipe && (equipe.nome || equipe.email)) || "Totali"
    };

    return String(texto || "").replace(/\{(cliente|empresa|faltantes|eu)\}/g, function (todo, chave) {
      return valores[chave] == null ? "" : valores[chave];
    });
  }

  function modelosHTML() {
    if (!modelos.length) return "";
    return '<div class="modelos">' +
      '<span class="modelos__rot">Modelos prontos</span>' +
      '<span class="modelos__chips">' +
        modelos.map(function (m, i) {
          return '<button type="button" class="chip-modelo" data-modelo="' + i + '">' +
            U.esc(m.titulo) + '</button>';
        }).join("") +
        '<button type="button" class="chip-modelo chip-modelo--edit" id="clModelos">' +
          'Editar modelos</button>' +
      '</span>' +
    '</div>';
  }

  function abrirGerenciadorModelos() {
    var rascunho = modelos.map(function (m) { return { id: m.id, titulo: m.titulo, texto: m.texto }; });

    var linhas = function () {
      return rascunho.map(function (m, i) {
        return '<div class="modelo-edit" data-i="' + i + '">' +
          '<div class="row" style="gap:8px;margin-bottom:6px">' +
            '<input type="text" class="input" data-mtitulo="' + i + '" maxlength="60" ' +
              'placeholder="Nome do modelo" value="' + U.escAttr(m.titulo) + '" style="flex:1">' +
            '<button type="button" class="btn btn--quiet btn--sm" data-mremover="' + i + '">' +
              'Remover</button>' +
          '</div>' +
          '<textarea class="textarea" data-mtexto="' + i + '" rows="4" maxlength="4000">' +
            U.esc(m.texto) + '</textarea>' +
        '</div>';
      }).join("");
    };

    var m = UI.modal({
      titulo: "Modelos de mensagem",
      corpoHTML:
        '<p style="font-size:13px;line-height:1.6;color:var(--txt-2);margin-bottom:12px">' +
          'Escreva <code>{cliente}</code> onde deve entrar o nome do responsável, ' +
          '<code>{empresa}</code> para o nome da empresa e <code>{faltantes}</code> para a ' +
          'lista do que está pendente. O portal troca na hora de usar.</p>' +
        '<div id="mdLista">' + linhas() + '</div>' +
        '<button type="button" class="btn btn--ghost btn--sm" id="mdAdicionar" ' +
          'style="margin-top:6px">Adicionar modelo</button>',
      acoes: [
        { rotulo: "Cancelar", classe: "btn--ghost" },
        {
          rotulo: "Salvar modelos", classe: "btn--primary", fecharAntes: false,
          onClick: function () {
            recolher();
            var limpos = limparModelos(rascunho);
            if (!limpos) {
              UI.toast("Cada modelo precisa de nome e texto.", "erro");
              return;
            }
            var b = $('[data-acao="1"]', m.caixa);
            if (b) { b.disabled = true; b.textContent = "Salvando…"; }
            salvarModelos(limpos).then(function (ok) {
              if (!ok) { if (b) { b.disabled = false; b.textContent = "Salvar modelos"; } return; }
              UI.fecharModal();
              UI.toast("Modelos salvos. Valem para toda a equipe.", "ok");
              desenharFicha();
            });
          }
        }
      ]
    });

    /* Lê o que está na tela de volta para o rascunho antes de
       redesenhar ou salvar — senão o que a pessoa digitou some
       ao adicionar ou remover uma linha. */
    function recolher() {
      rascunho.forEach(function (mm, i) {
        var t = $('[data-mtitulo="' + i + '"]', m.caixa);
        var x = $('[data-mtexto="' + i + '"]', m.caixa);
        if (t) mm.titulo = t.value;
        if (x) mm.texto = x.value;
      });
    }

    function redesenhar() {
      $("#mdLista", m.caixa).innerHTML = linhas();
    }

    m.caixa.addEventListener("click", function (ev) {
      var rem = ev.target.closest("[data-mremover]");
      if (rem) {
        recolher();
        rascunho.splice(Number(rem.getAttribute("data-mremover")), 1);
        redesenhar();
        return;
      }
      if (ev.target.closest("#mdAdicionar")) {
        recolher();
        rascunho.push({ id: "m" + Date.now(), titulo: "", texto: "" });
        redesenhar();
        var campos = $$("[data-mtitulo]", m.caixa);
        if (campos.length) campos[campos.length - 1].focus();
      }
    });
  }

  /* Aprovar em lote.

     Uma empresa tem 26 documentos. Conferir é um a um mesmo — não
     dá para automatizar o olho de quem confere —, mas REGISTRAR a
     aprovação um a um são 26 cliques e 26 idas ao servidor para um
     trabalho que já foi feito. O batch grava tudo de uma vez: ou
     entra inteiro, ou não entra nada, e a ficha não fica meio
     aprovada se a conexão cair no meio.

     Só entra aqui o que está em "enviado" — documento que a equipe
     ainda não olhou. Aprovado continua aprovado e correção pedida
     não é desfeita por um botão de atalho. */
  function aprovarLote(chaves) {
    var c = aberto;
    if (!c || !chaves.length) return Promise.resolve(0);

    var revisao = {
      status: "aprovado",
      motivo: "",
      por: (equipe && (equipe.nome || equipe.email)) || "equipe",
      em: Date.now()
    };

    var lote = FB.db.batch();
    chaves.forEach(function (chave) {
      lote.set(FB.db.collection("empresas").doc(c.id)
                 .collection("itens").doc(global.Nuvem.codificar(chave)),
               { revisao: revisao }, { merge: true });
    });

    return lote.commit().then(function () {
      chaves.forEach(function (chave) {
        if (!c.dados.itens[chave]) c.dados.itens[chave] = {};
        c.dados.itens[chave].revisao = revisao;
      });
      desenharFicha();
      atualizarContadores();
      return chaves.length;
    }, function (e) {
      UI.toast("Não foi possível aprovar: " + FB.explicar(e), "erro", 9000);
      return 0;
    });
  }

  /* Tudo o que chegou e ainda não foi conferido — na ficha
     inteira ou dentro de um departamento só. */
  function paraConferir(c, grupo) {
    return naoConferidos(c)
      .filter(function (x) { return !grupo || x.grupo.id === grupo.id; })
      .map(function (x) { return x.chave; });
  }

  function pedirAprovacaoEmLote(chaves, ondeTexto) {
    if (!chaves.length) return;
    UI.confirmar({
      titulo: "Aprovar " + chaves.length + " " +
              U.plural(chaves.length, "documento", "documentos"),
      mensagem: chaves.length === 1
        ? "Você está aprovando o documento que chegou " + ondeTexto + ". Confirme que já " +
          "conferiu — o cliente passa a vê-lo como aprovado."
        : "Você está aprovando os " + chaves.length + " documentos que chegaram " + ondeTexto +
          ". Confirme que já conferiu cada um — o cliente passa a ver todos como aprovados.",
      confirmar: "Aprovar " + chaves.length
    }).then(function (ok) {
      if (!ok) return;
      UI.toast("Aprovando…", "", 4000);
      aprovarLote(chaves).then(function (n) {
        if (n) {
          UI.toast(n + " " + U.plural(n, "documento aprovado", "documentos aprovados") + ".", "ok");
        }
      });
    });
  }

  function enviarMensagem(texto, chave, cliente) {
    var c = cliente || aberto;
    var t = String(texto || "").trim().slice(0, 4000);
    if (!c || !t) return Promise.resolve(false);

    var id = U.uid();
    var msg = {
      autor: "equipe",
      autorNome: (equipe && (equipe.nome || equipe.email)) || "Totali",
      texto: t,
      chave: String(chave || ""),
      anexos: [],
      em: Date.now(),
      lidaEm: 0
    };

    return FB.db.collection("empresas").doc(c.id)
             .collection("mensagens").doc(id).set(msg).then(function () {
      msg.id = id;
      c.mensagens.push(msg);
      if (aberto === c) desenharFicha();
      atualizarContadores();
      UI.toast("Mensagem enviada.", "ok");
      return true;
    }, function (e) {
      UI.toast("Não foi possível enviar: " + FB.explicar(e), "erro", 9000);
      return false;
    });
  }

  /* Cobrança: uma mensagem só, listando o que falta. Sem Cloud
     Functions não há disparo automático — quem decide a hora é a
     equipe, e fica registrado na conversa do cliente. */
  function montarCobranca(c) {
    var pendentes = global.Situacao.pendencias(c.dados, DATA.GRUPOS);
    if (!pendentes.length) return "";

    var linhas = pendentes.map(function (p) {
      return "• " + p.item.nome +
        (p.socio ? " (" + (p.socio.nome || "sócio") + ")" : "") +
        (p.sit === "pendencia" ? " — precisa corrigir e reenviar" : "");
    }).join("\n");

    return "Olá! Passando para lembrar do que ainda falta para concluirmos a entrada da sua " +
      "empresa aqui na Totali:\n\n" + linhas +
      "\n\nÉ só enviar pelo portal, na aba Documentos — dá para tirar foto pelo celular. " +
      "Qualquer dúvida, responda por aqui mesmo.";
  }

  function abrirArquivo(id, nome, tipo) {
    var c = aberto;
    if (!c) return;
    var pasta = tipo === "mensagem" ? "mensagens" : "documentos";
    var caminho = "empresas/" + c.id + "/" + pasta + "/" + id + "/arquivo";

    FB.storage.ref(caminho).getDownloadURL().then(function (url) {
      var a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }, function () {
      /* Documento e anexo de mensagem moram em pastas diferentes;
         metadado antigo pode apontar para a outra. */
      var outra = "empresas/" + c.id + "/" +
        (pasta === "documentos" ? "mensagens" : "documentos") + "/" + id + "/arquivo";
      FB.storage.ref(outra).getDownloadURL().then(function (url) {
        global.open(url, "_blank", "noopener");
      }, function () {
        UI.toast("Arquivo não encontrado no servidor.", "erro");
      });
    });
  }

  /* ---------- Abrir credencial ---------- */
  function pedirChavePrivada() {
    return new Promise(function (resolve) {
      if (chavePrivada) { resolve(chavePrivada); return; }

      var m = UI.modal({
        titulo: "Chave privada",
        corpoHTML:
          '<p style="font-size:13.5px;line-height:1.65;color:var(--txt-2);margin-bottom:12px">' +
            'Selecione o arquivo da chave privada que você baixou ao criar o par. Ele fica só na ' +
            'memória desta aba — não é gravado, e some quando você fechar a página.</p>' +
          '<div class="field"><input type="file" class="input" id="ckArquivo" accept=".json,application/json"></div>' +
          '<div class="field" style="margin-bottom:0">' +
            '<label class="field__label" for="ckTexto">Ou cole o conteúdo dele</label>' +
            '<textarea class="textarea" id="ckTexto" rows="4" style="font-size:12px"></textarea>' +
          '</div>',
        acoes: [
          { rotulo: "Cancelar", classe: "btn--ghost", onClick: function () { resolve(null); } },
          {
            rotulo: "Carregar", classe: "btn--primary", fecharAntes: false,
            onClick: function () {
              var texto = $("#ckTexto", m.caixa).value.trim();
              var arquivo = $("#ckArquivo", m.caixa).files[0];

              var usar = function (bruto) {
                var jwk = null;
                try { jwk = JSON.parse(bruto); } catch (e) { jwk = null; }
                if (!jwk || jwk.kty !== "RSA" || !jwk.d) {
                  UI.toast("Isso não parece uma chave privada válida.", "erro");
                  return;
                }
                chavePrivada = jwk;
                UI.fecharModal();
                resolve(jwk);
              };

              if (arquivo) {
                var leitor = new FileReader();
                leitor.onload = function () { usar(String(leitor.result || "")); };
                leitor.onerror = function () { UI.toast("Não foi possível ler o arquivo.", "erro"); };
                leitor.readAsText(arquivo);
                return;
              }
              if (!texto) { UI.toast("Escolha o arquivo ou cole o conteúdo.", "erro"); return; }
              usar(texto);
            }
          }
        ]
      });
    });
  }

  function abrirCredencial(chave) {
    var c = aberto;
    if (!c) return;
    var saida = $('[data-cred-saida="' + chave.replace(/"/g, '\\"') + '"]');

    pedirChavePrivada().then(function (jwk) {
      if (!jwk) return;
      return FB.db.collection("empresas").doc(c.id)
               .collection("credenciais").doc(global.Nuvem.codificar(chave)).get()
        .then(function (doc) {
          if (!doc.exists) throw new Error("sem-envelope");
          return global.Cripto.decifrar((doc.data() || {}).pacote, jwk);
        })
        .then(function (valores) {
          if (!saida) return;
          saida.hidden = false;
          saida.innerHTML = Object.keys(valores).map(function (k) {
            return '<div class="cred__par">' +
              '<span class="cred__rot">' + U.esc(k) + '</span>' +
              '<code class="cred__v">' + U.esc(String(valores[k])) + '</code>' +
              '<button type="button" class="btn btn--quiet btn--sm" data-copiar="' +
                U.escAttr(String(valores[k])) + '">Copiar</button>' +
            '</div>';
          }).join("") +
          '<p class="text-xs text-muted" style="margin-top:8px">Some da tela ao atualizar. ' +
            'Não copie para bloco de notas nem para planilha.</p>';
        })
        .catch(function (e) {
          var msg = e && e.message === "sem-envelope"
            ? "O envelope não está mais no servidor."
            : "Não foi possível abrir. Confira se é a chave certa — uma chave nova não abre o " +
              "que foi enviado com a anterior.";
          UI.toast(msg, "erro", 9000);
        });
    });
  }

  /* =========================================================
     Exportar
     ========================================================= */
  function exportarCSV() {
    var linhas = [["Empresa", "CNPJ", "Situação", "Entregue (%)", "Obrigatórios faltando",
                   "Correções pedidas", "Para conferir", "Responsável", "E-mail", "Telefone"]];

    clientesFiltrados().forEach(function (c) {
      var est = estadoDoCliente(c);
      linhas.push([
        nomeDe(c), c.empresa.cnpj || "", ROTULO_ESTADO[est.chave].texto,
        String(est.resumo.pct), String(est.resumo.pendentesObrigatorios),
        String(est.resumo.pendencias), String(naoConferidos(c).length),
        c.empresa.responsavelNome || "", c.empresa.responsavelEmail || "",
        c.empresa.responsavelTelefone || ""
      ]);
    });

    /* Ponto e vírgula e BOM: é o que faz o Excel em português
       abrir o arquivo já com as colunas separadas e os acentos
       certos, sem ninguém precisar importar à mão. */
    var csv = linhas.map(function (l) {
      return l.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(";");
    }).join("\r\n");

    var blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "clientes-onboarding.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  /* =========================================================
     Eventos
     ========================================================= */
  function ligarFicha() {
    var voltar = $("#clVoltar");
    if (voltar) voltar.addEventListener("click", fecharCliente);

    var recarregar = $("#clRecarregar");
    if (recarregar) recarregar.addEventListener("click", function () {
      var id = aberto && aberto.id;
      if (!id) return;
      recarregar.disabled = true;
      recarregar.textContent = "Atualizando…";
      carregarCliente(id).then(function (c) {
        empresas = empresas.map(function (x) { return x.id === id ? c : x; });
        aberto = c;
        desenharFicha();
      }, function () {
        recarregar.disabled = false;
        recarregar.textContent = "Atualizar";
        UI.toast("Não foi possível atualizar.", "erro");
      });
    });

    var enviar = $("#clEnviarMsg");
    if (enviar) enviar.addEventListener("click", function () {
      var campo = $("#clMsg");
      if (!campo.value.trim()) { campo.focus(); return; }
      enviar.disabled = true;
      enviarMensagem(campo.value).then(function () { /* redesenha */ });
    });

    var cobrar = $("#clCobrar");
    if (cobrar) cobrar.addEventListener("click", function () { abrirCobranca(aberto); });

    var aprovarTudo = $("#clAprovarTudo");
    if (aprovarTudo) aprovarTudo.addEventListener("click", function () {
      if (!aberto) return;
      pedirAprovacaoEmLote(paraConferir(aberto), "nesta empresa");
    });

    var gerenciar = $("#clModelos");
    if (gerenciar) gerenciar.addEventListener("click", abrirGerenciadorModelos);
  }

  /* Número no formato que o WhatsApp entende: só dígitos, com o
     55 na frente. O campo do cliente vem mascarado. */
  function numeroWhatsApp(telefone) {
    var d = U.soDigitos(telefone);
    if (d.length < 10) return "";
    if (d.length <= 11) d = "55" + d;
    return d;
  }

  function abrirNoWhatsApp(telefone, texto) {
    var num = numeroWhatsApp(telefone);
    if (!num) return false;
    var a = document.createElement("a");
    a.href = "https://wa.me/" + num + "?text=" + encodeURIComponent(texto);
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  }

  /* A cobrança serve tanto da ficha quanto da lista de
     pendências, então mora fora das duas.

     Dois caminhos, porque servem a momentos diferentes: pelo
     portal fica registrado na conversa e o cliente encontra
     junto do checklist; pelo WhatsApp chega onde ele já olha.
     O texto é o mesmo, e a equipe pode ajustar antes. */
  function abrirCobranca(c) {
    var texto = montarCobranca(c);
    if (!texto) { UI.toast("Este cliente não tem pendência para cobrar.", "ok"); return; }

    var tel = c.empresa.responsavelTelefone || "";
    var temZap = !!numeroWhatsApp(tel);

    var acoes = [{ rotulo: "Cancelar", classe: "btn--ghost" }];
    if (temZap) {
      acoes.push({
        rotulo: "Abrir no WhatsApp", classe: "btn--gold", fecharAntes: false,
        onClick: function () {
          var t = $("#cbTexto", m.caixa).value;
          if (!abrirNoWhatsApp(tel, t)) {
            UI.toast("Telefone do responsável inválido.", "erro");
            return;
          }
          UI.fecharModal();
          UI.toast("WhatsApp aberto. A mensagem não fica registrada no portal — se quiser " +
                   "o registro, use também \"Enviar pelo portal\".", "", 11000);
        }
      });
    }
    acoes.push({
      rotulo: "Enviar pelo portal", classe: "btn--primary",
      onClick: function () { enviarMensagem($("#cbTexto", m.caixa).value, "", c); }
    });

    var m = UI.modal({
      titulo: "Cobrar " + nomeDe(c),
      corpoHTML:
        '<p style="font-size:13.5px;line-height:1.65;color:var(--txt-2);margin-bottom:10px">' +
          'Ajuste o texto se quiser e escolha por onde enviar.</p>' +
        '<div class="cobranca__vias">' +
          '<div class="cobranca__via">' +
            '<span class="cobranca__t">' + ic("ic-chat") + 'Pelo portal</span>' +
            '<span class="cobranca__d">Fica registrado na conversa, junto do checklist.</span>' +
          '</div>' +
          '<div class="cobranca__via">' +
            '<span class="cobranca__t">' + ic("ic-phone") + 'Pelo WhatsApp</span>' +
            '<span class="cobranca__d">' +
              (temZap
                ? 'Vai para ' + U.esc(tel) + '. Abre o WhatsApp com o texto pronto — ' +
                  'você confere e envia.'
                : 'Indisponível: o cliente ainda não informou o telefone do responsável.') +
            '</span>' +
          '</div>' +
        '</div>' +
        '<div class="field" style="margin-bottom:0;margin-top:14px">' +
          '<label class="field__label" for="cbTexto">Mensagem</label>' +
          '<textarea class="textarea" id="cbTexto" rows="10" style="font-size:13px"></textarea>' +
        '</div>',
      acoes: acoes
    });
    $("#cbTexto", m.caixa).value = texto;
  }

  function ligarGlobais() {
    document.addEventListener("click", function (ev) {
      var alvo = ev.target.closest ? ev.target : null;
      if (!alvo) return;

      /* Abrir a ficha funciona de qualquer aba: leva junto para a
         aba de clientes, senão a ficha abriria fora de vista. */
      var cliente = alvo.closest("[data-cliente]");
      if (cliente) {
        var idCliente = cliente.getAttribute("data-cliente");
        if (global.Painel && global.Painel.aba !== "clientes") global.Painel.abrir("clientes");
        abrirCliente(idCliente);
        return;
      }

      var conversa = alvo.closest("[data-conversa]");
      if (conversa) { abrirConversa(conversa.getAttribute("data-conversa")); return; }

      var fp = alvo.closest("[data-fpend]");
      if (fp) { filtroPendencia = fp.getAttribute("data-fpend"); desenharPendencias(); return; }

      /* Abrir e fechar empresa e setor. Depois de redesenhar, a
         página volta para onde o cartão estava, senão a lista
         pula debaixo do dedo. */
      var pemp = alvo.closest("[data-pemp]");
      if (pemp) {
        var idEmp = pemp.getAttribute("data-pemp");
        var antesEmp = pemp.getBoundingClientRect().top;
        abertosPend["emp:" + idEmp] = !abertosPend["emp:" + idEmp];
        desenharPendencias();
        var novoEmp = document.querySelector('[data-pemp="' + idEmp + '"]');
        if (novoEmp) global.scrollBy(0, novoEmp.getBoundingClientRect().top - antesEmp);
        return;
      }

      var pset = alvo.closest("[data-psetor]");
      if (pset) {
        var chaveSet = pset.getAttribute("data-psetor");
        var antesSet = pset.getBoundingClientRect().top;
        if (fechadosSetor[chaveSet]) delete fechadosSetor[chaveSet];
        else fechadosSetor[chaveSet] = true;
        desenharPendencias();
        var novoSet = document.querySelector('[data-psetor="' + chaveSet + '"]');
        if (novoSet) global.scrollBy(0, novoSet.getBoundingClientRect().top - antesSet);
        return;
      }

      var fm = alvo.closest("[data-fmsg]");
      if (fm) { filtroMensagem = fm.getAttribute("data-fmsg"); desenharMensagens(); return; }

      var acharEmpresa = function (attr, no) {
        return empresas.filter(function (x) { return x.id === no.getAttribute(attr); })[0];
      };

      var arq = alvo.closest("[data-arquivar]");
      if (arq) { var ea = acharEmpresa("data-arquivar", arq); if (ea) arquivar(ea); return; }

      var des = alvo.closest("[data-desarquivar]");
      if (des) { var ed = acharEmpresa("data-desarquivar", des); if (ed) desarquivar(ed); return; }

      var exc = alvo.closest("[data-excluir]");
      if (exc) { var ex = acharEmpresa("data-excluir", exc); if (ex) pedirExclusao(ex); return; }

      var rv = alvo.closest("[data-revogar-convite]");
      if (rv) { revogarConvite(rv.getAttribute("data-revogar-convite")); return; }

      var rs = alvo.closest("[data-redefinir-senha]");
      if (rs) { redefinirSenha(rs.getAttribute("data-redefinir-senha")); return; }

      var nl = alvo.closest("[data-novo-link]");
      if (nl) {
        var alvoLink = empresas.filter(function (x) {
          return x.id === nl.getAttribute("data-novo-link");
        })[0];
        if (alvoLink) abrirNovoLink(alvoLink);
        return;
      }

      var cob = alvo.closest("[data-cobrar]");
      if (cob) {
        var alvoCobranca = empresas.filter(function (x) {
          return x.id === cob.getAttribute("data-cobrar");
        })[0];
        if (alvoCobranca) abrirCobranca(alvoCobranca);
        return;
      }

      /* Abrir e fechar bloco da ficha. Redesenhar a ficha inteira
         embaralharia a rolagem, então depois do desenho a página
         é reposicionada para o bloco continuar sob o dedo. */
      var bl = alvo.closest("[data-bloco]");
      if (bl) {
        var idBloco = bl.getAttribute("data-bloco");
        var antes = bl.getBoundingClientRect().top;
        abertosFicha[idBloco] = !abertosFicha[idBloco];
        desenharFicha();
        var novo = document.querySelector('[data-bloco="' + idBloco + '"]');
        if (novo) global.scrollBy(0, novo.getBoundingClientRect().top - antes);
        return;
      }

      var f = alvo.closest("[data-filtro]");
      if (f) {
        filtro.situacao = f.getAttribute("data-filtro");
        desenharLista();
        return;
      }

      var arq = alvo.closest("[data-abrir]");
      if (arq) {
        abrirArquivo(arq.getAttribute("data-abrir"), arq.getAttribute("data-nome"),
                     arq.getAttribute("data-tipo"));
        return;
      }

      /* Modelo escolhido: o texto entra no campo, e a pessoa
         ainda revisa antes de enviar. Nada sai sozinho. */
      var mod = alvo.closest("[data-modelo]");
      if (mod && aberto) {
        var escolhido = modelos[Number(mod.getAttribute("data-modelo"))];
        var campoMsg = $("#clMsg");
        if (escolhido && campoMsg) {
          campoMsg.value = preencherModelo(escolhido.texto, aberto);
          campoMsg.focus();
          campoMsg.setSelectionRange(campoMsg.value.length, campoMsg.value.length);
        }
        return;
      }

      var aprovarGrupo = alvo.closest("[data-aprovar-grupo]");
      if (aprovarGrupo && aberto) {
        var gid = aprovarGrupo.getAttribute("data-aprovar-grupo");
        var grupoAlvo = DATA.GRUPOS.filter(function (x) { return x.id === gid; })[0];
        if (grupoAlvo) {
          pedirAprovacaoEmLote(paraConferir(aberto, grupoAlvo),
                               "em " + grupoAlvo.titulo);
        }
        return;
      }

      var aprovar = alvo.closest("[data-aprovar]");
      if (aprovar) { revisar(aprovar.getAttribute("data-aprovar"), "aprovado"); return; }

      var limpar = alvo.closest("[data-limpar]");
      if (limpar) { revisar(limpar.getAttribute("data-limpar"), ""); return; }

      var pend = alvo.closest("[data-pendencia]");
      if (pend) {
        var chave = pend.getAttribute("data-pendencia");
        var m = UI.modal({
          titulo: "Pedir correção",
          corpoHTML:
            '<p style="font-size:13.5px;line-height:1.65;color:var(--txt-2);margin-bottom:10px">' +
              'Diga ao cliente o que está errado. O texto aparece no documento, no portal dele.</p>' +
            '<div class="field" style="margin-bottom:0">' +
              '<textarea class="textarea" id="pdMotivo" rows="3" maxlength="600" data-focus ' +
                'placeholder="Ex.: a foto cortou o rodapé do documento."></textarea>' +
            '</div>',
          acoes: [
            { rotulo: "Cancelar", classe: "btn--ghost" },
            {
              rotulo: "Pedir correção", classe: "btn--primary",
              onClick: function () {
                var motivo = $("#pdMotivo", m.caixa).value.trim();
                revisar(chave, "pendencia", motivo).then(function (ok) {
                  if (ok) UI.toast("Correção pedida. O cliente vê no portal.", "ok");
                });
              }
            }
          ]
        });
        return;
      }

      var cred = alvo.closest("[data-abrir-cred]");
      if (cred) { abrirCredencial(cred.getAttribute("data-abrir-cred")); return; }

      var copiar = alvo.closest("[data-copiar]");
      if (copiar && navigator.clipboard) {
        navigator.clipboard.writeText(copiar.getAttribute("data-copiar")).then(function () {
          UI.toast("Copiado. Cole onde precisa e não deixe guardado.", "ok");
        }, function () { UI.toast("Não foi possível copiar.", "erro"); });
        return;
      }
    });

    var busca = $("#clBusca");
    if (busca) busca.addEventListener("input", U.debounce(function () {
      filtro.texto = busca.value;
      desenharLista();
    }, 200));

    ["#clAtualizar", "#pdAtualizar", "#msAtualizar"].forEach(function (sel) {
      var b = $(sel);
      if (b) b.addEventListener("click", function () { carregarLista(); });
    });

    var csv = $("#clCSV");
    if (csv) csv.addEventListener("click", exportarCSV);

    /* Ao voltar para uma aba, redesenha: os números podem ter
       mudado enquanto a pessoa estava em outra. */
    if (global.Painel) {
      global.Painel.aoTrocar(function (aba) {
        if (aba === "pendencias") desenharPendencias();
        if (aba === "mensagens") desenharMensagens();
        if (aba === "clientes" && !aberto) desenharLista();
      });
    }
  }

  /* =========================================================
     Início
     ========================================================= */
  function iniciar() {
    FB = global.FB;

    /* Sem servidor não há cliente para mostrar. Antes esta parte
       simplesmente sumia, e quem abrisse a página achava que o
       painel não tinha mudado. Agora ela diz o motivo — o mais
       comum é abrir o arquivo direto do computador, com endereço
       começando em file://, em vez de pelo endereço do portal. */
    if (!FB || !FB.ligado) {
      var caixa = $("#clLista");
      if (caixa) {
        caixa.innerHTML = '<div class="notice notice--warn">' +
          '<span class="notice__icon">' + ic("ic-alert") + '</span>' +
          '<span><strong>A lista de clientes precisa de conexão com o servidor.</strong> ' +
          (location.protocol === "file:"
            ? 'Esta página foi aberta direto do computador (endereço começando em ' +
              '<code>file://</code>), e nesse modo o Firebase não funciona. Abra pelo endereço ' +
              'do portal — em teste, <code>http://localhost:8100/equipe.html</code>.'
            : 'Verifique a internet e recarregue a página.') + '</span></div>';
      }
      var topo = $("#clTopo");
      if (topo) topo.hidden = true;
      return;
    }

    ligarGlobais();

    FB.observarSessao(function (quem) {
      equipe = quem;
      if (quem) {
        carregarModelos();
        carregarLista();
      } else {
        empresas = [];
        aberto = null;
        conversaAberta = null;
        if (global.Painel) {
          global.Painel.marcarBadges({ atencao: 0, pendencias: 0, mensagens: 0 });
        }
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})(window);
