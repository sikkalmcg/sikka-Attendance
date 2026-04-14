"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import { Employee, AttendanceRecord, Voucher, Plant, PayrollRecord, Firm, User, Holiday, AppNotification } from '@/lib/types';
import { INITIAL_PLANTS, INITIAL_FIRMS, INITIAL_USERS, INITIAL_EMPLOYEES } from '@/lib/mock-data';

interface DataContextType {
  employees: Employee[];
  setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
  attendanceRecords: AttendanceRecord[];
  setAttendanceRecords: React.Dispatch<React.SetStateAction<AttendanceRecord[]>>;
  vouchers: Voucher[];
  setVouchers: React.Dispatch<React.SetStateAction<Voucher[]>>;
  payrollRecords: PayrollRecord[];
  setPayrollRecords: React.Dispatch<React.SetStateAction<PayrollRecord[]>>;
  plants: Plant[];
  setPlants: React.Dispatch<React.SetStateAction<Plant[]>>;
  firms: Firm[];
  setFirms: React.Dispatch<React.SetStateAction<Firm[]>>;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  holidays: Holiday[];
  setHolidays: React.Dispatch<React.SetStateAction<Holiday[]>>;
  notifications: AppNotification[];
  setNotifications: React.Dispatch<React.SetStateAction<AppNotification[]>>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [firms, setFirms] = useState<Firm[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  
  const isLoaded = useRef(false);

  useEffect(() => {
    // Initial Load from LocalStorage
    const savedEmps = localStorage.getItem('app_employees');
    const savedAtt = localStorage.getItem('app_attendance');
    const savedVouchers = localStorage.getItem('app_vouchers');
    const savedPayroll = localStorage.getItem('app_payroll');
    const savedPlants = localStorage.getItem('app_plants');
    const savedFirms = localStorage.getItem('app_firms');
    const savedUsers = localStorage.getItem('app_users');
    const savedHolidays = localStorage.getItem('app_holidays');
    const savedNotifications = localStorage.getItem('app_notifications');

    setEmployees(savedEmps ? JSON.parse(savedEmps) : INITIAL_EMPLOYEES);
    setAttendanceRecords(savedAtt ? JSON.parse(savedAtt) : []);
    setVouchers(savedVouchers ? JSON.parse(savedVouchers) : []);
    setPayrollRecords(savedPayroll ? JSON.parse(savedPayroll) : []);
    setPlants(savedPlants ? JSON.parse(savedPlants) : INITIAL_PLANTS);
    setFirms(savedFirms ? JSON.parse(savedFirms) : INITIAL_FIRMS);
    setUsers(savedUsers ? JSON.parse(savedUsers) : INITIAL_USERS);
    setHolidays(savedHolidays ? JSON.parse(savedHolidays) : []);
    setNotifications(savedNotifications ? JSON.parse(savedNotifications) : []);

    isLoaded.current = true;
  }, []);

  useEffect(() => {
    // Persist to LocalStorage whenever state changes
    if (!isLoaded.current) return;

    localStorage.setItem('app_employees', JSON.stringify(employees));
    localStorage.setItem('app_attendance', JSON.stringify(attendanceRecords));
    localStorage.setItem('app_vouchers', JSON.stringify(vouchers));
    localStorage.setItem('app_payroll', JSON.stringify(payrollRecords));
    localStorage.setItem('app_plants', JSON.stringify(plants));
    localStorage.setItem('app_firms', JSON.stringify(firms));
    localStorage.setItem('app_users', JSON.stringify(users));
    localStorage.setItem('app_holidays', JSON.stringify(holidays));
    localStorage.setItem('app_notifications', JSON.stringify(notifications));
  }, [employees, attendanceRecords, vouchers, payrollRecords, plants, firms, users, holidays, notifications]);

  const value = useMemo(() => ({
    employees, setEmployees,
    attendanceRecords, setAttendanceRecords,
    vouchers, setVouchers,
    payrollRecords, setPayrollRecords,
    plants, setPlants,
    firms, setFirms,
    users, setUsers,
    holidays, setHolidays,
    notifications, setNotifications
  }), [employees, attendanceRecords, vouchers, payrollRecords, plants, firms, users, holidays, notifications]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
