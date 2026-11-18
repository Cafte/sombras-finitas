// Cuaderno: modelo del diagrama dibujado por el estudiante (RF05, RF06).
// Convierte el dibujo en un Automata y solicita la validación al motor formal.
import { Automata } from '../motor/automata.js';
import { equivalentes } from '../motor/equivalencia.js';
import { numEstadosMinimo } from '../motor/minimizador.js';

export class Cuaderno {
  constructor(alfabeto) {
    this.alfabeto = [...alfabeto];
    this.estados = [];       // { id, etiqueta, x, y, inicial, aceptacion }
    this.transiciones = [];  // { origen, destino, simbolo }  (ids de estado)
    this._sig = 1;
  }

  _etiquetaLibre() {
    const usadas = new Set(this.estados.map(e => e.etiqueta));
    let n = 0;
    while (usadas.has('q' + n)) n++;
    return 'q' + n;
  }

  estado(id) { return this.estados.find(e => e.id === id) ?? null; }

  agregarEstado(x, y) {
    const e = { id: this._sig++, etiqueta: this._etiquetaLibre(), x, y, inicial: false, aceptacion: false };
    this.estados.push(e);
    return e;
  }

  moverEstado(id, x, y) {
    const e = this.estado(id);
    if (e) { e.x = x; e.y = y; }
  }

  eliminarEstado(id) {
    this.estados = this.estados.filter(e => e.id !== id);
    this.transiciones = this.transiciones.filter(t => t.origen !== id && t.destino !== id);
  }

  alternarAceptacion(id) {
    const e = this.estado(id);
    if (e) e.aceptacion = !e.aceptacion;
    return e;
  }

  marcarInicial(id) {
    this.estados.forEach(e => { e.inicial = e.id === id; });
  }

  // Determinismo: una sola transición por (origen, símbolo); poner otra reemplaza la anterior.
  ponerTransicion(origen, simbolo, destino) {
    if (!this.alfabeto.includes(simbolo) || !this.estado(origen) || !this.estado(destino)) return false;
    this.transiciones = this.transiciones.filter(t => !(t.origen === origen && t.simbolo === simbolo));
    this.transiciones.push({ origen, destino, simbolo });
    return true;
  }

  quitarTransicion(origen, simbolo) {
    this.transiciones = this.transiciones.filter(t => !(t.origen === origen && t.simbolo === simbolo));
  }

  destinoDe(origen, simbolo) {
    return this.transiciones.find(t => t.origen === origen && t.simbolo === simbolo)?.destino ?? null;
  }

  // Aristas agrupadas por (origen, destino) con sus símbolos, para dibujar.
  aristas() {
    const mapa = new Map();
    for (const t of this.transiciones) {
      const k = t.origen + '>' + t.destino;
      if (!mapa.has(k)) mapa.set(k, { origen: t.origen, destino: t.destino, simbolos: [] });
      mapa.get(k).simbolos.push(t.simbolo);
    }
    for (const a of mapa.values()) a.simbolos.sort((p, q) => this.alfabeto.indexOf(p) - this.alfabeto.indexOf(q));
    return [...mapa.values()];
  }

  inicial() { return this.estados.find(e => e.inicial) ?? null; }

  aAutomata() {
    const nombre = id => this.estado(id).etiqueta;
    const delta = {};
    for (const e of this.estados) delta[e.etiqueta] = {};
    for (const t of this.transiciones) delta[nombre(t.origen)][t.simbolo] = nombre(t.destino);
    const ini = this.inicial();
    return new Automata(
      this.estados.map(e => e.etiqueta), this.alfabeto, delta,
      ini ? ini.etiqueta : null,
      this.estados.filter(e => e.aceptacion).map(e => e.etiqueta)
    );
  }

  // Validación (CU04). Flujo alterno 2a: diagrama incompleto => no se ejecuta la verificación.
  validar(objetivo, { exigirMinimo = false } = {}) {
    if (this.estados.length === 0) {
      return { estado: 'incompleto', motivos: ['El cuaderno está vacío: crea al menos un estado.'] };
    }
    const motivos = [];
    if (!this.inicial()) motivos.push('Falta marcar el estado inicial.');
    const A = this.aAutomata();
    const falt = A.faltantes();
    if (falt.length) {
      const lista = falt.slice(0, 4).map(([q, a]) => `δ(${q}, ${a})`).join(', ');
      motivos.push(`Faltan transiciones: ${lista}${falt.length > 4 ? ` y ${falt.length - 4} más` : ''}. En un AFD cada estado necesita una transición por cada símbolo.`);
    }
    if (motivos.length) return { estado: 'incompleto', motivos };

    const r = equivalentes(A, objetivo);
    if (!r.iguales) {
      return {
        estado: 'no-equivalente',
        contraejemplo: r.contraejemplo,
        dibujoAcepta: r.aceptaA,
        objetivoAcepta: r.aceptaB
      };
    }
    if (exigirMinimo) {
      const minimo = numEstadosMinimo(objetivo);
      if (this.estados.length > minimo) {
        return { estado: 'no-minimo', tusEstados: this.estados.length, minimo };
      }
    }
    return { estado: 'equivalente' };
  }

  serializar() {
    return {
      alfabeto: this.alfabeto,
      estados: this.estados.map(e => ({ ...e })),
      transiciones: this.transiciones.map(t => ({ ...t }))
    };
  }

  static desde(datos, alfabeto) {
    const c = new Cuaderno(alfabeto);
    if (!datos) return c;
    c.estados = datos.estados.map(e => ({ ...e }));
    c.transiciones = datos.transiciones.filter(t => alfabeto.includes(t.simbolo)).map(t => ({ ...t }));
    c._sig = c.estados.reduce((m, e) => Math.max(m, e.id), 0) + 1;
    return c;
  }
}
