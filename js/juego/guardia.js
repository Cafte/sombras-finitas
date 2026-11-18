// Guardia: mantiene un AFD y su estado actual (RF03, RF04).
// Conducta observable: estado de aceptación => "dormido" (radio 0);
// cualquier otro estado => "despierto" (radio de ruido 2). El estado concreto es oculto.

export const RADIO_DESPIERTO = 2;
export const RADIO_DORMIDO = 0;

export class Guardia {
  constructor(id, automata, x, y) {
    this.id = id;
    this.automata = automata;
    this.x = x;
    this.y = y;
    this.reiniciar();
  }

  reiniciar() {
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
