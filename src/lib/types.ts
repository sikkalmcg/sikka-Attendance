
export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'HR' | 'EMPLOYEE';

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  password?: string;
  permissions: string[];
  status: 'Active' | 'Inactive';
}

export interface Plant {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius: number; // In meters
  firmId: string;
  active: boolean;
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
  bankName?: string;
  accountNo?: string;
  ifscCode?: string;
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

export interface Holiday {
  id: string;
  date: string;
  name: string;
  type: 'FESTIVAL' | 'NATIONAL_HOLIDAY' | 'COMPANY_HOLIDAY' | 'WEEKLY_OFF';
  auto?: boolean;
  plantIds?: string[];
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
  advanceRecovery?: number;
  netPayable: number;
  status: 'DRAFT' | 'FINALIZED' | 'PAID';
  createdAt: string;
}
