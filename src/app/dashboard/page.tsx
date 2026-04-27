
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
  FileText
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
import { cn, formatDate, formatHoursToHHMM } from "@/lib/utils";
import { format, addHours, parseISO, isValid, isBefore, startOfMonth, setMonth, setYear, isAfter, isSunday } from "date-fns";

const PRESENT_STATUSES = ['PRESENT', 'HALF_DAY', 'FIELD', 'WFH'];
const PROJECT_START_DATE = new Date(2026, 3, 1); // April 2026

const getISTTime = () => {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function DashboardHome() {
  const { employees, attendanceRecords, vouchers, holidays, leaveRequests } = useData();
  const [isMounted, setIsMounted] = useState(false);
  const [viewMode, setViewMode] = useState<null | 'present' | 'absent' | 'field' | 'wfh' | 'leave'>(null);
  const [todayStr, setTodayStr] = useState("");
  
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
  }, []);

  const getPriorityStatus = (dateStr: string, record: any) => {
    const isSun = isSunday(parseISO(dateStr));
    const holiday = (holidays || []).find(h => h.date === dateStr);
    
    if (record) {
      if (holiday) return "Present on Holiday";
      if (isSun) return "Present on Weekly Off";
      return record.autoCheckout ? "System Auto OUT" : record.status;
    } else {
      if (holiday) return `Holiday (${holiday.name})`;
      if (isSun) return "Weekly Off";
      return "Absent";
    }
  };

  const stats = useMemo(() => {
    if (!isMounted || !todayStr) return { totalEmployees: 0, presentToday: 0, absentToday: 0, fieldWorkToday: 0, wfhToday: 0, pendingApprovals: 0, attendancePct: "0", pendingLeaves: 0 };
    
    const now = getISTTime();
    const activeEmployees = employees.filter(e => e.active);
    
    const todayLogs = attendanceRecords.filter(r => {
      if (r.date !== todayStr) return false;
      if (!r.outTime) {
        // FIX: Only consider active records that have an inTime. 
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
    const pendingApprovals = attendanceRecords.filter(r => !r.approved).length + vouchers.filter(v => v.status === 'PENDING').length;
    const pendingLeaves = (leaveRequests || []).filter(l => l.status === 'UNDER_PROCESS').length;

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
  }, [employees, attendanceRecords, vouchers, isMounted, todayStr, leaveRequests]);

  const leaderboardData = useMemo(() => {
    if (!isMounted || !selectedLeaderboardMonth || !employees.length) return { top: [], bottom: [] };
    const [mmm, yy] = selectedLeaderboardMonth.split('-');
    const mIndex = MONTHS.indexOf(mmm);
    const year = 2000 + parseInt(yy);
    const hourMap: Record<string, number> = {};

    attendanceRecords.forEach(r => {
      const d = parseISO(r.date);
      if (isValid(d) && d.getMonth() === mIndex && d.getFullYear() === year) {
        hourMap[r.employeeId] = (hourMap[r.employeeId] || 0) + (r.hours || 0);
      }
    });

    const activeList = employees.filter(e => e.active).map(e => ({
      name: e.name, id: e.employeeId, dept: e.department, desig: e.designation, hours: hourMap[e.employeeId] || 0
    }));

    const sorted = [...activeList].sort((a, b) => b.hours - a.hours);
    return { top: sorted.slice(0, 3), bottom: [...activeList].sort((a, b) => a.hours - b.hours).slice(0, 3) };
  }, [attendanceRecords, employees, selectedLeaderboardMonth, isMounted]);

  const getCategorizedData = (type?: 'FIELD' | 'WFH' | 'PRESENT') => {
    if (!isMounted || !todayStr) return [];
    const now = getISTTime();

    return attendanceRecords
      .filter(r => {
        if (r.date !== todayStr || !PRESENT_STATUSES.includes(r.status)) return false;
        if (type === 'FIELD') return r.attendanceType === 'FIELD';
        if (type === 'WFH') return r.attendanceType === 'WFH';
        return true; 
      })
      .map(rec => {
        const emp = employees.find(e => e.employeeId === rec.employeeId);
        const displayStatus = getPriorityStatus(rec.date, rec);
        let processed = { ...rec, dept: emp?.department || "N/A", desig: emp?.designation || "N/A", displayStatus };
        
        // FIX: Only trigger auto-out if inTime exists.
        if (!rec.outTime && rec.inTime && rec.inTime.trim() !== "") {
          const inDT = new Date(`${rec.inDate || rec.date}T${rec.inTime}`);
          if (isValid(inDT) && (now.getTime() - inDT.getTime()) / (1000 * 60 * 60) >= 16) {
            const autoOutDT = addHours(inDT, 16);
            processed = { ...processed, outTime: format(autoOutDT, "HH:mm"), outDate: format(autoOutDT, "yyyy-MM-dd"), hours: 8, autoCheckout: true };
          }
        }
        return processed;
      });
  };

  if (!isMounted) return null;

  if (viewMode === 'absent') {
    const absentData = employees.filter(e => e.active && !attendanceRecords.some(r => r.employeeId === e.employeeId && r.date === todayStr)).map(e => ({ ...e, displayStatus: getPriorityStatus(todayStr, null) }));
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
            <TableBody>{absentData.map((rec, idx) => (<TableRow key={idx}><TableCell className="px-8 py-6 font-bold">{rec.name}</TableCell><TableCell>{rec.department}</TableCell><TableCell>{rec.designation}</TableCell><TableCell><Badge variant="outline" className="bg-rose-50 text-rose-700">{rec.displayStatus}</Badge></TableCell></TableRow>))}</TableBody></Table>
          </ScrollArea>
        </div>
      </div>
    );
  }

  if (viewMode === 'leave') {
    const pendingLeaves = (leaveRequests || []).filter(l => l.status === 'UNDER_PROCESS');
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
            <h2 className="text-2xl font-black uppercase">{viewMode} Logs Today</h2>
            <Button variant="ghost" size="icon" onClick={() => setViewMode(null)} className="text-white"><X className="w-6 h-6" /></Button>
          </div>
          <ScrollArea className="flex-1 bg-white">
            <Table className="min-w-[1200px]"><TableHeader className="bg-slate-50"><TableRow><TableHead className="px-8">Employee Name</TableHead><TableHead>Dept/Desig</TableHead><TableHead>Log Time</TableHead><TableHead>Work Hour</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>{data.map((rec, idx) => (
              <TableRow key={idx}><TableCell className="px-8 py-6 font-bold">{rec.employeeName}</TableCell><TableCell>{rec.dept} / {rec.desig}</TableCell><TableCell className="font-mono text-xs">{rec.inTime} - {rec.outTime || 'Live'}</TableCell><TableCell className="text-center font-bold">{formatHoursToHHMM(rec.hours)}</TableCell><TableCell><Badge className="bg-emerald-50 text-emerald-700">{rec.displayStatus}</Badge></TableCell></TableRow>
            ))}</TableBody></Table>
          </ScrollArea>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Primary Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Total Employees" value={stats.totalEmployees} icon={Users} trend="+1" trendUp={true} description="Active manpower" />
        <StatCard title="Present Today" value={stats.presentToday} icon={CalendarCheck} trend={`${stats.attendancePct}%`} trendUp={true} description="Across units" onClick={() => setViewMode('present')} />
        <StatCard title="Absent Today" value={stats.absentToday} icon={UserX} trend="0" trendUp={false} description="Missing logs" onClick={() => setViewMode('absent')} />
      </div>

      {/* Missing Widgets Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Field Work Today" value={stats.fieldWorkToday} icon={Briefcase} trend="Active" trendUp={true} description="On-site logs" onClick={() => setViewMode('field')} />
        <StatCard title="Work at Home" value={stats.wfhToday} icon={Home} trend="Remote" trendUp={true} description="WFH shift logs" onClick={() => setViewMode('wfh')} />
        <StatCard title="Leave Requests" value={stats.pendingLeaves} icon={FileText} trend="Pending" trendUp={false} description="Awaiting process" onClick={() => setViewMode('leave')} />
      </div>

      <div className="space-y-6 mt-10">
        <div className="flex justify-between items-center bg-white p-6 rounded-3xl border shadow-sm">
          <h3 className="text-xl font-black">Performance Insights</h3>
          <div className="flex items-center gap-3">
             <Label className="text-[10px] font-black uppercase text-slate-400">Analysis Month</Label>
             <Popover open={isPickerOpen} onOpenChange={setIsPickerOpen}>
                <PopoverTrigger asChild><Button variant="outline" className="h-11 font-black">{selectedLeaderboardMonth}</Button></PopoverTrigger>
                <PopoverContent className="w-72 p-0 rounded-2xl overflow-hidden" align="end">
                   <div className="p-4 bg-slate-900 text-white flex justify-between"><Button variant="ghost" onClick={() => setPickerYear(p => p - 1)} disabled={pickerYear <= 2026}><ChevronLeft className="w-4 h-4"/></Button><span className="font-black">{pickerYear}</span><Button variant="ghost" onClick={() => setPickerYear(p => p + 1)} disabled={pickerYear >= getISTTime().getFullYear()}><ChevronRight className="w-4 h-4"/></Button></div>
                   <div className="p-3 grid grid-cols-3 gap-2">{MONTHS.map((m, idx) => {
                      const sel = selectedLeaderboardMonth === `${m}-${pickerYear.toString().slice(-2)}`;
                      const d = new Date(pickerYear, idx, 1);
                      const future = isAfter(d, startOfMonth(getISTTime()));
                      const pre = isBefore(d, startOfMonth(PROJECT_START_DATE));
                      return <Button key={m} variant={sel ? "default" : "ghost"} disabled={future || pre} onClick={() => { setSelectedLeaderboardMonth(`${m}-${pickerYear.toString().slice(-2)}`); setIsPickerOpen(false); }} className={cn("h-12", sel && "bg-primary")}>{m}</Button>;
                   })}</div>
                </PopoverContent>
             </Popover>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="rounded-[32px] overflow-hidden shadow-xl border-none"><CardHeader className="bg-emerald-50"><CardTitle className="text-lg font-black text-emerald-900">TOP EFFICIENT STAFF</CardTitle></CardHeader>
          <CardContent className="p-0 divide-y">{leaderboardData.top.map((e, idx) => (
            <div key={idx} className="p-6 flex justify-between items-center hover:bg-slate-50"><div className="flex items-center gap-4"><div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center font-black text-emerald-600">{idx+1}</div><div><p className="font-black uppercase text-sm">{e.name}</p><p className="text-[10px] text-muted-foreground font-bold">{e.dept} • {e.desig}</p></div></div><p className="text-xl font-black text-emerald-600">{formatHoursToHHMM(e.hours)}</p></div>
          ))}</CardContent></Card>
          <Card className="rounded-[32px] overflow-hidden shadow-xl border-none"><CardHeader className="bg-rose-50"><CardTitle className="text-lg font-black text-rose-900">ATTENTION REQUIRED</CardTitle></CardHeader>
          <CardContent className="p-0 divide-y">{leaderboardData.bottom.map((e, idx) => (
            <div key={idx} className="p-6 flex justify-between items-center hover:bg-slate-50"><div className="flex items-center gap-4"><div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center font-black text-rose-600">{idx+1}</div><div><p className="font-black uppercase text-sm">{e.name}</p><p className="text-[10px] text-muted-foreground font-bold">{e.dept} • {e.desig}</p></div></div><p className="text-xl font-black text-rose-600">{formatHoursToHHMM(e.hours)}</p></div>
          ))}</CardContent></Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, trend, trendUp, description, onClick }: any) {
  return (<Card className={cn("shadow-sm cursor-pointer hover:shadow-md transition-all border-slate-100", onClick && "group")} onClick={onClick}><CardContent className="p-6 flex justify-between items-center"><div className="space-y-1"><div><p className="text-xs font-bold text-muted-foreground uppercase tracking-tight">{title}</p><h3 className="text-3xl font-black mt-1 text-slate-900">{value}</h3></div><p className="text-[10px] text-muted-foreground font-medium">{description}</p></div><div className="p-4 rounded-2xl bg-slate-50 group-hover:bg-primary/10 transition-colors"><Icon className="w-6 h-6 text-slate-400 group-hover:text-primary transition-colors" /></div></CardContent></Card>);
}
