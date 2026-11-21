// Guardia: mantiene un AFD y su estado actual (RF03, RF04).
// Conducta observable: estado de aceptación => "dormido" (radio 0);
// cualquier otro estado => "despierto" (radio de ruido 2). El estado concreto es oculto.

export const RADIO_DESPIERTO = 2;
export const RADIO_DORMIDO = 0;

export class Guardia {
  // ruta (opcional): casillas consecutivas por las que patrulla (ida y vuelta) mientras está despierto.
  constructor(id, automata, x, y, ruta = null) {
    this.id = id;
    this.automata = automata;
    this.x0 = x; this.y0 = y;
    this.ruta = ruta && ruta.length > 1 ? ruta : null;
    this.reiniciar();
  }

  // Un paso de patrulla (por turnos). Un guardia dormido no se mueve; si la casilla siguiente
  // está ocupada (jugador u otro guardia), espera. Devuelve true si se movió.
  patrullar(ocupada = () => false) {
    if (!this.ruta || this.dormido) return false;
    let dir = this.dir, j = this.i + dir;
    if (j < 0 || j >= this.ruta.length) { dir = -dir; j = this.i + dir; }
    const c = this.ruta[j];
    if (ocupada(c.x, c.y)) return false;
    this.dir = dir; this.i = j; this.x = c.x; this.y = c.y;
    return true;
  }

  reiniciar() {
    this.x = this.x0; this.y = this.y0; this.i = 0; this.dir = 1;
    this.estado = this.automata.q0;
    this.traza = '';       // cadena de señales recibidas desde el último reinicio
    this.historial = [];   // [{ cadena, dormido }]
  }

  paso(a) {
    const sig = this.automata.paso(this.estado, a);
    if (sig === null) return;
    this.estado = sig;
    this.traza += a;
    this.historial.push({ cadena: this.traza, dormido: this.dormido });
  }

  get dormido() { return this.automata.F.has(this.estado); }
  get radio() { return this.dormido ? RADIO_DORMIDO : RADIO_DESPIERTO; }
  get conducta() { return this.dormido ? 'dormido' : 'despierto'; }
}
