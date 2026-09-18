'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Factory,
  UserCheck,
  FileSpreadsheet,
  Users,
  ShieldCheck,
  Fingerprint,
  History,
  LogOut,
  Building2,
} from 'lucide-react';
import { hasPermission } from '@/lib/permissions';

export default function AppSidebar({ user, onLogout, mobileOpen, setMobileOpen }) {
  const pathname = usePathname();

  if (!user) return null;

  const isEmployee = user.role === 'Employee' || user.userType === 'EMPLOYEE';
  const isAdmin = user.role === 'Admin';

  // Build navigation items based on role & permissions
  const navItems = [];

  if (isEmployee) {
    // Requirements 3 & 14: Employee navigation has ONLY Mark Attendance (and Logout in footer)
    navItems.push({
      name: 'Mark Attendance',
      href: '/mark-attendance',
      icon: Fingerprint,
    });
  } else {
    // Requirements 11 & 12: Admin / System User navigation based on Dashboard, Plant, Approval, Report, Employee, User Management
    if (hasPermission(user, 'dashboard')) {
      navItems.push({
        name: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
      });
    }

    if (hasPermission(user, 'plant')) {
      navItems.push({
        name: 'Plant',
        href: '/plant',
        icon: Factory,
      });
    }

    if (hasPermission(user, 'approval')) {
      navItems.push({
        name: 'Approval',
        href: '/approval',
        icon: UserCheck,
      });
    }

    if (hasPermission(user, 'report')) {
      navItems.push({
        name: 'Report',
        href: '/report',
        icon: FileSpreadsheet,
      });
    }

    if (hasPermission(user, 'employee')) {
      navItems.push({
        name: 'Employee',
        href: '/employee',
        icon: Users,
      });
    }

    if (hasPermission(user, 'user-management')) {
      navItems.push({
        name: 'User Management',
        href: '/user-management',
        icon: ShieldCheck,
      });
    }
  }


  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 text-white select-none">
      {/* Brand Header */}
      <div className="px-6 py-5 border-b border-slate-800 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Building2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight text-white">Attendance Portal</h1>
          <span className="text-xs font-medium text-slate-400">Enterprise Geofence</span>
        </div>
      </div>

      {/* User Quick Info */}
      <div className="px-6 py-4 border-b border-slate-800/80 bg-slate-900/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-sm">
            {(user.fullName || user.username || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-100 truncate">{user.fullName || user.username}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  isEmployee ? 'bg-emerald-400' : isAdmin ? 'bg-blue-400' : 'bg-purple-400'
                }`}
              />
              <span className="text-xs text-slate-400 capitalize">
                {isEmployee ? `Employee (${user.designation || 'Staff'})` : user.role || 'User'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
          Navigation
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen && setMobileOpen(false)}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Logout Footer */}
      <div className="p-4 border-t border-slate-800">
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium text-rose-300 hover:text-rose-100 hover:bg-rose-500/20 border border-rose-500/20 transition-all cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 fixed inset-y-0 left-0 z-30 shadow-xl">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
