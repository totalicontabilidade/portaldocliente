/* ============================================================
   Totali · Portal do Cliente
   extratos.js — liberação de extrato pelo Ottimizza (Open Finance)

   Trazido do Academy (extratos.html/js). A Totali lê o extrato
   pelo Ottimizza; o cliente autoriza no site do próprio banco, uma
   vez por banco. A equipe gera no integrador um link por banco e
   CNPJ e cadastra aqui (ficha › Financeiro); o cliente abre a
   página extratos.html?c=CODIGO, SEM login, confere o CNPJ e vê o
   passo a passo, os links e o manual em PDF de cada banco.

   Dados: extratos/{codigo} = { empresaId, empresa, cnpjHash, bancos: [{nome, link, manual}], ativo }
          extratos/{codigo}/confirmacoes/{banco} = { confirmado, em, por }
   O CNPJ não fica gravado: só um resumo (hash), para segurar link
   encaminhado por engano. Quem protege é o código de 22 caracteres.
   ============================================================ */
(function (global) {
  "use strict";
  var U = global.U, UI = global.UI, ic = global.ic, Dados = global.Dados;
  var PASSOS = ["Toque em “Abrir a autorização”. Uma aba nova abre no site da Ottimizza, a empresa que faz a conexão para nós.", "Na primeira tela, sobre segurança e privacidade, toque em “Continuar”.", "Informe o CPF do responsável (usuário master) pela conta e o CNPJ da empresa. Toque em “Conectar”.", "Se nada acontecer, o navegador bloqueou a janela. Toque no ícone na barra de endereço, escolha “Sempre permitir pop-up” e toque em “Conectar” de novo.", "Você é levado ao site do seu banco. Entre com os seus dados e autorize o compartilhamento até o fim (“Avançar”).", "Volte para a aba da Ottimizza e espere a barra chegar a 100%, até “Seus dados foram coletados com sucesso”."];
  var SEGURANCA = "A conexão é do Open Finance, regulado pelo Banco Central: você autoriza no site do próprio banco, e a sua senha não passa por nós nem pela Ottimizza. A Totali recebe só a leitura do extrato. Não movimentamos dinheiro nem alteramos nada na sua conta. A autorização pode ser cancelada por você, a qualquer momento, no aplicativo do banco.";

  /* ---------- Painel: bloco na aba Financeiro da ficha ---------- */
  function blocoFicha(e, f) {
    return '<div class="card" id="blocoExtratos"><div class="card__cab"><h3>Liberação de extratos (Ottimizza)</h3><span class="sub">carregando…</span></div><div class="card__corpo pilha" style="padding-top:8px" id="extratosCorpo"></div></div>';
  }
  function ligarFicha(corpo, e, f) {
    var Pn = global.Painel, sessao = Pn.sessao, alvo = corpo.querySelector("#extratosCorpo"); if (!alvo) return;
    Dados.colListar("extratos", { empresaId: e.id }).then(function (lista) {
      var reg = lista.filter(function (x) { return x.ativo; })[0];
      var bancos = f.temBanco ? (f.bancos || []).concat(f.bancoOutro ? [f.bancoOutro] : []) : [];
      var link = reg ? location.origin + location.pathname.replace(/equipe\.html$/, "") + "extratos.html?c=" + reg.id : "";
      alvo.innerHTML = (reg ? '<div class="codigo">' + U.esc(link) + '</div><div class="linha"><button type="button" class="btn btn--xs btn--contorno" data-acao="ext-copiar">' + ic("copy", "ic--sm") + 'Copiar link</button><button type="button" class="btn btn--xs btn--fantasma" data-acao="ext-desativar">Desativar link</button></div>' : '<p class="f-13 txt-2">Gere a página sem login para o cliente autorizar cada banco. Cadastre abaixo o link do integrador por banco.</p>') +
        '<div class="pilha" style="gap:6px">' + (reg ? reg.bancos : bancos.map(function (b) { return { nome: b, link: "", manual: "" }; })).map(function (b, i) { var conf = reg && reg.confirmacoes && reg.confirmacoes[b.nome]; return '<div class="doc"><span class="doc__icone" style="' + (conf ? "background:var(--success-soft);color:var(--success)" : "") + '">' + ic(conf ? "check" : "building") + '</span><div style="flex:1;min-width:0"><div class="doc__nome">' + U.esc(b.nome) + '</div><div class="doc__meta">' + (conf ? "autorizado " + U.relativo(conf.em) + " por " + U.esc(conf.por) : b.link ? "link cadastrado" : "sem link do integrador") + "</div></div>" + '<button type="button" class="btn btn--xs btn--contorno" data-acao="ext-link" data-i="' + i + '" data-nome="' + U.esc(b.nome) + '">' + ic("link", "ic--sm") + (b.link ? "Editar" : "Link") + "</button></div>"; }).join("") + '<button type="button" class="btn btn--xs btn--contorno" data-acao="ext-banco">' + ic("plus", "ic--sm") + "Outro banco</button></div>";
      corpo.querySelector("#blocoExtratos .sub").textContent = reg ? "página ativa" : "sem página";
      function salvar(dados) { var id = reg ? reg.id : U.codigo(22); return U.hashSimples(e.cnpj.replace(/\D/g, "")).then(function (h) { return Dados.docSalvar("extratos/" + id, Object.assign({ empresaId: e.id, empresa: e.fantasia, cnpjHash: h, ativo: true, bancos: reg ? reg.bancos : bancos.map(function (b) { return { nome: b, link: "", manual: "" }; }), confirmacoes: reg ? reg.confirmacoes || {} : {} }, dados), true); }).then(function () { ligarFicha(corpo, e, f); }); }
      UI.delegar(alvo, {
        "ext-copiar": function () { UI.copiar(link, "Link copiado."); },
        "ext-desativar": function () { salvar({ ativo: false }).then(function () { UI.toast("Link desativado.", "ok"); }); },
        "ext-link": function (b) { var nome = b.dataset.nome, atual = ((reg ? reg.bancos : []).filter(function (x) { return x.nome === nome; })[0]) || {}; UI.modal({ titulo: "Link do integrador · " + nome, corpo: '<div class="pilha"><div class="campo"><label class="campo__rotulo">Link da Ottimizza (https)</label><input class="input" id="el" value="' + U.esc(atual.link || "") + '"></div><div class="campo"><label class="campo__rotulo">Manual em PDF (https, opcional)</label><input class="input" id="em" value="' + U.esc(atual.manual || "") + '"></div></div>', acoes: [{ rotulo: "Cancelar" }, { rotulo: "Salvar", classe: "btn--primario", ao: function (c) { var l = U.urlSegura(c.querySelector("#el").value), m = U.urlSegura(c.querySelector("#em").value); if (c.querySelector("#el").value && !l) { UI.toast("Só https.", "aviso"); return false; } var lista = (reg ? reg.bancos : bancos.map(function (x) { return { nome: x, link: "", manual: "" }; })).slice(); var i = lista.findIndex(function (x) { return x.nome === nome; }); if (i < 0) lista.push({ nome: nome, link: l, manual: m }); else lista[i] = { nome: nome, link: l, manual: m }; salvar({ bancos: lista }); } }] }); },
        "ext-banco": function () { UI.perguntar("Outro banco", "Nome do banco").then(function (n) { if (!n) return; var lista = (reg ? reg.bancos : bancos.map(function (x) { return { nome: x, link: "", manual: "" }; })).concat([{ nome: U.txt(n, 60), link: "", manual: "" }]); salvar({ bancos: lista }); }); }
      });
    });
  }

  /* ---------- Página do cliente (extratos.html) ---------- */
  function pagina() {
    var app = document.getElementById("app"); if (!app) return;
    var codigo = new URLSearchParams(location.search).get("c") || ""; history.replaceState(null, "", location.pathname);
    function cab(t, s) { return '<div class="login__painel" style="display:flex;min-height:180px;padding:28px"><div class="puzzle-layer puzzle-login"></div><div class="veu"></div><div class="brilho"></div><img src="assets/totali-contabil-branca.png" alt="Totali" style="height:40px;width:auto"><div><p class="login__frase" style="font-size:24px">' + t + '</p><p class="f-13" style="color:var(--sidebar-foreground);margin-top:8px">' + s + "</p></div></div>"; }
    app.innerHTML = '<div class="pagina" style="max-width:760px">' + cab("Liberação de extratos", "Carregando…") + "</div>";
    Dados.pronto().then(function () { return codigo ? Dados.docObter("extratos/" + codigo) : null; }).then(function (reg) {
      if (!reg || !reg.ativo) { app.innerHTML = '<div class="pagina" style="max-width:760px">' + cab("Link inválido", "Este link não existe ou foi desativado. Peça um novo à Totali.") + "</div>"; return; }
      app.innerHTML = '<div class="pagina" style="max-width:760px">' + cab("Extratos de <b>" + U.esc(reg.empresa) + "</b>", "Para conferir que este link é seu, informe o CNPJ da empresa.") + '<form class="card" id="fc"><div class="card__corpo pilha"><div class="campo"><label class="campo__rotulo">CNPJ</label><input class="input num" id="cnpj" inputmode="numeric" required></div><button class="btn btn--primario" type="submit">Continuar</button></div></form></div>';
      var inp = document.getElementById("cnpj"); inp.addEventListener("input", function () { inp.value = U.cnpj(inp.value); });
      document.getElementById("fc").addEventListener("submit", function (ev) {
        ev.preventDefault();
        U.hashSimples(inp.value.replace(/\D/g, "")).then(function (h) { if (h !== reg.cnpjHash) return UI.toast("CNPJ não confere com este link.", "erro"); mostrar(reg); });
      });
    });
    function mostrar(reg) {
      app.innerHTML = '<div class="pagina" style="max-width:760px">' + cab("Como autorizar o acesso ao extrato", "São seis passos, uma vez por banco. Leva cerca de três minutos e você faz tudo pelo celular.") +
        '<div class="card"><div class="card__cab"><h2>Seus bancos</h2></div><div class="card__corpo pilha" style="gap:6px;padding-top:8px">' + (reg.bancos || []).map(function (b) { var conf = (reg.confirmacoes || {})[b.nome]; return '<div class="doc"><span class="doc__icone" style="' + (conf ? "background:var(--success-soft);color:var(--success)" : "") + '">' + ic(conf ? "check" : "building") + '</span><div style="flex:1;min-width:0"><div class="doc__nome">' + U.esc(b.nome) + '</div><div class="doc__meta">' + (conf ? "você já autorizou " + U.relativo(conf.em) : b.link ? "aguardando sua autorização" : "a Totali ainda vai enviar o link deste banco") + '</div></div><div class="pilha" style="gap:4px;align-items:flex-end">' + (b.link ? '<a class="btn btn--xs btn--primario" href="' + U.esc(b.link) + '" target="_blank" rel="noopener">' + ic("external", "ic--sm") + "Abrir a autorização</a>" : "") + (b.manual ? '<a class="btn btn--xs btn--contorno" href="' + U.esc(b.manual) + '" target="_blank" rel="noopener">' + ic("file", "ic--sm") + "Passo a passo (PDF)</a>" : "") + (!conf && b.link ? '<button type="button" class="btn btn--xs btn--contorno" data-acao="confirmar" data-b="' + U.esc(b.nome) + '">' + ic("check", "ic--sm") + "Já autorizei</button>" : "") + "</div></div>"; }).join("") + "</div></div>" +
        '<div class="card"><div class="card__cab"><h2>Os seis passos</h2></div><div class="card__corpo pilha" style="gap:4px;padding-top:8px">' + PASSOS.map(function (p, i) { return '<div class="passo" style="cursor:default"><span class="passo__p">' + (i + 1) + '</span><span class="passo__texto f-13">' + U.esc(p) + "</span></div>"; }).join("") + "</div></div>" +
        '<div class="aviso aviso--info">' + ic("shield") + "<div><b>É seguro?</b>" + U.esc(SEGURANCA) + "</div></div></div>";
      UI.delegar(app, { confirmar: function (b) { var conf = Object.assign({}, reg.confirmacoes || {}); conf[b.dataset.b] = { confirmado: true, em: Date.now(), por: "cliente" }; Dados.docSalvar("extratos/" + reg.id, { confirmacoes: conf }, true).then(function () { reg.confirmacoes = conf; UI.toast("Obrigado! A Totali foi avisada.", "ok"); mostrar(reg); }); } });
    }
  }

  global.Extratos = { blocoFicha: blocoFicha, ligarFicha: ligarFicha, pagina: pagina, PASSOS: PASSOS };
  if (/extratos\.html$/.test(location.pathname)) pagina();
})(window);
