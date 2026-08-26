# Tarea 18 · Candidato 1 en la arena: pesos de amenaza

Creada: 2026-08-26 (sesión coordinadora s-20260825T093251-fde516e1, encargo de Juan
Luis: validar por elo, en `rps-rey` y `rpsls-rey`, las modificaciones del motor)
Precondición: 17 LISTA · Disparo: MANUAL · Duración esperada: 5 h (casi todo CPU de
arena) · Banda de modelo: MEDIO
Salida (dueña exclusiva): `main` (ai.js — solo las constantes de amenaza y su
comentario) + `entrenamiento/` (los logs y resúmenes de sus tandas)

## Antes de empezar
1. Protocolo estándar del tablón: `proyecto.md`, `_ESTADO.md`, listar `hechos/`,
   `date -u`, `sid`, reclamo `18--<sid>.md` (caduca: +10 h), `sleep 30` en segundo
   plano. Comprobación barata: si `hechos/terminadas/18--*` existe, nada que hacer.
2. Lee la terminada de la 17 (comando del arnés y partidas/hora medidas) y el
   historial del cambio de pesos en `hechos/terminadas/13--s-20260826T022659-6a71f33e.md`.

## Contexto
La 13 bajó `RPS_AMENAZA` 0.2→0.1 y `RPS_AMENAZA_COLGADA` 0.6→0.3 midiendo TASA DE
CAPTURAS IGNORADAS (147/220 → 57/220), no elo. Queda por saber si eso se traduce en
jugar mejor de verdad, que es lo que pide Juan Luis. Los pesos siguen marcados
«PROVISIONALES a la espera de la arena» en ai.js.

## Qué hay que hacer
1. Con `entrenamiento/arena-motor.js` (tarea 17), medir en CADA modalidad
   (`rps-rey`, `rpsls-rey`):
   - vigente (0.1/0.3) contra los pesos antiguos (0.2/0.6);
   - vigente contra una bajada más (0.05/0.15).
   Dimensiona cada comparación con las partidas/hora de la 17 para tener potencia
   razonable (orientación: el proyecto ha decidido con ~100-200 partidas por
   comparación y p<0.05; si no da la máquina, prioriza rps-rey y dilo).
2. Decidir con el criterio estándar (p<0.05; elo(A-B) NEGATIVO = el candidato gana):
   el mejor juego de pesos por elo se queda como valor por defecto en ai.js, con el
   comentario actualizado (deja de ser «provisional»: pasa a «medido en arena, fecha
   y números»). Si nada es significativo, se quedan los vigentes y se anota.
3. Los tres tests en verde (la excepción del dorado de dekle ya no existe si la 16
   lo actualizó; si sigue, es la conocida).
4. Commit a `main` y push.

## Autorización de máquina
Encargo expreso de Juan Luis (2026-08-26). Máximo 2 procesos node; segundo plano;
estirar la caducidad ANTES de cada tanda; latido al terminar cada comparación.

## Cómo saber que ha terminado
Cada comparación tiene su resumen elo±intervalo y p en `entrenamiento/`; la decisión
está aplicada (o razonada la no-aplicación) en ai.js; tests en verde; commit y push.

## Al terminar
Cierre estándar: terminada con la tabla completa de resultados (todas las
comparaciones, ganen o pierdan), CERRADA, regenerar tablón, commit + push, avisar.

## Trampas conocidas
- elo(A-B) positivo = el candidato PIERDE (el malentendido causó el bug de trigonal).
- No medir con partidas de autojuego completas fuera del arnés: divergen desde la
  primera jugada (descarte documentado en el fallo de la 13).
- Datos al repo, nunca al scratchpad. Git lento, en segundo plano. Sellos en UTC.

## Prohibido
- Tocar cualquier otra constante o heurística de ai.js: un candidato por tarea, o
  las medidas no se pueden atribuir.
- Las modalidades sin rey (aparcadas) y la arena masiva de posiciones.
