/**
 * Next.js Instrumentation Hook:
 * Runs when the server starts up to initialize background services.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startBackgroundScheduler } = await import('@/lib/background-scheduler');
    startBackgroundScheduler();
  }
}
