// cosecha-problemas.js — Cosechar problemas de partidas ordenador contra
// ordenador (tarea 14 del reparto).
//
// La idea, de Juan Luis: jugar partidas motor contra motor y, cuando en una
// posición real un bando puede forzar algo (mate, ganar una pieza, tablas
// salvadas), convertir esa posición en un problema. A diferencia del
// generador de problemas.js —que COLOCA piezas al azar hasta que sale algo
// forzado—, aquí el material siempre viene de una posición que de verdad se
// pudo dar en una partida.
//
// Cada posición candidata pasa por el MISMO verificador que ya usa el
// generador (probSoluciones) y, antes de guardarse, por el mismo camino que
// un .json importado desde fuera (probVerificaForzado, de la tarea 12): nada
// entra al almacén cosechado sin haber forzado el objetivo de verdad.
//
//   node entrenamiento/cosecha-problemas.js --modalidad=salas --partidas=20
//   node entrenamiento/cosecha-problemas.js --modalidad=trigonal --partidas=8 --max-plies=120
//
// Salida: entrenamiento/problemas-cosechados.json (o --salida=<nombre>,
// siempre dentro de entrenamiento/). Relanzable: vuelve a leer lo que ya
// haya, nunca quita nada, solo añade lo que no estuviera ya (por firma de
// tablero+objetivo).
'use strict';
const fs = require('fs');
const path = require('path');

function arg(nombre, defecto) {
  const pre = '--' + nombre + '=';
  const a = process.argv.find(x => x.startsWith(pre));
  return a ? a.slice(pre.length) : defecto;
}

const MODALIDAD = arg('modalidad', 'salas');
const PARTIDAS = Number(arg('partidas', 20));
const MAX_PLIES = Number(arg('max-plies', 160));
const OPENING_PLIES = Number(arg('opening-plies', 4));
// Presupuesto de la búsqueda de CRIBADO, por cada N probado (1..4 jugadas).
//
// Deliberadamente bajo, y no es un descuido: medido en la primera prueba
// (2026-08-25), con 150 000 el filtro barato de 'gana' (pieza a tiro) deja
// pasar CASI CUALQUIER jugada de desarrollo normal —una pieza "a tiro" no es
// una pieza sin defender, solo atacada— y cada intento que NO está forzado
// agota el presupuesto entero antes de rendirse (probNodoOR/AND no paran
// hasta el tope). Con 4 N por candidato y varias piezas "a tiro" por jugada,
// una sola partida de 100 jugadas tardó más de 100 minutos y no llegó a la
// segunda. Bajar el tope no cambia lo que se ACEPTA —un candidato que
// sobrevive el cribado se reverifica al final con PROB_TOPE_VIVO, el mismo
// presupuesto que un .json importado (ver más abajo)—, solo cuánto se
// insiste antes de descartar uno que no está forzado: el coste que importa
// aquí es el de las búsquedas que fallan, no el de las poquísimas que
// aciertan.
const TOPE_BUSQUEDA = Number(arg('tope', 6000));
const SEED = Number(arg('seed', Date.now() >>> 0));
const SALIDA = path.join(__dirname, arg('salida', 'problemas-cosechados.json'));
// Niveles de AI_LEVELS entre los que se sortea, uno por partida, para variar
// la fuerza de juego (partidas de un solo nivel dan siempre el mismo tipo de
// error táctico). 4-6 son "nodes" razonables sin disparar el tiempo por
// partida (ver AI_LEVELS en ai.js).
const NIVELES_JUEGO = [4, 5, 6];
// Ventana (en plies) dentro de la que dos candidatos del mismo tipo, pieza y
// color de resolutor se consideran la MISMA racha (la jugada 30 y la 31 de
// una partida suelen ser el mismo tema con una jugada menos): se guarda solo
// la de N mayor. Ver trampas conocidas en tareas/tarea-14-cosecha-de-partidas.md.
const VENTANA_RACHA = 6;
const MAX_JUGADAS = 4;   // tope global de PROB_NIVELES (experto llega a 4)
// Presupuesto de RELOJ (no de nodos) por jugada de partida cribada.
//
// TOPE_BUSQUEDA cuenta jugadas examinadas, pero una sola de esas jugadas
// puede disparar `probSaldoQuieto` (quiescencia recursiva hasta profundidad
// 8, en problemas.js, SIN contar contra el tope de nodos): medido el
// 2026-08-25, un solo intento con tope=6000 tardó 74 s en una posición con
// muchas capturas posibles. Bajar TOPE_BUSQUEDA reduce cuántas veces pasa,
// no cuánto tarda cada vez. Este reloj es la red de seguridad: en cuanto se
// agota, candidatosEn() deja de abrir intentos NUEVOS para esa jugada de
// partida (el que ya está en marcha no se puede interrumpir a media
// búsqueda, así que el peor caso real es presupuesto + una búsqueda suelta).
const MS_POR_JUGADA = Number(arg('ms-por-jugada', 3000));

const raiz = path.join(__dirname, '..');
const src = ['geometry.js', 'variants.js', 'rules.js', 'ai.js', 'problemas.js']
  .map(f => fs.readFileSync(path.join(raiz, f), 'utf8')).join('\n');

// --- almacén cosechado en disco ---------------------------------------------

function cargaAlmacen() {
  if (!fs.existsSync(SALIDA)) return {};
  try {
    const data = JSON.parse(fs.readFileSync(SALIDA, 'utf8'));
    return (data && typeof data === 'object') ? data : {};
  } catch {
    process.stderr.write('AVISO: ' + SALIDA + ' no se pudo leer como JSON; se ' +
      'trata como vacío (el fichero original no se toca hasta el primer guardado).\n');
    return {};
  }
}

function guardaAlmacen(almacen) {
  fs.writeFileSync(SALIDA, JSON.stringify(almacen, null, 1) + '\n');
}

// Firma de un problema para deduplicar entre ejecuciones: tablero + turno +
// objetivo. No entra `creado` ni `origen`, que cambian siempre.
function firma(p) {
  const tablero = [...p.board].map(([k, pieza]) => k + ':' + pieza.color + pieza.type)
    .sort().join(',');
  return p.turn + '|' + p.obj.tipo + '|' + (p.obj.pieza || '') + '|' +
    p.obj.jugadas + '|' + tablero;
}

const almacen = cargaAlmacen();
const firmasVistas = new Set();
for (const lista of Object.values(almacen)) {
  for (const p of lista) firmasVistas.add(firma(p));
}
const totalPrevio = firmasVistas.size;

// --- motor: geometry+variants+rules+ai+problemas, en un único eval ---------
//
// Mismo truco que arena.js y prueba-problemas.js: los scripts del motor son
// de ámbito global (sin módulos), así que se concatenan y se evalúan juntos
// con el código de cosecha para compartir ámbito sin tocar ninguno de ellos.

const driverSrc = `
'use strict';
let _s = ${SEED} >>> 0;
Math.random = function () {
  _s = (_s + 0x6D2B79F5) >>> 0;
  let t = _s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

if (!VARIANTS[${JSON.stringify(MODALIDAD)}]) {
  process.stderr.write('modalidad desconocida: ${MODALIDAD}. Hay: ' +
    Object.keys(VARIANTS).join(', ') + '\\n');
  process.exit(1);
}
setVariant(${JSON.stringify(MODALIDAD)});

// Dificultad que le corresponde a un hallazgo de N jugadas. Las tablas
// forzadas casi nunca pasan de 1 jugada (comprobado en problemas.js: el
// ahogado/perpetuo forzado no sale en decenas de miles de tiradas), así que
// van siempre a 'facil'. Para mate/gana, N=2 se asigna a 'medio' en vez de a
// 'facil' —aunque 'facil' también admite N=2— para no vaciar 'medio', que
// solo acepta exactamente 2: es una decisión de reparto, no del motor.
function dificultadPara(tipo, jugadas) {
  if (tipo === 'tablas') return 'facil';
  if (jugadas <= 1) return 'facil';
  if (jugadas === 2) return 'medio';
  if (jugadas === 3) return 'dificil';
  return 'experto';
}

// Busca el N mínimo (1..MAX_JUGADAS) para el que 'tipo' (con 'pieza' si hace
// falta) está forzado desde (board,turn,base). Mismo bucle de menos a más que
// probGeneraUno: la primera N que da solución es, por construcción, la
// mínima. Devuelve {jugadas, linea, soluciones} o null.
function cosechaBusca(board, turn, base, tipo, pieza, limite) {
  const obj = { tipo, pieza: pieza || null, jugadas: 0 };
  try {
    for (let n = 1; n <= MAX_JUGADAS; n++) {
      if (Date.now() > limite) return null;   // reloj agotado: ver MS_POR_JUGADA
      obj.jugadas = n;
      const sols = probSoluciones(board, turn, null, obj, base, TOPE_BUSQUEDA);
      if (!sols.length) continue;
      if (sols.length > probMaxSoluciones(tipo, n)) return null;   // no único: descartar
      return { jugadas: n, linea: sols[0], soluciones: sols.length };
    }
  } catch (e) {
    if (e === PROB_ABORTO) return null;
    throw e;
  }
  return null;
}

// Piezas del bando 'def' que 'sol' ataca AHORA MISMO y que 'def' no defiende
// (ninguna pieza suya cubre esa casilla): piezas colgadas de verdad, no solo
// "a tiro". Filtro barato para 'gana'.
//
// El filtro de probPosicion ("a tiro", sin mirar si hay defensor) vale para
// generar porque ahí las posiciones YA se construyen con la pieza objetivo
// aislada; en una posición real de partida casi cualquier pieza desarrollada
// está "a tiro" de algo sin que eso signifique nada (medido: agotaba el
// presupuesto de cribado en casi cada jugada, ver TOPE_BUSQUEDA). Exigir que
// además esté SIN DEFENDER dispara la búsqueda cara solo ante blunders de
// verdad, a costa de no cosechar los "gana en N" que empiezan con la pieza
// todavía defendida y se destapan a base de jaques o desviaciones —esos
// quedan para una versión futura con un filtro más fino.
function piezasColgadas(board, def, sol) {
  const tipos = new Set();
  for (const [key, p] of board) {
    if (p.color !== def || p.type === 'K') continue;
    const cell = CELL_MAP.get(key);
    if (isAttackedFast(board, cell, sol) && !isAttackedFast(board, cell, def)) {
      tipos.add(p.type);
    }
  }
  return [...tipos];
}

// Candidatos encontrados en una posición real (board, turn=quien mueve=el
// que resolvería, ep). Aplica los mismos filtros baratos que probPosicion
// usa para ACEPTAR una posición generada, antes de pagar la búsqueda
// completa Y/O (cara). Devuelve una lista de {tipo, pieza, jugadas, linea,
// soluciones}.
function candidatosEn(board, turn, ep) {
  // El formato de problema guardado no lleva 'ep' (el generador nunca lo
  // necesita: sus posiciones nacen con todas las piezas 'moved'). Si la
  // posición real tiene una captura al paso disponible, guardarla sin ese
  // dato la haría reverificable distinta a como se jugó de verdad, así que
  // se descarta entera (trampa conocida, ver tarea 14).
  if (ep) return [];
  const def = rival(turn);
  const base = probMaterial(board, turn);
  const out = [];
  const limite = Date.now() + MS_POR_JUGADA;   // ver MS_POR_JUGADA

  if (probEscapes(board, def) <= 4) {
    const r = cosechaBusca(board, turn, base, 'mate', null, limite);
    if (r) out.push({ tipo: 'mate', pieza: null, ...r });
  }
  for (const pieza of piezasColgadas(board, def, turn)) {
    if (Date.now() > limite) break;
    if (base >= (PV()[pieza] || 0)) continue;   // ya se gana sola: sin mérito
    const r = cosechaBusca(board, turn, base, 'gana', pieza, limite);
    if (r) out.push({ tipo: 'gana', pieza, ...r });
  }
  if (Date.now() < limite && base <= -PROB_DESVENTAJA_TABLAS) {
    const r = cosechaBusca(board, turn, base, 'tablas', null, limite);
    if (r) out.push({ tipo: 'tablas', pieza: null, ...r });
  }
  return out;
}

function tableroPlano(board) {
  return [...board].map(([k, p]) => [k, { ...p }]);
}

// --- juego de partidas -------------------------------------------------------

function aperturaAlAzar() {
  for (let intento = 0; intento < 100; intento++) {
    newGame();
    let ok = true;
    for (let i = 0; i < ${OPENING_PLIES}; i++) {
      const ms = movesForSide(game.board, game.turn, game.enPassant);
      if (ms.length === 0) { ok = false; break; }
      const m = ms[Math.floor(Math.random() * ms.length)];
      makeMove(m.from, m.to);
    }
    if (ok && !gameEnded()) return true;
  }
  return false;
}

const candidatosGlobales = [];   // {ply, tipo, pieza, turn, p:<problema>}
const rachas = new Map();        // clave -> {ply, jugadas, candidato}

function claveRacha(tipo, pieza, turn) { return tipo + '|' + (pieza || '') + '|' + turn; }

function volcarRacha(entrada) { candidatosGlobales.push(entrada.candidato.p); }

function considerarCandidato(ply, tipo, pieza, turn, candidato) {
  const clave = claveRacha(tipo, pieza, turn);
  const prev = rachas.get(clave);
  if (prev && ply - prev.ply <= VENTANA_RACHA) {
    if (candidato.p.obj.jugadas > prev.jugadas) rachas.set(clave, { ply, jugadas: candidato.p.obj.jugadas, candidato });
    return;
  }
  if (prev) volcarRacha(prev);
  rachas.set(clave, { ply, jugadas: candidato.p.obj.jugadas, candidato });
}

function jugarPartida(numPartida) {
  if (!aperturaAlAzar()) return { plies: 0, candidatos: 0 };
  const nivel = NIVELES_JUEGO[Math.floor(Math.random() * NIVELES_JUEGO.length)];
  let plies = 0, candidatos = 0;
  while (!gameEnded() && plies < ${MAX_PLIES}) {
    const turn = game.turn;
    for (const c of candidatosEn(game.board, turn, game.enPassant)) {
      const p = {
        version: 1,
        app: 'ajedrez-triangular-problema',
        variant: V.id,
        board: tableroPlano(game.board),
        turn,
        base: probMaterial(game.board, turn),
        obj: { tipo: c.tipo, pieza: c.pieza, jugadas: c.jugadas },
        linea: c.linea,
        soluciones: c.soluciones,
        dificultad: dificultadPara(c.tipo, c.jugadas),
        creado: new Date().toISOString(),
        origen: { cosecha: true, partida: numPartida, ply: plies, nivelJuego: nivel },
      };
      considerarCandidato(plies, c.tipo, c.pieza, turn, { p });
      candidatos++;
    }
    const mv = chooseAiMove(nivel);
    if (!mv) break;
    makeMove(mv.from, mv.to);
    plies++;
  }
  // cierra las rachas que sigan abiertas al acabar la partida
  for (const clave of [...rachas.keys()]) { volcarRacha(rachas.get(clave)); rachas.delete(clave); }
  return { plies, candidatos };
}

const resultado = { partidasJugadas: 0, pliesTotales: 0, candidatosBrutos: 0 };
for (let i = 1; i <= ${PARTIDAS}; i++) {
  const r = jugarPartida(i);
  resultado.partidasJugadas++;
  resultado.pliesTotales += r.plies;
  resultado.candidatosBrutos += r.candidatos;
  process.stderr.write('partida ' + i + '/' + ${PARTIDAS} + ': ' + r.plies +
    ' plies, ' + r.candidatos + ' candidatos brutos, ' + candidatosGlobales.length +
    ' tras deduplicar rachas hasta ahora\\n');
}

// --- verificación completa antes de guardar (mismo camino que un .json
// importado, tarea 12: probVerificaForzado con el presupuesto completo) -----
//
// Todo esto va DENTRO del mismo eval que jugó las partidas (y no en un
// segundo eval ni en el ámbito de fuera) para no depender de que las
// funciones del motor "se escapen" del eval hacia el resto del script: con
// 'use strict' en el eval —lo lleva este bloque— no lo hacen, y un segundo
// eval por separado se quedaría sin verlas. 'almacen', 'firmasVistas',
// 'firma' y 'guardaAlmacen' sí se ven desde aquí dentro: son de fuera, y leer
// hacia fuera del eval funciona siempre, solo declarar hacia fuera no.

let nuevos = 0, rechazadosVerificacion = 0, duplicados = 0;
for (const p of candidatosGlobales) {
  const f = firma(p);
  if (firmasVistas.has(f)) { duplicados++; continue; }
  if (!probVerificaForzado(p, PROB_TOPE_VIVO)) { rechazadosVerificacion++; continue; }
  firmasVistas.add(f);
  const clave = p.variant + '|' + p.dificultad;
  (almacen[clave] = almacen[clave] || []).push(p);
  nuevos++;
}

guardaAlmacen(almacen);

const reparto = {};
for (const [clave, lista] of Object.entries(almacen)) reparto[clave] = lista.length;

process.stderr.write('\\n--- resumen ---\\n');
process.stderr.write('partidas jugadas: ' + resultado.partidasJugadas +
  ' (' + resultado.pliesTotales + ' plies)\\n');
process.stderr.write('candidatos brutos (antes de deduplicar rachas): ' +
  resultado.candidatosBrutos + '\\n');
process.stderr.write('candidatos tras deduplicar rachas: ' + candidatosGlobales.length + '\\n');
process.stderr.write('nuevos en el almacén: ' + nuevos + '\\n');
process.stderr.write('duplicados (ya en el almacén de una tanda anterior): ' + duplicados + '\\n');
process.stderr.write('rechazados en la reverificación completa: ' + rechazadosVerificacion + '\\n');
process.stderr.write('almacén total antes de esta tanda: ' + totalPrevio + '\\n');
process.stderr.write('almacén total ahora: ' + firmasVistas.size + '\\n');
process.stderr.write('reparto por variante|nivel: ' + JSON.stringify(reparto, null, 1) + '\\n');
process.stderr.write('fichero: ' + SALIDA + '\\n');
`;

process.stderr.write('cosecha[' + MODALIDAD + ']: ' + PARTIDAS + ' partidas, seed ' +
  SEED + ', tope de búsqueda ' + TOPE_BUSQUEDA + '\n');
eval(src + '\n' + driverSrc);
