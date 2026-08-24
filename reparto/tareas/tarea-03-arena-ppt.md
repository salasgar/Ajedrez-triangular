# Tarea 03 · Cerrar la arena de posiciones PPT e integrar sus resultados

Actualizado: 2026-08-24
Precondición: tarea 02 LISTA · Disparo: MANUAL
Duración esperada: 1 h 30 (queda: solo rps y rpsls, con visto bueno de Juan Luis para
correr la arena de nuevo) · Banda de modelo: MEDIO
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

**Estado a 2026-08-24T23:26Z (sesión `s-20260824T214012-f5750bb7`, A MEDIAS):**
`rps-rey` y `rpsls-rey` YA TIENEN setup medido y publicado (`main` = `53b32e6`,
candidata `ciclo-K-espejo` en las dos). Lo que queda es solo `rps` y `rpsls` (las dos
SIN rey): la criba nunca midió sus candidatas reducidas. Detalle completo en
`entrenamiento/rps-posiciones-resumen.md` y en
`hechos/fallos/03--s-20260824T214012-f5750bb7.md`. Antes de nada, retomar exige que
Juan Luis autorice correr la arena otra vez (ver «Prohibido» más abajo) para las
candidatas que faltan.

## Qué hay que hacer (lo que queda: solo `rps` y `rpsls`)
1. Con el visto bueno de Juan Luis, correr la arena para las candidatas que faltan:
   `eq18-giro`, `fondo9-giro`, `frente11-giro`, `tijeras-flanco` en `rps`;
   `eq15-giro`, `fondo10-giro`, `frente11-giro` en `rpsls` (las demás, de 20 piezas,
   ya están descartadas por el criterio del traspaso, confirmado con los datos que sí
   hay). Mismo worktree, mismo script (`entrenamiento/arena-rps.js`, uso en su
   cabecera), con `SALIDA=` apuntando a los ficheros `criba-rps.jsonl`/
   `criba-rpsls.jsonl` que ya existen (el script reanuda).
2. Decidir con esos números (ver la hipótesis apuntada en el resumen: las candidatas
   «equilibrada» y «solo fondo» midieron mal en las -rey; puede hacer falta una
   candidata nueva, fuera de la lista actual, si ninguna de las reducidas convence).
3. Aplicar el setup elegido a `RPS_FRONT`/`RPS_BACK`/`RPSLS_FRONT`/`RPSLS_BACK` en
   `variants.js` (las de rps-rey/rpsls-rey ya están separadas, no las toques), ampliar
   `entrenamiento/rps-posiciones-resumen.md` con la decisión y sus números, y publicar
   en `main` (ver trampa de abajo sobre el worktree y el `commit-tree`/`update-ref` en
   vez de `rebase`+`checkout`).
4. `node test-modalidades.js` y `node test-rps.js` sobre el resultado (ya en verde
   para rps-rey/rpsls-rey; comprobar que sigue en verde con el cambio nuevo).

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
- **El worktree de la arena (`.claude/worktrees/agent-a03cff377e94e7be5/`) tiene
  ficheros locales sin commitear (rondas r13/r14/r15 de entrenamiento) que chocan al
  hacer `git rebase`/`checkout` sobre el `main` actual: rechaza el checkout con
  «would be overwritten». No los toques; en vez de rebasar de verdad, construir el
  commit con `git commit-tree`/`update-ref` (índice temporal vía `GIT_INDEX_FILE`,
  sin tocar el checkout) evita el problema y de paso no mueve HEAD.**
- **Tras una orden de Bash en segundo plano (`run_in_background`), el directorio de
  trabajo de la sesión puede volver a la raíz del repo en la orden siguiente, aunque
  la orden en segundo plano llevara su propio `cd`. Comprobado con `pwd` dos veces
  trabajando en este worktree. Prefija `cd <worktree>` explícito en cada orden de git,
  en primer plano y en segundo plano por igual; no te fíes del directorio persistido.**
- La arena solo mide sus candidatas de 20 piezas para `rps` y `rpsls` antes de
  pararse (la sesión que la lanzó se agotó). Los candidatos reducidos que sobreviven
  al descarte de 20-piezas-sin-rey (`eq18-giro`, `fondo9-giro`, `frente11-giro` en
  `rps`; `eq15-giro`, `fondo10-giro`, `frente11-giro` en `rpsls`) nunca se midieron.
  Detalle en `entrenamiento/rps-posiciones-resumen.md` (en `main` desde el
  2026-08-24).

## Prohibido
- Borrar los datos en bruto de la arena (quedan en el worktree; si estorban, es
  decisión de Juan Luis).
- Relanzar procesos de arena.
