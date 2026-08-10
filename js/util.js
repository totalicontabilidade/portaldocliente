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
    zip:  ["application/zip", "application/x-zip-compressed", ""]
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
      return "Tipo de arquivo não aceito. Use PDF, imagem, planilha ou documento do Office.";
    }
    var permitidos = TIPOS[ext];
    var mime = (file.type || "").toLowerCase();
    if (permitidos.indexOf(mime) === -1) {
      return "O conteúdo do arquivo não corresponde à extensão \"." + ext + "\".";
    }
    if (typeof totalAtual === "number" && totalAtual + file.size > MAX_TOTAL) {
      return "Espaço esgotado neste dispositivo. Fale com a Totali para enviarmos o restante por outro canal.";
    }
    return null;
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

  global.U = {
    esc: esc,
    escAttr: escAttr,
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
    iconePorExtensao: iconePorExtensao,
    debounce: debounce,
    clamp: clamp,
    textoParaB64url: textoParaB64url,
    b64urlParaTexto: b64urlParaTexto,
    MAX_ARQUIVO: MAX_ARQUIVO,
    MAX_TOTAL: MAX_TOTAL,
    ACCEPT_ATTR: ACCEPT_ATTR
  };
})(window);
