'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import AppSidebar from './AppSidebar';
import AppNavbar from './AppNavbar';
import { Fingerprint, LogOut, LayoutDashboard, ShieldAlert } from 'lucide-react';
import Link from 'next/link';

import { hasPermission } from '@/lib/permissions';

export default function AppLayout({ children, requiredPermission, employeeOnly = false, adminOnly = false }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    async function checkAuth() {
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
          window.location.href = '/login';
          return;
        }

        const data = await res.json();
        if (!data.authenticated || !data.user) {
          if (token) {
            try {
              localStorage.removeItem('attendance_token');
              localStorage.removeItem('attendance_user');
            } catch {}
          }
          router.push('/login');
          return;
        }

        const currentUser = data.user;
        setUser(currentUser);

        const isEmp = currentUser.role === 'Employee' || currentUser.userType === 'EMPLOYEE';
        const isAdmin = currentUser.role === 'Admin';

        // Check Employee-only barrier (e.g. mark attendance)
        if (employeeOnly && !isEmp) {
          setAccessDenied(true);
          setLoading(false);
          return;
        }

        // Check Admin-only barrier
        if (adminOnly && !isAdmin) {
          setAccessDenied(true);
          setLoading(false);
          return;
        }

        // Check specific page permission for System Users
        if (requiredPermission && !isAdmin) {
          if (isEmp || !hasPermission(currentUser, requiredPermission)) {
            setAccessDenied(true);
            setLoading(false);
            return;
          }
        }

        setLoading(false);
      } catch (err) {
        console.error('Layout auth check failed:', err);
        router.push('/login');
      }
    }

    checkAuth();
  }, [pathname, requiredPermission, employeeOnly, adminOnly, router]);

  const handleLogout = async () => {
    try {
      localStorage.removeItem('attendance_token');
      localStorage.removeItem('attendance_user');
    } catch {}
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('Logout error:', e);
    }
    window.location.href = '/login';
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-slate-500">Loading portal...</p>
        </div>
      </div>
    );
  }

  if (accessDenied) {
    const isEmp = user?.role === 'Employee' || user?.userType === 'EMPLOYEE';
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-slate-200 shadow-xl text-center">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-100">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Access Restricted</h2>
          <p className="text-sm text-slate-600 mb-6">
            You do not have authorization to view this page. Please contact your system administrator for permissions.
          </p>
          <div className="flex flex-col gap-2">
            <Link
              href={isEmp ? '/mark-attendance' : '/dashboard'}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-all shadow-md shadow-blue-600/20"
            >
              Go to Home ({isEmp ? 'Mark Attendance' : 'Dashboard'})
            </Link>
            <button
              onClick={handleLogout}
              className="w-full py-2 px-4 rounded-xl text-slate-600 hover:bg-slate-100 font-medium text-sm transition-colors cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isEmployee = user?.role === 'Employee' || user?.userType === 'EMPLOYEE';

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar for navigation */}
      <AppSidebar
        user={user}
        onLogout={handleLogout}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      {/* Main Content Area */}
      <div className="flex-1 md:pl-64 flex flex-col min-w-0 pb-16 md:pb-0">
        <AppNavbar user={user} onLogout={handleLogout} setMobileOpen={setMobileOpen} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto animate-in fade-in duration-150">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation for Employees: Only Mark Attendance and Logout (Requirement 3) */}
      {isEmployee && (
        <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 z-30 flex items-center justify-around py-2 shadow-lg">
          <Link
            href="/mark-attendance"
            className={`flex flex-col items-center gap-1 py-1 px-4 rounded-xl text-xs font-semibold ${
              pathname === '/mark-attendance' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Fingerprint className="w-5 h-5" />
            <span>Mark Attendance</span>
          </Link>
          <button
            onClick={handleLogout}
            className="flex flex-col items-center gap-1 py-1 px-4 rounded-xl text-xs font-semibold text-rose-500 hover:text-rose-700 cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </nav>
      )}
    </div>
  );
}

