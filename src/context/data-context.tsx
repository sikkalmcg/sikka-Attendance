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
  currentUser: any;
  verifiedUser: any;
  isLoading: boolean;
  refreshData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// Fast local session storage cache helper for instant 0ms load
const getInitialCache = (key: string) => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(`sikka_cache_${key}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
};

const setCache = (key: string, data: any[]) => {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(`sikka_cache_${key}`, JSON.stringify(data));
  } catch {}
};

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

  // 2. Pre-populate state from local cache so UI renders immediately without blank delays
  const [employees, setEmployees] = useState<Employee[]>(() => getInitialCache('employees'));
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() => getInitialCache('attendance'));
  const [vouchers, setVouchers] = useState<Voucher[]>(() => getInitialCache('vouchers'));
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>(() => getInitialCache('payroll'));
  const [plants, setPlants] = useState<Plant[]>(() => getInitialCache('plants'));
  const [firms, setFirms] = useState<Firm[]>(() => getInitialCache('firms'));
  const [users, setUsers] = useState<User[]>(() => getInitialCache('users'));
  const [holidays, setHolidays] = useState<Holiday[]>(() => getInitialCache('holidays'));
  const [notifications, setNotifications] = useState<AppNotification[]>(() => getInitialCache('notifications'));
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(() => getInitialCache('leaveRequests'));
  
  // If cache is already present, don't block the screen with full loading state
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const hasCachedData = sessionStorage.getItem('sikka_cache_attendance') || sessionStorage.getItem('sikka_cache_employees');
    return !hasCachedData;
  });

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
  }, []);

  const isAdminRole = useMemo(() => {
    return currentUser && ['SUPER_ADMIN', 'ADMIN', 'HR'].includes(String(currentUser.role).toUpperCase());
  }, [currentUser?.role]);

  const currentUserId = currentUser?.id || currentUser?.employeeId || currentUser?.username;
  const currentUserRole = currentUser?.role ? String(currentUser.role).toUpperCase() : undefined;

  const fetchData = useCallback(async () => {
    if (!currentUserId) {
      setIsLoading(false);
      return;
    }
    
    try {
      // 1. Single-roundtrip bootstrap API call (10x faster than 9 separate HTTP requests)
      const bootstrapUrl = `/api/data/bootstrap?role=${encodeURIComponent(currentUserRole || 'EMPLOYEE')}&employeeId=${encodeURIComponent(currentUserId || '')}`;
      const res = await fetch(bootstrapUrl, { cache: 'no-store' });

      if (res.ok) {
        const bundle = await res.json();
        if (bundle && typeof bundle === 'object') {
          if (Array.isArray(bundle.employees)) {
            setEmployees(bundle.employees);
            setCache('employees', bundle.employees);
          }
          if (Array.isArray(bundle.attendance)) {
            setAttendanceRecords(bundle.attendance);
            setCache('attendance', bundle.attendance);
          }
          if (Array.isArray(bundle.plants)) {
            setPlants(bundle.plants);
            setCache('plants', bundle.plants);
          }
          if (Array.isArray(bundle.holidays)) {
            setHolidays(bundle.holidays);
            setCache('holidays', bundle.holidays);
          }
          if (Array.isArray(bundle.leaveRequests)) {
            setLeaveRequests(bundle.leaveRequests);
            setCache('leaveRequests', bundle.leaveRequests);
          }
          if (Array.isArray(bundle.notifications)) {
            setNotifications(bundle.notifications);
            setCache('notifications', bundle.notifications);
          }
          if (Array.isArray(bundle.vouchers)) {
            setVouchers(bundle.vouchers);
            setCache('vouchers', bundle.vouchers);
          }
          if (Array.isArray(bundle.firms)) {
            setFirms(bundle.firms);
            setCache('firms', bundle.firms);
          }
          if (Array.isArray(bundle.users)) {
            setUsers(bundle.users);
            setCache('users', bundle.users);
          }
          if (Array.isArray(bundle.payroll)) {
            setPayrollRecords(bundle.payroll);
            setCache('payroll', bundle.payroll);
          }
          setIsLoading(false);
          return;
        }
      }

      // 2. Fallback in case of unexpected bootstrap network error
      let collectionsToFetch: string[] = ['employees', 'attendance', 'plants', 'holidays', 'leaveRequests', 'notifications'];
      if (currentUserRole !== 'EMPLOYEE') {
        collectionsToFetch = ['employees', 'attendance', 'vouchers', 'plants', 'firms', 'holidays', 'leaveRequests', 'users', 'notifications', 'payroll'];
      }

      const results = await Promise.all(
        collectionsToFetch.map(col =>
          fetch(`/api/data/${col}`, { cache: 'no-store' })
            .then(res => res.ok ? res.json() : [])
            .catch(() => [])
        )
      );

      const dataMap: Record<string, any[]> = {};
      collectionsToFetch.forEach((col, index) => {
        const parsed = Array.isArray(results[index]) ? results[index] : (results[index]?.data || []);
        dataMap[col] = parsed;
        setCache(col, parsed);
      });

      if (dataMap['employees']) setEmployees(dataMap['employees']);
      if (dataMap['attendance']) setAttendanceRecords(dataMap['attendance']);
      if (dataMap['vouchers']) setVouchers(dataMap['vouchers']);
      if (dataMap['payroll']) setPayrollRecords(dataMap['payroll']);
      if (dataMap['plants']) setPlants(dataMap['plants']);
      if (dataMap['firms']) setFirms(dataMap['firms']);
      if (dataMap['users']) setUsers(dataMap['users']);
      if (dataMap['holidays']) setHolidays(dataMap['holidays']);
      if (dataMap['leaveRequests']) setLeaveRequests(dataMap['leaveRequests']);
      if (dataMap['notifications']) setNotifications(dataMap['notifications']);
    } catch (error) {
      console.error("Failed to fetch data efficiently:", error);
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId, currentUserRole]);

  useEffect(() => {
    fetchData();
  }, [currentUserId, fetchData]);

  // Real-time live synchronization for notifications
  useEffect(() => {
    if (!currentUserId) return;

    const syncNotifications = async () => {
      try {
        const res = await fetch('/api/data/notifications', { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          const list = Array.isArray(json) ? json : (json?.data || []);
          setNotifications(list);
          setCache('notifications', list);
        }
      } catch (err) {
        console.debug("Notification sync error:", err);
      }
    };

    // Polling interval every 15 seconds
    const interval = setInterval(syncNotifications, 15000);

    // Sync on tab focus / visibility change
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncNotifications();
      }
    };
    const onFocus = () => syncNotifications();

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
    };
  }, [currentUserId, currentUserRole]);

  const verifiedUser = useMemo(() => {
    if (!currentUser) return null;

    const userRole = String(currentUser.role || '').toUpperCase();
    if (userRole === 'EMPLOYEE') {
      const loginIdent = String(currentUser.username || currentUser.employeeId || '').replace(/\s/g, '').toUpperCase();
      const dbEmp = (employees || []).find(e => {
        const empId = String(e.employeeId || e.id || (e as any)._id || '').replace(/\s/g, '').toUpperCase();
        const empAadhaar = String((e as any).aadhaarNumber || e.aadhaar || '').replace(/\s/g, '');
        const empMobile = String((e as any).mobileNumber || e.mobile || '').replace(/\s/g, '');
        return empId === loginIdent || empAadhaar === loginIdent || empMobile === loginIdent;
      });
      const fullName = dbEmp 
        ? (dbEmp.firstName ? `${dbEmp.firstName} ${dbEmp.lastName || ''}`.trim() : (dbEmp.name || (dbEmp as any).fullName || "Employee")) 
        : (currentUser.fullName || "Employee");
      return dbEmp 
        ? { ...currentUser, ...dbEmp, fullName, avatar: dbEmp.avatar || currentUser.avatar, employeeId: dbEmp.employeeId || currentUser.employeeId } 
        : currentUser;
    }

    // HR aur Management users ke validation parameters ko filter out karein
    if (currentUser.role !== 'SUPER_ADMIN') {
      const dbUser = (users || []).find(u => u.id === currentUser.id || u.username === currentUser.username);
      return dbUser ? { ...currentUser, ...dbUser } : currentUser;
    }

    return currentUser;
  }, [currentUser, employees, users]);

  const addRecord = async (col: string, data: any, skipRefresh = false) => {
    const tempId = data.id || `temp-${Date.now()}`;
    const newRecord = { ...data, id: tempId, _id: tempId, createdAt: new Date().toISOString() };

    // Optimistic UI update for attendance, leave requests, and notifications
    if (col === 'attendance') {
      setAttendanceRecords(prev => {
        const filtered = prev.filter(r => !(r.employeeId === newRecord.employeeId && r.date === newRecord.date));
        const updated = [newRecord, ...filtered];
        setCache('attendance', updated);
        return updated;
      });
    } else if (col === 'leaveRequests') {
      setLeaveRequests(prev => {
        const updated = [newRecord, ...prev];
        setCache('leaveRequests', updated);
        return updated;
      });
    } else if (col === 'notifications') {
      setNotifications(prev => {
        const updated = [newRecord, ...prev];
        setCache('notifications', updated);
        return updated;
      });
    }

    try {
      const res = await fetch(`/api/data/${col}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRecord)
      });
      if (res.ok) {
        const resData = await res.json();
        if (resData?.id && col === 'attendance') {
          setAttendanceRecords(prev => prev.map(r => (r.id === tempId ? { ...r, id: resData.id, _id: resData.id } : r)));
        } else if (resData?.id && col === 'notifications') {
          setNotifications(prev => prev.map(n => (n.id === tempId ? { ...n, id: resData.id, _id: resData.id } : n)));
        }
      } else {
        console.warn(`Failed to append record in ${col}. Status: ${res.status}`);
      }
      if (!skipRefresh) await fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const updateRecord = async (col: string, id: string, data: any, skipRefresh = false) => {
    // Optimistic UI update for attendance and notifications
    if (col === 'attendance') {
      setAttendanceRecords(prev => {
        const updated = prev.map(r => {
          const rId = String(r.id || (r as any)._id || '');
          const targetId = String(id || '');
          if (rId === targetId) {
            return { ...r, ...data, updatedAt: new Date().toISOString() };
          }
          return r;
        });
        setCache('attendance', updated);
        return updated;
      });
    } else if (col === 'notifications') {
      setNotifications(prev => {
        const updated = prev.map(n => {
          const nId = String(n.id || (n as any)._id || '');
          const targetId = String(id || '');
          if (nId === targetId) {
            return { ...n, ...data };
          }
          return n;
        });
        setCache('notifications', updated);
        return updated;
      });
    }

    try {
      await fetch(`/api/data/${col}?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, updatedAt: new Date().toISOString() })
      });
      if (!skipRefresh) await fetchData();
    } catch (e) {
      console.error(e);
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
      setNotifications(prev => {
        const updated = prev.filter(n => {
          const nId = String(n.id || (n as any)._id || '');
          return nId !== String(id);
        });
        setCache('notifications', updated);
        return updated;
      });
    }
    try {
      await fetch(`/api/data/${col}?id=${id}`, { method: 'DELETE' });
      if (!skipRefresh) await fetchData();
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
      if (!skipRefresh) await fetchData();
    } catch (e) {
      console.error(e);
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