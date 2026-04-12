# **App Name**: SikkaTrack HR

## Core Features:

- Secure User Authentication: Robust login system with JWTs, role-based access control, and a non-editable SUPER ADMIN user, securing employee and administrative functions.
- Employee & Salary Management: Create, view, update, and deactivate employee profiles including personal details (Aadhaar, PAN) and granular salary structure with a history of changes.
- GPS-Based Attendance Tracking: Employees mark 'IN' and 'OUT' with GPS location validation against configured plant radii. Automatically calculates working hours and attendance status (Present, Half Day, Absent) and auto-logs OUT after 16 hours.
- Attendance Approval Workflow: Admins/HR can view pending attendance records, approve, reject with remarks, or edit IN/OUT times. Approved records lock from further editing.
- Automated Payroll Generation: Calculates monthly payroll based on approved attendance and employee salary structures, including Indian statutory compliance (PF, ESIC). Ensures unique payroll numbers and prevents double generation.
- Firm & Plant Configuration: Set up multiple firms with their statutory details and define plants with names, GPS locations, and allowed radii for attendance validation.
- Natural Language Reporting Tool: An AI tool that generates natural language summaries and insights from complex attendance and payroll data, assisting HR in quick analysis and decision-making.

## Style Guidelines:

- Primary color: A confident and professional deep blue (#1C6FE0) for main calls to action, important headers, and active states.
- Background color: A subtle, light blue-gray (#F3F6F8) that promotes clarity and ease of reading for data-heavy interfaces.
- Accent color: A vibrant, clear cyan (#33CEE7) used for highlighting key information, alerts, and secondary interactive elements, ensuring visual differentiation.
- Body and headline font: 'Inter' (sans-serif) for its modern, neutral, and highly readable characteristics suitable for data-intensive enterprise applications.
- Code font: 'Source Code Pro' (monospace) to clearly present any technical or code-related information where monospacing is beneficial for clarity.
- Use a consistent set of modern, clear, and professional icons that provide intuitive visual cues for navigation, actions, and status indications throughout the HRMS.
- Employ a responsive and structured layout emphasizing data clarity and user efficiency. Utilize clean tables, forms, and a consistent dashboard approach for key information access.
- Subtle and functional animations for user feedback, such as loading states, success messages, and transitions between data views, to enhance the user experience without distraction.