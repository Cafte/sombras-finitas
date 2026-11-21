// Patrulla por turnos de los guardias (niveles 3 y 4). Ejecutar: node --test pruebas/patrulla.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Nivel } from '../js/juego/nivel.js';
import { Partida } from '../js/juego/mapa.js';

const datos = JSON.parse(readFileSync(new URL('../data/niveles.json', import.meta.url)));
const niveles = datos.niveles.map(n => new Nivel(n));
const [n1, n2, n3, n4, n5] = niveles;

test('Patrulla — solo los niveles 3 y 4 tienen guardias con ruta', () => {
  for (const n of [n1, n2, n5]) assert.ok(n.crearGuardias().every(g => g.ruta === null), `nivel ${n.numero}`);
  assert.ok(n3.crearGuardias().every(g => g.ruta));
  const [A, B, C] = n4.crearGuardias();
  assert.equal(A.ruta.length, 3); assert.equal(C.ruta.length, 3);
  assert.equal(B.ruta.length, 2, 'B patrulla de lado, con otro recorrido');
});

test('Patrulla — las rutas son transitables y no se cruzan entre guardias', () => {
  for (const n of [n3, n4]) {
    const vistas = new Set();
    for (const g of n.crearGuardias()) {
      const propias = new Set(g.ruta.map(c => c.x + ',' + c.y));
      for (const c of g.ruta) assert.notEqual(n.celdas[c.y][c.x], '#');
      for (const k of propias) { assert.equal(vistas.has(k), false, `nivel ${n.numero}: casilla compartida ${k}`); vistas.add(k); }
    }
  }
});

test('Patrulla — nivel 4: A y C van sincronizados (vertical) y B se mueve distinto (horizontal)', () => {
  const [A, B, C] = n4.crearGuardias();
  const xsB = [];
  for (let i = 0; i < 6; i++) {
    A.patrullar(); B.patrullar(); C.patrullar();
    assert.equal(A.y, C.y, 'A y C sincronizados en el paso ' + (i + 1));
    assert.equal(A.x, 3); assert.equal(C.x, 12);   // recorren su columna
    assert.equal(B.y, 1); xsB.push(B.x);            // B solo se desplaza por su fila
  }
  assert.deepEqual(xsB, [6, 5, 6, 5, 6, 5]);
});

test('Patrulla — un guardia despierto va y vuelve; uno dormido no se mueve; reiniciar lo devuelve a su puesto', () => {
  const g = n4.crearGuardias()[0];   // A en (3,1), ruta vertical hasta (3,3)
  const pos = [];
  for (let i = 0; i < 6; i++) { g.patrullar(); pos.push(`${g.x},${g.y}`); }
  assert.deepEqual(pos, ['3,2', '3,3', '3,2', '3,1', '3,2', '3,3']);
  g.reiniciar();
  assert.deepEqual([g.x, g.y], [3, 1]);
  g.paso('a');   // A acepta con «a»: se duerme
  assert.equal(g.dormido, true);
  assert.equal(g.patrullar(), false);
  assert.deepEqual([g.x, g.y], [3, 1]);
});

test('Patrulla — el guardia espera si la casilla siguiente está ocupada', () => {
  const g = n4.crearGuardias()[0];
  assert.equal(g.patrullar((x, y) => x === 3 && y === 2), false);
  assert.deepEqual([g.x, g.y], [3, 1]);
  assert.equal(g.patrullar(), true);
});

test('Patrulla — nivel 4: al mover al jugador los despiertos avanzan y pueden descubrirlo; dormidos no', () => {
  const p = new Partida(n4);
  const r = p.mover('derecha');            // jugador a (2,2); A pasa a (3,2): distancia 1
  assert.equal(r.patrullaron, 3);
  assert.equal(r.resultado, 'descubierto');

  const q = new Partida(n4);
  q.senal('a');                             // duerme a A y B; C sigue despierto
  const r2 = q.mover('derecha');
  assert.equal(r2.patrullaron, 1, 'solo patrulla C');
  assert.equal(r2.resultado, null);
  assert.deepEqual(q.guardias.map(g => [g.x, g.y]), [[3, 1], [5, 1], [12, 2]]);
});

test('Patrulla — reaparecer devuelve a los guardias a su puesto', () => {
  const p = new Partida(n4);
  p.guardias.forEach(g => g.patrullar());
  p.reaparecer();
  assert.deepEqual(p.guardias.map(g => [g.x, g.y]), [[3, 1], [5, 1], [12, 1]]);
});
