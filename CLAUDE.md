
# 🤖 CLAUDE.md — Project Instructions for Claude Code

> ⚠️ اقرأ هذا الملف بالكامل في بداية كل جلسة. القيود هنا غير قابلة للتفاوض.

---

## 🎯 الهدف من المشروع

منصّة تعلّم إنجليزية تفاعلية لمدة 36 أسبوع (252 يوم).
- **المستخدم:** متعلّم عربي، B1 → C1
- **الجهاز:** iPhone (للاستخدام اليومي) + Windows (للبناء)
- **الاستضافة:** GitHub Pages
- **الـ Repository:** https://github.com/s5xx5s/english-learning-system
- **الرابط الحيّ:** https://s5xx5s.github.io/english-learning-system/

---

## 🔄 سير العمل الذي يجب أن تفهمه

````
1. أنت (Claude Code) بنيت البنية التحتية مرّة واحدة
2. مدرّس آخر (Claude في محادثة منفصلة) يكتب درس كل يوم بصيغة Markdown
3. المستخدم يحفظ الـ Markdown في: content/week_XX/day_XX.md
4. المستخدم يُشغّل: npm run build:day -- 01 01
5. سكربتك يقرأ MD + يدمجه مع القالب + ينتج HTML في weeks/week_XX/day_XX.html
6. المستخدم يدفع للـ GitHub: git push (أو سكربت upload_day.bat)
````

**دورك المستمر:**
- صيانة سكربت التحويل (`build_day.js`)
- إصلاح الأخطاء في القوالب أو CSS عند الحاجة
- إضافة ميزات بطلب صريح من المستخدم

**ما ليس دورك:**
- ❌ كتابة المحتوى التعليمي (الدروس)
- ❌ تعديل ملفّات Markdown في content/
- ❌ اقتراح تغييرات تربوية

---

## 📁 بنية المشروع (إلزامية)

````
english-learning-system/
├── CLAUDE.md
├── LESSON_MARKDOWN_SPEC.md
├── README.md
├── LIVE_URL.txt
├── .gitignore
├── package.json
├── index.html                  ← لوحة التحكّم
│
├── content/                    ← Markdown (من المدرّس)
│   └── week_XX/
│       └── day_XX.md
│
├── weeks/                      ← HTML (مُولَّد، لا يُعدَّل يدوياً)
│   └── week_XX/
│       └── day_XX.html
│
├── shared/                     ← مشترك بين كل الصفحات
│   ├── styles.css
│   ├── interactive.js
│   ├── audio.js
│   └── storage.js
│
├── templates/
│   ├── lesson_template.html    ← القالب الأساسي
│   └── components/             ← مكوّنات قابلة لإعادة الاستخدام
│       ├── mcq.html
│       ├── fillblank.html
│       ├── voice_recorder.html
│       ├── chatgpt_section.html
│       └── export_section.html
│
├── reports/
│   └── daily_report.html       ← (يُنسَخ من index_v2.html القديم)
│
└── _scripts/
    ├── build_day.js            ← MD → HTML
    ├── build_week.js
    ├── upload_day.bat
    ├── upload_week.bat
    └── new_day.bat             ← إنشاء MD فارغ من قالب
````

---

## 🎨 لغة التصميم (إلزامية)

### الألوان
````css
:root {
  /* الخلفيات */
  --bg-primary: #ffffff;
  --bg-secondary: #f8fafc;
  --bg-accent: #eff6ff;

  /* النصوص */
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-muted: #94a3b8;

  /* اللون الأساسي - أزرق أكاديمي */
  --primary: #1e40af;
  --primary-light: #3b82f6;
  --primary-dark: #1e3a8a;

  /* حالات */
  --success: #059669;
  --warning: #d97706;
  --error: #dc2626;

  /* الحدود */
  --border: #e2e8f0;
  --border-strong: #cbd5e1;
}
````

### الخطوط
- العربية: `'Tajawal', 'IBM Plex Sans Arabic', system-ui, sans-serif`
- الإنجليزية (داخل النص): `'Inter', -apple-system, sans-serif`
- Code/Examples: `'JetBrains Mono', monospace`

استخدم Google Fonts CDN في `<head>`:
````html
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
````

### المسافات (4px scale)
4, 8, 12, 16, 24, 32, 48, 64

### Border Radius
- صغير: 8px (buttons, inputs)
- متوسط: 12px (cards, sections)
- كبير: 16px (modals)

---

## 🌐 اللغة والاتجاه

- **اتجاه الصفحة:** RTL إلزامي: `<html dir="rtl" lang="ar">`
- **لغة التعليمات:** عربية فقط
- **الأمثلة الإنجليزية:** داخل `<span dir="ltr" class="en">...</span>`
- **الأرقام:** عربية (1, 2, 3) — ليست هندية (١, ٢, ٣)

---

## 🧩 12 عنصر تفاعلي إلزامي

كل صفحة درس يجب أن تحتوي:

| # | العنصر | الوصف |
|---|---|---|
| 1 | Session Timer | sticky في الأعلى، عدّاد تنازلي |
| 2 | Progress Bar | نسبة إكمال الأقسام |
| 3 | Section Checkboxes | تُحفَظ في localStorage |
| 4 | MCQ Interactive | فيدباك فوري ملوّن |
| 5 | Fill-in-blank | زر "تحقّق" + شرح |
| 6 | Voice Recorder | تسجيل قبل/بعد + playback |
| 7 | YouGlish Embed | iframe + رابط احتياطي |
| 8 | Writing Area | textarea + عدّاد كلمات |
| 9 | Auto-save | كل 30 ثانية لـ localStorage |
| 10 | Reset Day | مسح بيانات اليوم (مع تأكيد) |
| 11 | Success Checklist | معايير نهاية اليوم |
| 12 | Export System | Markdown + JSON |

---

## 📤 نظام التصدير

كل صفحة يوم تحتوي 3 أزرار:

````html
<button id="copyMarkdown" class="btn-primary">📋 نسخ Markdown للتقرير</button>
<button id="downloadJson" class="btn-secondary">💾 تنزيل JSON</button>
<button id="importJson" class="btn-tertiary">🔄 استيراد JSON</button>
````

### Markdown Export
- يُجمّع كل بيانات اليوم من localStorage
- يُنسّقها كـ markdown منظّم
- ينسخها للحافظة عبر `navigator.clipboard.writeText()`
- يُظهر toast "✓ تم النسخ" لمدة 2 ثانية

### JSON Export
- اسم الملف: `day_{N}_week_{W}_{YYYY-MM-DD}.json`
- Schema موثّق في LESSON_MARKDOWN_SPEC.md

---

## 🗣️ قسم ChatGPT Voice (إلزامي)

كل صفحة يوم تحتوي:

1. **Voice Prompt** (من Markdown frontmatter) + زر نسخ
2. **Timer 25 دقيقة** (مستقل عن Session Timer)
3. **Textarea للصق JSON من ChatGPT**
4. **زر "تحقّق من صحة JSON"**
5. **ملخّص JSON بعد اللصق:** Overall, Fluency, Top error, Top strength

---

## 💾 localStorage Schema

````javascript
{
  "day_{W}_{D}_completed_sections": ["..."],
  "day_{W}_{D}_mcq_answers": { ... },
  "day_{W}_{D}_fillblank_answers": { ... },
  "day_{W}_{D}_writing": "...",
  "day_{W}_{D}_chatgpt_json": "...",
  "day_{W}_{D}_pronunciation": { recordings: 0 },
  "day_{W}_{D}_timer_state": { ... },
  "day_{W}_{D}_last_saved": "ISO timestamp"
}
````

`W` = رقم الأسبوع، `D` = رقم اليوم.

---

## 🚨 ما لا تفعله أبداً

- ❌ لا تكتب CSS داخل ملفّات HTML الفردية
- ❌ لا تُكرّر JavaScript في كل صفحة
- ❌ لا تستخدم frameworks (React, Vue, etc.) — vanilla JS فقط
- ❌ لا تستخدم Tailwind أو أيّ CSS framework
- ❌ لا تستخدم CDN خارجي إلا لـ Google Fonts
- ❌ لا تستخدم localStorage للبيانات الحسّاسة
- ❌ لا تُغيّر بنية المجلدات
- ❌ لا تُضف Gamification (نقاط، شارات)
- ❌ لا تتعدّى 50 KB لأيّ ملف HTML
- ❌ لا تعدّل ملفّات في content/ — هي مسؤولية المدرّس
- ❌ لا تعدّل ملفّات في weeks/ يدوياً — هي مُولَّدة

---

## ✅ ما تفعله دائماً

- ✅ Semantic HTML (`<section>`, `<article>`, `<nav>`)
- ✅ كل عنصر تفاعلي له `id` واضح + `data-section="name"`
- ✅ التعليقات بالعربية والإنجليزية
- ✅ Mobile-first (اختبر على viewport 375px)
- ✅ CSS Variables لكل الألوان
- ✅ احفظ كل ملف بـ UTF-8 (بدون BOM)
- ✅ استخدم ARIA labels للوصولية
- ✅ اطلب إذني قبل أيّ تثبيت npm جديد

---

## 🔧 سكربتات البناء (المهمّة الأساسية)

### `_scripts/build_day.js`

**Input:** `npm run build:day -- 01 01`

**Process:**
1. اقرأ `content/week_01/day_01.md`
2. حلّل frontmatter (YAML metadata) عبر `gray-matter`
3. حوّل body من Markdown إلى HTML عبر `marked`
4. اقرأ `templates/lesson_template.html`
5. استبدل placeholders بالقيم
6. اكتب الناتج في `weeks/week_01/day_01.html`
7. أكّد النجاح + اعرض المسار

**Error handling:**
- لو MD غير موجود: اشرح الخطأ + اقترح حلّاً
- لو frontmatter ناقص: اعرض الحقول المفقودة
- لو شكل MD خاطئ: اعرض السطر المشكلة

### `_scripts/build_week.js`

**Input:** `npm run build:week -- 01`

**Process:** يستدعي `build_day.js` لكل أيام الأسبوع.

### `_scripts/upload_day.bat`

````batch
@echo off
git add weeks/week_%1/day_%2.html content/week_%1/day_%2.md
git commit -m "Day %2 of Week %1"
git push origin main
echo.
echo Done! Wait 1 minute for GitHub Pages to update.
echo Link: https://s5xx5s.github.io/english-learning-system/weeks/week_%1/day_%2.html
pause
````

### `_scripts/new_day.bat`

````batch
@echo off
if not exist "content\week_%1" mkdir "content\week_%1"
copy "templates\day_template.md" "content\week_%1\day_%2.md"
echo Created content\week_%1\day_%2.md
echo Now paste lesson content from Claude (chat).
pause
````

---

## 📋 index.html (الصفحة الرئيسية)

محتواها:
- جدول 36 أسبوع × 7 أيام = 252 خلية
- كل خلية: مربع صغير + رقم اليوم
- ألوان حسب الحالة (من localStorage):
  - أبيض: لم يُفتح
  - أزرق فاتح: الحالي
  - أخضر: مكتمل
- نقرة على خلية → `weeks/week_XX/day_XX.html`
- شريط جانبي: إحصائيات (الأيام المكتملة / 252، الكلمات الإجمالية، إلخ)

---

## 🎯 معيار الجودة قبل أيّ commit

- [ ] يفتح بدون أخطاء في Console
- [ ] يعمل على Chrome + Safari
- [ ] يعمل على viewport 375px (iPhone)
- [ ] جميع الأزرار تفاعلية
- [ ] localStorage يعمل
- [ ] لا CSS مدمج
- [ ] لا JS مدمج
- [ ] الـ RTL صحيح
- [ ] الخطوط محمّلة
- [ ] الألوان من CSS Variables فقط

---

## 🛑 إذا واجهت قراراً غير موثّق

- **لا تقرّر بنفسك**
- اسأل المستخدم سؤالاً محدّداً بإجابات قصيرة
- اقترح بديلين أو ثلاثة
- اذكر توصيتك بصراحة

---

## 🎬 ابدأ كل جلسة بـ

عند فتح Claude Code:
1. اقرأ CLAUDE.md
2. اقرأ آخر commits: `git log --oneline -5`
3. تحقّق من حالة الملفّات: `git status`
4. اسأل: "ما المهمّة اليوم؟"

**لا تبدأ ببناء أيّ شيء دون مهمّة محدّدة.**

---

بعد حفظ الملف، نفّذ:
git add CLAUDE.md
git commit -m "Add CLAUDE.md project instructions"
git push origin main

ثم أبلغني بالإنجاز.