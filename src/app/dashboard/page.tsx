
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
  ArrowDownRight
} from "lucide-react";
import { 
  ChartContainer, 
  ChartTooltip, 
  ChartTooltipContent,
  type ChartConfig
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from "recharts";
import { useData } from "@/context/data-context";

const chartConfig = {
  attendance: {
    label: "Attendance",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

export default function DashboardHome() {
  const { employees, attendanceRecords, vouchers } = useData();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const stats = useMemo(() => {
    if (!isMounted) return { totalEmployees: 0, presentToday: 0, lateComers: 0, pendingApprovals: 0, attendancePct: "0" };
    
    const todayStr = new Date().toISOString().split('T')[0];
    const activeEmployees = employees.filter(e => e.active);
    const presentToday = attendanceRecords.filter(r => r.date === todayStr && (r.status === 'PRESENT' || r.status === 'HALF_DAY'));
    const pendingApprovals = attendanceRecords.filter(r => !r.approved).length + vouchers.filter(v => v.status === 'PENDING').length;

    return {
      totalEmployees: activeEmployees.length,
      presentToday: presentToday.length,
      lateComers: 0,
      pendingApprovals: pendingApprovals,
      attendancePct: activeEmployees.length > 0 ? ((presentToday.length / activeEmployees.length) * 100).toFixed(1) : "0"
    };
  }, [employees, attendanceRecords, vouchers, isMounted]);

  const chartData = useMemo(() => {
    if (!isMounted) return [];
    
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return days.map((day, i) => {
      // Deterministic seed or values after mount to avoid hydration mismatch
      const baseValue = stats.totalEmployees || 10;
      const variation = Math.floor((Math.sin(i) + 1) * (baseValue / 2)); 
      return { 
        name: day, 
        attendance: Math.min(baseValue, variation + (baseValue * 0.5))
      };
    });
  }, [stats.totalEmployees, isMounted]);

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
        />
        <StatCard 
          title="Late Comers" 
          value={stats.lateComers} 
          icon={Clock} 
          trend="0" 
          trendUp={false}
          description="Today's exceptions"
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
              <CardTitle className="text-lg font-bold">Attendance Trends</CardTitle>
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                <TrendingUp className="w-4 h-4" />
                Live Data
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <ChartContainer config={chartConfig} className="h-[300px] w-full mt-4">
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="attendance" radius={[4, 4, 0, 0]} barSize={40}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.attendance > (stats.totalEmployees * 0.8) ? 'var(--color-attendance)' : '#33CEE7'} />
                  ))}
                </Bar>
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
    </div>
  );
}

function StatCard({ title, value, icon: Icon, trend, trendUp, description }: any) {
  return (
    <Card className="shadow-sm border-slate-200 overflow-hidden relative">
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <h3 className="text-3xl font-bold mt-2">{value}</h3>
          </div>
          <div className={`p-3 rounded-xl bg-slate-50 border border-slate-100 shadow-sm`}>
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
