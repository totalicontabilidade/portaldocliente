/* ============================================================
   Totali · Portal de Onboarding
   ficha-pdf.js — a ficha do cliente em PDF (painel da equipe)

   PARA QUE SERVE
   --------------
   A ficha na tela é ótima para trabalhar e péssima para levar
   junto. Quem vai à empresa, quem manda a situação para o dono
   por e-mail, quem arquiva o dossiê de entrada no processo do
   cliente — todos precisam de uma folha, não de uma aba aberta.
   Este arquivo transforma a ficha inteira num PDF gerado no
   próprio computador, sem passar por servidor nenhum.

   O QUE NÃO ENTRA, DE PROPÓSITO
   -----------------------------
   Senhas e credenciais NÃO saem daqui. Elas ficam guardadas
   cifradas e só são abertas na tela, uma de cada vez, por quem
   tem a chave. Um PDF vira anexo de e-mail, vira arquivo em
   pendrive, vira impressão esquecida na mesa — é exatamente o
   caminho por onde uma senha vaza. O PDF diz QUANTAS credenciais
   existem e de quais serviços, o que é o suficiente para saber
   o que a Totali tem em mãos, sem entregar nada.

   Também não entram os arquivos em si, só o nome e a situação
   de cada documento. O PDF é um retrato, não um pacote.

   A biblioteca é a mesma do termo (lib/jspdf.umd.min.js), já
   vendorizada — a política de segurança do painel só aceita
   script da própria origem.
   ============================================================ */
(function (global) {
  "use strict";

  var NAVY = [26, 49, 73];
  var OURO = [194, 162, 80];
  var TINTA = [32, 44, 58];
  var CINZA = [110, 125, 140];

  /* Cores das situações. Impresso em preto e branco o texto
     continua dizendo tudo — a cor é reforço, não a informação. */
  var COR_SIT = {
    aprovado:    [46, 125, 90],
    enviado:     [176, 130, 40],
    analise:     [176, 130, 40],
    pendencia:   [186, 66, 60],
    pendente:    [120, 132, 146],
    substituido: [46, 125, 90],
    na:          [140, 150, 162]
  };

  var TEXTO_SIT = {
    aprovado: "Aprovado",
    enviado: "Para conferir",
    analise: "Em análise",
    pendencia: "Correção pedida",
    substituido: "Coberto pela CNH",
    na: "Não se aplica",
    pendente: "Não enviado"
  };

  function disponivel() {
    return !!(global.jspdf && global.jspdf.jsPDF);
  }

  /* As fontes embutidas do PDF só conhecem a tabela latina. Letra
     acentuada passa; travessão, aspas curvas e reticências, não —
     e o pior é que somem CALADOS, deixando dois espaços no meio
     da frase. Descobrimos isso lendo o PDF gerado, não a olho.

     Vale para tudo, inclusive o que o cliente digitou: texto
     colado do Word vem cheio destes caracteres. */
  var TROCAS = [
    [/[‐-―]/g, "-"],    /* travessões e hifens tipográficos */
    [/[‘’‛]/g, "'"],
    [/[“”‟]/g, '"'],
    [/…/g, "..."],
    [/[   ]/g, " "],
    [/[•]/g, "-"],
    [/₿|™/g, ""]
  ];

  function asc(v) {
    var s = String(v == null ? "" : v);
    TROCAS.forEach(function (t) { s = s.replace(t[0], t[1]); });
    return s;
  }

  function plural(n, um, varios) { return n === 1 ? um : varios; }

  function carregarLogo() {
    return fetch("assets/totali-portal-cor.png")
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

  function doisDigitos(n) { return (n < 10 ? "0" : "") + n; }

  /* Data pode vir como número, texto ISO ou Timestamp do
     Firestore — os três aparecem no sistema, dependendo de onde
     o campo foi gravado. */
  function emMs(v) {
    if (!v) return 0;
    if (typeof v === "number") return v;
    if (typeof v === "string") { var t = Date.parse(v); return isNaN(t) ? 0 : t; }
    if (typeof v.toMillis === "function") { try { return v.toMillis(); } catch (e) { return 0; } }
    if (typeof v.seconds === "number") return v.seconds * 1000;
    return 0;
  }

  function dataHoraExtenso(ts) {
    var d = new Date(ts);
    return doisDigitos(d.getDate()) + "/" + doisDigitos(d.getMonth() + 1) + "/" +
           d.getFullYear() + " às " + doisDigitos(d.getHours()) + ":" +
           doisDigitos(d.getMinutes());
  }

  function dataCurta(v) {
    var ms = emMs(v);
    if (!ms) return "";
    var d = new Date(ms);
    return doisDigitos(d.getDate()) + "/" + doisDigitos(d.getMonth() + 1) + "/" + d.getFullYear();
  }

  function nomeDoArquivo(empresa, ts) {
    var d = new Date(ts);
    var limpo = String(empresa || "CLIENTE").toUpperCase()
      .replace(/[\\/:*?"<>|]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60);
    return limpo + " - Ficha de Onboarding - " +
           d.getFullYear() + "-" + doisDigitos(d.getMonth() + 1) + "-" +
           doisDigitos(d.getDate()) + ".pdf";
  }

  /* ------------------------------------------------------------
     Monta o conteúdo a partir dos MESMOS dados que a tela usa.
     Nada é recalculado por conta própria: a situação de cada
     documento sai de Situacao.de, igual à ficha. Se um dia a
     regra mudar, o PDF muda junto — não há segunda verdade.
     ------------------------------------------------------------ */
  function reunir(c) {
    var e = c.empresa || {};
    var dados = c.dados || { itens: {}, socios: [], gruposNA: {} };
    var S = global.Situacao;
    var DATA = global.DATA;

    var grupos = DATA.GRUPOS.map(function (g) {
      var alvos = g.escopo === "socio"
        ? (dados.socios || []).map(function (s) { return s.id; })
        : [null];

      var linhas = [];
      alvos.forEach(function (socioId) {
        var socio = socioId
          ? (dados.socios || []).filter(function (s) { return s.id === socioId; })[0]
          : null;
        g.itens.forEach(function (item) {
          var sit = S.de(dados, g, item, socioId);
          var chave = S.chaveItem(g.id, item.id, socioId);
          var reg = dados.itens[chave] || {};
          linhas.push({
            nome: item.nome + (socio && socio.nome ? " — " + socio.nome : ""),
            sit: sit,
            obrigatorio: !!item.obrigatorio,
            /* Motivo da correção: é o que o cliente precisa
               resolver, e some da memória de quem pediu. */
            motivo: (reg.revisao && reg.revisao.status === "pendencia"
                      ? String(reg.revisao.motivo || "") : ""),
            arquivos: (reg.arquivos || []).length,
            valor: reg.valor || ""
          });
        });
      });

      return {
        titulo: g.titulo,
        na: !!(dados.gruposNA || {})[g.id],
        resumo: S.resumoGrupo(dados, g),
        linhas: linhas
      };
    });

    return {
      nome: e.nomeFantasia || e.razaoSocial || "Cliente",
      empresa: e,
      socios: dados.socios || [],
      resumo: S.resumoGeral(dados, DATA.GRUPOS),
      grupos: grupos,
      financeiro: c.financeiro || null,
      /* Só os recibos: chave, quais campos foram enviados e
         quando. O conteúdo cifrado nunca chega aqui. */
      recibos: Object.keys(c.recibos || {}).map(function (chave) {
        var r = (c.recibos || {})[chave] || {};
        return { nome: nomeDaChave(chave), campos: (r.campos || []).join(", "), em: r.em || 0 };
      })
    };
  }

  /* "fiscal/certificado-digital" → "Certificado digital · Fiscal" */
  function nomeDaChave(chave) {
    var partes = String(chave).split("/");
    var grupo = (global.DATA.GRUPOS || []).filter(function (g) { return g.id === partes[0]; })[0];
    if (!grupo) return chave;
    var itemId = partes[partes.length - 1];
    var item = grupo.itens.filter(function (i) { return i.id === itemId; })[0];
    return (item ? item.nome : itemId) + " · " + grupo.titulo;
  }

  /* ------------------------------------------------------------
     Desenho
     ------------------------------------------------------------ */
  function gerar(c) {
    if (!disponivel()) return Promise.reject(new Error("biblioteca-pdf-indisponivel"));

    var d = reunir(c);
    var ORG = global.DATA.ORG;
    var em = Date.now();

    return carregarLogo().then(function (logo) {
      var JS = global.jspdf.jsPDF;
      var doc = new JS({ unit: "mm", format: "a4", compress: true });

      /* Uma trava só, no ponto por onde TODO texto passa. Sanear
         em cada chamada seria esquecer uma — e o caractere some
         sem erro nenhum, então o esquecimento não apareceria. */
      var escrever = doc.text.bind(doc);
      var medir = doc.splitTextToSize.bind(doc);
      doc.text = function (texto, x, yy, opcoes) {
        return escrever(Array.isArray(texto) ? texto.map(asc) : asc(texto), x, yy, opcoes);
      };
      doc.splitTextToSize = function (texto, largura, opcoes) {
        return medir(asc(texto), largura, opcoes);
      };

      var L = 18;
      var DIR = 210 - L;
      var LARG = 210 - L * 2;
      var y = 0;

      /* Quebra de página em um lugar só: qualquer coisa que vá
         escrever confere antes se ainda cabe. Espalhado, sempre
         sobra um bloco que atravessa o rodapé. */
      function cabe(alturaPrevista) {
        if (y + (alturaPrevista || 6) > 274) { doc.addPage(); y = 24; return true; }
        return false;
      }

      function titulo(texto) {
        cabe(16);
        y += 4;
        doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
        doc.rect(L, y - 4, 2.2, 6, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
        doc.text(texto, L + 6, y);
        y += 3;
        doc.setDrawColor(222, 228, 235);
        doc.line(L, y, DIR, y);
        y += 7;
      }

      function subtitulo(texto, direita) {
        cabe(10);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(TINTA[0], TINTA[1], TINTA[2]);
        doc.text(texto, L, y);
        if (direita) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.setTextColor(CINZA[0], CINZA[1], CINZA[2]);
          doc.text(direita, DIR, y, { align: "right" });
        }
        y += 6;
      }

      /* Rótulo à esquerda, valor à direita, valor longo quebrando
         em linhas alinhadas embaixo do primeiro pedaço. */
      function dado(rotulo, valor) {
        var v = String(valor == null || valor === "" ? "—" : valor);
        var partes = doc.splitTextToSize(v, LARG - 42);
        cabe(partes.length * 5 + 2);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(CINZA[0], CINZA[1], CINZA[2]);
        doc.text(rotulo, L, y);
        doc.setTextColor(TINTA[0], TINTA[1], TINTA[2]);
        partes.forEach(function (linha, i) {
          doc.text(linha, L + 42, y + i * 5);
        });
        y += partes.length * 5 + 1.2;
      }

      function paragrafo(texto, tamanho, cor) {
        var c2 = cor || CINZA;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(tamanho || 9.5);
        doc.setTextColor(c2[0], c2[1], c2[2]);
        doc.splitTextToSize(String(texto), LARG).forEach(function (linha) {
          cabe(6);
          doc.text(linha, L, y);
          y += 5;
        });
        y += 2;
      }

      /* ---- cabeçalho da primeira página ---- */
      doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
      doc.rect(0, 0, 210, 34, "F");
      doc.setFillColor(OURO[0], OURO[1], OURO[2]);
      doc.rect(0, 34, 210, 1.6, "F");

      if (logo) {
        try { doc.addImage(logo, "PNG", L, 10, 34, 12.9); } catch (er) { /* segue sem logo */ }
      } else {
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.text(ORG.nome.toUpperCase(), L, 19);
      }

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("Ficha do cliente", DIR, 17, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(214, 198, 156);
      doc.text("Onboarding · documento interno", DIR, 23.5, { align: "right" });

      y = 47;

      /* ---- identificação ---- */
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
      doc.splitTextToSize(d.nome, LARG).forEach(function (linha) {
        doc.text(linha, L, y); y += 7;
      });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(CINZA[0], CINZA[1], CINZA[2]);
      doc.text("Emitido em " + dataHoraExtenso(em), L, y);
      y += 9;

      /* ---- barra de progresso ---- */
      var pct = Math.max(0, Math.min(100, d.resumo.pct || 0));
      doc.setFillColor(232, 236, 241);
      doc.roundedRect(L, y, LARG, 5, 2.5, 2.5, "F");
      if (pct > 0) {
        doc.setFillColor(OURO[0], OURO[1], OURO[2]);
        doc.roundedRect(L, y, Math.max(3, LARG * pct / 100), 5, 2.5, 2.5, "F");
      }
      y += 10;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(TINTA[0], TINTA[1], TINTA[2]);
      doc.text(
        d.resumo.ok + " de " + d.resumo.total + " documentos  ·  " +
        d.resumo.aprovados + " " + plural(d.resumo.aprovados, "aprovado", "aprovados") + "  ·  " +
        d.resumo.pendentesObrigatorios + " " +
          plural(d.resumo.pendentesObrigatorios, "obrigatório faltando", "obrigatórios faltando") +
          "  ·  " +
        d.resumo.pendencias + " " +
          plural(d.resumo.pendencias, "correção pedida", "correções pedidas"),
        L, y
      );
      y += 6;

      /* ---- cadastro ---- */
      titulo("Cadastro e contato");
      dado("Razão social", d.empresa.razaoSocial);
      dado("Nome fantasia", d.empresa.nomeFantasia);
      dado("CNPJ", d.empresa.cnpj);
      dado("Regime", d.empresa.regime);
      y += 2;
      dado("Responsável", d.empresa.responsavelNome);
      dado("Função", d.empresa.responsavelCargo);
      dado("E-mail", d.empresa.responsavelEmail);
      dado("Telefone", d.empresa.responsavelTelefone);
      dado("Aceite da LGPD", d.empresa.aceiteLGPD
        ? dataHoraExtenso(emMs(d.empresa.aceiteLGPD))
        : "");

      /* ---- sócios ---- */
      titulo("Sócios");
      if (!d.socios.length) {
        paragrafo("Nenhum sócio cadastrado. Enquanto não houver, os documentos de sócio " +
                  "não existem para este cliente.");
      } else {
        d.socios.forEach(function (s) { dado(s.nome || "Sócio", s.cpf || ""); });
      }

      /* ---- documentos ---- */
      titulo("Documentos");
      d.grupos.forEach(function (g) {
        cabe(18);
        subtitulo(
          g.titulo + (g.na ? "  (não se aplica)" : ""),
          g.resumo.ok + " de " + g.resumo.total
        );

        if (!g.linhas.length) {
          paragrafo("Depende dos sócios, e nenhum foi cadastrado.");
          return;
        }

        g.linhas.forEach(function (l) {
          cabe(7);
          var cor = COR_SIT[l.sit] || CINZA;

          doc.setFillColor(cor[0], cor[1], cor[2]);
          doc.circle(L + 1.6, y - 1.2, 1.3, "F");

          doc.setFont("helvetica", "normal");
          doc.setFontSize(9.5);
          doc.setTextColor(TINTA[0], TINTA[1], TINTA[2]);
          var rotulo = l.nome + (l.obrigatorio ? "" : "  (opcional)");
          doc.text(doc.splitTextToSize(rotulo, LARG - 48)[0], L + 6, y);

          doc.setTextColor(cor[0], cor[1], cor[2]);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5);
          doc.text(TEXTO_SIT[l.sit] || l.sit, DIR, y, { align: "right" });
          y += 5;

          /* O valor digitado (número de inscrição, por exemplo)
             e o motivo da correção entram recuados. */
          if (l.valor) {
            cabe(5);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8.5);
            doc.setTextColor(CINZA[0], CINZA[1], CINZA[2]);
            doc.text(String(l.valor).slice(0, 120), L + 6, y);
            y += 4.6;
          }
          if (l.motivo) {
            doc.setFont("helvetica", "italic");
            doc.setFontSize(8.5);
            doc.setTextColor(186, 66, 60);
            doc.splitTextToSize("Correção pedida: " + l.motivo, LARG - 8).forEach(function (ln) {
              cabe(5);
              doc.text(ln, L + 6, y);
              y += 4.6;
            });
          }
        });
        y += 3;
      });

      /* ---- bancos e maquininhas ---- */
      titulo("Bancos e maquininhas");
      var f = d.financeiro;
      if (!f) {
        paragrafo("O cliente ainda não respondeu esta etapa.");
      } else {
        var forma = (global.DATA.FORMAS_RELATORIO || []).filter(function (x) {
          return x.id === f.formaRelatorio;
        })[0];
        var junta = function (arr, outro) {
          var todos = (arr || []).slice();
          if (outro) todos.push(outro);
          return todos.join(", ");
        };
        var confirmadas = Object.keys(f.modoContador || {}).filter(function (k) {
          return f.modoContador[k] === true;
        });

        dado("Situação", f.concluidoEm ? "Concluído" : "Respondido em parte");
        dado("Protocolo", f.protocolo);
        dado("Tem conta em banco",
             f.temBanco === "sim" ? "Sim" : f.temBanco === "nao" ? "Não" : "");
        dado("Bancos", junta(f.bancos, f.bancoOutro));
        dado("Tem maquininha",
             f.temMaquineta === "sim" ? "Sim" : f.temMaquineta === "nao" ? "Não" : "");
        dado("Maquininhas", junta(f.maquinetas, f.maquinetaOutra));
        dado("Envio dos relatórios", forma ? forma.titulo : "");
        if (confirmadas.length) dado("Modo Contador confirmado", confirmadas.join(", "));
        dado("Observações", f.observacoes);
      }

      /* ---- credenciais: só o inventário ---- */
      titulo("Acessos e senhas guardados");
      if (!d.recibos.length) {
        paragrafo("Nenhum acesso enviado por este cliente.");
      } else {
        paragrafo("O cliente enviou " + d.recibos.length + " " +
                  (d.recibos.length === 1 ? "acesso" : "acessos") +
                  ". Os dados ficam cifrados e só são abertos na tela do painel, com a chave " +
                  "privada — por segurança, nenhum deles é impresso aqui.");
        d.recibos.forEach(function (r) {
          dado(r.nome, r.campos + (r.em ? "  ·  enviado em " + dataCurta(r.em) : ""));
        });
      }

      /* ---- rodapé ---- */
      var total = doc.getNumberOfPages();
      for (var i = 1; i <= total; i++) {
        doc.setPage(i);
        doc.setDrawColor(222, 228, 235);
        doc.line(L, 283, DIR, 283);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(CINZA[0], CINZA[1], CINZA[2]);
        doc.text("Documento interno · " + ORG.nome + " · " + ORG.telefoneExibicao, L, 288);
        doc.text(i + "/" + total, DIR, 288, { align: "right" });
      }

      return { blob: doc.output("blob"), nome: nomeDoArquivo(d.nome, em), em: em };
    });
  }

  global.FichaPDF = { gerar: gerar, disponivel: disponivel, nomeDoArquivo: nomeDoArquivo };
})(window);
