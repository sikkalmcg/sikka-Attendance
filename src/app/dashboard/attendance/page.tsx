"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  MapPin,
  Clock,
  ShieldCheck,
  History,
  Loader2,
  Navigation,
  Briefcase,
  Home,
  CheckCircle,
  AlertTriangle,
  Calendar,
  CalendarDays,
  User,
  Filter,
  RefreshCw,
} from "lucide-react";
import { cn, formatDate, getWorkingHoursColor, formatHoursToHHMM, parseDateTime, isEmployeeActiveOnDate } from "@/lib/utils";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell
} from "@/components/ui/table";
import { Plant, Employee } from "@/lib/types";
import { useData } from "@/context/data-context";
import {
  format,
  parseISO,
  addHours,
  isAfter,
  isValid,
  startOfMonth,
  endOfMonth,
  addDays,
  isSunday,
  isSameMonth,
  subMonths,
  differenceInMinutes,
  differenceInCalendarDays,
  isBefore,
  startOfToday,
  startOfDay,
  differenceInCalendarMonths
} from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogDescription
} from "@/components/ui/dialog";
import { RadioGroup } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { postNativeNotification } from "@/lib/android-bridge";
import { getTranslation } from "@/lib/translations";

const getISTTime = () => {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
};

const formatToReadableISTTime = (rawTime: any): string => {
  if (!rawTime) return format(getISTTime(), "hh:mm a");
  const str = String(rawTime).trim();
  if (!str) return format(getISTTime(), "hh:mm a");

  // Case 1: Time string only e.g. "14:34" or "09:04" or "02:34 PM" or "9:04:00 AM"
  if (/^\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM)?$/i.test(str)) {
    const match = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
    if (match) {
      let h = parseInt(match[1], 10);
      const m = match[2];
      const ampmSpec = match[3]?.toUpperCase();
      if (ampmSpec) {
        return `${String(h).padStart(2, '0')}:${m} ${ampmSpec}`;
      }
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      return `${String(h12).padStart(2, '0')}:${m} ${ampm}`;
    }
  }

  // Case 2: Date + Time string without explicit timezone offset (e.g. "2026-09-01 09:04:00" or "2026-09-01T09:04:00")
  // Extract local time directly without false UTC+5:30 double shifts
  const dtMatch = str.match(/^\d{4}-\d{2}-\d{2}[ T](\d{1,2}):(\d{2})(?::\d{2})?(?:\s*(AM|PM))?$/i);
  if (dtMatch) {
    let h = parseInt(dtMatch[1], 10);
    const m = dtMatch[2];
    const ampmSpec = dtMatch[3]?.toUpperCase();
    if (ampmSpec) {
      return `${String(h).padStart(2, '0')}:${m} ${ampmSpec}`;
    }
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${String(h12).padStart(2, '0')}:${m} ${ampm}`;
  }

  // Case 3: ISO string with explicit Z or +/- timezone offset (convert UTC to IST)
  try {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(parsed);
    }
  } catch (e) {}

  return str;
};

const getPreciseDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// --- LEAVE REQUEST FORM COMPONENT (FOR EMPLOYEES) ---
function LeaveRequestForm({ t }: { t?: any }) {
  const [open, setOpen] = useState(false);
  const { addRecord, verifiedUser, currentUser, leaveRequests, refreshData } = useData();
  const { toast } = useToast();
  const [purpose, setPurpose] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [remark, setRemark] = useState("");

  const employeeLang = (verifiedUser?.language || currentUser?.language || 'en').toLowerCase().trim();
  const activeT = t || getTranslation(employeeLang);

  const todayStr = format(startOfToday(), "yyyy-MM-dd");

  const recommendedLeaves = employeeLang === 'hi'
    ? ["बीमारी की छुट्टी", "आकस्मिक अवकाश", "अर्जित अवकाश", "आपातकालीन अवकाश", "विशेषाधिकार अवकाश"]
    : ["Sick Leave", "Casual Leave", "Earned Leave", "Emergency Leave", "Privilege Leave"];

  const totalDays = fromDate && toDate && !isBefore(new Date(toDate), new Date(fromDate))
    ? differenceInCalendarDays(new Date(toDate), new Date(fromDate)) + 1
    : 0;

  const handleRemarkChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const words = e.target.value.split(/\s+/).filter(Boolean);
    if (words.length <= 20) {
      setRemark(e.target.value);
    } else {
      toast({
        variant: "destructive",
        title: employeeLang === 'hi' ? "शब्द सीमा समाप्त" : "Word Limit Exceeded",
        description: employeeLang === 'hi' ? "टिप्पणी 20 शब्दों से अधिक नहीं हो सकती।" : "Remark cannot exceed 20 words.",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const today = startOfToday();

    if (!purpose || !fromDate || !toDate) {
      toast({
        variant: "destructive",
        title: employeeLang === 'hi' ? "अपूर्ण फॉर्म" : "Incomplete Form",
        description: employeeLang === 'hi' ? "कृपया सभी आवश्यक फ़ील्ड भरें।" : "Please fill all required fields."
      });
      return;
    }

    const selectedFromDate = startOfDay(new Date(fromDate));
    const selectedToDate = startOfDay(new Date(toDate));

    if (isBefore(selectedFromDate, today)) {
      toast({
        variant: "destructive",
        title: employeeLang === 'hi' ? "अमान्य दिनांक" : "Invalid Date",
        description: employeeLang === 'hi' ? "पिछली तिथि के लिए अवकाश की अनुमति नहीं है। कृपया आज या भविष्य की तिथि चुनें।" : "Leave request for past dates is not allowed. Please choose today or a future date."
      });
      return;
    }

    if (isBefore(selectedToDate, selectedFromDate)) {
      toast({
        variant: "destructive",
        title: employeeLang === 'hi' ? "अमान्य दिनांक सीमा" : "Invalid Date Range",
        description: employeeLang === 'hi' ? "अंतिम दिनांक प्रारंभ दिनांक से पहले नहीं हो सकती।" : "To Date cannot be before From Date."
      });
      return;
    }

    const empId = verifiedUser?.employeeId || verifiedUser?.username || "N/A";
    const hasDuplicate = (leaveRequests || []).some((req: any) =>
      req.employeeId === empId &&
      String(req.status).toUpperCase() !== 'REJECTED' &&
      (new Date(fromDate) <= new Date(req.toDate) && new Date(toDate) >= new Date(req.fromDate))
    );

    if (hasDuplicate) {
      toast({
        variant: "destructive",
        title: employeeLang === 'hi' ? "डुप्लिकेट अनुरोध" : "Duplicate Request",
        description: employeeLang === 'hi' ? "इन तिथियों के लिए अवकाश अनुरोध पहले से मौजूद है।" : "A leave request for these dates already exists."
      });
      return;
    }

    try {
      await addRecord('leaveRequests', {
        employeeId: empId,
        firmId: verifiedUser?.firmId || "N/A",
        employeeName: verifiedUser?.fullName || "N/A",
        department: verifiedUser?.department || "Operations",
        designation: verifiedUser?.designation || "Staff",
        purpose,
        fromDate,
        toDate,
        days: totalDays,
        remark,
        status: 'UNDER_PROCESS',
        createdAt: new Date().toISOString()
      });
      await refreshData();
      toast({
        title: employeeLang === 'hi' ? "अवकाश अनुरोध जमा हुआ" : "Leave Request Submitted",
        description: employeeLang === 'hi' ? "आपका अनुरोध अनुमोदन के लिए भेज दिया गया है।" : "Your request has been sent for approval."
      });
      setOpen(false);
      setPurpose("");
      setFromDate("");
      setToDate("");
      setRemark("");
    } catch (error) {
      toast({
        variant: "destructive",
        title: employeeLang === 'hi' ? "जमा करने में विफल" : "Submission Failed",
        description: employeeLang === 'hi' ? "आपका अवकाश अनुरोध जमा नहीं हो सका।" : "Could not submit your leave request."
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider rounded-xl py-2 px-4 h-9 flex items-center justify-center gap-2 shadow-sm">
          <CalendarDays className="w-4 h-4" /> {activeT.applyForLeave}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-md font-black uppercase tracking-tight text-slate-900">{activeT.newLeaveRequest}</DialogTitle>
          <DialogDescription className="text-xs text-slate-400 uppercase font-semibold">{activeT.fillLeaveDetails}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="purpose" className="text-[10px] font-black uppercase text-slate-500 tracking-wider">{activeT.leavePurpose}</Label>
            <Input id="purpose" placeholder={employeeLang === 'hi' ? "उदा. बीमारी की छुट्टी, आकस्मिक अवकाश" : "e.g. Sick Leave, Casual Leave"} value={purpose} onChange={(e) => setPurpose(e.target.value)} className="h-10 border-slate-200 bg-slate-50 rounded-xl text-xs font-bold" required />

            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {recommendedLeaves.map((leaveType) => (
                <Badge
                  key={leaveType}
                  variant="secondary"
                  className={cn(
                    "cursor-pointer text-[10px] font-bold uppercase rounded-lg px-2 py-1 transition-all border border-slate-200/60 bg-white text-slate-600 hover:bg-slate-100",
                    purpose === leaveType && "bg-primary text-white border-primary hover:bg-primary/90"
                  )}
                  onClick={() => setPurpose(leaveType)}
                >
                  {leaveType}
                </Badge>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="fromDate" className="text-[10px] font-black uppercase text-slate-500 tracking-wider">{activeT.fromDate}</Label>
              <Input id="fromDate" type="date" min={todayStr} value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-10 border-slate-200 bg-slate-50 rounded-xl text-xs font-bold" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="toDate" className="text-[10px] font-black uppercase text-slate-500 tracking-wider">{activeT.toDate}</Label>
              <Input id="toDate" type="date" min={fromDate || todayStr} value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-10 border-slate-200 bg-slate-50 rounded-xl text-xs font-bold" required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">{activeT.totalLeaveDays}</Label>
            <Input value={totalDays > 0 ? `${totalDays} ${activeT.daysUnit}` : ""} placeholder={`0 ${activeT.daysUnit}`} disabled readOnly className="h-10 border-slate-200 bg-slate-100 rounded-xl text-xs font-black text-primary" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="remark" className="text-[10px] font-black uppercase text-slate-500 tracking-wider">{activeT.remarkOptional}</Label>
            <Textarea id="remark" placeholder={employeeLang === 'hi' ? "अतिरिक्त विवरण लिखें..." : "Provide any additional notes..."} value={remark} onChange={handleRemarkChange} className="min-h-[70px] border-slate-200 bg-slate-50 rounded-xl font-medium text-xs" />
          </div>
          <DialogFooter className="flex flex-row gap-3 pt-2">
            <Button variant="ghost" type="button" onClick={() => setOpen(false)} className="flex-1 rounded-xl font-bold h-11 uppercase text-xs">{activeT.cancel}</Button>
            <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90 font-black text-white rounded-xl h-11 uppercase text-xs">{activeT.submitRequest}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AttendancePage() {
  const {
    attendanceRecords = [],
    addRecord,
    updateRecord,
    refreshData,
    plants = [],
    verifiedUser,
    currentUser,
    isLoading,
    holidays = [],
    employees = [],
    leaveRequests = [],
  } = useData();

  // Determine if logged-in user is an Employee or Admin/Other User
  const isEmployeeLogin = useMemo(() => {
    if (!verifiedUser && !currentUser) return false;
    const roleStr = String(verifiedUser?.role || currentUser?.role || '').toUpperCase();
    if (roleStr === 'EMPLOYEE') return true;
    if (Array.isArray(verifiedUser?.role) && verifiedUser.role.map((r: any) => String(r).toUpperCase()).includes('EMPLOYEE')) return true;
    if (verifiedUser?.employeeId && !['SUPER_ADMIN', 'ADMIN', 'HR', 'USER'].includes(roleStr)) return true;
    return false;
  }, [verifiedUser, currentUser]);

  const employeeLang = (verifiedUser?.language || currentUser?.language || 'en').toLowerCase().trim();
  const t = useMemo(() => getTranslation(employeeLang), [employeeLang]);

  const [isMutatingAttendance, setIsMutatingAttendance] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState<string>("");

  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [activeDialog, setActiveDialog] = useState<"NONE" | "IN" | "OUT">("NONE");

  // Location Permission & Fast Verification State
  const [locationPermissionStatus, setLocationPermissionStatus] = useState<"checking" | "prompt" | "granted" | "denied" | "unavailable">("checking");
  const [locationPermissionMessage, setLocationPermissionMessage] = useState<string | null>(null);

  const [currentGPS, setCurrentGPS] = useState<{ lat: number, lng: number } | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [detectedPlant, setDetectedPlant] = useState<Plant | null>(null);
  const [nearestPlantInfo, setNearestPlantInfo] = useState<{ plant: Plant; distance: number } | null>(null);
  const [detectedAddress, setDetectedAddress] = useState("");
  const [detailedLocation, setDetailedLocation] = useState({ street: "", area: "", city: "", state: "", pincode: "" });
  const [selectedType, setSelectedType] = useState<"FIELD" | "WFH" | "">("");

  // Admin View State
  const [selectedAdminEmployeeId, setSelectedAdminEmployeeId] = useState<string>("");
  const [adminSearchTerm, setAdminSearchTerm] = useState<string>("");
  const [adminFromDate, setAdminFromDate] = useState<string>(() => {
    const now = getISTTime();
    return format(addDays(now, -45), "yyyy-MM-dd");
  });
  const [adminToDate, setAdminToDate] = useState<string>(() => {
    const now = getISTTime();
    return format(now, "yyyy-MM-dd");
  });

  const isAutoTriggering = useRef(false);
  const activeRecordRef = useRef<any>(null);
  const watchIdRef = useRef<number | null>(null);
  const { toast } = useToast();

  const clearActiveWatch = useCallback(() => {
    if (watchIdRef.current !== null && typeof window !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  // Location check on mount (only for employee view)
  const checkLocationOnMount = useCallback((isManualRetry = false) => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setLocationPermissionStatus("unavailable");
      setLocationPermissionMessage(t.locationPermissionRequired);
      return;
    }

    setLocationPermissionStatus("checking");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        setLocationPermissionStatus("granted");
        setLocationPermissionMessage(null);
        setCurrentGPS({ lat, lng });
        setGpsAccuracy(accuracy);

        const sortedAllPlants = (plants || [])
          .map((p) => ({ plant: p, distance: Math.round(getPreciseDistance(lat, lng, p.lat, p.lng)) }))
          .sort((a, b) => a.distance - b.distance);

        if (sortedAllPlants.length > 0) {
          setNearestPlantInfo(sortedAllPlants[0]);
          if (sortedAllPlants[0].distance <= (sortedAllPlants[0].plant.radius || 700)) {
            setDetectedPlant(sortedAllPlants[0].plant);
          } else {
            setDetectedPlant(null);
          }
        } else {
          setNearestPlantInfo(null);
          setDetectedPlant(null);
        }

        // Fast background reverse geocoding
        fetch('/api/geocode/reverse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat, lng })
        }).then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data?.address) {
              const addr = typeof data.address === 'object' ? (data.address.Match_addr || data.address.LongLabel || data.address.Address || "") : data.address;
              setDetectedAddress(addr);
            }
            if (data?.components) {
              setDetailedLocation({
                street: data.components.street || '',
                area: data.components.area || '',
                city: data.components.city || '',
                state: data.components.state || '',
                pincode: data.components.pincode || ''
              });
            }
          }).catch(() => { });
      },
      (err) => {
        setLocationPermissionStatus("denied");
        setLocationPermissionMessage(t.locationPermissionRequired);
      },
      { enableHighAccuracy: true, timeout: 3500, maximumAge: 15000 }
    );
  }, [plants, t]);

  useEffect(() => {
    if (isEmployeeLogin) {
      checkLocationOnMount();
    }
  }, [isEmployeeLogin, checkLocationOnMount]);

  useEffect(() => {
    return () => {
      clearActiveWatch();
    };
  }, [clearActiveWatch]);

  useEffect(() => {
    setIsMounted(true);
    setCurrentTime(getISTTime());
    const timer = setInterval(() => setCurrentTime(getISTTime()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Deep-link handler: open Mark IN or Mark OUT dialog from notification tap
  // The notification payload sets deepLink = '/dashboard/attendance?action=mark_in'
  const searchParams = useSearchParams();
  useEffect(() => {
    if (!isMounted || !isEmployeeLogin) return;
    const action = searchParams?.get("action");
    if (action === "mark_in") {
      // Small delay to allow location check to start first
      const t = setTimeout(() => setActiveDialog("IN"), 800);
      return () => clearTimeout(t);
    } else if (action === "mark_out") {
      const t = setTimeout(() => setActiveDialog("OUT"), 800);
      return () => clearTimeout(t);
    }
  }, [isMounted, isEmployeeLogin, searchParams]);

  // Initialize selected admin employee when employees load
  useEffect(() => {
    if (!isEmployeeLogin && employees.length > 0 && !selectedAdminEmployeeId) {
      const firstEmp = employees[0];
      setSelectedAdminEmployeeId(firstEmp.employeeId || firstEmp.id || (firstEmp as any)._id || "");
    }
  }, [isEmployeeLogin, employees, selectedAdminEmployeeId]);

  // Mark Attendance is strictly employee-specific for the currently logged-in user.
  const effectiveEmployeeId = useMemo(() => {
    if (!verifiedUser) return "N/A";
    return verifiedUser?.employeeId || verifiedUser?.username || "N/A";
  }, [verifiedUser]);

  const effectiveEmployeeName = useMemo(() => {
    if (!verifiedUser) return "N/A";
    return verifiedUser?.fullName || verifiedUser?.name || verifiedUser?.username || "N/A";
  }, [verifiedUser]);

  // Rolling 62-day date bounds based on current date
  const dateWindow62Days = useMemo(() => {
    const now = currentTime || getISTTime();
    const todayStr = format(now, "yyyy-MM-dd");
    const sixtyTwoDaysAgo = addDays(now, -62);
    const startDateStr = format(sixtyTwoDaysAgo, "yyyy-MM-dd");
    return { now, todayStr, sixtyTwoDaysAgo, startDateStr };
  }, [currentTime]);

  // Current Financial Year bounds (1-Apr to 31-Mar)
  const currentFYInfo = useMemo(() => {
    const now = currentTime || getISTTime();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const fyStartYear = currentMonth < 3 ? currentYear - 1 : currentYear;
    const fyEndYear = fyStartYear + 1;
    const startDateStr = `${fyStartYear}-04-01`;
    const endDateStr = `${fyEndYear}-03-31`;
    const label = `FY ${fyStartYear}-${fyEndYear}`;
    return { fyStartYear, fyEndYear, startDateStr, endDateStr, label };
  }, [currentTime]);

  // All identity synonyms for the currently logged-in user
  const myIdentitySet = useMemo(() => {
    const set = new Set<string>();
    const addClean = (val: any) => {
      if (!val) return;
      const str = String(val).trim().toUpperCase();
      if (str && str !== 'N/A' && str !== 'UNDEFINED' && str !== 'NULL') {
        set.add(str);
      }
    };

    addClean(effectiveEmployeeId);
    addClean(effectiveEmployeeName);
    addClean(verifiedUser?.employeeId);
    addClean(verifiedUser?.username);
    addClean(verifiedUser?.id);
    addClean((verifiedUser as any)?._id);
    addClean(verifiedUser?.name);
    addClean(verifiedUser?.fullName);
    addClean(verifiedUser?.mobile);
    addClean((verifiedUser as any)?.mobileNumber);
    addClean(verifiedUser?.aadhaar);
    addClean((verifiedUser as any)?.aadhaarNumber);

    (employees || []).forEach((e: any) => {
      const eId = String(e.employeeId || '').trim().toUpperCase();
      const id = String(e.id || e._id || '').trim().toUpperCase();
      const name = String(e.name || (e as any).fullName || '').trim().toUpperCase();
      const mobile = String(e.mobile || (e as any).mobileNumber || '').trim().toUpperCase();
      const aadhaar = String(e.aadhaar || (e as any).aadhaarNumber || '').trim().toUpperCase();
      const uName = String((e as any).username || '').trim().toUpperCase();

      const isMe =
        (eId && set.has(eId)) ||
        (id && set.has(id)) ||
        (name && set.has(name)) ||
        (mobile && set.has(mobile)) ||
        (aadhaar && set.has(aadhaar)) ||
        (uName && set.has(uName));

      if (isMe) {
        addClean(e.employeeId);
        addClean(e.id);
        addClean(e._id);
        addClean(e.name);
        addClean((e as any).fullName);
        addClean(e.mobile);
        addClean((e as any).mobileNumber);
        addClean(e.aadhaar);
        addClean((e as any).aadhaarNumber);
        addClean((e as any).username);
      }
    });

    return set;
  }, [effectiveEmployeeId, effectiveEmployeeName, verifiedUser, employees]);

  // 1. SESSION HISTORY: Current date back to previous 62 days, strictly for logged-in employee
  const employeeRecords = useMemo(() => {
    if (myIdentitySet.size === 0) return [];

    const { now, todayStr, startDateStr } = dateWindow62Days;

    const myRecords = (attendanceRecords || []).filter(r => {
      if (!r) return false;
      const recEmpId = String(r.employeeId || '').trim().toUpperCase();
      const recEmpName = String(r.employeeName || '').trim().toUpperCase();
      const isMatch = myIdentitySet.has(recEmpId) || (recEmpName && myIdentitySet.has(recEmpName));
      return isMatch && r.date && r.date >= startDateStr && r.date <= todayStr;
    });

    const recordsByDate = new Map<string, any[]>();
    myRecords.forEach(r => {
      if (!recordsByDate.has(r.date)) recordsByDate.set(r.date, []);
      recordsByDate.get(r.date)!.push(r);
    });

    const approvedLeaveDates = new Map<string, any>();
    (leaveRequests || []).forEach((l: any) => {
      const lEmpId = String(l.employeeId || (l as any).employeeID || "").trim().toUpperCase();
      const lEmpName = String(l.employeeName || "").trim().toUpperCase();
      const isMatch = myIdentitySet.has(lEmpId) || (lEmpName && myIdentitySet.has(lEmpName));
      if (isMatch && String(l.status).toUpperCase() === 'APPROVED') {
        if (l.fromDate && l.toDate) {
          try {
            let cur = startOfDay(parseISO(l.fromDate));
            const end = startOfDay(parseISO(l.toDate));
            while (!isAfter(cur, end)) {
              approvedLeaveDates.set(format(cur, "yyyy-MM-dd"), l);
              cur = addDays(cur, 1);
            }
          } catch (e) { }
        }
      }
    });

    const fullHistory: any[] = [];
    let currentD = now;

    while (format(currentD, "yyyy-MM-dd") >= startDateStr) {
      const dateStr = format(currentD, "yyyy-MM-dd");

      if (recordsByDate.has(dateStr)) {
        const dayRecords = recordsByDate.get(dateStr)!;
        dayRecords.sort((a, b) => (b.inTime || "").localeCompare(a.inTime || ""));
        fullHistory.push(...dayRecords);
      } else {
        const isSun = isSunday(currentD);
        const holidayObj = holidays.find((h: any) => h.date === dateStr);
        const leaveObj = approvedLeaveDates.get(dateStr);

        let displayStatus = isSun ? 'Weekly Off' : 'Absent';
        let attType = holidayObj ? holidayObj.name : 'N/A';
        let inPlant = holidayObj ? holidayObj.name : (isSun ? 'Weekly Off' : 'N/A');
        let remark = holidayObj ? holidayObj.name : (isSun ? 'Weekly Off' : 'Absent');

        if (holidayObj) {
          displayStatus = 'Holiday';
        } else if (leaveObj) {
          displayStatus = 'Leave';
          attType = leaveObj.purpose || 'Approved Leave';
          inPlant = 'On Leave';
          remark = `Approved Leave (${leaveObj.purpose || 'Leave'})`;
        }

        fullHistory.push({
          id: `missing-${dateStr}`,
          employeeName: effectiveEmployeeName,
          date: dateStr,
          inTime: null,
          outTime: null,
          hours: 0,
          status: displayStatus,
          attendanceType: attType,
          address: null,
          addressOut: null,
          inPlant: inPlant,
          remark: remark
        });
      }
      currentD = addDays(currentD, -1);
    }

    return fullHistory;
  }, [attendanceRecords, myIdentitySet, holidays, leaveRequests, effectiveEmployeeName, dateWindow62Days]);

  // 2. MONTHLY SUMMARY: Derived directly from Page Approvals → Active Tab → Attendance data source
  // Filtered strictly for the currently authenticated logged-in employee.
  const monthlySummaries = useMemo(() => {
    const now = currentTime || getISTTime();
    if (myIdentitySet.size === 0) return [];

    // Find the logged-in employee record for joining/inactive date checking (same as Approvals)
    const currentEmp = (employees || []).find((e: any) => {
      const eId = String(e.employeeId || e.id || (e as any)._id || "").trim().toUpperCase();
      const eName = String(e.name || (e as any).fullName || "").trim().toUpperCase();
      return myIdentitySet.has(eId) || (eName && myIdentitySet.has(eName));
    });

    // Approved leaves from leaveRequests matching logged-in employee
    const approvedLeavesMap = new Map<string, any>();
    (leaveRequests || []).forEach((l: any) => {
      const lEmpId = String(l.employeeId || (l as any).employeeID || "").trim().toUpperCase();
      const lEmpName = String(l.employeeName || "").trim().toUpperCase();
      const isMatch = myIdentitySet.has(lEmpId) || (lEmpName && myIdentitySet.has(lEmpName));
      if (isMatch && String(l.status).toUpperCase() === 'APPROVED') {
        if (l.fromDate && l.toDate) {
          try {
            const start = startOfDay(parseISO(l.fromDate));
            const end = startOfDay(parseISO(l.toDate));
            if (isValid(start) && isValid(end)) {
              let cur = start;
              while (!isAfter(cur, end)) {
                approvedLeavesMap.set(format(cur, "yyyy-MM-dd"), l);
                cur = addDays(cur, 1);
              }
            }
          } catch (e) { }
        }
      }
    });

    // Active attendance punches for logged-in employee from attendance collection (Approvals Active source)
    const myPunches = (attendanceRecords || []).filter((r: any) => {
      if (!r) return false;
      const recEmpId = String(r.employeeId || '').trim().toUpperCase();
      const recEmpName = String(r.employeeName || '').trim().toUpperCase();
      return myIdentitySet.has(recEmpId) || (recEmpName && myIdentitySet.has(recEmpName));
    });

    const punchesByDate = new Map<string, any>();
    myPunches.forEach((r: any) => {
      if (r.date) punchesByDate.set(r.date, r);
    });

    // Status calculation identical to Page Approvals Active Tab
    const getApprovalsCalculatedStatus = (dateStr: string, record: any) => {
      const isSun = isSunday(parseISO(dateStr));
      const customHoliday = (holidays || []).find((h: any) => h.date === dateStr && !h.auto);
      const approvedLeave = approvedLeavesMap.get(dateStr);

      if (record && record.inTime) {
        if (isSun) return "Present on Weekly Off";
        if (customHoliday) return "Present on Holiday";
        return "Present";
      }

      if (approvedLeave) return "Absent on Leave";
      if (isSun) return "Weekly Off";
      if (customHoliday) return "Holiday";

      return "Absent";
    };

    const result = [];
    for (let i = 0; i < 3; i++) {
      const mDate = subMonths(now, i);
      const mKey = format(mDate, "yyyy-MM");
      const monthYearLabel = format(mDate, "MMM-yyyy");
      const start = startOfMonth(mDate);
      const end = isSameMonth(mDate, now) ? now : endOfMonth(mDate);

      let totalPresent = 0;
      let totalAbsent = 0;
      let totalMinutes = 0;

      let cur = startOfDay(start);
      const endDay = startOfDay(end);

      while (!isAfter(cur, endDay)) {
        const dStr = format(cur, "yyyy-MM-dd");

        // Respect employee join date and inactive date if defined
        if (currentEmp && !isEmployeeActiveOnDate(currentEmp, dStr)) {
          cur = addDays(cur, 1);
          continue;
        }

        const punchRec = punchesByDate.get(dStr);
        const status = getApprovalsCalculatedStatus(dStr, punchRec);

        if (status === "Present" || status === "Present on Weekly Off" || status === "Present on Holiday") {
          totalPresent++;
          if (punchRec) {
            let hours = typeof punchRec.hours === "number" ? punchRec.hours : 0;
            // Auto checkout rule if unclosed shift and >16h
            if (!punchRec.outTime && punchRec.inTime) {
              const inDT = (punchRec.inDate && punchRec.inTime)
                ? parseDateTime(punchRec.inDate, punchRec.inTime)
                : (punchRec.date && punchRec.inTime)
                ? parseDateTime(punchRec.date, punchRec.inTime)
                : (punchRec.inDateTime ? parseISO(punchRec.inDateTime) : null);
              if (inDT && isValid(inDT)) {
                const diffHours = (now.getTime() - inDT.getTime()) / (1000 * 60 * 60);
                if (diffHours >= 16) hours = 16.0;
              }
            }
            totalMinutes += Math.round(hours * 60);
          }
        } else if (status === "Absent") {
          totalAbsent++;
        }

        cur = addDays(cur, 1);
      }

      const totalHoursFloat = totalMinutes / 60;

      result.push({
        monthKey: mKey,
        monthYear: monthYearLabel,
        present: totalPresent,
        absent: totalAbsent,
        workedHours: formatHoursToHHMM(totalHoursFloat),
        isCurrentMonth: i === 0,
      });
    }

    return result;
  }, [attendanceRecords, myIdentitySet, employees, holidays, leaveRequests, currentTime]);

  // 3. LEAVE HISTORY: Current Financial Year (FY) only, Approved records only, grouped month-wise
  const fyMonthWiseLeaves = useMemo(() => {
    if (myIdentitySet.size === 0) return [];

    const { startDateStr, endDateStr } = currentFYInfo;
    const fyStart = startOfDay(parseISO(startDateStr));
    const fyEnd = startOfDay(parseISO(endDateStr));

    const approvedLeaves = (leaveRequests || []).filter((l: any) => {
      const lEmpId = String(l.employeeId || (l as any).employeeID || "").trim().toUpperCase();
      const lEmpName = String(l.employeeName || "").trim().toUpperCase();
      const isMatch = myIdentitySet.has(lEmpId) || (lEmpName && myIdentitySet.has(lEmpName));
      if (!isMatch) return false;
      if (String(l.status).toUpperCase() !== 'APPROVED') return false;
      if (!l.fromDate || !l.toDate) return false;

      try {
        const fromD = startOfDay(parseISO(l.fromDate));
        const toD = startOfDay(parseISO(l.toDate));
        return !isAfter(fromD, fyEnd) && !isBefore(toD, fyStart);
      } catch (e) {
        return false;
      }
    });

    const monthGroups = new Map<string, {
      monthKey: string;
      monthLabel: string;
      totalLeaveDays: number;
      records: any[];
    }>();

    approvedLeaves.forEach((leave: any) => {
      try {
        const fromD = startOfDay(parseISO(leave.fromDate));
        const toD = startOfDay(parseISO(leave.toDate));
        const actualStart = isBefore(fromD, fyStart) ? fyStart : fromD;
        const actualEnd = isAfter(toD, fyEnd) ? fyEnd : toD;

        const monthDaysMap = new Map<string, number>();
        let cur = actualStart;
        while (!isAfter(cur, actualEnd)) {
          const mKey = format(cur, "yyyy-MM");
          const dayIncrement = leave.leaveType === 'HALF_DAY' ? 0.5 : 1;
          monthDaysMap.set(mKey, (monthDaysMap.get(mKey) || 0) + dayIncrement);
          cur = addDays(cur, 1);
        }

        monthDaysMap.forEach((daysInMonth, mKey) => {
          if (!monthGroups.has(mKey)) {
            const mDate = parseISO(`${mKey}-01`);
            monthGroups.set(mKey, {
              monthKey: mKey,
              monthLabel: format(mDate, "MMM-yyyy"),
              totalLeaveDays: 0,
              records: [],
            });
          }
          const group = monthGroups.get(mKey)!;
          group.totalLeaveDays += daysInMonth;
          group.records.push({
            ...leave,
            daysInThisMonth: daysInMonth,
          });
        });
      } catch (e) { }
    });

    return Array.from(monthGroups.values())
      .filter((g) => g.totalLeaveDays > 0)
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }, [myIdentitySet, leaveRequests, currentFYInfo]);

  const { activeRecord, todayRecord, todaySessions, hasUsedMaxSessions, currentSessionIndex, isStale, nextInAvailableAt, canMarkOut, nextOutAvailableAt } = useMemo(() => {
    const now = currentTime || getISTTime();
    const todayStr = format(now, "yyyy-MM-dd");

    const active = employeeRecords.find((r) => r.status === "Open" || (r.inTime && !r.outTime && r.status !== "Closed" && r.status !== "Auto OUT"));
    const todayRecs = employeeRecords.filter((r) => r.date === todayStr && !r.id?.startsWith('missing-')).sort((a, b) => (a.sessionIndex || 1) - (b.sessionIndex || 1));
    const todayRec = todayRecs[todayRecs.length - 1] || null;
    const maxSessionsUsed = todayRecs.length >= 2 && !active;
    const sessIdx = active?.sessionIndex || (todayRecs.length + 1);

    const lastClosed = employeeRecords
      .filter((r) => r.status === "Closed" || r.status === "Auto OUT")
      .sort((a, b) => {
        const adt = a.outDateTime ? parseISO(a.outDateTime) : (a.outDate && a.outTime ? parseDateTime(a.outDate, a.outTime) : null);
        const bdt = b.outDateTime ? parseISO(b.outDateTime) : (b.outDate && b.outTime ? parseDateTime(b.outDate, b.outTime) : null);
        const at = adt && isValid(adt) ? adt.getTime() : 0;
        const bt = bdt && isValid(bdt) ? bdt.getTime() : 0;
        return bt - at;
      })[0];

    const nextIn = lastClosed?.nextInEnableTime ? parseISO(lastClosed.nextInEnableTime) : null;

    const inDT = (active?.inDate && active?.inTime)
      ? parseDateTime(active.inDate, active.inTime)
      : (active?.date && active?.inTime)
      ? parseDateTime(active.date, active.inTime)
      : (active?.inDateTime ? parseISO(active.inDateTime) : null);

    let canOut = false;
    let nextOutAt: Date | null = null;

    if (active && inDT && isValid(inDT)) {
      canOut = !isAfter(inDT, now);
      nextOutAt = inDT;
    }

    let stale = false;
    if (active && inDT && isValid(inDT)) {
      const staleThresholdHours = (active.sessionIndex === 2) ? 8 : 16;
      const triggerTime = addHours(inDT, staleThresholdHours);
      if (isAfter(now, triggerTime)) stale = true;
    }

    return {
      activeRecord: active || null,
      todayRecord: todayRec || null,
      todaySessions: todayRecs,
      hasUsedMaxSessions: maxSessionsUsed,
      currentSessionIndex: sessIdx,
      isStale: stale,
      nextInAvailableAt: nextIn && isValid(nextIn) ? nextIn : null,
      canMarkOut: !!(active && canOut),
      nextOutAvailableAt: nextOutAt && isValid(nextOutAt) ? nextOutAt : null,
    };
  }, [employeeRecords, currentTime]);

  useEffect(() => {
    activeRecordRef.current = activeRecord;
  }, [activeRecord]);

  const isCooldownLocked = useMemo(() => {
    if (!nextInAvailableAt || !currentTime) return false;
    return isAfter(nextInAvailableAt, currentTime);
  }, [nextInAvailableAt, currentTime]);

  // Live countdown for the Mark IN cool-off period
  useEffect(() => {
    if (!isCooldownLocked || !nextInAvailableAt) {
      setCooldownRemaining("");
      return;
    }
    const tick = () => {
      const now = currentTime || getISTTime();
      if (!isAfter(nextInAvailableAt, now)) {
        setCooldownRemaining("");
        return;
      }
      const diffMs = nextInAvailableAt.getTime() - now.getTime();
      const totalSec = Math.max(0, Math.floor(diffMs / 1000));
      const hh = String(Math.floor(totalSec / 3600)).padStart(2, "0");
      const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
      const ss = String(totalSec % 60).padStart(2, "0");
      setCooldownRemaining(`${hh}:${mm}:${ss}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isCooldownLocked, nextInAvailableAt, currentTime]);

  // Auto-OUT effect
  useEffect(() => {
    if (isEmployeeLogin && isStale && activeRecord && !isMutatingAttendance && !isAutoTriggering.current) {
      requestLocation("OUT_AUTO");
    }
  }, [isEmployeeLogin, isStale, activeRecord]);

  // Geofence boundary tracker (only for active employee shift)
  useEffect(() => {
    if (!isEmployeeLogin || !activeRecord || activeRecord.status !== "Open" || !navigator.geolocation) return;

    const empRecord = (employees || []).find((e: any) => e.employeeId === effectiveEmployeeId);
    const empDesignation = empRecord?.designation || verifiedUser?.designation || "Staff";

    const trackGeofenceBoundary = async () => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const latestRecord = activeRecordRef.current;
          if (!latestRecord || latestRecord.status !== "Open") return;

          const { latitude: lat, longitude: lng } = position.coords;
          const timeNowStr = format(getISTTime(), "yyyy-MM-dd HH:mm");

          let currentEvents = latestRecord.exitEvents ? [...latestRecord.exitEvents] : [];
          let currentActiveEvent = currentEvents.find((e: any) => !e.inPlantTime && e.trackingStatus === "Outside Plant");

          const plantDistances = (plants || []).map(p => ({
            plant: p,
            distanceM: getPreciseDistance(lat, lng, p.lat, p.lng)
          }));

          const nearest = plantDistances.sort((a, b) => a.distanceM - b.distanceM)[0];
          const allowedRadiusM = 700;
          const isOutsideAllPlants = !nearest || nearest.distanceM > allowedRadiusM;

          if (isOutsideAllPlants) {
            let geocodedAddress = "Location Unavailable";
            try {
              const res = await fetch('/api/geocode/reverse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lat, lng })
              });
              if (res.ok) {
                const data = await res.json();
                geocodedAddress = data?.address?.Match_addr || data?.address || "Salt Plant Outside Zone";
              }
            } catch (e) {
              console.error("Geofence reverse geocoding failed", e);
            }

            const newLocationHistoryPoint = {
              time: timeNowStr,
              address: geocodedAddress,
              lat,
              lng,
              distance: nearest ? parseFloat(nearest.distanceM.toFixed(1)) : 0
            };

            let shouldUpdate = false;
            if (!currentActiveEvent) {
              currentActiveEvent = {
                employeeCode: effectiveEmployeeId,
                employeeName: effectiveEmployeeName,
                designation: empDesignation,
                plant: latestRecord.inPlant || "Salt Plant",
                date: latestRecord.date,
                outPlantTime: timeNowStr,
                gpsLatitude: lat,
                gpsLongitude: lng,
                completeAddress: geocodedAddress,
                distanceFromPlant: nearest ? Math.round(nearest.distanceM) : null,
                outLocationHistory: [newLocationHistoryPoint],
                inPlantTime: null,
                totalOutDuration: null,
                currentPlant: null,
                trackingStatus: "Outside Plant"
              };
              currentEvents.push(currentActiveEvent);
              shouldUpdate = true;
            } else {
              const history = currentActiveEvent.outLocationHistory || [];
              const lastPoint = history[history.length - 1];
              currentActiveEvent.gpsLatitude = lat;
              currentActiveEvent.gpsLongitude = lng;
              if (geocodedAddress !== "Location Unavailable") currentActiveEvent.completeAddress = geocodedAddress;
              if (nearest) currentActiveEvent.distanceFromPlant = Math.round(nearest.distanceM);
              if (!lastPoint || lastPoint.address !== geocodedAddress || lastPoint.lat !== lat) {
                history.push(newLocationHistoryPoint);
                currentActiveEvent.outLocationHistory = history;
                shouldUpdate = true;
              }
            }

            // Immediately save to MongoDB plantExits collection via API
            fetch('/api/exit-tracking', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                employeeCode: effectiveEmployeeId,
                employeeName: effectiveEmployeeName,
                designation: empDesignation,
                plant: latestRecord.inPlant || "Salt Plant",
                date: latestRecord.date,
                attendanceId: latestRecord.id || latestRecord._id,
                sessionIndex: latestRecord.sessionIndex || 1,
                gpsLatitude: lat,
                gpsLongitude: lng,
                completeAddress: geocodedAddress,
                distanceFromPlant: nearest ? Math.round(nearest.distanceM) : null,
                action: 'OUT'
              })
            }).catch((err) => console.warn("Facility exit tracking POST failed", err));

            if (shouldUpdate) {
              await updateRecord('attendance', latestRecord.id || latestRecord._id, {
                exitEvents: currentEvents,
                currentGeofenceStatus: "Outside Plant"
              });
              await refreshData();
            }
          } else {
            if (currentActiveEvent) {
              const exitTimeParsed = parseISO(currentActiveEvent.outPlantTime.replace(" ", "T"));
              const duration = differenceInMinutes(getISTTime(), exitTimeParsed);
              const hh = String(Math.floor(Math.max(0, duration) / 60)).padStart(2, '0');
              const mm = String(Math.max(0, duration) % 60).padStart(2, '0');

              const qualifyingPlants = (plants || [])
                .map(p => ({ plant: p, distanceM: getPreciseDistance(lat, lng, p.lat, p.lng) }))
                .filter(x => x.distanceM <= (x.plant.radius || 700))
                .sort((a, b) => a.distanceM - b.distanceM);

              const returnPlant = qualifyingPlants[0]?.plant;

              currentActiveEvent.inPlantTime = timeNowStr;
              currentActiveEvent.totalOutDuration = `${hh}:${mm}`;
              currentActiveEvent.currentPlant = returnPlant?.name || latestRecord.inPlant || "Salt Plant";
              currentActiveEvent.trackingStatus = "Returned";

              // Immediately update MongoDB plantExits via API
              fetch('/api/exit-tracking', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  employeeCode: effectiveEmployeeId,
                  attendanceId: latestRecord.id || latestRecord._id,
                  plant: returnPlant?.name || latestRecord.inPlant || "Salt Plant",
                  gpsLatitude: lat,
                  gpsLongitude: lng,
                  action: 'RETURN'
                })
              }).catch((err) => console.warn("Facility return tracking POST failed", err));

              await updateRecord('attendance', latestRecord.id || latestRecord._id, {
                exitEvents: currentEvents,
                currentGeofenceStatus: "Inside Plant"
              });

              toast({
                title: "Returned to Plant",
                description: `Welcome back inside the geofence perimeter.`
              });
              await refreshData();
            }
          }
        },
        async (error) => {
          console.error("Geofence verification lookup failed", error);
          const latestRecord = activeRecordRef.current;
          if (!latestRecord || latestRecord.status !== "Open") return;

          let currentEvents = latestRecord.exitEvents ? [...latestRecord.exitEvents] : [];
          let currentActiveEvent = currentEvents.find((e: any) => !e.inPlantTime && e.trackingStatus === "Outside Plant");
          if (currentActiveEvent) {
            currentActiveEvent.completeAddress = "Location Not Available";
            currentActiveEvent.trackingStatus = "Location Not Available";
            await updateRecord('attendance', latestRecord.id || latestRecord._id, {
              exitEvents: currentEvents,
              currentGeofenceStatus: "Location Not Available"
            });
            await refreshData();
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    };

    const geofenceWorkerId = setInterval(trackGeofenceBoundary, 15 * 60 * 1000);
    trackGeofenceBoundary();
    return () => clearInterval(geofenceWorkerId);
  }, [isEmployeeLogin, activeRecord?.id, activeRecord?.status, plants, employees, effectiveEmployeeId, effectiveEmployeeName, verifiedUser]);

  const punchCheckIn = async (finalInPlant: string, attendanceType: string, plantName: string, geofenceStatus: string) => {
    if (isMutatingAttendance) return;
    setIsMutatingAttendance(true);

    const now = getISTTime();
    const today = format(now, "yyyy-MM-dd");
    const timeStr = format(now, "HH:mm");

    const nextSessionIndex = todaySessions.length + 1;

    const newRecordData = {
      employeeId: effectiveEmployeeId,
      employeeName: effectiveEmployeeName,
      aadhaarNumber: "[Aadhaar Redacted]",
      mobileNumber: verifiedUser?.mobileNumber || "N/A",
      sessionIndex: nextSessionIndex,
      sessionNumber: nextSessionIndex,
      date: today,
      inDate: today,
      inTime: timeStr,
      inDateTime: now.toISOString(),
      hours: 0,
      status: 'Open',
      attendanceType: attendanceType,
      lat: currentGPS?.lat || 28.6329,
      lng: currentGPS?.lng || 77.4357,
      address: detectedAddress || (detectedPlant ? detectedPlant.name : "Registered Zone"),
      street: detectedPlant ? (detectedPlant.name || "Plant") : (detailedLocation.street || "Industrial Bypass"),
      area: detectedPlant ? "Plant Radius Zone" : (detailedLocation.area || "Industrial Zone"),
      city: detailedLocation.city || "NCR",
      state: detailedLocation.state || "Uttar Pradesh",
      pincode: detailedLocation.pincode || "N/A",
      inPlant: finalInPlant,
      remark: `Checked IN (Session ${nextSessionIndex}) for ${attendanceType}`,
      approved: false,
      unapprovedOutDuration: 0,
      currentGeofenceStatus: geofenceStatus,
      exitEvents: []
    };

    try {
      const response = await fetch('/api/attendance/mark-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newRecordData,
          userRole: 'EMPLOYEE',
          selectedType,
          plantName,
        })
      });

      if (response.ok) {
        // MongoDB confirmed the save — update UI from fresh server data
        setSelectedType("");
        setActiveDialog("NONE");
        toast({ title: `Mark IN Successful (Session ${nextSessionIndex} of 2)`, description: detectedPlant ? `Welcome back to ${plantName}` : `Logged as ${attendanceType}` });
        await refreshData();

        const notifMsg = `${effectiveEmployeeName} – Mark IN Recorded (Session ${nextSessionIndex}) | Time: ${timeStr} | ${detectedPlant ? plantName : attendanceType}`;
        postNativeNotification(
          "Mark IN Successful",
          notifMsg,
          "MARK_IN",
          effectiveEmployeeId,
          "EMPLOYEE"
        );
        fetch('/api/notifications/send-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: "Mark IN Successful",
            message: notifMsg,
            type: 'MARK_IN',
            employeeId: effectiveEmployeeId,
            targetRole: 'EMPLOYEE'
          })
        }).catch((err) => console.warn("Push notification deferred:", err));
      } else {
        // Always treat non-OK as a hard failure — never fall through to a local-only record.
        // MongoDB has not confirmed the save, so we must not show a success state.
        const errData = await response.json().catch(() => ({}));
        toast({
          variant: "destructive",
          title: "Mark IN Failed",
          description: errData?.message || "Server rejected the request. Please try again.",
        });
        return;
      }
    } catch (e) {
      console.error("Check-in error:", e);
      toast({ variant: "destructive", title: "Error", description: "Failed to process database entry register log." });
    } finally {
      setIsMutatingAttendance(false);
    }
  };

  const handleMarkInClick = (e?: React.MouseEvent | React.FormEvent) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (hasUsedMaxSessions) {
      toast({
        variant: "destructive",
        title: "Daily Attendance Limit Reached",
        description: "You have already used the maximum 2 attendance sessions allowed for today.",
      });
      return;
    }
    if (isCooldownLocked || isLoadingLocation || isMutatingAttendance || !!activeRecord) return;

    clearActiveWatch();
    requestLocation("IN");
  };

  const punchCheckOut = async () => {
    if (!activeRecord || isMutatingAttendance) return;

    if (!activeRecord.inTime) {
      toast({
        variant: "destructive",
        title: "Mark IN Required",
        description: "Cannot Mark OUT because no valid Mark IN record exists for today.",
      });
      return;
    }

    const now = getISTTime();
    const inDT = (activeRecord.inDate && activeRecord.inTime)
      ? parseDateTime(activeRecord.inDate, activeRecord.inTime)
      : (activeRecord.date && activeRecord.inTime)
      ? parseDateTime(activeRecord.date, activeRecord.inTime)
      : (activeRecord.inDateTime ? parseISO(activeRecord.inDateTime) : null);
    const outDT = parseDateTime(format(now, "yyyy-MM-dd"), format(now, "HH:mm")) || now;

    if (!inDT || !isValid(inDT)) {
      toast({
        variant: "destructive",
        title: "Invalid Mark IN",
        description: "Stored Mark IN date/time is invalid. Please Mark IN again.",
      });
      return;
    }

    const sessionIdx = activeRecord.sessionIndex || 1;
    const maxSessionHours = sessionIdx === 2 ? 8 : 16;

    let finalHours = 0;
    if (isValid(inDT) && isValid(outDT)) {
      const diffHours = (outDT.getTime() - inDT.getTime()) / (1000 * 60 * 60);
      finalHours = Math.min(maxSessionHours, Math.max(0, diffHours));
      finalHours = parseFloat(finalHours.toFixed(2));
    }

    const nextEnableDT = addHours(outDT, 1);
    const recordId = activeRecord.id || (activeRecord as any)._id;

    if (!recordId) {
      toast({ variant: "destructive", title: "Error", description: "Record ID not found." });
      return;
    }

    setIsMutatingAttendance(true);

    try {
      let finalExitEvents = activeRecord.exitEvents ? [...activeRecord.exitEvents] : [];
      let incompleteEvent = finalExitEvents.find((e: any) => !e.inPlantTime && e.trackingStatus === "Outside Plant");
      if (incompleteEvent) {
        const timeNowStr = format(now, "yyyy-MM-dd HH:mm");
        const exitTimeParsed = parseISO(incompleteEvent.outPlantTime.replace(" ", "T"));
        const duration = differenceInMinutes(now, exitTimeParsed);
        const hh = String(Math.floor(Math.max(0, duration) / 60)).padStart(2, '0');
        const mm = String(Math.max(0, duration) % 60).padStart(2, '0');
        incompleteEvent.inPlantTime = timeNowStr;
        incompleteEvent.totalOutDuration = `${hh}:${mm}`;
        incompleteEvent.currentPlant = incompleteEvent.plant || activeRecord.inPlant || "Salt Plant";
        incompleteEvent.trackingStatus = "Returned";
      }

      const outPayload = {
        id: recordId,
        recordId: recordId,
        employeeId: effectiveEmployeeId,
        userRole: 'EMPLOYEE',
        outTime: format(outDT, "HH:mm"),
        outDate: format(outDT, "yyyy-MM-dd"),
        outDateTime: outDT.toISOString(),
        hours: finalHours,
        status: 'Closed',
        outType: 'Manual',
        latOut: currentGPS?.lat || activeRecord.lat || 28.6329,
        lngOut: currentGPS?.lng || activeRecord.lng || 77.4357,
        addressOut: detectedAddress || activeRecord.address || (detectedPlant as any)?.address || "Registered Zone",
        streetOut: detectedPlant ? (detectedPlant.name || "Plant") : (detailedLocation.street || activeRecord.street || "Unknown Street"),
        areaOut: detectedPlant ? "Plant Radius Zone" : (detailedLocation.area || activeRecord.area || "Unknown Area"),
        cityOut: detailedLocation.city || activeRecord.city || "NCR",
        stateOut: detectedPlant ? "Uttar Pradesh" : (detailedLocation.state || activeRecord.state || "NCR"),
        pincodeOut: detailedLocation.pincode || activeRecord.pincode || "N/A",
        outPlant: detectedPlant ? detectedPlant.name : (activeRecord.inPlant || "Outside"),
        nextInEnableTime: nextEnableDT.toISOString(),
        exitEvents: finalExitEvents,
        currentGeofenceStatus: "Shift Closed"
      };

      const response = await fetch('/api/attendance/mark-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(outPayload)
      });

      if (response.ok) {
        // MongoDB confirmed the save — update UI from fresh server data
        setActiveDialog("NONE");
        toast({ title: `Mark OUT Successful (Session ${sessionIdx})`, description: `Shift completed. Hours: ${formatHoursToHHMM(finalHours)}` });
        await refreshData();

        const notifMsg = `${effectiveEmployeeName} – Mark OUT Recorded (Session ${sessionIdx}) | Time: ${format(outDT, "HH:mm")} | Worked: ${formatHoursToHHMM(finalHours)}`;
        postNativeNotification(
          "Mark OUT Successful",
          notifMsg,
          "MARK_OUT",
          effectiveEmployeeId,
          "EMPLOYEE"
        );
        fetch('/api/notifications/send-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: "Mark OUT Successful",
            message: notifMsg,
            type: 'MARK_OUT',
            employeeId: effectiveEmployeeId,
            targetRole: 'EMPLOYEE'
          })
        }).catch((err) => console.warn("Push notification deferred:", err));
      } else {
        // Always treat non-OK as a hard failure — never fall through to a local-only update.
        // MongoDB has not confirmed the save, so we must not show a success state.
        const errData = await response.json().catch(() => ({}));
        toast({
          variant: "destructive",
          title: "Mark OUT Failed",
          description: errData?.message || "Server rejected the request. Please try again.",
        });
        return;
      }

    } catch (e) {
      console.error("Check-out error:", e);
      toast({ variant: "destructive", title: "Error", description: "Failed to Mark OUT" });
    } finally {
      setIsMutatingAttendance(false);
    }
  };

  const handleMarkOutClick = (e?: React.MouseEvent | React.FormEvent) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (!activeRecord || !canMarkOut || isLoadingLocation || isMutatingAttendance) return;

    clearActiveWatch();
    requestLocation("OUT");
  };

  const performAutoCheckOut = async (lat: number, lng: number, address: string, components: any, plant: Plant | null) => {
    if (!activeRecord || isMutatingAttendance) return;

    let inDT: Date | null = null;
    if (activeRecord.inDate && activeRecord.inTime) {
      inDT = parseDateTime(activeRecord.inDate, activeRecord.inTime);
    } else if (activeRecord.date && activeRecord.inTime) {
      inDT = parseDateTime(activeRecord.date, activeRecord.inTime);
    } else if (activeRecord.inDateTime) {
      inDT = parseISO(activeRecord.inDateTime);
    }
    if (!inDT || !isValid(inDT)) return;

    const sessionIdx = activeRecord.sessionIndex || 1;
    const thresholdHours = sessionIdx === 2 ? 8 : 16;
    const creditedHours = sessionIdx === 2 ? 4.0 : 8.0;

    setIsMutatingAttendance(true);
    try {
      // Route through the dedicated auto-mark-out API.
      // This ensures: business rules are enforced, MongoDB is written atomically,
      // and realtimeBroadcaster fires AFTER the confirmed save.
      const res = await fetch('/api/attendance/auto-mark-out', { method: 'POST' });

      if (!res.ok) {
        // Graceful degradation: if the dedicated API is unavailable, fall back to
        // a direct generic update so the employee isn't left with a stuck shift.
        const creditOutDT = addHours(inDT, creditedHours);
        await updateRecord('attendance', activeRecord.id || (activeRecord as any)._id, {
          outTime: format(creditOutDT, "HH:mm"),
          outDate: format(creditOutDT, "yyyy-MM-dd"),
          outDateTime: creditOutDT.toISOString(),
          hours: creditedHours,
          status: 'Auto OUT',
          outType: 'Auto',
          autoCheckout: true,
          autoOut: true,
          autoTriggerTime: getISTTime().toISOString(),
          nextInEnableTime: addHours(getISTTime(), 1).toISOString(),
          remark: `System Auto-Logged OUT (${thresholdHours}h Limit reached for Session ${sessionIdx}); Credited ${creditedHours}h fixed working time.`
        });
      }

      toast({
        title: "Auto OUT Triggered",
        description: `Session ${sessionIdx} auto-closed at ${thresholdHours}h limit (${creditedHours}h credited).`
      });

      await refreshData();
    } catch (e) {
      console.error("Auto checkout error:", e);
    } finally {
      setIsMutatingAttendance(false);
      isAutoTriggering.current = false;
    }
  };

  const requestLocation = (type: "IN" | "OUT" | "OUT_AUTO") => {
    if (type === "IN" && isCooldownLocked) {
      toast({
        variant: "destructive",
        title: "Next Mark IN Locked",
        description: `Cool-off period active. Access opens at ${nextInAvailableAt ? format(nextInAvailableAt, "dd-MMM HH:mm") : "later"}.`,
        duration: 8000,
      });
      return;
    }

    if (isMutatingAttendance) return;

    clearActiveWatch();
    setIsLoadingLocation(true);
    setDetectedPlant(null);
    setDetectedAddress("");

    if (type === "OUT_AUTO") {
      isAutoTriggering.current = true;
    }

    const processGeocoding = async (lat: number, lng: number, accuracy: number) => {
      try {
        setGpsAccuracy(accuracy);
        setLocationPermissionStatus("granted");
        setLocationPermissionMessage(null);

        if (accuracy > 100) {
          toast({
            variant: "default",
            title: "GPS Accuracy Notice",
            description: `Current GPS accuracy is ±${accuracy.toFixed(1)}m. Proceeding with best available signal.`,
          });
        }

        const response = await fetch('/api/geocode/reverse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat, lng })
        });

        const data = await response.json();
        let components = { street: "", area: "", city: "", state: "", pincode: "" };

        if (response.ok) {
          let geocodedAddress = "";
          if (data?.address) {
            if (typeof data.address === 'object') {
              geocodedAddress = data.address.Match_addr || data.address.LongLabel || data.address.Address || "";
            } else if (typeof data.address === 'string') {
              geocodedAddress = data.address;
            }
          }

          const raw = data?.components;
          components = {
            street: typeof raw?.street === 'string' ? raw.street : '',
            area: typeof raw?.area === 'string' ? raw.area : '',
            city: typeof raw?.city === 'string' ? raw.city : '',
            state: typeof raw?.state === 'string' ? raw.state : '',
            pincode: typeof raw?.pincode === 'string' ? raw.pincode : '',
          };

          setDetectedAddress(geocodedAddress);
          setDetailedLocation(components);
          setCurrentGPS({ lat, lng });

          const sortedAllPlants = (plants || [])
            .map(p => ({ plant: p, distance: Math.round(getPreciseDistance(lat, lng, p.lat, p.lng)) }))
            .sort((a, b) => a.distance - b.distance);

          if (sortedAllPlants.length > 0) {
            setNearestPlantInfo(sortedAllPlants[0]);
            if (sortedAllPlants[0].distance <= (sortedAllPlants[0].plant.radius || 700)) {
              setDetectedPlant(sortedAllPlants[0].plant);
            } else {
              setDetectedPlant(null);
            }
          } else {
            setNearestPlantInfo(null);
            setDetectedPlant(null);
          }

          if (type === "OUT_AUTO" && isAutoTriggering.current) {
            isAutoTriggering.current = false;
            const autoPlant = sortedAllPlants.length > 0 && sortedAllPlants[0].distance <= (sortedAllPlants[0].plant.radius || 700)
              ? sortedAllPlants[0].plant
              : null;
            performAutoCheckOut(lat, lng, geocodedAddress, components, autoPlant);
          }
        } else {
          console.warn('Reverse geocode failed', data);
        }
      } catch (error) {
        console.error("Fast geocoding failed", error);
      } finally {
        if (type !== "OUT_AUTO") {
          setActiveDialog(type);
          setIsLoadingLocation(false);
        }
      }
    };

    if (!navigator.geolocation) {
      setLocationPermissionStatus("unavailable");
      setLocationPermissionMessage("Please allow location access to mark attendance.");
      setIsLoadingLocation(false);
      return;
    }

    const emergencyTimeout = setTimeout(() => {
      setIsLoadingLocation(false);
      clearActiveWatch();
      toast({
        variant: "destructive",
        title: "GPS Tracking Timeout",
        description: "System could not identify device coordinates in time. Please retry."
      });
    }, 12000);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(emergencyTimeout);
        processGeocoding(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
      },
      (err: GeolocationPositionError) => {
        clearTimeout(emergencyTimeout);
        setIsLoadingLocation(false);
        clearActiveWatch();
        setLocationPermissionStatus("denied");
        setLocationPermissionMessage("Please allow location access to mark attendance.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleConfirmCheckIn = async (e?: React.MouseEvent | React.FormEvent) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (isMutatingAttendance) return;

    if (!detectedPlant && !selectedType) {
      toast({ variant: "destructive", title: "Selection Mandatory", description: "Please select WFH or Field Work to continue outside radius bounds." });
      return;
    }

    const plantName = detectedPlant ? detectedPlant.name : "N/A";
    let finalInPlant = "N/A";
    let attendanceType = "N/A";

    if (detectedPlant) {
      finalInPlant = detectedPlant.name;
      attendanceType = 'Plant Attendance';
    } else {
      finalInPlant = selectedType === 'WFH' ? 'Outside-WFM' : 'Outside-Field Work';
      attendanceType = selectedType === 'WFH' ? 'Work From Home' : 'Field Work';
    }

    await punchCheckIn(finalInPlant, attendanceType, plantName, detectedPlant ? "Inside Plant" : "Outside Plant");
  };

  const handleConfirmCheckOut = async (e?: React.MouseEvent | React.FormEvent) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (!activeRecord || isMutatingAttendance) return;

    await punchCheckOut();
  };

  // ==========================================
  // ADMIN VIEW: Selected Employee Data Resolution
  // ==========================================
  const selectedAdminEmployee = useMemo(() => {
    if (!selectedAdminEmployeeId) return null;
    return employees.find(e =>
      e.employeeId === selectedAdminEmployeeId ||
      e.id === selectedAdminEmployeeId ||
      (e as any)._id === selectedAdminEmployeeId
    ) || null;
  }, [employees, selectedAdminEmployeeId]);

  const selectedAdminEmployeeIdentitySet = useMemo(() => {
    const set = new Set<string>();
    if (!selectedAdminEmployee) return set;
    const add = (v: any) => {
      if (v) set.add(String(v).trim().toUpperCase());
    };
    add(selectedAdminEmployee.employeeId);
    add(selectedAdminEmployee.id);
    add((selectedAdminEmployee as any)._id);
    add(selectedAdminEmployee.name);
    add((selectedAdminEmployee as any).fullName);
    add(selectedAdminEmployee.aadhaar);
    add(selectedAdminEmployee.aadhaarNumber);
    add(selectedAdminEmployee.mobile);
    add(selectedAdminEmployee.mobileNumber);
    add((selectedAdminEmployee as any).username);
    return set;
  }, [selectedAdminEmployee]);

  const adminEmployeeRecords = useMemo(() => {
    if (selectedAdminEmployeeIdentitySet.size === 0) return [];

    const fromDStr = adminFromDate;
    const toDStr = adminToDate;

    const matchedPunches = (attendanceRecords || []).filter(r => {
      if (!r) return false;
      const recEmpId = String(r.employeeId || '').trim().toUpperCase();
      const recEmpName = String(r.employeeName || '').trim().toUpperCase();
      const isMatch = selectedAdminEmployeeIdentitySet.has(recEmpId) || (recEmpName && selectedAdminEmployeeIdentitySet.has(recEmpName));
      return isMatch && r.date && r.date >= fromDStr && r.date <= toDStr;
    });

    const recordsByDate = new Map<string, any[]>();
    matchedPunches.forEach(r => {
      if (!recordsByDate.has(r.date)) recordsByDate.set(r.date, []);
      recordsByDate.get(r.date)!.push(r);
    });

    // Approved leaves for this employee
    const approvedLeaveDates = new Map<string, any>();
    (leaveRequests || []).forEach((l: any) => {
      const lEmpId = String(l.employeeId || (l as any).employeeID || "").trim().toUpperCase();
      const lEmpName = String(l.employeeName || "").trim().toUpperCase();
      const isMatch = selectedAdminEmployeeIdentitySet.has(lEmpId) || (lEmpName && selectedAdminEmployeeIdentitySet.has(lEmpName));
      if (isMatch && String(l.status).toUpperCase() === 'APPROVED') {
        if (l.fromDate && l.toDate) {
          try {
            let cur = startOfDay(parseISO(l.fromDate));
            const end = startOfDay(parseISO(l.toDate));
            while (!isAfter(cur, end)) {
              approvedLeaveDates.set(format(cur, "yyyy-MM-dd"), l);
              cur = addDays(cur, 1);
            }
          } catch (e) { }
        }
      }
    });

    const fullHistory: any[] = [];
    try {
      let currentD = startOfDay(parseISO(toDStr));
      const startD = startOfDay(parseISO(fromDStr));

      while (!isBefore(currentD, startD)) {
        const dateStr = format(currentD, "yyyy-MM-dd");

        if (recordsByDate.has(dateStr)) {
          const dayRecords = recordsByDate.get(dateStr)!;
          dayRecords.sort((a, b) => (b.inTime || "").localeCompare(a.inTime || ""));
          fullHistory.push(...dayRecords);
        } else {
          const isSun = isSunday(currentD);
          const holidayObj = holidays.find((h: any) => h.date === dateStr);
          const leaveObj = approvedLeaveDates.get(dateStr);

          let displayStatus = isSun ? 'Weekly Off' : 'Absent';
          let attType = holidayObj ? holidayObj.name : 'N/A';
          let inPlant = holidayObj ? holidayObj.name : (isSun ? 'Weekly Off' : 'N/A');
          let remark = holidayObj ? holidayObj.name : (isSun ? 'Weekly Off' : 'Absent');

          if (holidayObj) {
            displayStatus = 'Holiday';
          } else if (leaveObj) {
            displayStatus = 'Leave';
            attType = leaveObj.purpose || 'Approved Leave';
            inPlant = 'On Leave';
            remark = `Approved Leave (${leaveObj.purpose || 'Leave'})`;
          }

          fullHistory.push({
            id: `missing-${dateStr}`,
            employeeName: selectedAdminEmployee?.name || (selectedAdminEmployee as any)?.fullName || selectedAdminEmployee?.firstName || "Employee",
            date: dateStr,
            inTime: null,
            outTime: null,
            hours: 0,
            status: displayStatus,
            attendanceType: attType,
            address: null,
            addressOut: null,
            inPlant: inPlant,
            remark: remark
          });
        }
        currentD = addDays(currentD, -1);
      }
    } catch (e) { }

    return fullHistory;
  }, [selectedAdminEmployeeIdentitySet, adminFromDate, adminToDate, attendanceRecords, leaveRequests, holidays, selectedAdminEmployee]);

  const adminEmployeeStats = useMemo(() => {
    let totalPresent = 0;
    let totalAbsent = 0;
    let totalLeaves = 0;
    let totalHours = 0;

    adminEmployeeRecords.forEach(r => {
      if (r.inTime || r.status === 'Closed' || r.status === 'Open' || r.status === 'Auto OUT') {
        totalPresent++;
        totalHours += Number(r.hours || 0);
      } else if (r.status === 'Leave') {
        totalLeaves++;
      } else if (r.status === 'Absent') {
        totalAbsent++;
      }
    });

    return {
      totalPresent,
      totalAbsent,
      totalLeaves,
      totalHours: formatHoursToHHMM(totalHours)
    };
  }, [adminEmployeeRecords]);

  const filteredEmployeesForAdmin = useMemo(() => {
    if (!adminSearchTerm.trim()) return employees;
    const term = adminSearchTerm.trim().toLowerCase();
    return employees.filter(e => {
      const id = String(e.employeeId || e.id || '').toLowerCase();
      const name = String(e.name || (e as any).fullName || `${e.firstName || ''} ${e.lastName || ''}`).toLowerCase();
      const dept = String(e.department || '').toLowerCase();
      return id.includes(term) || name.includes(term) || dept.includes(term);
    });
  }, [employees, adminSearchTerm]);

  // Compute location info for the selected employee (Admin View)
  const selectedEmployeeLocationInfo = useMemo(() => {
    if (!selectedAdminEmployee || selectedAdminEmployeeIdentitySet.size === 0) {
      return {
        isLive: false,
        status: "NO_RECORDS" as const,
        readableAddress: "Location unavailable",
        lastUpdated: null,
        lat: null,
        lng: null,
        accuracy: null,
      };
    }

    const todayStr = format(getISTTime(), "yyyy-MM-dd");

    const employeePunches = (attendanceRecords || [])
      .filter((r: any) => {
        if (!r) return false;
        const recEmpId = String(r.employeeId || '').trim().toUpperCase();
        const recEmpName = String(r.employeeName || '').trim().toUpperCase();
        return selectedAdminEmployeeIdentitySet.has(recEmpId) || (recEmpName && selectedAdminEmployeeIdentitySet.has(recEmpName));
      })
      .sort((a: any, b: any) => {
        const dateDiff = String(b.date || '').localeCompare(String(a.date || ''));
        if (dateDiff !== 0) return dateDiff;
        const timeA = a.outDateTime || a.inDateTime || a.outTime || a.inTime || '';
        const timeB = b.outDateTime || b.inDateTime || b.outTime || b.inTime || '';
        return String(timeB).localeCompare(String(timeA));
      });

    const activeRec = employeePunches.find((r: any) => (r.status === 'Open' || (r.inTime && !r.outTime && r.status !== 'Closed' && r.status !== 'Auto OUT')) && r.date === todayStr);
    const latestRec = employeePunches[0];

    if (activeRec) {
      const activeExit = (activeRec.exitEvents || []).find((e: any) => !e.inPlantTime && e.trackingStatus === 'Outside Plant');
      const latestExitPoint = activeExit?.outLocationHistory && activeExit.outLocationHistory.length > 0
        ? activeExit.outLocationHistory[activeExit.outLocationHistory.length - 1]
        : null;

      const rawAddress = latestExitPoint?.address || activeExit?.completeAddress || activeRec.address || (activeRec.inPlant ? `${activeRec.inPlant} Industrial Area` : "Salt Plant Zone");
      const rawTime = latestExitPoint?.time || activeRec.inDateTime || `${activeRec.date} ${activeRec.inTime}`;
      const formattedTime = formatToReadableISTTime(rawTime);

      return {
        isLive: true,
        status: "ACTIVE" as const,
        readableAddress: rawAddress,
        lastUpdated: formattedTime,
        lat: latestExitPoint?.lat || activeRec.lat || null,
        lng: latestExitPoint?.lng || activeRec.lng || null,
        accuracy: null,
      };
    }

    if (latestRec) {
      const rawAddress = latestRec.addressOut || latestRec.address || (latestRec.inPlant ? `${latestRec.inPlant} Area` : "Salt Plant");
      const rawTime = latestRec.outDateTime || latestRec.inDateTime || (latestRec.outTime ? `${latestRec.date} ${latestRec.outTime}` : (latestRec.inTime ? `${latestRec.date} ${latestRec.inTime}` : null));
      const formattedTime = formatToReadableISTTime(rawTime);

      return {
        isLive: true,
        status: "ACTIVE" as any,
        readableAddress: rawAddress,
        lastUpdated: formattedTime,
        lat: latestRec.latOut || latestRec.lat || null,
        lng: latestRec.lngOut || latestRec.lng || null,
        accuracy: null,
      };
    }

    return {
      isLive: false,
      status: "NO_RECORDS" as const,
      readableAddress: "Location unavailable",
      lastUpdated: null,
      lat: null,
      lng: null,
      accuracy: null,
    };
  }, [selectedAdminEmployee, selectedAdminEmployeeIdentitySet, attendanceRecords]);

  const [adminResolvedAddress, setAdminResolvedAddress] = useState<string>("");
  const [isRefreshingAdminLocation, setIsRefreshingAdminLocation] = useState(false);
  const [manualAdminLocation, setManualAdminLocation] = useState<{
    address: string;
    lastUpdated: string;
    isLive: boolean;
    status: "LIVE" | "LAST_KNOWN" | "NO_RECORDS";
  } | null>(null);

  // Fetch or reset location when selected employee changes
  useEffect(() => {
    setManualAdminLocation(null);
    if (!selectedAdminEmployee) return;

    const empCode = selectedAdminEmployee.employeeId || selectedAdminEmployee.id || (selectedAdminEmployee as any)._id || '';
    if (!empCode) return;

    let isMounted = true;
    fetch(`/api/employee-location?employeeId=${encodeURIComponent(empCode)}&trigger=false`, {
      method: 'GET',
      cache: 'no-store'
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (isMounted && data?.address && data.address !== 'Location unavailable' && data.status !== 'NO_RECORDS') {
          const currentTime = format(getISTTime(), "hh:mm a");
          const formattedLastUpdated = data.lastUpdated ? formatToReadableISTTime(data.lastUpdated) : currentTime;
          setManualAdminLocation({
            address: data.address,
            lastUpdated: formattedLastUpdated,
            isLive: true,
            status: 'LIVE',
          });
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [selectedAdminEmployeeId, selectedAdminEmployee]);

  const handleRefreshAdminLocation = async () => {
    if (!selectedAdminEmployee) return;
    setIsRefreshingAdminLocation(true);

    const empCode = selectedAdminEmployee.employeeId || selectedAdminEmployee.id || (selectedAdminEmployee as any)._id || '';

    try {
      await refreshData();

      // If user is accessing from client device with geolocation permission, capture fresh GPS
      let clientLat: number | null = null;
      let clientLng: number | null = null;

      const isCurrentLoggedInUser =
        (verifiedUser?.employeeId && verifiedUser.employeeId.toUpperCase() === empCode.toUpperCase()) ||
        (verifiedUser?.username && verifiedUser.username.toUpperCase() === empCode.toUpperCase()) ||
        (currentUser?.employeeId && currentUser.employeeId.toUpperCase() === empCode.toUpperCase()) ||
        (currentUser?.username && currentUser.username.toUpperCase() === empCode.toUpperCase());

      if (isCurrentLoggedInUser && typeof window !== 'undefined' && navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 6000,
              maximumAge: 0,
            });
          });
          clientLat = pos.coords.latitude;
          clientLng = pos.coords.longitude;
        } catch (e) {}
      }

      const queryUrl = clientLat !== null && clientLng !== null
        ? `/api/employee-location?employeeId=${encodeURIComponent(empCode)}&trigger=true&lat=${clientLat}&lng=${clientLng}`
        : `/api/employee-location?employeeId=${encodeURIComponent(empCode)}&trigger=true`;

      // Trigger live location request to employee device
      let res = await fetch(queryUrl, {
        method: 'GET',
        cache: 'no-store'
      });

      let data = res.ok ? await res.json() : null;

      // If initial check doesn't have a fresh location, wait 1.2s for device to respond to push & retry
      if (!data || !data.address || data.address === 'Location unavailable' || data.status === 'NO_RECORDS') {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        res = await fetch(`/api/employee-location?employeeId=${encodeURIComponent(empCode)}&trigger=false`, {
          method: 'GET',
          cache: 'no-store'
        });
        if (res.ok) {
          data = await res.json();
        }
      }

      if (data?.address && data.address !== 'Location unavailable' && data.status !== 'NO_RECORDS') {
        const currentTime = format(getISTTime(), "hh:mm a");
        const formattedLastUpdated = data.lastUpdated ? formatToReadableISTTime(data.lastUpdated) : currentTime;
        setManualAdminLocation({
          address: data.address,
          lastUpdated: formattedLastUpdated,
          isLive: true,
          status: 'LIVE',
        });

        toast({
          title: "Employee Current Location Updated",
          description: `Retrieved current live GPS location for ${selectedAdminEmployee.name || (selectedAdminEmployee as any).fullName || 'Employee'}.`,
        });
        setIsRefreshingAdminLocation(false);
        return;
      }

      // If no active or historical location records found
      setManualAdminLocation({
        address: "",
        lastUpdated: "",
        isLive: false,
        status: "NO_RECORDS",
      });

      toast({
        variant: "destructive",
        title: "Unable to fetch location",
        description: "Unable to fetch employee's current location. Please try again.",
      });
      setIsRefreshingAdminLocation(false);
    } catch (error) {
      setManualAdminLocation({
        address: "",
        lastUpdated: "",
        isLive: false,
        status: "NO_RECORDS",
      });
      toast({
        variant: "destructive",
        title: "Unable to fetch location",
        description: "Unable to fetch employee's current location. Please try again.",
      });
      setIsRefreshingAdminLocation(false);
    }
  };

  const currentDisplayLocation = useMemo(() => {
    if (manualAdminLocation) {
      return {
        isLive: manualAdminLocation.isLive,
        status: manualAdminLocation.status,
        readableAddress: manualAdminLocation.address || "Location unavailable",
        lastUpdated: manualAdminLocation.lastUpdated,
      };
    }
    return {
      isLive: selectedEmployeeLocationInfo.isLive,
      status: selectedEmployeeLocationInfo.status,
      readableAddress: adminResolvedAddress || selectedEmployeeLocationInfo.readableAddress || "Address resolving...",
      lastUpdated: selectedEmployeeLocationInfo.lastUpdated,
    };
  }, [manualAdminLocation, selectedEmployeeLocationInfo, adminResolvedAddress]);

  useEffect(() => {
    if (!selectedAdminEmployee) {
      setAdminResolvedAddress("");
      return;
    }
    const loc = selectedEmployeeLocationInfo;
    if (loc.lat && loc.lng && (!loc.readableAddress || loc.readableAddress === "Location unavailable" || loc.readableAddress.includes("Lat:") || loc.readableAddress === "Registered Zone")) {
      fetch('/api/geocode/reverse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: loc.lat, lng: loc.lng })
      }).then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.address) {
            const addr = typeof data.address === 'object' ? (data.address.Match_addr || data.address.LongLabel || data.address.Address || "") : data.address;
            if (addr) setAdminResolvedAddress(addr);
          }
        }).catch(() => { });
    } else {
      setAdminResolvedAddress(loc.readableAddress);
    }
  }, [selectedAdminEmployee, selectedEmployeeLocationInfo]);

  if (!isMounted) return null;

  // =========================================================================
  // VIEW 1: ADMIN & OTHER USER VIEW (READ-ONLY EMPLOYEE ATTENDANCE HISTORY)
  // GATEWAY PORTAL, MARK IN, AND MARK OUT ARE STRICTLY NOT RENDERED
  // =========================================================================
  if (!isEmployeeLogin) {
    return (
      <div className="space-y-8 pb-12 px-4 max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-6 pt-2">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-md">
                <History className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">
                  Mark Attendance – Employee History
                </h1>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">
                  Search, filter and inspect employee attendance ledger in read-only mode.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge className="bg-slate-900 text-white text-xs font-black uppercase px-3 py-1.5 rounded-xl">
              Role: {String(verifiedUser?.role || currentUser?.role || 'Admin').replace(/_/g, ' ')}
            </Badge>
            <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 text-xs font-black uppercase px-3 py-1.5 rounded-xl">
              Read-Only Access
            </Badge>
          </div>
        </div>

        {/* Filter Controls Card */}
        <Card className="rounded-3xl border-slate-200 shadow-sm bg-white overflow-hidden">
          <CardHeader className="bg-slate-50 border-b border-slate-100 py-4 px-6">
            <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Filter className="w-4 h-4 text-primary" /> Search & Employee Filter
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 items-end">
              {/* Employee Selection */}
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  Select Employee <span className="text-red-500">*</span>
                </Label>
                <Select value={selectedAdminEmployeeId} onValueChange={setSelectedAdminEmployeeId}>
                  <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-slate-50 text-xs font-bold">
                    <SelectValue placeholder="Choose an employee..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] rounded-xl shadow-xl">
                    {filteredEmployeesForAdmin.map((emp) => {
                      const empId = emp.employeeId || emp.id || (emp as any)._id;
                      const empName = emp.name || (emp as any).fullName || `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
                      return (
                        <SelectItem key={empId} value={empId} className="text-xs font-semibold py-2.5">
                          <div className="flex items-center justify-between w-full gap-4">
                            <span className="font-bold text-slate-800">[{emp.employeeId || 'ID'}] {empName}</span>
                            <span className="text-[10px] text-slate-400 uppercase font-mono">({emp.department || 'Operations'})</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* From Date */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">From Date</Label>
                <Input
                  type="date"
                  value={adminFromDate}
                  onChange={(e) => setAdminFromDate(e.target.value)}
                  className="h-11 border-slate-200 bg-slate-50 rounded-xl text-xs font-bold"
                />
              </div>

              {/* To Date */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">To Date</Label>
                <Input
                  type="date"
                  value={adminToDate}
                  min={adminFromDate}
                  onChange={(e) => setAdminToDate(e.target.value)}
                  className="h-11 border-slate-200 bg-slate-50 rounded-xl text-xs font-bold"
                />
              </div>
            </div>

            {/* Quick Period Filter Chips */}
            <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-slate-100 mt-5">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider mr-1">Quick Range:</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-[10px] font-black uppercase rounded-lg border-slate-200 hover:bg-slate-100"
                onClick={() => {
                  const now = getISTTime();
                  setAdminFromDate(format(addDays(now, -45), "yyyy-MM-dd"));
                  setAdminToDate(format(now, "yyyy-MM-dd"));
                }}
              >
                Last 45 Days
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-[10px] font-black uppercase rounded-lg border-slate-200 hover:bg-slate-100"
                onClick={() => {
                  const now = getISTTime();
                  setAdminFromDate(format(startOfMonth(now), "yyyy-MM-dd"));
                  setAdminToDate(format(now, "yyyy-MM-dd"));
                }}
              >
                This Month
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-[10px] font-black uppercase rounded-lg border-slate-200 hover:bg-slate-100"
                onClick={() => {
                  const now = getISTTime();
                  const prevMonth = subMonths(now, 1);
                  setAdminFromDate(format(startOfMonth(prevMonth), "yyyy-MM-dd"));
                  setAdminToDate(format(endOfMonth(prevMonth), "yyyy-MM-dd"));
                }}
              >
                Last Month
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-[10px] font-black uppercase rounded-lg border-slate-200 hover:bg-slate-100"
                onClick={() => {
                  setAdminFromDate(currentFYInfo.startDateStr);
                  setAdminToDate(currentFYInfo.endDateStr);
                }}
              >
                {currentFYInfo.label}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Selected Employee Summary Banner & Location Box */}
        {selectedAdminEmployee ? (
          <div className="space-y-6">
            {/* 1. Employee Information Header */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-2xl shadow-md shrink-0">
                  {(selectedAdminEmployee.name || selectedAdminEmployee.firstName || "E")[0]}
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-black uppercase tracking-tight text-slate-900">
                      {selectedAdminEmployee.name || (selectedAdminEmployee as any).fullName || `${selectedAdminEmployee.firstName || ''} ${selectedAdminEmployee.lastName || ''}`.trim()}
                    </h2>
                    <Badge className="bg-slate-900 text-white font-black text-[10px] uppercase">
                      {selectedAdminEmployee.employeeId}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-1 sm:gap-x-6 text-xs text-slate-600 font-semibold pt-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Employee Name:</span>
                      <span className="font-bold text-slate-900 uppercase">{selectedAdminEmployee.name || (selectedAdminEmployee as any).fullName || `${selectedAdminEmployee.firstName || ''} ${selectedAdminEmployee.lastName || ''}`.trim()}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Department:</span>
                      <span className="font-bold text-slate-900 uppercase">{selectedAdminEmployee.department || 'Logistics'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Mobile:</span>
                      <span className="font-bold text-slate-900">{selectedAdminEmployee.mobile || (selectedAdminEmployee as any).mobileNumber || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats Counters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full md:w-auto shrink-0">
                <div className="bg-slate-50 rounded-2xl p-3 text-center border border-slate-200 min-w-[85px]">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Present</p>
                  <p className="text-xl font-black text-emerald-600 mt-0.5">{adminEmployeeStats.totalPresent}</p>
                </div>
                <div className="bg-slate-50 rounded-2xl p-3 text-center border border-slate-200 min-w-[85px]">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Absent</p>
                  <p className="text-xl font-black text-rose-600 mt-0.5">{adminEmployeeStats.totalAbsent}</p>
                </div>
                <div className="bg-slate-50 rounded-2xl p-3 text-center border border-slate-200 min-w-[85px]">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Leaves</p>
                  <p className="text-xl font-black text-purple-600 mt-0.5">{adminEmployeeStats.totalLeaves}</p>
                </div>
                <div className="bg-slate-50 rounded-2xl p-3 text-center border border-slate-200 min-w-[85px]">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Hours</p>
                  <p className="text-xl font-black text-amber-600 mt-0.5">{adminEmployeeStats.totalHours}</p>
                </div>
              </div>
            </div>

            {/* 2. Location Box: CURRENT LOCATION */}
            <div className="bg-slate-950 text-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-800 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      Live Location Tracking
                    </span>
                    <h3 className="text-sm font-black uppercase tracking-wider text-white">
                      Current Location
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleRefreshAdminLocation}
                    disabled={isRefreshingAdminLocation}
                    className="h-8 bg-white/10 hover:bg-white/20 text-white border-white/20 text-[11px] font-black uppercase tracking-wider rounded-xl px-3 flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
                  >
                    <RefreshCw className={cn("w-3.5 h-3.5 text-emerald-400", isRefreshingAdminLocation && "animate-spin")} />
                    <span>{isRefreshingAdminLocation ? "Updating..." : "Refresh Location"}</span>
                  </Button>

                  <Badge className="text-[10px] font-black uppercase px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    ● Current Location
                  </Badge>
                </div>
              </div>

              <div className="space-y-3 pt-1">
                {(currentDisplayLocation.status === "NO_RECORDS" || !currentDisplayLocation.readableAddress || currentDisplayLocation.readableAddress === "Location unavailable") ? (
                  <div className="space-y-1 py-3 bg-slate-900/60 rounded-2xl p-4 border border-slate-800">
                    <p className="text-sm font-bold text-rose-300">Unable to fetch employee&apos;s current location. Please try again.</p>
                    <p className="text-xs text-slate-400 font-medium">No live GPS broadcast or recorded punch found for this employee.</p>
                  </div>
                ) : (
                  <>
                    <blockquote className="border-l-4 border-emerald-400 pl-4 py-2.5 text-base sm:text-lg font-bold text-white leading-relaxed bg-white/5 rounded-r-2xl pr-4">
                      {currentDisplayLocation.readableAddress}
                    </blockquote>

                    {currentDisplayLocation.lastUpdated && (
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80 text-xs font-semibold text-slate-400">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Last Updated: <strong className="text-slate-200 font-black">{currentDisplayLocation.lastUpdated}</strong></span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Read-Only Attendance History Ledger Table */}
            <Card className="rounded-[1.5rem] overflow-hidden shadow-sm border-slate-200 bg-white">
              <CardHeader className="bg-slate-50/80 border-b border-slate-100 py-4 px-6 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-black uppercase tracking-tight text-slate-900 flex items-center gap-2">
                    <History className="w-5 h-5 text-primary" /> Attendance History Ledger
                  </CardTitle>
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">
                    Showing records from {formatDate(adminFromDate)} to {formatDate(adminToDate)} ({adminEmployeeRecords.length} day logs)
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px] font-black uppercase px-2.5 py-1 text-slate-600 bg-white">
                  Read-Only Ledger
                </Badge>
              </CardHeader>
              <ScrollArea className="h-[480px]">
                <Table>
                  <TableHeader className="bg-slate-50 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="font-black uppercase text-[10px]">Date</TableHead>
                      <TableHead className="font-black uppercase text-[10px]">Plant / Type</TableHead>
                      <TableHead className="font-black uppercase text-[10px]">In Time</TableHead>
                      <TableHead className="font-black uppercase text-[10px]">Out Time</TableHead>
                      <TableHead className="font-black uppercase text-[10px] hidden md:table-cell">In Address</TableHead>
                      <TableHead className="font-black uppercase text-[10px] hidden md:table-cell">Out Address</TableHead>
                      <TableHead className="font-black uppercase text-[10px]">Hours</TableHead>
                      <TableHead className="font-black uppercase text-[10px] hidden lg:table-cell">Remarks</TableHead>
                      <TableHead className="font-black uppercase text-[10px] text-right pr-6">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {adminEmployeeRecords.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-16 text-xs font-bold text-slate-400 uppercase tracking-wider">
                          No attendance records found for this date range.
                        </TableCell>
                      </TableRow>
                    ) : (
                      adminEmployeeRecords.map((r: any) => (
                        <TableRow key={r.id || r._id} className="hover:bg-slate-50/50">
                          <TableCell className="py-3.5">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-800">{formatDate(r.date)}</span>
                              <span className="text-[10px] font-semibold text-slate-400 mt-0.5">{format(parseISO(r.date), "EEEE")}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs font-bold text-slate-600">
                            {r.inPlant && r.inPlant !== "N/A" ? r.inPlant : (r.attendanceType || "N/A")}
                          </TableCell>
                          <TableCell className="text-xs font-bold text-slate-600">{r.inTime || "--:--"}</TableCell>
                          <TableCell className="text-xs font-bold text-slate-600">{r.outTime || "--:--"}</TableCell>
                          <TableCell className="hidden md:table-cell text-[10px] font-medium text-slate-500 max-w-[150px] truncate" title={r.address}>
                            {r.address || "N/A"}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-[10px] font-medium text-slate-500 max-w-[150px] truncate" title={r.addressOut}>
                            {r.addressOut || "N/A"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn("font-black text-[10px]", getWorkingHoursColor(r.hours || 0))}>
                              {formatHoursToHHMM(r.hours || 0)}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-[10px] font-medium text-slate-500 max-w-[140px] truncate" title={r.remark}>
                            {r.remark || "N/A"}
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            <Badge className={cn("text-[9px] font-black uppercase px-2 py-0.5 whitespace-nowrap",
                              r.status === 'Auto OUT' ? "bg-amber-100 text-amber-700 hover:bg-amber-100" :
                                r.status === 'Open' ? "bg-blue-100 text-blue-700 hover:bg-blue-100" :
                                  r.status === 'Absent' ? "bg-rose-100 text-rose-700 hover:bg-rose-100" :
                                    r.status === 'Leave' ? "bg-purple-100 text-purple-700 hover:bg-purple-100" :
                                      (r.status === 'Weekly Off' || r.status === 'Holiday') ? "bg-slate-100 text-slate-700 hover:bg-slate-100" :
                                        "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                            )}>
                              {r.status === 'Open' ? 'Active Shift' :
                                r.status === 'Closed' ? 'Completed Shift' :
                                  r.status === 'Auto OUT' ? 'Auto Closed' :
                                    r.status === 'Leave' ? 'Approved Leave' :
                                      r.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </Card>
          </div>
        ) : (
          <div className="py-20 text-center text-slate-400 bg-white rounded-3xl border border-slate-200 shadow-sm">
            <User className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-600">Please select an employee to view attendance history.</p>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: EMPLOYEE VIEW (GATEWAY PORTAL, MARK IN / OUT & OWN HISTORY)
  // ONLY AUTHENTICATED EMPLOYEES CAN SEE & ACCESS THIS VIEW
  // =========================================================================
  return (
    <div className="space-y-6 pb-8 w-full mx-auto">
      {/* 0. GATEWAY PORTAL (MARK IN / MARK OUT) - STRICTLY FOR EMPLOYEE */}
      <div className="w-full space-y-6">
        {(locationPermissionStatus === "denied" || locationPermissionStatus === "unavailable" || locationPermissionMessage) && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm text-amber-900 animate-in fade-in">
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-amber-600 shrink-0" />
              <span className="text-xs font-black uppercase tracking-wide">
                {t.locationPermissionRequired}
              </span>
            </div>
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white font-black text-xs uppercase px-4 h-9 rounded-xl shrink-0"
              onClick={() => checkLocationOnMount(true)}
            >
              {t.allowLocation}
            </Button>
          </div>
        )}

        <Card className="shadow-2xl border-none overflow-hidden bg-white">
          <div className="h-1.5 bg-primary" />
          <CardHeader className="text-center py-5 sm:py-6 relative bg-slate-50/50 border-b border-slate-100 px-4">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-primary bg-primary/10 px-3 py-1 rounded-full">
                {t.gatewayPortal}
              </span>
              <CardTitle className="text-xl font-black flex items-center justify-center gap-2 text-slate-900 uppercase tracking-tight pt-1">
                <ShieldCheck className="text-primary w-5 h-5" /> {t.markAttendance}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 px-4 sm:px-8 pb-8 pt-6">
            {/* Employee Identification Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">{t.employeeName}</span>
                <span className="text-xs font-black text-slate-900 uppercase">{effectiveEmployeeName} ({effectiveEmployeeId})</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">{t.currentLocation}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-700 text-right max-w-[240px] truncate" title={detectedAddress}>
                    {detectedAddress || t.capturingAddress}
                  </span>
                  <button
                    type="button"
                    title="Refresh Location"
                    onClick={() => checkLocationOnMount(true)}
                    className="p-1 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
                  >
                    <RefreshCw className={cn("w-3.5 h-3.5", locationPermissionStatus === "checking" && "animate-spin")} />
                  </button>
                </div>
              </div>
            </div>

            {/* Live Clock Display */}
            <div className="py-6 px-8 sm:px-10 rounded-[2.5rem] bg-slate-50 text-slate-900 flex flex-col items-center justify-center space-y-1 shadow-inner border border-slate-100 max-w-[300px] mx-auto group hover:bg-primary/5 transition-colors" suppressHydrationWarning>
              {currentTime ? (
                <div className="text-center" suppressHydrationWarning>
                  <h2 className="text-[50px] sm:text-[55px] font-black tracking-tighter font-mono leading-none text-slate-900" suppressHydrationWarning>{format(currentTime, "HH:mm")}</h2>
                  <p className="text-[11px] font-black text-primary mt-3 flex items-center justify-center gap-1.5 uppercase tracking-[0.2em]" suppressHydrationWarning>{format(currentTime, "dd MMM yyyy")}</p>
                </div>
              ) : (
                <Loader2 className="w-10 h-10 text-slate-200 animate-spin" />
              )}
            </div>

            {/* Daily Sessions Limit Alert */}
            {hasUsedMaxSessions && (
              <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl text-amber-900 shadow-sm flex items-center gap-3 animate-in fade-in">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <div className="text-left">
                  <p className="text-xs font-black uppercase tracking-tight text-amber-900">
                    {t.dailyLimitReachedTitle}
                  </p>
                  <p className="text-xs font-bold text-amber-700 mt-0.5">
                    {t.dailyLimitReachedDesc}
                  </p>
                </div>
              </div>
            )}

            {/* Session 2 Available Notice */}
            {!activeRecord && todaySessions.length === 1 && !isCooldownLocked && (
              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl text-blue-900 shadow-sm flex items-center justify-between gap-2 animate-in fade-in">
                <div className="flex items-center gap-2 text-left">
                  <Badge className="bg-blue-600 text-white font-black text-[10px] uppercase px-2 py-0.5 rounded-lg">
                    {t.session2Of2}
                  </Badge>
                  <span className="text-xs font-bold text-blue-800">
                    {t.session2Desc}
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-blue-600 hidden sm:inline">
                  {t.max8hAutoOut}
                </span>
              </div>
            )}

            {activeRecord && !canMarkOut && nextOutAvailableAt && (
              <div className="p-4 bg-[#FFFDE7] rounded-2xl border border-amber-200 text-amber-800 animate-in fade-in max-w-md mx-auto w-full text-left shadow-sm" suppressHydrationWarning>
                <p className="text-xs font-black uppercase tracking-tight text-amber-900" suppressHydrationWarning>
                  {(() => {
                    const startDT = (activeRecord.inDate && activeRecord.inTime)
                      ? parseDateTime(activeRecord.inDate, activeRecord.inTime)
                      : (activeRecord.date && activeRecord.inTime)
                      ? parseDateTime(activeRecord.date, activeRecord.inTime)
                      : (activeRecord.inDateTime ? parseISO(activeRecord.inDateTime) : null);
                    const formatted = startDT && isValid(startDT)
                      ? format(startDT, "dd-MMM, hh:mm a")
                      : `${activeRecord.inDate || activeRecord.date || 'Today'}, ${activeRecord.inTime}`;
                    return t.activeShiftSince(activeRecord.sessionIndex || 1, formatted);
                  })()}
                </p>
                <p className="text-[11px] font-bold text-amber-700 mt-1 leading-relaxed" suppressHydrationWarning>
                  {t.markOutAvailableAt(format(nextOutAvailableAt, "dd-MMM-yyyy HH:mm"))} • {activeRecord.sessionIndex === 2 ? t.autoOutThreshold8h : t.autoOutThreshold16h}
                </p>
              </div>
            )}

            {/* Mark IN & Mark OUT Action Buttons */}
            <div className="flex gap-3 sm:gap-4">
              <Button
                type="button"
                className={cn("flex-1 h-16 text-sm font-black rounded-2xl shadow-xl transition-all uppercase tracking-widest",
                  (!activeRecord && !isCooldownLocked && !hasUsedMaxSessions) ? "bg-primary text-white shadow-primary/20 hover:bg-primary/90" : "bg-slate-100 text-slate-400"
                )}
                disabled={isLoadingLocation || isMutatingAttendance || !!activeRecord || isCooldownLocked || hasUsedMaxSessions}
                onClick={handleMarkInClick}
              >
                {isLoadingLocation && activeDialog === 'NONE' ? (
                  <span className="flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> {t.fetchingGps}</span>
                ) : hasUsedMaxSessions ? (
                  t.twoSessionsUsed
                ) : todaySessions.length === 1 ? (
                  t.markInSession2
                ) : (
                  t.markIn
                )}
              </Button>
              <Button
                type="button"
                className={cn(
                  "flex-1 h-16 text-sm font-black rounded-2xl shadow-xl transition-all uppercase tracking-widest",
                  activeRecord ? "bg-rose-600 text-white shadow-rose-200 hover:bg-rose-700" : "bg-slate-100 text-slate-400",
                  activeRecord && !canMarkOut ? "opacity-70 hover:bg-rose-600/90" : ""
                )}
                disabled={isLoadingLocation || isMutatingAttendance || !activeRecord || (activeRecord ? !canMarkOut : false)}
                onClick={handleMarkOutClick}
              >
                {activeRecord && !canMarkOut ? t.markOutLocked : (isLoadingLocation && activeDialog === 'NONE' ? <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  {t.markOut}
                </> : t.markOut)}
              </Button>
            </div>

            {/* Status & Rest Period Footer */}
            <div className="pt-6 border-t border-slate-100 flex flex-col items-center justify-center w-full">
              {isCooldownLocked && nextInAvailableAt ? (
                <div className="flex flex-col items-center justify-center gap-1 text-amber-700 bg-amber-50 px-5 py-3 rounded-xl w-full border border-amber-200">
                  <span className="text-sm font-black uppercase tracking-wider">{t.restPeriodActive}</span>
                  <span className="text-xs font-bold text-center">{t.markInAvailableAt(format(nextInAvailableAt, "dd-MMM-yyyy HH:mm"))}</span>
                  <span className="text-lg font-black font-mono tracking-widest text-amber-800">
                    {cooldownRemaining || "00:00:00"}
                  </span>
                </div>
              ) : hasUsedMaxSessions ? (
                <div className="flex items-center justify-center gap-2 text-amber-700 bg-amber-50 px-5 py-3 rounded-xl w-full border border-amber-200 font-black uppercase tracking-wider text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>{t.maximumSessionsCompleted(formatHoursToHHMM(todaySessions.reduce((sum, s) => sum + (s.hours || 0), 0)))}</span>
                </div>
              ) : activeRecord ? (
                <div className="w-full space-y-3">
                  <div className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl w-full border font-black text-sm uppercase tracking-wider text-emerald-600 bg-emerald-50 border-emerald-100">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>{t.activeShiftInProgress(activeRecord.sessionIndex || 1)}</span>
                  </div>

                  <div className="flex items-center justify-center gap-2 text-slate-600 bg-[#F8F9FA] px-5 py-2.5 rounded-xl w-full border border-slate-200 shadow-sm font-black uppercase tracking-wider text-xs">
                    <Clock className="w-4 h-4 text-slate-500" />
                    <span>
                      {(() => {
                        const startDT = (activeRecord.inDate && activeRecord.inTime)
                          ? parseDateTime(activeRecord.inDate, activeRecord.inTime)
                          : (activeRecord.date && activeRecord.inTime)
                          ? parseDateTime(activeRecord.date, activeRecord.inTime)
                          : (activeRecord.inDateTime ? parseISO(activeRecord.inDateTime) : null);
                        const dateFormatted = startDT && isValid(startDT) ? format(startDT, "dd-MMM-yyyy") : (activeRecord.inDate || activeRecord.date || format(getISTTime(), "dd-MMM-yyyy"));
                        return `${t.shiftStarted(dateFormatted, activeRecord.inTime)} • ${activeRecord.sessionIndex === 2 ? t.maxAutoOut8h : t.maxAutoOut16h}`;
                      })()}
                    </span>
                  </div>
                </div>
              ) : todaySessions.length === 1 ? (
                <div className="flex items-center justify-center gap-2 text-blue-600 bg-blue-50 px-5 py-3 rounded-xl w-full border border-blue-100">
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-sm font-black uppercase tracking-wider">
                    {t.session1Completed(formatHoursToHHMM(todayRecord?.hours || 0))}
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 text-slate-500 bg-slate-50 px-5 py-3 rounded-xl w-full border border-slate-200">
                  <Clock className="w-5 h-5" />
                  <span className="text-sm font-black uppercase tracking-wider">{t.eligibleForMarkIn}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 1. SESSION HISTORY & 2. MONTHLY SUMMARY - STRICTLY FOR LOGGED-IN EMPLOYEE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SESSION HISTORY (LAST 62 DAYS) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2">
            <div>
              <h3 className="font-black text-lg flex items-center gap-2 text-slate-800 uppercase tracking-tight">
                <History className="w-5 h-5 text-primary" /> {t.myAttendanceHistory}
              </h3>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                {t.displayingDays(formatDate(dateWindow62Days.startDateStr), formatDate(dateWindow62Days.todayStr))}
              </p>
            </div>
            <Badge variant="outline" className="text-[10px] font-black uppercase px-2.5 py-1 text-slate-600 border-slate-300 w-fit bg-white">
              {t.rolling62Days}
            </Badge>
          </div>

          <Card className="rounded-[1.5rem] overflow-hidden shadow-sm border-slate-200 bg-white">
            <ScrollArea className="h-[430px] w-full">
              {isLoading && employeeRecords.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-3">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.syncingHistory}</p>
                </div>
              ) : (
                <div className="overflow-x-auto w-full">
                  <Table className="min-w-[550px] w-full">
                    <TableHeader className="bg-slate-50 sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="font-black uppercase text-[10px]">{t.date}</TableHead>
                        <TableHead className="font-black uppercase text-[10px]">{t.plantType}</TableHead>
                        <TableHead className="font-black uppercase text-[10px]">{t.inTime}</TableHead>
                        <TableHead className="font-black uppercase text-[10px]">{t.outTime}</TableHead>
                        <TableHead className="font-black uppercase text-[10px] hidden md:table-cell">{t.inAddress}</TableHead>
                        <TableHead className="font-black uppercase text-[10px] hidden md:table-cell">{t.outAddress}</TableHead>
                        <TableHead className="font-black uppercase text-[10px]">{t.workingHours}</TableHead>
                        <TableHead className="font-black uppercase text-[10px] hidden lg:table-cell">{t.remarks}</TableHead>
                        <TableHead className="font-black uppercase text-[10px] text-right pr-4">{t.status}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employeeRecords.map((r: any) => (
                        <TableRow key={r.id || r._id} className="hover:bg-slate-50/50">
                          <TableCell className="py-3.5">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-800">{formatDate(r.date)}</span>
                              <span className="text-[10px] font-semibold text-slate-400 mt-0.5">{format(parseISO(r.date), "EEEE")}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs font-bold text-slate-600">
                            {r.inPlant && r.inPlant !== "N/A" ? r.inPlant : (r.attendanceType === 'WFH' ? t.workFromHome : r.attendanceType === 'FIELD' ? t.fieldWork : (r.attendanceType || "N/A"))}
                          </TableCell>
                          <TableCell className="text-xs font-bold text-slate-600">{r.inTime || "--:--"}</TableCell>
                          <TableCell className="text-xs font-bold text-slate-600">{r.outTime || "--:--"}</TableCell>
                          <TableCell className="hidden md:table-cell text-[10px] font-medium text-slate-500 max-w-[140px] truncate" title={r.address}>
                            {r.address || "N/A"}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-[10px] font-medium text-slate-500 max-w-[140px] truncate" title={r.addressOut}>
                            {r.addressOut || "N/A"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn("font-black text-[10px]", getWorkingHoursColor(r.hours || 0))}>
                              {formatHoursToHHMM(r.hours || 0)}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-[10px] font-medium text-slate-500 max-w-[130px] truncate" title={r.remark}>
                            {r.remark || "N/A"}
                          </TableCell>
                          <TableCell className="text-right pr-4">
                            <Badge className={cn("text-[9px] font-black uppercase px-2 py-0.5 whitespace-nowrap",
                              r.status === 'Auto OUT' ? "bg-amber-100 text-amber-700 hover:bg-amber-100" :
                                r.status === 'Open' ? "bg-blue-100 text-blue-700 hover:bg-blue-100" :
                                  r.status === 'Absent' ? "bg-rose-100 text-rose-700 hover:bg-rose-100" :
                                    r.status === 'Leave' ? "bg-purple-100 text-purple-700 hover:bg-purple-100" :
                                      (r.status === 'Weekly Off' || r.status === 'Holiday') ? "bg-slate-100 text-slate-700 hover:bg-slate-100" :
                                        "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                            )}>
                              {r.status === 'Open' ? t.statusActiveShift :
                                r.status === 'Closed' ? t.statusCompletedShift :
                                  r.status === 'Auto OUT' ? t.statusAutoClosedShift :
                                    r.status === 'Leave' ? t.statusApprovedLeave :
                                      r.status === 'Weekly Off' ? t.statusWeeklyOff :
                                        r.status === 'Holiday' ? t.statusHoliday :
                                          r.status === 'Absent' ? t.statusAbsent :
                                            r.status === 'Present' ? t.statusPresent :
                                              r.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </ScrollArea>
          </Card>
        </div>

        {/* MONTHLY SUMMARY (CURRENT & PREVIOUS 2 MONTHS) */}
        <div className="lg:col-span-1 space-y-4">
          <div className="pt-2">
            <h3 className="font-black text-lg flex items-center gap-2 text-slate-800 uppercase tracking-tight">
              <Calendar className="w-5 h-5 text-primary" /> {t.monthlySummary}
            </h3>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              {t.currentAndPreviousMonths}
            </p>
          </div>

          <div className="space-y-4">
            <Card className="rounded-[1.5rem] overflow-hidden shadow-sm border-slate-200 bg-white">
              <div className="overflow-x-auto w-full">
                <Table className="w-full">
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="font-black uppercase text-[10px]">{t.month}</TableHead>
                      <TableHead className="font-black uppercase text-[10px] text-right">{t.present}</TableHead>
                      <TableHead className="font-black uppercase text-[10px] text-right pr-4">{t.absent}</TableHead>
                      <TableHead className="font-black uppercase text-[10px] text-right pr-4">{t.worked}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlySummaries.map((summary, idx) => (
                      <TableRow key={idx} className="hover:bg-slate-50/50">
                        <TableCell className="font-bold text-xs text-slate-800 py-3">{summary.monthYear}</TableCell>
                        <TableCell className="font-black text-xs text-emerald-600 text-right">{summary.present}</TableCell>
                        <TableCell className="font-black text-xs text-rose-600 text-right pr-4">{summary.absent}</TableCell>
                        <TableCell className="font-black text-xs text-slate-600 text-right pr-4">{summary.workedHours}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* 3. LEAVE REQUEST & LEAVE HISTORY (CURRENT FINANCIAL YEAR & APPROVED RECORDS ONLY) */}
      <div className="space-y-4 pt-4">
        {/* Leave Request Action Button Bar Above Leave History */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 bg-white border border-slate-200 rounded-3xl shadow-sm">
          <div className="space-y-0.5">
            <h4 className="text-sm font-black uppercase text-slate-900 tracking-tight flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" /> {t.applyForLeave}
            </h4>
            <p className="text-xs font-medium text-slate-500">
              {t.submitLeaveDesc}
            </p>
          </div>
          <LeaveRequestForm t={t} />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2">
          <div>
            <h3 className="font-black text-lg flex items-center gap-2 text-slate-800 uppercase tracking-tight">
              <History className="w-5 h-5 text-primary" /> {t.leaveHistory(currentFYInfo.label)}
            </h3>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              {t.monthWiseApprovedLeaves(formatDate(currentFYInfo.startDateStr), formatDate(currentFYInfo.endDateStr))}
            </p>
          </div>
          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-[10px] font-black uppercase px-2.5 py-1 border border-emerald-200 w-fit">
            {t.approvedRecordsOnly}
          </Badge>
        </div>

        {fyMonthWiseLeaves.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {fyMonthWiseLeaves.map((group) => (
              <div
                key={group.monthKey}
                className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between hover:border-primary/40 transition-colors"
              >
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{group.monthLabel}</span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-xl font-black text-slate-900">{group.totalLeaveDays}</span>
                  <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100 uppercase">
                    {group.totalLeaveDays} {t.leavesUnit}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <Card className="rounded-[1.5rem] overflow-hidden shadow-sm border-slate-200 bg-white">
          <div className="overflow-x-auto w-full">
            <Table className="min-w-[550px] w-full">
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-black uppercase text-[10px]">{t.month}</TableHead>
                  <TableHead className="font-black uppercase text-[10px]">{t.totalLeave}</TableHead>
                  <TableHead className="font-black uppercase text-[10px]">{t.leaveDates}</TableHead>
                  <TableHead className="font-black uppercase text-[10px]">{t.leavePurpose}</TableHead>
                  <TableHead className="font-black uppercase text-[10px] hidden md:table-cell">{t.remarks}</TableHead>
                  <TableHead className="font-black uppercase text-[10px] text-right">{t.status}</TableHead>
                  <TableHead className="font-black uppercase text-[10px] text-right pr-4">{t.approvedBy}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fyMonthWiseLeaves.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {t.noApprovedLeaves(currentFYInfo.label)}
                    </TableCell>
                  </TableRow>
                ) : (
                  fyMonthWiseLeaves.map((group) => (
                    group.records.map((leave: any, rIdx: number) => (
                      <TableRow key={`${group.monthKey}-${leave.id || leave._id || rIdx}`} className="hover:bg-slate-50/50">
                        <TableCell className="font-bold text-xs text-slate-800 py-3.5">
                          {rIdx === 0 ? (
                            <span className="font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg">
                              {group.monthLabel}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px] italic pl-2">↳ {group.monthLabel}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs font-black text-emerald-700">
                          {rIdx === 0 ? `${group.totalLeaveDays} ${t.leavesUnit}` : `${leave.daysInThisMonth || leave.days} ${t.daysUnit}`}
                        </TableCell>
                        <TableCell className="text-xs font-bold text-slate-600">
                          {formatDate(leave.fromDate)} – {formatDate(leave.toDate)}
                        </TableCell>
                        <TableCell className="text-xs font-bold text-slate-700">
                          {leave.purpose || "Leave"}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-[11px] font-medium text-slate-500 max-w-[180px] truncate" title={leave.remark}>
                          {leave.remark || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 text-[9px] font-black uppercase px-2 py-0.5 whitespace-nowrap">
                            {t.statusApproved}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[10px] font-bold text-slate-600 uppercase font-mono text-right pr-4">
                          {leave.processedByUserId || leave.approvedBy || "Admin"}
                        </TableCell>
                      </TableRow>
                    ))
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* Mark IN Confirmation Pop-up with Location and Distance */}
      <Dialog
        open={activeDialog === "IN"}
        onOpenChange={(o) => {
          if (!o) {
            clearActiveWatch();
            setActiveDialog("NONE");
            setIsLoadingLocation(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-xl rounded-[2.5rem] overflow-hidden p-0 border-none shadow-2xl">
          <DialogHeader className="p-7 bg-slate-900 text-white shrink-0">
            <DialogTitle className="flex items-center gap-2 text-lg font-black uppercase tracking-tight">
              <MapPin className="w-5 h-5 text-primary" /> {t.markInConfirmation}
            </DialogTitle>
          </DialogHeader>
          <div className="p-8 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t.employeeName}</Label>
                <p className="text-sm font-black text-slate-900 uppercase mt-0.5">{effectiveEmployeeName}</p>
              </div>

              <div>
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t.dateAndTime}</Label>
                <p className="text-sm font-bold text-slate-700 mt-0.5">
                  {format(currentTime || getISTTime(), "dd-MMM-yyyy hh:mm:ss a")}
                </p>
              </div>
            </div>

            {/* Current GPS Location / Address */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
              <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2 mb-2">
                <Navigation className="w-3.5 h-3.5" /> {t.currentLocationGps}
              </Label>
              <div className="text-xs font-bold text-slate-700">
                <span className="text-slate-800 whitespace-normal break-words leading-relaxed">
                  {detectedAddress || (
                    <span className="text-slate-400 flex items-center gap-1.5 font-medium italic">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> {t.capturingAddressBounds}
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Attendance Category Selection (if outside registered bounds) */}
            {!detectedPlant && (
              <div className="space-y-2 pt-1">
                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  {t.selectAttendanceMode}
                </Label>
                <RadioGroup value={selectedType} onValueChange={(v: any) => setSelectedType(v)} className="grid grid-cols-2 gap-3">
                  <div
                    className={cn(
                      "p-4 border-2 rounded-2xl cursor-pointer transition-all flex flex-col items-center gap-2",
                      selectedType === 'WFH' ? "border-primary bg-primary/5 shadow-md shadow-primary/5" : "border-slate-200 bg-white hover:border-slate-300"
                    )}
                    onClick={() => setSelectedType('WFH')}
                  >
                    <Home className={cn("w-6 h-6", selectedType === 'WFH' ? "text-primary" : "text-slate-400")} />
                    <span className="font-black text-[10px] uppercase tracking-wider text-slate-800">{t.workFromHome}</span>
                  </div>
                  <div
                    className={cn(
                      "p-4 border-2 rounded-2xl cursor-pointer transition-all flex flex-col items-center gap-2",
                      selectedType === 'FIELD' ? "border-primary bg-primary/5 shadow-md shadow-primary/5" : "border-slate-200 bg-white hover:border-slate-300"
                    )}
                    onClick={() => setSelectedType('FIELD')}
                  >
                    <Briefcase className={cn("w-6 h-6", selectedType === 'FIELD' ? "text-primary" : "text-slate-400")} />
                    <span className="font-black text-[10px] uppercase tracking-wider text-slate-800">{t.fieldWork}</span>
                  </div>
                </RadioGroup>
              </div>
            )}

            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 pt-1 border-t border-slate-100">
              <span>{t.gpsAccuracy}: {gpsAccuracy ? `${gpsAccuracy.toFixed(1)} ${t.metersUnit}` : "N/A"}</span>
              <span>{t.coordinates}: {currentGPS ? `${currentGPS.lat.toFixed(4)}, ${currentGPS.lng.toFixed(4)}` : "N/A"}</span>
            </div>
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t flex flex-row gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-12 font-black rounded-xl text-slate-700 border-slate-300 uppercase tracking-wider text-xs"
              onClick={() => { clearActiveWatch(); setActiveDialog("NONE"); setIsLoadingLocation(false); }}
            >
              {t.cancel}
            </Button>
            <Button
              type="button"
              className="flex-1 h-12 font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg shadow-emerald-600/20 uppercase tracking-wider text-xs"
              onClick={handleConfirmCheckIn}
              disabled={isMutatingAttendance || !detectedAddress || (!detectedPlant && !selectedType)}
            >
              {isMutatingAttendance ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> {t.processing}
                </span>
              ) : t.confirmAndMarkIn}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark OUT Confirmation Pop-up */}
      <Dialog
        open={activeDialog === "OUT"}
        onOpenChange={(o) => {
          if (!o) {
            clearActiveWatch();
            setActiveDialog("NONE");
            setIsLoadingLocation(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-xl rounded-[2.5rem] overflow-hidden p-0 border-none shadow-2xl">
          <DialogHeader className="p-7 bg-rose-600 text-white shrink-0">
            <DialogTitle className="flex items-center gap-2 text-lg font-black uppercase tracking-tight">
              <Navigation className="w-5 h-5" /> {t.markOutConfirmation}
            </DialogTitle>
          </DialogHeader>
          <div className="p-8 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t.employeeName}</Label>
                <p className="text-sm font-black text-slate-900 uppercase mt-0.5">{effectiveEmployeeName}</p>
              </div>

              <div>
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t.dateAndTime}</Label>
                <p className="text-sm font-bold text-slate-700 mt-0.5">
                  {format(currentTime || getISTTime(), "dd-MMM-yyyy hh:mm:ss a")}
                </p>
              </div>
            </div>

            {activeRecord && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center gap-2 font-black text-slate-700 uppercase tracking-wider text-xs">
                <ShieldCheck className="w-4 h-4 text-slate-500" />
                <span>
                  {(() => {
                    const startDT = (activeRecord.inDate && activeRecord.inTime)
                      ? parseDateTime(activeRecord.inDate, activeRecord.inTime)
                      : (activeRecord.date && activeRecord.inTime)
                      ? parseDateTime(activeRecord.date, activeRecord.inTime)
                      : (activeRecord.inDateTime ? parseISO(activeRecord.inDateTime) : null);
                    const dateFormatted = startDT && isValid(startDT) ? format(startDT, "dd-MMM-yyyy") : (activeRecord.inDate || activeRecord.date || format(getISTTime(), "dd-MMM-yyyy"));
                    return t.shiftStarted(dateFormatted, activeRecord.inTime);
                  })()}
                </span>
              </div>
            )}

            {/* Current GPS Location / Address */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
              <Label className="text-[10px] font-black uppercase text-rose-500 tracking-widest flex items-center gap-2 mb-2">
                <MapPin className="w-3.5 h-3.5" /> {t.currentLocationGps}
              </Label>
              <div className="text-xs font-bold text-slate-700">
                <span className="text-slate-800 whitespace-normal break-words leading-relaxed">
                  {detectedAddress || (
                    <span className="text-slate-400 flex items-center gap-1.5 font-medium italic">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> {t.fetchingAddress}
                    </span>
                  )}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 pt-1 border-t border-slate-100">
              <span>{t.gpsAccuracy}: {gpsAccuracy ? `${gpsAccuracy.toFixed(1)} ${t.metersUnit}` : "N/A"}</span>
              <span>{t.coordinates}: {currentGPS ? `${currentGPS.lat.toFixed(4)}, ${currentGPS.lng.toFixed(4)}` : "N/A"}</span>
            </div>
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t flex flex-row gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-12 font-black rounded-xl text-slate-700 border-slate-300 uppercase tracking-wider text-xs"
              onClick={() => { clearActiveWatch(); setActiveDialog("NONE"); setIsLoadingLocation(false); }}
            >
              {t.cancel}
            </Button>
            <Button
              type="button"
              className="flex-1 h-12 font-black bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-lg shadow-rose-600/20 uppercase tracking-wider text-xs"
              onClick={handleConfirmCheckOut}
              disabled={isMutatingAttendance || !canMarkOut}
            >
              {isMutatingAttendance ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> {t.processing}
                </span>
              ) : t.confirmAndMarkOut}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}