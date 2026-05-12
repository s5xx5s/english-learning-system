/* =====================================================================
   assets/js/pwa-register.js
   Registers the service worker with a scope that works for both
   GitHub Pages (`/english-learning-system/`) and any other base path
   (e.g. local file server at the project root).

   Load this from `<script src="..." type="module" defer></script>`
   on every page — it's a no-op when SW isn't supported.
   ===================================================================== */

/** Detect the repo base path. On GitHub Pages this is `/english-learning-system/`.
 *  When opening files at the actual repo root it's `/`. */
function detectBase() {
  const path = window.location.pathname;
  // First segment when the URL is /something/... ; otherwise root.
  const m = path.match(/^(\/[^/]+\/)/);
  // If the first segment looks like one of the in-repo folders, the SW
  // doesn't actually live there — fall through to the parent.
  const inRepoFolders = ['weeks/', 'test/', 'shared/', 'assets/', 'icons/',
                         'content/', 'templates/', '_scripts/'];
  if (m && inRepoFolders.includes(m[1].slice(1))) {
    return '/';
  }
  return m ? m[1] : '/';
}

const SW_BASE = detectBase();

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return Promise.resolve(null);
  return navigator.serviceWorker
    .register(SW_BASE + 'service-worker.js', { scope: SW_BASE })
    .catch(err => {
      // Silent fail — PWA is enhancement, not requirement.
      console.warn('[pwa] SW registration failed:', err);
      return null;
    });
}

/* Auto-register when this module is imported. Idempotent — the browser
   reuses an existing registration with the same scope. */
registerServiceWorker();
