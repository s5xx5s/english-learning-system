/* =====================================================================
   assets/js/supabase-client.js
   Thin wrapper around supabase-js v2, loaded directly from esm.sh so we
   stay bundler-free.

   Exports:
     supabase            — the configured supabase-js client (or null
                           if config.js still has placeholders)
     ensureSession()     — sign in anonymously if no session, return user
     logError(payload)   — UPSERT-style: bump occurrence_count if the
                           same wrong_form/correct_form already exists,
                           otherwise INSERT a new row. The
                           generate_card_from_error trigger handles card
                           creation when count hits 3.
     getErrors(opts)     — paged listing for the dashboard
     getCards(opts)      — paged listing of cards (with due filter)
   ===================================================================== */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  isConfigured
} from './config.js';

export { isConfigured };

export const supabase = isConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true }
    })
  : null;

/** Throw a clean error early so test pages can show "configure Supabase
 *  first" instead of mysterious null-deref crashes. */
function requireClient() {
  if (!supabase) {
    throw new Error(
      'Supabase not configured. Edit assets/js/config.js with your ' +
      'project URL and anon key.'
    );
  }
  return supabase;
}

/* ─── Auth ─────────────────────────────────────────────────────────────
   For the single-user test pages we sign in with email+password the user
   created in Supabase Auth UI. The session is persisted by supabase-js. */
export async function signIn(email, password) {
  const { data, error } = await requireClient().auth
    .signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

export async function signOut() {
  const { error } = await requireClient().auth.signOut();
  if (error) throw error;
}

export async function currentUser() {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/* ─── Errors table ────────────────────────────────────────────────────
   logError implements the "upsert by content" pattern documented in
   TOOLS_SPEC: if an entry with the same (wrong_form, correct_form,
   user_id) already exists, bump its count and last_seen_at. Otherwise
   insert fresh at count=1.

   Required payload shape:
     {
       error_type:      'spelling' | 'grammar' | 'punctuation' |
                        'word_choice' | 'pronunciation' |
                        'collocation' | 'register',
       wrong_form:      'He don\'t like',
       correct_form:    'He doesn\'t like',
       rule_violated:   '3rd person singular: don\'t → doesn\'t',
       context_sentence:'He don\'t like coffee.',
       source:          'chatgpt_json' | 'languagetool' |
                        'claude_manual' | 'writing_self_edit' |
                        'pronunciation_recording',
       source_id:       optional UUID
     }
*/
export async function logError(payload) {
  const client = requireClient();
  const user = await currentUser();
  if (!user) throw new Error('Not signed in — call signIn() first.');

  // 1. Look for an existing row with the same (user_id, wrong_form, correct_form)
  const { data: existing, error: lookupErr } = await client
    .from('errors')
    .select('id, occurrence_count')
    .eq('user_id', user.id)
    .eq('wrong_form', payload.wrong_form)
    .eq('correct_form', payload.correct_form)
    .maybeSingle();
  if (lookupErr) throw lookupErr;

  // 2. Bump if found, insert otherwise.
  if (existing) {
    const { data, error } = await client
      .from('errors')
      .update({
        occurrence_count: existing.occurrence_count + 1,
        last_seen_at: new Date().toISOString()
      })
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw error;
    return { row: data, action: 'bumped' };
  }

  const { data, error } = await client
    .from('errors')
    .insert({ user_id: user.id, ...payload })
    .select('*')
    .single();
  if (error) throw error;
  return { row: data, action: 'inserted' };
}

export async function getErrors({ filter = {}, limit = 100 } = {}) {
  const client = requireClient();
  let q = client.from('errors').select('*').order('last_seen_at', { ascending: false }).limit(limit);
  if (filter.error_type)     q = q.eq('error_type', filter.error_type);
  if (filter.source)         q = q.eq('source', filter.source);
  if (filter.card_generated !== undefined) q = q.eq('card_generated', filter.card_generated);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

/* ─── Cards (read-side helpers for dashboards) ───────────────────────── */
export async function getCards({ dueOnly = false, limit = 100 } = {}) {
  const client = requireClient();
  let q = client.from('cards').select('*').limit(limit);
  if (dueOnly) {
    q = q.lte('next_review', new Date().toISOString());
  }
  q = q.order('next_review', { ascending: true, nullsFirst: true });
  const { data, error } = await q;
  if (error) throw error;
  return data;
}
