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

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [firms, setFirms] = useState<Firm[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
  const currentUserUsername = currentUser?.username;

  const fetchData = useCallback(async () => {
    if (!currentUserId) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      let collectionsToFetch: string[] = [];

      if (currentUserRole === 'EMPLOYEE') {
        collectionsToFetch = ['employees', 'attendance', 'plants', 'holidays', 'leaveRequests', 'notifications'];
      } else {
        // Admin, SUPER_ADMIN aur HR teeno ke liye global core tables load karein
        collectionsToFetch = ['employees', 'attendance', 'vouchers', 'plants', 'firms', 'holidays', 'leaveRequests', 'users', 'notifications'];
        
        // HR aur Admin verification aur logs ke liye payroll inject karein
        if (isAdminRole) {
          if (!collectionsToFetch.includes('payroll')) collectionsToFetch.push('payroll');
        }
      }

      const results = await Promise.all(
        collectionsToFetch.map(col => fetch(`/api/data/${col}`).then(res => res.ok ? res.json() : []))
      );

      const dataMap: Record<string, any[]> = {};
      collectionsToFetch.forEach((col, index) => {
        dataMap[col] = Array.isArray(results[index]) ? results[index] : (results[index]?.data || []);
      });

      // State Context allocation
      if (dataMap['employees']) setEmployees(dataMap['employees']);
      if (dataMap['attendance']) setAttendanceRecords(dataMap['attendance']);
      if (dataMap['vouchers']) setVouchers(dataMap['vouchers']);
      if (dataMap['payroll']) setPayrollRecords(dataMap['payroll']);
      if (dataMap['plants']) setPlants(dataMap['plants']);
      if (dataMap['firms']) setFirms(dataMap['firms']);
      if (dataMap['users']) setUsers(dataMap['users']);
      if (dataMap['holidays']) setHolidays(dataMap['holidays']);
      if (dataMap['leaveRequests']) setLeaveRequests(dataMap['leaveRequests']);
      
      if (dataMap['notifications']) {
        setNotifications(dataMap['notifications']);
      } else if (currentUserUsername) {
        const notifRes = await fetch(`/api/data/notifications?employeeId=${encodeURIComponent(currentUserUsername)}`);
        if (notifRes.ok) {
            const json = await notifRes.json();
            setNotifications(Array.isArray(json) ? json : (json?.data || []));
        }
      }
    } catch (error) {
      console.error("Failed to fetch data efficiently:", error);
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId, currentUserRole, currentUserUsername, isAdminRole]);

  useEffect(() => {
    fetchData();
  }, [currentUserId, fetchData]);

  // Real-time live synchronization for notifications
  useEffect(() => {
    if (!currentUserId) return;

    const syncNotifications = async () => {
      try {
        const res = await fetch('/api/data/notifications');
        if (res.ok) {
          const json = await res.json();
          const list = Array.isArray(json) ? json : (json?.data || []);
          setNotifications(list);
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
  }, [currentUserId, currentUserRole, currentUserUsername]);

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