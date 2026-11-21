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
    this.ayudas = datos.ayudas ?? {};
    this.prediccion = !!this.ayudas.prediccion;   // muestra lo que predice el diagrama del estudiante
    this.costoSenal = !!this.ayudas.costoSenal;   // cada señal es un turno de los guardias
    this.campana = datos.campana ?? null;        // { cada: turnos, senal: símbolo }: el sueño dura poco
    this.reloj = datos.reloj ?? null;            // { inactividad: segundos }: la ronda avanza sola si te quedas quieto
    this.camino = !!datos.camino;                 // las señales las emite el camino (casillas con letra)
    this.bonus = !!datos.bonus;
    this.pistas = datos.pistas ?? [];             // pistas progresivas (de suave a casi la solución)
    this.patrullas = datos.patrullas ?? {}; // { simboloEnMapa: [[x, y], ...] } puntos de paso de la ruta (opcional)
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

  // Cadena más corta que deja dormidos a todos los guardias a la vez (null si ninguna lo logra).
  mejorCadena() {
    const as = Object.values(this.mapaGuardias).map(id => this.automatas[id]);
    const ini = as.map(a => a.q0);
    const todos = es => es.every((q, i) => as[i].F.has(q));
    const cola = [[ini, '']], vistos = new Set([ini.join('|')]);
    while (cola.length) {
      const [es, w] = cola.shift();
      if (todos(es)) return w;
      for (const a of this.alfabeto) {
        const n = es.map((q, i) => as[i].paso(q, a));
        const k = n.join('|');
        if (!vistos.has(k)) { vistos.add(k); cola.push([n, w + a]); }
      }
    }
    return null;
  }

  get automataObjetivo() { return this.automatas[this.objetivoId]; }
  get estadosMinimos() { return numEstadosMinimo(this.automataObjetivo); }

  // Expande los puntos de paso (alineados en ejes) a la lista de casillas de la ruta, empezando en (x, y).
  _ruta(simbolo, x, y) {
    const pts = this.patrullas[simbolo];
    if (!pts?.length) return null;
    const ruta = [{ x, y }];
    for (const [px, py] of pts) {
      let { x: cx, y: cy } = ruta[ruta.length - 1];
      if (cx !== px && cy !== py) throw new Error(`Ruta del guardia ${simbolo}: tramo no alineado`);
      while (cx !== px || cy !== py) {
        cx += Math.sign(px - cx); cy += Math.sign(py - cy);
        if (this.celdas[cy]?.[cx] === undefined || this.celdas[cy][cx] === '#') throw new Error(`Ruta del guardia ${simbolo}: casilla bloqueada (${cx}, ${cy})`);
        ruta.push({ x: cx, y: cy });
      }
    }
    return ruta;
  }

  crearGuardias() {
    const gs = [];
    for (let y = 0; y < this.alto; y++) for (let x = 0; x < this.ancho; x++) {
      const c = this.filas[y][x];
      if (c in this.mapaGuardias) gs.push(new Guardia(c, this.automatas[this.mapaGuardias[c]], x, y, this._ruta(c, x, y)));
    }
    return gs;
  }
}

export const NOMBRES_RETO = {
  deduccion: 'Deducción',
  camino: 'Bonus · el camino es la cadena',
  minimizacion: 'Minimización',
  equivalencia: 'Equivalencia'
};
