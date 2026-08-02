// Prueba de humo sin navegador: partida completa, coronacion elegida, tablas
// por material, y el circuito serializar -> validar -> aplicar.
'use strict';
const fs = require('fs'), path = require('path');
const REPO = '/Users/salasgar/Documents/git/Ajedrez-triangular';
const src = ['geometry.js','variants.js','rules.js','ai.js','saveload.js']
  .map(f => fs.readFileSync(path.join(REPO,f),'utf8')).join('\n');
let fallos = 0;
const comprueba = (n, ok) => { console.log((ok ? '  ok   ' : '  FALLA ') + n); if (!ok) fallos++; };
eval(src + `
let _s=5>>>0;
Math.random=function(){_s=(_s+0x6D2B79F5)>>>0;let t=_s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};

// 1. partida de 60 jugadas al azar
newGame();
let jugadas = 0;
while (!gameEnded() && jugadas < 60) {
  const ms = movesForSide(game.board, game.turn, game.enPassant);
  if (!ms.length) break;
  const m = ms[Math.floor(Math.random()*ms.length)];
  makeMove(m.from, m.to);
  jugadas++;
}
comprueba('partida de ' + jugadas + ' jugadas sin excepcion', jugadas === 60 || gameEnded());

// 2. serializar -> validar -> aplicar
const sobre = serializeGame('hc', 4, null);
comprueba('validateSave acepta lo que produce serializeGame', validateSave(sobre));
const antes = game.history.length;
applySave(sobre);
comprueba('applySave restaura el historial (' + antes + ')', game.history.length === antes);

// 3. un guardado antiguo (sin promo en lastMove) sigue siendo valido
const viejo = JSON.parse(JSON.stringify(sobre));
for (const s of viejo.history) if (s.lastMove) delete s.lastMove.promo;
comprueba('guardado antiguo sin campo promo sigue validando', validateSave(viejo));

// 4. basura rechazada
comprueba('rechaza historial vacio', !validateSave({version:1,history:[],histIndex:0,mode:'hh'}));
// Con la versión y la modalidad correctas, para que lo que se rechace sea de
// verdad la casilla o los reyes y no el número de versión.
const malo = (board) => ({version:SAVE_VERSION,variant:'salas',histIndex:0,mode:'hh',
  history:[{turn:'w',board}]});
comprueba('rechaza casilla inexistente', !validateSave(malo([['99,99,99',{type:'K',color:'w'}]])));
comprueba('rechaza sin dos reyes', !validateSave(malo([['0,1,1',{type:'K',color:'w'}]])));
comprueba('rechaza una modalidad desconocida',
  !validateSave({...malo([['0,1,1',{type:'K',color:'w'}],['0,0,1',{type:'K',color:'b'}]]), variant:'nomeconsta'}));

// 5. coronacion elegida distinta de dama
comprueba('las opciones de coronación de Salas son las cinco piezas',
  V.promotionChoices.length === 5 && V.promotionChoices.includes('E'));

// 5b. CORONACION DE FLANCO. Un peón blanco en B7C se queda sin casilla de
// avance: pegado al borde de arriba a la izquierda, no tiene nada enfrente.
// Con la regla (modalidad 'salas') puede seguir en diagonal hasta B8D y
// coronar; sin ella ('salas-2026') se queda ahí clavado para siempre, que es
// justo el defecto geométrico que la regla corrige.
function peonAtascado() {
  newGame();
  game.board.clear();
  game.board.set(cellFromName('B7C').key, {type:'P',color:'w',moved:true});
  game.board.set(cellFromName('B1A').key, {type:'K',color:'w',moved:true});
  game.board.set(cellFromName('N8H').key, {type:'K',color:'b',moved:true});
  game.turn = 'w';
  return legalMoves(game.board, cellFromName('B7C').key, game.board.get(cellFromName('B7C').key))
    .map(cellName);
}
const conRegla = peonAtascado();
comprueba('con coronación de flanco, el peón de B7C avanza a B8D: ' + (conRegla.join(',') || 'nada'),
  conRegla.length === 1 && conRegla[0] === 'B8D');
comprueba('y B8D corona', cellFromName('B8D').promoFor.w);
setVariant('salas-2026');
const sinRegla = peonAtascado();
comprueba('sin la regla, ese mismo peón no tiene ninguna jugada: ' + (sinRegla.join(',') || 'nada'),
  sinRegla.length === 0);
setVariant('salas');

// 5c. las otras modalidades arrancan y generan jugadas
for (const id of ['dekle', 'trigonal']) {
  setVariant(id);
  newGame();
  const n = movesForSide(game.board, 'w', null).length;
  comprueba('la modalidad ' + id + ' reparte ' + game.board.size + ' piezas y tiene ' + n + ' jugadas',
    game.board.size >= 32 && n > 0);
}
setVariant('salas');
newGame();

// 6. tablas por material: solo rey contra rey
comprueba('rey contra rey son tablas', deadPosition(new Map([['0,1,1',{type:'K',color:'w'}],['0,0,1',{type:'K',color:'b'}]])));
comprueba('rey y caballo contra rey NO son tablas', !deadPosition(new Map([
  ['0,1,1',{type:'K',color:'w'}],['1,1,0',{type:'N',color:'w'}],['0,0,1',{type:'K',color:'b'}]])));
`);
console.log(fallos ? '\nFALLOS: ' + fallos : '\nTodo en verde');
process.exit(fallos ? 1 : 0);
