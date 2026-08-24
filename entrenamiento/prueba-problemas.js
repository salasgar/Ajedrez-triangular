// prueba-problemas.js — Verificador independiente de problemas.
//
// problemas.js encuentra sus soluciones con el camino RÁPIDO del motor
// (genMoves/isAttackedFast de ai.js: la reimplementación a mano que hace
// posible generar problemas de tres o cuatro jugadas). Este script coge cada
// problema ya generado y lo vuelve a resolver desde cero con el camino LENTO
// pero canónico de rules.js (movesForSide/isAttacked), que es el que de
// verdad manda en la partida en curso y en cualquier posición cargada desde
// un .json importado. Si alguna vez divergen, aquí es donde se nota: un
// problema que el camino rápido dio por forzado pero que el camino lento no
// reconoce como tal es un problema roto que el usuario vería resolver mal (o
// resolvería con una jugada que problemas.js no contempló).
//
// Es una reimplementación mecánica del mismo árbol Y/O de problemas.js
// (mismos probVeredicto/probNodoOR/probNodoAND, misma forma, mismo
// probMaxSoluciones y las mismas constantes de material), cambiando solo los
// dos primitivos donde puede vivir el bug: qué jugadas son legales y quién
// está en jaque. Todo lo demás —material, quiescencia, reparto de jugadas,
// unicidad— es EL MISMO código en los dos caminos, así que no hace falta
// duplicarlo: no es ahí donde se bifurcan.
//
// Medido el 2026-08-24: movesForSide/isAttacked cuestan unas 4 veces más que
// genMoves/isAttackedFast (1196 ms vs 302 ms por 20 000 llamadas), no los
// órdenes de magnitud que hacían temer los comentarios de ai.js. El mismo
// `tope` de PROB_NIVELES (jugadas examinadas, no llamadas) vale para las dos
// búsquedas sin ajustar nada.
//
//   node entrenamiento/prueba-problemas.js
//   node entrenamiento/prueba-problemas.js --nivel=dificil --n=15
//   node entrenamiento/prueba-problemas.js --nivel=todos --n=8 --tipo=mate
//
// `--n` es cuántos problemas se generan y verifican por cada nivel×tipo
// (por defecto 6). El presupuesto de generación de cada uno es el `msEspera`
// del nivel si lo tiene (ver problemas.js), y si no, 15 s.
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

// --- el mismo árbol Y/O, con movesForSide/isAttacked en vez de
// genMoves/isAttackedFast ---------------------------------------------------

function probHijosIndep(board, ep, color) {
  const out = [];
  for (const m of movesForSide(board, color, ep)) {
    const pieza = board.get(m.from);
    let victima = board.get(m.to) || null;
    if (!victima && pieza.type === 'P' && ep && m.to === ep.targetKey) {
      victima = board.get(ep.pawnKey) || null;
    }
    const b2 = probCopia(board);
    const ep2 = applyMoveSim(b2, m.from, m.to, ep);
    out.push({
      m, board: b2, ep: ep2,
      victima: victima ? victima.type : null,
      corono: pieza.type === 'P' && !!CELL_MAP.get(m.to).promoFor[pieza.color],
    });
  }
  return out;
}

function probVeredictoIndep(h, hs, turn, tocada, camino, ctx) {
  const tipo = ctx.obj.tipo;
  if (hs.length === 0) {
    const rey = findKing(h.board, turn);
    if (rey && isAttacked(h.board, rey, rival(turn))) {
      return turn === ctx.def ? 'exito' : 'fracaso';
    }
    return tipo === 'tablas' ? 'exito' : 'fracaso';
  }
  if (h.board.size === 2) return tipo === 'tablas' ? 'exito' : 'fracaso';
  if (camino && probRepes(camino) >= 3) {
    return tipo === 'tablas' ? 'exito' : 'fracaso';
  }
  if (turn !== ctx.def) return null;
  if (tipo === 'gana' && tocada) {
    const meta = ctx.base + (PV()[ctx.obj.pieza] || 0);
    if (probMaterial(h.board, ctx.sol) >= meta &&
        probSaldoQuieto(h.board, turn, h.ep, ctx.sol) >= meta) return 'exito';
  }
  if (tipo === 'corona' && h.corono) {
    const meta = ctx.base + PROB_MARGEN_CORONA;
    if (probMaterial(h.board, ctx.sol) >= meta &&
        probSaldoQuieto(h.board, turn, h.ep, ctx.sol) >= meta) return 'exito';
  }
  return null;
}

function probNodoORIndep(hs, quedan, tocada, camino, ctx) {
  if (quedan <= 0) return null;
  ctx.nodos += hs.length;
  if (ctx.nodos > ctx.tope) throw PROB_ABORTO;
  // Mismo orden heurístico que usa el generador (probOrdenaOR): no afecta a
  // si el veredicto es correcto, solo a cuánto del árbol hay que visitar
  // antes de decidirlo. Sin esto, la búsqueda independiente no puede cortar
  // en la primera jugada que funciona y agota el tope en vez de concluir.
  probOrdenaOR(hs, ctx);
  for (const h of hs) {
    const toc = tocada || (ctx.obj.tipo === 'gana' && h.victima === ctx.obj.pieza);
    const cam = camino && camino.concat(positionKey(h.board, ctx.def, h.ep));
    const hd = probHijosIndep(h.board, h.ep, ctx.def);
    const v = probVeredictoIndep(h, hd, ctx.def, toc, cam, ctx);
    if (v === 'exito') return [h.m];
    if (v === 'fracaso') continue;
    if (quedan === 1) continue;
    const resto = probNodoANDIndep(hd, quedan - 1, toc, cam, ctx);
    if (resto) return [h.m, ...resto];
  }
  return null;
}

function probNodoANDIndep(hd, quedan, tocada, camino, ctx) {
  ctx.nodos += hd.length;
  if (ctx.nodos > ctx.tope) throw PROB_ABORTO;
  probOrdenaAND(hd);
  let muestra = null;
  for (const h of hd) {
    const cam = camino && camino.concat(positionKey(h.board, ctx.sol, h.ep));
    const hs = probHijosIndep(h.board, h.ep, ctx.sol);
    const v = probVeredictoIndep(h, hs, ctx.sol, tocada, cam, ctx);
    if (v === 'fracaso') return null;
    if (v === 'exito') { if (!muestra) muestra = [h.m]; continue; }
    const resto = probNodoORIndep(hs, quedan, tocada, cam, ctx);
    if (!resto) return null;
    if (!muestra) muestra = [h.m, ...resto];
  }
  return muestra;
}

function probSolucionesIndep(board, sol, ep, obj, base, tope) {
  const ctx = probCtx(sol, obj, base, tope);
  const camino = obj.tipo === 'tablas' ? [positionKey(board, sol, ep)] : null;
  const out = [];
  for (const h of probHijosIndep(board, ep, sol)) {
    const linea = probNodoORIndep([h], obj.jugadas, false, camino, ctx);
    if (linea) out.push(linea);
  }
  return out;
}

// --- generar problemas y volver a resolverlos con el árbol de arriba -------

const variante = arg('variant', DEFAULT_VARIANT);
if (!VARIANTS[variante]) {
  console.error('Modalidad desconocida: ' + variante);
  process.exit(1);
}
setVariant(variante);
newGame();

const MUESTRAS = Number(arg('n', 6));
const niveles = arg('nivel', Object.keys(PROB_NIVELES).join(','))
  .split(',').filter(n => PROB_NIVELES[n]);
const soloTipo = arg('tipo', null);

console.log('Modalidad ' + variante + ' · ' + MUESTRAS + ' problema(s) por nivel×tipo\\n');
console.log('Cada problema se genera con el camino rápido (como en el juego de');
console.log('verdad) y se vuelve a resolver desde cero con movesForSide/isAttacked.\\n');

let totalOk = 0, totalMal = 0, totalNoConcl = 0, totalCortos = 0;
const fallos = [];

for (const nivel of niveles) {
  const cfg = PROB_NIVELES[nivel];
  const tipos = soloTipo ? [soloTipo] : probTiposNivel(nivel);
  const msGen = cfg.msEspera || 15000;
  for (const tipo of tipos) {
    let ok = 0, mal = 0, noConcl = 0, corto = 0, generados = 0;
    for (let i = 0; i < MUESTRAS; i++) {
      const p = probGenera(nivel, [tipo], msGen);
      if (!p) continue;
      generados++;
      const board = new Map(p.board.map(([k, pieza]) => [k, pieza]));
      const topeIndep = cfg.tope;

      // 1) ¿Sigue forzado en las jugadas que dice el enunciado?
      let sols;
      try {
        sols = probSolucionesIndep(board, p.turn, null, p.obj, p.base, topeIndep);
      } catch (e) {
        if (e !== PROB_ABORTO) throw e;
        noConcl++;
        continue;
      }
      if (!sols.length) {
        mal++;
        fallos.push({ nivel, tipo, jugadas: p.obj.jugadas, motivo: 'no forzado (camino lento)', p });
        continue;
      }
      if (sols.length > probMaxSoluciones(tipo, p.obj.jugadas)) {
        mal++;
        fallos.push({
          nivel, tipo, jugadas: p.obj.jugadas,
          motivo: 'más soluciones de las permitidas: ' + sols.length, p,
        });
        continue;
      }

      // 2) ¿De verdad hacen falta esas jugadas, o hay un atajo más corto?
      const minJugadas = tipo === 'tablas' ? 1 : cfg.jugadas[0];
      let atajo = false;
      if (p.obj.jugadas > minJugadas) {
        try {
          const objCorto = { ...p.obj, jugadas: p.obj.jugadas - 1 };
          const solsCorto = probSolucionesIndep(board, p.turn, null, objCorto, p.base, topeIndep);
          if (solsCorto.length) atajo = true;
        } catch (e) {
          if (e !== PROB_ABORTO) throw e;
          // tope agotado en la comprobación de atajo: no se puede concluir
          // que NO haya uno más corto, pero tampoco es un fallo confirmado.
        }
      }
      if (atajo) {
        corto++;
        fallos.push({
          nivel, tipo, jugadas: p.obj.jugadas,
          motivo: 'se resuelve en ' + (p.obj.jugadas - 1) + ' jugada(s), menos de las declaradas', p,
        });
        continue;
      }
      ok++;
    }
    totalOk += ok; totalMal += mal; totalNoConcl += noConcl; totalCortos += corto;
    console.log(
      nivel.padEnd(10) + tipo.padEnd(9) +
      ('generados ' + generados).padEnd(14) +
      ('OK ' + ok).padEnd(8) +
      ('mal ' + mal).padEnd(9) +
      ('corto ' + corto).padEnd(11) +
      'sin concluir ' + noConcl);
  }
  console.log('');
}

if (fallos.length) {
  console.log('--- Detalle de lo que no pasó ---\\n');
  for (const f of fallos) {
    console.log(f.nivel + '/' + f.tipo + ' (' + f.jugadas + ' jugadas): ' + f.motivo);
  }
  console.log('');
}

console.log(
  'Total: ' + totalOk + ' OK, ' + totalMal + ' mal, ' + totalCortos +
  ' con atajo más corto, ' + totalNoConcl + ' sin concluir (tope agotado).');

if (totalMal > 0 || totalCortos > 0) process.exit(1);
`);
