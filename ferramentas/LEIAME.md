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
