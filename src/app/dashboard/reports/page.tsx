
"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  FileBarChart2, 
  FileText, 
  Download, 
  CalendarDays,
  X,
  FileSpreadsheet
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
import { format, subDays } from "date-fns";
import { useData } from "@/context/data-context";

type ReportType = "ATTENDANCE" | "PAYROLL";

export default function ReportsPage() {
  const { employees, attendanceRecords, payrollRecords, plants } = useData();
  const { toast } = useToast();

  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeReport, setActiveReport] = useState<ReportType | null>(null);
  
  // Date State (Default 90 days)
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    const end = new Date();
    const start = subDays(end, 90);
    setFromDate(format(start, "yyyy-MM-dd"));
    setToDate(format(end, "yyyy-MM-dd"));
  }, []);

  const openReportDialog = (type: ReportType) => {
    setActiveReport(type);
    setIsDialogOpen(true);
  };

  const handleGenerate = () => {
    if (!activeReport) return;

    toast({ title: "Generating Report", description: "Your download will start shortly..." });

    let csvContent = "";
    let fileName = "";

    if (activeReport === "ATTENDANCE") {
      fileName = `Attendance_Report_${fromDate}_to_${toDate}.csv`;
      const headers = ["Employee ID", "Name", "Date", "IN Time", "OUT Time", "Hours", "Status", "Plant", "Type"];
      const rows = attendanceRecords
        .filter(r => r.date >= fromDate && r.date <= toDate)
        .map(r => [
          r.employeeId,
          r.employeeName,
          r.date,
          r.inTime || "--:--",
          r.outTime || "--:--",
          r.hours,
          r.status,
          r.inPlant || "Field",
          r.attendanceType
        ]);
      
      csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    } else {
      fileName = `Payroll_Summary_${fromDate}_to_${toDate}.csv`;
      const headers = ["Slip No", "Employee ID", "Name", "Month", "Earning Days", "Net Payable", "PF (Emp)", "PF (Ex)", "ESIC (Emp)", "ESIC (Ex)", "Paid Status"];
      const rows = payrollRecords
        .filter(p => {
          const slipDate = p.slipDate || "";
          return slipDate >= fromDate && slipDate <= toDate;
        })
        .map(p => [
          p.slipNo || "N/A",
          p.employeeId,
          p.employeeName,
          p.month,
          p.totalEarningDays,
          p.netPayable,
          p.pfAmountEmployee,
          p.pfAmountEmployer,
          p.esicAmountEmployee,
          p.esicAmountEmployer,
          p.status
        ]);
      
      csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    }

    // Download Logic
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setIsDialogOpen(false);
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Analytics & Reports</h1>
          <p className="text-muted-foreground">Strategic insights into workforce productivity and operational costs.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          <ReportCard 
            title="Attendance Export" 
            description="Detailed daily logs including GPS locations, working hours, and plant-wise status breakdown." 
            icon={FileBarChart2}
            onClick={() => openReportDialog("ATTENDANCE")}
          />
          <ReportCard 
            title="Payroll Summary" 
            description="Consolidated cost breakdown, statutory PF/ESIC liabilities, and payment disbursement status." 
            icon={FileText}
            onClick={() => openReportDialog("PAYROLL")}
          />
        </div>

        <Card className="border-slate-200 shadow-sm overflow-hidden h-full">
          <CardHeader className="bg-slate-50 border-b border-slate-100">
            <CardTitle className="text-lg font-bold">Recent Activity</CardTitle>
            <CardDescription>Recently generated data exports</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              <div className="divide-y divide-slate-100">
                <HistoryItem name="July_Payroll_Final.xlsx" date="2 hours ago" />
                <HistoryItem name="Plant_A_Attendance_WK2.pdf" date="Yesterday" />
                <HistoryItem name="Statutory_PF_Returns.csv" date="3 days ago" />
                <HistoryItem name="Q2_Cost_Analysis.pdf" date="1 week ago" />
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Generation Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary" />
              Select Report Period
            </DialogTitle>
            <DialogDescription>
              Generating {activeReport === "ATTENDANCE" ? "Attendance" : "Payroll"} report. Defaulting to 90-day window.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-4 py-6">
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

          <DialogFooter className="gap-3 sm:gap-0">
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="h-12 rounded-xl font-bold">
              <X className="w-4 h-4 mr-2" /> Cancel
            </Button>
            <Button onClick={handleGenerate} className="h-12 px-8 bg-primary font-black rounded-xl shadow-lg shadow-primary/20">
              <Download className="w-4 h-4 mr-2" /> Generate Excel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReportCard({ title, description, icon: Icon, onClick }: any) {
  return (
    <Card className="hover:border-primary transition-all cursor-pointer group border-slate-200 shadow-sm hover:shadow-md">
      <CardContent className="p-8">
        <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-6 group-hover:bg-primary/10 transition-colors">
          <Icon className="w-7 h-7 text-slate-400 group-hover:text-primary transition-colors" />
        </div>
        <h3 className="text-xl font-black mb-2 text-slate-800">{title}</h3>
        <p className="text-sm text-muted-foreground mb-8 leading-relaxed">{description}</p>
        
        <Button onClick={onClick} className="w-full h-12 font-bold bg-white text-primary border-2 border-primary/10 hover:bg-primary hover:text-white transition-all rounded-xl">
          <Download className="w-4 h-4 mr-2" />
          Generate Report
        </Button>
      </CardContent>
    </Card>
  );
}

function HistoryItem({ name, date }: { name: string, date: string }) {
  return (
    <div className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-slate-100 rounded-lg">
          <FileSpreadsheet className="w-4 h-4 text-slate-500" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-700">{name}</p>
          <p className="text-[10px] font-medium text-muted-foreground uppercase">{date}</p>
        </div>
      </div>
      <Button variant="ghost" size="icon" className="text-slate-400 hover:text-primary">
        <Download className="w-4 h-4" />
      </Button>
    </div>
  );
}
