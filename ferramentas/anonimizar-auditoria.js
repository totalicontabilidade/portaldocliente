/* ============================================================
   Totali · Portal de Onboarding
   ferramentas/anonimizar-auditoria.js — pedido de exclusão (LGPD)

   O PROBLEMA
   ----------
   Excluir um cliente pelo painel apaga tudo o que é dele: empresa,
   documentos, sócios, mensagens, credenciais, acessos, convite e a
   conta de login. Uma coisa fica: a trilha em /auditoria.

   E ela fica de propósito. A regra do Firestore fecha /auditoria
   para escrita de todo mundo — cliente, equipe e administrador. É
   isso que faz dela prova: se qualquer um pudesse apagar uma linha,
   nenhuma linha valeria nada. Quem escreve é só a Cloud Function.

   Só que a LGPD dá ao titular o direito de pedir a eliminação dos
   dados dele (art. 18, VI), e a mesma lei manda conservar o que é
   necessário ao cumprimento de obrigação legal (art. 16, I). Uma
   contabilidade tem prazo de guarda a cumprir e precisa conseguir
   dizer "este documento foi aprovado nesta data" mesmo depois.

   A SAÍDA
   -------
   Não apagar a trilha: DESLIGÁ-LA DA PESSOA. O que sobra prova que
   um fato aconteceu, quando, e por qual pessoa da Totali — sem
   dizer de quem era a empresa.

   O que muda em cada registro:

     empresaId   vira "anon:" + hash irreversível (SHA-256 com sal)
     chave       perde os ids de sócio: "socios/rg/AbC123" fica
                 "socios/rg" — o tipo do documento continua legível
     arquivos    a LISTA DE NOMES sai e vira só a contagem; nome de
                 arquivo carrega CPF, nome de pessoa e endereço
     valor       sai (é número de inscrição, dado da empresa)
     uid         sai (identifica a conta do cliente)
     porEquipe   fica: é gente nossa, e é registro de quem agiu
     por         fica, pelo mesmo motivo
     tipo, em    ficam intactos — é o fato e a hora

   O hash usa um SAL FIXO guardado aqui. Isso é deliberado: com o
   sal, quem já souber o id de uma empresa pode conferir se um
   registro era dela. Sem nenhum sal, qualquer um poderia. E o id
   original não volta do hash de jeito nenhum.

   O QUE ESTE PROGRAMA NÃO FAZ
   ---------------------------
   Não apaga a empresa. Anonimizar a trilha de uma empresa VIVA
   deixaria o sistema cego sobre um cliente ativo, sem apagar nada
   do que importa. Rode isto DEPOIS de excluir pelo painel — e ele
   recusa se a empresa ainda existir, a não ser com --mesmo-viva.

   COMO RODAR
   ----------
   No Cloud Shell:

     cd ~/totali
     node anonimizar-auditoria.js <empresaId>              # só mostra
     node anonimizar-auditoria.js <empresaId> --aplicar    # age

   Para descobrir o empresaId de uma empresa já apagada, procure no
   relatório de exclusão ou nos próprios registros:

     node anonimizar-auditoria.js --listar

   Não tem volta. O hash é de mão única.
   ============================================================ */
"use strict";

/* Importação modular pelo mesmo motivo das outras ferramentas: o
   Cloud Shell bloqueia scripts de instalação, e os getters do
   namespace `admin.*` não chegam a ser montados. */
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const crypto = require("crypto");

const PROJETO = "portaldocliente-8cc7d";

/* Trocar este sal faz os hashes antigos e novos deixarem de
   combinar. Não troque depois da primeira anonimização. */
const SAL = "totali-portal-auditoria-v1";

const APLICAR = process.argv.indexOf("--aplicar") > -1;
const MESMO_VIVA = process.argv.indexOf("--mesmo-viva") > -1;
const LISTAR = process.argv.indexOf("--listar") > -1;
const alvo = process.argv.slice(2).filter((a) => a.indexOf("--") !== 0)[0] || "";

initializeApp({ projectId: PROJETO });
const db = getFirestore();

function apelido(empresaId) {
  return "anon:" + crypto.createHash("sha256")
    .update(SAL + "|" + String(empresaId))
    .digest("hex").slice(0, 16);
}

/* "socios/rg/AbC123xyz" -> "socios/rg". O id do sócio é o que
   liga a linha a uma pessoa; o tipo do documento, não.

   O CRIVO PRECISA SER ESTREITO. A primeira versão tirava qualquer
   pedaço com 16 letras ou mais, e isso comia `fichas-funcionarios`
   e `acesso-empregador-web` — nove ids do checklist passam de 16.
   "dp/fichas-funcionarios" viraria "dp", e a trilha perderia
   justamente o que ela existe para dizer.

   Id automático do Firestore é sempre 20 caracteres, só letras e
   números, com maiúsculas no meio. Id de documento do checklist é
   minúsculo e com hífen. Os dois nunca se confundem. */
function ehIdDoFirestore(p) {
  return /^[A-Za-z0-9]{20}$/.test(p) && /[A-Z]/.test(p);
}

function chaveSemIds(chave) {
  return String(chave || "").split("/").filter((p) => !ehIdDoFirestore(p)).join("/");
}

function anonimizar(d) {
  const novo = {
    empresaId: apelido(d.empresaId),
    tipo: d.tipo,
    em: d.em,
    anonimizadoEm: new Date()
  };

  const chave = chaveSemIds(d.chave);
  if (chave) novo.chave = chave;
  if (d.por) novo.por = d.por;                 /* pessoa da Totali */
  if (d.porEquipe) novo.porEquipe = d.porEquipe;
  if (d.origem) novo.origem = d.origem;
  if (typeof d.seAplica !== "undefined") novo.seAplica = d.seAplica;
  if (typeof d.total === "number") novo.total = d.total;

  /* Nome de arquivo é o campo mais perigoso da trilha: "RG JOANA
     FERREIRA 529982.pdf" é dado pessoal inteiro. Vira contagem. */
  if (Array.isArray(d.arquivos)) novo.arquivos = d.arquivos.length;

  /* `motivo` é texto que a equipe escreveu para o cliente ler.
     Pode citar nome, número, endereço. Some. */
  return novo;
}

/* Quais campos deste registro carregam identificação. Serve só
   para o relatório: é o que a pessoa precisa ver antes de decidir. */
function oQueSai(d) {
  const fora = [];
  if (d.empresaId) fora.push("empresaId");
  if (chaveSemIds(d.chave) !== String(d.chave || "")) fora.push("id de sócio na chave");
  if (Array.isArray(d.arquivos) && d.arquivos.length) fora.push(d.arquivos.length + " nome(s) de arquivo");
  if (d.valor) fora.push("valor");
  if (d.uid) fora.push("uid");
  if (d.motivo) fora.push("motivo");
  return fora;
}

async function listar() {
  const todos = await db.collection("auditoria").get();
  const porEmpresa = new Map();
  todos.forEach((doc) => {
    const id = String((doc.data() || {}).empresaId || "");
    if (!id) return;
    porEmpresa.set(id, (porEmpresa.get(id) || 0) + 1);
  });

  console.log("\nEmpresas com registro em /auditoria\n");
  for (const [id, n] of [...porEmpresa].sort((a, b) => b[1] - a[1])) {
    if (id.indexOf("anon:") === 0) {
      console.log(`  ${id}  ${String(n).padStart(4)} registro(s)   [já anonimizada]`);
      continue;
    }
    const emp = await db.collection("empresas").doc(id).get();
    const nome = emp.exists
      ? ((emp.data() || {}).razaoSocial || "(sem razão social)")
      : "— empresa já excluída —";
    console.log(`  ${id}  ${String(n).padStart(4)} registro(s)   ${nome}`);
  }
  console.log("");
}

async function principal() {
  if (LISTAR) return listar();

  if (!alvo) {
    console.log("\nInforme o id da empresa:\n");
    console.log("  node anonimizar-auditoria.js <empresaId>");
    console.log("  node anonimizar-auditoria.js --listar\n");
    return;
  }

  const empresa = await db.collection("empresas").doc(alvo).get();
  if (empresa.exists && !MESMO_VIVA) {
    console.log("\nEsta empresa AINDA EXISTE: " +
                ((empresa.data() || {}).razaoSocial || alvo));
    console.log("\nAnonimizar a trilha de um cliente ativo deixa você sem histórico");
    console.log("dele sem apagar nada do que é dele de verdade. Exclua pelo painel");
    console.log("primeiro — lá some documento, mensagem, senha e conta de login.");
    console.log("\nSe você tem certeza mesmo assim, repita com --mesmo-viva.\n");
    return;
  }

  const registros = await db.collection("auditoria").where("empresaId", "==", alvo).get();
  if (registros.empty) {
    console.log(`\nNenhum registro em /auditoria para ${alvo}.\n`);
    return;
  }

  console.log(`\n${registros.size} registro(s) de ${alvo}`);
  console.log(`Passam a se chamar ${apelido(alvo)}\n`);

  const porTipo = new Map();
  const camposQueSaem = new Map();
  registros.forEach((doc) => {
    const d = doc.data() || {};
    porTipo.set(d.tipo, (porTipo.get(d.tipo) || 0) + 1);
    oQueSai(d).forEach((c) => camposQueSaem.set(c, (camposQueSaem.get(c) || 0) + 1));
  });

  console.log("  O que continua provado:");
  for (const [tipo, n] of [...porTipo].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(n).padStart(4)} × ${tipo}  (com a hora do servidor e quem agiu)`);
  }

  console.log("\n  O que sai:");
  for (const [campo, n] of camposQueSaem) {
    console.log(`    ${String(n).padStart(4)} × ${campo}`);
  }

  if (!APLICAR) {
    console.log("\nNada foi alterado. Para aplicar:\n");
    console.log(`  node anonimizar-auditoria.js ${alvo} --aplicar\n`);
    return;
  }

  /* Mesma trava das outras ferramentas: repete o que vai fazer e
     dá tempo de o dedo sair do teclado. Aqui não tem volta. */
  console.log("\n>>> APLICANDO em 5 segundos. Ctrl+C para desistir.");
  console.log(">>> O id original não volta do hash.\n");
  await new Promise((r) => setTimeout(r, 5000));

  /* Em lotes: um batch do Firestore aceita 500 operações. */
  let feitos = 0;
  const docs = registros.docs;
  for (let i = 0; i < docs.length; i += 400) {
    const lote = db.batch();
    docs.slice(i, i + 400).forEach((doc) => {
      lote.set(doc.ref, anonimizar(doc.data() || {}));
    });
    await lote.commit();
    feitos += Math.min(400, docs.length - i);
    console.log(`  ${feitos}/${docs.length}`);
  }

  console.log(`\nPronto. ${feitos} registro(s) anonimizado(s).`);
  console.log(`A trilha continua lá, sob ${apelido(alvo)}, provando os fatos`);
  console.log("sem dizer de quem eram.\n");
}

principal().then(
  () => process.exit(0),
  (e) => { console.error("\nErro:", e && e.message ? e.message : e, "\n"); process.exit(1); }
);
