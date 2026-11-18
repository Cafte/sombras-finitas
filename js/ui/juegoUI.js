// Pantalla de juego: mapa, controles táctiles/teclado, señales, bitácora, pausa, victoria y derrota.
import { $, $$, h, vaciar } from './dom.js';
import { VistaMapa } from './vistaMapa.js';
import { sonido } from './sonido.js';
import { Partida } from '../juego/mapa.js';
import { RADIO_DESPIERTO } from '../juego/guardia.js';

const TECLAS = { ArrowUp: 'arriba', ArrowDown: 'abajo', ArrowLeft: 'izquierda', ArrowRight: 'derecha' };

export class JuegoUI {
  constructor(ctx) {
    this.ctx = ctx;
    this.vista = new VistaMapa($('#lienzo-mapa'));
    this.partida = null;
    this.avisoTimer = 0;

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
    this.partida.salidaAbierta = salidaAbierta;
    $('#juego-titulo').textContent = `Nivel ${nivel.numero} · ${nivel.nombre}`;
    const sg = vaciar($('#juego-sigma'));
    sg.append(h('span', { class: 'mono', texto: 'Σ' }), ...nivel.alfabeto.map(a => h('span', { texto: a })));
    const fila = vaciar($('#juego-senales'));
    nivel.alfabeto.forEach((a, i) => fila.append(h('button', {
      type: 'button', class: 'btn-senal', 'aria-label': `Emitir señal ${a}`, onclick: () => this.senal(a, i)
    }, a, h('small', { texto: 'señal' }))));
    this.activar();
  }

  // Se llama al (re)entrar a la pantalla de juego
  activar() {
    this.vista.asignar(this.partida);
    this.vista.iniciar();
    this.renderBitacora();
    this.avisar(this.partida.estado === 'jugando' ? '' : '');
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
    const r = p.mover(dir);
    if (!r.ok) {
      sonido.choque();
      if (r.motivo === 'salida-sellada') this.avisar('Salida sellada: valida tu diagrama en el cuaderno.');
      return;
    }
    this.vista.moverAnim(de, { ...p.jugador });
    sonido.paso();
    this.resolver(r.resultado);
  }

  senal(a, i = 0) {
    const p = this.partida;
    if (!p || p.estado !== 'jugando' || this.ctx.modalAbierto()) return;
    const antes = p.guardias.map(g => g.dormido);
    const r = p.senal(a);
    if (!r.ok) return;
    sonido.senal(i);
    const despues = p.guardias.map(g => g.dormido);
    if (despues.some((d, k) => d && !antes[k])) setTimeout(() => sonido.dormir(), 120);
    else if (despues.some((d, k) => !d && antes[k])) setTimeout(() => sonido.despertar(), 120);
    this.renderBitacora();
    this.resolver(r.resultado);
  }

  reiniciarGuardias() {
    const p = this.partida;
    if (!p || p.estado !== 'jugando' || this.ctx.modalAbierto()) return;
    const r = p.reiniciarGuardias();
    sonido.reinicio();
    this.avisar('Guardias reiniciados a q₀');
    this.renderBitacora();
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
  renderBitacora() {
    const p = this.partida;
    const t = vaciar($('#obs-tabla'));
    $('#obs-traza').textContent = p.senales ? p.senales : 'sin señales (q₀)';
    const gs = p.guardias;
    const conducta = (dormido) => h('span', { class: 'est ' + (dormido ? 'dormido' : 'despierto') }, h('i'), dormido ? 'dormido' : 'despierto');
    t.append(h('thead', {}, h('tr', {}, h('th', { texto: 'Cadena' }), ...gs.map(g => h('th', { texto: `Guardia ${g.id}` })))));
    const filas = [{ cadena: 'ε', dorm: gs.map(g => g.automata.F.has(g.automata.q0)) }];
    const hist = gs[0].historial;
    hist.forEach((_, i) => filas.push({ cadena: hist[i].cadena, dorm: gs.map(g => g.historial[i].dormido) }));
    const cuerpo = h('tbody');
    [...filas].reverse().slice(0, 40).forEach(f => cuerpo.append(h('tr', {}, h('td', { texto: f.cadena }), ...f.dorm.map(d => h('td', {}, conducta(d))))));
    t.append(cuerpo);
    if (filas.length === 1) cuerpo.append(h('tr', {}, h('td', { class: 'vacio', colspan: String(gs.length + 1), texto: `Envía una señal (${this.nivel.alfabeto.join(', ')}) y observa cómo reaccionan.` })));
  }
}

export { RADIO_DESPIERTO };
