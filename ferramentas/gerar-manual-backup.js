/* Gera o manual de backup em PDF usando o jsPDF que ja esta
   vendorizado no projeto.

   ARMADILHA CONHECIDA DO jsPDF: ele escreve em Latin-1. Caractere
   acima de 255 sai como quadradinho preto no PDF - travessao,
   reticencias como um caractere so, e aspas curvas viram lixo.

   ACENTO NAO E O PROBLEMA. Todo acento do portugues (a e i o u com
   agudo, crase, circunflexo, til, e o c cedilha) cabe em Latin-1 e
   sai perfeito. A primeira versao deste manual saiu inteira sem
   acento porque eu confundi as duas coisas; ficou parecendo texto
   mal escrito. Escreva portugues correto e evite so a pontuacao
   tipografica: hifen simples no lugar do travessao, tres pontos
   separados no lugar das reticencias, aspas retas.

   A checagem no fim varre o ARQUIVO INTEIRO, comentarios inclusive.
   E de proposito: e mais facil manter a regra "nada acima de 255
   neste arquivo" do que rastrear quais strings acabam no PDF. */
"use strict";

const fs = require("fs");
const path = require("path");

/* A raiz do projeto e a pasta acima desta. Assim o script roda de
   qualquer maquina, sem caminho fixo. */
const RAIZ = path.join(__dirname, "..");
/* O UMD entrega pelo module.exports quando roda no Node, e pelo
   window.jspdf quando roda no navegador. Aceito os dois. */
const mod = require(path.join(RAIZ, "lib", "jspdf.umd.min.js"));
const jsPDF = (mod && mod.jsPDF) || (globalThis.jspdf && globalThis.jspdf.jsPDF);
if (!jsPDF) { console.error("nao achei o jsPDF; chaves: " + Object.keys(mod || {})); process.exit(1); }

const doc = new jsPDF({ unit: "pt", format: "a4" });
doc.setProperties({
  title: "Backup do Portal do Cliente",
  subject: "Como os dados estao protegidos e como recuperar",
  author: "Totali Solucoes Contabeis",
  creator: "Totali Solucoes Contabeis"
});
const L = 56;                 /* margem esquerda */
const DIR = 539;              /* limite direito */
const LARG = DIR - L;
let y = 0;

const TINTA = [26, 38, 52];
const CINZA = [110, 125, 140];
const DOURADO = [150, 120, 40];
const FUNDO_CODIGO = [244, 246, 249];

function novaPagina() {
  doc.addPage();
  y = 64;
}
function espaco(n) { y += n; }
function cabe(n) { if (y + n > 780) novaPagina(); }

function titulo(t) {
  cabe(46);
  doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(...TINTA);
  doc.text(t, L, y);
  y += 8;
  doc.setDrawColor(...DOURADO).setLineWidth(1.4);
  doc.line(L, y, L + 46, y);
  y += 20;
}

function subtitulo(t) {
  cabe(30);
  doc.setFont("helvetica", "bold").setFontSize(11.5).setTextColor(...TINTA);
  doc.text(t, L, y);
  y += 16;
}

function paragrafo(t, opcoes) {
  const o = opcoes || {};
  doc.setFont("helvetica", o.negrito ? "bold" : "normal").setFontSize(10);
  doc.setTextColor(...(o.cinza ? CINZA : TINTA));
  const linhas = doc.splitTextToSize(t, LARG - (o.recuo || 0));
  cabe(linhas.length * 14 + 6);
  doc.text(linhas, L + (o.recuo || 0), y);
  y += linhas.length * 14 + 6;
}

function passo(n, t) {
  doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...DOURADO);
  const linhas = doc.splitTextToSize(t, LARG - 24);
  cabe(linhas.length * 14 + 8);
  doc.text(String(n) + ".", L, y);
  doc.setFont("helvetica", "normal").setTextColor(...TINTA);
  doc.text(linhas, L + 20, y);
  y += linhas.length * 14 + 8;
}

function codigo(linhas) {
  const arr = Array.isArray(linhas) ? linhas : [linhas];
  const quebradas = [];
  doc.setFont("courier", "normal").setFontSize(8.4);
  arr.forEach((l) => {
    doc.splitTextToSize(l, LARG - 22).forEach((x) => quebradas.push(x));
  });
  const alt = quebradas.length * 11 + 16;
  cabe(alt + 8);
  doc.setFillColor(...FUNDO_CODIGO);
  doc.roundedRect(L, y - 10, LARG, alt, 4, 4, "F");
  doc.setTextColor(30, 45, 62);
  let yy = y + 3;
  quebradas.forEach((l) => { doc.text(l, L + 11, yy); yy += 11; });
  y += alt + 6;
}

function aviso(t) {
  doc.setFont("helvetica", "normal").setFontSize(9.6).setTextColor(...TINTA);
  const linhas = doc.splitTextToSize(t, LARG - 26);
  const alt = linhas.length * 13 + 18;
  cabe(alt + 8);
  doc.setFillColor(253, 248, 235);
  doc.roundedRect(L, y - 11, LARG, alt, 4, 4, "F");
  doc.setFillColor(...DOURADO);
  doc.rect(L, y - 11, 3, alt, "F");
  doc.text(linhas, L + 14, y + 2);
  y += alt + 6;
}

function tabela(cabecalho, linhas) {
  const colA = 250;
  cabe(linhas.length * 20 + 34);
  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...CINZA);
  doc.text(cabecalho[0], L, y);
  doc.text(cabecalho[1], L + colA, y);
  y += 6;
  doc.setDrawColor(215, 222, 232).setLineWidth(0.7);
  doc.line(L, y, DIR, y);
  y += 14;
  doc.setFontSize(9.6);
  linhas.forEach((r) => {
    doc.setFont("helvetica", "normal").setTextColor(...TINTA);
    const a = doc.splitTextToSize(r[0], colA - 12);
    const b = doc.splitTextToSize(r[1], LARG - colA);
    const alt = Math.max(a.length, b.length) * 12 + 8;
    cabe(alt);
    doc.text(a, L, y);
    doc.text(b, L + colA, y);
    y += alt;
    doc.setDrawColor(238, 242, 246);
    doc.line(L, y - 6, DIR, y - 6);
  });
  y += 6;
}

/* ============================ CAPA ============================ */
doc.setFillColor(13, 25, 38);
doc.rect(0, 0, 595, 232, "F");

doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(194, 162, 80);
doc.text("TOTALI SOLUÇÕES CONTÁBEIS", L, 84);
doc.setFontSize(25).setTextColor(255, 255, 255);
doc.text("Backup do Portal", L, 122);
doc.text("do Cliente", L, 150);
doc.setFont("helvetica", "normal").setFontSize(11).setTextColor(178, 196, 215);
doc.text("Como os dados estão protegidos e como recuperar", L, 180);

y = 272;
paragrafo(
  "Este documento é o que deve ser seguido no dia em que algo for apagado por engano. " +
  "Ele descreve o que está protegido, como conferir que continua ligado, e o passo a passo " +
  "da recuperação, que foi testado de ponta a ponta em 25 de agosto de 2026 apagando uma " +
  "empresa de verdade e trazendo-a de volta.");

espaco(4);
aviso("Leia a seção 'Como recuperar' ANTES de precisar dela. Ela tem um passo manual " +
      "que existe de propósito, e pular esse passo desfaz trabalho legítimo.");

espaco(10);
paragrafo("Projeto Firebase: portaldocliente-8cc7d   |   Região: southamerica-east1", { cinza: true });
paragrafo("Documento gerado em 25 de agosto de 2026.", { cinza: true });

/* ==================== O QUE ESTA PROTEGIDO ==================== */
novaPagina();
titulo("1. O que está protegido");

paragrafo(
  "São cinco proteções, e elas cobrem coisas diferentes. Ter uma não substitui a outra.");
espaco(6);

tabela(["Proteção", "Do que protege"], [
  ["Recuperação em ponto no tempo (PITR)",
   "Exclusão ou alteração acidental. Permite voltar o banco a qualquer minuto dos últimos 7 dias."],
  ["Backup diário (14 semanas)",
   "Estrago percebido tarde. Guarda uma cópia por dia, por 98 dias."],
  ["Versionamento do Storage",
   "Arquivo apagado ou sobrescrito. Guarda a versão anterior de cada arquivo."],
  ["Limpeza aos 90 dias",
   "Custo. Apaga versões antigas de arquivo depois de 90 dias."],
  ["Proteção contra exclusão do banco",
   "Alguém apagar o Firestore inteiro de uma vez."]
]);

espaco(8);
aviso("O backup do Firestore NÃO cobre os arquivos. Os documentos que os clientes enviam e " +
      "os áudios da Academy vivem no Storage, e quem protege esses é o VERSIONAMENTO. " +
      "É o erro mais comum: configurar só o backup do banco e achar que está tudo coberto.");

espaco(10);
subtitulo("Qual usar em cada caso");
paragrafo(
  "PITR, quando o estrago foi HOJE ou nos últimos dias e você sabe mais ou menos a hora. " +
  "É o caso comum: alguém apagou um cliente de manhã e percebeu à tarde.");
paragrafo(
  "Backup diário, quando o estrago é antigo e passou dos 7 dias do PITR. Você perde o que " +
  "aconteceu entre a cópia da noite e o estrago, mas recupera o resto.");
paragrafo(
  "Versionamento, quando o que sumiu foi um ARQUIVO. Não depende dos outros dois e se " +
  "resolve pelo console do Storage, olhando as versões antigas do objeto.");

/* ================= CONFERIR SE ESTA LIGADO =================== */
novaPagina();
titulo("2. Conferir se continua tudo ligado");

paragrafo(
  "Vale rodar de tempos em tempos, e obrigatoriamente depois de qualquer mudança grande no " +
  "projeto. Todos os comandos são no Cloud Shell e nenhum altera nada, só mostram.");
espaco(6);

subtitulo("Recuperação em ponto no tempo");
codigo("gcloud firestore databases describe --database='(default)' \\\n" +
       "  --project=portaldocliente-8cc7d \\\n" +
       "  --format=\"default(pointInTimeRecoveryEnablement,deleteProtectionState)\"");
paragrafo("Espere POINT_IN_TIME_RECOVERY_ENABLED e DELETE_PROTECTION_ENABLED.", { cinza: true });

subtitulo("Backup diário");
codigo("gcloud firestore backups schedules list --database='(default)' \\\n" +
       "  --project=portaldocliente-8cc7d");
paragrafo("O campo retention deve ser 8467200s, que são 14 semanas. Se estiver 604800s " +
          "(7 dias), está duplicando a janela do PITR sem estender nada.", { cinza: true });

subtitulo("Versionamento e limpeza dos arquivos");
codigo("gcloud storage buckets describe \\\n" +
       "  gs://portaldocliente-8cc7d.firebasestorage.app \\\n" +
       "  --format=yaml | grep -iE -A6 \"versioning|lifecycle\"");
paragrafo("Espere versioning_enabled: true e uma regra com daysSinceNoncurrentTime: 90.", { cinza: true });

espaco(6);
aviso("Os campos chamam-se versioning_enabled e lifecycle_config. Se você pedir " +
      "'versioning' ou 'lifecycle' no --format, o comando responde null e parece que nada " +
      "foi configurado. Já aconteceu.");

/* ==================== COMO RECUPERAR ========================= */
novaPagina();
titulo("3. Como recuperar, o procedimento");

aviso("NUNCA restaure por cima do banco que está no ar. Isso traria o dado perdido de volta " +
      "E DESFARIA tudo o que aconteceu depois do estrago: documentos enviados, mensagens, " +
      "aprovações. Restaurar sempre cria um banco NOVO, e de lá se copia o que falta.");

espaco(8);
paragrafo("A ideia em uma frase: tirar uma foto do banco como ele era antes do estrago, " +
          "abrir essa foto num banco separado, copiar de lá o que se perdeu, e apagar o " +
          "banco separado.");
espaco(8);

passo(1, "Descubra a hora do estrago. Você precisa de um MINUTO EXATO em que o dado ainda " +
         "existia. Se não souber, chute para trás com folga: meia hora antes resolve, e o " +
         "que importa é estar dentro dos 7 dias do PITR.");

passo(2, "Exporte o banco daquele minuto. Troque a data e a hora pelo minuto escolhido, " +
         "sempre em UTC (que é a hora de Brasília mais 3 horas):");
codigo("gcloud firestore export \\\n" +
       "  gs://portaldocliente-8cc7d.firebasestorage.app/recuperacao \\\n" +
       "  --snapshot-time=2026-08-25T18:58:00Z \\\n" +
       "  --project=portaldocliente-8cc7d");

paragrafo("Os segundos precisam ser 00. Com qualquer outro valor o comando recusa com " +
          "'must be an exact minute'.", { cinza: true });

passo(3, "Espere terminar. Repita até aparecer done: true.");
codigo("gcloud firestore operations list --project=portaldocliente-8cc7d --limit=1");

passo(4, "Crie um banco temporário, vazio. Ele não encosta no que está no ar.");
codigo("gcloud firestore databases create --database=recuperacao \\\n" +
       "  --location=southamerica-east1 --type=firestore-native \\\n" +
       "  --project=portaldocliente-8cc7d");

passo(5, "Importe a foto para dentro dele. O caminho é o MESMO da exportação, sem " +
         "acrescentar subpasta nenhuma.");
codigo("gcloud firestore import \\\n" +
       "  gs://portaldocliente-8cc7d.firebasestorage.app/recuperacao \\\n" +
       "  --database=recuperacao --project=portaldocliente-8cc7d");

passo(6, "Abra o console do Firestore, troque o banco de (default) para recuperacao, e " +
         "encontre o que se perdeu. Ele estará lá, como estava naquele minuto.");

passo(7, "Copie à mão para o banco que está no ar. Este passo é manual DE PROPÓSITO: é ele " +
         "que traz de volta o que sumiu sem desfazer o que aconteceu depois.");

passo(8, "Apague o banco temporário e os arquivos da exportação. O banco temporário NÃO " +
         "entra na cota gratuita, só o (default) entra.");
codigo(["gcloud firestore databases delete --database=recuperacao \\",
        "  --project=portaldocliente-8cc7d",
        "",
        "gcloud storage rm -r \\",
        "  gs://portaldocliente-8cc7d.firebasestorage.app/recuperacao"]);

/* =================== ARQUIVO PERDIDO ========================= */
novaPagina();
titulo("4. Quando o que sumiu foi um arquivo");

paragrafo(
  "Documento de cliente e áudio da Academy vivem no Storage, não no banco. O procedimento " +
  "acima não traz esses de volta: quem traz é o versionamento, e o caminho é bem mais curto.");
espaco(6);

passo(1, "Liste as versões do arquivo, incluindo as que foram apagadas ou substituídas:");
codigo("gcloud storage ls -a \\\n" +
       "  gs://portaldocliente-8cc7d.firebasestorage.app/empresas/ID_DA_EMPRESA/documentos/");

passo(2, "Cada versão antiga aparece com um número depois de #. Copie a que você quer de " +
         "volta para o lugar dela:");
codigo("gcloud storage cp \\\n" +
       "  \"gs://.../arquivo#1787684837033957\" \\\n" +
       "  \"gs://.../arquivo\"");

espaco(6);
aviso("As versões antigas duram 90 dias. Passado esse prazo elas somem de vez, por causa da " +
      "regra de limpeza, que existe para o custo não crescer sem parar.");

/* ==================== O QUE NAO ESTA COBERTO ================= */
espaco(14);
titulo("5. O que NÃO está coberto");

paragrafo("Vale saber onde a rede de segurança termina.");
espaco(4);

tabela(["Não coberto", "O que fazer"], [
  ["Contas de login (Authentication)",
   "Não entram no backup do Firestore. Se uma conta for apagada, o cliente cria acesso de novo pelo link de convite."],
  ["Chave privada das senhas",
   "Vive no Secret Manager. Perde-se ela, perdem-se todas as senhas já enviadas. Não há recuperação, por construção."],
  ["Conteúdo publicado do portal",
   "Está no Firestore e entra no backup. O arquivo js/conteudo.js no repositório serve de reserva."],
  ["O código do sistema",
   "Está no GitHub. O backup do Firebase não guarda código."]
]);

/* ========================= RODAPE ============================ */
const total = doc.internal.getNumberOfPages();
for (let i = 1; i <= total; i++) {
  doc.setPage(i);
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...CINZA);
  if (i > 1) {
    doc.text("Backup do Portal do Cliente | Totali Soluções Contábeis", L, 812);
    doc.text(String(i) + " de " + String(total), DIR, 812, { align: "right" });
  }
}

/* Trava contra a armadilha do Latin-1: se algum caractere fora da
   tabela escapou, e melhor falhar aqui do que entregar um PDF com
   quadradinhos pretos no meio do texto. */
const fonte = fs.readFileSync(__filename, "utf8");
const foraDaFaixa = [...fonte].filter((c) => c.charCodeAt(0) > 255);
if (foraDaFaixa.length) {
  console.error("Caracteres fora do Latin-1 encontrados: " +
                [...new Set(foraDaFaixa)].join(" "));
  process.exit(1);
}

const saida = path.join(RAIZ, "Backup do Portal do Cliente.pdf");
fs.writeFileSync(saida, Buffer.from(doc.output("arraybuffer")));
console.log("gerado: " + saida);
console.log("paginas: " + total);
