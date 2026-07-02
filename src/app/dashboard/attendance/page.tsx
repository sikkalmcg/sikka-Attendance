"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  MapPin, 
  Clock, 
  ShieldCheck, 
  History,
  Loader2,
  Navigation,
  Briefcase,
  Home,
  CheckCircle,
  AlertTriangle,
  Calendar,
  LogOut,
  Eye,
  CalendarDays
} from "lucide-react";
import { calculateDistance, cn, formatDate, getWorkingHoursColor, formatHoursToHHMM, parseDateTime } from "@/lib/utils";
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableRow, 
  TableHead, 
  TableCell 
} from "@/components/ui/table";
import { Plant } from "@/lib/types";
import { useData } from "@/context/data-context";
import { format, parseISO, addHours, isAfter, isValid, startOfMonth, endOfMonth, addDays, isSunday, isSameMonth, subMonths, differenceInMinutes, differenceInCalendarDays, isBefore, startOfToday, startOfDay } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogDescription
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PROJECT_START_DATE_STR = "2026-04-01";

const getISTTime = () => {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
};

const getPreciseDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// --- LEAVE REQUEST FORM COMPONENT ---
function LeaveRequestForm() {
  const [open, setOpen] = useState(false);
  const { addRecord, verifiedUser, leaveRequests } = useData();
  const { toast } = useToast();
  const [purpose, setPurpose] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [remark, setRemark] = useState("");

  const todayStr = format(startOfToday(), "yyyy-MM-dd");

  const recommendedLeaves = [
    "Sick Leave",
    "Casual Leave",
    "Earned Leave",
    "Emergency Leave",
    "Privilege Leave"
  ];

  const totalDays = fromDate && toDate && !isBefore(new Date(toDate), new Date(fromDate))
    ? differenceInCalendarDays(new Date(toDate), new Date(fromDate)) + 1
    : 0;

  const handleRemarkChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const words = e.target.value.split(/\s+/).filter(Boolean);
    if (words.length <= 20) {
      setRemark(e.target.value);
    } else {
      toast({
        variant: "destructive",
        title: "Word Limit Exceeded",
        description: "Remark cannot exceed 20 words.",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const today = startOfToday(); 
    
    if (!purpose || !fromDate || !toDate) {
      toast({ variant: "destructive", title: "Incomplete Form", description: "Please fill all required fields." });
      return;
    }

    const selectedFromDate = startOfDay(new Date(fromDate));
    const selectedToDate = startOfDay(new Date(toDate));

    if (isBefore(selectedFromDate, today)) {
      toast({ variant: "destructive", title: "Invalid Date", description: "Leave request past date se allow nahi hai. Kripya aaj ki ya bhavishya ki date chunein." });
      return;
    }

    if (isBefore(selectedToDate, selectedFromDate)) {
      toast({ variant: "destructive", title: "Invalid Date Range", description: "To Date cannot be before From Date." });
      return;
    }

    const empId = verifiedUser?.employeeId || verifiedUser?.username || "N/A";
    const hasDuplicate = (leaveRequests || []).some((req: any) => 
      req.employeeId === empId &&
      String(req.status).toUpperCase() !== 'REJECTED' &&
      (new Date(fromDate) <= new Date(req.toDate) && new Date(toDate) >= new Date(req.fromDate))
    );

    if (hasDuplicate) {
      toast({ variant: "destructive", title: "Duplicate Request", description: "A leave request for these dates already exists." });
      return;
    }

    try {
      await addRecord('leaveRequests', {
        employeeId: empId,
        firmId: verifiedUser?.firmId || "N/A",
        employeeName: verifiedUser?.fullName || "N/A",
        department: verifiedUser?.department || "Operations",
        designation: verifiedUser?.designation || "Staff",
        purpose,
        fromDate,
        toDate,
        days: totalDays,
        remark,
        status: 'UNDER_PROCESS',
        createdAt: new Date().toISOString()
      });
      toast({ title: "Leave Request Submitted", description: "Your request has been sent for approval." });
      setOpen(false);
      setPurpose("");
      setFromDate("");
      setToDate("");
      setRemark("");
    } catch (error) {
      toast({ variant: "destructive", title: "Submission Failed", description: "Could not submit your leave request." });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider rounded-xl py-2 px-4 h-9 flex items-center justify-center gap-2 shadow-sm">
          <CalendarDays className="w-4 h-4" /> Leave Request
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-md font-black uppercase tracking-tight text-slate-900">New Leave Request</DialogTitle>
          <DialogDescription className="text-xs text-slate-400 uppercase font-semibold">Fill in the details below to apply for leave.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="purpose" className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Leave Purpose / Type</Label>
            <Input id="purpose" placeholder="e.g. Sick Leave, Casual Leave" value={purpose} onChange={(e) => setPurpose(e.target.value)} className="h-10 border-slate-200 bg-slate-50 rounded-xl text-xs font-bold" required />
            
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {recommendedLeaves.map((leaveType) => (
                <Badge
                  key={leaveType}
                  variant="secondary"
                  className={cn(
                    "cursor-pointer text-[10px] font-bold uppercase rounded-lg px-2 py-1 transition-all border border-slate-200/60 bg-white text-slate-600 hover:bg-slate-100",
                    purpose === leaveType && "bg-primary text-white border-primary hover:bg-primary/90"
                  )}
                  onClick={() => setPurpose(leaveType)}
                >
                  {leaveType}
                </Badge>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="fromDate" className="text-[10px] font-black uppercase text-slate-500 tracking-wider">From Date</Label>
              <Input id="fromDate" type="date" min={todayStr} value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-10 border-slate-200 bg-slate-50 rounded-xl text-xs font-bold" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="toDate" className="text-[10px] font-black uppercase text-slate-500 tracking-wider">To Date</Label>
              <Input id="toDate" type="date" min={fromDate || todayStr} value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-10 border-slate-200 bg-slate-50 rounded-xl text-xs font-bold" required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Total Leave Days</Label>
            <Input value={totalDays > 0 ? `${totalDays} Day(s)` : ""} placeholder="0 Days" disabled readOnly className="h-10 border-slate-200 bg-slate-100 rounded-xl text-xs font-black text-primary" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="remark" className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Remark (Optional, Max 20 words)</Label>
            <Textarea id="remark" placeholder="Provide any additional notes..." value={remark} onChange={handleRemarkChange} className="min-h-[70px] border-slate-200 bg-slate-50 rounded-xl font-medium text-xs" />
          </div>
          <DialogFooter className="flex flex-row gap-3 pt-2">
            <Button variant="ghost" type="button" onClick={() => setOpen(false)} className="flex-1 rounded-xl font-bold h-11 uppercase text-xs">Cancel</Button>
            <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90 font-black text-white rounded-xl h-11 uppercase text-xs">Submit Request</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AttendancePage() {
  const { attendanceRecords = [], addRecord, updateRecord, refreshData, plants = [], verifiedUser, isLoading, holidays = [], employees = [], leaveRequests = [] } = useData();
  const [isMutatingAttendance, setIsMutatingAttendance] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [activeDialog, setActiveDialog] = useState<"NONE" | "IN" | "OUT" | "DETAILS">("NONE");
  
  const [currentGPS, setCurrentGPS] = useState<{ lat: number, lng: number } | null>(null);
  const [detectedPlant, setDetectedPlant] = useState<Plant | null>(null);
  const [detectedAddress, setDetectedAddress] = useState("");
  const [detailedLocation, setDetailedLocation] = useState({ street: "", area: "", city: "", state: "", pincode: "" });
  const [selectedType, setSelectedType] = useState<"FIELD" | "WFH" | "">("");

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("N/A");
  const [selectedExitEvent, setSelectedExitEvent] = useState<any>(null);

  const isAutoTriggering = useRef(false);
  const { toast } = useToast();

  useEffect(() => {
    setIsMounted(true);
    setCurrentTime(getISTTime());
    const timer = setInterval(() => setCurrentTime(getISTTime()), 1000);
    return () => clearInterval(timer);
  }, []);

  const isHRorAdmin = useMemo(() => {
    if (!verifiedUser) return false;
    if (typeof verifiedUser.role === "string") {
      const role = verifiedUser.role.toUpperCase();
      return role === "HR" || role === "ADMIN" || role === "SUPER_ADMIN";
    }
    return false;
  }, [verifiedUser]);

  useEffect(() => {
    if (isHRorAdmin && employees.length > 0 && (selectedEmployeeId === "N/A" || selectedEmployeeId === "")) {
      setSelectedEmployeeId(employees[0].employeeId);
    }
  }, [isHRorAdmin, employees, selectedEmployeeId]);

  const effectiveEmployeeId = useMemo(() => {
    if (!verifiedUser) return "N/A";
    if (isHRorAdmin) return selectedEmployeeId || "N/A";
    return verifiedUser?.employeeId || verifiedUser?.username || "N/A";
  }, [verifiedUser, isHRorAdmin, selectedEmployeeId]);

  const effectiveEmployeeName = useMemo(() => {
    if (isHRorAdmin) {
      const emp = employees.find((e: any) => e.employeeId === selectedEmployeeId);
      return emp ? (emp.firstName ? `${emp.firstName} ${emp.lastName || ""}`.trim() : (emp.name || emp.employeeId)) : "N/A";
    }
    return verifiedUser?.fullName || "N/A";
  }, [verifiedUser, isHRorAdmin, selectedEmployeeId, employees]);

  const employeeRecords = useMemo(() => {
    if (!effectiveEmployeeId || effectiveEmployeeId === "N/A") return [];
    
    const now = getISTTime();
    const todayStr = format(now, "yyyy-MM-dd");
    const ninetyDaysAgo = getISTTime();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const ninetyDaysAgoStr = format(ninetyDaysAgo, "yyyy-MM-dd");
    
    const startDateStr = ninetyDaysAgoStr < PROJECT_START_DATE_STR ? PROJECT_START_DATE_STR : ninetyDaysAgoStr;

    const myRecords = (attendanceRecords || [])
      .filter(r => r.employeeId === effectiveEmployeeId && r.date >= startDateStr && r.date <= todayStr);
      
    const recordsByDate = new Map<string, any[]>();
    myRecords.forEach(r => {
       if (!recordsByDate.has(r.date)) recordsByDate.set(r.date, []);
       recordsByDate.get(r.date)!.push(r);
    });

    const fullHistory: any[] = [];
    let currentD = now;
    
    while (format(currentD, "yyyy-MM-dd") >= startDateStr) {
       const dateStr = format(currentD, "yyyy-MM-dd");
       
       if (recordsByDate.has(dateStr)) {
          const dayRecords = recordsByDate.get(dateStr)!;
          dayRecords.sort((a, b) => (b.inTime || "").localeCompare(a.inTime || ""));
          fullHistory.push(...dayRecords);
       } else {
          const isSun = isSunday(currentD);
          const holidayObj = holidays.find((h: any) => h.date === dateStr);
          
          let displayStatus = isSun ? 'Weekly Off' : 'Absent';
          if (holidayObj) displayStatus = 'Holiday';

          fullHistory.push({
             id: `missing-${dateStr}`,
             employeeName: effectiveEmployeeName,
             date: dateStr,
             inTime: null,
             outTime: null,
             hours: 0,
             status: displayStatus,
             attendanceType: holidayObj ? holidayObj.name : 'N/A',
             address: null,
             addressOut: null,
             inPlant: holidayObj ? holidayObj.name : (isSun ? 'Weekly Off' : 'N/A'),
             remark: holidayObj ? holidayObj.name : (isSun ? 'Weekly Off' : 'Absent')
          });
       }
       currentD = addDays(currentD, -1);
    }

    return fullHistory;
  }, [attendanceRecords, effectiveEmployeeId, holidays, effectiveEmployeeName]);

  const userLeaveRequests = useMemo(() => {
    return (leaveRequests || [])
      .filter((l: any) => l.employeeId === effectiveEmployeeId)
      .sort((a: any, b: any) => new Date(b.createdAt || b.fromDate).getTime() - new Date(a.createdAt || a.fromDate).getTime());
  }, [leaveRequests, effectiveEmployeeId]);

  const allPlantExitHistory = useMemo(() => {
    const exits: any[] = [];
    attendanceRecords.forEach((record: any) => {
      if (record.exitEvents && Array.isArray(record.exitEvents)) {
        record.exitEvents.forEach((event: any) => {
          exits.push({
            ...event,
            employeeId: record.employeeId,
            employeeName: record.employeeName,
            date: record.date,
            inTime: record.inTime,
            outTime: record.outTime,
            plantName: record.inPlant || "Salt Plant",
            attendanceId: record.id || record._id
          });
        });
      }
    });
    return exits.sort((a, b) => b.exitTime.localeCompare(a.exitTime));
  }, [attendanceRecords]);

  const monthlySummaries = useMemo(() => {
    const now = getISTTime();
    const monthsMap = new Map<string, { presentDates: Set<string>; monthDate: Date; totalMinutes: number }>();

    for (let i = 0; i < 3; i++) {
      const mDate = subMonths(now, i);
      const mKey = format(mDate, "yyyy-MM");
      monthsMap.set(mKey, {
        presentDates: new Set(),
        monthDate: startOfMonth(mDate),
        totalMinutes: 0,
      });
    }

    employeeRecords.forEach((r: any) => {
      const rDate = parseISO(r.date);
      if (!isValid(rDate)) return;

      const mKey = format(rDate, "yyyy-MM");
      if (!monthsMap.has(mKey)) return;

      const isMissing = String(r.id || "").startsWith("missing-");
      const hasWorkedHours = !isMissing && typeof r.hours === "number" && r.hours > 0;

      if (r.inTime && !isMissing) {
        monthsMap.get(mKey)!.presentDates.add(r.date);
      }

      if (hasWorkedHours) {
        const minutes = Math.round(r.hours * 60);
        monthsMap.get(mKey)!.totalMinutes += minutes;
      }
    });

    const sortedMonths = Array.from(monthsMap.entries()).sort((a, b) => b[0].localeCompare(a[0]));

    return sortedMonths.map(([mKey, data]) => {
      const monthYearStr = format(data.monthDate, "MMM-yy");
      const presentDays = data.presentDates.size;
      const start = data.monthDate;
      const end = isSameMonth(data.monthDate, now) ? now : endOfMonth(data.monthDate);

      let workingDays = 0;
      for (let d = start; d <= end; d = addDays(d, 1)) {
        workingDays++;
      }

      const absentDays = Math.max(0, workingDays - presentDays);
      const totalHoursFloat = data.totalMinutes / 60;

      return {
        monthYear: monthYearStr,
        present: presentDays,
        absent: absentDays,
        workedHours: formatHoursToHHMM(totalHoursFloat),
      };
    });
  }, [employeeRecords]);

  const { activeRecord, todayRecord, isStale, nextInAvailableAt, canMarkOut, nextOutAvailableAt } = useMemo(() => {
    const now = currentTime || getISTTime();
    const todayStr = format(now, "yyyy-MM-dd");

    const active = employeeRecords.find((r) => r.status === "Open");
    const todayRec = employeeRecords.find((r) => r.date === todayStr && !r.id?.startsWith('missing-'));

    const lastClosed = employeeRecords
      .filter((r) => r.status === "Closed" || r.status === "Auto OUT")
      .sort((a, b) => {
        const adt = a.outDateTime ? parseISO(a.outDateTime) : (a.outDate && a.outTime ? parseDateTime(a.outDate, a.outTime) : null);
        const bdt = b.outDateTime ? parseISO(b.outDateTime) : (b.outDate && b.outTime ? parseDateTime(b.outDate, b.outTime) : null);
        const at = adt && isValid(adt) ? adt.getTime() : 0;
        const bt = bdt && isValid(bdt) ? bdt.getTime() : 0;
        return bt - at;
      })[0];

    const nextIn = lastClosed?.nextInEnableTime ? parseISO(lastClosed.nextInEnableTime) : null;

    const inDT = active?.inDateTime
      ? parseISO(active.inDateTime)
      : (active?.inDate && active?.inTime ? parseDateTime(active.inDate, active.inTime) : null);

    let canOut = false;
    let nextOutAt: Date | null = null;

    if (active && inDT && isValid(inDT)) {
      nextOutAt = addHours(inDT, 2);
      canOut = !isAfter(nextOutAt, now);
    }

    let stale = false;
    if (active && inDT && isValid(inDT)) {
      const triggerTime = addHours(inDT, 16);
      if (isAfter(now, triggerTime)) stale = true;
    }

    return {
      activeRecord: active || null,
      todayRecord: todayRec || null,
      isStale: stale,
      nextInAvailableAt: nextIn && isValid(nextIn) ? nextIn : null,
      canMarkOut: !!(active && canOut),
      nextOutAvailableAt: nextOutAt && isValid(nextOutAt) ? nextOutAt : null,
    };
  }, [employeeRecords, currentTime]);

  const isCooldownLocked = useMemo(() => {
    if (!nextInAvailableAt || !currentTime) return false;
    return isAfter(nextInAvailableAt, currentTime);
  }, [nextInAvailableAt, currentTime]);

  const isEmployeeLogin = useMemo(() => {
    if (!verifiedUser) return false;
    if (verifiedUser.employeeId && !verifiedUser.role) return true;
    if (typeof verifiedUser.role === 'string' && verifiedUser.role.toUpperCase() === 'EMPLOYEE') return true;
    if (Array.isArray(verifiedUser.role) && verifiedUser.role.map((r: any) => String(r).toUpperCase()).includes('EMPLOYEE')) return true;
    return false;
  }, [verifiedUser]);

  // --- AUTOMATIC AUTO-OUT EFFECT LAYER ---
  useEffect(() => {
    if (isStale && activeRecord && !isMutatingAttendance && !isAutoTriggering.current) {
      requestLocation("OUT_AUTO");
    }
  }, [isStale, activeRecord]);

  // --- REWORKED HIGH-RESPONSE GEOFENCE TRACKER WITH SYNC ---
  useEffect(() => {
    if (!activeRecord || activeRecord.status !== "Open" || !navigator.geolocation) return;

    const trackGeofenceBoundary = async () => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude: lat, longitude: lng } = position.coords;
          const assignedPlant = plants.find(p => p.name === (activeRecord.inPlant || "Salt Plant")) || plants[0];
          
          if (!assignedPlant) return;

          const distance = getPreciseDistance(lat, lng, assignedPlant.lat, assignedPlant.lng);
          const allowedRadius = assignedPlant.radius || 700;
          const timeNowStr = format(getISTTime(), "yyyy-MM-dd HH:mm");

          let currentEvents = activeRecord.exitEvents ? [...activeRecord.exitEvents] : [];
          let currentActiveEvent = currentEvents.find(e => !e.returnTime);

          if (distance > allowedRadius) {
            let geocodedAddress = "Location Unavailable";
            try {
              const res = await fetch('/api/geocode/reverse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lat, lng })
              });
              if (res.ok) {
                const data = await res.json();
                geocodedAddress = data?.address?.Match_addr || data?.address || "Salt Plant Outside Zone";
              }
            } catch (e) {
              console.error("Geofence reverse geocoding failed", e);
            }

            const newLocationHistoryPoint = {
              time: timeNowStr,
              address: geocodedAddress,
              lat,
              lng,
              distance: parseFloat(distance.toFixed(1))
            };

            if (!currentActiveEvent) {
              currentActiveEvent = {
                exitTime: timeNowStr,
                returnTime: null,
                outsideDuration: null,
                locationHistory: [newLocationHistoryPoint]
              };
              currentEvents.push(currentActiveEvent);
            } else {
              const history = currentActiveEvent.locationHistory || [];
              const lastPoint = history[history.length - 1];
              if (!lastPoint || lastPoint.address !== geocodedAddress) {
                history.push(newLocationHistoryPoint);
                currentActiveEvent.locationHistory = history;
              }
            }

            // Sync with backend & force reload states for real-time approval lists
            await updateRecord('attendance', activeRecord.id || activeRecord._id, {
              exitEvents: currentEvents,
              currentGeofenceStatus: "Outside Plant"
            });
            await refreshData();
          } else {
            if (currentActiveEvent) {
              const exitTimeParsed = parseISO(currentActiveEvent.exitTime.replace(" ", "T"));
              const duration = differenceInMinutes(getISTTime(), exitTimeParsed);
              
              currentActiveEvent.returnTime = timeNowStr;
              currentActiveEvent.outsideDuration = `${Math.floor(duration / 60)}h ${duration % 60}m`;

              await updateRecord('attendance', activeRecord.id || activeRecord._id, {
                exitEvents: currentEvents,
                currentGeofenceStatus: "Inside Plant"
              });

              toast({
                title: "Returned to Plant",
                description: `Welcome back inside the geofence perimeter.`
              });
              await refreshData();
            }
          }
        },
        async (error) => {
          console.error("Geofence verification dynamic lookup failed", error);
        },
        { enableHighAccuracy: true }
      );
    };

    // Tracking loop performance calibrated to 2 minutes for immediate visual response
    const geofenceWorkerId = setInterval(trackGeofenceBoundary, 2 * 60 * 1000);
    return () => clearInterval(geofenceWorkerId);
  }, [activeRecord, plants]);

  const handleMarkInClick = () => {
    if (isCooldownLocked) return;
    requestLocation("IN");
  };

  const performAutoCheckOut = async (lat: number, lng: number, address: string, components: any, plant: Plant | null) => {
    if (!activeRecord || isMutatingAttendance) return;
    
    const inDT = activeRecord.inDateTime ? parseISO(activeRecord.inDateTime) : parseDateTime(activeRecord.inDate || activeRecord.date, activeRecord.inTime || "");
    if (!inDT || !isValid(inDT)) return;

    const creditOutDT = addHours(inDT, 8); 
    const finalOutDate = format(creditOutDT, "yyyy-MM-dd");
    const finalOutTime = format(creditOutDT, "HH:mm");
    
    const recordId = activeRecord.id || (activeRecord as any)._id;
    if (!recordId) return;

    setIsMutatingAttendance(true);
    try {
      await updateRecord('attendance', recordId, { 
        outTime: finalOutTime,
        outDate: finalOutDate,
        outDateTime: creditOutDT.toISOString(),
        hours: 8.0,
        status: 'Auto OUT',
        outType: 'Auto',
        latOut: lat,
        lngOut: lng,
        addressOut: address || "",
        streetOut: components.street || "Unknown Street",
        areaOut: components.area || "Unknown Area",
        cityOut: components.city || "NCR",
        stateOut: components.state || "Uttar Pradesh",
        pincodeOut: components.pincode || "N/A",
        outPlant: plant ? plant.name : "N/A",
        autoCheckout: true,
        autoOut: true,
        autoTriggerTime: getISTTime().toISOString(),
        nextInEnableTime: addHours(creditOutDT, 8).toISOString(),
        remark: "System Auto-Logged OUT (16h Limit Threshold reached); stored OUT = IN + 8h"
      });

      await addRecord('notifications', {
        message: `${effectiveEmployeeName} – AUTO OUT Processed | Recorded OUT: ${format(creditOutDT, "dd-MMM HH:mm")}`,
        timestamp: format(getISTTime(), "yyyy-MM-dd HH:mm:ss"),
        read: false,
        type: 'AUTO_OUT',
        employeeId: effectiveEmployeeId
      });

      toast({ 
        title: "Auto OUT Triggered", 
        description: "Session closed after 16 hours limit. 8 hours credited to your ledger." 
      });

      await refreshData();
    } catch (e) {
      console.error("Auto checkout error:", e);
    } finally {
      setIsMutatingAttendance(false);
      isAutoTriggering.current = false;
    }
  };

  const requestLocation = (type: "IN" | "OUT" | "OUT_AUTO") => {
    if (type === "IN" && isCooldownLocked) {
      toast({
        variant: "destructive",
        title: "Next Mark IN Locked",
        description: `Your 8-hour check-in restriction is active. Access opens at ${nextInAvailableAt ? format(nextInAvailableAt, "dd-MMM HH:mm") : "later"}.`,
        duration: 8000,
      });
      return;
    }

    if (isMutatingAttendance) return;

    setIsLoadingLocation(true);
    setDetectedPlant(null);
    setDetectedAddress(""); 

    if (type === "OUT_AUTO") {
      isAutoTriggering.current = true;
    }

    const processGeocoding = async (lat: number, lng: number) => {
      try {
          const response = await fetch('/api/geocode/reverse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat, lng })
          });

          const data = await response.json();
          let components = { street: "", area: "", city: "", state: "", pincode: "" };

          if (response.ok) {
            let geocodedAddress = "";
            if (data?.address) {
              if (typeof data.address === 'object') {
                geocodedAddress = data.address.Match_addr || data.address.LongLabel || data.address.Address || "";
              } else if (typeof data.address === 'string') {
                geocodedAddress = data.address;
              }
            }

            const raw = data?.components;
            components = {
              street: typeof raw?.street === 'string' ? raw.street : '',
              area: typeof raw?.area === 'string' ? raw.area : '',
              city: typeof raw?.city === 'string' ? raw.city : '',
              state: typeof raw?.state === 'string' ? raw.state : '',
              pincode: typeof raw?.pincode === 'string' ? raw.pincode : '',
            };

            setDetectedAddress(geocodedAddress);
            setDetailedLocation(components);
            setCurrentGPS({ lat, lng });

            const qualifiedPlants = (plants || [])
              .map(p => ({ plant: p, distance: getPreciseDistance(lat, lng, p.lat, p.lng) }))
              .filter(p => p.distance <= (p.plant.radius || 700))
              .sort((a, b) => a.distance - b.distance);

            if (qualifiedPlants.length > 0) {
              setDetectedPlant(qualifiedPlants[0].plant);
            } else {
              setDetectedPlant(null);
            }

            if (type === "OUT_AUTO" && isAutoTriggering.current) {
              isAutoTriggering.current = false;
              performAutoCheckOut(lat, lng, geocodedAddress, components, qualifiedPlants.length > 0 ? qualifiedPlants[0].plant : null);
            }
          } else {
            console.warn('Reverse geocode failed', data);
            toast({ variant: "destructive", title: "Location Error", description: "Could not resolve readable address coordinates." });
          }

      } catch (error) {
        console.error("Fast geocoding failed", error);
        toast({ variant: "destructive", title: "Location Timeout", description: "Network error occurred while fetching position parameters." });
      } finally {
        if (type !== "OUT_AUTO") {
          setActiveDialog(type);
          setIsLoadingLocation(false);
        }
      }
    };

    if (!navigator.geolocation) {
      toast({ variant: "destructive", title: "Geolocation Unavailable", description: "GPS not supported on this device." });
      setIsLoadingLocation(false);
      return;
    }

    const emergencyTimeout = setTimeout(() => {
      if (detectedAddress === "") {
        setIsLoadingLocation(false);
        toast({ 
          variant: "destructive", 
          title: "GPS Tracking Failed", 
          description: "System could not securely identify device coordinates. Action rejected." 
        });
      }
    }, 12000);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(emergencyTimeout);
        processGeocoding(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        console.log("Instant positioning error, fallback routing", err);
        clearTimeout(emergencyTimeout);
        setIsLoadingLocation(false);
        toast({ 
          variant: "destructive", 
          title: "Location Denied", 
          description: "Please verify GPS system permissions are enabled to continue." 
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleConfirmCheckIn = async () => {
    if (isMutatingAttendance) return;

    if (!detectedPlant && !selectedType) {
      toast({ variant: "destructive", title: "Selection Mandatory", description: "Please select WFH or Field Work to continue outside radius bounds." });
      return;
    }

    const now = getISTTime();
    const today = format(now, "yyyy-MM-dd");
    const timeStr = format(now, "HH:mm");
    
    const plantName = detectedPlant ? detectedPlant.name : "N/A"; 
    const finalAddress = detectedAddress || "Salt Plant Zone, NCR";
    
    const attendanceType = detectedPlant 
      ? 'Plant Attendance' 
      : (selectedType === 'WFH' ? 'Work From Home' : 'Field Work');
      
    const remark = detectedPlant 
      ? `Checked IN at ${plantName}` 
      : `Checked IN for ${attendanceType}`;

    setIsMutatingAttendance(true);
    setActiveDialog("NONE");

    try {
      await addRecord('attendance', {
        employeeId: effectiveEmployeeId,
        employeeName: effectiveEmployeeName,
        aadhaarNumber: "[Aadhaar Redacted]",
        mobileNumber: verifiedUser?.mobileNumber || "N/A",
        date: today,
        inDate: today,
        inTime: timeStr,
        inDateTime: now.toISOString(),
        hours: 0,
        status: 'Open',
        attendanceType: attendanceType,
        lat: currentGPS?.lat || 28.6329, 
        lng: currentGPS?.lng || 77.4357,
        address: finalAddress,
        street: detectedPlant ? (detectedPlant.name || "Plant") : (detailedLocation.street || "Industrial Bypass"),
        area: detectedPlant ? "Plant Radius Zone" : (detailedLocation.area || "Industrial Zone"),
        city: detailedLocation.city || "NCR",
        state: detailedLocation.state || "Uttar Pradesh",
        pincode: detailedLocation.pincode || "N/A",
        inPlant: plantName,
        remark: remark,
        approved: false,
        unapprovedOutDuration: 0,
        currentGeofenceStatus: detectedPlant ? "Inside Plant" : "Outside Plant",
        exitEvents: []
      });

      await refreshData();
      setSelectedType(""); 
      toast({ title: "Mark IN Successful", description: detectedPlant ? `Welcome back to ${plantName}` : `Logged as ${attendanceType}` });
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Failed to process database entry register log." });
    } finally {
      setIsMutatingAttendance(false);
    }
  };

  const handleConfirmCheckOut = async () => {
    if (!activeRecord || isMutatingAttendance) return;

    if (!activeRecord.inTime) {
      toast({
        variant: "destructive",
        title: "Mark IN Required",
        description: "Cannot Mark OUT because no valid Mark IN record exists for today.",
      });
      return;
    }

    const now = getISTTime();
    const inDT = activeRecord.inDateTime
      ? parseISO(activeRecord.inDateTime)
      : parseDateTime(activeRecord.inDate || activeRecord.date, activeRecord.inTime || "");
    const outDT = now;

    if (!inDT || !isValid(inDT)) {
      toast({
        variant: "destructive",
        title: "Invalid Mark IN",
        description: "Stored Mark IN date/time is invalid. Please Mark IN again.",
      });
      return;
    }

    let finalHours = 0;
    if (isValid(inDT) && isValid(outDT)) {
      const diffHours = (outDT.getTime() - inDT.getTime()) / (1000 * 60 * 60);
      finalHours = parseFloat(Math.max(0, diffHours).toFixed(2));
    }

    const nextEnableDT = addHours(outDT, 8);
    const recordId = activeRecord.id || (activeRecord as any)._id;

    const finalAddressOut = detectedAddress || activeRecord.address || (detectedPlant as any)?.address || "Registered Zone";
    const finalLat = currentGPS?.lat || activeRecord.lat || 28.6329;
    const finalLng = currentGPS?.lng || activeRecord.lng || 77.4357;

    if (!recordId) {
      toast({ variant: "destructive", title: "Error", description: "Record ID not found." });
      return;
    }

    setIsMutatingAttendance(true);
    setActiveDialog("NONE");

    try {
      let finalExitEvents = activeRecord.exitEvents ? [...activeRecord.exitEvents] : [];
      let incompleteEvent = finalExitEvents.find(e => !e.returnTime);
      if (incompleteEvent) {
        const timeNowStr = format(now, "yyyy-MM-dd HH:mm");
        const exitTimeParsed = parseISO(incompleteEvent.exitTime.replace(" ", "T"));
        const duration = differenceInMinutes(now, exitTimeParsed);
        incompleteEvent.returnTime = timeNowStr;
        incompleteEvent.outsideDuration = `${Math.floor(duration / 60)}h ${duration % 60}m`;
      }

      await updateRecord('attendance', recordId, { 
        outTime: format(outDT, "HH:mm"), 
        outDate: format(outDT, "yyyy-MM-dd"),
        outDateTime: outDT.toISOString(),
        hours: finalHours,
        status: 'Closed',
        outType: 'Manual',
        latOut: finalLat, 
        lngOut: finalLng,
        addressOut: finalAddressOut,
        streetOut: detectedPlant ? (detectedPlant.name || "Plant") : (detailedLocation.street || activeRecord.street || "Unknown Street"),
        areaOut: detectedPlant ? "Plant Radius Zone" : (detailedLocation.area || activeRecord.area || "Unknown Area"),
        cityOut: detailedLocation.city || activeRecord.city || "NCR",
        stateOut: detectedPlant ? "Uttar Pradesh" : (detailedLocation.state || activeRecord.state || "NCR"),
        pincodeOut: detailedLocation.pincode || activeRecord.pincode || "N/A",
        outPlant: detectedPlant ? detectedPlant.name : "N/A",
        nextInEnableTime: nextEnableDT.toISOString(),
        exitEvents: finalExitEvents,
        currentGeofenceStatus: "Shift Closed"
      });

      await refreshData();
      toast({ title: "Mark OUT Successful" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Failed to Mark OUT" });
    } finally {
      setIsMutatingAttendance(false);
    }
  };

  const handleViewEventDetails = (event: any) => {
    setSelectedExitEvent(event);
    setActiveDialog("DETAILS");
  };

  if (!isMounted) return null;

  return (
    <div className="space-y-8 pb-12 px-4 max-w-5xl mx-auto">
      {isEmployeeLogin && (
      <div className="max-w-xl mx-auto w-full space-y-6">
        <Card className="shadow-2xl border-none overflow-hidden bg-white">
          <div className="h-1.5 bg-primary" />
          <CardHeader className="text-center py-6 relative">
            <CardTitle className="text-xl font-black flex items-center justify-center gap-2 text-slate-800 uppercase tracking-tight">
              <ShieldCheck className="text-primary w-6 h-6" /> Gateway Portal
            </CardTitle>
            <div className="absolute top-4 right-4">
              <LeaveRequestForm />
            </div>
          </CardHeader>
          <CardContent className="space-y-8 px-8 pb-10">
            <div className="py-8 px-10 rounded-[2.5rem] bg-slate-50 text-slate-900 flex flex-col items-center justify-center space-y-1 shadow-inner border border-slate-100 max-w-[300px] mx-auto group hover:bg-primary/5 transition-colors">
              {currentTime ? (
                <div className="text-center">
                  <h2 className="text-[55px] font-black tracking-tighter font-mono leading-none text-slate-900">{format(currentTime, "HH:mm")}</h2>
                  <p className="text-[11px] font-black text-primary mt-3 flex items-center justify-center gap-1.5 uppercase tracking-[0.2em]">{format(currentTime, "dd MMM yyyy")}</p>
                </div>
              ) : (
                <Loader2 className="w-10 h-10 text-slate-200 animate-spin" />
              )}
            </div>

            {activeRecord && !canMarkOut && nextOutAvailableAt && (
              <div className="p-5 bg-[#FFFDE7] rounded-2xl border border-amber-200 text-amber-800 animate-in fade-in max-w-md mx-auto w-full text-left shadow-sm">
                <p className="text-xs font-black uppercase tracking-tight text-amber-900">
                  ACTIVE SHIFT SINCE {format(activeRecord.inDateTime ? parseISO(activeRecord.inDateTime) : getISTTime(), "dd-MMM")}, {activeRecord.inTime} {format(activeRecord.inDateTime ? parseISO(activeRecord.inDateTime) : getISTTime(), "aa")}
                </p>
                <p className="text-[11px] font-bold text-amber-700 mt-1 leading-relaxed">
                  Mark OUT will be available on {format(nextOutAvailableAt, "dd-MMM-yyyy HH:mm")}
                </p>
              </div>
            )}

            <div className="flex gap-4">
              <Button 
                className={cn("flex-1 h-16 text-sm font-black rounded-2xl shadow-xl transition-all uppercase tracking-widest", 
                  (!activeRecord && !isCooldownLocked) ? "bg-primary text-white shadow-primary/20 hover:bg-primary/90" : "bg-slate-100 text-slate-400"
                )} 
                disabled={isLoadingLocation || isMutatingAttendance || !!activeRecord || isCooldownLocked} 
                onClick={handleMarkInClick}
              >
                {isLoadingLocation && activeDialog === 'NONE' ? (
                  <span className="flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Fetching GPS...</span>
                ) : "Mark IN"}
              </Button>
              <Button 
                className={cn(
                  "flex-1 h-16 text-sm font-black rounded-2xl shadow-xl transition-all uppercase tracking-widest",
                  activeRecord ? "bg-rose-600 text-white shadow-rose-200 hover:bg-rose-700" : "bg-slate-100 text-slate-400",
                  activeRecord && !canMarkOut ? "opacity-70 hover:bg-rose-600/90" : ""
                )} 
                disabled={isLoadingLocation || isMutatingAttendance || !activeRecord || (activeRecord ? !canMarkOut : false)} 
                onClick={() => requestLocation("OUT")}
              >
                {activeRecord && !canMarkOut ? "Mark OUT (Locked)" : (isLoadingLocation && activeDialog === 'NONE' ? <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Mark OUT
                </> : "Mark OUT")}
              </Button>
            </div>

            <div className="pt-6 border-t border-slate-100 flex flex-col items-center justify-center w-full">
              {isCooldownLocked && nextInAvailableAt ? (
                <div className="flex flex-col items-center justify-center gap-1 text-amber-700 bg-amber-50 px-5 py-3 rounded-xl w-full border border-amber-200">
                  <span className="text-sm font-black uppercase tracking-wider">Rest Period Active</span>
                  <span className="text-xs font-bold text-center">Next Mark IN will be available on {format(nextInAvailableAt, "dd-MMM-yyyy HH:mm")}</span>
                </div>
              ) : activeRecord ? (
                <div className="w-full space-y-3">
                  <div className={cn("flex items-center justify-center gap-2 px-5 py-3 rounded-xl w-full border font-black text-sm uppercase tracking-wider",
                    activeRecord.currentGeofenceStatus === "Outside Plant" ? "text-rose-600 bg-rose-50 border-rose-100 animate-pulse" : "text-emerald-600 bg-emerald-50 border-emerald-100"
                  )}>
                    <MapPin className="w-4 h-4 animate-bounce" />
                    <span>{activeRecord.currentGeofenceStatus || "Inside Plant"}</span>
                  </div>
                  
                  <div className="flex items-center justify-center gap-2 text-slate-600 bg-[#F8F9FA] px-5 py-2.5 rounded-xl w-full border border-slate-200 shadow-sm font-black uppercase tracking-wider text-xs">
                    <ShieldCheck className="w-4 h-4 text-slate-500" />
                    <span>SHIFT STARTED: {format(activeRecord.inDateTime ? parseISO(activeRecord.inDateTime) : getISTTime(), "dd-MMM-yyyy")} {activeRecord.inTime}</span>
                  </div>
                </div>
              ) : todayRecord && todayRecord.outTime ? (
                <div className="flex items-center justify-center gap-2 text-blue-600 bg-blue-50 px-5 py-3 rounded-xl w-full border border-blue-100">
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-sm font-black uppercase tracking-wider">
                    Completed Shift - Hours: {formatHoursToHHMM(todayRecord.hours || 0)}
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 text-slate-500 bg-slate-50 px-5 py-3 rounded-xl w-full border border-slate-200">
                  <Clock className="w-5 h-5" />
                  <span className="text-sm font-black uppercase tracking-wider">Eligible for Mark IN</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
             {isHRorAdmin && (
               <Card className="p-4 rounded-2xl border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm border">
                 <div>
                   <h4 className="text-sm font-black uppercase text-slate-700 tracking-tight">Employee Attendance Ledger</h4>
                   <p className="text-xs text-slate-400 font-medium mt-0.5">Select an employee to view their real-time logs.</p>
                 </div>
                 <div className="w-full sm:w-72">
                   <Select
                     value={selectedEmployeeId}
                     onValueChange={(value) => setSelectedEmployeeId(value)}
                   >
                     <SelectTrigger className="w-full h-11 rounded-xl bg-white border-slate-200 font-bold text-xs text-slate-700 shadow-sm">
                       <SelectValue placeholder="Choose an Employee..." />
                     </SelectTrigger>
                     <SelectContent className="rounded-xl max-h-60">
                       {employees.length === 0 ? (
                         <SelectItem value="NONE" disabled>No employees found</SelectItem>
                       ) : (
                         <span className="block max-h-56 overflow-y-auto">
                           {employees.map((emp: any) => (
                             <SelectItem 
                               key={emp.employeeId} 
                               value={emp.employeeId}
                               className="font-bold text-xs text-slate-600"
                             >
                               {emp.firstName ? `${emp.firstName} ${emp.lastName || ""}`.trim() : (emp.name || emp.employeeId)} ({emp.employeeId})
                             </SelectItem>
                           ))}
                         </span>
                       )}
                     </SelectContent>
                   </Select>
                 </div>
               </Card>
             )}

             <h3 className="font-black text-lg flex items-center gap-2 text-slate-700 uppercase tracking-tight pt-2">
                <History className="w-5 h-5 text-primary" /> Session History
             </h3>
             <Card className="rounded-[1.5rem] overflow-hidden shadow-sm border-slate-200">
                <ScrollArea className="h-[400px]">
                   {isLoading && employeeRecords.length === 0 ? (
                     <div className="flex flex-col items-center justify-center py-20 space-y-3">
                       <Loader2 className="w-8 h-8 text-primary animate-spin" />
                       <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Syncing Ledger History...</p>
                     </div>
                   ) : (
                     <Table>
                        <TableHeader className="bg-slate-50">
                            <TableRow>
                               <TableHead className="font-black uppercase text-[10px]">Date</TableHead>
                               <TableHead className="font-black uppercase text-[10px] hidden xl:table-cell">Employee</TableHead>
                               <TableHead className="font-black uppercase text-[10px]">Plant Name</TableHead>
                               <TableHead className="font-black uppercase text-[10px]">In Time</TableHead>
                               <TableHead className="font-black uppercase text-[10px]">Out Time</TableHead>
                               <TableHead className="font-black uppercase text-[10px] hidden md:table-cell">In Address</TableHead>
                               <TableHead className="font-black uppercase text-[10px] hidden md:table-cell">Out Address</TableHead>
                               <TableHead className="font-black uppercase text-[10px]">Hours</TableHead>
                               <TableHead className="font-black uppercase text-[10px] hidden lg:table-cell">Remarks</TableHead>
                               <TableHead className="font-black uppercase text-[10px] text-right pr-6">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {employeeRecords.map((r: any) => (
                              <TableRow key={r.id || r._id} className="hover:bg-slate-50/50">
                                 <TableCell className="py-4">
                                    <div className="flex flex-col">
                                      <span className="text-xs font-bold text-slate-700">{formatDate(r.date)}</span>
                                      <span className="text-[10px] font-semibold text-slate-400 mt-0.5">{format(parseISO(r.date), "EEEE")}</span>
                                    </div>
                                 </TableCell>
                                 <TableCell className="hidden xl:table-cell text-xs font-bold text-slate-600 truncate max-w-[120px]">{r.employeeName || "N/A"}</TableCell>
                                 <TableCell className="text-xs font-bold text-slate-600">{r.inPlant && r.inPlant !== "N/A" ? r.inPlant : (r.attendanceType || "N/A")}</TableCell>
                                 <TableCell className="text-xs font-bold text-slate-500">{r.inTime || "--:--"}</TableCell>
                                 <TableCell className="text-xs font-bold text-slate-500">{r.outTime || "--:--"}</TableCell>
                                 <TableCell className="hidden md:table-cell text-[10px] font-medium text-slate-500 max-w-[150px] truncate" title={r.address}>{r.address || "N/A"}</TableCell>
                                 <TableCell className="hidden md:table-cell text-[10px] font-medium text-slate-500 max-w-[150px] truncate" title={r.addressOut}>{r.addressOut || "N/A"}</TableCell>
                                 <TableCell>
                                    <Badge variant="outline" className={cn("font-black text-[10px]", getWorkingHoursColor(r.hours || 0))}>
                                       {formatHoursToHHMM(r.hours || 0)}
                                    </Badge>
                                 </TableCell>
                                 <TableCell className="hidden lg:table-cell text-[10px] font-medium text-slate-500 max-w-[150px] truncate" title={r.remark}>{r.remark || "N/A"}</TableCell>
                                 <TableCell className="text-right pr-6">
                                    <Badge className={cn("text-[9px] font-black uppercase px-2 py-0.5 whitespace-nowrap", 
                                       r.status === 'Auto OUT' ? "bg-amber-100 text-amber-700" : 
                                       r.status === 'Open' ? "bg-blue-100 text-blue-700" :
                                       r.status === 'Absent' ? "bg-rose-100 text-rose-700" :
                                       (r.status === 'Weekly Off' || r.status === 'Holiday') ? "bg-slate-100 text-slate-700" :
                                       "bg-emerald-100 text-emerald-700"
                                    )}>
                                       {r.status === 'Open' ? 'Active Shift' : r.status === 'Closed' ? 'Completed Shift' : r.status === 'Auto OUT' ? 'Auto Closed Shift' : r.status}
                                    </Badge>
                                 </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                     </Table>
                   )}
                </ScrollArea>
             </Card>
          </div>
          
          <div className="lg:col-span-1 space-y-4">
             <h3 className="font-black text-lg flex items-center gap-2 text-slate-700 uppercase tracking-tight">
                <Calendar className="w-5 h-5 text-primary" /> Monthly Summary
             </h3>
             <ScrollArea className="h-[400px]">
                <div className="space-y-4 pr-3">
                  {monthlySummaries.map((summary, idx) => (
                    <Card key={idx} className="rounded-[1.5rem] overflow-hidden shadow-sm border-slate-200 bg-white">
                      <CardHeader className="bg-slate-50/50 border-b py-4 px-6">
                         <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-500 text-center">
                            {summary.monthYear}
                         </CardTitle>
                      </CardHeader>
                      <CardContent className="p-5 space-y-3">
                         <div className="flex justify-between items-center bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Present Days</span>
                            <span className="text-xl font-black text-emerald-600">{summary.present}</span>
                         </div>
                         <div className="flex justify-between items-center bg-rose-50 rounded-xl p-3 border border-rose-100">
                            <span className="text-xs font-bold text-rose-700 uppercase tracking-wider">Absent Days</span>
                            <span className="text-xl font-black text-rose-600">{summary.absent}</span>
                         </div>
                         <div className="flex justify-between items-center bg-slate-50 rounded-xl p-3 border border-slate-100">
                            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Worked Hours</span>
                            <span className="text-xl font-black text-slate-900">{summary.workedHours}</span>
                         </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
             </ScrollArea>
          </div>
      </div>

      {/* --- LEAVE APPROVAL HISTORY SECTION --- */}
      <div className="space-y-4 pt-4">
        <h3 className="font-black text-lg flex items-center gap-2 text-slate-700 uppercase tracking-tight">
          <CalendarDays className="w-5 h-5 text-primary" /> Leave Approval History
        </h3>
        <Card className="rounded-[1.5rem] overflow-hidden shadow-sm border-slate-200 bg-white">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="font-black uppercase text-[10px]">Employee Name</TableHead>
                <TableHead className="font-black uppercase text-[10px]">Leave Type</TableHead>
                <TableHead className="font-black uppercase text-[10px]">From Date</TableHead>
                <TableHead className="font-black uppercase text-[10px]">To Date</TableHead>
                <TableHead className="font-black uppercase text-[10px]">Days</TableHead>
                <TableHead className="font-black uppercase text-[10px]">Remark</TableHead>
                <TableHead className="font-black uppercase text-[10px] text-right pr-6">Status</TableHead>
                <TableHead className="font-black uppercase text-[10px]">Approved/Rejected By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {userLeaveRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    No leave requests logged for this employee context.
                  </TableCell>
                </TableRow>
              ) : (
                userLeaveRequests.map((leave: any) => (
                  <TableRow key={leave.id || leave._id} className="hover:bg-slate-50/50">
                    <TableCell className="text-xs font-bold text-slate-700">{leave.employeeName || effectiveEmployeeName}</TableCell>
                    <TableCell className="text-xs font-bold text-slate-600">{leave.purpose}</TableCell>
                    <TableCell className="text-xs font-bold text-slate-500">{formatDate(leave.fromDate)}</TableCell>
                    <TableCell className="text-xs font-bold text-slate-500">{formatDate(leave.toDate)}</TableCell>
                    <TableCell className="text-xs font-black text-slate-700">{leave.days}</TableCell>
                    <TableCell className="text-[11px] font-medium text-slate-500 max-w-[150px] truncate" title={leave.remark}>{leave.remark || "-"}</TableCell>
                    <TableCell className="text-right pr-6">
                      <Badge className={cn("text-[9px] font-black uppercase px-2 py-0.5 whitespace-nowrap", 
                        String(leave.status).toUpperCase() === 'APPROVED' ? "bg-emerald-100 text-emerald-700 border-none" : 
                        String(leave.status).toUpperCase() === 'REJECTED' ? "bg-rose-100 text-rose-700 border-none" :
                        "bg-amber-100 text-amber-700 border-none"
                      )}>
                        {String(leave.status).toUpperCase() === 'APPROVED' ? 'Approved' : String(leave.status).toUpperCase() === 'REJECTED' ? 'Rejected' : 'Pending'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[10px] font-bold text-slate-600 uppercase font-mono">
                      {leave.processedByUserId || "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* HR/ADMIN Geofence Approvals & Exit Tracking Section */}
      {isHRorAdmin && (
        <div className="space-y-4 pt-4">
          <h3 className="font-black text-lg flex items-center gap-2 text-slate-700 uppercase tracking-tight">
            <LogOut className="w-5 h-5 text-rose-500" /> Employee Plant Exit History
          </h3>
          <Card className="rounded-[1.5rem] overflow-hidden shadow-sm border-slate-200">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-black uppercase text-[10px]">Employee</TableHead>
                  <TableHead className="font-black uppercase text-[10px]">Attendance Date</TableHead>
                  <TableHead className="font-black uppercase text-[10px]">Plant</TableHead>
                  <TableHead className="font-black uppercase text-[10px]">Mark IN</TableHead>
                  <TableHead className="font-black uppercase text-[10px]">Mark OUT</TableHead>
                  <TableHead className="font-black uppercase text-[10px]">Exit Time</TableHead>
                  <TableHead className="font-black uppercase text-[10px]">Return Time</TableHead>
                  <TableHead className="font-black uppercase text-[10px]">Outside Duration</TableHead>
                  <TableHead className="font-black uppercase text-[10px] text-right pr-6">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allPlantExitHistory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-xs font-bold text-slate-400 uppercase tracking-wider">
                      No Geofence Exit violations logged.
                    </TableCell>
                  </TableRow>
                ) : (
                  allPlantExitHistory.map((event: any, index: number) => (
                    <TableRow key={index} className="hover:bg-slate-50/50">
                      <TableCell className="text-xs font-bold text-slate-700">{event.employeeName} ({event.employeeId})</TableCell>
                      <TableCell className="text-xs font-bold text-slate-600">{formatDate(event.date)}</TableCell>
                      <TableCell className="text-xs font-bold text-slate-600 uppercase">{event.plantName}</TableCell>
                      <TableCell className="text-xs font-medium text-slate-500">{event.inTime || "--:--"}</TableCell>
                      <TableCell className="text-xs font-medium text-slate-500">{event.outTime || "--:--"}</TableCell>
                      <TableCell className="text-xs font-bold text-rose-600">{event.exitTime.split(" ")[1] || event.exitTime}</TableCell>
                      <TableCell className="text-xs font-bold text-emerald-600">{event.returnTime ? event.returnTime.split(" ")[1] : "Still Outside"}</TableCell>
                      <TableCell className="text-xs font-black text-slate-700">{event.outsideDuration || "--"}</TableCell>
                      <TableCell className="text-right pr-6">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-8 rounded-lg font-black text-[10px] uppercase border-primary/20 text-primary hover:bg-primary/5 flex items-center gap-1 ml-auto"
                          onClick={() => handleViewEventDetails(event)}
                        >
                          <Eye className="w-3 h-3" /> View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      {/* View Geofence Location Trajectory Details Dialog */}
      <Dialog
        open={activeDialog === "DETAILS"}
        onOpenChange={(o) => {
          if (!o) setActiveDialog("NONE");
        }}
      >
        <DialogContent className="sm:max-w-2xl rounded-[2.5rem] overflow-hidden p-0 border-none shadow-2xl">
          <DialogHeader className="p-8 bg-slate-900 text-white shrink-0">
            <DialogTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-tight">
              <MapPin className="w-6 h-6 text-primary" /> Exit Trajectory Logs
            </DialogTitle>
          </DialogHeader>
          <div className="p-8">
            <ScrollArea className="h-[300px] rounded-xl border border-slate-100 p-2 bg-slate-50/50">
              <Table>
                <TableHeader className="bg-slate-100">
                  <TableRow>
                    <TableHead className="font-black uppercase text-[10px]">Date & Time</TableHead>
                    <TableHead className="font-black uppercase text-[10px]">Full Address</TableHead>
                    <TableHead className="font-black uppercase text-[10px]">Latitude</TableHead>
                    <TableHead className="font-black uppercase text-[10px]">Longitude</TableHead>
                    <TableHead className="font-black uppercase text-[10px] text-right">Distance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedExitEvent?.locationHistory && selectedExitEvent.locationHistory.length > 0 ? (
                    selectedExitEvent.locationHistory.map((loc: any, idx: number) => (
                      <TableRow key={idx} className="bg-white hover:bg-slate-50">
                        <TableCell className="text-xs font-bold text-slate-600 whitespace-nowrap">{loc.time}</TableCell>
                        <TableCell className="text-xs text-slate-600 max-w-[200px] break-words font-medium">{loc.address}</TableCell>
                        <TableCell className="text-xs font-mono text-slate-500">{loc.lat.toFixed(5)}</TableCell>
                        <TableCell className="text-xs font-mono text-slate-500">{loc.lng.toFixed(5)}</TableCell>
                        <TableCell className="text-xs font-black text-rose-600 text-right">{loc.distance} m</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6 text-xs text-slate-400 font-bold uppercase">
                        No tracking coordinate blocks found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t">
            <Button className="w-full h-12 font-black bg-slate-800 hover:bg-slate-900 text-white rounded-xl uppercase tracking-widest" onClick={() => setActiveDialog("NONE")}>
              CLOSE
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark IN Confirmation Pop-up */}
      <Dialog
        open={activeDialog === "IN"}
        onOpenChange={(o) => {
          if (!o) setActiveDialog("NONE");
        }}
      >
        <DialogContent className="sm:max-w-xl rounded-[2.5rem] overflow-hidden p-0 border-none shadow-2xl">
          <DialogHeader className="p-8 bg-slate-900 text-white shrink-0">
            <DialogTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-tight">
              <MapPin className="w-6 h-6 text-primary" /> Welcome, {effectiveEmployeeName}
            </DialogTitle>
          </DialogHeader>
          <div className="p-10 space-y-6">
            <div>
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Employee Name</Label>
              <p className="text-md font-black text-slate-900 uppercase mt-0.5">{effectiveEmployeeName}</p>
            </div>

            <div>
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Current Date & Time</Label>
              <p className="text-sm font-bold text-slate-700 mt-0.5">
                {format(currentTime || getISTTime(), "dd-MMM-yyyy hh:mm:ss a")}
              </p>
            </div>

            <div className="p-5 bg-slate-50 rounded-[1.5rem] border border-slate-100 shadow-inner">
              <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2 mb-3">
                <Navigation className="w-3.5 h-3.5" /> Captured GPS Address
              </Label>
              <div className="text-xs font-bold text-slate-700">
                <span className="text-slate-800 whitespace-normal break-words leading-relaxed">
                  {detectedAddress || (
                    <span className="text-slate-400 flex items-center gap-1.5 font-medium italic">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> Capturing secure telemetry address bounds...
                    </span>
                  )}
                </span>
              </div>
            </div>

            {detectedPlant ? (
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center gap-3">
                <div className="bg-emerald-500 p-2 rounded-xl text-white">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <Label className="text-[9px] font-black uppercase text-emerald-700 tracking-wider">Verified Facility Geofence Zone</Label>
                  <p className="text-sm font-black text-emerald-900 uppercase">{detectedPlant.name}</p>
                </div>
              </div>
            ) : (
              detectedAddress && (
                <div className="space-y-4 pt-2 border-t border-slate-100 animate-in fade-in duration-200">
                  <div className="flex items-start gap-2 text-rose-600 bg-rose-50/50 p-3 rounded-xl border border-rose-100">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <p className="text-[11px] font-bold uppercase tracking-wide">
                      Outside Plant Radius Constraints (700m). Selection is Mandatory to authorize ledger sign-in.
                    </p>
                  </div>
                  <RadioGroup value={selectedType} onValueChange={(v: any) => setSelectedType(v)} className="grid grid-cols-2 gap-4">
                    <div 
                      className={cn(
                        "p-5 border-2 rounded-2xl cursor-pointer transition-all flex flex-col items-center gap-3", 
                        selectedType === 'WFH' ? "border-primary bg-primary/5 shadow-md shadow-primary/5" : "border-slate-100 bg-white hover:border-slate-200 shadow-sm"
                      )} 
                      onClick={() => setSelectedType('WFH')}
                    >
                      <Home className={cn("w-6 h-6", selectedType === 'WFH' ? "text-primary" : "text-slate-400")} />
                      <span className="font-black text-[10px] uppercase tracking-wider text-slate-700">Work From Home</span>
                    </div>
                    <div 
                      className={cn(
                        "p-5 border-2 rounded-2xl cursor-pointer transition-all flex flex-col items-center gap-3", 
                        selectedType === 'FIELD' ? "border-primary bg-primary/5 shadow-md shadow-primary/5" : "border-slate-100 bg-white hover:border-slate-200 shadow-sm"
                      )} 
                      onClick={() => setSelectedType('FIELD')}
                    >
                      <Briefcase className={cn("w-6 h-6", selectedType === 'FIELD' ? "text-primary" : "text-slate-400")} />
                      <span className="font-black text-[10px] uppercase tracking-wider text-slate-700">Field Work</span>
                    </div>
                  </RadioGroup>
                </div>
              )
            )}
          </div>
          <DialogFooter className="p-8 bg-slate-50 border-t flex flex-row gap-4">
            <Button variant="ghost" className="flex-1 h-14 font-black rounded-2xl text-white bg-rose-500 hover:bg-rose-600 uppercase tracking-widest text-xs" onClick={() => setActiveDialog("NONE")}>CANCEL</Button>
            <Button 
              className="flex-1 h-14 font-black bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl shadow-xl shadow-emerald-500/20 uppercase tracking-widest text-xs" 
              onClick={handleConfirmCheckIn} 
              disabled={isMutatingAttendance || !detectedAddress || (!detectedPlant && !selectedType)}
            >
              {isMutatingAttendance ? "PROCESSING..." : "MARK IN"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark OUT Confirmation Dialog */}
      <Dialog
        open={activeDialog === "OUT"}
        onOpenChange={(o) => {
          if (!o) setActiveDialog("NONE");
        }}
      >
        <DialogContent className="sm:max-w-xl rounded-[2.5rem] overflow-hidden p-0 border-none shadow-2xl">
          <DialogHeader className="p-8 bg-rose-600 text-white shrink-0">
            <DialogTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-tight">
              <Navigation className="w-6 h-6" /> {effectiveEmployeeName}
            </DialogTitle>
          </DialogHeader>
          <div className="p-10 space-y-8">
             <div className="grid grid-cols-2 gap-8">
               <div>
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Plant Name</Label>
                  <p className="text-sm font-black text-slate-900 uppercase mt-1">{detectedPlant?.name || "Outside Allowed Geofence"}</p>
               </div>
               <div>
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Current Date & Time</Label>
                  <p className="text-sm font-bold text-slate-700 mt-1">{format(currentTime || getISTTime(), "dd-MMM-yyyy HH:mm")}</p>
               </div>
            </div>

            {activeRecord && !canMarkOut && nextOutAvailableAt && (
              <div className="p-5 bg-[#FFFDE7] rounded-2xl border border-amber-200 text-amber-800 animate-in fade-in max-w-md mx-auto w-full text-left shadow-sm">
                <p className="text-xs font-black uppercase tracking-tight text-amber-900">
                  ACTIVE SHIFT SINCE {format(activeRecord.inDateTime ? parseISO(activeRecord.inDateTime) : getISTTime(), "dd-MMM")}, {activeRecord.inTime} {format(activeRecord.inDateTime ? parseISO(activeRecord.inDateTime) : getISTTime(), "aa")}
                </p>
                <p className="text-[11px] font-bold text-amber-700 mt-1 leading-relaxed">
                  Mark OUT will be available on {format(nextOutAvailableAt, "dd-MMM-yyyy HH:mm")}
                </p>
              </div>
            )}

            {activeRecord && canMarkOut && (
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center gap-2 font-black text-slate-700 uppercase tracking-wider text-xs">
                <ShieldCheck className="w-4 h-4 text-slate-400" />
                <span>SHIFT STARTED: {format(activeRecord.inDateTime ? parseISO(activeRecord.inDateTime) : getISTTime(), "dd-MMM-yyyy")} {activeRecord.inTime}</span>
              </div>
            )}

            <div className="p-6 bg-slate-50 rounded-[1.5rem] border border-slate-100 shadow-inner">
              <Label className="text-[10px] font-black uppercase text-rose-500 tracking-wider flex items-center gap-2 mb-4">
                <MapPin className="w-3.5 h-3.5" /> Employee Current Location
              </Label>
              <div className="space-y-2.5 text-xs font-bold text-slate-700">
                <div className="flex flex-col gap-2">
                  <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Address:</span>
                  <span className="text-slate-800 whitespace-normal break-words">
                    {detectedAddress || (
                      <span className="text-slate-400 flex items-center gap-1 font-medium">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> Fetching real-time address...
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {!detectedPlant && (
              <Alert className="bg-rose-50 border-rose-100 text-rose-700 rounded-2xl">
                <AlertTriangle className="h-4 w-4 text-rose-600" />
                <AlertDescription className="text-[10px] font-black uppercase tracking-widest">
                  Caution: You are checking out from an unregistered location.
                </AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter className="p-8 bg-slate-50 border-t flex flex-row gap-4">
            <Button variant="ghost" className="flex-1 h-14 font-black rounded-2xl text-white bg-blue-500 hover:bg-blue-600 text-xs uppercase" onClick={() => setActiveDialog("NONE")}>CANCEL</Button>
            <Button 
              className="flex-1 h-14 font-black bg-rose-600 hover:bg-rose-700 text-white rounded-2xl shadow-xl shadow-rose-200 uppercase tracking-widest text-xs" 
              onClick={handleConfirmCheckOut}
              disabled={isMutatingAttendance || !canMarkOut}
            >
              CHECK OUT
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}