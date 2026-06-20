import { Employee, Firm, User, Plant } from './types';
import { APP_PERMISSIONS } from './constants';

export const INITIAL_FIRMS: Firm[] = [
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
      { id: "u1", name: "Okhla Unit 1", address: "Phase III, Okhla" },
      { id: "u2", name: "Gurgaon Unit 2", address: "Sector 18, Gurgaon" }
    ] 
  },
  { 
    id: "f2", 
    name: "Sikka Logistics Pvt Ltd.", 
    gstin: "08BBBBB9999B1Z1", 
    pan: "BBBBB9999B", 
    pfNo: "RJ/JPR/456", 
    esicNo: "22000456", 
    bankName: "ICICI Bank",
    accountNo: "000405060708",
    ifscCode: "ICIC0000004",
    units: [
      { id: "u3", name: "Jaipur Hub", address: "VKI Area, Jaipur" }
    ] 
  }
];

export const INITIAL_PLANTS: Plant[] = [
  { id: "plant-1", name: "Okhla Phase III Plant", lat: 28.5355, lng: 77.2639, radius: 700, firmId: "f1", active: true },
  { id: "plant-2", name: "Gurgaon Sec 18 Plant", lat: 28.4595, lng: 77.0266, radius: 700, firmId: "f1", active: true },
  { id: "plant-3", name: "Jaipur Logistics Hub", lat: 26.9124, lng: 75.7873, radius: 700, firmId: "f2", active: true },
];

export const INITIAL_USERS: User[] = [
  { 
    id: "1", 
    fullName: "Ajay Somra", 
    username: "ajaysomra", 
    role: "SUPER_ADMIN", 
    permissions: ["Dashboard", ...APP_PERMISSIONS],
    status: "Active"
  },
  { 
    id: "2", 
    fullName: "Mayank Sharma", 
    username: "mayank.hr", 
    role: "HR", 
    permissions: ["Attendance", "Payroll", "Employees", "Vouchers", "Approvals", "Reports"],
    status: "Active"
  }
];

export const DEFAULT_EMPLOYEE: Employee = { 
  id: "emp-mock-1", 
  employeeId: "EMP-S0001", 
  name: "Ravi Kumar", 
  fatherName: "Mr. Ramesh Kumar",
  aadhaar: "1234 5678 9012",
  pan: "ABCDE1234F",
  mobile: "9988776655", 
  address: "Okhla Phase III, New Delhi",
  department: "Production", 
  designation: "Machine Operator", 
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

export const INITIAL_EMPLOYEES: Employee[] = [
  DEFAULT_EMPLOYEE,
  {
    id: "emp-mock-2",
    employeeId: "EMP-S0002",
    name: "Sunita Devi",
    fatherName: "Mr. Gopal Das",
    aadhaar: "9876 5432 1098",
    pan: "XYZPQ9999Z",
    mobile: "9876543210",
    address: "Sec 18, Gurgaon, Haryana",
    department: "Logistics",
    designation: "Fleet Planner",
    joinDate: "2023-06-10",
    firmId: "f1",
    unitId: "u2",
    bankName: "SBI",
    accountNo: "3344556677",
    ifscCode: "SBIN0001234",
    isGovComplianceEnabled: true,
    pfNumber: "DL/CPM/123/002",
    esicNumber: "11000123002",
    salary: { 
      basic: 18000, hra: 9000, da: 0, allowance: 5000, grossSalary: 32000,
      employeePF: 2160, employeeESIC: 135, employerPF: 2340, employerESIC: 585,
      netSalary: 29705, monthlyCTC: 34925, pfRateEmp: 12, esicRateEmp: 0.75, pfRateEx: 13, esicRateEx: 3.25
    },
    salaryHistory: [{ fromMonth: "Jun-2023", toMonth: "Present", monthlyCTC: 34925 }],
    active: true,
    advanceLeaveBalance: 5
  }
];
