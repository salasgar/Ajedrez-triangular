# Tarea 03 · Cerrar la arena de posiciones PPT e integrar sus resultados

Actualizado: 2026-08-24
Precondición: tarea 02 LISTA · Disparo: MANUAL
Duración esperada: 2 h · Banda de modelo: MEDIO
Salida (dueña exclusiva): la rama `posiciones-ppt` y, tras el merge, `main` en `origin`

## Antes de empezar
1. Lee `reparto/_ESTADO.md` y lista `reparto/hechos/`; comprueba que la 02 tiene su
   fichero en `hechos/terminadas/`.
2. `date -u`, `sid`, reclamo `03--<sid>.md` (caduca: +4 h), `sleep 30`, volver a mirar.
3. Comprobación barata: `pgrep -f arena-rps` debe seguir vacío (la arena terminó; se
   comprobó el 2026-08-24 a las 18:00Z). Si hay procesos, algo la relanzó: NO la mates,
   anota la incidencia y consulta a Juan Luis.

## Objetivo
La arena midió posiciones iniciales para las 4 modalidades PPT (las provisionales
estaban puestas a ojo en listas únicas de `variants.js`). Hay que leer sus resultados,
elegir los setups ganadores y publicarlos. Detalle del contexto en
`traspaso-variantes-ppt.md`.

## Qué hay que hacer
1. Leer los datos de la arena en
   `.claude/worktrees/agent-a03cff377e94e7be5/entrenamiento/rps-posiciones/` (worktree
   de la rama `posiciones-ppt`, que es solo local y sin commits propios).
2. Decidir con esos números los setups iniciales de cada modalidad PPT. Criterio ya
   fijado en el traspaso: se descartaron los espejo puro y los de 20 piezas en las
   modalidades sin rey (casi 100 % tope de jugadas o tablas).
3. Aplicar los setups elegidos a las listas únicas de `variants.js` **en el worktree de
   `posiciones-ppt`** (rebasado sobre el `main` de la 02), commitear ahí también los
   datos resumidos de la arena (no gigas en bruto: el resumen que justifica la
   elección), y mezclar en `main`. Push de la rama y de `main`.
4. `node test-modalidades.js` y `node test-rps.js` sobre el resultado.

## Datos de entrada
- `.claude/worktrees/agent-a03cff377e94e7be5/entrenamiento/rps-posiciones/` — los datos.
- `traspaso-variantes-ppt.md` — decisiones y descartes sobre los setups.
- `Nuevas variantes del juego.txt` — el encargo original (pide experimentar).

## Salida esperada
`origin/main` con los setups medidos en `variants.js` y el resumen de la arena
commiteado. La rama `posiciones-ppt` pusheada a `origin` (deja de ser solo-local).

## Cómo saber que ha terminado
Las listas de setups de `variants.js` en `origin/main` ya no son las provisionales del
2026-08-24 (o hay decisión escrita de mantener alguna, con sus números); las dos
pruebas en verde; `origin/posiciones-ppt` existe.

## Al terminar
El cierre estándar: terminada `03--<sid>.md`, `CERRADA`, incidencias, regenerar el
tablón (recopiando Bandas), `git add reparto/` + commit + push, y decir a Juan Luis qué
queda libre y con qué banda.

## Trampas conocidas
- Git tarda 1-3 minutos por orden.
- No relanzar la arena: son cuatro procesos node que ocupan el Mac de Juan Luis.
- El árbol compartido de la raíz no se toca: trabajar en worktrees.
- Si la 04 ya empezó cuando esta cierre, avisa en `hechos/incidencias/` de que `main`
  se movió (la 04 mergea sobre `origin/main` y debe releerlo).

## Prohibido
- Borrar los datos en bruto de la arena (quedan en el worktree; si estorban, es
  decisión de Juan Luis).
- Relanzar procesos de arena.
