// Minimización: eliminación de inalcanzables + algoritmo de llenado de tabla (RF02).
import { Automata } from './automata.js';

export function eliminarInalcanzables(A) {
  const alc = A.alcanzables();
  const Q = [...A.Q].filter(q => alc.has(q));
  const delta = {};
  for (const q of Q) {
    delta[q] = {};
    for (const a of A.sigma) delta[q][a] = A.paso(q, a);
  }
  return new Automata(Q, A.sigma, delta, A.q0, [...A.F].filter(q => alc.has(q)));
}

// Pares distinguibles por llenado de tabla. Devuelve Set de claves "p|q" (p < q).
export function paresDistinguibles(A) {
  const Q = [...A.Q].sort();
  const clave = (p, q) => (p < q ? p + '|' + q : q + '|' + p);
  const marcados = new Set();
  for (let i = 0; i < Q.length; i++)
    for (let j = i + 1; j < Q.length; j++)
      if (A.F.has(Q[i]) !== A.F.has(Q[j])) marcados.add(clave(Q[i], Q[j]));
  let cambio = true;
  while (cambio) {
    cambio = false;
    for (let i = 0; i < Q.length; i++) {
      for (let j = i + 1; j < Q.length; j++) {
        const k = clave(Q[i], Q[j]);
        if (marcados.has(k)) continue;
        for (const a of A.sigma) {
          const p2 = A.paso(Q[i], a), q2 = A.paso(Q[j], a);
          if (p2 !== q2 && marcados.has(clave(p2, q2))) {
            marcados.add(k); cambio = true; break;
          }
        }
      }
    }
  }
  return marcados;
}

// Devuelve el AFD mínimo (estados nombrados m0, m1, ... con m0 = clase del inicial).
export function minimizar(A) {
  const B = eliminarInalcanzables(A);
  const marcados = paresDistinguibles(B);
  const clave = (p, q) => (p < q ? p + '|' + q : q + '|' + p);
  const Q = [...B.Q].sort();
  // Orden: la clase del estado inicial primero.
  Q.sort((x, y) => (x === B.q0 ? -1 : y === B.q0 ? 1 : (x < y ? -1 : 1)));
  const claseDe = new Map();
  const clases = [];
  for (const q of Q) {
    if (claseDe.has(q)) continue;
    const idx = clases.length;
    const miembros = [q];
    claseDe.set(q, idx);
    for (const r of Q) {
      if (r !== q && !claseDe.has(r) && !marcados.has(clave(q, r))) {
        claseDe.set(r, idx); miembros.push(r);
      }
    }
    clases.push(miembros);
  }
  const nombre = i => 'm' + i;
  const delta = {};
  clases.forEach((miembros, i) => {
    delta[nombre(i)] = {};
    for (const a of B.sigma) delta[nombre(i)][a] = nombre(claseDe.get(B.paso(miembros[0], a)));
  });
  const F = clases.map((m, i) => (B.F.has(m[0]) ? nombre(i) : null)).filter(Boolean);
  const M = new Automata(clases.map((_, i) => nombre(i)), B.sigma, delta, nombre(claseDe.get(B.q0)), F);
  M.clases = clases;
  return M;
}

export function numEstadosMinimo(A) { return minimizar(A).Q.size; }
