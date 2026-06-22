"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
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
  Calendar
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
import { format, parseISO, addHours, isAfter, isValid, startOfMonth, endOfMonth, addDays, isSunday, isSameMonth, subMonths } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";

const PROJECT_START_DATE_STR = "2026-04-01";

const getISTTime = () => {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
};

export default function AttendancePage() {
  const { attendanceRecords = [], addRecord, updateRecord, refreshData, plants = [], verifiedUser, isLoading, holidays = [] } = useData();
  const [isMutatingAttendance, setIsMutatingAttendance] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [activeDialog, setActiveDialog] = useState<"NONE" | "IN" | "OUT">("NONE");
  
  const [currentGPS, setCurrentGPS] = useState<{ lat: number, lng: number } | null>(null);
  const [detectedPlant, setDetectedPlant] = useState<Plant | null>(null);
  const [detectedAddress, setDetectedAddress] = useState("");
  const [detailedLocation, setDetailedLocation] = useState({ street: "", area: "", city: "", state: "", pincode: "" });
  const [selectedType, setSelectedType] = useState<"FIELD" | "WFH" | "">("");

  const isAutoTriggering = useRef(false);
  const { toast } = useToast();

  useEffect(() => {
    setIsMounted(true);
    setCurrentTime(getISTTime());
    const timer = setInterval(() => setCurrentTime(getISTTime()), 1000);
    return () => clearInterval(timer);
  }, []);

  const effectiveEmployeeId = useMemo(() => verifiedUser?.employeeId || verifiedUser?.username || "N/A", [verifiedUser]);
  const effectiveEmployeeName = useMemo(() => verifiedUser?.fullName || "N/A", [verifiedUser]);

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

  const monthlySummaries = useMemo(() => {
    const now = getISTTime();
    const monthsMap = new Map<string, { presentDates: Set<string>; monthDate: Date }>();

    for (let i = 0; i < 3; i++) {
      const mDate = subMonths(now, i);
      const mKey = format(mDate, "yyyy-MM");
      monthsMap.set(mKey, { presentDates: new Set(), monthDate: startOfMonth(mDate) });
    }

    employeeRecords.forEach((r: any) => {
          const rDate = parseISO(r.date);
          if (isValid(rDate)) {
              const mKey = format(rDate, "yyyy-MM");
              if (monthsMap.has(mKey)) {
                  if (r.inTime && !r.id?.startsWith('missing-')) {
                      monthsMap.get(mKey)!.presentDates.add(r.date);
                  }
              }
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
        
        return {
            monthYear: monthYearStr,
            present: presentDays,
            absent: absentDays
        };
    });
  }, [employeeRecords]);

  const { activeRecord, todayRecord, isStale, nextInAvailableAt } = useMemo(() => {
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
    const inDT = active?.inDateTime ? parseISO(active.inDateTime) : (active?.inDate && active?.inTime ? parseDateTime(active.inDate, active.inTime) : null);

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

  // 🌟 मुख्य सुधार: watchPosition हटाकर सिर्फ एक बार सटीक लोकेशन लेने के लिए getCurrentPosition लगाया
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

            const plant = (plants || []).find(p => calculateDistance(lat, lng, p.lat, p.lng) <= (p.radius || 700));
            setDetectedPlant(plant || null);

            if (type === "OUT_AUTO" && isAutoTriggering.current) {
              isAutoTriggering.current = false;
              performAutoCheckOut(lat, lng, geocodedAddress, components, plant || null);
            }
          } else {
            console.warn('Reverse geocode failed', data);
          }

      } catch (error) {
        console.error("Fast geocoding failed", error);
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

    // 3 सेकंड का इमरजेंसी फॉलबैक
    const emergencyTimeout = setTimeout(() => {
      if (detectedAddress === "") {
        const fallbackAddr = activeRecord?.address || (plants && plants[0] as any)?.address || "Salt Plant Industrial Zone, NCR";
        setDetectedAddress(fallbackAddr);
        if (type !== "OUT_AUTO") {
          setActiveDialog(type);
          setIsLoadingLocation(false);
        }
      }
    }, 3000);

    // हाई एक्यूरेसी के साथ फ्रेश लोकेशन केवल एक बार निकालेगा ताकि एड्रेस बार-बार न बदले
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(emergencyTimeout);
        processGeocoding(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        console.log("Instant positioning error, fallback routing", err);
        if (detectedAddress === "") {
          clearTimeout(emergencyTimeout);
          const fallbackAddr = activeRecord?.address || "Salt Plant Zone, NCR";
          setDetectedAddress(fallbackAddr);
          if (type !== "OUT_AUTO") {
            setActiveDialog(type);
            setIsLoadingLocation(false);
          }
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    if (isStale && activeRecord && !activeRecord.outTime && !isLoadingLocation && !isAutoTriggering.current) {
      isAutoTriggering.current = true;
      setTimeout(() => { isAutoTriggering.current = false; }, 10000);
      requestLocation("OUT_AUTO");
    }
  }, [isStale, activeRecord, isLoadingLocation]);

  const handleMarkInClick = () => {
    if (isCooldownLocked) return;
    requestLocation("IN");
  };

  const handleConfirmCheckIn = async () => {
    if (isMutatingAttendance) return;

    const now = getISTTime();
    const today = format(now, "yyyy-MM-dd");
    const timeStr = format(now, "HH:mm");
    const plantName = detectedPlant?.name || "Salt Plant"; 
    const finalAddress = detectedAddress || (detectedPlant as any)?.address || "Salt Plant Zone, NCR";

    setIsMutatingAttendance(true);
    setActiveDialog("NONE");

    try {
      await addRecord('attendance', {
        employeeId: effectiveEmployeeId,
        employeeName: effectiveEmployeeName,
        aadhaarNumber: verifiedUser?.aadhaarNumber || "N/A",
        mobileNumber: verifiedUser?.mobileNumber || "N/A",
        date: today,
        inDate: today,
        inTime: timeStr,
        inDateTime: now.toISOString(),
        hours: 0,
        status: 'Open',
        attendanceType: detectedPlant ? 'Plant Attendance' : (selectedType === 'WFH' ? 'Work From Home' : 'Field Work'),
        lat: currentGPS?.lat || 28.6329, 
        lng: currentGPS?.lng || 77.4357,
        address: finalAddress,
        street: detectedPlant ? (detectedPlant.name || "Plant") : (detailedLocation.street || "Industrial Bypass"),
        area: detectedPlant ? "Plant Radius Zone" : (detailedLocation.area || "Industrial Zone"),
        city: detailedLocation.city || "NCR",
        state: detailedLocation.state || "Uttar Pradesh",
        pincode: detailedLocation.pincode || "N/A",
        inPlant: detectedPlant ? detectedPlant.name : "N/A",
        remark: `Checked IN at ${plantName}`,
        approved: false,
        unapprovedOutDuration: 0
      });

      await refreshData();
      setSelectedType(""); 
      toast({ title: "Mark IN Successful", description: `Welcome back to ${plantName}` });
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Failed to Mark IN" });
    } finally {
      setIsMutatingAttendance(false);
    }
  };

  const handleConfirmCheckOut = async () => {
    if (!activeRecord || isMutatingAttendance) return;
    const now = getISTTime();
    
    const inDT = activeRecord.inDateTime ? parseISO(activeRecord.inDateTime) : parseDateTime(activeRecord.inDate || activeRecord.date, activeRecord.inTime || "");
    const outDT = now;
    
    let finalHours = 0;
    if (inDT && isValid(inDT) && isValid(outDT)) {
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
        nextInEnableTime: nextEnableDT.toISOString()
      });

      await refreshData();
      toast({ title: "Mark OUT Successful" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Failed to Mark OUT" });
    } finally {
      setIsMutatingAttendance(false);
    }
  };

  if (!isMounted) return null;

  return (
    <div className="space-y-8 pb-12 px-4 max-w-5xl mx-auto">
      {isEmployeeLogin && (
      <div className="max-w-xl mx-auto w-full">
        <Card className="shadow-2xl border-none overflow-hidden bg-white">
          <div className="h-1.5 bg-primary" />
          <CardHeader className="text-center py-6">
            <CardTitle className="text-xl font-black flex items-center justify-center gap-2 text-slate-800 uppercase tracking-tight">
              <ShieldCheck className="text-primary w-6 h-6" /> Gateway Portal
            </CardTitle>
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

            <div className="flex gap-4">
              <Button 
                className={cn("flex-1 h-16 text-sm font-black rounded-2xl shadow-xl transition-all uppercase tracking-widest", 
                  (!activeRecord && !isCooldownLocked) ? "bg-primary text-white shadow-primary/20 hover:bg-primary/90" : "bg-slate-100 text-slate-400"
                )} 
                disabled={isLoadingLocation || isMutatingAttendance || !!activeRecord || isCooldownLocked} 
                onClick={handleMarkInClick}
              >
                {isLoadingLocation && activeDialog === 'NONE' ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : "Mark IN"}
              </Button>
              <Button 
                className={cn("flex-1 h-16 text-sm font-black rounded-2xl shadow-xl transition-all uppercase tracking-widest", 
                  activeRecord ? "bg-rose-600 text-white shadow-rose-200 hover:bg-rose-700" : "bg-slate-100 text-slate-400"
                )} 
                disabled={isLoadingLocation || isMutatingAttendance || !activeRecord} 
                onClick={() => requestLocation("OUT")}
              >
                {isLoadingLocation && activeDialog === 'NONE' ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : "Mark OUT"}
              </Button>
            </div>

            <div className="pt-6 border-t border-slate-100 flex flex-col items-center justify-center w-full">
              {isCooldownLocked && nextInAvailableAt ? (
                <div className="flex flex-col items-center justify-center gap-1 text-amber-700 bg-amber-50 px-5 py-3 rounded-xl w-full border border-amber-200">
                  <span className="text-sm font-black uppercase tracking-wider">Rest Period Active</span>
                  <span className="text-xs font-bold text-center">Next Mark IN will be available on {format(nextInAvailableAt, "dd-MMM-yyyy HH:mm")}</span>
                </div>
              ) : activeRecord ? (
                <div className="flex items-center justify-center gap-2 text-emerald-600 bg-emerald-50 px-5 py-3 rounded-xl w-full border border-emerald-100">
                  <ShieldCheck className="w-5 h-5" />
                  <span className="text-sm font-black uppercase tracking-wider">Active Shift since {activeRecord.inTime}</span>
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
             <h3 className="font-black text-lg flex items-center gap-2 text-slate-700 uppercase tracking-tight">
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
                      </CardContent>
                    </Card>
                  ))}
                </div>
             </ScrollArea>
          </div>
      </div>

      {/* Mark IN Confirmation */}
      <Dialog
        open={activeDialog === "IN"}
        onOpenChange={(o) => {
          if (!o) {
            setActiveDialog("NONE");
          }
        }}
      >
        <DialogContent className="sm:max-w-xl rounded-[2.5rem] overflow-hidden p-0 border-none shadow-2xl">
          <DialogHeader className="p-8 bg-slate-900 text-white shrink-0">
            <DialogTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-tight">
              <MapPin className="w-6 h-6 text-primary" /> Welcome, {effectiveEmployeeName}
            </DialogTitle>
          </DialogHeader>
          <div className="p-10 space-y-8">
            <div className="grid grid-cols-2 gap-8">
               <div>
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Plant Name</Label>
                  <p className="text-sm font-black text-slate-900 uppercase mt-1">{detectedPlant?.name || "Salt Plant"}</p>
               </div>
               <div>
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Current Date & Time</Label>
                  <p className="text-sm font-bold text-slate-700 mt-1">{format(currentTime || getISTTime(), "dd-MMM-yyyy HH:mm")}</p>
               </div>
            </div>

            <div className="p-6 bg-slate-50 rounded-[1.5rem] border border-slate-100 shadow-inner">
              <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2 mb-4">
                <Navigation className="w-3.5 h-3.5" /> Employee Current Location
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
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <Label className="text-[10px] font-black uppercase text-rose-500 tracking-widest">Work Location Type</Label>
                <RadioGroup value={selectedType} onValueChange={(v: any) => setSelectedType(v)} className="grid grid-cols-2 gap-4">
                  <div className={cn("p-5 border-2 rounded-2xl cursor-pointer transition-all flex flex-col items-center gap-3", selectedType === 'WFH' ? "border-primary bg-primary/5" : "border-slate-100 hover:border-slate-200")} onClick={() => setSelectedType('WFH')}>
                    <Home className={cn("w-6 h-6", selectedType === 'WFH' ? "text-primary" : "text-slate-400")} />
                    <Label className="font-black text-[10px] uppercase cursor-pointer">Work From Home</Label>
                  </div>
                  <div className={cn("p-5 border-2 rounded-2xl cursor-pointer transition-all flex flex-col items-center gap-3", selectedType === 'FIELD' ? "border-primary bg-primary/5" : "border-slate-100 hover:border-slate-200")} onClick={() => setSelectedType('FIELD')}>
                    <Briefcase className={cn("w-6 h-6", selectedType === 'FIELD' ? "text-primary" : "text-slate-400")} />
                    <Label className="font-black text-[10px] uppercase cursor-pointer">Field Work</Label>
                  </div>
                </RadioGroup>
              </div>
            )}
          </div>
          <DialogFooter className="p-8 bg-slate-50 border-t flex flex-row gap-4">
            <Button variant="ghost" className="flex-1 h-14 font-black rounded-2xl text-white bg-rose-500 hover:bg-rose-600" onClick={() => setActiveDialog("NONE")}>CANCEL</Button>
            <Button 
              className="flex-1 h-14 font-black bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl shadow-xl shadow-emerald-500/20 uppercase tracking-widest" 
              onClick={handleConfirmCheckIn} 
              disabled={isMutatingAttendance || !detectedAddress}
            >
              CHECK IN
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark OUT Confirmation */}
      <Dialog
        open={activeDialog === "OUT"}
        onOpenChange={(o) => {
          if (!o) {
            setActiveDialog("NONE");
          }
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
                  <p className="text-sm font-black text-slate-900 uppercase mt-1">{detectedPlant?.name || "Salt Plant"}</p>
               </div>
               <div>
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Current Date & Time</Label>
                  <p className="text-sm font-bold text-slate-700 mt-1">{format(currentTime || getISTTime(), "dd-MMM-yyyy HH:mm")}</p>
               </div>
            </div>

            <div className="p-6 bg-slate-50 rounded-[1.5rem] border border-slate-100 shadow-inner">
              <Label className="text-[10px] font-black uppercase text-rose-500 tracking-widest flex items-center gap-2 mb-4">
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
            <Button variant="ghost" className="flex-1 h-14 font-black rounded-2xl text-white bg-blue-500 hover:bg-blue-600" onClick={() => setActiveDialog("NONE")}>CANCEL</Button>
            <Button 
              className="flex-1 h-14 font-black bg-rose-600 hover:bg-rose-700 text-white rounded-2xl shadow-xl shadow-rose-200 uppercase tracking-widest" 
              onClick={handleConfirmCheckOut}
              disabled={isMutatingAttendance}
            >
              CHECK OUT
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}