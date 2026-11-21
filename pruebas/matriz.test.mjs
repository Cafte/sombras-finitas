// Matriz de pruebas funcionales PF01–PF14 (Tabla XVI del documento IEEE).
// Cada caso usa el autómata de referencia M1 (número par de aes sobre Σ = {a, b}) y resultados calculados a mano.
// PF10 y PF14 dependen de la interfaz táctil y del navegador: se verifican a mano (ver README, «Pruebas manuales»).
// Ejecutar: node --test pruebas/matriz.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Automata } from '../js/motor/automata.js';
import { equivalentes } from '../js/motor/equivalencia.js';
import { minimizar } from '../js/motor/minimizador.js';
import { Cuaderno } from '../js/cuaderno/cuaderno.js';
import { Nivel } from '../js/juego/nivel.js';
import { Partida } from '../js/juego/mapa.js';
import { Almacen } from '../js/datos/almacen.js';

const S = ['a', 'b'];
const M1 = new Automata(['q0', 'q1'], S, { q0: { a: 'q1', b: 'q0' }, q1: { a: 'q0', b: 'q1' } }, 'q0', ['q0']);
// M2: cuatro estados que duplican q0 y q1 (q2 ≡ q0, q3 ≡ q1)
const M2 = new Automata(['q0', 'q1', 'q2', 'q3'], S, {
  q0: { a: 'q1', b: 'q2' }, q1: { a: 'q2', b: 'q3' }, q2: { a: 'q3', b: 'q0' }, q3: { a: 'q0', b: 'q1' }
}, 'q0', ['q0', 'q2']);
// M3: igual a M1 pero con F = {q1}
const M3 = new Automata(['q0', 'q1'], S, M1.delta, 'q0', ['q1']);

const datos = JSON.parse(readFileSync(new URL('../data/niveles.json', import.meta.url)));
const niveles = datos.niveles.map(n => new Nivel(n));

test('PF01 — acepta("") sobre M1: δ*(q0, ε) = q0 ∈ F', () => {
  assert.equal(M1.acepta(''), true);
});
test('PF02 — acepta("abba") sobre M1: q0→q1→q1→q1→q0', () => {
  assert.equal(M1.acepta('abba'), true);
  assert.deepEqual(['a', 'ab', 'abb', 'abba'].map(w => M1.extendida('q0', w)), ['q1', 'q1', 'q1', 'q0']);
});
test('PF03 — acepta("ab") sobre M1: termina en q1 ∉ F', () => {
  assert.equal(M1.acepta('ab'), false);
  assert.equal(M1.extendida('q0', 'ab'), 'q1');
});
test('PF04 — esCompleto: verdadero para M1, falso para un AFD sin δ(q1, b)', () => {
  const incompleto = new Automata(['q0', 'q1'], S, { q0: { a: 'q1', b: 'q0' }, q1: { a: 'q0' } }, 'q0', ['q0']);
  assert.equal(M1.esCompleto(), true);
  assert.equal(incompleto.esCompleto(), false);
});
test('PF05 — esTrampa: verdadero para t (δ(t,a)=δ(t,b)=t, t ∉ F); falso para q1 de M1', () => {
  const T = new Automata(['s', 't'], S, { s: { a: 't', b: 't' }, t: { a: 't', b: 't' } }, 's', ['s']);
  assert.equal(T.esTrampa('t'), true);
  assert.equal(M1.esTrampa('q1'), false);
});
test('PF06 — M1 y M2 son equivalentes', () => {
  assert.equal(equivalentes(M1, M2).iguales, true);
});
test('PF07 — M1 y M3 no son equivalentes; contraejemplo mínimo ε', () => {
  const r = equivalentes(M1, M3);
  assert.equal(r.iguales, false);
  assert.equal(r.contraejemplo, '');
});
test('PF08 — la minimización de M2 es un AFD de dos estados equivalente a M1', () => {
  const m = minimizar(M2);
  assert.equal(m.Q.size, 2);
  assert.equal(equivalentes(m, M1).iguales, true);
});
test('PF09 — el guardia detecta al jugador solo dentro del radio de su estado actual', () => {
  const p = new Partida(niveles[0]); // guardia A en (5,1), despierto en q0 (radio 2)
  p.jugador = { x: 3, y: 1 };
  assert.ok(p.detectadoPor(), 'dentro del radio (distancia 2)');
  p.jugador = { x: 2, y: 1 };
  assert.equal(p.detectadoPor(), null, 'fuera del radio (distancia 3)');
  p.jugador = { x: 3, y: 1 };
  p.senal('a'); // q0 --a--> q1 (aceptación): el guardia se duerme y su radio es 0
  assert.equal(p.guardias[0].radio, 0);
  assert.equal(p.detectadoPor(), null, 'dormido: no detecta');
});
test('PF11 — validar un diagrama sin estado inicial: lo señala y no evalúa la equivalencia', () => {
  const c = new Cuaderno(S);
  const e = c.agregarEstado(0.5, 0.5);
  c.ponerTransicion(e.id, 'a', e.id); c.ponerTransicion(e.id, 'b', e.id);
  const r = c.validar(niveles[0].automataObjetivo);
  assert.equal(r.estado, 'incompleto');
  assert.ok(r.motivos.some(m => /inicial/i.test(m)));
});
test('PF12 — un diagrama equivalente al AFD oculto es aceptado y se guardan progreso y diagrama', async () => {
  const n = niveles[0];
  const c = new Cuaderno(n.alfabeto);
  const q0 = c.agregarEstado(0.2, 0.5), q1 = c.agregarEstado(0.7, 0.5);
  c.marcarInicial(q0.id); c.alternarAceptacion(q1.id);
  c.ponerTransicion(q0.id, 'a', q1.id); c.ponerTransicion(q0.id, 'b', q0.id);
  c.ponerTransicion(q1.id, 'a', q1.id); c.ponerTransicion(q1.id, 'b', q0.id);
  const r = c.validar(n.automataObjetivo);
  assert.equal(r.estado, 'equivalente');
  const al = await Almacen.abrir({ forzarMemoria: true, nombre: 'pf12-' + Math.random() });
  await al.inicializar(datos);
  await al.guardarDibujo(1, c.serializar());
  await al.registrarValidacion(1, true);
  await al.marcarSuperado(1);
  const niv = await al.niveles();
  assert.equal(niv[0].estado, 'superado');
  assert.equal(niv[1].estado, 'en_curso', 'se pasa al siguiente nivel');
  assert.ok(await al.cargarDibujo(1));
});
test('PF13 — progreso, diagrama y respuestas de equivalencia se conservan al reabrir', async () => {
  const nombre = 'pf13-' + Math.random();
  const a = await Almacen.abrir({ forzarMemoria: true, nombre });
  await a.inicializar(datos);
  const c = new Cuaderno(['a', 'b']);
  const e = c.agregarEstado(0.5, 0.5); c.marcarInicial(e.id);
  await a.guardarDibujo(1, c.serializar());
  await a.marcarSuperado(1);
  await a.guardarPares(4, { 0: 'equivalentes', 1: 'difieren con «c»' });
  // «Reabrir»: nueva instancia sobre el mismo almacenamiento; la inicialización es idempotente.
  const b = new Almacen(a.b, 'memoria');
  await b.inicializar(datos);
  assert.equal((await b.niveles())[0].estado, 'superado');
  assert.equal((await b.cargarDibujo(1)).estados.length, 1);
  assert.deepEqual(await b.cargarPares(4), { 0: 'equivalentes', 1: 'difieren con «c»' });
  assert.deepEqual(await b.cargarPares(1), {});
});
