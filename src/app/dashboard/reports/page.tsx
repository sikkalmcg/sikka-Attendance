
"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { 
  FileBarChart2, 
  FileText, 
  Download, 
  CalendarDays,
  X,
  Eye,
  Building2,
  CheckCircle2,
  Table as TableIcon,
  ChevronLeft,
  ChevronRight,
  Filter,
  ShieldCheck,
  ArrowRightCircle,
  Factory
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableRow, 
  TableHead, 
  TableCell 
} from "@/components/ui/table";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, subDays, isWithinInterval, parseISO, isAfter } from "date-fns";
import { useData } from "@/context/data-context";
import { formatCurrency, cn, formatDate, getWorkingHoursColor, formatMinutesToHHMM, formatHoursToHHMM } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type ReportType = "ATTENDANCE" | "PAYROLL";
const PROJECT_START_DATE_STR = "2026-04-01";
const ROWS_PER_PAGE = 15;

export default function ReportsPage() {
  const { employees, attendanceRecords, payrollRecords, plants, firms, verifiedUser } = useData();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeReport, setActiveReport] = useState<ReportType | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedFirmIds, setSelectedFirmIds] = useState<string[]>([]);
  const [selectedPlantId, setSelectedPlantId] = useState("all");
  const [viewData, setViewData] = useState<any[] | null>(null);
  const [viewType, setViewType] = useState<ReportType | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const end = new Date();
    const floor = parseISO(PROJECT_START_DATE_STR);
    const start = isAfter(subDays(end, 90), floor) ? subDays(end, 90) : floor;
    setFromDate(format(start, "yyyy-MM-dd"));
    setToDate(format(end, "yyyy-MM-dd"));
    if (firms?.length) setSelectedFirmIds(firms.map(f => f.id));
  }, [firms]);

  const userAssignedPlantIds = useMemo(() => {
    if (!verifiedUser || verifiedUser.role === 'SUPER_ADMIN') return null;
    return verifiedUser.plantIds || [];
  }, [verifiedUser]);

  const authorizedPlants = useMemo(() => {
    if (!userAssignedPlantIds) return plants;
    return plants.filter(p => userAssignedPlantIds.includes(p.id));
  }, [userAssignedPlantIds, plants]);

  const paginatedData = useMemo(() => {
    if (!viewData) return [];
    return viewData.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);
  }, [viewData, currentPage]);

  const totalPages = viewData ? Math.ceil(viewData.length / ROWS_PER_PAGE) : 0;

  const processReportData = (typeOverride?: ReportType) => {
    const type = typeOverride || activeReport;
    if (!type) return [];
    
    const start = parseISO(fromDate);
    const end = parseISO(toDate);

    if (type === "ATTENDANCE") {
      return attendanceRecords
        .filter(r => {
          const d = parseISO(r.date);
          const emp = employees.find(e => e.employeeId === r.employeeId);
          const isHistoryRecord = (r.approved === true || !!r.remark);
          
          // SECURITY: Scope report to assigned plants
          if (userAssignedPlantIds) {
            const hasAccess = (emp?.unitIds || []).some(id => userAssignedPlantIds.includes(id)) || userAssignedPlantIds.includes(r.inPlantId);
            if (!hasAccess) return false;
          }

          // Plant Filter
          if (selectedPlantId !== "all") {
            const empAtPlant = emp?.unitIds?.includes(selectedPlantId) || r.inPlantId === selectedPlantId;
            if (!empAtPlant) return false;
          }

          return r.date >= PROJECT_START_DATE_STR && 
                 isHistoryRecord &&
                 isWithinInterval(d, { start, end }) && 
                 (emp ? selectedFirmIds.includes(emp.firmId) : true);
        })
        .map(r => {
          const emp = employees.find(e => e.employeeId === r.employeeId);
          const assignedPlantNames = emp ? (emp.unitIds || []).map(id => plants.find(p => p.id === id)?.name).filter(Boolean).join(", ") : "N/A";
          return {
            "Employee ID": r.employeeId,
            "Employee Name": r.employeeName,
            "In Plant": r.inPlant || "--",
            "Assigned Plant(s)": assignedPlantNames,
            "In Date": formatDate(r.date),
            "Status": r.remark ? "REJECTED" : r.status,
            "Remark": r.remark || "N/A"
          };
        });
    }

    return payrollRecords
      .filter(p => {
        const emp = employees.find(e => e.employeeId === p.employeeId);
        
        // SECURITY: Scope payroll to assigned plants
        if (userAssignedPlantIds) {
          const hasAccess = (emp?.unitIds || []).some(id => userAssignedPlantIds.includes(id));
          if (!hasAccess) return false;
        }

        // Plant Filter
        if (selectedPlantId !== "all") {
          const empAtPlant = emp?.unitIds?.includes(selectedPlantId);
          if (!empAtPlant) return false;
        }

        return p.month >= "Apr-26" && (emp ? selectedFirmIds.includes(emp.firmId) : true);
      })
      .map(p => {
          const emp = employees.find(e => e.employeeId === p.employeeId);
          const assignedPlantNames = emp ? (emp.unitIds || []).map(id => plants.find(p => p.id === id)?.name).filter(Boolean).join(", ") : "N/A";
          return {
            "Employee Name": p.employeeName,
            "Employee ID": p.employeeId,
            "Plant(s)": assignedPlantNames,
            "Month": p.month,
            "Net Payable": p.netPayable,
            "Status": p.status
          };
      });
  };

  const handleExport = (typeOverride?: ReportType) => {
    const data = processReportData(typeOverride);
    if (!data.length) { toast({ variant: "destructive", title: "No Data" }); return; }
    const csv = [Object.keys(data[0]).join(","), ...data.map(r => Object.values(r).map(v => `"${v}"`).join(","))].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })));
    link.setAttribute("download", `${typeOverride || viewType}_Report.csv`);
    link.click();
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-black">Analytics & Reports</h1>
        {viewData && (
          <Button variant="ghost" onClick={() => { setViewData(null); setViewType(null); }} className="gap-2 font-bold">
            <X className="w-4 h-4" /> Reset View
          </Button>
        )}
      </div>

      {!viewData ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card className="p-10 cursor-pointer hover:shadow-xl transition-all group" onClick={() => { setActiveReport("ATTENDANCE"); setIsDialogOpen(true); }}>
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-primary group-hover:text-white transition-colors">
              <FileBarChart2 className="w-8 h-8 text-primary group-hover:text-white" />
            </div>
            <h3 className="text-xl font-bold">Attendance Export</h3>
            <p className="text-sm text-muted-foreground mt-2">Verified facility-scoped audit trails with GPS coordinates.</p>
          </Card>
          <Card className="p-10 cursor-pointer hover:shadow-xl transition-all group" onClick={() => { setActiveReport("PAYROLL"); setIsDialogOpen(true); }}>
            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <FileText className="w-8 h-8 text-emerald-600 group-hover:text-white" />
            </div>
            <h3 className="text-xl font-bold">Payroll Summary</h3>
            <p className="text-sm text-muted-foreground mt-2">Consolidated monthly earnings data including incentives and recoveries.</p>
          </Card>
        </div>
      ) : (
        <Card className="border-none shadow-2xl overflow-hidden rounded-2xl">
          <CardHeader className="bg-slate-900 text-white flex flex-row items-center justify-between p-6">
            <div>
              <CardTitle>{viewType} View</CardTitle>
              <p className="text-[10px] text-primary font-black uppercase mt-1">Period: {formatDate(fromDate)} to {formatDate(toDate)}</p>
            </div>
            <Button onClick={() => handleExport(viewType!)} className="bg-emerald-600 h-11 px-8 font-black gap-2"><Download className="w-4 h-4" /> Export CSV</Button>
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
                    <TableRow><TableCell colSpan={viewData[0] ? Object.keys(viewData[0]).length : 1} className="text-center py-20 text-muted-foreground font-bold">No records found for the selected parameters.</TableCell></TableRow>
                  ) : (
                    paginatedData.map((row, idx) => (
                      <TableRow key={idx} className="hover:bg-slate-50/50">
                        {Object.values(row).map((val: any, i) => (
                          <TableCell key={i} className="px-6 py-4 text-xs font-bold text-slate-700 whitespace-nowrap">
                            {typeof val === 'number' && Object.keys(row)[i].includes('Payable') ? formatCurrency(val) : val}
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
              <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="font-bold"><ChevronLeft className="w-4 h-4 mr-1" /> Prev</Button>
              <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Page {currentPage} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="font-bold">Next <ChevronRight className="w-4 h-4 ml-1" /></Button>
            </CardFooter>
          )}
        </Card>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl border-none shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-primary" /> Report Parameters
            </DialogTitle>
            <DialogDescription className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Configure your data extraction filters</DialogDescription>
          </DialogHeader>
          
          <div className="p-8 space-y-8">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">From Date</Label>
                <div className="relative">
                  <CalendarDays className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="pl-10 h-12 font-bold rounded-xl border-slate-200 bg-slate-50" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">To Date</Label>
                <div className="relative">
                  <CalendarDays className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="pl-10 h-12 font-bold rounded-xl border-slate-200 bg-slate-50" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                <Factory className="w-3.5 h-3.5" /> Filter by Plant
              </Label>
              <Select value={selectedPlantId} onValueChange={setSelectedPlantId}>
                <SelectTrigger className="h-12 bg-slate-50 border-slate-200 font-bold rounded-xl">
                  <SelectValue placeholder="All Authorized Plants" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all" className="font-bold text-xs uppercase">All Authorized Plants</SelectItem>
                  {authorizedPlants.map(p => (
                    <SelectItem key={p.id} value={p.id} className="font-bold text-xs uppercase">{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="p-6 bg-slate-50 border-t flex flex-col sm:flex-row gap-3">
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="flex-1 font-bold h-12 rounded-xl">Cancel</Button>
            <Button 
              onClick={() => { 
                setCurrentPage(1);
                setViewData(processReportData()); 
                setViewType(activeReport); 
                setIsDialogOpen(false); 
              }} 
              className="flex-1 bg-primary hover:bg-primary/90 font-black h-12 rounded-xl shadow-lg shadow-primary/20"
            >
              Generate Report View
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

