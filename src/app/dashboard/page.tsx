
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
  ShieldCheck,
  PlaneTakeoff,
  FileSpreadsheet,
  Download
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
const PROJECT_START_DATE = new Date(2026, 3, 1); 

const getISTTime = () => {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function DashboardHome() {
  const { employees, attendanceRecords, vouchers, holidays, leaveRequests, plants, verifiedUser } = useData();
  const [isMounted, setIsMounted] = useState(false);
  const [viewMode, setViewMode] = useState<null | 'present' | 'absent' | 'leave' | 'employees'>(null);
  const [todayStr, setTodayStr] = useState("");
  
  const [liveUpdateTrigger, setLiveUpdateTrigger] = useState(0);
  const [selectedPlantId, setSelectedPlantId] = useState("all");
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
    const isSun = isSunday(parseISO(dateStr));
    const customHoliday = (holidays || []).find(h => h.date === dateStr && !h.auto);
    const isApprovedLeave = approvedLeavesMap.has(`${empId}:${dateStr}`);

    if (record && record.inTime) {
      if (isSun) return "Present on Weekly Off";
      if (customHoliday) return "Present on Holiday";
      return "Present";
    }

    if (isApprovedLeave) return "Absent on Leave";
    if (isSun) return "Weekly Off";
    if (customHoliday) return "Holiday";

    return "Absent";
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
    if (!isMounted || !todayStr) return { totalEmployees: 0, presentToday: 0, absentToday: 0, leaveToday: 0, attendancePct: "0" };
    
    const now = getISTTime();
    const activeEmployees = filteredEmployees;
    const activeEmpIds = new Set(activeEmployees.map(e => e.employeeId));
    
    const todayLogs = attendanceRecords.filter(r => {
      if (r.date !== todayStr) return false;
      if (!activeEmpIds.has(r.employeeId)) return false;
      return true;
    });
    
    const presentToday = todayLogs.filter(r => PRESENT_STATUSES.includes(r.status));
    const leaveToday = activeEmployees.filter(e => !todayLogs.some(r => r.employeeId === e.employeeId) && approvedLeavesMap.has(`${e.employeeId}:${todayStr}`)).length;
    const absentToday = Math.max(0, activeEmployees.length - presentToday.length - leaveToday);
    
    return {
      totalEmployees: activeEmployees.length,
      presentToday: presentToday.length,
      absentToday: absentToday,
      leaveToday: leaveToday,
      attendancePct: activeEmployees.length > 0 ? ((presentToday.length / activeEmployees.length) * 100).toFixed(1) : "0"
    };
  }, [filteredEmployees, attendanceRecords, isMounted, todayStr, leaveRequests, approvedLeavesMap, liveUpdateTrigger]);

  const getCategorizedData = () => {
    if (!isMounted || !todayStr) return [];
    const now = getISTTime();
    const activeEmpIds = new Set(filteredEmployees.map(e => e.employeeId));

    if (viewMode === 'employees') {
      return filteredEmployees.map(e => ({ name: e.name, employeeId: e.employeeId, dept: e.department, desig: e.designation }));
    }

    if (viewMode === 'present') {
      return attendanceRecords.filter(r => r.date === todayStr && activeEmpIds.has(r.employeeId))
        .map(r => {
          const emp = filteredEmployees.find(e => e.employeeId === r.employeeId);
          return { ...r, dept: emp?.department, desig: emp?.designation, displayStatus: getPriorityStatus(r.date, r, r.employeeId) };
        });
    }

    if (viewMode === 'leave') {
      return filteredEmployees.filter(e => !attendanceRecords.some(r => r.employeeId === e.employeeId && r.date === todayStr) && approvedLeavesMap.has(`${e.employeeId}:${todayStr}`))
        .map(e => ({ name: e.name, employeeId: e.employeeId, dept: e.department, desig: e.designation, displayStatus: "Absent on Leave" }));
    }

    if (viewMode === 'absent') {
      return filteredEmployees.filter(e => !attendanceRecords.some(r => r.employeeId === e.employeeId && r.date === todayStr) && !approvedLeavesMap.has(`${e.employeeId}:${todayStr}`))
        .map(e => ({ name: e.name, employeeId: e.employeeId, dept: e.department, desig: e.designation, displayStatus: "Absent" }));
    }

    return [];
  };

  const handleExportData = () => {
    const data = getCategorizedData();
    if (!data.length) return;
    
    const headers = ["Employee ID", "Employee Name", "Department", "Designation", "In Date time", "Status"];
    const rows = data.map((rec: any) => [
      `"${rec.employeeId}"`,
      `"${rec.name || rec.employeeName}"`,
      `"${rec.dept}"`,
      `"${rec.desig}"`,
      rec.inTime ? `"${formatDate(rec.inDate || rec.date)} ${rec.inTime}"` : `"--"`,
      `"${rec.displayStatus || "REGISTERED"}"`
    ]);

    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${viewMode}_report_${todayStr}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderCategorizedView = () => {
    const data = getCategorizedData();
    const titleMap = {
      'employees': 'Total Workforce',
      'present': 'Present Logs Today',
      'absent': 'Absent Exceptions Today',
      'leave': 'Staff on Approved Leave'
    };

    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="rounded-3xl border-none shadow-2xl overflow-hidden bg-white flex flex-col min-h-[calc(100vh-140px)]">
          <div className="p-8 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-4">
               <h2 className="text-2xl font-black uppercase">{titleMap[viewMode!]}</h2>
               <Badge className="bg-primary/20 text-primary border-primary/30 font-black">{data.length} Count</Badge>
            </div>
            <div className="flex items-center gap-3">
               <Button onClick={handleExportData} className="h-10 bg-emerald-600 hover:bg-emerald-700 font-black text-xs uppercase gap-2 shadow-lg shadow-emerald-900/20">
                  <Download className="w-4 h-4" /> Export Data
               </Button>
               <Button variant="ghost" size="icon" onClick={() => setViewMode(null)} className="text-white"><X className="w-6 h-6" /></Button>
            </div>
          </div>
          <ScrollArea className="flex-1 bg-white">
            <Table className="min-w-[1200px]">
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="px-8 py-5 font-black text-[11px] uppercase tracking-widest text-slate-500">Employee Name</TableHead>
                  <TableHead className="font-black text-[11px] uppercase tracking-widest text-slate-500">Dept/Desig</TableHead>
                  <TableHead className="font-black text-[11px] uppercase tracking-widest text-slate-500">In Date time</TableHead>
                  <TableHead className="font-black text-[11px] uppercase tracking-widest text-slate-500 text-right pr-8">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-20 text-muted-foreground font-bold italic">No records available for this category.</TableCell></TableRow>
                ) : (
                  data.map((rec: any, idx: number) => (
                    <TableRow key={idx} className="hover:bg-slate-50 transition-colors">
                      <TableCell className="px-8 py-6">
                        <div className="flex flex-col">
                          <span className="font-bold uppercase text-sm text-slate-900">{rec.name || rec.employeeName}</span>
                          <span className="text-[10px] font-mono text-primary font-black uppercase">{rec.employeeId}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                         <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-700">{rec.dept}</span>
                            <span className="text-[10px] text-muted-foreground uppercase font-medium">{rec.desig}</span>
                         </div>
                      </TableCell>
                      <TableCell className="text-xs font-bold text-slate-600">
                        {rec.inTime ? (
                          <div className="flex items-center gap-2">
                             <Clock className="w-3.5 h-3.5 text-primary" />
                             <span>{formatDate(rec.inDate || rec.date)} {rec.inTime}</span>
                          </div>
                        ) : "--"}
                      </TableCell>
                      <TableCell className="text-right pr-8">
                        {rec.displayStatus ? (
                          <Badge className={cn(
                            "text-[9px] font-black uppercase px-3 py-1", 
                            rec.displayStatus === 'Present' && "bg-emerald-500 text-white border-none",
                            rec.displayStatus === 'Absent' && "bg-rose-500 text-white border-none",
                            rec.displayStatus === 'Absent on Leave' && "bg-purple-500 text-white border-none",
                            rec.displayStatus.includes('Weekly Off') && "bg-gradient-to-r from-sky-400 to-emerald-500 text-white border-none",
                            rec.displayStatus.includes('Holiday') && "bg-gradient-to-r from-sky-400 to-emerald-500 text-white border-none"
                          )}>
                            {rec.displayStatus}
                          </Badge>
                        ) : <Badge className="bg-slate-100 text-slate-400 font-black text-[9px] uppercase">REGISTERED</Badge>}
                      </TableCell>
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
  };

  if (viewMode) return renderCategorizedView();

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-6 rounded-3xl border shadow-sm gap-4">
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
                 <SelectValue />
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Staff" value={stats.totalEmployees} icon={Users} description="Active headcount" onClick={() => setViewMode('employees')} />
        <StatCard title="Present" value={stats.presentToday} icon={CalendarCheck} trend={`${stats.attendancePct}%`} trendUp={true} description="Clocked-in logs" onClick={() => setViewMode('present')} />
        <StatCard title="On Leave" value={stats.leaveToday} icon={PlaneTakeoff} description="Authorized absence" onClick={() => setViewMode('leave')} />
        <StatCard title="Absent" value={stats.absentToday} icon={UserX} description="Unmarked exception" onClick={() => setViewMode('absent')} />
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, trend, trendUp, description, onClick }: any) {
  return (
    <Card className="shadow-sm cursor-pointer hover:shadow-md transition-all border-slate-100 group overflow-hidden rounded-[2rem]" onClick={onClick}>
      <CardContent className="p-7 flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
             {trend && <Badge className="text-[9px] font-black bg-emerald-500">{trend}</Badge>}
          </div>
          <h3 className="text-4xl font-black mt-1 text-slate-900 tracking-tighter">{value}</h3>
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight mt-1 flex items-center gap-1.5">
             <div className="w-1 h-1 rounded-full bg-primary" /> {description}
          </p>
        </div>
        <div className="p-5 rounded-3xl bg-slate-50 group-hover:bg-primary/10 transition-colors">
          <Icon className="w-7 h-7 text-slate-400 group-hover:text-primary" />
        </div>
      </CardContent>
    </Card>
  );
}
