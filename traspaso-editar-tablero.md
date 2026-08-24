# Traspaso — editar-tablero

Actualizado: 2026-08-24 · Sesiones previas: 1

## Objetivo
Que a mitad de una partida se pueda pulsar «Editar tablero», llegar al editor de posiciones
con la situación exacta que había, retocarla, guardarla con nombre si se quiere, y volver a la
partida para seguir jugando. La edición tiene que ser una entrada más de la partida: se deshace
con «Deshacer jugada», sale en la lista de jugadas y viaja dentro de «Guardar partida».

## Estado actual
El plan completo está aprobado y escrito en
`/Users/salasgar/.claude/plans/quiero-que-a-mitad-piped-rivest.md`, dividido en §1 (ida y vuelta
al editor), §2 (motor), §3 (corte del historial), §4 (validación) y §5 (planilla, deshacer y
guardado).

**Hecho: §2 y §3, el núcleo del motor.** En `rules.js`, la edición se aplica con `applyEdit()`,
que apila la posición como un snapshot marcado `edited: true` y recalcula el estado; `lastEditIndex()`
acota los barridos del historial; `evaluateStatus()` sale de `finishMove()` para que la edición
decida jaque/mate/ahogado con la misma lógica; `capturedFromBoard()` recompone el panel de
capturadas; `positionProblem()` rechaza posiciones injugables. En `ai.js`, `searchState()` y
`stateAtIndex()` arrancan en `lastEditIndex()` para que la máquina no vea repeticiones de una
partida que ya no existe. Verificado con `node test-edicion.js`: 26 comprobaciones en verde,
incluida la secuencia jugar → editar → seguir jugando → deshacer hasta revertir la edición. Sin
ediciones de por medio, `lastEditIndex()` devuelve 0 y el comportamiento es idéntico al anterior.

**Pendiente: §1, §4 y §5**, que es toda la interfaz. Durante la sesión del 2026-08-24 esos siete
ficheros estaban reclamados por otras sesiones de Claude y no se pudieron tocar; a las 19:45 de ese
día ya no había ninguna reclamación viva. Nada está empezado en ellos.

## Siguiente paso
1. **§1 — la ida y vuelta al editor.** Clave `EDIT_SESSION_KEY` en `saveload.js`, botón
   `#btn-edit-board` en `index.html`, handler y `tryResumeEditedGame()` en `script.js`, y en
   `editor.js` el modo «sesión de edición» (cargar la posición conservando `moved`, bloquear el
   selector de modalidad, botones «Continuar partida» y «Guardar situación de partida»).
2. **§4 — validación al volver.** Ya está escrita en `rules.js` como `positionProblem(board, turn)`:
   `editor.js` solo tiene que llamarla y enseñar el texto que devuelve con `showMessage()`.
3. **§5 — planilla, deshacer y guardado.** Fila `✎ Posición editada`, numeración por contador en
   vez de por paridad, guarda en el deshacer del par contra la máquina, excepción en `validateSave`
   y `SAVE_VERSION = 3`, línea en `movesAsText()` y corte de la gráfica de evaluación.

Antes de empezar, mirar `.claude/sesiones/*.json` para comprobar que nadie tiene reclamados esos
ficheros.

Banda de modelo para retomar: **MEDIO** — el diseño ya está decidido y escrito; lo que queda es
programar interfaz siguiendo un plan cerrado, sin decisiones caras.

## Decisiones tomadas
| Decisión | Por qué |
|---|---|
| La edición es un snapshot más del historial, marcado `edited: true` | El historial ya era una pila de estados completos, así que deshacer, rehacer, revisar y guardar funcionan sin mecanismo aparte |
| El editor sigue siendo una página aparte, con ida y vuelta por `localStorage` | `editor.js` y `script.js` declaran los mismos `const` (`SVG_NS`, `PIECE_NAMES`, `ICON_PIECES`): no pueden cargarse juntos sin un refactor previo |
| Las piezas que no se tocan conservan su flag `moved` | `undefined` es falso y equivale a «no movida»: sin esto, retocar un peón cualquiera le devolvería el enroque al rey |
| La cuenta de repeticiones se corta en la última edición | Las posiciones anteriores describen otra partida; contarlas daría tablas por repetición que no existen |
| `capturedBy` se recalcula del material en vez de heredarse | Tras editar, la lista heredada no cuadra con el tablero. Una pieza de más que no sea peón se entiende como coronación, no como peón capturado |
| La planilla se numera con contador y color, no con la paridad del índice | Insertar la fila de la edición desplaza la paridad y manda las blancas a la columna de las negras. Ese fallo ya está presente en el código actual con posiciones diseñadas con las negras en juego |
| `SAVE_VERSION` sube a 3, y la carga acepta también el 2 | `validateSave` exige `lastMove` en todo snapshot y hay que exceptuar los de edición, sin romper los ficheros ya guardados |
| La partida en curso se guarda en `localStorage` al entrar al editor | Si no, el botón «atrás» del navegador la perdería, porque el editor es otra página |

## Descartado — no volver a proponer
| Se descartó | Motivo |
|---|---|
| Integrar el editor dentro de `index.html` como capa superpuesta | Choque de `const` duplicados entre `editor.js` y `script.js`. Es mejor arquitectura y queda como dirección futura, pero exige extraer antes las piezas comunes a un módulo, y eso no entra en este trabajo |
| Controles de captura al paso en el editor | Caso marginal: tras editar, `enPassant` queda a `null` y basta |
| Bloquear la vuelta si hay peones en casilla de coronación | Se avisa, no se bloquea: es una posición rara, no imposible |
| Montar un worktree con `scripts/nueva-sesion.sh` para este trabajo | El script se niega si hay cambios sin commitear en `main`, y el árbol lleva muchos |

## Archivos
- `rules.js` — motor. Lo nuevo: `lastEditIndex()` (línea 179), `evaluateStatus()` (443),
  `capturedFromBoard()` (471), `positionProblem()` (501), `applyEdit()` (517).
- `ai.js` — `searchState()` y `stateAtIndex()` cortan el historial en `lastEditIndex()`.
- `test-edicion.js` — las 26 comprobaciones del núcleo. Se ejecuta con `node test-edicion.js`.
- `/Users/salasgar/.claude/plans/quiero-que-a-mitad-piped-rivest.md` — el plan aprobado, con el
  detalle de lo que falta y una sección de verificación manual en el navegador.
- Pendientes de tocar: `index.html`, `script.js`, `editor.html`, `editor.js`, `saveload.js`,
  `style.css`, `sw.js`.

## Contexto que no está en los archivos
- El repositorio tiene varias sesiones de Claude trabajando a la vez, registradas en
  `.claude/sesiones/*.json`. Una sesión no puede editar los ficheros que otra tenga reclamados, y
  eso fue lo que dejó este trabajo a medias. Conviene comprobarlo antes de empezar y no dar por
  hecho el estado del árbol de trabajo: los cambios sin commitear de `editor.js`, `editor.html`,
  `style.css` y `sw.js` son de otras sesiones, no de esta.
- `test-edicion.js` está sin trackear y sin commitear, igual que el resto del trabajo.
