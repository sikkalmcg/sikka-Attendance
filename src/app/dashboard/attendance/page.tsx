
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
  CalendarDays,
  Filter,
  CheckCircle
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
import { format, subDays, eachDayOfInterval, isSunday, isSameDay, parseISO, addHours, differenceInHours, isAfter, startOfDay, differenceInDays, addDays, isWithinInterval, differenceInMinutes, isValid, isBefore, startOfMonth } from "date-fns";
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
import { Separator } from "@/components/ui/separator";

const GOOGLE_API_KEY = "AIzaSyC_G7Iog7OdQvs2owQ8IBDSIZwF2l8Mnjk";
const PROJECT_START_DATE_STR = "2026-04-01";
const ROWS_PER_PAGE = 15;

const generateFilterMonths = () => {
  const options = [];
  const date = new Date();
  for (let i = -6; i < 12; i++) {
    const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
    if (isBefore(d, startOfMonth(parseISO(PROJECT_START_DATE_STR)))) continue;
    const mmm = d.toLocaleString('en-US', { month: 'short' });
    const yy = d.getFullYear().toString().slice(-2);
    options.push(`${mmm}-${yy}`);
  }
  return options;
};

const getISTTime = () => {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
};

export default function AttendancePage() {
  const { attendanceRecords, leaveRequests, addRecord, updateRecord, plants, holidays, employees, notifications, verifiedUser, isLoading } = useData();
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [activeDialog, setActiveDialog] = useState<"NONE" | "IN" | "OUT" | "LEAVE">("NONE");
  
  const [currentGPS, setCurrentGPS] = useState<{ lat: number, lng: number } | null>(null);
  const [detectedPlant, setDetectedPlant] = useState<Plant | null>(null);
  const [detectedAddress, setDetectedAddress] = useState("");
  const [selectedType, setSelectedType] = useState<"FIELD" | "WFH">("FIELD");

  // Oversight Controls
  const [oversightSearch, setOversightSearch] = useState("");
  const [oversightMonth, setOversightMonth] = useState("");
  const [oversightPage, setOversightPage] = useState(1);

  // Leave Form State
  const [leaveFromDate, setLeaveFromDate] = useState("");
  const [leaveToDate, setLeaveToDate] = useState("");
  const [leavePurpose, setLeavePurpose] = useState("");
  const [leaveTypeReq, setLeaveTypeReq] = useState<'DAYS' | 'HALF_DAY'>('DAYS');
  const [leaveReachTime, setLeaveReachTime] = useState("");
  const [selectedLeavePlantId, setSelectedLeavePlantId] = useState("");
  const [isSubmittingLeave, setIsSubmittingLeave] = useState(false);

  const { toast } = useToast();
  const filterMonths = useMemo(() => generateFilterMonths(), []);

  useEffect(() => {
    setIsMounted(true);
    setCurrentDeviceId(getDeviceId());
    setCurrentTime(getISTTime());
    const timer = setInterval(() => setCurrentTime(getISTTime()), 1000);

    const now = getISTTime();
    const mmm = now.toLocaleString('en-US', { month: 'short' });
    const yy = now.getFullYear().toString().slice(-2);
    setOversightMonth(`${mmm}-${yy}`);

    return () => clearInterval(timer);
  }, []);

  const todayStr = useMemo(() => isMounted ? format(getISTTime(), "yyyy-MM-dd") : "", [isMounted]);
  const isAdminRole = useMemo(() => verifiedUser && ['SUPER_ADMIN', 'ADMIN', 'HR'].includes(verifiedUser.role), [verifiedUser]);
  const isAccessAllowed = useMemo(() => isMounted && verifiedUser?.role === 'EMPLOYEE', [verifiedUser, isMounted]);

  const userAssignedPlantIds = useMemo(() => {
    if (!verifiedUser || verifiedUser.role === 'SUPER_ADMIN') return null;
    return verifiedUser.plantIds || [];
  }, [verifiedUser]);

  const effectiveEmployeeId = useMemo(() => verifiedUser?.employeeId || verifiedUser?.username || "N/A", [verifiedUser]);
  const effectiveEmployeeName = useMemo(() => verifiedUser?.fullName || "N/A", [verifiedUser]);

  const employeeRecords = useMemo(() => {
    if (!effectiveEmployeeId || effectiveEmployeeId === "N/A") return [];
    return (attendanceRecords || [])
      .filter(r => r.employeeId === effectiveEmployeeId && r.date >= PROJECT_START_DATE_STR)
      .sort((a, b) => b.date.localeCompare(a.date) || (b.inTime || "").localeCompare(a.inTime || ""));
  }, [attendanceRecords, effectiveEmployeeId]);

  const greetingMessage = useMemo(() => {
    if (!currentTime || !verifiedUser) return "";
    const hours = currentTime.getHours();
    const name = verifiedUser.fullName || "User";
    
    if (hours < 12) {
      return `Good Morning ${name}, Have a good day`;
    } else if (hours < 17) {
      return `Good Afternoon ${name}`;
    } else {
      return `Good Evening ${name}`;
    }
  }, [currentTime, verifiedUser]);

  const { activeRecord, lockState } = useMemo(() => {
    const now = getISTTime();
    const latestRec = employeeRecords[0];

    if (!latestRec || latestRec.outTime) {
      if (!latestRec) return { activeRecord: null, lockState: { isLocked: false, unlockTime: null } };

      const effectiveOutDate = latestRec.outDate || latestRec.date;
      const lastOutDateTime = new Date(`${effectiveOutDate}T${latestRec.outTime}`);
      
      if (isValid(lastOutDateTime)) {
        const allowedDateTime = addHours(lastOutDateTime, 8);
        const isResting = isAfter(allowedDateTime, now);
        return { 
          activeRecord: null, 
          lockState: { 
            isLocked: isResting, 
            unlockTime: isResting ? format(allowedDateTime, "HH:mm") : null 
          } 
        };
      }
      return { activeRecord: null, lockState: { isLocked: false, unlockTime: null } };
    }

    const inDateTime = new Date(`${latestRec.inDate || latestRec.date}T${latestRec.inTime}`);
    
    if (isValid(inDateTime)) {
      const diffHours = (now.getTime() - inDateTime.getTime()) / (1000 * 60 * 60);
      
      // AUTO OUT LOGIC: System trigger at IN + 16:00 + 1 minute
      if (diffHours >= 16.0166) { 
        return {
          activeRecord: null, 
          lockState: {
            isLocked: false,
            unlockTime: null,
            isStale: true,
            staleRecordId: latestRec.id
          }
        };
      }

      return {
        activeRecord: latestRec,
        lockState: { isLocked: true, unlockTime: 'Shift Active' }
      };
    }

    return { activeRecord: null, lockState: { isLocked: false, unlockTime: null } };
  }, [employeeRecords, currentTime]);

  useEffect(() => {
    if (lockState.isStale && lockState.staleRecordId) {
      const staleRec = (attendanceRecords || []).find(r => r.id === lockState.staleRecordId);
      if (staleRec && !staleRec.outTime) {
        const inDT = new Date(`${staleRec.inDate || staleRec.date}T${staleRec.inTime}`);
        if (isValid(inDT)) {
          const autoOutDT = addHours(inDT, 8);
          updateRecord('attendance', staleRec.id, {
            outTime: format(autoOutDT, "HH:mm"),
            outDate: format(autoOutDT, "yyyy-MM-dd"),
            hours: 8.0,
            status: 'PRESENT',
            autoCheckout: true,
            remark: "System Auto-Logged OUT (16h Limit Threshold reached)"
          });
          toast({ 
            title: "Session Synced", 
            description: "A previous shift exceeding 16 hours was auto-finalized at 8 hours duration." 
          });
        }
      }
    }
  }, [lockState.isStale, lockState.staleRecordId, attendanceRecords, updateRecord, toast]);

  const requestLocation = (type: "IN" | "OUT") => {
    if (!isAccessAllowed) return;
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
    if (!verifiedUser || !currentGPS || !isAccessAllowed) return;
    const now = getISTTime();
    const today = format(now, "yyyy-MM-dd");
    const timeStr = format(now, "HH:mm");
    const plantName = detectedPlant?.name || "Remote";

    addRecord('attendance', {
      employeeId: effectiveEmployeeId,
      employeeName: effectiveEmployeeName,
      date: today,
      inDate: today,
      inTime: timeStr,
      hours: 0,
      status: 'PRESENT',
      attendanceType: detectedPlant ? 'OFFICE' : selectedType,
      lat: currentGPS.lat,
      lng: currentGPS.lng,
      address: detectedAddress,
      inPlant: plantName,
      approved: false,
      unapprovedOutDuration: 0
    });

    // High-fidelity Activity Notification
    addRecord('notifications', {
      message: `${effectiveEmployeeName} – IN: ${format(now, "dd-MMM-yyyy HH:mm")} | ${plantName}`,
      timestamp: format(now, "yyyy-MM-dd HH:mm:ss"),
      read: false,
      type: 'ATTENDANCE_IN',
      employeeId: effectiveEmployeeId
    });

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
    
    const plantName = detectedPlant?.name || "Remote";

    updateRecord('attendance', activeRecord.id, { 
      outTime: timeHHMM, 
      outDate: todayStrLocal,
      hours: finalHours,
      status: finalHours >= 2.0 ? 'PRESENT' : 'ABSENT',
      latOut: currentGPS.lat, 
      lngOut: currentGPS.lng,
      addressOut: detectedAddress,
      outPlant: plantName
    });

    // High-fidelity Activity Notification
    addRecord('notifications', {
      message: `${effectiveEmployeeName} – OUT: ${format(now, "dd-MMM-yyyy HH:mm")} | WORK: ${formatHoursToHHMM(finalHours)} HRS | ${plantName}`,
      timestamp: format(now, "yyyy-MM-dd HH:mm:ss"),
      read: false,
      type: 'ATTENDANCE_OUT',
      employeeId: effectiveEmployeeId
    });

    setActiveDialog("NONE");
    toast({ title: "Check-Out Success" });
  };

  const handleLeaveSubmit = async () => {
    if (!selectedLeavePlantId || !leaveFromDate || (leaveTypeReq === 'DAYS' && !leaveToDate) || isSubmittingLeave) {
      return;
    }

    setIsSubmittingLeave(true);
    try {
      const start = startOfDay(parseISO(leaveFromDate));
      const end = startOfDay(parseISO(leaveTypeReq === 'HALF_DAY' ? leaveFromDate : leaveToDate));
      
      if (!isValid(start) || !isValid(end)) throw new Error("Invalid dates selected.");

      const diff = differenceInDays(end, start);
      const daysCount = leaveTypeReq === 'HALF_DAY' ? 0.5 : (isNaN(diff) ? 1 : diff + 1);
      
      if (leaveTypeReq === 'DAYS' && daysCount <= 0) throw new Error("End date must be after or same as start date.");

      const targetPlant = plants.find(p => p.id === selectedLeavePlantId);
      
      const leaveData: any = {
        employeeId: effectiveEmployeeId,
        employeeName: effectiveEmployeeName,
        department: verifiedUser?.department || "N/A",
        designation: verifiedUser?.designation || "N/A",
        plantName: targetPlant?.name || "N/A",
        fromDate: leaveFromDate,
        toDate: leaveTypeReq === 'HALF_DAY' ? leaveFromDate : leaveToDate,
        days: daysCount,
        status: 'UNDER_PROCESS',
        leaveType: leaveTypeReq,
        purpose: leavePurpose || "Personal Leave",
        createdAt: new Date().toISOString()
      };

      await addRecord('leaveRequests', leaveData);

      // High-fidelity Activity Notification
      addRecord('notifications', {
        message: `${effectiveEmployeeName} – Leave Req: ${formatDate(leaveFromDate)} to ${formatDate(leaveData.toDate)} | ${daysCount} Day(s)`,
        timestamp: new Date().toISOString(),
        read: false,
        type: 'LEAVE_REQUEST',
        employeeId: effectiveEmployeeId
      });

      toast({ title: "Request Submitted" });
      setActiveDialog("NONE");
    } finally {
      setIsSubmittingLeave(false);
    }
  };

  const holidaySet = useMemo(() => new Set(holidays.map(h => h.date)), [holidays]);

  const approvedLeavesMap = useMemo(() => {
    const map = new Map<string, boolean>();
    leaveRequests.filter(l => l.status === 'APPROVED').forEach(l => {
      const start = startOfDay(parseISO(l.fromDate));
      const end = startOfDay(parseISO(l.toDate));
      if (!isValid(start) || !isValid(end)) return;
      eachDayOfInterval({ start, end }).forEach(d => {
        map.set(`${l.employeeId}:${format(d, 'yyyy-MM-dd')}`, true);
      });
    });
    return map;
  }, [leaveRequests]);

  const history = useMemo(() => {
    if (!verifiedUser || !isMounted) return [];
    const now = getISTTime();

    const getPriorityStatus = (dateStr: string, record: any, empId: string) => {
      // 1. Leave Logic
      if (approvedLeavesMap.has(`${empId}:${dateStr}`)) return "Leave";
      
      const isSun = isSunday(parseISO(dateStr));
      const isCustomHoliday = holidaySet.has(dateStr);
      const isHoliday = isSun || isCustomHoliday;
      
      // 2. Attendance Presence Logic
      if (record && record.inTime) {
        const type = record.attendanceType;
        if (isHoliday) {
          if (type === 'OFFICE') return "Present on Holiday";
          if (type === 'FIELD') return "Field on Holiday";
          if (type === 'WFH') return "Work at Home on Holiday";
          return "Present on Holiday";
        }
        if (type === 'OFFICE') return "Present";
        if (type === 'FIELD') return "Field";
        if (type === 'WFH') return "Work at Home";
        return "Present";
      }

      // 3. Absence/Holiday Base Logic
      return isHoliday ? "Holiday" : "Absent";
    };

    let baseList = [];
    if (isAdminRole) {
      baseList = (attendanceRecords || []).filter(r => {
        if (r.date < PROJECT_START_DATE_STR) return false;
        
        if (userAssignedPlantIds) {
          const emp = employees.find(e => e.employeeId === r.employeeId);
          const hasAccess = (emp?.unitIds || []).some(id => userAssignedPlantIds.includes(id)) || userAssignedPlantIds.includes(r.inPlantId);
          if (!hasAccess) return false;
        }

        if (oversightMonth && oversightMonth !== 'all') {
          const d = parseISO(r.date);
          const mmm = d.toLocaleString('en-US', { month: 'short' });
          const yy = d.getFullYear().toString().slice(-2);
          if (`${mmm}-${yy}` !== oversightMonth) return false;
        }

        if (oversightSearch) {
          const s = oversightSearch.toLowerCase();
          return r.employeeName.toLowerCase().includes(s) || r.employeeId.toLowerCase().includes(s);
        }

        return true;
      });

      baseList = baseList.map(r => ({ ...r, displayStatus: getPriorityStatus(r.date, r, r.employeeId) }));
    } else {
      const empRecordMap = new Map();
      employeeRecords.forEach(r => empRecordMap.set(r.date, r));
      const dateRange = eachDayOfInterval({ start: parseISO(PROJECT_START_DATE_STR), end: startOfDay(new Date()) });
      baseList = dateRange.map(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const existing = empRecordMap.get(dateStr);
        if (existing) return { ...existing, displayStatus: getPriorityStatus(dateStr, existing, effectiveEmployeeId) };
        if (isSameDay(date, now)) return null;
        return { 
          id: `v-${dateStr}`, 
          employeeId: effectiveEmployeeId, 
          employeeName: effectiveEmployeeName, 
          date: dateStr, 
          status: 'ABSENT', 
          displayStatus: getPriorityStatus(dateStr, null, effectiveEmployeeId), 
          approved: true, 
          hours: 0, 
          isVirtual: true 
        };
      }).filter(Boolean);
    }
    // Date-wise sorting, current date at top
    return baseList.sort((a: any, b: any) => b.date.localeCompare(a.date));
  }, [verifiedUser, attendanceRecords, holidays, holidaySet, effectiveEmployeeId, effectiveEmployeeName, isAdminRole, isMounted, employeeRecords, oversightSearch, oversightMonth, userAssignedPlantIds, employees, approvedLeavesMap]);

  const filteredEmployeeLeaves = useMemo(() => {
    if (!isMounted || !todayStr) return [];
    return leaveRequests.filter(l => l.employeeId === effectiveEmployeeId && l.toDate >= todayStr); 
  }, [leaveRequests, effectiveEmployeeId, isMounted, todayStr]);

  const totalPages = Math.ceil(history.length / ROWS_PER_PAGE);
  const paginatedHistory = useMemo(() => history.slice((oversightPage - 1) * ROWS_PER_PAGE, oversightPage * ROWS_PER_PAGE), [history, oversightPage]);

  if (!isMounted) return null;

  return (
    <TooltipProvider>
      <div className="space-y-8 pb-12 px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <Card className="shadow-2xl border-none overflow-hidden bg-white">
            <div className="h-1 bg-primary" />
            <CardHeader className="text-center py-4 space-y-1">
              <CardTitle className="text-lg font-black flex items-center justify-center gap-2 text-slate-800">
                <ShieldCheck className="text-primary w-5 h-5" /> Gateway Portal
              </CardTitle>
              {greetingMessage && (
                <p className="text-xs font-bold text-slate-500 uppercase tracking-tight">
                  {greetingMessage}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-6 px-6 pb-8">
              <div className="py-6 px-8 rounded-3xl bg-sky-50 text-sky-900 flex flex-col items-center justify-center space-y-1 shadow-inner border border-sky-100 max-w-[280px] mx-auto">
                {currentTime ? (
                  <div className="text-center">
                    <h2 className="text-5xl font-black tracking-tighter font-mono leading-none">{format(currentTime, "HH:mm")}</h2>
                    <p className="text-[11px] font-black text-sky-600/80 mt-2 flex items-center justify-center gap-1.5 uppercase tracking-widest"><Calendar className="w-3.5 h-3.5" /> {format(currentTime, "dd-MMM-yyyy")}</p>
                  </div>
                ) : (
                  <Loader2 className="w-8 h-8 text-sky-300 animate-spin" />
                )}
              </div>

              {lockState.isLocked && lockState.unlockTime !== 'Shift Active' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
                  <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
                  <p className="text-[10px] font-black uppercase text-amber-800 tracking-tight">
                    Rest period active. Gateway unlocks at <span className="text-sm">{lockState.unlockTime}</span>
                  </p>
                </div>
              )}

              <div className="flex gap-4">
                <Button 
                  className={cn("flex-1 h-14 text-sm font-black rounded-2xl shadow-lg transition-all", 
                    !isLoading && isAccessAllowed && !lockState.isLocked && !activeRecord ? "bg-primary text-white" : "bg-slate-100 text-slate-400 cursor-not-allowed"
                  )} 
                  disabled={isLoading || !isAccessAllowed || isLoadingLocation || !!activeRecord || lockState.isLocked} 
                  onClick={() => requestLocation("IN")}
                >
                  Mark IN
                </Button>
                <Button 
                  className={cn("flex-1 h-14 text-sm font-black rounded-2xl shadow-lg transition-all", 
                    !isLoading && isAccessAllowed && activeRecord ? "bg-rose-500 text-white" : "bg-slate-100 text-slate-400 cursor-not-allowed"
                  )} 
                  disabled={isLoading || !isAccessAllowed || isLoadingLocation || !activeRecord} 
                  onClick={() => requestLocation("OUT")}
                >
                  Mark OUT
                </Button>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-xl border-none overflow-hidden bg-white h-full">
            <CardHeader className="bg-slate-50 border-b flex flex-row items-center justify-between py-4">
              <CardTitle className="text-sm font-bold">Leave Requests</CardTitle>
              <Button size="sm" onClick={() => setActiveDialog("LEAVE")} disabled={!isAccessAllowed}>Create Request</Button>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[240px]">
                {filteredEmployeeLeaves.length === 0 ? (
                  <div className="p-10 text-center text-xs font-bold text-slate-400">No active records.</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {filteredEmployeeLeaves.map((l) => (
                      <div key={l.id} className="p-4 flex justify-between items-center">
                        <div>
                          <p className="text-xs font-bold">{formatDate(l.fromDate)} - {formatDate(l.toDate)}</p>
                          <p className="text-[10px] uppercase text-muted-foreground">{l.days} Day(s) • {l.plantName}</p>
                        </div>
                        <Badge className="text-[9px] uppercase">{l.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
             <h3 className="font-black text-xl flex items-center gap-2 text-slate-700">
               <History className="w-6 h-6 text-primary" /> {isAdminRole ? 'Staff Attendance Oversight' : 'Attendance History'}
             </h3>
             {isAdminRole && (
               <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border shadow-sm">
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search staff..." className="pl-10 h-10 border-none bg-slate-50 text-xs" value={oversightSearch} onChange={(e) => setOversightSearch(e.target.value)} />
                  </div>
                  <Separator orientation="vertical" className="h-6" />
                  <Select value={oversightMonth} onValueChange={setOversightMonth}>
                     <SelectTrigger className="h-9 w-[130px] border-none font-black text-xs uppercase"><SelectValue placeholder="All Time" /></SelectTrigger>
                     <SelectContent>
                        <SelectItem value="all">All Time</SelectItem>
                        {filterMonths.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                     </SelectContent>
                  </Select>
               </div>
             )}
          </div>

          <Card className="rounded-2xl overflow-hidden shadow-sm border-slate-200">
            <ScrollArea className="w-full">
              <Table className="min-w-[1200px]">
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-bold">Employee</TableHead>
                    <TableHead className="font-bold">Plant</TableHead>
                    <TableHead className="font-bold">In Time</TableHead>
                    <TableHead className="font-bold">Out Time</TableHead>
                    <TableHead className="font-bold text-center">Status</TableHead>
                    <TableHead className="font-bold text-center">Work Hour</TableHead>
                    <TableHead className="font-bold">Approval</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedHistory.map((h: any) => (
                    <TableRow key={h.id} className="hover:bg-slate-50/50">
                      <TableCell className="text-sm font-bold uppercase">
                        <div className="flex flex-col">
                          <span>{h.employeeName}</span>
                          <span className="text-[9px] font-mono text-primary">{h.employeeId}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-bold">{h.inPlant || "--"}</TableCell>
                      <TableCell className="font-mono text-xs">{formatDate(h.inDate || h.date)} {h.inTime || "--:--"}</TableCell>
                      <TableCell className="font-mono text-xs">{formatDate(h.outDate || h.date)} {h.outTime || "--:--"}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={cn(
                          "text-[9px] font-black uppercase px-3 py-1 transition-all duration-300", 
                          h.displayStatus === 'Present' && "bg-emerald-500 text-white border-none hover:bg-emerald-600 shadow-sm",
                          h.displayStatus === 'Absent' && "bg-rose-500 text-white border-none hover:bg-rose-600 shadow-sm",
                          h.displayStatus === 'Field' && "bg-amber-400 text-black border-none hover:bg-amber-500 shadow-sm",
                          h.displayStatus === 'Work at Home' && "bg-orange-500 text-white border-none hover:bg-orange-600 shadow-sm",
                          h.displayStatus === 'Leave' && "bg-purple-500 text-white border-none hover:bg-purple-600 shadow-sm",
                          h.displayStatus === 'Present on Holiday' && "bg-gradient-to-r from-sky-200 to-emerald-500 text-white border-none shadow-sm font-black",
                          h.displayStatus === 'Field on Holiday' && "bg-gradient-to-r from-sky-200 to-amber-400 text-white border-none shadow-sm font-black",
                          h.displayStatus === 'Work at Home on Holiday' && "bg-gradient-to-r from-sky-200 to-orange-500 text-white border-none shadow-sm font-black",
                          h.displayStatus === 'Holiday' && "bg-transparent text-slate-400 border-slate-200 shadow-none hover:bg-transparent font-bold"
                        )}>
                          {h.displayStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={cn("font-black text-xs", getWorkingHoursColor(h.hours || 0))}>
                          {formatHoursToHHMM(h.hours || 0)}
                        </Badge>
                      </TableCell>
                      <TableCell>{h.approved ? <Badge className="bg-emerald-600 uppercase text-[9px]">Approved</Badge> : <Badge className="bg-amber-400 uppercase text-[9px]">Pending</Badge>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </Card>
        </div>

        <Dialog open={activeDialog === "IN"} onOpenChange={(o) => !o && setActiveDialog("NONE")}>
          <DialogContent className="sm:max-w-md rounded-[2rem] overflow-hidden p-0 border-none shadow-2xl">
            <DialogHeader className="p-8 bg-slate-900 text-white shrink-0">
              <DialogTitle className="flex items-center gap-2 text-xl font-black">
                <MapPin className="w-5 h-5 text-primary" /> Confirm Attendance Location
              </DialogTitle>
              <p className="text-xs font-bold text-slate-400 mt-2 leading-relaxed">{detectedAddress}</p>
            </DialogHeader>
            
            <div className="p-8 space-y-8">
              {detectedPlant ? (
                <div className="p-6 bg-emerald-50 rounded-[1.5rem] border-2 border-emerald-100 flex items-center gap-5">
                  <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center border border-emerald-200">
                    <Factory className="w-8 h-8 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest mb-0.5">Facility Detected</p>
                    <p className="text-lg font-black text-emerald-900 uppercase tracking-tight">{detectedPlant.name}</p>
                    <p className="text-[10px] font-bold text-emerald-500 uppercase mt-1">Authorized Node Range (700m)</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                      <Briefcase className="w-3.5 h-3.5" /> Select Attendance Type *
                    </Label>
                    <Badge variant="outline" className="text-[9px] font-black uppercase text-rose-500 border-rose-100 bg-rose-50 px-2 py-0.5">Selection Mandatory</Badge>
                  </div>
                  <RadioGroup value={selectedType} onValueChange={(v: any) => setSelectedType(v)} className="grid grid-cols-2 gap-4">
                    <div 
                      className={cn(
                        "p-6 border-2 rounded-2xl cursor-pointer transition-all flex flex-col items-center gap-3", 
                        selectedType === 'FIELD' ? "border-primary bg-primary/5 shadow-md shadow-primary/10" : "border-slate-100 hover:border-slate-200"
                      )} 
                      onClick={() => setSelectedType('FIELD')}
                    >
                      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center transition-colors", selectedType === 'FIELD' ? "bg-primary text-white" : "bg-slate-50 text-slate-400")}>
                        <Briefcase className="w-6 h-6" />
                      </div>
                      <Label className="font-black text-xs uppercase tracking-widest cursor-pointer">FIELD WORK</Label>
                    </div>
                    
                    <div 
                      className={cn(
                        "p-6 border-2 rounded-2xl cursor-pointer transition-all flex flex-col items-center gap-3", 
                        selectedType === 'WFH' ? "border-primary bg-primary/5 shadow-md shadow-primary/10" : "border-slate-100 hover:border-slate-200"
                      )} 
                      onClick={() => setSelectedType('WFH')}
                    >
                      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center transition-colors", selectedType === 'WFH' ? "bg-primary text-white" : "bg-slate-50 text-slate-400")}>
                        <Home className="w-6 h-6" />
                      </div>
                      <Label className="font-black text-xs uppercase tracking-widest cursor-pointer">WORK AT HOME</Label>
                    </div>
                  </RadioGroup>
                </div>
              )}
            </div>

            <DialogFooter className="p-6 bg-slate-50 border-t flex flex-col gap-3">
              <Button className="w-full h-14 font-black bg-primary text-white text-lg rounded-2xl shadow-xl shadow-primary/20" onClick={handleConfirmCheckIn}>
                <CheckCircle className="w-5 h-5 mr-2" /> Confirm Check-In
              </Button>
              <Button variant="ghost" className="w-full h-10 font-bold text-slate-400 hover:text-slate-600" onClick={() => setActiveDialog("NONE")}>Cancel</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={activeDialog === "OUT"} onOpenChange={(o) => !o && setActiveDialog("NONE")}>
          <DialogContent className="sm:max-w-md rounded-[2rem] overflow-hidden p-0 border-none shadow-2xl">
            <DialogHeader className="p-8 bg-rose-600 text-white shrink-0">
              <DialogTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-tight">
                <Navigation className="w-5 h-5" /> Close Active Shift
              </DialogTitle>
              <p className="text-xs font-bold text-rose-100 mt-2 leading-relaxed">{detectedAddress}</p>
            </DialogHeader>
            
            <div className="p-8 space-y-10">
              <div className="space-y-4">
                 <div className="flex items-center gap-2 mb-2">
                    <History className="w-3.5 h-3.5 text-slate-400" />
                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Shift Origin Summary</h4>
                 </div>
                 
                 <div className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden divide-y divide-slate-100">
                    <div className="p-4 flex justify-between items-center">
                       <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Shift Start</span>
                       <div className="text-right">
                          <p className="text-sm font-black text-slate-900 leading-none">{activeRecord?.inTime}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{formatDate(activeRecord?.inDate || activeRecord?.date)}</p>
                       </div>
                    </div>
                    
                    <div className="p-4 flex justify-between items-center">
                       <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">IN Plant</span>
                       <span className="text-xs font-bold text-slate-700 uppercase tracking-tight">{activeRecord?.inPlant || "Remote"}</span>
                    </div>

                    <div className="p-4 flex justify-between items-center">
                       <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Attendance Type</span>
                       <Badge className={cn("text-[9px] font-black uppercase px-2.5 py-0.5", activeRecord?.attendanceType === 'OFFICE' ? "bg-emerald-50 text-emerald-700" : "bg-primary/5 text-primary")}>
                          {activeRecord?.attendanceType === 'OFFICE' ? 'Present' : activeRecord?.attendanceType?.replace(/_/g, ' ')}
                       </Badge>
                    </div>
                 </div>
              </div>

              <div className="space-y-4">
                 <div className="flex items-center gap-2 mb-2">
                    <ArrowRightCircle className="w-3.5 h-3.5 text-primary" />
                    <h4 className="text-[10px] font-black uppercase text-primary tracking-widest">Finalizing Shift Boundary</h4>
                 </div>

                 <div className="bg-slate-900 rounded-2xl p-5 text-white flex justify-between items-center shadow-xl shadow-slate-200">
                    <div>
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Shift End at</p>
                       <p className="text-lg font-black uppercase tracking-tight text-primary">
                          {detectedPlant?.name || "Remote Log Point"}
                       </p>
                    </div>
                    <div className="text-right">
                       <p className="text-2xl font-black font-mono leading-none">{format(getISTTime(), "HH:mm")}</p>
                       <p className="text-[9px] font-bold text-slate-500 uppercase mt-1">{format(getISTTime(), "dd MMM yyyy")}</p>
                    </div>
                 </div>
              </div>
            </div>

            <DialogFooter className="p-6 bg-slate-50 border-t flex flex-col gap-3">
              <Button className="w-full h-14 font-black bg-rose-600 hover:bg-rose-700 text-white text-lg rounded-2xl shadow-xl shadow-rose-200 transition-all active:scale-95" onClick={handleConfirmCheckOut}>
                Confirm Check-Out
              </Button>
              <Button variant="ghost" className="w-full h-10 font-bold text-slate-400 hover:text-slate-600" onClick={() => setActiveDialog("NONE")}>Stay Clocked-In</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={activeDialog === "LEAVE"} onOpenChange={(o) => !o && setActiveDialog("NONE")}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Create Leave Request</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase">Facility *</Label>
                <Select value={selectedLeavePlantId} onValueChange={setSelectedLeavePlantId}>
                  <SelectTrigger><SelectValue placeholder="Choose Facility" /></SelectTrigger>
                  <SelectContent>{plants.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase">From</Label><Input type="date" value={leaveFromDate} min={todayStr} onChange={(e) => setLeaveFromDate(e.target.value)} /></div>
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase">To</Label><Input type="date" value={leaveToDate} min={leaveFromDate || todayStr} onChange={(e) => setLeaveToDate(e.target.value)} /></div>
              </div>
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Purpose</Label><Textarea value={leavePurpose} onChange={(e) => setLeavePurpose(e.target.value)} placeholder="Reason for leave..." /></div>
            </div>
            <DialogFooter><Button className="w-full h-12 font-black" disabled={isSubmittingLeave} onClick={handleLeaveSubmit}>Submit Request</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
