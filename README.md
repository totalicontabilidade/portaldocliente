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
| Checklist de documentos (27 itens em 3 grupos) | pronto |
| Envio de arquivos com validação | pronto |
| Cadastro da empresa e dos sócios | pronto |
| PWA instalável e funcionamento offline | pronto |
| Trilhas da Academy | telas prontas, vídeos pendentes |
| Login por empresa | pendente (Firebase Authentication) |
| Banco de dados e armazenamento na nuvem | pendente (Firebase) |
| Integração com o checklist contábil interno | pendente |

Enquanto o Firebase não entra, **tudo fica no aparelho do cliente**: o cadastro
no `localStorage` e os arquivos no `IndexedDB`. Nada trafega pela internet.

---

## Estrutura

```
index.html                 Casca do app: cabeçalho, menus, sprite de ícones
manifest.webmanifest       Metadados do aplicativo instalável
sw.js                      Service worker (offline). Suba a VERSAO a cada release
css/styles.css             Design system completo
js/util.js                 Funções puras: escape, máscaras, validações, arquivos
js/data.js                 CONTEÚDO: checklist, etapas, trilhas, FAQ
js/store.js                Estado, persistência e cálculo de progresso
js/ui.js                   Modal, toasts, ícones
js/app.js                  Rotas, telas e eventos
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
