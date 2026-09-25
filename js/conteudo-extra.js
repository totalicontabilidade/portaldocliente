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
  var ENVIO_CORPO = "Passando para lembrar que ainda {faltam}. É só abrir o portal, em Envio do mês, e anexar: dá para tirar foto pelo celular, e o item fecha sozinho. Qualquer dúvida, responda por aqui.";

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
        '<div class="card"><div class="card__corpo pilha"><label class="interruptor"><input type="checkbox" id="lg"' + (c.ligado !== false ? " checked" : "") + '><span class="interruptor__pista"></span>Aviso automático ligado</label><div class="grade grade--2"><div class="campo"><label class="campo__rotulo">Hora (horário de Brasília)</label><input class="input num" type="number" min="0" max="23" id="lh" value="' + (Number.isInteger(c.hora) ? c.hora : 10) + '"></div><div class="campo"><label class="checar" style="margin-top:22px"><input type="checkbox" id="ld"' + (c.diasUteis !== false ? " checked" : "") + "> Só em dias úteis</label></div></div>" +
        '<div class="grade grade--2"><div class="campo"><label class="campo__rotulo">Saudação com nome</label><input class="input" id="lsc" value="' + U.esc(c.saudacaoCom || "Olá, {nome}!") + '"></div><div class="campo"><label class="campo__rotulo">Saudação sem nome</label><input class="input" id="lss" value="' + U.esc(c.saudacaoSem || "Olá!") + '"></div></div>' +
        '<div class="campo"><label class="campo__rotulo">Texto ({faltam} vira "faltam N itens obrigatórios (…)")</label><textarea class="textarea" id="lc" style="min-height:120px">' + U.esc(c.corpo || "Passando para lembrar que ainda {faltam} para concluirmos a entrada da sua empresa aqui na Totali.\n\nÉ só abrir o portal, em Lista de documentos, e enviar: dá para tirar foto pelo celular. Se algum item não se aplica à sua empresa, marque \"não se aplica\". Qualquer dúvida, responda por aqui mesmo que a gente resolve.") + '</textarea></div>' +
        '<h3 class="mt-12">Cobrança do envio do mês</h3><p class="f-13 txt-2">Item que passou do prazo há mais de 2 dias, uma vez por semana, na mesma hora e nos mesmos dias. Vale para todo cliente que já entrou no portal; prazo que venceu antes de a empresa entrar não é cobrado.</p><label class="interruptor"><input type="checkbox" id="leg"' + (c.envioLigado !== false ? " checked" : "") + '><span class="interruptor__pista"></span>Cobrança do envio ligada</label><div class="campo"><label class="campo__rotulo">Texto ({faltam} vira "faltam N itens de {mês} (…)")</label><textarea class="textarea" id="lec" style="min-height:100px">' + U.esc(c.envioCorpo || ENVIO_CORPO) + '</textarea></div>' +
        '<div class="modal__acoes"><button type="button" class="btn btn--primario" data-acao="salvar">' + ic("check") + "Salvar</button></div></div></div>";
      UI.delegar(v, { salvar: function () { Dados.salvarConteudo("lembretes", { ligado: UI.$("#lg", v).checked, hora: Number(UI.$("#lh", v).value), diasUteis: UI.$("#ld", v).checked, saudacaoCom: UI.$("#lsc", v).value.trim(), saudacaoSem: UI.$("#lss", v).value.trim(), corpo: UI.$("#lc", v).value.trim(), envioLigado: UI.$("#leg", v).checked, envioCorpo: UI.$("#lec", v).value.trim() }, sessao).then(function () { UI.toast("Aviso automático salvo.", "ok"); }); } });
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

  function financeiro(v, sessao) {
    Dados.conteudo("financeiro").then(function (c) {
      var F = global.Financeiro, bancos = (c && c.bancos && c.bancos.length) ? c.bancos.map(function (b) { return typeof b === "string" ? { nome: b } : b; }) : F.BANCOS.map(function (b) { return { nome: b }; }), maq = (c && c.maquinetas && c.maquinetas.length) ? c.maquinetas : F.MAQUINETAS;
      var linha = function (i, comCred) { return '<div class="card"><div class="card__corpo grade grade--2" style="gap:8px"><div class="campo"><label class="campo__rotulo">Nome</label><input class="input" data-nome value="' + U.esc(i.nome) + '"></div>' + (comCred ? '<div class="campo"><label class="checar" style="margin-top:22px"><input type="checkbox" data-semcred' + (i.semCredencial ? " checked" : "") + '> Libera o contador pelo app (sem senha)</label></div><div class="campo" style="grid-column:span 2"><label class="campo__rotulo">Orientação ao cliente (opcional)</label><input class="input" data-orient value="' + U.esc(i.orientacao || "") + '"></div>' : "") + '<div><button type="button" class="btn btn--xs btn--fantasma" data-acao="rm">' + ic("trash", "ic--sm") + "Remover</button></div></div></div>"; };
      v.innerHTML = '<div class="aviso aviso--info">' + ic("info") + "<div><b>Catálogo do Checklist Financeiro.</b>As listas que o cliente marca. Igual ao painel do sistema oficial: nome, e para maquininha, se libera o contador pelo próprio app (aí não pede senha) e uma orientação.</div></div>" +
        '<h3 class="mt-12">Bancos</h3><div class="pilha" id="edBancos" style="gap:6px">' + bancos.map(function (b) { return linha(b, false); }).join("") + '</div><button type="button" class="btn btn--xs btn--contorno mt-8" data-acao="add-b">' + ic("plus", "ic--sm") + 'Banco</button>' +
        '<h3 class="mt-12">Maquininhas</h3><div class="pilha" id="edMaq" style="gap:6px">' + maq.map(function (m) { return linha(m, true); }).join("") + '</div><button type="button" class="btn btn--xs btn--contorno mt-8" data-acao="add-m">' + ic("plus", "ic--sm") + 'Maquininha</button>' +
        '<div class="modal__acoes"><button type="button" class="btn btn--primario" data-acao="salvar">' + ic("check") + "Publicar catálogo</button></div>";
      UI.delegar(v, {
        "add-b": function () { UI.$("#edBancos", v).insertAdjacentHTML("beforeend", linha({ nome: "" }, false)); },
        "add-m": function () { UI.$("#edMaq", v).insertAdjacentHTML("beforeend", linha({ nome: "" }, true)); },
        rm: function (b) { b.closest(".card").remove(); },
        salvar: function () { var bs = UI.$$("#edBancos .card", v).map(function (c) { return c.querySelector("[data-nome]").value.trim(); }).filter(Boolean); var ms = UI.$$("#edMaq .card", v).map(function (c) { return { nome: c.querySelector("[data-nome]").value.trim(), semCredencial: c.querySelector("[data-semcred]").checked, orientacao: c.querySelector("[data-orient]").value.trim() }; }).filter(function (m) { return m.nome; }); Dados.salvarConteudo("financeiro", { bancos: bs, maquinetas: ms }, sessao).then(function () { F.aplicarCatalogo({ bancos: bs, maquinetas: ms }); UI.toast("Catálogo publicado.", "ok"); }); }
      });
    });
  }
  /* Envio do mês: itens, prazo, pasta e para quem vale */
  function envio(v, sessao) {
    Dados.conteudo("envio").then(function (c) {
      var E = global.Envio, itens = (c && c.itens && c.itens.length) ? c.itens.map(E.sanear) : E.PADRAO;
      var linha = function (i) {
        return '<div class="card"><div class="card__corpo grade grade--4" style="gap:8px"><div class="campo" style="grid-column:span 2"><label class="campo__rotulo">Item</label><input class="input" data-c="texto" maxlength="120" value="' + U.esc(i.texto) + '"></div><div class="campo"><label class="campo__rotulo">Até o dia</label><input class="input num" type="number" min="1" max="28" data-c="dia" value="' + i.prazoDia + '"></div><div class="campo"><label class="campo__rotulo">Pasta em Meus arquivos</label><select class="select" data-c="grupo">' + E.GRUPOS.map(function (g) { return '<option value="' + g[0] + '"' + (g[0] === i.grupo ? " selected" : "") + ">" + g[1] + "</option>"; }).join("") + '</select></div><div class="campo" style="grid-column:span 2"><label class="campo__rotulo">Vale para</label><select class="select" data-c="so">' + E.CONDICOES.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === i.so ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + '</select></div><input type="hidden" data-c="id" value="' + U.esc(i.id) + '"><div style="align-self:end"><button type="button" class="btn btn--xs btn--fantasma" data-acao="rm">' + ic("trash", "ic--sm") + "Remover</button></div></div></div>";
      };
      v.innerHTML = '<div class="aviso aviso--info">' + ic("info") + '<div><b>O que o cliente manda todo mês.</b>Cada empresa só vê o que vale para ela: "só quem tem funcionários" olha o perfil do cadastro; "maquininha" e "conta em banco" olham as respostas do Checklist Financeiro. O prazo é o dia do mês; a cobrança automática espera 2 dias de tolerância. Mudanças valem no mês corrente na hora; meses fechados não mudam.</div></div>' +
        '<div class="pilha" id="edEnvio" style="gap:6px">' + itens.map(linha).join("") + '</div><div class="modal__acoes"><button type="button" class="btn btn--contorno" data-acao="add">' + ic("plus") + 'Item</button><button type="button" class="btn btn--contorno" data-acao="restaurar">' + ic("refresh") + 'Restaurar padrão</button><button type="button" class="btn btn--primario" data-acao="salvar">' + ic("check") + "Publicar envio do mês</button></div>";
      function ler() { return UI.$$("#edEnvio .card", v).map(function (c) { var g = function (n) { return c.querySelector('[data-c="' + n + '"]'); }; return E.sanear({ id: g("id").value || g("texto").value, texto: g("texto").value, prazoDia: g("dia").value, grupo: g("grupo").value, so: g("so").value }); }).filter(function (i) { return i.id && i.texto; }); }
      UI.delegar(v, {
        add: function () { UI.$("#edEnvio", v).insertAdjacentHTML("beforeend", linha({ id: "", texto: "", prazoDia: 10, grupo: "mensal", so: "todos" })); },
        rm: function (b) { b.closest(".card").remove(); },
        restaurar: function () { UI.$("#edEnvio", v).innerHTML = E.PADRAO.map(linha).join(""); },
        salvar: function () { var lista = ler(); if (!lista.length) return UI.toast("Deixe pelo menos um item.", "aviso"); Dados.salvarConteudo("envio", { itens: lista }, sessao).then(function () { E.aplicar({ itens: lista }); UI.toast("Envio do mês publicado.", "ok"); }); }
      });
    });
  }
  function video(v, sessao) {
    Dados.conteudo("video").then(function (c) {
      var V = global.Video ? global.Video.VIDEO : {}; c = c || {};
      v.innerHTML = '<div class="aviso aviso--info">' + ic("info") + '<div><b>Vídeo de apresentação da tela inicial.</b>Suba no YouTube como <b>não listado</b> (não aparece em busca, mas quem tem o link assiste; "privado" não toca em site nenhum). Cole o endereço ou só o identificador. Vazio = sem vídeo.</div></div>' +
        '<div class="card"><div class="card__corpo pilha"><div class="campo"><label class="campo__rotulo">Endereço ou identificador do YouTube</label><input class="input" id="vY" value="' + U.esc(c.youtube || V.youtube || "") + '" placeholder="https://www.youtube.com/watch?v=… ou dQw4w9WgXcQ"></div><div class="grade grade--2"><div class="campo"><label class="campo__rotulo">Título</label><input class="input" id="vT" maxlength="80" value="' + U.esc(c.titulo || V.titulo || "") + '"></div><div class="campo"><label class="campo__rotulo">Mostrar</label><select class="select" id="vM">' + [["30dias", "Nos primeiros 30 dias do cliente"], ["primeira", "Até o cliente assistir"], ["sempre", "Sempre (até ele dispensar)"]].map(function (o) { return '<option value="' + o[0] + '"' + ((c.mostrar || V.mostrar) === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + '</select></div></div><div class="campo"><label class="campo__rotulo">Texto de apoio</label><input class="input" id="vX" maxlength="240" value="' + U.esc(c.texto || V.texto || "") + '"></div><div id="vPrev"></div><div class="modal__acoes"><button type="button" class="btn btn--primario" data-acao="salvar">' + ic("check") + "Publicar vídeo</button></div></div></div>";
      var prev = function () { var id = global.Video.extrairId(UI.$("#vY", v).value); UI.$("#vPrev", v).innerHTML = id ? '<img src="https://i.ytimg.com/vi/' + id + '/hqdefault.jpg" alt="" style="max-width:320px;border-radius:10px">' : (UI.$("#vY", v).value.trim() ? '<span class="f-12 txt-erro">Não reconheci o endereço do YouTube.</span>' : ""); };
      UI.$("#vY", v).addEventListener("input", prev); prev();
      UI.delegar(v, { salvar: function () { var id = global.Video.extrairId(UI.$("#vY", v).value); if (UI.$("#vY", v).value.trim() && !id) return UI.toast("Endereço do YouTube inválido.", "erro"); var obj = { youtube: id, titulo: UI.$("#vT", v).value.trim(), texto: UI.$("#vX", v).value.trim(), mostrar: UI.$("#vM", v).value }; Dados.salvarConteudo("video", obj, sessao).then(function () { global.Video.aplicar(obj); UI.toast(id ? "Vídeo publicado." : "Vídeo removido da tela inicial.", "ok"); }); } });
    });
  }
  /* E-mail automático: o servidor de envio da Totali (SMTP), configurado aqui pela tela.
     Só administrador. A senha sai do navegador selada com a chave do cofre; só a função abre. */
  var EVENTOS = [["chat", "Mensagem da equipe no chat", "No máximo 1 e-mail a cada 20 min por empresa."], ["cobrancas", "Cobranças e avisos automáticos", "Entrada, Envio do mês e resumo do mês."], ["documentos", "Documento novo que a Totali mandou", ""], ["correcao", "Documento devolvido para correção", "Vai com o motivo."]];
  var ASSUNTOS = { chat: "Nova mensagem da Totali", cobrancas: "Lembrete da Totali", documentos: "Novo documento da Totali no seu portal", correcao: "Um documento precisa de correção" };
  function email(v, sessao) {
    if (sessao.papel !== "admin") { v.innerHTML = '<div class="aviso aviso--info">' + ic("lock") + "<div><b>Só administrador</b>A configuração do e-mail automático fica com quem administra o painel.</div></div>"; return; }
    Dados.configEmail().then(function (c) {
      c = c || {}; var ev = c.eventos || {}, as = c.assuntos || {};
      var portal = c.linkPortal || (U.urlPortal(""));
      var campo = function (rot, html, ajuda) { return '<div class="campo"><label class="campo__rotulo">' + rot + "</label>" + html + (ajuda ? '<span class="campo__ajuda">' + ajuda + "</span>" : "") + "</div>"; };
      v.innerHTML = '<div class="aviso aviso--info">' + ic("mail") + '<div><b>Avisos por e-mail ao cliente</b>Com isto ligado, o cliente recebe e-mail em tudo o que precisa saber, mesmo sem abrir o portal. Cada cliente pode desligar para si em Perfil. Para WhatsApp, as telas de cobrança têm o botão <b>Abrir no WhatsApp</b> com o texto pronto.</div></div>' +
        '<div class="card"><div class="card__corpo pilha">' +
          '<label class="interruptor"><input type="checkbox" id="emLigado"' + (c.ligado ? " checked" : "") + '><span class="interruptor__pista"></span> Enviar avisos por e-mail</label>' +
          '<div class="grade grade--3">' +
            campo("Servidor (SMTP)", '<input class="input" id="emHost" value="' + U.esc(c.host || "") + '" placeholder="smtp.gmail.com">') +
            campo("Porta", '<input class="input num" id="emPorta" type="number" value="' + U.esc(c.porta || 465) + '">', "465 ou 587") +
            campo("Usuário (e-mail que envia)", '<input class="input" id="emUsuario" type="email" value="' + U.esc(c.usuario || "") + '" placeholder="contato@totalicontabilidade.com.br">') +
          '</div><div class="grade grade--3">' +
            campo("Senha do e-mail", '<input class="input" id="emSenha" type="password" autocomplete="new-password" placeholder="' + (c.pacote ? "•••••••• guardada (deixe vazio para manter)" : "senha ou senha de app") + '">', c.pacote ? "Guardada selada. Só o servidor abre." : "Vai selada com a chave do cofre.") +
            campo("Nome de quem envia", '<input class="input" id="emNome" value="' + U.esc(c.remetenteNome || "Totali Soluções Contábeis") + '">') +
            campo("Endereço do portal", '<input class="input" id="emPortal" value="' + U.esc(portal) + '">', "Os botões do e-mail levam para cá.") +
          "</div>" +
          '<details class="mt-4"><summary class="f-13 txt-2" style="cursor:pointer">Como preencher (Google, Outlook, Hostinger)</summary><div class="f-13 txt-2 pilha mt-8" style="gap:6px"><div><b>Google Workspace ou Gmail:</b> servidor smtp.gmail.com, porta 465. Na conta que envia, ligue a verificação em duas etapas e crie uma <i>senha de app</i> (Conta Google › Segurança › Senhas de app); use essa senha aqui.</div><div><b>Outlook / Microsoft 365:</b> smtp.office365.com, porta 587.</div><div><b>Hostinger:</b> smtp.hostinger.com, porta 465. <b>Locaweb:</b> email-ssl.com.br, porta 465.</div></div></details>' +
        "</div></div>" +
        '<h2 class="mt-8">Quando avisar</h2><div class="card"><div class="card__corpo pilha">' + EVENTOS.map(function (e) {
          return '<div class="grade grade--2" style="align-items:end"><label class="checar"><input type="checkbox" data-ev="' + e[0] + '"' + (ev[e[0]] !== false ? " checked" : "") + "> " + e[1] + (e[2] ? ' <span class="f-12 txt-2">· ' + e[2] + "</span>" : "") + "</label>" + campo("Assunto", '<input class="input" data-as="' + e[0] + '" value="' + U.esc(as[e[0]] || ASSUNTOS[e[0]]) + '">') + "</div>";
        }).join("") + campo("Assinatura", '<input class="input" id="emAssinatura" value="' + U.esc(c.assinatura || "Equipe Totali Soluções Contábeis") + '">') + "</div></div>" +
        '<div class="modal__acoes"><button type="button" class="btn btn--contorno" data-acao="em-teste">' + ic("send") + 'Enviar e-mail de teste para mim</button><button type="button" class="btn btn--primario" data-acao="em-salvar">' + ic("check") + "Salvar</button></div>";
      function ler() {
        var eventos = {}, assuntos = {};
        UI.$$("[data-ev]", v).forEach(function (i) { eventos[i.dataset.ev] = i.checked; });
        UI.$$("[data-as]", v).forEach(function (i) { assuntos[i.dataset.as] = i.value.trim() || ASSUNTOS[i.dataset.as]; });
        return { ligado: UI.$("#emLigado", v).checked, host: UI.$("#emHost", v).value.trim(), porta: Number(UI.$("#emPorta", v).value) || 465, usuario: UI.$("#emUsuario", v).value.trim(), remetenteNome: UI.$("#emNome", v).value.trim(), remetenteEmail: UI.$("#emUsuario", v).value.trim(), linkPortal: UI.$("#emPortal", v).value.trim(), eventos: eventos, assuntos: assuntos, assinatura: UI.$("#emAssinatura", v).value.trim(), por: sessao.nome };
      }
      function salvar() {
        var d = ler(), senha = UI.$("#emSenha", v).value;
        if (d.linkPortal && !/^https:\/\//.test(d.linkPortal)) { UI.toast("O endereço do portal precisa começar com https://", "erro"); return Promise.reject(new Error("link")); }
        if (d.ligado && (!d.host || !d.usuario || (!senha && !c.pacote))) { UI.toast("Para ligar, preencha servidor, usuário e senha.", "aviso"); return Promise.reject(new Error("incompleto")); }
        var passo = senha ? global.Cripto.cifrar({ senha: senha }).then(function (pacote) { d.pacote = pacote; }) : Promise.resolve();
        return passo.then(function () { return Dados.salvarConfigEmail(d); }).then(function () { c = Object.assign(c, d); UI.$("#emSenha", v).value = ""; UI.$("#emSenha", v).placeholder = "•••••••• guardada (deixe vazio para manter)"; });
      }
      UI.delegar(v, {
        "em-salvar": function () { salvar().then(function () { UI.toast("E-mail salvo.", "ok"); }).catch(function (e) { if (e && e.message !== "link" && e.message !== "incompleto") UI.toast("Não foi possível salvar: " + e.message, "erro"); }); },
        "em-teste": function (b) {
          b.disabled = true; UI.toast("Salvando e mandando o teste…", "info");
          salvar().then(function () { return Dados.pedirAoServidor("pedidosDeEmail", { tipo: "teste" }, 60000); })
            .then(function () { UI.toast("E-mail de teste enviado para " + (sessao.email || "você") + ". Confira a caixa de entrada (e o spam).", "ok", null, 8000); })
            .catch(function (e) { if (e && e.message !== "link" && e.message !== "incompleto") UI.toast(e.message, "erro", null, 10000); })
            .then(function () { b.disabled = false; });
        }
      });
    });
  }

  global.ConteudoExtra = { email: email, agenda: agenda, envio: envio, avisos: avisos, ajuda: ajuda, financeiro: financeiro, video: video, ABAS: [["agenda", "Agenda de obrigações"], ["envio", "Envio do mês"], ["avisos", "Aviso automático"], ["email", "E-mail automático"], ["ajuda", "Ajuda e contatos"], ["financeiro", "Checklist Financeiro"], ["video", "Vídeo de apresentação"]] };
})(window);
