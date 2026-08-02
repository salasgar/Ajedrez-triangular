// Reparto de la "perdida" que mide moveAnnotation cuando NADIE se equivoca:
// autojuego del mismo nivel contra si mismo. Todo lo que salga aqui es ruido
// de la busqueda, no errores.
'use strict';
const fs = require('fs'), path = require('path');
const REPO = '/Users/salasgar/Documents/git/Ajedrez-triangular';
const src = ['geometry.js','variants.js','rules.js','ai.js'].map(f => fs.readFileSync(path.join(REPO,f),'utf8')).join('\n');
const libro = JSON.parse(fs.readFileSync(REPO + '/entrenamiento/libro.json','utf8')).slice(0, 5);
const perdidas = [];
eval(src + `
let _s=11>>>0;
Math.random=function(){_s=(_s+0x6D2B79F5)>>>0;let t=_s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
AI_LEVELS.X = { depth: 4, mobility: true, order: true, quiesce: true };
for (const ap of ${JSON.stringify(libro)}) {
  newGame();
  for (const s of ap) { const [f,t]=s.split('>'); makeMove(f,t); }
  const evs = [];                       // evaluacion desde las BLANCAS, por ply
  for (let k = 0; k < 34 && !gameEnded(); k++) {
    const r = chooseAiMove('X', undefined, { analyze: true });
    if (!r) break;
    const elegida = r.analysis.find(e => e.chosen);
    const blancasMueven = game.turn === 'w';
    evs.push(blancasMueven ? elegida.score : -elegida.score);
    makeMove(r.from, r.to);
  }
  // misma cuenta que moveAnnotation: perdida del que acaba de mover
  for (let j = 1; j < evs.length; j++) {
    const blancasMovieron = (j % 2 === 1) ? false : true;  // evs[0] = jugada blanca
    const antes = evs[j-1], desp = evs[j];
    perdidas.push(((j % 2 === 0) ? antes - desp : desp - antes));
  }
}
`);
const abs = perdidas.map(Math.abs).sort((a,b)=>a-b);
const pct = q => abs[Math.min(abs.length-1, Math.floor(q*abs.length))];
const media = perdidas.reduce((a,b)=>a+b,0)/perdidas.length;
console.log('muestras: ' + perdidas.length);
console.log('media con signo: ' + media.toFixed(1) + ' cp   (0 si no hubiera sesgo)');
console.log('positivas: ' + perdidas.filter(x=>x>0).length + ' de ' + perdidas.length);
console.log('|perdida|  mediana ' + pct(0.5) + '   p90 ' + pct(0.9) + '   p95 ' + pct(0.95) + '   p99 ' + pct(0.99) + '   max ' + abs[abs.length-1]);
for (const u of [50, 100, 150, 200, 300, 400]) {
  const n = perdidas.filter(x => x >= u).length;
  console.log('  umbral ' + String(u).padStart(3) + ' cp: marcaria ' + n + ' de ' + perdidas.length + ' jugadas (' + (100*n/perdidas.length).toFixed(1) + '%)');
}
