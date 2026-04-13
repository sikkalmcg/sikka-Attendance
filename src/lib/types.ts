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

export interface FirmUnit {
  id: string;
  name: string;
  address: string;
}

export interface Firm {
  id: string;
  name: string;
  logo?: string;
  gstin: string;
  pan: string;
  pfNo: string;
  esicNo: string;
  units: FirmUnit[];
}

export interface SalaryStructure {
  basic: number;
  hra: number;
  da: number;
  allowance: number;
  monthlyCTC: number;
}

export interface Employee {
  id: string;
  employeeId: string;
  name: string;
  aadhaar: string;
  pan: string;
  mobile: string;
  department: string;
  designation: string;
  joinDate: string;
  plantId: string;
  salary: SalaryStructure;
  active: boolean;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  inTime: string | null;
  outTime: string | null;
  inPlant?: string;
  outPlant?: string;
  hours: number;
  status: 'PRESENT' | 'HALF_DAY' | 'ABSENT' | 'HOLIDAY' | 'FIELD' | 'WFH';
  attendanceType: 'OFFICE' | 'FIELD' | 'WFH';
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

export interface Voucher {
  id: string;
  voucherNo: string;
  employeeId: string;
  date: string;
  purpose: string;
  amount: number;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
}
