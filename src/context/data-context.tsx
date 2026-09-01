"use client";

import React, { createContext, useContext, useMemo, useState, useEffect, useCallback } from 'react';
import { 
  Employee, 
  AttendanceRecord, 
  Voucher, 
  Plant, 
  PayrollRecord, 
  Firm, 
  User, 
  Holiday, 
  AppNotification,
  LeaveRequest
} from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import Cookies from 'js-cookie';
import { autoSubscribeIfPermitted } from '@/lib/notification-client';

interface DataContextType {
  employees: Employee[];
  attendanceRecords: AttendanceRecord[];
  vouchers: Voucher[];
  payrollRecords: PayrollRecord[];
  plants: Plant[];
  firms: Firm[];
  users: User[];
  holidays: Holiday[];
  notifications: AppNotification[];
  leaveRequests: LeaveRequest[];
  addRecord: (col: string, data: any, skipRefresh?: boolean) => Promise<void>;
  updateRecord: (col: string, id: string, data: any, skipRefresh?: boolean) => Promise<void>;
  deleteRecord: (col: string, id: string, skipRefresh?: boolean) => Promise<void>;
  setRecord: (col: string, id: string, data: any, skipRefresh?: boolean) => Promise<void>;
  clearAllNotifications: (empId?: string, isGlobal?: boolean) => Promise<void>;
  currentUser: any;
  verifiedUser: any;
  isLoading: boolean;
  refreshData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();

  // 1. Synchronously resolve current session from Cookies / localStorage on mount
  const [currentUser, setCurrentUser] = useState<any>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const sessionCookie = Cookies.get('sikka_session');
      if (sessionCookie) return JSON.parse(sessionCookie);
      const local = localStorage.getItem('user');
      if (local) return JSON.parse(local);
    } catch {}
    return null;
  });

  // Helper to read local bundle cache for instant 0ms startup
  const getInitialCache = () => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem('sikka_data_bundle');
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  };

  const initialCache = useMemo(() => getInitialCache(), []);

  const [employees, setEmployees] = useState<Employee[]>(() => initialCache?.employees || []);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() => initialCache?.attendance || []);
  const [vouchers, setVouchers] = useState<Voucher[]>(() => initialCache?.vouchers || []);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>(() => initialCache?.payroll || []);
  const [plants, setPlants] = useState<Plant[]>(() => initialCache?.plants || []);
  const [firms, setFirms] = useState<Firm[]>(() => initialCache?.firms || []);
  const [users, setUsers] = useState<User[]>(() => initialCache?.users || []);
  const [holidays, setHolidays] = useState<Holiday[]>(() => initialCache?.holidays || []);
  const [notifications, setNotifications] = useState<AppNotification[]>(() => initialCache?.notifications || []);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(() => initialCache?.leaveRequests || []);
  const [isLoading, setIsLoading] = useState<boolean>(() => !initialCache);

  useEffect(() => {
    let sessionUser = null;
    const sessionCookie = Cookies.get('sikka_session');
    if (sessionCookie) {
      try {
        sessionUser = JSON.parse(sessionCookie);
      } catch (e) {
        console.error("Session parse error", e);
      }
    }
    if (!sessionUser && typeof window !== 'undefined') {
      const local = localStorage.getItem('user');
      if (local) {
        try {
          sessionUser = JSON.parse(local);
          Cookies.set('sikka_session', local, { expires: 365, path: '/' });
        } catch (e) {}
      }
    }
    if (sessionUser) {
      setCurrentUser(sessionUser);
    }

    // Instant 0ms client-side cache hydration
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('sikka_data_bundle');
        if (raw) {
          const cached = JSON.parse(raw);
          if (cached && typeof cached === 'object') {
            if (Array.isArray(cached.employees) && cached.employees.length > 0) setEmployees(cached.employees);
            if (Array.isArray(cached.attendance) && cached.attendance.length > 0) setAttendanceRecords(cached.attendance);
            if (Array.isArray(cached.plants) && cached.plants.length > 0) setPlants(cached.plants);
            if (Array.isArray(cached.holidays) && cached.holidays.length > 0) setHolidays(cached.holidays);
            if (Array.isArray(cached.leaveRequests) && cached.leaveRequests.length > 0) setLeaveRequests(cached.leaveRequests);
            if (Array.isArray(cached.notifications)) setNotifications(cached.notifications);
            if (Array.isArray(cached.vouchers) && cached.vouchers.length > 0) setVouchers(cached.vouchers);
            if (Array.isArray(cached.firms) && cached.firms.length > 0) setFirms(cached.firms);
            if (Array.isArray(cached.users) && cached.users.length > 0) setUsers(cached.users);
            if (Array.isArray(cached.payroll) && cached.payroll.length > 0) setPayrollRecords(cached.payroll);
            setIsLoading(false);
          }
        }
      } catch {}
    }
  }, []);

  const isAdminRole = useMemo(() => {
    return currentUser && ['SUPER_ADMIN', 'ADMIN', 'HR'].includes(String(currentUser.role).toUpperCase());
  }, [currentUser?.role]);

  const currentUserId = currentUser?.id || currentUser?.employeeId || currentUser?.username;
  const currentUserRole = currentUser?.role ? String(currentUser.role).toUpperCase() : undefined;

  const isFetchingRef = React.useRef(false);
  const lastFetchTimeRef = React.useRef(0);
  const debounceTimerRef = React.useRef<any>(null);

  const fetchData = useCallback(async (isManualRefresh = false) => {
    // If a fetch is already in progress and this is not a force-manual call, avoid duplicate parallel stampede
    if (isFetchingRef.current && !isManualRefresh) {
      return;
    }

    isFetchingRef.current = true;
    try {
      // 1. Single-roundtrip bootstrap API call (fetches all MongoDB tables in parallel)
      const role = currentUser?.role ? String(currentUser.role).toUpperCase() : '';
      const empId = currentUser?.employeeId || currentUser?.username || currentUser?.id || '';
      const queryParams = new URLSearchParams();
      if (isManualRefresh) queryParams.set('refresh', 'true');
      if (role) queryParams.set('role', role);
      if (empId) queryParams.set('empId', empId);

      const url = `/api/data/bootstrap?${queryParams.toString()}`;
      const res = await fetch(url, { 
        cache: 'no-store',
        headers: {
          'x-user-role': role,
          'x-employee-id': empId
        }
      });

      if (res.ok) {
        const bundle = await res.json();
        if (bundle && typeof bundle === 'object') {
          // SAFE MERGE: Only replace collection if incoming bundle is a valid array
          // If previous state had data and returned array is empty, retain existing state unless initial load
          if (Array.isArray(bundle.employees)) {
            setEmployees(prev => (bundle.employees.length > 0 || prev.length === 0 ? bundle.employees : prev));
          }
          if (Array.isArray(bundle.attendance)) {
            setAttendanceRecords(prev => (bundle.attendance.length > 0 || prev.length === 0 ? bundle.attendance : prev));
          }
          if (Array.isArray(bundle.plants)) {
            setPlants(prev => (bundle.plants.length > 0 || prev.length === 0 ? bundle.plants : prev));
          }
          if (Array.isArray(bundle.holidays)) {
            setHolidays(prev => (bundle.holidays.length > 0 || prev.length === 0 ? bundle.holidays : prev));
          }
          if (Array.isArray(bundle.leaveRequests)) {
            setLeaveRequests(prev => (bundle.leaveRequests.length > 0 || prev.length === 0 ? bundle.leaveRequests : prev));
          }
          if (Array.isArray(bundle.notifications)) {
            setNotifications(bundle.notifications);
          }
          if (Array.isArray(bundle.vouchers)) {
            setVouchers(prev => (bundle.vouchers.length > 0 || prev.length === 0 ? bundle.vouchers : prev));
          }
          if (Array.isArray(bundle.firms)) {
            setFirms(prev => (bundle.firms.length > 0 || prev.length === 0 ? bundle.firms : prev));
          }
          if (Array.isArray(bundle.users)) {
            setUsers(prev => (bundle.users.length > 0 || prev.length === 0 ? bundle.users : prev));
          }
          if (Array.isArray(bundle.payroll)) {
            setPayrollRecords(prev => (bundle.payroll.length > 0 || prev.length === 0 ? bundle.payroll : prev));
          }
          setIsLoading(false);
          lastFetchTimeRef.current = Date.now();

          // Save to local cache only if it has valid contents
          if (typeof window !== 'undefined' && Array.isArray(bundle.employees) && bundle.employees.length > 0) {
            try {
              localStorage.setItem('sikka_data_bundle', JSON.stringify(bundle));
            } catch (storageErr) {
              console.warn('Local bundle cache storage warning:', storageErr);
            }
          }
          return;
        }
      }

      // 2. Direct fallback in case of network variance
      const collectionsToFetch = ['employees', 'attendance', 'plants', 'holidays', 'leaveRequests', 'notifications', 'vouchers', 'firms', 'users', 'payroll'];
      const results = await Promise.all(
        collectionsToFetch.map(col =>
          fetch(`/api/data/${col}`, { cache: 'no-store' })
            .then(r => r.ok ? r.json() : null)
            .catch(() => null)
        )
      );

      const dataMap: Record<string, any[] | null> = {};
      collectionsToFetch.forEach((col, index) => {
        const raw = results[index];
        if (Array.isArray(raw)) {
          dataMap[col] = raw;
        } else if (raw && Array.isArray(raw.data)) {
          dataMap[col] = raw.data;
        } else {
          dataMap[col] = null;
        }
      });

      // SAFE FALLBACK: Only update if the endpoint actually returned non-null array
      if (Array.isArray(dataMap['employees']) && dataMap['employees'].length > 0) setEmployees(dataMap['employees']);
      if (Array.isArray(dataMap['attendance']) && dataMap['attendance'].length > 0) setAttendanceRecords(dataMap['attendance']);
      if (Array.isArray(dataMap['vouchers']) && dataMap['vouchers'].length > 0) setVouchers(dataMap['vouchers']);
      if (Array.isArray(dataMap['payroll']) && dataMap['payroll'].length > 0) setPayrollRecords(dataMap['payroll']);
      if (Array.isArray(dataMap['plants']) && dataMap['plants'].length > 0) setPlants(dataMap['plants']);
      if (Array.isArray(dataMap['firms']) && dataMap['firms'].length > 0) setFirms(dataMap['firms']);
      if (Array.isArray(dataMap['users']) && dataMap['users'].length > 0) setUsers(dataMap['users']);
      if (Array.isArray(dataMap['holidays']) && dataMap['holidays'].length > 0) setHolidays(dataMap['holidays']);
      if (Array.isArray(dataMap['leaveRequests']) && dataMap['leaveRequests'].length > 0) setLeaveRequests(dataMap['leaveRequests']);
      if (Array.isArray(dataMap['notifications'])) setNotifications(dataMap['notifications']);

    } catch (error) {
      console.error("Failed to fetch data efficiently:", error);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [currentUserId, currentUser?.role, currentUser?.employeeId, currentUser?.username, currentUser?.id]);

  useEffect(() => {
    fetchData();
  }, [currentUserId, fetchData]);

  // Silently refresh VAPID push subscription after each successful session load
  useEffect(() => {
    if (!currentUser) return;
    const t = setTimeout(() => {
      autoSubscribeIfPermitted(currentUser).catch(() => {});
    }, 4000);
    return () => clearTimeout(t);
  }, [currentUser]);

  // Real-time live synchronization via Server-Sent Events (SSE) stream + debounced refresher
  useEffect(() => {
    if (!currentUserId || typeof window === 'undefined') return;

    let eventSource: EventSource | null = null;
    let reconnectTimeout: any = null;

    const scheduleDebouncedFetch = () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        fetchData(false);
      }, 1200);
    };

    const connectSSE = () => {
      try {
        eventSource = new EventSource('/api/realtime/stream');

        eventSource.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (!payload || !payload.type) return;

            // Filter out heartbeats & device registration pings from wiping/re-fetching database state
            const IGNORED_TYPES = ['connected', 'device_registered', 'HEARTBEAT', 'keepalive', 'ping'];
            if (IGNORED_TYPES.includes(payload.type)) return;

            // Dispatch event for UI components listening specifically
            window.dispatchEvent(
              new CustomEvent('sikka:realtime-event', { detail: payload })
            );

            // Debounced auto-refresh context collections
            scheduleDebouncedFetch();
          } catch (e) {}
        };

        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          // Reconnect gracefully in 5 seconds
          clearTimeout(reconnectTimeout);
          reconnectTimeout = setTimeout(connectSSE, 5000);
        };
      } catch (err) {
        console.warn('SSE connection attempt skipped:', err);
      }
    };

    connectSSE();

    // Throttled focus & visibility refresh (only if at least 30s have passed since last fetch)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastFetchTimeRef.current > 30000) {
        fetchData(false);
      }
    };
    const onFocus = () => {
      if (Date.now() - lastFetchTimeRef.current > 30000) {
        fetchData(false);
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onFocus);

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      clearTimeout(reconnectTimeout);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
    };
  }, [currentUserId, fetchData]);

  const verifiedUser = useMemo(() => {
    if (!currentUser) return null;

    const userRole = String(currentUser.role || '').toUpperCase();
    if (userRole === 'EMPLOYEE') {
      const loginIdent = String(currentUser.username || currentUser.employeeId || currentUser.id || '').replace(/\s/g, '').toUpperCase();
      const dbEmp = (employees || []).find(e => {
        const empId = String(e.employeeId || '').replace(/\s/g, '').toUpperCase();
        const id = String(e.id || (e as any)._id || '').replace(/\s/g, '').toUpperCase();
        const empAadhaar = String((e as any).aadhaarNumber || e.aadhaar || '').replace(/\s/g, '');
        const empMobile = String((e as any).mobileNumber || e.mobile || '').replace(/\s/g, '');
        const empName = String(e.name || (e as any).fullName || '').replace(/\s/g, '').toUpperCase();
        return empId === loginIdent || id === loginIdent || empAadhaar === loginIdent || empMobile === loginIdent || empName === loginIdent;
      });
      const fullName = dbEmp 
        ? (dbEmp.name || (dbEmp as any).fullName || (dbEmp.firstName ? `${dbEmp.firstName} ${dbEmp.lastName || ''}`.trim() : "Employee")) 
        : (currentUser.fullName || currentUser.name || "Employee");
      return dbEmp 
        ? { ...currentUser, ...dbEmp, fullName, avatar: dbEmp.avatar || currentUser.avatar, employeeId: dbEmp.employeeId || currentUser.employeeId } 
        : currentUser;
    }

    if (currentUser.role !== 'SUPER_ADMIN') {
      const dbUser = (users || []).find(u => u.id === currentUser.id || u.username === currentUser.username);
      return dbUser ? { ...currentUser, ...dbUser } : currentUser;
    }

    return currentUser;
  }, [currentUser, employees, users]);

  const addRecord = async (col: string, data: any, skipRefresh = false) => {
    const newRecord = { ...data, createdAt: data.createdAt || new Date().toISOString() };

    // Instant optimistic UI update
    if (col === 'attendance') {
      setAttendanceRecords(prev => [newRecord, ...prev.filter(r => !(r.employeeId === data.employeeId && r.date === data.date))]);
    } else if (col === 'leaveRequests') {
      setLeaveRequests(prev => [newRecord, ...prev]);
    } else if (col === 'employees') {
      setEmployees(prev => [...prev, newRecord]);
    } else if (col === 'notifications') {
      setNotifications(prev => [newRecord, ...prev]);
    }

    try {
      const res = await fetch(`/api/data/${col}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRecord)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error(`addRecord failed for ${col}:`, errData);
        throw new Error(errData?.error || `Failed to create record in ${col}`);
      }
      if (!skipRefresh) await fetchData(true);
    } catch (e) {
      console.error(`addRecord error in ${col}:`, e);
      throw e;
    }
  };

  const updateRecord = async (col: string, id: string, data: any, skipRefresh = false) => {
    const payload = { ...data, updatedAt: new Date().toISOString() };

    // Instant optimistic UI update
    if (col === 'attendance') {
      setAttendanceRecords(prev => prev.map(r => {
        const rId = String(r.id || (r as any)._id || '');
        if (rId === String(id) || (data.employeeId && data.date && r.employeeId === data.employeeId && r.date === data.date)) {
          return { ...r, ...payload };
        }
        return r;
      }));
    } else if (col === 'leaveRequests') {
      setLeaveRequests(prev => prev.map(l => {
        const lId = String(l.id || (l as any)._id || '');
        return lId === String(id) ? { ...l, ...payload } : l;
      }));
    } else if (col === 'employees') {
      setEmployees(prev => prev.map(e => {
        const eId = String(e.id || (e as any)._id || '');
        return eId === String(id) ? { ...e, ...payload } : e;
      }));
    }

    try {
      const res = await fetch(`/api/data/${col}?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error(`updateRecord failed for ${col} id=${id}:`, errData);
        throw new Error(errData?.error || `Failed to update record in ${col}`);
      }
      if (!skipRefresh) await fetchData(true);
    } catch (e) {
      console.error(`updateRecord error in ${col} id=${id}:`, e);
      throw e;
    }
  };

  const deleteRecord = async (col: string, id: string, skipRefresh = false) => {
    if (col !== 'notifications' && currentUser?.role !== 'SUPER_ADMIN') {
      toast({
        variant: "destructive",
        title: "Permission Denied",
        description: "Only Super Admin accounts are authorized to delete records."
      });
      return;
    }

    if (col === 'notifications') {
      setNotifications(prev => prev.filter(n => String(n.id || (n as any)._id || '') !== String(id)));
    } else if (col === 'attendance') {
      setAttendanceRecords(prev => prev.filter(r => String(r.id || (r as any)._id || '') !== String(id)));
    } else if (col === 'leaveRequests') {
      setLeaveRequests(prev => prev.filter(l => String(l.id || (l as any)._id || '') !== String(id)));
    }
    try {
      await fetch(`/api/data/${col}?id=${id}`, { method: 'DELETE' });
      if (!skipRefresh) await fetchData(true);
    } catch (e) {
      console.error(e);
    }
  };

  const setRecord = async (col: string, id: string, data: any, skipRefresh = false) => {
    try {
      await fetch(`/api/data/${col}?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, id, updatedAt: new Date().toISOString() })
      });
      if (!skipRefresh) await fetchData(true);
    } catch (e) {
      console.error(e);
    }
  };

  const clearAllNotifications = async (empId?: string, isGlobal = false) => {
    // 1. Instant 0ms optimistic UI wipe
    setNotifications([]);

    // 2. Batch clear in MongoDB
    try {
      await fetch('/api/notifications/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: empId || currentUser?.employeeId || currentUser?.username || currentUser?.id,
          role: currentUser?.role,
          clearAllGlobal: isGlobal || ['SUPER_ADMIN', 'ADMIN', 'HR'].includes(String(currentUser?.role || '').toUpperCase())
        })
      });
    } catch (err) {
      console.error('clearAllNotifications error:', err);
    }
  };

  const value = useMemo(() => ({
    employees,
    attendanceRecords,
    vouchers,
    payrollRecords,
    plants,
    firms,
    users,
    holidays,
    notifications,
    leaveRequests,
    addRecord,
    updateRecord,
    deleteRecord,
    setRecord,
    clearAllNotifications,
    currentUser,
    verifiedUser,
    isLoading,
    refreshData: fetchData
  }), [employees, attendanceRecords, vouchers, payrollRecords, plants, firms, users, holidays, notifications, leaveRequests, currentUser, verifiedUser, isLoading, fetchData]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}