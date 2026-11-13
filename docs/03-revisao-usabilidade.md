# Revisão de usabilidade: o portal visto por quem nunca usou um site

**Data:** 22/09/2026. Método: percorri o portal e o painel como uma pessoa que recebeu o convite no WhatsApp, nunca entrou num sistema e usa só o celular. A cada tela perguntei: ela sabe onde está, o que fazer agora e o que acontece ao tocar? O que não passou nesse teste foi corrigido no código; o que depende de decisão está na seção final.

## 1. Caminho do cliente novo, passo a passo

| Passo | O que a pessoa vê | O que confundia | O que mudou |
|---|---|---|---|
| Recebe o link no WhatsApp | Página "Criar meu acesso" com o nome da empresa | Nada. Só nome, e-mail e senha. | Senha mínima explicada em uma linha; a conferência contra senhas vazadas avisa em português simples. |
| Entra pela primeira vez | Tela inicial + tutorial de 6 passos | O tutorial falava "Documentos", mas o menu dizia outra coisa. | Tutorial e menu usam as mesmas palavras. |
| Tela inicial | Cartão "Hoje" com uma coisa só, 4 ações grandes, vencimentos, conversa, quem cuida | Ícone "👋" e "🎉" davam ar de app de conversa, não de contabilidade. | Emojis removidos de todos os textos do sistema. Ficaram só no chat, onde são recurso do usuário. |
| Quer enviar documentos | Duas telas parecidas: "Entrada na Totali" e "Documentos" | "Entrada" não diz nada para leigo; "Documentos" parecia o lugar de enviar, mas era a biblioteca. | Renomeado: **Lista de documentos** (o que a Totali precisa, item a item, com ajuda) e **Meus arquivos** (o que já foi enviado). A tela de arquivos aponta para a lista com um cartão dourado e explica como enviar em 3 linhas. |
| Abre a lista | Blocos por departamento, cada item com Enviar / Não se aplica / Ajuda | O botão "Ajuda" abre o que é, onde conseguir e um passo a passo. Bom. | Texto de abertura reescrito sem "onboarding" e sem jargão. |
| Senhas | "Cofre de senhas" | "Cifrado ponta a ponta" é jargão. | Texto diz "embaralhadas no seu aparelho antes de sair", como no Academy. |
| Sistemas | Cartões dos sistemas | "Não contratado" soa como cobrança. | Selo virou **Conheça**; o banner diz **Sugestão para sua empresa**. |
| Chat | Bolhas, emojis, anexo, foto | Nada. | Mantido. |
| Login | Formulário simples, sem contexto | Parecia página genérica. | Refeito na composição do Agência 100K: painel navy com o padrão de calculadora, frase de valor, a jornada do cliente em etapas, botão "Entrar". |

## 2. Palavras que saíram e as que entraram

- "Entrada na Totali" → **Lista de documentos**. "Documentos" → **Meus arquivos**. "Linha do tempo" → **Histórico**.
- "Cifrado ponta a ponta" → "embaralhado no seu aparelho antes de sair".
- "Não contratado" → **Conheça**. "Ainda não contratado" → **Sugestão para sua empresa**.
- "Continuar" no login → **Entrar**.
- Todos os emojis de texto do sistema saíram (tela, toasts, mensagens automáticas). Ícones em traço no lugar.

## 3. Visual: o que foi refinado

- Padrão de fundo R1 (teclas em relevo) no menu, no login e nos cartões navy. Degradê do menu igual ao do Agência 100K (180°, de navy sólido a 22% na base).
- Banners de sistemas: cartão navy com degradê para a cor do sistema, ícone em vidro, botão dourado. Na barra lateral, cartão de vidro claro com borda, legível sobre o padrão.
- Cartões com sombra em duas camadas e borda mais suave; botões primário e dourado com degradê discreto; selos de sistema com brilho.
- Cartão "Hoje" com fundo em degradê da cor do aviso; ações principais com ícone circular e seta.

## 4. Painel da equipe

- Mesmo login novo, com as etapas do trabalho da equipe.
- "Documentos a conferir" filtra pelo departamento da pessoa e mostra os outros recolhidos.
- Emojis removidos das mensagens automáticas (convite, cobrança, feedback) para o cliente receber texto profissional.

## 5. O que ainda depende de você

1. ~~Menu do portal~~ — decidido em 22/09/2026: menu lateral navy (opção A) com o padrão de calculadora R3 completo.
2. ~~Checklist do mês~~ — mantido e virou "Envio do mês" (22/09/2026): itens por perfil da empresa, editável em Conteúdo, anexo marca o item, aviso antes do prazo e cobrança automática do atraso.
3. ~~Foto do gerente de contas~~ — não existe "gerente de contas": cada empresa tem um responsável por setor (Fiscal, Contábil, Dep. Pessoal, Societário, Financeiro), definidos na ficha do cliente e mostrados no cartão "Quem cuida da sua empresa".

## 6. Revisão de 13/11/2026: menos texto, peso visual pela frequência de uso

**Pedido do Raoni:** muito texto, e funções que o cliente não usa no dia a dia com o mesmo peso das que usa todo dia. O banner de propaganda tem de existir (o lugar não importa). O portal ainda não teve uso real, então a divisão abaixo é hipótese; confirmar em Uso e cobrança quando houver dados.

| Frequência | Telas | Peso na interface |
|---|---|---|
| Toda semana | Chat, Envio do mês, Meus arquivos, Agenda | Atalhos do Início, topo do menu, barra do celular (menos a Agenda) |
| Primeiro mês | Lista de documentos, Bancos e maquininhas | Tarefas do cartão "Hoje"; saem do menu quando a entrada acaba |
| De vez em quando | Cofre, Histórico, Ajuda, Indicar | Grupo "Mais" do menu, letra menor |
| Depende do contrato | Meus sistemas | Topo do menu se a empresa tem algum liberado; senão, em "Mais" |

O que mudou (medido no modo demonstração, Padaria Estrela do Sul):

- **Início:** de 12 cartões e 337 palavras para 3 cartões e ~130 palavras. Um cartão "Hoje" com o passo mais urgente (o único botão principal da tela) e até mais duas pendências em linhas embaixo; antes Hoje, Cadastro e Lista de documentos eram cartões empilhados com o mesmo peso. Quatro atalhos compactos (Chat, Envio do mês, Arquivos, Agenda). Saíram: "Quem cuida da sua empresa" (já está no topo do chat e no Perfil), "Sua empresa na Totali" (números de vaidade), os cartões de progresso que repetiam o "Hoje". O resumo do mês só aparece na primeira semana do mês.
- **Banner:** continua fixo na barra lateral (computador). No celular, onde a barra vira gaveta, aparece no fim do Início e de Sistemas.
- **Menu:** dois níveis; "Mais" com letra menor. Barra do celular: Início, Chat, Envio do mês, Arquivos, Menu (Sistemas foi para o menu).
- **Textos de abertura:** uma linha. O resto foi para "Como funciona?" recolhido (`UI.maisInfo`): Envio do mês (com a tolerância de 48 h), Meus arquivos ("Como enviar"), Cofre ("Como protegemos", sem "chave pública/privada"), Lista de documentos.
- **Lista de documentos:** de 641 para ~160 palavras na abertura. Só o primeiro bloco com pendência abre; botão cheio só no que é do cliente e ainda falta (o que vem da contabilidade anterior fica em contorno); a descrição do item some quando ele foi entregue.
- **Sistemas:** "Conheça também" virou lista compacta (uma linha por sistema, botão de contorno), abaixo dos contratados.
- **Módulos:** os ganchos do Início agora mandam `tarefa` (objeto) em vez de HTML de cartão pronto; o Início monta o "Hoje" com todas, em ordem.
- **Textos (segunda passada):** o login mostra o que o portal faz no dia a dia (antes, as etapas da entrada); a Ajuda abre com perguntas do dia a dia (como falar com a Totali, Envio do mês, contratar/demitir/férias) e deixa a entrada para o fim; Histórico baixa "planilha" e "todos os meus dados" em vez de "CSV" e "JSON"; a Agenda não promete mais guia "pelo portal" (a entrega de guias ainda não existe). A Ajuda e a Agenda são conteúdo editável: se o painel já salvou uma versão própria em Conteúdo, ela continua valendo.
