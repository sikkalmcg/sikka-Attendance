
"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
  Search,
  CalendarDays
} from "lucide-react";
import { calculateDistance, cn, formatDate, getWorkingHoursColor, getDeviceId, formatHoursToHHMM, formatMinutesToHHMM } from "@/lib/utils";
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
import { Textarea } from "@/components/ui/textarea";
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
const TRACKING_INTERVAL_MS = 30 * 60 * 1000; // 30 Minutes

const getISTTime = () => {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
};

export default function AttendancePage() {
  const { attendanceRecords, leaveRequests, addRecord, updateRecord, plants, holidays, employees, notifications } = useData();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [activeDialog, setActiveDialog] = useState<"NONE" | "IN" | "OUT" | "LEAVE">("NONE");
  
  const [currentGPS, setCurrentGPS] = useState<{ lat: number, lng: number } | null>(null);
  const [detectedPlant, setDetectedPlant] = useState<Plant | null>(null);
  const [detectedAddress, setDetectedAddress] = useState("");
  const [selectedType, setSelectedType] = useState<"FIELD" | "WFH">("FIELD");

  // Leave Form State
  const [leaveFromDate, setLeaveFromDate] = useState("");
  const [leaveToDate, setLeaveToDate] = useState("");
  const [leavePurpose, setLeavePurpose] = useState("");
  const [leaveTypeReq, setLeaveTypeReq] = useState<'DAYS' | 'HALF_DAY'>('DAYS');
  const [leaveReachTime, setLeaveReachTime] = useState("");
  const [selectedLeavePlantId, setSelectedLeavePlantId] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 15;

  const { toast } = useToast();
  const trackingTimerRef = useRef<NodeJS.Timeout | null>(null);

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
    
    const did = getDeviceId();
    setCurrentDeviceId(did);
    
    setCurrentTime(getISTTime());
    const timer = setInterval(() => setCurrentTime(getISTTime()), 1000);

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
    const loginIdent = (currentUser.username || "").replace(/\s/g, '');
    if (!loginIdent) return null;
    return employees.find(e => {
      const empAadhaar = (e.aadhaar || "").replace(/\s/g, '');
      const empMobile = (e.mobile || "").replace(/\s/g, '');
      return empAadhaar === loginIdent || empMobile === loginIdent;
    });
  }, [currentUser, employees]);

  const isAccessAllowed = useMemo(() => {
    if (!isMounted || !currentUser) return false;
    
    // Core Role Checks
    const isEmployee = currentUser.role === 'EMPLOYEE';
    const isManager = ['SUPER_ADMIN', 'ADMIN', 'HR'].includes(currentUser.role);
    
    // Managers always have access for testing/oversight
    if (isManager) return true;
    
    // Employees need to be active
    if (isEmployee) {
      if (registeredEmployee) {
        return registeredEmployee.active;
      }
      // If employee record isn't loaded yet but session is valid, allow access to prevent gray-out
      return true;
    }

    return false;
  }, [currentUser, registeredEmployee, isMounted]);

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

  // AUTO-OUT DETECTION LOGIC
  const { activeRecord, staleRecord } = useMemo(() => {
    const rec = (employeeRecords || []).find(r => !r.outTime);
    if (!rec) return { activeRecord: null, staleRecord: null };

    const inTimeStr = rec.inTime || "00:00";
    const inDateTime = new Date(`${rec.inDate || rec.date}T${inTimeStr}`);
    if (!isValid(inDateTime)) return { activeRecord: rec, staleRecord: null };

    const now = getISTTime();
    const diffHours = (now.getTime() - inDateTime.getTime()) / (1000 * 60 * 60);

    if (diffHours >= 16) {
      return { activeRecord: null, staleRecord: rec };
    }
    return { activeRecord: rec, staleRecord: null };
  }, [employeeRecords, currentTime]);

  // RESTRICTION RULE 4: 8-Hour Rest Period
  const lockState = useMemo(() => {
    const latestRec = [...employeeRecords].sort((a, b) => b.date.localeCompare(a.date) || (b.inTime || "").localeCompare(a.inTime || ""))[0];
    if (!latestRec) return { isLocked: false, unlockTime: null };

    let effectiveOutDate = latestRec.outDate || latestRec.date;
    let effectiveOutTime = latestRec.outTime;

    if (!latestRec.outTime) {
      if (!latestRec.inTime) return { isLocked: false, unlockTime: null };
      const inDT = new Date(`${latestRec.inDate || latestRec.date}T${latestRec.inTime}`);
      const nowTime = getISTTime();
      if (!isValid(inDT)) return { isLocked: false, unlockTime: null };
      
      const diffHours = (nowTime.getTime() - inDT.getTime()) / (1000 * 60 * 60);
      if (diffHours < 16) return { isLocked: true, unlockTime: 'Shift Active' };
      
      const autoOutDT = addHours(inDT, 16);
      effectiveOutDate = format(autoOutDT, "yyyy-MM-dd");
      effectiveOutTime = format(autoOutDT, "HH:mm");
    }

    const lastOutDateTime = new Date(`${effectiveOutDate}T${effectiveOutTime}`);
    if (!isValid(lastOutDateTime)) return { isLocked: false, unlockTime: null };
    
    const allowedDateTime = addHours(lastOutDateTime, 8);
    const nowCheck = getISTTime();
    const isLocked = isAfter(allowedDateTime, nowCheck);
    
    return { isLocked, unlockTime: isLocked ? format(allowedDateTime, "HH:mm") : null };
  }, [employeeRecords, currentTime]);

  // Perform Auto-OUT closure
  useEffect(() => {
    if (staleRecord && isMounted && currentUser?.username === staleRecord.employeeId) {
      const inTimeStr = staleRecord.inTime || "00:00";
      const inDateTime = new Date(`${staleRecord.inDate || staleRecord.date}T${inTimeStr}`);
      
      if (isValid(inDateTime)) {
        const autoOutDateTime = addHours(inDateTime, 16);
        const autoOutTimeStr = format(autoOutDateTime, "HH:mm");
        const autoOutDateStr = format(autoOutDateTime, "yyyy-MM-dd");
        
        updateRecord('attendance', staleRecord.id, {
          outTime: autoOutTimeStr,
          outDate: autoOutDateStr,
          hours: 8,
          status: 'PRESENT',
          autoCheckout: true,
          addressOut: 'System Auto OUT (16h Limit)',
          outPlant: staleRecord.inPlant || "Remote"
        });

        const notifyMsg = `${staleRecord.employeeName} – Auto OUT: ${format(autoOutDateTime, "dd-MMM HH:mm")} | Work: 08:00 Hrs (Fixed)`;
        addRecord('notifications', { 
          message: notifyMsg, 
          timestamp: format(new Date(), "yyyy-MM-dd HH:mm:ss"), 
          read: false,
          type: 'ATTENDANCE_OUT',
          employeeId: staleRecord.employeeId
        });
        triggerNotification("Security Auto OUT", notifyMsg);
      }
    }
  }, [staleRecord, isMounted, currentUser, updateRecord, addRecord, triggerNotification]);

  const requestLocation = (type: "IN" | "OUT") => {
    if (!isAccessAllowed) {
      toast({ variant: "destructive", title: "Access Denied", description: "Authorization Check Failed." });
      return;
    }
    if (todayStr < PROJECT_START_DATE_STR) {
      toast({ variant: "destructive", title: "System Offline", description: `Service starts ${PROJECT_START_DATE_STR}.` });
      return;
    }

    setIsLoadingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setCurrentGPS({ lat, lng });
        const plant = (plants || []).find(p => calculateDistance(lat, lng, p.lat, p.lng) <= (p.radius || 700));
        setDetectedPlant(plant || null);
        try {
          const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_API_KEY}`);
          const data = await response.json();
          setDetectedAddress(data.status === "OK" ? data.results[0].formatted_address : "Coordinates Captured");
        } catch (e) {
          setDetectedAddress("Coordinates Captured");
        }
        setIsLoadingLocation(false);
        setActiveDialog(type);
      },
      () => {
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
  };

  const handleConfirmCheckOut = () => {
    if (!activeRecord || !currentGPS || !isAccessAllowed) return;
    const now = getISTTime();
    const timeHHMM = format(now, "HH:mm");
    const todayStrLocal = format(now, "yyyy-MM-dd");
    
    const inTimeStr = activeRecord.inTime || "00:00";
    const inDateTime = new Date(`${activeRecord.inDate || activeRecord.date}T${inTimeStr}`);
    const outDateTime = new Date(`${todayStrLocal}T${timeHHMM}`);
    
    let finalHours = 0;
    if (isValid(inDateTime) && isValid(outDateTime)) {
      const diffHours = (outDateTime.getTime() - inDateTime.getTime()) / (1000 * 60 * 60);
      finalHours = parseFloat(diffHours.toFixed(2));
    }

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

    const notifyMsg = `${effectiveEmployeeName} – OUT: ${format(now, "dd-MMM HH:mm")} | Work: ${formatHoursToHHMM(finalHours)} Hrs`;
    addRecord('notifications', {
      message: notifyMsg,
      timestamp: format(now, "yyyy-MM-dd HH:mm:ss"),
      read: false,
      type: 'ATTENDANCE_OUT',
      employeeId: effectiveEmployeeId
    });
    triggerNotification("Attendance Marked", notifyMsg);
    setActiveDialog("NONE");
    toast({ title: "Check-Out Success" });
  };

  const history = useMemo(() => {
    if (!currentUser || !isMounted) return [];
    const now = getISTTime();
    const todayStrLocal = format(now, "yyyy-MM-dd");

    const getPriorityStatus = (dateStr: string, record: any) => {
      const isSun = isSunday(parseISO(dateStr));
      const holiday = (holidays || []).find(h => h.date === dateStr);
      
      if (record) {
        if (holiday) return "Present on Holiday";
        if (isSun) return "Present on Weekly Off";
        return record.status;
      } else {
        if (holiday) return `Holiday (${holiday.name})`;
        if (isSun) return "Weekly Off";
        return "Absent";
      }
    };

    let baseList = [];
    if (isAdminRole) {
      const rawRecords = (attendanceRecords || []).filter(r => r.date >= PROJECT_START_DATE_STR);
      const processedActual = rawRecords.map(r => {
        const displayStatus = getPriorityStatus(r.date, r);
        let finalRec = { ...r, displayStatus };
        
        if (!r.outTime) {
          const inDT = new Date(`${r.inDate || r.date}T${r.inTime || "00:00"}`);
          if (isValid(inDT)) {
            const diff = (now.getTime() - inDT.getTime()) / (1000 * 60 * 60);
            if (diff >= 16) {
              const autoOutDT = addHours(inDT, 16);
              finalRec = { ...finalRec, outTime: format(autoOutDT, "HH:mm"), outDate: format(autoOutDT, "yyyy-MM-dd"), hours: 8, autoCheckout: true };
            }
          }
        }
        return finalRec;
      });

      const virtualTodayRecords: any[] = [];
      if (todayStrLocal >= PROJECT_START_DATE_STR) {
        employees.filter(e => e.active).forEach(emp => {
          const hasRecord = processedActual.some(r => r.employeeId === emp.employeeId && r.date === todayStrLocal);
          if (!hasRecord) {
            const displayStatus = getPriorityStatus(todayStrLocal, null);
            virtualTodayRecords.push({ id: `v-today-${emp.employeeId}`, employeeId: emp.employeeId, employeeName: emp.name, date: todayStrLocal, status: 'ABSENT', displayStatus, approved: true, hours: 0, isVirtual: true });
          }
        });
      }
      baseList = [...processedActual, ...virtualTodayRecords].sort((a, b) => b.date.localeCompare(a.date) || a.employeeName.localeCompare(b.employeeName));
    } else {
      const dateRange = eachDayOfInterval({ start: parseISO(PROJECT_START_DATE_STR), end: startOfDay(new Date()) });
      baseList = dateRange.map(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const existing = employeeRecords.filter(r => r.date === dateStr).map(r => {
          const displayStatus = getPriorityStatus(dateStr, r);
          let finalRec = { ...r, displayStatus };
          if (!r.outTime) {
            const inDT = new Date(`${r.inDate || r.date}T${r.inTime || "00:00"}`);
            if (isValid(inDT)) {
              const diff = (now.getTime() - inDT.getTime()) / (1000 * 60 * 60);
              if (diff >= 16) {
                const autoOutDT = addHours(inDT, 16);
                finalRec = { ...finalRec, outTime: format(autoOutDT, "HH:mm"), outDate: format(autoOutDT, "yyyy-MM-dd"), hours: 8, autoCheckout: true };
              }
            }
          }
          return finalRec;
        });
        
        if (existing.length > 0) return existing;
        if (isSameDay(date, now)) return null;
        
        const displayStatus = getPriorityStatus(dateStr, null);
        return [{ id: `v-${dateStr}`, employeeId: effectiveEmployeeId, employeeName: effectiveEmployeeName, date: dateStr, status: 'ABSENT', displayStatus, approved: true, hours: 0, isVirtual: true }];
      }).filter(Boolean).flat().reverse();
    }
    return baseList;
  }, [currentUser, attendanceRecords, holidays, effectiveEmployeeId, effectiveEmployeeName, isAdminRole, isMounted, employeeRecords, employees]);

  const paginatedHistory = useMemo(() => history.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage), [history, currentPage]);

  if (!isMounted) return null;

  return (
    <TooltipProvider>
      <div className="space-y-8 max-w-7xl mx-auto pb-12 px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <Card className="shadow-2xl border-none overflow-hidden bg-white">
            <div className="h-1 bg-primary" />
            <CardHeader className="text-center py-4">
              <CardTitle className="text-lg font-black flex items-center justify-center gap-2 text-slate-800">
                <ShieldCheck className="text-primary w-5 h-5" /> Gateway Portal
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 px-6 pb-8">
              <div className="py-6 px-8 rounded-3xl bg-sky-50 text-sky-900 flex flex-col items-center justify-center space-y-1 shadow-inner border border-sky-100 max-w-[280px] mx-auto">
                {currentTime ? (<div className="text-center"><h2 className="text-5xl font-black tracking-tighter font-mono leading-none">{format(currentTime, "HH:mm")}</h2><p className="text-[11px] font-black text-sky-600/80 mt-2 flex items-center justify-center gap-1.5 uppercase tracking-widest"><Calendar className="w-3.5 h-3.5" /> {format(currentTime, "dd-MMM-yyyy")}</p></div>) : (<Loader2 className="w-8 h-8 text-sky-300 animate-spin" />)}
              </div>
              <div className="flex gap-4">
                <Button className={cn("flex-1 h-14 text-sm font-black rounded-2xl shadow-lg", isAccessAllowed && !lockState.isLocked && !activeRecord ? "bg-primary hover:bg-primary/90" : "bg-slate-100 text-slate-400 cursor-not-allowed")} disabled={!isAccessAllowed || isLoadingLocation || !!activeRecord || (lockState.isLocked && lockState.unlockTime !== 'Shift Active')} onClick={() => requestLocation("IN")}>Mark IN</Button>
                <Button className={cn("flex-1 h-14 text-sm font-black rounded-2xl shadow-lg", isAccessAllowed && activeRecord ? "bg-rose-500 hover:bg-rose-600" : "bg-slate-100 text-slate-400 cursor-not-allowed")} disabled={!isAccessAllowed || isLoadingLocation || !activeRecord} onClick={() => requestLocation("OUT")}>Mark OUT</Button>
              </div>
              {lockState.isLocked && lockState.unlockTime !== 'Shift Active' && (
                <p className="text-[10px] font-black text-rose-500 text-center uppercase tracking-widest bg-rose-50 py-2 rounded-lg border border-rose-100 animate-pulse">
                   Mandatory 8h Rest Period. Next IN Allowed at {lockState.unlockTime}
                </p>
              )}
            </CardContent>
          </Card>
          <Card className="shadow-xl border-none overflow-hidden bg-white h-full">
            <CardHeader className="bg-slate-50 border-b flex flex-row items-center justify-between py-4"><CardTitle className="text-sm font-bold flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Leave Requests</CardTitle><Button size="sm" className="h-8 gap-1 font-bold text-[10px] uppercase" onClick={() => setActiveDialog("LEAVE")} disabled={!isAccessAllowed}><Plus className="w-3 h-3" /> Create Request</Button></CardHeader>
            <CardContent className="p-0"><ScrollArea className="h-[240px]">{leaveRequests.filter(l => l.employeeId === effectiveEmployeeId).length === 0 ? (<div className="p-10 text-center text-xs text-muted-foreground">No active records.</div>) : (<div className="divide-y divide-slate-100">{leaveRequests.filter(l => l.employeeId === effectiveEmployeeId).map((l) => (<div key={l.id} className="p-4 flex justify-between items-start hover:bg-slate-50 transition-colors"><div className="space-y-0.5"><p className="text-xs font-bold text-slate-700">{format(parseISO(l.fromDate), 'dd MMM')} - {format(parseISO(l.toDate), 'dd MMM')}</p><p className="text-[10px] text-muted-foreground font-medium uppercase">{l.days} Day(s) • {l.purpose}</p><p className="text-[9px] font-black text-primary uppercase">{l.plantName}</p></div><Badge className={cn("text-[9px] font-black uppercase rounded-full", l.status === 'APPROVED' ? "bg-emerald-100 text-emerald-600" : l.status === 'REJECTED' ? "bg-rose-100 text-rose-600" : "bg-blue-100 text-blue-600")}>{l.status}</Badge></div>))}</div>)}</ScrollArea></CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <h3 className="font-black text-xl flex items-center gap-2 text-slate-700"><History className="w-6 h-6 text-primary" /> {isAdminRole ? 'Staff Attendance Oversight' : 'My Attendance History'}</h3>
          <Card className="rounded-2xl overflow-hidden shadow-sm border-slate-200">
            <ScrollArea className="w-full">
              <Table className="min-w-[1200px]">
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-bold">Employee Name</TableHead>
                    <TableHead className="font-bold">In Plant</TableHead>
                    <TableHead className="font-bold">In Date & Time</TableHead>
                    <TableHead className="font-bold">Out Date & Time</TableHead>
                    <TableHead className="font-bold text-center">Status</TableHead>
                    <TableHead className="font-bold text-center">Out Hour</TableHead>
                    <TableHead className="font-bold text-center">Working Hour</TableHead>
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
                          <span className={cn(h.autoCheckout && "text-rose-600 font-bold")}>{h.outTime || (h.isVirtual ? "--:--" : "Shift In-Progress")}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={cn(
                          "text-[9px] font-black uppercase tracking-widest", 
                          h.displayStatus.includes("Present") ? "bg-emerald-50 text-emerald-700" : h.displayStatus === 'Absent' ? "bg-rose-50 text-rose-700" : "bg-slate-50 text-slate-700"
                        )}>
                          {h.displayStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center"><span className="text-xs font-mono font-bold text-rose-600">{formatMinutesToHHMM(h.unapprovedOutDuration || 0)}</span></TableCell>
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
            <DialogHeader className="p-6 bg-slate-900 text-white shrink-0"><DialogTitle className="flex items-center gap-2 font-black text-xl"><Navigation className="w-5 h-5 text-primary" /> Confirm Attendance</DialogTitle><p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">{detectedAddress || "Locating..."}</p></DialogHeader>
            <div className="p-8 space-y-8">{detectedPlant ? (<div className="p-6 bg-emerald-50 border-2 border-emerald-100 rounded-3xl flex items-center gap-4 shadow-sm"><div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-emerald-200"><Factory className="w-6 h-6 text-white" /></div><div><p className="text-[10px] font-black uppercase text-emerald-600 tracking-[0.2em] mb-1">Plant Detected</p><p className="text-lg font-black text-emerald-900">{detectedPlant.name}</p></div></div>) : (<RadioGroup value={selectedType} onValueChange={(v: any) => setSelectedType(v)} className="grid grid-cols-2 gap-4"><div className={cn("relative rounded-2xl border-2 transition-all p-4 cursor-pointer", selectedType === 'FIELD' ? "border-primary bg-primary/5" : "border-slate-100 bg-slate-50")} onClick={() => setSelectedType('FIELD')}><RadioGroupItem value="FIELD" id="field" className="absolute right-3 top-3" /><Briefcase className={cn("w-6 h-6 mb-2", selectedType === 'FIELD' ? "text-primary" : "text-slate-400")} /><Label htmlFor="field" className="font-black text-sm block cursor-pointer">FIELD WORK</Label></div><div className={cn("relative rounded-2xl border-2 transition-all p-4 cursor-pointer", selectedType === 'WFH' ? "border-primary bg-primary/5" : "border-slate-100 bg-slate-50")} onClick={() => setSelectedType('WFH')}><RadioGroupItem value="WFH" id="wfh" className="absolute right-3 top-3" /><Home className={cn("w-6 h-6 mb-2", selectedType === 'WFH' ? "text-primary" : "text-slate-400")} /><Label htmlFor="wfh" className="font-black text-sm block cursor-pointer">W.F.H</Label></div></RadioGroup>)}</div>
            <DialogFooter className="p-6 bg-slate-50 border-t"><Button className="w-full h-14 rounded-2xl font-black text-lg bg-primary" onClick={handleConfirmCheckIn}>Confirm Mark IN</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={activeDialog === "OUT"} onOpenChange={(o) => !o && setActiveDialog("NONE")}>
          <DialogContent className="sm:max-w-md rounded-2xl border-none shadow-2xl p-0 overflow-hidden"><DialogHeader className="p-6 bg-rose-600 text-white shrink-0"><DialogTitle className="flex items-center gap-2 font-black text-xl">Confirm Check-Out</DialogTitle></DialogHeader><div className="p-8 space-y-6 text-center"><p className="text-sm font-black text-slate-700">{detectedPlant ? `Marking OUT from ${detectedPlant.name}` : "Marking OUT from Remote Site"}</p></div><DialogFooter className="p-6 bg-slate-50 border-t"><Button className="w-full h-14 rounded-2xl font-black text-lg bg-rose-500 hover:bg-rose-600" onClick={handleConfirmCheckOut}>Confirm Mark OUT</Button></DialogFooter></DialogContent>
        </Dialog>

        <Dialog open={activeDialog === "LEAVE"} onOpenChange={(o) => !o && setActiveDialog("NONE")}>
          <DialogContent className="sm:max-w-lg rounded-2xl border-none shadow-2xl p-0 overflow-hidden">
            <DialogHeader className="p-6 bg-primary text-white shrink-0">
              <DialogTitle className="flex items-center gap-2 font-black text-xl"><CalendarDays className="w-5 h-5 text-white" /> Create Leave Request</DialogTitle>
            </DialogHeader>
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Select Target Plant *</Label>
                <Select value={selectedLeavePlantId} onValueChange={setSelectedLeavePlantId}>
                  <SelectTrigger className="h-12 bg-slate-50 font-bold border-slate-200">
                    <SelectValue placeholder="Choose Facility for Leave" />
                  </SelectTrigger>
                  <SelectContent>
                    {plants.map(p => (
                      <SelectItem key={p.id} value={p.id} className="font-bold">{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Select Leave Type</Label>
                <RadioGroup value={leaveTypeReq} onValueChange={(v: any) => setLeaveTypeReq(v)} className="grid grid-cols-2 gap-4">
                  <div className={cn("relative rounded-xl border-2 transition-all p-3 cursor-pointer", leaveTypeReq === 'DAYS' ? "border-primary bg-primary/5" : "border-slate-100 bg-slate-50")} onClick={() => setLeaveTypeReq('DAYS')}>
                    <RadioGroupItem value="DAYS" id="l-days" className="absolute right-2 top-2" />
                    <Label htmlFor="l-days" className="font-bold text-sm block cursor-pointer">Full Day(s)</Label>
                  </div>
                  <div className={cn("relative rounded-xl border-2 transition-all p-3 cursor-pointer", leaveTypeReq === 'HALF_DAY' ? "border-primary bg-primary/5" : "border-slate-100 bg-slate-50")} onClick={() => setLeaveTypeReq('HALF_DAY')}>
                    <RadioGroupItem value="HALF_DAY" id="l-half" className="absolute right-2 top-2" />
                    <Label htmlFor="l-half" className="font-bold text-sm block cursor-pointer">Half Day</Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">From Date</Label>
                  <Input type="date" min={PROJECT_START_DATE_STR} value={leaveFromDate} onChange={(e) => setLeaveFromDate(e.target.value)} className="h-12 font-bold" />
                </div>
                {leaveTypeReq === 'DAYS' ? (
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">To Date</Label>
                    <Input type="date" min={leaveFromDate || PROJECT_START_DATE_STR} value={leaveToDate} onChange={(e) => setLeaveToDate(e.target.value)} className="h-12 font-bold" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Reporting Time</Label>
                    <Input type="time" value={leaveReachTime} onChange={(e) => setLeaveReachTime(e.target.value)} className="h-12 font-bold" />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Purpose / Reason</Label>
                <Textarea placeholder="Reason for leave request..." value={leavePurpose} onChange={(e) => setLeavePurpose(e.target.value)} className="min-h-[100px] bg-slate-50" />
              </div>
            </div>
            <DialogFooter className="p-6 bg-slate-50 border-t">
              <Button variant="ghost" onClick={() => setActiveDialog("NONE")} className="font-bold">Cancel</Button>
              <Button 
                className="h-12 px-10 rounded-xl font-black bg-primary" 
                disabled={!selectedLeavePlantId || !leaveFromDate || (leaveTypeReq === 'DAYS' && !leaveToDate)}
                onClick={() => {
                  const start = parseISO(leaveFromDate);
                  const end = parseISO(leaveTypeReq === 'HALF_DAY' ? leaveFromDate : leaveToDate);
                  const days = leaveTypeReq === 'HALF_DAY' ? 0.5 : differenceInDays(end, start) + 1;
                  const targetPlant = plants.find(p => p.id === selectedLeavePlantId);
                  
                  addRecord('leaveRequests', {
                    employeeId: effectiveEmployeeId,
                    employeeName: effectiveEmployeeName,
                    department: registeredEmployee?.department || "N/A",
                    designation: registeredEmployee?.designation || "N/A",
                    plantName: targetPlant?.name || "N/A",
                    fromDate: leaveFromDate,
                    toDate: leaveTypeReq === 'HALF_DAY' ? leaveFromDate : leaveToDate,
                    days,
                    purpose: leavePurpose,
                    status: 'UNDER_PROCESS',
                    createdAt: new Date().toISOString(),
                    leaveType: leaveTypeReq,
                    reachTime: leaveTypeReq === 'HALF_DAY' ? leaveReachTime : undefined
                  });
                  setActiveDialog("NONE");
                  toast({ title: "Request Submitted" });
                }}
              >
                Submit Request
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
