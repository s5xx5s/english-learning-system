/* =====================================================================
   _scripts/tests/syntax.test.js
   Six lightweight assertions covering the explicit English-wrapping
   syntax (::token::  +  :::block sentence:::).
   Run with: node _scripts/tests/syntax.test.js
   ===================================================================== */

'use strict';

const assert = require('assert');
const { processContent } = require('../build_day');

let passed = 0;
let failed = 0;

function check(label, fn) {
  try {
    fn();
    console.log('  PASS  ' + label);
    passed++;
  } catch (e) {
    console.error('  FAIL  ' + label);
    console.error('        ' + (e && e.message || e));
    failed++;
  }
}

/* 1. inline ::word:: → span.en --------------------------------------- */
check('inline ::word:: wraps as span.en', () => {
  const out = processContent('قال ::hello:: للعالم');
  assert.ok(out.includes('<span class="en">hello</span>'),
    'expected <span class="en">hello</span> in: ' + out);
});

/* 2. :::block sentence::: → div.en-block ----------------------------- */
check(':::block ...::: wraps as div.en-block', () => {
  const out = processContent(':::block This is a sentence.:::');
  assert.ok(out.includes('<div class="en-block">This is a sentence.</div>'),
    'expected <div class="en-block">... in: ' + out);
});

/* 3. punctuation stays inside the span ------------------------------- */
check('punctuation stays inside span.en', () => {
  const out = processContent('قال ::Hello, world!:: ثم سكت');
  assert.ok(out.includes('<span class="en">Hello, world!</span>'),
    'expected <span class="en">Hello, world!</span> in: ' + out);
});

/* 4. unmarked English is NOT wrapped by transformInlineEnglish ------- */
/*    (the legacy wrapInlineEnglish fallback may still wrap it later;
 *     we only check that nothing with `class="en"` AND content `hello`
 *     came from the explicit pass — easiest check is to look for the
 *     exact escaped output transformInlineEnglish would emit.) */
check('plain English without :: is not touched by explicit wrapper', () => {
  // No `::` in input — transformInlineEnglish must not run.
  // The legacy fallback may wrap it inside <p>, but transformInline's
  // signature output `<span class="en">hello</span>` (no extras) would
  // appear only from the explicit replacer. The fallback emits the same
  // pattern, so we instead assert nothing changes when the explicit
  // syntax is absent AND there's no English phrase the fallback would
  // catch (i.e., a single bare word, which the fallback skips because
  // it needs 2+ words).
  const out = processContent('قال hello للعالم');
  // Single English word — fallback only wraps phrases (2+ words), so
  // nothing should be wrapped at all.
  assert.ok(!out.includes('<span class="en">hello</span>'),
    'single bare English word should NOT auto-wrap; got: ' + out);
});

/* 5. block runs BEFORE inline (order matters) ------------------------ */
check('block transform runs before inline transform', () => {
  const out = processContent(':::block A B C:::\n\nو ::D E::');
  assert.ok(out.includes('en-block'),  'expected en-block in: ' + out);
  assert.ok(out.includes('class="en">D E'), 'expected inline D E in: ' + out);
});

/* 6. content with slashes / dashes still works ----------------------- */
check('::-s/-es/-ies:: with slashes wraps correctly', () => {
  const out = processContent('قواعد ::-s/-es/-ies:: للجمع');
  assert.ok(out.includes('<span class="en">-s/-es/-ies</span>'),
    'expected <span class="en">-s/-es/-ies</span> in: ' + out);
});

/* 7. :::block ...::: inside :::fillblank::: becomes .en-inline-sentence,
      input tag survives, and no raw `:::block` leaks --------------------- */
check(':::block::: inside fillblank wraps as en-inline-sentence + keeps <input>', () => {
  const md = [
    ':::fillblank id="t7"',
    '**Sentence:** :::block She _____ engineering. (study):::',
    '**Answer:** studies',
    ':::'
  ].join('\n');
  const out = processContent(md);
  assert.ok(out.includes('en-inline-sentence'),  'no .en-inline-sentence in: ' + out);
  assert.ok(out.includes('class="fillblank-input"'), 'no <input> in: ' + out);
  assert.ok(!/:::?block/.test(out),               'leftover :::block in: ' + out);
});

/* 8. MCQ with **Q1:** prefix captures the question text ---------------- */
check('MCQ accepts **Q1:** (digits after Q)', () => {
  const md = [
    ':::mcq id="t8"',
    '**Q1:** Which is correct?',
    '- [x] :::block He works.:::',
    '- [ ] :::block He work.:::',
    ':::'
  ].join('\n');
  const out = processContent(md);
  assert.ok(/<p class="mcq-question"><strong>Q:<\/strong>\s+Which is correct/.test(out),
    'MCQ question text missing in: ' + out);
});

/* 9. :::block::: inside a markdown table cell is inline, not block ---- */
check(':::block::: inside a table cell renders inline (no <div class="en-block">)', () => {
  const md = [
    '| الاستخدام | مثال |',
    '|---|---|',
    '| روتين | :::block I work at Google.::: |'
  ].join('\n');
  const out = processContent(md);
  assert.ok(/<td>[^<]*<span class="en-inline-sentence">I work at Google\.<\/span>/.test(out),
    'expected inline span inside <td>, got: ' + out);
  assert.ok(!out.includes('<div class="en-block">'),
    'must NOT use block-level <div class="en-block"> inside a cell: ' + out);
});

/* --------------------------------------------------------------------- */
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
