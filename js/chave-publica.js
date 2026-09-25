/* ============================================================
   Totali · Portal do Cliente
   chave-publica.js — RESERVA da chave pública do cofre de senhas

   Desde 25/09/2026 a chave é trocada pelo painel (Segurança ›
   Trocar a chave do cofre): o servidor gera o par, guarda a privada
   no Secret Manager (segredo `chave-privada-credenciais`), cifra de
   novo as senhas guardadas e publica a pública em publico/cofre.
   Portal, painel e páginas de link leem de lá (js/dados.js).
   Este arquivo só vale se essa leitura falhar; foi alinhado com a
   chave publicada em 25/09/2026. Não precisa mexer aqui depois de
   uma troca: a chave antiga continua abrindo o que foi fechado com ela.
   ============================================================ */
window.CHAVE_PUBLICA = {"kty": "RSA", "n": "rnT4vC69oLZ_7M4BFGpN6ILwvbEQSpkVwTOPFiHqsJ7jwbOy87jJ0fWBOVoyNtcboJvmRO18UtvGtGIyeDx9-SayhWqhDCN4wbnDGhmtrF9egqKG0nnfGwmO9_dpmBN1TfBjDQ2v6gqDz_gn7Nt_BmWCeAn_C00pxH10cfMYKAQOdR0L9ytqxOdgN2caNAgHhyEiiusQdGu06G_Y21UOdRods0efSzuCMce_1Q8PAimddzQ4BpbdfWsfgxRX4zrI4q1yYqm_ELY2-YzvakC1oMh2IFFb7J8lzzEj1kYYbxoz5txFjb9lrh2o21Yrjqf-ZsacECHTt_HDZpx04-SV6pbLJyCIH2PgtY76b1wmGkxBXGePN3SXd0d6LKajr1wA51thT78XqOjWrjX4e4-7dGuwLsyNoDoH_q0hYlK_MQvvpFcKQ1mwze8psU8fuqX3ptyD_O79AT1eY0yLXskxCW8xPIw0TZ1yuSOplZZKr7klr0wzBg2VRA55C0S1s13T", "e": "AQAB", "alg": "RSA-OAEP-256", "ext": true, "key_ops": ["encrypt"]};
