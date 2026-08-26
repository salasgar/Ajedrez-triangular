#!/usr/bin/env node
// Partida larga 'rps' a nivel 8, guardando SI la jugada elegida también fue
// captura (y de qué), para distinguir "de verdad ignoró la gratis" de
// "prefirió una captura mejor".
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

const r = run(`
  setVariant('rps');
  newGame();
  _siembra(100);
  const hallazgos = [];
  let plies = 0;
  while (!gameEnded() && plies < 220) {
    const color = game.turn;
    const board = game.board;
    const kings = { w: null, b: null };
    const misCapturas = genCaptures(board, color, game.enPassant, kings, {});
    let capturaGratis = null;
    for (const m of misCapturas) {
      const board2 = new Map(board);
      const pieza = board2.get(m.from);
      board2.delete(m.from);
      board2.set(m.to, { ...pieza, moved: true });
      const rivalColor = color === 'w' ? 'b' : 'w';
      const recap = genCaptures(board2, rivalColor, null, kings, {})
        .filter(rm => rm.to === m.to);
      if (recap.length === 0) { capturaGratis = m; break; }
    }
    const mv = chooseAiMove(8);
    if (capturaGratis && !(mv.from === capturaGratis.from && mv.to === capturaGratis.to)) {
      const elegidaCapturo = board.get(mv.to);
      // ¿la elegida es TAMBIÉN una captura gratis (sin recaptura)?
      let elegidaEsGratis = null;
      if (elegidaCapturo) {
        const board3 = new Map(board);
        const pieza3 = board3.get(mv.from);
        board3.delete(mv.from);
        board3.set(mv.to, { ...pieza3, moved: true });
        const rivalColor = color === 'w' ? 'b' : 'w';
        const recap3 = genCaptures(board3, rivalColor, null, kings, {})
          .filter(rm => rm.to === mv.to);
        elegidaEsGratis = recap3.length === 0;
      }
      hallazgos.push({
        ply: plies, color, nPiezas: board.size,
        capturaGratis, piezaCapturadaGratis: board.get(capturaGratis.to).type,
        piezaCapturadoraGratis: board.get(capturaGratis.from).type,
        elegida: { from: mv.from, to: mv.to },
        elegidaCaptura: elegidaCapturo ? elegidaCapturo.type : null,
        elegidaEsGratis,
      });
    }
    makeMove(mv.from, mv.to);
    plies++;
  }
  return { hallazgos, totalPlies: plies, status: game.status };
`);
fs.writeFileSync('/private/tmp/claude-501/-Users-salasgar-Documents-git-Ajedrez-triangular/2645ba0b-b4b2-461f-8671-b7d7192b9188/scratchpad/hallazgos-13k.json', JSON.stringify(r, null, 2));
console.log('plies:', r.totalPlies, 'hallazgos:', r.hallazgos.length);
const noCapturaEnAbsoluto = r.hallazgos.filter(h => !h.elegidaCaptura);
console.log('de esos, NO capturó nada (ni siquiera otra pieza):', noCapturaEnAbsoluto.length);
console.log(JSON.stringify(noCapturaEnAbsoluto.slice(0, 10), null, 2));
