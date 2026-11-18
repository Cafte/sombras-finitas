// Retroalimentación sonora sintetizada con Web Audio (sin archivos externos: funciona sin conexión).
let ctx = null;
let activo = true;
try { activo = localStorage.getItem('sf-sonido') !== '0'; } catch { /* sin almacenamiento */ }

function audio() {
  if (!activo) return null;
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) { try { ctx = new AC(); } catch { return null; } }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tono(freq, dur = 0.12, { tipo = 'sine', vol = 0.06, en = 0, hasta = null } = {}) {
  const c = audio();
  if (!c) return;
  const t0 = c.currentTime + en;
  const o = c.createOscillator(), g = c.createGain();
  o.type = tipo;
  o.frequency.setValueAtTime(freq, t0);
  if (hasta) o.frequency.exponentialRampToValueAtTime(hasta, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

export const sonido = {
  get activo() { return activo; },
  alternar() {
    activo = !activo;
    try { localStorage.setItem('sf-sonido', activo ? '1' : '0'); } catch { /* ignorar */ }
    if (activo) tono(660, 0.08);
    return activo;
  },
  paso() { tono(180, 0.05, { tipo: 'triangle', vol: 0.035 }); },
  choque() { tono(90, 0.08, { tipo: 'square', vol: 0.03 }); },
  senal(i = 0) { tono([523, 659, 784][i % 3], 0.14, { tipo: 'triangle', vol: 0.07 }); },
  dormir() { tono(440, 0.3, { vol: 0.05, hasta: 220 }); },
  despertar() { tono(300, 0.18, { tipo: 'sawtooth', vol: 0.04, hasta: 520 }); },
  reinicio() { tono(330, 0.1); tono(247, 0.14, { en: 0.1 }); },
  descubierto() { tono(220, 0.25, { tipo: 'sawtooth', vol: 0.07, hasta: 110 }); tono(110, 0.4, { tipo: 'square', vol: 0.05, en: 0.2 }); },
  valido() { [523, 659, 784, 1047].forEach((f, i) => tono(f, 0.16, { en: i * 0.09, tipo: 'triangle', vol: 0.07 })); },
  invalido() { tono(200, 0.22, { tipo: 'square', vol: 0.05, hasta: 150 }); },
  victoria() { [392, 523, 659, 784, 1047].forEach((f, i) => tono(f, 0.22, { en: i * 0.11, tipo: 'triangle', vol: 0.08 })); },
  toque() { tono(700, 0.04, { vol: 0.03 }); }
};
