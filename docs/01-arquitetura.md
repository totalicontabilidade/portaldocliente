# Portal do Cliente · Arquitetura e decisões

**Versão:** 1 · 21/09/2026 · Totali Soluções Contábeis

## 1. O que é

A porta de entrada única do cliente da Totali. Nele o cliente conversa com a equipe, envia documentos e senhas, acompanha os 30 dias de onboarding e abre todos os sistemas da Totali que contratou. O **painel da equipe** (`equipe.html`) existe para alimentar o portal: cadastrar, liberar, conduzir a jornada, responder, conferir, publicar campanhas e medir uso para cobrar.

Duas pesquisas sustentam o desenho: a do design system do Agência 100K (ergonomia de cor, arquitetura de informação) e a de engajamento em `docs/00-pesquisa-engajamento.md` (vieses, sensorial, vitrine).

## 2. Stack e por quê

| Peça | Escolha | Motivo |
|---|---|---|
| Front | HTML, CSS e JavaScript puros, sem framework | é o padrão dos sistemas de cliente da Totali (Academy, Hub, GE Rescisão); publica no GitHub Pages; PWA instalável; zero build |
| Visual | tokens do Agência 100K em `css/tokens.css` (claro padrão, escuro por classe `.dark`, sidebar navy com quebra-cabeça) | pedido: "visual igual ao Agência 100K, com modo escuro" |
| Fonte | Manrope variável, self-hosted | mesma do Agência 100K; a CSP não permite fonte externa |
| Dados | Firebase (Auth e-mail/senha, Firestore, Storage, Functions) via SDK compat vendorizado em `lib/` | mesmo projeto e mesmas Cloud Functions do Academy podem ser reaproveitados; a chave pública do cofre de senhas é a mesma |
| Modo local | `js/dados.js` tem um motor em localStorage/IndexedDB com dados fictícios | permite ver e avaliar tudo sem servidor; vira Firebase ao preencher `js/firebase-config.js` |

O Agência 100K é Next.js + Postgres porque é um SaaS multi-tenant vendido para fora. Aqui o cliente é o cliente da Totali, o público usa celular, e a operação já vive no Firebase. Reescrever em Next.js custaria VPS, Docker e um segundo login sem ganho para o cliente.

## 3. Estrutura

```
index.html         Portal do cliente
equipe.html        Painel da equipe
anterior.html      Envio pela contabilidade anterior, sem login (link com código)
css/tokens.css     Design system (Agência 100K)
css/app.css        Componentes e layout, mobile first
js/tema.js         Claro / escuro / sistema (carrega antes de pintar)
js/util.js         Funções puras (escape, datas, arquivos, CSV)
js/icones.js       Ícones em traço
js/ui.js           Toast, modal, celebração, háptica, som, widgets
js/catalogo.js     Os sistemas da Totali e as campanhas padrão da vitrine
js/jornada.js      A jornada de 30 dias (D e P), dois lados: cliente e equipe
js/dados.js        Camada de dados: motor local e motor Firebase, mesma API
js/uso.js          Auditoria de uso (o que o cliente abre, por quanto tempo)
js/chat.js         Chat (emojis, anexos, reações, visto)
js/cripto.js       Cofre de senhas, ponta a ponta (do Academy)
js/shell.js        Casca: sidebar, topbar, tabbar, roteador por hash
js/app.js          Telas do portal
js/painel.js       Telas do painel
js/anterior.js     Página da contabilidade anterior
functions/         Cloud Functions: auditoria, senhas, resumo/lembretes
firestore.rules    A proteção de verdade
storage.rules      Arquivos
```

## 4. Modelo de dados (Firestore)

```
empresas/{id}                    nome, fantasia, cnpj, regime, perfis[], trilha (A|B|C), responsaveis{ fiscal|contabil|trabalhista|societario|financeiro: {uid, nome} },
                                 canalPreferido, formaRelatorio, dor, marcos{}, migracaoConcluidaEm, feedback30{},
                                 liberacoes{ sistemaId: {ativo, desde, ate, plano} },
                                 jornada{ aceiteEm, passos{ "d5.c.2": {em, por} }, notas{}, concluidaEm }
empresas/{id}/acessos/{uid}      nome, email, criadoEm, ultimoAcesso
empresas/{id}/mensagens/{id}     autor{uid, nome, lado, sistema?}, texto, anexos[], em, lidaPor{uid: ms}, reacoes{emoji: [uid]}
empresas/{id}/documentos/{id}    nome, grupo, origem (cliente|anterior|equipe), arquivo{path, nome, tamanho, mime},
                                 situacao (enviado|analise|aprovado|pendencia), revisao{por, em, motivo}, vistos[{por, em}], codigo?
empresas/{id}/credenciais/{id}   rotulo, tipo, usuario, por, em, pacote (envelope RSA-OAEP + AES-GCM)
empresas/{id}/checklist/{anoMes} itens[{id, texto, prazoDia, grupo, feito, feitoEm, origem, aceite{por, em}}], concluidoEm, avisoAutomaticoEm
empresas/{id}/eventos/{id}       rastro auxiliar (navegador); não probatório
clientes/{uid}                   nome, email, empresas[], empresaAtual
usuarios/{uid}                   equipe: nome, email, papel (admin|equipe), setor
convites/{codigo}                empresaId, usado, usadoPor
anterior/{codigo}                empresaId, empresa, ativo
uso/{id}                         empresaId, uid, nome, tipo (abrir|tela|sessao|vitrine), sistemaId, tela, duracaoS, dispositivo, em
auditoria/{id}                   escrita só pela Cloud Function, hora do servidor
vitrine/{id}                     campanha: sistemaId, titulo, texto, cta, publico, empresas[], gatilho, prioridade, inicio, fim, ativo
conteudo/jornada                 dias[] editados no painel
conteudo/catalogo                sistemas[] (url, modo, status, prova, textos)
pedidosDeSenha/{id}              pedido da equipe → resposta recifrada pela função
resumos/{anoMes}                 agregação mensal de uso (função agendada)
```

### Jornada: chaves de passo

`{diaId}.{lado}.{índice}` onde lado é `c` (cliente) ou `e` (equipe). Exemplo: `d5.c.2` é o terceiro passo do cliente no D5. A regra do Firestore deixa o cliente alterar só `jornada.passos`; a UI só marca chaves `.c.`. Passos com `auto` são confirmados por fatos (documento enviado, senha guardada, canal escolhido) e aparecem "pelo sistema".

### Entrada, financeiro e módulos novos (21/09/2026)

- `empresas/{id}.entrada` = `{ itens: { "fiscal/livros-fiscais": {situacao, na, valor, docIds[], credencialId, procuracao, revisao{}}, "socios/{sid}/rg": {...} }, gruposNA{}, socios[], concluidoEm, avisoAutomaticoEm }` (`js/onboarding.js`).
- `empresas/{id}.financeiro` = bancos, maquininhas, forma de relatórios, acessos (ids de credenciais), status, protocolo, termo (`js/financeiro.js`).
- `empresas/{id}.nps[]`, `empresas/{id}/entregas/{id}` (guias e relatórios, para o sistema de entregas da equipe gravar), `empresas/{id}/resumos/{anoMes}`.
- `indicacoes/{id}`, `extratos/{codigo}` (página sem login; só `confirmacoes` pode ser alterada sem equipe), `exclusoesDeConta/{id}`, `resumos/{anoMes}`.
- `conteudo/{jornada|catalogo|agenda|lembretes|ajuda}`: tudo que a equipe edita sem código.
- Departamentos da equipe: `usuarios/{uid}.setores[]` filtra "Documentos a conferir" e a aba Entrada (aviso, não permissão).

### Integração com o sistema de entregas da equipe (futuro)

O sistema de controle da equipe que o Raoni está desenvolvendo grava em `empresas/{id}/entregas/{id}` = `{ titulo, competencia, vencimento, url (https, Storage), tipo }`. O portal já mostra a tela "Guias e relatórios" lendo essa coleção e registra `vistoEm` quando o cliente abre. Basta o outro sistema usar o mesmo projeto Firebase (ou uma Cloud Function que copie).

### Liberações por cliente

`empresas/{id}.liberacoes[sistemaId] = {ativo, desde, ate, plano}`. O portal só mostra como "liberado" o que está ativo e dentro da validade; o resto vira prévia com botão de interesse. `ate` permite o reverse trial (Checklist com 30 dias de cortesia ao cadastrar).

### Envio do mês (antes "Checklist do mês")

Decisão de 21/09/2026: o Checklist Contábil deixa de ser um sistema à parte e passa a existir só no portal. O portal grava e lê `empresas/{id}/checklist/{anoMes}` (itens com prazo, feito, aceite da equipe). A tela do painel mostra quais empresas concluíram o mês, quais não começaram, dá o aceite e exporta CSV. Os itens do mês vêm de `conteudo/envio` (Painel › Conteúdo › Envio do mês) ou do padrão em `js/envio.js`. Cada item tem `so` (todos | banco | maquininhas | funcionarios) e cada empresa só recebe o que vale para ela; a lista do mês corrente é reconciliada na hora (`Envio.mes`). Anexar em Meus arquivos com o item escolhido fecha o item (`Envio.marcar`, o documento guarda `item`). O portal avisa 2 dias antes do prazo (notificação do navegador) e `cobrarEnvio` (functions/lembretes.js) manda no chat, uma vez por semana, o que passou do prazo em mais de 2 dias.

## 5. Auditoria de uso e cobrança

Duas trilhas, de propósito:

- **`/uso`**: escrita pelo navegador do cliente (só `create`), lida pela equipe. Registra abertura de sistema, tela visitada, batimento de sessão (60 s) e interação com vitrine. Nunca conteúdo. O painel agrega por empresa × sistema × período e exporta CSV e um "relatório de cobrança" (empresa, CNPJ, sistema, plano, aberturas, minutos, dias ativos).
- **`/auditoria`**: escrita pela Cloud Function com hora do servidor; fechada para todos. Aprovações, correções, vistos, senhas guardadas e abertas, liberações, acessos, equipe. É a que vale como prova.

## 6. Segurança

- Cofre de senhas: cifrado no aparelho do cliente com a chave pública da Totali (`js/chave-publica.js`); aberto pela Cloud Function `abrirCredencial` com a privada no Secret Manager; a resposta volta recifrada com uma chave descartável da aba. Cada abertura vira registro em `/auditoria`.
- Convite de uso único; sessão do portal e do painel separadas por nome de app (lição do Academy).
- CSP sem scripts inline nem CDN; `frame-src https:` só no portal, para embutir os sistemas.
- Contabilidade anterior: login anônimo + código do link conferido pelas regras (Firestore e Storage), sem conta.
- Nada de dado real no código: a semente do modo local é fictícia.

## 7. Ligar o Firebase (passo a passo)

1. Criar projeto (ou usar `portaldocliente-8cc7d`, o do Academy) e ativar Auth (e-mail/senha e **anônimo**), Firestore (southamerica-east1) e Storage.
2. Colar a configuração web em `js/firebase-config.js`.
3. `firebase deploy --only firestore:rules,firestore:indexes,storage`.
4. `cd functions && npm install && firebase deploy --only functions`. Subir o segredo `chave-privada-credenciais` no Secret Manager (mesmo do Academy, se compartilhado).
5. Colar a chave pública em `js/chave-publica.js` (ou gerar um par novo em Painel › Segurança).
6. Criar a primeira pessoa da equipe no Authentication e o documento `usuarios/{uid}` com `papel: "admin"`.
7. Publicar no GitHub Pages com `CNAME` (sugestão: `portal.totalicontabilidade.com.br`) e liberar o domínio em Auth › Domínios autorizados.
8. Nos sistemas que serão embutidos (Academy, Ponto), liberar o domínio do portal em `Content-Security-Policy: frame-ancestors`.

## 8. O que ficou para a próxima rodada

- Push com o app fechado (Firebase Cloud Messaging): os ouvintes já estão no `sw.js`.
- Linha do tempo exportável da empresa (LGPD art. 18).
- Login único (SSO) entre portal e sistemas embutidos: hoje cada sistema tem seu login; o portal só abre a porta.
- Importador CSV do Checklist Contábil externo.
- Áudio no chat (gravação); hoje aceita arquivo de áudio como anexo.
- Testes automatizados da camada de dados (motor local é determinístico e serve de base).
