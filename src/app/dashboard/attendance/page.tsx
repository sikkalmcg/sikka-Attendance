"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
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
  Navigation,
  ChevronLeft,
  ChevronRight,
  Pencil
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
import { AttendanceRecord, Plant, AppNotification } from "@/lib/types";
import { useData } from "@/context/data-context";
import { format, subDays, eachDayOfInterval, isSunday, isSameDay } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ATTENDANCE_RULES } from "@/lib/constants";

export default function AttendancePage() {
  const { attendanceRecords, setAttendanceRecords, plants, holidays, setNotifications } = useData();
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

  // Admin Edit State
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedRecordToEdit, setSelectedRecordToEdit] = useState<any>(null);
  const [editTimes, setEditTimes] = useState({ in: "", out: "" });

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 15;

  const { toast } = useToast();

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) setCurrentUser(JSON.parse(savedUser));
    
    // Defer date initialization to avoid hydration mismatch
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

  // History Filter with Auto-Absent Logic (Last 45 Days)
  const history = useMemo(() => {
    if (!currentUser) return [];
    
    const today = new Date();
    const fortyFiveDaysAgo = subDays(today, 45);
    fortyFiveDaysAgo.setHours(0, 0, 0, 0);

    const dateRange = eachDayOfInterval({ start: fortyFiveDaysAgo, end: today });
    
    return dateRange.map(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const existingRecord = (attendanceRecords || []).find(r => r.employeeId === currentUser.username && r.date === dateStr);
      
      const isSun = isSunday(date);
      const holiday = (holidays || []).find(h => h.date === dateStr);
      const isNonWorkingDay = isSun || !!holiday;
      const nonWorkingDayLabel = isSun ? "WEEKLY_OFF" : (holiday ? "HOLIDAY" : null);

      if (existingRecord) {
        return {
          ...existingRecord,
          isNonWorkingDay,
          nonWorkingDayLabel
        };
      }

      // Don't show today as absent if it hasn't happened yet
      if (isSameDay(date, today)) return null;

      if (isSun) {
        return {
          id: `virtual-sun-${dateStr}`,
          employeeId: currentUser.username,
          employeeName: currentUser.fullName,
          date: dateStr,
          status: 'WEEKLY_OFF',
          attendanceType: '--',
          approved: true,
          isNonWorkingDay: true,
          nonWorkingDayLabel: "WEEKLY_OFF"
        } as any;
      }

      if (holiday) {
        return {
          id: `virtual-hol-${dateStr}`,
          employeeId: currentUser.username,
          employeeName: currentUser.fullName,
          date: dateStr,
          status: 'HOLIDAY',
          attendanceType: '--',
          approved: true,
          isNonWorkingDay: true,
          nonWorkingDayLabel: "HOLIDAY"
        } as any;
      }

      // Default: Absent
      return {
        id: `virtual-abs-${dateStr}`,
        employeeId: currentUser.username,
        employeeName: currentUser.fullName,
        date: dateStr,
        status: 'ABSENT',
        attendanceType: '--',
        approved: true,
        hours: 0,
        inTime: null,
        outTime: null,
        isNonWorkingDay: false
      } as any;
    }).filter(Boolean).reverse();
  }, [currentUser, attendanceRecords, holidays]);

  const totalPages = Math.ceil(history.length / rowsPerPage);
  const paginatedHistory = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return history.slice(start, start + rowsPerPage);
  }, [history, currentPage]);

  const addNotification = (message: string) => {
    const newNotif: AppNotification = {
      id: Math.random().toString(36).substr(2, 9),
      message,
      timestamp: format(new Date(), "yyyy-MM-dd HH:mm:ss"),
      read: false
    };
    setNotifications(prev => [newNotif, ...prev].slice(0, 50)); // Keep last 50 total
  };

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
        const plant = (plants || []).find(p => calculateDistance(lat, lng, p.lat, p.lng) <= 700);
        setDetectedPlant(plant || null);
        const mockAddress = plant ? `${plant.name}, Industrial Estate` : `Street ${Math.floor(lat)}, City Hub`;
        setDetectedAddress(mockAddress);
        setIsLoadingLocation(false);
        setActiveDialog(type);
      },
      (err) => {
        toast({ variant: "destructive", title: "GPS Access Denied", description: "Enable location permissions to proceed." });
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
      status: 'PRESENT',
      attendanceType: type,
      lat: currentGPS.lat,
      lng: currentGPS.lng,
      address: detectedAddress,
      inPlant: detectedPlant?.name || type,
      approved: false 
    };

    setAttendanceRecords(prev => [...prev, newRecord]);
    addNotification(`${currentUser.fullName} (${currentUser.username}) marked IN at ${time} (${type})`);
    setActiveDialog("NONE");
    toast({ title: "Check-In Success", description: "Attendance logged and sent for approval." });
  };

  const handleConfirmCheckOut = () => {
    if (!todayRecord || !currentGPS) return;
    const time = format(new Date(), "HH:mm");
    const typeOut = detectedPlant ? 'OFFICE' : manualType;
    
    // Auto Rule: If Check-Out is > 16h after Check-In, set fixed 8h
    const inDateTime = new Date(`${todayRecord.date} ${todayRecord.inTime}`);
    const outDateTime = new Date(`${todayRecord.date} ${time}`);
    const diffHours = (outDateTime.getTime() - inDateTime.getTime()) / (1000 * 60 * 60);
    
    let finalOutTime = time;
    let finalHours = parseFloat(diffHours.toFixed(2));
    let isAuto = false;

    if (diffHours > 16) {
      // Auto-Checkout Logic
      const autoOutDate = new Date(inDateTime.getTime() + (8 * 60 * 60 * 1000));
      finalOutTime = format(autoOutDate, "HH:mm");
      finalHours = 8.0;
      isAuto = true;
    }

    setAttendanceRecords(prev => prev.map(r => 
      r.id === todayRecord.id ? { 
        ...r, 
        outTime: finalOutTime, 
        hours: finalHours,
        attendanceTypeOut: typeOut,
        latOut: currentGPS.lat,
        lngOut: currentGPS.lng,
        addressOut: detectedAddress,
        outPlant: detectedPlant?.name || typeOut,
        autoCheckout: isAuto
      } : r
    ));

    addNotification(`${todayRecord.employeeName} (${todayRecord.employeeId}) marked OUT at ${finalOutTime} (Worked: ${finalHours}h)`);
    setActiveDialog("NONE");
    toast({ title: "Check-Out Success", description: isAuto ? "Auto-checkout applied (8h rule)." : `Shift ended at ${finalOutTime}.` });
  };

  // ADMIN EDIT LOGIC
  const handleAdminEditClick = (rec: any) => {
    setSelectedRecordToEdit(rec);
    setEditTimes({ in: rec.inTime || "", out: rec.outTime || "" });
    setIsEditDialogOpen(true);
  };

  const handleSaveAdminEdit = () => {
    if (!selectedRecordToEdit || !currentUser) return;

    const inTime = editTimes.in;
    const outTime = editTimes.out;
    
    // Calculate Hours
    let hours = 0;
    if (inTime && outTime) {
      const dummyDate = "2024-01-01 ";
      const start = new Date(dummyDate + inTime);
      const end = new Date(dummyDate + outTime);
      const diffMs = end.getTime() - start.getTime();
      if (!isNaN(diffMs) && diffMs >= 0) {
        hours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
      }
    }

    // Determine Status
    const status = hours > ATTENDANCE_RULES.PRESENT_THRESHOLD ? 'PRESENT' : (hours > 0 ? 'HALF_DAY' : 'ABSENT');

    const isVirtual = selectedRecordToEdit.id.startsWith('virtual-');

    if (isVirtual) {
      // Create new record for the day if it was virtual
      const newRec: AttendanceRecord = {
        id: Math.random().toString(36).substr(2, 9),
        employeeId: selectedRecordToEdit.employeeId,
        employeeName: selectedRecordToEdit.employeeName,
        date: selectedRecordToEdit.date,
        inTime,
        outTime,
        hours,
        status: status as any,
        attendanceType: 'FIELD',
        lat: 0,
        lng: 0,
        address: "Manually adjusted by Admin",
        approved: true,
        remark: "Manually posted by Super Admin"
      };
      setAttendanceRecords(prev => [...prev, newRec]);
    } else {
      // Update existing record
      setAttendanceRecords(prev => prev.map(r => 
        r.id === selectedRecordToEdit.id ? { 
          ...r, 
          inTime, 
          outTime, 
          hours, 
          status: status as any,
          remark: "Adjusted by Super Admin"
        } : r
      ));
    }

    addNotification(`ADMIN: ${currentUser.fullName} manually adjusted logs for ${selectedRecordToEdit.date}`);
    setIsEditDialogOpen(false);
    toast({ title: "Manual Adjustment Applied", description: "Record has been updated and recalculated." });
  };

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12 px-4">
      {/* Reduced Clock Section - 50% smaller container */}
      <Card className="shadow-2xl border-none overflow-hidden bg-white max-w-md mx-auto">
        <div className="h-1 bg-primary" />
        <CardHeader className="text-center py-4">
          <CardTitle className="text-lg font-black flex items-center justify-center gap-2 text-slate-800">
            <ShieldCheck className="text-primary w-5 h-5" /> Gateway Portal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 px-6 pb-8 pt-0">
          {/* Light Blue Compact Clock Box */}
          <div className="py-6 px-8 rounded-3xl bg-sky-50 text-sky-900 flex flex-col items-center justify-center space-y-1 shadow-inner border border-sky-100 max-w-[280px] mx-auto transition-all">
            {currentTime ? (
              <div className="text-center">
                <h2 className="text-5xl font-black tracking-tighter font-mono text-sky-900 leading-none">
                  {format(currentTime, "HH:mm")}
                </h2>
                <p className="text-[11px] font-black text-sky-600/80 mt-2 flex items-center justify-center gap-1.5 uppercase tracking-widest">
                  <Calendar className="w-3.5 h-3.5" /> {format(currentTime, "dd-MMMM-yyyy")}
                </p>
              </div>
            ) : (
              <Loader2 className="w-8 h-8 text-sky-300 animate-spin" />
            )}
          </div>

          <div className="flex gap-4">
            <Button 
              className="flex-1 h-14 text-sm font-black rounded-2xl bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all active:scale-95 disabled:bg-slate-50 disabled:text-slate-300" 
              disabled={isLoadingLocation || (!!todayRecord && !!todayRecord.inTime)} 
              onClick={() => requestLocation("IN")}
            >
              Mark Check-In
            </Button>
            <Button 
              className="flex-1 h-14 text-sm font-black rounded-2xl bg-rose-500 hover:bg-rose-600 shadow-lg shadow-rose-100 transition-all active:scale-95 disabled:bg-slate-50 disabled:text-slate-300" 
              disabled={isLoadingLocation || !todayRecord || (!!todayRecord && !!todayRecord.outTime)} 
              onClick={() => requestLocation("OUT")}
            >
              Mark Check-Out
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* History Table - Filtered to last 45 days with Pagination */}
      <div className="space-y-4 max-w-6xl mx-auto pt-6">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-xl flex items-center gap-2 text-slate-700">
            <History className="w-6 h-6 text-primary" /> My Attendance History
          </h3>
        </div>
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
                {isSuperAdmin && <TableHead className="font-bold text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedHistory.length === 0 ? (
                <TableRow><TableCell colSpan={isSuperAdmin ? 9 : 8} className="text-center py-12 text-muted-foreground font-medium">No records found for last 45 days.</TableCell></TableRow>
              ) : (
                paginatedHistory.map((h: any) => (
                  <TableRow key={h.id} className="hover:bg-slate-50/50">
                    <TableCell className="text-sm font-bold text-slate-700">{h.employeeName}</TableCell>
                    <TableCell className="text-sm font-bold text-slate-700">{h.inPlant || "--"}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{h.date} {h.inTime || "--:--"}</TableCell>
                    <TableCell className="text-sm font-bold text-slate-700">{h.outPlant || "--"}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{h.date} {h.outTime || "--:--"}</TableCell>
                    <TableCell className={cn("font-black", (h.status === 'ABSENT' || h.status === 'WEEKLY_OFF' || h.status === 'HOLIDAY') ? "text-rose-500" : "text-emerald-600")}>
                      {h.status === 'ABSENT' ? "0.00h" : (h.status === 'WEEKLY_OFF' || h.status === 'HOLIDAY') ? "0h" : `${h.hours || 0}h`}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-black uppercase tracking-tight">
                        {h.attendanceType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {h.status === 'ABSENT' ? (
                        <Badge variant="destructive" className="border-none font-bold uppercase text-[9px]">Absent</Badge>
                      ) : h.status === 'WEEKLY_OFF' || h.status === 'HOLIDAY' ? (
                        <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-400 font-bold uppercase text-[9px]">{h.status.replace('_', ' ')}</Badge>
                      ) : h.isNonWorkingDay ? (
                        <Badge variant="secondary" className={cn(
                          "border-none font-bold uppercase text-[9px] bg-amber-50 text-amber-600",
                          h.approved && "bg-emerald-50 text-emerald-700"
                        )}>
                          {h.status === 'HALF_DAY' ? 'Holiday Half day' : 'Holiday Present'}
                        </Badge>
                      ) : h.approved ? (
                        <Badge className="bg-emerald-600 border-none font-bold uppercase text-[9px]">Approved</Badge>
                      ) : (
                        <Badge variant="secondary" className="border-none font-bold uppercase text-[9px] bg-amber-50 text-amber-600">Pending</Badge>
                      )}
                    </TableCell>
                    {isSuperAdmin && (
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-primary hover:bg-primary/5"
                          onClick={() => handleAdminEditClick(h)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <CardFooter className="bg-slate-50 border-t flex items-center justify-between p-4">
              <div className="text-xs font-bold text-muted-foreground">
                Showing {((currentPage - 1) * rowsPerPage) + 1} - {Math.min(currentPage * rowsPerPage, history.length)} of {history.length}
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                  className="h-8 rounded-lg font-bold"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                </Button>
                <div className="text-xs font-black px-4 bg-white h-8 flex items-center rounded-lg border border-slate-200 shadow-sm">
                  Page {currentPage} of {totalPages}
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                  className="h-8 rounded-lg font-bold"
                >
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardFooter>
          )}
        </Card>
      </div>

      <Dialog open={activeDialog === "IN"} onOpenChange={(o) => !o && setActiveDialog("NONE")}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Navigation className="w-5 h-5 text-primary" /> Confirm Check-In</DialogTitle>
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
                <Building2 className="w-4 h-4 text-primary mt-1" />
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Detected Plant</p>
                  <p className="text-sm font-bold text-primary">{detectedPlant ? detectedPlant.name : "Field / Remote"}</p>
                </div>
              </div>
            </div>
            {!detectedPlant && (
              <div className="space-y-2">
                <Label className="font-black text-xs">Work Mode Selection</Label>
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
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Current Location</p>
                  <p className="text-sm font-bold text-slate-700">{detectedAddress}</p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter><Button className="w-full h-12 rounded-xl font-black bg-rose-500 hover:bg-rose-600" onClick={handleConfirmCheckOut}>Confirm Check-Out</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ADMIN EDIT DIALOG */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-primary" />
              Adjust Attendance Logs
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Employee</p>
              <p className="font-bold text-slate-700">{selectedRecordToEdit?.employeeName}</p>
              <p className="text-xs text-muted-foreground">{selectedRecordToEdit?.date}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold">In Time (24h)</Label>
                <Input 
                  type="time" 
                  value={editTimes.in} 
                  onChange={(e) => setEditTimes(prev => ({...prev, in: e.target.value}))}
                  className="bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold">Out Time (24h)</Label>
                <Input 
                  type="time" 
                  value={editTimes.out} 
                  onChange={(e) => setEditTimes(prev => ({...prev, out: e.target.value}))}
                  className="bg-white"
                />
              </div>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
              <p className="text-[10px] font-bold text-amber-700 leading-relaxed">
                Note: Updating these times will automatically recalculate working hours and status based on organization thresholds.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="rounded-xl">Cancel</Button>
            <Button className="bg-primary px-8 rounded-xl font-bold" onClick={handleSaveAdminEdit}>Update Log</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
