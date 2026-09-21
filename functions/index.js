/* ============================================================
   Totali · Portal do Cliente
   functions/index.js — o que o navegador não pode fazer

   auditoria.js   trilha probatória em /auditoria, hora do servidor
   senhas.js      abre credencial cifrada para a equipe (Secret Manager)
   lembretes.js   cobrança automática da entrada, no ritmo da jornada
   resumo.js      resumo mensal de uso e resumo do mês para o cliente
   exclusao.js    apaga a conta de login de cliente encerrado

   Publicar: firebase deploy --only functions
   Região: southamerica-east1 (São Paulo), igual ao Academy.
   ============================================================ */
"use strict";

const admin = require("firebase-admin");
admin.initializeApp();

Object.assign(exports, require("./auditoria"));
Object.assign(exports, require("./senhas"));
Object.assign(exports, require("./lembretes"));
Object.assign(exports, require("./resumo"));
Object.assign(exports, require("./exclusao"));
