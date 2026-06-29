"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { 
  FileBarChart2, 
  Download, 
  X, 
  Building2, 
  ChevronLeft, 
  ChevronRight, 
  Filter
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableRow, 
  TableHead, 
  TableCell 
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, subDays, isAfter, eachDayOfInterval, isSunday, startOfDay, isValid, addHours, parseISO } from "date-fns";
import { useData } from "@/context/data-context";
import { cn, formatDate, formatHoursToHHMM, isEmployeeActiveOnDate } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";

type ReportType = "ATTENDANCE";
const PROJECT_START_DATE_STR = "2026-04-01";
const ROWS_PER_PAGE = 15;

const formatLocation = (address?: string, lat?: number, lng?: number) => {
  if (address && address !== "Location Not Available" && address.trim() !== "") {
    const isCoordinateString = /^-?\d+\.\d+, -?\d+\.\d+$/.test(address);
    if (!isCoordinateString) return address;
  }
  if (lat !== undefined && lng !== undefined && lat !== 0 && lng !== 0) {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }
  return address || "Location Not Available";
};

export default function ReportsPage() {
  // NOTE: Attendance History Ledger has been implemented as a dedicated route:
  // /dashboard/reports/attendance-history-ledger
  const router = useRouter();
  const { employees = [], attendanceRecords = [], verifiedUser, holidays = [], leaveRequests = [], plants = [] } = useData();
  const { toast } = useToast();

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedPlantFilter, setSelectedPlantFilter] = useState("all");
  const [viewData, setViewData] = useState<any[] | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isMounted, setIsMounted] = useState(false);

  // Initialize dates when page mounts
  useEffect(() => {
    setIsMounted(true);
    const end = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const floor = parseISO(PROJECT_START_DATE_STR);
    const start = isAfter(subDays(end, 90), floor) ? subDays(end, 90) : floor;
    setFromDate(format(start, "yyyy-MM-dd"));
    setToDate(format(end, "yyyy-MM-dd"));
  }, []);

  const userAssignedPlantIds = useMemo(() => {
    if (!verifiedUser || verifiedUser.role === 'SUPER_ADMIN') return null;
    return verifiedUser.plantIds || [];
  }, [verifiedUser]);

  const authorizedPlants = useMemo(() => {
    if (!userAssignedPlantIds) return plants || [];
    return (plants || []).filter(p => userAssignedPlantIds.includes(p.id || (p as any)._id));
  }, [userAssignedPlantIds, plants]);

  const paginatedData = useMemo(() => {
    if (!viewData) return [];
    return viewData.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);
  }, [viewData, currentPage]);

  const totalPages = viewData ? Math.ceil(viewData.length / ROWS_PER_PAGE) : 0;

  // COMPACT LIVE FETCH ENGINE (Fixed Object Mappings)
  const processReportData = () => {
    if (!fromDate || !toDate) return [];
    
    try {
      const start = startOfDay(parseISO(fromDate));
      const end = startOfDay(parseISO(toDate));

      if (!isValid(start) || !isValid(end) || isAfter(start, end)) {
        toast({
          variant: "destructive",
          title: "Invalid Date Range",
          description: "The 'From' date cannot be after the 'To' date.",
        });
        return [];
      }

      const allReportData: any[] = [];
      const employeeMap = new Map((employees || []).map(e => [e.employeeId, e]));
      const approvedLeavesMap = new Map<string, any>();
      
      (leaveRequests || []).filter(l => String(l.status).toUpperCase() === 'APPROVED').forEach(l => {
        const lStart = startOfDay(parseISO(l.fromDate));
        const lEnd = startOfDay(parseISO(l.toDate));
        if (!isValid(lStart) || !isValid(lEnd)) return;
        eachDayOfInterval({ start: lStart, end: lEnd }).forEach(d => {
          approvedLeavesMap.set(`${l.employeeId}:${format(d, 'yyyy-MM-dd')}`, l);
        });
      });

      // 1. ACTUAL ATTENDANCE DATABASE RECORD MATRIX
      const filteredActual = (attendanceRecords || []).filter(rec => {
        const emp = employeeMap.get(rec.employeeId);
        if (!emp) return false;
        
        const recDate = startOfDay(parseISO(rec.date));
        if (recDate < start || recDate > end) return false;
        if (!isEmployeeActiveOnDate(emp, rec.date)) return false;

        if (selectedPlantFilter !== "all" && rec.inPlant !== selectedPlantFilter) return false;

        if (!userAssignedPlantIds) return true;
        return (emp.unitIds || []).some(id => userAssignedPlantIds.includes(id)) || userAssignedPlantIds.includes(emp.unitId);
      });

      filteredActual.forEach(rec => {
        const emp = employeeMap.get(rec.employeeId);
        const isSun = isSunday(parseISO(rec.date));
        const customHoliday = (holidays || []).find(h => h.date === rec.date && !h.auto);

        let displayStatus: string = rec.status || "Present";
        if (isSun && !rec.status) displayStatus = "Present on Weekly Off";
        else if (customHoliday && !rec.status) displayStatus = "Present on Holiday";

        let inDateTime = rec.inTime ? `${formatDate(rec.inDate || rec.date)} ${rec.inTime}` : "--";
        let outDateTime = "--";
        let workingHour = (rec as any).workingHours || formatHoursToHHMM(rec.hours || 0);
        let markingRemark = rec.remark || "--";

        if (!rec.outTime && rec.inTime) {
          const inDT = parseISO((rec as any).inDateTime || `${rec.inDate || rec.date}T${rec.inTime}:00`);
          if (inDT && isValid(inDT)) {
            const diffHours = (new Date().getTime() - inDT.getTime()) / (1000 * 60 * 60);
            if (diffHours >= 16 || rec.autoCheckout) {
              const autoOutDT = addHours(inDT, 16);
              outDateTime = `${formatDate(format(autoOutDT, "yyyy-MM-dd"))} ${format(autoOutDT, "HH:mm")}`;
              workingHour = "16:00";
              if (!rec.remark) markingRemark = "System Auto-Logged OUT (16h Limit Threshold reached)";
            }
          }
        } else if (rec.outTime) {
          outDateTime = `${formatDate(rec.outDate || rec.date)} ${rec.outTime}`;
        }

        allReportData.push({
          "Employee ID": rec.employeeId,
          "Employee Name": emp?.firstName ? `${emp.firstName} ${emp.lastName || ''}`.trim() : (rec.employeeName || emp?.name || "--"),
          "In Date Time": inDateTime,
          "In Plant": rec.inPlant || "Salt Plant",
          "Out Date Time": outDateTime,
          "In Location": formatLocation(rec.address || (rec as any).inLocation, rec.lat, rec.lng),
          "Out Location": formatLocation(rec.addressOut || (rec as any).outLocation, rec.latOut, rec.lngOut),
          "Working Hour": workingHour === "00:00" && rec.hours > 0 ? formatHoursToHHMM(rec.hours) : workingHour,
          "Status": displayStatus,
          "Approval": rec.approvedBy || ((rec.approved === true || String(rec.approved) === "true" || rec.status === "Closed") ? "Approved" : "Pending"),
          "Remark": markingRemark
        });
      });

      // 2. ABSENT / COMPLIANCE SYSTEM GENERATOR LOOKUP LINK
      const handledRecordsKeySet = new Set((attendanceRecords || []).map(r => `${r.employeeId}:${r.date}`));
      const dateRangeInterval = eachDayOfInterval({ start, end });

      (employees || []).forEach(emp => {
        if (userAssignedPlantIds) {
          const hasAccess = (emp.unitIds || []).some(id => userAssignedPlantIds.includes(id)) || userAssignedPlantIds.includes(emp.unitId);
          if (!hasAccess) return;
        }

        dateRangeInterval.forEach(date => {
          const dateStr = format(date, "yyyy-MM-dd");
          if (!isEmployeeActiveOnDate(emp, dateStr)) return;

          const key = `${emp.employeeId}:${dateStr}`;
          if (!handledRecordsKeySet.has(key)) {
            const isSun = isSunday(date);
            const customHoliday = (holidays || []).find(h => h.date === dateStr && !h.auto);
            const leave = approvedLeavesMap.get(`${emp.employeeId}:${dateStr}`);

            let displayStatus = "Absent";
            let approvalState = "Unmarked";
            let remarkText = "--";

            if (leave) {
              displayStatus = "Absent on Leave";
              approvalState = "Approved";
              remarkText = `Leave: ${leave.purpose}`;
            } else if (isSun) {
              displayStatus = "Weekly Off";
              approvalState = "System Link";
            } else if (customHoliday) {
              displayStatus = "Holiday";
              approvalState = "System Link";
            }

            const virtualPlantName = selectedPlantFilter !== "all" ? selectedPlantFilter : "Salt Plant";

            allReportData.push({
              "Employee ID": emp.employeeId,
              "Employee Name": emp.firstName ? `${emp.firstName} ${emp.lastName || ''}`.trim() : emp.name,
              "In Date Time": formatDate(dateStr),
              "In Plant": virtualPlantName,
              "Out Date Time": "--",
              "In Location": "Location Not Available",
              "Out Location": "Location Not Available",
              "Working Hour": "00:00",
              "Status": displayStatus,
              "Approval": approvalState,
              "Remark": remarkText
            });
          }
        });
      });

      return allReportData.sort((a, b) => b["In Date Time"].localeCompare(a["In Date Time"]));
    } catch (error) {
      console.error("Error processing report data:", error);
      return [];
    }
  };

  const handleExport = () => {
    const data = processReportData();
    if (!data.length) { toast({ variant: "destructive", title: "No Data Scopes Finalized" }); return; }
    const csv = [Object.keys(data[0]).join(","), ...data.map(r => Object.values(r).map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })));
    link.setAttribute("download", `Sikka_Attendance_Report_${fromDate}_to_${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isMounted) return null;

  return (
    <div className="space-y-8 pb-20 px-4 max-w-7xl mx-auto">
      <div className="flex justify-between items-center border-b pb-5">
        <div>
          <h1 className="text-3xl font-black uppercase flex items-center gap-3">Analytics & Reports</h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">Compile Audited Shift Records and History Ledgers</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => router.push("/dashboard/reports/attendance-history-ledger")}
            className="gap-2 font-black text-xs uppercase bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-4 h-10 shadow-lg"
          >
            <FileBarChart2 className="w-4 h-4" />
            Attendance History Ledger
          </Button>
          {viewData && (
            <Button
              variant="ghost"
              onClick={() => setViewData(null)}
              className="gap-2 font-black text-xs uppercase text-slate-500 hover:bg-slate-100 rounded-xl px-4 h-10 border"
            >
              <X className="w-4 h-4" /> Clear Report
            </Button>
          )}
        </div>
      </div>

      {/* PARAMETERS SECTION */}
      <Card className="border-none shadow-xl rounded-2xl bg-white p-6 space-y-6">
        <div className="flex items-center gap-2 mb-2">
          <Filter className="w-5 h-5 text-primary" /> 
          <h2 className="font-black uppercase text-sm tracking-wider">Report Parameters Setup</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">From Date Range</Label>
            <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="h-12 font-bold rounded-xl border-slate-200 bg-slate-50" />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">To Date Range</Label>
            <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="h-12 font-bold rounded-xl border-slate-200 bg-slate-50" />
          </div>
          <div className="space-y-2 flex flex-col">
            <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-1.5 mb-1">
              <Building2 className="w-3.5 h-3.5 text-primary" /> Scope Filter By Plant
            </Label>
            <Select value={selectedPlantFilter} onValueChange={(value) => setSelectedPlantFilter(value)}>
              <SelectTrigger className="h-12 w-full bg-slate-50 border border-slate-200 font-bold rounded-xl text-xs uppercase focus:ring-0 shadow-none px-4">
                <SelectValue placeholder="ALL AUTHORIZED PLANTS" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border border-slate-200 bg-white shadow-xl z-[9999]">
                <SelectItem value="all" className="font-bold text-xs uppercase py-2 cursor-pointer hover:bg-slate-50 transition-colors">
                  ALL AUTHORIZED PLANTS
                </SelectItem>
                {authorizedPlants.map(p => (
                  <SelectItem key={p.id || (p as any)._id} value={p.name} className="font-bold text-xs uppercase py-2 cursor-pointer hover:bg-slate-50 transition-colors">
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Button 
              onClick={() => { 
                setCurrentPage(1);
                const compiledData = processReportData();
                setViewData(compiledData); 
                if(compiledData && compiledData.length > 0) {
                  toast({ title: "Report preview compiled successfully." });
                } else {
                  toast({ variant: "destructive", title: "No Records Found", description: "No entries matched selection date parameters bounds." });
                }
              }} 
              className="w-full bg-primary hover:bg-primary/90 text-white font-black h-12 rounded-xl shadow-lg shadow-primary/20 uppercase text-xs tracking-wider"
            >
              Generate View
            </Button>
          </div>
        </div>
      </Card>

      {viewData && (
        <Card className="border-none shadow-2xl overflow-hidden rounded-2xl bg-white">
          <CardHeader className="bg-slate-900 text-white flex flex-row items-center justify-between p-6 shrink-0">
            <div>
Attendance History Ledger (legacy preview)
              <p className="text-[10px] text-primary font-black uppercase tracking-widest mt-1">Filter Period: {formatDate(fromDate)} to {formatDate(toDate)}</p>
            </div>
Export CSV Sheet (legacy)
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="w-full">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    {viewData[0] && Object.keys(viewData[0]).map(h => (
                      <TableHead key={h} className="font-black text-[10px] uppercase tracking-widest py-4 px-6 text-slate-500 whitespace-nowrap">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.length === 0 ? (
                    <TableRow><TableCell colSpan={viewData[0] ? Object.keys(viewData[0]).length : 1} className="text-center py-20 text-slate-400 font-bold italic text-xs uppercase bg-slate-50/30">No matching finalized records found.</TableCell></TableRow>
                  ) : (
                    paginatedData.map((row, idx) => (
                      <TableRow key={idx} className="hover:bg-slate-50/50 transition-colors">
                        {Object.entries(row).map(([key, val]: [string, any], i) => (
                          <TableCell key={i} className="px-6 py-4 text-xs font-bold text-slate-700 whitespace-nowrap">
                            {val?.toString() === "Approved" || val?.toString() === "System Link" ? (
                              <Badge className="bg-emerald-50 text-emerald-700 shadow-none border-none font-black text-[9px] uppercase">{val}</Badge>
                            ) : val?.toString() === "Pending" ? (
                              <Badge className="bg-amber-50 text-amber-700 shadow-none border-none font-black text-[9px] uppercase">{val}</Badge>
                            ) : val?.toString() === "Absent" ? (
                              <Badge className="bg-rose-50 text-rose-700 shadow-none border-none font-black text-[9px] uppercase">{val}</Badge>
                            ) : key === "Working Hour" ? (
                              <span className="font-mono font-black text-slate-900">{val}</span>
                            ) : (
                              val
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <ScrollBar orientation="horizontal"/>
            </ScrollArea>
          </CardContent>
          {totalPages > 1 && (
            <CardFooter className="bg-slate-50 border-t flex items-center justify-between p-4">
              <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="font-bold h-9"><ChevronLeft className="w-4 h-4 mr-1" /> Prev</Button>
              <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Page {currentPage} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="font-bold h-9">Next <ChevronRight className="w-4 h-4 ml-1" /></Button>
            </CardFooter>
          )}
        </Card>
      )}
    </div>
  );
}