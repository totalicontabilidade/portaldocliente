/* ============================================================
   Totali · Portal de Onboarding
   dossie-pdf.js — o dossiê de entrada do cliente

   QUAL A DIFERENÇA PARA A FICHA EM PDF
   ------------------------------------
   A ficha (js/ficha-pdf.js) é um RETRATO DE AGORA, para levar à
   visita ou anexar num e-mail: o que falta, o que chegou, o que
   está esperando conferência. Serve enquanto o onboarding está
   acontecendo, e fica velha no dia seguinte.

   O dossiê é o oposto: é o REGISTRO DE COMO A EMPRESA ENTROU.
   Vai para a pasta do cliente e não muda mais. Ele responde as
   perguntas que aparecem meses ou anos depois:

     • o que a Totali recebeu, exatamente?
     • em que data cada coisa chegou?
     • quem conferiu e aprovou?
     • o que ficou combinado que não se aplica, e por decisão de
       quem?
     • o que o cliente declarou sobre empréstimo, aplicações e
       controle de contas pagas?

   POR QUE O CARIMBO DO SERVIDOR ENTRA AQUI
   ----------------------------------------
   Porque é a única parte deste documento que nenhuma das duas
   partes podia ter escrito. As datas de recebimento e aprovação
   são gravadas pela Cloud Function que observa cada documento
   mudar, com a hora do servidor — não com o que o navegador do
   cliente ou o do contador disseram. E a regra do Firestore
   proíbe cliente e equipe de tocar nesses campos. Num documento
   de arquivo, isso é a diferença entre um relato e um registro.

   O QUE NÃO ENTRA
   ---------------
   Senha, credencial, conteúdo de arquivo. Um dossiê é feito para
   ser arquivado, impresso e encaminhado — exatamente o caminho
   por onde uma senha vaza. Ele lista QUAIS acessos foram
   entregues, nunca o que há dentro deles.
   ============================================================ */
(function (global) {
  "use strict";

  var NAVY = [26, 49, 73];
  var OURO = [194, 162, 80];
  var TINTA = [32, 44, 58];
  var CINZA = [110, 125, 140];
  var VERDE = [46, 125, 90];

  function garantirJsPDF() {
    if (global.jspdf && global.jspdf.jsPDF) return Promise.resolve();
    return global.U.carregarScript("lib/jspdf.umd.min.js").then(function () {
      if (!(global.jspdf && global.jspdf.jsPDF)) throw new Error("jspdf-nao-carregou");
    });
  }

  /* As fontes embutidas descartam travessão, aspas curvas e
     reticências em silêncio — o mesmo problema já encontrado em
     ficha-pdf.js, e pelo mesmo motivo. */
  var TROCAS = [
    [/[‐-―]/g, "-"],
    [/[‘’‛]/g, "'"],
    [/[“”‟]/g, '"'],
    [/…/g, "..."],
    [/[    ]/g, " "],
    [/[•●▪]/g, "-"],
    [/[™℗₿]/g, ""]
  ];

  function asc(v) {
    var s = String(v == null ? "" : v);
    TROCAS.forEach(function (t) { s = s.replace(t[0], t[1]); });
    return s;
  }

  function dd(n) { return (n < 10 ? "0" : "") + n; }

  function emMs(v) {
    if (!v) return 0;
    if (typeof v === "number") return v;
    if (typeof v.toMillis === "function") { try { return v.toMillis(); } catch (e) { return 0; } }
    if (typeof v.seconds === "number") return v.seconds * 1000;
    var t = Date.parse(v);
    return isNaN(t) ? 0 : t;
  }

  function data(v) {
    var ms = emMs(v);
    if (!ms) return "";
    var d = new Date(ms);
    return dd(d.getDate()) + "/" + dd(d.getMonth() + 1) + "/" + d.getFullYear();
  }

  function dataHora(v) {
    var ms = emMs(v);
    if (!ms) return "";
    var d = new Date(ms);
    return data(ms) + " às " + dd(d.getHours()) + ":" + dd(d.getMinutes());
  }

  function nomeDoArquivo(empresa, ts) {
    var d = new Date(ts);
    var limpo = String(empresa || "CLIENTE").toUpperCase()
      .replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim().slice(0, 60);
    return limpo + " - Dossie de Entrada - " + d.getFullYear() + "-" +
           dd(d.getMonth() + 1) + "-" + dd(d.getDate()) + ".pdf";
  }

  function plural(n, um, varios) { return n === 1 ? um : varios; }

  /* ------------------------------------------------------------
     AS DATAS QUE VALEM VÊM CARIMBADAS NO PRÓPRIO DOCUMENTO

     Duas datas dão ao dossiê o peso que ele tem: quando cada
     documento chegou e quando foi aprovado, com quem aprovou.
     Elas são escritas pela Cloud Function que observa a gravação,
     nos campos `recebidoEm`, `aprovadoEm` e `aprovadoPor` — e a
     regra do Firestore proíbe cliente e equipe de tocar neles.

     ANTES ISSO VINHA DE /auditoria, e o preço era alto: para o
     dossiê funcionar, a leitura da trilha inteira precisava ficar
     aberta para toda a equipe — e a trilha guarda a carteira
     inteira de clientes, não só a empresa do dossiê. Com o
     carimbo no item, a trilha pôde virar exclusiva do
     administrador sem o dossiê perder nada.

     De quebra, saiu uma ida ao servidor: os itens e os acessos já
     vêm carregados com o cliente.

     Documento carimbado antes desta mudança não existe, e nesse
     caso o dossiê usa a data do envio e DIZ que é ela — inventar
     procedência seria pior que admitir que não há. */
  function carimboDe(reg) {
    return {
      recebido: emMs(reg.recebidoEm),
      aprovado: emMs(reg.aprovadoEm),
      por: reg.aprovadoPor || ""
    };
  }

  /* ------------------------------------------------------------
     O que vai no documento
     ------------------------------------------------------------ */
  function reunir(c) {
    var e = c.empresa || {};
    var dados = c.dados || { itens: {}, socios: [], gruposNA: {} };
    var S = global.Situacao;
    var DATA = global.DATA;

    var recebidos = [], naoAplicaveis = [], pendentes = [];
    var carimbados = 0;

    DATA.GRUPOS.forEach(function (g) {
      var alvos = g.escopo === "socio"
        ? (dados.socios || []).map(function (s) { return s.id; })
        : [null];
      alvos.forEach(function (socioId) {
        var socio = socioId
          ? (dados.socios || []).filter(function (s) { return s.id === socioId; })[0]
          : null;
        g.itens.forEach(function (item) {
          var sit = S.de(dados, g, item, socioId);
          var chave = S.chaveItem(g.id, item.id, socioId);
          var reg = dados.itens[chave] || {};
          var t = carimboDe(reg);
          if (t.recebido || t.aprovado) carimbados++;

          var linha = {
            nome: item.nome + (socio && socio.nome ? " — " + socio.nome : ""),
            grupo: g.titulo,
            sit: sit,
            arquivos: (reg.arquivos || []).map(function (a) { return a.nome; }),
            valor: reg.valor || "",
            /* Data do servidor quando existe; a do navegador só
               como reserva, e sinalizada como tal. */
            recebido: t.recebido || 0,
            recebidoLocal: emMs(reg.atualizadoEm),
            aprovado: t.aprovado || 0,
            aprovadoPor: t.por || ((reg.revisao || {}).por || ""),
            decidiuEquipe: typeof reg.naEquipe === "boolean"
          };

          if (sit === "na") naoAplicaveis.push(linha);
          else if (S.resolvida(sit)) recebidos.push(linha);
          else pendentes.push(linha);
        });
      });
    });

    return {
      nome: e.nomeFantasia || e.razaoSocial || "Cliente",
      empresa: e,
      socios: dados.socios || [],
      resumo: S.resumoGeral(dados, DATA.GRUPOS),
      recebidos: recebidos,
      naoAplicaveis: naoAplicaveis,
      pendentes: pendentes,
      financeiro: c.financeiro || null,
      /* Os acessos já vêm com o cliente. `porEquipe` separa o
         acesso que a equipe deu no painel daquele que o próprio
         cliente abriu pelo convite. */
      acessos: (c.acessos || []).map(function (a) {
        return { em: emMs(a.em), origem: a.porEquipe ? "equipe" : "convite" };
      }).sort(function (a, b) { return a.em - b.em; }),
      temCarimbo: carimbados > 0
    };
  }

  /* ------------------------------------------------------------
     Desenho
     ------------------------------------------------------------ */
  function gerar(c) {
    return garantirJsPDF().then(function () {
      var d = reunir(c);
      var ORG = global.DATA.ORG;
      var em = Date.now();

      return carregarLogo().then(function (logo) {
        var JS = global.jspdf.jsPDF;
        var doc = new JS({ unit: "mm", format: "a4", compress: true });

        /* Uma trava só, por onde todo texto passa. */
        var escrever = doc.text.bind(doc);
        var medir = doc.splitTextToSize.bind(doc);
        doc.text = function (t, x, y, o) {
          return escrever(Array.isArray(t) ? t.map(asc) : asc(t), x, y, o);
        };
        doc.splitTextToSize = function (t, l, o) { return medir(asc(t), l, o); };

        var L = 18, DIR = 210 - L, LARG = 210 - L * 2;
        var y = 0;

        function cabe(alt) {
          if (y + (alt || 6) > 272) { doc.addPage(); y = 26; return true; }
          return false;
        }

        function titulo(txt) {
          cabe(18);
          y += 5;
          doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
          doc.rect(L, y - 4, 2.4, 6.5, "F");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(12.5);
          doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
          doc.text(txt, L + 6.5, y);
          y += 3.5;
          doc.setDrawColor(222, 228, 235);
          doc.line(L, y, DIR, y);
          y += 7.5;
        }

        function dado(rot, val) {
          var v = String(val == null || val === "" ? "—" : val);
          var partes = doc.splitTextToSize(v, LARG - 46);
          cabe(partes.length * 5 + 2);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9.5);
          doc.setTextColor(CINZA[0], CINZA[1], CINZA[2]);
          doc.text(rot, L, y);
          doc.setTextColor(TINTA[0], TINTA[1], TINTA[2]);
          partes.forEach(function (l, i) { doc.text(l, L + 46, y + i * 5); });
          y += partes.length * 5 + 1.2;
        }

        /* NOME DE SÓCIO NÃO É RÓTULO.

           Estes sócios saíam por `dado(nome, cpf)`, e `dado`
           desenha o rótulo em x=L e o valor numa coluna fixa, 46mm
           adiante. Serve para "CNPJ" e "Regime", que são curtos.
           Um nome completo passa dos 46mm — e o CPF era escrito
           EM CIMA das últimas letras do nome.

           Aqui o nome é conteúdo e ocupa a linha inteira; o CPF vem
           depois dele, em cinza, se couber, e desce uma linha
           quando não couber. */
        function socio(nome, cpf) {
          var n = String(nome || "Sócio");
          var c = String(cpf || "");
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9.5);

          var linhas = doc.splitTextToSize(n, LARG);
          var ultima = linhas[linhas.length - 1];
          var largUltima = doc.getTextWidth(ultima);
          /* Decidido ANTES de desenhar: a altura precisa ser
             conhecida para `cabe` não quebrar a página no meio do
             sócio, deixando o nome numa folha e o CPF na outra. */
          var juntos = !c || (largUltima + 4 + doc.getTextWidth(c) <= LARG);
          var alt = (linhas.length + (juntos ? 0 : 1)) * 5 + 2;
          cabe(alt);

          doc.setTextColor(TINTA[0], TINTA[1], TINTA[2]);
          linhas.forEach(function (l, i) { doc.text(l, L, y + i * 5); });

          if (c) {
            doc.setTextColor(CINZA[0], CINZA[1], CINZA[2]);
            if (juntos) doc.text(c, L + largUltima + 4, y + (linhas.length - 1) * 5);
            else doc.text(c, L, y + linhas.length * 5);
          }
          y += alt - 0.8;
        }

        function paragrafo(txt, tam, cor) {
          var cc = cor || CINZA;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(tam || 9.5);
          doc.setTextColor(cc[0], cc[1], cc[2]);
          doc.splitTextToSize(String(txt), LARG).forEach(function (l) {
            cabe(6);
            doc.text(l, L, y);
            y += 5;
          });
          y += 2;
        }

        /* ---- capa ---- */
        doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
        doc.rect(0, 0, 210, 62, "F");
        doc.setFillColor(OURO[0], OURO[1], OURO[2]);
        doc.rect(0, 62, 210, 2, "F");

        if (logo) {
          try { doc.addImage(logo, "PNG", L, 14, 38, 14.4); } catch (er) { /* segue */ }
        }
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.text("Dossiê de Entrada", L, 44);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(214, 198, 156);
        doc.text("Registro da documentação recebida no início do contrato", L, 52);

        y = 78;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(17);
        doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
        doc.splitTextToSize(d.nome, LARG).forEach(function (l) { doc.text(l, L, y); y += 7.5; });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(CINZA[0], CINZA[1], CINZA[2]);
        doc.text("Emitido em " + dataHora(em), L, y);
        y += 12;

        /* ---- o que este documento diz ---- */
        titulo("Identificação");
        dado("Razão social", d.empresa.razaoSocial);
        dado("Nome fantasia", d.empresa.nomeFantasia);
        dado("CNPJ", d.empresa.cnpj);
        dado("Regime tributário", d.empresa.regime);
        dado("Responsável", d.empresa.responsavelNome);
        dado("Função", d.empresa.responsavelCargo);
        dado("E-mail", d.empresa.responsavelEmail);
        dado("Telefone", d.empresa.responsavelTelefone);
        dado("Aceite da LGPD", d.empresa.aceiteLGPD ? dataHora(d.empresa.aceiteLGPD) : "");

        titulo("Sócios");
        if (!d.socios.length) paragrafo("Nenhum sócio cadastrado.");
        else d.socios.forEach(function (s) { socio(s.nome, s.cpf); });

        /* ---- o coração do dossiê ---- */
        titulo("Documentos recebidos");
        if (!d.recebidos.length) {
          paragrafo("Nenhum documento foi recebido até a emissão deste dossiê.");
        } else {
          paragrafo(d.recebidos.length + " " +
            plural(d.recebidos.length, "documento recebido", "documentos recebidos") +
            (d.temCarimbo
              ? ". As datas são carimbadas pelo servidor."
              : ". Sem carimbo do servidor nesta empresa; as datas são as do envio."),
            9);
          d.recebidos.forEach(function (l) { linhaDocumento(l); });
        }

        if (d.naoAplicaveis.length) {
          titulo("Documentos que não se aplicam");
          paragrafo("Ficou definido que estes documentos não se aplicam a esta empresa. " +
            "Os marcados como decisão da Totali foram avaliados pela equipe; os demais " +
            "foram indicados pelo próprio cliente.", 9);
          d.naoAplicaveis.forEach(function (l) {
            cabe(8);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9.5);
            doc.setTextColor(TINTA[0], TINTA[1], TINTA[2]);
            doc.text(doc.splitTextToSize(l.nome, LARG - 46)[0], L + 4, y);
            doc.setFontSize(8.5);
            doc.setTextColor(CINZA[0], CINZA[1], CINZA[2]);
            doc.text(l.decidiuEquipe ? "decisão da Totali" : "indicado pelo cliente", DIR, y,
                     { align: "right" });
            y += 5.4;
          });
          y += 2;
        }

        if (d.pendentes.length) {
          titulo("Ainda não recebidos");
          paragrafo("Na data desta emissão, os documentos abaixo ainda não haviam sido " +
            "entregues.", 9);
          d.pendentes.forEach(function (l) {
            cabe(7);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9.5);
            doc.setTextColor(TINTA[0], TINTA[1], TINTA[2]);
            doc.text(doc.splitTextToSize(l.nome, LARG - 46)[0], L + 4, y);
            doc.setFontSize(8.5);
            doc.setTextColor(CINZA[0], CINZA[1], CINZA[2]);
            doc.text(l.grupo, DIR, y, { align: "right" });
            y += 5.4;
          });
          y += 2;
        }

        /* ---- declarações do cliente ---- */
        titulo("Declarações do cliente");
        var f = d.financeiro;
        if (!f) {
          paragrafo("O cliente ainda não respondeu a etapa financeira.");
        } else {
          var forma = (global.DATA.FORMAS_RELATORIO || []).filter(function (x) {
            return x.id === f.formaRelatorio;
          })[0];
          var junta = function (arr, outro) {
            var t = (arr || []).slice();
            if (outro) t.push(outro);
            return t.join(", ");
          };
          var sn = function (v) { return v === "sim" ? "Sim" : v === "nao" ? "Não" : "não respondido"; };

          dado("Protocolo", f.protocolo);
          dado("Concluído em", f.concluidoEm ? dataHora(f.concluidoEm) : "");
          dado("Contas em banco", junta(f.bancos, f.bancoOutro) ||
                                  (f.temBanco === "nao" ? "declarou não ter" : ""));
          dado("Maquininhas", junta(f.maquinetas, f.maquinetaOutra) ||
                              (f.temMaquineta === "nao" ? "declarou não ter" : ""));
          dado("Envio dos relatórios", forma ? forma.titulo : "");
          y += 2;
          dado("Relatório de contas pagas", sn(f.contasPagas));
          if (f.contasPagas === "sim") dado("Sistema utilizado", f.contasPagasSistema);
          dado("Empréstimo ou financiamento", sn(f.emprestimo));
          dado("Aplicações financeiras", sn(f.aplicacoes));
          if (f.observacoes) { y += 2; dado("Observações", f.observacoes); }
        }

        /* ---- acesso ao portal ---- */
        titulo("Acesso ao portal");
        if (!d.acessos.length) {
          paragrafo("Ninguém acessou o portal desta empresa até a emissão deste dossiê.");
        } else {
          d.acessos.forEach(function (a) {
            dado(a.origem === "equipe" ? "Acesso criado pela equipe" : "Acesso criado por convite",
                 dataHora(a.em));
          });
        }

        /* ---- fecho ---- */
        titulo("Sobre este documento");
        paragrafo("Este dossiê registra a documentação recebida pela " + ORG.nome +
          " no início do contrato com " + d.nome + ", conforme consta no Portal do Cliente " +
          "na data de emissão." +
          (d.temCarimbo
            ? " As datas de recebimento e aprovação são carimbadas pelo servidor no momento " +
              "do fato e não podem ser alteradas nem pelo cliente nem pela equipe."
            : "") +
          " Senhas e credenciais não são reproduzidas aqui.", 9.5);

        /* ---- rodapé ---- */
        var total = doc.getNumberOfPages();
        for (var i = 1; i <= total; i++) {
          doc.setPage(i);
          doc.setDrawColor(222, 228, 235);
          doc.line(L, 283, DIR, 283);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7.5);
          doc.setTextColor(CINZA[0], CINZA[1], CINZA[2]);
          doc.text(ORG.nome + " · " + ORG.telefoneExibicao + " · " + ORG.email, L, 288);
          doc.text("Dossiê de entrada · " + i + "/" + total, DIR, 288, { align: "right" });
        }

        return { blob: doc.output("blob"), nome: nomeDoArquivo(d.nome, em), em: em };

        /* Uma linha de documento recebido, com as datas que valem. */
        function linhaDocumento(l) {
          cabe(l.arquivos.length ? 12 : 9);
          doc.setFillColor(VERDE[0], VERDE[1], VERDE[2]);
          doc.circle(L + 1.6, y - 1.2, 1.3, "F");

          doc.setFont("helvetica", "normal");
          doc.setFontSize(9.5);
          doc.setTextColor(TINTA[0], TINTA[1], TINTA[2]);
          doc.text(doc.splitTextToSize(l.nome, LARG - 52)[0], L + 6, y);

          doc.setFontSize(8.5);
          doc.setTextColor(CINZA[0], CINZA[1], CINZA[2]);
          var quando = l.recebido || l.recebidoLocal;
          doc.text(quando ? "recebido " + data(quando) : "", DIR, y, { align: "right" });
          y += 4.8;

          var detalhe = [l.grupo];
          if (l.arquivos.length) detalhe.push(l.arquivos.join(", "));
          if (l.valor) detalhe.push(l.valor);
          if (l.aprovado) {
            detalhe.push("aprovado em " + data(l.aprovado) +
                         (l.aprovadoPor ? " por " + l.aprovadoPor : ""));
          }
          doc.setFontSize(8.5);
          doc.setTextColor(CINZA[0], CINZA[1], CINZA[2]);
          doc.splitTextToSize(detalhe.join(" · "), LARG - 8).forEach(function (ln) {
            cabe(5);
            doc.text(ln, L + 6, y);
            y += 4.4;
          });
          y += 1.6;
        }
      });
    });
  }

  /* Branca, não colorida: o cabeçalho é faixa NAVY e a versão
     colorida tem as letras escuras. Mesmo motivo da ficha. */
  function carregarLogo() {
    return fetch("assets/totali-portal-branca.png")
      .then(function (r) { return r.ok ? r.blob() : null; })
      .then(function (b) {
        if (!b) return null;
        return new Promise(function (res) {
          var fr = new FileReader();
          fr.onload = function () { res(fr.result); };
          fr.onerror = function () { res(null); };
          fr.readAsDataURL(b);
        });
      })
      .catch(function () { return null; });
  }

  global.DossiePDF = { gerar: gerar, nomeDoArquivo: nomeDoArquivo };
})(window);
