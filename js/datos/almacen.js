// Almacen: único punto de acceso a los datos locales (RF08, RNF04).
// Implementa el esquema relacional de la Tabla X sobre IndexedDB (un object store por tabla,
// llave autoincremental y un índice por llave foránea). Si IndexedDB no está disponible
// (navegación privada, pruebas en Node) usa un respaldo en memoria con la misma interfaz.
// La integridad referencial (IndexedDB no la impone) la mantiene esta clase.

const NOMBRE_BD = 'sombras-finitas';
const VERSION_BD = 1;

export const ESQUEMA = {
  perfil: { pk: 'id_perfil', idx: [{ n: 'codigo_anonimo', k: 'codigo_anonimo', unico: true }] },
  nivel: { pk: 'id_nivel', idx: [{ n: 'numero', k: 'numero', unico: true }] },
  automata: { pk: 'id_automata', idx: [{ n: 'id_nivel', k: 'id_nivel' }, { n: 'id_perfil', k: 'id_perfil' }] },
  estado: { pk: 'id_estado', idx: [{ n: 'id_automata', k: 'id_automata' }] },
  transicion: {
    pk: 'id_transicion',
    idx: [
      { n: 'id_automata', k: 'id_automata' }, { n: 'id_origen', k: 'id_origen' }, { n: 'id_destino', k: 'id_destino' },
      // Determinismo: una transición por (origen, símbolo)
      { n: 'origen_simbolo', k: ['id_origen', 'simbolo'], unico: true }
    ]
  },
  progreso: {
    pk: 'id_progreso',
    idx: [{ n: 'id_perfil', k: 'id_perfil' }, { n: 'id_nivel', k: 'id_nivel' },
      { n: 'perfil_nivel', k: ['id_perfil', 'id_nivel'], unico: true }]
  },
  diagnostico: {
    pk: 'id_diagnostico',
    idx: [{ n: 'id_perfil', k: 'id_perfil' }, { n: 'perfil_tipo', k: ['id_perfil', 'tipo'], unico: true }]
  },
  validacion: { pk: 'id_validacion', idx: [{ n: 'id_automata', k: 'id_automata' }] }
};

const claveDe = (obj, k) => (Array.isArray(k) ? JSON.stringify(k.map(c => obj[c])) : obj[k]);

/* ---------- Respaldo en memoria ---------- */
class BackendMemoria {
  constructor(clave) {
    this.clave = clave;
    this.datos = {};
    this.sig = {};
    for (const t of Object.keys(ESQUEMA)) { this.datos[t] = new Map(); this.sig[t] = 1; }
    try {
      const raw = globalThis.localStorage?.getItem(clave);
      if (raw) {
        const o = JSON.parse(raw);
        for (const t of Object.keys(ESQUEMA)) {
          this.datos[t] = new Map((o.datos[t] ?? []).map(r => [r[ESQUEMA[t].pk], r]));
          this.sig[t] = o.sig[t] ?? 1;
        }
      }
    } catch { /* sin persistencia */ }
  }
  _guardar() {
    try {
      const datos = {};
      for (const t of Object.keys(ESQUEMA)) datos[t] = [...this.datos[t].values()];
      globalThis.localStorage?.setItem(this.clave, JSON.stringify({ datos, sig: this.sig }));
    } catch { /* ignorar */ }
  }
  _unico(t, obj) {
    for (const ix of ESQUEMA[t].idx.filter(i => i.unico)) {
      const v = claveDe(obj, ix.k);
      if (v == null) continue;
      for (const r of this.datos[t].values()) {
        if (r[ESQUEMA[t].pk] !== obj[ESQUEMA[t].pk] && claveDe(r, ix.k) === v) {
          throw new Error(`Restricción de unicidad violada en ${t}.${ix.n}`);
        }
      }
    }
  }
  async add(t, obj) {
    const o = { ...obj };
    o[ESQUEMA[t].pk] = this.sig[t];
    this._unico(t, o);
    this.sig[t]++;
    this.datos[t].set(o[ESQUEMA[t].pk], o);
    this._guardar();
    return o[ESQUEMA[t].pk];
  }
  async put(t, obj) {
    this._unico(t, obj);
    this.datos[t].set(obj[ESQUEMA[t].pk], { ...obj });
    this._guardar();
  }
  async delete(t, id) { this.datos[t].delete(id); this._guardar(); }
  async get(t, id) { const r = this.datos[t].get(id); return r ? { ...r } : undefined; }
  async todos(t) { return [...this.datos[t].values()].map(r => ({ ...r })); }
  async porIndice(t, nombre, valor) {
    const ix = ESQUEMA[t].idx.find(i => i.n === nombre);
    const v = Array.isArray(ix.k) ? JSON.stringify(valor) : valor;
    return [...this.datos[t].values()].filter(r => claveDe(r, ix.k) === v).map(r => ({ ...r }));
  }
  async vaciar() {
    for (const t of Object.keys(ESQUEMA)) { this.datos[t].clear(); this.sig[t] = 1; }
    this._guardar();
  }
  cerrar() {}
}

/* ---------- IndexedDB ---------- */
const prom = req => new Promise((res, rej) => {
  req.onsuccess = () => res(req.result);
  req.onerror = () => rej(req.error);
});

class BackendIDB {
  constructor(db) { this.db = db; }
  static abrir(nombre) {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(nombre, VERSION_BD);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const [t, def] of Object.entries(ESQUEMA)) {
          const os = db.createObjectStore(t, { keyPath: def.pk, autoIncrement: true });
          for (const ix of def.idx) os.createIndex(ix.n, ix.k, { unique: !!ix.unico });
        }
      };
      req.onsuccess = () => resolve(new BackendIDB(req.result));
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('IndexedDB bloqueada'));
    });
  }
  _os(t, modo = 'readonly') { return this.db.transaction(t, modo).objectStore(t); }
  add(t, obj) { const o = { ...obj }; delete o[ESQUEMA[t].pk]; return prom(this._os(t, 'readwrite').add(o)); }
  put(t, obj) { return prom(this._os(t, 'readwrite').put(obj)).then(() => undefined); }
  delete(t, id) { return prom(this._os(t, 'readwrite').delete(id)).then(() => undefined); }
  get(t, id) { return prom(this._os(t).get(id)); }
  todos(t) { return prom(this._os(t).getAll()); }
  porIndice(t, nombre, valor) { return prom(this._os(t).index(nombre).getAll(valor)); }
  async vaciar() {
    for (const t of Object.keys(ESQUEMA)) await prom(this._os(t, 'readwrite').clear());
  }
  cerrar() { this.db.close(); }
}

/* ---------- API de alto nivel ---------- */
export class Almacen {
  constructor(backend, tipo) { this.b = backend; this.tipo = tipo; this.perfil = null; }

  static async abrir({ forzarMemoria = false, nombre = NOMBRE_BD } = {}) {
    if (!forzarMemoria && typeof indexedDB !== 'undefined') {
      try { return new Almacen(await BackendIDB.abrir(nombre), 'indexeddb'); } catch { /* respaldo */ }
    }
    return new Almacen(new BackendMemoria(nombre + '-mem'), 'memoria');
  }

  _codigoAnonimo() {
    const bytes = new Uint8Array(6);
    (globalThis.crypto ?? { getRandomValues: a => a.map(() => Math.floor(Math.random() * 256)) }).getRandomValues(bytes);
    return 'SF-' + [...bytes].map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  }

  // Primera ejecución: perfil anónimo, niveles, AFD ocultos y progreso. Idempotente.
  async inicializar(datosNiveles) {
    let perfiles = await this.b.todos('perfil');
    if (!perfiles.length) {
      const id = await this.b.add('perfil', { codigo_anonimo: this._codigoAnonimo(), creado_en: new Date().toISOString() });
      perfiles = [await this.b.get('perfil', id)];
    }
    this.perfil = perfiles[0];
    const existentes = new Map((await this.b.todos('nivel')).map(n => [n.numero, n]));
    for (const n of datosNiveles.niveles) {
      let fila = existentes.get(n.numero);
      if (!fila) {
        const id = await this.b.add('nivel', {
          numero: n.numero, nombre: n.nombre, tipo_reto: n.tipo_reto, alfabeto: n.alfabeto.join('')
        });
        fila = await this.b.get('nivel', id);
        await this._guardarOculto(fila.id_nivel, n);
      }
      const prog = await this.b.porIndice('progreso', 'perfil_nivel', [this.perfil.id_perfil, fila.id_nivel]);
      if (!prog.length) {
        await this.b.add('progreso', {
          id_perfil: this.perfil.id_perfil, id_nivel: fila.id_nivel,
          estado: n.numero === 1 ? 'en_curso' : 'bloqueado', intentos: 0, fecha_superado: null, pares_resueltos: '{}'
        });
      }
    }
    return this.perfil;
  }

  async _guardarOculto(idNivel, n) {
    for (const [clave, a] of Object.entries(n.automatas)) {
      const idA = await this.b.add('automata', {
        id_nivel: idNivel, id_perfil: null, tipo: 'oculto', clave, actualizado_en: new Date().toISOString()
      });
      const ids = {};
      for (const q of a.estados) {
        ids[q] = await this.b.add('estado', {
          id_automata: idA, etiqueta: q, es_inicial: q === a.inicial, es_aceptacion: a.aceptacion.includes(q), pos_x: 0, pos_y: 0
        });
      }
      for (const q of a.estados) for (const s of n.alfabeto) {
        await this.b.add('transicion', { id_automata: idA, id_origen: ids[q], id_destino: ids[a.delta[q][s]], simbolo: s });
      }
    }
  }

  async _nivelPorNumero(numero) {
    const f = (await this.b.porIndice('nivel', 'numero', numero))[0];
    if (!f) throw new Error('Nivel inexistente: ' + numero);
    return f;
  }

  async niveles() {
    const filas = (await this.b.todos('nivel')).sort((a, b) => a.numero - b.numero);
    const prog = await this.b.porIndice('progreso', 'id_perfil', this.perfil.id_perfil);
    return filas.map(n => {
      const p = prog.find(x => x.id_nivel === n.id_nivel);
      return { ...n, estado: p?.estado ?? 'bloqueado', intentos: p?.intentos ?? 0 };
    });
  }

  async _progreso(idNivel) {
    return (await this.b.porIndice('progreso', 'perfil_nivel', [this.perfil.id_perfil, idNivel]))[0];
  }

  async sumarIntento(numero) {
    const n = await this._nivelPorNumero(numero);
    const p = await this._progreso(n.id_nivel);
    p.intentos++;
    if (p.estado === 'bloqueado') p.estado = 'en_curso';
    await this.b.put('progreso', p);
  }

  async marcarSuperado(numero) {
    const n = await this._nivelPorNumero(numero);
    const p = await this._progreso(n.id_nivel);
    if (p.estado !== 'superado') { p.estado = 'superado'; p.fecha_superado = new Date().toISOString(); await this.b.put('progreso', p); }
    const sig = (await this.b.porIndice('nivel', 'numero', numero + 1))[0];
    if (sig) {
      const ps = await this._progreso(sig.id_nivel);
      if (ps && ps.estado === 'bloqueado') { ps.estado = 'en_curso'; await this.b.put('progreso', ps); }
    }
  }

  // Respuestas del reto de equivalencia (nivel 4): se guardan en la fila de progreso como JSON.
  async guardarPares(numero, pares) {
    const n = await this._nivelPorNumero(numero);
    const p = await this._progreso(n.id_nivel);
    p.pares_resueltos = JSON.stringify(pares ?? {});
    await this.b.put('progreso', p);
  }

  async cargarPares(numero) {
    const n = await this._nivelPorNumero(numero);
    const p = await this._progreso(n.id_nivel);
    try { return JSON.parse(p?.pares_resueltos ?? '{}'); } catch { return {}; }
  }

  // Solo para pruebas: deja todos los niveles bloqueados como «en curso» (no marca ninguno como superado).
  async desbloquearTodo() {
    const prog = await this.b.porIndice('progreso', 'id_perfil', this.perfil.id_perfil);
    for (const p of prog) if (p.estado === 'bloqueado') { p.estado = 'en_curso'; await this.b.put('progreso', p); }
  }

  async _dibujoDe(idNivel) {
    return (await this.b.porIndice('automata', 'id_nivel', idNivel))
      .find(a => a.tipo === 'dibujado' && a.id_perfil === this.perfil.id_perfil);
  }

  // Borra un autómata con sus estados, transiciones y validaciones (integridad referencial).
  async borrarAutomata(idA) {
    for (const t of await this.b.porIndice('transicion', 'id_automata', idA)) await this.b.delete('transicion', t.id_transicion);
    for (const e of await this.b.porIndice('estado', 'id_automata', idA)) await this.b.delete('estado', e.id_estado);
    for (const v of await this.b.porIndice('validacion', 'id_automata', idA)) await this.b.delete('validacion', v.id_validacion);
    await this.b.delete('automata', idA);
  }

  async guardarDibujo(numero, ser) {
    const n = await this._nivelPorNumero(numero);
    const previo = await this._dibujoDe(n.id_nivel);
    let validaciones = [];
    if (previo) {
      validaciones = await this.b.porIndice('validacion', 'id_automata', previo.id_automata);
      await this.borrarAutomata(previo.id_automata);
    }
    const idA = await this.b.add('automata', {
      id_nivel: n.id_nivel, id_perfil: this.perfil.id_perfil, tipo: 'dibujado', clave: null, actualizado_en: new Date().toISOString()
    });
    const ids = new Map();
    for (const e of ser.estados) {
      ids.set(e.id, await this.b.add('estado', {
        id_automata: idA, etiqueta: e.etiqueta, es_inicial: e.inicial, es_aceptacion: e.aceptacion, pos_x: e.x, pos_y: e.y
      }));
    }
    for (const t of ser.transiciones) {
      await this.b.add('transicion', { id_automata: idA, id_origen: ids.get(t.origen), id_destino: ids.get(t.destino), simbolo: t.simbolo });
    }
    for (const v of validaciones) await this.b.add('validacion', { id_automata: idA, equivalente: v.equivalente, fecha: v.fecha });
    return idA;
  }

  async cargarDibujo(numero) {
    const n = await this._nivelPorNumero(numero);
    const a = await this._dibujoDe(n.id_nivel);
    if (!a) return null;
    const estados = (await this.b.porIndice('estado', 'id_automata', a.id_automata)).map(e => ({
      id: e.id_estado, etiqueta: e.etiqueta, x: e.pos_x, y: e.pos_y, inicial: e.es_inicial, aceptacion: e.es_aceptacion
    }));
    const transiciones = (await this.b.porIndice('transicion', 'id_automata', a.id_automata)).map(t => ({
      origen: t.id_origen, destino: t.id_destino, simbolo: t.simbolo
    }));
    return { estados, transiciones };
  }

  async registrarValidacion(numero, equivalente) {
    const n = await this._nivelPorNumero(numero);
    const a = await this._dibujoDe(n.id_nivel);
    if (!a) return null;
    return this.b.add('validacion', { id_automata: a.id_automata, equivalente: !!equivalente, fecha: new Date().toISOString() });
  }

  async validaciones(numero) {
    const n = await this._nivelPorNumero(numero);
    const a = await this._dibujoDe(n.id_nivel);
    return a ? this.b.porIndice('validacion', 'id_automata', a.id_automata) : [];
  }

  async guardarDiagnostico(tipo, puntaje) {
    const previo = (await this.b.porIndice('diagnostico', 'perfil_tipo', [this.perfil.id_perfil, tipo]))[0];
    const fila = { id_perfil: this.perfil.id_perfil, tipo, puntaje, fecha: new Date().toISOString() };
    if (previo) await this.b.put('diagnostico', { ...fila, id_diagnostico: previo.id_diagnostico });
    else await this.b.add('diagnostico', fila);
  }

  async diagnosticos() {
    const filas = await this.b.porIndice('diagnostico', 'id_perfil', this.perfil.id_perfil);
    return { inicial: filas.find(f => f.tipo === 'inicial') ?? null, final: filas.find(f => f.tipo === 'final') ?? null };
  }

  async reiniciarTodo(datosNiveles) {
    await this.b.vaciar();
    return this.inicializar(datosNiveles);
  }

  cerrar() { this.b.cerrar(); }
}
