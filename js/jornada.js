/* ============================================================
   Totali · Portal do Cliente
   jornada.js — a jornada de onboarding de 30 dias (D e P)

   ORIGEM: o treinamento "Jornada do cliente no onboarding",
   transcrito no Academy em 16/09/2026 (js/data.js, JORNADA_PADRAO).
   Aqui ele ganha DOIS LADOS, porque o portal tem dois públicos:

     equipe   os passos que a Totali executa (o procedimento interno,
              igual ao do Academy). O cliente NÃO vê estes.
     cliente  os passos que o CLIENTE faz no portal. É o que ele vê
              como "D1 · P2". Foram derivados de cada etapa: o que a
              equipe pede, o cliente entrega.

   Nomenclatura pedida pelo Raoni em 21/09/2026: dias como D0, D1,
   D2… e passos como P1, P2, P3… dentro de cada dia.

   `dia` conta a partir do aceite da proposta. `marco` marca os
   três momentos que decidem a percepção do cliente (D0, D15, D30).

   ENDOWED PROGRESS (pesquisa, tema 1, item 1): o D0 nasce
   concluído para o cliente — "Proposta aceita e cadastro criado
   pela Totali" é um passo real que já aconteceu. A barra começa
   em ~12%, não em zero.

   `auto` liga um passo a um fato que o sistema já conhece. Quando
   o fato é verdadeiro, o passo aparece marcado "pelo sistema".
   O catálogo de fatos está em AUTOMACOES.

   O painel pode editar tudo isto em Conteúdo › Jornada; o que vier
   do banco passa por JORNADA.aplicar() e substitui o padrão.
   ============================================================ */
(function (global) {
  "use strict";
  var U = global.U;

  var PADRAO = [
    {
      id: "d0", dia: 0, marco: true,
      titulo: "Boas-vindas",
      objetivo: "A Totali liga nas duas primeiras horas depois do aceite. É o gesto de maior impacto e menor custo de todo o processo.",
      quem: "Sócio responsável e/ou gerente de contas",
      cliente: [
        { texto: "Proposta aceita e cadastro criado pela Totali", auto: "cadastro" },
        { texto: "Receber a ligação de boas-vindas e conhecer seu gerente de contas", auto: "gerente" }
      ],
      equipe: [
        { texto: "Registre o cliente no painel e classifique a trilha (A, B ou C).", auto: "cadastro" },
        { texto: "Defina o gerente de contas no cadastro do cliente e comunique internamente.", auto: "gerente" },
        { texto: "Ligue. Não mande mensagem primeiro: ligue." },
        { texto: "Apresente o gerente pelo nome e diga o que vem a seguir." },
        { texto: "Agende a reunião de boas-vindas ainda nessa ligação." },
        { texto: "Mande um WhatsApp curto confirmando o combinado." }
      ],
      erro: "Sumir depois do aceite. O silêncio entre a assinatura e o primeiro contato é onde nasce o arrependimento."
    },
    {
      id: "d1", dia: 1,
      titulo: "Kit de boas-vindas e abertura do canal",
      objetivo: "Você recebe, por escrito, tudo o que precisa para não ficar em dúvida sobre nada.",
      quem: "Gerente de contas, com apoio da implantação",
      cliente: [
        { texto: "Entrar no portal pelo convite e criar sua senha", auto: "entrou" },
        { texto: "Escolher como prefere falar com a gente (WhatsApp, portal ou telefone)", auto: "canal" },
        { texto: "Conferir os dados da empresa e avisar se algo estiver errado" },
        { texto: "Conhecer quem cuida da sua empresa na tela Minha equipe" }
      ],
      equipe: [
        { texto: "Envie o convite do portal: é o kit de boas-vindas, com quem é quem, canais, horários e o passo a passo dos 30 dias.", auto: "convite" },
        { texto: "Confirme o canal preferido do cliente. Ele escolhe no perfil do portal; se não escolher, pergunte antes de criar um grupo.", auto: "canal" },
        { texto: "Combine horário de atendimento e prazo de resposta." },
        { texto: "Confira que o cliente entrou no portal.", auto: "entrou" }
      ],
      erro: "Enviar a lista de documentos em partes, conforme alguém lembra. Adicionar o cliente em um grupo com dez pessoas da firma que ele nunca viu."
    },
    {
      id: "d2", dia: 2,
      titulo: "Reunião de boas-vindas",
      objetivo: "Entendemos o seu negócio e saímos com um plano combinado, não apenas apresentado.",
      quem: "Gerente de contas. Sócio nas trilhas B e C",
      cliente: [
        { texto: "Participar da reunião de boas-vindas (30 min)" },
        { texto: "Contar qual é a maior dor da sua empresa hoje: ela vira a primeira entrega de valor" },
        { texto: "Combinar uma data para cada pendência" }
      ],
      equipe: [
        { texto: "Prepare-se antes: leia a proposta e pesquise a empresa." },
        { texto: "Abra pelo cliente, não pela firma. Pergunte do negócio dele." },
        { texto: "Escute a experiência anterior. Ali está o que ele valoriza." },
        { texto: "Descubra a maior dor atual. Ela vira a entrega de valor do D15. Anote na ficha." },
        { texto: "Saia com uma data acordada para cada pendência." }
      ],
      erro: "Falar da firma nos primeiros quinze minutos. O cliente já contratou: ele não precisa mais ser convencido, precisa ser ouvido."
    },
    {
      id: "d5", dia: 5,
      titulo: "Documentos, acessos e autorizações",
      objetivo: "Reunimos tudo o que é necessário para operar, com o menor esforço possível para você.",
      quem: "Analista de implantação, ou o gerente acompanhando",
      cliente: [
        { texto: "Enviar o certificado digital (arquivo A1 ou dados do A3)", auto: "certificado" },
        { texto: "Guardar as senhas dos portais (Simples, SEFAZ, Empregador Web) no cofre do portal", auto: "senhas" },
        { texto: "Autorizar a Totali no e-CAC da Receita Federal (a gente manda o passo a passo)" },
        { texto: "Enviar os documentos que só você tem (sócios, contrato, alvará)", auto: "documentos" }
      ],
      equipe: [
        { texto: "Trabalhe na mesma lista já enviada. Não crie listas novas." },
        { texto: "Confira o certificado digital recebido: tipo (A1 ou A3), titularidade e validade.", auto: "certificado" },
        { texto: "Oriente a autorização de acesso no e-CAC da Receita Federal." },
        { texto: "Valide a autorização: ela cai sozinha se não for confirmada em 30 dias." },
        { texto: "Obtenha os demais acessos e confirme o Domicílio Tributário Eletrônico." },
        { texto: "Confira que o aviso automático de pendências está ligado." }
      ],
      erro: "Deixar a validação da autorização de acesso para depois. Perdido o prazo, todo o processo recomeça e o cliente percebe."
    },
    {
      id: "d8", dia: 8,
      titulo: "Transição do contador anterior",
      objetivo: "Assumimos a responsabilidade técnica sem lacunas e sem colocar você no meio de um conflito.",
      quem: "Sócio responsável e/ou gerente",
      cliente: [
        { texto: "Informar o contato da contabilidade anterior (a gente fala com eles, você não precisa cobrar)" },
        { texto: "Enviar o distrato do contrato anterior, se houver" },
        { texto: "Assinar o Termo de Transferência de Responsabilidade Técnica" }
      ],
      equipe: [
        { texto: "Confirme se houve distrato por escrito do contrato anterior." },
        { texto: "Formalize o Termo de Transferência de Responsabilidade Técnica." },
        { texto: "Mande o link de envio para a contabilidade anterior e registre o que chegar.", auto: "anterior" },
        { texto: "Conduza a conversa entre profissionais, com cortesia." },
        { texto: "Levante obrigações em atraso, débitos e parcelamentos." },
        { texto: "Conclua a migração na ficha: é assim que o cliente vê a transição encerrada.", auto: "migracao" }
      ],
      erro: "Criticar o contador anterior. Pedir que o próprio cliente cobre os documentos do profissional anterior."
    },
    {
      id: "d12", dia: 12,
      titulo: "Implantação técnica",
      objetivo: "A operação fica pronta e você recebe um diagnóstico honesto da situação encontrada.",
      quem: "Contábil, fiscal e folha, coordenados pelo gerente",
      cliente: [
        { texto: "Nada a fazer: a Totali está implantando sua empresa. Você recebe o diagnóstico em uma página." },
        { texto: "Ler o diagnóstico e tirar dúvidas pelo chat" }
      ],
      equipe: [
        { texto: "Cadastre a empresa com dados societários conferidos." },
        { texto: "Importe e concilie os saldos com os últimos balancetes." },
        { texto: "Analise o regime tributário e registre o resultado." },
        { texto: "Implante a folha e configure o calendário de obrigações." },
        { texto: "Levante pendências, riscos e divergências." },
        { texto: "Escreva o diagnóstico em uma página, para o cliente ler, e publique no portal." }
      ],
      erro: "Entregar o diagnóstico em linguagem técnica. Guardar más notícias para não desagradar: o problema aparece depois, com juros de confiança."
    },
    {
      id: "d15", dia: 15, marco: true,
      titulo: "A primeira entrega de valor",
      objetivo: "Um ganho concreto que você consiga perceber e contar para alguém.",
      quem: "Gerente de contas, com a área técnica",
      cliente: [
        { texto: "Receber a primeira entrega de valor: a solução da dor que você contou no D2" },
        { texto: "Conferir o resultado e dizer se fez sentido" }
      ],
      equipe: [
        { texto: "Retome a dor principal que ele relatou na reunião de D2." },
        { texto: "Escolha algo rápido e visível. Não precisa ser grande." },
        { texto: "Execute e confira antes de comunicar." },
        { texto: "Comunique em benefício, não em tarefa: quanto economizou, quanto tempo poupou." },
        { texto: "Se não houver ganho financeiro, entregue tranquilidade." }
      ],
      erro: "Deixar a primeira entrega de valor para depois do primeiro fechamento. No D30 o cliente já formou a opinião."
    },
    {
      id: "d20", dia: 20,
      titulo: "Sua rotina com a Totali",
      objetivo: "Você aprende a trabalhar com a gente, para a rotina fluir sem atrito.",
      quem: "Gerente de contas",
      cliente: [
        { texto: "Assistir à trilha 'Primeiros passos com a Totali' no Academy (12 min)", auto: "trilha" },
        { texto: "Escolher como quer receber os relatórios do mês", auto: "relatorios" },
        { texto: "Guardar o calendário do mês: o que enviar e quando" },
        { texto: "Saber quem procurar quando seu gerente não estiver" }
      ],
      equipe: [
        { texto: "Explique o ciclo mensal: o que ele envia, o que recebe e quando." },
        { texto: "Entregue o calendário de rotina em uma página." },
        { texto: "Treine o envio dos relatórios. O cliente escolhe a forma no portal.", auto: "relatorios" },
        { texto: "Ensine a ler o que recebe. Relatório não explicado é papel." },
        { texto: "Combine o que é urgência de verdade e como acioná-la." },
        { texto: "Diga quem procurar na sua ausência, com nome e contato." }
      ],
      erro: "Presumir que o cliente já sabe como funciona. Ele conhecia o método do contador anterior, não o seu."
    },
    {
      id: "d30", dia: 30, marco: true,
      titulo: "Fechamento dos 30 dias",
      objetivo: "Você avalia os 30 dias. Acontece mesmo que esteja tudo perfeito. Principalmente se estiver.",
      quem: "Gerente de contas e sócio responsável",
      cliente: [
        { texto: "Responder ao feedback dos 30 dias (uma pergunta aberta, 2 minutos)", auto: "feedback" },
        { texto: "Ver o resumo do que foi feito no seu primeiro mês" }
      ],
      equipe: [
        { texto: "Peça o feedback pelo portal, com pergunta aberta, e cale-se para ouvir.", auto: "feedback" },
        { texto: "Publique o resumo do mês para o cliente (peak-end: a jornada termina bem)." }
      ],
      erro: "Transformar a conversa em apresentação da firma, sem espaço real para o cliente falar."
    }
  ];

  /* Fatos que o sistema conhece e marca sozinho. Quem avalia é
     JORNADA.autoCumprida(contexto, id); aqui é só o catálogo. */
  var AUTOMACOES = [
    { id: "cadastro", rotulo: "Cadastro criado pela Totali", como: "Verdadeiro assim que a empresa existe no painel." },
    { id: "gerente", rotulo: "Gerente de contas definido", como: "Marca quando a empresa tem gerente no cadastro." },
    { id: "convite", rotulo: "Convite do portal gerado", como: "Marca quando existe convite ou acesso ao portal." },
    { id: "entrou", rotulo: "O cliente entrou no portal", como: "Marca no primeiro acesso do cliente." },
    { id: "canal", rotulo: "Canal preferido informado", como: "Marca quando o cliente escolhe o canal no perfil." },
    { id: "certificado", rotulo: "Certificado digital recebido", como: "Marca quando há documento do grupo 'certificado' enviado ou aprovado." },
    { id: "senhas", rotulo: "Senhas guardadas no cofre", como: "Marca quando há pelo menos uma credencial cifrada." },
    { id: "documentos", rotulo: "Documentos do cliente enviados", como: "Marca quando o cliente enviou pelo menos 3 documentos." },
    { id: "anterior", rotulo: "Arquivos da contabilidade anterior recebidos", como: "Marca no primeiro arquivo enviado pelo link da contabilidade anterior." },
    { id: "migracao", rotulo: "Migração concluída no painel", como: "Marca quando alguém conclui a migração na ficha." },
    { id: "trilha", rotulo: "Trilha 'Primeiros passos' assistida", como: "Marca quando o cliente abre o Academy pelo portal." },
    { id: "relatorios", rotulo: "Forma de receber relatórios escolhida", como: "Marca quando o cliente escolhe no perfil." },
    { id: "feedback", rotulo: "Feedback dos 30 dias respondido", como: "Marca quando o cliente responde à pergunta aberta." }
  ];

  var TRILHAS = {
    A: "Empresa simples: MEI ou Simples Nacional, sem funcionários, um sócio. O gerente de contas conduz tudo.",
    B: "Empresa com folha de pagamento, ou do Lucro Presumido, ou com mais de um sócio. O sócio responsável entra na reunião de boas-vindas e na primeira entrega de valor.",
    C: "Lucro Real, mais de uma empresa, transição com pendências fiscais ou faturamento grande. O sócio responsável acompanha a jornada inteira."
  };

  var DIAS = PADRAO.map(function (d) { return U.clonar(d); });

  function saneiaPasso(t) {
    var texto = typeof t === "string" ? U.txt(t, 240) : U.txt(t && t.texto, 240);
    if (!texto) return null;
    var ids = AUTOMACOES.map(function (a) { return a.id; });
    var auto = (t && typeof t === "object" && ids.indexOf(t.auto) > -1) ? t.auto : "";
    return auto ? { texto: texto, auto: auto } : { texto: texto };
  }

  function aplicar(bruto) {
    if (!bruto || !Array.isArray(bruto.dias)) return false;
    var lista = bruto.dias.slice(0, 20).map(function (d, i) {
      if (!d || typeof d !== "object") return null;
      var titulo = U.txt(d.titulo, 80); if (!titulo) return null;
      var dia = Number(d.dia); if (!isFinite(dia) || dia < 0 || dia > 120) dia = i;
      return {
        id: (U.txt(d.id, 30) || "d" + i).replace(/[^a-zA-Z0-9_-]/g, "") || "d" + i,
        dia: Math.round(dia), marco: d.marco === true,
        titulo: titulo, objetivo: U.txt(d.objetivo, 300), quem: U.txt(d.quem, 120),
        cliente: (Array.isArray(d.cliente) ? d.cliente : []).map(saneiaPasso).filter(Boolean).slice(0, 12),
        equipe: (Array.isArray(d.equipe) ? d.equipe : []).map(saneiaPasso).filter(Boolean).slice(0, 12),
        erro: U.txt(d.erro, 600)
      };
    }).filter(Boolean);
    if (!lista.length) return false;
    lista.sort(function (a, b) { return a.dia - b.dia; });
    DIAS.length = 0; lista.forEach(function (d) { DIAS.push(d); });
    return true;
  }

  /* ---------- Cálculo de estado ----------
     `andamento` é o documento empresas/{id}.jornada:
       { aceiteEm, passos: { "d1.c.2": {em, por}, "d1.e.1": {...} }, notas: {d2: "..."}, concluidos: {d1: em} }
     lado: "cliente" (c) ou "equipe" (e). */
  function chave(diaId, lado, i) { return diaId + "." + (lado === "cliente" ? "c" : "e") + "." + i; }

  function passoFeito(andamento, autoFn, diaId, lado, i, passo) {
    var p = ((andamento || {}).passos || {})[chave(diaId, lado, i)];
    if (p && p.em) return { feito: true, em: p.em, por: p.por || "", auto: false };
    if (passo.auto && autoFn && autoFn(passo.auto)) return { feito: true, em: 0, por: "sistema", auto: true };
    return { feito: false };
  }

  function prazo(andamento, d) {
    var base = U.ms((andamento || {}).aceiteEm);
    return base ? base + d.dia * U.DIA_MS : 0;
  }

  function estadoDia(andamento, autoFn, d, lado) {
    var passos = d[lado] || [];
    var feitos = passos.filter(function (p, i) { return passoFeito(andamento, autoFn, d.id, lado, i, p).feito; }).length;
    var total = passos.length;
    var pz = prazo(andamento, d);
    var dias = pz ? U.diasEntre(pz, Date.now()) : -999;   /* >0: já passou */
    var estado;
    if (total && feitos === total) estado = "feito";
    else if (!pz) estado = "futuro";
    else if (dias > 0) estado = "atrasado";
    else if (dias === 0) estado = "hoje";
    else estado = "futuro";
    return { id: d.id, dia: d.dia, feitos: feitos, total: total, prazo: pz, estado: estado, diasAtraso: Math.max(0, dias) };
  }

  function resumo(andamento, autoFn, lado) {
    var lista = DIAS.map(function (d) { return estadoDia(andamento, autoFn, d, lado); });
    var total = U.soma(lista, function (x) { return x.total; });
    var feitos = U.soma(lista, function (x) { return x.feitos; });
    var atual = null;
    for (var i = 0; i < lista.length; i++) { if (lista[i].estado !== "feito") { atual = lista[i]; break; } }
    if (atual && atual.estado === "futuro" && i === 0) atual.estado = "atual";
    if (atual && atual.estado === "futuro") atual.estado = "atual";
    var diaAtualNum = andamento && U.ms(andamento.aceiteEm) ? U.diasEntre(andamento.aceiteEm, Date.now()) : 0;
    var proximo = null;
    if (atual) {
      var d = DIAS.filter(function (x) { return x.id === atual.id; })[0];
      (d[lado] || []).some(function (p, idx) {
        if (!passoFeito(andamento, autoFn, d.id, lado, idx, p).feito) { proximo = { dia: d, indice: idx, passo: p, rotulo: "D" + d.dia + " · P" + (idx + 1) }; return true; }
        return false;
      });
    }
    return { dias: lista, total: total, feitos: feitos, pct: U.pct(feitos, total), atual: atual, proximo: proximo, diaHoje: diaAtualNum, concluida: total > 0 && feitos === total, atrasados: lista.filter(function (x) { return x.estado === "atrasado"; }).length };
  }

  global.JORNADA = {
    DIAS: DIAS, PADRAO: PADRAO, AUTOMACOES: AUTOMACOES, TRILHAS: TRILHAS,
    aplicar: aplicar, chave: chave, passoFeito: passoFeito, prazo: prazo, estadoDia: estadoDia, resumo: resumo,
    por: function (id) { return DIAS.filter(function (d) { return d.id === id; })[0] || null; }
  };
})(window);
