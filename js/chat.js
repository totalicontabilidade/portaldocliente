/* ============================================================
   Totali · Portal do Cliente
   chat.js — o chat cliente ↔ equipe (usado nas duas páginas)

   Padrão de conversa: QUEM ENVIA fica à DIREITA (bolha navy),
   QUEM RECEBE fica à ESQUERDA (bolha clara com nome do autor).
   Emojis por categoria com busca em português (mesma lista do
   Agência 100K), anexos (arquivo e câmera), reações rápidas,
   separador por dia, "visto" com dois checks dourados.

   Uso:
     var chat = Chat.montar(container, {
       empresaId, eu: {uid, nome, lado: "cliente"|"equipe"},
       cabecalho: html opcional, embutido: bool,
       aoEnviar(msg) opcional, aoResolver() opcional (só equipe)
     });
     chat.destruir();
   ============================================================ */
(function (global) {
  "use strict";
  var U = global.U, UI = global.UI, ic = global.ic, Dados = global.Dados;

  var CATEGORIAS = [
    { nome: "Carinhas", icone: "😀", itens: [["😀","feliz"],["😃","feliz"],["😄","sorriso"],["😁","sorriso"],["😆","rindo"],["😅","suor"],["🤣","chorando de rir"],["😂","rindo"],["🙂","sorriso leve"],["🙃","de cabeça para baixo"],["😉","piscada"],["😊","tímido"],["😇","anjo"],["🥰","apaixonado"],["😍","olhos de coração"],["🤩","estrelas"],["😘","beijo"],["😋","delícia"],["😛","língua"],["😜","língua piscando"],["🤪","louco"],["🤔","pensando"],["🤫","silêncio"],["🤭","riso escondido"],["😐","neutro"],["😑","sem expressão"],["😶","sem boca"],["😏","malicioso"],["😒","entediado"],["🙄","revirando os olhos"],["😬","dentes"],["😌","aliviado"],["😔","triste"],["😪","sono"],["😴","dormindo"],["😷","máscara"],["🤒","doente"],["🤕","machucado"],["🥵","calor"],["🥶","frio"],["😎","óculos escuros"],["🤓","nerd"],["🧐","monóculo"],["😕","confuso"],["😟","preocupado"],["😮","surpreso"],["😲","chocado"],["😳","vermelho"],["🥺","pidão"],["😢","chorando"],["😭","chorando muito"],["😤","bufando"],["😡","bravo"],["🤯","explodindo"],["😱","gritando"],["🥳","festa"],["🤠","caubói"],["🤗","abraço"],["🫡","continência"]] },
    { nome: "Gestos", icone: "👍", itens: [["👍","joinha"],["👎","negativo"],["👏","palmas"],["🙌","comemoração"],["🙏","obrigado"],["🤝","aperto de mão"],["💪","força"],["✌️","paz"],["🤞","dedos cruzados"],["👌","ok"],["🤙","me liga"],["👋","tchau"],["✋","pare"],["☝️","atenção"],["👉","aponta"],["👈","aponta esquerda"],["👆","acima"],["👇","abaixo"],["✍️","escrevendo"],["🫶","coração com as mãos"],["👀","olhos"],["🧠","cérebro"],["🗣️","falando"],["🙋","levantando a mão"],["🤷","não sei"],["🤦","mão na testa"],["💁","informação"],["🙇","reverência"],["🧑‍💻","programando"],["🎨","artista"]] },
    { nome: "Trabalho", icone: "📌", itens: [["✅","feito"],["❌","errado"],["⚠️","atenção"],["❗","importante"],["❓","dúvida"],["⏰","prazo"],["⏳","esperando"],["📌","fixar"],["📎","anexo"],["📁","pasta"],["📄","documento"],["📝","anotação"],["📊","gráfico"],["📈","subindo"],["📉","caindo"],["💰","dinheiro"],["💵","nota"],["🧾","recibo"],["📅","calendário"],["📆","data"],["📷","foto"],["📸","flash"],["🎬","vídeo"],["🎥","câmera"],["🎤","microfone"],["🎧","fone"],["🖥️","computador"],["💻","notebook"],["📱","celular"],["🖨️","impressora"],["✏️","lápis"],["🖊️","caneta"],["🎯","meta"],["🚀","lançamento"],["💡","ideia"],["🔍","buscar"],["🔒","trancado"],["🔑","chave"],["📣","anúncio"],["🔔","aviso"],["🏆","troféu"],["🥇","primeiro lugar"],["🎉","festa"],["🎊","confete"],["🎁","presente"],["☕","café"],["🍕","pizza"],["🍺","cerveja"],["🏦","banco"],["🧮","calculadora"]] },
    { nome: "Corações", icone: "❤️", itens: [["❤️","coração"],["🧡","coração laranja"],["💛","coração amarelo"],["💚","coração verde"],["💙","coração azul"],["💜","coração roxo"],["🖤","coração preto"],["🤍","coração branco"],["💔","coração partido"],["❤️‍🔥","coração em chamas"],["💕","dois corações"],["💖","coração brilhante"],["💗","coração crescendo"],["💘","flecha"],["💝","laço"],["✨","brilho"],["⭐","estrela"],["🌟","estrela brilhante"],["🔥","fogo"],["💯","cem"],["🌈","arco-íris"],["☀️","sol"],["🌙","lua"],["⚡","raio"],["🌊","onda"],["🍀","trevo"],["🌹","rosa"],["🌻","girassol"],["🐶","cachorro"],["🐱","gato"]] }
  ];
  var RAPIDAS = ["👍", "❤️", "😂", "🎉", "👀", "✅", "🙏", "🔥"];

  function soEmoji(t) { return /^(\p{Extended_Pictographic}|\p{Emoji_Modifier}|‍|️|\s){1,6}$/u.test(t || "") && (t || "").trim().length > 0; }

  function texto(t) {
    var esc = U.esc(t);
    return esc.replace(/(https?:\/\/[^\s<>"']+)/g, function (u) { return '<a href="' + u + '" target="_blank" rel="noopener noreferrer nofollow">' + u + "</a>"; });
  }

  function seletorEmojis(aoEscolher, aoFechar) {
    var el = document.createElement("div"); el.className = "emojis"; var cat = 0, q = "";
    function desenhar() {
      var itens = q ? CATEGORIAS.flatMap(function (c) { return c.itens; }).filter(function (i) { return i[1].indexOf(q) > -1; }) : CATEGORIAS[cat].itens;
      el.innerHTML = '<input class="emojis__busca" placeholder="Buscar: feliz, prazo, café…" value="' + U.esc(q) + '">' +
        (q ? "" : '<div class="emojis__cats">' + CATEGORIAS.map(function (c, i) { return '<button type="button" title="' + c.nome + '" aria-pressed="' + (i === cat) + '" data-cat="' + i + '">' + c.icone + "</button>"; }).join("") + '<span class="nome">' + CATEGORIAS[cat].nome + "</span></div>") +
        '<div class="emojis__grade">' + (itens.length ? itens.map(function (i) { return '<button type="button" title="' + U.esc(i[1]) + '" data-e="' + U.esc(i[0]) + '">' + i[0] + "</button>"; }).join("") : '<span style="grid-column:span 8" class="txt-mudo centro f-12">Nada com esse nome.</span>') + "</div>";
      var b = el.querySelector(".emojis__busca"); b.addEventListener("input", function () { q = b.value.trim().toLowerCase(); var pos = b.selectionStart; desenhar(); var nb = el.querySelector(".emojis__busca"); nb.focus(); nb.setSelectionRange(pos, pos); });
    }
    el.addEventListener("click", function (e) {
      var c = e.target.closest("[data-cat]"); if (c) { cat = Number(c.dataset.cat); desenhar(); return; }
      var b = e.target.closest("[data-e]"); if (b) { aoEscolher(b.dataset.e); }
    });
    desenhar();
    setTimeout(function () {
      var fora = function (ev) { if (!el.contains(ev.target)) { document.removeEventListener("mousedown", fora); aoFechar(); } };
      document.addEventListener("mousedown", fora);
    }, 0);
    return el;
  }

  function montar(container, opts) {
    var eu = opts.eu, empresaId = opts.empresaId;
    var mensagens = [], anexos = [], parar = null, emojisEl = null, reagirEl = null, primeira = true;
    var ultimoIdOutro = "";
    container.classList.add("chat"); if (opts.embutido) container.classList.add("chat--embutido");
    container.innerHTML =
      (opts.cabecalho || "") +
      '<div class="chat__lista" role="log" aria-live="polite"></div>' +
      '<div class="chat__compor">' +
        '<div class="chat__anexos-pend" hidden></div>' +
        '<div class="chat__linha">' +
          '<button type="button" class="chat__ferr" data-f="emoji" aria-label="Emojis">' + ic("smile", "ic--lg") + "</button>" +
          '<button type="button" class="chat__ferr" data-f="anexo" aria-label="Anexar arquivo">' + ic("paperclip", "ic--lg") + "</button>" +
          '<button type="button" class="chat__ferr so-mobile" data-f="camera" aria-label="Tirar foto">' + ic("camera", "ic--lg") + "</button>" +
          '<textarea class="chat__caixa" rows="1" placeholder="Escreva uma mensagem…" aria-label="Mensagem"></textarea>' +
          '<button type="button" class="chat__enviar" aria-label="Enviar" disabled>' + ic("send", "ic--lg") + "</button>" +
        "</div>" +
        '<input type="file" multiple hidden class="chat__file">' +
        '<input type="file" accept="image/*" capture="environment" hidden class="chat__camera">' +
      "</div>";
    var lista = container.querySelector(".chat__lista"), caixa = container.querySelector(".chat__caixa"), btnEnviar = container.querySelector(".chat__enviar");
    var pend = container.querySelector(".chat__anexos-pend"), compor = container.querySelector(".chat__compor");
    var inputFile = container.querySelector(".chat__file"), inputCam = container.querySelector(".chat__camera");

    function podeEnviar() { btnEnviar.disabled = !(caixa.value.trim() || anexos.length); }
    function autoAltura() { caixa.style.height = "auto"; caixa.style.height = Math.min(140, caixa.scrollHeight) + "px"; }

    function desenharPend() {
      pend.hidden = !anexos.length;
      pend.innerHTML = anexos.map(function (a, i) { return '<span class="chat__anexo-pend">' + ic(U.ehImagem(a.mime, a.nome) ? "image" : "file", "ic--sm") + U.esc(a.nome) + '<button type="button" data-rm="' + i + '" aria-label="Remover">' + ic("x", "ic--sm") + "</button></span>"; }).join("");
      podeEnviar();
    }
    pend.addEventListener("click", function (e) { var b = e.target.closest("[data-rm]"); if (b) { anexos.splice(Number(b.dataset.rm), 1); desenharPend(); } });

    function anexoHtml(a) {
      var img = U.ehImagem(a.mime, a.nome);
      return '<a class="msg__anexo' + (img ? " msg__anexo--imagem" : "") + '" data-anexo="' + U.esc(a.id || a.path) + '" href="#" title="' + U.esc(a.nome) + '">' + (img ? '<img alt="' + U.esc(a.nome) + '" data-src="1">' : ic("file") + "<span>" + U.esc(a.nome) + " · " + U.tamanho(a.tamanho) + "</span>") + "</a>";
    }
    function bolha(m) {
      var minha = m.autor.uid === eu.uid || (m.autor.lado === eu.lado && !m.autor.sistema && m.autor.lado === "equipe" && eu.lado === "equipe" && m.autor.uid === eu.uid);
      var doMeuLado = m.autor.lado === eu.lado;
      var lida = doMeuLado && Object.keys(m.lidaPor || {}).some(function (u) { return u !== m.autor.uid; });
      var so = soEmoji(m.texto) && !(m.anexos || []).length;
      var reacoes = Object.keys(m.reacoes || {}).map(function (e) { return '<button type="button" class="msg__reacao" data-reagir="' + U.esc(e) + '" data-msg="' + m.id + '">' + e + " " + m.reacoes[e].length + "</button>"; }).join("");
      return '<div class="msg ' + (doMeuLado ? "msg--eu" : "msg--outro") + '" data-id="' + m.id + '">' +
        (doMeuLado ? "" : '<span class="msg__avatar">' + UI.avatar(m.autor.nome, m.autor.lado === "equipe" ? "avatar--gold avatar--sm" : "avatar--sm") + "</span>") +
        '<div><div class="msg__bolha' + (so ? " so-emoji" : "") + '">' +
          (doMeuLado ? "" : '<span class="msg__autor">' + U.esc(m.autor.nome) + (m.autor.lado === "equipe" ? " · Totali" : "") + "</span>") +
          (m.texto ? texto(m.texto) : "") +
          ((m.anexos || []).length ? '<div class="msg__anexos">' + m.anexos.map(anexoHtml).join("") + "</div>" : "") +
          (so ? "" : '<div class="msg__hora">' + U.hora(m.em) + (doMeuLado ? '<span class="' + (lida ? "lida" : "") + '">' + ic(lida ? "checkcheck" : "check", "ic--sm") + "</span>" : "") + "</div>") +
        "</div>" + (reacoes ? '<div class="msg__reacoes">' + reacoes + "</div>" : "") + "</div></div>";
    }
    function desenhar() {
      if (!mensagens.length) { lista.innerHTML = '<div class="chat__vazio">' + ic("chat", "ic--xl") + "<b>" + (eu.lado === "cliente" ? "Fale com a sua equipe" : "Nenhuma mensagem ainda") + "</b><span>" + (eu.lado === "cliente" ? "Respondemos em horário comercial. Pode mandar áudio, foto ou arquivo." : "Comece a conversa com o cliente.") + "</span></div>"; return; }
      var html = "", dia = "";
      mensagens.forEach(function (m) { var d = U.data(m.em); if (d !== dia) { dia = d; html += '<div class="chat__dia">' + U.esc(U.rotuloDia(m.em)) + "</div>"; } html += bolha(m); });
      var noFim = lista.scrollHeight - lista.scrollTop - lista.clientHeight < 80;
      lista.innerHTML = html;
      if (primeira || noFim) { lista.scrollTop = lista.scrollHeight; primeira = false; }
      lista.querySelectorAll("img[data-src]").forEach(function (img) { var a = img.closest("[data-anexo]"); var anexo = acharAnexo(a.dataset.anexo); if (anexo) Dados.urlAnexo(anexo).then(function (u) { if (u) img.src = u; }); });
    }
    function acharAnexo(id) { for (var i = 0; i < mensagens.length; i++) { var a = (mensagens[i].anexos || []).filter(function (x) { return (x.id || x.path) === id; })[0]; if (a) return a; } return null; }

    lista.addEventListener("click", function (e) {
      var a = e.target.closest("[data-anexo]");
      if (a) { e.preventDefault(); var anexo = acharAnexo(a.dataset.anexo); if (anexo) Dados.urlAnexo(anexo).then(function (u) { if (u) global.open(u, "_blank", "noopener"); else UI.toast("Arquivo indisponível.", "aviso"); }); return; }
      var r = e.target.closest("[data-reagir]");
      if (r) { Dados.reagir(empresaId, r.dataset.msg, r.dataset.reagir, eu.uid); return; }
      var b = e.target.closest(".msg__bolha");
      if (b) abrirReagir(b.closest(".msg").dataset.id, b);
    });
    var pressTimer = null;
    lista.addEventListener("touchstart", function (e) { var b = e.target.closest(".msg__bolha"); if (!b) return; pressTimer = setTimeout(function () { abrirReagir(b.closest(".msg").dataset.id, b); UI.vibrar(10); }, 450); }, { passive: true });
    lista.addEventListener("touchend", function () { clearTimeout(pressTimer); }, { passive: true });
    lista.addEventListener("touchmove", function () { clearTimeout(pressTimer); }, { passive: true });
    function abrirReagir(msgId, bolhaEl) {
      fecharReagir();
      reagirEl = document.createElement("div"); reagirEl.className = "reagir";
      reagirEl.innerHTML = RAPIDAS.map(function (e) { return '<button type="button" data-e="' + e + '">' + e + "</button>"; }).join("");
      var r = bolhaEl.getBoundingClientRect(), lr = lista.getBoundingClientRect();
      reagirEl.style.top = (r.top - lr.top + lista.scrollTop - 40) + "px";
      reagirEl.style.left = Math.max(8, Math.min(r.left - lr.left, lr.width - 300)) + "px";
      reagirEl.addEventListener("click", function (ev) { var b = ev.target.closest("[data-e]"); if (b) { Dados.reagir(empresaId, msgId, b.dataset.e, eu.uid); UI.vibrar(8); } fecharReagir(); });
      lista.style.position = "relative"; lista.appendChild(reagirEl);
      setTimeout(function () { document.addEventListener("mousedown", foraReagir); }, 0);
    }
    function foraReagir(ev) { if (reagirEl && !reagirEl.contains(ev.target)) fecharReagir(); }
    function fecharReagir() { if (reagirEl) { reagirEl.remove(); reagirEl = null; } document.removeEventListener("mousedown", foraReagir); }

    function receber(ms) {
      var novasDoOutro = ms.filter(function (m) { return m.autor.lado !== eu.lado; });
      var ultima = novasDoOutro[novasDoOutro.length - 1];
      if (ultima && ultimoIdOutro && ultima.id !== ultimoIdOutro && !primeira) { UI.som("recebido"); }
      if (ultima) ultimoIdOutro = ultima.id;
      mensagens = ms; desenhar();
      if (!document.hidden) Dados.marcarLidas(empresaId, eu.uid);
      if (opts.aoReceber) opts.aoReceber(ms);
    }
    parar = Dados.ouvirMensagens(empresaId, receber);

    caixa.addEventListener("input", function () { podeEnviar(); autoAltura(); });
    caixa.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey && !/Mobi|Android/i.test(navigator.userAgent)) { e.preventDefault(); enviar(); } });
    btnEnviar.addEventListener("click", enviar);
    compor.addEventListener("click", function (e) {
      var f = e.target.closest("[data-f]"); if (!f) return;
      if (f.dataset.f === "anexo") inputFile.click();
      if (f.dataset.f === "camera") inputCam.click();
      if (f.dataset.f === "emoji") {
        if (emojisEl) { emojisEl.remove(); emojisEl = null; return; }
        emojisEl = seletorEmojis(function (em) {
          var p = caixa.selectionStart || caixa.value.length;
          caixa.value = caixa.value.slice(0, p) + em + caixa.value.slice(p); caixa.focus(); caixa.setSelectionRange(p + em.length, p + em.length); podeEnviar();
        }, function () { if (emojisEl) { emojisEl.remove(); emojisEl = null; } });
        compor.appendChild(emojisEl);
      }
    });
    function anexar(files) {
      Array.prototype.forEach.call(files || [], function (f) {
        var erro = U.validarArquivo(f); if (erro) return UI.toast(erro, "erro");
        anexos.push({ file: f, nome: f.name, tamanho: f.size, mime: f.type });
      });
      desenharPend();
    }
    inputFile.addEventListener("change", function () { anexar(inputFile.files); inputFile.value = ""; });
    inputCam.addEventListener("change", function () { anexar(inputCam.files); inputCam.value = ""; });
    container.addEventListener("dragover", function (e) { e.preventDefault(); });
    container.addEventListener("drop", function (e) { e.preventDefault(); anexar(e.dataTransfer.files); });

    var enviando = false;
    function enviar() {
      var t = caixa.value.trim(); if ((!t && !anexos.length) || enviando) return;
      enviando = true; btnEnviar.disabled = true;
      Promise.all(anexos.map(function (a) { return Dados.guardarAnexo(empresaId, a.file); })).then(function (guardados) {
        return Dados.enviarMensagem(empresaId, { autor: { uid: eu.uid, nome: eu.nome, lado: eu.lado }, texto: t, anexos: guardados });
      }).then(function (m) {
        caixa.value = ""; anexos = []; desenharPend(); autoAltura(); UI.som("enviado"); UI.vibrar(12);
        if (!mensagens.some(function (x) { return x.id === m.id; })) { mensagens.push(m); desenhar(); }
        if (opts.aoEnviar) opts.aoEnviar(m);
      }).catch(function (e) { UI.toast(e.message || "Não foi possível enviar.", "erro"); }).then(function () { enviando = false; podeEnviar(); caixa.focus(); });
    }

    return {
      destruir: function () { if (parar) parar(); fecharReagir(); },
      mensagens: function () { return mensagens; },
      focar: function () { caixa.focus(); },
      inserir: function (t) { caixa.value = t; podeEnviar(); autoAltura(); caixa.focus(); }
    };
  }

  global.Chat = { montar: montar, CATEGORIAS: CATEGORIAS };
})(window);
