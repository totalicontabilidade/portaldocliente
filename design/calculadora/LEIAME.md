# Padrão de calculadora (guardado)

Em 23/09/2026 o Raoni pediu para o portal usar exatamente o quebra-cabeça do Agência 100K (assets/brand/puzzle-*.svg e piece.svg, CSS em css/app.css). O padrão de calculadora R3 que estava em uso ficou aqui para um possível uso futuro:

- `calc-menu.svg` (0.20/0.08) e `calc-login.svg` (0.30/0.12): azulejos 240×300 com mostrador "1.250,00" e teclado inteiro.
- `calc-piece.svg`: a tecla "=" dourada em destaque.
- `calc-r3-perto.svg`: o azulejo em tamanho grande, para ver o desenho.
- `gerar-padrao2.js` + `gerar-r3.js`: os geradores (Node). `gerar-r3.js` importa as funções de `gerar-padrao2.js`; ajuste os caminhos antes de rodar.

Para voltar: copie os três SVGs para assets/brand/, restaure as regras `.puzzle-layer/.puzzle-menu/.puzzle-login/.puzzle-piece` e os véus do commit f593c5b em css/app.css.
