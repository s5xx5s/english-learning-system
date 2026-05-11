# English Learning System

منصّة تعلّم إنجليزية تفاعلية لمدّة 9 أشهر (36 أسبوعاً، 252 يوماً) — من B1 إلى C1.

## ما هذا المشروع؟

كل يوم درس قائم بذاته فيه:

- بودكاست (40 دقيقة)
- قاعدة + تمارين (25 دقيقة)
- Spelling + تمارين (15 دقيقة)
- قراءة قصيرة (15 دقيقة)
- تدريب نطق YouGlish + تسجيل صوت (10 دقائق)
- محادثة صوتيّة مع ChatGPT (25 دقيقة)
- كتابة (15 دقيقة)
- بطاقات MintDeck (10 دقائق)

المدرّس يكتب الدرس بصيغة Markdown، وسكربت Node.js يحوّله إلى صفحة HTML تفاعليّة تُستضاف على GitHub Pages.

**الرابط الحيّ:** https://s5xx5s.github.io/english-learning-system/

## كيف أستخدمه يومياً (3 خطوات)

### 1. إنشاء يوم جديد

افتح PowerShell في مجلّد المشروع ونفّذ:

```powershell
_scripts\new_day.bat 01 01
```

هذا يُنشئ ملفّ `content/week_01/day_01.md` من القالب الفارغ.

افتح الملفّ والصق محتوى الدرس (من المدرّس).

### 2. بناء الـ HTML

```powershell
npm run build:day -- 01 01
```

السكربت يقرأ Markdown، يحوّله إلى HTML تفاعليّ مكتمل، ويحفظه في `weeks/week_01/day_01.html`.

افتحه بالنقر المزدوج للتجربة المحلّيّة.

### 3. الرفع على GitHub

```powershell
_scripts\upload_day.bat 01 01
```

هذا يعمل `git add` + `commit` + `push` ويعطيك رابط الصفحة الحيّ.

انتظر دقيقة، ثمّ افتح الرابط من جوّالك (أو أيّ متصفّح).

## أوامر إضافيّة

| الأمر | الوصف |
|------|--------|
| `npm run build:week -- 01` | يبني كل أيّام الأسبوع 01 دفعةً واحدة |
| `_scripts\upload_week.bat 01` | يرفع كل ملفّات الأسبوع 01 دفعةً واحدة |
| `index.html` | لوحة التحكّم — تعرض تقدّمك في 36×7 خليّة |
| `reports/daily_report.html` | نموذج التقرير اليومي للنسخ في رسالة Claude |

## بنية المجلّدات

```
english-learning-system/
├── index.html                 لوحة التحكّم
├── CLAUDE.md                  تعليمات Claude الدائمة
├── LESSON_MARKDOWN_SPEC.md    عقد تحويل MD إلى HTML
├── package.json               تبعيّات Node.js
│
├── content/                   Markdown من المدرّس
│   └── week_01/
│       └── day_01.md
│
├── weeks/                     HTML المُولَّد (لا يُعدَّل يدوياً)
│   ├── manifest.json          قائمة الأيّام المبنيّة
│   └── week_01/
│       └── day_01.html
│
├── shared/                    CSS و JS مشترك بين الصفحات
│   ├── styles.css
│   ├── storage.js
│   ├── interactive.js
│   ├── audio.js
│   └── dashboard.js
│
├── templates/                 قوالب البناء
│   ├── lesson_template.html
│   └── day_template.md
│
├── reports/
│   └── daily_report.html
│
└── _scripts/                  سكربتات Node.js و Windows
    ├── build_day.js
    ├── build_week.js
    ├── new_day.bat
    ├── upload_day.bat
    └── upload_week.bat
```

## استكشاف الأخطاء البسيطة

### "git is not recognized" أو "node is not recognized"

افتح PowerShell جديد (أحياناً Windows يحتاج جلسة جديدة بعد تثبيت أداة).

### "npm: command not found"

تأكّد من تثبيت Node.js: https://nodejs.org/ (LTS).

### الأمر `npm run build:day` يعطي خطأ "Cannot find module"

في مجلّد المشروع، شغّل: `npm install`

### الرابط الحيّ لا يفتح / 404

- بعد الـ push انتظر 1-2 دقيقة (GitHub Pages تحتاج وقت للنشر)
- تأكّد من أنّ Repository **public**
- تأكّد من تفعيل GitHub Pages في إعدادات Repo (Settings → Pages → Source: main / root)

### الـ Dashboard على جهازي يظهر كل الأيّام "غير مبنيّة"

المتصفّحات (Chrome / Edge / Safari) تمنع قراءة `manifest.json` من الملفّات المحلّيّة (`file://`).

الحلّ:
- استخدم Firefox (يسمح بهذا محلّياً)
- أو شغّل خادماً محلّياً: `npx serve` في مجلّد المشروع
- أو افتح الموقع من رابط GitHub Pages مباشرةً (`https://`)

### بياناتي اختفت بعد إعادة تشغيل المتصفّح

بيانات الطلّاب محفوظة في `localStorage` للنطاق (`origin`). إذا فتحت الصفحة من file:// مرّة ومن https:// مرّة، لكلٍّ منهما بيانات منفصلة.

التوصية: استعمل دائماً الرابط الحيّ نفسه (https://s5xx5s.github.io/...).

### الفيديو في YouGlish لا يعمل

YouGlish تطلب اتّصال إنترنت، وأحياناً تمنع iframe في بعض الشبكات. استخدم رابط "فتح خارجي" بدلاً منه.

### الميكروفون لا يعمل في Voice Recorder

- المتصفّح يطلب إذناً للميكروفون أوّل مرّة — وافِق
- file:// قد لا يدعم MediaRecorder في بعض المتصفّحات — افتح من https:// أو localhost
- على Windows، تأكّد من أنّ التطبيق مسموح له بالميكروفون في إعدادات الخصوصيّة

## المتطلّبات

- Node.js 18+
- Git
- GitHub CLI (اختياري — لتسجيل الدخول)
- متصفّح حديث (Chrome 90+، Firefox 88+، Safari 14+)

## الترخيص

الاستخدام الشخصي والتعليمي.
