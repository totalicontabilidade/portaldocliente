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
   chegam cifradas e quem as abre é o servidor: a chave privada mora
   no Secret Manager e nunca passa por navegador. Esta aba só pede a
   abertura, recebe a resposta recifrada para uma chave descartável
   dela mesma, e mostra coberta até alguém tocar em "Mostrar".
   Detalhes no bloco de "Abertura de senha", mais abaixo.

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

  /* Ouvinte da conversa do cliente aberto.

     Só existe enquanto uma ficha está aberta: ouvir as mensagens
     de todas as empresas ao mesmo tempo custaria leitura à toa e
     não muda nada na tela. Ao fechar ou trocar de cliente, o
     ouvinte anterior é desligado — senão sobrariam ouvintes vivos
     de fichas que ninguém está olhando. */
  var desligarConversa = null;

  function pararConversa() {
    if (desligarConversa) { try { desligarConversa(); } catch (e) {} }
    desligarConversa = null;
  }

  function ouvirConversa(c) {
    pararConversa();
    if (!c) return;
    desligarConversa = FB.db.collection("empresas").doc(c.id)
      .collection("mensagens").onSnapshot(function (snap) {
        var lista = [];
        snap.forEach(function (d) { var m = d.data() || {}; m.id = d.id; lista.push(m); });
        lista.sort(function (a, b) { return (a.em || 0) - (b.em || 0); });

        /* Nada mudou de fato? Não redesenha: redesenhar a ficha
           inteira apagaria o que a pessoa está escrevendo. */
        var antes = (c.mensagens || []).map(function (m) { return m.id; }).join(",");
        if (antes === lista.map(function (m) { return m.id; }).join(",")) return;

        c.mensagens = lista;
        if (aberto === c) {
          var campo = $("#clMsg");
          var rascunho = campo ? campo.value : "";
          var tinhaFoco = campo && document.activeElement === campo;
          desenharFicha();
          var novo = $("#clMsg");
          if (novo && rascunho) {
            novo.value = rascunho;
            if (tinhaFoco) { novo.focus(); novo.setSelectionRange(rascunho.length, rascunho.length); }
          }
        }
        /* A CAIXA DE ENTRADA TAMBÉM É TEMPO REAL.

           Antes só a ficha do cliente redesenhava aqui, e a aba
           Mensagens ficava parada até alguém tocar em Atualizar —
           era o "a mensagem do cliente não chega" que o Raoni
           descreveu. O caminho da equipe para o cliente funcionava
           porque quem envia já redesenha por conta própria. */
        if (conversaAberta === c) {
          var resp = $("#msTexto");
          var textoResp = resp ? resp.value : "";
          var focoResp = resp && document.activeElement === resp;
          desenharConversa();
          var novaResp = $("#msTexto");
          if (novaResp && textoResp) {
            novaResp.value = textoResp;
            if (focoResp) { novaResp.focus(); novaResp.setSelectionRange(textoResp.length, textoResp.length); }
          }
        }
        atualizarContadores();
      }, function () { /* sem rede: a ficha continua com o que já tem */ });
  }

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
      /* Anotações internas. Só a equipe lê — a regra do servidor
         não deixa o cliente nem listar esta subcoleção. */
      raiz.collection("notas").get()
        .catch(function () { return { forEach: function () {} }; }),
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

      var notas = [];
      r[6].forEach(function (d) {
        var n = d.data() || {};
        notas.push({ id: d.id, texto: String(n.texto || ""),
                     por: String(n.por || ""), em: n.em || 0 });
      });

      var convites = [];
      r[7].forEach(function (d) {
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
          financeiro: financeiro,
          notas: notas
        };
      });
    });
  }

  /* A lista precisa do progresso de cada empresa, e o progresso
     depende dos itens. São várias idas ao servidor — por isso a
     lista carrega uma vez e fica em memória até pedirem para
     atualizar. */
  /* Roda `fn` sobre todos os itens, no máximo `largura` ao mesmo
     tempo. Um item que falhar vira null e não derruba os outros —
     um cliente com problema não pode esconder os demais da lista. */
  function emLotes(itens, largura, fn) {
    var saida = new Array(itens.length);
    var proximo = 0;

    function trabalhar() {
      if (proximo >= itens.length) return Promise.resolve();
      var i = proximo++;
      return Promise.resolve(fn(itens[i])).then(
        function (r) { saida[i] = r; },
        function () { saida[i] = null; }
      ).then(trabalhar);
    }

    var linhas = [];
    for (var k = 0; k < Math.min(largura, itens.length); k++) linhas.push(trabalhar());
    return Promise.all(linhas).then(function () { return saida; });
  }

  /* Quantos faltam chegar — só para a tela poder dizer "3 de 7"
     em vez de um "Carregando…" que parece travado. */
  var totalAcarregar = 0, chegaram = 0;
  var relogioDesenho = null;

  /* "Carregando 3 de 7 clientes" em vez de "Carregando…". A
     pessoa precisa saber que a coisa anda; reticências sozinhas
     parecem travamento. */
  function textoCarregando() {
    if (totalAcarregar > 1) {
      return "Carregando " + chegaram + " de " + totalAcarregar + " clientes…";
    }
    return "Carregando…";
  }

  function desenharComCalma() {
    if (relogioDesenho) return;
    relogioDesenho = setTimeout(function () {
      relogioDesenho = null;
      desenharTudo();
    }, 200);
  }

  /* Quando a lista veio do servidor pela última vez. É o que
     permite decidir, ao entrar numa aba, entre redesenhar o que já
     está na memória e buscar de novo. */
  var carregadaEm = 0;

  function carregarLista() {
    if (carregando) return Promise.resolve();
    carregando = true;
    carregadaEm = Date.now();
    empresas = [];
    desenharLista();
    desenharPendencias();
    desenharMensagens();

    return FB.db.collection("empresas").get().then(function (snap) {
      var ids = [];
      snap.forEach(function (d) { ids.push(d.id); });

      /* EM PARALELO, e não em fila.

         Antes os clientes eram carregados um de cada vez, com
         `reduce`, cada um esperando o anterior terminar. E cada
         cliente são NOVE leituras (empresa, itens, sócios,
         mensagens, financeiro, acessos, notas, convites, e uma por
         login). Com dez clientes isso vira dez rodadas em série —
         era o "demora muito ao clicar em Mensagens", que na
         verdade era a lista inteira ainda chegando.

         Em paralelo, o tempo passa a ser o do cliente mais lento,
         não a soma de todos. O Firestore aguenta bem: são leituras
         pequenas e o navegador já multiplexa as conexões.

         O `em lotes` existe para não abrir sessenta requisições de
         uma vez num escritório com muitos clientes — a partir de
         certo ponto, disparar tudo junto fica mais lento, não mais
         rápido. */
      totalAcarregar = ids.length;
      chegaram = 0;

      /* Cada cliente que chega já entra na tela, em vez de todos
         aparecerem juntos no fim. Com sete clientes a diferença é
         pequena; com trinta, é a diferença entre uma tela parada e
         uma lista que enche na frente da pessoa.

         O redesenho é limitado a um a cada 200ms para não repintar
         a página inteira sete vezes seguidas. */
      return emLotes(ids, 8, function (id) {
        return carregarCliente(id).then(function (c) {
          chegaram++;
          empresas = empresas.concat([c]);
          desenharComCalma();
          return c;
        });
      });
    }).then(function (lista) {
      empresas = lista.filter(Boolean);
      carregando = false;
      totalAcarregar = 0;
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
    /* "Em dia" era dito cedo demais, e isso deixava o cliente
       parado sem ninguém perceber.

       Documento em ordem não quer dizer migração encerrada: o
       portal do cliente segue mostrando a etapa "análise pela
       Totali" até a EQUIPE dizer que acabou. Enquanto essa palavra
       final não vem, quem deve alguma coisa somos nós — e um selo
       verde de "em dia" faz exatamente o contrário de avisar
       isso. */
    else if (e.etapa !== "ativo") chave = "concluir";
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
    concluir:  { texto: "Concluir migração", cls: "badge--pendente" },
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
        c.empresa.responsavelNome, c.empresa.responsavelEmail,
        /* O protocolo entra na busca porque é o número que o cliente
           tem na mão: ele está na tela dele e no PDF do termo. Se
           alguém liga citando "CF-202608-9LD66", a equipe acha o
           cliente digitando isso, em vez de ter de adivinhar o nome. */
        (c.financeiro || {}).protocolo
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

    /* Um ponto só para avisar a tela de Início. Todo lugar que
       muda o estado do trabalho já passa por aqui para acertar os
       números do menu — pendurar o aviso junto é o que garante
       que o Início não fique mostrando o mundo de dois cliques
       atrás. */
    avisarLista();
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

    var ordem = ["correcao", "conferir", "faltando", "concluir", "cadastro", "naoentrou",
                 "emdia", "arquivada"];
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
        U.esc(textoCarregando()) + '</p></div>';
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

    var vazio = !grupos.length
      ? '<div class="card"><div class="empty">' +
          '<div class="empty__icon">' + ic("ic-check-circle") + '</div>' +
          '<div class="empty__title">Nada pendente</div>' +
          '<div class="empty__desc">' +
            (empresas.length ? "Todo mundo entregou o que era obrigatório."
                             : "Ainda não há cliente cadastrado.") + '</div>' +
        '</div></div>'
      : grupos.map(cartaoPendencia).join("");

    caixa.innerHTML = filaHTML() + vazio;
  }

  /* ============================================================
     Fila de conferência — o que CHEGOU e ninguém olhou

     É o outro lado da aba: abaixo ficam os documentos que faltam;
     aqui, os que já chegaram e esperam a equipe. A diferença
     importa porque o trabalho é oposto — um se resolve cobrando,
     o outro se resolve conferindo.

     Ordenada pelo mais antigo, atravessando todas as empresas. A
     ficha do cliente continua existindo para quando se quer o
     contexto inteiro; esta fila serve para o outro modo de
     trabalho, o de sentar e limpar a fila. Antes disso, a equipe
     precisava abrir cliente por cliente para descobrir onde havia
     algo esperando.
     ============================================================ */
  var filaAberta = true;

  function filaDeConferencia() {
    var fila = [];
    empresas.forEach(function (c) {
      if (arquivada(c)) return;
      naoConferidos(c).forEach(function (x) {
        var reg = c.dados.itens[x.chave] || {};
        var socio = x.socioId
          ? c.dados.socios.filter(function (s) { return s.id === x.socioId; })[0]
          : null;
        fila.push({
          cliente: c, chave: x.chave, item: x.item, grupo: x.grupo,
          /* Documento de sócio sem o nome do sócio é ambíguo: numa
             empresa com três sócios, "RG" aparece três vezes. */
          nome: x.item.nome + (socio && socio.nome ? " — " + socio.nome : ""),
          em: emMs(reg.atualizadoEm) || 0
        });
      });
    });
    /* Sem data conhecida vai para o fim: não dá para afirmar que
       espera há muito tempo sem saber desde quando. */
    fila.sort(function (a, b) {
      if (!a.em && !b.em) return 0;
      if (!a.em) return 1;
      if (!b.em) return -1;
      return a.em - b.em;
    });
    return fila;
  }

  function esperaDe(em) {
    if (!em) return { texto: "sem data", dias: 0 };
    var dias = Math.floor((Date.now() - em) / DIA);
    if (dias <= 0) return { texto: "chegou hoje", dias: 0 };
    if (dias === 1) return { texto: "esperando há 1 dia", dias: 1 };
    return { texto: "esperando há " + dias + " dias", dias: dias };
  }

  function filaHTML() {
    var fila = filaDeConferencia();
    if (!fila.length) return "";

    var maisAntigo = esperaDe(fila[0].em);

    return '<section class="card group" data-open="' + (filaAberta ? "true" : "false") +
        '" style="margin-bottom:16px">' +
      '<button type="button" class="group__head group__head--selo" data-fila="1">' +
        '<span class="group__icon">' + ic("ic-check-circle") + '</span>' +
        '<span class="group__info">' +
          '<span class="group__title" style="display:block">Fila de conferência</span>' +
          '<span class="group__meta" style="display:block">Documentos que chegaram e ainda não ' +
            'foram conferidos · o mais antigo ' + U.esc(maisAntigo.texto) + '</span>' +
        '</span>' +
        '<span class="badge ' + (maisAntigo.dias >= 3 ? "badge--pendencia" : "badge--analise") + '">' +
          '<span class="dot"></span>' + fila.length + '</span>' +
        '<span class="group__chev">' + ic("ic-chevron-down") + '</span>' +
      '</button>' +
      (filaAberta
        ? '<div class="group__body">' +
            fila.map(function (f) {
              var e = esperaDe(f.em);
              return '<div class="item"><div class="item__top">' +
                '<span class="group__icon">' + ic(f.grupo.icone) + '</span>' +
                '<div class="item__main">' +
                  '<div class="item__name">' + U.esc(f.nome) + '</div>' +
                  '<div class="item__row">' +
                    '<span class="text-xs" style="color:var(--gold-2);font-weight:640">' +
                      U.esc(nomeDe(f.cliente)) + '</span>' +
                    '<span class="text-xs text-muted">' + U.esc(f.grupo.titulo) + '</span>' +
                    '<span class="text-xs' + (e.dias >= 3 ? '" style="color:var(--warn);font-weight:640' : ' text-muted') +
                      '">' + U.esc(e.texto) + '</span>' +
                  '</div>' +
                  '<div class="item__actions">' +
                    '<button type="button" class="btn btn--primary btn--sm" data-fila-aprovar="' +
                      U.escAttr(f.cliente.id) + '|' + U.escAttr(f.chave) + '">Aprovar</button>' +
                    '<button type="button" class="btn btn--ghost btn--sm" data-cliente="' +
                      U.escAttr(f.cliente.id) + '">Abrir ficha</button>' +
                  '</div>' +
                '</div>' +
              '</div></div>';
            }).join("") +
          '</div>'
        : '') +
    '</section>';
  }

  /* Aprovar direto da fila, sem abrir a ficha. É o ganho da tela:
     conferir vinte documentos vira vinte cliques, não vinte
     idas e voltas. */
  function aprovarDaFila(idCliente, chave) {
    var c = empresas.filter(function (x) { return x.id === idCliente; })[0];
    if (!c) return;

    conferindoForaDaArea([chave]).then(function (ok) {
      if (ok) gravarAprovacaoDaFila(c, chave);
    });
  }

  function gravarAprovacaoDaFila(c, chave) {
    var revisao = {
      status: "aprovado", motivo: "",
      por: (equipe && (equipe.nome || equipe.email)) || "equipe",
      em: Date.now()
    };

    FB.db.collection("empresas").doc(c.id).collection("itens")
      .doc(global.Nuvem.codificar(chave))
      .set({ revisao: revisao }, { merge: true })
      .then(function () {
        if (!c.dados.itens[chave]) c.dados.itens[chave] = {};
        c.dados.itens[chave].revisao = revisao;
        desenharPendencias();
        atualizarContadores();
        UI.toast("Aprovado.", "ok", 2500);
      }, function (e) {
        UI.toast("Não foi possível aprovar: " + FB.explicar(e), "erro", 9000);
      });
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
        /* A MESMA TABELA DA FICHA. Esta aba é a outra tela em que a
           equipe decide sobre um documento — decidir sem ver o
           arquivo nem a resposta obrigava a abrir a ficha por fora,
           e duas listas diferentes para o mesmo trabalho é como uma
           delas fica para trás. */
        (fechado ? '' : tabelaDeConferencia(c, s.itens)) +
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

  /* ---------- Resolvida ----------

     LER NÃO É RESOLVER. Abrir a conversa marca tudo como lido — e
     é aí que a mensagem some do radar, mesmo quando pedia uma
     providência que ninguém tomou. "Vocês conseguem antecipar a
     folha deste mês?" fica lida em dois segundos e esquecida por
     duas semanas.

     Resolvida é uma marca separada, e só a equipe põe. O cliente
     não vê nada disso: não é status do pedido dele, é controle
     interno de quem já tratou o quê. */
  function aResolverDe(c) {
    return c.mensagens.filter(function (m) {
      return m.autor === "cliente" && !m.resolvidaEm;
    }).length;
  }

  /* Uma mensagem, desenhada igual na caixa de entrada e na ficha.
     Eram dois blocos quase iguais, e o "resolvida" teria que ser
     escrito duas vezes — que é como um deles fica para trás. */
  function mensagemHTML(m, c) {
    var doCliente = m.autor !== "equipe";
    /* O id da empresa viaja no botão. A ficha e a caixa de entrada
       são telas diferentes, e mais de uma pode estar montada ao
       mesmo tempo — deduzir "de quem é esta mensagem" pelo que
       está aberto acerta quase sempre, e o quase é o problema. */
    var alvo = (c && c.id) || "";
    var apagada = !!m.apagadaEm;
    return '<div class="msg msg--' + (doCliente ? "dele" : "minha") +
        (doCliente && m.resolvidaEm ? " msg--resolvida" : "") +
        (apagada ? " msg--apagada" : "") + ' msg--pressionavel"' +
        ' data-msg="' + U.escAttr(m.id || "") + '"' +
        ' data-msg-empresa="' + U.escAttr(alvo) + '">' +
      '<div class="msg__autor">' +
        U.esc(doCliente ? "Cliente" : (m.autorNome || "Totali")) +
        /* Quem escreveu importa ao reler a conversa meses depois:
           uma cobrança do sistema e uma cobrança de uma pessoa
           pesam diferente numa conversa com o cliente. */
        (m.automatico ? ' <span class="msg__auto">automático</span>' : '') + '</div>' +
      '<div>' + (apagada
        ? U.esc("Mensagem apagada" + (m.apagadaPor ? " por " + m.apagadaPor : ""))
        : U.esc(m.texto)) + '</div>' +
      '<div class="msg__hora">' + U.esc(U.dataHora(m.em)) +
        (!apagada && m.editadaEm ? '<span class="msg__editada">editada</span>' : '') + '</div>' +
      ((m.anexos || []).length
        ? '<div class="arqs">' + m.anexos.map(function (a) {
            /* `alvo` era calculado com um comentário explicando por
               que ele existe, e depois não era usado em lugar
               nenhum. O anexo aberto pela caixa de entrada caía no
               "cliente aberto" — que ali é nulo — e não abria. */
            return '<button type="button" class="arq" data-abrir="' + U.escAttr(a.id) +
              '" data-emp="' + U.escAttr(alvo) +
              '" data-nome="' + U.escAttr(a.nome) + '" data-tipo="mensagem">' +
              ic("ic-clipe") + '<span class="arq__n">' + U.esc(a.nome) + '</span></button>';
          }).join("") + '</div>'
        : '') +
      /* RESOLVER É DA CONVERSA, NÃO DE CADA FRASE (pedido dele,
         2026-08-24). Antes toda mensagem do cliente vinha com o
         botão, e uma dúvida contada em quatro mensagens exigia
         quatro cliques para dizer a mesma coisa: já foi tratado.
         O botão subiu para o fim da conversa; aqui fica só o selo,
         para quem relê meses depois saber quem tratou e quando. */
      (doCliente && m.resolvidaEm
        ? '<div class="msg__resolver">' +
            '<span class="msg__selo">' + ic("ic-check") + 'Resolvida por ' +
              U.esc(m.resolvidaPor || "equipe") + ' em ' +
              U.esc(U.dataCurta(m.resolvidaEm)) + '</span>' +
          '</div>'
        : '') +
    '</div>';
  }

  /* ============================================================
     APAGAR E CORRIGIR MENSAGEM

     As mesmas travas do servidor, repetidas aqui só para a tela
     saber o que oferecer. Quem decide continua sendo a regra do
     Firestore — isto evita mostrar uma opção que daria erro.

     Apagar não é delete: vira lápide, com quem apagou e quando.
     Corrigir tem prazo mais curto e NÃO tem exceção para admin:
     apagar tira algo do registro, editar põe palavra na boca de
     quem escreveu. Ninguém edita mensagem alheia.
     ============================================================ */
  var JANELA_APAGAR_MS = 15 * 60 * 1000;
  var JANELA_EDITAR_MS = 5 * 60 * 1000;

  function meuUid() {
    return (FB && FB.auth && FB.auth.currentUser && FB.auth.currentUser.uid) || "";
  }
  function souAdministrador() { return !!(equipe && equipe.papel === "admin"); }
  function minhaMensagem(m) { return !!(m && m.autorUid && m.autorUid === meuUid()); }

  function podeApagarMensagem(m) {
    if (!m || m.apagadaEm) return false;
    if (souAdministrador()) return true;
    return minhaMensagem(m) && (Date.now() - (m.em || 0)) < JANELA_APAGAR_MS;
  }
  function podeEditarMensagem(m) {
    if (!m || m.apagadaEm) return false;
    return minhaMensagem(m) && (Date.now() - (m.em || 0)) < JANELA_EDITAR_MS;
  }

  function refMensagem(empresaId, id) {
    return FB.db.collection("empresas").doc(empresaId).collection("mensagens").doc(id);
  }

  function acharMensagem(empresaId, id) {
    var c = (empresas || []).filter(function (x) { return x.id === empresaId; })[0];
    if (!c) return null;
    return { cliente: c, msg: (c.mensagens || []).filter(function (m) { return m.id === id; })[0] };
  }

  function apagarMensagem(empresaId, id) {
    var achado = acharMensagem(empresaId, id);
    if (!achado || !achado.msg) return;
    var m = achado.msg;
    UI.confirmar({
      titulo: "Apagar esta mensagem",
      mensagem: "O texto sai da conversa para os dois lados, e no lugar dele fica " +
                "\"Mensagem apagada\" com o seu nome. Não dá para desfazer.",
      confirmar: "Apagar",
      perigo: true
    }).then(function (ok) {
      if (!ok) return;
      var lapide = {
        texto: "", anexos: [],
        apagadaEm: Date.now(),
        apagadaPor: (equipe && (equipe.nome || equipe.email)) || "Totali"
      };
      refMensagem(empresaId, id).set(lapide, { merge: true }).then(function () {
        m.texto = ""; m.anexos = [];
        m.apagadaEm = lapide.apagadaEm; m.apagadaPor = lapide.apagadaPor;
        redesenharConversas();
        UI.toast("Mensagem apagada.", "ok", 3000);
      }, function (e) {
        UI.toast("Não foi possível apagar: " + FB.explicar(e), "erro", 8000);
      });
    });
  }

  function editarMensagem(empresaId, id) {
    var achado = acharMensagem(empresaId, id);
    if (!achado || !achado.msg) return;
    var m = achado.msg;
    var mo = UI.modal({
      titulo: "Corrigir mensagem",
      corpoHTML:
        '<p style="font-size:13px;line-height:1.6;color:var(--txt-3);margin-bottom:10px">' +
          'A conversa vai mostrar que esta mensagem foi editada — corrigir um erro de ' +
          'digitação é uma coisa, fingir que a frase sempre foi outra é outra.</p>' +
        '<div class="field" style="margin-bottom:0">' +
          '<label class="field__label" for="edMsg">Texto</label>' +
          '<textarea class="textarea" id="edMsg" rows="5" data-focus maxlength="4000"></textarea>' +
        '</div>',
      acoes: [
        { rotulo: "Cancelar", classe: "btn--ghost" },
        {
          rotulo: "Salvar", classe: "btn--primary", fecharAntes: false,
          onClick: function () {
            var campo = $("#edMsg", mo.caixa);
            var t = String(campo && campo.value || "").trim().slice(0, 4000);
            if (!t) { if (campo) campo.focus(); return; }
            if (t === m.texto) { UI.fecharModal(); return; }
            var b = $('[data-acao="1"]', mo.caixa);
            if (b) { b.disabled = true; b.textContent = "Salvando…"; }
            var agora = Date.now();
            refMensagem(empresaId, id).set({ texto: t, editadaEm: agora }, { merge: true })
              .then(function () {
                m.texto = t; m.editadaEm = agora;
                UI.fecharModal();
                redesenharConversas();
                UI.toast("Mensagem corrigida.", "ok", 3000);
              }, function (e) {
                if (b) { b.disabled = false; b.textContent = "Salvar"; }
                UI.toast("Não foi possível corrigir: " + FB.explicar(e), "erro", 8000);
              });
          }
        }
      ]
    });
    var campo = $("#edMsg", mo.caixa);
    if (campo) { campo.value = m.texto || ""; }
  }

  /* A conversa aparece em duas telas — a ficha e a caixa de
     entrada — e qualquer uma pode estar montada. Redesenha a que
     estiver. */
  function redesenharConversas() {
    if (conversaAberta) desenharConversa();
    if (aberto) desenharFicha();
  }

  function ligarMenuDasMensagens() {
    UI.ligarMenuDeContexto(document.body, "[data-msg]", function (alvo) {
      var id = alvo.getAttribute("data-msg");
      var empresaId = alvo.getAttribute("data-msg-empresa");
      var achado = acharMensagem(empresaId, id);
      if (!achado || !achado.msg) return null;
      var m = achado.msg;
      var itens = [];
      if (podeEditarMensagem(m)) {
        itens.push({
          rotulo: "Corrigir mensagem", icone: "ic-lapis",
          onClick: function () { editarMensagem(empresaId, id); }
        });
      }
      if (podeApagarMensagem(m)) {
        itens.push({
          rotulo: "Apagar mensagem", icone: "ic-trash", perigo: true,
          onClick: function () { apagarMensagem(empresaId, id); }
        });
      }
      return itens;
    });
  }

  /* Resolve a conversa inteira de uma vez. Num lote só: são poucas
     mensagens e uma ida ao servidor, em vez de uma por frase. */
  function marcarConversaResolvida(c, resolver) {
    var alvos = c.mensagens.filter(function (m) {
      return m.autor === "cliente" && (resolver ? !m.resolvidaEm : m.resolvidaEm);
    });
    if (!alvos.length) {
      UI.toast(resolver ? "Não há o que resolver nesta conversa." : "Nada a reabrir.", "ok", 2500);
      return;
    }

    var dados = resolver
      ? { resolvidaEm: Date.now(),
          resolvidaPor: (equipe && (equipe.nome || equipe.email)) || "equipe" }
      : { resolvidaEm: 0, resolvidaPor: "" };

    var col = FB.db.collection("empresas").doc(c.id).collection("mensagens");
    var lote = FB.db.batch();
    alvos.slice(0, 400).forEach(function (m) { lote.set(col.doc(m.id), dados, { merge: true }); });

    lote.commit().then(function () {
      alvos.forEach(function (m) {
        m.resolvidaEm = dados.resolvidaEm;
        m.resolvidaPor = dados.resolvidaPor;
      });
      atualizarContadores();
      if (conversaAberta === c) desenharConversa();
      if (aberto === c) desenharFicha();
      UI.toast(resolver
        ? "Conversa resolvida (" + alvos.length + " " +
          U.plural(alvos.length, "mensagem", "mensagens") + ")."
        : "Conversa reaberta.", "ok", 3000);
    }, function (e) {
      UI.toast("Não foi possível marcar: " + FB.explicar(e), "erro", 9000);
    });
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
    if (filtroMensagem === "aresolver") {
      lista = lista.filter(function (c) { return aResolverDe(c) > 0; });
    }
    return lista.sort(function (a, b) {
      var na = naoLidasDe(a), nb = naoLidasDe(b);
      if ((na > 0) !== (nb > 0)) return nb - na;
      /* Depois das não lidas vêm as que ainda esperam providência.
         Sem isso, conversa lida-e-esquecida afundava na lista pela
         data e não voltava nunca. */
      var ra = aResolverDe(a) > 0, rb = aResolverDe(b) > 0;
      if (ra !== rb) return ra ? -1 : 1;
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
        U.esc(textoCarregando()) + '</p></div>';
      return;
    }

    var totalNaoLidas = empresas.reduce(function (a, c) { return a + naoLidasDe(c); }, 0);
    var totalAResolver = empresas.reduce(function (a, c) {
      return a + (arquivada(c) ? 0 : aResolverDe(c));
    }, 0);
    var comConversa = empresas.filter(function (c) { return c.mensagens.length; }).length;

    var filtros = $("#msFiltros");
    if (filtros) {
      filtros.innerHTML =
        '<button type="button" class="filtro' + (filtroMensagem === "todas" ? " filtro--on" : "") +
          '" data-fmsg="todas">Todas <b>' + comConversa + '</b></button>' +
        '<button type="button" class="filtro' + (filtroMensagem === "naolidas" ? " filtro--on" : "") +
          '" data-fmsg="naolidas">Não lidas <b>' + totalNaoLidas + '</b></button>' +
        '<button type="button" class="filtro' + (filtroMensagem === "aresolver" ? " filtro--on" : "") +
          '" data-fmsg="aresolver">A resolver <b>' + totalAResolver + '</b></button>';
    }

    var lista = conversas();
    if (!lista.length) {
      caixa.innerHTML = '<div class="card"><div class="empty">' +
        '<div class="empty__icon">' + ic("ic-chat") + '</div>' +
        '<div class="empty__title">' +
          (filtroMensagem === "naolidas" ? "Nenhuma mensagem esperando resposta"
           : filtroMensagem === "aresolver" ? "Nada esperando providência"
           : "Nenhuma conversa ainda") + '</div>' +
        '<div class="empty__desc">' +
          (filtroMensagem === "naolidas"
            ? "Tudo o que os clientes escreveram já foi lido."
            : filtroMensagem === "aresolver"
              ? "Toda mensagem de cliente já foi tratada e marcada como resolvida."
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
          : aResolverDe(c)
            ? '<span class="badge badge--analise"><span class="dot"></span>' +
              aResolverDe(c) + ' a resolver</span>'
            : '') +
        '<span class="cliente__chev">' + ic("ic-chevron-right") + '</span>' +
      '</button>';
    }).join("") + '</div>';
  }

  function abrirConversa(id) {
    var c = empresas.filter(function (x) { return x.id === id; })[0];
    if (!c) return;
    conversaAberta = c;
    anexosPendentes = [];
    /* Sem isto a conversa da caixa de entrada ficava congelada: só
       a ficha do cliente ligava o ouvinte, e quem trabalha pela aba
       Mensagens não via a resposta chegar. */
    ouvirConversa(c);
    desenharConversa();
    global.scrollTo({ top: 0, behavior: "auto" });
    marcarLidas(c);
  }

  /* Deixa a conversa exatamente do tamanho do que sobra da janela.

     Duas passadas de propósito. A primeira usa a posição real do
     bloco, o que já resolve o cabeçalho e qualquer coisa acima
     dele. A segunda olha se AINDA sobrou rolagem na página — o que
     acontece por causa do respiro que a `.shell` reserva embaixo,
     diferente no computador e no celular — e desconta o que sobrou.

     É por isso que não há constante para acertar aqui: o valor sai
     da tela em que a pessoa está, não de uma medição minha num
     tamanho que talvez ela nunca use. */
  var LISTA_MINIMA = 200;

  function ajustarAlturaDaConversa() {
    var cx = $("#msConversa");
    if (!cx || cx.hidden) return;
    var topo = cx.getBoundingClientRect().top;
    var alvo = Math.max(320, global.innerHeight - topo - 8);
    cx.style.height = alvo + "px";

    var sobra = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    if (sobra > 0) {
      alvo = Math.max(320, alvo - sobra);
      cx.style.height = alvo + "px";
    }

    /* PISO PARA A LISTA, e o motivo de ele existir.

       Numa janela baixa, o que sobra depois do cabeçalho, dos
       modelos e do campo de resposta pode virar uma conversa de
       130 pixels — três linhas. Aí a tela "não rola", mas também
       não serve para conversar.

       Quando isso acontece, prefiro devolver a rolagem da página:
       rolar um pouco é um incômodo; ler a conversa por uma fresta
       é um impedimento. Em tela normal isto nunca dispara. */
    var lista = cx.querySelector(".conversa");
    if (!lista) return;
    var falta = LISTA_MINIMA - lista.clientHeight;
    if (falta > 0) cx.style.height = (alvo + falta) + "px";
  }

  function fecharConversa() {
    conversaAberta = null;
    anexosPendentes = [];
    /* Só desliga se a ficha do mesmo cliente não estiver aberta —
       ela também depende deste ouvinte. */
    if (!aberto) pararConversa();
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
          ? '<div class="conversa conversa--alta">' +
              c.mensagens.map(function (m) { return mensagemHTML(m, c); }).join("") + '</div>'
          : '<p class="text-sm text-muted">Nenhuma mensagem ainda.</p>') +
        /* Mesmo botão da ficha, e pela mesma razão: resolver é da
           conversa inteira, não de cada frase. Aqui era o lugar em
           que o Raoni foi procurar e não achou. */
        (aResolverDe(c)
          ? '<div class="row" style="margin-top:12px">' +
              '<button type="button" class="btn btn--quiet btn--sm" data-resolver-tudo="1" ' +
                'data-emp="' + U.escAttr(c.id) + '">' + ic("ic-check") +
                'Marcar conversa como resolvida</button>' +
              '<span class="text-xs text-muted" style="align-self:center">' +
                aResolverDe(c) + ' ' + U.plural(aResolverDe(c), "mensagem", "mensagens") +
                ' do cliente sem providência</span>' +
            '</div>'
          : (c.mensagens.length
              ? '<div class="row" style="margin-top:12px">' +
                  '<button type="button" class="btn btn--quiet btn--sm" data-resolver-tudo="0" ' +
                    'data-emp="' + U.escAttr(c.id) + '">Reabrir a conversa</button>' +
                '</div>'
              : '')) +
        '<div class="field" style="margin-top:14px">' +
          '<label class="field__label" for="msTexto">Responder</label>' +
          '<textarea class="textarea" id="msTexto" rows="3" maxlength="4000" ' +
            'placeholder="Escreva aqui…"></textarea>' +
        '</div>' +
        '<div class="row">' +
          '<button type="button" class="btn btn--quiet btn--sm" id="msAnexar">' +
            ic("ic-clipe") + 'Anexar arquivo</button>' +
          '<button type="button" class="btn btn--primary btn--sm" id="msEnviar">' +
            ic("ic-send") + 'Enviar</button>' +
        '</div>' +
        /* OS MODELOS DESCERAM PARA DEPOIS DO ENVIAR (pedido dele).

           Entre a conversa e o campo de resposta, eles empurravam
           as duas coisas que importam para longe uma da outra — e
           numa tela de altura fixa isso sai direto do tamanho da
           conversa. Aqui embaixo continuam a um toque e param de
           dividir a tela ao meio. */
        modelosHTML() +
        '<div id="msAnexos" class="anexos-fila"></div>' +
      '</div>';

    var voltar = $("#msVoltar");
    if (voltar) voltar.addEventListener("click", fecharConversa);

    var enviar = $("#msEnviar");
    if (enviar) enviar.addEventListener("click", function () {
      var campo = $("#msTexto");
      if (!campo.value.trim() && !anexosPendentes.length) { campo.focus(); return; }
      enviar.disabled = true;
      enviarMensagem(campo.value, "", c).then(function () { desenharConversa(); });
    });

    var anexar = $("#msAnexar");
    if (anexar) anexar.addEventListener("click", function () { escolherAnexo(); });

    desenharAnexos();

    /* Antes de rolar para o fim: a altura precisa estar certa,
       senão o `scrollTop` mira num tamanho que ainda vai mudar e a
       conversa abre no meio. */
    ajustarAlturaDaConversa();

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
    /* Anexo escolhido para um cliente não pode acompanhar a troca
       para outro — seria mandar documento para a empresa errada. */
    anexosPendentes = [];
    /* Só "o que falta" nasce aberto: é o motivo de a equipe abrir
       a ficha. O resto fica recolhido, e o selo do cabeçalho diz
       onde tem trabalho esperando. */
    abertosFicha = { falta: true };
    /* Cada cliente abre em Documentos, sempre. A vista é lembrada
       enquanto se trabalha num mesmo cliente, mas carregá-la para
       o próximo surpreende: abre-se uma ficha nova e cai numa
       conversa que ficou de vinte minutos atrás. */
    vistaFicha = "documentos";
    $("#clLista").hidden = true;
    $("#clTopo").hidden = true;
    $("#clFicha").hidden = false;
    desenharFicha();
    ouvirConversa(c);
    global.scrollTo({ top: 0, behavior: "auto" });
  }

  function fecharCliente() {
    pararConversa();
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

  /* ============================================================
     A ficha em três vistas

     Antes era uma coluna só com onze cartões dobráveis, todos
     fechados: cadastro, sócios, documentos, financeiro, senhas,
     convite, anotações, encerrar. Para ver o telefone do
     responsável a pessoa abria três cartões e fechava dois.

     Cartão dobrável faz sentido para DOCUMENTO, que é lista longa
     e repetitiva e onde o selo do cabeçalho já diz se vale abrir.
     Não faz sentido para cadastro, que é um punhado de campos que
     se quer LER, não abrir.

     Então: documentos continuam em cartão; o resto vira painel
     aberto, em duas colunas no computador. E a conversa ganha
     vista própria, porque ninguém lê mensagem no meio da lista
     de documentos.
     ============================================================ */
  /* "Bancos e senhas" é aba própria desde 2026-08-24, a pedido do
     Raoni. Antes vivia no meio de "Cadastro e acesso", depois do
     cadastro, dos sócios e do acesso ao portal — e é justamente o
     conteúdo que a equipe abre a ficha para buscar quando vai
     baixar relatório de maquineta. Ficava escondido no lugar mais
     movimentado da ficha. */
  var VISTAS = [
    { id: "documentos", rotulo: "Documentos",        icone: "ic-folder" },
    { id: "financeiro", rotulo: "Bancos e senhas",   icone: "ic-card" },
    { id: "cadastro",   rotulo: "Cadastro e acesso", icone: "ic-building" },
    { id: "conversa",   rotulo: "Conversa",          icone: "ic-chat" }
  ];
  var vistaFicha = "documentos";

  function abasFichaHTML(c) {
    var naoLidas = naoLidasDe(c);
    /* Quantas senhas o cliente já mandou. O número na aba evita a
       pergunta que a equipe faria abrindo e fechando: "esse cliente
       chegou a informar o acesso da maquineta?". */
    var quantasSenhas = Object.keys((c && c.recibos) || {}).length;
    return '<div class="vistas" role="tablist">' +
      VISTAS.map(function (v) {
        var ativa = vistaFicha === v.id;
        var selo = "";
        if (v.id === "conversa" && naoLidas) selo = naoLidas;
        if (v.id === "financeiro" && quantasSenhas) selo = quantasSenhas;
        return '<button type="button" role="tab" aria-selected="' + (ativa ? "true" : "false") +
          '" class="vistas__b' + (ativa ? " vistas__b--on" : "") +
          '" data-vista="' + v.id + '">' +
          ic(v.icone) + U.esc(v.rotulo) +
          (selo ? '<span class="vistas__n">' + selo + '</span>' : '') +
        '</button>';
      }).join("") +
    '</div>';
  }

  /* Painel de configuração: sem chevron, sem dobrar, sempre
     legível. É a diferença entre guardar e mostrar. */
  function painel(o) {
    return '<section class="painel' + (o.largo ? " painel--largo" : "") + '">' +
      '<div class="painel__cab">' +
        '<span class="group__icon">' + ic(o.icone || "ic-file") + '</span>' +
        '<span class="painel__txt">' +
          '<span class="painel__t">' + U.esc(o.titulo) + '</span>' +
          (o.resumo ? '<span class="painel__d">' + U.esc(o.resumo) + '</span>' : '') +
        '</span>' +
        (o.selo
          ? '<span class="badge ' + (o.seloCls || "badge--analise") + '">' +
            '<span class="dot"></span>' + U.esc(o.selo) + '</span>'
          : '') +
        (o.acao || '') +
      '</div>' +
      '<div class="painel__corpo">' + o.corpo() + '</div>' +
    '</section>';
  }

  function bloco(o) {
    var aberto = !!abertosFicha[o.id];
    return '<section class="card group ' + (o.classe || "") +
        '" data-open="' + (aberto ? "true" : "false") + '" ' +
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

  /* ============================================================
     PEÇAS DE UM DOCUMENTO, REAPROVEITADAS

     As três coisas que a equipe precisa para decidir sobre um
     documento: o que o cliente respondeu, o arquivo em si, e os
     botões de aprovar e devolver. Ficavam só na aba Documentos —
     agora "O que falta" e a aba Pendências usam as mesmas peças,
     porque é nessas duas telas que a conferência acontece.
     ============================================================ */

  /* O selo da situação numa linha de tabela.

     Quando o cliente respondeu, o selo vira BOTÃO e a resposta sai
     num balão. Numa célula a resposta não cabe: ou ela quebra a
     grade que faz a tabela valer a pena, ou é cortada e vira uma
     frase pela metade, que é pior que não mostrar. Guardada no
     balão, ela está a um toque de distância e a linha continua
     lendo-se de um golpe. */
  function seloDaLinha(c, chave, sit) {
    var reg = (c.dados.itens || {})[chave] || {};
    if (sit === "pendencia" && reg.obs) {
      return '<button type="button" class="badge badge--analise badge--btn" ' +
        'data-resposta="' + U.escAttr(chave) + '" data-emp="' + U.escAttr(c.id) + '" ' +
        'title="Ver o que o cliente respondeu">' +
        '<span class="dot"></span>Respondido' + ic("ic-chat") + '</button>';
    }
    return badge(ROTULO_SITUACAO, sit);
  }

  /* Cabeçalho da fila. Sem moldura de cartão de propósito: é a
     diferença de forma que separa a fila dos setores. Recolher
     continua existindo — só que aqui é a fila inteira, e ela nasce
     aberta porque é o motivo de a ficha ser aberta. */
  /* A AÇÃO SOBE PARA O CABEÇALHO, e isso é o que enxuga o bloco.

     "Cobrar tudo o que falta" era um botão dourado grande com uma
     linha de explicação embaixo — juntos, mais altura que as duas
     linhas de documento que eles acompanhavam. A explicação some:
     a próxima tela já pergunta por qual via enviar, então dizer
     isso antes é avisar sobre uma pergunta que vai ser feita.

     São dois botões irmãos, e não um dentro do outro: o cabeçalho
     inteiro é o gatilho de abrir e fechar, e botão dentro de botão
     não existe em HTML. */
  function blocoFila(o) {
    var aberto = abertosFicha[o.id] !== false;
    return '<section class="fila" data-open="' + (aberto ? "true" : "false") + '">' +
      '<div class="fila__linha">' +
        '<button type="button" class="fila__cab" data-bloco="' + U.escAttr(o.id) + '" ' +
            'aria-expanded="' + (aberto ? "true" : "false") + '">' +
          '<span class="fila__txt">' +
            '<span class="fila__titulo">' + U.esc(o.titulo) + '</span>' +
            '<span class="fila__resumo">' + U.esc(o.resumo || "") + '</span>' +
          '</span>' +
          (o.selo
            ? '<span class="badge ' + (o.seloCls || "badge--pendente") + '">' +
              '<span class="dot"></span>' + U.esc(o.selo) + '</span>'
            : '') +
        '</button>' +
        (o.acao || '') +
        '<button type="button" class="fila__chev" data-bloco="' + U.escAttr(o.id) + '" ' +
            'aria-label="' + (aberto ? "Recolher" : "Abrir") + '">' +
          ic("ic-chevron-down") + '</button>' +
      '</div>' +
      (aberto ? '<div class="fila__corpo">' + o.corpo() + '</div>' : '') +
    '</section>';
  }

  /* Uma linha por documento. As ações à direita, e o arquivo numa
     coluna própria — as três coisas que a conferência precisa,
     lado a lado, sem abrir nada. */
  /* `modo` decide o que a tabela faz, e a diferença não é estética.

     Na FICHA ela é um RESUMO: o documento inteiro está logo
     abaixo, com o arquivo, a resposta do cliente e os botões. Ter
     tudo isso duas vezes na mesma tela era o que a deixava
     poluída. Aqui a única ação é ir até o cartão do documento.

     Na aba PENDÊNCIAS não existe cartão nenhum embaixo — é a lista
     de todos os clientes. Lá a tabela precisa mesmo carregar as
     ações, senão a equipe teria que abrir a ficha para cada
     documento. */
  function tabelaDeConferencia(c, pendentes, modo) {
    var resumo = modo === "resumo";
    /* Sem cabeçalho no resumo: com duas ou três linhas, "DOCUMENTO
       / SITUAÇÃO" não ensina nada que o conteúdo já não diga, e
       ocupa uma faixa inteira. Na aba Pendências ele fica, porque
       lá são quatro colunas e a lista é longa. */
    return '<div class="tabela-rolo"><table class="conf' +
      (resumo ? ' conf--resumo' : '') + '">' +
      (resumo ? '' :
        '<thead><tr><th>Documento</th><th>Situação</th>' +
        '<th>Arquivo</th><th class="conf__dir">Ação</th></tr></thead>') +
      '<tbody>' +
      pendentes.map(function (p) {
        var reg = (c.dados.itens || {})[p.chave] || {};
        var arquivos = reg.arquivos || [];
        return '<tr>' +
          '<td><span class="conf__n">' + U.esc(p.item.nome) + '</span>' +
            '<span class="conf__s">' + U.esc(p.grupo.titulo) +
              (p.socio ? ' · ' + U.esc(p.socio.nome || "sócio") : '') +
              (p.item.obrigatorio ? ' · obrigatório' : '') +
              (resumo && arquivos.length
                ? ' · ' + arquivos.length + " " +
                  U.plural(arquivos.length, "arquivo", "arquivos") : '') + '</span>' +
            combinadoHTML(c, p.chave) + '</td>' +
          '<td>' + seloDaLinha(c, p.chave, p.sit) + '</td>' +
          (resumo ? '' :
          '<td>' + (arquivos.length
            ? arquivos.map(function (a) {
                /* Apagar fica COLADO no arquivo, e não na coluna de
                   ações. Ação de coluna vale para o documento; esta
                   vale para um arquivo específico, e num item com
                   três anexos a diferença é qual deles some. */
                return '<span class="arq-par">' +
                  '<button type="button" class="arq arq--linha" data-abrir="' +
                    U.escAttr(a.id) + '" data-emp="' + U.escAttr(c.id) + '" ' +
                    'data-nome="' + U.escAttr(a.nome) + '">' +
                    ic(U.iconePorExtensao(U.extensao(a.nome))) +
                    '<span class="arq__n">' + U.esc(a.nome) + '</span></button>' +
                  '<button type="button" class="arq-x" data-remover-doc="' + U.escAttr(p.chave) +
                    '" data-arq="' + U.escAttr(a.id) + '" data-emp="' + U.escAttr(c.id) +
                    '" data-nome="' + U.escAttr(a.nome) + '" ' +
                    'title="Apagar este arquivo" aria-label="Apagar ' + U.escAttr(a.nome) + '">' +
                    ic("ic-trash") + '</button>' +
                '</span>';
              }).join("")
            : '<span class="conf__vazio">—</span>') + '</td>') +
          '<td class="conf__dir">' + (resumo
            ? '<button type="button" class="conf__ir" data-ir-doc="' + U.escAttr(p.chave) +
              '" data-grupo="' + U.escAttr(p.grupo.id) + '">Ver documento' +
              ic("ic-chevron-right") + '</button>'
            : '<div class="conf__acoes">' +
                acoesDeRevisao(c, p.chave, p.sit) +
                '<button type="button" class="btn btn--quiet btn--sm" data-cobrar-item="' +
                  U.escAttr(p.chave) + '" data-emp="' + U.escAttr(c.id) + '">Cobrar</button>' +
              '</div>') + '</td>' +
        '</tr>';
      }).join("") +
      '</tbody></table></div>';
  }

  /* ============================================================
     APAGAR UM DOCUMENTO DO CLIENTE

     Existe porque acontece: o cliente manda a foto errada, manda
     duas vezes, ou manda o documento de outra empresa. Até aqui só
     ele podia remover — e pedir "apaga aquele arquivo e manda de
     novo" é uma ida e volta que trava a conferência por dias.

     PERGUNTA ANTES, SEMPRE, e a pergunta diz o nome do arquivo.
     "Tem certeza?" sozinho não é aviso: quem clicou já achava que
     tinha certeza. O que faz alguém parar é ler o nome do que vai
     sumir e perceber que não era aquele.

     Apaga o arquivo no Storage E o registro no documento. Se o
     Storage falhar, o registro NÃO sai: melhor um arquivo órfão no
     servidor, que ninguém vê, do que um documento apontando para
     um arquivo que não existe mais — este último a equipe clica,
     não abre, e não entende por quê.
     ============================================================ */
  function removerDocumento(empresaId, chave, arquivoId, nome) {
    var c = (empresas || []).filter(function (x) { return x.id === empresaId; })[0];
    if (!c) {
      UI.toast("Não encontrei este cliente. Recarregue a página e tente de novo.", "erro", 8000);
      return;
    }
    UI.confirmar({
      titulo: "Apagar este arquivo",
      mensagem: "Vai sair do servidor o arquivo \"" + (nome || "sem nome") + "\", que o cliente " +
                "enviou. Ele volta a ver o documento como pendente e vai precisar enviar de novo. " +
                "Não dá para desfazer.",
      confirmar: "Apagar arquivo",
      perigo: true
    }).then(function (ok) {
      if (!ok) return;
      UI.toast("Apagando…", "", 4000);
      var caminho = "empresas/" + c.id + "/documentos/" + arquivoId + "/arquivo";
      FB.storage.ref(caminho).delete().catch(function (e) {
        /* Arquivo que já não existe não é erro: o registro ainda
           precisa sair, senão a tela segue mostrando o que não há. */
        if (e && e.code === "storage/object-not-found") return null;
        throw e;
      }).then(function () {
        var reg = c.dados.itens[chave] || {};
        var restantes = (reg.arquivos || []).filter(function (a) { return a.id !== arquivoId; });
        return FB.db.collection("empresas").doc(c.id)
          .collection("itens").doc(global.Nuvem.codificar(chave))
          .set({ arquivos: restantes, atualizadoEm: Date.now() }, { merge: true })
          .then(function () {
            c.dados.itens[chave] = reg;
            reg.arquivos = restantes;
            /* A trilha de auditoria não é escrita aqui: a função
               `auditarItem` observa a gravação acima e registra
               sozinha, com poder de administrador. Anotar daqui
               seria uma segunda versão do mesmo fato, e a de cá
               poderia falhar calada. */
            desenharFicha();
            atualizarContadores();
            if ((location.hash || "").indexOf("pendencias") > -1) desenharPendencias();
            UI.toast("Arquivo apagado. O cliente vê o documento como pendente.", "ok", 7000);
          });
      }).catch(function (e) {
        UI.toast("Não foi possível apagar: " + FB.explicar(e), "erro", 9000);
      });
    });
  }

  /* Só oferece decidir sobre o que chegou. Documento que nunca foi
     enviado não tem o que aprovar — ali o caminho é cobrar. */
  function acoesDeRevisao(c, chave, sit) {
    if (["enviado", "analise", "aprovado", "pendencia"].indexOf(sit) === -1) return "";
    /* `data-emp` viaja junto porque estes botões agora aparecem
       fora da ficha, onde não há "cliente aberto" para deduzir. */
    var emp = ' data-emp="' + U.escAttr(c.id) + '"';
    return (sit !== "aprovado"
        ? '<button type="button" class="btn btn--primary btn--sm" data-aprovar="' +
          U.escAttr(chave) + '"' + emp + '>Aprovar</button>' : '') +
      '<button type="button" class="btn btn--ghost btn--sm" data-pendencia="' +
        U.escAttr(chave) + '"' + emp + '>' +
        (sit === "pendencia" ? "Trocar o motivo" : "Pedir correção") +
      '</button>';
  }

  /* O que este grupo tem esperando a equipe. É o que aparece no
     cabeçalho quando o bloco está fechado. */
  function atencaoDoGrupo(c, g) {
    var conferir = 0, correcao = 0, respondida = 0;
    var alvos = g.escopo === "socio"
      ? c.dados.socios.map(function (s) { return s.id; })
      : [null];
    alvos.forEach(function (socioId) {
      g.itens.forEach(function (item) {
        var chave = global.Situacao.chaveItem(g.id, item.id, socioId);
        var sit = global.Situacao.de(c.dados, g, item, socioId);
        if (sit === "enviado") conferir++;
        if (sit === "pendencia") {
          /* Correção respondida não espera mais o cliente: espera
             NÓS. Contar as duas juntas escondia trabalho nosso
             dentro de um número que parecia ser dele. */
          if (((c.dados.itens || {})[chave] || {}).obs) respondida++;
          else correcao++;
        }
      });
    });
    return { conferir: conferir, correcao: correcao, respondida: respondida };
  }

  /* UM SELO SÓ, COM AS QUANTIDADES.

     Mostrava um estado por vez: com dois documentos para conferir e
     um devolvido, aparecia só "2 para conferir" e a correção sumia
     do cabeçalho. Com um documento acertava por sorte; com dois,
     escondia metade.

     Dois ou três selos lado a lado resolveriam e encheriam a linha.
     Um selo com os números resolve no mesmo espaço. */
  function seloDeAtencao(atencao, resumo) {
    var partes = [];
    if (atencao.conferir) partes.push(atencao.conferir + " para conferir");
    if (atencao.respondida) partes.push(atencao.respondida + " respondido" +
      (atencao.respondida > 1 ? "s" : ""));
    if (atencao.correcao) partes.push(atencao.correcao + " aguardando");

    if (partes.length) {
      /* Vermelho só quando o que sobra é do cliente. Enquanto
         houver coisa nossa na fila, o selo é azul: é trabalho, não
         cobrança. */
      var soDoCliente = !atencao.conferir && !atencao.respondida;
      return { texto: partes.join(" · "),
               cls: soDoCliente ? "badge--pendencia" : "badge--analise" };
    }
    if (resumo.completo) return { texto: "Completo", cls: "badge--aprovado" };
    return { texto: "", cls: "badge--analise" };
  }

  /* Erro ao montar a ficha não pode virar "cliquei e não
     aconteceu nada".

     Sem isto, qualquer exceção no meio da montagem deixa a tela
     exatamente como estava — e quem clicou conclui que o botão
     está quebrado, sem nenhuma pista do que houve. Um erro
     visível vale mais que uma tela imóvel. */
  function desenharFicha() {
    try { montarFicha(); }
    catch (e) {
      var caixa = $("#clFicha");
      if (caixa) {
        caixa.innerHTML = '<div class="card card--pad"><div class="notice notice--warn">' +
          '<span class="notice__icon">' + ic("ic-alert") + '</span>' +
          '<span><strong>Não foi possível montar esta tela.</strong> ' +
          U.esc((e && e.message) || "erro desconhecido") +
          ' — recarregue a página e, se repetir, me avise com esta mensagem.</span></div></div>';
      }
      if (global.console && console.error) console.error("desenharFicha:", e);
    }
  }

  function montarFicha() {
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
        /* A ficha em papel: para levar à visita, anexar no e-mail
           ou arquivar no processo do cliente. Senhas não entram —
           ver js/ficha-pdf.js. */
        '<button type="button" class="btn btn--quiet btn--sm" id="clFichaPDF">' +
          ic("ic-download") + 'Ficha em PDF</button>' +
        /* O dossie e outro documento: nao e o retrato de agora, e
           o registro de como a empresa entrou. Vai para a pasta do
           cliente e nao muda mais. */
        '<button type="button" class="btn btn--quiet btn--sm" id="clDossie">' +
          ic("ic-scroll") + 'Dossiê de entrada</button>' +
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
      '';

    /* ============================================================
       A FILA DE CONFERÊNCIA (modelo C, escolhido em 26/08/2026)

       Antes isto era um `bloco()` — o mesmo cartão de Societário,
       Contábil e Fiscal, com a mesma moldura e o mesmo ícone. O
       bloco que comanda a ficha tinha exatamente o peso visual dos
       que ele deveria comandar, e quem abria a tela para trabalhar
       não tinha por onde saber que se começa ali.

       Agora não tem moldura: é uma tabela solta, com cabeçalho
       próprio e um botão de recolher. Uma linha por documento,
       ações à direita. A forma diferente é o que diz quem manda.
       ============================================================ */
    function faltaHTML(c, pendentes, est) {
      return blocoFila({
        id: "falta", titulo: "Precisa de você",
        resumo: pendentes.length
          ? "Correções pedidas primeiro, depois os obrigatórios"
          : "Tudo o que era obrigatório já chegou",
        selo: pendentes.length ? pendentes.length + " " +
          U.plural(pendentes.length, "documento", "documentos") : "",
        seloCls: est.resumo.pendencias ? "badge--pendencia" : "badge--pendente",
        acao: pendentes.length
          ? '<button type="button" class="btn btn--quiet btn--sm" id="clCobrar" ' +
            'title="Portal, WhatsApp ou e-mail — você escolhe na próxima tela">' +
            ic("ic-send") + 'Cobrar tudo</button>'
          : '',
        corpo: function () {
          if (!pendentes.length) {
            /* Aqui o trabalho passou a ser NOSSO, e é o único ponto
               da ficha em que isso fica visível. Sem este botão a
               `etapa` da empresa nunca saía de "boas-vindas" e o
               cliente ficava para sempre na tela "em análise pela
               Totali", esperando uma palavra que ninguém tinha como
               dar. */
            if (c.empresa.etapa === "ativo") {
              return '<p class="text-sm text-muted">Nada pendente, e a migração já foi ' +
                'concluída. O cliente vê o portal como ativo.</p>';
            }
            return '<p class="text-sm text-muted" style="margin-top:0">Nada pendente — tudo o ' +
                'que era obrigatório já chegou ou foi dispensado. Enquanto a migração não for ' +
                'concluída, o cliente continua vendo <strong>"em análise pela Totali"</strong>.</p>' +
              '<button type="button" class="btn btn--primary btn--sm" id="clConcluir">' +
                ic("ic-check") + 'Concluir migração</button>';
          }
          /* Um botão só, que abre as três vias. Antes dizia
             "Cobrar pelo portal" e escondia que havia outras. */
          return tabelaDeConferencia(c, pendentes, "resumo");
        }
      });
    }

    /* ---- Cadastro, em painel aberto ---- */
    function painelCadastro() {
      return painel({
        icone: "ic-building", titulo: "Cadastro e contato",
        resumo: est.cadastroOk ? "" : "Faltam dados do responsável",
        acao: '<button type="button" class="btn btn--quiet btn--sm" id="clEditarCadastro">' +
              'Editar</button>',
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
      });
    }

    /* Sócios eram só de leitura aqui, e isso deixava a equipe
       dependente do cliente para corrigir um nome errado ou tirar
       um sócio que saiu da sociedade. Como cada sócio cadastrado
       cria uma lista inteira de documentos, um sócio a mais trava
       o progresso do cliente por um erro que ele não sabe desfazer.

       Agora a equipe cadastra, corrige e remove daqui. A regra do
       Firestore já permitia (`equipeOuDono`); faltava a tela. */
    function painelSocios() {
      return painel({
        icone: "ic-badge", titulo: "Sócios",
        resumo: c.dados.socios.length
          ? c.dados.socios.length + " " + U.plural(c.dados.socios.length, "cadastrado", "cadastrados")
          : "Nenhum cadastrado",
        corpo: function () {
          return (c.dados.socios.length
            ? c.dados.socios.map(function (s) {
                return '<div class="item"><div class="item__top">' +
                  '<div class="item__main">' +
                    '<div class="item__name">' + U.esc(s.nome || "Sócio") + '</div>' +
                    '<div class="text-xs text-muted">' + U.esc(s.cpf || "sem CPF") + '</div>' +
                  '</div>' +
                  '<div class="item__actions">' +
                    '<button type="button" class="btn btn--ghost btn--sm" data-socio-editar="' +
                      U.escAttr(s.id) + '">Editar</button>' +
                    '<button type="button" class="btn btn--quiet btn--sm" data-socio-remover="' +
                      U.escAttr(s.id) + '">Remover</button>' +
                  '</div>' +
                '</div></div>';
              }).join("")
            : '<p class="text-sm text-muted">Nenhum sócio cadastrado — a lista de documentos ' +
              'de sócio ainda não existe para este cliente.</p>') +
            '<div class="row" style="margin-top:12px">' +
              '<button type="button" class="btn btn--ghost btn--sm" data-socio-novo="1">' +
                ic("ic-plus") + 'Adicionar sócio</button>' +
            '</div>';
        }
      });
    }

    /* ---- Montagem por vista ---- */
    html += abasFichaHTML(c);

    if (vistaFicha === "documentos") {
      html += faltaHTML(c, pendentes, est) +
        '<div class="ficha__titulo">Documentos' +
          /* A ficha é carregada uma vez e fica parada. Documento que
             o cliente envia agora só aparece aqui depois de recarregar
             a página inteira — e quem está conferindo não tem por que
             adivinhar que precisa fazer isso. */
          '<button type="button" class="btn btn--quiet btn--sm" id="clRecarregar">' +
            ic("ic-refresh") + 'Atualizar</button>' +
          '<button type="button" class="btn btn--quiet btn--sm" id="clAplicacao">' +
            'Quais se aplicam</button>' +
        '</div>' +
        DATA.GRUPOS.map(function (g) { return grupoHTML(c, g); }).join("");
    }

    if (vistaFicha === "financeiro") {
      html += '<div class="paineis">' +
          financeiroHTML(c) +
          credenciaisHTML(c) +
        '</div>';
    }

    if (vistaFicha === "cadastro") {
      html += '<div class="paineis">' +
          painelCadastro() +
          painelSocios() +
          acessoHTML(c) +
          notasHTML(c) +
        '</div>' +
        zonaDeRiscoHTML(c);
    }

    if (vistaFicha === "conversa") {
      html += mensagensHTML(c);
    }

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
    var s = seloDeAtencao(atencao, resumo);
    var selo = s.texto, seloCls = s.cls;

    return bloco({
      id: "grupo:" + g.id, icone: g.icone, titulo: g.titulo,
      /* O trilho colorido à esquerda do cartão: diz a situação
         mais urgente que existe lá dentro, para achar trabalho
         percorrendo a página sem ler nada. */
      classe: "trilho trilho--" + trilhoDoGrupo(c, g),
      resumo: alvos.length
        ? resumo.ok + " de " + resumo.total +
          (c.dados.gruposNA[g.id] ? " · marcado como não se aplica" : "")
        : "Depende dos sócios, e nenhum foi cadastrado",
      selo: selo, seloCls: seloCls,
      corpo: function () { return porQuemTemABola(c, g); }
    });
  }

  /* ============================================================
     Documentos agrupados por QUEM TEM A BOLA

     Antes a ficha era organizada por departamento, e dentro de
     cada um vinha tudo junto: o que já foi aprovado, o que
     chegou esperando conferência e o que nunca veio, todos com o
     mesmo peso. Para achar trabalho, a pessoa abria departamento
     por departamento e lia item por item.

     Agora a pergunta que organiza a tela é outra: quem precisa
     agir?

       Esperando você   chegou e ninguém conferiu — É A SUA FILA
       Com o cliente    falta, ou voltou para correção
       Concluído        resolvido; fica embaixo e recuado

     O departamento não sumiu: virou a linha de apoio de cada
     item, que é o peso certo para ele. Saber que um documento é
     do Fiscal importa depois de saber que ele espera você.
     ============================================================ */
  var SECOES = [
    { id: "voce",    rot: "Esperando você", cor: "voce",
      sits: ["enviado", "analise"] },
    { id: "cliente", rot: "Com o cliente",  cor: "cliente",
      sits: ["pendencia", "pendente"] },
    { id: "pronto",  rot: "Concluído",      cor: "pronto",
      sits: ["aprovado", "substituido", "na"] }
  ];

  /* A linha de apoio de cada item: departamento e, quando existe,
     o dado que decide a ordem de atacar — há quanto tempo espera,
     quando a correção foi pedida, o que o cliente combinou. */
  function apoioDoItem(c, x) {
    var partes = [x.g.titulo];
    if (x.socio) partes.push(x.socio.nome || "sócio");

    if (x.sit === "enviado" || x.sit === "analise") {
      if (x.em) partes.push("chegou " + faz(x.em));
    } else if (x.sit === "pendencia") {
      var rev = (c.dados.itens[x.chave] || {}).revisao || {};
      if (rev.em) partes.push("correção pedida " + faz(emMs(rev.em) || rev.em));
    } else if (x.sit === "pendente") {
      var ms = ((c.dados.itens[x.chave] || {}).lembrete) || 0;
      if (ms) {
        partes.push(ms <= Date.now()
          ? "o cliente prometeu para " + U.dataCurta(ms)
          : "o cliente marcou para " + U.dataCurta(ms));
      } else if (!x.obrigatorio) {
        partes.push("opcional");
      }
    }
    return partes.join(" · ");
  }

  function faz(ms) {
    if (!ms) return "";
    var dias = Math.floor((Date.now() - ms) / DIA);
    if (dias <= 0) return "hoje";
    if (dias === 1) return "ontem";
    if (dias < 7) return "há " + dias + " dias";
    if (dias < 14) return "há uma semana";
    if (dias < 60) return "há " + Math.floor(dias / 7) + " semanas";
    return "há " + Math.floor(dias / 30) + " meses";
  }

  /* Os itens de UM departamento, já divididos em Esperando você /
     Com o cliente / Concluído. É o miolo do cartão. */
  function porQuemTemABola(c, g) {
    var alvos = g.escopo === "socio"
      ? c.dados.socios.map(function (s) { return s.id; })
      : [null];

    var todos = [];
    alvos.forEach(function (socioId) {
      var socio = socioId
        ? c.dados.socios.filter(function (s) { return s.id === socioId; })[0]
        : null;
      g.itens.forEach(function (item) {
        var sit = global.Situacao.de(c.dados, g, item, socioId);
        var chave = global.Situacao.chaveItem(g.id, item.id, socioId);
        var reg = c.dados.itens[chave] || {};
        todos.push({
          g: g, item: item, socio: socio, sit: sit, chave: chave,
          em: emMs(reg.atualizadoEm) || 0, obrigatorio: !!item.obrigatorio
        });
      });
    });

    if (!todos.length) {
      return '<p class="text-sm text-muted">Este departamento tem um documento por sócio, ' +
        'e o cliente ainda não cadastrou nenhum.</p>';
    }

    var html = "";
    SECOES.forEach(function (sec) {
      var lista = todos.filter(function (x) { return sec.sits.indexOf(x.sit) > -1; });
      if (!lista.length) return;

      /* Dentro da faixa, o mais antigo primeiro: é o que espera há
         mais tempo, e portanto o que mais atrasa. */
      lista.sort(function (a, b) {
        if (!a.em && !b.em) return 0;
        if (!a.em) return 1;
        if (!b.em) return -1;
        return a.em - b.em;
      });

      html += '<div class="bola bola--' + sec.cor + '">' +
        '<div class="bola__faixa">' +
          '<span class="bola__pt"></span>' +
          '<span class="bola__t">' + U.esc(sec.rot) + '</span>' +
          '<span class="bola__n">' + lista.length + '</span>' +
          '<span class="bola__linha"></span>' +
          (sec.id === "voce"
            ? '<button type="button" class="btn btn--primary btn--sm" data-aprovar-grupo="' +
              U.escAttr(g.id) + '">Aprovar ' + lista.length + '</button>'
            : '') +
        '</div>' +
        '<div class="bola__corpo">' +
          lista.map(function (x) {
            return itemHTML(c, x.g, x.item, x.socio, apoioDoItem(c, x));
          }).join("") +
        '</div>' +
      '</div>';
    });

    return html;
  }

  /* A cor do trilho do cartão: a situação MAIS URGENTE que existe
     dentro dele. Correção vence conferência, que vence pendente. */
  function trilhoDoGrupo(c, g) {
    var atencao = atencaoDoGrupo(c, g);
    if (atencao.correcao) return "corr";
    if (atencao.conferir) return "conf";
    var resumo = global.Situacao.resumoGrupo(c.dados, g);
    if (resumo.completo && !resumo.vazio) return "ok";
    if (c.dados.gruposNA[g.id] || resumo.vazio) return "na";
    return "pend";
  }

  function itemHTML(c, g, item, socio, apoio) {
    var chave = global.Situacao.chaveItem(g.id, item.id, socio ? socio.id : null);
    var sit = global.Situacao.de(c.dados, g, item, socio ? socio.id : null);
    var reg = c.dados.itens[chave] || {};
    var arquivos = reg.arquivos || [];
    var rev = reg.revisao || {};

    var corpo = "";
    if (arquivos.length) {
      corpo += '<div class="arqs">' + arquivos.map(function (a) {
        return '<span class="arq-par">' +
          '<button type="button" class="arq" data-abrir="' + U.escAttr(a.id) + '" ' +
            'data-emp="' + U.escAttr(c.id) + '" data-nome="' + U.escAttr(a.nome) + '">' +
            ic(U.iconePorExtensao(U.extensao(a.nome))) +
            '<span class="arq__n">' + U.esc(a.nome) + '</span>' +
            '<span class="arq__t">' + U.esc(U.bytes(a.tamanho)) + '</span></button>' +
          '<button type="button" class="arq-x" data-remover-doc="' + U.escAttr(chave) +
            '" data-arq="' + U.escAttr(a.id) + '" data-emp="' + U.escAttr(c.id) +
            '" data-nome="' + U.escAttr(a.nome) + '" ' +
            'title="Apagar este arquivo" aria-label="Apagar ' + U.escAttr(a.nome) + '">' +
            ic("ic-trash") + '</button>' +
        '</span>';
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
    /* A resposta do cliente a uma correção, quando ele diz que o
       documento já está certo em vez de reenviar. Fica em destaque
       porque é a informação que decide se a correção procede — e
       quem abre este item está justamente decidindo isso. */
    if (reg.obs) {
      corpo += '<div class="notice notice--info" style="margin-top:8px;padding:10px 12px;font-size:12.5px">' +
        '<span class="notice__icon">' + ic("ic-chat") + '</span>' +
        '<span><strong>O cliente respondeu:</strong> ' + U.esc(reg.obs) + '</span></div>';
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

    /* `data-item` é a âncora de "Ver documento", lá no resumo. */
    return '<div class="item" data-item="' + U.escAttr(chave) + '"><div class="item__top">' +
      '<span class="group__icon">' + ic(g.icone) + '</span>' +
      '<div class="item__main">' +
        '<div class="item__name">' + U.esc(item.nome) + '</div>' +
        /* O departamento e o tempo de espera vêm aqui, em voz
           baixa: importam depois de a pessoa saber que este
           documento é dela. */
        (apoio
          ? '<div class="item__apoio">' + U.esc(apoio) + '</div>'
          : (socio ? '<div class="item__apoio">' + U.esc(socio.nome || "sócio") + '</div>' : '')) +
        '<div class="item__row">' + badge(ROTULO_SITUACAO, sit) +
          (item.obrigatorio ? '<span class="text-xs text-muted">obrigatório</span>' : '') +
        '</div>' +
        corpo + acoes +
      '</div>' +
    '</div></div>';
  }

  /* "" não é "não": em branco quer dizer que o cliente ainda não
     respondeu, e a ficha precisa mostrar essa diferença. */
  function simNao(v) {
    return v === "sim" ? "Sim" : v === "nao" ? "Não" : "";
  }

  /* ---------- Financeiro ---------- */
  function financeiroHTML(c) {
    var f = c.financeiro;

    return painel({
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
          /* Informativo. Aparece separado do resto porque é de
             outra natureza: não é documento entregue, é o que a
             contabilidade precisa saber antes de fechar o mês. */
          '<hr class="hr">' +
          linhaDado("Relatório de contas pagas", simNao(f.contasPagas)) +
          (f.contasPagas === "sim"
            ? linhaDado("Qual sistema", f.contasPagasSistema)
            : "") +
          linhaDado("Empréstimo ou financiamento", simNao(f.emprestimo)) +
          linhaDado("Aplicações financeiras", simNao(f.aplicacoes)) +
          '<hr class="hr">' +
          linhaDado("Observações", f.observacoes) +
          (f.termo && f.termo.id
            ? '<div class="row" style="margin-top:12px">' +
              '<button type="button" class="btn btn--ghost btn--sm" data-abrir="' +
                U.escAttr(f.termo.id) + '" data-emp="' + U.escAttr(c.id) + '" data-nome="' +
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

    return painel({
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
          /* Uma pessoa, várias empresas: é comum o mesmo dono ter
             dois ou três CNPJs. Sem isto, cada empresa exigia um
             login diferente e a pessoa acabava com três senhas
             para a mesma contabilidade. */
          (acessos.length
            ? '<button type="button" class="btn btn--ghost btn--sm" data-vincular="' +
              U.escAttr(c.id) + '">' + ic("ic-building") + 'Dar acesso a outra empresa</button>'
            : '') +
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

  /* ============================================================
     Dar a um acesso existente a entrada em outra empresa

     É comum o mesmo dono ter dois ou três CNPJs. Até agora cada
     empresa exigia um convite e um login separados, e a pessoa
     terminava com três senhas para a mesma contabilidade — e a
     equipe, com três fichas que não se falavam.

     O que isto faz é escrever os dois registros que o portal usa
     para saber quem entra onde:

       /empresas/{outra}/acessos/{uid}      a autorização
       /clientes/{uid}/empresas/{outra}     o índice, que é como
                                            o portal descobre a
                                            lista no login

     A REGRA DO SERVIDOR NÃO DEIXA O CLIENTE FAZER ISTO — criar
     um acesso exige apresentar um código de convite válido. Mas
     a equipe pode: `allow create: if ehEquipe()` vale para os
     dois caminhos. É o que torna esta tela possível sem afrouxar
     nada para o lado do cliente.
     ============================================================ */
  function vincularOutraEmpresa(c) {
    var acessos = c.acessos || [];
    if (!acessos.length) {
      UI.toast("Este cliente ainda não tem acesso ao portal. Gere um link primeiro.", "erro", 8000);
      return;
    }

    /* Empresas que este acesso ainda NÃO tem. Mostrar as que ele
       já tem só daria chance de clicar à toa. */
    var jaTem = {};
    jaTem[c.id] = true;

    var candidatas = empresas.filter(function (e) {
      if (jaTem[e.id]) return false;
      if (arquivada(e)) return false;
      return true;
    });

    if (!candidatas.length) {
      UI.toast("Não há outra empresa ativa para vincular.", "", 7000);
      return;
    }

    var m = UI.modal({
      titulo: "Dar acesso a outra empresa",
      corpoHTML:
        '<p style="font-size:13.5px;line-height:1.65;color:var(--txt-2);margin-bottom:14px">' +
          'A mesma pessoa passa a ver as duas empresas no portal, com <strong>um login só</strong>, ' +
          'e troca entre elas por um seletor no topo. Nada do que já foi enviado se mexe.</p>' +
        '<div class="field">' +
          '<label class="field__label" for="vqQuem">Quem ganha o acesso</label>' +
          '<select class="select" id="vqQuem">' +
            acessos.map(function (a) {
              return '<option value="' + U.escAttr(a.uid) + '">' +
                U.esc(a.email || a.uid) + '</option>';
            }).join("") +
          '</select></div>' +
        '<div class="field" style="margin-bottom:0">' +
          '<label class="field__label" for="vqEmpresa">Empresa</label>' +
          '<select class="select" id="vqEmpresa">' +
            candidatas.map(function (e) {
              return '<option value="' + U.escAttr(e.id) + '">' + U.esc(nomeDe(e)) +
                (e.empresa.cnpj ? " · " + U.esc(e.empresa.cnpj) : "") + '</option>';
            }).join("") +
          '</select>' +
          '<div class="field__hint">Só aparecem empresas ativas que este acesso ainda não ' +
            'enxerga.</div></div>',
      acoes: [
        { rotulo: "Cancelar", classe: "btn--ghost" },
        {
          rotulo: "Dar acesso", classe: "btn--primary", fecharAntes: false,
          onClick: function () {
            var uid = $("#vqQuem", m.caixa).value;
            var alvo = $("#vqEmpresa", m.caixa).value;
            var email = (acessos.filter(function (a) { return a.uid === uid; })[0] || {}).email || uid;
            var nomeAlvo = nomeDe(empresas.filter(function (e) { return e.id === alvo; })[0] || {});
            gravarVinculo(uid, email, alvo, nomeAlvo, m);
          }
        }
      ]
    });
  }

  function gravarVinculo(uid, email, empresaId, nomeAlvo, m) {
    var botao = $('[data-acao="1"]', m.caixa);
    if (botao) { botao.disabled = true; botao.textContent = "Dando acesso…"; }

    var lote = FB.db.batch();
    lote.set(FB.db.collection("empresas").doc(empresaId).collection("acessos").doc(uid),
             { em: FB.agora(), porEquipe: (equipe && equipe.uid) || "" }, { merge: true });
    lote.set(FB.db.collection("clientes").doc(uid).collection("empresas").doc(empresaId),
             { em: FB.agora() }, { merge: true });

    lote.commit().then(function () {
      UI.fecharModal();
      UI.toast(email + " agora também acessa " + nomeAlvo +
               ". Ele troca de empresa pelo seletor no topo do portal.", "ok", 9000);
      /* A ficha aberta mostra os acessos; recarregar o cliente é
         o que faz o novo vínculo aparecer sem F5. */
      var id = aberto && aberto.id;
      if (id) {
        carregarCliente(id).then(function (novo) {
          empresas = empresas.map(function (x) { return x.id === id ? novo : x; });
          aberto = novo;
          desenharFicha();
        }, function () {});
      }
    }, function (e) {
      if (botao) { botao.disabled = false; botao.textContent = "Dar acesso"; }
      UI.toast("Não foi possível dar o acesso: " + FB.explicar(e), "erro", 9000);
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
            onClick: function () { global.Convite.copiar(r.mensagem, "Mensagem copiada."); }
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
  /* =========================================================
     Anotação interna

     O que a equipe precisa lembrar e o cliente não pode ler:
     "o contador anterior não entrega o balanço", "só atende
     depois das 18h", "o sócio 2 está em processo de saída".
     Hoje isso vive no WhatsApp de quem atendeu e some quando
     essa pessoa está de férias.

     Fica numa subcoleção própria, /notas, e a regra do servidor
     só deixa a EQUIPE ler e escrever — não é campo escondido na
     empresa, que o cliente já lê inteira. A separação é o que
     torna a promessa verdadeira: mesmo que a tela errasse, o
     servidor não entrega.
     ========================================================= */
  function notasHTML(c) {
    var notas = (c.notas || []).slice().sort(function (a, b) {
      return (b.em || 0) - (a.em || 0);
    });

    return painel({
      id: "notas", icone: "ic-scroll", titulo: "Anotações internas",
      resumo: notas.length
        ? notas.length + " " + U.plural(notas.length, "anotação", "anotações") +
          " · o cliente nunca vê"
        : "Nada anotado ainda · o cliente nunca vê",
      selo: notas.length ? String(notas.length) : "",
      seloCls: "badge--analise",
      corpo: function () {
        return '<div class="notice notice--info" style="margin-bottom:14px;padding:10px 12px;' +
            'font-size:12.5px">' +
            '<span class="notice__icon">' + ic("ic-lock") + '</span>' +
            '<span>Só a equipe da Totali lê o que estiver aqui. Não aparece no portal do ' +
            'cliente nem na ficha em PDF.</span>' +
          '</div>' +
          (notas.length
            ? '<div class="notas">' + notas.map(function (n) {
                return '<div class="nota">' +
                  '<div class="nota__txt">' + U.paragrafos(n.texto || "") + '</div>' +
                  '<div class="nota__pe">' +
                    '<span class="text-xs text-muted">' + U.esc(n.por || "equipe") + ' · ' +
                      U.esc(U.dataHora(n.em)) + '</span>' +
                    '<button type="button" class="btn btn--quiet btn--sm" data-apagar-nota="' +
                      U.escAttr(n.id) + '">Apagar</button>' +
                  '</div>' +
                '</div>';
              }).join("") + '</div>'
            : '') +
          '<div class="field" style="margin-top:14px;margin-bottom:8px">' +
            '<label class="field__label" for="clNota">Nova anotação</label>' +
            '<textarea class="textarea" id="clNota" rows="3" maxlength="2000" ' +
              'placeholder="O que a próxima pessoa que atender este cliente precisa saber…">' +
            '</textarea>' +
          '</div>' +
          '<button type="button" class="btn btn--primary btn--sm" id="clSalvarNota">' +
            ic("ic-plus") + 'Anotar</button>';
      }
    });
  }

  function salvarNota(texto) {
    var c = aberto;
    var t = String(texto || "").trim().slice(0, 2000);
    if (!c || !t) return;

    var id = (global.U.uid && global.U.uid()) ||
             String(Date.now()) + Math.floor(Math.random() * 1e6);
    var nota = {
      texto: t,
      por: (equipe && (equipe.nome || equipe.email)) || "equipe",
      em: Date.now()
    };

    FB.db.collection("empresas").doc(c.id).collection("notas").doc(id).set(nota)
      .then(function () {
        nota.id = id;
        if (!c.notas) c.notas = [];
        c.notas.push(nota);
        desenharFicha();
        UI.toast("Anotado.", "ok", 2500);
      }, function (e) {
        UI.toast("Não foi possível anotar: " + FB.explicar(e), "erro", 9000);
      });
  }

  function apagarNota(id) {
    var c = aberto;
    if (!c) return;
    UI.confirmar({
      titulo: "Apagar anotação",
      mensagem: "A anotação some para toda a equipe e não tem como voltar.",
      confirmar: "Apagar", perigo: true
    }).then(function (ok) {
      if (!ok) return;
      FB.db.collection("empresas").doc(c.id).collection("notas").doc(id).delete()
        .then(function () {
          c.notas = (c.notas || []).filter(function (n) { return n.id !== id; });
          desenharFicha();
          UI.toast("Anotação apagada.", "ok", 2500);
        }, function (e) {
          UI.toast("Não foi possível apagar: " + FB.explicar(e), "erro", 9000);
        });
    });
  }

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

  /* Encerrar a migração: a única coisa que faz a `etapa` da empresa
     sair de "boas-vindas".

     Vai direto para "ativo", e não para "analise-ok" antes. O
     estado intermediário existe no modelo, mas ninguém tem o que
     fazer nele: quando a equipe chega aqui, a análise já aconteceu
     — foi ela que aprovou os documentos. Um botão a mais só faria
     a pessoa clicar duas vezes para dizer a mesma coisa. */
  function concluirMigracao(c) {
    UI.confirmar({
      titulo: "Concluir a migração de " + nomeDe(c),
      mensagem: "O cliente passa a ver a migração como encerrada e o portal como ativo. " +
                "Faça isso quando a documentação já tiver sido conferida — é a palavra final " +
                "da Totali, e é ela que o cliente está esperando.",
      confirmar: "Concluir migração"
    }).then(function (ok) {
      if (!ok) return;
      FB.db.collection("empresas").doc(c.id)
        .set({ etapa: "ativo", atualizadoEm: Date.now() }, { merge: true })
        .then(function () {
          UI.toast("Migração de " + nomeDe(c) + " concluída. O cliente já vê o portal ativo.",
                   "ok", 8000);
          return carregarCliente(c.id).then(function (novo) {
            empresas = empresas.map(function (x) { return x.id === c.id ? novo : x; });
            aberto = novo;
            desenharFicha();
            carregarLista();
          }, function () { /* a gravação valeu; a tela se recompõe no próximo carregamento */ });
        }, function (e) {
          UI.toast("Não foi possível concluir: " + FB.explicar(e), "erro", 9000);
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
  var ESPERA_FUNCAO_MS = 20000;

  function excluirContasDeAcesso(uids) {
    if (!uids || !uids.length) return Promise.resolve({ disponivel: true, apagadas: [] });

    var u = FB.auth && FB.auth.currentUser;
    if (!u) return Promise.resolve({ disponivel: false, apagadas: [] });

    var ref = FB.db.collection("exclusoesDeConta").doc();

    return ref.set({
      uids: uids,
      pedidoPor: u.uid,
      pedidoEm: FB.agora()
    }).then(function () {
      /* Fica ouvindo o próprio pedido até o servidor escrever o
         resultado nele. Com teto de tempo: se a função não estiver
         publicada, ninguém responde, e travar a tela esperando
         seria pior do que avisar. */
      return new Promise(function (resolve) {
        var pronto = false;
        var parar = ref.onSnapshot(function (d) {
          var v = d.data() || {};
          if (!v.concluidoEm || pronto) return;
          pronto = true;
          parar();
          resolve({
            disponivel: !v.erro,
            apagadas: v.apagadas || [],
            recusadas: v.recusadas || [],
            erro: v.erro || ""
          });
        }, function () {
          if (pronto) return;
          pronto = true;
          resolve({ disponivel: false, apagadas: [] });
        });

        setTimeout(function () {
          if (pronto) return;
          pronto = true;
          try { parar(); } catch (e) {}
          resolve({ disponivel: false, apagadas: [] });
        }, ESPERA_FUNCAO_MS);
      });
    }).catch(function () {
      /* Sem permissão, sem rede: dá no mesmo — a conta continua lá
         e quem resolve é a equipe, com o aviso da tela. */
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
            : 'A conta de acesso do cliente, porém, fica no Firebase Authentication. ' +
              'O pedido de exclusão foi registrado, mas o servidor não respondeu — ' +
              'confira se a função <code>processarExclusaoDeConta</code> está publicada.') +
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

  /* Desce a pasta do Storage e apaga o que houver, venha de onde
     vier. `listAll` devolve arquivos (`items`) e pastas
     (`prefixes`); só as pastas precisam de nova descida.

     A profundidade real é 3 (documentos/{id}/arquivo), e o limite
     existe para o caso de alguém criar uma estrutura mais funda um
     dia — nenhuma varredura deve poder rodar para sempre.

     Falha não derruba a exclusão: é melhor a empresa sair do
     sistema com um arquivo pendente do que ficar meio apagada. Mas
     o que não saiu é DEVOLVIDO, não engolido — quem chamou decide
     se avisa. */
  function varrerPasta(caminho, fundo) {
    var nivel = fundo || 0;
    if (nivel > 6) return Promise.resolve([caminho + " (fundo demais)"]);

    return FB.storage.ref(caminho).listAll().then(function (r) {
      var sobras = [];
      var arquivos = r.items.map(function (item) {
        return item.delete().catch(function () { sobras.push(item.fullPath); });
      });
      var pastas = r.prefixes.map(function (p) {
        return varrerPasta(p.fullPath, nivel + 1).then(function (s) {
          sobras = sobras.concat(s);
        });
      });
      return Promise.all(arquivos.concat(pastas)).then(function () { return sobras; });
    }, function () {
      /* Sem permissão de listar (regra antiga ainda publicada) ou
         sem rede. Não é motivo para abortar. */
      return [caminho + " (não deu para listar)"];
    });
  }

  /* Apaga tudo, na ordem que não deixa buraco. */
  function excluirDeVez(c) {
    var raiz = FB.db.collection("empresas").doc(c.id);
    var subcolecoes = ["itens", "socios", "mensagens", "credenciais", "financeiro",
                       "eventos", "notas"];

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
      })).then(function () {
        /* 2b. E agora VARRE A PASTA INTEIRA.

           O passo acima apaga o que conhecemos pelos metadados. Só
           que arquivo que subiu e cuja gravação no Firestore falhou
           não tem metadado nenhum — e ficava no bucket para sempre,
           invisível para o sistema que prometeu apagá-lo.
           Encontramos um assim em 21/08/2026, de uma empresa
           excluída dias antes.

           Aqui a fonte da verdade passa a ser o próprio Storage. */
        return varrerPasta("empresas/" + c.id);
      });
    }).then(function (sobras) {
      /* Arquivo que resistiu precisa ser DITO. Silêncio aqui vira
         "apagamos tudo" sobre uma exclusão incompleta — e é
         exatamente isso que a gente responde a um cliente que
         pediu para ser esquecido. */
      if (sobras && sobras.length) {
        console.warn("Arquivos que não saíram do Storage:", sobras);
        UI.toast("Atenção: " + sobras.length + " arquivo(s) não saíram do Storage. " +
                 "Anote o nome da empresa e fale comigo — a lista está no console.",
                 "erro", 14000);
      }
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

    var corpo;
    if (!chaves.length) {
      corpo = '<p class="text-sm text-muted">Nenhum acesso enviado por este cliente.</p>';
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
              U.escAttr(chave) + '">Ver senha</button>' +
          '</div>' +
          '<div class="cred__saida" data-cred-saida="' + U.escAttr(chave) + '" hidden></div>' +
        '</div></div>';
      }).join("");
    }

    return painel({
      id: "credenciais", icone: "ic-lock", titulo: "Acessos e senhas",
      resumo: chaves.length
        ? "Toda a equipe pode abrir · cada abertura fica registrada"
        : "Nenhum acesso enviado",
      selo: chaves.length ? chaves.length + " " +
        U.plural(chaves.length, "guardado", "guardados") : "",
      seloCls: "badge--aprovado",
      corpo: function () { return corpo; }
    });
  }

  /* ---------- "Enviar depois", visto de cá ----------

     O cliente pode marcar um dia para voltar num documento. A
     equipe precisa enxergar isso, senão cobra hoje o que ficou
     combinado para sexta — e a cobrança que chega em cima de um
     combinado cumprido é a que faz o cliente parar de responder.

     Vencido o prazo, o selo troca de cor e vira o contrário: é o
     melhor momento para cobrar, porque a própria pessoa já tinha
     dito que aquele era o dia. */
  function combinadoHTML(c, chave) {
    var ms = ((c.dados.itens[chave] || {}).lembrete) || 0;
    if (!ms) return "";
    var venceu = ms <= Date.now();
    return '<span class="text-xs" style="color:' +
      (venceu ? "var(--warn)" : "var(--txt-3)") + ';font-weight:' + (venceu ? "640" : "500") + '">' +
      (venceu ? "prometeu para " + U.esc(U.dataCurta(ms)) + " — venceu"
              : "o cliente marcou para " + U.esc(U.dataCurta(ms))) +
    '</span>';
  }

  /* ============================================================
     Mexendo em documento de outro departamento

     Não é bloqueio — é uma parada. A pessoa pode conferir o que
     for, e num escritório pequeno isso é necessário: alguém cobre
     o colega de férias na sexta à tarde. O que se quer evitar é o
     clique distraído, aquele em que se aprova o documento errado
     por estar na lista errada.

     Vale para APROVAR e para PEDIR CORREÇÃO, que são as duas
     coisas que o cliente vê acontecer. Ler, cobrar e conversar
     não pedem aviso nenhum.

     Devolve promessa: quem chama espera o "pode seguir".
     ============================================================ */
  function conferindoForaDaArea(chaves) {
    var D = global.Departamentos;
    var eu = equipe;
    var fora = (chaves || []).filter(function (k) { return !D.cuidaDaChave(eu, k); });
    if (!fora.length) return Promise.resolve(true);

    var setores = [];
    fora.forEach(function (k) {
      var g = D.grupoDaChave(k);
      if (setores.indexOf(g) === -1) setores.push(g);
    });

    var quantos = fora.length;
    return UI.confirmar({
      titulo: quantos === 1 ? "Documento de outro departamento"
                            : quantos + " documentos de outro departamento",
      mensagem: "Você cuida de " + D.nomesDos(D.meus(eu)) + ", e " +
        (quantos === 1 ? "este documento é de " : "estes documentos são de ") +
        D.nomesDos(setores) + ". Pode seguir — só confirme que é isto mesmo, porque o " +
        "cliente vê o resultado na hora e o seu nome fica registrado nele.",
      confirmar: "Sim, sou eu quem confere"
    });
  }

  /* Baixar um PDF gerado no proprio computador.

     Serve a ficha e ao dossie: os dois montam um blob e devolvem
     { blob, nome }. Eram dois blocos iguais, e o segundo nasceria
     copiado do primeiro -- inclusive o minuto de folga antes de
     soltar o endereco, que existe por um motivo que ninguem
     lembraria ao copiar. */
  function baixarPDF(botao, modulo, cliente, aviso) {
    /* Havia aqui uma guarda `modulo.disponivel()` que nunca barrava
       nada: a função devolvia `true` sempre, de quando a biblioteca
       era carregada junto com a página. Hoje ela é buscada no
       momento do clique, e quem falha é o `garantirJsPDF()` de
       dentro do módulo — a rejeição cai no tratamento lá embaixo,
       com o motivo de verdade. A guarda ainda mandava "atualize a
       página", conselho que não resolveria nada. */
    botao.disabled = true;
    var antes = botao.innerHTML;
    botao.textContent = "Gerando…";

    modulo.gerar(cliente).then(function (r) {
      var url = URL.createObjectURL(r.blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = r.nome;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      /* Um minuto é folga suficiente para o navegador terminar de
         gravar o arquivo antes de o endereço deixar de valer. */
      setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 60000);
      botao.disabled = false;
      botao.innerHTML = antes;
      UI.toast(aviso, "ok", 3000);
    }, function (e) {
      botao.disabled = false;
      botao.innerHTML = antes;
      UI.toast("Não foi possível gerar o PDF: " + ((e && e.message) || "erro"), "erro", 9000);
    });
  }

  /* ============================================================
     Editar o cadastro da empresa

     Razão social, CNPJ e regime são da equipe — o cliente nem vê
     esses campos no portal. Até agora, um CNPJ digitado errado no
     cadastro só se consertava pelo console do Firebase, o que na
     prática queria dizer "não se conserta".

     Os dados do responsável também entram: o cliente preenche,
     mas quem atende costuma descobrir o telefone certo antes dele
     — e ficar esperando o cliente corrigir trava a cobrança.
     ============================================================ */
  function campoTexto(id, rotulo, valor, extra) {
    return '<div class="field">' +
      '<label class="field__label" for="' + id + '">' + U.esc(rotulo) + '</label>' +
      '<input type="text" class="input" id="' + id + '" maxlength="200" autocomplete="off" ' +
        (extra || '') + ' value="' + U.escAttr(valor || "") + '"></div>';
  }

  var REGIMES = ["", "Simples Nacional", "Lucro Presumido", "Lucro Real", "MEI",
                 "Não sei informar"];

  function editarCadastro(c) {
    var e = c.empresa;
    var m = UI.modal({
      titulo: "Editar cadastro",
      corpoHTML:
        campoTexto("edRazao", "Razão social", e.razaoSocial, 'data-focus') +
        campoTexto("edFantasia", "Nome fantasia", e.nomeFantasia) +
        '<div class="grid-2">' +
          campoTexto("edCnpj", "CNPJ", e.cnpj, 'inputmode="numeric" maxlength="18"') +
          '<div class="field">' +
            '<label class="field__label" for="edRegime">Regime tributário</label>' +
            '<select class="select" id="edRegime">' +
              REGIMES.map(function (r) {
                return '<option value="' + U.escAttr(r) + '"' +
                  (String(e.regime || "") === r ? " selected" : "") + '>' +
                  U.esc(r || "Selecione…") + '</option>';
              }).join("") +
            '</select></div>' +
        '</div>' +
        '<hr class="hr">' +
        campoTexto("edRespNome", "Responsável", e.responsavelNome) +
        campoTexto("edRespCargo", "Função", e.responsavelCargo) +
        '<div class="grid-2">' +
          campoTexto("edRespEmail", "E-mail", e.responsavelEmail, 'inputmode="email"') +
          campoTexto("edRespTel", "Telefone", e.responsavelTelefone, 'inputmode="tel"') +
        '</div>' +
        '<div class="field__hint" style="margin-top:4px">O cliente vê o nome fantasia no topo do ' +
          'portal dele. Razão social, CNPJ e regime são só nossos.</div>',
      acoes: [
        { rotulo: "Cancelar", classe: "btn--ghost" },
        {
          rotulo: "Salvar", classe: "btn--primary", fecharAntes: false,
          onClick: function () { salvarCadastro(c, m); }
        }
      ]
    });

    /* Máscara ao digitar, igual à tela de novo cliente — senão o
       mesmo CNPJ fica com pontuação num lugar e sem no outro. */
    var campoCnpj = $("#edCnpj", m.caixa);
    if (campoCnpj) campoCnpj.addEventListener("input", function () {
      campoCnpj.value = U.mascaraCNPJ(campoCnpj.value);
    });
    var campoTel = $("#edRespTel", m.caixa);
    if (campoTel) campoTel.addEventListener("input", function () {
      campoTel.value = U.mascaraTelefone(campoTel.value);
    });
  }

  function salvarCadastro(c, m) {
    var pega = function (id) { return ($(id, m.caixa) || {}).value || ""; };
    var razao = pega("#edRazao").trim();
    if (razao.length < 3) {
      UI.toast("A razão social precisa ter pelo menos 3 letras.", "erro");
      return;
    }

    var cnpj = pega("#edCnpj").trim();
    /* CNPJ vazio passa: às vezes a empresa ainda está sendo
       aberta e o número não existe. Errado é que não pode. */
    if (cnpj && !U.validaCNPJ(cnpj)) {
      UI.toast("O CNPJ não confere. Verifique os números ou deixe em branco.", "erro", 8000);
      return;
    }

    var dados = {
      razaoSocial: razao.slice(0, 150),
      nomeFantasia: pega("#edFantasia").trim().slice(0, 120),
      cnpj: cnpj,
      regime: pega("#edRegime"),
      responsavelNome: pega("#edRespNome").trim().slice(0, 200),
      responsavelCargo: pega("#edRespCargo").trim().slice(0, 200),
      responsavelEmail: pega("#edRespEmail").trim().slice(0, 200),
      responsavelTelefone: pega("#edRespTel").trim().slice(0, 200),
      atualizadoEm: Date.now()
    };

    var botao = $('[data-acao="1"]', m.caixa);
    if (botao) { botao.disabled = true; botao.textContent = "Salvando…"; }

    FB.db.collection("empresas").doc(c.id).set(dados, { merge: true }).then(function () {
      Object.keys(dados).forEach(function (k) { c.empresa[k] = dados[k]; });
      UI.fecharModal();
      desenharFicha();
      desenharLista();
      UI.toast("Cadastro atualizado.", "ok", 3000);
    }, function (err) {
      if (botao) { botao.disabled = false; botao.textContent = "Salvar"; }
      UI.toast("Não foi possível salvar: " + FB.explicar(err), "erro", 9000);
    });
  }

  /* ============================================================
     Sócios, pelo painel

     Vale lembrar por que isto tem peso: cada sócio cadastrado faz
     nascer uma lista inteira de documentos pessoais no portal do
     cliente. Cadastrar um sócio a mais é aumentar a cobrança; tirar
     um sócio errado é diminuir. Por isso remover pede confirmação
     e diz o que vai acontecer com os documentos.
     ============================================================ */
  function editarSocio(c, socioId) {
    var atual = socioId
      ? c.dados.socios.filter(function (s) { return s.id === socioId; })[0]
      : null;
    if (socioId && !atual) return;

    var m = UI.modal({
      titulo: atual ? "Editar sócio" : "Adicionar sócio",
      corpoHTML:
        campoTexto("soNome", "Nome completo", atual ? atual.nome : "", 'data-focus') +
        campoTexto("soCpf", "CPF", atual ? atual.cpf : "",
                   'inputmode="numeric" maxlength="14" placeholder="000.000.000-00"') +
        '<div class="field__hint" style="margin-top:4px">O sócio aparece para o cliente na tela ' +
          'de Empresa, e ganha a própria lista de documentos.</div>',
      acoes: [
        { rotulo: "Cancelar", classe: "btn--ghost" },
        {
          rotulo: "Salvar", classe: "btn--primary", fecharAntes: false,
          onClick: function () { salvarSocio(c, socioId, m); }
        }
      ]
    });

    var campoCpf = $("#soCpf", m.caixa);
    if (campoCpf) campoCpf.addEventListener("input", function () {
      campoCpf.value = U.mascaraCPF(campoCpf.value);
    });
  }

  function salvarSocio(c, socioId, m) {
    var pega = function (id) { return ($(id, m.caixa) || {}).value || ""; };
    var nome = pega("#soNome").trim();
    if (nome.length < 3) {
      UI.toast("O nome do sócio precisa ter pelo menos 3 letras.", "erro");
      return;
    }

    var cpf = pega("#soCpf").trim();
    /* Mesma regra do CNPJ na empresa: vazio passa, errado não. */
    if (cpf && !U.validaCPF(cpf)) {
      UI.toast("O CPF não confere. Verifique os números ou deixe em branco.", "erro", 8000);
      return;
    }

    /* A regra do Firestore aceita SÓ `nome` e `cpf` neste
       documento — nada de campo extra entrando de carona. */
    var dados = { nome: nome.slice(0, 120), cpf: cpf };
    var raiz = FB.db.collection("empresas").doc(c.id).collection("socios");
    var ref = socioId ? raiz.doc(socioId) : raiz.doc();

    var botao = $('[data-acao="1"]', m.caixa);
    if (botao) { botao.disabled = true; botao.textContent = "Salvando…"; }

    ref.set(dados).then(function () {
      var existente = c.dados.socios.filter(function (s) { return s.id === ref.id; })[0];
      if (existente) { existente.nome = dados.nome; existente.cpf = dados.cpf; }
      else c.dados.socios.push({ id: ref.id, nome: dados.nome, cpf: dados.cpf });
      UI.fecharModal();
      desenharFicha();
      desenharLista();
      UI.toast(socioId ? "Sócio atualizado." : "Sócio adicionado.", "ok", 3000);
    }, function (err) {
      if (botao) { botao.disabled = false; botao.textContent = "Salvar"; }
      UI.toast("Não foi possível salvar: " + FB.explicar(err), "erro", 9000);
    });
  }

  function removerSocio(c, socioId) {
    var s = c.dados.socios.filter(function (x) { return x.id === socioId; })[0];
    if (!s) return;

    UI.modal({
      titulo: "Remover sócio",
      corpoHTML:
        '<p class="text-sm">Remover <strong>' + U.esc(s.nome || "este sócio") + '</strong> do ' +
          'cadastro de ' + U.esc(nomeDe(c)) + '?</p>' +
        '<p class="text-sm text-muted" style="margin-top:10px">A lista de documentos pessoais ' +
          'dele sai do portal do cliente e para de contar no progresso. Os arquivos que ele já ' +
          'enviou continuam guardados — some a cobrança, não o que chegou.</p>',
      acoes: [
        { rotulo: "Cancelar", classe: "btn--ghost" },
        {
          rotulo: "Remover", classe: "btn--danger",
          onClick: function () {
            FB.db.collection("empresas").doc(c.id).collection("socios").doc(socioId).delete()
              .then(function () {
                c.dados.socios = c.dados.socios.filter(function (x) { return x.id !== socioId; });
                desenharFicha();
                desenharLista();
                UI.toast("Sócio removido.", "ok", 3000);
              }, function (err) {
                UI.toast("Não foi possível remover: " + FB.explicar(err), "erro", 9000);
              });
          }
        }
      ]
    });
  }

  /* Grava o que se aplica e o que não se aplica.

     "Deixar com o cliente" vira REMOÇÃO do campo, não `null`:
     um `naEquipe: null` gravado continuaria sendo uma opinião da
     equipe do ponto de vista de quem lê, e a diferença entre
     "não opinei" e "opinei que é nulo" ia atormentar alguém no
     futuro. FieldValue.delete() apaga de verdade. */
  function gravarAplicacao(c, mudancas) {
    var apagar = global.firebase.firestore.FieldValue.delete();
    var lote = FB.db.batch();
    var tocadas = [];

    mudancas.forEach(function (mu) {
      mu.chaves.forEach(function (chave) {
        var ref = FB.db.collection("empresas").doc(c.id)
                    .collection("itens").doc(global.Nuvem.codificar(chave));
        lote.set(ref, { naEquipe: mu.naEquipe === null ? apagar : mu.naEquipe }, { merge: true });
        tocadas.push({ chave: chave, valor: mu.naEquipe });
      });
    });

    return lote.commit().then(function () {
      tocadas.forEach(function (t) {
        if (!c.dados.itens[t.chave]) c.dados.itens[t.chave] = {};
        if (t.valor === null) delete c.dados.itens[t.chave].naEquipe;
        else c.dados.itens[t.chave].naEquipe = t.valor;
      });
      if (aberto === c) desenharFicha();
      atualizarContadores();
      UI.toast(mudancas.length === 1
        ? "Documento atualizado."
        : mudancas.length + " documentos atualizados.", "ok", 4000);
      return true;
    }, function (e) {
      UI.toast("Não foi possível salvar: " + FB.explicar(e), "erro", 9000);
      throw e;
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
    var aResolver = aResolverDe(c);

    /* Painel, e não cartão dobrável: esta é a vista INTEIRA de
       Conversa. Dobrado, o clique em "Conversa" levava a uma tela
       com um cartão fechado no meio — a pessoa trocou de vista
       para ler a conversa e teve que clicar de novo para vê-la. */
    return painel({
      id: "mensagens", icone: "ic-chat", titulo: "Mensagens", largo: true,
      resumo: msgs.length ? msgs.length + " " + U.plural(msgs.length, "mensagem", "mensagens") +
        " · o cliente lê no portal" : "Nenhuma mensagem ainda",
      selo: naoLidas ? naoLidas + " " + U.plural(naoLidas, "nova", "novas")
            : aResolver ? aResolver + " a resolver" : "",
      seloCls: naoLidas ? "badge--pendencia" : "badge--analise",
      corpo: function () {
        return (msgs.length
          ? '<div class="conversa">' + msgs.slice(-30).map(function (m) { return mensagemHTML(m, c); }).join("") + '</div>'
          : '<p class="text-sm text-muted">Nenhuma mensagem ainda.</p>') +

        /* UM botão para a conversa toda, no fim dela, que é onde se
           está quando se termina de ler. Marca de uma vez tudo o que
           o cliente escreveu e ainda não foi tratado. */
        (aResolver
          ? '<div class="row" style="margin-top:12px">' +
              '<button type="button" class="btn btn--quiet btn--sm" data-resolver-tudo="1" ' +
                'data-emp="' + U.escAttr(c.id) + '">' + ic("ic-check") +
                'Marcar conversa como resolvida</button>' +
              '<span class="text-xs text-muted" style="align-self:center">' +
                aResolver + ' ' + U.plural(aResolver, "mensagem", "mensagens") +
                ' do cliente sem providência</span>' +
            '</div>'
          : (msgs.length
              ? '<div class="row" style="margin-top:12px">' +
                  '<button type="button" class="btn btn--quiet btn--sm" data-resolver-tudo="0" ' +
                    'data-emp="' + U.escAttr(c.id) + '">Reabrir a conversa</button>' +
                '</div>'
              : '')) +

        '<div class="field" style="margin-top:14px;margin-bottom:8px">' +
          '<label class="field__label" for="clMsg">Escrever para o cliente</label>' +
          '<textarea class="textarea" id="clMsg" rows="4" maxlength="4000" ' +
            'placeholder="Escreva aqui, ou toque em um modelo abaixo…"></textarea>' +
        '</div>' +
        modelosHTML() +
        /* ANEXO TAMBÉM PELA EQUIPE (pedido dele, 2026-08-24). O
           cliente sempre pôde mandar arquivo pela conversa; a
           equipe, não — e é comum precisar devolver um documento
           preenchido, um modelo, um comprovante. A regra do Storage
           já permitia `equipeOuDono`, então faltava só a tela. */
        '<div class="row" style="margin-top:12px">' +
          '<button type="button" class="btn btn--quiet btn--sm" id="clAnexar">' +
            ic("ic-clipe") + 'Anexar arquivo</button>' +
          '<button type="button" class="btn btn--primary btn--sm" id="clEnviarMsg">' +
            ic("ic-send") + 'Enviar</button>' +
        '</div>' +
        '<div id="clAnexos" class="anexos-fila"></div>';
      }
    });
  }

  /* =========================================================
     Ações
     ========================================================= */
  /* `empresaId` chegou junto com os botões de aprovar e devolver
     na aba Pendências.

     Antes isto era só `var c = aberto` — a ficha aberta. Na ficha
     acerta sempre; fora dela, `aberto` é nulo e a função devolvia
     `false` CALADA. Os botões novos não fariam nada e ninguém
     saberia por quê. Quando o botão diz de quem é o documento, não
     há o que deduzir. */
  function revisar(chave, status, motivo, empresaId) {
    var c = empresaId
      ? (empresas || []).filter(function (x) { return x.id === empresaId; })[0]
      : aberto;
    if (!c) {
      UI.toast("Não encontrei este cliente. Recarregue a página e tente de novo.", "erro", 8000);
      return Promise.resolve(false);
    }

    return conferindoForaDaArea([chave]).then(function (ok) {
      if (!ok) return false;
      return gravarRevisao(c, chave, status, motivo);
    });
  }

  function gravarRevisao(c, chave, status, motivo) {
    var doc = FB.db.collection("empresas").doc(c.id)
                .collection("itens").doc(global.Nuvem.codificar(chave));

    var revisao = {
      status: status,
      motivo: status === "pendencia" ? String(motivo || "").slice(0, 600) : "",
      por: (equipe && (equipe.nome || equipe.email)) || "equipe",
      em: Date.now()
    };

    /* PEDIDO NOVO APAGA A RESPOSTA VELHA, e sem isto o cliente
       ficava sem saber que havia um pedido novo.

       A resposta dele é o que faz o portal mostrar "Respondido" no
       lugar de "Precisa corrigir". Se a equipe devolve o documento
       uma segunda vez e a resposta da PRIMEIRA continua ali, o
       cliente segue lendo "Respondido", o selo do setor não conta a
       correção, e o pedido novo não existe para ele.

       A resposta antiga não se perde: ela também virou mensagem na
       conversa, com link para este documento. */
    var campos = { revisao: revisao };
    if (status === "pendencia") campos.obs = "";

    return doc.set(campos, { merge: true }).then(function () {
      if (status === "pendencia" && c.dados.itens[chave]) c.dados.itens[chave].obs = "";
      /* Espelha na memória para a tela responder na hora, sem
         recarregar o cliente inteiro do servidor. */
      if (!c.dados.itens[chave]) c.dados.itens[chave] = {};
      c.dados.itens[chave].revisao = revisao;
      /* Aprovar e devolver agora acontecem em três telas. Redesenhar
         só a ficha deixava as outras duas mostrando o estado
         antigo — e quem clicou concluiria que o botão falhou. */
      desenharFicha();
      atualizarContadores();
      if ((location.hash || "").indexOf("pendencias") > -1) desenharPendencias();
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
        /* `data-` em vez de `id`: o bloco agora existe em duas telas,
           e id repetido em duas telas é o começo de um bug chato de
           achar. Quem trata é o clique delegado, que não depende de
           alguém lembrar de ligar o botão na tela nova. */
        '<button type="button" class="chip-modelo chip-modelo--edit" data-modelos-editar="1">' +
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

    return conferindoForaDaArea(chaves).then(function (ok) {
      return ok ? gravarLote(c, chaves) : 0;
    });
  }

  function gravarLote(c, chaves) {
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

  /* Arquivos escolhidos e ainda não enviados, do cliente aberto.
     Zera ao trocar de cliente e ao enviar. */
  var anexosPendentes = [];
  var entradaAnexo = null;

  /* A empresa que vai receber o anexo: a ficha aberta ou, quando se
     trabalha pela caixa de entrada, a conversa aberta. */
  function alvoDaConversa() { return aberto || conversaAberta; }

  function desenharAnexos() {
    /* Os dois lugares onde se escreve para o cliente: a aba Conversa
       da ficha e a caixa de entrada. Só um existe por vez. */
    var caixa = $("#clAnexos") || $("#msAnexos");
    if (!caixa) return;
    if (!anexosPendentes.length) { caixa.innerHTML = ""; return; }
    caixa.innerHTML = anexosPendentes.map(function (a, i) {
      return '<div class="item" style="padding:8px 10px">' +
        '<div class="item__main" style="display:flex;align-items:center;gap:9px">' +
          ic(U.iconePorExtensao(U.extensao(a.nome))) +
          '<span class="item__name" style="flex:1;min-width:0">' + U.esc(a.nome) + '</span>' +
          '<span class="text-xs text-muted">' + U.esc(U.bytes(a.tamanho)) + '</span>' +
          '<button type="button" class="btn btn--quiet btn--sm" data-tirar-anexo="' + i + '" ' +
            'aria-label="Tirar este arquivo">&#215;</button>' +
        '</div>' +
      '</div>';
    }).join("");
  }

  /* Sobe o arquivo ANTES de a mensagem existir, e é de propósito:
     assim a mensagem já nasce com o anexo dentro. Se a subida
     falhar, nada foi escrito na conversa — melhor do que uma
     mensagem apontando para arquivo que não chegou. */
  function anexarArquivos(lista) {
    var c = alvoDaConversa();
    if (!c || !lista || !lista.length) return;
    var restam = 10 - anexosPendentes.length;
    if (restam <= 0) { UI.toast("Dez arquivos por mensagem é o limite.", "erro"); return; }

    var arquivos = Array.prototype.slice.call(lista, 0, restam);
    var botao = $("#clAnexar") || $("#msAnexar");
    if (botao) { botao.disabled = true; botao.textContent = "Enviando…"; }

    var fila = Promise.resolve();
    arquivos.forEach(function (f) {
      fila = fila.then(function () {
        /* A mesma checagem do lado do cliente: tamanho, extensão e
           conteúdo batendo com a extensão. É conveniência — a
           barreira de verdade é a regra do Storage. */
        var erro = U.validaArquivo(f, 0);
        if (erro) { UI.toast(f.name + ": " + erro, "erro", 8000); return; }

        var id = U.uid();
        var ref = FB.storage.ref("empresas/" + c.id + "/mensagens/" + id + "/arquivo");
        /* Celular manda arquivo sem contentType (HEIC, XML, áudio) e
           a regra recusa — o tipo é deduzido pela extensão. */
        var tipo = U.mimeDoArquivo(f);
        return ref.put(f, { contentType: tipo }).then(function () {
          anexosPendentes.push({
            id: id, nome: String(f.name || "arquivo").slice(0, 160),
            tamanho: f.size || 0, tipo: tipo
          });
        }, function (e) {
          UI.toast("Não foi possível anexar " + f.name + ": " + FB.explicar(e), "erro", 9000);
        });
      });
    });

    fila.then(function () {
      if (botao) { botao.disabled = false; botao.innerHTML = ic("ic-clipe") + "Anexar arquivo"; }
      desenharAnexos();
    });
  }

  /* Uma entrada de arquivo só, criada na primeira vez e reaproveitada
     pelas duas telas: recriar a cada desenho deixaria entradas soltas
     no documento a cada troca de aba. */
  function escolherAnexo() {
    if (!entradaAnexo) {
      entradaAnexo = document.createElement("input");
      entradaAnexo.type = "file";
      entradaAnexo.multiple = true;
      entradaAnexo.accept = U.ACCEPT_ATTR;
      entradaAnexo.style.display = "none";
      entradaAnexo.addEventListener("change", function () {
        anexarArquivos(entradaAnexo.files);
        entradaAnexo.value = "";     /* deixa reescolher o mesmo arquivo */
      });
      document.body.appendChild(entradaAnexo);
    }
    entradaAnexo.click();
  }

  function enviarMensagem(texto, chave, cliente) {
    var c = cliente || aberto;
    var t = String(texto || "").trim().slice(0, 4000);
    /* Os anexos escolhidos são desta conversa — a que está aberta na
       ficha ou na caixa de entrada. Mandar para outra empresa seria
       entregar documento ao cliente errado. */
    var anexos = (c === alvoDaConversa()) ? anexosPendentes.slice() : [];
    /* Mensagem só de anexo vale — nem sempre há o que escrever
       junto. É a mesma regra do lado do cliente. */
    if (!c || (!t && !anexos.length)) return Promise.resolve(false);

    var id = U.uid();
    var msg = {
      autor: "equipe",
      autorNome: (equipe && (equipe.nome || equipe.email)) || "Totali",
      /* Quem escreveu, de verdade. `autorNome` é rótulo de tela e
         pode se repetir; a regra que decide se alguém pode apagar a
         PRÓPRIA mensagem precisa de identidade, não de nome. */
      autorUid: (FB.auth && FB.auth.currentUser && FB.auth.currentUser.uid) || "",
      texto: t,
      chave: String(chave || ""),
      anexos: anexos.map(function (a) {
        return { id: a.id, nome: a.nome, tamanho: a.tamanho, tipo: a.tipo };
      }),
      em: Date.now(),
      lidaEm: 0
    };

    return FB.db.collection("empresas").doc(c.id)
             .collection("mensagens").doc(id).set(msg).then(function () {
      msg.id = id;
      c.mensagens.push(msg);
      if (c === alvoDaConversa()) anexosPendentes = [];
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

  /* `empresaId` pelo mesmo motivo de `revisar`: o arquivo passou a
     poder ser aberto da aba Pendências, onde não há ficha aberta.
     Sem ele, a função saía calada — clicar no arquivo não fazia
     nada e nem erro aparecia. */
  function abrirArquivo(id, nome, tipo, empresaId) {
    var c = empresaId
      ? (empresas || []).filter(function (x) { return x.id === empresaId; })[0]
      : aberto;
    if (!c) {
      UI.toast("Não encontrei este cliente. Recarregue a página e tente de novo.", "erro", 8000);
      return;
    }
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

  /* ============================================================
     Abrir a senha — sem arquivo de chave

     A chave privada saiu do computador de uma pessoa e foi para o
     Secret Manager. Quem abre agora é uma Cloud Function, para
     qualquer membro da equipe, e toda abertura fica registrada em
     /auditoria.

     A RESPOSTA NÃO VOLTA EM TEXTO PURO. Esta aba gera um par de
     chaves descartável, na memória, e manda a metade pública com
     o pedido. A função abre o envelope da Totali e RECIFRA com
     essa chave descartável. No Firestore, nem o pedido nem a
     resposta têm senha legível — só esta aba, agora, consegue
     abrir o que voltou.

     Sem isso, a senha ficaria em texto puro no documento do
     pedido, e teríamos trocado um problema por outro.
     ============================================================ */
  var parDaAba = null;

  function chaveDaAba() {
    if (parDaAba) return Promise.resolve(parDaAba);
    return global.Cripto.gerarPar().then(function (par) {
      parDaAba = par;
      return par;
    });
  }

  var LIMITE_SENHA_MS = 45000;

  function abrirCredencial(chave) {
    var c = aberto;
    if (!c) return;
    var saida = $('[data-cred-saida="' + chave.replace(/"/g, '\\"') + '"]');
    var botao = $('[data-abrir-cred="' + chave.replace(/"/g, '\\"') + '"]');
    if (botao) { botao.disabled = true; botao.textContent = "Abrindo…"; }

    var soltar = function (msg, tipo) {
      if (botao) { botao.disabled = false; botao.textContent = "Ver senha"; }
      if (msg) UI.toast(msg, tipo || "erro", 9000);
    };

    chaveDaAba().then(function (par) {
      var ref = FB.db.collection("pedidosDeSenha").doc();
      var parar = null, relogio = null;

      /* GRAVA PRIMEIRO, ESCUTA DEPOIS — e a ordem não é estilo.

         A regra de leitura desta coleção é
         `resource.data.pedidoPor == request.auth.uid`. Num
         documento que AINDA NÃO EXISTE não há `resource`, então a
         regra reprova e o Firestore derruba a escuta na hora. Era
         o que acontecia: o pedido ia, a função respondia certo, e
         o painel nunca via a resposta — só o aviso genérico "não
         foi possível acompanhar o pedido".

         Escutando depois da gravação, a primeira notificação já
         traz o documento existente. Se a função for mais rápida
         que a escuta, melhor ainda: o snapshot inicial vem com a
         resposta pronta. */
      var escutar = function () {
        parar = ref.onSnapshot(function (doc) {
        if (!doc.exists) return;
        var d = doc.data() || {};
        if (!d.concluidoEm) return;

        if (parar) { parar(); parar = null; }
        if (relogio) { clearTimeout(relogio); relogio = null; }

        if (d.erro) { soltar("Não foi possível abrir: " + d.erro); return; }
        if (!d.resposta) { soltar("A resposta veio vazia."); return; }

        global.Cripto.decifrar(d.resposta, par.privada).then(function (valores) {
          soltar("");
          mostrarSenha(saida, valores);
        }, function () {
          soltar("A resposta chegou, mas esta aba não conseguiu abri-la. Recarregue a página.");
        });
        }, function () {
          if (relogio) { clearTimeout(relogio); relogio = null; }
          soltar("Não foi possível acompanhar o pedido.");
        });

        /* Folga para a primeira abertura do dia: função de 2ª
           geração acorda do zero e ainda busca a chave no Secret
           Manager. As seguintes respondem em segundos. */
        relogio = setTimeout(function () {
          if (parar) { parar(); parar = null; }
          soltar("O servidor não respondeu a tempo. Tente de novo.");
        }, LIMITE_SENHA_MS);
      };

      return ref.set({
        pedidoPor: (equipe && equipe.uid) || "",
        empresaId: c.id,
        chave: global.Nuvem.codificar(chave),
        chavePublica: par.publica,
        em: FB.agora()
      }).then(escutar, function (e) {
        soltar("Não foi possível pedir: " + FB.explicar(e));
      });
    }, function () {
      soltar("Este navegador não conseguiu preparar a abertura segura.");
    });
  }

  /* A SENHA APARECE DIRETO, sem bolinhas.

     Cheguei a cobri-la com um botão "Mostrar", e estava errado: a
     proteção já existe um passo antes. Nada disto está na tela até
     alguém tocar em "Ver senha", pedir ao servidor e a abertura ser
     registrada com nome e hora. Exigir um segundo toque depois
     disso não protege de mais ninguém — só atrapalha quem já fez o
     que tinha de fazer para chegar aqui. */
  function mostrarSenha(saida, valores) {
    if (!saida) return;
    saida.hidden = false;
    saida.innerHTML = Object.keys(valores).map(function (k) {
      var v = String(valores[k]);
      return '<div class="cred__par">' +
        '<span class="cred__rot">' + U.esc(k) + '</span>' +
        '<code class="cred__v">' + U.esc(v) + '</code>' +
        '<button type="button" class="btn btn--quiet btn--sm" data-copiar="' +
          U.escAttr(v) + '">Copiar</button>' +
      '</div>';
    }).join("") +
    '<p class="text-xs text-muted" style="margin-top:8px">Some da tela ao atualizar. ' +
      'Esta abertura ficou registrada com o seu nome.</p>';
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

    var pdf = $("#clFichaPDF");
    if (pdf) pdf.addEventListener("click", function () {
      if (aberto) baixarPDF(pdf, global.FichaPDF, aberto, "Ficha exportada.");
    });

    var enviar = $("#clEnviarMsg");
    if (enviar) enviar.addEventListener("click", function () {
      var campo = $("#clMsg");
      /* Só anexo, sem texto, também vale. */
      if (!campo.value.trim() && !anexosPendentes.length) { campo.focus(); return; }
      enviar.disabled = true;
      enviarMensagem(campo.value).then(function () { /* redesenha */ });
    });

    var anexar = $("#clAnexar");
    if (anexar) anexar.addEventListener("click", function () { escolherAnexo(); });

    desenharAnexos();

    var cobrar = $("#clCobrar");
    if (cobrar) cobrar.addEventListener("click", function () { abrirCobranca(aberto); });

    var recarregar = $("#clRecarregar");
    if (recarregar) recarregar.addEventListener("click", function () {
      if (!aberto) return;
      recarregar.disabled = true;
      recarregar.textContent = "Atualizando…";
      carregarCliente(aberto.id).then(function (novo) {
        empresas = empresas.map(function (x) { return x.id === novo.id ? novo : x; });
        aberto = novo;
        desenharFicha();
        UI.toast("Ficha atualizada.", "ok", 2500);
      }, function (e) {
        recarregar.disabled = false;
        recarregar.innerHTML = ic("ic-refresh") + "Atualizar";
        UI.toast("Não foi possível atualizar: " + FB.explicar(e), "erro", 8000);
      });
    });

    var concluir = $("#clConcluir");
    if (concluir) concluir.addEventListener("click", function () {
      if (!aberto) return;
      concluirMigracao(aberto);
    });

    var dossie = $("#clDossie");
    if (dossie) dossie.addEventListener("click", function () {
      if (!aberto) return;
      baixarPDF(dossie, global.DossiePDF, aberto, "Dossiê gerado.");
    });

    var editar = $("#clEditarCadastro");
    if (editar) editar.addEventListener("click", function () {
      if (aberto) editarCadastro(aberto);
    });

    var aplic = $("#clAplicacao");
    if (aplic) aplic.addEventListener("click", function () {
      if (!aberto) return;
      var c = aberto;
      global.Aplicacao.abrir({
        titulo: "Documentos de " + nomeDe(c),
        itens: c.dados.itens,
        socios: c.dados.socios,
        aoSalvar: function (mudancas) { return gravarAplicacao(c, mudancas); }
      });
    });

    var anotar = $("#clSalvarNota");
    if (anotar) anotar.addEventListener("click", function () {
      var campo = $("#clNota");
      if (!campo || !campo.value.trim()) { if (campo) campo.focus(); return; }
      anotar.disabled = true;
      salvarNota(campo.value);
    });

    var aprovarTudo = $("#clAprovarTudo");
    if (aprovarTudo) aprovarTudo.addEventListener("click", function () {
      if (!aberto) return;
      pedirAprovacaoEmLote(paraConferir(aberto), "nesta empresa");
    });

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

  /* Abre o programa de e-mail com tudo preenchido.

     `mailto:` e não integração com servidor de e-mail: a mensagem
     sai da caixa da própria pessoa, com a assinatura dela, e a
     resposta do cliente volta para ela. Integração exigiria
     servidor, domínio verificado e um remetente genérico — mais
     peça para manter e pior para quem recebe. */
  /* O endereço vai cru no `mailto:`, não percent-encoded: `%40` no
     lugar do arroba trava alguns programas de e-mail. Em troca,
     ele precisa PARECER um endereço antes de sair daqui — é o que
     impede alguém de embutir uma quebra de linha e emendar um
     destinatário oculto no cabeçalho. */
  function emailValido(v) {
    return /^[^\s<>"'@,;:]+@[^\s<>"'@,;:]+\.[^\s<>"'@,;:]+$/.test(String(v || "").trim());
  }

  function abrirNoEmail(email, assunto, corpo) {
    var alvo = String(email || "").trim();
    if (!emailValido(alvo)) return false;
    var a = document.createElement("a");
    a.href = "mailto:" + alvo +
             "?subject=" + encodeURIComponent(assunto) +
             "&body=" + encodeURIComponent(corpo);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  }

  /* ============================================================
     Cobrança — uma janela, três vias

     Serve a todos os pontos do sistema que cobram: o bloco "o que
     falta" da ficha, a lista de pendências e a cobrança de um
     documento específico. Fica fora dos três de propósito — se
     cada tela montasse a sua, uma hora teriam textos diferentes
     para a mesma situação.

     Cada via serve a um momento:
       portal    fica registrado na conversa, junto do checklist;
       WhatsApp  chega onde o cliente já olha;
       e-mail    o que dá para encaminhar, imprimir e anexar —
                 e o único que serve de comprovante numa cobrança
                 que precise ser formal.

     Nenhuma delas envia sozinha pelo WhatsApp ou pelo e-mail: as
     duas abrem o aplicativo com o texto pronto e quem aperta
     enviar é a pessoa. É proposital — mensagem disparada por
     sistema em nome de alguém erra o tom mais cedo ou mais tarde.
     ============================================================ */
  /* Cobrança de UM documento.

     O texto sai nomeando o documento e dizendo onde encontrá-lo, e
     a mensagem vai presa à chave do item — no portal do cliente
     isso vira um link direto para ele. Cobrar "os 11 que faltam"
     costuma render nada; cobrar um documento com nome e caminho
     rende resposta. */
  function cobrarItem(c, chave) {
    var achado = global.Situacao.pendencias(c.dados, DATA.GRUPOS)
      .filter(function (p) { return p.chave === chave; })[0];
    if (!achado) { UI.toast("Este documento já não está pendente.", "ok"); return; }

    var quem = achado.socio ? " (de " + (achado.socio.nome || "sócio") + ")" : "";
    var corrigir = achado.sit === "pendencia";
    var nome = (c.empresa.responsavelNome || "").split(" ")[0] || "";

    var texto = "Olá" + (nome ? ", " + nome : "") + "! " +
      (corrigir
        ? "Precisamos que você reenvie um documento da " + nomeDe(c) + ":\n\n"
        : "Falta um documento para seguirmos com a " + nomeDe(c) + ":\n\n") +
      "• " + achado.item.nome + quem + "\n\n" +
      (achado.item.resumo ? achado.item.resumo + "\n\n" : "") +
      "É só enviar pelo portal, na aba Documentos, em " + achado.grupo.titulo + ". " +
      "Dá para tirar foto pelo celular. Qualquer dúvida, responda por aqui mesmo.";

    var montagem = {
      texto: texto,
      chave: chave,
      titulo: "Cobrar: " + achado.item.nome,
      assunto: (corrigir ? "Reenvio de documento" : "Documento pendente") +
               " · " + achado.item.nome + " · " + nomeDe(c)
    };

    /* O cliente marcou dia para voltar neste documento e o dia
       ainda não chegou. Não bloqueia a cobrança — às vezes ela é
       necessária mesmo assim —, só garante que a equipe saiba do
       combinado antes de mandar. */
    var prometido = ((c.dados.itens[chave] || {}).lembrete) || 0;
    if (prometido > Date.now()) {
      UI.confirmar({
        titulo: "O cliente já marcou uma data",
        mensagem: "Ele mesmo se comprometeu a enviar " + achado.item.nome + " até " +
                  U.dataCurta(prometido) + ", e esse dia ainda não chegou. Cobrar agora " +
                  "pode soar como se ninguém tivesse visto o que ele combinou. Quer cobrar " +
                  "assim mesmo?",
        confirmar: "Cobrar mesmo assim"
      }).then(function (ok) {
        if (ok) abrirCobranca(c, montagem);
      });
      return;
    }

    abrirCobranca(c, montagem);
  }

  /* Copiar com rede de segurança de verdade.

     A primeira versão só caía para o jeito antigo quando
     `navigator.clipboard` NÃO EXISTIA. Só que ele existe e mesmo
     assim RECUSA em várias situações comuns: aba sem foco, página
     fora de https, política do navegador. Nesses casos a promessa
     é rejeitada e o texto não vai — foi o que aconteceu no teste.

     Agora o caminho antigo cobre os dois casos: não existir e
     existir mas falhar. Ele é síncrono e não depende de permissão,
     então funciona onde o outro desiste. */
  function copiarPeloAntigo(texto) {
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
  }

  /* `aviso` é a frase inteira, não um rótulo para eu emendar um
     "copiado" no fim: "Mensagem" é feminino e saía "Mensagem
     copiado". Montar frase juntando pedaços erra a concordância
     mais cedo ou mais tarde. */
  function copiarTexto(texto, aviso) {
    var fim = function (ok) {
      UI.toast(ok ? (aviso || "Copiado.")
                  : "Não foi possível copiar. Selecione o texto e copie à mão.",
               ok ? "ok" : "erro");
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(
        function () { fim(true); },
        function () { fim(copiarPeloAntigo(texto)); }
      );
      return;
    }
    fim(copiarPeloAntigo(texto));
  }

  function abrirCobranca(c, opcoes) {
    var o = opcoes || {};
    var texto = o.texto || montarCobranca(c);
    if (!texto) { UI.toast("Este cliente não tem pendência para cobrar.", "ok"); return; }

    var titulo = o.titulo || ("Cobrar " + nomeDe(c));
    var assunto = o.assunto || ("Documentos pendentes · " + nomeDe(c));
    var chave = o.chave || "";

    var tel = c.empresa.responsavelTelefone || "";
    var email = c.empresa.responsavelEmail || "";
    var temZap = !!numeroWhatsApp(tel);
    var temEmail = emailValido(email);

    var acoes = [{ rotulo: "Cancelar", classe: "btn--ghost" }];

    if (temEmail) {
      acoes.push({
        rotulo: "Abrir e-mail", classe: "btn--ghost", fecharAntes: false,
        onClick: function () {
          if (!abrirNoEmail(email, assunto, $("#cbTexto", m.caixa).value)) {
            UI.toast("E-mail do responsável inválido.", "erro");
            return;
          }
          UI.fecharModal();
          UI.toast("Seu programa de e-mail foi aberto com a mensagem pronta. Ela não fica " +
                   "registrada no portal — para registro, use também \"Enviar pelo portal\".",
                   "", 11000);
        }
      });
    }

    if (temZap) {
      acoes.push({
        rotulo: "Abrir WhatsApp", classe: "btn--gold", fecharAntes: false,
        onClick: function () {
          if (!abrirNoWhatsApp(tel, $("#cbTexto", m.caixa).value)) {
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
      onClick: function () { enviarMensagem($("#cbTexto", m.caixa).value, chave, c); }
    });

    var via = function (icone, nome, disponivel, texto) {
      return '<div class="cobranca__via' + (disponivel ? "" : " cobranca__via--off") + '">' +
        '<span class="cobranca__t">' + ic(icone) + U.esc(nome) + '</span>' +
        '<span class="cobranca__d">' + texto + '</span>' +
      '</div>';
    };

    var m = UI.modal({
      titulo: titulo,
      corpoHTML:
        '<p style="font-size:13.5px;line-height:1.65;color:var(--txt-2);margin-bottom:10px">' +
          'Ajuste o texto se quiser e escolha por onde enviar. Dá para usar mais de uma via — ' +
          'o portal registra, as outras duas alcançam.</p>' +
        '<div class="cobranca__vias">' +
          via("ic-chat", "Pelo portal", true,
              'Fica registrado na conversa, junto do checklist.') +
          via("ic-phone", "Pelo WhatsApp", temZap,
              temZap ? 'Vai para ' + U.esc(tel) + ', com o texto pronto — você confere e envia.'
                     : 'O cliente ainda não informou o telefone do responsável.') +
          via("ic-mail", "Por e-mail", temEmail,
              temEmail ? 'Vai para ' + U.esc(email) + ', com o texto pronto no seu programa de e-mail.'
                       : 'O cliente ainda não informou o e-mail do responsável.') +
        '</div>' +
        '<div class="field" style="margin-bottom:0;margin-top:14px">' +
          /* O copiar fica JUNTO DO TEXTO, e não na fileira de
             ações lá embaixo. Ali ele competiria com os três
             botões de enviar, e ele não é uma quarta via: é o que
             se usa quando nenhuma das três serve — mandar por
             Telegram, por SMS, colar num sistema de chamado. */
          '<div class="campo-topo">' +
            '<label class="field__label" for="cbTexto" style="margin-bottom:0">Mensagem</label>' +
            '<button type="button" class="btn btn--quiet btn--sm" data-copiar-de="#cbTexto"' +
          ' data-copiar-aviso="Mensagem copiada.">' +
              ic("ic-copy") + 'Copiar texto</button>' +
          '</div>' +
          '<textarea class="textarea" id="cbTexto" rows="10" style="font-size:13px"></textarea>' +
          '<div class="field__hint">Copie se quiser mandar por outro caminho. Só o envio ' +
            '"pelo portal" fica registrado na conversa do cliente.</div>' +
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

      var fapr = alvo.closest("[data-fila-aprovar]");
      if (fapr) {
        var par = String(fapr.getAttribute("data-fila-aprovar")).split("|");
        aprovarDaFila(par[0], par.slice(1).join("|"));
        return;
      }

      var fl = alvo.closest("[data-fila]");
      if (fl) { filaAberta = !filaAberta; desenharPendencias(); return; }

      var vis = alvo.closest("[data-vista]");
      if (vis) {
        vistaFicha = vis.getAttribute("data-vista");
        desenharFicha();
        global.scrollTo({ top: 0, behavior: "auto" });
        return;
      }

      var apn = alvo.closest("[data-apagar-nota]");
      if (apn) { apagarNota(apn.getAttribute("data-apagar-nota")); return; }

      var tirar = alvo.closest("[data-tirar-anexo]");
      if (tirar) {
        anexosPendentes.splice(Number(tirar.getAttribute("data-tirar-anexo")), 1);
        desenharAnexos();
        return;
      }

      var rst = alvo.closest("[data-resolver-tudo]");
      if (rst) {
        var idConv = rst.getAttribute("data-emp");
        var donoConv = empresas.filter(function (x) { return x.id === idConv; })[0];
        if (donoConv) {
          marcarConversaResolvida(donoConv, rst.getAttribute("data-resolver-tudo") === "1");
        }
        return;
      }

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

      /* A QUARTA SAÍDA CALADA DA MESMA FAMÍLIA.

         Era `if (ci && aberto)`. Na aba Pendências não há ficha
         aberta, então o botão Cobrar existia na tela e não fazia
         nada — nem erro. Como nas outras três, a correção é o botão
         dizer de quem é o documento em vez de a função adivinhar. */
      var ci = alvo.closest("[data-cobrar-item]");
      if (ci) {
        var cCob = ci.getAttribute("data-emp")
          ? (empresas || []).filter(function (x) { return x.id === ci.getAttribute("data-emp"); })[0]
          : aberto;
        if (!cCob) {
          UI.toast("Não encontrei este cliente. Recarregue a página e tente de novo.", "erro", 8000);
          return;
        }
        cobrarItem(cCob, ci.getAttribute("data-cobrar-item"));
        return;
      }

      var rmDoc = alvo.closest("[data-remover-doc]");
      if (rmDoc) {
        removerDocumento(rmDoc.getAttribute("data-emp"),
                         rmDoc.getAttribute("data-remover-doc"),
                         rmDoc.getAttribute("data-arq"),
                         rmDoc.getAttribute("data-nome"));
        return;
      }

      var vinc = alvo.closest("[data-vincular]");
      if (vinc) {
        var cv = empresas.filter(function (x) { return x.id === vinc.getAttribute("data-vincular"); })[0];
        if (cv) vincularOutraEmpresa(cv);
        return;
      }

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
                     arq.getAttribute("data-tipo"), arq.getAttribute("data-emp") || "");
        return;
      }

      /* Modelo escolhido: o texto entra no campo, e a pessoa
         ainda revisa antes de enviar. Nada sai sozinho. */
      /* Vale nos DOIS lugares onde se escreve para o cliente: a aba
         Conversa da ficha e a caixa de entrada. `alvoDaConversa()`
         já sabe qual dos dois está em pé, e o campo é o que existir
         na tela — só um dos dois existe por vez. */
      if (alvo.closest("[data-modelos-editar]")) { abrirGerenciadorModelos(); return; }

      var mod = alvo.closest("[data-modelo]");
      if (mod) {
        var cMod = alvoDaConversa();
        var escolhido = modelos[Number(mod.getAttribute("data-modelo"))];
        var campoMsg = $("#clMsg") || $("#msTexto");
        if (!cMod || !escolhido || !campoMsg) {
          UI.toast("Abra uma conversa para usar um modelo.", "erro", 6000);
          return;
        }
        campoMsg.value = preencherModelo(escolhido.texto, cMod);
        campoMsg.focus();
        campoMsg.setSelectionRange(campoMsg.value.length, campoMsg.value.length);
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

      /* Do resumo até o documento. Abre o setor, redesenha e leva a
         página até o item — sem isso, "Ver documento" mandaria a
         pessoa procurar sozinha num setor que talvez esteja
         fechado, e o botão seria só uma promessa. */
      var irDoc = alvo.closest("[data-ir-doc]");
      if (irDoc) {
        abertosFicha["grupo:" + irDoc.getAttribute("data-grupo")] = true;
        var chaveIr = irDoc.getAttribute("data-ir-doc");
        desenharFicha();
        var destino = document.querySelector('[data-item="' + chaveIr.replace(/"/g, '\\"') + '"]');
        if (destino) {
          destino.scrollIntoView({ block: "center", behavior: "smooth" });
          /* Um piscar curto: numa lista longa, chegar no lugar
             certo e não saber qual das linhas é a sua é chegar
             quase lá. */
          destino.classList.add("item--achado");
          setTimeout(function () { destino.classList.remove("item--achado"); }, 1600);
        }
        return;
      }

      var resposta = alvo.closest("[data-resposta]");
      if (resposta) {
        var chaveR = resposta.getAttribute("data-resposta");
        var cR = (empresas || []).filter(function (x) {
          return x.id === resposta.getAttribute("data-emp");
        })[0];
        var regR = cR ? (cR.dados.itens || {})[chaveR] || {} : {};
        var cx = resposta.getBoundingClientRect();
        UI.balao({
          x: cx.left + cx.width / 2, y: cx.top,
          titulo: "O cliente respondeu",
          texto: regR.obs || "Sem texto."
        });
        return;
      }

      var aprovar = alvo.closest("[data-aprovar]");
      if (aprovar) {
        revisar(aprovar.getAttribute("data-aprovar"), "aprovado", "",
                aprovar.getAttribute("data-emp") || "");
        return;
      }

      var limpar = alvo.closest("[data-limpar]");
      if (limpar) { revisar(limpar.getAttribute("data-limpar"), ""); return; }

      var socioEd = alvo.closest("[data-socio-editar]");
      if (socioEd && aberto) { editarSocio(aberto, socioEd.getAttribute("data-socio-editar")); return; }

      var socioRm = alvo.closest("[data-socio-remover]");
      if (socioRm && aberto) { removerSocio(aberto, socioRm.getAttribute("data-socio-remover")); return; }

      var socioNovo = alvo.closest("[data-socio-novo]");
      if (socioNovo && aberto) { editarSocio(aberto, ""); return; }

      var pend = alvo.closest("[data-pendencia]");
      if (pend) {
        var chave = pend.getAttribute("data-pendencia");
        var empPend = pend.getAttribute("data-emp") || "";
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
                revisar(chave, "pendencia", motivo, empPend).then(function (ok) {
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

      /* Copiar o que está DENTRO de um campo, não um texto fixo.
         A diferença importa na cobrança: a equipe costuma ajustar
         a mensagem antes de mandar, e copiar o texto original
         devolveria justamente a versão que ela acabou de mudar. */
      var copiarDe = alvo.closest("[data-copiar-de]");
      if (copiarDe) {
        var campo = $(copiarDe.getAttribute("data-copiar-de"));
        if (campo) {
          copiarTexto(campo.value,
                      copiarDe.getAttribute("data-copiar-aviso") || "Copiado.");
        }
        return;
      }
    });

    var busca = $("#clBusca");
    if (busca) busca.addEventListener("input", U.debounce(function () {
      filtro.texto = busca.value;
      desenharLista();
    }, 200));

    /* SEM RETORNO, O BOTÃO PARECIA QUEBRADO.

       Ele buscava tudo de novo e redesenhava — só que, quando nada
       mudou no servidor, a tela fica idêntica. Quem clicava não
       tinha como saber se a busca aconteceu, e a conclusão natural
       era "não funciona". Foi o que o Raoni relatou em 26/08/2026.

       O botão agora diz que está buscando e avisa quando terminou.
       Custa duas linhas e devolve a única coisa que faltava: a
       certeza de que o clique valeu. */
    ["#clAtualizar", "#pdAtualizar", "#msAtualizar"].forEach(function (sel) {
      var b = $(sel);
      if (!b) return;
      b.addEventListener("click", function () {
        if (b.disabled) return;
        var rotulo = b.innerHTML;
        b.disabled = true;
        b.textContent = "Atualizando…";
        function devolver(msg, tipo) {
          b.disabled = false;
          b.innerHTML = rotulo;
          UI.toast(msg, tipo || "ok", 2600);
        }
        Promise.resolve(carregarLista()).then(
          function () { devolver("Lista atualizada."); },
          function () { devolver("Não foi possível atualizar agora.", "erro"); }
        );
      });
    });

    var csv = $("#clCSV");
    if (csv) csv.addEventListener("click", exportarCSV);

    /* AO VOLTAR PARA UMA ABA, BUSCA DE NOVO — não só redesenha.

       Antes era só `desenhar*()`, que pinta o que já está na
       memória. Cliente criado na aba "Novo cliente" não aparecia
       na lista até alguém tocar em Atualizar: a lista em memória
       nunca tinha ouvido falar dele. O Raoni tropeçou nisso logo
       no primeiro convite que mandou.

       Buscar toda vez seria pesado — são nove leituras por cliente.
       Por isso a regra é: dados com mais de meio minuto, busca;
       mais novos que isso, redesenha. Trocar de aba para conferir
       um número não deve custar uma rodada no banco.

       Com uma ficha aberta não se mexe: recarregar por baixo
       fecharia o que a pessoa está lendo. */
    var IDADE_MAXIMA_MS = 30000;

    if (global.Painel) {
      global.Painel.aoTrocar(function (aba) {
        if (["clientes", "pendencias", "mensagens", "inicio"].indexOf(aba) === -1) return;

        var velha = (Date.now() - carregadaEm) > IDADE_MAXIMA_MS;
        if (velha && !aberto && !carregando) { carregarLista(); return; }

        if (aba === "pendencias") desenharPendencias();
        if (aba === "mensagens") desenharMensagens();
        if (aba === "clientes" && !aberto) desenharLista();
      });
    }

    ligarAtualizacaoSozinha();
  }

  /* ============================================================
     A LISTA SE ATUALIZA SOZINHA (pedido dele, 2026-08-25)

     Dentro de uma conversa aberta já era tempo real. A LISTA não
     era: documento que chegava só aparecia depois de alguém tocar
     em Atualizar, e quem deixa o painel aberto o dia todo não tem
     por que adivinhar que precisa fazer isso.

     Três minutos, e não trinta segundos: cada rodada custa uma
     leitura por empresa mais as subcoleções, e ninguém precisa
     saber em trinta segundos que um documento chegou. Com o painel
     aberto oito horas, isso dá cerca de cento e sessenta rodadas
     por dia — barato, e nada perto do que um ouvinte em tempo real
     sobre todas as empresas custaria.

     QUANDO NÃO ATUALIZA, que é o que evita atrapalhar:

     - ficha ou conversa aberta — recarregar por baixo fecharia o
       que a pessoa está lendo, ou apagaria o recado a meio digitar;
     - janela aberta (confirmação, cobrança, senha na tela) — a
       tela mudaria embaixo de uma decisão em curso;
     - aba escondida — atualizar o que ninguém está olhando é
       leitura jogada fora. Ao voltar para a frente, se estiver
       velha, atualiza na hora;
     - já carregando, ou alguém com anexo escolhido esperando envio.

     Em qualquer desses casos ele apenas pula a vez: o próximo
     tique tenta de novo. ============================================================ */
  var INTERVALO_SOZINHA_MS = 3 * 60 * 1000;
  var relogioSozinha = null;

  function podeAtualizarSozinha() {
    if (!equipe) return false;                 /* sem sessão, nada a buscar */
    if (carregando) return false;
    if (aberto || conversaAberta) return false;
    if (anexosPendentes.length) return false;
    if (document.querySelector(".modal, dialog[open]")) return false;
    if (document.hidden) return false;
    /* Aba que não mostra lista nenhuma: buscar agora seria só custo,
       e ao entrar nela a regra dos 30 segundos já busca. */
    var aba = (location.hash || "").replace("#", "");
    return ["", "inicio", "clientes", "pendencias", "mensagens"].indexOf(aba) > -1;
  }

  function ligarAtualizacaoSozinha() {
    if (relogioSozinha) return;
    relogioSozinha = setInterval(function () {
      if (podeAtualizarSozinha()) carregarLista();
    }, INTERVALO_SOZINHA_MS);

    /* Voltando para a aba depois de um tempo fora, não faz sentido
       esperar o próximo tique para ver o que chegou. */
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) return;
      if ((Date.now() - carregadaEm) > INTERVALO_SOZINHA_MS && podeAtualizarSozinha()) {
        carregarLista();
      }
    });
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
              'do portal — em teste, <code>http://localhost:8099/equipe.html</code>.'
            : 'Verifique a internet. Assim que ela voltar, a lista carrega sozinha.') +
          '</span></div>';
      }
      var topo = $("#clTopo");
      if (topo) topo.hidden = true;
      return;
    }

    ligarGlobais();
    ligarMenuDasMensagens();

    /* Girar o celular ou mexer na janela muda o que sobra de tela.
       Sem isto a conversa fica com a altura da orientação anterior:
       ou sobra faixa vazia, ou o campo de resposta sai da vista. */
    global.addEventListener("resize", U.debounce
      ? U.debounce(ajustarAlturaDaConversa, 150)
      : ajustarAlturaDaConversa);

    FB.observarSessao(function (quem) {
      equipe = quem;
      if (quem) {
        carregarModelos();
        carregarLista();
      } else {
        /* A SESSÃO CAIU. Limpar as variáveis não basta: a ficha do
           cliente continuava desenhada na tela, com dados de quem
           acabou de sair e botões que não respondem mais, porque os
           dados por trás deles sumiram. Quem via isso achava que a
           página tinha travado e recarregava à força — foi o que o
           Raoni descreveu em 2026-08-24.

           Fechar a ficha devolve a tela ao estado limpo, e aí o
           formulário de entrada que aparece por cima é a única
           coisa com que dá para interagir, que é o correto. */
        empresas = [];
        conversaAberta = null;
        carregando = false;
        fecharCliente();
        if (global.Painel) {
          global.Painel.marcarBadges({ atencao: 0, pendencias: 0, mensagens: 0 });
        }
      }
    });
  }

  /* ============================================================
     O que a tela de Início enxerga daqui

     Ela mostra os mesmos clientes desta aba. Se buscasse por
     conta própria, seriam duas leituras do banco por abertura do
     painel — e, pior, dois retratos que divergem assim que
     alguém aprova alguma coisa. Aqui já está carregado; ela só
     lê e é avisada quando muda.

     Devolve uma cópia rasa da lista: quem está de fora não
     reordena nem remove o que é desta aba.
     ============================================================ */
  var ouvintesLista = [];

  function avisarLista() {
    ouvintesLista.forEach(function (fn) {
      try { fn(); } catch (e) { /* um ouvinte com erro não derruba os outros */ }
    });
  }

  global.PainelClientes = {
    get empresas() { return empresas.slice(); },
    get carregando() { return carregando; },
    arquivada: arquivada,
    nomeDe: nomeDe,
    estadoDoCliente: estadoDoCliente,
    naoConferidos: naoConferidos,
    naoLidasDe: naoLidasDe,
    aResolverDe: aResolverDe,
    diasParado: diasParado,
    emMs: emMs,
    abrirFicha: abrirCliente,
    abrirConversa: abrirConversa,
    aoAtualizar: function (fn) { if (typeof fn === "function") ouvintesLista.push(fn); },
    /* Para quem ACABOU de mexer no banco e sabe que a lista ficou
       velha — criar cliente, por exemplo. Melhor do que esperar o
       tempo passar: o cliente novo aparece na hora. */
    recarregar: function () { carregadaEm = 0; return carregarLista(); }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})(window);
