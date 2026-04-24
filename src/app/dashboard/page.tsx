
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
  Filter
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
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate, formatHoursToHHMM } from "@/lib/utils";
import { format, addHours, parseISO, isValid, isBefore, startOfMonth } from "date-fns";

const PRESENT_STATUSES = ['PRESENT', 'HALF_DAY', 'FIELD', 'WFH'];
const PROJECT_START_DATE = new Date(2026, 3, 1); // April 2026

const getISTTime = () => {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
};

const generateLeaderboardMonths = () => {
  const options = [];
  const date = getISTTime();
  // Generate from April 2026 to 12 months ahead of now
  for (let i = -12; i <= 120; i++) {
    const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
    if (isBefore(d, startOfMonth(PROJECT_START_DATE))) continue;
    const mmm = d.toLocaleString('en-US', { month: 'short' });
    const yy = d.getFullYear().toString().slice(-2);
    options.push(`${mmm}-${yy}`);
  }
  // Return unique sorted options
  return Array.from(new Set(options)).reverse();
};

export default function DashboardHome() {
  const { employees, attendanceRecords, vouchers } = useData();
  const [isMounted, setIsMounted] = useState(false);
  const [viewMode, setViewMode] = useState<null | 'present' | 'absent' | 'field' | 'wfh'>(null);
  const [todayStr, setTodayStr] = useState("");
  const [selectedLeaderboardMonth, setSelectedLeaderboardMonth] = useState("");

  useEffect(() => {
    setIsMounted(true);
    const now = getISTTime();
    setTodayStr(format(now, 'yyyy-MM-dd'));
    
    // Default to current month string (MMM-YY)
    const mmm = now.toLocaleString('en-US', { month: 'short' });
    const yy = now.getFullYear().toString().slice(-2);
    const currentMonthKey = `${mmm}-${yy}`;
    setSelectedLeaderboardMonth(currentMonthKey);
  }, []);

  const stats = useMemo(() => {
    if (!isMounted || !todayStr) return { totalEmployees: 0, presentToday: 0, absentToday: 0, fieldWorkToday: 0, wfhToday: 0, pendingApprovals: 0, attendancePct: "0" };
    
    const now = getISTTime();
    const activeEmployees = employees.filter(e => e.active);
    
    const todayLogs = attendanceRecords.filter(r => {
      if (r.date !== todayStr) return false;
      if (!r.outTime) {
        const inDT = new Date(`${r.inDate || r.date}T${r.inTime}`);
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

    return {
      totalEmployees: activeEmployees.length,
      presentToday: presentToday.length,
      absentToday: absentToday,
      fieldWorkToday: fieldWorkToday.length,
      wfhToday: wfhToday.length,
      pendingApprovals: pendingApprovals,
      attendancePct: activeEmployees.length > 0 ? ((presentToday.length / activeEmployees.length) * 100).toFixed(1) : "0"
    };
  }, [employees, attendanceRecords, vouchers, isMounted, todayStr]);

  const leaderboardData = useMemo(() => {
    if (!isMounted || !selectedLeaderboardMonth || !employees.length) return { top: [], bottom: [] };

    const [mmm, yy] = selectedLeaderboardMonth.split('-');
    const mNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const mIndex = mNames.indexOf(mmm);
    const year = 2000 + parseInt(yy);

    const hourMap: Record<string, number> = {};

    attendanceRecords.forEach(r => {
      const d = parseISO(r.date);
      if (isValid(d) && d.getMonth() === mIndex && d.getFullYear() === year) {
        hourMap[r.employeeId] = (hourMap[r.employeeId] || 0) + (r.hours || 0);
      }
    });

    const activeList = employees.filter(e => e.active).map(e => ({
      name: e.name,
      id: e.employeeId,
      dept: e.department,
      hours: hourMap[e.employeeId] || 0
    }));

    const sorted = [...activeList].sort((a, b) => b.hours - a.hours);
    
    return {
      top: sorted.slice(0, 3),
      bottom: [...activeList].sort((a, b) => a.hours - b.hours).slice(0, 3)
    };
  }, [attendanceRecords, employees, selectedLeaderboardMonth, isMounted]);

  const getCategorizedData = (type?: 'FIELD' | 'WFH' | 'PRESENT') => {
    if (!isMounted || !todayStr) return [];
    const now = getISTTime();

    return attendanceRecords
      .filter(r => {
        if (r.date !== todayStr) return false;
        if (!PRESENT_STATUSES.includes(r.status)) return false;
        if (type === 'FIELD') return r.attendanceType === 'FIELD';
        if (type === 'WFH') return r.attendanceType === 'WFH';
        return true; 
      })
      .map(rec => {
        const emp = employees.find(e => e.employeeId === rec.employeeId);
        let processed = { ...rec, dept: emp?.department || "N/A", desig: emp?.designation || "N/A" };
        
        if (!rec.outTime) {
          const inDT = new Date(`${rec.inDate || rec.date}T${rec.inTime}`);
          const diff = (now.getTime() - inDT.getTime()) / (1000 * 60 * 60);
          if (diff >= 16) {
            const autoOutDT = addHours(inDT, 8);
            processed = { ...processed, outTime: format(autoOutDT, "HH:mm"), outDate: format(autoOutDT, "yyyy-MM-dd"), hours: 8, autoCheckout: true };
          }
        }
        return processed;
      });
  };

  const absentEmployeesData = useMemo(() => {
    if (!isMounted || !todayStr) return [];
    const now = getISTTime();
    const presentIds = new Set(
      attendanceRecords
        .filter(r => {
          if (r.date !== todayStr || !PRESENT_STATUSES.includes(r.status)) return false;
          if (!r.outTime) {
            const inDT = new Date(`${r.inDate || r.date}T${r.inTime}`);
            const diff = (now.getTime() - inDT.getTime()) / (1000 * 60 * 60);
            if (diff >= 16) return false;
          }
          return true;
        })
        .map(r => r.employeeId)
    );

    return employees
      .filter(e => e.active && !presentIds.has(e.employeeId))
      .map(e => ({ name: e.name, employeeId: e.employeeId, dept: e.department, desig: e.designation, date: todayStr }));
  }, [employees, attendanceRecords, todayStr, isMounted]);

  if (!isMounted) return null;

  if (viewMode === 'absent') {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="rounded-3xl border-none shadow-2xl overflow-hidden bg-white flex flex-col min-h-[calc(100vh-140px)]">
          <div className="p-8 bg-slate-900 text-white shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 flex items-center justify-center"><UserX className="w-7 h-7 text-rose-500" /></div>
              <div><h2 className="text-2xl font-black">Absent Today</h2><p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Manpower Exception Report • {formatDate(todayStr)}</p></div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setViewMode(null)} className="h-10 w-10 rounded-full hover:bg-white/10 text-white"><X className="w-6 h-6" /></Button>
          </div>
          <ScrollArea className="flex-1 bg-white">
            <Table><TableHeader className="bg-slate-50"><TableRow><TableHead className="font-black text-[11px] uppercase tracking-widest px-8 py-5">Date</TableHead><TableHead className="font-black text-[11px] uppercase tracking-widest px-8">Employee Name</TableHead><TableHead className="font-black text-[11px] uppercase tracking-widest px-8">Department</TableHead><TableHead className="font-black text-[11px] uppercase tracking-widest px-8">Designation</TableHead></TableRow></TableHeader>
            <TableBody>{absentEmployeesData.length === 0 ? (<TableRow><TableCell colSpan={4} className="text-center py-20 text-muted-foreground italic">All employees are present today.</TableCell></TableRow>) : (absentEmployeesData.map((rec, idx) => (<TableRow key={idx} className="hover:bg-slate-50/50 transition-colors"><TableCell className="px-8 py-6 font-bold text-slate-400 text-xs">{formatDate(rec.date)}</TableCell><TableCell className="px-8 font-black text-slate-700 uppercase text-sm"><div className="flex flex-col"><span>{rec.name}</span><span className="text-[10px] font-mono font-black text-primary uppercase">{rec.employeeId}</span></div></TableCell><TableCell className="px-8 text-xs font-bold text-slate-600">{rec.dept}</TableCell><TableCell className="px-8 text-[10px] text-muted-foreground font-black uppercase tracking-tight">{rec.desig}</TableCell></TableRow>)))}</TableBody></Table>
          </ScrollArea>
        </div>
      </div>
    );
  }

  if (viewMode && ['present', 'field', 'wfh'].includes(viewMode)) {
    const data = getCategorizedData(viewMode === 'present' ? 'PRESENT' : viewMode.toUpperCase() as any);
    const config = { present: { title: 'Present Today', icon: CalendarCheck, color: 'text-emerald-500', bg: 'bg-emerald-500/20' }, field: { title: 'Field Work Details', icon: Briefcase, color: 'text-blue-500', bg: 'bg-blue-500/20' }, wfh: { title: 'Work From Home Details', icon: Home, color: 'text-amber-500', bg: 'bg-amber-500/20' } }[viewMode as 'present' | 'field' | 'wfh'];
    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="rounded-3xl border-none shadow-2xl overflow-hidden bg-white flex flex-col min-h-[calc(100vh-140px)]">
          <div className="p-8 bg-slate-900 text-white shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", config.bg)}><config.icon className={cn("w-7 h-7", config.color)} /></div>
              <div><h2 className="text-2xl font-black">{config.title}</h2><p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Real-time Presence Log • {formatDate(todayStr)}</p></div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setViewMode(null)} className="h-10 w-10 rounded-full hover:bg-white/10 text-white"><X className="w-6 h-6" /></Button>
          </div>
          <ScrollArea className="flex-1 bg-white">
            <Table className="min-w-[1600px]"><TableHeader className="bg-slate-50"><TableRow><TableHead className="font-black text-[10px] uppercase tracking-widest px-8 py-5">Employee Name</TableHead><TableHead className="font-black text-[10px] uppercase tracking-widest">Department</TableHead><TableHead className="font-black text-[10px] uppercase tracking-widest">Designation</TableHead><TableHead className="font-black text-[10px] uppercase tracking-widest">In Date & Time</TableHead><TableHead className="font-black text-[10px] uppercase tracking-widest">Out Date & Time</TableHead><TableHead className="font-black text-[10px] uppercase tracking-widest">Status</TableHead><TableHead className="font-black text-[10px] uppercase tracking-widest pr-8">Location</TableHead></TableRow></TableHeader>
            <TableBody>{data.length === 0 ? (<TableRow><TableCell colSpan={10} className="text-center py-20 text-muted-foreground italic">No active logs.</TableCell></TableRow>) : (data.map((rec: any, idx: number) => (<TableRow key={idx} className="hover:bg-slate-50/50 transition-colors"><TableCell className="px-8 py-6 font-black text-slate-700 uppercase text-sm"><div className="flex flex-col"><span>{rec.employeeName}</span><span className="text-[10px] font-mono font-black text-primary uppercase">{rec.employeeId}</span></div></TableCell><TableCell className="text-xs font-bold text-slate-600">{rec.dept}</TableCell><TableCell className="text-[10px] text-muted-foreground font-black uppercase tracking-tight">{rec.desig}</TableCell><TableCell className="text-xs font-mono font-bold"><div className="flex items-center gap-1.5"><Clock className="w-3 h-3 text-slate-400" />{formatDate(rec.date)} {rec.inTime || "--:--"}</div></TableCell><TableCell className="text-xs font-mono font-bold"><div className={cn("flex items-center gap-1.5", rec.autoCheckout ? "text-rose-500" : "text-slate-400")}><Clock className="w-3 h-3" />{rec.outTime ? `${formatDate(rec.outDate || rec.date)} ${rec.outTime}` : "In-Progress"}</div></TableCell><TableCell><Badge className={cn("text-[9px] font-black uppercase tracking-widest", rec.status === 'PRESENT' ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700")}>{rec.autoCheckout ? "AUTO_OUT" : rec.status}</Badge></TableCell><TableCell className="pr-8"><div className="flex items-center gap-1.5 max-w-[300px]"><MapPin className="w-3.5 h-3.5 text-primary shrink-0" /><span className="text-[10px] font-bold text-slate-600 truncate">{rec.address || "N/A"}</span></div></TableCell></TableRow>)))}</TableBody></Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-12">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Total Employees" value={stats.totalEmployees} icon={Users} trend="+1" trendUp={true} description="Active manpower" />
        <StatCard title="Present Today" value={stats.presentToday} icon={CalendarCheck} trend={`${stats.attendancePct}%`} trendUp={parseFloat(stats.attendancePct) > 80} description="At various plants" onClick={() => setViewMode('present')} />
        <StatCard title="Absent Today" value={stats.absentToday} icon={UserX} trend="0" trendUp={false} description="Not logged in today" onClick={() => setViewMode('absent')} />
        <StatCard title="Field Work" value={stats.fieldWorkToday} icon={Briefcase} trend="Live" trendUp={true} description="External assignments" onClick={() => setViewMode('field')} />
        <StatCard title="Work at Home" value={stats.wfhToday} icon={Home} trend="Live" trendUp={true} description="Remote operations" onClick={() => setViewMode('wfh')} />
        <StatCard title="Pending Approvals" value={stats.pendingApprovals} icon={AlertCircle} trend={`+${stats.pendingApprovals}`} trendUp={false} description="Attendance & Vouchers" />
      </div>

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
              <Filter className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 leading-tight">Performance Insights</h3>
              <p className="text-xs text-muted-foreground font-medium">Monthly working hour ranking and exception analysis.</p>
            </div>
          </div>
          <div className="w-full sm:w-48">
            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5 block">Analysis Period</Label>
            <Select value={selectedLeaderboardMonth} onValueChange={setSelectedLeaderboardMonth}>
              <SelectTrigger className="h-11 bg-slate-50 border-slate-200 font-bold rounded-xl focus:ring-primary/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl shadow-2xl">
                {generateLeaderboardMonths().map(m => (
                  <SelectItem key={m} value={m} className="font-bold text-xs">{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* TOP PERFORMERS */}
          <Card className="border-none shadow-xl rounded-[32px] overflow-hidden bg-white group transition-all">
            <CardHeader className="bg-emerald-50/50 p-8 border-b border-emerald-100/50">
              <div className="flex justify-between items-center">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-emerald-600" />
                    <CardTitle className="text-lg font-black text-emerald-900 uppercase tracking-tight">Top Efficient Staff</CardTitle>
                  </div>
                  <p className="text-[10px] font-black text-emerald-600/70 uppercase tracking-[0.2em]">Highest Working Hours • {selectedLeaderboardMonth}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-50">
                {leaderboardData.top.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 font-bold text-xs">No records available for this period.</div>
                ) : (
                  leaderboardData.top.map((emp, idx) => (
                    <div key={emp.id} className="p-6 flex items-center justify-between hover:bg-emerald-50/30 transition-colors">
                      <div className="flex items-center gap-5">
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-sm border-2",
                          idx === 0 ? "bg-amber-100 border-amber-200 text-amber-600" :
                          idx === 1 ? "bg-slate-100 border-slate-200 text-slate-500" :
                          "bg-orange-50 border-orange-100 text-orange-600"
                        )}>
                          {idx + 1}
                        </div>
                        <div>
                          <p className="font-black text-slate-800 uppercase text-sm leading-none">{emp.name}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-[9px] font-black uppercase px-2 py-0 h-4 border-slate-200 text-slate-400 bg-white">{emp.id}</Badge>
                            <span className="text-[10px] text-muted-foreground font-bold uppercase">{emp.dept}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-black text-emerald-600 leading-none">{formatHoursToHHMM(emp.hours)}</p>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Total Hours</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* BOTTOM PERFORMERS / ATTENTION REQUIRED */}
          <Card className="border-none shadow-xl rounded-[32px] overflow-hidden bg-white group transition-all">
            <CardHeader className="bg-rose-50/50 p-8 border-b border-rose-100/50">
              <div className="flex justify-between items-center">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-5 h-5 text-rose-600" />
                    <CardTitle className="text-lg font-black text-rose-900 uppercase tracking-tight">Attention Required</CardTitle>
                  </div>
                  <p className="text-[10px] font-black text-rose-600/70 uppercase tracking-[0.2em]">Lowest Working Hours • {selectedLeaderboardMonth}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-50">
                {leaderboardData.bottom.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 font-bold text-xs">No records available for this period.</div>
                ) : (
                  leaderboardData.bottom.map((emp, idx) => (
                    <div key={emp.id} className="p-6 flex items-center justify-between hover:bg-rose-50/30 transition-colors">
                      <div className="flex items-center gap-5">
                        <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center font-black text-lg text-slate-400">
                          <AlertCircle className="w-6 h-6 opacity-40" />
                        </div>
                        <div>
                          <p className="font-black text-slate-800 uppercase text-sm leading-none">{emp.name}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-[9px] font-black uppercase px-2 py-0 h-4 border-slate-200 text-slate-400 bg-white">{emp.id}</Badge>
                            <span className="text-[10px] text-muted-foreground font-bold uppercase">{emp.dept}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-black text-rose-600 leading-none">{formatHoursToHHMM(emp.hours)}</p>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Total Hours</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, trend, trendUp, description, onClick }: any) {
  return (<Card className={cn("shadow-sm border-slate-200 overflow-hidden relative transition-all", onClick && "cursor-pointer hover:shadow-md hover:border-primary/20 group")} onClick={onClick}><CardContent className="p-6"><div className="flex justify-between items-start"><div><p className="text-sm font-medium text-muted-foreground">{title}</p><h3 className="text-3xl font-bold mt-2">{value}</h3></div><div className={cn("p-3 rounded-xl bg-slate-50 border border-slate-100 shadow-sm transition-colors", onClick && "group-hover:bg-primary/10 group-hover:border-primary/20")}><Icon className="w-6 h-6 text-primary" /></div></div><div className="mt-4 flex items-center gap-2"><span className={`text-xs font-bold flex items-center gap-1 px-1.5 py-0.5 rounded ${trendUp ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}>{trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}{trend}</span><span className="text-xs text-muted-foreground">{description}</span></div></CardContent></Card>);
}

