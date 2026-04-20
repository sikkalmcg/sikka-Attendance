
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
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from "@/components/ui/dropdown-menu";
import { 
  Search, 
  Calculator, 
  CalendarClock, 
  CreditCard, 
  History, 
  Wallet,
  CheckCircle2,
  Building2,
  Printer,
  Banknote,
  ShieldCheck,
  FileText,
  ChevronLeft,
  ChevronRight,
  User,
  Download,
  X,
  BadgeCheck,
  Mail,
  Globe,
  MoreVertical,
  AlertTriangle,
  Lock,
  ArrowRightCircle,
  PlusCircle,
  MinusCircle,
  ArrowUpRight,
  Info,
  FileSpreadsheet
} from "lucide-react";
import { formatCurrency, numberToIndianWords, cn } from "@/lib/utils";
import { useData } from "@/context/data-context";
import { useToast } from "@/hooks/use-toast";
import { Employee, PayrollRecord, SalaryPaymentRecord, StatutoryPaymentRecord, Firm } from "@/lib/types";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { parseISO, format, isValid, isBefore } from "date-fns";

const PROJECT_START_DATE = new Date(2026, 3, 1);
const ITEMS_PER_PAGE = 15;

const generatePayrollMonths = (count = 120, includeCurrent = true) => {
  const options = [];
  const date = new Date();
  const startOffset = includeCurrent ? 0 : 1;
  for (let i = startOffset; i < count + startOffset; i++) {
    const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
    if (isBefore(d, PROJECT_START_DATE)) break;
    const mmm = d.toLocaleString('en-US', { month: 'short' });
    const yy = d.getFullYear().toString().slice(-2);
    options.push(`${mmm}-${yy}`);
  }
  return options;
};

const PAYROLL_MONTHS_10Y = generatePayrollMonths(120, true);
const PAYROLL_MONTHS_6M_GEN = generatePayrollMonths(6, false);

export default function PayrollPage() {
  const router = useRouter();
  const { employees, attendanceRecords, payrollRecords, vouchers, firms, plants, updateRecord, addRecord } = useData();
  const { toast } = useToast();

  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState("generate");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedFirmId, setSelectedFirmId] = useState("all");
  const [isProcessing, setIsProcessing] = useState(false);

  const [generatePage, setGeneratePage] = useState(1);
  const [paymentPendingPage, setPaymentPendingPage] = useState(1);
  const [paymentPaidPage, setPaymentPaidPage] = useState(1);
  const [advancePage, setAdvancePage] = useState(1);
  const [leavePage, setLeavePage] = useState(1);

  const [historyFromMonth, setHistoryFromMonth] = useState("");
  const [historyToMonth, setHistoryToMonth] = useState("");

  const [paySalaryRec, setPaySalaryRec] = useState<PayrollRecord | null>(null);
  const [payPFRec, setPayPFRec] = useState<PayrollRecord | null>(null);
  const [payESICRec, setPayESICRec] = useState<PayrollRecord | null>(null);
  const [adjustLeaveEmp, setAdjustLeaveEmp] = useState<Employee | null>(null);
  const [isSubAdjustmentOpen, setIsSubAdjustmentOpen] = useState(false);
  const [subAdjustmentValue, setSubAdjustmentValue] = useState(0);
  
  const [previewSlip, setPreviewSlip] = useState<PayrollRecord | null>(null);
  const [printSlip, setPrintSlip] = useState<PayrollRecord | null>(null);
  const [viewAdvanceEmployee, setViewAdvanceEmployee] = useState<{emp: Employee, vouchers: any[]} | null>(null);
  const [viewLeaveHistoryEmployee, setViewLeaveHistoryEmployee] = useState<Employee | null>(null);
  
  const [adjustmentState, setAdjustmentState] = useState({
    present: 0, absent: 0, holidayWork: 0, holidayBanked: 0, holidayPaid: 0, balanceUsed: 0, remainingBalance: 0, earningDays: 0, monthWorkingDays: 26, monthHolidays: 4, autoAddedLeave: 0
  });

  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentType, setPaymentType] = useState<'BANKING' | 'CASH' | 'CHEQUE'>('BANKING');
  const [paymentRef, setPaymentRef] = useState("");
  const [pfPaidEmp, setPfPaidEmp] = useState(0);
  const [pfPaidEx, setPfPaidEx] = useState(0);
  const [esicPaidEmp, setEsicPaidEmp] = useState(0);
  const [esicPaidEx, setEsicPaidEx] = useState(0);

  const [adjustedEmployees, setAdjustedEmployees] = useState<Record<string, any>>({});

  useEffect(() => {
    setIsMounted(true);
    const prevMonth = PAYROLL_MONTHS_6M_GEN[0] || PAYROLL_MONTHS_10Y[0] || "";
    setSelectedMonth(prevMonth);
    setHistoryFromMonth(prevMonth);
    setHistoryToMonth(prevMonth);
    setPaymentDate(new Date().toISOString().split('T')[0]);
  }, []);

  const isGenerationAllowed = useMemo(() => {
    if (!selectedMonth) return false;
    return PAYROLL_MONTHS_6M_GEN.includes(selectedMonth);
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

  const advanceLedgerData = useMemo(() => {
    const search = searchTerm.toLowerCase();
    const paidVouchers = vouchers.filter(v => v.status === 'PAID');
    const empIds = Array.from(new Set(paidVouchers.map(v => v.employeeId)));
    return empIds.map(id => {
      const emp = employees.find(e => e.id === id);
      if (!emp) return null;
      const totalAdv = paidVouchers.filter(v => v.employeeId === id).reduce((s, v) => s + v.amount, 0);
      const totalRec = payrollRecords.filter(p => p.employeeId === emp.employeeId).reduce((s, p) => s + (p.advanceRecovery || 0), 0);
      return { id, emp, totalAdvAmount: totalAdv, totalRecoveryAmount: totalRec, totalRemainingAmount: Math.max(0, totalAdv - totalRec) };
    }).filter(i => i && (i.emp.name.toLowerCase().includes(search) || i.emp.employeeId.toLowerCase().includes(search)));
  }, [vouchers, payrollRecords, employees, searchTerm]);

  const paginatedGenerate = useMemo(() => {
    const start = (generatePage - 1) * ITEMS_PER_PAGE;
    return pendingGenerationEmployees.slice(start, start + ITEMS_PER_PAGE);
  }, [pendingGenerationEmployees, generatePage]);

  const paginatedPaymentPending = useMemo(() => {
    const start = (paymentPendingPage - 1) * ITEMS_PER_PAGE;
    return paymentTabLists.pending.slice(start, start + ITEMS_PER_PAGE);
  }, [paymentTabLists.pending, paymentPendingPage]);

  const paginatedPaymentPaid = useMemo(() => {
    const start = (paymentPaidPage - 1) * ITEMS_PER_PAGE;
    return paymentTabLists.paid.slice(start, start + ITEMS_PER_PAGE);
  }, [paymentTabLists.paid, paymentPaidPage]);

  const paginatedAdvance = useMemo(() => {
    const start = (advancePage - 1) * ITEMS_PER_PAGE;
    return advanceLedgerData.slice(start, start + ITEMS_PER_PAGE);
  }, [advanceLedgerData, advancePage]);

  const paginatedLeave = useMemo(() => {
    const start = (leavePage - 1) * ITEMS_PER_PAGE;
    return employees.slice(start, start + ITEMS_PER_PAGE);
  }, [employees, leavePage]);

  const totalPagesGen = Math.ceil(pendingGenerationEmployees.length / ITEMS_PER_PAGE);
  const totalPagesPayPending = Math.ceil(paymentTabLists.pending.length / ITEMS_PER_PAGE);
  const totalPagesPayPaid = Math.ceil(paymentTabLists.paid.length / ITEMS_PER_PAGE);
  const totalPagesAdv = Math.ceil(advanceLedgerData.length / ITEMS_PER_PAGE);
  const totalPagesLeave = Math.ceil(employees.length / ITEMS_PER_PAGE);

  const StandardPaginationFooter = ({ current, total, onPageChange }: any) => (
    <CardFooter className="bg-slate-50 border-t flex flex-col sm:flex-row items-center justify-between p-4 gap-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={current === 1} onClick={() => onPageChange(current - 1)} className="font-bold h-9">
          <ChevronLeft className="w-4 h-4 mr-1" /> Previous
        </Button>
        <Button variant="outline" size="sm" disabled={current === total} onClick={() => onPageChange(current + 1)} className="font-bold h-9">
          Next <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Page {current} of {total}</span>
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

  const openAdjustmentDialog = (emp: Employee) => {
    const metrics = getAttendanceMetricsForMonth(emp.employeeId, selectedMonth);
    const workingDaysCount = 26;
    let initialPresent = metrics.presents;
    let initialHolidayWork = metrics.holidayWork;
    if (initialPresent < workingDaysCount && initialHolidayWork > 0) {
      const shift = Math.min(workingDaysCount - initialPresent, initialHolidayWork);
      initialPresent += shift; initialHolidayWork -= shift;
    }
    setAdjustmentState({
      present: initialPresent, absent: Math.max(0, workingDaysCount - initialPresent), holidayWork: initialHolidayWork, holidayBanked: 0, holidayPaid: 0, balanceUsed: 0, remainingBalance: (emp.advanceLeaveBalance || 0), earningDays: initialPresent, monthWorkingDays: workingDaysCount, monthHolidays: 4, autoAddedLeave: 0
    });
    setAdjustLeaveEmp(emp);
  };

  const handlePostAdjustment = () => {
    if (!adjustLeaveEmp || isProcessing) return;
    setIsProcessing(true);
    try {
      updateRecord('employees', adjustLeaveEmp.id, { advanceLeaveBalance: adjustmentState.remainingBalance });
      setAdjustedEmployees(prev => ({ ...prev, [adjustLeaveEmp.id]: { adjusted: true, earningDays: adjustmentState.earningDays, balanceUsed: adjustmentState.balanceUsed, balanceAdded: adjustmentState.holidayBanked } }));
      toast({ title: "Finalized" });
      setAdjustLeaveEmp(null);
    } finally { setIsProcessing(false); }
  };

  const handleApplyMonthlyCredits = () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      employees.forEach(emp => updateRecord('employees', emp.id, { advanceLeaveBalance: (emp.advanceLeaveBalance || 0) + 1 }));
      toast({ title: "Credits Applied" });
    } finally { setIsProcessing(false); }
  };

  const handlePostPayment = () => {
    if (!paySalaryRec || isProcessing) return;
    setIsProcessing(true);
    try {
      const historyEntry: SalaryPaymentRecord = { amount: paymentAmount, date: paymentDate, type: paymentType, reference: paymentRef };
      const newPaid = paySalaryRec.salaryPaidAmount + paymentAmount;
      updateRecord('payroll', paySalaryRec.id, { salaryPaidAmount: newPaid, salaryPaidDate: paymentDate, salaryHistory: [...(paySalaryRec.salaryHistory || []), historyEntry], status: newPaid >= paySalaryRec.netPayable ? 'PAID' : 'FINALIZED' });
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
                  <div className="relative flex-1 w-full"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search..." className="pl-10 h-10 bg-white" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setGeneratePage(1); }} /></div>
                  <Select value={selectedMonth} onValueChange={(v) => { setSelectedMonth(v); setGeneratePage(1); }}><SelectTrigger className="w-full sm:w-40 bg-white h-10"><SelectValue /></SelectTrigger><SelectContent>{PAYROLL_MONTHS_6M_GEN.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {!isGenerationAllowed ? (<div className="py-24 text-center">Generation Restricted to Past 6 Months (April-2026 onwards).</div>) : (
                  <Table className="min-w-[1300px]"><TableHeader className="bg-slate-50"><TableRow><TableHead className="font-bold px-2">Firm / Unit</TableHead><TableHead className="font-bold px-2">Employee Name / ID</TableHead><TableHead className="font-bold px-2">Aadhaar No</TableHead><TableHead className="font-bold px-2">Dept / Designation</TableHead><TableHead className="font-bold px-2">Month</TableHead><TableHead className="font-bold text-right px-2">Monthly CTC</TableHead><TableHead className="text-right font-bold pr-6 px-2">Actions</TableHead></TableRow></TableHeader>
                  <TableBody>{paginatedGenerate.map((emp: any) => { const adj = adjustedEmployees[emp.id]; return (
                    <TableRow key={emp.id} className="hover:bg-slate-50/50">
                      <TableCell className="px-2"><div className="text-xs font-bold">{firms.find(f => f.id === emp.firmId)?.name}</div></TableCell>
                      <TableCell className="px-2"><div className="flex flex-col"><span className="font-bold uppercase">{emp.name}</span><span className="text-xs font-mono text-primary">{emp.employeeId}</span></div></TableCell>
                      <TableCell className="text-xs font-mono px-2">{emp.aadhaar}</TableCell>
                      <TableCell className="px-2"><div className="text-sm font-medium">{emp.department}</div><div className="text-xs text-muted-foreground">{emp.designation}</div></TableCell>
                      <TableCell className="px-2"><Badge variant="outline">{selectedMonth}</Badge></TableCell>
                      <TableCell className="text-right font-bold text-emerald-600 px-2">{formatCurrency(emp.salary.monthlyCTC)}</TableCell>
                      <TableCell className="text-right pr-6 px-2"><div className="flex justify-end gap-2"><Button variant="outline" size="sm" className={adj?.adjusted ? "bg-emerald-50 text-emerald-700" : ""} onClick={() => openAdjustmentDialog(emp)}>{adj?.adjusted ? "Reviewed" : "Adjust Leave"}</Button><Button size="sm" disabled={!adj?.adjusted} onClick={() => router.push(`/dashboard/payroll/generate/${emp.id}?month=${selectedMonth}&earningDays=${adj.earningDays}&adjustLeave=${adj.balanceUsed}&addedLeave=${adj.balanceAdded}`)}>Generate</Button></div></TableCell>
                    </TableRow>
                  );})}</TableBody></Table>
                )}
              </CardContent>
              {totalPagesGen > 1 && <StandardPaginationFooter current={generatePage} total={totalPagesGen} onPageChange={setGeneratePage} />}
            </Card>
          </TabsContent>
          <TabsContent value="payment" className="mt-8 space-y-8">
            <Card className="border-none shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50 border-b p-6"><div className="flex flex-col lg:flex-row items-center gap-4"><div className="relative flex-1 w-full"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search..." className="pl-10 h-10 bg-white" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setPaymentPendingPage(1); }} /></div><Select value={selectedMonth} onValueChange={(v) => { setSelectedMonth(v); setPaymentPendingPage(1); }}><SelectTrigger className="w-full sm:w-40 bg-white h-10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Pending</SelectItem>{PAYROLL_MONTHS_10Y.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div></CardHeader>
              <CardContent className="p-0">
                <Table className="min-w-[1300px]"><TableHeader className="bg-slate-50"><TableRow><TableHead className="font-bold px-2">Slip Details</TableHead><TableHead className="font-bold px-2">Employee Name / ID</TableHead><TableHead className="font-bold px-2">Month</TableHead><TableHead className="font-bold text-right px-2">Net Payable</TableHead><TableHead className="font-bold text-right px-2">Salary Paid</TableHead><TableHead className="text-right font-bold pr-6 px-2">Actions</TableHead></TableRow></TableHeader>
                <TableBody>{paginatedPaymentPending.map((p) => (
                  <TableRow key={p.id} className="hover:bg-slate-50/50">
                    <TableCell className="px-2 font-mono font-bold text-primary cursor-pointer hover:underline" onClick={() => setPreviewSlip(p)}>{p.slipNo}</TableCell>
                    <TableCell className="px-2 font-bold uppercase">{p.employeeName}</TableCell>
                    <TableCell className="text-center px-2"><Badge variant="secondary">{p.month}</Badge></TableCell>
                    <TableCell className="text-right font-bold px-2">{formatCurrency(p.netPayable)}</TableCell>
                    <TableCell className="text-right font-bold text-emerald-600 px-2">{formatCurrency(p.salaryPaidAmount)}</TableCell>
                    <TableCell className="text-right pr-6 px-2"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => { setPaySalaryRec(p); setPaymentAmount(p.netPayable - p.salaryPaidAmount); }}><CreditCard className="w-4 h-4 text-primary" /></Button><Button variant="ghost" size="icon" onClick={() => handleDownloadAndPrint(p)}><Download className="w-4 h-4 text-slate-500" /></Button></div></TableCell>
                  </TableRow>
                ))}</TableBody></Table>
              </CardContent>
              {totalPagesPayPending > 1 && <StandardPaginationFooter current={paymentPendingPage} total={totalPagesPayPending} onPageChange={setPaymentPendingPage} />}
            </Card>
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1"><h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Paid History</h3><div className="flex items-center gap-4"><div className="flex items-center gap-1 bg-white border px-3 py-1 rounded-xl shadow-sm text-[10px] font-bold">FROM <Select value={historyFromMonth} onValueChange={(v) => { setHistoryFromMonth(v); setPaymentPaidPage(1); }}><SelectTrigger className="h-7 w-24 border-none shadow-none"><SelectValue /></SelectTrigger><SelectContent>{PAYROLL_MONTHS_10Y.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select> TO <Select value={historyToMonth} onValueChange={(v) => { setHistoryToMonth(v); setPaymentPaidPage(1); }}><SelectTrigger className="h-7 w-24 border-none shadow-none"><SelectValue /></SelectTrigger><SelectContent>{PAYROLL_MONTHS_10Y.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div><Button variant="outline" size="sm" onClick={() => {}}><FileSpreadsheet className="w-4 h-4 mr-2" /> Export</Button></div></div>
              <Card className="border-none shadow-sm overflow-hidden bg-slate-50/30">
                <CardContent className="p-0"><Table className="min-w-[1300px]"><TableHeader className="bg-slate-100/50"><TableRow><TableHead className="font-bold px-2">Slip Details</TableHead><TableHead className="font-bold px-2">Employee Name / ID</TableHead><TableHead className="font-bold px-2">Month</TableHead><TableHead className="font-bold text-right px-2">Net Payable</TableHead><TableHead className="font-bold text-right px-2">Settled Amount</TableHead></TableRow></TableHeader><TableBody>{paginatedPaymentPaid.map((p) => (
                  <TableRow key={p.id} className="hover:bg-white/50"><TableCell className="px-2 font-mono font-bold text-slate-600 cursor-pointer hover:underline" onClick={() => setPreviewSlip(p)}>{p.slipNo}</TableCell><TableCell className="px-2 font-bold text-slate-600 uppercase">{p.employeeName}</TableCell><TableCell className="text-center px-2"><Badge variant="outline">{p.month}</Badge></TableCell><TableCell className="text-right font-bold text-slate-500 px-2">{formatCurrency(p.netPayable)}</TableCell><TableCell className="text-right font-black text-emerald-600 px-2">{formatCurrency(p.salaryPaidAmount)}</TableCell></TableRow>
                ))}</TableBody></Table></CardContent>
                {totalPagesPayPaid > 1 && <StandardPaginationFooter current={paymentPaidPage} total={totalPagesPayPaid} onPageChange={setPaymentPaidPage} />}
              </Card>
            </div>
          </TabsContent>
          <TabsContent value="advance"><Card className="border-none shadow-sm overflow-hidden"><CardHeader className="bg-slate-50 border-b p-6"><CardTitle>Advance Salary Ledger</CardTitle></CardHeader><CardContent className="p-0"><Table className="min-w-[1200px]"><TableHeader className="bg-slate-50"><TableRow><TableHead className="font-bold px-2">Employee Name / ID</TableHead><TableHead className="font-bold px-2">Dept</TableHead><TableHead className="text-right font-bold px-2">Total Advanced</TableHead><TableHead className="text-right font-bold text-rose-600 px-2">Remaining</TableHead><TableHead className="text-right font-bold pr-6 px-2">Action</TableHead></TableRow></TableHeader><TableBody>{paginatedAdvance.map(item => (
            <TableRow key={item.id} className="hover:bg-slate-50/50"><TableCell className="px-2 font-bold uppercase">{item.emp.name}<div className="text-[10px] font-mono text-primary">{item.emp.employeeId}</div></TableCell><TableCell className="px-2">{item.emp.department}</TableCell><TableCell className="text-right font-bold px-2">{formatCurrency(item.totalAdvAmount)}</TableCell><TableCell className="text-right font-black text-rose-600 px-2">{formatCurrency(item.totalRemainingAmount)}</TableCell><TableCell className="text-right pr-6 px-2"><Button variant="outline" size="sm" onClick={() => setViewAdvanceEmployee(item)}>View</Button></TableCell></TableRow>
          ))}</TableBody></Table></CardContent>{totalPagesAdv > 1 && <StandardPaginationFooter current={advancePage} total={totalPagesAdv} onPageChange={setAdvancePage} />}</Card></TabsContent>
          <TabsContent value="leave"><Card className="border-none shadow-sm overflow-hidden"><CardHeader className="bg-slate-50 border-b p-6 flex flex-row items-center justify-between"><CardTitle>Advance Leave Portal</CardTitle><Button className="font-black bg-primary" onClick={handleApplyMonthlyCredits}>Process Monthly Credits (+1)</Button></CardHeader><CardContent className="p-0"><Table className="min-w-[1000px]"><TableHeader className="bg-slate-50"><TableRow><TableHead className="font-bold px-6">Employee Name</TableHead><TableHead className="font-bold px-2">Dept / Desig</TableHead><TableHead className="font-bold text-center px-2">Balance</TableHead><TableHead className="text-right font-bold pr-6 px-2">Actions</TableHead></TableRow></TableHeader><TableBody>{paginatedLeave.map(emp => (
            <TableRow key={emp.id} className="hover:bg-slate-50/50"><TableCell className="px-6 font-bold uppercase">{emp.name}</TableCell><TableCell className="px-2">{emp.department}<div className="text-[10px] uppercase">{emp.designation}</div></TableCell><TableCell className="text-center font-black text-primary px-2">{emp.advanceLeaveBalance || 0} Days</TableCell><TableCell className="text-right pr-6 px-2"><Button variant="ghost" size="sm" onClick={() => setViewLeaveHistoryEmployee(emp)}><History className="w-4 h-4 mr-2" /> History</Button></TableCell></TableRow>
          ))}</TableBody></Table></CardContent>{totalPagesLeave > 1 && <StandardPaginationFooter current={leavePage} total={totalPagesLeave} onPageChange={setLeavePage} />}</Card></TabsContent>
        </Tabs>
      </div>
      {/* Modals & Slip Content omitted for brevity */}
      {isMounted && printSlip && createPortal(<div className="print-only"><SalarySlipContent payroll={printSlip} employees={employees} firms={firms} plants={plants} /></div>, document.body)}
    </div>
  );
}

function SalarySlipContent({ payroll, employees, firms, plants }: any) {
  const emp = employees.find((e: any) => e.employeeId === payroll.employeeId);
  const firm = firms.find((f: any) => f.id === emp?.firmId);
  const [mmm, yy] = payroll.month.split('-');
  const fullMonth = `${mmm}-20${yy}`;
  return (
    <div className="font-calibri text-slate-900 p-10 bg-white">
       <div className="text-center border-b-2 border-slate-900 pb-4"><h1 className="text-2xl font-black uppercase tracking-tight">{firm?.name || "SIKKA INDUSTRIES & LOGISTICS"}</h1><p className="text-xs font-bold text-slate-500 italic">{firm?.registeredAddress}</p><h2 className="text-lg font-black mt-2 underline decoration-1 underline-offset-4">PAYSLIP FOR THE MONTH OF {fullMonth.toUpperCase()}</h2></div>
       <div className="grid grid-cols-2 border-x-2 border-b-2 border-slate-900 text-sm"><SlipRow label="Employee ID" value={payroll.employeeId} /><SlipRow label="Employee Name" value={payroll.employeeName} /><SlipRow label="Department" value={emp?.department} /><SlipRow label="Designation" value={emp?.designation} /><SlipRow label="Aadhaar No" value={emp?.aadhaar} /><SlipRow label="Monthly CTC" value={formatCurrency(emp?.salary?.monthlyCTC || 0)} /></div>
       <div className="grid grid-cols-2 mt-8 border-2 border-slate-900 font-bold"><div className="border-r-2 border-slate-900 p-2 bg-slate-50 text-center uppercase tracking-widest text-xs">Earnings</div><div className="p-2 bg-slate-50 text-center uppercase tracking-widest text-xs">Deductions / Adjustments</div></div>
       <div className="grid grid-cols-2 border-x-2 border-b-2 border-slate-900"><div className="border-r-2 border-slate-900"><SlipRow label="Basic Salary" value={formatCurrency(emp?.salary?.basic || 0)} /><SlipRow label="HRA" value={formatCurrency(emp?.salary?.hra || 0)} /><SlipRow label="Incentive" value={formatCurrency(payroll.incentiveAmt || 0)} /><SlipRow label="Holiday Work" value={formatCurrency(payroll.holidayWorkAmt || 0)} /><SlipRow label="Earning Days" value={payroll.totalEarningDays} /></div><div><SlipRow label="Advance Recovery" value={formatCurrency(payroll.advanceRecovery || 0)} /><SlipRow label="Absent Days" value={payroll.absent} /></div></div>
       <div className="bg-slate-900 text-white p-4 flex justify-between items-center mt-10"><span className="font-black uppercase tracking-[0.2em] text-[10px]">Total Net Payable (Earning Days: {payroll.totalEarningDays})</span><span className="text-3xl font-black">{formatCurrency(payroll.netPayable)}</span></div>
       <div className="mt-4 p-2 bg-slate-50 border border-slate-200 italic text-xs"><strong>In Words:</strong> {numberToIndianWords(payroll.netPayable)}</div>
       <div className="mt-8 p-4 bg-slate-50 border border-slate-100 rounded-xl text-center"><p className="text-[10px] font-bold text-slate-500 italic">Note: This is an auto-generated monthly salary slip of the employee and is considered a valid original document.</p></div>
       <div className="flex justify-between items-end mt-24 px-10"><div className="text-center space-y-2"><div className="w-48 border-b-2 border-slate-900" /><p className="text-[10px] font-black uppercase">Employee Signature</p></div><div className="text-center space-y-2"><div className="w-48 border-b-2 border-slate-900" /><p className="text-[10px] font-black uppercase tracking-widest">Authorized Signatory</p></div></div>
    </div>
  );
}
function SlipRow({ label, value }: { label: string, value: any }) { return (<div className="flex justify-between border-b border-slate-200 p-2 px-4 last:border-b-0"><span className="font-bold text-[11px] text-slate-500 uppercase">{label}</span><span className="font-black text-xs">{value || "---"}</span></div>); }
