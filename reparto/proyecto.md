# FICHA DEL PROYECTO — reparto-ajedrez

Este fichero **no se regenera nunca**. Guarda lo que el tablón no puede guardar, porque
el tablón se reescribe entero cada vez que termina una tarea. Se escribió al montar el
reparto (2026-08-24, sesión `s-20260824T180039-ac278f27`) y solo cambia cuando cambia
el reparto.

Objetivo del proyecto: terminar los seis trabajos a medias del repositorio
`/Users/salasgar/Documents/git/Ajedrez-triangular`, cada uno descrito en su
`traspaso-*.md` en la raíz del repo. El análisis previo y el porqué del corte están en
`traspaso-reparto-ajedrez.md`.

## Dónde está cada cosa

| Qué | Ruta exacta | Quién llega |
|---|---|---|
| Tablón | `reparto/_ESTADO.md` | todas |
| Hechos (la fuente de verdad) | `reparto/hechos/` | **todas, obligatoriamente** |
| Ficheros de tarea | `reparto/tareas/` | todas |
| Salidas con ficheros propios | `reparto/salidas/` | solo la 08 la necesita; las demás tareas tienen su salida en git (ramas y `main`) |
| Papelera | `reparto/_papelera/` | la vacía Juan Luis a mano; su contenido NO se commitea |
| Autorizaciones | `reparto/autorizaciones.md` | las firma Juan Luis a mano |

`hechos/` está **en el árbol de trabajo del repo, en disco**, porque todas las sesiones
del reparto son locales y atendidas: comparten este mismo árbol y ven los ficheros al
instante, sin esperar a ningún push. **No puede haber dos `hechos/`.** Si algún día se
programa una tarea en la nube, antes hay que pushear `reparto/` y pasar el protocolo a
leer y escribir contra `origin`; hasta entonces, no.

La carpeta `reparto/` se commitea y se pushea como copia de seguridad: al montar, y
después cada vez que se regenera el tablón al cerrar una tarea (`git add reparto/` es
seguro: dentro solo hay ficheros del reparto). No hace falta commitear cada reclamo
suelto; los reclamos funcionan en disco.

Renombrar ficheros en este sitio: **sí** (disco local, shell completo). Un fichero de
salida en `reparto/salidas/` lleva siempre su marcador `<nombre>.ok-<sid>`; se puede
trabajar en `<nombre>.parcial-<sid>` y renombrar al final. Para las tareas cuya salida
es git, el acta de terminada es el commit o el merge, más el fichero de
`hechos/terminadas/`.

## Bandas de modelo

| Banda | Modelo en el menú | Para qué |
|---|---|---|
| ALTO | Fable 5 | Criterio, ambigüedad, irreversible, separar hunks ajenos |
| MEDIO | Sonnet 5 (u Opus 5 si pesa más el criterio que el volumen) | Integrar, programar interfaz, depurar en navegador |
| BAJO | Haiku 4.5 | Recuentos, limpieza mecánica con el criterio ya firmado |

Comprobado el 2026-08-24. Si el menú ya no tiene estos nombres, quédate con la
posición: ALTO es el más capaz que haya, BAJO el más rápido, MEDIO el de en medio.

## Automatismos activos

Ninguno. Todas las tareas son manuales: son integración de código y verificación, y
las que quedan bloqueadas lo están por firma de Juan Luis, no por espera externa. Si se
programa alguno, antes hay que mover el protocolo al remoto (ver arriba) y fijarle el
modelo según su banda al crearlo.

| Tarea programada | Cuándo | Qué hace | Duración esperada | Caducidad | Modelo | Id |
|---|---|---|---|---|---|---|

## Reglas propias de este repositorio

- **Git tarda entre uno y tres minutos por orden.** Lanzar las órdenes en segundo plano,
  encadenarlas en una sola llamada y vigilar `.git/index.lock`.
- **El árbol de trabajo lo comparten varias sesiones de Claude.** Los reclamos de
  fichero del harness viven en `.claude/sesiones/*.json`: mirarlos antes de editar
  `index.html`, `script.js` o `style.css`. Ese mecanismo convive con este reparto: los
  reclamos de tarea van en `reparto/hechos/reclamos/`, los de fichero los pone el
  harness solo.
- **Nunca `git add` por nombre de fichero tracked-modificado**: el árbol lleva hunks de
  varios trabajos. La receta de commit parcial está en la memoria del proyecto
  (`commit-parcial-arbol-compartido.md`) y copiada en `tareas/tarea-01-vaciado.md`.
- **Ningún `git checkout`/`git switch` que toque ficheros del árbol** mientras el árbol
  no esté vaciado (tarea 01 LISTA) y reconciliado (tarea 04 LISTA). Los commits en rama
  se hacen con `git write-tree` + `git commit-tree` + `git update-ref`, sin mover HEAD.

## Frase de arranque para una sesión nueva

> Trabaja en el reparto del repositorio
> `/Users/salasgar/Documents/git/Ajedrez-triangular`, carpeta `reparto/`. He abierto
> esta sesión con un modelo de banda ALTO / MEDIO / BAJO —deja solo la que sea—. Lee
> `reparto/proyecto.md` y `reparto/_ESTADO.md`, lista `reparto/hechos/`, reclama una
> tarea libre de esa banda siguiendo el protocolo del tablón y dime cuál has cogido y
> con qué identificador de sesión.

La banda va en la frase porque una sesión no puede saber en qué modelo corre. Sin ese
dato, una sesión abierta con el modelo rápido puede reclamar la tarea que exigía
criterio, y eso no falla de golpe: sale mediocre y no se nota hasta mucho después.

## Decisiones de reparto que conviene no rediscutir

- **El corte es por dependencias, no por temas**: por eso tres de los seis trabajos
  (`insignia-captura`, `editor-posiciones`, `problemas-imagen`) no tienen tarea propia
  —lo que les falta es un hunk del vaciado (01), la pestaña (05) y verificación en
  navegador (08)—. El razonamiento completo, en `traspaso-reparto-ajedrez.md`.
- **La 01 va primera y casi todo depende de ella**: cuatro trabajos viven sin commitear
  en una sola copia del árbol compartido. Hasta vaciarlo a git no hay dueño único de
  salida posible.
- **La 01 y la 02 pueden ir a la vez**: no comparten ni un fichero (la 01 escribe en la
  rama `vaciado-arbol`; la 02 en `origin` y el worktree `integracion-ppt`). Se juntan
  en la 04.
- **`hechos/` mínimo** (`reclamos/`, `terminadas/`, `incidencias/`): el repo es git y
  los merges y las PR ya hacen de registro de lo demás. Si hace falta anular una
  terminada en falso, se escribe `hechos/incidencias/<sid>.md` explicándolo y un nuevo
  fichero en `terminadas/` cuando de verdad cierre; con tres carpetas basta para este
  tamaño.
- **Los `traspaso-*.md` se commitean al repo** (decidido el 2026-08-24 por la sesión
  montadora, con la delegación expresa de Juan Luis de ese día): son el estado de los
  trabajos, valen más que cualquier otra cosa del árbol y sin commitear estorbaban en
  cada `git status`. Es reversible; si molestan en la raíz, moverlos es un `git mv`.
- **`tablas` se restringe a los niveles fácil y medio** en la pestaña de problemas
  (decidido por defecto el 2026-08-24 por la sesión montadora): las tablas solo se
  fuerzan en una jugada, y en niveles altos un problema de una jugada copa el almacén y
  abarata el nivel. Reversible con una línea en `PROB_NIVELES` y el selector; queda
  también apuntado en `autorizaciones.md` por si Juan Luis prefiere lo contrario.
- **El montaje lo hizo una sesión Fable el 2026-08-24** por decisión expresa de Juan
  Luis; el inventario previo es de la sesión Opus anterior y está en
  `traspaso-reparto-ajedrez.md`. No rediscutir ninguna de las dos cosas.
- **Las tareas 11-13 entraron el 2026-08-25** (sesión Fable s-20260824T233011-d4d13c52),
  a partir de cuatro problemas reportados por Juan Luis ese día. Dos de los cuatro
  (mate-en-N resoluble en menos, y soluciones alternativas rechazadas) van juntos en
  la 12 a propósito: ambos viven en el verificador de problemas.js y partirlos daría
  dos escritores del mismo fichero. La 13 (IA en PPT) queda tras la 03 porque la 03
  reescribe los setups de variants.js y medir la IA sobre setups provisionales es
  medir en falso. Aclaración expresa de Juan Luis (2026-08-25) recogida en la 11: la
  comida al paso se conserva en las modalidades con peones.
- **La 14 (cosecha de problemas de partidas motor contra motor) es sugerencia de Juan
  Luis del 2026-08-25** y va detrás de la 12 a propósito: la cosecha usa el
  verificador que la 12 arregla, y hasta entonces problemas.js tiene otro dueño. No
  se automatiza de momento: sería mover antes todo el protocolo al remoto.
