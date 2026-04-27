
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
    if (!data.length) {
      toast({ variant: "destructive", title: "No Data", description: "No records found for the selected period." });
      return;
    }
    const csv = [Object.keys(data[0]).join(","), ...data.map(r => Object.values(r).map(v => `"${v}"`).join(","))].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })));
    link.setAttribute("download", `${typeOverride || viewType}_Report_${fromDate}_to_${toDate}.csv`);
    link.click();
    toast({ title: "Export Success" });
  };

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
            "Department": emp?.department || "N/A",
            "Designation": emp?.designation || "N/A",
            "In Plant": r.inPlant || "--",
            "In Date": formatDate(r.date),
            "In Time": r.inTime || "--:--",
            "In Location": r.address || "N/A",
            "Out Plant": r.outPlant || "--",
            "Out Date": r.outTime ? formatDate(r.date) : "--",
            "Out Time": r.outTime || "--:--",
            "Out Location": r.addressOut || "N/A",
            "Out Hour": formatMinutesToHHMM(r.unapprovedOutDuration || 0),
            "Working Hour": formatHoursToHHMM(r.hours),
            "Attendance Type": r.attendanceType,
            "Status": r.remark ? "REJECTED" : r.status,
            "Remark": r.remark || "N/A"
          };
        });
    }

    return payrollRecords
      .filter(p => {
        const emp = employees.find(e => e.employeeId === p.employeeId);
        return p.month >= "Apr-26" && (emp ? selectedFirmIds.includes(emp.firmId) : true);
      })
      .map(p => {
        const emp = employees.find(e => e.employeeId === p.employeeId);
        return {
          "Employee Name": p.employeeName,
          "Employee ID": p.employeeId,
          "Department": emp?.department || "N/A",
          "Month": p.month,
          "Attendance Days": p.attendance,
          "Absent Days": p.absent,
          "Incentive Amt": p.incentiveAmt,
          "Net Payable": p.netPayable,
          "Status": p.status
        };
      });
  };

  return (
    <TooltipProvider>
      <div className="space-y-8 pb-20">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Analytics & Reports</h1>
            <p className="text-muted-foreground text-sm">Export verified workforce and payroll data for financial audits.</p>
          </div>
          {viewData && (
            <Button variant="outline" onClick={() => setViewData(null)} className="h-10 font-bold gap-2">
              <X className="w-4 h-4" /> Clear Current View
            </Button>
          )}
        </div>

        {!viewData ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <ReportCard 
              title="Attendance Export" 
              description="Detailed audit trail of IN/OUT logs, GPS locations, and plants."
              icon={FileBarChart2} 
              onClick={() => { setActiveReport("ATTENDANCE"); setIsDialogOpen(true); }} 
            />
            <ReportCard 
              title="Payroll Summary" 
              description="Overview of monthly earnings, deductions, and payment statuses."
              icon={FileText} 
              onClick={() => { setActiveReport("PAYROLL"); setIsDialogOpen(true); }} 
            />
          </div>
        ) : (
          <Card className="border-none shadow-2xl overflow-hidden rounded-2xl">
            <CardHeader className="bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between p-6 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
                  <TableIcon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl font-black">{viewType} View</CardTitle>
                  <CardDescription className="text-slate-400 font-medium">Verified History Records (Approved/Remarked)</CardDescription>
                </div>
              </div>
              <Button onClick={() => handleExport(viewType!)} className="bg-emerald-600 hover:bg-emerald-700 h-11 px-8 font-black gap-2">
                <Download className="w-4 h-4" /> Export to Excel (CSV)
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="w-full">
                <Table className="min-w-[2000px]">
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      {viewData[0] && Object.keys(viewData[0]).map(h => (
                        <TableHead key={h} className="font-black uppercase text-[10px] tracking-widest text-slate-500 py-4 px-6 border-r border-slate-100 last:border-0">
                          {h}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.map((row, idx) => (
                      <TableRow key={idx} className="hover:bg-slate-50/50 transition-colors">
                        {Object.values(row).map((val: any, i) => (
                          <TableCell key={i} className="px-6 py-4 text-xs font-bold text-slate-700 border-r border-slate-100 last:border-0">
                            {val === "PRESENT" ? <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 text-[9px] font-black">PRESENT</Badge> :
                             val === "ABSENT" ? <Badge className="bg-rose-50 text-rose-700 border-rose-100 text-[9px] font-black">ABSENT</Badge> :
                             val === "REJECTED" ? <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[9px] font-black">REJECTED</Badge> :
                             val}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </CardContent>
            {totalPages > 1 && (
              <CardFooter className="bg-slate-50 border-t flex flex-col sm:flex-row items-center justify-between p-4 gap-4">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="font-bold h-9">
                    <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                  </Button>
                  <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="font-bold h-9">
                    Next <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs font-black text-slate-500 uppercase tracking-widest">
                    Page {currentPage} of {totalPages}
                  </span>
                  <div className="flex items-center gap-2 border-l pl-4 border-slate-200">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Jump To</Label>
                    <div className="flex gap-1">
                      <Input 
                        type="number" 
                        className="w-14 h-9 text-center font-bold" 
                        value={currentPage} 
                        onChange={(e) => {
                          const p = parseInt(e.target.value);
                          if (p >= 1 && p <= totalPages) setCurrentPage(p);
                        }} 
                      />
                      <div className="w-9 h-9 bg-slate-900 rounded-lg flex items-center justify-center text-white">
                        <ArrowRightCircle className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </div>
              </CardFooter>
            )}
          </Card>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-slate-900">Generate {activeReport} Report</DialogTitle>
            <DialogDescription>Define the data range and firms to include in the export.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-500">From Date</Label>
                <Input type="date" value={fromDate} min={PROJECT_START_DATE_STR} onChange={(e) => setFromDate(e.target.value)} className="h-12 bg-slate-50 font-bold" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-500">To Date</Label>
                <Input type="date" value={toDate} min={fromDate} onChange={(e) => setToDate(e.target.value)} className="h-12 bg-slate-50 font-bold" />
              </div>
            </div>
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5" /> Selected Firms
              </Label>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 max-h-40 overflow-y-auto space-y-2">
                {firms.map(f => (
                  <div key={f.id} className="flex items-center gap-2">
                    <Checkbox 
                      id={`f-${f.id}`} 
                      checked={selectedFirmIds.includes(f.id)}
                      onCheckedChange={(checked) => {
                        setSelectedFirmIds(prev => checked ? [...prev, f.id] : prev.filter(id => id !== f.id));
                      }}
                    />
                    <label htmlFor={`f-${f.id}`} className="text-xs font-bold text-slate-700 cursor-pointer">{f.name}</label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 bg-slate-50 -m-6 mt-2 p-6 rounded-b-2xl border-t">
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-xl font-bold">Cancel</Button>
            <Button 
              className="bg-primary hover:bg-primary/90 rounded-xl font-black px-10 h-12 shadow-lg shadow-primary/20"
              onClick={() => { 
                const d = processReportData(); 
                setViewData(d); 
                setViewType(activeReport); 
                setIsDialogOpen(false); 
                setCurrentPage(1);
              }}
            >
              Generate View
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}

function ReportCard({ title, description, icon: Icon, onClick }: any) { 
  return (
    <Card className="cursor-pointer group hover:shadow-2xl transition-all duration-300 border-none bg-white p-10 flex flex-col h-full rounded-3xl" onClick={onClick}>
      <div className="w-16 h-16 rounded-3xl bg-slate-50 group-hover:bg-primary/10 flex items-center justify-center mb-8 transition-colors">
        <Icon className="w-8 h-8 text-slate-400 group-hover:text-primary transition-colors" />
      </div>
      <div className="space-y-3 flex-1">
        <h3 className="text-2xl font-black text-slate-900">{title}</h3>
        <p className="text-sm font-medium text-slate-500 leading-relaxed">{description}</p>
      </div>
      <Button className="w-full h-14 font-black bg-slate-900 group-hover:bg-primary transition-all rounded-2xl mt-10 gap-2">
        Generate Full Report <ArrowRightCircle className="w-4 h-4" />
      </Button>
    </Card>
  ); 
}
