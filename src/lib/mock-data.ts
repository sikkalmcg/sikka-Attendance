import { Employee, Firm, User, Plant } from './types';

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
      { id: "u1", name: "Okhla Unit 1", address: "Phase III, Okhla" }
    ] 
  }
];

export const INITIAL_PLANTS: Plant[] = [
  { id: "plant-1", name: "Okhla Phase III Plant", lat: 28.5355, lng: 77.2639, radius: 700, firmId: "f1", active: true },
  { id: "plant-2", name: "Gurgaon Sec 18 Plant", lat: 28.4595, lng: 77.0266, radius: 700, firmId: "f1", active: true },
];

export const INITIAL_USERS: User[] = [
  { 
    id: "1", 
    fullName: "Ajay Somra", 
    username: "ajaysomra", 
    role: "SUPER_ADMIN", 
    permissions: ["Dashboard", "Attendance", "Payroll", "Users", "Vouchers", "Employees", "Holidays", "Settings"],
    status: "Active"
  },
  { 
    id: "2", 
    fullName: "Mayank Sharma", 
    username: "mayank.hr", 
    role: "HR", 
    permissions: ["Attendance", "Payroll", "Employees", "Vouchers"],
    status: "Active"
  }
];

export const DEFAULT_EMPLOYEE: Employee = { 
  id: "emp-mock", 
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
