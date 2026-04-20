
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
  const { employees, attendanceRecords, payrollRecords, plants, firms } = useData();
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

  const paginatedData = useMemo(() => {
    if (!viewData) return [];
    return viewData.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);
  }, [viewData, currentPage]);

  const totalPages = viewData ? Math.ceil(viewData.length / ROWS_PER_PAGE) : 0;

  const handleExport = (typeOverride?: ReportType) => {
    const data = processReportData(typeOverride);
    if (!data.length) return toast({ variant: "destructive", title: "No Data" });
    const csv = [Object.keys(data[0]).join(","), ...data.map(r => Object.values(r).map(v => `"${v}"`).join(","))].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(new Blob([csv], { type: 'text/csv' })));
    link.setAttribute("download", `Report_${fromDate}_to_${toDate}.csv`);
    link.click();
  };

  const processReportData = (typeOverride?: ReportType) => {
    const type = typeOverride || activeReport;
    if (!type) return [];
    const start = parseISO(fromDate), end = parseISO(toDate);
    if (type === "ATTENDANCE") {
      return attendanceRecords.filter(r => r.date >= PROJECT_START_DATE_STR && isWithinInterval(parseISO(r.date), { start, end }) && selectedFirmIds.includes(employees.find(e => e.employeeId === r.employeeId)?.firmId || "")).map(r => ({ Name: r.employeeName, ID: r.employeeId, Date: r.date, Status: r.status }));
    }
    return payrollRecords.filter(p => p.month >= "Apr-26" && selectedFirmIds.includes(employees.find(e => e.employeeId === p.employeeId)?.firmId || "")).map(p => ({ Name: p.employeeName, ID: p.employeeId, Month: p.month, Net: p.netPayable }));
  };

  return (
    <TooltipProvider>
      <div className="space-y-8 pb-20">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-black">Analytics & Reports</h1>
          {viewData && <Button variant="outline" onClick={() => setViewData(null)}><X className="w-4 h-4" /> Clear</Button>}
        </div>
        {!viewData ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <ReportCard title="Attendance Export" icon={FileBarChart2} onClick={() => { setActiveReport("ATTENDANCE"); setIsDialogOpen(true); }} />
            <ReportCard title="Payroll Summary" icon={FileText} onClick={() => { setActiveReport("PAYROLL"); setIsDialogOpen(true); }} />
          </div>
        ) : (
          <Card className="border-none shadow-xl overflow-hidden">
            <CardHeader className="bg-slate-900 text-white flex flex-row items-center justify-between"><CardTitle>{viewType} View</CardTitle><Button onClick={() => handleExport(viewType!)}><Download className="w-4 h-4 mr-2" /> Excel</Button></CardHeader>
            <CardContent className="p-0"><Table><TableHeader className="bg-slate-50"><TableRow>{viewData[0] && Object.keys(viewData[0]).map(h => <TableHead key={h} className="font-black uppercase text-[10px]">{h}</TableHead>)}</TableRow></TableHeader><TableBody>{paginatedData.map((row, idx) => (<TableRow key={idx}>{Object.values(row).map((val: any, i) => <TableCell key={i} className="px-6 py-4 text-xs">{val}</TableCell>)}</TableRow>))}</TableBody></Table></CardContent>
            {totalPages > 1 && (
              <CardFooter className="bg-slate-50 border-t flex flex-col sm:flex-row items-center justify-between p-4 gap-4">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="font-bold h-9"><ChevronLeft className="w-4 h-4 mr-1" /> Previous</Button>
                  <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="font-bold h-9">Next <ChevronRight className="w-4 h-4 ml-1" /></Button>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Page {currentPage} of {totalPages}</span>
                  <div className="flex items-center gap-2 border-l pl-4 border-slate-200">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Jump To</Label>
                    <div className="flex gap-1">
                      <Input type="number" className="w-14 h-9 text-center font-bold" value={currentPage} onChange={(e) => { const p = parseInt(e.target.value); if (p >= 1 && p <= totalPages) setCurrentPage(p); }} />
                      <div className="w-9 h-9 bg-slate-900 rounded-lg flex items-center justify-center text-white"><ArrowRightCircle className="w-4 h-4" /></div>
                    </div>
                  </div>
                </div>
              </CardFooter>
            )}
          </Card>
        )}
      </div>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}><DialogContent><DialogHeader><DialogTitle>Generate {activeReport} Report</DialogTitle></DialogHeader><div className="space-y-4 py-4"><div className="grid grid-cols-2 gap-4"><div><Label>From</Label><Input type="date" value={fromDate} min={PROJECT_START_DATE_STR} onChange={(e) => setFromDate(e.target.value)} /></div><div><Label>To</Label><Input type="date" value={toDate} min={fromDate} onChange={(e) => setToDate(e.target.value)} /></div></div></div><DialogFooter><Button variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancel</Button><Button onClick={() => { const d = processReportData(); setViewData(d); setViewType(activeReport); setIsDialogOpen(false); }}>View</Button></DialogFooter></DialogContent></Dialog>
    </TooltipProvider>
  );
}
function ReportCard({ title, icon: Icon, onClick }: any) { return (<Card className="cursor-pointer hover:shadow-xl p-10 bg-white" onClick={onClick}><div className="w-16 h-16 rounded-3xl bg-slate-50 flex items-center justify-center mb-8"><Icon className="w-8 h-8 text-slate-400" /></div><h3 className="text-2xl font-black mb-3">{title}</h3><Button className="w-full h-14 font-black bg-slate-900">Generate Report</Button></Card>); }
