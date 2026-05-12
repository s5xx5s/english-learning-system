/* =====================================================================
   English Learning System — shared/storage.js
   Wraps localStorage with a per-day key schema.
   ===================================================================== */

(function (global) {
  'use strict';

  const STATUS = { COMPLETED: 'completed', CURRENT: 'current', UNTOUCHED: 'untouched' };
  const AUTOSAVE_INTERVAL_MS = 30000;
  const FIELDS = [
    /* legacy / lesson-engine fields */
    'completed_sections',
    'mcq_answers',
    'fillblank_answers',
    'writing',
    'chatgpt_json',
    'pronunciation',
    'timer_state',
    'last_saved',

    /* day-type toggle (regular | writing | reflection) */
    'day_type',

    /* reading extras */
    'story_hard_spelling',

    /* actual minutes spent */
    'actual_car_minutes',
    'actual_home_minutes',

    /* self-rating sliders 1-10 */
    'rating_difficulty',
    'rating_productivity',
    'rating_confidence',

    /* writing-only fields (day-type = writing) */
    'workshop_topic',
    'workshop_exercise',
    'weekly_project_topic',
    'weekly_project_text',
    'self_edit_spelling',
    'self_edit_grammar',
    'self_edit_punctuation',
    'total_errors_before'
  ];

  let autosaveTimerId = null;

  function pad(n) { return String(n).padStart(2, '0'); }

  function isPlainObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  }

  function safeParse(raw) {
    if (raw === null || raw === undefined) return null;
    try { return JSON.parse(raw); } catch (e) { return raw; }
  }

  const Storage = {
    STATUS,
    FIELDS,

    key(week, day, field) {
      return 'day_' + pad(week) + '_' + pad(day) + '_' + field;
    },

    save(week, day, field, value) {
      const k = this.key(week, day, field);
      const serialized = (typeof value === 'string') ? value : JSON.stringify(value);
      try {
        localStorage.setItem(k, serialized);
        localStorage.setItem(this.key(week, day, 'last_saved'), new Date().toISOString());
        return true;
      } catch (e) {
        console.error('[Storage] save failed for', k, e);
        return false;
      }
    },

    load(week, day, field) {
      return safeParse(localStorage.getItem(this.key(week, day, field)));
    },

    clearDay(week, day) {
      FIELDS.forEach(f => localStorage.removeItem(this.key(week, day, f)));
    },

    /* --------- Auto-save: invokes callback() every 30 seconds --------- */
    startAutoSave(week, day, callback) {
      this.stopAutoSave();
      if (typeof callback !== 'function') return;
      autosaveTimerId = setInterval(() => {
        try { callback(week, day); } catch (e) { console.error('[Storage] autosave callback error', e); }
      }, AUTOSAVE_INTERVAL_MS);
    },

    stopAutoSave() {
      if (autosaveTimerId !== null) {
        clearInterval(autosaveTimerId);
        autosaveTimerId = null;
      }
    },

    /* --------- Export / Import --------- */
    exportDayJSON(week, day) {
      const snapshot = {
        version: 1,
        week: Number(week),
        day: Number(day),
        exported_at: new Date().toISOString(),
        data: {}
      };
      FIELDS.forEach(f => {
        const v = this.load(week, day, f);
        if (v !== null) snapshot.data[f] = v;
      });
      return snapshot;
    },

    importDayJSON(week, day, payload) {
      let obj = payload;
      if (typeof payload === 'string') {
        try { obj = JSON.parse(payload); }
        catch (e) { return { ok: false, error: 'JSON غير صالح: ' + e.message }; }
      }
      if (!isPlainObject(obj) || !isPlainObject(obj.data)) {
        return { ok: false, error: 'بنية JSON غير متوقّعة (يجب أن يحتوي على data)' };
      }
      const targetWeek = (obj.week != null) ? obj.week : week;
      const targetDay  = (obj.day  != null) ? obj.day  : day;
      let count = 0;
      Object.keys(obj.data).forEach(field => {
        if (FIELDS.indexOf(field) === -1) return;
        this.save(targetWeek, targetDay, field, obj.data[field]);
        count++;
      });
      return { ok: true, restored: count, week: targetWeek, day: targetDay };
    },

    /* --------- Statistics for index.html --------- */
    getCompletedDays() {
      const completed = [];
      for (let w = 1; w <= 36; w++) {
        for (let d = 1; d <= 7; d++) {
          if (this.getDayStatus(w, d) === STATUS.COMPLETED) {
            completed.push({ week: w, day: d });
          }
        }
      }
      return completed;
    },

    /**
     * A day is "completed" when the count of checked sections reaches the
     * threshold for its day_type. Template v2 introduced GRAMMAR_EXERCISES /
     * SPELLING_EXERCISES / SELF_EDIT so the regular threshold rose from 10
     * to 12; writing days add 3 extra (WORKSHOP, WEEKLY_PROJECT, SELF_EDIT)
     * for a total of 15.
     * "Current" = at least one field touched but threshold not yet met.
     */
    getDayStatus(week, day) {
      const sections = this.load(week, day, 'completed_sections');
      const dayType = this.load(week, day, 'day_type') || 'regular';
      const required = (dayType === 'writing') ? 15 : 12;
      if (Array.isArray(sections) && sections.length >= required) return STATUS.COMPLETED;

      const touched = FIELDS.some(f => {
        if (f === 'last_saved') return false;
        const v = this.load(week, day, f);
        return v !== null && v !== '' && !(Array.isArray(v) && v.length === 0);
      });
      return touched ? STATUS.CURRENT : STATUS.UNTOUCHED;
    },

    /* --------- Convenience: clear everything (with confirm at call-site) --- */
    clearAll() {
      const toRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf('day_') === 0) toRemove.push(k);
      }
      toRemove.forEach(k => localStorage.removeItem(k));
      return toRemove.length;
    }
  };

  global.Storage = Storage;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Storage;
  }
})(typeof window !== 'undefined' ? window : globalThis);
