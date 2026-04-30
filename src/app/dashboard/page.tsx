
"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { 
  Users, 
  CalendarCheck, 
  AlertCircle, 
  ArrowUpRight, 
  ArrowDownRight,
  UserX,
  X,
  Briefcase,
  Home,
  MapPin,
  Clock,
  Navigation,
  Building2,
  Calendar,
  LayoutDashboard,
  Trophy,
  TrendingDown,
  ChevronRight,
  User as UserIcon,
  Filter,
  ChevronLeft,
  CalendarDays,
  FileText,
  Factory,
  ShieldCheck
} from "lucide-react";
import { useData } from "@/context/data-context";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn, formatDate, formatHoursToHHMM } from "@/lib/utils";
import { format, addHours, parseISO, isValid, isBefore, startOfMonth, setMonth, setYear, isAfter, isSunday, startOfDay, eachDayOfInterval } from "date-fns";

const PRESENT_STATUSES = ['PRESENT', 'HALF_DAY', 'FIELD', 'WFH'];
const PROJECT_START_DATE = new Date(2026, 3, 1); // April 2026

const getISTTime = () => {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function DashboardHome() {
  const { employees, attendanceRecords, vouchers, holidays, leaveRequests, plants, verifiedUser } = useData();
  const [isMounted, setIsMounted] = useState(false);
  const [viewMode, setViewMode] = useState<null | 'present' | 'absent' | 'field' | 'wfh' | 'leave' | 'employees'>(null);
  const [todayStr, setTodayStr] = useState("");
  
  // LIVE MODE: Trigger re-render every 5 minutes
  const [liveUpdateTrigger, setLiveUpdateTrigger] = useState(0);

  // Plant Filter
  const [selectedPlantId, setSelectedPlantId] = useState("all");

  // Leaderboard States
  const [selectedLeaderboardMonth, setSelectedLeaderboardMonth] = useState("");
  const [pickerYear, setPickerYear] = useState(2026);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const now = getISTTime();
    setTodayStr(format(now, 'yyyy-MM-dd'));
    const mmm = now.toLocaleString('en-US', { month: 'short' });
    const yy = now.getFullYear().toString().slice(-2);
    setSelectedLeaderboardMonth(`${mmm}-${yy}`);
    setPickerYear(now.getFullYear());

    // Setup 5-minute interval for live working hour updates
    const interval = setInterval(() => {
      setLiveUpdateTrigger(prev => prev + 1);
    }, 300000); 

    return () => clearInterval(interval);
  }, []);

  const userAssignedPlantIds = useMemo(() => {
    if (!verifiedUser || verifiedUser.role === 'SUPER_ADMIN') return null;
    return verifiedUser.plantIds || [];
  }, [verifiedUser]);

  const authorizedPlants = useMemo(() => {
    if (!userAssignedPlantIds) return plants;
    return plants.filter(p => userAssignedPlantIds.includes(p.id));
  }, [userAssignedPlantIds, plants]);

  const approvedLeavesMap = useMemo(() => {
    const map = new Map<string, boolean>();
    leaveRequests.filter(l => l.status === 'APPROVED').forEach(l => {
      const start = startOfDay(parseISO(l.fromDate));
      const end = startOfDay(parseISO(l.toDate));
      if (!isValid(start) || !isValid(end)) return;
      eachDayOfInterval({ start, end }).forEach(d => {
        map.set(`${l.employeeId}:${format(d, 'yyyy-MM-dd')}`, true);
      });
    });
    return map;
  }, [leaveRequests]);

  const getPriorityStatus = (dateStr: string, record: any, empId: string) => {
    // 1. Leave Check
    if (approvedLeavesMap.has(`${empId}:${dateStr}`)) return "Leave";
    
    const isSun = isSunday(parseISO(dateStr));
    const isCustomHoliday = (holidays || []).some(h => h.date === dateStr);
    const isHoliday = isSun || isCustomHoliday;
    
    // 2. Attendance Check
    if (record && record.inTime) {
      const type = record.attendanceType;
      if (isHoliday) {
        if (type === 'OFFICE') return "Present on Holiday";
        if (type === 'FIELD') return "Field on Holiday";
        if (type === 'WFH') return "Work at Home on Holiday";
        return "Present on Holiday";
      }
      
      if (type === 'OFFICE') return "Present";
      if (type === 'FIELD') return "Field";
      if (type === 'WFH') return "Work at Home";
      return "Present";
    }

    // 3. Absence/Holiday Check
    return isHoliday ? "Holiday" : "Absent";
  };

  const filteredEmployees = useMemo(() => {
    let list = employees.filter(e => e.active);
    
    if (userAssignedPlantIds) {
      list = list.filter(e => (e.unitIds || []).some(id => userAssignedPlantIds.includes(id)) || userAssignedPlantIds.includes(e.unitId));
    }

    if (selectedPlantId !== "all") {
      list = list.filter(e => (e.unitIds || []).includes(selectedPlantId) || e.unitId === selectedPlantId);
    }
    
    return list;
  }, [employees, selectedPlantId, userAssignedPlantIds]);

  const stats = useMemo(() => {
    if (!isMounted || !todayStr) return { totalEmployees: 0, presentToday: 0, absentToday: 0, fieldWorkToday: 0, wfhToday: 0, pendingApprovals: 0, attendancePct: "0", pendingLeaves: 0 };
    
    const now = getISTTime();
    const activeEmployees = filteredEmployees;
    const activeEmpIds = new Set(activeEmployees.map(e => e.employeeId));
    
    const todayLogs = attendanceRecords.filter(r => {
      if (r.date !== todayStr) return false;
      if (!activeEmpIds.has(r.employeeId)) return false;
      if (!r.outTime) {
        if (!r.inTime || r.inTime.trim() === "") return false;
        const inDT = new Date(`${r.inDate || r.date}T${r.inTime}`);
        if (!isValid(inDT)) return false;
        const diff = (now.getTime() - inDT.getTime()) / (1000 * 60 * 60);
        if (diff >= 16) return false;
      }
      return true;
    });
    
    const presentToday = todayLogs.filter(r => PRESENT_STATUSES.includes(r.status));
    const fieldWorkToday = presentToday.filter(r => r.attendanceType === 'FIELD');
    const wfhToday = presentToday.filter(r => r.attendanceType === 'WFH');
    
    const absentToday = Math.max(0, activeEmployees.length - presentToday.length);
    
    const pendingApprovals = attendanceRecords.filter(r => {
      if (r.approved) return false;
      if (!activeEmpIds.has(r.employeeId)) return false;
      return true;
    }).length;

    const pendingLeaves = (leaveRequests || []).filter(l => {
      if (l.status !== 'UNDER_PROCESS') return false;
      if (!activeEmpIds.has(l.employeeId)) return false;
      return true;
    }).length;

    return {
      totalEmployees: activeEmployees.length,
      presentToday: presentToday.length,
      absentToday: absentToday,
      fieldWorkToday: fieldWorkToday.length,
      wfhToday: wfhToday.length,
      pendingApprovals: pendingApprovals,
      pendingLeaves: pendingLeaves,
      attendancePct: activeEmployees.length > 0 ? ((presentToday.length / activeEmployees.length) * 100).toFixed(1) : "0"
    };
  }, [filteredEmployees, attendanceRecords, isMounted, todayStr, leaveRequests, liveUpdateTrigger]);

  const leaderboardData = useMemo(() => {
    if (!isMounted || !selectedLeaderboardMonth || !filteredEmployees.length) return { top: [], bottom: [] };
    const [mmm, yy] = selectedLeaderboardMonth.split('-');
    const mIndex = MONTHS.indexOf(mmm);
    const year = 2000 + parseInt(yy);
    const hourMap: Record<string, number> = {};
    const activeEmpIds = new Set(filteredEmployees.map(e => e.employeeId));

    attendanceRecords.forEach(r => {
      if (!activeEmpIds.has(r.employeeId)) return;
      const d = parseISO(r.date);
      if (isValid(d) && d.getMonth() === mIndex && d.getFullYear() === year) {
        hourMap[r.employeeId] = (hourMap[r.employeeId] || 0) + (r.hours || 0);
      }
    });

    const activeList = filteredEmployees.map(e => ({
      name: e.name, id: e.employeeId, dept: e.department, desig: e.designation, hours: hourMap[e.employeeId] || 0
    }));

    const sorted = [...activeList].sort((a, b) => b.hours - a.hours);
    return { 
      top: sorted.slice(0, 3), 
      bottom: [...activeList].sort((a, b) => a.hours - b.hours).slice(0, 3) 
    };
  }, [attendanceRecords, filteredEmployees, selectedLeaderboardMonth, isMounted]);

  const getCategorizedData = (type?: 'FIELD' | 'WFH' | 'PRESENT') => {
    if (!isMounted || !todayStr) return [];
    const now = getISTTime();
    const activeEmpIds = new Set(filteredEmployees.map(e => e.employeeId));

    return attendanceRecords
      .filter(r => {
        if (r.date !== todayStr || !PRESENT_STATUSES.includes(r.status)) return false;
        if (!activeEmpIds.has(r.employeeId)) return false;
        if (type === 'FIELD') return r.attendanceType === 'FIELD';
        if (type === 'WFH') return r.attendanceType === 'WFH';
        return true; 
      })
      .map(rec => {
        const emp = filteredEmployees.find(e => e.employeeId === rec.employeeId);
        const displayStatus = getPriorityStatus(rec.date, rec, rec.employeeId);
        let processed = { ...rec, dept: emp?.department || "N/A", desig: emp?.designation || "N/A", displayStatus };
        
        if (!rec.outTime && rec.inTime && rec.inTime.trim() !== "") {
          const inDT = new Date(`${rec.inDate || rec.date}T${rec.inTime}`);
          if (isValid(inDT)) {
             const diff = (now.getTime() - inDT.getTime()) / (1000 * 60 * 60);
             if (diff >= 16) {
                const autoOutDT = addHours(inDT, 16);
                processed = { ...processed, outTime: format(autoOutDT, "HH:mm"), outDate: format(autoOutDT, "yyyy-MM-dd"), hours: 8, autoCheckout: true };
             } else {
                // LIVE MODE CALCULATION
                processed.hours = parseFloat(diff.toFixed(2));
             }
          }
        }
        return processed;
      });
  };

  if (!isMounted) return null;

  if (viewMode === 'employees') {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="rounded-3xl border-none shadow-2xl overflow-hidden bg-white flex flex-col min-h-[calc(100vh-140px)]">
          <div className="p-8 bg-slate-900 text-white shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center"><Users className="w-7 h-7 text-primary" /></div>
              <div><h2 className="text-2xl font-black uppercase">Active Staff Registry</h2><p className="text-slate-400 font-bold text-xs uppercase tracking-widest">{selectedPlantId === 'all' ? 'Total Registered Workforce' : 'Facility Scoped Registry'}</p></div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setViewMode(null)} className="text-white"><X className="w-6 h-6" /></Button>
          </div>
          <ScrollArea className="flex-1 bg-white">
            <Table className="min-w-[1000px]">
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="px-8 py-5 font-black uppercase text-[11px] tracking-widest text-slate-500">Employee Name</TableHead>
                  <TableHead className="font-black uppercase text-[11px] tracking-widest text-slate-500">Department</TableHead>
                  <TableHead className="font-black uppercase text-[11px] tracking-widest text-slate-500">Designation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((emp, idx) => (
                  <TableRow key={idx} className="hover:bg-slate-50 transition-colors">
                    <TableCell className="px-8 py-6">
                      <div className="flex flex-col">
                        <span className="font-black text-slate-900 uppercase text-sm">{emp.name}</span>
                        <span className="text-[10px] font-mono text-primary font-black uppercase tracking-tight">{emp.employeeId}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-bold text-slate-700 uppercase tracking-tight">{emp.department}</TableCell>
                    <TableCell className="text-xs font-bold text-slate-600 uppercase tracking-tight">{emp.designation}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      </div>
    );
  }

  if (viewMode === 'absent') {
    const absentData = filteredEmployees.filter(e => !attendanceRecords.some(r => r.employeeId === e.employeeId && r.date === todayStr)).map(e => ({ ...e, displayStatus: getPriorityStatus(todayStr, null, e.employeeId) }));
    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="rounded-3xl border-none shadow-2xl overflow-hidden bg-white flex flex-col min-h-[calc(100vh-140px)]">
          <div className="p-8 bg-slate-900 text-white shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 flex items-center justify-center"><UserX className="w-7 h-7 text-rose-500" /></div>
              <div><h2 className="text-2xl font-black">Attendance Exceptions</h2><p className="text-slate-400 font-bold text-xs uppercase tracking-widest">{formatDate(todayStr)}</p></div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setViewMode(null)} className="text-white"><X className="w-6 h-6" /></Button>
          </div>
          <ScrollArea className="flex-1 bg-white">
            <Table><TableHeader className="bg-slate-50"><TableRow><TableHead className="px-8 py-5">Employee Name</TableHead><TableHead>Department</TableHead><TableHead>Designation</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>{absentData.map((rec, idx) => (
              <TableRow key={idx}>
                <TableCell className="px-8 py-6 font-bold">{rec.name}</TableCell>
                <TableCell>{rec.department}</TableCell>
                <TableCell>{rec.designation}</TableCell>
                <TableCell>
                  <Badge className={cn(
                    "text-[9px] font-black uppercase px-3 py-1 transition-all duration-300", 
                    rec.displayStatus === 'Present' && "bg-emerald-500 text-white border-none shadow-sm",
                    rec.displayStatus === 'Absent' && "bg-rose-500 text-white border-none shadow-sm",
                    rec.displayStatus === 'Field' && "bg-amber-400 text-black border-none shadow-sm",
                    rec.displayStatus === 'Work at Home' && "bg-orange-500 text-white border-none shadow-sm",
                    rec.displayStatus === 'Leave' && "bg-purple-500 text-white border-none shadow-sm",
                    rec.displayStatus === 'Present on Holiday' && "bg-gradient-to-r from-sky-200 to-emerald-500 text-white border-none shadow-sm",
                    rec.displayStatus === 'Field on Holiday' && "bg-gradient-to-r from-sky-200 to-amber-400 text-white border-none shadow-sm",
                    rec.displayStatus === 'Work at Home on Holiday' && "bg-gradient-to-r from-sky-200 to-orange-500 text-white border-none shadow-sm",
                    rec.displayStatus === 'Holiday' && "bg-transparent text-slate-400 border-slate-200 shadow-none font-bold"
                  )}>
                    {rec.displayStatus}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}</TableBody></Table>
          </ScrollArea>
        </div>
      </div>
    );
  }

  if (viewMode === 'leave') {
    const activeEmpIds = new Set(filteredEmployees.map(e => e.employeeId));
    const pendingLeaves = (leaveRequests || []).filter(l => l.status === 'UNDER_PROCESS' && activeEmpIds.has(l.employeeId));
    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="rounded-3xl border-none shadow-2xl overflow-hidden bg-white flex flex-col min-h-[calc(100vh-140px)]">
          <div className="p-8 bg-slate-900 text-white shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center"><FileText className="w-7 h-7 text-primary" /></div>
              <div><h2 className="text-2xl font-black uppercase">Pending Leave Requests</h2><p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Awaiting Management Decision</p></div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setViewMode(null)} className="text-white"><X className="w-6 h-6" /></Button>
          </div>
          <ScrollArea className="flex-1 bg-white">
            <Table className="min-w-[1200px]">
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="px-8 py-5 font-black uppercase text-[11px] tracking-widest">Employee Name</TableHead>
                  <TableHead className="font-black uppercase text-[11px] tracking-widest">Department / Designation</TableHead>
                  <TableHead className="font-black uppercase text-[11px] tracking-widest">Plant</TableHead>
                  <TableHead className="font-black uppercase text-[11px] tracking-widest">Leave From</TableHead>
                  <TableHead className="font-black uppercase text-[11px] tracking-widest">Leave To</TableHead>
                  <TableHead className="text-center font-black uppercase text-[11px] tracking-widest">Days</TableHead>
                  <TableHead className="pr-8 font-black uppercase text-[11px] tracking-widest">Purpose</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingLeaves.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-20 text-muted-foreground font-bold">No pending requests found.</TableCell></TableRow>
                ) : (
                  pendingLeaves.map((l, idx) => (
                    <TableRow key={idx} className="hover:bg-slate-50 transition-colors">
                      <TableCell className="px-8 py-6">
                        <div className="flex flex-col">
                          <span className="font-black text-slate-900 uppercase text-sm">{l.employeeName}</span>
                          <span className="text-[10px] font-mono text-primary font-black uppercase">{l.employeeId}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-700">{l.department}</span>
                          <span className="text-[9px] text-muted-foreground uppercase">{l.designation}</span>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="bg-slate-50 text-slate-700 text-[10px] font-black">{l.plantName}</Badge></TableCell>
                      <TableCell className="text-xs font-bold">{formatDate(l.fromDate)}</TableCell>
                      <TableCell className="text-xs font-bold">{formatDate(l.toDate)}</TableCell>
                      <TableCell className="text-center"><Badge className="bg-primary/10 text-primary border-none font-black">{l.days}</Badge></TableCell>
                      <TableCell className="pr-8 text-xs font-medium text-slate-500 max-w-[250px] truncate" title={l.purpose}>{l.purpose}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      </div>
    );
  }

  if (viewMode) {
    const data = getCategorizedData(viewMode === 'present' ? 'PRESENT' : viewMode.toUpperCase() as any);
    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="rounded-3xl border-none shadow-2xl overflow-hidden bg-white flex flex-col min-h-[calc(100vh-140px)]">
          <div className="p-8 bg-slate-900 text-white flex items-center justify-between">
            <h2 className="text-2xl font-black uppercase">
              {viewMode === 'present' ? 'Present Logs Today' : 
               viewMode === 'field' ? 'Field Logs Today' : 
               viewMode === 'wfh' ? 'wfh Logs Today' : 
               `${viewMode} Logs Today`}
            </h2>
            <Button variant="ghost" size="icon" onClick={() => setViewMode(null)} className="text-white"><X className="w-6 h-6" /></Button>
          </div>
          <ScrollArea className="flex-1 bg-white">
            <Table className="min-w-[1200px]"><TableHeader className="bg-slate-50"><TableRow><TableHead className="px-8">Employee Name</TableHead><TableHead>Dept/Desig</TableHead><TableHead>Log Time</TableHead><TableHead>Working Hour</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>{data.map((rec, idx) => (
              <TableRow key={idx}>
                <TableCell className="px-8 py-6 font-bold">{rec.employeeName}</TableCell>
                <TableCell>{rec.dept} / {rec.desig}</TableCell>
                <TableCell className="font-mono text-xs">{rec.inTime} - {rec.outTime || 'Live'}</TableCell>
                <TableCell className="text-center font-bold">{formatHoursToHHMM(rec.hours)}</TableCell>
                <TableCell>
                  <Badge className={cn(
                    "text-[9px] font-black uppercase px-3 py-1 transition-all duration-300", 
                    rec.displayStatus === 'Present' && "bg-emerald-500 text-white border-none shadow-sm",
                    rec.displayStatus === 'Absent' && "bg-rose-500 text-white border-none shadow-sm",
                    rec.displayStatus === 'Field' && "bg-amber-400 text-black border-none shadow-sm",
                    rec.displayStatus === 'Work at Home' && "bg-orange-500 text-white border-none shadow-sm",
                    rec.displayStatus === 'Leave' && "bg-purple-500 text-white border-none shadow-sm",
                    rec.displayStatus === 'Present on Holiday' && "bg-gradient-to-r from-sky-200 to-emerald-500 text-white border-none shadow-sm",
                    rec.displayStatus === 'Field on Holiday' && "bg-gradient-to-r from-sky-200 to-amber-400 text-white border-none shadow-sm",
                    rec.displayStatus === 'Work at Home on Holiday' && "bg-gradient-to-r from-sky-200 to-orange-500 text-white border-none shadow-sm",
                    rec.displayStatus === 'Holiday' && "bg-transparent text-slate-400 border-slate-200 shadow-none font-bold"
                  )}>
                    {rec.displayStatus}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}</TableBody></Table>
          </ScrollArea>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border shadow-sm mb-6">
        <div>
           <h1 className="text-2xl font-black text-slate-900 flex items-center gap-3">
              <LayoutDashboard className="w-7 h-7 text-primary" /> Executive Overview
           </h1>
           <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest mt-1">Real-time Performance Metrics</p>
        </div>
        <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-100">
           <Factory className="w-4 h-4 text-primary ml-2" />
           <Select value={selectedPlantId} onValueChange={setSelectedPlantId}>
              <SelectTrigger className="h-9 w-[220px] border-none font-black text-xs uppercase focus:ring-0 bg-transparent">
                 <SelectValue placeholder="All Authorized Plants" />
              </SelectTrigger>
              <SelectContent>
                 <SelectItem value="all" className="font-bold text-xs uppercase">All Authorized Plants</SelectItem>
                 {authorizedPlants.map(p => (
                   <SelectItem key={p.id} value={p.id} className="font-bold text-xs uppercase">{p.name}</SelectItem>
                 ))}
              </SelectContent>
           </Select>
        </div>
      </div>

      {/* Primary Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard 
          title="Total Employees" 
          value={stats.totalEmployees} 
          icon={Users} 
          description="Active workforce headcount" 
          onClick={() => setViewMode('employees')}
        />
        <StatCard 
          title="Present Today" 
          value={stats.presentToday} 
          icon={CalendarCheck} 
          trend={`${stats.attendancePct}%`} 
          trendUp={true} 
          description="Clocked-in attendance" 
          onClick={() => setViewMode('present')} 
        />
        <StatCard 
          title="Absent Today" 
          value={stats.absentToday} 
          icon={UserX} 
          description="Unmarked staff exception" 
          onClick={() => setViewMode('absent')} 
        />
      </div>

      {/* Missing Widgets Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Field Work Today" value={stats.fieldWorkToday} icon={Briefcase} description="Authorized on-site logs" onClick={() => setViewMode('field')} />
        <StatCard title="Work at Home" value={stats.wfhToday} icon={Home} description="Remote authorized shifts" onClick={() => setViewMode('wfh')} />
        <StatCard title="Leave Requests" value={stats.pendingLeaves} icon={FileText} description="Awaiting HR approval" onClick={() => setViewMode('leave')} />
      </div>

      <div className="space-y-6 mt-10">
        <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-6 rounded-3xl border shadow-sm gap-4">
          <div className="flex items-center gap-3">
             <Trophy className="w-6 h-6 text-amber-500" />
             <h3 className="text-xl font-black">Facility Efficiency Metrics</h3>
          </div>
          <div className="flex items-center gap-3">
             <Label className="text-[10px] font-black uppercase text-slate-400">Analysis Month</Label>
             <Popover open={isPickerOpen} onOpenChange={setIsPickerOpen}>
                <PopoverTrigger asChild><Button variant="outline" className="h-11 font-black rounded-xl px-6">{selectedLeaderboardMonth}</Button></PopoverTrigger>
                <PopoverContent className="w-72 p-0 rounded-2xl overflow-hidden border-none shadow-2xl" align="end">
                   <div className="p-4 bg-slate-900 text-white flex justify-between items-center"><Button variant="ghost" size="icon" onClick={() => setPickerYear(p => p - 1)} disabled={pickerYear <= 2026} className="h-8 w-8 text-white"><ChevronLeft className="w-4 h-4"/></Button><span className="font-black">{pickerYear}</span><Button variant="ghost" size="icon" onClick={() => setPickerYear(p => p + 1)} disabled={pickerYear >= getISTTime().getFullYear()} className="h-8 w-8 text-white"><ChevronRight className="w-4 h-4"/></Button></div>
                   <div className="p-4 grid grid-cols-3 gap-2 bg-white">{MONTHS.map((m, idx) => {
                      const sel = selectedLeaderboardMonth === `${m}-${pickerYear.toString().slice(-2)}`;
                      const d = new Date(pickerYear, idx, 1);
                      const future = isAfter(d, startOfMonth(getISTTime()));
                      const pre = isBefore(d, startOfMonth(PROJECT_START_DATE));
                      return <Button key={m} variant={sel ? "default" : "ghost"} disabled={future || pre} onClick={() => { setSelectedLeaderboardMonth(`${m}-${pickerYear.toString().slice(-2)}`); setIsPickerOpen(false); }} className={cn("h-11 font-bold rounded-lg", sel && "bg-primary")}>{m}</Button>;
                   })}</div>
                </PopoverContent>
             </Popover>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="rounded-[32px] overflow-hidden shadow-xl border-none"><CardHeader className="bg-emerald-50 py-6"><CardTitle className="text-lg font-black text-emerald-900 flex items-center gap-2"><ShieldCheck className="w-5 h-5" /> TOP PERFORMANCE</CardTitle></CardHeader>
          <CardContent className="p-0 divide-y">{leaderboardData.top.map((e, idx) => (
            <div key={idx} className="p-6 flex justify-between items-center hover:bg-slate-50 transition-colors"><div className="flex items-center gap-4"><div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center font-black text-emerald-600 shadow-sm border border-emerald-200">{idx+1}</div><div><p className="font-black uppercase text-sm tracking-tight">{e.name}</p><p className="text-[10px] text-muted-foreground font-bold">{e.dept} • {e.desig}</p></div></div><p className="text-xl font-black text-emerald-600 font-mono">{formatHoursToHHMM(e.hours)}</p></div>
          ))}</CardContent></Card>
          
          <Card className="rounded-[32px] overflow-hidden shadow-xl border-none"><CardHeader className="bg-rose-50 py-6"><CardTitle className="text-lg font-black text-rose-900 flex items-center gap-2"><AlertCircle className="w-5 h-5" /> ATTENTION REQUIRED</CardTitle></CardHeader>
          <CardContent className="p-0 divide-y">{leaderboardData.bottom.map((e, idx) => (
            <div key={idx} className="p-6 flex justify-between items-center hover:bg-slate-50 transition-colors"><div className="flex items-center gap-4"><div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center font-black text-rose-600 shadow-sm border border-rose-200">{idx+1}</div><div><p className="font-black uppercase text-sm tracking-tight">{e.name}</p><p className="text-[10px] text-muted-foreground font-bold">{e.dept} • {e.desig}</p></div></div><p className="text-xl font-black text-rose-600 font-mono">{formatHoursToHHMM(e.hours)}</p></div>
          ))}</CardContent></Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, trend, trendUp, description, onClick }: any) {
  return (
    <Card 
      className={cn(
        "shadow-sm cursor-pointer hover:shadow-md transition-all border-slate-100 relative group overflow-hidden rounded-[2rem]",
        onClick && "hover:border-primary/20 active:scale-[0.98]"
      )} 
      onClick={onClick}
    >
      <CardContent className="p-7 flex justify-between items-center">
        <div className="space-y-1.5">
          <div>
            <div className="flex items-center gap-2">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
               {trend && (
                 <Badge className={cn("text-[9px] font-black px-1.5 py-0", trendUp ? "bg-emerald-500" : "bg-rose-500")}>
                   {trend}
                 </Badge>
               )}
            </div>
            <h3 className="text-4xl font-black mt-1 text-slate-900 tracking-tighter">{value}</h3>
          </div>
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight flex items-center gap-1.5">
             <div className="w-1 h-1 rounded-full bg-primary" /> {description}
          </p>
        </div>
        <div className="p-5 rounded-3xl bg-slate-50 group-hover:bg-primary/10 transition-colors shadow-inner border border-slate-100/50">
          <Icon className="w-7 h-7 text-slate-400 group-hover:text-primary transition-colors" />
        </div>
      </CardContent>
      <div className="absolute bottom-0 left-0 h-1 w-0 bg-primary group-hover:w-full transition-all duration-500" />
    </Card>
  );
}
