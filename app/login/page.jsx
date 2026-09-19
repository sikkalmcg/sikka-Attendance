'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingAutoLogin, setCheckingAutoLogin] = useState(true);
  const [error, setError] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  const safeParseJson = async (res) => {
    if (!res) return null;
    try {
      const text = await res.text();
      if (!text) return null;
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    } catch {
      return null;
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function checkAutoLogin() {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('attendance_token') : null;
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch('/api/auth/me', { headers, cache: 'no-store' });
        if (res.ok) {
          const data = await safeParseJson(res);
          if (data && data.authenticated && data.user) {
            const target = (data.user.role === 'Employee' || data.user.userType === 'EMPLOYEE')
              ? '/mark-attendance'
              : '/dashboard';
            window.location.replace(target);
            return;
          }
        }

        // Stale or invalid token
        if (token) {
          try {
            localStorage.removeItem('attendance_token');
            localStorage.removeItem('attendance_user');
          } catch {}
        }
      } catch (err) {
        console.error('Auto-login check error:', err);
      } finally {
        if (isMounted) {
          setCheckingAutoLogin(false);
        }
      }
    }

    checkAutoLogin();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter both your Username/Aadhaar and Password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim(),
        }),
      });

      const data = (await safeParseJson(res)) || {};

      if (!res.ok) {
        setError(data.error || `Authentication failed (${res.status}). Please check your credentials.`);
        setLoading(false);
        return;
      }

      // Store token and user details in localStorage for persistent auto-login on mobile APK
      if (data.token) {
        try {
          localStorage.setItem('attendance_token', data.token);
          if (data.user) {
            localStorage.setItem('attendance_user', JSON.stringify(data.user));
          }
        } catch (storageErr) {
          console.error('Storage error:', storageErr);
        }
      }

      // Full page navigation to load new user state
      window.location.href = data.redirectTo || '/dashboard';
    } catch (err) {
      console.error('Login error:', err);
      setError('Network connection error. Please check your connection and try again.');
      setLoading(false);
    }
  };


  const fillQuickCredentials = (user, pass) => {
    setUsername(user);
    setPassword(pass);
    setError('');
  };

  if (checkingAutoLogin) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-slate-400">Verifying session...</p>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-xl shadow-blue-500/25 mb-4 border border-blue-400/30">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Attendance Portal</h1>
          <p className="mt-1.5 text-sm text-slate-400">
            Enterprise Geofenced Attendance & Shift Management
          </p>
        </div>

        {/* Card */}
        <div className="mt-8 bg-slate-800/80 backdrop-blur-xl py-8 px-6 sm:px-10 shadow-2xl rounded-3xl border border-slate-700/60">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-3 animate-in fade-in duration-150">
                <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">{error}</div>
              </div>
            )}

            {/* Username / Aadhaar field */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Username or Aadhaar Number
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username or 12-digit Aadhaar"
                  autoComplete="username"
                  required
                  className="block w-full pl-11 pr-4 py-3 bg-slate-900/60 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Employees: Enter 12-digit Aadhaar • Admins: Enter username
              </p>
            </div>

            {/* Password field */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Password or Mobile Number
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password or 10-digit Mobile"
                  autoComplete="current-password"
                  required
                  className="block w-full pl-11 pr-11 py-3 bg-slate-900/60 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Employees: Enter 10-digit registered mobile number
              </p>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm text-white bg-blue-600 hover:bg-blue-500 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-600/30 cursor-pointer"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Verifying credentials...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Portal</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Security badge */}
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Encrypted Session • Geofence Radius Verification</span>
        </div>
      </div>
    </div>
  );
}
