// Sombras Finitas — arranque, navegación y orquestación de pantallas.
import { $, $$, h, vaciar } from './ui/dom.js';
import { sonido } from './ui/sonido.js';
import { musica } from './ui/musica.js';
import { Almacen } from './datos/almacen.js';
import { Nivel, NOMBRES_RETO } from './juego/nivel.js';
import { Cuaderno } from './cuaderno/cuaderno.js';
import { JuegoUI } from './ui/juegoUI.js';
import { CuadernoUI } from './ui/cuadernoUI.js';
import { DiagnosticoUI } from './ui/diagnosticoUI.js';
import { dibujarIcono } from './ui/vistaMapa.js';

const ctx = {
  almacen: null,
  datos: null,
  nivel: null,
  cuaderno: null,
  diagramaOk: false,
  estadoPares: {},
  pantalla: 'inicio',
  superado: false
};

/* ---------- Utilidades de interfaz ---------- */
export function anunciar(msg) { $('#anuncio').textContent = ''; setTimeout(() => { $('#anuncio').textContent = msg; }, 30); }

function toast(msg, ms = 2600) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast.id); toast.id = setTimeout(() => { t.hidden = true; }, ms);
  anunciar(msg);
}

let focoPrevio = null;
function modal({ titulo, cuerpo = [], acciones = [], clase = '' }) {
  focoPrevio = document.activeElement;
  $('#modal-titulo').textContent = titulo;
  const hoja = $('.modal-hoja');
  hoja.className = 'modal-hoja ' + clase;
  const c = vaciar($('#modal-cuerpo'));
  for (const parte of [].concat(cuerpo)) c.append(typeof parte === 'string' ? h('p', { texto: parte }) : parte);
  const a = vaciar($('#modal-acciones'));
  for (const ac of acciones) {
    a.append(h('button', {
      type: 'button', class: 'btn' + (ac.primario ? ' btn-primario' : ''), texto: ac.texto,
      onclick: () => { cerrarModal(); ac.onclick?.(); }
    }));
  }
  $('#modal').hidden = false;
  $('button', a)?.focus();
  anunciar(titulo);
}
function cerrarModal() { $('#modal').hidden = true; focoPrevio?.focus?.(); }
const modalAbierto = () => !$('#modal').hidden;

document.addEventListener('keydown', e => {
  if (!modalAbierto()) return;
  if (e.key === 'Escape') { e.stopPropagation(); cerrarModal(); }
  if (e.key === 'Tab') { // trampa de foco
    const bs = $$('#modal-acciones button');
    if (!bs.length) return;
    const i = bs.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); bs.at(-1).focus(); }
    else if (!e.shiftKey && i === bs.length - 1) { e.preventDefault(); bs[0].focus(); }
  }
}, true);

function ir(nombre) {
  if (ctx.pantalla === 'juego' && nombre !== 'juego') juego.salir();
  $$('.pantalla').forEach(p => p.classList.toggle('activa', p.id === 'pantalla-' + nombre));
  ctx.pantalla = nombre;
  if (nombre === 'niveles') renderNiveles();
  if (nombre === 'diagnostico') diag.abrir();
  if (nombre === 'inicio') renderInicio();
  if (nombre === 'juego') juego.activar();
  if (nombre === 'cuaderno') cuadernoUI.ajustar();
  const foco = $(`#pantalla-${nombre} h1, #pantalla-${nombre} h2`);
  foco?.setAttribute('tabindex', '-1');
}

function actualizarSonido() {
  const b = $('#btn-sonido');
  const on = sonido.activo;
  b.setAttribute('aria-pressed', String(on));
  b.setAttribute('aria-label', on ? 'Sonido activado' : 'Sonido desactivado');
  b.replaceChildren(svgSonido(on));
}
function actualizarMusica() {
  const b = $('#btn-musica');
  const on = musica.activa;
  b.setAttribute('aria-pressed', String(on));
  b.setAttribute('aria-label', on ? 'Música activada' : 'Música desactivada');
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', '24'); s.setAttribute('height', '24');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', 'M9 18V6l10-2v12M9 18a3 3 0 11-6 0 3 3 0 016 0zM19 16a3 3 0 11-6 0 3 3 0 016 0z');
  s.append(p);
  if (!on) { const x = document.createElementNS('http://www.w3.org/2000/svg', 'path'); x.setAttribute('d', 'M3 21L21 3'); s.append(x); }
  b.replaceChildren(s);
}
function svgSonido(on) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', '24'); s.setAttribute('height', '24');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', on ? 'M4 9v6h4l5 4V5L8 9H4zM16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11' : 'M4 9v6h4l5 4V5L8 9H4zM17 9l4 6M21 9l-4 6');
  s.append(p); return s;
}

/* ---------- Inicio y niveles ---------- */
async function renderInicio() {
  const niveles = await ctx.almacen.niveles();
  const siguiente = niveles.find(n => n.estado === 'en_curso') ?? niveles.at(-1);
  const todos = niveles.every(n => n.estado === 'superado');
  $('#btn-jugar').textContent = todos ? 'Rejugar' : siguiente.numero === 1 && siguiente.intentos === 0 ? 'Jugar' : `Continuar · Nivel ${siguiente.numero}`;
  $('#btn-jugar').dataset.nivel = String(todos ? 1 : siguiente.numero);
  $('#codigo-perfil').textContent = `Perfil anónimo ${ctx.almacen.perfil.codigo_anonimo}`;
}

async function renderNiveles() {
  const lista = vaciar($('#lista-niveles'));
  const niveles = await ctx.almacen.niveles();
  for (const n of niveles) {
    const bloqueado = n.estado === 'bloqueado';
    const txt = { bloqueado: 'Bloqueado', en_curso: 'En curso', superado: 'Superado' }[n.estado];
    const datos = ctx.datos.niveles.find(x => x.numero === n.numero);
    lista.append(h('li', {}, h('button', {
      type: 'button', class: `nivel-card ${n.estado}`, disabled: bloqueado,
      'aria-label': `Nivel ${n.numero}: ${n.nombre}. ${NOMBRES_RETO[n.tipo_reto]}. ${txt}.`,
      onclick: () => comenzarNivel(n.numero)
    },
    h('span', { class: 'nivel-num', texto: n.estado === 'superado' ? '✓' : String(n.numero) }),
    h('span', {}, h('div', { class: 'nivel-nombre', texto: n.nombre }),
      h('div', { class: 'nivel-meta', texto: `${NOMBRES_RETO[n.tipo_reto]} · Σ = {${datos.alfabeto.join(', ')}}${n.intentos ? ` · ${n.intentos} intento${n.intentos > 1 ? 's' : ''}` : ''}` }),
      h('div', { class: 'nivel-meta', texto: datos.concepto })),
    h('span', { class: 'etiqueta ' + n.estado, texto: txt }))));
  }
}

/* ---------- Flujo de un nivel ---------- */
async function comenzarNivel(numero, { intro = true } = {}) {
  const datos = ctx.datos.niveles.find(n => n.numero === numero);
  ctx.nivel = new Nivel(datos);
  const guardado = await ctx.almacen.cargarDibujo(numero);
  ctx.cuaderno = Cuaderno.desde(guardado, ctx.nivel.alfabeto);
  const niveles = await ctx.almacen.niveles();
  ctx.superado = niveles.find(n => n.numero === numero).estado === 'superado';
  ctx.estadoPares = await ctx.almacen.cargarPares(numero);
  // Re-valida en silencio el diagrama guardado: si ya era correcto, la salida arranca abierta.
  ctx.diagramaOk = ctx.superado || diagramaCorrecto();
  juego.iniciar(ctx.nivel, { salidaAbierta: salidaDisponible() });
  ir('juego');
  if (intro) {
    modal({
      titulo: `Nivel ${numero} · ${datos.nombre}`, clase: '',
      cuerpo: [datos.historia, h('p', {}, h('b', { texto: 'Reto: ' }), NOMBRES_RETO[datos.tipo_reto], ` · Σ = {${datos.alfabeto.join(', ')}}`)],
      acciones: [{ texto: 'Entrar', primario: true }, { texto: 'Cómo jugar', onclick: () => ir('ayuda') }]
    });
  }
}

function diagramaCorrecto() {
  try { return ctx.cuaderno.validar(ctx.nivel.automataObjetivo, { exigirMinimo: ctx.nivel.tipo === 'minimizacion' }).estado === 'equivalente'; }
  catch { return false; }
}

function paresCompletos() {
  const n = ctx.nivel;
  return n.tipo !== 'equivalencia' || n.pares.every((_, i) => ctx.estadoPares[i]);
}
const salidaDisponible = () => ctx.diagramaOk && paresCompletos();

function evaluarSalida() {
  const abierta = salidaDisponible();
  const p = juego.partida;
  if (p && abierta && !p.salidaAbierta) {
    p.salidaAbierta = true;
    sonido.valido();
    toast('🔓 La salida se ha abierto. ¡Llega hasta ella!');
  }
  return abierta;
}

function abrirCuaderno() {
  if (!ctx.nivel) return;
  cuadernoUI.abrir(ctx.nivel, ctx.cuaderno, ctx.estadoPares);
  ir('cuaderno');
}

async function alValidar(resultado, serializado) {
  await ctx.almacen.guardarDibujo(ctx.nivel.numero, serializado);
  if (resultado.estado !== 'incompleto') await ctx.almacen.registrarValidacion(ctx.nivel.numero, resultado.estado === 'equivalente');
  ctx.diagramaOk = resultado.estado === 'equivalente';
  if (ctx.diagramaOk) {
    const abierta = evaluarSalida();
    if (!abierta) toast('Diagrama correcto. Resuelve ahora el reto de equivalencia.');
  }
}

function alResolverPares(pares) {
  ctx.estadoPares = pares;
  ctx.almacen.guardarPares(ctx.nivel.numero, pares).catch(() => { /* ignorar */ });
  if (ctx.diagramaOk) evaluarSalida();
  else if (paresCompletos()) toast('Reto resuelto. Falta validar tu diagrama.');
}

async function alGanar(partida) {
  sonido.victoria();
  const n = ctx.nivel;
  await ctx.almacen.marcarSuperado(n.numero);
  const sig = ctx.datos.niveles.find(x => x.numero === n.numero + 1);
  const ultimoPrincipal = !n.bonus && (!sig || sig.bonus);
  const cuerpo = [`Cruzaste en ${partida.pasos} pasos.`, `Concepto dominado: ${n.concepto}`];
  if (n.costoSenal) {   // cada señal fue un turno: se compara tu cadena con la más corta posible
    const mejor = n.mejorCadena();
    const usadas = partida.senalesJugador;   // la campana no cuenta como señal tuya
    if (mejor !== null) {
      cuerpo.push(usadas <= mejor.length
        ? `¡Cadena óptima! Usaste ${usadas} señal${usadas === 1 ? '' : 'es'} en tu cruce.`
        : `Usaste ${usadas} señales en tu cruce; la cadena más corta que duerme a todos los guardias tiene ${mejor.length}: «${mejor}». ¿Puedes lograrla?`);
    }
  }
  const menu = { texto: 'Menú de niveles', onclick: () => ir('niveles') };
  const repetir = { texto: 'Repetir nivel', onclick: () => comenzarNivel(n.numero) };
  let acciones, titulo = 'Nivel superado';
  if (n.bonus) {
    titulo = '¡Bonus superado!';
    cuerpo.push(`Tu ruta escribió «${partida.senales}»: con el número de «a» adecuado el guardia siguió dormido al pasar.`);
    acciones = [{ ...menu, primario: true }, { texto: 'Responder diagnóstico final', onclick: () => ir('diagnostico') }, repetir];
  } else if (ultimoPrincipal) {
    titulo = '¡Juego completado!';
    cuerpo.push('¡Completaste Sombras Finitas! Ya dominas la deducción, la minimización y la equivalencia de AFD.');
    acciones = [{ texto: 'Responder diagnóstico final', primario: true, onclick: () => ir('diagnostico') }];
    if (sig) { cuerpo.push('Hay un nivel bonus: aquí el camino que recorres es la cadena.'); acciones.push({ texto: 'Nivel bonus', onclick: () => comenzarNivel(sig.numero) }); }
    acciones.push(menu, repetir);
  } else {
    acciones = [{ texto: `Nivel ${n.numero + 1}`, primario: true, onclick: () => comenzarNivel(n.numero + 1) }, repetir, menu];
  }
  modal({ titulo, clase: 'victoria', cuerpo, acciones });
}

async function alDescubrir(partida) {
  sonido.descubierto();
  await ctx.almacen.sumarIntento(ctx.nivel.numero);
  modal({
    titulo: 'Te descubrieron', clase: 'derrota',
    cuerpo: [`El guardia ${partida.causa} estaba despierto y te detectó. Los guardias despiertos ven a 2 casillas; las sombras te ocultan y los dormidos no detectan.`,
      'Vuelves a la entrada y los guardias a q₀. Tu cuaderno se conserva.'],
    acciones: [{ texto: 'Reintentar', primario: true, onclick: () => { partida.reaparecer(); juego.renderBitacora(); juego.vista.anim = null; } },
      { texto: 'Abrir cuaderno', onclick: () => { partida.reaparecer(); juego.renderBitacora(); abrirCuaderno(); } },
      { texto: 'Menú de niveles', onclick: () => ir('niveles') }]
  });
}

/* ---------- Instancias de pantallas ---------- */
Object.assign(ctx, { ir, modal, modalAbierto, anunciar, toast, actualizarSonido, actualizarMusica, abrirCuaderno, alGanar, alDescubrir, alValidar, alResolverPares,
  guardarDibujo: (ser) => ctx.almacen.guardarDibujo(ctx.nivel.numero, ser) });
function probarEnCuaderno(cadena) {
  abrirCuaderno();
  $('#simular-entrada').value = cadena;
  cuadernoUI.simular(cadena);
}
ctx.probarEnCuaderno = probarEnCuaderno;
const juego = new JuegoUI(ctx);
const cuadernoUI = new CuadernoUI(ctx);
const diag = new DiagnosticoUI(ctx);

/* ---------- Arranque ---------- */
function conexion() {
  const chip = $('#chip-conexion');
  const en = navigator.onLine;
  const listo = !!navigator.serviceWorker?.controller;
  chip.textContent = !en ? 'Sin conexión · jugando offline' : listo ? 'Listo para jugar sin conexión' : 'En línea';
  chip.classList.toggle('ok', !en || listo);
}

function leyenda() {
  const l = $('#leyenda');
  const items = [['.', 'Suelo'], ['#', 'Pared'], ['s', 'Sombra: te oculta'], ['E', 'Salida (sellada hasta validar)']];
  for (const [t, n] of items) { const c = h('canvas', { width: '64', height: '64', 'aria-hidden': 'true' }); dibujarIcono(c, t); l.append(h('div', {}, c, n)); }
}

async function registrarSW() {
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  try {
    const teniaControl = !!navigator.serviceWorker.controller;
    const reg = await navigator.serviceWorker.register('sw.js');
    let recargando = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      conexion();
      // Una versión nueva tomó el control: se recarga una vez para usar los archivos actualizados.
      if (teniaControl && !recargando) { recargando = true; toast('Actualizando a la versión nueva…'); setTimeout(() => location.reload(), 700); }
    });
    navigator.serviceWorker.ready.then(conexion);
    // Buscar versiones nuevas al abrir y cada vez que se vuelve a la app.
    reg.update().catch(() => {});
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
  } catch (e) { console.warn('SW no registrado', e); }
}

async function arrancar() {
  try {
    ctx.datos = await (await fetch('data/niveles.json')).json();
    ctx.almacen = await Almacen.abrir();
    await ctx.almacen.inicializar(ctx.datos);
  } catch (e) {
    console.error(e);
    modal({ titulo: 'No se pudo iniciar', cuerpo: ['Ocurrió un error al cargar los datos del juego. Recarga la página.'], acciones: [{ texto: 'Recargar', primario: true, onclick: () => location.reload() }] });
    return;
  }
  $$('[data-ir]').forEach(b => b.addEventListener('click', () => ir(b.dataset.ir)));
  $('#btn-jugar').addEventListener('click', e => comenzarNivel(Number(e.currentTarget.dataset.nivel || 1)));
  $('#btn-niveles').addEventListener('click', () => ir('niveles'));
  $('#btn-diagnostico').addEventListener('click', () => ir('diagnostico'));
  $('#btn-ayuda').addEventListener('click', () => ir('ayuda'));
  $('#btn-sonido').addEventListener('click', () => { sonido.alternar(); actualizarSonido(); });
  $('#btn-musica').addEventListener('click', () => { musica.alternar(); actualizarMusica(); });
  const vol = $('#vol-musica');
  vol.value = String(Math.round(musica.volumen * 100));
  vol.addEventListener('input', () => { musica.volumen = vol.value / 100; });
  // La música arranca con el primer toque (los navegadores no permiten sonido antes de un gesto del usuario).
  const iniciarMusica = () => musica.arrancar();
  document.addEventListener('pointerdown', iniciarMusica, { once: true });
  document.addEventListener('keydown', iniciarMusica, { once: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) musica.ocultar(); else musica.mostrar(); });
  $('#btn-cuaderno-inicio').addEventListener('click', async () => {
    const niveles = await ctx.almacen.niveles();
    const n = (niveles.find(x => x.estado === 'en_curso') ?? niveles[0]).numero;
    await comenzarNivel(n, { intro: false }); abrirCuaderno();
  });
  $('#btn-cuaderno-volver').addEventListener('click', () => { ir('juego'); evaluarSalida(); });
  actualizarSonido(); actualizarMusica(); leyenda();
  addEventListener('online', conexion); addEventListener('offline', conexion);
  conexion();
  await renderInicio();
  registrarSW();
  ctx.ui = { juego, cuadernoUI, diag };
  globalThis.__sf = ctx; // depuración y pruebas de extremo a extremo
}

arrancar();
