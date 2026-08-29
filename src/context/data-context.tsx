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
  }, []);

  const isAdminRole = useMemo(() => {
    return currentUser && ['SUPER_ADMIN', 'ADMIN', 'HR'].includes(String(currentUser.role).toUpperCase());
  }, [currentUser?.role]);

  const currentUserId = currentUser?.id || currentUser?.employeeId || currentUser?.username;
  const currentUserRole = currentUser?.role ? String(currentUser.role).toUpperCase() : undefined;

  const fetchData = useCallback(async (isManualRefresh = false) => {
    if (!currentUserId) {
      setIsLoading(false);
      return;
    }
    
    try {
      // 1. Single-roundtrip bootstrap API call (fetches all MongoDB tables in parallel)
      const url = isManualRefresh ? '/api/data/bootstrap?refresh=true' : '/api/data/bootstrap';
      const res = await fetch(url, { cache: 'no-store' });

      if (res.ok) {
        const bundle = await res.json();
        if (bundle && typeof bundle === 'object') {
          if (Array.isArray(bundle.employees)) setEmployees(bundle.employees);
          if (Array.isArray(bundle.attendance)) setAttendanceRecords(bundle.attendance);
          if (Array.isArray(bundle.plants)) setPlants(bundle.plants);
          if (Array.isArray(bundle.holidays)) setHolidays(bundle.holidays);
          if (Array.isArray(bundle.leaveRequests)) setLeaveRequests(bundle.leaveRequests);
          if (Array.isArray(bundle.notifications)) setNotifications(bundle.notifications);
          if (Array.isArray(bundle.vouchers)) setVouchers(bundle.vouchers);
          if (Array.isArray(bundle.firms)) setFirms(bundle.firms);
          if (Array.isArray(bundle.users)) setUsers(bundle.users);
          if (Array.isArray(bundle.payroll)) setPayrollRecords(bundle.payroll);
          setIsLoading(false);

          // Save to local cache for instant future loads
          if (typeof window !== 'undefined') {
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
            .then(r => r.ok ? r.json() : [])
            .catch(() => [])
        )
      );

      const dataMap: Record<string, any[]> = {};
      collectionsToFetch.forEach((col, index) => {
        dataMap[col] = Array.isArray(results[index]) ? results[index] : (results[index]?.data || []);
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

      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('sikka_data_bundle', JSON.stringify(dataMap));
        } catch (e) {}
      }
    } catch (error) {
      console.error("Failed to fetch data efficiently:", error);
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId]);

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
        }
      } catch (err) {
        console.debug("Notification sync error:", err);
      }
    };

    const interval = setInterval(syncNotifications, 15000);

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
  }, [currentUserId]);

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
    const tempId = data.id || `temp-${Date.now()}`;
    const newRecord = { ...data, id: tempId, _id: tempId, createdAt: new Date().toISOString() };

    // Optimistic UI update
    if (col === 'attendance') {
      setAttendanceRecords(prev => {
        const filtered = prev.filter(r => !(r.employeeId === newRecord.employeeId && r.date === newRecord.date));
        return [newRecord, ...filtered];
      });
    } else if (col === 'leaveRequests') {
      setLeaveRequests(prev => [newRecord, ...prev]);
    } else if (col === 'notifications') {
      setNotifications(prev => [newRecord, ...prev]);
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
      }
      if (!skipRefresh) await fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const updateRecord = async (col: string, id: string, data: any, skipRefresh = false) => {
    if (col === 'attendance') {
      setAttendanceRecords(prev => prev.map(r => {
        const rId = String(r.id || (r as any)._id || '');
        const targetId = String(id || '');
        if (rId === targetId) {
          return { ...r, ...data, updatedAt: new Date().toISOString() };
        }
        return r;
      }));
    } else if (col === 'notifications') {
      setNotifications(prev => prev.map(n => {
        const nId = String(n.id || (n as any)._id || '');
        const targetId = String(id || '');
        if (nId === targetId) {
          return { ...n, ...data };
        }
        return n;
      }));
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
      setNotifications(prev => prev.filter(n => {
        const nId = String(n.id || (n as any)._id || '');
        return nId !== String(id);
      }));
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