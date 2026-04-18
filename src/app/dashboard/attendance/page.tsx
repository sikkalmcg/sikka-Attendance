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
  X,
  Factory,
  Briefcase,
  Home
} from "lucide-react";
import { calculateDistance, cn, formatDate, getWorkingHoursColor, getDeviceId } from "@/lib/utils";
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
import { format, subDays, eachDayOfInterval, isSunday, isSameDay, parseISO, addHours, differenceInHours, isAfter, startOfDay, differenceInDays, addDays, isWithinInterval, differenceInMinutes } from "date-fns";
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

const GOOGLE_API_KEY = "AIzaSyC_G7Iog7OdQvs2owQ8IBDSIZwF2l8Mnjk";

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

  const [leaveFrom, setLeaveFrom] = useState("");
  const [leaveTo, setLeaveTo] = useState("");
  const [leavePurpose, setLeavePurpose] = useState("");
  const [isSubmittingLeave, setIsSubmittingLeave] = useState(false);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedRecordToEdit, setSelectedRecordToEdit] = useState<any>(null);
  const [editTimes, setEditTimes] = useState({ in: "", out: "" });
  const [isProcessing, setIsProcessing] = useState(false);

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
    const currentDevice = getDeviceId();
    const isEmployee = currentUser?.role === 'EMPLOYEE';
    const hasEmployeeRecord = !!registeredEmployee && registeredEmployee.active;
    
    // Strict Device Binding Enforcement
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
    return (attendanceRecords || []).filter(r => r.employeeId === effectiveEmployeeId);
  }, [attendanceRecords, effectiveEmployeeId]);

  const myLeaveRequests = useMemo(() => {
    if (!effectiveEmployeeId || !isMounted) return [];
    const now = getISTTime();
    
    return (leaveRequests || [])
      .filter(l => {
        if (l.employeeId !== effectiveEmployeeId) return false;
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
    return { isLocked, unlockTime: isLocked ? format(allowedDateTime, "HH:mm") : null };
  }, [lastOutRecord, currentTime]);

  // Logic for unapproved out detection
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

            // Trigger Notification if OUT of plant while checked IN
            if (!nearestPlant && activeRecord.attendanceType === 'OFFICE' && !activeRecord.lastDetectedOutAt) {
              updateRecord('attendance', activeRecord.id, { lastDetectedOutAt: format(now, "HH:mm"), lastOutCheckTime: now.toISOString() });
              addRecord('notifications', {
                message: `OUT event: ${effectiveEmployeeName} moved beyond 0.7 KM. Current hours: ${diffHours.toFixed(2)}h`,
                timestamp: format(now, "yyyy-MM-dd HH:mm:ss"),
                read: false
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
      }, 60000); // Check every minute
      return () => clearInterval(interval);
    }
  }, [activeRecord, isAccessAllowed, plants, updateRecord, addRecord, effectiveEmployeeName]);

  const handleCreateLeaveRequest = () => {
    if (!isAccessAllowed) {
      toast({ variant: "destructive", title: "Action Blocked", description: "Registration and device binding required to request leave." });
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
      toast({ variant: "destructive", title: "Validation Error", description: "From Date cannot be greater than To Date" });
      return;
    }

    const newFrom = parseISO(leaveFrom);
    const newTo = parseISO(leaveTo);
    const hasOverlap = (leaveRequests || []).some(l => {
      if (l.employeeId !== effectiveEmployeeId) return false;
      if (l.status === 'REJECTED') return false;
      const existingFrom = parseISO(l.fromDate);
      const existingTo = parseISO(l.toDate);
      const interval = { start: existingFrom, end: existingTo };
      return isWithinInterval(newFrom, interval) || isWithinInterval(newTo, interval);
    });

    if (hasOverlap) {
      toast({ variant: "destructive", title: "Request Blocked", description: "Leave request already exists for selected date." });
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
          } catch (e) { return false; }
        })
        .sort((a, b) => b.date.localeCompare(a.date) || (b.inTime || "").localeCompare(a.inTime || ""));
    }

    const today = startOfDay(new Date());
    const fortyFiveDaysAgo = subDays(today, 45);
    let historyStartDate = fortyFiveDaysAgo;
    if (registeredEmployee?.joinDate) {
      const joinDate = parseISO(registeredEmployee.joinDate);
      if (isAfter(joinDate, fortyFiveDaysAgo)) historyStartDate = joinDate;
    }

    const dateRange = eachDayOfInterval({ start: historyStartDate, end: today });
    return dateRange.map(date => {
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
  }, [currentUser, attendanceRecords, holidays, effectiveEmployeeId, effectiveEmployeeName, isAdminRole, isMounted, employeeRecords, registeredEmployee, employees]);

  const paginatedHistory = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return history.slice(start, start + rowsPerPage);
  }, [history, currentPage]);

  const totalPages = Math.ceil(history.length / rowsPerPage);

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
    const time = format(now, "HH:mm");
    const today = format(now, "yyyy-MM-dd");

    const newRecord: Partial<AttendanceRecord> = {
      employeeId: effectiveEmployeeId,
      employeeName: effectiveEmployeeName,
      date: today,
      inTime: time,
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
    setActiveDialog("NONE");
    toast({ title: "Check-In Success", description: "Attendance logged successfully." });
  };

  const handleConfirmCheckOut = () => {
    if (!activeRecord || !currentGPS || !isAccessAllowed) return;
    const now = getISTTime();
    const time = format(now, "HH:mm");
    const inDateTime = new Date(`${activeRecord.date}T${activeRecord.inTime}`);
    const outDateTime = new Date(`${format(now, "yyyy-MM-dd")}T${time}`);
    const diffHours = (outDateTime.getTime() - inDateTime.getTime()) / (1000 * 60 * 60);
    
    let finalOutTime = time;
    let finalHours = parseFloat(diffHours.toFixed(2));
    let isAuto = diffHours > 16;

    // RULE: Auto-OUT after 16 hours capped at 8 hours
    if (isAuto) {
      const autoOutDate = new Date(inDateTime.getTime() + (8 * 60 * 60 * 1000));
      finalOutTime = format(autoOutDate, "HH:mm");
      finalHours = 8.0;
    }

    // Deduct unapproved out duration if any
    if (activeRecord.unapprovedOutDuration && activeRecord.unapprovedOutDuration > 0) {
      const deductionHours = activeRecord.unapprovedOutDuration / 60;
      finalHours = Math.max(0, finalHours - deductionHours);
    }

    updateRecord('attendance', activeRecord.id, { 
      outTime: finalOutTime, 
      hours: parseFloat(finalHours.toFixed(2)),
      attendanceTypeOut: detectedPlant ? 'OFFICE' : selectedType,
      latOut: currentGPS.lat,
      lngOut: currentGPS.lng,
      addressOut: detectedAddress,
      outPlant: detectedPlant?.name || "Remote",
      autoOut: isAuto
    });

    setActiveDialog("NONE");
    toast({ title: "Check-Out Success", description: `Shift ended at ${finalOutTime}.` });
  };

  const handleSaveEdit = () => {
    if (!isSuperAdmin || !selectedRecordToEdit || isProcessing) return;
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
          hours: finalHours,
          status: finalHours > 0 ? 'PRESENT' : 'ABSENT',
          attendanceType: 'FIELD',
          approved: false,
          address: 'Manual Entry'
        });
      } else {
        updateRecord('attendance', selectedRecordToEdit.id, {
          inTime: editTimes.in || null,
          outTime: editTimes.out || null,
          hours: finalHours,
          status: finalHours > 0 ? 'PRESENT' : 'ABSENT'
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

        {/* Device Binding Security Alert */}
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
            <CardHeader className="text-center py-4"><CardTitle className="text-lg font-black flex items-center justify-center gap-2 text-slate-800"><ShieldCheck className="text-primary w-5 h-5" /> Gateway Portal</CardTitle></CardHeader>
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
                {myLeaveRequests.length === 0 ? (<div className="p-10 text-center text-xs text-muted-foreground font-medium">No active leave records.</div>) : (
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
                <TableHeader className="bg-slate-50"><TableRow>
                  <TableHead className="font-bold">Employee Name</TableHead>
                  <TableHead className="font-bold">In Plant</TableHead>
                  <TableHead className="font-bold">In Time</TableHead>
                  <TableHead className="font-bold">Out Time</TableHead>
                  <TableHead className="font-bold text-center">Type</TableHead>
                  <TableHead className="font-bold text-center">Status</TableHead>
                  <TableHead className="font-bold text-center">Hours</TableHead>
                  <TableHead className="font-bold">Approval</TableHead>
                  {isSuperAdmin && <TableHead className="font-bold text-right pr-6">Action</TableHead>}
                </TableRow></TableHeader>
                <TableBody>
                  {paginatedHistory.length === 0 ? (<TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">No records.</TableCell></TableRow>) : (
                    paginatedHistory.map((h: any) => (
                      <TableRow key={h.id} className="hover:bg-slate-50/50">
                        <TableCell className="text-sm font-bold uppercase">{h.employeeName}</TableCell>
                        <TableCell className="text-sm font-bold text-slate-700">{h.inPlant || "--"}</TableCell>
                        <TableCell className="font-mono text-xs">{formatDate(h.date)} {h.inTime || "--:--"}</TableCell>
                        <TableCell className="font-mono text-xs">{formatDate(h.date)} {h.outTime || "--:--"}</TableCell>
                        <TableCell className="text-center"><Badge variant="outline" className="text-[9px] font-black uppercase">{h.attendanceType}</Badge></TableCell>
                        <TableCell className="text-center"><Badge className={cn("text-[9px] font-black uppercase tracking-widest", h.status === 'PRESENT' ? "bg-emerald-50 text-emerald-700" : h.status === 'ABSENT' ? "bg-rose-50 text-rose-700" : "bg-slate-50 text-slate-700")}>{h.status}</Badge></TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={cn("font-black text-xs px-2.5 py-0.5", getWorkingHoursColor(h.hours || 0))}>
                            {h.hours || 0}h
                          </Badge>
                        </TableCell>
                        <TableCell>{h.approved ? <Badge className="bg-emerald-600 uppercase text-[9px] rounded-full">Approved</Badge> : <Badge variant="secondary" className="bg-amber-50 text-amber-600 uppercase text-[9px] rounded-full">Pending</Badge>}</TableCell>
                        {isSuperAdmin && (<TableCell className="text-right pr-6"><Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-primary" onClick={() => { setSelectedRecordToEdit(h); setEditTimes({ in: h.inTime || "", out: h.outTime || "" }); setIsEditDialogOpen(true); }}><Pencil className="w-4 h-4" /></Button></TableCell>)}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
            {totalPages > 1 && (<CardFooter className="bg-slate-50 border-t flex items-center justify-between p-4"><Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>Previous</Button><span className="text-xs font-black">Page {currentPage} of {totalPages}</span><Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>Next</Button></CardFooter>)}
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">From Date</Label>
                  <Input 
                    type="date" 
                    value={leaveFrom} 
                    min={todayStr} 
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
                    min={leaveFrom || todayStr} 
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
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400">Purpose</Label><Input placeholder="Reason..." value={leavePurpose} onChange={(e) => setLeavePurpose(e.target.value)} className="h-12 font-bold" /></div>
            </div>
            <DialogFooter className="p-6 bg-slate-50 border-t gap-3"><Button variant="ghost" onClick={() => setActiveDialog("NONE")}>Cancel</Button><Button className="bg-primary font-black px-8" onClick={handleSendLeaveRequest} disabled={isSubmittingLeave}>Send Request</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
