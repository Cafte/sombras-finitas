// Diagnóstico inicial y final (CU07, Sección VI-C). Dos formas con preguntas equivalentes
// (mismos tipos, distintos autómatas). Las respuestas correctas las calcula el motor formal.
import { Automata } from '../motor/automata.js';
import { equivalentes } from '../motor/equivalencia.js';
import { numEstadosMinimo } from '../motor/minimizador.js';

const A = (Q, q0, F, delta, sigma = ['a', 'b']) => new Automata(Q, sigma, delta, q0, F);

const FORMAS = {
  inicial: {
    lectura: { m: A(['p', 'q', 'r'], 'p', ['r'], { p: { a: 'q', b: 'p' }, q: { a: 'q', b: 'r' }, r: { a: 'q', b: 'p' } }), w: 'abba' },
    acepta: { m: A(['p', 'q', 'r'], 'p', ['r'], { p: { a: 'q', b: 'p' }, q: { a: 'q', b: 'r' }, r: { a: 'q', b: 'p' } }) },
    trampa: { m: A(['s0', 's1', 's2', 's3'], 's0', ['s2'], { s0: { a: 's1', b: 's3' }, s1: { a: 's3', b: 's2' }, s2: { a: 's2', b: 's3' }, s3: { a: 's3', b: 's3' } }) },
    equivalencia: {
      x: A(['u0', 'u1'], 'u0', ['u1'], { u0: { a: 'u0', b: 'u1' }, u1: { a: 'u0', b: 'u1' } }),
      y: A(['v0', 'v1', 'v2'], 'v0', ['v1', 'v2'], { v0: { a: 'v0', b: 'v1' }, v1: { a: 'v0', b: 'v2' }, v2: { a: 'v0', b: 'v2' } })
    },
    minimizacion: { m: A(['t0', 't1', 't2', 't3', 't4'], 't0', ['t3', 't4'], {
      t0: { a: 't1', b: 't2' }, t1: { a: 't3', b: 't3' }, t2: { a: 't4', b: 't4' }, t3: { a: 't3', b: 't3' }, t4: { a: 't4', b: 't4' } }) },
    inalcanzable: { m: A(['h0', 'h1', 'h2', 'h3'], 'h0', ['h1'], { h0: { a: 'h1', b: 'h2' }, h1: { a: 'h1', b: 'h0' }, h2: { a: 'h2', b: 'h0' }, h3: { a: 'h1', b: 'h3' } }) }
  },
  final: {
    lectura: { m: A(['x', 'y', 'z'], 'x', ['y'], { x: { a: 'y', b: 'x' }, y: { a: 'z', b: 'x' }, z: { a: 'z', b: 'y' } }), w: 'aabab' },
    acepta: { m: A(['x', 'y', 'z'], 'x', ['y'], { x: { a: 'y', b: 'x' }, y: { a: 'z', b: 'x' }, z: { a: 'z', b: 'y' } }) },
    trampa: { m: A(['k0', 'k1', 'k2', 'k3'], 'k0', ['k2'], { k0: { a: 'k3', b: 'k1' }, k1: { a: 'k2', b: 'k3' }, k2: { a: 'k2', b: 'k2' }, k3: { a: 'k3', b: 'k3' } }) },
    equivalencia: {
      x: A(['e0', 'e1', 'e2'], 'e0', ['e2'], { e0: { a: 'e1', b: 'e0' }, e1: { a: 'e1', b: 'e2' }, e2: { a: 'e1', b: 'e0' } }),
      y: A(['f0', 'f1', 'f2'], 'f0', ['f2'], { f0: { a: 'f1', b: 'f0' }, f1: { a: 'f1', b: 'f2' }, f2: { a: 'f2', b: 'f0' } })
    },
    minimizacion: { m: A(['w0', 'w1', 'w2', 'w3', 'w4', 'w5'], 'w0', ['w4', 'w5'], {
      w0: { a: 'w1', b: 'w2' }, w1: { a: 'w3', b: 'w3' }, w2: { a: 'w3', b: 'w3' }, w3: { a: 'w4', b: 'w5' }, w4: { a: 'w4', b: 'w5' }, w5: { a: 'w4', b: 'w5' } }) },
    inalcanzable: { m: A(['g0', 'g1', 'g2', 'g3'], 'g0', ['g2'], { g0: { a: 'g1', b: 'g0' }, g1: { a: 'g2', b: 'g0' }, g2: { a: 'g2', b: 'g2' }, g3: { a: 'g3', b: 'g2' } }) }
  }
};

function cadenasHasta(sigma, k) {
  const res = [];
  let act = [''];
  for (let i = 0; i < k; i++) {
    const sig = [];
    for (const w of act) for (const a of sigma) sig.push(w + a);
    res.push(...sig); act = sig;
  }
  return res;
}

// Coloca la respuesta correcta en una posición determinista (varía por pregunta)
function armar(enunciado, tipo, correcta, distractores, pos, extra = {}) {
  const opciones = [...distractores];
  opciones.splice(pos % (opciones.length + 1), 0, correcta);
  return { tipo, enunciado, opciones, correcta: opciones.indexOf(correcta), ...extra };
}

export function generarDiagnostico(forma) {
  const f = FORMAS[forma];
  const qs = [];

  // 1. Lectura de tabla de transición: δ*(q0, w)
  { const { m, w } = f.lectura;
    const r = m.extendida(m.q0, w);
    qs.push(armar(`Según la tabla, ¿a qué estado llega el autómata al procesar «${w}» desde el estado inicial? (δ*(${m.q0}, ${w}))`,
      'lectura', r, [...m.Q].filter(q => q !== r), 1, { tablas: [m] })); }

  // 2. Aceptación de cadenas
  { const { m } = f.acepta;
    const todas = cadenasHasta(m.sigma, 4).filter(w => w.length >= 3);
    const ok = todas.find(w => m.acepta(w));
    const mal = todas.filter(w => !m.acepta(w)).filter((_, i) => i % 3 === 0).slice(0, 3);
    qs.push(armar('¿Cuál de estas cadenas es ACEPTADA por el autómata de la tabla?', 'acepta', ok, mal, 2, { tablas: [m] })); }

  // 3. Estado trampa
  { const { m } = f.trampa;
    const t = m.trampas()[0];
    qs.push(armar('¿Cuál es el estado trampa del autómata?', 'trampa', t, [...m.Q].filter(q => q !== t), 0, { tablas: [m] })); }

  // 4. Equivalencia
  { const { x, y } = f.equivalencia;
    const iguales = equivalentes(x, y).iguales;
    const si = 'Sí, reconocen el mismo lenguaje', no = 'No, existe una cadena que los distingue';
    qs.push({ tipo: 'equivalencia', enunciado: '¿Los dos autómatas reconocen el mismo lenguaje?', opciones: [si, no], correcta: iguales ? 0 : 1, tablas: [x, y] }); }

  // 5. Minimización
  { const { m } = f.minimizacion;
    const k = numEstadosMinimo(m);
    const cand = [k - 1, k + 1, k + 2, k - 2].filter(n => n >= 1 && n !== k).slice(0, 3);
    qs.push(armar('¿Cuántos estados tiene el AFD mínimo equivalente?', 'minimizacion', String(k), cand.map(String), 2, { tablas: [m] })); }

  // 6. Estados alcanzables
  { const { m } = f.inalcanzable;
    const alc = m.alcanzables();
    const x = [...m.Q].find(q => !alc.has(q));
    qs.push(armar('¿Qué estado es inalcanzable desde el estado inicial?', 'inalcanzable', x, [...m.Q].filter(q => q !== x), 3, { tablas: [m] })); }

  return qs;
}

export function puntuar(preguntas, respuestas) {
  const bien = preguntas.reduce((s, p, i) => s + (respuestas[i] === p.correcta ? 1 : 0), 0);
  return Math.round((bien / preguntas.length) * 1000) / 10;
}

// g = (Pos − Pre) / (100 − Pre)  [Hake, 1998]
export function gananciaNormalizada(pre, pos) {
  if (pre >= 100) return null;
  return (pos - pre) / (100 - pre);
}
