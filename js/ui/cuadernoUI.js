// Cuaderno interactivo: lienzo Canvas con eventos de puntero, tabla de transición,
// simulación de cadenas, validación y reto de equivalencia (RF05, RF06, CU03, CU04, CU05).
import { $, $$, h, vaciar } from './dom.js';
import { sonido } from './sonido.js';
import { equivalentes } from '../motor/equivalencia.js';

const R = 22;            // radio de los estados (px)
const LARGA_MS = 450;    // pulsación larga = alternar aceptación
const DUR = { pop: 340, acepta: 260, ini: 260 };   // duración de las animaciones (ms)
const ONDA_MS = 480;
const easeOut = t => 1 - (1 - t) ** 3;
const easeOutBack = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2; };
const reducido = () => !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const vibrar = ms => { try { navigator.vibrate?.(ms); } catch { /* sin vibración */ } };

const AYUDA = {
  estado: 'Toca el lienzo para crear un estado (verás una vista previa; puedes arrastrarla antes de soltar). Arrastra de un estado a otro para crear una transición.',
  transicion: 'Arrastra de un estado a otro (o toca origen y luego destino; el mismo estado crea un lazo) y elige el símbolo.',
  mover: 'Arrastra un estado para reubicarlo.',
  inicial: 'Toca el estado que será q₀ (el estado inicial).',
  final: 'Toca un estado para alternar su aceptación (doble círculo = F). También: pulsación larga.',
  borrar: 'Toca un estado para eliminarlo, o la etiqueta de una flecha para quitarla.'
};

export class CuadernoUI {
  constructor(ctx) {
    this.ctx = ctx;
    this.canvas = $('#lienzo-cuaderno');
    this.c = this.canvas.getContext('2d');
    this.herr = 'estado';
    this.pendiente = null;      // id del origen en modo transición (toque-toque)
    this.arrastre = null;
    this.arista = null;         // { origen, destino } con selector abierto
    this.etiquetasHit = [];
    this.guardaTimer = 0;
    this.anims = new Map();     // id de estado -> { pop|acepta|ini: t0 }
    this.ondas = [];            // ondas de feedback { x, y, t0, color }
    this.fantasma = null;       // vista previa del estado que se va a crear
    this.dentro = null;         // id del estado destino resaltado al arrastrar una transición
    this._raf = 0;

    $$('.herr').forEach(b => b.addEventListener('click', () => this.setHerramienta(b.dataset.herr)));
    $('#selector-listo').addEventListener('click', () => this.cerrarSelector());
    $('#btn-validar').addEventListener('click', () => this.validar());
    $('#btn-cuaderno-limpiar').addEventListener('click', () => this.limpiar());
    $('#form-simular').addEventListener('submit', e => { e.preventDefault(); this.simular($('#simular-entrada').value.trim()); });

    const cv = this.canvas;
    cv.addEventListener('pointerdown', e => this.alBajar(e));
    cv.addEventListener('pointermove', e => this.alMover(e));
    cv.addEventListener('pointerup', e => this.alSoltar(e));
    cv.addEventListener('pointercancel', () => this.cancelar());
    cv.addEventListener('pointerleave', () => { if (!this.arrastre && this.fantasma) { this.fantasma = null; this.dibujar(); } });
    globalThis.addEventListener('resize', () => { if (this.nivel && $('#pantalla-cuaderno').classList.contains('activa')) this.ajustar(); });
  }

  abrir(nivel, cuaderno, estadoPares) {
    this.nivel = nivel;
    this.cuaderno = cuaderno;
    this.estadoPares = estadoPares;
    this.pendiente = null; this.arista = null;
    $('#selector-simbolo').hidden = true;
    $('#resultado').hidden = true;
    $('#simular-salida').textContent = '';
    $('#cuaderno-titulo').textContent = `Cuaderno · Nivel ${nivel.numero}`;
    const sub = $('#cuaderno-sub'); vaciar(sub);
    nivel.alfabeto.forEach(a => sub.append(h('span', { texto: a })));
    const objetivos = {
      deduccion: `Dibuja el AFD del guardia ${nivel.objetivoId}. Debe reproducir su conducta (dormido = estado de aceptación).`,
      minimizacion: `Dibuja el AFD <b>mínimo</b> equivalente al de los guardias: no uses estados de más.`,
      equivalencia: `Dibuja el AFD del guardia ${nivel.objetivoId} y resuelve el reto de equivalencia.`
    };
    const meta = $('#cuaderno-meta'); vaciar(meta);
    meta.append(...this._negrita(objetivos[nivel.tipo]));
    this.setHerramienta('estado');
    this.renderPanelEquivalencia();
    requestAnimationFrame(() => this.ajustar());
  }

  _negrita(txt) { // "<b>x</b>" → nodos seguros
    return txt.split(/(<b>.*?<\/b>)/).filter(Boolean).map(p => p.startsWith('<b>') ? h('b', { texto: p.slice(3, -4) }) : p);
  }

  /* ---------- Herramientas ---------- */
  setHerramienta(nombre) {
    this.herr = nombre; this.pendiente = null;
    $$('.herr').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.herr === nombre)));
    $('#herr-ayuda').textContent = AYUDA[nombre];
    this.dibujar();
  }

  /* ---------- Geometría ---------- */
  ajustar() {
    const w = this.canvas.clientWidth || 340, hgt = this.canvas.clientHeight || 300;
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 3);
    this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(hgt * dpr);
    this.w = w; this.hgt = hgt; this.dpr = dpr;
    this.refrescar();
  }
  px(e) { return { x: Math.min(Math.max(e.x * this.w, R + 4), this.w - R - 4), y: Math.min(Math.max(e.y * this.hgt, R + 18), this.hgt - R - 4) }; }
  aNorm(x, y) { return { x: x / this.w, y: y / this.hgt }; }
  estadoEn(x, y) {
    for (let i = this.cuaderno.estados.length - 1; i >= 0; i--) {
      const e = this.cuaderno.estados[i], p = this.px(e);
      if (Math.hypot(p.x - x, p.y - y) <= R + 6) return e;
    }
    return null;
  }
  puntero(ev) { const r = this.canvas.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; }

  /* ---------- Animación ---------- */
  _animar() { if (!this._raf) this._raf = requestAnimationFrame(() => { this._raf = 0; this.dibujar(); if (this.anims.size || this.ondas.length) this._animar(); }); }
  _anim(id, tipo) { if (reducido()) return; const a = this.anims.get(id) ?? {}; a[tipo] = performance.now(); this.anims.set(id, a); this._animar(); }
  _onda(x, y, color = '#f2c978') { if (reducido()) return; this.ondas.push({ x, y, t0: performance.now(), color }); this._animar(); }

  // Si el nuevo estado quedaría encima de otro, lo empuja hasta una posición libre.
  _separar(p) {
    const need = 2 * R + 10;
    let { x, y } = p;
    for (let i = 0; i < 14; i++) {
      let m = null;
      for (const e of this.cuaderno.estados) {
        const q = this.px(e), d = Math.hypot(x - q.x, y - q.y);
        if (d < need && (!m || d < m.d)) m = { q, d };
      }
      if (!m) break;
      const ang = m.d > 0.5 ? Math.atan2(y - m.q.y, x - m.q.x) : Math.random() * Math.PI * 2;
      x = Math.min(Math.max(m.q.x + Math.cos(ang) * need, R + 4), this.w - R - 4);
      y = Math.min(Math.max(m.q.y + Math.sin(ang) * need, R + 18), this.hgt - R - 4);
    }
    return { x, y };
  }

  _crearEstado(p) {
    const q = this._separar(p);
    const n = this.aNorm(q.x, q.y);
    const e = this.cuaderno.agregarEstado(n.x, n.y);
    if (this.cuaderno.estados.length === 1) { this.cuaderno.marcarInicial(e.id); this._anim(e.id, 'ini'); }
    this._anim(e.id, 'pop'); this._onda(q.x, q.y);
    sonido.toque(); vibrar(12); this.cambiado(); this.ctx.anunciar(`Estado ${e.etiqueta} creado`);
  }

  /* ---------- Eventos de puntero (unifican toque y ratón) ---------- */
  alBajar(ev) {
    if (!this.cuaderno) return;
    ev.preventDefault();
    this.canvas.setPointerCapture?.(ev.pointerId);
    const p = this.puntero(ev);
    const est = this.estadoEn(p.x, p.y);
    this.arrastre = { id: ev.pointerId, inicio: p, actual: p, estado: est, movido: false, larga: false };
    if (this.herr === 'estado' && !est) { this.fantasma = this._separar(p); this.dibujar(); }
    if (est) {
      this.arrastre.timer = setTimeout(() => {
        if (this.arrastre && !this.arrastre.movido && this.arrastre.estado === est) {
          this.arrastre.larga = true;
          this.cuaderno.alternarAceptacion(est.id);
          if (est.aceptacion) this._anim(est.id, 'acepta');
          sonido.toque(); vibrar(18); this.cambiado();
          this.ctx.anunciar(`${est.etiqueta} ${est.aceptacion ? 'es' : 'ya no es'} estado de aceptación`);
        }
      }, LARGA_MS);
    }
  }

  alMover(ev) {
    const a = this.arrastre;
    if (!a && ev.pointerType === 'mouse' && this.herr === 'estado' && this.cuaderno) {
      const q = this.puntero(ev);
      this.fantasma = this.estadoEn(q.x, q.y) ? null : this._separar(q);
      this.dibujar(); return;
    }
    if (!a || a.id !== ev.pointerId) return;
    const p = this.puntero(ev);
    a.actual = p;
    if (this.herr === 'estado' && !a.estado) this.fantasma = this._separar(p);
    const arrastraArista = (this.herr === 'transicion' || this.herr === 'estado') && a.estado && a.movido;
    const sobre = arrastraArista ? this.estadoEn(p.x, p.y) : null;
    if ((sobre?.id ?? null) !== this.dentro) { this.dentro = sobre?.id ?? null; if (this.dentro != null) vibrar(6); }
    if (Math.hypot(p.x - a.inicio.x, p.y - a.inicio.y) > 8) { a.movido = true; clearTimeout(a.timer); }
    if (this.herr === 'mover' && a.estado && a.movido) {
      const n = this.aNorm(p.x, p.y);
      this.cuaderno.moverEstado(a.estado.id, Math.min(Math.max(n.x, 0), 1), Math.min(Math.max(n.y, 0), 1));
    }
    this.dibujar();
  }

  alSoltar(ev) {
    const a = this.arrastre;
    if (!a || a.id !== ev.pointerId) return;
    clearTimeout(a.timer);
    this.arrastre = null; this.fantasma = null; this.dentro = null;
    const p = this.puntero(ev);
    if (a.larga) { this.dibujar(); return; }
    const destino = this.estadoEn(p.x, p.y);
    const h_ = this.herr;

    if (h_ === 'mover') { if (a.movido) this.cambiado(); this.dibujar(); return; }

    if (h_ === 'transicion') {
      if (a.estado && a.movido && destino) { this.abrirSelector(a.estado.id, destino.id); }
      else if (!a.movido && destino) {
        if (this.pendiente == null) { this.pendiente = destino.id; sonido.toque(); this.ctx.anunciar(`Origen ${destino.etiqueta}. Toca el destino.`); }
        else { const o = this.pendiente; this.pendiente = null; this.abrirSelector(o, destino.id); }
      } else if (!a.movido) { this.pendiente = null; }
      this.dibujar(); return;
    }
    // En la herramienta Estado, arrastrar de un estado a otro también crea una transición (como describe la Sección IX-D).
    if (h_ === 'estado' && a.estado && a.movido && destino) { this.abrirSelector(a.estado.id, destino.id); this.dibujar(); return; }
    // Herramienta Estado: el estado se crea donde se suelta, aunque se haya arrastrado la vista previa.
    if (h_ === 'estado' && !a.estado) { if (!destino) this._crearEstado(p); this.dibujar(); return; }
    if (a.movido) { this.dibujar(); return; }

    if (h_ === 'estado') {
      // toque sobre un estado existente: nada
    } else if (h_ === 'inicial') {
      if (destino) { this.cuaderno.marcarInicial(destino.id); this._anim(destino.id, 'ini'); sonido.toque(); vibrar(10); this.cambiado(); this.ctx.anunciar(`${destino.etiqueta} es el estado inicial`); }
    } else if (h_ === 'final') {
      if (destino) { const e = this.cuaderno.alternarAceptacion(destino.id); if (e.aceptacion) this._anim(e.id, 'acepta'); sonido.toque(); vibrar(18); this.cambiado(); this.ctx.anunciar(`${e.etiqueta} ${e.aceptacion ? 'es' : 'ya no es'} estado de aceptación`); }
    } else if (h_ === 'borrar') {
      if (destino) { const q = this.px(destino); this._onda(q.x, q.y, '#e5545c'); this.cuaderno.eliminarEstado(destino.id); sonido.toque(); vibrar(25); this.cambiado(); }
      else {
        const hit = this.etiquetasHit.find(l => Math.hypot(l.x - p.x, l.y - p.y) < 18);
        if (hit) {
          for (const s of hit.simbolos) this.cuaderno.quitarTransicion(hit.origen, s);
          sonido.toque(); this.cambiado();
        }
      }
    }
    this.dibujar();
  }

  cancelar() { if (this.arrastre) clearTimeout(this.arrastre.timer); this.arrastre = null; this.fantasma = null; this.dentro = null; this.dibujar(); }

  /* ---------- Selector de símbolo ---------- */
  abrirSelector(origen, destino) {
    this.arista = { origen, destino };
    this.renderSelector();
    $('#selector-simbolo').hidden = false;
    $('#selector-simbolo').scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }

  renderSelector() {
    const { origen, destino } = this.arista;
    const o = this.cuaderno.estado(origen), d = this.cuaderno.estado(destino);
    if (!o || !d) { this.cerrarSelector(); return; }
    const t = $('#selector-texto'); vaciar(t);
    t.append('Transición de ', h('span', { class: 'mono', texto: o.etiqueta }), ' hacia ', h('span', { class: 'mono', texto: d.etiqueta }), '. Elige uno o más símbolos:');
    const cont = vaciar($('#selector-botones'));
    for (const s of this.nivel.alfabeto) {
      const activo = this.cuaderno.destinoDe(origen, s) === destino;
      cont.append(h('button', {
        type: 'button', 'aria-pressed': String(activo), 'aria-label': `Símbolo ${s}`, texto: s,
        onclick: () => {
          if (this.cuaderno.destinoDe(origen, s) === destino) this.cuaderno.quitarTransicion(origen, s);
          else this.cuaderno.ponerTransicion(origen, s, destino); // reemplaza si ya iba a otro estado (determinismo)
          sonido.toque(); this.cambiado(); this.renderSelector();
        }
      }));
    }
  }
  cerrarSelector() { this.arista = null; $('#selector-simbolo').hidden = true; this.dibujar(); }

  /* ---------- Dibujo ---------- */
  dibujar() {
    if (!this.cuaderno || !this.w) return;
    const c = this.c;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.w, this.hgt);
    this.etiquetasHit = [];
    const cu = this.cuaderno;
    const aristas = cu.aristas();
    const hayInversa = (a) => aristas.some(b => b.origen === a.destino && b.destino === a.origen && a.origen !== a.destino);

    for (const a of aristas) this._arista(a, hayInversa(a));

    // arista en construcción (arrastre)
    const ar = this.arrastre;
    if ((this.herr === 'transicion' || this.herr === 'estado') && ar?.estado && ar.movido) {
      const p0 = this.px(ar.estado);
      c.strokeStyle = '#f2c978'; c.setLineDash([6, 5]); c.lineWidth = 2;
      c.beginPath(); c.moveTo(p0.x, p0.y); c.lineTo(ar.actual.x, ar.actual.y); c.stroke(); c.setLineDash([]);
    }

    // ondas de feedback (crear / borrar)
    const ahora = performance.now();
    this.ondas = this.ondas.filter(o => ahora - o.t0 < ONDA_MS);
    for (const o of this.ondas) {
      const t = easeOut((ahora - o.t0) / ONDA_MS);
      c.save(); c.globalAlpha = 0.55 * (1 - t); c.strokeStyle = o.color; c.lineWidth = 3;
      c.beginPath(); c.arc(o.x, o.y, R * (0.6 + 1.7 * t), 0, 7); c.stroke(); c.restore();
    }

    for (const e of cu.estados) {
      const p = this.px(e);
      const sel = e.id === this.pendiente || (this.arista && (this.arista.origen === e.id || this.arista.destino === e.id));
      let k = 1, kAc = 1, kIni = 1;
      const an = this.anims.get(e.id);
      if (an) {
        for (const tipo of Object.keys(an)) {
          const t = (ahora - an[tipo]) / DUR[tipo];
          if (t >= 1) delete an[tipo];
          else if (tipo === 'pop') k = easeOutBack(t);
          else if (tipo === 'acepta') kAc = easeOut(t);
          else kIni = easeOut(t);
        }
        if (!Object.keys(an).length) this.anims.delete(e.id);
      }
      const levantado = this.herr === 'mover' && ar?.estado?.id === e.id && ar.movido;
      const r = R * Math.max(k, 0.01) * (levantado ? 1.12 : 1);
      if (e.inicial) {
        c.save(); c.globalAlpha = kIni; c.translate(-(1 - kIni) * 18, 0);
        c.strokeStyle = '#f2c978'; c.fillStyle = '#f2c978'; c.lineWidth = 2.5;
        c.beginPath(); c.moveTo(p.x - R - 30, p.y); c.lineTo(p.x - R - 3, p.y); c.stroke();
        this._punta(p.x - R - 3, p.y, 0);
        c.restore();
      }
      if (this.dentro === e.id) {
        c.save(); c.globalAlpha = 0.8; c.strokeStyle = '#f2c978'; c.lineWidth = 3;
        c.beginPath(); c.arc(p.x, p.y, R + 8, 0, 7); c.stroke(); c.restore();
      }
      c.save();
      if (levantado) { c.shadowColor = 'rgba(242,201,120,.65)'; c.shadowBlur = 16; }
      c.beginPath(); c.arc(p.x, p.y, r, 0, 7);
      c.fillStyle = sel ? '#4a2a33' : '#27181f'; c.fill();
      c.lineWidth = sel ? 3 : 2; c.strokeStyle = sel ? '#e5545c' : '#d9a94a'; c.stroke();
      c.restore();
      if (e.aceptacion) {
        c.save(); c.globalAlpha = 0.35 + 0.65 * kAc;
        c.beginPath(); c.arc(p.x, p.y, (r - 5) + (1 - kAc) * 9, 0, 7); c.lineWidth = 2; c.strokeStyle = '#d9a94a'; c.stroke(); c.restore();
      }
      c.save(); c.globalAlpha = Math.min(1, Math.max(0, k));
      c.fillStyle = '#f3eadd'; c.font = '600 14px ui-monospace, Consolas, monospace';
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(e.etiqueta, p.x, p.y + 1);
      c.restore();
    }

    // vista previa del estado que se va a crear
    if (this.fantasma && this.herr === 'estado') {
      const f = this.fantasma;
      c.save(); c.globalAlpha = 0.65; c.setLineDash([5, 4]);
      c.beginPath(); c.arc(f.x, f.y, R, 0, 7); c.fillStyle = 'rgba(217,169,74,.14)'; c.fill();
      c.lineWidth = 2; c.strokeStyle = '#f2c978'; c.stroke(); c.setLineDash([]);
      c.fillStyle = '#f2c978'; c.font = '600 14px ui-monospace, Consolas, monospace';
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(cu._etiquetaLibre(), f.x, f.y + 1);
      c.restore();
    }
    if (cu.estados.length === 0 && !this.fantasma) {
      c.fillStyle = '#b3a396'; c.font = '14px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('Toca aquí para crear tu primer estado', this.w / 2, this.hgt / 2);
    }
  }

  _punta(x, y, ang) {
    const c = this.c;
    c.save(); c.translate(x, y); c.rotate(ang);
    c.beginPath(); c.moveTo(0, 0); c.lineTo(-10, -5); c.lineTo(-10, 5); c.closePath(); c.fill(); c.restore();
  }

  _arista(a, curva) {
    const c = this.c, cu = this.cuaderno;
    const o = cu.estado(a.origen), d = cu.estado(a.destino);
    const p = this.px(o), q = this.px(d);
    const txt = a.simbolos.join(',');
    c.strokeStyle = '#c9b8a8'; c.fillStyle = '#c9b8a8'; c.lineWidth = 2;
    let lx, ly;
    if (a.origen === a.destino) {
      const cx = p.x, cy = p.y - R - 14;
      c.beginPath(); c.arc(cx, cy, 15, Math.PI * 0.78, Math.PI * 2.22); c.stroke();
      const ang = Math.PI * 2.22;
      const ex = cx + 15 * Math.cos(ang), ey = cy + 15 * Math.sin(ang);
      this._punta(ex, ey, ang + Math.PI / 2 + 0.25);
      lx = cx; ly = cy - 24;
    } else {
      const dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy) || 1;
      const nx = -dy / L, ny = dx / L;
      const k = curva ? 34 : 0;
      const mx = (p.x + q.x) / 2 + nx * k, my = (p.y + q.y) / 2 + ny * k;
      // punto de inicio/fin sobre el borde de cada estado, siguiendo la tangente
      const ini = this._borde(p, { x: mx, y: my });
      const fin = this._borde(q, { x: mx, y: my });
      c.beginPath(); c.moveTo(ini.x, ini.y); c.quadraticCurveTo(mx, my, fin.x, fin.y); c.stroke();
      this._punta(fin.x, fin.y, Math.atan2(fin.y - my, fin.x - mx));
      lx = (ini.x + 2 * mx + fin.x) / 4 + nx * (curva ? 10 : 12) * (k >= 0 ? 1 : -1);
      ly = (ini.y + 2 * my + fin.y) / 4 + ny * (curva ? 10 : 12);
      if (!curva) { lx = (p.x + q.x) / 2 + nx * 13; ly = (p.y + q.y) / 2 + ny * 13; }
    }
    c.font = '700 14px ui-monospace, Consolas, monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const wTxt = c.measureText(txt).width + 10;
    c.fillStyle = '#1d1217'; c.fillRect(lx - wTxt / 2, ly - 10, wTxt, 20);
    c.fillStyle = '#f2c978'; c.fillText(txt, lx, ly);
    this.etiquetasHit.push({ x: lx, y: ly, origen: a.origen, simbolos: a.simbolos });
  }

  _borde(centro, hacia) {
    const dx = hacia.x - centro.x, dy = hacia.y - centro.y, L = Math.hypot(dx, dy) || 1;
    return { x: centro.x + dx / L * R, y: centro.y + dy / L * R };
  }

  /* ---------- Tabla de transición (alternativa accesible al lienzo) ---------- */
  renderTabla(foco = null) {
    const t = vaciar($('#tabla-trans'));
    const cu = this.cuaderno;
    if (!cu.estados.length) { t.append(h('tr', {}, h('td', { class: 'vacio', texto: 'Aún no hay estados.' }))); return; }
    t.append(h('thead', {}, h('tr', {}, h('th', { texto: 'δ' }), ...this.nivel.alfabeto.map(a => h('th', { texto: a })))));
    const cuerpo = h('tbody');
    for (const e of cu.estados) {
      const marca = (e.inicial ? '→' : '') + (e.aceptacion ? '*' : '');
      cuerpo.append(h('tr', {}, h('th', { class: 'fila', scope: 'row', texto: `${marca}${marca ? ' ' : ''}${e.etiqueta}` }),
        ...this.nivel.alfabeto.map(a => {
          const dest = cu.destinoDe(e.id, a);
          const sel = h('select', {
            'aria-label': `δ(${e.etiqueta}, ${a})`, class: dest == null ? 'falta' : '', 'data-o': e.id, 'data-s': a,
            onchange: ev => {
              const v = ev.target.value;
              if (v === '') cu.quitarTransicion(e.id, a); else cu.ponerTransicion(e.id, a, Number(v));
              sonido.toque(); this.cambiado(`${e.id}|${a}`);
            }
          }, h('option', { value: '', texto: '—' }), ...cu.estados.map(x => h('option', { value: String(x.id), texto: x.etiqueta, selected: x.id === dest })));
          return h('td', {}, sel);
        })));
    }
    t.append(cuerpo);
    if (foco) { const [o, s] = foco.split('|'); $(`select[data-o="${o}"][data-s="${s}"]`, t)?.focus(); }
  }

  refrescar(foco = null) { this.dibujar(); this.renderTabla(foco); }

  cambiado(foco = null) {
    $('#resultado').hidden = true;
    this.refrescar(foco);
    clearTimeout(this.guardaTimer);
    this.guardaTimer = setTimeout(() => this.ctx.guardarDibujo(this.cuaderno.serializar()), 300);
  }

  async limpiar() {
    if (!this.cuaderno.estados.length) return;
    if (!globalThis.confirm('¿Vaciar el cuaderno de este nivel? Se borrarán todos los estados y transiciones.')) return;
    this.cuaderno.estados = []; this.cuaderno.transiciones = [];
    this.arista = null; $('#selector-simbolo').hidden = true;
    this.cambiado();
  }

  /* ---------- Simulación sobre el diagrama del estudiante ---------- */
  simular(w) {
    const salida = vaciar($('#simular-salida'));
    const cu = this.cuaderno;
    const ini = cu.inicial();
    if (!ini) { salida.append(h('span', { class: 'mal', texto: 'Marca primero el estado inicial.' })); return; }
    for (const a of w) if (!this.nivel.alfabeto.includes(a)) { salida.append(h('span', { class: 'mal', texto: `«${a}» no pertenece al alfabeto Σ = {${this.nivel.alfabeto.join(', ')}}.` })); return; }
    const A = cu.aAutomata();
    let q = ini.etiqueta;
    let camino = q;
    for (const a of w) {
      const r = A.paso(q, a);
      if (r === null) { salida.append(h('span', { class: 'camino', texto: camino }), h('br'), h('span', { class: 'mal', texto: `No hay transición δ(${q}, ${a}): el diagrama está incompleto.` })); return; }
      camino += ` —${a}→ ${r}`; q = r;
    }
    const ok = A.F.has(q);
    salida.append(h('span', { class: 'camino', texto: camino }), h('br'),
      h('span', { class: ok ? 'ok' : 'mal', texto: `δ*(${ini.etiqueta}, ${w || 'ε'}) = ${q} → tu diagrama ${ok ? 'ACEPTA' : 'RECHAZA'} la cadena.` }));
  }

  /* ---------- Validación (CU04) ---------- */
  validar() {
    const nivel = this.nivel;
    const r = this.cuaderno.validar(nivel.automataObjetivo, { exigirMinimo: nivel.tipo === 'minimizacion' });
    this.mostrarResultado(r);
    if (r.estado === 'equivalente') sonido.valido(); else sonido.invalido();
    clearTimeout(this.guardaTimer);
    this.ctx.alValidar(r, this.cuaderno.serializar());
  }

  mostrarResultado(r) {
    const el = vaciar($('#resultado'));
    el.hidden = false;
    el.className = 'resultado';
    const cad = s => (s === '' ? 'ε (cadena vacía)' : `«${s}»`);
    if (r.estado === 'incompleto') {
      el.classList.add('aviso');
      el.append(h('h4', { texto: 'Diagrama incompleto' }), h('ul', {}, ...r.motivos.map(m => h('li', { texto: m }))), h('p', { texto: 'No se ejecutó la verificación.' }));
    } else if (r.estado === 'no-equivalente') {
      el.classList.add('error');
      el.append(h('h4', { texto: 'Aún no reproduce a los guardias' }),
        h('p', {}, 'Con la cadena ', h('b', { class: 'mono', texto: cad(r.contraejemplo) }), ` tu diagrama ${r.dibujoAcepta ? 'acepta' : 'rechaza'} y los guardias ${r.objetivoAcepta ? 'se duermen (aceptan)' : 'siguen despiertos (rechazan)'}.`),
        h('p', { texto: 'Pruébala en el mapa y revisa las transiciones.' }));
    } else if (r.estado === 'no-minimo') {
      el.classList.add('aviso');
      el.append(h('h4', { texto: 'Equivalente, pero no mínimo' }),
        h('p', { texto: `Tu diagrama reconoce el lenguaje correcto con ${r.tusEstados} estados, pero puede reducirse. Busca estados que se comporten igual ante toda cadena (¡el mínimo tiene ${r.minimo}!).` }));
    } else {
      el.classList.add('exito');
      el.append(h('h4', { texto: '¡Diagrama equivalente al autómata oculto!' }),
        h('p', { texto: 'Tu AFD acepta exactamente las mismas cadenas que los guardias.' }));
    }
  }

  /* ---------- Reto de equivalencia (nivel 4) ---------- */
  renderPanelEquivalencia() {
    const panel = $('#panel-equivalencia');
    vaciar(panel);
    const nivel = this.nivel;
    if (nivel.tipo !== 'equivalencia') { panel.hidden = true; return; }
    panel.hidden = false;
    panel.append(h('h3', { class: 'sub', texto: 'Reto de equivalencia' }),
      h('p', { class: 'meta', texto: 'Compara a los guardias con lo que observaste. Si crees que difieren, escribe una cadena que los distinga (el motor la comprobará).' }));
    nivel.pares.forEach(([x, y], i) => {
      const grupo = `par${i}`;
      const estado = h('div', { class: 'estado-par', 'aria-live': 'polite' });
      const cadena = h('input', { type: 'text', class: 'mono', placeholder: 'Cadena que los distingue (ej. ca)', 'aria-label': `Cadena distinguidora para ${x} y ${y}`, autocapitalize: 'off', spellcheck: 'false' });
      cadena.hidden = true;
      const sel = (v) => $(`input[name=${grupo}]:checked`, panel)?.value === v;
      const radios = ['si', 'no'].map(v => h('label', {}, h('input', {
        type: 'radio', name: grupo, value: v,
        onchange: () => { cadena.hidden = !sel('no'); }
      }), v === 'si' ? 'Sí, equivalentes' : 'No, difieren'));
      const boton = h('button', { type: 'button', class: 'btn btn-peq', texto: 'Comprobar',
        onclick: () => this.comprobarPar(i, x, y, sel('si') ? 'si' : sel('no') ? 'no' : null, cadena.value.trim(), estado) });
      const hecho = this.estadoPares[i];
      if (hecho) { estado.className = 'estado-par ok'; estado.textContent = `✓ Resuelto: ${hecho}`; }
      panel.append(h('div', { class: 'par' }, h('b', { texto: `¿El guardia ${x} y el guardia ${y} reconocen el mismo lenguaje?` }), h('div', { class: 'par-opc' }, ...radios), cadena, boton, estado));
    });
  }

  comprobarPar(i, x, y, resp, cadena, estadoEl) {
    const A = this.nivel.automatas[this.nivel.mapaGuardias[x]], B = this.nivel.automatas[this.nivel.mapaGuardias[y]];
    const marcar = (ok, msg) => {
      estadoEl.className = 'estado-par ' + (ok ? 'ok' : 'mal'); estadoEl.textContent = msg;
      if (ok) { sonido.valido(); this.estadoPares[i] = resp === 'si' ? 'equivalentes' : `difieren con «${cadena || 'ε'}»`; }
      else sonido.invalido();
      this.ctx.alResolverPares(this.estadoPares);
    };
    if (!resp) { marcar(false, 'Elige una respuesta.'); return; }
    const eq = equivalentes(A, B);
    if (resp === 'si') {
      if (eq.iguales) marcar(true, '✓ Correcto: reconocen el mismo lenguaje.');
      else marcar(false, 'Incorrecto: existe una cadena que los distingue. Sigue experimentando con las señales.');
      return;
    }
    if (eq.iguales) { marcar(false, 'Incorrecto: no existe ninguna cadena que los distinga; son equivalentes.'); return; }
    for (const s of cadena) if (!this.nivel.alfabeto.includes(s)) { marcar(false, `«${s}» no pertenece al alfabeto.`); return; }
    if (A.acepta(cadena) !== B.acepta(cadena)) marcar(true, `✓ Correcto: «${cadena || 'ε'}» la acepta uno y la rechaza el otro.`);
    else marcar(false, `Esa cadena no los distingue: ambos ${A.acepta(cadena) ? 'la aceptan' : 'la rechazan'}. Prueba otra.`);
  }
}
