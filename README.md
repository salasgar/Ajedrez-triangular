# Ajedrez Triangular

Ajedrez sobre **tableros divididos en triángulos**, jugable en el navegador.
Sin dependencias, sin compilación: basta abrir `index.html`.

## Cómo jugar

**Juega online:** https://salasgar.github.io/Ajedrez-triangular/

También puedes abrir [index.html](index.html) en cualquier navegador moderno
(funciona desde `file://`, sin servidor).

Se puede jugar humano contra humano, humano contra ordenador (con cualquiera de
los dos colores) u ordenador contra ordenador.

## Modalidades

El selector **Modalidad** cambia el reglamento entero: el tablero, las piezas,
la posición inicial y los parámetros del motor. Sale por defecto el ajedrez
triangular de Salas.

| Modalidad | Tablero | Piezas por bando |
|---|---|---|
| **Salas v2 (2026)** | hexágono, 96 triángulos | 9 de fondo (con elefante) + 11 peones |
| **Salas v3 (2026)** | hexágono, 96 triángulos | igual, con dama que combina 3 familias |
| **Salas v1 (1998)** | rectángulo 8×8, 64 triángulos | juego de ajedrez normal, 16 piezas |
| **Dekle (1986)** | hexágono, 96 triángulos | 9 de fondo (con unicornio) + 11 peones |
| **Trigonal (Koval, 2023)** | triángulo, 81 casillas | juego de ajedrez normal, 16 piezas |
| **PPTR / PPTLSR** (×4) | hexágono, 96 triángulos | 19 figuras y un rey, todas se mueven como el rey |

Cada modalidad vive en [variants.js](variants.js): su dotación, cómo se mueve
cada pieza, las reglas del peón y los valores con los que evalúa el motor. El
resto del programa no conoce ninguna pieza en concreto; pregunta a la modalidad
activa.

Que todas quepan en el mismo programa no es casualidad: **los tres tableros son
la misma retícula triangular con otro recorte**. El hexágono son las casillas
con `1−N ≤ a,b,c ≤ N`; el triángulo de Koval, las que cumplen `a,b,c ≥ −2`, que
resultan ser exactamente 45 ▲ + 36 ▽ = 81; y el rectángulo de 1998, el hexágono
acotando además su columna `a − c`.

> Los nombres visibles y los identificadores internos son cosas distintas. El
> `id` de cada modalidad —`salas` para la v2 de 2026, `salas-v4` para la v3 y
> `salas-1998` para la original— va dentro de las partidas guardadas, de los
> libros de aperturas y del corpus de entrenamiento, así que no cambia aunque
> cambie el nombre que se lee en el selector.

### Salas v1 (1998)

La primera versión, de 1998, y el antepasado directo de las de 2026: **mismo
alfil, mismo caballo y mismo peón**, pero sobre un tablero de 8×8 y con el
ejército del ajedrez de siempre.

Su tablero es el hexágono con **los dos picos laterales cortados**: quedan sus 8
filas, recortadas todas a 8 casillas, y salen 64 triángulos. Los bordes de la
izquierda y de la derecha van en zigzag, porque la casilla del extremo de cada
fila apunta hacia arriba o hacia abajo alternándose. Las casillas se llaman
`a1`…`h8`, como en el ajedrez de siempre y sin letra de color: aquí (columna,
fila) ya identifica una sola casilla, porque dentro de una columna las filas van
alternando ▲ y ▽.

La colocación es la tradicional —torre, caballo, alfil, rey, dama, alfil,
caballo y torre, con los ocho peones delante—, con rey contra rey en `d1`/`d8` y
dama contra dama en `e1`/`e8`. Hay **enroque** tradicional: el rey se aparta dos
casillas hacia la torre y esta salta al otro lado (`d1→b1` con `a1→c1`, o
`d1→f1` con `h1→e1`).

Lo que cambió de 1998 a 2026 fueron las piezas de línea:

| 1998 | 2026 |
|---|---|
| **Torre ♜**: 6 rayos perpendiculares a los lados, alternando aristas y vértices | esa misma pieza, rebautizada **elefante 🐘**; la torre pasó a ser la de los tres carriles |
| **Dama ♛**: alfil + torre de 1998 | alfil ya no: **torre nueva + elefante** |
| **Rey ♚**: la dama a un solo paso | igual (un paso a cualquier casilla que toque la suya) |

Que el rey salga igual en las dos no es una coincidencia buscada: los 6 primeros
pasos del alfil y los 6 del elefante son **disjuntos** y suman exactamente las 12
casillas que tocan la suya, de modo que «la dama de 1998 a un paso» y «un paso a
cualquier vecina» son la misma pieza. Está comprobado casilla a casilla en
[entrenamiento/prueba-humo.js](entrenamiento/prueba-humo.js).

Aquí **no hace falta la coronación de flanco**: al recortar el hexágono a un
rectángulo, las 8 columnas llegan enteras de la fila 1 a la 8, así que ningún
peón se queda nunca sin casilla de avance.

### Dekle (1986)

Triangular Chess, de George R. Dekle Sr., publicado en *World Game Review* nº 10
y recogido en la *Encyclopedia of Chess Variants* de Pritchard (1994).

Su tablero es **el mismo hexágono de 96 casillas** que el de Salas, y su
dotación —juego completo más tres peones y un unicornio— da 9 piezas de fondo y
11 peones, que es justo lo que miden esas dos filas. Sus deslizantes son el
elefante de Salas partido en dos: la **torre** son los 3 rayos que arrancan
cruzando una arista, el **alfil** los 3 que arrancan por un vértice, y la
**dama** los 6. Su alfil, por tanto, no está atado al color de la casilla.

> **Es una reconstrucción.** El tablero, la dotación y los deslizantes están
> bien asentados. El caballo, el unicornio y el orden de la fila de fondo se han
> reconstruido a partir de descripciones secundarias, que en esos tres puntos son
> ambiguas; contrastarlos con la fuente original (Keller, Pritchard, o
> *Variations on the Theme of Chess* del propio Dekle, 2023) está pendiente.

### Trigonal Chess (Koval, 2023)

De Max Koval, publicado en [The Chess Variant
Pages](https://www.chessvariants.com/rules/trigonalchess). Tablero triangular de
81 casillas y juego de ajedrez normal, sin piezas de fantasía: el autor buscaba
una traducción directa del ajedrez a la retícula triangular.

Las filas van de la `a` (el vértice, 1 casilla) a la `i` (la base, 17), y dentro
de cada una las casillas se numeran de 1 a 2k−1; así, `h2`, `d3`, `i17`. Los dos
ejércitos ocupan **los dos extremos de la base**, y el peón corona al llegar al
final de su carril.

Su **torre** —«siempre por el lado más lejano»— resulta ser exactamente la torre
de Salas: el mismo deslizamiento en zigzag por el carril. El **alfil** alternante
está reconstruido como el análogo de esa torre: zigzag entre dos direcciones
diagonales a 120°, cuya deriva neta va en línea recta.

> Esa reconstrucción del alfil no es certeza. Lo que sí está comprobado es la
> familia de direcciones: el autor afirma que en su «variación dura» el alfil
> cubre todas las casillas de su color en un tablero vacío, y con estas
> direcciones diagonales eso se cumple **exactamente** desde las 81 casillas —ni
> una casilla de más ni una de menos—. También encaja su advertencia de que el
> doble paso del peón se solapa con una de sus capturas, que aquí sale sola.
>
> **No hay enroque**: el autor dice que lo hay, pero no publica sobre qué
> casillas, y en este tablero no se deduce. Preferimos que falte a inventarlo.

### Piedra, papel y tijera

Cuatro modalidades experimentales sobre el mismo hexágono de 96 triángulos.
Todas las figuras se mueven igual —un paso a cualquier casilla vecina, como el
rey—, pero **cada una solo puede capturar a las que vence** en el juego de
siempre. Moverse a una casilla vacía siempre se puede. Las cuatro llevan rey:
el rey captura cualquier pieza rival y cualquier pieza rival puede capturarlo a
él —así que todas dan jaque—, y el objetivo es el **jaque mate**.

- **PPTR** (`rps-rey`), *Piedra, papel, tijera y rey*: piedra 🪨, papel 📄 y
  tijera ✂️. La piedra captura la tijera, la tijera el papel y el papel la
  piedra.
- **PPTLSR** (`rpsls-rey`), *Piedra, papel, tijera, lagarto, Spock y rey*: las
  cinco figuras de la regla de Big Bang Theory. La tijera corta el papel y
  decapita al lagarto; el papel tapa la piedra y desautoriza a Spock; la piedra
  aplasta al lagarto y a la tijera; el lagarto envenena a Spock y devora el
  papel; Spock rompe la tijera y vaporiza la piedra. Cada figura captura
  exactamente a dos y es capturada por otras dos.
- **PPTR · Muralla de papel** (`rps-rey-muralla`) y **PPTLSR · Muralla de
  papel** (`rpsls-rey-muralla`): las mismas reglas, otra posición inicial (ver
  abajo).

Las dos primeras arrancan con el ciclo de figuras repetido en las dos filas y
el rey en el centro del fondo: esa posición se midió en la arena y es la que
juega el motor. Las dos **Muralla de papel** usan en cambio la formación del
ajedrez triangular: la fila delantera de 11 casillas entera de papeles y,
detrás, las 9 restantes con piedras y tijeras alternadas (o el ciclo de cinco)
y el rey en el centro. Como el papel no captura papeles, las dos murallas se
encuentran y quedan trabadas: la partida la abren las tijeras —las únicas que
perforan papel en PPTR— mientras las piedras hacen de escudo, así que es una
apertura de bloqueo y ruptura muy distinta de la del ciclo.

En los dos casos los bandos quedan con figuras iguales enfrentadas. Sin peones
no hay coronación, doble paso ni captura al paso, y tampoco enroque.

Por dentro, la matriz de capturas vive en el mapa `captures` de cada modalidad
(tipo → tipos capturables) y la consulta `canCapture()` en
[rules.js](rules.js). Las cinco figuras se dibujan como iconos SVG monocromos
—igual que el elefante y el unicornio— para que tomen el color del bando.

> **Modalidades sin rey, retiradas**: hubo dos más sin rey (`rps` y `rpsls`),
> en las que ganaba quien dejaba al rival sin piezas. Se quitaron el 26-8-2026:
> sin jaque que cortara la partida, casi todas agotaban el tope de jugadas y no
> resultaban jugables. El soporte en el motor (el flag `kingless`, el estado
> `wiped` y las tablas por material) sigue en [rules.js](rules.js) y
> [ai.js](ai.js) por si vuelven, pero hoy no lo usa ninguna modalidad.

### Otras teselaciones del plano

Las modalidades tipo Piedra, papel y tijera no dependen del triángulo: sus
figuras se mueven a las casillas vecinas, y «vecina» lo define la teselación.
[tessellations.js](tessellations.js) saca esa noción del código del tablero
triangular y trae tres teselaciones más, cada una con una modalidad de
demostración que **no sale en el selector** y se abre por URL:

| Teselación | Casillas | Cómo abrirla |
|---|---|---|
| cuadrada (`square8`) | 8×8 | `index.html?modalidad=demo-cuadrado` |
| hexagonal (`hexhex4`) | hexágono de 37 hexágonos | `index.html?modalidad=demo-hexagonal` |
| ladrillos (`brick8`) | 8×8 a matajunta | `index.html?modalidad=demo-ladrillos` |

Van ocultas a propósito —con `hidden: true` en su modalidad, que
`variantList()` filtra— porque son un banco de pruebas de la geometría, no
juegos terminados: cada bando lleva una fila con un rey y varios «guardias»,
que se mueven todos igual, un paso a cualquier casilla vecina. El ladrillo es
el caso interesante: al desplazar media casilla cada hilada, un cuadrado toca
a seis vecinos en vez de a ocho, y el juego cambia sin tocar ninguna regla.

### Coronación de flanco

En el hexágono, un peón que sube en línea recta se topa con el borde superior
izquierdo o el derecho **antes de llegar a la fila de coronación**. Medido sobre
la geometría: los dos peones de los extremos, `N2A` y `N2F`, recorren
`N2A → B3A → N4B → B5B → N6C → B7C` y ahí se quedan para siempre. Dos de los
once peones de cada bando no pueden coronar nunca por sí solos.

Dekle resolvió ese mismo problema en el mismo tablero con una regla que el
ajedrez de Salas adopta desde 2026: **cuando el peón se queda sin casilla de
avance, avanza en diagonal** —por su casilla de captura, haya o no pieza que
capturar— para poder seguir hacia la coronación.

Es una regla barata: hay exactamente 6 casillas por bando sin avance (`B5A`,
`B6B`, `B7C`, `B5H`, `B6H`, `B7H` para las blancas), y **cada una tiene una sola
casilla de captura**, así que la regla añade un movimiento y nunca una elección.
Con ella no queda ni una casilla del tablero desde la que un peón no pueda
coronar.

La modalidad **Salas v3 (2026)** es experimental: la dama combina las tres
familias de rayos en lugar de solo dos.

## El tablero (modalidad de Salas)

Cada casilla es un triángulo equilátero identificado por tres coordenadas de
carril `(a, b, c)`:

- `a + b + c = 2` → triángulo hacia arriba ▲
- `a + b + c = 1` → triángulo hacia abajo ▽

El tablero es un hexágono de lado `N = 4`: todas las casillas con
`1 − N ≤ a, b, c ≤ N`. Para ver las coordenadas de cada casilla dibujadas sobre
el tablero, abre [coordenadas.html](coordenadas.html).

## Las piezas

| Pieza | Movimiento |
|---|---|
| Torre ♜ | Se desliza por los tres carriles de casillas que pasan por ella, cruzando aristas. |
| Alfil ♝ | Se desliza en las 6 direcciones diagonales, de vértice a vértice, siempre por triángulos de su misma orientación. |
| Dama ♛ | Combina torre y elefante. |
| Caballo ♞ | Salta a las 12 casillas de orientación contraria que forman dos anillos a su alrededor; puede saltar por encima de otras piezas. |
| Elefante 🐘 | Se desliza en línea recta hacia cualquiera de sus tres casillas vecinas por arista o en el sentido opuesto (6 direcciones, alternando aristas y vértices); no salta piezas. |
| Rey ♚ | Un paso a cualquier casilla que toque la suya, por arista o por vértice. |
| Peón ♟ | Avanza sin capturar a la casilla de enfrente y captura en las dos frontales diagonales. Doble paso inicial y coronación en la última fila, con elección de pieza (el ordenador siempre corona a dama). Contra el borde, sin casilla de avance, avanza en diagonal: ver [Coronación de flanco](#coronación-de-flanco). |

También hay captura al paso. Jaque, jaque mate y ahogado funcionan como en el
ajedrez clásico; además son tablas por triple repetición, por la regla de las
50 jugadas y cuando solo quedan los dos reyes.

Esa última condición es más corta que en el ajedrez clásico, y está comprobada
por fuerza bruta sobre esta geometría, no copiada: en el hexágono triangular el
rey se acorrala contra el borde con muy poco, así que **rey y caballo contra
rey** o **rey y alfil contra rey** —tablas muertas en el ajedrez de siempre—
aquí sí tienen posiciones de mate. El único material con el que el mate es
imposible es rey contra rey.

El **enroque** exige, como siempre, que el rey y la torre no se hayan movido,
que no quede nada entre ellos y que el rey ni esté en jaque ni cruce casillas
atacadas. Por el lado corto el rey se desplaza dos casillas hacia la torre y
esta salta al otro lado; por el lado largo, tres. Para enrocarse se selecciona
el rey y se pulsa la casilla de la torre propia: en esta retícula el rey ya
alcanza por sí solo dos casillas a cada lado de su fila, así que indicar el
destino del rey sería ambiguo, mientras que "rey a su propia torre" no puede
significar ninguna otra cosa.

## Cómo se nombra cada casilla

Las coordenadas `(a, b, c)` son cómodas para el motor e ilegibles para una
persona, así que cada casilla tiene además un nombre corto: **B1A**, **N4H**…

- La inicial es el **color** de la casilla: `B` si apunta hacia arriba (clara),
  `N` si apunta hacia abajo (oscura).
- El número es la **franja horizontal**, del 1 (abajo, lado de las blancas) al
  8 (arriba).
- La letra es la franja que va de **abajo-derecha a arriba-izquierda**, de la
  `A` (la más a la izquierda) a la `H`.

Una franja es el recorrido que haría una torre de un borde del tablero al otro,
y por cada casilla pasan tres. Nombrarla por dos franjas más el color basta,
porque la tercera coordenada sale sola: `a + b + c` vale 2 en las casillas
claras y 1 en las oscuras. La casilla de más abajo es `B1A` y la de más a la
derecha, `N4H`.

Las jugadas se escriben con la inicial de la pieza (Rey, Dama, Torre, Alfil,
Caballo, Elefante; el peón no lleva), el origen, `-` o `×` si captura, y el
destino:

| Jugada | Significado |
|---|---|
| `N2D-N4E` | peón de N2D a N4E |
| `CB1D-N3F` | caballo de B1D a N3F |
| `AN1D×N5D` | alfil de N1D captura en N5D |
| `AN5D-N5C+` | alfil a N5C, con jaque (`#` sería mate) |
| `N7D-B8D=C` | peón corona en B8D eligiendo caballo |
| `0-0` / `0-0-0` | enroque corto / largo |

Se escribe el origen siempre, y no por gusto: los nombres de casilla empiezan
por `B` o `N` y contienen letras `A`–`H`, que son justamente las iniciales de
las piezas. En notación corta salían jugadas como `D×N5D`, que lo mismo es la
Dama capturando que un peón de la franja D.

## Interfaz

- Navegación por el historial: inicio, deshacer, rehacer, final, y reproducción
  automática hacia delante o hacia atrás.
- Voltear el tablero, listado de piezas capturadas y contador de jugadas.
- Guardar y cargar partidas en el navegador (`localStorage`), marcarlas como
  favoritas, y exportar o importar partidas en `.json`.
- **Copiar jugadas** pone la planilla en el portapapeles como texto, numerada
  en pares y con el resultado al final.
- **Ver el nombre de las casillas** los escribe sobre el tablero, útil mientras
  se aprende la notación.
- **Sonido al mover**, apagado por defecto: un chasquido corto al mover y otro
  más grave al capturar, sintetizados sin ningún fichero de audio.
- La pieza que se mueve **llega deslizándose** desde su casilla de origen (se
  respeta `prefers-reduced-motion`).
- **Tiempo consumido** por cada bando. No es un control de tiempo: nadie pierde
  por tiempo, solo se mide lo que se ha pensado.

### Problemas en imagen

Cualquier problema se puede descargar como **imagen `.png`**: el diagrama del
tablero y, debajo, el enunciado («Las blancas juegan y dan mate en 3 jugadas»),
la letra pequeña de qué cuenta como resolverlo y la modalidad. El diagrama no es
una captura de pantalla: se vuelve a dibujar sobre un `<canvas>` con la misma
geometría que el tablero de verdad, así que sale sin las marcas de la partida
(selección, último movimiento, jaque) y con las coordenadas visibles solo en las
casillas vacías, que es como se lee un diagrama impreso.

El **editor de posiciones** puede además crear problemas propios. Se coloca la
posición, se elige el objetivo (dar mate, ganar una pieza, coronar o salvar
tablas) y en cuántas jugadas, y **Comprobar** lo verifica con el mismo buscador
Y/O que genera los problemas automáticos: solo se acepta si el objetivo se puede
forzar contra cualquier defensa. Un enunciado que no se sostiene no se guarda; y
si la posición resulta ser un mate en dos cuando se pedían tres, el enunciado se
corrige solo. El problema comprobado se guarda en el navegador —aparece en la
pestaña **Problemas** del juego—, se exporta en `.json` o se descarga como
imagen.

### Teclado y lectores de pantalla

El tablero es **una sola parada de tabulador**; dentro se anda con las flechas
(izquierda y derecha recorren la fila, arriba y abajo saltan de fila) y se
selecciona con Enter o espacio. Cada casilla se anuncia con su nombre y lo que
tiene encima —«N4H: Torre negra»—, y una región aparte va leyendo la jugada que
se acaba de hacer, el turno y los avisos de jaque o final de partida.

### Sin conexión

La aplicación se puede instalar y jugar sin red: un
[service worker](sw.js) guarda los nueve ficheros que la componen. Solo
funciona servida por `https` (o `localhost`); abriendo `index.html` a pelo con
`file://` no se registra nada y la aplicación va igual. Al publicar un cambio
hay que subir la constante `VERSION` de `sw.js`, o los navegadores que ya
tengan la versión anterior seguirán sirviendo los ficheros viejos.

### Análisis de las jugadas

Al pulsar sobre **«Jugada N de M»** se despliega el panel de análisis. Puede
mostrar dos listas de jugadas puntuadas, de mejor a peor; al pasar el ratón por
una fila, el tablero vuelve a la posición de partida con esa jugada marcada. La
puntuación va en peones y desde el punto de vista de quien mueve: `+1.00`
equivale a un peón de ventaja para él.

- **La jugada que hizo el ordenador y sus alternativas.** Con la elegida
  resaltada (no siempre es la primera: entre las que quedan a menos de
  `PLAY_TOLERANCE` de la mejor sortea, para que las partidas no salgan siempre
  iguales). Con la partida en pausa, pulsar una alternativa **rehace esa última
  jugada de otra forma** (crea una rama nueva).
- **La próxima jugada.** El botón **«Elegir la próxima jugada»** calcula las
  jugadas disponibles desde la posición actual. Pulsando una la **fuerzas**:
  si te toca a ti, la juegas; si le toca al ordenador (partida en pausa), le
  obligas a hacerla. Tras forzar, la partida sigue en pausa para que examines
  la posición.

Marcando **«Guardar el análisis de cada jugada del ordenador»** cada jugada suya
guarda su lista en el historial (y en las partidas guardadas, recortada a las
mejores). Cuesta tiempo: para dar la puntuación real de las jugadas malas hay
que buscar con la ventana abierta, lo que mide alrededor de 1,5 veces el tiempo
normal. Por eso viene desactivado.

Con el análisis guardado aparecen también la **gráfica de evaluación** de la
partida y las marcas **?!**, **?** y **??** junto a las jugadas que empeoraron
mucho la evaluación. Conviene saber qué miden exactamente: la diferencia entre
dos búsquedas distintas, la de antes de la jugada y la de después. No están en
la misma escala —cada búsqueda ve un paso más allá y tiende a favorecer a quien
acaba de mover—, así que hay un suelo de ruido. Está medido, no supuesto: con
el mismo nivel jugando contra sí mismo, donde nadie se equivoca, la diferencia
tiene una mediana de 0,26 peones y un máximo de 1,07
([entrenamiento/ruido-anotaciones.js](entrenamiento/ruido-anotaciones.js)). Por
eso la imprecisión no empieza hasta 1,20 peones: por debajo de ahí, marcar sería
marcar ruido.

El cálculo a petición (botón «Elegir la próxima jugada» / «Analizar esta
posición») usa el mismo Web Worker que la partida, así que solo está disponible
cuando el ordenador no está pensando (pausa la partida si hace falta).

## Niveles del ordenador

Los niveles no se distinguen por una profundidad fija, sino por **cuánto se
le deja pensar**: un presupuesto de nodos. La profundidad sale de ahí, y por
eso varía con la posición — con pocas piezas el mismo presupuesto llega mucho
más lejos, que es justo donde hace falta.

| Nivel | Presupuesto | Piensa | Profundidad típica |
|---|---|---|---|
| 1 | — | — | juega al azar |
| 2 | 300 nodos + azar | 5 ms | 1 |
| 3 | 5.000 nodos + azar | 35 ms | 2 |
| 4 | 4.500 nodos | 32 ms | 2 |
| 5 | 16.000 nodos | 86 ms | 3 |
| 6 | 60.000 nodos | 346 ms | 4 |
| 7 | 220.000 nodos | 1,1 s | 5 |
| 8 | 800.000 nodos | 4,5 s | 6 |

Los niveles 2 y 3 llevan además un punto de azar (no siempre juegan la mejor
jugada, y a veces se equivocan de verdad). Sin él, un motor con búsqueda de
quietud no cuelga piezas ni pensando poquísimo, y el principiante se queda sin
rival asequible. Los niveles 4 en adelante juegan siempre lo mejor que ven:
son más flojos solo porque miran menos lejos.

La búsqueda corre siempre en un Web Worker ([ai-async.js](ai-async.js)) para
que la interfaz no se congele mientras el ordenador piensa; si el navegador no
lo permite, cae al cálculo síncrono.

### La fuerza del motor por modalidad

La escalera de niveles es la misma en todas las modalidades, pero **los valores
de las piezas solo están ajustados para el ajedrez de Salas v2 (2026)**. Los de
Salas v1 (1998), Salas v3 (2026), Dekle y Trigonal (`engine.pieceValues` en [variants.js](variants.js))
son una estimación a ojo: el unicornio puesto entre caballo y torre; para Koval
los valores clásicos del ajedrez, aun sabiendo que su alfil en zigzag alcanza
mucho más que el de siempre y casi seguro vale más de lo que dice esa tabla; y
para 1998, los del alfil, el caballo y el peón copiados de 2026 (son las mismas
piezas), la torre valorada como el elefante de 2026 (que es la misma pieza) y la
dama estimada con la proporción que allí guarda con sus dos mitades.

O sea: en esas tres modalidades el motor juega **correctamente** —la generación
de jugadas está verificada contra la implementación genérica, ver más abajo—,
pero todavía no se puede decir que juegue **bien**. Falta pasarlas por
`tune-values.js --variant=…` y confirmarlas en la arena, igual que se hizo con
las de Salas.

Los presupuestos están puestos para que la escalera suba a pasos parejos
(cada nivel piensa unas 3,7 veces más que el anterior), pero **el elo de cada
peldaño está sin medir todavía**: la escalera anterior, la de profundidad
fija, tenía huecos de 300 a 1000 elo entre niveles contiguos, y esa medición
es justamente lo que motivó cambiarla. La ronda 13 del banco de entrenamiento
está midiendo la nueva.

## Estructura

| Archivo | Contenido |
|---|---|
| [geometry.js](geometry.js) | Retícula triangular, los tres tableros, vecindades y coordenadas de pantalla. |
| [variants.js](variants.js) | Las modalidades: dotación, movimiento de cada pieza, reglas del peón y parámetros del motor. |
| [tessellations.js](tessellations.js) | Otras teselaciones del plano (cuadrada, hexagonal, ladrillos) y sus modalidades de demostración. |
| [rules.js](rules.js) | Movimientos legales, jaque, mate, tablas y estado de la partida. |
| [ai.js](ai.js) | Evaluación, negamax con alfa-beta, quiescence y niveles. |
| [ai-async.js](ai-async.js) | Ejecuta la búsqueda en un Web Worker construido desde un Blob. |
| [saveload.js](saveload.js) | Guardado versionado en `localStorage` y en archivos `.json`. |
| [script.js](script.js) | Dibujo del tablero en SVG e interacción con la interfaz. |
| [problema-imagen.js](problema-imagen.js) | Dibuja un problema en un `<canvas>` y lo descarga como `.png`, con el enunciado debajo. |
| [crear-problema.js](crear-problema.js) | Convierte la posición del editor en un problema, comprobando antes que el objetivo se puede forzar. |
| [style.css](style.css) | Estilos. |
| [tune-values.js](tune-values.js) | Herramienta de desarrollo (Node) para ajustar los valores de las piezas. |

## Cómo se comprueba que cada modalidad es correcta

Añadir tableros y juegos de piezas nuevos toca las partes más delicadas del
motor, así que la corrección se comprueba por **diferencia contra la
implementación lenta y evidente**, en las cinco modalidades:

- `genMoves` (que se salta la comprobación de legalidad usando clavadas) contra
  `movesForSide` (que copia el tablero y prueba jugada a jugada).
- `isAttackedFast` (que mira desde la casilla hacia fuera) contra `isAttacked`
  (que recorre todas las piezas rivales).
- Y para Salas, además, que el `perft` y una partida entera
  coincidan **jugada a jugada** con la versión anterior al refactor.

```sh
node entrenamiento/modalidades.js     # las cinco clásicas, por diferencia
node entrenamiento/prueba-humo.js     # circuito completo sin navegador
node entrenamiento/perft.js           # perft con dorados, ajedrez de Salas
node test-rps.js                      # reglas de Piedra, papel y tijera
node test-ia-rps.js                   # IA de esas modalidades (juega partidas: tarda)
                                      # OJO: roto desde que se retiraron las modalidades
                                      # sin rey (usa setVariant('rps')); pendiente de migrar
node test-modalidades.js              # que las doce modalidades arrancan
```

La última es la que protege las mezclas: las modalidades se registran desde
[variants.js](variants.js) y desde [tessellations.js](tessellations.js), que no
se conocen entre sí, y al juntar ramas lo que se rompe no es una regla suelta
sino una modalidad entera —o se cuela en el selector una demo que no debía
salir.

Esa segunda comprobación es la que importa de verdad en Dekle. `isAttackedFast`
da por hecho que los rayos se pueden recorrer al revés, y ahí no se puede: como
su torre y su alfil son las dos mitades de un mismo haz de rayos —partido según
el primer paso cruce una arista o un vértice— y los pasos de ese rayo van
alternando arista/vértice, **el tipo de pieza que ataca por un rayo cambia con
la distancia**: la vecina ataca como torre, la siguiente como alfil, la
siguiente como torre. Un escaneo ingenuo se dejaría torres sin ver, y el motor
metería el rey en jaque. Las tablas de ataque se precalculan en
[variants.js](variants.js) resolviendo el tipo posición a posición, y los saltos
compuestos se invierten de verdad en vez de suponerlos simétricos.

## Ajuste de valores (desarrollo)

`tune-values.js` afina los valores de las piezas por el método tipo Texel:
genera un corpus de posiciones de autojuego etiquetadas con el resultado de su
partida y ajusta los pesos por descenso de gradiente sobre ese corpus.

```sh
node tune-values.js               # imprime los valores sugeridos
node tune-values.js --level=5     # autojuego con un nivel real concreto
node tune-values.js --minutes=30
node tune-values.js --variant=dekle   # ajusta otra modalidad
```

No modifica `ai.js`: imprime las constantes sugeridas para revisarlas y
pegarlas a mano. Un valor sugerido solo debe entrar en `ai.js` tras
confirmarse en un match emparejado contra los valores vigentes; la regresión
minimiza el error de predecir el resultado, no la fuerza de juego, y las dos
cosas no siempre coinciden (el peso de movilidad, por ejemplo, lo aprendió en
el sentido contrario al que gana partidas). Los valores de `PIECE_VALUE` y el
peso de movilidad por defecto de hoy salieron así y ya pasaron esa
confirmación a profundidad 2 y 3.
