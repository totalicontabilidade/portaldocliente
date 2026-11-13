/* ============================================================
   Totali · Portal do Cliente
   central.js — central de notificações do cliente (o sino do cabeçalho)

   Antes o sino só levava ao chat (pedido do Raoni, 13/11/2026: "quero
   que realmente sejam notificações"). Agora ele abre uma lista do que
   pede atenção, em dois blocos:
     • Pedem sua atenção: documento para corrigir, item da Lista de
       documentos para corrigir, mensagem da Totali sem leitura há mais
       de 2 h ou pergunta da Totali sem resposta há mais de 1 dia, Envio
       do mês atrasado ou perto do prazo, vencimento em até 3 dias,
       obrigatórios da entrada, Bancos e maquininhas;
     • Novidades (últimos 14 dias): documento aprovado, item aceito no
       Envio do mês, arquivo novo enviado pela Totali.
   O chat em si continua com o próprio contador no menu e na barra.

   Tudo é calculado do que o portal já tem, sem servidor: a notificação
   de pendência some sozinha quando a pendência acaba. "Vista" fica
   lembrada no aparelho (localStorage), por pessoa e por empresa; o
   número no sino conta só as que a pessoa ainda não viu.
   ============================================================ */
(function (global) {
  "use strict";
  var U = global.U, UI = global.UI, ic = global.ic, Dados = global.Dados;
  var HORA = 3600000, RECENTE = 14 * U.DIA_MS;
  var CORES = { erro: ["danger", "danger-soft", "danger"], gold: ["gold", "gold-soft", "gold-text"], info: ["info", "info-soft", "info"], ok: ["success", "success-soft", "success"], aviso: ["warning", "warning-soft", "warning"] };
  var atual = [], caixa = null, espera = 0, intervalo = 0, ligada = false;

  function P() { return global.Portal; }
  function chave() { var p = P(); return "totali-notif-" + (p.sessao && p.sessao.uid) + "-" + (p.empresa && p.empresa.id); }
  function vistas() { try { return JSON.parse(localStorage.getItem(chave()) || "{}"); } catch (e) { return {}; } }
  function marcarVistas(ids) {
    var v = vistas(), agora = Date.now();
    ids.forEach(function (id) { if (!v[id]) v[id] = agora; });
    Object.keys(v).forEach(function (k) { if (agora - v[k] > 60 * U.DIA_MS) delete v[k]; });
    try { localStorage.setItem(chave(), JSON.stringify(v)); } catch (e) {}
  }
  function prazoTexto(d) { return d <= 0 ? "vence hoje" : d === 1 ? "vence amanhã" : "vence em " + d + " dias"; }

  /* ---------- o que vira notificação ---------- */
  function calcular() {
    var p = P(), e = p.empresa, s = p.sessao;
    if (!e || !s) return Promise.resolve([]);
    var am = U.anoMes(Date.now()), agora = Date.now();
    return Promise.all([Dados.documentos(e.id), global.Envio ? Dados.checklist(e.id, am) : Promise.resolve(null), Dados.mensagens(e.id)]).then(function (r) {
      var out = [];
      var docs = (r[0] || []).filter(function (d) { return d.situacao !== "bloqueado"; });
      var msgs = r[2] || [];

      /* documentos */
      docs.forEach(function (d) {
        var rev = d.revisao || {}, emRev = U.ms(rev.em);
        if (d.situacao === "pendencia") out.push({ ordem: 10, acao: true, id: "doc-pend-" + d.id + "-" + emRev, tom: "erro", icone: "alert", titulo: "Documento para corrigir: " + d.nome, texto: (rev.motivo || "Veja o motivo e envie de novo.") + (rev.por ? " (" + rev.por + ")" : ""), href: "#/documentos", em: emRev || U.ms(d.em) });
        else if (d.situacao === "aprovado" && d.origem === "cliente" && emRev && agora - emRev < RECENTE) out.push({ id: "doc-ok-" + d.id, tom: "ok", icone: "check-circle", titulo: "Documento aprovado: " + d.nome, texto: rev.por ? "Conferido por " + rev.por + "." : "Conferido pela equipe.", href: "#/documentos", em: emRev });
        if (d.origem === "equipe" && agora - U.ms(d.em) < RECENTE) out.push({ id: "doc-totali-" + d.id, tom: "gold", icone: "folder", titulo: "A Totali enviou um arquivo", texto: d.nome, href: "#/documentos", em: U.ms(d.em) });
      });

      /* Lista de documentos: item que a equipe pediu para corrigir (sem repetir o que já saiu como documento) */
      var O = global.Onboarding;
      if (O && !e.migracaoConcluidaEm) {
        var en = O.estado(e), comDocPendente = {};
        docs.forEach(function (d) { if (d.situacao === "pendencia" && d.item) comDocPendente[d.item] = true; });
        O.GRUPOS.forEach(function (g) {
          (g.escopo === "socio" ? en.socios : [null]).forEach(function (soc) {
            g.itens.forEach(function (it) {
              var sid = soc ? soc.id : null, k = O.chave(g, it, sid);
              if (O.situacao(en, g, it, sid) !== "pendencia" || comDocPendente[k]) return;
              var rev = (en.itens[k] || {}).revisao || {};
              out.push({ ordem: 11, acao: true, id: "entrada-pend-" + k + "-" + U.ms(rev.em), tom: "erro", icone: "clipboard", titulo: "Corrigir na Lista de documentos: " + it.nome + (soc ? " (" + soc.nome + ")" : ""), texto: rev.motivo || "Veja o que a equipe pediu.", href: "#/entrada?g=" + (sid || g.id), em: U.ms(rev.em) });
            });
          });
        });
        var prog = O.progresso(e);
        if (!prog.completo && prog.obrigFaltam.length) out.push({ ordem: 60, acao: true, id: "entrada-faltam-" + prog.obrigFaltam.length, tom: "gold", icone: "clipboard", titulo: U.plural(prog.obrigFaltam.length, "Falta 1 documento obrigatório da entrada", "Faltam " + prog.obrigFaltam.length + " documentos obrigatórios da entrada"), texto: "Próximo: " + prog.obrigFaltam[0].it.nome + ".", href: "#/entrada", em: 0 });
      }

      /* mensagens: não é o chat, é a demora. Mensagem da Totali sem ler há mais de 2 h, ou pergunta sem resposta há mais de 1 dia */
      var semLer = msgs.filter(function (m) { return m.autor.lado === "equipe" && !(m.lidaPor || {})[s.uid] && agora - U.ms(m.em) > 2 * HORA; });
      if (semLer.length) {
        var m = semLer[semLer.length - 1];
        out.push({ ordem: 20, acao: true, id: "msg-semler-" + m.id, tom: "gold", icone: "chat", titulo: U.plural(semLer.length, m.autor.nome + " escreveu e a mensagem ainda não foi lida", semLer.length + " mensagens da Totali ainda não foram lidas"), texto: U.previaMsg(m), href: "#/chat", em: U.ms(m.em) });
      } else {
        var ult = msgs[msgs.length - 1];
        if (ult && ult.autor.lado === "equipe" && !ult.autor.sistema && /\?/.test(ult.texto || "") && agora - U.ms(ult.em) > 24 * HORA && agora - U.ms(ult.em) < 7 * U.DIA_MS)
          out.push({ ordem: 21, acao: true, id: "msg-resposta-" + ult.id, tom: "gold", icone: "chat", titulo: ult.autor.nome + " está esperando sua resposta", texto: U.previaMsg(ult), href: "#/chat", em: U.ms(ult.em) });
      }

      /* Envio do mês */
      if (global.Envio && r[1] !== undefined) {
        var c = global.Envio.mes(e, r[1], am), res = global.Envio.resumo(c);
        if (res.atrasados.length) out.push({ ordem: 30, acao: true, id: "envio-atraso-" + am + "-" + res.atrasados.map(function (i) { return i.id; }).join("."), tom: "erro", icone: "list-check", titulo: "Envio do mês: " + U.plural(res.atrasados.length, "1 item passou do prazo", res.atrasados.length + " itens passaram do prazo"), texto: res.atrasados.slice(0, 2).map(function (i) { return i.texto; }).join(" · ") + (res.atrasados.length > 2 ? " e mais " + (res.atrasados.length - 2) : ""), href: "#/checklist", em: 0 });
        else if (res.proximos.length) { var it0 = res.proximos[0], d0 = global.Envio.diasParaPrazo(it0, am); out.push({ ordem: 40, acao: true, id: "envio-prazo-" + am + "-" + it0.id + "-" + d0, tom: "info", icone: "list-check", titulo: "Envio do mês: " + it0.texto + " " + prazoTexto(d0), texto: "Anexe pelo portal e o item fica marcado sozinho.", href: "#/checklist", em: 0 }); }
        c.itens.forEach(function (it) { var emA = it.aceite ? U.ms(it.aceite.em) : 0; if (emA && agora - emA < RECENTE) out.push({ id: "envio-ok-" + am + "-" + it.id, tom: "ok", icone: "check", titulo: "Aceito no Envio do mês: " + it.texto, texto: it.aceite.por ? "Conferido por " + it.aceite.por + "." : "Conferido pela equipe.", href: "#/checklist", em: emA }); });
      }

      /* vencimentos em até 3 dias */
      if (global.Agenda) global.Agenda.proximas(e, 3).forEach(function (x) {
        if (x.em < 0) return;
        out.push({ ordem: 50, acao: true, id: "agenda-" + x.o.id + "-" + x.vence + "-" + x.em, tom: "aviso", icone: "calendar", titulo: x.o.nome + " " + prazoTexto(x.em), texto: x.o.desc, href: "#/agenda", em: 0 });
      });

      /* Bancos e maquininhas (cadastro da entrada) */
      if (global.Financeiro && !global.Financeiro.estado(e).status) out.push({ ordem: 70, acao: true, id: "financeiro-cadastro", tom: "gold", icone: "credit-card", titulo: "Responda Bancos e maquininhas", texto: "Em quais bancos a empresa tem conta e se usa maquininha. Leva uns 3 minutos.", href: "#/financeiro", em: 0 });

      return out.sort(function (a, b) { return (a.acao === b.acao) ? (a.acao ? a.ordem - b.ordem : b.em - a.em) : (a.acao ? -1 : 1); });
    });
  }

  /* ---------- número no sino ---------- */
  function contar() { var v = vistas(); return atual.filter(function (n) { return !v[n.id]; }).length; }
  function atualizar() {
    return calcular().then(function (l) { atual = l; global.Shell.badge("sino", contar()); return l; }).catch(function (e) { console.warn("notificações:", e); return atual; });
  }
  function atualizarDepois() { clearTimeout(espera); espera = setTimeout(atualizar, 800); }

  /* ---------- a caixa ---------- */
  function itemHtml(n, antes) {
    var c = CORES[n.tom] || CORES.info, nova = !antes[n.id];
    return '<a class="notif__item' + (nova ? " notif__item--nova" : "") + '" href="' + n.href + '">' +
      '<span class="notif__icone" style="background:var(--' + c[1] + ');color:var(--' + c[2] + ')">' + ic(n.icone, "ic--sm") + "</span>" +
      '<span class="notif__texto"><b>' + U.esc(n.titulo) + "</b><span>" + U.esc(n.texto) + "</span>" + (n.em ? "<small>" + U.esc(U.relativo(n.em)) + "</small>" : "") + "</span>" +
      (nova ? '<i class="notif__ponto" title="Nova"></i>' : "") + "</a>";
  }
  function corpoHtml(l, antes) {
    var acoes = l.filter(function (n) { return n.acao; }), novidades = l.filter(function (n) { return !n.acao; });
    if (!l.length) return '<div class="notif__vazio">' + ic("check-circle") + "<b>Nada pendente</b><span>Quando houver documento para corrigir, prazo perto ou a Totali esperando sua resposta, aparece aqui.</span></div>";
    return (acoes.length ? '<div class="notif__grupo">Pedem sua atenção</div>' + acoes.map(function (n) { return itemHtml(n, antes); }).join("") : "") +
      (novidades.length ? '<div class="notif__grupo">Novidades</div>' + novidades.map(function (n) { return itemHtml(n, antes); }).join("") : "");
  }
  function fechar() {
    if (!caixa) return;
    caixa.remove(); caixa = null;
    document.removeEventListener("keydown", teclar, true);
    var b = document.querySelector('.topbar [data-acao="sino"]'); if (b) { b.setAttribute("aria-expanded", "false"); b.focus(); }
  }
  function teclar(ev) { if (ev.key === "Escape") { ev.preventDefault(); fechar(); } }
  function abrir() {
    if (caixa) return fechar();
    caixa = document.createElement("div");
    caixa.className = "notif";
    caixa.innerHTML = '<div class="notif__fundo" data-notif="fechar"></div><div class="notif__caixa" role="dialog" aria-label="Notificações"><div class="notif__cab"><b>Notificações</b><button type="button" class="btn btn--xs btn--fantasma" data-notif="fechar" aria-label="Fechar">' + ic("x", "ic--sm") + '</button></div><div class="notif__corpo">' + UI.esqueleto(3) + "</div></div>";
    document.body.appendChild(caixa);
    document.addEventListener("keydown", teclar, true);
    var b = document.querySelector('.topbar [data-acao="sino"]'); if (b) b.setAttribute("aria-expanded", "true");
    caixa.addEventListener("click", function (ev) {
      if (ev.target.closest('[data-notif="fechar"]')) { ev.preventDefault(); fechar(); return; }
      if (ev.target.closest(".notif__item")) setTimeout(fechar, 0);
    });
    atualizar().then(function (l) {
      if (!caixa) return;
      var antes = vistas();
      caixa.querySelector(".notif__corpo").innerHTML = corpoHtml(l, antes);
      /* abriu = viu: o número do sino zera; o ponto de "nova" continua nesta abertura */
      marcarVistas(l.map(function (n) { return n.id; }));
      global.Shell.badge("sino", 0);
      var primeiro = caixa.querySelector(".notif__item, [data-notif='fechar']"); if (primeiro) primeiro.focus();
    });
  }

  global.Central = {
    iniciar: function () {
      atual = []; atualizar();
      clearInterval(intervalo); intervalo = setInterval(function () { if (!document.hidden) atualizar(); }, 5 * 60000);
      if (!ligada) {
        ligada = true;
        document.addEventListener("dados:mudou", function (ev) { var t = ev.detail && ev.detail.tipo; if (t && t !== "sessao" && global.Portal && global.Portal.empresa) atualizarDepois(); });
        global.addEventListener("hashchange", fechar);
      }
    },
    parar: function () { clearInterval(intervalo); clearTimeout(espera); fechar(); atual = []; },
    abrir: abrir, atualizar: atualizar, calcular: calcular
  };
})(window);
