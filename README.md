# Ajedrez Triangular

Variante de ajedrez sobre un tablero **hexagonal dividido en triángulos**, jugable
en el navegador. Sin dependencias, sin compilación: basta abrir `index.html`.

## Cómo jugar

**Juega online:** https://salasgar.github.io/Ajedrez-triangular/

También puedes abrir [index.html](index.html) en cualquier navegador moderno
(funciona desde `file://`, sin servidor).

Modalidades: humano contra humano, humano contra ordenador (con cualquiera de
los dos colores) y ordenador contra ordenador.

## El tablero

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
| Peón ♟ | Avanza sin capturar a la casilla de enfrente y captura en las dos frontales diagonales. Doble paso inicial y coronación en la última fila, con elección de pieza (el ordenador siempre corona a dama). |

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

## Interfaz

- Navegación por el historial: inicio, deshacer, rehacer, final, y reproducción
  automática hacia delante o hacia atrás.
- Voltear el tablero, listado de piezas capturadas y contador de jugadas.
- Guardar y cargar partidas en el navegador (`localStorage`), marcarlas como
  favoritas, y exportar o importar partidas en `.json`.

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

| Nivel | Motor |
|---|---|
| 1 | Jugadas al azar |
| 2 | Codicioso (material inmediato, profundidad 1) |
| 3 | Minimax con poda alfa-beta, profundidad 2 |
| 4–7 | + ordenación de jugadas, movilidad y búsqueda de quietud, profundidad 3 a 6 |
| 8 | Ranura experimental (hoy igual que el 4; los valores ajustados que probaba son ya el estándar) |

A partir del nivel 4 la búsqueda corre en un Web Worker
([ai-async.js](ai-async.js)) para que la interfaz no se congele mientras el
ordenador piensa; si el navegador no lo permite, cae al cálculo síncrono.

## Estructura

| Archivo | Contenido |
|---|---|
| [geometry.js](geometry.js) | Retícula triangular, tablero hexagonal, vecindades y coordenadas de pantalla. |
| [rules.js](rules.js) | Movimientos legales, jaque, mate, tablas y estado de la partida. |
| [ai.js](ai.js) | Evaluación, negamax con alfa-beta, quiescence y niveles. |
| [ai-async.js](ai-async.js) | Ejecuta la búsqueda en un Web Worker construido desde un Blob. |
| [saveload.js](saveload.js) | Guardado versionado en `localStorage` y en archivos `.json`. |
| [script.js](script.js) | Dibujo del tablero en SVG e interacción con la interfaz. |
| [style.css](style.css) | Estilos. |
| [tune-values.js](tune-values.js) | Herramienta de desarrollo (Node) para ajustar los valores de las piezas. |

## Ajuste de valores (desarrollo)

`tune-values.js` afina los valores de las piezas por el método tipo Texel:
genera un corpus de posiciones de autojuego etiquetadas con el resultado de su
partida y ajusta los pesos por descenso de gradiente sobre ese corpus.

```sh
node tune-values.js            # imprime los valores sugeridos
node tune-values.js --level=5  # autojuego con un nivel real concreto
node tune-values.js --minutes=30
```

No modifica `ai.js`: imprime las constantes sugeridas para revisarlas y
pegarlas a mano. Un valor sugerido solo debe entrar en `ai.js` tras
confirmarse en un match emparejado contra los valores vigentes; la regresión
minimiza el error de predecir el resultado, no la fuerza de juego, y las dos
cosas no siempre coinciden (el peso de movilidad, por ejemplo, lo aprendió en
el sentido contrario al que gana partidas). Los valores de `PIECE_VALUE` y el
peso de movilidad por defecto de hoy salieron así y ya pasaron esa
confirmación a profundidad 2 y 3.
