
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
  Filter
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

  const { activeRecord, staleRecord } = useMemo(() => {
    const rec = (employeeRecords || []).find(r => r.inTime && !r.outTime);
    if (!rec) return { activeRecord: null, staleRecord: null };
    
    const inTimeStr = rec.inTime;
    const inDateTime = new Date(`${rec.inDate || rec.date}T${inTimeStr}`);
    
    if (!isValid(inDateTime)) return { activeRecord: null, staleRecord: null };
    
    const now = getISTTime();
    const diffHours = (now.getTime() - inDateTime.getTime()) / (1000 * 60 * 60);
    
    if (diffHours >= 16) return { activeRecord: null, staleRecord: rec };
    
    return { activeRecord: rec, staleRecord: null };
  }, [employeeRecords, currentTime]);

  const lockState = useMemo(() => {
    const latestRec = employeeRecords[0];
    if (!latestRec) return { isLocked: false, unlockTime: null };
    
    let effectiveOutDate = latestRec.outDate || latestRec.date;
    let effectiveOutTime = latestRec.outTime;
    
    if (!latestRec.outTime) {
      if (!latestRec.inTime || latestRec.inTime.trim() === "") return { isLocked: false, unlockTime: null };
      
      const inDT = new Date(`${latestRec.inDate || latestRec.date}T${latestRec.inTime}`);
      if (!isValid(inDT)) return { isLocked: false, unlockTime: null };
      
      const nowTime = getISTTime();
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
    addRecord('attendance', {
      employeeId: effectiveEmployeeId,
      employeeName: effectiveEmployeeName,
      date: today,
      inDate: today,
      inTime: format(now, "HH:mm"),
      hours: 0,
      status: 'PRESENT',
      attendanceType: detectedPlant ? 'OFFICE' : selectedType,
      lat: currentGPS.lat,
      lng: currentGPS.lng,
      address: detectedAddress,
      inPlant: detectedPlant?.name || "Remote",
      approved: false,
      unapprovedOutDuration: 0
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
    updateRecord('attendance', activeRecord.id, { 
      outTime: timeHHMM, 
      outDate: todayStrLocal,
      hours: finalHours,
      status: finalHours >= 2.0 ? 'PRESENT' : 'ABSENT',
      latOut: currentGPS.lat, 
      lngOut: currentGPS.lng,
      addressOut: detectedAddress,
      outPlant: detectedPlant?.name || "Remote"
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
      toast({ title: "Request Submitted" });
      setActiveDialog("NONE");
    } finally {
      setIsSubmittingLeave(false);
    }
  };

  const holidaySet = useMemo(() => new Set(holidays.map(h => h.date)), [holidays]);

  const history = useMemo(() => {
    if (!verifiedUser || !isMounted) return [];
    const now = getISTTime();

    const getPriorityStatus = (dateStr: string, record: any) => {
      const isSun = isSunday(parseISO(dateStr));
      const holiday = holidaySet.has(dateStr);
      if (record) return holiday ? "Present on Holiday" : isSun ? "Present on Weekly Off" : record.status;
      return holiday ? "Holiday" : isSun ? "Weekly Off" : "Absent";
    };

    let baseList = [];
    if (isAdminRole) {
      baseList = (attendanceRecords || []).filter(r => {
        if (r.date < PROJECT_START_DATE_STR) return false;
        
        // SECURITY: Filter history by plant access for managers
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

      baseList = baseList.map(r => ({ ...r, displayStatus: getPriorityStatus(r.date, r) }));
    } else {
      const empRecordMap = new Map();
      employeeRecords.forEach(r => empRecordMap.set(r.date, r));
      const dateRange = eachDayOfInterval({ start: parseISO(PROJECT_START_DATE_STR), end: startOfDay(new Date()) });
      baseList = dateRange.map(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const existing = empRecordMap.get(dateStr);
        if (existing) return { ...existing, displayStatus: getPriorityStatus(dateStr, existing) };
        if (isSameDay(date, now)) return null;
        return { id: `v-${dateStr}`, employeeId: effectiveEmployeeId, employeeName: effectiveEmployeeName, date: dateStr, status: 'ABSENT', displayStatus: getPriorityStatus(dateStr, null), approved: true, hours: 0, isVirtual: true };
      }).filter(Boolean).reverse();
    }
    return baseList;
  }, [verifiedUser, attendanceRecords, holidays, holidaySet, effectiveEmployeeId, effectiveEmployeeName, isAdminRole, isMounted, employeeRecords, oversightSearch, oversightMonth, userAssignedPlantIds, employees]);

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
            <CardHeader className="text-center py-4">
              <CardTitle className="text-lg font-black flex items-center justify-center gap-2 text-slate-800">
                <ShieldCheck className="text-primary w-5 h-5" /> Gateway Portal
              </CardTitle>
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
              <div className="flex gap-4">
                <Button 
                  className={cn("flex-1 h-14 text-sm font-black rounded-2xl shadow-lg transition-all", 
                    !isLoading && isAccessAllowed && !lockState.isLocked && !activeRecord ? "bg-primary text-white" : "bg-slate-100 text-slate-400 cursor-not-allowed"
                  )} 
                  disabled={isLoading || !isAccessAllowed || isLoadingLocation || !!activeRecord || (lockState.isLocked && lockState.unlockTime !== 'Shift Active')} 
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
                        <Badge className="text-[9px] font-black uppercase">{h.displayStatus}</Badge>
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
          <DialogContent className="sm:max-w-md rounded-2xl overflow-hidden p-0">
            <DialogHeader className="p-6 bg-slate-900 text-white"><DialogTitle>Confirm Attendance</DialogTitle><p className="text-xs font-bold text-slate-400 mt-2">{detectedAddress}</p></DialogHeader>
            <div className="p-8 space-y-6">
              {detectedPlant ? (
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center gap-4">
                  <Factory className="w-6 h-6 text-emerald-600" />
                  <div><p className="text-[10px] font-black uppercase text-emerald-600">Plant Detected</p><p className="font-black">{detectedPlant.name}</p></div>
                </div>
              ) : (
                <RadioGroup value={selectedType} onValueChange={(v: any) => setSelectedType(v)} className="grid grid-cols-2 gap-4">
                  <div className={cn("p-4 border-2 rounded-xl cursor-pointer", selectedType === 'FIELD' ? "border-primary bg-primary/5" : "border-slate-100")} onClick={() => setSelectedType('FIELD')}>
                    <Briefcase className="w-5 h-5 mb-2" /><Label className="font-bold">FIELD</Label>
                  </div>
                  <div className={cn("p-4 border-2 rounded-xl cursor-pointer", selectedType === 'WFH' ? "border-primary bg-primary/5" : "border-slate-100")} onClick={() => setSelectedType('WFH')}>
                    <Home className="w-5 h-5 mb-2" /><Label className="font-bold">W.F.H</Label>
                  </div>
                </RadioGroup>
              )}
            </div>
            <DialogFooter className="p-6 bg-slate-50"><Button className="w-full h-12 font-black bg-primary" onClick={handleConfirmCheckIn}>Confirm Check-In</Button></DialogFooter>
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
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase">From</Label><Input type="date" value={leaveFromDate} onChange={(e) => setLeaveFromDate(e.target.value)} /></div>
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase">To</Label><Input type="date" value={leaveToDate} onChange={(e) => setLeaveToDate(e.target.value)} /></div>
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
