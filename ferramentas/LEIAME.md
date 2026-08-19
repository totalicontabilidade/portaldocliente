# Ferramentas de manutenção

Programas que **não** fazem parte do portal. Rodam à mão, no
Cloud Shell, com as credenciais de quem está executando.

Ficam aqui, e não em `functions/`, de propósito: nada disto é
publicado nem roda sozinho. São ferramentas de faxina, e faxina
automática é como se apaga o que não devia.

## limpar-contas.js

Faz a triagem do Firebase Authentication: cruza cada conta com o
Firestore e separa equipe, cliente, recente e órfã. Só órfã é
candidata a apagar.

Roda sem apagar nada por padrão. Ver o cabeçalho do arquivo.

## limpar-firestore.js

Procura documentos que apontam para coisas que não existem mais:
equipe sem conta de login, índice de cliente órfão, acesso de
conta apagada, convite para empresa que já era, pedido de
exclusão antigo.

Nunca toca em conteúdo — empresa, documento, mensagem, credencial
e anotação ficam. Apagar empresa é decisão de negócio e se faz
pelo painel, que sabe a ordem certa e ainda limpa o Storage.

Roda sem apagar nada por padrão.

## A ordem importa

Rode `limpar-contas.js` **primeiro**. Ele apaga contas de login;
o `limpar-firestore.js` então enxerga os registros que ficaram
apontando para elas. Ao contrário, a segunda faxina não veria
nada.
