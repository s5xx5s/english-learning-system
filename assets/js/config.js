/* =====================================================================
   assets/js/config.js
   Public client configuration for Supabase.

   Why this file is safe to commit:
     - SUPABASE_URL is your project's public REST endpoint
     - SUPABASE_ANON_KEY is "the public client key" by Supabase design;
       Row Level Security is what protects user data, not key secrecy
       (https://supabase.com/docs/guides/api/api-keys#the-anon-key).

   What is NOT safe to commit (and is gitignored):
     - SUPABASE_SERVICE_KEY (admin key, bypasses RLS) → keep in .env.local
       and use only from local node scripts.

   Until you fill in real values, every call from the client will surface
   a clear "Supabase not configured" message instead of a cryptic network
   error — see `isConfigured` below.
   ===================================================================== */

export const SUPABASE_URL      = 'https://YOUR_PROJECT.supabase.co';
export const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE';

/** True once both placeholders above have been replaced with real values. */
export const isConfigured =
  !SUPABASE_URL.includes('YOUR_PROJECT') &&
  !SUPABASE_ANON_KEY.includes('YOUR_ANON_KEY');

/* External APIs we hit directly from the browser. No keys required for
   either at the free tier — both have IP-based rate limits. */
export const LANGUAGETOOL_ENDPOINT = 'https://api.languagetool.org/v2/check';
