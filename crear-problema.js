// crear-problema.js — Convertir la posición del editor en un problema.
//
// El editor sabe colocar piezas; lo que no sabe es si de esa posición sale un
// problema. «Las blancas dan mate en 3» no es una opinión: o existe una jugada
// que gana contra CUALQUIER defensa en exactamente tres jugadas, o el enunciado
// es falso. Así que aquí no se le pide al usuario que declare la solución, se
// le pide el objetivo y se comprueba con el mismo buscador Y/O que genera los
// problemas automáticos (probSoluciones, en problemas.js). Si sale, el problema
// nace ya verificado y con su línea principal dentro; si no sale, se dice por
// qué en vez de guardar un enunciado que no se sostiene.
//
// El archivo se monta solo: busca los nodos del editor y, si están, se cuelga
// de ellos. Así el editor no tiene que saber que esto existe —basta con añadir
// su <script>— y en cualquier otra página no hace nada.
//
// Depende de geometry.js, variants.js, rules.js, ai.js, problemas.js y
// problema-imagen.js, y de los globales `board` y `turn` de editor.js.

// Presupuesto de nodos para comprobar una posición hecha a mano. Es mucho más
// alto que el del generador automático (PROB_TOPE, 60 000): allí una posición
// cara se tira y se sortea otra, aquí la posición es la que el usuario ha
// dibujado y hay que darle una respuesta. Aun así hay tope, porque un mate en 5
// con veinte piezas no termina nunca y más vale decirlo que colgar la pestaña.
// Del orden de unos segundos de espera en el peor caso, con la pestaña parada:
// la búsqueda es síncrona, como la de la partida en curso (PROB_TOPE_VIVO).
const PROB_CREA_TOPE = 1200000;

// Tope de jugadas del enunciado. Por encima de 5 la comprobación deja de ser
// viable en el navegador con casi cualquier cantidad de material.
const PROB_CREA_MAX_JUGADAS = 5;

// Misma clave que usa la pestaña «Problemas» del juego (PROB_GUARDADO_PREFIX en
// problemas-ui.js): un problema creado aquí aparece allí en la lista de
// guardados sin más trámite. Se repite el literal en vez de compartir la
// constante porque el editor no carga problemas-ui.js.
const PROB_CREA_PREFIJO = 'ajedrez-triangular:problema:';

const PROB_CREA_TIPOS = [
  ['mate', 'Dar mate'],
  ['gana', 'Ganar una pieza'],
  ['corona', 'Coronar un peón'],
  ['tablas', 'Conseguir tablas'],
];

const PROB_CREA_NOMBRE_PIEZA = {
  Q: 'Dama', R: 'Torre', B: 'Alfil', N: 'Caballo',
  E: 'Elefante', U: 'Unicornio',
};

// Estilos propios. Van en un <style> inyectado y no en style.css para que este
// archivo se pueda añadir y quitar de una pieza; las reglas se limitan a
// #problema-box y reutilizan el aspecto de los cajones que ya hay en el panel.
const PROB_CREA_CSS = `
#problema-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 0.85rem;
  color: #bbb;
}
#problema-box > label { font-weight: 600; color: #ddd; }
#problema-box select,
#problema-box input[type="number"] {
  background: #1c1c1c;
  color: #eee;
  border: 1px solid #4a4a4a;
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 0.9rem;
  width: 100%;
  margin-top: 2px;
}
#problema-box .prob-crea-campo.oculto { display: none; }
#problema-box .prob-crea-comprobar {
  background: #2a4a6a;
  border-color: #4a7ab0;
  color: #eee;
  font-weight: bold;
}
#problema-box .prob-crea-comprobar:hover:not(:disabled) { background: #35608a; }
#prob-crea-estado {
  font-size: 0.82rem;
  line-height: 1.4;
  min-height: 1.2em;
  color: #9a9a9a;
}
#prob-crea-estado.bien { color: #6dd76d; }
#prob-crea-estado.mal { color: #ff6b6b; }
#prob-crea-estado.aviso { color: #e0c060; }
`;

// --- estado ----------------------------------------------------------------

// El último problema comprobado con éxito, o null. Guardar y exportar trabajan
// SOBRE ESTE OBJETO y no sobre lo que haya en el tablero ahora mismo: si el
// usuario mueve una pieza después de comprobar, el problema deja de valer y lo
// que se hace es olvidarlo (probCreaCaduca), no exportar algo sin verificar.
let probCreaActual = null;

let probCreaTipoEl = null;
let probCreaPiezaEl = null;
let probCreaPiezaCampo = null;
let probCreaJugadasEl = null;
let probCreaBtnComprueba = null;
let probCreaEstadoEl = null;
let probCreaBtnGuardar = null;
let probCreaBtnJson = null;
let probCreaBtnPng = null;

// --- textos ----------------------------------------------------------------

function probCreaDi(texto, tono = '') {
  if (!probCreaEstadoEl) return;
  probCreaEstadoEl.textContent = texto;
  probCreaEstadoEl.className = tono;
}

function probCreaJugadasTexto(n) { return n === 1 ? '1 jugada' : n + ' jugadas'; }

// --- lectura de la posición del editor -------------------------------------

// El tablero del editor pasado a lo que espera el motor. Todas las piezas nacen
// con `moved: true`, igual que en los problemas generados: en un problema no hay
// enroque ni avance doble de peón, y con ellos entrarían la captura al paso y un
// puñado de casos raros que no aportan nada al ejercicio.
function probCreaPosicion() {
  const b = new Map();
  for (const [key, p] of board) b.set(key, { type: p.type, color: p.color, moved: true });
  return b;
}

// Comprueba lo que tiene que cumplir cualquier posición antes de buscar nada.
// Devuelve un mensaje de error, o null si la posición es utilizable.
function probCreaPega(b, obj) {
  const reyes = { w: 0, b: 0 };
  for (const p of b.values()) if (p.type === 'K') reyes[p.color]++;
  if (reyes.w !== 1 || reyes.b !== 1) {
    return 'Hace falta exactamente un rey blanco y un rey negro.';
  }

  const def = rival(turn);
  const reyRival = findKing(b, def);
  if (isAttacked(b, reyRival, turn)) {
    return 'El bando que NO mueve está en jaque: esa posición no puede darse ' +
      'en una partida. Cambia el turno o quita el jaque.';
  }
  if (movesForSide(b, turn, null).length === 0) {
    return 'El bando que mueve no tiene ninguna jugada legal: ya es mate o ahogado.';
  }

  if (obj.tipo === 'gana') {
    const hay = [...b.values()].some(p => p.color === def && p.type === obj.pieza);
    if (!hay) {
      return `El rival no tiene ${(PROB_CREA_NOMBRE_PIEZA[obj.pieza] || obj.pieza).toLowerCase()}: ` +
        'no hay nada que capturar.';
    }
  }
  if (obj.tipo === 'corona') {
    const hay = [...b.values()].some(p => p.color === turn && p.type === 'P');
    if (!hay) return 'El bando que mueve no tiene peones: no puede coronar.';
  }
  return null;
}

// --- comprobación ----------------------------------------------------------

// Busca la solución de menos a más jugadas y se queda con la PRIMERA
// profundidad que funciona. Que sea la primera es lo que hace exacto el
// enunciado: si el mate está en dos, «mate en tres» sería mentira aunque
// también se pueda dar en tres alargando.
function probCreaBusca(b, obj, base, tope) {
  for (let n = 1; n <= obj.jugadas; n++) {
    const sols = probSoluciones(b, turn, null, { ...obj, jugadas: n }, base, tope);
    if (sols.length) return { jugadas: n, sols };
  }
  return null;
}

function probCreaComprueba() {
  const tipo = probCreaTipoEl.value;
  const pedidas = Number(probCreaJugadasEl.value);
  if (!Number.isInteger(pedidas) || pedidas < 1 || pedidas > PROB_CREA_MAX_JUGADAS) {
    probCreaDi(`El número de jugadas tiene que estar entre 1 y ${PROB_CREA_MAX_JUGADAS}.`, 'mal');
    return;
  }
  const obj = {
    tipo,
    pieza: tipo === 'gana' ? probCreaPiezaEl.value : null,
    jugadas: pedidas,
  };

  const b = probCreaPosicion();
  const pega = probCreaPega(b, obj);
  if (pega) { probCreaCaduca(); probCreaDi(pega, 'mal'); return; }

  probCreaCaduca();
  probCreaDi('Comprobando…');
  probCreaBtnComprueba.disabled = true;
  // La búsqueda es síncrona y puede tardar unos segundos: se cede un instante
  // al navegador para que llegue a pintar el «Comprobando…» antes de bloquearse.
  setTimeout(() => {
    try {
      probCreaRemata(b, obj, pedidas);
    } finally {
      probCreaBtnComprueba.disabled = false;
    }
  }, 30);
}

function probCreaRemata(b, obj, pedidas) {
  const base = probMaterial(b, turn);
  let hallado = null;
  try {
    hallado = probCreaBusca(b, obj, base, PROB_CREA_TOPE);
  } catch (e) {
    if (e !== PROB_ABORTO) throw e;
    probCreaDi('La posición es demasiado complicada para comprobarla aquí: ' +
      'quita material o pide menos jugadas.', 'mal');
    return;
  }

  if (!hallado) {
    probCreaDi(`No hay forma de conseguirlo por la fuerza en ${probCreaJugadasTexto(pedidas)} ` +
      'contra la mejor defensa. Prueba con más jugadas, con otro objetivo o ' +
      'retoca la posición.', 'mal');
    return;
  }

  const { jugadas, sols } = hallado;
  probCreaActual = {
    version: 1,
    app: 'ajedrez-triangular-problema',
    variant: V.id,
    board: [...b].map(([k, p]) => [k, { ...p }]),
    turn,
    base,
    obj: { ...obj, jugadas },
    linea: sols[0],
    soluciones: sols.length,
    dificultad: probCreaBanda(jugadas),
    creado: new Date().toISOString(),
  };
  probCreaHabilita(true);

  // Que salga en menos jugadas de las pedidas no es un fallo: es un problema
  // distinto del que se creía, y el enunciado se corrige solo para que diga la
  // verdad. Lo mismo con las soluciones múltiples, que no invalidan nada pero
  // conviene saberlas: un problema con tres soluciones se acierta sin pensar.
  const partes = [];
  if (jugadas < pedidas) {
    probCreaJugadasEl.value = String(jugadas);
    partes.push(`Se resuelve en ${probCreaJugadasTexto(jugadas)}, no en ` +
      `${probCreaJugadasTexto(pedidas)}: el enunciado queda ajustado a ${jugadas}.`);
  } else {
    partes.push(`Comprobado: ${probImgEnunciado(probCreaActual).toLowerCase()}`);
  }
  if (sols.length > 1) {
    partes.push(`Ojo: hay ${sols.length} primeras jugadas que valen.`);
  }
  probCreaDi(partes.join(' '), sols.length > 1 || jugadas < pedidas ? 'aviso' : 'bien');
}

// La banda de dificultad que le corresponde por número de jugadas, con los
// mismos nombres que PROB_NIVELES para que el problema encaje en la pestaña del
// juego igual que uno generado.
function probCreaBanda(jugadas) {
  if (jugadas <= 1) return 'facil';
  if (jugadas === 2) return 'medio';
  if (jugadas === 3) return 'dificil';
  return 'experto';
}

// --- guardar y exportar ----------------------------------------------------

function probCreaHabilita(hay) {
  probCreaBtnGuardar.disabled = !hay;
  probCreaBtnJson.disabled = !hay;
  probCreaBtnPng.disabled = !hay;
}

// El problema comprobado deja de valer en cuanto cambia lo que se comprobó.
function probCreaCaduca() {
  probCreaActual = null;
  probCreaHabilita(false);
}

function probCreaGuarda() {
  if (!probCreaActual) return;
  const sugerido = probImgEnunciado(probCreaActual).replace(/\.$/, '');
  const nombre = (prompt('Nombre del problema:', sugerido) || '').trim();
  if (!nombre) return;
  if (localStorage.getItem(PROB_CREA_PREFIJO + nombre) !== null &&
      !confirm(`Ya existe un problema llamado «${nombre}». ¿Sobrescribirlo?`)) return;
  try {
    localStorage.setItem(PROB_CREA_PREFIJO + nombre, JSON.stringify(probCreaActual));
  } catch {
    probCreaDi('No se pudo guardar (almacenamiento lleno).', 'mal');
    return;
  }
  probCreaDi(`Guardado como «${nombre}». Aparecerá en la pestaña Problemas del juego.`, 'bien');
}

function probCreaDescarga(blob, archivo) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = archivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function probCreaJson() {
  if (!probCreaActual) return;
  const blob = new Blob([JSON.stringify(probCreaActual, null, 2)],
    { type: 'application/json' });
  probCreaDescarga(blob, probImagenNombre(probCreaActual).replace(/\.png$/, '.json'));
  probCreaDi('Problema exportado en .json.', 'bien');
}

function probCreaPng() {
  if (!probCreaActual) return;
  probImagenDescarga(probCreaActual)
    .then(() => probCreaDi('Imagen descargada.', 'bien'))
    .catch(() => probCreaDi('No se pudo generar la imagen.', 'mal'));
}

// --- montaje ---------------------------------------------------------------

function probCreaRellenaPiezas() {
  const previa = probCreaPiezaEl.value;
  probCreaPiezaEl.innerHTML = '';
  // Solo piezas: «ganar un peón» no da un problema que se sostenga, y «ganar el
  // rey» es dar mate, que ya es otro objetivo.
  for (const t of V.pieceTypes.filter(t => t !== 'K' && t !== 'P')) {
    const o = document.createElement('option');
    o.value = t;
    o.textContent = PROB_CREA_NOMBRE_PIEZA[t] || t;
    probCreaPiezaEl.appendChild(o);
  }
  if (previa && probCreaPiezaEl.querySelector(`option[value="${previa}"]`)) {
    probCreaPiezaEl.value = previa;
  }
}

function probCreaActualizaCampos() {
  probCreaPiezaCampo.classList.toggle('oculto', probCreaTipoEl.value !== 'gana');
}

function probCreaMonta() {
  const panel = document.getElementById('panel');
  const acciones = document.getElementById('editor-actions');
  if (!panel || !acciones || typeof probSoluciones !== 'function') return;
  if (document.getElementById('problema-box')) return;

  const estilo = document.createElement('style');
  estilo.textContent = PROB_CREA_CSS;
  document.head.appendChild(estilo);

  const caja = document.createElement('div');
  caja.id = 'problema-box';
  caja.innerHTML = `
    <label for="prob-crea-tipo">Crear un problema</label>
    <select id="prob-crea-tipo">
      ${PROB_CREA_TIPOS.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}
    </select>
    <div class="prob-crea-campo oculto" id="prob-crea-pieza-campo">
      <label for="prob-crea-pieza">Pieza que hay que capturar
        <select id="prob-crea-pieza"></select>
      </label>
    </div>
    <label for="prob-crea-jugadas">Jugadas
      <input type="number" id="prob-crea-jugadas" min="1"
             max="${PROB_CREA_MAX_JUGADAS}" value="2">
    </label>
    <div class="save-row">
      <button id="prob-crea-comprueba" class="prob-crea-comprobar"
              title="Buscar la solución forzada y comprobar que el enunciado es cierto">Comprobar</button>
    </div>
    <div id="prob-crea-estado"></div>
    <div class="save-row">
      <button id="prob-crea-guardar" disabled
              title="Guardar el problema en este navegador">Guardar</button>
      <button id="prob-crea-json" disabled
              title="Descargar el problema como archivo .json">.json</button>
      <button id="prob-crea-png" disabled
              title="Descargar el diagrama con el enunciado debajo">Imagen</button>
    </div>`;
  panel.insertBefore(caja, acciones);

  probCreaTipoEl = document.getElementById('prob-crea-tipo');
  probCreaPiezaEl = document.getElementById('prob-crea-pieza');
  probCreaPiezaCampo = document.getElementById('prob-crea-pieza-campo');
  probCreaJugadasEl = document.getElementById('prob-crea-jugadas');
  probCreaBtnComprueba = document.getElementById('prob-crea-comprueba');
  probCreaEstadoEl = document.getElementById('prob-crea-estado');
  probCreaBtnGuardar = document.getElementById('prob-crea-guardar');
  probCreaBtnJson = document.getElementById('prob-crea-json');
  probCreaBtnPng = document.getElementById('prob-crea-png');

  probCreaRellenaPiezas();
  probCreaActualizaCampos();

  probCreaTipoEl.addEventListener('change', () => {
    probCreaActualizaCampos();
    probCreaCaduca();
  });
  probCreaPiezaEl.addEventListener('change', probCreaCaduca);
  probCreaJugadasEl.addEventListener('change', probCreaCaduca);
  probCreaBtnComprueba.addEventListener('click', probCreaComprueba);
  probCreaBtnGuardar.addEventListener('click', probCreaGuarda);
  probCreaBtnJson.addEventListener('click', probCreaJson);
  probCreaBtnPng.addEventListener('click', probCreaPng);
  document.querySelectorAll('input[name="turn"]').forEach(r =>
    r.addEventListener('change', probCreaCaduca));

  probCreaEngancha();
}

// Un problema comprobado caduca en cuanto cambia la posición, y quien sabe que
// la posición ha cambiado es el editor. En vez de tocar editor.js para que avise
// —lo que ataría los dos archivos— se envuelve updateStatus(), que el editor ya
// llama después de cada cambio del tablero (colocar, borrar, vaciar, posición
// inicial, importar, cambiar de modalidad). Es su único punto de paso común.
function probCreaEngancha() {
  if (typeof updateStatus !== 'function') return;
  const original = updateStatus;
  let modalidad = V.id;
  updateStatus = function () {
    original.apply(this, arguments);
    if (V.id !== modalidad) {   // otra modalidad: otras piezas en el desplegable
      modalidad = V.id;
      probCreaRellenaPiezas();
    }
    probCreaCaduca();
  };
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', probCreaMonta);
  } else {
    probCreaMonta();
  }
}
