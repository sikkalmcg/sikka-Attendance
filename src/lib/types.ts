export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'HR' | 'EMPLOYEE';

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  isSuperAdmin?: boolean;
}

export interface Plant {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius: number; // In meters
}

export interface Firm {
  id: string;
  name: string;
  gstin: string;
  pan: string;
  pfNo: string;
  esicNo: string;
}

export interface Employee {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  aadhaar: string;
  pan: string;
  mobile: string;
  department: string;
  designation: string;
  plantId: string;
  salary: {
    basic: number;
    hra: number;
    da: number;
    allowance: number;
  };
  active: boolean;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string; // ISO String (Date only)
  inTime: string | null;
  outTime: string | null;
  hours: number;
  status: 'PRESENT' | 'HALF_DAY' | 'ABSENT' | 'HOLIDAY' | 'PRESENT_ON_HOLIDAY';
  lat: number;
  lng: number;
  address: string;
  approved: boolean;
  remark?: string;
}

export interface Holiday {
  id: string;
  date: string;
  name: string;
}

export interface PayrollRecord {
  id: string;
  payrollNo: string;
  employeeId: string;
  month: string;
  year: string;
  payableDays: number;
  gross: number;
  pf: number;
  esic: number;
  netSalary: number;
  paidAmount: number;
}

export interface Voucher {
  id: string;
  voucherNo: string;
  employeeId: string;
  date: string;
  purpose: string;
  amount: number;
  paidAmount: number;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  paidDate?: string;
  paymentMode?: 'CASH' | 'BANK' | 'CHEQUE';
}