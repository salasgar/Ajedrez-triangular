// problemas.js — Generación y resolución de problemas ("las blancas juegan y
// dan mate en 2").
//
// Un problema es una posición legal, un bando al que le toca mover y un
// OBJETIVO que ese bando puede forzar contra CUALQUIER defensa en un número
// exacto de jugadas. «Forzar» es lo que separa un problema de un ejercicio
// cualquiera, y es también lo que cuesta de comprobar: no basta con que
// exista una línea buena, hace falta que ninguna respuesta del rival la
// estropee. Eso es una búsqueda Y/O (el que resuelve necesita UNA jugada que
// valga; el que defiende, TODAS las suyas fallando), que es lo que hay aquí.
//
// Este fichero no toca el DOM ni la partida en curso: solo recibe tableros
// sueltos. Así lo puede usar tal cual el worker que va llenando el almacén de
// problemas en segundo plano (ver problemas-ui.js). Depende de rules.js
// (movimientos legales), de ai.js (movesForSide, applyMoveSim, PV) y de las
// tablas por casilla que monta variants.js.

// --- objetivos -------------------------------------------------------------
//
// {tipo, pieza, jugadas}
//   'mate'    dar jaque mate
//   'gana'    capturar una pieza del tipo `pieza` GANANDO material: no vale
//             comerse el caballo y perder la torre en la recaptura
//   'corona'  coronar un peón, y que la pieza nueva no se caiga acto seguido
//   'tablas'  salvar tablas (ahogado, jaque perpetuo o rey contra rey)
//             estando en desventaja material clara
//
// Cualquier objetivo se da por cumplido también si el que resuelve da mate:
// ganar la partida es al menos tan bueno como lo que se pedía, y rechazar
// esas líneas haría casi imposible generar problemas de 'gana'.

const PROB_TIPOS = ['mate', 'gana', 'corona', 'tablas'];

// Se lanza cuando una búsqueda se pasa del presupuesto de nodos. No es un
// error: la posición se descarta y el generador prueba con otra. Es un string
// y no un Symbol para que también se pueda distinguir dentro del worker.
const PROB_ABORTO = 'problema-abortado';

// Nodos como mucho por intento de generación. Una posición que no se resuelve
// con esto es una posición cara, y para el almacén sale más a cuenta tirarla y
// sortear otra que insistir.
const PROB_TOPE = 60000;

// Presupuesto para las comprobaciones de la partida en curso (validar la
// jugada del usuario, elegir la defensa). Aquí no se puede abandonar: la
// posición ya está sobre la mesa y hay que contestar, así que va holgado.
//
// Tiene que ser AL MENOS tan grande como el presupuesto con el que se
// aceptó el problema al crearlo (crear-problema.js usa este mismo valor),
// o un problema hecho a mano que costó caro demostrar como forzado podía
// dejar de poder reverificarse en cuanto el usuario lo jugara: la búsqueda
// fresca de cada jugada agotaba el tope antes de concluir, y esa jugada
// —aunque de verdad resolviera— se retiraba con «no he podido comprobarla»
// (tarea 12 del reparto: un mate en 3 con muchas piezas dibujado en el
// editor podía necesitar más de las 400 000 jugadas examinadas de antes).
const PROB_TOPE_VIVO = 1200000;

// Cuánto material tiene que quedar en pie tras coronar para que la coronación
// cuente. Sin esto valdrían las coronaciones que el rival contesta comiéndose
// la dama nueva, que no son un problema de coronación sino una entrega.
const PROB_MARGEN_CORONA = 300;

// Desventaja material mínima (en centipeones) para que «conseguir tablas»
// tenga gracia. Con menos, las tablas no son una hazaña sino lo normal.
const PROB_DESVENTAJA_TABLAS = 250;

// Cuántas jugadas distintas pueden resolver el problema. Un problema con seis
// soluciones no es un problema: se acierta sin pensar.
//
// El listón se afloja con la profundidad, y no por comodidad. En una jugada la
// unicidad es innegociable: si valen dos de las cuarenta jugadas legales, se
// acierta por casualidad. En tres, encontrar UNA de las dos soluciones ya
// exige ver toda la maniobra, y exigir unicidad ahí descarta la enorme mayoría
// de los mates en 3 —medido: casi ninguno es único— y deja el nivel vacío.
function probMaxSoluciones(tipo, jugadas) {
  if (jugadas <= 1) return 1;
  if (tipo === 'mate' || tipo === 'tablas') return jugadas >= 3 ? 2 : 1;
  return jugadas >= 3 ? 3 : 2;
}

// Bandas de dificultad. `jugadas` es [mínimo, máximo] de jugadas DEL QUE
// RESUELVE: una posición que se resuelve en menos del mínimo se descarta (es
// de otra banda, no de esta), y por encima del máximo no se busca.
//
// El máximo no sube de 4 a propósito: cada jugada más son dos capas del árbol,
// y un mate en 5 con diez piezas no lo termina ningún presupuesto razonable en
// el navegador. La dificultad de las bandas altas viene de las jugadas y de la
// cantidad de material, que es lo que ensancha el abanico de jugadas
// plausibles.
//
// `escapes` es el tope de casillas de huida del rey que sufre para que la
// posición merezca una búsqueda de mate. Es EL filtro que hace posible generar
// mates en este tablero: aquí un rey en campo abierto tiene DOCE vecinas (en el
// ajedrez clásico son ocho), así que sin acorralarlo antes no hay mate forzado
// que valga y se gastaría todo el tiempo buscando en posiciones sin solución.
//
// `tope` es el presupuesto de búsqueda, y sube mucho con la banda por un
// motivo que costó ver: las posiciones que se resuelven en tres jugadas son
// JUSTO las que agotan un presupuesto corto. Con un tope bajo, el generador
// descarta en silencio todo lo interesante y solo deja pasar lo que se resuelve
// en una o dos; medido, la diferencia es entre no sacar ni un mate en 3 y
// sacar uno cada pocos segundos.
//
// `msEspera` es cuánto deja esperar `problemas-ui.js` a una petición del
// usuario cuando el almacén está vacío para ese nivel y tipo (ver
// `PROB_MS_PETICION`). Solo hace falta en los niveles donde encontrar UN
// problema tarda de verdad: medido el 2026-08-24 con
// `entrenamiento/rendimiento.js`, sacar un problema cuesta de media entre 19 s
// y 68 s en Difícil y Experto (tablas de tiempo por problema, `ms/prob`);
// dejar el límite en los 9 s de Fácil/Medio hacía que el botón «Nuevo
// problema» fallara casi siempre en esos dos niveles con «no ha salido
// ningún problema», aunque el generador sí los produce si se le da tiempo.
const PROB_NIVELES = {
  facil: {
    nombre: 'Fácil', jugadas: [1, 2],
    piezas: [0, 2], defensa: [0, 1], escapes: 4, tope: 30000,
  },
  medio: {
    nombre: 'Medio', jugadas: [2, 2],
    piezas: [1, 3], defensa: [1, 3], escapes: 4, tope: 90000,
  },
  dificil: {
    nombre: 'Difícil', jugadas: [3, 3],
    piezas: [1, 3], defensa: [1, 3], escapes: 3, tope: 250000, msEspera: 45000,
  },
  // Experto acepta tres o cuatro jugadas en vez de exigir cuatro: los mates
  // en 4 forzados son rarísimos, y esperar a que salga uno dejaría el nivel
  // vacío. Lo que lo separa de Difícil es el material —más piezas por medio y
  // un rey menos acorralado—, no solo la profundidad. El enunciado siempre
  // dice las jugadas de verdad, así que no se promete nada que no se cumpla.
  experto: {
    nombre: 'Experto', jugadas: [3, 4],
    piezas: [2, 3], defensa: [1, 3], escapes: 5, tope: 400000, msEspera: 90000,
  },
};

// Tipos disponibles en cada nivel. Las tablas solo se fuerzan en una jugada
// (medido sobre decenas de miles de tiradas: el ahogado y el perpetuo forzados
// no salen nunca), así que en los niveles altos serían un problema trivial que
// además coparía el almacén por lo barato que es generarlo: fuera de Difícil y
// Experto. Decisión del 2026-08-24, revocable en reparto/autorizaciones.md.
function probTiposNivel(nivel) {
  return (nivel === 'dificil' || nivel === 'experto')
    ? PROB_TIPOS.filter(t => t !== 'tablas')
    : PROB_TIPOS;
}

// --- utilidades ------------------------------------------------------------

// Copia superficial del tablero. Las piezas se pueden compartir entre tableros
// porque nadie las muta de forma permanente: applyMoveSim crea ejemplares
// nuevos ({...pieza, moved}), y los sondeos de legalidad de genMoves mutan en
// sitio pero dejan la pieza exactamente como estaba antes de devolver el
// control (ver makeSim/unmakeSim en ai.js).
function probCopia(board) {
  const out = new Map();
  for (const [k, p] of board) out.set(k, p);
  return out;
}

// Jugadas legales de un color, por el camino rápido del motor.
//
// La vía obvia era movesForSide(), pero ahí cada jugada candidata se valida
// copiando el Map entero y barriendo el tablero en busca de jaques: sale a
// unas diez mil operaciones por posición, y una búsqueda de mate en 3 visita
// cientos de miles de posiciones. genMoves() hace exactamente lo mismo —el
// mismo conjunto de jugadas, en el mismo orden— pero localizando las clavadas
// una vez por nodo y validando con make/unmake sobre el propio tablero, así
// que la inmensa mayoría de las jugadas se dan por legales sin tocar nada.
//
// Es la diferencia entre poder generar problemas de tres jugadas y no poder.
function probMovs(board, color, ep) {
  const kings = { w: null, b: null };
  for (const [k, p] of board) if (p.type === 'K') kings[p.color] = k;
  if (!kings[color]) return [];
  return genMoves(board, color, ep, kings, {});
}

function probAzar(n) { return Math.floor(Math.random() * n); }
function probElige(lista) { return lista[probAzar(lista.length)]; }
function probEntre(a, b) { return a + probAzar(b - a + 1); }

function probBaraja(lista) {
  for (let i = lista.length - 1; i > 0; i--) {
    const j = probAzar(i + 1);
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }
  return lista;
}

// Saldo material desde el punto de vista de `color`, en centipeones.
function probMaterial(board, color) {
  const val = PV();
  let s = 0;
  for (const p of board.values()) {
    if (p.type === 'K') continue;
    s += (p.color === color ? 1 : -1) * (val[p.type] || 0);
  }
  return s;
}

// Saldo material una vez pasado el chaparrón de capturas: una quiescencia
// puramente material, sin nada posicional.
//
// Hace falta para juzgar «ganar un caballo» de verdad. Mirar solo el material
// justo después de la captura diría que sí en cuanto el caballo desaparece del
// tablero, aunque el rival tenga preparada una recaptura que lo devuelve todo.
// Aquí el que no mueve puede plantarse (stand pat), así que el resultado es el
// material que el bando de `color` puede DEFENDER, no el que toca un instante.
function probSaldoQuieto(board, turn, ep, color, prof = 8) {
  const plantado = probMaterial(board, color);
  if (prof <= 0) return plantado;
  const maximiza = turn === color;
  let mejor = plantado;
  for (const m of probMovs(board, turn, ep)) {
    if (!board.get(m.to)) continue;   // solo capturas (la de al paso es marginal aquí)
    const b2 = probCopia(board);
    const ep2 = applyMoveSim(b2, m.from, m.to, ep);
    const v = probSaldoQuieto(b2, rival(turn), ep2, color, prof - 1);
    if (maximiza ? v > mejor : v < mejor) mejor = v;
  }
  return mejor;
}

// --- el árbol --------------------------------------------------------------

// Todas las jugadas de `color`, cada una ya aplicada sobre su propio tablero.
//
// Se generan los hijos ENTEROS de golpe, en vez de aplicar cada jugada dentro
// del bucle, por dos motivos: la ordenación puede mirar el resultado de la
// jugada (¿da jaque?, ¿corona?) sin pagar una copia extra, y el nodo siguiente
// recibe la lista hecha en vez de volver a generarla para saber si el rival
// tiene respuestas.
function probHijos(board, ep, color) {
  const out = [];
  for (const m of probMovs(board, color, ep)) {
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

// Veces que la última posición del camino ya había salido antes.
function probRepes(camino) {
  const ultima = camino[camino.length - 1];
  let n = 0;
  for (const k of camino) if (k === ultima) n++;
  return n;
}

// Juzga la posición que queda tras una jugada, siempre desde el punto de vista
// del que resuelve: 'exito', 'fracaso' o null (aún no se sabe, hay que seguir
// buscando). `h` es el hijo recién jugado, `hs` los movimientos de quien mueve
// ahora (`turn`), ya generados por el llamante.
function probVeredicto(h, hs, turn, tocada, camino, ctx) {
  const tipo = ctx.obj.tipo;

  if (hs.length === 0) {
    const rey = findKing(h.board, turn);
    if (rey && isAttackedFast(h.board, rey, rival(turn))) {
      // mate: bueno si el ahogado es del que defiende, fatal si es del otro
      return turn === ctx.def ? 'exito' : 'fracaso';
    }
    return tipo === 'tablas' ? 'exito' : 'fracaso';   // ahogado
  }
  // Rey contra rey: tablas muertas. Para 'tablas' es el objetivo cumplido;
  // para el resto, la prueba de que ya no se puede lograr nada.
  if (h.board.size === 2) return tipo === 'tablas' ? 'exito' : 'fracaso';
  if (camino && probRepes(camino) >= 3) {
    return tipo === 'tablas' ? 'exito' : 'fracaso';   // repetición: jaque perpetuo
  }

  // Lo que sigue solo puede lograrlo una jugada del que resuelve, así que si
  // el que mueve ahora es él es que acaba de mover el defensor: nada que ver.
  if (turn !== ctx.def) return null;

  if (tipo === 'gana' && tocada) {
    const meta = ctx.base + (PV()[ctx.obj.pieza] || 0);
    // el material estático es cota superior del quieto cuando defiende el
    // rival (siempre puede plantarse), así que filtra barato el 99 % de casos
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

// Ordenación en los nodos del que resuelve: primero lo que más se parece a la
// solución. No cambia el resultado, solo el tiempo, pero lo cambia mucho: en
// cuanto una jugada funciona se corta el bucle.
function probOrdenaOR(hs, ctx) {
  const val = PV();
  const buscaJaque = ctx.obj.tipo === 'mate' || ctx.obj.tipo === 'tablas';
  for (const h of hs) {
    let p = h.victima ? 20 + (val[h.victima] || 0) / 50 : 0;
    if (ctx.obj.tipo === 'gana' && h.victima === ctx.obj.pieza) p += 200;
    if (h.corono) p += 150;
    if (buscaJaque) {
      const rey = findKing(h.board, ctx.def);
      if (rey && isAttackedFast(h.board, rey, ctx.sol)) p += 100;
    }
    h.orden = p;
  }
  hs.sort((a, b) => b.orden - a.orden);
}

// Ordenación en los nodos del defensor: primero lo que más probablemente
// refute, porque una sola refutación tumba el nodo entero.
function probOrdenaAND(hd) {
  const val = PV();
  for (const h of hd) h.orden = h.victima ? 20 + (val[h.victima] || 0) / 50 : 0;
  hd.sort((a, b) => b.orden - a.orden);
}

// Nodo O: le toca al que resuelve y le basta con que UNA jugada valga.
// Devuelve la línea encontrada ([{from,to}…]) o null.
function probNodoOR(hs, quedan, tocada, camino, ctx) {
  if (quedan <= 0) return null;
  // Se cuentan JUGADAS examinadas, no nodos: el trabajo de un nodo no es
  // constante —generar los hijos de una posición con la dama suelta cuesta
  // diez veces más que con un final de peones—, y un presupuesto por nodos
  // deja pasar posiciones carísimas mientras corta otras baratas.
  ctx.nodos += hs.length;
  if (ctx.nodos > ctx.tope) throw PROB_ABORTO;
  probOrdenaOR(hs, ctx);
  for (const h of hs) {
    const toc = tocada ||
      (ctx.obj.tipo === 'gana' && h.victima === ctx.obj.pieza);
    const cam = camino && camino.concat(positionKey(h.board, ctx.def, h.ep));
    const hd = probHijos(h.board, h.ep, ctx.def);
    const v = probVeredicto(h, hd, ctx.def, toc, cam, ctx);
    if (v === 'exito') return [h.m];
    if (v === 'fracaso') continue;
    if (quedan === 1) continue;   // se acabaron las jugadas y no está logrado
    const resto = probNodoAND(hd, quedan - 1, toc, cam, ctx);
    if (resto) return [h.m, ...resto];
  }
  return null;
}

// Nodo Y: le toca al defensor y hacen falta TODAS sus jugadas fallando.
// Devuelve una línea de muestra (la primera que salió) o null si alguna
// defensa se escapa.
function probNodoAND(hd, quedan, tocada, camino, ctx) {
  ctx.nodos += hd.length;
  if (ctx.nodos > ctx.tope) throw PROB_ABORTO;
  probOrdenaAND(hd);
  let muestra = null;
  for (const h of hd) {
    const cam = camino && camino.concat(positionKey(h.board, ctx.sol, h.ep));
    const hs = probHijos(h.board, h.ep, ctx.sol);
    const v = probVeredicto(h, hs, ctx.sol, tocada, cam, ctx);
    if (v === 'fracaso') return null;
    if (v === 'exito') { if (!muestra) muestra = [h.m]; continue; }
    const resto = probNodoOR(hs, quedan, tocada, cam, ctx);
    if (!resto) return null;
    if (!muestra) muestra = [h.m, ...resto];
  }
  return muestra;
}

// Contexto de una búsqueda. `base` es el saldo material de la posición
// ORIGINAL del problema, no el de la posición desde la que se busca: «ganar un
// caballo» se mide contra el punto de partida del problema, y a mitad de la
// solución el saldo ya se ha movido.
function probCtx(sol, obj, base, tope) {
  return { sol, def: rival(sol), obj, base, nodos: 0, tope };
}

// Jugadas del bando `sol` que logran el objetivo en `obj.jugadas` jugadas.
// Devuelve una lista de líneas (vacía si ninguna). Se prueban TODAS las
// jugadas raíz, no se corta en la primera: hace falta saber cuántas soluciones
// hay para descartar los problemas con varias.
function probSoluciones(board, sol, ep, obj, base, tope = PROB_TOPE) {
  const ctx = probCtx(sol, obj, base, tope);
  const camino = obj.tipo === 'tablas' ? [positionKey(board, sol, ep)] : null;
  const out = [];
  for (const h of probHijos(board, ep, sol)) {
    const linea = probNodoOR([h], obj.jugadas, false, camino, ctx);
    if (linea) out.push(linea);
  }
  return out;
}

// --- juzgar la partida en curso -------------------------------------------

// Qué pasa después de que el que resuelve haya jugado. `ini` trae lo que la
// búsqueda no puede deducir del tablero solo: el saldo de partida del
// problema, si ya se capturó la pieza pedida, el camino de posiciones (para el
// perpetuo) y cómo fue la última jugada.
//
//   {estado:'exito'}                     objetivo cumplido
//   {estado:'fallo'}                     esa jugada ya no lleva a la solución
//   {estado:'sigue', mov, quedan}        el defensor contesta `mov` y al que
//                                        resuelve le hacen falta `quedan`
//                                        jugadas más
//
// La respuesta del defensor no se elige con el motor de la partida sino con
// esta misma búsqueda, y se coge la que MÁS AGUANTA: todas pierden igual, pero
// una defensa que alarga la solución dos jugadas hace un problema mucho mejor
// que otra que se deja matar de inmediato.
function probJuzga(board, def, ep, obj, quedan, ini, tope = PROB_TOPE_VIVO) {
  const sol = rival(def);
  const ctx = probCtx(sol, obj, ini.base, tope);
  const hd = probHijos(board, ep, def);
  const h0 = { board, ep, victima: ini.victima || null, corono: !!ini.corono };
  const camino = obj.tipo === 'tablas' ? ini.camino : null;

  const v = probVeredicto(h0, hd, def, ini.tocada, camino, ctx);
  if (v === 'exito') return { estado: 'exito' };
  if (v === 'fracaso' || quedan <= 0) return { estado: 'fallo' };

  let mejor = null, mejorN = 0, mejorLinea = null;
  for (const h of hd) {
    const cam = camino && camino.concat(positionKey(h.board, sol, h.ep));
    const hs = probHijos(h.board, h.ep, sol);
    const w = probVeredicto(h, hs, sol, ini.tocada, cam, ctx);
    if (w === 'fracaso') return { estado: 'fallo' };
    // El defensor se ha metido él solito en el objetivo (p. ej. queda ahogado
    // en un problema de tablas): al que resuelve no le hace falta ni mover.
    if (w === 'exito') {
      if (!mejor) { mejor = h; mejorN = 0; mejorLinea = []; }
      continue;
    }
    // profundidad mínima que le queda al que resuelve tras esta defensa
    let n = 0, linea = null;
    for (let k = 1; k <= quedan && !linea; k++) {
      linea = probNodoOR(hs, k, ini.tocada, cam, ctx);
      if (linea) n = k;
    }
    if (!linea) return { estado: 'fallo' };
    if (n > mejorN || !mejor) { mejor = h; mejorN = n; mejorLinea = linea; }
  }
  return { estado: 'sigue', mov: mejor.m, quedan: mejorN, linea: mejorLinea };
}

// --- generación ------------------------------------------------------------

// Tipos de pieza de la modalidad activa, sin rey ni peón, que es lo que se
// reparte al sortear una posición. Cada modalidad tiene los suyos (el elefante
// solo está en las de Salas, el unicornio en las de Dekle…).
function probTiposPieza() {
  return V.pieceTypes.filter(t => t !== 'K' && t !== 'P');
}

function probPesadas() {
  return probTiposPieza().filter(t => (PV()[t] || 0) >= 450);
}

function probLigeras() {
  return probTiposPieza().filter(t => (PV()[t] || 0) < 450);
}

// Empujones que le faltan a un peón de `color` en esta casilla para coronar,
// yendo de frente. 99 si no llega nunca (peón encajonado contra el borde en
// las modalidades sin coronación de flanco).
//
// Se cuenta recorriendo `pawnPush` en vez de restar filas porque no todas las
// modalidades cuentan igual: en Trigonal los peones no avanzan por filas sino
// a lo largo de su carril, y ahí una resta de coordenadas no significa nada.
function probPasosACoronar(cell, color) {
  let cur = cell;
  for (let n = 0; n < 24; n++) {
    if (cur.promoFor[color]) return n;
    const sig = (cur.pawnPush[color] || [])[0];
    if (!sig) return 99;
    cur = sig;
  }
  return 99;
}

// Casillas donde un peón de `color` puede estar, a `pasos` empujones de la
// coronación (un intervalo [min, max]). No vale una casilla de coronación:
// ahí el peón ya se habría convertido y la posición sería imposible.
function probCasillasPeon(color, min, max) {
  return CELLS.filter(c => {
    if (c.promoFor[color]) return false;
    const n = probPasosACoronar(c, color);
    return n >= min && n <= max;
  });
}

// Casillas de huida del rey de `color`: vecinas a las que podría irse sin
// quedar en jaque. Es lo que decide si una posición da para un mate, y sale
// barato (una docena de comprobaciones de ataque), así que sirve de filtro
// antes de gastar una búsqueda entera.
function probEscapes(board, color) {
  const rey = findKing(board, color);
  if (!rey) return 99;
  const pieza = board.get(rey.key);
  const foe = rival(color);
  let n = 0;
  for (const t of (rey.leaps.K || [])) {
    const occ = board.get(t.key);
    if (occ && occ.color === color) continue;
    const copia = probCopia(board);
    copia.delete(rey.key);
    copia.set(t.key, pieza);
    if (!isAttackedFast(copia, t, foe)) n++;
  }
  return n;
}

// Reparto de material para cada tipo de problema. Devuelve las listas de tipos
// que le tocan a cada bando (sin los reyes, que van siempre).
//
// El sorteo no es uniforme a propósito: una posición al azar no tiene ni mate
// forzado ni ganancia forzada casi nunca, y sin sesgar el material el
// generador se pasaría el día tirando posiciones. Cada objetivo pide su forma:
// el mate necesita un atacante fuerte contra poca defensa, las tablas justo lo
// contrario, y «ganar material» quiere dos ejércitos parecidos.
function probReparto(tipo, cfg, obj) {
  const pesadas = probPesadas(), ligeras = probLigeras();
  const todas = probTiposPieza();
  const n = probEntre(cfg.piezas[0], cfg.piezas[1]);
  const d = probEntre(cfg.defensa[0], cfg.defensa[1]);

  if (tipo === 'mate') {
    const sol = [probElige(pesadas.length ? pesadas : todas)];
    for (let i = 0; i < n; i++) sol.push(probElige(todas));
    const def = [];
    for (let i = 0; i < d; i++) def.push(probElige(ligeras.length ? ligeras : todas));
    return { sol, def, peonesSol: probAzar(2), peonesDef: probAzar(3) };
  }
  if (tipo === 'gana') {
    // La pieza objetivo va sola: si hubiera dos caballos, «capturan un
    // caballo» no diría cuál, y el enunciado tiene que ser exacto.
    const otras = todas.filter(t => t !== obj.pieza);
    const saca = () => probElige(otras.length ? otras : todas);
    const sol = [], def = [obj.pieza];
    for (let i = 0; i < n + 1; i++) sol.push(saca());
    for (let i = 0; i < d; i++) def.push(saca());
    return { sol, def, peonesSol: probAzar(3), peonesDef: probAzar(3) };
  }
  if (tipo === 'corona') {
    const sol = [], def = [];
    for (let i = 0; i < n; i++) sol.push(probElige(todas));
    for (let i = 0; i < d + 1; i++) def.push(probElige(todas));
    return { sol, def, peonesSol: 0, peonesDef: probAzar(2) };
  }

  // Tablas. Hay dos maneras realistas de salvarlas y se sortea entre ellas:
  //
  //   'material'  el que resuelve se queda con el rey pelado y el rival tiene
  //               UNA pieza: comérsela deja rey contra rey, que son tablas.
  //               Es la familia que de verdad se puede generar, porque la
  //               posición solo tiene que cumplir que esa pieza no se escape.
  //   'ahogado'   el que resuelve va ahogadísimo (una o dos jugadas legales) y
  //               busca quedarse sin ninguna. Sale poquísimo —el rival elige y
  //               casi siempre puede evitarlo—, pero cuando sale es precioso,
  //               así que se le deja su parte del sorteo.
  if (probAzar(10) < 7) {
    // Exactamente UNA pieza, y de cualquier clase: con dos, comerse la primera
    // deja al rival tiempo de sobra para poner la otra a salvo y no hay nada
    // forzado; y limitarla a torre o dama daba siempre la misma posición.
    return {
      familia: 'material', sol: [], def: [probElige(todas)],
      peonesSol: 0, peonesDef: 0,
    };
  }
  const def = [probElige(pesadas.length ? pesadas : todas)];
  for (let i = 0; i < d + 1; i++) def.push(probElige(todas));
  return { familia: 'ahogado', sol: [], def, peonesSol: 0, peonesDef: probAzar(2) };
}

// Casilla para el rey que va a sufrir: se prefieren las de pocos vecinos, que
// son las del borde del tablero, porque es donde se puede acorralar a alguien.
function probCasillaAcorralada(libre) {
  let mejor = null;
  for (let i = 0; i < 8; i++) {
    const c = CELLS[probAzar(CELLS.length)];
    if (!libre(c)) continue;
    const n = (c.leaps.K || []).length;
    if (!mejor || n < mejor.n) mejor = { c, n };
  }
  return mejor ? mejor.c : null;
}

// Una casilla libre al azar de entre las que cumplen `filtro`; si ninguna lo
// cumple, una libre cualquiera (mejor una posición algo peor que ninguna).
function probSitio(libre, filtro) {
  const buenas = [], todas = [];
  for (const c of CELLS) {
    if (!libre(c)) continue;
    todas.push(c);
    if (!filtro || filtro(c)) buenas.push(c);
  }
  const lista = buenas.length ? buenas : todas;
  return lista.length ? lista[probAzar(lista.length)] : null;
}

// Sortea una posición legal con el reparto pedido, o null si no sale.
//
// Todas las piezas nacen con `moved: true`: en un problema no hay enroque ni
// avance doble de peón, que traen consigo la captura al paso y un montón de
// casos raros que no aportan nada al ejercicio.
//
// La colocación tampoco es uniforme. Las piezas del que defiende se pegan a su
// propio rey (le tapan las huidas, que es lo que hace posible un mate) y las
// del que ataca se ponen a tiro. Repartir las doce piezas por el hexágono al
// azar da posiciones sin tema ninguno, y cuesta lo mismo generarlas.
function probPosicion(tipo, cfg, sol, obj) {
  const def = rival(sol);
  const reparto = probReparto(tipo, cfg, obj);
  const board = new Map();
  const libre = (c) => !board.has(c.key);
  const pon = (cell, color, type) => {
    if (!cell) return false;
    board.set(cell.key, { type, color, moved: true });
    return true;
  };

  // Los reyes primero: el que defiende, contra el borde si el problema va de
  // acorralarlo; el otro, sin tocarlo, que los reyes no pueden estar juntos.
  const acorrala = tipo === 'mate';
  const reyDef = acorrala ? probCasillaAcorralada(libre) : probSitio(libre, null);
  if (!pon(reyDef, def, 'K')) return null;
  const pegadoAlRey = (c) => (reyDef.leaps.K || []).some(t => t.key === c.key);
  const cerca = (c, d) => dist(c, reyDef) <= d;
  const reySol = probSitio(libre, (c) => !pegadoAlRey(c));
  if (!pon(reySol, sol, 'K')) return null;

  // Piezas del que defiende. En un mate, buena parte pegadas a su propio rey:
  // son las que le tapan la salida, y sin ellas no hay mate que forzar. En las
  // tablas por material es al revés —tienen que estar al alcance del rey
  // pelado del que resuelve, que es quien se las va a comer—, y en los demás
  // temas se reparten con un poco de estructura y poco más.
  for (const t of reparto.def) {
    let filtro = null;
    if (tipo === 'mate') filtro = probAzar(10) < 6 ? pegadoAlRey : null;
    else if (reparto.familia === 'material') filtro = (c) => dist(c, reySol) <= 2;
    else if (probAzar(10) < 3) filtro = pegadoAlRey;
    if (!pon(probSitio(libre, filtro), def, t)) return null;
  }
  // Piezas del que ataca: a tiro del rey rival cuando el tema es matarlo.
  for (const t of reparto.sol) {
    const filtro = tipo === 'mate' ? ((c) => cerca(c, 4) && !pegadoAlRey(c)) : null;
    if (!pon(probSitio(libre, filtro), sol, t)) return null;
  }

  // Los peones no se colocan de cualquier manera: nunca sobre su casilla de
  // coronación (esa posición no puede darse) y, en un problema de coronación,
  // a tantos empujones de coronar como jugadas tenga la banda. Poner el peón a
  // seis pasos en un problema de tres jugadas es garantizar que no hay
  // solución antes de empezar a buscarla.
  const ponPeones = (color, cuantos, min, max) => {
    if (cuantos <= 0) return true;
    const sitios = probBaraja(probCasillasPeon(color, min, max));
    let puestos = 0;
    for (const c of sitios) {
      if (puestos >= cuantos) break;
      if (!libre(c)) continue;
      board.set(c.key, { type: 'P', color, moved: true });
      puestos++;
    }
    return puestos === cuantos;
  };
  if (tipo === 'corona') {
    if (!ponPeones(sol, probEntre(1, 2), cfg.jugadas[0], cfg.jugadas[1])) return null;
  } else if (!ponPeones(sol, reparto.peonesSol, 1, 99)) return null;
  if (!ponPeones(def, reparto.peonesDef, 1, 99)) return null;

  // --- legalidad y filtros baratos ---
  //
  // Todo lo que sigue vale muchísimo menos que una búsqueda, y cada posición
  // que tumba aquí es una búsqueda entera que no se llega a hacer. Es lo que
  // hace que el generador saque problemas en segundos en vez de en minutos.

  // El que NO mueve no puede estar en jaque: su rey sería capturable y la
  // posición no habría podido darse nunca en una partida.
  const reyRival = findKing(board, def);
  if (!reyRival || isAttackedFast(board, reyRival, sol)) return null;
  const movs = probMovs(board, sol, null);
  if (movs.length === 0) return null;

  const base = probMaterial(board, sol);

  if (tipo === 'mate' && probEscapes(board, def) > cfg.escapes) return null;

  if (tipo === 'gana') {
    // Ganar una pieza que ya se está ganando sola no tiene mérito, y una pieza
    // que nadie ataca no se gana por las buenas en tres jugadas.
    if (base >= (PV()[obj.pieza] || 0)) return null;
    let aTiro = false;
    for (const [key, p] of board) {
      if (p.color === def && p.type === obj.pieza &&
          isAttackedFast(board, CELL_MAP.get(key), sol)) { aTiro = true; break; }
    }
    if (!aTiro) return null;
  }

  if (tipo === 'tablas') {
    // Sin desventaja no hay nada que salvar.
    if (base > -PROB_DESVENTAJA_TABLAS) return null;
    // Ahogarse pide estar ya casi sin aire. La familia 'material' no lleva
    // filtro extra: la pieza a comerse ya se ha colocado al alcance del rey
    // que resuelve, que es toda la condición que hace falta.
    if (reparto.familia === 'ahogado' && movs.length > 3) return null;
  }
  return { board, base };
}

// Sortea un problema completo del nivel pedido, o null si esta tirada no ha
// dado nada (que es lo normal: el generador vive de repetir).
//
// La profundidad se busca de menos a más y el problema se queda con la PRIMERA
// que funciona. Así el número de jugadas del enunciado es exacto —no hay una
// solución más corta escondida—, y de paso se paga poco por las posiciones
// fáciles, que se resuelven en la primera pasada.
function probGeneraUno(nivel, tipos, tope) {
  const cfg = PROB_NIVELES[nivel];
  if (!cfg) return null;
  if (!tope) tope = cfg.tope || PROB_TOPE;
  const tipo = probElige(tipos && tipos.length ? tipos : PROB_TIPOS);
  const sol = probAzar(2) ? 'w' : 'b';
  const obj = { tipo, pieza: null, jugadas: 0 };
  if (tipo === 'gana') {
    // solo piezas: «ganar un peón» no da un problema que se sostenga
    const candidatas = probTiposPieza();
    if (!candidatas.length) return null;
    obj.pieza = probElige(candidatas);
  }

  const pos = probPosicion(tipo, cfg, sol, obj);
  if (!pos) return null;

  // Las tablas no tienen suelo de profundidad. Medido sobre miles de
  // posiciones, la única manera realista de forzar unas tablas en este juego
  // es comerse la última pieza del rival de inmediato: el ahogado forzado y el
  // jaque perpetuo existen sobre el papel pero no salen ni una vez entre
  // decenas de miles de tiradas. Exigirles dos o tres jugadas dejaría el tipo
  // sin un solo problema en todos los niveles menos el primero, así que aquí
  // la dificultad la pone el material del rival, no el número de jugadas.
  const minJugadas = tipo === 'tablas' ? 1 : cfg.jugadas[0];

  try {
    for (let n = 1; n <= cfg.jugadas[1]; n++) {
      obj.jugadas = n;
      const sols = probSoluciones(pos.board, sol, null, obj, pos.base, tope);
      if (!sols.length) continue;
      if (n < minJugadas) return null;                      // es de otra banda
      if (sols.length > probMaxSoluciones(tipo, n)) return null;
      return {
        version: 1,
        app: 'ajedrez-triangular-problema',
        variant: V.id,
        board: [...pos.board].map(([k, p]) => [k, { ...p }]),
        turn: sol,
        base: pos.base,
        obj: { ...obj },
        linea: sols[0],
        soluciones: sols.length,
        dificultad: nivel,
        creado: new Date().toISOString(),
      };
    }
  } catch (e) {
    if (e === PROB_ABORTO) return null;   // posición cara: a por otra
    throw e;
  }
  return null;
}

// Insiste hasta que salga uno o se agote el tiempo. Devuelve el problema (con
// cuántas tiradas hicieron falta) o null.
function probGenera(nivel, tipos, msTope = 4000) {
  const t0 = Date.now();
  let intentos = 0;
  while (Date.now() - t0 < msTope) {
    intentos++;
    const p = probGeneraUno(nivel, tipos);
    if (p) { p.intentos = intentos; p.ms = Date.now() - t0; return p; }
  }
  return null;
}

// --- comprobación de un problema que llega de fuera ------------------------

// Un .json importado entra directo al motor, así que se mira con lupa: que las
// casillas existan en el tablero de SU modalidad, que las piezas sean de las
// que esa modalidad tiene y que haya exactamente dos reyes.
function probValida(p) {
  if (!p || p.version !== 1 || p.app !== 'ajedrez-triangular-problema') return false;
  if (!Array.isArray(p.board) || p.board.length < 2) return false;
  if (p.turn !== 'w' && p.turn !== 'b') return false;
  if (!p.obj || !PROB_TIPOS.includes(p.obj.tipo)) return false;
  if (!Number.isInteger(p.obj.jugadas) || p.obj.jugadas < 1 || p.obj.jugadas > 8) return false;
  if (!Array.isArray(p.linea) || p.linea.length === 0) return false;
  if (typeof p.base !== 'number') return false;
  const modalidad = VARIANTS[p.variant];
  if (!modalidad) return false;
  const forma = BOARDS[modalidad.board];
  const piezas = new Set(Object.keys(
    modalidad.pieces || VARIANTS[modalidad.inherits].pieces));
  if (p.obj.pieza !== null && p.obj.pieza !== undefined && !piezas.has(p.obj.pieza)) return false;
  let reyes = 0;
  for (const ent of p.board) {
    if (!Array.isArray(ent) || ent.length !== 2) return false;
    const [key, pieza] = ent;
    const co = String(key).split(',').map(Number);
    if (co.length !== 3 || co.some(n => !Number.isInteger(n))) return false;
    const suma = co[0] + co[1] + co[2];
    if (suma !== 1 && suma !== 2) return false;
    if (!forma.has(co[0], co[1], co[2])) return false;
    if (!pieza || !piezas.has(pieza.type)) return false;
    if (pieza.color !== 'w' && pieza.color !== 'b') return false;
    if (pieza.type === 'K') reyes++;
  }
  if (reyes !== 2) return false;
  return p.linea.every(m => m && typeof m.from === 'string' && typeof m.to === 'string');
}

// Comprueba lo que promete el ENUNCIADO, no solo la forma: que el objetivo
// se logre por fuerza en EXACTAMENTE `obj.jugadas` jugadas —ni menos, que
// haría el enunciado falso («mate en 3» habiendo mate en 2), ni ninguna, y
// dentro del número de soluciones que permite `probMaxSoluciones` (más de
// las permitidas se acierta sin pensar). Es la misma comprobación que ya
// hace por construcción el bucle de menos a más jugadas de `probGeneraUno`
// y de `probCreaBusca`: aquí se repite como verificación EXPLÍCITA para el
// único camino de entrada que no pasa por ninguno de los dos —un .json
// importado desde fuera de esta build—, que es donde puede colarse un
// problema que otra versión (u otra mano) montó sin esa garantía.
//
// Cara aposta: hace hasta `obj.jugadas` búsquedas Y/O completas. Solo se usa
// en sitios de un solo problema y de una sola vez —importar un archivo—,
// nunca en el bucle caliente de generación ni al cargar el almacén entero
// (ahí ya está garantizado por construcción, y repetirlo por cada uno
// congelaría la pestaña al abrirla).
function probVerificaForzado(p, tope = PROB_TOPE_VIVO) {
  let board;
  try {
    board = new Map(p.board.map(([k, pieza]) => [k, { ...pieza }]));
  } catch {
    return false;
  }
  try {
    for (let n = 1; n < p.obj.jugadas; n++) {
      const atajo = probSoluciones(board, p.turn, null, { ...p.obj, jugadas: n }, p.base, tope);
      if (atajo.length) return false;   // hay una solución más corta: el enunciado miente
    }
    const sols = probSoluciones(board, p.turn, null, p.obj, p.base, tope);
    if (!sols.length) return false;     // no está forzado de verdad
    if (sols.length > probMaxSoluciones(p.obj.tipo, p.obj.jugadas)) return false;
  } catch (e) {
    if (e !== PROB_ABORTO) throw e;
    return false;   // sin concluir: mejor descartarlo que dar un problema roto por bueno
  }
  return true;
}
