// Matriz de pruebas funcionales (Sección VI-C). Ejecutar: node pruebas/motor.test.mjs
// Sin dependencias: usa node:test y node:assert.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Automata } from '../js/motor/automata.js';
import { equivalentes } from '../js/motor/equivalencia.js';
import { minimizar, eliminarInalcanzables, numEstadosMinimo } from '../js/motor/minimizador.js';
import { Cuaderno } from '../js/cuaderno/cuaderno.js';
import { Nivel } from '../js/juego/nivel.js';
import { Partida } from '../js/juego/mapa.js';
import { Almacen } from '../js/datos/almacen.js';
import { generarDiagnostico, puntuar, gananciaNormalizada } from '../js/juego/diagnostico.js';

const datos = JSON.parse(readFileSync(new URL('../data/niveles.json', import.meta.url)));
const niveles = datos.niveles.map(n => new Nivel(n));
const al = (n) => n.alfabeto;

// Todas las cadenas de longitud ≤ k sobre un alfabeto
function* cadenas(sigma, k) {
  yield '';
  let act = [''];
  for (let i = 0; i < k; i++) {
    const sig = [];
    for (const w of act) for (const a of sigma) sig.push(w + a);
    for (const w of sig) yield w;
    act = sig;
  }
}

test('RF01 — AFD "termina en a": cadenas aceptadas, rechazadas y cadena vacía', () => {
  const A = niveles[0].automatas.A;
  assert.equal(A.acepta(''), false);
  assert.equal(A.acepta('a'), true);
  assert.equal(A.acepta('ba'), true);
  assert.equal(A.acepta('ab'), false);
  assert.equal(A.acepta('bbbaa'), true);
  assert.equal(A.extendida('q0', ''), 'q0');
  assert.equal(A.extendida('q0', 'ab'), 'q0');
  assert.equal(A.extendida('q0', 'abaa'), 'q1');
});

test('RF01 — δ* cumple δ*(q, wa) = δ(δ*(q, w), a) en todos los niveles', () => {
  for (const n of niveles) for (const A of Object.values(n.automatas)) {
    for (const w of cadenas(A.sigma, 4)) for (const a of A.sigma) for (const q of A.Q) {
      assert.equal(A.extendida(q, w + a), A.paso(A.extendida(q, w), a));
    }
  }
});

test('RF01 — símbolo fuera de Σ o δ indefinida devuelven null / no aceptan', () => {
  const A = niveles[0].automatas.A;
  assert.equal(A.extendida('q0', 'z'), null);
  assert.equal(A.acepta('az'), false);
});

test('RF02 — estado trampa del nivel 2 detectado; ningún otro lo es', () => {
  const A = niveles[1].automatas.A;
  assert.deepEqual(A.trampas(), ['qt']);
  assert.equal(A.esTrampa('q2'), false); // aceptación
  assert.equal(A.esTrampa('q0'), false);
});

test('RF01 — nivel 2 reconoce ab·a* (ejemplos calculados a mano)', () => {
  const A = niveles[1].automatas.A;
  for (const w of ['ab', 'aba', 'abaaa']) assert.equal(A.acepta(w), true, w);
  for (const w of ['', 'a', 'b', 'abb', 'ba', 'aab', 'abab']) assert.equal(A.acepta(w), false, w);
});

test('RF01 — esCompleto y faltantes', () => {
  for (const n of niveles) for (const A of Object.values(n.automatas)) assert.equal(A.esCompleto(), true);
  const P = new Automata(['p', 'q'], ['a', 'b'], { p: { a: 'q' }, q: { a: 'q', b: 'p' } }, 'p', ['q']);
  assert.equal(P.esCompleto(), false);
  assert.deepEqual(P.faltantes(), [['p', 'b']]);
});

test('RF02 — alcanzables y cadena más corta', () => {
  const A = new Automata(['p', 'q', 'r'], ['a'], { p: { a: 'p' }, q: { a: 'r' }, r: { a: 'q' } }, 'p', ['r']);
  assert.deepEqual([...A.alcanzables()], ['p']);
  assert.equal(A.cadenaMasCorta(), null);
  assert.equal(niveles[1].automatas.A.cadenaMasCorta(), 'ab');
});

test('RF02 — minimización del nivel 3: 6 estados -> 3 y mismo lenguaje', () => {
  const A = niveles[2].automatas.A;
  assert.equal(A.Q.size, 6);
  const M = minimizar(A);
  assert.equal(M.Q.size, 3);
  assert.equal(numEstadosMinimo(A), 3);
  assert.equal(equivalentes(A, M).iguales, true);
  for (const w of cadenas(A.sigma, 5)) assert.equal(M.acepta(w), A.acepta(w), w);
  // Clases esperadas: {q0,q3} {q1,q4} {q2,q5}
  const clases = M.clases.map(c => [...c].sort().join('')).sort();
  assert.deepEqual(clases, ['q0q3', 'q1q4', 'q2q5']);
});

test('RF02 — el AFD mínimo ya mínimo no cambia de tamaño; eliminar inalcanzables', () => {
  const A = new Automata(['p', 'q', 'x'], ['a'], { p: { a: 'q' }, q: { a: 'p' }, x: { a: 'x' } }, 'p', ['q']);
  assert.equal(eliminarInalcanzables(A).Q.size, 2);
  assert.equal(minimizar(A).Q.size, 2);
  assert.equal(minimizar(minimizar(A)).Q.size, 2);
});

test('RF02 — nivel 1 y 2 ya son mínimos', () => {
  assert.equal(numEstadosMinimo(niveles[0].automatas.A), 2);
  assert.equal(numEstadosMinimo(niveles[1].automatas.A), 4);
});

test('RF06 — equivalencia nivel 4: A≡B, A≢C con contraejemplo mínimo verificable', () => {
  const { A, B, C } = niveles[3].automatas;
  assert.equal(equivalentes(A, B).iguales, true);
  const r = equivalentes(A, C);
  assert.equal(r.iguales, false);
  assert.equal(r.contraejemplo, 'ca');           // más corto: c lleva a aceptar en ambos, 'ca' los separa
  assert.notEqual(A.acepta(r.contraejemplo), C.acepta(r.contraejemplo));
});

test('RF06 — equivalencia es simétrica y reflexiva (exhaustivo contra fuerza bruta)', () => {
  const { A, B, C } = niveles[3].automatas;
  for (const [X, Y] of [[A, B], [A, C], [B, C], [A, A]]) {
    const r1 = equivalentes(X, Y), r2 = equivalentes(Y, X);
    assert.equal(r1.iguales, r2.iguales);
    let difieren = false;
    for (const w of cadenas(X.sigma, 6)) if (X.acepta(w) !== Y.acepta(w)) difieren = true;
    assert.equal(r1.iguales, !difieren);
  }
});

test('RF06 — equivalencia exige autómatas completos y mismo alfabeto', () => {
  const P = new Automata(['p'], ['a'], { p: {} }, 'p', []);
  const Q = new Automata(['q'], ['a'], { q: { a: 'q' } }, 'q', []);
  assert.throws(() => equivalentes(P, Q));
});

test('RF05/RF06 — Cuaderno: flujo alterno 2a (sin inicial / transiciones faltantes)', () => {
  const n = niveles[0];
  const c = new Cuaderno(al(n));
  assert.equal(c.validar(n.automataObjetivo).estado, 'incompleto');
  const e0 = c.agregarEstado(10, 10), e1 = c.agregarEstado(50, 10);
  let r = c.validar(n.automataObjetivo);
  assert.equal(r.estado, 'incompleto');
  assert.match(r.motivos.join(' '), /estado inicial/);
  c.marcarInicial(e0.id);
  r = c.validar(n.automataObjetivo);
  assert.match(r.motivos.join(' '), /Faltan transiciones/);
});

test('RF05/RF06 — Cuaderno: diagrama correcto del nivel 1 es equivalente; incorrecto da contraejemplo', () => {
  const n = niveles[0];
  const c = new Cuaderno(al(n));
  const e0 = c.agregarEstado(0, 0), e1 = c.agregarEstado(1, 1);
  c.marcarInicial(e0.id); c.alternarAceptacion(e1.id);
  c.ponerTransicion(e0.id, 'a', e1.id); c.ponerTransicion(e0.id, 'b', e0.id);
  c.ponerTransicion(e1.id, 'a', e1.id); c.ponerTransicion(e1.id, 'b', e1.id); // error: b debería volver a q0
  const r = c.validar(n.automataObjetivo);
  assert.equal(r.estado, 'no-equivalente');
  assert.equal(r.contraejemplo, 'ab');
  assert.equal(r.dibujoAcepta, true);
  assert.equal(r.objetivoAcepta, false);
  c.ponerTransicion(e1.id, 'b', e0.id); // corrige
  assert.equal(c.validar(n.automataObjetivo).estado, 'equivalente');
});

test('RF05 — determinismo: poner otra transición con el mismo (origen, símbolo) reemplaza', () => {
  const c = new Cuaderno(['a', 'b']);
  const p = c.agregarEstado(0, 0), q = c.agregarEstado(1, 1);
  c.ponerTransicion(p.id, 'a', p.id); c.ponerTransicion(p.id, 'a', q.id);
  assert.equal(c.transiciones.filter(t => t.origen === p.id && t.simbolo === 'a').length, 1);
  assert.equal(c.destinoDe(p.id, 'a'), q.id);
  assert.equal(c.ponerTransicion(p.id, 'z', q.id), false);
});

test('RF05 — eliminar estado borra sus transiciones; etiquetas se reutilizan', () => {
  const c = new Cuaderno(['a']);
  const p = c.agregarEstado(0, 0), q = c.agregarEstado(1, 1);
  c.ponerTransicion(p.id, 'a', q.id);
  c.eliminarEstado(q.id);
  assert.equal(c.transiciones.length, 0);
  assert.equal(c.agregarEstado(2, 2).etiqueta, 'q1');
});

test('RF07 — nivel 3 exige mínimo: diagrama de 6 estados equivalente es rechazado, de 3 aceptado', () => {
  const n = niveles[2];
  const grande = Cuaderno.desde(null, al(n));
  const ids = [];
  for (let i = 0; i < 6; i++) { const e = grande.agregarEstado(i, 0); ids.push(e.id); if (i === 1 || i === 4) grande.alternarAceptacion(e.id); }
  grande.marcarInicial(ids[0]);
  const T = n.automataObjetivo.delta;
  for (let i = 0; i < 6; i++) for (const a of al(n)) grande.ponerTransicion(ids[i], a, ids[Number(T['q' + i][a][1])]);
  assert.equal(grande.validar(n.automataObjetivo, { exigirMinimo: true }).estado, 'no-minimo');
  assert.equal(grande.validar(n.automataObjetivo).estado, 'equivalente');

  const m = Cuaderno.desde(null, al(n));
  const [m0, m1, m2] = [0, 1, 2].map(i => m.agregarEstado(i, 0));
  m.marcarInicial(m0.id); m.alternarAceptacion(m1.id);
  for (const s of [m0, m1, m2]) { m.ponerTransicion(s.id, 'b', s.id); m.ponerTransicion(s.id, 'c', s.id); }
  m.ponerTransicion(m0.id, 'a', m1.id); m.ponerTransicion(m1.id, 'a', m2.id); m.ponerTransicion(m2.id, 'a', m0.id);
  const r = m.validar(n.automataObjetivo, { exigirMinimo: true });
  assert.equal(r.estado, 'equivalente');
});

test('RF03/RF04 — Guardia: conducta observable depende solo de aceptación; radio 2 / 0', () => {
  const p = new Partida(niveles[0]);
  const g = p.guardias[0];
  assert.equal(g.dormido, false); assert.equal(g.radio, 2);
  p.senal('a'); assert.equal(g.dormido, true); assert.equal(g.radio, 0);
  p.senal('b'); assert.equal(g.dormido, false);
  assert.equal(g.traza, 'ab');
});

test('RF04 — nivel 1: detección por radio, sombra protege, dormido no detecta', () => {
  const p = new Partida(niveles[0]);
  // jugador en (1,2); guardia en (5,1). Camina hasta (3,2) que es sombra
  assert.equal(p.mover('derecha').ok, true);
  assert.equal(p.mover('derecha').ok, true); // (3,2) sombra
  assert.equal(p.enSombra(), true);
  assert.equal(p.mover('derecha').resultado, 'descubierto'); // (4,2): distancia 1+1=2 con guardia despierto
  assert.equal(p.estado, 'descubierto');
  p.reaparecer();
  p.mover('derecha'); p.mover('derecha');
  assert.equal(p.senal('a').resultado, null); // dormido, en sombra
  for (let i = 0; i < 6; i++) { const r = p.mover('derecha'); assert.ok(r.ok || r.motivo === 'salida-sellada'); }
  assert.equal(p.estado, 'jugando');
});

test('RF04 — la salida está sellada hasta validar; con salida abierta se gana', () => {
  const p = new Partida(niveles[0]);
  p.mover('derecha'); p.mover('derecha'); p.senal('a');
  let ultimo;
  for (let i = 0; i < 20; i++) { ultimo = p.mover('derecha'); if (!ultimo.ok) break; }
  assert.equal(ultimo.motivo, 'salida-sellada');
  p.salidaAbierta = true;
  assert.equal(p.mover('derecha').resultado, 'ganado');
  assert.equal(p.estado, 'ganado');
});

test('RF04 — paredes y guardias bloquean el movimiento', () => {
  const p = new Partida(niveles[0]);
  assert.equal(p.mover('arriba').ok, true);   // (1,1)
  assert.equal(p.mover('arriba').motivo, 'bloqueado'); // pared
  assert.equal(p.mover('izquierda').motivo, 'bloqueado');
});

test('RF03 — niveles: guardias coinciden con el mapa y todos los AFD ocultos son completos', () => {
  assert.deepEqual(niveles.map(n => n.crearGuardias().length), [1, 2, 2, 3]);
  assert.deepEqual(niveles.map(n => n.alfabeto.length), [2, 2, 3, 3]);
  assert.deepEqual(niveles.map(n => n.tipo), ['deduccion', 'deduccion', 'minimizacion', 'equivalencia']);
  for (const n of niveles) {
    assert.ok(n.inicioJugador && n.salida);
    for (const A of Object.values(n.automatas)) assert.ok(A.esCompleto());
  }
});

test('RF03 — nivel 4: A y B se comportan igual para toda cadena; C difiere', () => {
  const { A, B, C } = niveles[3].automatas;
  for (const w of cadenas(A.sigma, 6)) assert.equal(A.acepta(w), B.acepta(w));
  assert.equal(A.acepta('ca'), false); assert.equal(C.acepta('ca'), true);
});

test('RF07 — todos los niveles son resolubles: existe cadena que duerme a todos los guardias a la vez', () => {
  for (const n of niveles) {
    const gs = n.crearGuardias();
    let ok = false;
    for (const w of cadenas(n.alfabeto, 6)) {
      if (gs.every(g => g.automata.acepta(w))) { ok = true; break; }
    }
    assert.ok(ok, 'nivel ' + n.numero);
  }
});

test('RF08 — Almacen (respaldo en memoria): perfil anónimo, niveles, progreso, dibujo y validaciones', async () => {
  const a = await Almacen.abrir({ forzarMemoria: true, nombre: 'prueba-' + Math.random() });
  await a.inicializar(datos);
  assert.match(a.perfil.codigo_anonimo, /^SF-[0-9A-F]{12}$/);
  assert.deepEqual(Object.keys(a.perfil).sort(), ['codigo_anonimo', 'creado_en', 'id_perfil']); // RNF04: sin datos personales
  let niv = await a.niveles();
  assert.deepEqual(niv.map(n => n.estado), ['en_curso', 'bloqueado', 'bloqueado', 'bloqueado']);
  await a.sumarIntento(1);
  await a.marcarSuperado(1);
  niv = await a.niveles();
  assert.deepEqual(niv.map(n => n.estado), ['superado', 'en_curso', 'bloqueado', 'bloqueado']);
  assert.equal(niv[0].intentos, 1);

  const c = new Cuaderno(['a', 'b']);
  const p = c.agregarEstado(5, 6), q = c.agregarEstado(7, 8);
  c.marcarInicial(p.id); c.alternarAceptacion(q.id); c.ponerTransicion(p.id, 'a', q.id);
  await a.guardarDibujo(1, c.serializar());
  await a.registrarValidacion(1, false);
  await a.guardarDibujo(1, c.serializar()); // re-guardar reemplaza y conserva validaciones
  const cargado = Cuaderno.desde(await a.cargarDibujo(1), ['a', 'b']);
  assert.equal(cargado.estados.length, 2);
  assert.equal(cargado.transiciones.length, 1);
  assert.equal(cargado.inicial().etiqueta, 'q0');
  assert.equal((await a.validaciones(1)).length, 1);
  assert.equal((await a.b.todos('automata')).filter(x => x.tipo === 'dibujado').length, 1); // sin huérfanos
  // 1+1+1+3 = 6 AFD ocultos + 1 dibujado
  assert.equal((await a.b.todos('automata')).length, 6 + 1);
  assert.equal(await a.cargarDibujo(2), null);

  // Inicializar de nuevo es idempotente
  await a.inicializar(datos);
  assert.equal((await a.b.todos('nivel')).length, 4);
  assert.equal((await a.b.todos('progreso')).length, 4);
});

test('RF08 — Almacen: determinismo impuesto por índice único (origen, símbolo)', async () => {
  const a = await Almacen.abrir({ forzarMemoria: true, nombre: 'prueba-' + Math.random() });
  await a.inicializar(datos);
  const t = (await a.b.todos('transicion'))[0];
  await assert.rejects(a.b.add('transicion', { ...t, id_destino: t.id_destino }));
});

test('CU07 — diagnósticos: guardado y ganancia normalizada g = (Pos − Pre)/(100 − Pre)', async () => {
  const a = await Almacen.abrir({ forzarMemoria: true, nombre: 'prueba-' + Math.random() });
  await a.inicializar(datos);
  await a.guardarDiagnostico('inicial', 40);
  await a.guardarDiagnostico('final', 70);
  await a.guardarDiagnostico('final', 80); // reemplaza
  const d = await a.diagnosticos();
  assert.equal(d.inicial.puntaje, 40); assert.equal(d.final.puntaje, 80);
  assert.equal(gananciaNormalizada(40, 80), (80 - 40) / 60);
  assert.equal(gananciaNormalizada(100, 100), null);
});

test('CU07 — banco de diagnóstico: respuestas calculadas por el motor, forma inicial y final equivalentes', () => {
  for (const forma of ['inicial', 'final']) {
    const preguntas = generarDiagnostico(forma);
    assert.equal(preguntas.length, 6);
    for (const p of preguntas) {
      assert.ok(p.opciones.length >= 2);
      assert.ok(p.correcta >= 0 && p.correcta < p.opciones.length);
      assert.equal(new Set(p.opciones).size, p.opciones.length, 'opciones únicas: ' + p.enunciado);
    }
    // Contestar todo bien = 100, todo mal = 0
    assert.equal(puntuar(preguntas, preguntas.map(p => p.correcta)), 100);
    assert.equal(puntuar(preguntas, preguntas.map(p => (p.correcta + 1) % p.opciones.length)), 0);
  }
  const t = f => generarDiagnostico(f).map(p => p.tipo);
  assert.deepEqual(t('inicial'), t('final'));
});
