# Traspaso — reparto-ajedrez

Actualizado: 2026-08-24 · Sesiones previas: 1

## Objetivo

Montar, con la skill `reparto`, el mecanismo que permita terminar los seis trabajos que
hay a medias en el repositorio `/Users/salasgar/Documents/git/Ajedrez-triangular`, cada
uno descrito en su propio `traspaso-*.md` en la raíz del repo. El encargo de Juan Luis
del 2026-08-24 fue: aplicar `reparto` a esos seis más lo que se estime que merece la
pena hacer, y contarle después cómo se ha aplicado.

Esta sesión **no** monta el reparto: Juan Luis decidió expresamente que lo monte una
sesión abierta con el modelo Fable. Lo que esta sesión deja escrito es el inventario y
el análisis previos, que es el paso 1 del método de la skill y lo más caro de rehacer.

## Estado actual

El reparto **no está montado**: no existen `_ESTADO.md`, `proyecto.md`,
`autorizaciones.md` ni `tareas/`. Lo que sí está hecho es el trabajo previo:

- Los seis `traspaso-*.md` están leídos y cotejados entre sí (ver «El corte propuesto»).
- El inventario del árbol de trabajo está medido, con fecha 2026-08-24 17:48Z.
- La línea `variantes-ppt` está integrada y verificada en una rama aparte, y es la única
  de las seis que está lista para publicarse sin más trabajo previo (ver
  `traspaso-variantes-ppt.md`).

### Inventario medido el 2026-08-24 a las 17:48Z

| Qué | Cuánto |
|---|---|
| Ficheros trackeados modificados sin commitear | 16 |
| Ficheros sin trackear | 35 |
| Sesiones de Claude registradas en `.claude/sesiones/` | 6 |
| Reclamos de fichero vivos | 0 (solo uno sobre `MEMORY.md`) |
| Ramas del trabajo PPT en `origin` | 5 |

**El dato que manda sobre todo el reparto**: cuatro de los seis trabajos viven
**sin commitear, en un único árbol de trabajo compartido**, sin copia de seguridad. Ahí
git no da aislamiento ninguno: la separación por rama o worktree que la skill `reparto`
da por supuesta en un repositorio **todavía no existe**, y no puede existir hasta que
ese árbol se vacíe a git.

**El dato que desbloquea**: a las 17:48Z **no había ningún reclamo de fichero vivo**.
`index.html`, `script.js` y `style.css` están libres. Esos reclamos son justo lo que
dejó a medias cuatro de los seis trabajos, según sus propios traspasos.

## Siguiente paso

**Montar el reparto con la skill `reparto`**, partiendo del corte propuesto más abajo
—que es una propuesta medida, no una decisión: quien monte el reparto puede cambiarla, y
si la cambia conviene que escriba por qué en `proyecto.md`.

Antes de escribir ningún fichero, tres comprobaciones que caducan rápido:

1. `git status --short` y `ls .claude/sesiones/*.json`: el inventario de arriba es del
   2026-08-24 17:48Z y hay más sesiones abiertas. Si alguien ha commiteado o ha
   reclamado ficheros, el corte cambia.
2. `gh pr list` y `git branch -a`: comprobar si las PR #1, #2 y #3 siguen abiertas.
3. `pgrep -f arena-rps`: si sigue habiendo procesos, la arena de posiciones PPT no ha
   terminado (ver `traspaso-variantes-ppt.md`).

Banda de modelo para retomar: **ALTO** — montar un reparto es, según la propia skill,
la tarea de banda ALTA del proyecto: hay que decidir un corte por dependencias que luego
sale caro cambiar.

## El corte propuesto

Nueve tareas. El criterio del corte es el de la skill: **por dependencias reales, no por
temas**. De ahí sale lo más contraintuitivo de este reparto, y conviene no deshacerlo sin
pensarlo: **tres de los seis trabajos no tienen tarea propia**, porque lo que les queda
no es programar sino verificar, y verificar se hace junto y una sola vez.

| # | Tarea | Precondición | Banda | Duración |
|---|---|---|---|---|
| 01 | Vaciar el árbol compartido a git, un commit por trabajo | ninguna | ALTO | 3 h |
| 02 | Integrar la línea `variantes-ppt` en `main` (PR #2 → #3 → #1) | ninguna | MEDIO | 1 h |
| 03 | Cerrar la arena de posiciones PPT e integrarla | 02 | MEDIO | 2 h |
| 04 | Reconciliar el vaciado con el `main` nuevo | 01 y 02 | ALTO | 2 h |
| 05 | Pestaña «Problemas» en `index.html` y `script.js` | 04 | MEDIO | 3 h |
| 06 | Rendimiento y equilibrio del almacén de problemas | 05 | MEDIO | 2 h |
| 07 | `editar-tablero` §1, §4 y §5 (toda la interfaz) | 05 | MEDIO | 4 h |
| 08 | Verificación en navegador de todo lo publicado | 05 y 07 | MEDIO | 2 h |
| 09 | Limpieza de restos y duplicados del repo | 01 + firma | BAJO | 1 h |

### Por qué la 01 va primera y sola

Es la única tarea que reduce riesgo en vez de añadir función. Cuatro trabajos existen en
una sola copia, en un árbol que comparten seis sesiones; cualquier `git checkout`
descuidado se los lleva. Y hasta que no esté hecha, ninguna otra tarea puede tener
«dueño único de salida», porque todas escribirían en el mismo árbol.

Es de banda ALTA por un motivo concreto y no por precaución genérica: hay que separar
hunks ajenos dentro de ficheros compartidos, y equivocarse ahí ya pasó una vez y produjo
el fallo que describe `traspaso-insignia-captura.md` —un `git add index.html script.js`
arrastró a `main` 82 líneas de otra sesión sin su CSS—. `git add -p` es interactivo y
este entorno no lo admite; la receta que sí funciona está en la memoria del proyecto,
en `commit-parcial-arbol-compartido.md`.

### Por qué la 01 y la 02 pueden ir a la vez

No comparten ni un fichero. La 01 trabaja en el árbol compartido local y escribe en una
rama nueva; la 02 trabaja en `origin` y en el worktree `integracion-ppt`, que ya está
aislado. Se juntan en la 04, que es donde se pagan los choques.

### Los tres trabajos que no tienen tarea propia

| Trabajo | Dónde ha ido a parar lo que le faltaba |
|---|---|
| `insignia-captura` | Su único paso era commitear el bloque `.captura-*` de `style.css`. Eso es un hunk del **vaciado (01)**, no una tarea. Comprobado: `style.css` tiene 11 líneas `.captura-*` en el árbol y `HEAD:style.css` tiene 0. La comprobación en navegador va a la **08** |
| `editor-posiciones` | Ya está en `main` (commit `ca04315`). Lo que faltaba era probar en navegador el ciclo guardar → abrir → borrar: va a la **08** |
| `problemas-imagen` | Su código está terminado y verificado. Lo único que le falta es que exista la pestaña «Problemas», que es la **05**, y comprobar el botón «Imagen (.png)», que es la **08** |

### Los choques que la 04 tiene que resolver

Medidos comparando `git diff main ia-ppt` con el árbol de trabajo:

| Fichero | Quién lo toca | El choque |
|---|---|---|
| `sw.js` | PPT, `problemas-imagen`, `editar-tablero` | **La misma línea**: los dos primeros suben `VERSION` a `v5` por su cuenta |
| `index.html` | PPT, `problemas`, `problemas-imagen`, `editar-tablero` | Cuatro trabajos añadiendo etiquetas `<script>` y marcado |
| `rules.js` | PPT (capturas, `kingless`), `editar-tablero` (`applyEdit`) | Dos juegos de funciones nuevas |
| `ai.js` | PPT (`evaluateRps`), `editar-tablero` (`searchState`) | Igual |
| `README.md` | PPT, `problemas-imagen` | Secciones nuevas en sitios distintos |
| `script.js` | `problemas` (3 ganchos), `editar-tablero` | Serializados por la precondición 05 → 07 |

### Lo que hace falta que firme Juan Luis

Van a `autorizaciones.md`, que ninguna sesión reescribe. Son cuatro y ninguna la puede
decidir una sesión sola:

1. **Borrar los ocho ficheros de depuración del editor**: `check-init.html`,
   `diagnose.html`, `editor-debug.html`, `editor-test.html`, `editor-v2.html`,
   `editor-with-logs.html`, `test-init.js`, `test-load.html`. Suman ~35 KB y parecen
   restos del worktree `fix-position-editor`, pero nadie lo ha confirmado.
2. **Qué hacer con los duplicados de sincronización**: `scripts/cerrar-sesion 2.sh`,
   `scripts/listar-sesiones 2.sh`, `scripts/nueva-sesion 2.sh` y
   `entrenamiento/libro-trigonal 2.json`. La skill `reparto` avisa de que iCloud y Drive
   no pisan sino que duplican, y que hay que consolidarlos, no ignorarlos.
3. **Si los `traspaso-*.md` se commitean, se ignoran o se mueven** a una carpeta ya
   ignorada. `traspaso-editor-posiciones.md` dice que Juan Luis dejó esto abierto a
   propósito para que lo resuelva quien retome. Hoy son **siete** y ninguno está
   commiteado; `git log --all -- 'traspaso*.md'` está vacío y `.gitignore` no los excluye.
   Estorban porque aquí `git status` se lee de verdad antes de cada commit.
4. **Qué se hace con `tablas` en los niveles altos de los problemas**: restringirlo a
   fácil y medio, o dejarlo en todos. Está sin decidir en `traspaso-problemas.md`.

### Dónde poner el tablón

Recomendación, no decisión: en `reparto/` dentro del repo, **commiteado y pusheado**. La
referencia `entorno-claude-code.md` de la skill dice que una rutina en la nube no llega
al disco del Mac, así que si alguna tarea se programa, el tablón tiene que estar en el
repositorio remoto. Y que en un repo git el tablón se reduce a lo que git no recoge: la
tabla de tareas con precondiciones y bandas, las autorizaciones y las trampas conocidas.
Con seis sesiones basta el `hechos/` mínimo que describe la skill —`reclamos/`,
`terminadas/`, `incidencias/`—, no el completo.

## Decisiones tomadas

| Decisión | Por qué |
|---|---|
| El reparto lo monta una sesión Fable, no esta | Lo pidió Juan Luis expresamente el 2026-08-24, después de que esta sesión recomendara lo contrario. Queda anotado para que la sesión Fable no lo relea como duda abierta: es una decisión cerrada |
| Esta sesión deja el inventario y el corte propuesto por escrito en vez de montar el reparto | El paso 1 del método es inventariar, y es lo más caro de rehacer en frío. Montar el mecanismo sobre un inventario ya medido es mucho más barato que medirlo otra vez |
| El corte se propone por dependencias, no por trabajo | Es la regla de la skill. De ahí que tres de los seis traspasos no tengan tarea propia: lo que les falta es verificación, y verificar cuatro veces lo mismo en el navegador es desperdicio |
| Vaciar el árbol compartido es la tarea 01 y bloquea a casi todas | Es la única que reduce riesgo. Cuatro trabajos existen en una sola copia sin respaldo, y hasta que no estén en git no hay «dueño único de salida» posible |
| La rama `integracion-ppt` se pusheó a `origin` antes de cerrar esta sesión | Existía solo en local. Un trabajo verificado que vive en una sola máquina es el mismo riesgo que el árbol sin commitear |

## Descartado — no volver a proponer

| Se descartó | Motivo |
|---|---|
| Que esta sesión (Opus) montase el reparto | Juan Luis lo decidió así el 2026-08-24 tras oír el argumento contrario. No volver a plantearlo |
| Montar el `hechos/` completo de la skill `reparto` | El repo es git y la propia referencia del entorno dice que ahí el tablón se reduce a lo que git no recoge. Basta el mínimo: `reclamos/`, `terminadas/`, `incidencias/` |
| Dar tarea propia a `insignia-captura`, `editor-posiciones` y `problemas-imagen` | Lo que les queda no es programar sino verificar, y sale una tarea de verificación conjunta (la 08) en vez de tres que abrirían el navegador para lo mismo |
| Que cada trabajo commitee sus propios hunks desde el árbol compartido | Es exactamente lo que produjo el fallo de `traspaso-insignia-captura.md`. Vacía el árbol una sola tarea, con una sola cabeza |
| Repartir con un tablón para el proyecto `variantes-ppt` por separado | Ya se descartó el 2026-08-24 y sigue valiendo: sus cuatro sesiones fueron agentes coordinados desde una sola sesión y git más las PR ya hacen de registro |

## Archivos

Los seis traspasos de los trabajos, todos en la raíz del repo:

| Ruta | Qué trabajo describe | Qué le falta |
|---|---|---|
| `traspaso-variantes-ppt.md` | Las 4 modalidades tipo Piedra, papel y tijera y las teselaciones | Integrar en `main`; la arena de posiciones sigue corriendo |
| `traspaso-problemas.md` | Motor y pestaña de problemas de ajedrez | Toda la integración en `index.html` y `script.js` |
| `traspaso-editar-tablero.md` | Editar el tablero a mitad de partida | §1, §4 y §5: toda la interfaz |
| `traspaso-problemas-imagen.md` | Descargar un problema como `.png` y crearlos desde el editor | Solo depende de que exista la pestaña «Problemas» |
| `traspaso-insignia-captura.md` | La insignia de captura, publicada a medias | Un hunk de `style.css` |
| `traspaso-editor-posiciones.md` | El editor de posiciones con nombre | Solo probarlo en navegador |

Y lo demás que hace falta:

- `mejoras-skills.md` — evaluación de las skills `reparto` y `traspaso`.
- `Nuevas variantes del juego.txt` — el encargo original de las modalidades PPT.
- `/Users/salasgar/.claude/plans/quiero-que-a-mitad-piped-rivest.md` — el plan aprobado
  de `editar-tablero`, con el detalle de §1, §4 y §5.
- `.claude/worktrees/integracion-ppt/` — worktree con la línea PPT ya integrada y
  verificada; su rama está en `origin`.
- `.claude/sesiones/*.json` — los reclamos de fichero entre sesiones. Mirarlos antes de
  tocar `index.html`, `script.js` o `style.css`.

## Contexto que no está en los archivos

- **La equivalencia de bandas el 2026-08-24**: ALTO = Opus, MEDIO = Sonnet, BAJO = Haiku.
  Va en `proyecto.md` cuando se monte el reparto, que es donde la skill quiere que viva.
- **Git tarda entre uno y tres minutos por orden en este repositorio.** Conviene lanzarlo
  en segundo plano y no encadenar órdenes que se esperen unas a otras.
- **Los ficheros de depuración y los duplicados « 2» no son de ninguno de los seis
  trabajos.** Ningún traspaso los menciona: aparecieron por su cuenta y por eso hacen
  falta una firma y una tarea aparte (la 09).
- **`traspaso-problemas.md` cita tres scripts de Node en un scratchpad de sesión**
  (`prueba-problemas.js`, `rendimiento.js`, `diagnostico.js`) y avisa de que ese
  directorio se borra solo. La tarea 06 los necesita: si ya no están, hay que rehacerlos,
  y esta vez dejarlos en `entrenamiento/`, que es lo que dice la memoria del proyecto.
