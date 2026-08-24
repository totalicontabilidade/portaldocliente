/* ============================================================
   Totali · Portal de Onboarding
   termo.js — termo de compromisso em PDF

   Gerado no próprio aparelho do cliente, com a biblioteca
   vendorizada em lib/jspdf.umd.min.js. Nada de CDN: a política
   de segurança do portal só aceita script da própria origem.

   O texto vem inteiro de DATA.TERMO — não escreva conteúdo
   jurídico aqui. Para mudar uma cláusula, mexa em js/data.js.
   ============================================================ */
(function (global) {
  "use strict";

  var NAVY = [26, 49, 73];
  var OURO = [194, 162, 80];
  var TINTA = [32, 44, 58];
  var CINZA = [110, 125, 140];

  /* A biblioteca só é baixada quando alguém pede um PDF — são
     357 KB que não fazem falta para abrir o portal. Havia aqui um
     `jsPDFdisponivel()` que respondia SIM antes de ela existir, o
     que é o mesmo que não responder nada; quem falha de verdade é
     o `garantirJsPDF`, e a rejeição dele carrega o motivo. */
  function garantirJsPDF() {
    if (global.jspdf && global.jspdf.jsPDF) return Promise.resolve();
    return global.U.carregarScript("lib/jspdf.umd.min.js").then(function () {
      if (!(global.jspdf && global.jspdf.jsPDF)) throw new Error("jspdf-nao-carregou");
    });
  }

  /* A logo entra como imagem; se por algum motivo não carregar,
     o termo sai com o nome escrito e segue válido. */
  function carregarLogo() {
    /* Branca: o cabeçalho é faixa NAVY. A colorida tem as letras
       escuras e some no fundo — e este é o documento que fica com
       o cliente. */
    return fetch("assets/totali-portal-branca.png")
      .then(function (r) { return r.ok ? r.blob() : null; })
      .then(function (blob) {
        if (!blob) return null;
        return new Promise(function (resolve) {
          var leitor = new FileReader();
          leitor.onload = function () { resolve(leitor.result); };
          leitor.onerror = function () { resolve(null); };
          leitor.readAsDataURL(blob);
        });
      })
      .catch(function () { return null; });
  }

  function dataHoraExtenso(ts) {
    var d = new Date(ts);
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear() +
           " às " + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  function nomeDoArquivo(empresa, ts) {
    var d = new Date(ts);
    var mes = (d.getMonth() + 1 < 10 ? "0" : "") + (d.getMonth() + 1);
    var limpo = String(empresa || "EMPRESA").toUpperCase()
      .replace(/[\\/:*?"<>|]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60);
    return limpo + " - Compromisso Maquininhas - " + mes + "-" + d.getFullYear() + ".pdf";
  }

  /* dados: { empresa, cnpj, protocolo, maquinetas[], em } */
  function gerar(dados) {
    var T = global.DATA.TERMO;
    var ORG = global.DATA.ORG;
    var em = dados.em || Date.now();

    return garantirJsPDF().then(carregarLogo).then(function (logo) {
      var JS = global.jspdf.jsPDF;
      var doc = new JS({ unit: "mm", format: "a4", compress: true });
      var L = 20;                      /* margem esquerda   */
      var LARG = 210 - L * 2;          /* largura útil      */
      var y = 0;

      /* ---- cabeçalho ---- */
      doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
      doc.rect(0, 0, 210, 34, "F");
      doc.setFillColor(OURO[0], OURO[1], OURO[2]);
      doc.rect(0, 34, 210, 1.6, "F");

      if (logo) {
        try { doc.addImage(logo, "PNG", L, 10, 34, 12.9); } catch (e) { /* segue sem logo */ }
      } else {
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.text(ORG.nome.toUpperCase(), L, 19);
      }

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(T.titulo, 210 - L, 17, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(214, 198, 156);
      doc.text(T.subtitulo, 210 - L, 23.5, { align: "right" });

      y = 48;

      /* ---- identificação ---- */
      var linhas = [
        ["Empresa:", dados.empresa || "—"],
        ["CNPJ:", dados.cnpj || "—"],
        ["Protocolo:", dados.protocolo || "—"],
        ["Emitido em:", dataHoraExtenso(em)]
      ];
      doc.setFontSize(10);
      linhas.forEach(function (par) {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(CINZA[0], CINZA[1], CINZA[2]);
        doc.text(par[0], L, y);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(TINTA[0], TINTA[1], TINTA[2]);
        doc.text(doc.splitTextToSize(String(par[1]), LARG - 30), L + 28, y);
        y += 6.5;
      });

      y += 3;
      doc.setDrawColor(222, 228, 235);
      doc.line(L, y, 210 - L, y);
      y += 9;

      /* ---- corpo ---- */
      function paragrafo(texto, tamanho, estilo) {
        doc.setFont("helvetica", estilo || "normal");
        doc.setFontSize(tamanho || 10.5);
        doc.setTextColor(TINTA[0], TINTA[1], TINTA[2]);
        var partes = doc.splitTextToSize(texto, LARG);
        partes.forEach(function (linha) {
          if (y > 268) { doc.addPage(); y = 24; }
          doc.text(linha, L, y);
          y += 5.4;
        });
        y += 3.5;
      }

      function subtitulo(texto) {
        if (y > 258) { doc.addPage(); y = 24; }
        y += 2;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
        doc.text(texto, L, y);
        y += 6.5;
      }

      paragrafo(T.declaracao);
      paragrafo(T.compromisso);

      /* lista dos três relatórios */
      doc.setFontSize(10.5);
      T.itens.forEach(function (item, i) {
        if (y > 268) { doc.addPage(); y = 24; }
        doc.setFillColor(OURO[0], OURO[1], OURO[2]);
        doc.circle(L + 2, y - 1.3, 1.5, "F");
        doc.setFont("helvetica", "bold");
        doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
        doc.text(String(i + 1) + ".", L + 7, y);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(TINTA[0], TINTA[1], TINTA[2]);
        doc.text(item, L + 13, y);
        y += 6.6;
      });
      y += 4;

      /* maquininhas declaradas */
      if (dados.maquinetas && dados.maquinetas.length) {
        subtitulo("Maquininhas declaradas");
        paragrafo(dados.maquinetas.join(" · "), 10.5);
      }

      subtitulo(T.responsabilidadeTitulo);
      paragrafo(T.responsabilidade);

      subtitulo(T.cienciaTitulo);
      paragrafo(T.ciencia, 9.5);

      /* ---- rodapé em todas as páginas ---- */
      var total = doc.getNumberOfPages();
      for (var i = 1; i <= total; i++) {
        doc.setPage(i);
        doc.setDrawColor(222, 228, 235);
        doc.line(L, 283, 210 - L, 283);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(CINZA[0], CINZA[1], CINZA[2]);
        doc.text(ORG.nome + " · " + ORG.telefoneExibicao + " · " + ORG.email, L, 288);
        doc.text(i + "/" + total, 210 - L, 288, { align: "right" });
      }

      return {
        blob: doc.output("blob"),
        nome: nomeDoArquivo(dados.empresa, em),
        em: em
      };
    });
  }

  global.Termo = { gerar: gerar, nomeDoArquivo: nomeDoArquivo };
})(window);
