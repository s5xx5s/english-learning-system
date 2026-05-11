/* =====================================================================
   _scripts/build_week.js
   Builds every day_*.md in content/week_XX/  →  weeks/week_XX/*.html
   Usage: npm run build:week -- 01
   ===================================================================== */

'use strict';

const fs = require('fs');
const path = require('path');
const { buildDay } = require('./build_day');

const ROOT = path.join(__dirname, '..');

function pad(n) { return String(n).padStart(2, '0'); }

function main() {
  const weekArg = process.argv[2];
  if (!weekArg) {
    console.error('\nError: الاستخدام: npm run build:week -- WW');
    console.error('   مثال: npm run build:week -- 01\n');
    process.exit(1);
  }

  const week = pad(weekArg);
  const contentDir = path.join(ROOT, 'content', 'week_' + week);

  if (!fs.existsSync(contentDir)) {
    console.error('\nError: مجلد المحتوى غير موجود: ' + path.relative(ROOT, contentDir));
    console.error('   تأكّد من رقم الأسبوع.\n');
    process.exit(1);
  }

  const files = fs.readdirSync(contentDir)
    .filter(f => /^day_\d+\.md$/.test(f))
    .sort();

  if (files.length === 0) {
    console.warn('WARNING: لا توجد ملفّات day_XX.md في ' + path.relative(ROOT, contentDir));
    return;
  }

  console.log('— بناء أسبوع ' + week + ' (' + files.length + ' ملفّ) —\n');

  let succeeded = 0;
  let failed = 0;
  files.forEach(file => {
    const dayMatch = file.match(/^day_(\d+)\.md$/);
    if (!dayMatch) return;
    const day = pad(dayMatch[1]);
    try {
      buildDay(week, day);
      succeeded++;
    } catch (e) {
      console.error('  Error: فشل day ' + day + ': ' + (e && e.message ? e.message : e));
      failed++;
    }
  });

  console.log('\n— انتهى: ' + succeeded + ' نجاح، ' + failed + ' فشل —');
  if (failed > 0) process.exit(1);
}

if (require.main === module) main();
