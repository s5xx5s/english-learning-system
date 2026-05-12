/* =====================================================================
   assets/js/import-chatgpt-json.js
   Take a JSON report produced by ChatGPT Voice (the shape baked into
   every day's voice_prompt) and shovel it into Supabase.

   Two writes per import:
     1. INSERT into `chatgpt_reports` (one row per session)
     2. Per error in `report.errors`: logError() — same dedupe/upsert
        behaviour as the LanguageTool path, so the
        generate_card_from_error trigger still owns card creation.

   Expected JSON shape (from voice_prompt in content/week_XX/day_XX.md):
     {
       "date": "2026-05-12",
       "day_number": 1,
       "duration_minutes": 25,
       "target_grammar": "...",
       "errors": [
         {"my_sentence": "...", "correction": "...", "type": "...",
          "explanation": "...", "severity": "..."}
       ],
       "strengths": [...], "weaknesses": [...],
       "target_grammar_accuracy": "X/10",
       "vocabulary_new_to_me": [...],
       "pronunciation_issues": [...],
       "fluency_score": "X/10",
       "overall_score": "X/10",
       "advice_for_tomorrow": "..."
     }
   ===================================================================== */

import { supabase, logError, currentUser } from './supabase-client.js';

/** Pull a numeric score out of strings like "8/10" or 8.5. Returns null
 *  if we can't parse — Supabase NUMERIC columns accept null gracefully. */
function parseScore(v) {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  const m = String(v).match(/(\d+(\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

/** Map ChatGPT's free-text `type` field onto our `errors.error_type` enum. */
const TYPE_TO_ENUM = {
  grammar:        'grammar',
  spelling:       'spelling',
  vocab:          'word_choice',
  vocabulary:     'word_choice',
  word_choice:    'word_choice',
  punctuation:    'punctuation',
  pronunciation:  'pronunciation',
  collocation:    'collocation',
  register:       'register'
};
function normaliseErrorType(t) {
  if (!t) return 'grammar';
  return TYPE_TO_ENUM[String(t).toLowerCase()] || 'grammar';
}

/**
 * Import one ChatGPT report.
 *
 * @param {Object|string} reportJson  parsed JSON or raw string
 * @param {string}        dayId       UUID from `days` table (the
 *                                    chatgpt_reports row hangs off it)
 *
 * Returns { reportId, errorResults[] }.
 */
export async function importChatGPTReport(reportJson, dayId) {
  const user = await currentUser();
  if (!user) throw new Error('Not signed in.');

  const report = (typeof reportJson === 'string')
    ? JSON.parse(reportJson)
    : reportJson;

  if (!report || typeof report !== 'object') {
    throw new Error('Report is not a JSON object.');
  }
  if (!dayId) {
    throw new Error('dayId is required (the row in `days` this session belongs to).');
  }

  // 1) chatgpt_reports row
  const { data: row, error: rErr } = await supabase
    .from('chatgpt_reports')
    .insert({
      day_id:                 dayId,
      target_grammar:         report.target_grammar || 'unspecified',
      errors:                 report.errors || [],
      strengths:              report.strengths || null,
      weaknesses:             report.weaknesses || null,
      target_grammar_accuracy: parseScore(report.target_grammar_accuracy),
      vocabulary_new:         report.vocabulary_new_to_me || null,
      pronunciation_issues:   report.pronunciation_issues || null,
      fluency_score:          parseScore(report.fluency_score),
      overall_score:          parseScore(report.overall_score),
      advice_for_tomorrow:    report.advice_for_tomorrow || null,
      raw_json:               report
    })
    .select('id')
    .single();
  if (rErr) throw rErr;

  // 2) per-error logging (dedupe via logError → trigger handles cards)
  const errorResults = [];
  for (const e of (report.errors || [])) {
    const wrong   = e.my_sentence || e.wrong_form  || '';
    const correct = e.correction  || e.correct_form || '';
    if (!wrong || !correct) {
      errorResults.push({ skipped: true, reason: 'missing wrong/correct', raw: e });
      continue;
    }
    try {
      const res = await logError({
        error_type:       normaliseErrorType(e.type),
        wrong_form:       wrong,
        correct_form:     correct,
        rule_violated:    e.explanation || '',
        context_sentence: wrong,
        source:           'chatgpt_json',
        source_id:        row.id
      });
      errorResults.push({ skipped: false, ...res });
    } catch (err) {
      errorResults.push({ skipped: true, reason: err.message, raw: e });
    }
  }

  return { reportId: row.id, errorResults };
}
