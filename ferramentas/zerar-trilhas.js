/* ============================================================
   Totali · Portal de Onboarding
   ferramentas/zerar-trilhas.js — limpar o banco antes de valer

   O QUE ISTO APAGA, E POR QUE PRECISA DE FERRAMENTA
   -------------------------------------------------
   Três coleções são fechadas para escrita no navegador, de
   propósito, e por isso o painel não consegue limpá-las:

     /auditoria         trilha do servidor · ninguém escreve nela,
                        nem cliente, nem equipe, nem administrador.
                        É isso que a torna prova.
     /exclusoesDeConta  pedidos de exclusão já processados, com o
                        que foi apagado e o que foi recusado.
     /pedidosDeSenha    cada vez que alguém abriu uma senha de
                        maquininha, e a resposta cifrada.

   Fora de um recomeço, MEXER NISSO É ERRADO. Uma trilha que se
   apaga não prova nada, e o dia em que alguém perguntar "quem
   aprovou este balanço, e quando" a resposta precisa existir.

   QUANDO USAR
   -----------
   Uma vez só, antes de o sistema entrar em uso de verdade, para
   tirar o rastro dos testes. Depois disso, nunca mais — para
   pedido de exclusão pela LGPD existe o `anonimizar-auditoria.js`,
   que desliga a trilha da pessoa SEM destruir a prova.

   O QUE ELE NÃO TOCA
   ------------------
   /usuarios (a equipe), /conteudo (o que o portal mostra),
   /empresas e o Storage. Empresa se apaga pelo painel, que sabe a
   ordem certa e ainda apaga a conta de login do cliente.

   COMO RODAR
   ----------
   No Cloud Shell:

     cd ~/totali
     node zerar-trilhas.js                    # só mostra
     node zerar-trilhas.js --apagar           # pede a frase
     node zerar-trilhas.js --apagar --sim     # sem perguntar

   ============================================================ */
"use strict";

const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const readline = require("readline");

const PROJETO = "portaldocliente-8cc7d";
const FRASE = "APAGAR AS TRILHAS";

const COLECOES = [
  { nome: "auditoria", desc: "trilha do servidor (quem aprovou o quê, quando)" },
  { nome: "exclusoesDeConta", desc: "pedidos de exclusão já processados" },
  { nome: "pedidosDeSenha", desc: "aberturas de senha de maquininha" }
];

const APAGAR = process.argv.indexOf("--apagar") > -1;
const SEM_PERGUNTAR = process.argv.indexOf("--sim") > -1;

initializeApp({ projectId: PROJETO });
const db = getFirestore();

function perguntar(texto) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(texto, (r) => { rl.close(); res(r); }));
}

async function contar() {
  const linhas = [];
  for (const c of COLECOES) {
    const s = await db.collection(c.nome).get();
    /* O que existe lá dentro, por tipo — é o que deixa a pessoa
       ver que está apagando teste, e não histórico de verdade. */
    const porTipo = new Map();
    s.forEach((d) => {
      const t = (d.data() || {}).tipo || "(sem tipo)";
      porTipo.set(t, (porTipo.get(t) || 0) + 1);
    });
    linhas.push({ ...c, total: s.size, porTipo: [...porTipo] });
  }
  return linhas;
}

async function esvaziar(nome) {
  let apagados = 0;
  /* Em blocos: `get()` de uma coleção grande cabe na memória, mas
     o batch do Firestore para em 500 operações. */
  for (;;) {
    const s = await db.collection(nome).limit(400).get();
    if (s.empty) break;
    const lote = db.batch();
    s.docs.forEach((d) => lote.delete(d.ref));
    await lote.commit();
    apagados += s.size;
    console.log(`  ${nome}: ${apagados}`);
    if (s.size < 400) break;
  }
  return apagados;
}

async function principal() {
  const linhas = await contar();
  const total = linhas.reduce((a, l) => a + l.total, 0);

  console.log("\nTrilhas gravadas pelo servidor\n");
  for (const l of linhas) {
    console.log(`  /${l.nome}  ${String(l.total).padStart(5)} registro(s)   ${l.desc}`);
    for (const [t, n] of l.porTipo.sort((a, b) => b[1] - a[1]).slice(0, 8)) {
      console.log(`        ${String(n).padStart(5)} × ${t}`);
    }
  }
  console.log(`\n  TOTAL: ${total} registro(s)\n`);

  if (!total) { console.log("Já está vazio.\n"); return; }

  if (!APAGAR) {
    console.log("Nada foi alterado. Para apagar:\n");
    console.log("  node zerar-trilhas.js --apagar\n");
    return;
  }

  console.log("Isto não tem volta, e não existe backup dentro do sistema.");
  console.log("Depois de apagar, o sistema não consegue mais dizer quem aprovou");
  console.log("o quê nem quem abriu qual senha, antes desta data.\n");

  if (!SEM_PERGUNTAR) {
    const r = await perguntar(`Para confirmar, escreva ${FRASE}: `);
    if (String(r).trim() !== FRASE) { console.log("\nCancelado.\n"); return; }
  }

  console.log("");
  let soma = 0;
  for (const l of linhas) soma += await esvaziar(l.nome);
  console.log(`\nPronto. ${soma} registro(s) apagado(s).`);
  console.log("A partir de agora a trilha volta a valer como prova.\n");
}

principal().then(
  () => process.exit(0),
  (e) => { console.error("\nErro:", (e && e.message) || e, "\n"); process.exit(1); }
);
