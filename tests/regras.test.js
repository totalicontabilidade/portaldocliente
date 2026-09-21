/* ============================================================
   Totali · Portal do Cliente
   tests/regras.test.js — as regras do Firestore contra o modelo de ameaças

   Um cenário por linha da tabela em docs/02-seguranca.md. Roda no
   emulador, sem tocar no projeto real:

     npm install
     npm run test:regras

   (exige Java para o emulador). Cada teste diz o que um papel PODE
   e o que NÃO PODE fazer; se uma regra for republicada errada um
   dia, é aqui que aparece antes de ir para o ar.
   ============================================================ */
"use strict";
const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { initializeTestEnvironment, assertSucceeds, assertFails } = require("@firebase/rules-unit-testing");

let env;
const PROJETO = "portal-teste";
const EMP = "emp_a", EMP_B = "emp_b";

before(async () => {
  env = await initializeTestEnvironment({ projectId: PROJETO, firestore: { rules: fs.readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 } });
});
after(async () => { await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.doc("usuarios/eq1").set({ nome: "Equipe", email: "eq@totali.demo", papel: "equipe" });
    await db.doc("usuarios/adm1").set({ nome: "Admin", email: "adm@totali.demo", papel: "admin" });
    await db.doc(`empresas/${EMP}`).set({ fantasia: "A", ativa: true, liberacoes: {}, jornada: { passos: {} } });
    await db.doc(`empresas/${EMP}/acessos/cliA`).set({ nome: "Cliente A", email: "a@x.demo" });
    await db.doc(`empresas/${EMP_B}`).set({ fantasia: "B", ativa: true });
    await db.doc(`empresas/${EMP_B}/acessos/cliB`).set({ nome: "Cliente B", email: "b@x.demo" });
    await db.doc(`empresas/${EMP}/credenciais/c1`).set({ rotulo: "x", pacote: { alg: "RSA-OAEP-256+AES-GCM-256", dados: "..." } });
    await db.doc("anterior/CODIGOVALIDO1234567890").set({ empresaId: EMP, empresa: "A", ativo: true });
  });
});
const cliA = () => env.authenticatedContext("cliA", { email: "a@x.demo" }).firestore();
const cliB = () => env.authenticatedContext("cliB", { email: "b@x.demo" }).firestore();
const equipe = () => env.authenticatedContext("eq1").firestore();
const admin = () => env.authenticatedContext("adm1").firestore();
const anonimo = () => env.authenticatedContext("anon1", { firebase: { sign_in_provider: "anonymous" } }).firestore();
const ninguem = () => env.unauthenticatedContext().firestore();

test("cliente A lê a própria empresa e NÃO lê a empresa B", async () => {
  await assertSucceeds(cliA().doc(`empresas/${EMP}`).get());
  await assertFails(cliA().doc(`empresas/${EMP_B}`).get());
  await assertFails(cliA().collection(`empresas/${EMP_B}/documentos`).get());
});
test("sem login, nada é lido nem escrito", async () => {
  await assertFails(ninguem().doc(`empresas/${EMP}`).get());
  await assertFails(ninguem().collection("uso").add({ empresaId: EMP, uid: "x", tipo: "abrir", em: new Date() }));
});
test("cliente só altera os campos dele na empresa; nunca liberações ou gerente", async () => {
  await assertSucceeds(cliA().doc(`empresas/${EMP}`).update({ canalPreferido: "whatsapp" }));
  await assertSucceeds(cliA().doc(`empresas/${EMP}`).update({ "jornada.passos.d1.c.0": { em: 1, por: "cliente" } }));
  await assertFails(cliA().doc(`empresas/${EMP}`).update({ liberacoes: { ponto: { ativo: true } } }));
  await assertFails(cliA().doc(`empresas/${EMP}`).update({ gerenteUid: "cliA" }));
  await assertFails(cliA().doc(`empresas/${EMP}`).update({ "jornada.aceiteEm": 0 }));
});
test("mensagem: autor tem de ser quem envia, com o lado certo; texto e autor não mudam depois", async () => {
  const ok = { autor: { uid: "cliA", nome: "A", lado: "cliente" }, texto: "oi", anexos: [], em: new Date(), lidaPor: {}, reacoes: {} };
  await assertSucceeds(cliA().collection(`empresas/${EMP}/mensagens`).add(ok));
  await assertFails(cliA().collection(`empresas/${EMP}/mensagens`).add({ ...ok, autor: { uid: "eq1", nome: "Falso", lado: "equipe" } }));
  await assertFails(cliA().collection(`empresas/${EMP}/mensagens`).add({ ...ok, autor: { uid: "cliA", nome: "A", lado: "equipe" } }));
  const ref = await equipe().collection(`empresas/${EMP}/mensagens`).add({ ...ok, autor: { uid: "eq1", nome: "Eq", lado: "equipe" } });
  await assertFails(cliA().doc(ref.path).update({ texto: "editado" }));
  await assertSucceeds(cliA().doc(ref.path).update({ "lidaPor.cliA": 1 }));
});
test("uso: cliente só cria, com o próprio uid; equipe lê; ninguém edita ou apaga", async () => {
  const ref = await assertSucceeds(cliA().collection("uso").add({ empresaId: EMP, uid: "cliA", tipo: "abrir", sistemaId: "checklist", em: new Date() }));
  await assertFails(cliA().collection("uso").add({ empresaId: EMP, uid: "outro", tipo: "abrir", em: new Date() }));
  await assertFails(cliA().collection("uso").add({ empresaId: EMP_B, uid: "cliA", tipo: "abrir", em: new Date() }));
  await assertFails(cliA().collection("uso").get());
  await assertSucceeds(equipe().collection("uso").get());
  await assertFails(equipe().doc(ref.path).delete());
});
test("auditoria: ninguém escreve, nem admin", async () => {
  await assertFails(admin().collection("auditoria").add({ tipo: "x" }));
  await assertSucceeds(equipe().collection("auditoria").get());
  await assertFails(cliA().collection("auditoria").get());
});
test("credenciais: cliente guarda envelope cifrado; ninguém altera; pedido de abertura só da equipe", async () => {
  await assertSucceeds(cliA().collection(`empresas/${EMP}/credenciais`).add({ rotulo: "SN", pacote: { alg: "RSA-OAEP-256+AES-GCM-256", dados: "x" } }));
  await assertFails(cliA().collection(`empresas/${EMP}/credenciais`).add({ rotulo: "SN", pacote: { alg: "texto-puro", dados: "senha" } }));
  await assertFails(equipe().doc(`empresas/${EMP}/credenciais/c1`).update({ pacote: {} }));
  await assertSucceeds(equipe().collection("pedidosDeSenha").add({ empresaId: EMP, chave: "c1", pedidoPor: "eq1", chavePublica: {} }));
  await assertFails(cliA().collection("pedidosDeSenha").add({ empresaId: EMP, chave: "c1", pedidoPor: "cliA", chavePublica: {} }));
  await assertFails(equipe().collection("pedidosDeSenha").add({ empresaId: EMP, chave: "c1", pedidoPor: "adm1", chavePublica: {} }));
});
test("equipe e admin: só admin mexe em /usuarios; equipe lê", async () => {
  await assertFails(equipe().doc("usuarios/novo").set({ nome: "x", email: "x@totali.demo", papel: "admin" }));
  await assertSucceeds(admin().doc("usuarios/novo").set({ nome: "x", email: "x@totali.demo", papel: "equipe" }));
  await assertSucceeds(equipe().collection("usuarios").get());
  await assertFails(cliA().collection("usuarios").get());
});
test("contabilidade anterior: anônimo só cria documento com origem 'anterior' e código válido", async () => {
  const base = { nome: "balanco.pdf", grupo: "contabil", situacao: "enviado", em: new Date(), por: "Escritório X", arquivo: {}, vistos: [] };
  await assertSucceeds(anonimo().collection(`empresas/${EMP}/documentos`).add({ ...base, origem: "anterior", codigo: "CODIGOVALIDO1234567890" }));
  await assertFails(anonimo().collection(`empresas/${EMP}/documentos`).add({ ...base, origem: "anterior", codigo: "CODIGOERRADO123456789" }));
  await assertFails(anonimo().collection(`empresas/${EMP_B}/documentos`).add({ ...base, origem: "anterior", codigo: "CODIGOVALIDO1234567890" }));
  await assertFails(anonimo().collection(`empresas/${EMP}/documentos`).add({ ...base, origem: "cliente", codigo: "CODIGOVALIDO1234567890" }));
  await assertFails(anonimo().collection(`empresas/${EMP}/documentos`).get());
});
test("documentos: cliente não aprova o próprio documento; equipe aprova", async () => {
  const ref = await cliA().collection(`empresas/${EMP}/documentos`).add({ nome: "rg.jpg", grupo: "socios", origem: "cliente", situacao: "enviado", em: new Date(), por: "A", arquivo: {}, vistos: [] });
  await assertFails(cliA().doc(ref.path).update({ situacao: "aprovado" }));
  await assertSucceeds(equipe().doc(ref.path).update({ situacao: "aprovado", revisao: { por: "Eq", em: 1 } }));
  await assertFails(cliA().doc(ref.path).delete());
});
test("convite: qualquer um lê pelo código, mas só queima com o próprio uid e sem trocar a empresa", async () => {
  await env.withSecurityRulesDisabled(async (c) => { await c.firestore().doc("convites/CONV1234567890123456789").set({ empresaId: EMP, usado: false }); });
  await assertSucceeds(ninguem().doc("convites/CONV1234567890123456789").get());
  await assertFails(ninguem().collection("convites").get());
  const novo = env.authenticatedContext("novoUid", { email: "novo@x.demo" }).firestore();
  await assertFails(novo.doc("convites/CONV1234567890123456789").update({ usado: true, usadoPor: "novoUid", empresaId: EMP_B }));
  await assertSucceeds(novo.doc("convites/CONV1234567890123456789").update({ usado: true, usadoPor: "novoUid", empresaId: EMP }));
});
test("indicações e extratos: cliente indica na própria empresa; página de extratos só confirma", async () => {
  await assertSucceeds(cliA().collection("indicacoes").add({ empresaId: EMP, nome: "Fulano", status: "nova" }));
  await assertFails(cliB().collection("indicacoes").add({ empresaId: EMP, nome: "Fulano", status: "nova" }));
  await env.withSecurityRulesDisabled(async (c) => { await c.firestore().doc("extratos/EXT1234567890123456789").set({ empresaId: EMP, ativo: true, bancos: [], confirmacoes: {} }); });
  await assertSucceeds(ninguem().doc("extratos/EXT1234567890123456789").update({ confirmacoes: { Banese: { confirmado: true } } }));
  await assertFails(ninguem().doc("extratos/EXT1234567890123456789").update({ bancos: [{ nome: "x", link: "https://malicioso" }] }));
});
