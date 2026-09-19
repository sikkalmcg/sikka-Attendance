'use client';

import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import {
  FileSpreadsheet,
  Download,
  Filter,
  Calendar,
  Search,
  RefreshCw,
  Building2,
  Check,
  Database,
} from 'lucide-react';
import {
  formatKolkataDateTime,
  formatWorkingHours,
  getTodayDateString,
} from '@/lib/timezone';

export default function ReportPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [plants, setPlants] = useState([]);

  // Multi-select Plant State (Section 23)
  // 'ALL' or array of plant names / IDs
  const [selectedPlants, setSelectedPlants] = useState(['ALL']);
  const [plantDropdownOpen, setPlantDropdownOpen] = useState(false);

  // Section 24: Default Date Range
  // From = Previous Month's 1st Date, To = Current Date
  const getDefaultDates = () => {
    const toStr = getTodayDateString();
    const today = new Date();

    // 1st of previous month
    const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const fromYear = prevMonthDate.getFullYear();
    const fromMonth = String(prevMonthDate.getMonth() + 1).padStart(2, '0');
    const fromStr = `${fromYear}-${fromMonth}-01`;

    return { fromStr, toStr };
  };

  const { fromStr: defaultFrom, toStr: defaultTo } = getDefaultDates();
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);
  const [selectedStatus, setSelectedStatus] = useState('ALL'); // 'ALL' | 'Present' | 'Absent'
  const [allTime, setAllTime] = useState(false); // Fetch all data from database mode
  const [exporting, setExporting] = useState(false);

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

  const fetchPlants = async () => {
    try {
      const res = await fetch('/api/plants');
      if (res.ok) {
        const data = await safeParseJson(res);
        if (data) setPlants(data.plants || []);
      }
    } catch (e) {
      console.error('Error fetching plants:', e);
    }
  };

  const fetchReports = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      if (allTime) {
        params.set('allData', 'true');
      } else {
        if (dateFrom) params.set('dateFrom', dateFrom);
        if (dateTo) params.set('dateTo', dateTo);
      }

      if (!selectedPlants.includes('ALL') && selectedPlants.length > 0) {
        params.set('plants', selectedPlants.join(','));
      }

      if (selectedStatus && selectedStatus !== 'ALL') {
        params.set('status', selectedStatus);
      }

      const res = await fetch(`/api/reports/attendance?${params.toString()}`);
      if (res.ok) {
        const data = await safeParseJson(res);
        if (data) setRecords(data.records || []);
      }
    } catch (err) {
      console.error('Failed to fetch reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlants();
  }, []);

  useEffect(() => {
    fetchReports();
  }, [dateFrom, dateTo, selectedPlants, selectedStatus, allTime]);

  // Handle Plant Multi-select toggle
  const handleTogglePlant = (pName) => {
    if (pName === 'ALL') {
      setSelectedPlants(['ALL']);
      return;
    }

    let updated = selectedPlants.filter((item) => item !== 'ALL');
    if (updated.includes(pName)) {
      updated = updated.filter((item) => item !== pName);
    } else {
      updated.push(pName);
    }

    if (updated.length === 0) {
      setSelectedPlants(['ALL']);
    } else {
      setSelectedPlants(updated);
    }
  };

  // Section 26: Export Excel
  const handleExportExcel = async () => {
    try {
      setExporting(true);
      const params = new URLSearchParams();

      if (allTime) {
        params.set('allData', 'true');
      } else {
        if (dateFrom) params.set('dateFrom', dateFrom);
        if (dateTo) params.set('dateTo', dateTo);
      }

      if (!selectedPlants.includes('ALL') && selectedPlants.length > 0) {
        params.set('plants', selectedPlants.join(','));
      }
      if (selectedStatus && selectedStatus !== 'ALL') {
        params.set('status', selectedStatus);
      }
      params.set('export', 'xlsx');

      const res = await fetch(`/api/reports/attendance?${params.toString()}`);
      if (!res.ok) throw new Error('Excel generation failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = allTime
        ? `attendance_report_ALL_DATABASE_RECORDS.xlsx`
        : `attendance_report_${dateFrom}_to_${dateTo}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export error:', e);
      alert('Failed to export Excel report.');
    } finally {
      setExporting(false);
    }
  };

  // Display text for selected plants
  const plantDisplayText = selectedPlants.includes('ALL')
    ? 'All Plants'
    : selectedPlants.length === 1
    ? selectedPlants[0]
    : `${selectedPlants.length} Plants Selected`;

  return (
    <AppLayout requiredPermission="report">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 mb-1.5 border border-blue-100">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Enterprise Reporting</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Attendance Report
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {allTime ? (
                <span>Fetching <strong className="text-blue-600 font-bold">ALL database records</strong> across the entire attendance collection</span>
              ) : (
                <span>Showing <strong className="text-emerald-600">Approved</strong> attendance records</span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Fetch All Data from DB Toggle Button */}
            <button
              onClick={() => setAllTime(!allTime)}
              disabled={loading}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-xs ${
                allTime
                  ? 'bg-blue-600 text-white shadow-blue-600/20 ring-2 ring-blue-500'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Database className={`w-4 h-4 ${allTime ? 'text-white' : 'text-blue-600'}`} />
              <span>{allTime ? 'Showing All Data (DB)' : 'Fetch All Data from DB'}</span>
            </button>

            {/* Section 26: Export Excel Button */}
            <button
              onClick={handleExportExcel}
              disabled={exporting || loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <Download className={`w-4 h-4 ${exporting ? 'animate-bounce' : ''}`} />
              <span>{exporting ? 'Exporting...' : 'Export Excel'}</span>
            </button>

            <button
              onClick={fetchReports}
              className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              title="Refresh Report"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Section 23 & 24: Filter Bar */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5 text-blue-600" />
            <span>Report Filters</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Section 23: Plant Multi-Select Dropdown */}
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Plant Selection
              </label>
              <button
                type="button"
                onClick={() => setPlantDropdownOpen(!plantDropdownOpen)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 flex items-center justify-between hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <span className="truncate">{plantDisplayText}</span>
                <span className="text-slate-400 text-[10px]">▼</span>
              </button>

              {plantDropdownOpen && (
                <div className="absolute z-30 mt-1.5 w-full bg-white border border-slate-200 rounded-2xl shadow-xl p-2 space-y-1 text-xs animate-in fade-in duration-100 max-h-60 overflow-y-auto">
                  <div
                    onClick={() => handleTogglePlant('ALL')}
                    className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors ${
                      selectedPlants.includes('ALL') ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span>All Plants</span>
                    {selectedPlants.includes('ALL') && <Check className="w-3.5 h-3.5 text-blue-600" />}
                  </div>

                  <div className="h-px bg-slate-100 my-1" />

                  {plants.map((p) => {
                    const isChecked = selectedPlants.includes(p.plantName || p.name);
                    return (
                      <div
                        key={p.id || p._id}
                        onClick={() => handleTogglePlant(p.plantName || p.name)}
                        className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors ${
                          isChecked ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span className="truncate">{p.plantName || p.name}</span>
                        {isChecked && <Check className="w-3.5 h-3.5 text-blue-600" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Requirement 1: Status Filter Dropdown (Present / Absent only) */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Attendance Status
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="Present">Present</option>
                <option value="Absent">Absent</option>
              </select>
            </div>

            {/* Section 24: Period From Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Period From Date
              </label>
              <input
                type="date"
                value={dateFrom}
                max={getTodayDateString()}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Section 24: Period To Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Period To Date
              </label>
              <input
                type="date"
                value={dateTo}
                max={getTodayDateString()}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Section 25: Report Table */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing <strong>{records.length}</strong> record(s) matching criteria
            </span>
            <span className="text-[11px] font-mono">
              {allTime ? 'Mode: All Time (Full Database Records)' : `Date Range: ${dateFrom} to ${dateTo}`}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[11px] uppercase font-bold text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Employee ID</th>
                  <th className="py-3 px-4">Employee Name</th>
                  <th className="py-3 px-4">Designation</th>
                  <th className="py-3 px-4">Attendance Date</th>
                  <th className="py-3 px-4">Mark In Plant</th>
                  <th className="py-3 px-4">Mark IN Date Time</th>
                  <th className="py-3 px-4">Mark Out Date Time</th>
                  <th className="py-3 px-4">Working Hour</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Mark Out Type</th>
                  <th className="py-3 px-4">Mark Out Plant</th>
                  <th className="py-3 px-4">Manual Attendance By</th>
                  <th className="py-3 px-4">Approved By</th>
                  <th className="py-3 px-4">Remark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={14} className="py-12 text-center text-slate-400 font-medium">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                      Loading report data...
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="py-12 text-center text-slate-400 font-medium">
                      No approved attendance records found for the selected period and plants.
                    </td>
                  </tr>
                ) : (
                  records.map((r) => {
                    const isAbsent = r.status === 'ABSENT' || String(r.status).toLowerCase() === 'absent';
                    const isActive = !isAbsent && r.status === 'ACTIVE' && !r.markOutAt;

                    // Manual Attendance By formatting (Requirements 4, 5, 6, 7, 8)
                    const inBy = r.markInManualBy;
                    const outBy = r.markOutManualBy;
                    const legacyBy = r.manualAttendanceBy;

                    let manualDisplay = '—';
                    if (inBy && outBy) {
                      if (inBy === outBy) {
                        // Case 3: Same user for both
                        manualDisplay = inBy;
                      } else {
                        manualDisplay = `Mark In: ${inBy}, Mark Out: ${outBy}`;
                      }
                    } else if (inBy) {
                      // Case 1
                      manualDisplay = `Mark In Manual by ${inBy}`;
                    } else if (outBy) {
                      // Case 2
                      manualDisplay = `Mark Out Manual by ${outBy}`;
                    } else if (legacyBy) {
                      manualDisplay = legacyBy;
                    }

                    // Remark formatting (Requirement 3, 5, 9)
                    const rawRemarks = (r.remarks || r.remark || '').trim();
                    const remarkParts = [];
                    if (inBy && outBy) {
                      if (inBy === outBy) {
                        remarkParts.push(`Mark In Manual by ${inBy}`, `Mark Out Manual by ${inBy}`);
                      } else {
                        remarkParts.push(`Mark In Manual by ${inBy}`, `Mark Out Manual by ${outBy}`);
                      }
                    } else if (inBy) {
                      remarkParts.push(`Mark In Manual by ${inBy}`);
                    } else if (outBy) {
                      remarkParts.push(`Mark Out Manual by ${outBy}`);
                    } else if (legacyBy) {
                      remarkParts.push(`Manual by ${legacyBy}`);
                    }

                    if (rawRemarks) {
                      const isRedundant = remarkParts.some((p) => rawRemarks.toLowerCase().includes(p.toLowerCase()));
                      if (!isRedundant) {
                        remarkParts.push(rawRemarks);
                      }
                    } else if (isAbsent && remarkParts.length === 0) {
                      remarkParts.push('Approved Absent');
                    }

                    const remarkDisplay = remarkParts.length > 0 ? remarkParts.join('; ') : '—';

                    const formatPlantName = (val) => {
                      if (!val || typeof val !== 'string') return '-';
                      const t = val.trim();
                      return (t === 'Manufacturing Plant' || t === '-' || t.toLowerCase() === 'n/a') ? '-' : t;
                    };

                    return (
                      <tr key={r.id || r._id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-blue-600 whitespace-nowrap">
                          {r.employeeId || '-'}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                          {r.employeeName || '-'}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                          {r.designation || 'Staff'}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-700 whitespace-nowrap">
                          {r.attendanceDate || '-'}
                        </td>
                        <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                          {isAbsent ? '-' : formatPlantName(r.markInPlantName || r.plantName)}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600 whitespace-nowrap">
                          {!isAbsent && r.markInAt ? formatKolkataDateTime(r.markInAt) : '-'}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600 whitespace-nowrap">
                          {isAbsent ? (
                            '-'
                          ) : isActive ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                              Active
                            </span>
                          ) : r.markOutAt ? (
                            formatKolkataDateTime(r.markOutAt)
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-800 whitespace-nowrap">
                          {isAbsent
                            ? '0:00'
                            : isActive
                            ? 'Running'
                            : r.workingMinutes > 0
                            ? formatWorkingHours(r.workingMinutes)
                            : '0:00'}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              isAbsent
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {isAbsent ? 'Absent' : 'Present'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-700 whitespace-nowrap">
                          {isAbsent ? '-' : (r.markOutType || 'Self')}
                        </td>
                        <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                          {isAbsent ? '-' : formatPlantName(r.markOutPlantName || r.plantName)}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                          {manualDisplay !== '—' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              {manualDisplay}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                          {r.approvedBy || '-'}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                          {remarkDisplay !== '—' ? (
                            <span className="text-slate-700 font-medium text-xs">
                              {remarkDisplay}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
