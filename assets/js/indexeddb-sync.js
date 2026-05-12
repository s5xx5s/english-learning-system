/* =====================================================================
   assets/js/indexeddb-sync.js
   Mirror the most-recent cards / errors / days into IndexedDB so the
   PWA can render them offline. Uses the `idb` wrapper directly from
   esm.sh, keeping us bundler-free.

   On a flaky connection the UI should always render from IDB first,
   then refresh from Supabase in the background.

   Exports:
     openCache()      → opens the IDB database (lazy, cached)
     syncCards()      → pulls up to 200 cards (due-first) into IDB
     syncErrors()     → pulls last 200 errors
     listCached(store)→ read everything out of a store
     startBackgroundSync(intervalMs) → calls sync* every interval
   ===================================================================== */

import { openDB } from 'https://esm.sh/idb@8';
import { supabase, isConfigured, currentUser } from './supabase-client.js';

const DB_NAME = 'english-cache';
const DB_VERSION = 1;
const STORES = ['cards', 'errors', 'days'];

let dbPromise = null;

export function openCache() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        for (const name of STORES) {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, { keyPath: 'id' });
          }
        }
      }
    });
  }
  return dbPromise;
}

async function replaceAll(storeName, rows) {
  const db = await openCache();
  const tx = db.transaction(storeName, 'readwrite');
  await tx.store.clear();
  for (const r of rows) await tx.store.put(r);
  await tx.done;
  return rows.length;
}

export async function listCached(storeName) {
  const db = await openCache();
  return db.getAll(storeName);
}

async function ensureReadyOrSkip() {
  if (!isConfigured) return false;
  const u = await currentUser();
  return !!u;
}

export async function syncCards() {
  if (!(await ensureReadyOrSkip())) return { skipped: true };
  const { data, error } = await supabase
    .from('cards')
    .select('*')
    .order('next_review', { ascending: true, nullsFirst: true })
    .limit(200);
  if (error) return { error: error.message };
  const n = await replaceAll('cards', data || []);
  return { synced: n };
}

export async function syncErrors() {
  if (!(await ensureReadyOrSkip())) return { skipped: true };
  const { data, error } = await supabase
    .from('errors')
    .select('*')
    .order('last_seen_at', { ascending: false })
    .limit(200);
  if (error) return { error: error.message };
  const n = await replaceAll('errors', data || []);
  return { synced: n };
}

export async function syncAll() {
  return {
    cards:  await syncCards(),
    errors: await syncErrors()
  };
}

/** Run sync* every `intervalMs` (defaults to 1h). Returns a cancel
 *  function. Safe to call multiple times — each call returns its own
 *  cancel handle. Skips when offline. */
export function startBackgroundSync(intervalMs = 60 * 60 * 1000) {
  let cancelled = false;
  async function tick() {
    if (cancelled) return;
    if (navigator.onLine) await syncAll().catch(() => {});
    if (!cancelled) setTimeout(tick, intervalMs);
  }
  // first run on next macrotask so callers can wire listeners first
  setTimeout(tick, 0);
  return () => { cancelled = true; };
}
