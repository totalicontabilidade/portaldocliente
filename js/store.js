/* ============================================================
   Totali · Portal de Onboarding
   store.js — estado da aplicação e persistência

   ARQUITETURA
   -----------
   Toda gravação passa por um "backend". São dois:

     LocalBackend  localStorage + IndexedDB, tudo no aparelho.
                   É o que roda antes do login e quando o
                   servidor não está disponível.
     Nuvem         Firestore + Storage (js/nuvem.js). Entra em
                   cena assim que o cliente faz login, com
                   Store.usarServidor(empresaId).

   Enquanto o backend for o local, o progresso vive só naquele
   navegador. Com o servidor, o cliente reencontra tudo em
   qualquer aparelho — e é por isso que o login existe.

   O QUE NUNCA É GRAVADO
   ---------------------
   Senhas, códigos de acesso e o conteúdo de certificados
   digitais. Os itens do tipo "acesso" guardam apenas a forma
   escolhida de liberação — jamais a credencial em si.
   ============================================================ */
(function (global) {
  "use strict";

  var CHAVE = "totali.onboarding.v1";
  var MAX_EVENTOS = 400;
  var DB_NOME = "totali-onboarding";
  var DB_STORE = "arquivos";
  var DB_VERSAO = 1;

  /* =========================================================
     1. IndexedDB — conteúdo binário dos arquivos
     ========================================================= */
  var dbPromise = null;

  function abrirDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!global.indexedDB) { reject(new Error("IndexedDB indisponível")); return; }
      var req = global.indexedDB.open(DB_NOME, DB_VERSAO);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    return dbPromise;
  }

  function tx(modo, fn) {
    return abrirDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(DB_STORE, modo);
        var st = t.objectStore(DB_STORE);
        var out = fn(st);
        t.oncomplete = function () {
          /* O IndexedDB devolve um "pedido", não o valor. Quando o
             arquivo não está guardado aqui, o pedido termina com
             resultado vazio — e é preciso responder NADA, não o
             pedido em si. Devolver o objeto do pedido faz quem
             chamou pensar que achou o arquivo, e aí o portal nem
             tenta buscar no servidor. */
          if (out && typeof out === "object" && "result" in out) {
            resolve(out.result === undefined ? null : out.result);
            return;
          }
          resolve(out);
        };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error); };
      });
    });
  }

  var Arquivos = {
    guardar: function (id, blob) { return tx("readwrite", function (st) { return st.put(blob, id); }); },
    obter:   function (id) { return tx("readonly",  function (st) { return st.get(id); }); },
    remover: function (id) { return tx("readwrite", function (st) { return st.delete(id); }); },
    limpar:  function ()   { return tx("readwrite", function (st) { return st.clear(); }); }
  };

  /* =========================================================
     2. Backend local
     ========================================================= */
  var LocalBackend = {
    nome: "local",
    carregar: function () {
      return new Promise(function (resolve) {
        var bruto = null;
        try { bruto = global.localStorage.getItem(CHAVE); } catch (e) { bruto = null; }
        if (!bruto) { resolve(null); return; }
        try { resolve(JSON.parse(bruto)); } catch (e) { resolve(null); }
      });
    },
    salvar: function (estado) {
      return new Promise(function (resolve, reject) {
        try {
          global.localStorage.setItem(CHAVE, JSON.stringify(estado));
          resolve(true);
        } catch (e) { reject(e); }
      });
    },
    apagar: function () {
      return new Promise(function (resolve) {
        try { global.localStorage.removeItem(CHAVE); } catch (e) { /* ignora */ }
        Arquivos.limpar().then(resolve, function () { resolve(); });
      });
    },
    /* O terceiro argumento diz de que natureza é o arquivo
       ("documento" ou "mensagem"). Aqui não muda nada; no
       servidor, decide em que pasta ele é guardado. */
    guardarArquivo: function (id, blob) { return Arquivos.guardar(id, blob); },
    obterArquivo:   function (id) { return Arquivos.obter(id); },
    removerArquivo: function (id) { return Arquivos.remover(id); }
  };

  var backend = LocalBackend;

  /* =========================================================
     3. Estado
     ========================================================= */
  var ESQUEMA = 2;

  function estadoInicial() {
    return {
      v: ESQUEMA,
      /* Identidade da empresa dentro do sistema. Hoje é gerada aqui;
         quando o Firebase entrar, passa a ser o id do documento em
         `empresas/{empresaId}` e é o que separa um cliente do outro. */
      empresaId: global.U.uid(),
      /* Quem está usando. Preenchido pelo login; "equipe" é o que
         libera o painel interno da Totali. */
      usuario: { uid: "", nome: "", email: "", papel: "cliente" },

      criadoEm: Date.now(),
      atualizadoEm: Date.now(),
      etapa: "boas-vindas",
      aceiteLGPD: null,
      /* Verdadeiro quando a empresa foi cadastrada pela Totali e
         chegou pelo link de convite. Nesse caso o cliente confere,
         mas não edita, os dados da empresa. */
      cadastroPelaEquipe: false,
      empresa: {
        razaoSocial: "", nomeFantasia: "", cnpj: "", regime: "",
        responsavelNome: "", responsavelEmail: "", responsavelTelefone: "", responsavelCargo: ""
      },
      socios: [],
      /* Etapa financeira — bancos e maquininhas. Veio do sistema
         "checklist financeiro", que passa a viver aqui dentro.
         O login e a senha de cada maquininha NÃO ficam aqui: vão
         cifrados para `credenciais`, com chave própria. */
      financeiro: {
        temBanco: "", bancos: [], bancoOutro: "",
        temMaquineta: "", maquinetas: [], maquinetaOutra: "",
        /* { "Nome da maquininha": true } — confirmação do Modo
           Contador nas operadoras que não têm senha para informar. */
        modoContador: {},
        formaRelatorio: "",
        /* ---- Informativo ----
           Três perguntas de Sim ou Não que vieram do Checklist
           Financeiro. Não são documento: são o que a contabilidade
           precisa saber ANTES de fechar o primeiro mês, para não
           descobrir um empréstimo em dezembro.

           "" = ainda não respondeu, e é diferente de "nao". */
        contasPagas: "", contasPagasSistema: "",
        emprestimo: "", aplicacoes: "",
        observacoes: "",
        concluidoEm: 0,
        protocolo: "",
        /* Metadados do termo em PDF. O arquivo em si fica no
           IndexedDB, como os demais documentos. */
        termo: { id: "", nome: "", em: 0 }
      },
      gruposNA: {},
      itens: {},      /* chave do documento -> registro           */
      /* Credenciais enviadas pelo cliente, SEMPRE cifradas com a
         chave pública da Totali (js/cripto.js). Aqui nunca há
         senha legível — só o envelope fechado. */
      credenciais: {},
      /* Recibo de credencial: quais campos foram enviados e
         quando. Existe porque o envelope cifrado, no servidor, só
         admin lê — sem o recibo o portal esqueceria, a cada
         login, que a senha já tinha sido informada e pediria de
         novo. Aqui não há nada da senha em si. */
      recibosCredenciais: {},
      mensagens: [],  /* conversa entre cliente e equipe          */
      eventos: [],    /* trilha de auditoria (ver nota em registrarEvento) */
      /* Quando cada tutorial guiado já foi visto. Fica no
         servidor junto com o resto: quem já aprendeu não precisa
         rever a explicação ao trocar de aparelho. */
      tutoriais: {}
    };
  }

  function revisaoVazia() {
    return { status: "", motivo: "", por: "", em: 0 };
  }

  function registroVazio() {
    return {
      arquivos: [], valor: "", na: false, obs: "", forma: "",
      atualizadoEm: 0,
      /* Definição da Totali sobre este documento se aplicar ou
         não a esta empresa. `null` = a equipe não opinou, e vale
         o `na` que o cliente marcou. Só a equipe grava. */
      naEquipe: null,
      /* "Enviar depois": a data que o próprio cliente escolheu
         para voltar a este documento. Zero quando não marcou.
         Não muda a situação do item — ele continua faltando —,
         só troca a cobrança automática por um combinado. */
      lembrete: 0,
      /* Preenchido pela equipe da Totali no painel interno.
         status: "" | "analise" | "aprovado" | "pendencia" */
      revisao: revisaoVazia()
    };
  }

  /* Higieniza o que veio do armazenamento. Nunca confiamos no
     formato: o usuário pode ter editado o localStorage à mão. */
  function sanear(bruto) {
    var base = estadoInicial();
    if (!bruto || typeof bruto !== "object") return base;

    var s = base;
    s.criadoEm = typeof bruto.criadoEm === "number" ? bruto.criadoEm : Date.now();
    s.atualizadoEm = typeof bruto.atualizadoEm === "number" ? bruto.atualizadoEm : Date.now();
    if (typeof bruto.etapa === "string") s.etapa = bruto.etapa;
    if (typeof bruto.aceiteLGPD === "number") s.aceiteLGPD = bruto.aceiteLGPD;
    s.cadastroPelaEquipe = bruto.cadastroPelaEquipe === true;

    /* Estado gravado antes do esquema 2 não tem empresaId: ganha um
       agora e segue funcionando, sem perder nada do que já foi enviado. */
    if (typeof bruto.empresaId === "string" && bruto.empresaId) {
      s.empresaId = bruto.empresaId.slice(0, 60);
    }
    if (bruto.usuario && typeof bruto.usuario === "object") {
      ["uid", "nome", "email"].forEach(function (k) {
        if (typeof bruto.usuario[k] === "string") s.usuario[k] = bruto.usuario[k].slice(0, 160);
      });
      /* O papel nunca é decidido pelo que está gravado no aparelho —
         quem manda é o login. Aqui só aceitamos o valor mais restrito. */
      s.usuario.papel = "cliente";
    }

    if (bruto.empresa && typeof bruto.empresa === "object") {
      Object.keys(s.empresa).forEach(function (k) {
        if (typeof bruto.empresa[k] === "string") s.empresa[k] = bruto.empresa[k].slice(0, 200);
      });
    }

    if (Array.isArray(bruto.socios)) {
      s.socios = bruto.socios.slice(0, 20).filter(function (x) {
        return x && typeof x === "object" && typeof x.id === "string";
      }).map(function (x) {
        return {
          id: String(x.id).slice(0, 60),
          nome: typeof x.nome === "string" ? x.nome.slice(0, 120) : "",
          cpf: typeof x.cpf === "string" ? x.cpf.slice(0, 20) : ""
        };
      });
    }

    if (bruto.financeiro && typeof bruto.financeiro === "object") {
      var f = bruto.financeiro, alvo = s.financeiro;
      var simNao = function (v) { return (v === "sim" || v === "nao") ? v : ""; };
      alvo.temBanco = simNao(f.temBanco);
      alvo.temMaquineta = simNao(f.temMaquineta);
      /* Só aceitamos itens que existem na lista oficial — nada de
         texto arbitrário virando "banco". */
      var nomesBancos = global.DATA.nomesDo(global.DATA.BANCOS);
      var nomesMaq = global.DATA.nomesDo(global.DATA.MAQUINETAS);
      if (Array.isArray(f.bancos)) {
        alvo.bancos = f.bancos.filter(function (b) { return nomesBancos.indexOf(b) > -1; });
      }
      if (Array.isArray(f.maquinetas)) {
        alvo.maquinetas = f.maquinetas.filter(function (m) { return nomesMaq.indexOf(m) > -1; });
      }
      /* Confirmação de Modo Contador só vale para maquininha que
         está marcada E que é de fato de modo próprio no catálogo. */
      alvo.modoContador = {};
      if (f.modoContador && typeof f.modoContador === "object") {
        Object.keys(f.modoContador).slice(0, 40).forEach(function (nome) {
          var cat = global.DATA.acharNoCatalogo(global.DATA.MAQUINETAS, nome);
          if (f.modoContador[nome] === true && cat && cat.semCredencial &&
              alvo.maquinetas.indexOf(nome) > -1) {
            alvo.modoContador[nome] = true;
          }
        });
      }
      alvo.bancoOutro = typeof f.bancoOutro === "string" ? f.bancoOutro.slice(0, 200) : "";
      alvo.maquinetaOutra = typeof f.maquinetaOutra === "string" ? f.maquinetaOutra.slice(0, 200) : "";
      alvo.observacoes = typeof f.observacoes === "string" ? f.observacoes.slice(0, 2000) : "";

      /* Informativo. Só "sim" e "nao" entram; qualquer outra coisa
         vira "" — que quer dizer "ainda não respondeu". */
      var simOuNao = function (v) { return (v === "sim" || v === "nao") ? v : ""; };
      alvo.contasPagas = simOuNao(f.contasPagas);
      alvo.emprestimo  = simOuNao(f.emprestimo);
      alvo.aplicacoes  = simOuNao(f.aplicacoes);
      /* O sistema só faz sentido junto de "sim". Guardá-lo depois
         de o cliente trocar para "não" deixaria no banco a resposta
         de uma pergunta que ele desfez. */
      alvo.contasPagasSistema = alvo.contasPagas === "sim" && typeof f.contasPagasSistema === "string"
        ? f.contasPagasSistema.slice(0, 200) : "";
      var formas = global.DATA.FORMAS_RELATORIO.map(function (x) { return x.id; });
      alvo.formaRelatorio = formas.indexOf(f.formaRelatorio) > -1 ? f.formaRelatorio : "";
      alvo.concluidoEm = typeof f.concluidoEm === "number" ? f.concluidoEm : 0;
      if (typeof f.protocolo === "string" && /^CF-\d{6}-[A-Z0-9]{5}$/.test(f.protocolo)) {
        alvo.protocolo = f.protocolo;
      }
      if (f.termo && typeof f.termo === "object") {
        alvo.termo = {
          id: typeof f.termo.id === "string" ? f.termo.id.slice(0, 60) : "",
          nome: typeof f.termo.nome === "string" ? f.termo.nome.slice(0, 200) : "",
          em: typeof f.termo.em === "number" ? f.termo.em : 0
        };
      }
    }

    if (bruto.gruposNA && typeof bruto.gruposNA === "object") {
      Object.keys(bruto.gruposNA).forEach(function (k) {
        if (bruto.gruposNA[k] === true) s.gruposNA[String(k).slice(0, 60)] = true;
      });
    }

    if (bruto.itens && typeof bruto.itens === "object") {
      Object.keys(bruto.itens).slice(0, 3000).forEach(function (k) {
        var r = bruto.itens[k];
        if (!r || typeof r !== "object") return;
        var novo = registroVazio();
        novo.valor = typeof r.valor === "string" ? r.valor.slice(0, 400) : "";
        novo.obs = typeof r.obs === "string" ? r.obs.slice(0, 1000) : "";
        novo.forma = typeof r.forma === "string" ? r.forma.slice(0, 60) : "";
        novo.na = r.na === true;
        novo.atualizadoEm = typeof r.atualizadoEm === "number" ? r.atualizadoEm : 0;
        novo.lembrete = typeof r.lembrete === "number" && r.lembrete > 0 ? r.lembrete : 0;
        novo.naEquipe = typeof r.naEquipe === "boolean" ? r.naEquipe : null;

        if (r.revisao && typeof r.revisao === "object") {
          var st = String(r.revisao.status || "");
          if (["analise", "aprovado", "pendencia"].indexOf(st) > -1) novo.revisao.status = st;
          novo.revisao.motivo = typeof r.revisao.motivo === "string" ? r.revisao.motivo.slice(0, 600) : "";
          novo.revisao.por = typeof r.revisao.por === "string" ? r.revisao.por.slice(0, 120) : "";
          novo.revisao.em = typeof r.revisao.em === "number" ? r.revisao.em : 0;
        }
        if (Array.isArray(r.arquivos)) {
          novo.arquivos = r.arquivos.slice(0, 40).filter(function (a) {
            return a && typeof a === "object" && typeof a.id === "string";
          }).map(function (a) {
            return {
              id: String(a.id).slice(0, 60),
              nome: typeof a.nome === "string" ? a.nome.slice(0, 160) : "arquivo",
              tamanho: typeof a.tamanho === "number" ? a.tamanho : 0,
              tipo: typeof a.tipo === "string" ? a.tipo.slice(0, 120) : "",
              em: typeof a.em === "number" ? a.em : 0
            };
          });
        }
        s.itens[String(k).slice(0, 160)] = novo;
      });
    }

    /* Só entra o que tem a cara de um envelope cifrado. Se
       alguém tentar plantar texto às claras aqui, é descartado. */
    if (bruto.credenciais && typeof bruto.credenciais === "object") {
      Object.keys(bruto.credenciais).slice(0, 200).forEach(function (k) {
        var c = bruto.credenciais[k];
        if (!c || typeof c !== "object" || !c.pacote) return;
        var p = c.pacote;
        if (typeof p.iv !== "string" || typeof p.chave !== "string" ||
            typeof p.dados !== "string" || typeof p.alg !== "string") return;
        s.credenciais[String(k).slice(0, 160)] = {
          pacote: {
            v: typeof p.v === "number" ? p.v : 1,
            alg: p.alg.slice(0, 60),
            iv: p.iv.slice(0, 64),
            chave: p.chave.slice(0, 2048),
            dados: p.dados.slice(0, 20000),
            em: typeof p.em === "number" ? p.em : 0
          },
          campos: Array.isArray(c.campos)
            ? c.campos.slice(0, 12).map(function (x) { return String(x).slice(0, 40); })
            : [],
          atualizadoEm: typeof c.atualizadoEm === "number" ? c.atualizadoEm : 0
        };
      });
    }

    /* Recibos: números e nomes de campo, nada além disso. */
    if (bruto.recibosCredenciais && typeof bruto.recibosCredenciais === "object") {
      Object.keys(bruto.recibosCredenciais).slice(0, 200).forEach(function (k) {
        var r = bruto.recibosCredenciais[k];
        if (!r || typeof r !== "object") return;
        s.recibosCredenciais[String(k).slice(0, 160)] = {
          campos: Array.isArray(r.campos)
            ? r.campos.slice(0, 12).map(function (x) { return String(x).slice(0, 40); })
            : [],
          em: typeof r.em === "number" ? r.em : 0
        };
      });
    }

    if (bruto.tutoriais && typeof bruto.tutoriais === "object") {
      Object.keys(bruto.tutoriais).slice(0, 20).forEach(function (k) {
        var v = bruto.tutoriais[k];
        if (typeof v === "number") s.tutoriais[String(k).slice(0, 40)] = v;
      });
    }

    if (Array.isArray(bruto.mensagens)) {
      s.mensagens = bruto.mensagens.slice(-300).filter(function (m) {
        return m && typeof m === "object" && typeof m.texto === "string";
      }).map(function (m) {
        return {
          id: typeof m.id === "string" ? m.id.slice(0, 60) : global.U.uid(),
          autor: m.autor === "equipe" ? "equipe" : "cliente",
          autorNome: typeof m.autorNome === "string" ? m.autorNome.slice(0, 120) : "",
          texto: String(m.texto).slice(0, 4000),
          chave: typeof m.chave === "string" ? m.chave.slice(0, 160) : "",
          anexos: Array.isArray(m.anexos)
            ? m.anexos.slice(0, 10).filter(function (a) {
                return a && typeof a === "object" && typeof a.id === "string";
              }).map(function (a) {
                return {
                  id: String(a.id).slice(0, 60),
                  nome: typeof a.nome === "string" ? a.nome.slice(0, 160) : "arquivo",
                  tamanho: typeof a.tamanho === "number" ? a.tamanho : 0,
                  tipo: typeof a.tipo === "string" ? a.tipo.slice(0, 120) : ""
                };
              })
            : [],
          em: typeof m.em === "number" ? m.em : 0,
          lidaEm: typeof m.lidaEm === "number" ? m.lidaEm : 0
        };
      });
    }

    if (Array.isArray(bruto.eventos)) {
      s.eventos = bruto.eventos.slice(-MAX_EVENTOS).filter(function (e) {
        return e && typeof e === "object" && typeof e.tipo === "string";
      }).map(function (e) {
        return {
          id: typeof e.id === "string" ? e.id.slice(0, 60) : global.U.uid(),
          tipo: String(e.tipo).slice(0, 40),
          chave: typeof e.chave === "string" ? e.chave.slice(0, 160) : "",
          detalhe: typeof e.detalhe === "string" ? e.detalhe.slice(0, 300) : "",
          ator: typeof e.ator === "string" ? e.ator.slice(0, 120) : "",
          em: typeof e.em === "number" ? e.em : 0
        };
      });
    }

    return s;
  }

  /* =========================================================
     4. API pública
     ========================================================= */
  var estado = estadoInicial();
  var ouvintes = [];
  var erroPersistencia = false;

  var trocandoBackend = false;

  /* ===========================================================
     REENVIO AUTOMÁTICO

     Isto existe porque a mensagem de erro MENTIA. Ela dizia "o que
     você digitou não se perde, tentamos de novo sozinhos" e nada
     tentava: `erroPersistencia` era marcado, o aviso aparecia, e a
     próxima gravação só aconteceria se a pessoa mexesse em outra
     coisa. Quem salvasse uma senha, visse o erro e saísse da conta
     perdia a senha — o "Sair" apaga a cópia do aparelho.
     Aconteceu de verdade com o Raoni em 2026-08-24.

     Dá para insistir com segurança porque `backend.salvar` é
     comparativo e idempotente: ele confere o retrato do que já está
     no servidor e só fixa o retrato quando o lote inteiro passa.
     Repetir a mesma gravação não duplica nada.

     A escada é curta no começo (queda de rede costuma durar
     segundos) e para de crescer em um minuto, para que voltar a ter
     sinal não signifique esperar mais dez minutos. */
  /* ===========================================================
     ENVELOPE PENDENTE SOBREVIVE AO RECARREGAMENTO

     Credencial é o único dado que o servidor NÃO devolve — a regra
     só deixa admin ler. Então `carregar()` da nuvem monta
     `credenciais: {}`, e uma senha que ainda não subiu sumiria
     assim que a pessoa atualizasse a página.

     O que fica gravado aqui é o ENVELOPE, não a senha: já saiu
     cifrado com AES e a chave dele vai trancada na chave pública
     da Totali. Sem a chave privada, que não existe neste aparelho,
     é ruído. A senha em texto nunca é gravada em lugar nenhum.

     Some assim que o servidor confirma. */
  var CHAVE_PENDENTES = "totali.onboarding.credpend";

  function guardaLocal() {
    try { return global.localStorage; } catch (e) { return null; }
  }

  function lerPendentesSalvos(empresaId) {
    var g = guardaLocal();
    if (!g || !empresaId) return {};
    try {
      var bruto = JSON.parse(g.getItem(CHAVE_PENDENTES) || "{}");
      var d = bruto[empresaId];
      return d && typeof d === "object" ? d : {};
    } catch (e) { return {}; }
  }

  function gravarPendentesSalvos(empresaId, mapa) {
    var g = guardaLocal();
    if (!g || !empresaId) return;
    try {
      var bruto = JSON.parse(g.getItem(CHAVE_PENDENTES) || "{}");
      if (mapa && Object.keys(mapa).length) bruto[empresaId] = mapa;
      else delete bruto[empresaId];
      /* Nada preso em empresa nenhuma: tira a chave inteira, em vez
         de deixar um "{}" para trás no aparelho da pessoa. */
      if (Object.keys(bruto).length) g.setItem(CHAVE_PENDENTES, JSON.stringify(bruto));
      else g.removeItem(CHAVE_PENDENTES);
    } catch (e) { /* cota cheia ou modo privado: o envio da sessão ainda vale */ }
  }

  function sincronizarPendentes() {
    var mapa = {};
    Object.keys(estado.credenciais || {}).forEach(function (k) {
      var c = estado.credenciais[k];
      if (c && c.pendenteEnvio && c.pacote) {
        mapa[k] = { pacote: c.pacote, campos: c.campos || [], atualizadoEm: c.atualizadoEm || 0 };
      }
    });
    gravarPendentesSalvos(estado.empresaId, mapa);
  }

  var ESPERAS_MS = [2000, 5000, 12000, 30000, 60000];
  var tentativa = 0;
  var relogioReenvio = null;
  var reenviando = false;
  /* A gravação que está no ar agora, para quem chegar no meio poder
     esperar por ela em vez de disparar outra ou receber um "não". */
  var emCurso = null;

  function pararReenvio() {
    if (relogioReenvio) { clearTimeout(relogioReenvio); relogioReenvio = null; }
    tentativa = 0;
  }

  function agendarReenvio() {
    if (relogioReenvio) return;                 /* já tem um a caminho */
    var espera = ESPERAS_MS[Math.min(tentativa, ESPERAS_MS.length - 1)];
    tentativa++;
    relogioReenvio = setTimeout(function () {
      relogioReenvio = null;
      salvarAgora();
    }, espera);
  }

  /* Não espera a escada quando há motivo para achar que melhorou:
     a rede voltou, ou a pessoa trouxe a aba de volta para a frente
     (que costuma ser quando o celular reconecta). */
  function tentarJaSePuder() {
    if (!erroPersistencia) return;
    pararReenvio();
    salvarAgora();
  }

  if (global.addEventListener) {
    global.addEventListener("online", tentarJaSePuder);
  }
  if (global.document && global.document.addEventListener) {
    global.document.addEventListener("visibilitychange", function () {
      if (!global.document.hidden) tentarJaSePuder();
    });
  }

  var salvarAgora = function () {
    /* Durante a troca de backend o estado está a meio caminho:
       gravar agora escreveria no lugar errado. */
    if (trocandoBackend) return Promise.resolve(false);
    /* Uma gravação de cada vez. Duas em paralelo comparariam com o
       mesmo retrato e mandariam as mesmas escritas duas vezes.

       Quem chega no meio de outra gravação ESPERA por ela, em vez
       de receber um "não" na hora. Antes eu devolvia o estado de
       erro atual, e o "Tentar agora" respondia "ainda não foi" sem
       ter tentado coisa alguma — bastava haver uma retentativa em
       curso, que é justamente quando a pessoa aperta o botão. */
    if (emCurso) return emCurso;
    reenviando = true;
    estado.atualizadoEm = Date.now();
    emCurso = backend.salvar(estado).then(function () {
      reenviando = false;
      emCurso = null;
      pararReenvio();
      /* O lote subiu inteiro, então nenhuma senha continua presa
         no aparelho. Sem isto a tela ficaria em "ainda não chegou"
         para sempre depois de um reenvio bem-sucedido. */
      var tinhaPresa = Store.confirmarCredenciais();
      if (erroPersistencia) {
        erroPersistencia = false;
        /* Avisar que CHEGOU importa tanto quanto avisar que falhou:
           quem viu o erro precisa saber que já pode sair em paz. */
        notificar(tinhaPresa ? "credencial-chegou" : "salvo-depois-do-erro");
      }
      erroPersistencia = false;
      return true;
    }, function () {
      reenviando = false;
      emCurso = null;
      if (!erroPersistencia) {
        erroPersistencia = true;
        notificar("erro-persistencia");
      }
      agendarReenvio();
      return false;
    });
    return emCurso;
  };
  var salvarDebounced = null;   /* criado no init, depende de U */

  /* REDE DE SEGURANÇA CONTRA AVISO QUE SE MORDE.

     Um ouvinte que, ao ser avisado, faz algo que dispara o MESMO
     aviso, cria um laço síncrono que trava a página inteira. Foi o
     que aconteceu com "mensagens" em 2026-08-24: redesenhar a
     conversa religava o formulário, que marcava as mensagens como
     lidas, que avisava de novo.

     A causa daquele caso está corrigida em `marcarLidas`, mas a
     armadilha é do desenho, não daquele trecho — qualquer ouvinte
     futuro pode cair nela. Aqui o mesmo aviso não reentra: o
     pedido de dentro é descartado, e quem estava avisando termina
     o trabalho. Descartar é certo porque o estado que o segundo
     aviso mostraria é o mesmo que o primeiro ainda está pintando. */
  var avisando = {};

  function notificar(motivo) {
    var chave = motivo || "commit";
    if (avisando[chave]) return;
    avisando[chave] = true;
    try {
      ouvintes.forEach(function (fn) {
        try { fn(estado, motivo); } catch (e) { /* um ouvinte com erro não derruba os outros */ }
      });
    } finally {
      avisando[chave] = false;
    }
  }

  /* ---------- Ouvinte de mensagens ---------- */
  var desligarMsgs = null;

  function desligarTempoReal() {
    if (desligarMsgs) { try { desligarMsgs(); } catch (e) {} }
    desligarMsgs = null;
  }

  /* Retrato barato da conversa, só para saber se algo mudou. Entram
     os campos que a tela mostra: quem, quando, o texto, a marca de
     lida e a de resolvida. Anexo não entra porque não muda depois
     de enviado. */
  function retratoDaConversa(lista) {
    return (lista || []).map(function (m) {
      return m.id + ":" + (m.lidaEm || 0) + ":" + (m.resolvidaEm || 0) +
             ":" + (m.texto || "").length;
    }).join("|");
  }

  function ligarTempoReal() {
    desligarTempoReal();
    if (!backend.ouvirMensagens) return;

    desligarMsgs = backend.ouvirMensagens(function (doServidor) {
      var conhecidas = {};
      (estado.mensagens || []).forEach(function (m) { conhecidas[m.id] = true; });

      /* Guarda a marca de lida do aparelho: ela é escrita aqui e
         só depois sobe, então o servidor pode estar atrás. */
      var lidas = {};
      (estado.mensagens || []).forEach(function (m) { if (m.lidaEm) lidas[m.id] = m.lidaEm; });

      var novas = doServidor.filter(function (m) { return !conhecidas[m.id]; });

      var antes = retratoDaConversa(estado.mensagens);

      estado.mensagens = doServidor.map(function (m) {
        if (!m.lidaEm && lidas[m.id]) m.lidaEm = lidas[m.id];
        return m;
      });

      /* SÓ AVISA SE MUDOU DE VERDADE.

         Antes avisava a cada notificação do servidor — inclusive a
         do ECO da mensagem que este mesmo aparelho acabou de
         escrever, que já estava na tela. Cada aviso redesenha a
         conversa inteira, e o redesenho é síncrono: enquanto ele
         roda, nada mais acontece na página, nem a resposta da
         gravação que está voltando.

         Com uma conversa de vinte e tantas mensagens isso virava
         segundos de tela travada por envio, e foi o que o Raoni
         descreveu como "demora muito a enviar". O painel não sofria
         do mesmo mal porque só redesenha a ficha quando ela está
         aberta — e já comparava antes de redesenhar. Aqui faltava
         essa comparação. */
      if (retratoDaConversa(estado.mensagens) === antes) return;

      notificar("mensagens");

      /* Aviso só do que chegou do OUTRO lado. Quem escreveu não
         precisa ser avisado do que acabou de escrever. */
      var deQuemUsa = estado.usuario && estado.usuario.papel === "equipe" ? "equipe" : "cliente";
      novas.forEach(function (m) {
        if (m.autor === deQuemUsa) return;
        Store.avisar({ tipo: "mensagem", mensagem: m });
      });
    });
  }

  var Store = {
    /* ---- ciclo de vida ---- */
    iniciar: function () {
      salvarDebounced = global.U.debounce(salvarAgora, 350);
      return backend.carregar().then(function (bruto) {
        estado = sanear(bruto);
        return estado;
      });
    },

    /* =======================================================
       Passar a gravar no servidor

       Chamado logo depois do login. A partir daqui o portal
       para de depender deste navegador: o que o cliente já
       enviou volta do servidor, e o que ele fizer daqui em
       diante sobe para lá.

       O estado local é DESCARTADO e substituído pelo do
       servidor. É de propósito: o servidor é a verdade, e
       aproveitar sobras de outra sessão neste aparelho seria
       misturar dados de gente diferente.
    ------------------------------------------------------- */
    /* ---------- Conversa em tempo real ----------

       O ouvinte substitui a lista inteira de mensagens pelo que
       está no servidor. Isso é seguro porque mensagem enviada não
       se reescreve (a regra do Firestore garante) — então o
       servidor é sempre a versão boa, e não há edição local para
       preservar.

       O que NÃO pode acontecer é o ouvinte disparar aviso de
       "mensagem nova" para quem acabou de escrever. Por isso a
       comparação é por id: só avisa o que não estava aqui antes e
       veio do outro lado. */
    ligarTempoReal: function () { ligarTempoReal(); },

    usarServidor: function (empresaId) {
      if (!global.Nuvem || !global.FB || !global.FB.ligado || !empresaId) {
        return Promise.resolve(false);
      }
      if (backend.nome === "nuvem" && backend.empresaId === empresaId) {
        return Promise.resolve(true);
      }
      var novo = global.Nuvem.criar(empresaId, Arquivos);
      trocandoBackend = true;
      return novo.carregar().then(function (bruto) {
        backend = novo;
        estado = sanear(bruto);
        estado.empresaId = empresaId;

        /* Devolve ao estado as senhas que ficaram presas neste
           aparelho numa sessão anterior. O servidor nunca as
           devolve, então sem isto elas sumiriam agora — que é
           justamente quando dá para tentar mandar de novo. */
        var presas = lerPendentesSalvos(empresaId);
        var quantas = 0;
        Object.keys(presas).forEach(function (k) {
          var p = presas[k];
          if (!p || !p.pacote) return;
          estado.credenciais[k] = {
            pacote: p.pacote, campos: p.campos || [],
            atualizadoEm: p.atualizadoEm || 0, pendenteEnvio: true
          };
          /* O RECIBO VOLTA JUNTO. Ele é o que diz ao portal que esta
             senha já foi informada; sem ele o envelope subiria e a
             tela continuaria pedindo a senha de novo, porque o
             cliente não tem permissão para reler a credencial e
             conferir por conta própria. */
          if (!estado.recibosCredenciais[k]) {
            estado.recibosCredenciais[k] = {
              campos: p.campos || [], em: p.atualizadoEm || Date.now()
            };
          }
          quantas++;
        });

        trocandoBackend = false;
        erroPersistencia = false;
        ligarTempoReal();
        notificar("servidor");
        /* Com senha presa, tenta subir assim que a sessão abre. */
        if (quantas) salvarAgora();
        return true;
      }, function (e) {
        trocandoBackend = false;
        throw e;
      });
    },

    /* Sair da conta: volta ao backend local e apaga a cópia
       deste aparelho. O que está no servidor fica intacto — e o
       próximo a usar o computador não vê nada do anterior. */
    sairDaConta: function () {
      desligarTempoReal();
      trocandoBackend = true;
      backend = LocalBackend;
      return LocalBackend.apagar().then(function () {
        estado = estadoInicial();
        trocandoBackend = false;
        erroPersistencia = false;
        notificar("saiu");
        return true;
      });
    },

    get estado() { return estado; },
    get backendNome() { return backend.nome; },
    get noServidor() { return backend.nome === "nuvem"; },
    /* Único jeito de perguntar de fora se a última gravação falhou.
       Havia dois — este e um `temPendencias()` idêntico — e nenhuma
       tela usava nenhum dos dois. Ficou este, porque saber se há
       coisa presa é pergunta legítima e a resposta não deve depender
       de ler variável interna. */
    get temErroDePersistencia() { return erroPersistencia; },

    on: function (fn) { if (typeof fn === "function") ouvintes.push(fn); },

    /* Aplica uma mudança, persiste e avisa a interface. */
    commit: function (mutador, motivo) {
      if (typeof mutador === "function") mutador(estado);
      salvarDebounced();
      notificar(motivo || "commit");
    },

    /* Grava imediatamente (antes de sair da página ou da conta).
       Devolve promessa: quem precisa ter certeza de que subiu
       antes de encerrar a sessão pode esperar. */
    flush: function () { return salvarAgora(); },

    apagarTudo: function () {
      return backend.apagar().then(function () {
        estado = estadoInicial();
        notificar("wipe");
        return true;
      });
    },

    /* ---- chaves ---- */
    chaveItem: function (grupoId, itemId, socioId) {
      return global.Situacao.chaveItem(grupoId, itemId, socioId);
    },

    item: function (chave) {
      if (!estado.itens[chave]) estado.itens[chave] = registroVazio();
      return estado.itens[chave];
    },

    /* =======================================================
       Convite: a Totali cadastra a empresa e manda o link
       =======================================================
       Resultado possível:
         "aplicado"  — dados gravados, o cliente pode seguir
         "atualizado"— mesma empresa, dados corrigidos pela equipe
         "outra"     — o link é de OUTRA empresa e já existe dado
                       neste aparelho; não sobrescrevemos nada
         "invalido"  — payload sem os campos mínimos
    ------------------------------------------------------- */
    aplicarConvite: function (d) {
      if (!d || typeof d !== "object") return "invalido";
      var razao = String(d.r || "").slice(0, 150).trim();
      var cnpj = String(d.c || "").slice(0, 20).trim();
      if (!razao || !cnpj) return "invalido";

      var atualCnpj = global.U.soDigitos(estado.empresa.cnpj);
      var novoCnpj = global.U.soDigitos(cnpj);
      var temDados = !!estado.empresa.razaoSocial ||
                     Object.keys(estado.itens).length > 0 ||
                     estado.socios.length > 0;

      if (temDados && atualCnpj && novoCnpj && atualCnpj !== novoCnpj) return "outra";

      var jaTinha = !!estado.empresa.razaoSocial;
      Store.commit(function (st) {
        st.empresa.razaoSocial = razao;
        st.empresa.nomeFantasia = String(d.f || "").slice(0, 120).trim();
        st.empresa.cnpj = cnpj;
        if (d.g) st.empresa.regime = String(d.g).slice(0, 60);
        if (typeof d.id === "string" && d.id) st.empresaId = d.id.slice(0, 60);
        st.cadastroPelaEquipe = true;
      }, "convite");
      Store.registrarEvento("convite:aplicado", "", razao);
      return jaTinha ? "atualizado" : "aplicado";
    },

    /* ---- sócios ---- */
    adicionarSocio: function (nome, cpf) {
      var s = { id: global.U.uid(), nome: nome || "", cpf: cpf || "" };
      Store.commit(function (st) { st.socios.push(s); }, "socios");
      return s;
    },

    removerSocio: function (socioId) {
      var chaves = Object.keys(estado.itens).filter(function (k) {
        return k.indexOf("/" + socioId + "/") > -1;
      });
      var idsArquivos = [];
      chaves.forEach(function (k) {
        (estado.itens[k].arquivos || []).forEach(function (a) { idsArquivos.push(a.id); });
      });
      Store.commit(function (st) {
        st.socios = st.socios.filter(function (s) { return s.id !== socioId; });
        chaves.forEach(function (k) { delete st.itens[k]; });
      }, "socios");
      idsArquivos.forEach(function (id) { backend.removerArquivo(id).catch(function () {}); });
    },

    /* ---- arquivos ---- */
    anexar: function (chave, file, aoProgredir) {
      var meta = {
        id: global.U.uid(),
        nome: global.U.nomeSeguro(file.name),
        tamanho: file.size,
        tipo: file.type || "",
        em: Date.now()
      };
      return backend.guardarArquivo(meta.id, file, "documento", aoProgredir).then(function () {
        Store.commit(function () {
          var r = Store.item(chave);
          r.arquivos.push(meta);
          r.na = false;
          r.atualizadoEm = Date.now();
          /* Documento reenviado volta para a fila de conferência:
             uma pendência anterior não pode continuar valendo. */
          r.revisao = revisaoVazia();
        }, "arquivos");
        Store.registrarEvento("arquivo:anexou", chave, meta.nome);
        return meta;
      });
    },

    removerArquivo: function (chave, arquivoId) {
      var nome = "";
      var atual = estado.itens[chave];
      if (atual) {
        (atual.arquivos || []).forEach(function (a) { if (a.id === arquivoId) nome = a.nome; });
      }
      Store.commit(function () {
        var r = Store.item(chave);
        r.arquivos = r.arquivos.filter(function (a) { return a.id !== arquivoId; });
        r.atualizadoEm = Date.now();
      }, "arquivos");
      Store.registrarEvento("arquivo:removeu", chave, nome);
      return backend.removerArquivo(arquivoId, "documento").catch(function () {});
    },

    /* =======================================================
       "Enviar depois"

       O documento que falta não sai da lista e não muda de
       situação — ele continua faltando, e a equipe continua
       vendo que falta. O que muda é o combinado: o cliente diz
       quando vai voltar, o portal para de empurrar aquele item
       para a frente da fila até lá, e no dia avisa.

       Existe porque a alternativa real não é "enviar agora": é
       fechar o portal e esquecer. Quem está sem o documento em
       mãos não tem o que fazer com um botão de enviar.
       ======================================================= */
    marcarLembrete: function (chave, quando) {
      var ms = Number(quando) || 0;
      Store.commit(function () {
        var r = Store.item(chave);
        r.lembrete = ms;
        r.atualizadoEm = Date.now();
      }, "lembrete");
      Store.registrarEvento(ms ? "lembrete:marcou" : "lembrete:limpou", chave,
                            ms ? new Date(ms).toISOString().slice(0, 10) : "");
      return ms;
    },

    lembreteDe: function (chave) {
      var r = estado.itens[chave];
      return (r && r.lembrete) || 0;
    },

    baixarArquivo: function (arquivoId, tipo) {
      return backend.obterArquivo(arquivoId, tipo || "documento");
    },

    /* Endereço direto do arquivo no servidor. Vazio quando o
       portal está rodando só no aparelho. */
    urlArquivo: function (arquivoId, tipo) {
      if (!backend.urlArquivo) return Promise.resolve("");
      return backend.urlArquivo(arquivoId, tipo || "documento").catch(function () { return ""; });
    },

    /* Guarda um anexo de mensagem e devolve só os metadados —
       o conteúdo fica no IndexedDB, como os documentos. */
    guardarAnexo: function (file, nomeSugerido) {
      var meta = {
        id: global.U.uid(),
        nome: global.U.nomeSeguro(nomeSugerido || file.name),
        tamanho: file.size,
        tipo: file.type || ""
      };
      return backend.guardarArquivo(meta.id, file, "mensagem").then(function () { return meta; });
    },

    bytesUsados: function () {
      var t = 0;
      Object.keys(estado.itens).forEach(function (k) {
        (estado.itens[k].arquivos || []).forEach(function (a) { t += a.tamanho || 0; });
      });
      return t;
    },

    /* =======================================================
       5. Situação e progresso

       A conta em si mora em js/situacao.js, e o painel da equipe
       chama exatamente a mesma função. É o que garante que o
       número que o cliente vê e o que a equipe vê sejam o mesmo.
       ======================================================= */

    /* Recorte do estado no formato que o cálculo espera. */
    dadosSituacao: function () {
      return {
        itens: estado.itens,
        gruposNA: estado.gruposNA,
        socios: estado.socios,
        temCredencial: Store.temCredencial
      };
    },

    situacao: function (grupo, item, socioId) {
      return global.Situacao.de(Store.dadosSituacao(), grupo, item, socioId);
    },

    get RESOLVIDAS() { return global.Situacao.RESOLVIDAS; },

    resolvida: function (sit) { return global.Situacao.resolvida(sit); },

    resumoGrupo: function (grupo) {
      return global.Situacao.resumoGrupo(Store.dadosSituacao(), grupo);
    },

    resumoGeral: function () {
      return global.Situacao.resumoGeral(Store.dadosSituacao(), global.DATA.GRUPOS);
    },

    /* =======================================================
       6. Revisão pela equipe da Totali
       Estes métodos são a base do painel interno. Hoje rodam
       no próprio aparelho; no Firebase serão gravações
       autorizadas apenas para quem tem papel "equipe".
       ======================================================= */
    revisar: function (chave, status, motivo, por) {
      if (["analise", "aprovado", "pendencia", ""].indexOf(status) === -1) return false;
      Store.commit(function () {
        var r = Store.item(chave);
        r.revisao = {
          status: status,
          motivo: status === "pendencia" ? String(motivo || "").slice(0, 600) : "",
          por: String(por || "").slice(0, 120),
          em: Date.now()
        };
      }, "revisao");
      Store.registrarEvento("revisao:" + (status || "limpa"), chave, motivo || "", por || "");
      Store.avisar({ tipo: "revisao", chave: chave, status: status, motivo: motivo || "" });
      return true;
    },

    /* Ponte para a camada de notificações. Quem preenche é o
       app.js — assim o Store não precisa conhecer o navegador. */
    notificador: null,
    avisar: function (evento) {
      if (typeof Store.notificador !== "function") return;
      try { Store.notificador(evento); } catch (e) { /* aviso nunca derruba a gravação */ }
    },

    /* =======================================================
       Credenciais

       O texto digitado NUNCA é gravado. Ele é cifrado com a
       chave pública da Totali e só o envelope fechado entra no
       estado. Nem o localStorage, nem o backup, nem o futuro
       Firestore veem a senha.
       ======================================================= */
    guardarCredencial: function (chave, valores) {
      var C = global.Cripto;
      if (!C || !C.configurada) return Promise.reject(new Error("canal-nao-configurado"));

      var limpos = {};
      var campos = [];
      Object.keys(valores || {}).slice(0, 12).forEach(function (k) {
        var v = String(valores[k] == null ? "" : valores[k]).slice(0, 300);
        if (!v) return;
        limpos[String(k).slice(0, 40)] = v;
        campos.push(String(k).slice(0, 40));
      });
      if (!campos.length) return Promise.resolve(false);

      return C.cifrar(limpos).then(function (pacote) {
        Store.commit(function (st) {
          var agora = Date.now();
          st.credenciais[chave] = {
            pacote: pacote, campos: campos, atualizadoEm: agora,
            /* Marca local, nunca sobe: enquanto estiver ligada, a
               senha existe só neste aparelho. */
            pendenteEnvio: true
          };
          /* O recibo é o que sobrevive ao logout: no próximo
             acesso o portal sabe que esta senha já veio, sem
             precisar (nem poder) abrir o envelope. */
          st.recibosCredenciais[chave] = { campos: campos, em: agora };
        }, "credenciais");
        /* A auditoria registra QUE houve envio, jamais o conteúdo. */
        Store.registrarEvento("credencial:enviada", chave, campos.join(", "));

        /* AQUI ESTAVA O BUG: antes devolvia `true` neste ponto, com
           a senha só no aparelho, e a tela dizia "guardado com
           segurança". Senha é o único dado que o cliente não
           consegue reler para conferir — se ela não chegar, ninguém
           percebe até a equipe precisar dela. Então esperamos a
           gravação e contamos a verdade. Falhando, o envelope fica
           na fila e o reenvio automático assume. */
        sincronizarPendentes();
        return salvarAgora().then(function (subiu) {
          return subiu ? "no-servidor" : "so-no-aparelho";
        });
      });
    },

    /* Tira a marca de pendente sem disparar outra gravação: a marca
       é local e não vai para o servidor, então não há o que gravar. */
    confirmarCredenciais: function () {
      var mudou = false;
      Object.keys(estado.credenciais || {}).forEach(function (k) {
        if (estado.credenciais[k] && estado.credenciais[k].pendenteEnvio) {
          delete estado.credenciais[k].pendenteEnvio;
          mudou = true;
        }
      });
      if (mudou) {
        sincronizarPendentes();     /* chegou: apaga a cópia de socorro */
        notificar("credenciais");
      }
      return mudou;
    },

    credencialPendente: function (chave) {
      var c = estado.credenciais[chave];
      return !!(c && c.pendenteEnvio);
    },

    /* Quantas senhas ainda não chegaram ao servidor. É o que o
       "Sair" consulta antes de apagar a cópia do aparelho. */
    credenciaisPendentes: function () {
      return Object.keys(estado.credenciais || {}).filter(function (k) {
        return estado.credenciais[k] && estado.credenciais[k].pendenteEnvio;
      });
    },

    temCredencial: function (chave) {
      var c = estado.credenciais[chave];
      if (c && c.pacote) return true;
      var r = estado.recibosCredenciais[chave];
      return !!(r && r.campos && r.campos.length);
    },

    credencial: function (chave) {
      if (estado.credenciais[chave]) return estado.credenciais[chave];
      var r = estado.recibosCredenciais[chave];
      return r ? { pacote: null, campos: r.campos, atualizadoEm: r.em } : null;
    },

    removerCredencial: function (chave) {
      if (!estado.credenciais[chave] && !estado.recibosCredenciais[chave]) return false;
      Store.commit(function (st) {
        delete st.credenciais[chave];
        delete st.recibosCredenciais[chave];
      }, "credenciais");
      if (backend.removerCredencial) backend.removerCredencial(chave).catch(function () {});
      Store.registrarEvento("credencial:removida", chave, "");
      return true;
    },

    /* ---- Tutoriais guiados ---- */
    tutorialVisto: function (nome) { return !!estado.tutoriais[nome]; },

    marcarTutorial: function (nome) {
      if (estado.tutoriais[nome]) return false;
      Store.commit(function (st) { st.tutoriais[nome] = Date.now(); }, "tutorial");
      return true;
    },

    /* =======================================================
       7. Mensagens entre cliente e equipe
       `chave` opcional prende a mensagem a um documento — é o
       que permite cobrar um item específico que está faltando.
       ======================================================= */
    enviarMensagem: function (texto, opcoes) {
      var o = opcoes || {};
      var t = String(texto || "").trim().slice(0, 4000);
      var anexos = Array.isArray(o.anexos) ? o.anexos.slice(0, 10) : [];
      /* Mensagem só de anexo é válida — nem sempre há o que escrever. */
      if (!t && !anexos.length) return null;
      var msg = {
        id: global.U.uid(),
        autor: o.autor === "equipe" ? "equipe" : "cliente",
        autorNome: String(o.autorNome || "").slice(0, 120),
        texto: t,
        chave: String(o.chave || "").slice(0, 160),
        anexos: anexos,
        em: Date.now(),
        lidaEm: 0
      };
      Store.commit(function (st) {
        st.mensagens.push(msg);
        if (st.mensagens.length > 300) st.mensagens = st.mensagens.slice(-300);
      }, "mensagens");
      Store.avisar({ tipo: "mensagem", mensagem: msg });

      /* A mensagem sobe SOZINHA e AGORA, sem esperar o debounce nem
         o lote do estado inteiro. Se falhar, não tem problema: ela
         continua no estado e a gravação geral leva na próxima — mas
         no caso comum, que é ter internet, ela chega em uma ida ao
         servidor em vez de esperar por cinquenta documentos. */
      if (backend.gravarMensagem) {
        backend.gravarMensagem(msg).catch(function () {
          /* Falhou o atalho: a mensagem continua no estado, então a
             gravação geral leva junto — e essa insiste sozinha. */
          salvarAgora();
        });
      }
      return msg;
    },

    mensagens: function (chave) {
      if (!chave) return estado.mensagens.slice();
      return estado.mensagens.filter(function (m) { return m.chave === chave; });
    },

    naoLidas: function (paraQuem) {
      var deQuem = paraQuem === "equipe" ? "cliente" : "equipe";
      return estado.mensagens.filter(function (m) {
        return m.autor === deQuem && !m.lidaEm;
      }).length;
    },

    /* LAÇO QUE COMIA A TELA — a causa da lentidão das mensagens.

       Isto avisava a interface SEMPRE, mesmo quando não havia nada
       para marcar. E o aviso "mensagens" faz a tela de conversa se
       redesenhar; o redesenho religa o formulário, que chama
       `marcarLidas` de novo, que avisa de novo, que redesenha de
       novo. Um laço que se alimenta sozinho, síncrono, disparado a
       cada mensagem que chega ou sai.

       Enquanto ele girava, nada mais acontecia na página — nem a
       resposta da gravação voltando do servidor. Medido no
       publicado: 25 segundos entre tocar em Enviar e a mensagem
       aparecer, e escritas em /mensagens levando 6 a 12 segundos
       contra 89ms pelo painel, que não tem esse caminho.

       A marcação é feita direto no estado e o aviso só sai quando
       ALGO mudou de verdade. Sem mudança, sem aviso, sem redesenho,
       sem laço. */
    marcarLidas: function (paraQuem) {
      var deQuem = paraQuem === "equipe" ? "cliente" : "equipe";
      var agora = Date.now(), mudou = false;
      estado.mensagens.forEach(function (m) {
        if (m.autor === deQuem && !m.lidaEm) { m.lidaEm = agora; mudou = true; }
      });
      if (!mudou) return false;
      Store.commit(null, "mensagens");
      return true;
    },

    /* =======================================================
       8. Trilha de auditoria

       ATENÇÃO: gravada no próprio aparelho, portanto o cliente
       pode adulterá-la. Serve para dar forma ao recurso e para
       depuração — NÃO tem valor probatório. Vira auditoria de
       verdade quando for escrita no servidor, por Cloud
       Function, com o uid autenticado e sem permissão de
       escrita para o cliente.
       ======================================================= */
    registrarEvento: function (tipo, chave, detalhe, ator) {
      var ev = {
        id: global.U.uid(),
        tipo: String(tipo || "").slice(0, 40),
        chave: String(chave || "").slice(0, 160),
        detalhe: String(detalhe || "").slice(0, 300),
        ator: String(ator || estado.usuario.nome || estado.usuario.uid || "cliente").slice(0, 120),
        em: Date.now()
      };
      Store.commit(function (st) {
        st.eventos.push(ev);
        if (st.eventos.length > MAX_EVENTOS) st.eventos = st.eventos.slice(-MAX_EVENTOS);
      }, "eventos");
      return ev;
    },

    eventos: function (chave) {
      if (!chave) return estado.eventos.slice();
      return estado.eventos.filter(function (e) { return e.chave === chave; });
    },

    /* ---- Etapa financeira ---- */
    financeiroRespondido: function () {
      var f = estado.financeiro;
      if (!f.temBanco || !f.temMaquineta) return false;
      if (f.temBanco === "sim" && !f.bancos.length && !f.bancoOutro.trim()) return false;
      if (f.temMaquineta === "sim") {
        if (!f.maquinetas.length && !f.maquinetaOutra.trim()) return false;
        if (!f.formaRelatorio) return false;
        /* Quem escolheu informar o acesso e usa maquininha de Modo
           Contador precisa confirmar o cadastro — é o equivalente
           de digitar a senha nas outras, e sem isso a Totali fica
           sem entrada nenhuma naquela operadora. */
        if (f.formaRelatorio === "acesso") {
          var faltou = f.maquinetas.some(function (nome) {
            var cat = global.DATA.acharNoCatalogo(global.DATA.MAQUINETAS, nome);
            return cat && cat.semCredencial && !(f.modoContador || {})[nome];
          });
          if (faltou) return false;
        }
      }

      /* Informativo: as três são obrigatórias. Não é burocracia —
         é o que evita descobrir um empréstimo em dezembro. */
      if (!f.contasPagas || !f.emprestimo || !f.aplicacoes) return false;
      if (f.contasPagas === "sim" && !String(f.contasPagasSistema || "").trim()) return false;
      return true;
    },

    /* Quais do Informativo ainda faltam — para a mensagem de erro
       dizer o que falta, e não só "preencha tudo". */
    informativoPendente: function () {
      var f = estado.financeiro;
      var faltam = [];
      if (!f.contasPagas) faltam.push("relatório de contas pagas");
      else if (f.contasPagas === "sim" && !String(f.contasPagasSistema || "").trim()) {
        faltam.push("qual sistema de contas pagas");
      }
      if (!f.emprestimo) faltam.push("empréstimo ou financiamento");
      if (!f.aplicacoes) faltam.push("aplicações financeiras");
      return faltam;
    },

    /* Marcar/desmarcar banco ou maquininha. A validação contra a
       lista oficial fica AQUI, na escrita — não só na leitura.
       Assim nada fora da lista entra no estado em momento algum. */
    alternarFinanceiro: function (tipo, valor) {
      var lista = tipo === "banco" ? global.DATA.BANCOS
                : tipo === "maquineta" ? global.DATA.MAQUINETAS : null;
      /* O catálogo virou lista de objetos {nome, orientacao,
         semCredencial}; a comparação passou a ser pelo nome. */
      if (!lista || global.DATA.nomesDo(lista).indexOf(valor) === -1) return false;
      var campo = tipo === "banco" ? "bancos" : "maquinetas";
      Store.commit(function (st) {
        var arr = st.financeiro[campo];
        var i = arr.indexOf(valor);
        if (i > -1) {
          arr.splice(i, 1);
          /* Desmarcou a maquininha: a confirmação dela não faz mais
             sentido e não pode ficar pendurada no registro. */
          if (tipo === "maquineta" && st.financeiro.modoContador) {
            delete st.financeiro.modoContador[valor];
          }
        } else arr.push(valor);
      }, "financeiro");
      return true;
    },

    /* Confirmação do Modo Contador, por maquininha.

       Vem do checklist financeiro: algumas operadoras liberam a
       contabilidade por dentro do próprio aplicativo, então não há
       login nem senha para guardar. O que a Totali precisa saber é
       se o cliente fez o cadastro — e é isso que fica registrado. */
    definirModoContador: function (maquineta, confirmado) {
      var nome = String(maquineta || "");
      var cat = global.DATA.acharNoCatalogo(global.DATA.MAQUINETAS, nome);
      if (!cat || !cat.semCredencial) return false;
      Store.commit(function (st) {
        if (!st.financeiro.modoContador) st.financeiro.modoContador = {};
        if (confirmado) st.financeiro.modoContador[nome] = true;
        else delete st.financeiro.modoContador[nome];
      }, "financeiro");
      return true;
    },

    definirFinanceiro: function (campo, valor) {
      var texto = { bancoOutro: 200, maquinetaOutra: 200, observacoes: 2000,
                    contasPagasSistema: 200 };
      var simNao = { temBanco: 1, temMaquineta: 1,
                     contasPagas: 1, emprestimo: 1, aplicacoes: 1 };
      var v;

      if (texto[campo]) v = String(valor || "").slice(0, texto[campo]);
      else if (simNao[campo]) v = (valor === "sim" || valor === "nao") ? valor : "";
      else if (campo === "formaRelatorio") {
        var ids = global.DATA.FORMAS_RELATORIO.map(function (x) { return x.id; });
        v = ids.indexOf(valor) > -1 ? valor : "";
      } else return false;

      Store.commit(function (st) {
        st.financeiro[campo] = v;
        /* Responder "não" limpa o que havia sido marcado antes. */
        if (campo === "temBanco" && v !== "sim") { st.financeiro.bancos = []; st.financeiro.bancoOutro = ""; }
        if (campo === "temMaquineta" && v !== "sim") {
          st.financeiro.maquinetas = [];
          st.financeiro.maquinetaOutra = "";
          st.financeiro.formaRelatorio = "";
        }
        /* Trocar para "não" apaga o sistema digitado: senão o texto
           iria junto no envio, respondendo uma pergunta que o
           cliente desfez. */
        if (campo === "contasPagas" && v !== "sim") st.financeiro.contasPagasSistema = "";
      }, "financeiro");
      return true;
    },

    /* Protocolo no mesmo formato do checklist financeiro:
       CF-AAAAMM-XXXXX, com alfabeto sem caracteres que se
       confundem ao ditar por telefone (0/O, 1/I). */
    gerarProtocolo: function () {
      var ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      var d = new Date();
      var mes = (d.getMonth() + 1 < 10 ? "0" : "") + (d.getMonth() + 1);
      var bytes = new Uint8Array(5);
      global.crypto.getRandomValues(bytes);
      var sufixo = "";
      for (var i = 0; i < 5; i++) sufixo += ALFABETO[bytes[i] % ALFABETO.length];
      return "CF-" + d.getFullYear() + mes + "-" + sufixo;
    },

    concluirFinanceiro: function () {
      if (!Store.financeiroRespondido()) return false;
      Store.commit(function (st) {
        st.financeiro.concluidoEm = Date.now();
        if (!st.financeiro.protocolo) st.financeiro.protocolo = Store.gerarProtocolo();
      }, "financeiro");
      Store.registrarEvento("financeiro:concluido", "", estado.financeiro.protocolo);
      return true;
    },

    /* Guarda o PDF do termo e registra os metadados. */
    guardarTermo: function (blob, nome, em) {
      var id = global.U.uid();
      return backend.guardarArquivo(id, blob, "documento").then(function () {
        Store.commit(function (st) {
          st.financeiro.termo = { id: id, nome: nome, em: em || Date.now() };
        }, "financeiro");
        Store.registrarEvento("termo:gerado", "", nome);
        return id;
      });
    },

    /* =======================================================
       Trilha do onboarding

       Devolve as etapas com a situação de cada uma, para que o
       cliente possa clicar e ir direto ao ponto. Uma etapa só
       abre quando a anterior está concluída — assim ninguém se
       perde nem responde na ordem errada.
       ======================================================= */
    trilha: function () {
      var e = estado.empresa;
      var r = Store.resumoGeral();

      var concluidas = {
        "boas-vindas": !!estado.aceiteLGPD,
        /* Sócio conta na etapa: sem ele, a lista de documentos de
           sócio nasce vazia e o cliente acha que já entregou tudo. */
        "cadastro": !!(e.razaoSocial && e.cnpj && e.responsavelNome &&
                       e.responsavelEmail && e.responsavelTelefone &&
                       estado.socios.length > 0),
        "documentos": r.total > 0 && r.pendentesObrigatorios === 0 && r.pendencias === 0,
        "financeiro": !!estado.financeiro.concluidoEm,
        "analise": estado.etapa === "analise-ok" || estado.etapa === "ativo",
        "ativo": estado.etapa === "ativo"
      };

      var anteriorOk = true;
      var achouAtual = false;

      return global.DATA.ETAPAS.map(function (etapa) {
        var feita = !!concluidas[etapa.id];
        var situacao;
        if (feita) situacao = "concluida";
        else if (anteriorOk && !achouAtual) { situacao = "atual"; achouAtual = true; }
        else situacao = anteriorOk ? "aberta" : "bloqueada";

        var podeAbrir = !!etapa.rota && (feita || situacao === "atual" || situacao === "aberta");
        if (!feita) anteriorOk = false;

        return {
          id: etapa.id,
          titulo: etapa.titulo,
          desc: etapa.desc,
          rota: etapa.rota || "",
          acao: etapa.acao || "",
          situacao: situacao,
          podeAbrir: podeAbrir
        };
      });
    },

    /* Etapa atual do onboarding, deduzida do preenchimento. */
    etapaAtual: function () {
      var t = Store.trilha();
      for (var i = 0; i < t.length; i++) if (t[i].situacao === "atual") return t[i].id;
      return t.length ? t[t.length - 1].id : "boas-vindas";
    }
  };

  global.Store = Store;
})(window);
