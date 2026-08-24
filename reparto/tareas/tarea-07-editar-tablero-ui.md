# Tarea 07 · Interfaz de «Editar tablero» (§1, §4 y §5 del plan)

Actualizado: 2026-08-24
Precondición: tarea 05 LISTA · Disparo: MANUAL
Duración esperada: 4 h · Banda de modelo: MEDIO
Salida (dueña exclusiva): `main` (`index.html`, `script.js`, `editor.html`,
`editor.js`, `saveload.js`, `style.css`, `sw.js`)

La precondición con la 05 no es temática: las dos tareas editan `index.html` y
`script.js`, y serializarlas es lo que evita el choque.

## Antes de empezar
1. Lee `reparto/_ESTADO.md`, lista `reparto/hechos/`, comprueba la terminada de la 05.
2. `date -u`, `sid`, reclamo `07--<sid>.md` (caduca: +8 h), `sleep 30`, volver a mirar.
3. Mira `.claude/sesiones/*.json` por reclamos de fichero del harness sobre los siete
   ficheros de la salida.

## Objetivo
El motor de la edición a mitad de partida (§2 y §3) está hecho, verificado con 26
comprobaciones y, tras la 01+04, publicado. Falta TODA la interfaz: §1 (ida y vuelta al
editor), §4 (validación al volver) y §5 (planilla, deshacer y guardado). El plan
aprobado, con el detalle de cada sección y su verificación manual, está en
`/Users/salasgar/.claude/plans/quiero-que-a-mitad-piped-rivest.md`. El resumen y las
decisiones, en `traspaso-editar-tablero.md`.

## Qué hay que hacer
1. **§1 — ida y vuelta al editor**: clave `EDIT_SESSION_KEY` en `saveload.js`, botón
   `#btn-edit-board` en `index.html`, handler y `tryResumeEditedGame()` en `script.js`,
   y en `editor.js` el modo «sesión de edición» (cargar la posición conservando
   `moved`, bloquear el selector de modalidad, botones «Continuar partida» y «Guardar
   situación de partida»).
2. **§4 — validación al volver**: `positionProblem(board, turn)` ya existe en
   `rules.js`; `editor.js` solo tiene que llamarla y enseñar el texto con
   `showMessage()`.
3. **§5 — planilla, deshacer y guardado**: fila `✎ Posición editada`, numeración por
   contador en vez de por paridad, guarda en el deshacer del par contra la máquina,
   excepción en `validateSave` y `SAVE_VERSION = 3` (la carga acepta también el 2),
   línea en `movesAsText()` y corte de la gráfica de evaluación.
4. Verificación manual del navegador según la sección de verificación del plan, más
   `node test-edicion.js` (no debe romperse nada del motor).
5. `sw.js`: una sola subida de `VERSION` al publicar. Commit (mirando el diff antes del
   add) y push.

## Datos de entrada
- `/Users/salasgar/.claude/plans/quiero-que-a-mitad-piped-rivest.md` — el plan cerrado.
- `traspaso-editar-tablero.md` — decisiones y descartes; léelo antes que el plan.

## Salida esperada
`origin/main` con la edición a mitad de partida completa: botón, ida y vuelta,
validación, planilla, deshacer y guardado con `SAVE_VERSION = 3`.

## Cómo saber que ha terminado
El ciclo del plan en navegador: jugar unas jugadas → «Editar tablero» → retocar →
volver → seguir jugando → deshacer hasta revertir la edición → guardar y recargar la
partida con la edición dentro. Y `node test-edicion.js` sigue en verde (26/26).

## Al terminar
Cierre estándar: terminada `07--<sid>.md`, `CERRADA`, incidencias, regenerar tablón
(la 08 pasa a PENDIENTE si la 05 está LISTA), `git add reparto/` + commit + push, y
decir a Juan Luis qué queda libre y con qué banda.

## Trampas conocidas
- `editor.js` y `script.js` declaran los mismos `const` (`SVG_NS`, `PIECE_NAMES`,
  `ICON_PIECES`): no pueden cargarse juntos; el editor sigue siendo página aparte con
  ida y vuelta por `localStorage` (decidido; no lo rediscutas).
- Las piezas no tocadas conservan su flag `moved`: `undefined` es falso y equivale a
  «no movida»; sin esto, retocar un peón devolvería el enroque al rey.
- La numeración de la planilla por paridad ya está rota hoy con posiciones diseñadas
  con negras en juego; el plan la cambia a contador. No «arregles» la paridad.
- Git tarda 1-3 minutos por orden.

## Prohibido
- Integrar el editor dentro de `index.html` como capa superpuesta (descartado: choque
  de `const`; queda como dirección futura, no de este trabajo).
- Controles de captura al paso en el editor (descartado: `enPassant` a `null` basta).
- Bloquear la vuelta si hay peones en coronación: se avisa, no se bloquea.
