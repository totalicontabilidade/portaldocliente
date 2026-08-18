/* ============================================================
   Totali · Portal de Onboarding
   functions/index.js — a única coisa que o navegador não pode fazer

   POR QUE ISTO EXISTE
   -------------------
   Excluir uma empresa pelo painel apaga tudo o que é do Firestore
   e do Storage: documentos, sócios, mensagens, senhas guardadas,
   vínculos e convites. Só uma coisa fica para trás — a CONTA DE
   LOGIN do cliente, lá no Firebase Authentication.

   E ela fica porque tem que ficar: apagar a conta de outra pessoa
   exige poder de administrador do projeto, e esse poder não pode
   morar dentro de uma página web. Se morasse, qualquer um que
   abrisse o código-fonte da página teria a chave do projeto na
   mão. Por isso a operação acontece aqui, no servidor.

   POR QUE É GATILHO DO FIRESTORE, E NÃO FUNÇÃO CHAMÁVEL
   -----------------------------------------------------
   A primeira versão era uma função `onCall`, chamada por HTTPS.
   Ela chegou a ser publicada e não funcionou: função de 2ª geração
   roda sobre Cloud Run, e o Cloud Run recusava a chamada por falta
   de permissão de invocação. Liberar exigiria conceder acesso a
   `allUsers`, e a política da organização da Totali proíbe isso —
   com razão, aliás.

   A saída foi inverter o sentido. Em vez de o navegador CHAMAR o
   servidor, ele GRAVA UM PEDIDO numa coleção, e esta função reage
   à gravação. Ficou melhor em três pontos:

     • não existe endereço público — nada para descobrir ou atacar;
     • quem pode pedir é decidido pelas regras do Firestore, que já
       são a barreira de segurança do sistema inteiro;
     • some o CORS, que foi o que quebrou a versão anterior.

   O pedido fica registrado com quem pediu, quando, e o que
   aconteceu — o que também serve de trilha de auditoria.

   COMO PUBLICAR
   -------------
       firebase deploy --only functions

   QUEM PODE PEDIR
   ---------------
   Só administrador. A regra do Firestore permite criar o pedido
   apenas a quem tem `papel: "admin"` em /usuarios, e esta função
   confere de novo, aqui dentro. Duas vezes de propósito: a regra
   pode ser republicada errada um dia, e apagar conta de gente é
   irreversível.
   ============================================================ */
"use strict";

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

admin.initializeApp();

const REGIAO = "southamerica-east1";
const LIMITE = 20;

/* Ainda cuida de alguma outra empresa? Então a conta não é órfã.

   É comum o mesmo dono ter dois ou três CNPJs no mesmo login;
   apagar a conta ao encerrar UM deles derrubaria o cliente dos
   outros. Confere os dois lugares: a lista nova
   (clientes/{uid}/empresas) e o vínculo antigo, de uma empresa só
   (campo empresaId). */
async function aindaTemEmpresa(uid) {
  const db = admin.firestore();

  const lista = await db.collection("clientes").doc(uid)
    .collection("empresas").limit(1).get();
  if (!lista.empty) return true;

  const antigo = await db.collection("clientes").doc(uid).get();
  const empresaId = antigo.exists ? (antigo.data() || {}).empresaId : "";
  if (!empresaId) return false;

  /* O vínculo antigo pode apontar para empresa que já não existe.
     Nesse caso ele não segura nada. */
  const empresa = await db.collection("empresas").doc(empresaId).get();
  return empresa.exists;
}

exports.processarExclusaoDeConta = onDocumentCreated(
  { document: "exclusoesDeConta/{pedidoId}", region: REGIAO },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const pedido = snap.data() || {};
    const apagadas = [];
    const recusadas = [];

    const encerrar = (erro) =>
      snap.ref.set({
        concluidoEm: admin.firestore.FieldValue.serverTimestamp(),
        apagadas,
        recusadas,
        erro: erro || ""
      }, { merge: true });

    /* Confere o crachá de novo, aqui dentro. */
    const quemPediu = String(pedido.pedidoPor || "");
    if (!quemPediu) return encerrar("pedido sem autor");

    const autor = await admin.firestore().collection("usuarios").doc(quemPediu).get();
    if (!autor.exists || (autor.data() || {}).papel !== "admin") {
      return encerrar("quem pediu não é administrador");
    }

    const brutos = Array.isArray(pedido.uids) ? pedido.uids : [];
    if (!brutos.length) return encerrar("nenhuma conta informada");
    if (brutos.length > LIMITE) return encerrar(`no máximo ${LIMITE} contas por vez`);

    const uids = brutos
      .filter((u) => typeof u === "string" && u.length > 0 && u.length <= 128)
      /* Ninguém apaga a própria conta por aqui: seria um jeito de
         um admin se trancar para fora sem querer. */
      .filter((u) => u !== quemPediu);

    for (const uid of uids) {
      /* Trava que importa: se o uid tem documento em /usuarios, ele
         é da EQUIPE, não de cliente. Excluir uma empresa nunca pode
         derrubar o acesso de quem trabalha na Totali. */
      const daEquipe = await admin.firestore().collection("usuarios").doc(uid).get();
      if (daEquipe.exists) {
        recusadas.push({ uid, motivo: "conta da equipe" });
        continue;
      }

      if (await aindaTemEmpresa(uid)) {
        recusadas.push({ uid, motivo: "ainda tem acesso a outra empresa" });
        continue;
      }

      try {
        await admin.auth().deleteUser(uid);
        apagadas.push(uid);
      } catch (e) {
        /* Conta que já não existe conta como resolvida: o objetivo
           é não sobrar nada, e não sobrou. */
        if (e && e.code === "auth/user-not-found") apagadas.push(uid);
        else recusadas.push({ uid, motivo: (e && e.message) || "erro ao apagar" });
      }
    }

    return encerrar("");
  }
);
