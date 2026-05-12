/* =====================================================================
   English Learning System — shared/interactive.js
   Modules: MCQ, FillBlank, FreeWriting, Checkboxes, ProgressBar,
            SessionTimer, VoicePrompt, JSONValidator, Export, Toast.
   Relies on the global Storage module (storage.js, loaded first).
   ===================================================================== */

(function (global) {
  'use strict';

  /* --------- Lesson context (week + day) --------- */
  function getLesson() {
    if (global.LESSON && global.LESSON.week && global.LESSON.day) return global.LESSON;
    // Fallback: parse from URL path like /weeks/week_01/day_03.html
    const m = (global.location && global.location.pathname || '').match(/week_(\d+)\/day_(\d+)\.html/);
    if (m) return { week: Number(m[1]), day: Number(m[2]) };
    return { week: 0, day: 0 };
  }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  /* --------- Toast notifications --------- */
  const Toast = {
    el: null,
    timerId: null,
    show(message, durationMs) {
      if (!this.el) {
        this.el = document.createElement('div');
        this.el.className = 'toast';
        this.el.setAttribute('role', 'status');
        this.el.setAttribute('aria-live', 'polite');
        document.body.appendChild(this.el);
      }
      this.el.textContent = message;
      this.el.classList.add('is-visible');
      if (this.timerId) clearTimeout(this.timerId);
      this.timerId = setTimeout(() => { this.el.classList.remove('is-visible'); }, durationMs || 2000);
    }
  };

  /* --------- MCQ --------- */
  const MCQ = {
    init() {
      const { week, day } = getLesson();
      const saved = (week && day) ? (global.Storage && Storage.load(week, day, 'mcq_answers')) || {} : {};
      $$('.mcq-block').forEach(block => {
        const id = block.dataset.mcqId;
        const options = $$('.mcq-option', block);
        const feedback = $('.mcq-feedback', block);

        // Restore previous answer
        if (saved && saved[id] !== undefined) {
          const prev = options[saved[id]];
          if (prev) this.applyAnswer(block, prev, options, feedback);
        }

        options.forEach((btn, idx) => {
          btn.setAttribute('type', 'button');
          btn.setAttribute('role', 'button');
          btn.addEventListener('click', () => this.handleClick(block, btn, idx, options, feedback));
        });
      });
    },

    handleClick(block, btn, idx, options, feedback) {
      // Once answered, lock
      if (options.some(o => o.disabled)) return;
      this.applyAnswer(block, btn, options, feedback);
      const { week, day } = getLesson();
      if (!week || !day || !global.Storage) return;
      const id = block.dataset.mcqId;
      const all = Storage.load(week, day, 'mcq_answers') || {};
      all[id] = idx;
      Storage.save(week, day, 'mcq_answers', all);
      ProgressBar.update();
    },

    applyAnswer(block, btn, options, feedback) {
      const isCorrect = btn.dataset.correct === 'true';
      btn.classList.add('is-selected');
      options.forEach(o => {
        o.disabled = true;
        if (o.dataset.correct === 'true') o.classList.add('is-correct');
        else if (o === btn && !isCorrect) o.classList.add('is-incorrect');
      });
      if (feedback) feedback.hidden = false;
    }
  };

  /* --------- Fill-in-blank --------- */
  const FillBlank = {
    init() {
      const { week, day } = getLesson();
      const saved = (week && day) ? (global.Storage && Storage.load(week, day, 'fillblank_answers')) || {} : {};

      $$('.fillblank-block').forEach(block => {
        const id = block.dataset.fillblankId;
        const input = $('.fillblank-input', block);
        const checkBtn = $('.fillblank-check', block);
        const feedback = $('.fillblank-feedback', block);

        if (input) input.setAttribute('autocomplete', 'off');

        if (saved && saved[id] !== undefined) {
          input.value = saved[id].value || '';
          this.applyResult(input, feedback, saved[id].correct);
        }

        if (checkBtn) checkBtn.addEventListener('click', () => this.handleCheck(block, input, feedback));
        if (input) input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); this.handleCheck(block, input, feedback); }
        });
      });
    },

    handleCheck(block, input, feedback) {
      if (!input) return;
      const expected = (input.dataset.answer || '').trim().toLowerCase();
      const actual = (input.value || '').trim().toLowerCase();
      const correct = actual === expected;
      this.applyResult(input, feedback, correct);

      const { week, day } = getLesson();
      if (!week || !day || !global.Storage) return;
      const id = block.dataset.fillblankId;
      const all = Storage.load(week, day, 'fillblank_answers') || {};
      all[id] = { value: input.value, correct };
      Storage.save(week, day, 'fillblank_answers', all);
      ProgressBar.update();
    },

    applyResult(input, feedback, correct) {
      input.classList.remove('is-correct', 'is-incorrect');
      input.classList.add(correct ? 'is-correct': 'is-incorrect');
      if (feedback) feedback.hidden = false;
    }
  };

  /* --------- Free Writing (with word counter + autosave-on-change) --------- */
  const FreeWriting = {
    init() {
      const { week, day } = getLesson();
      const saved = (week && day) ? (global.Storage && Storage.load(week, day, 'writing')) || {} : {};
      const savedObj = (typeof saved === 'object'&& saved !== null) ? saved : {};

      $$('.freewriting-block').forEach(block => {
        const id = block.dataset.fwId;
        const textarea = $('.fw-input', block);
        const counter = $('.word-counter', block);
        if (!textarea) return;

        if (savedObj[id]) textarea.value = savedObj[id];
        this.updateCounter(textarea, counter);

        textarea.addEventListener('input', () => {
          this.updateCounter(textarea, counter);
          if (!global.Storage || !week || !day) return;
          const all = Storage.load(week, day, 'writing') || {};
          all[id] = textarea.value;
          Storage.save(week, day, 'writing', all);
        });
      });
    },

    countWords(text) {
      if (!text) return 0;
      return text.trim().split(/\s+/).filter(Boolean).length;
    },

    updateCounter(textarea, counter) {
      if (!counter) return;
      const target = Number(textarea.dataset.minWords) || 0;
      const n = this.countWords(textarea.value);
      counter.textContent = n + ' / ' + target + ' كلمة';
      counter.classList.toggle('is-target-met', n >= target && target > 0);
    }
  };

  /* --------- Section Checkboxes --------- */
  const Checkboxes = {
    init() {
      const { week, day } = getLesson();
      const saved = (week && day) ? Storage.load(week, day, 'completed_sections') : null;
      const set = new Set(Array.isArray(saved) ? saved : []);

      $$('.section-checkbox input[type="checkbox"]').forEach(cb => {
        const section = cb.dataset.section || cb.closest('[data-section]')?.dataset.section || '';
        if (set.has(section)) cb.checked = true;
        cb.addEventListener('change', () => this.handleToggle(cb, section));
      });
      ProgressBar.update();
    },

    handleToggle(cb, section) {
      const { week, day } = getLesson();
      if (!week || !day || !global.Storage) return;
      const current = Storage.load(week, day, 'completed_sections') || [];
      const set = new Set(Array.isArray(current) ? current : []);
      if (cb.checked) set.add(section); else set.delete(section);
      Storage.save(week, day, 'completed_sections', Array.from(set));
      ProgressBar.update();
    }
  };

  /* --------- Progress Bar --------- */
  const ProgressBar = {
    init() { this.update(); },

    update() {
      const fill = $('.progress-fill');
      const label = $('.progress-label');
      // Only count visible checkboxes — writing-only sections collapse on
      // regular/reflection days, and we don't want them to skew the count.
      const visible = $$('.section-checkbox input[type="checkbox"]')
        .filter(cb => cb.offsetParent !== null);
      if (!fill || !visible.length) return;
      const done = visible.filter(cb => cb.checked).length;
      const pct = Math.round((done / visible.length) * 100);
      fill.style.width = pct + '%';
      if (label) label.textContent = done + ' / ' + visible.length + ' (' + pct + '%)';
      const wrap = $('.progress-wrap');
      if (wrap) wrap.setAttribute('aria-valuenow', String(pct));
    }
  };

  /* --------- Session Timer (countdown, persists across reloads) --------- */
  const SessionTimer = {
    intervalId: null,
    remainingSec: 0,
    running: false,

    init() {
      const root = $('.session-timer');
      if (!root) return;
      const minutes = Number(root.dataset.minutes) || 150;
      const { week, day } = getLesson();
      const saved = (week && day) ? Storage.load(week, day, 'timer_state') : null;
      if (saved && typeof saved.remainingSec === 'number') {
        this.remainingSec = saved.remainingSec;
      } else {
        this.remainingSec = minutes * 60;
      }
      this.render();

      const startBtn = $('.session-timer-controls [data-action="start"]');
      const pauseBtn = $('.session-timer-controls [data-action="pause"]');
      const resetBtn = $('.session-timer-controls [data-action="reset"]');
      if (startBtn) startBtn.addEventListener('click', () => this.start());
      if (pauseBtn) pauseBtn.addEventListener('click', () => this.pause());
      if (resetBtn) resetBtn.addEventListener('click', () => this.reset(minutes));
    },

    start() {
      if (this.running) return;
      this.running = true;
      this.applyRunningState();
      this.intervalId = setInterval(() => this.tick(), 1000);
    },

    pause() {
      this.running = false;
      this.applyRunningState();
      if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null; }
      this.persist();
    },

    reset(minutes) {
      this.pause();
      this.remainingSec = (minutes || 150) * 60;
      this.render();
      this.persist();
    },

    tick() {
      if (this.remainingSec <= 0) { this.pause(); return; }
      this.remainingSec -= 1;
      this.render();
      if (this.remainingSec % 10 === 0) this.persist();
    },

    render() {
      const el = $('.session-timer-display');
      if (!el) return;
      const m = Math.floor(this.remainingSec / 60);
      const s = this.remainingSec % 60;
      el.textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    },

    applyRunningState() {
      const root = $('.session-timer');
      if (root) root.classList.toggle('is-paused', !this.running);
    },

    persist() {
      const { week, day } = getLesson();
      if (!week || !day || !global.Storage) return;
      Storage.save(week, day, 'timer_state', { remainingSec: this.remainingSec, running: false });
    }
  };

  /* --------- ChatGPT Voice Prompt (copy to clipboard) --------- */
  const VoicePrompt = {
    init() {
      $$('[data-action="copy-voice-prompt"]').forEach(btn => {
        btn.addEventListener('click', () => this.copyToClipboard(btn));
      });
    },

    copyToClipboard(btn) {
      const targetSel = btn.dataset.target || '.voice-prompt-text';
      const target = $(targetSel);
      if (!target) return;
      const text = target.textContent.trim();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
          .then(() => Toast.show('نُسخ الـ Prompt'))
          .catch(() => Toast.show('فشل النسخ — حدّد النص يدوياً'));
      } else {
        Toast.show('المتصفّح لا يدعم النسخ التلقائي');
      }
    }
  };

  /* --------- ChatGPT JSON Validator + summary --------- */
  const JSONValidator = {
    init() {
      const textarea = $('[data-role="chatgpt-json"]');
      const checkBtn = $('[data-action="validate-chatgpt-json"]');
      const summary  = $('[data-role="chatgpt-summary"]');
      if (!textarea || !checkBtn) return;

      const { week, day } = getLesson();
      const saved = (week && day) ? Storage.load(week, day, 'chatgpt_json') : null;
      if (typeof saved === 'string'&& saved) {
        textarea.value = saved;
        this.renderSummary(summary, this.validate(saved));
      }

      checkBtn.addEventListener('click', () => {
        const result = this.validate(textarea.value);
        this.renderSummary(summary, result);
        if (result.ok && week && day && global.Storage) {
          Storage.save(week, day, 'chatgpt_json', textarea.value);
          Toast.show('JSON صالح وحُفظ');
        } else if (!result.ok) {
          Toast.show('JSON غير صالح: ' + result.error);
        }
      });
    },

    validate(raw) {
      if (!raw || !raw.trim()) return { ok: false, error: 'فارغ'};
      let parsed;
      try { parsed = JSON.parse(raw); }
      catch (e) { return { ok: false, error: e.message }; }
      return { ok: true, data: parsed };
    },

    renderSummary(host, result) {
      if (!host) return;
      host.innerHTML = '';
      if (!result.ok) { host.hidden = true; return; }
      host.hidden = false;
      const fields = this.extractSummary(result.data);
      Object.keys(fields).forEach(label => {
        const item = document.createElement('div');
        item.className = 'json-summary-item';
        item.innerHTML = '<span class="label">'+ label + '</span><span class="value">'+ fields[label] + '</span>';
        host.appendChild(item);
      });
    },

    extractSummary(d) {
      if (!d || typeof d !== 'object') return {};
      return {
        'Overall':      String(d.overall || d.score || d.rating || '—'),
        'Fluency':      String(d.fluency || (d.scores && d.scores.fluency) || '—'),
        'Top error':    String(d.top_error || d.main_error || (Array.isArray(d.errors) && d.errors[0]) || '—'),
        'Top strength': String(d.top_strength || d.main_strength || (Array.isArray(d.strengths) && d.strengths[0]) || '—')
      };
    }
  };

  /* --------- Export (Markdown + JSON download + JSON import) --------- */
  const Exporter = {
    init() {
      const copyMd  = $('#copyMarkdown');
      const dlJson  = $('#downloadJson');
      const upJson  = $('#importJson');
      const reset   = $('#resetDay');

      if (copyMd) copyMd.addEventListener('click', () => this.copyMarkdown());
      if (dlJson) dlJson.addEventListener('click', () => this.downloadJSON());
      if (upJson) upJson.addEventListener('click', () => this.promptImport());
      if (reset)  reset.addEventListener('click', () => this.resetDay());
    },

    copyMarkdown() {
      const { week, day } = getLesson();
      const md = this.generateMarkdown(week, day);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(md).then(
          () => Toast.show('تمّ نسخ التقرير'),
          () => Toast.show('فشل النسخ')
        );
      }
    },

    generateMarkdown(week, day) {
      if (!global.Storage) return '';
      const snap = Storage.exportDayJSON(week, day);
      const d = snap.data || {};
      const dayType = d.day_type || 'regular';
      const lines = [];

      lines.push('# Daily Report — أسبوع ' + week + ' / يوم ' + day);
      lines.push('');
      lines.push('**نوع اليوم:** ' + dayType);
      lines.push('**تاريخ التصدير:** ' + snap.exported_at);
      lines.push('');

      const carM  = Number(d.actual_car_minutes  || 0);
      const homeM = Number(d.actual_home_minutes || 0);
      if (carM || homeM) {
        lines.push('## الأوقات الفعليّة');
        lines.push('- السيّارة: ' + carM + ' دقيقة');
        lines.push('- البيت: ' + homeM + ' دقيقة');
        lines.push('- الإجمالي: **' + (carM + homeM) + ' دقيقة**');
        lines.push('');
      }

      if (Array.isArray(d.completed_sections) && d.completed_sections.length) {
        lines.push('## الأقسام المكتملة');
        d.completed_sections.forEach(s => lines.push('- ' + s));
        lines.push('');
      }

      if (d.mcq_answers && Object.keys(d.mcq_answers).length) {
        lines.push('## إجابات MCQ');
        lines.push('```json');
        lines.push(JSON.stringify(d.mcq_answers, null, 2));
        lines.push('```');
        lines.push('');
      }
      if (d.fillblank_answers && Object.keys(d.fillblank_answers).length) {
        lines.push('## إجابات Fill-in-blank');
        lines.push('```json');
        lines.push(JSON.stringify(d.fillblank_answers, null, 2));
        lines.push('```');
        lines.push('');
      }

      if (d.story_hard_spelling) {
        lines.push('## كلمات إملاء صعبة من القراءة');
        lines.push(d.story_hard_spelling);
        lines.push('');
      }

      if (d.writing && typeof d.writing === 'object') {
        lines.push('## الكتابة (Free Writing)');
        Object.keys(d.writing).forEach(k => {
          lines.push('### ' + k);
          lines.push(d.writing[k] || '');
          lines.push('');
        });
      }

      if (dayType === 'writing') {
        if (d.workshop_topic || d.workshop_exercise) {
          lines.push('## Writing Workshop');
          if (d.workshop_topic)    lines.push('**الموضوع:** ' + d.workshop_topic);
          if (d.workshop_exercise) { lines.push(''); lines.push('**التمارين:**'); lines.push(d.workshop_exercise); }
          lines.push('');
        }
        if (d.weekly_project_topic || d.weekly_project_text) {
          lines.push('## مشروع الأسبوع الكتابي');
          if (d.weekly_project_topic) lines.push('**الموضوع:** ' + d.weekly_project_topic);
          if (d.weekly_project_text)  { lines.push(''); lines.push('**النص:**'); lines.push(d.weekly_project_text); }
          lines.push('');
        }
        if (d.self_edit_spelling || d.self_edit_grammar || d.self_edit_punctuation || d.total_errors_before) {
          lines.push('## التصحيح الذاتي');
          if (d.self_edit_spelling)    lines.push('**أخطاء إملائية:** ' + d.self_edit_spelling);
          if (d.self_edit_grammar)     lines.push('**أخطاء قواعدية:** ' + d.self_edit_grammar);
          if (d.self_edit_punctuation) lines.push('**أخطاء ترقيم:** ' + d.self_edit_punctuation);
          if (d.total_errors_before)   lines.push('**إجمالي الأخطاء قبل التصحيح:** ' + d.total_errors_before);
          lines.push('');
        }
      }

      if (d.chatgpt_json) {
        lines.push('## ChatGPT JSON');
        lines.push('```json');
        lines.push(d.chatgpt_json);
        lines.push('```');
        lines.push('');
      }

      if (d.rating_difficulty || d.rating_productivity || d.rating_confidence) {
        lines.push('## الإحساس بالتقدّم');
        lines.push('- صعوبة اليوم: ' + (d.rating_difficulty || 5) + ' / 10');
        lines.push('- إنتاجيّة اليوم: ' + (d.rating_productivity || 5) + ' / 10');
        lines.push('- ثقة الكتابة: ' + (d.rating_confidence || 5) + ' / 10');
        lines.push('');
      }

      lines.push('---');
      lines.push('');
      lines.push('**اليوم ' + (Number(day) + 1) + ' من فضلك**');
      return lines.join('\n');
    },

    downloadJSON() {
      const { week, day } = getLesson();
      if (!global.Storage) return;
      const snap = Storage.exportDayJSON(week, day);
      const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = 'day_'+ day + '_week_'+ week + '_'+ dateStr + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      Toast.show('تمّ تنزيل JSON');
    },

    promptImport() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json,.json';
      input.addEventListener('change', () => {
        const file = input.files && input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const { week, day } = getLesson();
          const res = Storage.importDayJSON(week, day, reader.result);
          if (res.ok) {
            Toast.show('استُورِدت ' + res.restored + ' حقول. أعِد تحميل الصفحة.');
          } else {
            Toast.show('فشل الاستيراد: ' + res.error);
          }
        };
        reader.readAsText(file);
      });
      input.click();
    },

    resetDay() {
      const { week, day } = getLesson();
      if (!confirm('هل تريد مسح كل بيانات اليوم؟ هذا الإجراء لا يمكن التراجع عنه.')) return;
      Storage.clearDay(week, day);
      Toast.show('تمّ مسح بيانات اليوم');
      setTimeout(() => global.location.reload(), 700);
    }
  };

  /* --------- MintDeck TSV copy --------- */
  const MintDeck = {
    init() {
      const btn = $('[data-action="copy-mintdeck"]');
      const tsv = $('.mintdeck-tsv');
      if (!btn || !tsv) return;
      btn.addEventListener('click', () => {
        const text = tsv.textContent;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text)
            .then(() => Toast.show('نُسخت بطاقات MintDeck'))
            .catch(() => Toast.show('فشل النسخ'));
        }
      });
    }
  };

  /* --------- Rating sliders (1-10) — load saved, update display, persist --- */
  const RatingSliders = {
    init() {
      const { week, day } = getLesson();
      $$('input[type="range"][data-field]').forEach(slider => {
        const valueSpan = slider.parentElement && slider.parentElement.querySelector('.rating-value');

        if (week && day && global.Storage) {
          const saved = global.Storage.load(week, day, slider.dataset.field);
          if (saved !== null && saved !== undefined && saved !== '') {
            slider.value = String(saved);
          }
        }
        if (valueSpan) valueSpan.textContent = slider.value;

        slider.addEventListener('input', () => {
          if (valueSpan) valueSpan.textContent = slider.value;
          if (week && day && global.Storage) {
            global.Storage.save(week, day, slider.dataset.field, slider.value);
          }
        });
      });
    }
  };

  /* --------- Generic data-field auto-save (text / number / textarea / checkbox)
     Skips type=range (RatingSliders handles those) and any element already
     wired by another module via data-role. */
  const AutoSaveFields = {
    init() {
      const { week, day } = getLesson();
      if (!week || !day || !global.Storage) return;

      $$('[data-field]').forEach(el => {
        if (el.type === 'range') return; // RatingSliders owns ranges
        const field = el.dataset.field;

        const saved = global.Storage.load(week, day, field);
        if (saved !== null && saved !== undefined) {
          if (el.type === 'checkbox') el.checked = !!saved;
          else el.value = String(saved);
        }

        const evt = (el.type === 'checkbox') ? 'change' : 'input';
        el.addEventListener(evt, () => {
          const v = (el.type === 'checkbox') ? el.checked : el.value;
          global.Storage.save(week, day, field, v);
        });
      });
    }
  };

  /* --------- Word counter for textareas with linked counter span ----- */
  const WordCounter = {
    init() {
      $$('.word-counter[data-counter-for]').forEach(counter => {
        const fieldName = counter.dataset.counterFor;
        const target = $('[data-field="' + fieldName + '"]');
        if (!target) return;
        const minWords = Number(target.dataset.minWords) || 0;
        const render = () => {
          const n = (target.value || '').trim().split(/\s+/).filter(Boolean).length;
          counter.textContent = minWords > 0
            ? n + ' / ' + minWords + ' كلمة'
            : n + ' كلمة';
          counter.classList.toggle('is-target-met', minWords > 0 && n >= minWords);
        };
        render();
        target.addEventListener('input', render);
      });
    }
  };

  /* --------- YouGlish embed toggle --------- */
  const YouGlish = {
    init() {
      $$('.yg-embed-btn').forEach(btn => {
        btn.addEventListener('click', () => this.toggleEmbed(btn));
      });
    },

    toggleEmbed(btn) {
      const item = btn.closest('.youglish-item');
      if (!item) return;
      let wrap = item.querySelector('.yg-iframe-wrap');
      if (wrap) { wrap.remove(); btn.textContent = 'شاهد داخل الصفحة'; return; }
      const word = (btn.dataset.word || '').trim();
      if (!word) return;
      wrap = document.createElement('div');
      wrap.className = 'yg-iframe-wrap';
      wrap.innerHTML = '<iframe src="https://youglish.com/pronounce/'+ encodeURIComponent(word) +
                       '/english/us?" loading="lazy" allowfullscreen></iframe>';
      item.appendChild(wrap);
      btn.textContent = 'إغلاق';
    }
  };

  /* --------- Collapsible Sections — toggles `.section-toggle` aria-expanded;
     bodies marked with `[aria-expanded="false"] ~ .section-body { display:none }`
     in styles.css collapse automatically. Must run BEFORE ProgressBar.init so
     `offsetParent` reflects the collapsed state when ProgressBar counts visible
     checkboxes. */
  const Collapsible = {
    init() {
      $$('.section-toggle').forEach(toggle => {
        toggle.addEventListener('click', () => this.toggle(toggle));
        toggle.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            this.toggle(toggle);
          }
        });
      });
    },

    toggle(toggle) {
      const expanded = toggle.getAttribute('aria-expanded') !== 'false';
      toggle.setAttribute('aria-expanded', String(!expanded));
      // Recompute progress — offsetParent shifts when bodies collapse/expand.
      if (typeof ProgressBar !== 'undefined' && ProgressBar.update) {
        setTimeout(() => ProgressBar.update(), 50);
      }
    }
  };

  /* --------- Quick Export Top — header button mirrors the bottom export button. */
  const QuickExport = {
    init() {
      const btn = $('#quickExportTop');
      if (!btn) return;
      btn.addEventListener('click', () => {
        if (typeof Exporter !== 'undefined' && Exporter.copyMarkdown) {
          Exporter.copyMarkdown();
        } else {
          const target = $('#sec-export');
          if (target) target.scrollIntoView({ behavior: 'smooth' });
        }
      });
    }
  };

  /* --------- Scroll-To-Top FAB — appears after scrolling past `threshold` px. */
  const ScrollTopFab = {
    btn: null,
    threshold: 400,

    init() {
      this.btn = $('#scrollTopBtn');
      if (!this.btn) return;
      this.btn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      window.addEventListener('scroll', () => this.update(), { passive: true });
      this.update();
    },

    update() {
      if (!this.btn) return;
      this.btn.hidden = !(window.scrollY > this.threshold);
    }
  };

  /* --------- Boot --------- */
  function boot() {
    AutoSaveFields.init();
    RatingSliders.init();
    WordCounter.init();
    MCQ.init();
    FillBlank.init();
    FreeWriting.init();
    Collapsible.init();     // before ProgressBar so collapsed checkboxes are skipped
    Checkboxes.init();
    ProgressBar.init();
    SessionTimer.init();
    VoicePrompt.init();
    JSONValidator.init();
    Exporter.init();
    QuickExport.init();     // depends on Exporter.copyMarkdown
    MintDeck.init();
    YouGlish.init();
    ScrollTopFab.init();

    // Auto-save heartbeat (no-op callback — every module already saves on change,
    // but this keeps last_saved fresh for "current" status detection).
    const { week, day } = getLesson();
    if (week && day && global.Storage) {
      Storage.startAutoSave(week, day, (w, d) => {
        Storage.save(w, d, 'last_saved', new Date().toISOString());
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  /* --------- Public API --------- */
  global.Interactive = {
    MCQ, FillBlank, FreeWriting, Checkboxes, ProgressBar,
    SessionTimer, VoicePrompt, JSONValidator, Exporter,
    MintDeck, YouGlish, Toast,
    Collapsible, QuickExport, ScrollTopFab,
    RatingSliders, AutoSaveFields, WordCounter,
    getLesson
  };
})(typeof window !== 'undefined' ? window : globalThis);
