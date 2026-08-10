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
| Cadastro criado pela Totali (link de convite) | pronto (`equipe.html`) |
| PWA instalável e funcionamento offline | pronto |
| Modelo de dados multiempresa (`empresaId`) | pronto |
| Ciclo de revisão (análise / aprovado / pendência) | modelo e tela do cliente prontos |
| Mensagens cliente ↔ equipe | tela do cliente pronta |
| Avisos no aparelho (portal aberto ou em 2º plano) | pronto |
| Push com o aplicativo fechado | pendente (Firebase Cloud Messaging) |
| Trilha de auditoria | modelo pronto (ver ressalva abaixo) |
| Trilhas da Academy | telas prontas, vídeos pendentes |
| Painel interno da equipe | pendente (`equipe.html`) |
| Login por empresa | pendente (Firebase Authentication) |
| Banco de dados e armazenamento na nuvem | pendente (Firebase) |
| Integração com o checklist contábil interno | pendente |

Enquanto o Firebase não entra, **tudo fica no aparelho do cliente**: o cadastro
no `localStorage` e os arquivos no `IndexedDB`. Nada trafega pela internet.

---

## Estrutura

```
index.html                 Portal do cliente
equipe.html                Uso interno: gera o link de convite do cliente
manifest.webmanifest       Metadados do aplicativo instalável
sw.js                      Service worker (offline). Suba a VERSAO a cada release
css/styles.css             Design system completo (tema escuro)
js/util.js                 Funções puras: escape, máscaras, validações, arquivos
js/data.js                 CONTEÚDO: checklist, etapas, trilhas, FAQ
js/store.js                Estado, persistência e cálculo de progresso
js/ui.js                   Modal, toasts, ícones
js/motion.js               Animações de entrada, contadores e anel de progresso
js/notificacoes.js         Avisos no aparelho e ganchos para o push do Firebase
js/app.js                  Rotas, telas e eventos
js/equipe.js               Lógica do gerador de link (uso interno)
js/pwa.js                  Instalação, service worker e proteções de contexto
assets/                    Logo e ícones do aplicativo
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

### Ressalva sobre a trilha de auditoria

Hoje ela é gravada no aparelho do cliente, portanto **ele pode adulterá-la**.
Serve para dar forma ao recurso e para depuração — não tem valor probatório.
Vira auditoria de verdade quando for escrita no servidor por Cloud Function, com
o `uid` autenticado e sem permissão de escrita para o cliente.

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

`equipe.html` hoje **não tem login** e só monta o link — não acessa documento
nem dado de cliente. Quando o Firebase entrar, ela vira o painel interno
autenticado e o link passa a levar somente um código de convite.

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
| `acesso` | Credencial de sistema. **Nunca** exibe campo de senha |

---

## Segurança

Decisões tomadas e o motivo de cada uma.

**Senhas nunca são coletadas.** O checklist original pede senha do Simples
Nacional, da SEFAZ, do Empregador Web e do emissor de vale transporte. Senha
digitada em formulário fica registrada no navegador, no servidor e nos backups —
qualquer um deles pode vazar, e a responsabilidade passa a ser da contabilidade.
Por isso esses itens viraram do tipo `acesso`: o cliente escolhe entre conceder
**procuração eletrônica no e-CAC**, combinar por canal separado ou informar que a
Totali já tem acesso. Não existe um único `input[type=password]` no sistema.

Isso **não** torna o processo menos autônomo. Os itens de acesso trazem um passo
a passo numerado para o cliente resolver sozinho: como conceder a procuração
eletrônica no e-CAC e como gerar o código de acesso do Simples Nacional. A
procuração é, na prática, o caminho *mais* autônomo — o cliente faz online em
minutos, não precisa entregar credencial nenhuma, escolhe o prazo e pode revogar
quando quiser. Guardar senha de cliente, além do risco, dá trabalho recorrente:
toda troca de senha quebra o acesso e vira um chamado.

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

**O cliente pode apagar tudo** pela tela de Privacidade — cadastro, sócios e
arquivos, do `localStorage` e do `IndexedDB`.

### Ao conectar o Firebase, ainda será preciso

1. Regras do Firestore e do Storage restringindo cada documento ao `uid` da
   empresa dona (`request.auth.uid`). Sem isso, autenticar não protege nada.
2. Limite de tamanho e de tipo **também** nas regras do Storage — a validação do
   navegador é conveniência, não barreira.
3. App Check, para impedir uso das credenciais fora do portal.
4. Domínio próprio com HTTPS e o domínio autorizado no Firebase Authentication.
5. Registro de quem acessou cada documento, para atender à LGPD.

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

```bash
git remote add origin https://github.com/SEU-USUARIO/totali-onboarding.git
git push -u origin main
```

Depois, no GitHub: **Settings → Pages → Source: Deploy from a branch → main /
(root)**. O arquivo `.nojekyll` já está no repositório para que o Pages sirva os
arquivos sem processamento.

O endereço fica `https://SEU-USUARIO.github.io/totali-onboarding/`. Como
`start_url` e `scope` do manifesto são relativos, o PWA funciona nesse subcaminho
sem ajuste.

**A cada alteração**, suba o número em `VERSAO` no `sw.js`. É o que faz o
navegador do cliente buscar a versão nova em vez de servir a antiga do cache.
