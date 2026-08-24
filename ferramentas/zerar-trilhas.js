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
     node zerar-trilhas.js --apagar           # apaga TUDO, pede a frase
     node zerar-trilhas.js --apagar --sim     # sem perguntar

     node zerar-trilhas.js --orfas            # mostra só o rastro de teste
     node zerar-trilhas.js --orfas --apagar   # apaga só ele

   QUAL DOS DOIS
   -------------
   `--orfas` é o de todo dia, depois de uma bateria de teste: apaga
   o rastro de empresa que já não existe e PRESERVA o histórico de
   quem existe. Não pede frase de confirmação porque não destrói
   histórico de cliente nenhum — mas mostra a lista antes, e só age
   com `--apagar`.

   Sem `--orfas`, apaga as três coleções inteiras. É para recomeçar
   do zero, e leva o histórico dos clientes reais junto.

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

/* MODO CIRÚRGICO, acrescentado em 2026-08-24.

   Esvaziar as três coleções resolve o caso "recomeçar do zero", mas
   é grosso demais para o caso comum: depois de uma bateria de teste,
   o que sobra é lixo de empresa que nunca existiu de verdade,
   MISTURADO com o histórico dos clientes reais. Apagar tudo levava
   os dois juntos.

   `--orfas` apaga só o que aponta para empresa que não está mais em
   /empresas — o rastro dos testes — e não encosta no histórico de
   quem existe. Os pedidos de exclusão já concluídos e os pedidos de
   senha entram junto: são ordens de serviço cumpridas, não
   histórico. Quem abriu qual senha continua registrado em
   /auditoria, que é onde isso deve morar. */
const SO_ORFAS = process.argv.indexOf("--orfas") > -1;

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

/* Ids das empresas que ainda existem. Tudo em /auditoria que aponte
   para fora desta lista é rastro de empresa apagada — na prática,
   de teste. */
async function empresasVivas() {
  const s = await db.collection("empresas").get();
  const vivas = new Set();
  s.forEach((d) => vivas.add(d.id));
  return vivas;
}

async function limparOrfas() {
  const vivas = await empresasVivas();
  console.log(`\n${vivas.size} empresa(s) existindo hoje.\n`);

  const aud = await db.collection("auditoria").get();
  const orfas = [];
  const mantidas = new Map();
  aud.forEach((d) => {
    const e = (d.data() || {}).empresaId || "";
    if (e && !vivas.has(e)) orfas.push(d);
    else mantidas.set(e || "(sem empresa)", (mantidas.get(e || "(sem empresa)") || 0) + 1);
  });

  /* Pedido de exclusão concluído é ordem de serviço cumprida, e
     pedido de senha guarda resposta que já não abre — nenhum dos
     dois é histórico que valha conservar. */
  const exc = await db.collection("exclusoesDeConta").get();
  const ped = await db.collection("pedidosDeSenha").get();

  const porEmpresa = new Map();
  orfas.forEach((d) => {
    const e = (d.data() || {}).empresaId;
    porEmpresa.set(e, (porEmpresa.get(e) || 0) + 1);
  });

  console.log("A APAGAR — rastro de empresa que não existe mais:");
  for (const [e, n] of [...porEmpresa].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)} registro(s)   empresa ${e}`);
  }
  console.log(`  ${String(exc.size).padStart(4)} pedido(s) de exclusão já concluídos`);
  console.log(`  ${String(ped.size).padStart(4)} pedido(s) de abertura de senha`);

  console.log("\nA MANTER — histórico de empresa que existe:");
  if (!mantidas.size) console.log("  (nenhum)");
  for (const [e, n] of mantidas) console.log(`  ${String(n).padStart(4)} registro(s)   empresa ${e}`);

  const total = orfas.length + exc.size + ped.size;
  console.log(`\n  TOTAL A APAGAR: ${total} registro(s)\n`);
  if (!total) { console.log("Nada a limpar.\n"); return; }

  if (!APAGAR) {
    console.log("Nada foi alterado. Para apagar:\n");
    console.log("  node zerar-trilhas.js --orfas --apagar\n");
    return;
  }

  const alvos = orfas.concat(exc.docs, ped.docs);
  let feito = 0;
  for (let i = 0; i < alvos.length; i += 400) {
    const lote = db.batch();
    alvos.slice(i, i + 400).forEach((d) => lote.delete(d.ref));
    await lote.commit();
    feito += Math.min(400, alvos.length - i);
    console.log(`  apagados: ${feito}`);
  }
  console.log(`\nPronto. ${feito} registro(s) apagado(s).`);
  console.log("O histórico das empresas que existem ficou intacto.\n");
}

async function principal() {
  if (SO_ORFAS) return limparOrfas();

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
    console.log("  node zerar-trilhas.js --apagar          # tudo");
    console.log("  node zerar-trilhas.js --orfas           # só o rastro de teste (confere antes)\n");
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
