# Tarea 06 · Rendimiento y equilibrio del almacén de problemas

Actualizado: 2026-08-24
Precondición: tarea 05 LISTA · Disparo: MANUAL
Duración esperada: 2 h · Banda de modelo: MEDIO
Salida (dueña exclusiva): `main` (`problemas.js`, `problemas-ui.js`) y
`entrenamiento/` (los tres scripts de medición)

## Antes de empezar
1. Lee `reparto/_ESTADO.md`, lista `reparto/hechos/`, comprueba la terminada de la 05.
2. `date -u`, `sid`, reclamo `06--<sid>.md` (caduca: +4 h), `sleep 30`, volver a mirar.

## Objetivo
Tres flecos del motor de problemas que la integración (05) deja pendientes: los niveles
`dificil` y `experto` están sin medir tras el último cambio, el almacén se
descompensará hacia `tablas` si nadie lo equilibra, y la decisión sobre `tablas` en
niveles altos ya está tomada y hay que aplicarla.

## Qué hay que hacer
1. **Rehacer los tres scripts de medición y dejarlos en `entrenamiento/`** (los
   originales vivían en un scratchpad de sesión y se perdieron al purgarse; comprobado
   el 2026-08-24). Según `traspaso-problemas.md` eran: `prueba-problemas.js`
   (verificador independiente: recorre el árbol a pelo con las reglas, sin usar el
   buscador), `rendimiento.js` (problemas por minuto con la configuración real) y
   `diagnostico.js` (a qué profundidad se resuelven). Cargan el juego con `vm` en Node.
2. **Volver a medir `dificil` y `experto`**: la última medición (0 problemas/minuto) es
   ANTERIOR a `probMaxSoluciones` (la relajación de unicidad con la profundidad), que
   se hizo justo para arreglar eso. Si siguen a cero, bajar `escapes` o subir `tope` en
   `PROB_NIVELES`, y volver a medir.
3. **Equilibrar `probRepon`**: hoy pide «cualquier tipo» y `tablas` es ~100 veces más
   barato de generar, así que copará el almacén. Debe pedir el tipo con menos
   ejemplares.
4. **Restringir `tablas` a fácil y medio** y deshabilitar la opción del selector en
   difícil y experto. Decisión tomada por delegación el 2026-08-24 y anotada en
   `reparto/autorizaciones.md`; si Juan Luis la ha revocado ahí, haz lo que diga esa
   nota.
5. Verificar con el verificador independiente que lo generado sigue siendo correcto,
   commitear y push.

## Datos de entrada
- `traspaso-problemas.md` — rendimientos medidos, decisiones y descartes del motor.
- `reparto/autorizaciones.md` — la decisión sobre `tablas`, revocable por Juan Luis.

## Salida esperada
Los tres scripts en `entrenamiento/`, commiteados; `dificil` y `experto` con
rendimiento medido y distinto de cero (o la explicación medida de por qué no);
`probRepon` equilibrado; `tablas` restringido.

## Cómo saber que ha terminado
`node entrenamiento/rendimiento.js` da números > 0 en los cuatro niveles para los tipos
habilitados; el selector deshabilita `tablas` en difícil/experto; un almacén regenerado
de cero no queda copado por un solo tipo.

## Al terminar
Cierre estándar: terminada `06--<sid>.md` con los números medidos, `CERRADA`,
incidencias, regenerar tablón, `git add reparto/` + commit + push, y decir a Juan Luis
qué queda libre — y los números nuevos de rendimiento, que le interesan.

## Trampas conocidas
- El tablero hexagonal cambia la intuición: un rey tiene hasta DOCE vecinas y los mates
  forzados son raros; cualquier ajuste del generador tiene que contar con el filtro de
  acorralamiento previo.
- El presupuesto de búsqueda cuenta jugadas examinadas, no nodos (decisión medida; no
  lo cambies).
- Los scripts van a `entrenamiento/`, no al scratchpad: el scratchpad se purga a
  medianoche y así se perdieron los originales.

## Prohibido
- Exigir tablas forzadas en dos o más jugadas (descartado: medido, no salen nunca).
- Cambiar el criterio de unicidad de solución sin medir antes y después.
