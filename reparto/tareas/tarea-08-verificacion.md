# Tarea 08 · Verificación en navegador de todo lo publicado

Actualizado: 2026-08-24
Precondición: tareas 05 y 07 LISTAS · Disparo: MANUAL
Duración esperada: 2 h · Banda de modelo: MEDIO
Salida (dueña exclusiva): `reparto/salidas/08-verificacion/`

Esta tarea existe porque tres trabajos (`insignia-captura`, `editor-posiciones`,
`problemas-imagen`) no tienen tarea propia: lo único que les faltaba era verificarse en
navegador, y verificar se hace junto y una sola vez.

## Antes de empezar
1. Lee `reparto/_ESTADO.md`, lista `reparto/hechos/`, comprueba las terminadas de la 05
   y la 07.
2. `date -u`, `sid`, reclamo `08--<sid>.md` (caduca: +4 h), `sleep 30`, volver a mirar.

## Objetivo
Comprobar en un navegador real (Chrome headless con capturas vale; es como se verificó
la línea PPT) todo lo que las tareas anteriores publicaron, incluidos los tres trabajos
sin tarea propia.

## Qué hay que hacer
Sobre `origin/main` servido en local, una lista cerrada de comprobaciones; cada una
deja su captura y su línea en el informe:

1. **Insignia de captura**: abrir `index.html`, capturar una pieza → disco rojo con la
   miniatura de la pieza y animación, no un círculo negro sin `fill`.
2. **Editor de posiciones**: abrir `editor.html`, diseñar → Guardar con nombre →
   Vaciar → Abrir (vuelve igual, incluido turno y modalidad) → Borrar. Es el ciclo que
   `traspaso-editor-posiciones.md` dejó pendiente.
3. **Pestaña Problemas**: generar un problema de cada tipo habilitado, resolver uno,
   pista, solución, guardar/abrir, exportar/importar `.json`.
4. **Problemas en imagen**: el botón «Imagen (.png)» junto a «Exportar» descarga el
   diagrama con el enunciado debajo; y desde el editor, la caja «Crear un problema»
   comprueba, guarda y exporta (los caminos negativos ya se probaron; basta el feliz).
5. **Editar tablero**: el ciclo completo del plan (jugar → editar → volver → deshacer →
   guardar/recargar).
6. **Modalidades PPT y demos de teselación**: se dibujan y las figuras toman el color
   del bando (re-comprobación rápida tras la reconciliación).
7. **Service worker**: la `VERSION` de `sw.js` es una sola y superior a la publicada
   antes del reparto, y `FICHEROS` contiene los ficheros nuevos; sin conexión, el
   editor sigue sirviéndose.

## Datos de entrada
- Los seis `traspaso-*.md` de la raíz — cada uno dice qué dejó sin verificar.
- `/Users/salasgar/.claude/plans/quiero-que-a-mitad-piped-rivest.md` — la sección de
  verificación manual de editar-tablero.

## Salida esperada
`reparto/salidas/08-verificacion/informe-<sid>.md` con las siete comprobaciones, su
resultado y sus capturas al lado (todo con marcador `.ok-<sid>`). Lo que falle no se
arregla aquí: se anota, se abre incidencia y se avisa — arreglar es de la tarea que
publicó, o de una nueva que decida Juan Luis.

## Cómo saber que ha terminado
Las siete secciones del informe tienen resultado escrito (BIEN o FALLA + detalle), y el
informe y sus capturas llevan marcador.

## Al terminar
Cierre estándar: terminada `08--<sid>.md` con el recuento (7/7 comprobadas, cuántas
BIEN), `CERRADA`, incidencias, regenerar tablón, `git add reparto/` + commit + push, y
el resumen a Juan Luis: esta es la tarea cuyo cierre le dice que el reparto entero está
entregado (salvo la 09, que espera su firma).

## Trampas conocidas
- Chrome headless: la app usa worker y `localStorage`; sirve la carpeta por http
  (`python3 -m http.server`) en vez de abrir `file://`, o el service worker no arranca.
- `test-ia-rps.js` y la generación de problemas difíciles tardan: no los des por
  colgados.

## Prohibido
- Arreglar aquí lo que falle (se anota y se avisa; el informe es la salida).
- Dar por verificado nada sin su captura o su salida de consola en el informe.
