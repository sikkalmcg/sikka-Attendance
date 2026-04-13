
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
  Timer
} from "lucide-react";
import { calculateDistance } from "@/lib/utils";
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
import { format } from "date-fns";

export default function AttendancePage() {
  const { employees, attendanceRecords, setAttendanceRecords, plants } = useData();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [detectedPlant, setDetectedPlant] = useState<Plant | null>(null);
  const [address, setAddress] = useState<string>("Detecting location...");
  const [attendanceStatus, setAttendanceStatus] = useState<"NONE" | "IN" | "OUT">("NONE");
  const [attendanceType, setAttendanceType] = useState<'OFFICE' | 'FIELD' | 'WFH'>('OFFICE');
  const [checkInTime, setCheckInTime] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  
  const { toast } = useToast();

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) setCurrentUser(JSON.parse(savedUser));
    
    // Set initial clock
    setCurrentTime(new Date());
    
    // Update clock every minute
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    
    return () => clearInterval(timer);
  }, []);

  const history = useMemo(() => {
    if (!currentUser) return [];
    return attendanceRecords.filter(r => r.employeeId === currentUser.id || r.employeeId === "emp-mock").reverse();
  }, [currentUser, attendanceRecords]);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude: lat, longitude: lng } = pos.coords;
          setLocation({ lat, lng });
          
          let foundPlant = plants.find(p => calculateDistance(lat, lng, p.lat, p.lng) <= p.radius);
          if (foundPlant) {
            setDetectedPlant(foundPlant);
            setAttendanceType('OFFICE');
          } else {
            setAttendanceType('FIELD');
          }
          setAddress(`Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`);
        },
        () => {
          toast({ variant: "destructive", title: "GPS Required", description: "Please enable location." });
          setAddress("Permission Denied");
        }
      );
    }
  }, [toast, plants]);

  const handleCheckIn = () => {
    const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    const today = new Date().toISOString().split('T')[0];

    const newRecord: AttendanceRecord = {
      id: Math.random().toString(36).substr(2, 9),
      employeeId: currentUser?.username || "emp-mock",
      employeeName: currentUser?.fullName || "Employee",
      date: today,
      inTime: time,
      outTime: null,
      inPlant: detectedPlant?.name || attendanceType,
      outPlant: undefined,
      hours: 0,
      status: attendanceType === 'OFFICE' ? 'PRESENT' : (attendanceType as any),
      attendanceType: attendanceType,
      lat: location?.lat || 0,
      lng: location?.lng || 0,
      address: address,
      approved: false
    };

    setAttendanceRecords(prev => [...prev, newRecord]);
    setAttendanceStatus("IN");
    setCheckInTime(time);
    toast({ title: "Check-In Successful" });
  };

  const handleCheckOut = () => {
    const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    
    setAttendanceRecords(prev => prev.map(r => {
      if (r.employeeId === (currentUser?.username || "emp-mock") && !r.outTime) {
        return { ...r, outTime: time, outPlant: detectedPlant?.name || attendanceType };
      }
      return r;
    }));

    setAttendanceStatus("OUT");
    toast({ title: "Check-Out Successful" });
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      <Card className="shadow-2xl border-none overflow-hidden bg-white max-w-5xl mx-auto">
        <div className="h-3 bg-primary" />
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-3xl font-bold flex items-center justify-center gap-2">
            <ShieldCheck className="text-primary w-8 h-8" /> Check-In / Check-Out
          </CardTitle>
          <CardDescription>Sikka Industries Secure Gateway (24h Clock)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8 p-10">
          
          {/* Real-time Clock Section */}
          <div className="p-8 rounded-3xl bg-slate-50 border-2 border-slate-100 flex flex-col items-center justify-center space-y-2">
            <div className="flex items-center gap-3 text-primary mb-2">
              <Timer className="w-6 h-6 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Live System Time</span>
            </div>
            {currentTime ? (
              <div className="text-center">
                <h2 className="text-5xl font-black text-slate-900 tracking-tight font-mono">
                  {format(currentTime, "HH:mm")}
                </h2>
                <p className="text-lg font-bold text-slate-500 mt-2 flex items-center justify-center gap-2">
                  <Calendar className="w-4 h-4" /> {format(currentTime, "dd-MMMM-yyyy")}
                </p>
              </div>
            ) : (
              <div className="h-16 flex items-center justify-center">
                <span className="text-slate-300 font-bold">Synchronizing...</span>
              </div>
            )}
            <div className="pt-4 flex items-center gap-2 text-[10px] text-muted-foreground font-mono bg-white/50 px-4 py-1.5 rounded-full border border-slate-200 mt-4">
              <MapPin className="w-3 h-3" /> {address}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="p-6 rounded-3xl bg-slate-50 text-center border border-slate-100">
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mb-1">CURRENT STATUS</p>
              <p className={cn(
                "font-black text-2xl",
                attendanceStatus === 'IN' ? "text-emerald-600" : attendanceStatus === 'OUT' ? "text-rose-600" : "text-slate-400"
              )}>
                {attendanceStatus === 'NONE' ? 'STATIONARY' : `LOGGED ${attendanceStatus}`}
              </p>
            </div>
            <div className="p-6 rounded-3xl bg-slate-50 text-center border border-slate-100">
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mb-1">LOGGED AT</p>
              <p className="font-black text-2xl font-mono text-slate-900">{checkInTime || '--:--'}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-5">
            <Button 
              className="flex-1 h-20 text-xl font-bold rounded-2xl bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all active:scale-95" 
              disabled={attendanceStatus !== "NONE" || !location} 
              onClick={handleCheckIn}
            >
              Check-In
            </Button>
            <Button 
              variant="destructive" 
              className="flex-1 h-20 text-xl font-bold rounded-2xl shadow-lg shadow-rose-200 transition-all active:scale-95" 
              disabled={attendanceStatus !== "IN"} 
              onClick={handleCheckOut}
            >
              Check-Out
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="font-bold text-xl flex items-center gap-2"><History className="w-5 h-5 text-slate-400" /> My Attendance History</h3>
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
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No attendance history found.</TableCell></TableRow>
              ) : (
                history.map((h) => (
                  <TableRow key={h.id} className="hover:bg-slate-50/50">
                    <TableCell className="font-medium">{h.employeeName}</TableCell>
                    <TableCell className="text-sm">{h.inPlant || "--"}</TableCell>
                    <TableCell className="font-mono text-xs">{h.date} {h.inTime}</TableCell>
                    <TableCell className="text-sm">{h.outPlant || "--"}</TableCell>
                    <TableCell className="font-mono text-xs">{h.date} {h.outTime || "--:--"}</TableCell>
                    <TableCell className="font-bold text-emerald-600">{h.hours}h</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px] font-bold">{h.attendanceType}</Badge></TableCell>
                    <TableCell>
                      {h.approved ? (
                        <Badge className="bg-emerald-600 border-none">Approved</Badge>
                      ) : h.remark ? (
                        <Badge variant="destructive" className="border-none">Rejected</Badge>
                      ) : (
                        <Badge variant="secondary" className="border-none">Pending</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
