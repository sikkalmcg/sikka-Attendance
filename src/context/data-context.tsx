"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { Employee, AttendanceRecord, Voucher, Plant, PayrollRecord } from '@/lib/types';

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
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const MOCK_PLANTS: Plant[] = [
  { id: "plant-1", name: "Okhla Phase III Plant", lat: 28.5355, lng: 77.2639, radius: 700 },
  { id: "plant-2", name: "Gurgaon Sec 18 Plant", lat: 28.4595, lng: 77.0266, radius: 700 },
];

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);

  // Load initial data from localStorage if available, otherwise use defaults
  useEffect(() => {
    const savedEmps = localStorage.getItem('app_employees');
    const savedAtt = localStorage.getItem('app_attendance');
    const savedVouchers = localStorage.getItem('app_vouchers');
    const savedPayroll = localStorage.getItem('app_payroll');

    if (savedEmps) {
      setEmployees(JSON.parse(savedEmps));
    } else {
      // Default mock employee
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
  }, []);

  // Save to localStorage whenever state changes
  useEffect(() => {
    if (employees.length > 0) localStorage.setItem('app_employees', JSON.stringify(employees));
    localStorage.setItem('app_attendance', JSON.stringify(attendanceRecords));
    localStorage.setItem('app_vouchers', JSON.stringify(vouchers));
    localStorage.setItem('app_payroll', JSON.stringify(payrollRecords));
  }, [employees, attendanceRecords, vouchers, payrollRecords]);

  const value = useMemo(() => ({
    employees, setEmployees,
    attendanceRecords, setAttendanceRecords,
    vouchers, setVouchers,
    payrollRecords, setPayrollRecords,
    plants: MOCK_PLANTS
  }), [employees, attendanceRecords, vouchers, payrollRecords]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
