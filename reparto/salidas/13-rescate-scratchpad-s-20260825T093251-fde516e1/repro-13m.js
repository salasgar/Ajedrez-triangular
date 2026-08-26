#!/usr/bin/env node
// Descompone evaluateRps en sus términos (material, movilidad, amenaza,
// caza) para el tablero real del ply 16, antes y después de la captura
// gratis y de la jugada elegida por la búsqueda.
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = '/Users/salasgar/Documents/git/Ajedrez-triangular';

const ctx = vm.createContext({ console });
for (const f of ['geometry.js', 'variants.js', 'rules.js', 'ai.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}
function run(code) { return vm.runInContext('(function () {' + code + '}())', ctx); }

const pos = JSON.parse(fs.readFileSync('/private/tmp/claude-501/-Users-salasgar-Documents-git-Ajedrez-triangular/2645ba0b-b4b2-461f-8671-b7d7192b9188/scratchpad/posicion-ply16.json', 'utf8'));

const r = run(`
  setVariant('rps');
  const tablero = ${JSON.stringify(pos.tablero)};
  const board = new Map(tablero.map(([k,v]) => [k, v]));
  const cfg = AI_LEVELS[8];

  // Copia de evaluateRps pero devolviendo el desglose por términos (blancas
  // menos negras, antes de aplicar signo de color).
  function desglose(bd) {
    const info = rpsInfo();
    const values = cfg.pieceValues || PV();
    const mobilityWeight = cfg.mobilityWeight ?? 4;
    const cnt = { w: {}, b: {} }, ame = { w: {}, b: {} }, col = { w: {}, b: {} };
    for (const t of info.tipos) { cnt.w[t]=0;cnt.b[t]=0;ame.w[t]=0;ame.b[t]=0;col.w[t]=0;col.b[t]=0; }
    let mob = 0;
    const conCaza = V.kingless;
    const cW=[],tW=[],cB=[],tB=[];
    for (const [key, p] of bd) {
      const sw = p.color === 'w' ? 1 : -1;
      cnt[p.color][p.type]++;
      const cell = CELL_MAP.get(key);
      if (conCaza) { if (p.color==='w'){cW.push(cell);tW.push(p.type);} else {cB.push(cell);tB.push(p.type);} }
      if (cfg.mobility) {
        const leaps = cell.leaps[p.type];
        if (leaps) for (const t of leaps) {
          const o = bd.get(t.key);
          if (!o || (o.color !== p.color && canCapture(p.type, o.type))) mob += sw;
        }
      }
      if (p.type !== 'K') {
        const foe = p.color === 'w' ? 'b' : 'w';
        let amenazada=false, colgada=false;
        for (const a of info.capturadoPor[p.type]) {
          const desde = cell.leapAttackers[a];
          if (!desde) continue;
          for (const t of desde) {
            const o = bd.get(t.key);
            if (!o || o.color !== foe || o.type !== a) continue;
            amenazada = true;
            if (!rpsContraataque(bd, t, a, p.color)) { colgada = true; break; }
          }
          if (colgada) break;
        }
        if (colgada) col[p.color][p.type]++; else if (amenazada) ame[p.color][p.type]++;
      }
    }
    let matScore = 0, ameScore = 0;
    for (const t of info.figuras) {
      const vw = rpsValor(t, cnt.b), vb = rpsValor(t, cnt.w);
      matScore += cnt.w[t]*vw - cnt.b[t]*vb;
      ameScore -= RPS_AMENAZA*(ame.w[t]*vw - ame.b[t]*vb) + RPS_AMENAZA_COLGADA*(col.w[t]*vw - col.b[t]*vb);
    }
    let cazaScore = 0;
    if (conCaza) {
      for (let i=0;i<cW.length;i++) {
        const cazadores = info.depredadores[tW[i]];
        let dmin = Infinity;
        for (let j=0;j<cB.length;j++){ if (cazadores.indexOf(tB[j])<0) continue; const d=rpsDist(info,cW[i],cB[j]); if(d<dmin)dmin=d;}
        if (dmin<Infinity) cazaScore -= RPS_PESO_CAZA*(1-dmin/info.diam);
      }
      for (let i=0;i<cB.length;i++) {
        const cazadores = info.depredadores[tB[i]];
        let dmin = Infinity;
        for (let j=0;j<cW.length;j++){ if (cazadores.indexOf(tW[j])<0) continue; const d=rpsDist(info,cB[i],cW[j]); if(d<dmin)dmin=d;}
        if (dmin<Infinity) cazaScore += RPS_PESO_CAZA*(1-dmin/info.diam);
      }
    }
    const mobScore = cfg.mobility ? mobilityWeight * mob : 0;
    return { material: matScore, amenaza: ameScore, caza: cazaScore, movilidad: mobScore,
      total: matScore + ameScore + cazaScore + mobScore };
  }

  function aplicar(bd, mv) {
    const b2 = new Map(bd);
    const p = b2.get(mv.from);
    b2.delete(mv.from);
    b2.set(mv.to, { ...p, moved: true });
    return b2;
  }

  const captura = { from: '-1,1,2', to: '-2,2,1' };
  const elegida = { from: '0,0,1', to: '-1,0,2' };

  return {
    antes: desglose(board),
    trasCaptura: desglose(aplicar(board, captura)),
    trasElegida: desglose(aplicar(board, elegida)),
  };
`);
console.log(JSON.stringify(r, null, 2));
