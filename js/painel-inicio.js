/* ============================================================
   Totali · Portal de Onboarding
   painel-inicio.js — a primeira tela do painel da equipe

   POR QUE EXISTE
   --------------
   O painel abria na lista de clientes, em ordem alfabética-ish,
   com o mesmo peso para quem entregou tudo e para quem está
   parado há três semanas. Para saber o que fazer primeiro, a
   pessoa tinha que abrir Pendências, depois Mensagens, depois
   voltar em Clientes — e cruzar as três de cabeça.

   Esta tela faz esse cruzamento. Ela não traz informação nova:
   traz a MESMA informação em ordem de urgência, numa lista só.

   COMO A ORDEM É DECIDIDA
   -----------------------
   Cada pendência recebe um peso, e o peso responde a uma
   pergunta: quanto custa deixar isto para amanhã?

     1. cliente escreveu e ninguém leu   — tem gente esperando
     2. documento parado na conferência  — o cliente já fez a
                                           parte dele
     3. mensagem lida e não resolvida    — alguém viu e não agiu
     4. cliente parado há muito tempo    — está esfriando
     5. convite gerado e nunca aberto    — a migração nem começou

   O empate dentro de cada faixa é resolvido pelo tempo: mais
   antigo primeiro. Sempre. É a única regra que não deixa nada
   afundar para sempre.

   O QUE ELA NÃO FAZ
   -----------------
   Não busca nada no servidor. Lê a lista que a aba Clientes já
   carregou (global.PainelClientes) e se redesenha quando aquela
   avisa. Duas buscas dariam dois retratos diferentes da mesma
   coisa, e o Início mostraria um mundo que já mudou.
   ============================================================ */
(function (global) {
  "use strict";

  var UI = global.UI, U = global.U;
  var $ = UI.$;
  var DIA = 86400000;

  function ic(nome, cls) {
    return '<svg class="ic ' + (cls || "") + '" aria-hidden="true" focusable="false">' +
           '<use href="#' + nome + '"></use></svg>';
  }

  /* Quantos dias faz — sempre em texto de gente, nunca "há 0 dias". */
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

  function diasDe(ms) {
    return ms ? Math.floor((Date.now() - ms) / DIA) : 0;
  }

  /* ------------------------------------------------------------
     Reunir o trabalho
     ------------------------------------------------------------ */
  var PESO = {
    naoLida: 1, conferir: 2, aResolver: 3, parado: 4, convite: 5
  };

  /* ---------- Filtro por departamento ----------

     Ligado por padrão. Quem não tem setor definido cuida de tudo,
     e para essa pessoa o filtro não muda nada — nem o botão de
     desligar aparece. */
  var soMeuSetor = true;

  function souDe() { return (global.FB && global.FB.equipe) || null; }

  function temSetor() {
    return !global.Departamentos.veTudo(souDe());
  }

  function daMinhaArea(grupoId) {
    if (!soMeuSetor) return true;
    return global.Departamentos.cuida(souDe(), grupoId);
  }

  function reunir() {
    var PC = global.PainelClientes;
    if (!PC) return [];

    var linhas = [];

    PC.empresas.forEach(function (c) {
      if (PC.arquivada(c)) return;
      var nome = PC.nomeDe(c);

      /* 1. Mensagem que o cliente mandou e ninguém abriu. */
      var naoLidas = c.mensagens.filter(function (m) {
        return m.autor === "cliente" && !m.lidaEm;
      });
      if (naoLidas.length) {
        var maisAntiga = naoLidas.reduce(function (a, m) {
          return (!a || (m.em || 0) < (a.em || 0)) ? m : a;
        }, null);
        linhas.push({
          peso: PESO.naoLida, em: (maisAntiga && maisAntiga.em) || 0,
          cliente: c, icone: "ic-chat", acao: "conversa",
          titulo: naoLidas.length === 1
            ? "Mensagem nova de " + nome
            : naoLidas.length + " mensagens novas de " + nome,
          detalhe: String((maisAntiga && maisAntiga.texto) || "").slice(0, 110),
          selo: "Responder", seloCls: "badge--pendencia"
        });
      }

      /* 2. Documento entregue, esperando alguém olhar.

         Aqui entra o departamento: quem cuida do Pessoal não
         precisa ver todo dia os balanços que a contabilidade
         está conferindo. As mensagens NÃO são filtradas — elas
         não pertencem a setor nenhum, e uma pergunta sem resposta
         é problema de quem estiver por perto. */
      var fila = PC.naoConferidos(c).filter(function (x) {
        return daMinhaArea(x.grupo.id);
      });
      if (fila.length) {
        var maisVelho = 0;
        fila.forEach(function (x) {
          var t = PC.emMs((c.dados.itens[x.chave] || {}).atualizadoEm) || 0;
          if (t && (!maisVelho || t < maisVelho)) maisVelho = t;
        });
        linhas.push({
          peso: PESO.conferir, em: maisVelho,
          cliente: c, icone: "ic-check-circle", acao: "ficha",
          titulo: fila.length === 1
            ? "1 documento de " + nome + " esperando conferência"
            : fila.length + " documentos de " + nome + " esperando conferência",
          detalhe: fila.slice(0, 3).map(function (x) { return x.item.nome; }).join(" · ") +
                   (fila.length > 3 ? " · e mais " + (fila.length - 3) : ""),
          selo: "Conferir", seloCls: diasDe(maisVelho) >= 3 ? "badge--pendencia" : "badge--analise"
        });
      }

      /* 3. Lida, mas ninguém tomou providência. Só conta o que
            NÃO está na faixa 1 — senão o mesmo cliente apareceria
            duas vezes pela mesma conversa. */
      var aResolver = c.mensagens.filter(function (m) {
        return m.autor === "cliente" && m.lidaEm && !m.resolvidaEm;
      });
      if (aResolver.length && !naoLidas.length) {
        var velha = aResolver.reduce(function (a, m) {
          return (!a || (m.em || 0) < (a.em || 0)) ? m : a;
        }, null);
        linhas.push({
          peso: PESO.aResolver, em: (velha && velha.em) || 0,
          cliente: c, icone: "ic-chat", acao: "conversa",
          titulo: aResolver.length === 1
            ? "Pedido de " + nome + " sem providência"
            : aResolver.length + " pedidos de " + nome + " sem providência",
          detalhe: String((velha && velha.texto) || "").slice(0, 110),
          selo: "Resolver", seloCls: "badge--analise"
        });
      }

      /* 4. Ninguém mexeu há muito tempo. Só vale quando ainda
            falta alguma coisa — cliente completo e quieto está
            certo de estar quieto. */
      var est = PC.estadoDoCliente(c);
      var parado = PC.diasParado(c);
      if (parado !== null && parado >= 7 && est.chave !== "emdia" && !fila.length) {
        linhas.push({
          peso: PESO.parado, em: Date.now() - parado * DIA,
          cliente: c, icone: "ic-clock", acao: "ficha",
          titulo: nome + " parado " + faz(Date.now() - parado * DIA),
          detalhe: est.resumo.pendentesObrigatorios + " " +
            U.plural(est.resumo.pendentesObrigatorios,
                     "documento obrigatório ainda falta", "documentos obrigatórios ainda faltam"),
          selo: "Cobrar", seloCls: "badge--pendente"
        });
      }

      /* 5. Convite entregue e nunca aberto: a migração não
            começou, e ninguém do lado de cá percebeu. */
      if (!(c.acessos || []).length && (c.convites || []).length) {
        var maisAntigoConvite = (c.convites || []).reduce(function (a, v) {
          var t = PC.emMs(v.criadoEm) || 0;
          return (!a || (t && t < a)) ? t : a;
        }, 0);
        if (diasDe(maisAntigoConvite) >= 3) {
          linhas.push({
            peso: PESO.convite, em: maisAntigoConvite,
            cliente: c, icone: "ic-mail", acao: "ficha",
            titulo: nome + " ainda não entrou no portal",
            detalhe: "O convite foi gerado " + faz(maisAntigoConvite) +
                     " e ninguém abriu. Vale reenviar o link.",
            selo: "Reenviar", seloCls: "badge--pendente"
          });
        }
      }
    });

    return linhas.sort(function (a, b) {
      if (a.peso !== b.peso) return a.peso - b.peso;
      /* Sem data conhecida vai para o fim da própria faixa. */
      if (!a.em && !b.em) return 0;
      if (!a.em) return 1;
      if (!b.em) return -1;
      return a.em - b.em;
    });
  }

  /* ------------------------------------------------------------
     Números do topo

     Cada um é um botão que leva ao lugar onde se resolve aquilo.
     Número que não leva a lugar nenhum vira enfeite.
     ------------------------------------------------------------ */
  /* Os quatro números são só sobre O MEU trabalho.

     A primeira versão trazia "correções pedidas" e "clientes
     ativos". Os dois estavam errados de propósito diferente:
     correção pedida é fila do CLIENTE, não minha — eu já fiz a
     parte de pedir; e "clientes ativos" não muda de semana em
     semana, então vira número que ninguém mais lê. */
  /* Quantos documentos estão esperando o CLIENTE — o outro lado do
     número desta tela. */
  function comOsClientes() {
    var PC = global.PainelClientes;
    var n = 0;
    (PC.empresas || []).forEach(function (c) {
      if (PC.arquivada(c)) return;
      n += global.Situacao.pendencias(c.dados, global.DATA.GRUPOS).length;
    });
    return n;
  }

  function avisoDoOutroLado() {
    var n = comOsClientes();
    /* A explicação saiu (pedido dele). "Estão com os clientes" já
       diz de quem é a vez — quem lê isso logo abaixo de "nada
       esperando por você" não precisa da mesma ideia duas vezes. */
    return '<p class="empty__nota">' +
      '<strong>' + n + ' ' + U.plural(n, "documento está", "documentos estão") +
      ' com ' + U.plural(n, "o cliente", "os clientes") + '.</strong> ' +
      '<button type="button" class="empty__link" data-ir="pendencias">Ver quem cobrar</button>' +
    '</p>';
  }

  function numeros() {
    var PC = global.PainelClientes;
    var ativos = PC.empresas.filter(function (c) { return !PC.arquivada(c); });

    var conferir = 0, naoLidas = 0, aResolver = 0, parados = 0;
    ativos.forEach(function (c) {
      conferir += PC.naoConferidos(c).filter(function (x) {
        return daMinhaArea(x.grupo.id);
      }).length;
      naoLidas += PC.naoLidasDe(c);
      aResolver += c.mensagens.filter(function (m) {
        return m.autor === "cliente" && m.lidaEm && !m.resolvidaEm;
      }).length;
      var d = PC.diasParado(c);
      if (d !== null && d >= 7 && PC.estadoDoCliente(c).chave !== "emdia") parados++;
    });

    return [
      { n: conferir, rot: U.plural(conferir, "documento a conferir", "documentos a conferir"),
        aba: "pendencias", forte: conferir > 0 },
      { n: naoLidas, rot: U.plural(naoLidas, "mensagem nova", "mensagens novas"),
        aba: "mensagens", forte: naoLidas > 0 },
      { n: aResolver, rot: "sem providência", aba: "mensagens", forte: aResolver > 0 },
      { n: parados, rot: U.plural(parados, "cliente parado", "clientes parados"),
        aba: "clientes", forte: parados > 0,
        extra: "de " + ativos.length + " " + U.plural(ativos.length, "ativo", "ativos") }
    ];
  }

  /* ------------------------------------------------------------
     Desenho
     ------------------------------------------------------------ */
  var MOSTRAR = 10;
  var mostrandoTudo = false;

  /* ============================================================
     AVISO DE ROTINA PARADA (pedido dele, 2026-08-24)

     A cobrança automática roda às 10h em dias úteis, sozinha. Se
     ela parar, os clientes deixam de ser cobrados e ninguém fica
     sabendo: nada quebra na tela, nada aparece. Falha silenciosa.

     As funções passaram a anotar cada execução em /saude. Aqui a
     equipe é avisada quando uma delas falhou, ou quando faz tempo
     demais que não roda.

     QUATRO DIAS, e não dois, porque a rotina só roda em dia útil:
     de sexta a segunda passam três dias sem execução nenhuma, e um
     alarme que dispara todo fim de semana é um alarme que a equipe
     aprende a ignorar. */
  var LIMITE_SEM_RODAR_MS = 4 * 24 * 60 * 60 * 1000;
  var ROTINAS = { avisarPendencias: "Cobrança automática por prazo" };
  var saude = null;

  function lerSaude() {
    var FB = global.FB;
    if (!FB || !FB.ligado || !FB.db) return;
    FB.db.collection("saude").get().then(function (snap) {
      saude = [];
      snap.forEach(function (d) {
        var x = d.data() || {};
        saude.push({
          id: d.id,
          ok: x.ok !== false,
          erro: x.erro || "",
          em: x.em && x.em.toDate ? x.em.toDate().getTime() : 0
        });
      });
      desenharSaude();
    }, function () { /* sem permissão ou sem rede: silêncio é melhor que alarme falso */ });
  }

  function desenharSaude() {
    var caixa = $("#inSaude");
    if (!caixa) return;
    if (!saude) { caixa.innerHTML = ""; return; }

    var agora = Date.now();
    var problemas = [];

    Object.keys(ROTINAS).forEach(function (id) {
      var r = null, i;
      for (i = 0; i < saude.length; i++) if (saude[i].id === id) r = saude[i];

      if (!r) {
        problemas.push({
          nome: ROTINAS[id],
          texto: "nunca registrou execução. Pode ser que ainda não tenha chegado a hora dela, " +
                 "ou que não esteja publicada."
        });
        return;
      }
      if (!r.ok) {
        problemas.push({ nome: ROTINAS[id], texto: "falhou na última execução" +
          (r.em ? " (" + U.dataCurta(r.em) + ")" : "") + (r.erro ? ": " + r.erro : ".") });
        return;
      }
      if (r.em && agora - r.em > LIMITE_SEM_RODAR_MS) {
        problemas.push({ nome: ROTINAS[id],
          texto: "não roda desde " + U.dataCurta(r.em) + "." });
      }
    });

    if (!problemas.length) { caixa.innerHTML = ""; return; }

    /* AVISO QUE ENSINA, e não só reclama.
       Quem lê isto não é quem publica funções — é quem atende
       cliente. "A rotina falhou" sem o que fazer a seguir vira um
       alarme que se aprende a ignorar. Então: o que parou, o que
       isso significa na prática, e o passo a passo. */
    caixa.innerHTML =
      '<div class="card card--pad" style="margin-top:26px;border-color:var(--stroke-gold)">' +
        '<div class="notice notice--warn" style="margin:0 0 16px">' +
          '<span class="notice__icon">' + ic("ic-alert") + '</span>' +
          '<span><strong>Uma rotina do servidor precisa de atenção.</strong><br>' +
          problemas.map(function (p) {
            return U.esc(p.nome) + " — " + U.esc(p.texto);
          }).join("<br>") + '</span>' +
        '</div>' +

        /* O QUE FAZER FICA RECOLHIDO (pedido dele, 2026-08-25).

           O aviso em si precisa ser lido de relance; a explicação,
           não. Quem já sabe o que fazer não deve reler quatro passos
           todo dia, e quem não sabe abre uma vez. Aberto por padrão,
           o bloco tomaria meia tela por um problema que talvez seja
           só o fim de semana. */
        '<details class="rec">' +
          '<summary class="rec__head">' +
            '<span class="rec__txt">' +
              '<span class="rec__t">O que isso quer dizer e o que fazer</span>' +
              '<span class="rec__d">Quatro passos. O portal continua funcionando.</span>' +
            '</span>' +
          '</summary>' +
          '<div class="rec__body">' +
            '<div class="help-block">' +
              '<div class="help-block__t">O que isso quer dizer</div>' +
              '<p class="text-sm text-muted" style="margin:0">' +
                'A cobrança automática é o aviso por e-mail que sai às 10h, em dias úteis, para ' +
                'quem está com documento atrasado. Com ela parada, <strong>o cliente simplesmente ' +
                'deixa de ser cobrado</strong> — nada quebra na tela, e por isso este aviso ' +
                'existe. Todo o resto do portal continua funcionando normalmente.' +
              '</p>' +
            '</div>' +

            '<div class="help-block">' +
              '<div class="help-block__t">O que fazer agora</div>' +
              '<ol class="passos">' +
                '<li><strong>Cobre à mão, hoje.</strong> Abra a ficha do cliente e use ' +
                  '<em>Cobrar tudo o que falta</em>. Leva um minuto por cliente e não depende ' +
                  'da rotina.</li>' +
                '<li><strong>Veja se foi coisa de um dia.</strong> A rotina só roda em dia útil: ' +
                  'se hoje é segunda, o último registro pode ser de sexta e estar tudo certo. ' +
                  'Este aviso só aparece passados quatro dias.</li>' +
                '<li><strong>Se persistir, chame quem cuida do sistema</strong> e passe esta ' +
                  'informação: <em>a função <code>avisarPendencias</code> não está registrando ' +
                  'execução em <code>/saude</code></em>. É o suficiente para achar a causa.</li>' +
                '<li><strong>Enquanto não voltar</strong>, olhe a aba <em>Pendências</em> uma vez ' +
                  'por dia. É a mesma lista que a rotina usaria.</li>' +
              '</ol>' +
            '</div>' +

            '<p class="text-xs text-muted" style="margin:0">' +
              'Este aviso some sozinho assim que a rotina voltar a rodar.' +
            '</p>' +
          '</div>' +
        '</details>' +
      '</div>';
  }

  function desenhar() {
    var alvo = $("#inLista");
    if (!alvo) return;

    var PC = global.PainelClientes;
    if (!PC) return;

    var saudacao = $("#inSaudacao");
    if (saudacao) {
      var quem = (global.Painel && $("#pnNome") && $("#pnNome").textContent) || "";
      saudacao.textContent = U.saudacao() + (quem ? ", " + quem.split(" ")[0] : "");
    }

    /* A chave do departamento só existe para quem TEM
       departamento. Para quem cuida de tudo ela seria um botão
       que não faz nada. */
    var chave = $("#inSetor");
    if (chave) {
      if (!temSetor()) chave.innerHTML = "";
      else {
        chave.innerHTML = '<button type="button" class="filtro' +
            (soMeuSetor ? " filtro--on" : "") + '" id="inSoMeu">' +
            U.esc(global.Departamentos.nomesDos(global.Departamentos.meus(souDe()))) + '</button>' +
          '<button type="button" class="filtro' + (soMeuSetor ? "" : " filtro--on") +
            '" id="inTudo">Todos os departamentos</button>';
        var b1 = $("#inSoMeu"), b2 = $("#inTudo");
        if (b1) b1.addEventListener("click", function () { soMeuSetor = true; desenhar(); });
        if (b2) b2.addEventListener("click", function () { soMeuSetor = false; desenhar(); });
      }
    }

    if (PC.carregando) {
      alvo.innerHTML = '<div class="card card--pad"><p class="text-sm text-muted">' +
        'Carregando o que precisa de você…</p></div>';
      var placarVazio = $("#inNumeros");
      if (placarVazio) placarVazio.innerHTML = "";
      return;
    }

    desenharSaude();

    /* ---- números ---- */
    var placar = $("#inNumeros");
    if (placar) {
      placar.innerHTML = numeros().map(function (x) {
        return '<button type="button" class="numero' + (x.forte ? " numero--forte" : "") +
            '" data-aba="' + U.escAttr(x.aba) + '">' +
          '<span class="numero__n">' + x.n + '</span>' +
          '<span class="numero__rot">' + U.esc(x.rot) + '</span>' +
          (x.extra ? '<span class="numero__extra">' + U.esc(x.extra) + '</span>' : '') +
        '</button>';
      }).join("");
    }

    /* ---- lista de trabalho ---- */
    var tudo = reunir();

    if (!tudo.length) {
      alvo.innerHTML = '<div class="card"><div class="empty">' +
        '<div class="empty__icon">' + ic("ic-check-circle") + '</div>' +
        '<div class="empty__title">Nada esperando por você</div>' +
        '<div class="empty__desc">' +
          (!PC.empresas.length
            ? 'Ainda não há cliente cadastrado. Comece por “Novo cliente”.'
            : (temSetor() && soMeuSetor)
              ? 'Nada esperando em ' +
                U.esc(global.Departamentos.nomesDos(global.Departamentos.meus(souDe()))) +
                '. Toque em “Todos os departamentos” para ver o resto do escritório.'
              : 'Toda mensagem foi respondida, todo documento que chegou já foi conferido e ' +
                'ninguém está parado. Bom dia de trabalho.') + '</div>' +
        /* "NADA ESPERANDO POR VOCÊ" AO LADO DE "PENDÊNCIAS 2" parece
           contradição para quem não conhece a regra da casa: esta
           tela conta o que espera a EQUIPE, e documento que falta
           chegar já é fila do cliente.

           Quem não sabe disso lê os dois números e conclui que um
           deles está errado — ou pior, que o sistema perdeu alguma
           coisa. Dizer onde está o resto custa uma linha e fecha a
           pergunta antes de ela ser feita. */
        (comOsClientes() ? avisoDoOutroLado() : '') +
      '</div></div>';
      return;
    }

    var lista = mostrandoTudo ? tudo : tudo.slice(0, MOSTRAR);

    alvo.innerHTML = '<div class="card">' +
      lista.map(function (l) {
        return '<button type="button" class="tarefa" data-ir="' + U.escAttr(l.acao) +
            '" data-alvo="' + U.escAttr(l.cliente.id) + '">' +
          '<span class="tarefa__icone">' + ic(l.icone) + '</span>' +
          '<span class="tarefa__txt">' +
            '<span class="tarefa__t">' + U.esc(l.titulo) + '</span>' +
            '<span class="tarefa__d">' + U.esc(l.detalhe) + '</span>' +
            (l.em ? '<span class="tarefa__q">' + U.esc(faz(l.em)) + '</span>' : '') +
          '</span>' +
          '<span class="badge ' + l.seloCls + '"><span class="dot"></span>' +
            U.esc(l.selo) + '</span>' +
          '<span class="cliente__chev">' + ic("ic-chevron-right") + '</span>' +
        '</button>';
      }).join("") +
    '</div>' +
    (tudo.length > MOSTRAR
      ? '<button type="button" class="btn btn--ghost btn--sm" id="inMais" ' +
          'style="margin-top:12px">' +
          (mostrandoTudo ? "Mostrar só as " + MOSTRAR + " primeiras"
                         : "Ver as outras " + (tudo.length - MOSTRAR)) + '</button>'
      : '');

    var mais = $("#inMais");
    if (mais) mais.addEventListener("click", function () {
      mostrandoTudo = !mostrandoTudo;
      desenhar();
    });
  }

  /* ------------------------------------------------------------
     Ligação
     ------------------------------------------------------------ */
  function ligar() {
    document.addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-ir]");
      if (!b) return;
      var PC = global.PainelClientes;
      if (!PC) return;
      var id = b.getAttribute("data-alvo");

      /* Nem todo `data-ir` aponta para um cliente: o aviso do
         "nada esperando por você" leva para uma ABA. Sem isto ele
         cairia no caminho de baixo e tentaria abrir a ficha de um
         cliente sem id — de novo o clique que não faz nada. */
      if (!id) {
        if (global.Painel) global.Painel.abrir(b.getAttribute("data-ir"));
        return;
      }

      if (b.getAttribute("data-ir") === "conversa") {
        if (global.Painel) global.Painel.abrir("mensagens");
        PC.abrirConversa(id);
      } else {
        if (global.Painel) global.Painel.abrir("clientes");
        PC.abrirFicha(id);
      }
    });

    var atualizar = $("#inAtualizar");
    if (atualizar) atualizar.addEventListener("click", function () {
      if (global.Painel) global.Painel.abrir("clientes");
      var b = $("#clAtualizar");
      if (b) b.click();
    });
  }

  function iniciar() {
    if (!$("#inLista")) return;
    ligar();

    if (global.PainelClientes) global.PainelClientes.aoAtualizar(desenhar);
    if (global.Painel) global.Painel.aoTrocar(function (aba) {
      if (aba === "inicio") desenhar();
    });

    /* A saúde das rotinas é lida uma vez por sessão: são poucos
       documentos e o estado muda uma vez por dia. Ler a cada troca
       de aba seria leitura à toa. */
    if (global.FB && global.FB.observarSessao) {
      global.FB.observarSessao(function (quem) { if (quem) lerSaude(); });
    }

    desenhar();
  }

  /* A aba Segurança chama isto quando alguém troca o próprio
     departamento: sem redesenhar, a tela continuaria mostrando a
     fila do setor antigo. */
  global.PainelInicio = { redesenhar: desenhar };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})(window);
