export type Language = 'en' | 'hi';

export interface Translations {
  // Navigation / Header
  markAttendance: string;
  gatewayPortal: string;
  employeeName: string;
  currentLocation: string;
  capturingAddress: string;
  fetchingGps: string;
  allowLocation: string;
  locationPermissionRequired: string;
  allowLocationPrompt: string;
  liveClock: string;

  // Action Buttons
  markIn: string;
  markInSession2: string;
  twoSessionsUsed: string;
  markOut: string;
  markOutLocked: string;
  confirmAndMarkOut: string;
  confirmAndMarkIn: string;
  cancel: string;
  processing: string;

  // Shift & Session Status Messages
  dailyLimitReachedTitle: string;
  dailyLimitReachedDesc: string;
  session2Available: string;
  session2Of2: string;
  session2Desc: string;
  max8hAutoOut: string;
  autoOutThreshold8h: string;
  autoOutThreshold16h: string;
  maxAutoOut8h: string;
  maxAutoOut16h: string;
  activeShiftSince: (session: number, timeStr: string) => string;
  markOutAvailableAt: (timeStr: string, autoThreshold?: string) => string;
  restPeriodActive: string;
  markInAvailableAt: (timeStr: string) => string;
  activeShiftInProgress: (session: number) => string;
  shiftStarted: (dateStr: string, timeStr: string, autoThreshold?: string) => string;
  session1Completed: (hoursStr: string) => string;
  eligibleForMarkIn: string;
  maximumSessionsCompleted: (totalHoursStr: string) => string;

  // History & Table Headers
  myAttendanceHistory: string;
  displayingDays: (startStr: string, endStr: string) => string;
  rolling62Days: string;
  syncingHistory: string;
  date: string;
  plantType: string;
  inTime: string;
  outTime: string;
  inAddress: string;
  outAddress: string;
  workingHours: string;
  remarks: string;
  status: string;

  // Monthly Summary
  monthlySummary: string;
  currentAndPreviousMonths: string;
  month: string;
  present: string;
  absent: string;
  worked: string;

  // Leave Form & History
  applyForLeave: string;
  submitLeaveDesc: string;
  leaveHistory: (fyLabel: string) => string;
  monthWiseApprovedLeaves: (startStr: string, endStr: string) => string;
  approvedRecordsOnly: string;
  newLeaveRequest: string;
  fillLeaveDetails: string;
  leavePurpose: string;
  fromDate: string;
  toDate: string;
  totalLeave: string;
  leaveDates: string;
  totalLeaveDays: string;
  remarkOptional: string;
  submitRequest: string;
  noApprovedLeaves: (fyLabel: string) => string;
  approvedBy: string;
  daysUnit: string;
  leaveUnit: string;
  leavesUnit: string;

  // Status Badges
  statusActiveShift: string;
  statusCompletedShift: string;
  statusAutoClosedShift: string;
  statusApprovedLeave: string;
  statusWeeklyOff: string;
  statusHoliday: string;
  statusAbsent: string;
  statusPresent: string;
  statusApproved: string;

  // Dialogs & Confirmations
  markInConfirmation: string;
  markOutConfirmation: string;
  dateAndTime: string;
  gpsAccuracy: string;
  coordinates: string;
  currentLocationGps: string;
  capturingAddressBounds: string;
  fetchingAddress: string;
  selectAttendanceMode: string;
  metersUnit: string;
  inPlantZone: string;
  outsidePlantZone: string;
  fieldWork: string;
  workFromHome: string;
  wfh: string;

  // Notifications
  notifications: string;
  unread: string;
  readAll: string;
  clearAll: string;
  noNotifications: string;
  noNotificationsDesc: string;

  // Reminder Messages
  dayMarkInReminder: (name: string) => string;
  dayMarkOutReminder: (name: string) => string;
  nightMarkInReminder: (name: string) => string;
  nightMarkOutReminder: (name: string) => string;
}

export const translations: Record<Language, Translations> = {
  en: {
    markAttendance: "Mark Attendance",
    gatewayPortal: "Gateway Portal",
    employeeName: "Employee Name",
    currentLocation: "Current Location",
    capturingAddress: "Capturing address...",
    fetchingGps: "Fetching GPS...",
    allowLocation: "Allow Location",
    locationPermissionRequired: "Please allow location access to mark attendance.",
    allowLocationPrompt: "Location permission is required to verify plant proximity.",
    liveClock: "Live Clock",

    markIn: "Mark IN",
    markInSession2: "Mark IN (Session 2)",
    twoSessionsUsed: "2 Sessions Used",
    markOut: "Mark OUT",
    markOutLocked: "Mark OUT (Locked)",
    confirmAndMarkOut: "CONFIRM & MARK OUT",
    confirmAndMarkIn: "CONFIRM & MARK IN",
    cancel: "CANCEL",
    processing: "PROCESSING...",

    dailyLimitReachedTitle: "Daily Attendance Limit Reached",
    dailyLimitReachedDesc: "You have already used the maximum 2 attendance sessions allowed for today.",
    session2Available: "Session 2 of 2 Available",
    session2Of2: "Session 2 of 2",
    session2Desc: "Available • Requires 700m Plant Proximity (or Field/WFH)",
    max8hAutoOut: "Max 8h Auto OUT (4h Credit)",
    autoOutThreshold8h: "8h (4h Credit)",
    autoOutThreshold16h: "16h (8h Credit)",
    maxAutoOut8h: "8h (4h Credit)",
    maxAutoOut16h: "16h (8h Credit)",
    activeShiftSince: (session, timeStr) => `ACTIVE SHIFT (SESSION ${session} OF 2) SINCE ${timeStr}`,
    markOutAvailableAt: (timeStr, autoThreshold) => `Mark OUT will be available on ${timeStr} (2h Minimum Rule)${autoThreshold ? ` • Auto OUT threshold: ${autoThreshold}` : ''}`,
    restPeriodActive: "Rest Period Active (1h Cooldown)",
    markInAvailableAt: (timeStr) => `Mark IN will be available at ${timeStr}`,
    activeShiftInProgress: (session) => `Active Shift (Session ${session} of 2) in Progress`,
    shiftStarted: (dateStr, timeStr, autoThreshold) => `SHIFT STARTED: ${dateStr} ${timeStr}${autoThreshold ? ` • Max Auto OUT: ${autoThreshold}` : ''}`,
    session1Completed: (hoursStr) => `Session 1 Completed (${hoursStr}) • Session 2 of 2 Available`,
    eligibleForMarkIn: "Eligible for Mark IN (Session 1 of 2)",
    maximumSessionsCompleted: (totalHoursStr) => `Maximum 2 Sessions Completed Today (Daily Total: ${totalHoursStr})`,

    myAttendanceHistory: "My Attendance History",
    displayingDays: (startStr, endStr) => `Displaying your previous 62 days (${startStr} to ${endStr})`,
    rolling62Days: "Rolling 62-Day Period",
    syncingHistory: "Syncing Attendance History...",
    date: "Date",
    plantType: "Plant / Type",
    inTime: "In Time",
    outTime: "Out Time",
    inAddress: "In Address",
    outAddress: "Out Address",
    workingHours: "Hours",
    remarks: "Remarks",
    status: "Status",

    monthlySummary: "Monthly Summary",
    currentAndPreviousMonths: "Current & Previous 2 Months",
    month: "Month",
    present: "Present",
    absent: "Absent",
    worked: "Worked",

    applyForLeave: "Apply for Leave",
    submitLeaveDesc: "Submit a new leave application for managerial review.",
    leaveHistory: (fyLabel) => `Leave History (${fyLabel})`,
    monthWiseApprovedLeaves: (startStr, endStr) => `Month-wise approved leaves for current Financial Year (${startStr} to ${endStr})`,
    approvedRecordsOnly: "Approved Records Only",
    newLeaveRequest: "New Leave Request",
    fillLeaveDetails: "Fill in the details below to apply for leave.",
    leavePurpose: "Leave Purpose / Type",
    fromDate: "From Date",
    toDate: "To Date",
    totalLeave: "Total Leave",
    leaveDates: "Leave Dates",
    totalLeaveDays: "Total Leave Days",
    remarkOptional: "Remark (Optional, Max 20 words)",
    submitRequest: "Submit Request",
    noApprovedLeaves: (fyLabel) => `No approved leave records found for current Financial Year (${fyLabel}).`,
    approvedBy: "Approved By",
    daysUnit: "Day(s)",
    leaveUnit: "Leave",
    leavesUnit: "Leave",

    statusActiveShift: "Active Shift",
    statusCompletedShift: "Completed Shift",
    statusAutoClosedShift: "Auto Closed Shift",
    statusApprovedLeave: "Approved Leave",
    statusWeeklyOff: "Weekly Off",
    statusHoliday: "Holiday",
    statusAbsent: "Absent",
    statusPresent: "Present",
    statusApproved: "Approved",

    markInConfirmation: "Mark IN Confirmation",
    markOutConfirmation: "Mark OUT Confirmation",
    dateAndTime: "Date & Time",
    gpsAccuracy: "GPS Accuracy",
    coordinates: "Coordinates",
    currentLocationGps: "Current Location (GPS)",
    capturingAddressBounds: "Capturing real-time address bounds...",
    fetchingAddress: "Fetching real-time address...",
    selectAttendanceMode: "Select Attendance Mode (Mandatory):",
    metersUnit: "meters",
    inPlantZone: "Inside Plant Zone",
    outsidePlantZone: "Outside Plant Zone",
    fieldWork: "Field Work",
    workFromHome: "Work From Home",
    wfh: "Work From Home",

    notifications: "Notifications",
    unread: "unread",
    readAll: "Read all",
    clearAll: "Clear all",
    noNotifications: "No notifications yet",
    noNotificationsDesc: "We'll alert you when there are updates.",

    dayMarkInReminder: (name) => `${name} – Hope you are now on working. Please mark IN attendance.`,
    dayMarkOutReminder: (name) => `${name} – Now you are on working. Please mark OUT before leave plant.`,
    nightMarkInReminder: (name) => `${name} – Hope you are now on working. Please mark IN attendance.`,
    nightMarkOutReminder: (name) => `${name} – Now you are on working. Please mark OUT before leave plant.`,
  },
  hi: {
    markAttendance: "उपस्थिति दर्ज करें",
    gatewayPortal: "गेटवे पोर्टल",
    employeeName: "कर्मचारी का नाम",
    currentLocation: "वर्तमान स्थान",
    capturingAddress: "स्थान प्राप्त किया जा रहा है...",
    fetchingGps: "जीपीएस प्राप्त हो रहा है...",
    allowLocation: "लोकेशन की अनुमति दें",
    locationPermissionRequired: "कृपया उपस्थिति दर्ज करने के लिए लोकेशन की अनुमति दें।",
    allowLocationPrompt: "प्लांट की निकटता सत्यापित करने के लिए लोकेशन की अनुमति आवश्यक है।",
    liveClock: "लाइव घड़ी",

    markIn: "इन दर्ज करें",
    markInSession2: "इन दर्ज करें (सत्र 2)",
    twoSessionsUsed: "2 सत्र पूर्ण",
    markOut: "आउट दर्ज करें",
    markOutLocked: "आउट दर्ज करें (लॉक)",
    confirmAndMarkOut: "पुष्टि करें और आउट दर्ज करें",
    confirmAndMarkIn: "पुष्टि करें और इन दर्ज करें",
    cancel: "रद्द करें",
    processing: "प्रक्रिया जारी है...",

    dailyLimitReachedTitle: "दैनिक उपस्थिति सीमा समाप्त",
    dailyLimitReachedDesc: "आपने आज के लिए अनुमत अधिकतम 2 उपस्थिति सत्र पहले ही उपयोग कर लिए हैं।",
    session2Available: "सत्र 2 उपलब्ध है",
    session2Of2: "सत्र 2 / 2",
    session2Desc: "उपलब्ध • 700 मीटर प्लांट निकटता (या फील्ड/वर्क फ्रॉम होम) आवश्यक है",
    max8hAutoOut: "अधिकतम 8 घंटे स्वतः आउट (4 घंटे क्रेडिट)",
    autoOutThreshold8h: "8 घंटे (4 घंटे क्रेडिट)",
    autoOutThreshold16h: "16 घंटे (8 घंटे क्रेडिट)",
    maxAutoOut8h: "8 घंटे (4 घंटे क्रेडिट)",
    maxAutoOut16h: "16 घंटे (8 घंटे क्रेडिट)",
    activeShiftSince: (session, timeStr) => `सक्रिय शिफ्ट (सत्र ${session}/2) शुरू: ${timeStr}`,
    markOutAvailableAt: (timeStr, autoThreshold) => `आउट दर्ज करना ${timeStr} पर उपलब्ध होगा (2 घंटे का नियम)${autoThreshold ? ` • स्वतः आउट: ${autoThreshold}` : ''}`,
    restPeriodActive: "विश्राम अवधि सक्रिय (1 घंटा कूलडाउन)",
    markInAvailableAt: (timeStr) => `इन दर्ज करना ${timeStr} पर उपलब्ध होगा`,
    activeShiftInProgress: (session) => `सक्रिय शिफ्ट (सत्र ${session}/2) प्रगति पर है`,
    shiftStarted: (dateStr, timeStr, autoThreshold) => `शिफ्ट प्रारंभ: ${dateStr} ${timeStr}${autoThreshold ? ` • अधिकतम स्वतः आउट: ${autoThreshold}` : ''}`,
    session1Completed: (hoursStr) => `सत्र 1 पूर्ण (${hoursStr}) • सत्र 2 उपलब्ध है`,
    eligibleForMarkIn: "इन दर्ज करने के लिए पात्र (सत्र 1/2)",
    maximumSessionsCompleted: (totalHoursStr) => `आज अधिकतम 2 सत्र पूर्ण हुए (कुल कार्य: ${totalHoursStr})`,

    myAttendanceHistory: "उपस्थिति इतिहास",
    displayingDays: (startStr, endStr) => `आपके पिछले 62 दिन प्रदर्शित हो रहे हैं (${startStr} से ${endStr})`,
    rolling62Days: "62-दिन की अवधि",
    syncingHistory: "उपस्थिति इतिहास सिंक हो रहा है...",
    date: "दिनांक",
    plantType: "प्लांट / प्रकार",
    inTime: "इन समय",
    outTime: "आउट समय",
    inAddress: "इन का पता",
    outAddress: "आउट का पता",
    workingHours: "कार्य घंटे",
    remarks: "टिप्पणी",
    status: "स्थिति",

    monthlySummary: "मासिक सारांश",
    currentAndPreviousMonths: "वर्तमान और पिछले 2 महीने",
    month: "महीना",
    present: "उपस्थित",
    absent: "अनुपस्थित",
    worked: "कार्य किया",

    applyForLeave: "छुट्टी के लिए आवेदन करें",
    submitLeaveDesc: "प्रबंधकीय समीक्षा के लिए एक नया अवकाश आवेदन जमा करें।",
    leaveHistory: (fyLabel) => `छुट्टी इतिहास (${fyLabel})`,
    monthWiseApprovedLeaves: (startStr, endStr) => `वर्तमान वित्तीय वर्ष के लिए स्वीकृत अवकाश (${startStr} से ${endStr})`,
    approvedRecordsOnly: "केवल स्वीकृत रिकॉर्ड",
    newLeaveRequest: "नया छुट्टी आवेदन",
    fillLeaveDetails: "अवकाश के लिए आवेदन करने के लिए नीचे दिए गए विवरण भरें।",
    leavePurpose: "छुट्टी का कारण / प्रकार",
    fromDate: "प्रारंभ दिनांक",
    toDate: "अंतिम दिनांक",
    totalLeave: "कुल छुट्टी",
    leaveDates: "छुट्टी की तिथियां",
    totalLeaveDays: "कुल छुट्टी के दिन",
    remarkOptional: "टिप्पणी (वैकल्पिक, अधिकतम 20 शब्द)",
    submitRequest: "आवेदन जमा करें",
    noApprovedLeaves: (fyLabel) => `वर्तमान वित्तीय वर्ष (${fyLabel}) के लिए कोई स्वीकृत अवकाश रिकॉर्ड नहीं मिला।`,
    approvedBy: "स्वीकृत कर्ता",
    daysUnit: "दिन",
    leaveUnit: "छुट्टी",
    leavesUnit: "छुट्टी",

    statusActiveShift: "सक्रिय शिफ्ट",
    statusCompletedShift: "पूर्ण शिफ्ट",
    statusAutoClosedShift: "स्वचालित बंद",
    statusApprovedLeave: "स्वीकृत अवकाश",
    statusWeeklyOff: "साप्ताहिक अवकाश",
    statusHoliday: "छुट्टी",
    statusAbsent: "अनुपस्थित",
    statusPresent: "उपस्थित",
    statusApproved: "स्वीकृत",

    markInConfirmation: "इन दर्ज करने की पुष्टि",
    markOutConfirmation: "आउट दर्ज करने की पुष्टि",
    dateAndTime: "दिनांक और समय",
    gpsAccuracy: "जीपीएस सटीकता",
    coordinates: "निर्देशांक",
    currentLocationGps: "वर्तमान स्थान (जीपीएस)",
    capturingAddressBounds: "रीयल-टाइम पता प्राप्त किया जा रहा है...",
    fetchingAddress: "रीयल-टाइम पता प्राप्त किया जा रहा है...",
    selectAttendanceMode: "उपस्थिति मोड चुनें (अनिवार्य):",
    metersUnit: "मीटर",
    inPlantZone: "प्लांट क्षेत्र के अंदर",
    outsidePlantZone: "प्लांट क्षेत्र से बाहर",
    fieldWork: "फील्ड कार्य",
    workFromHome: "वर्क फ्रॉम होम",
    wfh: "वर्क फ्रॉम होम (घर से कार्य)",

    notifications: "सूचनाएं",
    unread: "अपठित",
    readAll: "सभी पढ़ें",
    clearAll: "सभी हटाएं",
    noNotifications: "कोई सूचना नहीं",
    noNotificationsDesc: "अपडेट आने पर हम आपको सूचित करेंगे।",

    dayMarkInReminder: (name) => `${name} – आशा है कि आप अब कार्य पर हैं। कृपया अपनी उपस्थिति के लिए इन दर्ज करें।`,
    dayMarkOutReminder: (name) => `${name} – अब आप कार्य पर हैं। प्लांट छोड़ने से पहले कृपया आउट दर्ज करें।`,
    nightMarkInReminder: (name) => `${name} – आशा है कि आप अब कार्य पर हैं। कृपया अपनी उपस्थिति के लिए इन दर्ज करें।`,
    nightMarkOutReminder: (name) => `${name} – अब आप कार्य पर हैं। प्लांट छोड़ने से पहले कृपया आउट दर्ज करें।`,
  }
};

export function getTranslation(lang: string | undefined | null): Translations {
  const normalized = (lang || 'en').toLowerCase().trim();
  if (normalized === 'hi' || normalized === 'hindi') {
    return translations.hi;
  }
  return translations.en;
}
