# Tarea 22 · Candidato en la arena: acoso al rey rival (arregla la falta de contacto de la 21)

Creada: 2026-08-26 (sesión de consulta `s-20260826T173839-09708b47`, banda ALTO,
a partir del hallazgo y la decisión de Juan Luis en
`hechos/incidencias/s-20260826T173839-09708b47.md` — léela primero, es el
diagnóstico completo)
Precondición: 21 LISTA (mismo `ai.js`: un escritor cada vez; parte del vigente
que deje la 21, sea cual sea su veredicto sobre el proporcional puro)
**Comprobación barata al abrir**: lee la terminada de la 21 y
`hechos/incidencias/s-20260826T173839-09708b47.md`. Si alguna sesión posterior
ya implementó y midió esto (mira `hechos/terminadas/22--*` y `entrenamiento/`
por nombre), no la repitas.
**Lectura obligada además de lo anterior**: el reclamo completo de la 21
(`hechos/reclamos/21--s-20260826T095832-0470517d.md`), en especial sus latidos
de las 15:50Z y 16:15Z — llegó por su cuenta a "no es un problema de valorar
tipos sino de falta de iniciativa" antes de que existiera esta ficha, descartó
la aversión al cambio y midió que la sub-bandera `PROP_PESOS` (media ponderada
por `rpsValor`) corrige en la dirección buena el no distinguir tipos pero con
poca amplitud, y predijo que no bastará para el problema real. Si esa
predicción se confirma en su terminada, no hace falta repetir esa medición
aquí; si `PROP_PESOS` queda vigente, esta tarea se construye ENCIMA de ella
(son ortogonales: una pesa los cocientes por tipo, la otra añade una señal de
acercamiento).
Disparo: MANUAL · Duración esperada: 8 h (diseño + CPU de arena) · Banda:
**ALTO**, con cláusula: si una decisión de diseño no está cubierta por esta
ficha, se para y se pregunta a Juan Luis en vez de improvisar
Salida (dueña exclusiva): `main` (ai.js — el término nuevo de acoso) +
`entrenamiento/` (logs y resúmenes)

## Antes de empezar
Protocolo estándar (reclamo `22--<sid>.md`, caduca +16 h, sleep 30 en segundo
plano; comprobación barata con `terminadas/22--*`). Lectura obligada:
`hechos/incidencias/s-20260826T173839-09708b47.md` (el diagnóstico: en
autojuego proporcional-contra-sí-mismo, 0 capturas legalmente disponibles en
80 medias jugadas — ningún bando se acerca nunca), la terminada de la 21 (su
veredicto sobre el modelo proporcional puro) y `tareas/tarea-21-evaluacion-
proporcional.md` completa (la fórmula que este término extiende).

## El problema de fondo (diagnosticado y confirmado con guiones ad hoc,
reproducibles a partir de la descripción de la incidencia)
La evaluación proporcional (tarea 21) excluye a propósito los términos de
amenaza/caza del modelo aditivo. Su cociente posicional premia cercanía a tu
protector, a tu protegido, al centro y a presas rivales ya desprotegidas — pero
ninguna señal premia acercarse a amenazar. En una partida simétrica eso deja a
los dos bandos sin motivo para entrar en rango de contacto: el material que sí
se gana en partidas reales (por el contacto natural de la apertura) se queda
"guardado" sin convertir, porque no hay incentivo para seguir apretando.

## La propuesta (de Juan Luis, literal en lo esencial)
Un sesgo fuerte para que TODAS las piezas propias, salvo el rey, se acerquen lo
más posible al rey RIVAL — acosarlo. Las piezas rivales tendrán que interponerse
para protegerlo, y ahí aparece el contacto que hoy no existe.

**Condición explícita de Juan Luis, no negociable:** cuidado con que esto haga
que el PROPIO rey se lance a capturar al rey rival demasiado pronto. Que el
rey propio apoye el ataque cuando ya queden pocas piezas en el tablero es
bueno; que lo haga al principio de la partida no lo es (se expone él mismo sin
necesidad, y la búsqueda ya tiene reglas propias sobre jaque/mate y reyes no
adyacentes — tarea 16 — que no hay que interferir).

## Qué hay que hacer
1. Diseñar e implementar, tras bandera en `RPS_CFG` (por defecto APAGADA), un
   quinto ingrediente para `q_pos` (o un cociente nuevo en la media, decisión
   tuya cuál encaja mejor sin romper la normalización existente —
   `rpsPropPosicional`, ai.js:717-781): cercanía de cada pieza propia (no el
   rey) al rey rival, reutilizando `rpsDist`/`rpsInfo`/`rpsPropInfo` como las
   otras cuatro señales.
   - **Aclaración para no reabrir una decisión ya tomada:** "el rey queda
     fuera de los cocientes" (tarea 21) significa que el rey no cuenta como
     figura en `q_t` ni tiene valor de mercado — no significa que su CASILLA
     no pueda usarse como punto de referencia geométrico, igual que ya se usa
     el centro del tablero. Este término no reabre esa decisión: el rey rival
     sigue sin ser una "presa" ni valer nada si se captura, solo actúa como
     imán de posición para las demás piezas.
2. Diseña el freno para el rey PROPIO por separado, no como el mismo peso que
   las demás piezas. Alternativas razonables (elige y documenta por qué,
   máximo 2-3 variantes como en la 18): un peso multiplicador que escale con
   qué tan poco material queda en el tablero (por ejemplo, con `wPos` o con el
   recuento total de figuras vivas de `rpsInfo().figuras`), o directamente
   dejar al rey propio con peso 0 en este término hasta que el recuento total
   caiga por debajo de un umbral. Verifica explícitamente en una posición de
   apertura/mediojuego (muchas piezas vivas) que el rey propio no se adelanta
   más que en el juego vigente sin la bandera.
3. **Gated por construcción a las modalidades con matriz** (`V.captures`), como
   toda la familia de banderas de `RPS_CFG`: con la bandera apagada, y en las
   modalidades clásicas siempre, ni un nodo de diferencia. Los tests idénticos
   con la bandera apagada son el mínimo; añade la comprobación explícita de
   que el clásico no cambia ni con la bandera encendida.
4. Verificación funcional barata antes de gastar arena: repite el diagnóstico
   de la incidencia (autojuego proporcional-contra-sí-mismo con handicap de 8
   piezas, o el mismo guion si lo recuperas del scratchpad de la sesión de
   consulta — no está comiteado, tendrás que rehacerlo, es corto) y confirma
   que con la bandera encendida SÍ aparecen capturas y SÍ hay mates. Si sigue
   sin haber contacto, el peso o la señal están mal calibrados — no gastes
   arena todavía.
5. Mide con `arena-motor.js`: proporcional-CON-acoso contra el vigente que deje
   la 21 (que puede ser el aditivo, si la 21 pierde como es esperable, o el
   proporcional puro si por lo que sea gana). SOLO en `rps-rey` (decisión de
   Juan Luis del 26-8-2026 vigente para toda la cadena), dimensionando con las
   partidas/hora medidas por la 17. Mide también el coste por partida: este
   término se paga en cada hoja de la búsqueda.
6. Decidir con p<0.05 (elo(A-B) POSITIVO = el candidato PIERDE) y aplicar
   (bandera encendida por defecto) o dejar apagada con el porqué. Documenta en
   la terminada, además del veredicto, si el patrón de "material sin
   convertir" de la incidencia desapareció (compáralo contra el vigente
   anterior con el mismo tipo de comprobación: partidas decididas en el
   tablero vs. adjudicadas por material, como hizo la sesión de la 21).
7. Tests en verde; commit a `main` y push.

## Autorización de máquina
La misma autorización expresa de Juan Luis (2026-08-26) que cubre toda esta
cadena de arena: máximo 2 procesos node, segundo plano, caducidad estirada
ANTES de cada tanda, latidos frecuentes.

## Cómo saber que ha terminado
La comprobación funcional del punto 4 documentada (con capturas y mates
reales, no solo teoría); el resumen de arena con elo±intervalo, p y coste por
partida; la decisión aplicada o razonada; los tests en verde; commit y push.

## Al terminar
Cierre estándar. La terminada debe dejar explícito, para la 19 y la 20 (que
dependen de esta tarea, no ya de la 21 directamente): si el proporcional-con-
acoso queda vigente, sus premisas cambian igual que si hubiera ganado la 21
directamente (la 19 pierde objeto si la prima ya está dentro del modelo
vigente; la 20 cambia de premisa si la oscilación por jugadas tranquilas
desaparece).

## Trampas conocidas
- elo(A-B) positivo = el candidato PIERDE.
- El riesgo de diseño más probable es el que ya avisó Juan Luis: un rey propio
  demasiado agresivo demasiado pronto se expone a perder por su cuenta lo que
  el acoso ganó en material — mide partidas decididas por color y por fase
  (quién arriesgó más al rey) si el resultado global sale peor de lo esperado.
- No mezclar este término con los de amenaza/caza del modelo ADITIVO — sigue
  siendo un modelo proporcional puro, solo que con una señal posicional más.
- Datos al repo; git lento en segundo plano; sellos en UTC.

## Prohibido
- Cambiar el comportamiento de las modalidades clásicas: ni un nodo.
- Tocar los cocientes `q_t` por tipo, la prima de invencibilidad, o cualquier
  otra decisión ya cerrada de la tarea 21 que no sea `q_pos`.
- Las modalidades sin rey (aparcadas) y la arena masiva de posiciones.
