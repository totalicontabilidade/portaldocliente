/* ============================================================
   Totali · Portal do Cliente
   functions/triagem.js — arquivos da contabilidade anterior

   Pedido do Raoni (28/09/2026): a contabilidade anterior manda
   ZIP ou RAR (pelo link sem login, ou por e-mail e a equipe sobe
   no painel). O sistema:
     1. confere o arquivo pelo conteúdo, não pelo nome: programa
        (.exe, .bat, .js, .scr…), página da web e afins são
        bloqueados e apagados; ZIP/RAR com senha ou "bomba"
        (encolhido demais, milhares de arquivos) não é aberto;
     2. extrai ZIP e RAR (e um ZIP dentro de outro), um arquivo por
        vez, sem nunca executar nada;
     3. pelo nome do arquivo e da pasta, manda cada um para o item
        certo da Lista de documentos e marca o item como recebido;
     4. quando não tem certeza (nome genérico, dois itens possíveis,
        mais de um sócio), NÃO chuta: deixa o arquivo "sem destino",
        com sugestões, e avisa a equipe, que escolhe no painel.
   Dispara quando nasce um documento de origem "anterior" (os que
   esta função cria, com extraidoDe, não disparam de novo).
   ============================================================ */
"use strict";

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const { FieldValue, FieldPath } = require("firebase-admin/firestore");
const yauzl = require("yauzl");
const { configuracao, enviar, emailsDaEquipe } = require("./email");

const REGIAO = "southamerica-east1";
const MB = 1024 * 1024;
const LIM = { pacote: 300 * MB, arquivo: 200 * MB, total: 1500 * MB, arquivos: 1500, profundidade: 2, razao: 200 };

/* ---------- 1. Segurança ---------- */
const EXT_BLOQUEADAS = new Set(["exe", "dll", "com", "bat", "cmd", "msi", "msp", "mst", "scr", "pif", "cpl", "vbs", "vbe", "js", "jse", "mjs", "wsf", "wsh", "ws", "ps1", "psm1", "psd1", "hta", "jar", "apk", "app", "sh", "bash", "lnk", "url", "reg", "inf", "iso", "img", "vhd", "vhdx", "dmg", "pkg", "deb", "rpm", "html", "htm", "xhtml", "mht", "mhtml", "shtml", "svgz", "chm", "gadget", "application", "appx", "msix", "xbap", "scf", "ade", "adp", "ins", "isp", "jnlp", "msc", "sct", "shb", "vb", "xll", "xlam", "ppam"]);
const EXT_MACRO = new Set(["docm", "dotm", "xlsm", "xltm", "xlsb", "pptm", "potm", "ppsm"]);
const EXT_OFFICE_ZIP = new Set(["docx", "docm", "dotx", "dotm", "xlsx", "xlsm", "xltx", "xltm", "pptx", "pptm", "ppsx", "potx", "odt", "ods", "odp", "epub", "xps", "oxps"]);
const LIXO = /(^|\/)(__MACOSX\/|\.DS_Store$|Thumbs\.db$|desktop\.ini$|~\$)/i;

function ext(nome) { const m = String(nome || "").toLowerCase().match(/\.([a-z0-9]{1,8})$/); return m ? m[1] : ""; }
function base(caminho) { const p = String(caminho || "").replace(/\\/g, "/").split("/"); return p[p.length - 1] || "arquivo"; }
function pastaDe(caminho) { const p = String(caminho || "").replace(/\\/g, "/").split("/"); p.pop(); return p.filter((x) => x && x !== "." && x !== "..").join(" › "); }
function nomeSeguro(nome) { return String(nome || "arquivo").replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 150) || "arquivo"; }
function nomeStorage(nome) { return nomeSeguro(nome).replace(/[^\w.\-]+/g, "_").slice(0, 120); }

/* O que o arquivo É, pelos primeiros bytes (o nome engana: "nota.pdf.exe", ".exe" renomeado para .pdf) */
function examinar(buf, nome) {
  const e = ext(nome), b = buf || Buffer.alloc(0), h = (n) => b.slice(0, n);
  if (h(2).toString("latin1") === "MZ") return { bloqueio: "programa do Windows disfarçado de documento" };
  if (h(4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))) return { bloqueio: "programa (Linux)" };
  const m4 = h(4).toString("hex");
  if (["feedface", "feedfacf", "cefaedfe", "cffaedfe", "cafebabe"].includes(m4)) return { bloqueio: "programa (Mac/Java)" };
  if (EXT_BLOQUEADAS.has(e)) return { bloqueio: "tipo de arquivo que pode executar código (." + e + ")" };
  if (/^#!/.test(h(2).toString("latin1"))) return { bloqueio: "script executável" };
  const zip = h(4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) || h(4).equals(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (zip && !EXT_OFFICE_ZIP.has(e) && e !== "jar" && e !== "apk") return { pacote: "zip" };
  if (h(6).equals(Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07]))) return { pacote: "rar" };
  if (h(6).equals(Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]))) return { naoAbre: "arquivo 7z: peça em ZIP ou RAR, ou extraia e envie os arquivos" };
  return { alerta: EXT_MACRO.has(e) ? "contém macros: só abra se confiar em quem mandou" : "" };
}

const MIME = { pdf: "application/pdf", xml: "application/xml", txt: "text/plain", csv: "text/csv", ofx: "application/x-ofx", json: "application/json",
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", heic: "image/heic", tif: "image/tiff", tiff: "image/tiff", bmp: "image/bmp",
  doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", odt: "application/vnd.oasis.opendocument.text", ods: "application/vnd.oasis.opendocument.spreadsheet",
  pfx: "application/x-pkcs12", p12: "application/x-pkcs12", zip: "application/zip", rar: "application/vnd.rar",
  mp3: "audio/mpeg", m4a: "audio/mp4", ogg: "audio/ogg", opus: "audio/ogg", wav: "audio/wav", mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", avi: "video/x-msvideo" };
/* svg e demais tipos desconhecidos vão como "baixar" (octet-stream): nunca são exibidos como página */
function mimeDe(nome) { return MIME[ext(nome)] || "application/octet-stream"; }

/* ---------- 2. Para onde vai cada arquivo ---------- */
function norm(t) { return " " + String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim() + " "; }
/* k = chave do item na Lista de documentos (grupo/item; sócio: socios/{sid}/item). Termos sem acento, minúsculos. */
const REGRAS = [
  { k: "societario/contrato-social", doc: "societario", nome: "Contrato social e alterações", termos: ["contrato social", "alteracao contratual", "alteracoes contratuais", "contrato consolidado", "consolidacao contratual", "estatuto social", "requerimento de empresario", "ccmei", "certificado da condicao de microempreendedor", "distrato", "aditivo contratual", "ato constitutivo", "junta comercial", "jucese", "contrato"], nao: ["contrato de trabalho", "contrato de experiencia", "contrato de locacao", "contrato de aluguel", "contrato de prestacao"] },
  { k: "contabil/balancos", doc: "contabil", nome: "Balanços patrimoniais anteriores", termos: ["balanco patrimonial", "balancos patrimoniais", "balanco", "balancos", "bp"] },
  { k: "contabil/dre", doc: "contabil", nome: "DRE de períodos anteriores", termos: ["dre", "demonstracao do resultado", "demonstracao de resultado", "demonstrativo de resultado", "resultado do exercicio"] },
  { k: "contabil/patrimonio", doc: "contabil", nome: "Relatório do patrimônio e depreciação", termos: ["imobilizado", "depreciacao", "controle patrimonial", "relatorio patrimonial", "bens do ativo", "ativo imobilizado"] },
  { k: "fiscal/livros-fiscais", doc: "fiscal", nome: "Livros fiscais", termos: ["livro fiscal", "livros fiscais", "registro de entradas", "registro de saidas", "registro de apuracao", "apuracao do icms", "apuracao icms", "livro de entrada", "livro de entradas", "livro de saida", "livro de saidas", "sped fiscal", "efd icms", "efd icms ipi"] },
  { k: "fiscal/certificado-digital", doc: "certificado", nome: "Certificado digital da empresa (e-CNPJ)", termos: ["certificado digital", "e cnpj", "ecnpj", "certificado a1"] },
  { k: "trabalhista/fichas-funcionarios", doc: "pessoal", nome: "Fichas de registro dos funcionários", termos: ["ficha de registro", "fichas de registro", "ficha registro", "registro de empregado", "registro de empregados", "livro de registro"] },
  { k: "trabalhista/folhas-12m", doc: "pessoal", nome: "Folhas de pagamento dos últimos 12 meses", termos: ["folha de pagamento", "folhas de pagamento", "folha pagamento", "holerite", "holerites", "contracheque", "contracheques", "recibo de pagamento", "resumo da folha", "resumo folha", "folha"] },
  { k: "trabalhista/ferias", doc: "pessoal", nome: "Relação de férias vencidas e a vencer", termos: ["ferias", "aviso de ferias", "relacao de ferias", "programacao de ferias", "ferias vencidas"] },
  { k: "trabalhista/ficha-financeira", doc: "pessoal", nome: "Ficha financeira dos últimos 2 anos", termos: ["ficha financeira", "fichas financeiras"] },
  { k: "trabalhista/informe-rendimentos", doc: "pessoal", nome: "Informe de rendimentos dos colaboradores", termos: ["informe de rendimentos", "informe de rendimento", "informes de rendimentos", "comprovante de rendimentos", "rendimentos pagos"] },
  { k: "trabalhista/extrato-folha", doc: "pessoal", nome: "Extrato analítico da folha (2 últimos meses)", termos: ["extrato analitico", "analitico da folha", "folha analitica", "extrato da folha", "analitico"] },
  { k: "trabalhista/dirf", doc: "pessoal", nome: "Recibo de entrega da DIRF", termos: ["dirf", "recibo dirf"] },
  { k: "socios/*/comprovante-endereco", doc: "socios", socio: true, nome: "Comprovante de endereço", termos: ["comprovante de endereco", "comprovante de residencia", "comprovante endereco", "conta de luz", "conta de agua", "conta de energia"] },
  { k: "socios/*/rg", doc: "socios", socio: true, nome: "Carteira de identidade (RG)", termos: ["rg", "identidade", "carteira de identidade", "cin"] },
  { k: "socios/*/cpf", doc: "socios", socio: true, nome: "CPF", termos: ["cpf"] },
  { k: "socios/*/cnh", doc: "socios", socio: true, nome: "Carteira de motorista (CNH)", termos: ["cnh", "carteira de motorista", "habilitacao", "carteira nacional de habilitacao"] },
  { k: "socios/*/certidao-casamento", doc: "socios", socio: true, nome: "Certidão de casamento", termos: ["certidao de casamento", "casamento"] },
  { k: "socios/*/titulo-eleitor", doc: "socios", socio: true, nome: "Título de eleitor", termos: ["titulo de eleitor", "titulo eleitor", "titulo eleitoral"] },
  { k: "socios/*/ir-socio", doc: "socios", socio: true, nome: "Declaração de Imposto de Renda", termos: ["declaracao de imposto de renda", "imposto de renda pessoa fisica", "irpf", "declaracao irpf", "recibo irpf"] }
];

function pontuar(regra, nome, pasta) {
  if ((regra.nao || []).some((t) => nome.includes(" " + t + " "))) return 0;
  let p = 0;
  for (const t of regra.termos) {
    const peso = 6 + t.split(" ").length * 2;   /* termo de várias palavras vale mais que uma palavra solta */
    if (nome.includes(" " + t + " ")) p = Math.max(p, peso);
    else if (pasta.includes(" " + t + " ")) p = Math.max(p, peso / 2);
  }
  return p;
}
/* Resposta: { k, doc, nome } quando tem certeza; { duvida: { motivo, candidatos: [{k, nome}] } } quando não. */
function classificar(nomeArquivo, pastaArquivo, socios) {
  const e = ext(nomeArquivo);
  if (e === "pfx" || e === "p12") return { k: "fiscal/certificado-digital", doc: "certificado", nome: "Certificado digital da empresa (e-CNPJ)" };
  const nome = norm(nomeArquivo.replace(/\.[^.]+$/, "")), pasta = norm(pastaArquivo);
  const pontos = REGRAS.map((r) => ({ r, p: pontuar(r, nome, pasta) })).filter((x) => x.p > 0).sort((a, b) => b.p - a.p);
  if (!pontos.length) return { duvida: { motivo: "o nome do arquivo não indica o que ele é", candidatos: [] } };
  const top = pontos[0], seg = pontos[1];
  const empate = seg && seg.p >= top.p * 0.8;
  const cand = (x) => x.r.socio ? socios.map((s) => ({ k: x.r.k.replace("*", s.id), nome: x.r.nome + " · " + s.nome })) : [{ k: x.r.k, nome: x.r.nome }];
  if (empate) return { duvida: { motivo: "pode ser mais de um item", candidatos: [].concat(...pontos.slice(0, 3).map(cand)).slice(0, 6) } };
  if (top.r.socio) {
    if (!socios.length) return { duvida: { motivo: "documento de sócio, mas nenhum sócio foi cadastrado na Lista de documentos", candidatos: [] } };
    let s = socios.length === 1 ? socios[0] : null;
    if (!s) {
      const txt = nome + pasta;
      const achados = socios.filter((x) => norm(x.nome).trim().split(" ").filter((w) => w.length >= 3 && !["dos", "das", "de", "da", "do"].includes(w)).some((w) => txt.includes(" " + w + " ")));
      if (achados.length === 1) s = achados[0];
    }
    if (!s) return { duvida: { motivo: "documento de sócio: não deu para saber de qual sócio", candidatos: cand(top) } };
    return { k: top.r.k.replace("*", s.id), doc: top.r.doc, nome: top.r.nome + " · " + s.nome };
  }
  return { k: top.r.k, doc: top.r.doc, nome: top.r.nome };
}

/* ---------- 3. Abrir ZIP e RAR (um arquivo por vez, com limites) ---------- */
function erroPacote(msg) { const e = new Error(msg); e.amigavel = true; return e; }

function lerZip(buf, aoArquivo, conta) {
  return new Promise((res, rej) => {
    yauzl.fromBuffer(buf, { lazyEntries: true, decodeStrings: true, validateEntrySizes: true, strictFileNames: false }, (err, zip) => {
      if (err) return rej(erroPacote("ZIP corrompido ou incompleto"));
      let falhou = false;
      const falhar = (e) => { if (!falhou) { falhou = true; try { zip.close(); } catch (x) { /* nada */ } rej(e); } };
      zip.on("error", falhar);
      zip.on("end", () => { if (!falhou) res(); });
      zip.on("entry", (en) => {
        const caminho = String(en.fileName || "").replace(/\\/g, "/");
        if (/\/$/.test(caminho) || LIXO.test(caminho)) return zip.readEntry();
        if (en.generalPurposeBitFlag & 0x1) { conta.bloqueados.push({ nome: caminho, motivo: "protegido por senha" }); return zip.readEntry(); }
        if (en.uncompressedSize > LIM.arquivo) { conta.bloqueados.push({ nome: caminho, motivo: "maior que 200 MB" }); return zip.readEntry(); }
        if (en.compressedSize > 0 && en.uncompressedSize / en.compressedSize > LIM.razao && en.uncompressedSize > 20 * MB) return falhar(erroPacote("o ZIP parece uma \"bomba\" (encolhido demais); não foi aberto"));
        conta.total += en.uncompressedSize; conta.qtd++;
        if (conta.total > LIM.total || conta.qtd > LIM.arquivos) return falhar(erroPacote("o pacote é grande demais depois de extraído (mais de 1,5 GB ou de 1.500 arquivos)"));
        zip.openReadStream(en, (e2, st) => {
          if (e2) { conta.bloqueados.push({ nome: caminho, motivo: "não deu para ler dentro do ZIP" }); return zip.readEntry(); }
          const partes = []; let n = 0;
          st.on("data", (c) => { n += c.length; if (n > LIM.arquivo) { st.destroy(); } else partes.push(c); });
          st.on("error", () => { conta.bloqueados.push({ nome: caminho, motivo: "arquivo danificado dentro do ZIP" }); zip.readEntry(); });
          st.on("end", () => { Promise.resolve(aoArquivo(caminho, Buffer.concat(partes))).then(() => zip.readEntry(), falhar); });
        });
      });
      zip.readEntry();
    });
  });
}

async function lerRar(buf, aoArquivo, conta) {
  const { createExtractorFromData } = require("node-unrar-js");
  let ex;
  try { ex = await createExtractorFromData({ data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) }); }
  catch (e) { throw erroPacote("RAR corrompido ou incompleto"); }
  let cabecalhos;
  try { cabecalhos = [...ex.getFileList().fileHeaders]; }
  catch (e) { throw erroPacote(/password/i.test(String(e && e.message)) ? "RAR protegido por senha: peça sem senha" : "RAR corrompido ou incompleto"); }
  const aceitos = new Set();
  for (const hd of cabecalhos) {
    const caminho = String(hd.name || "").replace(/\\/g, "/");
    if (hd.flags && hd.flags.directory) continue;
    if (LIXO.test(caminho)) continue;
    if (hd.flags && hd.flags.encrypted) { conta.bloqueados.push({ nome: caminho, motivo: "protegido por senha" }); continue; }
    if (hd.unpSize > LIM.arquivo) { conta.bloqueados.push({ nome: caminho, motivo: "maior que 200 MB" }); continue; }
    conta.total += hd.unpSize || 0; conta.qtd++;
    if (conta.total > LIM.total || conta.qtd > LIM.arquivos) throw erroPacote("o pacote é grande demais depois de extraído (mais de 1,5 GB ou de 1.500 arquivos)");
    aceitos.add(hd.name);
  }
  const saida = ex.extract({ files: (hd) => aceitos.has(hd.name) });
  for (const f of saida.files) {
    if (!f.extraction) { conta.bloqueados.push({ nome: f.fileHeader.name, motivo: "não deu para extrair" }); continue; }
    await aoArquivo(String(f.fileHeader.name).replace(/\\/g, "/"), Buffer.from(f.extraction));
  }
}

/* ---------- 4. A função ---------- */
exports.triarArquivoAnterior = onDocumentCreated({ document: "empresas/{empresaId}/documentos/{docId}", region: REGIAO, memory: "2GiB", timeoutSeconds: 540 }, async (event) => {
  const snap = event.data; if (!snap) return;
  const d = snap.data() || {};
  if (d.origem !== "anterior" || d.extraidoDe || d.triagem) return;
  const db = admin.firestore(), bucket = admin.storage().bucket();
  const { empresaId, docId } = event.params;
  const empRef = db.collection("empresas").doc(empresaId);
  const emp = (await empRef.get()).data() || {};
  const socios = (((emp.entrada || {}).socios) || []).map((s) => ({ id: s.id, nome: s.nome || "sócio" }));
  const conta = { total: 0, qtd: 0, arquivos: 0, organizados: 0, duvidas: 0, bloqueados: [] };
  const destinos = {};                /* chave do item → ids dos documentos */
  const caminho = (d.arquivo || {}).path;
  await snap.ref.update({ triagem: { estado: "organizando", em: Date.now() } });

  /* grava um arquivo extraído como documento próprio, já com destino (ou com a dúvida) */
  async function guardar(caminhoInterno, dados, prof) {
    const nome = nomeSeguro(base(caminhoInterno)), pasta = pastaDe(caminhoInterno);
    const exame = examinar(dados, nome);
    if (exame.bloqueio) { conta.bloqueados.push({ nome: caminhoInterno, motivo: exame.bloqueio }); return; }
    if (exame.pacote && prof < LIM.profundidade) {
      const sub = exame.pacote === "zip" ? lerZip : lerRar;
      return sub(dados, (c, b) => guardar((pasta ? pasta.replace(/ › /g, "/") + "/" : "") + nome.replace(/\.[^.]+$/, "") + "/" + c, b, prof + 1), conta);
    }
    const ref = empRef.collection("documentos").doc();
    const destino = exame.naoAbre ? { duvida: { motivo: exame.naoAbre, candidatos: [] } } : classificar(nome, pasta, socios);
    const path = "empresas/" + empresaId + "/documentos/" + ref.id + "/" + nomeStorage(nome);
    await bucket.file(path).save(dados, { resumable: false, contentType: mimeDe(nome), metadata: { contentDisposition: "attachment", metadata: { extraidoDe: docId } } });
    await ref.set({
      empresaId, nome, grupo: destino.doc || "outros", origem: "anterior", situacao: "enviado", em: FieldValue.serverTimestamp(), por: d.por || "Contabilidade anterior",
      arquivo: { path, nome, tamanho: dados.length, mime: mimeDe(nome) }, revisao: null, vistos: [],
      observacao: ("Do pacote " + (d.nome || "") + (pasta ? " › " + pasta : "")).slice(0, 300),
      item: destino.k || "", extraidoDe: docId, alerta: exame.alerta || "",
      duvidaAberta: !destino.k, duvida: destino.k ? null : destino.duvida
    });
    conta.arquivos++;
    if (destino.k) { conta.organizados++; (destinos[destino.k] = destinos[destino.k] || []).push(ref.id); } else conta.duvidas++;
  }

  try {
    if (!caminho) throw erroPacote("o documento chegou sem arquivo");
    const arq = bucket.file(caminho);
    const [meta] = await arq.getMetadata();
    if (Number(meta.size) > LIM.pacote) throw erroPacote("arquivo acima de 300 MB");
    const [buf] = await arq.download();
    const exame = examinar(buf, (d.arquivo || {}).nome || d.nome);

    if (exame.bloqueio) {
      await arq.delete().catch(() => {});
      await snap.ref.update({ situacao: "bloqueado", bloqueio: exame.bloqueio, "arquivo.path": "", triagem: { estado: "feito", em: Date.now() } });
      conta.bloqueados.push({ nome: d.nome, motivo: exame.bloqueio });
    } else if (exame.pacote) {
      await (exame.pacote === "zip" ? lerZip : lerRar)(buf, (c, b) => guardar(c, b, 1), conta);
      await snap.ref.update({ situacao: "extraido", pacote: true, triagem: { estado: "feito", em: Date.now(), arquivos: conta.arquivos, organizados: conta.organizados, duvidas: conta.duvidas, bloqueados: conta.bloqueados.slice(0, 50) } });
    } else {
      /* arquivo solto: fica onde está e ganha o destino */
      const destino = exame.naoAbre ? { duvida: { motivo: exame.naoAbre, candidatos: [] } } : classificar(d.nome || (d.arquivo || {}).nome || "", "", socios);
      await snap.ref.update({ item: destino.k || "", grupo: destino.doc || d.grupo || "outros", alerta: exame.alerta || "", duvidaAberta: !destino.k, duvida: destino.k ? null : destino.duvida, triagem: { estado: "feito", em: Date.now() } });
      conta.arquivos = 1;
      if (destino.k) { conta.organizados = 1; destinos[destino.k] = [docId]; } else conta.duvidas = 1;
    }

    /* marca os itens da Lista de documentos como recebidos (aprovado continua aprovado) */
    const chaves = Object.keys(destinos);
    if (chaves.length) {
      await db.runTransaction(async (tx) => {
        const s = await tx.get(empRef), itens = (((s.data() || {}).entrada) || {}).itens || {}, args = [];
        for (const k of chaves) {
          const reg = Object.assign({}, itens[k] || {});
          reg.docIds = Array.from(new Set((reg.docIds || []).concat(destinos[k])));
          if (reg.situacao !== "aprovado") { reg.situacao = "enviado"; delete reg.revisao; }
          reg.na = false; reg.em = Date.now(); reg.daAnterior = true;
          args.push(new FieldPath("entrada", "itens", k), reg);
        }
        tx.update(empRef, ...args);
      });
    }
  } catch (e) {
    console.error("triagem falhou", empresaId, docId, e && e.message);
    await snap.ref.update({ triagem: { estado: "erro", em: Date.now(), erro: e && e.amigavel ? e.message : "não foi possível abrir o arquivo", arquivos: conta.arquivos, organizados: conta.organizados, duvidas: conta.duvidas, bloqueados: conta.bloqueados.slice(0, 50) }, duvidaAberta: true, duvida: { motivo: e && e.amigavel ? e.message : "não foi possível abrir o arquivo", candidatos: [] } }).catch(() => {});
    conta.erro = e && e.amigavel ? e.message : "não foi possível abrir o arquivo";
  }

  /* registro e aviso à equipe quando precisa de gente */
  await db.collection("auditoria").add({ empresaId, tipo: "anterior:triagem", detalhe: (d.nome || "") + " · " + conta.arquivos + " arquivo(s), " + conta.organizados + " organizado(s), " + conta.duvidas + " sem destino, " + conta.bloqueados.length + " bloqueado(s)" + (conta.erro ? " · erro: " + conta.erro : ""), por: d.por || "", em: FieldValue.serverTimestamp() });
  if (conta.duvidas || conta.bloqueados.length || conta.erro) {
    try {
      const cfg = await configuracao(db), para = await emailsDaEquipe(db);
      if (cfg && cfg.ligado && para.length) {
        const painel = String(cfg.linkPortal || "").replace(/[^/]*$/, "") + "equipe.html#/clientes/" + empresaId + "/documentos";
        const partes = [];
        if (conta.organizados) partes.push(conta.organizados + " já foram para o item certo da Lista de documentos");
        if (conta.duvidas) partes.push(conta.duvidas + " precisam que a equipe escolha o destino");
        if (conta.bloqueados.length) partes.push(conta.bloqueados.length + " foram bloqueados por segurança (" + conta.bloqueados.slice(0, 3).map((b) => base(b.nome) + ": " + b.motivo).join("; ") + (conta.bloqueados.length > 3 ? "…" : "") + ")");
        if (conta.erro) partes.push("o arquivo não pôde ser aberto: " + conta.erro);
        await enviar(db, cfg, para, "Arquivos da contabilidade anterior: " + (emp.fantasia || "cliente"), {
          titulo: "Chegaram arquivos de " + (emp.fantasia || "um cliente"),
          texto: "Recebemos \"" + (d.nome || "") + "\" (enviado por " + (d.por || "contabilidade anterior") + "). De " + conta.arquivos + " arquivo(s): " + partes.join("; ") + ".",
          botao: "Abrir no painel", link: painel,
          rodape: "Aviso interno do Portal do Cliente para a equipe da Totali."
        }, { tipo: "triagem", empresaId });
      }
    } catch (e) { console.error("aviso da triagem não saiu", e && e.message); }
  }
});

/* para testar a classificação sem subir nada (index.js exporta só a função) */
module.exports.__testes = { classificar, examinar, norm };
