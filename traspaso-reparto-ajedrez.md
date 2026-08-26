# Traspaso — reparto-ajedrez

Actualizado: 2026-08-26 02:05Z · Sesiones previas: 4

## Objetivo

Terminar los trabajos a medias del repositorio
`/Users/salasgar/Documents/git/Ajedrez-triangular` aplicando la skill `reparto`.
Encargo de Juan Luis del 2026-08-24 (seis trabajos, decisiones delegadas), ampliado el
2026-08-25 con cuatro problemas reportados por él (tareas 11-13), su sugerencia de
cosechar problemas de partidas motor contra motor (tarea 14) y un hallazgo de la
verificación (tarea 15).

## Estado actual

**14 de las 15 tareas están LISTAS; la 13 está A MEDIAS.** El estado por tarea vive en
el tablón `reparto/_ESTADO.md` (fuente de verdad: `reparto/hechos/`), regenerado por la
propia sesión de la 13 el 2026-08-26T01:43Z, y este archivo no lo repite.
`main` = `origin/main` = `6dcc509`.

De la 13 (la IA no captura gratis en las modalidades PPT): su sesión cerró limpia con
`parada por: sesión agotada` tras 16 horas. Dejó **dos bugs reales arreglados y
commiteados** (`6dcc509`: valores dinámicos RPS en ordenación/poda, y el falso jaque
de rey contra rey en `isAttackedFast` que bloqueaba jugadas legales en las modalidades
-rey) y **el síntoma central diagnosticado pero sin resolver**, con los números y los
pasos siguientes en `reparto/hechos/fallos/13--s-20260825T090706-b85c3e30.md`. Ese
fallo es la lectura obligada de quien la retome.

## Siguiente paso

Abrir una sesión de trabajo que retome la **13** con la frase de abajo. Su primer
movimiento está escrito en el fallo: repetir el barrido de profundidad sobre la
posición fija (no sobre partidas completas, que divergen) con y sin los pesos de
amenaza reducidos, y decidir con eso entre las dos vías que deja planteadas.

Banda de modelo para retomar: **MEDIO** — los experimentos pendientes están
especificados paso a paso en el fallo. **Cláusula de subida**: si la conclusión es que
hay que extender `quiesce()` para perseguir jugadas tranquilas (el núcleo de búsqueda
compartido por TODAS las modalidades), parar y pedir visto bueno a Juan Luis antes de
tocarlo — el propio fallo lo exige; esa decisión, si llega, es de banda ALTA y pide
medir con la arena.

## Decisiones tomadas

| Decisión | Por qué |
|---|---|
| El corte del reparto: tareas por dependencias, no por temas | Regla de la skill; el detalle, en `reparto/proyecto.md` |
| Las tareas nuevas se añaden al final (11-15), nunca se renumera | Los números están citados en fichas, reclamos y hechos; renumerar los deja apuntando a otra cosa en silencio |
| Los fallos 3 y 4 de Juan Luis (minimalidad y soluciones múltiples) fueron UNA tarea (12), no dos | Ambos viven en el verificador de `problemas.js`: dos tareas paralelas tendrían el mismo fichero con dos escritores |
| `rps` y `rpsls` se quedan con el setup `base`, ya no provisional | Segunda tanda de arena (96 partidas, 2026-08-25): las 6 candidatas alternativas dan 69-94 % de tablas; `base` tiene el mejor reparto en ambas. Tabla en `entrenamiento/rps-posiciones-resumen.md` |
| Ronda 15 aplicada: solo `dekle`/`all` entra; `trigonal` revertido a valores a ojo | Único candidato significativo en arena; `trigonal` llevaba desde `c388624c` (4-8-2026) un candidato PERDEDOR aplicado por leer el signo del elo al revés. Detalle en la terminada de la 10 |
| `scripts/nueva-sesion 2.sh` retirado a `_papelera/` con firma nueva de Juan Luis (25-8-2026) | No era variante válida: usaba `git checkout -b` sobre el árbol compartido, prohibido en `proyecto.md` |
| Duración esperada de la 13 subida de 3 h a 6 h (en su ficha) | Una sesión entera de 16 h no cerró el síntoma; la estimación original era corta |
| La coordinadora vigila con un bucle de pasadas cada 30 min sobre `hechos/`, sin relevar tareas ella misma | Las sesiones de trabajo callan horas mientras computan; sondear más a menudo no aporta y relevar desde la coordinación duplicaría trabajo vivo |
| `hechos/` mínimo, en el árbol del repo, commiteado como copia de seguridad | Todas las sesiones son locales y comparten el árbol; git registra lo demás |
| Los `traspaso-*.md` se commitean al repo | Delegación expresa del 2026-08-24; reversible |
| `tablas` restringido a fácil y medio | Solo se fuerza en una jugada; copaba el almacén. Revocable en `autorizaciones.md` |

## Descartado — no volver a proponer

| Se descartó | Motivo |
|---|---|
| La hipótesis de la «caza» (`RPS_PESO_CAZA`) como causa del fallo de la 13 | Descartada con datos: el término se mantiene estable (~60-65) en las posiciones comparadas; el salto está en «amenaza». Está en el fallo de la 13 — no repetirla |
| Medir el efecto de un cambio de pesos comparando partidas de autojuego completas | Cada cambio hace divergir la partida desde la primera jugada y no aísla nada; se compara en la MISMA posición fija (barrido de profundidad) |
| Confiar en subir el presupuesto de nodos del nivel 8 como arreglo de la 13 | Medido: con 20× nodos (16M) el hueco se reduce (150→61 puntos) pero no desaparece, y la tendencia pide presupuestos inviables en tiempo real |
| `./instalar-servicio.sh resultados` como fuente de datos de la ronda 15 | Lee `~/Library/Application Support/…`, que quedó con un corpus viejo y menor; los datos autoritativos son `entrenamiento/r15/` del repo (re-correr `node analiza.js 300`) |
| Diseñar candidatas nuevas de posición inicial para `rps`/`rpsls` | El problema real no es la posición: sin rey ninguna partida acaba de forma natural. Si se ataca, es tocando condiciones de victoria (decisión de Juan Luis) |
| Editar las skills instaladas en `~/.claude/skills/` | Son copias; la fuente la mantiene Juan Luis en otro sitio. Las mejoras se le proponen como texto |
| Repetir la mitad con-rey de la 03, o rediseñar el verificador de la 12 | Cerradas con datos; ver sus terminadas |
| `git add` por nombre de un fichero tracked-modificado sin mirar su diff | Causó el fallo histórico de la insignia; la costumbre se queda |
| `sleep` en primer plano para la espera del protocolo | El harness lo bloquea; va con `run_in_background` |
| Forzar el desbloqueo de una reserva del harness sobre `_ESTADO.md` | Caducan solas a los ~30 min de inactividad; esperar evitó pisar a otra sesión todas las veces |
| Guardar el sid en un fichero genérico de `/tmp` entre dos comandos | Otra sesión lo pisó el 2026-08-25 y un reclamo salió con sid ajeno; regla ya en el tablón |

## Archivos

- `reparto/_ESTADO.md` — el tablón; empieza por aquí. Al día a 2026-08-26T01:43Z.
- `reparto/hechos/fallos/13--s-20260825T090706-b85c3e30.md` — el diagnóstico completo
  de la 13 y los pasos para la siguiente sesión. **Lectura obligada antes de retomarla.**
- `reparto/salidas/13-rescate-scratchpad-s-20260825T093251-fde516e1/` — copia de
  rescate (20:57Z) de los 17 ficheros de trabajo de la sesión de la 13 (`repro-13*.js`,
  `hallazgos-*.json`, `posicion-ply16.json`, la posición del ply 16). **El fallo dice
  que los scripts se perdieron con el scratchpad: no es del todo cierto** — esta copia
  llega hasta las 16:14Z; solo falta lo creado después (los del barrido final).
- `reparto/proyecto.md` — ficha fija: rutas, bandas (ALTO=Fable 5, MEDIO=Sonnet 5,
  BAJO=Haiku 4.5 a 2026-08-24), reglas del repo y frase de arranque.
- `reparto/tareas/tarea-NN-*.md` — las quince fichas; la 13 con duración y trampas al día.
- `reparto/hechos/` — reclamos, terminadas, fallos, incidencias, notas (fuente de verdad).
- `reparto/autorizaciones.md` — firmas de Juan Luis; solo lo edita él. Tres firmadas.
- `entrenamiento/problemas-cosechados.json` — los 89 problemas de la 14, aún sin
  enganchar a la app.
- Los seis `traspaso-*.md` de los trabajos originales — solo lectura.

## Contexto que no está en los archivos

- **Decisiones que se le han ido acumulando a Juan Luis** (ninguna urgente, todas
  escritas en las terminadas/fallos correspondientes): (1) aplicar o no la ronda 14 de
  temperatura, que resultó estar completa; (2) enganchar los problemas cosechados al
  almacén vivo del navegador (tarea nueva); (3) cosechar el resto de modalidades y/o
  programar la cosecha como rutina (exigiría mover el protocolo al remoto); (4)
  actualizar el dorado de `dekle` en `test-ia-rps.js`, desactualizado por el cambio de
  valores de la 10; (5) el visto bueno a tocar `quiesce()` si la 13 lo acaba pidiendo;
  (6) tras cerrar el reparto, la cuestión PPT/PPTLS sin rey (hay memoria de proyecto
  que pide sesión de banda ALTA para eso).
- La sesión de la 13 estuvo horas computando sin escribir nada: el silencio largo no
  siempre es sesión muerta. Antes de darla por caída, mirar si hay proceso `node` vivo
  y el scratchpad de la sesión en `/private/tmp/claude-501/…`.
- La sesión de la 14 selló su cierre con la hora local etiquetada como Z (~2 h de
  adelanto ficticio en `cerrado:` y en el `Regenerado:` de su tablón); sin
  consecuencia, pero está anotado en la incidencia de la coordinadora por si alguien
  compara fechas internas de ese tramo.
- Juan Luis hizo de correo entre la coordinadora y las sesiones de trabajo pegando
  mensajes literales; funcionó bien y los avisos de protocolo (estirar caducidad antes
  de esperas largas) llegaron por esa vía.

---

Lo primero que hará la sesión nueva: leer el tablón y el fallo de la 13, y retomarla
por el barrido de profundidad sobre la posición fija.

Banda para abrirla: **MEDIO** — experimentos especificados en el fallo; con la cláusula
de parar y pedir visto bueno si el arreglo pasa por extender `quiesce()`.

Frase para la sesión de trabajo:

> Trabaja en el reparto del repositorio
> `/Users/salasgar/Documents/git/Ajedrez-triangular`, carpeta `reparto/`. He abierto
> esta sesión con un modelo de banda MEDIO. Lee `reparto/proyecto.md` y
> `reparto/_ESTADO.md`, lista `reparto/hechos/`, y reclama la tarea 13 siguiendo el
> protocolo del tablón (está A MEDIAS, sin reclamo vivo: lee entero
> `reparto/hechos/fallos/13--s-20260825T090706-b85c3e30.md` antes de trabajar y no
> repitas lo descartado allí). Dime cuál has cogido y con qué identificador de sesión.
