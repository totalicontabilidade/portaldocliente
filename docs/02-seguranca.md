# Segurança do Portal do Cliente

**Versão:** 1 · 21/09/2026. Meta pedida pelo Raoni: "segurança extrema, contra invasões e vazamentos". Este documento diz o que já está no código, o que depende de uma decisão sua e o que é limite da plataforma.

## 1. Modelo de ameaças

| Ameaça | Como entra | Defesa |
|---|---|---|
| Cliente A lê dados do cliente B | manipular o navegador, chamar a API direto | regras do Firestore e do Storage por empresa; nenhuma consulta sem `empresaId` do vínculo |
| Alguém de fora escreve no banco | API do Firebase é pública por natureza | regras negam tudo por padrão; App Check exige que a chamada venha do nosso site |
| Roubo de senha do cliente | phishing, vazamento em outro site | conferência contra senhas vazadas (HIBP), mínimo de 10 caracteres, bloqueio de tentativas do Firebase, sessão ociosa encerra |
| Roubo de conta da equipe | é o pior caso: abre senhas de clientes | 2FA obrigatória (decisão sua, seção 4), sessão de 20 min, toda abertura de senha registrada e recifrada para a aba |
| Vazamento de senhas guardadas | banco, backup, aparelho do cliente | criptografia ponta a ponta: cifra no aparelho, abre só a Cloud Function com a privada no Secret Manager; no banco só há envelope |
| XSS (script injetado pela tela) | texto de mensagem, nome de arquivo, campo de cadastro | todo texto passa por `U.esc()`; CSP sem `unsafe-inline` em script e sem CDN; links só https |
| Clickjacking | embutir o portal num site malicioso | `X-Frame-Options: DENY` no hosting + frame-busting em `js/seguranca.js` |
| Link do convite ou da contabilidade anterior encaminhado | mensagem repassada | código de 22 caracteres; convite queima no uso; link da contabilidade anterior é desativável e só aceita upload (nunca leitura) |
| Aparelho esquecido aberto | celular na mesa | sessão ociosa encerra sozinha; segredos na tela somem quando a aba perde o foco; área de transferência limpa em 30 s |
| Adulteração da trilha | equipe ou cliente "corrigindo" o histórico | `/auditoria` só a função escreve, com hora do servidor; `/uso` só aceita `create` |
| Excesso de dados guardados | LGPD | uso registra fato e hora, nunca conteúdo; anonimização por pedido (ferramenta do Academy serve aqui) |

## 2. O que está implementado no código

- **Regras** (`firestore.rules`, `storage.rules`): negam tudo por padrão; validam quem é equipe, quem é dono, tamanho de documento, tipos de arquivo, campos permitidos em cada atualização (o cliente só muda `canalPreferido`, `formaRelatorio`, `marcos`, `feedback30` e os passos dele na jornada).
- **CSP** em cada página: só a própria origem, sem scripts inline, sem CDN; conexões só com Firebase, App Check e HIBP.
- **App Check** ligado no código (`js/dados.js`): basta a chave reCAPTCHA em `js/firebase-config.js`. Sem App Check, qualquer script com a apiKey fala com o projeto; com ele, só o nosso site.
- **Sessões separadas** para portal e painel, e encerramento por inatividade (`js/seguranca.js`).
- **Senhas novas** conferidas contra vazamentos e política mínima.
- **Cofre de senhas** ponta a ponta, abertura registrada, segredo some ao perder o foco.
- **Cabeçalhos HTTP** de proteção em `firebase.json` (HSTS, nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy, COOP/CORP). Valem no Firebase Hosting; o GitHub Pages não deixa configurar cabeçalhos.
- **Sair** limpa preferências e caches do aparelho.
- **Sem dado real no código**; semente do modo local é fictícia.

## 3. Limites honestos

- Um sistema em navegador nunca é "totalmente" seguro: quem controla o aparelho do cliente (malware, extensão maliciosa) vê o que o cliente vê. O que se garante é que **um** aparelho comprometido não vaza o resto.
- A `apiKey` do Firebase é pública por desenho. Quem protege é regra + App Check.
- A CSP em `<meta>` não cobre `frame-ancestors` nem reporta violações; por isso os cabeçalhos do hosting importam.
- `style-src 'unsafe-inline'` continua, porque o layout usa atributos `style`. Não é vetor de execução de script.

## 4. Decisões que só você pode tomar

1. **Onde publicar.** Recomendo **Firebase Hosting** (mesmo projeto, cabeçalhos de segurança, sem custo relevante) em vez do GitHub Pages. Se preferir o Pages, coloque a Cloudflare com proxy ligado e crie os mesmos cabeçalhos em Rules › Transform.
2. **2FA para a equipe.** Firebase Auth só oferece MFA com o upgrade para Identity Platform (gratuito até 50 mil usuários ativos; SMS custa por envio; TOTP por app autenticador é grátis). Recomendo ligar e tornar obrigatório para quem abre senhas. Sem isso, a segurança da equipe é só a senha.
3. **App Check.** Criar a chave reCAPTCHA v3 (ou Enterprise) no console e colar em `js/firebase-config.js`; depois marcar "Enforce" em Firestore, Storage e Functions.
4. **Backup e retenção.** Ativar backups agendados do Firestore (PITR) e definir por quanto tempo `uso/` fica (sugestão: 24 meses, depois só o resumo mensal).
5. **Domínio próprio** com HSTS preload e e-mail de segurança (SPF/DKIM) para os avisos de login.

## 5. Próximos passos técnicos (sem decisão pendente)

- Usar o convite por Cloud Function (o navegador cria um `pedidoDeAcesso` e a função cria a conta e o vínculo), tirando do cliente a permissão de criar `clientes/{uid}`.
- Listar sessões ativas e "sair de todos os aparelhos" (revogação de tokens pelo admin SDK).
- Aviso por e-mail a cada login novo da equipe.
- Testes automáticos das regras com o emulador (`firebase emulators:exec`), um cenário por linha da tabela da seção 1.
