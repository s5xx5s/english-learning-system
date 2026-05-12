/* =====================================================================
   assets/js/notifications.js
   Local notifications for daily reminders.

   IMPORTANT LIMITATIONS — read before relying on this:
     - We do NOT run a push server. There is no way (in 2026 browsers) to
       reliably fire a notification at a specific time from a static
       site when the browser is closed. Service-worker scheduled
       notifications (`TimestampTrigger`) are experimental and
       Chromium-only — Safari/iOS don't support them at all.
     - What this module CAN do: fire a notification from the OPEN tab
       at a scheduled clock time (using setTimeout). Useful as a
       "remind me later today" while the lesson page is open in a
       background tab.
     - For real cross-device reminders we'd add a push server (Web Push
       protocol + VAPID keys) in a later phase.

   Exports:
     ensurePermission()   → requests Notification permission; returns true if granted
     scheduleToday(time, body) → schedules a one-shot fire today at HH:mm (local)
   ===================================================================== */

export async function ensurePermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied')  return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

/**
 * Schedule a notification at `HH:mm` LOCAL TIME today. If the time has
 * already passed, schedules for the same time tomorrow. Returns a
 * cancel function.
 */
export function scheduleToday(time, body, options = {}) {
  if (!('Notification' in window)) return () => {};
  const [hh, mm] = String(time).split(':').map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) {
    throw new Error('time must be "HH:mm" (24h), got: ' + time);
  }

  const target = new Date();
  target.setHours(hh, mm, 0, 0);
  if (target.getTime() <= Date.now()) {
    target.setDate(target.getDate() + 1);
  }
  const delay = target.getTime() - Date.now();

  const id = setTimeout(async () => {
    if (Notification.permission !== 'granted') return;
    // Prefer SW.showNotification when available (looks/feels native);
    // fall back to the page-level constructor.
    try {
      const reg = await navigator.serviceWorker?.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(body, {
          icon:  options.icon  || './icons/icon.svg',
          badge: options.badge || './icons/icon.svg',
          tag:   options.tag   || 'english-reminder',
          body:  options.body  || 'افتح English لمتابعة الدراسة'
        });
        return;
      }
    } catch { /* fall through */ }
    new Notification(body, { icon: options.icon || './icons/icon.svg' });
  }, delay);

  return () => clearTimeout(id);
}
