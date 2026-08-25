# Traspaso — reparto-ajedrez

Actualizado: 2026-08-25 09:05Z · Sesiones previas: 3

## Objetivo

Terminar los trabajos a medias del repositorio
`/Users/salasgar/Documents/git/Ajedrez-triangular` aplicando la skill `reparto`.
Encargo de Juan Luis del 2026-08-24 (seis trabajos, decisiones delegadas), ampliado el
2026-08-25 con cuatro problemas reportados por él (tareas 11-13), su sugerencia de
cosechar problemas de partidas motor contra motor (tarea 14) y un hallazgo de la
verificación (tarea 15).

## Estado actual

**12 de las 15 tareas están LISTAS.** El estado por tarea vive en el tablón
`reparto/_ESTADO.md` (fuente de verdad: `reparto/hechos/`), y este archivo no lo
repite. De un vistazo, a 2026-08-25 09:05Z (`main` = `origin/main`):

- **LISTAS: 01-09, 11, 12 y 15.** Incluye toda la tanda original más la arena de
  posiciones PPT (03), la ayuda por modalidad (11), los problemas bien planteados (12),
  el arreglo del editor sin conexión (15) y la limpieza (09, con las firmas ya
  marcadas).
- **RELEVABLE: 13** (la IA no captura gratis en las modalidades PPT) — su sesión murió
  sin empezar; reclamo caducado, `ai*.js` limpio. Es el único de los cuatro problemas
  reportados por Juan Luis el 2026-08-25 que sigue sin atacar.
- **LIBRES: 10** (aplicar la ronda 15 del entrenamiento a los valores de piezas + PDF)
  y **14** (cosecha de problemas de partidas; su precondición, la 12, ya está LISTA).

## Siguiente paso

Relanzar la **13** con la frase de abajo (banda MEDIO): reclamo nuevo con `releva a:`
apuntando al caducado de `04eac74c`, como dice el protocolo. La 10 y la 14 pueden ir
en paralelo con ella (MEDIO también); las tres no comparten ficheros.

Banda de modelo para retomar: **MEDIO** — depurar el motor, aplicar valores medidos y
programar la cosecha: todo bien especificado en sus fichas de tarea.

## Decisiones tomadas

| Decisión | Por qué |
|---|---|
| El corte del reparto: tareas por dependencias, no por temas | Regla de la skill; el detalle, en `reparto/proyecto.md` |
| Las tareas nuevas se añaden al final (11-15), nunca se renumera | Los números están citados en fichas, reclamos y hechos; renumerar los deja apuntando a otra cosa en silencio |
| Los fallos 3 y 4 de Juan Luis (minimalidad y soluciones múltiples) fueron UNA tarea (12), no dos | Ambos viven en el verificador de `problemas.js`: dos tareas paralelas tendrían el mismo fichero con dos escritores |
| `rps` y `rpsls` se quedan con el setup `base`, ya no provisional | Segunda tanda de arena (96 partidas, 2026-08-25): las 6 candidatas alternativas dan 69-94 % de tablas; `base` tiene el mejor reparto en ambas. Tabla y razonamiento en `entrenamiento/rps-posiciones-resumen.md` |
| El descarte «20 piezas sin rey agotan el tope de jugadas» quedó obsoleto | Los datos muestran que sin rey TODAS las candidatas agotan el tope, tengan 9 o 20 piezas: es de la modalidad, no del setup |
| La precondición de la 13 se relajó a «03 sin reclamo vivo» | Los setups con rey (donde Juan Luis vio el fallo de la IA) quedaron medidos y publicados antes de cerrar la 03 entera |
| `hechos/` mínimo, en el árbol del repo, commiteado como copia de seguridad | Todas las sesiones son locales y comparten el árbol; git registra lo demás |
| Los `traspaso-*.md` se commitean al repo | Delegación expresa del 2026-08-24; reversible |
| `tablas` restringido a fácil y medio | Solo se fuerza en una jugada; copaba el almacén. Revocable en `autorizaciones.md` |

## Descartado — no volver a proponer

| Se descartó | Motivo |
|---|---|
| Diseñar candidatas nuevas de posición inicial para `rps`/`rpsls` | El problema real no es la posición: sin rey ninguna partida acaba de forma natural. Si se ataca, es tocando condiciones de victoria (decisión de Juan Luis, tarea nueva), no con más arena |
| Completar la medición de `rpsls · ciclo-giro` (quedó con 3 partidas) | Es de 20 piezas, descartada por criterio: gastar máquina en ella no cambia nada |
| Repetir la mitad con-rey de la 03 al retomarla | Idempotencia: `rps-rey`/`rpsls-rey` quedaron medidos, decididos y publicados; está escrito en su terminada |
| Rediseñar el verificador de problemas por los fallos 3 y 4 | La 12 probó >500 problemas frescos sin reproducirlos: el diseño ya era correcto; solo hubo un desajuste de presupuesto (arreglado). Detalle en `reparto/hechos/notas/s-20260824T235458-3ccd1290.md` |
| Reverificar el almacén completo del navegador al abrir la pestaña | Carísimo en cada apertura; la 12 lo resolvió verificando al importar (`probVerificaForzado`) |
| `git add` por nombre de un fichero tracked-modificado sin mirar su diff | Causó el fallo histórico de la insignia; la costumbre se queda |
| `sleep` en primer plano para la espera del protocolo | El harness lo bloquea; va con `run_in_background` |
| Forzar el desbloqueo de una reserva del harness sobre `_ESTADO.md` | Caducan solas a los 30 min de inactividad; esperar (con un vigilante en segundo plano) evitó pisar a la otra sesión las dos veces que pasó |

## Archivos

- `reparto/_ESTADO.md` — el tablón; empieza por aquí.
- `reparto/proyecto.md` — ficha fija: rutas, bandas (ALTO=Fable 5, MEDIO=Sonnet 5,
  BAJO=Haiku 4.5 a 2026-08-24), reglas del repo, frase de arranque y decisiones de
  reparto.
- `reparto/tareas/tarea-NN-*.md` — las quince fichas de tarea.
- `reparto/hechos/` — reclamos, terminadas, fallos, incidencias, notas (fuente de
  verdad).
- `reparto/autorizaciones.md` — firmas de Juan Luis; solo lo edita él.
- `entrenamiento/rps-posiciones-resumen.md` — la arena entera: datos, decisión y la
  cuestión abierta de las condiciones de victoria sin rey.
- Los seis `traspaso-*.md` de los trabajos originales — solo lectura.
- `stash@{0}` en `main` — respaldo de la reconciliación (04); ya innecesario, lo tira
  Juan Luis cuando quiera.

## Contexto que no está en los archivos

- Git tarda 1-3 minutos por orden en este repo: en segundo plano y encadenado.
- Los problemas mal planteados que vio Juan Luis son con toda probabilidad antiguos,
  del almacén en `localStorage` de su navegador (generados antes de los arreglos de la
  06): el código actual no los reproduce. Si le sale uno con un problema RECIÉN
  generado, eso sí sería motivo para reabrir la 12.
- Queda abierta, sin prisa y sin tarea, la cuestión de diseño de la 03: en `rps` y
  `rpsls` (sin rey) ninguna partida termina de forma natural; arreglarlo sería tocar
  las condiciones de victoria de la modalidad. La decisión es de Juan Luis.
- «Firmar» en `autorizaciones.md` = marcar la casilla `[x]`, no solo poner nombre y
  fecha: la ambigüedad de una casilla vacía con firma debajo ya paró la 09 una vez
  (2026-08-25, resuelto cuando Juan Luis marcó las casillas).
- Dos sesiones de trabajo (la primera 09 y la primera 13) murieron en silencio la
  noche del 2026-08-24 al 25, sin fallo escrito. No es avería del reparto: los
  reclamos caducados se relevan y ya está.

---

Lo primero que hará la sesión nueva: leer el tablón y relevar la tarea 13.

Banda para abrirla: **MEDIO** — depurar con las hipótesis ya escritas en la ficha.

Frase para cada sesión de trabajo (13, 10 y 14 pueden ir a la vez, cambiando el
número):

> Trabaja en el reparto del repositorio
> `/Users/salasgar/Documents/git/Ajedrez-triangular`, carpeta `reparto/`. He abierto
> esta sesión con un modelo de banda MEDIO. Lee `reparto/proyecto.md` y
> `reparto/_ESTADO.md`, lista `reparto/hechos/`, y reclama la tarea 13 siguiendo el
> protocolo del tablón (si está cogida, coge otra libre de banda MEDIO). Dime cuál has
> cogido y con qué identificador de sesión.
