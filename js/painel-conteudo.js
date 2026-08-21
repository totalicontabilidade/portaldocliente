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
      maquinetas: clonar(DATA.MAQUINETAS)
    };
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
      return '<div class="ac-item">' +
        '<div class="ac-item__topo">' +
          '<input type="text" class="input" data-campo="' + U.escAttr(p + ".nome") + '" ' +
            'maxlength="80" value="' + U.escAttr(item.nome || "") + '" placeholder="Nome">' +
          ordemBtns(prefixo, i) +
          '<button type="button" class="ac-mini ac-mini--x" data-remove="' +
            U.escAttr(prefixo + ":" + i) + '" aria-label="Remover">&#215;</button>' +
        '</div>' +
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
        }) +
      '</div>';
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
      return '<div class="ac-trilha">' +
        '<div class="ac-trilha__topo">' + ordemBtns("academy", i) +
          '<span class="capa-caixa">' +
            /* Sem capa própria, a trilha herda a do 1º vídeo
               publicado — é o que o portal mostra. */
            capaDe(t.capa ? t : { capa: "", youtube: primeira ? primeira.youtube : "" },
                   "capa--trilha") +
            botoesCapa("academy." + i, t) +
          '</span>' +
          '<span style="flex:1;min-width:0">' +
            '<span class="ac-trilha__t">' + U.esc(t.titulo || "(sem título)") + '</span>' +
            '<span class="ac-trilha__d">' + pub + ' de ' + (t.videos || []).length + ' publicadas</span>' +
          '</span>' +
          '<button type="button" class="btn btn--quiet btn--sm" data-remove="academy:' + i + '">Remover</button>' +
        '</div>' +
        '<div class="grid-2">' +
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
              '</span>' +
              '<button type="button" class="ac-mini ac-mini--x" data-remove="academy.' + i + '.videos:' + j +
                '" aria-label="Remover aula">&#215;</button></div>';
          }).join("") +
          '<button type="button" class="btn btn--ghost btn--sm" data-add="academy.' + i + '.videos">' +
            'Adicionar aula</button>' +
        '</div></div>';
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
        return '<div class="ac-trilha">' +
          '<div class="ac-trilha__topo">' + ordemBtns("grupos", i) +
            '<span class="group__icon" style="width:38px;height:38px;border-radius:11px;flex:none">' +
              UI.icone(g.icone || "ic-file") + '</span>' +
            '<span style="flex:1;min-width:0">' +
              '<span class="ac-trilha__t">' + U.esc(g.titulo || "(sem título)") + '</span>' +
              '<span class="ac-trilha__d">' + (g.itens || []).length + ' documentos · ' +
                (g.escopo === "socio" ? "por sócio" : "por empresa") + '</span>' +
            '</span>' +
            '<button type="button" class="btn btn--quiet btn--sm" data-remove="grupos:' + i + '">Remover</button>' +
          '</div>' +
          '<div class="grid-2">' +
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
          '</div></div>';
      }).join("") +
      '<button type="button" class="btn btn--ghost btn--sm" data-add="grupos">Adicionar departamento</button>';
  }

  function secaoFaq() {
    return (C.faq || []).map(function (f, i) {
      return '<div class="ac-aula" style="flex-direction:column;align-items:stretch">' +
        '<div class="row" style="gap:10px;flex-wrap:nowrap;margin-bottom:10px">' +
          ordemBtns("faq", i) +
          '<span class="ac-aula__n" style="margin-top:0">' + (i + 1) + '</span>' +
          '<span style="flex:1"></span>' +
          '<button type="button" class="ac-mini ac-mini--x" data-remove="faq:' + i + '" ' +
            'aria-label="Remover">&#215;</button>' +
        '</div>' +
        campo("Pergunta", "faq." + i + ".q", f.q, { max: 200 }) +
        campo("Resposta", "faq." + i + ".a", f.a, { max: 2000, linhas: 4 }) +
      '</div>';
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

    /* A seção guardada pode ter sumido — por exemplo, se um dia
       alguma delas deixar de existir. Cai na primeira. */
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

  /* ---------- Geração do arquivo ---------- */
  function montarArquivo() {
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

    return "/* ============================================================\n" +
      "   Totali · Portal de Onboarding\n" +
      "   conteudo.js — conteúdo do portal\n\n" +
      "   ARQUIVO GERADO PELO PAINEL DA EQUIPE. Não edite à mão:\n" +
      "   abra equipe.html, altere na tela e baixe de novo.\n\n" +
      "   Gerado em " + new Date().toLocaleString("pt-BR") + "\n" +
      "   ============================================================ */\n" +
      "window.CONTEUDO = " + JSON.stringify(saida, null, 2) + ";\n";
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
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})(window);
