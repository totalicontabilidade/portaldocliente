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

      /* App Check ANTES de auth e firestore: ele precisa estar de
         pé para que as chamadas seguintes já saiam com o token.
         Ligado depois, as primeiras chamadas saem sem token — e
         no dia em que a verificação for exigida, essas primeiras
         seriam recusadas.

         Envolvido em try próprio: falha de App Check não pode
         derrubar o portal. Enquanto a verificação estiver em
         modo monitoramento, tudo funciona sem ele. */
      if (global.APP_CHECK_SITE_KEY && global.firebase.appCheck) {
        try {
          global.firebase.appCheck().activate(global.APP_CHECK_SITE_KEY, true);
        } catch (eAC) { /* segue sem App Check */ }
      }

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

  /* ---------- Estado da sessão ----------

     ATENÇÃO AO QUE ESTA FUNÇÃO NÃO FAZ MAIS: ela não desloga
     ninguém.

     Antes, ao ver uma conta sem documento em /usuarios, ela
     chamava `auth.signOut()` — "não é da equipe, derruba". Parecia
     defesa e era um tiro no próprio pé, porque **a sessão do
     Firebase é compartilhada entre todas as abas do mesmo
     endereço**. Ou seja: com o painel aberto numa aba, todo
     cliente que entrasse no portal na outra aba era deslogado
     pelo painel, no meio do login. O sintoma que aparecia era
     "não conseguimos consultar a sua empresa agora" — porque as
     leituras seguintes chegavam ao servidor sem credencial
     nenhuma.

     E é exatamente assim que a equipe trabalha: painel numa aba,
     portal do cliente na outra, para conferir o que o cliente vê.

     Deslogar aqui também nunca foi a barreira de segurança. Quem
     impede um não-membro de ler o painel são as regras do
     Firestore (`ehEquipe()`), não esta linha. O observador só
     precisa RELATAR que não é da equipe — o painel, ao receber
     null, já mostra a tela de login.

     A recusa com signOut continua onde faz sentido: em
     `entrarComoEquipe`, onde foi o próprio painel que iniciou o
     login e portanto é dono daquela sessão. */
  /* Quem é este uid na equipe.

     TRÊS RESPOSTAS, NÃO DUAS — e foi confundir duas delas que
     causou o "coloco a senha e não entra, só entra atualizando a
     página":

       {estado:"equipe",   quem}  é da equipe
       {estado:"de-fora"}         logado, mas não é da equipe
       {estado:"falhou"}          não deu para saber agora

     A leitura de /usuarios logo depois do login chega ao servidor
     antes de o token novo valer, e a regra nega. Isso é FALHA
     TEMPORÁRIA, não "não é da equipe" — mas as duas devolviam
     null, e null manda mostrar a tela de login. Por isso o
     segundo acesso funcionava: aí a credencial já estava pronta.

     É o mesmo defeito que o portal do cliente teve, corrigido do
     mesmo jeito. O painel não tinha recebido a correção. */
  function lerMembro(uid, restam) {
    return db.collection("usuarios").doc(uid).get().then(function (doc) {
      if (!doc.exists) return { estado: "de-fora" };
      var d = doc.data() || {};
      return {
        estado: "equipe",
        quem: {
          uid: uid,
          email: d.email || "",
          nome: d.nome || "",
          papel: d.papel === "admin" ? "admin" : "equipe",
          /* Departamentos de que a pessoa cuida. Lista VAZIA quer
             dizer "cuida de todos" — é o que mantém funcionando
             quem já estava cadastrado antes desta ideia existir, e
             é também o padrão certo para um escritório pequeno,
             onde a mesma pessoa costuma cobrir tudo. */
          departamentos: (Array.isArray(d.departamentos) ? d.departamentos : [])
            .filter(function (x) { return typeof x === "string" && x; })
            .slice(0, 20)
        }
      };
    }, function () {
      if (restam <= 0) return { estado: "falhou" };
      /* Renovar o token antes de insistir: repetir com o mesmo
         token velho dá o mesmo "negado" três vezes seguidas. */
      return aguardarCredencial()
        .then(function () { return esperar(ESPERA_ENTRE_TENTATIVAS); })
        .then(function () { return lerMembro(uid, restam - 1); });
    });
  }

  function observarSessao(aoMudar) {
    if (!auth) return function () {};
    return auth.onAuthStateChanged(function (u) {
      if (!u || u.isAnonymous) { equipeAtual = null; aoMudar(null); return; }

      lerMembro(u.uid, TENTATIVAS_INDICE).then(function (r) {
        if (r.estado === "equipe") {
          r.quem.email = u.email || r.quem.email;
          equipeAtual = r.quem;
          aoMudar(equipeAtual);
          return;
        }

        if (r.estado === "de-fora") {
          /* Conta logada que não é da equipe — provavelmente um
             cliente com o portal aberto noutra aba. Não é da
             conta do painel mexer nessa sessão. */
          equipeAtual = null;
          aoMudar(null);
          return;
        }

        /* Não deu para saber. Mandar null aqui jogaria a pessoa
           de volta para a tela de login no meio do trabalho, por
           uma oscilação de rede. Mantemos o que já se sabia e
           avisamos por cima. */
        if (equipeAtual) {
          aoMudar(equipeAtual);
          if (global.UI && global.UI.toast) {
            global.UI.toast("Sem conexão com o servidor agora. O painel continua aberto — " +
                            "evite aprovar nada até voltar.", "erro", 9000);
          }
          return;
        }
        aoMudar(null);
      });
    });
  }

  /* ---------- Equipe ----------

     `aguardarCredencial()` ANTES de ler /usuarios, e não depois:
     a senha acabou de ser aceita, mas o token que o Firestore usa
     pode ser ainda o anterior. Ler nesse instante volta "negado",
     e a versão antiga tratava isso como "não é da equipe" — o que
     além de barrar quem tinha direito, ainda chamava signOut().

     E é por isso que a falha de leitura NÃO desloga mais. Deslogar
     só continua onde a resposta é certa: o documento existe e diz
     que a pessoa não é da equipe. */
  function entrarComoEquipe(email, senha) {
    if (!auth) return Promise.reject(new Error("sem-conexao"));
    return auth.signInWithEmailAndPassword(String(email).trim(), String(senha))
      .then(function (cred) {
        return aguardarCredencial().then(function () {
          return lerMembro(cred.user.uid, TENTATIVAS_INDICE);
        });
      })
      .then(function (r) {
        if (r.estado === "equipe") return true;
        if (r.estado === "de-fora") {
          return auth.signOut().then(function () {
            throw new Error("sem-permissao");
          });
        }
        /* Não deu para confirmar. A sessão fica de pé: o
           observador tenta de novo sozinho e, se conseguir, o
           painel abre sem pedir a senha outra vez. */
        throw new Error("equipe-leitura-falhou");
      });
  }

  function sair() {
    equipeAtual = null;
    empresaAtual = "";
    return auth ? auth.signOut() : Promise.resolve();
  }

  /* Cria a conta de um novo membro da equipe SEM derrubar a
     sessão de quem está criando.

     O SDK do Firebase entra automaticamente com a conta recém
     criada — quem clicasse em "adicionar membro" seria expulso e
     acordaria logado como a pessoa nova. Por isso a conta nasce
     numa segunda conexão com o mesmo projeto, que tem sessão
     própria e é encerrada em seguida.

     Criar conta aqui não dá poder nenhum: qualquer pessoa na
     internet pode criar conta neste projeto, porque o cadastro
     por e-mail e senha está ligado. Quem manda é o documento em
     /usuarios/{uid}, e esse só admin escreve. */
  function criarContaEquipe(email, senha) {
    if (!auth || !global.firebase) return Promise.reject(new Error("sem-conexao"));
    var secundario;
    try {
      secundario = global.firebase.app("secundario");
    } catch (e) {
      secundario = global.firebase.initializeApp(global.FIREBASE_CONFIG, "secundario");
    }
    var authSec = secundario.auth();
    return authSec.createUserWithEmailAndPassword(String(email).trim(), String(senha))
      .then(function (cred) {
        var uid = cred.user.uid;
        return authSec.signOut().then(function () { return uid; },
                                      function () { return uid; });
      });
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
  /* Cria a conta — ou entra nela, se já existir.

     Um cadastro pode parar no meio: a conta nasce, e o registro
     do acesso não chega a ser gravado por queda de rede. Da
     segunda vez, o e-mail "já está em uso" e a pessoa fica presa
     sem ter feito nada errado. Então tentamos entrar com a mesma
     senha e concluir o que faltou. Senha diferente continua
     sendo recusada — isso aqui não é atalho para invadir conta
     alheia: sem a senha certa, nada avança. */
  function criarOuEntrar(email, senha) {
    var e = String(email).trim(), s = String(senha);
    return auth.createUserWithEmailAndPassword(e, s).then(
      function (cred) { return cred.user; },
      function (erro) {
        if (!erro || erro.code !== "auth/email-already-in-use") throw erro;
        return auth.signInWithEmailAndPassword(e, s).then(
          function (cred) { return cred.user; },
          function () { throw new Error("senha-nao-confere"); }
        );
      }
    );
  }

  function cadastrarCliente(codigo, email, senha) {
    if (!auth || !db) return Promise.reject(new Error("sem-conexao"));
    var convite = null, uid = "";

    return lerConvite(codigo)
      .then(function (c) {
        convite = c;
        return criarOuEntrar(email, senha);
      })
      /* Registro de acesso e vínculo com a empresa não se
         reescrevem — a regra do servidor recusa. Numa segunda
         tentativa eles já podem existir; então conferimos antes
         de gravar, em vez de esbarrar num "sem permissão". */
      .then(function (usuario) {
        uid = usuario.uid;
        /* Mesma armadilha do login: sem esperar a credencial
           chegar ao Firestore, a primeira gravação do cadastro
           volta negada e o cliente recém-criado não consegue
           entrar na própria empresa. */
        return aguardarCredencial().then(function () {
          var ref = db.collection("empresas").doc(convite.empresaId)
                      .collection("acessos").doc(uid);
          return ref.get().then(function (doc) {
            if (doc.exists) return null;
            return ref.set({ codigo: convite.codigo, em: agora() });
          });
        });
      })
      .then(function () {
        var ref = db.collection("clientes").doc(uid);
        return ref.get().then(function (doc) {
          if (doc.exists) return null;
          return ref.set({
            empresaId: convite.empresaId,
            email: String(email).trim(),
            em: agora()
          });
        });
      })
      .then(function () {
        /* Índice das empresas deste login. É o que permite a
           mesma pessoa cuidar de mais de um CNPJ: o campo acima
           guarda só o primeiro e não pode ser alterado.
           Se a regra ainda não tiver sido republicada, segue sem
           ela — o portal cai para uma empresa só. */
        return db.collection("clientes").doc(uid)
                 .collection("empresas").doc(convite.empresaId)
                 .set({ em: agora() })
                 .catch(function () { /* segue com o modo antigo */ });
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

  /* ============================================================
     Esperar a credencial chegar ao Firestore

     Entrar na conta e ler o banco são duas coisas diferentes, e a
     segunda não acontece só porque a primeira deu certo. O
     Authentication devolve o login pronto, mas o cliente do
     Firestore continua usando a credencial que tinha antes — e
     todas as leituras voltam NEGADAS. Medido em teste: mais de
     dez segundos seguidos de `permission-denied` logo depois de um
     login bem-sucedido, com o uid certo e a regra certa.

     Pedir o token com `true` força a renovação e, de quebra, faz o
     Firestore adotar a credencial nova. Na medição, a leitura que
     vinha falhando havia dez segundos passou na tentativa
     seguinte.

     Custa uma ida à rede, uma vez por login. É barato perto de
     dizer ao cliente que a empresa dele não existe.
     ============================================================ */
  function aguardarCredencial() {
    var u = auth && auth.currentUser;
    if (!u) return Promise.resolve();
    return u.getIdToken(true).then(function () {}, function () { /* segue mesmo assim */ });
  }

  function entrarComoCliente(email, senha) {
    if (!auth || !db) return Promise.reject(new Error("sem-conexao"));
    return auth.signInWithEmailAndPassword(String(email).trim(), String(senha))
      .then(function (cred) {
        return aguardarCredencial().then(function () {
          return descobrirEmpresa(cred.user.uid);
        });
      });
  }

  /* ============================================================
     De quais empresas este login cuida

     Quase sempre é uma. Mas o mesmo dono costuma ter dois ou três
     CNPJs, e faz pouco sentido obrigá-lo a um e-mail por empresa.

     A lista vive em `clientes/{uid}/empresas`. Quem autoriza
     continua sendo o documento de acesso dentro de cada empresa —
     esta lista é só o índice que permite ao portal DESCOBRIR as
     empresas, já que não dá para varrer o banco.

     Tolera o mundo antigo de propósito: se a subcoleção não
     existir (ou a regra ainda não tiver sido republicada), cai
     para o campo único de sempre e segue funcionando. Quando der
     certo, ela se conserta sozinha no login seguinte.
     ============================================================ */
  /* NÃO CONFUNDIR "não achei" COM "não consegui ler".

     Este era um bug de verdade, reproduzido em teste: quem saía da
     conta e entrava de novo às vezes recebia "esta conta ainda não
     está ligada a nenhuma empresa" — a mensagem mais assustadora
     possível, e falsa: a empresa estava lá, intacta.

     A causa é uma corrida. O login resolve, o portal lê o índice no
     instante seguinte, e o Firestore ainda pode estar operando com
     a sessão ANTERIOR (a que acabou de sair). A leitura volta
     negada. Como o código antigo transformava qualquer falha em
     lista vazia, "negado" virava "não tem empresa".

     Agora as duas leituras dizem se FALHARAM, e falha ganha nova
     tentativa. Lista vazia só é aceita quando as duas leituras
     deram certo e realmente não acharam nada. Se insistir e
     continuar falhando, o erro é outro — e o texto na tela também.

     Cada função devolve {ids, falhou}. */
  function esperar(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  /* VAZIO DE VERDADE vs. VAZIO PORQUE NÃO DEU PARA PERGUNTAR

     Este é o caminho que fazia o portal "deslogar sozinho", e ele
     escapou de todas as correções anteriores porque elas só
     olhavam o caso de ERRO. Aqui não há erro nenhum.

     Com a persistência do Firestore ligada, uma leitura feita
     durante uma oscilação de rede é respondida PELO CACHE, com
     sucesso e sem nenhum documento. O código antigo lia isso como
     "esta conta não está ligada a empresa nenhuma", e conta sem
     empresa vai para a porta de entrada. Resultado: cliente com
     sessão perfeitamente válida caindo na tela de senha.

     `snap.metadata.fromCache` é o que separa as duas coisas. Só
     resposta vinda do SERVIDOR pode afirmar que está vazio; a do
     cache, quando não traz nada, não afirma nada. */
  function vazioConfiavel(snap) {
    var meta = snap && snap.metadata;
    /* Sem metadata (navegador antigo, ou objeto de teste): não dá
       para garantir, então trata como inconclusivo. */
    return !!meta && meta.fromCache === false;
  }

  function lerIndiceDeEmpresas(ref) {
    return ref.collection("empresas").get().then(function (snap) {
      var ids = [];
      snap.forEach(function (d) { ids.push(d.id); });
      if (ids.length) return { ids: ids, falhou: false };
      return { ids: [], falhou: !vazioConfiavel(snap) };
    }, function () {
      return { ids: [], falhou: true };
    });
  }

  /* Cliente de antes do multiempresa: um campo só, na raiz. */
  function lerCampoUnico(ref) {
    return ref.get().then(function (doc) {
      if (doc.exists) {
        var id = String((doc.data() || {}).empresaId || "");
        if (id) return { ids: [id], falhou: false };
      }
      return { ids: [], falhou: !vazioConfiavel(doc) };
    }, function () {
      return { ids: [], falhou: true };
    });
  }

  var TENTATIVAS_INDICE = 3;
  var ESPERA_ENTRE_TENTATIVAS = 350;

  function empresasDoCliente(uid) {
    if (!db) return Promise.reject(new Error("sem-conexao"));
    var ref = db.collection("clientes").doc(uid);

    function tentar(restam) {
      return lerIndiceDeEmpresas(ref).then(function (novo) {
        if (novo.ids.length) return novo.ids;

        return lerCampoUnico(ref).then(function (antigo) {
          if (antigo.ids.length) {
            /* Achou no formato velho: traz para o novo sem pedir
               nada ao cliente. Se a gravação falhar, tudo bem —
               ele entra do mesmo jeito e tenta de novo depois. */
            antigo.ids.forEach(function (id) {
              ref.collection("empresas").doc(id).set({ em: agora() }).catch(function () {});
            });
            return antigo.ids;
          }

          if (!novo.falhou && !antigo.falhou) return [];   /* vazio de verdade */
          if (restam > 0) {
            /* Renova a credencial antes de insistir: tentar de
               novo com o mesmo token velho daria o mesmo "negado"
               três vezes seguidas — foi o que aconteceu na
               primeira versão desta correção. */
            return aguardarCredencial()
              .then(function () { return esperar(ESPERA_ENTRE_TENTATIVAS); })
              .then(function () { return tentar(restam - 1); });
          }
          throw new Error("leitura-falhou");
        });
      });
    }

    return tentar(TENTATIVAS_INDICE);
  }

  /* Em que empresa este usuário entra. Continua devolvendo uma
     só — quem lida com a lista inteira é o portal. */
  function descobrirEmpresa(uid) {
    return empresasDoCliente(uid).then(function (ids) {
      if (!ids.length) throw new Error("sem-empresa");
      empresaAtual = ids[0];
      return ids[0];
    });
  }

  function recuperarSenha(email) {
    if (!auth) return Promise.reject(new Error("sem-conexao"));
    return auth.sendPasswordResetEmail(String(email).trim());
  }

  /* Sessão de cliente já aberta neste aparelho.

     ATENÇÃO AO QUE ESTA FUNÇÃO DEVOLVE, porque foi a causa de um
     bug feio: ela distingue **"não há sessão"** de **"há sessão,
     mas não consegui ler agora"**. Antes as duas coisas viravam
     string vazia, e quem chamava concluía "não está logado" e
     mostrava a tela de login — para alguém que estava logado.

     Era isso que o Raoni descrevia como "sou desconectado com
     frequência" e "faço login, não entra, atualizo e já está
     dentro": a sessão nunca caiu. O que falhou foi a PRIMEIRA
     leitura depois de abrir a página, enquanto o Firestore ainda
     não tinha adotado a credencial. Ao recarregar, o token já
     estava quente e tudo funcionava — o que fazia o problema
     parecer aleatório.

     Agora devolve:
       { estado:"sem-sessao" }              ninguém logado
       { estado:"pronto", empresaId }       logado e leu
       { estado:"falhou" }                  logado, leitura falhou

     Só "sem-sessao" pode levar à tela de login. */
  function retomarCliente() {
    if (!auth || !db) return Promise.resolve({ estado: "sem-sessao" });
    var u = auth.currentUser;
    if (!u || u.isAnonymous) return Promise.resolve({ estado: "sem-sessao" });

    /* No boot a credencial pode não ter chegado ao Firestore
       ainda — a mesma corrida do login. Renovar o token aqui é
       barato e resolve o caso comum antes da primeira tentativa. */
    return aguardarCredencial()
      .then(function () { return descobrirEmpresa(u.uid); })
      .then(function (empresaId) {
        return { estado: "pronto", empresaId: empresaId };
      }, function (e) {
        var codigo = (e && (e.code || e.message)) || "";
        /* "sem-empresa" é resposta legítima: a conta existe mas
           não está ligada a empresa nenhuma. Aí a porta é o
           destino certo. Qualquer outra falha é problema de
           leitura, e leitura falha não desloga ninguém. */
        if (codigo === "sem-empresa") return { estado: "sem-sessao" };
        return { estado: "falhou" };
      });
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
    "so-admin": "Só quem é administrador pode gerenciar a equipe.",
    "uid-invalido": "O identificador informado não parece válido. Copie o UID exato do Authentication.",
    "ja-e-membro": "Esta pessoa já está na lista da equipe.",
    "sem-conexao": "Sem conexão com o servidor.",
    "convite-inexistente": "Este link não é válido. Peça um novo à Totali.",
    "convite-usado": "Este link já foi usado para criar um acesso. Entre com seu e-mail e senha, ou peça um novo link à Totali.",
    "sem-empresa": "Esta conta ainda não está ligada a nenhuma empresa. Abra o link de convite que a Totali enviou.",
    "leitura-falhou": "Entramos na sua conta, mas não conseguimos consultar a sua empresa agora. " +
                      "Toque em Entrar de novo — seus documentos estão guardados e não se perderam.",
    "equipe-leitura-falhou": "A senha está certa, mas o servidor não respondeu a tempo. " +
                             "Sua sessão continua aberta — toque em Entrar de novo.",
    "auth/email-already-in-use": "Já existe uma conta com este e-mail. Entre com sua senha ou use \"Esqueci minha senha\".",
    "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
    "auth/missing-password": "Digite uma senha.",
    "convite-invalido": "Este link está incompleto. Peça um novo à Totali.",
    "codigo-invalido": "Este link não é válido. Peça um novo à Totali.",
    "permission-denied": "Sem permissão para esta ação.",
    "empresa-inexistente": "Não encontramos a empresa ligada a este acesso. Fale com a Totali.",
    "empresa-nao-carregou": "Entramos na sua conta, mas não conseguimos carregar os dados da empresa. " +
                            "Verifique a internet e tente de novo.",
    "senha-nao-confere": "Já existe uma conta com este e-mail, e a senha digitada não é a dela. " +
                         "Use \"Esqueci minha senha\" ou entre com a senha que você criou."
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
    criarContaEquipe: criarContaEquipe,
    lerConvite: lerConvite,
    cadastrarCliente: cadastrarCliente,
    entrarComoCliente: entrarComoCliente,
    recuperarSenha: recuperarSenha,
    retomarCliente: retomarCliente,
    empresasDoCliente: empresasDoCliente,
    novoCodigo: novoCodigo,
    sair: sair,
    explicar: explicar,
    agora: agora
  };
})(window);
