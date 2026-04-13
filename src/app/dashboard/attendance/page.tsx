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
  History,
  Info,
  Navigation
} from "lucide-react";
import { calculateDistance } from "@/lib/utils";
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
  const { toast } = useToast();

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) setCurrentUser(JSON.parse(savedUser));
  }, []);

  const history: AttendanceRecord[] = useMemo(() => {
    if (!currentUser) return [];
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 15 }).map((_, i) => ({
      id: `hist-${i}`,
      employeeId: currentUser.id,
      employeeName: currentUser.fullName,
      date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      inTime: "09:00",
      outTime: "18:00",
      inPlant: "Okhla Phase III",
      outPlant: "Okhla Phase III",
      hours: 9,
      status: 'PRESENT',
      attendanceType: 'OFFICE',
      lat: 28.5355,
      lng: 77.2639,
      address: "Verified Plant Location",
      approved: i % 3 === 0,
      remark: i % 3 === 1 ? "Incorrect GPS" : undefined
    }));
  }, [currentUser]);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude: lat, longitude: lng } = pos.coords;
          setLocation({ lat, lng });
          
          let foundPlant = MOCK_PLANTS.find(p => calculateDistance(lat, lng, p.lat, p.lng) <= 700);
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
  }, [toast]);

  const handleCheckIn = () => {
    if (!detectedPlant && attendanceType === 'OFFICE') {
      toast({ variant: "destructive", title: "Out of Range", description: "Please select Field or WFH mode." });
      return;
    }
    setAttendanceStatus("IN");
    setCheckInTime(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }));
    toast({ title: "Check-In Successful" });
  };

  const handleCheckOut = () => {
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
        <CardContent className="space-y-6 p-10">
          <div className={`p-6 rounded-3xl flex items-center justify-between border-2 ${detectedPlant ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center gap-5">
              <div className={`p-4 rounded-2xl ${detectedPlant ? 'bg-emerald-100' : 'bg-slate-200'}`}><MapPin className={detectedPlant ? 'text-emerald-600' : 'text-slate-500'} size={28} /></div>
              <div>
                <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground mb-1">Geofence Status (0.7 KM)</p>
                <h4 className="font-bold text-xl">{detectedPlant ? detectedPlant.name : "Outside Geofence"}</h4>
                <p className="text-sm text-muted-foreground font-mono">{address}</p>
              </div>
            </div>
            <Badge variant={detectedPlant ? 'default' : 'outline'}>{detectedPlant ? 'Plant Verified' : 'Manual Selection'}</Badge>
          </div>

          {!detectedPlant && attendanceStatus === "NONE" && (
            <div className="space-y-4 p-6 bg-blue-50/50 border-2 border-blue-100 rounded-3xl">
              <Label className="text-sm font-bold flex items-center gap-2"><Navigation className="w-4 h-4" /> Attendance Type</Label>
              <Select value={attendanceType} onValueChange={(v: any) => setAttendanceType(v)}>
                <SelectTrigger className="bg-white h-12 border-blue-200"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="FIELD">Field Visit</SelectItem><SelectItem value="WFH">Work from Home</SelectItem></SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-6">
            <div className="p-6 rounded-3xl bg-slate-50 text-center"><p className="text-[10px] text-muted-foreground font-black">STATUS</p><p className="font-bold text-2xl">{attendanceStatus}</p></div>
            <div className="p-6 rounded-3xl bg-slate-50 text-center"><p className="text-[10px] text-muted-foreground font-black">LOGGED AT</p><p className="font-bold text-2xl font-mono">{checkInTime || '--:--'}</p></div>
          </div>

          <div className="flex flex-col sm:flex-row gap-5">
            <Button className="flex-1 h-20 text-xl font-bold rounded-2xl bg-emerald-600" disabled={attendanceStatus !== "NONE" || !location} onClick={handleCheckIn}>Check-In</Button>
            <Button variant="destructive" className="flex-1 h-20 text-xl font-bold rounded-2xl" disabled={attendanceStatus !== "IN"} onClick={handleCheckOut}>Check-Out</Button>
          </div>
          <p className="text-xs text-slate-400 italic text-center">* Auto-checkout after 16hrs with 8hr shift deduction if forgotten.</p>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="font-bold text-xl flex items-center gap-2"><History className="w-5 h-5 text-slate-400" /> My History (Last 45 Days)</h3>
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
              {history.map((h) => (
                <TableRow key={h.id} className="hover:bg-slate-50/50">
                  <TableCell className="font-medium">{h.employeeName}</TableCell>
                  <TableCell className="text-sm">{h.inPlant || "--"}</TableCell>
                  <TableCell className="font-mono text-xs">{h.date} {h.inTime}</TableCell>
                  <TableCell className="text-sm">{h.outPlant || "--"}</TableCell>
                  <TableCell className="font-mono text-xs">{h.date} {h.outTime}</TableCell>
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
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
