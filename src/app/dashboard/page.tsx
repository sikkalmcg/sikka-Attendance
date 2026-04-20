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
  Clock
} from "lucide-react";
import { useData } from "@/context/data-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, formatDate } from "@/lib/utils";
import { format } from "date-fns";

const PRESENT_STATUSES = ['PRESENT', 'HALF_DAY', 'FIELD', 'WFH'];

const getISTTime = () => {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
};

export default function DashboardHome() {
  const { employees, attendanceRecords, vouchers } = useData();
  const [isMounted, setIsMounted] = useState(false);
  const [isPresentModalOpen, setIsPresentModalOpen] = useState(false);
  const [isAbsentModalOpen, setIsAbsentModalOpen] = useState(false);
  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false);
  const [isWFHModalOpen, setIsWFHModalOpen] = useState(false);
  const [todayStr, setTodayStr] = useState("");

  useEffect(() => {
    setIsMounted(true);
    setTodayStr(format(getISTTime(), 'yyyy-MM-dd'));
  }, []);

  const stats = useMemo(() => {
    if (!isMounted || !todayStr) return { totalEmployees: 0, presentToday: 0, absentToday: 0, fieldWorkToday: 0, wfhToday: 0, pendingApprovals: 0, attendancePct: "0" };
    
    const activeEmployees = employees.filter(e => e.active);
    const todayLogs = attendanceRecords.filter(r => r.date === todayStr);
    
    const presentToday = todayLogs.filter(r => PRESENT_STATUSES.includes(r.status));
    // Strictly filter field/wfh based on actual presence
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
    return attendanceRecords
      .filter(r => {
        if (r.date !== todayStr) return false;
        
        // Logic Hardening: Presence check is mandatory for these specific widgets
        if (!PRESENT_STATUSES.includes(r.status)) return false;

        if (type === 'FIELD') return r.attendanceType === 'FIELD';
        if (type === 'WFH') return r.attendanceType === 'WFH';
        return true; // Default 'PRESENT' category
      })
      .map(rec => {
        const emp = employees.find(e => e.employeeId === rec.employeeId);
        return {
          ...rec,
          dept: emp?.department || "N/A",
          desig: emp?.designation || "N/A"
        };
      });
  };

  const presentEmployeesData = useMemo(() => getCategorizedData('PRESENT'), [attendanceRecords, employees, todayStr, isMounted]);
  const fieldWorkData = useMemo(() => getCategorizedData('FIELD'), [attendanceRecords, employees, todayStr, isMounted]);
  const wfhData = useMemo(() => getCategorizedData('WFH'), [attendanceRecords, employees, todayStr, isMounted]);

  const absentEmployeesData = useMemo(() => {
    if (!isMounted || !todayStr) return [];
    const presentIds = new Set(
      attendanceRecords
        .filter(r => r.date === todayStr && PRESENT_STATUSES.includes(r.status))
        .map(r => r.employeeId)
    );

    return employees
      .filter(e => e.active && !presentIds.has(e.employeeId))
      .map(e => ({
        name: e.name,
        employeeId: e.employeeId,
        dept: e.department,
        desig: e.designation
      }));
  }, [employees, attendanceRecords, todayStr, isMounted]);

  if (!isMounted) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard 
          title="Total Employees" 
          value={stats.totalEmployees} 
          icon={Users} 
          trend="+1" 
          trendUp={true}
          description="Active manpower"
        />
        <StatCard 
          title="Present Today" 
          value={stats.presentToday} 
          icon={CalendarCheck} 
          trend={`${stats.attendancePct}%`} 
          trendUp={parseFloat(stats.attendancePct) > 80}
          description="At various plants"
          onClick={() => setIsPresentModalOpen(true)}
        />
        <StatCard 
          title="Absent Today" 
          value={stats.absentToday} 
          icon={UserX} 
          trend="0" 
          trendUp={false}
          description="Not logged in today"
          onClick={() => setIsAbsentModalOpen(true)}
        />
        <StatCard 
          title="Field Work" 
          value={stats.fieldWorkToday} 
          icon={Briefcase} 
          trend="Live" 
          trendUp={true}
          description="External assignments"
          onClick={() => setIsFieldModalOpen(true)}
        />
        <StatCard 
          title="Work at Home" 
          value={stats.wfhToday} 
          icon={Home} 
          trend="Live" 
          trendUp={true}
          description="Remote operations"
          onClick={() => setIsWFHModalOpen(true)}
        />
        <StatCard 
          title="Pending Approvals" 
          value={stats.pendingApprovals} 
          icon={AlertCircle} 
          trend={`+${stats.pendingApprovals}`} 
          trendUp={false}
          description="Attendance & Vouchers"
        />
      </div>

      {/* Present Today Modal */}
      <DetailModal 
        isOpen={isPresentModalOpen} 
        onClose={() => setIsPresentModalOpen(false)} 
        title="Present Today" 
        data={presentEmployeesData} 
        icon={CalendarCheck}
        iconColor="text-emerald-600"
        bgColor="bg-emerald-50"
      />

      {/* Field Work Modal */}
      <DetailModal 
        isOpen={isFieldModalOpen} 
        onClose={() => setIsFieldModalOpen(false)} 
        title="Field Work Details" 
        data={fieldWorkData} 
        icon={Briefcase}
        iconColor="text-blue-600"
        bgColor="bg-blue-50"
      />

      {/* WFH Modal */}
      <DetailModal 
        isOpen={isWFHModalOpen} 
        onClose={() => setIsWFHModalOpen(false)} 
        title="Work at Home Details" 
        data={wfhData} 
        icon={Home}
        iconColor="text-amber-600"
        bgColor="bg-amber-50"
      />

      {/* Absent Today Modal */}
      <Dialog open={isAbsentModalOpen} onOpenChange={setIsAbsentModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
          <DialogHeader className="p-6 bg-white border-b shrink-0 flex-row items-center justify-between">
            <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                <UserX className="w-6 h-6 text-rose-600" />
              </div>
              Absent Today ({absentEmployeesData.length})
            </DialogTitle>
            <button 
              onClick={() => setIsAbsentModalOpen(false)}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors absolute right-4 top-4"
            >
              <X className="h-5 w-5 text-primary" />
            </button>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full custom-blue-scrollbar" tabIndex={0}>
              <Table>
                <TableHeader className="bg-slate-50 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="font-black text-[10px] uppercase tracking-widest px-6">Employee Name</TableHead>
                    <TableHead className="font-black text-[10px] uppercase tracking-widest pr-6">Dept / Designation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {absentEmployeesData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center py-20 text-muted-foreground font-medium italic">All employees are present today.</TableCell>
                    </TableRow>
                  ) : (
                    absentEmployeesData.map((rec, idx) => (
                      <TableRow key={idx} className="hover:bg-slate-50/50 transition-colors">
                        <TableCell className="px-6 py-4 font-bold text-slate-700 uppercase text-sm">
                          <div className="flex flex-col">
                            <span>{rec.name}</span>
                            <span className="text-[10px] font-mono font-black text-primary">{rec.employeeId}</span>
                          </div>
                        </TableCell>
                        <TableCell className="pr-6">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-600 leading-tight">{rec.dept}</span>
                            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">{rec.desig}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, trend, trendUp, description, onClick }: any) {
  return (
    <Card 
      className={cn(
        "shadow-sm border-slate-200 overflow-hidden relative transition-all",
        onClick && "cursor-pointer hover:shadow-md hover:border-primary/20 group"
      )}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <h3 className="text-3xl font-bold mt-2">{value}</h3>
          </div>
          <div className={cn(
            "p-3 rounded-xl bg-slate-50 border border-slate-100 shadow-sm transition-colors",
            onClick && "group-hover:bg-primary/10 group-hover:border-primary/20"
          )}>
            <Icon className="w-6 h-6 text-primary" />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <span className={`text-xs font-bold flex items-center gap-1 px-1.5 py-0.5 rounded ${trendUp ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}>
            {trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {trend}
          </span>
          <span className="text-xs text-muted-foreground">{description}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function DetailModal({ isOpen, onClose, title, data, icon: Icon, iconColor, bgColor }: any) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-6xl max-h-[85vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
        <DialogHeader className="p-6 bg-white border-b shrink-0 flex-row items-center justify-between">
          <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-3">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", bgColor)}>
              <Icon className={cn("w-6 h-6", iconColor)} />
            </div>
            {title} ({data.length})
          </DialogTitle>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors absolute right-4 top-4"
          >
            <X className="h-5 w-5 text-primary" />
          </button>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full custom-blue-scrollbar" tabIndex={0}>
            <Table>
              <TableHeader className="bg-slate-50 sticky top-0 z-10">
                <TableRow>
                  <TableHead className="font-black text-[10px] uppercase tracking-widest px-6">Employee Name</TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-widest">Dept / Designation</TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-widest">In Date Time</TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-widest">Out Date Time</TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-widest pr-6">Location - IN location</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-20 text-muted-foreground font-medium italic">No records found for this category.</TableCell>
                  </TableRow>
                ) : (
                  data.map((rec: any, idx: number) => (
                    <TableRow key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="px-6 py-4 font-bold text-slate-700 uppercase text-sm">
                        <div className="flex flex-col">
                          <span>{rec.employeeName}</span>
                          <span className="text-[10px] font-mono font-black text-primary">{rec.employeeId}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-600 leading-tight">{rec.dept}</span>
                          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">{rec.desig}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-mono font-bold">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {formatDate(rec.date)} {rec.inTime || "--:--"}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-mono font-bold">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {rec.outTime ? `${formatDate(rec.date)} ${rec.outTime}` : "--:--"}
                        </div>
                      </TableCell>
                      <TableCell className="pr-6">
                        <div className="flex items-center gap-1.5 max-w-[300px]">
                          <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          <span className="text-[10px] font-bold text-slate-600 truncate" title={rec.address}>{rec.address || "N/A"}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
