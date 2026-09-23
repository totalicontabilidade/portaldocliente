/* ============================================================
   Totali · Portal do Cliente
   onboarding.js — a ENTRADA da empresa: checklist por departamento

   Trazido do Academy (js/data.js GRUPOS_PADRAO + telas) em
   21/09/2026, com o visual deste portal. Cinco departamentos:
   Societário, Contábil, Fiscal, Departamento Pessoal e Documentos
   dos sócios (um por sócio cadastrado). Três tipos de item:
     arquivo   upload (vai para empresas/{id}/documentos com o grupo)
     acesso    credencial (vai para o cofre, cifrada no aparelho)
     dado      texto curto ou seleção
   "Não se aplica" por item e por grupo inteiro (DP sem funcionários).

   O estado mora em empresas/{id}.entrada:
     { itens: { "fiscal/livros-fiscais": {situacao, na, valor, docIds[], revisao{}}, "socios/{sid}/rg": {...} },
       gruposNA: { trabalhista: true }, socios: [{id, nome, cpf}], concluidoEm }

   Lados: o cliente marca, envia e informa; a equipe aprova, pede
   correção e vê o painel "Entrada" com o andamento de todas as
   empresas. A fonte esperada de cada item ("anterior" = vem da
   contabilidade anterior pelo link; "cliente" = só ele tem)
   aparece como dica, não como trava.
   ============================================================ */
(function (global) {
  "use strict";
  var U = global.U, UI = global.UI, ic = global.ic, Dados = global.Dados, Shell = global.Shell, Cripto = global.Cripto;

  var GRUPOS = [
    { id: "societario", grupoDoc: "societario", titulo: "Societário", icone: "receipt", desc: "Os documentos que criaram a empresa. É por aqui que confirmamos quem são os sócios, o que a empresa faz e quanto foi investido nela.", itens: [
      { id: "contrato-social", kind: "arquivo", nome: "Contrato social e alterações", obrigatorio: true, fonte: "anterior", resumo: "O documento que criou a empresa e todas as mudanças posteriores.", ajuda: { oque: "É a certidão de nascimento da empresa. Junto dele vêm as alterações contratuais registradas na Junta Comercial.", onde: ["Peça ao contador anterior: ele tem o arquivo digital.", "Ou baixe no portal da Junta Comercial do seu estado (JUCESE, em Sergipe) com o certificado digital.", "Ou envie foto legível da via física registrada, com o carimbo da Junta."], dica: "Se tiver um contrato consolidado (a última alteração que reescreve tudo), ele substitui os anteriores." } }
    ] },
    { id: "contabil", grupoDoc: "contabil", titulo: "Contábil", icone: "calculator", desc: "A memória contábil da empresa. É o que permite continuar exatamente de onde a contabilidade anterior parou.", itens: [
      { id: "balancos", kind: "arquivo", nome: "Balanços patrimoniais anteriores", obrigatorio: true, fonte: "anterior", resumo: "De preferência dos 2 ou 3 últimos anos já fechados.", ajuda: { oque: "O balanço mostra, no encerramento de cada ano, tudo que a empresa tem e tudo que ela deve.", onde: ["Com o contador anterior. É ele quem elabora e assina o balanço."], dica: "Sem o balanço do ano anterior não conseguimos abrir a contabilidade do ano atual com os saldos corretos." } },
      { id: "dre", kind: "arquivo", nome: "DRE de períodos anteriores", obrigatorio: true, fonte: "anterior", resumo: "O resumo de quanto a empresa vendeu, gastou e lucrou em cada ano.", ajuda: { oque: "A DRE mostra o desempenho do período: receita, custos, despesas e o lucro ou prejuízo.", onde: ["Com o contador anterior, normalmente no mesmo arquivo do balanço."], dica: "Envie os mesmos anos do balanço, para que os dois conversem entre si." } },
      { id: "patrimonio", kind: "arquivo", nome: "Relatório do patrimônio e depreciação", obrigatorio: false, fonte: "anterior", resumo: "A lista dos bens da empresa e quanto já perderam de valor.", ajuda: { oque: "É a relação dos bens (veículos, máquinas, móveis, computadores) com data de compra, valor e depreciação.", onde: ["Com o contador anterior, no controle de ativo imobilizado."], dica: "Se a empresa não tem bens registrados, marque \"não se aplica\"." } }
    ] },
    { id: "fiscal", grupoDoc: "fiscal", titulo: "Fiscal", icone: "file", desc: "O registro das suas notas, os impostos sobre as vendas e os acessos que usamos para calcular e entregar as declarações.", itens: [
      { id: "livros-fiscais", kind: "arquivo", nome: "Livros fiscais", obrigatorio: false, fonte: "anterior", resumo: "O registro das notas de compra e de venda e do ICMS.", ajuda: { oque: "São os registros de todas as notas e do cálculo do ICMS do período.", onde: ["Com o contador anterior, em PDF ou nos arquivos do SPED Fiscal.", "Se a empresa emite nota eletrônica, o sistema fiscal gera os arquivos."], dica: "Empresa só de serviços, sem ICMS? Marque \"não se aplica\"." } },
      { id: "certificado-digital", kind: "acesso", grupoDoc: "certificado", nome: "Certificado digital da empresa (e-CNPJ)", obrigatorio: true, fonte: "cliente", aceitaArquivo: true, credenciais: [{ id: "tipo", rotulo: "Tipo do certificado", tipo: "texto", dica: "A1 (arquivo) ou A3 (token/cartão)" }, { id: "senha", rotulo: "Senha do certificado", tipo: "senha" }, { id: "validade", rotulo: "Vence em", tipo: "texto", dica: "Opcional. Ex.: 12/2026" }], resumo: "Anexe o arquivo A1 (.pfx) e guarde a senha. A senha é embaralhada aqui no seu aparelho.", ajuda: { oque: "É a assinatura eletrônica da empresa. Sem ela não é possível transmitir declarações nem acessar o e-CAC.", onde: ["A1 (arquivo): anexe o .pfx e informe a senha no campo protegido.", "A3 (token ou cartão): informe a senha e combinamos o uso com a equipe.", "Alternativa sem senha: procuração eletrônica no e-CAC."], dica: "Confira a validade. Certificado vencido trava a entrega de obrigações e gera multa.", passosTitulo: "Passo a passo da procuração eletrônica", passos: ["Acesse o e-CAC com o certificado da empresa ou a conta gov.br (prata ou ouro) do responsável.", "Procure \"Procurações\" no menu Senhas e Procurações.", "Cadastre uma nova procuração eletrônica para a Receita Federal.", "Informe o CNPJ da Totali como procurador e o prazo de validade.", "Marque os serviços (se em dúvida, todos: você revoga quando quiser).", "Assine e conclua. Depois marque aqui \"Vou conceder procuração eletrônica\"."] } },
      { id: "acesso-simples", kind: "acesso", nome: "Acesso ao Simples Nacional", obrigatorio: false, fonte: "cliente", credenciais: [{ id: "codigo", rotulo: "Código de acesso", tipo: "senha" }, { id: "cpfResponsavel", rotulo: "CPF do responsável", tipo: "texto", dica: "O CPF usado para gerar o código" }], resumo: "Serve o código de acesso ou a procuração eletrônica.", ajuda: { oque: "O portal do Simples Nacional é onde se apura o DAS mensal.", onde: ["Com procuração eletrônica no e-CAC, a Totali acessa sem código.", "O código pode ser gerado por você no portal do Simples, com CNPJ, CPF do responsável e recibo da última declaração."], dica: "Se a empresa não é optante pelo Simples, marque \"não se aplica\"." } },
      { id: "acesso-sefaz", kind: "acesso", nome: "Acesso à SEFAZ", obrigatorio: false, fonte: "cliente", credenciais: [{ id: "usuario", rotulo: "Usuário", tipo: "texto" }, { id: "senha", rotulo: "Senha", tipo: "senha" }], resumo: "O site da Secretaria da Fazenda do estado, onde ficam as notas e o ICMS.", ajuda: { oque: "É onde se consulta a situação fiscal estadual e o ICMS da empresa.", onde: ["O acesso costuma ser pelo certificado digital.", "Em alguns casos há usuário e senha próprios."], dica: "Empresa sem inscrição estadual não precisa: marque \"não se aplica\"." } }
    ] },
    { id: "trabalhista", grupoDoc: "pessoal", titulo: "Departamento Pessoal", icone: "users", desc: "Tudo sobre os funcionários. Se a empresa não tem empregados, marque o grupo inteiro como não aplicável.", permiteGrupoNA: true, textoGrupoNA: "Minha empresa não tem funcionários registrados", itens: [
      { id: "fichas-funcionarios", kind: "arquivo", nome: "Fichas de registro dos funcionários", obrigatorio: true, fonte: "anterior", resumo: "Atualizadas, com todos os empregados ativos.", ajuda: { oque: "Reúne os dados de cada empregado: admissão, cargo, salário e alterações.", onde: ["Com o contador ou o setor de pessoal anterior."], dica: "Inclua quem está afastado (INSS, licença, férias)." } },
      { id: "folhas-12m", kind: "arquivo", nome: "Folhas de pagamento dos últimos 12 meses", obrigatorio: true, fonte: "anterior", resumo: "Em PDF, mês a mês.", ajuda: { oque: "Demonstrativo mensal do que foi pago a cada empregado.", onde: ["Com o contador anterior, um PDF por competência."], dica: "Pode enviar tudo de uma vez: o item aceita vários arquivos." } },
      { id: "ferias", kind: "arquivo", nome: "Relação de férias vencidas e a vencer", obrigatorio: true, fonte: "anterior", resumo: "Quem já tem férias para tirar e a partir de quando.", ajuda: { oque: "Mostra quem tem férias adquiridas ou vencidas.", onde: ["No sistema de folha do contador anterior."], dica: "Férias vencidas geram pagamento em dobro." } },
      { id: "ficha-financeira", kind: "arquivo", nome: "Ficha financeira dos últimos 2 anos", obrigatorio: true, fonte: "anterior", resumo: "Histórico de valores pagos por empregado.", ajuda: { oque: "Resumo, mês a mês, de tudo que cada empregado recebeu.", onde: ["Relatório padrão do sistema de folha."], dica: "Permite calcular médias corretas em férias, 13º e rescisões." } },
      { id: "acesso-empregador-web", kind: "acesso", nome: "Acesso ao Empregador Web", obrigatorio: false, fonte: "cliente", credenciais: [{ id: "usuario", rotulo: "CPF ou usuário do gov.br", tipo: "texto" }, { id: "senha", rotulo: "Senha", tipo: "senha" }], resumo: "Portal do seguro-desemprego e comunicações de dispensa.", ajuda: { oque: "Sistema do Ministério do Trabalho usado nas rescisões.", onde: ["Pelo gov.br da empresa ou pelo certificado digital."], dica: "O certificado com procuração também resolve, sem senha." } },
      { id: "acesso-vt", kind: "acesso", nome: "Acesso ao emissor de Vale Transporte", obrigatorio: false, fonte: "cliente", credenciais: [{ id: "site", rotulo: "Site de recarga", tipo: "texto" }, { id: "usuario", rotulo: "Usuário", tipo: "texto" }, { id: "senha", rotulo: "Senha", tipo: "senha" }], resumo: "Somente se a empresa fornece vale transporte.", ajuda: { oque: "Site onde se compram os créditos dos cartões dos empregados.", onde: ["Com quem faz a recarga hoje."], dica: "Não fornece? Marque \"não se aplica\"." } },
      { id: "informe-rendimentos", kind: "arquivo", nome: "Informe de rendimentos dos colaboradores", obrigatorio: false, fonte: "anterior", resumo: "Do último ano já fechado.", ajuda: { oque: "Comprovante que a empresa entrega para o empregado declarar o IR.", onde: ["Gerado pelo sistema de folha anterior."], dica: "" } },
      { id: "extrato-folha", kind: "arquivo", nome: "Extrato analítico da folha (2 últimos meses)", obrigatorio: true, fonte: "anterior", resumo: "O detalhe do que compõe cada salário.", ajuda: { oque: "A folha aberta em detalhe, verba por verba.", onde: ["Relatório analítico do sistema de folha."], dica: "É com ele que conferimos a migração da folha." } },
      { id: "dirf", kind: "arquivo", nome: "Recibo de entrega da DIRF", obrigatorio: false, fonte: "anterior", resumo: "Do último ano em que foi entregue.", ajuda: { oque: "A DIRF informava rendimentos pagos e imposto retido.", onde: ["No recibo do programa da DIRF."], dica: "Substituída pela EFD-Reinf e pelo eSocial: se já não entrega, marque \"não se aplica\"." } }
    ] },
    { id: "socios", grupoDoc: "socios", titulo: "Documentos dos sócios", icone: "user", escopo: "socio", desc: "Cópias simples digitalizadas. Cada sócio tem sua própria lista: cadastre todos abaixo.", itens: [
      { id: "comprovante-endereco", kind: "arquivo", nome: "Comprovante de endereço", obrigatorio: true, fonte: "cliente", resumo: "Conta recente, dos últimos 3 meses.", ajuda: { oque: "Conta de energia, água ou internet no nome do sócio.", onde: ["Fatura em papel ou o PDF da concessionária."], dica: "Conta em outro nome? Envie junto uma declaração do titular." } },
      { id: "rg", kind: "arquivo", nome: "Carteira de identidade (RG)", obrigatorio: true, fonte: "cliente", substituivelPor: "cnh", resumo: "Frente e verso, legível.", ajuda: { oque: "Documento oficial de identificação.", onde: ["Fotografe sobre uma superfície plana, sem reflexo e sem cortar as bordas."], dica: "A CNH substitui RG e CPF." } },
      { id: "cpf", kind: "arquivo", nome: "CPF", obrigatorio: true, fonte: "cliente", substituivelPor: "cnh", resumo: "Cartão ou comprovante de situação cadastral.", ajuda: { oque: "Comprovação do número de CPF.", onde: ["Cartão físico ou o Comprovante de Situação Cadastral da Receita."], dica: "Se o RG já traz o CPF impresso, ele resolve os dois." } },
      { id: "cnh", kind: "arquivo", nome: "Carteira de motorista (CNH)", obrigatorio: false, fonte: "cliente", substitui: ["rg", "cpf"], resumo: "Substitui o RG e o CPF.", ajuda: { oque: "A CNH traz RG e CPF, por isso vale pelos dois.", onde: ["Documento físico ou a CNH Digital."], dica: "Enviando a CNH, RG e CPF ficam atendidos." } },
      { id: "certidao-casamento", kind: "arquivo", nome: "Certidão de casamento", obrigatorio: false, fonte: "cliente", resumo: "Somente se casado ou em união estável formalizada.", ajuda: { oque: "Comprova o estado civil e o regime de bens.", onde: ["Cartório do registro; muitos emitem segunda via digital."], dica: "Solteiro, divorciado ou viúvo? Marque \"não se aplica\"." } },
      { id: "titulo-eleitor", kind: "arquivo", nome: "Título de eleitor", obrigatorio: false, fonte: "cliente", resumo: "Título ou tela do e-Título.", ajuda: { oque: "Documento eleitoral do sócio.", onde: ["Aplicativo e-Título ou site do TSE."], dica: "" } },
      { id: "pis", kind: "dado", nome: "Número do PIS / PASEP / NIS", obrigatorio: false, fonte: "cliente", formato: "numero", maxlen: 20, placeholder: "000.00000.00-0", resumo: "Apenas o número, sem anexo.", ajuda: { oque: "Número de inscrição do trabalhador.", onde: ["CTPS Digital, Meu INSS ou um holerite antigo."], dica: "Sócio que nunca teve vínculo pode não ter: marque \"não se aplica\"." } },
      { id: "ir-socio", kind: "arquivo", nome: "Declaração de Imposto de Renda", obrigatorio: false, fonte: "cliente", resumo: "Última declaração entregue, se houver.", ajuda: { oque: "Declaração de Ajuste Anual com recibo.", onde: ["e-CAC, em \"Meu Imposto de Renda\"."], dica: "Isento? Marque \"não se aplica\"." } },
      { id: "escolaridade", kind: "dado", nome: "Grau de escolaridade", obrigatorio: false, fonte: "cliente", formato: "selecao", opcoes: ["Ensino fundamental incompleto", "Ensino fundamental completo", "Ensino médio incompleto", "Ensino médio completo", "Ensino superior incompleto", "Ensino superior completo", "Pós-graduação", "Mestrado", "Doutorado"], resumo: "Pedida nos cadastros e declarações.", ajuda: { oque: "Exigido em cadastros de órgãos públicos.", onde: ["Selecione a opção. Não precisa anexar diploma."], dica: "" } }
    ] }
  ];

  /* ---------- Estado e situação (um julgador para os dois lados) ---------- */
  function estado(e) { var en = (e && e.entrada) || {}; return { itens: en.itens || {}, gruposNA: en.gruposNA || {}, socios: en.socios || [], concluidoEm: en.concluidoEm || 0 }; }
  function chave(g, it, socioId) { return g.escopo === "socio" ? "socios/" + socioId + "/" + it.id : g.id + "/" + it.id; }
  function situacao(en, g, it, socioId) {
    if (en.gruposNA[g.id]) return "na";
    var reg = en.itens[chave(g, it, socioId)] || {};
    if (reg.na) return "na";
    if (it.substituivelPor) { var sub = en.itens[chave(g, { id: it.substituivelPor }, socioId)] || {}; if (sub.situacao && sub.situacao !== "pendencia" && !sub.na) return "substituido"; }
    return reg.situacao || "pendente";
  }
  function conta(v) { return ["enviado", "analise", "aprovado", "substituido"].indexOf(v) > -1; }
  function progresso(e) {
    var en = estado(e), total = 0, feitos = 0, obrigFaltam = [];
    GRUPOS.forEach(function (g) {
      var alvos = g.escopo === "socio" ? en.socios.map(function (s) { return s.id; }) : [null];
      if (g.escopo === "socio" && !alvos.length) { total += 1; return; }
      alvos.forEach(function (sid) {
        g.itens.forEach(function (it) {
          var sit = situacao(en, g, it, sid);
          if (sit === "na") return;
          total++; if (conta(sit)) feitos++;
          else if (it.obrigatorio) obrigFaltam.push({ g: g, it: it, sid: sid, chave: chave(g, it, sid) });
        });
      });
    });
    return { total: total, feitos: feitos, pct: U.pct(feitos, total || 1), faltam: total - feitos, obrigFaltam: obrigFaltam, completo: total > 0 && feitos === total };
  }
  function sitBadge(s) { return { pendente: UI.badge("Pendente", "", "clock"), enviado: UI.badge("Enviado", "info", "upload"), analise: UI.badge("Em análise", "info", "eye"), aprovado: UI.badge("Aprovado", "ok", "check"), pendencia: UI.badge("Corrigir", "erro", "alert"), na: UI.badge("Não se aplica", ""), substituido: UI.badge("Atendido pela CNH", "ok", "check") }[s] || UI.badge(s); }

  function salvar(empresaId, en) { return Dados.salvarEmpresa(empresaId, { entrada: en }); }

  /* ============================================================
     PORTAL DO CLIENTE · #/entrada
     ============================================================ */
  function telaEntrada(r) {
    var P = global.Portal, e = P.empresa, sessao = P.sessao;
    Shell.titulo("Lista de documentos");
    Shell.render(UI.esqueleto(6));
    P.prepararAuto().then(function () {
      var en = estado(e), prog = progresso(e), grupoAberto = r.query.g || "";
      var html = '<div class="pagina"><div class="cabecalho"><div><div class="cabecalho__kicker">Sua entrada na Totali</div><h1>Lista de documentos</h1><p>Tudo o que precisamos para assumir sua contabilidade. Cada item tem um botão para enviar e um botão de ajuda explicando o que é e onde conseguir. A maior parte vem da sua contabilidade anterior; você envia só o que é seu.</p></div>' +
        '<div class="card card--gold" style="padding:10px 14px;display:flex;gap:12px;align-items:center">' + UI.anel(prog.pct, "", 56) + '<div><div class="f-800">' + prog.feitos + " de " + prog.total + ' itens</div><div class="f-12 txt-2">' + (prog.completo ? "Tudo entregue" : "faltam " + prog.faltam + (prog.obrigFaltam.length ? " · " + prog.obrigFaltam.length + " obrigatórios" : "")) + "</div></div></div></div>" +
        (e.migracaoConcluidaEm ? '<div class="aviso aviso--ok">' + ic("check-circle") + "<div><b>Migração concluída pela Totali.</b>Você pode continuar enviando o que faltar, mas a operação já está ativa.</div></div>" : "") +
        (global.Financeiro ? global.Financeiro.cartaoCadastro(e, false) : "") + '<div class="pilha">' + GRUPOS.map(function (g) {
          var alvos = g.escopo === "socio" ? en.socios : [null];
          var na = !!en.gruposNA[g.id];
          var itensHtml = "";
          if (g.escopo === "socio") {
            itensHtml = '<div class="pilha" style="gap:8px">' + (alvos.length ? alvos.map(function (s) {
              return '<details class="card" ' + (grupoAberto === s.id ? "open" : "") + '><summary class="card__corpo linha" style="cursor:pointer;padding:10px 14px">' + UI.avatar(s.nome, "avatar--sm") + '<div class="lista__texto"><b>' + U.esc(s.nome) + '</b><span class="lista__sub num">CPF ' + U.esc(s.cpf || "não informado") + '</span></div><span class="esp"></span>' + resumoSocio(en, g, s.id) + '<button type="button" class="btn btn--xs btn--fantasma" data-acao="socio-editar" data-sid="' + s.id + '">' + ic("pencil", "ic--sm") + '</button></summary><div class="card__corpo pilha" style="gap:6px;padding-top:0">' + g.itens.map(function (it) { return itemHtml(en, g, it, s.id); }).join("") + "</div></details>";
            }).join("") : '<div class="aviso aviso--aviso">' + ic("alert") + "<div><b>Nenhum sócio cadastrado.</b>Cadastre cada sócio para a lista de documentos dele aparecer.</div></div>") + '<button type="button" class="btn btn--sm btn--contorno" data-acao="socio-novo">' + ic("plus", "ic--sm") + "Cadastrar sócio</button></div>";
          } else {
            itensHtml = '<div class="pilha" style="gap:6px">' + g.itens.map(function (it) { return itemHtml(en, g, it, null); }).join("") + "</div>";
          }
          var f = 0, t = 0; alvos.forEach(function (s) { g.itens.forEach(function (it) { var sit = situacao(en, g, it, s ? s.id : null); if (sit === "na") return; t++; if (conta(sit)) f++; }); });
          return '<details class="card" id="g-' + g.id + '"' + (grupoAberto === g.id || (!grupoAberto && !na && f < t) ? " open" : "") + '><summary class="card__corpo linha" style="cursor:pointer"><span class="selo-sistema" style="background:var(--primary-soft);color:var(--primary);width:36px;height:36px;border-radius:10px">' + ic(g.icone) + '</span><div class="lista__texto"><b>' + U.esc(g.titulo) + '</b><span class="lista__sub">' + (na ? "não se aplica" : f + "/" + t + " itens") + "</span></div>" + (na ? UI.badge("não se aplica") : f === t && t ? UI.badge("completo", "ok", "check") : UI.badge(f + "/" + t, f ? "info" : "")) + '</summary><div class="card__corpo pilha" style="padding-top:0"><p class="f-13 txt-2">' + U.esc(g.desc) + "</p>" +
            (g.permiteGrupoNA ? '<label class="checar"><input type="checkbox" data-acao="grupo-na" data-g="' + g.id + '"' + (na ? " checked" : "") + "> " + U.esc(g.textoGrupoNA) + "</label>" : "") +
            (na ? "" : itensHtml) + "</div></details>";
        }).join("") + "</div>" +
        '<div class="card"><div class="card__corpo pilha"><h3>Perguntas frequentes</h3><a class="btn btn--sm btn--contorno" href="#/ajuda">' + ic("info") + 'Quem envia o quê, prazos e segurança</a></div></div></div>';
      var v = Shell.render(html);
      ligarPortal(v, e, en);
      if (global.Tour) global.Tour.talvez("portal-entrada");
    });
  }
  function resumoSocio(en, g, sid) { var f = 0, t = 0; g.itens.forEach(function (it) { var s = situacao(en, g, it, sid); if (s === "na") return; t++; if (conta(s)) f++; }); return UI.badge(f + "/" + t, f === t ? "ok" : f ? "info" : ""); }
  function itemHtml(en, g, it, sid) {
    var sit = situacao(en, g, it, sid), reg = en.itens[chave(g, it, sid)] || {};
    var acoes = "";
    if (sit === "na") acoes = '<button type="button" class="btn btn--xs btn--fantasma" data-acao="item-na" data-k="' + chave(g, it, sid) + '" data-v="0">Desfazer</button>';
    else if (sit === "substituido") acoes = "";
    else {
      if (it.kind === "arquivo") acoes += '<button type="button" class="btn btn--xs btn--primario" data-acao="item-arquivo" data-g="' + g.id + '" data-i="' + it.id + '" data-sid="' + (sid || "") + '">' + ic("upload", "ic--sm") + (reg.docIds && reg.docIds.length ? "Enviar mais" : "Enviar") + "</button>";
      if (it.kind === "acesso") acoes += '<button type="button" class="btn btn--xs btn--primario" data-acao="item-acesso" data-g="' + g.id + '" data-i="' + it.id + '" data-sid="' + (sid || "") + '">' + ic("lock", "ic--sm") + (sit === "pendente" ? "Informar acesso" : "Atualizar") + "</button>" + (it.aceitaArquivo ? '<button type="button" class="btn btn--xs btn--contorno" data-acao="item-arquivo" data-g="' + g.id + '" data-i="' + it.id + '" data-sid="' + (sid || "") + '">' + ic("upload", "ic--sm") + "Arquivo A1</button>" : "") + (it.id === "certificado-digital" ? '<button type="button" class="btn btn--xs btn--contorno" data-acao="item-procuracao" data-k="' + chave(g, it, sid) + '">Vou conceder procuração</button>' : "");
      if (it.kind === "dado") acoes += '<button type="button" class="btn btn--xs btn--primario" data-acao="item-dado" data-g="' + g.id + '" data-i="' + it.id + '" data-sid="' + (sid || "") + '">' + ic("pencil", "ic--sm") + (reg.valor ? "Alterar" : "Informar") + "</button>";
      if (!it.obrigatorio || it.kind !== "arquivo" || true) acoes += '<button type="button" class="btn btn--xs btn--fantasma" data-acao="item-na" data-k="' + chave(g, it, sid) + '" data-v="1">Não se aplica</button>';
    }
    return '<div class="passo" style="cursor:default;align-items:flex-start" data-k="' + chave(g, it, sid) + '"><span class="passo__check" style="' + (conta(sit) ? "background:var(--success);border-color:var(--success);color:#fff" : sit === "pendencia" ? "border-color:var(--danger)" : "") + '">' + ic("check", "ic--sm") + '</span><div style="flex:1;min-width:0"><div class="linha" style="gap:6px"><b class="f-13">' + U.esc(it.nome) + "</b>" + (it.obrigatorio ? '<span class="badge badge--gold" style="height:18px;font-size:10px">obrigatório</span>' : "") + sitBadge(sit) + '</div><div class="f-12 txt-2">' + U.esc(it.resumo) + (it.fonte === "anterior" ? ' <span class="txt-mudo">· costuma vir da contabilidade anterior</span>' : "") + "</div>" +
      (reg.valor && it.kind === "dado" ? '<div class="f-12"><b>' + U.esc(reg.valor) + "</b></div>" : "") + (reg.procuracao ? '<div class="f-12 txt-ok">Procuração eletrônica informada</div>' : "") +
      (sit === "pendencia" && reg.revisao ? '<div class="aviso aviso--erro mt-4" style="padding:6px 10px">' + ic("alert", "ic--sm") + "<span>" + U.esc(reg.revisao.motivo || "") + " <b>· " + U.esc(reg.revisao.por || "") + "</b></span></div>" : "") +
      '<div class="linha mt-4" style="gap:4px">' + acoes + '<button type="button" class="btn btn--xs btn--fantasma" data-acao="item-ajuda" data-g="' + g.id + '" data-i="' + it.id + '">' + ic("info", "ic--sm") + "Ajuda</button></div></div></div>";
  }
  function acharItem(gId, itId) { var g = GRUPOS.filter(function (x) { return x.id === gId; })[0]; return { g: g, it: g.itens.filter(function (x) { return x.id === itId; })[0] }; }
  function ligarPortal(v, e, en) {
    var P = global.Portal, sessao = P.sessao;
    function persistir(depois) { return salvar(e.id, en).then(function () { return P.recarregar(); }).then(function () { P.invalidar(); if (depois) depois(); else telaEntrada({ query: {} }); }); }
    var inp = document.createElement("input"); inp.type = "file"; inp.multiple = true; inp.hidden = true; v.appendChild(inp);
    var alvoUpload = null;
    inp.addEventListener("change", function () {
      var files = Array.prototype.slice.call(inp.files); inp.value = ""; if (!files.length || !alvoUpload) return;
      var erros = files.map(U.validarArquivo).filter(Boolean); if (erros.length) return UI.toast(erros[0], "erro");
      var a = alvoUpload, k = chave(a.g, a.it, a.sid);
      Promise.all(files.map(function (f) { return Dados.enviarDocumento(e.id, { file: f, grupo: a.it.grupoDoc || a.g.grupoDoc, origem: "cliente", por: sessao.nome, observacao: a.it.nome + (a.sid ? " · " + (en.socios.filter(function (s) { return s.id === a.sid; })[0] || {}).nome : ""), item: k }); }))
        .then(function (docs) { var reg = en.itens[k] || {}; reg.docIds = (reg.docIds || []).concat(docs.map(function (d) { return d.id; })); reg.situacao = "enviado"; reg.na = false; reg.em = Date.now(); delete reg.revisao; en.itens[k] = reg; var primeiro = Object.keys(en.itens).length === 1; return persistir(function () { if (primeiro) UI.celebrar("Primeiro documento enviado."); else { UI.toast("Enviado. A equipe confere e você recebe o aceite aqui.", "ok"); UI.vibrar(); } telaEntrada({ query: { g: a.sid || a.g.id } }); }); })
        .catch(function (err) { UI.toast(err.message || "Falha no envio.", "erro"); });
    });
    UI.delegar(v, {
      "grupo-na": function (b) { en.gruposNA[b.dataset.g] = b.checked; persistir(); },
      "item-na": function (b) { var reg = en.itens[b.dataset.k] || {}; reg.na = b.dataset.v === "1"; if (reg.na) reg.situacao = "na"; else reg.situacao = reg.docIds && reg.docIds.length ? "enviado" : ""; en.itens[b.dataset.k] = reg; persistir(); },
      "item-arquivo": function (b) { var a = acharItem(b.dataset.g, b.dataset.i); alvoUpload = { g: a.g, it: a.it, sid: b.dataset.sid || null }; inp.click(); },
      "item-dado": function (b) {
        var a = acharItem(b.dataset.g, b.dataset.i), k = chave(a.g, a.it, b.dataset.sid || null), reg = en.itens[k] || {};
        var corpo = a.it.formato === "selecao" ? '<div class="campo"><label class="campo__rotulo">' + U.esc(a.it.nome) + '</label><select class="select" id="dv">' + a.it.opcoes.map(function (o) { return "<option" + (o === reg.valor ? " selected" : "") + ">" + U.esc(o) + "</option>"; }).join("") + "</select></div>" : '<div class="campo"><label class="campo__rotulo">' + U.esc(a.it.nome) + '</label><input class="input" id="dv" maxlength="' + (a.it.maxlen || 120) + '" placeholder="' + U.esc(a.it.placeholder || "") + '" value="' + U.esc(reg.valor || "") + '"></div>';
        UI.modal({ titulo: a.it.nome, corpo: corpo, acoes: [{ rotulo: "Cancelar" }, { rotulo: "Salvar", classe: "btn--primario", ao: function (c) { var val = U.txt(c.querySelector("#dv").value, 120); if (!val) return false; reg.valor = val; reg.situacao = "enviado"; reg.na = false; reg.em = Date.now(); en.itens[k] = reg; persistir(); } }] });
      },
      "item-acesso": function (b) {
        var a = acharItem(b.dataset.g, b.dataset.i), k = chave(a.g, a.it, b.dataset.sid || null), reg = en.itens[k] || {};
        if (!Cripto.configurada && !Dados.ehDemo()) return UI.toast(Cripto.motivo(), "aviso");
        UI.modal({ titulo: a.it.nome, corpo: '<p class="f-13 txt-2">' + U.esc(a.it.resumo) + '</p><div class="pilha mt-8">' + a.it.credenciais.map(function (c) { return '<div class="campo"><label class="campo__rotulo">' + U.esc(c.rotulo) + '</label><input class="input' + (c.tipo === "senha" ? " senha-campo" : "") + '" data-cred="' + c.id + '" type="' + (c.tipo === "senha" ? "password" : "text") + '" autocomplete="off"' + (c.dica ? ' placeholder="' + U.esc(c.dica) + '"' : "") + "></div>"; }).join("") + "</div>",
          acoes: [{ rotulo: "Cancelar" }, { rotulo: "Guardar com segurança", classe: "btn--primario", icone: "lock", ao: function (c) {
            var dados = {}; a.it.credenciais.forEach(function (cr) { dados[cr.id] = c.querySelector('[data-cred="' + cr.id + '"]').value.trim(); });
            var secreto = a.it.credenciais.filter(function (cr) { return cr.tipo === "senha"; }).map(function (cr) { return dados[cr.id]; }).join("");
            if (!secreto) { UI.toast("Preencha o campo protegido.", "aviso"); return false; }
            var usuario = a.it.credenciais.filter(function (cr) { return cr.tipo !== "senha"; }).map(function (cr) { return cr.rotulo + ": " + dados[cr.id]; }).filter(function (x) { return !/: $/.test(x); }).join(" · ");
            var p = Cripto.configurada ? Cripto.cifrar(Object.assign({ senha: secreto }, dados)) : Promise.resolve({ demo: true, segredo: btoa(unescape(encodeURIComponent(secreto))) });
            p.then(function (pacote) { return Dados.salvarCredencial(e.id, { rotulo: a.it.nome, tipo: a.it.id, usuario: usuario, pacote: pacote, por: sessao.nome }); })
              .then(function (cred) { reg.credencialId = cred.id; reg.situacao = "enviado"; reg.na = false; reg.em = Date.now(); delete reg.revisao; en.itens[k] = reg; persistir(function () { UI.toast("Guardada. Só a Totali abre, e cada abertura fica registrada.", "ok"); UI.vibrar(); telaEntrada({ query: { g: a.g.id } }); }); })
              .catch(function (err) { UI.toast(err.message, "erro"); });
          } }] });
      },
      "item-procuracao": function (b) { var reg = en.itens[b.dataset.k] || {}; reg.procuracao = true; reg.situacao = "enviado"; reg.na = false; reg.em = Date.now(); en.itens[b.dataset.k] = reg; persistir(function () { UI.toast("Anotado: a equipe confere a procuração no e-CAC.", "ok"); telaEntrada({ query: { g: "fiscal" } }); }); },
      "item-ajuda": function (b) { var a = acharItem(b.dataset.g, b.dataset.i), h = a.it.ajuda || {}; UI.modal({ titulo: a.it.nome, corpo: '<div class="pilha"><div><b class="f-13">O que é</b><p class="f-13 txt-2">' + U.esc(h.oque || "") + '</p></div><div><b class="f-13">Onde conseguir</b><ul class="sistema__beneficios mt-4">' + (h.onde || []).map(function (o) { return "<li>" + ic("arrow-right", "ic--sm") + U.esc(o) + "</li>"; }).join("") + "</ul></div>" + (h.dica ? '<div class="aviso aviso--info">' + ic("info") + "<span>" + U.esc(h.dica) + "</span></div>" : "") + (h.passos ? '<div><b class="f-13">' + U.esc(h.passosTitulo || "Passo a passo") + '</b><div class="pilha mt-4" style="gap:4px">' + h.passos.map(function (p, i) { return '<div class="passo" style="cursor:default"><span class="passo__p">' + (i + 1) + '</span><span class="passo__texto f-13">' + U.esc(p) + "</span></div>"; }).join("") + "</div></div>" : "") + "</div>", acoes: [{ rotulo: "Entendi", classe: "btn--primario" }] }); },
      "socio-novo": function () { editarSocio(null); },
      "socio-editar": function (b, ev) { ev.stopPropagation(); editarSocio(en.socios.filter(function (s) { return s.id === b.dataset.sid; })[0]); }
    });
    function editarSocio(s) {
      s = s || { id: "", nome: "", cpf: "" };
      UI.modal({ titulo: s.id ? "Editar sócio" : "Cadastrar sócio", corpo: '<div class="pilha"><div class="campo"><label class="campo__rotulo">Nome completo</label><input class="input" id="sn" value="' + U.esc(s.nome) + '"></div><div class="campo"><label class="campo__rotulo">CPF</label><input class="input num" id="sc" inputmode="numeric" value="' + U.esc(s.cpf) + '"></div></div>',
        acoes: [{ rotulo: "Cancelar" }].concat(s.id ? [{ rotulo: "Remover", classe: "btn--perigo", ao: function () { en.socios = en.socios.filter(function (x) { return x.id !== s.id; }); Object.keys(en.itens).forEach(function (k) { if (k.indexOf("socios/" + s.id + "/") === 0) delete en.itens[k]; }); persistir(); } }] : []).concat([{ rotulo: "Salvar", classe: "btn--primario", ao: function (c) { var nome = U.txt(c.querySelector("#sn").value, 120), cpf = c.querySelector("#sc").value.replace(/\D/g, ""); if (!nome) { UI.toast("Informe o nome.", "aviso"); return false; } if (cpf && cpf.length !== 11) { UI.toast("CPF com 11 dígitos.", "aviso"); return false; } if (s.id) { s.nome = nome; s.cpf = cpf; } else en.socios.push({ id: "s" + U.id().slice(-6), nome: nome, cpf: cpf }); persistir(); } }]) });
    }
  }

  /* ============================================================
     PAINEL · aba "Entrada" na ficha e tela #/entrada (todas as empresas)
     ============================================================ */
  function abaEntrada(e, corpo) {
    var Pn = global.Painel, sessao = Pn.sessao;
    var en = estado(e), prog = progresso(e);
    Dados.documentos(e.id).then(function (docs) {
      var porId = U.porChave(docs, "id");
      var meus = sessao.setores || [];
      corpo.innerHTML = '<div class="pagina pagina--larga"><div class="linha linha--entre"><div class="linha" style="gap:12px">' + UI.anel(prog.pct, "", 56) + '<div><b>' + prog.feitos + " de " + prog.total + ' itens</b><div class="f-12 txt-2">' + prog.obrigFaltam.length + " obrigatórios faltando" + (en.concluidoEm ? " · concluída " + U.relativo(en.concluidoEm) : "") + '</div></div></div><div class="linha"><button type="button" class="btn btn--sm btn--contorno" data-acao="cobrar">' + ic("chat") + 'Cobrar o que falta</button><button type="button" class="btn btn--sm btn--contorno" data-acao="pdf-ficha">' + ic("download") + 'Ficha em PDF</button><button type="button" class="btn btn--sm btn--contorno" data-acao="pdf-dossie">' + ic("file") + 'Dossiê de entrada</button></div></div>' +
        (meus.length ? '<div class="aviso aviso--info">' + ic("info") + "<span>Você confere: " + U.esc(meus.join(", ")) + ". Os outros departamentos aparecem, mas em cinza.</span></div>" : "") +
        GRUPOS.map(function (g) {
          var fora = meus.length && meus.indexOf(g.id) === -1;
          var alvos = g.escopo === "socio" ? en.socios : [null];
          return '<div class="card" style="' + (fora ? "opacity:.6" : "") + '"><div class="card__cab"><h3>' + U.esc(g.titulo) + "</h3>" + (en.gruposNA[g.id] ? UI.badge("não se aplica") : "") + '</div><div class="card__corpo pilha" style="gap:6px;padding-top:8px">' + (en.gruposNA[g.id] ? '<span class="f-13 txt-2">' + U.esc(g.textoGrupoNA || "") + "</span>" : alvos.length ? alvos.map(function (s) {
            return (s ? '<div class="f-13 f-800 mt-4">' + U.esc(s.nome) + ' <span class="num txt-2">' + U.esc(s.cpf || "") + "</span></div>" : "") + g.itens.map(function (it) {
              var k = chave(g, it, s ? s.id : null), reg = en.itens[k] || {}, sit = situacao(en, g, it, s ? s.id : null);
              var arquivos = (reg.docIds || []).map(function (id) { return porId[id]; }).filter(Boolean);
              return '<div class="doc" style="align-items:flex-start"><span class="doc__icone">' + ic(it.kind === "acesso" ? "lock" : it.kind === "dado" ? "pencil" : "file") + '</span><div style="flex:1;min-width:0"><div class="doc__nome">' + U.esc(it.nome) + " " + (it.obrigatorio ? '<span class="badge badge--gold" style="height:18px;font-size:10px">obrig.</span>' : "") + '</div><div class="doc__meta">' + (reg.valor ? "valor: <b>" + U.esc(reg.valor) + "</b> · " : "") + (reg.procuracao ? "procuração eletrônica · " : "") + (reg.credencialId ? "credencial no cofre · " : "") + (reg.em ? "atualizado " + U.relativo(reg.em) : "") + "</div>" + (arquivos.length ? '<div class="linha mt-4" style="gap:4px">' + arquivos.map(function (d) { return '<button type="button" class="chip" style="min-height:26px" data-acao="ver-doc" data-id="' + d.id + '">' + ic("file", "ic--sm") + U.esc(d.nome) + "</button>"; }).join("") + "</div>" : "") + (reg.revisao && reg.revisao.motivo ? '<div class="doc__meta txt-erro">' + U.esc(reg.revisao.motivo) + "</div>" : "") + '</div><div class="pilha" style="gap:4px;align-items:flex-end">' + sitBadge(sit) + (conta(sit) || sit === "pendencia" ? '<div class="linha" style="gap:4px;flex-wrap:nowrap">' + (sit !== "aprovado" ? '<button type="button" class="btn btn--xs btn--primario" data-acao="aprovar" data-k="' + k + '">' + ic("check", "ic--sm") + "Aprovar</button>" : "") + (sit !== "pendencia" ? '<button type="button" class="btn btn--xs btn--perigo" data-acao="corrigir" data-k="' + k + '">' + ic("alert", "ic--sm") + "Correção</button>" : "") + "</div>" : sit === "pendente" ? '<button type="button" class="btn btn--xs btn--fantasma" data-acao="na-equipe" data-k="' + k + '">não se aplica</button>' : "") + "</div></div>";
            }).join("");
          }).join("") : '<span class="f-13 txt-2">Nenhum sócio cadastrado pelo cliente.</span>') + "</div></div>";
        }).join("") + "</div>";
      function persistir() { return salvar(e.id, en).then(Pn.recarregar).then(function () { abaEntrada(Pn.empresa(e.id), corpo); }); }
      UI.delegar(corpo, {
        aprovar: function (b) { var reg = en.itens[b.dataset.k] || {}; reg.situacao = "aprovado"; reg.revisao = { por: sessao.nome, em: Date.now() }; en.itens[b.dataset.k] = reg; (reg.docIds || []).forEach(function (id) { Dados.revisarDocumento(e.id, id, "aprovado", "", sessao); }); var p2 = progresso({ entrada: en }); if (p2.completo && !en.concluidoEm) en.concluidoEm = Date.now(); persistir().then(function () { UI.toast("Aprovado.", "ok"); }); },
        corrigir: function (b) { UI.perguntar("Pedir correção", "Motivo (o cliente lê exatamente isto)", "", { longo: true, ok: "Enviar" }).then(function (t) { if (!t) return; var reg = en.itens[b.dataset.k] || {}; reg.situacao = "pendencia"; reg.revisao = { por: sessao.nome, em: Date.now(), motivo: U.txt(t, 300) }; en.itens[b.dataset.k] = reg; (reg.docIds || []).forEach(function (id) { Dados.revisarDocumento(e.id, id, "pendencia", t, sessao); }); persistir(); }); },
        "na-equipe": function (b) { var reg = en.itens[b.dataset.k] || {}; reg.na = true; reg.situacao = "na"; reg.revisao = { por: sessao.nome, em: Date.now() }; en.itens[b.dataset.k] = reg; persistir(); },
        "ver-doc": function (b) { Dados.verDocumento(e.id, b.dataset.id, sessao).then(function () { return Dados.urlArquivo(porId[b.dataset.id]); }).then(function (u) { if (u) global.open(u, "_blank", "noopener"); else UI.toast("Documento de exemplo sem arquivo.", "info"); }); },
        cobrar: function () { var faltam = prog.obrigFaltam.map(function (f) { return f.it.nome; }); var texto = "Oi! Para concluirmos a entrada da " + e.fantasia + " ainda faltam: " + (faltam.slice(0, 5).join(", ") || "alguns itens") + (faltam.length > 5 ? " e mais " + (faltam.length - 5) : "") + ". É só abrir Entrada na Totali no portal e enviar. Qualquer dúvida, responde por aqui"; Dados.enviarMensagem(e.id, { autor: { uid: sessao.uid, nome: sessao.nome, lado: "equipe" }, texto: texto }).then(function () { UI.toast("Cobrança enviada pelo chat.", "ok"); }); },
        "pdf-ficha": function () { if (global.PDF) global.PDF.ficha(e, en, GRUPOS, docs); },
        "pdf-dossie": function () { if (global.PDF) global.PDF.dossie(e, en, GRUPOS, docs); }
      });
    });
  }

  function telaEntradaPainel() {
    var Pn = global.Painel;
    Shell.titulo("Entrada (documentos)");
    var linhas = Pn.empresas.map(function (e) { var p = progresso(e); var en = estado(e); return { e: e, p: p, en: en }; }).sort(function (a, b) { return a.p.pct - b.p.pct; });
    var concl = linhas.filter(function (l) { return l.p.completo; }).length;
    Shell.render('<div class="pagina"><div class="cabecalho"><div><div class="cabecalho__kicker">Onboarding</div><h1>Entrada: quem já entregou o quê</h1><p>Andamento do checklist de entrada por empresa. Toque para abrir a ficha e conferir.</p></div><button type="button" class="btn btn--contorno" data-acao="csv">' + ic("download") + 'CSV</button></div>' +
      '<div class="grade grade--3"><div class="card kpi"><span class="kpi__rotulo">' + ic("check-circle") + 'Entrada completa</span><span class="kpi__valor txt-ok">' + concl + '<small>de ' + linhas.length + '</small></span></div><div class="card kpi"><span class="kpi__rotulo">' + ic("clock") + 'Em andamento</span><span class="kpi__valor">' + linhas.filter(function (l) { return !l.p.completo && l.p.feitos > 0; }).length + '</span></div><div class="card kpi"><span class="kpi__rotulo">' + ic("alert") + 'Não começaram</span><span class="kpi__valor txt-aviso">' + linhas.filter(function (l) { return l.p.feitos === 0; }).length + "</span></div></div>" +
      '<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Empresa</th><th>Responsáveis</th><th style="min-width:160px">Progresso</th><th>Obrigatórios faltando</th><th>Sócios</th><th>Situação</th></tr></thead><tbody>' + linhas.map(function (l) { return '<tr style="cursor:pointer" data-acao="abrir" data-id="' + l.e.id + '"><td><b>' + U.esc(l.e.fantasia) + '</b></td><td class="f-13">' + U.esc(CATALOGO.responsaveisTexto(l.e)) + '</td><td><div class="f-12 txt-2">' + l.p.feitos + "/" + l.p.total + "</div>" + UI.barra(l.p.pct, l.p.completo ? "barra--ok" : "") + '</td><td class="f-12 txt-2">' + U.esc(l.p.obrigFaltam.slice(0, 3).map(function (f) { return f.it.nome; }).join(", ")) + (l.p.obrigFaltam.length > 3 ? " +" + (l.p.obrigFaltam.length - 3) : "") + '</td><td class="num">' + l.en.socios.length + "</td><td>" + (l.p.completo ? UI.badge("completa", "ok", "check") : l.p.feitos ? UI.badge("em andamento", "info") : UI.badge("não começou", "aviso")) + "</td></tr>"; }).join("") + "</tbody></table></div></div>");
    UI.delegar(Shell.view(), { abrir: function (tr) { location.hash = "#/clientes/" + tr.dataset.id + "/entrada"; }, csv: function () { U.baixar("entrada.csv", U.csv(linhas.map(function (l) { return [l.e.fantasia, l.e.cnpj, l.p.feitos, l.p.total, l.p.pct + "%", l.p.obrigFaltam.map(function (f) { return f.it.nome; }).join(" | ")]; }), ["Empresa", "CNPJ", "Feitos", "Total", "%", "Obrigatórios faltando"]), "text/csv;charset=utf-8"); } });
  }

  /* Gancho na tela inicial do portal: entrada pendente vira o "Hoje" */
  global.InicioExtras = global.InicioExtras || [];
  global.InicioExtras.push(function () {
    var e = global.Portal.empresa; var p = progresso(e);
    if (p.completo || e.migracaoConcluidaEm) return null;
    var prox = p.obrigFaltam[0];
    return { hoje: '<a class="card card--clicavel card--hoje entra" href="#/entrada' + (prox ? "?g=" + (prox.sid || prox.g.id) : "") + '" style="text-decoration:none;color:inherit;--tom:var(--gold);border-left:4px solid var(--gold)"><div class="card__corpo" style="display:flex;gap:14px;align-items:center"><span class="selo-sistema" style="background:var(--gold-soft);color:var(--gold-text)">' + ic("clipboard") + '</span><div style="flex:1;min-width:0"><div class="f-12 f-800 txt-2" style="letter-spacing:.08em;text-transform:uppercase">Hoje</div><div class="f-15 f-800">' + (p.feitos ? "Lista de documentos: faltam " + p.faltam + " itens" : "Vamos começar pela lista de documentos") + '</div><div class="f-13 txt-2">' + (prox ? "Próximo: " + U.esc(prox.it.nome) : "Cadastre os sócios e envie o que só você tem.") + '</div></div><span class="btn btn--sm btn--primario so-desktop">Continuar · ' + p.pct + "%</span>" + ic("chevron-right", "so-mobile") + "</div></a>" };
  });

  global.TelasPortal = global.TelasPortal || {}; global.TelasPortal.entrada = telaEntrada;
  global.TelasPainel = global.TelasPainel || {}; global.TelasPainel.entrada = telaEntradaPainel;
  global.AbasFicha = global.AbasFicha || {}; global.AbasFicha.entrada = abaEntrada;
  global.Onboarding = { GRUPOS: GRUPOS, estado: estado, progresso: progresso, situacao: situacao, chave: chave };
})(window);
