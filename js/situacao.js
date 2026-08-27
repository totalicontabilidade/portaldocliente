/* ============================================================
   Totali · Portal de Onboarding
   situacao.js — em que pé está cada documento

   POR QUE ISTO É UM ARQUIVO SÓ
   ----------------------------
   Esta conta aparece em dois lugares: na tela do cliente ("faltam
   11 documentos") e no painel da equipe ("este cliente está em
   42%"). Se cada lado fizesse a conta do seu jeito, uma hora o
   cliente veria um número e a equipe outro — e aí ninguém confia
   em nenhum dos dois. Então a conta é feita aqui, e os dois lados
   chamam a mesma função.

   Não guarda estado: recebe os dados e devolve a resposta.

   `dados` é o conjunto do cliente:
     itens          {chave -> registro}
     gruposNA       {grupoId -> true}   grupo inteiro dispensado
     socios         [{id, nome, cpf}]
     temCredencial  função(chave) -> boolean
   ============================================================ */
(function (global) {
  "use strict";

  function chaveItem(grupoId, itemId, socioId) {
    return socioId ? grupoId + "/" + socioId + "/" + itemId : grupoId + "/" + itemId;
  }

  /* Situações possíveis, na ordem em que uma vence a outra:
       na          — não se aplica (o item ou o grupo inteiro)
       substituido — a CNH cobre RG e CPF
       pendencia   — a equipe recusou; o cliente precisa reenviar
       aprovado    — a equipe conferiu e aceitou
       analise     — entregue, a equipe está conferindo
       enviado     — entregue, ainda sem revisão
       pendente    — nada entregue                                 */
  /* UMA APROVAÇÃO VALE PARA O ARQUIVO QUE FOI APROVADO.

     O cliente continua podendo mexer nos arquivos depois de a
     equipe aprovar — e deve mesmo, é documento dele. Mas as regras
     do Firestore só o deixam escrever `arquivos`; `revisao` é da
     equipe. O resultado era que trocar o PDF depois do aprovado
     não mudava nada do lado de cá: o painel seguia verde,
     ninguém era chamado a olhar o arquivo novo, e o cliente via
     "Enviado" enquanto a equipe via "Aprovado" — os dois lendo a
     mesma tela e discordando.

     Não dá para consertar gravando: o cliente não pode escrever
     `revisao`, e deixar que pudesse seria deixá-lo se aprovar
     sozinho. Então a validade é CALCULADA, dos dois lados, a
     partir do que já está gravado:

       - arquivo mais novo que a aprovação  → volta para conferir
       - documento de arquivo que ficou sem nenhum → volta a pendente

     Só arquivos entram na conta: `atualizadoEm` sobe também quando
     o cliente escreve uma observação ou marca um lembrete, e isso
     derrubaria aprovações sem nada ter mudado no documento. */
  function aprovacaoVencida(r, item) {
    if (item.kind !== "arquivo") return false;
    var arquivos = r.arquivos || [];
    if (!arquivos.length) return true;

    var aprovadoEm = (r.revisao && r.revisao.em) || 0;
    if (!aprovadoEm) return false;

    /* Remoção não deixa data em lugar nenhum: o arquivo some do
       vetor e pronto. Por isso a equipe anota QUANTOS arquivos
       havia quando aprovou — se o número mudou, a aprovação não
       fala mais do mesmo conjunto. Registros aprovados antes deste
       campo existir não têm o número, e aí só vale a data. */
    var quantos = r.revisao && r.revisao.arquivos;
    if (typeof quantos === "number" && quantos !== arquivos.length) return true;

    for (var i = 0; i < arquivos.length; i++) {
      if ((arquivos[i].em || 0) > aprovadoEm) return true;
    }
    return false;
  }

  function de(dados, grupo, item, socioId) {
    var itens = dados.itens || {};
    if ((dados.gruposNA || {})[grupo.id]) return "na";

    var chave = chaveItem(grupo.id, item.id, socioId);
    var r = itens[chave];

    /* A DEFINIÇÃO DA EQUIPE VENCE A DO CLIENTE.

       `na` é do cliente; `naEquipe` é da Totali, que sabe quais
       documentos aquela empresa realmente precisa entregar.
       Quando existe definição da equipe, ela decide sozinha — o
       `true` tira o documento da lista e o `false` o devolve,
       mesmo que o cliente tivesse marcado o contrário.

       Ausente quer dizer "a equipe não opinou", e aí vale o que o
       cliente marcou. É o que mantém funcionando tudo o que já
       existia antes deste campo. */
    var decidiu = r && typeof r.naEquipe === "boolean";
    if (decidiu && r.naEquipe) return "na";
    if (!decidiu && r && r.na) return "na";

    if (item.substituivelPor) {
      var sub = itens[chaveItem(grupo.id, item.substituivelPor, socioId)];
      if (sub && sub.arquivos && sub.arquivos.length) return "substituido";
    }
    if (!r) return "pendente";

    var rev = (r.revisao && r.revisao.status) || "";
    if (rev === "pendencia") return "pendencia";
    if (rev === "aprovado" && !aprovacaoVencida(r, item)) return "aprovado";
    if (rev === "analise") return "analise";

    if (item.kind === "arquivo" && r.arquivos && r.arquivos.length) return "enviado";
    if (item.kind === "dado" && String(r.valor || "").trim()) return "enviado";
    if (item.kind === "acesso" && r.forma) {
      /* Escolher "informar o acesso" só resolve depois que a
         credencial é realmente guardada. */
      if (r.forma === "informar" && item.credenciais) {
        var tem = dados.temCredencial;
        if (typeof tem === "function" && !tem(chave)) return "pendente";
      }
      return "enviado";
    }
    return "pendente";
  }

  /* Situações que contam como resolvido na barra de progresso.
     Pendência NÃO conta: o documento voltou para o cliente. */
  var RESOLVIDAS = ["enviado", "substituido", "analise", "aprovado"];

  function resolvida(sit) { return RESOLVIDAS.indexOf(sit) > -1; }

  /* Sobre quem o grupo é contado: a empresa uma vez, ou cada
     sócio cadastrado. */
  function alvosDoGrupo(dados, grupo) {
    if (grupo.escopo !== "socio") return [null];
    return (dados.socios || []).map(function (s) { return s.id; });
  }

  function resumoGrupo(dados, grupo) {
    var total = 0, ok = 0, pendentesObrig = 0, pendencias = 0, aprovados = 0;

    alvosDoGrupo(dados, grupo).forEach(function (socioId) {
      grupo.itens.forEach(function (item) {
        var sit = de(dados, grupo, item, socioId);
        if (sit === "na") return;
        total++;
        if (sit === "pendencia") pendencias++;
        if (sit === "aprovado") aprovados++;
        if (resolvida(sit)) ok++;
        else if (item.obrigatorio) pendentesObrig++;
      });
    });

    return {
      total: total, ok: ok, pendentes: total - ok,
      pendentesObrigatorios: pendentesObrig,
      pendencias: pendencias, aprovados: aprovados,
      pct: total ? Math.round((ok / total) * 100) : 0,
      completo: total > 0 && ok === total,
      vazio: total === 0
    };
  }

  function resumoGeral(dados, grupos) {
    var total = 0, ok = 0, obrig = 0, pend = 0, aprov = 0;
    (grupos || []).forEach(function (g) {
      var r = resumoGrupo(dados, g);
      total += r.total; ok += r.ok; obrig += r.pendentesObrigatorios;
      pend += r.pendencias; aprov += r.aprovados;
    });
    return {
      total: total, ok: ok, pendentes: total - ok,
      pendentesObrigatorios: obrig, pendencias: pend, aprovados: aprov,
      pct: total ? Math.round((ok / total) * 100) : 0
    };
  }

  /* Lista plana do que está faltando — é o que a equipe cobra e o
     que o cliente vê como "próximos passos". */
  function pendencias(dados, grupos, opcoes) {
    var o = opcoes || {};
    var correcoes = [], faltando = [];

    (grupos || []).forEach(function (g) {
      alvosDoGrupo(dados, g).forEach(function (socioId) {
        var socio = socioId
          ? (dados.socios || []).filter(function (s) { return s.id === socioId; })[0]
          : null;
        g.itens.forEach(function (item) {
          var sit = de(dados, g, item, socioId);
          var faltaObrigatorio = sit === "pendente" && item.obrigatorio;
          if (sit !== "pendencia" && !faltaObrigatorio) {
            if (!(o.incluirOpcionais && sit === "pendente")) return;
          }
          var entrada = {
            grupo: g, item: item, sit: sit, socio: socio,
            chave: chaveItem(g.id, item.id, socioId)
          };
          if (sit === "pendencia") correcoes.push(entrada);
          else faltando.push(entrada);
        });
      });
    });

    var lista = correcoes.concat(faltando);
    return o.limite ? lista.slice(0, o.limite) : lista;
  }

  global.Situacao = {
    chaveItem: chaveItem,
    de: de,
    RESOLVIDAS: RESOLVIDAS,
    resolvida: resolvida,
    resumoGrupo: resumoGrupo,
    resumoGeral: resumoGeral,
    pendencias: pendencias
  };
})(window);
