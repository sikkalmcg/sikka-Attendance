
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
import { format, subDays, isAfter, parseISO } from "date-fns";

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
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  // Filter history to only 45 days for the current employee
  const history = useMemo(() => {
    if (!currentUser) return [];
    
    const fortyFiveDaysAgo = subDays(new Date(), 45);
    fortyFiveDaysAgo.setHours(0, 0, 0, 0);

    return (attendanceRecords || [])
      .filter(r => {
        const isMine = r.employeeId === (currentUser.username || "emp-mock");
        const recordDate = parseISO(r.date);
        return isMine && (isAfter(recordDate, fortyFiveDaysAgo) || format(recordDate, 'yyyy-MM-dd') === format(fortyFiveDaysAgo, 'yyyy-MM-dd'));
      })
      .reverse();
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
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <Card className="shadow-2xl border-none overflow-hidden bg-white max-w-2xl mx-auto">
        <div className="h-2 bg-primary" />
        <CardHeader className="text-center py-4">
          <CardTitle className="text-xl font-bold flex items-center justify-center gap-2">
            <ShieldCheck className="text-primary w-5 h-5" /> Gateway Check-In
          </CardTitle>
          <CardDescription className="text-[10px]">Sikka Industries & Logistics Secure Portal</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 px-6 pb-6 pt-0">
          
          {/* Clock Box - Light Blue Theme, Compact Size */}
          <div className="py-4 px-4 rounded-2xl bg-sky-50 text-sky-900 flex flex-col items-center justify-center space-y-2 shadow-sm border-2 border-sky-100 max-w-md mx-auto">
            {currentTime ? (
              <div className="text-center">
                <h2 className="text-5xl font-black tracking-tighter font-mono text-sky-900 leading-none">
                  {format(currentTime, "HH:mm")}
                </h2>
                <p className="text-sm font-bold text-sky-700 mt-1 flex items-center justify-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> {format(currentTime, "dd-MMMM-yyyy")}
                </p>
              </div>
            ) : (
              <div className="h-12 flex items-center justify-center">
                <span className="text-sky-300 text-xs font-bold animate-pulse">Synchronizing...</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              className="flex-1 h-12 text-lg font-black rounded-xl bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-200 transition-all active:scale-95" 
              disabled={attendanceStatus !== "NONE" || !location} 
              onClick={handleCheckIn}
            >
              Mark Check-In
            </Button>
            <Button 
              variant="destructive" 
              className="flex-1 h-12 text-lg font-black rounded-xl shadow-md shadow-rose-200 transition-all active:scale-95 bg-rose-500 hover:bg-rose-600 border-none" 
              disabled={attendanceStatus !== "IN"} 
              onClick={handleCheckOut}
            >
              Mark Check-Out
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4 max-w-6xl mx-auto">
        <h3 className="font-bold text-lg flex items-center gap-2 text-slate-700"><History className="w-5 h-5 text-slate-400" /> My Attendance History</h3>
        <Card className="rounded-xl overflow-hidden shadow-sm border-slate-200">
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
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground font-medium">No attendance history found for the last 45 days.</TableCell></TableRow>
              ) : (
                history.map((h) => (
                  <TableRow key={h.id} className="hover:bg-slate-50/50">
                    <TableCell className="font-bold">{h.employeeName}</TableCell>
                    <TableCell className="text-sm font-medium">{h.inPlant || "--"}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{h.date} {h.inTime}</TableCell>
                    <TableCell className="text-sm font-medium">{h.outPlant || "--"}</TableCell>
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
    </div>
  );
}
