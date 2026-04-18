
"use client";

import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
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
import { 
  useCollection, 
  useFirestore, 
  useMemoFirebase,
  addDocumentNonBlocking,
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking,
  setDocumentNonBlocking
} from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';

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
  // Mutation helpers
  addRecord: (col: string, data: any) => void;
  updateRecord: (col: string, id: string, data: any) => void;
  deleteRecord: (col: string, id: string) => void;
  setRecord: (col: string, id: string, data: any) => void;
  currentUser: any;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const db = useFirestore();
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const saved = localStorage.getItem("user");
    if (saved) setCurrentUser(JSON.parse(saved));

    // Ensure Firebase Auth is active to satisfy Security Rules
    const auth = getAuth();
    if (!auth.currentUser) {
      signInAnonymously(auth).catch(err => console.error("Auth sync error:", err));
    }
  }, []);

  const isAdminRole = useMemo(() => {
    return currentUser && ['SUPER_ADMIN', 'ADMIN', 'HR'].includes(currentUser.role);
  }, [currentUser]);

  // Real-time Firestore Subscriptions - Guarded by auth state
  const employeesQuery = useMemoFirebase(() => currentUser ? collection(db, 'employees') : null, [db, currentUser]);
  const { data: employees } = useCollection<Employee>(employeesQuery);

  const attendanceQuery = useMemoFirebase(() => currentUser ? collection(db, 'attendance') : null, [db, currentUser]);
  const { data: attendance } = useCollection<AttendanceRecord>(attendanceQuery);

  const vouchersQuery = useMemoFirebase(() => currentUser ? collection(db, 'vouchers') : null, [db, currentUser]);
  const { data: vouchers } = useCollection<Voucher>(vouchersQuery);

  const payrollQuery = useMemoFirebase(() => {
    if (!currentUser || !isAdminRole) return null;
    return collection(db, 'payroll');
  }, [db, currentUser, isAdminRole]);
  const { data: payroll } = useCollection<PayrollRecord>(payrollQuery);

  const plantsQuery = useMemoFirebase(() => currentUser ? collection(db, 'plants') : null, [db, currentUser]);
  const { data: plants } = useCollection<Plant>(plantsQuery);

  const firmsQuery = useMemoFirebase(() => currentUser ? collection(db, 'firms') : null, [db, currentUser]);
  const { data: firms } = useCollection<Firm>(firmsQuery);

  const usersQuery = useMemoFirebase(() => {
    if (!currentUser || currentUser.role !== 'SUPER_ADMIN') return null;
    return collection(db, 'users');
  }, [db, currentUser]);
  const { data: users } = useCollection<User>(usersQuery);

  const holidaysQuery = useMemoFirebase(() => currentUser ? collection(db, 'holidays') : null, [db, currentUser]);
  const { data: holidays } = useCollection<Holiday>(holidaysQuery);

  const notificationsQuery = useMemoFirebase(() => {
    if (!currentUser || !isAdminRole) return null;
    return collection(db, 'notifications');
  }, [db, currentUser, isAdminRole]);
  const { data: notifications } = useCollection<AppNotification>(notificationsQuery);

  const leaveQuery = useMemoFirebase(() => currentUser ? collection(db, 'leaveRequests') : null, [db, currentUser]);
  const { data: leaveRequests } = useCollection<LeaveRequest>(leaveQuery);

  // Helper to check if current user is Super Admin
  const isSuperAdmin = () => currentUser?.role === 'SUPER_ADMIN';

  // Firestore Mutation Helpers with RBAC
  const addRecord = (col: string, data: any) => {
    const colRef = collection(db, col);
    addDocumentNonBlocking(colRef, { ...data, createdAt: new Date().toISOString() });
  };

  const updateRecord = (col: string, id: string, data: any) => {
    const docRef = doc(db, col, id);
    updateDocumentNonBlocking(docRef, { ...data, updatedAt: new Date().toISOString() });
  };

  const deleteRecord = (col: string, id: string) => {
    if (!isSuperAdmin()) {
      toast({
        variant: "destructive",
        title: "Permission Denied",
        description: "Only Super Admin accounts are authorized to delete records."
      });
      return;
    }
    const docRef = doc(db, col, id);
    deleteDocumentNonBlocking(docRef);
  };

  const setRecord = (col: string, id: string, data: any) => {
    const docRef = doc(db, col, id);
    setDocumentNonBlocking(docRef, { ...data, updatedAt: new Date().toISOString() }, { merge: true });
  };

  const value = useMemo(() => ({
    employees: employees || [],
    attendanceRecords: attendance || [],
    vouchers: vouchers || [],
    payrollRecords: payroll || [],
    plants: plants || [],
    firms: firms || [],
    users: users || [],
    holidays: holidays || [],
    notifications: notifications || [],
    leaveRequests: leaveRequests || [],
    addRecord,
    updateRecord,
    deleteRecord,
    setRecord,
    currentUser
  }), [employees, attendance, vouchers, payroll, plants, firms, users, holidays, notifications, leaveRequests, currentUser]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
