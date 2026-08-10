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
  var ORG = {
    nome: "Totali Soluções Contábeis",
    curto: "Totali",
    email: "cadastro@totalicontabilidade.com.br",
    telefoneExibicao: "(79) 99841-2107",
    whatsapp: "5579998412107",
    site: "https://www.totalicontabilidade.com.br",
    instagram: "totalicontabilidade",
    horario: "Segunda a sexta, das 8h às 18h"
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
  var BANCOS = [
    "Banco do Brasil", "Banco do Nordeste", "Banese", "Bradesco", "C6 Bank",
    "Caixa Econômica", "Cora", "InfinitePay", "Inter", "Itaú", "Mercado Pago",
    "Nubank", "PagBank", "Santander", "Sicredi", "Stone"
  ];

  var MAQUINETAS = [
    "Cielo", "Getnet", "InfinitePay", "Mercado Pago", "Mulvi Convênio",
    "Mulvi Pay", "PagBank", "Rede", "Stone"
  ];

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
      desc: "Você informa login e senha de cada maquininha aqui mesmo. A senha é cifrada no seu " +
            "aparelho antes de sair, e só a Totali consegue abrir. Usamos apenas para baixar os " +
            "relatórios do mês — nunca para movimentar dinheiro.",
      recomendado: true
    }
  ];

  /* ---------- Catálogo de documentos ----------
     kind:
       "arquivo"  → upload de arquivo
       "acesso"   → credencial de sistema (NUNCA pede senha digitada aqui)
       "dado"     → informação curta digitada (texto ou seleção)
     escopo:
       "empresa"  → um por empresa
       "socio"    → um por sócio cadastrado
  ------------------------------------------------ */
  var GRUPOS = [
    {
      id: "societario",
      escopo: "empresa",
      icone: "ic-scroll",
      titulo: "Societário",
      desc: "Os atos de constituição da empresa. É por aqui que confirmamos quem são os sócios, o objeto e o capital.",
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
          resumo: "Preferencialmente dos 2 ou 3 últimos exercícios.",
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
          resumo: "Demonstração do Resultado do Exercício.",
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
          resumo: "Lista dos bens do ativo imobilizado com o cálculo de depreciação.",
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
      desc: "Escrituração de notas, impostos sobre vendas e os acessos que usamos para apurar e declarar.",
      itens: [
        {
          id: "livros-fiscais",
          kind: "arquivo",
          nome: "Livros fiscais",
          obrigatorio: false,
          resumo: "Entradas, saídas e apuração de ICMS.",
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
          resumo: "A senha vai cifrada no seu aparelho — só a Totali consegue abrir.",
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
          resumo: "Código de acesso ou procuração eletrônica.",
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
              "Volte aqui e escolha \"Prefiro combinar com a Totali\" — nós entramos em contato para receber o código por um canal seguro, fora deste portal."
            ],
            passosNota: "O código de acesso pode ser gerado de novo a qualquer momento, o que invalida o anterior. É por isso que ele é bem menos arriscado que uma senha — mas ainda assim não pedimos que você o digite aqui."
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
          resumo: "Portal da Secretaria da Fazenda do estado.",
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
          resumo: "Controle de período aquisitivo de cada empregado.",
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
          resumo: "Referente ao último ano-base.",
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
          resumo: "Detalhamento por evento e por empregado.",
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
          resumo: "Informação exigida em cadastros e no eSocial.",
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

  /* ---------- Academy (conteúdo futuro) ---------- */
  var ACADEMY = [
    {
      id: "primeiros-passos",
      kicker: "Trilha 1",
      titulo: "Primeiros passos com a Totali",
      desc: "Como funciona a rotina mensal, o que esperar de nós e o que precisamos de você a cada mês.",
      duracao: "4 vídeos · 12 min",
      status: "em-breve"
    },
    {
      id: "notas-fiscais",
      kicker: "Trilha 2",
      titulo: "Emissão de notas fiscais",
      desc: "Passo a passo para emitir nota de serviço e de produto sem errar no imposto.",
      duracao: "5 vídeos · 18 min",
      status: "em-breve"
    },
    {
      id: "guias-impostos",
      kicker: "Trilha 3",
      titulo: "Guias e impostos do mês",
      desc: "Onde encontrar suas guias, como pagar e o que acontece se atrasar.",
      duracao: "3 vídeos · 9 min",
      status: "em-breve"
    },
    {
      id: "folha-pessoal",
      kicker: "Trilha 4",
      titulo: "Contratar e demitir sem dor de cabeça",
      desc: "O que enviar para admitir, o que observar em férias e o que fazer numa rescisão.",
      duracao: "6 vídeos · 22 min",
      status: "em-breve"
    },
    {
      id: "documentos-mensais",
      kicker: "Trilha 5",
      titulo: "O que enviar todo mês",
      desc: "Extratos, notas de compra, notas de venda e comprovantes: o calendário da sua empresa.",
      duracao: "3 vídeos · 10 min",
      status: "em-breve"
    },
    {
      id: "pro-labore",
      kicker: "Trilha 6",
      titulo: "Pró-labore e distribuição de lucros",
      desc: "A diferença entre retirar como sócio e como empregado, e o impacto no seu imposto.",
      duracao: "4 vídeos · 14 min",
      status: "em-breve"
    }
  ];

  /* ---------- Perguntas frequentes ---------- */
  var FAQ = [
    {
      q: "Preciso enviar tudo de uma vez?",
      a: "Não. Envie no seu ritmo — cada arquivo fica salvo assim que você anexa e a barra de progresso vai acompanhando. Você pode fechar o portal e voltar depois de onde parou."
    },
    {
      q: "Não consigo um documento com o contador anterior. E agora?",
      a: "Fale com a gente. A maioria dos documentos pode ser obtida diretamente nos portais oficiais (Junta Comercial, Receita Federal, SEFAZ) e nós ajudamos nesse caminho. A entrega dos documentos pelo contador anterior também é uma obrigação profissional prevista no Código de Ética do contador."
    },
    {
      q: "Por que vocês não pedem minhas senhas no formulário?",
      a: "Por segurança. Senha digitada em formulário fica registrada em vários lugares — no navegador, no servidor e nos backups. Preferimos a procuração eletrônica no e-CAC: você autoriza a Totali a acessar o que precisa, sem entregar senha nenhuma, e pode cancelar essa autorização quando quiser."
    },
    {
      q: "Que tipos de arquivo posso enviar?",
      a: "PDF, JPG, PNG, WEBP, além de planilhas e documentos do Office (XLS, XLSX, DOC, DOCX) e arquivos de texto do SPED (TXT e XML). Cada arquivo pode ter até 20 MB. Se o seu arquivo for maior, avise que combinamos outro caminho."
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

  global.DATA = {
    ORG: ORG,
    ETAPAS: ETAPAS,
    GRUPOS: GRUPOS,
    ACADEMY: ACADEMY,
    FAQ: FAQ,
    BANCOS: BANCOS,
    MAQUINETAS: MAQUINETAS,
    FORMAS_RELATORIO: FORMAS_RELATORIO
  };
})(window);
