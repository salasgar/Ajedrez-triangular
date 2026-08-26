# Tarea 21 · Candidato en la arena: evaluación PROPORCIONAL (idea de Juan Luis)

Creada: 2026-08-26 (sesión coordinadora s-20260825T093251-fde516e1; la propuesta es
de Juan Luis, criterio 4 de `hechos/notas/s-20260825T093251-fde516e1.md` — léelo)
Precondición: 18 LISTA (mismo ai.js: un escritor cada vez; el vigente de referencia
incluye ya los pesos que decidió la 18)
Disparo: MANUAL · Duración esperada: 8 h (implementación + CPU de arena) · Banda:
MEDIO, con cláusula: si una decisión de diseño no está cubierta por esta ficha, se
para y se pregunta a Juan Luis en vez de improvisar
Salida (dueña exclusiva): `main` (ai.js — la evaluación nueva tras bandera) +
`entrenamiento/` (logs y resúmenes de sus tandas)

## Antes de empezar
Protocolo estándar (reclamo `21--<sid>.md`, caduca +16 h, sleep 30 en segundo plano;
comprobación barata con `terminadas/21--*`). Lecturas: el criterio 4 de la nota de la
coordinadora, la terminada de la 17 (arnés, partidas/hora) y la de la 18 (pesos
vigentes).

## La propuesta (de Juan Luis, literal en lo esencial)
Nada de sumar/restar valores por pieza. Se evalúa la PROPORCIÓN resultante:

1. Para cada tipo de figura t (sin el rey):  q_t = (propias_t + 1) / (totales_t + 1).
2. Un cociente más de calidad posicional:
   q_pos = (suma de valores posicionales de mis piezas) /
           (suma de valores posicionales de todas las piezas).
   El valor posicional de una pieza combina cuatro señales, todas derivadas de la
   matriz de capturas (así generaliza sola a rpsls-rey): cercanía a su PROTECTOR
   propio más próximo (la pieza propia que come a su depredador: la piedra protege
   al papel en rps), cercanía a su PROTEGIDO propio más próximo (a quien ella
   defiende: el papel es útil cerca de la tijera propia), dominio del centro, y
   cercanía a presas rivales desprotegidas. Reutiliza `rpsDist`/`rpsInfo`.
3. G = media geométrica de todos los cocientes. Prima de invencibilidad cuando un
   q_t = 1 CON propias_t > 0 (todas las piezas vivas de ese tipo son mías: mis
   depredados-por-t quedan invencibles).
4. Puntuación final con signo, simétrica para el minimax:
      score = k · (ln G_propio − ln G_rival)
   (el logaritmo convierte la media geométrica en media aritmética de logaritmos:
   barato, estable, y cero cuando la posición está equilibrada). k escala al rango
   habitual de la evaluación (~valor de una pieza ≈ 100); elígelo para que capturar
   una pieza «normal» en la posición inicial mueva el score en ese orden.

## Decisiones ya tomadas (no reabrir; el porqué, en la nota)
- Un tipo extinto EN AMBOS bandos se EXCLUYE de la media (el +1 daría cociente 1 a
  los dos, un artefacto). La prima exige propias > 0.
- El rey queda FUERA de los cocientes; el jaque, el mate y la regla de reyes
  adyacentes (tarea 16) siguen siendo asunto de la búsqueda, sin cambios.
- MVV-LVA y el margen de poda de `quiesce()` necesitan un valor por captura: se
  deriva de la propia fórmula (delta del score al retirar del tablero la pieza
  capturada), NO de una tabla de valores. Cachea recuentos para que sea barato.
- Todo tras bandera en `RPS_CFG` (tarea 17), por defecto APAGADA. Con la bandera
  apagada, ni un nodo de diferencia; las modalidades clásicas ni la miran.

## Qué hay que hacer
1. Implementar la evaluación proporcional tras la bandera, como alternativa completa
   a `evaluateRps` (los términos aditivos de amenaza/caza no se mezclan con ella:
   es un modelo u otro).
2. Verificación funcional barata ANTES de la arena: el barrido de profundidad de la
   posición del ply 16 (`reparto/salidas/13-rescate-scratchpad-*/posicion-ply16.json`)
   con la evaluación nueva — la captura gratis debe ganar en todas las profundidades
   y la oscilación no debe reaparecer. Si reaparece, anota los números y replantea
   antes de gastar CPU.
3. Medir con `arena-motor.js` (17) nueva-contra-vigente en `rps-rey` y `rpsls-rey`,
   dimensionando con las partidas/hora medidas. Si hace falta calibrar k o la prima,
   máximo 2-3 variantes razonadas, como la 18.
4. Decidir con p<0.05 (elo(A-B) POSITIVO = el candidato PIERDE): si gana, la bandera
   queda encendida por defecto y el comentario documenta la fórmula y la fecha; si
   no, apagada con los números en la terminada.
5. Tests en verde; commit a `main` y push.

## Consecuencias para la cadena (escríbelas en tu terminada)
- Si la evaluación proporcional QUEDA VIGENTE: la 19 (prima sobre el modelo aditivo)
  pierde su objeto —la prima ya está dentro— y la 20 cambia de premisa (los términos
  acotados pueden haber eliminado la oscilación). Dilo explícitamente en la terminada
  para que sus comprobaciones baratas lo encuentren.
- Si NO queda vigente: la 19 y la 20 siguen tal cual sobre el modelo aditivo.

## Autorización de máquina
Encargo expreso de Juan Luis (2026-08-26). Máximo 2 procesos node; segundo plano;
caducidad estirada ANTES de cada tanda; latido por comparación.

## Trampas conocidas
- elo(A-B) positivo = el candidato PIERDE (el malentendido del bug de trigonal).
- No comparar con autojuegos completos fuera del arnés (divergen).
- `probSaldoQuieto`/quiescencia tienen coste fuera del tope de nodos; la evaluación
  nueva no debe ser mucho más cara por nodo — mide el coste y anótalo.
- Datos al repo; git lento en segundo plano; sellos en UTC.

## Prohibido
- Tocar los pesos del modelo aditivo (decididos por la 18) o `quiesce()` (tarea 20).
- Las modalidades sin rey (aparcadas) y la arena masiva de posiciones.
