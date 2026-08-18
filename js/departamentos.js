/* ============================================================
   Totali · Portal de Onboarding
   departamentos.js — de que setor cada pessoa cuida

   POR QUE EXISTE
   --------------
   Quem cuida do Departamento Pessoal não precisa ver, todo dia,
   os balanços que a contabilidade está conferindo. Com cinco
   setores e um punhado de clientes, a fila de trabalho de cada
   pessoa some dentro da fila de todo mundo.

   O QUE ISTO É, E O QUE NÃO É
   ---------------------------
   É um FILTRO e um AVISO. Não é permissão.

   A diferença importa e foi decisão do Raoni: a pessoa PODE
   mexer em documento de outro setor — só não deve fazer isso sem
   perceber. Num escritório pequeno, alguém cobre o colega de
   férias na sexta à tarde, e um sistema que trancasse isso seria
   contornado por um login compartilhado no mesmo dia. O que se
   quer evitar é o clique distraído, não o acesso.

   Por isso NÃO existe regra de servidor por departamento: ela
   diria uma coisa que o sistema não cumpre. Quem pode conferir
   documento é a equipe, e continua sendo.

   LISTA VAZIA = TODOS OS SETORES
   ------------------------------
   Ninguém estava cadastrado com departamento quando isto foi
   escrito. Se lista vazia significasse "nenhum setor", o painel
   inteiro esvaziaria para todo mundo na hora da publicação.
   Vazio quer dizer "cuida de tudo" — que também é a verdade num
   escritório onde a mesma pessoa faz fiscal e contábil.
   ============================================================ */
(function (global) {
  "use strict";

  /* Os setores são os próprios grupos do checklist, e não uma
     lista à parte. Lista à parte sairia do lugar no dia em que a
     equipe criasse um departamento novo pela aba Conteúdo. */
  function todos() {
    return (global.DATA && global.DATA.GRUPOS ? global.DATA.GRUPOS : []).map(function (g) {
      return { id: g.id, titulo: g.titulo, icone: g.icone };
    });
  }

  function meus(equipe) {
    if (!equipe) return [];
    return Array.isArray(equipe.departamentos) ? equipe.departamentos : [];
  }

  /* Vê tudo quem não tem setor definido. */
  function veTudo(equipe) {
    return meus(equipe).length === 0;
  }

  function cuida(equipe, grupoId) {
    if (veTudo(equipe)) return true;
    return meus(equipe).indexOf(String(grupoId)) > -1;
  }

  /* O grupo a que uma chave de documento pertence.
     "socios/{id}/rg" e "fiscal/livros" dão "socios" e "fiscal". */
  function grupoDaChave(chave) {
    return String(chave || "").split("/")[0];
  }

  function cuidaDaChave(equipe, chave) {
    return cuida(equipe, grupoDaChave(chave));
  }

  function tituloDe(grupoId) {
    var achado = todos().filter(function (g) { return g.id === grupoId; })[0];
    return achado ? achado.titulo : grupoId;
  }

  function nomesDos(ids) {
    return (ids || []).map(tituloDe).join(", ");
  }

  global.Departamentos = {
    todos: todos,
    meus: meus,
    veTudo: veTudo,
    cuida: cuida,
    cuidaDaChave: cuidaDaChave,
    grupoDaChave: grupoDaChave,
    tituloDe: tituloDe,
    nomesDos: nomesDos
  };
})(window);
