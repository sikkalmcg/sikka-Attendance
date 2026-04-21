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
import { formatCurrency, numberToIndianWords, cn, formatDate } from "@/lib/utils";
import { useData } from "@/context/data-context";
import { useToast } from "@/hooks/use-toast";
import { Employee, PayrollRecord, SalaryPaymentRecord, StatutoryPaymentRecord, Firm, Voucher } from "@/lib/types";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { parseISO, format, isValid, isBefore, startOfMonth } from "date-fns";

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
// Access Policy: Current month + Previous 12 Months = 13 months total
const PAYROLL_MONTHS_12M_GEN = generatePayrollMonths(13, true);

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
  const [previewSlip, setPreviewSlip] = useState<PayrollRecord | null>(null);
  const [printSlip, setPrintSlip] = useState<PayrollRecord | null>(null);
  const [viewAdvanceEmployee, setViewAdvanceEmployee] = useState<{emp: Employee, vouchers: any[]} | null>(null);
  const [viewLeaveHistoryEmployee, setViewLeaveHistoryEmployee] = useState<Employee | null>(null);
  
  const [adjustLeaveEmp, setAdjustLeaveEmp] = useState<Employee | null>(null);
  const [adjustmentState, setAdjustmentState] = useState({
    present: 0, absent: 0, holidayWork: 0, holidayBanked: 0, holidayPaid: 0, balanceUsed: 0, remainingBalance: 0, earningDays: 0, monthWorkingDays: 26, monthHolidays: 4, autoAddedLeave: 0
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

  const totalPagesGen = Math.ceil(pendingGenerationEmployees.length / ITEMS_PER_PAGE);
  const totalPagesPayPending = Math.ceil(paymentTabLists.pending.length / ITEMS_PER_PAGE);

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
      toast({ title: "Adjustment Finalized" });
      setAdjustLeaveEmp(null);
    } finally { setIsProcessing(false); }
  };

  const handlePostPayment = () => {
    if (!paySalaryRec || isProcessing) return;
    setIsProcessing(true);
    try {
      const historyEntry: SalaryPaymentRecord = { amount: paymentAmount, date: paymentDate, type: paymentType, reference: paymentRef };
      const newPaid = (paySalaryRec.salaryPaidAmount || 0) + paymentAmount;
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
                      <TableCell className="text-right font-bold text-emerald-600 px-2">{formatCurrency(emp.salary.monthlyCTC)}</TableCell>
                      <TableCell className="text-right pr-6 px-2"><div className="flex justify-end gap-2"><Button variant="outline" size="sm" className={cn("font-bold transition-all", adj?.adjusted ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "hover:bg-slate-100")} onClick={() => openAdjustmentDialog(emp)}>{adj?.adjusted ? "Adjusted" : "Adjust Leave"}</Button><Button size="sm" className="font-black bg-primary" disabled={!adj?.adjusted} onClick={() => router.push(`/dashboard/payroll/generate/${emp.id}?month=${selectedMonth}&earningDays=${adj.earningDays}&adjustLeave=${adj.balanceUsed}&addedLeave=${adj.balanceAdded}`)}>Generate</Button></div></TableCell>
                    </TableRow>
                  );})}</TableBody></Table>
                )}
              </CardContent>
              {totalPagesGen > 1 && <StandardPaginationFooter current={generatePage} total={totalPagesGen} onPageChange={setGeneratePage} />}
            </Card>
          </TabsContent>
          
          {/* Adjustment Dialog */}
          <Dialog open={!!adjustLeaveEmp} onOpenChange={(o) => !o && setAdjustLeaveEmp(null)}>
            <DialogContent className="sm:max-w-2xl rounded-2xl p-0 overflow-hidden border-none shadow-2xl">
              <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
                <DialogTitle className="text-xl font-black flex items-center gap-2"><Calculator className="w-5 h-5 text-primary" /> Leave Adjustment Matrix</DialogTitle>
                <p className="text-[10px] text-primary font-black uppercase tracking-widest mt-2">{adjustLeaveEmp?.name} • {selectedMonth}</p>
              </DialogHeader>
              <div className="p-8 space-y-8">
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Monthly Attendance</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100"><p className="text-[9px] font-bold text-slate-400 uppercase">Presents</p><p className="text-lg font-black">{adjustmentState.present}</p></div>
                      <div className="p-4 bg-rose-50 rounded-xl border border-rose-100"><p className="text-[9px] font-bold text-rose-400 uppercase">Absents</p><p className="text-lg font-black text-rose-600">{adjustmentState.absent}</p></div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Available Credits</Label>
                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-between">
                      <div><p className="text-[9px] font-bold text-emerald-400 uppercase">Leave Balance</p><p className="text-xl font-black text-emerald-700">{adjustmentState.remainingBalance} Days</p></div>
                      <ShieldCheck className="w-8 h-8 text-emerald-200" />
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4 pt-6 border-t border-slate-100">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Application of Credits</Label>
                  <div className="flex items-center gap-4">
                    <Input 
                      type="number" 
                      className="h-14 text-xl font-black bg-slate-50 border-slate-200 text-center rounded-xl"
                      value={adjustmentState.balanceUsed}
                      max={Math.min(adjustmentState.absent, (adjustLeaveEmp?.advanceLeaveBalance || 0))}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        const maxAllowed = Math.min(adjustmentState.absent, (adjustLeaveEmp?.advanceLeaveBalance || 0));
                        const finalVal = Math.min(val, maxAllowed);
                        setAdjustmentState(p => ({
                          ...p, 
                          balanceUsed: finalVal, 
                          earningDays: p.present + finalVal,
                          remainingBalance: (adjustLeaveEmp?.advanceLeaveBalance || 0) - finalVal
                        }));
                      }}
                    />
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-bold text-slate-700">Convert Absents to Earnings</p>
                      <p className="text-xs text-muted-foreground font-medium italic">Adjusting {adjustmentState.balanceUsed} days using advance leave pool.</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-slate-900 text-white rounded-2xl flex justify-between items-center shadow-xl">
                  <div className="space-y-0.5"><p className="text-[9px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">Final Earning Days</p><h4 className="text-3xl font-black text-primary">{adjustmentState.earningDays} Days</h4></div>
                  <div className="text-right space-y-0.5"><p className="text-[9px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">Impact</p><p className="text-xs font-bold text-emerald-400">+{adjustmentState.balanceUsed} Adjusted</p></div>
                </div>
              </div>
              <DialogFooter className="p-6 bg-slate-50 border-t gap-3">
                <Button variant="ghost" onClick={() => setAdjustLeaveEmp(null)} className="flex-1 h-12 rounded-xl font-bold">Cancel</Button>
                <Button onClick={handlePostAdjustment} className="flex-1 h-12 rounded-xl font-black bg-primary shadow-lg shadow-primary/20">Finalize Adjustment</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <TabsContent value="payment" className="mt-8 space-y-8">
            <Card className="border-none shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50 border-b p-6"><div className="flex flex-col lg:flex-row items-center gap-4"><div className="relative flex-1 w-full"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search slips..." className="pl-10 h-10 bg-white" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setPaymentPendingPage(1); }} /></div><Select value={selectedMonth} onValueChange={(v) => { setSelectedMonth(v); setPaymentPendingPage(1); }}><SelectTrigger className="w-full sm:w-40 bg-white h-10 font-bold"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Pending</SelectItem>{PAYROLL_MONTHS_10Y.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div></CardHeader>
              <CardContent className="p-0">
                <Table className="min-w-[1300px]"><TableHeader className="bg-slate-50"><TableRow><TableHead className="font-bold px-2">Slip Details</TableHead><TableHead className="font-bold px-2">Employee Name / ID</TableHead><TableHead className="font-bold px-2">Month</TableHead><TableHead className="font-bold text-right px-2">Net Payable</TableHead><TableHead className="font-bold text-right px-2">Salary Paid</TableHead><TableHead className="text-right font-bold pr-6 px-2">Actions</TableHead></TableRow></TableHeader>
                <TableBody>{paginatedPaymentPending.map((p) => (
                  <TableRow key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="px-2 font-mono font-bold text-primary cursor-pointer hover:underline" onClick={() => setPreviewSlip(p)}>{p.slipNo}</TableCell>
                    <TableCell className="px-2 font-bold uppercase text-sm">{p.employeeName}</TableCell>
                    <TableCell className="text-center px-2"><Badge variant="secondary" className="font-bold">{p.month}</Badge></TableCell>
                    <TableCell className="text-right font-black px-2">{formatCurrency(p.netPayable)}</TableCell>
                    <TableCell className="text-right font-black text-emerald-600 px-2">{formatCurrency(p.salaryPaidAmount)}</TableCell>
                    <TableCell className="text-right pr-6 px-2"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" className="text-primary hover:bg-primary/5" onClick={() => { setPaySalaryRec(p); setPaymentAmount(p.netPayable - p.salaryPaidAmount); }}><CreditCard className="w-4 h-4" /></Button><Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-600" onClick={() => handleDownloadAndPrint(p)}><Download className="w-4 h-4" /></Button></div></TableCell>
                  </TableRow>
                ))}</TableBody></Table>
              </CardContent>
              {totalPagesPayPending > 1 && <StandardPaginationFooter current={paymentPendingPage} total={totalPagesPayPending} onPageChange={setPaymentPendingPage} />}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
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
