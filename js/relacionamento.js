/* ============================================================
   Totali · Portal do Cliente
   relacionamento.js — o que faz o cliente ficar porque vale

   Telas do portal: #/historico (linha do tempo exportável),
   #/ajuda (FAQ, contatos, horário e mapa, editáveis em Conteúdo),
   #/indicar (indicação de cliente), #/entregas (guias e relatórios
   do mês, preparado para o sistema de controle da equipe que o
   Raoni está desenvolvendo), NPS trimestral e resumo do mês na
   tela inicial. Painel: #/indicacoes, NPS e "Encerrar cliente".
   ============================================================ */
(function (global) {
  "use strict";
  var U = global.U, UI = global.UI, ic = global.ic, Dados = global.Dados, Shell = global.Shell;

  var ORG = { nome: "Totali Soluções Contábeis", curto: "Totali", email: "contato@totalicontabilidade.com.br", telefoneExibicao: "(79) 99841-2107", whatsapp: "5579998412107", site: "https://www.totalicontabilidade.com.br", instagram: "totalicontabilidade", horario: "Segunda a sexta, das 7h às 17h", endereco: "Rua Juca Monteiro, 891 · Anísio Amâncio de Oliveira", cidade: "Itabaiana · SE", cep: "49503-390", mapa: "https://maps.app.goo.gl/mUHXTmtfmB8GYgzr8" };
  var FAQ = [
    { q: "Quem envia os documentos de entrada?", a: "A sua contabilidade anterior manda a maior parte (contrato social, balanços, livros, folha) por um link que a Totali envia a eles. Você acompanha aqui e envia só o que é seu: documentos dos sócios, certificado e acessos com senha." },
    { q: "Preciso enviar tudo de uma vez?", a: "Não. Cada arquivo fica salvo assim que você anexa. Feche o portal e volte depois de onde parou." },
    { q: "Não consigo um documento com o contador anterior. E agora?", a: "Fale com a gente pelo chat. A maioria pode ser obtida nos portais oficiais (Junta Comercial, Receita, SEFAZ) e nós ajudamos. Entregar os documentos também é obrigação profissional do contador anterior." },
    { q: "É seguro informar minhas senhas aqui?", a: "É. A senha é embaralhada dentro do seu aparelho antes de sair. No nosso banco ela fica assim, e só a nossa equipe consegue pedir a abertura, pelo sistema interno, com registro de quem abriu e quando. Se preferir não digitar senha, os itens de acesso oferecem a procuração eletrônica no e-CAC." },
    { q: "Para que a Totali usa esses acessos?", a: "Para emitir e transmitir o que a empresa precisa entregar, baixar relatórios das maquininhas e consultar a situação fiscal. Nunca movimentamos dinheiro nem alteramos cadastro sem falar com você. A Totali nunca pede a senha do seu banco." },
    { q: "Que tipos de arquivo posso enviar?", a: "PDF, imagens (JPG, PNG, WEBP), planilhas e documentos do Office, XML e TXT. Até 25 MB por arquivo. Se o seu for maior, avise que combinamos outro caminho." },
    { q: "Tirei foto do documento. Serve?", a: "Serve, desde que dê para ler tudo. Superfície plana, sem sombra e sem cortar as bordas. Frente e verso quando houver." },
    { q: "Quem vê os meus documentos?", a: "Somente a equipe da Totali responsável pela sua empresa, exclusivamente para os serviços contratados, conforme a LGPD." },
    { q: "Posso usar o portal pelo celular?", a: "Sim, ele foi feito primeiro para o celular. Instale como aplicativo: no Android, o navegador oferece \"Instalar\"; no iPhone, Compartilhar › Adicionar à Tela de Início." },
    { q: "O que é o Envio do mês?", a: "A lista do que enviar todo mês, feita para a sua empresa (extratos, notas, maquininhas, comprovantes), com prazo e aceite da Totali. Anexe o arquivo pelo item e ele fica marcado sozinho. Mês completo ganha o selo \"Em dia\"." }
  ];
  function aplicarConteudo(bruto) { if (!bruto) return; if (bruto.org) Object.keys(ORG).forEach(function (k) { if (typeof bruto.org[k] === "string") ORG[k] = U.txt(bruto.org[k], 300, ORG[k]); }); if (Array.isArray(bruto.faq) && bruto.faq.length) { FAQ.length = 0; bruto.faq.forEach(function (f) { var q = U.txt(f.q, 200), a = U.txt(f.a, 1500); if (q && a) FAQ.push({ q: q, a: a }); }); } }

  /* ---------- Ajuda e contatos ---------- */
  function telaAjuda() {
    Shell.titulo("Ajuda e contatos");
    Shell.render('<div class="pagina"><div class="cabecalho"><div><div class="cabecalho__kicker">Totali</div><h1>Ajuda e contatos</h1><p>Perguntas frequentes e todos os jeitos de falar com a gente.</p></div></div><div class="grade grade--lado"><div class="pilha">' +
      '<div class="card"><div class="card__cab"><h2>Perguntas frequentes</h2></div><div class="card__corpo pilha" style="padding-top:8px;gap:4px">' + FAQ.map(function (f) { return '<details class="passo" style="cursor:pointer;display:block"><summary class="f-13 f-800">' + U.esc(f.q) + '</summary><p class="f-13 txt-2 mt-4">' + U.esc(f.a) + "</p></details>"; }).join("") + "</div></div>" +
      '</div><div class="pilha"><div class="card card--navy"><div class="puzzle-layer"></div><div class="veu"></div><div class="card__corpo pilha"><div class="f-800 f-15">' + U.esc(ORG.nome) + '</div><div class="f-13" style="color:var(--sidebar-foreground)">' + U.esc(ORG.horario) + '</div><a class="btn btn--sm btn--gold" href="https://wa.me/' + U.esc(ORG.whatsapp) + '" target="_blank" rel="noopener">' + ic("whatsapp") + U.esc(ORG.telefoneExibicao) + '</a><a class="btn btn--sm btn--contorno" style="background:rgba(255,255,255,.08);color:#fff;border-color:rgba(255,255,255,.2)" href="mailto:' + U.esc(ORG.email) + '">' + ic("mail") + U.esc(ORG.email) + '</a><a class="btn btn--sm btn--contorno" style="background:rgba(255,255,255,.08);color:#fff;border-color:rgba(255,255,255,.2)" href="#/chat">' + ic("chat") + "Chat no portal</a></div></div>" +
      '<div class="card"><div class="card__corpo pilha"><h3>' + ic("map-pin") + ' Onde estamos</h3><p class="f-13">' + U.esc(ORG.endereco) + "<br>" + U.esc(ORG.cidade) + " · CEP " + U.esc(ORG.cep) + '</p><a class="btn btn--sm btn--contorno" href="' + U.esc(ORG.mapa) + '" target="_blank" rel="noopener">' + ic("external") + 'Abrir no mapa</a><a class="f-13" href="' + U.esc(ORG.site) + '" target="_blank" rel="noopener">' + U.esc(ORG.site.replace(/^https?:\/\//, "")) + "</a> · <a class=\"f-13\" href=\"https://instagram.com/" + U.esc(ORG.instagram) + '" target="_blank" rel="noopener">@' + U.esc(ORG.instagram) + "</a></div></div>" +
      '<div class="card"><div class="card__corpo pilha"><h3>Tutorial</h3><p class="f-13 txt-2">Reveja o passo a passo do portal quando quiser.</p><button type="button" class="btn btn--sm btn--contorno" data-acao="tour">' + ic("play") + "Rever tutorial</button></div></div></div></div></div>");
    UI.delegar(Shell.view(), { tour: function () { location.hash = "#/inicio"; setTimeout(function () { global.Tour.iniciar("portal-inicio"); }, 500); } });
  }

  /* ---------- Linha do tempo (exportável) ---------- */
  function eventos() {
    var P = global.Portal, e = P.empresa;
    return Promise.all([Dados.documentos(e.id), Dados.checklists(e.id), Dados.mensagens(e.id), Dados.feedback(e.id)]).then(function (r) {
      var ev = [];
      ev.push({ em: U.ms(e.criadaEm), tipo: "inicio", texto: "Sua empresa entrou no portal da Totali", icone: "star" });
      r[0].forEach(function (d) { ev.push({ em: U.ms(d.em), tipo: "documento", texto: (d.origem === "anterior" ? "Recebido da contabilidade anterior: " : d.origem === "equipe" ? "A Totali enviou: " : "Você enviou: ") + d.nome, icone: "file" }); if (d.revisao && d.situacao === "aprovado") ev.push({ em: U.ms(d.revisao.em), tipo: "aprovacao", texto: d.nome + " aprovado por " + d.revisao.por, icone: "check-circle" }); });
      r[1].forEach(function (c) { if (c.concluidoEm) ev.push({ em: U.ms(c.concluidoEm), tipo: "checklist", texto: "Checklist de " + c.anoMes + " concluído · mês em dia", icone: "trophy" }); });
      Object.keys(e.liberacoes || {}).forEach(function (k) { var l = e.liberacoes[k]; var s = global.CATALOGO.por(k); if (l && l.ativo && s) ev.push({ em: U.ms(l.desde), tipo: "sistema", texto: s.nome + " liberado para a sua empresa", icone: "grid" }); });
      var porMes = U.agrupar(r[2], function (m) { return U.anoMes(m.em); }); Object.keys(porMes).forEach(function (am) { var ms = porMes[am]; ev.push({ em: U.ms(ms[ms.length - 1].em), tipo: "conversa", texto: ms.length + " mensagens trocadas em " + am, icone: "chat" }); });
      if (e.migracaoConcluidaEm) ev.push({ em: U.ms(e.migracaoConcluidaEm), tipo: "marco", texto: "Migração da contabilidade anterior concluída", icone: "flag" });
      if (r[3] && r[3].em) ev.push({ em: U.ms(r[3].em), tipo: "feedback", texto: "Você avaliou os primeiros 30 dias" + (r[3].nota ? " com nota " + r[3].nota : ""), icone: "heart" });
      (e.nps || []).forEach(function (n) { ev.push({ em: U.ms(n.em), tipo: "nps", texto: "Você avaliou a Totali com nota " + n.nota, icone: "heart" }); });
      return ev.filter(function (x) { return x.em; }).sort(function (a, b) { return b.em - a.em; });
    });
  }
  function telaHistorico() {
    var e = global.Portal.empresa; Shell.titulo("Histórico");
    Shell.render(UI.esqueleto(6));
    eventos().then(function (ev) {
      var porMes = U.agrupar(ev, function (x) { return U.anoMes(x.em); });
      Shell.render('<div class="pagina"><div class="cabecalho"><div><div class="cabecalho__kicker">Sua empresa na Totali</div><h1>Histórico da sua empresa</h1><p>Tudo o que aconteceu desde o primeiro dia: documentos, aprovações, meses em dia. É seu: exporte quando quiser.</p></div><div class="cabecalho__acoes"><button type="button" class="btn btn--contorno" data-acao="csv">' + ic("download") + 'Exportar CSV</button><button type="button" class="btn btn--contorno" data-acao="json">' + ic("download") + "Exportar dados (JSON)</button></div></div>" +
        Object.keys(porMes).map(function (am) { var p = am.split("-"); return '<div class="card"><div class="card__cab"><h2>' + ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"][Number(p[1]) - 1] + " de " + p[0] + '</h2></div><div class="lista" style="padding-top:6px">' + porMes[am].map(function (x) { return '<div class="lista__item" style="min-height:0;padding:8px 16px"><span class="selo-sistema" style="width:32px;height:32px;border-radius:8px;background:var(--primary-soft);color:var(--primary)">' + ic(x.icone, "ic--sm") + '</span><div class="lista__texto"><span class="lista__titulo f-13">' + U.esc(x.texto) + '</span></div><span class="lista__meta">' + U.data(x.em) + "</span></div>"; }).join("") + "</div></div>"; }).join("") + "</div>");
      UI.delegar(Shell.view(), {
        csv: function () { U.baixar("linha-do-tempo-" + U.slug(e.fantasia) + ".csv", U.csv(ev.map(function (x) { return [U.dataHora(x.em), x.tipo, x.texto]; }), ["Quando", "Tipo", "O que aconteceu"]), "text/csv;charset=utf-8"); },
        json: function () { Promise.all([Dados.documentos(e.id), Dados.checklists(e.id), Dados.mensagens(e.id)]).then(function (r) { var dump = { empresa: { nome: e.nome, fantasia: e.fantasia, cnpj: e.cnpj, regime: e.regime, criadaEm: e.criadaEm, canalPreferido: e.canalPreferido, formaRelatorio: e.formaRelatorio }, documentos: r[0].map(function (d) { return { nome: d.nome, grupo: d.grupo, origem: d.origem, situacao: d.situacao, em: d.em }; }), checklists: r[1], mensagens: r[2].map(function (m) { return { de: m.autor.nome, lado: m.autor.lado, texto: m.texto, em: m.em }; }), linhaDoTempo: ev, exportadoEm: new Date().toISOString() }; U.baixar("meus-dados-" + U.slug(e.fantasia) + ".json", JSON.stringify(dump, null, 2), "application/json"); UI.toast("Seus dados foram exportados.", "ok"); }); }
      });
    });
  }

  /* ---------- Indicar um amigo ---------- */
  function telaIndicar() {
    var P = global.Portal, e = P.empresa, sessao = P.sessao; Shell.titulo("Indicar um amigo");
    Dados.colListar("indicacoes", { empresaId: e.id }).then(function (minhas) {
      Shell.render('<div class="pagina" style="max-width:760px"><div class="cabecalho"><div><div class="cabecalho__kicker">Totali</div><h1>Indique quem precisa de uma contabilidade de verdade</h1><p>Você indica, a gente cuida. Quando a empresa indicada fechar com a Totali, você ganha um mês de mensalidade de cortesia. Sem pegadinha e sem limite de indicações.</p></div></div>' +
        '<form class="card" id="fInd" novalidate><div class="card__corpo pilha"><div class="grade grade--2"><div class="campo"><label class="campo__rotulo">Nome de quem você indica</label><input class="input" id="iN" required></div><div class="campo"><label class="campo__rotulo">WhatsApp</label><input class="input" id="iW" inputmode="tel" placeholder="(79) 9…"></div><div class="campo"><label class="campo__rotulo">Empresa (se souber)</label><input class="input" id="iE"></div><div class="campo"><label class="campo__rotulo">O que ela precisa</label><select class="select" id="iT"><option>Abrir empresa</option><option>Trocar de contador</option><option>Regularizar pendências</option><option>Não sei, só quero indicar</option></select></div></div><label class="checar"><input type="checkbox" id="iC"> A pessoa sabe que estou indicando e concorda em ser contatada pela Totali</label><div class="modal__acoes"><button class="btn btn--gold" type="submit">' + ic("gift") + "Enviar indicação</button></div></div></form>" +
        (minhas.length ? '<div class="card"><div class="card__cab"><h2>Suas indicações</h2></div><div class="lista" style="padding-top:6px">' + minhas.map(function (i) { return '<div class="lista__item"><div class="lista__texto"><span class="lista__titulo">' + U.esc(i.nome) + '</span><span class="lista__sub">' + U.esc(i.empresa || "") + " · " + U.relativo(i.criadoEm) + "</span></div>" + UI.badge({ nova: "recebida", contato: "em contato", fechou: "virou cliente", nao: "não fechou" }[i.status] || i.status, i.status === "fechou" ? "ok" : i.status === "contato" ? "info" : "") + "</div>"; }).join("") + "</div></div>" : "") + "</div>");
      UI.$("#fInd").addEventListener("submit", function (ev) {
        ev.preventDefault();
        var nome = U.txt(UI.$("#iN").value, 120); if (!nome) return UI.toast("Informe o nome.", "aviso");
        if (!UI.$("#iC").checked) return UI.toast("Confirme que a pessoa concorda em ser contatada (LGPD).", "aviso");
        Dados.colAdicionar("indicacoes", { empresaId: e.id, empresa_indicante: e.fantasia, por: sessao.nome, nome: nome, whatsapp: U.txt(UI.$("#iW").value, 30), empresa: U.txt(UI.$("#iE").value, 120), necessidade: UI.$("#iT").value, status: "nova" }).then(function () { UI.celebrar("Indicação enviada. Obrigado!"); telaIndicar(); });
      });
    });
  }
  function telaIndicacoesPainel() {
    var Pn = global.Painel; Shell.titulo("Indicações");
    Dados.colListar("indicacoes").then(function (lista) {
      Shell.render('<div class="pagina"><div class="cabecalho"><div><div class="cabecalho__kicker">Comercial</div><h1>Indicações de clientes</h1><p>' + lista.length + " indicações. Quando fechar, marque \"virou cliente\" e aplique a cortesia de um mês ao indicante.</p></div></div>" + (lista.length ? '<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Indicado</th><th>WhatsApp</th><th>Empresa</th><th>Precisa de</th><th>Indicado por</th><th>Quando</th><th>Status</th></tr></thead><tbody>' + lista.map(function (i) { return "<tr><td><b>" + U.esc(i.nome) + '</b></td><td class="num">' + U.esc(i.whatsapp || "") + "</td><td>" + U.esc(i.empresa || "") + '</td><td class="f-13">' + U.esc(i.necessidade || "") + '</td><td class="f-13">' + U.esc(i.empresa_indicante || "") + " · " + U.esc(i.por || "") + '</td><td class="f-12">' + U.data(i.criadoEm) + '</td><td><select class="select" style="min-height:32px;width:auto" data-acao="st" data-id="' + i.id + '">' + [["nova", "Recebida"], ["contato", "Em contato"], ["fechou", "Virou cliente"], ["nao", "Não fechou"]].map(function (s) { return '<option value="' + s[0] + '"' + (i.status === s[0] ? " selected" : "") + ">" + s[1] + "</option>"; }).join("") + "</select></td></tr>"; }).join("") + "</tbody></table></div>" : UI.vazio("gift", "Nenhuma indicação ainda", "O cliente indica em Totali › Indicar um amigo.")) + "</div>");
      Shell.view().addEventListener("change", function (ev) { var s = ev.target.closest("[data-acao=st]"); if (!s) return; Dados.docSalvar("indicacoes/" + s.dataset.id, { status: s.value }, true).then(function () { UI.toast("Status salvo.", "ok"); }); });
    });
  }

  /* ---------- Entregas do mês (guias e relatórios) ---------- */
  function telaEntregas() {
    var e = global.Portal.empresa; Shell.titulo("Guias e relatórios");
    Dados.colListar("empresas/" + e.id + "/entregas").then(function (lista) {
      Shell.render('<div class="pagina"><div class="cabecalho"><div><div class="cabecalho__kicker">Todo mês</div><h1>Guias e relatórios</h1><p>O que a Totali entrega para a sua empresa: guias de impostos, folha, relatórios. Cada entrega registra quando você viu.</p></div></div>' + (lista.length ? '<div class="pilha" style="gap:6px">' + lista.map(function (d) { return '<div class="doc"><span class="doc__icone">' + ic("receipt") + '</span><div style="flex:1"><div class="doc__nome">' + U.esc(d.titulo) + '</div><div class="doc__meta">' + U.esc(d.competencia || "") + (d.vencimento ? " · vence " + U.data(d.vencimento) : "") + (d.vistoEm ? ' · <span class="txt-ok">visto ' + U.relativo(d.vistoEm) + "</span>" : "") + "</div></div>" + (d.url ? '<a class="btn btn--xs btn--primario" href="' + U.esc(U.urlSegura(d.url)) + '" target="_blank" rel="noopener" data-acao="visto" data-id="' + d.id + '">' + ic("download", "ic--sm") + "Abrir</a>" : "") + "</div>"; }).join("") + "</div>" : '<div class="card"><div class="card__corpo pilha"><b>Em breve, aqui.</b><p class="f-13 txt-2">A Totali está preparando o sistema de entregas da equipe. Quando ele entrar no ar, suas guias e relatórios do mês passam a chegar por esta tela, com aviso no chat. Até lá, você recebe pelo canal combinado com a equipe da Totali.</p></div></div>') + "</div>");
      UI.delegar(Shell.view(), { visto: function (a) { Dados.docSalvar("empresas/" + e.id + "/entregas/" + a.dataset.id, { vistoEm: Date.now() }, true); } });
    });
  }

  /* ---------- NPS trimestral e resumo do mês (ganchos da tela inicial) ---------- */
  global.InicioExtras = global.InicioExtras || [];
  global.InicioExtras.push(function (ctx) {
    var e = global.Portal.empresa, agora = Date.now();
    var nps = e.nps || [], ultimo = nps.length ? U.ms(nps[nps.length - 1].em) : 0;
    var pedir = U.diasEntre(e.criadaEm, agora) >= 45 && (!ultimo || agora - ultimo > 90 * U.DIA_MS) && !(UI.pref().npsAdiado && agora - UI.pref().npsAdiado < 14 * U.DIA_MS);
    var out = {};
    if (pedir) out.topo = '<div class="card card--gold entra" id="cardNps"><div class="card__corpo pilha"><div class="linha linha--entre"><b>De 0 a 10, o quanto você recomendaria a Totali?</b><button type="button" class="btn btn--xs btn--fantasma" data-acao="nps-depois">Depois</button></div><div class="linha" style="gap:4px">' + Array.from({ length: 11 }, function (_, i) { return '<button type="button" class="chip" style="min-width:36px;justify-content:center" data-acao="nps" data-n="' + i + '">' + i + "</button>"; }).join("") + '</div><p class="f-12 txt-2">Uma pergunta a cada três meses. Sua resposta vai direto para a equipe.</p></div></div>';
    /* resumo do mês anterior: dados que o portal já tem */
    var mesAnt = U.anoMes(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 15));
    var docsMes = (ctx.docs || []).filter(function (d) { return U.anoMes(d.em) === mesAnt; }), aprov = docsMes.filter(function (d) { return d.situacao === "aprovado"; }).length;
    var msgsMes = (ctx.msgs || []).filter(function (m) { return U.anoMes(m.em) === mesAnt; }).length;
    if (docsMes.length || msgsMes) out.coluna = '<div class="card"><div class="card__cab"><h2>Resumo de ' + ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"][Number(mesAnt.split("-")[1]) - 1] + '</h2><a class="btn btn--xs btn--contorno" href="#/historico">Linha do tempo</a></div><div class="card__corpo grade grade--4" style="padding-top:8px;gap:8px"><div><div class="f-800" style="font-size:20px">' + docsMes.length + '</div><div class="f-12 txt-2">documentos</div></div><div><div class="f-800" style="font-size:20px">' + aprov + '</div><div class="f-12 txt-2">aprovados</div></div><div><div class="f-800" style="font-size:20px">' + msgsMes + '</div><div class="f-12 txt-2">mensagens</div></div><div><div class="f-800" style="font-size:20px">' + ((e.liberacoes && Object.keys(e.liberacoes).filter(function (k) { return e.liberacoes[k].ativo; }).length) || 0) + '</div><div class="f-12 txt-2">sistemas</div></div></div></div>';
    return out;
  });
  global.InicioExtras[global.InicioExtras.length - 1].ligar = function (v) {
    UI.delegar(v, {
      "nps-depois": function () { UI.definirPref("npsAdiado", Date.now()); var c = UI.$("#cardNps", v); if (c) c.remove(); },
      nps: function (b) { var n = Number(b.dataset.n); UI.perguntar("Obrigado pela nota " + n + "!", n >= 9 ? "O que mais funciona para você?" : "O que a Totali poderia fazer melhor?", "", { longo: true, ok: "Enviar" }).then(function (t) { var e = global.Portal.empresa; var lista = (e.nps || []).concat([{ nota: n, texto: U.txt(t || "", 1000), em: Date.now(), por: global.Portal.sessao.nome }]); Dados.salvarEmpresa(e.id, { nps: lista }).then(global.Portal.recarregar).then(function () { UI.celebrar("Sua avaliação chegou à equipe."); global.Portal.telaInicio(); }); }); }
    });
  };

  /* ---------- Painel: NPS no início e "Encerrar cliente" ---------- */
  global.FichaMais = function (e) {
    var Pn = global.Painel, sessao = Pn.sessao;
    UI.modal({ titulo: "Mais ações · " + e.fantasia, corpo: '<div class="pilha"><button type="button" class="btn btn--contorno" data-acao="pdf">' + ic("download") + 'Ficha completa em PDF</button><button type="button" class="btn btn--contorno" data-acao="arquivar">' + ic(e.ativa === false ? "refresh" : "log-out") + (e.ativa === false ? "Reativar cliente" : "Encerrar cliente (arquivar)") + '</button><p class="f-12 txt-mudo">Encerrar arquiva a empresa: o cliente deixa de entrar, os dados ficam guardados. A exclusão da conta de login é pedida à Cloud Function e registrada na auditoria.</p></div>', acoes: [{ rotulo: "Fechar" }] });
    UI.delegar(document.querySelector(".modal__corpo"), {
      pdf: function () { if (global.PDF) global.PDF.ficha(e, (e.entrada || {}), global.Onboarding ? global.Onboarding.GRUPOS : [], []); },
      arquivar: function () {
        var reativar = e.ativa === false;
        UI.confirmar(reativar ? "Reativar cliente?" : "Encerrar este cliente?", reativar ? "O cliente volta a entrar no portal." : "A empresa é arquivada e os acessos dos clientes deixam de entrar. Nada é apagado.", { ok: reativar ? "Reativar" : "Encerrar", perigo: !reativar }).then(function (ok) {
          if (!ok) return;
          Dados.salvarEmpresa(e.id, { ativa: reativar, encerradaEm: reativar ? 0 : Date.now() }).then(function () {
            if (!reativar && (e.acessos || []).length) return Dados.colAdicionar("exclusoesDeConta", { pedidoPor: sessao.uid, empresaId: e.id, uids: e.acessos.map(function (a) { return a.uid; }), motivo: "encerramento" });
          }).then(function () { UI.toast(reativar ? "Cliente reativado." : "Cliente encerrado e pedido de exclusão de conta registrado.", "ok"); Pn.recarregar().then(function () { location.hash = "#/clientes"; }); });
        });
      }
    });
  };

  global.TelasPortal = global.TelasPortal || {};
  Object.assign(global.TelasPortal, { historico: telaHistorico, ajuda: telaAjuda, indicar: telaIndicar, entregas: telaEntregas });
  global.TelasPainel = global.TelasPainel || {}; global.TelasPainel.indicacoes = telaIndicacoesPainel;
  global.Relacionamento = { ORG: ORG, FAQ: FAQ, aplicarConteudo: aplicarConteudo, eventos: eventos };
})(window);
