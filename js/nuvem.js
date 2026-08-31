/* ============================================================
   Totali · Portal de Onboarding
   nuvem.js — gravação no servidor (Firestore + Storage)

   O QUE ESTE ARQUIVO RESOLVE
   --------------------------
   Antes, tudo o que o cliente preenchia ficava só no navegador
   dele. Trocar de celular, limpar o histórico ou entrar por uma
   janela anônima significava começar do zero. Agora o portal
   guarda no servidor, ligado à empresa — e o cliente reencontra
   exatamente onde parou, em qualquer aparelho.

   COMO CONVERSA COM O RESTO DO SISTEMA
   ------------------------------------
   Este arquivo entrega um "backend" com os mesmos métodos do
   backend local (carregar / salvar / apagar / arquivos). O
   store.js troca um pelo outro e mais nada muda.

   ONDE CADA COISA MORA
   --------------------
     empresas/{id}                      contato e aceite da LGPD
     empresas/{id}/socios/{socioId}     sócios
     empresas/{id}/itens/{chave}        documentos do checklist
     empresas/{id}/credenciais/{chave}  senhas, sempre cifradas
     empresas/{id}/mensagens/{id}       conversa com a equipe
     empresas/{id}/eventos/{id}         trilha de acompanhamento
     empresas/{id}/financeiro/principal bancos e maquininhas
     empresas/{id}/financeiro/geral     preferências do portal
     Storage: empresas/{id}/documentos/{arquivoId}/arquivo
              empresas/{id}/mensagens/{arquivoId}/arquivo

   POR QUE ESCREVE POUCO
   ---------------------
   Cada gravação compara o estado atual com o que já está no
   servidor e manda só o que mudou. Digitar um telefone não
   reescreve os cinquenta documentos do checklist.

   O QUE O CLIENTE NÃO CONSEGUE LER DE VOLTA
   -----------------------------------------
   As credenciais cifradas (só admin lê) e a trilha de eventos
   (só a equipe lê). Para o portal continuar sabendo que uma
   senha já foi enviada, guardamos um RECIBO — quais campos e
   quando — sem nada do conteúdo.
   ============================================================ */
(function (global) {
  "use strict";

  /* Chave de item vira id de documento: "societario/contrato" não
     pode virar caminho no Firestore, então a barra vira til. Nem
     grupo, nem item, nem id de sócio usam til — a volta é exata. */
  function codificar(chave) { return String(chave || "").replace(/\//g, "~"); }
  function decodificar(id) { return String(id || "").replace(/~/g, "/"); }

  function num(v) { return typeof v === "number" ? v : 0; }
  function txt(v, max) { return typeof v === "string" ? v.slice(0, max || 4000) : ""; }

  /* Firestore recusa `undefined`. Toda montagem de payload passa
     por aqui para não derrubar uma gravação por um campo vazio. */
  function limpo(obj) {
    var saida = {};
    Object.keys(obj).forEach(function (k) {
      if (obj[k] !== undefined) saida[k] = obj[k];
    });
    return saida;
  }

  /* Registro de documento sem nada dentro. `atualizadoEm` fica em
     zero de propósito: se levasse a hora atual, toda gravação
     pareceria diferente e o documento seria reescrito para sempre. */
  var ITEM_VAZIO = {
    arquivos: [], valor: "", na: false, forma: "", obs: "", atualizadoEm: 0,
    lembrete: 0
  };

  function criar(empresaId, cacheLocal) {
    var FB = global.FB;
    var db = FB.db;
    var storage = FB.storage;
    var raiz = db.collection("empresas").doc(empresaId);

    /* Retrato do que já está no servidor: caminho -> JSON.
       É a base da comparação que evita gravação repetida. */
    var retrato = {};
    var carregou = false;

    function difere(caminho, dados) {
      return retrato[caminho] !== JSON.stringify(dados);
    }
    function fixar(caminho, dados) {
      retrato[caminho] = JSON.stringify(dados);
    }

    /* ---------- Montagem dos documentos ---------- */

    /* A regra do servidor só deixa o cliente mexer nestes campos
       da empresa. Razão social, CNPJ e regime são da equipe. */
    function payloadEmpresa(st) {
      return {
        responsavelNome: txt(st.empresa.responsavelNome, 200),
        responsavelEmail: txt(st.empresa.responsavelEmail, 200),
        responsavelTelefone: txt(st.empresa.responsavelTelefone, 200),
        responsavelCargo: txt(st.empresa.responsavelCargo, 200),
        etapa: txt(st.etapa, 40),
        aceiteLGPD: st.aceiteLGPD == null ? null : num(st.aceiteLGPD)
      };
    }

    function payloadItem(r) {
      return {
        arquivos: (r.arquivos || []).map(function (a) {
          return {
            id: txt(a.id, 60), nome: txt(a.nome, 160),
            tamanho: num(a.tamanho), tipo: txt(a.tipo, 120), em: num(a.em)
          };
        }),
        valor: txt(r.valor, 400),
        na: r.na === true,
        forma: txt(r.forma, 60),
        obs: txt(r.obs, 1000),
        /* Quando o cliente respondeu a uma correção. Precisa vir no
           payload, senão a hora fica só no aparelho dele e a linha
           do tempo do documento nasce sem ela na próxima abertura. */
        obsEm: num(r.obsEm),
        atualizadoEm: num(r.atualizadoEm),
        lembrete: num(r.lembrete),
        /* QUEM MEXEU NESTE DOCUMENTO.

           A trilha de auditoria é escrita por uma Cloud Function que
           observa a gravação — e um gatilho do Firestore não recebe
           o usuário que gravou. Resultado: "item:enviado" e
           "item:removido" saíam sem autor nenhum. Numa empresa com
           duas pessoas no portal, a trilha não respondia a única
           pergunta que importa depois: quem tirou o documento.

           A regra do servidor exige que `porUid` seja o uid de quem
           está gravando, então isto não é uma declaração de boa fé:
           é assinatura. `porNome` vai junto só para a trilha ser
           legível sem consultar a lista de acessos. */
        porUid: txt(r.porUid, 60),
        porNome: txt(r.porNome, 120)
      };
    }

    function payloadMensagem(m) {
      return {
        autor: m.autor === "equipe" ? "equipe" : "cliente",
        autorNome: txt(m.autorNome, 120),
        /* Identidade de quem escreveu, para a regra do servidor
           saber de quem é a mensagem na hora de apagar. Mensagem
           antiga não tem, e não precisa: ela já está fora da janela
           de 15 minutos. */
        autorUid: txt(m.autorUid, 60),
        texto: txt(m.texto, 4000),
        chave: txt(m.chave, 160),
        anexos: (m.anexos || []).map(function (a) {
          return {
            id: txt(a.id, 60), nome: txt(a.nome, 160),
            tamanho: num(a.tamanho), tipo: txt(a.tipo, 120)
          };
        }),
        em: num(m.em),
        lidaEm: num(m.lidaEm),
        /* A lápide de uma mensagem apagada, e a marca de editada.
           Sobem zeradas nas novas e precisam constar aqui: o retrato
           do servidor passa por esta função, e campo ausente daqui
           viraria "mudou" a cada comparação, reescrevendo a mensagem
           para sempre. */
        apagadaEm: num(m.apagadaEm),
        apagadaPor: txt(m.apagadaPor, 120),
        editadaEm: num(m.editadaEm)
      };
    }

    function payloadFinanceiro(f) {
      return {
        temBanco: txt(f.temBanco, 4),
        bancos: (f.bancos || []).slice(0, 60).map(function (b) { return txt(b, 80); }),
        bancoOutro: txt(f.bancoOutro, 200),
        temMaquineta: txt(f.temMaquineta, 4),
        maquinetas: (f.maquinetas || []).slice(0, 60).map(function (m) { return txt(m, 80); }),
        maquinetaOutra: txt(f.maquinetaOutra, 200),
        /* Confirmação do Modo Contador. Só chaves com valor true —
           `false` aqui não significa nada e só ocuparia espaço. */
        modoContador: Object.keys(f.modoContador || {}).slice(0, 40)
          .filter(function (k) { return (f.modoContador || {})[k] === true; })
          .reduce(function (acc, k) { acc[txt(k, 80)] = true; return acc; }, {}),
        formaRelatorio: txt(f.formaRelatorio, 40),
        contasPagas: txt(f.contasPagas, 4),
        contasPagasSistema: txt(f.contasPagasSistema, 200),
        emprestimo: txt(f.emprestimo, 4),
        aplicacoes: txt(f.aplicacoes, 4),
        observacoes: txt(f.observacoes, 2000),
        concluidoEm: num(f.concluidoEm),
        protocolo: txt(f.protocolo, 40),
        termo: {
          id: txt((f.termo || {}).id, 60),
          nome: txt((f.termo || {}).nome, 200),
          em: num((f.termo || {}).em)
        }
      };
    }

    /* Preferências do portal. Fica numa coleção que o cliente pode
       ler e escrever inteira — diferente de `credenciais`, que só
       admin lê. Por isso o RECIBO da credencial mora aqui: diz que
       a senha foi enviada, sem carregar nada dela. */
    function payloadGeral(st) {
      var recibos = {};
      Object.keys(st.recibosCredenciais || {}).slice(0, 200).forEach(function (k) {
        var r = st.recibosCredenciais[k] || {};
        recibos[codificar(k)] = {
          campos: (r.campos || []).slice(0, 12).map(function (c) { return txt(c, 40); }),
          em: num(r.em)
        };
      });
      var tutoriais = {};
      Object.keys(st.tutoriais || {}).slice(0, 20).forEach(function (k) {
        tutoriais[txt(k, 40)] = num(st.tutoriais[k]);
      });
      var grupos = {};
      Object.keys(st.gruposNA || {}).slice(0, 60).forEach(function (k) {
        if (st.gruposNA[k] === true) grupos[txt(k, 60)] = true;
      });
      /* RESUMO DO PROGRESSO — não é para o portal, é para o
         servidor.

         A lista de documentos vive em js/data.js e é editável
         pela equipe na aba Conteúdo. A Cloud Function que avisa
         o cliente parado não tem como conhecê-la sem duplicar a
         lista lá dentro — e duas listas divergem no dia em que
         alguém acrescentar um documento.

         Então quem sabe contar grava a conta: o portal, que já
         tem tudo em mãos. A função só lê o número. */
      var resumo = null;
      try {
        var r = global.Situacao.resumoGeral(
          { itens: st.itens || {}, socios: st.socios || [], gruposNA: st.gruposNA || {},
            temCredencial: function (chave) {
              var c = (st.recibosCredenciais || {})[chave];
              return !!(c && c.campos && c.campos.length);
            } },
          global.DATA.GRUPOS
        );
        resumo = {
          total: num(r.total), ok: num(r.ok),
          pendentesObrigatorios: num(r.pendentesObrigatorios),
          pendencias: num(r.pendencias), aprovados: num(r.aprovados),
          pct: num(r.pct)
        };
      } catch (e) { resumo = null; }

      var saida = { gruposNA: grupos, tutoriais: tutoriais, credenciaisEnviadas: recibos };
      if (resumo) saida.resumo = resumo;
      return saida;
    }

    /* ---------- Leitura ---------- */
    function carregar() {
      return Promise.all([
        raiz.get(),
        raiz.collection("socios").get(),
        raiz.collection("itens").get(),
        raiz.collection("mensagens").get(),
        raiz.collection("financeiro").get()
      ]).then(function (r) {
        var empDoc = r[0], socios = r[1], itens = r[2], msgs = r[3], fin = r[4];

        /* Mesmo cuidado do firebase.js: documento ausente só quer
           dizer "não existe" quando a resposta veio do SERVIDOR.
           Vinda do cache, ela não afirma nada — e tratar isso como
           empresa apagada mandaria o cliente para a tela de senha
           por causa de uma oscilação de rede. */
        if (!empDoc.exists) {
          var doServidor = empDoc.metadata && empDoc.metadata.fromCache === false;
          throw new Error(doServidor ? "empresa-inexistente" : "leitura-falhou");
        }

        var e = empDoc.data() || {};
        var bruto = {
          v: 2,
          empresaId: empresaId,
          cadastroPelaEquipe: true,
          criadoEm: num(e.criadoEm) || Date.now(),
          atualizadoEm: num(e.atualizadoEm) || Date.now(),
          etapa: txt(e.etapa, 40) || "boas-vindas",
          aceiteLGPD: typeof e.aceiteLGPD === "number" ? e.aceiteLGPD : null,
          empresa: {
            razaoSocial: txt(e.razaoSocial, 200),
            nomeFantasia: txt(e.nomeFantasia, 200),
            cnpj: txt(e.cnpj, 20),
            regime: txt(e.regime, 60),
            responsavelNome: txt(e.responsavelNome, 200),
            responsavelEmail: txt(e.responsavelEmail, 200),
            responsavelTelefone: txt(e.responsavelTelefone, 200),
            responsavelCargo: txt(e.responsavelCargo, 200)
          },
          socios: [], itens: {}, credenciais: {}, recibosCredenciais: {},
          mensagens: [], eventos: [], gruposNA: {}, tutoriais: {}
        };
        fixar("empresa", payloadEmpresa(bruto));

        socios.forEach(function (d) {
          var s = d.data() || {};
          var reg = { id: d.id, nome: txt(s.nome, 120), cpf: txt(s.cpf, 20) };
          bruto.socios.push(reg);
          fixar("socios/" + d.id, { nome: reg.nome, cpf: reg.cpf });
        });

        itens.forEach(function (d) {
          var it = d.data() || {};
          bruto.itens[decodificar(d.id)] = it;
          fixar("itens/" + d.id, payloadItem(it));
        });

        msgs.forEach(function (d) {
          var m = d.data() || {};
          m.id = d.id;
          bruto.mensagens.push(m);
          fixar("mensagens/" + d.id, payloadMensagem(m));
        });
        bruto.mensagens.sort(function (a, b) { return num(a.em) - num(b.em); });

        fin.forEach(function (d) {
          if (d.id === "principal") bruto.financeiro = d.data() || {};
          if (d.id === "geral") {
            var g = d.data() || {};
            bruto.gruposNA = g.gruposNA || {};
            bruto.tutoriais = g.tutoriais || {};
            Object.keys(g.credenciaisEnviadas || {}).forEach(function (k) {
              bruto.recibosCredenciais[decodificar(k)] = g.credenciaisEnviadas[k];
            });
          }
        });
        if (bruto.financeiro) fixar("financeiro/principal", payloadFinanceiro(bruto.financeiro));
        fixar("financeiro/geral", payloadGeral(bruto));

        carregou = true;
        return bruto;
      });
    }

    /* ---------- Gravação ---------- */
    function salvar(st) {
      /* Sem ter lido antes, não há com o que comparar: gravar
         agora poderia apagar no servidor o que ainda não chegou. */
      if (!carregou) return Promise.resolve(true);

      var escritas = [];   /* {ref, dados, modo} */
      var confirmar = [];  /* [caminho, payload] — só fixa se tudo der certo */

      function juntar(caminho, ref, dados, modo) {
        if (!difere(caminho, dados)) return;
        escritas.push({ ref: ref, dados: dados, modo: modo || "merge" });
        confirmar.push([caminho, dados]);
      }

      /* Empresa */
      var emp = payloadEmpresa(st);
      if (difere("empresa", emp)) {
        escritas.push({
          ref: raiz,
          dados: limpo({
            responsavelNome: emp.responsavelNome,
            responsavelEmail: emp.responsavelEmail,
            responsavelTelefone: emp.responsavelTelefone,
            responsavelCargo: emp.responsavelCargo,
            etapa: emp.etapa,
            aceiteLGPD: emp.aceiteLGPD,
            atualizadoEm: Date.now()
          }),
          modo: "merge"
        });
        confirmar.push(["empresa", emp]);
      }

      /* Sócios */
      var vistosSocios = {};
      (st.socios || []).forEach(function (s) {
        var d = { nome: txt(s.nome, 120), cpf: txt(s.cpf, 20) };
        vistosSocios["socios/" + s.id] = true;
        juntar("socios/" + s.id, raiz.collection("socios").doc(s.id), d);
      });

      /* Itens do checklist */
      var vistosItens = {};
      Object.keys(st.itens || {}).forEach(function (chave) {
        var id = codificar(chave);
        var d = payloadItem(st.itens[chave]);
        vistosItens["itens/" + id] = true;
        juntar("itens/" + id, raiz.collection("itens").doc(id), d);
      });

      /* Credenciais cifradas: só sobem, nunca voltam para cá. */
      Object.keys(st.credenciais || {}).forEach(function (chave) {
        var c = st.credenciais[chave];
        if (!c || !c.pacote) return;
        var id = codificar(chave);
        var d = { pacote: c.pacote, campos: c.campos || [], atualizadoEm: num(c.atualizadoEm) };
        juntar("credenciais/" + id, raiz.collection("credenciais").doc(id), d);
      });

      /* Mensagens: nascem inteiras e depois só ganham a marca de
         lida — é o que a regra do servidor permite alterar. */
      (st.mensagens || []).forEach(function (m) {
        var caminho = "mensagens/" + m.id;
        var d = payloadMensagem(m);
        if (!difere(caminho, d)) return;
        var ref = raiz.collection("mensagens").doc(m.id);
        if (retrato[caminho] === undefined) {
          escritas.push({ ref: ref, dados: d, modo: "set" });
        } else {
          escritas.push({ ref: ref, dados: { lidaEm: d.lidaEm }, modo: "merge" });
        }
        confirmar.push([caminho, d]);
      });

      /* Eventos: criados uma vez e nunca reescritos. */
      (st.eventos || []).forEach(function (ev) {
        var caminho = "eventos/" + ev.id;
        if (retrato[caminho] !== undefined) return;
        var d = {
          tipo: txt(ev.tipo, 40), chave: txt(ev.chave, 160),
          detalhe: txt(ev.detalhe, 300), ator: txt(ev.ator, 120), em: num(ev.em)
        };
        escritas.push({ ref: raiz.collection("eventos").doc(ev.id), dados: d, modo: "set" });
        confirmar.push([caminho, d]);
      });

      /* Financeiro e preferências */
      if (st.financeiro) {
        juntar("financeiro/principal", raiz.collection("financeiro").doc("principal"),
               payloadFinanceiro(st.financeiro));
      }
      juntar("financeiro/geral", raiz.collection("financeiro").doc("geral"), payloadGeral(st));

      /* Sumiram do estado.

         Sócio some de verdade — a regra permite ao dono apagar.

         Documento, NÃO: apagar documento é coisa de administrador,
         e é assim de propósito, para o histórico de conferência da
         equipe não evaporar. Então o documento removido pelo
         cliente vira um registro VAZIO, que é o mesmo que "nada
         enviado". Tentar apagar aqui derrubaria o lote inteiro por
         falta de permissão — e junto com ele iria tudo o mais que
         estivesse na mesma gravação. */
      var apagar = [];
      Object.keys(retrato).forEach(function (caminho) {
        if (caminho.indexOf("socios/") === 0 && !vistosSocios[caminho]) apagar.push(caminho);
        if (caminho.indexOf("itens/") === 0 && !vistosItens[caminho]) {
          juntar(caminho, raiz.collection("itens").doc(caminho.slice(6)), ITEM_VAZIO);
        }
      });
      apagar.forEach(function (caminho) {
        escritas.push({ ref: raiz.collection("socios").doc(caminho.slice(7)), modo: "delete" });
      });

      if (!escritas.length) return Promise.resolve(true);

      /* Um lote do Firestore aceita no máximo 500 operações. */
      var fila = Promise.resolve();
      for (var i = 0; i < escritas.length; i += 400) {
        (function (fatia) {
          fila = fila.then(function () {
            var lote = db.batch();
            fatia.forEach(function (w) {
              if (w.modo === "delete") lote.delete(w.ref);
              else if (w.modo === "set") lote.set(w.ref, w.dados);
              else lote.set(w.ref, w.dados, { merge: true });
            });
            return lote.commit();
          });
        })(escritas.slice(i, i + 400));
      }

      return fila.then(function () {
        confirmar.forEach(function (par) { fixar(par[0], par[1]); });
        apagar.forEach(function (caminho) { delete retrato[caminho]; });
        return true;
      });
    }

    /* Apagar a empresa inteira é decisão da equipe, pelo painel.
       Aqui, sair da conta só limpa a cópia deste aparelho. */
    function apagar() {
      return cacheLocal ? cacheLocal.limpar().catch(function () {}) : Promise.resolve();
    }

    /* ---------- Arquivos ---------- */
    function pasta(tipo) { return tipo === "mensagem" ? "mensagens" : "documentos"; }

    function refArquivo(id, tipo) {
      return storage.ref("empresas/" + empresaId + "/" + pasta(tipo) + "/" + id + "/arquivo");
    }

    /* `aoProgredir` recebe 0..100 durante o envio.

       O `put()` do Storage devolve uma tarefa que emite progresso —
       antes esse dado existia e era jogado fora. Num PDF de 15 MB
       em 4G ruim, a barra é a diferença entre esperar e achar que
       travou; sem ela o cliente toca de novo e manda o mesmo
       documento duas vezes. */
    function guardarArquivo(id, blob, tipo, aoProgredir) {
      if (!storage) return Promise.reject(new Error("sem-armazenamento"));
      var meta = { contentType: global.U.mimeDoArquivo(blob) };
      var tarefa = refArquivo(id, tipo).put(blob, meta);

      if (typeof aoProgredir === "function") {
        tarefa.on("state_changed", function (s) {
          if (!s.totalBytes) return;
          aoProgredir(Math.round((s.bytesTransferred / s.totalBytes) * 100));
        });
      }

      return tarefa.then(function () {
        /* Cópia local para abrir rápido e continuar funcionando
           sem sinal. Se falhar, o arquivo já está no servidor. */
        if (cacheLocal) cacheLocal.guardar(id, blob).catch(function () {});
        return true;
      });
    }

    /* Endereço direto do arquivo, com a chave de leitura embutida.
       Serve para abrir e para exibir prévia sem precisar trazer os
       bytes para dentro da página. */
    function urlArquivo(id, tipo) {
      if (!storage) return Promise.resolve("");
      return refArquivo(id, tipo).getDownloadURL().catch(function () {
        /* Anexo de mensagem e documento moram em pastas
           diferentes; se não estava numa, tenta a outra. */
        return refArquivo(id, tipo === "mensagem" ? "documento" : "mensagem")
          .getDownloadURL().catch(function () { return ""; });
      });
    }

    /* Trazer os bytes exige CORS liberado no bucket. Enquanto não
       estiver, a primeira tentativa falha e nós paramos de tentar —
       o portal segue funcionando pelo endereço direto, e o console
       não vira uma parede de erro repetido. */
    var podeBaixarBytes = true;

    function obterArquivo(id, tipo) {
      var doCache = cacheLocal ? cacheLocal.obter(id).catch(function () { return null; })
                               : Promise.resolve(null);
      return doCache.then(function (blob) {
        /* Só vale como acerto do cache o que for arquivo mesmo. */
        if (blob instanceof Blob) return blob;
        if (!storage || !podeBaixarBytes) return null;

        return urlArquivo(id, tipo).then(function (url) {
          if (!url) return null;
          return fetch(url).then(function (r) {
            if (!r.ok) throw new Error("download-falhou");
            return r.blob();
          });
        }).then(function (b) {
          if (b && cacheLocal) cacheLocal.guardar(id, b).catch(function () {});
          return b;
        }, function () {
          podeBaixarBytes = false;
          return null;
        });
      });
    }

    function removerArquivo(id, tipo) {
      if (cacheLocal) cacheLocal.remover(id).catch(function () {});
      if (!storage) return Promise.resolve();
      return refArquivo(id, tipo).delete().catch(function () { /* já pode não existir */ });
    }

    /* O envelope cifrado o cliente não consegue ler de volta, mas
       pode mandar apagar o dele. Como a leitura não traz esses
       documentos, a exclusão não sai da comparação — precisa ser
       pedida na hora. */
    /* ============================================================
       MENSAGEM VAI SOZINHA, E VAI NA HORA

       Antes ela pegava carona na gravação geral do estado: entrava
       na fila do debounce de 350ms e subia num lote junto com
       empresa, sócios, os dezessete documentos, credenciais e
       eventos — cinquenta e tantos documentos comparados antes de
       um recado de duas linhas sair do lugar.

       Dois estragos. Demora, que é o que se sente. E, pior, se
       QUALQUER outra escrita do lote fosse recusada, o lote inteiro
       caía e a mensagem ia junto, apesar de estar perfeita — o
       portal dizia "guardada" e o painel nunca recebia. Foi o que o
       Raoni descreveu em 2026-08-24.

       Um documento, uma escrita. Não passa pelo lote, não espera
       debounce, e uma falha em outra parte do estado não a
       derruba. O retrato é fixado aqui mesmo, para a gravação geral
       seguinte não reescrever o que já subiu. */
    function gravarMensagem(m) {
      if (!m || !m.id) return Promise.reject(new Error("mensagem-sem-id"));
      var caminho = "mensagens/" + m.id;
      var d = payloadMensagem(m);
      return raiz.collection("mensagens").doc(m.id).set(d).then(function () {
        fixar(caminho, d);
        return true;
      });
    }

    function removerCredencial(chave) {
      var id = codificar(chave);
      delete retrato["credenciais/" + id];
      return raiz.collection("credenciais").doc(id).delete();
    }

    /* ============================================================
       Conversa em tempo real

       Até aqui o portal só lia mensagem quando a página carregava.
       Na prática isso quer dizer que não dava para conversar: cada
       lado escrevia e o outro só via depois de atualizar — e foi
       justamente esse "atualiza para ver" que levava o cliente a
       recarregar a página o tempo todo, caindo na corrida de
       credencial e achando que tinha sido desconectado. Os dois
       problemas eram o mesmo hábito.

       Um ouvinte só, na subcoleção de mensagens. Não uso ouvinte
       em `itens` de propósito: são dezenas de documentos que mudam
       a cada digitação, e um ouvinte ali brigaria com a gravação
       por diferença que já existe. Mensagem é pequena, esparsa e
       é o único lugar onde tempo real muda a experiência.

       Devolve a função de desligar — sem isso, trocar de empresa
       deixaria o ouvinte antigo vivo, gastando leitura e
       misturando conversa de duas empresas. */
    function ouvirMensagens(aoMudar) {
      if (!raiz) return function () {};
      return raiz.collection("mensagens").onSnapshot(function (snap) {
        var lista = [];
        snap.forEach(function (d) {
          var m = d.data() || {};
          m.id = d.id;
          lista.push(m);
        });
        lista.sort(function (a, b) { return (a.em || 0) - (b.em || 0); });
        aoMudar(lista);
      }, function () { /* sem rede: segue com o que já está na tela */ });
    }

    /* Apagar e corrigir vão DIRETO ao documento, fora do lote.

       O lote só sabe escrever `lidaEm` numa mensagem que já existe
       — e é assim de propósito, porque foi o que garantiu por muito
       tempo que mensagem enviada não se reescrevia. Abrir o lote
       para estes dois campos faria toda gravação do portal carregar
       o poder de mexer no texto de qualquer mensagem. Aqui o
       alcance é uma mensagem, uma vez, quando alguém pede. */
    function mexerNaMensagem(id, campos) {
      return db.collection("empresas").doc(empresaId)
               .collection("mensagens").doc(String(id))
               .set(campos, { merge: true });
    }

    return {
      nome: "nuvem",
      empresaId: empresaId,
      carregar: carregar,
      ouvirMensagens: ouvirMensagens,
      removerCredencial: removerCredencial,
      gravarMensagem: gravarMensagem,
      mexerNaMensagem: mexerNaMensagem,
      salvar: salvar,
      apagar: apagar,
      guardarArquivo: guardarArquivo,
      obterArquivo: obterArquivo,
      urlArquivo: urlArquivo,
      removerArquivo: removerArquivo
    };
  }

  global.Nuvem = { criar: criar, codificar: codificar, decodificar: decodificar };
})(window);
