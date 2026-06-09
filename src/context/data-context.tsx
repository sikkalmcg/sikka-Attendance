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
  addRecord: (col: string, data: any) => Promise<void>;
  updateRecord: (col: string, id: string, data: any) => Promise<void>;
  deleteRecord: (col: string, id: string) => Promise<void>;
  setRecord: (col: string, id: string, data: any) => Promise<void>;
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
    const session = Cookies.get('sikka_session');
    if (session) {
      try {
        setCurrentUser(JSON.parse(session));
      } catch (e) {
        console.error("Session parse error", e);
      }
    }
  }, []);

  const isAdminRole = useMemo(() => {
    return currentUser && ['SUPER_ADMIN', 'ADMIN', 'HR'].includes(currentUser.role);
  }, [currentUser?.role]);

  const currentUserId = currentUser?.id;
  const currentUserRole = currentUser?.role;
  const currentUserUsername = currentUser?.username;

  const fetchData = useCallback(async () => {
    if (!currentUserId) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      // LIGHTWEIGHT ROUTING: Agar user ek employee hai, toh query loading parameters chote rakhein
      let collectionsToFetch: string[] = [];

      if (currentUserRole === 'EMPLOYEE') {
        // Employee dashboard ke liye sirf itna hi kaafi hai
        collectionsToFetch = ['attendance', 'plants', 'holidays'];
      } else {
        // Admin/HR ke liye saari collections fetch karein
        collectionsToFetch = ['employees', 'attendance', 'vouchers', 'plants', 'firms', 'holidays', 'leaveRequests'];
        if (isAdminRole) collectionsToFetch.push('payroll', 'notifications');
        if (currentUserRole === 'SUPER_ADMIN') collectionsToFetch.push('users');
      }

      const results = await Promise.all(
        collectionsToFetch.map(col => fetch(`/api/data/${col}`).then(res => res.ok ? res.json() : []))
      );

      const dataMap: Record<string, any[]> = {};
      collectionsToFetch.forEach((col, index) => {
        dataMap[col] = Array.isArray(results[index]) ? results[index] : (results[index]?.data || []);
      });

      // Mapping state context arrays safely
      if (dataMap['employees']) setEmployees(dataMap['employees']);
      if (dataMap['attendance']) setAttendanceRecords(dataMap['attendance']);
      if (dataMap['vouchers']) setVouchers(dataMap['vouchers']);
      if (dataMap['payroll']) setPayrollRecords(dataMap['payroll']);
      if (dataMap['plants']) setPlants(dataMap['plants']);
      if (dataMap['firms']) setFirms(dataMap['firms']);
      if (dataMap['users']) setUsers(dataMap['users']);
      if (dataMap['holidays']) setHolidays(dataMap['holidays']);
      if (dataMap['leaveRequests']) setLeaveRequests(dataMap['leaveRequests']);
      
      // Fetch user notifications efficiently
      if (dataMap['notifications']) {
        setNotifications(dataMap['notifications']);
      } else if (currentUserUsername) {
        const notifRes = await fetch(`/api/data/notifications?employeeId=${currentUserUsername}`);
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

  const verifiedUser = useMemo(() => {
    if (!currentUser) return null;

    if (currentUser.role === 'EMPLOYEE') {
      // Agar employees state khali hai (un-fetched due to role segregation), use standard details session parameters
      if (employees.length === 0) {
        return { ...currentUser, fullName: currentUser.fullName || "Employee" };
      }
      const loginIdent = currentUser.username?.replace(/\s/g, '');
      const dbEmp = (employees || []).find(e => {
        const empAadhaar = String(e.aadhaarNumber || e.aadhaar || '').replace(/\s/g, '');
        const empMobile = String(e.mobileNumber || e.mobile || '').replace(/\s/g, '');
        return empAadhaar === loginIdent || empMobile === loginIdent;
      });
      const fullName = dbEmp ? (dbEmp.firstName ? `${dbEmp.firstName} ${dbEmp.lastName || ''}`.trim() : dbEmp.name) : (currentUser.fullName || "Employee");
      return dbEmp ? { ...currentUser, ...dbEmp, fullName, avatar: dbEmp.avatar } : currentUser;
    }

    if (currentUser.role !== 'SUPER_ADMIN') {
      const dbUser = (users || []).find(u => u.id === currentUser.id);
      return dbUser ? { ...currentUser, ...dbUser } : currentUser;
    }

    return currentUser;
  }, [currentUser, employees, users]);

  const addRecord = async (col: string, data: any) => {
    try {
      const res = await fetch(`/api/data/${col}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, createdAt: new Date().toISOString() })
      });
      if (!res.ok) console.warn(`Failed to append record in ${col}. Status: ${res.status}`);
      await fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const updateRecord = async (col: string, id: string, data: any) => {
    try {
      await fetch(`/api/data/${col}?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, updatedAt: new Date().toISOString() })
      });
      await fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const deleteRecord = async (col: string, id: string) => {
    if (currentUser?.role !== 'SUPER_ADMIN') {
      toast({
        variant: "destructive",
        title: "Permission Denied",
        description: "Only Super Admin accounts are authorized to delete records."
      });
      return;
    }
    try {
      await fetch(`/api/data/${col}?id=${id}`, { method: 'DELETE' });
      await fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const setRecord = async (col: string, id: string, data: any) => {
    try {
      await fetch(`/api/data/${col}?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, id, updatedAt: new Date().toISOString() })
      });
      await fetchData();
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