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
      termo: clonar(DATA.TERMO)
    };
  }

  function carregar() {
    var r = null;
    try { r = JSON.parse(localStorage.getItem(CHAVE) || "null"); } catch (e) { r = null; }
    if (r && typeof r === "object" && r.org) { C = r; return "rascunho"; }
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

  function secao(id, titulo, resumo, corpoFn) {
    var aberta = !!abertos[id];
    return '<section class="card group" data-open="' + (aberta ? "true" : "false") + '" ' +
        'style="margin-bottom:12px">' +
      '<button type="button" class="group__head" data-secao="' + id + '">' +
        '<span class="group__icon">' + UI.icone("ic-file") + '</span>' +
        '<span class="group__info">' +
          '<span class="group__title">' + U.esc(titulo) + '</span>' +
          '<span class="group__meta">' + U.esc(resumo) + '</span>' +
        '</span>' +
        '<span class="group__chev">' + UI.icone("ic-chevron-down") + '</span>' +
      '</button>' +
      (aberta ? '<div class="group__body" style="padding:16px">' + corpoFn() + '</div>' : '') +
    '</section>';
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
    return '<div class="notice notice--info" style="margin-bottom:16px">' +
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
      return '<div class="ac-trilha">' +
        '<div class="ac-trilha__topo">' + ordemBtns("academy", i) +
          '<span class="ac-trilha__n">' + (i + 1) + '</span>' +
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
              '<span class="ac-aula__n">' + (j + 1) + '</span>' +
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
                  (ok ? "Publicada · capa vem do YouTube" : "Em breve · sem vídeo") + '</span>' +
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
            '<span class="ac-trilha__n">' + (i + 1) + '</span>' +
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

    $("#pcLista").innerHTML =
      secao("org", "Contatos e endereço", C.org.telefoneExibicao + " · " + C.org.horario, secaoOrg) +
      secao("video", "Vídeo de abertura",
            ID_YT.test(C.videoInicio.youtube) ? "publicado" : "sem vídeo", secaoVideo) +
      secao("academy", "Academy", (C.academy || []).length + " trilhas · " + aulas + " aulas", secaoAcademy) +
      secao("grupos", "Documentos do checklist",
            (C.grupos || []).length + " departamentos · " + docs + " documentos", secaoGrupos) +
      secao("faq", "Perguntas frequentes", (C.faq || []).length + " perguntas", secaoFaq) +
      secao("textos", "Compromisso e termo", "textos do PDF e do aviso", secaoTextos);

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
    faq: function () { return { q: "", a: "" }; }
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

      var sec = b.getAttribute("data-secao");
      if (sec) { abertos[sec] = !abertos[sec]; desenhar(); return; }

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
        est.textContent = ok ? "Publicada · capa vem do YouTube" : "Em breve · sem vídeo";
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
      if (el.tagName === "SELECT") { definir(caminho, el.value); desenhar(); }
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
