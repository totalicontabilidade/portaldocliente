/* ============================================================
   Totali · Portal do Cliente
   pdf.js — ficha, dossiê e termo em PDF (jsPDF vendorizado)

   Trazido do Academy (ficha-pdf.js, dossie-pdf.js, termo.js),
   reescrito de forma enxuta. A biblioteca (lib/jspdf.umd.min.js,
   357 KB) só é carregada quando alguém pede um PDF.

   Ficha:  retrato de agora, para levar à visita ou anexar.
   Dossiê: registro de como a empresa entrou (o que chegou, quando,
           quem aprovou, o que foi dispensado). Vai para a pasta.
   Termo:  compromisso de envio dos relatórios das maquininhas,
           gerado no aparelho do cliente e guardado como documento.
   Senhas NUNCA saem daqui: o PDF diz quantas credenciais há, não o conteúdo.
   ============================================================ */
(function (global) {
  "use strict";
  var U = global.U, UI = global.UI;
  var NAVY = [24, 44, 67], OURO = [200, 157, 87], TINTA = [30, 41, 59], CINZA = [91, 107, 127];
  function carregar() {
    if (global.jspdf && global.jspdf.jsPDF) return Promise.resolve(global.jspdf.jsPDF);
    return new Promise(function (res, rej) { var s = document.createElement("script"); s.src = "lib/jspdf.umd.min.js"; s.onload = function () { global.jspdf && global.jspdf.jsPDF ? res(global.jspdf.jsPDF) : rej(new Error("jsPDF não carregou")); }; s.onerror = function () { rej(new Error("jsPDF não carregou")); }; document.head.appendChild(s); });
  }
  function novo(J) { var d = new J({ unit: "mm", format: "a4" }); d.setFont("helvetica"); return d; }
  function cabecalho(d, titulo, sub) {
    d.setFillColor.apply(d, NAVY); d.rect(0, 0, 210, 26, "F");
    d.setTextColor(255, 255, 255); d.setFontSize(16); d.setFont("helvetica", "bold"); d.text("Totali", 14, 12);
    d.setFontSize(9); d.setFont("helvetica", "normal"); d.text("Soluções Contábeis", 14, 17);
    d.setTextColor.apply(d, OURO); d.setFontSize(12); d.setFont("helvetica", "bold"); d.text(titulo, 196, 12, { align: "right" });
    d.setTextColor(200, 210, 224); d.setFontSize(9); d.setFont("helvetica", "normal"); d.text(sub, 196, 17, { align: "right" });
    d.setTextColor.apply(d, TINTA);
    return 34;
  }
  function rodape(d) { var n = d.getNumberOfPages(); for (var i = 1; i <= n; i++) { d.setPage(i); d.setFontSize(8); d.setTextColor.apply(d, CINZA); d.text("Gerado em " + U.dataHora(Date.now()) + " · Portal do Cliente Totali · página " + i + " de " + n, 105, 290, { align: "center" }); } }
  function linha(d, y) { if (y > 275) { d.addPage(); return 20; } return y; }
  function paragrafo(d, texto, y, tam, larg) { d.setFontSize(tam || 10); var ls = d.splitTextToSize(texto, larg || 182); ls.forEach(function (l) { y = linha(d, y); d.text(l, 14, y); y += (tam || 10) * 0.45; }); return y + 2; }
  function titulo(d, t, y) { y = linha(d, y); d.setFont("helvetica", "bold"); d.setFontSize(12); d.setTextColor.apply(d, NAVY); d.text(t, 14, y); d.setDrawColor.apply(d, OURO); d.setLineWidth(0.6); d.line(14, y + 1.5, 60, y + 1.5); d.setTextColor.apply(d, TINTA); d.setFont("helvetica", "normal"); return y + 8; }
  function blocoEmpresa(d, e, y) { d.setFont("helvetica", "bold"); d.setFontSize(13); d.text(e.fantasia || e.nome, 14, y); d.setFont("helvetica", "normal"); d.setFontSize(9); d.setTextColor.apply(d, CINZA); d.text((e.nome || "") + " · CNPJ " + (e.cnpj || "") + " · " + (e.regime || "") + (e.gerenteNome ? " · gerente: " + e.gerenteNome : ""), 14, y + 5); d.setTextColor.apply(d, TINTA); return y + 14; }
  var ROT = { pendente: "pendente", enviado: "enviado", analise: "em análise", aprovado: "aprovado", pendencia: "correção pedida", na: "não se aplica", substituido: "atendido pela CNH" };

  function ficha(e, en, GRUPOS, docs) {
    carregar().then(function (J) {
      var d = novo(J), y = cabecalho(d, "Ficha do cliente", U.data(Date.now()));
      y = blocoEmpresa(d, e, y);
      var O = global.Onboarding, prog = O ? O.progresso({ entrada: en }) : { feitos: 0, total: 0, pct: 0 };
      y = paragrafo(d, "Entrada: " + prog.feitos + " de " + prog.total + " itens (" + prog.pct + "%). Senhas guardadas no cofre não constam deste documento.", y, 10);
      GRUPOS.forEach(function (g) {
        y = titulo(d, g.titulo + (en.gruposNA && en.gruposNA[g.id] ? " · não se aplica" : ""), y);
        if (en.gruposNA && en.gruposNA[g.id]) return;
        var alvos = g.escopo === "socio" ? (en.socios || []) : [null];
        if (g.escopo === "socio" && !alvos.length) { y = paragrafo(d, "Nenhum sócio cadastrado.", y, 9); return; }
        alvos.forEach(function (s) {
          if (s) { y = linha(d, y); d.setFont("helvetica", "bold"); d.setFontSize(10); d.text(s.nome + (s.cpf ? "  CPF " + s.cpf : ""), 14, y); d.setFont("helvetica", "normal"); y += 5; }
          g.itens.forEach(function (it) {
            var sit = O ? O.situacao({ itens: en.itens || {}, gruposNA: en.gruposNA || {}, socios: en.socios || [] }, g, it, s ? s.id : null) : "pendente";
            var reg = ((en.itens || {})[O ? O.chave(g, it, s ? s.id : null) : ""]) || {};
            y = linha(d, y); d.setFontSize(9);
            d.setFillColor.apply(d, sit === "aprovado" || sit === "substituido" ? [204, 251, 241] : sit === "pendencia" ? [254, 226, 226] : sit === "na" ? [241, 244, 248] : sit === "pendente" ? [255, 255, 255] : [219, 234, 254]);
            d.roundedRect(14, y - 3.5, 182, 6, 1, 1, "F");
            d.text((it.obrigatorio ? "* " : "") + it.nome, 16, y); d.text(ROT[sit] || sit, 150, y); d.setTextColor.apply(d, CINZA); d.text(reg.em ? U.data(reg.em) : "", 178, y); d.setTextColor.apply(d, TINTA);
            y += 7;
          });
        });
      });
      y = titulo(d, "Documentos no portal", y);
      (docs || []).slice(0, 60).forEach(function (doc) { y = linha(d, y); d.setFontSize(9); d.text(doc.nome + " · " + (doc.origem === "anterior" ? "contab. anterior" : doc.origem) + " · " + (ROT[doc.situacao] || doc.situacao), 16, y); d.setTextColor.apply(d, CINZA); d.text(U.data(doc.em), 178, y); d.setTextColor.apply(d, TINTA); y += 5.5; });
      rodape(d); d.save("ficha-" + U.slug(e.fantasia) + ".pdf");
    }).catch(function (err) { UI.toast(err.message, "erro"); });
  }

  function dossie(e, en, GRUPOS, docs) {
    carregar().then(function (J) {
      var d = novo(J), y = cabecalho(d, "Dossiê de entrada", "Registro de como a empresa entrou na Totali");
      y = blocoEmpresa(d, e, y);
      y = paragrafo(d, "Este dossiê registra o que a Totali recebeu na entrada da empresa, em que data cada item chegou, quem conferiu e aprovou, e o que ficou combinado como não aplicável. Foi gerado a partir dos registros do portal, com as datas e os nomes de quem realizou cada ação. Senhas e credenciais não constam: ficam cifradas no cofre, e cada abertura é registrada na auditoria.", y, 9.5);
      y = paragrafo(d, "Aceite da proposta: " + U.data((e.jornada || {}).aceiteEm) + ".  Cadastro no portal: " + U.data(e.criadaEm) + ".  Migração concluída: " + (e.migracaoConcluidaEm ? U.data(e.migracaoConcluidaEm) : "em andamento") + ".  Trilha " + (e.trilha || "A") + ".", y, 9.5);
      var O = global.Onboarding;
      GRUPOS.forEach(function (g) {
        y = titulo(d, g.titulo, y);
        if (en.gruposNA && en.gruposNA[g.id]) { y = paragrafo(d, "Grupo dispensado pelo cliente: " + (g.textoGrupoNA || "não se aplica") + ".", y, 9); return; }
        var alvos = g.escopo === "socio" ? (en.socios || []) : [null];
        alvos.forEach(function (s) {
          if (s) { y = linha(d, y); d.setFont("helvetica", "bold"); d.setFontSize(10); d.text(s.nome + (s.cpf ? "  CPF " + s.cpf : ""), 14, y); d.setFont("helvetica", "normal"); y += 5; }
          g.itens.forEach(function (it) {
            var k = O ? O.chave(g, it, s ? s.id : null) : "", reg = ((en.itens || {})[k]) || {};
            var sit = O ? O.situacao({ itens: en.itens || {}, gruposNA: en.gruposNA || {}, socios: en.socios || [] }, g, it, s ? s.id : null) : "pendente";
            var arqs = (reg.docIds || []).map(function (id) { return (docs || []).filter(function (x) { return x.id === id; })[0]; }).filter(Boolean);
            var texto = it.nome + ": " + (ROT[sit] || sit) + (reg.em ? ", recebido em " + U.dataHora(reg.em) : "") + (reg.revisao && reg.revisao.por ? ", " + (sit === "aprovado" ? "aprovado" : sit === "na" ? "dispensado" : "revisado") + " por " + reg.revisao.por + " em " + U.dataHora(reg.revisao.em) : "") + (reg.revisao && reg.revisao.motivo ? " (" + reg.revisao.motivo + ")" : "") + (reg.valor ? ". Valor informado: " + reg.valor : "") + (reg.procuracao ? ". Procuração eletrônica informada" : "") + (reg.credencialId ? ". Credencial guardada no cofre" : "") + (arqs.length ? ". Arquivos: " + arqs.map(function (a) { return a.nome + " (" + U.tamanho(a.arquivo ? a.arquivo.tamanho : 0) + ")"; }).join("; ") : "") + ".";
            y = paragrafo(d, "• " + texto, y, 9);
          });
        });
      });
      y = titulo(d, "Recebido da contabilidade anterior", y);
      var ant = (docs || []).filter(function (x) { return x.origem === "anterior"; });
      if (!ant.length) y = paragrafo(d, "Nenhum arquivo registrado pela contabilidade anterior.", y, 9);
      ant.forEach(function (a) { y = paragrafo(d, "• " + a.nome + " · " + U.dataHora(a.em) + " · enviado por " + (a.por || "contabilidade anterior") + (a.revisao ? " · " + (ROT[a.situacao] || a.situacao) + " por " + a.revisao.por : ""), y, 9); });
      y = titulo(d, "Financeiro", y);
      var f = e.financeiro || {};
      y = paragrafo(d, f.status ? "Checklist financeiro enviado em " + U.dataHora(f.enviadoEm) + " (protocolo " + f.protocolo + "). Bancos: " + (f.temBanco ? (f.bancos || []).concat(f.bancoOutro ? [f.bancoOutro] : []).join(", ") : "sem conta") + ". Maquininhas: " + (f.temMaquineta ? (f.maquinetas || []).concat(f.maquinetaOutra ? [f.maquinetaOutra] : []).join(", ") + ". Relatórios: " + (f.forma === "acesso" ? "a Totali baixa com os acessos informados" : "o cliente envia todo mês" + (f.termo ? ", com termo de compromisso gerado em " + U.dataHora(f.termo.geradoEm) : "")) : "não usa") + "." : "Checklist financeiro ainda não respondido.", y, 9.5);
      rodape(d); d.save("dossie-entrada-" + U.slug(e.fantasia) + ".pdf");
    }).catch(function (err) { UI.toast(err.message, "erro"); });
  }

  /* Termo de compromisso: devolve um Blob (o financeiro.js guarda como documento) */
  function termo(e, f, T, RELATORIOS) {
    return carregar().then(function (J) {
      var d = novo(J), y = cabecalho(d, T.titulo, T.subtitulo);
      y = blocoEmpresa(d, e, y);
      y = paragrafo(d, "Protocolo " + f.protocolo + " · " + U.data(Date.now()), y, 9);
      y = paragrafo(d, T.declaracao, y, 10.5);
      y = paragrafo(d, T.compromisso, y, 10.5);
      RELATORIOS.forEach(function (r) { y = paragrafo(d, "   ✓  " + r, y, 10.5); });
      y = paragrafo(d, "Maquininhas: " + (f.maquinetas || []).concat(f.maquinetaOutra ? [f.maquinetaOutra] : []).join(", ") + ".", y, 10.5);
      y = titulo(d, T.responsabilidadeTitulo, y); y = paragrafo(d, T.responsabilidade, y, 10);
      y = titulo(d, T.cienciaTitulo, y); y = paragrafo(d, T.ciencia, y, 10);
      y = paragrafo(d, "Aceito eletronicamente pelo portal do cliente em " + U.dataHora(Date.now()) + ".", y + 4, 10);
      rodape(d); return d.output("blob");
    });
  }

  global.PDF = { ficha: ficha, dossie: dossie, termo: termo };
})(window);
