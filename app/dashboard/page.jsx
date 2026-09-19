'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import {
  Users,
  UserCheck,
  UserX,
  Factory,
  Clock,
  RefreshCw,
  TrendingUp,
  Activity,
  CheckCircle2,
  AlertCircle,
  Calendar,
  X,
  MapPin,
  Compass,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { formatKolkataDateTime, formatWorkingHours } from '@/lib/timezone';

// ─── Detail Popup Modal ───────────────────────────────────────────────────────
function DetailModal({ open, onClose, title, color, loading, data }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-2xl max-h-[80vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-${color}-50`}>
          <div>
            <h2 className={`text-base font-bold text-${color}-700`}>{title}</h2>
            {!loading && data && (
              <p className="text-xs text-slate-500 mt-0.5">
                {data.count} {data.count === 1 ? 'record' : 'records'}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mb-3 text-blue-500" />
              <span className="text-sm">Loading...</span>
            </div>
          ) : !data || data.list?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <span className="text-sm">No records found.</span>
            </div>
          ) : data.type === 'totalEmployees' ? (
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500 sticky top-0">
                <tr>
                  <th className="px-5 py-3">Emp ID</th>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Designation</th>
                  <th className="px-5 py-3">Authorized</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.list.map((e, i) => (
                  <tr key={e.employeeId || i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 font-mono font-bold text-xs text-blue-600">{e.employeeId}</td>
                    <td className="px-5 py-3 font-semibold text-slate-800">{e.name}</td>
                    <td className="px-5 py-3 text-slate-600">{e.designation}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${e.authorized ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {e.authorized ? 'Yes' : 'No'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : data.type === 'present' ? (
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500 sticky top-0">
                <tr>
                  <th className="px-5 py-3">Emp ID</th>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Designation</th>
                  <th className="px-5 py-3">Plant</th>
                  <th className="px-5 py-3">Mark In</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.list.map((e, i) => (
                  <tr key={e.employeeId || i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 font-mono font-bold text-xs text-blue-600">{e.employeeId}</td>
                    <td className="px-5 py-3 font-semibold text-slate-800">{e.name}</td>
                    <td className="px-5 py-3 text-slate-600">{e.designation}</td>
                    <td className="px-5 py-3 text-slate-600">{e.plantName}</td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-600">{e.markInAt ? formatKolkataDateTime(e.markInAt) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : data.type === 'absent' ? (
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500 sticky top-0">
                <tr>
                  <th className="px-5 py-3">Emp ID</th>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Designation</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.list.map((e, i) => (
                  <tr key={`absent-${i}`} className="hover:bg-rose-50/40 transition-colors">
                    <td className="px-5 py-3 font-mono font-bold text-xs text-rose-600">{e.employeeId}</td>
                    <td className="px-5 py-3 font-semibold text-slate-800">{e.name}</td>
                    <td className="px-5 py-3 text-slate-600">{e.designation}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700">
                        Absent
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : data.type === 'plants' ? (
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500 sticky top-0">
                <tr>
                  <th className="px-5 py-3">Plant ID</th>
                  <th className="px-5 py-3">Plant Name</th>
                  <th className="px-5 py-3">Location</th>
                  <th className="px-5 py-3">Radius</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.list.map((p, i) => (
                  <tr key={`plant-${i}`} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 font-mono font-bold text-xs text-indigo-600">{p.plantId}</td>
                    <td className="px-5 py-3 font-semibold text-slate-800">{p.plantName}</td>
                    <td className="px-5 py-3 text-slate-600 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {p.location}
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700">
                        <Compass className="w-3 h-3" />
                        {p.radiusMeters}m
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : data.type === 'pendingApprovals' ? (
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500 sticky top-0">
                <tr>
                  <th className="px-5 py-3">Emp ID</th>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Plant</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.list.map((r, i) => (
                  <tr key={`pending-${i}`} className="hover:bg-amber-50/40 transition-colors">
                    <td className="px-5 py-3 font-mono font-bold text-xs text-amber-600">{r.employeeId}</td>
                    <td className="px-5 py-3 font-semibold text-slate-800">{r.name}</td>
                    <td className="px-5 py-3 text-slate-600">{r.plantName}</td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-600">{r.attendanceDate}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                        r.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' :
                        r.status === 'ACTIVE' ? 'bg-blue-50 text-blue-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── Header Sort Control Component ──────────────────────────────────────────
function SortHeader({ label, field, currentField, currentDirection, onSort }) {
  const isAscActive = currentField === field && currentDirection === 'asc';
  const isDescActive = currentField === field && currentDirection === 'desc';

  return (
    <th className="px-6 py-3.5 select-none whitespace-nowrap">
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold uppercase tracking-wider text-slate-500 text-xs">
          {label}
        </span>
        <div className="inline-flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onSort(field, 'asc')}
            title={`Sort ${label} Ascending`}
            aria-label={`Sort ${label} Ascending`}
            className={`p-1 rounded-md transition-all cursor-pointer ${
              isAscActive
                ? 'bg-blue-100 text-blue-700 shadow-2xs font-bold'
                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200/70'
            }`}
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onSort(field, 'desc')}
            title={`Sort ${label} Descending`}
            aria-label={`Sort ${label} Descending`}
            className={`p-1 rounded-md transition-all cursor-pointer ${
              isDescActive
                ? 'bg-blue-100 text-blue-700 shadow-2xs font-bold'
                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200/70'
            }`}
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </th>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Sorting state for Today's Attendance Stream
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' | 'desc'

  const handleSort = (field, direction) => {
    setSortField(field);
    setSortDirection(direction);
  };

  const sortedRecentActivity = React.useMemo(() => {
    const list = stats?.recentActivity ? [...stats.recentActivity] : [];
    if (!sortField) return list;

    return list.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'employee') {
        const valA = (a.employeeName || a.employeeId || '').toLowerCase();
        const valB = (b.employeeName || b.employeeId || '').toLowerCase();
        comparison = valA.localeCompare(valB);
      } else if (sortField === 'plant') {
        const valA = (a.plantName || '').toLowerCase();
        const valB = (b.plantName || '').toLowerCase();
        comparison = valA.localeCompare(valB);
      } else if (sortField === 'markInAt') {
        const timeA = a.markInAt ? new Date(a.markInAt).getTime() : 0;
        const timeB = b.markInAt ? new Date(b.markInAt).getTime() : 0;
        comparison = timeA - timeB;
      } else if (sortField === 'markOutAt') {
        const timeA = a.markOutAt ? new Date(a.markOutAt).getTime() : 0;
        const timeB = b.markOutAt ? new Date(b.markOutAt).getTime() : 0;
        comparison = timeA - timeB;
      } else if (sortField === 'status') {
        const valA = (a.status || '').toLowerCase();
        const valB = (b.status || '').toLowerCase();
        comparison = valA.localeCompare(valB);
      } else if (sortField === 'approval') {
        const valA = (a.approvalStatus || '').toLowerCase();
        const valB = (b.approvalStatus || '').toLowerCase();
        comparison = valA.localeCompare(valB);
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [stats?.recentActivity, sortField, sortDirection]);

  // Detail popup state
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTitle, setDetailTitle] = useState('');
  const [detailColor, setDetailColor] = useState('blue');
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState(null);

  const fetchStats = async () => {
    try {
      setRefreshing(true);
      const res = await fetch('/api/dashboard');
      if (res.ok) {
        const data = await res.json();
        setStats(data.data);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const timer = setInterval(fetchStats, 30000);
    return () => clearInterval(timer);
  }, []);

  const openDetail = useCallback(async (type, title, color) => {
    setDetailTitle(title);
    setDetailColor(color);
    setDetailData(null);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/dashboard/detail?type=${type}`);
      if (res.ok) {
        const data = await res.json();
        setDetailData(data);
      }
    } catch (err) {
      console.error('Failed to fetch detail:', err);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  return (
    <AppLayout requiredPermission="dashboard">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Attendance Dashboard</h1>
              {stats?.plantScope && !stats.plantScope.isAllPlants && stats.plantScope.plantNames?.length > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
                  <Factory className="w-3.5 h-3.5" />
                  <span>{stats.plantScope.plantNames.join(', ')}</span>
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Live workforce attendance metrics and operational overview
            </p>
          </div>
          <button
            onClick={fetchStats}
            disabled={refreshing}
            className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-semibold shadow-xs transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 text-blue-600 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh Data'}</span>
          </button>
        </div>

        {/* Primary 3 KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {/* Card 1: Total Employees */}
          <button
            onClick={() => openDetail('totalEmployees', 'Total Active Employees', 'blue')}
            className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs hover:shadow-md hover:border-blue-200 hover:-translate-y-0.5 transition-all text-left relative overflow-hidden group cursor-pointer w-full"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Active Employees</p>
                <p className="text-3xl font-extrabold text-slate-900 mt-2">
                  {loading ? '...' : stats?.totalActiveEmployees ?? 0}
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 group-hover:bg-blue-100 transition-colors">
                <Users className="w-6 h-6" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs text-slate-500 font-medium">
              <span className="text-blue-600 font-semibold mr-1.5">Registered</span> on workforce roster
            </div>
            <span className="absolute bottom-2 right-3 text-[10px] text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity font-semibold">Click to view list →</span>
          </button>

          {/* Card 2: Present Employees */}
          <button
            onClick={() => openDetail('present', 'Present Today', 'emerald')}
            className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs hover:shadow-md hover:border-emerald-200 hover:-translate-y-0.5 transition-all text-left relative overflow-hidden group cursor-pointer w-full"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Present Today</p>
                <p className="text-3xl font-extrabold text-slate-900 mt-2">
                  {loading ? '...' : stats?.presentEmployees ?? 0}
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 group-hover:bg-emerald-100 transition-colors">
                <UserCheck className="w-6 h-6" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs text-emerald-600 font-medium">
              <CheckCircle2 className="w-4 h-4 mr-1" />
              <span>Marked in successfully today</span>
            </div>
            <span className="absolute bottom-2 right-3 text-[10px] text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity font-semibold">Click to view list →</span>
          </button>

          {/* Card 3: Absent Employees */}
          <button
            onClick={() => openDetail('absent', 'Absent Today', 'rose')}
            className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs hover:shadow-md hover:border-rose-200 hover:-translate-y-0.5 transition-all text-left relative overflow-hidden group cursor-pointer w-full"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-rose-600 uppercase tracking-wider">Absent Today</p>
                <p className="text-3xl font-extrabold text-slate-900 mt-2">
                  {loading ? '...' : stats?.absentEmployees ?? 0}
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 group-hover:bg-rose-100 transition-colors">
                <UserX className="w-6 h-6" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs text-slate-500 font-medium">
              <span className="font-mono text-slate-600 mr-1.5 font-bold">Total Active - Present</span>
            </div>
            <span className="absolute bottom-2 right-3 text-[10px] text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity font-semibold">Click to view list →</span>
          </button>
        </div>

        {/* Secondary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {/* Currently on Shift — NOT clickable */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-md flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">Currently on Active Shift</p>
              <p className="text-2xl font-bold mt-1 text-blue-400">{stats?.currentlyOnShift ?? 0}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <Clock className="w-5 h-5 animate-spin-slow" />
            </div>
          </div>

          {/* Active Plants — Clickable */}
          <button
            onClick={() => openDetail('plants', 'Active Geofenced Plants', 'indigo')}
            className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md hover:border-indigo-200 hover:-translate-y-0.5 transition-all flex items-center justify-between group cursor-pointer w-full relative overflow-hidden"
          >
            <div className="text-left">
              <p className="text-xs font-medium text-slate-500">Active Geofenced Plants</p>
              <p className="text-2xl font-bold mt-1 text-slate-800">{stats?.totalActivePlants ?? 0}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 group-hover:bg-indigo-100 transition-colors">
              <Factory className="w-5 h-5" />
            </div>
            <span className="absolute bottom-1.5 right-3 text-[10px] text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity font-semibold">Click to view →</span>
          </button>

          {/* Pending Approvals — Clickable */}
          <button
            onClick={() => openDetail('pendingApprovals', 'Pending Approvals', 'amber')}
            className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md hover:border-amber-200 hover:-translate-y-0.5 transition-all flex items-center justify-between group cursor-pointer w-full relative overflow-hidden"
          >
            <div className="text-left">
              <p className="text-xs font-medium text-slate-500">Pending Approvals</p>
              <p className="text-2xl font-bold mt-1 text-amber-600">{stats?.pendingApprovals ?? 0}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 group-hover:bg-amber-100 transition-colors">
              <AlertCircle className="w-5 h-5" />
            </div>
            <span className="absolute bottom-1.5 right-3 text-[10px] text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity font-semibold">Click to view →</span>
          </button>
        </div>

        {/* Recent Activity Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-bold text-slate-900">Today's Attendance Stream</h2>
            </div>
            <span className="text-xs font-medium text-slate-500">Live feed</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200/70">
                <tr>
                  <SortHeader
                    label="Employee"
                    field="employee"
                    currentField={sortField}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                  />
                  <SortHeader
                    label="Plant"
                    field="plant"
                    currentField={sortField}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                  />
                  <SortHeader
                    label="Mark In Time"
                    field="markInAt"
                    currentField={sortField}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                  />
                  <SortHeader
                    label="Mark Out Time"
                    field="markOutAt"
                    currentField={sortField}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                  />
                  <SortHeader
                    label="Status"
                    field="status"
                    currentField={sortField}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                  />
                  <SortHeader
                    label="Approval"
                    field="approval"
                    currentField={sortField}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                      Loading attendance data...
                    </td>
                  </tr>
                ) : !sortedRecentActivity || sortedRecentActivity.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                      No attendance records marked yet today.
                    </td>
                  </tr>
                ) : (
                  sortedRecentActivity.map((record, idx) => (
                    <tr key={record._id || `act-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-800">
                        {record.employeeName}
                        <span className="block text-xs font-mono font-normal text-slate-400">
                          {record.employeeId}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-700">{record.plantName}</td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-700">
                        {formatKolkataDateTime(record.markInAt)}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-700">
                        {record.markOutAt ? formatKolkataDateTime(record.markOutAt) : '— Active Shift —'}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                            record.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                              : record.status === 'ACTIVE'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                              : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                          }`}
                        >
                          {record.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            record.approvalStatus === 'APPROVED'
                              ? 'bg-emerald-50 text-emerald-700'
                              : record.approvalStatus === 'CANCELLED'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {record.approvalStatus}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Detail Popup Modal */}
      <DetailModal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={detailTitle}
        color={detailColor}
        loading={detailLoading}
        data={detailData}
      />
    </AppLayout>
  );
}
