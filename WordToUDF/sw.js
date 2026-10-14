/* Offline cache for the web-app (PWA) mode. Not used by the Chrome extension.
 * Cache-first for the app's own files only; nothing is fetched from or sent
 * to any other origin. Bump VERSION with every release so updates install. */
'use strict';
const VERSION = 'wordtoudf-1.10.1';
const FILES = ['./', 'index.html', 'workspace.html', 'templates.html', 'reverse.html', 'sure.html', 'workspace.css', 'reverse.css',
  'zip.js', 'docx.js', 'normalize.js', 'settings.js', 'legal-rules.js', 'legal-typography.js', 'checks.js', 'udf.js', 'udf-reader.js',
  'edits.js', 'docx-writer.js', 'paste.js', 'pipeline.js', 'preview.js', 'editor-ui.js', 'templates.js', 'templates-page.js', 'workspace.js', 'reverse.js',
  'theme.js', 'library.js', 'print.js', 'deadline.js', 'app.webmanifest', 'icon16.png', 'icon48.png', 'icon128.png', 'icon192.png', 'icon512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if(e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(caches.match(e.request, {ignoreSearch: true}).then(hit => hit || fetch(e.request)));
});
