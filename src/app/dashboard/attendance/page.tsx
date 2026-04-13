
"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
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
  Navigation
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
import { AttendanceRecord, Plant, Holiday } from "@/lib/types";
import { useData } from "@/context/data-context";
import { format, subDays, isAfter, parseISO, addHours, differenceInHours, eachDayOfInterval, isSunday, isSameDay } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function AttendancePage() {
  const { attendanceRecords, setAttendanceRecords, plants, holidays } = useData();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  
  // Interaction State
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [activeDialog, setActiveDialog] = useState<"NONE" | "IN" | "OUT">("NONE");
  
  // Location Detection State
  const [currentGPS, setCurrentGPS] = useState<{ lat: number, lng: number } | null>(null);
  const [detectedPlant, setDetectedPlant] = useState<Plant | null>(null);
  const [detectedAddress, setDetectedAddress] = useState("");
  const [manualType, setManualType] = useState<'FIELD' | 'WFH'>('FIELD');

  const { toast } = useToast();

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) setCurrentUser(JSON.parse(savedUser));
    
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Today's Status Check
  const todayRecord = useMemo(() => {
    if (!currentUser) return null;
    const todayStr = new Date().toISOString().split('T')[0];
    return (attendanceRecords || []).find(r => r.employeeId === currentUser.username && r.date === todayStr);
  }, [currentUser, attendanceRecords]);

  // History Filter with Auto-Absent Logic
  const history = useMemo(() => {
    if (!currentUser) return [];
    
    const today = new Date();
    const fortyFiveDaysAgo = subDays(today, 45);
    fortyFiveDaysAgo.setHours(0, 0, 0, 0);

    // Generate date interval
    const dateRange = eachDayOfInterval({ start: fortyFiveDaysAgo, end: today });
    
    return dateRange.map(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const existingRecord = (attendanceRecords || []).find(r => r.employeeId === currentUser.username && r.date === dateStr);
      
      if (existingRecord) return existingRecord;

      // Virtual Record Generation
      const isSun = isSunday(date);
      const holiday = (holidays || []).find(h => h.date === dateStr);
      
      // If it's today and no record, don't show anything yet
      if (isSameDay(date, today)) return null;

      if (isSun) {
        return {
          id: `virtual-sun-${dateStr}`,
          employeeId: currentUser.username,
          employeeName: currentUser.fullName,
          date: dateStr,
          status: 'WEEKLY_OFF',
          attendanceType: 'OFFICE',
          approved: true
        } as any;
      }

      if (holiday) {
        return {
          id: `virtual-hol-${dateStr}`,
          employeeId: currentUser.username,
          employeeName: currentUser.fullName,
          date: dateStr,
          status: 'HOLIDAY',
          attendanceType: 'OFFICE',
          approved: true
        } as any;
      }

      // Default: Absent
      return {
        id: `virtual-abs-${dateStr}`,
        employeeId: currentUser.username,
        employeeName: currentUser.fullName,
        date: dateStr,
        status: 'ABSENT',
        attendanceType: 'OFFICE',
        approved: true,
        hours: 0,
        inTime: null,
        outTime: null
      } as any;
    }).filter(Boolean).reverse();
  }, [currentUser, attendanceRecords, holidays]);

  const requestLocation = (type: "IN" | "OUT") => {
    setIsLoadingLocation(true);
    if (!("geolocation" in navigator)) {
      toast({ variant: "destructive", title: "GPS Error", description: "Browser does not support geolocation." });
      setIsLoadingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setCurrentGPS({ lat, lng });
        const plant = plants.find(p => calculateDistance(lat, lng, p.lat, p.lng) <= 700);
        setDetectedPlant(plant || null);
        const mockAddress = plant ? `${plant.name}, Industrial Estate` : `Street ${Math.floor(lat)}, City Hub`;
        setDetectedAddress(mockAddress);
        setIsLoadingLocation(false);
        setActiveDialog(type);
      },
      (err) => {
        toast({ variant: "destructive", title: "GPS Permission Denied", description: "Please enable location to mark attendance." });
        setIsLoadingLocation(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleConfirmCheckIn = () => {
    if (!currentUser || !currentGPS) return;
    const time = format(new Date(), "HH:mm");
    const today = new Date().toISOString().split('T')[0];
    const type = detectedPlant ? 'OFFICE' : manualType;

    const newRecord: AttendanceRecord = {
      id: Math.random().toString(36).substr(2, 9),
      employeeId: currentUser.username,
      employeeName: currentUser.fullName,
      date: today,
      inTime: time,
      outTime: null,
      hours: 0,
      status: type === 'OFFICE' ? 'PRESENT' : (type as any),
      attendanceType: type,
      lat: currentGPS.lat,
      lng: currentGPS.lng,
      address: detectedAddress,
      inPlant: detectedPlant?.name || type,
      approved: false // Auto goes for approval
    };

    setAttendanceRecords(prev => [...prev, newRecord]);
    setActiveDialog("NONE");
    toast({ title: "Checked In", description: `Attendance submitted for approval.` });
  };

  const handleConfirmCheckOut = () => {
    if (!todayRecord || !currentGPS) return;
    const time = format(new Date(), "HH:mm");
    const typeOut = detectedPlant ? 'OFFICE' : manualType;
    const inDateTime = new Date(`${todayRecord.date} ${todayRecord.inTime}`);
    const outDateTime = new Date(`${todayRecord.date} ${time}`);
    const diffMs = outDateTime.getTime() - inDateTime.getTime();
    const actualHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));

    setAttendanceRecords(prev => prev.map(r => 
      r.id === todayRecord.id ? { 
        ...r, 
        outTime: time, 
        hours: actualHours,
        attendanceTypeOut: typeOut,
        latOut: currentGPS.lat,
        lngOut: currentGPS.lng,
        addressOut: detectedAddress,
        outPlant: detectedPlant?.name || typeOut
      } : r
    ));

    setActiveDialog("NONE");
    toast({ title: "Checked Out", description: `Shift completed at ${time}.` });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 px-4">
      <Card className="shadow-2xl border-none overflow-hidden bg-white max-w-md mx-auto">
        <div className="h-1 bg-primary" />
        <CardHeader className="text-center py-4">
          <CardTitle className="text-xl font-black flex items-center justify-center gap-2 text-slate-800">
            <ShieldCheck className="text-primary w-5 h-5" /> Gateway Check-In
          </CardTitle>
          <CardDescription className="text-[9px] uppercase font-bold tracking-widest text-slate-400">Sikka Industries & Logistics Secure Portal</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 px-6 pb-8 pt-0">
          <div className="py-4 px-6 rounded-3xl bg-sky-50 text-sky-900 flex flex-col items-center justify-center space-y-1 shadow-inner border border-sky-100 max-w-[240px] mx-auto">
            {currentTime ? (
              <div className="text-center">
                <h2 className="text-4xl font-black tracking-tighter font-mono text-sky-900 leading-none">
                  {format(currentTime, "HH:mm")}
                </h2>
                <p className="text-[10px] font-black text-sky-600/80 mt-1 flex items-center justify-center gap-1">
                  <Calendar className="w-3 h-3" /> {format(currentTime, "dd-MMMM-yyyy")}
                </p>
              </div>
            ) : (
              <Loader2 className="w-6 h-6 text-sky-300 animate-spin" />
            )}
          </div>

          <div className="flex gap-3">
            <Button 
              className="flex-1 h-12 text-sm font-black rounded-2xl bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all active:scale-95 disabled:bg-slate-50 disabled:text-slate-300" 
              disabled={isLoadingLocation || (!!todayRecord && !!todayRecord.inTime)} 
              onClick={() => requestLocation("IN")}
            >
              Mark Check-In
            </Button>
            <Button 
              className="flex-1 h-12 text-sm font-black rounded-2xl bg-rose-500 hover:bg-rose-600 shadow-lg shadow-rose-100 transition-all active:scale-95 disabled:bg-slate-50 disabled:text-slate-300" 
              disabled={isLoadingLocation || !todayRecord || (!!todayRecord && !!todayRecord.outTime)} 
              onClick={() => requestLocation("OUT")}
            >
              Mark Check-Out
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4 max-w-6xl mx-auto pt-6">
        <h3 className="font-black text-lg flex items-center gap-2 text-slate-700"><History className="w-5 h-5 text-slate-400" /> My Attendance History</h3>
        <Card className="rounded-2xl overflow-hidden shadow-sm border-slate-200">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="font-bold">Employee Name</TableHead>
                <TableHead className="font-bold">In Plant</TableHead>
                <TableHead className="font-bold">In Date Time</TableHead>
                <TableHead className="font-bold">Out Plant</TableHead>
                <TableHead className="font-bold">Out Date Time</TableHead>
                <TableHead className="font-bold">Working Hours</TableHead>
                <TableHead className="font-bold">Type</TableHead>
                <TableHead className="font-bold">Approval Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground font-medium">No attendance history found.</TableCell></TableRow>
              ) : (
                history.map((h: any) => (
                  <TableRow key={h.id} className="hover:bg-slate-50/50">
                    <TableCell className="text-sm font-bold text-slate-700">{h.employeeName}</TableCell>
                    <TableCell className="text-sm font-bold text-slate-700">{h.inPlant || "--"}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{h.date} {h.inTime || "--:--"}</TableCell>
                    <TableCell className="text-sm font-bold text-slate-700">{h.outPlant || "--"}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{h.date} {h.outTime || "--:--"}</TableCell>
                    <TableCell className={cn("font-black", h.status === 'ABSENT' ? "text-rose-500" : "text-emerald-600")}>
                      {h.status === 'ABSENT' ? "0.00h" : `${h.hours || 0}h`}
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px] font-black uppercase tracking-tight">{h.attendanceType || "OFFICE"}</Badge></TableCell>
                    <TableCell>
                      {h.status === 'ABSENT' ? (
                        <Badge variant="destructive" className="border-none font-bold uppercase text-[9px]">Absent</Badge>
                      ) : h.status === 'WEEKLY_OFF' || h.status === 'HOLIDAY' ? (
                        <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-400 font-bold uppercase text-[9px]">{h.status}</Badge>
                      ) : h.approved ? (
                        <Badge className="bg-emerald-600 border-none font-bold uppercase text-[9px]">Approved</Badge>
                      ) : (
                        <Badge variant="secondary" className="border-none font-bold uppercase text-[9px] bg-amber-50 text-amber-600">Pending</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      <Dialog open={activeDialog === "IN"} onOpenChange={(o) => !o && setActiveDialog("NONE")}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Navigation className="w-5 h-5 text-primary" /> Location Verification</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="p-4 bg-slate-50 rounded-2xl border space-y-3">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-slate-400 mt-1" />
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Address</p>
                  <p className="text-sm font-bold text-slate-700">{detectedAddress}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 pt-2 border-t">
                <Building2 className="w-4 h-4 text-primary mt-1" />
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Plant</p>
                  <p className="text-sm font-bold text-primary">{detectedPlant ? detectedPlant.name : "Remote Location"}</p>
                </div>
              </div>
            </div>
            {!detectedPlant && (
              <div className="space-y-2">
                <Label className="font-black text-xs">Attendance Type</Label>
                <Select value={manualType} onValueChange={(v: any) => setManualType(v)}>
                  <SelectTrigger className="h-12 bg-white rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIELD">Field Work</SelectItem>
                    <SelectItem value="WFH">Work From Home</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter><Button className="w-full h-12 rounded-xl font-black bg-primary" onClick={handleConfirmCheckIn}>Confirm Check-In</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={activeDialog === "OUT"} onOpenChange={(o) => !o && setActiveDialog("NONE")}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Navigation className="w-5 h-5 text-rose-500" /> Confirm Check-Out</DialogTitle></DialogHeader>
          <div className="space-y-6 py-4">
            <div className="p-4 bg-slate-50 rounded-2xl border space-y-3">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-slate-400 mt-1" />
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Location</p>
                  <p className="text-sm font-bold text-slate-700">{detectedAddress}</p>
                </div>
              </div>
            </div>
            {!detectedPlant && (
              <div className="space-y-2">
                <Label className="font-black text-xs">Out Type</Label>
                <Select value={manualType} onValueChange={(v: any) => setManualType(v)}>
                  <SelectTrigger className="h-12 bg-white rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIELD">Field Work</SelectItem>
                    <SelectItem value="WFH">Work From Home</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter><Button className="w-full h-12 rounded-xl font-black bg-rose-500 hover:bg-rose-600" onClick={handleConfirmCheckOut}>Confirm Check-Out</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
