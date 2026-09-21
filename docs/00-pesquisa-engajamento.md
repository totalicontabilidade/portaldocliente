# Pesquisa: psicologia do cliente, marketing sensorial e vitrine de produtos

**Data:** 21/09/2026 · **Para:** Portal do Cliente · Totali Soluções Contábeis
**Método:** buscas na web e leitura das fontes citadas. Onde a evidência é fraca ou não replicada, está sinalizado.
**Premissa:** "prender o cliente" aqui significa criar valor acumulado e hábito, nunca fricção de saída. As recomendações foram traduzidas em decisões de produto na seção final e em `docs/01-arquitetura.md`.

---

## Tema 1 — Vieses cognitivos aplicados ao portal

**1. Endowed progress (progresso concedido).** Começar com parte do caminho já andado aumenta a conclusão: no estudo do lava-rápido, o cartão com 2 de 10 selos dados converteu 34% contra 19% do cartão zerado (Nunes & Drèze, https://papers.ssrn.com/sol3/papers.cfm?abstract_id=991962; resumo em https://www.coglode.com/nuggets/endowed-progress-effect).
*No portal:* a jornada de 30 dias já nasce com o D0 concluído ("proposta aceita, cadastro criado pela Totali") e a barra em 12%, não em 0%.

**2. Goal-gradient + Zeigarnik.** O esforço acelera perto da meta (Kivetz et al., 2006) e tarefas incompletas ficam salientes na memória (https://lawsofux.com/zeigarnik-effect/; https://www.coglode.com/research/goal-gradient-effect).
*No portal:* o card "Hoje" na tela inicial mostra um passo só, com "faltam N"; a barra ganha cor mais forte acima de 70%.

**3. Efeito dotação (endowment).** Valorizamos mais o que já é nosso.
*No portal:* o espaço chama-se "Minha empresa"; a tela inicial mostra "seus 14 documentos organizados, 3 obrigações cumpridas este mês". O histórico vira patrimônio do cliente. Sobre lock-in ético: https://www.getmonetizely.com/articles/pricing-for-lock-in-creating-strategic-switching-costs-in-saas (58% dos que se sentem presos saem e viram detratores).

**4. Efeito IKEA.** Quem monta valoriza mais (63% a mais no experimento das caixas), mas só se concluir a tarefa (Norton, Mochon & Ariely, https://www.hbs.edu/ris/Publication%20Files/11-091.pdf).
*No portal:* o cliente escolhe nome de exibição, canal preferido e ordem dos sistemas nos primeiros minutos, sempre com fim garantido.

**5. Reciprocidade.** Dar antes de pedir (Cialdini; aplicações B2B em https://cxl.com/blog/cialdinis-principles-persuasion/).
*No portal:* na primeira semana, entregar algo não pedido (uma aula do Academy liberada, o calendário tributário) antes de qualquer pedido de documento.

**6. Prova social.** Em B2B a incerteza é alta e a prova social vira infraestrutura de confiança (https://www.custify.com/blog/social-proof-b2b-saas/).
*No portal:* nos cards de sistemas, "N clientes da Totali usam o Ponto" com número real, e depoimento curto com autorização (LGPD art. 7).

**7. Aversão à perda, com escassez ética.** Perdas pesam cerca de duas vezes mais que ganhos (Kahneman & Tversky).
*No portal:* prazos fiscais reais como gatilho ("DAS vence em 3 dias"); escassez só quando verdadeira.

**8. Ancoragem.** O preço visto primeiro ancora os seguintes; a ancoragem numérica replica bem, o decoy effect não (https://atticusli.com/replication-crisis/decoy-effect-asymmetric-dominance/).
*No portal:* na vitrine, mostrar o custo de uma rescisão calculada errada antes de falar do GE Rescisão; sem planos-isca falsos.

**9. Paradoxo da escolha / lei de Hick.** 24 geleias atraíram mais, 6 venderam dez vezes mais (Iyengar & Lepper, https://onegoodthing.space/blog/the-jam-experiment-paradox-of-choice).
*No portal:* tela inicial com no máximo 4 ações primárias (Chat, Documentos, Jornada, Sistemas); propaganda de um sistema por vez, nunca sete.

**10. Peak-end rule.** Lembramos do pico e do fim (https://www.uxtigers.com/post/peak-end-rule).
*No portal:* conversa resolvida termina com "Resolvido, próximo passo: X"; o D30 tem tela de encerramento com o resumo do que foi feito. Nunca terminar em erro.

**11. Hook Model (Eyal).** Gatilho → ação → recompensa variável → investimento; só é ético se você mesmo usaria e melhora a vida do usuário (https://www.mindtools.com/aapqtdb/the-hook-model-of-behavioral-design/; crítica em https://yukaichou.com/gamification-analysis/hook-model-octalysis-habit-addiction/).
*No portal:* gatilho = aviso "seu contador respondeu"; ação = abrir o chat; recompensa variável = resposta e, às vezes, uma dica; investimento = o documento enviado que torna o próximo mês mais fácil.

**12. Valor acumulado em dados.** Custo de troca legítimo vem de dados e histórico, não de fricção.
*No portal:* linha do tempo da empresa com documentos, guias e conversas desde o dia 1, exportável (LGPD art. 18, portabilidade). O cliente fica porque vale, não porque não consegue sair.

---

## Tema 2 — Marketing sensorial em telas

**Alerta geral:** uma replicação de 10 estudos clássicos de marketing sensorial teve sucesso em só 2 (20%), com efeitos pela metade; os de estímulo visual (cor, forma de logo) falharam (https://www.frontiersin.org/journals/communication/articles/10.3389/fcomm.2022.1048896/full). "Psicologia das cores" é modinha.

**1. Cor para hierarquia, não para "emoção".** A evidência sólida é sobre contraste e consistência.
*No portal:* uma cor de ação (navy), uma de alerta (prazo), dourado como destaque de marca. A propaganda nunca usa a cor de ação.

**2. Micro-interações com duração certa (evidência forte).** NN/g: 100 a 500 ms; feedback simples ~100 ms, modais 200 a 300 ms; respeitar `prefers-reduced-motion` (https://www.nngroup.com/articles/animation-duration/).
*No portal:* check animado ao concluir passo (150 ms), upload com barra real. Nada acima de 400 ms.

**3. Háptica no celular (evidência moderada, de fornecedor).** Immersion reporta +18% de qualidade percebida; a Apple trata háptica como feedback sincronizado com visual e som (https://swmansion.com/blog/haptic-feedback-explained-what-it-is-and-what-it-does-for-your-app-and-business/; https://developer.apple.com/videos/play/wwdc2019/223/).
*No portal:* vibração curta ao confirmar envio de documento e ao completar marco; opcional nas configurações.

**4. Celebrações só em marcos (evidência forte, Duolingo).** Redesenhar a animação do dia 7 subiu a retenção D7 em 1,7% (https://duolingo.deconstructoroffun.com/mechanics/streaks; https://blog.duolingo.com/how-streaks-keep-duolingo-learners-committed-to-their-language-goals/).
*No portal:* confete em quatro momentos apenas: primeiro documento enviado, D15, D30 e "mês 100% em dia".

**5. Perdão embutido.** Permitir pausa aumentou o retorno em 4% (Duolingo).
*No portal:* o selo "Em dia há N meses" não zera por um atraso de um dia; avisa e dá 48 h.

**6. Som de notificação: menos é mais.** Mais de 3 pushes por dia leva a opt-out acima de 12% em 7 dias (https://getbruin.com/use-cases/mobile-gaming/pushfatigue-daily-cap-churn-correlation/; https://www.courier.com/blog/how-to-reduce-notification-fatigue-7-proven-product-strategies-for-saas).
*No portal:* som só para resposta da equipe e prazo em 24 h; o resto em resumo diário. Sem som em propaganda, nunca.

**7. Dark haptics existem. Evitar.** Vibração usada para empurrar escolhas (https://arxiv.org/pdf/2504.08471).
*No portal:* háptica nunca em botões de contratação; só em confirmações do que o cliente já decidiu.

**8. Movimento como orientação.** Animação serve para não desorientar, não para decorar.
*No portal:* transições consistentes entre abas; esqueletos de carregamento no chat.

---

## Tema 3 — Exibição de produtos e serviços

**1. Cegueira a banner é real, inclusive no celular.** Fixações na coluna direita foram 33 vezes menores que o espaço ocupado (https://www.nngroup.com/articles/banner-blindness-old-and-new-findings/).
*No portal:* nunca banner colorido no topo ou rodapé; a oferta entra como card no mesmo estilo dos cards de sistemas contratados, com o rótulo "Ainda não contratado".

**2. Empty state que vende.** Estado bloqueado deve mostrar o caminho e o valor, não punir (https://kompassify.com/blog/empty-states-guide; https://pixxen.com/saas-empty-state-design/).
*No portal:* o RH 360 para quem não contratou mostra um exemplo real e "Ver como funciona (2 min)"; nada de "recurso indisponível".

**3. Reverse trial converte 2 a 3 vezes o freemium** (https://openviewpartners.com/blog/your-guide-to-reverse-trials/; https://www.inflection.io/post/complete-guide-to-reverse-trials).
*No portal:* cliente novo ganha 30 dias de Checklist Contábil; no dia 25 recebe "você concluiu 18 itens, quer manter?".

**4. Gatilho comportamental, não calendário.** Limite de impressões, suprimir após dispensa (https://www.appcues.com/blog/in-app-messaging).
*No portal:* a vitrine do GE Rescisão aparece depois que o cliente fala em demissão no chat; no máximo 2 impressões; some ao fechar.

**5. Formato certo por peso.** Tooltip para dica, modal só para grande novidade (https://www.pendo.io/pendo-blog/10-types-of-in-app-guides-you-can-create-with-pendo/).

**6. Nubank: separar operação de vitrine.** App em 3 abas a partir do modelo mental do usuário; ofertas concentradas em "Vantagens Nu" (https://nu.com/pt/sala-de-imprensa/companhia/aplicativo-do-nubank-organiza-rotina-em-transacoes-planejamento-e-shopping).
*No portal:* tela inicial = operação; "Sistemas" = vitrine. O cliente escolhe entrar na loja.

**7. Omie Cash: produto nativo no fluxo** (https://www.omie.com.br/blog/omie-cash-a-evolucao-da-conta-digital-integrada-ao-erp/).
*No portal:* "Calcular rescisão" dentro da conversa sobre demissão.

**8. Qipu e Contabilize: protocolo de documentos** (https://www.qipu.com.br/).
*No portal:* cada documento tem recibo "visto por [nome] às 14h32". Transparência retém mais que banner.

---

## Top 12 recomendações priorizadas (impacto × esforço)

| # | Recomendação | Impacto | Esforço | Estado no código |
|---|---|---|---|---|
| 1 | Jornada nasce com o D0 concluído | Alto | Baixo | feito (`js/jornada.js`) |
| 2 | Tela inicial com 4 ações; vitrine em "Sistemas" | Alto | Baixo | feito (`js/app.js`) |
| 3 | Som só para resposta da equipe e prazo | Alto | Baixo | feito (preferência em Perfil) |
| 4 | Recibo "visto por X às HH:MM" por documento | Alto | Baixo | feito (documentos) |
| 5 | Empty states dos sistemas não contratados com prévia | Alto | Médio | feito (catálogo com prévia) |
| 6 | Celebração só em marcos | Médio | Baixo | feito (`UI.celebrar`) |
| 7 | Selo "Em dia há N meses" com tolerância | Médio | Baixo | previsto (checklist) |
| 8 | Ofertas por gatilho, limite de 2 impressões | Alto | Médio | feito (`Vitrine`) |
| 9 | Reverse trial do Checklist Contábil | Alto | Médio | previsto (liberação com prazo) |
| 10 | Encerramento de chat com próximo passo | Médio | Baixo | feito (painel: "Resolver") |
| 11 | Linha do tempo da empresa, exportável | Alto | Alto | previsto |
| 12 | Personalização inicial em 5 min | Médio | Médio | parcial (perfil) |

## O que NÃO fazer (dark patterns)

- **Cancelamento mais difícil que a contratação.** CDC art. 39, V; Decreto 11.034/2022. Se contrata no portal, cancela no portal.
- **Venda casada** (condicionar Ponto a contratar RH): CDC art. 39, I.
- **Escassez falsa / contador regressivo fictício:** viola o dever de informação clara, CDC art. 6, III.
- **Consentimento assimétrico** (botão "aceitar" grande, "recusar" escondido; caixas pré-marcadas): ANPD Nota Técnica 27/2024 e LGPD arts. 2 e 7.
- **Usar senhas ou dados enviados no chat para marketing:** finalidade específica, LGPD art. 6.
- **Dark haptics e som em anúncios.**
- **Streak que zera e humilha.**
- **Confirmshaming** ("Não, prefiro pagar multa").
- **Banner disfarçado de aviso fiscal:** quebra a confiança e ativa a cegueira para os avisos reais.
- **Notificação diária de propaganda:** mais de 3 por dia dispara opt-out acima de 12%.
