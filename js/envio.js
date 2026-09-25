/* ============================================================
   Totali · Portal do Cliente
   envio.js — Envio do mês (antes "Checklist do mês")

   O que o cliente manda todo mês: extratos, notas, maquininhas,
   folha, comprovantes. Regras (decisão do Raoni, 22/09/2026):
     • a lista e os prazos vêm de conteudo/envio (Painel › Conteúdo
       › Envio do mês); sem nada publicado vale o PADRAO abaixo;
     • cada empresa só vê o que vale para ela: "folha" só com
       funcionários, "maquininhas" só quem respondeu que tem no
       Checklist Financeiro; a lista do mês é reconciliada na hora;
     • anexar um arquivo em Meus arquivos dizendo "é o item X" marca
       o item sozinho (Envio.marcar);
     • meses passados congelam: só o mês corrente é reconciliado.
   O registro continua em empresas/{id}/checklist/{anoMes} (a rota
   e o nome interno "checklist" não mudam; só o nome para o cliente).
   ============================================================ */
(function (global) {
  "use strict";
  var U = global.U;

  var PADRAO = [
    { id: "extratos", texto: "Extratos bancários de todas as contas", prazoDia: 5, grupo: "mensal", so: "banco" },
    { id: "notas-venda", texto: "Notas fiscais de venda (XML ou relatório)", prazoDia: 8, grupo: "mensal", so: "todos" },
    { id: "notas-compra", texto: "Notas de compra e despesas", prazoDia: 8, grupo: "mensal", so: "todos" },
    { id: "maquininhas", texto: "Relatório das maquininhas", prazoDia: 8, grupo: "mensal", so: "maquininhas" },
    { id: "folha", texto: "Alterações na folha (admissão, férias, faltas)", prazoDia: 10, grupo: "pessoal", so: "funcionarios" },
    { id: "impostos", texto: "Comprovantes dos impostos pagos", prazoDia: 20, grupo: "mensal", so: "todos" }
  ];
  var CONDICOES = [["todos", "Todas as empresas"], ["banco", "Só quem tem conta em banco"], ["maquininhas", "Só quem tem maquininha"], ["funcionarios", "Só quem tem funcionários"]];
  var GRUPOS = [["mensal", "Documentos do mês"], ["pessoal", "Departamento pessoal"], ["fiscal", "Fiscal"], ["contabil", "Contábil"]];
  var TOLERANCIA_DIAS = 2;
  var ITENS = PADRAO.map(function (i) { return U.clonar(i); });

  function sanear(i) {
    var texto = U.txt(i && i.texto, 120);
    var id = U.slug(String((i && i.id) || texto || "")).slice(0, 40);
    var dia = Number(i && i.prazoDia); if (!(dia >= 1 && dia <= 28)) dia = 20;
    var grupo = GRUPOS.some(function (g) { return g[0] === (i && i.grupo); }) ? i.grupo : "mensal";
    var so = CONDICOES.some(function (c) { return c[0] === (i && i.so); }) ? i.so : "todos";
    return { id: id, texto: texto, prazoDia: dia, grupo: grupo, so: so };
  }
  /* O que a equipe publicou em conteudo/envio */
  function aplicar(c) {
    if (!c || !Array.isArray(c.itens) || !c.itens.length) return;
    var vistos = {};
    ITENS = c.itens.map(sanear).filter(function (i) { if (!i.id || !i.texto || vistos[i.id]) return false; vistos[i.id] = true; return true; });
    if (!ITENS.length) ITENS = PADRAO.map(function (i) { return U.clonar(i); });
  }

  function seAplica(item, empresa) {
    var e = empresa || {};
    if (item.so === "funcionarios") return (e.perfis || []).indexOf("com-funcionarios") > -1;
    if (item.so === "maquininhas" || item.so === "banco") {
      var f = global.Financeiro ? global.Financeiro.estado(e) : (e.financeiro || {});
      if (item.so === "maquininhas") return f.temMaquineta === true;
      return f.temBanco !== false;   /* sem resposta ainda: assume que tem banco */
    }
    return true;
  }
  function itensPara(empresa) { return ITENS.filter(function (i) { return seAplica(i, empresa); }); }
  function novo(i) { return { id: i.id, texto: i.texto, prazoDia: i.prazoDia, grupo: i.grupo, feito: false, feitoEm: 0, aceite: null }; }

  /* A lista do mês para esta empresa: aplica a publicação atual sobre o que já foi salvo.
     Item feito que saiu da lista continua (não se apaga trabalho do cliente). */
  function mes(empresa, salvo, anoMes) {
    anoMes = anoMes || U.anoMes(Date.now());
    var antigos = (salvo && salvo.itens) || [];
    var itens;
    if (salvo && anoMes !== U.anoMes(Date.now())) itens = antigos;
    else {
      var porId = {}; antigos.forEach(function (a) { porId[a.id] = a; });
      /* prazo que venceu antes de a empresa entrar na Totali não é cobrado (quem entra dia 25 não começa atrasado) */
      var inicio = U.ms(empresa.aceiteEm) || U.ms(empresa.criadaEm) || 0;
      var base = itensPara(empresa).filter(function (i) { return (porId[i.id] && porId[i.id].feito) || prazoMs(anoMes, i.prazoDia) >= inicio; });
      itens = base.map(function (i) { return porId[i.id] ? Object.assign({}, porId[i.id], { texto: i.texto, prazoDia: i.prazoDia, grupo: i.grupo }) : novo(i); });
      antigos.forEach(function (a) { if (a.feito && !base.some(function (b) { return b.id === a.id; })) itens.push(a); });
    }
    return { empresaId: empresa.id, anoMes: anoMes, itens: itens, concluidoEm: (salvo && salvo.concluidoEm) || 0, atualizadoEm: (salvo && salvo.atualizadoEm) || 0, salvo: !!salvo };
  }
  function prazoMs(anoMes, dia) { var p = anoMes.split("-"); return new Date(Number(p[0]), Number(p[1]) - 1, dia, 23, 59, 59).getTime(); }
  /* dias até o prazo (negativo = passou); feito devolve null */
  function diasParaPrazo(it, anoMes) { if (it.feito) return null; return Math.ceil((prazoMs(anoMes, it.prazoDia) - Date.now()) / U.DIA_MS); }
  function atrasado(it, anoMes) { var d = diasParaPrazo(it, anoMes); return d !== null && d < -TOLERANCIA_DIAS; }
  function resumo(c) {
    var feitos = c.itens.filter(function (i) { return i.feito; }).length;
    var atrasados = c.itens.filter(function (i) { return atrasado(i, c.anoMes); });
    var proximos = c.itens.filter(function (i) { var d = diasParaPrazo(i, c.anoMes); return d !== null && d >= 0 && d <= 2; });
    return { feitos: feitos, total: c.itens.length, faltam: c.itens.length - feitos, pct: U.pct(feitos, c.itens.length || 1), atrasados: atrasados, proximos: proximos, completo: c.itens.length > 0 && feitos === c.itens.length };
  }

  /* Marca um item porque o cliente anexou o documento. Devolve { check, mudou, completou }. */
  function marcar(empresa, anoMes, itemId, origem) {
    return global.Dados.checklist(empresa.id, anoMes).then(function (salvo) {
      var c = mes(empresa, salvo, anoMes);
      var it = c.itens.filter(function (x) { return x.id === itemId; })[0];
      if (!it || it.feito) return { check: c, mudou: false, completou: false };
      it.feito = true; it.feitoEm = Date.now(); it.aceite = null; it.origem = origem || "documento";
      var completou = c.itens.every(function (x) { return x.feito; });
      return global.Dados.salvarChecklist(empresa.id, anoMes, { itens: c.itens }).then(function () { return { check: c, mudou: true, completou: completou }; });
    });
  }

  global.Envio = {
    PADRAO: PADRAO, CONDICOES: CONDICOES, GRUPOS: GRUPOS, TOLERANCIA_DIAS: TOLERANCIA_DIAS,
    get ITENS() { return ITENS; },
    aplicar: aplicar, sanear: sanear, itensPara: itensPara, seAplica: seAplica, mes: mes, resumo: resumo, marcar: marcar,
    prazoMs: prazoMs, diasParaPrazo: diasParaPrazo, atrasado: atrasado
  };
})(window);
