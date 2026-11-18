// Motor formal — AFD  M = (Q, Σ, δ, q0, F)   (RF01, RF02, RNF03)
// Sin dependencias de la interfaz.

export class Automata {
  /**
   * @param {Iterable<string>} Q       estados
   * @param {Iterable<string>} sigma   alfabeto
   * @param {Object} delta             { q: { a: q' } }
   * @param {string} q0                estado inicial
   * @param {Iterable<string>} F       estados de aceptación
   */
  constructor(Q, sigma, delta, q0, F) {
    this.Q = new Set(Q);
    this.sigma = [...sigma];
    this.delta = delta;
    this.q0 = q0;
    this.F = new Set(F);
  }

  paso(q, a) { return this.delta[q]?.[a] ?? null; }

  // δ*(q, w); δ*(q, ε) = q. Devuelve null si δ no está definida en algún paso.
  extendida(q, w) {
    for (const a of w) {
      q = this.paso(q, a);
      if (q === null) return null;
    }
    return q;
  }

  acepta(w) {
    const q = this.extendida(this.q0, w);
    return q !== null && this.F.has(q);
  }

  // ¿δ está definida para todo par (q, a)?
  esCompleto() {
    return [...this.Q].every(q => this.sigma.every(a => this.paso(q, a) !== null));
  }

  // Pares (q, a) sin transición, para retroalimentación al estudiante.
  faltantes() {
    const f = [];
    for (const q of this.Q) for (const a of this.sigma) {
      if (this.paso(q, a) === null) f.push([q, a]);
    }
    return f;
  }

  // qt ∉ F y δ(qt, a) = qt para todo a
  esTrampa(q) {
    return !this.F.has(q) && this.sigma.every(a => this.paso(q, a) === q);
  }

  trampas() { return [...this.Q].filter(q => this.esTrampa(q)); }

  // Estados alcanzables desde q0
  alcanzables() {
    const vistos = new Set();
    if (!this.Q.has(this.q0)) return vistos;
    vistos.add(this.q0);
    const pila = [this.q0];
    while (pila.length) {
      const q = pila.pop();
      for (const a of this.sigma) {
        const r = this.paso(q, a);
        if (r !== null && !vistos.has(r)) { vistos.add(r); pila.push(r); }
      }
    }
    return vistos;
  }

  // Cadena más corta aceptada (o null si L(M) = ∅)
  cadenaMasCorta() {
    if (!this.Q.has(this.q0)) return null;
    const cola = [[this.q0, '']];
    const vistos = new Set([this.q0]);
    while (cola.length) {
      const [q, w] = cola.shift();
      if (this.F.has(q)) return w;
      for (const a of this.sigma) {
        const r = this.paso(q, a);
        if (r !== null && !vistos.has(r)) { vistos.add(r); cola.push([r, w + a]); }
      }
    }
    return null;
  }

  static desdeJSON(o) {
    return new Automata(o.estados, o.alfabeto, o.delta, o.inicial, o.aceptacion);
  }
}
