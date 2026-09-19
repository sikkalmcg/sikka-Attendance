'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    async function redirectUser() {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('attendance_token') : null;
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch('/api/auth/me', { headers, cache: 'no-store' });
        if (!res.ok) {
          if (token) {
            try {
              localStorage.removeItem('attendance_token');
              localStorage.removeItem('attendance_user');
            } catch {}
          }
          window.location.replace('/login');
          return;
        const text = await res.text();
        let data = {};
        try {
          data = JSON.parse(text);
        } catch {
          window.location.replace('/login');
          return;
        }
        if (data.authenticated && data.user) {
          if (data.user.role === 'Employee' || data.user.userType === 'EMPLOYEE') {
            window.location.replace('/mark-attendance');
          } else {
            window.location.replace('/dashboard');
          }
        } else {
          if (token) {
            try {
              localStorage.removeItem('attendance_token');
              localStorage.removeItem('attendance_user');
            } catch {}
          }
          window.location.replace('/login');
        }
      } catch {
        window.location.replace('/login');
      }
    }

    redirectUser();
  }, [router]);


  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-400">Loading portal...</p>
      </div>
    </div>
  );
}
