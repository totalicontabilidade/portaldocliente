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
      gruposNA: {},
      itens: {},      /* chave do documento -> registro           */
      mensagens: [],  /* conversa entre cliente e equipe          */
      eventos: []     /* trilha de auditoria (ver nota em registrarEvento) */
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
      return backend.guardarArquivo(meta.id, file).then(function () {
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

    /* Situações possíveis de um documento, na ordem em que vencem:
         na          — não se aplica (item ou grupo inteiro)
         substituido — a CNH cobre RG e CPF
         pendencia   — a equipe recusou; o cliente precisa reenviar
         aprovado    — a equipe conferiu e aceitou
         analise     — entregue, a equipe está conferindo
         enviado     — entregue, ainda sem revisão
         pendente    — nada entregue                                   */
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

      var rev = (r.revisao && r.revisao.status) || "";
      if (rev === "pendencia") return "pendencia";
      if (rev === "aprovado") return "aprovado";
      if (rev === "analise") return "analise";

      if (item.kind === "arquivo" && r.arquivos.length) return "enviado";
      if (item.kind === "dado" && String(r.valor || "").trim()) return "enviado";
      if (item.kind === "acesso" && r.forma) return "enviado";
      return "pendente";
    },

    /* Situações que contam como "resolvido" na barra de progresso.
       Pendência NÃO conta: o documento voltou para o cliente. */
    RESOLVIDAS: ["enviado", "substituido", "analise", "aprovado"],

    resolvida: function (sit) { return Store.RESOLVIDAS.indexOf(sit) > -1; },

    /* Resumo de um grupo, considerando sócios quando for o caso. */
    resumoGrupo: function (grupo) {
      var total = 0, ok = 0, pendentesObrig = 0, pendencias = 0, aprovados = 0;
      var alvos = grupo.escopo === "socio"
        ? estado.socios.map(function (s) { return s.id; })
        : [null];

      alvos.forEach(function (socioId) {
        grupo.itens.forEach(function (item) {
          var sit = Store.situacao(grupo, item, socioId);
          if (sit === "na") return;
          total++;
          if (sit === "pendencia") pendencias++;
          if (sit === "aprovado") aprovados++;
          if (Store.resolvida(sit)) ok++;
          else if (item.obrigatorio) pendentesObrig++;
        });
      });
      return {
        total: total,
        ok: ok,
        pendentes: total - ok,
        pendentesObrigatorios: pendentesObrig,
        pendencias: pendencias,
        aprovados: aprovados,
        pct: total ? Math.round((ok / total) * 100) : 0,
        completo: total > 0 && ok === total,
        vazio: total === 0
      };
    },

    resumoGeral: function () {
      var total = 0, ok = 0, obrig = 0, pend = 0, aprov = 0;
      global.DATA.GRUPOS.forEach(function (g) {
        var r = Store.resumoGrupo(g);
        total += r.total; ok += r.ok; obrig += r.pendentesObrigatorios;
        pend += r.pendencias; aprov += r.aprovados;
      });
      return {
        total: total,
        ok: ok,
        pendentes: total - ok,
        pendentesObrigatorios: obrig,
        pendencias: pend,
        aprovados: aprov,
        pct: total ? Math.round((ok / total) * 100) : 0
      };
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
       7. Mensagens entre cliente e equipe
       `chave` opcional prende a mensagem a um documento — é o
       que permite cobrar um item específico que está faltando.
       ======================================================= */
    enviarMensagem: function (texto, opcoes) {
      var o = opcoes || {};
      var t = String(texto || "").trim().slice(0, 4000);
      if (!t) return null;
      var msg = {
        id: global.U.uid(),
        autor: o.autor === "equipe" ? "equipe" : "cliente",
        autorNome: String(o.autorNome || "").slice(0, 120),
        texto: t,
        chave: String(o.chave || "").slice(0, 160),
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
