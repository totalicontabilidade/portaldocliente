/* ============================================================
   Totali · Portal de Onboarding
   functions/senhas.js — a equipe abre a senha sem ter a chave

   O QUE MUDOU, E POR QUÊ
   ----------------------
   Antes, abrir uma senha de maquininha exigia o arquivo da chave
   privada. Na prática isso queria dizer: uma pessoa só conseguia,
   e ela precisava achar um `.json` no computador dela.

   O Raoni apontou o problema real: essas senhas são de LEITURA DE
   RELATÓRIO, não de movimentar dinheiro, e a equipe inteira
   precisa delas no dia a dia. Segurança que atrapalha é
   contornada — alguém tira print da senha e manda no WhatsApp, e
   aí ela está num lugar muito pior que o banco de dados.

   Agora a chave privada mora no Secret Manager, e esta função
   abre sob demanda para quem estiver logado como equipe.

   POR QUE NÃO É UMA FUNÇÃO CHAMÁVEL (onCall)
   ------------------------------------------
   Já tentamos, no começo do projeto: função de 2ª geração roda
   sobre Cloud Run, e liberar a chamada exigiria conceder acesso a
   `allUsers` — proibido pela política da organização da Totali.
   O caminho que funciona aqui é o mesmo da exclusão de conta: o
   painel GRAVA UM PEDIDO e a função reage à gravação.

   O DETALHE QUE FAZ ISTO VALER A PENA
   -----------------------------------
   A resposta NÃO volta em texto puro. O painel manda, junto com o
   pedido, uma chave pública descartável que ele acabou de gerar
   na memória daquela aba. A função abre o envelope da Totali e
   RECIFRA com essa chave descartável.

   Ou seja: no Firestore, nem o pedido nem a resposta têm senha
   legível. Só aquela aba, naquele momento, consegue abrir a
   resposta. Se um dia uma regra for escrita errada — e neste
   projeto isso já aconteceu uma vez — o que vaza é envelope.

   E TODA ABERTURA FICA REGISTRADA
   -------------------------------
   Um registro em /auditoria por senha aberta: quem, de qual
   cliente, qual credencial, quando. É o que torna o acesso amplo
   defensável em vez de descuidado — e é uma coisa que o desenho
   antigo, com o arquivo de chave, não tinha.

   COMO A CHAVE CHEGA AQUI
   -----------------------
   Secret Manager, segredo `chave-privada-credenciais`, contendo o
   JWK da chave privada. Ver o LEIAME de ferramentas/ para o
   comando de subida.
   ============================================================ */
"use strict";

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { abrirEnvelope, fecharPara } = require("./envelope");

const REGIAO = "southamerica-east1";
const SEGREDO = "chave-privada-credenciais";

/* A chave é lida uma vez por instância e fica na memória dela.
   Buscar no Secret Manager a cada pedido custaria uma chamada de
   rede por senha aberta, sem ganho nenhum de segurança. */
let chaveCache = null;

async function chavePrivada() {
  if (chaveCache) return chaveCache;
  const { SecretManagerServiceClient } = require("@google-cloud/secret-manager");
  const cliente = new SecretManagerServiceClient();
  const projeto = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
  const [versao] = await cliente.accessSecretVersion({
    name: `projects/${projeto}/secrets/${SEGREDO}/versions/latest`
  });
  chaveCache = JSON.parse(versao.payload.data.toString("utf8"));
  return chaveCache;
}

exports.abrirCredencial = onDocumentCreated(
  { document: "pedidosDeSenha/{pedidoId}", region: REGIAO },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const pedido = snap.data() || {};
    const db = getFirestore();

    const responder = (dados) =>
      snap.ref.set({ ...dados, concluidoEm: FieldValue.serverTimestamp() }, { merge: true });

    /* Confere o crachá aqui dentro também. A regra do Firestore já
       exige equipe, mas ela pode ser republicada errada um dia — e
       isto aqui abre senha de cliente. */
    const quem = String(pedido.pedidoPor || "");
    if (!quem) return responder({ erro: "pedido sem autor" });

    const autor = await db.collection("usuarios").doc(quem).get();
    if (!autor.exists) return responder({ erro: "quem pediu não é da equipe" });

    const empresaId = String(pedido.empresaId || "");
    const chave = String(pedido.chave || "");
    if (!empresaId || !chave) return responder({ erro: "pedido incompleto" });
    if (!pedido.chavePublica || typeof pedido.chavePublica !== "object") {
      return responder({ erro: "pedido sem chave de resposta" });
    }

    const doc = await db.collection("empresas").doc(empresaId)
                        .collection("credenciais").doc(chave).get();
    if (!doc.exists) return responder({ erro: "credencial não encontrada" });

    const pacote = (doc.data() || {}).pacote;
    if (!pacote || !pacote.dados) return responder({ erro: "credencial vazia" });

    let conteudo;
    try {
      conteudo = abrirEnvelope(pacote, await chavePrivada());
    } catch (e) {
      console.error("falha ao abrir credencial", empresaId, chave, e && e.message);
      return responder({ erro: "não foi possível abrir esta credencial" });
    }

    let resposta;
    try {
      resposta = fecharPara(conteudo, pedido.chavePublica);
    } catch (e) {
      return responder({ erro: "não foi possível preparar a resposta" });
    }

    await responder({ resposta: resposta, erro: "" });

    /* O registro é o preço do acesso amplo: a equipe inteira pode
       abrir, e toda abertura tem nome e hora. */
    await db.collection("auditoria").add({
      empresaId: empresaId,
      tipo: "credencial:aberta",
      chave: chave.replace(/~/g, "/"),
      por: (autor.data() || {}).nome || (autor.data() || {}).email || quem,
      uid: quem,
      em: FieldValue.serverTimestamp()
    });

    await varrerPedidosVelhos(db);
  }
);

/* LIMPEZA DOS PEDIDOS JÁ ATENDIDOS.

   Cada pedido guarda a resposta recifrada, e a regra do Firestore
   proíbe apagar — nem equipe nem admin conseguem, de propósito, para
   ninguém adulterar o rastro. Resultado: os pedidos se acumulavam
   para sempre, um por clique em "Ver senha".

   Não é vazamento: a resposta é fechada com uma chave descartável
   que existiu só naquela aba e morreu com ela, então o documento
   velho é ruído ilegível. Mas ruído que cresce sem parar é problema
   de qualquer jeito, e guardar cifra sem motivo é o oposto do que
   este sistema promete.

   Quem apaga é a própria função, que roda com poder de administrador
   e passa por cima da regra. Assim a limpeza não depende de ninguém
   lembrar de abrir o console. A trilha de quem abriu o quê continua
   inteira em /auditoria, que é onde ela deve estar. */
const VALIDADE_PEDIDO_MS = 15 * 60 * 1000;

async function varrerPedidosVelhos(db) {
  try {
    const limite = new Date(Date.now() - VALIDADE_PEDIDO_MS);
    const velhos = await db.collection("pedidosDeSenha")
      .where("em", "<", limite).limit(200).get();
    if (velhos.empty) return;
    const lote = db.batch();
    velhos.forEach((d) => lote.delete(d.ref));
    await lote.commit();
  } catch (e) {
    /* Falhar aqui não pode derrubar a abertura da senha, que já deu
       certo e é o que a pessoa está esperando. */
    console.error("nao foi possivel varrer pedidos velhos", e && e.message);
  }
}
