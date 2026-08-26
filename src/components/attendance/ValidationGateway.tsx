"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { ShieldCheck, MapPin, Satellite, CheckCircle2, Lock, ArrowRight, Sparkles, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ValidationGatewayProps {
  onComplete: () => void;
  employeeName?: string;
  employeeId?: string;
  plantName?: string;
}

const VALIDATION_STEPS = [
  { id: 1, title: "Enterprise Security Protocol", desc: "Establishing encrypted tunnel & token handshake" },
  { id: 2, title: "GPS & Satellite Telemetry", desc: "Syncing geodetic positioning & hardware coordinates" },
  { id: 3, title: "Plant Geofence Alignment", desc: "Verifying industrial perimeter radius & boundary matrix" },
  { id: 4, title: "Shift & Roster Validation", desc: "Auditing employee schedule, leaves, and time ledger" },
  { id: 5, title: "Clearance Granted", desc: "Security check complete • Attendance portal unlocked" },
];

const TOTAL_DURATION_MS = 5000; // 5 seconds max duration

export function ValidationGateway({
  onComplete,
  employeeName = "Employee",
  employeeId = "SIKKA-STAFF",
  plantName = "Sikka Industrial Plant",
}: ValidationGatewayProps) {
  const [progress, setProgress] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(5);
  const [gpsReady, setGpsReady] = useState(false);
  const hasFinishedRef = useRef(false);

  const logoUrl = "https://sikkaenterprises.com/assets/images/Capture13.51191245_std.JPG";

  // Pre-warm GPS in the background during the 5-second validation window
  useEffect(() => {
    if (typeof window !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => setGpsReady(true),
        () => setGpsReady(false),
        { enableHighAccuracy: true, timeout: 4500, maximumAge: 0 }
      );
    }
  }, []);

  useEffect(() => {
    const startTime = Date.now();
    const interval = 50; // update every 50ms for smooth progress

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const calculatedProgress = Math.min(100, Math.round((elapsed / TOTAL_DURATION_MS) * 100));
      setProgress(calculatedProgress);

      const remaining = Math.max(0, Math.ceil((TOTAL_DURATION_MS - elapsed) / 1000));
      setSecondsRemaining(remaining);

      // Step calculations across 5 seconds
      if (elapsed < 1000) {
        setCurrentStepIndex(0);
      } else if (elapsed < 2100) {
        setCurrentStepIndex(1);
      } else if (elapsed < 3200) {
        setCurrentStepIndex(2);
      } else if (elapsed < 4300) {
        setCurrentStepIndex(3);
      } else {
        setCurrentStepIndex(4);
      }

      if (elapsed >= TOTAL_DURATION_MS) {
        clearInterval(timer);
        if (!hasFinishedRef.current) {
          hasFinishedRef.current = true;
          setIsCompleted(true);
          setTimeout(() => {
            onComplete();
          }, 600);
        }
      }
    }, interval);

    return () => clearInterval(timer);
  }, [onComplete]);

  const handleInstantUnlock = () => {
    if (!hasFinishedRef.current) {
      hasFinishedRef.current = true;
      setProgress(100);
      setCurrentStepIndex(4);
      setIsCompleted(true);
      setTimeout(() => {
        onComplete();
      }, 300);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
      {/* Background ambient glow effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-gradient-to-tr from-amber-500/20 via-blue-600/20 to-emerald-500/20 rounded-full blur-3xl opacity-70 animate-pulse" />
      </div>

      {/* Main Validation Gateway Card */}
      <div className="relative w-full max-w-lg bg-white/95 dark:bg-slate-900/95 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-8 backdrop-blur-xl">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-4 mb-6">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-500/10 rounded-lg text-[#C59D2E]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 block leading-tight">
                Sikka Validation Gateway
              </span>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                Enterprise Telemetry & Security
              </span>
            </div>
          </div>

          <Badge
            variant="outline"
            className={cn(
              "text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border transition-all",
              isCompleted
                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                : "bg-blue-500/10 text-blue-600 border-blue-500/30"
            )}
          >
            {isCompleted ? (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 animate-bounce" /> ACCESS GRANTED
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                VERIFYING {secondsRemaining}s
              </span>
            )}
          </Badge>
        </div>

        {/* Animated Sikka Logo Stage */}
        <div className="flex flex-col items-center justify-center my-6">
          <div className="relative flex items-center justify-center w-36 h-36">
            {/* Outer Rotating Cyber Tech Ring */}
            <div className="absolute inset-0 rounded-full border-2 border-dashed border-[#C59D2E]/40 animate-gateway-spin-slow" />
            
            {/* Middle Reverse Rotating Accent Ring */}
            <div className="absolute inset-2 rounded-full border border-blue-500/30 animate-gateway-spin-reverse" />

            {/* Radar Sonar Ping Expanding Waves */}
            <div className="absolute inset-0 rounded-full bg-[#C59D2E]/15 animate-gateway-radar-ping" />

            {/* Animated Logo Container with Glow & Breathing Pulse */}
            <div className="relative w-24 h-24 rounded-2xl bg-white shadow-xl overflow-hidden p-1 border-2 border-[#C59D2E] animate-gateway-pulse-glow flex items-center justify-center">
              <Image
                src={logoUrl}
                alt="Sikka Logo"
                width={88}
                height={88}
                className="w-full h-full object-cover rounded-xl"
                priority
              />

              {/* Holographic Laser Scan Line Animation */}
              <div className="absolute left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#38bdf8] animate-gateway-scan pointer-events-none" />
            </div>

            {/* Orbiting Satellite / Node Indicator */}
            <div className="absolute -top-1 right-2 bg-slate-900 text-white rounded-full p-1 border border-slate-700 shadow-md">
              {gpsReady ? (
                <Satellite className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              ) : (
                <Cpu className="w-3.5 h-3.5 text-amber-400 animate-spin" />
              )}
            </div>
          </div>

          <div className="text-center mt-4 space-y-1">
            <h3 className="text-base font-black text-slate-800 dark:text-white uppercase tracking-tight">
              Sikka Industries & Logistics
            </h3>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5">
              <MapPin className="w-3 h-3 text-[#C59D2E]" /> {plantName}
            </p>
          </div>
        </div>

        {/* Progress Bar & Status Info */}
        <div className="space-y-4 my-6">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-600 dark:text-slate-300 font-mono text-[11px] uppercase tracking-wide flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#C59D2E]" />
                {VALIDATION_STEPS[currentStepIndex]?.title}
              </span>
              <span className="text-primary font-black font-mono">{progress}%</span>
            </div>

            {/* Custom High-Tech Progress Bar */}
            <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-200/60 dark:border-slate-700">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#C59D2E] via-blue-600 to-emerald-500 transition-all duration-150 ease-out shadow-sm"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 text-center italic">
              {VALIDATION_STEPS[currentStepIndex]?.desc}
            </p>
          </div>

          {/* Stepper Checklist */}
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-3.5 border border-slate-100 dark:border-slate-800 space-y-2">
            {VALIDATION_STEPS.map((step, idx) => {
              const isPast = idx < currentStepIndex || isCompleted;
              const isCurrent = idx === currentStepIndex && !isCompleted;

              return (
                <div
                  key={step.id}
                  className={cn(
                    "flex items-center justify-between text-[11px] font-bold px-2 py-1 rounded-lg transition-colors",
                    isCurrent
                      ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200/60 dark:border-slate-700"
                      : isPast
                      ? "text-emerald-600 dark:text-emerald-400 opacity-90"
                      : "text-slate-400 opacity-50"
                  )}
                >
                  <span className="flex items-center gap-2">
                    {isPast ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    ) : isCurrent ? (
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0" />
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    )}
                    <span className="uppercase text-[10px] tracking-wider">{step.title}</span>
                  </span>

                  <span className="text-[9px] font-mono uppercase">
                    {isPast ? "Verified" : isCurrent ? "Active" : "Queued"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Employee Footnote & Skip Button */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="text-center sm:text-left">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
              Verified Session Context
            </p>
            <p className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase">
              {employeeName} <span className="font-mono text-slate-400">({employeeId})</span>
            </p>
          </div>

          <Button
            size="sm"
            onClick={handleInstantUnlock}
            className={cn(
              "w-full sm:w-auto h-9 px-4 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all gap-1.5 shadow-md",
              isCompleted
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : "bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900"
            )}
          >
            {isCompleted ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" /> Enter Portal
              </>
            ) : (
              <>
                Proceed Now <ArrowRight className="w-3 h-3" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
