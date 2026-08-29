"use client";

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App Router Error:', error);
  }, [error]);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 bg-slate-50">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-slate-200 text-center space-y-4">
        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Something went wrong</h2>
        <p className="text-sm text-slate-500 font-medium">
          An unexpected error occurred. Please try reloading or refreshing the session.
        </p>
        <Button
          onClick={() => reset()}
          className="w-full bg-primary font-bold rounded-xl h-11"
        >
          Try Again
        </Button>
      </div>
    </div>
  );
}
