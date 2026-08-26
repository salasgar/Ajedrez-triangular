# Tarea 20 · Candidato 3 en la arena: quiescencia con jugadas tranquilas

Creada: 2026-08-26 (sesión coordinadora s-20260825T093251-fde516e1; es el «arreglo de
fondo» de la 13, ahora con la vía de decisión fijada por Juan Luis: se implementa
tras bandera y LO DECIDE LA ARENA)
Precondición: 19 LISTA (mismo ai.js: un escritor cada vez; el vigente de referencia
acumula ya 18 y 19)
Disparo: MANUAL · Duración esperada: 8 h (diseño + CPU de arena) · Banda: **ALTO**
Salida (dueña exclusiva): `main` (ai.js — quiesce y lo que necesite alrededor) +
`entrenamiento/` (logs y resúmenes)

## Antes de empezar
Protocolo estándar (reclamo `20--<sid>.md`, caduca +16 h, sleep 30 en segundo plano;
comprobación barata con `terminadas/20--*`). Lectura obligada:
`hechos/fallos/13--s-20260825T090706-b85c3e30.md` (el diagnóstico completo del
mecanismo), las terminadas de la 13 (ambas sesiones), la nota de criterios
`hechos/notas/s-20260825T093251-fde516e1.md` y la terminada de la 17 (arnés).

## El problema de fondo (diagnosticado, dos veces confirmado)
`quiesce()` solo persigue capturas. En las modalidades con matriz, los términos de
amenaza cambian mucho con jugadas TRANQUILAS, así que su efecto nunca se verifica
tácticamente como sí se verifica una captura: la evaluación oscila entre
profundidades y el nivel alto deja pasar capturas gratis (la 13 lo MITIGÓ bajando
pesos; esta tarea ataca la causa). El criterio de Juan Luis: renunciar a una captura
por estrategia puede ser legítimo — el objetivo es que la comparación sea honesta,
no forzar capturas.

## Qué hay que hacer
1. Diseñar e implementar, tras bandera en `RPS_CFG` (por defecto APAGADA), una
   extensión de quiescencia que también persiga jugadas tranquilas cuyo efecto
   sobre la amenaza supere un umbral. Decisiones de diseño en tus manos (por eso la
   banda ALTA): cómo estimar barato «cambia mucho la amenaza» sin evaluar el tablero
   entero por jugada, cómo acotar la explosión del árbol (umbral, tope de jugadas
   tranquilas por nodo, solo en los primeros niveles de quiescencia…), y qué hacer
   con el margen de poda. Documenta las alternativas que descartes y por qué.
2. **Gated por construcción a las modalidades con matriz** (`V.captures`): con la
   bandera apagada, y en las modalidades clásicas siempre, ni un nodo de diferencia.
   Los tres tests idénticos con la bandera apagada son el mínimo; añade una
   comprobación explícita de que el clásico no cambia ni con la bandera encendida
   (no debe ni mirar la bandera).
3. Verificación funcional barata antes de gastar arena: el barrido de profundidad de
   la posición del ply 16 (`reparto/salidas/13-rescate-scratchpad-*/posicion-ply16.json`)
   con la bandera encendida y los pesos VIGENTES — si la oscilación entre
   profundidades no se estabiliza, replantea antes de medir elo.
4. Medir con `arena-motor.js` encendido-contra-apagado en ambas modalidades,
   dimensionando con las partidas/hora (ojo: la extensión encarece cada nodo — mide
   el coste real y anótalo; un candidato que gana elo por partida pero tarda el
   doble necesita esa discusión en la terminada).
5. Decidir con p<0.05 y aplicar (bandera encendida por defecto) o dejar apagada con
   el porqué. Tests en verde; commit a `main` y push.

## Autorización de máquina
Encargo expreso de Juan Luis (2026-08-26). Máximo 2 procesos node; segundo plano;
caducidad estirada ANTES de cada tanda; latidos frecuentes (esta tarea es larga).

## Cómo saber que ha terminado
La comprobación del ply 16 documentada; los resúmenes de arena con elo±intervalo, p
y coste por partida; la decisión aplicada o razonada; los tests en verde; commit y
push.

## Al terminar
Cierre estándar; la terminada lleva además el coste computacional medido y las
alternativas de diseño descartadas (para no re-explorarlas).

## Trampas conocidas
- elo(A-B) positivo = el candidato PIERDE.
- `probSaldoQuieto` y la quiescencia actual tienen coste FUERA del tope de nodos
  (documentado por la 14): cualquier extensión multiplica ese riesgo — pon límites
  de reloj, no solo de nodos.
- Si el diseño se te va a «rehacer la búsqueda entera», eso es una tarea mal
  cortada: incidencia con el corte natural, ABANDONADA, y avisar.
- Datos al repo; git lento en segundo plano; sellos en UTC.

## Prohibido
- Cambiar el comportamiento de las modalidades clásicas: ni un nodo.
- Tocar pesos o primas ya decididos por la 18 y la 19.
- Las modalidades sin rey y la arena masiva de posiciones.
