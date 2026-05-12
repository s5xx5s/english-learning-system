# INTEGRATION_NOTES — كيف ندمج المرحلة 1 + 6 في صفحات الدروس

> الغرض: عند نضوج الأدوات (بعد اختبار في `test/`)، ندمجها في صفحات الدروس الفعليّة. هذي الوثيقة تشرح **ماذا نُغيّر** و**أين** بدقّة.

---

## 1. ما تمّ بناؤه — ملخّص سريع

| الطبقة | الملفّات | الحالة |
|---|---|---|
| Backend | `supabase/migrations/*.sql`, `supabase/seed.sql.template` | ✅ جاهز للنسخ في Supabase SQL Editor |
| Client config | `assets/js/config.js` | ⏸️ placeholder — يحتاج `SUPABASE_URL` و `SUPABASE_ANON_KEY` |
| Client API | `assets/js/supabase-client.js`, `languagetool.js`, `import-chatgpt-json.js` | ✅ جاهز، يتعطّل بأمان حتّى تُملأ config |
| Test pages | `test/supabase-test.html`, `languagetool-test.html`, `errors-dashboard.html` | ✅ جاهز للاستخدام بمجرّد ربط config |
| PWA shell | `manifest.json`, `service-worker.js`, `offline.html`, `assets/js/pwa-register.js` | ✅ مُسجَّل في `index.html` و `templates/lesson_template.html` |
| PWA data | `assets/js/indexeddb-sync.js`, `notifications.js` | ✅ APIs جاهزة، لم تُستدعَ من صفحة درس بعد |

---

## 2. ما تبقّى من جهتك (Blocking)

### Supabase
- [ ] أنشئ المشروع (راجع `supabase/README.md`)
- [ ] طبّق الـ 3 migrations بالترتيب في SQL Editor
- [ ] أنشئ مستخدم Auth + UID + إيميل
- [ ] انسخ `seed.sql.template` → `seed.sql`، املأ، شغّله
- [ ] ابعث لي:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - بريدك الإلكتروني

### PWA Icons (للـ iOS Add-to-Home-Screen)
- [ ] `icons/icon-192.png` (192×192)
- [ ] `icons/icon-512.png` (512×512، maskable)
- أو وافق على placeholder SVG الحالي (يعمل على Android، لا يعمل على iOS بشكل مثالي)

---

## 3. الدمج في صفحات الدروس — الخطوات

### 3.1 ربط Supabase في صفحة الدرس
**ملف:** `templates/lesson_template.html` — قبل `</body>`

```html
<!-- Phase 1 client + auth bootstrap -->
<script type="module">
  import { currentUser } from '../../assets/js/supabase-client.js';
  // optional: gate certain sections on auth
  const user = await currentUser();
  document.body.dataset.authed = user ? 'true' : 'false';
</script>
```

**أو** إن أردنا ميزات أعمق (الـ logError من ChatGPT JSON paste مباشرة):
```html
<script type="module">
  import { importChatGPTReport } from '../../assets/js/import-chatgpt-json.js';
  // wire up to existing #chatgptJson textarea + button
  document.getElementById('importJsonBtn')?.addEventListener('click', async () => {
    const json = document.getElementById('chatgptJson').value;
    const dayId = window.LESSON.day_id; // would need build_day.js to inject
    await importChatGPTReport(json, dayId);
  });
</script>
```

> **ملاحظة:** سيحتاج `build_day.js` تعديل بسيط لحقن `day_id` من `days` table في `window.LESSON`. هذا تعديل واحد عند الاستعداد للربط.

### 3.2 ربط LanguageTool في قسم الكتابة
**ملف:** `templates/lesson_template.html` — قسم `WRITING`

أضف زرّاً بجانب الـ textarea:
```html
<button type="button" id="lt-check-btn" class="btn-secondary">فحص أوّلي (LanguageTool)</button>
<div id="lt-results"></div>
```

وفي script:
```html
<script type="module">
  import { checkText, extractErrorsForLog } from '../../assets/js/languagetool.js';
  import { logError } from '../../assets/js/supabase-client.js';

  document.getElementById('lt-check-btn').addEventListener('click', async () => {
    const text = document.getElementById('weeklyProjectText').value;
    const result = await checkText(text);
    // render result.matches in #lt-results, with "save to errors" button
  });
</script>
```

### 3.3 ربط IndexedDB sync (للتشغيل offline)
**ملف:** `index.html` أو أيّ صفحة "dashboard" مستقبليّة

```html
<script type="module">
  import { startBackgroundSync } from './assets/js/indexeddb-sync.js';
  startBackgroundSync(); // كل ساعة
</script>
```

### 3.4 ربط Notifications
**ملف:** `index.html` (مرّة واحدة عند تشغيل أوّل)

```html
<script type="module">
  import { ensurePermission, scheduleToday } from './assets/js/notifications.js';
  document.getElementById('enableRemindersBtn')?.addEventListener('click', async () => {
    if (await ensurePermission()) {
      scheduleToday('09:00', 'حان وقت مراجعة EnglishCards');
      scheduleToday('21:00', 'لم تكمل درس اليوم بعد');
    }
  });
</script>
```

---

## 4. ما يجب تعديله في `_scripts/build_day.js` لاحقاً

| التعديل | السبب |
|---|---|
| استدعاء Supabase لـ INSERT يومي في `days` عند البناء | لربط الـ HTML بـ row حقيقي في `days` table |
| حقن `day_id` في `window.LESSON` | الاستخدام أعلاه |
| استدعاء `import-chatgpt-json.js` يدويّاً من سكربت admin | في حال إضافة JSON قديم retroactively |

**كلّ هذه التعديلات اختياريّة** — يمكن البقاء على نظام MD-only في الطبقة الأماميّة والاعتماد على نسخ JSON يدوياً عبر `test/errors-dashboard.html`.

---

## 5. ما لن نلمسه (حتّى لو الإغراء قويّ)

- ❌ MintDeck integration: TOOLS_SPEC v2 يفصلها كميزة `cards.imported_from_mintdeck` + `mintdeck_original_id`. الـ schema جاهز، لكن الـ importer (script يقرأ ملفّات MintDeck) لم يُبنَ بعد.
- ❌ Pronunciation Accuracy Scorer (الأسبوع 8+) — جدول `recordings` جاهز، لكنّ الـ ML model + audio comparison لاحقاً.
- ❌ Silence Trainer / Idiom Library — جداول `silence_sessions` و `idioms` جاهزة فارغة.

---

## 6. اختبار قبول مرحلي

عند إكمال الربط من جانبك (Supabase + icons):

1. افتح `test/supabase-test.html` → سجّل دخول → اضغط "شغّل اختبار الـ trigger" → يجب أن تنجح كل الخطوات الأربع.
2. افتح `test/languagetool-test.html` → اضغط "فحص" → الأخطاء تظهر → اضغط "احفظ" → النتيجة تظهر مع `card_generated` لكل خطأ.
3. افتح `test/errors-dashboard.html` → جدول الأخطاء يملأ → فلتر بـ source → جدول يتحدّث.
4. افتح `index.html` على iPhone Safari → "Add to Home Screen" → يجب أن يظهر بدون شريط URL.
5. أوقف الـ Wi-Fi → افتح الـ icon → الصفحة تعمل (من cache) + لو زرت صفحة جديدة، تظهر `offline.html`.

---

## 7. متى نمحو `wrapInlineEnglish` (legacy)؟

غير ذي صلة بهذي المرحلة، ولكن لاحقاً:
- بعد ما كل `content/week_XX/day_XX.md` يستخدم `::syntax::` صراحةً
- نحذف `wrapInlineEnglish` من `_scripts/build_day.js`
- نضيف اختباراً جديداً في `_scripts/tests/syntax.test.js` يتأكّد أنّ "English plain text" لا يُلفّ تلقائياً.

---

## 8. الأسبوع القادم

بعد ما المرحلة 1 + 6 تعمل live، يستطيع **Claude (المحادثة)** أن يبدأ Prompt 1 (EnglishCards + Pronunciation) — يحتاج جداول `cards` + `recordings` التي بُنيت هنا.
