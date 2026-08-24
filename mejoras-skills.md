# Mejoras para las skills `reparto` y `traspaso`

Evaluación hecha el 2026-08-24 desde Claude Code (VS Code). Las dos skills están bien
pensadas y escritas: el método es sólido y la prosa explica el porqué de cada regla, que
es lo que hace que una sesión nueva las siga bien. El problema principal de ambas es el
mismo: **están escritas asumiendo el entorno de Claude Desktop** y ahora también van a
correr en Claude Code, donde varias de sus afirmaciones son falsas y varios de sus
mecanismos tienen equivalente nativo mejor.

## Mejoras comunes

1. **Detectar el entorno antes de aplicar consejos de entorno.** Añadir al principio de
   cada skill una indicación: "Identifica si corres en Claude Desktop o en Claude Code
   (CLI/VS Code); las secciones marcadas por entorno solo aplican al tuyo".
2. **La tabla de bandas de modelo (ALTO/MEDIO/BAJO) está duplicada** en las dos skills.
   Mantenerla, pero añadir una nota de que si se cambia en una hay que cambiarla en la
   otra (o extraerla a un archivo de referencia compartido si el empaquetado lo permite).
3. **Reempaquetado**: tras cada mejora hay que regenerar los `.skill` (zip) para que
   Claude Desktop reciba la misma versión que `~/.claude/skills/` usa en Claude Code.

## `traspaso`

Útil, sí — la disciplina de "Descartado", decisiones con su porqué y la frase literal de
arranque no la da ningún mecanismo automático. Pero:

1. **`SendUserFile` no existe en Claude Code** y "carpeta conectada" tampoco como
   concepto. En Claude Code el archivo se escribe en la carpeta del proyecto y se cita
   con su ruta; nada más. Condicionar ese párrafo por entorno.
2. **Claude Code ya tiene reanudación nativa** (`--resume`, `--continue`, resumen
   automático de contexto largo). Aclarar cuándo el traspaso sigue aportando: cambiar de
   máquina, cambiar de producto (Desktop↔Code), cambiar de modelo, o querer empezar
   limpio sin el ruido acumulado. Sin esa aclaración, en Claude Code la skill puede
   parecer redundante y dejar de usarse justo cuando conviene.
3. **La frase literal de arranque** asume "adjunto a este mensaje": en Claude Code basta
   la ruta dentro del repo. Dar las dos variantes.
4. **Encaje con la memoria persistente de Claude Code**: las preferencias estables de
   Juan Luis van a la memoria del proyecto, no al traspaso; el traspaso recoge solo lo
   específico del trabajo en curso. Añadir una línea que lo diga para no duplicar.

## `reparto`

Muy útil como método (inventariar → cortar por dependencias → dueño único de salida →
tablón + hechos/ append-only → banda de modelo → automatización selectiva). El protocolo
de concurrencia es agnóstico y está bien justificado. Pero:

1. **La sección "Limitaciones del entorno" presenta límites de Claude Desktop como
   universales**: "el shell no tiene red y no puede borrar ficheros", "los permisos de
   carpeta se conceden por sesión", "el navegador necesita la pestaña activa"… En Claude
   Code nada de eso es cierto. Mover lo específico a `referencias/entorno-desktop.md` y
   crear `referencias/entorno-claude-code.md`.
2. **Automatización**: "Usa `mcp__claude-code-remote__*`, nunca `CronCreate`" solo tiene
   sentido en Desktop. En Claude Code los equivalentes son la skill `schedule` /
   `RemoteTrigger` (rutinas en la nube, sobreviven a la sesión) y los agentes remotos.
   El consejo de fondo (que el automatismo no muera con la sesión) vale; los nombres no.
3. **En Claude Code hay mecanismos nativos que el protocolo reimplementa a mano**:
   - git: ramas/worktrees/PRs son el "dueño único de salida" natural en un repo.
   - el sistema de reclamo de archivos entre sesiones paralelas del harness.
   - agentes en la nube (`isolation: remote`): un reparto puede ejecutarse lanzando
     sesiones web en paralelo, no solo esperando a que Juan Luis abra sesiones a mano.
   Añadir un "modo Claude Code" que diga cuándo el tablón `hechos/` sigue haciendo falta
   (trabajo fuera de un repo git) y cuándo git + PRs lo sustituye.
4. **Personalización excesiva**: "en el montaje del disco de Juan Luis `rm` está
   prohibido" — eso es un dato del entorno Desktop, no de Juan Luis; generalizar.
5. **La frase de arranque de sesión nueva** debería tener variante Claude Code (con ruta
   del repo y mención de la rama/worktree si el reparto usa git).
6. **En la description del frontmatter**, añadir el disparador "cuando el reparto pueda
   ejecutarse con sesiones remotas/en la nube", que es el caso de uso real en Claude Code.

## Qué NO cambiar

- La voz, el idioma y el estilo (segunda persona, español, dirigido a cómo trabajar con
  Juan Luis): es lo que las hace efectivas.
- El principio append-only de `hechos/` y el reclamo con caducidad: válido en ambos
  entornos cuando no hay git.
- La regla "banda, nunca nombre de modelo".
- La separación tablón (vista derivada) / hechos (verdad) / autorizaciones (firmas).
