/* ============================================================
   Totali · Portal do Cliente
   conteudo-extra.js — abas extras de "Conteúdo do portal" (painel)

   Agenda de obrigações, aviso automático (cobrança semanal que
   segue a jornada) e Ajuda (contatos, horário e FAQ). Tudo editável
   sem código; o que é salvo em conteudo/{agenda|lembretes|ajuda}
   vale na hora no portal.
   ============================================================ */
(function (global) {
  "use strict";
  var U = global.U, UI = global.UI, ic = global.ic, Dados = global.Dados;
  var REGIMES = ["MEI", "Simples Nacional", "Lucro Presumido", "Lucro Real"];

  function agenda(v, sessao) {
    Dados.conteudo("agenda").then(function (c) {
      var itens = (c && c.itens && c.itens.length) ? c.itens : global.Agenda.PADRAO;
      v.innerHTML = '<div class="aviso aviso--info">' + ic("info") + '<div><b>Vencimentos por regime.</b>O portal mostra ao cliente só o que vale para o regime e o perfil dele. Fim de semana: por padrão posterga para o dia útil seguinte; marque "antecipa" para salários e prazos internos.</div></div><div class="pilha" id="edAgenda" style="gap:6px">' + itens.map(function (i, k) { return linhaAgenda(i, k); }).join("") + '</div><div class="modal__acoes"><button type="button" class="btn btn--contorno" data-acao="add">' + ic("plus") + 'Obrigação</button><button type="button" class="btn btn--primario" data-acao="salvar">' + ic("check") + "Publicar agenda</button></div>";
      function linhaAgenda(i, k) { return '<div class="card" data-k="' + k + '"><div class="card__corpo grade grade--4" style="gap:8px"><div class="campo" style="grid-column:span 2"><label class="campo__rotulo">Nome</label><input class="input" data-c="nome" value="' + U.esc(i.nome) + '"></div><div class="campo"><label class="campo__rotulo">Dia</label><input class="input num" type="number" min="1" max="31" data-c="dia" value="' + i.dia + '"></div><div class="campo"><label class="campo__rotulo">Meses (vazio = todos)</label><input class="input" data-c="meses" placeholder="1,4,7,10" value="' + U.esc((i.meses || []).join(",")) + '"></div><div class="campo" style="grid-column:span 2"><label class="campo__rotulo">Descrição</label><input class="input" data-c="desc" value="' + U.esc(i.desc || "") + '"></div><div class="campo"><span class="campo__rotulo">Regimes</span><div class="linha" style="gap:4px">' + REGIMES.map(function (r) { return '<label class="checar f-12"><input type="checkbox" data-c="regime" value="' + r + '"' + ((i.regimes || []).indexOf(r) > -1 || (i.regimes || []).indexOf("*") > -1 ? " checked" : "") + "> " + r + "</label>"; }).join("") + '</div></div><div class="campo"><label class="checar" style="margin-top:22px"><input type="checkbox" data-c="func"' + (i.soComFuncionarios ? " checked" : "") + '> Só com funcionários</label><label class="checar"><input type="checkbox" data-c="antecipa"' + (i.regra === "antecipa" ? " checked" : "") + '> Fim de semana: antecipa (senão posterga)</label><button type="button" class="btn btn--xs btn--fantasma" data-acao="rm">' + ic("trash", "ic--sm") + "Remover</button></div></div></div>"; }
      function ler() { return UI.$$("#edAgenda .card", v).map(function (c) { var g = function (n) { return c.querySelector('[data-c="' + n + '"]'); }; var regs = UI.$$('[data-c="regime"]:checked', c).map(function (x) { return x.value; }); return { id: U.slug(g("nome").value) || "o" + U.id().slice(-4), nome: g("nome").value.trim(), dia: Number(g("dia").value) || 1, regimes: regs.length === REGIMES.length || !regs.length ? ["*"] : regs, soComFuncionarios: g("func").checked, regra: g("antecipa").checked ? "antecipa" : "posterga", meses: g("meses").value.trim() ? g("meses").value.split(",").map(function (x) { return Number(x.trim()); }).filter(function (x) { return x >= 1 && x <= 12; }) : null, desc: g("desc").value.trim() }; }).filter(function (i) { return i.nome; }); }
      UI.delegar(v, {
        add: function () { UI.$("#edAgenda", v).insertAdjacentHTML("beforeend", linhaAgenda({ nome: "", dia: 20, regimes: ["*"], desc: "" }, Date.now())); },
        rm: function (b) { b.closest(".card").remove(); },
        salvar: function () { var itens = ler(); Dados.salvarConteudo("agenda", { itens: itens }, sessao).then(function () { global.Agenda.aplicar({ itens: itens }); UI.toast("Agenda publicada.", "ok"); }); }
      });
    });
  }

  function avisos(v, sessao) {
    Dados.conteudo("lembretes").then(function (c) {
      c = c || {};
      v.innerHTML = '<div class="aviso aviso--info">' + ic("info") + '<div><b>Cobrança automática da entrada.</b>Segue a jornada de 30 dias: começa no D5 com 48 h de tolerância (D7), uma vez por semana, só itens obrigatórios, só para quem já entrou no portal. A mensagem entra no chat como qualquer outra da Totali.</div></div>' +
        '<div class="card"><div class="card__corpo pilha"><label class="interruptor"><input type="checkbox" id="lg"' + (c.ligado !== false ? " checked" : "") + '><span class="interruptor__pista"></span>Aviso automático ligado</label><div class="grade grade--2"><div class="campo"><label class="campo__rotulo">Hora (Maceió)</label><input class="input num" type="number" min="0" max="23" id="lh" value="' + (Number.isInteger(c.hora) ? c.hora : 10) + '"></div><div class="campo"><label class="checar" style="margin-top:22px"><input type="checkbox" id="ld"' + (c.diasUteis !== false ? " checked" : "") + "> Só em dias úteis</label></div></div>" +
        '<div class="grade grade--2"><div class="campo"><label class="campo__rotulo">Saudação com nome</label><input class="input" id="lsc" value="' + U.esc(c.saudacaoCom || "Olá, {nome}!") + '"></div><div class="campo"><label class="campo__rotulo">Saudação sem nome</label><input class="input" id="lss" value="' + U.esc(c.saudacaoSem || "Olá!") + '"></div></div>' +
        '<div class="campo"><label class="campo__rotulo">Texto ({faltam} vira "faltam N itens obrigatórios (…)")</label><textarea class="textarea" id="lc" style="min-height:120px">' + U.esc(c.corpo || "Passando para lembrar que ainda {faltam} para concluirmos a entrada da sua empresa aqui na Totali.\n\nÉ só abrir o portal, em Entrada na Totali, e enviar: dá para tirar foto pelo celular. Se algum item não se aplica à sua empresa, marque \"não se aplica\". Qualquer dúvida, responda por aqui mesmo que a gente resolve.") + '</textarea></div><div class="modal__acoes"><button type="button" class="btn btn--primario" data-acao="salvar">' + ic("check") + "Salvar</button></div></div></div>";
      UI.delegar(v, { salvar: function () { Dados.salvarConteudo("lembretes", { ligado: UI.$("#lg", v).checked, hora: Number(UI.$("#lh", v).value), diasUteis: UI.$("#ld", v).checked, saudacaoCom: UI.$("#lsc", v).value.trim(), saudacaoSem: UI.$("#lss", v).value.trim(), corpo: UI.$("#lc", v).value.trim() }, sessao).then(function () { UI.toast("Aviso automático salvo.", "ok"); }); } });
    });
  }

  function ajuda(v, sessao) {
    Dados.conteudo("ajuda").then(function (c) {
      var R = global.Relacionamento, org = Object.assign({}, R.ORG, (c && c.org) || {}), faq = (c && c.faq && c.faq.length) ? c.faq : R.FAQ;
      var campos = [["nome", "Nome"], ["email", "E-mail"], ["telefoneExibicao", "Telefone (exibição)"], ["whatsapp", "WhatsApp (só números, com 55)"], ["site", "Site"], ["instagram", "Instagram (sem @)"], ["horario", "Horário"], ["endereco", "Endereço"], ["cidade", "Cidade"], ["cep", "CEP"], ["mapa", "Link do mapa"]];
      v.innerHTML = '<div class="card"><div class="card__cab"><h3>Contatos e horário</h3></div><div class="card__corpo grade grade--2" style="gap:8px;padding-top:8px">' + campos.map(function (f) { return '<div class="campo"><label class="campo__rotulo">' + f[1] + '</label><input class="input" data-org="' + f[0] + '" value="' + U.esc(org[f[0]] || "") + '"></div>'; }).join("") + "</div></div>" +
        '<div class="card mt-12"><div class="card__cab"><h3>Perguntas frequentes</h3></div><div class="card__corpo pilha" style="gap:6px;padding-top:8px" id="edFaq">' + faq.map(function (f) { return linhaFaq(f); }).join("") + '</div></div><div class="modal__acoes"><button type="button" class="btn btn--contorno" data-acao="add">' + ic("plus") + 'Pergunta</button><button type="button" class="btn btn--primario" data-acao="salvar">' + ic("check") + "Publicar ajuda</button></div>";
      function linhaFaq(f) { return '<div class="card"><div class="card__corpo pilha" style="gap:6px"><input class="input" data-q placeholder="Pergunta" value="' + U.esc(f.q) + '"><textarea class="textarea" data-a style="min-height:60px" placeholder="Resposta">' + U.esc(f.a) + '</textarea><button type="button" class="btn btn--xs btn--fantasma" data-acao="rm" style="align-self:flex-start">' + ic("trash", "ic--sm") + "Remover</button></div></div>"; }
      UI.delegar(v, {
        add: function () { UI.$("#edFaq", v).insertAdjacentHTML("beforeend", linhaFaq({ q: "", a: "" })); },
        rm: function (b) { b.closest(".card").remove(); },
        salvar: function () { var o = {}; UI.$$("[data-org]", v).forEach(function (i) { o[i.dataset.org] = i.value.trim(); }); var lista = UI.$$("#edFaq .card", v).map(function (c) { return { q: c.querySelector("[data-q]").value.trim(), a: c.querySelector("[data-a]").value.trim() }; }).filter(function (f) { return f.q && f.a; }); Dados.salvarConteudo("ajuda", { org: o, faq: lista }, sessao).then(function () { R.aplicarConteudo({ org: o, faq: lista }); UI.toast("Ajuda publicada.", "ok"); }); }
      });
    });
  }

  global.ConteudoExtra = { agenda: agenda, avisos: avisos, ajuda: ajuda, ABAS: [["agenda", "Agenda de obrigações"], ["avisos", "Aviso automático"], ["ajuda", "Ajuda e contatos"]] };
})(window);
