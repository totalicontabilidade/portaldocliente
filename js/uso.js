/* ============================================================
   Totali · Portal do Cliente
   uso.js — auditoria de uso: quem usa o quê, quando, por quanto tempo

   PARA QUE SERVE
   --------------
   A equipe precisa saber quais clientes estão usando quais
   ferramentas, para informar e COBRAR o uso. Cada abertura de
   sistema, cada tela relevante e o tempo de sessão viram um
   registro em `uso/`. O painel agrega por empresa × sistema ×
   período e exporta CSV (tela "Uso e cobrança").

   O QUE REGISTRA (tipo)
     abrir      o cliente abriu um sistema (sistemaId), com dispositivo
     tela       o cliente visitou uma tela do portal (tela)
     sessao     batimento de tempo: a cada 60 s com a aba visível,
                soma segundos ao sistema/tela em uso (duracaoS)
     vitrine    impressão, clique ou dispensa de campanha (campanhaId, acao)

   O QUE NÃO REGISTRA, DE PROPÓSITO
     Conteúdo. Nunca o texto de uma mensagem, nunca o nome de um
     arquivo, nunca uma senha. Só o fato e a hora.

   Quem escreve é o navegador do cliente; a regra do Firestore
   permite `create` e nada mais. A trilha probatória (aprovações,
   senhas abertas) é outra: /auditoria, escrita pela Cloud Function.
   ============================================================ */
(function (global) {
  "use strict";
  var U = global.U;

  var contexto = { sessao: null, empresaId: "", sistemaId: "", tela: "", inicio: 0 };
  var tick = null, acumulado = 0;

  function dispositivo() {
    var ua = navigator.userAgent || "";
    if (/iPhone|Android.*Mobile|Windows Phone/i.test(ua)) return "celular";
    if (/iPad|Android(?!.*Mobile)|Tablet/i.test(ua)) return "tablet";
    return "computador";
  }
  function base(extra) {
    var s = contexto.sessao || {};
    return Object.assign({ empresaId: contexto.empresaId || s.empresaId || "", uid: s.uid || "", nome: s.nome || "", papel: s.papel || "", dispositivo: dispositivo() }, extra);
  }
  function enviar(ev) { if (!contexto.sessao || contexto.sessao.papel !== "cliente") return; global.Dados.registrarUso(base(ev)); }

  function bater() {
    if (document.hidden || !contexto.sessao) return;
    acumulado += 60;
    enviar({ tipo: "sessao", sistemaId: contexto.sistemaId || "portal", tela: contexto.tela, duracaoS: 60 });
  }

  var Uso = {
    iniciar: function (sessao, empresaId) {
      contexto.sessao = sessao; contexto.empresaId = empresaId || (sessao && sessao.empresaId) || "";
      if (tick) clearInterval(tick);
      if (sessao && sessao.papel === "cliente") tick = setInterval(bater, 60000);
    },
    parar: function () { if (tick) clearInterval(tick); tick = null; contexto.sessao = null; },
    tela: function (nome) {
      if (nome === contexto.tela) return;
      contexto.tela = nome; contexto.sistemaId = "";
      enviar({ tipo: "tela", tela: nome });
    },
    abrir: function (sistemaId, modo) {
      contexto.sistemaId = sistemaId; contexto.inicio = Date.now();
      enviar({ tipo: "abrir", sistemaId: sistemaId, modo: modo || "", tela: "sistema" });
    },
    fechar: function () {
      if (contexto.sistemaId && contexto.inicio) {
        var s = Math.round((Date.now() - contexto.inicio) / 1000);
        if (s >= 5) enviar({ tipo: "sessao", sistemaId: contexto.sistemaId, tela: "sistema", duracaoS: Math.min(s, 3600) });
      }
      contexto.sistemaId = ""; contexto.inicio = 0;
    },
    vitrine: function (campanhaId, sistemaId, acao) { enviar({ tipo: "vitrine", campanhaId: campanhaId, sistemaId: sistemaId, acao: acao }); },

    /* ---------- Agregação para o painel ---------- */
    agregar: function (usos, empresas) {
      var porEmp = U.porChave(empresas || [], "id");
      var mapa = {};
      usos.forEach(function (u) {
        if (u.tipo === "vitrine") return;
        var sis = u.sistemaId || (u.tipo === "tela" ? "portal" : "");
        if (!sis) return;
        var k = u.empresaId + "|" + sis;
        var r = mapa[k] || (mapa[k] = { empresaId: u.empresaId, empresa: (porEmp[u.empresaId] || {}).fantasia || u.empresaId, sistemaId: sis, aberturas: 0, segundos: 0, ultimo: 0, pessoas: {}, dias: {}, celular: 0, computador: 0 });
        if (u.tipo === "abrir") r.aberturas++;
        if (u.tipo === "tela" && sis === "portal") r.aberturas++;
        if (u.duracaoS) r.segundos += Number(u.duracaoS) || 0;
        if (u.em > r.ultimo) r.ultimo = u.em;
        if (u.uid) r.pessoas[u.uid] = u.nome || u.uid;
        r.dias[U.data(u.em)] = 1;
        if (u.dispositivo === "computador") r.computador++; else r.celular++;
      });
      return Object.keys(mapa).map(function (k) { var r = mapa[k]; r.diasAtivos = Object.keys(r.dias).length; r.qtdPessoas = Object.keys(r.pessoas).length; return r; })
        .sort(function (a, b) { return b.aberturas - a.aberturas; });
    },
    porDia: function (usos, dias) {
      var out = {}, hoje = U.hoje0();
      for (var i = dias - 1; i >= 0; i--) out[U.data(hoje - i * U.DIA_MS)] = 0;
      usos.forEach(function (u) { if (u.tipo === "abrir" || u.tipo === "tela") { var k = U.data(u.em); if (k in out) out[k]++; } });
      return out;
    },
    csv: function (linhas) {
      var C = global.CATALOGO;
      return U.csv(linhas.map(function (r) {
        var s = C.por(r.sistemaId);
        return [r.empresa, r.empresaId, global.CATALOGO ? global.CATALOGO.nomeDe(r.sistemaId) : r.sistemaId, r.aberturas, Math.round(r.segundos / 60), r.diasAtivos, r.qtdPessoas, Object.keys(r.pessoas).map(function (k) { return r.pessoas[k]; }).join(", "), r.ultimo ? U.dataHora(r.ultimo) : "", r.celular, r.computador];
      }), ["Empresa", "Id", "Sistema", "Aberturas", "Minutos", "Dias ativos", "Pessoas", "Quem", "Último uso", "No celular", "No computador"]);
    }
  };

  document.addEventListener("visibilitychange", function () { if (document.hidden) Uso.fechar(); });
  global.addEventListener("pagehide", function () { Uso.fechar(); });

  global.Uso = Uso;
})(window);
