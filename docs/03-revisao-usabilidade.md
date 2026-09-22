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
2. ~~Checklist do mês~~ — mantido (22/09/2026). Sugestões de ajuste enviadas ao Raoni.
3. ~~Foto do gerente de contas~~ — não existe "gerente de contas": cada empresa tem um responsável por setor (Fiscal, Contábil, Dep. Pessoal, Societário, Financeiro), definidos na ficha do cliente e mostrados no cartão "Quem cuida da sua empresa".
