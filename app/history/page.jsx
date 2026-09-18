'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AttendanceHistoryPage() {
  const router = useRouter();

  useEffect(() => {
    // Requirement 3: Attendance History is embedded directly at the bottom of Mark Attendance
    router.replace('/mark-attendance');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm">
      Redirecting to Mark Attendance...
    </div>
  );
}

