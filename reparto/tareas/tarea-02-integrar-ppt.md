# Tarea 02 · Integrar la línea `variantes-ppt` en `main` (PR #2 → #3 → #1)

Actualizado: 2026-08-24
Precondición: ninguna · Disparo: MANUAL
Duración esperada: 1 h · Banda de modelo: MEDIO
Salida (dueña exclusiva): `main` en `origin` (y el worktree `integracion-ppt`)

Puede ir en paralelo con la 01: no comparten ni un fichero (esta tarea trabaja en
`origin` y en el worktree aislado; la 01, en el árbol compartido y su rama nueva).

## Antes de empezar
1. Lee `reparto/_ESTADO.md` y lista `reparto/hechos/`.
2. `date -u`, genera tu `sid`, reclama en `reparto/hechos/reclamos/02--<sid>.md`
   (caduca: +2 h, mínimo 45 min → usa 2 h), `sleep 30` y vuelve a mirar.
3. Comprobación barata: `gh pr list` — si las PR #2, #3 y #1 ya están mezcladas, la
   tarea puede estar hecha; mira `hechos/terminadas/` y `git log origin/main`.

## Objetivo
Publicar en `main` las cuatro modalidades tipo Piedra-papel-tijera, su IA y las
teselaciones, que están verificadas juntas en la rama `integracion-ppt` pero no
publicadas. Todo el detalle del trabajo está en `traspaso-variantes-ppt.md`.

## Qué hay que hacer
1. Mezclar en `main`, **por orden: PR #2 (`variantes-ppt`) → #3 (`ia-ppt`) → #1
   (`topologias-teselacion`)**. Están verificadas juntas; no hace falta volver a
   probarlas entre mezcla y mezcla. `ia-ppt` era avance rápido de `main` viejo y
   `topologias-teselacion` mezcló limpia el 2026-08-24. Hazlo con `gh pr merge` o con
   merges desde el worktree — nunca desde el árbol compartido.
2. Rebasar sobre ese `main` nuevo los dos commits propios del worktree
   `integracion-ppt` —`a134a7d` (tabla PPT aparte en el PDF de valores) y `bd992e0`
   (`test-modalidades.js` + README)— y publicarlos en `main`.
3. Desde el worktree, sobre el `main` final: `node test-modalidades.js` y
   `node test-rps.js`. Si hay tiempo, `node test-ia-rps.js` en segundo plano (tarda
   mucho: juega partidas enteras; no lo des por colgado).
4. Push de `main` a `origin` si algún paso lo dejó solo en local.

## Datos de entrada
- `traspaso-variantes-ppt.md` — raíz del repo: estado, decisiones, descartes.
- `.claude/worktrees/integracion-ppt/` — worktree con las tres PR mezcladas, pruebas en
  verde y los dos commits propios. Su rama está en `origin`.

## Salida esperada
`origin/main` contiene las tres PR y los dos commits propios. Las PR #1, #2 y #3
cerradas como mezcladas.

## Cómo saber que ha terminado
`gh pr list` sin las #1, #2, #3 abiertas; `git log origin/main --oneline -15` enseña
la línea PPT y los dos commits; `node test-modalidades.js` y `node test-rps.js` en
verde sobre `origin/main`.

## Al terminar
1. Verifica lo de arriba.
2. `reparto/hechos/terminadas/02--<sid>.md` con los hashes finales y la hora.
3. `CERRADA` en tu reclamo.
4. Incidencias si las hubo.
5. Regenera `reparto/_ESTADO.md` (la 03 pasa a PENDIENTE; la 04, si la 01 está LISTA);
   `git add reparto/`, commit y push.
6. Dile a Juan Luis qué tareas quedan libres y con qué banda.

## Trampas conocidas
- Git tarda 1-3 minutos por orden: segundo plano y órdenes encadenadas.
- **El árbol de trabajo de `main` (la carpeta raíz del repo) NO se toca**: tiene los
  cambios sin commitear de los demás trabajos hasta que la 01 y la 04 terminen. Todo se
  hace vía `gh`, `origin` y el worktree.
- No actualices la rama `main` local (ni fetch+merge sobre ella): dejaría el árbol
  compartido a medio camino. `main` local se pone al día en la tarea 04.
- El PDF `docs/valores-piezas.pdf` automezclado ya se comprobó byte a byte idéntico a
  una regeneración limpia: no regenerarlo por si acaso (descartado en el traspaso).

## Prohibido
- Tocar la arena de posiciones o la rama `posiciones-ppt`: eso es la tarea 03.
- Renombrar o renumerar nada de las ramas al integrar (descartado: los PR se refieren
  entre sí).
- Cualquier orden git que modifique el árbol de trabajo compartido.
