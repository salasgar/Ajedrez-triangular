# Sesiones paralelas con git worktree

Este proyecto usa **git worktree** para permitir que trabajes en varios cambios en paralelo sin interferencias entre sesiones de Claude Code.

## Qué es un worktree

Un worktree es una copia adicional de tu árbol de trabajo, cada una en su propia rama. Git gestiona el estado de todas ellas, pero las modificaciones en una no afectan a las demás mientras estés en su rama correspondiente.

- **Ventaja principal**: cero interferencias entre sesiones. Si abres una sesión para cambio A y otra para cambio B, cada una ve un repo limpio en su rama, sin choques por ficheros.
- **Punto de fusión único**: cuando terminas una sesión, simplemente haces `git merge` de su rama y todo se integra de forma nativa — git resuelve conflictos reales si los hay.

## Flujo de uso

### 1. Abrir una sesión nueva

```bash
scripts/nueva-sesion.sh nombre-del-cambio
```

Esto:
- Crea una rama nueva `nombre-del-cambio` a partir de `main` en el repo principal.
- Crea un worktree en `../ajedrez-triangular-sesiones/nombre-del-cambio/`.
- Imprime la ruta exacta y los próximos pasos.

Ejemplo:
```bash
scripts/nueva-sesion.sh bugfix-arena
# ✅ Sesión 'bugfix-arena' creada en:
#    /Users/salasgar/Documents/git/ajedrez-triangular-sesiones/bugfix-arena
# Próximos pasos:
#    cd ../ajedrez-triangular-sesiones/bugfix-arena
#    claude
```

### 2. Trabajar en la sesión

Navega al worktree y abre Claude Code:

```bash
cd ../ajedrez-triangular-sesiones/bugfix-arena
claude
```

Dentro de esa sesión, trabaja normalmente:
- Haz cambios en los ficheros.
- Ejecuta scripts de prueba, entrenamiento, etc.
- Commitealo todo con `git commit`.

**Importante**: no hagas `git push` desde dentro del worktree — la rama es local por ahora. El push/PR se hace desde el repo principal después de terminar.

### 3. Cerrar la sesión

Cuando termines, cierra el worktree y revisa qué hacer con la rama:

```bash
# Desde el repo principal:
scripts/cerrar-sesion.sh bugfix-arena
```

Esto:
- Verifica que no haya cambios sin commitear en ese worktree.
- Elimina el worktree.
- Imprime los pasos siguientes (fusionar, limpiar rama, etc.).

Ejemplo:
```bash
scripts/cerrar-sesion.sh bugfix-arena
# ✅ Worktree 'bugfix-arena' cerrado.
# Pasos siguientes:
# 1. Fusionar la rama al repo principal:
#    git merge bugfix-arena
# 2. (Opcional) Eliminar la rama local:
#    git branch -d bugfix-arena
```

### 4. Fusionar los cambios

Desde el repo principal (rama `main`):

```bash
git merge bugfix-arena
# Resuelve conflictos si los hay (git te lo dirá).
git branch -d bugfix-arena
```

Si tienes remoto configurado:
```bash
git push origin main
git push origin --delete bugfix-arena    # si la rama estaba en remoto
```

## Ver sesiones activas

Para listar todas las sesiones/worktrees abiertos:

```bash
scripts/listar-sesiones.sh
```

O usa el comando de git directamente:

```bash
git worktree list
```

## Avisos importantes

### ⚠️ El servicio de entrenamiento es compartido

`entrenamiento/instalar-servicio.sh` instala un LaunchAgent macOS con label fijo (`com.salasgar.ajedreztriangular.entrenamiento`). **Solo puede haber una instancia activa a la vez.**

**Recomendación**: instala el servicio una sola vez desde el repo principal, no desde los worktrees. Si necesitas ejecutar `entrenamiento-continuo.sh` en una sesión, lánzalo de forma manual/temporal (`entrenamiento-continuo.sh` sin el `--servicio` flag, si lo hay), no lo instales como LaunchAgent.

### ⚠️ Los pre-commit hooks son compartidos

`entrenamiento/instalar-servicio.sh` copia `entrenamiento/pre-commit.sh` a `.git/hooks/pre-commit`. **Eso es compartido entre todos los worktrees** — git solo tiene un `.git/hooks` real. Si editas los hooks desde una sesión, la cambio afecta a todas.

### ⚠️ Ficheros sin trackear no se copian

Si en el repo principal tienes ficheros grandes sin commitear (`entrenamiento/r15/`, `editor.html`, `docs/reglamento.pdf`, etc.), un worktree nuevo **no los verá** — arranca desde el último commit de la rama base. Esto es comportamiento normal de git: si necesitas ese fichero en la sesión, tienes que copiarlo manualmente o commitear primero.

Si necesitas trabajar con un fichero sin trackear desde una sesión:
1. Commitealo en el repo principal primero, o
2. Cópialo manualmente: `cp -r ../archivo-sin-trackear ./`.

## Referencia rápida

| Tarea | Comando |
|-------|---------|
| Abrir sesión | `scripts/nueva-sesion.sh nombre` |
| Trabajar en sesión | `cd ../ajedrez-triangular-sesiones/nombre && claude` |
| Ver sesiones activas | `scripts/listar-sesiones.sh` |
| Cerrar sesión | `scripts/cerrar-sesion.sh nombre` |
| Fusionar cambios | `git merge nombre` (desde `main`) |
| Borrar rama | `git branch -d nombre` |

## Preguntas frecuentes

**P: ¿Puedo tener dos sesiones abiertas a la vez en el mismo cambio?**

No, cada rama solo puede tener un worktree. Git te lo impedirá si lo intentas. Si quieres trabajar en paralelo, abre sesiones con nombres distintos (ramas distintas).

**P: ¿Qué pasa si tengo conflictos al fusionar?**

Es lo normal. Git te lo dirá con `git merge nombre` y te pedirá que los resuelvas (edita los ficheros con conflicto, marca como resueltos con `git add`, y commitea).

**P: ¿Necesito hacer push/PR?**

No necesariamente — si solo trabajas localmente, `git merge nombre` en `main` es suficiente. Si quieres compartir la rama, haz `git push origin nombre` desde el repo principal o desde el worktree.

**P: ¿Cómo cancelo una sesión sin fusionar?**

```bash
scripts/cerrar-sesion.sh nombre
git branch -D nombre    # -D (mayúscula) fuerza la eliminación sin fusionar
```

**P: ¿Dónde está el código de la sesión?**

En `../ajedrez-triangular-sesiones/nombre/`. Es un directorio hermano al repo principal (`../ajedrez-triangular/`), fuera del árbol versionado, así que `.gitignore` no lo toca.
