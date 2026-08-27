// === नीचे ये मिसिंग कॉन्स्टेंट्स जोड़ें ===

// 1. Statutory Rates
export const STATUTORY_RATES = {
  PF_EMPLOYEE_RATE: 0.12,
  PF_EMPLOYER_RATE: 0.12,
  ESI_EMPLOYEE_RATE: 0.0075,
  ESI_EMPLOYER_RATE: 0.0325,
  ESIC_EMPLOYEE_RATE: 0.0075,
  ESIC_EMPLOYER_RATE: 0.0325,
};

// 2. Departments
export const DEPARTMENTS = [
  "HR",
  "Operations",
  "Sales",
  "IT",
  "Finance"
] as const;

// 3. Designations
export const DESIGNATIONS = [
  "Manager",
  "Developer",
  "Executive",
  "Analyst",
  "Team Lead"
] as const;

// 4. App Permissions
export const APP_PERMISSIONS = {
  VIEW_DASHBOARD: "view:dashboard",
  MANAGE_EMPLOYEES: "manage:employees",
  MANAGE_ATTENDANCE: "manage:attendance",
  MANAGE_SETTINGS: "manage:settings",
};

// 5. Super Admin User
export const SUPER_ADMIN_USER = {
  username: "admin",
  password: "admin@password123",
  email: "admin@sikka.com",
  role: "SUPER_ADMIN",
};