export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'HR' | 'EMPLOYEE';

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  password?: string;
  permissions: string[];
  status: 'Active' | 'Inactive';
  avatar?: string;
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
  registeredAddress?: string;
  stateName?: string;
  stateCode?: string;
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
  status: 'PENDING' | 'APPROVED' | 'PAID' | 'CANCELLED';
  createdByName?: string;
  approvedByName?: string;
  paymentMode?: 'CASH' | 'BANKING';
  paymentReference?: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  inTime: string | null;
  outTime: string | null;
  hours: number;
  status: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'FIELD' | 'WFH';
  attendanceType: 'OFFICE' | 'FIELD' | 'WFH';
  attendanceTypeOut?: 'OFFICE' | 'FIELD' | 'WFH';
  lat: number;
  lng: number;
  address: string;
  latOut?: number;
  lngOut?: number;
  addressOut?: string;
  inPlant?: string;
  outPlant?: string;
  approved: boolean;
  remark?: string;
  rejectionCount?: number;
  autoCheckout?: boolean;
}

export interface AppNotification {
  id: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export interface SalaryPaymentRecord {
  amount: number;
  date: string;
  type: 'BANKING' | 'CASH' | 'CHEQUE';
  reference: string;
}

export interface StatutoryPaymentRecord {
  employeeAmt: number;
  employerAmt: number;
  date: string;
  reference: string;
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
  slipNo?: string;
  slipDate?: string;

  // Statutory Liabilties at time of generation
  pfAmountEmployee: number;
  pfAmountEmployer: number;
  esicAmountEmployee: number;
  esicAmountEmployer: number;

  // Payment Tracking
  salaryPaidAmount: number;
  salaryPaidDate?: string;
  salaryHistory: SalaryPaymentRecord[];

  pfPaidAmountEmployee: number;
  pfPaidAmountEmployer: number;
  pfPaidDate?: string;
  pfHistory: StatutoryPaymentRecord[];

  esicPaidAmountEmployee: number;
  esicPaidAmountEmployer: number;
  esicPaidDate?: string;
  esicHistory: StatutoryPaymentRecord[];
}
