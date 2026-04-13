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

export interface SalaryHistoryEntry {
  fromMonth: string; // MMM-YYYY
  toMonth: string;   // MMM-YYYY or "Present"
  monthlyCTC: number;
}

export interface SalaryStructure {
  basic: number;
  hra: number;
  da: number;
  allowance: number;
  monthlyCTC: number;
  employeePF: number;
  employeeESIC: number;
  employerPF: number;
  employerESIC: number;
  grossSalary: number;
  netSalary: number;
  pfRateEmp: number;
  esicRateEmp: number;
  pfRateEx: number;
  esicRateEx: number;
}

export interface Employee {
  id: string;
  employeeId: string;
  name: string;
  fatherName: string;
  aadhaar: string;
  pan: string;
  mobile: string;
  address: string;
  department: string;
  designation: string;
  joinDate: string;
  firmId: string;
  unitId: string;
  bankName: string;
  accountNo: string;
  ifscCode: string;
  isGovComplianceEnabled: boolean;
  pfNumber?: string;
  esicNumber?: string;
  salary: SalaryStructure;
  salaryHistory: SalaryHistoryEntry[];
  active: boolean;
  advanceLeaveBalance?: number;
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

export interface PayrollRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  month: string; // MMM-YY
  attendance: number;
  absent: number;
  adjustLeave: number;
  totalEarningDays: number;
  incentivePct: number;
  incentiveAmt: number;
  holidayWorkDays: number;
  holidayWorkAmt: number;
  netPayable: number;
  status: 'DRAFT' | 'FINALIZED' | 'PAID';
  createdAt: string;
}
