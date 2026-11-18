'use client';

import React, { useState, useEffect } from 'react';
import { Download, Share, PlusSquare, X } from 'lucide-react';

const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [platform, setPlatform] = useState(null); // 'native' | 'ios' | null
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Check if app is already running in standalone mode (already installed)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://');

    if (isStandalone) {
      return;
    }

    // 2. Check if user dismissed prompt within last 7 days
    try {
      const dismissedAt = localStorage.getItem('pwa_install_prompt_dismissed');
      if (dismissedAt) {
        const timeDiff = Date.now() - parseInt(dismissedAt, 10);
        if (timeDiff < DISMISS_DURATION_MS) {
          return;
        }
      }
    } catch {
      // localStorage unavailable or blocked
    }

    // 3. Android / Desktop (Chrome, Edge, Samsung Internet, Opera)
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setPlatform('native');
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 4. iOS Safari check
    const ua = window.navigator.userAgent.toLowerCase();
    const isIOS =
      /iphone|ipad|ipod/.test(ua) ||
      (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);

    const isIOSSafari =
      isIOS &&
      !ua.includes('crios') &&
      !ua.includes('fxios') &&
      !ua.includes('opios') &&
      ua.includes('safari');

    if (isIOSSafari && !window.navigator.standalone) {
      // Delay slightly so it doesn't immediately interrupt page load
      const timer = setTimeout(() => {
        setPlatform('ios');
        setIsVisible(true);
      }, 1500);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleDismiss = () => {
    try {
      localStorage.setItem('pwa_install_prompt_dismissed', Date.now().toString());
    } catch {
      // ignore
    }
    setIsVisible(false);
  };

  const handleNativeInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try {
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsVisible(false);
      }
    } catch {
      setIsVisible(false);
    }
    setDeferredPrompt(null);
  };

  if (!isVisible || !platform) {
    return null;
  }

  return (
    <aside
      aria-label="Install App Prompt"
      className="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-md z-40 animate-in fade-in slide-in-from-bottom-4 duration-300 pointer-events-auto"
    >
      <div className="relative flex items-start gap-3 p-3.5 sm:p-4 rounded-2xl bg-slate-900/95 border border-slate-700/80 shadow-2xl backdrop-blur-md text-white">
        {/* App Icon */}
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 shadow-md">
          {platform === 'native' ? (
            <Download className="w-5 h-5 text-white" />
          ) : (
            <Share className="w-5 h-5 text-white" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pr-6">
          <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
            Install App
          </p>
          <p className="text-xs sm:text-sm font-medium text-slate-200 mt-0.5 leading-snug">
            {platform === 'native' ? (
              'Install Sikka Attendance for instant access and a full-screen experience.'
            ) : (
              <span>
                To install on iPhone/iPad: tap{' '}
                <Share className="w-3.5 h-3.5 inline text-blue-400 mx-0.5" /> then{' '}
                <span className="font-semibold text-white">"Add to Home Screen"</span>{' '}
                <PlusSquare className="w-3.5 h-3.5 inline text-blue-400 mx-0.5" />.
              </span>
            )}
          </p>

          {/* Action Button for Native Install */}
          {platform === 'native' && (
            <div className="mt-2.5 flex items-center gap-2">
              <button
                onClick={handleNativeInstall}
                className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                Install Now
              </button>
              <button
                onClick={handleDismiss}
                className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 text-xs font-medium transition-colors cursor-pointer"
              >
                Maybe later
              </button>
            </div>
          )}
        </div>

        {/* Close Button */}
        <button
          onClick={handleDismiss}
          aria-label="Dismiss install prompt"
          className="absolute top-2.5 right-2.5 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
