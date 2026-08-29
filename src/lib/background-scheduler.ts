let isSchedulerRunning = false;

/**
 * Background Scheduler for Server-side Automatic Shift Reminders.
 * Runs in the Node.js server process and checks for pending shift reminders periodically (every 60s).
 * Idempotent & Atomic: Uses MongoDB unique deduplication keys so duplicate reminders are never sent.
 */
export function startBackgroundScheduler() {
  if (isSchedulerRunning) {
    return;
  }
  isSchedulerRunning = true;

  console.log('[Scheduler] Background Shift Reminder Scheduler initialized.');

  // Run initial check after 10s delay to allow DB connection to warm up
  setTimeout(() => {
    runSchedulerCycle();
  }, 10000);

  // Periodic cycle every 60 seconds
  setInterval(() => {
    runSchedulerCycle();
  }, 60 * 1000);
}

async function runSchedulerCycle() {
  try {
    const { GET: handleShiftReminders } = await import('@/app/api/notifications/shift-reminders/route');
    await handleShiftReminders();
  } catch (error) {
    console.warn('[Scheduler] Cycle error:', error);
  }
}
