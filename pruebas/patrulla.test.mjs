// Patrulla por turnos de los guardias (experimento en el nivel 4). Ejecutar: node --test pruebas/patrulla.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Nivel } from '../js/juego/nivel.js';
import { Partida } from '../js/juego/mapa.js';

const datos = JSON.parse(readFileSync(new URL('../data/niveles.json', import.meta.url)));
const niveles = datos.niveles.map(n => new Nivel(n));
const n4 = niveles[3];

test('Patrulla — solo el nivel 4 tiene guardias con ruta', () => {
  for (const n of niveles.slice(0, 3)) assert.ok(n.crearGuardias().every(g => g.ruta === null), `nivel ${n.numero}`);
  const [A, B, C] = n4.crearGuardias();
  assert.equal(A.ruta.length, 3); assert.equal(C.ruta.length, 3);
  assert.equal(B.ruta.length, 7, 'B patrulla de lado, con otro recorrido');
});

test('Patrulla — las rutas del nivel 4 son transitables y no se cruzan entre guardias', () => {
  const vistas = new Set();
  for (const g of n4.crearGuardias()) {
    const propias = new Set(g.ruta.map(c => c.x + ',' + c.y));
    for (const c of g.ruta) assert.notEqual(n4.celdas[c.y][c.x], '#');
    for (const k of propias) { assert.equal(vistas.has(k), false, 'casilla compartida ' + k); vistas.add(k); }
  }
});

test('Patrulla — A y C se mueven a la vez y de la misma forma; B se mueve distinto', () => {
  const [A, B, C] = n4.crearGuardias();
  for (let i = 0; i < 8; i++) {
    A.patrullar(); B.patrullar(); C.patrullar();
    assert.equal(A.y, C.y, 'A y C van sincronizados (paso ' + (i + 1) + ')');
    assert.equal(A.x, 3); assert.equal(C.x, 9);   // recorren su columna
    assert.equal(B.y, 1);                          // B solo se desplaza por su fila
  }
  const xs = []; B.reiniciar();
  for (let i = 0; i < 12; i++) { B.patrullar(); xs.push(B.x); }
  assert.deepEqual(xs, [5, 4, 5, 6, 7, 8, 7, 6, 5, 4, 5, 6]);
});

test('Patrulla — un guardia despierto va y vuelve por su ruta; uno dormido no se mueve', () => {
  const g = n4.crearGuardias()[0]; // A en (3,1), ruta vertical hasta (3,3)
  const pos = [];
  for (let i = 0; i < 6; i++) { g.patrullar(); pos.push(`${g.x},${g.y}`); }
  assert.deepEqual(pos, ['3,2', '3,3', '3,2', '3,1', '3,2', '3,3']);
  g.reiniciar();
  assert.deepEqual([g.x, g.y], [3, 1], 'reiniciar devuelve al guardia a su puesto');
  g.paso('c'); // A acepta con «c»: se duerme
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

test('Patrulla — al mover al jugador los despiertos avanzan y pueden descubrirlo; dormidos no', () => {
  const p = new Partida(n4);
  p.jugador = { x: 1, y: 3 };
  const r = p.mover('arriba'); // jugador a (1,2); A pasa a (3,2): distancia 2 → descubierto
  assert.equal(r.patrullaron, 3);
  assert.equal(r.resultado, 'descubierto');

  const q = new Partida(n4);
  q.jugador = { x: 1, y: 3 };
  q.senal('c'); // los tres guardias duermen
  const r2 = q.mover('arriba');
  assert.equal(r2.patrullaron, 0);
  assert.equal(r2.resultado, null);
  assert.deepEqual(q.guardias.map(g => [g.x, g.y]), [[3, 1], [6, 1], [9, 1]]);
});

test('Patrulla — el nivel 4 sigue siendo resoluble: «c» duerme a todos y se llega a la salida', () => {
  const p = new Partida(n4);
  p.salidaAbierta = true;
  assert.equal(p.senal('c').resultado, null);
  let r;
  for (let i = 0; i < 10; i++) r = p.mover('derecha');
  assert.equal(r.resultado, 'ganado');
});

test('Patrulla — reaparecer devuelve a los guardias a su puesto', () => {
  const p = new Partida(n4);
  p.guardias.forEach(g => g.patrullar());
  p.reaparecer();
  assert.deepEqual(p.guardias.map(g => [g.x, g.y]), [[3, 1], [6, 1], [9, 1]]);
});
