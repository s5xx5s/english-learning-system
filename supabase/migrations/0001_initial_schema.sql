-- ═══════════════════════════════════════════════════════════════════════════
-- English Learning System — Initial Schema (Phase 1)
-- ═══════════════════════════════════════════════════════════════════════════
-- Schema taken verbatim from TOOLS_SPEC.md "Supabase Schema" section.
-- 9 tables total. Tables 1-7 are active in Phase 1. Tables 8 (idioms) and
-- 9 (silence_sessions) are created empty for now and populated later.
--
-- How to apply: paste this file into Supabase SQL Editor → Run.
-- Then apply 0002_triggers.sql, then 0003_rls_policies.sql.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ═══════════════════════════════════════════════════
-- 1. USERS — one row per learner (single-user system for now)
--    Note: `id` is the same UUID as auth.users(id). When you create your
--    Supabase Auth account, copy its UID into seed.sql.
-- ═══════════════════════════════════════════════════
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  level TEXT DEFAULT 'B1',
  current_week INTEGER DEFAULT 1,
  current_day INTEGER DEFAULT 1,
  timezone TEXT DEFAULT 'Asia/Riyadh',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════
-- 2. DAYS — one row per study day
-- ═══════════════════════════════════════════════════
CREATE TABLE days (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  week_number INTEGER NOT NULL,
  date DATE NOT NULL,
  day_type TEXT CHECK (day_type IN ('regular', 'writing', 'reflection')),
  duration_minutes_planned INTEGER,
  duration_minutes_actual INTEGER,
  completion_percentage INTEGER CHECK (completion_percentage BETWEEN 0 AND 100),
  frustration_score INTEGER CHECK (frustration_score BETWEEN 1 AND 10),
  energy_score INTEGER CHECK (energy_score BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, day_number, week_number)
);

-- ═══════════════════════════════════════════════════
-- 3. CHATGPT_REPORTS — JSON reports from ChatGPT Voice sessions
-- ═══════════════════════════════════════════════════
CREATE TABLE chatgpt_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  day_id UUID REFERENCES days(id) ON DELETE CASCADE,
  target_grammar TEXT NOT NULL,
  errors JSONB NOT NULL,
  strengths JSONB,
  weaknesses JSONB,
  target_grammar_accuracy INTEGER,
  vocabulary_new JSONB,
  pronunciation_issues JSONB,
  fluency_score NUMERIC(3,1),
  overall_score NUMERIC(3,1),
  advice_for_tomorrow TEXT,
  raw_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════
-- 4. ERRORS — Error Log (separate from cards by design)
-- ═══════════════════════════════════════════════════
CREATE TABLE errors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Content
  error_type TEXT CHECK (error_type IN (
    'spelling', 'grammar', 'punctuation', 'word_choice',
    'pronunciation', 'collocation', 'register'
  )),
  wrong_form TEXT NOT NULL,
  correct_form TEXT NOT NULL,
  rule_violated TEXT,
  context_sentence TEXT,

  -- Source
  source TEXT CHECK (source IN (
    'chatgpt_json', 'languagetool', 'claude_manual',
    'writing_self_edit', 'pronunciation_recording'
  )),
  source_id UUID,

  -- Recurrence (the decisive signal)
  occurrence_count INTEGER DEFAULT 1,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),

  -- Card promotion
  card_generated BOOLEAN DEFAULT FALSE,
  card_id UUID,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_errors_user_count ON errors(user_id, occurrence_count)
  WHERE card_generated = FALSE;

-- ═══════════════════════════════════════════════════
-- 5. CARDS — EnglishCards with FSRS-style scheduling state
-- ═══════════════════════════════════════════════════
CREATE TABLE cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  card_type TEXT CHECK (card_type IN (
    'vocabulary', 'personal_error', 'cloze',
    'pronunciation', 'idiom', 'grammar_rule'
  )),

  front TEXT NOT NULL,
  back TEXT NOT NULL,
  context_sentence TEXT,
  ipa TEXT,

  -- Pronunciation links
  forvo_urls JSONB,
  cambridge_url TEXT,
  youglish_url TEXT,

  -- Provenance
  source_table TEXT,
  source_id UUID,
  generated_from_error_count INTEGER,
  imported_from_mintdeck BOOLEAN DEFAULT FALSE,
  mintdeck_original_id TEXT,

  -- FSRS state
  fsrs_state JSONB NOT NULL DEFAULT '{
    "stability": 0,
    "difficulty": 0,
    "elapsed_days": 0,
    "scheduled_days": 0,
    "reps": 0,
    "lapses": 0,
    "state": "new"
  }'::jsonb,

  next_review TIMESTAMPTZ,
  weight_multiplier NUMERIC(3,2) DEFAULT 1.0,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cards_review ON cards(user_id, next_review)
  WHERE next_review IS NOT NULL;

-- ═══════════════════════════════════════════════════
-- 6. WRITINGS — daily + weekly writing exercises
-- ═══════════════════════════════════════════════════
CREATE TABLE writings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  day_id UUID REFERENCES days(id) ON DELETE CASCADE,

  writing_type TEXT CHECK (writing_type IN ('daily', 'weekly_project')),
  prompt TEXT NOT NULL,
  text TEXT NOT NULL,
  word_count INTEGER,
  target_word_count INTEGER,

  languagetool_errors JSONB,
  languagetool_checked_at TIMESTAMPTZ,

  style_metrics JSONB,
  style_analyzed_at TIMESTAMPTZ,

  self_edit_completed BOOLEAN DEFAULT FALSE,
  self_edit_changes_count INTEGER,

  claude_corrections JSONB,
  claude_corrected_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════
-- 7. RECORDINGS — pronunciation recordings + scorer output
-- ═══════════════════════════════════════════════════
CREATE TABLE recordings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  day_id UUID REFERENCES days(id) ON DELETE CASCADE,

  word TEXT NOT NULL,
  user_audio_url TEXT NOT NULL,
  reference_audio_url TEXT,

  -- Pronunciation Accuracy Scorer (week 8+)
  transcription TEXT,
  accuracy_score NUMERIC(3,2),
  problem_phonemes JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════
-- 8. IDIOMS — Cultural Idiom Library (populated from week 22+)
-- ═══════════════════════════════════════════════════
CREATE TABLE idioms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  idiom TEXT NOT NULL UNIQUE,
  meaning_en TEXT NOT NULL,
  meaning_ar TEXT NOT NULL,

  formality_level TEXT CHECK (formality_level IN (
    'casual', 'business', 'professional', 'academic'
  )),
  region TEXT DEFAULT 'US',

  usage_context TEXT,
  example_dialogues JSONB,
  cultural_notes JSONB,
  when_not_to_use JSONB,
  alternatives JSONB,
  related_idioms JSONB,

  unlock_week INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════
-- 9. SILENCE_SESSIONS — Silence Trainer (populated from week 17+)
-- ═══════════════════════════════════════════════════
CREATE TABLE silence_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  day_id UUID REFERENCES days(id) ON DELETE CASCADE,

  session_type TEXT CHECK (session_type IN (
    'filler_detection', 'pause_timer',
    'silence_tolerance', 'interview_simulator'
  )),

  duration_seconds INTEGER,
  filler_words_count INTEGER,
  filler_words_breakdown JSONB,
  avg_pause_length NUMERIC(4,2),

  audio_url TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════
-- Verification queries you can run after applying:
--   SELECT COUNT(*) FROM information_schema.tables
--   WHERE table_schema = 'public'
--     AND table_name IN ('users','days','chatgpt_reports','errors',
--                        'cards','writings','recordings','idioms',
--                        'silence_sessions');
--   -- expected: 9
-- ═══════════════════════════════════════════════════
