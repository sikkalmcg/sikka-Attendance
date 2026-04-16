
"use client";

import { useState, useEffect, useMemo } from "react";
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
  X
} from "lucide-react";
import { calculateDistance, cn } from "@/lib/utils";
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
import { format, subDays, eachDayOfInterval, isSunday, isSameDay, parseISO, addHours, differenceInHours, isAfter, startOfDay, differenceInDays, addDays, isWithinInterval } from "date-fns";
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

const GOOGLE_API_KEY = "AIzaSyC_G7Iog7OdQvs2owQ8IBDSIZwF2l8Mnjk";

// Utility for IST time handling
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
  const [manualType, setManualType] = useState<'FIELD' | 'WFH'>('FIELD');

  // Leave Form State
  const [leaveFrom, setLeaveFrom] = useState("");
  const [leaveTo, setLeaveTo] = useState("");
  const [leavePurpose, setLeavePurpose] = useState("");
  const [isSubmittingLeave, setIsSubmittingLeave] = useState(false);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedRecordToEdit, setSelectedRecordToEdit] = useState<any>(null);
  const [editTimes, setEditTimes] = useState({ in: "", out: "" });

  const [isRejectionDialogOpen, setIsRejectionDialogOpen] = useState(false);
  const [selectedRecordForRejection, setSelectedRecordForRejection] = useState<AttendanceRecord | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 15;

  const { toast } = useToast();

  useEffect(() => {
    setIsMounted(true);
    const savedUser = localStorage.getItem("user");
    if (savedUser) setCurrentUser(JSON.parse(savedUser));
    
    setCurrentTime(getISTTime());
    const timer = setInterval(() => setCurrentTime(getISTTime()), 1000);
    return () => clearInterval(timer);
  }, []);

  const todayStr = useMemo(() => {
    if (!isMounted) return "";
    return format(getISTTime(), "yyyy-MM-dd");
  }, [isMounted]);

  const isAdminRole = useMemo(() => {
    return currentUser && ['SUPER_ADMIN', 'ADMIN', 'HR'].includes(currentUser.role);
  }, [currentUser]);

  const isSuperAdmin = useMemo(() => {
    return currentUser?.role === 'SUPER_ADMIN';
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
    return currentUser?.role === 'EMPLOYEE' && !!registeredEmployee && registeredEmployee.active;
  }, [currentUser, registeredEmployee]);

  const effectiveEmployeeId = useMemo(() => {
    return registeredEmployee?.employeeId || currentUser?.username || "N/A";
  }, [registeredEmployee, currentUser]);

  const effectiveEmployeeName = useMemo(() => {
    return registeredEmployee?.name || currentUser?.fullName || "Employee Name";
  }, [registeredEmployee, currentUser]);

  const employeeRecords = useMemo(() => {
    if (!effectiveEmployeeId) return [];
    return (attendanceRecords || []).filter(r => r.employeeId === effectiveEmployeeId);
  }, [attendanceRecords, effectiveEmployeeId]);

  const myLeaveRequests = useMemo(() => {
    if (!effectiveEmployeeId || !isMounted) return [];
    const now = getISTTime();
    
    return (leaveRequests || [])
      .filter(l => {
        if (l.employeeId !== effectiveEmployeeId) return false;
        
        // Auto cleanup logic: After To Date + 7 days
        const cleanupDate = addDays(parseISO(l.toDate), 7);
        if (isAfter(now, cleanupDate)) return false;
        
        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [leaveRequests, effectiveEmployeeId, isMounted]);

  const activeRecord = useMemo(() => {
    return employeeRecords.find(r => !r.outTime);
  }, [employeeRecords]);

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
    return { 
      isLocked, 
      unlockTime: isLocked ? format(allowedDateTime, "HH:mm") : null 
    };
  }, [lastOutRecord, currentTime]);

  const handleCreateLeaveRequest = () => {
    if (!isAccessAllowed) {
      toast({ variant: "destructive", title: "Action Blocked", description: "Only registered staff can request leave." });
      return;
    }
    const today = format(getISTTime(), "yyyy-MM-dd");
    setLeaveFrom(today);
    setLeaveTo(today);
    setLeavePurpose("");
    setActiveDialog("LEAVE");
  };

  const handleSendLeaveRequest = () => {
    if (!leaveFrom || !leaveTo || !leavePurpose.trim()) {
      toast({ variant: "destructive", title: "Missing Fields", description: "Please provide dates and purpose." });
      return;
    }

    const istNow = getISTTime();
    const today = format(istNow, "yyyy-MM-dd");
    
    if (leaveFrom < today) {
      toast({ variant: "destructive", title: "Invalid Date", description: "Leave from date cannot be in the past." });
      return;
    }
    if (leaveTo < leaveFrom) {
      toast({ variant: "destructive", title: "Invalid Date", description: "To date must be after From date." });
      return;
    }

    // Overlapping Request Validation Logic
    const newFrom = parseISO(leaveFrom);
    const newTo = parseISO(leaveTo);

    const hasOverlap = (leaveRequests || []).some(l => {
      if (l.employeeId !== effectiveEmployeeId) return false;
      if (l.status === 'REJECTED') return false;

      const existingFrom = parseISO(l.fromDate);
      const existingTo = parseISO(l.toDate);
      const interval = { start: existingFrom, end: existingTo };

      // Validation logic: (newFromDate BETWEEN existingRange) OR (newToDate BETWEEN existingRange)
      return isWithinInterval(newFrom, interval) || isWithinInterval(newTo, interval);
    });

    if (hasOverlap) {
      toast({ 
        variant: "destructive", 
        title: "Request Blocked", 
        description: "Leave request already exists for selected date. Please wait for approval or rejection." 
      });
      return;
    }

    setIsSubmittingLeave(true);
    try {
      const days = differenceInDays(parseISO(leaveTo), parseISO(leaveFrom)) + 1;
      const newLeave: Partial<LeaveRequest> = {
        employeeId: effectiveEmployeeId,
        employeeName: effectiveEmployeeName,
        department: registeredEmployee?.department || "N/A",
        designation: registeredEmployee?.designation || "N/A",
        fromDate: leaveFrom,
        toDate: leaveTo,
        days: days,
        purpose: leavePurpose,
        status: 'UNDER_PROCESS'
      };

      addRecord('leaveRequests', newLeave);
      addRecord('notifications', {
        message: `New Leave Request: ${effectiveEmployeeName} (${days} days)`,
        timestamp: format(istNow, "yyyy-MM-dd HH:mm:ss"),
        read: false
      });

      toast({ title: "Request Sent", description: "Your leave application is under process." });
      setActiveDialog("NONE");
    } finally {
      setIsSubmittingLeave(false);
    }
  };

  const history = useMemo(() => {
    if (!currentUser || !isMounted) return [];
    
    if (isAdminRole) {
      const limitDate = subDays(new Date(), 45);
      return (attendanceRecords || [])
        .filter(r => {
          try {
            const emp = employees.find(e => e.employeeId === r.employeeId);
            if (emp?.joinDate && r.date < emp.joinDate) return false;
            return new Date(r.date) >= limitDate;
          } catch (e) {
            return false;
          }
        })
        .sort((a, b) => {
          const dateCompare = b.date.localeCompare(a.date);
          if (dateCompare !== 0) return dateCompare;
          return (b.inTime || "").localeCompare(a.inTime || "");
        });
    }

    const today = startOfDay(new Date());
    const fortyFiveDaysAgo = subDays(today, 45);
    
    let historyStartDate = fortyFiveDaysAgo;
    if (registeredEmployee?.joinDate) {
      const joinDate = parseISO(registeredEmployee.joinDate);
      if (isAfter(joinDate, fortyFiveDaysAgo)) {
        historyStartDate = joinDate;
      }
    }

    const dateRange = eachDayOfInterval({ start: historyStartDate, end: today });
    
    return dateRange.map(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const existingRecords = employeeRecords.filter(r => r.date === dateStr);
      
      const isSun = isSunday(date);
      const holiday = (holidays || []).find(h => h.date === dateStr);
      const isNonWorkingDay = isSun || !!holiday;
      const nonWorkingDayLabel = isSun ? "WEEKLY_OFF" : (holiday ? "HOLIDAY" : null);

      if (existingRecords.length > 0) {
        return existingRecords.map(rec => ({
          ...rec,
          isNonWorkingDay,
          nonWorkingDayLabel
        }));
      }

      if (isSameDay(date, today)) return null;

      if (isSun) {
        return [{
          id: `virtual-sun-${dateStr}`,
          employeeId: effectiveEmployeeId,
          employeeName: effectiveEmployeeName,
          date: dateStr,
          status: 'WEEKLY_OFF',
          attendanceType: '--',
          approved: true,
          isNonWorkingDay: true,
          nonWorkingDayLabel: "WEEKLY_OFF"
        }] as any;
      }

      if (holiday) {
        return [{
          id: `virtual-hol-${dateStr}`,
          employeeId: effectiveEmployeeId,
          employeeName: effectiveEmployeeName,
          date: dateStr,
          status: 'HOLIDAY',
          attendanceType: '--',
          approved: true,
          isNonWorkingDay: true,
          nonWorkingDayLabel: "HOLIDAY"
        }] as any;
      }

      return [{
        id: `virtual-abs-${dateStr}`,
        employeeId: effectiveEmployeeId,
        employeeName: effectiveEmployeeName,
        date: dateStr,
        status: 'ABSENT',
        attendanceType: '--',
        approved: true,
        hours: 0,
        inTime: null,
        outTime: null,
        isNonWorkingDay: false
      }] as any;
    }).filter(Boolean).flat().reverse();
  }, [currentUser, attendanceRecords, holidays, effectiveEmployeeId, effectiveEmployeeName, isAdminRole, isMounted, employeeRecords, registeredEmployee, employees]);

  const paginatedHistory = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return history.slice(start, start + rowsPerPage);
  }, [history, currentPage]);

  const totalPages = Math.ceil(history.length / rowsPerPage);

  const fetchAddress = async (lat: number, lng: number) => {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_API_KEY}`
      );
      const data = await response.json();
      if (data.status === "OK" && data.results.length > 0) {
        return data.results[0].formatted_address;
      }
      return "Unable to fetch location details";
    } catch (error) {
      console.error("Geocoding error:", error);
      return "Unable to fetch location";
    }
  };

  const requestLocation = (type: "IN" | "OUT") => {
    if (!isAccessAllowed) {
      toast({ variant: "destructive", title: "Action Blocked", description: "You must be a registered employee to mark attendance." });
      return;
    }

    if (type === "IN") {
      const istNow = getISTTime();
      const todayStr = format(istNow, "yyyy-MM-dd");
      if (registeredEmployee?.joinDate && todayStr < registeredEmployee.joinDate) {
        toast({ variant: "destructive", title: "Action Blocked", description: "Attendance cannot be marked before employee joining date." });
        return;
      }

      if (lockState.isLocked) {
        toast({ variant: "destructive", title: "Wait Period", description: `You can mark attendance after ${lockState.unlockTime}.` });
        return;
      }
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
        let message = "Enable location permissions to proceed.";
        if (err.code === err.PERMISSION_DENIED) message = "Location access denied.";
        toast({ variant: "destructive", title: "GPS Error", description: message });
        setIsLoadingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleConfirmCheckIn = () => {
    if (!currentUser || !currentGPS || !isAccessAllowed || lockState.isLocked) return;
    const now = getISTTime();
    const time = format(now, "HH:mm");
    const today = format(now, "yyyy-MM-dd");

    if (registeredEmployee?.joinDate && today < registeredEmployee.joinDate) {
      toast({ variant: "destructive", title: "Action Blocked", description: "Attendance cannot be marked before employee joining date." });
      return;
    }

    const type = detectedPlant ? 'OFFICE' : manualType;

    const newRecord: Partial<AttendanceRecord> = {
      employeeId: effectiveEmployeeId,
      employeeName: effectiveEmployeeName,
      date: today,
      inTime: time,
      outTime: null,
      hours: 0,
      status: 'PRESENT',
      attendanceType: type,
      lat: currentGPS.lat,
      lng: currentGPS.lng,
      address: detectedAddress,
      inPlant: detectedPlant?.name || type,
      approved: false,
      rejectionCount: 0
    };

    addRecord('attendance', newRecord);
    addRecord('notifications', {
      message: `${effectiveEmployeeName} marked IN at ${time} (${type})`,
      timestamp: format(now, "yyyy-MM-dd HH:mm:ss"),
      read: false
    });
    setActiveDialog("NONE");
    toast({ title: "Check-In Success", description: "Attendance logged and sent for approval." });
  };

  const handleConfirmCheckOut = () => {
    if (!activeRecord || !currentGPS || !isAccessAllowed) return;
    const now = getISTTime();
    const time = format(now, "HH:mm");
    const typeOut = detectedPlant ? 'OFFICE' : manualType;
    
    const inDateTime = new Date(`${activeRecord.date}T${activeRecord.inTime}`);
    const outDateTime = new Date(`${format(now, "yyyy-MM-dd")}T${time}`);
    const diffHours = (outDateTime.getTime() - inDateTime.getTime()) / (1000 * 60 * 60);
    
    let finalOutTime = time;
    let finalHours = parseFloat(diffHours.toFixed(2));
    let isAuto = false;

    if (diffHours > 16) {
      const autoOutDate = new Date(inDateTime.getTime() + (8 * 60 * 60 * 1000));
      finalOutTime = format(autoOutDate, "HH:mm");
      finalHours = 8.0;
      isAuto = true;
    }

    updateRecord('attendance', activeRecord.id, { 
      outTime: finalOutTime, 
      hours: finalHours,
      attendanceTypeOut: typeOut,
      latOut: currentGPS.lat,
      lngOut: currentGPS.lng,
      addressOut: detectedAddress,
      outPlant: detectedPlant?.name || typeOut,
      autoCheckout: isAuto,
      autoOut: isAuto
    });

    addRecord('notifications', {
      message: `${activeRecord.employeeName} marked OUT at ${finalOutTime} (Worked: ${finalHours}h)`,
      timestamp: format(now, "yyyy-MM-dd HH:mm:ss"),
      read: false
    });
    setActiveDialog("NONE");
    toast({ title: "Check-Out Success", description: `Shift ended at ${finalOutTime}.` });
  };

  if (!isMounted) return null;

  return (
    <TooltipProvider>
      <div className="space-y-8 max-w-7xl mx-auto pb-12 px-4">
        {currentUser?.role === 'EMPLOYEE' && !registeredEmployee && (
          <Alert variant="destructive" className="bg-rose-50 border-rose-200 animate-in fade-in slide-in-from-top-2">
            <ShieldAlert className="h-5 w-5 text-rose-600" />
            <AlertTitle className="font-bold text-rose-800">Verification Required</AlertTitle>
            <AlertDescription className="text-rose-700">
              Only registered staff can access Gateway Portal. Please contact HR.
            </AlertDescription>
          </Alert>
        )}

        {lockState.isLocked && isAccessAllowed && (
          <Alert className="bg-amber-50 border-amber-200 animate-in fade-in slide-in-from-top-2">
            <Lock className="h-5 w-5 text-amber-600" />
            <AlertTitle className="font-bold text-amber-800">Check-In Restricted</AlertTitle>
            <AlertDescription className="text-amber-700 font-medium">
              Mandatory 8-hour cooling period. You can mark attendance after <span className="font-black underline">{lockState.unlockTime}</span>.
            </AlertDescription>
          </Alert>
        )}

        {/* Top Section: Gateway Portal and Leave Request Widget side-by-side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {/* Gateway Portal Card */}
          <Card className="shadow-2xl border-none overflow-hidden bg-white h-full">
            <div className="h-1 bg-primary" />
            <CardHeader className="text-center py-4">
              <CardTitle className="text-lg font-black flex items-center justify-center gap-2 text-slate-800">
                <ShieldCheck className="text-primary w-5 h-5" /> Gateway Portal
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 px-6 pb-8 pt-0">
              <div className="py-6 px-8 rounded-3xl bg-sky-50 text-sky-900 flex flex-col items-center justify-center space-y-1 shadow-inner border border-sky-100 max-w-[280px] mx-auto transition-all">
                {currentTime ? (
                  <div className="text-center">
                    <h2 className="text-5xl font-black tracking-tighter font-mono text-sky-900 leading-none">
                      {format(currentTime, "HH:mm")}
                    </h2>
                    <p className="text-[11px] font-black text-sky-600/80 mt-2 flex items-center justify-center gap-1.5 uppercase tracking-widest">
                      <Calendar className="w-3.5 h-3.5" /> {format(currentTime, "dd-MMMM-yyyy")}
                    </p>
                  </div>
                ) : (
                  <Loader2 className="w-8 h-8 text-sky-300 animate-spin" />
                )}
              </div>

              <div className="flex gap-4">
                <Button 
                  className={cn(
                    "flex-1 h-14 text-sm font-black rounded-2xl transition-all active:scale-95 shadow-lg",
                    isAccessAllowed && !lockState.isLocked && !activeRecord ? "bg-primary hover:bg-primary/90 shadow-primary/20" : "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none"
                  )} 
                  disabled={!isAccessAllowed || isLoadingLocation || !!activeRecord || lockState.isLocked} 
                  onClick={() => requestLocation("IN")}
                >
                  {isLoadingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : (isAccessAllowed ? (lockState.isLocked ? "Locked" : "Mark IN") : "Locked")}
                </Button>
                
                <Button 
                  className={cn(
                    "flex-1 h-14 text-sm font-black rounded-2xl transition-all active:scale-95 shadow-lg",
                    isAccessAllowed && activeRecord ? "bg-rose-500 hover:bg-rose-600 shadow-rose-100" : "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none"
                  )} 
                  disabled={!isAccessAllowed || isLoadingLocation || !activeRecord} 
                  onClick={() => requestLocation("OUT")}
                >
                  {isLoadingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : "Mark OUT"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Leave Request Widget Card */}
          <Card className="shadow-xl border-none overflow-hidden bg-white h-full">
            <CardHeader className="bg-slate-50 border-b flex flex-row items-center justify-between py-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" /> Leave Requests
              </CardTitle>
              <Button size="sm" className="h-8 gap-1 font-bold text-[10px] uppercase" onClick={handleCreateLeaveRequest} disabled={!isAccessAllowed}>
                <Plus className="w-3 h-3" /> Create Request
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[240px]">
                {myLeaveRequests.length === 0 ? (
                  <div className="p-10 text-center space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">No active leave records found.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {myLeaveRequests.map((l) => (
                      <div key={l.id} className="p-4 space-y-2 hover:bg-slate-50 transition-colors">
                        <div className="flex justify-between items-start">
                          <div className="space-y-0.5">
                            <p className="text-xs font-bold text-slate-700">{format(parseISO(l.fromDate), 'dd MMM')} - {format(parseISO(l.toDate), 'dd MMM')}</p>
                            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">{l.days} Day(s) • {l.purpose}</p>
                          </div>
                          <Badge 
                            className={cn(
                              "text-[9px] font-black uppercase border-none px-2 py-0.5 rounded-full",
                              l.status === 'APPROVED' ? "bg-emerald-100 text-emerald-600" :
                              l.status === 'REJECTED' ? "bg-rose-100 text-rose-600" :
                              "bg-blue-100 text-blue-600"
                            )}
                          >
                            {l.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        {l.status === 'REJECTED' && l.rejectReason && (
                          <p className="text-[9px] text-rose-500 font-bold bg-rose-50 p-2 rounded-lg border border-rose-100 italic">
                            Reason: {l.rejectReason}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Section: History Oversight Full Width */}
        <div className="space-y-4">
          <h3 className="font-black text-xl flex items-center gap-2 text-slate-700">
            <History className="w-6 h-6 text-primary" /> {isAdminRole ? 'Staff Attendance Oversight' : 'My Attendance History'}
          </h3>
          <Card className="rounded-2xl overflow-hidden shadow-sm border-slate-200">
            <ScrollArea className="w-full">
              <Table className="min-w-[900px]">
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-bold">Employee Name</TableHead>
                    <TableHead className="font-bold">In Plant</TableHead>
                    <TableHead className="font-bold">In Date Time</TableHead>
                    <TableHead className="font-bold">Out Date Time</TableHead>
                    <TableHead className="font-bold text-center">Hours</TableHead>
                    <TableHead className="font-bold">Approval Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedHistory.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No records found.</TableCell></TableRow>
                  ) : (
                    paginatedHistory.map((h: any) => (
                      <TableRow key={h.id} className="hover:bg-slate-50/50">
                        <TableCell className="text-sm font-bold">{h.employeeName}</TableCell>
                        <TableCell className="text-sm font-bold text-slate-700">{h.inPlant || "--"}</TableCell>
                        <TableCell className="font-mono text-xs">{h.date} {h.inTime || "--:--"}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {h.date} {h.outTime || "--:--"}
                          {h.autoOut && <span className="block text-[8px] font-black text-rose-500 uppercase">Auto OUT</span>}
                        </TableCell>
                        <TableCell className={cn("font-black text-center", h.status === 'PRESENT' ? "text-emerald-600" : "text-rose-500")}>
                          {h.hours || 0}h
                        </TableCell>
                        <TableCell>
                          {h.approved ? (
                            <Badge className="bg-emerald-600 uppercase text-[9px] rounded-full">Approved</Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-amber-50 text-amber-600 uppercase text-[9px] rounded-full">Pending</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
            {totalPages > 1 && (
              <CardFooter className="bg-slate-50 border-t flex items-center justify-between p-4">
                <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="font-bold">Previous</Button>
                <span className="text-xs font-black">Page {currentPage} of {totalPages}</span>
                <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="font-bold">Next</Button>
              </CardFooter>
            )}
          </Card>
        </div>

        {/* IN/OUT Dialogs */}
        <Dialog open={activeDialog === "IN"} onOpenChange={(o) => !o && setActiveDialog("NONE")}>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader><DialogTitle className="flex items-center gap-2 font-black">Confirm Check-In</DialogTitle></DialogHeader>
            <div className="space-y-6 py-4">
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                <div className="flex items-start gap-4">
                  <MapPin className="w-5 h-5 text-slate-400 shrink-0 mt-1" />
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase text-slate-400">Current Location</p>
                    <p className="text-sm font-bold text-slate-700 leading-snug">{detectedAddress || "Locating..."}</p>
                  </div>
                </div>
              </div>
              {!detectedPlant && (
                <div className="space-y-3 px-1">
                  <Label className="font-black text-[10px] uppercase text-slate-500">Work Mode Selection</Label>
                  <Select value={manualType} onValueChange={(v: any) => setManualType(v)}>
                    <SelectTrigger className="h-14 rounded-2xl font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FIELD">Field Work</SelectItem>
                      <SelectItem value="WFH">Work From Home</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button className="w-full h-14 rounded-2xl font-black bg-primary text-lg" onClick={handleConfirmCheckIn}>Confirm Check-In</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={activeDialog === "OUT"} onOpenChange={(o) => !o && setActiveDialog("NONE")}>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader><DialogTitle className="flex items-center gap-2 font-black">Confirm Check-Out</DialogTitle></DialogHeader>
            <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
               <p className="text-sm font-bold text-slate-700">{detectedAddress || "Locating..."}</p>
            </div>
            <DialogFooter>
              <Button className="w-full h-14 rounded-2xl font-black bg-rose-500 hover:bg-rose-600 text-lg" onClick={handleConfirmCheckOut}>Confirm Check-Out</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Leave Request Popup */}
        <Dialog open={activeDialog === "LEAVE"} onOpenChange={(o) => !o && setActiveDialog("NONE")}>
          <DialogContent className="sm:max-w-md rounded-2xl border-none shadow-2xl p-0 overflow-hidden [&>button]:text-rose-600 [&>button]:opacity-100 [&>button:hover]:text-rose-700">
            <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
              <DialogTitle className="text-xl font-black flex items-center gap-2">
                <FileText className="w-6 h-6 text-primary" /> Create Leave Request
              </DialogTitle>
              <div className="mt-4 flex flex-col gap-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{effectiveEmployeeName} • {effectiveEmployeeId}</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">{registeredEmployee?.department} / {registeredEmployee?.designation}</p>
              </div>
            </DialogHeader>
            
            <div className="p-6 space-y-6 bg-white">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-500">From Date *</Label>
                  <Input 
                    type="date" 
                    value={leaveFrom} 
                    min={todayStr}
                    onChange={(e) => {
                      const val = e.target.value;
                      setLeaveFrom(val);
                      if (leaveTo && val > leaveTo) {
                        setLeaveTo(val);
                      }
                    }} 
                    className="h-12 bg-slate-50 border-slate-200 font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-500">To Date *</Label>
                  <Input 
                    type="date" 
                    value={leaveTo} 
                    min={leaveFrom || todayStr}
                    onChange={(e) => setLeaveTo(e.target.value)} 
                    className="h-12 bg-slate-50 border-slate-200 font-bold"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-500">Purpose / Reason *</Label>
                <Input 
                  placeholder="Reason for leave request..." 
                  value={leavePurpose} 
                  onChange={(e) => setLeavePurpose(e.target.value)} 
                  className="h-12 bg-slate-50 border-slate-200 font-bold"
                />
              </div>

              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex gap-3">
                <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-blue-700 font-medium leading-relaxed uppercase">
                  Calculated Duration: {differenceInDays(parseISO(leaveTo || leaveFrom), parseISO(leaveFrom)) + 1} Day(s). Note: Only future dates are allowed.
                </p>
              </div>
            </div>

            <DialogFooter className="p-6 bg-slate-50 border-t flex flex-row gap-3">
              <Button variant="ghost" className="flex-1 h-12 rounded-xl font-bold text-rose-600 hover:bg-rose-50" onClick={() => setActiveDialog("NONE")}>Cancel</Button>
              <Button className="flex-1 h-12 rounded-xl font-black bg-primary shadow-lg shadow-primary/20" onClick={handleSendLeaveRequest} disabled={isSubmittingLeave}>
                {isSubmittingLeave ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Request"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
