# Traspaso — reparto-ajedrez

Actualizado: 2026-08-26 09:45Z · Sesiones previas: 4

## Objetivo

Terminar los trabajos a medias del repositorio
`/Users/salasgar/Documents/git/Ajedrez-triangular` aplicando la skill `reparto`.
Encargo de Juan Luis del 2026-08-24 (seis trabajos, decisiones delegadas), ampliado el
2026-08-25 con las tareas 11-15 y el 2026-08-26 con la 16 (regla de los reyes).

## Estado actual

**Las 15 tareas originales están LISTAS; quedan las 16-20, la cadena de arena del
2026-08-26.** Encargo de Juan Luis: centrarse en `rps-rey` (PPTR) y `rpsls-rey`
(PPTLSR) — las modalidades sin rey quedan APARCADAS por poco jugables — y validar
por elo las mejoras del motor: regla de reyes (16), arnés de arena A/B (17) y tres
candidatos EN SERIE (18 pesos de amenaza, 19 prima de invencibilidad, 20 quiescencia
extendida — banda ALTA). El estado por tarea vive en el tablón `reparto/_ESTADO.md`
(fuente de verdad: `reparto/hechos/`), regenerado el 2026-08-26T09:40Z.

La 13 cerró en dos sesiones: la primera arregló dos bugs reales del motor
(`6dcc509`) y dejó el diagnóstico completo; la segunda estabilizó el síntoma bajando
a la mitad los pesos de amenaza (`bb3c534`: capturas gratis ignoradas 147/220 →
57/220, verificado en posición fija y en autojuego). **Es mitigación**: la causa de
fondo (la quiescencia solo persigue capturas) queda diagnosticada y expresamente a la
espera del visto bueno de Juan Luis.

La 16 (2026-08-26, decisión de Juan Luis): en las modalidades -rey un rey nunca debe
poder colocarse junto al otro; se implementa poniendo K→K en `capturesConRey`
(variants.js) y revisando el caso de regresión de `rpsls-rey` que pasa a ser ilegal.
Ficha completa: `reparto/tareas/tarea-16-reyes-nunca-adyacentes.md`.

## Siguiente paso

Abrir una sesión de trabajo **MEDIO** que reclame la tarea 16 con la frase de abajo.

Banda de modelo para retomar: **MEDIO** — cambio de datos puntual más revisión de una
regresión, todo especificado en la ficha; nada de criterio abierto.

## Decisiones tomadas

| Decisión | Por qué |
|---|---|
| Las modalidades sin rey (`rps`, `rpsls`) quedan APARCADAS | Juan Luis (26-8-2026): poco jugables; ni condiciones de victoria ni tuneo. Todo el motor se centra en rps-rey y rpsls-rey |
| Las mejoras del motor se deciden POR ELO EN LA ARENA, tras bandera, con p<0.05 | Encargo de Juan Luis (26-8-2026); incluye el visto bueno a implementar la quiescencia extendida (tarea 20) con la arena como juez. Cadena 17→20 en serie porque comparten ai.js |
| Prima de invencibilidad como candidato de evaluación (tarea 19) | Idea de Juan Luis (26-8-2026): pasar de 1 depredador a 0 es un salto cualitativo que el término lineal no recoge. Criterio 3 de la nota de la coordinadora |
| Dos reyes nunca adyacentes en las modalidades -rey, vía K→K en `capturesConRey` | Decisión de Juan Luis (26-8-2026): regla del juego, como en el ajedrez clásico; con el filtro `canCapture()` de `6dcc509`, cambiar el dato basta y desaparece la única excepción de la matriz. Es la tarea 16 |
| El arreglo de fondo de la 13 no debe imponer «captura siempre lo gratis» | Criterio de Juan Luis (26-8-2026): renunciar a una captura por estrategia puede ser legítimo en PPT; el objetivo es una comparación honesta, no una regla. En `hechos/notas/s-20260825T093251-fde516e1.md` |
| Mitigar la 13 bajando los pesos de amenaza a la mitad (0.1/0.3), sin tocar `quiesce()` | Vía barata que dejó escrita la primera sesión de la 13; medida en posición fija (la inversión desaparece en las 6 profundidades) y en autojuego (−61%). Los pesos siguen siendo provisionales a la espera de arena |
| Ronda 15 aplicada: solo `dekle`/`all` entra; `trigonal` revertido a valores a ojo | Único candidato significativo en arena; `trigonal` llevaba desde `c388624c` un candidato PERDEDOR aplicado por leer el signo del elo al revés |
| El corte del reparto: tareas por dependencias; las nuevas se añaden al final (así entraron la 10-16), nunca se renumera | Los números están citados en fichas, reclamos y hechos |
| `rps` y `rpsls` se quedan con el setup `base` | Segunda tanda de arena (96 partidas): las 6 candidatas dan 69-94 % de tablas. Tabla en `entrenamiento/rps-posiciones-resumen.md` |
| Duración esperada de la 13: 6 h (quedó cerrada; el dato vale como calibración) | La estimación original de 3 h se quedó corta a la mitad |
| `hechos/` mínimo, en el árbol del repo, commiteado como copia de seguridad | Todas las sesiones son locales y comparten el árbol |
| Los `traspaso-*.md` se commitean al repo | Delegación expresa del 2026-08-24; reversible |
| `tablas` restringido a fácil y medio | Revocable en `autorizaciones.md` |

## Descartado — no volver a proponer

| Se descartó | Motivo |
|---|---|
| La hipótesis de la «caza» (`RPS_PESO_CAZA`) como causa del fallo de la 13 | Descartada con datos (término estable ~60-65); el salto está en «amenaza». Ver el fallo de la 13 |
| Medir un cambio de pesos comparando partidas de autojuego completas | Divergen desde la primera jugada; se compara en la MISMA posición fija (barrido de profundidad) |
| Subir el presupuesto de nodos del nivel 8 como arreglo de la 13 | Con 20× nodos el hueco se reduce pero no desaparece; inviable en tiempo real |
| Tratar la adyacencia de reyes como legal porque la matriz decía que K no captura K | La regla del juego es la contraria (decisión de Juan Luis, 26-8-2026); el dato de la matriz era el error, no `isAttackedFast` |
| `./instalar-servicio.sh resultados` como fuente de datos de la ronda 15 | Corpus viejo en `~/Library`; lo autoritativo es `entrenamiento/r15/` del repo |
| Diseñar candidatas nuevas de posición inicial para `rps`/`rpsls` | Sin rey ninguna partida acaba de forma natural; sería tocar condiciones de victoria (decisión pendiente de Juan Luis) |
| Editar las skills instaladas en `~/.claude/skills/` | Son copias; la fuente la mantiene Juan Luis. Las mejoras se le proponen como texto |
| `git add` por nombre sin mirar el diff · `sleep` en primer plano · forzar reservas del harness · sid en fichero genérico de `/tmp` | Costumbres del repo, todas con su porqué en el tablón y las incidencias |

## Archivos

- `reparto/_ESTADO.md` — el tablón; empieza por aquí. Al día a 2026-08-26T09:00Z.
- `reparto/tareas/tarea-16-reyes-nunca-adyacentes.md` — la tarea libre que abre la
  cadena (ahora incluye actualizar el dorado de dekle, ya no opcional).
- `reparto/tareas/tarea-17-arena-motor.md`, `tarea-18-arena-pesos-amenaza.md`,
  `tarea-19-arena-invencibilidad.md`, `tarea-20-arena-quiescencia.md` — la cadena de
  arena, en serie; cada ficha es autocontenida.
- `reparto/hechos/notas/s-20260825T093251-fde516e1.md` — las dos decisiones de Juan
  Luis del 26-8 con su porqué.
- `reparto/hechos/terminadas/13--s-20260826T022659-6a71f33e.md` y
  `reparto/hechos/fallos/13--s-20260825T090706-b85c3e30.md` — la historia completa de
  la 13: diagnóstico, bugs, mitigación y lo pendiente de fondo.
- `reparto/salidas/13-rescate-scratchpad-s-20260825T093251-fde516e1/` — los repro y
  datos de la primera sesión de la 13 (la posición del ply 16 incluida); ya sirvieron
  a la sesión que cerró.
- `reparto/proyecto.md` — ficha fija: rutas, bandas (ALTO=Fable 5, MEDIO=Sonnet 5,
  BAJO=Haiku 4.5 a 2026-08-24), reglas del repo y frase de arranque.
- `reparto/autorizaciones.md` — firmas de Juan Luis; solo lo edita él. Tres firmadas.
- `entrenamiento/problemas-cosechados.json` — los 89 problemas de la 14, sin enganchar.

## Contexto que no está en los archivos

- **Decisiones que le quedan a Juan Luis** (el 26-8 resolvió tres: quiescencia → 
  tarea 20, sin-rey → aparcadas, dorado de dekle → dentro de la 16): (1) enganchar
  los 89 problemas cosechados al almacén vivo y/o cosechar más modalidades; (2)
  aplicar o no la ronda 14 de temperatura (completa en disco); (3) tirar el
  `stash@{0}`; (4) si algún día quiere ocultar `rps`/`rpsls` del selector de la app.
- Dos sesiones sellaron cierres con la hora local etiquetada como Z (~2 h de adelanto
  ficticio); anotado en la incidencia de la coordinadora. Sellar siempre con `date -u`.
- Una sesión de trabajo puede pasar horas computando sin escribir nada: antes de darla
  por muerta, mirar procesos `node` y su scratchpad en `/private/tmp/claude-501/…`.
- Juan Luis hace de correo entre sesiones pegando mensajes literales; darle siempre
  los textos listos para copiar (está también en la memoria del proyecto).

---

Lo primero que hará la sesión nueva: reclamar la tarea 16 y aplicar la regla de los
reyes siguiendo su ficha.

Banda para abrirla: **MEDIO** — cambio de datos y regresión, sin criterio abierto.

Frase para la sesión de trabajo (encadenada: una sesión puede hacer varias tareas
consecutivas de su banda, reclamando y cerrando cada una por el protocolo — ahorra
la parte fija de arranque de cada sesión; decidido con Juan Luis el 26-8-2026):

> Trabaja en el reparto del repositorio
> `/Users/salasgar/Documents/git/Ajedrez-triangular`, carpeta `reparto/`. He abierto
> esta sesión con un modelo de banda MEDIO. Lee `reparto/proyecto.md` y
> `reparto/_ESTADO.md`, lista `reparto/hechos/`, y reclama la tarea libre de banda
> MEDIO con el número más bajo siguiendo el protocolo del tablón (ahora mismo, la
> 16; cada ficha es autocontenida). Cuando cierres una tarea del todo —terminada,
> CERRADA en tu reclamo, tablón regenerado, commit y push—, reclama la siguiente
> libre de banda MEDIO y continúa. Encadena así mientras te quede contexto de
> sobra; cuando notes que la conversación se alarga o va lenta, no empieces tarea
> nueva: cierra limpio la que tengas (con su fallo de «sesión agotada» si queda a
> medias) y dímelo. No toques la tarea 20, que es de banda ALTO. Dime en cada
> momento qué tarea tienes y con qué identificador de sesión.

Para la 20 (cuando la 19 esté LISTA), sesión aparte de banda ALTO con la frase
estándar del tablón pidiendo la tarea 20.
