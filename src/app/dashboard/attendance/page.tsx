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
  AlertTriangle, 
  ShieldCheck, 
  Home, 
  Building2, 
  Calendar as CalendarIcon,
  Navigation,
  History
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
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [detectedPlant, setDetectedPlant] = useState<Plant | null>(null);
  const [address, setAddress] = useState<string>("Detecting location...");
  const [attendanceStatus, setAttendanceStatus] = useState<"NONE" | "IN" | "OUT">("NONE");
  const [attendanceType, setAttendanceType] = useState<'OFFICE' | 'FIELD' | 'WFH'>('OFFICE');
  const [checkInTime, setCheckInTime] = useState<string | null>(null);
  const [isHoliday, setIsHoliday] = useState(false);
  const { toast } = useToast();

  // Mock 45-day history for the logged-in employee
  const history: AttendanceRecord[] = useMemo(() => {
    return Array.from({ length: 15 }).map((_, i) => ({
      id: `hist-${i}`,
      employeeId: "emp-mock",
      employeeName: "Employee Name",
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
  }, []);

  useEffect(() => {
    const today = new Date();
    setIsHoliday(checkIfSunday(today));

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setLocation({ lat, lng });
          
          // Geofencing Check
          let foundPlant: Plant | null = null;
          for (const plant of MOCK_PLANTS) {
            const distance = calculateDistance(lat, lng, plant.lat, plant.lng);
            if (distance <= plant.radius) {
              foundPlant = plant;
              break;
            }
          }

          if (foundPlant) {
            setDetectedPlant(foundPlant);
            setAttendanceType('OFFICE');
          }
          setAddress(`Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`);
        },
        (err) => {
          toast({ variant: "destructive", title: "GPS Required", description: "Please enable location to check-in." });
          setAddress("Permission Denied");
        }
      );
    }
  }, [toast]);

  const handleCheckIn = () => {
    if (!detectedPlant && attendanceType === 'OFFICE') {
      toast({ variant: "destructive", title: "Out of Range", description: "Select 'Field' or 'Work from Home' if not at a plant." });
      return;
    }
    setAttendanceStatus("IN");
    setCheckInTime(new Date().toLocaleTimeString());
    toast({ 
      title: "Check-In Successful", 
      description: `Logged at ${detectedPlant ? detectedPlant.name : attendanceType}.` 
    });
  };

  const handleCheckOut = () => {
    setAttendanceStatus("OUT");
    toast({ title: "Check-Out Successful", description: "Your attendance cycle is complete." });
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12">
      {isHoliday && (
        <Card className="bg-amber-50 border-amber-200 shadow-none">
          <CardContent className="p-4 flex items-center gap-3">
            <CalendarIcon className="text-amber-600 w-5 h-5" />
            <p className="text-sm font-bold text-amber-900">Weekly Off Today (Sunday)</p>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-xl border-none overflow-hidden">
        <div className="h-2 bg-primary" />
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
            <ShieldCheck className="text-primary w-6 h-6" />
            Check-In / Check-Out
          </CardTitle>
          <CardDescription>Verify your presence at Sikka Industries</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-8">
          
          <div className={`p-5 rounded-2xl flex items-center justify-between border ${detectedPlant ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-full ${detectedPlant ? 'bg-emerald-100' : 'bg-slate-200'}`}>
                <MapPin className={detectedPlant ? 'text-emerald-600' : 'text-slate-500'} />
              </div>
              <div>
                <p className="text-sm font-bold uppercase tracking-tight text-muted-foreground">Location Verification</p>
                <h4 className="font-bold text-lg">{detectedPlant ? detectedPlant.name : "Outside Plant Radius"}</h4>
                <p className="text-xs text-muted-foreground">{address}</p>
              </div>
            </div>
            <Badge variant={detectedPlant ? 'default' : 'outline'} className={detectedPlant ? 'bg-emerald-600' : ''}>
              {detectedPlant ? 'In Radius' : 'Manual Selection'}
            </Badge>
          </div>

          {!detectedPlant && attendanceStatus === "NONE" && (
            <div className="space-y-3 p-5 bg-blue-50/50 border border-blue-100 rounded-2xl">
              <Label className="text-sm font-bold flex items-center gap-2">
                <Navigation className="w-4 h-4 text-blue-600" /> Attendance Type
              </Label>
              <Select value={attendanceType} onValueChange={(v: any) => setAttendanceType(v)}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FIELD" className="font-medium">Field Visit</SelectItem>
                  <SelectItem value="WFH" className="font-medium">Work from Home</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                You are currently outside the 0.7km verification geofence. Please select your work mode manually.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 text-center">
              <Clock className="w-5 h-5 mx-auto mb-2 text-primary opacity-50" />
              <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Session Status</p>
              <p className="font-bold text-xl mt-1">{attendanceStatus === "NONE" ? "Pending" : attendanceStatus}</p>
            </div>
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 text-center">
              <CheckCircle2 className="w-5 h-5 mx-auto mb-2 text-emerald-500 opacity-50" />
              <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Check-In Time</p>
              <p className="font-bold text-xl mt-1">{checkInTime || '--:--'}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <Button 
              className="flex-1 h-16 text-lg font-bold shadow-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-30 transition-all"
              disabled={attendanceStatus !== "NONE" || !location}
              onClick={handleCheckIn}
            >
              Check-In
            </Button>
            <Button 
              variant="destructive"
              className="flex-1 h-16 text-lg font-bold shadow-lg disabled:opacity-30 transition-all"
              disabled={attendanceStatus !== "IN"}
              onClick={handleCheckOut}
            >
              Check-Out
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-slate-400" />
          <h3 className="font-bold text-lg">My Attendance History (Last 45 Days)</h3>
        </div>
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="font-bold">Date</TableHead>
                <TableHead className="font-bold">In-Plant / Location</TableHead>
                <TableHead className="font-bold">IN / OUT</TableHead>
                <TableHead className="font-bold">Working Hours</TableHead>
                <TableHead className="font-bold">Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="text-sm font-medium">{h.date}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold">{h.inPlant || "Field"}</span>
                      <span className="text-[10px] text-muted-foreground truncate max-w-[150px]">{h.address}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="font-mono text-[10px]">{h.inTime}</Badge>
                      <Badge variant="outline" className="font-mono text-[10px]">{h.outTime}</Badge>
                    </div>
                  </TableCell>
                  <TableCell className="font-bold">{h.hours}h</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-tight">
                      {h.attendanceType}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
