// Pantalla de juego: mapa, controles táctiles/teclado, señales, bitácora, pausa, victoria y derrota.
import { $, $$, h, vaciar } from './dom.js';
import { VistaMapa } from './vistaMapa.js';
import { sonido } from './sonido.js';
import { Partida } from '../juego/mapa.js';
import { RADIO_DESPIERTO } from '../juego/guardia.js';
import { predecir } from '../juego/prediccion.js';

const TECLAS = { ArrowUp: 'arriba', ArrowDown: 'abajo', ArrowLeft: 'izquierda', ArrowRight: 'derecha' };

export class JuegoUI {
  constructor(ctx) {
    this.ctx = ctx;
    this.vista = new VistaMapa($('#lienzo-mapa'));
    this.partida = null;
    this.avisoTimer = 0;
    this.vistaBit = 'cron';   // cron | conducta
    this.previas = [];        // tandas anteriores al último reinicio de guardias
    this._cache = null;       // filas de la bitácora en el último render
    this.selBit = null;       // fila elegida { cadena, dorm }
    this.pruebas = new Map(); // cadena -> { pred, real, ok }: lo que predijo el diagrama del estudiante vs la realidad
    this.ultimaAccion = performance.now();   // para el reloj de inactividad (la ronda avanza sola si te quedas quieto)
    this.avisoReloj = false;
    setInterval(() => this.relojTic(), 1000);
    $$('.obs-vista').forEach(b => b.addEventListener('click', () => { this.vistaBit = b.dataset.vista; this.renderBitacora(); }));

    $$('[data-mov]').forEach(b => b.addEventListener('click', () => this.mover(b.dataset.mov)));
    $('#btn-pausa').addEventListener('click', () => this.pausa());
    $('#btn-ir-cuaderno').addEventListener('click', () => this.ctx.abrirCuaderno());
    $('#btn-reiniciar-guardias').addEventListener('click', () => this.reiniciarGuardias());
    $('#lienzo-mapa').addEventListener('pointerdown', e => this.tocarMapa(e));
    document.addEventListener('keydown', e => this.tecla(e));
    globalThis.addEventListener('resize', () => { if (this.activo) this.vista.ajustar(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.activo && this.partida?.estado === 'jugando') this.vista.detener(); else if (this.activo) this.vista.iniciar(); });
  }

  get activo() { return $('#pantalla-juego').classList.contains('activa'); }

  iniciar(nivel, { salidaAbierta }) {
    this.nivel = nivel;
    this.partida = new Partida(nivel);
    this.previas = []; this._cache = null; this.selBit = null; this.pruebas.clear();
    this.ultimaAccion = performance.now(); this.avisoReloj = false;
    this.partida.salidaAbierta = salidaAbierta;
    $('#juego-titulo').textContent = `Nivel ${nivel.numero} · ${nivel.nombre}`;
    const sg = vaciar($('#juego-sigma'));
    sg.append(h('span', { class: 'mono', texto: 'Σ' }), ...nivel.alfabeto.map(a => h('span', { texto: a })));
    const fila = vaciar($('#juego-senales'));
    if (nivel.camino) fila.append(h('p', { class: 'camino-nota', texto: 'Sin botones: tu camino es la cadena. Pisa las casillas con letra para emitir esa señal.' }));
    else nivel.alfabeto.forEach((a, i) => fila.append(h('button', {
      type: 'button', class: 'btn-senal s' + (i % 3), 'aria-label': `Emitir señal ${a}`, onclick: () => this.senal(a, i)
    }, a, h('small', { texto: 'señal' }))));
    this.activar();
  }

  // Se llama al (re)entrar a la pantalla de juego
  activar() {
    this.vista.asignar(this.partida);
    this.vista.iniciar();
    this.ultimaAccion = performance.now();
    this.renderBitacora();
    this.renderPredicciones();
    this.avisar('');
  }

  /* ---------- Campana y reloj (el sueño dura poco) ---------- */
  // La campana envía su señal a todos los guardias cada cierto número de turnos.
  campanazo(letra) {
    sonido.despertar();
    this.avisar(`¡Suena la campana! Señal «${letra}» para todos los guardias`);
    this.renderBitacora(true);
  }

  renderCampana() {
    const el = $('#campana');
    const p = this.partida, c = this.nivel?.campana;
    if (!p || !c) { el.hidden = true; return; }
    const partes = [`Campana en ${p.campanaRestante} · «${c.senal}»`];
    if (this.nivel.prediccion) {
      const pr = this.predecir(c.senal);
      if (pr) partes.push(`tu diagrama: ${pr === 'dormido' ? 'dormidos' : 'despiertos'}`);
    }
    if (this.nivel.reloj && !this._enGracia()) {
      const resta = Math.max(0, Math.ceil(this.nivel.reloj.inactividad - (performance.now() - this.ultimaAccion) / 1000));
      partes.push(`ronda en ${resta}s`);
    }
    el.textContent = partes.join(' · ');
    el.classList.toggle('pronto', p.campanaRestante <= 1);
    el.hidden = false;
  }

  _enGracia() { return !this.partida || (this.partida.pasos === 0 && this.partida.senalesJugador === 0); }

  // Cada segundo: si el jugador se queda quieto, la ronda avanza sola (patrulla y campana). El reloj espera a la primera acción.
  relojTic() {
    const p = this.partida, r = this.nivel?.reloj;
    if (!p || !r || !this.activo || document.hidden || p.estado !== 'jugando' || this.ctx.modalAbierto()) return;
    if (this._enGracia()) { this.ultimaAccion = performance.now(); return; }
    if (performance.now() - this.ultimaAccion >= r.inactividad * 1000) {
      this.ultimaAccion = performance.now();
      if (!this.avisoReloj) { this.avisoReloj = true; this.avisar('El tiempo no se detiene: si te quedas quieto, la ronda avanza sola.'); }
      const res = p.turno();
      if (!res.ok) return;
      if (res.campanazo) this.campanazo(res.campanazo);
      this.renderBitacora(res.campanazo != null);
      this.renderPredicciones();
      this.resolver(res.resultado);
    }
    this.renderCampana();
  }

  /* ---------- Predicción del diagrama (nivel 3) ---------- */
  _autoEstudiante() {
    try { return this.ctx.cuaderno ? this.ctx.cuaderno.aAutomata() : null; } catch { return null; }
  }
  predecir(a) { return predecir(this._autoEstudiante(), this.partida.senales, a); }
  _guardiaObjetivo() { return this.partida.guardias.find(g => g.automata === this.nivel.automataObjetivo) ?? this.partida.guardias[0]; }

  renderPredicciones() {
    const ayuda = $('#pred-ayuda');
    const botones = $$('#juego-senales .btn-senal');
    if (!this.nivel.prediccion) { ayuda.hidden = true; return; }
    let alguna = false;
    botones.forEach((b, i) => {
      const pr = this.predecir(this.nivel.alfabeto[i]);
      const peq = b.querySelector('small');
      b.classList.toggle('pred-d', pr === 'dormido'); b.classList.toggle('pred-v', pr === 'despierto');
      peq.textContent = pr ? (pr === 'dormido' ? '→ dorm.' : '→ desp.') : 'señal';
      b.title = pr ? `Tu diagrama predice: ${pr}` : '';
      alguna = alguna || !!pr;
    });
    ayuda.hidden = false;
    ayuda.textContent = alguna
      ? 'Cada botón muestra lo que predice TU diagrama. Si la realidad no coincide, hay un error en tu cuaderno.'
      : 'Completa tu diagrama en el cuaderno: entonces cada botón mostrará qué predice tu autómata.';
  }

  salir() { this.vista.detener(); }

  avisar(msg) {
    const a = $('#mapa-aviso');
    clearTimeout(this.avisoTimer);
    if (!msg) { a.hidden = true; return; }
    a.textContent = msg; a.hidden = false;
    this.ctx.anunciar(msg);
    this.avisoTimer = setTimeout(() => { a.hidden = true; }, 2200);
  }

  /* ---------- Acciones ---------- */
  mover(dir) {
    const p = this.partida;
    if (!p || p.estado !== 'jugando' || this.ctx.modalAbierto()) return;
    const de = { ...p.jugador };
    const antes = p.guardias.map(g => g.dormido);
    const r = p.mover(dir);
    if (!r.ok) {
      sonido.choque();
      if (r.motivo === 'salida-sellada') this.avisar('Salida sellada: valida tu diagrama en el cuaderno.');
      return;
    }
    this.vista.moverAnim(de, { ...p.jugador });
    sonido.paso();
    if (r.emitio) {   // nivel «el camino es la cadena»: la casilla pisada emitió una señal
      sonido.senal(this.nivel.alfabeto.indexOf(r.emitio));
      const despues = p.guardias.map(g => g.dormido);
      if (despues.some((d, k) => d && !antes[k])) setTimeout(() => sonido.dormir(), 120);
      else if (despues.some((d, k) => !d && antes[k])) setTimeout(() => sonido.despertar(), 120);
      this.avisar(`Casilla «${r.emitio}»: señal emitida`);
      this.renderBitacora(true);
    }
    if (r.campanazo) this.campanazo(r.campanazo);
    this.ultimaAccion = performance.now();
    this.renderCampana();
    this.resolver(r.resultado);
  }

  senal(a, i = 0) {
    const p = this.partida;
    if (!p || p.estado !== 'jugando' || this.ctx.modalAbierto()) return;
    if (this.nivel.camino) return;   // en el nivel bonus las señales las emite el camino
    const pred = this.nivel.prediccion ? this.predecir(a) : null;
    const antes = p.guardias.map(g => g.dormido);
    const r = p.senal(a);
    if (!r.ok) return;
    if (pred) {
      const real = this._guardiaObjetivo().dormido ? 'dormido' : 'despierto';
      this.pruebas.set(p.senales, { pred, real, ok: pred === real });
      if (pred !== real) this.avisar(`Tu diagrama predijo «${pred}» pero el guardia quedó «${real}». Revisa el cuaderno.`);
    }
    sonido.senal(i);
    const despues = p.guardias.map(g => g.dormido);
    if (despues.some((d, k) => d && !antes[k])) setTimeout(() => sonido.dormir(), 120);
    else if (despues.some((d, k) => !d && antes[k])) setTimeout(() => sonido.despertar(), 120);
    if (r.campanazo) this.campanazo(r.campanazo);
    this.ultimaAccion = performance.now();
    this.renderBitacora(true);
    this.renderPredicciones();
    this.resolver(r.resultado);
  }

  reiniciarGuardias() {
    const p = this.partida;
    if (!p || p.estado !== 'jugando' || this.ctx.modalAbierto()) return;
    const r = p.reiniciarGuardias();
    sonido.reinicio();
    this.avisar('Guardias reiniciados a q₀');
    this.renderBitacora();
    this.renderPredicciones();
    this.resolver(r.resultado);
  }

  resolver(res) {
    if (res === 'ganado') this.ctx.alGanar(this.partida);
    else if (res === 'descubierto') this.ctx.alDescubrir(this.partida);
  }

  tocarMapa(ev) {
    const p = this.partida;
    if (!p || p.estado !== 'jugando') return;
    const c = this.vista.celdaDesdeEvento(ev);
    const dx = c.x - p.jugador.x, dy = c.y - p.jugador.y;
    if (!dx && !dy) return;
    this.mover(Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'derecha' : 'izquierda') : (dy > 0 ? 'abajo' : 'arriba'));
  }

  tecla(ev) {
    if (!this.activo || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (ev.target.matches?.('input, textarea, select')) return;
    if (ev.key === 'Escape') { if (!this.ctx.modalAbierto()) this.pausa(); return; }
    if (this.ctx.modalAbierto()) return;
    const dir = TECLAS[ev.key];
    if (dir) { ev.preventDefault(); this.mover(dir); return; }
    const k = ev.key.toLowerCase();
    const idx = this.nivel?.alfabeto.indexOf(k);
    if (idx >= 0) { this.senal(k, idx); return; }
    if (k === 'r') this.reiniciarGuardias();
    else if (k === 'n') this.ctx.abrirCuaderno();
  }

  pausa() {
    if (!this.partida || this.partida.estado !== 'jugando') return;
    this.ctx.modal({
      titulo: 'Pausa',
      cuerpo: [`Nivel ${this.nivel.numero} · ${this.nivel.nombre}`, h('br'), this.nivel.historia],
      acciones: [
        { texto: 'Continuar', primario: true },
        { texto: 'Abrir cuaderno', onclick: () => this.ctx.abrirCuaderno() },
        { texto: 'Reiniciar nivel', onclick: () => { this.partida.reaparecer(); this.renderBitacora(); this.vista.anim = null; sonido.reinicio(); } },
        { texto: sonido.activo ? 'Silenciar sonido' : 'Activar sonido', onclick: () => { sonido.alternar(); this.ctx.actualizarSonido(); } },
        { texto: 'Salir al menú', onclick: () => this.ctx.ir('inicio') }
      ]
    });
  }

  /* ---------- Bitácora ---------- */
  _filas() {
    const gs = this.partida.guardias;
    const filas = [{ cadena: '', dorm: gs.map(g => g.automata.F.has(g.automata.q0)) }];
    gs[0].historial.forEach((x, i) => filas.push({ cadena: x.cadena, dorm: gs.map(g => g.historial[i].dormido) }));
    return filas;
  }

  _elegir(cadena, dorm) {
    const igual = this.selBit && this.selBit.cadena === cadena;
    this.selBit = igual ? null : { cadena, dorm };
    this.renderBitacora();
  }

  renderBitacora(nuevo = false) {
    const p = this.partida;
    const gs = p.guardias, alf = this.nivel.alfabeto;
    const filas = this._filas();

    // Si los guardias se reiniciaron, la tanda anterior se conserva (atenuada) en vez de perderse.
    const c = this._cache;
    if (c && c.length > 1 && (filas.length < c.length || c.some((f, k) => k < filas.length && f.cadena !== filas[k].cadena))) {
      this.previas = [c, ...this.previas].slice(0, 2);
      this.selBit = null; this.pruebas.clear();
    }
    this._cache = filas;

    // Cinta de señales: la última resaltada
    const tr = vaciar($('#obs-traza'));
    if (!p.senales) tr.append(h('span', { class: 'tr-vacio', texto: 'ε · sin señales (guardias en q₀)' }));
    else [...p.senales].forEach((a, i, arr) => tr.append(h('span', { class: `tr-chip s${alf.indexOf(a) % 3}${i === arr.length - 1 ? ' ultimo' : ''}`, texto: a })));
    tr.scrollLeft = tr.scrollWidth;

    $$('.obs-vista').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.vista === this.vistaBit)));
    const caja = $('.obs-tabla-caja');
    const scroll = caja.scrollTop;
    const tabla = $('#obs-tabla'), cond = $('#obs-conducta');
    tabla.hidden = this.vistaBit !== 'cron';
    cond.hidden = this.vistaBit !== 'conducta';
    if (this.vistaBit === 'cron') this._renderCronologia(filas, nuevo);
    else this._renderConducta(filas);
    caja.scrollTop = nuevo ? 0 : scroll;
    this._renderDetalle();
    this.renderCampana();
  }

  _cadenaCorta(w) { return w === '' ? 'ε' : (w.length > 9 ? '…' + w.slice(-8) : w); }

  _renderCronologia(filas, nuevo) {
    const gs = this.partida.guardias, alf = this.nivel.alfabeto;
    const t = vaciar($('#obs-tabla'));
    const compacta = gs.length > 2;   // con 3 guardias las etiquetas se abrevian para que quepan en el celular
    t.classList.toggle('compacta', compacta);
    const conducta = d => h('span', { class: 'est ' + (d ? 'dormido' : 'despierto') }, h('i'), compacta ? (d ? 'dorm.' : 'desp.') : (d ? 'dormido' : 'despierto'));
    t.append(h('thead', {}, h('tr', {}, h('th', { texto: 'Señal' }), h('th', { texto: 'Cadena' }), ...gs.map(g => h('th', { title: `Guardia ${g.id}`, texto: compacta ? g.id : `Guardia ${g.id}` })))));
    const cuerpo = h('tbody');
    const fila = (f, i, lista, extra = '') => {
      const ult = f.cadena.slice(-1), antes = f.cadena.slice(0, -1);
      const sel = this.selBit?.cadena === f.cadena && !extra;
      const tr = h('tr', {
        class: `fila ${extra}${sel ? ' sel' : ''}${nuevo && !extra && i === lista.length - 1 ? ' nueva' : ''}`,
        tabindex: '0', role: 'button', 'aria-pressed': String(sel),
        'aria-label': `Cadena ${f.cadena || 'ε'}: ${f.dorm.map((d, k) => `guardia ${gs[k].id} ${d ? 'dormido' : 'despierto'}`).join(', ')}`,
        onclick: () => this._elegir(f.cadena, f.dorm),
        onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._elegir(f.cadena, f.dorm); } }
      },
      h('td', {}, f.cadena === '' ? h('span', { class: 'tr-vacio', texto: 'inicio' }) : h('span', { class: `tr-chip s${alf.indexOf(ult) % 3} ultimo${!extra && this.partida.marcasCampana.has(f.cadena.length) ? ' de-campana' : ''}`, texto: ult }),
        !extra && f.cadena !== '' && this.partida.marcasCampana.has(f.cadena.length) && h('small', { class: 'tag-campana', texto: 'campana' })),
      h('td', { class: 'cad' }, f.cadena === '' ? 'ε' : h('span', {}, h('span', { class: 'cad-ant', texto: antes.length > 8 ? '…' + antes.slice(-8) : antes }), h('b', { texto: ult })),
        !extra && this.pruebas.get(f.cadena) && h('span', { class: 'pred-mark ' + (this.pruebas.get(f.cadena).ok ? 'ok' : 'mal'), title: `Tu diagrama predijo «${this.pruebas.get(f.cadena).pred}»; realidad: «${this.pruebas.get(f.cadena).real}»`, texto: this.pruebas.get(f.cadena).ok ? '✓' : '⚠' })),
      ...f.dorm.map((d, k) => {
        const cambio = i > 0 && lista[i - 1].dorm[k] !== d;
        return h('td', { class: cambio && nuevo && !extra && i === lista.length - 1 ? 'pulso' : '' }, conducta(d),
          cambio && h('b', { class: 'delta ' + (d ? 'dur' : 'des'), 'aria-hidden': 'true', title: d ? 'se durmió' : 'se despertó', texto: d ? '▼' : '▲' }));
      }));
      return tr;
    };
    [...filas.keys()].reverse().slice(0, 40).forEach(i => cuerpo.append(fila(filas[i], i, filas)));
    this.previas.forEach(prev => {
      cuerpo.append(h('tr', { class: 'sep' }, h('td', { colspan: String(gs.length + 2), texto: 'Antes del reinicio' })));
      [...prev.keys()].reverse().slice(0, 10).forEach(i => cuerpo.append(fila(prev[i], i, prev, 'previa')));
    });
    t.append(cuerpo);
    if (filas.length === 1 && !this.previas.length) cuerpo.prepend(h('tr', {}, h('td', { class: 'vacio', colspan: String(gs.length + 2), texto: this.nivel.camino ? 'Pisa casillas con letra y observa cómo reacciona el guardia.' : `Envía una señal (${alf.join(', ')}) y observa cómo reaccionan.` })));
  }

  // Vista por conducta: qué cadenas duermen o despiertan a cada guardia (las más cortas primero).
  _renderConducta(filas) {
    const gs = this.partida.guardias;
    const cont = vaciar($('#obs-conducta'));
    const todas = [...filas, ...this.previas.flat()];
    const unicas = new Map();
    todas.forEach(f => { if (!unicas.has(f.cadena)) unicas.set(f.cadena, f); });
    const lista = [...unicas.values()].sort((a, b) => a.cadena.length - b.cadena.length);
    if (lista.length === 1 && lista[0].cadena === '' && !this.previas.length && filas.length === 1) {
      cont.append(h('p', { class: 'vacio', texto: 'Aún no hay observaciones. Emite señales para llenar esta vista.' }));
    }
    gs.forEach((g, k) => {
      const chips = dorm => {
        const sel = lista.filter(f => f.dorm[k] === dorm);
        const caja = h('div', { class: 'cond-chips' }, ...sel.slice(0, 16).map(f => h('button', {
          type: 'button', class: 'cad-chip' + (this.selBit?.cadena === f.cadena ? ' sel' : ''), texto: f.cadena === '' ? 'ε' : this._cadenaCorta(f.cadena),
          'aria-label': `Cadena ${f.cadena || 'ε'}`, onclick: () => this._elegir(f.cadena, f.dorm)
        })));
        if (sel.length > 16) caja.append(h('span', { class: 'tr-vacio', texto: `+${sel.length - 16} más` }));
        if (!sel.length) caja.append(h('span', { class: 'tr-vacio', texto: 'ninguna todavía' }));
        return caja;
      };
      cont.append(h('div', { class: 'cond-g' }, h('b', { texto: `Guardia ${g.id}` }),
        h('div', { class: 'cond-fila' }, h('span', { class: 'est dormido' }, h('i'), 'Dormido (acepta)'), chips(true)),
        h('div', { class: 'cond-fila' }, h('span', { class: 'est despierto' }, h('i'), 'Despierto (rechaza)'), chips(false))));
    });
  }

  _renderDetalle() {
    const d = $('#obs-detalle');
    if (!this.selBit) { d.hidden = true; return; }
    const { cadena, dorm } = this.selBit;
    const gs = this.partida.guardias;
    vaciar(d);
    d.append(h('span', { class: 'det-txt' }, h('b', { class: 'mono', texto: `«${cadena || 'ε'}»` }), ' → ',
      gs.map((g, k) => `${g.id}: ${dorm[k] ? 'dormido' : 'despierto'}`).join(' · '),
      h('small', { texto: ' (dormido = estado de aceptación)' }),
      this.pruebas.get(cadena) && h('small', { class: this.pruebas.get(cadena).ok ? 'pred-ok' : 'pred-mal', texto: this.pruebas.get(cadena).ok ? ' Tu diagrama lo predijo bien.' : ` Tu diagrama predijo «${this.pruebas.get(cadena).pred}»: no coincide.` })),
    h('button', { type: 'button', class: 'btn btn-peq', texto: 'Probar en mi cuaderno', onclick: () => this.ctx.probarEnCuaderno(cadena) }),
    h('button', { type: 'button', class: 'btn-icono det-x', 'aria-label': 'Cerrar detalle', texto: '✕', onclick: () => { this.selBit = null; this.renderBitacora(); } }));
    d.hidden = false;
  }
}

export { RADIO_DESPIERTO };
