
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  MapPin, 
  Clock, 
  ShieldCheck, 
  History,
  Calendar,
  Loader2,
  Building2,
  Navigation,
  ChevronLeft,
  ChevronRight,
  Pencil,
  AlertCircle,
  ShieldAlert,
  Lock,
  MessageCircle,
  SendHorizontal,
  FileText,
  Plus,
  Info,
  X,
  Factory,
  Briefcase,
  Home,
  Bell,
  ArrowRightCircle,
  Search
} from "lucide-react";
import { calculateDistance, cn, formatDate, getWorkingHoursColor, getDeviceId, formatHoursToHHMM } from "@/lib/utils";
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableRow, 
  TableHead, 
  TableCell 
} from "@/components/ui/table";
import { AttendanceRecord, Plant, LeaveRequest } from "@/lib/types";
import { useData } from "@/context/data-context";
import { format, subDays, eachDayOfInterval, isSunday, isSameDay, parseISO, addHours, differenceInHours, isAfter, startOfDay, differenceInDays, addDays, isWithinInterval, differenceInMinutes, isValid, isBefore } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ATTENDANCE_RULES } from "@/lib/constants";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const GOOGLE_API_KEY = "AIzaSyC_G7Iog7OdQvs2owQ8IBDSIZwF2l8Mnjk";
const PROJECT_START_DATE_STR = "2026-04-01";

const getISTTime = () => {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
};

export default function AttendancePage() {
  const { attendanceRecords, leaveRequests, addRecord, updateRecord, plants, holidays, employees, notifications } = useData();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [activeDialog, setActiveDialog] = useState<"NONE" | "IN" | "OUT" | "LEAVE">("NONE");
  
  const [currentGPS, setCurrentGPS] = useState<{ lat: number, lng: number } | null>(null);
  const [detectedPlant, setDetectedPlant] = useState<Plant | null>(null);
  const [detectedAddress, setDetectedAddress] = useState("");
  const [selectedType, setSelectedType] = useState<"FIELD" | "WFH">("FIELD");

  const [leaveType, setLeaveType] = useState<"DAYS" | "HALF_DAY">("DAYS");
  const [leaveFrom, setLeaveFrom] = useState("");
  const [leaveTo, setLeaveTo] = useState("");
  const [reachTime, setReachTime] = useState("");
  const [leavePurpose, setLeavePurpose] = useState("");
  const [isSubmittingLeave, setIsSubmittingLeave] = useState(false);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedRecordToEdit, setSelectedRecordToEdit] = useState<any>(null);
  const [editTimes, setEditTimes] = useState({ in: "", out: "" });
  const [isProcessing, setIsProcessing] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 15;

  // Notification Reminder States
  const [reminderReadAt, setReminderReadAt] = useState<number | null>(null);
  const [isReminderPopoverOpen, setIsReminderPopoverOpen] = useState(false);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);

  // Column Filters
  const [columnFilters, setColumnFilters] = useState({
    name: '',
    inPlant: '',
    inTime: '',
    outTime: '',
    type: '',
    status: '',
    hours: '',
    approval: ''
  });

  const { toast } = useToast();

  // Helper for device notifications
  const triggerNotification = useCallback((title: string, body: string) => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        new Notification(title, { body, icon: "https://sikkaenterprises.com/assets/images/Capture13.51191245_std.JPG" });
      }
    }
  }, []);

  useEffect(() => {
    setIsMounted(true);
    const savedUser = localStorage.getItem("user");
    if (savedUser) setCurrentUser(JSON.parse(savedUser));
    
    setCurrentTime(getISTTime());
    const timer = setInterval(() => setCurrentTime(getISTTime()), 1000);

    // Request notification permission
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }

    return () => clearInterval(timer);
  }, []);

  const todayStr = useMemo(() => {
    if (!isMounted) return "";
    return format(getISTTime(), "yyyy-MM-dd");
  }, [isMounted]);

  const isAdminRole = useMemo(() => {
    return currentUser && ['SUPER_ADMIN', 'ADMIN', 'HR'].includes(currentUser.role);
  }, [currentUser]);

  const registeredEmployee = useMemo(() => {
    if (!currentUser || !employees || employees.length === 0) return null;
    const loginIdent = currentUser.username?.replace(/\s/g, '');
    return employees.find(e => {
      const empAadhaar = e.aadhaar?.replace(/\s/g, '');
      const empMobile = e.mobile?.replace(/\s/g, '');
      return empAadhaar === loginIdent || empMobile === loginIdent;
    });
  }, [currentUser, employees]);

  const isAccessAllowed = useMemo(() => {
    const currentDevice = getDeviceId();
    const isEmployee = currentUser?.role === 'EMPLOYEE';
    const hasEmployeeRecord = !!registeredEmployee && registeredEmployee.active;
    
    const isBoundDevice = !registeredEmployee?.deviceId || registeredEmployee.deviceId === currentDevice;
    
    return isEmployee && hasEmployeeRecord && isBoundDevice;
  }, [currentUser, registeredEmployee]);

  const effectiveEmployeeId = useMemo(() => {
    return registeredEmployee?.employeeId || currentUser?.username || "N/A";
  }, [registeredEmployee, currentUser]);

  const effectiveEmployeeName = useMemo(() => {
    return registeredEmployee?.name || currentUser?.fullName || "Employee Name";
  }, [registeredEmployee, currentUser]);

  const employeeRecords = useMemo(() => {
    if (!effectiveEmployeeId) return [];
    return (attendanceRecords || []).filter(r => r.employeeId === effectiveEmployeeId && r.date >= PROJECT_START_DATE_STR);
  }, [attendanceRecords, effectiveEmployeeId]);

  const myLeaveRequests = useMemo(() => {
    if (!effectiveEmployeeId || !isMounted) return [];
    const now = getISTTime();
    
    return (leaveRequests || [])
      .filter(l => {
        if (l.employeeId !== effectiveEmployeeId) return false;
        if (l.fromDate < PROJECT_START_DATE_STR) return false;
        const cleanupDate = addDays(parseISO(l.toDate), 7);
        if (isAfter(now, cleanupDate)) return false;
        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [leaveRequests, effectiveEmployeeId, isMounted]);

  const activeRecord = useMemo(() => {
    return (employeeRecords || []).find(r => !r.outTime);
  }, [employeeRecords]);

  useEffect(() => {
    if (isMounted && effectiveEmployeeId && todayStr) {
      const stored = localStorage.getItem(`read_reminder_${effectiveEmployeeId}_${todayStr}`);
      if (stored) setReminderReadAt(parseInt(stored));
    }
  }, [isMounted, effectiveEmployeeId, todayStr]);

  /**
   * REQUIREMENT: Notification for Late Attendance at 10:30 AM
   */
  const showReminderIcon = useMemo(() => {
    if (!isMounted || !isAccessAllowed || activeRecord || !currentTime || !todayStr) return false;
    if (todayStr < PROJECT_START_DATE_STR) return false;

    const currentHHMM = format(currentTime, "HH:mm");
    if (currentHHMM < "10:30") return false;

    const isSun = isSunday(currentTime);
    const isHoliday = (holidays || []).some(h => h.date === todayStr);
    if (isSun || isHoliday) return false;

    const hasInToday = (employeeRecords || []).some(r => r.date === todayStr && r.inTime);
    if (hasInToday) return false;

    const hasApprovedLeave = (myLeaveRequests || []).some(l => {
      if (l.status !== 'APPROVED') return false;
      try {
        const current = parseISO(todayStr);
        const start = parseISO(l.fromDate);
        const end = parseISO(l.toDate);
        return isWithinInterval(current, { start, end });
      } catch (e) { return false; }
    });
    if (hasApprovedLeave) return false;

    if (reminderReadAt) {
      const diffMins = (currentTime.getTime() - reminderReadAt) / (1000 * 60);
      if (diffMins >= 120) return false; 
    }

    return true;
  }, [isMounted, isAccessAllowed, activeRecord, currentTime, todayStr, holidays, employeeRecords, myLeaveRequests, reminderReadAt]);

  useEffect(() => {
    if (showReminderIcon && !reminderReadAt && !hasAutoOpened) {
      setIsReminderPopoverOpen(true);
      setHasAutoOpened(true);
      
      const now = Date.now();
      setReminderReadAt(now);
      localStorage.setItem(`read_reminder_${effectiveEmployeeId}_${todayStr}`, now.toString());
      
      const notifyMsg = `${effectiveEmployeeName} hope you reached at Office. Please mark attendance`;
      
      addRecord('notifications', {
        message: notifyMsg,
        timestamp: format(new Date(), "yyyy-MM-dd HH:mm:ss"),
        read: false,
        type: 'ATTENDANCE_REMINDER',
        employeeId: currentUser?.username || effectiveEmployeeId,
        senderName: "HR System"
      });
      
      triggerNotification("Attendance Reminder", notifyMsg);
    }
  }, [showReminderIcon, reminderReadAt, hasAutoOpened, effectiveEmployeeId, todayStr, effectiveEmployeeName, addRecord, triggerNotification, currentUser]);

  /**
   * FEATURE: Auto OUT Logic
   * Trigger at 16:01 hours from IN time.
   * Recorded OUT = IN Time + 8:00 Hours (Fixed working hours cap).
   */
  useEffect(() => {
    if (activeRecord && isMounted && currentTime && isAccessAllowed) {
      const inDateTime = new Date(`${activeRecord.inDate || activeRecord.date}T${activeRecord.inTime}`);
      const diffMs = currentTime.getTime() - inDateTime.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      // Requirement: Trigger Auto OUT at 16:00 hours from IN time (using 16.0 threshold)
      if (diffHours >= 16) {
        // Recorded OUT time should be IN Time + 8:00 hours
        const autoOutDateTime = addHours(inDateTime, 8);
        const autoOutTimeStr = format(autoOutDateTime, "HH:mm");
        const autoOutDateStr = format(autoOutDateTime, "yyyy-MM-dd");
        
        updateRecord('attendance', activeRecord.id, {
          outTime: autoOutTimeStr,
          outDate: autoOutDateStr,
          hours: 8,
          status: 'PRESENT',
          autoCheckout: true,
          addressOut: 'System Auto Check-out (16h Policy Limit)',
          outPlant: activeRecord.inPlant || "Remote"
        });

        const workingHoursStr = "08:00";
        const timestamp = format(autoOutDateTime, "dd-MMM-yyyy HH:mm");
        const notifyMsg = `${effectiveEmployeeName} – OUT: ${timestamp} | Work: ${workingHoursStr} Hrs (Auto)`;
        
        addRecord('notifications', { 
          message: notifyMsg, 
          timestamp: format(new Date(), "yyyy-MM-dd HH:mm:ss"), 
          read: false,
          type: 'ATTENDANCE_OUT',
          employeeId: currentUser?.username || effectiveEmployeeId
        });
        triggerNotification("Security Auto Check-out", notifyMsg);

        toast({
          title: "Security: Auto Check-out",
          description: `Your shift has been auto-closed at ${autoOutTimeStr} as per the 16:00 Hours policy. (8h capped)`,
        });
      }
    }
  }, [activeRecord, isMounted, currentTime, isAccessAllowed, updateRecord, toast, effectiveEmployeeName, addRecord, triggerNotification, effectiveEmployeeId, currentUser]);

  const lastOutRecord = useMemo(() => {
    return [...employeeRecords]
      .filter(r => r.outTime)
      .sort((a, b) => {
        const dateTimeA = new Date(`${a.outDate || a.date}T${a.outTime}`);
        const dateTimeB = new Date(`${b.outDate || b.date}T${b.outTime}`);
        return dateTimeB.getTime() - dateTimeA.getTime();
      })[0];
  }, [employeeRecords]);

  /**
   * REQUIREMENT: Re-Enable IN Eligibility
   * Employee allowed to mark IN again only after 8:00 hours from OUT time.
   */
  const lockState = useMemo(() => {
    if (!lastOutRecord || !lastOutRecord.outTime) return { isLocked: false, unlockTime: null };
    const lastOutDateTime = new Date(`${lastOutRecord.outDate || lastOutRecord.date}T${lastOutRecord.outTime}`);
    const allowedDateTime = addHours(lastOutDateTime, 8);
    const now = getISTTime();
    const isLocked = isAfter(allowedDateTime, now);
    return { isLocked, unlockTime: isLocked ? format(allowedDateTime, "HH:mm") : null };
  }, [lastOutRecord, currentTime]);

  const handleCreateLeaveRequest = () => {
    if (!isAccessAllowed) {
      toast({ variant: "destructive", title: "Action Blocked", description: "Registration and device binding required to request leave." });
      return;
    }
    const today = format(getISTTime(), "yyyy-MM-dd");
    const startConstraint = today < PROJECT_START_DATE_STR ? PROJECT_START_DATE_STR : today;
    setLeaveType("DAYS");
    setLeaveFrom(startConstraint);
    setLeaveTo(startConstraint);
    setReachTime("");
    setLeavePurpose("");
    setActiveDialog("LEAVE");
  };

  const handleSendLeaveRequest = () => {
    if (!effectiveEmployeeId || effectiveEmployeeId === "N/A") {
      toast({ variant: "destructive", title: "Identity Error", description: "Could not identify employee record." });
      return;
    }

    const istNow = getISTTime();
    const today = format(istNow, "yyyy-MM-dd");
    
    setIsSubmittingLeave(true);
    try {
      const newFrom = parseISO(leaveType === "DAYS" ? leaveFrom : today);
      const newTo = parseISO(leaveType === "DAYS" ? leaveTo : today);
      const diff = differenceInDays(newTo, newFrom) + 1;
      const daysCount = leaveType === "DAYS" ? diff : 0.5;

      const newLeave: any = {
        employeeId: effectiveEmployeeId,
        employeeName: effectiveEmployeeName,
        department: registeredEmployee?.department || "N/A",
        designation: registeredEmployee?.designation || "N/A",
        fromDate: format(newFrom, "yyyy-MM-dd"),
        toDate: format(newTo, "yyyy-MM-dd"),
        days: daysCount,
        purpose: leavePurpose,
        status: 'UNDER_PROCESS',
        leaveType: leaveType,
        createdAt: new Date().toISOString()
      };

      addRecord('leaveRequests', newLeave);
      
      addRecord('notifications', {
        message: `Leave Request submitted: ${effectiveEmployeeName} (${daysCount} Day/s)`,
        timestamp: format(new Date(), "yyyy-MM-dd HH:mm:ss"),
        read: false,
        type: 'LEAVE_SUBMISSION',
        employeeId: effectiveEmployeeId
      });

      toast({ title: "Request Sent", description: "Your leave application has been submitted successfully." });
      setActiveDialog("NONE");
    } catch (error: any) {
      toast({ variant: "destructive", title: "System Error", description: error.message || "Could not submit request." });
    } finally {
      setIsSubmittingLeave(false);
    }
  };

  const requestLocation = (type: "IN" | "OUT") => {
    if (!isAccessAllowed) {
      toast({ variant: "destructive", title: "Access Denied", description: "You must use your registered device." });
      return;
    }

    if (todayStr < PROJECT_START_DATE_STR) {
      toast({ variant: "destructive", title: "System Offline", description: `Service starts from ${PROJECT_START_DATE_STR}.` });
      return;
    }

    setIsLoadingLocation(true);
    if (!("geolocation" in navigator)) {
      toast({ variant: "destructive", title: "GPS Error", description: "Browser does not support geolocation." });
      setIsLoadingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setCurrentGPS({ lat, lng });
        const plant = (plants || []).find(p => calculateDistance(lat, lng, p.lat, p.lng) <= (p.radius || 700));
        setDetectedPlant(plant || null);
        
        try {
          const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_API_KEY}`);
          const data = await response.json();
          setDetectedAddress(data.status === "OK" ? data.results[0].formatted_address : "Unknown Location");
        } catch (e) {
          setDetectedAddress("Coordinates Captured");
        }
        
        setIsLoadingLocation(false);
        setActiveDialog(type);
      },
      (err) => {
        toast({ variant: "destructive", title: "GPS Error", description: "Location access denied." });
        setIsLoadingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleConfirmCheckIn = () => {
    if (!currentUser || !currentGPS || !isAccessAllowed) return;
    const now = getISTTime();
    const today = format(now, "yyyy-MM-dd");
    const timestamp = format(now, "dd-MMM-yyyy HH:mm");

    const newRecord: Partial<AttendanceRecord> = {
      employeeId: effectiveEmployeeId,
      employeeName: effectiveEmployeeName,
      date: today,
      inDate: today,
      inTime: format(now, "HH:mm"),
      outTime: null,
      hours: 0,
      status: 'PRESENT',
      attendanceType: detectedPlant ? 'OFFICE' : selectedType,
      lat: currentGPS.lat,
      lng: currentGPS.lng,
      address: detectedAddress,
      inPlant: detectedPlant?.name || "Remote",
      approved: false,
      unapprovedOutDuration: 0
    };

    addRecord('attendance', newRecord);
    
    const notifyMsg = `${effectiveEmployeeName} – IN: ${timestamp}`;
    addRecord('notifications', {
      message: notifyMsg,
      timestamp: format(now, "yyyy-MM-dd HH:mm:ss"),
      read: false,
      type: 'ATTENDANCE_IN',
      employeeId: effectiveEmployeeId
    });
    triggerNotification("Attendance Marked", notifyMsg);

    setActiveDialog("NONE");
    toast({ title: "Check-In Success" });
    setIsReminderPopoverOpen(false);
  };

  const handleConfirmCheckOut = () => {
    if (!activeRecord || !currentGPS || !isAccessAllowed) return;
    const now = getISTTime();
    const timeHHMM = format(now, "HH:mm");
    const todayStrLocal = format(now, "yyyy-MM-dd");
    const timestamp = format(now, "dd-MMM-yyyy HH:mm");
    
    const inDateTime = new Date(`${activeRecord.inDate || activeRecord.date}T${activeRecord.inTime}`);
    const outDateTime = new Date(`${todayStrLocal}T${timeHHMM}`);
    const diffHours = (outDateTime.getTime() - inDateTime.getTime()) / (1000 * 60 * 60);
    
    const finalHours = parseFloat(diffHours.toFixed(2));
    const workingHoursStr = formatHoursToHHMM(finalHours);

    updateRecord('attendance', activeRecord.id, { 
      outTime: timeHHMM, 
      outDate: todayStrLocal,
      hours: finalHours,
      status: finalHours >= 1.0 ? 'PRESENT' : 'ABSENT',
      latOut: currentGPS.lat,
      lngOut: currentGPS.lng,
      addressOut: detectedAddress,
      outPlant: detectedPlant?.name || "Remote"
    });

    const notifyMsg = `${effectiveEmployeeName} – OUT: ${timestamp} | Work: ${workingHoursStr} Hrs`;
    addRecord('notifications', {
      message: notifyMsg,
      timestamp: format(now, "yyyy-MM-dd HH:mm:ss"),
      read: false,
      type: 'ATTENDANCE_OUT',
      employeeId: effectiveEmployeeId
    });
    triggerNotification("Attendance Marked", notifyMsg);

    setActiveDialog("NONE");
    toast({ title: "Check-Out Success", description: `Shift ended: ${workingHoursStr} Hrs.` });
  };

  const history = useMemo(() => {
    if (!currentUser || !isMounted) return [];
    
    const floorDate = parseISO(PROJECT_START_DATE_STR);
    const istNow = getISTTime();
    const todayStrLocal = format(istNow, "yyyy-MM-dd");

    let baseList = [];

    if (isAdminRole) {
      const actualRecords = (attendanceRecords || [])
        .filter(r => {
          try {
            const d = parseISO(r.date);
            return isValid(d) && !isBefore(d, floorDate);
          } catch (e) { return false; }
        });

      const virtualTodayRecords: any[] = [];
      if (todayStrLocal >= PROJECT_START_DATE_STR) {
        employees.filter(e => e.active).forEach(emp => {
          const hasRecord = actualRecords.some(r => r.employeeId === emp.employeeId && r.date === todayStrLocal);
          if (!hasRecord) {
            virtualTodayRecords.push({
              id: `v-today-${emp.employeeId}`,
              employeeId: emp.employeeId,
              employeeName: emp.name,
              date: todayStrLocal,
              status: 'ABSENT',
              attendanceType: '--',
              approved: true,
              hours: 0,
              inTime: null,
              outTime: null,
              isVirtual: true,
              inPlant: '--'
            });
          }
        });
      }

      baseList = [...actualRecords, ...virtualTodayRecords]
        .sort((a, b) => b.date.localeCompare(a.date) || a.employeeName.localeCompare(b.employeeName));
    } else {
      const today = startOfDay(new Date());
      const fortyFiveDaysAgo = subDays(today, 45);
      let historyStartDate = isAfter(fortyFiveDaysAgo, floorDate) ? fortyFiveDaysAgo : floorDate;
      
      const dateRange = eachDayOfInterval({ start: historyStartDate, end: today });
      baseList = dateRange.map(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const existingRecords = employeeRecords.filter(r => r.date === dateStr);
        const isSun = isSunday(date);
        const holiday = (holidays || []).find(h => h.date === dateStr);
        const nonWorkingDayLabel = isSun ? "WEEKLY_OFF" : (holiday ? "HOLIDAY" : null);

        if (existingRecords.length > 0) return existingRecords;
        if (isSameDay(date, today)) return null;
        if (isSun || holiday) return [{ id: `v-${dateStr}`, employeeId: effectiveEmployeeId, employeeName: effectiveEmployeeName, date: dateStr, status: nonWorkingDayLabel, attendanceType: '--', approved: true }];
        return [{ id: `v-${dateStr}`, employeeId: effectiveEmployeeId, employeeName: effectiveEmployeeName, date: dateStr, status: 'ABSENT', attendanceType: '--', approved: true, hours: 0 }];
      }).filter(Boolean).flat().reverse();
    }

    return baseList.filter((h: any) => {
      if (!h) return false;
      const search = columnFilters.name.toLowerCase();
      const nameMatch = h.employeeName?.toLowerCase().includes(search) || h.employeeId?.toLowerCase().includes(search);
      const statusMatch = h.status?.toLowerCase().includes(columnFilters.status.toLowerCase());
      return nameMatch && statusMatch;
    });
  }, [currentUser, attendanceRecords, holidays, effectiveEmployeeId, effectiveEmployeeName, isAdminRole, isMounted, employeeRecords, employees, columnFilters]);

  const paginatedHistory = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return history.slice(start, start + rowsPerPage);
  }, [history, currentPage]);

  const totalPages = Math.ceil(history.length / rowsPerPage);

  if (!isMounted) return null;

  return (
    <TooltipProvider>
      <div className="space-y-8 max-w-7xl mx-auto pb-12 px-4">
        {currentUser?.role === 'EMPLOYEE' && registeredEmployee && registeredEmployee.deviceId && registeredEmployee.deviceId !== getDeviceId() && (
          <Alert variant="destructive" className="bg-rose-50 border-rose-200 mb-6 shadow-lg">
            <ShieldAlert className="h-6 w-6 text-rose-600" />
            <AlertTitle className="font-black text-rose-900 text-lg">Device Security Error</AlertTitle>
            <AlertDescription className="text-rose-800 font-bold mt-1">
              Your account is linked to another device. proxy attendance is prohibited.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <Card className="shadow-2xl border-none overflow-hidden bg-white">
            <div className="h-1 bg-primary" />
            <CardHeader className="text-center py-4 relative">
              <CardTitle className="text-lg font-black flex items-center justify-center gap-2 text-slate-800">
                <ShieldCheck className="text-primary w-5 h-5" /> Gateway Portal
              </CardTitle>
              
              {showReminderIcon && (
                <div className="absolute right-4 top-2">
                  <Popover open={isReminderPopoverOpen} onOpenChange={setIsReminderPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full bg-rose-50 border border-rose-100 relative hover:bg-rose-100 transition-all shadow-sm">
                        <Bell className="w-5 h-5 text-rose-500" />
                        <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-rose-600 rounded-full border-2 border-white flex items-center justify-center animate-pulse shadow-sm" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0 rounded-2xl shadow-2xl border-rose-100 bg-white overflow-hidden" align="end" sideOffset={12}>
                      <div className="p-5 space-y-4">
                        <div className="flex items-center gap-3 pb-3 border-b border-rose-50">
                          <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center">
                            <MessageCircle className="w-6 h-6 text-rose-600" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase text-rose-400 tracking-[0.2em] leading-none mb-1">Attention</p>
                            <h4 className="text-sm font-black text-rose-900 leading-none">Attendance Reminder</h4>
                          </div>
                        </div>
                        <p className="text-sm font-bold text-rose-800 leading-relaxed italic pr-2">
                          "{effectiveEmployeeName} hope you reached at Office. Please mark attendance"
                        </p>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-6 px-6 pb-8">
              <div className="py-6 px-8 rounded-3xl bg-sky-50 text-sky-900 flex flex-col items-center justify-center space-y-1 shadow-inner border border-sky-100 max-w-[280px] mx-auto">
                {currentTime ? (<div className="text-center"><h2 className="text-5xl font-black tracking-tighter font-mono leading-none">{format(currentTime, "HH:mm")}</h2><p className="text-[11px] font-black text-sky-600/80 mt-2 flex items-center justify-center gap-1.5 uppercase tracking-widest"><Calendar className="w-3.5 h-3.5" /> {format(currentTime, "MM/dd/yyyy")}</p></div>) : (<Loader2 className="w-8 h-8 text-sky-300 animate-spin" />)}
              </div>
              <div className="flex gap-4">
                <Button className={cn("flex-1 h-14 text-sm font-black rounded-2xl shadow-lg", isAccessAllowed && !lockState.isLocked && !activeRecord ? "bg-primary hover:bg-primary/90" : "bg-slate-100 text-slate-400 cursor-not-allowed")} disabled={!isAccessAllowed || isLoadingLocation || !!activeRecord || lockState.isLocked} onClick={() => requestLocation("IN")}>Mark IN</Button>
                <Button className={cn("flex-1 h-14 text-sm font-black rounded-2xl shadow-lg", isAccessAllowed && activeRecord ? "bg-rose-500 hover:bg-rose-600" : "bg-slate-100 text-slate-400 cursor-not-allowed")} disabled={!isAccessAllowed || isLoadingLocation || !activeRecord} onClick={() => requestLocation("OUT")}>Mark OUT</Button>
              </div>
              {lockState.isLocked && (
                <p className="text-[10px] font-black text-rose-500 text-center uppercase tracking-widest bg-rose-50 py-2 rounded-lg border border-rose-100 animate-pulse">
                   Mandatory 8h Rest Period. Next IN Allowed at {lockState.unlockTime}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-xl border-none overflow-hidden bg-white h-full">
            <CardHeader className="bg-slate-50 border-b flex flex-row items-center justify-between py-4"><CardTitle className="text-sm font-bold flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Leave Requests</CardTitle><Button size="sm" className="h-8 gap-1 font-bold text-[10px] uppercase" onClick={handleCreateLeaveRequest} disabled={!isAccessAllowed}><Plus className="w-3 h-3" /> Create Request</Button></CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[240px]">
                {myLeaveRequests.length === 0 ? (<div className="p-10 text-center text-xs text-muted-foreground font-medium">No active leave records from April-2026.</div>) : (
                  <div className="divide-y divide-slate-100">{myLeaveRequests.map((l) => (
                    <div key={l.id} className="p-4 flex justify-between items-start hover:bg-slate-50 transition-colors">
                      <div className="space-y-0.5"><p className="text-xs font-bold text-slate-700">{format(parseISO(l.fromDate), 'MM/dd')} - {format(parseISO(l.toDate), 'MM/dd')}</p><p className="text-[10px] text-muted-foreground font-medium uppercase">{l.days} Day(s) • {l.purpose}</p></div>
                      <Badge className={cn("text-[9px] font-black uppercase rounded-full", l.status === 'APPROVED' ? "bg-emerald-100 text-emerald-600" : l.status === 'REJECTED' ? "bg-rose-100 text-rose-600" : "bg-blue-100 text-blue-600")}>{l.status}</Badge>
                    </div>
                  ))}</div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <h3 className="font-black text-xl flex items-center gap-2 text-slate-700"><History className="w-6 h-6 text-primary" /> {isAdminRole ? 'Staff Attendance Oversight' : 'My Attendance History'}</h3>
          <Card className="rounded-2xl overflow-hidden shadow-sm border-slate-200">
            <ScrollArea className="w-full">
              <Table className="min-w-[1000px]">
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-bold">Employee Name</TableHead>
                    <TableHead className="font-bold">In Plant</TableHead>
                    <TableHead className="font-bold">In Time</TableHead>
                    <TableHead className="font-bold">Out Time</TableHead>
                    <TableHead className="font-bold text-center">Status</TableHead>
                    <TableHead className="font-bold text-center">Hours</TableHead>
                    <TableHead className="font-bold">Approval</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedHistory.map((h: any) => (
                    <TableRow key={h.id} className={cn("hover:bg-slate-50/50", h.isVirtual && "bg-rose-50/20")}>
                      <TableCell className="text-sm font-bold uppercase">{h.employeeName}</TableCell>
                      <TableCell className="text-sm font-bold text-slate-700">{h.inPlant || "--"}</TableCell>
                      <TableCell className="font-mono text-xs">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{formatDate(h.inDate || h.date)}</span>
                          <span>{h.inTime || "--:--"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{formatDate(h.outDate || h.date)}</span>
                          <span>{h.outTime || "--:--"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center"><Badge className={cn("text-[9px] font-black uppercase tracking-widest", h.status === 'PRESENT' ? "bg-emerald-50 text-emerald-700" : h.status === 'ABSENT' ? "bg-rose-50 text-rose-700" : "bg-slate-50 text-slate-700")}>{h.status}</Badge></TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={cn("font-black text-xs px-2.5 py-0.5", getWorkingHoursColor(h.hours || 0))}>
                          {formatHoursToHHMM(h.hours || 0)}
                        </Badge>
                      </TableCell>
                      <TableCell>{h.approved ? <Badge className="bg-emerald-600 uppercase text-[9px] rounded-full">Approved</Badge> : <Badge variant="secondary" className="bg-amber-50 text-amber-600 uppercase text-[9px] rounded-full">Pending</Badge>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </Card>
        </div>

        <Dialog open={activeDialog === "IN"} onOpenChange={(o) => !o && setActiveDialog("NONE")}>
          <DialogContent className="sm:max-w-md rounded-2xl border-none shadow-2xl p-0 overflow-hidden">
            <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
              <DialogTitle className="flex items-center gap-2 font-black text-xl"><Navigation className="w-5 h-5 text-primary" /> Confirm Attendance</DialogTitle>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">{detectedAddress || "Locating..."}</p>
            </DialogHeader>
            <div className="p-8 space-y-8">
              {detectedPlant ? (
                <div className="p-6 bg-emerald-50 border-2 border-emerald-100 rounded-3xl flex items-center gap-4 shadow-sm">
                  <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-emerald-200"><Factory className="w-6 h-6 text-white" /></div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-emerald-600 tracking-[0.2em] mb-1">Authorized Plant Detected</p>
                    <p className="text-lg font-black text-emerald-900">{detectedPlant.name}</p>
                  </div>
                </div>
              ) : (
                <RadioGroup value={selectedType} onValueChange={(v: any) => setSelectedType(v)} className="grid grid-cols-2 gap-4">
                  <div className={cn("relative rounded-2xl border-2 transition-all p-4 cursor-pointer", selectedType === 'FIELD' ? "border-primary bg-primary/5" : "border-slate-100 bg-slate-50")} onClick={() => setSelectedType('FIELD')}>
                    <RadioGroupItem value="FIELD" id="field" className="absolute right-3 top-3" />
                    <Briefcase className={cn("w-6 h-6 mb-2", selectedType === 'FIELD' ? "text-primary" : "text-slate-400")} />
                    <Label htmlFor="field" className="font-black text-sm block cursor-pointer">FIELD WORK</Label>
                  </div>
                  <div className={cn("relative rounded-2xl border-2 transition-all p-4 cursor-pointer", selectedType === 'WFH' ? "border-primary bg-primary/5" : "border-slate-100 bg-slate-50")} onClick={() => setSelectedType('WFH')}>
                    <RadioGroupItem value="WFH" id="wfh" className="absolute right-3 top-3" />
                    <Home className={cn("w-6 h-6 mb-2", selectedType === 'WFH' ? "text-primary" : "text-slate-400")} />
                    <Label htmlFor="wfh" className="font-black text-sm block cursor-pointer">W.F.H</Label>
                  </div>
                </RadioGroup>
              )}
            </div>
            <DialogFooter className="p-6 bg-slate-50 border-t"><Button className="w-full h-14 rounded-2xl font-black text-lg bg-primary" onClick={handleConfirmCheckIn}>Confirm Mark IN</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={activeDialog === "OUT"} onOpenChange={(o) => !o && setActiveDialog("NONE")}>
          <DialogContent className="sm:max-w-md rounded-2xl border-none shadow-2xl p-0 overflow-hidden">
            <DialogHeader className="p-6 bg-rose-600 text-white shrink-0">
               <DialogTitle className="flex items-center gap-2 font-black text-xl">Confirm Check-Out</DialogTitle>
            </DialogHeader>
            <div className="p-8 space-y-6 text-center">
              <p className="text-sm font-black text-slate-700">{detectedPlant ? `Marking OUT from ${detectedPlant.name}` : "Marking OUT from Remote Site"}</p>
            </div>
            <DialogFooter className="p-6 bg-slate-50 border-t"><Button className="w-full h-14 rounded-2xl font-black text-lg bg-rose-500 hover:bg-rose-600" onClick={handleConfirmCheckOut}>Confirm Mark OUT</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={activeDialog === "LEAVE"} onOpenChange={(o) => !o && setActiveDialog("NONE")}>
          <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden">
            <DialogHeader className="p-6 bg-slate-900 text-white shrink-0"><DialogTitle className="text-xl font-black">Create Leave Request</DialogTitle></DialogHeader>
            <div className="p-6 space-y-6 bg-white">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Leave Type</Label>
                <Select value={leaveType} onValueChange={(v: any) => setLeaveType(v)}>
                  <SelectTrigger className="h-12 font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="DAYS">Days</SelectItem><SelectItem value="HALF_DAY">Half Day</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400">From</Label><Input type="date" value={leaveFrom} onChange={(e) => setLeaveFrom(e.target.value)} className="h-12 font-bold" /></div>
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400">To</Label><Input type="date" value={leaveTo} onChange={(e) => setLeaveTo(e.target.value)} className="h-12 font-bold" /></div>
              </div>
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400">Purpose *</Label><Input placeholder="Reason for leave..." value={leavePurpose} onChange={(e) => setLeavePurpose(e.target.value)} className="h-12 font-bold" /></div>
            </div>
            <DialogFooter className="p-6 bg-slate-50 border-t gap-3">
              <Button variant="ghost" onClick={() => setActiveDialog("NONE")} className="rounded-xl font-bold">Cancel</Button>
              <Button className="bg-primary font-black px-12 h-11" onClick={handleSendLeaveRequest} disabled={isSubmittingLeave}>Send Request</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
