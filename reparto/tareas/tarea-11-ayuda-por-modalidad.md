# Tarea 11 · Ayuda y reglas adaptadas a cada modalidad (sin reglas de peón donde no hay peones)

Creada: 2026-08-25 (sesión s-20260824T233011-d4d13c52, ampliación del reparto)
Precondición: ninguna · Disparo: MANUAL
Duración esperada: 1 h · Banda de modelo: MEDIO
Salida (dueña exclusiva): `main` (index.html y script.js, solo la sección de ayuda)

## Antes de empezar
1. Lee `reparto/proyecto.md` y `reparto/_ESTADO.md`; lista `reparto/hechos/`.
2. `date -u`, `sid`, reclamo `11--<sid>.md` (caduca: +2 h), `sleep 30` en segundo
   plano, volver a mirar.
3. **Mira `.claude/sesiones/*.json`**: `index.html` y `script.js` los reclama a menudo
   otra sesión (el 2026-08-24 los tenía la 8df0fd81). Si están reclamados, no los
   toques: espera o anota la incidencia y suéltala.
4. Comprobación barata: abre la ayuda en una modalidad PPT y mira si sigue hablando de
   comida al paso. Si ya no, alguien lo arregló: ciérrala como terminada sin trabajo.

## El problema, contado por Juan Luis (2026-08-25)
En las reglas de las modalidades de piedra, papel y tijera se habla de comida al paso
«y cosas así» que no tienen sentido, porque en esas modalidades no hay peones.
**Aclaración expresa suya del mismo día: la comida al paso SÍ tiene sentido —y debe
seguir apareciendo— en las modalidades que tienen peones.** No se trata de borrar el
texto, sino de que cada modalidad muestre solo las reglas que le aplican.

## Qué hay que hacer
1. Diagnosticar por qué falla el mecanismo que ya existe:
   `script.js:1874` ya hace
   `help-enpassant.classList.toggle('hidden', !V.pieces.P)` — así que o `V.pieces.P`
   es verdadero en las modalidades PPT sin serlo de verdad, o la ayuda que ve el
   usuario sale de otro sitio distinto de esta sección. Averiguarlo antes de tocar.
2. Auditar TODOS los puntos de la ayuda por modalidad, no solo el del paso:
   - `help-enpassant` (index.html:203) — solo con peones.
   - `help-draws` (index.html:208) — el texto de las 50 jugadas dice «sin capturas ni
     movimientos de peón»; en modalidades sin peones esa coletilla sobra. Ya hay un
     `innerHTML` condicional en script.js:1876 para `kingless`: seguir ese patrón.
   - `help-castling`, `help-check` — ya condicionados (script.js:1869, 1875);
     comprobar que la condición acierta en las 4 modalidades PPT.
   - Promoción y doble avance de peón, si se mencionan en `help-pieces` o en el texto
     de la variante (`V.help`, definido por modalidad en variants.js).
3. Revisar de paso si las modalidades PPT necesitan una línea de ayuda propia sobre
   quién captura a quién (piedra>tijera>papel>piedra); si `V.help` ya lo trae, no
   inventar nada.
4. Verificar en navegador las 4 modalidades PPT y al menos una clásica (que el paso
   SIGUE saliendo donde hay peones).
5. Commit a `main` y push.

## Datos de entrada
- index.html:196-208 (sección de ayuda) y script.js:1863-1899 (su render).
- variants.js — definición de `V.pieces` y `V.help` por modalidad.

## Cómo saber que ha terminado
En las 4 modalidades PPT la ayuda no menciona peones ni comida al paso; en las
modalidades con peones la comida al paso sigue explicada; verificado en navegador.

## Al terminar
Cierre estándar: terminada `11--<sid>.md`, `CERRADA` en el reclamo, incidencias si las
hay, regenerar el tablón (recopiando la columna Banda de los ficheros de tarea),
`git add reparto/` + commit + push, y decir a Juan Luis qué queda libre.

## Trampas conocidas
- Git tarda 1-3 minutos por orden; en segundo plano y vigilando `.git/index.lock`.
- El árbol lo comparten varias sesiones: jamás `git add` por nombre de fichero
  tracked-modificado sin mirar antes el diff (receta en la memoria del proyecto).
- La raíz del repo tiene ficheros de depuración sueltos de otra sesión
  (editor-debug.html, diagnose.html…): no son tuyos, no los toques ni los commitees.

## Prohibido
- Quitar la comida al paso de las modalidades CON peones (instrucción expresa).
- Tocar la lógica de juego (rules.js): esta tarea es solo de textos de ayuda y su
  condición de visibilidad.
- Editar index.html/script.js si otra sesión los tiene reclamados en `.claude/sesiones/`.
