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

## Subir a chave privada para o cofre

Feito **uma vez**. Depois disso ninguém volta lá.

A Cloud Function `abrirCredencial` lê a chave privada de um
segredo chamado `chave-privada-credenciais`, no Secret Manager do
projeto. Sem ele, o botão "Ver senha" responde erro.

O arquivo é o mesmo `totali-chave-privada-NAO-COMPARTILHAR.json`
gerado em equipe.html. Dentro dele há um campo `chave` — é o
conteúdo desse campo que sobe, não o arquivo inteiro.

No Cloud Shell, com o arquivo enviado para lá pelo botão de
upload:

    node -e "console.log(JSON.stringify(require('./totali-chave-privada-NAO-COMPARTILHAR.json').chave))" > chave.json
    gcloud secrets create chave-privada-credenciais --data-file=chave.json --project=portaldocliente-8cc7d
    rm chave.json

E dar à conta que roda as funções permissão de ler o segredo:

    gcloud secrets add-iam-policy-binding chave-privada-credenciais \
      --member="serviceAccount:114944286344-compute@developer.gserviceaccount.com" \
      --role="roles/secretmanager.secretAccessor" \
      --project=portaldocliente-8cc7d

**Apague o arquivo do Cloud Shell depois**, num comando separado —
não encadeado com `&&` na criação do segredo. Ele é uma máquina
compartilhada com a sua conta, não um cofre:

    rm -f ~/totali/totali-chave-privada-NAO-COMPARTILHAR.json

### Cuidado ao escrever comandos para o Cloud Shell

Nada de `!` dentro de comando colado no bash interativo. Ali
`!!` significa "repita o comando anterior", e o shell cola o
comando velho no meio do novo antes de executar. Aconteceu aqui
com um `console.log('tem chave:', !!k)` — em vez de checar a
chave, o bash montou uma linha sem sentido e deu erro de sintaxe.

Use `k ? 'sim' : 'nao'` no lugar de `!!k`.

Guarde a cópia offline do arquivo mesmo assim: se o segredo for
apagado por engano, é dela que ele volta.
