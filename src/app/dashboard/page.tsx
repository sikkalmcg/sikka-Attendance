
"use client";

import { useEffect, useState } from "react";
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

const data = [
  { name: "Mon", attendance: 85 },
  { name: "Tue", attendance: 92 },
  { name: "Wed", attendance: 88 },
  { name: "Thu", attendance: 95 },
  { name: "Fri", attendance: 90 },
  { name: "Sat", attendance: 45 },
];

const chartConfig = {
  attendance: {
    label: "Attendance",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

export default function DashboardHome() {
  const [stats, setStats] = useState({
    totalEmployees: 452,
    presentToday: 410,
    lateComers: 12,
    pendingVouchers: 8,
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Employees" 
          value={stats.totalEmployees} 
          icon={Users} 
          trend="+12%" 
          trendUp={true}
          description="Active manpower"
        />
        <StatCard 
          title="Present Today" 
          value={stats.presentToday} 
          icon={CalendarCheck} 
          trend="90.7%" 
          trendUp={true}
          description="At various plants"
        />
        <StatCard 
          title="Late Comers" 
          value={stats.lateComers} 
          icon={Clock} 
          trend="-2%" 
          trendUp={false}
          description="Compared to yesterday"
        />
        <StatCard 
          title="Pending Approvals" 
          value={stats.pendingVouchers} 
          icon={AlertCircle} 
          trend="+4" 
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
                Stable
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <ChartContainer config={chartConfig} className="h-[300px] w-full mt-4">
              <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="attendance" radius={[4, 4, 0, 0]} barSize={40}>
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.attendance > 80 ? 'var(--color-attendance)' : '#33CEE7'} />
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
            <QuickActionButton label="Generate Payroll" color="bg-blue-600" />
            <QuickActionButton label="Approve Vouchers" color="bg-cyan-500" />
            <QuickActionButton label="Add Employee" color="bg-slate-800" />
            <QuickActionButton label="View Reports" color="bg-slate-400" />
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

function QuickActionButton({ label, color }: { label: string, color: string }) {
  return (
    <button className={`w-full ${color} text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-between hover:opacity-90 transition-all shadow-md active:scale-[0.98]`}>
      {label}
      <ArrowUpRight className="w-4 h-4" />
    </button>
  );
}
