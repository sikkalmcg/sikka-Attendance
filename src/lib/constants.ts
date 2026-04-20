export const SUPER_ADMIN_USER = {
  username: 'ajaysomra',
  password: 'Mayank@2012',
  mobile: '8860091900',
  role: 'SUPER_ADMIN',
  fullName: 'Super Admin',
};

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  HR: 'HR',
  EMPLOYEE: 'EMPLOYEE',
};

export const ATTENDANCE_RULES = {
  PRESENT_THRESHOLD: 1.0, // Hours >= 1.0 is Present, < 1.0 is Absent
  AUTO_OUT_HOURS: 16,
};

export const STATUTORY_RATES = {
  PF_EMPLOYEE_RATE: 0.12,
  PF_EMPLOYER_RATE: 0.13,
  ESIC_EMPLOYEE_RATE: 0.0075,
  ESIC_EMPLOYER_RATE: 0.0325,
  ESIC_THRESHOLD: 21000,
};

export const DEPARTMENTS = [
  'Warehousing',
  'Production',
  'Logistics',
  'HR'
];

export const DESIGNATIONS: Record<string, string[]> = {
  'Warehousing': [
    'Warehouse Manager', 
    'Assistant Warehouse Manager', 
    'Store Keeper', 
    'Inventory Manager', 
    'Inventory Executive', 
    'Warehouse Supervisor', 
    'Data Entry Operator'
  ],
  'Production': [
    'Production Manager', 
    'Warehouse Manager', 
    'Supervisor', 
    'Shift In charge', 
    'Machine Operator', 
    'Senior Operator', 
    'Technician', 
    'Quality Inspector', 
    'Quality Analyst', 
    'Helper', 
    'Packing Staff', 
    'Security Guard'
  ],
  'Logistics': [
    'Fleet Maintainer', 
    'Fleet Planner', 
    'Driver', 
    'Fleet Helper'
  ],
  'HR': [
    'HR Manager', 
    'Accountant'
  ]
};

/**
 * List of all modules that can be toggled as permissions for users.
 * Future modules added here will auto-appear in the User Management UI.
 */
export const APP_PERMISSIONS = [
  "Attendance",
  "Approvals",
  "Employees",
  "Payroll",
  "Vouchers",
  "Holidays",
  "Reports",
  "Settings",
  "Users"
];
