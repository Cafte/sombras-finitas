// Service Worker: caché de la aplicación y funcionamiento sin conexión (RNF01).
// Al publicar una nueva versión, cambiar VERSION para que los celulares descarguen los archivos actualizados.
const VERSION = 'v9';
const CACHE = 'sombras-finitas-' + VERSION;
const ARCHIVOS = [
  './', './index.html', './manifest.webmanifest', './css/estilos.css', './data/niveles.json',
  './js/app.js',
  './js/motor/automata.js', './js/motor/equivalencia.js', './js/motor/minimizador.js',
  './js/juego/guardia.js', './js/juego/prediccion.js', './js/juego/nivel.js', './js/juego/mapa.js', './js/juego/diagnostico.js',
  './js/cuaderno/cuaderno.js', './js/datos/almacen.js',
  './js/ui/dom.js', './js/ui/sonido.js', './js/ui/vistaMapa.js', './js/ui/juegoUI.js', './js/ui/cuadernoUI.js', './js/ui/diagnosticoUI.js',
  './icons/icono.svg', './icons/icono-192.png', './icons/icono-512.png', './icons/icono-maskable-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(claves => Promise.all(claves.filter(k => k.startsWith('sombras-finitas-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Caché primero; si no está, red (y se guarda). Sin red, navegación cae a index.html.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(resp => {
      if (resp.ok) { const copia = resp.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); }
      return resp;
    }).catch(() => (e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  );
});
