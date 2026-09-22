/* ============================================================
   Totali · Portal do Cliente
   video.js — vídeo de apresentação na tela inicial (do Academy)

   O vídeo fica no YouTube como "não listado"; aqui só o
   identificador (o trecho depois de v=). Não listado: não aparece
   em busca nem no canal, mas quem tem o link assiste. Privado NÃO
   toca em site nenhum. O player usa youtube-nocookie.com e só é
   carregado quando o cliente toca (capa primeiro: sem terceiros
   antes do clique, e a tela inicial continua leve).

   Editável em Painel › Conteúdo › Vídeo (conteudo/video):
     { youtube, titulo, texto, mostrarAte: "sempre" | "30dias" | "primeira" }
   O cliente pode dispensar ("já assisti"); fica lembrado no aparelho.
   ============================================================ */
(function (global) {
  "use strict";
  var U = global.U, UI = global.UI, ic = global.ic, Dados = global.Dados;
  var ID_YT = /^[A-Za-z0-9_-]{11}$/;
  var VIDEO = { youtube: "", titulo: "Como funciona o seu portal", texto: "Em 3 minutos: o que você faz aqui, o que a Totali faz por você e como falar com a gente.", mostrar: "30dias" };
  function aplicar(b) { if (!b) return; if (typeof b.youtube === "string") VIDEO.youtube = ID_YT.test(b.youtube.trim()) ? b.youtube.trim() : ""; if (typeof b.titulo === "string") VIDEO.titulo = U.txt(b.titulo, 80, VIDEO.titulo); if (typeof b.texto === "string") VIDEO.texto = U.txt(b.texto, 240, VIDEO.texto); if (["sempre", "30dias", "primeira"].indexOf(b.mostrar) > -1) VIDEO.mostrar = b.mostrar; }
  function extrairId(v) { v = String(v || "").trim(); var m = v.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/); return m ? m[1] : (ID_YT.test(v) ? v : ""); }
  function html(compacto) {
    if (!VIDEO.youtube) return "";
    return '<div class="card video" id="cardVideo"><div class="video__capa" data-acao="video-abrir" role="button" tabindex="0" aria-label="Assistir: ' + U.esc(VIDEO.titulo) + '"><img src="https://i.ytimg.com/vi/' + VIDEO.youtube + '/hqdefault.jpg" alt="" loading="lazy"><span class="video__play">' + ic("play", "ic--xl") + '</span></div><div class="card__corpo" style="padding-top:10px"><div class="linha linha--entre"><div><b class="f-15">' + U.esc(VIDEO.titulo) + '</b>' + (compacto ? "" : '<div class="f-13 txt-2">' + U.esc(VIDEO.texto) + "</div>") + '</div><button type="button" class="btn btn--xs btn--fantasma" data-acao="video-dispensar">Já assisti</button></div></div></div>';
  }
  function ligar(v) {
    UI.delegar(v, {
      "video-abrir": function (b) { var capa = b; capa.outerHTML = '<div class="video__player"><iframe src="https://www.youtube-nocookie.com/embed/' + VIDEO.youtube + '?autoplay=1&rel=0&modestbranding=1" title="' + U.esc(VIDEO.titulo) + '" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="no-referrer"></iframe></div>'; if (global.Uso) global.Uso.vitrine("video", "portal", "assistiu"); var e = global.Portal && global.Portal.empresa; if (e && !(e.marcos || {}).video) Dados.salvarEmpresa(e.id, { marcos: Object.assign(e.marcos || {}, { video: Date.now() }) }); },
      "video-dispensar": function () { UI.definirPref("videoDispensado", Date.now()); var c = UI.$("#cardVideo", v); if (c) c.remove(); }
    });
  }
  /* Tela inicial: aparece conforme a regra, até o cliente dispensar */
  global.InicioExtras = global.InicioExtras || [];
  var gancho = function () {
    if (!VIDEO.youtube) return null;
    var e = global.Portal.empresa, pref = UI.pref();
    if (pref.videoDispensado) return null;
    if (VIDEO.mostrar === "primeira" && (e.marcos || {}).video) return null;
    if (VIDEO.mostrar === "30dias" && U.diasEntre(e.criadaEm, Date.now()) > 30) return null;
    return { lado: html(false) };
  };
  gancho.ligar = ligar;
  global.InicioExtras.push(gancho);
  global.Video = { VIDEO: VIDEO, aplicar: aplicar, html: html, ligar: ligar, extrairId: extrairId };
})(window);
