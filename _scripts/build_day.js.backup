/* =====================================================================
   _scripts/build_day.js
   Converts content/week_XX/day_XX.md  →  weeks/week_XX/day_XX.html
   Usage: npm run build:day -- 01 01
   ===================================================================== */

'use strict';

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');

const ROOT = path.join(__dirname, '..');

const SECTION_IDS = [
  'WHY', 'HOOK', 'GRAMMAR', 'GRAMMAR_EXERCISES',
  'SPELLING', 'SPELLING_EXERCISES', 'READING',
  'PRONUNCIATION', 'CHATGPT', 'WRITING_GUIDE', 'MINTDECK'
];

/* --------- helpers --------- */

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

/** Inline-only markdown: bold, italic, code, links. NOT block-level. */
function renderInline(md) {
  if (!md) return '';
  let s = md;
  // Code inline first (so its content isn't touched by other rules)
  s = s.replace(/`([^`]+)`/g, (_, c) => '<code>' + escapeHtml(c) + '</code>');
  // Bold
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italic
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  // Links [text](url)
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
   Body-level frontmatter interpolation
   Expands {{lowercase_field}} (and dotted paths like
   {{resources.podcast_url}}) inside the MD body before marked() runs.
   Missing fields are left untouched so the teacher sees the typo.
   ===================================================================== */
function interpolateFrontmatter(md, data) {
  // First lookup: dotted path (resources.podcast_url).
  // Fallback: search nested objects for the leaf name (reading_title finds
  // resources.reading_title without forcing the teacher to type the path).
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
    if (v === null || v === undefined) return m; // leave raw so typo is visible
    // Trim trailing newline from YAML | block scalars (voice_prompt etc).
    return String(v).replace(/\n+$/, '');
  });
}

/* =====================================================================
   Inline-English auto-wrapping (post-marked)
   Wraps English PHRASES (2+ words) inside <p>, <li>, and <blockquote>
   with <span dir="ltr" class="en">. Phrase boundaries deliberately
   include adjacent quote marks (ASCII " ' or HTML entities &quot;
   &#39;) so they ride along with the LTR run, instead of drifting in
   the surrounding RTL context.
   Content already inside <code>, <a>, <span>, or <bdi> is passed
   through untouched.
   ===================================================================== */
function wrapInlineEnglish(html) {
  // Quote alternatives — ASCII, curly, or HTML-encoded.
  const QUOTE = '(?:&quot;|&#39;|["\'‘’“”])';
  // Word separator: whitespace, common punctuation, dashes, or quote entity
  // (so He said &quot;hi&quot; to me wraps as one run).
  const SEP = '(?:\\s|[.,;:!?()\\-–—]|&(?:quot|#39);)';
  // A word: letters / digits / internal apostrophe.
  const WORD = '[A-Za-z0-9’\']+';
  // Optional trailing punctuation so phrases can end at "manager." or "ready!".
  const TAIL = '[A-Za-z0-9.!?,’)\\]]?';

  // Two alternatives combined into one regex:
  //   (A) QUOTED:   quote + 1+ words (separated by SEP) + quote.
  //                 Allows single-word quoted phrases like &quot;hi&quot;.
  //   (B) UNQUOTED: 2+ words.
  // Lookbehind: not preceded by < (inside tag) or word char (mid-word).
  // & is intentionally NOT excluded — phrase may START at &quot;.
  const PHRASE_RE = new RegExp(
    '(?<![<\\w])(' +
      // Case A
      QUOTE +
      '[A-Za-z][A-Za-z0-9’\'\\-]*' +
      '(?:' + SEP + '+' + WORD + ')*' +
      '[A-Za-z0-9.!?,]?' +
      QUOTE +
    '|' +
      // Case B
      '[A-Za-z][A-Za-z0-9’\'\\-]*' +
      '(?:' + SEP + '+' + WORD + ')+' +
      TAIL +
    ')(?![\\w>])',
    'g'
  );

  // Helpers to decide which CSS classes to attach to each wrap.
  const QUOTE_EDGE_RE = /(?:&quot;|&#39;|["'‘’“”])/;
  function isQuoted(t) {
    return new RegExp('^' + QUOTE_EDGE_RE.source).test(t) &&
           new RegExp(QUOTE_EDGE_RE.source + '$').test(t);
  }
  function countWords(t) {
    // Replace HTML entities with space, then split on whitespace.
    const plain = t.replace(/&(?:quot|#39|amp|lt|gt|nbsp);/g, ' ').trim();
    return plain.split(/\s+/).filter(Boolean).length;
  }
  function endsInTerminal(t) {
    return /[.!?](?:&quot;|&#39;|["'‘’“”])?$/.test(t);
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
            const longTerm = countWords(captured) >= 3 && endsInTerminal(captured);
            let cls = 'en';
            if (quoted)  cls += ' en-quoted';
            if (longTerm) cls += ' en-block';
            return '<span dir="ltr" class="' + cls + '">' + captured + '</span>';
          });
        }
        if (lt === -1) break;

        const gt = content.indexOf('>', lt);
        if (gt === -1) { out += content.slice(lt); break; }
        const tagName = (content.slice(lt + 1, gt).match(/^\/?(\w+)/) || [])[1] || '';
        // Pass through content of these inline tags without re-wrapping.
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
   Custom block transformers
   ===================================================================== */

/** Generic ::: block matcher.
 *  Captures: 1=type, 2=attrs string, 3=inner content
 */
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

/** Escape HTML in user text but leave **bold** and *italic* and `code` for renderInline. */
function escapeHtmlExceptMd(s) {
  if (!s) return '';
  // Only escape <, >, & — leave * and _ alone for renderInline
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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

    // Replace _____ (3 or more underscores) with input
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

/* -- YouGlish -- */
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

    return [
      '<div class="youglish-block">',
      itemsHtml,
      '</div>'
    ].join('\n');
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
      else if (t && !task) task = t; // fallback: first non-empty line
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
   Section splitting
   ===================================================================== */

function splitIntoSections(mdBody) {
  const result = {};
  SECTION_IDS.forEach(id => { result[id] = ''; });

  // Find ALL H2 headings (any text after `## `). Recognized SECTION_IDs
  // produce real section content; unrecognized headings still act as
  // BOUNDARIES so their content can never leak into the previous section.
  // Unrecognized headings + their content are dropped from output (with a
  // console warning so the teacher knows).
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
    console.warn('  WARNING: تم تجاهل ' + unknown.length + ' عنوان H2 غير معروف (محتواها لن يُعرَض):');
    unknown.forEach(h => console.warn('    "## ' + h.heading + '"'));
  }

  return result;
}

/* =====================================================================
   Frontmatter helpers
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
   Main
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
     custom blocks run — so a teacher can write {{voice_prompt}} or
     {{resources.podcast_url}} anywhere in the lesson body. */
  let body = interpolateFrontmatter(parsed.content, data);

  /* Transform custom blocks BEFORE marked */
  body = transformCallouts(body);
  body = transformMCQ(body);
  body = transformFillBlank(body);
  body = transformFreeWriting(body);
  body = transformYouGlish(body);
  body = transformVoiceRecorder(body);

  /* Split by section headers, then run marked() per section. After each
     marked render, auto-wrap inline English in <span dir="ltr"> for
     bidi safety. */
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

  /* Read template and replace placeholders */
  const template = fs.readFileSync(templatePath, 'utf-8');

  const timers = data.timers || {};
  const resources = data.resources || {};

  // Day type controls which sections show. Whitelist allowed values.
  const allowedDayTypes = ['regular', 'writing', 'reflection'];
  const dayTypeRaw = (data.day_type || 'regular').toString().toLowerCase();
  const dayType = allowedDayTypes.indexOf(dayTypeRaw) === -1 ? 'regular' : dayTypeRaw;

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

    '{{PODCAST_URL}}':      escapeHtml(resources.podcast_url || '#'),
    '{{PODCAST_TITLE}}':    escapeHtml(resources.podcast_title || 'بودكاست اليوم'),
    '{{READING_URL}}':      escapeHtml(resources.reading_url || '#'),
    '{{READING_TITLE}}':    escapeHtml(resources.reading_title || 'القراءة اليومية'),

    '{{TIMER_PODCAST}}':    String(timers.podcast || 40),
    '{{TIMER_CHATGPT}}':    String(timers.chatgpt || 25),

    '{{MINTDECK_TSV}}':     escapeHtml(data.mintdeck_tsv || ''),

    '{{SUCCESS_CRITERIA}}': buildSuccessChecklist(data.success_criteria),

    '{{WHY_SECTION}}':                sectionsHtml.WHY,
    '{{HOOK_SECTION}}':               sectionsHtml.HOOK,
    '{{GRAMMAR_SECTION}}':            sectionsHtml.GRAMMAR,
    '{{GRAMMAR_EXERCISES_SECTION}}':  sectionsHtml.GRAMMAR_EXERCISES,
    '{{SPELLING_SECTION}}':           sectionsHtml.SPELLING,
    '{{SPELLING_EXERCISES_SECTION}}': sectionsHtml.SPELLING_EXERCISES,
    '{{READING_SECTION}}':            sectionsHtml.READING,
    '{{PRONUNCIATION_SECTION}}':      sectionsHtml.PRONUNCIATION,
    '{{CHATGPT_SECTION}}':            sectionsHtml.CHATGPT,
    '{{WRITING_GUIDE_SECTION}}':      sectionsHtml.WRITING_GUIDE,
    '{{MINTDECK_SECTION}}':           sectionsHtml.MINTDECK
  };

  let finalHtml = template;
  Object.keys(replacements).forEach(key => {
    finalHtml = finalHtml.split(key).join(replacements[key]);
  });

  /* Detect leftover placeholders */
  const leftover = finalHtml.match(/\{\{[A-Z_]+\}\}/g);
  if (leftover && leftover.length) {
    fail('placeholders لم تُملأ: ' + [...new Set(leftover)].join(', '));
  }

  /* Write output */
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, finalHtml, 'utf-8');

  /* Update manifest so dashboard knows which days are built */
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
    catch (e) { /* corrupt: rewrite from scratch */ manifest = { built: [] }; }
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

module.exports = { buildDay };
