
"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
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
  ShieldCheck
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
import { format, subDays, isWithinInterval, parseISO } from "date-fns";
import { useData } from "@/context/data-context";
import { formatCurrency, cn } from "@/lib/utils";

type ReportType = "ATTENDANCE" | "PAYROLL";

export default function ReportsPage() {
  const { employees, attendanceRecords, payrollRecords, plants, firms } = useData();
  const { toast } = useToast();

  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeReport, setActiveReport] = useState<ReportType | null>(null);
  
  // Filter States
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedFirmIds, setSelectedFirmIds] = useState<string[]>([]);

  // View States
  const [viewData, setViewData] = useState<any[] | null>(null);
  const [viewType, setViewType] = useState<ReportType | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  useEffect(() => {
    const end = new Date();
    const start = subDays(end, 90);
    setFromDate(format(start, "yyyy-MM-dd"));
    setToDate(format(end, "yyyy-MM-dd"));
    setSelectedFirmIds(firms.map(f => f.id));
  }, [firms]);

  const openReportDialog = (type: ReportType) => {
    setActiveReport(type);
    setIsDialogOpen(true);
  };

  const toggleFirm = (id: string) => {
    setSelectedFirmIds(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const processReportData = () => {
    if (!activeReport) return [];

    const start = parseISO(fromDate);
    const end = parseISO(toDate);

    if (activeReport === "ATTENDANCE") {
      return attendanceRecords
        .filter(rec => {
          const recDate = parseISO(rec.date);
          const emp = employees.find(e => e.employeeId === rec.employeeId);
          const firmMatch = emp && selectedFirmIds.includes(emp.firmId);
          const dateMatch = isWithinInterval(recDate, { start, end });
          return firmMatch && dateMatch;
        })
        .map(rec => {
          const emp = employees.find(e => e.employeeId === rec.employeeId);
          const firm = firms.find(f => f.id === emp?.firmId);
          const plant = plants.find(p => p.id === emp?.unitId);
          return {
            firmName: firm?.name || "N/A",
            unit: plant?.name || "N/A",
            employeeId: rec.employeeId,
            employeeName: rec.employeeName,
            fatherName: emp?.fatherName || "N/A",
            department: emp?.department || "N/A",
            designation: emp?.designation || "N/A",
            inDateTime: `${rec.date} ${rec.inTime || "--:--"}`,
            inLocation: rec.address || "N/A",
            outDateTime: `${rec.date} ${rec.outTime || "--:--"}`,
            outLocation: rec.addressOut || "N/A",
            attendanceType: rec.attendanceType,
            status: rec.status,
            approvedBy: rec.approved ? "HR_ADMIN" : "PENDING"
          };
        });
    } else {
      return payrollRecords
        .filter(pay => {
          const slipDate = pay.slipDate ? parseISO(pay.slipDate) : null;
          const emp = employees.find(e => e.employeeId === pay.employeeId);
          const firmMatch = emp && selectedFirmIds.includes(emp.firmId);
          const dateMatch = slipDate && isWithinInterval(slipDate, { start, end });
          return firmMatch && dateMatch;
        })
        .map(pay => {
          const emp = employees.find(e => e.employeeId === pay.employeeId);
          const firm = firms.find(f => f.id === emp?.firmId);
          const plant = plants.find(p => p.id === emp?.unitId);
          return {
            firmName: firm?.name || "N/A",
            unit: plant?.name || "N/A",
            slipNo: pay.slipNo || "N/A",
            slipDate: pay.slipDate || "N/A",
            employeeId: pay.employeeId,
            employeeName: pay.employeeName,
            department: emp?.department || "N/A",
            designation: emp?.designation || "N/A",
            month: pay.month,
            earningDays: pay.totalEarningDays,
            netPayable: pay.netPayable,
            salaryPaid: pay.salaryPaidAmount,
            paidDate: pay.salaryPaidDate || "N/A",
            pfEmployee: pay.pfAmountEmployee,
            pfEmployer: pay.pfAmountEmployer,
            pfPaid: pay.pfPaidAmountEmployee + pay.pfPaidAmountEmployer,
            pfPaidDate: pay.pfPaidDate || "N/A",
            esicEmployee: pay.esicAmountEmployee,
            esicEmployer: pay.esicAmountEmployer,
            esicPaid: pay.esicPaidAmountEmployee + pay.esicPaidAmountEmployer,
            esicPaidDate: pay.esicPaidDate || "N/A"
          };
        });
    }
  };

  const handleExport = () => {
    const data = processReportData();
    if (data.length === 0) {
      toast({ variant: "destructive", title: "No Data", description: "No records found for the selected filters." });
      return;
    }

    const headers = Object.keys(data[0]).map(h => h.replace(/([A-Z])/g, ' $1').toUpperCase());
    const csvContent = [
      headers.join(","),
      ...data.map(row => Object.values(row).map(v => `"${v}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${activeReport}_Report_${fromDate}_to_${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setIsDialogOpen(false);
    toast({ title: "Export Success", description: "Your report has been downloaded." });
  };

  const handleView = () => {
    const data = processReportData();
    if (data.length === 0) {
      toast({ variant: "destructive", title: "No Data", description: "No records found for the selected filters." });
      return;
    }
    setViewData(data);
    setViewType(activeReport);
    setCurrentPage(1);
    setIsDialogOpen(false);
  };

  const paginatedData = useMemo(() => {
    if (!viewData) return [];
    const start = (currentPage - 1) * rowsPerPage;
    return viewData.slice(start, start + rowsPerPage);
  }, [viewData, currentPage]);

  const totalPages = viewData ? Math.ceil(viewData.length / rowsPerPage) : 0;

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Analytics & Reports</h1>
          <p className="text-muted-foreground">Strategic workforce insights and compliance summaries.</p>
        </div>
        {viewData && (
          <Button variant="outline" className="gap-2 font-bold" onClick={() => setViewData(null)}>
            <X className="w-4 h-4" /> Clear View
          </Button>
        )}
      </div>

      {!viewData ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <ReportCard 
            title="Attendance Export" 
            description="Daily logs with GPS audit, status tracking, and approval history." 
            icon={FileBarChart2}
            onClick={() => openReportDialog("ATTENDANCE")}
          />
          <ReportCard 
            title="Payroll Summary" 
            description="Consolidated earnings, statutory PF/ESIC liabilities, and disbursement status." 
            icon={FileText}
            onClick={() => openReportDialog("PAYROLL")}
          />
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card className="border-none shadow-xl overflow-hidden">
            <CardHeader className="bg-slate-900 text-white p-6 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <TableIcon className="w-5 h-5 text-primary" />
                  {viewType === "ATTENDANCE" ? "Attendance Ledger View" : "Payroll Summary View"}
                </CardTitle>
                <CardDescription className="text-slate-400 font-bold">
                  Period: {fromDate} to {toDate} | {viewData.length} Records Found
                </CardDescription>
              </div>
              <Button className="bg-primary hover:bg-primary/90 font-bold" onClick={() => { setActiveReport(viewType); handleExport(); }}>
                <Download className="w-4 h-4 mr-2" /> Download Excel
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="w-full">
                <Table className="min-w-[1200px]">
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      {viewData[0] && Object.keys(viewData[0]).map((h) => (
                        <TableHead key={h} className="font-black uppercase text-[10px] tracking-widest whitespace-nowrap px-6 py-4">
                          {h.replace(/([A-Z])/g, ' $1')}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.map((row, idx) => (
                      <TableRow key={idx} className="hover:bg-slate-50/50">
                        {Object.entries(row).map(([key, val], i) => (
                          <TableCell key={i} className="px-6 py-4 text-xs font-medium text-slate-600">
                            {typeof val === 'number' && key.toLowerCase().includes('amount' || 'payable' || 'salary' || 'pf' || 'esic' || 'net') 
                              ? formatCurrency(val) 
                              : String(val)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" className="bg-slate-100" />
              </ScrollArea>
            </CardContent>
            <CardFooter className="bg-slate-50 border-t flex items-center justify-between p-4">
              <div className="text-xs font-bold text-muted-foreground">
                Showing {((currentPage - 1) * rowsPerPage) + 1} - {Math.min(currentPage * rowsPerPage, viewData.length)} of {viewData.length}
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="text-xs font-black px-4">Page {currentPage} of {totalPages}</div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Report Generation Dialog - Updated to Firm Selection */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl font-black">
              <Filter className="w-6 h-6 text-primary" />
              Generate {activeReport === "ATTENDANCE" ? "Attendance" : "Payroll"} Report
            </DialogTitle>
            <DialogDescription>Select specific filters to compile your data export based on Firms.</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-8 py-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">From Date</Label>
                <Input 
                  type="date" 
                  value={fromDate} 
                  onChange={(e) => setFromDate(e.target.value)} 
                  className="h-12 bg-slate-50 border-slate-200 font-bold"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">To Date</Label>
                <Input 
                  type="date" 
                  value={toDate} 
                  onChange={(e) => setToDate(e.target.value)} 
                  className="h-12 bg-slate-50 border-slate-200 font-bold"
                />
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" /> Multi-Firm Selection
              </Label>
              <div className="p-4 bg-slate-50 rounded-2xl border-2 border-slate-100 max-h-48 overflow-y-auto space-y-3 custom-scrollbar">
                {firms.map((firm) => (
                  <div key={firm.id} className="flex items-center space-x-3 bg-white p-2 rounded-lg border border-slate-100">
                    <Checkbox 
                      id={`f-${firm.id}`} 
                      checked={selectedFirmIds.includes(firm.id)} 
                      onCheckedChange={() => toggleFirm(firm.id)} 
                    />
                    <label htmlFor={`f-${firm.id}`} className="text-sm font-bold text-slate-700 cursor-pointer flex-1">
                      {firm.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-3 sm:gap-0 mt-4 border-t pt-6">
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="h-12 rounded-xl font-bold">
              Cancel
            </Button>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" onClick={handleView} className="h-12 px-6 font-bold rounded-xl flex-1 sm:flex-none">
                <Eye className="w-4 h-4 mr-2" /> View
              </Button>
              <Button onClick={handleExport} className="h-12 px-8 bg-primary font-black rounded-xl shadow-lg shadow-primary/20 flex-1 sm:flex-none">
                <Download className="w-4 h-4 mr-2" /> Export
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReportCard({ title, description, icon: Icon, onClick }: any) {
  return (
    <Card className="hover:border-primary transition-all cursor-pointer group border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 bg-white">
      <CardContent className="p-10">
        <div className="w-16 h-16 rounded-3xl bg-slate-50 flex items-center justify-center mb-8 group-hover:bg-primary/10 transition-colors shadow-inner">
          <Icon className="w-8 h-8 text-slate-400 group-hover:text-primary transition-colors" />
        </div>
        <h3 className="text-2xl font-black mb-3 text-slate-900">{title}</h3>
        <p className="text-sm text-muted-foreground mb-10 leading-relaxed font-medium">{description}</p>
        
        <Button onClick={onClick} className="w-full h-14 font-black bg-slate-900 text-white hover:bg-primary transition-all rounded-2xl shadow-lg group-hover:shadow-primary/20">
          <Download className="w-4 h-4 mr-2" />
          Generate Report
        </Button>
      </CardContent>
    </Card>
  );
}
