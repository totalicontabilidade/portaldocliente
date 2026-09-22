# Portal do Cliente · Totali Soluções Contábeis

A porta de entrada única do cliente da Totali, para sempre enquanto ele for cliente: chat com a equipe, entrada (documentos por departamento, bancos e maquininhas), checklist do mês, agenda de obrigações, cofre de senhas, linha do tempo, e todos os sistemas da Totali (Checklist Contábil, Ponto Totali, RH 360, Precify, GE Rescisão, Academy, Agência 100K) com liberação por cliente. O painel da equipe alimenta tudo isso, conduz o onboarding de 30 dias (controle interno, invisível ao cliente) e mede o uso para informar e cobrar.

Visual: o design system do Agência 100K (claro por padrão, escuro de primeira classe, navy com o padrão de calculadora, modelo A). Mobile first, instalável como aplicativo.

## Rodar agora (sem servidor)

```bash
python -m http.server 8765
```

Abra <http://localhost:8765/index.html> (portal) e <http://localhost:8765/equipe.html> (painel). Sem Firebase configurado, o sistema roda em **modo demonstração**: dados fictícios só no seu navegador, com botões "Entrar como…". Abra as duas páginas em abas diferentes para ver o chat dos dois lados.

| Página | Quem | Login demo |
|---|---|---|
| `index.html` | cliente | joana@estreladosul.demo · pedro@studiovega.demo · rita@rota101.demo |
| `equipe.html` | equipe | admin@totali.demo (admin) · marina@totali.demo (fiscal) · carlos@totali.demo (contábil) · ana@totali.demo (dep. pessoal) |
| `anterior.html?c=CODIGO` | contabilidade anterior | sem login; o código sai da ficha do cliente |
| `extratos.html?c=CODIGO` | cliente (Open Finance) | sem login; confere o CNPJ; o código sai da ficha › Financeiro |

## O que existe

**Portal do cliente:** início com um próximo passo só e 4 ações · tutorial guiado no primeiro acesso · entrada na Totali (checklist por departamento: societário, contábil, fiscal, DP, sócios; arquivo, dado ou acesso cifrado; "não se aplica") · bancos e maquininhas em 3 passos com termo em PDF · chat com emojis, anexos, foto, reações e "visto" · documentos com recibo "visto por X às HH:MM" e aba da contabilidade anterior · cofre de senhas ponta a ponta · Checklist Contábil do mês com selo "Em dia" · agenda de obrigações por regime · linha do tempo exportável (CSV e JSON) · indicação de cliente · guias e relatórios (pronto para o sistema de entregas da equipe) · NPS trimestral · resumo do mês · banners rotativos dos sistemas não contratados · ajuda com FAQ, contatos e mapa · avisos no aparelho · perfil com canal, tema, som, vibração e instalação.

**Painel da equipe:** início com o que precisa de você hoje e NPS · clientes e ficha (visão, liberações por sistema, jornada de 30 dias dos dois lados, entrada com aprovar/pedir correção, financeiro com status e extratos Ottimizza, documentos, cofre com abertura registrada, conversa, uso) · ficha e dossiê de entrada em PDF · novo cliente com convite de uso único e link para a contabilidade anterior · onboarding de todos os clientes num quadro D0…D30 · caixa de mensagens com "Resolver" · Entrada e Checklist Financeiro: quais empresas preencheram · Checklist Contábil por empresa · indicações · vitrine e campanhas · uso e cobrança com CSV · conteúdo editável sem código (jornada, sistemas, agenda, aviso automático, ajuda) · equipe com departamentos · segurança · encerrar cliente.

**Servidor (Cloud Functions):** auditoria probatória, abertura de senha, cobrança automática da entrada no ritmo da jornada (D5 + 48 h, semanal), resumo do mês para o cliente, resumo de uso para cobrança, exclusão de conta.

## Documentos

- `docs/00-pesquisa-engajamento.md` — vieses do cliente, marketing sensorial, vitrine; o que a evidência sustenta e o que não fazer.
- `docs/01-arquitetura.md` — stack, modelo de dados, auditoria e o passo a passo para ligar o Firebase.
- `docs/02-seguranca.md` — modelo de ameaças, o que está feito, decisões pendentes.
- `design/` — modelos do padrão de fundo e prévia do menu horizontal.
- `tests/regras.test.js` — as regras do Firestore contra o modelo de ameaças (`npm run test:regras`, exige emulador).

## Regras que não mudam

- A tela esconde, a regra impede (`firestore.rules`, `storage.rules`).
- Senhas nunca existem em texto legível no sistema. Abertura só pelo servidor, e registrada.
- Auditoria de uso registra fato e hora, nunca conteúdo.
- Propaganda: sem som, sem vibração, sem escassez falsa; "agora não" esconde por 14 dias.
- A jornada de 30 dias é da equipe. O cliente nunca a vê.
- Nenhum dado de cliente real entra no código.
- Nada se altera por código: conteúdo é editado no painel.
