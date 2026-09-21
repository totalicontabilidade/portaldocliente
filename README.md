# Portal do Cliente · Totali Soluções Contábeis

A porta de entrada única do cliente da Totali: chat com a equipe, documentos e senhas, jornada de onboarding de 30 dias (D0…D30, passos P1…Pn), e todos os sistemas da Totali (Checklist Contábil, Ponto Totali, RH 360, Precify, GE Rescisão, Academy, Agência 100K) com liberação por cliente. O painel da equipe alimenta tudo isso e mede o uso para informar e cobrar.

Visual: o design system do Agência 100K (claro por padrão, escuro de primeira classe, sidebar navy com o quebra-cabeça). Mobile first, instalável como aplicativo.

## Rodar agora (sem servidor)

```bash
python -m http.server 8765
```

Abra <http://localhost:8765/index.html> (portal) e <http://localhost:8765/equipe.html> (painel). Sem Firebase configurado, o sistema roda em **modo demonstração**: dados fictícios só no seu navegador, com botões "Entrar como…" nas telas de login. Abra as duas páginas em abas diferentes para ver o chat dos dois lados.

| Página | Quem | Login demo |
|---|---|---|
| `index.html` | cliente | joana@estreladosul.demo · pedro@studiovega.demo · rita@rota101.demo |
| `equipe.html` | equipe | admin@totali.demo (admin) · marina@totali.demo (gerente) |
| `anterior.html?c=CODIGO` | contabilidade anterior | sem login; o código sai da ficha do cliente |

## O que existe

**Portal do cliente:** início com um próximo passo só e 4 ações · jornada de 30 dias com dias (D) e passos (P), marcos e celebração · chat com emojis, anexos, foto, reações e "visto" (quem envia à direita, quem recebe à esquerda) · documentos com recibo "visto por X às HH:MM", correção com motivo e aba da contabilidade anterior · cofre de senhas cifrado ponta a ponta · Checklist Contábil do mês com selo "Em dia" · Meus sistemas: o que está liberado abre, o resto é prévia com botão de interesse · vitrine ética (uma campanha por vez, 2 impressões, gatilho por assunto do chat) · perfil com canal preferido, tema, som e vibração.

**Painel da equipe:** início com o que precisa de você hoje · clientes e ficha (visão, liberações por sistema com plano e validade, jornada dos dois lados com anotações, documentos com aprovar/pedir correção, cofre com abertura registrada, conversa, uso) · novo cliente com convite de uso único e link para a contabilidade anterior · jornadas de todos os clientes num quadro D0…D30 · caixa de mensagens com "Resolver" e próximo passo · Checklist Contábil: quais empresas concluíram o mês · vitrine e campanhas com métricas · uso e cobrança com CSV e relatório · conteúdo do portal (jornada e sistemas editáveis sem código) · equipe · segurança (par de chaves).

## Documentos

- `docs/00-pesquisa-engajamento.md` — vieses do cliente, marketing sensorial, vitrine de produtos; o que a evidência sustenta e o que não fazer.
- `docs/01-arquitetura.md` — stack, modelo de dados, auditoria, segurança e o passo a passo para ligar o Firebase.

## Regras que não mudam

- A tela esconde, a regra impede (`firestore.rules`, `storage.rules`).
- Senhas nunca existem em texto legível no sistema. Abertura só pelo servidor, e registrada.
- Auditoria de uso registra fato e hora, nunca conteúdo.
- Propaganda: uma por vez, sem som, sem vibração, sem escassez falsa, some quando o cliente fecha.
- Nenhum dado de cliente real entra no código.
- Modo claro é o padrão; o escuro segue a escolha da pessoa ou o sistema.
