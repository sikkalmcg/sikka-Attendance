
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
  LayoutDashboard
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
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate, formatHoursToHHMM } from "@/lib/utils";
import { format, addHours } from "date-fns";

const PRESENT_STATUSES = ['PRESENT', 'HALF_DAY', 'FIELD', 'WFH'];

const getISTTime = () => {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
};

export default function DashboardHome() {
  const { employees, attendanceRecords, vouchers } = useData();
  const [isMounted, setIsMounted] = useState(false);
  const [viewMode, setViewMode] = useState<null | 'present' | 'absent' | 'field' | 'wfh'>(null);
  const [todayStr, setTodayStr] = useState("");

  useEffect(() => {
    setIsMounted(true);
    setTodayStr(format(getISTTime(), 'yyyy-MM-dd'));
  }, []);

  const stats = useMemo(() => {
    if (!isMounted || !todayStr) return { totalEmployees: 0, presentToday: 0, absentToday: 0, fieldWorkToday: 0, wfhToday: 0, pendingApprovals: 0, attendancePct: "0" };
    
    const now = getISTTime();
    const activeEmployees = employees.filter(e => e.active);
    
    // REQUIREMENT: Correctly identify today's active logs, excluding stale ones
    const todayLogs = attendanceRecords.filter(r => {
      if (r.date !== todayStr) return false;
      // If it's an old shift from today's perspective but > 16h, it's virtually closed
      if (!r.outTime) {
        const inDT = new Date(`${r.inDate || r.date}T${r.inTime}`);
        const diff = (now.getTime() - inDT.getTime()) / (1000 * 60 * 60);
        if (diff >= 16) return false; // Stale shift is not "Live"
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
        
        // VIRTUAL AUTO-OUT for today's view
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
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Total Employees" value={stats.totalEmployees} icon={Users} trend="+1" trendUp={true} description="Active manpower" />
        <StatCard title="Present Today" value={stats.presentToday} icon={CalendarCheck} trend={`${stats.attendancePct}%`} trendUp={parseFloat(stats.attendancePct) > 80} description="At various plants" onClick={() => setViewMode('present')} />
        <StatCard title="Absent Today" value={stats.absentToday} icon={UserX} trend="0" trendUp={false} description="Not logged in today" onClick={() => setViewMode('absent')} />
        <StatCard title="Field Work" value={stats.fieldWorkToday} icon={Briefcase} trend="Live" trendUp={true} description="External assignments" onClick={() => setViewMode('field')} />
        <StatCard title="Work at Home" value={stats.wfhToday} icon={Home} trend="Live" trendUp={true} description="Remote operations" onClick={() => setViewMode('wfh')} />
        <StatCard title="Pending Approvals" value={stats.pendingApprovals} icon={AlertCircle} trend={`+${stats.pendingApprovals}`} trendUp={false} description="Attendance & Vouchers" />
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, trend, trendUp, description, onClick }: any) {
  return (<Card className={cn("shadow-sm border-slate-200 overflow-hidden relative transition-all", onClick && "cursor-pointer hover:shadow-md hover:border-primary/20 group")} onClick={onClick}><CardContent className="p-6"><div className="flex justify-between items-start"><div><p className="text-sm font-medium text-muted-foreground">{title}</p><h3 className="text-3xl font-bold mt-2">{value}</h3></div><div className={cn("p-3 rounded-xl bg-slate-50 border border-slate-100 shadow-sm transition-colors", onClick && "group-hover:bg-primary/10 group-hover:border-primary/20")}><Icon className="w-6 h-6 text-primary" /></div></div><div className="mt-4 flex items-center gap-2"><span className={`text-xs font-bold flex items-center gap-1 px-1.5 py-0.5 rounded ${trendUp ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}>{trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}{trend}</span><span className="text-xs text-muted-foreground">{description}</span></div></CardContent></Card>);
}
