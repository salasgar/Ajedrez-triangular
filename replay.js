// replay.js — Convierte partidas guardadas (autojuego de entrenamiento o
// torneos) en archivos .json cargables desde la propia web, para verlas
// jugada a jugada con los botones de deshacer/rehacer.
//
// Herramienta de desarrollo, se ejecuta a mano:
//   node replay.js partidas/partidas-2026-07-21.jsonl            → lista las partidas
//   node replay.js partidas/partidas-2026-07-21.jsonl 7          → convierte la nº 7
//   node replay.js partidas/partidas-2026-07-21.jsonl --todas    → convierte todas
//
// Los .jsonl guardan solo la lista de jugadas ('desde>hasta' por media
// jugada): ~3 KB por partida frente a los ~300 KB que ocuparían los
// snapshots de cada posición. Aquí se rejuegan sobre el motor real para
// regenerar el historial completo que espera saveload.js. El resultado pasa
// validateSave() tal cual: sobre versión 2, modo 'cc' (ordenador contra
// ordenador) e historial desde la posición inicial.
//
// Con --variant=ID se rejuega con otra modalidad; por defecto, la de Salas.
// Tiene que ser la MISMA con la que se generó el .jsonl, o las jugadas no
// serán legales al rejugarlas.
'use strict';
const fs = require('fs');
const path = require('path');

const [archivo, cual] = process.argv.slice(2);
if (!archivo) {
  console.error('Uso: node replay.js <archivo.jsonl> [nº | --todas]');
  process.exit(1);
}

const partidas = fs.readFileSync(archivo, 'utf8').trim().split('\n')
  .filter(Boolean).map(JSON.parse);

// sin selección: solo listar, que es lo que se quiere el 90% de las veces
if (!cual) {
  console.log(partidas.length + ' partidas en ' + archivo + ':\n');
  for (const p of partidas) {
    const id = p.n !== undefined ? p.n : p.par + '/blancas' + p.white;
    const desenlace = p.winner ? 'gana ' + (p.winner === 'w' ? 'blancas' : p.winner)
      : 'tablas';
    console.log('  ' + String(id).padStart(5) + '  ' + String(p.plies).padStart(3) +
      ' medias jugadas · ' + desenlace + ' (' + (p.status || p.res) + ')' +
      (p.usada === false ? ' · DESCARTADA del corpus' : ''));
  }
  console.log('\nPara convertir una: node replay.js ' + archivo + ' <nº>');
  process.exit(0);
}

// --- cargar el motor: geometry/rules/ai son scripts clásicos pensados para
// compartir ámbito global vía <script>, así que un solo eval los hace
// visibles al código de abajo, igual que hace tune-values.js ---
const dir = __dirname;
const gameSrc = ['geometry.js', 'variants.js', 'rules.js', 'ai.js']
  .map(f => fs.readFileSync(path.join(dir, f), 'utf8'))
  .join('\n');

// la modalidad con la que rejugar, antes que nada: fija el tablero
const argVariante = process.argv.find(a => a.startsWith('--variant='));
const VARIANTE = argVariante ? argVariante.slice('--variant='.length) : 'salas';

const driverSrc = `
if (!VARIANTS[${JSON.stringify(VARIANTE)}]) {
  console.error('Modalidad desconocida: ${VARIANTE}. Hay: ' + Object.keys(VARIANTS).join(', '));
  process.exit(1);
}
setVariant(${JSON.stringify(VARIANTE)});

const elegidas = ${JSON.stringify(cual)} === '--todas' ? partidas
  : partidas.filter(p => String(p.n !== undefined ? p.n : p.par) === ${JSON.stringify(cual)});

if (elegidas.length === 0) {
  console.error('No encuentro la partida ' + ${JSON.stringify(cual)} + ' en ' + archivo);
  process.exit(1);
}

const salida = path.join(path.dirname(archivo), 'replay');
fs.mkdirSync(salida, { recursive: true });

for (const p of elegidas) {
  newGame();
  for (const j of p.jugadas) {
    const [from, to] = j.split('>');
    makeMove(from, to);
  }
  const sobre = {
    version: 2,
    app: 'ajedrez-triangular',
    savedAt: new Date().toISOString(),
    variant: V.id,                               // con qué reglamento se jugó
    mode: 'cc',                                  // ordenador contra ordenador
    levelW: p.nivel !== undefined ? p.nivel : p.white,
    levelB: p.nivel !== undefined ? p.nivel : (p.white === 4 ? 8 : 4),
    history: game.history,
    histIndex: game.histIndex,
  };
  const id = p.n !== undefined ? p.n : p.par + '-blancas' + p.white;
  const nombre = path.join(salida, 'partida-' + id + '.json');
  fs.writeFileSync(nombre, JSON.stringify(sobre));
  console.log(nombre + '  ·  ' + p.jugadas.length + ' medias jugadas · ' +
    (fs.statSync(nombre).size / 1024).toFixed(0) + ' KB');
}
console.log('\\nCárgalas desde la web con «Cargar partida» y recórrelas con deshacer/rehacer.');
`;

eval(gameSrc + '\n' + driverSrc);
