/* ============================================================
   Totali · Portal de Onboarding
   firebase.js — conexão com o servidor

   Duas portas de entrada, bem diferentes:

     EQUIPE   e-mail e senha. Só entra quem tem documento em
              /usuarios/{uid}. Apagar o documento corta o acesso
              na hora, sem mexer na conta.

     CLIENTE  abre o link do convite UMA VEZ e cria a própria
              senha. Nesse momento o portal registra o acesso em
              /empresas/{id}/acessos/{uid}, anota a empresa em
              /clientes/{uid} e queima o convite. Depois disso
              ele entra com e-mail e senha, sem precisar do link.
              Link encaminhado ou vazado depois não dá acesso.

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

  /* Confere o convite sem gastar nada: serve para a tela de
     cadastro já mostrar de qual empresa é o link. */
  function lerConvite(codigo) {
    if (!db) return Promise.reject(new Error("sem-conexao"));
    var cod = String(codigo || "").trim();
    if (!/^[A-Za-z0-9]{10,40}$/.test(cod)) return Promise.reject(new Error("codigo-invalido"));

    return db.collection("convites").doc(cod).get().then(function (doc) {
      if (!doc.exists) throw new Error("convite-inexistente");
      var d = doc.data() || {};
      if (d.ativo !== true) throw new Error("convite-usado");
      if (!d.empresaId) throw new Error("convite-invalido");
      return { codigo: cod, empresaId: String(d.empresaId) };
    });
  }

  /* Cadastro do cliente: cria a conta com senha, registra o
     acesso à empresa e QUEIMA o convite. Feito uma vez só —
     depois ele entra por e-mail e senha, sem precisar do link. */
  function cadastrarCliente(codigo, email, senha) {
    if (!auth || !db) return Promise.reject(new Error("sem-conexao"));
    var convite = null, uid = "";

    return lerConvite(codigo)
      .then(function (c) {
        convite = c;
        return auth.createUserWithEmailAndPassword(String(email).trim(), String(senha));
      })
      .then(function (cred) {
        uid = cred.user.uid;
        return db.collection("empresas").doc(convite.empresaId)
                 .collection("acessos").doc(uid)
                 .set({ codigo: convite.codigo, em: agora() });
      })
      .then(function () {
        return db.collection("clientes").doc(uid).set({
          empresaId: convite.empresaId,
          email: String(email).trim(),
          em: agora()
        });
      })
      .then(function () {
        /* Convite queimado: link encaminhado ou vazado depois
           não serve para mais ninguém. Se falhar, o cadastro já
           está feito — não desfaz nada por causa disso. */
        return db.collection("convites").doc(convite.codigo).update({
          ativo: false, usadoPor: uid, usadoEm: agora()
        }).catch(function () { /* segue */ });
      })
      .then(function () {
        empresaAtual = convite.empresaId;
        return convite.empresaId;
      });
  }

  function entrarComoCliente(email, senha) {
    if (!auth || !db) return Promise.reject(new Error("sem-conexao"));
    return auth.signInWithEmailAndPassword(String(email).trim(), String(senha))
      .then(function (cred) { return descobrirEmpresa(cred.user.uid); });
  }

  /* Em que empresa este usuário entra. */
  function descobrirEmpresa(uid) {
    return db.collection("clientes").doc(uid).get().then(function (doc) {
      if (!doc.exists) throw new Error("sem-empresa");
      var id = String((doc.data() || {}).empresaId || "");
      if (!id) throw new Error("sem-empresa");
      empresaAtual = id;
      return id;
    });
  }

  function recuperarSenha(email) {
    if (!auth) return Promise.reject(new Error("sem-conexao"));
    return auth.sendPasswordResetEmail(String(email).trim());
  }

  /* Sessão de cliente já aberta neste aparelho. */
  function retomarCliente() {
    if (!auth || !db) return Promise.resolve("");
    var u = auth.currentUser;
    if (!u || u.isAnonymous) return Promise.resolve("");
    return descobrirEmpresa(u.uid).catch(function () { return ""; });
  }

  function agora() {
    return global.firebase.firestore.FieldValue.serverTimestamp();
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
    "convite-usado": "Este link já foi usado para criar um acesso. Entre com seu e-mail e senha, ou peça um novo link à Totali.",
    "sem-empresa": "Esta conta ainda não está ligada a nenhuma empresa. Abra o link de convite que a Totali enviou.",
    "auth/email-already-in-use": "Já existe uma conta com este e-mail. Entre com sua senha ou use \"Esqueci minha senha\".",
    "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
    "auth/missing-password": "Digite uma senha.",
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
    lerConvite: lerConvite,
    cadastrarCliente: cadastrarCliente,
    entrarComoCliente: entrarComoCliente,
    recuperarSenha: recuperarSenha,
    retomarCliente: retomarCliente,
    novoCodigo: novoCodigo,
    sair: sair,
    explicar: explicar,
    agora: agora
  };
})(window);
