/* ============================================================
   Totali · Portal de Onboarding
   ferramentas/limpar-firestore.js — faxina nos documentos soltos

   O QUE É UM DOCUMENTO SOLTO
   --------------------------
   É um registro que aponta para alguma coisa que não existe mais.
   Ele não quebra nada — o sistema simplesmente ignora — mas
   engana quem lê o banco e, no caso dos convites, deixa por aí
   um código que parece válido.

   O que este programa procura, e só isto:

     1. /usuarios/{uid}          conta de equipe cuja conta de
                                 login não existe mais
     2. /clientes/{uid}          índice de cliente cuja conta de
                                 login não existe mais
     3. /clientes/{uid}/empresas/{id}
                                 aponta para empresa apagada
     4. /empresas/{id}/acessos/{uid}
                                 acesso de conta que não existe
     5. /convites/{codigo}       aponta para empresa apagada, ou
                                 já foi usado há muito tempo
     6. /exclusoesDeConta/{id}   pedido já processado e antigo

   O QUE ELE NUNCA TOCA
   --------------------
   Empresa. Documento de cliente. Mensagem. Credencial. Anotação.
   Nada que seja CONTEÚDO. Se uma empresa está lá e você não a
   quer mais, isso é decisão de negócio e se resolve pelo painel,
   que apaga tudo na ordem certa — inclusive os arquivos do
   Storage, que este programa não sabe apagar.

   ATENÇÃO AO ITEM 4
   -----------------
   Apagar /empresas/{id}/acessos/{uid} TIRA O ACESSO daquela
   pessoa ao portal. Só entram na lista os acessos de contas que
   já não existem no Authentication — para essas, o acesso já não
   servia para nada. Ainda assim, é o item que merece sua leitura
   mais atenta no relatório.

   COMO RODAR
   ----------
   No Cloud Shell:

     cd ~/totali
     node limpar-firestore.js            # só mostra
     node limpar-firestore.js --apagar   # age

   Mesma trava do outro: repete a lista e espera 5 segundos.
   ============================================================ */
"use strict";

const admin = require("firebase-admin");

const PROJETO = "portaldocliente-8cc7d";

/* Convite usado continua servindo de histórico por um tempo:
   é assim que se descobre quem abriu o quê e quando. */
const DIAS_CONVITE_USADO = 60;
const DIAS_PEDIDO_EXCLUSAO = 30;

const APAGAR = process.argv.indexOf("--apagar") > -1;

admin.initializeApp({ projectId: PROJETO });
const auth = admin.auth();
const db = admin.firestore();

const DIA = 86400000;

function emMs(v) {
  if (!v) return 0;
  if (typeof v === "number") return v;
  if (typeof v.toMillis === "function") { try { return v.toMillis(); } catch (e) { return 0; } }
  if (typeof v.seconds === "number") return v.seconds * 1000;
  const t = Date.parse(v);
  return isNaN(t) ? 0 : t;
}

function diasDesde(v) {
  const ms = emMs(v);
  return ms ? Math.floor((Date.now() - ms) / DIA) : Infinity;
}

async function uidsQueExistem() {
  const set = new Set();
  let pagina;
  do {
    pagina = await auth.listUsers(1000, pagina && pagina.pageToken);
    pagina.users.forEach((u) => set.add(u.uid));
  } while (pagina.pageToken);
  return set;
}

async function empresasQueExistem() {
  const snap = await db.collection("empresas").get();
  const mapa = new Map();
  snap.forEach((d) => {
    const e = d.data() || {};
    mapa.set(d.id, e.nomeFantasia || e.razaoSocial || d.id);
  });
  return mapa;
}

async function principal() {
  console.log("Projeto:", PROJETO);
  console.log("Modo:", APAGAR ? "APAGAR" : "somente relatório (nada será apagado)");
  console.log("");

  const [contas, empresas] = await Promise.all([uidsQueExistem(), empresasQueExistem()]);
  console.log("No Authentication: " + contas.size + " conta(s)");
  console.log("No Firestore: " + empresas.size + " empresa(s)");
  console.log("");

  /* Cada achado vira { ref, o_que, porque }. Nada é apagado
     enquanto a varredura não termina. */
  const achados = [];

  /* 1. equipe sem conta de login */
  (await db.collection("usuarios").get()).forEach((d) => {
    if (contas.has(d.id)) return;
    const u = d.data() || {};
    achados.push({
      ref: d.ref,
      o_que: "/usuarios/" + d.id,
      porque: "membro da equipe " + (u.nome || u.email || "") +
              " — a conta de login não existe mais"
    });
  });

  /* 2 e 3. índice de cliente */
  const clientes = await db.collection("clientes").get();
  for (const d of clientes.docs) {
    const temConta = contas.has(d.id);
    const lista = await d.ref.collection("empresas").get();

    if (!temConta) {
      lista.forEach((e) => achados.push({
        ref: e.ref,
        o_que: "/clientes/" + d.id + "/empresas/" + e.id,
        porque: "a conta de login não existe mais"
      }));
      achados.push({
        ref: d.ref,
        o_que: "/clientes/" + d.id,
        porque: "índice de cliente — a conta de login não existe mais"
      });
      continue;
    }

    lista.forEach((e) => {
      if (empresas.has(e.id)) return;
      achados.push({
        ref: e.ref,
        o_que: "/clientes/" + d.id + "/empresas/" + e.id,
        porque: "aponta para empresa que foi apagada"
      });
    });
  }

  /* 4. acessos de contas que já não existem */
  for (const [id, nome] of empresas) {
    const acessos = await db.collection("empresas").doc(id).collection("acessos").get();
    acessos.forEach((a) => {
      if (contas.has(a.id)) return;
      achados.push({
        ref: a.ref,
        o_que: "/empresas/" + id + "/acessos/" + a.id,
        porque: "acesso a \"" + nome + "\" de uma conta que não existe mais"
      });
    });
  }

  /* 5. convites */
  (await db.collection("convites").get()).forEach((d) => {
    const v = d.data() || {};
    if (!empresas.has(v.empresaId)) {
      achados.push({
        ref: d.ref,
        o_que: "/convites/" + d.id,
        porque: "convite para empresa que foi apagada"
      });
      return;
    }
    if (v.ativo === false && diasDesde(v.usadoEm || v.criadoEm) > DIAS_CONVITE_USADO) {
      achados.push({
        ref: d.ref,
        o_que: "/convites/" + d.id,
        porque: "convite já usado, há mais de " + DIAS_CONVITE_USADO + " dias"
      });
    }
  });

  /* 6. pedidos de exclusão já processados */
  (await db.collection("exclusoesDeConta").get()).forEach((d) => {
    const p = d.data() || {};
    if (!p.concluidoEm) return;
    if (diasDesde(p.concluidoEm) <= DIAS_PEDIDO_EXCLUSAO) return;
    achados.push({
      ref: d.ref,
      o_que: "/exclusoesDeConta/" + d.id,
      porque: "pedido concluído há mais de " + DIAS_PEDIDO_EXCLUSAO + " dias"
    });
  });

  /* ---------- Relatório ---------- */
  if (!achados.length) {
    console.log("Nada solto. O Firestore está limpo.");
    return;
  }

  console.log("=".repeat(64));
  console.log("DOCUMENTOS SOLTOS  (" + achados.length + ")");
  console.log("=".repeat(64));
  achados.forEach((a) => {
    console.log("  " + a.o_que);
    console.log("     " + a.porque);
  });
  console.log("");

  const acessos = achados.filter((a) => a.o_que.indexOf("/acessos/") > -1).length;
  if (acessos) {
    console.log("ATENÇÃO: " + acessos + " deles são registros de ACESSO. Apagar tira o acesso");
    console.log("daquela pessoa ao portal. Todos são de contas que já não existem no");
    console.log("Authentication, então o acesso já não servia — mas confira mesmo assim.");
    console.log("");
  }

  if (!APAGAR) {
    console.log("-".repeat(64));
    console.log("Leia a lista. Se concordar, rode de novo com:");
    console.log("");
    console.log("    node limpar-firestore.js --apagar");
    console.log("");
    return;
  }

  console.log("VAI APAGAR os " + achados.length + " documentos acima.");
  console.log("Ctrl+C nos próximos 5 segundos para cancelar.");
  await new Promise((r) => setTimeout(r, 5000));

  let feitas = 0;
  /* Em lotes de 400: o limite do Firestore é 500 por escrita. */
  for (let i = 0; i < achados.length; i += 400) {
    const lote = db.batch();
    achados.slice(i, i + 400).forEach((a) => lote.delete(a.ref));
    await lote.commit();
    feitas += Math.min(400, achados.length - i);
    console.log("  apagados " + feitas + " de " + achados.length);
  }

  console.log("");
  console.log("Pronto. " + feitas + " documento(s) soltos apagados.");
}

principal().then(
  () => process.exit(0),
  (e) => { console.error("Falhou:", e); process.exit(1); }
);
