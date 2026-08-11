/* ============================================================
   Totali · Portal de Onboarding
   academy-editor.js — monta a Academy pela tela (uso interno)

   A equipe cria trilhas e aulas aqui, arrasta a ordem, escreve
   título e descrição e cola o identificador do YouTube. No fim,
   baixa o arquivo js/academy.js pronto para substituir no
   repositório. Nenhuma linha de código é escrita à mão.

   O rascunho fica salvo neste navegador enquanto você trabalha,
   para não se perder se a aba fechar.

   [FIREBASE] Quando o servidor entrar, o botão de baixar some:
   o painel grava direto no banco e o portal lê de lá.
   ============================================================ */
(function (global) {
  "use strict";

  var U = global.U, UI = global.UI;
  var $ = UI.$, $$ = UI.$$;
  var CHAVE = "totali.onboarding.academy.rascunho";
  var ID_YT = /^[A-Za-z0-9_-]{11}$/;

  var trilhas = [];

  /* ---------- Persistência do rascunho ---------- */
  function salvar() {
    try { localStorage.setItem(CHAVE, JSON.stringify(trilhas)); } catch (e) { /* segue */ }
  }

  function carregar() {
    var salvas = null;
    try { salvas = JSON.parse(localStorage.getItem(CHAVE) || "null"); } catch (e) { salvas = null; }
    if (Array.isArray(salvas) && salvas.length) { trilhas = salvas; return "rascunho"; }
    var cfg = global.ACADEMY_CONFIG;
    if (cfg && Array.isArray(cfg.trilhas) && cfg.trilhas.length) {
      trilhas = JSON.parse(JSON.stringify(cfg.trilhas));
      return "publicado";
    }
    if (global.DATA && Array.isArray(global.DATA.ACADEMY)) {
      trilhas = JSON.parse(JSON.stringify(global.DATA.ACADEMY));
      return "padrao";
    }
    trilhas = [];
    return "vazio";
  }

  /* ---------- Helpers ---------- */
  function idDeTexto(txt, i) {
    var base = String(txt || "").toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
    return base || ("trilha-" + (i + 1));
  }

  /* Aceita o endereço inteiro ou só o identificador. */
  function extrairId(texto) {
    var t = String(texto || "").trim();
    if (!t) return "";
    if (ID_YT.test(t)) return t;
    var m = t.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : "";
  }

  function mover(lista, de, para) {
    if (para < 0 || para >= lista.length) return;
    var item = lista.splice(de, 1)[0];
    lista.splice(para, 0, item);
  }

  function contarPublicadas(t) {
    return (t.videos || []).filter(function (v) { return ID_YT.test(v.youtube); }).length;
  }

  /* ---------- Desenho ---------- */
  function desenhar() {
    var alvo = $("#acLista");
    if (!trilhas.length) {
      alvo.innerHTML = '<div class="empty">' +
        '<div class="empty__title">Nenhuma trilha ainda</div>' +
        '<div class="empty__desc">Crie a primeira trilha abaixo. Cada trilha é um assunto; ' +
        'dentro dela vão as aulas.</div></div>';
    } else {
      alvo.innerHTML = trilhas.map(function (t, i) {
        var pub = contarPublicadas(t);
        var n = (t.videos || []).length;
        return '<div class="ac-trilha" data-t="' + i + '">' +
          '<div class="ac-trilha__topo">' +
            '<span class="ac-ordem">' +
              '<button type="button" class="ac-mini" data-tsobe="' + i + '" aria-label="Subir trilha">&#8593;</button>' +
              '<button type="button" class="ac-mini" data-tdesce="' + i + '" aria-label="Descer trilha">&#8595;</button>' +
            '</span>' +
            '<span class="ac-trilha__n">' + (i + 1) + '</span>' +
            '<span style="flex:1;min-width:0">' +
              '<span class="ac-trilha__t">' + U.esc(t.titulo || "(sem título)") + '</span>' +
              '<span class="ac-trilha__d">' + pub + ' de ' + n + ' ' +
                (n === 1 ? "aula publicada" : "aulas publicadas") + '</span>' +
            '</span>' +
            '<button type="button" class="btn btn--quiet btn--sm" data-tremove="' + i + '">Remover</button>' +
          '</div>' +

          '<div class="grid-2">' +
            '<div class="field"><label class="field__label">Título da trilha</label>' +
              '<input type="text" class="input" data-tcampo="titulo" data-t="' + i + '" ' +
              'maxlength="120" value="' + U.escAttr(t.titulo || "") + '"></div>' +
            '<div class="field"><label class="field__label">Etiqueta</label>' +
              '<input type="text" class="input" data-tcampo="kicker" data-t="' + i + '" ' +
              'maxlength="40" placeholder="Trilha ' + (i + 1) + '" value="' + U.escAttr(t.kicker || "") + '"></div>' +
          '</div>' +
          '<div class="field"><label class="field__label">Descrição</label>' +
            '<textarea class="textarea" data-tcampo="desc" data-t="' + i + '" maxlength="400" ' +
            'style="min-height:64px">' + U.esc(t.desc || "") + '</textarea></div>' +

          '<div class="ac-aulas">' +
            (t.videos || []).map(function (v, j) {
              var ok = ID_YT.test(v.youtube);
              return '<div class="ac-aula">' +
                '<span class="ac-ordem">' +
                  '<button type="button" class="ac-mini" data-vsobe="' + i + ':' + j + '" aria-label="Subir aula">&#8593;</button>' +
                  '<button type="button" class="ac-mini" data-vdesce="' + i + ':' + j + '" aria-label="Descer aula">&#8595;</button>' +
                '</span>' +
                '<span class="ac-aula__n">' + (j + 1) + '</span>' +
                '<span class="ac-aula__campos">' +
                  '<input type="text" class="input" data-vcampo="titulo" data-v="' + i + ':' + j + '" ' +
                    'maxlength="140" placeholder="Título da aula" value="' + U.escAttr(v.titulo || "") + '">' +
                  '<span class="ac-aula__linha">' +
                    '<input type="text" class="input" data-vcampo="youtube" data-v="' + i + ':' + j + '" ' +
                      'placeholder="Link ou ID do YouTube" value="' + U.escAttr(v.youtube || "") + '">' +
                    '<input type="text" class="input" data-vcampo="duracao" data-v="' + i + ':' + j + '" ' +
                      'maxlength="20" placeholder="4 min" style="max-width:110px" ' +
                      'value="' + U.escAttr(v.duracao || "") + '">' +
                  '</span>' +
                  '<span class="ac-aula__estado ' + (ok ? "ok" : "") + '">' +
                    (ok ? "Publicada · capa vem do YouTube" : "Em breve · sem vídeo") + '</span>' +
                '</span>' +
                '<button type="button" class="ac-mini ac-mini--x" data-vremove="' + i + ':' + j + '" ' +
                  'aria-label="Remover aula">&#215;</button>' +
              '</div>';
            }).join("") +
            '<button type="button" class="btn btn--ghost btn--sm" data-vadd="' + i + '">' +
              'Adicionar aula</button>' +
          '</div>' +
        '</div>';
      }).join("");
    }
    atualizarResumo();
    salvar();
  }

  function atualizarResumo() {
    var aulas = trilhas.reduce(function (a, t) { return a + (t.videos || []).length; }, 0);
    var pub = trilhas.reduce(function (a, t) { return a + contarPublicadas(t); }, 0);
    $("#acResumo").textContent = trilhas.length + " " +
      (trilhas.length === 1 ? "trilha" : "trilhas") + " · " + aulas + " " +
      (aulas === 1 ? "aula" : "aulas") + " · " + pub + " com vídeo publicado";
  }

  /* ---------- Geração do arquivo ---------- */
  function montarArquivo() {
    var limpas = trilhas.map(function (t, i) {
      return {
        id: idDeTexto(t.titulo, i),
        kicker: String(t.kicker || ("Trilha " + (i + 1))).slice(0, 40),
        titulo: String(t.titulo || "").slice(0, 120),
        desc: String(t.desc || "").slice(0, 400),
        capa: "",
        videos: (t.videos || []).filter(function (v) { return String(v.titulo || "").trim(); })
          .map(function (v) {
            return {
              titulo: String(v.titulo || "").slice(0, 140),
              duracao: String(v.duracao || "").slice(0, 20),
              desc: String(v.desc || "").slice(0, 400),
              youtube: ID_YT.test(v.youtube) ? v.youtube : "",
              capa: ""
            };
          })
      };
    }).filter(function (t) { return t.titulo; });

    return "/* ============================================================\n" +
      "   Totali · Portal de Onboarding\n" +
      "   academy.js — conteúdo da Academy\n\n" +
      "   ARQUIVO GERADO PELO PAINEL DA EQUIPE. Não edite à mão:\n" +
      "   abra equipe.html, seção Academy, altere na tela e baixe\n" +
      "   este arquivo de novo.\n\n" +
      "   Gerado em " + new Date().toLocaleString("pt-BR") + "\n" +
      "   ============================================================ */\n" +
      "window.ACADEMY_CONFIG = " +
      JSON.stringify({ atualizadoEm: Date.now(), trilhas: limpas }, null, 2) + ";\n";
  }

  function baixarArquivo() {
    var blob = new Blob([montarArquivo()], { type: "application/javascript;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "academy.js";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    UI.toast("academy.js baixado. Substitua o arquivo em js/ e publique.", "ok", 9000);
  }

  /* ---------- Eventos ---------- */
  function ligar() {
    var lista = $("#acLista");

    lista.addEventListener("click", function (ev) {
      var b = ev.target.closest("button");
      if (!b) return;
      var g = function (attr) { return b.getAttribute(attr); };
      var par = function (attr) {
        var v = g(attr); if (!v) return null;
        var p = v.split(":"); return { t: +p[0], v: +p[1] };
      };

      if (g("data-tsobe") !== null) { mover(trilhas, +g("data-tsobe"), +g("data-tsobe") - 1); desenhar(); return; }
      if (g("data-tdesce") !== null) { mover(trilhas, +g("data-tdesce"), +g("data-tdesce") + 1); desenhar(); return; }
      if (g("data-tremove") !== null) {
        var iT = +g("data-tremove");
        UI.confirmar({
          titulo: "Remover trilha",
          mensagem: "A trilha \"" + (trilhas[iT].titulo || "sem título") + "\" e suas aulas saem da lista.",
          confirmar: "Remover", perigo: true
        }).then(function (ok) { if (ok) { trilhas.splice(iT, 1); desenhar(); } });
        return;
      }
      if (g("data-vadd") !== null) {
        var iA = +g("data-vadd");
        trilhas[iA].videos = trilhas[iA].videos || [];
        trilhas[iA].videos.push({ titulo: "", duracao: "", desc: "", youtube: "", capa: "" });
        desenhar();
        return;
      }
      var pv = par("data-vsobe");
      if (pv) { mover(trilhas[pv.t].videos, pv.v, pv.v - 1); desenhar(); return; }
      pv = par("data-vdesce");
      if (pv) { mover(trilhas[pv.t].videos, pv.v, pv.v + 1); desenhar(); return; }
      pv = par("data-vremove");
      if (pv) { trilhas[pv.t].videos.splice(pv.v, 1); desenhar(); return; }
    });

    /* Digitação: grava sem redesenhar, para não perder o cursor. */
    lista.addEventListener("input", function (ev) {
      var el = ev.target;
      var campoT = el.getAttribute("data-tcampo");
      if (campoT) { trilhas[+el.getAttribute("data-t")][campoT] = el.value; salvar(); return; }

      var campoV = el.getAttribute("data-vcampo");
      if (campoV) {
        var p = el.getAttribute("data-v").split(":");
        var v = trilhas[+p[0]].videos[+p[1]];
        if (campoV === "youtube") {
          var extraido = extrairId(el.value);
          v.youtube = extraido || el.value.trim();
          var estado = el.closest(".ac-aula").querySelector(".ac-aula__estado");
          var ok = ID_YT.test(v.youtube);
          estado.textContent = ok ? "Publicada · capa vem do YouTube" : "Em breve · sem vídeo";
          estado.classList.toggle("ok", ok);
          if (extraido && el.value.trim() !== extraido) el.value = extraido;
        } else {
          v[campoV] = el.value;
        }
        salvar();
        atualizarResumo();
      }
    });

    $("#acAddTrilha").addEventListener("click", function () {
      trilhas.push({
        id: "", kicker: "Trilha " + (trilhas.length + 1),
        titulo: "", desc: "", capa: "", videos: []
      });
      desenhar();
      var ultimos = $$("[data-tcampo='titulo']");
      if (ultimos.length) ultimos[ultimos.length - 1].focus();
    });

    $("#acBaixar").addEventListener("click", baixarArquivo);

    $("#acRestaurar").addEventListener("click", function () {
      UI.confirmar({
        titulo: "Descartar rascunho",
        mensagem: "Volta para o conteúdo que está publicado no portal. O que você editou aqui se perde.",
        confirmar: "Descartar", perigo: true
      }).then(function (ok) {
        if (!ok) return;
        try { localStorage.removeItem(CHAVE); } catch (e) {}
        carregar();
        desenhar();
        UI.toast("Rascunho descartado.", "ok");
      });
    });
  }

  function iniciar() {
    if (!$("#acLista")) return;
    var origem = carregar();
    var aviso = {
      rascunho: "Você tem um rascunho salvo neste navegador. Continue de onde parou.",
      publicado: "Carregado o conteúdo publicado no portal.",
      padrao: "Carregada a grade padrão do sistema. Ajuste e baixe o arquivo.",
      vazio: "Comece criando a primeira trilha."
    }[origem];
    $("#acOrigem").textContent = aviso;
    desenhar();
    ligar();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})(window);
