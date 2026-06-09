"use client";

import { useMemo, useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Users, 
  CalendarCheck, 
  X, 
  Clock, 
  Navigation, 
  LayoutDashboard, 
  CalendarDays, 
  Factory, 
  Download,
  UserX,
  Loader2
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
import { format, parseISO, isValid, isSunday } from "date-fns";

const PRESENT_STATUSES = ['Open', 'Closed', 'Auto OUT', 'PRESENT', 'HALF_DAY', 'FIELD', 'WFH'];

const getISTTime = () => {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
};

export default function DashboardHome() {
  const { employees = [], attendanceRecords = [], holidays = [], plants = [], verifiedUser, isLoading } = useData();
  const [isMounted, setIsMounted] = useState(false);
  const [viewMode, setViewMode] = useState<null | 'present' | 'absent' | 'employees'>(null);
  const [todayStr, setTodayStr] = useState("");
  const [selectedPlantId, setSelectedPlantId] = useState("all");

  useEffect(() => {
    setIsMounted(true);
    setTodayStr(format(getISTTime(), 'yyyy-MM-dd'));
  }, []);

  const userAssignedPlantIds = useMemo(() => {
    if (!verifiedUser || verifiedUser.role === 'SUPER_ADMIN') return null;
    return verifiedUser.plantIds || [];
  }, [verifiedUser]);

  const authorizedPlants = useMemo(() => {
    if (!userAssignedPlantIds) return plants;
    return plants.filter(p => userAssignedPlantIds.includes(p.id));
  }, [userAssignedPlantIds, plants]);

  const getPriorityStatus = (dateStr: string, record: any, empId: string) => {
    const isSun = isSunday(parseISO(dateStr));
    const customHoliday = (holidays || []).find(h => h.date === dateStr && !h.auto);

    if (record && record.inTime) {
      if (isSun) return "Present on Weekend";
      if (customHoliday) return "Present on Holiday";
      return "Present";
    }

    if (isSun) return "Weekend";
    if (customHoliday) return "Holiday";

    return "Absent";
  };

  const filteredEmployees = useMemo(() => {
    let list = (employees || []).filter(e => e.active);
    if (userAssignedPlantIds) {
      list = list.filter(e => (e.unitIds || []).some(id => userAssignedPlantIds.includes(id)) || userAssignedPlantIds.includes(e.unitId));
    }
    if (selectedPlantId !== "all") {
      list = list.filter(e => (e.unitIds || []).includes(selectedPlantId) || e.unitId === selectedPlantId);
    }
    return list;
  }, [employees, selectedPlantId, userAssignedPlantIds]);

  // CRITICAL CALCULATION SYNTAX REPAIR BLOCK
  const stats = useMemo(() => {
    if (!isMounted || !todayStr) return { totalEmployees: 0, presentToday: 0, absentToday: 0, attendancePct: "0" };
    
    const activeEmployees = filteredEmployees;
    const activeEmpIds = new Set(activeEmployees.map(e => e.employeeId));
    
    const todayLogs = (attendanceRecords || []).filter(r => {
      if (r.date !== todayStr) return false;
      if (!activeEmpIds.has(r.employeeId)) return false;
      if (!r.inTime) return false; 
      return true;
    });
    
    const presentEmpIds = new Set(todayLogs.map(r => r.employeeId));
    const presentToday = presentEmpIds.size;
    
    // FIXED: Formulated and initialized the missing absentToday local variable constraint bounds
    const absentToday = Math.max(0, activeEmployees.length - presentToday);
    
    return {
      totalEmployees: activeEmployees.length,
      presentToday: presentToday,
      absentToday: absentToday,
      attendancePct: activeEmployees.length > 0 ? ((presentToday / activeEmployees.length) * 100).toFixed(1) : "0"
    };
  }, [filteredEmployees, attendanceRecords, isMounted, todayStr]);

  const getCategorizedData = () => {
    if (!isMounted || !todayStr) return [];
    const activeEmpIds = new Set(filteredEmployees.map(e => e.employeeId));

    if (viewMode === 'employees') {
      return filteredEmployees.map(e => ({ name: e.firstName ? `${e.firstName} ${e.lastName || ''}`.trim() : e.name, employeeId: e.employeeId, dept: e.department, desig: e.designation }));
    }

    if (viewMode === 'present') {
      return (attendanceRecords || [])
        .filter(r => r.date === todayStr && activeEmpIds.has(r.employeeId) && r.inTime)
        .map(r => {
          const emp = filteredEmployees.find(e => e.employeeId === r.employeeId);
          const empName = emp ? (emp.firstName ? `${emp.firstName} ${emp.lastName || ''}`.trim() : emp.name) : (r.employeeName || "Employee");
          return { ...r, name: empName, dept: emp?.department || "Operations", desig: emp?.designation || "Staff", displayStatus: getPriorityStatus(r.date, r, r.employeeId) };
        });
    }

    if (viewMode === 'absent') {
      return filteredEmployees
        .filter(e => !(attendanceRecords || []).some(r => r.employeeId === e.employeeId && r.date === todayStr && r.inTime))
        .map(e => ({ name: e.firstName ? `${e.firstName} ${e.lastName || ''}`.trim() : e.name, employeeId: e.employeeId, dept: e.department, desig: e.designation, displayStatus: getPriorityStatus(todayStr, null, e.employeeId) }));
    }

    return [];
  };

  const handleExportData = () => {
    const data = getCategorizedData();
    if (!data.length) return;
    
    const headers = ["Employee ID", "Employee Name", "Department", "Designation", "In Date time", "Status"];
    const rows = data.map((rec: any) => [
      `"${rec.employeeId}"`,
      `"${rec.name || rec.employeeName || "N/A"}"`,
      `"${rec.dept || "N/A"}"`,
      `"${rec.desig || "N/A"}"`,
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
      'absent': 'Absent Exceptions Today'
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
                            <span className="text-xs font-bold text-slate-700">{rec.dept || "Operations"}</span>
                            <span className="text-[10px] text-muted-foreground uppercase font-medium">{rec.desig || "Staff"}</span>
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
                            (rec.displayStatus === 'Present' || rec.displayStatus.includes('Present')) && "bg-emerald-500 text-white border-none",
                            rec.displayStatus === 'Absent' && "bg-rose-500 text-white border-none",
                            rec.displayStatus.includes('Weekend') && "bg-gradient-to-r from-sky-400 to-emerald-500 text-white border-none",
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
           <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest mt-1">Real-time Performance Metrics & Workforce Diagnostics</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline" className="h-10 px-4 border-slate-200 bg-slate-50 text-slate-700 font-black text-xs uppercase font-mono tracking-wider shadow-sm flex items-center gap-2 rounded-2xl">
            <CalendarDays className="w-4 h-4 text-primary" /> {todayStr ? format(parseISO(todayStr), "dd MMM yyyy") : "--"}
          </Badge>
          
          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
             <Factory className="w-4 h-4 text-primary ml-2" />
             <Select value={selectedPlantId} onValueChange={setSelectedPlantId}>
                <SelectTrigger className="h-7 w-[200px] border-none font-black text-xs uppercase focus:ring-0 bg-transparent shadow-none">
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
      </div>

      {/* METRIC METERS ROW (CLEAN TRIPLE CARD GRID TEMPLATE - LEAVE REMOVED) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard 
          title="Total Staff" 
          value={stats.totalEmployees} 
          icon={Users} 
          description="Active headcount" 
          isLoading={isLoading && employees.length === 0}
          onClick={() => setViewMode('employees')} 
        />
        <StatCard 
          title="Present" 
          value={stats.presentToday} 
          icon={CalendarCheck} 
          trend={`${stats.attendancePct}%`} 
          description="Clocked-in logs" 
          isLoading={isLoading && attendanceRecords.length === 0}
          onClick={() => setViewMode('present')} 
        />
        <StatCard 
          title="Absent" 
          value={stats.absentToday} 
          icon={UserX} 
          description="Unmarked exception" 
          isLoading={isLoading}
          onClick={() => setViewMode('absent')} 
        />
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, trend, description, isLoading, onClick }: any) {
  return (
    <Card className="shadow-sm cursor-pointer hover:shadow-md transition-all border-slate-100 group overflow-hidden rounded-[2rem] bg-white" onClick={onClick}>
      <CardContent className="p-7 flex justify-between items-center">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
             {trend && <Badge className="text-[9px] font-black bg-emerald-500/10 text-emerald-600 border-none">{trend}</Badge>}
          </div>
          <h3 className="text-4xl font-black text-slate-900 tracking-tighter font-mono">
            {isLoading ? (
              <Loader2 className="w-6 h-6 animate-spin text-slate-300 mt-2" />
            ) : (
              value
            )}
          </h3>
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight pt-1 flex items-center gap-1.5">
             <span className="w-1 h-1 rounded-full bg-primary" /> {description}
          </p>
        </div>
        <div className="p-5 rounded-3xl bg-slate-50 group-hover:bg-primary/10 transition-colors">
          <Icon className="w-7 h-7 text-slate-400 group-hover:text-primary" />
        </div>
      </CardContent>
    </Card>
  );
}