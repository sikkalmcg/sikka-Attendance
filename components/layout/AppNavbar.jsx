'use client';

import React, { useState, useEffect } from 'react';
import { Menu, Clock, LogOut, Bell } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';

export default function AppNavbar({ user, onLogout, setMobileOpen }) {
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(formatInTimeZone(now, 'Asia/Kolkata', 'hh:mm:ss a'));
      setDateStr(formatInTimeZone(now, 'Asia/Kolkata', 'EEEE, dd MMM yyyy'));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-3 sm:px-4 md:px-8 py-2.5 sm:py-3.5 flex items-center justify-between shadow-xs">
      {/* Left: Mobile hamburger & title */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        <button
          onClick={() => setMobileOpen(true)}
          className="md:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden sm:block min-w-0">
          <p className="text-xs font-medium text-slate-500">{dateStr || 'Today'}</p>
          <h2 className="text-sm font-semibold text-slate-800 truncate">
            Welcome back, <span className="text-blue-600">{user?.fullName || user?.username || 'User'}</span>
          </h2>
        </div>
      </div>

      {/* Right: Live Clock & Quick Action */}
      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        {/* Live Clock Badge */}
        <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200/70 text-slate-700 shadow-xs">
          <Clock className="w-3.5 h-3.5 text-blue-600 animate-pulse shrink-0" />
          <div className="text-right">
            <div className="text-xs font-semibold tabular-nums tracking-tight">{timeStr || 'Loading...'}</div>
            <div className="text-[10px] text-slate-500 font-medium sm:hidden truncate max-w-[100px]">{dateStr}</div>
          </div>
          <span className="hidden sm:inline-block text-[10px] font-bold text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded">
            IST
          </span>
        </div>

        {/* User Role Tag */}
        <div className="hidden md:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/60">
          {user?.role === 'Employee' || user?.userType === 'EMPLOYEE' ? 'Employee' : user?.role || 'Admin'}
        </div>

        {/* Logout button */}
        <button
          onClick={onLogout}
          className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
