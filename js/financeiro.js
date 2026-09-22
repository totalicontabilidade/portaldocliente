/* ============================================================
   Totali · Portal do Cliente
   financeiro.js — Checklist Financeiro (bancos, maquininhas, relatórios)

   Trazido do sistema Checklist Financeiro
   (github.com/totalicontabilidade/checklist-financeiro) em
   21/09/2026, que deixa de ter link próprio. Três passos, como lá:
     1. Bancos: tem conta? quais? (16 opções + outro)
     2. Maquininhas: usa? quais? (9 opções + outra)
     3. Como a Totali recebe os relatórios: o cliente envia todo
        mês (gera termo de compromisso em PDF) ou informa o acesso
        de cada maquininha (cifrado no aparelho, vai para o cofre).
   Diferenças em relação ao original: as credenciais são cifradas
   ponta a ponta (lá iam em texto para o Firestore) e o termo é
   gerado no aparelho e guardado como documento da empresa.

   Estado em empresas/{id}.financeiro:
     { temBanco, bancos[], bancoOutro, temMaquineta, maquinetas[], maquinetaOutra,
       forma ("envio"|"acesso"), acessos{ maquineta: credencialId }, semCredencial{ maquineta: true },
       observacoes, status ("novo"|"analise"|"concluido"), enviadoEm, termo{docId, geradoEm}, protocolo }

   Painel: tela #/financeiro lista quais empresas já preencheram
   (igual ao painel do sistema oficial: filtro por status, marcar
   Novo / Em análise / Concluído, CSV) e a aba Financeiro da ficha.
   ============================================================ */
(function (global) {
  "use strict";
  var U = global.U, UI = global.UI, ic = global.ic, Dados = global.Dados, Shell = global.Shell, Cripto = global.Cripto;

  var BANCOS = ["Banco do Brasil", "Banco do Nordeste", "Banese", "Bradesco", "C6 Bank", "Caixa Econômica", "Cora", "InfinitePay", "Inter", "Itaú", "Mercado Pago", "Nubank", "PagBank", "Santander", "Sicredi", "Stone"];
  var MAQUINETAS = [{ nome: "Cielo" }, { nome: "Getnet" }, { nome: "InfinitePay", semCredencial: true, orientacao: "No app InfinitePay, ative o Modo Contador e cadastre o e-mail da Totali. Não existe senha para informar." }, { nome: "Mercado Pago" }, { nome: "Mulvi Convênio" }, { nome: "Mulvi Pay" }, { nome: "PagBank" }, { nome: "Rede" }, { nome: "Stone" }];
  var RELATORIOS = ["Relatório de vendas", "Relatório de recebimentos", "Relatório de antecipações"];
  var TERMO = {
    titulo: "Termo de Compromisso", subtitulo: "Envio dos relatórios das maquininhas",
    declaracao: "A empresa acima identificada declara que optou por enviar ela mesma os relatórios das suas máquinas de cartão, em vez de fornecer à Totali os dados de acesso aos portais das operadoras.",
    compromisso: "Assim, a empresa se compromete a encaminhar à Totali Soluções Contábeis, todo mês, pelo portal do cliente, os documentos abaixo, referentes a cada uma das suas maquininhas e sempre relativos ao MÊS ANTERIOR.",
    responsabilidadeTitulo: "Responsabilidade pelos prazos",
    responsabilidade: "Sem o recebimento desses relatórios, a Totali não consegue lançar as vendas nem as taxas do período, e o fechamento do mês fica parado. A empresa está ciente de que atrasos, multas ou penalidades decorrentes da falta de envio dos relatórios são de sua responsabilidade. Se em algum momento o envio se tornar inviável, basta comunicar a Totali para que o modelo seja alterado para o acesso direto aos portais.",
    cienciaTitulo: "Ciência eletrônica",
    ciencia: "Este termo é firmado eletronicamente, dispensando assinatura física, nos termos do art. 10, § 2º, da Medida Provisória nº 2.200-2/2001, que reconhece a validade de documentos eletrônicos quando admitidos pelas partes como válidos."
  };

  /* Catálogo editável pela equipe (Conteúdo › Financeiro): igual ao painel do sistema oficial */
  function aplicarCatalogo(b) { if (!b) return; if (Array.isArray(b.bancos) && b.bancos.length) { BANCOS.length = 0; b.bancos.forEach(function (x) { var n = U.txt(typeof x === "string" ? x : x.nome, 80); if (n) BANCOS.push(n); }); } if (Array.isArray(b.maquinetas) && b.maquinetas.length) { MAQUINETAS.length = 0; b.maquinetas.forEach(function (x) { var n = U.txt(typeof x === "string" ? x : x.nome, 80); if (n) MAQUINETAS.push({ nome: n, semCredencial: !!(x && x.semCredencial), orientacao: U.txt(x && x.orientacao, 600) }); }); } }
  function estado(e) { var f = Object.assign({ temBanco: null, bancos: [], bancoOutro: "", temMaquineta: null, maquinetas: [], maquinetaOutra: "", forma: "", acessos: {}, semCredencial: {}, informativo: { contasPagas: "", sistemaContasPagas: "", emprestimo: "", aplicacoes: "" }, observacoes: "", status: "", protocolo: "", anotacao: "" }, (e && e.financeiro) || {}); f.informativo = Object.assign({ contasPagas: "", sistemaContasPagas: "", emprestimo: "", aplicacoes: "" }, f.informativo || {}); return f; }
  function completo(f) {
    if (f.temBanco === null || f.temMaquineta === null) return false;
    if (f.temBanco && !f.bancos.length && !f.bancoOutro) return false;
    if (f.temMaquineta) {
      if (!f.maquinetas.length && !f.maquinetaOutra) return false;
      if (!f.forma) return false;
      if (f.forma === "acesso") { var faltando = f.maquinetas.filter(function (m) { var cat = MAQUINETAS.filter(function (x) { return x.nome === m; })[0] || {}; return !(f.acessos[m] || (cat.semCredencial && f.semCredencial[m])); }); if (faltando.length) return false; }
    }
    var inf = f.informativo || {};
    if (!inf.contasPagas || !inf.emprestimo || !inf.aplicacoes) return false;
    if (inf.contasPagas === "sim" && !inf.sistemaContasPagas) return false;
    return true;
  }
  function passoAtual(f) { if (f.temBanco === null || (f.temBanco && !f.bancos.length && !f.bancoOutro)) return 1; if (f.temMaquineta === null || (f.temMaquineta && !f.maquinetas.length && !f.maquinetaOutra)) return 2; if (f.temMaquineta && !f.forma) return 3; var inf = f.informativo || {}; if (!inf.contasPagas || !inf.emprestimo || !inf.aplicacoes) return 4; return completo(f) ? 5 : 4; }

  /* ============================================================
     PORTAL · #/financeiro
     ============================================================ */
  function telaFinanceiro(r) {
    var P = global.Portal, e = P.empresa, sessao = P.sessao;
    Shell.titulo("Bancos e maquininhas");
    var f = estado(e), passo = Number(r.query.p) || passoAtual(f);
    if (passo > 5) passo = 5;
    var chip = function (nome, marcado, dado) { return '<button type="button" class="chip" aria-pressed="' + marcado + '" data-acao="chip" ' + dado + ' style="min-height:44px">' + (marcado ? ic("check", "ic--sm") : "") + U.esc(nome) + "</button>"; };
    var corpo = "";
    if (passo === 1) corpo = '<h2>1 · A empresa tem conta em banco?</h2><div class="segmentos mt-8" id="tb"><button type="button" data-v="1" aria-pressed="' + (f.temBanco === true) + '">Sim</button><button type="button" data-v="0" aria-pressed="' + (f.temBanco === false) + '">Não</button></div>' + (f.temBanco ? '<p class="f-13 txt-2 mt-12">Marque todos os bancos onde a empresa movimenta dinheiro.</p><div class="linha mt-8">' + BANCOS.map(function (b) { return chip(b, f.bancos.indexOf(b) > -1, 'data-lista="bancos" data-v="' + U.esc(b) + '"'); }).join("") + '</div><div class="campo mt-12"><label class="campo__rotulo">Outro banco</label><input class="input" id="bancoOutro" value="' + U.esc(f.bancoOutro) + '" placeholder="Nome do banco"></div>' : "");
    if (passo === 2) corpo = '<h2>2 · Usa maquininha de cartão?</h2><div class="segmentos mt-8" id="tm"><button type="button" data-v="1" aria-pressed="' + (f.temMaquineta === true) + '">Sim</button><button type="button" data-v="0" aria-pressed="' + (f.temMaquineta === false) + '">Não</button></div>' + (f.temMaquineta ? '<p class="f-13 txt-2 mt-12">Marque todas as maquininhas.</p><div class="linha mt-8">' + MAQUINETAS.map(function (m) { return chip(m.nome, f.maquinetas.indexOf(m.nome) > -1, 'data-lista="maquinetas" data-v="' + U.esc(m.nome) + '"'); }).join("") + '</div><div class="campo mt-12"><label class="campo__rotulo">Outra maquininha</label><input class="input" id="maquinetaOutra" value="' + U.esc(f.maquinetaOutra) + '"></div>' : "");
    if (passo === 3) {
      var opcoes = [{ id: "acesso", titulo: "Informo o acesso, a Totali baixa sozinha", desc: "Você informa login e senha de cada maquininha aqui mesmo. A senha é embaralhada no seu aparelho antes de sair e só a Totali abre, com registro de cada abertura. Usamos só para baixar relatórios, nunca para movimentar dinheiro.", rec: true }, { id: "envio", titulo: "Eu mesmo envio os relatórios todo mês", desc: "Você baixa e nos manda, todo mês, o relatório de vendas, o de recebimentos e o de antecipações de cada maquininha. Geramos um termo de compromisso em PDF para você guardar." }];
      corpo = '<h2>3 · Como a Totali recebe os relatórios das maquininhas?</h2><div class="pilha mt-8" style="gap:8px">' + opcoes.map(function (o) { return '<button type="button" class="card card--clicavel" data-acao="forma" data-v="' + o.id + '" style="text-align:left;border-color:' + (f.forma === o.id ? "var(--gold)" : "var(--border)") + '"><div class="card__corpo linha" style="flex-wrap:nowrap;align-items:flex-start"><span class="passo__check" style="' + (f.forma === o.id ? "background:var(--gold);border-color:var(--gold);color:var(--gold-foreground)" : "") + '">' + ic("check", "ic--sm") + '</span><div><b>' + o.titulo + "</b>" + (o.rec ? " " + UI.badge("recomendado", "gold") : "") + '<div class="f-13 txt-2 mt-4">' + o.desc + "</div></div></div></button>"; }).join("") + "</div>" +
        (f.forma === "acesso" ? '<div class="pilha mt-12" style="gap:6px"><p class="f-13 txt-2">Informe o acesso de cada maquininha. Prefira um perfil de consulta, que não movimenta dinheiro.</p>' + f.maquinetas.map(function (m) { var cat = MAQUINETAS.filter(function (x) { return x.nome === m; })[0] || {}; var ok = !!f.acessos[m] || (cat.semCredencial && f.semCredencial[m]); return '<div class="doc"><span class="doc__icone" style="' + (ok ? "background:var(--success-soft);color:var(--success)" : "") + '">' + ic(ok ? "check" : "credit-card") + '</span><div style="flex:1"><div class="doc__nome">' + U.esc(m) + '</div><div class="doc__meta">' + (cat.orientacao ? U.esc(cat.orientacao) : ok ? "acesso guardado no cofre" : "login e senha do portal da operadora") + "</div></div>" + (cat.semCredencial ? '<label class="checar"><input type="checkbox" data-acao="semcred" data-m="' + U.esc(m) + '"' + (f.semCredencial[m] ? " checked" : "") + "> Já cadastrei a Totali</label>" : '<button type="button" class="btn btn--xs ' + (ok ? "btn--contorno" : "btn--primario") + '" data-acao="acesso" data-m="' + U.esc(m) + '">' + ic("lock", "ic--sm") + (ok ? "Atualizar" : "Informar") + "</button>") + "</div>"; }).join("") + "</div>" : "") +
        (f.forma === "envio" ? '<div class="aviso aviso--info mt-12">' + ic("info") + "<div><b>Combinado.</b>Então você se compromete a enviar à Totali, todo mês, de cada maquininha: " + RELATORIOS.join(", ").toLowerCase() + ". Sempre do mês anterior. Ao concluir, geramos o termo em PDF.</div></div>" : "");
    }
    if (passo === 4) {
      var inf = f.informativo, simNao = function (id, v) { return '<div class="segmentos" data-inf="' + id + '"><button type="button" data-v="sim" aria-pressed="' + (v === "sim") + '">Sim</button><button type="button" data-v="nao" aria-pressed="' + (v === "nao") + '">Não</button></div>'; };
      corpo = '<h2>4 · Informativo</h2><p class="f-13 txt-2">Três perguntas rápidas que mudam como organizamos a sua contabilidade.</p>' +
        '<div class="pilha mt-8" style="gap:14px"><div><b class="f-13">A empresa possui um controle de contas pagas?</b><p class="f-12 txt-2">Os pagamentos da empresa (fornecedores, despesas, impostos, salários) são registrados em algum sistema ou planilha?</p>' + simNao("contasPagas", inf.contasPagas) + (inf.contasPagas === "sim" ? '<div class="campo mt-8"><label class="campo__rotulo" for="scp">Qual sistema ou ferramenta?</label><input class="input" id="scp" value="' + U.esc(inf.sistemaContasPagas) + '" placeholder="Nome do sistema, ou planilha em Excel"></div>' : "") + "</div>" +
        '<div><b class="f-13">A empresa possui empréstimo ou financiamento bancário?</b>' + simNao("emprestimo", inf.emprestimo) + "</div>" +
        '<div><b class="f-13">A empresa possui aplicações financeiras?</b>' + simNao("aplicacoes", inf.aplicacoes) + "</div></div>";
    }
    if (passo === 5) corpo = '<h2>Revisão</h2><div class="pilha mt-8" style="gap:6px"><div class="doc"><span class="doc__icone">' + ic("building") + '</span><div><div class="doc__nome">Bancos</div><div class="doc__meta">' + (f.temBanco ? U.esc(f.bancos.concat(f.bancoOutro ? [f.bancoOutro] : []).join(", ")) : "sem conta bancária") + '</div></div></div><div class="doc"><span class="doc__icone">' + ic("credit-card") + '</span><div><div class="doc__nome">Maquininhas</div><div class="doc__meta">' + (f.temMaquineta ? U.esc(f.maquinetas.concat(f.maquinetaOutra ? [f.maquinetaOutra] : []).join(", ")) + " · " + (f.forma === "acesso" ? "a Totali baixa os relatórios" : "você envia os relatórios todo mês") : "não usa") + '</div></div></div><div class="doc"><span class="doc__icone">' + ic("info") + '</span><div><div class="doc__nome">Informativo</div><div class="doc__meta">contas pagas: ' + (f.informativo.contasPagas === "sim" ? "sim (" + U.esc(f.informativo.sistemaContasPagas) + ")" : "não") + " · empréstimo: " + U.esc(f.informativo.emprestimo) + " · aplicações: " + U.esc(f.informativo.aplicacoes) + '</div></div></div></div><div class="campo mt-12"><label class="campo__rotulo">Observações (opcional)</label><textarea class="textarea" id="obs">' + U.esc(f.observacoes) + "</textarea></div>" + (f.status ? '<div class="aviso aviso--ok mt-12">' + ic("check-circle") + "<div><b>Enviado " + U.relativo(f.enviadoEm) + ".</b> Protocolo " + U.esc(f.protocolo) + ". Você pode alterar e reenviar quando quiser." + (f.termo ? ' <a href="#/documentos">Ver o termo em Documentos.</a>' : "") + "</div></div>" : "");
    Shell.render('<div class="pagina" style="max-width:760px"><div class="cabecalho"><div><div class="cabecalho__kicker">Checklist financeiro · passo ' + passo + ' de 5</div><h1>Bancos e maquininhas</h1><p>Onde a empresa movimenta dinheiro e como vamos receber os relatórios de venda. Leva uns 2 minutos.</p></div></div>' + UI.barra(passo * 20, "barra--gold") + '<div class="card"><div class="card__corpo pilha">' + corpo + '</div></div><div class="linha linha--entre">' + (passo > 1 ? '<button type="button" class="btn btn--contorno" data-acao="ir" data-p="' + (passo - 1) + '">' + ic("arrow-left") + "Voltar</button>" : "<span></span>") + (passo < 5 ? '<button type="button" class="btn btn--primario" data-acao="ir" data-p="' + (passo + 1) + '">Continuar' + ic("arrow-right") + "</button>" : '<button type="button" class="btn btn--gold" data-acao="enviar">' + ic("check") + (f.status ? "Reenviar" : "Enviar para a Totali") + "</button>") + "</div></div>");
    var v = Shell.view();
    function guardar(depois) { var bo = UI.$("#bancoOutro", v), mo = UI.$("#maquinetaOutra", v), ob = UI.$("#obs", v), scp = UI.$("#scp", v); if (bo) f.bancoOutro = U.txt(bo.value, 80); if (mo) f.maquinetaOutra = U.txt(mo.value, 80); if (ob) f.observacoes = U.txt(ob.value, 1000); if (scp) f.informativo.sistemaContasPagas = U.txt(scp.value, 120); return Dados.salvarEmpresa(e.id, { financeiro: f }).then(P.recarregar).then(depois); }
    UI.$$("[data-inf] button", v).forEach(function (b) { b.addEventListener("click", function () { f.informativo[b.closest("[data-inf]").dataset.inf] = b.dataset.v; guardar(function () { telaFinanceiro({ query: { p: 4 } }); }); }); });
    UI.$$("#tb button, #tm button", v).forEach(function (b) { b.addEventListener("click", function () { if (b.closest("#tb")) f.temBanco = b.dataset.v === "1"; else f.temMaquineta = b.dataset.v === "1"; guardar(function () { telaFinanceiro({ query: { p: passo } }); }); }); });
    UI.delegar(v, {
      chip: function (b) { var l = f[b.dataset.lista], i = l.indexOf(b.dataset.v); if (i > -1) l.splice(i, 1); else l.push(b.dataset.v); guardar(function () { telaFinanceiro({ query: { p: passo } }); }); },
      forma: function (b) { f.forma = b.dataset.v; guardar(function () { telaFinanceiro({ query: { p: 3 } }); }); },
      semcred: function (b) { f.semCredencial[b.dataset.m] = b.checked; guardar(function () { telaFinanceiro({ query: { p: 3 } }); }); },
      ir: function (b) { var p = Number(b.dataset.p); if (p > passo) { if (passo === 1 && f.temBanco === null) return UI.toast("Responda se a empresa tem conta em banco.", "aviso"); if (passo === 2 && f.temMaquineta === null) return UI.toast("Responda se usa maquininha.", "aviso"); if (passo === 3 && f.temMaquineta && !f.forma) return UI.toast("Escolha como a Totali recebe os relatórios.", "aviso"); if (passo === 4) { var inf = f.informativo; if (!inf.contasPagas || !inf.emprestimo || !inf.aplicacoes) return UI.toast("Responda as três perguntas.", "aviso"); if (inf.contasPagas === "sim" && !(UI.$("#scp", v) || {}).value) return UI.toast("Informe qual sistema ou planilha a empresa usa para as contas pagas.", "aviso"); } } guardar(function () { telaFinanceiro({ query: { p: p } }); }); },
      acesso: function (b) {
        var m = b.dataset.m; if (!Cripto.configurada && !Dados.ehDemo()) return UI.toast(Cripto.motivo(), "aviso");
        UI.modal({ titulo: "Acesso · " + m, corpo: '<p class="f-13 txt-2">Login e senha do portal da operadora. Se existir um perfil só de consulta, use esse.</p><div class="pilha mt-8"><div class="campo"><label class="campo__rotulo">Login</label><input class="input" id="al" autocomplete="off"></div><div class="campo"><label class="campo__rotulo">Senha</label><input class="input senha-campo" id="as" type="password" autocomplete="new-password"></div></div>', acoes: [{ rotulo: "Cancelar" }, { rotulo: "Guardar com segurança", classe: "btn--primario", icone: "lock", ao: function (c) { var login = c.querySelector("#al").value.trim(), senha = c.querySelector("#as").value; if (!senha) { UI.toast("Digite a senha.", "aviso"); return false; } var p = Cripto.configurada ? Cripto.cifrar({ senha: senha, usuario: login, maquineta: m }) : Promise.resolve({ demo: true, segredo: btoa(unescape(encodeURIComponent(senha))) }); p.then(function (pacote) { return Dados.salvarCredencial(e.id, { rotulo: "Maquininha " + m, tipo: "maquininha", usuario: login, pacote: pacote, por: sessao.nome }); }).then(function (cred) { f.acessos[m] = cred.id; guardar(function () { UI.toast("Guardado no cofre.", "ok"); UI.vibrar(); telaFinanceiro({ query: { p: 3 } }); }); }).catch(function (err) { UI.toast(err.message, "erro"); }); } }] });
      },
      enviar: function (b) {
        if (!completo(f)) return UI.toast("Falta responder alguma etapa. Volte e confira.", "aviso");
        b.disabled = true;
        f.status = f.status || "novo"; f.enviadoEm = Date.now(); f.protocolo = f.protocolo || ("CF-" + new Date().getFullYear() + "-" + U.id().slice(-6).toUpperCase());
        var p = Promise.resolve();
        if (f.forma === "envio" && f.temMaquineta && global.PDF) {
          p = global.PDF.termo(e, f, TERMO, RELATORIOS).then(function (blob) { var file = new File([blob], "termo-compromisso-" + f.protocolo + ".pdf", { type: "application/pdf" }); return Dados.enviarDocumento(e.id, { file: file, grupo: "fiscal", origem: "cliente", por: sessao.nome, observacao: "Termo de compromisso · relatórios das maquininhas" }).then(function (d) { f.termo = { docId: d.id, geradoEm: Date.now() }; }); });
        }
        p.then(function () { return guardar(function () { UI.celebrar("Checklist financeiro enviado! Protocolo " + f.protocolo); location.hash = "#/inicio"; }); }).catch(function (err) { UI.toast(err.message || "Falha ao enviar.", "erro"); b.disabled = false; });
      }
    });
  }

  /* ============================================================
     PAINEL · #/financeiro (quem preencheu) e aba na ficha
     ============================================================ */
  var ROTULO = { novo: "Novo", analise: "Em análise", concluido: "Concluído" };
  function telaFinanceiroPainel(r) {
    var Pn = global.Painel; Shell.titulo("Checklist Financeiro");
    var filtro = r.query.status || "";
    var linhas = Pn.empresas.map(function (e) { return { e: e, f: estado(e) }; }).filter(function (l) { return !filtro || (filtro === "pendente" ? !l.f.status : l.f.status === filtro); }).sort(function (a, b) { return (b.f.enviadoEm || 0) - (a.f.enviadoEm || 0); });
    var todas = Pn.empresas.map(estado);
    Shell.render('<div class="pagina"><div class="cabecalho"><div><div class="cabecalho__kicker">Sistema integrado</div><h1>Checklist Financeiro</h1><p>Quais empresas já preencheram bancos e maquininhas, e como a Totali recebe os relatórios de cada uma.</p></div><div class="cabecalho__acoes"><select class="select" id="fs" style="min-height:36px;width:auto"><option value="">Todos os status</option><option value="pendente"' + (filtro === "pendente" ? " selected" : "") + '>Não preencheram</option><option value="novo"' + (filtro === "novo" ? " selected" : "") + '>Novo</option><option value="analise"' + (filtro === "analise" ? " selected" : "") + '>Em análise</option><option value="concluido"' + (filtro === "concluido" ? " selected" : "") + '>Concluído</option></select><button type="button" class="btn btn--contorno" data-acao="csv">' + ic("download") + "CSV</button></div></div>" +
      '<div class="grade grade--4"><div class="card kpi"><span class="kpi__rotulo">' + ic("check-circle") + 'Preencheram</span><span class="kpi__valor txt-ok">' + todas.filter(function (f) { return f.status; }).length + '<small>de ' + todas.length + '</small></span></div><div class="card kpi"><span class="kpi__rotulo">' + ic("clock") + 'Novos</span><span class="kpi__valor">' + todas.filter(function (f) { return f.status === "novo"; }).length + '</span></div><div class="card kpi"><span class="kpi__rotulo">' + ic("lock") + 'Informaram acesso</span><span class="kpi__valor">' + todas.filter(function (f) { return f.forma === "acesso"; }).length + '</span></div><div class="card kpi"><span class="kpi__rotulo">' + ic("file") + 'Com termo</span><span class="kpi__valor">' + todas.filter(function (f) { return f.termo; }).length + "</span></div></div>" +
      '<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Empresa</th><th>Protocolo</th><th>Bancos</th><th>Maquininhas</th><th>Relatórios</th><th>Enviado</th><th>Status</th></tr></thead><tbody>' + linhas.map(function (l) { var f = l.f; return '<tr style="cursor:pointer" data-acao="abrir" data-id="' + l.e.id + '"><td><b>' + U.esc(l.e.fantasia) + '</b></td><td class="mono f-12">' + U.esc(f.protocolo || "—") + '</td><td class="f-12">' + (f.temBanco === null ? "—" : f.temBanco ? U.esc(f.bancos.concat(f.bancoOutro ? [f.bancoOutro] : []).join(", ")) : "sem conta") + '</td><td class="f-12">' + (f.temMaquineta === null ? "—" : f.temMaquineta ? U.esc(f.maquinetas.concat(f.maquinetaOutra ? [f.maquinetaOutra] : []).join(", ")) : "não usa") + '</td><td class="f-12">' + (f.forma === "acesso" ? "Totali baixa" : f.forma === "envio" ? "cliente envia" + (f.termo ? " · termo" : "") : "—") + '</td><td class="f-12">' + (f.enviadoEm ? U.data(f.enviadoEm) : '<span class="txt-aviso">não preencheu</span>') + "</td><td>" + (f.status ? UI.badge(ROTULO[f.status], f.status === "concluido" ? "ok" : f.status === "analise" ? "info" : "aviso") : UI.badge("pendente")) + "</td></tr>"; }).join("") + "</tbody></table></div></div>");
    var v = Shell.view();
    UI.$("#fs", v).addEventListener("change", function () { location.hash = "#/financeiro?status=" + this.value; });
    UI.delegar(v, { abrir: function (tr) { location.hash = "#/clientes/" + tr.dataset.id + "/financeiro"; }, csv: function () { U.baixar("checklist-financeiro.csv", U.csv(linhas.map(function (l) { var f = l.f; return [l.e.fantasia, l.e.cnpj, f.protocolo, ROTULO[f.status] || "pendente", f.temBanco ? f.bancos.join(" | ") : "", f.bancoOutro, f.temMaquineta ? f.maquinetas.join(" | ") : "", f.maquinetaOutra, f.forma, f.enviadoEm ? U.dataHora(f.enviadoEm) : "", f.observacoes]; }), ["Empresa", "CNPJ", "Protocolo", "Status", "Bancos", "Outro banco", "Maquininhas", "Outra", "Relatórios", "Enviado em", "Observações"]), "text/csv;charset=utf-8"); } });
  }
  function abaFinanceiro(e, corpo) {
    var Pn = global.Painel, sessao = Pn.sessao, f = estado(e);
    corpo.innerHTML = '<div class="pagina pagina--larga">' + (!f.status ? '<div class="aviso aviso--aviso">' + ic("alert") + '<div><b>Ainda não preencheu.</b>O cliente responde em Bancos e maquininhas, no portal. <button type="button" class="btn btn--xs btn--contorno" data-acao="cobrar">Cobrar pelo chat</button></div></div>' : '<div class="linha linha--entre"><div class="f-13">Protocolo <b class="mono">' + U.esc(f.protocolo) + "</b> · enviado " + U.dataHora(f.enviadoEm) + '</div><div class="segmentos">' + ["novo", "analise", "concluido"].map(function (s) { return '<button type="button" data-acao="status" data-s="' + s + '" aria-pressed="' + (f.status === s) + '">' + ROTULO[s] + "</button>"; }).join("") + "</div></div>") +
      '<div class="grade grade--2"><div class="card"><div class="card__cab"><h3>Bancos</h3></div><div class="card__corpo" style="padding-top:8px">' + (f.temBanco === null ? '<span class="txt-mudo">não respondido</span>' : f.temBanco ? '<div class="linha">' + f.bancos.concat(f.bancoOutro ? [f.bancoOutro] : []).map(function (b) { return '<span class="chip">' + U.esc(b) + "</span>"; }).join("") + "</div>" : "Sem conta bancária") + '</div></div><div class="card"><div class="card__cab"><h3>Maquininhas</h3></div><div class="card__corpo pilha" style="padding-top:8px">' + (f.temMaquineta === null ? '<span class="txt-mudo">não respondido</span>' : f.temMaquineta ? '<div class="linha">' + f.maquinetas.concat(f.maquinetaOutra ? [f.maquinetaOutra] : []).map(function (m) { return '<span class="chip">' + U.esc(m) + (f.acessos[m] ? " " + ic("lock", "ic--sm") : f.semCredencial[m] ? " " + ic("check", "ic--sm") : "") + "</span>"; }).join("") + "</div><div class=\"f-13\">Relatórios: <b>" + (f.forma === "acesso" ? "a Totali baixa (acessos no Cofre)" : f.forma === "envio" ? "o cliente envia todo mês" : "não escolhido") + "</b>" + (f.termo ? ' · <a href="#/clientes/' + e.id + '/documentos">termo em PDF</a>' : "") + "</div>" : "Não usa maquininha") + "</div></div></div>" +
      (f.status ? '<div class="card"><div class="card__cab"><h3>Informativo</h3></div><div class="card__corpo pilha" style="padding-top:8px;gap:4px"><div class="f-13">Controle de contas pagas: <b>' + (f.informativo.contasPagas === "sim" ? "sim · " + U.esc(f.informativo.sistemaContasPagas || "") : f.informativo.contasPagas === "nao" ? "não" : "—") + '</b></div><div class="f-13">Empréstimo ou financiamento: <b>' + U.esc(f.informativo.emprestimo || "—") + '</b></div><div class="f-13">Aplicações financeiras: <b>' + U.esc(f.informativo.aplicacoes || "—") + "</b></div></div></div>" : "") +
      (f.observacoes ? '<div class="card"><div class="card__corpo f-13"><b>Observações do cliente:</b> ' + U.esc(f.observacoes) + "</div></div>" : "") +
      '<div class="card"><div class="card__cab"><h3>Anotação interna</h3><span class="sub">só a equipe vê</span></div><div class="card__corpo pilha" style="padding-top:8px"><textarea class="textarea" id="anotFin" style="min-height:70px" placeholder="Ex.: cliente vai trocar de maquininha em outubro">' + U.esc(f.anotacao || "") + '</textarea><button type="button" class="btn btn--sm btn--contorno" data-acao="anotar" style="align-self:flex-start">' + ic("check") + "Salvar anotação</button></div></div>" +
      (global.Extratos ? global.Extratos.blocoFicha(e, f) : "") + "</div>";
    UI.delegar(corpo, {
      anotar: function () { f.anotacao = U.txt(UI.$("#anotFin", corpo).value, 2000); Dados.salvarEmpresa(e.id, { financeiro: f }).then(Pn.recarregar).then(function () { UI.toast("Anotação salva.", "ok"); }); },
      status: function (b) { f.status = b.dataset.s; Dados.salvarEmpresa(e.id, { financeiro: f }).then(Pn.recarregar).then(function () { UI.toast("Status: " + ROTULO[f.status], "ok"); abaFinanceiro(Pn.empresa(e.id), corpo); }); },
      cobrar: function () { Dados.enviarMensagem(e.id, { autor: { uid: sessao.uid, nome: sessao.nome, lado: "equipe" }, texto: "Olá! Para facilitar o cadastro e a organização das informações da " + e.fantasia + ", pedimos que você preencha o Checklist Financeiro aqui no portal, em Bancos e maquininhas. São perguntas rápidas: quais bancos a empresa utiliza e quais maquininhas de cartão. Leva cerca de 2 minutos e pode ser feito pelo celular. Essas informações são importantes para a conferência e o acompanhamento dos dados para a contabilização da empresa. Link: " + location.origin + location.pathname.replace(/equipe\.html$/, "") + "index.html#/financeiro" }).then(function () { UI.toast("Cobrança enviada.", "ok"); }); }
    });
    if (global.Extratos) global.Extratos.ligarFicha(corpo, e, f);
  }

  /* Gancho na tela inicial do portal e link a partir da Entrada */
  global.InicioExtras = global.InicioExtras || [];
  global.InicioExtras.push(function () {
    var e = global.Portal.empresa, f = estado(e);
    if (f.status) return null;
    return { coluna: '<a class="card card--clicavel" href="#/financeiro" style="text-decoration:none;color:inherit"><div class="card__corpo linha" style="flex-wrap:nowrap"><span class="selo-sistema" style="background:var(--info-soft);color:var(--info)">' + ic("credit-card") + '</span><div class="lista__texto"><b>Bancos e maquininhas</b><span class="lista__sub">2 perguntas rápidas: onde a empresa movimenta dinheiro e como recebemos os relatórios.</span></div>' + ic("chevron-right") + "</div></a>" };
  });

  global.TelasPortal = global.TelasPortal || {}; global.TelasPortal.financeiro = telaFinanceiro;
  global.TelasPainel = global.TelasPainel || {}; global.TelasPainel.financeiro = telaFinanceiroPainel;
  global.AbasFicha = global.AbasFicha || {}; global.AbasFicha.financeiro = abaFinanceiro;
  global.Financeiro = { estado: estado, completo: completo, aplicarCatalogo: aplicarCatalogo, BANCOS: BANCOS, MAQUINETAS: MAQUINETAS, TERMO: TERMO, RELATORIOS: RELATORIOS };
})(window);
