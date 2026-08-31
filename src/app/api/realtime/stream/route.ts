import { realtimeBroadcaster, RealtimeEventPayload } from '@/lib/realtime-events';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // 1. Initial connection message
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`)
      );

      // 2. Subscribe to realtime broadcaster
      const unsubscribe = realtimeBroadcaster.subscribe((event: RealtimeEventPayload) => {
        try {
          const payload = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch (err) {
          console.warn('SSE stream enqueue warning:', err);
        }
      });

      // 3. Keep-alive heartbeat interval (15s)
      const heartbeatTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'));
        } catch {
          clearInterval(heartbeatTimer);
        }
      }, 15000);

      // 4. Handle client abort / disconnect
      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeatTimer);
        unsubscribe();
        try {
          controller.close();
        } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
