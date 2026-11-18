// Pantalla de diagnósticos inicial y final (CU07, CU08).
import { $, h, vaciar } from './dom.js';
import { generarDiagnostico, puntuar, gananciaNormalizada } from '../juego/diagnostico.js';
import { sonido } from './sonido.js';

export class DiagnosticoUI {
  constructor(ctx) { this.ctx = ctx; this.cuerpo = $('#diag-cuerpo'); }

  async abrir() {
    this.diag = await this.ctx.almacen.diagnosticos();
    this.vistaResumen();
  }

  tabla(m, titulo) {
    const ts = m.sigma;
    return h('table', { class: 'mini-tabla' },
      h('caption', { texto: `${titulo} — inicial: ${m.q0} · aceptación: {${[...m.F].join(', ')}}` }),
      h('thead', {}, h('tr', {}, h('th', { texto: 'δ' }), ...ts.map(a => h('th', { texto: a })))),
      h('tbody', {}, ...[...m.Q].map(q => h('tr', {}, h('th', { texto: (q === m.q0 ? '→' : '') + (m.F.has(q) ? '*' : '') + q }), ...ts.map(a => h('td', { texto: m.paso(q, a) }))))));
  }

  vistaResumen() {
    const c = vaciar(this.cuerpo);
    const { inicial, final } = this.diag;
    c.append(h('div', { class: 'tarjeta' },
      h('h3', { texto: 'Mide lo que aprendes' }),
      h('p', { texto: 'Responde el diagnóstico INICIAL antes de jugar y el FINAL después. Ambos tienen seis preguntas equivalentes sobre AFD: lectura de tablas, aceptación de cadenas, estado trampa, equivalencia, minimización y estados alcanzables.' }),
      h('p', { texto: 'Tu participación es voluntaria. Los resultados se guardan solo en este dispositivo, asociados a un código anónimo (Ley 1581 de 2012).' })));

    const tarjeta = (tipo, nombre, fila) => h('div', { class: 'tarjeta' },
      h('h3', { texto: `Diagnóstico ${nombre}` }),
      h('p', { texto: fila ? `Puntaje registrado: ${fila.puntaje.toFixed(1)} / 100` : 'Aún no lo has respondido.' }),
      h('button', { type: 'button', class: 'btn ' + (fila ? '' : 'btn-primario'), texto: fila ? 'Repetir' : 'Comenzar', onclick: () => this.iniciar(tipo) }));
    c.append(tarjeta('inicial', 'inicial', inicial), tarjeta('final', 'final', final));

    if (inicial && final) {
      const g = gananciaNormalizada(inicial.puntaje, final.puntaje);
      const delta = final.puntaje - inicial.puntaje;
      c.append(h('div', { class: 'tarjeta' },
        h('h3', { texto: 'Tu cambio (resumen para el docente)' }),
        h('div', { class: 'cifras' },
          h('div', { class: 'cifra' }, h('b', { texto: inicial.puntaje.toFixed(0) }), h('span', { texto: 'Pre' })),
          h('div', { class: 'cifra' }, h('b', { texto: final.puntaje.toFixed(0) }), h('span', { texto: 'Pos' })),
          h('div', { class: 'cifra' }, h('b', { texto: g == null ? '—' : g.toFixed(2) }), h('span', { texto: 'Ganancia g' }))),
        h('p', { texto: `Diferencia: ${delta >= 0 ? '+' : ''}${delta.toFixed(1)} puntos. g = (Pos − Pre) / (100 − Pre) mide la fracción de la mejora posible que se logró. Código: ${this.ctx.almacen.perfil.codigo_anonimo}.` })));
    }
  }

  iniciar(tipo) {
    this.tipo = tipo;
    this.preguntas = generarDiagnostico(tipo);
    this.respuestas = [];
    this.i = 0;
    this.vistaPregunta();
  }

  vistaPregunta() {
    const p = this.preguntas[this.i];
    const c = vaciar(this.cuerpo);
    const sel = this.respuestas[this.i];
    c.append(
      h('div', { class: 'progreso', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(this.preguntas.length), 'aria-valuenow': String(this.i + 1) },
        h('div', { style: `width:${((this.i + 1) / this.preguntas.length) * 100}%` })),
      h('p', { class: 'meta', texto: `Pregunta ${this.i + 1} de ${this.preguntas.length} · diagnóstico ${this.tipo}` }),
      h('div', { class: 'tarjeta' },
        ...p.tablas.map((m, k) => this.tabla(m, p.tablas.length > 1 ? `Autómata ${k === 0 ? 'X' : 'Y'}` : 'Autómata')),
        h('p', { class: 'pregunta', style: 'color:var(--texto)', texto: p.enunciado }),
        h('div', { class: 'opciones', role: 'radiogroup' }, ...p.opciones.map((o, k) =>
          h('button', { type: 'button', class: 'opcion' + (sel === k ? ' sel' : ''), role: 'radio', 'aria-checked': String(sel === k), texto: o,
            onclick: () => { this.respuestas[this.i] = k; sonido.toque(); this.vistaPregunta(); } })))),
      h('div', { class: 'menu-fila' },
        h('button', { type: 'button', class: 'btn', texto: 'Anterior', disabled: this.i === 0, onclick: () => { this.i--; this.vistaPregunta(); } }),
        h('button', { type: 'button', class: 'btn btn-primario', disabled: sel === undefined,
          texto: this.i === this.preguntas.length - 1 ? 'Terminar' : 'Siguiente', onclick: () => this.avanzar() })));
  }

  async avanzar() {
    if (this.i < this.preguntas.length - 1) { this.i++; this.vistaPregunta(); return; }
    const puntaje = puntuar(this.preguntas, this.respuestas);
    await this.ctx.almacen.guardarDiagnostico(this.tipo, puntaje);
    this.diag = await this.ctx.almacen.diagnosticos();
    sonido.victoria();
    const c = vaciar(this.cuerpo);
    const bien = this.preguntas.filter((p, k) => this.respuestas[k] === p.correcta).length;
    c.append(h('div', { class: 'tarjeta' },
      h('h3', { texto: `Diagnóstico ${this.tipo} registrado` }),
      h('div', { class: 'cifras' },
        h('div', { class: 'cifra' }, h('b', { texto: String(bien) }), h('span', { texto: 'Aciertos' })),
        h('div', { class: 'cifra' }, h('b', { texto: `${this.preguntas.length - bien}` }), h('span', { texto: 'Errores' })),
        h('div', { class: 'cifra' }, h('b', { texto: puntaje.toFixed(0) }), h('span', { texto: 'Puntaje' })))),
      h('div', { class: 'tarjeta' }, h('h3', { texto: 'Revisión' }),
        ...this.preguntas.map((p, k) => h('p', { class: this.respuestas[k] === p.correcta ? 'ok' : 'mal',
          texto: `${k + 1}. ${this.respuestas[k] === p.correcta ? '✓' : '✗'} ${p.enunciado.split('?')[0].slice(0, 60)}… Correcta: ${p.opciones[p.correcta]}` }))),
      h('button', { type: 'button', class: 'btn btn-primario', texto: 'Continuar', onclick: () => this.vistaResumen() }));
  }
}
