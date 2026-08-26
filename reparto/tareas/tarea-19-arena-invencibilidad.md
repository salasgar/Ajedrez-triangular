# Tarea 19 · Candidato 2 en la arena: prima de invencibilidad

Creada: 2026-08-26 (sesión coordinadora s-20260825T093251-fde516e1; la idea es de
Juan Luis, criterio 3 de `hechos/notas/s-20260825T093251-fde516e1.md`)
Precondición: 21 LISTA (recableada el 2026-08-26: la evaluación proporcional de la
21 lleva la prima DENTRO, así que hay que saber primero si queda vigente; además,
mismo ai.js: un escritor cada vez)
**Comprobación barata al abrir**: lee `hechos/terminadas/21--*`. Si dice que la
evaluación proporcional quedó VIGENTE, esta tarea pierde su objeto — no la reclames:
avisa a Juan Luis y que decida si se marca sustituida. Si la proporcional NO entró,
sigue tal cual sobre el modelo aditivo.
Disparo: MANUAL · Duración esperada: 5 h (casi todo CPU de arena) · Banda: MEDIO
Salida (dueña exclusiva): `main` (ai.js — el término nuevo y su constante) +
`entrenamiento/` (logs y resúmenes de sus tandas)

## Antes de empezar
Protocolo estándar (reclamo `19--<sid>.md`, caduca +10 h, sleep 30 en segundo plano;
comprobación barata con `terminadas/19--*`). Lee ENTERA la nota
`hechos/notas/s-20260825T093251-fde516e1.md` (criterio 3: la motivación, el ejemplo
numérico y la advertencia) y la terminada de la 17 (arnés y partidas/hora).

## La idea (de Juan Luis, 2026-08-26)
Si mi tijera come el último papel rival, mis tijeras caen al suelo pero mis piedras
quedan (casi) invencibles — y esa invencibilidad es una ventaja grande que hoy la
evaluación no puntúa: el término de depredadores es lineal (−4 por cada uno) y pasar
de 1 a 0 vale lo mismo que de 2 a 1, cuando cero es un salto cualitativo.

## Qué hay que hacer
1. Implementar en `rpsValor` (o donde encaje mejor) una prima de invencibilidad
   configurable vía `RPS_CFG` (tarea 17), con valor por defecto 0 (apagada): un
   plus cuando `depredadoresVivos = 0`, mayor si además conserva presas vivas (una
   pieza invencible Y con presas caza con impunidad; una invencible sin presas es
   solo un muro — quizá dos primas, decide con datos).
   **Matiz -rey**: aquí el rey rival sigue pudiendo capturar (queda fuera de los
   recuentos de valor pero amenaza), así que «invencible» significa «sin
   depredadores de figura»; el único riesgo restante es que el rey se exponga. La
   prima debe tener sentido con ese residuo.
2. Elegir 2-3 magnitudes de prima razonadas (referencia: el hueco del ejemplo de la
   nota es de ~50-100 puntos por pieza) y medirlas contra el vigente con
   `arena-motor.js` SOLO en `rps-rey` (decisión de Juan Luis del 26-8-2026:
   `rpsls-rey` aplazada hasta optimizar `rps-rey`), dimensionando como la 18.
3. Vigilancia del incentivo perverso: comprueba en los logs que la prima no produce
   maniobras absurdas para forzar extinciones propias o conservar «rehenes» (la
   advertencia del comentario de `RPS_SIN_VICTORIA`). Si aparece, anótalo con
   partidas concretas: es un resultado tan valioso como el elo.
4. Decidir con p<0.05: si alguna magnitud gana, queda como valor por defecto con su
   comentario («medido en arena»); si no, la constante se queda a 0 documentada.
5. Tests en verde; commit a `main` y push.

## Autorización de máquina
Encargo expreso de Juan Luis (2026-08-26). Máximo 2 procesos node; segundo plano;
caducidad estirada ANTES de cada tanda; latido por comparación.

## Cómo saber que ha terminado
Resúmenes elo±intervalo y p por magnitud y modalidad; decisión aplicada o razonada;
tests en verde; commit y push.

## Al terminar
Cierre estándar; en la terminada, la tabla completa y lo observado sobre el
incentivo perverso (aunque sea «nada raro»).

## Trampas conocidas
- elo(A-B) positivo = el candidato PIERDE.
- No comparar con autojuegos completos fuera del arnés (divergen).
- Datos al repo; git lento en segundo plano; sellos en UTC.

## Prohibido
- Tocar los pesos de amenaza (ya decididos por la 18) o cualquier otra heurística.
- Las modalidades sin rey y la arena masiva de posiciones.
