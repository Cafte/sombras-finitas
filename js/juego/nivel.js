// Nivel: alfabeto, tipo de reto, AFD ocultos, mapa y guardias (RF07).
import { Automata } from '../motor/automata.js';
import { numEstadosMinimo } from '../motor/minimizador.js';
import { Guardia } from './guardia.js';

export class Nivel {
  constructor(datos) {
    this.numero = datos.numero;
    this.nombre = datos.nombre;
    this.tipo = datos.tipo_reto;
    this.alfabeto = datos.alfabeto;
    this.historia = datos.historia;
    this.concepto = datos.concepto;
    this.objetivoId = datos.objetivo;
    this.pares = datos.pares ?? [];
    this.filas = datos.mapa;
    this.alto = this.filas.length;
    this.ancho = this.filas[0].length;
    this.automatas = {};
    for (const [id, o] of Object.entries(datos.automatas)) {
      this.automatas[id] = Automata.desdeJSON({ ...o, alfabeto: this.alfabeto });
    }
    this.mapaGuardias = datos.guardias; // { simboloEnMapa: idAutomata }
    this.inicioJugador = null;
    this.salida = null;
    this.celdas = [];
    for (let y = 0; y < this.alto; y++) {
      const fila = [];
      for (let x = 0; x < this.ancho; x++) {
        let c = this.filas[y][x];
        if (c === 'P') { this.inicioJugador = { x, y }; c = '.'; }
        else if (c === 'E') { this.salida = { x, y }; }
        else if (c in this.mapaGuardias) { c = '.'; }
        fila.push(c);
      }
      this.celdas.push(fila);
    }
  }

  get automataObjetivo() { return this.automatas[this.objetivoId]; }
  get estadosMinimos() { return numEstadosMinimo(this.automataObjetivo); }

  crearGuardias() {
    const gs = [];
    for (let y = 0; y < this.alto; y++) for (let x = 0; x < this.ancho; x++) {
      const c = this.filas[y][x];
      if (c in this.mapaGuardias) gs.push(new Guardia(c, this.automatas[this.mapaGuardias[c]], x, y));
    }
    return gs;
  }
}

export const NOMBRES_RETO = {
  deduccion: 'Deducción',
  minimizacion: 'Minimización',
  equivalencia: 'Equivalencia'
};
