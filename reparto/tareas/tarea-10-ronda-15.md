# Tarea 10 · Aplicar los resultados de la ronda 15 del entrenamiento

Actualizado: 2026-08-24
Precondición: tareas 03 y 04 LISTAS (las tres tocan `variants.js`; en serie) · Disparo: MANUAL
Duración esperada: 2 h · Banda de modelo: MEDIO
Salida (dueña exclusiva): `main` (`variants.js`, `valores-origen.json`,
`docs/valores-piezas.pdf`, README de `entrenamiento/`)

Añadida el 2026-08-24 por la sesión montadora al descubrir, durante la tarea 01, que
la ronda 15 había cerrado (los tres `*-hecha.txt` en `entrenamiento/r15/`). No estaba
entre los seis trabajos del reparto; entra por el encargo original («más lo que se
estime que merece la pena hacer»).

## Antes de empezar
1. Lee `reparto/_ESTADO.md`, lista `reparto/hechos/`, comprueba las terminadas de la
   03 y la 04.
2. `date -u`, `sid`, reclamo `10--<sid>.md` (caduca: +4 h), `sleep 30` en segundo
   plano (el de primer plano está bloqueado), volver a mirar.

## Objetivo
La ronda 15 midió por primera vez los valores de las piezas de `salas-1998`, `dekle` y
`trigonal` (hasta ahora a ojo; solo `salas` estaba medida). El resultado no se aplica
solo: **la regresión propone, la arena decide**.

## Qué hay que hacer
1. Leer los marcadores y resultados: `./entrenamiento/instalar-servicio.sh resultados`,
   y los ficheros `entrenamiento/r15/ajuste-*-{mat,all}.txt` (ya commiteados en la 01).
   Los marcadores pueden estar también en
   `~/Library/Application Support/ajedrez-triangular-entrenamiento/`.
2. Por cada modalidad: los valores nuevos entran en el bloque `engine` de esa modalidad
   en `variants.js` **solo si ganan en la arena** (en la ronda 6 el candidato de la
   regresión perdió; puede volver a pasar y entonces no se toca nada).
3. Si algún valor entra: regenerar `docs/valores-piezas.pdf` con
   `node entrenamiento/valores-pdf.js` (encargo permanente de la memoria del proyecto),
   actualizar `valores-origen.json` y la sección de la ronda 15 del README de
   `entrenamiento/`.
4. Commitear y push. Detrás de la 15 queda la 14 a medias (le faltan `t25_45`, `t45_70`
   y `t70_150`): NO relanzarla aquí; anotar su estado en la terminada y que decida
   Juan Luis.

## Datos de entrada
- `entrenamiento/r15/` — logs, corpus, ajustes y marcadores, en git desde la tarea 01.
- Memoria del proyecto `entrenamiento-ronda-15.md` — el criterio, resumido arriba.

## Salida esperada
`origin/main` con los valores que hayan ganado su arena aplicados, el PDF regenerado si
cambió algo, y la terminada contando modalidad a modalidad qué pasó.

## Cómo saber que ha terminado
Por cada una de las tres modalidades hay una línea escrita: «entra con estos valores» o
«no entra, perdió la arena con este resultado». Si algo entró, el PDF regenerado está
commiteado.

## Al terminar
Cierre estándar: terminada `10--<sid>.md`, `CERRADA`, incidencias, regenerar tablón,
`git add reparto/` + commit + push, y decir a Juan Luis el resultado por modalidad.

## Trampas conocidas
- Git tarda 1-3 minutos por orden; las arenas de confirmación, mucho más: estira
  `caduca:` antes y lánzalas en segundo plano.
- `du` marca 0B en ficheros evictados por iCloud; `ls -l` da el tamaño real.

## Prohibido
- Aplicar valores que no hayan ganado su arena.
- Relanzar la ronda 14 o cualquier entrenamiento sin que lo pida Juan Luis.
