"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
  Navigation,
  Factory,
  Briefcase,
  Home,
  CheckCircle,
  XCircle,
  AlertTriangle
} from "lucide-react";
import { calculateDistance, cn, formatDate, getWorkingHoursColor, formatHoursToHHMM, formatDateTime, parseDateTime } from "@/lib/utils";
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableRow, 
  TableHead, 
  TableCell 
} from "@/components/ui/table";
import { Plant, AttendanceRecord } from "@/lib/types";
import { useData } from "@/context/data-context";
import { format, parseISO, addHours, isAfter, startOfDay, isValid, isBefore, addDays, isSameDay } from "date-fns";
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
  const { attendanceRecords, addRecord, updateRecord, refreshData, plants, employees, verifiedUser, isLoading } = useData();
  const [isMutatingAttendance, setIsMutatingAttendance] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [activeDialog, setActiveDialog] = useState<"NONE" | "IN" | "OUT">("NONE");
  
  const [currentGPS, setCurrentGPS] = useState<{ lat: number, lng: number } | null>(null);
  const [detectedPlant, setDetectedPlant] = useState<Plant | null>(null);
  const [detectedAddress, setDetectedAddress] = useState("");
  const [detailedLocation, setDetailedLocation] = useState({ street: "", area: "", city: "", state: "" });
  const [selectedType, setSelectedType] = useState<"FIELD" | "WFH" | "">("");

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
    return (attendanceRecords || [])
      .filter(r => r.employeeId === effectiveEmployeeId && r.date >= PROJECT_START_DATE_STR)
      .sort((a, b) => b.date.localeCompare(a.date) || (b.inTime || "").localeCompare(a.inTime || ""));
  }, [attendanceRecords, effectiveEmployeeId]);

  // Derived State based on 20-Hour Rules
  const { activeRecord, todayRecord, isStale } = useMemo(() => {
    const now = getISTTime();
    const todayStr = format(now, "yyyy-MM-dd");
    
    // Check if any record exists for today (Once per calendar day rule)
    const todayRec = employeeRecords.find(r => r.date === todayStr);
    
    // Find if there's an open session (any date)
    const active = employeeRecords.find(r => r.status === 'Open');

    let stale = false;
    if (active) {
      const inDT = active.inDateTime ? parseISO(active.inDateTime) : parseDateTime(active.inDate || active.date, active.inTime || "");
      if (inDT && isValid(inDT)) {
        const triggerTime = addHours(inDT, 20); // 20 Hour Threshold for AUTO OUT
        if (isAfter(now, triggerTime)) {
          stale = true;
        }
      }
    }

    return { 
      activeRecord: active || null, 
      todayRecord: todayRec || null,
      isStale: stale
    };
  }, [employeeRecords, currentTime]);

  // Automated Checkout Background Check (20 Hours)
  useEffect(() => {
    if (isStale && activeRecord && !activeRecord.outTime && !isLoadingLocation) {
      console.log("Stale session detected (20h). Triggering Auto OUT...");
      requestLocation("OUT_AUTO");
    }
  }, [isStale, activeRecord]);

  const performAutoCheckOut = async (lat: number, lng: number, address: string, components: any) => {
    // guard against concurrent mutations / stale UI states
    if (!activeRecord) return;
    if (isMutatingAttendance) return;
    
    const inDT = activeRecord.inDateTime ? parseISO(activeRecord.inDateTime) : parseDateTime(activeRecord.inDate || activeRecord.date, activeRecord.inTime || "");
    if (!inDT || !isValid(inDT)) return;

    const creditOutDT = addHours(inDT, 8); // 8 Hour Credit Rule (IN + 8h)
    
    const finalOutDate = format(creditOutDT, "yyyy-MM-dd");
    const finalOutTime = format(creditOutDT, "HH:mm");
    
    setIsMutatingAttendance(true);
    try {
      await updateRecord('attendance', activeRecord.id, {
        outTime: finalOutTime,
        outDate: finalOutDate,
        outDateTime: creditOutDT.toISOString(),
        hours: 8.0,
        status: 'Auto OUT',
        outType: 'AUTO',
        latOut: lat,
        lngOut: lng,
        addressOut: address,
        street: components.street || null,
        area: components.area || null,
        city: components.city || null,
        state: components.state || null,
        autoCheckout: true,
        autoOut: true,
        remark: "System Auto-Logged OUT (20h Limit Threshold reached)"
      });

      await addRecord('notifications', {
        message: `${effectiveEmployeeName} – AUTO OUT Processed | Recorded OUT: ${format(creditOutDT, "dd-MMM HH:mm")}`,
        timestamp: format(getISTTime(), "yyyy-MM-dd HH:mm:ss"),
        read: false,
        type: 'AUTO_OUT',
        employeeId: effectiveEmployeeId
      });

      // Ensure UI re-computes activeRecord/status immediately
      await refreshData();

      toast({ 
        title: "Auto OUT Triggered", 
        description: "Session closed after 20 hours. 8 hours credited to your ledger." 
      });
    } finally {
      setIsMutatingAttendance(false);
    }
  };

  const requestLocation = (type: "IN" | "OUT" | "OUT_AUTO") => {
    if (isMutatingAttendance) return;
    setIsLoadingLocation(true);
    setDetectedAddress(""); 
    
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setCurrentGPS({ lat, lng });
        const plant = (plants || []).find(p => calculateDistance(lat, lng, p.lat, p.lng) <= (p.radius || 700));
        setDetectedPlant(plant || null);
        
        try {
          const response = await fetch(`https://api.maptiler.com/geocoding/${lng},${lat}.json?key=${MAPTILER_KEY}`);
          const data = await response.json();
          let components = { street: "", area: "", city: "", state: "" };

          if (data.features && data.features.length > 0) {
            for (const feature of data.features) {
              const types = feature.place_type || [];
              if (types.includes("address") || types.includes("street")) components.street = feature.text;
              if (types.includes("neighborhood") || types.includes("poi") || types.includes("locality")) components.area = feature.text;
              if (types.includes("place") || types.includes("city")) components.city = feature.text;
              if (types.includes("region")) components.state = feature.text;
            }
            const displayAddress = [components.street, components.area, components.city, components.state].filter(Boolean).join(", ");
            setDetectedAddress(displayAddress || data.features[0].place_name);
            setDetailedLocation(components);
            
            if (type === 'OUT_AUTO') {
              performAutoCheckOut(lat, lng, displayAddress || data.features[0].place_name, components);
            } else {
              setActiveDialog(type as any);
            }
          } else {
            const coordAddr = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
            setDetectedAddress(coordAddr);
            if (type === 'OUT_AUTO') {
              performAutoCheckOut(lat, lng, coordAddr, components);
            } else {
              setActiveDialog(type as any);
            }
          }
        } catch (e) {
          const coordAddr = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
          setDetectedAddress(coordAddr);
          if (type === 'OUT_AUTO') {
            performAutoCheckOut(lat, lng, coordAddr, { street: "", area: "", city: "", state: "" });
          } else {
            setActiveDialog(type as any);
          }
        } finally {
          setIsLoadingLocation(false);
        }
      },
      (err) => {
        toast({ variant: "destructive", title: "Location Denied", description: "GPS access is mandatory for attendance." });
        setIsLoadingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const handleMarkInClick = () => {
    if (todayRecord) {
      const formattedDate = format(parseISO(todayRecord.date), "dd-MM-yyyy");
      toast({ 
        variant: "destructive", 
        title: "Same Day Restriction", 
        description: `You have already marked IN on Date ${formattedDate}. Your next Mark IN will be available on Date ${format(addDays(parseISO(todayRecord.date), 1), "dd-MM-yyyy")} at 12:00 AM.`,
        duration: 8000
      });
      return;
    }
    requestLocation("IN");
  };

  const handleConfirmCheckIn = () => {
    if (!currentGPS) return;

    if (!detectedPlant && !selectedType) {
      toast({ variant: "destructive", title: "Type Required", description: "Select Field Work or WFH if outside plant radius." });
      return;
    }

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
      inDateTime: now.toISOString(),
      hours: 0,
      status: 'Open',
      attendanceType: detectedPlant ? 'OFFICE' : (selectedType as any),
      lat: currentGPS.lat,
      lng: currentGPS.lng,
      address: detectedAddress,
      street: detailedLocation.street || null,
      area: detailedLocation.area || null,
      city: detailedLocation.city || null,
      state: detailedLocation.state || null,
      inPlant: plantName,
      remark: detectedPlant ? plantName : (selectedType === 'WFH' ? 'Work From Home' : 'Field Visit'),
      approved: false,
      unapprovedOutDuration: 0
    });

    setActiveDialog("NONE");
    setSelectedType(""); 
    toast({ title: "Mark IN Successful" });
  };

  const handleConfirmCheckOut = async () => {
    if (!activeRecord || !currentGPS) return;
    if (isMutatingAttendance) return;
    const now = getISTTime();
    
    const inDT = activeRecord.inDateTime ? parseISO(activeRecord.inDateTime) : parseDateTime(activeRecord.inDate || activeRecord.date, activeRecord.inTime || "");
    const outDT = now;
    
    let finalHours = 0;
    if (inDT && isValid(inDT) && isValid(outDT)) {
      const diffHours = (outDT.getTime() - inDT.getTime()) / (1000 * 60 * 60);
      finalHours = parseFloat(Math.max(0, diffHours).toFixed(2));
    }
    
    const plantName = detectedPlant?.name || "Remote";

    setIsMutatingAttendance(true);
    try {
      await updateRecord('attendance', activeRecord.id, { 
        outTime: format(now, "HH:mm"), 
        outDate: format(now, "yyyy-MM-dd"),
        outDateTime: now.toISOString(),
        hours: finalHours,
        status: 'Closed',
        outType: 'MANUAL',
        latOut: currentGPS.lat, 
        lngOut: currentGPS.lng,
        addressOut: detectedAddress,
        street: detailedLocation.street || null,
        area: detailedLocation.area || null,
        city: detailedLocation.city || null,
        state: detailedLocation.state || null,
        outPlant: plantName
      });

      // Ensure UI immediately hides Mark OUT and recomputes next eligibility
      await refreshData();

      setActiveDialog("NONE");
      toast({ title: "Mark OUT Successful" });
    } finally {
      setIsMutatingAttendance(false);
    }
  };

  if (!isMounted) return null;

  return (
    <div className="space-y-8 pb-12 px-4 max-w-5xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
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
                  <h2 className="text-6xl font-black tracking-tighter font-mono leading-none text-slate-900">{format(currentTime, "HH:mm")}</h2>
                  <p className="text-[11px] font-black text-primary mt-3 flex items-center justify-center gap-1.5 uppercase tracking-[0.2em]">{format(currentTime, "dd MMM yyyy")}</p>
                </div>
              ) : (
                <Loader2 className="w-10 h-10 text-slate-200 animate-spin" />
              )}
            </div>

            <div className="flex gap-4">
              <Button 
                className={cn("flex-1 h-16 text-sm font-black rounded-2xl shadow-xl transition-all uppercase tracking-widest", 
                  (!activeRecord && !todayRecord) ? "bg-primary text-white shadow-primary/20" : "bg-slate-100 text-slate-400"
                )} 
                disabled={isLoading || isLoadingLocation || isMutatingAttendance || !!activeRecord || !!todayRecord} 
                onClick={handleMarkInClick}
              >
                {isLoadingLocation && activeDialog === 'NONE' ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : "Mark IN"}
              </Button>
              <Button 
                className={cn("flex-1 h-16 text-sm font-black rounded-2xl shadow-xl transition-all uppercase tracking-widest", 
                  activeRecord ? "bg-rose-600 text-white shadow-rose-200 hover:bg-rose-700" : "bg-slate-100 text-slate-400"
                )} 
                disabled={isLoading || isLoadingLocation || isMutatingAttendance || !activeRecord} 
                onClick={() => requestLocation("OUT")}
              >
                {isLoadingLocation && activeDialog === 'NONE' ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : "Mark OUT"}
              </Button>
            </div>

            {todayRecord && (
              <Alert className="bg-emerald-50 border-emerald-100 text-emerald-800 rounded-2xl py-3">
                 <CheckCircle className="w-4 h-4 text-emerald-600" />
                 <AlertDescription className="text-[10px] font-black uppercase tracking-widest leading-none">
                    Session Recorded for Today ({formatDate(todayRecord.date)})
                 </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-xl border-none overflow-hidden bg-white">
           <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center justify-between py-5 px-6">
              <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-500">Live Status</CardTitle>
              <Badge variant="outline" className="font-black text-[10px] uppercase border-slate-200">{effectiveEmployeeId}</Badge>
           </CardHeader>
           <CardContent className="p-8 flex flex-col items-center justify-center h-full text-center space-y-4">
              {!activeRecord ? (
                <>
                  <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 mb-2">
                    <Clock className="w-8 h-8 text-slate-300" />
                  </div>
                  <h3 className="text-lg font-black text-slate-400 uppercase tracking-tight">
                    {todayRecord ? "Daily Quota Reached" : "System Resting"}
                  </h3>
                  <p className="text-xs font-medium text-slate-400 max-w-[200px]">
                    {todayRecord ? `Your next check-in access opens at 12:00 AM on ${format(addDays(getISTTime(), 1), "dd-MMM")}` : "Gateway is ready for check-in."}
                  </p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100 mb-2 animate-pulse">
                    <ShieldCheck className="w-8 h-8 text-emerald-500" />
                  </div>
                  <h3 className="text-lg font-black text-emerald-600 uppercase tracking-tight">Shift Active</h3>
                  <p className="text-xs font-bold text-slate-500 uppercase">Started at {activeRecord.inTime}</p>
                </>
              )}
           </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
         <h3 className="font-black text-lg flex items-center gap-2 text-slate-700 uppercase tracking-tight">
            <History className="w-5 h-5 text-primary" /> Session History
         </h3>
         <Card className="rounded-[1.5rem] overflow-hidden shadow-sm border-slate-200">
            <ScrollArea className="h-[400px]">
               <Table>
                  <TableHeader className="bg-slate-50">
                     <TableRow>
                        <TableHead className="font-black uppercase text-[10px]">Date</TableHead>
                        <TableHead className="font-black uppercase text-[10px]">In Time</TableHead>
                        <TableHead className="font-black uppercase text-[10px]">Out Time</TableHead>
                        <TableHead className="font-black uppercase text-[10px]">Hours</TableHead>
                        <TableHead className="font-black uppercase text-[10px] text-right pr-6">Status</TableHead>
                     </TableRow>
                  </TableHeader>
                  <TableBody>
                     {employeeRecords.map((r: any) => (
                        <TableRow key={r.id} className="hover:bg-slate-50/50">
                           <TableCell className="text-xs font-bold text-slate-700 py-4">{formatDate(r.date)}</TableCell>
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
            </ScrollArea>
         </Card>
      </div>

      {/* Mark IN Confirmation */}
      <Dialog open={activeDialog === "IN"} onOpenChange={(o) => !o && setActiveDialog("NONE")}>
        <DialogContent className="sm:max-w-xl rounded-[2.5rem] overflow-hidden p-0 border-none shadow-2xl animate-in zoom-in-95">
          <DialogHeader className="p-8 bg-slate-900 text-white shrink-0">
            <DialogTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-tight">
              <MapPin className="w-6 h-6 text-primary" /> Session Verification
            </DialogTitle>
          </DialogHeader>
          <div className="p-10 space-y-8">
            <div className="grid grid-cols-2 gap-8">
               <div>
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Facility Allocation</Label>
                  <p className="text-sm font-black text-slate-900 uppercase mt-1">{detectedPlant?.name || "Off-Site Entry"}</p>
               </div>
               <div>
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Entry Timestamp</Label>
                  <p className="text-sm font-bold text-slate-700 mt-1">{format(getISTTime(), "HH:mm")}</p>
               </div>
            </div>

            <div className="p-6 bg-slate-50 rounded-[1.5rem] border border-slate-100">
              <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2 mb-3">
                <Navigation className="w-3.5 h-3.5" /> Resolved Address
              </Label>
              <p className="text-xs font-bold text-slate-600 leading-relaxed italic">{detectedAddress}</p>
            </div>

            {!detectedPlant && (
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <Label className="text-[10px] font-black uppercase text-rose-500 tracking-widest">Entry Classification Required</Label>
                <RadioGroup value={selectedType} onValueChange={(v: any) => setSelectedType(v)} className="grid grid-cols-2 gap-4">
                  <div className={cn("p-5 border-2 rounded-2xl cursor-pointer transition-all flex flex-col items-center gap-3", selectedType === 'FIELD' ? "border-primary bg-primary/5" : "border-slate-100 hover:border-slate-200")} onClick={() => setSelectedType('FIELD')}>
                    <Briefcase className={cn("w-6 h-6", selectedType === 'FIELD' ? "text-primary" : "text-slate-400")} />
                    <Label className="font-black text-[10px] uppercase cursor-pointer">Field Entry</Label>
                  </div>
                  <div className={cn("p-5 border-2 rounded-2xl cursor-pointer transition-all flex flex-col items-center gap-3", selectedType === 'WFH' ? "border-primary bg-primary/5" : "border-slate-100 hover:border-slate-200")} onClick={() => setSelectedType('WFH')}>
                    <Home className={cn("w-6 h-6", selectedType === 'WFH' ? "text-primary" : "text-slate-400")} />
                    <Label className="font-black text-[10px] uppercase cursor-pointer">Remote Hub</Label>
                  </div>
                </RadioGroup>
              </div>
            )}
          </div>
          <DialogFooter className="p-8 bg-slate-50 border-t flex flex-row gap-4">
            <Button variant="ghost" className="flex-1 h-14 font-black rounded-2xl text-slate-400" onClick={() => setActiveDialog("NONE")}>CANCEL</Button>
            <Button className="flex-1 h-14 font-black bg-primary text-white rounded-2xl shadow-xl shadow-primary/20 uppercase tracking-widest" onClick={handleConfirmCheckIn} disabled={!detectedPlant && !selectedType}>CONFIRM ENTRY</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark OUT Confirmation */}
      <Dialog open={activeDialog === "OUT"} onOpenChange={(o) => !o && setActiveDialog("NONE")}>
        <DialogContent className="sm:max-w-xl rounded-[2.5rem] overflow-hidden p-0 border-none shadow-2xl">
          <DialogHeader className="p-8 bg-rose-600 text-white shrink-0">
            <DialogTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-tight">
              <Navigation className="w-6 h-6" /> Close Shift
            </DialogTitle>
          </DialogHeader>
          <div className="p-10 space-y-8">
             <div className="grid grid-cols-2 gap-8">
               <div>
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Active Facility</Label>
                  <p className="text-sm font-black text-slate-900 uppercase mt-1">{activeRecord?.inPlant || "External Location"}</p>
               </div>
               <div>
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Exit Timestamp</Label>
                  <p className="text-sm font-bold text-slate-700 mt-1">{format(getISTTime(), "HH:mm")}</p>
               </div>
            </div>

            <div className="p-6 bg-slate-50 rounded-[1.5rem] border border-slate-100">
              <Label className="text-[10px] font-black uppercase text-rose-500 tracking-widest flex items-center gap-2 mb-3">
                <MapPin className="w-3.5 h-3.5" /> Exit Location
              </Label>
              <p className="text-xs font-bold text-slate-600 leading-relaxed italic">{detectedAddress}</p>
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
            <Button variant="ghost" className="flex-1 h-14 font-black rounded-2xl text-slate-400" onClick={() => setActiveDialog("NONE")}>CANCEL</Button>
            <Button className="flex-1 h-14 font-black bg-rose-600 hover:bg-rose-700 text-white rounded-2xl shadow-xl shadow-rose-200 uppercase tracking-widest" onClick={handleConfirmCheckOut}>CHECK OUT</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
