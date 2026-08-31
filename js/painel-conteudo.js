/* ============================================================
   Totali · Portal de Onboarding
   painel-conteudo.js — edita TODO o conteúdo do portal

   Princípio do sistema: nada muda por código. Contatos, vídeos,
   trilhas, documentos, perguntas e textos do termo são alterados
   aqui, na tela.

   No fim, "Baixar conteudo.js" gera o arquivo pronto para
   substituir em js/. O rascunho fica salvo neste navegador
   enquanto a equipe trabalha.

   [FIREBASE] Com o servidor, o download some: grava no banco e
   vale na hora.
   ============================================================ */
(function (global) {
  "use strict";

  var U = global.U, UI = global.UI, DATA = global.DATA;
  var $ = UI.$, $$ = UI.$$;
  var CHAVE = "totali.onboarding.conteudo.rascunho";
  var ID_YT = /^[A-Za-z0-9_-]{11}$/;

  var C = null;      /* rascunho em edição */
  var abertos = {};  /* seções abertas */

  /* ---------- Carga e gravação ---------- */
  function clonar(x) { return JSON.parse(JSON.stringify(x)); }

  function doPadrao() {
    return {
      versao: 1,
      atualizadoEm: 0,
      org: clonar(DATA.ORG),
      videoInicio: clonar(DATA.VIDEO_INICIO),
      academy: clonar(DATA.ACADEMY),
      grupos: clonar(DATA.GRUPOS),
      faq: clonar(DATA.FAQ),
      compromisso: clonar(DATA.COMPROMISSO),
      termo: clonar(DATA.TERMO),
      bancos: clonar(DATA.BANCOS),
      maquinetas: clonar(DATA.MAQUINETAS),
      etapas: clonar(DATA.ETAPAS),
      formasRelatorio: clonar(DATA.FORMAS_RELATORIO),
      lembretes: clonar(DATA.LEMBRETES)
    };
  }

  /* ---------- O que só o administrador edita ----------

     Pedido dele, 2026-08-27. A divisão não é por dificuldade: é
     por alcance. Vídeo, Academy, checklist e catálogos mudam o
     trabalho do dia — quem atende precisa poder mexer. Estas
     cinco falam pela empresa inteira ou mexem na estrutura:

       etapas       a trilha da migração e as formas de relatório;
                    cada linha está amarrada a uma tela
       faq          a Ajuda que todo cliente lê
       textos       o compromisso e o termo que ele ASSINA
       org          endereço, telefone e nome da empresa
       lembretes    a mensagem automática que vai para todo mundo

     Esconder aqui é conforto. Quem decide de verdade é a regra do
     Firestore, que recusa a gravação destes blocos vinda de quem
     não é administrador — inclusive de um rascunho antigo. */
  var SO_ADMIN = ["etapas", "faq", "textos", "org", "lembretes"];

  function souAdmin() {
    var FB = global.FB;
    return !!(FB && FB.equipe && FB.equipe.papel === "admin");
  }

  function carregar() {
    var r = null;
    try { r = JSON.parse(localStorage.getItem(CHAVE) || "null"); } catch (e) { r = null; }
    if (r && typeof r === "object" && r.org) {
      C = r;
      /* Rascunho salvo antes do catálogo existir não pode abrir a
         tela sem bancos e maquininhas. */
      if (!Array.isArray(C.bancos) || !C.bancos.length) C.bancos = clonar(DATA.BANCOS);
      if (!Array.isArray(C.maquinetas) || !C.maquinetas.length) C.maquinetas = clonar(DATA.MAQUINETAS);
      /* Mesma razão, para o rascunho salvo antes de as etapas e as
         formas de relatório virem para cá. A quantidade tem que
         bater com a do código: quem lê do outro lado descarta a
         lista inteira se não bater, e a tela mostraria campos que
         não valem nada. */
      if (!Array.isArray(C.etapas) || C.etapas.length !== DATA.ETAPAS.length) {
        C.etapas = clonar(DATA.ETAPAS);
      }
      if (!Array.isArray(C.formasRelatorio) ||
          C.formasRelatorio.length !== DATA.FORMAS_RELATORIO.length) {
        C.formasRelatorio = clonar(DATA.FORMAS_RELATORIO);
      }
      return "rascunho";
    }
    C = doPadrao();
    return (global.CONTEUDO && global.CONTEUDO.atualizadoEm) ? "publicado" : "padrao";
  }

  var salvar = null;   /* debounced no início */

  function gravar() {
    try { localStorage.setItem(CHAVE, JSON.stringify(C)); } catch (e) { /* segue */ }
  }

  /* ---------- Utilidades ---------- */
  function extrairIdYt(texto) {
    var t = String(texto || "").trim();
    if (ID_YT.test(t)) return t;
    var m = t.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : "";
  }

  function mover(lista, de, para) {
    if (para < 0 || para >= lista.length) return false;
    lista.splice(para, 0, lista.splice(de, 1)[0]);
    return true;
  }

  function ordemBtns(prefixo, i) {
    return '<span class="ac-ordem">' +
      '<button type="button" class="ac-mini" data-sobe="' + prefixo + ':' + i + '" aria-label="Subir">&#8593;</button>' +
      '<button type="button" class="ac-mini" data-desce="' + prefixo + ':' + i + '" aria-label="Descer">&#8595;</button>' +
    '</span>';
  }

  function campo(rotulo, caminho, valor, opcoes) {
    var o = opcoes || {};
    var comum = 'data-campo="' + U.escAttr(caminho) + '" maxlength="' + (o.max || 200) + '"';
    var corpo = o.linhas
      ? '<textarea class="textarea" ' + comum + ' style="min-height:' + (o.linhas * 22 + 20) + 'px">' +
        U.esc(valor || "") + '</textarea>'
      : '<input type="' + (o.tipo || "text") + '" class="input" ' + comum +
        ' placeholder="' + U.escAttr(o.placeholder || "") + '" value="' + U.escAttr(valor || "") + '">';
    return '<div class="field"><label class="field__label">' + U.esc(rotulo) + '</label>' + corpo +
      (o.dica ? '<div class="field__hint">' + U.esc(o.dica) + '</div>' : '') + '</div>';
  }

  function selecao(rotulo, caminho, valor, opcoes) {
    return '<div class="field"><label class="field__label">' + U.esc(rotulo) + '</label>' +
      '<select class="select" data-campo="' + U.escAttr(caminho) + '">' +
        opcoes.map(function (o) {
          var v = typeof o === "string" ? o : o.v, r = typeof o === "string" ? o : o.r;
          return '<option value="' + U.escAttr(v) + '"' + (valor === v ? " selected" : "") + '>' +
                 U.esc(r) + '</option>';
        }).join("") +
      '</select></div>';
  }

  function marcador(rotulo, caminho, marcado) {
    return '<label class="row" style="gap:9px;cursor:pointer;margin-bottom:12px">' +
      '<input type="checkbox" data-campo="' + U.escAttr(caminho) + '" style="width:18px;height:18px"' +
      (marcado ? " checked" : "") + '>' +
      '<span class="text-sm" style="color:var(--txt-2)">' + U.esc(rotulo) + '</span></label>';
  }

  /* Lista de textos simples (onde conseguir, passos, itens do termo) */
  function listaTextos(rotulo, prefixo, itens, dica) {
    return '<div class="field"><label class="field__label">' + U.esc(rotulo) + '</label>' +
      (itens || []).map(function (v, i) {
        return '<div class="ac-aula__linha" style="margin-bottom:6px">' +
          '<input type="text" class="input" data-campo="' + U.escAttr(prefixo + "." + i) + '" ' +
            'maxlength="400" value="' + U.escAttr(v) + '">' +
          '<button type="button" class="ac-mini ac-mini--x" data-remove="' + U.escAttr(prefixo + ":" + i) +
            '" aria-label="Remover">&#215;</button></div>';
      }).join("") +
      '<button type="button" class="btn btn--quiet btn--sm" data-add="' + U.escAttr(prefixo) + '">' +
        'Adicionar linha</button>' +
      (dica ? '<div class="field__hint">' + U.esc(dica) + '</div>' : '') + '</div>';
  }

  /* ------------------------------------------------------------
     Caixa que abre e fecha

     Nasceu de um pedido do Raoni: as listas do editor de conteúdo
     ficaram longas demais. São 21 bancos, 9 maquininhas, 5
     departamentos com 26 documentos, 5 trilhas com 20 aulas e uma
     dúzia de perguntas — tudo aberto ao mesmo tempo, achar o que
     se quer virava rolagem.

     Um helper só, e não quatro cópias parecidas: quando alguém
     mudar o jeito de recolher, muda em um lugar. O estado mora em
     `abertos`, que já existia para o editor de documento, e a
     chave leva ponto porque é assim que o tratador de cliques
     distingue "recolher um item" de "trocar de seção".
     ------------------------------------------------------------ */
  function caixaRecolhivel(o) {
    var aberto = !!abertos[o.chave];
    return '<div class="rec' + (aberto ? " rec--aberta" : "") + '">' +
      '<div class="rec__topo">' +
        (o.antes || "") +
        '<button type="button" class="rec__cab" data-secao="' + U.escAttr(o.chave) + '" ' +
          'aria-expanded="' + (aberto ? "true" : "false") + '">' +
          '<span class="rec__seta" aria-hidden="true">' + UI.icone("ic-chevron-down") + '</span>' +
          '<span class="rec__txt">' +
            '<span class="rec__t">' + U.esc(o.titulo || "(sem nome)") + '</span>' +
            (o.resumo ? '<span class="rec__d">' + U.esc(o.resumo) + '</span>' : '') +
          '</span>' +
        '</button>' +
        (o.depois || "") +
      '</div>' +
      (aberto ? '<div class="rec__corpo">' + o.corpo() + '</div>' : '') +
    '</div>';
  }

  /* ---------- Catálogo de bancos e maquininhas ----------

     Veio do checklist financeiro na atualização de 2026-08-18. Cada
     instituição tem um passo a passo de como liberar o acesso, e as
     maquininhas podem ser marcadas como "Modo Contador" — operadora
     que libera a contabilidade pelo próprio aplicativo, sem senha.

     A orientação só aparece para o cliente que marcou aquela
     instituição, então escrever bastante aqui não polui a tela dele. */
  function catalogoHTML(prefixo, lista, comModoContador, preposicao) {
    return (lista || []).map(function (item, i) {
      var p = prefixo + "." + i;
      return caixaRecolhivel({
        chave: p,
        titulo: item.nome || "(sem nome)",
        resumo: (item.semCredencial ? "Modo Contador · " : "") +
                (item.orientacao ? "com orientação" : "sem orientação"),
        depois: ordemBtns(prefixo, i) +
          '<button type="button" class="ac-mini ac-mini--x" data-remove="' +
            U.escAttr(prefixo + ":" + i) + '" aria-label="Remover">&#215;</button>',
        corpo: function () {
          return '<div class="field"><label class="field__label">Nome</label>' +
              '<input type="text" class="input" data-campo="' + U.escAttr(p + ".nome") + '" ' +
                'maxlength="80" value="' + U.escAttr(item.nome || "") + '" placeholder="Nome"></div>' +
            (comModoContador
              ? '<label class="row" style="gap:9px;cursor:pointer;margin:8px 0">' +
                  '<input type="checkbox" data-campo="' + U.escAttr(p + ".semCredencial") + '" ' +
                    'style="width:18px;height:18px"' + (item.semCredencial ? " checked" : "") + '>' +
                  '<span class="text-sm" style="color:var(--txt-2)">Modo Contador — libera a ' +
                    'contabilidade pelo próprio aplicativo, sem login e senha</span></label>'
              : '') +
            campo("Como liberar o acesso " + preposicao + " " + (item.nome || "instituição"),
                  p + ".orientacao", item.orientacao, {
              linhas: 4, max: 1500,
              dica: "Só aparece para quem marcar esta opção. Uma linha por passo — linhas que " +
                    "começam com traço ou número viram lista numerada."
            });
        }
      });
    }).join("") +
    '<button type="button" class="btn btn--quiet btn--sm" data-add="' + U.escAttr(prefixo) + '">' +
      'Adicionar</button>';
  }

  function secaoBancos() {
    return '<p class="text-sm text-muted" style="margin-bottom:12px">Lista que o cliente vê na ' +
      'etapa "Bancos e maquininhas".</p>' + catalogoHTML("bancos", C.bancos, false, "no");
  }

  function secaoMaquinetas() {
    return '<p class="text-sm text-muted" style="margin-bottom:12px">Além do passo a passo, marque ' +
      'as operadoras de <strong>Modo Contador</strong>: nelas o portal deixa de pedir senha e passa ' +
      'a pedir só a confirmação de que o cadastro foi feito.</p>' +
      catalogoHTML("maquinetas", C.maquinetas, true, "na");
  }

  /* ---------- Etapas da migração e formas de relatório ----------

     Os últimos textos de cliente que só mudavam por código. A
     trilha "Como vai funcionar" é a primeira coisa que ele lê no
     portal, e as duas formas de relatório são o que ele lê antes
     de decidir se entrega a senha da maquininha ou se manda os
     relatórios à mão.

     Não dá para acrescentar nem remover linha: cada etapa está
     amarrada a uma tela e cada forma a uma regra do sistema. O
     que se edita aqui é o que se lê — o que o sistema faz com
     elas continua no código, e é por isso que não há botão de
     adicionar. */
  function secaoEtapas() {
    return '<p class="text-sm text-muted" style="margin-bottom:12px">Os passos que o cliente vê na ' +
      'trilha da tela inicial. A ordem e a quantidade são fixas — cada passo leva a uma tela do ' +
      'portal.</p>' +
      (C.etapas || []).map(function (e, i) {
        return caixaRecolhivel({
          chave: "etapa." + i,
          titulo: e.titulo || "(sem título)",
          resumo: e.rota ? "leva para " + e.rota : "informativa — depende da Totali",
          corpo: function () {
            return campo("Título", "etapas." + i + ".titulo", e.titulo, { max: 80 }) +
              campo("Descrição", "etapas." + i + ".desc", e.desc, { max: 300, linhas: 2 }) +
              (e.acao !== undefined
                ? campo("Texto do botão", "etapas." + i + ".acao", e.acao,
                        { max: 60, dica: "O que aparece escrito no botão que leva para a tela." })
                : '<p class="text-xs text-muted">Este passo não tem botão: quem age é a Totali.</p>');
          }
        });
      }).join("") +

      '<hr class="hr">' +
      '<h3 style="font-size:14px;font-weight:650;margin-bottom:4px">Formas de enviar os relatórios</h3>' +
      '<p class="text-xs text-muted" style="margin-bottom:14px">As duas opções da tela de ' +
        'maquininhas. É o texto que o cliente lê antes de decidir entregar a senha ou não — ' +
        'vale a pena ser exato aqui.</p>' +
      (C.formasRelatorio || []).map(function (f, i) {
        return caixaRecolhivel({
          chave: "forma." + i,
          titulo: f.titulo || "(sem título)",
          resumo: f.recomendado ? "marcada como Mais prático" : "",
          corpo: function () {
            return campo("Título", "formasRelatorio." + i + ".titulo", f.titulo, { max: 120 }) +
              campo("Explicação", "formasRelatorio." + i + ".desc", f.desc, { max: 600, linhas: 4 });
          }
        });
      }).join("");
  }

  /* ---------- Aviso automático de pendências ----------

     A hora saiu do código. O Cloud Scheduler não deixa mudar o
     cron sem publicar as funções, então a rotina passou a acordar
     de hora em hora e só trabalhar quando o relógio de Brasília
     bate com o que está escolhido aqui. Muda no painel, vale no
     dia seguinte — sem deploy.

     Quem manda a mensagem continua sendo a função, com as travas
     de sempre: só quem está parado há uma semana, no máximo um
     aviso por semana por empresa, e nunca para quem só tem
     documento opcional faltando. */
  function secaoLembretes() {
    var l = C.lembretes || {};
    var horas = [];
    for (var h = 0; h <= 23; h++) horas.push({ v: String(h), r: (h < 10 ? "0" : "") + h + ":00" });

    return '<p class="text-sm text-muted" style="margin-bottom:14px">Quando um cliente fica uma ' +
      'semana parado com documento obrigatório faltando, o sistema escreve na conversa dele. ' +
      'Nunca mais de um aviso por semana para a mesma empresa.</p>' +

      marcador("Manter o aviso automático ligado", "lembretes.ligado", l.ligado !== false) +

      selecao("Horário", "lembretes.hora", String(l.hora === undefined ? 10 : l.hora), horas) +
      '<p class="text-xs text-muted" style="margin:-6px 0 14px">Horário de Brasília. A rotina ' +
        'confere de hora em hora e só age na hora marcada.</p>' +

      /* Marcador, e não lista de duas opções: o valor precisa
         chegar ao servidor como sim ou não de verdade. Uma lista
         gravaria o texto "nao", que não é `false` — e o aviso
         sairia no sábado sem ninguém entender por quê. */
      marcador("Só em dias úteis (segunda a sexta)", "lembretes.diasUteis", l.diasUteis !== false) +

      '<hr class="hr">' +
      '<h3 style="font-size:14px;font-weight:650;margin-bottom:4px">O texto da mensagem</h3>' +
      '<p class="text-xs text-muted" style="margin-bottom:14px">Entra na conversa como mensagem ' +
        'da Totali. <strong>{nome}</strong> vira o primeiro nome do responsável e ' +
        '<strong>{faltam}</strong> vira "faltam 3 documentos obrigatórios".</p>' +
      '<div class="grid-2">' +
        campo("Saudação quando sabemos o nome", "lembretes.saudacaoCom", l.saudacaoCom,
              { max: 200, dica: "Use {nome}." }) +
        campo("Saudação quando não sabemos", "lembretes.saudacaoSem", l.saudacaoSem, { max: 200 }) +
      '</div>' +
      campo("Corpo da mensagem", "lembretes.corpo", l.corpo, { max: 2000, linhas: 6 });
  }

  /* Cada seção com seu próprio ícone e um selo de estado. A pessoa
     bate o olho e sabe o que está publicado e o que falta, sem
     abrir uma por uma. */
  /* ============================================================
     Índice à esquerda, conteúdo à direita

     Eram oito cartões dobráveis empilhados, todos com o mesmo
     peso: o vídeo que muda toda semana e o endereço da empresa,
     que muda uma vez por ano, ocupavam o mesmo espaço. E para
     comparar duas seções era preciso abrir uma, fechar, abrir a
     outra.

     Agora a lista das oito fica sempre visível de um lado e o que
     se está editando ocupa o outro. Trocar de assunto é um
     clique, e a página inteira nunca sai de vista.
     ============================================================ */
  var secaoAberta = "video";

  /* Só junta os dados. Quem desenha é montarConteudo(). */
  function secao(o) { return o; }

  /* Capa. É o que transforma uma lista de códigos numa lista de
     vídeos: dá para ver na hora se o link colado é mesmo a aula
     certa.

     Ordem: capa enviada pela equipe primeiro, miniatura do YouTube
     depois. A mesma ordem que o portal usa — se as duas telas
     discordassem, a equipe editaria às cegas. */
  function capaDe(item, classe) {
    var propria = DATA.capaSegura(item && item.capa);
    if (propria) {
      return '<img class="capa ' + (classe || "") + '" loading="lazy" alt="" ' +
        'src="' + U.escAttr(propria) + '">';
    }
    var id = (item && item.youtube) || "";
    if (!ID_YT.test(id)) {
      return '<span class="capa capa--vazia ' + (classe || "") + '">' +
        UI.icone("ic-play") + '</span>';
    }
    return '<img class="capa ' + (classe || "") + '" loading="lazy" alt="" ' +
      'src="https://i.ytimg.com/vi/' + U.escAttr(id) + '/mqdefault.jpg">';
  }

  /* ------------------------------------------------------------
     Capa enviada pela equipe

     POR QUE A MINIATURA DO YOUTUBE É COPIADA, E NÃO APONTADA
     -------------------------------------------------------
     O portal já sabe cair na miniatura do YouTube sozinho, e isso
     continua valendo como padrão. Mas apontar significa que o
     navegador de CADA cliente busca a imagem no servidor do
     Google — e aí o Google fica sabendo quem abriu o portal e
     quando. É o mesmo motivo pelo qual o mapa da tela de Ajuda só
     carrega quando a pessoa pede.

     "Usar a do YouTube" resolve os dois lados: a equipe clica, o
     PAINEL baixa a imagem (só uma vez, no computador de quem está
     editando) e guarda no nosso Storage. O cliente passa a receber
     a capa da nossa própria origem. De brinde, a capa congela —
     miniatura do YouTube muda quando o dono troca, e uma trilha
     não deveria mudar de cara sozinha.
     ------------------------------------------------------------ */
  var TAMANHOS_YT = ["maxresdefault", "hqdefault"];

  function baixarDoYoutube(id) {
    var tentar = function (i) {
      if (i >= TAMANHOS_YT.length) {
        return Promise.reject(new Error("O YouTube não tem capa para este vídeo."));
      }
      return fetch("https://i.ytimg.com/vi/" + id + "/" + TAMANHOS_YT[i] + ".jpg")
        .then(function (r) {
          /* 404 vem com uma imagem cinza de 120x90 no corpo — se a
             gente olhasse só o blob, guardaria o borrão. */
          if (!r.ok) return tentar(i + 1);
          return r.blob();
        }, function () { return tentar(i + 1); });
    };
    return tentar(0);
  }

  function subirCapa(blob) {
    var FB = global.FB;
    if (!FB || !FB.ligado || !FB.equipe) {
      return Promise.reject(new Error("Sem conexão com o servidor."));
    }
    if (blob.size > 5 * 1024 * 1024) {
      return Promise.reject(new Error("A imagem passa de 5 MB. Reduza antes de enviar."));
    }
    var tipo = blob.type || "image/jpeg";
    if (!/^image\/(jpeg|png|webp)$/.test(tipo)) {
      return Promise.reject(new Error("Use JPG, PNG ou WEBP."));
    }
    var ext = tipo === "image/png" ? "png" : (tipo === "image/webp" ? "webp" : "jpg");
    /* Nome novo a cada envio: sobrescrever deixaria a capa velha
       no cache do navegador de quem já viu. */
    var nome = "publico/academy/" + FB.novoCodigo() + "." + ext;
    var ref = FB.storage.ref(nome);
    return ref.put(blob, {
      contentType: tipo,
      cacheControl: "public, max-age=31536000, immutable"
    }).then(function () { return ref.getDownloadURL(); });
  }

  /* MATERIAL DA AULA: o áudio para ouvir no carro e o PDF de
     acompanhamento (pedido dele, 2026-08-25).

     Mesma pasta e mesmo cuidado da capa — `publico/academy/`, nome
     sorteado a cada envio. Nome novo importa aqui pelo mesmo motivo
     de lá: sobrescrever deixaria o arquivo velho no cache de quem já
     baixou, e num ÁUDIO isso é pior, porque a pessoa levaria a
     versão errada para o carro sem perceber.

     Limite maior que o da capa: aula de dez minutos em MP3 passa
     folgado de 5 MB. Vinte e cinco cobre uma aula longa sem virar
     desculpa para subir arquivo sem compressão. */
  var LIMITE_MATERIAL = 25 * 1024 * 1024;

  var TIPOS_AUDIO = {
    "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/mp4": "m4a",
    "audio/x-m4a": "m4a", "audio/aac": "m4a", "audio/ogg": "ogg",
    "audio/opus": "opus", "audio/wav": "wav", "audio/x-wav": "wav"
  };

  function subirMaterial(blob, tipoEsperado) {
    var FB = global.FB;
    if (!FB || !FB.ligado || !FB.equipe) {
      return Promise.reject(new Error("Sem conexão com o servidor."));
    }
    if (blob.size > LIMITE_MATERIAL) {
      return Promise.reject(new Error(
        "O arquivo passa de 25 MB. Comprima o áudio antes de enviar."));
    }

    var tipo = blob.type || "";
    var ext;
    if (tipoEsperado === "pdf") {
      if (tipo !== "application/pdf") return Promise.reject(new Error("Envie um PDF."));
      ext = "pdf";
    } else {
      ext = TIPOS_AUDIO[tipo];
      if (!ext) {
        return Promise.reject(new Error("Envie um áudio em MP3, M4A, OGG, OPUS ou WAV."));
      }
    }

    var nome = "publico/academy/" + FB.novoCodigo() + "." + ext;
    var ref = FB.storage.ref(nome);

    /* BAIXAR, E NÃO ABRIR — e isto tem que ficar no ARQUIVO.

       O atributo `download` do link é IGNORADO quando o endereço é
       de outro domínio, e o nosso Storage é outro domínio. Sem o
       cabeçalho abaixo, tocar em "Baixar o áudio" abriria um player
       no navegador em vez de salvar no aparelho — inútil para quem
       quer levar a aula para o carro, que é o pedido inteiro.

       O nome vai limpo de aspas, barras e quebras de linha: ele
       entra num cabeçalho HTTP, e cabeçalho aceita injeção como
       qualquer outro texto montado por concatenação. */
    var seguro = String(blob.name || "")
      .replace(/[\r\n"\\/]+/g, " ")
      .replace(/[^\x20-\x7E]/g, "")
      .trim()
      .slice(0, 120) || ("aula." + ext);

    return ref.put(blob, {
      contentType: tipo,
      cacheControl: "public, max-age=31536000, immutable",
      contentDisposition: 'attachment; filename="' + seguro + '"'
    }).then(function () { return ref.getDownloadURL(); });
  }

  /* Grava o material no rascunho. Guarda também o NOME original: é
     ele que o navegador usa ao salvar, e "aula-3-guias.mp3" na lista
     do rádio do carro é bem melhor do que um código sorteado. */
  function definirMaterial(caminho, qual, url, nomeArquivo) {
    var partes = caminho.split(".");
    var alvo = C;
    for (var i = 0; i < partes.length; i++) {
      alvo = alvo[partes[i]];
      if (!alvo) return false;
    }
    alvo[qual] = url || "";
    alvo[qual + "Nome"] = url ? String(nomeArquivo || "").slice(0, 160) : "";
    gravar();
    desenhar();
    return true;
  }

  function trocarMaterial(caminho, qual) {
    if (qual === "tirar-audio") return definirMaterial(caminho, "audio", "");
    if (qual === "tirar-pdf") return definirMaterial(caminho, "pdf", "");

    var entrada = document.createElement("input");
    entrada.type = "file";
    entrada.accept = qual === "pdf"
      ? "application/pdf"
      : "audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,audio/ogg,audio/opus,audio/wav";
    entrada.style.display = "none";
    entrada.addEventListener("change", function () {
      var f = entrada.files && entrada.files[0];
      entrada.remove();
      if (!f) return;
      UI.toast("Enviando " + f.name + "…", "ok", 4000);
      subirMaterial(f, qual).then(function (url) {
        definirMaterial(caminho, qual, url, f.name);
        UI.toast(qual === "pdf" ? "PDF enviado." : "Áudio enviado.", "ok");
      }, function (e) {
        UI.toast(e.message || "Não foi possível enviar.", "erro", 9000);
      });
    });
    document.body.appendChild(entrada);
    entrada.click();
  }

  /* Grava a capa no rascunho e redesenha. `caminho` é o mesmo
     endereço usado nos campos: "academy.0.videos.2". */
  function definirCapa(caminho, url) {
    var partes = caminho.split(".");
    var alvo = C;
    for (var i = 0; i < partes.length; i++) {
      alvo = alvo[partes[i]];
      if (!alvo) return false;
    }
    alvo.capa = url || "";
    gravar();
    desenhar();
    return true;
  }

  function trocarCapa(caminho, origem) {
    var partes = caminho.split(".");
    var alvo = C;
    for (var i = 0; i < partes.length; i++) { alvo = alvo[partes[i]]; if (!alvo) return; }

    if (origem === "tirar") {
      definirCapa(caminho, "");
      UI.toast("Capa removida. Volta a valer a do YouTube, quando houver.", "ok", 4000);
      return;
    }

    if (origem === "youtube") {
      var id = extrairIdYt(alvo.youtube);
      if (!ID_YT.test(id)) {
        UI.toast("Cole o link do YouTube antes de puxar a capa.", "erro", 6000);
        return;
      }
      UI.toast("Baixando a capa do YouTube…", "", 3000);
      baixarDoYoutube(id).then(subirCapa).then(function (url) {
        definirCapa(caminho, url);
        UI.toast("Capa guardada no nosso servidor.", "ok", 4000);
      }, function (e) {
        UI.toast("Não deu para usar a capa do YouTube: " + (e.message || e), "erro", 9000);
      });
      return;
    }

    /* origem === "arquivo" */
    var entrada = document.createElement("input");
    entrada.type = "file";
    entrada.accept = "image/jpeg,image/png,image/webp";
    entrada.addEventListener("change", function () {
      var arq = entrada.files && entrada.files[0];
      if (!arq) return;
      UI.toast("Enviando…", "", 3000);
      subirCapa(arq).then(function (url) {
        definirCapa(caminho, url);
        UI.toast("Capa enviada.", "ok", 4000);
      }, function (e) {
        UI.toast("Não foi possível enviar: " + (e.message || e), "erro", 9000);
      });
    });
    entrada.click();
  }

  /* A fileira de botões que aparece embaixo de cada capa. */
  function botoesCapa(caminho, item) {
    var tem = !!DATA.capaSegura(item && item.capa);
    var temVideo = ID_YT.test(extrairIdYt((item && item.youtube) || ""));
    return '<span class="capa-acoes">' +
      (temVideo
        ? '<button type="button" class="ac-mini ac-mini--txt" data-capa="youtube|' +
          U.escAttr(caminho) + '">Usar a do YouTube</button>'
        : '') +
      '<button type="button" class="ac-mini ac-mini--txt" data-capa="arquivo|' +
        U.escAttr(caminho) + '">Enviar imagem</button>' +
      (tem
        ? '<button type="button" class="ac-mini ac-mini--txt" data-capa="tirar|' +
          U.escAttr(caminho) + '">Tirar</button>'
        : '') +
    '</span>';
  }

  /* O que o cliente pode levar embora desta aula. Fica junto do
     estado da aula, e não escondido atrás de outro clique: material
     que ninguém lembra de subir é material que não existe. */
  function materialBtns(caminho, v) {
    var temAudio = !!DATA.materialSeguro(v && v.audio);
    var temPdf = !!DATA.materialSeguro(v && v.pdf);
    var nome = function (u) { return u ? U.esc(String(u).slice(0, 40)) : ""; };

    return '<span class="ac-material">' +
      '<button type="button" class="ac-mini ac-mini--txt" data-material="audio|' +
        U.escAttr(caminho) + '">' + (temAudio ? "Trocar o áudio" : "Enviar áudio") + '</button>' +
      (temAudio
        ? '<span class="ac-material__n" title="' + U.escAttr(v.audioNome || "") + '">' +
            nome(v.audioNome || "áudio enviado") + '</span>' +
          '<button type="button" class="ac-mini ac-mini--txt" data-material="tirar-audio|' +
            U.escAttr(caminho) + '">Tirar</button>'
        : '') +
      '<button type="button" class="ac-mini ac-mini--txt" data-material="pdf|' +
        U.escAttr(caminho) + '">' + (temPdf ? "Trocar o PDF" : "Enviar PDF") + '</button>' +
      (temPdf
        ? '<span class="ac-material__n" title="' + U.escAttr(v.pdfNome || "") + '">' +
            nome(v.pdfNome || "PDF enviado") + '</span>' +
          '<button type="button" class="ac-mini ac-mini--txt" data-material="tirar-pdf|' +
            U.escAttr(caminho) + '">Tirar</button>'
        : '') +
    '</span>';
  }

  /* ---------- Seções ---------- */
  function secaoOrg() {
    var o = C.org;
    return campo("Nome completo", "org.nome", o.nome) +
      '<div class="grid-2">' +
        campo("Nome curto", "org.curto", o.curto, { max: 40 }) +
        campo("Horário de atendimento", "org.horario", o.horario) +
      '</div>' +
      '<div class="grid-2">' +
        campo("E-mail", "org.email", o.email, { tipo: "email" }) +
        campo("Telefone exibido", "org.telefoneExibicao", o.telefoneExibicao) +
      '</div>' +
      '<div class="grid-2">' +
        campo("WhatsApp (só números, com 55)", "org.whatsapp", o.whatsapp,
              { dica: "Ex.: 5579998412107" }) +
        campo("Site", "org.site", o.site, { dica: "Precisa começar com https://" }) +
      '</div>' +
      '<hr class="hr">' +
      '<h3 style="font-size:14px;font-weight:650;margin-bottom:12px">Endereço e mapa</h3>' +
      campo("Endereço", "org.local.endereco", o.local.endereco) +
      '<div class="grid-2">' +
        campo("Cidade e estado", "org.local.cidade", o.local.cidade) +
        campo("CEP", "org.local.cep", o.local.cep, { max: 12 }) +
      '</div>' +
      '<div class="grid-2">' +
        campo("Latitude", "org.local.lat", o.local.lat, { max: 20 }) +
        campo("Longitude", "org.local.lng", o.local.lng, { max: 20 }) +
      '</div>' +
      campo("Link do Google Maps", "org.local.link", o.local.link, { max: 300 });
  }

  function secaoVideo() {
    var v = C.videoInicio;
    return '<div class="previa">' +
        '<span class="previa__capa">' +
          capaDe(v, "capa--larga") +
          botoesCapa("videoInicio", v) +
        '</span>' +
        '<div class="previa__txt">' +
          '<div class="previa__t">' + U.esc(v.titulo || "(sem título)") + '</div>' +
          '<div class="previa__d">' + U.esc(v.desc || "") + '</div>' +
          '<div class="previa__m">' +
            (ID_YT.test(v.youtube)
              ? "Publicado" + (v.duracao ? " · " + U.esc(v.duracao) : "")
              : "Sem vídeo — o espaço fica reservado no portal") + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="notice notice--info" style="margin:14px 0 16px">' +
        '<span class="notice__icon">' + UI.icone("ic-alert") + '</span>' +
        '<span>Suba no YouTube como <strong>não listado</strong> e cole o link. Vídeo privado não ' +
        'toca em site nenhum. A capa vem sozinha do YouTube.</span></div>' +
      campo("Link ou ID do YouTube", "videoInicio.youtube", v.youtube, { max: 200 }) +
      campo("Título", "videoInicio.titulo", v.titulo, { max: 140 }) +
      campo("Descrição", "videoInicio.desc", v.desc, { max: 400, linhas: 3 }) +
      campo("Duração", "videoInicio.duracao", v.duracao, { max: 20, placeholder: "4 min" });
  }

  function secaoAcademy() {
    return (C.academy || []).map(function (t, i) {
      var pub = (t.videos || []).filter(function (v) { return ID_YT.test(v.youtube); }).length;
      var primeira = (t.videos || []).filter(function (v) { return ID_YT.test(v.youtube); })[0];
      return caixaRecolhivel({
        chave: "academy." + i,
        titulo: t.titulo || "(sem título)",
        resumo: pub + " de " + (t.videos || []).length + " publicadas",
        antes: '<span class="capa-caixa">' +
            /* Sem capa própria, a trilha herda a do 1º vídeo
               publicado — é o que o portal mostra. */
            capaDe(t.capa ? t : { capa: "", youtube: primeira ? primeira.youtube : "" },
                   "capa--trilha") +
            botoesCapa("academy." + i, t) +
          '</span>',
        depois: ordemBtns("academy", i) +
          '<button type="button" class="ac-mini ac-mini--x" data-remove="academy:' + i + '" ' +
            'aria-label="Remover trilha">&#215;</button>',
        corpo: function () {
          return '<div class="grid-2">' +
          campo("Título", "academy." + i + ".titulo", t.titulo, { max: 120 }) +
          campo("Etiqueta", "academy." + i + ".kicker", t.kicker, { max: 40 }) +
        '</div>' +
        campo("Descrição", "academy." + i + ".desc", t.desc, { max: 400, linhas: 2 }) +
        '<div class="ac-aulas">' +
          (t.videos || []).map(function (v, j) {
            var ok = ID_YT.test(v.youtube);
            return '<div class="ac-aula">' + ordemBtns("academy." + i + ".videos", j) +
              '<span class="capa-caixa">' +
                capaDe(v, "capa--aula") +
                botoesCapa("academy." + i + ".videos." + j, v) +
              '</span>' +
              '<span class="ac-aula__campos">' +
                '<input type="text" class="input" data-campo="academy.' + i + '.videos.' + j + '.titulo" ' +
                  'maxlength="140" placeholder="Título da aula" value="' + U.escAttr(v.titulo || "") + '">' +
                '<span class="ac-aula__linha">' +
                  '<input type="text" class="input" data-campo="academy.' + i + '.videos.' + j + '.youtube" ' +
                    'data-yt="1" placeholder="Link ou ID do YouTube" value="' + U.escAttr(v.youtube || "") + '">' +
                  '<input type="text" class="input" data-campo="academy.' + i + '.videos.' + j + '.duracao" ' +
                    'maxlength="20" placeholder="4 min" style="max-width:110px" value="' + U.escAttr(v.duracao || "") + '">' +
                '</span>' +
                '<span class="ac-aula__estado' + (ok ? " ok" : "") + '">' +
                  (ok
                    ? "Publicada · capa " + (DATA.capaSegura(v.capa) ? "nossa" : "do YouTube")
                    : "Em breve · sem vídeo") + '</span>' +
                materialBtns("academy." + i + ".videos." + j, v) +
              '</span>' +
              '<button type="button" class="ac-mini ac-mini--x" data-remove="academy.' + i + '.videos:' + j +
                '" aria-label="Remover aula">&#215;</button></div>';
          }).join("") +
          '<button type="button" class="btn btn--ghost btn--sm" data-add="academy.' + i + '.videos">' +
            'Adicionar aula</button>' +
        '</div>';
        }
      });
    }).join("") +
    '<button type="button" class="btn btn--ghost btn--sm" data-add="academy">Adicionar trilha</button>';
  }

  function secaoGrupos() {
    var ICONES = [
      { v: "ic-scroll", r: "Pergaminho" }, { v: "ic-calculator", r: "Calculadora" },
      { v: "ic-receipt", r: "Recibo" }, { v: "ic-users", r: "Pessoas" },
      { v: "ic-badge", r: "Crachá" }, { v: "ic-file", r: "Documento" },
      { v: "ic-card", r: "Cartão" }, { v: "ic-building", r: "Prédio" }
    ];
    return '<div class="notice notice--warn" style="margin-bottom:16px">' +
        '<span class="notice__icon">' + UI.icone("ic-alert") + '</span>' +
        '<span>Mexer aqui muda o que o cliente precisa enviar. Documento removido some da lista, ' +
        'mas o que já foi enviado continua guardado.</span></div>' +
      (C.grupos || []).map(function (g, i) {
        return caixaRecolhivel({
          chave: "grupos." + i,
          titulo: g.titulo || "(sem título)",
          resumo: (g.itens || []).length + " documentos · " +
                  (g.escopo === "socio" ? "por sócio" : "por empresa"),
          antes: '<span class="group__icon" style="width:38px;height:38px;border-radius:11px;flex:none">' +
              UI.icone(g.icone || "ic-file") + '</span>',
          depois: ordemBtns("grupos", i) +
            '<button type="button" class="ac-mini ac-mini--x" data-remove="grupos:' + i + '" ' +
              'aria-label="Remover departamento">&#215;</button>',
          corpo: function () {
            return '<div class="grid-2">' +
            campo("Nome do departamento", "grupos." + i + ".titulo", g.titulo, { max: 80 }) +
            selecao("Ícone", "grupos." + i + ".icone", g.icone, ICONES) +
          '</div>' +
          selecao("Escopo", "grupos." + i + ".escopo", g.escopo,
                  [{ v: "empresa", r: "Um por empresa" }, { v: "socio", r: "Um por sócio" }]) +
          campo("Descrição", "grupos." + i + ".desc", g.desc, { max: 400, linhas: 2 }) +
          marcador("Permitir marcar o departamento inteiro como não aplicável",
                   "grupos." + i + ".permiteGrupoNA", g.permiteGrupoNA === true) +
          (g.permiteGrupoNA
            ? campo("Texto da opção", "grupos." + i + ".textoGrupoNA", g.textoGrupoNA, { max: 160 })
            : "") +

          '<div class="ac-aulas">' +
            (g.itens || []).map(function (it, j) {
              var base = "grupos." + i + ".itens." + j;
              var aberto = !!abertos[base];
              return '<div class="ac-aula" style="flex-direction:column;align-items:stretch">' +
                '<div class="row" style="gap:10px;flex-wrap:nowrap">' +
                  ordemBtns("grupos." + i + ".itens", j) +
                  '<span class="ac-aula__n" style="margin-top:0">' + (j + 1) + '</span>' +
                  '<span style="flex:1;min-width:0">' +
                    '<span class="ac-trilha__t" style="font-size:13.5px">' + U.esc(it.nome || "(sem nome)") + '</span>' +
                    '<span class="ac-trilha__d">' + U.esc(it.kind) +
                      (it.obrigatorio ? " · obrigatório" : " · opcional") + '</span>' +
                  '</span>' +
                  '<button type="button" class="btn btn--quiet btn--sm" data-secao="' + U.escAttr(base) + '">' +
                    (aberto ? "Fechar" : "Editar") + '</button>' +
                  '<button type="button" class="ac-mini ac-mini--x" data-remove="grupos.' + i + '.itens:' + j +
                    '" aria-label="Remover">&#215;</button>' +
                '</div>' +
                (aberto ? '<div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--stroke)">' +
                  campo("Nome do documento", base + ".nome", it.nome, { max: 140 }) +
                  '<div class="grid-2">' +
                    selecao("Tipo", base + ".kind", it.kind,
                            [{ v: "arquivo", r: "Envio de arquivo" }, { v: "dado", r: "Informação digitada" },
                             { v: "acesso", r: "Acesso a sistema" }]) +
                    campo("Resumo", base + ".resumo", it.resumo, { max: 240 }) +
                  '</div>' +
                  marcador("Documento obrigatório", base + ".obrigatorio", it.obrigatorio === true) +
                  campo("O que é", base + ".ajuda.oque", it.ajuda && it.ajuda.oque, { max: 800, linhas: 3 }) +
                  listaTextos("Onde conseguir", base + ".ajuda.onde", (it.ajuda && it.ajuda.onde) || []) +
                  campo("Dica", base + ".ajuda.dica", it.ajuda && it.ajuda.dica, { max: 600, linhas: 2 }) +
                  campo("Título do passo a passo", base + ".ajuda.passosTitulo",
                        it.ajuda && it.ajuda.passosTitulo, { max: 120 }) +
                  listaTextos("Passos", base + ".ajuda.passos", (it.ajuda && it.ajuda.passos) || []) +
                  campo("Nota do passo a passo", base + ".ajuda.passosNota",
                        it.ajuda && it.ajuda.passosNota, { max: 600, linhas: 2 }) +
                  (it.kind === "acesso"
                    ? '<hr class="hr"><h4 style="font-size:13px;font-weight:650;margin-bottom:10px">' +
                      'Campos de acesso pedidos ao cliente</h4>' +
                      (it.credenciais || []).map(function (c, k) {
                        var cb = base + ".credenciais." + k;
                        return '<div class="ac-aula__linha" style="margin-bottom:8px">' +
                          '<input type="text" class="input" data-campo="' + cb + '.rotulo" maxlength="80" ' +
                            'placeholder="Rótulo" value="' + U.escAttr(c.rotulo || "") + '">' +
                          '<select class="select" data-campo="' + cb + '.tipo" style="max-width:130px">' +
                            '<option value="texto"' + (c.tipo !== "senha" ? " selected" : "") + '>Texto</option>' +
                            '<option value="senha"' + (c.tipo === "senha" ? " selected" : "") + '>Senha</option>' +
                          '</select>' +
                          '<button type="button" class="ac-mini ac-mini--x" data-remove="' + base +
                            '.credenciais:' + k + '" aria-label="Remover">&#215;</button></div>';
                      }).join("") +
                      '<button type="button" class="btn btn--quiet btn--sm" data-add="' + base +
                        '.credenciais">Adicionar campo</button>'
                    : "") +
                '</div>' : '') +
              '</div>';
            }).join("") +
            '<button type="button" class="btn btn--ghost btn--sm" data-add="grupos.' + i + '.itens">' +
              'Adicionar documento</button>' +
          '</div>';
          }
        });
      }).join("") +
      '<button type="button" class="btn btn--ghost btn--sm" data-add="grupos">Adicionar departamento</button>';
  }

  function secaoFaq() {
    return (C.faq || []).map(function (f, i) {
      var resposta = String(f.a || "");
      return caixaRecolhivel({
        chave: "faq." + i,
        titulo: f.q || "(sem pergunta)",
        /* Um pedaço da resposta no cabeçalho: dá para achar a
           pergunta certa sem abrir uma por uma. */
        resumo: resposta ? resposta.slice(0, 80) + (resposta.length > 80 ? "…" : "") : "sem resposta",
        antes: '<span class="ac-aula__n" style="margin-top:0">' + (i + 1) + '</span>',
        depois: ordemBtns("faq", i) +
          '<button type="button" class="ac-mini ac-mini--x" data-remove="faq:' + i + '" ' +
            'aria-label="Remover">&#215;</button>',
        corpo: function () {
          return campo("Pergunta", "faq." + i + ".q", f.q, { max: 200 }) +
                 campo("Resposta", "faq." + i + ".a", f.a, { max: 2000, linhas: 4 });
        }
      });
    }).join("") +
    '<button type="button" class="btn btn--ghost btn--sm" data-add="faq">Adicionar pergunta</button>';
  }

  function secaoTextos() {
    var k = C.compromisso, t = C.termo;
    return '<h3 style="font-size:14px;font-weight:650;margin-bottom:12px">Aviso na tela</h3>' +
      campo("Título", "compromisso.titulo", k.titulo, { max: 80 }) +
      campo("Chamada", "compromisso.chamada", k.chamada, { max: 500, linhas: 2 }) +
      listaTextos("Relatórios pedidos", "compromisso.itens", k.itens,
                  "Esta lista também aparece no termo em PDF.") +
      campo("Fecho", "compromisso.fecho", k.fecho, { max: 800, linhas: 3 }) +
      '<hr class="hr">' +
      '<h3 style="font-size:14px;font-weight:650;margin-bottom:12px">Termo em PDF</h3>' +
      '<div class="grid-2">' +
        campo("Título", "termo.titulo", t.titulo, { max: 120 }) +
        campo("Subtítulo", "termo.subtitulo", t.subtitulo, { max: 160 }) +
      '</div>' +
      campo("Declaração", "termo.declaracao", t.declaracao, { max: 3000, linhas: 3 }) +
      campo("Compromisso", "termo.compromisso", t.compromisso, { max: 3000, linhas: 3 }) +
      campo("Título da responsabilidade", "termo.responsabilidadeTitulo", t.responsabilidadeTitulo, { max: 120 }) +
      campo("Responsabilidade", "termo.responsabilidade", t.responsabilidade, { max: 3000, linhas: 4 }) +
      campo("Título da ciência", "termo.cienciaTitulo", t.cienciaTitulo, { max: 120 }) +
      campo("Ciência eletrônica", "termo.ciencia", t.ciencia, { max: 3000, linhas: 3 });
  }

  /* ---------- Desenho ---------- */
  function desenhar() {
    var docs = (C.grupos || []).reduce(function (a, g) { return a + (g.itens || []).length; }, 0);
    var aulas = (C.academy || []).reduce(function (a, t) { return a + (t.videos || []).length; }, 0);

    var aulasPub = (C.academy || []).reduce(function (a, t) {
      return a + (t.videos || []).filter(function (v) { return ID_YT.test(v.youtube); }).length;
    }, 0);
    var temVideo = ID_YT.test(C.videoInicio.youtube);

    /* Ordem pensada pelo uso, não pela estrutura do arquivo: em
       cima o que a equipe mexe toda semana (vídeos, documentos),
       embaixo o que quase nunca muda (contato, endereço, textos
       jurídicos). Pedido do Raoni depois de usar a tela. */
    var SECOES = [
      secao({
        id: "video", icone: "ic-play", titulo: "Vídeo de abertura",
        resumo: "O primeiro vídeo que o cliente vê na tela inicial",
        selo: temVideo ? "Publicado" : "Sem vídeo", seloOk: temVideo, corpo: secaoVideo
      }),
      secao({
        id: "academy", icone: "ic-play", titulo: "Academy",
        resumo: (C.academy || []).length + " trilhas · " + aulas + " aulas",
        selo: aulasPub + " no ar", seloOk: aulasPub > 0, corpo: secaoAcademy
      }),
      secao({
        id: "grupos", icone: "ic-folder", titulo: "Documentos do checklist",
        resumo: (C.grupos || []).length + " departamentos · " + docs + " documentos",
        corpo: secaoGrupos
      }),
      secao({
        id: "bancos", icone: "ic-card", titulo: "Bancos",
        resumo: (C.bancos || []).length + " na lista · " +
          (C.bancos || []).filter(function (b) { return b.orientacao; }).length + " com orientação",
        corpo: secaoBancos
      }),
      secao({
        id: "maquinetas", icone: "ic-card", titulo: "Maquininhas",
        resumo: (C.maquinetas || []).length + " na lista · " +
          (C.maquinetas || []).filter(function (m) { return m.semCredencial; }).length +
          " em Modo Contador",
        corpo: secaoMaquinetas
      }),
      secao({
        id: "etapas", icone: "ic-bussola", titulo: "Etapas da migração",
        resumo: (C.etapas || []).length + " passos na trilha · " +
          (C.formasRelatorio || []).length + " formas de relatório",
        corpo: secaoEtapas
      }),
      secao({
        id: "lembretes", icone: "ic-clock", titulo: "Aviso automático",
        resumo: (C.lembretes && C.lembretes.ligado === false)
          ? "desligado"
          : "todo dia às " + ((C.lembretes && C.lembretes.hora) || 10) + "h" +
            ((C.lembretes && C.lembretes.diasUteis !== false) ? ", dias úteis" : ", todos os dias"),
        corpo: secaoLembretes
      }),
      secao({
        id: "faq", icone: "ic-help", titulo: "Perguntas frequentes",
        resumo: (C.faq || []).length + " perguntas na tela de Ajuda",
        corpo: secaoFaq
      }),
      secao({
        id: "textos", icone: "ic-scroll", titulo: "Compromisso e termo",
        resumo: "Textos do aviso na tela e do PDF assinado", corpo: secaoTextos
      }),
      secao({
        id: "org", icone: "ic-building", titulo: "Contatos e endereço",
        resumo: "Muda raramente — " + C.org.telefoneExibicao + " · " + C.org.horario,
        corpo: secaoOrg
      })
    ];

    /* As seções de administrador somem para quem não é. Ver a nota
       em SO_ADMIN: aqui é conforto, a barreira é a regra. */
    if (!souAdmin()) {
      SECOES = SECOES.filter(function (x) { return SO_ADMIN.indexOf(x.id) === -1; });
    }

    /* A seção guardada pode ter sumido — por exemplo, se um dia
       alguma delas deixar de existir, ou se quem abriu não é
       administrador. Cai na primeira. */
    if (!SECOES.some(function (x) { return x.id === secaoAberta; })) {
      secaoAberta = SECOES[0].id;
    }
    var atual = SECOES.filter(function (x) { return x.id === secaoAberta; })[0];

    $("#pcLista").innerHTML =
      '<div class="conteudo">' +
        '<nav class="conteudo__indice" aria-label="Seções do conteúdo">' +
          SECOES.map(function (x) {
            var on = x.id === secaoAberta;
            return '<button type="button" class="conteudo__i' + (on ? " conteudo__i--on" : "") +
              '" data-secao="' + x.id + '" aria-current="' + (on ? "page" : "false") + '">' +
              UI.icone(x.icone || "ic-file") +
              '<span class="conteudo__n">' + U.esc(x.titulo) + '</span>' +
              (x.selo
                ? '<span class="conteudo__s' + (x.seloOk ? " conteudo__s--ok" : "") + '">' +
                  U.esc(x.selo) + '</span>'
                : '') +
            '</button>';
          }).join("") +
        '</nav>' +
        '<section class="conteudo__painel">' +
          '<div class="conteudo__cab">' +
            '<span class="group__icon">' + UI.icone(atual.icone || "ic-file") + '</span>' +
            '<span class="conteudo__tx">' +
              '<span class="conteudo__t">' + U.esc(atual.titulo) + '</span>' +
              '<span class="conteudo__d">' + U.esc(atual.resumo || "") + '</span>' +
            '</span>' +
            (atual.selo
              ? '<span class="badge ' + (atual.seloOk ? "badge--aprovado" : "badge--pendente") +
                '"><span class="dot"></span>' + U.esc(atual.selo) + '</span>'
              : '') +
          '</div>' +
          '<div class="conteudo__corpo">' + atual.corpo() + '</div>' +
        '</section>' +
      '</div>';

    $("#pcResumo").textContent = docs + " documentos · " + (C.academy || []).length +
      " trilhas · " + (C.faq || []).length + " perguntas";
    gravar();
  }

  /* ---------- Caminhos ---------- */
  function pegar(caminho) {
    return caminho.split(".").reduce(function (o, k) {
      return (o === null || o === undefined) ? o : o[k];
    }, C);
  }

  function definir(caminho, valor) {
    var p = caminho.split(".");
    var ultimo = p.pop();
    var alvo = p.reduce(function (o, k) { return o[k]; }, C);
    if (alvo) alvo[ultimo] = valor;
  }

  var MODELOS = {
    academy: function () { return { id: "", kicker: "", titulo: "", desc: "", capa: "", videos: [] }; },
    videos: function () { return { titulo: "", duracao: "", desc: "", youtube: "", capa: "" }; },
    grupos: function () {
      return { id: "", escopo: "empresa", icone: "ic-file", titulo: "", desc: "", itens: [] };
    },
    itens: function () {
      return { id: "", kind: "arquivo", nome: "", obrigatorio: false, resumo: "",
               ajuda: { oque: "", onde: [], dica: "", passosTitulo: "", passos: [], passosNota: "" } };
    },
    credenciais: function () { return { id: "", rotulo: "", tipo: "texto", dica: "", placeholder: "" }; },
    faq: function () { return { q: "", a: "" }; },
    bancos: function () { return { nome: "", orientacao: "" }; },
    maquinetas: function () { return { nome: "", orientacao: "", semCredencial: false }; }
  };

  function modeloDe(caminho) {
    var fim = caminho.split(".").pop();
    return MODELOS[fim] ? MODELOS[fim]() : "";
  }

  /* ---------- Geração do conteúdo ----------

     UMA montagem só, dois destinos: o servidor (Publicar) e o
     arquivo de reserva (Baixar cópia). Se cada caminho montasse o
     seu, os dois divergiriam na primeira vez que alguém mexesse num
     só — e o defeito apareceria semanas depois, no caminho menos
     usado, que é o pior lugar para um defeito aparecer. */
  function montarBlocos() {
    var saida = clonar(C);
    saida.atualizadoEm = Date.now();
    saida.versao = 1;

    /* Ids estáveis a partir do texto, para não depender do que o
       painel gerou nem quebrar dado já enviado sem necessidade. */
    (saida.grupos || []).forEach(function (g, i) {
      if (!g.id) g.id = "grupo-" + (i + 1);
      (g.itens || []).forEach(function (it, j) { if (!it.id) it.id = "item-" + (j + 1); });
    });
    (saida.academy || []).forEach(function (t, i) { if (!t.id) t.id = "trilha-" + (i + 1); });
    return saida;
  }

  function montarArquivo() {
    var saida = montarBlocos();

    return "/* ============================================================\n" +
      "   Totali · Portal de Onboarding\n" +
      "   conteudo.js — conteúdo do portal\n\n" +
      "   ARQUIVO GERADO PELO PAINEL DA EQUIPE. Não edite à mão:\n" +
      "   abra equipe.html, altere na tela e baixe de novo.\n\n" +
      "   Gerado em " + new Date().toLocaleString("pt-BR") + "\n" +
      "   ============================================================ */\n" +
      "window.CONTEUDO = " + JSON.stringify(saida, null, 2) + ";\n";
  }

  /* PUBLICAR: o rascunho vai para o servidor e os clientes passam a
     ver. Sem baixar arquivo, sem substituir nada em `js/`, sem
     publicar o site — que era o passo que contradizia a regra de
     "nada por código".

     Guardo em `conteudo/portal`, campo `blocos`, porque o portal já
     sabe ler dali e a regra do Firestore já permite: leitura livre
     (é o conteúdo do site) e escrita só da equipe.

     Um documento do Firestore cabe 1 MB. O conteúdo inteiro do
     portal, só texto e endereços, fica muito abaixo disso — mas
     confiro antes de mandar, porque estourar o limite daria um erro
     que ninguém entenderia olhando a tela. */
  var LIMITE_DOC = 900 * 1024;

  function publicar() {
    var FB = global.FB;
    if (!FB || !FB.ligado || !FB.equipe) {
      UI.toast("Sem conexão com o servidor. Tente de novo em instantes.", "erro", 8000);
      return;
    }

    var blocos = montarBlocos();
    var tamanho = JSON.stringify(blocos).length;
    if (tamanho > LIMITE_DOC) {
      UI.toast("O conteúdo ficou grande demais para publicar de uma vez (" +
               Math.round(tamanho / 1024) + " KB). Reduza os textos mais longos.", "erro", 12000);
      return;
    }

    var botao = $("#pcPublicar");
    if (botao) { botao.disabled = true; botao.textContent = "Publicando…"; }

    /* QUEM NÃO É ADMINISTRADOR PUBLICA O QUE ESTÁ NO AR, nos
       blocos que não são dele.

       O painel publica o conteúdo inteiro de uma vez, e o rascuho
       local traz os cinco blocos de administrador junto — vindos
       do que estava publicado quando a tela abriu, ou do padrão do
       código. Republicá-los seria devolver uma versão velha por
       cima da atual, sem ninguém ter pedido; e como a regra do
       servidor recusa exatamente essa gravação, o que a pessoa
       veria era o botão falhando sem motivo aparente.

       Então, antes de gravar, copiamos de volta o que está no
       servidor AGORA. O que a pessoa editou nas seções dela sobe;
       o resto sobe idêntico ao que já estava. */
    var soltar = function () {
      if (botao) {
        botao.disabled = false;
        botao.innerHTML = UI.icone("ic-check") + "Publicar para os clientes";
      }
    };

    var enviar = function (base) {
      FB.db.collection("conteudo").doc("portal").set({
        blocos: base,
        atualizadoEm: Date.now(),
        atualizadoPor: (FB.equipe && (FB.equipe.nome || FB.equipe.email)) || "equipe"
      }).then(function () {
        soltar();
        UI.toast("Publicado. Os clientes já veem na próxima vez que abrirem o portal.", "ok", 7000);
      }, function (e) {
        soltar();
        UI.toast("Não foi possível publicar: " + FB.explicar(e), "erro", 9000);
      });
    };

    if (souAdmin()) { enviar(blocos); return; }

    FB.db.collection("conteudo").doc("portal").get().then(function (d) {
      var atual = (d.exists && (d.data() || {}).blocos) || {};
      SO_ADMIN.forEach(function (k) {
        /* Chave que ainda não existe no servidor não pode virar
           `undefined` no que vamos gravar: o Firestore recusa o
           documento inteiro. Some do payload e pronto. */
        if (atual[k] === undefined) delete blocos[k];
        else blocos[k] = atual[k];
      });
      enviar(blocos);
    }, function (e) {
      soltar();
      UI.toast("Não foi possível conferir o conteúdo publicado: " + FB.explicar(e), "erro", 9000);
    });
  }

  function baixar() {
    var blob = new Blob([montarArquivo()], { type: "application/javascript;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = "conteudo.js";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    UI.toast("conteudo.js baixado. Substitua o arquivo em js/ e publique.", "ok", 9000);
  }

  /* ---------- Eventos ---------- */
  function ligar() {
    var lista = $("#pcLista");

    lista.addEventListener("click", function (ev) {
      var b = ev.target.closest("button");
      if (!b) return;

      /* Dois usos do mesmo atributo, e a diferença é o ponto:
         "faq" é uma das oito seções do índice; "grupos.0.itens.1"
         é o editor de um documento lá dentro, que continua
         abrindo e fechando. Sem esta separação, editar um
         documento trocaria a seção inteira. */
      var sec = b.getAttribute("data-secao");
      if (sec) {
        if (sec.indexOf(".") > -1) abertos[sec] = !abertos[sec];
        else secaoAberta = sec;
        desenhar();
        return;
      }

      var capa = b.getAttribute("data-capa");
      if (capa) {
        var corte = capa.indexOf("|");
        trocarCapa(capa.slice(corte + 1), capa.slice(0, corte));
        return;
      }

      var mat = b.getAttribute("data-material");
      if (mat) {
        var corteM = mat.indexOf("|");
        trocarMaterial(mat.slice(corteM + 1), mat.slice(0, corteM));
        return;
      }

      var add = b.getAttribute("data-add");
      if (add) {
        var arr = pegar(add);
        if (Array.isArray(arr)) { arr.push(modeloDe(add)); desenhar(); }
        return;
      }

      var rem = b.getAttribute("data-remove");
      if (rem) {
        var p = rem.split(":");
        var alvo = pegar(p[0]);
        if (Array.isArray(alvo)) { alvo.splice(+p[1], 1); desenhar(); }
        return;
      }

      var sobe = b.getAttribute("data-sobe"), desce = b.getAttribute("data-desce");
      if (sobe || desce) {
        var q = (sobe || desce).split(":");
        var l = pegar(q[0]);
        if (Array.isArray(l) && mover(l, +q[1], +q[1] + (sobe ? -1 : 1))) desenhar();
      }
    });

    lista.addEventListener("input", function (ev) {
      var el = ev.target;
      var caminho = el.getAttribute("data-campo");
      if (!caminho) return;

      if (el.getAttribute("data-yt")) {
        var extraido = extrairIdYt(el.value);
        definir(caminho, extraido || el.value.trim());
        var est = el.closest(".ac-aula").querySelector(".ac-aula__estado");
        var ok = ID_YT.test(pegar(caminho));
        /* Mesmo texto que `secaoAcademy` monta — se divergirem, o
           estado muda sozinho ao redesenhar e parece defeito. */
        var temPropria = !!DATA.capaSegura(pegar(caminho.replace(/\.youtube$/, ".capa")));
        est.textContent = ok
          ? "Publicada · capa " + (temPropria ? "nossa" : "do YouTube")
          : "Em breve · sem vídeo";
        est.classList.toggle("ok", ok);
        if (extraido && el.value.trim() !== extraido) el.value = extraido;
      } else if (el.type === "checkbox") {
        definir(caminho, el.checked);
      } else {
        definir(caminho, el.value);
      }
      salvar();
    });

    /* Checkbox e select precisam redesenhar: mudam o que aparece. */
    lista.addEventListener("change", function (ev) {
      var el = ev.target;
      var caminho = el.getAttribute("data-campo");
      if (!caminho) return;
      if (el.type === "checkbox") { definir(caminho, el.checked); desenhar(); return; }
      if (el.tagName === "SELECT") { definir(caminho, el.value); desenhar(); return; }
      /* Ao sair do campo do vídeo, redesenha para a capa aparecer.
         Durante a digitação não: seria uma capa nova por tecla. */
      if (el.getAttribute("data-yt")) desenhar();
    });

    $("#pcBaixar").addEventListener("click", baixar);
    $("#pcPublicar").addEventListener("click", publicar);

    $("#pcRestaurar").addEventListener("click", function () {
      UI.confirmar({
        titulo: "Descartar rascunho",
        mensagem: "Volta para o conteúdo que está publicado. O que você editou aqui se perde.",
        confirmar: "Descartar", perigo: true
      }).then(function (ok) {
        if (!ok) return;
        try { localStorage.removeItem(CHAVE); } catch (e) {}
        carregar(); desenhar();
        UI.toast("Rascunho descartado.", "ok");
      });
    });
  }

  function iniciar() {
    if (!$("#pcLista") || !DATA) return;
    salvar = U.debounce(gravar, 400);
    var origem = carregar();
    $("#pcOrigem").textContent = {
      rascunho: "Você tem um rascunho salvo neste navegador. Continue de onde parou.",
      publicado: "Carregado o conteúdo publicado no portal.",
      padrao: "Carregado o conteúdo padrão do sistema."
    }[origem];
    desenhar();
    ligar();

    /* REDESENHA QUANDO SOUBER QUEM ENTROU.

       Esta tela é montada assim que o HTML fica pronto, e a sessão
       do Firebase chega depois — então, no primeiro desenho,
       `FB.equipe` ainda é nulo e `souAdmin()` responde não. Sem
       isto, o próprio administrador abria a aba sem as cinco
       seções dele e concluía que tinham sumido. Aconteceu no teste
       desta mudança. */
    if (global.FB && global.FB.observarSessao) {
      global.FB.observarSessao(function () { desenhar(); });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})(window);
