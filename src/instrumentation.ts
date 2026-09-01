/**
 * Next.js Instrumentation Hook:
 * Runs when the server starts up to initialize background services.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startBackgroundScheduler } = await import('@/lib/background-scheduler');
    startBackgroundScheduler();

    // Silently pre-warm in-memory bootstrap cache in background for 0ms user page loads
    setTimeout(async () => {
      try {
        const { GET: handleBootstrap } = await import('@/app/api/data/bootstrap/route');
        const req = new Request('http://localhost/api/data/bootstrap?role=SUPER_ADMIN');
        await handleBootstrap(req);
        console.log('[Cache Warmer] Background bootstrap cache successfully pre-warmed.');
      } catch (err) {
        console.warn('[Cache Warmer] Non-fatal pre-warm warning:', err);
      }
    }, 15000);
  }
}
