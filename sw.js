// Peil service worker: offline play + automatic updates.
// Bump VERSION on every release so phones pick up the new files.
const VERSION = 'peil-v50';
const FILES = [
  './', 'index.html', 'manifest.webmanifest',
  'js/config.js','js/scenarios.js','js/random.js', 'js/playtest.js','js/story.js','js/util.js','js/glossary.js','js/reveal.js','js/title.js','js/audio.js','js/world.js','js/sim.js','js/freight.js','js/build.js',
  'js/render.js','js/paint.js','js/ui.js','js/input.js','js/save.js','js/steps.js','js/film.js','js/main.js',
  'img/leren.jpg','img/kleine.jpg','img/veen.jpg','img/diep.jpg','img/groot.jpg','img/meer.jpg','img/afsluit.jpg','img/storm.jpg','img/delta.jpg',
  'icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png',
  'fonts/im-fell-english-latin-400-normal.woff2','fonts/im-fell-english-latin-400-italic.woff2','fonts/alegreya-sans-latin-500-normal.woff2','fonts/alegreya-sans-latin-800-normal.woff2'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, {ignoreSearch:true}).then(hit => hit || fetch(e.request)));
});
