# Tarea 09 · Limpieza de restos y duplicados del repositorio

Actualizado: 2026-08-24
Precondición: tarea 01 LISTA **y las dos casillas de firma de
`reparto/autorizaciones.md` firmadas** · Disparo: MANUAL
Duración esperada: 1 h · Banda de modelo: BAJO
Salida (dueña exclusiva): `reparto/_papelera/` (y el commit de retirada en `main` si
algo estaba tracked)

## Antes de empezar
1. Lee `reparto/_ESTADO.md`, lista `reparto/hechos/`, comprueba la terminada de la 01.
2. **Lee `reparto/autorizaciones.md`**: si alguna de las dos casillas no está firmada,
   para y dilo. No hay otra manera de desbloquear esta tarea.
3. `date -u`, `sid`, reclamo `09--<sid>.md` (caduca: +2 h), `sleep 30`, volver a mirar.

## Objetivo
Retirar del árbol lo que ningún trabajo reclama: los ocho ficheros de depuración del
editor y los duplicados « 2» de la sincronización. Ningún traspaso los menciona;
aparecieron por su cuenta, y por eso hicieron falta las firmas.

## Qué hay que hacer
1. **Con la casilla 1 firmada** — mover a `reparto/_papelera/` los ocho ficheros:
   `check-init.html`, `diagnose.html`, `editor-debug.html`, `editor-test.html`,
   `editor-v2.html`, `editor-with-logs.html`, `test-init.js`, `test-load.html`.
2. **Con la casilla 2 firmada** — para cada duplicado, primero `diff` con su original:
   - `scripts/cerrar-sesion 2.sh` ↔ `scripts/cerrar-sesion.sh`
   - `scripts/listar-sesiones 2.sh` ↔ `scripts/listar-sesiones.sh`
   - `scripts/nueva-sesion 2.sh` ↔ `scripts/nueva-sesion.sh`
   - `entrenamiento/libro-trigonal 2.json` ↔ `entrenamiento/libro-trigonal.json`
   Si el diff es vacío o el « 2» es un subconjunto viejo: a `reparto/_papelera/`. Si
   hay contenido propio en el « 2»: NO lo muevas; escribe la diferencia en
   `reparto/hechos/incidencias/<sid>.md` y díselo a Juan Luis — consolidar contenido
   divergente no es de banda BAJA.
3. Anotar en el informe qué se movió y qué no, y por qué.

## Datos de entrada
- `reparto/autorizaciones.md` — las firmas.
- `reparto/hechos/terminadas/01--*.md` — por si la 01 anotó hunks sin dueño que
  también haya que considerar restos.

## Salida esperada
Los ficheros firmados en `reparto/_papelera/` (que NO se commitea) y
`reparto/_papelera/movidos-<sid>.md` con la lista, con su marcador `.ok-<sid>`.

## Cómo saber que ha terminado
`git status --short` en la raíz ya no enseña ninguno de los ficheros firmados; la
papelera los contiene todos; el diff de cada « 2» quedó registrado.

## Al terminar
Cierre estándar: terminada `09--<sid>.md`, `CERRADA`, incidencias, regenerar tablón,
`git add reparto/` + commit + push (la papelera queda fuera del add: su contenido no se
commitea), y decírselo a Juan Luis — la papelera la vacía él desde el Finder.

## Trampas conocidas
- Los « 2» los crean iCloud/Drive al chocar dos versiones: no pisan, duplican. Por eso
  el diff previo es obligatorio: puede haber trabajo de alguien dentro.
- `git status` con nombres con espacio: comilla las rutas.

## Prohibido
- Borrar nada (`rm`): aquí «borrar» es mover a `reparto/_papelera/`, y la vacía Juan
  Luis.
- Vaciar la papelera.
- Mover un « 2» con diferencias reales sin registrarlas antes.
- Tocar ficheros que no estén en la lista firmada.
