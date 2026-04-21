
"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent, 
  CardDescription,
  CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableRow, 
  TableHead, 
  TableCell 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, 
  Calculator, 
  CreditCard, 
  History, 
  CheckCircle2,
  Building2,
  Printer,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Download,
  X,
  Lock,
  ArrowRightCircle,
  PlusCircle,
  ArrowUpRight,
  Info,
  Briefcase,
  CalendarClock
} from "lucide-react";
import { formatCurrency, numberToIndianWords, cn, formatDate } from "@/lib/utils";
import { useData } from "@/context/data-context";
import { useToast } from "@/hooks/use-toast";
import { Employee, PayrollRecord, SalaryPaymentRecord, Firm } from "@/lib/types";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { parseISO, isBefore, startOfMonth, isValid } from "date-fns";

const PROJECT_START_DATE = new Date(2026, 3, 1);
const ITEMS_PER_PAGE = 15;

const generatePayrollMonths = (count = 120, includeCurrent = true) => {
  const options = [];
  const date = new Date();
  const startOffset = includeCurrent ? 0 : 1;
  for (let i = startOffset; i < count + (includeCurrent ? 0 : startOffset); i++) {
    const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
    if (isBefore(d, startOfMonth(PROJECT_START_DATE))) break;
    const mmm = d.toLocaleString('en-US', { month: 'short' });
    const yy = d.getFullYear().toString().slice(-2);
    options.push(`${mmm}-${yy}`);
  }
  return options;
};

const PAYROLL_MONTHS_10Y = generatePayrollMonths(120, true);
const PAYROLL_MONTHS_12M_GEN = generatePayrollMonths(13, true);

export default function PayrollPage() {
  const router = useRouter();
  const { employees, attendanceRecords, payrollRecords, vouchers, firms, updateRecord, addRecord, currentUser } = useData();
  const { toast } = useToast();

  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState("generate");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedFirmId, setSelectedFirmId] = useState("all");
  const [isProcessing, setIsProcessing] = useState(false);

  const [generatePage, setGeneratePage] = useState(1);
  const [paymentPendingPage, setPaymentPendingPage] = useState(1);
  const [historyFromMonth, setHistoryFromMonth] = useState("");
  const [historyToMonth, setHistoryToMonth] = useState("");

  const [paySalaryRec, setPaySalaryRec] = useState<PayrollRecord | null>(null);
  const [printSlip, setPrintSlip] = useState<PayrollRecord | null>(null);
  
  // Full Page Adjustment States
  const [adjustLeaveEmp, setAdjustLeaveEmp] = useState<Employee | null>(null);
  const [isAdjustingBalance, setIsAdjustingBalance] = useState(false);
  const [adjustmentState, setAdjustmentState] = useState({
    present: 0,
    absent: 0,
    holidayWork: 0,
    holidayBanked: 0,
    holidayPaid: 0,
    balanceUsed: 0,
    remainingBalance: 0,
    earningDays: 0,
    isPaidAction: false,
    isBankedAction: false
  });

  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentType, setPaymentType] = useState<'BANKING' | 'CASH' | 'CHEQUE'>('BANKING');
  const [paymentRef, setPaymentRef] = useState("");

  const [adjustedEmployees, setAdjustedEmployees] = useState<Record<string, any>>({});

  useEffect(() => {
    setIsMounted(true);
    const initialMonth = PAYROLL_MONTHS_12M_GEN[0] || "";
    setSelectedMonth(initialMonth);
    setHistoryFromMonth(initialMonth);
    setHistoryToMonth(initialMonth);
    setPaymentDate(new Date().toISOString().split('T')[0]);
  }, []);

  const isGenerationAllowed = useMemo(() => {
    if (!selectedMonth) return false;
    return PAYROLL_MONTHS_12M_GEN.includes(selectedMonth);
  }, [selectedMonth]);

  const getAttendanceMetricsForMonth = (empId: string, monthStr: string) => {
    if (!monthStr || monthStr === 'all') return { presents: 0, holidayWork: 0 };
    const [mmm, yy] = monthStr.split('-');
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const mIndex = monthNames.indexOf(mmm);
    const year = 2000 + parseInt(yy);
    
    const monthlyAttendance = attendanceRecords.filter(r => {
      if (r.employeeId !== empId || !r.approved) return false;
      const d = parseISO(r.date);
      return isValid(d) && !isBefore(d, PROJECT_START_DATE) && d.getMonth() === mIndex && d.getFullYear() === year;
    });
    
    const holidayWork = monthlyAttendance.filter(r => r.inPlant === 'Holiday Work' || r.status === 'HOLIDAY').length;
    const presents = monthlyAttendance.filter(r => ['PRESENT', 'FIELD', 'WFH'].includes(r.status) && r.inPlant !== 'Holiday Work').length;
    const halfDays = monthlyAttendance.filter(r => r.status === 'HALF_DAY' && r.inPlant !== 'Holiday Work').length;
    
    return { presents: presents + (halfDays * 0.5), holidayWork };
  };

  const pendingGenerationEmployees = useMemo(() => {
    if (!isGenerationAllowed) return [];
    const search = searchTerm.toLowerCase();
    return employees.filter(emp => {
      const match = emp.name.toLowerCase().includes(search) || emp.employeeId.toLowerCase().includes(search);
      const firmMatch = selectedFirmId === "all" || emp.firmId === selectedFirmId;
      const done = payrollRecords.some(p => p.employeeId === emp.employeeId && p.month === selectedMonth);
      return match && firmMatch && !done;
    }).map(emp => ({ ...emp, metrics: getAttendanceMetricsForMonth(emp.employeeId, selectedMonth) }));
  }, [employees, searchTerm, selectedFirmId, payrollRecords, selectedMonth, isGenerationAllowed, attendanceRecords]);

  const paymentTabLists = useMemo(() => {
    const search = searchTerm.toLowerCase();
    const filtered = payrollRecords.filter(p => {
      const emp = employees.find(e => e.employeeId === p.employeeId);
      const match = p.employeeName.toLowerCase().includes(search) || p.employeeId.toLowerCase().includes(search) || (p.slipNo || "").toLowerCase().includes(search);
      const firmMatch = selectedFirmId === "all" || emp?.firmId === selectedFirmId;
      return match && firmMatch;
    }).sort((a, b) => (b.slipDate || "").localeCompare(a.slipDate || ""));

    const monthOrder = [...PAYROLL_MONTHS_10Y].reverse();
    const fromIdx = monthOrder.indexOf(historyFromMonth);
    const toIdx = monthOrder.indexOf(historyToMonth);

    const pending: PayrollRecord[] = [];
    const paid: PayrollRecord[] = [];

    filtered.forEach(p => {
      const fullyPaid = (p.netPayable - (p.salaryPaidAmount || 0)) <= 0;
      if (fullyPaid) {
        const pIdx = monthOrder.indexOf(p.month);
        if (fromIdx !== -1 && toIdx !== -1 && pIdx >= fromIdx && pIdx <= toIdx) paid.push(p);
      } else {
        if (selectedMonth === "all" || p.month === selectedMonth) pending.push(p);
      }
    });
    return { pending, paid };
  }, [payrollRecords, searchTerm, selectedFirmId, employees, selectedMonth, historyFromMonth, historyToMonth]);

  const paginatedGenerate = useMemo(() => {
    const start = (generatePage - 1) * ITEMS_PER_PAGE;
    return pendingGenerationEmployees.slice(start, start + ITEMS_PER_PAGE);
  }, [pendingGenerationEmployees, generatePage]);

  const totalPagesGen = Math.ceil(pendingGenerationEmployees.length / ITEMS_PER_PAGE);

  const StandardPaginationFooter = ({ current, total, onPageChange }: any) => (
    <CardFooter className="bg-slate-50 border-t flex flex-col sm:flex-row items-center justify-between p-4 gap-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={current === 1} onClick={() => onPageChange(current - 1)} className="font-bold h-9">
          <ChevronLeft className="w-4 h-4 mr-1" /> Previous
        </Button>
        <Button variant="outline" size="sm" disabled={current === total || total === 0} onClick={() => onPageChange(current + 1)} className="font-bold h-9">
          Next <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Page {current} of {total || 1}</span>
        <div className="flex items-center gap-2 border-l pl-4 border-slate-200">
          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Jump To</Label>
          <div className="flex gap-1">
            <Input type="number" className="w-14 h-9 text-center font-bold" value={current} onChange={(e) => { const p = parseInt(e.target.value); if (p >= 1 && p <= total) onPageChange(p); }} />
            <div className="w-9 h-9 bg-slate-900 rounded-lg flex items-center justify-center text-white"><ArrowRightCircle className="w-4 h-4" /></div>
          </div>
        </div>
      </div>
    </CardFooter>
  );

  // ACTION: Pay logic
  const handleActionPay = () => {
    setAdjustmentState(p => ({
      ...p,
      holidayPaid: p.holidayWork,
      holidayBanked: 0,
      isPaidAction: true,
      isBankedAction: false,
      earningDays: p.present + p.balanceUsed + p.holidayWork
    }));
    toast({ title: "Working on Holiday added to Earnings" });
  };

  // ACTION: Advance Leave logic
  const handleActionAdvanceLeave = () => {
    setAdjustmentState(p => ({
      ...p,
      holidayBanked: p.holidayWork,
      holidayPaid: 0,
      isPaidAction: false,
      isBankedAction: true,
      earningDays: p.present + p.balanceUsed
    }));
    toast({ title: "Working on Holiday moved to Balance" });
  };

  const handlePostAdjustment = () => {
    if (!adjustLeaveEmp || isProcessing) return;
    setIsProcessing(true);
    try {
      // Logic: Final balance = current + banked - used
      const finalBalance = (adjustLeaveEmp.advanceLeaveBalance || 0) + adjustmentState.holidayBanked - adjustmentState.balanceUsed;
      updateRecord('employees', adjustLeaveEmp.id, { advanceLeaveBalance: finalBalance });
      
      setAdjustedEmployees(prev => ({ 
        ...prev, 
        [adjustLeaveEmp.id]: { 
          adjusted: true, 
          earningDays: adjustmentState.earningDays, 
          balanceUsed: adjustmentState.balanceUsed, 
          balanceAdded: adjustmentState.holidayBanked 
        } 
      }));
      
      toast({ title: "Leave Adjustment Finalized" });
      setAdjustLeaveEmp(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const openAdjustmentPortal = (emp: Employee) => {
    const metrics = getAttendanceMetricsForMonth(emp.employeeId, selectedMonth);
    setAdjustmentState({
      present: metrics.presents,
      absent: Math.max(0, 26 - metrics.presents),
      holidayWork: metrics.holidayWork,
      holidayBanked: 0,
      holidayPaid: 0,
      balanceUsed: 0,
      remainingBalance: emp.advanceLeaveBalance || 0,
      earningDays: metrics.presents,
      isPaidAction: false,
      isBankedAction: false
    });
    setAdjustLeaveEmp(emp);
  };

  const handlePostPayment = () => {
    if (!paySalaryRec || isProcessing) return;
    setIsProcessing(true);
    try {
      const historyEntry: SalaryPaymentRecord = { amount: paymentAmount, date: paymentDate, type: paymentType, reference: paymentRef };
      const newPaid = (paySalaryRec.salaryPaidAmount || 0) + paymentAmount;
      updateRecord('payroll', paySalaryRec.id, { 
        salaryPaidAmount: newPaid, 
        salaryPaidDate: paymentDate, 
        salaryHistory: [...(paySalaryRec.salaryHistory || []), historyEntry], 
        status: newPaid >= paySalaryRec.netPayable ? 'PAID' : 'FINALIZED' 
      });
      toast({ title: "Payment Recorded" });
      setPaySalaryRec(null);
    } finally { setIsProcessing(false); }
  };

  const handleDownloadAndPrint = (p: PayrollRecord) => {
    const originalTitle = document.title;
    document.title = p.slipNo || "Salary_Slip";
    setPrintSlip(p);
    setTimeout(() => { window.print(); document.title = originalTitle; setPrintSlip(null); }, 500);
  };

  if (!isMounted) return null;

  // RENDER: FULL PAGE ADJUST LEAVE VIEW
  if (adjustLeaveEmp) {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="rounded-3xl border-none shadow-2xl overflow-hidden bg-white flex flex-col min-h-[calc(100vh-140px)]">
          {/* Top Header */}
          <div className="p-8 bg-slate-900 text-white shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center">
                <Calculator className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-black">{adjustLeaveEmp.name}</h2>
                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">
                  {adjustLeaveEmp.department} / {adjustLeaveEmp.designation}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-6 text-center">
              <div className="px-6 py-2 bg-white/5 rounded-xl border border-white/10">
                <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-1">Salary Month</p>
                <p className="text-sm font-black">{selectedMonth}</p>
              </div>
              <div className="px-6 py-2 bg-white/5 rounded-xl border border-white/10">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Working Days</p>
                <p className="text-sm font-black">26</p>
              </div>
              <div className="px-6 py-2 bg-white/5 rounded-xl border border-white/10">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Holidays</p>
                <p className="text-sm font-black">4</p>
              </div>
            </div>
          </div>

          <ScrollArea className="flex-1 bg-white">
            <div className="p-10 space-y-12 pb-32">
              <div className="space-y-6">
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] flex items-center gap-3 border-b pb-4">
                  <Info className="w-4 h-4" /> Adjustment Matrix
                </h3>
                <Table className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="font-black text-[11px] uppercase py-5 px-8">Adjustment Type</TableHead>
                      <TableHead className="font-black text-[11px] uppercase text-center">Calculated Days</TableHead>
                      <TableHead className="font-black text-[11px] uppercase text-right pr-8">Action Buttons</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Row 1: Attendance Working Day */}
                    <TableRow className="hover:bg-slate-50/50">
                      <TableCell className="py-6 px-8">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                          <span className="font-bold text-slate-700">Attendance Working Day</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-xl font-black text-slate-900">{adjustmentState.present}</span>
                      </TableCell>
                      <TableCell className="text-right pr-8">
                        <Button 
                          variant="outline" 
                          className="h-10 px-8 font-black text-[11px] uppercase tracking-widest border-primary text-primary hover:bg-primary/5 rounded-xl"
                          onClick={() => setIsAdjustingBalance(true)}
                        >
                          Adjust
                        </Button>
                      </TableCell>
                    </TableRow>

                    {/* Row 2: Working on Holiday */}
                    <TableRow className="hover:bg-slate-50/50">
                      <TableCell className="py-6 px-8">
                        <div className="flex items-center gap-3">
                          <CalendarClock className="w-5 h-5 text-blue-500" />
                          <span className="font-bold text-slate-700">Working on Holiday</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={cn(
                          "text-xl font-black transition-all",
                          adjustmentState.isBankedAction ? "text-slate-300 line-through" : "text-slate-900"
                        )}>
                          {adjustmentState.isBankedAction ? 0 : adjustmentState.holidayWork}
                        </span>
                      </TableCell>
                      <TableCell className="text-right pr-8">
                        <div className="flex justify-end gap-3">
                          <Button 
                            className="h-10 px-8 font-black text-[11px] uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 rounded-xl disabled:opacity-30"
                            onClick={handleActionPay}
                            disabled={adjustmentState.isBankedAction}
                          >
                            Pay
                          </Button>
                          <Button 
                            variant="outline"
                            className="h-10 px-6 font-black text-[11px] uppercase tracking-widest border-slate-200 hover:bg-slate-50 rounded-xl disabled:opacity-30"
                            onClick={handleActionAdvanceLeave}
                            disabled={adjustmentState.isPaidAction}
                          >
                            Advance Leave
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Row 3: Absent */}
                    <TableRow className="hover:bg-slate-50/50">
                      <TableCell className="py-6 px-8">
                        <div className="flex items-center gap-3">
                          <X className="w-5 h-5 text-rose-500" />
                          <span className="font-bold text-slate-700">Absent</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-xl font-black text-rose-600">{adjustmentState.absent}</span>
                      </TableCell>
                      <TableCell className="text-right pr-8">
                        <span className="text-slate-300 font-bold">—</span>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* Summary Impact */}
              <div className="p-8 bg-slate-50 rounded-3xl border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-8 shadow-inner">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Final Earning Days (Preview)</p>
                  <p className="text-4xl font-black text-slate-900">{adjustmentState.earningDays} Days</p>
                </div>
                <div className="flex items-center justify-end gap-10">
                  <div className="text-right">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Leave Banked</p>
                    <p className="text-lg font-black text-blue-600">+{adjustmentState.holidayBanked}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Leave Adjusted</p>
                    <p className="text-lg font-black text-rose-600">-{adjustmentState.balanceUsed}</p>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
          
          <div className="p-4 bg-slate-50 border-t flex justify-end items-center gap-4 shrink-0 z-20">
            <Button variant="ghost" onClick={() => setAdjustLeaveEmp(null)} className="rounded-xl font-black text-[11px] uppercase tracking-widest px-10 h-12">Cancel</Button>
            <Button className="bg-primary hover:bg-primary/90 rounded-xl font-black text-[11px] uppercase tracking-widest px-12 h-12 shadow-xl shadow-primary/20" onClick={handlePostAdjustment}>
              Finalize Adjustments
            </Button>
          </div>
        </div>

        {/* Adjust Leave Popup */}
        <Dialog open={isAdjustingBalance} onOpenChange={setIsAdjustingBalance}>
          <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden border-none shadow-2xl">
            <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
              <DialogTitle className="text-xl font-black">Adjust Leave Balance</DialogTitle>
              <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/10 space-y-2">
                <p className="text-[10px] text-primary font-black uppercase">{adjustLeaveEmp.name}</p>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Remaining Advance Leave</span>
                  <span className="text-sm font-black text-emerald-400">{adjustmentState.remainingBalance} Days</span>
                </div>
              </div>
            </DialogHeader>
            <div className="p-8 space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-500">Adjust Leave (Days) *</Label>
                <Input 
                  type="number" 
                  step="0.5"
                  className="h-14 text-2xl font-black bg-slate-50 border-slate-200 text-center rounded-xl"
                  value={adjustmentState.balanceUsed}
                  max={adjustmentState.remainingBalance}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    const finalVal = Math.min(val, adjustmentState.remainingBalance);
                    setAdjustmentState(p => ({
                      ...p, 
                      balanceUsed: finalVal, 
                      earningDays: p.present + finalVal + p.holidayPaid
                    }));
                  }}
                />
                <p className="text-[9px] text-muted-foreground font-medium text-center italic mt-2">Deducts from employee's leave balance to increase earnings.</p>
              </div>
            </div>
            <DialogFooter className="p-6 bg-slate-50 border-t gap-3">
              <Button variant="ghost" onClick={() => setIsAdjustingBalance(false)} className="flex-1 rounded-xl font-bold">Cancel</Button>
              <Button className="flex-1 bg-primary font-black rounded-xl" onClick={() => setIsAdjustingBalance(false)}>Post Adjustment</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="space-y-8 pb-12 print:hidden font-calibri">
        <div><h1 className="text-2xl font-bold">Payroll Management</h1><p className="text-muted-foreground">Comprehensive system for earnings, payments and leave adjustment.</p></div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 max-w-2xl bg-slate-100 p-1 rounded-xl h-12">
            <TabsTrigger value="generate" className="rounded-lg font-semibold">Generate Salary</TabsTrigger>
            <TabsTrigger value="payment" className="rounded-lg font-semibold">Salary Payment</TabsTrigger>
            <TabsTrigger value="advance" className="rounded-lg font-semibold">Advance Salary</TabsTrigger>
            <TabsTrigger value="leave" className="rounded-lg font-semibold">Advance Leave</TabsTrigger>
          </TabsList>
          
          <TabsContent value="generate" className="mt-8 space-y-6">
            <Card className="border-none shadow-sm">
              <CardHeader className="bg-slate-50 border-b border-slate-100 px-6 py-4 rounded-t-xl">
                <div className="flex flex-col lg:flex-row items-center gap-4">
                  <div className="relative flex-1 w-full"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search staff..." className="pl-10 h-10 bg-white" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setGeneratePage(1); }} /></div>
                  <div className="flex items-center gap-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Target Month:</Label>
                    <Select value={selectedMonth} onValueChange={(v) => { setSelectedMonth(v); setGeneratePage(1); }}>
                      <SelectTrigger className="w-full sm:w-40 bg-white h-10 font-bold"><SelectValue /></SelectTrigger>
                      <SelectContent>{PAYROLL_MONTHS_12M_GEN.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {!isGenerationAllowed ? (<div className="py-24 text-center font-medium text-slate-500">Access Restricted: Only Current & Previous 12 Months are allowed.</div>) : (
                  <Table className="min-w-[1300px]"><TableHeader className="bg-slate-50"><TableRow><TableHead className="font-bold px-2">Firm / Unit</TableHead><TableHead className="font-bold px-2">Employee Name / ID</TableHead><TableHead className="font-bold px-2">Aadhaar No</TableHead><TableHead className="font-bold px-2">Dept / Designation</TableHead><TableHead className="font-bold px-2">Month</TableHead><TableHead className="font-bold text-right px-2">Monthly CTC</TableHead><TableHead className="text-right font-bold pr-6 px-2">Actions</TableHead></TableRow></TableHeader>
                  <TableBody>{paginatedGenerate.map((emp: any) => { const adj = adjustedEmployees[emp.id]; return (
                    <TableRow key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="px-2"><div className="text-xs font-bold text-slate-600">{firms.find(f => f.id === emp.firmId)?.name}</div></TableCell>
                      <TableCell className="px-2"><div className="flex flex-col"><span className="font-bold uppercase text-sm">{emp.name}</span><span className="text-xs font-mono text-primary font-black">{emp.employeeId}</span></div></TableCell>
                      <TableCell className="text-xs font-mono px-2 font-medium">{emp.aadhaar}</TableCell>
                      <TableCell className="px-2"><div className="text-sm font-medium text-slate-700">{emp.department}</div><div className="text-[10px] text-muted-foreground uppercase">{emp.designation}</div></TableCell>
                      <TableCell className="px-2"><Badge variant="outline" className="font-bold">{selectedMonth}</Badge></TableCell>
                      <TableCell className="text-right font-bold text-slate-900 px-2">{formatCurrency(emp.salary.monthlyCTC)}</TableCell>
                      <TableCell className="text-right pr-6 px-2"><div className="flex justify-end gap-2"><Button variant="outline" size="sm" className={cn("font-bold transition-all", adj?.adjusted ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "hover:bg-slate-100")} onClick={() => openAdjustmentPortal(emp)}>{adj?.adjusted ? "Adjusted" : "Adjust Leave"}</Button><Button size="sm" className="font-black bg-primary" disabled={!adj?.adjusted} onClick={() => router.push(`/dashboard/payroll/generate/${emp.id}?month=${selectedMonth}&earningDays=${adj.earningDays}&adjustLeave=${adj.balanceUsed}&addedLeave=${adj.balanceAdded}`)}>Generate</Button></div></TableCell>
                    </TableRow>
                  );})}</TableBody></Table>
                )}
              </CardContent>
              {totalPagesGen > 1 && <StandardPaginationFooter current={generatePage} total={totalPagesGen} onPageChange={setGeneratePage} />}
            </Card>
          </TabsContent>
          
          <TabsContent value="payment" className="mt-8 space-y-8">
            <Card className="border-none shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50 border-b p-6"><div className="flex flex-col lg:flex-row items-center gap-4"><div className="relative flex-1 w-full"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search slips..." className="pl-10 h-10 bg-white" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setPaymentPendingPage(1); }} /></div><Select value={selectedMonth} onValueChange={(v) => { setSelectedMonth(v); setPaymentPendingPage(1); }}><SelectTrigger className="w-full sm:w-40 bg-white h-10 font-bold"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Pending</SelectItem>{PAYROLL_MONTHS_10Y.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div></CardHeader>
              <CardContent className="p-0">
                <Table className="min-w-[1300px]"><TableHeader className="bg-slate-50"><TableRow><TableHead className="font-bold px-2">Slip Details</TableHead><TableHead className="font-bold px-2">Employee Name / ID</TableHead><TableHead className="font-bold px-2">Month</TableHead><TableHead className="font-bold text-right px-2">Net Payable</TableHead><TableHead className="font-bold text-right px-2">Salary Paid</TableHead><TableHead className="text-right font-bold pr-6 px-2">Actions</TableHead></TableRow></TableHeader>
                <TableBody>{paymentTabLists.pending.slice((paymentPendingPage-1)*ITEMS_PER_PAGE, paymentPendingPage*ITEMS_PER_PAGE).map((p) => (
                  <TableRow key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="px-2 font-mono font-bold text-primary cursor-pointer hover:underline">{p.slipNo}</TableCell>
                    <TableCell className="px-2 font-bold uppercase text-sm">{p.employeeName}</TableCell>
                    <TableCell className="text-center px-2"><Badge variant="secondary" className="font-bold">{p.month}</Badge></TableCell>
                    <TableCell className="text-right font-black px-2">{formatCurrency(p.netPayable)}</TableCell>
                    <TableCell className="text-right font-black text-emerald-600 px-2">{formatCurrency(p.salaryPaidAmount)}</TableCell>
                    <TableCell className="text-right pr-6 px-2"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" className="text-primary hover:bg-primary/5" onClick={() => { setPaySalaryRec(p); setPaymentAmount(p.netPayable - p.salaryPaidAmount); }}><CreditCard className="w-4 h-4" /></Button><Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-600" onClick={() => handleDownloadAndPrint(p)}><Download className="w-4 h-4" /></Button></div></TableCell>
                  </TableRow>
                ))}</TableBody></Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!paySalaryRec} onOpenChange={(o) => !o && setPaySalaryRec(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0"><DialogTitle className="text-xl font-black flex items-center gap-2"><CreditCard className="w-5 h-5 text-primary" /> Record Disbursement</DialogTitle></DialogHeader>
          <div className="p-8 space-y-6">
             <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex justify-between items-center"><span className="text-[10px] font-black text-slate-400 uppercase">Amount Due</span><span className="text-lg font-black text-rose-600">{formatCurrency(paymentAmount)}</span></div>
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-500">Pay Mode</Label><Select value={paymentType} onValueChange={(v: any) => setPaymentType(v)}><SelectTrigger className="h-11 font-bold text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="BANKING">Banking Transfer</SelectItem><SelectItem value="CASH">Petty Cash</SelectItem><SelectItem value="CHEQUE">Cheque</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-500">Pay Date</Label><Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="h-11 font-bold text-sm" /></div>
             </div>
             <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-500">Reference / Txn ID</Label><Input placeholder="Txn ID or Reference" value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} className="h-11 font-bold text-sm" /></div>
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t gap-3"><Button variant="ghost" onClick={() => setPaySalaryRec(null)} className="flex-1 rounded-xl font-bold">Cancel</Button><Button onClick={handlePostPayment} disabled={isProcessing} className="flex-1 bg-primary hover:bg-primary/90 rounded-xl font-black h-11 shadow-xl">Confirm Pay</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      
      {isMounted && printSlip && createPortal(<div className="print-only"><SalarySlipContent payroll={printSlip} employees={employees} firms={firms} /></div>, document.body)}
    </div>
  );
}

function SalarySlipContent({ payroll, employees, firms }: any) {
  const emp = employees.find((e: any) => e.employeeId === payroll.employeeId);
  const firm = firms.find((f: any) => f.id === emp?.firmId);
  const [mmm, yy] = payroll.month.split('-');
  const fullMonth = `${mmm}-20${yy}`;
  return (
    <div className="font-calibri text-slate-900 p-10 bg-white min-h-[297mm]">
       <div className="text-center border-b-2 border-slate-900 pb-4"><h1 className="text-2xl font-black uppercase tracking-tight">{firm?.name || "SIKKA INDUSTRIES & LOGISTICS"}</h1><p className="text-[10px] font-bold text-slate-500 uppercase italic">{firm?.registeredAddress}</p><h2 className="text-lg font-black mt-2 underline decoration-1 underline-offset-4">PAYSLIP FOR THE MONTH OF {fullMonth.toUpperCase()}</h2></div>
       <div className="grid grid-cols-2 border-x-2 border-b-2 border-slate-900 text-sm"><SlipRow label="Employee ID" value={payroll.employeeId} /><SlipRow label="Employee Name" value={payroll.employeeName} /><SlipRow label="Department" value={emp?.department} /><SlipRow label="Designation" value={emp?.designation} /><SlipRow label="Aadhaar No" value={emp?.aadhaar} /><SlipRow label="Monthly CTC" value={formatCurrency(emp?.salary?.monthlyCTC || 0)} /></div>
       <div className="grid grid-cols-2 mt-8 border-2 border-slate-900 font-bold"><div className="border-r-2 border-slate-900 p-2 bg-slate-50 text-center uppercase tracking-widest text-[9px]">Earnings</div><div className="p-2 bg-slate-50 text-center uppercase tracking-widest text-[9px]">Deductions / Adjustments</div></div>
       <div className="grid grid-cols-2 border-x-2 border-b-2 border-slate-900"><div className="border-r-2 border-slate-900"><SlipRow label="Basic Salary" value={formatCurrency(emp?.salary?.basic || 0)} /><SlipRow label="HRA" value={formatCurrency(emp?.salary?.hra || 0)} /><SlipRow label="Incentive" value={formatCurrency(payroll.incentiveAmt || 0)} /><SlipRow label="Holiday Work" value={formatCurrency(payroll.holidayWorkAmt || 0)} /><SlipRow label="Earning Days" value={payroll.totalEarningDays} /></div><div><SlipRow label="Advance Recovery" value={formatCurrency(payroll.advanceRecovery || 0)} /><SlipRow label="Absent Days" value={payroll.absent} /></div></div>
       <div className="bg-slate-900 text-white p-4 flex justify-between items-center mt-10"><span className="font-black uppercase tracking-[0.2em] text-[10px]">Total Net Payable (Earning Days: {payroll.totalEarningDays})</span><span className="text-3xl font-black">{formatCurrency(payroll.netPayable)}</span></div>
       <div className="mt-4 p-2 bg-slate-50 border border-slate-200 italic text-[11px]"><strong>In Words:</strong> {numberToIndianWords(payroll.netPayable)}</div>
       <div className="mt-8 p-4 bg-slate-50 border border-slate-100 rounded-xl text-center"><p className="text-[10px] font-bold text-slate-500 italic">Note: This is an auto-generated monthly salary slip of the employee and is considered a valid original document.</p></div>
       <div className="flex justify-between items-end mt-24 px-10"><div className="text-center space-y-3"><div className="w-48 border-b-2 border-slate-900" /><p className="text-[10px] font-black uppercase">Employee Signature</p></div><div className="text-center space-y-3"><div className="w-48 border-b-2 border-slate-900" /><p className="text-[10px] font-black uppercase tracking-widest">Authorized Signatory</p></div></div>
    </div>
  );
}
function SlipRow({ label, value }: { label: string, value: any }) { return (<div className="flex justify-between border-b border-slate-200 p-2 px-4 last:border-b-0"><span className="font-bold text-[10px] text-slate-500 uppercase">{label}</span><span className="font-black text-xs">{value || "---"}</span></div>); }
