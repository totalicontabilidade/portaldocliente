/* R3 completo: mostrador + 4 linhas de teclas (7 8 9 ÷ / 4 5 6 × / 1 2 3 − / 0 % = +). Tile 240 x 300. */
const fs = require("fs");
const src = fs.readFileSync("C:/Users/Totali/AppData/Local/Temp/claude/C--Users-Totali-Desktop-Portal-do-Cliente/285c433d-4104-47c1-b7c4-241c4692425d/scratchpad/gerar-padrao2.js", "utf8");
const codigo = src.split("const TECLAS =")[0];
const fn = new Function("require", "module", codigo + "\nreturn { defs, tecla };");
const { defs, tecla } = fn(require, { exports: {} });
const G = "#C89D57", GL = "#E6C889";
const TECLAS = [7, 8, 9, "/", 4, 5, 6, "x", 1, 2, 3, "-", 0, "%", "=", "+"];
function tile(id, opCheia, opVidro) {
  const t = 50, gap = 10, x0 = 10, y0 = 10, w = 4 * t + 3 * gap;
  let s = defs(id);
  s += `<rect x='${x0}' y='${y0}' width='${w}' height='${t}' rx='10' fill='#000' fill-opacity='${opCheia * 1.8}' stroke='${G}' stroke-opacity='${opVidro * 3}'/>`;
  s += `<text x='${x0 + w - 12}' y='${y0 + t * .68}' font-family='Consolas,Menlo,monospace' font-size='26' text-anchor='end' fill='${GL}' fill-opacity='${opVidro * 5}' letter-spacing='2'>1.250,00</text>`;
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    const sim = TECLAS[j * 4 + i], x = x0 + i * (t + gap), y = y0 + (j + 1) * (t + gap);
    s += tecla(id, x, y, t, sim, typeof sim !== "number", opCheia, opVidro);
  }
  return `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='300' viewBox='0 0 240 300'>${s}</svg>`;
}
const dir = "C:/Users/Totali/Desktop/Portal do Cliente/design/previa/";
fs.writeFileSync(dir + "calc-r3-menu.svg", tile("m3", 0.20, 0.08));
fs.writeFileSync(dir + "calc-r3-login.svg", tile("l3", 0.30, 0.12));
fs.writeFileSync(dir + "calc-r3-perto.svg", tile("p3", 0.34, 0.14));
console.log("r3 ok");
