# Tarea 15 · `editor.html` no funciona sin conexión (desajuste `?v=N` con `sw.js`)

Creada: 2026-08-25 (sesión s-20260824T235504-fde8fd6d, a partir del fallo real
encontrado en la tarea 08 de verificación; Juan Luis autorizó abrirla y que la coja la
misma sesión)
Precondición: ninguna · Disparo: MANUAL
Duración esperada: 1 h · Banda de modelo: MEDIO
Salida (dueña exclusiva): `main` (`editor.html` y/o `sw.js`, según la opción elegida)

## Antes de empezar
1. Lee `reparto/proyecto.md` y `reparto/_ESTADO.md`; lista `reparto/hechos/`.
2. `date -u`, `sid` (si retomas con una sesión nueva; si eres la misma que la creó,
   reusa tu sid), reclamo `15--<sid>.md` (caduca: +2 h), `sleep 30` en segundo plano,
   volver a mirar.
3. **Mira `.claude/sesiones/*.json`**: `editor.html` puede estar reclamado por otra
   sesión. Si lo está, no lo toques: espera o anota la incidencia y suéltala.
4. Lee entero `reparto/hechos/incidencias/s-20260824T235504-fde8fd6d.md` — ahí está el
   diagnóstico completo, ya hecho; esta tarea no repite el diagnóstico, aplica el
   arreglo.

## El problema, ya diagnosticado por la tarea 08
`editor.html` carga sus nueve scripts con cadena de versión en la URL
(`geometry.js?v=1`, `editor.js?v=3`, etc.), pero `sw.js` cachea `FICHEROS` sin esa
cadena. `caches.match()` compara la URL completa (con `ignoreSearch` a `false` por
defecto), así que ninguno de los nueve hace hit en caché sin conexión. El `fetch()` de
reserva falla sin red, y el `.catch(() => caches.match('./index.html'))` del final del
handler de `fetch` en `sw.js` —pensado para navegación— también atrapa esos `<script>`
fallidos y les sirve el HTML de `index.html`: el navegador intenta parsear HTML como
JS y lanza `Unexpected token '<'`, nueve veces. Resultado: tablero vacío, selector de
modalidad sin opciones. `index.html` no tiene el problema porque sus `<script>` no
llevan cadena de versión.

## Qué hay que hacer
Elegir UNA de las tres candidatas que dejó la incidencia (no hace falta implementar
las tres) y aplicarla:

1. **Quitar las cadenas `?v=N` de los `<script>` de `editor.html`.** La más simple: el
   `VERSION` de `sw.js` ya invalida la caché entera de la app cuando cambia, así que
   la cadena de versión por fichero es redundante. Comprobar antes si algo más (un
   test, otra página) depende de esas cadenas exactas.
2. **Cachear en `sw.js` también las URLs exactas con `?v=N`** que usa `editor.html`,
   añadiéndolas a `FICHEROS`. Más frágil: cualquier cambio futuro del número de
   versión en `editor.html` vuelve a romper el offline si no se actualiza `sw.js` a
   la vez.
3. **Usar `{ignoreSearch: true}` en el `caches.match()` de `sw.js`.** Arregla este caso
   y cualquier otro futuro con query string, pero cambia el comportamiento de caché
   para toda la app (dos URLs que solo difieren en la query pasan a considerarse la
   misma petición); pensar si eso tiene efectos no deseados en otro sitio.

Preferencia por defecto si no hay razón para lo contrario: la opción 1 (quitar las
cadenas), por ser la más simple y la que menos superficie nueva introduce. Si se elige
otra, dejar escrito el porqué en la terminada.

## Cómo verificar
Repetir el mismo procedimiento que usó la tarea 08 para encontrar el fallo:
1. Servir el repo por HTTP local (`python3 -m http.server`, no `file://`: el service
   worker no arranca desde `file://`).
2. Cargar `index.html`, esperar a que el service worker esté listo
   (`navigator.serviceWorker.ready`) y confirmar que la caché tiene los ficheros
   nuevos si el arreglo cambia `FICHEROS`.
3. Poner el contexto offline (Chrome headless vía Playwright: `context.setOffline(true)`,
   o manualmente en DevTools → Network → Offline).
4. Navegar a `editor.html` (carga de página real, no ruteo SPA): debe cargar el
   tablero y el selector de modalidad sin errores de consola.
5. Repetir la comprobación 7 completa de la tarea 08 (también sin conexión en
   `index.html`, que ya funcionaba, para comprobar que no se ha roto).

## Datos de entrada
- `reparto/hechos/incidencias/s-20260824T235504-fde8fd6d.md` — diagnóstico completo.
- `reparto/salidas/08-verificacion/s-20260824T235504-fde8fd6d-07-*` — capturas y JSON
  del fallo tal como se vio.
- `sw.js`, `editor.html`.

## Cómo saber que ha terminado
`editor.html` carga y funciona sin conexión (tablero dibujado, selector de modalidad
con opciones, 0 errores de consola) después de haber visitado la app una vez online;
`index.html` sigue funcionando sin conexión igual que antes.

## Al terminar
Cierre estándar: terminada `15--<sid>.md` con el recuento y qué opción se eligió y por
qué, `CERRADA` en el reclamo, regenerar el tablón (recopiando la columna Banda de este
fichero), `git add reparto/` + commit + push del cierre del reparto, y el commit propio
del arreglo de código a `main` + push. Avisar a Juan Luis del resultado.

## Trampas conocidas
- Git tarda 1-3 minutos por orden; en segundo plano y vigilando `.git/index.lock`.
- El service worker no arranca desde `file://`: servir siempre por HTTP.
- Un cambio en `sw.js` no lo ve una pestaña ya abierta hasta recargar (o hasta que el
  navegador active el nuevo worker); cerrar y volver a abrir el contexto de Playwright
  entre una versión y otra de `sw.js`, no reusar el mismo.
- La raíz del repo tiene ficheros de depuración sueltos de otras sesiones
  (`editor-debug.html`, `diagnose.html`…): no son tuyos, no los toques.

## Prohibido
- Implementar las tres candidatas «por si acaso»: elegir una.
- Tocar nada de `editor.html`/`sw.js` que no tenga que ver con este desajuste (por
  ejemplo, no aprovechar para cambiar `VERSION` sin necesidad).
