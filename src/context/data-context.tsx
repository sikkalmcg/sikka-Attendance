
"use client";

import React, { createContext, useContext, useMemo } from 'react';
import { 
  Employee, 
  AttendanceRecord, 
  Voucher, 
  Plant, 
  PayrollRecord, 
  Firm, 
  User, 
  Holiday, 
  AppNotification 
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
  // Mutation helpers
  addRecord: (col: string, data: any) => void;
  updateRecord: (col: string, id: string, data: any) => void;
  deleteRecord: (col: string, id: string) => void;
  setRecord: (col: string, id: string, data: any) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const db = useFirestore();

  // Real-time Firestore Subscriptions
  const employeesQuery = useMemoFirebase(() => collection(db, 'employees'), [db]);
  const { data: employees } = useCollection<Employee>(employeesQuery);

  const attendanceQuery = useMemoFirebase(() => collection(db, 'attendance'), [db]);
  const { data: attendance } = useCollection<AttendanceRecord>(attendanceQuery);

  const vouchersQuery = useMemoFirebase(() => collection(db, 'vouchers'), [db]);
  const { data: vouchers } = useCollection<Voucher>(vouchersQuery);

  const payrollQuery = useMemoFirebase(() => collection(db, 'payroll'), [db]);
  const { data: payroll } = useCollection<PayrollRecord>(payrollQuery);

  const plantsQuery = useMemoFirebase(() => collection(db, 'plants'), [db]);
  const { data: plants } = useCollection<Plant>(plantsQuery);

  const firmsQuery = useMemoFirebase(() => collection(db, 'firms'), [db]);
  const { data: firms } = useCollection<Firm>(firmsQuery);

  const usersQuery = useMemoFirebase(() => collection(db, 'users'), [db]);
  const { data: users } = useCollection<User>(usersQuery);

  const holidaysQuery = useMemoFirebase(() => collection(db, 'holidays'), [db]);
  const { data: holidays } = useCollection<Holiday>(holidaysQuery);

  const notificationsQuery = useMemoFirebase(() => collection(db, 'notifications'), [db]);
  const { data: notifications } = useCollection<AppNotification>(notificationsQuery);

  // Firestore Mutation Helpers
  const addRecord = (col: string, data: any) => {
    const colRef = collection(db, col);
    addDocumentNonBlocking(colRef, { ...data, createdAt: new Date().toISOString() });
  };

  const updateRecord = (col: string, id: string, data: any) => {
    const docRef = doc(db, col, id);
    updateDocumentNonBlocking(docRef, { ...data, updatedAt: new Date().toISOString() });
  };

  const deleteRecord = (col: string, id: string) => {
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
    addRecord,
    updateRecord,
    deleteRecord,
    setRecord
  }), [employees, attendance, vouchers, payroll, plants, firms, users, holidays, notifications]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
