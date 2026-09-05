# Tarea 24 · «Diseñar tablero» y «Problemas» a veces muestran piezas de otro modo, no de la PPT activa

Creada: 2026-09-05 (sesión s-20260905T113829-6fd2b04e, encargo directo de Juan Luis:
«en los modos PPT, si le doy a "diseñar tablero" o al botón "Problemas", etc, hay
veces que me salen piezas de otros modos que no son PPT»)
Precondición: ninguna · Disparo: MANUAL
Duración esperada: 3 h · Banda de modelo: MEDIO
Salida (dueña exclusiva): `main` (script.js, editor.js — y crear-problema.js /
problemas-ui.js si el diagnóstico de abajo alcanza también a la pestaña Problemas)

## Antes de empezar
1. Lee `reparto/proyecto.md` y `reparto/_ESTADO.md` enteros, y lista `reparto/hechos/`
   (reclamos, terminadas, incidencias) comparándolo con `git log`.
2. `date -u`, genera tu `sid` en el mismo comando.
3. Reclama con `hechos/reclamos/24--<sid>.md` (`caduca:` = ahora + 6 h), lanza
   `sleep 30 && ls reparto/hechos/reclamos/` en segundo plano y cede si otra sesión
   llegó antes.
4. Comprobación barata: si ya existe `hechos/terminadas/24--*`, nada que hacer.

## El problema, contado por Juan Luis (2026-09-05)
Estando en una modalidad PPT, al pulsar «Diseñar tablero» (o entrar a crear/editar un
problema), a veces el tablero o la paleta muestran piezas que no son de PPT (peón,
caballo, alfil, torre, dama, rey del ajedrez clásico) en vez de las piezas propias de
la modalidad PPT activa (piedra/papel/tijera y variantes). No siempre — «hay veces» —
lo que encaja con que solo pase por un camino concreto de navegación, no en todos.

## Por dónde empezar (ya localizado, sin verificar en navegador todavía)
Hay una causa concreta y verificada por lectura de código para el caso de «Diseñar
tablero» **cuando se abre desde cero** (no editando una partida existente):

- `script.js:1612-1614`, el botón `btn-design` (Diseñar tablero) hace
  `window.location.href = 'editor.html'` **sin pasar qué modalidad estaba activa**.
  Compáralo con `btn-edit-board` (script.js:1616-1627), que SÍ guarda
  `envelope.variant` en `localStorage` antes de navegar.
- `editor.js:549`: `if (!V) setVariant(DEFAULT_VARIANT || 'salas');` — si `editor.html`
  se abre sin ninguna de las dos claves de `localStorage` que sí llevan variante
  (`EDIT_SESSION_KEY` para «editar tablero actual», `DESIGN_POSITION_KEY` para volver
  de una posición ya diseñada) y sin parámro de URL, cae aquí.
- `variants.js:786`: `const DEFAULT_VARIANT = 'salas'` — una modalidad CLÁSICA, no PPT.

O sea: pulsar «Diseñar tablero» desde una modalidad PPT sin haber diseñado ya una
posición antes en esa sesión de navegador (o tras borrar el `localStorage`) abre el
editor en `salas`, con piezas clásicas — el síntoma exacto que describe Juan Luis.
Nótese el comentario de `variants.js:790-793`, que dice que las modalidades ocultas
«se abren con `?modalidad=<id>` en la URL» — **ese mecanismo NO está implementado en
ningún sitio** (comprobado: `grep -rn "modalidad=" *.js` solo devuelve ese comentario);
es la vía obvia para arreglar esto: que `btn-design` pase `?modalidad=<V.id o su
tablero exacto>` y que `editor.js` lo lea antes de caer al `DEFAULT_VARIANT`.

**Sin verificar todavía, y es la primera pregunta a resolver**: si esto explica
también el caso de «Problemas». La pestaña Problemas vive dentro de `index.html`
(tarea 05), compartiendo el `V` global de `script.js` — no navega a `editor.html`
(comprobado: `grep -n "editor.html" *.js *.html` solo encuentra las dos navegaciones
de arriba, ninguna desde `problemas-ui.js` ni `crear-problema.js`). Pero
`crear-problema.js` SÍ se carga dentro de `editor.html` (usa el gancho `updateStatus`
de `editor.js`, ver `crear-problema.js:434-446`, `probCreaRellenaPiezas()`) — así que
si «crear un problema» pasa en algún momento por abrir `editor.html` desde cero (para
diseñar la posición del problema) en vez de reutilizar el editor ya abierto, hereda el
mismo bug del `DEFAULT_VARIANT`. Verifica el flujo real en el navegador antes de
asumir que es la misma causa: puede que «el botón Problemas» al que se refiere Juan
Luis sea otro camino que aún no se ha localizado por lectura de código.

## Qué hay que hacer
1. Reproduce en el navegador, en las dos direcciones: (a) desde una modalidad PPT,
   `localStorage` limpio de `DESIGN_POSITION_KEY`/`EDIT_SESSION_KEY`, pulsar «Diseñar
   tablero» — confirma que aparecen piezas de `salas`. (b) desde una modalidad PPT,
   entrar en la pestaña Problemas y a «Nuevo problema» — determina si en algún punto
   de ese camino se navega a `editor.html` desde cero, y si el síntoma se reproduce
   igual.
2. Arregla el camino de «Diseñar tablero»: pasa la modalidad activa (y el tablero, si
   la modalidad pertenece a una familia PPT×teselación — mira `V.familia`/`V.tablero`
   en `variants.js`) al navegar a `editor.html`, por `localStorage` (como ya hace
   `btn-edit-board`) o por `?modalidad=<id>` en la URL (como promete el comentario de
   `variants.js`); que `editor.js` lo lea ANTES de caer a `DEFAULT_VARIANT`.
3. Si el paso 1(b) confirma que Problemas comparte la causa, arréglalo con el mismo
   mecanismo; si tiene una causa distinta, documéntala y arréglala por separado —no
   asumas que es el mismo bug sin haberlo visto en el navegador.
4. Verifica que el camino existente («Editar tablero» sobre una partida en curso, que
   SÍ pasa la variante hoy) sigue funcionando igual: no toques `btn-edit-board` salvo
   que el arreglo elegido lo requiera.
5. `node test-edicion.js` en verde; si añades un caso de regresión para este bug
   (recomendado: abrir editor.html con una modalidad PPT y sin sesión de edición,
   comprobar que `V.id` es la PPT y no `salas`), inclúyelo ahí.
6. Prueba manual en Chromium/Playwright headless (como hizo la tarea 08): las cuatro
   modalidades PPT vigentes (PPTR, PPTLSR, sus dos Murallas), «Diseñar tablero» y (si
   aplica) «Nuevo problema», comprobando que la paleta y el tablero muestran piezas
   PPT, no clásicas.

## Datos de entrada
- `variants.js` — SOLO LECTURA salvo que el arreglo necesite leer `V.familia`/
  `V.tablero`/`hidden` (ya existen, no hace falta añadir campos).
- `script.js` (los dos manejadores de navegación a `editor.html`), `editor.js` (línea
  549 y el resto de la inicialización), `crear-problema.js`, `problemas-ui.js`.
- `tareas/tarea-05-pestana-problemas.md`, `tareas/tarea-07-editar-tablero-ui.md` — qué
  se decidió al construir esa interfaz, por si el camino de Problemas ya se documentó
  allí y hay contexto que ahorre redescubrirlo.

## Salida esperada
Commit a `main` con los ficheros tocados; sin carpeta de salida propia en
`reparto/salidas/` (la salida es git, como en la mayoría de tareas de este reparto).

## Cómo saber que ha terminado
Abrir `editor.html` desde `btn-design` estando en cada una de las cuatro modalidades
PPT vigentes muestra la paleta y el tablero de ESA modalidad, no de `salas` ni de
ninguna otra clásica. Si el bug de Problemas resultó ser el mismo, igual ahí. Todas
las pruebas existentes (`test-edicion.js` y las que ya pasaban) en verde.

## Al terminar
Cierre estándar: `hechos/terminadas/24--<sid>.md` con qué causa real resultó ser y qué
mecanismo de paso de modalidad se eligió, `CERRADA` en el reclamo, regenerar
`_ESTADO.md` (recopiando la banda), `git add reparto/` + commit + push, avisar a Juan
Luis.

## Trampas conocidas
- El catálogo PPT cambió el 2026-08-26: prueba con los ids vigentes (PPTR, PPTLSR,
  Murallas de papel), no con `rps`/`rpsls` (retiradas).
- `hermanaEnMismoTablero()` (script.js:1540) y `fillBoardSelect()` (script.js:1524)
  ya manejan la relación familia↔tablero para el selector de `index.html`; si el
  arreglo necesita reproducir esa lógica en `editor.js`, mira si conviene exportar
  una función compartida en vez de duplicar el criterio — pero no lo hagas si con
  pasar el id exacto de la modalidad (que ya identifica tablero y familia) basta.
- Git tarda 1-3 minutos por orden; el árbol lo comparten varias sesiones: mira
  `.claude/sesiones/*.json` y el diff antes de cualquier `git add`.

## Prohibido
- Tocar la evaluación o el motor de la IA (`ai.js`): este bug es de interfaz, no de
  juego.
- Añadir el parámetro `?modalidad=` sin quitar antes el comentario de
  `variants.js:790-793` que lo da por implementado, o dejarlo implementado a medias:
  si se elige esa vía, que quede realmente conectada en los dos extremos (quien
  navega y quien lee la URL).
