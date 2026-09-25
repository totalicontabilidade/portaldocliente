/* ============================================================
   Totali · Portal do Cliente
   catalogo.js — os sistemas da Totali que o portal oferece

   Cada sistema tem:
     id          chave estável (é o que a liberação por cliente usa)
     nome, tagline, desc, beneficios[]   texto de vitrine
     cor         cor do selo (só decoração; semântica nunca por cor)
     icone       ícone do selo (js/icones.js)
     modo        "embutido" abre em iframe dentro do shell
                 "externo"  abre em aba nova
     url         endereço do sistema (embutido/externo). Vazio = ainda sem endereço
     status      "disponivel" | "breve" (RH 360 está em desenvolvimento)
     publico     para quem faz sentido: ["todos"] ou lista de perfis
     prova       número real de clientes usando (a equipe atualiza no painel;
                 nunca inventar — LGPD/CDC, ver docs/00-pesquisa-engajamento.md)
     previa      o que mostrar a quem ainda não contratou (empty state que vende)
     gatilhos    palavras no chat que fazem a vitrine sugerir o sistema

   O Envio do mês NÃO é sistema: é parte do portal, sempre aberto
   para todo cliente (id interno "checklist" só nos registros).

   Tudo se edita no painel (Conteúdo do portal › Sistemas): textos,
   cor, ícone, público, endereço, e sistemas novos criados lá. Fica em
   conteudo/catalogo e passa por CATALOGO.aplicar(), campo a campo.
   ============================================================ */
(function (global) {
  "use strict";
  var U = global.U;

  var SISTEMAS_PADRAO = [
    {
      id: "ponto",
      nome: "Ponto Totali",
      tagline: "Ponto digital no celular do funcionário",
      desc: "Registro de jornada com foto e localização, espelho de ponto automático e integração direta com a folha da Totali.",
      beneficios: ["Espelho de ponto pronto para a folha", "Horas extras e banco de horas calculados", "Conforme a Portaria 671"],
      cor: "#1d4ed8", icone: "clock", modo: "embutido", url: "", status: "disponivel", publico: ["com-funcionarios"],
      prova: 0,
      previa: { titulo: "Como funciona o Ponto", texto: "O funcionário bate o ponto pelo celular. Você acompanha atrasos e horas extras em tempo real. A Totali recebe o espelho direto na folha.", itens: ["Registro com foto e GPS", "Ajustes com justificativa", "Relatório mensal em PDF"] },
      gatilhos: ["ponto", "hora extra", "banco de horas", "jornada", "atraso"]
    },
    {
      id: "rh360",
      nome: "RH 360",
      tagline: "Admissão, férias e rescisão sem papel",
      desc: "O ciclo completo do colaborador: admissão digital, férias programadas, holerites no celular e avisos de prazo. Em desenvolvimento.",
      beneficios: ["Admissão digital com documentos do funcionário", "Holerite no celular de cada colaborador", "Alertas de férias vencendo"],
      cor: "#7c3aed", icone: "users", modo: "externo", url: "", status: "breve", publico: ["com-funcionarios"],
      prova: 0,
      previa: { titulo: "O que vem no RH 360", texto: "Está em desenvolvimento. Quem entrar na lista de espera ganha os primeiros meses e ajuda a definir o que vem primeiro.", itens: ["Admissão pelo celular", "Férias com aviso automático", "Holerites e informe de rendimentos"] },
      gatilhos: ["admiss", "férias", "ferias", "holerite", "contratar", "funcionário novo"]
    },
    {
      id: "precify",
      nome: "Precify",
      tagline: "Preço certo, margem visível",
      desc: "Calcula o preço de venda de produtos e serviços a partir de custos, impostos do seu regime e a margem que você quer.",
      beneficios: ["Impostos do Simples já dentro da conta", "Margem por produto e por serviço", "Simulações lado a lado"],
      cor: "#b45309", icone: "calculator", modo: "externo", url: "", status: "disponivel", publico: ["todos"],
      prova: 0,
      previa: { titulo: "Como o Precify calcula", texto: "Você informa custo, despesas e a margem que quer. O Precify aplica os impostos do seu regime e mostra o preço mínimo e o preço sugerido.", itens: ["Custo + impostos + margem = preço", "Compare dois cenários", "Exporte a tabela de preços"] },
      gatilhos: ["preço", "preco", "precifica", "margem", "quanto cobrar"]
    },
    {
      id: "gerescisao",
      nome: "GE Rescisão",
      tagline: "Simule a rescisão antes de decidir",
      desc: "Calcula verbas rescisórias por tipo de desligamento, com aviso prévio, multa do FGTS e projeção do custo total.",
      beneficios: ["Valor da rescisão antes de demitir", "Compara os tipos de desligamento", "Relatório para levar à reunião"],
      cor: "#b91c1c", icone: "briefcase", modo: "externo", url: "", status: "disponivel", publico: ["com-funcionarios"],
      prova: 0,
      previa: { titulo: "Quanto custa uma rescisão", texto: "Uma rescisão calculada errada custa caro em multa e em processo. O GE Rescisão mostra o valor por tipo de desligamento em um minuto.", itens: ["Sem justa causa, acordo, pedido de demissão", "Aviso prévio indenizado ou trabalhado", "Multa de 40% do FGTS"] },
      gatilhos: ["demiss", "demitir", "rescis", "desligar", "mandar embora", "aviso prévio"]
    },
    {
      id: "academy",
      nome: "Academy",
      tagline: "Aprenda a tirar mais da sua contabilidade",
      desc: "Trilhas curtas em vídeo: notas fiscais, guias do mês, pró-labore, contratação. Feitas pela Totali para os clientes da Totali.",
      beneficios: ["Aulas de 3 a 5 minutos", "Trilhas por assunto", "Certificado de conclusão"],
      cor: "#c89d57", icone: "graduation", modo: "embutido", url: "https://cliente.totalicontabilidade.com.br/", status: "disponivel", publico: ["todos"],
      prova: 0,
      previa: { titulo: "Primeira aula liberada", texto: "A trilha 'Primeiros passos com a Totali' é aberta para todo cliente. As demais entram com a contratação.", itens: ["Emissão de notas fiscais", "Guias e impostos do mês", "Pró-labore e distribuição de lucros"] },
      gatilhos: ["como emitir", "como faço", "aprender", "curso", "vídeo"]
    },
    {
      id: "agencia100k",
      nome: "Agência 100K",
      tagline: "Produção e custo-hora para agências",
      desc: "Do pedido ao publicado: quadro de produção, tempo por peça, custo-hora da equipe e margem por cliente.",
      beneficios: ["Quadro de produção com 9 etapas", "Custo-hora e margem por cliente", "Portal de aprovação para o cliente da agência"],
      cor: "#182c43", icone: "puzzle", modo: "externo", url: "", status: "disponivel", publico: ["agencias"],
      prova: 0,
      previa: { titulo: "Para agências de marketing", texto: "Se a sua empresa produz conteúdo para clientes, o Agência 100K mostra quanto custa cada peça e qual cliente dá margem.", itens: ["Quadro kanban", "Cronômetro por demanda", "Relatório de margem"] },
      gatilhos: ["agência", "agencia", "peça", "social media", "marketing"]
    }
  ];

  var PERFIS = [
    { id: "todos", rotulo: "Todas as empresas" },
    { id: "com-funcionarios", rotulo: "Empresas com funcionários" },
    { id: "agencias", rotulo: "Agências de marketing" }
  ];

  /* Campanhas de vitrine padrão. A equipe cria as suas no painel
     (coleção vitrine); estas só existem para o portal nunca abrir
     vazio. Regras: uma por vez, no máximo 2 impressões por
     campanha por pessoa, some ao fechar por 14 dias. */
  var VITRINE_PADRAO = [
    { id: "v-ponto", sistemaId: "ponto", titulo: "Chega de folha de ponto em papel", texto: "Seus funcionários batem o ponto pelo celular e a Totali recebe o espelho direto na folha. Sem retrabalho, sem rasura.", cta: "Ver como funciona", publico: "sem-sistema", ativo: true, prioridade: 2 },
    { id: "v-gerescisao", sistemaId: "gerescisao", titulo: "Vai desligar alguém? Simule antes.", texto: "Uma rescisão errada custa multa e processo. Veja o valor de cada tipo de desligamento em um minuto.", cta: "Simular uma rescisão", publico: "sem-sistema", ativo: true, prioridade: 3, gatilho: true },
    { id: "v-precify", sistemaId: "precify", titulo: "Seu preço cobre os impostos?", texto: "O Precify calcula o preço mínimo com os impostos do seu regime e a margem que você quer.", cta: "Calcular meu preço", publico: "sem-sistema", ativo: true, prioridade: 4 },
    { id: "v-academy", sistemaId: "academy", titulo: "Aula liberada: como emitir nota sem errar o imposto", texto: "5 minutos que evitam a multa mais comum de quem começa a emitir nota.", cta: "Assistir agora", publico: "todos", ativo: true, prioridade: 5 }
  ];

  var SISTEMAS = SISTEMAS_PADRAO.map(function (s) { return U.clonar(s); });
  var VITRINE = VITRINE_PADRAO.map(function (v) { return U.clonar(v); });

  function por(id) { for (var i = 0; i < SISTEMAS.length; i++) if (SISTEMAS[i].id === id) return SISTEMAS[i]; return null; }

  /* Sobrescreve com o que a equipe publicou (conteudo/catalogo). Só
     campos conhecidos, saneados; o resto fica no padrão. */
  var ID_OK = /^[a-z0-9][a-z0-9-]{1,29}$/, RESERVADOS = ["checklist", "portal", "previa"];
  function linhas(x, max, n) { return (Array.isArray(x) ? x : []).map(function (t) { return U.txt(t, max); }).filter(Boolean).slice(0, n); }
  function aplicar(bruto) {
    if (!bruto || typeof bruto !== "object") return false;
    var lista = Array.isArray(bruto.sistemas) ? bruto.sistemas : [];
    lista.forEach(function (b) {
      if (!b || !ID_OK.test(String(b.id || "")) || RESERVADOS.indexOf(b.id) > -1) return;
      var s = por(b.id);
      if (!s) {
        /* sistema criado pela equipe no painel */
        if (!U.txt(b.nome, 40)) return;
        s = { id: b.id, nome: "", tagline: "", desc: "", beneficios: [], cor: "#475569", icone: "grid", modo: "externo", url: "", status: "disponivel", publico: ["todos"], prova: 0, previa: { titulo: "", texto: "", itens: [] }, gatilhos: [], proprio: true };
        SISTEMAS.push(s);
      }
      if (typeof b.nome === "string") s.nome = U.txt(b.nome, 40, s.nome);
      if (typeof b.cor === "string" && /^#[0-9a-f]{6}$/i.test(b.cor)) s.cor = b.cor;
      if (typeof b.icone === "string" && global.ic && global.ic.tem(b.icone)) s.icone = b.icone;
      if (Array.isArray(b.publico)) { var pub = b.publico.filter(function (x) { return PERFIS.some(function (q) { return q.id === x; }); }); if (pub.length) s.publico = pub; }
      if (b.previa && typeof b.previa === "object") s.previa = { titulo: U.txt(b.previa.titulo, 80), texto: U.txt(b.previa.texto, 400), itens: linhas(b.previa.itens, 80, 6) };
      if (Array.isArray(b.gatilhos)) s.gatilhos = b.gatilhos.map(function (g) { return U.txt(String(g).toLowerCase(), 30); }).filter(Boolean).slice(0, 15);
      if (typeof b.oculto === "boolean") s.oculto = b.oculto;
      if (b.logo === null) s.logo = null;
      else if (b.logo && typeof b.logo.url === "string" && /^(https:\/\/|data:image\/(png|jpeg|webp);)/.test(b.logo.url)) s.logo = { url: b.logo.url, path: U.txt(b.logo.path, 200) };
      if (typeof b.url === "string") s.url = U.urlSegura(b.url);
      if (b.status === "disponivel" || b.status === "breve") s.status = b.status;
      if (typeof b.prova === "number" && b.prova >= 0) s.prova = Math.round(b.prova);
      if (typeof b.tagline === "string") s.tagline = U.txt(b.tagline, 80, s.tagline);
      if (typeof b.desc === "string") s.desc = U.txt(b.desc, 300, s.desc);
      if (Array.isArray(b.beneficios)) s.beneficios = linhas(b.beneficios, 80, 6);
      if (b.modo === "embutido" || b.modo === "externo") s.modo = b.modo;
    });
    if (Array.isArray(bruto.vitrine)) {
      var v = bruto.vitrine.map(function (c, i) {
        if (!c || !por(c.sistemaId)) return null;
        return {
          id: U.txt(c.id, 40, "v" + i), sistemaId: c.sistemaId,
          titulo: U.txt(c.titulo, 90), texto: U.txt(c.texto, 240), cta: U.txt(c.cta, 40, "Conhecer"),
          publico: ["todos", "sem-sistema"].indexOf(c.publico) > -1 ? c.publico : "sem-sistema",
          empresas: Array.isArray(c.empresas) ? c.empresas.map(String).slice(0, 500) : null,
          ativo: c.ativo !== false, prioridade: Number(c.prioridade) || 9, gatilho: c.gatilho === true,
          inicio: U.ms(c.inicio), fim: U.ms(c.fim)
        };
      }).filter(function (x) { return x && x.titulo; });
      if (v.length) { VITRINE.length = 0; v.forEach(function (x) { VITRINE.push(x); }); }
    }
    return true;
  }

  /* Setores da Totali: cada empresa tem um responsável por setor (responsaveis{ setor: {uid, nome} }) */
  var SETORES = [["fiscal", "Fiscal"], ["contabil", "Contábil"], ["trabalhista", "Dep. Pessoal"], ["societario", "Societário"], ["financeiro", "Financeiro"]];
  function responsaveis(e) {
    var r = (e && e.responsaveis) || {};
    return SETORES.filter(function (s) { return r[s[0]] && r[s[0]].nome; }).map(function (s) { return { setor: s[0], rotulo: s[1], uid: r[s[0]].uid || "", nome: r[s[0]].nome }; });
  }
  function responsaveisTexto(e) { return responsaveis(e).map(function (x) { return x.nome + " - " + x.rotulo; }).join(", "); }

  global.CATALOGO = {
    SISTEMAS: SISTEMAS,
    SETORES: SETORES,
    responsaveis: responsaveis,
    responsaveisTexto: responsaveisTexto,
    SISTEMAS_PADRAO: SISTEMAS_PADRAO,
    VITRINE: VITRINE,
    PERFIS: PERFIS,
    por: por,
    aplicar: aplicar,
    /* selo do sistema: a logo enviada pela equipe ou, sem logo, o ícone na cor do sistema */
    selo: function (s, cls) {
      var logo = s && s.logo && s.logo.url;
      return '<span class="selo-sistema' + (cls ? " " + cls : "") + (logo ? " selo-sistema--logo" : "") + '" style="background:' + (logo ? "#fff" : U.esc(s.cor)) + '">' + (logo ? '<img src="' + U.esc(logo) + '" alt="">' : global.ic(s.icone, cls && cls.indexOf("sm") > -1 ? "ic--sm" : "")) + "</span>";
    },
    /* o que o cliente vê (sistemas ocultos pela equipe ficam fora da vitrine, da lista e dos banners) */
    visiveis: function () { return SISTEMAS.filter(function (s) { return !s.oculto; }); },
    /* sistema criado pela equipe, excluído no painel */
    remover: function (id) { for (var i = SISTEMAS.length - 1; i >= 0; i--) if (SISTEMAS[i].id === id && SISTEMAS[i].proprio) SISTEMAS.splice(i, 1); },
    /* Sistemas que fazem sentido para o perfil desta empresa */
    paraPerfil: function (perfis) {
      perfis = perfis && perfis.length ? perfis : ["todos"];
      return SISTEMAS.filter(function (s) {
        return !s.oculto && s.publico.indexOf("todos") > -1 || s.publico.some(function (p) { return perfis.indexOf(p) > -1; });
      });
    }
  };
})(window);
