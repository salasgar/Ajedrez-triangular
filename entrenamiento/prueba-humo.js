// Prueba de humo sin navegador: partida completa, coronacion elegida, tablas
// por material, y el circuito serializar -> validar -> aplicar.
'use strict';
const fs = require('fs'), path = require('path');
const REPO = '/Users/salasgar/Documents/git/Ajedrez-triangular';
const src = ['geometry.js','rules.js','ai.js','saveload.js']
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
comprueba('rechaza casilla inexistente', !validateSave({version:1,histIndex:0,mode:'hh',
  history:[{turn:'w',board:[['99,99,99',{type:'K',color:'w'}]]}]}));
comprueba('rechaza sin dos reyes', !validateSave({version:1,histIndex:0,mode:'hh',
  history:[{turn:'w',board:[['0,1,1',{type:'K',color:'w'}]]}]}));

// 5. coronacion elegida distinta de dama
comprueba('PROMOTION_CHOICES incluye las cinco piezas',
  PROMOTION_CHOICES.length === 5 && PROMOTION_CHOICES.includes('E'));

// 6. tablas por material: solo rey contra rey
comprueba('rey contra rey son tablas', deadPosition(new Map([['0,1,1',{type:'K',color:'w'}],['0,0,1',{type:'K',color:'b'}]])));
comprueba('rey y caballo contra rey NO son tablas', !deadPosition(new Map([
  ['0,1,1',{type:'K',color:'w'}],['1,1,0',{type:'N',color:'w'}],['0,0,1',{type:'K',color:'b'}]])));
`);
console.log(fallos ? '\nFALLOS: ' + fallos : '\nTodo en verde');
process.exit(fallos ? 1 : 0);
