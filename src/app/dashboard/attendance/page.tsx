"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  MapPin, 
  Clock, 
  CheckCircle2, 
  ShieldCheck, 
  Calendar as CalendarIcon,
  Navigation,
  History,
  Info
} from "lucide-react";
import { calculateDistance, checkIfSunday } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableRow, 
  TableHead, 
  TableCell 
} from "@/components/ui/table";
import { AttendanceRecord, Plant } from "@/lib/types";

// Mock Plants from Admin Panel
const MOCK_PLANTS: Plant[] = [
  { id: "plant-1", name: "Okhla Phase III Plant", lat: 28.5355, lng: 77.2639, radius: 700 },
  { id: "plant-2", name: "Gurgaon Sec 18 Plant", lat: 28.4595, lng: 77.0266, radius: 700 },
];

export default function AttendancePage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [detectedPlant, setDetectedPlant] = useState<Plant | null>(null);
  const [address, setAddress] = useState<string>("Detecting location...");
  const [attendanceStatus, setAttendanceStatus] = useState<"NONE" | "IN" | "OUT">("NONE");
  const [attendanceType, setAttendanceType] = useState<'OFFICE' | 'FIELD' | 'WFH'>('OFFICE');
  const [checkInTime, setCheckInTime] = useState<string | null>(null);
  const [isHoliday, setIsHoliday] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) setCurrentUser(JSON.parse(savedUser));
  }, []);

  // Mock 45-day history for the logged-in employee ONLY
  const history: AttendanceRecord[] = useMemo(() => {
    if (!currentUser) return [];
    
    return Array.from({ length: 15 }).map((_, i) => ({
      id: `hist-${i}`,
      employeeId: currentUser.id,
      employeeName: currentUser.fullName,
      date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      inTime: "09:00 AM",
      outTime: "06:00 PM",
      inPlant: "Okhla Phase III",
      outPlant: "Okhla Phase III",
      hours: 9,
      status: 'PRESENT',
      attendanceType: 'OFFICE',
      lat: 28.5355,
      lng: 77.2639,
      address: "Verified Plant Location",
      approved: true
    }));
  }, [currentUser]);

  useEffect(() => {
    const today = new Date();
    setIsHoliday(checkIfSunday(today));

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setLocation({ lat, lng });
          
          // Geofencing Check (0.7 KM Radius)
          let foundPlant: Plant | null = null;
          for (const plant of MOCK_PLANTS) {
            const distance = calculateDistance(lat, lng, plant.lat, plant.lng);
            if (distance <= 700) { // Always use 700m as per requirements
              foundPlant = plant;
              break;
            }
          }

          if (foundPlant) {
            setDetectedPlant(foundPlant);
            setAttendanceType('OFFICE');
          } else {
            // If outside 0.7km, default to FIELD for manual choice
            setAttendanceType('FIELD');
          }
          setAddress(`Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`);
        },
        (err) => {
          toast({ variant: "destructive", title: "GPS Required", description: "Please enable location to perform Check-In." });
          setAddress("Permission Denied");
        }
      );
    }
  }, [toast]);

  const handleCheckIn = () => {
    // If user is at plant, it's automatic. If not, they must select Field/WFH.
    if (!detectedPlant && attendanceType === 'OFFICE') {
      toast({ variant: "destructive", title: "Out of Range", description: "You are not near any plant. Please select Field or Work from Home." });
      return;
    }
    
    setAttendanceStatus("IN");
    setCheckInTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    toast({ 
      title: "Check-In Successful", 
      description: `Logged at ${detectedPlant ? detectedPlant.name : attendanceType} mode.` 
    });
  };

  const handleCheckOut = () => {
    setAttendanceStatus("OUT");
    toast({ title: "Check-Out Successful", description: "Your daily log has been finalized." });
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {isHoliday && (
        <Card className="bg-amber-50 border-amber-200 shadow-none">
          <CardContent className="p-4 flex items-center gap-3">
            <CalendarIcon className="text-amber-600 w-5 h-5" />
            <p className="text-sm font-bold text-amber-900">Weekly Off Today (Sunday)</p>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-2xl border-none overflow-hidden bg-white">
        <div className="h-3 bg-primary" />
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-3xl font-bold flex items-center justify-center gap-2">
            <ShieldCheck className="text-primary w-8 h-8" />
            Check-In / Check-Out
          </CardTitle>
          <CardDescription className="text-base">Secure Attendance Gateway for Sikka Industries</CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6 p-10">
          {/* Location Scanner */}
          <div className={`p-6 rounded-3xl flex items-center justify-between border-2 transition-all ${detectedPlant ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center gap-5">
              <div className={`p-4 rounded-2xl ${detectedPlant ? 'bg-emerald-100' : 'bg-slate-200'}`}>
                <MapPin className={detectedPlant ? 'text-emerald-600' : 'text-slate-500'} size={28} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-1">Live Geofence Scan</p>
                <h4 className="font-bold text-xl">{detectedPlant ? detectedPlant.name : "Outside Geofence (0.7 KM)"}</h4>
                <p className="text-sm text-muted-foreground font-mono">{address}</p>
              </div>
            </div>
            <Badge variant={detectedPlant ? 'default' : 'outline'} className={`h-10 px-4 text-sm ${detectedPlant ? 'bg-emerald-600' : 'border-slate-300'}`}>
              {detectedPlant ? 'Verified Plant' : 'Manual Mode Req.'}
            </Badge>
          </div>

          {/* Conditional Selection for Outside Radius */}
          {!detectedPlant && attendanceStatus === "NONE" && (
            <div className="space-y-4 p-6 bg-blue-50/50 border-2 border-blue-100 rounded-3xl">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-bold flex items-center gap-2 text-blue-900">
                  <Navigation className="w-4 h-4 text-blue-600" /> Choose Attendance Type
                </Label>
                <Badge variant="secondary" className="bg-blue-100 text-blue-700">Required</Badge>
              </div>
              <Select value={attendanceType} onValueChange={(v: any) => setAttendanceType(v)}>
                <SelectTrigger className="bg-white h-12 border-blue-200">
                  <SelectValue placeholder="Select work mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FIELD" className="font-medium py-3">Field Visit / Outside Plant</SelectItem>
                  <SelectItem value="WFH" className="font-medium py-3">Work from Home</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-2 p-3 bg-blue-100/50 rounded-xl">
                 <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                 <p className="text-[11px] text-blue-800 leading-normal">
                    You are currently <strong>outside the 0.7km</strong> verification zone. Office attendance is locked.
                 </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-6">
            <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100 text-center shadow-inner">
              <Clock className="w-6 h-6 mx-auto mb-3 text-primary opacity-60" />
              <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Punch Status</p>
              <p className="font-bold text-2xl mt-1">{attendanceStatus === "NONE" ? "Awaiting IN" : attendanceStatus}</p>
            </div>
            <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100 text-center shadow-inner">
              <CheckCircle2 className="w-6 h-6 mx-auto mb-3 text-emerald-500 opacity-60" />
              <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Logged Time</p>
              <p className="font-bold text-2xl mt-1 font-mono">{checkInTime || '--:--'}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-5 pt-4">
            <Button 
              className="flex-1 h-20 text-xl font-bold shadow-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-30 transition-all active:scale-[0.98] rounded-2xl"
              disabled={attendanceStatus !== "NONE" || !location}
              onClick={handleCheckIn}
            >
              Check-In
            </Button>
            <Button 
              variant="destructive"
              className="flex-1 h-20 text-xl font-bold shadow-xl disabled:opacity-30 transition-all active:scale-[0.98] rounded-2xl"
              disabled={attendanceStatus !== "IN"}
              onClick={handleCheckOut}
            >
              Check-Out
            </Button>
          </div>
          
          <div className="p-4 bg-slate-50 rounded-xl flex items-start gap-3 border border-slate-100">
            <Info className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-500 leading-relaxed italic">
              * Note: If you forget to Check-Out, the system will automatically log you out after 16 hours and deduct an 8-hour shift.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* History Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-lg">
              <History className="w-5 h-5 text-slate-500" />
            </div>
            <h3 className="font-bold text-xl">My Attendance History (Last 45 Days)</h3>
          </div>
          <Badge variant="outline" className="font-mono text-xs">{currentUser?.fullName}</Badge>
        </div>
        
        <Card className="border-slate-200 shadow-xl overflow-hidden rounded-2xl">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="font-bold">Employee Name</TableHead>
                <TableHead className="font-bold">In Plant / Loc</TableHead>
                <TableHead className="font-bold">In Date Time</TableHead>
                <TableHead className="font-bold">Out Plant / Loc</TableHead>
                <TableHead className="font-bold">Out Date Time</TableHead>
                <TableHead className="font-bold">Working Hours</TableHead>
                <TableHead className="font-bold">Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((h) => (
                <TableRow key={h.id} className="hover:bg-slate-50/50">
                  <TableCell className="font-bold text-slate-700">{h.employeeName}</TableCell>
                  <TableCell className="text-sm font-medium">{h.inPlant || "Field"}</TableCell>
                  <TableCell className="font-mono text-xs">{h.date} | {h.inTime}</TableCell>
                  <TableCell className="text-sm font-medium">{h.outPlant || "Field"}</TableCell>
                  <TableCell className="font-mono text-xs">{h.date} | {h.outTime}</TableCell>
                  <TableCell className="font-bold text-emerald-600">{h.hours}h</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-tight py-0">
                      {h.attendanceType}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {history.length === 0 && (
                <TableRow>
                   <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                      No history found for your profile.
                   </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
