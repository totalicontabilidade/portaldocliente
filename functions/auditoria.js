/* ============================================================
   Totali · Portal de Onboarding
   functions/auditoria.js — item 4: a trilha que vale como prova

   O PROBLEMA QUE ISTO RESOLVE
   ---------------------------
   Existe hoje uma trilha em /empresas/{id}/eventos, e ela é útil
   para acompanhar e depurar. Mas ela é escrita PELO NAVEGADOR, e
   está escrito na própria regra do Firestore que isso não tem
   valor probatório: a regra impede apagar e reescrever, e não
   impede ninguém de INVENTAR um evento.

   Num sistema onde o cliente declara ter entregue um documento e
   a Totali declara tê-lo conferido, isso importa. Se um dia
   alguém perguntar "quando este balanço foi aprovado, e por
   quem", a resposta precisa vir de um registro que nenhum dos
   dois lados podia ter escrito.

   COMO ESTA FUNÇÃO RESOLVE
   ------------------------
   Ela observa as gravações que já acontecem — não pede que nada
   mude no portal nem no painel — e escreve a versão dela em
   /auditoria. Os fatos são deduzidos do ANTES e DEPOIS de cada
   documento, e carimbados com a hora do SERVIDOR.

   A regra do Firestore fecha /auditoria para escrita de todo
   mundo. Nem cliente, nem equipe, nem administrador. Só esta
   função escreve, porque funções rodam com poder de admin e
   passam por cima das regras. Leitura é da equipe.

   O QUE ELA REGISTRA
   ------------------
     item:enviado      chegou arquivo ou valor
     item:removido     o cliente tirou um arquivo
     item:aprovado     a equipe aprovou
     item:correcao     a equipe pediu correção
     item:naEquipe     a equipe disse que se aplica ou não
     credencial:*      senha guardada ou apagada
     acesso:criado     alguém passou a acessar a empresa
     acesso:revogado   alguém deixou de acessar

   O QUE ELA NÃO REGISTRA, DE PROPÓSITO
   ------------------------------------
   Conteúdo. Nunca o texto de uma mensagem, nunca o pacote de uma
   credencial, nunca o arquivo. A trilha guarda O QUE ACONTECEU e
   QUANDO — o conteúdo continua onde já está, protegido pelas
   regras de sempre. Trilha que copia conteúdo vira um segundo
   lugar de onde vazar.
   ============================================================ */
"use strict";

const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { FieldValue } = require("firebase-admin/firestore");
const { getFirestore } = require("firebase-admin/firestore");

const REGIAO = "southamerica-east1";

/* Um registro por fato. `em` é do servidor, e é isso que separa
   esta trilha da outra: ninguém escolhe a hora do próprio ato. */
async function anotar(empresaId, tipo, detalhe) {
  const db = getFirestore();
  await db.collection("auditoria").add({
    empresaId: String(empresaId || ""),
    tipo: String(tipo || ""),
    em: FieldValue.serverTimestamp(),
    ...detalhe
  });
}

function texto(v, max) {
  return typeof v === "string" ? v.slice(0, max || 200) : "";
}

function quantos(v) {
  return Array.isArray(v) ? v.length : 0;
}

/* O id do documento guarda a chave com "~" no lugar de "/",
   porque "/" separa caminho no Firestore. Na trilha vale a forma
   legível: quem for ler isto daqui a dois anos quer ver
   "contabil/dre", não "contabil~dre". */
function chaveLegivel(id) {
  return String(id || "").replace(/~/g, "/");
}

/* ------------------------------------------------------------
   Documentos do checklist
   ------------------------------------------------------------ */
exports.auditarItem = onDocumentWritten(
  { document: "empresas/{empresaId}/itens/{chave}", region: REGIAO },
  async (event) => {
    const { empresaId, chave } = event.params;
    const antes = event.data.before.exists ? event.data.before.data() : null;
    const depois = event.data.after.exists ? event.data.after.data() : null;
    if (!depois) return;                       /* exclusão: a empresa toda saiu */

    /* QUEM MEXEU, quando quem mexeu foi o cliente.

       Um gatilho do Firestore não recebe o usuário que gravou, e
       por isso "item:enviado" e "item:removido" nasciam sem autor:
       a trilha sabia que um documento saiu, não quem o tirou. Numa
       empresa com mais de uma pessoa no portal, é justamente essa
       a pergunta que se faz depois.

       O portal passa a assinar o registro, e a regra do Firestore
       exige que o `porUid` seja o uid de quem está gravando — não
       é declaração, é assinatura. O nome vem junto só para a
       trilha ser legível sem consultar a lista de acessos.

       Registros gravados antes disso não têm os campos, e seguem
       na trilha sem autor: inventar um seria pior que admitir que
       não se sabe.

       Fica FORA do `base` de propósito: aprovar e definir "se
       aplica" são atos da equipe, e esses eventos já dizem quem
       foi pelo `revisao.por`. Carimbar neles o uid do cliente
       daria um registro que se contradiz — assinado por um, feito
       por outro. */
    const base = { chave: chaveLegivel(chave) };
    const assinatura = {};
    const quem = texto(depois.porUid, 60);
    if (quem) {
      assinatura.uid = quem;
      assinatura.por = texto(depois.porNome, 120);
    }

    /* Arquivos: quantos entraram, quantos saíram. Os nomes vão
       junto porque é o que identifica o documento numa conferência
       depois — mas o conteúdo, nunca. */
    const nAntes = quantos(antes && antes.arquivos);
    const nDepois = quantos(depois.arquivos);
    if (nDepois > nAntes) {
      const novos = (depois.arquivos || []).slice(nAntes);
      await anotar(empresaId, "item:enviado", {
        ...base, ...assinatura,
        arquivos: novos.map((a) => texto(a && a.nome, 160)),
        total: nDepois
      });
    } else if (nDepois < nAntes) {
      await anotar(empresaId, "item:removido", { ...base, ...assinatura, total: nDepois });
    }

    /* Valor digitado (número de inscrição, por exemplo). */
    const vAntes = texto(antes && antes.valor, 400);
    const vDepois = texto(depois.valor, 400);
    if (vDepois && vDepois !== vAntes) {
      await anotar(empresaId, "item:valor", { ...base, ...assinatura, valor: vDepois });
    }

    /* Revisão da equipe. É o fato mais importante da trilha: é
       aqui que a Totali diz que aceitou um documento. */
    const rAntes = (antes && antes.revisao) || {};
    const rDepois = depois.revisao || {};
    if (rDepois.status && rDepois.status !== rAntes.status) {
      const tipos = {
        aprovado: "item:aprovado",
        pendencia: "item:correcao",
        analise: "item:analise"
      };
      await anotar(empresaId, tipos[rDepois.status] || "item:revisao", {
        ...base,
        por: texto(rDepois.por, 120),
        motivo: texto(rDepois.motivo, 600)
      });
    }

    /* A equipe definindo se o documento se aplica à empresa. */
    if (antes === null || antes.naEquipe !== depois.naEquipe) {
      if (typeof depois.naEquipe === "boolean") {
        await anotar(empresaId, "item:naEquipe", { ...base, seAplica: !depois.naEquipe });
      } else if (antes && typeof antes.naEquipe === "boolean") {
        await anotar(empresaId, "item:naEquipe", { ...base, seAplica: null });
      }
    }
  }
);

/* ------------------------------------------------------------
   Credenciais — o fato, nunca o conteúdo
   ------------------------------------------------------------ */
exports.auditarCredencial = onDocumentWritten(
  { document: "empresas/{empresaId}/credenciais/{chave}", region: REGIAO },
  async (event) => {
    const { empresaId, chave } = event.params;
    const existiaAntes = event.data.before.exists;
    const existeDepois = event.data.after.exists;

    if (!existiaAntes && existeDepois) {
      const d = event.data.after.data() || {};
      await anotar(empresaId, "credencial:guardada", {
        chave: chaveLegivel(chave),
        campos: Array.isArray(d.campos) ? d.campos.map((c) => texto(c, 60)) : []
      });
    } else if (existiaAntes && !existeDepois) {
      await anotar(empresaId, "credencial:apagada", { chave: chaveLegivel(chave) });
    }
  }
);

/* ------------------------------------------------------------
   Quem entra e quem deixa de entrar
   ------------------------------------------------------------ */
exports.auditarAcesso = onDocumentWritten(
  { document: "empresas/{empresaId}/acessos/{uid}", region: REGIAO },
  async (event) => {
    const { empresaId, uid } = event.params;
    const existiaAntes = event.data.before.exists;
    const existeDepois = event.data.after.exists;

    if (!existiaAntes && existeDepois) {
      const d = event.data.after.data() || {};
      await anotar(empresaId, "acesso:criado", {
        uid: texto(uid, 128),
        /* Como o acesso nasceu: por convite aberto pelo próprio
           cliente, ou dado pela equipe no painel. */
        origem: d.porEquipe ? "equipe" : "convite",
        porEquipe: texto(d.porEquipe, 128)
      });
    } else if (existiaAntes && !existeDepois) {
      await anotar(empresaId, "acesso:revogado", { uid: texto(uid, 128) });
    }
  }
);
