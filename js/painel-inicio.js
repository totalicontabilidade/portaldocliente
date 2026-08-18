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

      /* 2. Documento entregue, esperando alguém olhar. */
      var fila = PC.naoConferidos(c);
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
  function numeros() {
    var PC = global.PainelClientes;
    var ativos = PC.empresas.filter(function (c) { return !PC.arquivada(c); });

    var conferir = 0, naoLidas = 0, aResolver = 0, parados = 0;
    ativos.forEach(function (c) {
      conferir += PC.naoConferidos(c).length;
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

    if (PC.carregando) {
      alvo.innerHTML = '<div class="card card--pad"><p class="text-sm text-muted">' +
        'Carregando o que precisa de você…</p></div>';
      var placarVazio = $("#inNumeros");
      if (placarVazio) placarVazio.innerHTML = "";
      return;
    }

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
          (PC.empresas.length
            ? 'Toda mensagem foi respondida, todo documento que chegou já foi conferido e ' +
              'ninguém está parado. Bom dia de trabalho.'
            : 'Ainda não há cliente cadastrado. Comece por “Novo cliente”.') + '</div>' +
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

    desenhar();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})(window);
