# Portal do Cliente · Totali Soluções Contábeis

Sistema de onboarding para novos clientes da contabilidade. O cliente envia a
documentação da migração, acompanha as etapas do processo e, futuramente,
assiste às trilhas da Totali Academy.

Aplicação estática (HTML, CSS e JavaScript sem framework), pensada primeiro para
o celular, instalável como aplicativo (PWA) e publicável no GitHub Pages.

---

## Estado atual

| Módulo | Situação |
|---|---|
| Estrutura, navegação e identidade visual | pronto |
| Checklist por departamento (5 áreas) | pronto |
| Envio de arquivos com validação | pronto |
| Cadastro da empresa e dos sócios | pronto |
| Cadastro criado pela Totali (link de convite) | pronto |
| Login do cliente com e-mail e senha | pronto |
| Banco de dados e arquivos no servidor | pronto (Firestore + Storage) |
| PWA instalável e funcionamento offline | pronto |
| Modelo de dados multiempresa (`empresaId`) | pronto |
| Ciclo de revisão (análise / aprovado / pendência) | pronto nos dois lados |
| Mensagens cliente ↔ equipe | pronto nos dois lados |
| Senhas cifradas ponta a ponta | pronto |
| Tutorial guiado no portal do cliente | pronto |
| Painel da equipe em abas | pronto (`equipe.html`) |
| Painel: clientes, pendências, mensagens, conteúdo, chaves | pronto |
| Cobrança do que falta, pelo painel | pronto (envio manual) |
| Etapas clicáveis com liberação progressiva | pronto |
| Checklist financeiro trazido para dentro | pronto, com termo em PDF |
| Academy em destaque após o envio | pronto |
| Trilhas da Academy | telas prontas, vídeos pendentes |
| Avisos no aparelho (portal aberto ou em 2º plano) | pronto |
| Push com o aplicativo fechado | pendente (Firebase Cloud Messaging) |
| Trilha de auditoria | pronta, gravada pelo servidor (`/auditoria`) |
| Cobrança automática por prazo | pronta (`avisarPendencias`, 10h em dias úteis) |
| Dossiê de entrada em PDF | pronto |
| Backup em pasta do computador da equipe | pendente |

O que o cliente envia vai para o **servidor da Totali**, ligado à empresa dele:
cadastro, sócios, mensagens e situação dos documentos no Firestore; arquivos no
Storage. Uma cópia fica no aparelho (`localStorage` e `IndexedDB`) para o portal
abrir rápido e continuar funcionando sem sinal — e **sair da conta apaga essa
cópia**, para que o próximo a usar o computador não veja nada da empresa
anterior.

---

## Estrutura

```
index.html                 Portal do cliente
equipe.html                Painel da equipe (uso interno, com login)
manifest.webmanifest       Metadados do aplicativo instalável
sw.js                      Service worker (offline). Suba a VERSAO a cada release
firestore.rules            Regras do banco — a proteção de verdade
storage.rules              Regras dos arquivos

css/styles.css             Design system completo (tema escuro)

js/util.js                 Funções puras: escape, máscaras, validações, arquivos
js/data.js                 CONTEÚDO padrão: checklist, etapas, trilhas, FAQ
js/conteudo.js             Conteúdo publicado pelo painel (sobrepõe o padrão)
js/situacao.js             Situação e progresso — usado pelo cliente E pelo painel
js/store.js                Estado e persistência
js/nuvem.js                Gravação no servidor (Firestore + Storage)
js/firebase.js             Conexão, login do cliente e da equipe
js/cripto.js               Criptografia ponta a ponta das senhas
js/chave-publica.js        Chave pública da Totali (a privada nunca entra aqui)
js/ui.js                   Modal, toasts, ícones
js/tour.js                 Tutorial guiado
js/motion.js               Animações de entrada, contadores e anel de progresso
js/notificacoes.js         Avisos no aparelho e ganchos para o push do Firebase
js/termo.js                Termo de compromisso em PDF
js/app.js                  Portal do cliente: rotas, telas e eventos
js/pwa.js                  Instalação, service worker e proteções de contexto

js/painel.js               Painel: abas, sessão e identidade de quem está usando
js/painel-clientes.js      Painel: clientes, pendências e mensagens
js/painel-conteudo.js      Painel: editor do conteúdo do portal
js/equipe.js               Painel: cadastro de empresa, link de convite e chaves

lib/                       Bibliotecas vendorizadas (Firebase e jsPDF)
assets/                    Marca e ícones do aplicativo
```

### Onde mexer para cada coisa

- **Incluir, remover ou reescrever um documento do checklist** → `js/data.js`.
  Nada mais precisa mudar: progresso, telas e ajuda se ajustam sozinhos.
- **Mudar textos de contato, e-mail ou WhatsApp** → objeto `ORG`, em `js/data.js`.
- **Mudar cores, espaçamentos, cantos** → bloco `:root` em `css/styles.css`.
- **Publicar uma trilha da Academy** → altere `status` para `"disponivel"` no
  item de `ACADEMY` e acrescente a lista de vídeos.

### Visual

Tema escuro sobre o azul-noite da Totali, com superfícies de vidro fosco
(`backdrop-filter`) e o dourado da marca como único destaque. O fundo tem quatro
camadas fixas — aurora em movimento lento, brilho pulsante, malha e granulado —
declaradas no `index.html` e desenhadas em `css/styles.css`.

O movimento fica isolado em `js/motion.js`: blocos entram em cascata conforme
aparecem na tela, os números contam progressivamente e o anel de progresso se
desenha. **Regra que não pode ser quebrada:** a animação nunca esconde conteúdo.
O CSS só oculta um bloco quando o `motion.js` marca `<html class="motion">`, e
existe uma rede de segurança que revela tudo em 1,6 s caso as animações não
disparem (aba em segundo plano, navegador antigo, erro de script). Quem pediu
menos movimento no sistema operacional recebe a interface estática.

Contraste calibrado em duas rodadas. O piso não é preto (`#0f1c2a`) e o texto
não é branco puro (`#eaf1f8`), mas o texto **é nítido**: 15,1:1 no principal,
9,3:1 no secundário, 7,1:1 no terciário e 10,1:1 nos dourados.

A regra que saiu daí, e que vale para qualquer ajuste futuro: **o brilho fica
nos elementos, nunca atrás da letra.** Anéis, selos, bordas, ícone da aba ativa
e barra de progresso têm halo — é o que dá o ar tecnológico. Texto não tem halo
nem `-webkit-font-smoothing: antialiased` (que afina a fonte em fundo escuro e
faz a leitura parecer lavada). Foi o que devolveu a nitidez sem trazer de volta
o desconforto.

### Modelo de dados

O estado é multiempresa desde já. `empresaId` nasce na primeira visita e é o
que separa um cliente do outro — no Firebase ele vira o id do documento em
`empresas/{empresaId}`.

Mapeamento planejado, para não haver surpresa na migração:

```
empresas/{empresaId}                    cadastro, regime, responsável, etapa
empresas/{empresaId}/itens/{chave}      arquivos[], valor, na, forma, revisao{}
empresas/{empresaId}/socios/{socioId}   nome, cpf
empresas/{empresaId}/mensagens/{id}     autor, texto, chave, lidaEm
empresas/{empresaId}/eventos/{id}       auditoria
usuarios/{uid}                          papel ("cliente" | "equipe"), empresaId
Storage: empresas/{empresaId}/{chave}/{arquivoId}
```

`Store.chaveItem()` já produz `fiscal/contrato-social` e
`socios/{socioId}/rg` — a mesma chave serve de id de documento e de caminho no
Storage, sem conversão.

### Ciclo de vida de um documento

| Situação | Quem define | Conta no progresso |
|---|---|---|
| `pendente` | nada enviado | não |
| `enviado` | cliente anexou | sim |
| `analise` | equipe começou a conferir | sim |
| `aprovado` | equipe aceitou | sim |
| `pendencia` | equipe recusou, com motivo | **não** |
| `substituido` | CNH cobre RG e CPF | sim |
| `na` | não se aplica | fora da conta |

Reenviar um documento **limpa a revisão anterior** (`Store.anexar`): uma
pendência não pode continuar valendo sobre um arquivo novo. A pendência aparece
para o cliente com o motivo escrito pela equipe, destacada em vermelho, e sobe
para o topo de "Precisa da sua atenção" na tela inicial.

A API que o painel interno vai consumir já existe em `js/store.js`:
`Store.revisar(chave, status, motivo, por)`, `Store.enviarMensagem(texto, {autor, chave})`,
`Store.mensagens(chave)`, `Store.naoLidas(paraQuem)`, `Store.registrarEvento(...)`.

### Duas trilhas com nomes parecidos, e só uma vale como prova

`/empresas/{id}/eventos` é gravada **pelo navegador do cliente**, portanto ele
pode adulterá-la. Serve para acompanhar e depurar — não tem valor probatório.

`/auditoria`, na raiz, é gravada por **Cloud Function** com a hora do servidor
(`functions/auditoria.js`), e a regra fecha a escrita para todo mundo, inclusive
admin. É essa que vale: quem aprovou o quê, quem abriu qual senha, quando.
Ao investigar qualquer coisa, é nela que se olha.

Ela sobrevive de propósito à exclusão do cliente. Para pedido de eliminação pela
LGPD existe `ferramentas/anonimizar-auditoria.js`, que desliga a trilha da pessoa
sem destruir a prova.

O mesmo vale para o papel do usuário: `sanear()` força `papel: "cliente"` ao
carregar, ignorando o que estiver gravado. Quem decide papel é o login, nunca o
armazenamento local.

### Departamentos

O checklist é dividido pelas áreas que realmente cuidam de cada documento:

| Departamento | Itens | Escopo |
|---|---|---|
| Societário | 1 | empresa |
| Contábil | 3 | empresa |
| Fiscal | 4 | empresa |
| Departamento Pessoal | 9 | empresa |
| Documentos dos sócios | 9 | **por sócio cadastrado** |

O item "Declaração de Imposto de Renda dos sócios", que no checklist em papel
aparecia duas vezes (uma na área contábil e outra na lista dos sócios), ficou
só na lista dos sócios. Pedir o mesmo documento duas vezes confunde o cliente.
Se quiser o item de volta na área contábil, é uma entrada em `js/data.js`.

### Cadastro criado pela equipe

Quem cadastra a empresa é a Totali, não o cliente. Em `equipe.html` a equipe
preenche razão social, fantasia, CNPJ e regime, e recebe um link pronto (com
mensagem sugerida e atalho para o WhatsApp).

Ao abrir o link, o portal grava os dados, mostra o **nome da empresa no
cabeçalho** e trava esses campos: o cliente confere, mas só edita o contato
dele. Se algo estiver errado, ele avisa pelas Mensagens.

O link carrega **apenas dados da empresa** — nunca dado pessoal — porque
endereço de página fica em histórico, em captura de tela e em quem mais receber
o encaminhamento. Assim que é lido, o parâmetro é removido da barra de endereço
(`history.replaceState`). Se o link for de outra empresa e já houver dados no
aparelho, nada é sobrescrito.

O link leva **apenas um código de convite**, que vale uma vez só: ao abri-lo, o
cliente cria a própria senha, o portal registra o acesso e **queima o convite**.
Link encaminhado ou vazado depois não dá acesso a ninguém. Daí em diante o
cliente entra por e-mail e senha, de qualquer aparelho.

`equipe.html` é o painel da equipe, com login próprio e organizado em abas:

| Aba | Para quê |
|---|---|
| Clientes | Situação de cada um; ficha com documentos, sócios, financeiro e senhas |
| Pendências | Só o que falta chegar, por empresa e por setor, com botão de cobrar |
| Mensagens | Caixa de entrada de todas as conversas, com as não lidas em destaque |
| Novo cliente | Cadastro da empresa e geração do link de convite |
| Conteúdo do portal | Vídeos, trilhas, documentos, perguntas e textos — nada por código |
| Usuários | Quem entra no painel, e o crachá de cada um |
| Segurança | Estado do canal seguro e cuidados; troca de chave fica recolhida |

A ficha do cliente tem quatro vistas: **Documentos**, **Bancos e senhas**,
**Cadastro e acesso** e **Conversa**. Nela a equipe **aprova**, **pede correção
com motivo** (o texto aparece para o cliente) ou tira a marcação.

As senhas chegam cifradas e **quem as abre é o servidor**: a chave privada mora
no Secret Manager e nunca passa por navegador. Qualquer pessoa da equipe abre
pelo botão **Ver senha**, sem arquivo de chave, e cada abertura fica registrada
com nome e hora. Na tela a senha nasce coberta, com botão de mostrar.

### Integração dos outros sistemas

Este portal é a **porta de entrada única** do cliente. Os demais sistemas da
Totali passam a viver aqui dentro, e não como links soltos.

**Checklist financeiro** (`github.com/totalicontabilidade/checklist-financeiro`)
— o conteúdo já foi trazido: bancos, maquininhas, forma de envio dos relatórios
e observações agora são a **etapa 4** do onboarding (`#/financeiro`), com as
mesmas listas do sistema original.

Duas diferenças em relação ao original:

1. **As credenciais de maquininha são cifradas.** No sistema antigo login e
   senha iam em texto legível para o Firestore, protegidos apenas pela regra de
   acesso. Aqui passam pela criptografia ponta a ponta descrita na seção de
   segurança: saem embaralhadas do aparelho do cliente e só abrem com a chave
   privada da Totali. Recomende ao cliente um **perfil de consulta** na
   maquininha — baixa relatório sem permitir movimentar dinheiro.
2. **O termo em PDF é gerado aqui mesmo** (`js/termo.js`), com o jsPDF
   vendorizado em `lib/` — a CSP bloqueia CDN de propósito. Os três relatórios
   do compromisso aparecem na tela e no PDF, para o cliente não depender de ler
   o documento inteiro.

**Para integrar um sistema novo**, o caminho é sempre o mesmo: o conteúdo entra
em `js/data.js`, o estado ganha um ramo em `estadoInicial()` com validação
correspondente em `sanear()`, a tela vira uma `view*()` em `js/app.js` com rota
em `ROTAS`, e a etapa entra em `DATA.ETAPAS`. A trilha, o progresso e a
navegação se ajustam sozinhos.

### Etapas e liberação progressiva

`Store.trilha()` devolve as seis etapas com a situação de cada uma
(`concluida`, `atual`, `aberta`, `bloqueada`). Uma etapa só abre quando a
anterior está concluída, e cada etapa liberada é um botão que leva direto à sua
tela. As bloqueadas mostram o motivo, para o cliente nunca ficar sem saber o que
falta.

Quando documentos e financeiro terminam, a **Academy sobe para o topo da tela
inicial** e deixa de ser rodapé: é o que faz o cliente voltar ao portal depois
da migração.

### Notificações

São duas coisas diferentes, e só uma existe hoje:

1. **Aviso local — funcionando.** O portal está aberto ou em segundo plano e
   dispara o aviso sozinho (`js/notificacoes.js`). Não precisa de servidor.
   Só avisa quando a pessoa **não** está olhando a tela em questão, e nunca
   avisa alguém da própria ação.
2. **Push com o aplicativo fechado — pendente.** Exige servidor. Os ouvintes
   `push` e `notificationclick` já estão no `sw.js`; falta ligar o Firebase
   Cloud Messaging e guardar a inscrição de cada aparelho.

**Limite do iPhone:** no iOS, notificação da web só funciona com o portal
**instalado na tela de início** (iOS 16.4+). No Safari comum o iPhone não
notifica — nada no código muda isso. Por isso o portal explica o motivo em vez
de simplesmente falhar.

Ao ligar o Cloud Messaging, lembre de liberar o domínio do Firebase em
`connect-src` na CSP do `index.html` — hoje ela permite apenas a própria origem.

### Tipos de item do checklist

| `kind` | Comportamento |
|---|---|
| `arquivo` | Upload com validação de tipo, tamanho e nome |
| `dado` | Campo curto de texto ou seleção (ex.: PIS, escolaridade) |
| `acesso` | Credencial de sistema. Senha cifrada no aparelho do cliente |

---

## Segurança

Decisões tomadas e o motivo de cada uma.

### Senhas: criptografia ponta a ponta

O cliente informa senhas pelo portal — certificado digital, Simples Nacional,
SEFAZ, Empregador Web, vale transporte e o login de cada maquininha. **Elas
nunca existem em texto legível em lugar nenhum do sistema.**

Como funciona (`js/cripto.js`):

1. O cliente digita. Nada é gravado ainda.
2. Ao tocar em "Guardar com segurança", os valores são cifrados **no aparelho
   dele**: sorteia-se uma chave AES-GCM de 256 bits só para aquele envio, ela
   cifra os dados, e essa chave é trancada com a **chave pública RSA-OAEP da
   Totali**.
3. Só o envelope fechado entra no estado. Os campos são limpos da tela na
   sequência.

Consequência: quem tiver o `localStorage`, o backup, o banco de dados ou o
próprio celular do cliente vê apenas texto embaralhado. Abrir exige a chave
privada, que fica fora do sistema.

**Verificado em teste:** senha ausente do `localStorage`, do DOM e da trilha de
auditoria (que registra *que houve* envio e quais campos, nunca o conteúdo);
chave errada não abre; envelope adulterado não abre (o AES-GCM autentica);
credencial plantada em texto às claras no armazenamento é descartada ao carregar.

**O preço disso, que precisa estar claro:**

- A chave privada é a única forma de ler. **Perdeu, perdeu** — não há
  recuperação, e é justamente isso que impede que outra pessoa leia.
  Guarde em cofre de senhas e mantenha uma cópia offline.
- Quem tem a chave privada lê tudo. Ela não é de uso diário e não deve ficar no
  computador de trabalho.
- Trocar a chave não reabre o que já foi enviado. Guarde as chaves antigas
  enquanto houver dado cifrado com elas.

**Enquanto `js/chave-publica.js` estiver `null`**, o portal recusa qualquer
senha e avisa o cliente, em vez de guardar às claras. Gere o par em
`equipe.html` → "Gerar par de chaves".

Os itens de acesso continuam oferecendo alternativas a quem preferir não digitar
senha: procuração eletrônica no e-CAC (com passo a passo numerado) ou "já está
com a Totali".

**Recomendação operacional:** onde a maquininha permitir (Stone e Cielo, entre
outras), peça ao cliente um **usuário só de consulta**. Baixa relatório, não
movimenta dinheiro. O portal já sugere isso ao cliente.

**Content Security Policy restritiva** (`index.html`). `script-src 'self'`
bloqueia qualquer script injetado, inclusive inline. Nenhuma CDN é usada: todos
os arquivos vêm da própria origem.

**Todo dado do usuário é escapado** antes de virar HTML, via `U.esc()`
(`js/util.js`). Testado com carga de XSS em nome de sócio e nome de arquivo.

**Nomes de arquivo são saneados**: caminho removido, caracteres de controle
descartados, tamanho limitado. Bloqueia travessia de diretório do tipo
`../../etc/senha.pdf`.

**Upload em lista de permissão**: só PDF, imagens, planilhas, documentos do
Office, TXT, XML, CSV e ZIP. Extensão e tipo MIME precisam bater entre si.
Limite de 20 MB por arquivo e 300 MB no total.

**Proteção contra clickjacking** em `js/pwa.js`. O GitHub Pages não permite
enviar cabeçalhos HTTP, então `frame-ancestors` e `X-Frame-Options` não estão
disponíveis; a verificação em JavaScript impede que o portal seja carregado
dentro do iframe de outro site.

**Estado adulterado é higienizado ao carregar** (`sanear()`, em `js/store.js`).
O conteúdo do `localStorage` é sempre tratado como não confiável.

**Apagar dado de cliente é decisão da Totali, não do cliente.** O botão de
apagar tudo saiu do portal por pedido da contabilidade: documento entregue faz
parte do processo contábil e some por decisão da equipe. Sair da conta apaga a
cópia local, nunca o que está no servidor.

### O que protege de verdade: as regras

`firestore.rules` e `storage.rules` são a barreira real — a tela apenas esconde.
**O vínculo entre cliente e empresa não depende de Cloud Function**, e isso é de
propósito: se as funções caírem, o cliente continua entrando e enviando
documento. O vínculo nasce do convite:

1. A equipe cadastra a empresa e gera um convite com código longo e sorteado.
2. O cliente abre o link **uma vez**, cria a senha, e o portal registra
   `empresas/{id}/acessos/{uid}` e `clientes/{uid}`, queimando o convite.
3. Daí em diante, é a existência do documento de acesso que autoriza tudo.
   Apagar esse documento corta o acesso na hora.

Consequências assumidas, que precisam estar escritas:

- **`/empresas/{id}/eventos` é gravada pelo navegador**, então o cliente pode
  inventar um evento. Não tem valor probatório. A trilha que vale é `/auditoria`
  na raiz, escrita por Cloud Function e fechada para escrita de todo mundo.
- **Apagar documento é só de administrador.** O cliente que remove um arquivo
  deixa o registro vazio, e o histórico de conferência da equipe permanece.
- **Credencial cifrada só admin lê.** Para o portal continuar sabendo que a
  senha já foi enviada, guarda-se um recibo (quais campos, quando) sem nada do
  conteúdo.
- **Só senha de usuário de consulta.** O portal exige isso do cliente e o manda
  falar com a equipe quando a maquininha não permitir criar esse usuário. Senha
  de movimentação não deve entrar no sistema.

### Ainda pendente na segurança

1. **App Check no Authentication** — Storage e Firestore já estão exigindo desde
   24/08/2026; o de Authentication segue em monitoramento porque o Google ainda
   o marca como pré-lançamento.
2. **Domínio próprio com HTTPS** (o GitHub Pages já serve em HTTPS).

---

## Cloud Functions

Seis funções publicadas, região `southamerica-east1`. Elas fazem o que o
navegador não pode fazer — e só isso, para que uma queda delas não impeça o
cliente de usar o portal.

| Função | Arquivo | O que faz |
|---|---|---|
| `processarExclusaoDeConta` | `index.js` | Apaga a conta de login do cliente junto com a empresa |
| `abrirCredencial` | `senhas.js` | Abre a senha guardada para a equipe e varre os pedidos velhos |
| `auditarItem` · `auditarCredencial` · `auditarAcesso` | `auditoria.js` | Escrevem a trilha de `/auditoria` com a hora do servidor |
| `avisarPendencias` | `lembretes.js` | Cobra por e-mail às 10h em dias úteis |

Nenhuma delas é **chamável** (`onCall`): a política da organização proíbe expor
`allUsers`, e função de 2ª geração roda sobre Cloud Run, que recusaria a chamada.
O padrão aqui é o inverso — **o painel grava um documento de pedido e a função
reage** (`onDocumentCreated`). Sai melhor: sem endereço público, autorização
pelas próprias regras do Firestore, sem CORS, e o pedido já vira registro.

`processarExclusaoDeConta` recusa, de propósito, dois casos: conta que tem
documento em `usuarios` (é da equipe) e conta que ainda tem acesso a outra
empresa (o mesmo login pode cuidar de vários CNPJs).

Para publicar, numa janela **normal** do PowerShell (o `.ps1` é bloqueado, então
`firebase.cmd`, nunca `firebase`):

```bash
cd functions; npm.cmd install; cd ..
firebase.cmd deploy --only functions --project portaldocliente-8cc7d
```

Se o token tiver expirado, `firebase.cmd login --reauth` antes.

---

## Rodando localmente

Abrir o `index.html` direto pelo Explorer funciona parcialmente: o service worker
não registra em `file://`. Para testar do jeito real, suba um servidor local:

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File serve.ps1
```

E acesse `http://localhost:8099`.

---

## Publicando no GitHub Pages

### 1. Subir o código

```bash
git remote add origin https://github.com/totalicontabilidade/portaldocliente.git
git push -u origin main
```

No GitHub: **Settings → Pages → Source: Deploy from a branch → main / (root)**.
O `.nojekyll` já está no repositório, para o Pages servir os arquivos sem
processar. Em um ou dois minutos o endereço responde:

```
https://totalicontabilidade.github.io/portaldocliente/
```

Todos os caminhos do sistema são relativos, e `start_url` e `scope` do manifesto
também — o PWA funciona nesse subcaminho sem ajuste nenhum.

### 2. Liberar o domínio no Firebase — sem isto, ninguém entra

**Authentication → Settings → Authorized domains → Add domain:**

```
totalicontabilidade.github.io
```

Sem esse passo o login falha com `auth/unauthorized-domain`, e o erro não diz o
que fazer.

### 3. Liberar o domínio no Storage (CORS)

O CORS do bucket é uma **lista fechada**. Domínio de fora dela ainda abre o
documento em outra aba, mas para de baixar os bytes: some a prévia de imagem no
anexo e a cópia para uso sem internet.

No Cloud Shell do Google, projeto `portaldocliente-8cc7d`:

```bash
printf '[{"origin":["https://totalicontabilidade.github.io"],"method":["GET"],"responseHeader":["Content-Type","Content-Disposition"],"maxAgeSeconds":3600}]' > cors.json && gcloud storage buckets update gs://portaldocliente-8cc7d.firebasestorage.app --cors-file=cors.json
```

**Refaça este passo a cada mudança de endereço do portal** — inclusive ao trocar
para domínio próprio.

### 4. Conferir, nesta ordem

1. Abrir `https://totalicontabilidade.github.io/portaldocliente/equipe.html` e
   entrar no painel.
2. Conferir que o campo **Endereço do portal** já veio com o endereço
   publicado. Ele ignora endereço salvo de outro servidor justamente para não
   gerar link de `localhost` depois da publicação.
3. Cadastrar uma empresa de teste e abrir o link em janela anônima.
4. Criar o acesso, enviar um documento e sair da conta.
5. Entrar de novo: tudo tem que estar lá.
6. No celular, tocar em "Instalar" e conferir o ícone na tela de início.

### A cada release

Suba o número em `VERSAO` no `sw.js`. É o que faz o navegador do cliente buscar
a versão nova em vez de servir a antiga do cache — sem isso, a correção não
chega a quem já usou o portal.
