# Ajedrez Triangular

Variante de ajedrez sobre un tablero **hexagonal dividido en triángulos**, jugable
en el navegador. Sin dependencias, sin compilación: basta abrir `index.html`.

## Cómo jugar

Abre [index.html](index.html) en cualquier navegador moderno (funciona también
desde `file://`, sin servidor).

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
| Peón ♟ | Avanza sin capturar a la casilla de enfrente y captura en las dos frontales diagonales. Doble paso inicial y coronación a dama en la última fila. |

También hay captura al paso. Jaque, jaque mate y ahogado funcionan como en el
ajedrez clásico; además son tablas por triple repetición y por la regla de las
50 jugadas.

## Interfaz

- Navegación por el historial: inicio, deshacer, rehacer, final, y reproducción
  automática hacia delante o hacia atrás.
- Voltear el tablero, listado de piezas capturadas y contador de jugadas.
- Guardar y cargar partidas en el navegador (`localStorage`), marcarlas como
  favoritas, y exportar o importar partidas en `.json`.

## Niveles del ordenador

| Nivel | Motor |
|---|---|
| 1 | Jugadas al azar |
| 2 | Codicioso (material inmediato, profundidad 1) |
| 3 | Minimax con poda alfa-beta, profundidad 2 |
| 4–7 | + ordenación de jugadas, movilidad y búsqueda de quietud, profundidad 3 a 6 |
| 8 | Experimental: profundidad 3 con valores y pesos posicionales ajustados |

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

No modifica `ai.js`: imprime las constantes para pegarlas a mano
(`PIECE_VALUE_TUNED`, `PIECE_POSITION_TUNED`, `MOBILITY_WEIGHT_TUNED`), que solo
usa el nivel 8.
