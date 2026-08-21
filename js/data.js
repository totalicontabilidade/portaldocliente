/* ============================================================
   Totali · Portal de Onboarding
   data.js — conteúdo do sistema (catálogo de documentos, etapas,
   trilhas da Academy e perguntas frequentes).

   Este arquivo é só CONTEÚDO. Nenhuma lógica, nenhum dado de
   cliente. Para incluir/remover um documento do checklist,
   edite apenas aqui.
   ============================================================ */
(function (global) {
  "use strict";

  /* ---------- Identidade da contabilidade ---------- */
  var ORG_PADRAO = {
    nome: "Totali Soluções Contábeis",
    curto: "Totali",
    email: "cadastro@totalicontabilidade.com.br",
    telefoneExibicao: "(79) 99841-2107",
    whatsapp: "5579998412107",
    site: "https://www.totalicontabilidade.com.br",
    instagram: "totalicontabilidade",
    horario: "Segunda a sexta, das 7h às 17h",

    /* Localização do escritório. As coordenadas vieram do link
       do Google Maps e são o que o mapa e a rota usam. */
    local: {
      nome: "Totali Soluções Contábeis",
      endereco: "Rua Juca Monteiro, 891 — Anísio Amâncio de Oliveira",
      cidade: "Itabaiana · SE",
      cep: "49503-390",
      lat: -10.6945945,
      lng: -37.4257312,
      link: "https://maps.app.goo.gl/mUHXTmtfmB8GYgzr8"
    }
  };

  /* ---------- Etapas do onboarding ----------
     `rota` é para onde a etapa leva quando o cliente toca nela.
     Sem rota, a etapa é informativa (depende da Totali).
  ------------------------------------------- */
  var ETAPAS = [
    {
      id: "boas-vindas",
      titulo: "Boas-vindas",
      desc: "Você conhece como funciona a Totali e quem cuida da sua empresa.",
      rota: "inicio"
    },
    {
      id: "cadastro",
      titulo: "Dados da empresa",
      desc: "Confirmamos as informações básicas e quem é o responsável pelo contato.",
      rota: "empresa",
      acao: "Completar cadastro"
    },
    {
      id: "documentos",
      titulo: "Envio de documentos",
      desc: "Você envia a documentação da lista. Pode fazer aos poucos — nada se perde.",
      rota: "documentos",
      acao: "Enviar documentos"
    },
    {
      id: "financeiro",
      titulo: "Bancos e maquininhas",
      desc: "Onde a empresa movimenta dinheiro e como vamos receber os relatórios de venda.",
      rota: "financeiro",
      acao: "Responder"
    },
    {
      id: "analise",
      titulo: "Análise da Totali",
      desc: "Nossa equipe confere tudo e avisa se faltar alguma coisa."
    },
    {
      id: "ativo",
      titulo: "Contabilidade ativa",
      desc: "Migração concluída. A partir daqui a Academy passa a ser o seu ponto de apoio."
    }
  ];

  /* ---------- Financeiro ----------
     Conteúdo trazido do sistema "checklist financeiro" da Totali
     (github.com/totalicontabilidade/checklist-financeiro), que
     deixa de ter link próprio e passa a ser uma etapa daqui.
  --------------------------------- */
  /* Catálogo de bancos e maquininhas.

     Trazido do checklist financeiro na atualização de 2026-08-18.
     Lá as listas deixaram de ser texto puro e ganharam duas coisas
     que mudam o que o cliente vê:

       orientacao     passo a passo de como liberar o acesso naquela
                      instituição. Só aparece para o que o cliente
                      marcou — orientação de banco que ele não usa é
                      ruído.

       semCredencial  a operadora libera o contador por dentro do
                      próprio aplicativo ("Modo Contador"). Nesses
                      casos NÃO existe login e senha para digitar:
                      o cliente confirma que fez o cadastro e
                      acabou. Pedir senha de quem não tem senha é
                      o tipo de campo que trava o formulário.

     Continua aceitando texto puro na lista: `normalizarCatalogo`
     converte, então conteúdo antigo não quebra. */
  var BANCOS = [
    { nome: "Banco do Brasil" }, { nome: "Banco do Nordeste" }, { nome: "Banese" },
    { nome: "Bradesco" }, { nome: "C6 Bank" }, { nome: "Caixa Econômica" },
    { nome: "Cora" }, { nome: "InfinitePay" }, { nome: "Inter" }, { nome: "Itaú" },
    { nome: "Mercado Pago" }, { nome: "Nubank" }, { nome: "PagBank" },
    { nome: "Santander" }, { nome: "Sicredi" }, { nome: "Stone" }
  ];

  var MAQUINETAS = [
    { nome: "Cielo" }, { nome: "Getnet" }, { nome: "InfinitePay" },
    { nome: "Mercado Pago" }, { nome: "Mulvi Convênio" }, { nome: "Mulvi Pay" },
    { nome: "PagBank" }, { nome: "Rede" }, { nome: "Stone" }
  ];

  /* Aceita ["Nome"] ou [{nome, orientacao, semCredencial}] e sempre
     devolve o formato de objeto. */
  function normalizarCatalogo(lista, aceitaSemCredencial) {
    if (!Array.isArray(lista)) return [];
    var saida = [];
    lista.slice(0, 60).forEach(function (bruto) {
      var item = typeof bruto === "string" ? { nome: bruto } : (bruto || {});
      var nome = txt(item.nome, 80);
      if (!nome) return;
      var pronto = { nome: nome, orientacao: txt(item.orientacao, 1500) };
      if (aceitaSemCredencial) pronto.semCredencial = item.semCredencial === true;
      saida.push(pronto);
    });
    return saida;
  }

  function nomesDo(lista) {
    return lista.map(function (i) { return i.nome; });
  }

  function acharNoCatalogo(lista, nome) {
    for (var i = 0; i < lista.length; i++) {
      if (lista[i].nome === nome) return lista[i];
    }
    return null;
  }

  /* Os três relatórios que a Totali precisa de cada maquininha,
     todo mês. Mesma lista usada no aviso da tela e no termo de
     compromisso — mudou aqui, muda nos dois lugares. */
  var RELATORIOS_MENSAIS = [
    "Relatório de vendas",
    "Relatório de recebimentos",
    "Relatório de antecipações"
  ];

  /* Por onde o cliente manda esses relatórios. Se um dia o envio
     passar a ser por este portal, troque o texto aqui. */
  var CANAL_RELATORIOS = "pelo Confi";

  /* Textos do compromisso de envio dos relatórios.
     Mesmo conteúdo do sistema checklist financeiro — o que o
     cliente lê na tela e o que sai no termo em PDF precisam
     dizer exatamente a mesma coisa. */
  var COMPROMISSO_PADRAO = {
    titulo: "Combinado.",
    chamada: "Então você se compromete a enviar à Totali, todo mês, " + CANAL_RELATORIOS +
             ", de cada maquininha marcada acima:",
    itens: RELATORIOS_MENSAIS,
    fecho: "Os relatórios são sempre do mês anterior. Sem eles não conseguimos lançar suas " +
           "vendas nem as taxas, e o fechamento do mês fica parado. Se em algum momento ficar " +
           "difícil, é só avisar que a gente troca para o acesso direto."
  };

  /* Termo em PDF gerado ao concluir a etapa. */
  var TERMO_PADRAO = {
    titulo: "Termo de Compromisso",
    subtitulo: "Envio dos relatórios das maquininhas",
    declaracao: "A empresa acima identificada declara que optou por enviar ela mesma os " +
                "relatórios das suas máquinas de cartão, em vez de fornecer à Totali os dados " +
                "de acesso aos portais das operadoras.",
    compromisso: "Assim, a empresa se compromete a encaminhar à Totali Soluções Contábeis, " +
                 "todo mês, " + CANAL_RELATORIOS + ", os documentos abaixo, referentes a cada " +
                 "uma das suas maquininhas e sempre relativos ao MÊS ANTERIOR.",
    itens: RELATORIOS_MENSAIS,
    responsabilidadeTitulo: "Responsabilidade pelos prazos",
    responsabilidade: "Sem o recebimento desses relatórios, a Totali não consegue lançar as " +
                      "vendas nem as taxas do período, e o fechamento do mês fica parado. " +
                      "A empresa está ciente de que atrasos, multas ou penalidades decorrentes " +
                      "da falta de envio dos relatórios são de sua responsabilidade. " +
                      "Se em algum momento o envio se tornar inviável, basta comunicar a Totali " +
                      "para que o modelo seja alterado para o acesso direto aos portais.",
    cienciaTitulo: "Ciência eletrônica",
    ciencia: "Este termo é firmado eletronicamente, dispensando assinatura física, nos termos " +
             "do art. 10, § 2º, da Medida Provisória nº 2.200-2/2001, que reconhece a validade " +
             "de documentos eletrônicos quando admitidos pelas partes como válidos."
  };

  var FORMAS_RELATORIO = [
    {
      id: "envio",
      titulo: "Eu mesmo envio os relatórios todo mês",
      desc: "Você baixa e nos manda o relatório de vendas, o de recebimentos e o de antecipações " +
            "de cada maquininha, todo mês. Ao escolher esta opção, geramos um termo de compromisso " +
            "para você guardar.",
      recomendado: false
    },
    {
      id: "acesso",
      titulo: "Informo o acesso, a Totali baixa sozinha",
      desc: "Você informa login e senha de cada maquininha aqui mesmo. A senha é embaralhada no seu " +
            "aparelho antes de sair, e fica guardada assim. Só a Totali consegue abrir, e toda " +
            "abertura fica registrada. Usamos apenas para baixar os " +
            "relatórios do mês — nunca para movimentar dinheiro.",
      recomendado: true
    }
  ];

  /* ---------- Catálogo de documentos ----------
     kind:
       "arquivo"  → upload de arquivo
       "acesso"   → credencial de sistema (senha cifrada no aparelho)
       "dado"     → informação curta digitada (texto ou seleção)
     escopo:
       "empresa"  → um por empresa
       "socio"    → um por sócio cadastrado
  ------------------------------------------------ */
  var GRUPOS_PADRAO = [
    {
      id: "societario",
      escopo: "empresa",
      icone: "ic-scroll",
      titulo: "Societário",
      desc: "Os documentos que criaram a empresa. É por aqui que confirmamos quem são os sócios, o que a empresa faz e quanto foi investido nela.",
      itens: [
        {
          id: "contrato-social",
          kind: "arquivo",
          nome: "Contrato social e alterações",
          obrigatorio: true,
          resumo: "O documento que criou a empresa e todas as mudanças posteriores.",
          ajuda: {
            oque: "É a certidão de nascimento da empresa. Junto dele vêm as alterações contratuais — cada vez que mudou endereço, sócio, capital ou atividade, foi registrada uma alteração na Junta Comercial.",
            onde: [
              "Peça ao contador anterior — ele tem o arquivo digital.",
              "Ou baixe no portal da Junta Comercial do seu estado (JUCESE, em Sergipe) usando o certificado digital.",
              "Ou envie foto legível da via física registrada, com o carimbo da Junta."
            ],
            dica: "Se você tiver um contrato consolidado (a última alteração que reescreve tudo), ele já substitui os anteriores — envie esse."
          }
        }
      ]
    },

    {
      id: "contabil",
      escopo: "empresa",
      icone: "ic-calculator",
      titulo: "Contábil",
      desc: "A memória contábil da empresa. É o que permite continuar exatamente de onde a contabilidade anterior parou.",
      itens: [
        {
          id: "balancos",
          kind: "arquivo",
          nome: "Balanços patrimoniais anteriores",
          obrigatorio: true,
          resumo: "De preferência dos 2 ou 3 últimos anos já fechados.",
          ajuda: {
            oque: "O balanço mostra, no encerramento de cada ano, tudo que a empresa tem (bens e direitos) e tudo que ela deve (obrigações).",
            onde: ["Com o contador anterior. É ele quem elabora e assina o balanço."],
            dica: "Sem o balanço do ano anterior não conseguimos abrir a contabilidade do ano atual com os saldos corretos. É um dos documentos mais importantes da lista."
          }
        },
        {
          id: "dre",
          kind: "arquivo",
          nome: "DRE de períodos anteriores",
          obrigatorio: true,
          resumo: "O resumo de quanto a empresa vendeu, gastou e lucrou em cada ano.",
          ajuda: {
            oque: "A DRE mostra o desempenho da empresa no período: quanto entrou de receita, quanto saiu de custos e despesas e qual foi o lucro ou prejuízo.",
            onde: ["Com o contador anterior, normalmente no mesmo arquivo do balanço."],
            dica: "Envie os mesmos anos do balanço, para que os dois conversem entre si."
          }
        },
        {
          id: "patrimonio",
          kind: "arquivo",
          nome: "Relatório do patrimônio e depreciação",
          obrigatorio: false,
          resumo: "A lista dos bens da empresa — veículos, máquinas, móveis — e quanto já perderam de valor.",
          ajuda: {
            oque: "É a relação dos bens da empresa — veículos, máquinas, móveis, computadores — com data de compra, valor e quanto já foi depreciado.",
            onde: ["Com o contador anterior, no controle de ativo imobilizado."],
            dica: "Se a empresa não tem bens registrados no imobilizado, marque \"não se aplica\"."
          }
        }
      ]
    },

    {
      id: "fiscal",
      escopo: "empresa",
      icone: "ic-receipt",
      titulo: "Fiscal",
      desc: "O registro das suas notas, os impostos sobre as vendas e os acessos que usamos para calcular e entregar as declarações.",
      itens: [
        {
          id: "livros-fiscais",
          kind: "arquivo",
          nome: "Livros fiscais",
          obrigatorio: false,
          resumo: "O registro das notas de compra e de venda e do imposto do estado (ICMS).",
          ajuda: {
            oque: "São os registros de todas as notas de compra e venda e do cálculo do ICMS do período.",
            onde: [
              "Com o contador anterior, normalmente em PDF ou nos arquivos do SPED Fiscal.",
              "Se a empresa emite nota eletrônica, os arquivos podem ser gerados pelo sistema fiscal."
            ],
            dica: "Empresa só de serviços, sem ICMS? Marque \"não se aplica\" e siga em frente."
          }
        },
        {
          id: "certificado-digital",
          credenciais: [
            { id: "tipo", rotulo: "Tipo do certificado", tipo: "texto", dica: "A1 (arquivo) ou A3 (token/cartão)" },
            { id: "senha", rotulo: "Senha do certificado", tipo: "senha" },
            { id: "validade", rotulo: "Vence em", tipo: "texto", dica: "Opcional. Ex.: 12/2026" }
          ],
          kind: "acesso",
          nome: "Certificado digital da empresa (e-CNPJ)",
          obrigatorio: true,
          resumo: "A senha é embaralhada aqui no seu aparelho. Só a Totali abre, e fica registrado quem abriu.",
          ajuda: {
            oque: "É a assinatura eletrônica da empresa. Sem ela não é possível transmitir declarações, emitir certidões nem acessar o e-CAC da Receita Federal.",
            onde: [
              "Se o certificado for A1 (arquivo), anexe o arquivo no campo acima e informe a senha no campo protegido.",
              "Se for A3 (token ou cartão), o certificado fica fisicamente com você: informe a senha aqui e combinamos o uso com a nossa equipe.",
              "Alternativa que dispensa senha: conceder procuração eletrônica no e-CAC, seguindo o passo a passo abaixo."
            ],
            dica: "Confira a data de validade. Certificado vencido trava a entrega de obrigações e gera multa.",
            passosTitulo: "Passo a passo da procuração eletrônica",
            passos: [
              "Acesse o e-CAC no site da Receita Federal e entre com o certificado digital da empresa ou com a conta gov.br (nível prata ou ouro) do responsável legal.",
              "Procure por \"Procurações\" — fica no menu Senhas e Procurações. Se não achar, use a busca do próprio e-CAC.",
              "Escolha cadastrar uma nova procuração eletrônica para a Receita Federal.",
              "Informe o CNPJ da Totali como procurador e defina o prazo de validade que preferir.",
              "Marque os serviços que vamos usar. Se ficar em dúvida sobre quais, escolha todos — você pode revogar quando quiser.",
              "Assine e conclua. Depois volte aqui e marque a opção \"Vou conceder procuração eletrônica\"."
            ],
            passosNota: "Não tem certificado digital nem conta gov.br prata ou ouro? Fale com a gente: nesse caso existe a procuração em papel, feita numa unidade da Receita, e nós orientamos o caminho."
          }
        },
        {
          id: "acesso-simples",
          credenciais: [
            { id: "codigo", rotulo: "Código de acesso", tipo: "senha" },
            { id: "cpfResponsavel", rotulo: "CPF do responsável", tipo: "texto", dica: "O CPF usado para gerar o código" }
          ],
          kind: "acesso",
          nome: "Acesso ao Simples Nacional",
          obrigatorio: false,
          resumo: "Serve o código de acesso ou a procuração pela internet — qualquer um dos dois resolve.",
          ajuda: {
            oque: "O portal do Simples Nacional é onde se apura o DAS mensal e se acompanha o enquadramento da empresa.",
            onde: [
              "Com procuração eletrônica no e-CAC, a Totali acessa sem precisar de código.",
              "O código de acesso também pode ser gerado por você no portal do Simples Nacional, com CNPJ, CPF do responsável e número do recibo da última declaração."
            ],
            dica: "Se a empresa não é optante pelo Simples, marque \"não se aplica\".",
            passosTitulo: "Gerar o código de acesso você mesmo",
            passos: [
              "Se você já nos deu a procuração eletrônica no e-CAC, pare por aqui: ela já cobre o Simples Nacional e este item está resolvido.",
              "Se preferir o código de acesso, entre no Portal do Simples Nacional e procure a opção de gerar código de acesso.",
              "Informe o CNPJ da empresa, o CPF do responsável no cadastro e o número do recibo da última declaração entregue.",
              "O portal mostra o código na tela. Guarde-o com você.",
              "Volte aqui, escolha \"Informar o acesso agora\" e digite o código no campo protegido. Ele é embaralhado no seu aparelho antes de sair."
            ],
            passosNota: "O código de acesso pode ser gerado de novo a qualquer momento, o que invalida o anterior. Por isso ele é bem menos arriscado que uma senha comum."
          }
        },
        {
          id: "acesso-sefaz",
          credenciais: [
            { id: "usuario", rotulo: "Usuário", tipo: "texto" },
            { id: "senha", rotulo: "Senha", tipo: "senha" }
          ],
          kind: "acesso",
          nome: "Acesso à SEFAZ",
          obrigatorio: false,
          resumo: "O site da Secretaria da Fazenda do estado, onde ficam as notas e o ICMS.",
          ajuda: {
            oque: "É onde se consulta a situação fiscal estadual, emitem-se certidões e se acompanha o ICMS da empresa.",
            onde: [
              "O acesso costuma ser feito pelo certificado digital da empresa.",
              "Em alguns casos há usuário e senha próprios, criados no cadastro do contribuinte."
            ],
            dica: "Empresa sem inscrição estadual não precisa deste acesso — marque \"não se aplica\"."
          }
        }
      ]
    },

    {
      id: "trabalhista",
      escopo: "empresa",
      icone: "ic-users",
      titulo: "Departamento Pessoal",
      desc: "Tudo sobre os funcionários. Se a empresa não tem empregados, marque o grupo inteiro como não aplicável.",
      permiteGrupoNA: true,
      textoGrupoNA: "Minha empresa não tem funcionários registrados",
      itens: [
        {
          id: "fichas-funcionarios",
          kind: "arquivo",
          nome: "Fichas de registro dos funcionários",
          obrigatorio: true,
          resumo: "Atualizadas, com todos os empregados ativos.",
          ajuda: {
            oque: "A ficha de registro reúne os dados de cada empregado: qualificação, data de admissão, cargo, salário e todas as alterações ao longo do contrato.",
            onde: ["Com o contador ou com o setor de pessoal anterior."],
            dica: "Inclua também quem está afastado (INSS, licença, férias). Esses contratos continuam ativos."
          }
        },
        {
          id: "folhas-12m",
          kind: "arquivo",
          nome: "Folhas de pagamento dos últimos 12 meses",
          obrigatorio: true,
          resumo: "Em PDF, mês a mês.",
          ajuda: {
            oque: "É o demonstrativo mensal do que foi pago a cada empregado: salário, descontos, encargos e valor líquido.",
            onde: ["Com o contador anterior, geralmente um PDF por competência."],
            dica: "Pode enviar tudo de uma vez. O portal aceita vários arquivos no mesmo item."
          }
        },
        {
          id: "ferias",
          kind: "arquivo",
          nome: "Relação de férias vencidas e a vencer",
          obrigatorio: true,
          resumo: "Quem já tem férias para tirar e a partir de quando.",
          ajuda: {
            oque: "Mostra quem já tem férias adquiridas, quem está com férias vencidas e quando cada período começa a contar.",
            onde: ["No sistema de folha do contador anterior, no relatório de controle de férias."],
            dica: "Férias vencidas geram pagamento em dobro. Esse controle evita esse custo."
          }
        },
        {
          id: "ficha-financeira",
          kind: "arquivo",
          nome: "Ficha financeira dos últimos 2 anos",
          obrigatorio: true,
          resumo: "Histórico de valores pagos por empregado.",
          ajuda: {
            oque: "É o resumo, mês a mês, de tudo que cada empregado recebeu nos últimos dois anos.",
            onde: ["Relatório padrão do sistema de folha, com o contador anterior."],
            dica: "É o documento que permite calcular médias corretas em férias, 13º e rescisões."
          }
        },
        {
          id: "acesso-empregador-web",
          credenciais: [
            { id: "usuario", rotulo: "CPF ou usuário do gov.br", tipo: "texto" },
            { id: "senha", rotulo: "Senha", tipo: "senha" }
          ],
          kind: "acesso",
          nome: "Acesso ao Empregador Web",
          obrigatorio: false,
          resumo: "Portal do seguro-desemprego e comunicações de dispensa.",
          ajuda: {
            oque: "É o sistema do Ministério do Trabalho usado para requerimento de seguro-desemprego nas rescisões.",
            onde: ["O acesso é feito pelo portal gov.br da empresa ou pelo certificado digital."],
            dica: "Se preferir, o certificado digital com procuração também resolve — sem senha nenhuma."
          }
        },
        {
          id: "acesso-vt",
          credenciais: [
            { id: "site", rotulo: "Site de recarga", tipo: "texto" },
            { id: "usuario", rotulo: "Usuário", tipo: "texto" },
            { id: "senha", rotulo: "Senha", tipo: "senha" }
          ],
          kind: "acesso",
          nome: "Acesso ao emissor de Vale Transporte",
          obrigatorio: false,
          resumo: "Somente se a empresa fornece vale transporte.",
          ajuda: {
            oque: "É o site da empresa de transporte onde se compram os créditos dos cartões dos empregados.",
            onde: ["Com quem faz a recarga hoje na sua empresa."],
            dica: "Não fornece vale transporte? Marque \"não se aplica\"."
          }
        },
        {
          id: "informe-rendimentos",
          kind: "arquivo",
          nome: "Informe de rendimentos dos colaboradores",
          obrigatorio: false,
          resumo: "Do último ano já fechado.",
          ajuda: {
            oque: "É o comprovante que a empresa entrega a cada empregado para ele declarar o Imposto de Renda.",
            onde: ["Gerado pelo sistema de folha do contador anterior."],
            dica: "Envie o do ano-base mais recente já encerrado."
          }
        },
        {
          id: "extrato-folha",
          kind: "arquivo",
          nome: "Extrato analítico da folha (2 últimos meses)",
          obrigatorio: true,
          resumo: "O detalhe do que compõe cada salário, funcionário por funcionário.",
          ajuda: {
            oque: "É a folha aberta em detalhe: cada verba, cada desconto, empregado por empregado.",
            onde: ["Relatório analítico do sistema de folha."],
            dica: "É com esse extrato que conferimos se a folha migrou corretamente para o nosso sistema."
          }
        },
        {
          id: "dirf",
          kind: "arquivo",
          nome: "Recibo de entrega da DIRF",
          obrigatorio: false,
          resumo: "Do último ano em que a declaração foi entregue.",
          ajuda: {
            oque: "A DIRF informava à Receita os rendimentos pagos e o imposto retido na fonte.",
            onde: ["No recibo gerado pelo programa da DIRF, com o contador anterior."],
            dica: "A DIRF foi extinta e substituída pela EFD-Reinf e pelo eSocial. Se a sua empresa já não entrega, envie o recibo do último ano entregue ou marque \"não se aplica\"."
          }
        }
      ]
    },

    {
      id: "socios",
      escopo: "socio",
      icone: "ic-badge",
      titulo: "Documentos dos sócios",
      desc: "Cópias simples digitalizadas. Cada sócio tem sua própria lista — cadastre todos abaixo.",
      itens: [
        {
          id: "comprovante-endereco",
          kind: "arquivo",
          nome: "Comprovante de endereço",
          obrigatorio: true,
          resumo: "Conta recente, dos últimos 3 meses.",
          ajuda: {
            oque: "Conta de energia, água, telefone fixo ou internet que comprove onde o sócio mora.",
            onde: ["Fatura em papel ou o PDF que a concessionária envia por e-mail."],
            dica: "Se a conta não estiver no nome do sócio, envie junto uma declaração simples do titular do imóvel."
          }
        },
        {
          id: "rg",
          kind: "arquivo",
          nome: "Carteira de identidade (RG)",
          obrigatorio: true,
          resumo: "Frente e verso, legível.",
          substituivelPor: "cnh",
          ajuda: {
            oque: "Documento oficial de identificação do sócio.",
            onde: ["Fotografe o documento sobre uma superfície plana, sem reflexo e sem cortar as bordas."],
            dica: "Se você enviar a CNH, ela substitui o RG e o CPF — estes dois itens são dispensados automaticamente."
          }
        },
        {
          id: "cpf",
          kind: "arquivo",
          nome: "CPF",
          obrigatorio: true,
          resumo: "Cartão do CPF ou comprovante de situação cadastral.",
          substituivelPor: "cnh",
          ajuda: {
            oque: "Comprovação do número de CPF do sócio.",
            onde: [
              "Cartão físico do CPF, se você ainda tiver.",
              "Ou o Comprovante de Situação Cadastral, emitido gratuitamente no site da Receita Federal."
            ],
            dica: "Se o RG já traz o número do CPF impresso, esse mesmo documento resolve os dois itens."
          }
        },
        {
          id: "cnh",
          kind: "arquivo",
          nome: "Carteira de motorista (CNH)",
          obrigatorio: false,
          resumo: "Substitui o RG e o CPF.",
          substitui: ["rg", "cpf"],
          ajuda: {
            oque: "A CNH traz o número do RG e do CPF, por isso vale pelos dois documentos.",
            onde: ["Documento físico ou a CNH Digital, no aplicativo Carteira Digital de Trânsito."],
            dica: "Enviando a CNH, os itens de RG e CPF ficam marcados como atendidos."
          }
        },
        {
          id: "certidao-casamento",
          kind: "arquivo",
          nome: "Certidão de casamento",
          obrigatorio: false,
          resumo: "Somente se casado ou em união estável formalizada.",
          ajuda: {
            oque: "A certidão comprova o estado civil e o regime de bens, informações que constam do contrato social.",
            onde: ["Cartório onde foi registrado o casamento. Muitos emitem segunda via digital."],
            dica: "Solteiro, divorciado ou viúvo? Marque \"não se aplica\" ou envie a certidão com a averbação, se houver."
          }
        },
        {
          id: "titulo-eleitor",
          kind: "arquivo",
          nome: "Título de eleitor",
          obrigatorio: false,
          resumo: "Título ou comprovante do e-Título.",
          ajuda: {
            oque: "Documento eleitoral do sócio, solicitado em alguns registros e certidões.",
            onde: ["Aplicativo e-Título ou o site do Tribunal Superior Eleitoral."],
            dica: "A tela do e-Título com nome e número já resolve."
          }
        },
        {
          id: "pis",
          kind: "dado",
          nome: "Número do PIS / PASEP / NIS",
          obrigatorio: false,
          resumo: "Apenas o número, sem anexo.",
          formato: "numero",
          maxlen: 20,
          placeholder: "000.00000.00-0",
          ajuda: {
            oque: "É o número de inscrição do trabalhador, usado em cadastros previdenciários.",
            onde: [
              "No aplicativo CTPS Digital ou Meu INSS.",
              "No cartão do Cidadão ou em qualquer holerite antigo."
            ],
            dica: "Se o sócio nunca teve vínculo de emprego, pode não existir. Marque \"não se aplica\"."
          }
        },
        {
          id: "ir-socio",
          kind: "arquivo",
          nome: "Declaração de Imposto de Renda",
          obrigatorio: false,
          resumo: "Última declaração entregue, se houver.",
          ajuda: {
            oque: "Declaração de Ajuste Anual do sócio, com o recibo de entrega.",
            onde: ["No e-CAC da Receita Federal, em \"Meu Imposto de Renda\"."],
            dica: "Sócio isento de declarar pode marcar \"não se aplica\"."
          }
        },
        {
          id: "escolaridade",
          kind: "dado",
          nome: "Grau de escolaridade",
          obrigatorio: false,
          resumo: "Pedida nos cadastros da empresa e nas declarações ao governo.",
          formato: "selecao",
          opcoes: [
            "Ensino fundamental incompleto",
            "Ensino fundamental completo",
            "Ensino médio incompleto",
            "Ensino médio completo",
            "Ensino superior incompleto",
            "Ensino superior completo",
            "Pós-graduação",
            "Mestrado",
            "Doutorado"
          ],
          ajuda: {
            oque: "O grau de instrução do sócio é exigido em cadastros de órgãos públicos.",
            onde: ["Basta selecionar a opção correspondente. Não precisa anexar diploma."],
            dica: ""
          }
        }
      ]
    }
  ];

  /* ---------- Vídeos ----------
     Os vídeos ficam no YouTube, como "não listados", e aqui
     guardamos só o identificador. Não listado quer dizer: não
     aparece em busca nem no canal, mas quem tem o link assiste.
     Se precisar que só pessoas específicas vejam, aí tem de ser
     "privado" — e privado NÃO toca em site nenhum, nem aqui.

     O identificador é o trecho depois de "v=" no endereço:
     youtube.com/watch?v=dQw4w9WgXcQ  ->  "dQw4w9WgXcQ"

     Deixe "" enquanto o vídeo não estiver pronto: o portal mostra
     "em breve" no lugar do player, sem quebrar nada.
  ------------------------------- */

  /* Vídeo de apresentação, na tela inicial. */
  var VIDEO_INICIO_PADRAO = {
    youtube: "",
    titulo: "Bem-vindo à Totali",
    desc: "Em poucos minutos, mostramos como funciona o portal, o que vamos precisar de você " +
          "e o que acontece em cada etapa da migração.",
    duracao: ""
  };

  var ACADEMY_PADRAO = [
    {
      id: "primeiros-passos",
      kicker: "Trilha 1",
      titulo: "Primeiros passos com a Totali",
      desc: "Como funciona a rotina mensal, o que esperar de nós e o que precisamos de você a cada mês.",
      videos: [
        { titulo: "Quem cuida da sua empresa", duracao: "3 min", youtube: "" },
        { titulo: "O calendário do seu mês", duracao: "4 min", youtube: "" },
        { titulo: "Como falar com a gente", duracao: "2 min", youtube: "" },
        { titulo: "O que muda depois da migração", duracao: "3 min", youtube: "" }
      ]
    },
    {
      id: "notas-fiscais",
      kicker: "Trilha 2",
      titulo: "Emissão de notas fiscais",
      desc: "Passo a passo para emitir nota de serviço e de produto sem errar no imposto.",
      videos: [
        { titulo: "Nota de serviço: passo a passo", duracao: "5 min", youtube: "" },
        { titulo: "Nota de produto: passo a passo", duracao: "5 min", youtube: "" },
        { titulo: "Escolhendo o código do serviço", duracao: "3 min", youtube: "" },
        { titulo: "Erros mais comuns na emissão", duracao: "3 min", youtube: "" },
        { titulo: "Cancelar e corrigir uma nota", duracao: "2 min", youtube: "" }
      ]
    },
    {
      id: "guias-impostos",
      kicker: "Trilha 3",
      titulo: "Guias e impostos do mês",
      desc: "Onde encontrar suas guias, como pagar e o que acontece se atrasar.",
      videos: [
        { titulo: "Onde ficam as suas guias", duracao: "3 min", youtube: "" },
        { titulo: "Como pagar e comprovar", duracao: "3 min", youtube: "" },
        { titulo: "Atrasou? O que fazer", duracao: "3 min", youtube: "" }
      ]
    },
    {
      id: "folha-pessoal",
      kicker: "Trilha 4",
      titulo: "Contratar e demitir sem dor de cabeça",
      desc: "O que enviar para admitir, o que observar em férias e o que fazer numa rescisão.",
      videos: [
        { titulo: "Admissão: documentos e prazos", duracao: "4 min", youtube: "" },
        { titulo: "Férias: como programar", duracao: "4 min", youtube: "" },
        { titulo: "13º salário sem susto", duracao: "3 min", youtube: "" },
        { titulo: "Rescisão: o passo a passo", duracao: "5 min", youtube: "" },
        { titulo: "Atestado, falta e advertência", duracao: "3 min", youtube: "" },
        { titulo: "eSocial: o que é e por que importa", duracao: "3 min", youtube: "" }
      ]
    },
    {
      id: "documentos-mensais",
      kicker: "Trilha 5",
      titulo: "O que enviar todo mês",
      desc: "Extratos, notas de compra, notas de venda e comprovantes: o calendário da sua empresa.",
      videos: [
        { titulo: "A lista do mês", duracao: "4 min", youtube: "" },
        { titulo: "Extratos bancários: como baixar", duracao: "3 min", youtube: "" },
        { titulo: "Relatórios da maquininha", duracao: "3 min", youtube: "" }
      ]
    },
    {
      id: "pro-labore",
      kicker: "Trilha 6",
      titulo: "Pró-labore e distribuição de lucros",
      desc: "A diferença entre retirar como sócio e como empregado, e o impacto no seu imposto.",
      videos: [
        { titulo: "Pró-labore: o que é", duracao: "3 min", youtube: "" },
        { titulo: "Distribuição de lucros", duracao: "4 min", youtube: "" },
        { titulo: "Quanto retirar de cada forma", duracao: "4 min", youtube: "" },
        { titulo: "O que isso muda no seu IR", duracao: "3 min", youtube: "" }
      ]
    }
  ];
  /* ---------- Perguntas frequentes ---------- */
  var FAQ_PADRAO = [
    {
      q: "Preciso enviar tudo de uma vez?",
      a: "Não. Envie no seu ritmo — cada arquivo fica salvo assim que você anexa e a barra de progresso vai acompanhando. Você pode fechar o portal e voltar depois de onde parou."
    },
    {
      q: "Não consigo um documento com o contador anterior. E agora?",
      a: "Fale com a gente. A maioria dos documentos pode ser obtida diretamente nos portais oficiais (Junta Comercial, Receita Federal, SEFAZ) e nós ajudamos nesse caminho. A entrega dos documentos pelo contador anterior também é uma obrigação profissional prevista no Código de Ética do contador."
    },
    {
      q: "É seguro informar minhas senhas aqui?",
      a: "É, e explicamos por quê. Quando você toca em \"Guardar com segurança\", a senha é embaralhada dentro do seu próprio aparelho, antes de sair dele. No nosso banco de dados ela fica guardada assim, embaralhada — nem quem tivesse acesso ao banco conseguiria ler. A chave que abre fica num cofre do servidor, e só a nossa equipe consegue pedir a abertura, pelo sistema interno, quando precisa baixar seus relatórios. Cada uma dessas aberturas fica registrada com o nome de quem abriu e a data — se você quiser saber quem acessou o quê, a gente responde. Se preferir não digitar senha nenhuma, os itens de acesso oferecem alternativas: procuração eletrônica no e-CAC, com passo a passo, ou avisar que a Totali já tem acesso."
    },
    {
      q: "Para que a Totali usa esses acessos?",
      a: "Para emitir e transmitir o que a sua empresa precisa entregar, baixar relatórios de venda das maquininhas e consultar a situação fiscal. Nunca movimentamos dinheiro, não fazemos transferência e não alteramos cadastro sem falar com você. Onde a maquininha permitir, peça um usuário só de consulta e informe esse: ele baixa relatório e não deixa mexer no dinheiro. A Totali nunca pede a senha do seu banco."
    },
    {
      q: "Que tipos de arquivo posso enviar?",
      a: "PDF, imagens (JPG, PNG, WEBP), planilhas e documentos do Office (XLS, XLSX, DOC, DOCX) e arquivos de texto do SPED (TXT e XML). Nas mensagens você também pode anexar áudios (MP3, M4A, OGG, WAV) e tirar foto na hora pelo celular. Cada arquivo pode ter até 20 MB. Se o seu for maior, avise que combinamos outro caminho."
    },
    {
      q: "Tirei foto do documento. Serve?",
      a: "Serve, desde que dê para ler tudo. Apoie o documento numa superfície plana, evite sombra e reflexo, e enquadre as bordas inteiras. Documentos com frente e verso precisam das duas faces."
    },
    {
      q: "Quem vê os meus documentos?",
      a: "Somente a equipe da Totali responsável pela sua empresa. Usamos os documentos exclusivamente para a prestação dos serviços contábeis contratados, conforme a Lei Geral de Proteção de Dados."
    },
    {
      q: "Posso usar o portal pelo celular?",
      a: "Sim, o portal foi feito primeiro para o celular. Você também pode instalá-lo como aplicativo: use o botão \"Instalar\" no topo da tela ou a opção \"Adicionar à tela de início\" do seu navegador."
    },
    {
      q: "Quanto tempo leva a migração?",
      a: "Depende da documentação. Com o material completo, a migração costuma ser concluída em poucos dias úteis. O que mais atrasa é a demora do contador anterior em liberar os arquivos — por isso quanto antes você pedir, melhor."
    }
  ];

  /* ============================================================
     Conteúdo vindo do painel da equipe (js/conteudo.js)

     Cada bloco é opcional e passa por um saneador antes de valer.
     O arquivo é gerado por uma ferramenta nossa, mas mesmo assim
     não confiamos nele às cegas: campo por campo, com limite de
     tamanho e lista fechada onde faz sentido.
     ============================================================ */
  var CFG = global.CONTEUDO || {};

  function txt(v, max, padrao) {
    return typeof v === "string" && v.trim() ? v.slice(0, max) : (padrao || "");
  }

  function listaDeTextos(v, maxItens, maxTexto) {
    if (!Array.isArray(v)) return null;
    var l = v.slice(0, maxItens)
      .map(function (x) { return txt(x, maxTexto); })
      .filter(Boolean);
    return l.length ? l : null;
  }

  function aplicaOrg(bruto) {
    if (!bruto || typeof bruto !== "object") return ORG_PADRAO;
    var o = JSON.parse(JSON.stringify(ORG_PADRAO));
    ["nome", "curto", "email", "telefoneExibicao", "whatsapp", "site", "instagram", "horario"]
      .forEach(function (k) { if (typeof bruto[k] === "string" && bruto[k].trim()) o[k] = bruto[k].slice(0, 200); });
    /* Só http(s) — nada de javascript: no botão do site. */
    if (!/^https?:\/\//i.test(o.site)) o.site = ORG_PADRAO.site;
    o.whatsapp = String(o.whatsapp).replace(/\D+/g, "").slice(0, 15) || ORG_PADRAO.whatsapp;

    if (bruto.local && typeof bruto.local === "object") {
      ["nome", "endereco", "cidade", "cep"].forEach(function (k) {
        if (typeof bruto.local[k] === "string") o.local[k] = bruto.local[k].slice(0, 200);
      });
      var la = parseFloat(bruto.local.lat), ln = parseFloat(bruto.local.lng);
      if (isFinite(la) && la >= -90 && la <= 90) o.local.lat = la;
      if (isFinite(ln) && ln >= -180 && ln <= 180) o.local.lng = ln;
      if (typeof bruto.local.link === "string" && /^https?:\/\//i.test(bruto.local.link)) {
        o.local.link = bruto.local.link.slice(0, 300);
      }
    }
    return o;
  }

  var ID_YT = /^[A-Za-z0-9_-]{11}$/;
  var CAPA_OK = /^[A-Za-z0-9_\-./]{1,160}$/;

  /* CAPA VEM DE DOIS LUGARES, e só desses dois.

     1. Caminho relativo dentro do próprio site (`assets/…`) — é
        como as capas nasceram, arquivo commitado no repositório.
     2. Endereço do NOSSO Storage, pasta `publico/` — é o que a
        equipe consegue enviar pelo painel, sem tocar em código.

     Endereço de fora não entra, e não é preciosismo: `capa` é uma
     string que vem de arquivo de conteúdo editável, e uma URL
     qualquer dentro de um `<img>` entrega o IP de cada cliente a
     quem serviu a imagem. A CSP também barraria — mas não se
     depende de uma trava só. */
  function capaDoNossoStorage(c) {
    var cfg = global.FIREBASE_CONFIG;
    var bucket = (cfg && typeof cfg.storageBucket === "string") ? cfg.storageBucket : "";
    if (!bucket) return false;
    var inicio = "https://firebasestorage.googleapis.com/v0/b/" + bucket + "/o/publico%2F";
    return c.length <= 600 && c.indexOf(inicio) === 0 && c.indexOf("..") === -1;
  }

  function capaSegura(c) {
    if (typeof c !== "string" || !c) return "";
    if (capaDoNossoStorage(c)) return c;
    return (CAPA_OK.test(c) && c.indexOf("..") === -1 &&
            c.charAt(0) !== "/" && /\.(png|jpe?g|webp)$/i.test(c)) ? c : "";
  }

  function aplicaVideoInicio(bruto) {
    if (!bruto || typeof bruto !== "object") return VIDEO_INICIO_PADRAO;
    return {
      youtube: ID_YT.test(bruto.youtube) ? bruto.youtube : "",
      titulo: txt(bruto.titulo, 140, VIDEO_INICIO_PADRAO.titulo),
      desc: txt(bruto.desc, 400, VIDEO_INICIO_PADRAO.desc),
      duracao: txt(bruto.duracao, 20, ""),
      capa: capaSegura(bruto.capa)
    };
  }

  function aplicaAcademy(bruta) {
    if (!Array.isArray(bruta) || !bruta.length) return ACADEMY_PADRAO;
    var limpas = bruta.slice(0, 40).map(function (t, i) {
      if (!t || typeof t !== "object") return null;
      var titulo = txt(t.titulo, 120);
      if (!titulo) return null;
      return {
        id: txt(t.id, 60, "trilha-" + (i + 1)).replace(/[^a-zA-Z0-9_-]/g, "") || ("trilha-" + (i + 1)),
        kicker: txt(t.kicker, 40, "Trilha " + (i + 1)),
        titulo: titulo,
        desc: txt(t.desc, 400),
        capa: capaSegura(t.capa),
        videos: (Array.isArray(t.videos) ? t.videos.slice(0, 60) : []).map(function (v) {
          if (!v || typeof v !== "object") return null;
          var vt = txt(v.titulo, 140);
          if (!vt) return null;
          return {
            titulo: vt,
            duracao: txt(v.duracao, 20),
            desc: txt(v.desc, 400),
            youtube: ID_YT.test(v.youtube) ? v.youtube : "",
            capa: capaSegura(v.capa)
          };
        }).filter(Boolean)
      };
    }).filter(Boolean);
    return limpas.length ? limpas : ACADEMY_PADRAO;
  }

  var KINDS = ["arquivo", "dado", "acesso"];
  var ESCOPOS = ["empresa", "socio"];
  var ICONES = ["ic-scroll", "ic-calculator", "ic-receipt", "ic-users", "ic-badge",
                "ic-file", "ic-folder", "ic-card", "ic-building"];

  function aplicaGrupos(brutos) {
    if (!Array.isArray(brutos) || !brutos.length) return GRUPOS_PADRAO;
    var limpos = brutos.slice(0, 20).map(function (g, i) {
      if (!g || typeof g !== "object") return null;
      var titulo = txt(g.titulo, 80);
      if (!titulo) return null;
      var itens = (Array.isArray(g.itens) ? g.itens.slice(0, 60) : []).map(function (it, j) {
        if (!it || typeof it !== "object") return null;
        var nome = txt(it.nome, 140);
        if (!nome) return null;
        var novo = {
          id: txt(it.id, 60, "item-" + (j + 1)).replace(/[^a-zA-Z0-9_-]/g, "") || ("item-" + (j + 1)),
          kind: KINDS.indexOf(it.kind) > -1 ? it.kind : "arquivo",
          nome: nome,
          obrigatorio: it.obrigatorio === true,
          resumo: txt(it.resumo, 240),
          ajuda: {
            oque: txt(it.ajuda && it.ajuda.oque, 800),
            onde: listaDeTextos(it.ajuda && it.ajuda.onde, 8, 400) || [],
            dica: txt(it.ajuda && it.ajuda.dica, 600),
            passosTitulo: txt(it.ajuda && it.ajuda.passosTitulo, 120),
            passos: listaDeTextos(it.ajuda && it.ajuda.passos, 12, 400) || [],
            passosNota: txt(it.ajuda && it.ajuda.passosNota, 600)
          }
        };
        if (Array.isArray(it.substitui)) {
          novo.substitui = it.substitui.slice(0, 6).map(function (x) { return txt(x, 60); }).filter(Boolean);
        }
        if (typeof it.substituivelPor === "string") novo.substituivelPor = txt(it.substituivelPor, 60);
        if (it.kind === "dado") {
          novo.formato = it.formato === "selecao" ? "selecao" : "numero";
          novo.placeholder = txt(it.placeholder, 60);
          novo.maxlen = typeof it.maxlen === "number" ? global.U.clamp(it.maxlen, 1, 400) : 60;
          if (novo.formato === "selecao") novo.opcoes = listaDeTextos(it.opcoes, 40, 120) || [];
        }
        if (it.kind === "acesso" && Array.isArray(it.credenciais)) {
          novo.credenciais = it.credenciais.slice(0, 12).map(function (c) {
            if (!c || typeof c !== "object") return null;
            var rot = txt(c.rotulo, 80);
            if (!rot) return null;
            return {
              id: txt(c.id, 40, "campo").replace(/[^a-zA-Z0-9_-]/g, "") || "campo",
              rotulo: rot,
              tipo: c.tipo === "senha" ? "senha" : "texto",
              dica: txt(c.dica, 200),
              placeholder: txt(c.placeholder, 80)
            };
          }).filter(Boolean);
        }
        return novo;
      }).filter(Boolean);

      if (!itens.length) return null;
      var novoG = {
        id: txt(g.id, 60, "grupo-" + (i + 1)).replace(/[^a-zA-Z0-9_-]/g, "") || ("grupo-" + (i + 1)),
        escopo: ESCOPOS.indexOf(g.escopo) > -1 ? g.escopo : "empresa",
        icone: ICONES.indexOf(g.icone) > -1 ? g.icone : "ic-file",
        titulo: titulo,
        desc: txt(g.desc, 400),
        itens: itens
      };
      if (g.permiteGrupoNA === true) {
        novoG.permiteGrupoNA = true;
        novoG.textoGrupoNA = txt(g.textoGrupoNA, 160, "Não se aplica à minha empresa");
      }
      return novoG;
    }).filter(Boolean);
    return limpos.length ? limpos : GRUPOS_PADRAO;
  }

  function aplicaFaq(bruta) {
    if (!Array.isArray(bruta) || !bruta.length) return FAQ_PADRAO;
    var l = bruta.slice(0, 40).map(function (f) {
      if (!f || typeof f !== "object") return null;
      var q = txt(f.q, 200), a = txt(f.a, 2000);
      return (q && a) ? { q: q, a: a } : null;
    }).filter(Boolean);
    return l.length ? l : FAQ_PADRAO;
  }

  function aplicaCompromisso(bruto) {
    if (!bruto || typeof bruto !== "object") return COMPROMISSO_PADRAO;
    return {
      titulo: txt(bruto.titulo, 80, COMPROMISSO_PADRAO.titulo),
      chamada: txt(bruto.chamada, 500, COMPROMISSO_PADRAO.chamada),
      itens: listaDeTextos(bruto.itens, 12, 200) || COMPROMISSO_PADRAO.itens,
      fecho: txt(bruto.fecho, 800, COMPROMISSO_PADRAO.fecho)
    };
  }

  function aplicaTermo(bruto) {
    if (!bruto || typeof bruto !== "object") return TERMO_PADRAO;
    var t = JSON.parse(JSON.stringify(TERMO_PADRAO));
    ["titulo", "subtitulo", "declaracao", "compromisso", "responsabilidadeTitulo",
     "responsabilidade", "cienciaTitulo", "ciencia"].forEach(function (k) {
      if (typeof bruto[k] === "string" && bruto[k].trim()) t[k] = bruto[k].slice(0, 3000);
    });
    var itens = listaDeTextos(bruto.itens, 12, 200);
    if (itens) t.itens = itens;
    return t;
  }

  var ORG = aplicaOrg(CFG.org);
  var VIDEO_INICIO = aplicaVideoInicio(CFG.videoInicio);
  var ACADEMY = aplicaAcademy(CFG.academy);
  var GRUPOS = aplicaGrupos(CFG.grupos);
  var FAQ = aplicaFaq(CFG.faq);
  var COMPROMISSO = aplicaCompromisso(CFG.compromisso);
  var TERMO = aplicaTermo(CFG.termo);

  /* O catálogo também é editável pelo painel. Lista vazia ou
     quebrada cai no padrão — o formulário nunca fica sem opções. */
  BANCOS = normalizarCatalogo(CFG.bancos, false).length
    ? normalizarCatalogo(CFG.bancos, false) : normalizarCatalogo(BANCOS, false);
  MAQUINETAS = normalizarCatalogo(CFG.maquinetas, true).length
    ? normalizarCatalogo(CFG.maquinetas, true) : normalizarCatalogo(MAQUINETAS, true);

  global.DATA = {
    ORG: ORG,
    ETAPAS: ETAPAS,
    GRUPOS: GRUPOS,
    ACADEMY: ACADEMY,
    VIDEO_INICIO: VIDEO_INICIO,
    FAQ: FAQ,
    BANCOS: BANCOS,
    MAQUINETAS: MAQUINETAS,
    nomesDo: nomesDo,
    acharNoCatalogo: acharNoCatalogo,
    FORMAS_RELATORIO: FORMAS_RELATORIO,
    RELATORIOS_MENSAIS: RELATORIOS_MENSAIS,
    CANAL_RELATORIOS: CANAL_RELATORIOS,
    COMPROMISSO: COMPROMISSO,
    TERMO: TERMO,
    /* O portal e o painel precisam do MESMO crivo de capa. Duas
       cópias da mesma regra viram duas regras diferentes na
       primeira vez que alguém mexer numa só. */
    capaSegura: capaSegura
  };
})(window);
