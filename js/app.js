/* ============================================================
   Totali · Portal de Onboarding
   app.js — rotas, telas e comportamento

   Regra de ouro deste arquivo: nenhuma string vinda do cliente
   entra em innerHTML sem passar por U.esc().
   ============================================================ */
(function (global) {
  "use strict";

  var U = global.U, UI = global.UI, DATA = global.DATA, Store = global.Store;
  var $ = UI.$, $$ = UI.$$, ic = UI.icone;

  /* ---------- Rotas ---------- */
  var ROTAS = [
    { id: "inicio",      titulo: "Início",     icone: "ic-home",     nav: true },
    { id: "documentos",  titulo: "Documentos", icone: "ic-folder",   nav: true },
    { id: "academy",     titulo: "Academy",    icone: "ic-play",     nav: true },
    { id: "empresa",     titulo: "Empresa",    icone: "ic-building", nav: true },
    { id: "ajuda",       titulo: "Ajuda",      icone: "ic-help",     nav: true },
    { id: "privacidade", titulo: "Privacidade e segurança", icone: "ic-shield", nav: false },
    { id: "boas-vindas", titulo: "Boas-vindas", icone: "ic-home",    nav: false }
  ];

  var estadoUI = {
    gruposAbertos: {},
    faqAberta: {},
    rota: "inicio"
  };

  function rotaValida(id) {
    return ROTAS.some(function (r) { return r.id === id; }) ? id : "inicio";
  }

  function rotaDaURL() {
    var h = (location.hash || "").replace(/^#\/?/, "").split("?")[0];
    return rotaValida(h);
  }

  function navegar(id, semScroll) {
    var alvo = rotaValida(id);
    if (location.hash !== "#/" + alvo) location.hash = "#/" + alvo;
    else render();
    if (!semScroll) global.scrollTo({ top: 0, behavior: "auto" });
  }

  /* ============================================================
     Blocos visuais reutilizáveis
     ============================================================ */

  /* O anel nasce vazio (dashoffset = circunferência) e o motion.js
     solta o valor final no quadro seguinte, para que ele "desenhe". */
  function anelHTML(pct) {
    var r = 39, c = 2 * Math.PI * r;
    var off = c - (U.clamp(pct, 0, 100) / 100) * c;
    return '' +
      '<div class="ring">' +
        '<svg width="92" height="92" viewBox="0 0 92 92" aria-hidden="true">' +
          '<defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">' +
            '<stop offset="0%" stop-color="#22456c"/>' +
            '<stop offset="55%" stop-color="#c2a250"/>' +
            '<stop offset="100%" stop-color="#f2e2b8"/>' +
          '</linearGradient></defs>' +
          '<circle class="ring__track" cx="46" cy="46" r="' + r + '" fill="none" stroke-width="7.5"/>' +
          '<circle class="ring__bar" cx="46" cy="46" r="' + r + '" fill="none" stroke-width="7.5" ' +
                  'stroke-dasharray="' + c.toFixed(1) + '" ' +
                  'stroke-dashoffset="' + c.toFixed(1) + '" data-off="' + off.toFixed(1) + '"/>' +
        '</svg>' +
        '<div class="ring__value"><span data-count="' + pct + '">0</span><small>%</small></div>' +
      '</div>';
  }

  var ROTULO_SITUACAO = {
    enviado:     { texto: "Enviado",        cls: "badge--enviado" },
    substituido: { texto: "Coberto pela CNH", cls: "badge--aprovado" },
    na:          { texto: "Não se aplica",  cls: "badge--na" },
    pendente:    { texto: "Pendente",       cls: "badge--pendente" }
  };

  function badgeSituacao(sit) {
    var m = ROTULO_SITUACAO[sit] || ROTULO_SITUACAO.pendente;
    return '<span class="badge ' + m.cls + '"><span class="dot"></span>' + m.texto + '</span>';
  }

  /* ============================================================
     Tela: Boas-vindas (primeira visita)
     ============================================================ */
  function viewBoasVindas() {
    return '' +
    '<section class="hero">' +
      '<div class="eyebrow">Seja bem-vindo</div>' +
      '<h1 class="hero__title">Sua contabilidade começa aqui</h1>' +
      '<p class="hero__desc">Este é o portal onde você envia a documentação da sua empresa, ' +
        'acompanha cada etapa da migração e aprende a usar os serviços da ' + U.esc(DATA.ORG.curto) + '. ' +
        'Leva poucos minutos para começar.</p>' +
    '</section>' +

    '<section class="section">' +
      '<div class="card card--pad">' +
        '<h2 class="section__title" style="margin-bottom:14px">Como vai funcionar</h2>' +
        '<div class="rail">' +
          DATA.ETAPAS.map(function (e, i) {
            return '<div class="rail__step ' + (i === 0 ? "rail__step--current" : "rail__step--todo") + '">' +
              '<div class="rail__dot">' + (i + 1) + '</div>' +
              '<div class="rail__title">' + U.esc(e.titulo) + '</div>' +
              '<div class="rail__desc">' + U.esc(e.desc) + '</div>' +
            '</div>';
          }).join("") +
        '</div>' +
      '</div>' +
    '</section>' +

    '<section class="section">' +
      '<div class="notice notice--info">' +
        '<span class="notice__icon">' + ic("ic-shield") + '</span>' +
        '<span><strong>Seus dados ficam protegidos.</strong> Enquanto o portal não estiver conectado ' +
        'ao servidor da ' + U.esc(DATA.ORG.curto) + ', tudo o que você anexa fica guardado apenas ' +
        'neste aparelho — nada é enviado pela internet. Nunca pedimos senha em formulário.</span>' +
      '</div>' +
    '</section>' +

    '<section class="section">' +
      '<div class="card card--pad">' +
        '<label class="row" style="align-items:flex-start;gap:11px;cursor:pointer">' +
          '<input type="checkbox" id="aceiteLgpd" style="width:20px;height:20px;margin-top:2px;flex:none">' +
          '<span class="text-sm" style="color:var(--txt-2);line-height:1.6">Li e concordo que a ' +
            U.esc(DATA.ORG.nome) + ' trate os dados e documentos que eu enviar para a prestação dos ' +
            'serviços contábeis, conforme a Lei Geral de Proteção de Dados. ' +
            '<a href="#/privacidade" data-rota="privacidade">Ler a política completa</a>.</span>' +
        '</label>' +
        '<button type="button" class="btn btn--primary btn--block" id="btnComecar" style="margin-top:16px" disabled>' +
          'Começar' + ic("ic-arrow-right") +
        '</button>' +
      '</div>' +
    '</section>';
  }

  function bindBoasVindas() {
    var chk = $("#aceiteLgpd"), btn = $("#btnComecar");
    if (!chk || !btn) return;
    chk.addEventListener("change", function () { btn.disabled = !chk.checked; });
    btn.addEventListener("click", function () {
      if (!chk.checked) return;
      Store.commit(function (st) { st.aceiteLGPD = Date.now(); }, "aceite");
      Store.flush();
      UI.toast("Tudo pronto. Vamos começar pelos dados da empresa.", "ok");
      navegar("empresa");
    });
  }

  /* ============================================================
     Tela: Início
     ============================================================ */
  function proximosPendentes(limite) {
    var out = [];
    DATA.GRUPOS.forEach(function (g) {
      var alvos = g.escopo === "socio"
        ? Store.estado.socios.map(function (s) { return s; })
        : [null];
      alvos.forEach(function (socio) {
        g.itens.forEach(function (item) {
          if (out.length >= limite) return;
          if (!item.obrigatorio) return;
          var sit = Store.situacao(g, item, socio ? socio.id : null);
          if (sit === "pendente") {
            out.push({
              grupo: g, item: item,
              sufixo: socio ? U.primeiroNome(socio.nome) || "sócio" : ""
            });
          }
        });
      });
    });
    return out;
  }

  function viewInicio() {
    var st = Store.estado;
    var resumo = Store.resumoGeral();
    var etapaId = Store.etapaAtual();
    var idxEtapa = DATA.ETAPAS.findIndex(function (e) { return e.id === etapaId; });
    var nome = U.primeiroNome(st.empresa.responsavelNome);
    var empresaNome = st.empresa.nomeFantasia || st.empresa.razaoSocial;

    var html = '' +
    '<section class="hero">' +
      '<div class="hero__greeting">' + U.esc(U.saudacao()) + (nome ? ", " + U.esc(nome) : "") + '</div>' +
      '<h1 class="hero__title">' + (empresaNome ? U.esc(empresaNome) : "Vamos organizar sua migração") + '</h1>' +
      '<p class="hero__desc">' +
        (resumo.total === 0
          ? "Comece cadastrando os dados da empresa. Em seguida a lista de documentos aparece aqui."
          : resumo.pendentes === 0
            ? "Documentação completa. Nossa equipe já pode conferir tudo."
            : "Faltam " + resumo.pendentes + " " + U.plural(resumo.pendentes, "documento", "documentos") +
              " para concluirmos sua migração. Você pode enviar aos poucos.") +
      '</p>' +
      '<div class="hero__row">' +
        anelHTML(resumo.pct) +
        '<div class="hero__stats">' +
          '<div><div class="stat__num" data-count="' + resumo.ok + '">0</div>' +
            '<div class="stat__lbl">Enviados</div></div>' +
          '<div><div class="stat__num" data-count="' + resumo.pendentes + '">0</div>' +
            '<div class="stat__lbl">Pendentes</div></div>' +
          '<div><div class="stat__num" data-count="' + resumo.pendentesObrigatorios + '">0</div>' +
            '<div class="stat__lbl">Obrigatórios</div></div>' +
        '</div>' +
      '</div>' +
      '<div class="hero__actions">' +
        '<button type="button" class="btn btn--gold" data-rota="documentos">' +
          ic("ic-upload") + 'Enviar documentos</button>' +
        '<button type="button" class="btn btn--ghost" data-rota="ajuda">' +
          ic("ic-help") + 'Preciso de ajuda</button>' +
      '</div>' +
    '</section>';

    /* Próximos passos */
    var pendentes = proximosPendentes(4);
    if (pendentes.length) {
      html +=
      '<section class="section">' +
        '<div class="section__head"><div>' +
          '<h2 class="section__title">Próximos passos</h2>' +
          '<p class="section__desc">Comece por aqui. São os documentos que mais travam a migração.</p>' +
        '</div></div>' +
        '<div class="card">' +
          pendentes.map(function (p) {
            return '<button type="button" class="group__head" data-rota="documentos" data-grupo="' +
                     U.escAttr(p.grupo.id) + '" style="border-bottom:1px solid var(--stroke)">' +
              '<span class="group__icon">' + ic(p.grupo.icone) + '</span>' +
              '<span class="group__info">' +
                '<span class="group__title" style="display:block;font-size:14px">' + U.esc(p.item.nome) +
                  (p.sufixo ? ' <span class="text-xs text-muted">· ' + U.esc(p.sufixo) + '</span>' : '') + '</span>' +
                '<span class="group__meta">' + U.esc(p.item.resumo || "") + '</span>' +
              '</span>' +
              '<span class="group__chev">' + ic("ic-chevron-right") + '</span>' +
            '</button>';
          }).join("") +
        '</div>' +
      '</section>';
    }

    /* Trilha das etapas */
    html +=
    '<section class="section">' +
      '<div class="section__head"><div>' +
        '<h2 class="section__title">Onde você está</h2>' +
        '<p class="section__desc">A migração acontece em cinco etapas.</p>' +
      '</div></div>' +
      '<div class="card card--pad">' +
        '<div class="rail">' +
          DATA.ETAPAS.map(function (e, i) {
            var cls = i < idxEtapa ? "rail__step--done" : i === idxEtapa ? "rail__step--current" : "rail__step--todo";
            var dot = i < idxEtapa ? ic("ic-check") : String(i + 1);
            return '<div class="rail__step ' + cls + '">' +
              '<div class="rail__dot">' + dot + '</div>' +
              '<div class="rail__title">' + U.esc(e.titulo) + '</div>' +
              '<div class="rail__desc">' + U.esc(e.desc) + '</div>' +
            '</div>';
          }).join("") +
        '</div>' +
      '</div>' +
    '</section>';

    /* Academy — chamada */
    html +=
    '<section class="section">' +
      '<div class="section__head"><div>' +
        '<h2 class="section__title">Totali Academy</h2>' +
        '<p class="section__desc">Vídeos curtos que ensinam a rotina da sua empresa com a gente.</p>' +
      '</div>' +
      '<button type="button" class="btn btn--ghost btn--sm" data-rota="academy">Ver trilhas</button></div>' +
      '<div class="tiles">' + DATA.ACADEMY.slice(0, 2).map(tileAcademy).join("") + '</div>' +
    '</section>';

    return html + rodape();
  }

  /* ============================================================
     Tela: Documentos
     ============================================================ */
  function itemHTML(grupo, item, socio) {
    var socioId = socio ? socio.id : null;
    var chave = Store.chaveItem(grupo.id, item.id, socioId);
    var reg = Store.estado.itens[chave] || { arquivos: [], valor: "", na: false, forma: "" };
    var sit = Store.situacao(grupo, item, socioId);
    var pronto = sit === "enviado" || sit === "substituido";
    var grupoNA = !!Store.estado.gruposNA[grupo.id];

    var html = '<div class="item ' + (pronto ? "item--done " : "") + (sit === "na" ? "item--na" : "") +
               '" data-chave="' + U.escAttr(chave) + '">' +
      '<div class="item__top">' +
        '<span class="item__mark" aria-hidden="true">' + ic("ic-check") + '</span>' +
        '<div class="item__main">' +
          '<div class="item__name">' + U.esc(item.nome) +
            (item.obrigatorio ? '' : ' <span class="opt">opcional</span>') + '</div>' +
          '<div class="item__row">' + badgeSituacao(sit) +
            '<button type="button" class="help-btn" data-ajuda="' + U.escAttr(grupo.id + "|" + item.id) + '">' +
              ic("ic-info") + 'Entenda este documento</button>' +
          '</div>' +
          (item.resumo ? '<div class="item__desc">' + U.esc(item.resumo) + '</div>' : '');

    if (grupoNA) {
      html += '<div class="item__desc">Este grupo foi marcado como não aplicável.</div>';
    } else if (sit === "substituido") {
      html += '<div class="notice notice--ok" style="margin-top:10px;padding:9px 11px;font-size:12.5px">' +
                '<span class="notice__icon">' + ic("ic-check-circle") + '</span>' +
                '<span>A CNH enviada já cobre este documento.</span></div>';
    } else {

      /* ---- tipo ARQUIVO ---- */
      if (item.kind === "arquivo") {
        if (reg.arquivos.length) {
          html += '<div class="files">' + reg.arquivos.map(function (a) {
            var ext = U.extensao(a.nome);
            return '<div class="file">' +
              '<span class="file__icon">' + ic(U.iconePorExtensao(ext)) + '</span>' +
              '<span class="file__info">' +
                '<span class="file__name">' + U.esc(a.nome) + '</span>' +
                '<span class="file__meta">' + U.esc(U.bytes(a.tamanho)) + ' · enviado em ' +
                  U.esc(U.dataCurta(a.em)) + '</span>' +
              '</span>' +
              '<button type="button" class="file__del" data-baixar="' + U.escAttr(a.id) +
                '" aria-label="Abrir arquivo">' + ic("ic-download") + '</button>' +
              '<button type="button" class="file__del" data-remover="' + U.escAttr(a.id) +
                '" aria-label="Remover arquivo">' + ic("ic-trash") + '</button>' +
            '</div>';
          }).join("") + '</div>';
        }
        html += '<div class="item__actions">' +
          '<button type="button" class="btn btn--ghost btn--sm" data-enviar="1">' +
            ic("ic-upload") + (reg.arquivos.length ? "Adicionar outro" : "Enviar arquivo") + '</button>' +
          (item.obrigatorio && !reg.arquivos.length
            ? '<button type="button" class="btn btn--quiet btn--sm" data-na="1">Não se aplica</button>'
            : !item.obrigatorio && !reg.arquivos.length
              ? '<button type="button" class="btn btn--quiet btn--sm" data-na="1">Não se aplica</button>'
              : '') +
        '</div>';
      }

      /* ---- tipo DADO ---- */
      if (item.kind === "dado") {
        if (item.formato === "selecao") {
          html += '<div style="margin-top:10px"><select class="select" data-dado="1" ' +
            'aria-label="' + U.escAttr(item.nome) + '">' +
            '<option value="">Selecione…</option>' +
            item.opcoes.map(function (o) {
              return '<option value="' + U.escAttr(o) + '"' +
                     (reg.valor === o ? ' selected' : '') + '>' + U.esc(o) + '</option>';
            }).join("") + '</select></div>';
        } else {
          html += '<div style="margin-top:10px"><input type="text" class="input" data-dado="1" ' +
            'inputmode="numeric" autocomplete="off" spellcheck="false" ' +
            'maxlength="' + (item.maxlen || 60) + '" ' +
            'placeholder="' + U.escAttr(item.placeholder || "") + '" ' +
            'aria-label="' + U.escAttr(item.nome) + '" ' +
            'value="' + U.escAttr(reg.valor || "") + '"></div>';
        }
        if (!item.obrigatorio) {
          html += '<div class="item__actions">' +
            '<button type="button" class="btn btn--quiet btn--sm" data-na="1">Não se aplica</button></div>';
        }
      }

      /* ---- tipo ACESSO ---- */
      if (item.kind === "acesso") {
        var FORMAS = [
          { id: "procuracao", rot: "Vou conceder procuração eletrônica" },
          { id: "combinar",   rot: "Prefiro combinar com a Totali" },
          { id: "entregue",   rot: "Já está com a Totali" }
        ];
        html += '<div class="notice notice--warn" style="margin-top:10px;padding:10px 12px;font-size:12.5px">' +
            '<span class="notice__icon">' + ic("ic-lock") + '</span>' +
            '<span><strong>Nunca digite sua senha aqui.</strong> Escolha abaixo como prefere ' +
            'liberar o acesso e a nossa equipe conduz o resto com você.</span>' +
          '</div>' +
          '<div class="item__actions">' +
            FORMAS.map(function (f) {
              var ativo = reg.forma === f.id;
              return '<button type="button" class="btn btn--sm ' +
                (ativo ? "btn--primary" : "btn--ghost") + '" data-forma="' + U.escAttr(f.id) + '">' +
                (ativo ? ic("ic-check") : "") + U.esc(f.rot) + '</button>';
            }).join("") +
            '<button type="button" class="btn btn--quiet btn--sm" data-na="1">Não se aplica</button>' +
          '</div>';
      }
    }

    if (sit === "na" && !grupoNA) {
      html += '<div class="item__actions">' +
        '<button type="button" class="btn btn--quiet btn--sm" data-reativar="1">Reativar este item</button></div>';
    }

    html += '</div></div></div>';
    return html;
  }

  function grupoHTML(grupo) {
    var resumo = Store.resumoGrupo(grupo);
    var aberto = !!estadoUI.gruposAbertos[grupo.id];
    var grupoNA = !!Store.estado.gruposNA[grupo.id];
    var socios = Store.estado.socios;

    var meta;
    if (grupoNA) meta = "Marcado como não aplicável";
    else if (grupo.escopo === "socio" && !socios.length) meta = "Cadastre os sócios para liberar esta lista";
    else meta = resumo.ok + " de " + resumo.total + " " + U.plural(resumo.total, "documento", "documentos");

    var html = '<section class="card group" data-open="' + (aberto ? "true" : "false") +
               '" data-grupo="' + U.escAttr(grupo.id) + '">' +
      '<button type="button" class="group__head" data-toggle="1" aria-expanded="' + (aberto ? "true" : "false") + '">' +
        '<span class="group__icon">' + ic(grupo.icone) + '</span>' +
        '<span class="group__info">' +
          '<span class="group__title">' + U.esc(grupo.titulo) + '</span>' +
          '<span class="group__meta">' + U.esc(meta) + '</span>' +
        '</span>' +
        (resumo.completo && !grupoNA ? '<span class="badge badge--aprovado"><span class="dot"></span>Completo</span>' : '') +
        '<span class="group__chev">' + ic("ic-chevron-down") + '</span>' +
      '</button>';

    if (!grupoNA && !resumo.vazio) {
      html += '<div class="group__progress"><div class="pbar"><div class="pbar__fill" style="width:' +
              resumo.pct + '%"></div></div></div>';
    }

    if (aberto) {
      html += '<div class="group__body">';
      html += '<div style="padding:15px 16px;border-bottom:1px solid var(--stroke)">' +
                '<p class="text-sm text-muted" style="line-height:1.55">' + U.esc(grupo.desc) + '</p>';
      if (grupo.permiteGrupoNA) {
        html += '<label class="row" style="margin-top:11px;cursor:pointer;gap:9px">' +
          '<input type="checkbox" data-grupona="1" ' + (grupoNA ? "checked" : "") +
          ' style="width:18px;height:18px">' +
          '<span class="text-sm" style="color:var(--txt-2)">' + U.esc(grupo.textoGrupoNA) + '</span></label>';
      }
      html += '</div>';

      if (grupoNA) {
        html += '<div class="empty"><div class="empty__icon">' + ic("ic-check-circle") + '</div>' +
                '<div class="empty__title">Nada a enviar neste grupo</div>' +
                '<div class="empty__desc">Desmarque a opção acima se a situação mudar.</div></div>';
      } else if (grupo.escopo === "socio") {
        if (!socios.length) {
          html += '<div class="empty">' +
            '<div class="empty__icon">' + ic("ic-users") + '</div>' +
            '<div class="empty__title">Nenhum sócio cadastrado</div>' +
            '<div class="empty__desc">Cadastre os sócios da empresa para que cada um receba a própria lista de documentos.</div>' +
            '<button type="button" class="btn btn--primary btn--sm" style="margin-top:14px" data-rota="empresa">' +
              ic("ic-plus") + 'Cadastrar sócios</button></div>';
        } else {
          socios.forEach(function (s) {
            var r = { total: 0, ok: 0 };
            grupo.itens.forEach(function (it) {
              var sit = Store.situacao(grupo, it, s.id);
              if (sit === "na") return;
              r.total++;
              if (sit === "enviado" || sit === "substituido") r.ok++;
            });
            html += '<div style="padding:13px 16px;background:rgba(194,162,80,.06);' +
              'border-top:1px solid var(--stroke);border-bottom:1px solid var(--stroke)">' +
              '<div class="row" style="justify-content:space-between">' +
                '<div><div style="font-size:13.5px;font-weight:680;color:var(--gold-2)">' +
                  U.esc(s.nome || "Sócio sem nome") + '</div>' +
                  (s.cpf ? '<div class="text-xs text-muted">CPF ' + U.esc(s.cpf) + '</div>' : '') +
                '</div>' +
                '<span class="badge ' + (r.total && r.ok === r.total ? "badge--aprovado" : "badge--pendente") + '">' +
                  r.ok + '/' + r.total + '</span>' +
              '</div></div>';
            grupo.itens.forEach(function (it) { html += itemHTML(grupo, it, s); });
          });
        }
      } else {
        grupo.itens.forEach(function (it) { html += itemHTML(grupo, it, null); });
      }
      html += '</div>';
    }
    html += '</section>';
    return html;
  }

  function viewDocumentos() {
    var resumo = Store.resumoGeral();
    var usado = Store.bytesUsados();

    var html = '' +
    '<section class="section">' +
      '<div class="section__head"><div>' +
        '<div class="eyebrow">Etapa 3</div>' +
        '<h1 class="section__title" style="font-size:20px;margin-top:4px">Envio de documentos</h1>' +
        '<p class="section__desc">Toque em um grupo para abrir a lista. Cada item explica o que é, ' +
          'onde conseguir e como enviar.</p>' +
      '</div></div>' +
      '<div class="card card--pad" style="margin-bottom:16px">' +
        '<div class="row" style="justify-content:space-between;margin-bottom:9px">' +
          '<span class="text-sm" style="font-weight:600">Progresso geral</span>' +
          '<span class="text-sm text-muted">' + resumo.ok + ' de ' + resumo.total + '</span>' +
        '</div>' +
        '<div class="pbar"><div class="pbar__fill" style="width:' + resumo.pct + '%"></div></div>' +
        (usado ? '<div class="text-xs text-muted" style="margin-top:9px">' +
          U.esc(U.bytes(usado)) + ' anexados neste aparelho</div>' : '') +
      '</div>' +
    '</section>';

    html += DATA.GRUPOS.map(grupoHTML).join("");

    html +=
    '<section class="section">' +
      '<div class="notice notice--info">' +
        '<span class="notice__icon">' + ic("ic-info") + '</span>' +
        '<span>Não encontrou algum documento com o contador anterior? ' +
        '<a href="#/ajuda" data-rota="ajuda">Fale com a gente</a> — a maioria pode ser obtida ' +
        'direto nos portais oficiais e nós ajudamos nesse caminho.</span>' +
      '</div>' +
    '</section>';

    return html + rodape();
  }

  /* ---------- Modal de ajuda de um item ---------- */
  function abrirAjudaItem(grupoId, itemId) {
    var grupo = DATA.GRUPOS.filter(function (g) { return g.id === grupoId; })[0];
    if (!grupo) return;
    var item = grupo.itens.filter(function (i) { return i.id === itemId; })[0];
    if (!item || !item.ajuda) return;
    var a = item.ajuda;

    var corpo = '';
    if (a.oque) {
      corpo += '<div class="help-block"><div class="help-block__t">O que é</div>' +
               '<div class="help-block__c">' + U.esc(a.oque) + '</div></div>';
    }
    if (a.onde && a.onde.length) {
      corpo += '<div class="help-block"><div class="help-block__t">Onde conseguir</div>' +
               '<ul class="help-list">' + a.onde.map(function (o) {
                 return '<li>' + U.esc(o) + '</li>';
               }).join("") + '</ul></div>';
    }
    if (a.dica) {
      corpo += '<div class="help-block"><div class="notice notice--warn">' +
               '<span class="notice__icon">' + ic("ic-info") + '</span>' +
               '<span>' + U.esc(a.dica) + '</span></div></div>';
    }
    if (item.kind === "arquivo") {
      corpo += '<div class="help-block"><div class="help-block__t">Como enviar</div>' +
        '<div class="help-block__c">Aceitamos PDF, foto (JPG, PNG, WEBP), planilhas e documentos do ' +
        'Office, além de TXT e XML. Cada arquivo pode ter até ' + U.bytes(U.MAX_ARQUIVO) + '. ' +
        'Você pode anexar quantos arquivos precisar no mesmo item.</div></div>';
    }
    if (item.kind === "acesso") {
      corpo += '<div class="help-block"><div class="notice notice--ok">' +
        '<span class="notice__icon">' + ic("ic-shield") + '</span>' +
        '<span><strong>Por que não pedimos a senha.</strong> Senha digitada em formulário fica ' +
        'registrada em vários lugares. Com a procuração eletrônica você autoriza a ' +
        U.esc(DATA.ORG.curto) + ' a acessar só o que é necessário, sem entregar credencial, ' +
        'e pode cancelar quando quiser.</span></div></div>';
    }

    UI.modal({ titulo: item.nome, corpoHTML: corpo, acoes: [{ rotulo: "Entendi", classe: "btn--primary" }] });
  }

  /* ============================================================
     Tela: Academy
     ============================================================ */
  function tileAcademy(t) {
    return '<article class="tile tile--soon">' +
      '<div class="tile__thumb"><span class="tile__play">' + ic("ic-play") + '</span></div>' +
      '<div class="tile__body">' +
        '<div class="tile__kicker">' + U.esc(t.kicker) + '</div>' +
        '<h3 class="tile__title">' + U.esc(t.titulo) + '</h3>' +
        '<p class="tile__desc">' + U.esc(t.desc) + '</p>' +
        '<div class="tile__foot">' +
          '<span class="badge badge--pendente"><span class="dot"></span>Em breve</span>' +
          '<span class="text-xs text-muted">' + U.esc(t.duracao) + '</span>' +
        '</div>' +
      '</div>' +
    '</article>';
  }

  function viewAcademy() {
    return '' +
    '<section class="hero">' +
      '<div class="eyebrow">Totali Academy</div>' +
      '<h1 class="hero__title">Aprenda a rotina da sua empresa</h1>' +
      '<p class="hero__desc">Trilhas curtas e diretas sobre notas fiscais, impostos, folha de pagamento ' +
        'e o que enviar todo mês. Sem juridiquês.</p>' +
    '</section>' +
    '<section class="section">' +
      '<div class="section__head"><div>' +
        '<h2 class="section__title">Trilhas</h2>' +
        '<p class="section__desc">Estamos gravando os vídeos. Assim que uma trilha for publicada, ' +
          'ela aparece liberada aqui.</p>' +
      '</div></div>' +
      '<div class="tiles">' + DATA.ACADEMY.map(tileAcademy).join("") + '</div>' +
    '</section>' + rodape();
  }

  /* ============================================================
     Tela: Empresa
     ============================================================ */
  var REGIMES = ["Simples Nacional", "Lucro Presumido", "Lucro Real", "MEI", "Não sei informar"];

  function viewEmpresa() {
    var e = Store.estado.empresa;
    var socios = Store.estado.socios;

    var html = '' +
    '<section class="section">' +
      '<div class="section__head"><div>' +
        '<div class="eyebrow">Etapa 2</div>' +
        '<h1 class="section__title" style="font-size:20px;margin-top:4px">Dados da empresa</h1>' +
        '<p class="section__desc">Confirme as informações básicas. É com elas que abrimos seu cadastro ' +
          'nos nossos sistemas.</p>' +
      '</div></div>' +

      '<div class="card card--pad">' +
        '<div class="field"><label class="field__label" for="fRazao">Razão social' +
          '<span class="field__req">*</span></label>' +
          '<input type="text" class="input" id="fRazao" data-emp="razaoSocial" maxlength="150" ' +
          'autocomplete="organization" value="' + U.escAttr(e.razaoSocial) + '" ' +
          'placeholder="Nome da empresa no contrato social"></div>' +

        '<div class="field"><label class="field__label" for="fFantasia">Nome fantasia</label>' +
          '<input type="text" class="input" id="fFantasia" data-emp="nomeFantasia" maxlength="120" ' +
          'value="' + U.escAttr(e.nomeFantasia) + '" placeholder="Como sua empresa é conhecida"></div>' +

        '<div class="grid-2">' +
          '<div class="field"><label class="field__label" for="fCnpj">CNPJ' +
            '<span class="field__req">*</span></label>' +
            '<input type="text" class="input" id="fCnpj" data-emp="cnpj" data-mascara="cnpj" ' +
            'inputmode="numeric" maxlength="18" value="' + U.escAttr(e.cnpj) + '" ' +
            'placeholder="00.000.000/0000-00">' +
            '<div class="field__error" id="errCnpj" hidden>CNPJ inválido. Confira os números.</div></div>' +

          '<div class="field"><label class="field__label" for="fRegime">Regime tributário</label>' +
            '<select class="select" id="fRegime" data-emp="regime">' +
              '<option value="">Selecione…</option>' +
              REGIMES.map(function (r) {
                return '<option value="' + U.escAttr(r) + '"' + (e.regime === r ? " selected" : "") + '>' +
                       U.esc(r) + '</option>';
              }).join("") +
            '</select></div>' +
        '</div>' +

        '<hr class="hr">' +
        '<h3 style="font-size:14px;font-weight:650;margin-bottom:4px">Responsável pelo contato</h3>' +
        '<p class="text-xs text-muted" style="margin-bottom:14px">Quem a Totali procura quando precisar ' +
          'de alguma informação.</p>' +

        '<div class="grid-2">' +
          '<div class="field"><label class="field__label" for="fRespNome">Nome completo' +
            '<span class="field__req">*</span></label>' +
            '<input type="text" class="input" id="fRespNome" data-emp="responsavelNome" maxlength="120" ' +
            'autocomplete="name" value="' + U.escAttr(e.responsavelNome) + '"></div>' +

          '<div class="field"><label class="field__label" for="fRespCargo">Função na empresa</label>' +
            '<input type="text" class="input" id="fRespCargo" data-emp="responsavelCargo" maxlength="80" ' +
            'value="' + U.escAttr(e.responsavelCargo) + '" placeholder="Sócio, gerente, financeiro…"></div>' +
        '</div>' +

        '<div class="grid-2">' +
          '<div class="field"><label class="field__label" for="fRespEmail">E-mail' +
            '<span class="field__req">*</span></label>' +
            '<input type="email" class="input" id="fRespEmail" data-emp="responsavelEmail" maxlength="120" ' +
            'autocomplete="email" inputmode="email" value="' + U.escAttr(e.responsavelEmail) + '">' +
            '<div class="field__error" id="errEmail" hidden>E-mail inválido.</div></div>' +

          '<div class="field"><label class="field__label" for="fRespTel">Telefone / WhatsApp' +
            '<span class="field__req">*</span></label>' +
            '<input type="tel" class="input" id="fRespTel" data-emp="responsavelTelefone" ' +
            'data-mascara="telefone" inputmode="tel" maxlength="15" ' +
            'value="' + U.escAttr(e.responsavelTelefone) + '" placeholder="(00) 00000-0000"></div>' +
        '</div>' +

        '<div class="notice" style="margin-top:4px">' +
          '<span class="notice__icon">' + ic("ic-check-circle") + '</span>' +
          '<span>As alterações são salvas sozinhas assim que você sai do campo.</span>' +
        '</div>' +
      '</div>' +
    '</section>';

    /* Sócios */
    html +=
    '<section class="section">' +
      '<div class="section__head"><div>' +
        '<h2 class="section__title">Sócios</h2>' +
        '<p class="section__desc">Cada sócio cadastrado ganha a própria lista de documentos.</p>' +
      '</div>' +
      '<button type="button" class="btn btn--primary btn--sm" id="btnAddSocio">' +
        ic("ic-plus") + 'Adicionar</button></div>';

    if (!socios.length) {
      html += '<div class="card"><div class="empty">' +
        '<div class="empty__icon">' + ic("ic-users") + '</div>' +
        '<div class="empty__title">Nenhum sócio cadastrado</div>' +
        '<div class="empty__desc">Adicione todos os sócios que constam do contrato social.</div>' +
      '</div></div>';
    } else {
      html += '<div class="card">' + socios.map(function (s, i) {
        var r = { total: 0, ok: 0 };
        var g = DATA.GRUPOS.filter(function (x) { return x.escopo === "socio"; })[0];
        if (g) g.itens.forEach(function (it) {
          var sit = Store.situacao(g, it, s.id);
          if (sit === "na") return;
          r.total++;
          if (sit === "enviado" || sit === "substituido") r.ok++;
        });
        return '<div class="item">' +
          '<div class="item__top">' +
            '<span class="group__icon" style="width:34px;height:34px;border-radius:10px">' +
              ic("ic-badge") + '</span>' +
            '<div class="item__main">' +
              '<div class="item__name">' + U.esc(s.nome || "Sócio " + (i + 1)) + '</div>' +
              '<div class="item__row">' +
                '<span class="badge ' + (r.total && r.ok === r.total ? "badge--aprovado" : "badge--pendente") + '">' +
                  '<span class="dot"></span>' + r.ok + ' de ' + r.total + ' documentos</span>' +
                (s.cpf ? '<span class="text-xs text-muted">CPF ' + U.esc(s.cpf) + '</span>' : '') +
              '</div>' +
              '<div class="item__actions">' +
                '<button type="button" class="btn btn--ghost btn--sm" data-editar-socio="' +
                  U.escAttr(s.id) + '">Editar</button>' +
                '<button type="button" class="btn btn--quiet btn--sm" data-remover-socio="' +
                  U.escAttr(s.id) + '">Remover</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>';
      }).join("") + '</div>';
    }
    html += '</section>';

    return html + rodape();
  }

  function formSocio(socio) {
    var s = socio || { id: "", nome: "", cpf: "" };
    return '<div class="field"><label class="field__label" for="sNome">Nome completo' +
        '<span class="field__req">*</span></label>' +
        '<input type="text" class="input" id="sNome" maxlength="120" data-focus ' +
        'autocomplete="off" value="' + U.escAttr(s.nome) + '"></div>' +
      '<div class="field"><label class="field__label" for="sCpf">CPF</label>' +
        '<input type="text" class="input" id="sCpf" inputmode="numeric" maxlength="14" ' +
        'autocomplete="off" value="' + U.escAttr(s.cpf) + '" placeholder="000.000.000-00">' +
        '<div class="field__hint">Usamos o CPF apenas para identificar os documentos de cada sócio.</div>' +
        '<div class="field__error" id="errCpf" hidden>CPF inválido. Confira os números.</div></div>';
  }

  function abrirFormSocio(socioId) {
    var socio = socioId
      ? Store.estado.socios.filter(function (s) { return s.id === socioId; })[0]
      : null;

    var m = UI.modal({
      titulo: socio ? "Editar sócio" : "Adicionar sócio",
      corpoHTML: formSocio(socio),
      acoes: [
        { rotulo: "Cancelar", classe: "btn--ghost" },
        {
          rotulo: "Salvar", classe: "btn--primary", fecharAntes: false,
          onClick: function () {
            var caixa = m.caixa;
            var nome = $("#sNome", caixa).value.trim();
            var cpfCampo = $("#sCpf", caixa);
            var cpf = cpfCampo.value.trim();
            var erroCpf = $("#errCpf", caixa);

            if (!nome) { $("#sNome", caixa).focus(); UI.toast("Informe o nome do sócio.", "erro"); return; }
            if (cpf && !U.validaCPF(cpf)) {
              erroCpf.hidden = false;
              cpfCampo.setAttribute("aria-invalid", "true");
              cpfCampo.focus();
              return;
            }
            if (socio) {
              Store.commit(function (st) {
                var alvo = st.socios.filter(function (x) { return x.id === socio.id; })[0];
                if (alvo) { alvo.nome = nome; alvo.cpf = cpf; }
              }, "socios");
            } else {
              Store.adicionarSocio(nome, cpf);
            }
            Store.flush();
            UI.fecharModal();
            UI.toast(socio ? "Sócio atualizado." : "Sócio adicionado.", "ok");
            render();
          }
        }
      ]
    });

    var campoCpf = $("#sCpf", m.caixa);
    campoCpf.addEventListener("input", function () {
      campoCpf.value = U.mascaraCPF(campoCpf.value);
      $("#errCpf", m.caixa).hidden = true;
      campoCpf.removeAttribute("aria-invalid");
    });
  }

  /* ============================================================
     Tela: Ajuda
     ============================================================ */
  function viewAjuda() {
    var org = DATA.ORG;
    var html = voltarBoasVindas() +
    '<section class="section">' +
      '<div class="section__head"><div>' +
        '<h1 class="section__title" style="font-size:20px">Estamos por perto</h1>' +
        '<p class="section__desc">Se algo não estiver claro, fale com a gente. ' + U.esc(org.horario) + '.</p>' +
      '</div></div>' +
      '<div class="contact-grid">' +
        '<a class="contact" href="https://wa.me/' + U.escAttr(org.whatsapp) + '" target="_blank" rel="noopener noreferrer">' +
          '<span class="contact__icon">' + ic("ic-phone") + '</span>' +
          '<span><span class="contact__lbl">WhatsApp</span>' +
          '<span class="contact__val">' + U.esc(org.telefoneExibicao) + '</span></span></a>' +
        '<a class="contact" href="mailto:' + U.escAttr(org.email) + '">' +
          '<span class="contact__icon">' + ic("ic-mail") + '</span>' +
          '<span><span class="contact__lbl">E-mail</span>' +
          '<span class="contact__val" style="font-size:13px">' + U.esc(org.email) + '</span></span></a>' +
        '<a class="contact" href="' + U.escAttr(org.site) + '" target="_blank" rel="noopener noreferrer">' +
          '<span class="contact__icon">' + ic("ic-external") + '</span>' +
          '<span><span class="contact__lbl">Site</span>' +
          '<span class="contact__val" style="font-size:13px">totalicontabilidade.com.br</span></span></a>' +
      '</div>' +
    '</section>' +

    '<section class="section">' +
      '<div class="section__head"><div>' +
        '<h2 class="section__title">Perguntas frequentes</h2>' +
      '</div></div>' +
      DATA.FAQ.map(function (f, i) {
        var aberta = !!estadoUI.faqAberta[i];
        return '<div class="card faq" data-open="' + (aberta ? "true" : "false") + '" style="margin-bottom:9px">' +
          '<button type="button" class="faq__q" data-faq="' + i + '" aria-expanded="' + aberta + '">' +
            '<span style="flex:1">' + U.esc(f.q) + '</span>' + ic("ic-chevron-down") +
          '</button>' +
          (aberta ? '<div class="faq__a">' + U.esc(f.a) + '</div>' : '') +
        '</div>';
      }).join("") +
    '</section>' +

    '<section class="section">' +
      '<div class="card card--pad">' +
        '<h2 class="section__title" style="font-size:15px">Privacidade e segurança</h2>' +
        '<p class="section__desc" style="margin-bottom:14px">Entenda como tratamos seus dados e ' +
          'como apagar tudo deste aparelho.</p>' +
        '<button type="button" class="btn btn--ghost btn--sm" data-rota="privacidade">' +
          ic("ic-shield") + 'Abrir política</button>' +
      '</div>' +
    '</section>' + rodape();

    return html;
  }

  /* ============================================================
     Tela: Privacidade
     ============================================================ */
  function viewPrivacidade() {
    var org = DATA.ORG;
    var usado = Store.bytesUsados();
    return voltarBoasVindas() +
    '<section class="section">' +
      '<div class="section__head"><div>' +
        '<div class="eyebrow">Transparência</div>' +
        '<h1 class="section__title" style="font-size:20px;margin-top:4px">Privacidade e segurança</h1>' +
      '</div></div>' +

      '<div class="card card--pad stack">' +
        '<div class="notice notice--ok">' +
          '<span class="notice__icon">' + ic("ic-shield") + '</span>' +
          '<span><strong>Onde estão seus documentos agora.</strong> Este portal ainda não está ' +
          'conectado ao servidor. Tudo o que você anexa fica guardado apenas neste aparelho, no ' +
          'armazenamento do próprio navegador. Nenhum arquivo trafega pela internet nesta fase.</span>' +
        '</div>' +

        '<div class="help-block"><div class="help-block__t">Por que não pedimos senhas</div>' +
          '<div class="help-block__c">Senha digitada em formulário fica registrada em muitos lugares — ' +
          'no navegador, no servidor e nos backups — e qualquer um deles pode vazar. Por isso os itens ' +
          'de acesso deste portal nunca têm campo de senha. O caminho que recomendamos é a procuração ' +
          'eletrônica no e-CAC: você autoriza a ' + U.esc(org.curto) + ' a acessar apenas o necessário, ' +
          'sem entregar credencial, e pode revogar a qualquer momento.</div></div>' +

        '<div class="help-block"><div class="help-block__t">Para que usamos seus dados</div>' +
          '<div class="help-block__c">Exclusivamente para prestar os serviços contábeis, fiscais e ' +
          'trabalhistas contratados e para cumprir as obrigações legais que recaem sobre a sua empresa. ' +
          'Não vendemos, não compartilhamos com terceiros para fins comerciais e não usamos seus ' +
          'documentos para nenhuma outra finalidade.</div></div>' +

        '<div class="help-block"><div class="help-block__t">Seus direitos</div>' +
          '<ul class="help-list">' +
            '<li>Saber quais dados seus nós tratamos.</li>' +
            '<li>Corrigir informações incompletas ou desatualizadas.</li>' +
            '<li>Pedir a exclusão dos dados que não somos obrigados a guardar por lei.</li>' +
            '<li>Revogar o consentimento, ciente de que isso pode impedir a prestação do serviço.</li>' +
          '</ul>' +
          '<div class="help-block__c" style="margin-top:8px">Para exercer qualquer um deles, escreva ' +
          'para <a href="mailto:' + U.escAttr(org.email) + '">' + U.esc(org.email) + '</a>.</div></div>' +

        '<div class="help-block"><div class="help-block__t">Cuidado com o aparelho compartilhado</div>' +
          '<div class="help-block__c">Se você estiver usando um computador de uso comum, apague os ' +
          'dados deste portal ao terminar. O botão abaixo remove tudo definitivamente.</div></div>' +
      '</div>' +
    '</section>' +

    '<section class="section">' +
      '<div class="card card--pad">' +
        '<h2 class="section__title" style="font-size:15px">Apagar meus dados deste aparelho</h2>' +
        '<p class="section__desc" style="margin-bottom:14px">Remove o cadastro, os sócios e todos os ' +
          'arquivos anexados' + (usado ? " (" + U.esc(U.bytes(usado)) + ")" : "") + '. Não há como desfazer.</p>' +
        '<button type="button" class="btn btn--danger" id="btnApagarTudo">' +
          ic("ic-trash") + 'Apagar tudo</button>' +
      '</div>' +
    '</section>' + rodape();
  }

  /* Enquanto o cliente não aceitou os termos, as telas livres
     precisam de um caminho de volta — o menu está bloqueado. */
  function voltarBoasVindas() {
    if (Store.estado.aceiteLGPD) return "";
    return '<div style="margin-bottom:14px">' +
      '<button type="button" class="btn btn--ghost btn--sm" data-rota="boas-vindas">' +
        ic("ic-chevron-right", "gira180") + 'Voltar</button></div>';
  }

  /* ---------- Rodapé ---------- */
  function rodape() {
    return '<footer class="foot">' +
      '<strong>' + U.esc(DATA.ORG.nome) + '</strong><br>' +
      U.esc(DATA.ORG.telefoneExibicao) + ' · ' + U.esc(DATA.ORG.email) + '<br>' +
      '<a href="#/privacidade" data-rota="privacidade">Privacidade e segurança</a>' +
    '</footer>';
  }

  /* ============================================================
     Render
     ============================================================ */
  /* Telas acessíveis antes do aceite: o cliente sempre pode ler a
     política e pedir ajuda sem ter concordado com nada. */
  var ROTAS_LIVRES = ["boas-vindas", "privacidade", "ajuda"];

  function render() {
    var rota = rotaDaURL();

    if (!Store.estado.aceiteLGPD && ROTAS_LIVRES.indexOf(rota) === -1) rota = "boas-vindas";
    estadoUI.rota = rota;

    var alvo = $("#view");
    var html;
    switch (rota) {
      case "boas-vindas": html = viewBoasVindas(); break;
      case "documentos":  html = viewDocumentos(); break;
      case "academy":     html = viewAcademy(); break;
      case "empresa":     html = viewEmpresa(); break;
      case "ajuda":       html = viewAjuda(); break;
      case "privacidade": html = viewPrivacidade(); break;
      default:            html = viewInicio();
    }
    alvo.className = "view";
    alvo.innerHTML = html;

    /* Cada bloco de primeiro nível entra com fade e leve subida;
       os cartões da Academy entram em cascata. */
    $$("#view > *").forEach(function (n) { n.classList.add("reveal"); });
    $$("#view .tile").forEach(function (n) { n.classList.add("reveal"); });
    if (global.Motion) global.Motion.aplicar(alvo);

    var meta = ROTAS.filter(function (r) { return r.id === rota; })[0];
    document.title = (meta ? meta.titulo + " · " : "") + "Portal do Cliente · " + DATA.ORG.curto;

    atualizarNav(rota);
    if (rota === "boas-vindas") bindBoasVindas();
    if (rota === "empresa") bindEmpresa();
    if (rota === "privacidade") bindPrivacidade();
  }

  function atualizarNav(rota) {
    var resumo = Store.resumoGeral();
    var gate = !Store.estado.aceiteLGPD;

    $$("[data-nav]").forEach(function (b) {
      var id = b.getAttribute("data-nav");
      if (id === rota) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
      var bloqueado = gate && ROTAS_LIVRES.indexOf(id) === -1;
      b.toggleAttribute("disabled", bloqueado);
      b.style.opacity = bloqueado ? ".45" : "";
    });

    $$("[data-badge-pendentes]").forEach(function (n) {
      var v = resumo.pendentes;
      if (v > 0 && !gate) { n.hidden = false; n.textContent = v > 99 ? "99+" : String(v); }
      else n.hidden = true;
    });
  }

  /* ============================================================
     Eventos
     ============================================================ */
  var inputArquivo = null;
  var chaveDestino = null;

  function iniciarUploadInput(chave) {
    chaveDestino = chave;
    inputArquivo.value = "";
    inputArquivo.click();
  }

  function receberArquivos(chave, lista) {
    var arquivos = Array.prototype.slice.call(lista || []);
    if (!arquivos.length) return;
    var usado = Store.bytesUsados();
    var fila = Promise.resolve();
    var enviados = 0, erros = 0;

    arquivos.forEach(function (f) {
      fila = fila.then(function () {
        var erro = U.validaArquivo(f, usado);
        if (erro) {
          erros++;
          UI.toast(U.nomeSeguro(f.name) + ": " + erro, "erro");
          return null;
        }
        usado += f.size;
        return Store.anexar(chave, f).then(function () { enviados++; }, function () {
          erros++;
          UI.toast("Não foi possível salvar " + U.nomeSeguro(f.name) + ".", "erro");
        });
      });
    });

    fila.then(function () {
      if (enviados) {
        Store.flush();
        UI.toast(enviados + " " + U.plural(enviados, "arquivo anexado", "arquivos anexados") + ".", "ok");
      }
      if (enviados || erros) render();
    });
  }

  function abrirArquivo(id, nome) {
    Store.baixarArquivo(id).then(function (blob) {
      if (!blob) { UI.toast("Arquivo não encontrado neste aparelho.", "erro"); return; }
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = U.nomeSeguro(nome || "documento");
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    }, function () {
      UI.toast("Não foi possível abrir o arquivo.", "erro");
    });
  }

  function contextoItem(no) {
    var caixaItem = no.closest("[data-chave]");
    var caixaGrupo = no.closest("[data-grupo]");
    if (!caixaItem || !caixaGrupo) return null;
    var chave = caixaItem.getAttribute("data-chave");
    var partes = chave.split("/");
    var grupo = DATA.GRUPOS.filter(function (g) { return g.id === partes[0]; })[0];
    if (!grupo) return null;
    var itemId = partes[partes.length - 1];
    var item = grupo.itens.filter(function (i) { return i.id === itemId; })[0];
    if (!item) return null;
    return { chave: chave, grupo: grupo, item: item };
  }

  function ligarEventosGlobais() {
    /* Navegação por atributo data-rota (funciona em botões e links). */
    document.addEventListener("click", function (ev) {
      var navBtn = ev.target.closest("[data-nav]");
      if (navBtn && !navBtn.disabled) {
        ev.preventDefault();
        navegar(navBtn.getAttribute("data-nav"));
        return;
      }

      var rotaBtn = ev.target.closest("[data-rota]");
      if (rotaBtn) {
        ev.preventDefault();
        var grupoAlvo = rotaBtn.getAttribute("data-grupo");
        if (grupoAlvo) estadoUI.gruposAbertos[grupoAlvo] = true;
        navegar(rotaBtn.getAttribute("data-rota"));
        return;
      }

      /* --- Documentos --- */
      var toggle = ev.target.closest("[data-toggle]");
      if (toggle) {
        var g = toggle.closest("[data-grupo]").getAttribute("data-grupo");
        estadoUI.gruposAbertos[g] = !estadoUI.gruposAbertos[g];
        render();
        return;
      }

      var ajuda = ev.target.closest("[data-ajuda]");
      if (ajuda) {
        var p = ajuda.getAttribute("data-ajuda").split("|");
        abrirAjudaItem(p[0], p[1]);
        return;
      }

      var enviar = ev.target.closest("[data-enviar]");
      if (enviar) {
        var cx = contextoItem(enviar);
        if (cx) iniciarUploadInput(cx.chave);
        return;
      }

      var baixar = ev.target.closest("[data-baixar]");
      if (baixar) {
        var cxb = contextoItem(baixar);
        var idb = baixar.getAttribute("data-baixar");
        var meta = cxb && (Store.estado.itens[cxb.chave] || {}).arquivos || [];
        var achou = meta.filter(function (a) { return a.id === idb; })[0];
        abrirArquivo(idb, achou ? achou.nome : "documento");
        return;
      }

      var remover = ev.target.closest("[data-remover]");
      if (remover) {
        var cxr = contextoItem(remover);
        if (!cxr) return;
        UI.confirmar({
          titulo: "Remover arquivo",
          mensagem: "O arquivo será apagado deste aparelho. Você poderá enviar outro depois.",
          confirmar: "Remover", perigo: true
        }).then(function (ok) {
          if (!ok) return;
          Store.removerArquivo(cxr.chave, remover.getAttribute("data-remover")).then(function () {
            Store.flush(); render();
          });
        });
        return;
      }

      var na = ev.target.closest("[data-na]");
      if (na) {
        var cxn = contextoItem(na);
        if (!cxn) return;
        Store.commit(function () {
          var r = Store.item(cxn.chave);
          r.na = true; r.atualizadoEm = Date.now();
        }, "na");
        Store.flush(); render();
        return;
      }

      var reativar = ev.target.closest("[data-reativar]");
      if (reativar) {
        var cxa = contextoItem(reativar);
        if (!cxa) return;
        Store.commit(function () {
          var r = Store.item(cxa.chave);
          r.na = false; r.atualizadoEm = Date.now();
        }, "na");
        Store.flush(); render();
        return;
      }

      var forma = ev.target.closest("[data-forma]");
      if (forma) {
        var cxf = contextoItem(forma);
        if (!cxf) return;
        var valor = forma.getAttribute("data-forma");
        Store.commit(function () {
          var r = Store.item(cxf.chave);
          r.forma = (r.forma === valor) ? "" : valor;
          r.na = false;
          r.atualizadoEm = Date.now();
        }, "acesso");
        Store.flush(); render();
        if (valor === "procuracao") {
          UI.toast("Combinado. Nossa equipe entra em contato para orientar a procuração.", "ok");
        }
        return;
      }

      /* --- Sócios --- */
      if (ev.target.closest("#btnAddSocio")) { abrirFormSocio(null); return; }

      var editar = ev.target.closest("[data-editar-socio]");
      if (editar) { abrirFormSocio(editar.getAttribute("data-editar-socio")); return; }

      var remSocio = ev.target.closest("[data-remover-socio]");
      if (remSocio) {
        var sid = remSocio.getAttribute("data-remover-socio");
        var s = Store.estado.socios.filter(function (x) { return x.id === sid; })[0];
        UI.confirmar({
          titulo: "Remover sócio",
          mensagem: "Todos os documentos de " + (s && s.nome ? s.nome : "deste sócio") +
                    " serão apagados deste aparelho.",
          confirmar: "Remover", perigo: true
        }).then(function (ok) {
          if (!ok) return;
          Store.removerSocio(sid);
          Store.flush();
          UI.toast("Sócio removido.", "ok");
          render();
        });
        return;
      }

      /* --- FAQ --- */
      var faq = ev.target.closest("[data-faq]");
      if (faq) {
        var i = faq.getAttribute("data-faq");
        estadoUI.faqAberta[i] = !estadoUI.faqAberta[i];
        render();
        return;
      }
    });

    /* Campos de "dado" e checkbox de grupo não aplicável */
    document.addEventListener("change", function (ev) {
      var grupoNA = ev.target.closest("[data-grupona]");
      if (grupoNA) {
        var gid = grupoNA.closest("[data-grupo]").getAttribute("data-grupo");
        var marcado = grupoNA.checked;
        Store.commit(function (st) {
          if (marcado) st.gruposNA[gid] = true;
          else delete st.gruposNA[gid];
        }, "grupona");
        Store.flush(); render();
        return;
      }

      var dado = ev.target.closest("[data-dado]");
      if (dado) {
        var cx = contextoItem(dado);
        if (!cx) return;
        var v = String(dado.value || "").slice(0, 400);
        Store.commit(function () {
          var r = Store.item(cx.chave);
          r.valor = v;
          if (v) r.na = false;
          r.atualizadoEm = Date.now();
        }, "dado");
        Store.flush(); render();
      }
    });

    /* Máscara ao digitar no campo do PIS */
    document.addEventListener("input", function (ev) {
      var dado = ev.target.closest("[data-dado]");
      if (dado && dado.tagName === "INPUT") {
        var cx = contextoItem(dado);
        if (cx && cx.item.id === "pis") {
          var pos = dado.selectionStart;
          var antes = dado.value.length;
          dado.value = U.mascaraPIS(dado.value);
          if (pos !== null) {
            var delta = dado.value.length - antes;
            try { dado.setSelectionRange(pos + delta, pos + delta); } catch (e) {}
          }
        }
      }
    });

    /* Arrastar e soltar sobre um item */
    ["dragenter", "dragover"].forEach(function (tipo) {
      document.addEventListener(tipo, function (ev) {
        var alvo = ev.target.closest ? ev.target.closest("[data-chave]") : null;
        if (!alvo) return;
        ev.preventDefault();
        alvo.classList.add("drop--over");
      });
    });
    ["dragleave", "drop"].forEach(function (tipo) {
      document.addEventListener(tipo, function (ev) {
        var alvo = ev.target.closest ? ev.target.closest("[data-chave]") : null;
        if (!alvo) return;
        alvo.classList.remove("drop--over");
      });
    });
    document.addEventListener("drop", function (ev) {
      var alvo = ev.target.closest ? ev.target.closest("[data-chave]") : null;
      if (!alvo) return;
      ev.preventDefault();
      var chave = alvo.getAttribute("data-chave");
      var partes = chave.split("/");
      var grupo = DATA.GRUPOS.filter(function (g) { return g.id === partes[0]; })[0];
      var item = grupo && grupo.itens.filter(function (i) { return i.id === partes[partes.length - 1]; })[0];
      if (!item || item.kind !== "arquivo") return;
      receberArquivos(chave, ev.dataTransfer && ev.dataTransfer.files);
    });

    /* Impede que um arquivo solto fora de um item abra no navegador */
    global.addEventListener("dragover", function (ev) { ev.preventDefault(); });
    global.addEventListener("drop", function (ev) { ev.preventDefault(); });

    global.addEventListener("hashchange", render);
    global.addEventListener("beforeunload", function () { Store.flush(); });
  }

  function bindEmpresa() {
    $$("[data-emp]").forEach(function (campo) {
      var chave = campo.getAttribute("data-emp");
      var mascara = campo.getAttribute("data-mascara");

      if (mascara) {
        campo.addEventListener("input", function () {
          campo.value = mascara === "cnpj" ? U.mascaraCNPJ(campo.value) : U.mascaraTelefone(campo.value);
        });
      }

      campo.addEventListener("change", function () {
        var v = String(campo.value || "").slice(0, 200);

        if (chave === "cnpj" && v && !U.validaCNPJ(v)) {
          var e1 = $("#errCnpj"); if (e1) e1.hidden = false;
          campo.setAttribute("aria-invalid", "true");
        } else if (chave === "cnpj") {
          var e2 = $("#errCnpj"); if (e2) e2.hidden = true;
          campo.removeAttribute("aria-invalid");
        }

        if (chave === "responsavelEmail" && v && !U.validaEmail(v)) {
          var e3 = $("#errEmail"); if (e3) e3.hidden = false;
          campo.setAttribute("aria-invalid", "true");
        } else if (chave === "responsavelEmail") {
          var e4 = $("#errEmail"); if (e4) e4.hidden = true;
          campo.removeAttribute("aria-invalid");
        }

        Store.commit(function (st) { st.empresa[chave] = v; }, "empresa");
        Store.flush();
        atualizarNav(estadoUI.rota);
      });
    });
  }

  function bindPrivacidade() {
    var btn = $("#btnApagarTudo");
    if (!btn) return;
    btn.addEventListener("click", function () {
      UI.confirmar({
        titulo: "Apagar todos os dados",
        mensagem: "O cadastro, os sócios e todos os arquivos anexados serão removidos deste " +
                  "aparelho definitivamente. Não é possível desfazer.",
        confirmar: "Apagar tudo", perigo: true
      }).then(function (ok) {
        if (!ok) return;
        Store.apagarTudo().then(function () {
          estadoUI.gruposAbertos = {};
          estadoUI.faqAberta = {};
          UI.toast("Todos os dados foram apagados deste aparelho.", "ok");
          navegar("boas-vindas");
          render();
        });
      });
    });
  }

  /* ============================================================
     Boot
     ============================================================ */
  function iniciar() {
    inputArquivo = document.createElement("input");
    inputArquivo.type = "file";
    inputArquivo.multiple = true;
    inputArquivo.accept = U.ACCEPT_ATTR;
    inputArquivo.style.display = "none";
    inputArquivo.addEventListener("change", function () {
      if (chaveDestino) receberArquivos(chaveDestino, inputArquivo.files);
      chaveDestino = null;
    });
    document.body.appendChild(inputArquivo);

    ligarEventosGlobais();

    Store.on(function (_, motivo) {
      if (motivo === "erro-persistencia") {
        UI.toast("Não foi possível salvar neste aparelho. O armazenamento pode estar cheio ou " +
                 "o navegador está em modo privado.", "erro", 9000);
      }
    });

    Store.iniciar().then(function () {
      if (!location.hash) location.replace("#/inicio");
      render();
      document.body.classList.add("pronto");
    }, function () {
      $("#view").innerHTML =
        '<div class="card card--pad"><div class="notice notice--warn">' +
        '<span class="notice__icon">' + ic("ic-alert") + '</span>' +
        '<span>Não foi possível iniciar o portal neste navegador. Tente novamente ou fale com a ' +
        U.esc(DATA.ORG.curto) + '.</span></div></div>';
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();

  global.APP = { navegar: navegar, render: render };
})(window);
