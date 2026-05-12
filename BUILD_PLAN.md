# BUILD_PLAN — Phase 1 + Phase 6

> **الغرض:** خطّة تنفيذيّة لـ TOOLS_SPEC مرحلة 1 (Supabase + LanguageTool + Error Log) ومرحلة 6 (PWA). يُحدَّث الملف عند تغيير الـ scope.
>
> **القرار الكبير:** المستخدم وافق على تجاوز قيود `CLAUDE.md` (CDN، npm، حجم HTML) لأنّ هذه المرحلة تتطلّب backend حقيقي. سأُحدِّث `CLAUDE.md` في نهاية المرحلة 1 ليعكس الواقع.

---

## 1. القرارات المعماريّة (موقَّعة)

| القرار | السبب |
|---|---|
| **ESM CDN imports** بدل bundler (`https://esm.sh/@supabase/supabase-js@2`, `https://esm.sh/idb`) | GitHub Pages موقع ساكن، لا build pipeline للـ browser. لا حاجة لـ npm install ولا webpack/vite. |
| **`SUPABASE_SERVICE_KEY` لا يدخل أيّ ملف يُرفع لـ GitHub** | الـ service key يتجاوز RLS. يبقى في `.env.local` (مُتجاهَل عبر `.gitignore`) ويُستخدَم فقط لسكربتات admin محلّيّة. |
| **`SUPABASE_ANON_KEY` يدخل JS عميل بشكل عام** | هذا هو السلوك الموصى به من Supabase. RLS هي خطّ الدفاع الفعلي. |
| **كل أدوات Phase 1 في `test/` وفي `assets/js/`** | لا تمسّ `templates/`, `content/`, `weeks/` ولا `_scripts/build_day.js` — كما طلب TOOLS_SPEC. |
| **PWA paths نسبيّة من الجذر** | الموقع يُقدَّم من `/english-learning-system/` لا من `/`. سأستخدم paths نسبيّة (`./manifest.json`) أو ديناميكيّة (`new URL('./manifest.json', document.baseURI)`). |
| **PWA scope = `./`** | يحصر الـ service worker على هذا المسار، لا يتداخل مع منصّات GitHub Pages الأخرى تحت نفس الـ domain. |
| **MintDeck يبقى يعمل بالتوازي** | حسب TOOLS_SPEC: لا تُعطّل النظام القديم قبل اختبار الجديد أسبوعاً. |

---

## 2. ما أحتاجه منك (Blocking Items)

### المرحلة 1.1 (Supabase):
- [ ] **أنشئ مشروع Supabase** على https://supabase.com:
  - Region: `me-central-1` (إن متاح) أو `eu-central-1`
  - Name: `english-learning-system`
- [ ] **أرسل لي 3 أشياء:**
  1. `SUPABASE_URL` (شكل: `https://xxxxxxxxxxxx.supabase.co`)
  2. `SUPABASE_ANON_KEY` (يبدأ بـ `eyJ...`، طويل)
  3. `SUPABASE_SERVICE_KEY` (يبدأ بـ `eyJ...`، طويل، **سرّي**)
- [ ] **بريدك الإلكتروني** لـ INSERT في `users` table

### المرحلة 6 (PWA):
- [ ] **أيقونتان PNG:**
  - `icon-192.png` (192×192)
  - `icon-512.png` (512×512، maskable)
  - أو موافقتك على placeholder أُولّده بنفسي (نصّ `EN` على خلفيّة زرقاء)

---

## 3. الخارطة التنفيذيّة

### المرحلة 1.0 — تحضير محلّي ✅ يمكنني الآن
- [x] هذا الملف (`BUILD_PLAN.md`)
- [ ] تحديث `.gitignore` (`.env.local`, `.env`, إلخ)
- [ ] `supabase/migrations/0001_initial_schema.sql` — جداول users/days/chatgpt_reports/errors/cards/writings/recordings + idioms + silence_sessions (الأخيران فارغان)
- [ ] `supabase/migrations/0002_triggers.sql` — `generate_card_from_error` trigger حرفيّاً من TOOLS_SPEC
- [ ] `supabase/migrations/0003_rls_policies.sql` — Row Level Security لكل جدول
- [ ] `supabase/seed.sql.template` — INSERT للمستخدم (تملأ الإيميل لاحقاً)
- [ ] `supabase/README.md` — تعليمات نسخ هذي إلى Supabase SQL Editor
- [ ] `test/index.html` — قائمة بصفحات الاختبار

### المرحلة 1.1 — ربط Supabase ⏸️ بعد المفاتيح
- [ ] إنشاء `.env.local` (تكتبه أنت بالمفاتيح، لا أرفعه)
- [ ] `assets/js/config.js` — يقرأ MFatih من `window.__SUPABASE_CONFIG__` (مُحقَن inline في الـ HTML من قيم البناء)
- [ ] `assets/js/supabase-client.js`:
  - import من `https://esm.sh/@supabase/supabase-js@2`
  - دالّة `logError(errorData)` — UPSERT بناءً على `wrong_form + correct_form`
  - دالّة `getCards(limit)` للقراءة
- [ ] اختبار يدوي: INSERT في `errors` مع `occurrence_count=3` → trigger يُولّد card

### المرحلة 1.2 — LanguageTool ⏸️ بعد 1.1
- [ ] `assets/js/languagetool.js` — `checkText()` + `categorizeError()`
- [ ] `test/languagetool-test.html` — textarea + زرّ فحص + عرض النتائج + زرّ "احفظ في errors"
- [ ] اختبار: "He don't like coffee" يُكشف ويُحفَظ

### المرحلة 1.3 — Error Log Dashboard ⏸️ بعد 1.2
- [ ] `assets/js/import-chatgpt-json.js` — يستورد ChatGPT JSON ويحفظه في `chatgpt_reports` + يستدعي `logError` لكل خطأ
- [ ] `test/errors-dashboard.html` — قائمة الأخطاء + فلاتر + عدّاد
- [ ] اختبار: استيراد JSON mock → الأخطاء تظهر + تكرار 3 مرّات → بطاقة تُنشأ

### المرحلة 6 — PWA ⏸️ بعد الأيقونات
- [ ] `manifest.json` في الجذر
- [ ] `service-worker.js` في الجذر — cache shell + offline fallback
- [ ] `offline.html` — fallback بسيط
- [ ] `assets/js/pwa-register.js` — يُسجّل الـ SW + يطلب notification permission
- [ ] `assets/js/indexeddb-sync.js` — ESM CDN `idb`، يخزّن آخر 100 بطاقة
- [ ] إضافة `<link rel="manifest">` + `<meta theme-color>` في `index.html` و `templates/lesson_template.html`
- [ ] اختبار: Lighthouse PWA score 90+

### الإغلاق
- [ ] `INTEGRATION_NOTES.md` — كيفيّة دمج هذي الأدوات لاحقاً في صفحات الدرس + الـ build pipeline
- [ ] تحديث `CLAUDE.md` بالاستثناءات الجديدة
- [ ] Commit + push لكل مرحلة بـ كوميت واضح

---

## 4. ما لن أفعله

- ❌ تعديل `_scripts/build_day.js`
- ❌ تعديل `templates/lesson_template.html`
- ❌ تعديل ملفّات `content/`
- ❌ كتابة محتوى تعليمي
- ❌ تنفيذ Prompts 1-4 المذكورة في الرسالة (EnglishCards/Writing Analyzer/Silence Trainer/Idiom Library) — **لم تُعطَ في الرسالة**
- ❌ حذف MintDeck data

---

## 5. الأوامر السريعة بيننا

| تقول | أفعل |
|---|---|
| "خذ المفاتيح" + ترسلها | أتابع المرحلة 1.1 |
| "خذ الإيقونات" + ترسلها | أتابع PWA |
| "ولّد placeholder" | أُولّد أيقونتَين بسيطتَين بنفسي |
| "وقفت — راجع" | أتوقّف وأُلخّص ما تمّ |
| "كمّل" | أستمرّ في الـ todo التالي |
