// repro-tarea-12-profundo.js — Como repro-tarea-12.js pero probando
// alternativas en CADA jugada del que resuelve, no solo en la primera:
// tras cada jugada alternativa válida, se sigue la respuesta que el propio
// probJuzga elegiría para el defensor (la que más aguanta), y se repite en
// la jugada siguiente. Así se cubren los nodos intermedios del árbol, no
// solo la raíz. Sesión s-20260824T235458-3ccd1290, tarea 12.
//
// node entrenamiento/repro-tarea-12-profundo.js [--n=10] [--nivel=medio,dificil] [--tipo=mate,gana]
const fs = require('fs');
const path = require('path');

function arg(nombre, defecto) {
  const pre = '--' + nombre + '=';
  const a = process.argv.find(x => x.startsWith(pre));
  return a ? a.slice(pre.length) : defecto;
}

const raiz = path.join(__dirname, '..');
const src = ['geometry.js', 'variants.js', 'rules.js', 'ai.js', 'problemas.js']
  .map(f => fs.readFileSync(path.join(raiz, f), 'utf8')).join('\n');

eval(src + `
setVariant(DEFAULT_VARIANT);
newGame();

const MUESTRAS = Number(arg('n', 10));
const niveles = arg('nivel', 'medio,dificil').split(',');
const soloTipo = (arg('tipo', 'mate,gana') || '').split(',');

let bug2 = 0, revisados = 0, nodosVisitados = 0;

// Explora recursivamente: en la posición dada (turno del que resuelve),
// prueba TODAS las jugadas legales; para cada una que una búsqueda fresca
// confirma como ganadora en las jugadas que quedan, comprueba que probJuzga
// (la misma función que usa problemas-ui.js) también la acepta, y si la
// acepta, sigue un nivel más abajo con la respuesta que probJuzga elige
// para el defensor.
function explora(p, board, ep, quedanAntes, tocadaPrev, profundidad, ruta) {
  if (quedanAntes <= 0 || profundidad > 4) return;
  nodosVisitados++;
  const legales = probMovs(board, p.turn, ep);
  let algunaGanadora = false;
  for (const m of legales) {
    const b2 = probCopia(board);
    const victimaPrev = board.get(m.to) || null;
    const pieza = board.get(m.from);
    const ep2 = applyMoveSim(b2, m.from, m.to, ep);
    const corono = pieza.type === 'P' && !!CELL_MAP.get(m.to).promoFor[pieza.color];
    const tocada = tocadaPrev || (p.obj.tipo === 'gana' && victimaPrev && victimaPrev.type === p.obj.pieza);
    const quedan = quedanAntes - 1;

    // Oráculo independiente: ¿esta jugada fuerza el objetivo en <= quedan
    // jugadas más, con una búsqueda fresca (no la que usa el juego)?
    const ctx = probCtx(p.turn, p.obj, p.base, PROB_TOPE_VIVO);
    const hd = probHijos(b2, ep2, rival(p.turn));
    const v0 = probVeredicto({ board: b2, ep: ep2, victima: victimaPrev ? victimaPrev.type : null, corono },
      hd, rival(p.turn), tocada, null, ctx);
    let esGanadora = false;
    if (v0 === 'exito') esGanadora = true;
    else if (v0 !== 'fracaso' && quedan > 0) {
      let todasPierden = hd.length > 0;
      for (const h of hd) {
        const hs = probHijos(h.board, h.ep, p.turn);
        let linea = null;
        try {
          for (let k = 1; k <= quedan && !linea; k++) linea = probNodoOR(hs, k, tocada, null, ctx);
        } catch (e) { if (e !== PROB_ABORTO) throw e; todasPierden = false; break; }
        if (!linea) { todasPierden = false; break; }
      }
      esGanadora = todasPierden;
    }
    if (!esGanadora) continue;
    algunaGanadora = true;

    // ¿La acepta probJuzga, la función real de la UI?
    const ini = {
      base: p.base, tocada, corono,
      victima: victimaPrev ? victimaPrev.type : null, camino: null,
    };
    let r;
    try {
      r = probJuzga(b2, rival(p.turn), ep2, p.obj, quedan, ini, PROB_TOPE_VIVO);
    } catch (e) {
      if (e !== PROB_ABORTO) throw e;
      continue;
    }
    const rutaAqui = ruta.concat(m.from + '-' + m.to);
    if (r.estado === 'fallo') {
      bug2++;
      console.log('[BUG2-PROFUNDO] profundidad ' + profundidad + ', ruta ' + rutaAqui.join(' > ') +
        ': jugada confirmada ganadora por búsqueda fresca pero probJuzga dice FALLO. ' +
        'obj=' + JSON.stringify(p.obj) + ' quedan=' + quedan);
      continue;
    }
    if (r.estado === 'exito' || quedan === 0) continue;   // hoja resuelta, no hay más que seguir
    // Sigue un nivel más abajo con la respuesta que el propio juego elegiría.
    explora(p, r.mov ? applyMoveSimBoard(b2, r.mov, ep2) : b2,
      r.mov ? applyMoveSim(b2, r.mov.from, r.mov.to, ep2) : ep2,
      r.quedan, tocada, profundidad + 1, rutaAqui.concat(r.mov ? r.mov.from + '-' + r.mov.to + '(defensor)' : '(defensor autoahogado)'));
  }
}

function applyMoveSimBoard(board, m, ep) {
  const b2 = probCopia(board);
  applyMoveSim(b2, m.from, m.to, ep);
  return b2;
}

for (const nivel of niveles) {
  const cfg = PROB_NIVELES[nivel];
  if (!cfg) continue;
  const tipos = probTiposNivel(nivel).filter(t => soloTipo.includes(t));
  for (const tipo of tipos) {
    let generados = 0;
    for (let i = 0; i < MUESTRAS; i++) {
      const p = probGenera(nivel, [tipo], cfg.msEspera || 8000);
      if (!p) continue;
      generados++;
      revisados++;
      const board = new Map(p.board.map(([k, pieza]) => [k, pieza]));
      explora(p, board, null, p.obj.jugadas, false, 1, []);
    }
    console.log(nivel + '/' + tipo + ': ' + generados + ' generados y explorados en profundidad.');
  }
}

console.log('\\nTotal: ' + revisados + ' problemas, ' + nodosVisitados + ' nodos del árbol de juego explorados, ' + bug2 + ' con BUG2 en algún nivel de profundidad.');
`);
