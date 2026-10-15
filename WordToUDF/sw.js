/* Offline cache for the web-app (PWA) mode. Not used by the Chrome extension.
 * Cache-first for the app's own files only; nothing is fetched from or sent
 * to any other origin. Bump VERSION with every release so updates install. */
'use strict';
const VERSION = 'wordtoudf-1.12.0';
const FILES = ['./', 'index.html', 'workspace.html', 'templates.html', 'reverse.html', 'sure.html', 'themes.css', 'workspace.css', 'reverse.css',
  'zip.js', 'docx.js', 'normalize.js', 'settings.js', 'legal-rules.js', 'legal-typography.js', 'checks.js', 'udf.js', 'udf-reader.js',
  'edits.js', 'docx-writer.js', 'paste.js', 'pipeline.js', 'preview.js', 'editor-ui.js', 'templates.js', 'templates-page.js', 'workspace.js', 'reverse.js',
  'theme.js', 'ui.js', 'library.js', 'print.js', 'deadline.js', 'app.webmanifest', 'icon16.png', 'icon48.png', 'icon128.png', 'icon192.png', 'icon512.png',
  'fonts/manrope-latin.woff2', 'fonts/manrope-ext.woff2', 'fonts/instrument-serif-latin.woff2', 'fonts/instrument-serif-ext.woff2',
  'fonts/tinos-latin-400-normal.woff2', 'fonts/tinos-latin-400-italic.woff2', 'fonts/tinos-latin-700-normal.woff2', 'fonts/tinos-latin-700-italic.woff2',
  'fonts/tinos-ext-400-normal.woff2', 'fonts/tinos-ext-400-italic.woff2', 'fonts/tinos-ext-700-normal.woff2', 'fonts/tinos-ext-700-italic.woff2'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
// A file shared to the installed app (Android share sheet → "Word↔UDF") is kept
// in this cache only until the page opens it (ui.js takeShared deletes it).
const SHARE = 'wordtoudf-share';
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== SHARE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
async function receiveShare(request){
  const form = await request.formData(), file = form.getAll('file').find(f => f && typeof f === 'object' && f.size);
  if(!file) return Response.redirect('workspace.html', 303);
  const cache = await caches.open(SHARE);
  await cache.put('shared-file', new Response(file, {headers: {'Content-Type': file.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name || 'paylasilan')}}));
  return Response.redirect(/\.udf$/iu.test(file.name || '') ? 'reverse.html?shared=1' : 'workspace.html?shared=1', 303);
}
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if(e.request.method === 'POST' && url.origin === location.origin && url.pathname.endsWith('/share-target')){ e.respondWith(receiveShare(e.request)); return; }
  if(e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(caches.match(e.request, {ignoreSearch: true}).then(hit => hit || fetch(e.request)));
});
