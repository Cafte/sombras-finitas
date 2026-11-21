// Música de fondo generativa (Web Audio, sin archivos: funciona sin conexión).
// Estética del juego: sigilo en una catedral oscura, rojo y oro. Re menor, zumbido grave, acordes lentos con la
// dominante mayor (La) como destello dorado, notas sueltas tipo campana con eco y, cuando sube la tensión, un latido.
// Nunca se repite igual: las notas sueltas se eligen al azar dentro del acorde vigente.

export const BPM = 52;
export const BEAT = 60 / BPM;          // ≈ 1,15 s
export const PASOS_POR_ACORDE = 16;    // 8 tiempos por acorde (negras de medio tiempo)

export const mtof = m => 440 * 2 ** ((m - 69) / 12);

// Acordes (notas MIDI): Dm · Bb · Gm · A (dominante). `grave` es la nota del zumbido; `agudas`, el repertorio de la melodía.
export const ACORDES = [
  { nombre: 'Dm', grave: 38, notas: [50, 53, 57], agudas: [62, 65, 69, 74, 77] },
  { nombre: 'Bb', grave: 34, notas: [46, 50, 53], agudas: [62, 65, 70, 74, 77] },
  { nombre: 'Gm', grave: 43, notas: [43, 46, 50], agudas: [62, 67, 70, 74, 79] },
  { nombre: 'A', grave: 45, notas: [45, 49, 52], agudas: [61, 64, 69, 73, 76] }
];

// Elige la siguiente nota de la melodía cerca de la anterior (paseo aleatorio) para que suene como una frase.
export function elegirNota(acorde, anterior = null, azar = Math.random) {
  const pool = ACORDES[acorde].agudas;
  if (anterior == null || !pool.includes(anterior)) return pool[Math.floor(azar() * pool.length)];
  const i = pool.indexOf(anterior);
  const paso = [-2, -1, -1, 0, 1, 1, 2][Math.floor(azar() * 7)];
  return pool[Math.min(pool.length - 1, Math.max(0, i + paso))];
}

let activa = true;
try { activa = localStorage.getItem('sf-musica') !== '0'; } catch { /* sin almacenamiento */ }

export class Musica {
  constructor(contexto = null, { azar = Math.random } = {}) {
    this.ctx = contexto;
    this.azar = azar;
    this.t = 0;                 // tensión suavizada (0..1)
    this.tObjetivo = 0;
    this.paso = 0;              // contador de medios tiempos
    this.proxPaso = 0;          // instante (s) del próximo paso a programar
    this.proxLatido = 0;
    this.ultima = null;         // última nota de la melodía
    this.timer = 0;
    this.corriendo = false;
    this.volMaestro = 0.22;   // música de fondo: por debajo de los efectos
  }

  _construir() {
    const c = this.ctx;
    this.maestro = c.createGain(); this.maestro.gain.value = 0.0001;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -22; comp.ratio.value = 4; comp.attack.value = 0.05; comp.release.value = 0.4;
    this.maestro.connect(comp); comp.connect(c.destination);

    // Eco largo y oscuro: da la sensación de nave de piedra
    this.bus = c.createGain(); this.bus.gain.value = 1; this.bus.connect(this.maestro);
    const envio = c.createGain(); envio.gain.value = 0.55;
    const eco = c.createDelay(2); eco.delayTime.value = 0.62;
    const fb = c.createGain(); fb.gain.value = 0.46;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500;
    envio.connect(eco); eco.connect(lp); lp.connect(fb); fb.connect(eco);
    lp.connect(this.maestro);
    this.envio = envio;

    // Acordes: pasan por un filtro que se abre con la tensión
    this.filtroPad = c.createBiquadFilter(); this.filtroPad.type = 'lowpass'; this.filtroPad.frequency.value = 650; this.filtroPad.Q.value = 0.7;
    this.filtroPad.connect(this.bus); this.filtroPad.connect(envio);

    // Zumbido grave continuo (dos osciladores desafinados) con respiración lenta del filtro
    const filtroZ = c.createBiquadFilter(); filtroZ.type = 'lowpass'; filtroZ.frequency.value = 260; filtroZ.Q.value = 1.4;
    const gz = c.createGain(); gz.gain.value = 0.2;
    this.zumbidoA = c.createOscillator(); this.zumbidoA.type = 'sawtooth'; this.zumbidoA.frequency.value = mtof(38);
    this.zumbidoB = c.createOscillator(); this.zumbidoB.type = 'sine'; this.zumbidoB.frequency.value = mtof(38) * 1.004;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.06;
    const lfoG = c.createGain(); lfoG.gain.value = 90;
    lfo.connect(lfoG); lfoG.connect(filtroZ.frequency);
    this.zumbidoA.connect(filtroZ); this.zumbidoB.connect(filtroZ); filtroZ.connect(gz); gz.connect(this.bus);
    this.zumbidoA.start(); this.zumbidoB.start(); lfo.start();
    this._fuentes = [this.zumbidoA, this.zumbidoB, lfo];
  }

  arrancar() {
    if (this.corriendo || !activa) return;
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!this.ctx) { if (!AC) return; try { this.ctx = new AC(); } catch { return; } }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    if (!this.maestro) this._construir();
    const ahora = this.ctx.currentTime;
    this.maestro.gain.cancelScheduledValues(ahora);
    this.maestro.gain.setValueAtTime(this.maestro.gain.value, ahora);
    this.maestro.gain.linearRampToValueAtTime(this.volMaestro, ahora + 3);   // entrada suave
    this.proxPaso = Math.max(this.proxPaso, ahora + 0.1);
    this.proxLatido = Math.max(this.proxLatido, ahora + 0.5);
    this.corriendo = true;
    this.timer = setInterval(() => this.programarHasta(this.ctx.currentTime + 1.2), 200);
  }

  detener(fundido = 1.2) {
    if (!this.corriendo) return;
    clearInterval(this.timer); this.timer = 0; this.corriendo = false;
    const ahora = this.ctx.currentTime;
    this.maestro.gain.cancelScheduledValues(ahora);
    this.maestro.gain.setValueAtTime(this.maestro.gain.value, ahora);
    this.maestro.gain.linearRampToValueAtTime(0.0001, ahora + fundido);
  }

  // 0 = calma, 1 = máxima tensión (guardias despiertos cerca, campana a punto de sonar)
  tension(v) { this.tObjetivo = Math.min(1, Math.max(0, v)); }

  // Programa en el contexto todos los eventos musicales hasta el instante `hasta` (también sirve para renderizar sin conexión).
  programarHasta(hasta) {
    const paso = BEAT / 2;
    while (this.proxPaso < hasta) {
      this.t += (this.tObjetivo - this.t) * 0.12;   // suaviza los cambios de tensión
      this._paso(this.proxPaso);
      this.proxPaso += paso; this.paso++;
    }
    while (this.proxLatido < hasta) {
      const t = this.t;
      if (t > 0.1) this._latido(this.proxLatido, t);
      this.proxLatido += BEAT - 0.5 * Math.max(0, t);   // el latido se acelera con la tensión
    }
  }

  _paso(en) {
    const n = this.paso, acorde = Math.floor(n / PASOS_POR_ACORDE) % ACORDES.length;
    if (n % PASOS_POR_ACORDE === 0) this._acorde(en, acorde);
    // Nota suelta de campana: poco frecuente, algo más con tensión
    const prob = 0.2 + 0.18 * this.t;
    if (n % 2 === 1 && this.azar() < prob) {
      this.ultima = elegirNota(acorde, this.ultima, this.azar);
      this._campana(en, mtof(this.ultima), 0.05 + 0.03 * this.azar());
    }
    // Filtro de los acordes: más abierto = más tensión
    this.filtroPad.frequency.setTargetAtTime(650 + 1700 * this.t, en, 0.5);
  }

  _acorde(en, i) {
    const c = this.ctx, a = ACORDES[i], dur = PASOS_POR_ACORDE * BEAT / 2;
    const notas = [...a.notas];
    if (this.t > 0.6) notas.push(56);   // La♭: un trítono que raspa cuando la tensión es alta
    this.zumbidoA.frequency.setTargetAtTime(mtof(a.grave), en, 1.2);
    this.zumbidoB.frequency.setTargetAtTime(mtof(a.grave) * 1.004, en, 1.2);
    for (const m of notas) {
      for (const desafine of [-7, 7]) {
        const o = c.createOscillator(), g = c.createGain();
        o.type = 'triangle'; o.frequency.value = mtof(m); o.detune.value = desafine;
        g.gain.setValueAtTime(0.0001, en);
        g.gain.linearRampToValueAtTime(0.028, en + 2.6);
        g.gain.setValueAtTime(0.028, en + dur - 0.3);
        g.gain.linearRampToValueAtTime(0.0001, en + dur + 3);
        o.connect(g); g.connect(this.filtroPad);
        o.start(en); o.stop(en + dur + 3.1);
      }
    }
  }

  _campana(en, f, vol) {
    const c = this.ctx;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, en);
    g.gain.exponentialRampToValueAtTime(vol, en + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, en + 2.4);
    const o1 = c.createOscillator(); o1.type = 'sine'; o1.frequency.value = f;
    const o2 = c.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f * 2.01;
    const g2 = c.createGain(); g2.gain.value = 0.25;
    o1.connect(g); o2.connect(g2); g2.connect(g);
    let salida = g;
    if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = (this.azar() * 2 - 1) * 0.7; g.connect(p); salida = p; }
    salida.connect(this.bus); salida.connect(this.envio);
    o1.start(en); o2.start(en); o1.stop(en + 2.5); o2.stop(en + 2.5);
  }

  // Latido grave: «lub-dub»
  _latido(en, t) {
    const c = this.ctx;
    for (const [d, v] of [[0, 0.34], [0.27, 0.22]]) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(70, en + d);
      o.frequency.exponentialRampToValueAtTime(38, en + d + 0.16);
      g.gain.setValueAtTime(0.0001, en + d);
      g.gain.exponentialRampToValueAtTime(v * t, en + d + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, en + d + 0.2);
      o.connect(g); g.connect(this.bus);
      o.start(en + d); o.stop(en + d + 0.25);
    }
  }
}

/* ---------- Instancia de la aplicación ---------- */
const m = new Musica();
let pausadaPorOcultar = false;

export const musica = {
  get activa() { return activa; },
  alternar() {
    activa = !activa;
    try { localStorage.setItem('sf-musica', activa ? '1' : '0'); } catch { /* ignorar */ }
    if (activa) m.arrancar(); else m.detener(0.6);
    return activa;
  },
  arrancar() { m.arrancar(); },            // debe llamarse dentro de un gesto del usuario (política de autoplay)
  tension(v) { m.tension(v); },
  get info() { return { corriendo: m.corriendo, estado: m.ctx?.state ?? null, tension: +m.t.toFixed(2), objetivo: +m.tObjetivo.toFixed(2) }; },
  ocultar() { if (m.corriendo) { m.ctx.suspend?.().catch(() => {}); pausadaPorOcultar = true; } },
  mostrar() { if (pausadaPorOcultar && m.ctx) { m.ctx.resume?.().catch(() => {}); pausadaPorOcultar = false; } }
};
