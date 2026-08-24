# Tarea 01 · Vaciar el árbol compartido a git, un commit por trabajo

Actualizado: 2026-08-24
Precondición: ninguna · Disparo: MANUAL
Duración esperada: 3 h · Banda de modelo: ALTO
Salida (dueña exclusiva): la rama `vaciado-arbol`, local y en `origin`

La duración esperada no es informativa: de ella sale la caducidad del reclamo (6 h).
La banda es ALTA por un motivo concreto: hay que separar hunks ajenos dentro de
ficheros compartidos, y equivocarse ahí ya pasó una vez —un `git add index.html
script.js` arrastró a `main` 82 líneas de otra sesión sin su CSS; está contado en
`traspaso-insignia-captura.md`—.

## Antes de empezar
1. Lee `reparto/_ESTADO.md` entero y lista `reparto/hechos/`.
2. `date -u` y genera tu `sid`.
3. Abre `reparto/hechos/reclamos/01--<sid>.md` con su `caduca:` calculado (+6 h).
4. `sleep 30 && ls reparto/hechos/reclamos/` — el comando, no la intención. Si hay otro
   reclamo vivo de la 01, gana el más antiguo; el que pierde escribe `CEDIDA`.
5. Comprueba si la rama `vaciado-arbol` ya existe (`git branch -a`): si existe, otra
   sesión empezó; mira qué commits tiene y continúa por idempotencia, no desde cero.

## Objetivo
Cuatro trabajos viven sin commitear, en una sola copia, en un árbol que comparten seis
sesiones; cualquier `git checkout` descuidado se los lleva. Esta tarea los vacía a git,
un commit por trabajo, en la rama `vaciado-arbol`, y la pushea. Es la única tarea que
reduce riesgo en vez de añadir función, y hasta que no está hecha ninguna otra puede
tener dueño único de salida. Es manual porque exige atribuir cada hunk a su trabajo.

## Siguiente paso
Comprobación barata: `git status --short` debe seguir enseñando ~16 ficheros
modificados y ~35 sin trackear (inventario del 2026-08-24). Si el árbol está ya limpio
o casi, la tarea puede estar hecha: mira `hechos/terminadas/` y la rama antes de nada.

## Qué hay que hacer

**Regla de oro: no mover HEAD ni tocar el árbol de trabajo.** Los commits se hacen
construyendo el índice y escribiendo la rama con plumbing:

```bash
# 1. construir el índice del commit (partiendo de HEAD limpio):
git reset                                  # índice = HEAD, árbol intacto
git add <ficheros-nuevos-del-trabajo>      # untracked enteros: seguro
# para hunks parciales de un fichero tracked (receta de la memoria
# commit-parcial-arbol-compartido.md):
git diff <fichero> > f.patch               # grep -n "^@@" f.patch lista los hunks
sed -n '1,4p;<rango-del-hunk>p' f.patch > propio.patch
git apply --cached --check propio.patch && git apply --cached propio.patch
# 2. verificar el contenido del índice, que no existe en disco:
git show :<fichero.js> > /tmp/v.js && node --check /tmp/v.js
# 3. commit sin mover HEAD:
tree=$(git write-tree)
c=$(git commit-tree "$tree" -p <padre> -m "mensaje")   # padre: ca04315 el 1º, luego el commit anterior
git update-ref refs/heads/vaciado-arbol "$c"
git reset                                  # deja el índice como HEAD otra vez
```

Un commit por trabajo, apilados sobre `ca04315` (el `main` local), en este orden y con
esta atribución (verifícala contra el diff real; los números de línea habrán bailado):

1. **problemas** — `problemas.js`, `problemas-ui.js`, `problemas.css` (untracked
   enteros). Nada más: sus ganchos de `index.html`/`script.js` NO existen aún (son la
   tarea 05).
2. **problemas-imagen** — `problema-imagen.js`, `crear-problema.js` (untracked); hunks
   en `editor.html` (carga de `ai.js`, `problemas.js`, `problema-imagen.js`,
   `crear-problema.js` tras `editor.js`), `sw.js` (VERSION v5 + cinco ficheros en
   FICHEROS), `README.md` (sección «Problemas en imagen» y dos filas de la tabla
   «Estructura»), `index.html` (una etiqueta script de `problema-imagen.js` al final).
   Detalle en `traspaso-problemas-imagen.md`.
3. **editar-tablero** — hunks en `rules.js` (`lastEditIndex`, `evaluateStatus`,
   `capturedFromBoard`, `positionProblem`, `applyEdit`) y `ai.js` (`searchState` y
   `stateAtIndex` cortan en `lastEditIndex`); `test-edicion.js` (untracked). Tras el
   commit: `git show :rules.js` y `:ai.js` a fichero y `node test-edicion.js` contra
   ese contenido si es viable; como mínimo `node --check`. Detalle en
   `traspaso-editar-tablero.md`.
4. **insignia-captura** — SOLO el hunk de `style.css` con el bloque `.captura-*`
   (~52 líneas; era `@@ -765,6 +765,58` el 2026-08-24, recalcula). Los otros dos hunks
   de `style.css` son de otros trabajos: no van aquí. Detalle en
   `traspaso-insignia-captura.md`.
5. **entrenamiento** — `entrenamiento/*.js`, `entrenamiento/*.sh`, `tune-values.js`,
   `entrenamiento/libro-*.json` (el « 2» NO: es de la tarea 09),
   `entrenamiento/r13/ r14/ r15/`, `entrenamiento/pre-commit.sh`. Antes de commitear,
   comprueba si el servicio de entrenamiento sigue escribiendo
   (`launchctl list | grep -i ajedrez`, `pgrep -f entrenamiento`): si escribe, commitea
   igual el snapshot pero anótalo en el mensaje; los ficheros de ronda son de añadir.
6. **material del proyecto** — `Nuevas variantes del juego.txt`,
   `docs/reglamento.pdf`, `mejoras-skills.md`, `reparto.skill`, `traspaso.skill`, y los
   hunks de `.gitignore` si el diff deja claro a qué van. Si algo no se sabe de quién
   es, NO se commitea: se anota en `hechos/incidencias/<sid>.md`.

Quedan fuera a propósito: los ocho ficheros de depuración del editor y los duplicados
« 2» (tarea 09, bajo firma), y los hunks de `editor.js` y los dos restantes de
`style.css` cuyo dueño no esté claro — inspecciona el diff; si identificas el trabajo,
al commit de ese trabajo; si no, fuera y a incidencias.

Al final: `git push origin vaciado-arbol` (estira antes tu `caduca:`: git aquí tarda
minutos).

## Datos de entrada
- `traspaso-problemas.md`, `traspaso-problemas-imagen.md`, `traspaso-editar-tablero.md`,
  `traspaso-insignia-captura.md` — raíz del repo; dicen qué fichero es de quién.
- Memoria del proyecto `commit-parcial-arbol-compartido.md` — la receta, ya copiada arriba.

## Salida esperada
La rama `vaciado-arbol` en local y en `origin`, con un commit por bloque de los de
arriba (5 o 6). El árbol de trabajo queda intacto: `git status` seguirá enseñando los
ficheros como modificados respecto a `main`, y es correcto.

## Cómo saber que ha terminado
`git diff vaciado-arbol` (árbol contra la rama) no contiene ya ninguno de los hunks
atribuidos: solo quedan, como mucho, hunks sin dueño anotados en incidencias y los
ficheros de la 09. Y `git log ca04315..vaciado-arbol --oneline` enseña un commit por
trabajo. `origin/vaciado-arbol` existe.

## Al terminar
1. Verifica lo de arriba.
2. Escribe `reparto/hechos/terminadas/01--<sid>.md` con la lista de commits (hash +
   trabajo), qué hunks quedaron sin dueño y la hora.
3. Añade `CERRADA` a tu reclamo.
4. Choques → `reparto/hechos/incidencias/<sid>.md`.
5. Regenera `reparto/_ESTADO.md` (recopiando la columna Banda de los ficheros de
   tarea); la 04 pasa a PENDIENTE si la 02 está LISTA, y la 09 a «espera firma».
   `git add reparto/ && git commit` (solo reparto/) y push.
6. Trampas nuevas → aquí abajo.
7. Dile a Juan Luis qué tareas quedan libres y con qué banda.

## Trampas conocidas
- Git tarda 1-3 minutos por orden en este repo: encadena las órdenes en una sola
  llamada, lánzalas en segundo plano y vigila `.git/index.lock`.
- `git add -p` es interactivo y este entorno no lo admite: usa la receta del parche
  filtrado de arriba.
- Tras `git apply --cached`, `git status` sigue enseñando el fichero modificado: es el
  resto de hunks de otros trabajos, no un fallo.
- `node --check` sobre el contenido del índice es la única forma de ver que un commit
  parcial es coherente (que no llame a una función que vivía en un hunk descartado).
- El PDF `docs/reglamento.pdf` es binario: entero o nada.

## Prohibido
- `git add` de un fichero tracked-modificado entero sin haber mirado su diff.
- `git checkout`, `git switch`, `git stash` o `git reset --hard`: mueven o vacían el
  árbol que las demás sesiones comparten.
- Commitear los duplicados « 2», los ocho ficheros de depuración o cualquier hunk cuyo
  dueño no esté claro.
- Editar ficheros del árbol: esta tarea solo lee el árbol y escribe en git.
