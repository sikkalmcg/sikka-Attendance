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

const MAPTILER_KEY = "RLli98FqcieIEpldjYAZ";
const PROJECT_START_DATE_STR = "2026-04-01";

const getISTTime = () => {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
};

export default function AttendancePage() {
  const { attendanceRecords = [], addRecord, updateRecord, refreshData, plants = [], verifiedUser, isLoading } = useData();
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
    
    const ninetyDaysAgo = getISTTime();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const ninetyDaysAgoStr = format(ninetyDaysAgo, "yyyy-MM-dd");

    return (attendanceRecords || [])
      .filter(r => r.employeeId === effectiveEmployeeId && r.date >= PROJECT_START_DATE_STR && r.date >= ninetyDaysAgoStr)
      .sort((a, b) => b.date.localeCompare(a.date) || (b.inTime || "").localeCompare(a.inTime || ""));
  }, [attendanceRecords, effectiveEmployeeId]);

  const monthlySummaries = useMemo(() => {
    const now = getISTTime();
    const monthsMap = new Map<string, { presentDates: Set<string>; monthDate: Date }>();

    // Ensure only current, previous, and 2 months ago are present
    for (let i = 0; i < 3; i++) {
      const mDate = subMonths(now, i);
      const mKey = format(mDate, "yyyy-MM");
      monthsMap.set(mKey, { presentDates: new Set(), monthDate: startOfMonth(mDate) });
    }

    employeeRecords.forEach(r => {
        const rDate = parseISO(r.date);
        if (isValid(rDate)) {
            const mKey = format(rDate, "yyyy-MM");
            if (monthsMap.has(mKey)) {
                if (r.inTime) {
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

  // Derived State based on 16-Hour AUTO OUT rules + Cooldown restrictions
  const { activeRecord, todayRecord, isStale, nextInAvailableAt } = useMemo(() => {
    const now = currentTime || getISTTime();
    const todayStr = format(now, "yyyy-MM-dd");

    const active = employeeRecords.find((r) => r.status === "Open");
    const todayRec = employeeRecords.find((r) => r.date === todayStr);

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

  // Check if Cooldown Lock is active right now (8 Hours rule)
  const isCooldownLocked = useMemo(() => {
    if (!nextInAvailableAt || !currentTime) return false;
    return isAfter(nextInAvailableAt, currentTime);
  }, [nextInAvailableAt, currentTime]);

  const performAutoCheckOut = async (lat: number, lng: number, address: string, components: any) => {
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
        hours: 8.0, // Strictly credit 8 hours on auto checkout
        status: 'Auto OUT',
        outType: 'Auto',
        latOut: lat,
        lngOut: lng,
        addressOut: address || "System Auto-Location",
        streetOut: components.street || "Unknown Street",
        areaOut: components.area || "Unknown Area",
        cityOut: components.city || "NCR",
        stateOut: components.state || "Uttar Pradesh",
        pincodeOut: components.pincode || "N/A",
        autoCheckout: true,
        autoOut: true,
        autoTriggerTime: getISTTime().toISOString(),
        nextInEnableTime: addHours(creditOutDT, 8).toISOString(), // Lock next check-in for 8 hours
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
    
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setCurrentGPS({ lat, lng });
        
        const plant = (plants || []).find(p => calculateDistance(lat, lng, p.lat, p.lng) <= (p.radius || 700));
        setDetectedPlant(plant || null);
        
        try {
          const response = await fetch(`https://api.maptiler.com/geocoding/${lng},${lat}.json?key=${MAPTILER_KEY}`);
          const data = await response.json();
          let components = { street: "", area: "", city: "", state: "", pincode: "" };
          let backupAddress = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

          if (data.features && data.features.length > 0) {
            backupAddress = data.features[0].place_name || backupAddress;
            
            for (const feature of data.features) {
              const types = feature.place_type || [];
              if (types.includes("address") || types.includes("street")) components.street = feature.text;
              if (types.includes("neighborhood") || types.includes("poi") || types.includes("locality")) components.area = feature.text;
              if (types.includes("place") || types.includes("city")) components.city = feature.text;
              if (types.includes("region")) components.state = feature.text;
              if (types.includes("postcode")) components.pincode = feature.text;
            }

            if (!components.street && data.features[0].text) {
              components.street = data.features[0].text;
            }
            if (!components.state) components.state = "Uttar Pradesh";
          }
          
          const displayAddress = (plant as any)?.address 
            ? (plant as any).address 
            : ([components.street, components.area, components.city, components.state].filter(Boolean).join(", ") || backupAddress);
            
          setDetectedAddress(displayAddress);
          setDetailedLocation(components);
          
          if (type === 'OUT_AUTO') {
            performAutoCheckOut(lat, lng, displayAddress, components);
          } else {
            setActiveDialog(type);
          }
        } catch (e) {
          const coordAddr = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
          const fallbackAddr = (plant as any)?.address || "Hapur Bypass, Industrial Area, NCR, Uttar Pradesh";
          setDetectedAddress(fallbackAddr);
          setDetailedLocation({ street: "Hapur Bypass", area: "Industrial Area", city: "NCR", state: "Uttar Pradesh", pincode: "N/A" });
          
          if (type === 'OUT_AUTO') {
            performAutoCheckOut(lat, lng, fallbackAddr, { street: "Hapur Bypass", area: "", city: "", state: "Uttar Pradesh", pincode: "" });
          } else {
            setActiveDialog(type);
          }
        } finally {
          setIsLoadingLocation(false);
        }
      },
      (err) => {
        toast({ variant: "destructive", title: "Location Denied", description: "GPS access is mandatory for attendance." });
        setIsLoadingLocation(false);
        isAutoTriggering.current = false;
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  useEffect(() => {
    if (isStale && activeRecord && !activeRecord.outTime && !isLoadingLocation && !isAutoTriggering.current) {
      isAutoTriggering.current = true;
      console.log("Stale session detected (16h). Atomic Trigger Auto OUT locked.");
      
      setTimeout(() => {
        isAutoTriggering.current = false;
      }, 10000);

      requestLocation("OUT_AUTO");
    }
  }, [isStale, activeRecord, isLoadingLocation]);

  const handleMarkInClick = () => {
    if (isCooldownLocked) {
      toast({
        variant: "destructive",
        title: "Next Mark IN Locked",
        description: `Your 8-hour check-in restriction is active. Access opens at ${nextInAvailableAt ? format(nextInAvailableAt, "dd-MMM HH:mm") : "later"}.`,
        duration: 8000,
      });
      return;
    }
    requestLocation("IN");
  };

  const handleConfirmCheckIn = async () => {
    if (!currentGPS || isMutatingAttendance) return;

    const now = getISTTime();
    const today = format(now, "yyyy-MM-dd");
    const timeStr = format(now, "HH:mm");
    const plantName = detectedPlant?.name || "Salt Plant"; 
    const finalAddress = (detectedPlant as any)?.address || detectedAddress || "Hapur Bypass, Uttar Pradesh";

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
        attendanceType: detectedPlant ? 'Plant' : (selectedType === 'WFH' ? 'Work From Home' : 'Field Work'),
        lat: currentGPS.lat,
        lng: currentGPS.lng,
        address: finalAddress,
        street: detectedPlant ? (detectedPlant.name || "Plant") : (detailedLocation.street || "Hapur Bypass"),
        area: detectedPlant ? "Plant Radius Zone" : (detailedLocation.area || "Industrial Zone"),
        city: detailedLocation.city || "NCR",
        state: detailedLocation.state || "Uttar Pradesh",
        pincode: detailedLocation.pincode || "N/A",
        inPlant: plantName,
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
    if (!activeRecord || !currentGPS || isMutatingAttendance) return;
    const now = getISTTime();
    
    const inDT = activeRecord.inDateTime ? parseISO(activeRecord.inDateTime) : parseDateTime(activeRecord.inDate || activeRecord.date, activeRecord.inTime || "");
    const outDT = now;
    
    let finalHours = 0;
    if (inDT && isValid(inDT) && isValid(outDT)) {
      const diffHours = (outDT.getTime() - inDT.getTime()) / (1000 * 60 * 60);
      finalHours = parseFloat(Math.max(0, diffHours).toFixed(2)); // Actual duration if before 16 hours
    }
    
    const plantName = detectedPlant?.name || "Remote";
    const nextEnableDT = addHours(outDT, 8); 
    const recordId = activeRecord.id || (activeRecord as any)._id;
    const finalAddressOut = (detectedPlant as any)?.address || detectedAddress || "Remote Area";

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
        latOut: currentGPS.lat, 
        lngOut: currentGPS.lng,
        addressOut: finalAddressOut,
        streetOut: detectedPlant ? (detectedPlant.name || "Plant") : (detailedLocation.street || "Unknown Street"),
        areaOut: detectedPlant ? "Plant Radius Zone" : (detailedLocation.area || "Unknown Area"),
        cityOut: detailedLocation.city || "NCR",
        stateOut: detailedLocation.state || "Uttar Pradesh",
        pincodeOut: detailedLocation.pincode || "N/A",
        outPlant: plantName,
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

  // LIGHTNING FAST HYDRATION OVERRIDE:
  // Context ki globally loader state `isLoading` ko yahan bypass kar diya taaki blank gateway freeze page lock na ho!
  if (!isMounted) return null;

  return (
    <div className="space-y-8 pb-12 px-4 max-w-5xl mx-auto">
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
              {activeRecord ? (
                <div className="flex items-center justify-center gap-2 text-emerald-600 bg-emerald-50 px-5 py-3 rounded-xl w-full border border-emerald-100">
                  <ShieldCheck className="w-5 h-5" />
                  <span className="text-sm font-black uppercase tracking-wider">Shift Active at {activeRecord.inTime}</span>
                </div>
              ) : todayRecord && todayRecord.outTime ? (
                <div className="flex items-center justify-center gap-2 text-blue-600 bg-blue-50 px-5 py-3 rounded-xl w-full border border-blue-100">
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-sm font-black uppercase tracking-wider">
                    Shift Closed at {todayRecord.outTime} with working Hour {formatHoursToHHMM(todayRecord.hours || 0)}
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 text-slate-500 bg-slate-50 px-5 py-3 rounded-xl w-full border border-slate-200">
                  <Clock className="w-5 h-5" />
                  <span className="text-sm font-black uppercase tracking-wider">Shift Inactive</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

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
                              <TableHead className="font-black uppercase text-[10px]">Plant Name</TableHead>
                              <TableHead className="font-black uppercase text-[10px]">In Time</TableHead>
                              <TableHead className="font-black uppercase text-[10px]">Out Time</TableHead>
                              <TableHead className="font-black uppercase text-[10px]">Hours</TableHead>
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
                                 <TableCell className="text-xs font-bold text-slate-600">{r.inPlant || r.attendanceType || "N/A"}</TableCell>
                                 <TableCell className="text-xs font-bold text-slate-500">{r.inTime}</TableCell>
                                 <TableCell className="text-xs font-bold text-slate-500">{r.outTime || "--:--"}</TableCell>
                                 <TableCell>
                                    <Badge variant="outline" className={cn("font-black text-[10px]", getWorkingHoursColor(r.hours || 0))}>
                                       {formatHoursToHHMM(r.hours || 0)}
                                    </Badge>
                                 </TableCell>
                                 <TableCell className="text-right pr-6">
                                    <Badge className={cn("text-[9px] font-black uppercase px-2 py-0.5", 
                                       r.status === 'Auto OUT' ? "bg-amber-100 text-amber-700" : 
                                       r.status === 'Open' ? "bg-blue-100 text-blue-700" :
                                       "bg-emerald-100 text-emerald-700"
                                    )}>
                                       {r.status}
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
      <Dialog open={activeDialog === "IN"} onOpenChange={(o) => !o && setActiveDialog("NONE")}>
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

            {/* EMPLOYEE CURRENT LOCATION OPTIMIZED SINGLE COLUMN INLINE ROW BLOCK */}
            <div className="p-6 bg-slate-50 rounded-[1.5rem] border border-slate-100 shadow-inner">
              <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2 mb-4">
                <Navigation className="w-3.5 h-3.5" /> Employee Current Location
              </Label>
              
              <div className="space-y-2.5 text-xs font-bold text-slate-700">
                <div className="grid grid-cols-[100px_1fr] items-baseline gap-2">
                  <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Plot No.:</span>
                  <span className="text-slate-800 break-words">
                    {(detectedPlant as any)?.plotNo || "N/A"}
                  </span>
                </div>

                <div className="grid grid-cols-[100px_1fr] items-baseline gap-2 pt-1 border-t border-slate-200/60">
                  <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Address:</span>
                  <span className="text-slate-800 leading-relaxed break-words">
                    {detectedAddress}
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
              disabled={isMutatingAttendance}
            >
              CHECK IN
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark OUT Confirmation */}
      <Dialog open={activeDialog === "OUT"} onOpenChange={(o) => !o && setActiveDialog("NONE")}>
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
                  <p className="text-sm font-black text-slate-900 uppercase mt-1">{detectedPlant?.name || "None"}</p>
               </div>
               <div>
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Current Date & Time</Label>
                  <p className="text-sm font-bold text-slate-700 mt-1">{format(currentTime || getISTTime(), "dd-MMM-yyyy HH:mm")}</p>
               </div>
            </div>

            {/* EMPLOYEE CURRENT LOCATION OPTIMIZED SINGLE COLUMN INLINE ROW BLOCK FOR MARK OUT */}
            <div className="p-6 bg-slate-50 rounded-[1.5rem] border border-slate-100 shadow-inner">
              <Label className="text-[10px] font-black uppercase text-rose-500 tracking-widest flex items-center gap-2 mb-4">
                <MapPin className="w-3.5 h-3.5" /> Employee Current Location
              </Label>
              
              <div className="space-y-2.5 text-xs font-bold text-slate-700">
                <div className="grid grid-cols-[100px_1fr] items-baseline gap-2">
                  <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Plot No.:</span>
                  <span className="text-slate-800 break-words">
                    {(detectedPlant as any)?.plotNo || "N/A"}
                  </span>
                </div>

                <div className="grid grid-cols-[100px_1fr] items-baseline gap-2 pt-1 border-t border-slate-200/60">
                  <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Address:</span>
                  <span className="text-slate-800 leading-relaxed break-words">
                    {detectedAddress}
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
            <Button className="flex-1 h-14 font-black bg-rose-600 hover:bg-rose-700 text-white rounded-2xl shadow-xl shadow-rose-200 uppercase tracking-widest" onClick={handleConfirmCheckOut}>CHECK OUT</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}