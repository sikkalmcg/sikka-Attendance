"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Clock, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";
import { calculateDistance } from "@/lib/utils";

// Mock Data
const MOCK_PLANT = {
  id: "plant-1",
  name: "Okhla Phase III Plant",
  lat: 28.5355,
  lng: 77.2639,
  radius: 100 // 100 meters
};

export default function AttendancePage() {
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [address, setAddress] = useState<string>("Locating...");
  const [isWithinRadius, setIsWithinRadius] = useState<boolean | null>(null);
  const [attendanceStatus, setAttendanceStatus] = useState<"NONE" | "IN" | "OUT">("NONE");
  const [inTime, setInTime] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setLocation({ lat, lng });
          
          const distance = calculateDistance(lat, lng, MOCK_PLANT.lat, MOCK_PLANT.lng);
          setIsWithinRadius(distance <= MOCK_PLANT.radius);
          setAddress(`Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`);
        },
        (err) => {
          toast({ variant: "destructive", title: "GPS Required", description: "Please enable location to mark attendance." });
          setAddress("Permission Denied");
        }
      );
    }
  }, [toast]);

  const handleMarkIn = () => {
    if (!isWithinRadius) {
      toast({ variant: "destructive", title: "Out of Range", description: "You must be at the plant to mark attendance." });
      return;
    }
    setAttendanceStatus("IN");
    setInTime(new Date().toLocaleTimeString());
    toast({ title: "Check-in Successful", description: "Your attendance IN has been recorded." });
  };

  const handleMarkOut = () => {
    setAttendanceStatus("OUT");
    toast({ title: "Check-out Successful", description: "Your attendance OUT has been recorded." });
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Card className="shadow-xl border-none">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <ShieldCheck className="text-primary w-6 h-6" />
          </div>
          <CardTitle className="text-2xl font-bold">Attendance Gateway</CardTitle>
          <CardDescription>Sikka Industries & Logistics - {MOCK_PLANT.name}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8 p-8">
          
          <div className="flex flex-col items-center space-y-4">
            <div className={`p-4 rounded-2xl w-full flex items-center justify-between border ${isWithinRadius ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
              <div className="flex items-center gap-3">
                <MapPin className={isWithinRadius ? 'text-emerald-600' : 'text-rose-600'} />
                <div>
                  <p className="text-sm font-semibold">{isWithinRadius ? 'Within Plant Radius' : 'Outside Plant Radius'}</p>
                  <p className="text-xs text-muted-foreground">{address}</p>
                </div>
              </div>
              <Badge variant={isWithinRadius ? 'default' : 'destructive'} className={isWithinRadius ? 'bg-emerald-600' : 'bg-rose-600'}>
                {isWithinRadius ? 'Verified' : 'Blocked'}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center">
                <Clock className="w-5 h-5 mx-auto mb-2 text-primary" />
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Status</p>
                <p className="font-bold text-lg">{attendanceStatus === "NONE" ? "Pending" : attendanceStatus}</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center">
                <CheckCircle2 className="w-5 h-5 mx-auto mb-2 text-primary" />
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Check-in</p>
                <p className="font-bold text-lg">{inTime || '--:--'}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4">
            <Button 
              className="w-full h-16 text-lg font-bold bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-200"
              disabled={attendanceStatus !== "NONE" || !isWithinRadius}
              onClick={handleMarkIn}
            >
              Punch IN
            </Button>
            <Button 
              variant="destructive"
              className="w-full h-16 text-lg font-bold shadow-lg shadow-rose-200"
              disabled={attendanceStatus !== "IN" || !isWithinRadius}
              onClick={handleMarkOut}
            >
              Punch OUT
            </Button>
          </div>

          {!isWithinRadius && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl text-amber-800 text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <p>GPS validation failed. You are not within the allowed {MOCK_PLANT.radius}m radius of the plant. Please contact your supervisor if this is an error.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}