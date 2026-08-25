// problemas-ui.js — La pestaña «Problemas»: pedir problemas, resolverlos sobre
// el tablero de siempre, guardarlos y compartirlos.
//
// El tablero, las piezas y la mecánica de mover son los de la partida normal:
// un problema se monta sobre `game` como cualquier otra posición y se juega
// con makeMove(). Lo que cambia es quién contesta y qué se considera acertar,
// y de eso se encarga este fichero apoyándose en el motor de problemas.js.
//
// Se carga DESPUÉS de script.js porque usa sus funciones y sus nodos (render,
// makeMove, cellPolys…). Al revés no valdría: script.js monta el tablero en su
// última línea y aquí hace falta que ya exista.

// --- el almacén ------------------------------------------------------------
//
// Generar un problema es caro y desigual: un mate en 2 con cuatro piezas sale
// a la primera y unas tablas forzadas pueden costar miles de tiradas. Hacer
// esperar al usuario a que salga la suya sería una pena, así que se van
// generando de antemano en un worker y se guardan en un almacén. Pulsar
// «Nuevo problema» saca uno hecho —instantáneo— y deja al worker reponiendo.
//
// El almacén sobrevive a recargar la página (localStorage), que es cuando más
// se nota: la primera visita a la pestaña ya tiene problemas esperando.

const PROB_ALMACEN_KEY = 'ajedrez-triangular:problemas-almacen';
const PROB_GUARDADO_PREFIX = 'ajedrez-triangular:problema:';
const PROB_ALMACEN_OBJETIVO = 4;    // problemas listos por modalidad y nivel
const PROB_ALMACEN_TOPE = 8;        // lo que se llega a guardar en disco
const PROB_MS_FONDO = 2500;         // presupuesto de una tirada en segundo plano
const PROB_MS_PETICION = 9000;      // ...y de una que el usuario está esperando

let probAlmacen = {};

function probAlmacenClave(nivel) { return V.id + '|' + nivel; }

function probAlmacenCarga() {
  try {
    const raw = localStorage.getItem(PROB_ALMACEN_KEY);
    const data = raw ? JSON.parse(raw) : null;
    probAlmacen = (data && typeof data === 'object') ? data : {};
  } catch {
    probAlmacen = {};
  }
  // Un almacén viejo puede traer problemas de una versión anterior del
  // formato, o de una modalidad que ya no existe: se filtran al cargar en vez
  // de reventar al montarlos.
  for (const clave of Object.keys(probAlmacen)) {
    const lista = Array.isArray(probAlmacen[clave]) ? probAlmacen[clave] : [];
    probAlmacen[clave] = lista.filter(probValida);
    if (!probAlmacen[clave].length) delete probAlmacen[clave];
  }
}

function probAlmacenGuarda() {
  try {
    const recorte = {};
    for (const [clave, lista] of Object.entries(probAlmacen)) {
      if (lista.length) recorte[clave] = lista.slice(0, PROB_ALMACEN_TOPE);
    }
    localStorage.setItem(PROB_ALMACEN_KEY, JSON.stringify(recorte));
  } catch {
    // cuota llena: el almacén sigue vivo en memoria, solo no se conserva
  }
}

// Saca del almacén un problema del nivel pedido y, si se pide uno concreto,
// del tipo pedido. Devuelve null si no hay ninguno que sirva.
function probAlmacenSaca(nivel, tipo) {
  const lista = probAlmacen[probAlmacenClave(nivel)];
  if (!lista || !lista.length) return null;
  const i = tipo === 'cualquiera' ? 0 : lista.findIndex(p => p.obj.tipo === tipo);
  if (i === -1) return null;
  const p = lista.splice(i, 1)[0];
  probAlmacenGuarda();
  return p;
}

function probAlmacenMete(p) {
  const clave = probAlmacenClave(p.dificultad);
  (probAlmacen[clave] = probAlmacen[clave] || []).push(p);
  probAlmacenGuarda();
}

function probAlmacenCuantos(nivel) {
  const lista = probAlmacen[probAlmacenClave(nivel)];
  return lista ? lista.length : 0;
}

// --- el worker que genera -------------------------------------------------
//
// Mismo truco que ai-async.js: el worker no se carga de un archivo, se
// construye a partir del código fuente de las funciones ya cargadas. Así
// también funciona abriendo index.html desde el disco (file://), donde el
// navegador no deja crear workers con URL de archivo. Si no se puede crear, se
// genera en el hilo principal, que congela la página un rato pero funciona.

const PROB_WORKER_FNS = [
  // rules.js
  positionKey, slideMoves, pseudoMoves, attacks, findKing, isAttacked, rival,
  legalMoves, sideHasMoves, castlingLanding, isCastling, castleMoves,
  // geometry.js / variants.js
  rowCells, backRow, dist,
  // ai.js — el camino rápido de generación de movimientos que usa probMovs:
  // sin estas, el worker revienta en la primera búsqueda y todo se genera en
  // el hilo principal, que es justo lo que el worker venía a evitar.
  PV, movesForSide, applyMoveSim,
  genMoves, isAttackedFast, scanPins, findPins, needsProbe, makeSim, unmakeSim,
  // problemas.js
  probCopia, probMovs, probAzar, probElige, probEntre, probBaraja,
  probMaterial, probSaldoQuieto, probHijos, probRepes, probVeredicto,
  probOrdenaOR, probOrdenaAND, probNodoOR, probNodoAND, probCtx,
  probSoluciones, probMaxSoluciones,
  probTiposPieza, probPesadas, probLigeras, probPasosACoronar,
  probCasillasPeon, probEscapes, probReparto, probCasillaAcorralada,
  probSitio, probPosicion, probGeneraUno, probGenera,
];
const PROB_WORKER_CONSTS = {
  MOVED_MATTERS, PROB_TIPOS, PROB_ABORTO, PROB_TOPE, PROB_MARGEN_CORONA,
  PROB_DESVENTAJA_TABLAS, PROB_NIVELES,
};

let probWorker = null;
let probWorkerVariante = null;   // con qué modalidad se construyó
let probWorkerRoto = false;
let probCola = [];               // peticiones esperando
let probEnCurso = null;          // {cb} de la que está atendiendo el worker

function probWorkerSource() {
  return [
    'let game = null;',
    'let CELL_MAP = null;',
    'let CELLS = null;',
    'let V = null;',
    'let N = 0;',
    ...Object.entries(PROB_WORKER_CONSTS)
      .map(([name, v]) => `const ${name} = ${JSON.stringify(v)};`),
    ...PROB_WORKER_FNS.map(f => f.toString()),
    'onmessage = (e) => {',
    '  if (e.data.cells) {',
    '    CELL_MAP = e.data.cells;',
    '    CELLS = [...CELL_MAP.values()];',
    '    V = e.data.variant;',
    '    N = e.data.boardSize;',
    '    return;',
    '  }',
    '  postMessage(probGenera(e.data.nivel, e.data.tipos, e.data.ms));',
    '};',
  ].join('\n');
}

function probArrancaWorker() {
  const url = URL.createObjectURL(
    new Blob([probWorkerSource()], { type: 'text/javascript' }));
  try {
    const w = new Worker(url);
    w.postMessage({ cells: CELL_MAP, variant: variantForWorker(), boardSize: N });
    w.onmessage = (e) => {
      const req = probEnCurso;
      probEnCurso = null;
      if (req) req.cb(e.data);
      probSirveCola();
    };
    w.onerror = (err) => {
      console.warn('Error en el worker de problemas; paso a generación síncrona.', err);
      probWorkerRoto = true;
      const req = probEnCurso;
      probEnCurso = null;
      if (probWorker) { probWorker.terminate(); probWorker = null; }
      if (req) req.cb(probGenera(req.nivel, req.tipos, req.ms));
      probSirveCola();
    };
    probWorkerVariante = V.id;
    return w;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// El worker se quedó con una copia del tablero del momento en que se creó, así
// que al cambiar de modalidad hay que tirarlo y volver a montarlo.
function probWorkerRevisa() {
  if (probWorker && probWorkerVariante !== V.id) {
    probWorker.terminate();
    probWorker = null;
    probEnCurso = null;
    probCola = [];
  }
}

function probSirveCola() {
  if (probEnCurso || !probCola.length) return;
  const req = probCola.shift();
  probWorkerRevisa();
  if (!probWorkerRoto && !probWorker) {
    try { probWorker = probArrancaWorker(); }
    catch (err) {
      console.warn('No se pudo crear el worker de problemas; generación síncrona.', err);
      probWorkerRoto = true;
    }
  }
  if (probWorkerRoto) {
    // Sin worker no queda otra que generar aquí, y eso congela la página. Se
    // hace en un timer para que al menos se pinte antes el «generando…».
    setTimeout(() => {
      req.cb(probGenera(req.nivel, req.tipos, req.ms));
      probSirveCola();
    }, 30);
    return;
  }
  probEnCurso = req;
  probWorker.postMessage({ nivel: req.nivel, tipos: req.tipos, ms: req.ms });
}

function probPide(nivel, tipos, ms, cb) {
  probCola.push({ nivel, tipos, ms, cb });
  probSirveCola();
}

// Repone el almacén del nivel que se está usando, de uno en uno y sin prisa.
// Solo se pide mientras la pestaña esté abierta: generar problemas para un
// nivel que nadie va a pedir es gastar batería a cambio de nada.
let probReponiendo = false;
function probRepon() {
  if (probReponiendo || !probEnPestana) return;
  const nivel = probNivelEl.value;
  if (probAlmacenCuantos(nivel) >= PROB_ALMACEN_OBJETIVO) return;
  // Se pide SOLO el tipo con menos ejemplares. Pidiendo «cualquiera», las
  // tablas —cien veces más baratas de generar que un mate— acababan copando
  // el almacén y «Problema nuevo» sacaba siempre lo mismo.
  const tipos = probTiposNivel(nivel);
  const lista = probAlmacen[probAlmacenClave(nivel)] || [];
  const cuenta = {};
  for (const t of tipos) cuenta[t] = 0;
  for (const p of lista) if (cuenta[p.obj.tipo] !== undefined) cuenta[p.obj.tipo]++;
  const escaso = tipos.reduce((a, b) => (cuenta[b] < cuenta[a] ? b : a));
  probReponiendo = true;
  probPide(nivel, [escaso], PROB_MS_FONDO, (p) => {
    probReponiendo = false;
    if (p) { probAlmacenMete(p); probPintaAlmacen(); }
    // Se encadena la siguiente en un timer para no acaparar el worker ni
    // impedir que una petición del usuario se cuele por delante.
    setTimeout(probRepon, 400);
  });
}

// --- nodos de la pestaña ---------------------------------------------------

const tabPartida = document.getElementById('tab-partida');
const tabProblemas = document.getElementById('tab-problemas');
const panelPartida = document.getElementById('panel');
const panelProblemas = document.getElementById('panel-problemas');
const probEnunciadoEl = document.getElementById('prob-enunciado');
const probSubEl = document.getElementById('prob-sub');
const probEstadoEl = document.getElementById('prob-estado');
const probProgresoEl = document.getElementById('prob-progreso');
const probLineaEl = document.getElementById('prob-linea');
const probAlmacenEl = document.getElementById('prob-almacen');
const probNivelEl = document.getElementById('prob-nivel');
const probTipoEl = document.getElementById('prob-tipo');
const probGuardadosEl = document.getElementById('prob-guardados');
const probBtnNuevo = document.getElementById('prob-nuevo');
const probBtnReinicia = document.getElementById('prob-reinicia');
const probBtnPista = document.getElementById('prob-pista');
const probBtnSolucion = document.getElementById('prob-solucion');
const probBtnGuardar = document.getElementById('prob-guardar');
const probBtnAbrir = document.getElementById('prob-abrir');
const probBtnBorrar = document.getElementById('prob-borrar');
const probBtnExportar = document.getElementById('prob-exportar');
const probBtnImportar = document.getElementById('prob-importar');
const probFileEl = document.getElementById('prob-file');

// --- estado de la pestaña --------------------------------------------------

let probEnPestana = false;      // ¿está abierta la pestaña «Problemas»?
let probActual = null;          // el problema montado sobre el tablero
let probFase = 'vacio';         // vacio | generando | resolviendo | resuelto | rendido
let probMensaje = '';
let probMensajeTono = '';       // '' | 'bien' | 'mal'
let probLineaViva = null;       // solución desde la posición actual (para la pista)
let probPistaKey = null;
let probTimer = null;           // reproducción de la solución o retirada de una fallida
let probPartidaGuardada = null; // la partida que había al entrar en la pestaña

// --- textos ----------------------------------------------------------------

const PROB_PIEZA_NOMBRE = {
  Q: 'dama', R: 'torre', B: 'alfil', N: 'caballo',
  E: 'elefante', U: 'unicornio', P: 'peón', K: 'rey',
};
// «una dama», «un caballo»: en español el artículo va con el género de la
// pieza, y torre y dama son las dos femeninas (igual que PIECE_FEM en
// script.js, que se usa para lo mismo en la lista de capturas).
const PROB_PIEZA_ART = { Q: 'una', R: 'una' };
function probArticulo(t) { return PROB_PIEZA_ART[t] || 'un'; }

function probJugadasTexto(n) { return n === 1 ? '1 jugada' : n + ' jugadas'; }

function probEnunciadoTexto(p) {
  const bando = p.turn === 'w' ? 'Las blancas' : 'Las negras';
  const jug = probJugadasTexto(p.obj.jugadas);
  switch (p.obj.tipo) {
    case 'mate':
      return `${bando} juegan y dan mate en ${jug}.`;
    case 'gana':
      return `${bando} juegan y capturan ${probArticulo(p.obj.pieza)} ` +
        `${PROB_PIEZA_NOMBRE[p.obj.pieza]} en ${jug}.`;
    case 'corona':
      return `${bando} juegan y coronan un peón en ${jug}.`;
    case 'tablas':
      return `${bando} juegan y consiguen tablas en ${jug}.`;
    default:
      return '';
  }
}

// La letra pequeña del enunciado: qué cuenta exactamente como resolverlo. Sin
// esto, «capturan un caballo» se presta a entregar la dama por el caballo, y
// «coronan un peón» a coronar para que se la coman en la jugada siguiente.
function probSubtexto(p) {
  switch (p.obj.tipo) {
    case 'gana':
      return 'Hay que ganarlo de verdad: no vale capturarlo y perder ' +
        'después más material del que se captura.';
    case 'corona':
      return 'La pieza coronada tiene que quedar en pie: no vale coronar ' +
        'para que la capturen a continuación.';
    case 'tablas':
      return 'Vale el ahogado, el jaque perpetuo y quedarse los dos reyes ' +
        'solos. El rival va ganando: cualquier otra cosa se pierde.';
    default:
      return 'Cualquier defensa del rival tiene que acabar en mate: ' +
        'no basta con que caiga en una trampa.';
  }
}

// --- montar y jugar un problema -------------------------------------------

function probPara() {
  if (probTimer) { clearInterval(probTimer); clearTimeout(probTimer); probTimer = null; }
}

// Deja el problema sobre el tablero de la partida, en su posición de partida.
function probMonta(p) {
  probPara();
  probActual = p;
  probFase = 'resolviendo';
  probMensaje = '';
  probMensajeTono = '';
  probPistaKey = null;
  probLineaViva = p.linea;

  if (V.id !== p.variant) applyVariant(p.variant, false);
  exitReview();
  cancelAi();
  // En un problema no juega el ordenador de la partida: la respuesta del rival
  // la elige el propio buscador de problemas (ver probJuzga), que es el único
  // que sabe qué defensa aguanta más.
  aiConfig.w = null;
  aiConfig.b = null;
  gamePaused = false;

  newGame();
  game.board = new Map(p.board.map(([k, pi]) => [k, { ...pi }]));
  game.turn = p.turn;
  game.capturedBy = { w: [], b: [] };
  game.lastMove = null;
  game.enPassant = null;
  game.clock = 0;
  game.winner = null;
  const rey = findKing(game.board, game.turn);
  game.status = rey && isAttacked(game.board, rey, rival(game.turn)) ? 'check' : 'playing';
  game.history = [snapshot()];
  game.histIndex = 0;

  clearSelection();
  // el que resuelve, siempre mirando desde su lado del tablero
  setFlip(p.turn === 'b');   // setFlip ya repinta
}

// Jugadas del que resuelve ya hechas. Se DEDUCE del historial en vez de
// llevar la cuenta aparte, para que deshacer y rehacer con la barra de botones
// no descoloque el problema.
function probJugadasHechas() {
  return Math.ceil(game.histIndex / 2);
}

function probQuedan() {
  return probActual ? probActual.obj.jugadas - probJugadasHechas() : 0;
}

// Lo que la búsqueda no puede deducir del tablero suelto.
function probContextoVivo() {
  const p = probActual;
  return {
    base: p.base,
    tocada: p.obj.tipo === 'gana' &&
      game.capturedBy[p.turn].some(x => x.type === p.obj.pieza),
    corono: !!(game.lastMove && game.lastMove.promo),
    victima: null,
    camino: game.history.slice(0, game.histIndex + 1).map(s => s.posKey),
  };
}

// ¿Estamos resolviendo un problema? Lo consulta script.js para saber si una
// jugada del usuario va a la partida o al problema.
function enModoProblema() {
  return probEnPestana && !!probActual;
}

// ¿Hay que ignorar los clics en el tablero? Mientras se busca un problema,
// mientras se reproduce la solución, mientras el rival contesta y cuando el
// problema ya está terminado.
function problemaBloquea() {
  if (!probEnPestana) return false;
  if (!probActual) return true;
  if (probFase !== 'resolviendo') return true;
  return game.turn !== probActual.turn;
}

// Deshace la jugada que se acaba de hacer y borra la rama muerta del
// historial, para que el botón de rehacer no ofrezca volver a un error.
function probRetira(mensaje) {
  probMensaje = mensaje;
  probMensajeTono = 'mal';
  probPinta();
  probTimer = setTimeout(() => {
    probTimer = null;
    undoMove();
    game.history = game.history.slice(0, game.histIndex + 1);
    clearSelection();
    probMensaje = 'Prueba otra vez.';
    probMensajeTono = '';
    render();
  }, 1400);
}

// Gancho de script.js: el usuario acaba de mover en un problema.
function problemaTrasJugada() {
  if (!enModoProblema()) return;
  probPistaKey = null;
  const p = probActual;
  const quedan = probQuedan();
  let r;
  try {
    r = probJuzga(game.board, rival(p.turn), game.enPassant,
      p.obj, quedan, probContextoVivo());
  } catch (e) {
    if (e !== PROB_ABORTO) throw e;
    // La comprobación se ha pasado del presupuesto. Antes que dar por buena
    // una jugada sin haberla verificado —y arrastrar el problema a una
    // posición sin solución—, se dice lo que pasa y se retira.
    probRetira('No he podido comprobar esa jugada a fondo.');
    return;
  }

  if (r.estado === 'exito') {
    probFase = 'resuelto';
    probMensaje = '¡Resuelto!';
    probMensajeTono = 'bien';
    probPinta();
    return;
  }
  if (r.estado === 'fallo') {
    // Se deja ver un momento la jugada equivocada sobre el tablero antes de
    // retirarla: verla puesta es lo que enseña por qué no vale.
    probRetira('Esa jugada no lleva a la solución.');
    return;
  }

  // La defensa que más aguanta, con un respiro para que se vea la jugada.
  probMensaje = '';
  probMensajeTono = '';
  probLineaViva = r.linea;
  probPinta();
  probTimer = setTimeout(() => {
    probTimer = null;
    makeMove(r.mov.from, r.mov.to);
    marcarParaAnimar();
    render();
    // Hay defensas que cumplen el objetivo ellas solas (quedarse ahogado en un
    // problema de tablas, por ejemplo): ahí ya no queda nada que jugar.
    if (r.quedan === 0) {
      probFase = 'resuelto';
      probMensaje = '¡Resuelto!';
      probMensajeTono = 'bien';
      probPinta();
    }
  }, 450);
}

// --- pintar el panel -------------------------------------------------------

function probPintaAlmacen() {
  if (!probAlmacenEl) return;
  const n = probAlmacenCuantos(probNivelEl.value);
  probAlmacenEl.textContent = n === 0
    ? 'Preparando problemas en segundo plano…'
    : (n === 1 ? '1 problema preparado.' : `${n} problemas preparados.`);
}

// La solución en notación, pintada solo cuando ya se ha visto o resuelto.
function probPintaLinea() {
  probLineaEl.innerHTML = '';
  if (!probActual || (probFase !== 'rendido' && probFase !== 'resuelto')) return;
  const p = probActual;
  const board = new Map(p.board.map(([k, pi]) => [k, { ...pi }]));
  let ep = null;
  const partes = [];
  for (let i = 0; i < p.linea.length; i++) {
    const m = p.linea[i];
    const pieza = board.get(m.from);
    if (!pieza) break;   // línea incoherente: mejor cortar que reventar
    const promo = pieza.type === 'P' && CELL_MAP.get(m.to).promoFor[pieza.color]
      ? 'Q' : undefined;
    partes.push({
      texto: moveText(board, m.from, m.to, false, { promo }),
      suya: pieza.color === p.turn,
    });
    ep = applyMoveSim(board, m.from, m.to, ep);
  }
  const titulo = document.createElement('div');
  titulo.className = 'prob-linea-tit';
  titulo.textContent = 'Solución';
  probLineaEl.appendChild(titulo);
  const fila = document.createElement('div');
  fila.className = 'prob-linea-movs';
  partes.forEach((parte, i) => {
    if (parte.suya) {
      const n = document.createElement('span');
      n.className = 'prob-linea-num';
      n.textContent = (Math.floor(i / 2) + 1) + '.';
      fila.appendChild(n);
    }
    const s = document.createElement('span');
    s.className = 'prob-linea-mov' + (parte.suya ? ' suya' : '');
    s.textContent = parte.texto;
    fila.appendChild(s);
  });
  probLineaEl.appendChild(fila);
  const nota = document.createElement('p');
  nota.className = 'prob-linea-nota';
  nota.textContent = 'Es una línea de muestra: el rival puede defenderse de ' +
    'otras maneras, pero todas acaban igual.';
  probLineaEl.appendChild(nota);
}

// Se llama al final de render(), así que se ejecuta con cada repintado del
// tablero: deshacer una jugada con la barra de botones actualiza el contador
// sin que haya que enterarse de nada.
function probPinta() {
  if (!probEnPestana) return;

  if (probFase === 'generando') {
    probEnunciadoEl.textContent = 'Buscando un problema…';
    probSubEl.textContent = 'Hay que comprobar que la solución es forzada ' +
      'contra cualquier defensa, y eso lleva un momento.';
    probEstadoEl.textContent = '';
    probProgresoEl.textContent = '';
    probLineaEl.innerHTML = '';
  } else if (!probActual) {
    probEnunciadoEl.textContent = 'No hay ningún problema cargado.';
    probSubEl.textContent = '';
    probEstadoEl.textContent = '';
    probProgresoEl.textContent = '';
    probLineaEl.innerHTML = '';
  } else {
    const p = probActual;
    probEnunciadoEl.textContent = probEnunciadoTexto(p);
    probSubEl.textContent = probSubtexto(p);
    probEstadoEl.textContent = probMensaje;
    probEstadoEl.className = 'prob-estado' + (probMensajeTono ? ' ' + probMensajeTono : '');
    const hechas = probJugadasHechas();
    if (probFase === 'resuelto') {
      probProgresoEl.textContent = `Resuelto en ${probJugadasTexto(hechas)}.`;
    } else if (probFase === 'rendido') {
      probProgresoEl.textContent = 'Solución a la vista.';
    } else {
      probProgresoEl.textContent =
        `Tu jugada ${Math.min(hechas + 1, p.obj.jugadas)} de ${p.obj.jugadas}.`;
    }
    probPintaLinea();
  }

  // La pista se marca sobre el tablero, y hay que reponerla en cada repintado
  // porque drawBoard() rehace las clases de todas las casillas.
  for (const poly of cellPolys.values()) poly.classList.remove('prob-pista');
  if (probPistaKey && cellPolys.has(probPistaKey)) {
    cellPolys.get(probPistaKey).classList.add('prob-pista');
  }

  const jugando = probFase === 'resolviendo' && !!probActual;
  probBtnPista.disabled = !jugando;
  probBtnSolucion.disabled = !probActual || probFase === 'rendido';
  probBtnReinicia.disabled = !probActual;
  probBtnGuardar.disabled = !probActual;
  probBtnNuevo.disabled = probFase === 'generando';
  probPintaAlmacen();
}

// --- acciones --------------------------------------------------------------

function probNuevo() {
  const nivel = probNivelEl.value;
  const tipo = probTipoEl.value;
  const guardado = probAlmacenSaca(nivel, tipo);
  if (guardado) {
    probMonta(guardado);
    probPinta();
    probRepon();
    return;
  }
  // No había ninguno a mano: se genera al momento y se avisa, porque puede
  // tardar unos segundos (sobre todo los de tablas, que son los más raros, y
  // Difícil/Experto, donde encontrar un problema cuesta de media 19-68 s
  // medido: usan su propio `msEspera` en vez de los 9 s por defecto).
  probFase = 'generando';
  probActual = null;
  probPara();
  probPinta();
  const tipos = tipo === 'cualquiera' ? probTiposNivel(nivel) : [tipo];
  const cfgNivel = PROB_NIVELES[nivel];
  const msPeticion = (cfgNivel && cfgNivel.msEspera) || PROB_MS_PETICION;
  probPide(nivel, tipos, msPeticion, (p) => {
    if (!probEnPestana) return;
    if (!p) {
      probFase = 'vacio';
      probMensaje = 'No ha salido ningún problema de ese tipo en este nivel. ' +
        'Prueba con otra dificultad o con otro tipo.';
      probMensajeTono = 'mal';
      probPinta();
      return;
    }
    probMonta(p);
    probPinta();
    probRepon();
  });
}

function probPista() {
  if (!probActual || probFase !== 'resolviendo') return;
  // La línea viva se recalcula si hace falta: el usuario puede haber deshecho
  // jugadas con la barra de botones y estar en otra posición.
  const p = probActual;
  const quedan = probQuedan();
  if (quedan <= 0) return;
  const obj = { ...p.obj, jugadas: quedan };
  let sols;
  try {
    sols = probSoluciones(game.board, game.turn, game.enPassant, obj,
      p.base, PROB_TOPE_VIVO);
  } catch (e) {
    if (e !== PROB_ABORTO) throw e;
    probMensaje = 'No he podido calcular la pista en esta posición.';
    probMensajeTono = 'mal';
    probPinta();
    return;
  }
  if (!sols.length) {
    probMensaje = 'Desde aquí ya no hay solución: reinicia el problema.';
    probMensajeTono = 'mal';
    probPinta();
    return;
  }
  probLineaViva = sols[0];
  probPistaKey = sols[0][0].from;
  probMensaje = 'Pista: mueve la pieza señalada.';
  probMensajeTono = '';
  probPinta();
}

function probVerSolucion() {
  if (!probActual) return;
  const p = probActual;
  probMonta(p);              // vuelve al principio, para verla entera
  probFase = 'rendido';
  probMensaje = '';
  probMensajeTono = '';
  probPinta();
  let i = 0;
  probTimer = setInterval(() => {
    if (i >= p.linea.length) {
      probPara();
      probPinta();
      return;
    }
    const m = p.linea[i++];
    makeMove(m.from, m.to);
    marcarParaAnimar();
    render();
  }, 900);
}

// --- problemas guardados ---------------------------------------------------

function probListaGuardados() {
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(PROB_GUARDADO_PREFIX)) continue;
    out.push(key.slice(PROB_GUARDADO_PREFIX.length));
  }
  return out.sort((a, b) => a.localeCompare(b, 'es'));
}

function probRefrescaGuardados(seleccionado) {
  probGuardadosEl.innerHTML = '';
  const vacio = document.createElement('option');
  vacio.value = '';
  vacio.textContent = '— ninguno —';
  probGuardadosEl.appendChild(vacio);
  for (const nombre of probListaGuardados()) {
    const o = document.createElement('option');
    o.value = nombre;
    o.textContent = nombre;
    probGuardadosEl.appendChild(o);
  }
  if (seleccionado) probGuardadosEl.value = seleccionado;
  const hay = !!probGuardadosEl.value;
  probBtnAbrir.disabled = probBtnBorrar.disabled = !hay;
}

function probGuarda() {
  if (!probActual) return;
  const sugerido = probEnunciadoTexto(probActual).replace(/\.$/, '');
  const nombre = (prompt('Nombre del problema:', sugerido) || '').trim();
  if (!nombre) return;
  if (localStorage.getItem(PROB_GUARDADO_PREFIX + nombre) !== null &&
      !confirm(`Ya existe un problema llamado «${nombre}». ¿Sobrescribirlo?`)) return;
  try {
    localStorage.setItem(PROB_GUARDADO_PREFIX + nombre, JSON.stringify(probActual));
    probRefrescaGuardados(nombre);
    probMensaje = 'Problema guardado.';
    probMensajeTono = 'bien';
  } catch {
    probMensaje = 'No se pudo guardar (almacenamiento lleno).';
    probMensajeTono = 'mal';
  }
  probPinta();
}

function probAbre() {
  const nombre = probGuardadosEl.value;
  if (!nombre) return;
  let p = null;
  try { p = JSON.parse(localStorage.getItem(PROB_GUARDADO_PREFIX + nombre)); }
  catch { p = null; }
  if (!probValida(p)) {
    probMensaje = 'Ese problema está dañado o es de una versión antigua.';
    probMensajeTono = 'mal';
    probPinta();
    return;
  }
  probMonta(p);
  probPinta();
}

// --- pestañas --------------------------------------------------------------

function probAbrePestana(cual) {
  const problemas = cual === 'problemas';
  if (problemas === probEnPestana) return;

  if (problemas) {
    // Se guarda la partida tal como estaba para devolverla al volver: el
    // problema va a pisar `game` entero.
    probPartidaGuardada = currentEnvelope();
    probEnPestana = true;
  } else {
    probEnPestana = false;
    probPara();
    probActual = null;
    probPistaKey = null;
    for (const poly of cellPolys.values()) poly.classList.remove('prob-pista');
  }

  tabPartida.classList.toggle('is-active', !problemas);
  tabProblemas.classList.toggle('is-active', problemas);
  tabPartida.setAttribute('aria-selected', String(!problemas));
  tabProblemas.setAttribute('aria-selected', String(problemas));
  panelPartida.hidden = problemas;
  panelProblemas.hidden = !problemas;
  document.body.classList.toggle('modo-problemas', problemas);

  if (problemas) {
    probRefrescaGuardados();
    if (!probActual) probNuevo();
    else { probMonta(probActual); probPinta(); }
    probRepon();
  } else if (probPartidaGuardada) {
    loadEnvelope(probPartidaGuardada);
    probPartidaGuardada = null;
  }
}

// --- enganches -------------------------------------------------------------

tabPartida.addEventListener('click', () => probAbrePestana('partida'));
tabProblemas.addEventListener('click', () => probAbrePestana('problemas'));

probBtnNuevo.addEventListener('click', probNuevo);
probBtnReinicia.addEventListener('click', () => {
  if (!probActual) return;
  probMonta(probActual);
  probPinta();
});
probBtnPista.addEventListener('click', probPista);
probBtnSolucion.addEventListener('click', probVerSolucion);
probBtnGuardar.addEventListener('click', probGuarda);
probBtnAbrir.addEventListener('click', probAbre);
probBtnBorrar.addEventListener('click', () => {
  const nombre = probGuardadosEl.value;
  if (!nombre || !confirm(`¿Borrar el problema «${nombre}»?`)) return;
  localStorage.removeItem(PROB_GUARDADO_PREFIX + nombre);
  probRefrescaGuardados();
});
probGuardadosEl.addEventListener('change', () => {
  const hay = !!probGuardadosEl.value;
  probBtnAbrir.disabled = probBtnBorrar.disabled = !hay;
});

probBtnExportar.addEventListener('click', () => {
  if (!probActual) return;
  const stamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-');
  downloadSave(probActual, `problema-${probActual.obj.tipo}-${stamp}.json`);
});
probBtnImportar.addEventListener('click', () => {
  probFileEl.value = '';
  probFileEl.click();
});
// Un .json importado no ha pasado por el bucle de menos-a-más jugadas del
// generador ni del creador manual —puede venir de otra build, o de una mano
// que lo editó—, así que aquí se comprueba también el FONDO (probValida solo
// mira la forma): que el enunciado sea cierto y no admita más soluciones de
// las que tocan. Es una comprobación cara, pero se hace una sola vez, sobre
// un solo problema, en una acción que el usuario ya sabe que puede tardar
// (igual que «Comprobar» en el editor).
function probValidaImportado(p) {
  return probValida(p) && probVerificaForzado(p);
}

probFileEl.addEventListener('change', () => {
  const file = probFileEl.files[0];
  if (!file) return;
  readSaveFile(file, (p) => { probMonta(p); probPinta(); },
    () => alert('El archivo no es un problema válido de Ajedrez Triangular: ' +
      'o está dañado, o el enunciado no se sostiene (no está forzado en esas ' +
      'jugadas, o tiene más soluciones de las que tocan).'),
    probValidaImportado);
});

// Deshabilita en el selector los tipos que el nivel no ofrece (hoy, tablas en
// Difícil y Experto). Si el tipo elegido deja de estar disponible, se vuelve a
// «cualquiera» en vez de dejar seleccionada una opción gris.
function probAjustaTipos() {
  const tipos = probTiposNivel(probNivelEl.value);
  for (const o of probTipoEl.options) {
    if (o.value === 'cualquiera') continue;
    o.disabled = !tipos.includes(o.value);
  }
  const sel = probTipoEl.selectedOptions[0];
  if (sel && sel.disabled) probTipoEl.value = 'cualquiera';
}

probNivelEl.addEventListener('change', () => {
  probAjustaTipos();
  probPintaAlmacen();
  probRepon();
});

// El almacén es por modalidad: al cambiarla, lo que había preparado ya no
// sirve para el tablero nuevo y hay que empezar a llenar el del sitio nuevo.
variantSelect.addEventListener('change', () => {
  probWorkerRevisa();
  if (probEnPestana) { probActual = null; probNuevo(); }
});

probAlmacenCarga();
probAjustaTipos();
probRefrescaGuardados();
