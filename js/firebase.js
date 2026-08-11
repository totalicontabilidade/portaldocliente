/* ============================================================
   Totali · Portal de Onboarding
   firebase.js — conexão com o servidor

   Duas portas de entrada, bem diferentes:

     EQUIPE   e-mail e senha. Só entra quem tem documento em
              /usuarios/{uid}. Apagar o documento corta o acesso
              na hora, sem mexer na conta.

     CLIENTE  sem cadastro e sem senha. Ele abre o link com o
              código do convite, o navegador cria uma conta
              anônima e registra o próprio identificador em
              /empresas/{id}/acessos/{uid}. A regra do banco só
              aceita esse registro se o código conferir.

   O portal continua funcionando sem servidor: se o Firebase não
   estiver configurado ou estiver fora do ar, tudo cai para o
   armazenamento local, como antes. Nada trava.
   ============================================================ */
(function (global) {
  "use strict";

  var app = null, auth = null, db = null, storage = null;
  var erroInicial = "";
  var equipeAtual = null;      /* {uid, nome, email, papel} */
  var empresaAtual = "";       /* id da empresa do cliente     */

  function temSDK() {
    return typeof global.firebase !== "undefined" &&
           typeof global.firebase.initializeApp === "function";
  }

  function configurado() {
    var c = global.FIREBASE_CONFIG;
    return !!(c && c.apiKey && c.projectId && c.apiKey.indexOf("COLE_") !== 0);
  }

  /* ---------- Início ---------- */
  var pronto = (function () {
    if (!temSDK()) {
      erroInicial = "biblioteca-ausente";
      return Promise.resolve(false);
    }
    if (!configurado()) {
      erroInicial = "nao-configurado";
      return Promise.resolve(false);
    }
    try {
      app = global.firebase.initializeApp(global.FIREBASE_CONFIG);
      auth = global.firebase.auth();
      db = global.firebase.firestore();
      if (global.firebase.storage) storage = global.firebase.storage();
    } catch (e) {
      erroInicial = "falha-init";
      return Promise.resolve(false);
    }

    /* Guarda os dados no aparelho para o portal abrir offline e
       para o cliente não perder o que digitou sem sinal. */
    return db.enablePersistence({ synchronizeTabs: true })
      .catch(function () { /* aba duplicada ou navegador sem suporte: segue online */ })
      .then(function () { return true; });
  })();

  /* ---------- Estado da sessão ---------- */
  function observarSessao(aoMudar) {
    if (!auth) return function () {};
    return auth.onAuthStateChanged(function (u) {
      if (!u || u.isAnonymous) { equipeAtual = null; aoMudar(null); return; }
      db.collection("usuarios").doc(u.uid).get().then(function (doc) {
        if (!doc.exists) {
          /* Conta existe mas não é da equipe: derruba. */
          equipeAtual = null;
          auth.signOut();
          aoMudar(null);
          return;
        }
        var d = doc.data() || {};
        equipeAtual = {
          uid: u.uid,
          email: u.email || d.email || "",
          nome: d.nome || "",
          papel: d.papel === "admin" ? "admin" : "equipe"
        };
        aoMudar(equipeAtual);
      }, function () {
        equipeAtual = null;
        aoMudar(null);
      });
    });
  }

  /* ---------- Equipe ---------- */
  function entrarComoEquipe(email, senha) {
    if (!auth) return Promise.reject(new Error("sem-conexao"));
    return auth.signInWithEmailAndPassword(String(email).trim(), String(senha))
      .then(function (cred) {
        return db.collection("usuarios").doc(cred.user.uid).get();
      })
      .then(function (doc) {
        if (!doc.exists) {
          return auth.signOut().then(function () {
            throw new Error("sem-permissao");
          });
        }
        return true;
      });
  }

  function sair() {
    equipeAtual = null;
    empresaAtual = "";
    return auth ? auth.signOut() : Promise.resolve();
  }

  /* ---------- Cliente ---------- */

  /* Código do convite: 22 caracteres sorteados, sem os que se
     confundem ao ditar. Dá cerca de 110 bits — não se adivinha. */
  function novoCodigo() {
    var ALFA = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    var b = new Uint8Array(22);
    global.crypto.getRandomValues(b);
    var s = "";
    for (var i = 0; i < b.length; i++) s += ALFA[b[i] % ALFA.length];
    return s;
  }

  /* Abre o convite: entra como anônimo e registra o acesso.
     Chamar de novo é inofensivo — se o registro já existe, só
     confirma. É isso que permite ao cliente trocar de celular
     ou limpar o navegador e voltar pelo mesmo link. */
  function entrarComoCliente(codigo) {
    if (!auth || !db) return Promise.reject(new Error("sem-conexao"));
    var cod = String(codigo || "").trim();
    if (!/^[A-Za-z0-9]{10,40}$/.test(cod)) return Promise.reject(new Error("codigo-invalido"));

    var empresaId = "";
    return db.collection("convites").doc(cod).get()
      .then(function (doc) {
        if (!doc.exists) throw new Error("convite-inexistente");
        var d = doc.data() || {};
        if (d.ativo !== true) throw new Error("convite-inativo");
        empresaId = String(d.empresaId || "");
        if (!empresaId) throw new Error("convite-invalido");
        return auth.currentUser ? auth.currentUser : auth.signInAnonymously().then(function (c) { return c.user; });
      })
      .then(function (u) {
        var ref = db.collection("empresas").doc(empresaId).collection("acessos").doc(u.uid);
        return ref.get().then(function (jaTem) {
          if (jaTem.exists) return true;
          return ref.set({
            codigo: cod,
            em: global.firebase.firestore.FieldValue.serverTimestamp()
          });
        });
      })
      .then(function () {
        empresaAtual = empresaId;
        return empresaId;
      });
  }

  /* Reconecta uma sessão de cliente já existente, sem código. */
  function retomarCliente(empresaId) {
    if (!auth || !db || !empresaId) return Promise.resolve("");
    var u = auth.currentUser;
    if (!u) return Promise.resolve("");
    return db.collection("empresas").doc(empresaId).collection("acessos").doc(u.uid).get()
      .then(function (doc) {
        if (!doc.exists) return "";
        empresaAtual = empresaId;
        return empresaId;
      }, function () { return ""; });
  }

  /* ---------- Mensagens de erro em português ---------- */
  var TEXTOS = {
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/wrong-password": "E-mail ou senha incorretos.",
    "auth/user-not-found": "E-mail ou senha incorretos.",
    "auth/invalid-email": "E-mail inválido.",
    "auth/too-many-requests": "Muitas tentativas. Espere alguns minutos e tente de novo.",
    "auth/network-request-failed": "Sem conexão com a internet.",
    "auth/user-disabled": "Esta conta foi desativada.",
    "sem-permissao": "Esta conta não tem acesso ao painel. Fale com o administrador.",
    "sem-conexao": "Sem conexão com o servidor.",
    "convite-inexistente": "Este link não é válido. Peça um novo à Totali.",
    "convite-inativo": "Este link foi desativado. Peça um novo à Totali.",
    "convite-invalido": "Este link está incompleto. Peça um novo à Totali.",
    "codigo-invalido": "Este link não é válido. Peça um novo à Totali.",
    "permission-denied": "Sem permissão para esta ação."
  };

  function explicar(erro) {
    if (!erro) return "Algo deu errado. Tente de novo.";
    var chave = erro.code || erro.message || "";
    return TEXTOS[chave] || "Algo deu errado. Tente de novo.";
  }

  global.FB = {
    pronto: pronto,
    get ligado() { return !!db; },
    get erro() { return erroInicial; },
    get db() { return db; },
    get storage() { return storage; },
    get auth() { return auth; },
    get equipe() { return equipeAtual; },
    get empresaId() { return empresaAtual; },
    observarSessao: observarSessao,
    entrarComoEquipe: entrarComoEquipe,
    entrarComoCliente: entrarComoCliente,
    retomarCliente: retomarCliente,
    novoCodigo: novoCodigo,
    sair: sair,
    explicar: explicar,
    agora: function () {
      return global.firebase.firestore.FieldValue.serverTimestamp();
    }
  };
})(window);
