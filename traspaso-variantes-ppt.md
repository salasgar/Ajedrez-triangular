# Traspaso — variantes-ppt

Actualizado: 2026-08-24 · Sesiones previas: 2

## Objetivo
Añadir a la app las 4 modalidades de tipo "Piedra, papel y tijera" descritas por Juan
Luis en `Nuevas variantes del juego.txt` (rps, rpsls, rps-rey, rpsls-rey), con IA que
las juegue bien, posiciones iniciales equilibradas medidas en la arena, y la base para
jugarlas en otras teselaciones (cuadrada, hexagonal, ladrillos).

Este trabajo es la tarea 02 (y la 03) del reparto general del repositorio. El contexto
de ese reparto está en `traspaso-reparto-ajedrez.md`.

## Estado actual

**Las tres PR están integradas y verificadas en una rama, pero NO en `main`.** Lo que
falta es publicarlas.

| PR | Rama | Contenido | Estado |
|---|---|---|---|
| #2 | `variantes-ppt` | Las 4 modalidades, ganchos `captures`/`kingless`/`wiped`, UI, iconos SVG, test-rps.js | Abierta, verificada |
| #3 | `ia-ppt` | Valores dinámicos (`evaluateRps`), evaluación kingless, 3 bugs de base, test-ia-rps.js | Abierta, verificada |
| #1 | `topologias-teselacion` | `tessellations.js`: square8/hexhex4/brick8 y 3 modalidades de demostración | Abierta, verificada |
| — | `posiciones-ppt` | Arena de setups iniciales | **Sin commits propios; la arena aún corría a las 17:48Z del 2026-08-24** |

### Lo que se verificó el 2026-08-24 en el worktree `integracion-ppt`

La rama `integracion-ppt` (en `origin`) contiene `main` + las tres PR ya mezcladas. El
worktree está en `.claude/worktrees/integracion-ppt/`.

- `ia-ppt` resultó ser un avance rápido de `main`: las PR #2 y #3 se integran sin mezcla.
- `topologias-teselacion` mezcló **limpia, sin un solo conflicto**. Los roces que el
  traspaso anterior daba por seguros (`variants.js`, `sw.js`) no se dieron: tocan
  regiones distintas del fichero.
- `docs/valores-piezas.pdf` se automezcló como texto —lo que suele corromper un PDF—,
  pero se comprobó que el resultado es **byte a byte idéntico** a una regeneración
  limpia con `node entrenamiento/valores-pdf.js`. No hay que hacer nada ahí.
- `node test-rps.js` y `node test-ia-rps.js` pasan enteros sobre el árbol mezclado. El
  match de la IA dinámica contra la plana sale 4–1–1 a favor de la dinámica.
- Comprobado en Chrome sin interfaz gráfica, con captura de pantalla: las 4 modalidades
  PPT y las 3 demos de teselación se dibujan bien, y las figuras toman el color de su
  bando en los dos bandos.

### Dos commits propios que esta sesión añadió a `integracion-ppt`

- `a134a7d` — El PDF de valores saca las 4 modalidades PPT a **una tabla aparte**. Antes
  salían con la fila entera de rayas, porque no comparten ni una pieza con las clásicas
  y las columnas del PDF eran P/N/B/E/U/R/Q. Ahora tienen columnas O/A/T/L/S y una nota
  de que esos 100 son solo el valor de partida. Las demos de teselación no aparecen en
  el PDF, y no por un filtro sino porque se registran desde `tessellations.js` y el
  generador solo carga `variants.js`.
- `bd992e0` — `test-modalidades.js`, que comprueba que **las doce** modalidades arrancan
  y que las tres demos quedan fuera del selector; más el README, que no tenía
  `tessellations.js` en la tabla de ficheros ni forma de dar con las demos.

## Siguiente paso

1. **Publicar en `main`, por orden: PR #2 → #3 → #1.** Están verificadas juntas; no hace
   falta volver a probarlas entre mezcla y mezcla.
2. **Poner encima los dos commits propios** (`a134a7d` y `bd992e0`), rebasándolos sobre
   el `main` nuevo desde el worktree `integracion-ppt`.
3. **La arena de posiciones va aparte y después** (tarea 03 del reparto). Comprobar con
   `pgrep -f arena-rps` si sigue viva antes de tocarla; **no relanzarla**. Sus datos se
   escriben en `.claude/worktrees/agent-a03cff377e94e7be5/entrenamiento/rps-posiciones/`.
4. Ojo al integrar con el resto del reparto: `sw.js`, `index.html`, `rules.js`, `ai.js` y
   `README.md` los tocan también otros trabajos que están sin commitear en el árbol
   compartido. Esa reconciliación es la tarea 04 del reparto, no de aquí.

Banda de modelo para retomar: **MEDIO** — mezclar tres PR ya verificadas y rebasar dos
commits es trabajo bien especificado, pero hay que entender el código si algo choca.

## Decisiones tomadas
| Decisión | Por qué |
|---|---|
| Contrato de letras O/A/T/L/S/K y mapa `captures` por modalidad, fijado antes de lanzar sesiones | Que 4 sesiones paralelas no choquen: cada una programó contra el contrato, no contra el código de las otras |
| Regla del rey codificada dentro del mapa `captures` (sin casos especiales) | Un solo mecanismo de captura; rules.js no distingue modalidades |
| `kingless: true` → legales = pseudolegales, victoria `wiped`, sin regla de 50, posición muerta por ineliminabilidad mutua | Sin rey no hay jaque; sin la posición muerta, papeles contra papeles jugarían eternamente |
| PR apilados (#3 sobre #2) y no todos contra main | Cada sesión partía del trabajo anterior; la integración es secuencial de todos modos |
| Posiciones iniciales provisionales en listas únicas de variants.js | El txt pide experimentar; la arena las cambia tocando un solo sitio |
| Iconos SVG monocromos para las 5 figuras (no emoji) | Los emoji llevan color propio y no heredan el color del bando; mismo mecanismo que 🐘/🦄 |
| Las 4 modalidades PPT van a una tabla aparte en el PDF de valores | No comparten ni una pieza con las clásicas: en la tabla única su fila entera eran rayas, que es exacto y no dice nada |
| `test-modalidades.js` existe como prueba aparte de `test-rps.js` | Las modalidades se registran desde dos ficheros que no se conocen, `variants.js` y `tessellations.js`. Al mezclar ramas lo que se rompe no es una regla suelta sino una modalidad entera, o el filtro del selector |
| La verificación en navegador se hizo con Chrome sin interfaz gráfica y capturas | Cubre lo que node no puede —que el tablero se dibuje y las piezas tomen el color del bando— sin ocupar la pantalla de Juan Luis |

## Descartado — no volver a proponer
| Se descartó | Motivo |
|---|---|
| Setups iniciales espejo puro y/o de 20 piezas en las modalidades sin rey | Medido en la arena: casi 100% tope de jugadas o tablas |
| Montar tablón `_ESTADO.md` + `hechos/` solo para este trabajo | Sus 4 sesiones fueron agentes coordinados desde una sola sesión; git y las PR ya hacen de registro. El reparto general del repo es otra cosa y sí está justificado |
| Implementar rayos/peones (modalidades clásicas) en las teselaciones nuevas | Solo análisis en comentario de tessellations.js; fuera de alcance por ahora |
| Renombrar/renumerar cosas de las ramas al integrar | Los PR se refieren entre sí; se integra tal cual y se retoca después si hace falta |
| Regenerar el PDF de valores tras la mezcla por si se corrompió | Comprobado: el PDF automezclado es idéntico byte a byte a una regeneración limpia |
| Filtrar las demos de teselación del PDF de valores | No hace falta: el generador solo carga `variants.js` y las demos se registran desde `tessellations.js` |

## Archivos
- `Nuevas variantes del juego.txt` — el encargo original de Juan Luis, con las reglas.
- `.claude/worktrees/integracion-ppt/` — worktree con las tres PR ya mezcladas, las
  pruebas en verde y los dos commits propios. Su rama está en `origin`.
- `.claude/worktrees/agent-a03cff377e94e7be5/entrenamiento/rps-posiciones/` — los datos
  que va escribiendo la arena, en el worktree de la rama `posiciones-ppt`.
- `test-modalidades.js`, `test-rps.js`, `test-ia-rps.js` — las tres pruebas, en la rama
  `integracion-ppt`. Se ejecutan con `node <fichero>` desde ese worktree.
- `mejoras-skills.md` — evaluación de las skills reparto/traspaso.
- Ramas en `origin`: `variantes-ppt`, `ia-ppt`, `topologias-teselacion`,
  `integracion-ppt`. La rama `posiciones-ppt` es **solo local**.

## Contexto que no está en los archivos
- **`test-ia-rps.js` tarda mucho** —juega partidas enteras— y más aún mientras la arena
  ocupa cuatro núcleos. Lanzarlo en segundo plano y no darlo por colgado.
- **La arena corre en local, no en la nube**, al contrario de lo que decía el traspaso
  anterior: son cuatro procesos `node entrenamiento/arena-rps.js` en el Mac de Juan Luis.
- **El árbol de trabajo de `main` tiene cambios sin commitear de otras sesiones.** Todo
  este trabajo se hizo en un worktree aparte y no lo tocó. Al integrar, seguir igual.
- **Git tarda entre uno y tres minutos por orden en este repositorio.**
- **La equivalencia de bandas el 2026-08-24**: ALTO = Opus, MEDIO = Sonnet, BAJO = Haiku.
