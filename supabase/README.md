# Supabase — Setup Guide

> دليل خطوة-بخطوة لإنشاء مشروع Supabase الجديد + نسخ الـ migrations + إنشاء حساب المستخدم.

---

## 1. إنشاء المشروع

1. اذهب إلى https://supabase.com وسجّل دخول (أو أنشئ حساباً).
2. **New Project**:
   - **Name:** `english-learning-system`
   - **Database password:** أنشئ كلمة قوية واحفظها (مدير كلمات السرّ مُستحسن).
   - **Region:** `me-central-1 (Bahrain)` إن متاح، وإلّا `eu-central-1 (Frankfurt)`.
   - **Pricing Plan:** Free
3. انتظر 2-3 دقائق حتّى ينتهي إنشاء المشروع.

---

## 2. تطبيق Migrations (بالترتيب)

من لوحة Supabase: **SQL Editor** → **New Query**.

طبّق الـ 3 ملفّات بالترتيب الصارم:

| # | الملف | متى |
|---|---|---|
| 1 | `migrations/0001_initial_schema.sql` | أوّلاً — ينشئ 9 جداول |
| 2 | `migrations/0002_triggers.sql` | بعد 1 — يضيف trigger توليد البطاقات |
| 3 | `migrations/0003_rls_policies.sql` | أخيراً — يفعّل Row Level Security |

لكلّ ملف: انسخ المحتوى، الصقه في SQL Editor، اضغط **Run**. تأكّد من ظهور "Success" قبل الانتقال للتالي.

**تحقّق سريع:**
```sql
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'users','days','chatgpt_reports','errors','cards',
    'writings','recordings','idioms','silence_sessions'
  );
-- يجب أن يُرجع: 9
```

---

## 3. إنشاء حساب Auth + Seed

### 3.1 إنشاء المستخدم
**Authentication** → **Users** → **Add user**:
- **Email:** بريدك
- **Password:** كلمة قوية
- **Auto-confirm:** ✓

بعد الإنشاء، انقر على المستخدم وانسخ **UID** (UUID طويل).

### 3.2 نسخ الـ Seed وتشغيله

```bash
# في جهازك المحلّي:
cp supabase/seed.sql.template supabase/seed.sql
# (هذا الملف مُتجاهَل في .gitignore — لن يُرفع لـ GitHub)
```

افتح `supabase/seed.sql`، استبدل:
- `AUTH_UID_PLACEHOLDER` ← الـ UID من الخطوة 3.1
- `EMAIL_PLACEHOLDER` ← بريدك

انسخ الناتج إلى Supabase SQL Editor واضغط **Run**.

تحقّق:
```sql
SELECT id, email, level FROM users;
-- يجب أن يُرجع صفّاً واحداً.
```

---

## 4. اختبار الـ Trigger يدوياً

في SQL Editor:

```sql
-- (أ) أنشئ خطأ تجريبي
INSERT INTO errors (user_id, error_type, wrong_form, correct_form,
                    rule_violated, source, occurrence_count)
VALUES ((SELECT id FROM users LIMIT 1), 'grammar', 'He work', 'He works',
        '3rd person singular needs -s', 'claude_manual', 1)
RETURNING id;
-- احفظ الـ id الذي يظهر.

-- (ب) ادفعه إلى 3 — يجب أن يولّد بطاقة
UPDATE errors SET occurrence_count = 3
WHERE id = '<paste-id-here>'
RETURNING card_generated, card_id;
-- card_generated يجب أن يصبح TRUE
-- card_id يجب أن يحتوي UUID

-- (ج) تأكّد من البطاقة
SELECT id, card_type, front, back FROM cards WHERE source_id = '<paste-id-here>';
-- يجب أن ترى صفّاً واحداً، card_type = 'personal_error'

-- (د) نظّف
DELETE FROM cards  WHERE source_id = '<paste-id-here>';
DELETE FROM errors WHERE id = '<paste-id-here>';
```

---

## 5. الحصول على المفاتيح (لـ `.env.local`)

**Project Settings** → **API**:
- **Project URL** ← `SUPABASE_URL`
- **Project API keys → anon (public)** ← `SUPABASE_ANON_KEY`
- **Project API keys → service_role (secret)** ← `SUPABASE_SERVICE_KEY`

أنشئ `.env.local` في جذر المشروع (مُتجاهَل في git):

```
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...long...
SUPABASE_SERVICE_KEY=eyJ...long...
```

**⚠️ تحذير:** الـ `SERVICE_KEY` يتجاوز RLS. لا تضعه أبداً في أيّ ملفّ يُرفع لـ GitHub. يُستخدَم فقط لسكربتات admin محلّيّة.

---

## 6. ماذا بعد؟

أخبرني (Claude Code) عبر الشات:
- "أنشأت المشروع، خذ المفاتيح" + ألصق المفاتيح + بريدك.

سأكمل المرحلة 1.1 (supabase-client.js) ثمّ 1.2 (LanguageTool) ثمّ 1.3 (Error Log Dashboard).
