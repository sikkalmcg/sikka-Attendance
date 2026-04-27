
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
import { collection, doc, query, where } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
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
  // Mutation helpers
  addRecord: (col: string, data: any) => void;
  updateRecord: (col: string, id: string, data: any) => void;
  deleteRecord: (col: string, id: string) => void;
  setRecord: (col: string, id: string, data: any) => void;
  currentUser: any;
  verifiedUser: any;
  isLoading: boolean;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const db = useFirestore();
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const session = Cookies.get('sikka_session');
    if (session) {
      try {
        setCurrentUser(JSON.parse(session));
      } catch (e) {
        console.error("Session parse error", e);
      }
    }
    
    // Ensure Firebase Auth is active to satisfy Security Rules
    const auth = getAuth();
    if (!auth.currentUser) {
      signInAnonymously(auth)
        .then(() => setIsAuthReady(true))
        .catch(err => {
          console.error("Auth sync error:", err);
          setIsAuthReady(true);
        });
    } else {
      setIsAuthReady(true);
    }
  }, []);

  const isAdminRole = useMemo(() => {
    return currentUser && ['SUPER_ADMIN', 'ADMIN', 'HR'].includes(currentUser.role);
  }, [currentUser]);

  // Real-time Firestore Subscriptions - Guarded by auth state
  const employeesQuery = useMemoFirebase(() => isAuthReady && currentUser ? collection(db, 'employees') : null, [db, currentUser, isAuthReady]);
  const { data: employees, isLoading: loadingEmployees } = useCollection<Employee>(employeesQuery);

  const attendanceQuery = useMemoFirebase(() => isAuthReady && currentUser ? collection(db, 'attendance') : null, [db, currentUser, isAuthReady]);
  const { data: attendance, isLoading: loadingAttendance } = useCollection<AttendanceRecord>(attendanceQuery);

  const vouchersQuery = useMemoFirebase(() => isAuthReady && currentUser ? collection(db, 'vouchers') : null, [db, currentUser, isAuthReady]);
  const { data: vouchers, isLoading: loadingVouchers } = useCollection<Voucher>(vouchersQuery);

  const payrollQuery = useMemoFirebase(() => {
    if (!isAuthReady || !currentUser || !isAdminRole) return null;
    return collection(db, 'payroll');
  }, [db, currentUser, isAdminRole, isAuthReady]);
  const { data: payroll, isLoading: loadingPayroll } = useCollection<PayrollRecord>(payrollQuery);

  const plantsQuery = useMemoFirebase(() => isAuthReady && currentUser ? collection(db, 'plants') : null, [db, currentUser, isAuthReady]);
  const { data: plants, isLoading: loadingPlants } = useCollection<Plant>(plantsQuery);

  const firmsQuery = useMemoFirebase(() => isAuthReady && currentUser ? collection(db, 'firms') : null, [db, currentUser, isAuthReady]);
  const { data: firms, isLoading: loadingFirms } = useCollection<Firm>(firmsQuery);

  const usersQuery = useMemoFirebase(() => {
    if (!isAuthReady || !currentUser || currentUser.role !== 'SUPER_ADMIN') return null;
    return collection(db, 'users');
  }, [db, currentUser, isAuthReady]);
  const { data: users, isLoading: loadingUsers } = useCollection<User>(usersQuery);

  const holidaysQuery = useMemoFirebase(() => isAuthReady && currentUser ? collection(db, 'holidays') : null, [db, currentUser, isAuthReady]);
  const { data: holidays, isLoading: loadingHolidays } = useCollection<Holiday>(holidaysQuery);

  const notificationsQuery = useMemoFirebase(() => {
    if (!isAuthReady || !currentUser) return null;
    if (isAdminRole) return collection(db, 'notifications');
    return query(collection(db, 'notifications'), where('employeeId', '==', currentUser.username));
  }, [db, currentUser, isAdminRole, isAuthReady]);
  const { data: notifications, isLoading: loadingNotifications } = useCollection<AppNotification>(notificationsQuery);

  const leaveQuery = useMemoFirebase(() => isAuthReady && currentUser ? collection(db, 'leaveRequests') : null, [db, currentUser, isAuthReady]);
  const { data: leaveRequests, isLoading: loadingLeaves } = useCollection<LeaveRequest>(leaveQuery);

  // Centralized Verified User Logic
  const verifiedUser = useMemo(() => {
    if (!currentUser) return null;

    if (currentUser.role === 'EMPLOYEE') {
      const loginIdent = currentUser.username?.replace(/\s/g, '');
      const dbEmp = (employees || []).find(e => {
        const empAadhaar = e.aadhaar?.replace(/\s/g, '');
        const empMobile = e.mobile?.replace(/\s/g, '');
        return empAadhaar === loginIdent || empMobile === loginIdent;
      });
      // CRITICAL: Merge all employee fields (like official employeeId) into session
      return dbEmp ? { ...currentUser, ...dbEmp, fullName: dbEmp.name, avatar: dbEmp.avatar } : currentUser;
    }

    if (currentUser.role !== 'SUPER_ADMIN') {
      const dbUser = (users || []).find(u => u.id === currentUser.id);
      return dbUser ? { ...currentUser, ...dbUser } : currentUser;
    }

    return currentUser;
  }, [currentUser, employees, users]);

  const isLoading = loadingEmployees || loadingAttendance || loadingVouchers || loadingPlants || loadingFirms || !isAuthReady;

  // Mutation helpers
  const addRecord = (col: string, data: any) => {
    const colRef = collection(db, col);
    addDocumentNonBlocking(colRef, { ...data, createdAt: new Date().toISOString() });
  };

  const updateRecord = (col: string, id: string, data: any) => {
    const docRef = doc(db, col, id);
    updateDocumentNonBlocking(docRef, { ...data, updatedAt: new Date().toISOString() });
  };

  const deleteRecord = (col: string, id: string) => {
    if (currentUser?.role !== 'SUPER_ADMIN') {
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
    currentUser,
    verifiedUser,
    isLoading
  }), [employees, attendance, vouchers, payroll, plants, firms, users, holidays, notifications, leaveRequests, currentUser, verifiedUser, isLoading]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
