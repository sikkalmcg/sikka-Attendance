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
  PF_EMPLOYEE_RATE: 12,
  PF_EMPLOYER_RATE: 13,
  ESIC_EMPLOYEE_RATE: 0.75,
  ESIC_EMPLOYER_RATE: 3.25,
};

export const DEPARTMENTS = [
  'HR Department',
  'Logistics Department',
  'Warehouse Department',
  'Maintenance Department',
  'Security Department'
];

export const DESIGNATIONS: Record<string, string[]> = {
  'HR Department': [
    'HR Executive', 
    'HR Coordinator', 
    'Payroll Executive'
  ],
  'Logistics Department': [
    'Route Planner', 
    'Logistics Executive', 
    'Dispatch Executive', 
    'Booking Executive', 
    'Tracking Executive'
  ],
  'Warehouse Department': [
    'Warehouse Manager', 
    'Dispatch Planner', 
    'Safety Officer', 
    'Supervisor', 
    'Invoice Executive', 
    'Inventory Executive', 
    'Operator', 
    'Senior Operator', 
    'Technician', 
    'Quality Inspector', 
    'Quality Analyst', 
    'Helper', 
    'Packing Staff'
  ],
  'Maintenance Department': [
    'Maintenance Manager', 
    'Maintenance Supervisor', 
    'Technician', 
    'Electrician', 
    'Mechanic', 
    'Helper'
  ],
  'Security Department': [
    'Security Manager', 
    'Security Guard', 
    'Gate Keeper'
  ]
};

export const APP_PERMISSIONS = [
  "Attendance",
  "Approvals",
  "Leave Approvals",
  "Employees",
  "Payroll",
  "Vouchers",
  "Holidays",
  "Reports",
  "Activity",
  "Settings",
  "Users"
];
