// sw.js — Service worker: la aplicación entera cacheada, para poder jugar sin
// conexión y para que abra al instante.
//
// Encaja bien aquí porque la aplicación no tiene dependencias ni compilación:
// son nueve ficheros estáticos y no cambian mientras se juega.
//
// OJO: un service worker NO funciona desde file://, solo por https (o
// localhost). Abriendo index.html a pelo la aplicación sigue funcionando
// igual; simplemente no se instala nada. En https://salasgar.github.io/... sí.
//
// PARA PUBLICAR UN CAMBIO HAY QUE SUBIR VERSION. Si no, los navegadores que ya
// tengan la versión anterior seguirán sirviendo los ficheros viejos de su
// caché y no verán la actualización.
const VERSION = 'ajedrez-triangular-v5';

const FICHEROS = [
  './',
  './index.html',
  './style.css',
  './geometry.js',
  './variants.js',
  './rules.js',
  './ai.js',
  './ai-async.js',
  './saveload.js',
  './script.js',
  './editor.html',
  './editor.js',
  './problemas.js',
  './problemas-ui.js',
  './problemas.css',
  './problema-imagen.js',
  './crear-problema.js',
  './manifest.webmanifest',
  './icono.svg',
  './icono-192.png',
  './icono-512.png',
];

self.addEventListener('install', (e) => {
  // addAll falla entera si un solo fichero falla, que es lo que se quiere:
  // más vale no instalar nada que instalar media aplicación
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FICHEROS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  // fuera las cachés de versiones anteriores
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  // Solo las peticiones GET de la propia aplicación. Y nada de interceptar
  // otros esquemas: el worker de la IA se construye desde un blob: y no debe
  // pasar por aquí.
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  // Primero la caché (la aplicación es estática y así abre sin red), y si no
  // está, la red; lo que llegue de la red se guarda para la próxima vez.
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request)
    .then(res => {
      if (res.ok && res.type === 'basic') {
        const copia = res.clone();
        caches.open(VERSION).then(c => c.put(e.request, copia));
      }
      return res;
    })
    .catch(() => caches.match('./index.html'))));   // sin red y sin caché
});
