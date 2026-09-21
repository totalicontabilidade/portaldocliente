/* ============================================================
   Totali · Portal do Cliente
   dados.js — a camada de dados: UMA API, dois motores

   Tudo que o portal e o painel leem ou gravam passa por `Dados`.
   Por baixo há dois motores, escolhidos na carga:

     LOCAL     enquanto js/firebase-config.js estiver com "COLE_".
               Estado em localStorage (`totali-portal-db`) e arquivos
               em IndexedDB. Nasce com dados de exemplo FICTÍCIOS —
               nenhum cliente real entra no código. Serve para ver,
               avaliar e demonstrar o sistema sem servidor.

     FIREBASE  quando a configuração existe. Firestore + Auth +
               Storage (SDK compat vendorizado em lib/). O modelo de
               dados está em docs/01-arquitetura.md e as regras em
               firestore.rules.

   A API é toda assíncrona (Promises), para o portal não saber com
   qual motor está falando. Eventos: `dados:mudou` é disparado no
   documento quando algo muda (o motor local usa o evento `storage`
   para as duas abas — portal e painel — se enxergarem).

   MODELO (resumo; detalhe em docs/01-arquitetura.md)
     empresas/{id}                  cadastro, gerente, perfis[], liberacoes{}, jornada{}
     empresas/{id}/acessos/{uid}
     empresas/{id}/mensagens/{id}   autor{uid,nome,lado}, texto, anexos[], em, lidaPor{}
     empresas/{id}/documentos/{id}  nome, grupo, origem, arquivo{}, situacao, revisao{}, vistos[]
     empresas/{id}/credenciais/{id} rotulo, tipo, pacote (envelope cifrado)
     empresas/{id}/checklist/{anoMes}
     usuarios/{uid}                 equipe: nome, email, papel, setor
     uso/{id}                       auditoria de uso (quem abriu o quê, quando, por quanto tempo)
     auditoria/{id}                 trilha do servidor (Cloud Function)
     vitrine/{id}                   campanhas
     conteudo/{jornada|catalogo}    o que a equipe publica
     convites/{codigo}              acesso do cliente (queima ao usar)
     anterior/{codigo}              link de envio da contabilidade anterior
   ============================================================ */
(function (global) {
  "use strict";
  var U = global.U;

  var CHAVE_DB = "totali-portal-db";
  var CHAVE_SESSAO = "totali-portal-sessao";
  var NOME_APP = (location.pathname.indexOf("equipe") > -1) ? "painel" : "portal";   /* sessões separadas por página (lição do Academy) */

  function configurado() {
    var c = global.FIREBASE_CONFIG;
    return !!(c && c.apiKey && c.projectId && String(c.apiKey).indexOf("COLE_") !== 0 && typeof global.firebase !== "undefined");
  }

  function avisar(tipo, detalhe) {
    document.dispatchEvent(new CustomEvent("dados:mudou", { detail: { tipo: tipo, detalhe: detalhe || null } }));
  }

  /* ============================================================
     IndexedDB mínimo, para os ARQUIVOS do modo local
     ============================================================ */
  var IDB = {
    db: null,
    abrir: function () {
      if (IDB.db) return Promise.resolve(IDB.db);
      return new Promise(function (res, rej) {
        var r = indexedDB.open("totali-portal-arquivos", 1);
        r.onupgradeneeded = function () { r.result.createObjectStore("arquivos", { keyPath: "id" }); };
        r.onsuccess = function () { IDB.db = r.result; res(IDB.db); };
        r.onerror = function () { rej(r.error); };
      });
    },
    guardar: function (id, blob, nome, mime) {
      return IDB.abrir().then(function (db) {
        return new Promise(function (res, rej) {
          var t = db.transaction("arquivos", "readwrite");
          t.objectStore("arquivos").put({ id: id, blob: blob, nome: nome, mime: mime });
          t.oncomplete = function () { res(id); }; t.onerror = function () { rej(t.error); };
        });
      });
    },
    ler: function (id) {
      return IDB.abrir().then(function (db) {
        return new Promise(function (res, rej) {
          var r = db.transaction("arquivos").objectStore("arquivos").get(id);
          r.onsuccess = function () { res(r.result || null); }; r.onerror = function () { rej(r.error); };
        });
      });
    },
    apagar: function (id) {
      return IDB.abrir().then(function (db) {
        return new Promise(function (res) { var t = db.transaction("arquivos", "readwrite"); t.objectStore("arquivos").delete(id); t.oncomplete = res; t.onerror = res; });
      });
    },
    limpar: function () {
      return IDB.abrir().then(function (db) {
        return new Promise(function (res) { var t = db.transaction("arquivos", "readwrite"); t.objectStore("arquivos").clear(); t.oncomplete = res; t.onerror = res; });
      });
    }
  };

  /* ============================================================
     SEMENTE do modo local — empresas e pessoas FICTÍCIAS
     ============================================================ */
  function semente() {
    var agora = Date.now(), D = U.DIA_MS;
    var equipe = [
      { uid: "eq_admin", nome: "Administrador Totali", email: "admin@totali.demo", papel: "admin", setor: "Direção", criadoEm: agora - 300 * D },
      { uid: "eq_marina", nome: "Marina Santos", email: "marina@totali.demo", papel: "equipe", setor: "Gerente de contas", criadoEm: agora - 200 * D },
      { uid: "eq_carlos", nome: "Carlos Lima", email: "carlos@totali.demo", papel: "equipe", setor: "Implantação", criadoEm: agora - 150 * D }
    ];
    var empresas = {
      emp_padaria: {
        id: "emp_padaria", nome: "Padaria Estrela do Sul Ltda", fantasia: "Padaria Estrela do Sul", cnpj: "12.345.678/0001-90", regime: "Simples Nacional",
        perfis: ["com-funcionarios"], trilha: "B", gerenteUid: "eq_marina", gerenteNome: "Marina Santos", ativa: true, criadaEm: agora - 9 * D,
        canalPreferido: "whatsapp", formaRelatorio: "portal", dor: "Não sabe quanto sobra no fim do mês; nunca recebeu um DRE explicado.",
        liberacoes: { checklist: { ativo: true, desde: agora - 9 * D, ate: 0, plano: "cortesia 30 dias" }, academy: { ativo: true, desde: agora - 9 * D }, ponto: { ativo: true, desde: agora - 5 * D, plano: "mensal" } },
        jornada: { aceiteEm: agora - 8 * D, passos: {
          "d0.e.2": { em: agora - 8 * D, por: "Marina Santos" }, "d0.e.3": { em: agora - 8 * D, por: "Marina Santos" }, "d0.e.4": { em: agora - 8 * D, por: "Marina Santos" }, "d0.e.5": { em: agora - 8 * D, por: "Marina Santos" },
          "d0.c.1": { em: agora - 8 * D, por: "Marina Santos" },
          "d1.e.2": { em: agora - 7 * D, por: "Marina Santos" }, "d1.c.2": { em: agora - 7 * D, por: "cliente" }, "d1.c.3": { em: agora - 7 * D, por: "cliente" },
          "d2.e.0": { em: agora - 6 * D, por: "Marina Santos" }, "d2.e.1": { em: agora - 6 * D, por: "Marina Santos" }, "d2.e.2": { em: agora - 6 * D, por: "Marina Santos" }, "d2.e.3": { em: agora - 6 * D, por: "Marina Santos" }, "d2.e.4": { em: agora - 6 * D, por: "Marina Santos" },
          "d2.c.0": { em: agora - 6 * D, por: "cliente" }, "d2.c.1": { em: agora - 6 * D, por: "cliente" }, "d2.c.2": { em: agora - 6 * D, por: "cliente" },
          "d5.e.0": { em: agora - 3 * D, por: "Carlos Lima" }, "d5.e.2": { em: agora - 3 * D, por: "Carlos Lima" }, "d5.c.2": { em: agora - 2 * D, por: "cliente" }
        }, notas: { d2: "Dor principal: não entende o resultado do mês. Entrega D15: DRE simplificado com 5 linhas + áudio explicando." } },
        acessos: [{ uid: "cli_joana", nome: "Joana Ribeiro", email: "joana@estreladosul.demo", criadoEm: agora - 7 * D, ultimoAcesso: agora - 3600000 }]
      },
      emp_vega: {
        id: "emp_vega", nome: "Studio Vega Comunicação Ltda", fantasia: "Studio Vega", cnpj: "23.456.789/0001-01", regime: "Simples Nacional",
        perfis: ["com-funcionarios", "agencias"], trilha: "B", gerenteUid: "eq_marina", gerenteNome: "Marina Santos", ativa: true, criadaEm: agora - 75 * D,
        canalPreferido: "portal", formaRelatorio: "email", dor: "Não sabe qual cliente dá lucro.",
        liberacoes: { checklist: { ativo: true, desde: agora - 75 * D, plano: "mensal" }, academy: { ativo: true, desde: agora - 75 * D }, agencia100k: { ativo: true, desde: agora - 60 * D, plano: "mensal" }, ponto: { ativo: true, desde: agora - 40 * D, plano: "mensal" } },
        jornada: { aceiteEm: agora - 74 * D, passos: {}, concluidaEm: agora - 44 * D, notas: {} },
        acessos: [{ uid: "cli_pedro", nome: "Pedro Alves", email: "pedro@studiovega.demo", criadoEm: agora - 73 * D, ultimoAcesso: agora - 2 * D }]
      },
      emp_clinica: {
        id: "emp_clinica", nome: "Clínica Bem Viver Serviços Médicos Ltda", fantasia: "Clínica Bem Viver", cnpj: "34.567.890/0001-12", regime: "Lucro Presumido",
        perfis: ["com-funcionarios"], trilha: "C", gerenteUid: "eq_carlos", gerenteNome: "Carlos Lima", ativa: true, criadaEm: agora - 4 * D,
        canalPreferido: "", formaRelatorio: "", dor: "",
        liberacoes: { checklist: { ativo: true, desde: agora - 4 * D, ate: agora + 26 * D, plano: "cortesia 30 dias" }, academy: { ativo: true, desde: agora - 4 * D } },
        jornada: { aceiteEm: agora - 4 * D, passos: { "d0.c.1": { em: agora - 4 * D, por: "Carlos Lima" }, "d0.e.2": { em: agora - 4 * D, por: "Carlos Lima" } }, notas: {} },
        acessos: []
      },
      emp_oficina: {
        id: "emp_oficina", nome: "Oficina Rota 101 Ltda", fantasia: "Oficina Rota 101", cnpj: "45.678.901/0001-23", regime: "Simples Nacional",
        perfis: ["com-funcionarios"], trilha: "A", gerenteUid: "eq_marina", gerenteNome: "Marina Santos", ativa: true, criadaEm: agora - 120 * D,
        canalPreferido: "whatsapp", formaRelatorio: "whatsapp", dor: "",
        liberacoes: { checklist: { ativo: true, desde: agora - 120 * D, plano: "mensal" }, academy: { ativo: true, desde: agora - 120 * D }, gerescisao: { ativo: true, desde: agora - 20 * D, plano: "avulso" } },
        jornada: { aceiteEm: agora - 119 * D, passos: {}, concluidaEm: agora - 89 * D, notas: {} },
        acessos: [{ uid: "cli_rita", nome: "Rita Nascimento", email: "rita@rota101.demo", criadoEm: agora - 118 * D, ultimoAcesso: agora - 6 * D }]
      }
    };
    /* Para "todos os passos feitos" das jornadas concluídas, marca tudo */
    ["emp_vega", "emp_oficina"].forEach(function (id) {
      var e = empresas[id];
      (global.JORNADA ? global.JORNADA.DIAS : []).forEach(function (d) {
        d.cliente.forEach(function (_, i) { e.jornada.passos["d" + d.dia + ".c." + i] = { em: e.jornada.aceiteEm + d.dia * D, por: "cliente" }; });
        d.equipe.forEach(function (_, i) { e.jornada.passos["d" + d.dia + ".e." + i] = { em: e.jornada.aceiteEm + d.dia * D, por: e.gerenteNome }; });
      });
    });

    var clientes = {
      cli_joana: { uid: "cli_joana", nome: "Joana Ribeiro", email: "joana@estreladosul.demo", empresas: ["emp_padaria"], papel: "cliente" },
      cli_pedro: { uid: "cli_pedro", nome: "Pedro Alves", email: "pedro@studiovega.demo", empresas: ["emp_vega"], papel: "cliente" },
      cli_rita: { uid: "cli_rita", nome: "Rita Nascimento", email: "rita@rota101.demo", empresas: ["emp_oficina"], papel: "cliente" }
    };

    var msg = function (empresaId, lado, nome, uid, texto, ha, lida) {
      return { id: U.id("m"), empresaId: empresaId, autor: { uid: uid, nome: nome, lado: lado }, texto: texto, anexos: [], em: agora - ha, lidaPor: lida ? { eq_marina: agora - ha + 60000, cli_joana: agora - ha + 60000 } : {}, reacoes: {} };
    };
    var mensagens = [
      msg("emp_padaria", "equipe", "Marina Santos", "eq_marina", "Oi, Joana! Bem-vinda à Totali 😊 Eu sou a Marina, sua gerente de contas. Qualquer dúvida é por aqui mesmo.", 7 * D, true),
      msg("emp_padaria", "cliente", "Joana Ribeiro", "cli_joana", "Oi Marina! Obrigada 🙏 Já entrei no portal. Onde eu mando o certificado digital?", 7 * D - 3600000, true),
      msg("emp_padaria", "equipe", "Marina Santos", "eq_marina", "Em Documentos › Certificado digital. Se for A1, é o arquivo .pfx e a senha vai no cofre de senhas 🔐", 7 * D - 3900000, true),
      msg("emp_padaria", "cliente", "Joana Ribeiro", "cli_joana", "Enviei! 📎 Também guardei a senha do Simples.", 2 * D, true),
      msg("emp_padaria", "equipe", "Marina Santos", "eq_marina", "Recebido e aprovado ✅ Amanhã te mando o passo a passo do e-CAC.", 2 * D - 1800000, false),
      msg("emp_vega", "cliente", "Pedro Alves", "cli_pedro", "Marina, o relatório de margem do Agência 100K está saindo diferente do mês passado 🤔", 2 * D, true),
      msg("emp_vega", "equipe", "Marina Santos", "eq_marina", "Vi aqui, Pedro. Mudou a competência de custos. Te explico em áudio 🎧", 2 * D - 7200000, true),
      msg("emp_oficina", "cliente", "Rita Nascimento", "cli_rita", "Preciso demitir um funcionário essa semana, o que preciso mandar?", 6 * D, false)
    ];

    var doc = function (empresaId, nome, grupo, origem, situacao, ha, por, vistos) {
      return { id: U.id("d"), empresaId: empresaId, nome: nome, grupo: grupo, origem: origem, situacao: situacao, em: agora - ha, por: por,
        arquivo: { id: "", nome: nome, tamanho: 240000 + Math.round(Math.random() * 900000), mime: /pdf$/i.test(nome) ? "application/pdf" : "image/jpeg" },
        revisao: situacao === "aprovado" ? { por: "Marina Santos", em: agora - ha + 3600000 } : situacao === "pendencia" ? { por: "Marina Santos", em: agora - ha + 3600000, motivo: "A foto está cortada. Pode reenviar mostrando o documento inteiro?" } : null,
        vistos: vistos || [] };
    };
    var documentos = [
      doc("emp_padaria", "certificado-a1.pfx", "certificado", "cliente", "aprovado", 2 * D, "Joana Ribeiro", [{ por: "Marina Santos", em: agora - 2 * D + 1800000 }]),
      doc("emp_padaria", "contrato-social.pdf", "societario", "anterior", "aprovado", 3 * D, "Contabilidade anterior", [{ por: "Carlos Lima", em: agora - 3 * D + 7200000 }]),
      doc("emp_padaria", "rg-joana.jpg", "socios", "cliente", "pendencia", 4 * D, "Joana Ribeiro", [{ por: "Marina Santos", em: agora - 4 * D + 3600000 }]),
      doc("emp_padaria", "balancete-2026-08.pdf", "contabil", "anterior", "enviado", 1 * D, "Contabilidade anterior", []),
      doc("emp_vega", "extrato-agosto.pdf", "mensal", "cliente", "aprovado", 20 * D, "Pedro Alves", [{ por: "Marina Santos", em: agora - 19 * D }]),
      doc("emp_oficina", "aviso-previo.pdf", "pessoal", "cliente", "enviado", 5 * D, "Rita Nascimento", [])
    ];

    var credenciais = [
      { id: U.id("c"), empresaId: "emp_padaria", rotulo: "Simples Nacional (código de acesso)", tipo: "portal", usuario: "12.345.678/0001-90", em: agora - 2 * D, por: "Joana Ribeiro", pacote: { demo: true, segredo: btoa("SN-2026-demo") } },
      { id: U.id("c"), empresaId: "emp_padaria", rotulo: "Senha do certificado A1", tipo: "certificado", usuario: "", em: agora - 2 * D, por: "Joana Ribeiro", pacote: { demo: true, segredo: btoa("pfx-demo-1234") } }
    ];

    /* Uso: 30 dias de eventos plausíveis */
    var uso = [];
    var perfisUso = [
      ["emp_padaria", "cli_joana", "Joana Ribeiro", ["checklist", "academy", "ponto", "portal", "portal"]],
      ["emp_vega", "cli_pedro", "Pedro Alves", ["agencia100k", "checklist", "ponto", "portal"]],
      ["emp_oficina", "cli_rita", "Rita Nascimento", ["checklist", "gerescisao", "portal"]]
    ];
    var semente = 7;
    var rnd = function () { semente = (semente * 9301 + 49297) % 233280; return semente / 233280; };
    perfisUso.forEach(function (p) {
      for (var dia = 0; dia < 30; dia++) {
        if (rnd() < 0.35) continue;
        var n = 1 + Math.floor(rnd() * 3);
        for (var k = 0; k < n; k++) {
          var sis = p[3][Math.floor(rnd() * p[3].length)];
          var em = agora - dia * D - Math.floor(rnd() * 12 * 3600000);
          uso.push({ id: U.id("u"), empresaId: p[0], uid: p[1], nome: p[2], sistemaId: sis, tipo: "abrir", em: em, duracaoS: 120 + Math.floor(rnd() * 1500), dispositivo: rnd() < 0.7 ? "celular" : "computador" });
        }
      }
    });

    var mes = U.anoMes(agora), mesAnt = U.anoMes(agora - 31 * D);
    var itensChecklist = function (feitos) {
      var base = [
        { id: "extratos", texto: "Extratos bancários de todas as contas", prazoDia: 5 },
        { id: "notas-venda", texto: "Notas fiscais de venda (XML ou relatório)", prazoDia: 8 },
        { id: "notas-compra", texto: "Notas de compra e despesas", prazoDia: 8 },
        { id: "maquininhas", texto: "Relatório das maquininhas", prazoDia: 8 },
        { id: "folha", texto: "Alterações na folha (admissão, férias, faltas)", prazoDia: 10 },
        { id: "impostos", texto: "Comprovantes dos impostos pagos", prazoDia: 20 }
      ];
      return base.map(function (b, i) { return Object.assign({}, b, { feito: i < feitos, feitoEm: i < feitos ? agora - (20 - i) * D : 0, aceite: i < feitos - 1 ? { por: "Marina Santos", em: agora - (19 - i) * D } : null }); });
    };
    var checklists = [
      { empresaId: "emp_padaria", anoMes: mes, itens: itensChecklist(2), atualizadoEm: agora - D },
      { empresaId: "emp_vega", anoMes: mes, itens: itensChecklist(6), concluidoEm: agora - 2 * D, atualizadoEm: agora - 2 * D },
      { empresaId: "emp_vega", anoMes: mesAnt, itens: itensChecklist(6), concluidoEm: agora - 33 * D, atualizadoEm: agora - 33 * D },
      { empresaId: "emp_oficina", anoMes: mes, itens: itensChecklist(4), atualizadoEm: agora - 3 * D },
      { empresaId: "emp_oficina", anoMes: mesAnt, itens: itensChecklist(6), concluidoEm: agora - 35 * D, atualizadoEm: agora - 35 * D },
      { empresaId: "emp_clinica", anoMes: mes, itens: itensChecklist(0), atualizadoEm: agora - 4 * D }
    ];

    var auditoria = [
      { id: U.id("a"), empresaId: "emp_padaria", tipo: "documento:aprovado", por: "Marina Santos", em: agora - 2 * D + 1800000, detalhe: "certificado-a1.pfx" },
      { id: U.id("a"), empresaId: "emp_padaria", tipo: "credencial:aberta", por: "Carlos Lima", em: agora - D, detalhe: "Simples Nacional" },
      { id: U.id("a"), empresaId: "emp_padaria", tipo: "liberacao:ativada", por: "Administrador Totali", em: agora - 5 * D, detalhe: "ponto" }
    ];

    return {
      versao: 1, criadoEm: agora,
      equipe: equipe, empresas: empresas, clientes: clientes, mensagens: mensagens, documentos: documentos, credenciais: credenciais,
      uso: uso, checklists: checklists, auditoria: auditoria, vitrine: [], conteudo: {}, convites: {}, anterior: {}, feedback: {},
      /* Coleções genéricas (extratos, indicações, entregas, resumos…): caminho → {id: doc} */
      generico: {}
    };
  }

  /* ============================================================
     MOTOR LOCAL
     ============================================================ */
  var Local = (function () {
    var db = null;
    function carregar() {
      if (db) return db;
      try { db = JSON.parse(localStorage.getItem(CHAVE_DB) || "null"); } catch (e) { db = null; }
      if (!db || db.versao !== 1) { db = semente(); gravar(); }
      /* Campos que entraram depois da primeira semente: um banco antigo no navegador não pode quebrar o portal */
      if (!db.generico) db.generico = {};
      return db;
    }
    function gravar(tipo, detalhe) {
      try { localStorage.setItem(CHAVE_DB, JSON.stringify(db)); } catch (e) { console.warn("localStorage cheio", e); }
      avisar(tipo || "geral", detalhe);
    }
    global.addEventListener("storage", function (e) {
      if (e.key === CHAVE_DB) { db = null; carregar(); avisar("remoto"); }
      if (e.key === CHAVE_SESSAO + "-" + NOME_APP) avisar("sessao");
    });

    function sessao() { try { return JSON.parse(localStorage.getItem(CHAVE_SESSAO + "-" + NOME_APP) || "null"); } catch (e) { return null; } }
    function definirSessao(s) { if (s) localStorage.setItem(CHAVE_SESSAO + "-" + NOME_APP, JSON.stringify(s)); else localStorage.removeItem(CHAVE_SESSAO + "-" + NOME_APP); avisar("sessao"); }
    function ok(v) { return Promise.resolve(U.clonar(v === undefined ? null : v)); }
    function empresaPublica(e) { if (!e) return null; var c = U.clonar(e); return c; }

    return {
      nome: "local",
      pronto: function () { carregar(); return ok(true); },
      sessao: function () { return sessao(); },
      entrar: function (email, senha) {
        carregar();
        var em = String(email || "").trim().toLowerCase();
        if (!em) return Promise.reject(new Error("Informe o e-mail."));
        var eq = db.equipe.filter(function (u) { return u.email === em; })[0];
        if (eq && NOME_APP === "painel") { var s = { uid: eq.uid, nome: eq.nome, email: eq.email, papel: eq.papel, setor: eq.setor, setores: eq.setores || [] }; definirSessao(s); return ok(s); }
        var cl = null; Object.keys(db.clientes).forEach(function (k) { if (db.clientes[k].email === em) cl = db.clientes[k]; });
        if (cl && NOME_APP === "portal") {
          var s2 = { uid: cl.uid, nome: cl.nome, email: cl.email, papel: "cliente", empresas: cl.empresas, empresaId: cl.empresas[0] };
          definirSessao(s2);
          var e = db.empresas[s2.empresaId]; (e.acessos || []).forEach(function (a) { if (a.uid === cl.uid) a.ultimoAcesso = Date.now(); });
          gravar("acesso");
          return ok(s2);
        }
        return Promise.reject(new Error(NOME_APP === "painel" ? "E-mail não é da equipe. No modo demo use admin@totali.demo." : "E-mail não encontrado. No modo demo use joana@estreladosul.demo."));
      },
      entrarAnonimo: function () { return ok("anon"); },
      entrarDemo: function (qual) {
        return NOME_APP === "painel" ? Local.entrar(qual === "equipe" ? "marina@totali.demo" : "admin@totali.demo") : Local.entrar(qual === "novo" ? "" : qual === "agencia" ? "pedro@studiovega.demo" : "joana@estreladosul.demo");
      },
      sair: function () { if (global.Seguranca) global.Seguranca.limparAparelho(); definirSessao(null); return ok(true); },
      trocarEmpresa: function (empresaId) { var s = sessao(); if (s && (s.empresas || []).indexOf(empresaId) > -1) { s.empresaId = empresaId; definirSessao(s); } return ok(s); },

      /* empresas */
      empresa: function (id) { carregar(); return ok(empresaPublica(db.empresas[id])); },
      listarEmpresas: function () { carregar(); return ok(Object.keys(db.empresas).map(function (k) { return empresaPublica(db.empresas[k]); })); },
      salvarEmpresa: function (id, campos) { carregar(); var e = db.empresas[id]; if (!e) return Promise.reject(new Error("Empresa não existe")); Object.assign(e, campos); gravar("empresa", id); return ok(e); },
      criarEmpresa: function (dados, por) {
        carregar();
        var id = "emp_" + U.slug(dados.fantasia || dados.nome).replace(/-/g, "") + U.id().slice(-4);
        var e = { id: id, nome: dados.nome, fantasia: dados.fantasia || dados.nome, cnpj: dados.cnpj || "", regime: dados.regime || "", perfis: dados.perfis || [], trilha: dados.trilha || "A",
          gerenteUid: por.uid, gerenteNome: por.nome, ativa: true, criadaEm: Date.now(), canalPreferido: "", formaRelatorio: "", dor: "",
          liberacoes: { checklist: { ativo: true, desde: Date.now(), ate: Date.now() + 30 * U.DIA_MS, plano: "cortesia 30 dias" }, academy: { ativo: true, desde: Date.now() } },
          jornada: { aceiteEm: dados.aceiteEm || Date.now(), passos: { "d0.c.0": { em: Date.now(), por: por.nome }, "d0.e.0": { em: Date.now(), por: por.nome } }, notas: {} }, acessos: [] };
        db.empresas[id] = e;
        var codigo = U.codigo(22);
        db.convites[codigo] = { empresaId: id, criadoEm: Date.now(), por: por.nome, usado: false };
        db.auditoria.push({ id: U.id("a"), empresaId: id, tipo: "empresa:criada", por: por.nome, em: Date.now(), detalhe: e.fantasia });
        gravar("empresa", id);
        return ok({ empresa: e, convite: codigo });
      },
      liberar: function (empresaId, sistemaId, dados, por) {
        carregar(); var e = db.empresas[empresaId]; if (!e) return Promise.reject(new Error("Empresa não existe"));
        e.liberacoes = e.liberacoes || {};
        var atual = e.liberacoes[sistemaId] || {};
        e.liberacoes[sistemaId] = Object.assign({}, atual, dados, { desde: atual.desde || Date.now() });
        db.auditoria.push({ id: U.id("a"), empresaId: empresaId, tipo: dados.ativo ? "liberacao:ativada" : "liberacao:desativada", por: por.nome, em: Date.now(), detalhe: sistemaId });
        gravar("liberacao", empresaId);
        return ok(e.liberacoes[sistemaId]);
      },
      criarConvite: function (empresaId, por) { carregar(); var c = U.codigo(22); db.convites[c] = { empresaId: empresaId, criadoEm: Date.now(), por: por.nome, usado: false }; gravar("convite"); return ok(c); },
      convite: function (codigo) { carregar(); var c = db.convites[codigo]; if (!c || c.usado) return ok(null); var e = db.empresas[c.empresaId]; return ok({ codigo: codigo, empresaId: c.empresaId, empresa: e ? e.fantasia : "" }); },
      usarConvite: function (codigo, dados) {
        carregar(); var c = db.convites[codigo]; if (!c || c.usado) return Promise.reject(new Error("Convite inválido ou já usado."));
        var uid = "cli_" + U.id().slice(-8);
        db.clientes[uid] = { uid: uid, nome: dados.nome, email: String(dados.email).toLowerCase(), empresas: [c.empresaId], papel: "cliente" };
        var e = db.empresas[c.empresaId]; e.acessos = e.acessos || []; e.acessos.push({ uid: uid, nome: dados.nome, email: dados.email, criadoEm: Date.now(), ultimoAcesso: Date.now() });
        c.usado = true; c.usadoEm = Date.now();
        db.auditoria.push({ id: U.id("a"), empresaId: c.empresaId, tipo: "acesso:criado", por: dados.nome, em: Date.now(), detalhe: dados.email });
        gravar("acesso", c.empresaId);
        var s = { uid: uid, nome: dados.nome, email: dados.email, papel: "cliente", empresas: [c.empresaId], empresaId: c.empresaId };
        definirSessao(s);
        return ok(s);
      },

      /* jornada */
      marcarPasso: function (empresaId, chave, feito, por) {
        carregar(); var e = db.empresas[empresaId]; if (!e) return Promise.reject(new Error("Empresa não existe"));
        e.jornada = e.jornada || { aceiteEm: e.criadaEm, passos: {}, notas: {} }; e.jornada.passos = e.jornada.passos || {};
        if (feito) e.jornada.passos[chave] = { em: Date.now(), por: por.nome || por }; else delete e.jornada.passos[chave];
        gravar("jornada", empresaId); return ok(e.jornada);
      },
      salvarJornada: function (empresaId, campos) { carregar(); var e = db.empresas[empresaId]; e.jornada = Object.assign(e.jornada || {}, campos); gravar("jornada", empresaId); return ok(e.jornada); },

      /* mensagens */
      mensagens: function (empresaId) { carregar(); return ok(db.mensagens.filter(function (m) { return m.empresaId === empresaId; }).sort(function (a, b) { return a.em - b.em; })); },
      todasConversas: function () {
        carregar();
        var porEmp = U.agrupar(db.mensagens, function (m) { return m.empresaId; });
        return ok(Object.keys(db.empresas).map(function (id) {
          var ms = (porEmp[id] || []).sort(function (a, b) { return a.em - b.em; });
          var ultima = ms[ms.length - 1] || null;
          var naoLidas = ms.filter(function (m) { return m.autor.lado === "cliente" && !Object.keys(m.lidaPor || {}).some(function (u) { return u.indexOf("eq_") === 0; }); }).length;
          return { empresaId: id, empresa: db.empresas[id].fantasia, ultima: ultima, naoLidas: naoLidas, resolvida: !!(db.empresas[id].conversaResolvidaEm && ultima && db.empresas[id].conversaResolvidaEm >= ultima.em) };
        }).sort(function (a, b) { return (b.ultima ? b.ultima.em : 0) - (a.ultima ? a.ultima.em : 0); }));
      },
      enviarMensagem: function (empresaId, m) {
        carregar();
        var nova = { id: U.id("m"), empresaId: empresaId, autor: m.autor, texto: U.txt(m.texto, 4000), anexos: m.anexos || [], em: Date.now(), lidaPor: {}, reacoes: {} };
        nova.lidaPor[m.autor.uid] = Date.now();
        db.mensagens.push(nova);
        var e = db.empresas[empresaId]; if (e) delete e.conversaResolvidaEm;
        gravar("mensagem", empresaId); return ok(nova);
      },
      marcarLidas: function (empresaId, uid) {
        carregar(); var mudou = false;
        db.mensagens.forEach(function (m) { if (m.empresaId === empresaId && !(m.lidaPor || {})[uid]) { m.lidaPor = m.lidaPor || {}; m.lidaPor[uid] = Date.now(); mudou = true; } });
        if (mudou) gravar("lidas", empresaId); return ok(mudou);
      },
      reagir: function (empresaId, msgId, emoji, uid) {
        carregar(); var m = db.mensagens.filter(function (x) { return x.id === msgId; })[0]; if (!m) return ok(null);
        m.reacoes = m.reacoes || {}; m.reacoes[emoji] = m.reacoes[emoji] || [];
        var i = m.reacoes[emoji].indexOf(uid); if (i > -1) m.reacoes[emoji].splice(i, 1); else m.reacoes[emoji].push(uid);
        if (!m.reacoes[emoji].length) delete m.reacoes[emoji];
        gravar("reacao", empresaId); return ok(m);
      },
      resolverConversa: function (empresaId, por, proximoPasso) {
        carregar(); var e = db.empresas[empresaId]; e.conversaResolvidaEm = Date.now();
        var texto = "✅ Resolvido por " + por.nome + "." + (proximoPasso ? " Próximo passo: " + proximoPasso : "");
        return Local.enviarMensagem(empresaId, { autor: { uid: "sistema", nome: "Totali", lado: "equipe", sistema: true }, texto: texto });
      },
      naoLidas: function (empresaId, uid, lado) {
        carregar();
        return ok(db.mensagens.filter(function (m) { return m.empresaId === empresaId && m.autor.lado !== lado && !(m.lidaPor || {})[uid]; }).length);
      },

      /* documentos */
      documentos: function (empresaId) { carregar(); return ok(db.documentos.filter(function (d) { return d.empresaId === empresaId; }).sort(function (a, b) { return b.em - a.em; })); },
      todosDocumentos: function () { carregar(); return ok(db.documentos.slice().sort(function (a, b) { return b.em - a.em; })); },
      enviarDocumento: function (empresaId, dados) {
        carregar();
        var f = dados.file, id = U.id("d");
        var reg = { id: id, empresaId: empresaId, nome: dados.nome || (f ? f.name : "arquivo"), grupo: dados.grupo || "outros", origem: dados.origem || "cliente", situacao: "enviado", em: Date.now(), por: dados.por,
          arquivo: { id: f ? "arq_" + id : "", nome: f ? f.name : "", tamanho: f ? f.size : 0, mime: f ? f.type : "" }, revisao: null, vistos: [], observacao: U.txt(dados.observacao, 300) };
        var p = f ? IDB.guardar("arq_" + id, f, f.name, f.type) : Promise.resolve();
        return p.then(function () {
          db.documentos.push(reg);
          db.auditoria.push({ id: U.id("a"), empresaId: empresaId, tipo: "documento:enviado", por: dados.por, em: Date.now(), detalhe: reg.nome + " (" + reg.origem + ")" });
          gravar("documento", empresaId); return U.clonar(reg);
        });
      },
      revisarDocumento: function (empresaId, docId, situacao, motivo, por) {
        carregar(); var d = db.documentos.filter(function (x) { return x.id === docId; })[0]; if (!d) return ok(null);
        d.situacao = situacao; d.revisao = { por: por.nome, em: Date.now(), motivo: U.txt(motivo, 300) };
        db.auditoria.push({ id: U.id("a"), empresaId: empresaId, tipo: "documento:" + situacao, por: por.nome, em: Date.now(), detalhe: d.nome });
        gravar("documento", empresaId); return ok(d);
      },
      verDocumento: function (empresaId, docId, por) {
        carregar(); var d = db.documentos.filter(function (x) { return x.id === docId; })[0]; if (!d) return ok(null);
        d.vistos = d.vistos || []; if (!d.vistos.some(function (v) { return v.por === por.nome; })) { d.vistos.push({ por: por.nome, em: Date.now() }); gravar("documento", empresaId); }
        return ok(d);
      },
      removerDocumento: function (empresaId, docId) {
        carregar(); var i = db.documentos.findIndex(function (x) { return x.id === docId; }); if (i < 0) return ok(false);
        var d = db.documentos[i]; db.documentos.splice(i, 1);
        return (d.arquivo && d.arquivo.id ? IDB.apagar(d.arquivo.id) : Promise.resolve()).then(function () { gravar("documento", empresaId); return true; });
      },
      urlArquivo: function (doc) {
        if (!doc || !doc.arquivo || !doc.arquivo.id) return Promise.resolve("");
        return IDB.ler(doc.arquivo.id).then(function (r) { return r && r.blob ? URL.createObjectURL(r.blob) : ""; });
      },
      guardarAnexo: function (empresaId, file) {
        var id = "anx_" + U.id();
        return IDB.guardar(id, file, file.name, file.type).then(function () { return { id: id, nome: file.name, tamanho: file.size, mime: file.type }; });
      },
      urlAnexo: function (anexo) { return IDB.ler(anexo.id).then(function (r) { return r && r.blob ? URL.createObjectURL(r.blob) : ""; }); },

      /* link da contabilidade anterior */
      criarLinkAnterior: function (empresaId, por) {
        carregar(); var e = db.empresas[empresaId];
        var existente = Object.keys(db.anterior).filter(function (k) { return db.anterior[k].empresaId === empresaId && db.anterior[k].ativo; })[0];
        if (existente) return ok(existente);
        var c = U.codigo(22); db.anterior[c] = { empresaId: empresaId, empresa: e.fantasia, ativo: true, criadoEm: Date.now(), por: por.nome };
        gravar("anterior", empresaId); return ok(c);
      },
      anterior: function (codigo) { carregar(); var a = db.anterior[codigo]; return ok(a && a.ativo ? { codigo: codigo, empresa: a.empresa, empresaId: a.empresaId } : null); },
      desativarAnterior: function (codigo) { carregar(); if (db.anterior[codigo]) db.anterior[codigo].ativo = false; gravar("anterior"); return ok(true); },

      /* credenciais (cofre) */
      credenciais: function (empresaId) { carregar(); return ok(db.credenciais.filter(function (c) { return c.empresaId === empresaId; }).map(function (c) { var x = U.clonar(c); delete x.pacote; return x; })); },
      salvarCredencial: function (empresaId, c) {
        carregar(); var reg = { id: U.id("c"), empresaId: empresaId, rotulo: U.txt(c.rotulo, 80), tipo: c.tipo || "portal", usuario: U.txt(c.usuario, 120), em: Date.now(), por: c.por, pacote: c.pacote };
        db.credenciais.push(reg); db.auditoria.push({ id: U.id("a"), empresaId: empresaId, tipo: "credencial:guardada", por: c.por, em: Date.now(), detalhe: reg.rotulo });
        gravar("credencial", empresaId); var x = U.clonar(reg); delete x.pacote; return ok(x);
      },
      removerCredencial: function (empresaId, id, por) { carregar(); db.credenciais = db.credenciais.filter(function (c) { return c.id !== id; }); db.auditoria.push({ id: U.id("a"), empresaId: empresaId, tipo: "credencial:removida", por: por.nome, em: Date.now() }); gravar("credencial", empresaId); return ok(true); },
      abrirCredencial: function (empresaId, id, por) {
        carregar(); var c = db.credenciais.filter(function (x) { return x.id === id; })[0]; if (!c) return Promise.reject(new Error("Credencial não encontrada"));
        db.auditoria.push({ id: U.id("a"), empresaId: empresaId, tipo: "credencial:aberta", por: por.nome, em: Date.now(), detalhe: c.rotulo });
        gravar("auditoria", empresaId);
        if (c.pacote && c.pacote.demo) return ok({ senha: atob(c.pacote.segredo) });
        return Promise.reject(new Error("No modo local só as credenciais de demonstração podem ser abertas. Com o Firebase ligado, a Cloud Function abre com a chave privada."));
      },

      /* uso (auditoria de uso) */
      registrarUso: function (ev) { carregar(); db.uso.push(Object.assign({ id: U.id("u"), em: Date.now() }, ev)); if (db.uso.length > 5000) db.uso.splice(0, db.uso.length - 5000); try { localStorage.setItem(CHAVE_DB, JSON.stringify(db)); } catch (e) {} return ok(true); },
      usos: function (filtro) {
        carregar(); filtro = filtro || {};
        return ok(db.uso.filter(function (u) {
          if (filtro.empresaId && u.empresaId !== filtro.empresaId) return false;
          if (filtro.sistemaId && u.sistemaId !== filtro.sistemaId) return false;
          if (filtro.desde && u.em < filtro.desde) return false;
          if (filtro.ate && u.em > filtro.ate) return false;
          return true;
        }).sort(function (a, b) { return b.em - a.em; }));
      },
      auditoria: function (filtro) { carregar(); filtro = filtro || {}; return ok(db.auditoria.filter(function (a) { return (!filtro.empresaId || a.empresaId === filtro.empresaId) && (!filtro.desde || a.em >= filtro.desde); }).sort(function (a, b) { return b.em - a.em; })); },

      /* vitrine */
      vitrine: function () { carregar(); return ok(db.vitrine); },
      salvarCampanha: function (c) { carregar(); var i = db.vitrine.findIndex(function (x) { return x.id === c.id; }); if (i > -1) db.vitrine[i] = c; else db.vitrine.push(c); gravar("vitrine"); return ok(c); },
      removerCampanha: function (id) { carregar(); db.vitrine = db.vitrine.filter(function (x) { return x.id !== id; }); gravar("vitrine"); return ok(true); },
      registrarVitrine: function (ev) { return Local.registrarUso(Object.assign({ tipo: "vitrine" }, ev)); },

      /* conteúdo */
      conteudo: function (chave) { carregar(); return ok(db.conteudo[chave] || null); },
      salvarConteudo: function (chave, obj, por) { carregar(); db.conteudo[chave] = Object.assign({}, obj, { atualizadoEm: Date.now(), por: por ? por.nome : "" }); gravar("conteudo", chave); return ok(db.conteudo[chave]); },

      /* checklist */
      checklist: function (empresaId, anoMes) { carregar(); return ok(db.checklists.filter(function (c) { return c.empresaId === empresaId && c.anoMes === anoMes; })[0] || null); },
      checklists: function (empresaId) { carregar(); return ok(db.checklists.filter(function (c) { return c.empresaId === empresaId; }).sort(function (a, b) { return a.anoMes < b.anoMes ? 1 : -1; })); },
      listarChecklists: function (anoMes) { carregar(); return ok(db.checklists.filter(function (c) { return c.anoMes === anoMes; })); },
      salvarChecklist: function (empresaId, anoMes, obj) {
        carregar(); var i = db.checklists.findIndex(function (c) { return c.empresaId === empresaId && c.anoMes === anoMes; });
        var reg = Object.assign({ empresaId: empresaId, anoMes: anoMes }, obj, { atualizadoEm: Date.now() });
        if (reg.itens && reg.itens.length && reg.itens.every(function (it) { return it.feito; })) reg.concluidoEm = reg.concluidoEm || Date.now(); else delete reg.concluidoEm;
        if (i > -1) db.checklists[i] = reg; else db.checklists.push(reg);
        gravar("checklist", empresaId); return ok(reg);
      },

      /* equipe */
      equipe: function () { carregar(); return ok(db.equipe); },
      salvarMembro: function (m, por) {
        carregar(); var i = db.equipe.findIndex(function (x) { return x.uid === m.uid; });
        if (i > -1) db.equipe[i] = Object.assign(db.equipe[i], m); else { m.uid = m.uid || "eq_" + U.id().slice(-8); m.criadoEm = Date.now(); db.equipe.push(m); }
        db.auditoria.push({ id: U.id("a"), empresaId: "", tipo: i > -1 ? "equipe:alterado" : "equipe:entrou", por: por.nome, em: Date.now(), detalhe: m.email });
        gravar("equipe"); return ok(m);
      },
      removerMembro: function (uid, por) { carregar(); var m = db.equipe.filter(function (x) { return x.uid === uid; })[0]; db.equipe = db.equipe.filter(function (x) { return x.uid !== uid; }); db.auditoria.push({ id: U.id("a"), empresaId: "", tipo: "equipe:saiu", por: por.nome, em: Date.now(), detalhe: m ? m.email : uid }); gravar("equipe"); return ok(true); },

      /* feedback D30 */
      salvarFeedback: function (empresaId, texto, nota, por) { carregar(); db.feedback[empresaId] = { texto: U.txt(texto, 2000), nota: nota, em: Date.now(), por: por.nome }; gravar("feedback", empresaId); return ok(db.feedback[empresaId]); },
      feedback: function (empresaId) { carregar(); return ok(db.feedback[empresaId] || null); },

      /* ---------- Coleções e documentos genéricos ----------
         caminho: "extratos/abc" (documento) ou "empresas/x/entregas" (coleção).
         Serve para os módulos novos não precisarem de um método cada. */
      docObter: function (caminho) { carregar(); var p = caminho.split("/"); var col = p.slice(0, -1).join("/"), id = p[p.length - 1]; return ok((db.generico[col] || {})[id] || null); },
      docSalvar: function (caminho, obj, mesclar) { carregar(); var p = caminho.split("/"); var col = p.slice(0, -1).join("/"), id = p[p.length - 1]; db.generico[col] = db.generico[col] || {}; var atual = db.generico[col][id]; db.generico[col][id] = Object.assign({}, mesclar && atual ? atual : {}, obj, { id: id, atualizadoEm: Date.now() }); gravar("generico", col); return ok(db.generico[col][id]); },
      docApagar: function (caminho) { carregar(); var p = caminho.split("/"); var col = p.slice(0, -1).join("/"), id = p[p.length - 1]; if (db.generico[col]) delete db.generico[col][id]; gravar("generico", col); return ok(true); },
      colListar: function (col, filtro) { carregar(); var lista = Object.keys(db.generico[col] || {}).map(function (k) { return db.generico[col][k]; }); if (filtro) lista = lista.filter(function (d) { return Object.keys(filtro).every(function (k) { return d[k] === filtro[k]; }); }); return ok(lista.sort(function (a, b) { return (b.criadoEm || b.atualizadoEm || 0) - (a.criadoEm || a.atualizadoEm || 0); })); },
      colAdicionar: function (col, obj) { carregar(); var id = obj.id || U.id(); return Local.docSalvar(col + "/" + id, Object.assign({ criadoEm: Date.now() }, obj)); },
      colGrupo: function (nome) { carregar(); var out = []; Object.keys(db.generico).forEach(function (col) { if (col.split("/").pop() === nome) Object.keys(db.generico[col]).forEach(function (k) { out.push(Object.assign({ _col: col }, db.generico[col][k])); }); }); return ok(out); },

      /* utilidades do demo */
      zerar: function () { localStorage.removeItem(CHAVE_DB); localStorage.removeItem(CHAVE_SESSAO + "-portal"); localStorage.removeItem(CHAVE_SESSAO + "-painel"); db = null; return IDB.limpar().then(function () { carregar(); avisar("zerado"); return true; }); }
    };
  })();

  /* ============================================================
     MOTOR FIREBASE — mesma API, sobre Firestore/Auth/Storage
     Só é montado quando a configuração existe. Os métodos que
     dependem de Cloud Function (abrir credencial) gravam um pedido
     e esperam a resposta, como no Academy.
     ============================================================ */
  var Fire = null;
  function montarFirebase() {
    var fb = global.firebase;
    var app = fb.initializeApp(global.FIREBASE_CONFIG, "totali-" + NOME_APP);
    /* App Check antes de qualquer chamada: prova que a requisição vem do nosso site (docs/02-seguranca.md) */
    try { if (global.APP_CHECK_SITE_KEY && app.appCheck) app.appCheck().activate(global.APP_CHECK_SITE_KEY, true); } catch (e) { console.warn("App Check", e); }
    var auth = app.auth(), db = app.firestore(), storage = app.storage();
    var TS = fb.firestore.FieldValue.serverTimestamp;
    var usuario = null, perfilCache = null;
    var listeners = [];

    function docData(s) { if (!s.exists) return null; var d = s.data(); d.id = s.id; return normalizar(d); }
    function normalizar(o) {
      if (!o || typeof o !== "object") return o;
      Object.keys(o).forEach(function (k) {
        var v = o[k];
        if (v && typeof v.toMillis === "function") o[k] = v.toMillis();
        else if (v && typeof v === "object" && !Array.isArray(v)) normalizar(v);
        else if (Array.isArray(v)) v.forEach(normalizar);
      });
      return o;
    }
    function lista(q) { return q.get().then(function (s) { return s.docs.map(docData); }); }
    function perfil() {
      if (!usuario) return Promise.resolve(null);
      if (perfilCache && perfilCache.uid === usuario.uid) return Promise.resolve(perfilCache);
      return db.collection("usuarios").doc(usuario.uid).get().then(function (s) {
        if (s.exists && NOME_APP === "painel") { var d = s.data(); perfilCache = { uid: usuario.uid, nome: d.nome || usuario.email, email: usuario.email, papel: d.papel === "admin" ? "admin" : "equipe", setor: d.setor || "", setores: Array.isArray(d.setores) ? d.setores : [] }; return perfilCache; }
        return db.collection("clientes").doc(usuario.uid).get().then(function (c) {
          if (!c.exists) return null;
          var d = c.data(); var emps = d.empresas || (d.empresaId ? [d.empresaId] : []);
          perfilCache = { uid: usuario.uid, nome: d.nome || usuario.email, email: usuario.email, papel: "cliente", empresas: emps, empresaId: d.empresaAtual || emps[0] };
          return perfilCache;
        });
      });
    }
    var pronta = new Promise(function (res) { auth.onAuthStateChanged(function (u) { usuario = u; perfilCache = null; perfil().then(function () { avisar("sessao"); res(true); }); }); });

    function subcol(empresaId, nome) { return db.collection("empresas").doc(empresaId).collection(nome); }
    function anotar(empresaId, tipo, detalhe, por) {
      /* A trilha que vale é a do servidor (functions/auditoria.js); este é o rastro auxiliar em empresas/{id}/eventos */
      return subcol(empresaId, "eventos").add({ tipo: tipo, detalhe: detalhe || "", por: por || "", em: TS() }).catch(function () {});
    }

    return {
      nome: "firebase",
      pronto: function () { return pronta; },
      sessao: function () { return perfilCache; },
      entrar: function (email, senha) { return auth.signInWithEmailAndPassword(email, senha).then(function () { return perfil(); }).then(function (p) { if (!p) { auth.signOut(); throw new Error(NOME_APP === "painel" ? "Este e-mail não é da equipe." : "Este acesso não está ligado a nenhuma empresa."); } if (p.papel === "cliente") db.collection("empresas").doc(p.empresaId).collection("acessos").doc(p.uid).set({ ultimoAcesso: TS() }, { merge: true }); return p; }); },
      entrarDemo: function () { return Promise.reject(new Error("Demo só no modo local.")); },
      /* Página da contabilidade anterior: sem conta, com login anônimo; as regras conferem o código do link */
      entrarAnonimo: function () { return usuario ? Promise.resolve(usuario.uid) : auth.signInAnonymously().then(function (c) { return c.user.uid; }); },
      sair: function () { if (global.Seguranca) global.Seguranca.limparAparelho(); return auth.signOut(); },
      trocarEmpresa: function (empresaId) { perfilCache.empresaId = empresaId; return db.collection("clientes").doc(usuario.uid).set({ empresaAtual: empresaId }, { merge: true }).then(function () { return perfilCache; }); },

      empresa: function (id) { return db.collection("empresas").doc(id).get().then(function (s) { var e = docData(s); if (!e) return null; return subcol(id, "acessos").get().then(function (a) { e.acessos = a.docs.map(docData); return e; }); }); },
      listarEmpresas: function () { return lista(db.collection("empresas").orderBy("fantasia")); },
      salvarEmpresa: function (id, campos) { return db.collection("empresas").doc(id).set(campos, { merge: true }); },
      criarEmpresa: function (dados, por) {
        var ref = db.collection("empresas").doc();
        var e = { nome: dados.nome, fantasia: dados.fantasia || dados.nome, cnpj: dados.cnpj || "", regime: dados.regime || "", perfis: dados.perfis || [], trilha: dados.trilha || "A", gerenteUid: por.uid, gerenteNome: por.nome, ativa: true, criadaEm: TS(),
          liberacoes: { checklist: { ativo: true, desde: Date.now(), ate: Date.now() + 30 * U.DIA_MS, plano: "cortesia 30 dias" }, academy: { ativo: true, desde: Date.now() } },
          jornada: { aceiteEm: dados.aceiteEm || Date.now(), passos: { "d0.c.0": { em: Date.now(), por: por.nome }, "d0.e.0": { em: Date.now(), por: por.nome } }, notas: {} } };
        var codigo = U.codigo(22);
        return ref.set(e).then(function () { return db.collection("convites").doc(codigo).set({ empresaId: ref.id, criadoEm: TS(), por: por.uid, usado: false }); })
          .then(function () { e.id = ref.id; return { empresa: e, convite: codigo }; });
      },
      liberar: function (empresaId, sistemaId, dados, por) {
        var o = {}; o["liberacoes." + sistemaId] = Object.assign({ desde: Date.now() }, dados);
        return db.collection("empresas").doc(empresaId).update(o).then(function () { return anotar(empresaId, dados.ativo ? "liberacao:ativada" : "liberacao:desativada", sistemaId, por.uid); });
      },
      criarConvite: function (empresaId, por) { var c = U.codigo(22); return db.collection("convites").doc(c).set({ empresaId: empresaId, criadoEm: TS(), por: por.uid, usado: false }).then(function () { return c; }); },
      convite: function (codigo) { return db.collection("convites").doc(codigo).get().then(function (s) { var c = docData(s); if (!c || c.usado) return null; return db.collection("empresas").doc(c.empresaId).get().then(function (e) { return { codigo: codigo, empresaId: c.empresaId, empresa: e.exists ? e.data().fantasia : "" }; }); }); },
      usarConvite: function (codigo, dados) {
        var empresaId;
        return db.collection("convites").doc(codigo).get().then(function (s) {
          var c = docData(s); if (!c || c.usado) throw new Error("Convite inválido ou já usado."); empresaId = c.empresaId;
          return auth.createUserWithEmailAndPassword(dados.email, dados.senha);
        }).then(function (cred) {
          var uid = cred.user.uid, lote = db.batch();
          lote.set(db.collection("clientes").doc(uid), { nome: dados.nome, email: dados.email, empresas: [empresaId], empresaAtual: empresaId, criadoEm: TS() });
          lote.set(subcol(empresaId, "acessos").doc(uid), { nome: dados.nome, email: dados.email, criadoEm: TS(), ultimoAcesso: TS() });
          lote.update(db.collection("convites").doc(codigo), { usado: true, usadoEm: TS(), usadoPor: uid });
          return lote.commit();
        }).then(function () { perfilCache = null; return perfil(); });
      },
      marcarPasso: function (empresaId, chave, feito, por) {
        var o = {}; o["jornada.passos." + chave] = feito ? { em: Date.now(), por: por.nome || por } : fb.firestore.FieldValue.delete();
        return db.collection("empresas").doc(empresaId).update(o);
      },
      salvarJornada: function (empresaId, campos) { var o = {}; Object.keys(campos).forEach(function (k) { o["jornada." + k] = campos[k]; }); return db.collection("empresas").doc(empresaId).update(o); },

      mensagens: function (empresaId) { return lista(subcol(empresaId, "mensagens").orderBy("em").limitToLast(300)); },
      ouvirMensagens: function (empresaId, fn) {
        var off = subcol(empresaId, "mensagens").orderBy("em").limitToLast(300).onSnapshot(function (s) { fn(s.docs.map(docData)); });
        listeners.push(off); return off;
      },
      todasConversas: function () {
        return this.listarEmpresas().then(function (emps) {
          return Promise.all(emps.map(function (e) {
            return subcol(e.id, "mensagens").orderBy("em", "desc").limit(20).get().then(function (s) {
              var ms = s.docs.map(docData); var ultima = ms[0] || null;
              var naoLidas = ms.filter(function (m) { return m.autor.lado === "cliente" && !m.lidaEquipe; }).length;
              return { empresaId: e.id, empresa: e.fantasia, ultima: ultima, naoLidas: naoLidas, resolvida: !!(e.conversaResolvidaEm && ultima && e.conversaResolvidaEm >= ultima.em) };
            });
          })).then(function (l) { return l.sort(function (a, b) { return (b.ultima ? b.ultima.em : 0) - (a.ultima ? a.ultima.em : 0); }); });
        });
      },
      enviarMensagem: function (empresaId, m) {
        var nova = { autor: m.autor, texto: U.txt(m.texto, 4000), anexos: m.anexos || [], em: TS(), lidaPor: {}, reacoes: {}, lidaEquipe: m.autor.lado === "equipe" };
        nova.lidaPor[m.autor.uid] = Date.now();
        return subcol(empresaId, "mensagens").add(nova).then(function (r) { nova.id = r.id; nova.em = Date.now(); if (m.autor.lado === "equipe") db.collection("empresas").doc(empresaId).update({ conversaResolvidaEm: fb.firestore.FieldValue.delete() }).catch(function () {}); return nova; });
      },
      marcarLidas: function (empresaId, uid) {
        return subcol(empresaId, "mensagens").orderBy("em", "desc").limit(50).get().then(function (s) {
          var lote = db.batch(), n = 0;
          s.docs.forEach(function (d) { var m = d.data(); if (!(m.lidaPor || {})[uid]) { var o = {}; o["lidaPor." + uid] = Date.now(); if (uid.indexOf("cli_") !== 0 && NOME_APP === "painel") o.lidaEquipe = true; lote.update(d.ref, o); n++; } });
          return n ? lote.commit().then(function () { return true; }) : false;
        });
      },
      reagir: function (empresaId, msgId, emoji, uid) {
        var ref = subcol(empresaId, "mensagens").doc(msgId);
        return db.runTransaction(function (t) { return t.get(ref).then(function (s) { var r = (s.data() || {}).reacoes || {}; r[emoji] = r[emoji] || []; var i = r[emoji].indexOf(uid); if (i > -1) r[emoji].splice(i, 1); else r[emoji].push(uid); if (!r[emoji].length) delete r[emoji]; t.update(ref, { reacoes: r }); }); });
      },
      resolverConversa: function (empresaId, por, proximoPasso) {
        var self = this;
        return db.collection("empresas").doc(empresaId).update({ conversaResolvidaEm: Date.now() }).then(function () {
          return self.enviarMensagem(empresaId, { autor: { uid: "sistema", nome: "Totali", lado: "equipe", sistema: true }, texto: "✅ Resolvido por " + por.nome + "." + (proximoPasso ? " Próximo passo: " + proximoPasso : "") });
        });
      },
      naoLidas: function (empresaId, uid, lado) { return this.mensagens(empresaId).then(function (ms) { return ms.filter(function (m) { return m.autor.lado !== lado && !(m.lidaPor || {})[uid]; }).length; }); },

      documentos: function (empresaId) { return lista(subcol(empresaId, "documentos").orderBy("em", "desc")); },
      todosDocumentos: function () { return lista(db.collectionGroup("documentos").orderBy("em", "desc").limit(500)); },
      enviarDocumento: function (empresaId, dados) {
        var f = dados.file, ref = subcol(empresaId, "documentos").doc();
        var caminho = "empresas/" + empresaId + "/documentos/" + ref.id + "/" + (f ? f.name.replace(/[^\w.\-]+/g, "_") : "sem-arquivo");
        var reg = { empresaId: empresaId, nome: dados.nome || (f ? f.name : "arquivo"), grupo: dados.grupo || "outros", origem: dados.origem || "cliente", situacao: "enviado", em: TS(), por: dados.por, arquivo: { path: f ? caminho : "", nome: f ? f.name : "", tamanho: f ? f.size : 0, mime: f ? f.type : "" }, revisao: null, vistos: [], observacao: U.txt(dados.observacao, 300) };
        if (dados.codigo) reg.codigo = dados.codigo;   /* contabilidade anterior: as regras conferem o código */
        var p = f ? storage.ref(caminho).put(f, { contentType: f.type, customMetadata: dados.codigo ? { codigo: dados.codigo } : {} }) : Promise.resolve();
        return Promise.resolve(p).then(function () { return ref.set(reg); }).then(function () { reg.id = ref.id; reg.em = Date.now(); return reg; });
      },
      revisarDocumento: function (empresaId, docId, situacao, motivo, por) { return subcol(empresaId, "documentos").doc(docId).update({ situacao: situacao, revisao: { por: por.nome, uid: por.uid, em: Date.now(), motivo: U.txt(motivo, 300) } }); },
      verDocumento: function (empresaId, docId, por) { return subcol(empresaId, "documentos").doc(docId).update({ vistos: fb.firestore.FieldValue.arrayUnion({ por: por.nome, em: Date.now() }) }).catch(function () {}); },
      removerDocumento: function (empresaId, docId) { return subcol(empresaId, "documentos").doc(docId).get().then(function (s) { var d = s.data(); return (d && d.arquivo && d.arquivo.path ? storage.ref(d.arquivo.path).delete().catch(function () {}) : Promise.resolve()).then(function () { return s.ref.delete(); }); }); },
      urlArquivo: function (doc) { return doc && doc.arquivo && doc.arquivo.path ? storage.ref(doc.arquivo.path).getDownloadURL() : Promise.resolve(""); },
      guardarAnexo: function (empresaId, file) {
        var id = U.id("anx"), caminho = "empresas/" + empresaId + "/chat/" + id + "/" + file.name.replace(/[^\w.\-]+/g, "_");
        return storage.ref(caminho).put(file, { contentType: file.type }).then(function () { return { id: id, path: caminho, nome: file.name, tamanho: file.size, mime: file.type }; });
      },
      urlAnexo: function (anexo) { return anexo.path ? storage.ref(anexo.path).getDownloadURL() : Promise.resolve(""); },

      criarLinkAnterior: function (empresaId, por) {
        return db.collection("anterior").where("empresaId", "==", empresaId).where("ativo", "==", true).limit(1).get().then(function (s) {
          if (!s.empty) return s.docs[0].id;
          return db.collection("empresas").doc(empresaId).get().then(function (e) { var c = U.codigo(22); return db.collection("anterior").doc(c).set({ empresaId: empresaId, empresa: e.data().fantasia, ativo: true, criadoEm: TS(), por: por.uid }).then(function () { return c; }); });
        });
      },
      anterior: function (codigo) { return db.collection("anterior").doc(codigo).get().then(function (s) { var a = docData(s); return a && a.ativo ? { codigo: codigo, empresa: a.empresa, empresaId: a.empresaId } : null; }); },
      desativarAnterior: function (codigo) { return db.collection("anterior").doc(codigo).update({ ativo: false }); },

      credenciais: function (empresaId) { return lista(subcol(empresaId, "credenciais").orderBy("em", "desc")).then(function (l) { return l.map(function (c) { delete c.pacote; return c; }); }); },
      salvarCredencial: function (empresaId, c) { return subcol(empresaId, "credenciais").add({ rotulo: U.txt(c.rotulo, 80), tipo: c.tipo || "portal", usuario: U.txt(c.usuario, 120), em: TS(), por: c.por, pacote: c.pacote }).then(function (r) { return { id: r.id }; }); },
      removerCredencial: function (empresaId, id) { return subcol(empresaId, "credenciais").doc(id).delete(); },
      /* Grava um pedido; a Cloud Function abrirCredencial responde recifrado com a chave descartável (functions/senhas.js) */
      abrirCredencial: function (empresaId, id, por, chavePublicaTemp) {
        if (!chavePublicaTemp) return Promise.reject(new Error("Sem chave de resposta."));
        var ref = db.collection("pedidosDeSenha").doc();
        return ref.set({ empresaId: empresaId, chave: id, pedidoPor: por.uid, chavePublica: chavePublicaTemp, em: TS() }).then(function () {
          return new Promise(function (res, rej) {
            var t = setTimeout(function () { off(); rej(new Error("O servidor não respondeu. Tente de novo.")); }, 20000);
            var off = ref.onSnapshot(function (s) { var d = s.data() || {}; if (d.concluidoEm) { clearTimeout(t); off(); d.erro ? rej(new Error(d.erro)) : res({ resposta: d.resposta }); } });
          });
        });
      },

      registrarUso: function (ev) { return db.collection("uso").add(Object.assign({ em: TS() }, ev)).catch(function () {}); },
      usos: function (filtro) {
        filtro = filtro || {}; var q = db.collection("uso");
        if (filtro.empresaId) q = q.where("empresaId", "==", filtro.empresaId);
        if (filtro.desde) q = q.where("em", ">=", new Date(filtro.desde));
        return lista(q.orderBy("em", "desc").limit(5000)).then(function (l) { return l.filter(function (u) { return (!filtro.sistemaId || u.sistemaId === filtro.sistemaId) && (!filtro.ate || u.em <= filtro.ate); }); });
      },
      auditoria: function (filtro) { filtro = filtro || {}; var q = db.collection("auditoria"); if (filtro.empresaId) q = q.where("empresaId", "==", filtro.empresaId); return lista(q.orderBy("em", "desc").limit(500)); },

      vitrine: function () { return lista(db.collection("vitrine")); },
      salvarCampanha: function (c) { return db.collection("vitrine").doc(c.id).set(c); },
      removerCampanha: function (id) { return db.collection("vitrine").doc(id).delete(); },
      registrarVitrine: function (ev) { return this.registrarUso(Object.assign({ tipo: "vitrine" }, ev)); },

      conteudo: function (chave) { return db.collection("conteudo").doc(chave).get().then(docData); },
      salvarConteudo: function (chave, obj, por) { return db.collection("conteudo").doc(chave).set(Object.assign({}, obj, { atualizadoEm: TS(), por: por ? por.uid : "" })); },

      checklist: function (empresaId, anoMes) { return subcol(empresaId, "checklist").doc(anoMes).get().then(docData); },
      checklists: function (empresaId) { return lista(subcol(empresaId, "checklist").orderBy(fb.firestore.FieldPath.documentId(), "desc").limit(12)); },
      listarChecklists: function (anoMes) { return lista(db.collectionGroup("checklist").where("anoMes", "==", anoMes)); },
      salvarChecklist: function (empresaId, anoMes, obj) {
        var reg = Object.assign({ empresaId: empresaId, anoMes: anoMes }, obj, { atualizadoEm: TS() });
        if (reg.itens && reg.itens.length && reg.itens.every(function (it) { return it.feito; })) reg.concluidoEm = reg.concluidoEm || Date.now(); else reg.concluidoEm = fb.firestore.FieldValue.delete();
        return subcol(empresaId, "checklist").doc(anoMes).set(reg, { merge: true });
      },

      equipe: function () { return lista(db.collection("usuarios")).then(function (l) { return l.map(function (u) { u.uid = u.id; return u; }); }); },
      salvarMembro: function (m) { var uid = m.uid; if (!uid) return Promise.reject(new Error("No Firebase, o membro precisa existir no Authentication: informe o UID.")); return db.collection("usuarios").doc(uid).set({ nome: m.nome, email: m.email, papel: m.papel, setor: m.setor || "", setores: m.setores || [] }, { merge: true }); },
      removerMembro: function (uid) { return db.collection("usuarios").doc(uid).delete(); },
      docObter: function (caminho) { return db.doc(caminho).get().then(docData); },
      docSalvar: function (caminho, obj, mesclar) { var ref = db.doc(caminho); return ref.set(Object.assign({}, obj, { atualizadoEm: TS() }), { merge: !!mesclar }).then(function () { return Object.assign({ id: ref.id }, obj); }); },
      docApagar: function (caminho) { return db.doc(caminho).delete(); },
      colListar: function (col, filtro) { var q = db.collection(col); if (filtro) Object.keys(filtro).forEach(function (k) { q = q.where(k, "==", filtro[k]); }); return lista(q.limit(500)); },
      colAdicionar: function (col, obj) { var ref = obj.id ? db.collection(col).doc(obj.id) : db.collection(col).doc(); return ref.set(Object.assign({}, obj, { criadoEm: TS() })).then(function () { return Object.assign({ id: ref.id }, obj); }); },
      colGrupo: function (nome) { return lista(db.collectionGroup(nome).limit(2000)); },
      salvarFeedback: function (empresaId, texto, nota, por) { return db.collection("empresas").doc(empresaId).update({ feedback30: { texto: U.txt(texto, 2000), nota: nota, em: Date.now(), por: por.nome } }); },
      feedback: function (empresaId) { return db.collection("empresas").doc(empresaId).get().then(function (s) { return (s.data() || {}).feedback30 || null; }); },
      zerar: function () { return Promise.reject(new Error("Zerar só no modo local.")); }
    };
  }

  var motor = null;
  function m() {
    if (motor) return motor;
    if (configurado()) { try { motor = Fire = montarFirebase(); } catch (e) { console.error("Firebase falhou; caindo para o modo local", e); motor = Local; } }
    else motor = Local;
    return motor;
  }

  /* Fachada: repassa para o motor. `modo` diz qual está ativo. */
  var Dados = { get modo() { return m().nome; }, ehDemo: function () { return m().nome === "local"; }, ouvirMensagens: function (empresaId, fn, intervalo) {
    var mot = m();
    if (mot.ouvirMensagens) return mot.ouvirMensagens(empresaId, fn);
    /* modo local: recarrega ao evento dados:mudou e a cada intervalo */
    var ler = function () { mot.mensagens(empresaId).then(fn); };
    var h = function (e) { if (!e.detail || ["mensagem", "lidas", "reacao", "remoto"].indexOf(e.detail.tipo) > -1) ler(); };
    document.addEventListener("dados:mudou", h); var t = setInterval(ler, intervalo || 4000); ler();
    return function () { document.removeEventListener("dados:mudou", h); clearInterval(t); };
  } };
  ["pronto", "sessao", "entrar", "entrarDemo", "entrarAnonimo", "sair", "trocarEmpresa", "empresa", "listarEmpresas", "salvarEmpresa", "criarEmpresa", "liberar", "criarConvite", "convite", "usarConvite",
   "marcarPasso", "salvarJornada", "mensagens", "todasConversas", "enviarMensagem", "marcarLidas", "reagir", "resolverConversa", "naoLidas",
   "documentos", "todosDocumentos", "enviarDocumento", "revisarDocumento", "verDocumento", "removerDocumento", "urlArquivo", "guardarAnexo", "urlAnexo",
   "criarLinkAnterior", "anterior", "desativarAnterior", "credenciais", "salvarCredencial", "removerCredencial", "abrirCredencial",
   "registrarUso", "usos", "auditoria", "vitrine", "salvarCampanha", "removerCampanha", "registrarVitrine", "conteudo", "salvarConteudo",
   "checklist", "checklists", "listarChecklists", "salvarChecklist", "equipe", "salvarMembro", "removerMembro", "salvarFeedback", "feedback", "zerar",
   "docObter", "docSalvar", "docApagar", "colListar", "colAdicionar", "colGrupo"
  ].forEach(function (k) { Dados[k] = function () { var mot = m(); return mot[k].apply(mot, arguments); }; });

  global.Dados = Dados;
})(window);
