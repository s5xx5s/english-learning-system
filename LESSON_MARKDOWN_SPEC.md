

# 📋 LESSON_MARKDOWN_SPEC — عقد التحويل Markdown → HTML

> هذا الملف يُحدّد بالضبط:
> 1. شكل الـ Markdown الذي يكتبه المدرّس
> 2. كيف يُترجمه `build_day.js` إلى HTML

---

## 🗂️ بنية ملف Markdown ليوم واحد

كل ملف `content/week_XX/day_XX.md` يحتوي **قسمين**:
1. **Frontmatter** (YAML metadata بين `---` و `---`)
2. **Body** (محتوى Markdown عادي + custom blocks)

---

## 📦 Frontmatter Schema (إلزامي)

````yaml
---
day: 1
week: 1
date: "2026-05-12"
title: "Present Simple — Stative Verbs & 3rd Person"
goal: "بعد اليوم، تستطيع وصف روتين شخص آخر بـ 5 جمل دون أخطاء في الـ s"
duration_minutes: 150

# Section timers (دقائق لكل قسم)
timers:
  podcast: 40
  grammar: 25
  spelling: 15
  reading: 15
  pronunciation: 10
  chatgpt: 25
  writing: 15
  mintdeck: 10

# ChatGPT Voice Prompt للصق المباشر
voice_prompt: |
  Day 1. Target grammar: Present Simple — focus on third person singular
  (he/she/it) with correct -s/-es/-ies endings. Push me to talk about
  other people, not just myself. Let's start.

# روابط البودكاست + القراءة
resources:
  podcast_url: "https://www.bbc.co.uk/programmes/p02pc9tn"
  podcast_title: "BBC 6 Minute English"
  reading_url: "https://learnenglishkids.britishcouncil.org/short-stories"
  reading_title: "Short Stories Level 2"

# YouGlish words (للنطق)
youglish_words:
  - word: "works"
    note: "نطق /s/"
  - word: "goes"
    note: "نطق /z/"
  - word: "watches"
    note: "نطق /ɪz/"
  - word: "studies"
    note: "نطق /z/"

# Writing task
writing:
  topic: "A day in the life of someone I know"
  target_words: 50
  requirements:
    - "استخدم 3rd person singular (he/she)"
    - "8 أفعال على الأقل تحتاج -s/-es/-ies"
    - "2 stative verbs على الأقل"
    - "Present Simple فقط"

# Success checklist (معايير نهاية اليوم)
success_criteria:
  - "استمعت لحلقة بودكاست"
  - "أكملت تمرين القاعدة (8 أسئلة + 3 جمل)"
  - "أكملت تمرين Spelling (12 كلمة)"
  - "قرأت قصة + استخرجت 3 أفعال 3rd person"
  - "فعلت Shadowing لجملة 10 مرّات"
  - "تحدّثت مع ChatGPT 25 دقيقة + JSON جاهز"
  - "كتبت 50 كلمة عن شخص آخر"
  - "استوردت 15 بطاقة في MintDeck"
  - "رفعت التقرير اليومي"

# MintDeck TSV (للاستيراد المباشر)
mintdeck_tsv: |
  Word	Meaning	Example	YouGlish
  understands	يفهم	He understands what you mean.	https://youglish.com/pronounce/understands/english/us
  believes	يصدّق	She believes in hard work.	https://youglish.com/pronounce/believes/english/us
---
````

---

## 📝 Body Structure (محتوى Markdown)

الـ body مُقسَّم إلى **أقسام محدَّدة**، كل قسم يبدأ بـ `## 🎯 SECTION_ID` (الأيقونة + ID موحَّد).

### القائمة الإلزامية للأقسام:

````markdown
## 🎬 WHY
[سيناريو افتتاحي - 3 فقرات]

## ⚠️ HOOK
[الفخّ الشائع - 2-3 فخاخ]

## 📚 GRAMMAR
[شرح القاعدة + أمثلة]

## 🎯 GRAMMAR_EXERCISES
[MCQs + Fill-in-blank + Free writing]

## ✍️ SPELLING
[Spelling Spotlight - قواعد + جدول]

## 🎯 SPELLING_EXERCISES
[تمارين spelling]

## 📖 READING
[تعليمات القراءة المحدّدة]

## 🔊 PRONUNCIATION
[تعليمات Shadowing + الكلمات]

## ✍️ WRITING_GUIDE
[إرشادات الكتابة المُفكَّكة]

## 💾 MINTDECK
[ملاحظات عن البطاقات]
````

---

## 🧩 Custom Blocks (التحويلات الخاصّة)

`build_day.js` يحوّل blocks خاصّة من Markdown إلى HTML تفاعلي.

### Block 1: MCQ

**Markdown:**
````markdown
:::mcq id="q1"
**Q:** أيّ الجمل صحيحة؟
- [ ] He work at Google.
- [x] He works at Google.
- [ ] He working at Google.

**Explanation:** في 3rd person singular نضيف -s للفعل.
:::
````

**HTML المُولَّد:**
````html
<div class="mcq-block" data-mcq-id="q1">
  <p class="mcq-question"><strong>Q:</strong> أيّ الجمل صحيحة؟</p>
  <div class="mcq-options">
    <button class="mcq-option" data-correct="false">He work at Google.</button>
    <button class="mcq-option" data-correct="true">He works at Google.</button>
    <button class="mcq-option" data-correct="false">He working at Google.</button>
  </div>
  <div class="mcq-feedback" hidden>
    <p><strong>Explanation:</strong> في 3rd person singular نضيف -s للفعل.</p>
  </div>
</div>
````

---

### Block 2: Fill-in-blank

**Markdown:**
````markdown
:::fillblank id="fb1"
**Sentence:** She _____ TV every night.
**Answer:** watches
**Hint:** فعل ينتهي بـ -ch، 3rd person singular
**Rule:** -ch → -es
:::
````

**HTML المُولَّد:**
````html
<div class="fillblank-block" data-fillblank-id="fb1">
  <p class="fillblank-sentence">
    She <input type="text" class="fillblank-input" data-answer="watches" placeholder="?">
    TV every night.
  </p>
  <button class="fillblank-check">تحقّق</button>
  <div class="fillblank-feedback" hidden>
    <p class="hint"><strong>Hint:</strong> فعل ينتهي بـ -ch، 3rd person singular</p>
    <p class="rule"><strong>Rule:</strong> -ch → -es</p>
  </div>
</div>
````

---

### Block 3: Free Writing

**Markdown:**
````markdown
:::freewriting id="fw1"
**Prompt:** اكتب 3 جمل عن شخص تعرفه باستخدام 3rd person singular.
**Min words:** 20
**Target structures:**
- 3rd person singular (-s ending)
- 1 stative verb
:::
````

**HTML المُولَّد:**
````html
<div class="freewriting-block" data-fw-id="fw1">
  <p class="fw-prompt">اكتب 3 جمل عن شخص تعرفه باستخدام 3rd person singular.</p>
  <ul class="fw-requirements">
    <li>3rd person singular (-s ending)</li>
    <li>1 stative verb</li>
  </ul>
  <textarea class="fw-input" data-min-words="20" placeholder="اكتب هنا..."></textarea>
  <div class="fw-meta">
    <span class="word-counter">0 / 20 كلمة</span>
  </div>
</div>
````

---

### Block 4: YouGlish

**Markdown:**
````markdown
:::youglish
- works | نطق /s/
- goes | نطق /z/
- watches | نطق /ɪz/
- studies | نطق /z/
:::
````

**HTML المُولَّد:**
````html
<div class="youglish-block">
  <div class="youglish-item">
    <span class="yg-word">works</span>
    <span class="yg-note">نطق /s/</span>
    <button class="yg-embed-btn" data-word="works">🎬 شاهد داخل الصفحة</button>
    <a href="https://youglish.com/pronounce/works/english/us" target="_blank" class="yg-link">🔗 فتح خارجي</a>
  </div>
  <!-- ... -->
</div>
````

---

### Block 5: Voice Recorder

**Markdown:**
````markdown
:::voicerecorder id="vr1" word="works"
**Task:** سجّل نفسك تنطق "works" قبل سماع YouGlish، ثم بعده. قارن.
:::
````

**HTML المُولَّد:**
````html
<div class="voice-recorder-block" data-vr-id="vr1" data-word="works">
  <p class="vr-task">سجّل نفسك تنطق "works" قبل سماع YouGlish، ثم بعده. قارن.</p>
  <div class="vr-controls">
    <button class="vr-record-before">🎙️ تسجيل قبل</button>
    <audio class="vr-audio-before" controls hidden></audio>
    <button class="vr-record-after">🎙️ تسجيل بعد</button>
    <audio class="vr-audio-after" controls hidden></audio>
  </div>
</div>
````

---

### Block 6: Callout (تنبيهات)

**Markdown:**
````markdown
:::callout type="warning"
⚠️ **خطأ شائع للعرب:** نسيان الـ s مع 3rd person.
:::

:::callout type="info"
💡 **ملاحظة:** الـ stative verbs لا تأخذ -ing.
:::

:::callout type="success"
✅ **تقدّم رائع:** إذا أتقنت هذي القاعدة، B2 على بُعد أسبوع.
:::
````

**HTML المُولَّد:**
````html
<div class="callout callout-warning">
  <p>⚠️ <strong>خطأ شائع للعرب:</strong> نسيان الـ s مع 3rd person.</p>
</div>
````

---

## 🔧 منطق build_day.js

````javascript
// Pseudo-code

const matter = require('gray-matter');
const { marked } = require('marked');
const fs = require('fs');
const path = require('path');

function buildDay(week, day) {
  // 1. اقرأ MD
  const mdPath = `content/week_${week}/day_${day}.md`;
  const raw = fs.readFileSync(mdPath, 'utf-8');

  // 2. حلّل frontmatter + body
  const { data, content } = matter(raw);

  // 3. حوّل custom blocks (قبل marked) — استخدم regex
  let processedContent = content;
  processedContent = transformMCQ(processedContent);
  processedContent = transformFillBlank(processedContent);
  processedContent = transformFreeWriting(processedContent);
  processedContent = transformYouGlish(processedContent);
  processedContent = transformVoiceRecorder(processedContent);
  processedContent = transformCallouts(processedContent);

  // 4. حوّل باقي Markdown → HTML
  const bodyHtml = marked(processedContent);

  // 5. قسّم الـ body لأقسام (## 🎬 WHY → section)
  const sections = splitIntoSections(bodyHtml);

  // 6. اقرأ القالب
  const template = fs.readFileSync('templates/lesson_template.html', 'utf-8');

  // 7. استبدل placeholders
  const finalHtml = template
    .replace('{{DAY_NUMBER}}', data.day)
    .replace('{{WEEK_NUMBER}}', data.week)
    .replace('{{DATE}}', data.date)
    .replace('{{TITLE}}', data.title)
    .replace('{{GOAL}}', data.goal)
    .replace('{{VOICE_PROMPT}}', data.voice_prompt)
    .replace('{{PODCAST_URL}}', data.resources.podcast_url)
    .replace('{{WHY_SECTION}}', sections.WHY)
    .replace('{{HOOK_SECTION}}', sections.HOOK)
    .replace('{{GRAMMAR_SECTION}}', sections.GRAMMAR)
    // ... كل الأقسام
    .replace('{{MINTDECK_TSV}}', escapeHtml(data.mintdeck_tsv))
    .replace('{{SUCCESS_CRITERIA}}', buildChecklist(data.success_criteria));

  // 8. اكتب الناتج
  const outPath = `weeks/week_${week}/day_${day}.html`;
  fs.writeFileSync(outPath, finalHtml, 'utf-8');

  console.log(`✓ Built: ${outPath}`);
}
````

---

## 📋 قالب MD الفارغ (للـ new_day.bat)

`templates/day_template.md`:

````markdown
---
day: __
week: __
date: "YYYY-MM-DD"
title: ""
goal: ""
duration_minutes: 150

timers:
  podcast: 40
  grammar: 25
  spelling: 15
  reading: 15
  pronunciation: 10
  chatgpt: 25
  writing: 15
  mintdeck: 10

voice_prompt: |
  Day __. Target grammar: ___. Let's start.

resources:
  podcast_url: ""
  podcast_title: ""
  reading_url: ""
  reading_title: ""

youglish_words: []

writing:
  topic: ""
  target_words: 50
  requirements: []

success_criteria: []

mintdeck_tsv: |
  Word	Meaning	Example	YouGlish
---

## 🎬 WHY

(املأ هنا)

## ⚠️ HOOK

(املأ هنا)

## 📚 GRAMMAR

(املأ هنا)

## 🎯 GRAMMAR_EXERCISES

(املأ هنا — استخدم :::mcq و :::fillblank)

## ✍️ SPELLING

(املأ هنا)

## 🎯 SPELLING_EXERCISES

(املأ هنا)

## 📖 READING

(املأ هنا)

## 🔊 PRONUNCIATION

(املأ هنا — استخدم :::youglish و :::voicerecorder)

## ✍️ WRITING_GUIDE

(املأ هنا — استخدم :::freewriting)

## 💾 MINTDECK

(املأ هنا)
````

---

بعد حفظ الملف، نفّذ:
git add LESSON_MARKDOWN_SPEC.md
git commit -m "Add Lesson Markdown Specification"
git push origin main

ثم أبلغني بالإنجاز.