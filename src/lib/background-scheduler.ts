let isSchedulerRunning = false;

/**
 * IST-aware Background Scheduler for Server-side Automatic Shift Reminders.
 *
 * Triggers the shift-reminders evaluation at the 4 key attendance times:
 *   - 06:00 AM IST  → Night shift Mark OUT reminder
 *   - 10:00 AM IST  → Day shift Mark IN reminder
 *   - 06:00 PM IST  → Day shift Mark OUT reminder
 *   - 08:00 PM IST  → Night shift Mark IN reminder
 *
 * Smart window: Only evaluates within ±10 minutes of each target time.
 * Polling every 60 seconds ensures at most 1 evaluation per window per day.
 * Uses MongoDB deduplication so no duplicate notifications are ever sent.
 */

// Notification time windows in IST (minutes from midnight)
const IST_TRIGGER_WINDOWS = [
  { name: '06:00 AM Night-OUT',  minute: 6 * 60  },   // 360 min
  { name: '10:00 AM Day-IN',     minute: 10 * 60 },   // 600 min
  { name: '06:00 PM Day-OUT',    minute: 18 * 60 },   // 1080 min
  { name: '08:00 PM Night-IN',   minute: 20 * 60 },   // 1200 min
];
const WINDOW_TOLERANCE_MINUTES = 10;

function getISTMinutesFromMidnight(): number {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return now.getHours() * 60 + now.getMinutes();
}

function isWithinScheduledWindow(): { active: boolean; windowName: string } {
  const currentMinutes = getISTMinutesFromMidnight();
  for (const window of IST_TRIGGER_WINDOWS) {
    const diff = Math.abs(currentMinutes - window.minute);
    if (diff <= WINDOW_TOLERANCE_MINUTES) {
      return { active: true, windowName: window.name };
    }
  }
  return { active: false, windowName: '' };
}

export function startBackgroundScheduler() {
  if (isSchedulerRunning) {
    return;
  }
  isSchedulerRunning = true;

  const istTime = new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  console.log(`[Scheduler] IST-Aware Shift Reminder Scheduler started at ${istTime} IST.`);
  console.log('[Scheduler] Active windows: 06:00 AM, 10:00 AM, 06:00 PM, 08:00 PM IST (±10 min).');

  // Initial check after 15s delay to allow DB connection to warm up
  setTimeout(() => {
    runSchedulerCycle();
  }, 15000);

  // Poll every 60 seconds — only evaluates during active windows
  setInterval(() => {
    runSchedulerCycle();
  }, 60 * 1000);
}

async function runSchedulerCycle() {
  const { active, windowName } = isWithinScheduledWindow();
  if (!active) {
    // Outside all scheduled windows — skip DB query
    return;
  }

  const istNow = new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
  console.log(`[Scheduler] Active window "${windowName}" at ${istNow} IST — evaluating reminders...`);

  try {
    const { GET: handleShiftReminders } = await import('@/app/api/notifications/shift-reminders/route');
    const result = await handleShiftReminders();
    const data = await result.json();
    console.log(`[Scheduler] Cycle complete — ${data.newRemindersCount ?? 0} new reminder(s) sent, ${data.evaluatedEmployees ?? 0} employee(s) evaluated.`);
  } catch (error) {
    console.warn('[Scheduler] Cycle error:', error);
  }
}

