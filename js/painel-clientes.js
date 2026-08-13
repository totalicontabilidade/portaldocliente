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
      raiz.collection("financeiro").get()
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

      return {
        id: id,
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
  }

  /* A lista precisa do progresso de cada empresa, e o progresso
     depende dos itens. São várias idas ao servidor — por isso a
     lista carrega uma vez e fica em memória até pedirem para
     atualizar. */
  function carregarLista() {
    if (carregando) return Promise.resolve();
    carregando = true;
    desenharLista();

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
      empresas = lista.sort(function (a, b) {
        return nomeDe(a).localeCompare(nomeDe(b), "pt-BR");
      });
      carregando = false;
      desenharLista();
    }, function (e) {
      carregando = false;
      empresas = [];
      desenharLista();
      UI.toast("Não foi possível carregar os clientes: " + FB.explicar(e), "erro", 9000);
    });
  }

  function nomeDe(c) {
    return (c.empresa.nomeFantasia || c.empresa.razaoSocial || "Sem nome").trim();
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
    if (!e.aceiteLGPD) chave = "naoentrou";
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
    emdia:     { texto: "Em dia", cls: "badge--aprovado" }
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
  function clientesFiltrados() {
    var t = filtro.texto.trim().toLowerCase();
    return empresas.filter(function (c) {
      if (filtro.situacao !== "todos" && estadoDoCliente(c).chave !== filtro.situacao) return false;
      if (!t) return true;
      var alvo = [
        c.empresa.razaoSocial, c.empresa.nomeFantasia, c.empresa.cnpj,
        c.empresa.responsavelNome, c.empresa.responsavelEmail
      ].join(" ").toLowerCase();
      return alvo.indexOf(t) > -1;
    });
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

    caixa.innerHTML = '<div class="card">' + lista.map(function (c) {
      var est = estadoDoCliente(c);
      var falta = est.resumo.pendentesObrigatorios;
      var conferir = naoConferidos(c).length;
      var naoLidas = c.mensagens.filter(function (m) {
        return m.autor === "cliente" && !m.lidaEm;
      }).length;

      return '<button type="button" class="cliente" data-cliente="' + U.escAttr(c.id) + '" ' +
        'style="border-bottom:1px solid var(--stroke)">' +
        '<span class="group__icon">' + ic("ic-building") + '</span>' +
        '<span class="cliente__info">' +
          '<span class="cliente__nome">' + U.esc(nomeDe(c)) + '</span>' +
          '<span class="cliente__meta">' + U.esc(c.empresa.cnpj || "sem CNPJ") + ' · ' +
            est.resumo.pct + '% entregue' +
            (falta ? ' · faltam ' + falta : '') +
            (conferir ? ' · ' + conferir + ' para conferir' : '') +
            (naoLidas ? ' · ' + naoLidas + ' ' + U.plural(naoLidas, "mensagem nova", "mensagens novas") : '') +
          '</span>' +
        '</span>' +
        badge(ROTULO_ESTADO, est.chave) +
        '<span class="cliente__chev">' + ic("ic-chevron-right") + '</span>' +
      '</button>';
    }).join("") + '</div>';

    atualizarPlacar();
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

    var ordem = ["correcao", "conferir", "faltando", "cadastro", "naoentrou", "emdia"];
    placar.innerHTML =
      '<button type="button" class="filtro' + (filtro.situacao === "todos" ? " filtro--on" : "") +
        '" data-filtro="todos">Todos <b>' + empresas.length + '</b></button>' +
      ordem.filter(function (k) { return conta[k]; }).map(function (k) {
        return '<button type="button" class="filtro' +
          (filtro.situacao === k ? " filtro--on" : "") + '" data-filtro="' + U.escAttr(k) + '">' +
          U.esc(ROTULO_ESTADO[k].texto) + ' <b>' + conta[k] + '</b></button>';
      }).join("");
  }

  /* =========================================================
     Tela 2 — ficha do cliente
     ========================================================= */
  function abrirCliente(id) {
    var c = empresas.filter(function (x) { return x.id === id; })[0];
    if (!c) return;
    aberto = c;
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

  function desenharFicha() {
    var c = aberto;
    if (!c) return;
    var e = c.empresa;
    var est = estadoDoCliente(c);
    var pendentes = global.Situacao.pendencias(c.dados, DATA.GRUPOS);

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
            '<span><b>' + est.resumo.pct + '%</b> entregue</span>' +
            '<span><b>' + est.resumo.ok + '</b> de ' + est.resumo.total + ' documentos</span>' +
            '<span><b>' + est.resumo.pendentesObrigatorios + '</b> obrigatórios faltando</span>' +
            '<span><b>' + est.resumo.aprovados + '</b> aprovados</span>' +
          '</div>' +
        '</div>' +
      '</section>' +

      /* ---- Dados do cadastro ---- */
      '<section class="section">' +
        '<div class="section__head"><div>' +
          '<h3 class="section__title" style="font-size:16px">Cadastro e contato</h3>' +
        '</div></div>' +
        '<div class="card card--pad">' +
          linhaDado("Razão social", e.razaoSocial) +
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
          '</div>' +
        '</div>' +
      '</section>' +

      /* ---- Sócios ---- */
      '<section class="section">' +
        '<div class="section__head"><div>' +
          '<h3 class="section__title" style="font-size:16px">Sócios</h3>' +
          '<p class="section__desc">' + c.dados.socios.length + ' ' +
            U.plural(c.dados.socios.length, "cadastrado", "cadastrados") + '</p>' +
        '</div></div>' +
        '<div class="card card--pad">' +
          (c.dados.socios.length
            ? c.dados.socios.map(function (s) {
                return linhaDado(s.nome || "Sócio", s.cpf || "");
              }).join("")
            : '<p class="text-sm text-muted">Nenhum sócio cadastrado — a lista de documentos ' +
              'de sócio ainda não existe para este cliente.</p>') +
        '</div>' +
      '</section>';

    /* ---- O que falta ---- */
    html += '<section class="section">' +
      '<div class="section__head"><div>' +
        '<h3 class="section__title" style="font-size:16px">O que falta</h3>' +
        '<p class="section__desc">Correções pedidas primeiro, depois os obrigatórios que ' +
          'ainda não chegaram.</p>' +
      '</div>' +
      (pendentes.length
        ? '<button type="button" class="btn btn--primary btn--sm" id="clCobrar">' +
          ic("ic-send") + 'Cobrar pelo portal</button>'
        : '') +
      '</div>' +
      '<div class="card' + (pendentes.length ? '' : ' card--pad') + '">' +
        (pendentes.length
          ? pendentes.map(function (p) {
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
            }).join("")
          : '<p class="text-sm text-muted">Nada pendente. Tudo o que era obrigatório já chegou.</p>') +
      '</div>' +
    '</section>';

    /* ---- Documentos, grupo a grupo ---- */
    html += '<section class="section">' +
      '<div class="section__head"><div>' +
        '<h3 class="section__title" style="font-size:16px">Documentos</h3>' +
        '<p class="section__desc">Abra para conferir, aprovar ou pedir correção.</p>' +
      '</div></div>' +
      DATA.GRUPOS.map(function (g) { return grupoHTML(c, g); }).join("") +
    '</section>';

    html += financeiroHTML(c);
    html += credenciaisHTML(c);
    html += mensagensHTML(c);

    $("#clFicha").innerHTML = html;
    ligarFicha();
  }

  function grupoHTML(c, g) {
    var resumo = global.Situacao.resumoGrupo(c.dados, g);
    var alvos = g.escopo === "socio"
      ? c.dados.socios.map(function (s) { return s.id; })
      : [null];

    if (!alvos.length) {
      return '<div class="card card--pad" style="margin-bottom:12px">' +
        '<div class="group__title">' + U.esc(g.titulo) + '</div>' +
        '<p class="text-sm text-muted" style="margin-top:6px">Depende dos sócios, e nenhum foi ' +
        'cadastrado ainda.</p></div>';
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

    return '<div class="card" style="margin-bottom:12px">' +
      '<div class="group__head" style="cursor:default">' +
        '<span class="group__icon">' + ic(g.icone) + '</span>' +
        '<span class="group__info">' +
          '<span class="group__title" style="display:block">' + U.esc(g.titulo) + '</span>' +
          '<span class="group__meta" style="display:block">' + resumo.ok + ' de ' + resumo.total +
            (c.dados.gruposNA[g.id] ? ' · marcado como não se aplica' : '') + '</span>' +
        '</span>' +
      '</div>' + linhas + '</div>';
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
    if (!f) {
      return '<section class="section">' +
        '<div class="section__head"><div>' +
          '<h3 class="section__title" style="font-size:16px">Bancos e maquininhas</h3>' +
        '</div></div>' +
        '<div class="card card--pad"><p class="text-sm text-muted">O cliente ainda não ' +
        'respondeu esta etapa.</p></div></section>';
    }

    var forma = (DATA.FORMAS_RELATORIO || []).filter(function (x) {
      return x.id === f.formaRelatorio;
    })[0];

    var lista = function (arr, outro) {
      var todos = (arr || []).slice();
      if (outro) todos.push(outro);
      return todos.length ? todos.join(", ") : "";
    };

    return '<section class="section">' +
      '<div class="section__head"><div>' +
        '<h3 class="section__title" style="font-size:16px">Bancos e maquininhas</h3>' +
        '<p class="section__desc">' +
          (f.concluidoEm ? 'Concluído em ' + U.esc(U.dataHora(f.concluidoEm)) +
            (f.protocolo ? ' · protocolo ' + U.esc(f.protocolo) : '')
           : 'Respondido em parte — ainda não foi concluído.') + '</p>' +
      '</div></div>' +
      '<div class="card card--pad">' +
        linhaDado("Tem conta em banco", f.temBanco === "sim" ? "Sim" : f.temBanco === "nao" ? "Não" : "") +
        linhaDado("Bancos", lista(f.bancos, f.bancoOutro)) +
        linhaDado("Tem maquininha", f.temMaquineta === "sim" ? "Sim" : f.temMaquineta === "nao" ? "Não" : "") +
        linhaDado("Maquininhas", lista(f.maquinetas, f.maquinetaOutra)) +
        linhaDado("Envio dos relatórios", forma ? forma.titulo : "") +
        linhaDado("Observações", f.observacoes) +
        (f.termo && f.termo.id
          ? '<div class="row" style="margin-top:12px">' +
            '<button type="button" class="btn btn--ghost btn--sm" data-abrir="' +
              U.escAttr(f.termo.id) + '" data-nome="' + U.escAttr(f.termo.nome || "termo.pdf") + '">' +
              ic("ic-download") + 'Abrir termo de compromisso</button></div>'
          : '') +
      '</div>' +
    '</section>';
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

    return '<section class="section">' +
      '<div class="section__head"><div>' +
        '<h3 class="section__title" style="font-size:16px">Acessos e senhas</h3>' +
        '<p class="section__desc">Chegam cifrados. Abrir exige a chave privada, que fica só ' +
          'na memória desta aba e some quando você fecha.</p>' +
      '</div></div>' +
      '<div class="card' + (chaves.length && souAdmin ? '' : ' card--pad') + '">' + corpo + '</div>' +
    '</section>';
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
    return '<section class="section">' +
      '<div class="section__head"><div>' +
        '<h3 class="section__title" style="font-size:16px">Mensagens</h3>' +
        '<p class="section__desc">O cliente lê no portal, na aba Mensagens.</p>' +
      '</div></div>' +
      '<div class="card card--pad">' +
        (msgs.length
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

        '<div class="field" style="margin-top:14px">' +
          '<label class="field__label" for="clMsg">Escrever para o cliente</label>' +
          '<textarea class="textarea" id="clMsg" rows="3" maxlength="4000" ' +
            'placeholder="Escreva aqui…"></textarea>' +
        '</div>' +
        '<button type="button" class="btn btn--primary btn--sm" id="clEnviarMsg">' +
          ic("ic-send") + 'Enviar</button>' +
      '</div>' +
    '</section>';
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

  function enviarMensagem(texto, chave) {
    var c = aberto;
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
      desenharFicha();
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
    if (cobrar) cobrar.addEventListener("click", function () {
      var texto = montarCobranca(aberto);
      if (!texto) return;
      var m = UI.modal({
        titulo: "Cobrar o que falta",
        corpoHTML:
          '<p style="font-size:13.5px;line-height:1.65;color:var(--txt-2);margin-bottom:10px">' +
            'A mensagem vai para a aba Mensagens do portal do cliente. Ajuste o texto se quiser.</p>' +
          '<div class="field" style="margin-bottom:0">' +
            '<textarea class="textarea" id="cbTexto" rows="10" style="font-size:13px"></textarea>' +
          '</div>',
        acoes: [
          { rotulo: "Cancelar", classe: "btn--ghost" },
          {
            rotulo: "Enviar cobrança", classe: "btn--primary",
            onClick: function () { enviarMensagem($("#cbTexto", m.caixa).value); }
          }
        ]
      });
      $("#cbTexto", m.caixa).value = texto;
    });
  }

  function ligarGlobais() {
    document.addEventListener("click", function (ev) {
      var alvo = ev.target.closest ? ev.target : null;
      if (!alvo) return;

      var cliente = alvo.closest("[data-cliente]");
      if (cliente) { abrirCliente(cliente.getAttribute("data-cliente")); return; }

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

    var atualizar = $("#clAtualizar");
    if (atualizar) atualizar.addEventListener("click", function () { carregarLista(); });

    var csv = $("#clCSV");
    if (csv) csv.addEventListener("click", exportarCSV);
  }

  /* =========================================================
     Início
     ========================================================= */
  function iniciar() {
    FB = global.FB;
    if (!FB || !FB.ligado) {
      var secao = $("#secClientes");
      if (secao) secao.hidden = true;
      return;
    }

    ligarGlobais();

    FB.observarSessao(function (quem) {
      equipe = quem;
      var secao = $("#secClientes");
      if (secao) secao.hidden = !quem;
      if (quem) carregarLista();
      else { empresas = []; aberto = null; }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})(window);
