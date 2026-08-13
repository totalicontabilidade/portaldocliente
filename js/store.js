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
        formaRelatorio: "", observacoes: "",
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
      if (Array.isArray(f.bancos)) {
        alvo.bancos = f.bancos.filter(function (b) { return global.DATA.BANCOS.indexOf(b) > -1; });
      }
      if (Array.isArray(f.maquinetas)) {
        alvo.maquinetas = f.maquinetas.filter(function (m) { return global.DATA.MAQUINETAS.indexOf(m) > -1; });
      }
      alvo.bancoOutro = typeof f.bancoOutro === "string" ? f.bancoOutro.slice(0, 200) : "";
      alvo.maquinetaOutra = typeof f.maquinetaOutra === "string" ? f.maquinetaOutra.slice(0, 200) : "";
      alvo.observacoes = typeof f.observacoes === "string" ? f.observacoes.slice(0, 2000) : "";
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

  var salvarAgora = function () {
    /* Durante a troca de backend o estado está a meio caminho:
       gravar agora escreveria no lugar errado. */
    if (trocandoBackend) return Promise.resolve(false);
    estado.atualizadoEm = Date.now();
    return backend.salvar(estado).then(function () {
      erroPersistencia = false;
      return true;
    }, function () {
      if (!erroPersistencia) {
        erroPersistencia = true;
        notificar("erro-persistencia");
      }
      return false;
    });
  };
  var salvarDebounced = null;   /* criado no init, depende de U */

  function notificar(motivo) {
    ouvintes.forEach(function (fn) {
      try { fn(estado, motivo); } catch (e) { /* um ouvinte com erro não derruba os outros */ }
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
        trocandoBackend = false;
        erroPersistencia = false;
        notificar("servidor");
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
    anexar: function (chave, file) {
      var meta = {
        id: global.U.uid(),
        nome: global.U.nomeSeguro(file.name),
        tamanho: file.size,
        tipo: file.type || "",
        em: Date.now()
      };
      return backend.guardarArquivo(meta.id, file, "documento").then(function () {
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
          st.credenciais[chave] = { pacote: pacote, campos: campos, atualizadoEm: agora };
          /* O recibo é o que sobrevive ao logout: no próximo
             acesso o portal sabe que esta senha já veio, sem
             precisar (nem poder) abrir o envelope. */
          st.recibosCredenciais[chave] = { campos: campos, em: agora };
        }, "credenciais");
        /* A auditoria registra QUE houve envio, jamais o conteúdo. */
        Store.registrarEvento("credencial:enviada", chave, campos.join(", "));
        return true;
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

    marcarLidas: function (paraQuem) {
      var deQuem = paraQuem === "equipe" ? "cliente" : "equipe";
      var agora = Date.now(), mudou = false;
      Store.commit(function (st) {
        st.mensagens.forEach(function (m) {
          if (m.autor === deQuem && !m.lidaEm) { m.lidaEm = agora; mudou = true; }
        });
      }, "mensagens");
      return mudou;
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
      }
      return true;
    },

    /* Marcar/desmarcar banco ou maquininha. A validação contra a
       lista oficial fica AQUI, na escrita — não só na leitura.
       Assim nada fora da lista entra no estado em momento algum. */
    alternarFinanceiro: function (tipo, valor) {
      var lista = tipo === "banco" ? global.DATA.BANCOS
                : tipo === "maquineta" ? global.DATA.MAQUINETAS : null;
      if (!lista || lista.indexOf(valor) === -1) return false;
      var campo = tipo === "banco" ? "bancos" : "maquinetas";
      Store.commit(function (st) {
        var arr = st.financeiro[campo];
        var i = arr.indexOf(valor);
        if (i > -1) arr.splice(i, 1); else arr.push(valor);
      }, "financeiro");
      return true;
    },

    definirFinanceiro: function (campo, valor) {
      var texto = { bancoOutro: 200, maquinetaOutra: 200, observacoes: 2000 };
      var simNao = { temBanco: 1, temMaquineta: 1 };
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
