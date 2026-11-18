'use client';

import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

export default function OfflinePage() {
  const handleRetry = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 sm:p-8 text-center shadow-2xl backdrop-blur-md">
        <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <WifiOff className="w-8 h-8" />
        </div>

        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-2">
          No Internet Connection
        </h1>

        <p className="text-sm text-slate-300 leading-relaxed mb-6">
          You are currently offline. Attendance marking, location verification, and live shifts
          require an active internet connection and cannot be processed offline.
        </p>

        <button
          onClick={handleRetry}
          className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-semibold text-sm transition-all shadow-md shadow-blue-600/20 cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Retry Connection</span>
        </button>
      </div>
    </div>
  );
}
