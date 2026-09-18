'use client';

import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import Modal from '@/components/common/Modal';
import Toast from '@/components/common/Toast';
import {
  CheckCircle,
  Clock,
  RefreshCw,
  AlertTriangle,
  RotateCcw,
  Edit2,
  CheckCheck,
  Plus,
  Filter,
  UserCheck,
  Building2,
  Calendar,
  Search,
  X,
} from 'lucide-react';
import {
  formatKolkataDate,
  formatKolkataTime,
  formatKolkataDateTime,
  formatWorkingHours,
  getAttendanceDateString,
  getTodayDateString,
  getYesterdayDateString,
  isFutureKolkataDate,
  isFutureKolkataDateTime,
  toKolkataDateTimeLocal,
  parseKolkataDateTime,
} from '@/lib/timezone';

export default function ApprovalPage() {
  const [activeTab, setActiveTab] = useState('PENDING'); // 'PENDING' (Pending Approvals – Me) | 'APPROVED'
  const [attendances, setAttendances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Employee search filter
  const [searchTerm, setSearchTerm] = useState('');

  // Mark Date selection: Current date or any past date (never future date)
  const currentDate = getTodayDateString();
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());

  // Pagination
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  // Checkbox Selection for Pending Tab
  const [selectedIds, setSelectedIds] = useState([]);

  // Multi-Approve Confirmation Modal
  const [multiApproveModalOpen, setMultiApproveModalOpen] = useState(false);

  // Single Approve Modal
  const [singleApproveRecord, setSingleApproveRecord] = useState(null);

  // Absent Approve Confirmation Modal
  const [absentApproveRecord, setAbsentApproveRecord] = useState(null);

  // Edit Modal State (Single record only)
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [editForm, setEditForm] = useState({
    markInAt: '',
    markOutAt: '',
    calculatedHours: '0:00',
    remarks: '',
  });

  // Restore Modal State
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [restoringRecord, setRestoringRecord] = useState(null);

  // Manual Attendance Modal State
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [employeesList, setEmployeesList] = useState([]);
  const [plantsList, setPlantsList] = useState([]);
  const [manualForm, setManualForm] = useState({
    employeeId: '',
    plantId: '',
    markInAt: '',
    markOutAt: '',
    calculatedHours: '0:00',
    remarks: '',
  });

  const [processing, setProcessing] = useState(false);

  // Mark Date Selector change handler
  const handleDateChange = (newDate) => {
    if (!newDate) return;
    if (isFutureKolkataDate(newDate)) {
      setToast({
        type: 'error',
        message: 'Future date or time is not allowed. Please select the current or past date and time.',
      });
      return;
    }
    setSelectedDate(newDate);
  };

  const fetchAttendances = async () => {
    try {
      setLoading(true);
      setSelectedIds([]);
      const params = new URLSearchParams();
      params.set('approvalStatus', activeTab);
      params.set('date', selectedDate);

      const res = await fetch(`/api/approvals?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setAttendances(data.attendances || []);
      } else {
        setToast({ type: 'error', message: data.error || 'Failed to load attendance records.' });
      }
    } catch (err) {
      console.error('Failed to fetch approvals:', err);
      setToast({ type: 'error', message: 'Failed to load attendance records.' });
    } finally {
      setLoading(false);
    }
  };

  const fetchDropdownData = async () => {
    try {
      const [empRes, plantRes] = await Promise.all([
        fetch('/api/employees?limit=200'),
        fetch('/api/plants'),
      ]);
      if (empRes.ok) {
        const empData = await empRes.json();
        setEmployeesList(empData.employees || []);
      }
      if (plantRes.ok) {
        const plantData = await plantRes.json();
        setPlantsList(plantData.plants || []);
      }
    } catch (e) {
      console.error('Error fetching dropdowns:', e);
    }
  };

  useEffect(() => {
    fetchAttendances();
    setCurrentPage(1);
  }, [activeTab, selectedDate]);

  // Reset to page 1 whenever page size or search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize, searchTerm]);

  useEffect(() => {
    fetchDropdownData();
  }, []);

  // Helper to determine approval rule eligibility per prompt specifications
  const getApprovalEligibility = (record) => {
    const recDate = record.attendanceDate || getAttendanceDateString(record) || selectedDate;
    const isCurrentDate = recDate === currentDate;
    const isAbsent = record.status === 'ABSENT' || (!record.markInAt && !record.markOutAt);
    const hasMarkIn = Boolean(record.markInAt);
    const hasMarkOut = Boolean(record.markOutAt);

    // Rule 1: Current Date Attendance - Cannot be approved on current day
    if (isCurrentDate) {
      return {
        canApprove: false,
        actionType: 'DISABLED',
        reason: 'Current-day attendance cannot be approved on the same day.',
      };
    }

    // Rule 3: Past Date – No Mark IN and No Mark OUT -> Absent
    if (isAbsent || (!hasMarkIn && !hasMarkOut)) {
      return {
        canApprove: true,
        actionType: 'APPROVE_ABSENT',
        reason: '',
      };
    }

    // Rule 2: Past Date – Mark IN Complete but Mark OUT Incomplete
    if (hasMarkIn && !hasMarkOut) {
      return {
        canApprove: false,
        actionType: 'DISABLED',
        reason: 'The employee must first complete Mark OUT.',
      };
    }

    // Rule 4 & 5: Past Date – Mark IN and Mark OUT Complete
    return {
      canApprove: true,
      actionType: 'APPROVE',
      reason: '',
    };
  };

  // Client-side search filtering by employee name, employee ID, designation, and plant name
  const filteredAttendances = attendances.filter((record) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase().trim();
    const name = (record.employeeName || '').toLowerCase();
    const id = (record.employeeId || '').toLowerCase();
    const desig = (record.designation || '').toLowerCase();
    const plant = (record.markInPlantName || record.plantName || '').toLowerCase();
    return name.includes(q) || id.includes(q) || desig.includes(q) || plant.includes(q);
  });

  const eligibleAttendances = filteredAttendances.filter((a) => getApprovalEligibility(a).canApprove);
  const eligibleIds = eligibleAttendances.map((a) => a.id || a._id);

  // Multi-select helpers: only selects records eligible for approval
  const handleToggleSelectAll = () => {
    if (selectedIds.length > 0 && selectedIds.length === eligibleIds.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(eligibleIds);
    }
  };

  const handleToggleSelectRow = (id) => {
    const target = attendances.find((a) => (a.id || a._id) === id);
    if (!target || !getApprovalEligibility(target).canApprove) return;
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // Live Working Hours calculation helper for ISO datetime-local strings
  const calculateLiveHours = (inStr, outStr) => {
    if (!inStr || !outStr) return '0:00';
    const inDate = parseKolkataDateTime(inStr);
    const outDate = parseKolkataDateTime(outStr);
    if (!inDate || !outDate) return '0:00';
    const inTime = inDate.getTime();
    const outTime = outDate.getTime();
    if (isNaN(inTime) || isNaN(outTime) || outTime <= inTime) return '0:00';
    const minutes = Math.round((outTime - inTime) / 60000);
    return formatWorkingHours(minutes);
  };

  // Open Edit Modal
  const openEditModal = (record) => {
    setEditingRecord(record);
    const inVal = record.markInAt ? toKolkataDateTimeLocal(record.markInAt) : '';
    const outVal = record.markOutAt ? toKolkataDateTimeLocal(record.markOutAt) : '';
    const initialHours = calculateLiveHours(inVal, outVal);

    setEditForm({
      markInAt: inVal,
      markOutAt: outVal,
      calculatedHours: initialHours,
      remarks: record.remarks || '',
    });
    setEditModalOpen(true);
  };

  // Open Restore Modal
  const openRestoreModal = (record) => {
    setRestoringRecord(record);
    setRestoreModalOpen(true);
  };

  // Open Manual Attendance Modal
  const openManualModal = () => {
    // If viewing current date, use current time; if past date, use 09:00 on selectedDate
    const defaultIn =
      selectedDate === currentDate
        ? toKolkataDateTimeLocal(new Date())
        : `${selectedDate}T09:00`;

    setManualForm({
      employeeId: '',
      plantId: '',
      markInAt: defaultIn,
      markOutAt: '',
      calculatedHours: '0:00',
      remarks: '',
    });
    setManualModalOpen(true);
  };

  // Approve Action (Single or Multiple)
  const handleApprove = async (idsToApprove) => {
    setProcessing(true);
    try {
      const res = await fetch('/api/attendance/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: idsToApprove }),
      });

      const data = await res.json();
      if (!res.ok) {
        setToast({ type: 'error', message: data.error || 'Approval failed.' });
        return;
      }

      setToast({ type: 'success', message: data.message || 'Approved successfully.' });
      setMultiApproveModalOpen(false);
      setSingleApproveRecord(null);
      setAbsentApproveRecord(null);
      await fetchAttendances();
    } catch (err) {
      console.error('Approve error:', err);
      setToast({ type: 'error', message: 'Failed to approve attendance.' });
    } finally {
      setProcessing(false);
    }
  };

  // Save Edit Action
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingRecord) return;

    // Strict Future Date/Time check
    if (isFutureKolkataDateTime(editForm.markInAt)) {
      setToast({
        type: 'error',
        message: 'Future date or time is not allowed. Please select the current or past date and time.',
      });
      return;
    }
    if (editForm.markOutAt && isFutureKolkataDateTime(editForm.markOutAt)) {
      setToast({
        type: 'error',
        message: 'Future date or time is not allowed. Please select the current or past date and time.',
      });
      return;
    }

    setProcessing(true);
    try {
      const res = await fetch('/api/attendance/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingRecord.id || editingRecord._id,
          markInAt: editForm.markInAt,
          markOutAt: editForm.markOutAt || null,
          remarks: editForm.remarks,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setToast({ type: 'error', message: data.error || 'Failed to update attendance.' });
        return;
      }

      setToast({ type: 'success', message: 'Attendance record updated successfully.' });
      setEditModalOpen(false);
      setEditingRecord(null);
      await fetchAttendances();
    } catch (err) {
      console.error('Edit error:', err);
      setToast({ type: 'error', message: 'Network error while updating attendance.' });
    } finally {
      setProcessing(false);
    }
  };

  // Confirm Restore Action
  const handleConfirmRestore = async () => {
    if (!restoringRecord) return;
    setProcessing(true);

    try {
      const res = await fetch('/api/attendance/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: restoringRecord.id || restoringRecord._id }),
      });

      const data = await res.json();
      if (!res.ok) {
        setToast({ type: 'error', message: data.error || 'Failed to restore record.' });
        return;
      }

      setToast({ type: 'success', message: data.message || 'Restored back to Pending Approval.' });
      setRestoreModalOpen(false);
      setRestoringRecord(null);
      await fetchAttendances();
    } catch (err) {
      console.error('Restore error:', err);
      setToast({ type: 'error', message: 'Network error while restoring record.' });
    } finally {
      setProcessing(false);
    }
  };

  // Save Manual Attendance
  const handleSaveManualAttendance = async (e) => {
    e.preventDefault();
    if (!manualForm.employeeId) {
      setToast({ type: 'error', message: 'Please select an employee.' });
      return;
    }

    // Strict Future Date/Time check
    if (isFutureKolkataDateTime(manualForm.markInAt)) {
      setToast({
        type: 'error',
        message: 'Future date or time is not allowed. Please select the current or past date and time.',
      });
      return;
    }
    if (manualForm.markOutAt && isFutureKolkataDateTime(manualForm.markOutAt)) {
      setToast({
        type: 'error',
        message: 'Future date or time is not allowed. Please select the current or past date and time.',
      });
      return;
    }

    setProcessing(true);
    try {
      const res = await fetch('/api/attendance/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(manualForm),
      });

      const data = await res.json();
      if (!res.ok) {
        setToast({ type: 'error', message: data.error || 'Failed to create attendance.' });
        return;
      }

      setToast({ type: 'success', message: data.message || 'Attendance created successfully.' });
      setManualModalOpen(false);
      await fetchAttendances();
    } catch (err) {
      console.error('Manual attendance error:', err);
      setToast({ type: 'error', message: 'Failed to record manual attendance.' });
    } finally {
      setProcessing(false);
    }
  };

  const isMultipleSelected = selectedIds.length > 1;

  // --- Pagination computations ---
  const totalRecords = filteredAttendances.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedRecords = filteredAttendances.slice(
    (safeCurrentPage - 1) * pageSize,
    safeCurrentPage * pageSize
  );

  const kolkataNowLocal = toKolkataDateTimeLocal(new Date());

  return (
    <AppLayout requiredPermission="approval">
      <Toast toast={toast} onClose={() => setToast(null)} />

      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 mb-1.5 border border-blue-100">
              <UserCheck className="w-3.5 h-3.5" />
              <span>Shift Verification & Approvals</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Attendance Approval
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Verify, edit, approve, and restore employee attendance records
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={openManualModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs text-white bg-slate-900 hover:bg-slate-800 shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Manual Attendance</span>
            </button>
            <button
              onClick={fetchAttendances}
              className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              title="Refresh Records"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs, Employee Search, and Mark Date Selector Bar */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3.5">
          {/* Active Tabs: Pending Approvals – Me | Approved Attendance */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-200/60 w-fit shrink-0">
            <button
              onClick={() => setActiveTab('PENDING')}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'PENDING'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pending Approvals – Me
            </button>
            <button
              onClick={() => setActiveTab('APPROVED')}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'APPROVED'
                  ? 'bg-white text-emerald-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Approved Attendance
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Employee Search Input */}
            <div className="relative min-w-[230px] sm:min-w-[270px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search employee (Name, ID, Desig)..."
                className="w-full pl-9.5 pr-8 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-2xl shadow-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden transition-all placeholder:text-slate-400"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer hover:bg-slate-100 transition-colors"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Section 2: Mark Date Selector (Current or Past Date Only) */}
            <div className="flex flex-wrap items-center gap-2 bg-white px-3.5 py-1.5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span>Mark Date:</span>
              </div>
              <input
                type="date"
                value={selectedDate}
                max={currentDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="px-2.5 py-1 text-xs font-semibold text-slate-800 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-slate-50 cursor-pointer"
                title="Select current date or past date (future dates are disabled)"
              />
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleDateChange(currentDate)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    selectedDate === currentDate
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => handleDateChange(getYesterdayDateString())}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    selectedDate === getYesterdayDateString()
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  Yesterday
                </button>
              </div>
              {selectedDate !== currentDate && (
                <span className="text-[11px] font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                  Past Date: {formatKolkataDate(selectedDate)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Multi-Selection Action Bar */}
        {activeTab === 'PENDING' && selectedIds.length > 0 && (
          <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-900">
              <CheckCheck className="w-4 h-4 text-blue-600" />
              <span>
                <strong>{selectedIds.length}</strong> record(s) selected
              </span>
              {isMultipleSelected && (
                <span className="text-[11px] text-blue-600 font-normal italic">
                  (Batch approval mode: editing is disabled for multiple selections)
                </span>
              )}
            </div>
            <button
              onClick={() => setMultiApproveModalOpen(true)}
              className="w-full sm:w-auto px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition-all cursor-pointer"
            >
              Approve Selected ({selectedIds.length})
            </button>
          </div>
        )}

        {/* Attendance Records Table */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[11px] uppercase font-bold text-slate-500 border-b border-slate-100">
                <tr>
                  {activeTab === 'PENDING' && (
                    <th className="py-3 px-4 w-10">
                      <input
                        type="checkbox"
                        checked={eligibleIds.length > 0 && selectedIds.length === eligibleIds.length}
                        onChange={handleToggleSelectAll}
                        disabled={eligibleIds.length === 0}
                        title={eligibleIds.length > 0 ? "Select all eligible for approval" : "No records currently eligible for approval"}
                        className="w-4 h-4 rounded text-blue-600 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                    </th>
                  )}
                  <th className="py-3 px-4">Employee ID</th>
                  <th className="py-3 px-4">Employee Name</th>
                  <th className="py-3 px-4">Designation</th>
                  <th className="py-3 px-4">Mark Date</th>
                  <th className="py-3 px-4">Mark In Plant</th>
                  <th className="py-3 px-4">Mark IN</th>
                  <th className="py-3 px-4">Mark OUT</th>
                  <th className="py-3 px-4">Working Hour</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Mark Out Type</th>
                  <th className="py-3 px-4">Mark Out Plant</th>
                  {activeTab === 'APPROVED' && <th className="py-3 px-4">Approved By</th>}
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td
                      colSpan={activeTab === 'PENDING' ? 13 : 13}
                      className="py-12 text-center text-slate-400 font-medium"
                    >
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                      Loading attendance records for {formatKolkataDate(selectedDate)}...
                    </td>
                  </tr>
                ) : filteredAttendances.length === 0 ? (
                  <tr>
                    <td
                      colSpan={activeTab === 'PENDING' ? 13 : 13}
                      className="py-12 text-center text-slate-400 font-medium"
                    >
                      {searchTerm ? (
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <p className="text-slate-600 text-sm">
                            No employees found matching &ldquo;<span className="text-slate-900 font-bold">{searchTerm}</span>&rdquo;
                          </p>
                          <button
                            type="button"
                            onClick={() => setSearchTerm('')}
                            className="text-xs text-blue-600 hover:text-blue-700 font-semibold cursor-pointer underline"
                          >
                            Clear search filter
                          </button>
                        </div>
                      ) : activeTab === 'PENDING' ? (
                        `No pending attendance approvals found for ${formatKolkataDate(selectedDate)}.`
                      ) : (
                        `No approved attendance records found for ${formatKolkataDate(selectedDate)}.`
                      )}
                    </td>
                  </tr>
                ) : (
                  paginatedRecords.map((record) => {
                    const recId = record.id || record._id;
                    const isSelected = selectedIds.includes(recId);
                    const isActive = record.status === 'ACTIVE' && !record.markOutAt;
                    const isAbsent = record.status === 'ABSENT' || (!record.markInAt && !record.markOutAt);
                    const eligibility = getApprovalEligibility(record);

                    // Compute clean display status
                    const displayStatus = isAbsent
                      ? 'Absent'
                      : record.approvalStatus === 'APPROVED'
                      ? 'Approved'
                      : record.markInAt && !record.markOutAt
                      ? 'Pending'
                      : 'Pending Approval';

                    return (
                      <tr
                        key={recId}
                        className={`hover:bg-slate-50/70 transition-colors ${
                          isSelected ? 'bg-blue-50/40' : ''
                        }`}
                      >
                        {activeTab === 'PENDING' && (
                          <td className="py-3 px-4">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={!eligibility.canApprove}
                              title={eligibility.canApprove ? 'Select for approval' : eligibility.reason}
                              onChange={() => handleToggleSelectRow(recId)}
                              className={`w-4 h-4 rounded text-blue-600 ${
                                eligibility.canApprove ? 'cursor-pointer' : 'cursor-not-allowed opacity-30'
                              }`}
                            />
                          </td>
                        )}
                        <td className="py-3 px-4 font-mono font-bold text-blue-600 whitespace-nowrap">
                          {record.employeeId || '-'}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                          {record.employeeName}
                        </td>
                        <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                          {record.designation || 'Staff'}
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-slate-800 whitespace-nowrap">
                          {formatKolkataDate(record.attendanceDate || selectedDate)}
                        </td>
                        <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                          {record.markInPlantName || record.plantName || (isAbsent ? '-' : 'Plant')}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                          {record.markInAt ? (
                            <span title={formatKolkataDateTime(record.markInAt)}>
                              {formatKolkataTime(record.markInAt)}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-bold">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                          {isActive ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                              -
                            </span>
                          ) : record.markOutAt ? (
                            <span title={formatKolkataDateTime(record.markOutAt)}>
                              {formatKolkataTime(record.markOutAt)}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-bold">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-slate-800 whitespace-nowrap">
                          {isAbsent
                            ? '-'
                            : isActive
                            ? 'Running'
                            : record.workingMinutes > 0
                            ? formatWorkingHours(record.workingMinutes)
                            : '0:00'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              displayStatus === 'Absent'
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : displayStatus === 'Pending'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : displayStatus === 'Approved'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-blue-100 text-blue-800 border border-blue-200'
                            }`}
                          >
                            {displayStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-700 whitespace-nowrap">
                          {isAbsent
                            ? '-'
                            : record.markOutType === 'Auto' || record.autoMarkOut
                            ? 'Auto'
                            : record.markOutType || (record.markOutAt ? 'Self' : '-')}
                        </td>
                        <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                          {isAbsent
                            ? '-'
                            : record.markOutPlantName || record.plantName || '-'}
                        </td>
                        {activeTab === 'APPROVED' && (
                          <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                            {record.approvedBy || 'Admin'}
                          </td>
                        )}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {activeTab === 'PENDING' ? (
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Action Button: Controlled by Rules 1 to 5 */}
                              {eligibility.actionType === 'APPROVE_ABSENT' ? (
                                <button
                                  onClick={() => setAbsentApproveRecord(record)}
                                  className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-xs border border-amber-300 transition-colors cursor-pointer shadow-xs flex items-center gap-1"
                                  title="Rule 3: Past date with no Mark IN/OUT – Click to Approve Absent"
                                >
                                  <span>Approve Absent</span>
                                </button>
                              ) : eligibility.canApprove ? (
                                <button
                                  onClick={() => setSingleApproveRecord(record)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold text-xs transition-colors cursor-pointer border border-emerald-200"
                                >
                                  Approve
                                </button>
                              ) : (
                                <button
                                  disabled
                                  title={eligibility.reason}
                                  className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-400 font-medium text-xs cursor-not-allowed border border-slate-200"
                                >
                                  Approve
                                </button>
                              )}

                              {/* Edit: only allowed when single row and employee has attendance record */}
                              {!isMultipleSelected && !isAbsent && (
                                <button
                                  onClick={() => openEditModal(record)}
                                  className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold text-xs transition-colors cursor-pointer"
                                >
                                  Edit
                                </button>
                              )}
                            </div>
                          ) : (
                            // Restore action on Approved Attendance
                            <button
                              onClick={() => openRestoreModal(record)}
                              className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 font-semibold text-xs transition-colors cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Restore</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ── Pagination Footer ── */}
          {!loading && totalRecords > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 border-t border-slate-100 bg-slate-50/60">
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span>
                  Showing{' '}
                  <span className="font-semibold text-slate-700">
                    {(safeCurrentPage - 1) * pageSize + 1}–{Math.min(safeCurrentPage * pageSize, totalRecords)}
                  </span>{' '}
                  of{' '}
                  <span className="font-semibold text-slate-700">{totalRecords}</span> records
                </span>
                <span className="text-slate-300">|</span>
                <div className="flex items-center gap-1.5">
                  <span>Rows per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="px-2 py-1 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value={15}>15</option>
                    <option value={25}>25</option>
                    <option value={40}>40</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safeCurrentPage === 1}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  ← Prev
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => {
                    return (
                      p === 1 ||
                      p === totalPages ||
                      Math.abs(p - safeCurrentPage) <= 1
                    );
                  })
                  .reduce((acc, p, idx, arr) => {
                    if (idx > 0 && p - arr[idx - 1] > 1) {
                      acc.push('...');
                    }
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((item, idx) =>
                    item === '...' ? (
                      <span key={`ellipsis-${idx}`} className="px-2 text-xs text-slate-400">
                        …
                      </span>
                    ) : (
                      <button
                        key={item}
                        onClick={() => setCurrentPage(item)}
                        className={`min-w-[32px] px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                          item === safeCurrentPage
                            ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                            : 'border border-slate-200 text-slate-600 bg-white hover:bg-slate-100'
                        }`}
                      >
                        {item}
                      </button>
                    )
                  )}

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safeCurrentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal 1: Approve Multiple Confirmation */}
      <Modal
        isOpen={multiApproveModalOpen}
        onClose={() => setMultiApproveModalOpen(false)}
        title="Confirm Approval"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 text-center">
            <CheckCheck className="w-9 h-9 text-blue-600 mx-auto mb-2" />
            <p className="font-bold text-sm">
              Are you sure you want to approve the selected attendance records?
            </p>
            <p className="text-xs text-blue-700 mt-1">
              Total <strong>{selectedIds.length}</strong> record(s) will be marked as Approved and moved to the Approved Attendance tab.
            </p>
          </div>

          <div className="pt-2 flex gap-3">
            <button
              onClick={() => setMultiApproveModalOpen(false)}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-sm transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => handleApprove(selectedIds)}
              disabled={processing}
              className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-600/20 transition-all cursor-pointer"
            >
              {processing ? 'Approving...' : 'Confirm Approval'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal 2: Single Approve Confirmation */}
      <Modal
        isOpen={!!singleApproveRecord}
        onClose={() => setSingleApproveRecord(null)}
        title="Approve Attendance"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-center">
            <CheckCircle className="w-9 h-9 text-emerald-600 mx-auto mb-2" />
            <p className="font-bold text-sm">Approve this attendance record?</p>
            <p className="text-xs text-emerald-700 mt-1 font-mono">
              {singleApproveRecord?.employeeName} ({singleApproveRecord?.employeeId})
            </p>
          </div>

          <div className="pt-2 flex gap-3">
            <button
              onClick={() => setSingleApproveRecord(null)}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-sm transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => handleApprove([singleApproveRecord.id || singleApproveRecord._id])}
              disabled={processing}
              className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
            >
              {processing ? 'Approving...' : 'Confirm Approve'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal 2.5: Approve Absent Confirmation */}
      <Modal
        isOpen={!!absentApproveRecord}
        onClose={() => setAbsentApproveRecord(null)}
        title="Approve Absent Confirmation"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-center">
            <AlertTriangle className="w-10 h-10 text-amber-600 mx-auto mb-2" />
            <p className="font-bold text-base text-slate-900">
              Are you sure you want to approve this employee as Absent?
            </p>
            <div className="mt-3 text-left p-3.5 rounded-xl bg-white border border-amber-200 text-xs space-y-2 text-slate-700 shadow-2xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Employee:</span>
                <span className="font-bold text-slate-900">
                  {absentApproveRecord?.employeeName} {absentApproveRecord?.employeeId ? `(${absentApproveRecord.employeeId})` : ''}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Date:</span>
                <span className="font-mono font-bold text-slate-900">
                  {formatKolkataDate(absentApproveRecord?.attendanceDate || selectedDate)}
                </span>
              </div>
            </div>
            <p className="text-xs text-amber-800 mt-3 font-semibold">
              No Mark IN or Mark OUT was recorded for this date.
            </p>
          </div>

          <div className="pt-2 flex gap-3">
            <button
              onClick={() => setAbsentApproveRecord(null)}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-sm transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                const recToApprove = absentApproveRecord;
                setAbsentApproveRecord(null);
                await handleApprove([recToApprove.id || recToApprove._id]);
              }}
              disabled={processing}
              className="flex-1 py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm shadow-md shadow-amber-600/20 transition-all cursor-pointer"
            >
              {processing ? 'Approving...' : 'Confirm Approve Absent'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal 3: Edit Attendance Popup */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit Attendance Record"
      >
        {editingRecord && (
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Employee ID:</span>
                <span className="font-mono font-bold text-blue-600">{editingRecord.employeeId}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Employee Name:</span>
                <span className="font-bold text-slate-900">{editingRecord.employeeName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Designation:</span>
                <span className="text-slate-800">{editingRecord.designation || 'Staff'}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mark IN Date Time * (Max: Current Time)
                </label>
                <input
                  type="datetime-local"
                  value={editForm.markInAt}
                  max={kolkataNowLocal}
                  onChange={(e) => {
                    const newIn = e.target.value;
                    const liveH = calculateLiveHours(newIn, editForm.markOutAt);
                    setEditForm({ ...editForm, markInAt: newIn, calculatedHours: liveH });
                  }}
                  required
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mark Out Date Time (Max: Current Time)
                </label>
                <input
                  type="datetime-local"
                  value={editForm.markOutAt}
                  max={kolkataNowLocal}
                  onChange={(e) => {
                    const newOut = e.target.value;
                    const liveH = calculateLiveHours(editForm.markInAt, newOut);
                    setEditForm({ ...editForm, markOutAt: newOut, calculatedHours: liveH });
                  }}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              {/* Automatically calculated Working Hour display */}
              <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-900 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-blue-600" />
                  Working Hour:
                </span>
                <span className="text-sm font-bold font-mono text-blue-700">
                  {editForm.calculatedHours}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Edit Remarks / Reason
                </label>
                <textarea
                  rows={2}
                  value={editForm.remarks}
                  onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })}
                  placeholder="State reason for manual time adjustment..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={processing}
                className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition-all cursor-pointer"
              >
                {processing ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal 4: Restore Approved Attendance Warning Modal */}
      <Modal
        isOpen={restoreModalOpen}
        onClose={() => setRestoreModalOpen(false)}
        title="Restore Attendance"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-center">
            <AlertTriangle className="w-9 h-9 text-amber-600 mx-auto mb-2" />
            <p className="font-bold text-sm">Warning:</p>
            <p className="text-xs text-amber-800 mt-1 font-semibold">
              Are you sure you want to restore this approved attendance?
            </p>
            <p className="text-[11px] text-amber-700 mt-1">
              The attendance will move back to Pending Approval.
            </p>
          </div>

          {restoringRecord && (
            <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1 text-slate-600 border border-slate-100">
              <div>Employee: <strong className="text-slate-900">{restoringRecord.employeeName}</strong></div>
              <div>Date: <strong className="text-slate-900">{restoringRecord.markInAt ? formatKolkataDateTime(restoringRecord.markInAt) : formatKolkataDate(restoringRecord.attendanceDate || selectedDate)}</strong></div>
            </div>
          )}

          <div className="pt-2 flex gap-3">
            <button
              onClick={() => setRestoreModalOpen(false)}
              className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmRestore}
              disabled={processing}
              className="flex-1 py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md shadow-amber-600/20 transition-all cursor-pointer"
            >
              {processing ? 'Restoring...' : 'Confirm Restore'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal 5: Manual Attendance by Admin/User */}
      <Modal
        isOpen={manualModalOpen}
        onClose={() => setManualModalOpen(false)}
        title="Create Manual Attendance"
      >
        <form onSubmit={handleSaveManualAttendance} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Employee *
            </label>
            <select
              value={manualForm.employeeId}
              onChange={(e) => setManualForm({ ...manualForm, employeeId: e.target.value })}
              required
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            >
              <option value="">-- Choose Employee --</option>
              {employeesList.map((emp) => (
                <option key={emp.id || emp._id} value={emp.employeeId || emp.id}>
                  {emp.fullName} ({emp.employeeId}) - {emp.designation}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Plant / Unit (Optional)
            </label>
            <select
              value={manualForm.plantId}
              onChange={(e) => setManualForm({ ...manualForm, plantId: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            >
              <option value="">-- Auto-detect / Default Plant --</option>
              {plantsList.map((p) => (
                <option key={p.id || p._id} value={p.plantId || p.id}>
                  {p.plantName}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mark IN Date Time * (Max: Current Time)
              </label>
              <input
                type="datetime-local"
                value={manualForm.markInAt}
                max={kolkataNowLocal}
                onChange={(e) => {
                  const newIn = e.target.value;
                  const liveH = calculateLiveHours(newIn, manualForm.markOutAt);
                  setManualForm({ ...manualForm, markInAt: newIn, calculatedHours: liveH });
                }}
                required
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mark Out Date Time (Optional, Max: Current Time)
              </label>
              <input
                type="datetime-local"
                value={manualForm.markOutAt}
                max={kolkataNowLocal}
                onChange={(e) => {
                  const newOut = e.target.value;
                  const liveH = calculateLiveHours(manualForm.markInAt, newOut);
                  setManualForm({ ...manualForm, markOutAt: newOut, calculatedHours: liveH });
                }}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          {manualForm.markOutAt && (
            <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-900 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-blue-600" />
                Working Hours:
              </span>
              <span className="text-sm font-bold font-mono text-blue-700">
                {manualForm.calculatedHours}
              </span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Remarks
            </label>
            <input
              type="text"
              value={manualForm.remarks}
              onChange={(e) => setManualForm({ ...manualForm, remarks: e.target.value })}
              placeholder="Reason for manual entry..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={() => setManualModalOpen(false)}
              className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={processing}
              className="flex-1 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              {processing ? 'Saving...' : 'Record Attendance'}
            </button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
