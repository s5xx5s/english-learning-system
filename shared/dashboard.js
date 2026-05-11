/* =====================================================================
   shared/dashboard.js
   Renders the 36×7 day grid + stats for index.html.
   Depends on: shared/storage.js (for getDayStatus / load)
   ===================================================================== */

(function (global) {
  'use strict';

  const TOTAL_WEEKS = 36;
  const DAYS_PER_WEEK = 7;
  const TOTAL_DAYS = TOTAL_WEEKS * DAYS_PER_WEEK;

  function pad(n) { return String(n).padStart(2, '0'); }
  function $(sel) { return document.querySelector(sel); }

  async function loadManifest() {
    try {
      const res = await fetch('./weeks/manifest.json', { cache: 'no-cache' });
      if (!res.ok) return new Set();
      const data = await res.json();
      const set = new Set();
      (data.built || []).forEach(b => { set.add(b.week + '_' + b.day); });
      return set;
    } catch (e) { return new Set(); }
  }

  function renderGrid(builtSet) {
    const host = $('#weeks-grid');
    if (!host) return;

    const rows = [];
    for (let w = 1; w <= TOTAL_WEEKS; w++) {
      const cells = [];
      for (let d = 1; d <= DAYS_PER_WEEK; d++) {
        const isBuilt = builtSet.has(w + '_' + d);
        const status = (global.Storage ? Storage.getDayStatus(w, d) : 'untouched');
        const classes = ['day-cell'];

        if (!isBuilt) {
          classes.push('is-unbuilt');
        } else {
          classes.push('is-' + status);
        }

        const href = './weeks/week_' + pad(w) + '/day_' + pad(d) + '.html';
        const labelText = 'أسبوع ' + w + ' يوم ' + d +
                          (isBuilt ? (status === 'completed' ? ' — مكتمل' : (status === 'current' ? ' — قيد العمل' : '')) : ' — غير مبني');

        if (isBuilt) {
          cells.push(
            '<a class="' + classes.join(' ') + '" href="' + href + '" aria-label="' + labelText + '" title="' + labelText + '">' + d + '</a>'
          );
        } else {
          cells.push(
            '<span class="' + classes.join(' ') + '" aria-label="' + labelText + '" title="' + labelText + '">' + d + '</span>'
          );
        }
      }
      rows.push(
        '<div class="week-row">' +
          '<span class="week-label">أسبوع ' + pad(w) + '</span>' +
          cells.join('') +
        '</div>'
      );
    }
    host.innerHTML = rows.join('');
  }

  function countAllWords() {
    if (!global.Storage) return 0;
    let total = 0;
    for (let w = 1; w <= TOTAL_WEEKS; w++) {
      for (let d = 1; d <= DAYS_PER_WEEK; d++) {
        const writing = Storage.load(w, d, 'writing');
        if (writing && typeof writing === 'object') {
          Object.keys(writing).forEach(k => {
            const t = writing[k];
            if (typeof t === 'string' && t.trim()) {
              total += t.trim().split(/\s+/).filter(Boolean).length;
            }
          });
        }
      }
    }
    return total;
  }

  function findLastActiveDay() {
    if (!global.Storage) return null;
    let latest = null;
    for (let w = 1; w <= TOTAL_WEEKS; w++) {
      for (let d = 1; d <= DAYS_PER_WEEK; d++) {
        const last = Storage.load(w, d, 'last_saved');
        if (typeof last === 'string' && last) {
          if (!latest || last > latest.iso) latest = { week: w, day: d, iso: last };
        }
      }
    }
    return latest;
  }

  function renderStats(builtSet) {
    const completed = global.Storage ? Storage.getCompletedDays() : [];
    const builtCount = builtSet.size;

    setText('[data-stat="completed"]', completed.length);
    setText('[data-stat="total"]', TOTAL_DAYS);
    setText('[data-stat="percentage"]',
      TOTAL_DAYS > 0 ? Math.round((completed.length / TOTAL_DAYS) * 100) + '%' : '0%'
    );
    setText('[data-stat="words"]', countAllWords().toLocaleString('en-US'));
    setText('[data-stat="built"]', builtCount + ' / ' + TOTAL_DAYS);

    const last = findLastActiveDay();
    if (last) {
      const dateStr = last.iso.slice(0, 10);
      setText('[data-stat="last-active"]', 'أسبوع ' + last.week + ' · يوم ' + last.day);
      setText('[data-stat="last-active-date"]', dateStr);
    } else {
      setText('[data-stat="last-active"]', '—');
      setText('[data-stat="last-active-date"]', 'لم تبدأ بعد');
    }
  }

  function setText(selector, value) {
    const el = $(selector);
    if (el) el.textContent = String(value);
  }

  async function init() {
    const builtSet = await loadManifest();
    renderGrid(builtSet);
    renderStats(builtSet);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.Dashboard = { init, loadManifest, renderGrid, renderStats };
})(typeof window !== 'undefined' ? window : globalThis);
