"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import { Employee, AttendanceRecord, Voucher, Plant, PayrollRecord, Firm, User, Holiday } from '@/lib/types';
import { INITIAL_PLANTS, INITIAL_FIRMS, INITIAL_USERS, DEFAULT_EMPLOYEE } from '@/lib/mock-data';

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
  
  const isLoaded = useRef(false);

  useEffect(() => {
    const savedEmps = localStorage.getItem('app_employees');
    const savedAtt = localStorage.getItem('app_attendance');
    const savedVouchers = localStorage.getItem('app_vouchers');
    const savedPayroll = localStorage.getItem('app_payroll');
    const savedPlants = localStorage.getItem('app_plants');
    const savedFirms = localStorage.getItem('app_firms');
    const savedUsers = localStorage.getItem('app_users');
    const savedHolidays = localStorage.getItem('app_holidays');

    setEmployees(savedEmps ? JSON.parse(savedEmps) : [DEFAULT_EMPLOYEE]);
    setAttendanceRecords(savedAtt ? JSON.parse(savedAtt) : []);
    setVouchers(savedVouchers ? JSON.parse(savedVouchers) : []);
    setPayrollRecords(savedPayroll ? JSON.parse(savedPayroll) : []);
    setPlants(savedPlants ? JSON.parse(savedPlants) : INITIAL_PLANTS);
    setFirms(savedFirms ? JSON.parse(savedFirms) : INITIAL_FIRMS);
    setUsers(savedUsers ? JSON.parse(savedUsers) : INITIAL_USERS);
    setHolidays(savedHolidays ? JSON.parse(savedHolidays) : []);

    isLoaded.current = true;
  }, []);

  useEffect(() => {
    if (!isLoaded.current) return;

    localStorage.setItem('app_employees', JSON.stringify(employees));
    localStorage.setItem('app_attendance', JSON.stringify(attendanceRecords));
    localStorage.setItem('app_vouchers', JSON.stringify(vouchers));
    localStorage.setItem('app_payroll', JSON.stringify(payrollRecords));
    localStorage.setItem('app_plants', JSON.stringify(plants));
    localStorage.setItem('app_firms', JSON.stringify(firms));
    localStorage.setItem('app_users', JSON.stringify(users));
    localStorage.setItem('app_holidays', JSON.stringify(holidays));
  }, [employees, attendanceRecords, vouchers, payrollRecords, plants, firms, users, holidays]);

  const value = useMemo(() => ({
    employees, setEmployees,
    attendanceRecords, setAttendanceRecords,
    vouchers, setVouchers,
    payrollRecords, setPayrollRecords,
    plants, setPlants,
    firms, setFirms,
    users, setUsers,
    holidays, setHolidays
  }), [employees, attendanceRecords, vouchers, payrollRecords, plants, firms, users, holidays]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
