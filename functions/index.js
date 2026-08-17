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
   mão. Por isso a operação acontece aqui, no servidor, onde o
   segredo nunca é exposto.

   O resultado prático de não ter isto: contas órfãs se acumulam
   no Authentication. Elas não abrem nada — sem `acessos/{uid}` a
   regra do Firestore nega tudo —, mas continuam existindo,
   aparecendo na lista e sendo cobradas.

   COMO PUBLICAR
   -------------
   Precisa de Node.js instalado (não há Node nesta máquina hoje).
   Na pasta do projeto:

       npm install -g firebase-tools
       firebase login
       cd functions && npm install && cd ..
       firebase deploy --only functions

   Enquanto não for publicada, o painel continua funcionando: ele
   detecta a ausência, avisa quais contas ficaram e mostra o
   caminho para apagá-las no console. Nada quebra.

   QUEM PODE CHAMAR
   ----------------
   Só administrador — e a conferência é feita AQUI, lendo
   /usuarios/{uid} do Firestore. Nunca no que o navegador manda:
   quem chama a função escolhe o corpo do pedido, não o próprio
   crachá.
   ============================================================ */
"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();

const REGIAO = "southamerica-east1";
const LIMITE = 20;

/* Quem pediu é administrador de verdade? */
async function exigirAdmin(auth) {
  if (!auth || !auth.uid) {
    throw new HttpsError("unauthenticated", "Entre no painel antes.");
  }
  const doc = await admin.firestore().collection("usuarios").doc(auth.uid).get();
  if (!doc.exists || (doc.data() || {}).papel !== "admin") {
    throw new HttpsError("permission-denied", "Só administrador pode excluir contas de acesso.");
  }
  return auth.uid;
}

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

exports.excluirAcessoDoCliente = onCall({ region: REGIAO }, async (request) => {
  const quemPediu = await exigirAdmin(request.auth);

  const brutos = (request.data && request.data.uids) || [];
  if (!Array.isArray(brutos) || !brutos.length) {
    throw new HttpsError("invalid-argument", "Informe ao menos uma conta.");
  }
  if (brutos.length > LIMITE) {
    throw new HttpsError("invalid-argument", `No máximo ${LIMITE} contas por vez.`);
  }

  const uids = brutos
    .filter((u) => typeof u === "string" && u.length > 0 && u.length <= 128)
    /* Ninguém apaga a própria conta por aqui: seria um jeito de
       um admin se trancar para fora sem querer. */
    .filter((u) => u !== quemPediu);

  const apagadas = [];
  const recusadas = [];

  for (const uid of uids) {
    /* Trava que importa: se o uid tem documento em /usuarios, ele
       é da EQUIPE, não de cliente. Excluir uma empresa nunca pode
       derrubar o acesso de quem trabalha na Totali — e um uid
       trocado no pedido não vira acidente. */
    const daEquipe = await admin.firestore().collection("usuarios").doc(uid).get();
    if (daEquipe.exists) {
      recusadas.push({ uid, motivo: "conta da equipe" });
      continue;
    }

    /* Ainda cuida de alguma outra empresa? Então não é órfã.
       É comum o mesmo dono ter dois ou três CNPJs no mesmo login;
       apagar a conta ao encerrar UM deles derrubaria o cliente
       dos outros. Vale conferir os dois lugares: a lista nova
       (clientes/{uid}/empresas) e o vínculo antigo, de uma
       empresa só (campo empresaId). */
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

  return { apagadas, recusadas };
});
