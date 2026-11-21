// Niveles 3, 4 y 5: ayudas didácticas, lenguajes disjuntos, camino = cadena y resolubilidad demostrada con un solver.
// Ejecutar: node --test pruebas/niveles.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Automata } from '../js/motor/automata.js';
import { equivalentes } from '../js/motor/equivalencia.js';
import { Nivel } from '../js/juego/nivel.js';
import { Partida } from '../js/juego/mapa.js';
import { predecir } from '../js/juego/prediccion.js';

const datos = JSON.parse(readFileSync(new URL('../data/niveles.json', import.meta.url)));
const niveles = datos.niveles.map(n => new Nivel(n));
const [, , n3, n4, n5] = niveles;

function* cadenas(sigma, k) {
  let act = [''];
  yield '';
  for (let i = 0; i < k; i++) { const sig = []; for (const w of act) for (const a of sigma) sig.push(w + a); yield* sig; act = sig; }
}

// Solver: búsqueda en anchura sobre (jugador, estado y posición de cada guardia). Con la salida abierta,
// devuelve la lista de acciones más corta que lleva a ganar sin ser descubierto, o null si no existe.
function resolver(nivel) {
  const p = new Partida(nivel);
  p.salidaAbierta = true;
  const snap = () => ({ j: { ...p.jugador }, g: p.guardias.map(g => ({ q: g.estado, x: g.x, y: g.y, i: g.i, d: g.dir })) });
  const rest = o => {
    p.jugador = { ...o.j }; p.estado = 'jugando';
    p.guardias.forEach((g, k) => { const v = o.g[k]; g.estado = v.q; g.x = v.x; g.y = v.y; g.i = v.i; g.dir = v.d; });
  };
  const clave = o => `${o.j.x},${o.j.y}|` + o.g.map(v => `${v.q},${v.i},${v.d}`).join(';');
  const acciones = ['arriba', 'abajo', 'izquierda', 'derecha', ...(nivel.camino ? [] : nivel.alfabeto.map(a => 'senal:' + a))];
  const ini = snap();
  const cola = [[ini, []]], vistos = new Set([clave(ini)]);
  while (cola.length) {
    const [s, camino] = cola.shift();
    for (const ac of acciones) {
      rest(s);
      const r = ac.startsWith('senal:') ? p.senal(ac.slice(6)) : p.mover(ac);
      if (!r.ok) continue;
      if (p.estado === 'ganado') return [...camino, ac];
      if (p.estado !== 'jugando') continue;
      const n = snap(), k = clave(n);
      if (!vistos.has(k)) { vistos.add(k); cola.push([n, [...camino, ac]]); }
    }
  }
  return null;
}

/* ---------- Nivel 3: predicción vs realidad + costo de señal ---------- */
test('Nivel 3 — ayudas: predicción del diagrama y cada señal es un turno', () => {
  assert.equal(n3.prediccion, true); assert.equal(n3.costoSenal, true);
  assert.equal(niveles[0].prediccion, false); assert.equal(niveles[0].costoSenal, false);
});

test('Nivel 3 — la cadena más corta que duerme a todos es «a»', () => {
  assert.equal(n3.mejorCadena(), 'a');
  const gs = n3.crearGuardias();
  assert.ok(gs.every(g => g.automata.acepta('a')));
});

test('Nivel 3 — emitir una señal mueve a los guardias despiertos (y solo a ellos)', () => {
  const p = new Partida(n3);
  const antes = p.guardias.map(g => [g.x, g.y]);
  const r = p.senal('b');                               // b no duerme a nadie: ambos patrullan
  assert.equal(r.patrullaron, 2);
  assert.deepEqual(p.guardias.map(g => [g.x, g.y]), [[4, 1], [8, 1]]);
  const q = new Partida(n3);
  q.senal('a');                                         // a duerme a ambos: nadie se mueve
  assert.deepEqual(q.guardias.map(g => [g.x, g.y]), antes);
});

test('Nivel 3 — el inicio es seguro aunque se emitan muchas señales (los guardias se alejan o vuelven a su puesto)', () => {
  const p = new Partida(n3);
  for (let i = 0; i < 12; i++) assert.equal(p.senal('b').resultado, null, 'señal ' + (i + 1));
  assert.equal(p.estado, 'jugando');
});

test('Nivel 3 — es resoluble (solver) y la solución más corta usa «a»', () => {
  const sol = resolver(n3);
  assert.ok(sol, 'sin solución');
  assert.ok(sol.includes('senal:a'));
});

test('Predicción — el diagrama del estudiante predice dormido/despierto; incompleto o sin inicial → null', () => {
  const S = new Automata(['p', 'q'], ['a', 'b'], { p: { a: 'q', b: 'p' }, q: { a: 'q', b: 'p' } }, 'p', ['q']);
  assert.equal(predecir(S, '', 'a'), 'dormido');
  assert.equal(predecir(S, 'a', 'b'), 'despierto');
  assert.equal(predecir(S, 'ab', 'a'), 'dormido');
  const incompleto = new Automata(['p'], ['a', 'b'], { p: { a: 'p' } }, 'p', ['p']);
  assert.equal(predecir(incompleto, '', 'b'), null);
  assert.equal(predecir(new Automata(['p'], ['a'], { p: { a: 'p' } }, null, []), '', 'a'), null);
  assert.equal(predecir(null, '', 'a'), null);
});

/* ---------- Nivel 4: dos zonas, lenguajes disjuntos ---------- */
test('Nivel 4 — A ≡ B y A ≢ C, pero ninguna cadena duerme a los tres a la vez (lenguajes disjuntos)', () => {
  const { A, B, C } = n4.automatas;
  assert.equal(equivalentes(A, B).iguales, true);
  assert.equal(equivalentes(A, C).iguales, false);
  for (const w of cadenas(n4.alfabeto, 8)) assert.equal(A.acepta(w) && C.acepta(w), false, 'cadena ' + w);
  assert.equal(n4.mejorCadena(), null);
});

test('Nivel 4 — se debe dormir cada zona en su momento: primero «a» (A y B), luego «c» (C) desde el refugio', () => {
  const sol = resolver(n4);
  assert.ok(sol, 'sin solución');
  const senales = sol.filter(s => s.startsWith('senal:')).map(s => s.slice(6));
  assert.ok(senales.indexOf('a') >= 0 && senales.indexOf('c') > senales.indexOf('a'), 'orden de señales: ' + senales);

  // Dormir solo a C primero deja despiertos a A y B en la primera zona: el jugador es descubierto.
  const p = new Partida(n4);
  p.salidaAbierta = true;
  p.senal('c');
  let r = { resultado: null };
  for (let i = 0; i < 10 && r.resultado === null; i++) r = p.mover('derecha');
  assert.equal(r.resultado, 'descubierto');
});

/* ---------- Nivel 5 (bonus): el camino es la cadena ---------- */
test('Nivel 5 — pisar una casilla con letra emite esa señal; las demás casillas no', () => {
  assert.equal(n5.camino, true); assert.equal(n5.bonus, true);
  const p = new Partida(n5);
  assert.equal(p.guardias[0].dormido, true, 'el guardia empieza dormido (0 aes = par)');
  p.jugador = { x: 2, y: 2 };
  const r = p.mover('derecha');                        // pisa (3,2) = «a»
  assert.equal(r.emitio, 'a');
  assert.equal(p.senales, 'a');
  assert.equal(p.guardias[0].dormido, false);
  const r2 = p.mover('derecha');                       // (4,2) es suelo
  assert.equal(r2.emitio, null);
  assert.equal(p.senales, 'a');
});

test('Nivel 5 — recto por la fila 2 te descubre; la fila 1 (dos «a») lo mantiene dormido', () => {
  const p = new Partida(n5);
  p.salidaAbierta = true;
  let r = { resultado: null };
  for (let i = 0; i < 6 && r.resultado === null; i++) r = p.mover('derecha');
  assert.equal(r.resultado, 'descubierto');

  const q = new Partida(n5);
  q.salidaAbierta = true;
  const ruta = ['arriba', ...'derecha'.repeat(10).split('').map(() => 'derecha'), 'abajo'];
  let s = { resultado: null };
  for (const m of ruta) { s = q.mover(m); if (s.resultado) break; }
  assert.equal(s.resultado, 'ganado');
  assert.equal(q.senales.match(/a/g).length % 2, 0, 'cantidad par de «a» en el camino');
});

test('Nivel 5 — es resoluble (solver) y la solución pasa por un número par de casillas «a»', () => {
  const sol = resolver(n5);
  assert.ok(sol, 'sin solución');
  assert.ok(sol.every(a => !a.startsWith('senal:')), 'sin botones de señal');
  // Reproducir la solución y contar las «a» emitidas
  const p = new Partida(n5);
  p.salidaAbierta = true;
  for (const m of sol) p.mover(m);
  assert.equal(p.estado, 'ganado');
  assert.ok(p.senales.length >= 2);
  assert.equal(p.senales.split('').filter(c => c === 'a').length % 2, 0);
});

test('Todos los niveles: tienen salida, inicio y solución demostrada por el solver', () => {
  for (const n of niveles) {
    assert.ok(n.inicioJugador && n.salida, 'nivel ' + n.numero);
    assert.ok(resolver(n), 'nivel ' + n.numero + ' sin solución');
  }
});
