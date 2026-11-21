// Música de fondo: parte pura (afinación, acordes, melodía). El audio en sí se verifica en el navegador.
// Ejecutar: node --test pruebas/musica.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { mtof, ACORDES, elegirNota, BPM, BEAT } from '../js/ui/musica.js';

test('Música — afinación: La4 = 440 Hz y una octava duplica la frecuencia', () => {
  assert.equal(mtof(69), 440);
  assert.ok(Math.abs(mtof(57) - 220) < 1e-9);
  assert.ok(Math.abs(mtof(74) / mtof(62) - 2) < 1e-9);
});

test('Música — el tempo es lento (sigilo) y coherente', () => {
  assert.ok(BPM >= 40 && BPM <= 70);
  assert.ok(Math.abs(BEAT - 60 / BPM) < 1e-12);
});

test('Música — todos los acordes y notas de la melodía están en re menor (con la dominante La)', () => {
  const permitidas = new Set([0, 1, 2, 4, 5, 7, 9, 10]);   // C, C#, D, E, F, G, A, Bb
  assert.equal(ACORDES.length, 4);
  for (const a of ACORDES) {
    for (const m of [...a.notas, a.grave, ...a.agudas]) assert.ok(permitidas.has(m % 12), `${a.nombre}: nota ${m}`);
    assert.ok(a.agudas.length >= 4);
    assert.ok(a.agudas.every(m => mtof(m) > 200 && mtof(m) < 1600), 'rango de campana audible y no estridente');
  }
});

test('Música — la melodía avanza por pasos cortos dentro del acorde (paseo aleatorio)', () => {
  let semilla = 12345;
  const azar = () => { semilla = (semilla * 1664525 + 1013904223) % 4294967296; return semilla / 4294967296; };
  for (let acorde = 0; acorde < ACORDES.length; acorde++) {
    const pool = ACORDES[acorde].agudas;
    let ant = null;
    for (let i = 0; i < 200; i++) {
      const n = elegirNota(acorde, ant, azar);
      assert.ok(pool.includes(n));
      if (ant !== null) assert.ok(Math.abs(pool.indexOf(n) - pool.indexOf(ant)) <= 2, 'salto demasiado grande');
      ant = n;
    }
  }
});
