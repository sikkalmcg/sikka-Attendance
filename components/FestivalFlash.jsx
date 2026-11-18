'use client';

import React, { useState, useEffect } from 'react';
import { getTodayFestival, getFestivalByKeyword, getKolkataDateString } from '@/lib/festivals';

export default function FestivalFlash() {
  const [festival, setFestival] = useState(null);
  const [stage, setStage] = useState('hidden'); // 'entering' | 'active' | 'leaving' | 'hidden'
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    // Only run on client
    if (typeof window === 'undefined') return;

    // Detect reduced motion preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);

    let activeFestival = null;
    let isDevOverride = false;

    // Check development query parameter preview (e.g. ?festival=diwali or ?festival=holi)
    if (process.env.NODE_ENV === 'development') {
      try {
        const params = new URLSearchParams(window.location.search);
        const queryFestival = params.get('festival');
        if (queryFestival) {
          activeFestival = getFestivalByKeyword(queryFestival);
          isDevOverride = true;
        }
      } catch {
        // ignore search params parse error
      }
    }

    // Normal matching for today's date in IST
    if (!activeFestival) {
      activeFestival = getTodayFestival();
    }

    if (!activeFestival) {
      return;
    }

    const todayIST = getKolkataDateString();
    const storageKey = `festival_flash_shown_${activeFestival.date || todayIST}_${activeFestival.id}`;

    // Prevent repeated flashes in the same session, unless developer forced query param
    if (!isDevOverride) {
      try {
        if (sessionStorage.getItem(storageKey)) {
          return;
        }
      } catch {
        // sessionStorage blocked or unavailable
      }
    }

    // Mark as shown for today in this session
    try {
      sessionStorage.setItem(storageKey, 'true');
    } catch {
      // ignore
    }

    setFestival(activeFestival);
    setStage('entering');

    // Transitions:
    // 0ms -> start entering
    // 250ms -> fully active
    // 1200ms -> start leaving (fade out)
    // 1500ms -> hidden (removed from DOM)
    const activeTimer = setTimeout(() => {
      setStage('active');
    }, 250);

    const leaveTimer = setTimeout(() => {
      setStage('leaving');
    }, 1200);

    const hideTimer = setTimeout(() => {
      setStage('hidden');
      setFestival(null);
    }, 1500);

    return () => {
      clearTimeout(activeTimer);
      clearTimeout(leaveTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!festival || stage === 'hidden') {
    return null;
  }

  const confettiItems = festival.colors.confetti || ['#F59E0B', '#EF4444', '#10B981', '#3B82F6'];

  return (
    <div
      aria-live="polite"
      role="status"
      className="pointer-events-none fixed inset-0 z-[9999] flex items-center justify-center p-4 select-none"
      style={{
        opacity: stage === 'leaving' ? 0 : 1,
        transition: reducedMotion
          ? 'opacity 300ms ease-out'
          : stage === 'leaving'
          ? 'opacity 300ms ease-out, transform 300ms ease-out'
          : 'opacity 250ms cubic-bezier(0.16, 1, 0.3, 1), transform 250ms cubic-bezier(0.16, 1, 0.3, 1)',
        transform:
          reducedMotion || stage === 'active'
            ? 'scale(1)'
            : stage === 'entering'
            ? 'scale(0.92)'
            : 'scale(1.04)',
      }}
    >
      <style>{`
        @keyframes festFloat {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          50% { transform: translateY(-18px) rotate(18deg); opacity: 0.95; }
          100% { transform: translateY(-36px) rotate(36deg); opacity: 0; }
        }
        @keyframes festSparkle {
          0%, 100% { opacity: 0.2; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1.15); }
        }
        @keyframes festPulseGlow {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.08); opacity: 0.9; }
        }
      `}</style>

      {/* Confetti & Sparkles (Pure CSS, 16 particles) */}
      {!reducedMotion && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 16 }).map((_, i) => {
            const color = confettiItems[i % confettiItems.length];
            const leftPercent = 8 + (i * 84) / 16;
            const topPercent = 20 + ((i * 37) % 60);
            const size = 6 + (i % 4) * 3;
            const delay = (i * 0.06).toFixed(2);
            const isCircle = i % 2 === 0;

            return (
              <span
                key={i}
                className="absolute pointer-events-none"
                style={{
                  left: `${leftPercent}%`,
                  top: `${topPercent}%`,
                  width: `${size}px`,
                  height: isCircle ? `${size}px` : `${size * 1.8}px`,
                  backgroundColor: color,
                  borderRadius: isCircle ? '50%' : '3px',
                  boxShadow: `0 0 8px ${color}`,
                  animation: `festFloat 1.4s cubic-bezier(0.2, 0.8, 0.4, 1) ${delay}s forwards`,
                }}
              />
            );
          })}
        </div>
      )}

      {/* Main Flash Card */}
      <div className="relative max-w-sm w-full mx-auto pointer-events-none">
        {/* Glow backdrop */}
        <div
          className="absolute -inset-3 rounded-3xl blur-2xl pointer-events-none"
          style={{
            background: `radial-gradient(circle, ${festival.colors.glow} 0%, transparent 70%)`,
            animation: reducedMotion ? 'none' : 'festPulseGlow 1.4s ease-in-out infinite',
          }}
        />

        {/* Card Content */}
        <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-slate-950/85 backdrop-blur-xl p-5 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.6)] text-center text-white">
          {/* Top subtle festival gradient bar */}
          <div
            className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${festival.colors.gradient}`}
          />

          {/* Festival Emoji */}
          <div className="mb-2 text-4xl sm:text-5xl filter drop-shadow-md select-none">
            {festival.emoji}
          </div>

          {/* Festival Name Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider mb-2 border backdrop-blur-sm shadow-xs ${festival.colors.badge}">
            <span>{festival.name}</span>
          </div>

          {/* Greeting Heading */}
          <h2
            className={`text-xl sm:text-2xl font-extrabold tracking-tight bg-gradient-to-r ${festival.colors.gradient} bg-clip-text text-transparent drop-shadow-sm`}
          >
            {festival.greeting}
          </h2>

          {/* Subtext */}
          {festival.subtext && (
            <p className="mt-1 text-xs sm:text-sm text-slate-300 font-medium leading-relaxed max-w-xs mx-auto">
              {festival.subtext}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
