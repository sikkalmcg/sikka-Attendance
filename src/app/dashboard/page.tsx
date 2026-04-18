
"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { 
  Users, 
  Clock, 
  CalendarCheck, 
  AlertCircle, 
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  UserX,
  X,
  Factory
} from "lucide-react";
import { 
  ChartContainer, 
  ChartTooltip, 
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, Legend } from "recharts";
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

const chartConfig = {
  present: {
    label: "Present Today",
    color: "hsl(var(--primary))",
  },
  absent: {
    label: "Absent Today",
    color: "hsl(var(--destructive))",
  },
} satisfies ChartConfig;

export default function DashboardHome() {
  const { employees, attendanceRecords, vouchers, plants } = useData();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [isPresentModalOpen, setIsPresentModalOpen] = useState(false);
  const [isAbsentModalOpen, setIsAbsentModalOpen] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const stats = useMemo(() => {
    if (!isMounted) return { totalEmployees: 0, presentToday: 0, absentToday: 0, pendingApprovals: 0, attendancePct: "0" };
    
    const activeEmployees = employees.filter(e => e.active);
    const presentToday = attendanceRecords.filter(r => r.date === todayStr && (r.status === 'PRESENT' || r.status === 'HALF_DAY' || r.status === 'FIELD' || r.status === 'WFH'));
    const absentToday = Math.max(0, activeEmployees.length - presentToday.length);
    const pendingApprovals = attendanceRecords.filter(r => !r.approved).length + vouchers.filter(v => v.status === 'PENDING').length;

    return {
      totalEmployees: activeEmployees.length,
      presentToday: presentToday.length,
      absentToday: absentToday,
      pendingApprovals: pendingApprovals,
      attendancePct: activeEmployees.length > 0 ? ((presentToday.length / activeEmployees.length) * 100).toFixed(1) : "0"
    };
  }, [employees, attendanceRecords, vouchers, isMounted, todayStr]);

  const presentEmployeesData = useMemo(() => {
    if (!isMounted) return [];
    return attendanceRecords
      .filter(r => r.date === todayStr && (r.status === 'PRESENT' || r.status === 'HALF_DAY' || r.status === 'FIELD' || r.status === 'WFH'))
      .map(rec => {
        const emp = employees.find(e => e.employeeId === rec.employeeId);
        return {
          ...rec,
          dept: emp?.department || "N/A",
          desig: emp?.designation || "N/A"
        };
      });
  }, [attendanceRecords, employees, todayStr, isMounted]);

  const absentEmployeesData = useMemo(() => {
    if (!isMounted) return [];
    const presentIds = new Set(attendanceRecords.filter(r => r.date === todayStr).map(r => r.employeeId));
    return employees
      .filter(e => e.active && !presentIds.has(e.employeeId))
      .map(e => ({
        name: e.name,
        employeeId: e.employeeId,
        dept: e.department,
        desig: e.designation
      }));
  }, [employees, attendanceRecords, todayStr, isMounted]);

  const chartData = useMemo(() => {
    if (!isMounted || !plants.length) return [];
    
    return plants.map(plant => {
      // Find active employees assigned to this specific plant
      const assignedToPlant = employees.filter(e => 
        e.active && (e.unitIds?.includes(plant.id) || e.unitId === plant.id)
      );
      
      const presentInPlant = attendanceRecords.filter(r => 
        r.date === todayStr && 
        assignedToPlant.some(e => e.employeeId === r.employeeId) &&
        ['PRESENT', 'HALF_DAY', 'FIELD', 'WFH'].includes(r.status)
      );

      return {
        name: plant.name,
        present: presentInPlant.length,
        absent: Math.max(0, assignedToPlant.length - presentInPlant.length)
      };
    });
  }, [plants, employees, attendanceRecords, todayStr, isMounted]);

  if (!isMounted) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
          title="Pending Approvals" 
          value={stats.pendingApprovals} 
          icon={AlertCircle} 
          trend={`+${stats.pendingApprovals}`} 
          trendUp={false}
          description="Attendance & Vouchers"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-sm border-slate-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Factory className="w-5 h-5 text-primary" />
                Attendance Trends: Plant-wise
              </CardTitle>
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                <TrendingUp className="w-4 h-4" />
                Live Feed
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <ChartContainer config={chartConfig} className="h-[300px] w-full mt-4">
              <BarChart data={chartData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  interval={0}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend content={<ChartLegendContent />} verticalAlign="top" align="right" />
                <Bar dataKey="present" fill="var(--color-present)" radius={[4, 4, 0, 0]} barSize={32} />
                <Bar dataKey="absent" fill="var(--color-absent)" radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <QuickActionButton 
              label="Generate Payroll" 
              color="bg-blue-600" 
              onClick={() => router.push("/dashboard/payroll")}
            />
            <QuickActionButton 
              label="Approve Vouchers" 
              color="bg-cyan-500" 
              onClick={() => router.push("/dashboard/vouchers")}
            />
            <QuickActionButton 
              label="Add Employee" 
              color="bg-slate-800" 
              onClick={() => router.push("/dashboard/employees")}
            />
            <QuickActionButton 
              label="View Reports" 
              color="bg-slate-400" 
              onClick={() => router.push("/dashboard/reports")}
            />
          </CardContent>
        </Card>
      </div>

      {/* Present Today Modal */}
      <Dialog open={isPresentModalOpen} onOpenChange={setIsPresentModalOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
          <DialogHeader className="p-6 bg-white border-b shrink-0 flex-row items-center justify-between">
            <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <CalendarCheck className="w-6 h-6 text-emerald-600" />
              </div>
              Present Today ({presentEmployeesData.length})
            </DialogTitle>
            <button 
              onClick={() => setIsPresentModalOpen(false)}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors absolute right-4 top-4"
            >
              <X className="w-5 h-5 text-primary" />
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
                    <TableHead className="font-black text-[10px] uppercase tracking-widest pr-6">In Plant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {presentEmployeesData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-20 text-muted-foreground font-medium italic">No attendance records for today.</TableCell>
                    </TableRow>
                  ) : (
                    presentEmployeesData.map((rec, idx) => (
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
                          {formatDate(rec.date)} {rec.inTime || "--:--"}
                        </TableCell>
                        <TableCell className="text-xs font-mono font-bold">
                          {rec.outTime ? `${formatDate(rec.date)} ${rec.outTime}` : "--:--"}
                        </TableCell>
                        <TableCell className="pr-6">
                          <span className={cn("text-[10px] font-black uppercase tracking-widest", rec.inPlant === "Remote" ? "text-amber-600" : "text-emerald-600")}>
                            {rec.inPlant || "Office"}
                          </span>
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
              <X className="w-5 h-5 text-primary" />
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

function QuickActionButton({ label, color, onClick }: { label: string, color: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full ${color} text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-between hover:opacity-90 transition-all shadow-md active:scale-[0.98]`}
    >
      {label}
      <ArrowUpRight className="w-4 h-4" />
    </button>
  );
}
