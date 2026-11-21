// Pistas: que existan, que lo que afirman sea verdad (comprobado con el motor) y que las dinámicas respondan al jugador.
// Ejecutar: node --test pruebas/pistas.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Nivel } from '../js/juego/nivel.js';
import { Cuaderno } from '../js/cuaderno/cuaderno.js';
import { numEstadosMinimo } from '../js/motor/minimizador.js';
import { observacion, pistaDiagrama } from '../js/juego/pistas.js';

const datos = JSON.parse(readFileSync(new URL('../data/niveles.json', import.meta.url)));
const niveles = datos.niveles.map(n => new Nivel(n));
const [n1, n2, n3, n4, n5] = niveles;

function* cadenas(sigma, k) {
  let act = [''];
  yield '';
  for (let i = 0; i < k; i++) { const sig = []; for (const w of act) for (const a of sigma) sig.push(w + a); yield* sig; act = sig; }
}

test('Pistas — cada nivel tiene tres pistas de texto, de suave a casi la solución', () => {
  for (const n of niveles) {
    assert.equal(n.pistas.length, 3, 'nivel ' + n.numero);
    assert.ok(n.pistas.every(t => typeof t === 'string' && t.length > 40));
    assert.ok(n.pistas[2].length >= n.pistas[0].length * 0.8, 'la última pista da más detalle');
  }
});

test('Pistas verdaderas — nivel 1: el guardia se duerme cuando la última señal fue «a»', () => {
  const A = n1.automatas.A;
  for (const w of cadenas(['a', 'b'], 6)) assert.equal(A.acepta(w), w.endsWith('a'), w);
});

test('Pistas verdaderas — nivel 2: solo duermen «ab» y «ab» seguida de más «a»; hay un estado trampa', () => {
  const A = n2.automatas.A;
  for (const w of cadenas(['a', 'b'], 7)) assert.equal(A.acepta(w), /^aba*$/.test(w), w);
  assert.equal(A.trampas().length, 1);
});

test('Pistas verdaderas — nivel 3: «b» no cambia nada, «c» reinicia, solo duerme el estado con resto 1 de «a»; mínimo de 3 estados', () => {
  const A = n3.automatas.A;
  for (const w of cadenas(['a', 'b', 'c'], 6)) {
    const desdeC = w.slice(w.lastIndexOf('c') + 1);
    const aes = [...desdeC].filter(x => x === 'a').length;
    assert.equal(A.acepta(w), aes % 3 === 1, w);
  }
  assert.equal(numEstadosMinimo(A), 3);
  assert.deepEqual(['a', 'aa', 'aaa', 'aaaa'].map(w => A.acepta(w)), [true, false, false, true]);
});

test('Pistas verdaderas — nivel 4: A y B duermen con «a» al final, C con «c»; A≡B; «a» distingue A de C', () => {
  const { A, B, C } = n4.automatas;
  for (const w of cadenas(['a', 'b', 'c'], 5)) {
    assert.equal(A.acepta(w), w.endsWith('a'), w);
    assert.equal(B.acepta(w), w.endsWith('a'), w);
    assert.equal(C.acepta(w), w.endsWith('c'), w);
  }
  assert.equal(A.acepta('a'), true); assert.equal(C.acepta('a'), false);
});

test('Pistas verdaderas — nivel 5: duerme con un número par de «a» (empieza dormido); hay dos «a» seguidas en la fila de arriba', () => {
  const A = n5.automatas.A;
  for (const w of cadenas(['a', 'b'], 7)) assert.equal(A.acepta(w), [...w].filter(x => x === 'a').length % 2 === 0, w);
  assert.equal(n5.celdas[1][3], 'a'); assert.equal(n5.celdas[1][4], 'a');
});

test('Observación — dice con qué cadena más corta se vio dormido cada guardia, o que aún no', () => {
  const gs = [{ id: 'A' }, { id: 'B' }];
  const filas = [
    { cadena: '', dorm: [false, false] },
    { cadena: 'b', dorm: [false, false] },
    { cadena: 'ba', dorm: [true, false] },
    { cadena: 'baa', dorm: [true, false] },
  ];
  const t = observacion(gs, filas);
  assert.match(t[0], /Guardia A: lo viste dormido con «ba»/);
  assert.match(t[1], /Guardia B: todavía no lo has visto dormido/);
  assert.match(observacion([{ id: 'G' }], [{ cadena: '', dorm: [true] }])[0], /la cadena vacía/);
});

// Diagrama del nivel 1 con las transiciones indicadas (q0 inicial; q1 de aceptación opcional)
function diagrama1({ aceptaQ1 = true, destinos = { q0: { a: 1, b: 0 }, q1: { a: 1, b: 0 } }, inicial = true } = {}) {
  const c = new Cuaderno(['a', 'b']);
  const q = [c.agregarEstado(0.2, 0.5), c.agregarEstado(0.7, 0.5)];
  if (inicial) c.marcarInicial(q[0].id);
  if (aceptaQ1) c.alternarAceptacion(q[1].id);
  for (const [o, m] of Object.entries(destinos)) for (const [s, d] of Object.entries(m)) c.ponerTransicion(q[Number(o[1])].id, s, q[d].id);
  return c;
}

test('Pista del diagrama — vacío, incompleto, equivocado y correcto (nivel 1)', () => {
  assert.match(pistaDiagrama(new Cuaderno(['a', 'b']), n1), /no has dibujado nada/);
  assert.match(pistaDiagrama(diagrama1({ inicial: false }), n1), /inicial/);
  assert.match(pistaDiagrama(diagrama1({ destinos: { q0: { a: 1 }, q1: { a: 1, b: 0 } } }), n1), /Faltan transiciones/);

  const mal = diagrama1({ destinos: { q0: { a: 0, b: 1 }, q1: { a: 0, b: 1 } } });   // «termina en b»: la contraria
  const t = pistaDiagrama(mal, n1);
  assert.match(t, /Con la cadena/);
  assert.match(t, /Pruébala en el juego/);

  assert.match(pistaDiagrama(diagrama1(), n1), /ya es correcto/);
});

test('Pista del diagrama — la cadena que nombra es de verdad un contraejemplo', () => {
  const mal = diagrama1({ destinos: { q0: { a: 0, b: 1 }, q1: { a: 0, b: 1 } } });
  const m = pistaDiagrama(mal, n1).match(/«([ab]*)»|la cadena vacía/);
  const w = m && m[1] !== undefined ? m[1] : '';
  assert.notEqual(mal.aAutomata().acepta(w), n1.automatas.A.acepta(w));
});

test('Pista del diagrama — nivel 3: un diagrama equivalente pero de 6 estados pide el mínimo', () => {
  const grande = Cuaderno.desde(null, n3.alfabeto);
  const ids = [];
  for (let i = 0; i < 6; i++) { const e = grande.agregarEstado(i, 0); ids.push(e.id); if (i === 1 || i === 4) grande.alternarAceptacion(e.id); }
  grande.marcarInicial(ids[0]);
  const T = n3.automataObjetivo.delta;
  for (let i = 0; i < 6; i++) for (const a of n3.alfabeto) grande.ponerTransicion(ids[i], a, ids[Number(T['q' + i][a][1])]);
  assert.match(pistaDiagrama(grande, n3), /tiene 6 estados y el mínimo tiene 3/);
});

test('Pista del diagrama — nivel 4 (equivalencia): al acertar recuerda el reto de equivalencia', () => {
  const c = new Cuaderno(n4.alfabeto);
  const [q0, q1] = [c.agregarEstado(0.2, 0.5), c.agregarEstado(0.7, 0.5)];
  c.marcarInicial(q0.id); c.alternarAceptacion(q1.id);
  for (const s of [q0, q1]) { c.ponerTransicion(s.id, 'a', q1.id); c.ponerTransicion(s.id, 'b', q0.id); c.ponerTransicion(s.id, 'c', q0.id); }
  assert.match(pistaDiagrama(c, n4), /reto de equivalencia/);
});
