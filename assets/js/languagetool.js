/* =====================================================================
   assets/js/languagetool.js
   Thin wrapper around the public LanguageTool API. Free tier: 20 req/min,
   ~20k req/month per IP.

   No API key required for the public endpoint. If we hit rate limits or
   need premium rules, we add a `username` + `apiKey` later.

   Exports:
     checkText(text, language?)   → raw LT response
     categorizeError(match)       → maps LT category.id to our
                                    `errors.error_type` enum
     extractErrorsForLog(matches, contextSentence?)
                                  → returns rows ready for logError()
   ===================================================================== */

import { LANGUAGETOOL_ENDPOINT } from './config.js';

/** Hit LanguageTool. Throws on non-2xx. */
export async function checkText(text, language = 'en-US') {
  const response = await fetch(LANGUAGETOOL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ text, language })
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error('LanguageTool HTTP ' + response.status + ': ' + body);
  }
  return response.json();
}

/**
 * Map a LanguageTool rule category to our `errors.error_type` enum.
 * Anything we don't recognise falls back to 'grammar' (the broadest bucket).
 */
const CATEGORY_TO_TYPE = {
  TYPOS:        'spelling',
  TYPOGRAPHY:   'spelling',
  CASING:       'spelling',
  GRAMMAR:      'grammar',
  COLLOCATIONS: 'collocation',
  CONFUSED_WORDS: 'word_choice',
  REDUNDANCY:   'word_choice',
  STYLE:        'word_choice',
  PUNCTUATION:  'punctuation',
  PUNCTUATION_AGREEMENT: 'punctuation',
  MISC:         'grammar',
  REGISTER:     'register'
};

export function categorizeError(match) {
  const id = match && match.rule && match.rule.category && match.rule.category.id;
  return CATEGORY_TO_TYPE[id] || 'grammar';
}

/**
 * Turn LT matches into payloads ready for supabase-client.logError().
 *
 * - `wrong_form`  = the substring LT flagged
 * - `correct_form`= first suggested replacement (or '' if LT gave none)
 * - `rule_violated` = LT's human-readable rule description
 * - `context_sentence` = caller-supplied (the whole sentence/text)
 * - `source` = 'languagetool'
 *
 * Skips matches with no replacement suggestion (LT sometimes flags
 * stylistic preferences without a fix — not worth logging).
 */
export function extractErrorsForLog(matches, contextSentence = '') {
  return (matches || [])
    .map(m => {
      const wrong = contextSentence.slice(m.offset, m.offset + m.length);
      const correct = (m.replacements && m.replacements[0] && m.replacements[0].value) || '';
      if (!correct) return null;
      return {
        error_type:      categorizeError(m),
        wrong_form:      wrong,
        correct_form:    correct,
        rule_violated:   (m.rule && m.rule.description) || m.message || '',
        context_sentence: contextSentence,
        source:          'languagetool'
      };
    })
    .filter(Boolean);
}
