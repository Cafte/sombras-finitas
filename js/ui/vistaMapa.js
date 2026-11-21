// Dibujo del mapa por casillas en Canvas (capa de interfaz).
import { RADIO_DESPIERTO } from '../juego/guardia.js';

const COL = {
  suelo: '#1d1217', suelo2: '#201419', pared: '#3a2430', paredAlta: '#4b2f3d', paredLinea: '#00000066',
  sombra: '#3a2a55', sombra2: '#4a3670', oro: '#d9a94a', oro2: '#f2c978', rojo: '#b4232c', rojo2: '#e5545c', ok: '#86d196'
};

export function dibujarIcono(canvas, tipo) {
  const c = canvas.getContext('2d');
  canvas.width = canvas.height = 64;
  c.scale(2, 2);
  dibujarCasilla(c, tipo, 0, 0, 32, 0, true);
}

function dibujarCasilla(c, tipo, x, y, s, t, abierta) {
  const px = x * s, py = y * s;
  if (tipo === '#') {
    c.fillStyle = COL.pared; c.fillRect(px, py, s, s);
    c.fillStyle = COL.paredAlta; c.fillRect(px + 1, py + 1, s - 2, s * 0.5);
    c.strokeStyle = COL.paredLinea; c.strokeRect(px + .5, py + .5, s - 1, s - 1);
    return;
  }
  c.fillStyle = (x + y) % 2 ? COL.suelo : COL.suelo2; c.fillRect(px, py, s, s);
  if (tipo === 's') {
    const g = c.createLinearGradient(px, py, px + s, py + s);
    g.addColorStop(0, COL.sombra2); g.addColorStop(1, COL.sombra);
    c.fillStyle = g; c.fillRect(px + 2, py + 2, s - 4, s - 4);
    c.strokeStyle = '#ffffff22'; c.lineWidth = 1;
    for (let i = -s; i < s; i += 6) { c.beginPath(); c.moveTo(px + 2 + i, py + s - 2); c.lineTo(px + 2 + i + s, py + 2); c.stroke(); }
    c.save(); c.beginPath(); c.rect(px + 2, py + 2, s - 4, s - 4); c.restore();
  } else if (tipo === 'E') {
    const a = abierta ? 0.85 + 0.15 * Math.sin(t / 260) : 1;
    c.fillStyle = abierta ? `rgba(242,201,120,${0.25 * a})` : '#00000055'; c.fillRect(px + 2, py + 2, s - 4, s - 4);
    c.strokeStyle = abierta ? COL.oro2 : '#7a6a5a'; c.lineWidth = 2;
    c.strokeRect(px + s * .2, py + s * .12, s * .6, s * .76);
    if (!abierta) {
      for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(px + s * (.2 + .15 * i), py + s * .12); c.lineTo(px + s * (.2 + .15 * i), py + s * .88); c.stroke(); }
    } else {
      c.fillStyle = COL.oro; c.beginPath(); c.arc(px + s / 2, py + s / 2, s * .12, 0, 7); c.fill();
    }
  }
}

export class VistaMapa {
  constructor(canvas) {
    this.canvas = canvas;
    this.c = canvas.getContext('2d');
    this.partida = null;
    this.s = 40;
    this.anim = null;      // { de:{x,y}, a:{x,y}, t0 }
    this.reducir = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.raf = 0;
    this.tmp = 0;
    this.pos = new Map();
  }

  asignar(partida) {
    this.partida = partida;
    this.anim = null;
    this.pos = new Map();   // posición dibujada de cada guardia (se desliza hacia la lógica)
    this.ajustar();
  }

  ajustar(anchoDisp) {
    if (!this.partida) return;
    const n = this.partida.nivel;
    const caja = this.canvas.parentElement;
    const disp = anchoDisp ?? Math.max(240, (caja?.clientWidth || 360) - 16);
    this.s = Math.max(24, Math.min(52, Math.floor(disp / n.ancho)));
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 3);
    this.canvas.style.width = n.ancho * this.s + 'px';
    this.canvas.style.height = n.alto * this.s + 'px';
    this.canvas.width = Math.round(n.ancho * this.s * dpr);
    this.canvas.height = Math.round(n.alto * this.s * dpr);
    this.dpr = dpr;
  }

  moverAnim(de, a) { if (!this.reducir) this.anim = { de, a, t0: performance.now() }; }

  iniciar() { if (!this.raf) { const bucle = t => { this.dibujar(t); this.raf = requestAnimationFrame(bucle); }; this.raf = requestAnimationFrame(bucle); } }
  detener() { cancelAnimationFrame(this.raf); this.raf = 0; }

  celdaDesdeEvento(ev) {
    const r = this.canvas.getBoundingClientRect();
    return { x: Math.floor((ev.clientX - r.left) / this.s), y: Math.floor((ev.clientY - r.top) / this.s) };
  }

  dibujar(t = performance.now()) {
    const p = this.partida;
    if (!p) return;
    const { c, s } = this;
    const n = p.nivel;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, n.ancho * s, n.alto * s);
    for (let y = 0; y < n.alto; y++) for (let x = 0; x < n.ancho; x++) {
      dibujarCasilla(c, n.celdas[y][x], x, y, s, t, p.salidaAbierta);
    }
    // Rutas de patrulla (tenues): se ve por dónde caminará cada guardia despierto
    for (const g of p.guardias) {
      if (!g.ruta) continue;
      c.save(); c.setLineDash([4, 5]); c.lineWidth = 2; c.lineCap = 'round';
      c.strokeStyle = g.dormido ? 'rgba(179,163,150,.22)' : 'rgba(229,84,92,.45)';
      c.beginPath(); g.ruta.forEach((q, i) => { const X = q.x * s + s / 2, Y = q.y * s + s / 2; if (i) c.lineTo(X, Y); else c.moveTo(X, Y); }); c.stroke();
      c.restore();
    }
    // Radios de ruido (casillas dentro de la distancia Manhattan, sin paredes)
    const pulso = this.reducir ? 0.5 : 0.5 + 0.5 * Math.sin(t / 380);
    for (const g of p.guardias) {
      if (g.radio === 0) continue;
      for (let y = g.y - g.radio; y <= g.y + g.radio; y++) for (let x = g.x - g.radio; x <= g.x + g.radio; x++) {
        if (Math.abs(x - g.x) + Math.abs(y - g.y) > g.radio) continue;
        const ch = n.celdas[y]?.[x];
        if (ch === undefined || ch === '#') continue;
        c.fillStyle = `rgba(229,84,92,${0.16 + 0.12 * pulso})`;
        c.fillRect(x * s + 1, y * s + 1, s - 2, s - 2);
        if (ch === 's') { c.strokeStyle = 'rgba(134,209,150,.7)'; c.lineWidth = 1.5; c.strokeRect(x * s + 3, y * s + 3, s - 6, s - 6); }
      }
    }
    for (const g of p.guardias) this._guardia(g, t);
    this._jugador(p, t);
  }

  _guardia(g, t) {
    const { c, s } = this;
    let vp = this.pos.get(g.id);
    if (!vp) { vp = { x: g.x, y: g.y }; this.pos.set(g.id, vp); }
    if (this.reducir) { vp.x = g.x; vp.y = g.y; }
    else { vp.x += (g.x - vp.x) * 0.22; vp.y += (g.y - vp.y) * 0.22; if (Math.abs(g.x - vp.x) < 0.01) vp.x = g.x; if (Math.abs(g.y - vp.y) < 0.01) vp.y = g.y; }
    const cx = vp.x * s + s / 2, cy = vp.y * s + s / 2, r = s * 0.34;
    const dorm = g.dormido;
    c.save();
    c.shadowColor = dorm ? 'transparent' : COL.rojo2; c.shadowBlur = dorm ? 0 : 12;
    c.fillStyle = dorm ? '#5b4a50' : COL.rojo;
    c.beginPath(); c.arc(cx, cy - r * .25, r * .62, 0, 7); c.fill();
    c.beginPath(); c.moveTo(cx - r, cy + r); c.quadraticCurveTo(cx, cy - r * .6, cx + r, cy + r); c.closePath(); c.fill();
    c.restore();
    // Ojo / párpado
    if (dorm) {
      c.strokeStyle = '#cfc2c6'; c.lineWidth = 2; c.beginPath();
      c.moveTo(cx - r * .35, cy - r * .2); c.lineTo(cx + r * .35, cy - r * .2); c.stroke();
      const z = this.reducir ? 0 : ((t / 900) % 1);
      c.fillStyle = `rgba(134,209,150,${1 - z})`; c.font = `700 ${Math.round(s * .26)}px sans-serif`;
      c.fillText('z', cx + r * .6, cy - r * .8 - z * s * .25);
    } else {
      c.fillStyle = '#fff'; c.beginPath(); c.ellipse(cx, cy - r * .25, r * .34, r * .2, 0, 0, 7); c.fill();
      c.fillStyle = '#111'; c.beginPath(); c.arc(cx, cy - r * .25, r * .12, 0, 7); c.fill();
    }
    c.fillStyle = COL.oro2; c.font = `700 ${Math.round(s * .26)}px ui-monospace, monospace`;
    c.textAlign = 'center'; c.fillText(g.id, cx, vp.y * s + s - 3); c.textAlign = 'start';
  }

  _jugador(p, t) {
    const { c, s } = this;
    let x = p.jugador.x, y = p.jugador.y;
    if (this.anim) {
      const k = Math.min(1, (t - this.anim.t0) / 110);
      x = this.anim.de.x + (this.anim.a.x - this.anim.de.x) * k;
      y = this.anim.de.y + (this.anim.a.y - this.anim.de.y) * k;
      if (k >= 1) this.anim = null;
    }
    const cx = x * s + s / 2, cy = y * s + s / 2, r = s * 0.3;
    const oculto = p.enSombra();
    c.save();
    c.globalAlpha = oculto ? 0.6 : 1;
    c.shadowColor = COL.oro2; c.shadowBlur = 10;
    c.fillStyle = COL.oro;
    c.beginPath(); c.arc(cx, cy - r * .35, r * .55, 0, 7); c.fill();
    c.fillStyle = '#b98a2e';
    c.beginPath(); c.moveTo(cx - r, cy + r * 1.05); c.quadraticCurveTo(cx, cy - r * .5, cx + r, cy + r * 1.05); c.closePath(); c.fill();
    c.restore();
    if (p.estado === 'descubierto') {
      c.strokeStyle = COL.rojo2; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, s * .46, 0, 7); c.stroke();
    }
  }
}
