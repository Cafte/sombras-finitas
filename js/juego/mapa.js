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
    this.senalesJugador = 0;  // cuántas de esas señales las emitió el jugador (el resto, la campana)
    this.marcasCampana = new Set();   // longitudes de la cadena en las que sonó la campana
    this.campanaRestante = this.nivel.campana?.cada ?? 0;
    this.pasos = 0;
    this.causa = null;
  }

  // Tras ser descubierto, el jugador vuelve al inicio y los guardias a q0.
  reaparecer() {
    this.jugador = { ...this.nivel.inicioJugador };
    this.guardias.forEach(g => g.reiniciar());
    this.pasos = 0;
    this.senales = '';
    this.senalesJugador = 0;
    this.marcasCampana.clear();
    this.campanaRestante = this.nivel.campana?.cada ?? 0;
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
    // Nivel «el camino es la cadena»: pisar una casilla con letra emite esa señal a todos los guardias.
    let emitio = null;
    const letra = this.celda(nx, ny);
    if (this.nivel.camino && this.nivel.alfabeto.includes(letra)) {
      this.guardias.forEach(g => g.paso(letra));
      this.senales += letra;
      this.senalesJugador++;
      emitio = letra;
    }
    const mundo = this._turnoMundo();
    return { ok: true, resultado: this._evaluar(), emitio, ...mundo };
  }

  // Un turno del mundo: los guardias despiertos patrullan y la campana (si el nivel la tiene) cuenta atrás;
  // al llegar a 0 suena y envía su señal a todos los guardias, como una entrada más del autómata.
  _turnoMundo() {
    const patrullaron = this._turnoGuardias();
    let campanazo = null;
    const c = this.nivel.campana;
    if (c) {
      this.campanaRestante--;
      if (this.campanaRestante <= 0) {
        this.guardias.forEach(g => g.paso(c.senal));
        this.senales += c.senal;
        this.marcasCampana.add(this.senales.length);
        this.campanaRestante = c.cada;
        campanazo = c.senal;
      }
    }
    return { patrullaron, campanazo };
  }

  // Un turno sin que el jugador actúe (reloj de inactividad): la ronda avanza sola.
  turno() {
    if (this.estado !== 'jugando') return { ok: false, motivo: 'inactivo' };
    const mundo = this._turnoMundo();
    return { ok: true, resultado: this._evaluar(), ...mundo };
  }

  // Turno de los guardias: los despiertos con ruta avanzan un paso (los dormidos se quedan quietos).
  _turnoGuardias() {
    const ocupada = (x, y) => (x === this.jugador.x && y === this.jugador.y) || this.hayGuardia(x, y);
    return this.guardias.filter(g => g.patrullar(ocupada)).length;
  }

  // Cada señal es un símbolo de Σ que todos los guardias procesan (δ).
  senal(a) {
    if (this.estado !== 'jugando') return { ok: false, motivo: 'inactivo' };
    if (!this.nivel.alfabeto.includes(a)) return { ok: false, motivo: 'simbolo' };
    this.guardias.forEach(g => g.paso(a));
    this.senales += a;
    this.senalesJugador++;
    // Niveles con «costo de señal»: emitir una señal también es un turno del mundo (patrulla y campana).
    const mundo = this.nivel.costoSenal ? this._turnoMundo() : { patrullaron: 0, campanazo: null };
    return { ok: true, resultado: this._evaluar(), ...mundo };
  }

  reiniciarGuardias() {
    if (this.estado !== 'jugando') return { ok: false, motivo: 'inactivo' };
    this.guardias.forEach(g => g.reiniciar());
    this.senales = '';
    this.senalesJugador = 0;
    this.marcasCampana.clear();
    return { ok: true, resultado: this._evaluar() };
  }
}
