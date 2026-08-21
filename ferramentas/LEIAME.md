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

---

## anonimizar-auditoria.js — pedido de exclusão pela LGPD

Excluir um cliente pelo painel apaga tudo o que é dele. Uma coisa
sobra de propósito: a trilha em `/auditoria`. Ela é fechada para
escrita de todo mundo — cliente, equipe e administrador — e é isso
que faz dela prova. Se qualquer um pudesse apagar uma linha,
nenhuma linha valeria nada.

Só que a LGPD dá ao titular o direito de pedir a eliminação dos
dados (art. 18, VI), e a mesma lei manda conservar o necessário ao
cumprimento de obrigação legal (art. 16, I). Uma contabilidade tem
prazo de guarda e precisa conseguir dizer "este documento foi
aprovado nesta data" mesmo depois de o cliente sair.

Esta ferramenta resolve os dois lados: **não apaga a trilha,
desliga ela da pessoa.**

Depois de rodar, um registro que dizia

    empresaId  WVMIOtS9UXUNM43RB6hI
    tipo       item:enviado
    chave      socios/rg/hPuzsLeSAcr6EQTmPR4x
    arquivos   ["RG CARLOS MENDES 529982.pdf"]

passa a dizer

    empresaId  anon:533096d40f4fd472
    tipo       item:enviado
    chave      socios/rg
    arquivos   1

O fato, a hora do servidor e quem da Totali agiu continuam lá. O
nome, o CPF, o nome do arquivo e o id da empresa, não.

### Como rodar

    cd ~/totali
    node anonimizar-auditoria.js --listar              # quem tem trilha
    node anonimizar-auditoria.js <empresaId>           # só mostra
    node anonimizar-auditoria.js <empresaId> --aplicar # age

Rode **depois** de excluir a empresa pelo painel. Se ela ainda
existir, a ferramenta recusa — anonimizar a trilha de um cliente
ativo deixa você sem histórico dele sem apagar nada do que é dele
de verdade. Para insistir mesmo assim: `--mesmo-viva`.

**Não tem volta.** O apelido vem de um SHA-256 com sal, e o id
original não volta do hash. O sal está escrito no arquivo; trocá-lo
faz os apelidos antigos e novos deixarem de combinar, então não
troque depois da primeira anonimização.

---

## zerar-trilhas.js — limpar o banco antes de valer

Três coleções são fechadas para escrita no navegador, de propósito,
e por isso o painel não consegue limpá-las:

    /auditoria         trilha do servidor — ninguém escreve nela,
                       nem cliente, nem equipe, nem administrador
    /exclusoesDeConta  pedidos de exclusão já processados
    /pedidosDeSenha    cada abertura de senha de maquininha

**Fora de um recomeço, mexer nisso é errado.** Trilha que se apaga
não prova nada, e o dia em que alguém perguntar "quem aprovou este
balanço, e quando" a resposta precisa existir.

Use uma vez só, antes de o sistema entrar em uso de verdade, para
tirar o rastro dos testes.

    cd ~/totali
    node zerar-trilhas.js                 # só mostra, por tipo
    node zerar-trilhas.js --apagar        # pede a frase de confirmação

Para pedido de exclusão pela LGPD **não use este**: existe o
`anonimizar-auditoria.js`, que desliga a trilha da pessoa sem
destruir a prova.

Ele não toca em `/usuarios`, `/conteudo`, `/empresas` nem no
Storage. Empresa se apaga pelo painel, que sabe a ordem certa e
ainda apaga a conta de login do cliente.

### Como trazer as ferramentas para o Cloud Shell

Elas moram no repositório, não na máquina. Para atualizar todas de
uma vez:

    cd ~/totali
    for f in limpar-contas limpar-firestore anonimizar-auditoria zerar-trilhas; do
      curl -fsSL -O "https://raw.githubusercontent.com/totalicontabilidade/portaldocliente/main/ferramentas/$f.js"
    done
    ls -l *.js

---

## zerar-tudo.js — recomeçar do zero absoluto

Apaga **todas** as coleções do Firestore (com subcoleções), **todos**
os arquivos do Storage e **todas** as contas do Authentication —
inclusive as suas.

Ele não confia numa lista de coleções escrita à mão: pergunta ao
banco quais existem. É o que pega coleção antiga, de versão
anterior, que ninguém lembra que está lá.

    cd ~/totali
    node zerar-tudo.js                     # só mostra
    node zerar-tudo.js --apagar            # pede a frase APAGAR TUDO
    node zerar-tudo.js --apagar --sem-contas    # poupa o Authentication
    node zerar-tudo.js --apagar --sem-arquivos  # poupa o Storage

### Depois dele, ninguém entra no painel

E o sistema **não se conserta sozinho**: a regra diz que só admin
cria admin, e não vai sobrar nenhum. Aconteceu em 14/08/2026 por
acidente; aqui é de propósito.

A volta é pelo console do Firebase, na mão:

**1. Authentication → Users → Add user**
E-mail e senha do primeiro admin. Depois de criar, **copie o UID**
que aparece na coluna da direita, na lista de usuários.

**2. Firestore → Iniciar coleção → `usuarios`**
No campo *ID do documento*, **cole o UID** do passo 1. Não use o ID
automático — a regra procura o documento pelo uid de quem está
logado, então um ID qualquer não serve para nada.

Campos:

| campo | tipo | valor |
|---|---|---|
| `nome` | string | seu nome |
| `email` | string | o mesmo do passo 1 |
| `papel` | string | `admin` |

**3. Abra `equipe.html` e entre.** A partir daí o painel cria os
outros membros sozinho, em Usuários → Adicionar membro.

Se entrar e o painel disser que a conta não tem acesso: o ID do
documento não é o uid, ou `papel` não está exatamente `admin`.

### O que ele não toca

Regras do Firestore e do Storage, Cloud Functions, App Check, o
segredo `chave-privada-credenciais` no Secret Manager e o par de
chaves em `js/chave-publica.js`. Nada disso é dado de cliente, e
refazer sem precisar só cria chance de quebrar o que funciona.
