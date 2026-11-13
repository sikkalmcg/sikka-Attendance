export const EMPLOYEE_ID_CARD_WIDTH = 1011;
export const EMPLOYEE_ID_CARD_HEIGHT = 638;
export const EMPLOYEE_ID_CARD_ADDRESS = 'C-17 UPSIDC Industrial Area, Vijay Nagar, Ghaziabad - 201009';
export const EMPLOYEE_ID_CARD_WEBSITE = 'www.sikkaenterprises.com';

export function buildEmployeeQrContent(employee) {
  return [
    'Company: Sikka Industries & Logistics',
    `Employee ID: ${employee.employeeId || ''}`,
    `Employee Name: ${employee.fullName || ''}`,
    `Designation: ${employee.designation || 'Staff'}`,
    `Plant: ${employee.plantName || ''}`,
    `Mobile: ${employee.mobileNumber || employee.mobile || ''}`,
    `Address: ${EMPLOYEE_ID_CARD_ADDRESS}`,
    `Website: ${EMPLOYEE_ID_CARD_WEBSITE}`,
  ].join('\n');
}
