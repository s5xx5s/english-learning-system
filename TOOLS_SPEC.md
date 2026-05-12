# 🛠️ TOOLS_SPEC v2 — مواصفات الأدوات الكاملة

> **الغرض:** المرجع الرسمي لـ Claude Code لبناء جميع الأدوات في نظام English Learning System.
> **يُقرأ قبل:** أيّ مهمّة بناء/تعديل لأداة.
> **يُعدَّل:** فقط عبر محادثة استراتيجية مع Claude (المحادثة)، ليس Claude Code.
> **النسخة:** 2 (تشمل قرارات: PWA، MintDeck import، Pronunciation Scorer)

---

## 📐 المبادئ المعمارية الحاكمة

### 1. الفصل الصارم بين الطبقات

```
Markdown (Claude) → HTML (Claude Code) → Supabase (Backend)
```

- **Markdown** لا يحتوي منطق تطبيقي
- **HTML** لا يحتوي بيانات ثابتة
- **Supabase** هو المصدر الوحيد للحقيقة (Single Source of Truth)

### 2. Feature Flags في كل أداة جديدة

كل أداة تُبنى بهيكل كامل، لكن ميزاتها تُفعَّل تدريجياً عبر:

```yaml
# config/features.yaml
tool_name:
  feature_a:
    enabled_from_week: X
  feature_b:
    enabled_from_week: Y
```

### 3. Free Tier أوّلاً

كل تكامل API يبدأ بـ Free Tier. الترقية تأتي عند **دليل** على الحاجة، ليس توقّعاً.

### 4. لا تجاوز للأنظمة القائمة

- لا تُعطّل MintDeck حتى يكتمل EnglishCards
- لا تُلغِ ChatGPT JSON manual paste حتى يعمل auto-import
- النظام القديم يبقى يعمل حتى الجديد يُختبَر أسبوعاً كاملاً

### 5. لا dashboard منفصل

كل أداة تعرض تحليلاتها **داخلها**. لا نبني صفحة dashboard مستقلّة.

---

## 🗄️ Supabase Schema (المرجع الكامل)

### الجداول الأساسية

```sql
-- ═══════════════════════════════════════════════════
-- 1. USERS — حساب واحد (أنت)
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
-- 2. DAYS — كل يوم دراسي
-- ═══════════════════════════════════════════════════
CREATE TABLE days (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
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
-- 3. CHATGPT_REPORTS — تقارير ChatGPT JSON
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
-- 4. ERRORS — Error Log (منفصل عن cards!)
-- ═══════════════════════════════════════════════════
CREATE TABLE errors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  
  -- المحتوى
  error_type TEXT CHECK (error_type IN (
    'spelling', 'grammar', 'punctuation', 'word_choice',
    'pronunciation', 'collocation', 'register'
  )),
  wrong_form TEXT NOT NULL,
  correct_form TEXT NOT NULL,
  rule_violated TEXT,
  context_sentence TEXT,
  
  -- المصدر
  source TEXT CHECK (source IN (
    'chatgpt_json', 'languagetool', 'claude_manual',
    'writing_self_edit', 'pronunciation_recording'
  )),
  source_id UUID,
  
  -- التكرار (الحاسم!)
  occurrence_count INTEGER DEFAULT 1,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- التحويل لبطاقة
  card_generated BOOLEAN DEFAULT FALSE,
  card_id UUID,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_errors_user_count ON errors(user_id, occurrence_count) 
  WHERE card_generated = FALSE;

-- ═══════════════════════════════════════════════════
-- 5. CARDS — EnglishCards (FSRS)
-- ═══════════════════════════════════════════════════
CREATE TABLE cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  
  card_type TEXT CHECK (card_type IN (
    'vocabulary', 'personal_error', 'cloze',
    'pronunciation', 'idiom', 'grammar_rule'
  )),
  
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  context_sentence TEXT,
  ipa TEXT,
  
  -- الصوتيات
  forvo_urls JSONB,
  cambridge_url TEXT,
  youglish_url TEXT,
  
  -- المصدر
  source_table TEXT,
  source_id UUID,
  generated_from_error_count INTEGER,
  imported_from_mintdeck BOOLEAN DEFAULT FALSE,  -- جديد v2
  mintdeck_original_id TEXT,                      -- جديد v2
  
  -- FSRS State
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
-- 6. WRITINGS — الكتابات اليومية + الأسبوعية
-- ═══════════════════════════════════════════════════
CREATE TABLE writings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  day_id UUID REFERENCES days(id),
  
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
-- 7. RECORDINGS — تسجيلات النطق (مع Accuracy Scorer)
-- ═══════════════════════════════════════════════════
CREATE TABLE recordings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  day_id UUID REFERENCES days(id),
  
  word TEXT NOT NULL,
  user_audio_url TEXT NOT NULL,
  reference_audio_url TEXT,
  
  -- Pronunciation Accuracy Scorer (الأسبوع 8+)
  transcription TEXT,
  accuracy_score NUMERIC(3,2),
  problem_phonemes JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════
-- 8. IDIOMS — Cultural Idiom Library (الأسبوع 22+)
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
-- 9. SILENCE_SESSIONS — Silence Trainer (الأسبوع 17+)
-- ═══════════════════════════════════════════════════
CREATE TABLE silence_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  day_id UUID REFERENCES days(id),
  
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
```

### Triggers تلقائية

```sql
-- ═══════════════════════════════════════════════════
-- Trigger 1: عند 3 تكرارات لخطأ → توليد بطاقة تلقائي
-- ═══════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION generate_card_from_error()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.occurrence_count >= 3 AND NEW.card_generated = FALSE THEN
    INSERT INTO cards (
      user_id, card_type, front, back, context_sentence,
      source_table, source_id, generated_from_error_count,
      weight_multiplier
    ) VALUES (
      NEW.user_id,
      'personal_error',
      NEW.wrong_form || ' ❌ → ' || NEW.correct_form || ' ✅',
      NEW.rule_violated,
      NEW.context_sentence,
      'errors',
      NEW.id,
      NEW.occurrence_count,
      1.5
    ) RETURNING id INTO NEW.card_id;
    
    NEW.card_generated := TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_error_to_card
  BEFORE UPDATE ON errors
  FOR EACH ROW
  EXECUTE FUNCTION generate_card_from_error();
```

---

## 📦 الأداة 1: Supabase Setup

### المخرجات
- Project on Supabase (Free Tier)
- جميع الجداول أعلاه
- جميع Triggers
- Row Level Security (RLS) policies
- `.env.local` على Desktop يحتوي `SUPABASE_URL` و `SUPABASE_ANON_KEY`

### قبول الإنجاز
- [ ] Insert يدوي لـ user ينجح
- [ ] Insert error → update count لـ 3 → ينشئ card تلقائياً
- [ ] HTML على iPhone يقرأ من Supabase عبر anon key

---

## 📦 الأداة 2: LanguageTool Integration

### المعمارية
```
[صفحة الدرس HTML]
    ↓ textarea.value
[JS function: checkWithLanguageTool()]
    ↓ POST https://api.languagetool.org/v2/check
[Free Tier: 20 req/min, 20K req/month]
    ↓ JSON response
[عرض الأخطاء inline + حفظ في writings table]
```

### قبول الإنجاز
- [ ] زرّ "فحص أوّلي" يعمل في صفحة كتابة اليوم
- [ ] الأخطاء تظهر inline مع شرح + اقتراح تصحيح
- [ ] زرّ "أنهيتُ التصحيح الذاتي" يحفظ النصّ في `writings`
- [ ] الأخطاء تُحفَظ في `writings.languagetool_errors`
- [ ] لو 3+ أخطاء من نفس النوع → يُضاف للـ `errors` table

---

## 📦 الأداة 3: Error Log v1

### المنطق
```
كل خطأ يدخل النظام عبر 3 مصادر:
1. ChatGPT JSON (paste/import)
2. LanguageTool (auto)
3. Claude manual (في المحادثة، أنا أضيف من تصحيحي)
    ↓
[Function: logError(error_data)]
    1. ابحث: هل نفس wrong_form + correct_form موجود؟
    2. لو نعم → UPDATE occurrence_count += 1 + last_seen_at = NOW()
    3. لو لا → INSERT جديد
    4. Trigger يفحص: occurrence_count >= 3 → INSERT card
```

### واجهة العرض (مدمَجة في كل صفحة، لا dashboard منفصل)
في أعلى كل صفحة درس:
```
┌────────────────────────────────────────┐
│  🔥 أخطاء على شفا التحوّل لبطاقات      │
│                                        │
│  "He don't" → "He doesn't"     2/3   │
│  "ate" → "eaten"               2/3   │
│  writeing → writing            2/3   │
│                                        │
│  📊 إجمالي الأخطاء هذا الأسبوع: 47    │
│  📉 انخفاض عن الأسبوع السابق: -12%   │
└────────────────────────────────────────┘
```

### قبول الإنجاز
- [ ] إضافة خطأ من ChatGPT JSON تعمل
- [ ] إضافة خطأ يدوي من Claude (عبر API endpoint) تعمل
- [ ] التكرار 3 → بطاقة تلقائياً (مُختبَر)
- [ ] العرض المدمَج في صفحة الدرس يعمل

---

## 📦 الأداة 4: EnglishCards v1

### MintDeck Import التلقائي (جديد v2)

عند **أوّل فتح** لـ EnglishCards:

```javascript
// خطوات auto-import
async function autoImportFromMintDeck() {
  // 1. أطلب من المستخدم export TSV من MintDeck (مرّة واحدة)
  showMessage("افتح MintDeck → English-Daily → Export → TSV");
  
  // 2. زرّ "ألصق TSV هنا"
  const tsv = await getUserInput('paste_tsv');
  
  // 3. حلّل TSV
  const cards = parseTSV(tsv);
  
  // 4. لكل بطاقة:
  for (const card of cards) {
    // - أضف لـ cards table مع imported_from_mintdeck = true
    // - احفظ mintdeck_original_id (للمنع التكرار)
    // - أبدأ FSRS state من الصفر (لا يُورَّث الجدول)
    // - استدعِ Forvo API لكل كلمة (في الخلفية)
    await insertCard({
      ...card,
      imported_from_mintdeck: true,
      mintdeck_original_id: card.id,
      fsrs_state: initialFSRSState
    });
  }
  
  showMessage(`تمّ استيراد ${cards.length} بطاقة من MintDeck.`);
  showMessage("MintDeck يبقى يعمل بالتوازي حتى تتأكّد من EnglishCards.");
}
```

**ملاحظات مهمّة:**
- FSRS state لا يُورَّث (نبدأ من الصفر — تنازل مقبول)
- MintDeck يبقى نشطاً لأسبوع كاملاً للمقارنة
- بعد الأسبوع، يُعطَّل تلقائياً (لا حذف)

### المراجعة الإلزامية بعد كل درس

**القرار:** إلزامياً بعد كل درس → تفتحها الصباح التالي.

```javascript
function getCardsForReview() {
  return {
    must_review_today: cards.where(
      next_review <= NOW() OR 
      created_at IN current_day
    ),
    optional: cards.where(state === 'new')
  };
}
```

### FSRS Configuration

```yaml
algorithm: "FSRS-4.5"

weights:
  default: 1.0
  personal_error: 1.5   # وزن أعلى للأخطاء الشخصية
  pronunciation: 1.2
  idiom: 0.8
  imported_from_mintdeck: 1.0  # جديد v2

ratings:
  again: 1
  hard:  2
  good:  3
  easy:  4

initial_intervals:
  new_card: "10 minutes"
  after_first_good: "1 day"
  after_second_good: "3 days"
```

### Forvo Integration

**القرار:** Free Tier أوّلاً (500 طلب/يوم).

```yaml
strategy:
  1. عند إنشاء بطاقة → fetch من Forvo Free API
  2. cache الـ URLs في cards.forvo_urls (JSONB)
  3. لا تُعِد الطلب لنفس الكلمة
  4. لو نفدت الـ 500 → fallback: YouGlish فقط
  
upgrade_trigger:
  - "إذا نفدت الـ 500 طلب يومياً 3 مرّات في أسبوع → ترقية لـ Premium"
  - "أو إذا تجاوز عدد البطاقات الإجمالي 2000"
```

### واجهة البطاقة (إلزامية)

```html
<div class="card">
  <div class="audio-toolbar">
    <button data-tool="cambridge">📖 Cambridge</button>
    <button data-tool="forvo">🔊 Forvo</button>
    <button data-tool="youglish">🎬 YouGlish</button>
  </div>
  
  <div class="card-front">
    <p class="context">{{context_sentence}}</p>
    <p class="cloze">{{front}}</p>
  </div>
  
  <button class="record-btn">💬 سجّل نطقك</button>
  
  <div class="card-back" hidden>
    <p class="answer">{{back}}</p>
    <p class="ipa">{{ipa}}</p>
    
    {{#if generated_from_error_count}}
    <div class="error-meta">
      📌 خطأ شخصي: شُوهد {{occurrence_count}} مرّات
    </div>
    {{/if}}
    
    {{#if imported_from_mintdeck}}
    <div class="mintdeck-badge">
      🔄 مستورَدة من MintDeck
    </div>
    {{/if}}
  </div>
  
  <div class="fsrs-buttons">
    <button data-rating="again">😟 نسيتُها</button>
    <button data-rating="hard">🤔 صعبة</button>
    <button data-rating="good">😊 جيّدة</button>
    <button data-rating="easy">😎 سهلة</button>
  </div>
</div>
```

### قبول الإنجاز
- [ ] 6 أنواع بطاقات تعمل
- [ ] FSRS algorithm مع weights مختلفة
- [ ] Forvo API يجلب 3 تسجيلات لكل كلمة
- [ ] **MintDeck auto-import يعمل** (جديد v2)
- [ ] auto-trigger من Error Log يعمل
- [ ] واجهة المراجعة تفتح صباحاً تلقائياً

---

## 📦 الأداة 5: Pronunciation Accuracy Scorer (جديد v2)

### الجدول الزمني
بناء **مع باقي الأدوات في المرحلة 2** (الأسبوع 3-5)، تفعيل تدريجي.

### Feature Flags

```yaml
# config/pronunciation_scorer.yaml
features:
  basic_transcription:
    enabled_from_week: 8     # نفس بداية Pronunciation Mastery
    technology: "Web Speech API"
    
  phoneme_comparison:
    enabled_from_week: 12
    reference_source: "Forvo audio"
    
  problem_phoneme_detection:
    enabled_from_week: 16
    common_arab_issues:
      - "/p/ vs /b/"
      - "/v/ vs /f/"
      - "/θ/ (th in 'think')"
      - "/ð/ (th in 'this')"
      - "/r/ (American rhotic)"
    
  accent_drift_tracking:
    enabled_from_week: 24
    track_improvement_over_time: true
```

### المعمارية

```
[تسجيل المستخدم لكلمة] (مثلاً "works")
    ↓
[Web Speech API: transcription]
    ↓
[مقارنة مع Forvo reference audio]
    ↓ 
[خوارزمية:
  - Levenshtein distance على phonemes
  - تحديد phonemes المشكلة
  - حساب accuracy score (0-100)]
    ↓
[حفظ في recordings table]
    ↓
[لو accuracy < 60% → أضف خطأ في errors table]
    ↓
[trigger: 3 تكرارات → بطاقة pronunciation]
```

### قبول الإنجاز
- [ ] Web Speech API يعمل على iPhone Safari
- [ ] مقارنة مع Forvo تعطي درجة منطقية
- [ ] لو 3 محاولات سيّئة لنفس الكلمة → بطاقة تلقائية
- [ ] رسم تطوّر النطق عبر الأسابيع

---

## 📦 الأداة 6: Writing Style Analyzer (الأسبوع 11)

### Feature Flags

```yaml
# config/writing_analyzer.yaml
features:
  active_passive_ratio:
    enabled_from_week: 13
    target: "active > 70%"
  
  sentence_length_variety:
    enabled_from_week: 14
    target_std_dev: "5-10 words"
  
  show_vs_tell:
    enabled_from_week: 15
    detection_patterns:
      - "I felt"
      - "I was sad/happy/angry"
      - "It was nice/bad"
  
  sensory_density:
    enabled_from_week: 16
    target: "1+ sensory word per 3 sentences"
  
  weak_verbs:
    enabled_from_week: 17
    blacklist: ["go", "do", "make", "get", "have", "say"]
  
  very_overuse:
    enabled_from_week: 18
    max_per_500_words: 2
```

### Pipeline

```
[نصّ الكتابة الأسبوعية]
    ↓
[تحليل nlp: spaCy en_core_web_sm]
    ↓
[فحص كل feature حسب current_week]
    ↓
[رسم بياني للتطوّر عبر الأسابيع]
    ↓
[حفظ في writings.style_metrics]
```

### قبول الإنجاز
- [ ] spaCy يعمل
- [ ] جميع 6 features قابلة للتفعيل/التعطيل
- [ ] الرسم البياني للتطوّر يعمل
- [ ] الاقتراحات contextual

---

## 📦 الأداة 7: Silence Trainer (الأسبوع 17)

### Feature Flags

```yaml
# config/silence_trainer.yaml
features:
  filler_word_detection:
    enabled_from_week: 17
    target_words: ["uhm", "uh", "like", "you know", "I mean", "so"]
    threshold_warning: 5
    
  pause_timer:
    enabled_from_week: 20
    pause_duration: 3
    
  silence_tolerance_training:
    enabled_from_week: 24
    silence_duration: 5
    
  interview_silence_simulator:
    enabled_from_week: 28
    silence_duration: 10
```

### قبول الإنجاز
- [ ] Web Speech API يلتقط النصّ بدقّة 85%+
- [ ] Filler words detection يعمل لـ 6 كلمات
- [ ] feature flag للأسابيع المتقدّمة (مُختبَر يدوياً)
- [ ] التطوّر يُعرَض داخل الأداة (لا dashboard منفصل)

---

## 📦 الأداة 8: Cultural Idiom Library (الأسبوع 22)

### Initial Dataset

عند البناء، Claude (المحادثة) يولّد **100 idiom أمريكي**:
- 30 business/professional
- 30 casual conversation
- 20 tech industry
- 20 interview-specific

### Cultural Quiz Engine

```
كل أسبوع (من 22):
  ↓
[اختر 5 idioms جديدة + 3 من المخزون]
  ↓
[ChatGPT Voice prompt: استخدمهم معي]
  ↓
[تقييم: هل فهمتُ السياق؟ هل استخدمتُهم؟]
```

### قبول الإنجاز
- [ ] 100 idiom في DB قبل الأسبوع 22
- [ ] Cultural Quiz أسبوعي يعمل
- [ ] تكامل مع EnglishCards (idioms = card_type)

---

## 📦 الأداة 9: PWA Layer (بعد المرحلة 5)

### الجدول الزمني
بناء **بعد اكتمال كل الأدوات** (الأسبوع 25+).

### المكوّنات

```yaml
pwa_components:
  manifest:
    name: "English Learning System"
    short_name: "English"
    icon_192: "/icons/icon-192.png"
    icon_512: "/icons/icon-512.png"
    theme_color: "#3b82f6"
    background_color: "#ffffff"
    display: "standalone"
    orientation: "portrait"
    
  service_worker:
    cache_strategy: "stale-while-revalidate"
    cache_assets:
      - "/css/*"
      - "/js/*"
      - "/icons/*"
      - "/weeks/*.html"
    offline_fallback: "/offline.html"
    
  indexeddb_cache:
    cached_tables:
      - "cards"        # للمراجعة offline
      - "errors"
      - "days"
    sync_strategy: "background-sync"
    
  push_notifications:
    triggers:
      - "صباحاً 9:00: حان وقت مراجعة EnglishCards"
      - "مساءً 9:00: لم تكمل درس اليوم بعد"
      - "أسبوعياً: تقرير تقدّمك جاهز"
    permission_request_timing: "بعد أسبوع من الاستخدام"
```

### قبول الإنجاز
- [ ] manifest.json صحيح + الأيقونات
- [ ] service-worker يعمل offline
- [ ] IndexedDB يخزّن آخر 100 بطاقة
- [ ] إشعارات يومية تعمل على iPhone
- [ ] "Add to Home Screen" يعطي تجربة app

---

## 📊 الجدول الزمني الإلزامي (مُحدَّث v2)

| المرحلة | الأسابيع | الأدوات | الحالة |
|---|---|---|---|
| 0 | الآن | إصلاح RTL/Block في HTML | 🔨 Claude Code |
| 1 | 1-2 | Supabase + LanguageTool + Error Log | ⏳ |
| 2 | 3-5 | **EnglishCards + Pronunciation Scorer (هياكل كاملة)** | ⏳ |
| 3 | 11-16 | Writing Style Analyzer | ⏳ |
| 4 | 17-20 | Silence Trainer | ⏳ |
| 5 | 22-24 | Cultural Idiom Library | ⏳ |
| **6** | **25+** | **PWA Layer (manifest + SW + IndexedDB + Notifications)** | ⏳ |

### تفعيل الميزات التدريجي

```
الأسبوع 8:  Pronunciation Scorer — basic transcription
الأسبوع 12: Pronunciation Scorer — phoneme comparison
الأسبوع 13: Writing Analyzer — active/passive
الأسبوع 14: Writing Analyzer — sentence variety
الأسبوع 15: Writing Analyzer — show vs tell
الأسبوع 16: Writing Analyzer — sensory + Pronunciation — problem phonemes
الأسبوع 17: Writing Analyzer — weak verbs + Silence — filler detection
الأسبوع 18: Writing Analyzer — "very" overuse
الأسبوع 20: Silence — pause timer (3s)
الأسبوع 22: Cultural Idiom Library opens
الأسبوع 24: Silence — tolerance training (5s) + Pronunciation — drift tracking
الأسبوع 25: PWA Layer building starts
الأسبوع 28: Silence — interview simulator (10s)
```

---

## 🚨 قواعد لـ Claude Code

### افعل
- ✅ اقرأ هذا الملف قبل أيّ بناء
- ✅ التزم بـ Supabase Schema حرفياً
- ✅ Free Tier أوّلاً، ترقية بدليل
- ✅ Feature flags لكل ميزة جديدة
- ✅ اختبر Triggers محلّياً قبل النشر
- ✅ كل أداة تعرض تحليلاتها **داخلها** (لا dashboard منفصل)

### لا تفعل
- ❌ لا تعدّل Schema بدون إذن صريح من Claude (المحادثة)
- ❌ لا تُعطّل النظام القديم قبل اختبار الجديد أسبوعاً
- ❌ لا تستخدم APIs مدفوعة بدون موافقة المستخدم
- ❌ لا تكتب محتوى تعليمي — هذي مسؤولية Claude (المحادثة)
- ❌ لا تتجاوز ترتيب الأدوات
- ❌ لا تبني dashboard مستقلّ
- ❌ لا تحذف MintDeck data بعد import — يبقى أسبوعاً للمقارنة

---

## 🔄 عند تعديل هذا الملف

أيّ تعديل يجب أن يمرّ عبر:
1. محادثة استراتيجية مع Claude (المحادثة)
2. توثيق سبب التعديل في `CHANGELOG.md`
3. تحديث `current_week` في Supabase لو التعديل يؤثّر على المنهج

---

## 📜 سجل التغييرات

### v2 (هذه النسخة)
- ✅ أضيف **Pronunciation Accuracy Scorer** كأداة 5 (يُبنى في المرحلة 2)
- ✅ أضيف **MintDeck auto-import** ضمن EnglishCards
- ✅ أضيف **PWA Layer** كأداة 9 (المرحلة 6)
- ✅ أُلغي مفهوم Dashboard المنفصل
- ✅ أُضيف Schema columns: `imported_from_mintdeck`, `mintdeck_original_id`
- ✅ جدول زمني محدّث لتفعيل الميزات أسبوعاً بأسبوع

### v1
- إصدار أوّلي بـ 7 أدوات

---

> **آخر تذكير:** هذا الملف هو **العقد** بين الطبقات الثلاث.
> أيّ خرق له = خرق للنظام.
> أيّ سؤال غامض = ارجع لـ Claude (المحادثة) قبل التنفيذ.
