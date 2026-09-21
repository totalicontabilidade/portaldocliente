/* ============================================================
   Totali · Portal do Cliente
   functions/index.js — o que o navegador não pode fazer

   Três assuntos, cada um no seu arquivo:
     auditoria.js   trilha probatória em /auditoria, com hora do
                    servidor, deduzida do antes/depois dos documentos
     senhas.js      abre uma credencial cifrada para a equipe (chave
                    privada no Secret Manager), registrando quem e quando
     resumo.js      resumo diário de uso e lembretes (sem push de
                    propaganda; ver docs/00-pesquisa-engajamento.md)

   Publicar: firebase deploy --only functions
   Região: southamerica-east1 (São Paulo), igual ao Academy.
   ============================================================ */
"use strict";

const admin = require("firebase-admin");
admin.initializeApp();

Object.assign(exports, require("./auditoria"));
Object.assign(exports, require("./senhas"));
Object.assign(exports, require("./resumo"));
