# Tarea 04 · Reconciliar el vaciado con el `main` nuevo

Actualizado: 2026-08-24
Precondición: tareas 01 y 02 LISTAS · Disparo: MANUAL
Duración esperada: 2 h · Banda de modelo: ALTO
Salida (dueña exclusiva): `main` en `origin`, y `reparto/salidas/04-reconciliacion/`

Banda ALTA porque aquí se pagan todos los choques del reparto: cinco ficheros tocados
por dos o más trabajos, y al final un `reset --hard` del árbol compartido que solo es
seguro si antes se ha comprobado que no queda nada sin commitear que valga.

## Antes de empezar
1. Lee `reparto/_ESTADO.md`, lista `reparto/hechos/` y comprueba las terminadas de la
   01 y la 02 (léelas: la de la 01 dice qué hunks quedaron sin dueño).
2. `date -u`, `sid`, reclamo `04--<sid>.md` (caduca: +4 h), `sleep 30`, volver a mirar.
3. Si la 03 ya cerró, `origin/main` incluye también los setups: mergea sobre lo último.

## Objetivo
Juntar las dos líneas que hasta aquí avanzaron en paralelo: `vaciado-arbol` (los
trabajos del árbol compartido, tarea 01) y el `main` nuevo con la línea PPT (tarea 02),
resolviendo los choques conocidos. Al terminar, el árbol compartido queda limpio sobre
el `main` definitivo y las tareas de interfaz (05, 07) pueden por fin editar ficheros
directamente.

## Qué hay que hacer
1. **En un worktree nuevo** (rama `reconciliacion` desde `origin/main`), mergear
   `vaciado-arbol`. Los choques esperados, medidos el 2026-08-24:

   | Fichero | Quién lo toca | Resolución |
   |---|---|---|
   | `sw.js` | PPT y problemas-imagen suben `VERSION` a v5 los dos | Una sola versión final, superior a la de `origin/main` (v6 si main ya va por v5), y la **unión** de las listas `FICHEROS` |
   | `index.html` | PPT + problemas-imagen (etiqueta script) | Unión del marcado; `problema-imagen.js` al final. Los ganchos de la pestaña Problemas NO van aquí: son la 05 |
   | `rules.js` | PPT (capturas, `kingless`) y editar-tablero (`applyEdit` y cía.) | Dos juegos de funciones en regiones distintas: unión |
   | `ai.js` | PPT (`evaluateRps`) y editar-tablero (`searchState`) | Igual: unión |
   | `README.md` | PPT y problemas-imagen | Secciones nuevas en sitios distintos: unión |

2. Verificar el resultado: `node --check` de cada `.js` mezclado, y las pruebas
   `node test-rps.js`, `node test-modalidades.js`, `node test-edicion.js` (y
   `test-ia-rps.js` en segundo plano si hay tiempo).
3. Mezclar `reconciliacion` en `main` y push a `origin`.
4. **Limpiar el árbol compartido**, y solo ahora:
   a. `git diff > reparto/salidas/04-reconciliacion/diff-residual-<sid>.txt` (más su
      marcador `.ok-<sid>`): la foto de lo que el árbol aún difiere de `main` local.
   b. Comprueba contra la terminada de la 01 que todo lo residual es o bien hunks sin
      dueño ya anotados, o bien ficheros de la 09. Si aparece algo más, páralo todo y
      anótalo en incidencias antes de seguir.
   c. `git fetch origin && git reset --hard origin/main` en la raíz del repo. Los
      untracked no se borran: los de la 09 siguen ahí, y los ficheros ya commiteados
      pasan a tracked limpios.
5. Después del reset, `ls reparto/hechos/` para confirmar que `reparto/` sigue intacto
   (está commiteado; el reset no debe llevárselo — si `reparto/` no estaba en
   `origin/main`, NO hagas el reset hasta commitearlo).

## Datos de entrada
- `reparto/hechos/terminadas/01--*.md` y `02--*.md` — qué se commiteó y qué quedó fuera.
- La tabla de choques de `traspaso-reparto-ajedrez.md` (sección «Los choques que la 04
  tiene que resolver»).

## Salida esperada
`origin/main` con todo lo de `vaciado-arbol` + PPT mezclado y verificado; el árbol
compartido limpio sobre ese `main`; el diff residual archivado en
`reparto/salidas/04-reconciliacion/` con su marcador.

## Cómo saber que ha terminado
`git status --short` en la raíz enseña solo los untracked de la 09 (y `reparto/` si
algo quedó sin commitear); las cuatro pruebas de node en verde sobre `main`;
`git log origin/main` contiene los commits del vaciado y de PPT.

## Al terminar
Cierre estándar: terminada `04--<sid>.md` (con el recuento de choques resueltos),
`CERRADA`, incidencias, regenerar tablón (la 05 pasa a PENDIENTE), `git add reparto/`
+ commit + push, y decir a Juan Luis qué queda libre y con qué banda.

## Trampas conocidas
- Git tarda 1-3 minutos por orden; el merge y el reset, más. Estira `caduca:` antes.
- `docs/valores-piezas.pdf` puede automezclarse como texto: si choca, se regenera con
  `node entrenamiento/valores-pdf.js` (la memoria del proyecto tiene el encargo
  permanente de regenerarlo cuando cambien los valores).
- El `reset --hard` es la única orden destructiva legítima de todo el reparto, y solo
  tras el paso 4b. No hay autorización que firmar porque no destruye nada que no esté
  ya en git — pero el paso 4b es lo que lo garantiza, no te lo saltes.

## Prohibido
- Resolver un conflicto descartando el lado que no entiendes: cada choque de la tabla
  tiene su resolución escrita.
- El `reset --hard` antes de la 4a y la 4b.
- Tocar `script.js` más allá de lo que pida el merge: los ganchos de problemas son de
  la 05.
