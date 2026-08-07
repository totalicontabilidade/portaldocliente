/* ============================================================
   Totali · Portal de Onboarding
   store.js — estado da aplicação e persistência

   ARQUITETURA
   -----------
   Toda gravação passa por um "backend". Hoje existe apenas o
   LocalBackend (localStorage + IndexedDB, tudo no aparelho do
   cliente). Quando o Firebase entrar, basta criar um
   FirebaseBackend com os mesmos quatro métodos
   (carregar/salvar/apagar + arquivos) e trocar a linha marcada
   com [TROCA-FIREBASE]. Nada mais no sistema precisa mudar.

   O QUE NUNCA É GRAVADO
   ---------------------
   Senhas, códigos de acesso e o conteúdo de certificados
   digitais. Os itens do tipo "acesso" guardam apenas a forma
   escolhida de liberação — jamais a credencial em si.
   ============================================================ */
(function (global) {
  "use strict";

  var CHAVE = "totali.onboarding.v1";
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
        t.oncomplete = function () { resolve(out && out.result !== undefined ? out.result : out); };
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
    guardarArquivo: function (id, blob) { return Arquivos.guardar(id, blob); },
    obterArquivo:   function (id) { return Arquivos.obter(id); },
    removerArquivo: function (id) { return Arquivos.remover(id); }
  };

  /* [TROCA-FIREBASE] — trocar aqui quando o Firebase entrar. */
  var backend = LocalBackend;

  /* =========================================================
     3. Estado
     ========================================================= */
  function estadoInicial() {
    return {
      v: 1,
      criadoEm: Date.now(),
      atualizadoEm: Date.now(),
      etapa: "boas-vindas",
      aceiteLGPD: null,
      empresa: {
        razaoSocial: "", nomeFantasia: "", cnpj: "", regime: "",
        responsavelNome: "", responsavelEmail: "", responsavelTelefone: "", responsavelCargo: ""
      },
      socios: [],
      gruposNA: {},
      itens: {}   /* chave -> registro do item */
    };
  }

  function registroVazio() {
    return { arquivos: [], valor: "", na: false, obs: "", forma: "", atualizadoEm: 0 };
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
    return s;
  }

  /* =========================================================
     4. API pública
     ========================================================= */
  var estado = estadoInicial();
  var ouvintes = [];
  var erroPersistencia = false;

  var salvarAgora = function () {
    estado.atualizadoEm = Date.now();
    backend.salvar(estado).then(function () {
      erroPersistencia = false;
    }, function () {
      if (!erroPersistencia) {
        erroPersistencia = true;
        notificar("erro-persistencia");
      }
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

    get estado() { return estado; },
    get backendNome() { return backend.nome; },
    get temErroDePersistencia() { return erroPersistencia; },

    on: function (fn) { if (typeof fn === "function") ouvintes.push(fn); },

    /* Aplica uma mudança, persiste e avisa a interface. */
    commit: function (mutador, motivo) {
      if (typeof mutador === "function") mutador(estado);
      salvarDebounced();
      notificar(motivo || "commit");
    },

    /* Grava imediatamente (usado antes de sair da página). */
    flush: function () { salvarAgora(); },

    apagarTudo: function () {
      return backend.apagar().then(function () {
        estado = estadoInicial();
        notificar("wipe");
        return true;
      });
    },

    /* ---- chaves ---- */
    chaveItem: function (grupoId, itemId, socioId) {
      return socioId ? grupoId + "/" + socioId + "/" + itemId : grupoId + "/" + itemId;
    },

    item: function (chave) {
      if (!estado.itens[chave]) estado.itens[chave] = registroVazio();
      return estado.itens[chave];
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
      return backend.guardarArquivo(meta.id, file).then(function () {
        Store.commit(function () {
          var r = Store.item(chave);
          r.arquivos.push(meta);
          r.na = false;
          r.atualizadoEm = Date.now();
        }, "arquivos");
        return meta;
      });
    },

    removerArquivo: function (chave, arquivoId) {
      Store.commit(function () {
        var r = Store.item(chave);
        r.arquivos = r.arquivos.filter(function (a) { return a.id !== arquivoId; });
        r.atualizadoEm = Date.now();
      }, "arquivos");
      return backend.removerArquivo(arquivoId).catch(function () {});
    },

    baixarArquivo: function (arquivoId) { return backend.obterArquivo(arquivoId); },

    bytesUsados: function () {
      var t = 0;
      Object.keys(estado.itens).forEach(function (k) {
        (estado.itens[k].arquivos || []).forEach(function (a) { t += a.tamanho || 0; });
      });
      return t;
    },

    /* =======================================================
       5. Cálculo de situação e progresso
       ======================================================= */

    /* Um item pode estar: "na" (não se aplica), "substituido"
       (a CNH cobre RG e CPF), "enviado" ou "pendente". */
    situacao: function (grupo, item, socioId) {
      if (estado.gruposNA[grupo.id]) return "na";
      var chave = Store.chaveItem(grupo.id, item.id, socioId);
      var r = estado.itens[chave];
      if (r && r.na) return "na";

      if (item.substituivelPor) {
        var subChave = Store.chaveItem(grupo.id, item.substituivelPor, socioId);
        var sub = estado.itens[subChave];
        if (sub && sub.arquivos && sub.arquivos.length) return "substituido";
      }
      if (!r) return "pendente";
      if (item.kind === "arquivo" && r.arquivos.length) return "enviado";
      if (item.kind === "dado" && String(r.valor || "").trim()) return "enviado";
      if (item.kind === "acesso" && r.forma) return "enviado";
      return "pendente";
    },

    /* Resumo de um grupo, considerando sócios quando for o caso. */
    resumoGrupo: function (grupo) {
      var total = 0, ok = 0, pendentesObrig = 0;
      var alvos = grupo.escopo === "socio"
        ? estado.socios.map(function (s) { return s.id; })
        : [null];

      alvos.forEach(function (socioId) {
        grupo.itens.forEach(function (item) {
          var sit = Store.situacao(grupo, item, socioId);
          if (sit === "na") return;
          total++;
          if (sit === "enviado" || sit === "substituido") ok++;
          else if (item.obrigatorio) pendentesObrig++;
        });
      });
      return {
        total: total,
        ok: ok,
        pendentes: total - ok,
        pendentesObrigatorios: pendentesObrig,
        pct: total ? Math.round((ok / total) * 100) : 0,
        completo: total > 0 && ok === total,
        vazio: total === 0
      };
    },

    resumoGeral: function () {
      var total = 0, ok = 0, obrig = 0;
      global.DATA.GRUPOS.forEach(function (g) {
        var r = Store.resumoGrupo(g);
        total += r.total; ok += r.ok; obrig += r.pendentesObrigatorios;
      });
      return {
        total: total,
        ok: ok,
        pendentes: total - ok,
        pendentesObrigatorios: obrig,
        pct: total ? Math.round((ok / total) * 100) : 0
      };
    },

    /* Etapa atual do onboarding, deduzida do preenchimento. */
    etapaAtual: function () {
      var e = estado.empresa;
      if (!estado.aceiteLGPD) return "boas-vindas";
      if (!e.razaoSocial || !e.cnpj || !e.responsavelNome) return "cadastro";
      var r = Store.resumoGeral();
      if (r.total === 0 || r.ok < r.total) return "documentos";
      return "analise";
    }
  };

  global.Store = Store;
})(window);
