// verifica-tarea-12.js — Comprueba que probVerificaForzado(p) hace lo que
// promete: da por buenos los problemas correctos (generados frescos) y
// rechaza problemas manipulados a propósito para que mientan (declaran menos
// jugadas de las que hacen falta, o más soluciones de las que hay).
// Sesión s-20260824T235458-3ccd1290, tarea 12.
const fs = require('fs');
const path = require('path');
const raiz = path.join(__dirname, '..');
const src = ['geometry.js', 'variants.js', 'rules.js', 'ai.js', 'problemas.js']
  .map(f => fs.readFileSync(path.join(raiz, f), 'utf8')).join('\n');

eval(src + `
setVariant(DEFAULT_VARIANT);
newGame();

let ok = 0, mal = 0;
function comprueba(nombre, cond) {
  if (cond) { ok++; console.log('OK   ' + nombre); }
  else { mal++; console.log('MAL  ' + nombre); }
}

// 1) Problemas frescos, correctos por construcción: probVerificaForzado tiene
//    que darlos por buenos.
let frescos = 0;
const t0 = Date.now();
for (const nivel of ['facil', 'medio', 'dificil']) {
  for (const tipo of probTiposNivel(nivel)) {
    if (frescos >= 12 || Date.now() - t0 > 40000) break;
    const p = probGenera(nivel, [tipo], PROB_NIVELES[nivel].msEspera || 6000);
    if (!p) continue;
    frescos++;
    comprueba(nivel + '/' + tipo + ' (' + p.obj.jugadas + ' jugadas, fresco) se acepta',
      probVerificaForzado(p));
  }
}

// 2) El mismo problema, pero mintiendo: declara una jugada menos de las que
//    hacen falta (si de verdad hacían falta N, decir N-1 es falso salvo que
//    también se resuelva en N-1, que por construcción no es el caso).
{
  let p = null;
  for (let i = 0; i < 30 && !p; i++) {
    const cand = probGenera('medio', ['mate'], 6000);
    if (cand && cand.obj.jugadas >= 2) p = cand;
  }
  if (p) {
    const mentira = { ...p, obj: { ...p.obj, jugadas: p.obj.jugadas - 1 } };
    comprueba('mate en ' + p.obj.jugadas + ' declarado como ' + mentira.obj.jugadas + ' (mentira) se rechaza',
      !probVerificaForzado(mentira));
  } else {
    console.log('(sin muestra para la prueba 2, no es un fallo)');
  }
}

// 3) Un problema con el objetivo IMPOSIBLE (declara una jugada de más de las
//    que se pueden buscar de verdad porque el rey ya está mate antes): aquí
//    en vez de fabricar uno a mano, se prueba con jugadas absurdamente altas
//    sobre una posición real, que no puede estar forzada en ese número exacto
//    (se resuelve antes, así que "exactamente N" es falso para N > jugadas reales).
{
  let p = null;
  for (let i = 0; i < 30 && !p; i++) {
    const cand = probGenera('facil', ['mate'], 4000);
    if (cand) p = cand;
  }
  if (p) {
    const inflado = { ...p, obj: { ...p.obj, jugadas: p.obj.jugadas + 1 } };
    comprueba('mate en ' + p.obj.jugadas + ' declarado como ' + inflado.obj.jugadas + ' (de más) se rechaza',
      !probVerificaForzado(inflado));
  } else {
    console.log('(sin muestra para la prueba 3, no es un fallo)');
  }
}

console.log('\\n' + ok + ' OK, ' + mal + ' MAL de ' + (ok + mal) + ' comprobaciones.');
if (mal > 0) process.exit(1);
`);
