/* Padrão de calculadora REFINADO: teclas com relevo real (degradê, brilho no topo, sombra embaixo),
   mostrador e sinais gravados. Gera três variações em design/previa/ para o Raoni escolher. */
const fs = require("fs");
const G = "#C89D57", GL = "#E6C889", GD = "#8F6A2E";
function defs(id) {
  return `<defs>
  <linearGradient id='${id}k' x1='0' y1='0' x2='0.3' y2='1'><stop offset='0' stop-color='${GL}'/><stop offset='0.55' stop-color='${G}'/><stop offset='1' stop-color='${GD}'/></linearGradient>
  <linearGradient id='${id}g' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#ffffff' stop-opacity='.35'/><stop offset='0.5' stop-color='#ffffff' stop-opacity='0'/></linearGradient>
  <linearGradient id='${id}v' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='${GL}' stop-opacity='.16'/><stop offset='1' stop-color='${GD}' stop-opacity='.06'/></linearGradient>
  <filter id='${id}s' x='-20%' y='-20%' width='140%' height='150%'><feDropShadow dx='0' dy='4' stdDeviation='3' flood-color='#000' flood-opacity='.45'/></filter>
  <filter id='${id}i' x='-20%' y='-20%' width='140%' height='140%'><feGaussianBlur stdDeviation='1.2'/></filter>
</defs>`;
}
function simbolo(c, cy, k, s, cor, op, w) {
  const g = `<g stroke='${cor}' stroke-opacity='${op}' stroke-width='${w}' stroke-linecap='round' fill='none'>`;
  let p = "";
  if (s === "+") p = `<path d='M${c - k} ${cy}H${c + k}M${c} ${cy - k}V${cy + k}'/>`;
  if (s === "-") p = `<path d='M${c - k} ${cy}H${c + k}'/>`;
  if (s === "x") p = `<path d='M${c - k * .8} ${cy - k * .8}L${c + k * .8} ${cy + k * .8}M${c + k * .8} ${cy - k * .8}L${c - k * .8} ${cy + k * .8}'/>`;
  if (s === "=") p = `<path d='M${c - k} ${cy - k * .45}H${c + k}M${c - k} ${cy + k * .45}H${c + k}'/>`;
  if (s === "/") p = `<path d='M${c - k} ${cy}H${c + k}'/><circle cx='${c}' cy='${cy - k * .7}' r='1.8' fill='${cor}' fill-opacity='${op}' stroke='none'/><circle cx='${c}' cy='${cy + k * .7}' r='1.8' fill='${cor}' fill-opacity='${op}' stroke='none'/>`;
  if (s === "%") p = `<path d='M${c - k} ${cy + k}L${c + k} ${cy - k}'/><circle cx='${c - k * .6}' cy='${cy - k * .6}' r='2.4'/><circle cx='${c + k * .6}' cy='${cy + k * .6}' r='2.4'/>`;
  if (typeof s === "number") return `<text x='${c}' y='${cy + k * .6}' font-family='Manrope,Segoe UI,Arial,sans-serif' font-size='${k * 2.2}' font-weight='800' text-anchor='middle' fill='${cor}' fill-opacity='${op}'>${s}</text>`;
  return g + p + "</g>";
}
/* Uma tecla realista: sombra projetada, corpo em degradê, brilho no topo, borda inferior escura, símbolo gravado */
function tecla(id, x, y, s, sim, cheia, opCheia, opVidro) {
  const r = s * 0.24, c = x + s / 2, cy = y + s / 2, k = s * 0.19;
  let o = "";
  if (cheia) {
    o += `<rect x='${x}' y='${y + 3}' width='${s}' height='${s}' rx='${r}' fill='#000' fill-opacity='${opCheia * 2.2}' filter='url(#${id}i)'/>`;
    o += `<rect x='${x}' y='${y}' width='${s}' height='${s}' rx='${r}' fill='url(#${id}k)' fill-opacity='${opCheia}'/>`;
    o += `<rect x='${x + 1}' y='${y + 1}' width='${s - 2}' height='${s * 0.55}' rx='${r}' fill='url(#${id}g)' fill-opacity='${opCheia * 3}'/>`;
    o += `<rect x='${x + .6}' y='${y + .6}' width='${s - 1.2}' height='${s - 1.2}' rx='${r}' fill='none' stroke='${GL}' stroke-opacity='${opCheia * 2.4}' stroke-width='1'/>`;
    o += simbolo(c, cy + 1, k, sim, "#000", opCheia * 1.6, 2.6) + simbolo(c, cy, k, sim, GL, Math.min(.95, opCheia * 5), 2.4);
  } else {
    o += `<rect x='${x}' y='${y}' width='${s}' height='${s}' rx='${r}' fill='url(#${id}v)' fill-opacity='${opVidro * 6}' stroke='${G}' stroke-opacity='${opVidro * 3.2}' stroke-width='1.1'/>`;
    o += `<path d='M${x + r} ${y + 1.2}H${x + s - r}' stroke='${GL}' stroke-opacity='${opVidro * 4}' stroke-width='1' stroke-linecap='round'/>`;
    o += simbolo(c, cy, k, sim, G, Math.min(.9, opVidro * 4.5), 2.2);
  }
  return o;
}
const TECLAS = [7, 8, 9, "/", 4, 5, 6, "x", 1, 2, 3, "-", 0, "%", "=", "+"];
function tile(id, opCheia, opVidro, comMostrador) {
  const t = 50, gap = 10, x0 = 10, y0 = 10;
  let s = defs(id);
  if (comMostrador) {
    /* mostrador do topo: retângulo com dígitos apagados, ocupa a primeira linha */
    s += `<rect x='${x0}' y='${y0}' width='${4 * t + 3 * gap}' height='${t}' rx='10' fill='#000' fill-opacity='${opCheia * 1.8}' stroke='${G}' stroke-opacity='${opVidro * 3}'/>`;
    s += `<text x='${x0 + 4 * t + 3 * gap - 12}' y='${y0 + t * .68}' font-family='Consolas,Menlo,monospace' font-size='26' text-anchor='end' fill='${GL}' fill-opacity='${opVidro * 5}' letter-spacing='2'>1.250,00</text>`;
  }
  const linhas = comMostrador ? 3 : 4;
  for (let j = 0; j < linhas; j++) for (let i = 0; i < 4; i++) {
    const idx = (comMostrador ? j + 1 : j) * 4 + i, sim = TECLAS[idx % 16];
    const x = x0 + i * (t + gap), y = y0 + (comMostrador ? j + 1 : j) * (t + gap);
    const cheia = typeof sim !== "number";
    s += tecla(id, x, y, t, sim, cheia, opCheia, opVidro);
  }
  return `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240' viewBox='0 0 240 240'>${s}</svg>`;
}
const dir = "C:/Users/Totali/Desktop/Portal do Cliente/design/previa/";
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(dir + "calc-r1.svg", tile("a", 0.13, 0.05, false));   /* R1: teclas em relevo, operadores dourados cheios */
fs.writeFileSync(dir + "calc-r2.svg", tile("b", 0.20, 0.07, false));   /* R2: mais presente */
fs.writeFileSync(dir + "calc-r3.svg", tile("c", 0.15, 0.06, true));    /* R3: com mostrador, lê como calculadora inteira */
console.log("ok");
