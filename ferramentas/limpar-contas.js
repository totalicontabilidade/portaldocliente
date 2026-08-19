/* ============================================================
   Totali · Portal de Onboarding
   ferramentas/limpar-contas.js — faxina no Authentication

   PARA QUE SERVE
   --------------
   Depois de meses de teste sobra lixo no Firebase Authentication:
   contas criadas para experimentar, convites abertos e
   abandonados, sondas. Elas não dão acesso a nada — as regras do
   Firestore continuam barrando —, mas poluem a lista e um dia
   alguém vai olhar aquilo sem saber o que pode apagar.

   Este programa NÃO adivinha. Ele cruza cada conta do
   Authentication com o Firestore e diz, com o motivo, em qual
   das quatro caixas ela cai:

     EQUIPE    tem documento em /usuarios — quem usa o painel
     CLIENTE   tem acesso a alguma empresa — quem usa o portal
     RECENTE   órfã, mas criada há pouco; pode ser um convite
               que a pessoa ainda vai abrir
     ÓRFÃ      não é equipe, não tem empresa, e é velha

   Só ÓRFÃ é candidata a apagar.

   COMO RODAR — leia isto inteiro antes
   ------------------------------------
   No Cloud Shell (console.cloud.google.com, ícone >_ no topo):

     mkdir -p ~/totali && cd ~/totali
     # cole o arquivo aqui com o editor do Cloud Shell
     npm init -y && npm install firebase-admin
     node limpar-contas.js

   Assim ele SÓ MOSTRA o relatório. Não apaga nada.

   Depois de ler o relatório e concordar com a lista:

     node limpar-contas.js --apagar

   E há uma trava a mais: com --apagar, ele repete a lista, espera
   5 segundos e só então age. Dá tempo de Ctrl+C.

   O QUE ELE NUNCA APAGA
   ---------------------
   Conta da equipe. Conta ligada a empresa. Conta criada nos
   últimos DIAS_DE_GRACA dias. Estas três travas são conferidas
   no momento de apagar, não só na hora de listar — entre uma
   coisa e outra o mundo pode ter mudado.
   ============================================================ */
"use strict";

const admin = require("firebase-admin");

const PROJETO = "portaldocliente-8cc7d";

/* Conta órfã recém-criada quase sempre é um convite que a pessoa
   ainda não abriu. Apagar seria desfazer um trabalho da equipe. */
const DIAS_DE_GRACA = 7;

/* Nunca apagar, aconteça o que acontecer. Ponha aqui os e-mails
   que você quer proteger mesmo que a classificação erre. */
const PROTEGIDOS = [
  "contato@totalicontabilidade.com.br"
];

const APAGAR = process.argv.indexOf("--apagar") > -1;

admin.initializeApp({ projectId: PROJETO });
const auth = admin.auth();
const db = admin.firestore();

const DIA = 86400000;

function data(iso) {
  if (!iso) return "nunca";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR") + " " +
         d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function diasDesde(iso) {
  if (!iso) return Infinity;
  return Math.floor((Date.now() - new Date(iso).getTime()) / DIA);
}

/* Todas as contas, de página em página. */
async function todasAsContas() {
  const saida = [];
  let pagina;
  do {
    pagina = await auth.listUsers(1000, pagina && pagina.pageToken);
    pagina.users.forEach((u) => saida.push(u));
  } while (pagina.pageToken);
  return saida;
}

/* Quem é da equipe: uma leitura só, e não uma por conta. */
async function uidsDaEquipe() {
  const snap = await db.collection("usuarios").get();
  const set = new Set();
  snap.forEach((d) => set.add(d.id));
  return set;
}

/* Quem tem acesso a alguma empresa. Varre os acessos de todas as
   empresas — é a fonte de verdade de quem entra no portal. */
async function uidsComEmpresa() {
  const mapa = new Map();          /* uid -> [nomes de empresa] */
  const empresas = await db.collection("empresas").get();

  for (const emp of empresas.docs) {
    const dados = emp.data() || {};
    const nome = dados.nomeFantasia || dados.razaoSocial || emp.id;
    const acessos = await emp.ref.collection("acessos").get();
    acessos.forEach((a) => {
      if (!mapa.has(a.id)) mapa.set(a.id, []);
      mapa.get(a.id).push(nome);
    });
  }

  /* O índice /clientes/{uid}/empresas também conta: se ele existe,
     alguém ligou aquela conta a uma empresa em algum momento. */
  const clientes = await db.collection("clientes").get();
  for (const cli of clientes.docs) {
    const lista = await cli.ref.collection("empresas").get();
    if (lista.empty) continue;
    if (!mapa.has(cli.id)) mapa.set(cli.id, []);
    lista.forEach((e) => {
      if (mapa.get(cli.id).indexOf("(índice) " + e.id) === -1) {
        mapa.get(cli.id).push("(índice) " + e.id);
      }
    });
  }

  return mapa;
}

function classificar(u, equipe, comEmpresa) {
  const email = (u.email || "").toLowerCase();

  if (PROTEGIDOS.map((e) => e.toLowerCase()).indexOf(email) > -1) {
    return { caixa: "PROTEGIDA", motivo: "está na lista de protegidos deste programa" };
  }
  if (equipe.has(u.uid)) {
    return { caixa: "EQUIPE", motivo: "tem documento em /usuarios" };
  }
  if (comEmpresa.has(u.uid)) {
    return { caixa: "CLIENTE", motivo: "acessa " + comEmpresa.get(u.uid).join(", ") };
  }
  const dias = diasDesde(u.metadata.creationTime);
  if (dias < DIAS_DE_GRACA) {
    return { caixa: "RECENTE",
             motivo: "criada há " + dias + " dia(s) — pode ser convite ainda não aberto" };
  }
  return { caixa: "ÓRFÃ",
           motivo: "não é equipe, não acessa empresa nenhuma, criada há " + dias + " dias" };
}

async function principal() {
  console.log("Projeto:", PROJETO);
  console.log("Modo:", APAGAR ? "APAGAR" : "somente relatório (nada será apagado)");
  console.log("");

  const [contas, equipe, comEmpresa] = await Promise.all([
    todasAsContas(), uidsDaEquipe(), uidsComEmpresa()
  ]);

  const caixas = { PROTEGIDA: [], EQUIPE: [], CLIENTE: [], RECENTE: [], "ÓRFÃ": [] };

  contas.forEach((u) => {
    const r = classificar(u, equipe, comEmpresa);
    caixas[r.caixa].push({ u, motivo: r.motivo });
  });

  ["PROTEGIDA", "EQUIPE", "CLIENTE", "RECENTE", "ÓRFÃ"].forEach((caixa) => {
    const lista = caixas[caixa];
    console.log("=".repeat(64));
    console.log(caixa + "  (" + lista.length + ")");
    console.log("=".repeat(64));
    if (!lista.length) { console.log("  (nenhuma)\n"); return; }
    lista
      .sort((a, b) => (a.u.email || "").localeCompare(b.u.email || ""))
      .forEach(({ u, motivo }) => {
        console.log("  " + (u.email || "(sem e-mail)"));
        console.log("    uid    " + u.uid);
        console.log("    criada " + data(u.metadata.creationTime) +
                    "   último acesso " + data(u.metadata.lastSignInTime));
        console.log("    " + motivo);
      });
    console.log("");
  });

  const orfas = caixas["ÓRFÃ"];
  if (!orfas.length) {
    console.log("Nada a apagar. O Authentication já está limpo.");
    return;
  }

  if (!APAGAR) {
    console.log("-".repeat(64));
    console.log(orfas.length + " conta(s) órfã(s) seriam apagadas.");
    console.log("Leia a lista acima. Se concordar, rode de novo com:");
    console.log("");
    console.log("    node limpar-contas.js --apagar");
    console.log("");
    return;
  }

  console.log("-".repeat(64));
  console.log("VAI APAGAR estas " + orfas.length + " conta(s):");
  orfas.forEach(({ u }) => console.log("   " + (u.email || "(sem e-mail)") + "   " + u.uid));
  console.log("");
  console.log("Ctrl+C nos próximos 5 segundos para cancelar.");
  await new Promise((r) => setTimeout(r, 5000));

  let apagadas = 0, recusadas = 0;
  for (const { u } of orfas) {
    /* Confere DE NOVO, agora. Entre listar e apagar a pessoa pode
       ter aberto um convite — e aí a conta deixou de ser órfã. */
    const aindaEquipe = (await db.collection("usuarios").doc(u.uid).get()).exists;
    const cli = await db.collection("clientes").doc(u.uid).collection("empresas").limit(1).get();
    if (aindaEquipe || !cli.empty) {
      console.log("  RECUSADA " + (u.email || u.uid) + " — deixou de ser órfã desde a listagem");
      recusadas++;
      continue;
    }
    try {
      await auth.deleteUser(u.uid);
      console.log("  apagada  " + (u.email || u.uid));
      apagadas++;
    } catch (e) {
      console.log("  ERRO     " + (u.email || u.uid) + " — " + e.message);
      recusadas++;
    }
  }

  console.log("");
  console.log("Apagadas: " + apagadas + "   |   Não apagadas: " + recusadas);
}

principal().then(
  () => process.exit(0),
  (e) => { console.error("Falhou:", e); process.exit(1); }
);
