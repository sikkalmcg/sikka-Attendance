import { useEffect } from 'react';

export default function ErrorPage() {
  useEffect(() => {
    // no-op: keep function component stable
  }, []);

  return (
    <html>
      <body>
        <div style={{ padding: 24, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
          <h1 style={{ fontSize: 24, fontWeight: 800 }}>Something went wrong</h1>
          <p style={{ marginTop: 8, color: '#555' }}>
            Please refresh the page or try again later.
          </p>
        </div>
      </body>
    </html>
  );
}

