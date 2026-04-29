
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
  ArrowRightCircle
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

          return r.date >= PROJECT_START_DATE_STR && 
                 isHistoryRecord &&
                 isWithinInterval(d, { start, end }) && 
                 (emp ? selectedFirmIds.includes(emp.firmId) : true);
        })
        .map(r => {
          const emp = employees.find(e => e.employeeId === r.employeeId);
          return {
            "Employee ID": r.employeeId,
            "Employee Name": r.employeeName,
            "In Plant": r.inPlant || "--",
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

        return p.month >= "Apr-26" && (emp ? selectedFirmIds.includes(emp.firmId) : true);
      })
      .map(p => ({
          "Employee Name": p.employeeName,
          "Employee ID": p.employeeId,
          "Month": p.month,
          "Net Payable": p.netPayable,
          "Status": p.status
      }));
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
      <h1 className="text-3xl font-black">Analytics & Reports</h1>
      {!viewData ? (
        <div className="grid grid-cols-2 gap-8">
          <Card className="p-10 cursor-pointer hover:shadow-xl transition-all" onClick={() => { setActiveReport("ATTENDANCE"); setIsDialogOpen(true); }}>
            <FileBarChart2 className="w-12 h-12 text-primary mb-4" /><h3 className="text-xl font-bold">Attendance Export</h3><p className="text-sm text-muted-foreground mt-2">Verified facility-scoped audit trails.</p>
          </Card>
          <Card className="p-10 cursor-pointer hover:shadow-xl transition-all" onClick={() => { setActiveReport("PAYROLL"); setIsDialogOpen(true); }}>
            <FileText className="w-12 h-12 text-emerald-600 mb-4" /><h3 className="text-xl font-bold">Payroll Summary</h3><p className="text-sm text-muted-foreground mt-2">Consolidated monthly earnings data.</p>
          </Card>
        </div>
      ) : (
        <Card className="border-none shadow-2xl overflow-hidden rounded-2xl">
          <CardHeader className="bg-slate-900 text-white flex flex-row items-center justify-between p-6">
            <CardTitle>{viewType} View</CardTitle>
            <Button onClick={() => handleExport(viewType!)} className="bg-emerald-600 h-11 px-8 font-black gap-2"><Download className="w-4 h-4" /> Export CSV</Button>
          </CardHeader>
          <CardContent className="p-0"><ScrollArea className="w-full"><Table><TableHeader className="bg-slate-50"><TableRow>{viewData[0] && Object.keys(viewData[0]).map(h => (<TableHead key={h} className="font-black text-[10px] uppercase tracking-widest py-4 px-6">{h}</TableHead>))}</TableRow></TableHeader>
            <TableBody>{paginatedData.map((row, idx) => (<TableRow key={idx}>{Object.values(row).map((val: any, i) => (<TableCell key={i} className="px-6 py-4 text-xs font-bold text-slate-700">{val}</TableCell>))}</TableRow>))}</TableBody></Table><ScrollBar orientation="horizontal"/></ScrollArea></CardContent>
          {totalPages > 1 && <CardFooter className="bg-slate-50 border-t justify-center p-4"><Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>Prev</Button><span className="mx-4 text-xs font-bold">Page {currentPage} of {totalPages}</span><Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>Next</Button></CardFooter>}
        </Card>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Report Parameters</DialogTitle></DialogHeader>
          <div className="space-y-6 py-6"><div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>From</Label><Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} /></div><div className="space-y-2"><Label>To</Label><Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} /></div></div></div>
          <DialogFooter><Button onClick={() => { setViewData(processReportData()); setViewType(activeReport); setIsDialogOpen(false); }} className="w-full h-12 font-black">Generate Report View</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
