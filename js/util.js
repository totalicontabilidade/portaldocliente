/* ============================================================
   Totali · Portal de Onboarding
   util.js — funções auxiliares puras (sem estado, sem DOM global)
   ============================================================ */
(function (global) {
  "use strict";

  /* ---------- Segurança: escape de HTML ----------
     Toda string que vier do usuário (nome de arquivo, nome do
     sócio, observação) DEVE passar por aqui antes de entrar em
     innerHTML. É a primeira barreira contra XSS.
  ------------------------------------------------- */
  var ESC_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;" };
  function esc(v) {
    if (v === null || v === undefined) return "";
    return String(v).replace(/[&<>"'`]/g, function (c) { return ESC_MAP[c]; });
  }
  /* Escape para uso dentro de atributo entre aspas duplas. */
  function escAttr(v) { return esc(v); }

  /* Texto de várias linhas vindo do painel, virando parágrafos.

     Escapa PRIMEIRO e só depois insere as tags — nesta ordem, e
     nunca na inversa. Linha que começa com "-" ou "1." vira item de
     lista, que é como a equipe costuma escrever passo a passo. */
  function paragrafos(v) {
    var linhas = String(v || "").split(/\r?\n/);
    var html = "", emLista = false;
    linhas.forEach(function (bruta) {
      var linha = bruta.trim();
      var item = /^(?:[-•*]|\d+[.)])\s+/.test(linha);
      if (item) {
        if (!emLista) { html += "<ol>"; emLista = true; }
        html += "<li>" + esc(linha.replace(/^(?:[-•*]|\d+[.)])\s+/, "")) + "</li>";
        return;
      }
      if (emLista) { html += "</ol>"; emLista = false; }
      if (linha) html += "<p>" + esc(linha) + "</p>";
    });
    if (emLista) html += "</ol>";
    return html;
  }

  /* ---------- Identificadores ---------- */
  function uid() {
    if (global.crypto && global.crypto.randomUUID) return global.crypto.randomUUID();
    var b = new Uint8Array(16);
    (global.crypto || global.msCrypto).getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    var h = [];
    for (var i = 0; i < 16; i++) h.push((b[i] + 0x100).toString(16).slice(1));
    return h.slice(0, 4).join("") + "-" + h.slice(4, 6).join("") + "-" +
           h.slice(6, 8).join("") + "-" + h.slice(8, 10).join("") + "-" + h.slice(10).join("");
  }

  /* ---------- Formatação ---------- */
  function bytes(n) {
    if (!n && n !== 0) return "";
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(0) + " KB";
    return (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + " MB";
  }

  function dataHora(ts) {
    if (!ts) return "";
    var d = new Date(ts);
    if (isNaN(d.getTime())) return "";
    var p = function (x) { return (x < 10 ? "0" : "") + x; };
    return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear() +
           " às " + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  function dataCurta(ts) {
    if (!ts) return "";
    var d = new Date(ts);
    if (isNaN(d.getTime())) return "";
    var p = function (x) { return (x < 10 ? "0" : "") + x; };
    return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear();
  }

  function saudacao() {
    var h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  }

  function primeiroNome(nome) {
    if (!nome) return "";
    return String(nome).trim().split(/\s+/)[0];
  }

  function plural(n, sing, plur) { return n === 1 ? sing : plur; }

  /* ---------- Máscaras ---------- */
  function soDigitos(v) { return String(v || "").replace(/\D+/g, ""); }

  function mascaraCNPJ(v) {
    var d = soDigitos(v).slice(0, 14);
    return d
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }

  function mascaraCPF(v) {
    var d = soDigitos(v).slice(0, 11);
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
  }

  function mascaraTelefone(v) {
    var d = soDigitos(v).slice(0, 11);
    if (d.length <= 10) return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
    return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
  }

  function mascaraPIS(v) {
    var d = soDigitos(v).slice(0, 11);
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{5})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{2})(\d)$/, ".$1-$2");
  }

  /* ---------- Validações ---------- */
  function validaCPF(v) {
    var c = soDigitos(v);
    if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
    var s = 0, i, r;
    for (i = 0; i < 9; i++) s += parseInt(c[i], 10) * (10 - i);
    r = (s * 10) % 11; if (r === 10) r = 0;
    if (r !== parseInt(c[9], 10)) return false;
    s = 0;
    for (i = 0; i < 10; i++) s += parseInt(c[i], 10) * (11 - i);
    r = (s * 10) % 11; if (r === 10) r = 0;
    return r === parseInt(c[10], 10);
  }

  function validaCNPJ(v) {
    var c = soDigitos(v);
    if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
    var calc = function (base) {
      var pesos = base.length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      var s = 0;
      for (var i = 0; i < base.length; i++) s += parseInt(base[i], 10) * pesos[i];
      var r = s % 11;
      return r < 2 ? 0 : 11 - r;
    };
    return calc(c.slice(0, 12)) === parseInt(c[12], 10) &&
           calc(c.slice(0, 13)) === parseInt(c[13], 10);
  }

  function validaEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(v || "").trim());
  }

  /* ---------- Arquivos: política de aceite ----------
     Allowlist explícita. Nada fora desta lista é aceito, nem por
     extensão nem por tipo MIME.
  ------------------------------------------------- */
  var MAX_ARQUIVO = 20 * 1024 * 1024;      /* 20 MB por arquivo   */
  var MAX_TOTAL   = 300 * 1024 * 1024;     /* 300 MB por empresa  */

  var TIPOS = {
    pdf:  ["application/pdf"],
    jpg:  ["image/jpeg"],
    jpeg: ["image/jpeg"],
    png:  ["image/png"],
    webp: ["image/webp"],
    heic: ["image/heic", "image/heif", ""],
    xml:  ["text/xml", "application/xml", ""],
    txt:  ["text/plain", ""],
    csv:  ["text/csv", "application/vnd.ms-excel", ""],
    doc:  ["application/msword"],
    docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    xls:  ["application/vnd.ms-excel"],
    xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    zip:  ["application/zip", "application/x-zip-compressed", ""],
    /* Áudio — usado nas mensagens (gravação de voz e anexo). */
    mp3:  ["audio/mpeg", "audio/mp3"],
    m4a:  ["audio/mp4", "audio/x-m4a", "audio/m4a", ""],
    ogg:  ["audio/ogg", "video/ogg", ""],
    oga:  ["audio/ogg", ""],
    opus: ["audio/opus", "audio/ogg", ""],
    wav:  ["audio/wav", "audio/x-wav", "audio/wave", ""],
    weba: ["audio/webm", ""],
    amr:  ["audio/amr", ""]
  };
  var EXTENSOES = Object.keys(TIPOS);
  var ACCEPT_ATTR = EXTENSOES.map(function (e) { return "." + e; }).join(",");

  function extensao(nome) {
    var m = String(nome || "").toLowerCase().match(/\.([a-z0-9]{1,5})$/);
    return m ? m[1] : "";
  }

  /* Sanitiza o nome do arquivo para exibição e para uso como chave.
     Remove caminho, caracteres de controle e sequências perigosas. */
  function nomeSeguro(nome) {
    var n = String(nome || "arquivo");
    n = n.split(/[\\/]/).pop();                 /* tira caminho          */
    n = n.replace(/[\x00-\x1f\x7f]/g, "");       /* caracteres de controle */
    n = n.replace(/[<>:"|?*]/g, "-");            /* inválidos no Windows  */
    n = n.replace(/^\.+/, "");                   /* nomes iniciando com . */
    n = n.trim();
    if (!n) n = "arquivo";
    if (n.length > 120) {
      var ext = extensao(n);
      n = n.slice(0, 110) + (ext ? "." + ext : "");
    }
    return n;
  }

  /* Retorna null se OK, ou a mensagem de erro. */
  function validaArquivo(file, totalAtual) {
    if (!file) return "Arquivo inválido.";
    if (file.size === 0) return "O arquivo está vazio.";
    if (file.size > MAX_ARQUIVO) {
      return "Arquivo muito grande (" + bytes(file.size) + "). O limite é " + bytes(MAX_ARQUIVO) + ".";
    }
    var ext = extensao(file.name);
    if (!ext || EXTENSOES.indexOf(ext) === -1) {
      return "Tipo de arquivo não aceito. Use PDF, imagem, áudio, planilha ou documento do Office.";
    }
    var permitidos = TIPOS[ext];
    var mime = (file.type || "").toLowerCase();
    if (permitidos.indexOf(mime) === -1) {
      return "O conteúdo do arquivo não corresponde à extensão \"." + ext + "\".";
    }
    if (typeof totalAtual === "number" && totalAtual + file.size > MAX_TOTAL) {
      return "Limite de espaço atingido. Fale com a Totali para enviarmos o restante por outro canal.";
    }
    return null;
  }

  /* Tipo declarado no envio para o servidor.

     O celular às vezes entrega o arquivo sem dizer o que é —
     acontece muito com HEIC do iPhone, XML de nota fiscal e áudio
     de WhatsApp. O servidor recusa o que não sabe identificar,
     então deduzimos pela extensão, que já passou pela allowlist
     acima. Nunca inventamos um tipo fora da lista. */
  var MIME_PADRAO = {
    pdf: "application/pdf",
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
    heic: "image/heic", heif: "image/heif",
    xml: "text/xml", txt: "text/plain", csv: "text/csv",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    zip: "application/zip",
    mp3: "audio/mpeg", m4a: "audio/mp4", ogg: "audio/ogg", oga: "audio/ogg",
    opus: "audio/ogg", wav: "audio/wav", weba: "audio/webm", amr: "audio/amr"
  };
  var MIME_ACEITOS = {};
  Object.keys(MIME_PADRAO).forEach(function (k) { MIME_ACEITOS[MIME_PADRAO[k]] = true; });

  function mimeDoArquivo(arquivo) {
    var declarado = String((arquivo && arquivo.type) || "").toLowerCase();
    if (MIME_ACEITOS[declarado]) return declarado;
    var porExtensao = MIME_PADRAO[extensao(arquivo && arquivo.name)];
    return porExtensao || declarado || "application/pdf";
  }

  function iconePorExtensao(ext) {
    if (["jpg", "jpeg", "png", "webp", "heic"].indexOf(ext) > -1) return "ic-image";
    if (["xls", "xlsx", "csv"].indexOf(ext) > -1) return "ic-sheet";
    return "ic-file";
  }

  /* ---------- Diversos ---------- */
  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms || 250);
    };
  }

  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

  /* ---------- Base64 seguro para URL ----------
     Usado no link de convite que a equipe gera. Passa por
     TextEncoder/TextDecoder para não quebrar com acento.
  ------------------------------------------------- */
  function textoParaB64url(texto) {
    var bytes = new TextEncoder().encode(String(texto));
    var bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function b64urlParaTexto(s) {
    var b = String(s || "").replace(/-/g, "+").replace(/_/g, "/");
    while (b.length % 4) b += "=";
    var bin = atob(b);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  /* Nome de instituição virando id de documento: "Banco do Brasil"
     vira "banco-do-brasil". Serve de chave da confirmação de cada
     banco, e por isso precisa dar o MESMO resultado no painel e na
     página do cliente — os dois chamam daqui.

     Barra é o que o Firestore não aceita em id, mas a limpeza vai
     além dela de propósito: acento e espaço em id de documento é
     dor de cabeça na hora de depurar. */
  function slug(nome) {
    return String(nome || "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "item";
  }

  /* ------------------------------------------------------------
     CNPJ da página de liberação de extratos

     A página `extratos.html` abre sem login e confere o CNPJ que o
     cliente digita. O número não fica guardado: o que viaja no
     documento é este resumo.

     SEJA HONESTO SOBRE O QUE ISTO É. CNPJ tem quatorze dígitos e o
     sal está no código aberto — quem quiser reverter o resumo,
     reverte, e em segundos. Isto não protege o documento de um
     atacante: protege de link encaminhado por engano no grupo da
     empresa, que é o caso real, e evita guardar mais um cadastro
     de cliente numa coleção que qualquer um lê sabendo o código.
     Quem protege de verdade é o código de 22 caracteres do
     endereço.

     As duas pontas — o painel que grava e a página que confere —
     chamam esta mesma função. Duas implementações do mesmo resumo
     é o tipo de coisa que só se descobre quebrada em produção.
     ------------------------------------------------------------ */
  var SAL_CNPJ = "totali.extratos.v1:";

  function hashCNPJ(valor) {
    var digitos = soDigitos(valor);
    if (digitos.length !== 14) return Promise.resolve("");
    /* `crypto.subtle` só existe em https e em localhost. Sem ele
       não há como conferir, e a página trata isso como "não dá
       para abrir aqui" em vez de deixar passar sem conferência. */
    if (!global.crypto || !global.crypto.subtle) {
      return Promise.reject(new Error("sem-crypto"));
    }
    var entrada = new TextEncoder().encode(SAL_CNPJ + digitos);
    return global.crypto.subtle.digest("SHA-256", entrada).then(function (buf) {
      var b = new Uint8Array(buf), hex = "";
      for (var i = 0; i < b.length; i++) hex += ("0" + b[i].toString(16)).slice(-2);
      return hex;
    });
  }

  /* ------------------------------------------------------------
     Endereço de conexão do Ottimizza

     Escrito pela equipe, no painel, e aberto pelo cliente numa aba
     nova — os dois lados chamam isto antes. Conta de equipe pode
     ser comprometida, e campo de texto que vira `href` sem
     conferência é por onde `javascript:` entra numa página nossa.

     Domínio fechado no código: se a Ottimizza mudar de endereço, é
     uma linha aqui — e é bom que seja uma decisão, não um campo
     que alguém preenche sem pensar.
     ------------------------------------------------------------ */
  function linkOttimizza(valor) {
    var v = String(valor || "").trim();
    if (!v) return "";
    var u;
    try { u = new URL(v); } catch (e) { return ""; }
    if (u.protocol !== "https:") return "";
    if (u.hostname !== "ottimizza.com.br" && !/\.ottimizza\.com\.br$/.test(u.hostname)) return "";
    return u.href;
  }

  /* ------------------------------------------------------------
     Carregar biblioteca só na hora de usar

     O jsPDF tem 357 KB — é o maior arquivo do projeto, maior que
     todo o Firestore SDK. Ele estava sendo baixado no começo das
     DUAS páginas, antes de a tela de entrada aparecer, para uma
     coisa que só acontece quando alguém pede um PDF. Era o
     principal motivo de o portal demorar a abrir na primeira
     visita, ainda mais em celular na rua.

     Só do mesmo domínio: a CSP tem `script-src 'self'` e recusaria
     endereço de fora de qualquer jeito, mas quem escrever aqui
     depois merece ler isso antes de tentar.
     ------------------------------------------------------------ */
  var scriptsPedidos = {};

  function carregarScript(src) {
    if (scriptsPedidos[src]) return scriptsPedidos[src];

    scriptsPedidos[src] = new Promise(function (ok, falhou) {
      if (/^[a-z]+:/i.test(src) || src.charAt(0) === "/") {
        falhou(new Error("só carrega script do próprio site"));
        return;
      }
      var el = document.createElement("script");
      el.src = src;
      el.async = true;
      el.onload = function () { ok(); };
      el.onerror = function () {
        /* Deixa tentar de novo: sem isso, uma falha de rede
           passageira condenaria a função para sempre nesta aba. */
        delete scriptsPedidos[src];
        falhou(new Error("não foi possível carregar " + src));
      };
      document.head.appendChild(el);
    });

    return scriptsPedidos[src];
  }

  global.U = {
    esc: esc,
    escAttr: escAttr,
    paragrafos: paragrafos,
    uid: uid,
    bytes: bytes,
    dataHora: dataHora,
    dataCurta: dataCurta,
    saudacao: saudacao,
    primeiroNome: primeiroNome,
    plural: plural,
    soDigitos: soDigitos,
    mascaraCNPJ: mascaraCNPJ,
    mascaraCPF: mascaraCPF,
    mascaraTelefone: mascaraTelefone,
    mascaraPIS: mascaraPIS,
    validaCPF: validaCPF,
    validaCNPJ: validaCNPJ,
    validaEmail: validaEmail,
    validaArquivo: validaArquivo,
    nomeSeguro: nomeSeguro,
    extensao: extensao,
    mimeDoArquivo: mimeDoArquivo,
    iconePorExtensao: iconePorExtensao,
    debounce: debounce,
    clamp: clamp,
    textoParaB64url: textoParaB64url,
    b64urlParaTexto: b64urlParaTexto,
    slug: slug,
    hashCNPJ: hashCNPJ,
    linkOttimizza: linkOttimizza,
    MAX_ARQUIVO: MAX_ARQUIVO,
    MAX_TOTAL: MAX_TOTAL,
    ACCEPT_ATTR: ACCEPT_ATTR,
    carregarScript: carregarScript
  };
})(window);
