# AUTORIZACIONES — reparto-ajedrez

**Este fichero lo escribe Juan Luis a mano. Ninguna sesión escribe aquí, nunca.**
(La sesión que montó el reparto lo creó con las casillas vacías el 2026-08-24; desde
entonces, solo lo toca Juan Luis.)

Está separado del tablón a propósito: el tablón se regenera entero cada vez que termina
una tarea, y una casilla firmada que desapareciera en una regeneración es justo lo que
no puede pasar, porque es lo que desbloquea lo irreversible.

Una sesión que necesite una de estas autorizaciones lee este fichero. Si la casilla no
está firmada, se para y lo dice. No hay ninguna otra manera de desbloquearla.

## Acciones que requieren firma

- [ ] **Retirar los ocho ficheros de depuración del editor** (moverlos a
      `reparto/_papelera/`): `check-init.html`, `diagnose.html`, `editor-debug.html`,
      `editor-test.html`, `editor-v2.html`, `editor-with-logs.html`, `test-init.js`,
      `test-load.html`. Suman ~35 KB, ningún traspaso los reclama y parecen restos del
      worktree `fix-position-editor`, pero nadie lo ha confirmado.
      Firma y fecha:

- [ ] **Consolidar y retirar los duplicados « 2» de la sincronización**:
      `scripts/cerrar-sesion 2.sh`, `scripts/listar-sesiones 2.sh`,
      `scripts/nueva-sesion 2.sh` y `entrenamiento/libro-trigonal 2.json`. La tarea 09
      los comparará primero con el original y solo retirará (a `reparto/_papelera/`)
      los que sean idénticos o estén contenidos en el original; cualquier diferencia
      real se queda escrita en `hechos/incidencias/` antes de tocar nada.
      Firma y fecha:

## Decisiones tomadas por delegación que Juan Luis puede revocar aquí

El 2026-08-24 Juan Luis delegó expresamente las decisiones en la sesión montadora.
Estas dos se tomaron con esa delegación; las dos son reversibles y basta una línea suya
aquí (o decírselo a cualquier sesión) para deshacerlas:

- **Los `traspaso-*.md` se commitean al repo** (en la raíz, como están). Alternativas
  descartadas: ignorarlos en `.gitignore` o moverlos a una carpeta ignorada.
- **`tablas` queda restringido a los niveles fácil y medio** en la pestaña de
  problemas; en difícil y experto la opción se deshabilita en el selector. Alternativa
  descartada: dejarlo en todos los niveles.

## Condiciones que Juan Luis quiere dejar dichas

- No vaciar nunca `reparto/_papelera/`: eso lo hace él desde el Finder cuando quiera.
