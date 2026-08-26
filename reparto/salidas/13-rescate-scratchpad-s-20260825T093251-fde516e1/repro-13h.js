#!/usr/bin/env node
// Juega partidas IA-IA reales en las 4 modalidades PPT a nivel alto y busca
// turnos en los que había una captura VERDADERAMENTE gratis (sin
// recaptura posible en la casilla de destino) y la IA no la jugó.
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = '/Users/salasgar/Documents/git/Ajedrez-triangular';

const ctx = vm.createContext({ console });
for (const f of ['geometry.js', 'variants.js', 'rules.js', 'ai.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}
function run(code) { return vm.runInContext('(function () {' + code + '}())', ctx); }

vm.runInContext(`
function _siembra(seed) {
  let s = seed >>> 0;
  Math.random = function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}`, ctx);

const modalidades = ['rps', 'rpsls', 'rps-rey', 'rpsls-rey'];
const nivel = 8;
const partidasPorModalidad = 3;
const casos = [];

for (const id of modalidades) {
  for (let seed = 1; seed <= partidasPorModalidad; seed++) {
    const r = run(`
      setVariant('${id}');
      newGame();
      _siembra(${seed * 97 + 3});
      const hallazgos = [];
      let plies = 0;
      while (!gameEnded() && plies < 200) {
        const color = game.turn;
        const board = game.board;
        // ¿hay alguna captura verdaderamente gratis para 'color'? (destino
        // no vuelve a ser capturable por ninguna pieza rival tras la jugada)
        const kings = { w: null, b: null };
        for (const [k,p] of board) if (p.type === 'K') kings[p.color] = k;
        const misCapturas = genCaptures(board, color, game.enPassant, kings, {});
        let capturaGratis = null;
        for (const m of misCapturas) {
          const board2 = new Map(board);
          const pieza = board2.get(m.from);
          board2.delete(m.from);
          board2.set(m.to, { ...pieza, moved: true });
          const kings2 = { ...kings };
          const rivalColor = color === 'w' ? 'b' : 'w';
          const recap = genCaptures(board2, rivalColor, null, kings2, {})
            .filter(rm => rm.to === m.to);
          if (recap.length === 0) { capturaGratis = m; break; }
        }
        const mv = chooseAiMove(${nivel}, undefined, { analyze: true });
        if (capturaGratis && !(mv.from === capturaGratis.from && mv.to === capturaGratis.to)) {
          const capScore = mv.analysis.find(a => a.from === capturaGratis.from && a.to === capturaGratis.to);
          hallazgos.push({
            modalidad: '${id}', ply: plies, color,
            capturaGratis, elegida: { from: mv.from, to: mv.to },
            scoreCapturaGratis: capScore ? capScore.score : null,
            scoreElegida: mv.analysis.find(a => a.chosen).score,
            nPiezas: board.size,
            tablero: Array.from(board.entries()),
          });
        }
        makeMove(mv.from, mv.to);
        plies++;
      }
      return hallazgos;
    `);
    casos.push(...r);
  }
}
console.log('Total hallazgos:', casos.length);
console.log(JSON.stringify(casos.slice(0, 5), null, 2));
fs.writeFileSync('/private/tmp/claude-501/-Users-salasgar-Documents-git-Ajedrez-triangular/2645ba0b-b4b2-461f-8671-b7d7192b9188/scratchpad/hallazgos-13.json', JSON.stringify(casos, null, 2));
