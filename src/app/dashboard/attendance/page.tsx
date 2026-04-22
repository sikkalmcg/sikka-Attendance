
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
  const { attendanceRecords, leaveRequests, addRecord, updateRecord, plants, holidays, employees } = useData();
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

  useEffect(() => {
    if (activeRecord && isMounted && currentTime && isAccessAllowed) {
      const inDateTime = new Date(`${activeRecord.date}T${activeRecord.inTime}`);
      const diffMs = currentTime.getTime() - inDateTime.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      if (diffHours >= 16) {
        const autoOutDateTime = addHours(inDateTime, 16);
        const autoOutTimeStr = format(autoOutDateTime, "HH:mm");
        
        updateRecord('attendance', activeRecord.id, {
          outTime: autoOutTimeStr,
          hours: 8,
          status: 'PRESENT',
          autoCheckout: true,
          addressOut: 'System Auto Check-out (16h Policy Limit)',
          outPlant: activeRecord.inPlant || "Remote"
        });

        const notifyMsg = `${effectiveEmployeeName} – Auto OUT at ${autoOutTimeStr}. Policy: 16h Limit.`;
        addRecord('notifications', { 
          message: notifyMsg, 
          timestamp: format(new Date(), "yyyy-MM-dd HH:mm:ss"), 
          read: false,
          employeeId: currentUser?.username || effectiveEmployeeId
        });
        triggerNotification("Security Auto Check-out", notifyMsg);

        toast({
          title: "Security: Auto Check-out",
          description: `Your shift has been auto-closed at ${autoOutTimeStr} as per the 16:00 Hours policy.`,
        });
      }
    }
  }, [activeRecord, isMounted, currentTime, isAccessAllowed, updateRecord, toast, effectiveEmployeeName, addRecord, triggerNotification, effectiveEmployeeId, currentUser]);

  const lastOutRecord = useMemo(() => {
    return [...employeeRecords]
      .filter(r => r.outTime)
      .sort((a, b) => {
        const dateTimeA = new Date(`${a.date}T${a.outTime}`);
        const dateTimeB = new Date(`${b.date}T${b.outTime}`);
        return dateTimeB.getTime() - dateTimeA.getTime();
      })[0];
  }, [employeeRecords]);

  const lockState = useMemo(() => {
    if (!lastOutRecord || !lastOutRecord.outTime) return { isLocked: false, unlockTime: null };
    const lastOutDateTime = new Date(`${lastOutRecord.date}T${lastOutRecord.outTime}`);
    const allowedDateTime = addHours(lastOutDateTime, 8);
    const now = getISTTime();
    const isLocked = isAfter(allowedDateTime, now);
    return { isLocked, unlockTime: isLocked ? format(allowedDateTime, "HH:mm") : null };
  }, [lastOutRecord, currentTime]);

  useEffect(() => {
    if (activeRecord && isAccessAllowed) {
      const interval = setInterval(() => {
        if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition((pos) => {
            const { latitude: lat, longitude: lng } = pos.coords;
            const nearestPlant = (plants || []).find(p => calculateDistance(lat, lng, p.lat, p.lng) <= (p.radius || 700));
            
            const now = getISTTime();
            const inDateTime = new Date(`${activeRecord.date}T${activeRecord.inTime}`);
            const diffHours = (now.getTime() - inDateTime.getTime()) / (1000 * 60 * 60);

            if (!nearestPlant && activeRecord.attendanceType === 'OFFICE' && !activeRecord.lastDetectedOutAt) {
              updateRecord('attendance', activeRecord.id, { lastDetectedOutAt: format(now, "HH:mm"), lastOutCheckTime: now.toISOString() });
              addRecord('notifications', {
                message: `OUT event: ${effectiveEmployeeName} moved beyond 0.7 KM. Current hours: ${diffHours.toFixed(2)}h`,
                timestamp: format(now, "yyyy-MM-dd HH:mm:ss"),
                read: false,
                employeeId: currentUser?.username || effectiveEmployeeId
              });
            } else if (nearestPlant && activeRecord.lastDetectedOutAt) {
              const outAt = new Date(`${activeRecord.date}T${activeRecord.lastDetectedOutAt}`);
              const durationMinutes = differenceInMinutes(now, outAt);
              updateRecord('attendance', activeRecord.id, { 
                unapprovedOutDuration: (activeRecord.unapprovedOutDuration || 0) + durationMinutes,
                lastDetectedOutAt: null 
              });
            }
          });
        }
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [activeRecord, isAccessAllowed, plants, updateRecord, addRecord, effectiveEmployeeName, effectiveEmployeeId, currentUser]);

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
    const floorDate = PROJECT_START_DATE_STR;
    
    if (leaveType === "DAYS") {
      if (!leaveFrom || !leaveTo || !leavePurpose.trim()) {
        toast({ variant: "destructive", title: "Missing Fields", description: "Please provide dates and purpose." });
        return;
      }
      if (leaveFrom < today && leaveFrom < floorDate) {
        toast({ variant: "destructive", title: "Invalid Date", description: `Leave must be from ${floorDate} onwards.` });
        return;
      }
      if (leaveTo < leaveFrom) {
        toast({ variant: "destructive", title: "Validation Error", description: "From Date cannot be greater than To Date" });
        return;
      }
    } else {
      if (!reachTime || !leavePurpose.trim()) {
        toast({ variant: "destructive", title: "Missing Fields", description: "Please provide reach time and purpose." });
        return;
      }
      const currentHHMM = format(istNow, "HH:mm");
      if (reachTime <= currentHHMM) {
        toast({ variant: "destructive", title: "Invalid Time", description: "Reach time must be in the future." });
        return;
      }
    }

    const newFromDate = leaveType === "DAYS" ? leaveFrom : today;
    const newToDate = leaveType === "DAYS" ? leaveTo : today;
    const newFrom = parseISO(newFromDate);
    const newTo = parseISO(newToDate);
    
    if (!isValid(newFrom) || !isValid(newTo)) {
      toast({ variant: "destructive", title: "Parsing Error", description: "Could not process selected dates. Please re-select." });
      return;
    }

    const hasOverlap = (leaveRequests || []).some(l => {
      if (l.employeeId !== effectiveEmployeeId) return false;
      if (l.status === 'REJECTED') return false;
      
      const existingFrom = parseISO(l.fromDate);
      const existingTo = parseISO(l.toDate);
      
      if (!isValid(existingFrom) || !isValid(existingTo)) return false;
      
      try {
        const interval = { start: existingFrom, end: existingTo };
        return isWithinInterval(newFrom, interval) || isWithinInterval(newTo, interval);
      } catch (e) {
        return false;
      }
    });

    if (hasOverlap) {
      toast({ variant: "destructive", title: "Request Blocked", description: "Leave request already exists for the selected date(s)." });
      return;
    }

    setIsSubmittingLeave(true);
    try {
      let daysCount = 0.5;
      if (leaveType === "DAYS") {
        const diff = differenceInDays(newTo, newFrom) + 1;
        if (isNaN(diff)) {
          throw new Error("Date calculation error.");
        }
        daysCount = diff;
      }

      const newLeave: any = {
        employeeId: effectiveEmployeeId,
        employeeName: effectiveEmployeeName,
        department: registeredEmployee?.department || "N/A",
        designation: registeredEmployee?.designation || "N/A",
        fromDate: newFromDate,
        toDate: newToDate,
        days: daysCount,
        purpose: leavePurpose,
        status: 'UNDER_PROCESS',
        leaveType: leaveType,
        createdAt: new Date().toISOString()
      };

      if (leaveType === "HALF_DAY" && reachTime) {
        newLeave.reachTime = reachTime;
      }
      
      addRecord('leaveRequests', newLeave);
      toast({ title: "Request Sent", description: "Your leave application has been submitted successfully." });
      
      setActiveDialog("NONE");
      setLeavePurpose("");
      setReachTime("");
    } catch (error: any) {
      console.error("Leave submission error:", error);
      toast({ variant: "destructive", title: "System Error", description: error.message || "Could not submit request. Please try again." });
    } finally {
      setIsSubmittingLeave(false);
    }
  };

  const history = useMemo(() => {
    if (!currentUser || !isMounted) return [];
    
    const floorDate = parseISO(PROJECT_START_DATE_STR);
    const istNow = getISTTime();
    const todayStrLocal = format(istNow, "yyyy-MM-dd");

    let baseList = [];

    if (isAdminRole) {
      const limitDate = subDays(istNow, 45);
      const effectiveLimit = isAfter(limitDate, floorDate) ? limitDate : floorDate;
      const limitStr = format(effectiveLimit, "yyyy-MM-dd");
      
      const actualRecords = (attendanceRecords || [])
        .filter(r => {
          try {
            const d = parseISO(r.date);
            if (!isValid(d)) return false;
            if (isBefore(d, floorDate)) return false;
            
            const emp = employees.find(e => e.employeeId === r.employeeId);
            if (emp?.joinDate && r.date < emp.joinDate) return false;
            
            return r.date >= limitStr;
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
      
      if (registeredEmployee?.joinDate) {
        const joinDate = parseISO(registeredEmployee.joinDate);
        if (isValid(joinDate) && isAfter(joinDate, historyStartDate)) historyStartDate = joinDate;
      }

      const dateRange = eachDayOfInterval({ start: historyStartDate, end: today });
      baseList = dateRange.map(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const existingRecords = employeeRecords.filter(r => r.date === dateStr);
        const isSun = isSunday(date);
        const holiday = (holidays || []).find(h => h.date === dateStr);
        const isNonWorkingDay = isSun || !!holiday;
        const nonWorkingDayLabel = isSun ? "WEEKLY_OFF" : (holiday ? "HOLIDAY" : null);

        if (existingRecords.length > 0) return existingRecords.map(rec => ({ ...rec, isNonWorkingDay, nonWorkingDayLabel }));
        if (isSameDay(date, today)) return null;
        if (isSun || holiday) return [{ id: `v-${dateStr}`, employeeId: effectiveEmployeeId, employeeName: effectiveEmployeeName, date: dateStr, status: nonWorkingDayLabel, attendanceType: '--', approved: true, isNonWorkingDay: true, nonWorkingDayLabel }];
        return [{ id: `v-${dateStr}`, employeeId: effectiveEmployeeId, employeeName: effectiveEmployeeName, date: dateStr, status: 'ABSENT', attendanceType: '--', approved: true, hours: 0, inTime: null, outTime: null, isNonWorkingDay: false }];
      }).filter(Boolean).flat().reverse();
    }

    return baseList.filter((h: any) => {
      if (!h) return false;
      const nameMatch = h.employeeName?.toLowerCase().includes(columnFilters.name.toLowerCase());
      const plantMatch = (h.inPlant || '--').toLowerCase().includes(columnFilters.inPlant.toLowerCase());
      const inTimeStr = `${formatDate(h.date)} ${h.inTime || "--:--"}`;
      const inTimeMatch = inTimeStr.toLowerCase().includes(columnFilters.inTime.toLowerCase());
      const outTimeStr = `${formatDate(h.date)} ${h.outTime || "--:--"}`;
      const outTimeMatch = outTimeStr.toLowerCase().includes(columnFilters.outTime.toLowerCase());
      const typeMatch = (h.attendanceType || '--').toLowerCase().includes(columnFilters.type.toLowerCase());
      const statusMatch = h.status?.toLowerCase().includes(columnFilters.status.toLowerCase());
      const hoursMatch = formatHoursToHHMM(h.hours || 0).toLowerCase().includes(columnFilters.hours.toLowerCase());
      const approvalMatch = (h.approved ? "approved" : "pending").toLowerCase().includes(columnFilters.approval.toLowerCase());

      return nameMatch && plantMatch && inTimeMatch && outTimeMatch && typeMatch && statusMatch && hoursMatch && approvalMatch;
    });
  }, [currentUser, attendanceRecords, holidays, effectiveEmployeeId, effectiveEmployeeName, isAdminRole, isMounted, employeeRecords, registeredEmployee, employees, columnFilters]);

  const paginatedHistory = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return history.slice(start, start + rowsPerPage);
  }, [history, currentPage]);

  const totalPages = Math.ceil(history.length / rowsPerPage);

  const updateColumnFilter = (col: keyof typeof columnFilters, val: string) => {
    setColumnFilters(prev => ({ ...prev, [col]: val }));
    setCurrentPage(1);
  };

  const fetchAddress = async (lat: number, lng: number) => {
    try {
      const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_API_KEY}`);
      const data = await response.json();
      if (data.status === "OK" && data.results.length > 0) return data.results[0].formatted_address;
      return "Unable to fetch location details";
    } catch (error) { return "Unable to fetch location"; }
  };

  const requestLocation = (type: "IN" | "OUT") => {
    if (!isAccessAllowed) {
      toast({ variant: "destructive", title: "Access Denied", description: "You must use your registered device and start date must be active." });
      return;
    }

    if (todayStr < PROJECT_START_DATE_STR) {
      toast({ variant: "destructive", title: "System Offline", description: `Service starts from ${PROJECT_START_DATE_STR}.` });
      return;
    }

    if (registeredEmployee?.joinDate && todayStr < registeredEmployee.joinDate) {
      toast({ variant: "destructive", title: "Action Blocked", description: `Allowed from ${format(parseISO(registeredEmployee.joinDate), 'dd MMM yyyy')}.` });
      return;
    }
    if (type === "IN" && lockState.isLocked) {
      toast({ variant: "destructive", title: "Wait Period", description: `You can mark attendance after ${lockState.unlockTime}.` });
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
        const address = await fetchAddress(lat, lng);
        setDetectedAddress(address);
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
    if (!currentUser || !currentGPS || !isAccessAllowed || lockState.isLocked) return;
    const now = getISTTime();
    const time = format(now, "hh:mm a");
    const today = format(now, "yyyy-MM-dd");

    const newRecord: Partial<AttendanceRecord> = {
      employeeId: effectiveEmployeeId,
      employeeName: effectiveEmployeeName,
      date: today,
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
    
    const notifyMsg = `${effectiveEmployeeName} – Mark IN at ${time}`;
    addRecord('notifications', {
      message: notifyMsg,
      timestamp: format(now, "yyyy-MM-dd HH:mm:ss"),
      read: false,
      type: 'ATTENDANCE_IN',
      employeeId: effectiveEmployeeId
    });
    triggerNotification("Attendance Marked", notifyMsg);

    setActiveDialog("NONE");
    toast({ title: "Check-In Success", description: "Attendance logged successfully." });
    setIsReminderPopoverOpen(false);
  };

  const handleConfirmCheckOut = () => {
    if (!activeRecord || !currentGPS || !isAccessAllowed) return;
    const now = getISTTime();
    const timeHHMM = format(now, "HH:mm");
    const timeDisplay = format(now, "hh:mm a");
    const inDateTime = new Date(`${activeRecord.date}T${activeRecord.inTime}`);
    const outDateTime = new Date(`${format(now, "yyyy-MM-dd")}T${timeHHMM}`);
    const diffHours = (outDateTime.getTime() - inDateTime.getTime()) / (1000 * 60 * 60);
    
    let isAuto = diffHours >= 16;
    let finalOutTime = timeHHMM;
    let finalHours = parseFloat(diffHours.toFixed(2));

    if (isAuto) {
      const autoOutDateTime = addHours(inDateTime, 16);
      finalOutTime = format(autoOutDateTime, "HH:mm");
      finalHours = 8.0;
    }

    if (!isAuto && activeRecord.unapprovedOutDuration && activeRecord.unapprovedOutDuration > 0) {
      const deductionHours = activeRecord.unapprovedOutDuration / 60;
      finalHours = Math.max(0, finalHours - deductionHours);
    }

    updateRecord('attendance', activeRecord.id, { 
      outTime: finalOutTime, 
      hours: parseFloat(finalHours.toFixed(2)),
      status: finalHours >= 1.0 ? 'PRESENT' : 'ABSENT',
      attendanceTypeOut: detectedPlant ? 'OFFICE' : selectedType,
      latOut: currentGPS.lat,
      lngOut: currentGPS.lng,
      addressOut: detectedAddress,
      outPlant: detectedPlant?.name || "Remote",
      autoOut: isAuto,
      autoCheckout: isAuto
    });

    const workingHoursStr = formatHoursToHHMM(finalHours);
    const notifyMsg = `${effectiveEmployeeName} – Mark OUT at ${timeDisplay}. Working Hours: ${workingHoursStr} Hrs`;
    addRecord('notifications', {
      message: notifyMsg,
      timestamp: format(now, "yyyy-MM-dd HH:mm:ss"),
      read: false,
      type: 'ATTENDANCE_OUT',
      employeeId: effectiveEmployeeId
    });
    triggerNotification("Attendance Marked", notifyMsg);

    setActiveDialog("NONE");
    toast({ title: "Check-Out Success", description: `Shift ended at ${finalOutTime}.` });
  };

  const handleSaveEdit = () => {
    if (!isAdminRole || !selectedRecordToEdit || isProcessing) return;
    setIsProcessing(true);
    try {
      let finalHours = 0;
      if (editTimes.in && editTimes.out) {
        const inDT = new Date(`${selectedRecordToEdit.date}T${editTimes.in}`);
        const outDT = new Date(`${selectedRecordToEdit.date}T${editTimes.out}`);
        const diff = (outDT.getTime() - inDT.getTime()) / (1000 * 60 * 60);
        finalHours = parseFloat(diff.toFixed(2));
      }
      const isVirtual = selectedRecordToEdit.id?.toString().startsWith('v-');
      if (isVirtual) {
        addRecord('attendance', {
          employeeId: selectedRecordToEdit.employeeId,
          employeeName: selectedRecordToEdit.employeeName,
          date: selectedRecordToEdit.date,
          inTime: editTimes.in || null,
          outTime: editTimes.out || null,
          hours: isNaN(finalHours) ? 0 : finalHours,
          status: (finalHours >= 1.0) ? 'PRESENT' : 'ABSENT',
          attendanceType: 'FIELD',
          approved: false,
          address: 'Manual Entry'
        });
      } else {
        updateRecord('attendance', selectedRecordToEdit.id, {
          inTime: editTimes.in || null,
          outTime: editTimes.out || null,
          hours: isNaN(finalHours) ? 0 : finalHours,
          status: (finalHours >= 1.0) ? 'PRESENT' : 'ABSENT'
        });
      }
      toast({ title: "Record Adjusted" });
      setIsEditDialogOpen(false);
    } finally { setIsProcessing(false); }
  };

  if (!isMounted) return null;

  return (
    <TooltipProvider>
      <div className="space-y-8 max-w-7xl mx-auto pb-12 px-4">
        {currentUser?.role === 'EMPLOYEE' && !registeredEmployee && (
          <Alert variant="destructive" className="bg-rose-50 border-rose-200"><ShieldAlert className="h-5 w-5 text-rose-600" /><AlertTitle className="font-bold text-rose-800">Verification Required</AlertTitle><AlertDescription className="text-rose-700">Only registered staff can access Gateway Portal.</AlertDescription></Alert>
        )}

        {currentUser?.role === 'EMPLOYEE' && registeredEmployee && registeredEmployee.deviceId && registeredEmployee.deviceId !== getDeviceId() && (
          <Alert variant="destructive" className="bg-rose-50 border-rose-200 mb-6 shadow-lg">
            <ShieldAlert className="h-6 w-6 text-rose-600" />
            <AlertTitle className="font-black text-rose-900 text-lg">Device Security Error</AlertTitle>
            <AlertDescription className="text-rose-800 font-bold mt-1">
              Your account is currently linked to another mobile device. Multiple device logins are strictly prohibited to prevent proxy attendance. 
              <br/><br/>
              <span className="underline">Action Required:</span> Please use your originally registered device, or Logout and Login again on this device to transfer your official binding.
            </AlertDescription>
          </Alert>
        )}

        {lockState.isLocked && isAccessAllowed && (
          <Alert className="bg-amber-50 border-amber-200"><Lock className="h-5 w-5 text-amber-600" /><AlertTitle className="font-bold text-amber-800">Check-In Restricted</AlertTitle><AlertDescription className="text-amber-700 font-medium">8-hour cooling period active. Next access at <span className="font-black underline">{lockState.unlockTime}</span>.</AlertDescription></Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <Card className="shadow-2xl border-none overflow-hidden bg-white">
            <div className="h-1 bg-primary" />
            <CardHeader className="text-center py-4 relative">
              <CardTitle className="text-lg font-black flex items-center justify-center gap-2 text-slate-800">
                <ShieldCheck className="text-primary w-5 h-5" /> Gateway Portal
              </CardTitle>
              
              {showReminderIcon && (
                <div className="absolute right-4 top-4">
                  <Popover open={isReminderPopoverOpen} onOpenChange={setIsReminderPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full bg-rose-50 border border-rose-100 relative hover:bg-rose-100 transition-all">
                        <Bell className="w-5 h-5 text-rose-500" />
                        {!reminderReadAt && <span className="absolute top-1.5 right-1.5 w-3 h-3 bg-rose-600 rounded-full border-2 border-white animate-pulse" />}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-6 rounded-2xl shadow-2xl border-rose-100 bg-white" align="end">
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 border-b border-rose-50 pb-3">
                          <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center">
                            <MessageCircle className="w-6 h-6 text-rose-600" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase text-rose-400 tracking-widest leading-none mb-1">Attention</p>
                            <h4 className="text-sm font-black text-rose-900 leading-none">Attendance Reminder</h4>
                          </div>
                        </div>
                        <p className="text-sm font-bold text-rose-800 leading-relaxed italic">
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
                <Button className={cn("flex-1 h-14 text-sm font-black rounded-2xl shadow-lg", isAccessAllowed && !lockState.isLocked && !activeRecord ? "bg-primary hover:bg-primary/90" : "bg-slate-100 text-slate-400 cursor-not-allowed")} disabled={!isAccessAllowed || isLoadingLocation || !!activeRecord || lockState.isLocked} onClick={() => requestLocation("IN")}>{isLoadingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : "Mark IN"}</Button>
                <Button className={cn("flex-1 h-14 text-sm font-black rounded-2xl shadow-lg", isAccessAllowed && activeRecord ? "bg-rose-500 hover:bg-rose-600" : "bg-slate-100 text-slate-400 cursor-not-allowed")} disabled={!isAccessAllowed || isLoadingLocation || !activeRecord} onClick={() => requestLocation("OUT")}>Mark OUT</Button>
              </div>
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
          <h3 className="font-black text-xl flex items-center gap-2 text-slate-700"><History className="w-6 h-6 text-primary" /> {isAdminRole ? 'Staff Attendance Oversight' : 'My Attendance History (Since April-2026)'}</h3>
          <Card className="rounded-2xl overflow-hidden shadow-sm border-slate-200">
            <ScrollArea className="w-full">
              <Table className="min-w-[1000px]">
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-bold">Employee Name</TableHead>
                    <TableHead className="font-bold">In Plant</TableHead>
                    <TableHead className="font-bold">In Time</TableHead>
                    <TableHead className="font-bold">Out Time</TableHead>
                    <TableHead className="font-bold text-center">Type</TableHead>
                    <TableHead className="font-bold text-center">Status</TableHead>
                    <TableHead className="font-bold text-center">Hours</TableHead>
                    <TableHead className="font-bold">Approval</TableHead>
                    {isAdminRole && <TableHead className="font-bold text-right pr-6">Action</TableHead>}
                  </TableRow>
                  <TableRow className="bg-white hover:bg-white border-b">
                    <TableHead className="p-2"><div className="relative"><Search className="absolute left-2 top-2.5 h-3 w-3 text-slate-400" /><Input placeholder="Filter..." className="pl-6 h-8 text-[10px] bg-slate-50" value={columnFilters.name} onChange={(e) => updateColumnFilter('name', e.target.value)} /></div></TableHead>
                    <TableHead className="p-2"><Input placeholder="Filter..." className="h-8 text-[10px] bg-slate-50" value={columnFilters.inPlant} onChange={(e) => updateColumnFilter('inPlant', e.target.value)} /></TableHead>
                    <TableHead className="p-2"><Input placeholder="Filter..." className="h-8 text-[10px] bg-slate-50" value={columnFilters.inTime} onChange={(e) => updateColumnFilter('inTime', e.target.value)} /></TableHead>
                    <TableHead className="p-2"><Input placeholder="Filter..." className="h-8 text-[10px] bg-slate-50" value={columnFilters.outTime} onChange={(e) => updateColumnFilter('outTime', e.target.value)} /></TableHead>
                    <TableHead className="p-2"><Input placeholder="Filter..." className="h-8 text-[10px] bg-slate-50" value={columnFilters.type} onChange={(e) => updateColumnFilter('type', e.target.value)} /></TableHead>
                    <TableHead className="p-2"><Input placeholder="Filter..." className="h-8 text-[10px] bg-slate-50" value={columnFilters.status} onChange={(e) => updateColumnFilter('status', e.target.value)} /></TableHead>
                    <TableHead className="p-2"><Input placeholder="Filter..." className="h-8 text-[10px] bg-slate-50" value={columnFilters.hours} onChange={(e) => updateColumnFilter('hours', e.target.value)} /></TableHead>
                    <TableHead className="p-2"><Input placeholder="Filter..." className="h-8 text-[10px] bg-slate-50" value={columnFilters.approval} onChange={(e) => updateColumnFilter('approval', e.target.value)} /></TableHead>
                    {isAdminRole && <TableHead />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedHistory.length === 0 ? (<TableRow><TableCell colSpan={isAdminRole ? 9 : 8} className="text-center py-12 text-muted-foreground">No attendance activity matching your filters.</TableCell></TableRow>) : (
                    paginatedHistory.map((h: any) => (
                      <TableRow key={h.id} className={cn("hover:bg-slate-50/50", h.isVirtual && "bg-rose-50/20")}>
                        <TableCell className="text-sm font-bold uppercase">{h.employeeName}</TableCell>
                        <TableCell className="text-sm font-bold text-slate-700">{h.inPlant || "--"}</TableCell>
                        <TableCell className="font-mono text-xs">{formatDate(h.date)} {h.inTime || "--:--"}</TableCell>
                        <TableCell className="font-mono text-xs">{formatDate(h.date)} {h.outTime || "--:--"}</TableCell>
                        <TableCell className="text-center"><Badge variant="outline" className="text-[9px] font-black uppercase">{h.attendanceType}</Badge></TableCell>
                        <TableCell className="text-center"><Badge className={cn("text-[9px] font-black uppercase tracking-widest", h.status === 'PRESENT' ? "bg-emerald-50 text-emerald-700" : h.status === 'ABSENT' ? "bg-rose-50 text-rose-700" : "bg-slate-50 text-slate-700")}>{h.status}</Badge></TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={cn("font-black text-xs px-2.5 py-0.5", getWorkingHoursColor(h.hours || 0))}>
                            {formatHoursToHHMM(h.hours || 0)}
                          </Badge>
                        </TableCell>
                        <TableCell>{h.approved ? <Badge className="bg-emerald-600 uppercase text-[9px] rounded-full">Approved</Badge> : <Badge variant="secondary" className="bg-amber-50 text-amber-600 uppercase text-[9px] rounded-full">Pending</Badge>}</TableCell>
                        {isAdminRole && (<TableCell className="text-right pr-6"><Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-primary" onClick={() => { setSelectedRecordToEdit(h); setEditTimes({ in: h.inTime || "", out: h.outTime || "" }); setIsEditDialogOpen(true); }}><Pencil className="w-4 h-4" /></Button></TableCell>)}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
            {totalPages > 1 && (
              <CardFooter className="bg-slate-50 border-t flex flex-col sm:flex-row items-center justify-between p-4 gap-4">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="font-bold h-9">
                    <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                  </Button>
                  <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="font-bold h-9">
                    Next <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs font-black text-slate-500 uppercase tracking-widest">
                    Page {currentPage} of {totalPages}
                  </span>
                  <div className="flex items-center gap-2 border-l pl-4 border-slate-200">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Jump To</Label>
                    <div className="flex gap-1">
                      <Input 
                        type="number" 
                        className="w-14 h-9 text-center font-bold" 
                        value={currentPage} 
                        onChange={(e) => {
                          const p = parseInt(e.target.value);
                          if (p >= 1 && p <= totalPages) setCurrentPage(p);
                        }} 
                      />
                      <div className="w-9 h-9 bg-slate-900 rounded-lg flex items-center justify-center text-white">
                        <ArrowRightCircle className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </div>
              </CardFooter>
            )}
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
                    <p className="text-[10px] font-bold text-emerald-700/60 uppercase">Mode: On-Site Office</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-center gap-3">
                    <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0" />
                    <p className="text-xs font-bold text-amber-700 leading-snug">Outside authorized plant radius. Please select your current work assignment to proceed.</p>
                  </div>
                  <RadioGroup value={selectedType} onValueChange={(v: any) => setSelectedType(v)} className="grid grid-cols-2 gap-4">
                    <div className={cn("relative rounded-2xl border-2 transition-all p-4 cursor-pointer", selectedType === 'FIELD' ? "border-primary bg-primary/5" : "border-slate-100 bg-slate-50 hover:border-slate-200")} onClick={() => setSelectedType('FIELD')}>
                      <RadioGroupItem value="FIELD" id="field" className="absolute right-3 top-3" />
                      <Briefcase className={cn("w-6 h-6 mb-2", selectedType === 'FIELD' ? "text-primary" : "text-slate-400")} />
                      <Label htmlFor="field" className="font-black text-sm block cursor-pointer">FIELD WORK</Label>
                      <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Client Visits</p>
                    </div>
                    <div className={cn("relative rounded-2xl border-2 transition-all p-4 cursor-pointer", selectedType === 'WFH' ? "border-primary bg-primary/5" : "border-slate-100 bg-slate-50 hover:border-slate-200")} onClick={() => setSelectedType('WFH')}>
                      <RadioGroupItem value="WFH" id="wfh" className="absolute right-3 top-3" />
                      <Home className={cn("w-6 h-6 mb-2", selectedType === 'WFH' ? "text-primary" : "text-slate-400")} />
                      <Label htmlFor="wfh" className="font-black text-sm block cursor-pointer">W.F.H</Label>
                      <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Work From Home</p>
                    </div>
                  </RadioGroup>
                </div>
              )}
            </div>
            <DialogFooter className="p-6 bg-slate-50 border-t"><Button className="w-full h-14 rounded-2xl font-black text-lg bg-primary shadow-xl shadow-primary/20" onClick={handleConfirmCheckIn}>Confirm Mark IN</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={activeDialog === "OUT"} onOpenChange={(o) => !o && setActiveDialog("NONE")}>
          <DialogContent className="sm:max-w-md rounded-2xl border-none shadow-2xl p-0 overflow-hidden">
            <DialogHeader className="p-6 bg-rose-600 text-white shrink-0">
               <DialogTitle className="flex items-center gap-2 font-black text-xl">Confirm Check-Out</DialogTitle>
               <p className="text-xs font-bold text-rose-100 uppercase tracking-widest mt-2">{detectedAddress || "Locating..."}</p>
            </DialogHeader>
            <div className="p-8 space-y-6">
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 text-center">
                 <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Location Context</p>
                 <p className="text-sm font-black text-slate-700">{detectedPlant ? `Present at ${detectedPlant.name}` : "Remote Site"}</p>
              </div>
            </div>
            <DialogFooter className="p-6 bg-slate-50 border-t"><Button className="w-full h-14 rounded-2xl font-black text-lg bg-rose-500 hover:bg-rose-600 shadow-xl shadow-rose-100" onClick={handleConfirmCheckOut}>Confirm Mark OUT</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden">
            <DialogHeader className="p-6 bg-slate-900 text-white"><DialogTitle className="text-xl font-black flex items-center gap-2"><Pencil className="w-5 h-5 text-primary" /> Edit Attendance</DialogTitle></DialogHeader>
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase">IN Time</Label><Input type="time" value={editTimes.in} onChange={(e) => setEditTimes(p => ({...p, in: e.target.value}))} className="h-12 font-bold" /></div>
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase">OUT Time</Label><Input type="time" value={editTimes.out} onChange={(e) => setEditTimes(p => ({...p, out: e.target.value}))} className="h-12 font-bold" /></div>
              </div>
            </div>
            <DialogFooter className="p-6 bg-slate-50 border-t gap-3"><Button variant="ghost" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button><Button className="bg-primary font-black px-8" onClick={handleSaveEdit} disabled={isProcessing}>Save Changes</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={activeDialog === "LEAVE"} onOpenChange={(o) => !o && setActiveDialog("NONE")}>
          <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden">
            <DialogHeader className="p-6 bg-slate-900 text-white shrink-0"><DialogTitle className="text-xl font-black">Create Leave Request</DialogTitle></DialogHeader>
            <div className="p-6 space-y-6 bg-white">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Leave Type</Label>
                <Select value={leaveType} onValueChange={(v: any) => setLeaveType(v)}>
                  <SelectTrigger className="h-12 font-bold">
                    <SelectValue placeholder="Select Leave Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DAYS" className="font-bold">Days</SelectItem>
                    <SelectItem value="HALF_DAY" className="font-bold">Half Day</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {leaveType === "DAYS" ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">From Date</Label>
                    <Input 
                      type="date" 
                      value={leaveFrom} 
                      min={PROJECT_START_DATE_STR} 
                      max={leaveTo || undefined}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (leaveTo && val > leaveTo) {
                          toast({ variant: "destructive", title: "Validation Error", description: "From Date cannot be greater than To Date" });
                          return;
                        }
                        setLeaveFrom(val);
                      }} 
                      className="h-12 font-bold" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">To Date</Label>
                    <Input 
                      type="date" 
                      value={leaveTo} 
                      min={leaveFrom || PROJECT_START_DATE_STR} 
                      onChange={(e) => {
                        const val = e.target.value;
                        if (leaveFrom && val < leaveFrom) {
                          toast({ variant: "destructive", title: "Validation Error", description: "From Date cannot be greater than To Date" });
                          return;
                        }
                        setLeaveTo(val);
                      }} 
                      className="h-12 font-bold" 
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Date & Time</Label>
                    <Input 
                      value={currentTime ? format(currentTime, "MM/dd/yyyy HH:mm") : ""} 
                      disabled 
                      className="h-12 font-bold bg-slate-50 italic" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Reach Time *</Label>
                    <Input 
                      type="time" 
                      value={reachTime} 
                      onChange={(e) => setReachTime(e.target.value)} 
                      className="h-12 font-bold" 
                    />
                    <p className="text-[9px] text-muted-foreground font-medium uppercase italic">Specify expected arrival time.</p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Purpose *</Label>
                <Input 
                  placeholder="Reason for leave..." 
                  value={leavePurpose} 
                  onChange={(e) => setLeavePurpose(e.target.value)} 
                  className="h-12 font-bold" 
                />
              </div>
            </div>
            <DialogFooter className="p-6 bg-slate-50 border-t gap-3">
              <Button 
                variant="ghost" 
                onClick={() => setActiveDialog("NONE")} 
                className="rounded-xl font-bold bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 h-11 px-8"
              >
                Cancel
              </Button>
              <Button 
                className="bg-primary font-black px-12 h-11 rounded-xl shadow-lg shadow-primary/20" 
                onClick={handleSendLeaveRequest} 
                disabled={isSubmittingLeave}
              >
                Send Request
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
