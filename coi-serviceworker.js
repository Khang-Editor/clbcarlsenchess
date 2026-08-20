/*
 * coi-serviceworker (minimal local implementation)
 * Adds Cross-Origin-Opener-Policy / Cross-Origin-Embedder-Policy headers to
 * same-origin responses so the page becomes cross-origin isolated and
 * SharedArrayBuffer / pthreads-based WASM (Fairy Stockfish) can run, even
 * though GitHub Pages does not let us set custom response headers.
 */
if (typeof window === 'undefined') {
  // Running inside the service worker itself.
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

  self.addEventListener('fetch', function (event) {
    const req = event.request;
    if (req.cache === 'only-if-cached' && req.mode !== 'same-origin') return;

    event.respondWith(
      fetch(req).then(function (response) {
        if (response.status === 0) return response;
        const newHeaders = new Headers(response.headers);
        newHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
        newHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders
        });
      }).catch(function (e) { console.error('[coi] fetch failed', e); })
    );
  });
} else {
  (function () {
    if (window.crossOriginIsolated !== false) return; // already isolated or unsupported browser
    if (!window.isSecureContext) return; // service workers need https (or localhost)

    const reloadedFlag = 'coiReloadedBySW';
    navigator.serviceWorker.register(window.document.currentScript.src).then(
      function (registration) {
        registration.addEventListener('updatefound', () => {});
        // If a SW is already controlling the page, just wait for it to activate then reload once.
        if (!navigator.serviceWorker.controller) {
          registration.addEventListener('statechange', function () {});
        }
        if (!sessionStorage.getItem(reloadedFlag)) {
          sessionStorage.setItem(reloadedFlag, '1');
          window.location.reload();
        }
      },
      function (err) {
        console.error('[coi] service worker registration failed, Fairy Stockfish (multi-thread) will not be available:', err);
      }
    );
  })();
}
