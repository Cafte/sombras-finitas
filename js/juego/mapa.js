// Mapa por casillas, movimiento, radio de ruido y reglas de victoria/derrota (RF04).

export const DIRS = {
  arriba: [0, -1], abajo: [0, 1], izquierda: [-1, 0], derecha: [1, 0]
};

export class Partida {
  constructor(nivel) {
    this.nivel = nivel;
    this.salidaAbierta = false;
    this.reiniciarTodo();
  }

  reiniciarTodo() {
    this.jugador = { ...this.nivel.inicioJugador };
    this.guardias = this.nivel.crearGuardias();
    this.estado = 'jugando'; // jugando | descubierto | ganado
    this.senales = '';        // cadena emitida en total desde el último reinicio de guardias
    this.pasos = 0;
    this.causa = null;
  }

  // Tras ser descubierto, el jugador vuelve al inicio y los guardias a q0.
  reaparecer() {
    this.jugador = { ...this.nivel.inicioJugador };
    this.guardias.forEach(g => g.reiniciar());
    this.senales = '';
    this.estado = 'jugando';
    this.causa = null;
  }

  celda(x, y) {
    return this.nivel.celdas[y]?.[x] ?? '#';
  }

  hayGuardia(x, y) { return this.guardias.some(g => g.x === x && g.y === y); }

  enSombra() { return this.celda(this.jugador.x, this.jugador.y) === 's'; }

  // Radio de ruido (distancia Manhattan); las sombras protegen.
  detectadoPor() {
    if (this.enSombra()) return null;
    for (const g of this.guardias) {
      if (g.radio === 0) continue;
      const d = Math.abs(g.x - this.jugador.x) + Math.abs(g.y - this.jugador.y);
      if (d <= g.radio) return g;
    }
    return null;
  }

  _evaluar() {
    const g = this.detectadoPor();
    if (g) { this.estado = 'descubierto'; this.causa = g.id; return 'descubierto'; }
    return null;
  }

  mover(dir) {
    if (this.estado !== 'jugando') return { ok: false, motivo: 'inactivo' };
    const [dx, dy] = DIRS[dir];
    const nx = this.jugador.x + dx, ny = this.jugador.y + dy;
    const c = this.celda(nx, ny);
    if (c === '#' || this.hayGuardia(nx, ny)) return { ok: false, motivo: 'bloqueado' };
    const sal = this.nivel.salida;
    if (sal && nx === sal.x && ny === sal.y && !this.salidaAbierta) {
      return { ok: false, motivo: 'salida-sellada' };
    }
    this.jugador = { x: nx, y: ny };
    this.pasos++;
    if (sal && nx === sal.x && ny === sal.y) {
      this.estado = 'ganado';
      return { ok: true, resultado: 'ganado' };
    }
    return { ok: true, resultado: this._evaluar() };
  }

  // Cada señal es un símbolo de Σ que todos los guardias procesan (δ).
  senal(a) {
    if (this.estado !== 'jugando') return { ok: false, motivo: 'inactivo' };
    if (!this.nivel.alfabeto.includes(a)) return { ok: false, motivo: 'simbolo' };
    this.guardias.forEach(g => g.paso(a));
    this.senales += a;
    return { ok: true, resultado: this._evaluar() };
  }

  reiniciarGuardias() {
    if (this.estado !== 'jugando') return { ok: false, motivo: 'inactivo' };
    this.guardias.forEach(g => g.reiniciar());
    this.senales = '';
    return { ok: true, resultado: this._evaluar() };
  }
}
