
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
import { AttendanceRecord, Plant } from "@/lib/types";
import { useData } from "@/context/data-context";
import { format, subDays, isAfter, parseISO, addHours, differenceInHours } from "date-fns";
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
  const { attendanceRecords, setAttendanceRecords, plants } = useData();
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

  // Auto Checkout Logic Engine
  useEffect(() => {
    if (!currentUser || !attendanceRecords.length) return;

    const runAutoCheckoutCheck = () => {
      const pendingRecords = attendanceRecords.filter(r => 
        r.employeeId === currentUser.username && 
        r.inTime && 
        !r.outTime
      );

      let updated = false;
      const newRecords = attendanceRecords.map(r => {
        if (r.employeeId === currentUser.username && r.inTime && !r.outTime) {
          const inDateTime = new Date(`${r.date} ${r.inTime}`);
          const hoursDiff = differenceInHours(new Date(), inDateTime);

          if (hoursDiff >= 16) {
            updated = true;
            const autoOutTime = format(addHours(inDateTime, 8), "HH:mm");
            return {
              ...r,
              outTime: autoOutTime,
              hours: 8.0,
              autoCheckout: true,
              remark: "Auto Check-Out (16h Rule)"
            };
          }
        }
        return r;
      });

      if (updated) {
        setAttendanceRecords(newRecords);
        toast({ title: "System Update", description: "An old session was automatically checked out (8h shift applied)." });
      }
    };

    runAutoCheckoutCheck();
  }, [currentUser, attendanceRecords, setAttendanceRecords, toast]);

  // History Filter
  const history = useMemo(() => {
    if (!currentUser) return [];
    const fortyFiveDaysAgo = subDays(new Date(), 45);
    fortyFiveDaysAgo.setHours(0, 0, 0, 0);

    return (attendanceRecords || [])
      .filter(r => {
        const isMine = r.employeeId === currentUser.username;
        const recordDate = parseISO(r.date);
        return isMine && (isAfter(recordDate, fortyFiveDaysAgo) || format(recordDate, 'yyyy-MM-dd') === format(fortyFiveDaysAgo, 'yyyy-MM-dd'));
      })
      .reverse();
  }, [currentUser, attendanceRecords]);

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
        
        // Plant Detection (700m Radius)
        const plant = plants.find(p => calculateDistance(lat, lng, p.lat, p.lng) <= 700);
        setDetectedPlant(plant || null);
        
        // Mock Address Generation
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
      approved: false
    };

    setAttendanceRecords(prev => [...prev, newRecord]);
    setActiveDialog("NONE");
    toast({ title: "Checked In", description: `Marked as ${type} at ${time}` });
  };

  const handleConfirmCheckOut = () => {
    if (!todayRecord || !currentGPS) return;

    const time = format(new Date(), "HH:mm");
    const typeOut = detectedPlant ? 'OFFICE' : manualType;
    
    // Hour Calculation
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
    toast({ title: "Checked Out", description: `Shift completed at ${time}. Hours: ${actualHours}` });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 px-4">
      <Card className="shadow-2xl border-none overflow-hidden bg-white max-w-xl mx-auto">
        <div className="h-2 bg-primary" />
        <CardHeader className="text-center py-6">
          <CardTitle className="text-2xl font-black flex items-center justify-center gap-2 text-slate-800">
            <ShieldCheck className="text-primary w-6 h-6" /> Gateway Check-In
          </CardTitle>
          <CardDescription className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Sikka Industries & Logistics Secure Portal</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8 px-8 pb-10 pt-0">
          
          {/* Clock Box - High Fidelity Blue Theme */}
          <div className="py-8 px-10 rounded-[40px] bg-sky-50 text-sky-900 flex flex-col items-center justify-center space-y-3 shadow-inner border-2 border-sky-100 max-w-sm mx-auto">
            {currentTime ? (
              <div className="text-center">
                <h2 className="text-6xl font-black tracking-tighter font-mono text-sky-900 leading-none drop-shadow-sm">
                  {format(currentTime, "HH:mm")}
                </h2>
                <p className="text-sm font-black text-sky-600/80 mt-2 flex items-center justify-center gap-2 tracking-wide">
                  <Calendar className="w-4 h-4" /> {format(currentTime, "dd-MMMM-yyyy")}
                </p>
              </div>
            ) : (
              <div className="h-16 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-sky-300 animate-spin" />
              </div>
            )}
          </div>

          {/* Action Buttons with Strict Rules */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Button 
              className="flex-1 h-16 text-xl font-black rounded-3xl bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-100 transition-all active:scale-95 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none" 
              disabled={isLoadingLocation || (!!todayRecord && !!todayRecord.inTime)} 
              onClick={() => requestLocation("IN")}
            >
              {isLoadingLocation && activeDialog === "NONE" ? <Loader2 className="animate-spin mr-2" /> : "Mark Check-In"}
            </Button>
            <Button 
              className="flex-1 h-16 text-xl font-black rounded-3xl bg-rose-500 hover:bg-rose-600 shadow-xl shadow-rose-100 transition-all active:scale-95 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none" 
              disabled={isLoadingLocation || !todayRecord || (!!todayRecord && !!todayRecord.outTime)} 
              onClick={() => requestLocation("OUT")}
            >
              {isLoadingLocation && activeDialog === "NONE" ? <Loader2 className="animate-spin mr-2" /> : "Mark Check-Out"}
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
                <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground font-medium">No attendance history found for the last 45 days.</TableCell></TableRow>
              ) : (
                history.map((h) => (
                  <TableRow key={h.id} className="hover:bg-slate-50/50">
                    <TableCell className="text-sm font-bold text-slate-700">{h.inPlant || "--"}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{h.date} {h.inTime}</TableCell>
                    <TableCell className="text-sm font-bold text-slate-700">{h.outPlant || "--"}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{h.date} {h.outTime || "--:--"}</TableCell>
                    <TableCell className="font-black text-emerald-600">{h.hours}h</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px] font-black uppercase tracking-tight">{h.attendanceType}</Badge></TableCell>
                    <TableCell>
                      {h.approved ? (
                        <Badge className="bg-emerald-600 border-none font-bold uppercase text-[9px]">Approved</Badge>
                      ) : h.remark ? (
                        <Badge variant="destructive" className="border-none font-bold uppercase text-[9px]">Rejected</Badge>
                      ) : (
                        <Badge variant="secondary" className="border-none font-bold uppercase text-[9px] bg-slate-100 text-slate-500">Pending</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Check-In Confirmation Dialog */}
      <Dialog open={activeDialog === "IN"} onOpenChange={(o) => !o && setActiveDialog("NONE")}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Navigation className="w-5 h-5 text-primary" /> Location Verification</DialogTitle>
            <DialogDescription>Your GPS coordinates have been matched against secure plant nodes.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="p-4 bg-slate-50 rounded-2xl border space-y-3">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-slate-400 mt-1" />
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Detected Address</p>
                  <p className="text-sm font-bold text-slate-700">{detectedAddress}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 pt-2 border-t">
                <Building2 className="w-4 h-4 text-primary mt-1" />
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Plant Detected</p>
                  <p className="text-sm font-bold text-primary">{detectedPlant ? detectedPlant.name : "Outside Geofence (0.7 KM)"}</p>
                </div>
              </div>
            </div>

            {!detectedPlant && (
              <div className="space-y-2">
                <Label className="font-black text-xs">Select Attendance Type</Label>
                <Select value={manualType} onValueChange={(v: any) => setManualType(v)}>
                  <SelectTrigger className="h-12 bg-white rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIELD">Field Work</SelectItem>
                    <SelectItem value="WFH">Work From Home</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button className="w-full h-12 rounded-xl font-black bg-primary" onClick={handleConfirmCheckIn}>Confirm Check-In</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Check-Out Confirmation Dialog */}
      <Dialog open={activeDialog === "OUT"} onOpenChange={(o) => !o && setActiveDialog("NONE")}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Navigation className="w-5 h-5 text-rose-500" /> End of Shift Verification</DialogTitle>
            <DialogDescription>Confirm your location to finalize working hours for today.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="p-4 bg-slate-50 rounded-2xl border space-y-3">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-slate-400 mt-1" />
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Current Location</p>
                  <p className="text-sm font-bold text-slate-700">{detectedAddress}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 pt-2 border-t">
                <Building2 className="w-4 h-4 text-rose-500 mt-1" />
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Plant Status</p>
                  <p className="text-sm font-bold text-rose-600">{detectedPlant ? `At ${detectedPlant.name}` : "Not at Plant (Remote)"}</p>
                </div>
              </div>
            </div>

            {!detectedPlant && (
              <div className="space-y-2">
                <Label className="font-black text-xs">Select Check-Out Type</Label>
                <Select value={manualType} onValueChange={(v: any) => setManualType(v)}>
                  <SelectTrigger className="h-12 bg-white rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIELD">Field Work</SelectItem>
                    <SelectItem value="WFH">Work From Home</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button className="w-full h-12 rounded-xl font-black bg-rose-500 hover:bg-rose-600" onClick={handleConfirmCheckOut}>Confirm Check-Out</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
