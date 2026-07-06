// === नीचे ये मिसिंग कॉन्स्टेंट्स जोड़ें ===

// 1. Statutory Rates (इसमें PF_EMPLOYEE_RATE होना अनिवार्य है)
export const STATUTORY_RATES = {
  PF_EMPLOYEE_RATE: 0.12, // उदाहरण के लिए 12% (अपने हिसाब से बदल लें)
  PF_EMPLOYER_RATE: 0.12,
  ESI_EMPLOYEE_RATE: 0.0075,
  ESI_EMPLOYER_RATE: 0.0325,
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
  email: "admin@sikka.com", // अपनी सही ईमेल डालें
  role: "SUPER_ADMIN",
};