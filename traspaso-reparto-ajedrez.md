# Traspaso — reparto-ajedrez

Actualizado: 2026-08-24 · Sesiones previas: 2

## Objetivo

Terminar los trabajos a medias del repositorio
`/Users/salasgar/Documents/git/Ajedrez-triangular` aplicando la skill `reparto`.
Encargo de Juan Luis del 2026-08-24: repartir los seis trabajos pendientes «más lo que
se estime que merece la pena», con todas las decisiones delegadas.

## Estado actual

**El reparto está montado y en marcha.** El estado por tarea vive en el tablón
`reparto/_ESTADO.md` (fuente de verdad: `reparto/hechos/`), y este archivo no lo
repite. Resumen de un vistazo, a 2026-08-24 21:40Z:

- **LISTAS: 01, 02, 04 y 05** (vaciado del árbol compartido, integración PPT,
  reconciliación, pestaña «Problemas»). Todo publicado en `origin/main` = `2881552` y
  verificado (pruebas de node + Chrome headless).
- **A MEDIAS: 06** — le queda ajustar `PROB_NIVELES` (dificil/experto siguen a 0
  problemas/min, medido) y rehacer `prueba-problemas.js`; leer
  `reparto/hechos/fallos/06--*.md`, que lo deja masticado.
- **PENDIENTES: 03 y 07** (arena de posiciones PPT; interfaz de editar-tablero).
- **BLOQUEADAS: 08** (espera 07), **10** (espera 03) y **09** (espera DOS FIRMAS de
  Juan Luis en `reparto/autorizaciones.md`).
- El árbol compartido está **limpio** sobre `main`: ya se puede editar con normalidad
  (con los reclamos de `.claude/sesiones/` de siempre).

## Siguiente paso

Abrir una o varias sesiones de trabajo con la **frase de arranque de
`reparto/proyecto.md`** (copiada abajo). Libres y sin pisarse entre sí: **03, 06 y
07**, las tres de banda MEDIO. Y firmar cuando quiera las dos casillas de
`reparto/autorizaciones.md`, que es lo único que desbloquea la 09.

Banda de modelo para retomar: **MEDIO** — todas las tareas libres son de esa banda; ya
no queda ninguna decisión de estructura.

## Decisiones tomadas

| Decisión | Por qué |
|---|---|
| El corte del reparto: 10 tareas por dependencias, no por temas | Regla de la skill; el detalle y las que no tienen tarea propia, en `reparto/proyecto.md` |
| `hechos/` mínimo, en el árbol del repo, commiteado como copia de seguridad | Todas las sesiones son locales y comparten el árbol; git ya hace de registro de lo demás |
| Los `traspaso-*.md` se commitean al repo | Delegación expresa del 2026-08-24; reversible; limpian `git status` |
| `tablas` restringido a fácil y medio | Solo se fuerza en una jugada; copaba el almacén. Revocable en `autorizaciones.md` |
| `sw.js` quedó en **v6** tras la reconciliación | PPT y problemas-imagen eligieron v5 por su cuenta y main estuvo publicado ~1 h con la v5 solo-PPT |
| El bloque kingless de `finishMove` se movió dentro de `evaluateStatus()` | Única resolución que deja bien PPT **y** editar-tablero: una edición también decide estado en modalidades sin rey |
| El séptimo trabajo sin traspaso (paleta del editor) se commiteó como bloque propio | Hunks coherentes entre sí (editor.js + editor.html + style.css); la 08 lo verifica de rebote |
| La regla `#panel[hidden]{display:none}` va en `problemas.css`, no en `style.css` | `style.css` da a `#panel` display:flex y pisaba el atributo hidden; `problemas.css` es quien introduce las pestañas y ya protegía el suyo |

## Descartado — no volver a proponer

| Se descartó | Motivo |
|---|---|
| `git reset --hard` para limpiar el árbol compartido | El clasificador de permisos lo bloquea. La vía que funcionó y honra el bloqueo: `git stash push` + apartar los untracked verificados por hash + `git merge --ff-only` |
| `git add` por nombre de un fichero tracked-modificado sin mirar su diff | Causó el fallo histórico de la insignia; con el árbol ya limpio pesa menos, pero la costumbre se queda |
| Montar el `hechos/` completo de la skill | Repo git: basta el mínimo (decidido en la sesión 1, sigue valiendo) |
| Tarea propia para insignia-captura, editor-posiciones y problemas-imagen | Se resolvieron dentro de 01, 05 y 08 tal como estaba previsto |
| Esperar el reapuntado automático de una PR apilada al mezclar su base | GitHub solo reapunta si se borra la rama base; se hace a mano con `gh pr edit N --base main` |
| `sleep` en primer plano para la espera del protocolo | El harness lo bloquea; va con `run_in_background` |

## Archivos

- `reparto/_ESTADO.md` — el tablón; empieza por aquí.
- `reparto/proyecto.md` — ficha fija: rutas, bandas (ALTO=Fable 5, MEDIO=Sonnet 5,
  BAJO=Haiku 4.5 el 2026-08-24), reglas del repo y frase de arranque.
- `reparto/autorizaciones.md` — las dos firmas pendientes y las decisiones revocables.
- `reparto/tareas/tarea-NN-*.md` — las diez fichas de tarea.
- `reparto/hechos/` — reclamos, terminadas, fallos, incidencias (fuente de verdad).
- Los seis `traspaso-*.md` de los trabajos — ya commiteados; solo lectura.
- `stash@{0}` en `main` — respaldo de la reconciliación (04); se puede tirar cuando la
  08 esté en verde, y tirarlo es decisión de Juan Luis.

## Contexto que no está en los archivos

- Git tarda 1-3 minutos por orden en este repo: en segundo plano y encadenado.
- `du` marca 0 B en ficheros evictados por iCloud; `ls -l` da el tamaño real.
- La sesión que montó y ejecutó 01-05 fue `s-20260824T180039-ac278f27` (Fable). Las
  otras 6 sesiones registradas en `.claude/sesiones/` estuvieron inactivas todo el día.
- La ronda 15 del entrenamiento cerró (por eso existe la tarea 10); la 14 sigue a
  medias y NO se relanza sin que lo pida Juan Luis.

---

Lo primero que hará la sesión nueva: leer el tablón y reclamar una de las tareas
libres (03, 06 o 07).

Banda para abrirla: **MEDIO** — programar e integrar con el criterio ya fijado.

Frase para cada sesión de trabajo (una por tarea; pueden ir tres a la vez):

> Trabaja en el reparto del repositorio
> `/Users/salasgar/Documents/git/Ajedrez-triangular`, carpeta `reparto/`. He abierto
> esta sesión con un modelo de banda MEDIO. Lee `reparto/proyecto.md` y
> `reparto/_ESTADO.md`, lista `reparto/hechos/`, reclama una tarea libre de esa banda
> siguiendo el protocolo del tablón y dime cuál has cogido y con qué identificador de
> sesión.
