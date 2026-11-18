// Equivalencia de AFD por recorrido en anchura de pares (p, q) alcanzables.
// El primer par distinguible entrega un contraejemplo de longitud mínima (RF06).

export function equivalentes(A, B) {
  if (!A.esCompleto() || !B.esCompleto()) {
    throw new Error('Ambos autómatas deben ser completos');
  }
  if (A.sigma.length !== B.sigma.length || !A.sigma.every(a => B.sigma.includes(a))) {
    throw new Error('Los alfabetos deben coincidir');
  }
  const cola = [[A.q0, B.q0, '']];
  const vistos = new Set([A.q0 + '|' + B.q0]);
  while (cola.length > 0) {
    const [p, q, w] = cola.shift();
    if (A.F.has(p) !== B.F.has(q)) {
      return { iguales: false, contraejemplo: w, aceptaA: A.F.has(p), aceptaB: B.F.has(q) };
    }
    for (const a of A.sigma) {
      const p2 = A.paso(p, a), q2 = B.paso(q, a);
      const clave = p2 + '|' + q2;
      if (!vistos.has(clave)) {
        vistos.add(clave);
        cola.push([p2, q2, w + a]);
      }
    }
  }
  return { iguales: true, contraejemplo: null };
}
