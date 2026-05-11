/* =====================================================================
   English Learning System — shared/audio.js
   Voice recording via MediaRecorder API.
   Audio blobs are NOT persisted to localStorage (too large) — only
   the count of recordings made is stored.
   ===================================================================== */

(function (global) {
  'use strict';

  function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
  function $(sel, root)  { return (root || document).querySelector(sel); }
  function showToast(msg) {
    if (global.Interactive && global.Interactive.Toast) global.Interactive.Toast.show(msg);
  }

  function getLesson() {
    if (global.Interactive && typeof global.Interactive.getLesson === 'function') {
      return global.Interactive.getLesson();
    }
    return { week: 0, day: 0 };
  }

  function pickMimeType() {
    if (!global.MediaRecorder || !MediaRecorder.isTypeSupported) return '';
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
    for (let i = 0; i < candidates.length; i++) {
      if (MediaRecorder.isTypeSupported(candidates[i])) return candidates[i];
    }
    return '';
  }

  const VoiceRecorder = {
    /* Each block gets an entry: { stream, recorder, chunks, before, after } */
    sessions: new WeakMap(),

    init() {
      $$('.voice-recorder-block').forEach(block => {
        const beforeBtn = $('.vr-record-before', block);
        const afterBtn  = $('.vr-record-after', block);
        if (beforeBtn) beforeBtn.addEventListener('click', () => this.toggle(block, true));
        if (afterBtn)  afterBtn.addEventListener('click',  () => this.toggle(block, false));

        // Pre-flight feature check: hide buttons if no support
        if (!this.isSupported()) {
          [beforeBtn, afterBtn].forEach(b => {
            if (!b) return;
            b.disabled = true;
            b.title = 'المتصفّح لا يدعم تسجيل الصوت';
            b.textContent = 'غير مدعوم';
          });
        }
      });
    },

    isSupported() {
      return !!(global.navigator && navigator.mediaDevices &&
                navigator.mediaDevices.getUserMedia && global.MediaRecorder);
    },

    /* Toggle: if recording → stop. Otherwise → start. */
    toggle(block, isBefore) {
      const session = this.sessions.get(block) || {};
      const isRecordingThis = session.recorder &&
                              session.recorder.state === 'recording'&&
                              session.currentIsBefore === isBefore;
      if (isRecordingThis) {
        this.stopRecording(block);
      } else {
        if (session.recorder && session.recorder.state === 'recording') {
          this.stopRecording(block); // stop the other one first
        }
        this.startRecording(block, isBefore);
      }
    },

    async startRecording(block, isBefore) {
      if (!this.isSupported()) { showToast('المتصفّح لا يدعم تسجيل الصوت'); return; }
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e) {
        const reason = (e && e.name === 'NotAllowedError') ? 'رُفض الإذن للوصول للميكروفون': 'تعذّر فتح الميكروفون';
        showToast(reason);
        return;
      }

      const mimeType = pickMimeType();
      let recorder;
      try {
        recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      } catch (e) {
        showToast('فشل بدء التسجيل: ' + e.message);
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      const chunks = [];
      recorder.addEventListener('dataavailable', (ev) => {
        if (ev.data && ev.data.size > 0) chunks.push(ev.data);
      });

      recorder.addEventListener('stop', () => {
        const blob = new Blob(chunks, { type: mimeType || 'audio/webm'});
        const url = URL.createObjectURL(blob);
        const audio = $(isBefore ? '.vr-audio-before': '.vr-audio-after', block);
        if (audio) {
          if (audio.src) URL.revokeObjectURL(audio.src);
          audio.src = url;
          audio.hidden = false;
        }
        stream.getTracks().forEach(t => t.stop());
        this.bumpCounter();
      });

      this.sessions.set(block, {
        stream, recorder, chunks,
        currentIsBefore: isBefore
      });

      recorder.start();
      const btn = $(isBefore ? '.vr-record-before': '.vr-record-after', block);
      if (btn) {
        btn.classList.add('is-recording');
        btn.dataset.originalText = btn.textContent;
        btn.textContent = 'إيقاف التسجيل';
      }
    },

    stopRecording(block) {
      const session = this.sessions.get(block);
      if (!session || !session.recorder) return;
      try { session.recorder.stop(); } catch (e) { /* already stopped */ }
      const isBefore = session.currentIsBefore;
      const btn = $(isBefore ? '.vr-record-before': '.vr-record-after', block);
      if (btn) {
        btn.classList.remove('is-recording');
        btn.textContent = btn.dataset.originalText || (isBefore ? 'تسجيل قبل' : 'تسجيل بعد');
        delete btn.dataset.originalText;
      }
    },

    playRecording(audioElement) {
      if (audioElement && typeof audioElement.play === 'function') {
        audioElement.play().catch(() => { /* user gesture required, ignore */ });
      }
    },

    /* Bump the recordings counter in localStorage */
    bumpCounter() {
      const { week, day } = getLesson();
      if (!week || !day || !global.Storage) return;
      const current = global.Storage.load(week, day, 'pronunciation') || { recordings: 0 };
      const safe = (current && typeof current === 'object'&& typeof current.recordings === 'number')
        ? current : { recordings: 0 };
      safe.recordings += 1;
      global.Storage.save(week, day, 'pronunciation', safe);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => VoiceRecorder.init());
  } else {
    VoiceRecorder.init();
  }

  global.VoiceRecorder = VoiceRecorder;
})(typeof window !== 'undefined' ? window : globalThis);
