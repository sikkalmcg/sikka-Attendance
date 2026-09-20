export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { processAutoMarkOut } = await import('./lib/autoMarkOut.js');

    // Run auto mark-out immediately on boot
    processAutoMarkOut(true).catch((err) => {
      console.error('Initial auto mark-out error:', err);
    });

    // Schedule recurring check every 5 minutes in background
    const FIVE_MINUTES_MS = 5 * 60 * 1000;
    setInterval(() => {
      processAutoMarkOut(true).catch((err) => {
        console.error('Periodic background auto mark-out error:', err);
      });
    }, FIVE_MINUTES_MS);
  }
}
