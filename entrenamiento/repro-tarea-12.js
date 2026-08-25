// repro-tarea-12.js — Reproducción de los dos fallos de la tarea 12, sesión
// s-20260824T235458-3ccd1290 (reparto/tareas/tarea-12-problemas-bien-planteados.md).
//
// Fallo 1: un problema anuncia "mate en N" existiendo mate en menos.
// Fallo 2: una jugada alternativa que también resuelve se da por mala en la UI.
//
// node entrenamiento/repro-tarea-12.js [--n=20] [--nivel=facil,medio,dificil,experto]

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

const MUESTRAS = Number(arg('n', 20));
const niveles = arg('nivel', 'facil,medio,dificil').split(',');
const soloTipo = arg('tipo', null);

let bug1 = 0, bug2 = 0, revisados = 0;

// --- Fallo 1: ¿existe una solución con MENOS jugadas que las declaradas, en
// CUALQUIER profundidad de 1 a jugadas-1 (no solo jugadas-1)? -------------
function buscaAtajo(p) {
  const board = new Map(p.board.map(([k, pieza]) => [k, pieza]));
  const minJugadas = p.obj.tipo === 'tablas' ? 1 : PROB_NIVELES[p.dificultad].jugadas[0];
  for (let n = minJugadas; n < p.obj.jugadas; n++) {
    let sols;
    try {
      sols = probSoluciones(board, p.turn, null, { ...p.obj, jugadas: n }, p.base, PROB_NIVELES[p.dificultad].tope);
    } catch (e) {
      if (e !== PROB_ABORTO) throw e;
      continue;   // sin concluir a esta profundidad, no cuenta como fallo confirmado
    }
    if (sols.length) return n;
  }
  return null;
}

// --- Fallo 2: para cada jugada legal del que resuelve en la posición
// inicial del problema (no solo la de la línea guardada), si una búsqueda
// FRESCA confirma que esa jugada también fuerza el objetivo en las jugadas
// que quedan, ¿la acepta probJuzga (la función que usa la UI en vivo)? -----
function pruebaAlternativas(p) {
  const boardIni = new Map(p.board.map(([k, pieza]) => [k, pieza]));
  const legales = probMovs(boardIni, p.turn, null);
  const fallos = [];
  for (const m of legales) {
    const b2 = probCopia(boardIni);
    const victimaPrev = boardIni.get(m.to) || null;
    const pieza = boardIni.get(m.from);
    const ep2 = applyMoveSim(b2, m.from, m.to, null);
    const corono = pieza.type === 'P' && !!CELL_MAP.get(m.to).promoFor[pieza.color];

    // ¿Esta jugada fuerza el objetivo en las (jugadas-1) que quedan, con una
    // búsqueda fresca e independiente de la línea guardada?
    const quedan = p.obj.jugadas - 1;
    let confirmaAlternativa = false;
    if (quedan === 0) {
      // el objetivo tiene que cumplirse YA con esta sola jugada
      const hd = probHijos(b2, ep2, rival(p.turn));
      const tocada = p.obj.tipo === 'gana' && victimaPrev && victimaPrev.type === p.obj.pieza;
      const v = probVeredicto({ board: b2, ep: ep2, victima: victimaPrev ? victimaPrev.type : null, corono },
        hd, rival(p.turn), tocada, null, probCtx(p.turn, p.obj, p.base, PROB_TOPE_VIVO));
      confirmaAlternativa = v === 'exito';
    } else {
      try {
        const objResto = { ...p.obj, jugadas: quedan };
        // búsqueda Y/O desde la posición del DEFENSOR (le toca a él tras esta jugada)
        const hd = probHijos(b2, ep2, rival(p.turn));
        const tocada = p.obj.tipo === 'gana' && victimaPrev && victimaPrev.type === p.obj.pieza;
        const ctx = probCtx(p.turn, p.obj, p.base, PROB_TOPE_VIVO);
        const v0 = probVeredicto({ board: b2, ep: ep2, victima: victimaPrev ? victimaPrev.type : null, corono },
          hd, rival(p.turn), tocada, null, ctx);
        if (v0 === 'exito') {
          confirmaAlternativa = true;
        } else if (v0 !== 'fracaso') {
          // ¿todas las respuestas del defensor pierden en <= quedan jugadas del solver?
          let todasPierden = hd.length > 0;
          for (const h of hd) {
            const hs = probHijos(h.board, h.ep, p.turn);
            let linea = null;
            for (let k = 1; k <= quedan && !linea; k++) {
              linea = probNodoOR(hs, k, tocada, null, ctx);
            }
            if (!linea) { todasPierden = false; break; }
          }
          confirmaAlternativa = todasPierden;
        }
      } catch (e) {
        if (e !== PROB_ABORTO) throw e;
        confirmaAlternativa = false;   // sin concluir, no se cuenta
      }
    }
    if (!confirmaAlternativa) continue;   // esta jugada no es una solución alternativa real

    // Ahora, lo que HARÍA la UI: probJuzga con el mismo movimiento aplicado.
    const ini = {
      base: p.base,
      tocada: p.obj.tipo === 'gana' && victimaPrev && victimaPrev.type === p.obj.pieza,
      corono,
      victima: victimaPrev ? victimaPrev.type : null,
      camino: p.obj.tipo === 'tablas' ? [positionKey(boardIni, p.turn, null), positionKey(b2, rival(p.turn), ep2)] : null,
    };
    let r;
    try {
      r = probJuzga(b2, rival(p.turn), ep2, p.obj, quedan, ini, PROB_TOPE_VIVO);
    } catch (e) {
      if (e !== PROB_ABORTO) throw e;
      continue;
    }
    if (r.estado === 'fallo') {
      fallos.push({ from: m.from, to: m.to, esLaGuardada: p.linea[0].from === m.from && p.linea[0].to === m.to });
    }
  }
  return fallos;
}

for (const nivel of niveles) {
  const cfg = PROB_NIVELES[nivel];
  if (!cfg) continue;
  const tipos = soloTipo ? [soloTipo] : probTiposNivel(nivel);
  for (const tipo of tipos) {
    let generados = 0;
    for (let i = 0; i < MUESTRAS; i++) {
      const p = probGenera(nivel, [tipo], cfg.msEspera || 8000);
      if (!p) continue;
      generados++;
      revisados++;

      const atajoEn = buscaAtajo(p);
      if (atajoEn !== null) {
        bug1++;
        console.log('[BUG1] ' + nivel + '/' + tipo + ': declara ' + p.obj.jugadas +
          ' jugadas, hay solución en ' + atajoEn + '. base=' + p.base +
          ' board=' + JSON.stringify([...p.board]));
      }

      const alternativasRechazadas = pruebaAlternativas(p);
      if (alternativasRechazadas.length) {
        bug2++;
        console.log('[BUG2] ' + nivel + '/' + tipo + ' (' + p.obj.jugadas + ' jugadas): ' +
          alternativasRechazadas.length + ' jugada(s) alternativa(s) que la búsqueda fresca confirma como solución, ' +
          'rechazadas por probJuzga: ' + JSON.stringify(alternativasRechazadas) +
          ' | línea guardada: ' + JSON.stringify(p.linea) +
          ' | board=' + JSON.stringify([...p.board]) + ' turn=' + p.turn + ' base=' + p.base +
          ' obj=' + JSON.stringify(p.obj));
      }
    }
    console.log(nivel + '/' + tipo + ': ' + generados + ' generados y revisados.');
  }
}

console.log('\\nTotal: ' + revisados + ' revisados, ' + bug1 + ' con BUG1 (atajo), ' + bug2 + ' con BUG2 (alternativa rechazada).');
`);
