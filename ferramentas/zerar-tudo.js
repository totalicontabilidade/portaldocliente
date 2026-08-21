/* ============================================================
   Totali · Portal de Onboarding
   ferramentas/zerar-tudo.js — recomeçar do zero absoluto

   LEIA ISTO INTEIRO ANTES DE RODAR.

   O QUE ELE APAGA
   ---------------
     • TODAS as coleções do Firestore, com subcoleções — e não uma
       lista escrita à mão: ele pergunta ao banco quais existem.
       É o que pega coleção antiga, esquecida, de versão anterior.
     • TODOS os arquivos do Storage, em qualquer pasta.
     • TODAS as contas do Authentication, inclusive as suas.

   Depois dele, o projeto Firebase fica como no dia em que nasceu:
   as regras continuam publicadas, as Cloud Functions continuam
   no ar, e não existe mais um único dado.

   O QUE ISTO SIGNIFICA, SEM RODEIO
   --------------------------------
   NINGUÉM VAI CONSEGUIR ENTRAR NO PAINEL, e o sistema não tem
   como se consertar. A regra do Firestore diz:

       match /usuarios/{uid} {
         allow create: if ehAdmin() ...
       }

   e `ehAdmin()` exige um documento em /usuarios que acabou de ser
   apagado. Ovo e galinha. Já aconteceu neste projeto em 14/08/2026.

   O ÚNICO caminho de volta é o console do Firebase, na mão:

     1. Authentication → Users → Add user
        e-mail e senha de quem vai ser o primeiro admin.
        COPIE O UID que aparece na lista depois de criar.

     2. Firestore → Iniciar coleção → `usuarios`
        ID do documento: COLE O UID do passo 1.
        NÃO use o ID automático — se usar, não funciona, porque a
        regra procura o documento pelo uid de quem está logado.
        Campos:
            nome   (string)  ex.: Hesley
            email  (string)  o mesmo do passo 1
            papel  (string)  admin

     3. Abra equipe.html e entre. A partir daí o painel cria os
        outros membros sozinho.

   Se o passo 2 sair errado, o sintoma é entrar e o painel dizer
   que a conta não tem acesso. Confira se o ID do documento é o
   uid, e se `papel` está escrito exatamente `admin`.

   COMO RODAR
   ----------
   No Cloud Shell:

     cd ~/totali
     node zerar-tudo.js                 # só mostra o que existe
     node zerar-tudo.js --apagar        # pede a frase digitada

   Para apagar só uma parte:

     node zerar-tudo.js --apagar --sem-contas    # poupa o Authentication
     node zerar-tudo.js --apagar --sem-arquivos  # poupa o Storage

   O QUE ELE NÃO TOCA
   ------------------
   Regras, Cloud Functions, App Check, o segredo da chave privada
   no Secret Manager e o par de chaves em js/chave-publica.js.
   Nada disso é dado de cliente.
   ============================================================ */
"use strict";

const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { getStorage } = require("firebase-admin/storage");
const readline = require("readline");

const PROJETO = "portaldocliente-8cc7d";
const BUCKET = "portaldocliente-8cc7d.firebasestorage.app";
const FRASE = "APAGAR TUDO";

const APAGAR = process.argv.indexOf("--apagar") > -1;
const SEM_CONTAS = process.argv.indexOf("--sem-contas") > -1;
const SEM_ARQUIVOS = process.argv.indexOf("--sem-arquivos") > -1;
const SEM_PERGUNTAR = process.argv.indexOf("--sim") > -1;

initializeApp({ projectId: PROJETO, storageBucket: BUCKET });
const db = getFirestore();
const auth = getAuth();
const bucket = getStorage().bucket();

function perguntar(texto) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(texto, (r) => { rl.close(); res(r); }));
}

/* ---------- Levantamento ---------- */

/* Pergunta ao banco quais coleções existem, em vez de confiar
   numa lista escrita aqui. Coleção que ninguém lembra que existe
   é justamente a que sobra num recomeço. */
async function colecoes() {
  const raiz = await db.listCollections();
  const saida = [];
  for (const c of raiz) {
    const s = await c.get();
    saida.push({ nome: c.id, docs: s.size });
  }
  return saida;
}

async function contas() {
  const saida = [];
  let pagina = { pageToken: undefined };
  do {
    pagina = await auth.listUsers(1000, pagina.pageToken);
    pagina.users.forEach((u) => saida.push({ uid: u.uid, email: u.email || "(sem e-mail)" }));
  } while (pagina.pageToken);
  return saida;
}

async function arquivos() {
  const [lista] = await bucket.getFiles();
  let bytes = 0;
  lista.forEach((f) => { bytes += Number((f.metadata && f.metadata.size) || 0); });
  return { total: lista.length, mb: (bytes / 1048576).toFixed(1), amostra: lista.slice(0, 6).map((f) => f.name) };
}

/* ---------- Execução ---------- */

async function apagarColecoes(lista) {
  for (const c of lista) {
    /* `recursiveDelete` desce nas subcoleções — que é onde moram
       itens, sócios, mensagens, credenciais e acessos. Apagar só
       o documento da empresa deixaria tudo isso órfão e invisível,
       ocupando espaço para sempre. */
    await db.recursiveDelete(db.collection(c.nome));
    console.log(`  /${c.nome} — apagada`);
  }
}

async function apagarArquivos() {
  await bucket.deleteFiles({ force: true });
  console.log("  Storage — esvaziado");
}

async function apagarContas(lista) {
  for (let i = 0; i < lista.length; i += 900) {
    const bloco = lista.slice(i, i + 900).map((u) => u.uid);
    const r = await auth.deleteUsers(bloco);
    console.log(`  contas: ${i + bloco.length}/${lista.length}` +
                (r.failureCount ? `  (${r.failureCount} recusada(s))` : ""));
  }
}

async function principal() {
  console.log("\nProjeto:", PROJETO);
  console.log("Modo:", APAGAR ? "APAGAR" : "somente relatório (nada será alterado)");

  const cols = await colecoes();
  const arqs = SEM_ARQUIVOS ? null : await arquivos();
  const cts = SEM_CONTAS ? null : await contas();

  console.log("\n---------------- Firestore ----------------");
  if (!cols.length) console.log("  (nenhuma coleção)");
  cols.forEach((c) => console.log(`  /${c.nome}`.padEnd(28) + `${c.docs} documento(s) na raiz`));

  console.log("\n---------------- Storage ------------------");
  if (SEM_ARQUIVOS) console.log("  (poupado por --sem-arquivos)");
  else {
    console.log(`  ${arqs.total} arquivo(s) · ${arqs.mb} MB`);
    arqs.amostra.forEach((n) => console.log("    " + n));
    if (arqs.total > arqs.amostra.length) console.log(`    … e mais ${arqs.total - arqs.amostra.length}`);
  }

  console.log("\n---------------- Authentication -----------");
  if (SEM_CONTAS) console.log("  (poupado por --sem-contas)");
  else {
    console.log(`  ${cts.length} conta(s)`);
    cts.forEach((u) => console.log("    " + u.email + "   " + u.uid));
  }

  const nada = !cols.length && (SEM_ARQUIVOS || !arqs.total) && (SEM_CONTAS || !cts.length);
  if (nada) { console.log("\nJá está tudo vazio.\n"); return; }

  if (!APAGAR) {
    console.log("\nNada foi alterado. Para apagar:\n");
    console.log("  node zerar-tudo.js --apagar\n");
    return;
  }

  if (!SEM_CONTAS) {
    console.log("\n" + "!".repeat(64));
    console.log("DEPOIS DISTO NINGUÉM ENTRA NO PAINEL, e o sistema não se conserta");
    console.log("sozinho: só admin cria admin, e não vai sobrar nenhum.");
    console.log("A volta é pelo console do Firebase, na mão — o passo a passo");
    console.log("está no topo deste arquivo. Leia antes de continuar.");
    console.log("!".repeat(64));
  }

  if (!SEM_PERGUNTAR) {
    const r = await perguntar(`\nPara confirmar, escreva ${FRASE}: `);
    if (String(r).trim() !== FRASE) { console.log("\nCancelado. Nada foi alterado.\n"); return; }
  }

  console.log("\nApagando…\n");
  await apagarColecoes(cols);
  if (!SEM_ARQUIVOS) await apagarArquivos();
  if (!SEM_CONTAS) await apagarContas(cts);

  /* Confere o resultado lendo de novo, em vez de confiar em não
     ter dado erro. */
  const sobraCols = await colecoes();
  const sobraArq = SEM_ARQUIVOS ? null : await arquivos();
  const sobraCts = SEM_CONTAS ? null : await contas();

  console.log("\n---------------- Conferência --------------");
  console.log(`  coleções   ${sobraCols.length}`);
  console.log(`  arquivos   ${SEM_ARQUIVOS ? "(poupado)" : sobraArq.total}`);
  console.log(`  contas     ${SEM_CONTAS ? "(poupado)" : sobraCts.length}`);
  if (sobraCols.length) sobraCols.forEach((c) => console.log(`    sobrou /${c.nome} (${c.docs})`));

  if (!SEM_CONTAS) {
    console.log("\n----------------------------------------------------------");
    console.log("AGORA CRIE O PRIMEIRO ADMIN, no console do Firebase:");
    console.log("");
    console.log("  1. Authentication → Users → Add user");
    console.log("     e-mail e senha. Copie o UID que aparecer na lista.");
    console.log("");
    console.log("  2. Firestore → Iniciar coleção → usuarios");
    console.log("     ID do documento: COLE O UID (não use o automático)");
    console.log("     nome   (string)  seu nome");
    console.log("     email  (string)  o mesmo do passo 1");
    console.log("     papel  (string)  admin");
    console.log("");
    console.log("  3. Abra equipe.html e entre.");
    console.log("----------------------------------------------------------\n");
  }
}

principal().then(
  () => process.exit(0),
  (e) => { console.error("\nErro:", (e && e.message) || e, "\n"); process.exit(1); }
);
