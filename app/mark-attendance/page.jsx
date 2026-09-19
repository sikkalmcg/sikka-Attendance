'use client';

import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import Modal from '@/components/common/Modal';
import Toast from '@/components/common/Toast';
import {
  Fingerprint,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Building2,
  RefreshCw,
  LogOut,
  Briefcase,
  Home,
  Compass,
} from 'lucide-react';
import { formatKolkataDate, formatKolkataTime, formatKolkataDateTime, formatWorkingHours } from '@/lib/timezone';

export default function MarkAttendancePage() {
  const [activeShift, setActiveShift] = useState(null);
  const [todaySession, setTodaySession] = useState(null);
  const [employeeInfo, setEmployeeInfo] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [pagination, setPagination] = useState({
    totalDays: 60,
    page: 1,
    limit: 10,
    totalPages: 6,
    hasPrev: false,
    hasNext: true,
  });
  const [historyLoading, setHistoryLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [processStep, setProcessStep] = useState('');
  const [toast, setToast] = useState(null);

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    type: 'IN', // 'IN' | 'OUT'
    isInsidePlant: false,
    plantName: '',
    locationType: 'PLANT', // 'PLANT' | 'WORK_FROM_HOME' | 'FIELD_WORK'
    distance: 0,
    allowedRadius: 0,
    coords: null,
  });

  // Outside Plant Work Location Selection Modal (Section 2 & 3)
  const [outsideSelectModal, setOutsideSelectModal] = useState({
    isOpen: false,
    coords: null,
    selectedWorkType: '', // 'WORK_FROM_HOME' | 'FIELD_WORK'
  });

  // Live GPS status bar (auto-detected, not simulated)
  const [liveGpsStatus, setLiveGpsStatus] = useState(null);
  // null = not checked yet | { inside: bool, plantName: string|null, checking: bool, error: string|null }

  // Next Mark IN eligibility (from active-session API)
  const [canMarkIn, setCanMarkIn] = useState(true);
  const [canMarkOut, setCanMarkOut] = useState(false);
  const [blockReason, setBlockReason] = useState(null);
  const [nextMarkInAfter, setNextMarkInAfter] = useState(null);

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

  const fetchShiftStatus = async () => {
    try {
      const res = await fetch('/api/attendance/active-session');
      if (res.ok) {
        const data = await safeParseJson(res);
        if (!data) return;
        setActiveShift(data.activeSession);
        setTodaySession(data.todaySession);
        if (data.employee) {
          setEmployeeInfo({
            employeeId: data.employee.employeeId || '',
            fullName: data.employee.fullName || '',
          });
        }
        // Next Mark IN eligibility from backend
        setCanMarkIn(data.canMarkIn !== false);
        setCanMarkOut(data.canMarkOut === true);
        setBlockReason(data.blockReason || null);
        setNextMarkInAfter(data.nextMarkInAfter || null);
      }
    } catch (err) {
      console.error('Failed to fetch shift status:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async (pageToFetch = 1) => {
    try {
      setHistoryLoading(true);
      const res = await fetch(`/api/attendance/history?page=${pageToFetch}&limit=10`);
      if (res.ok) {
        const data = await safeParseJson(res);
        if (!data) return;
        setHistory(data.history || []);
        if (data.pagination) {
          setPagination(data.pagination);
          setHistoryPage(data.pagination.page);
        }
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem('attendance_token');
      localStorage.removeItem('attendance_user');
    } catch {}
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error(e);
    }
    window.location.href = '/login';
  };


  useEffect(() => {
    try {
      const stored = localStorage.getItem('attendance_user');
      if (stored) {
        const u = JSON.parse(stored);
        const empId = u.employeeId || u.empId || u.id || u.username || '';
        const name = u.fullName || u.name || (u.firstName ? `${u.firstName} ${u.lastName || ''}`.trim() : u.username || '');
        if (empId || name) {
          setEmployeeInfo({ employeeId: empId, fullName: name });
        }
      }
    } catch {}
    fetchShiftStatus();
    fetchHistory(1);
    checkLiveLocation();
  }, []);

  /**
   * Auto-check real device location against plant geofences for the live status bar.
   */
  const checkLiveLocation = async () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLiveGpsStatus({ inside: false, plantName: null, checking: false, error: 'GPS not supported' });
      return;
    }
    setLiveGpsStatus({ inside: false, plantName: null, checking: true, error: null });
    try {
      const pos = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 30000,
        })
      );
      const { latitude, longitude } = pos.coords;
      const res = await fetch('/api/attendance/check-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude, longitude }),
      });
      if (res.ok) {
        const data = (await safeParseJson(res)) || {};
        setLiveGpsStatus({
          inside: !!data.matched,
          plantName: data.matched ? (data.plant?.name || 'Authorized Plant') : null,
          checking: false,
          error: null,
        });
      } else {
        setLiveGpsStatus({ inside: false, plantName: null, checking: false, error: 'Location check failed' });
      }
    } catch (err) {
      const msg =
        err.code === 1 ? 'Location permission denied' :
        err.code === 2 ? 'GPS unavailable' :
        err.code === 3 ? 'Location timeout' : 'GPS error';
      setLiveGpsStatus({ inside: false, plantName: null, checking: false, error: msg });
    }
  };



  /**
   * Request device location only once upon clicking Mark IN / Mark OUT.
   */
  const captureDeviceLocationOnce = () => {
    return new Promise((resolve, reject) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return reject(new Error("You aren't connected with internet. Please connect your device with internet"));
      }

      if (!navigator.geolocation) {
        return reject(new Error('Geolocation is not supported by your browser or device.'));
      }

      const options = {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      };

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        },
        (err) => {
          let msg = 'Unable to determine your device location.';
          if (err.code === 1) msg = 'Location access was denied. Please allow location permissions in your browser.';
          if (err.code === 2) msg = 'Location unavailable. Please verify GPS is enabled on your device.';
          if (err.code === 3) msg = 'Location request timed out. Please try again.';
          reject(new Error(msg));
        },
        options
      );
    });
  };

  /**
   * Initiate Mark IN / Mark OUT flow
   */
  const handleInitiateAttendance = async (type) => {
    if (processing) return;
    setProcessing(true);
    setProcessStep('Verifying location...');

    try {
      const coords = await captureDeviceLocationOnce();

      setProcessStep('Checking plant proximity...');
      const checkRes = await fetch('/api/attendance/check-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: coords.latitude,
          longitude: coords.longitude,
        }),
      });

      const checkData = (await safeParseJson(checkRes)) || {};

      if (type === 'IN') {
        if (checkData.matched) {
          // Employee Inside Plant Radius -> Confirm Mark IN
          setConfirmModal({
            isOpen: true,
            type: 'IN',
            isInsidePlant: true,
            plantName: checkData.plant?.name || 'Authorized Plant',
            locationType: 'PLANT',
            distance: checkData.distance,
            allowedRadius: checkData.allowedRadius,
            coords,
          });
        } else {
          // Employee Outside Plant Radius -> Open Work Location selection (WFH / Field Work)
          setOutsideSelectModal({
            isOpen: true,
            coords,
            selectedWorkType: '',
          });
        }
      } else {
        // Mark OUT: Inside or Outside
        if (checkData.matched) {
          // Inside plant Mark OUT
          setConfirmModal({
            isOpen: true,
            type: 'OUT',
            isInsidePlant: true,
            plantName: checkData.plant?.name || 'Authorized Plant',
            locationType: 'PLANT',
            distance: checkData.distance,
            allowedRadius: checkData.allowedRadius,
            coords,
          });
        } else {
          // Outside plant Mark OUT (Allowed per Requirement 6)
          setConfirmModal({
            isOpen: true,
            type: 'OUT',
            isInsidePlant: false,
            plantName: 'Outside from Plant',
            locationType: 'OUTSIDE_PLANT',
            distance: checkData.distance,
            allowedRadius: checkData.allowedRadius,
            coords,
          });
        }
      }
    } catch (error) {
      console.error('Attendance error:', error);
      setToast({ type: 'error', message: error.message || 'Failed to detect location.' });
    } finally {
      setProcessing(false);
      setProcessStep('');
    }
  };

  /**
   * Handle Outside Plant Selection Confirmation (Work From Home / Field Work)
   */
  const handleProceedOutsideSelection = () => {
    if (!outsideSelectModal.selectedWorkType) {
      setToast({ type: 'error', message: 'Please select either Work From Home or Field Work.' });
      return;
    }

    const isWFH = outsideSelectModal.selectedWorkType === 'WORK_FROM_HOME';
    const locationTitle = isWFH ? 'Work From Home' : 'Field Work';

    setOutsideSelectModal({ ...outsideSelectModal, isOpen: false });

    // Open confirmation modal for WFH / Field Work
    setConfirmModal({
      isOpen: true,
      type: 'IN',
      isInsidePlant: false,
      plantName: locationTitle,
      locationType: outsideSelectModal.selectedWorkType,
      distance: 0,
      allowedRadius: 0,
      coords: outsideSelectModal.coords,
    });
  };

  /**
   * Confirm and save attendance record
   */
  const handleConfirmAttendance = async () => {
    if (!confirmModal.coords) return;
    setProcessing(true);
    setProcessStep('Saving attendance...');

    const endpoint = confirmModal.type === 'IN' ? '/api/attendance/mark-in' : '/api/attendance/mark-out';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: confirmModal.coords.latitude,
          longitude: confirmModal.coords.longitude,
          accuracy: confirmModal.coords.accuracy,
          locationType: confirmModal.locationType,
        }),
      });

      const data = (await safeParseJson(res)) || {};

      if (!res.ok) {
        setToast({ type: 'error', message: data.error || `Attendance submission failed (${res.status}).` });
        setConfirmModal({ ...confirmModal, isOpen: false });
        return;
      }

      setToast({
        type: 'success',
        message: confirmModal.type === 'IN' ? 'Mark IN Successful' : 'Mark OUT Successful',
      });

      setConfirmModal({ ...confirmModal, isOpen: false });
      await fetchShiftStatus();
      await fetchHistory();
    } catch (err) {
      console.error('Submission error:', err);
      setToast({ type: 'error', message: 'Failed to record attendance. Please try again.' });
    } finally {
      setProcessing(false);
      setProcessStep('');
    }
  };

  const currentDateFormatted = formatKolkataDate(new Date());
  const currentTimeFormatted = formatKolkataTime(new Date());

  return (
    <AppLayout employeeOnly={true}>
      <Toast toast={toast} onClose={() => setToast(null)} />

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Main Action Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm text-center relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500" />

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 mb-3">
            <Building2 className="w-3.5 h-3.5 text-blue-600" />
            <span>Attendance Portal</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            MARK ATTENDANCE
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Tap below to record your official work shift
          </p>

          {/* Employee Details Header & Info */}
          <div className="mt-5 mb-2 p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl max-w-sm mx-auto text-center shadow-2xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Employee Details
            </span>
            <span className="text-sm sm:text-base font-extrabold text-slate-900 font-mono tracking-tight">
              {employeeInfo?.employeeId && employeeInfo?.fullName
                ? `${employeeInfo.employeeId} / ${employeeInfo.fullName}`
                : employeeInfo?.fullName || employeeInfo?.employeeId || '---'}
            </span>
          </div>

          {/* Current Shift Status Badge */}
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-50 border border-slate-200/70 shadow-2xs">
            <span
              className={`w-3 h-3 rounded-full ${
                activeShift ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
              }`}
            />
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              {activeShift ? 'Active Shift in Progress' : 'Off Shift / Ready to Mark In'}
            </span>
          </div>

          {/* If on active shift, show details */}
          {activeShift && (
            <div className="mt-4 p-4 rounded-2xl bg-blue-50/60 border border-blue-100 text-left space-y-2 text-xs">
              <div className="flex justify-between items-center text-blue-900 font-semibold">
                <span>Location / Plant:</span>
                <span className="font-bold">{activeShift.plantName || activeShift.markInPlantName}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Mark In Time:</span>
                <span className="font-mono font-bold text-slate-900">
                  {formatKolkataTime(activeShift.markInAt)}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Date:</span>
                <span>{formatKolkataDate(activeShift.markInAt)}</span>
              </div>
            </div>
          )}

          {/* Primary Action Button */}
          <div className="mt-8 space-y-3">
            {/* Mark IN or Mark OUT based on backend eligibility */}
            {canMarkOut || activeShift ? (
              // Show MARK OUT button
              <button
                onClick={() => handleInitiateAttendance('OUT')}
                disabled={processing}
                className="w-full py-5 px-6 rounded-2xl font-bold text-lg text-white bg-rose-600 hover:bg-rose-700 active:scale-[0.98] disabled:opacity-60 transition-all shadow-xl shadow-rose-600/30 flex items-center justify-center gap-3 cursor-pointer"
              >
                {processing ? (
                  <>
                    <RefreshCw className="w-6 h-6 animate-spin" />
                    <span>{processStep || 'Processing...'}</span>
                  </>
                ) : (
                  <>
                    <LogOut className="w-7 h-7" />
                    <span>MARK OUT</span>
                  </>
                )}
              </button>
            ) : canMarkIn ? (
              // Show MARK IN button (enabled)
              <button
                onClick={() => handleInitiateAttendance('IN')}
                disabled={processing}
                className="w-full py-5 px-6 rounded-2xl font-bold text-lg text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60 transition-all shadow-xl shadow-blue-600/30 flex items-center justify-center gap-3 cursor-pointer"
              >
                {processing ? (
                  <>
                    <RefreshCw className="w-6 h-6 animate-spin" />
                    <span>{processStep || 'Processing...'}</span>
                  </>
                ) : (
                  <>
                    <Fingerprint className="w-7 h-7" />
                    <span>MARK IN</span>
                  </>
                )}
              </button>
            ) : (
              // Show MARK IN button (disabled — same-day block)
              <div className="space-y-2">
                <button
                  disabled
                  className="w-full py-5 px-6 rounded-2xl font-bold text-lg text-white bg-slate-400 opacity-70 transition-all flex items-center justify-center gap-3 cursor-not-allowed"
                >
                  <Fingerprint className="w-7 h-7" />
                  <span>MARK IN</span>
                </button>
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 font-medium flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                  <div>
                    <p>{blockReason || 'Mark IN is not available right now.'}</p>
                    {nextMarkInAfter && (
                      <p className="mt-1 font-semibold">
                        Next Mark IN available from:{' '}
                        <span className="font-mono">{formatKolkataDateTime(nextMarkInAfter)}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <p className="text-[11px] text-slate-400 font-medium">
              ⚡ Location is requested only upon clicking Mark IN or Mark OUT.
            </p>
          </div>
        </div>

        {/* Live GPS Location Status Bar */}
        <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 text-xs text-slate-600 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-slate-500" />
            <span>
              GPS Status:{' '}
              <strong>
                {liveGpsStatus?.checking
                  ? 'Detecting location...'
                  : liveGpsStatus?.error
                  ? liveGpsStatus.error
                  : liveGpsStatus?.inside
                  ? `Inside Plant — ${liveGpsStatus.plantName}`
                  : liveGpsStatus
                  ? 'Outside Plant'
                  : 'Not checked yet'}
              </strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Live status badge */}
            {liveGpsStatus?.checking ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-200 text-slate-600">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Checking...
              </span>
            ) : liveGpsStatus?.error ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                <AlertTriangle className="w-3 h-3" />
                {liveGpsStatus.error}
              </span>
            ) : liveGpsStatus?.inside ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                <CheckCircle2 className="w-3 h-3" />
                Inside Plant
              </span>
            ) : liveGpsStatus ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
                <MapPin className="w-3 h-3" />
                Outside Plant
              </span>
            ) : null}

            {/* Refresh live status */}
            <button
              onClick={checkLiveLocation}
              disabled={liveGpsStatus?.checking}
              className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Section 4 & 5: Attendance History – 60 Calendar Days */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-4 border-b border-slate-100 gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                Attendance History
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Last 60 Calendar Days (Today & Previous 59 Days)
              </p>
            </div>
            <button
              onClick={() => fetchHistory(historyPage)}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-medium cursor-pointer self-start sm:self-auto"
            >
              <RefreshCw className={`w-3 h-3 ${historyLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[11px] uppercase font-bold text-slate-500 border-y border-slate-100">
                <tr>
                  <th className="py-2.5 px-3">Employee Details</th>
                  <th className="py-2.5 px-3">Attendance Date</th>
                  <th className="py-2.5 px-3">Mark In Date & Time</th>
                  <th className="py-2.5 px-3">Mark Out Date & Time</th>
                  <th className="py-2.5 px-3">Working Hours</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Mark In Plant</th>
                  <th className="py-2.5 px-3">Mark Out Plant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historyLoading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 font-medium">
                      <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2 text-blue-600" />
                      Loading 60-day attendance history...
                    </td>
                  </tr>
                ) : history.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No attendance history found.
                    </td>
                  </tr>
                ) : (
                  history.map((record) => {
                    const isAbsent = record.status === 'Absent';
                    const markInDisplay = record.markInDateTime || record.markInTime || '-';
                    const markOutDisplay = record.markOutDateTime || record.markOutTime || '-';
                    const employeeDetailsDisplay =
                      record.employeeDetails ||
                      (record.employeeName ? `EMP / ${record.employeeName}` : '-');

                    return (
                      <tr key={record.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-3 font-semibold text-slate-800 whitespace-nowrap">
                          {employeeDetailsDisplay}
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-900 whitespace-nowrap">
                          {record.attendanceDate || record.date}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-700 whitespace-nowrap">
                          {markInDisplay}
                        </td>
                        <td className="py-3 px-3 font-mono whitespace-nowrap">
                          {markOutDisplay === 'Active' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 animate-pulse">
                              Active
                            </span>
                          ) : (
                            <span className="text-slate-700">{markOutDisplay}</span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono font-medium text-slate-800 whitespace-nowrap">
                          {record.workingHours || record.workingHour || '-'}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              isAbsent
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {record.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-700 whitespace-nowrap">
                          {record.markInPlant || '-'}
                        </td>
                        <td className="py-3 px-3 text-slate-700 whitespace-nowrap">
                          {record.markOutPlant || '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Section 6 & 7: History Pagination & Page Jump Controls */}
          <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchHistory(historyPage - 1)}
                disabled={!pagination.hasPrev || historyLoading}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed font-semibold transition-colors cursor-pointer"
              >
                Previous
              </button>
              <span className="font-semibold text-slate-800">
                Page {pagination.page || 1} of {pagination.totalPages || 6}
              </span>
              <button
                onClick={() => fetchHistory(historyPage + 1)}
                disabled={!pagination.hasNext || historyLoading}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed font-semibold transition-colors cursor-pointer"
              >
                Next
              </button>
            </div>

            {/* Page Jump Option */}
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">Go to Page:</span>
              <select
                value={historyPage}
                onChange={(e) => {
                  const p = parseInt(e.target.value);
                  fetchHistory(p);
                }}
                disabled={historyLoading}
                className="px-2.5 py-1 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden cursor-pointer"
              >
                {Array.from({ length: pagination.totalPages || 6 }, (_, idx) => idx + 1).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <span className="text-slate-400">of {pagination.totalPages || 6}</span>
            </div>
          </div>
        </div>

        {/* Section 15: Prominent Employee Logout Button */}
        <div className="pt-2 text-center">
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 font-semibold text-xs shadow-2xs transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-rose-500" />
            <span>Logout</span>
          </button>
        </div>
      </div>


      {/* Modal 1: Outside Plant Selection (Section 2 & 3) */}
      <Modal
        isOpen={outsideSelectModal.isOpen}
        onClose={() => setOutsideSelectModal({ ...outsideSelectModal, isOpen: false })}
        title="Select Work Location"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-center">
            <AlertTriangle className="w-8 h-8 text-amber-600 mx-auto mb-2" />
            <p className="font-bold text-sm">
              You are currently outside all authorized plant locations.
            </p>
            <p className="text-xs text-amber-700 mt-1">
              Please select your current working mode to proceed with Mark IN:
            </p>
          </div>

          <div className="space-y-2.5">
            <label
              onClick={() =>
                setOutsideSelectModal({ ...outsideSelectModal, selectedWorkType: 'WORK_FROM_HOME' })
              }
              className={`flex items-center gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                outsideSelectModal.selectedWorkType === 'WORK_FROM_HOME'
                  ? 'border-blue-600 bg-blue-50/70 text-blue-900 shadow-xs'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <input
                type="radio"
                name="workType"
                value="WORK_FROM_HOME"
                checked={outsideSelectModal.selectedWorkType === 'WORK_FROM_HOME'}
                onChange={() =>
                  setOutsideSelectModal({ ...outsideSelectModal, selectedWorkType: 'WORK_FROM_HOME' })
                }
                className="w-4 h-4 text-blue-600"
              />
              <Home className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <div className="flex-1">
                <span className="font-bold text-sm block">Work From Home</span>
                <span className="text-[11px] text-slate-500">Working remotely from registered home location</span>
              </div>
            </label>

            <label
              onClick={() =>
                setOutsideSelectModal({ ...outsideSelectModal, selectedWorkType: 'FIELD_WORK' })
              }
              className={`flex items-center gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                outsideSelectModal.selectedWorkType === 'FIELD_WORK'
                  ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 shadow-xs'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <input
                type="radio"
                name="workType"
                value="FIELD_WORK"
                checked={outsideSelectModal.selectedWorkType === 'FIELD_WORK'}
                onChange={() =>
                  setOutsideSelectModal({ ...outsideSelectModal, selectedWorkType: 'FIELD_WORK' })
                }
                className="w-4 h-4 text-indigo-600"
              />
              <Briefcase className="w-5 h-5 text-indigo-600 flex-shrink-0" />
              <div className="flex-1">
                <span className="font-bold text-sm block">Field Work</span>
                <span className="text-[11px] text-slate-500">On-duty external client visit, transit or field assignment</span>
              </div>
            </label>
          </div>

          <div className="pt-2 flex gap-3">
            <button
              onClick={() => setOutsideSelectModal({ ...outsideSelectModal, isOpen: false })}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-sm transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleProceedOutsideSelection}
              disabled={!outsideSelectModal.selectedWorkType}
              className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm shadow-md shadow-blue-600/20 transition-all cursor-pointer"
            >
              Continue
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal 2: Final Confirmation Modal (Sections 1, 4, 5, 6) */}
      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        title={`Confirm Mark ${confirmModal.type === 'IN' ? 'IN' : 'OUT'}`}
      >
        <div className="space-y-4">
          {confirmModal.type === 'IN' ? (
            confirmModal.isInsidePlant ? (
              // Case 1: Inside Plant Mark IN
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-center">
                <CheckCircle2 className="w-9 h-9 text-emerald-600 mx-auto mb-1.5" />
                <p className="font-bold text-sm">Plant Attendance</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  You are inside the authorized plant radius zone
                </p>
              </div>
            ) : (
              // Case 2: WFH / Field Work Mark IN
              <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 text-center">
                <Building2 className="w-9 h-9 text-blue-600 mx-auto mb-1.5" />
                <p className="font-bold text-sm">
                  {confirmModal.locationType === 'WORK_FROM_HOME' ? 'Work From Home' : 'Field Work'}
                </p>
                <p className="text-xs text-blue-700 mt-0.5">
                  Attendance recorded outside plant location
                </p>
              </div>
            )
          ) : (
            // Mark OUT Cases
            confirmModal.isInsidePlant ? (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-center">
                <LogOut className="w-9 h-9 text-emerald-600 mx-auto mb-1.5" />
                <p className="font-bold text-sm">Plant Mark OUT</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Detected Plant: {confirmModal.plantName}
                </p>
              </div>
            ) : (
              // Outside from Plant Mark OUT (Section 6)
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-center">
                <AlertTriangle className="w-9 h-9 text-amber-600 mx-auto mb-1.5" />
                <p className="font-bold text-sm">
                  You are currently outside the plant location.
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Mark Out From: <strong>Outside from Plant</strong>
                </p>
              </div>
            )
          )}

          <div className="bg-slate-50 rounded-2xl p-4 space-y-2.5 text-xs text-slate-700 border border-slate-100">
            {confirmModal.type === 'IN' ? (
              confirmModal.isInsidePlant ? (
                <div className="flex justify-between items-center">
                  <span className="font-medium text-slate-500">Plant:</span>
                  <span className="font-bold text-slate-900">{confirmModal.plantName}</span>
                </div>
              ) : (
                <div className="flex justify-between items-center">
                  <span className="font-medium text-slate-500">Work Location:</span>
                  <span className="font-bold text-blue-700">
                    {confirmModal.locationType === 'WORK_FROM_HOME' ? 'Work From Home' : 'Field Work'}
                  </span>
                </div>
              )
            ) : (
              <div className="flex justify-between items-center">
                <span className="font-medium text-slate-500">Mark Out From:</span>
                <span className="font-bold text-slate-900">{confirmModal.plantName}</span>
              </div>
            )}

            <div className="flex justify-between items-center">
              <span className="font-medium text-slate-500">Date:</span>
              <span className="font-mono font-semibold">{currentDateFormatted}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium text-slate-500">Time:</span>
              <span className="font-mono font-semibold">{currentTimeFormatted}</span>
            </div>
          </div>

          <p className="text-center text-xs font-semibold text-slate-700">
            Confirm Mark {confirmModal.type === 'IN' ? 'IN' : 'OUT'}?
          </p>

          <div className="pt-2 flex gap-3">
            <button
              onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-sm transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmAttendance}
              disabled={processing}
              className={`flex-1 py-3 px-4 rounded-xl text-white font-bold text-sm shadow-md transition-all cursor-pointer ${
                confirmModal.type === 'IN'
                  ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
                  : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
              }`}
            >
              {processing
                ? 'Saving...'
                : `Confirm Mark ${confirmModal.type === 'IN' ? 'IN' : 'Out'}`}
            </button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  );
}
