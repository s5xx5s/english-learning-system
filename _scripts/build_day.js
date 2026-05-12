/* =====================================================================
   _scripts/build_day.js
   Converts content/week_XX/day_XX.md  →  weeks/week_XX/day_XX.html

   English handling: explicit syntax only.
     ::Token::            → <span class="en">Token</span>
     :::block Sentence::: → <div class="en-block">Sentence</div>

   wrapInlineEnglish() (legacy auto-wrap) is still applied AFTER marked
   as a fallback for content that has not yet been migrated to explicit
   syntax. It will be removed once all lesson files are migrated.

   Usage: npm run build:day -- 01 01
   ===================================================================== */

'use strict';

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');

const ROOT = path.join(__dirname, '..');

const SECTION_IDS = [
  'PODCAST_INSTRUCTIONS',
  'WHY', 'HOOK',
  'GRAMMAR', 'GRAMMAR_EXERCISES', 'GRAMMAR_MINI_REVIEW',
  'SPELLING', 'SPELLING_EXERCISES', 'READING',
  'PRONUNCIATION', 'CHATGPT', 'WRITING_GUIDE', 'MINTDECK'
];

/* --------- tiny helpers --------- */

function pad(n) { return String(n).padStart(2, '0'); }

function fail(msg, details) {
  const full = 'Error: ' + msg + (details ? '\n   ' + String(details).split('\n').join('\n   ') : '');
  throw new Error(full);
}

function ok(msg) { console.log('OK: ' + msg); }

function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escape <, >, & only — leaves * and _ alone so renderInline() can still
 *  pick them up as bold/italic. Used inside custom blocks. */
function escapeHtmlExceptMd(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Inline-only markdown: bold, italic, code, links. NOT block-level. */
function renderInline(md) {
  if (!md) return '';
  let s = md;
  s = s.replace(/`([^`]+)`/g, (_, c) => '<code>' + escapeHtml(c) + '</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, txt, url) =>
    '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' + txt + '</a>');
  return s;
}

/** Parse a "key=value" attribute string from a fence header. */
function parseAttrs(str) {
  const attrs = {};
  if (!str) return attrs;
  const re = /(\w+)="([^"]*)"/g;
  let m;
  while ((m = re.exec(str)) !== null) attrs[m[1]] = m[2];
  return attrs;
}

/* =====================================================================
   1. EXPLICIT English wrappers — the new contract
   ===================================================================== */

/**
 * `:::block English sentence here:::`  →  `<div class="en-block">...</div>`
 *
 * Must run BEFORE the inline `::...::` replacer, otherwise the inner `::`
 * pair (if any) would be eaten first.  Block delimiter `:::` is unambiguous
 * — it can never be part of a balanced `::token::`.
 *
 * The content cannot itself contain `:::` (we do not nest blocks).
 * Anchored to start/end of line via `^...$` + multiline flag so it stays
 * block-level and marked() never wraps it inside a `<p>`.
 */
function transformBlockEnglish(text) {
  return text.replace(
    /^:::block\s+([\s\S]+?)\s*:::$/gm,
    (_, content) => '\n\n<div class="en-block">' + escapeHtml(content.trim()) + '</div>\n\n'
  );
}

/**
 * `::English token::`  →  `<span class="en">...</span>`
 *
 * Uses `[^:\n]+?` (not `[\s\S]+?`) so the pattern cannot cross a `::`
 * boundary or a newline — that keeps inline wraps tight to a single
 * phrase and avoids accidentally swallowing the next token.
 *
 * Empty / whitespace-only content is left as raw text (we don't want
 * `::` literals to vanish silently).
 */
function transformInlineEnglish(text) {
  return text.replace(
    /::([^:\n]+?)::/g,
    (match, content) => {
      const trimmed = content.trim();
      if (!trimmed) return match;
      return '<span class="en">' + escapeHtml(trimmed) + '</span>';
    }
  );
}

/* =====================================================================
   2. Body-level frontmatter interpolation
      Expands {{lowercase_field}} (and dotted paths like
      {{resources.podcast_url}}) inside the MD body before marked() runs.
      Missing fields are left untouched so the teacher sees the typo.
   ===================================================================== */
function interpolateFrontmatter(md, data) {
  function lookup(key) {
    if (key.indexOf('.') !== -1) {
      const parts = key.split('.');
      let v = data;
      for (const p of parts) {
        if (v === null || v === undefined || typeof v !== 'object') return undefined;
        v = v[p];
      }
      return v;
    }
    if (data[key] !== undefined && typeof data[key] !== 'object') return data[key];
    for (const k of Object.keys(data)) {
      const child = data[k];
      if (child && typeof child === 'object' && !Array.isArray(child)) {
        if (child[key] !== undefined && typeof child[key] !== 'object') return child[key];
      }
    }
    return undefined;
  }

  return md.replace(/\{\{([a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*)\}\}/g, (m, key) => {
    const v = lookup(key);
    if (v === null || v === undefined) return m;
    return String(v).replace(/\n+$/, '');
  });
}

/* =====================================================================
   3. Legacy fallback: wrapInlineEnglish (post-marked)
      Wraps untagged English PHRASES so older lessons that haven't been
      migrated to ::syntax:: still render correctly. Skips content already
      inside <code>, <a>, <span>, or <bdi> — so an explicit <span class="en">
      from transformInlineEnglish() is NOT double-wrapped.
   ===================================================================== */
function wrapInlineEnglish(html) {
  const QUOTE = '(?:&quot;|&#39;|["\'‘’“”])';
  const SEP   = '(?:\\s|[.,;:!?()\\-–—]|&(?:quot|#39);)';
  const WORD  = '[A-Za-z0-9’\']+';
  const TAIL  = '[A-Za-z0-9.!?,’)\\]]?';

  const PHRASE_RE = new RegExp(
    '(?<![<\\w])(' +
      QUOTE + '[A-Za-z][A-Za-z0-9’\'\\-]*(?:' + SEP + '+' + WORD + ')*[A-Za-z0-9.!?,]?' + QUOTE +
    '|' +
      '[A-Za-z][A-Za-z0-9’\'\\-]*(?:' + SEP + '+' + WORD + ')+' + TAIL +
    ')(?![\\w>])',
    'g'
  );

  const QUOTE_EDGE_RE = /(?:&quot;|&#39;|["'‘’“”])/;
  function isQuoted(t) {
    return new RegExp('^' + QUOTE_EDGE_RE.source).test(t) &&
           new RegExp(QUOTE_EDGE_RE.source + '$').test(t);
  }

  return html.replace(
    /(<(p|li|blockquote)\b[^>]*>)([\s\S]*?)(<\/\2>)/g,
    (full, openTag, _name, content, closeTag) => {
      let out = '';
      let i = 0;
      while (i < content.length) {
        const lt = content.indexOf('<', i);
        const chunk = (lt === -1) ? content.slice(i) : content.slice(i, lt);
        if (chunk.length) {
          out += chunk.replace(PHRASE_RE, (match, captured) => {
            const quoted = isQuoted(captured);
            let cls = 'en';
            if (quoted) cls += ' en-quoted';
            return '<span class="' + cls + '">' + captured + '</span>';
          });
        }
        if (lt === -1) break;

        const gt = content.indexOf('>', lt);
        if (gt === -1) { out += content.slice(lt); break; }
        const tagName = (content.slice(lt + 1, gt).match(/^\/?(\w+)/) || [])[1] || '';
        const skipContents = ['code', 'a', 'bdi', 'span'];
        if (skipContents.indexOf(tagName.toLowerCase()) !== -1 && content[lt + 1] !== '/') {
          const close = '</' + tagName + '>';
          const ci = content.toLowerCase().indexOf(close.toLowerCase(), gt);
          if (ci !== -1) {
            out += content.slice(lt, ci + close.length);
            i = ci + close.length;
            continue;
          }
        }
        out += content.slice(lt, gt + 1);
        i = gt + 1;
      }
      return openTag + out + closeTag;
    }
  );
}

/* =====================================================================
   4. Custom block transformers
   ===================================================================== */

/** Generic ::: block matcher.
 *  Captures: 1=type-token attrs string, 2=inner content body. */
function transformBlocks(md, type, render) {
  const re = new RegExp(
    ':::' + type + '\\s*([^\\n]*)\\n([\\s\\S]*?)\\n:::',
    'g'
  );
  return md.replace(re, (_, attrsRaw, inner) => {
    const attrs = parseAttrs(attrsRaw);
    return '\n\n' + render(attrs, inner.trim()) + '\n\n';
  });
}

/* -- MCQ -- */
function transformMCQ(md) {
  return transformBlocks(md, 'mcq', (attrs, inner) => {
    const id = escapeHtml(attrs.id || 'mcq-' + Math.random().toString(36).slice(2, 8));
    const lines = inner.split('\n');
    let question = '';
    let explanation = '';
    const options = [];
    lines.forEach(line => {
      const t = line.trim();
      if (/^\*\*Q:\*\*/i.test(t)) {
        question = t.replace(/^\*\*Q:\*\*\s*/i, '');
      } else if (/^\*\*Explanation:\*\*/i.test(t)) {
        explanation = t.replace(/^\*\*Explanation:\*\*\s*/i, '');
      } else if (/^-\s*\[[ xX]\]/.test(t)) {
        const correct = /^-\s*\[[xX]\]/.test(t);
        const text = t.replace(/^-\s*\[[ xX]\]\s*/, '');
        options.push({ correct, text });
      }
    });

    const opts = options.map(o =>
      '    <button type="button" class="mcq-option" data-correct="' + o.correct + '">' +
      renderInline(escapeHtmlExceptMd(o.text)) + '</button>'
    ).join('\n');

    const feedback = explanation
      ? '\n  <div class="mcq-feedback" hidden>\n    <p><strong>Explanation:</strong> ' + renderInline(escapeHtmlExceptMd(explanation)) + '</p>\n  </div>'
      : '';

    return [
      '<div class="mcq-block" data-mcq-id="' + id + '">',
      '  <p class="mcq-question"><strong>Q:</strong> ' + renderInline(escapeHtmlExceptMd(question)) + '</p>',
      '  <div class="mcq-options">',
      opts,
      '  </div>' + feedback,
      '</div>'
    ].join('\n');
  });
}

/* -- Fill-in-blank -- */
function transformFillBlank(md) {
  return transformBlocks(md, 'fillblank', (attrs, inner) => {
    const id = escapeHtml(attrs.id || 'fb-' + Math.random().toString(36).slice(2, 8));
    let sentence = '', answer = '', hint = '', rule = '';
    inner.split('\n').forEach(line => {
      const t = line.trim();
      if (/^\*\*Sentence:\*\*/i.test(t)) sentence = t.replace(/^\*\*Sentence:\*\*\s*/i, '');
      else if (/^\*\*Answer:\*\*/i.test(t)) answer = t.replace(/^\*\*Answer:\*\*\s*/i, '');
      else if (/^\*\*Hint:\*\*/i.test(t)) hint = t.replace(/^\*\*Hint:\*\*\s*/i, '');
      else if (/^\*\*Rule:\*\*/i.test(t)) rule = t.replace(/^\*\*Rule:\*\*\s*/i, '');
    });

    const inputHtml = '<input type="text" class="fillblank-input" data-answer="' +
      escapeHtml(answer.trim()) + '" placeholder="?" aria-label="املأ الفراغ">';
    const sentenceHtml = renderInline(escapeHtmlExceptMd(sentence))
      .replace(/_{3,}/, inputHtml);

    const feedbackParts = [];
    if (hint) feedbackParts.push('    <p class="hint"><strong>Hint:</strong> ' + renderInline(escapeHtmlExceptMd(hint)) + '</p>');
    if (rule) feedbackParts.push('    <p class="rule"><strong>Rule:</strong> ' + renderInline(escapeHtmlExceptMd(rule)) + '</p>');
    const feedback = feedbackParts.length
      ? '\n  <div class="fillblank-feedback" hidden>\n' + feedbackParts.join('\n') + '\n  </div>'
      : '';

    return [
      '<div class="fillblank-block" data-fillblank-id="' + id + '">',
      '  <p class="fillblank-sentence">' + sentenceHtml + '</p>',
      '  <button type="button" class="fillblank-check btn-secondary">تحقّق</button>' + feedback,
      '</div>'
    ].join('\n');
  });
}

/* -- Free Writing -- */
function transformFreeWriting(md) {
  return transformBlocks(md, 'freewriting', (attrs, inner) => {
    const id = escapeHtml(attrs.id || 'fw-' + Math.random().toString(36).slice(2, 8));
    let prompt = '', minWords = 0;
    const requirements = [];
    let inTargets = false;
    inner.split('\n').forEach(line => {
      const t = line.trim();
      if (/^\*\*Prompt:\*\*/i.test(t)) { prompt = t.replace(/^\*\*Prompt:\*\*\s*/i, ''); inTargets = false; }
      else if (/^\*\*Min words:\*\*/i.test(t)) { minWords = parseInt(t.replace(/\D/g, ''), 10) || 0; inTargets = false; }
      else if (/^\*\*Target structures:\*\*/i.test(t)) { inTargets = true; }
      else if (inTargets && /^-\s+/.test(t)) { requirements.push(t.replace(/^-\s+/, '')); }
    });

    const reqHtml = requirements.length
      ? '  <ul class="fw-requirements">\n' +
        requirements.map(r => '    <li>' + renderInline(escapeHtmlExceptMd(r)) + '</li>').join('\n') +
        '\n  </ul>'
      : '';

    return [
      '<div class="freewriting-block" data-fw-id="' + id + '">',
      '  <p class="fw-prompt">' + renderInline(escapeHtmlExceptMd(prompt)) + '</p>',
      reqHtml,
      '  <textarea class="fw-input" data-min-words="' + minWords + '" placeholder="اكتب هنا..." aria-label="منطقة الكتابة الحرّة"></textarea>',
      '  <div class="fw-meta">',
      '    <span class="word-counter">0 / ' + minWords + ' كلمة</span>',
      '  </div>',
      '</div>'
    ].filter(Boolean).join('\n');
  });
}

/* -- Pronunciation block (3 buttons: Cambridge / Forvo / YouGlish) --
 *
 *   :::pronunciation
 *   - works | /wɜːrks/ | نطق /s/
 *   - goes  | /ɡoʊz/  | نطق /z/
 *   :::
 *
 * Each line is "word | ipa? | note?" — only `word` is required.
 */
function transformPronunciation(md) {
  return md.replace(
    /:::pronunciation\s*\n([\s\S]+?)\n:::/g,
    (_, body) => {
      const items = body
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.startsWith('-'))
        .map(line => {
          const cleaned = line.replace(/^-\s*/, '');
          const parts = cleaned.split('|').map(s => s.trim());
          const word = parts[0] || '';
          const ipa  = parts[1] || '';
          const note = parts[2] || '';
          if (!word) return '';
          const encoded = encodeURIComponent(word);
          return [
            '  <div class="pron-item">',
            '    <span class="pron-word">' + escapeHtml(word) + '</span>',
            ipa  ? '    <span class="pron-ipa">' + escapeHtml(ipa) + '</span>' : '',
            note ? '    <span class="pron-note">' + escapeHtml(note) + '</span>' : '',
            '    <span class="pron-buttons">',
            '      <a class="pron-btn pron-btn-cambridge" href="https://dictionary.cambridge.org/dictionary/english/' + encoded + '" target="_blank" rel="noopener">Cambridge</a>',
            '      <a class="pron-btn pron-btn-forvo" href="https://forvo.com/word/' + encoded + '/#en" target="_blank" rel="noopener">Forvo</a>',
            '      <a class="pron-btn pron-btn-youglish" href="https://youglish.com/pronounce/' + encoded + '/english/us" target="_blank" rel="noopener">YouGlish</a>',
            '    </span>',
            '  </div>'
          ].filter(Boolean).join('\n');
        })
        .filter(Boolean)
        .join('\n');
      return '\n\n<div class="pronunciation-block">\n' + items + '\n</div>\n\n';
    }
  );
}

/* -- YouGlish (legacy block, still supported) -- */
function transformYouGlish(md) {
  return transformBlocks(md, 'youglish', (attrs, inner) => {
    const items = inner.split('\n')
      .map(l => l.trim())
      .filter(l => /^-\s+/.test(l))
      .map(l => {
        const body = l.replace(/^-\s+/, '');
        const [word, note] = body.split('|').map(s => (s || '').trim());
        return { word: word || '', note: note || '' };
      })
      .filter(it => it.word);

    const itemsHtml = items.map(it => {
      const word = escapeHtml(it.word);
      const note = escapeHtml(it.note);
      const url = 'https://youglish.com/pronounce/' + encodeURIComponent(it.word) + '/english/us';
      return [
        '  <div class="youglish-item">',
        '    <span class="yg-word">' + word + '</span>',
        '    <span class="yg-note">' + note + '</span>',
        '    <button type="button" class="yg-embed-btn btn-tertiary" data-word="' + word + '">شاهد داخل الصفحة</button>',
        '    <a href="' + url + '" target="_blank" rel="noopener noreferrer" class="yg-link">فتح خارجي</a>',
        '  </div>'
      ].join('\n');
    }).join('\n');

    return ['<div class="youglish-block">', itemsHtml, '</div>'].join('\n');
  });
}

/* -- Voice Recorder -- */
function transformVoiceRecorder(md) {
  return transformBlocks(md, 'voicerecorder', (attrs, inner) => {
    const id = escapeHtml(attrs.id || 'vr-' + Math.random().toString(36).slice(2, 8));
    const word = escapeHtml(attrs.word || '');
    let task = '';
    inner.split('\n').forEach(line => {
      const t = line.trim();
      if (/^\*\*Task:\*\*/i.test(t)) task = t.replace(/^\*\*Task:\*\*\s*/i, '');
      else if (t && !task) task = t;
    });

    return [
      '<div class="voice-recorder-block" data-vr-id="' + id + '" data-word="' + word + '">',
      '  <p class="vr-task">' + renderInline(escapeHtmlExceptMd(task)) + '</p>',
      '  <div class="vr-controls">',
      '    <div class="vr-row">',
      '      <button type="button" class="vr-record-before btn-secondary">تسجيل قبل</button>',
      '      <audio class="vr-audio-before" controls hidden></audio>',
      '    </div>',
      '    <div class="vr-row">',
      '      <button type="button" class="vr-record-after btn-secondary">تسجيل بعد</button>',
      '      <audio class="vr-audio-after" controls hidden></audio>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('\n');
  });
}

/* -- Callouts -- */
function transformCallouts(md) {
  return transformBlocks(md, 'callout', (attrs, inner) => {
    const type = (attrs.type || 'info').toLowerCase();
    const allowed = ['warning', 'info', 'success', 'error'];
    const cls = 'callout-' + (allowed.indexOf(type) === -1 ? 'info' : type);
    const innerHtml = renderInline(escapeHtmlExceptMd(inner));
    return '<div class="callout ' + cls + '"><p>' + innerHtml + '</p></div>';
  });
}

/* =====================================================================
   5. Section splitter
   ===================================================================== */

function splitIntoSections(mdBody) {
  const result = {};
  SECTION_IDS.forEach(id => { result[id] = ''; });

  const ANY_H2 = /^##\s+(.+?)\s*$/gm;
  const ID_RE  = /^(?:\S+\s+)?([A-Z_]+)$/;

  const allHeadings = [];
  let m;
  while ((m = ANY_H2.exec(mdBody)) !== null) {
    const idMatch = m[1].match(ID_RE);
    const sectionId = (idMatch && SECTION_IDS.indexOf(idMatch[1]) !== -1) ? idMatch[1] : null;
    allHeadings.push({
      heading: m[1],
      sectionId,
      start: m.index,
      headerEnd: m.index + m[0].length
    });
  }

  for (let i = 0; i < allHeadings.length; i++) {
    if (!allHeadings[i].sectionId) continue;
    const contentStart = allHeadings[i].headerEnd;
    const contentEnd = (i + 1 < allHeadings.length)
      ? allHeadings[i + 1].start
      : mdBody.length;
    result[allHeadings[i].sectionId] = mdBody.slice(contentStart, contentEnd).trim();
  }

  const unknown = allHeadings.filter(h => !h.sectionId);
  if (unknown.length) {
    console.warn('  WARNING: تم تجاهل ' + unknown.length + ' عنوان H2 غير معروف:');
    unknown.forEach(h => console.warn('    "## ' + h.heading + '"'));
  }

  return result;
}

/* =====================================================================
   6. Frontmatter helpers
   ===================================================================== */

function validateFrontmatter(data) {
  const required = ['day', 'week', 'date', 'title', 'goal', 'duration_minutes'];
  const missing = required.filter(k => data[k] === undefined || data[k] === null || data[k] === '');
  if (missing.length) {
    fail('الـ frontmatter ناقص. الحقول المفقودة: ' + missing.join(', '),
         'راجع templates/day_template.md للنموذج الكامل.');
  }
  if (!data.timers) data.timers = {};
  if (!data.resources) data.resources = {};
  if (!Array.isArray(data.success_criteria)) data.success_criteria = [];
}

function buildSuccessChecklist(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return '<li class="text-muted">لا توجد معايير محدّدة لهذا اليوم.</li>';
  }
  return items.map((t, i) => {
    const id = 'sc-' + i;
    return '        <li><input type="checkbox" id="' + id + '" data-section="success_' + i + '">' +
           '<label for="' + id + '">' + renderInline(escapeHtmlExceptMd(t)) + '</label></li>';
  }).join('\n');
}

/* =====================================================================
   7. processContent — exposed for tests
      Runs the full transformation pipeline on a raw MD body (no
      frontmatter, no template). Used by _scripts/tests/syntax.test.js
      to verify ::syntax:: handling without spinning up the whole build.
   ===================================================================== */
function processContent(rawMd) {
  let s = rawMd;
  s = transformCallouts(s);
  s = transformMCQ(s);
  s = transformFillBlank(s);
  s = transformFreeWriting(s);
  s = transformPronunciation(s);
  s = transformYouGlish(s);
  s = transformVoiceRecorder(s);
  s = transformBlockEnglish(s);
  s = transformInlineEnglish(s);
  return marked.parse(s);
}

/* =====================================================================
   8. Main entry point
   ===================================================================== */

function buildDay(weekArg, dayArg) {
  if (!weekArg || !dayArg) {
    fail('الاستخدام: npm run build:day -- WW DD', 'مثال: npm run build:day -- 01 01');
  }

  const week = pad(weekArg);
  const day = pad(dayArg);

  const mdPath = path.join(ROOT, 'content', 'week_' + week, 'day_' + day + '.md');
  const outDir = path.join(ROOT, 'weeks', 'week_' + week);
  const outPath = path.join(outDir, 'day_' + day + '.html');
  const templatePath = path.join(ROOT, 'templates', 'lesson_template.html');

  if (!fs.existsSync(mdPath)) {
    fail('ملف الـ Markdown غير موجود: ' + path.relative(ROOT, mdPath),
         'لإنشائه: شغّل _scripts/new_day.bat ' + week + ' ' + day);
  }
  if (!fs.existsSync(templatePath)) {
    fail('القالب غير موجود: ' + path.relative(ROOT, templatePath));
  }

  const raw = fs.readFileSync(mdPath, 'utf-8');

  let parsed;
  try { parsed = matter(raw); }
  catch (e) { fail('فشل تحليل الـ frontmatter (YAML)', e.message); }

  const data = parsed.data;
  validateFrontmatter(data);

  /* Expand {{lowercase_field}} from frontmatter inside the body BEFORE
     custom blocks run. */
  let body = interpolateFrontmatter(parsed.content, data);

  /* Custom-block transformers — these consume MD that uses :::name ... :::
     fences. Order: named blocks first (so :::pronunciation/:::mcq/etc
     never collide with the bare :::block English wrapper). */
  body = transformCallouts(body);
  body = transformMCQ(body);
  body = transformFillBlank(body);
  body = transformFreeWriting(body);
  body = transformPronunciation(body);
  body = transformYouGlish(body);
  body = transformVoiceRecorder(body);

  /* Explicit English wrappers — block first, then inline. */
  body = transformBlockEnglish(body);
  body = transformInlineEnglish(body);

  /* Section split, then marked() per section. wrapInlineEnglish() is
     applied as a transitional fallback for un-migrated content. */
  const sections = splitIntoSections(body);
  marked.setOptions({ gfm: true, breaks: false });
  const sectionsHtml = {};
  SECTION_IDS.forEach(id => {
    if (!sections[id]) {
      sectionsHtml[id] = '<p class="text-muted">(لا توجد محتوى لهذا القسم)</p>';
      return;
    }
    const rendered = marked.parse(sections[id]);
    sectionsHtml[id] = wrapInlineEnglish(rendered);
  });

  /* Template fill */
  const template = fs.readFileSync(templatePath, 'utf-8');

  const timers = data.timers || {};
  const resources = data.resources || {};

  const allowedDayTypes = ['regular', 'writing', 'reflection'];
  const dayTypeRaw = (data.day_type || 'regular').toString().toLowerCase();
  const dayType = allowedDayTypes.indexOf(dayTypeRaw) === -1 ? 'regular' : dayTypeRaw;

  // Voice prompt may be a YAML block scalar — strip trailing newlines.
  const voicePromptRaw = String(data.voice_prompt || '').replace(/\n+$/, '');

  const replacements = {
    '{{TITLE}}':            escapeHtml(data.title),
    '{{TITLE_JSON}}':       JSON.stringify(data.title || ''),
    '{{DATE}}':             escapeHtml(data.date),
    '{{DATE_JSON}}':        JSON.stringify(data.date || ''),
    '{{DAY_NUMBER}}':       String(Number(data.day) || Number(dayArg)),
    '{{WEEK_NUMBER}}':      String(Number(data.week) || Number(weekArg)),
    '{{GOAL}}':             escapeHtml(data.goal),
    '{{DURATION_MINUTES}}': String(data.duration_minutes || 150),
    '{{DAY_TYPE}}':         dayType,

    '{{VOICE_PROMPT}}':     escapeHtml(voicePromptRaw),

    '{{PODCAST_URL}}':      escapeHtml(resources.podcast_url || '#'),
    '{{PODCAST_TITLE}}':    escapeHtml(resources.podcast_title || 'بودكاست اليوم'),
    '{{READING_URL}}':      escapeHtml(resources.reading_url || '#'),
    '{{READING_TITLE}}':    escapeHtml(resources.reading_title || 'القراءة اليومية'),

    '{{TIMER_PODCAST}}':       String(timers.podcast || 40),
    '{{TIMER_GRAMMAR}}':       String(timers.grammar || 25),
    '{{TIMER_SPELLING}}':      String(timers.spelling || 15),
    '{{TIMER_READING}}':       String(timers.reading || 15),
    '{{TIMER_PRONUNCIATION}}': String(timers.pronunciation || 10),
    '{{TIMER_CHATGPT}}':       String(timers.chatgpt || 25),
    '{{TIMER_WRITING}}':       String(timers.writing || 15),

    '{{MINTDECK_TSV}}':     escapeHtml(data.mintdeck_tsv || ''),

    '{{SUCCESS_CRITERIA}}': buildSuccessChecklist(data.success_criteria),

    '{{PODCAST_INSTRUCTIONS}}':       sectionsHtml.PODCAST_INSTRUCTIONS,
    '{{WHY_SECTION}}':                sectionsHtml.WHY,
    '{{HOOK_SECTION}}':               sectionsHtml.HOOK,
    '{{GRAMMAR_SECTION}}':            sectionsHtml.GRAMMAR,
    '{{GRAMMAR_EXERCISES_SECTION}}':  sectionsHtml.GRAMMAR_EXERCISES,
    '{{GRAMMAR_MINI_REVIEW}}':        sectionsHtml.GRAMMAR_MINI_REVIEW,
    '{{SPELLING_SECTION}}':           sectionsHtml.SPELLING,
    '{{SPELLING_EXERCISES_SECTION}}': sectionsHtml.SPELLING_EXERCISES,
    '{{READING_SECTION}}':            sectionsHtml.READING,
    '{{PRONUNCIATION_SECTION}}':      sectionsHtml.PRONUNCIATION,
    '{{WRITING_GUIDE_SECTION}}':      sectionsHtml.WRITING_GUIDE,
    '{{MINTDECK_SECTION}}':           sectionsHtml.MINTDECK
  };

  let finalHtml = template;
  Object.keys(replacements).forEach(key => {
    finalHtml = finalHtml.split(key).join(replacements[key]);
  });

  const leftover = finalHtml.match(/\{\{[A-Z_]+\}\}/g);
  if (leftover && leftover.length) {
    fail('placeholders لم تُملأ: ' + [...new Set(leftover)].join(', '));
  }

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, finalHtml, 'utf-8');

  updateManifest(Number(week), Number(day), data.title || '');

  const sizeKB = (fs.statSync(outPath).size / 1024).toFixed(1);
  ok('بُني: ' + path.relative(ROOT, outPath) + '  (' + sizeKB + ' KB)');
  if (sizeKB > 75) {
    console.warn('  WARNING: الحجم تعدّى 75 KB. راجع CLAUDE.md.');
  }
}

function updateManifest(week, day, title) {
  const manifestPath = path.join(ROOT, 'weeks', 'manifest.json');
  let manifest = { built: [] };
  if (fs.existsSync(manifestPath)) {
    try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')); }
    catch (e) { manifest = { built: [] }; }
  }
  if (!Array.isArray(manifest.built)) manifest.built = [];
  manifest.built = manifest.built.filter(b => !(b.week === week && b.day === day));
  manifest.built.push({ week, day, title, built_at: new Date().toISOString() });
  manifest.built.sort((a, b) => (a.week - b.week) || (a.day - b.day));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
}

/* --------- CLI entry --------- */
if (require.main === module) {
  const args = process.argv.slice(2);
  try { buildDay(args[0], args[1]); }
  catch (e) { console.error('\n' + (e && e.message || e) + '\n'); process.exit(1); }
}

module.exports = {
  buildDay,
  processContent,
  transformBlockEnglish,
  transformInlineEnglish,
  transformPronunciation
};
