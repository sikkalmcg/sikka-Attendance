
"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { Employee, AttendanceRecord, Voucher, Plant, PayrollRecord, Firm, User, Holiday } from '@/lib/types';
import { SUPER_ADMIN_USER } from '@/lib/constants';

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

const INITIAL_PLANTS: Plant[] = [
  { id: "plant-1", name: "Okhla Phase III Plant", lat: 28.5355, lng: 77.2639, radius: 700, firmId: "f1", active: true },
  { id: "plant-2", name: "Gurgaon Sec 18 Plant", lat: 28.4595, lng: 77.0266, radius: 700, firmId: "f1", active: true },
];

const INITIAL_FIRMS: Firm[] = [
  { 
    id: "f1", 
    name: "Sikka Industries Ltd.", 
    gstin: "07AAAAA0000A1Z5", 
    pan: "AAAAA0000A", 
    pfNo: "DL/CPM/123", 
    esicNo: "11000123", 
    bankName: "HDFC Bank",
    accountNo: "50100123456789",
    ifscCode: "HDFC0000123",
    units: [
      { id: "u1", name: "Okhla Unit 1", address: "Phase III, Okhla" }
    ] 
  }
];

const INITIAL_USERS: User[] = [
  { 
    id: "1", 
    fullName: "Ajay Somra", 
    username: "ajaysomra", 
    role: "SUPER_ADMIN", 
    permissions: ["Dashboard", "Attendance", "Payroll", "Users"],
    status: "Active"
  },
  { 
    id: "2", 
    fullName: "Mayank Sharma", 
    username: "mayank.hr", 
    role: "HR", 
    permissions: ["Attendance", "Payroll"],
    status: "Active"
  }
];

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [firms, setFirms] = useState<Firm[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);

  // Load initial data from localStorage if available, otherwise use defaults
  useEffect(() => {
    const savedEmps = localStorage.getItem('app_employees');
    const savedAtt = localStorage.getItem('app_attendance');
    const savedVouchers = localStorage.getItem('app_vouchers');
    const savedPayroll = localStorage.getItem('app_payroll');
    const savedPlants = localStorage.getItem('app_plants');
    const savedFirms = localStorage.getItem('app_firms');
    const savedUsers = localStorage.getItem('app_users');
    const savedHolidays = localStorage.getItem('app_holidays');

    if (savedEmps) {
      setEmployees(JSON.parse(savedEmps));
    } else {
      const defaultEmp: Employee = { 
        id: "1", 
        employeeId: "EMP-S0001", 
        name: "Ravi Kumar", 
        fatherName: "Mr. Ramesh Kumar",
        aadhaar: "1234 5678 9012",
        pan: "ABCDE1234F",
        mobile: "9988776655", 
        address: "New Delhi, India",
        department: "Production", 
        designation: "Engineer", 
        joinDate: "2023-01-15",
        firmId: "f1",
        unitId: "u1",
        bankName: "HDFC Bank",
        accountNo: "50100123456789",
        ifscCode: "HDFC0000123",
        isGovComplianceEnabled: true,
        pfNumber: "DL/CPM/123/001",
        esicNumber: "11000123001",
        salary: { 
          basic: 15000, hra: 7500, da: 0, allowance: 7500, grossSalary: 30000,
          employeePF: 1800, employeeESIC: 113, employerPF: 1950, employerESIC: 488,
          netSalary: 28087, monthlyCTC: 32438, pfRateEmp: 12, esicRateEmp: 0.75, pfRateEx: 13, esicRateEx: 3.25
        },
        salaryHistory: [{ fromMonth: "Jan-2023", toMonth: "Present", monthlyCTC: 32438 }],
        active: true,
        advanceLeaveBalance: 2
      };
      setEmployees([defaultEmp]);
    }

    if (savedAtt) setAttendanceRecords(JSON.parse(savedAtt));
    if (savedVouchers) setVouchers(JSON.parse(savedVouchers));
    if (savedPayroll) setPayrollRecords(JSON.parse(savedPayroll));
    if (savedPlants) setPlants(JSON.parse(savedPlants)); else setPlants(INITIAL_PLANTS);
    if (savedFirms) setFirms(JSON.parse(savedFirms)); else setFirms(INITIAL_FIRMS);
    if (savedUsers) setUsers(JSON.parse(savedUsers)); else setUsers(INITIAL_USERS);
    if (savedHolidays) setHolidays(JSON.parse(savedHolidays));
  }, []);

  // Save to localStorage whenever state changes
  useEffect(() => {
    if (employees.length > 0) localStorage.setItem('app_employees', JSON.stringify(employees));
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
