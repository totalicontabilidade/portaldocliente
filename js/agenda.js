/* ============================================================
   Totali · Portal do Cliente
   agenda.js — calendário de obrigações do mês

   Vencimentos calculados por regime e perfil da empresa (com ou
   sem funcionários). Prazos reais, como gatilho legítimo (pesquisa
   tema 1, item 7: aversão à perda só com fato verdadeiro).
   A lista é editável pela equipe em Conteúdo › Agenda
   (conteudo/agenda); o padrão abaixo é a reserva.

   Cada obrigação: { id, nome, dia, regimes[] ("*" = todos),
   soComFuncionarios, regra, desc }. Fim de semana: tributo federal vai
   para o dia útil seguinte (posterga); salário e envio de documentos
   vão para o anterior (antecipa). A equipe ajusta no editor.
   ============================================================ */
(function (global) {
  "use strict";
  var U = global.U, UI = global.UI, ic = global.ic, Dados = global.Dados, Shell = global.Shell;

  var PADRAO = [
    { id: "das", nome: "DAS · Simples Nacional", dia: 20, regimes: ["Simples Nacional", "MEI"], desc: "Guia única do Simples. A Totali envia pelo portal até o dia 15." },
    { id: "fgts", nome: "FGTS Digital", dia: 20, regimes: ["*"], soComFuncionarios: true, desc: "Depósito do FGTS dos funcionários." },
    { id: "inss", nome: "INSS / DCTFWeb", dia: 20, regimes: ["Lucro Presumido", "Lucro Real"], soComFuncionarios: true, desc: "Contribuição previdenciária (DARF da DCTFWeb)." },
    { id: "esocial-folha", nome: "eSocial · folha", dia: 15, regimes: ["*"], soComFuncionarios: true, desc: "Fechamento da folha do mês anterior. Envie alterações até o dia 5." },
    { id: "pis-cofins", nome: "PIS e COFINS", dia: 25, regimes: ["Lucro Presumido", "Lucro Real"], desc: "DARFs federais sobre o faturamento." },
    { id: "irpj-csll", nome: "IRPJ e CSLL (trimestral)", dia: 30, regimes: ["Lucro Presumido", "Lucro Real"], meses: [1, 4, 7, 10], desc: "Apuração trimestral. Vence no último dia útil do mês seguinte ao trimestre." },
    { id: "iss", nome: "ISS", dia: 10, regimes: ["Lucro Presumido", "Lucro Real"], desc: "Imposto sobre serviços (prefeitura). Confira o dia do seu município." },
    { id: "icms", nome: "ICMS", dia: 9, regimes: ["Lucro Presumido", "Lucro Real"], desc: "Imposto estadual sobre mercadorias (Sergipe: dia 9)." },
    { id: "salarios", nome: "Salários", dia: 5, regimes: ["*"], soComFuncionarios: true, regra: "antecipa", desc: "Pagamento dos funcionários (até o 5º dia útil)." },
    { id: "docs-mes", nome: "Documentos do mês para a Totali", dia: 8, regimes: ["*"], regra: "antecipa", desc: "Extratos, notas e relatórios das maquininhas no Envio do mês." },
    { id: "pro-labore", nome: "Pró-labore e INSS dos sócios", dia: 20, regimes: ["*"], desc: "Retirada dos sócios e a contribuição sobre ela." }
  ];
  var LISTA = PADRAO.slice();
  function aplicar(bruto) { if (!bruto || !Array.isArray(bruto.itens) || !bruto.itens.length) return false; LISTA = bruto.itens.map(function (i) { return { id: U.txt(i.id, 30), nome: U.txt(i.nome, 80), dia: Math.min(31, Math.max(1, Number(i.dia) || 1)), regimes: Array.isArray(i.regimes) && i.regimes.length ? i.regimes : ["*"], soComFuncionarios: !!i.soComFuncionarios, regra: i.regra === "antecipa" ? "antecipa" : "posterga", meses: Array.isArray(i.meses) ? i.meses : null, desc: U.txt(i.desc, 200) }; }).filter(function (i) { return i.id && i.nome; }); return true; }

  /* Tributo federal que cai em fim de semana vai para o dia útil SEGUINTE (regra geral da Receita);
     salários e obrigações "antecipa" vão para o dia útil ANTERIOR. */
  function diaUtil(ano, mes, dia, regra) { var d = new Date(ano, mes, Math.min(dia, new Date(ano, mes + 1, 0).getDate())); var passo = regra === "antecipa" ? -1 : 1; while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + passo); return d; }
  function proximas(e, dias) {
    var hoje = new Date(); hoje.setHours(0, 0, 0, 0); var out = [];
    var comFunc = (e.perfis || []).indexOf("com-funcionarios") > -1;
    for (var m = 0; m < 2; m++) {
      var ref = new Date(hoje.getFullYear(), hoje.getMonth() + m, 1);
      LISTA.forEach(function (o) {
        if (!(o.regimes.indexOf("*") > -1 || o.regimes.indexOf(e.regime) > -1)) return;
        if (o.soComFuncionarios && !comFunc) return;
        if (o.meses && o.meses.indexOf(ref.getMonth() + 1) === -1) return;
        var v = diaUtil(ref.getFullYear(), ref.getMonth(), o.dia, o.regra);
        var em = U.diasEntre(hoje, v);
        if (em < -3 || (dias && em > dias)) return;
        out.push({ o: o, vence: v.getTime(), em: em });
      });
    }
    return out.sort(function (a, b) { return a.vence - b.vence; });
  }
  /* O que a pessoa faz com cada vencimento (teste de usabilidade, 24/09/2026: a agenda só listava datas) */
  function acaoDe(o) {
    if (o.id === "docs-mes") return { href: "#/checklist", rotulo: "Abrir envio do mês" };
    if (o.id === "esocial-folha") return { href: "#/documentos?grupo=pessoal&item=folha", rotulo: "Enviar alterações" };
    if (o.id === "salarios") return null;
    return { href: "#/documentos?grupo=mensal&item=impostos", rotulo: "Enviar comprovante" };
  }
  function itemHtml(x) {
    var tom = x.em < 0 ? "erro" : x.em <= 3 ? "aviso" : x.em <= 7 ? "gold" : "";
    var rot = x.em < 0 ? "venceu há " + (-x.em) + "d" : x.em === 0 ? "vence hoje" : x.em === 1 ? "vence amanhã" : "vence em " + x.em + " dias";
    return '<div class="lista__item" style="min-height:0;padding:10px 16px"><div class="dia__d" style="width:40px;height:40px;font-size:12px;border-color:var(--' + (tom === "erro" ? "danger" : tom === "aviso" ? "warning" : tom === "gold" ? "gold" : "border") + ')">' + new Date(x.vence).getDate() + '</div><div class="lista__texto"><span class="lista__titulo">' + U.esc(x.o.nome) + '</span><span class="lista__sub">' + U.esc(x.o.desc) + "</span></div>" + UI.badge(rot, tom === "gold" ? "gold" : tom, x.em <= 3 ? "clock" : "") + "</div>";
  }
  function itemComAcao(x) {
    var a = acaoDe(x.o), h = itemHtml(x);
    if (!a) return h;
    return h.replace(/<\/div>$/, '<a class="btn btn--xs btn--contorno" href="' + a.href + '" style="margin-left:8px;white-space:nowrap">' + ic("upload", "ic--sm") + a.rotulo + "</a></div>");
  }
  function telaAgenda() {
    var e = global.Portal.empresa; Shell.titulo("Agenda do mês");
    var lista = proximas(e, 60);
    var porMes = U.agrupar(lista, function (x) { return U.anoMes(x.vence); });
    Shell.render('<div class="pagina"><div class="cabecalho"><div><div class="cabecalho__kicker">' + U.esc(e.regime) + "</div><h1>Agenda de obrigações</h1><p>Os vencimentos da sua empresa nos próximos 60 dias. A Totali cuida da apuração; você acompanha e paga em dia.</p></div></div>" +
      Object.keys(porMes).map(function (am) { var p = am.split("-"); return '<div class="card"><div class="card__cab"><h2>' + ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"][Number(p[1]) - 1] + " de " + p[0] + '</h2></div><div class="lista" style="padding-top:6px">' + porMes[am].map(itemComAcao).join("") + "</div></div>"; }).join("") +
      '<div class="aviso aviso--info">' + ic("info") + "<div><b>Datas de referência.</b>Alguns prazos mudam por município ou por decisão do governo. Quando isso acontecer, avisamos pelo chat.</div></div></div>");
  }
  global.InicioExtras = global.InicioExtras || [];
  global.InicioExtras.push(function () {
    var e = global.Portal.empresa, lista = proximas(e, 30);
    if (!lista.length) return null;
    var urgente = lista.filter(function (x) { return x.em >= 0 && x.em <= 3; })[0];
    return {
      hoje: urgente ? '<a class="card card--clicavel card--hoje entra" href="#/agenda" style="text-decoration:none;color:inherit;--tom:var(--warning);border-left:4px solid var(--warning)"><div class="card__corpo" style="display:flex;gap:14px;align-items:center"><span class="selo-sistema" style="background:var(--warning-soft);color:var(--warning)">' + ic("calendar") + '</span><div style="flex:1;min-width:0"><div class="f-12 f-800 txt-2" style="letter-spacing:.08em;text-transform:uppercase">Hoje</div><div class="f-15 f-800">' + U.esc(urgente.o.nome) + " " + (urgente.em === 0 ? "vence hoje" : urgente.em === 1 ? "vence amanhã" : "vence em " + urgente.em + " dias") + '</div><div class="f-13 txt-2">' + U.esc(urgente.o.desc) + '</div></div><span class="btn btn--sm btn--primario so-desktop">Ver agenda</span>' + ic("chevron-right", "so-mobile") + "</div></a>" : null,
      coluna: '<div class="card"><div class="card__cab"><h2>Próximos vencimentos</h2><a class="btn btn--xs btn--contorno" href="#/agenda">Agenda</a></div><div class="lista" style="padding-top:6px">' + lista.slice(0, 4).map(itemHtml).join("") + "</div></div>"
    };
  });
  global.TelasPortal = global.TelasPortal || {}; global.TelasPortal.agenda = telaAgenda;
  global.Agenda = { PADRAO: PADRAO, lista: function () { return LISTA; }, aplicar: aplicar, proximas: proximas };
})(window);
