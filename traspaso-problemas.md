# Traspaso — Problemas de ajedrez triangular

Actualizado: 2026-08-24 · Sesiones previas: 1

## Objetivo

Añadir a la aplicación una pestaña «Problemas» que genere, presente y permita
resolver problemas del tipo «las blancas juegan y dan mate en 2», «las negras
juegan y capturan un caballo en 3», «coronan un peón en 3» o «consiguen
tablas». El usuario elige dificultad y tipo, pide problemas nuevos, ve la
solución, pide pista y guarda, abre, exporta e importa problemas.

Lo que distingue esto de un ejercicio cualquiera es que la solución está
**verificada como forzada**: se comprueba que ninguna defensa del rival la
estropea, no que exista una línea buena.

## Estado actual

El **motor está terminado y verificado**; la **integración en la interfaz no
está hecha**.

Hecho:

- Los tres ficheros nuevos existen y pasan `node --check`.
- El motor se ha probado fuera del navegador con un verificador independiente
  (recorre el árbol a pelo con las reglas del juego, sin usar el buscador).
  Todos los problemas generados salieron correctos: forzados en N jugadas y no
  resolubles en menos. Cero fallos.
- Rendimiento medido en la modalidad Salas v2, por cada 12 s de generación en
  un solo hilo: fácil → mate 34, gana 165, corona 228, tablas 2197; medio →
  mate 11, gana 14, corona 2, tablas 2272.

Sin hacer:

- **Nada de esto se ha abierto nunca en un navegador.** No está probada ni la
  pestaña, ni el worker, ni el flujo de resolver.
- La integración en `index.html` y `script.js` (ver «Siguiente paso»). Estuvo
  bloqueada toda la sesión porque otra sesión tenía reservados esos dos
  ficheros; **el 2026-08-24 ya estaban libres**.
- Los niveles `dificil` y `experto` medían 0 problemas por minuto, pero esa
  medición es ANTERIOR al último cambio (relajar la unicidad de solución con la
  profundidad, `probMaxSoluciones`), que se hizo justo para arreglar eso y no
  se ha vuelto a medir. Se desconoce el rendimiento actual de esos dos niveles.

## Siguiente paso

**Aplicar la integración en `index.html` y `script.js`**, que es lo único que
falta para poder abrir la aplicación y ver la pestaña funcionando. Está toda
especificada aquí abajo; no hay que decidir nada.

Banda de modelo para retomar: MEDIO — la integración está escrita al detalle,
pero luego hay que depurarla en el navegador y ajustar el rendimiento.

### 1. `index.html` — cuatro cambios

1. Tras `<link rel="stylesheet" href="style.css">`, añadir
   `<link rel="stylesheet" href="problemas.css">`.
2. Tras `<h1>Ajedrez Triangular</h1>`, la barra de pestañas con los botones
   `id="tab-partida"` (clase `tab is-active`) y `id="tab-problemas"` (clase
   `tab`), dentro de un `<div id="tabs" role="tablist">`.
3. Tras el `</aside>` que cierra `#panel`, un `<aside id="panel-problemas"
   hidden>` con los nodos que la interfaz busca (lista exacta abajo).
4. Cargar `problemas.js` ANTES de `script.js` y `problemas-ui.js` DESPUÉS.
   El orden importa: `problemas-ui.js` usa nodos y funciones que `script.js`
   crea en su última línea.

Nodos que `problemas-ui.js` busca por `getElementById` y que el `<aside>` debe
contener. Si falta uno, la página revienta al cargar:

`prob-enunciado`, `prob-sub`, `prob-estado`, `prob-progreso`, `prob-linea`,
`prob-almacen`, `prob-nivel` (select: facil/medio/dificil/experto),
`prob-tipo` (select: cualquiera/mate/gana/corona/tablas), `prob-guardados`
(select), `prob-nuevo`, `prob-reinicia`, `prob-pista`, `prob-solucion`,
`prob-guardar`, `prob-abrir`, `prob-borrar`, `prob-exportar`, `prob-importar`,
`prob-file` (input file oculto).

Los estilos de esos nodos ya están escritos en `problemas.css`; los botones
secundarios esperan ir dentro de un `<div class="save-row">`, que es la clase
que ya usa el panel de partidas guardadas en `style.css`.

### 2. `script.js` — tres ganchos

Los tres van con `typeof … === 'function'` delante, para que `script.js` siga
funcionando si `problemas-ui.js` no está cargado.

1. En `onCellClick`, junto a la guarda de `reviewIndex`:
   `if (typeof problemaBloquea === 'function' && problemaBloquea()) return;`
2. En `onCellClick`, en las DOS ramas que hacen la jugada (la normal y la del
   callback de `askPromotion`), sustituir la llamada a `scheduleAi()` por:
   `if (typeof enModoProblema === 'function' && enModoProblema()) { problemaTrasJugada(); return; }`
   y dejar `scheduleAi()` detrás para el caso normal.
3. Al final de `render()`:
   `if (typeof probPinta === 'function') probPinta();`
   Sin esto, deshacer una jugada con la barra de botones deja el panel del
   problema desactualizado.

### 3. Después de integrar

Por orden:

1. Abrir en el navegador y comprobar que el worker arranca (si falla, avisa por
   consola y genera en el hilo principal, que congela la página).
2. Volver a medir `dificil` y `experto` con
   `scratchpad/rendimiento.js`; si siguen a cero, bajar `escapes` o subir
   `tope` en `PROB_NIVELES`.
3. Equilibrar el almacén por tipo: `probRepon` pide «cualquier tipo», y
   como `tablas` es unas cien veces más barato de generar, acabará copando el
   almacén. Debe pedir el tipo que menos ejemplares tenga.
4. Decidir qué hacer con `tablas` en los niveles altos (ver «Contexto»).

## Decisiones tomadas

| Decisión | Por qué |
|---|---|
| Búsqueda Y/O propia en vez del `negamax` del motor | El motor solo sabe puntuar posiciones; «capturar un caballo ganando material» o «forzar tablas» no son puntuaciones, son condiciones que hay que comprobar en cada hoja |
| El buscador usa `genMoves`/`isAttackedFast` de ai.js, no `movesForSide` | Medido: de ~1200 ms a ~20 ms por intento de generación, unas 50 veces más rápido. Es la diferencia entre poder generar problemas de tres jugadas y no poder |
| Los tableros se comparten con copia superficial | `applyMoveSim` crea piezas nuevas y los sondeos de `genMoves` mutan en sitio pero restauran antes de devolver el control, así que compartir los objetos-pieza es seguro |
| «Ganar una pieza» se mide con quiescencia material, no con el material del momento | Si no, capturar el caballo cuenta como éxito aunque el rival recapture la torre en la jugada siguiente |
| El presupuesto de búsqueda cuenta jugadas examinadas, no nodos | El trabajo por nodo varía diez veces según las piezas; por nodos, el tope dejaba pasar posiciones carísimas y cortaba otras baratas |
| El presupuesto sube mucho con la banda (30 000 → 400 000) | Las posiciones que se resuelven en tres jugadas son justo las que agotan un presupuesto corto: con tope bajo el generador descartaba en silencio todo lo interesante |
| Filtro de casillas de huida del rey antes de buscar mate | En este tablero un rey en campo abierto tiene DOCE vecinas (ocho en el ajedrez clásico); sin acorralarlo antes no hay mate forzado y se gasta todo el tiempo en posiciones sin solución |
| La unicidad de solución se relaja con la profundidad | En una jugada es innegociable (si valen dos de cuarenta, se acierta por azar); en tres, exigirla descartaba casi todos los mates y dejaba el nivel vacío |
| Almacén de problemas generados por adelantado en un worker | Era la «idea loca» del encargo, y sí es razonable: generar cuesta entre 0,1 s y varios segundos según el tipo, y el usuario no debe esperar |
| Al entrar en la pestaña se guarda la partida y al salir se restaura | El problema pisa `game` entero; sin esto, mirar un problema perdería la partida en curso |
| El rival lo juega el propio buscador de problemas, no la IA de la partida | Solo el buscador sabe qué defensa aguanta más jugadas, que es lo que hace bueno un problema |
| Los problemas nacen con `moved: true` en todas las piezas | Quita de en medio enroque, avance doble y captura al paso, que no aportan nada al ejercicio y traen casos raros |

## Descartado — no volver a proponer

| Se descartó | Motivo |
|---|---|
| Página aparte `problemas.html` | El encargo pide una pestaña, y una página aparte obligaría a duplicar las ~400 líneas de dibujo del tablero de `script.js` |
| Reimplementar el tablero para los problemas | Un problema es una posición más: se monta sobre `game` y se juega con `makeMove()` como cualquier partida |
| Exigir que las tablas se fuercen en dos o más jugadas | Medido sobre decenas de miles de tiradas: el ahogado forzado y el jaque perpetuo no salen ni una vez. La única forma realista de forzar tablas aquí es comerse la última pieza del rival de inmediato |
| Dar a las tablas dos piezas al rival para alargarlas | Comerse la primera le deja tiempo de sobra para poner la segunda a salvo: no hay nada forzado |
| Limitar la pieza de las tablas a torre o dama | Daba siempre la misma posición; con cualquier pieza hay variedad y el saldo sigue pasando el umbral de desventaja |
| Contar el presupuesto de búsqueda por nodos | Ver «Decisiones» |
| Repartir las piezas por el tablero de forma uniforme | Da posiciones sin tema ninguno y cuesta lo mismo generarlas; ahora las del defensor se pegan a su rey y las del atacante se ponen a tiro |
| `mate` como fracaso en los problemas de «ganar pieza» | Rechazar esas líneas hacía casi imposible generarlos; ganar la partida es al menos tan bueno como lo que se pedía |
| Tocar `style.css` | Los estilos nuevos van en `problemas.css`, que además deja el añadido separado de la hoja de la partida |

## Archivos

| Ruta | Qué contiene |
|---|---|
| `problemas.js` | Motor: búsqueda Y/O, veredictos por tipo de objetivo, generador de posiciones con sus filtros, `probJuzga` para la partida en curso y `probValida` para los `.json` importados. No toca el DOM |
| `problemas-ui.js` | Pestaña: almacén en `localStorage`, worker de generación, montaje del problema sobre `game`, pintado del panel, guardar/abrir/exportar/importar. Se carga después de `script.js` |
| `problemas.css` | Barra de pestañas, panel de problemas y el aro de la pista sobre el tablero |
| `index.html` | **Pendiente de tocar**: enlace al CSS, barra de pestañas, `<aside id="panel-problemas">` y las dos etiquetas `<script>` |
| `script.js` | **Pendiente de tocar**: los tres ganchos de «Siguiente paso» |

Fuera del repo, en el scratchpad de la sesión (`/private/tmp/claude-501/-Users-salasgar-Documents-git-Ajedrez-triangular/d9ab6ba0-bc27-4f33-af73-ef135c61c0a5/scratchpad/`), quedaron tres scripts de Node que cargan el juego con `vm` y miden el motor sin navegador: `prueba-problemas.js` (verificador independiente), `rendimiento.js` (rendimiento con la configuración real) y `diagnostico.js` (a qué profundidad se resuelven las posiciones). **Ese directorio se borra solo**: si van a hacer falta, hay que copiarlos antes a `entrenamiento/`.

## Contexto que no está en los archivos

- **El tablero hexagonal cambia la intuición ajedrecística.** Un rey tiene hasta
  doce casillas vecinas, no ocho. Por eso los mates forzados son mucho más
  raros que en el ajedrez clásico y hace falta acorralar al rey antes de
  buscar. Cualquier ajuste del generador tiene que contar con esto.
- **`tablas` solo se resuelve en una jugada, y eso está sin resolver.** Aparece
  en todos los niveles y es tan barato de generar que copará el almacén si no
  se equilibra. Quedan dos salidas y no se eligió ninguna: restringir `tablas`
  a fácil y medio (y deshabilitar la opción en el selector cuando el nivel sea
  alto), o dejarlo en todos los niveles asumiendo que ahí la dificultad la pone
  la posición y no el número de jugadas.
- **Trabajo en paralelo con otras sesiones.** Durante toda esta sesión hubo
  hasta cinco sesiones de Claude abiertas sobre este repositorio, y una tenía
  reservados `index.html` y `script.js`. Conviene comprobar las reservas en
  `.claude/sesiones/` antes de editar esos dos ficheros, y mirar el diff antes
  de hacer `git add`: el árbol de trabajo trae cambios de otras sesiones.
- **Nada de esto está en git todavía.** Los tres ficheros nuevos están sin
  añadir al índice.
