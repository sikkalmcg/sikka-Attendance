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
  SendHorizontal
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
import { AttendanceRecord, Plant } from "@/lib/types";
import { useData } from "@/context/data-context";
import { format, subDays, eachDayOfInterval, isSunday, isSameDay, parseISO, addHours, differenceInHours, isAfter } from "date-fns";
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
  const { attendanceRecords, addRecord, updateRecord, plants, holidays, employees } = useData();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [activeDialog, setActiveDialog] = useState<"NONE" | "IN" | "OUT">("NONE");
  
  const [currentGPS, setCurrentGPS] = useState<{ lat: number, lng: number } | null>(null);
  const [detectedPlant, setDetectedPlant] = useState<Plant | null>(null);
  const [detectedAddress, setDetectedAddress] = useState("");
  const [manualType, setManualType] = useState<'FIELD' | 'WFH'>('FIELD');

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

  // Logic for Active Record and Restriction
  const employeeRecords = useMemo(() => {
    if (!effectiveEmployeeId) return [];
    return (attendanceRecords || []).filter(r => r.employeeId === effectiveEmployeeId);
  }, [attendanceRecords, effectiveEmployeeId]);

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
  }, [lastOutRecord, currentTime]); // Re-check as time passes

  // Auto-OUT Rule (16 Hours)
  useEffect(() => {
    if (!activeRecord || !activeRecord.inTime || !isMounted) return;

    const checkAutoOut = () => {
      const inDateTime = new Date(`${activeRecord.date}T${activeRecord.inTime}`);
      const now = getISTTime();
      const diff = differenceInHours(now, inDateTime);

      if (diff >= 16) {
        // FINAL_OUT_TIME = IN_TIME + 16hr - 8hr = IN_TIME + 8hr
        const finalOutDateTime = addHours(inDateTime, 8);
        const outDate = format(finalOutDateTime, "yyyy-MM-dd");
        const outTimeStr = format(finalOutDateTime, "HH:mm");

        updateRecord('attendance', activeRecord.id, {
          outTime: outTimeStr,
          hours: 8.0,
          status: 'PRESENT',
          autoOut: true,
          addressOut: "Auto marked by system",
          outPlant: activeRecord.inPlant || "Auto-OUT"
        });

        addRecord('notifications', {
          message: `AUTO-OUT: ${activeRecord.employeeName} shift closed automatically after 16 hours.`,
          timestamp: format(now, "yyyy-MM-dd HH:mm:ss"),
          read: false
        });

        toast({ 
          title: "Session Expired", 
          description: "System auto-marked OUT (16h Rule). 8h shift stored.",
          variant: "destructive"
        });
      }
    };

    const interval = setInterval(checkAutoOut, 60000); // Check every minute
    checkAutoOut(); // Initial check
    return () => clearInterval(interval);
  }, [activeRecord, isMounted]);

  const history = useMemo(() => {
    if (!currentUser || !isMounted) return [];
    
    if (isAdminRole) {
      const limitDate = subDays(new Date(), 45);
      return (attendanceRecords || [])
        .filter(r => {
          try {
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

    const today = new Date();
    const fortyFiveDaysAgo = subDays(today, 45);
    fortyFiveDaysAgo.setHours(0, 0, 0, 0);

    const dateRange = eachDayOfInterval({ start: fortyFiveDaysAgo, end: today });
    
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
  }, [currentUser, attendanceRecords, holidays, effectiveEmployeeId, effectiveEmployeeName, isAdminRole, isMounted, employeeRecords]);

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

    // Standard Shift Auto-Correction (Max 16 hours check)
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
      autoCheckout: isAuto
    });

    addRecord('notifications', {
      message: `${activeRecord.employeeName} marked OUT at ${finalOutTime} (Worked: ${finalHours}h)`,
      timestamp: format(now, "yyyy-MM-dd HH:mm:ss"),
      read: false
    });
    setActiveDialog("NONE");
    toast({ title: "Check-Out Success", description: `Shift ended at ${finalOutTime}.` });
  };

  const handleAdminEditClick = (rec: any) => {
    setSelectedRecordToEdit(rec);
    setEditTimes({ in: rec.inTime || "", out: rec.outTime || "" });
    setIsEditDialogOpen(true);
  };

  const handleSaveAdminEdit = () => {
    if (!selectedRecordToEdit || !currentUser) return;

    const inTime = editTimes.in;
    const outTime = editTimes.out;
    
    let hours = 0;
    if (inTime && outTime) {
      const dummyDate = "2024-01-01 ";
      const start = new Date(dummyDate + inTime);
      const end = new Date(dummyDate + outTime);
      const diffMs = end.getTime() - start.getTime();
      if (!isNaN(diffMs) && diffMs >= 0) {
        hours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
      }
    }

    const status = hours > ATTENDANCE_RULES.PRESENT_THRESHOLD ? 'PRESENT' : (hours > 0 ? 'HALF_DAY' : 'ABSENT');
    const isVirtual = selectedRecordToEdit.id.startsWith('virtual-');

    if (isVirtual) {
      addRecord('attendance', {
        employeeId: selectedRecordToEdit.employeeId,
        employeeName: selectedRecordToEdit.employeeName,
        date: selectedRecordToEdit.date,
        inTime,
        outTime,
        hours,
        status: status as any,
        attendanceType: 'FIELD',
        lat: 0,
        lng: 0,
        address: "Manually adjusted by Admin",
        approved: true,
        remark: "Manually posted by Super Admin"
      });
    } else {
      updateRecord('attendance', selectedRecordToEdit.id, { 
        inTime, 
        outTime, 
        hours, 
        status: status as any,
        remark: "Adjusted by Super Admin",
        approved: true 
      });
    }

    addRecord('notifications', {
      message: `ADMIN: ${currentUser.fullName} manually adjusted logs for ${selectedRecordToEdit.date}`,
      timestamp: format(getISTTime(), "yyyy-MM-dd HH:mm:ss"),
      read: false
    });
    setIsEditDialogOpen(false);
    toast({ title: "Manual Adjustment Applied", description: "Record has been updated and recalculated." });
  };

  const handleViewRejection = (rec: AttendanceRecord) => {
    setSelectedRecordForRejection(rec);
    setIsRejectionDialogOpen(true);
  };

  const handleResubmit = () => {
    if (!selectedRecordForRejection) return;
    
    updateRecord('attendance', selectedRecordForRejection.id, {
      remark: "", 
      approved: false 
    });

    addRecord('notifications', {
      message: `${selectedRecordForRejection.employeeName} resubmitted logs for ${selectedRecordForRejection.date}`,
      timestamp: format(getISTTime(), "yyyy-MM-dd HH:mm:ss"),
      read: false
    });

    setIsRejectionDialogOpen(false);
    toast({ title: "Resubmitted", description: "Logs sent back for approval." });
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
              Your login identity (Aadhaar/Mobile) is not found in the official Employee Directory. Only registered staff can access the Gateway Portal. Please contact HR for profile registration.
            </AlertDescription>
          </Alert>
        )}

        {lockState.isLocked && isAccessAllowed && (
          <Alert className="bg-amber-50 border-amber-200 animate-in fade-in slide-in-from-top-2">
            <Lock className="h-5 w-5 text-amber-600" />
            <AlertTitle className="font-bold text-amber-800">Check-In Restricted</AlertTitle>
            <AlertDescription className="text-amber-700 font-medium">
              Organization policy requires a mandatory 8-hour cooling period between shifts. You can mark attendance after <span className="font-black underline">{lockState.unlockTime}</span>.
            </AlertDescription>
          </Alert>
        )}

        {!isAdminRole && currentUser?.role !== 'EMPLOYEE' && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex gap-3 items-center">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <p className="text-xs font-bold text-amber-800">
              Administrator Mode: You are logged in as {currentUser?.role}. Gateway Portal controls are locked for non-employee accounts.
            </p>
          </div>
        )}

        <Card className="shadow-2xl border-none overflow-hidden bg-white max-w-md mx-auto">
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    className={cn(
                      "flex-1 h-14 text-sm font-black rounded-2xl transition-all active:scale-95 shadow-lg",
                      isAccessAllowed && !lockState.isLocked && !activeRecord ? "bg-primary hover:bg-primary/90 shadow-primary/20" : "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none"
                    )} 
                    disabled={!isAccessAllowed || isLoadingLocation || !!activeRecord || lockState.isLocked} 
                    onClick={() => requestLocation("IN")}
                  >
                    {isLoadingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : (isAccessAllowed ? (lockState.isLocked ? <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Locked</span> : "Mark Check-In") : <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Locked</span>)}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{lockState.isLocked ? `Wait until ${lockState.unlockTime}` : "Log Arrival Time"}</TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    className={cn(
                      "flex-1 h-14 text-sm font-black rounded-2xl transition-all active:scale-95 shadow-lg",
                      isAccessAllowed && activeRecord ? "bg-rose-500 hover:bg-rose-600 shadow-rose-100" : "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none"
                    )} 
                    disabled={!isAccessAllowed || isLoadingLocation || !activeRecord} 
                    onClick={() => requestLocation("OUT")}
                  >
                    {isLoadingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : (isAccessAllowed ? "Mark Check-Out" : <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Locked</span>)}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Log Departure Time</TooltipContent>
              </Tooltip>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4 max-w-6xl mx-auto pt-6">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-xl flex items-center gap-2 text-slate-700">
              <History className="w-6 h-6 text-primary" /> {isAdminRole ? 'Staff Attendance Oversight' : 'My Attendance History'}
            </h3>
          </div>
          <Card className="rounded-2xl overflow-hidden shadow-sm border-slate-200">
            <ScrollArea className="w-full" tabIndex={0}>
              <Table className="min-w-[1000px]">
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-bold">Employee Name</TableHead>
                    <TableHead className="font-bold">In Plant</TableHead>
                    <TableHead className="font-bold">In Date Time</TableHead>
                    <TableHead className="font-bold">Out Plant</TableHead>
                    <TableHead className="font-bold">Out Date Time</TableHead>
                    <TableHead className="font-bold text-center">Hours</TableHead>
                    <TableHead className="font-bold">Type</TableHead>
                    <TableHead className="font-bold">Approval Status</TableHead>
                    {isSuperAdmin && <TableHead className="font-bold text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedHistory.length === 0 ? (
                    <TableRow><TableCell colSpan={isSuperAdmin ? 9 : 8} className="text-center py-12 text-muted-foreground font-medium">No records found for last 45 days.</TableCell></TableRow>
                  ) : (
                    paginatedHistory.map((h: any) => (
                      <TableRow key={h.id} className="hover:bg-slate-50/50">
                        <TableCell className="text-sm font-bold text-slate-900">{h.employeeName}</TableCell>
                        <TableCell className="text-sm font-bold text-slate-700">{h.inPlant || "--"}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{h.date} {h.inTime || "--:--"}</TableCell>
                        <TableCell className="text-sm font-bold text-slate-700">{h.outPlant || "--"}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {h.date} {h.outTime || "--:--"}
                          {h.autoOut && <span className="block text-[8px] font-black text-rose-500 uppercase">Auto OUT by system</span>}
                        </TableCell>
                        <TableCell className={cn("font-black text-center", (h.status === 'ABSENT' || h.status === 'WEEKLY_OFF' || h.status === 'HOLIDAY') ? "text-rose-500" : "text-emerald-600")}>
                          {h.status === 'ABSENT' ? "0.00h" : (h.status === 'WEEKLY_OFF' || h.status === 'HOLIDAY') ? "0h" : `${h.hours || 0}h`}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] font-black uppercase tracking-tight rounded-full px-3 bg-slate-50 border-slate-200">
                            {h.attendanceType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {h.status === 'ABSENT' ? (
                            <Badge variant="destructive" className="border-none font-bold uppercase text-[9px] px-3 rounded-full">Absent</Badge>
                          ) : h.status === 'WEEKLY_OFF' || h.status === 'HOLIDAY' ? (
                            <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-400 font-bold uppercase text-[9px] px-3 rounded-full">{h.status.replace('_', ' ')}</Badge>
                          ) : h.approved ? (
                            <Badge className="bg-emerald-600 border-none font-bold uppercase text-[9px] px-3 rounded-full">Approved</Badge>
                          ) : h.remark ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge 
                                  variant="destructive" 
                                  className="border-none font-bold uppercase text-[9px] cursor-pointer hover:bg-rose-600 transition-colors px-3 rounded-full"
                                  onClick={() => handleViewRejection(h)}
                                >
                                  Rejected
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>View Rejection Reason</TooltipContent>
                            </Tooltip>
                          ) : (
                            <Badge variant="secondary" className="border-none font-bold uppercase text-[9px] bg-amber-50 text-amber-600 px-3 rounded-full">Pending</Badge>
                          )}
                        </TableCell>
                        {isSuperAdmin && (
                          <TableCell className="text-right">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-primary hover:bg-primary/5 rounded-full"
                                  onClick={() => handleAdminEditClick(h)}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Adjust Logs</TooltipContent>
                            </Tooltip>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
            {totalPages > 1 && (
              <CardFooter className="bg-slate-50 border-t flex items-center justify-between p-4">
                <div className="text-xs font-bold text-muted-foreground">
                  Showing {((currentPage - 1) * rowsPerPage) + 1} - {Math.min(currentPage * rowsPerPage, history.length)} of {history.length}
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                    className="h-8 rounded-lg font-bold"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                  </Button>
                  <div className="text-xs font-black px-4 bg-white h-8 flex items-center rounded-lg border border-slate-200 shadow-sm">
                    Page {currentPage} of {totalPages}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => p + 1)}
                    className="h-8 rounded-lg font-bold"
                  >
                    Next <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </CardFooter>
            )}
          </Card>
        </div>

        <Dialog open={activeDialog === "IN"} onOpenChange={(o) => !o && setActiveDialog("NONE")}>
          <DialogContent className="sm:max-w-md rounded-2xl border-none shadow-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-black text-xl">
                <Navigation className="w-5 h-5 text-primary" /> Confirm Check-In
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm border border-slate-100 shrink-0">
                    <MapPin className="w-5 h-5 text-slate-400" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Current Location</p>
                    <p className="text-sm font-bold text-slate-700 leading-snug">{detectedAddress || "Locating..."}</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 pt-4 border-t border-slate-200">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shadow-sm border border-primary/10 shrink-0">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Detected Plant</p>
                    <p className="text-sm font-bold text-primary">{detectedPlant ? detectedPlant.name : "Field / Remote"}</p>
                  </div>
                </div>
              </div>
              {!detectedPlant && (
                <div className="space-y-3 px-1">
                  <Label className="font-black text-[10px] uppercase tracking-widest text-slate-500">Work Mode Selection</Label>
                  <Select value={manualType} onValueChange={(v: any) => setManualType(v)}>
                    <SelectTrigger className="h-14 bg-white border-slate-200 rounded-2xl font-bold shadow-sm focus:ring-primary">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FIELD" className="font-bold">Field Work</SelectItem>
                      <SelectItem value="WFH" className="font-bold">Work From Home</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button 
                className="w-full h-14 rounded-2xl font-black bg-primary text-lg shadow-xl shadow-primary/30 active:scale-[0.98] transition-all" 
                onClick={handleConfirmCheckIn}
              >
                Confirm Check-In
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={activeDialog === "OUT"} onOpenChange={(o) => !o && setActiveDialog("NONE")}>
          <DialogContent className="sm:max-w-md rounded-2xl border-none shadow-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-black text-xl">
                <Navigation className="w-5 h-5 text-rose-500" /> Confirm Check-Out
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm border border-slate-100 shrink-0">
                    <MapPin className="w-5 h-5 text-slate-400" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Current Location</p>
                    <p className="text-sm font-bold text-slate-700 leading-snug">{detectedAddress || "Locating..."}</p>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button 
                className="w-full h-14 rounded-2xl font-black bg-rose-500 hover:bg-rose-600 text-lg shadow-xl shadow-rose-500/30 active:scale-[0.98] transition-all" 
                onClick={handleConfirmCheckOut}
              >
                Confirm Check-Out
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-primary" />
                Adjust Attendance Logs
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Employee</p>
                <p className="font-bold text-slate-700">{selectedRecordToEdit?.employeeName}</p>
                <p className="text-xs text-muted-foreground">{selectedRecordToEdit?.date}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold">In Time (24h)</Label>
                  <Input 
                    type="time" 
                    value={editTimes.in} 
                    onChange={(e) => setEditTimes(prev => ({...prev, in: e.target.value}))}
                    className="bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold">Out Time (24h)</Label>
                  <Input 
                    type="time" 
                    value={editTimes.out} 
                    onChange={(e) => setEditTimes(prev => ({...prev, out: e.target.value}))}
                    className="bg-white"
                  />
                </div>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                <p className="text-[10px] font-bold text-amber-700 leading-relaxed">
                  Note: Updating these times will automatically recalculate working hours and status based on organization thresholds.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="rounded-xl">Cancel</Button>
              <Button className="bg-primary px-8 rounded-xl font-bold" onClick={handleSaveAdminEdit}>Update Log</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isRejectionDialogOpen} onOpenChange={setIsRejectionDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center mb-2">
                <MessageCircle className="w-6 h-6 text-rose-600" />
              </div>
              <DialogTitle className="text-xl font-black">Log Rejection Reason</DialogTitle>
              <DialogDescription>
                Record for {selectedRecordForRejection?.date} was declined by HR.
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-6">
              <div className="p-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl space-y-3">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">HR Remark:</p>
                <p className="text-sm font-bold text-slate-700 leading-relaxed italic">
                  "{selectedRecordForRejection?.remark || "No specific reason provided."}"
                </p>
              </div>
              
              <div className="mt-6 flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <AlertCircle className="w-3.5 h-3.5" />
                Attempt: {selectedRecordForRejection?.rejectionCount || 1} of 2
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row gap-2">
              <Button variant="ghost" onClick={() => setIsRejectionDialogOpen(false)} className="rounded-xl font-bold flex-1">
                Close
              </Button>
              {(selectedRecordForRejection?.rejectionCount || 0) < 2 && (
                <Button 
                  onClick={handleResubmit} 
                  className="bg-primary rounded-xl font-black flex-1 shadow-lg shadow-primary/20 gap-2"
                >
                  <SendHorizontal className="w-4 h-4" /> Sent Again
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
