'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    async function redirectUser() {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          router.replace('/login');
          return;
        }
        const data = await res.json();
        if (data.authenticated && data.user) {
          if (data.user.role === 'Employee' || data.user.userType === 'EMPLOYEE') {
            router.replace('/mark-attendance');
          } else {
            router.replace('/dashboard');
          }
        } else {
          router.replace('/login');
        }
      } catch {
        router.replace('/login');
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
