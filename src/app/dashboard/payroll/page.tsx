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
  CalendarClock,
  Wallet
} from "lucide-react";
import { formatCurrency, numberToIndianWords, cn, formatDate } from "@/lib/utils";
import { useData } from "@/context/data-context";
import { useToast } from "@/hooks/use-toast";
import { Employee, PayrollRecord, SalaryPaymentRecord, Firm } from "@/lib/types";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { parseISO, isBefore, startOfMonth, isValid, format } from "date-fns";

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
  const [advancePage, setAdvancePage] = useState(1);

  const [paySalaryRec, setPaySalaryRec] = useState<PayrollRecord | null>(null);
  const [printSlip, setPrintSlip] = useState<PayrollRecord | null>(null);
  
  const [adjustLeaveEmp, setAdjustLeaveEmp] = useState<Employee | null>(null);
  const [isAdjustingBalance, setIsAdjustingBalance] = useState(false);
  const [adjustmentState, setAdjustmentState] = useState({
    present: 0, absent: 0, holidayWork: 0, holidayBanked: 0, holidayPaid: 0, balanceUsed: 0, remainingBalance: 0, earningDays: 0, isPaidAction: false, isBankedAction: false
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
    setPaymentDate(new Date().toISOString().split('T')[0]);
  }, []);

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

      if (newPaid >= paySalaryRec.netPayable) {
        addRecord('notifications', {
          message: `Salary Disbursed: ${paySalaryRec.employeeName} (${paySalaryRec.month})`,
          timestamp: format(new Date(), "yyyy-MM-dd HH:mm:ss"),
          read: false,
          type: 'SALARY_PAID',
          employeeId: paySalaryRec.employeeId
        });
      }

      toast({ title: "Payment Recorded" });
      setPaySalaryRec(null);
    } finally { setIsProcessing(false); }
  };

  const getAttendanceMetricsForMonth = (empId: string, monthStr: string) => {
    if (!monthStr || monthStr === 'all') return { presents: 0, holidayWork: 0 };
    const [mmm, yy] = monthStr.split('-');
    const mIndex = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(mmm);
    const year = 2000 + parseInt(yy);
    const monthlyAttendance = attendanceRecords.filter(r => {
      if (r.employeeId !== empId || !r.approved) return false;
      const d = parseISO(r.date);
      return isValid(d) && d.getMonth() === mIndex && d.getFullYear() === year;
    });
    const holidayWork = monthlyAttendance.filter(r => r.inPlant === 'Holiday Work' || r.status === 'HOLIDAY').length;
    const presents = monthlyAttendance.filter(r => ['PRESENT', 'FIELD', 'WFH'].includes(r.status) && r.inPlant !== 'Holiday Work').length;
    const halfDays = monthlyAttendance.filter(r => r.status === 'HALF_DAY' && r.inPlant !== 'Holiday Work').length;
    return { presents: presents + (halfDays * 0.5), holidayWork };
  };

  const pendingGenerationEmployees = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return employees.filter(emp => {
      const match = emp.name.toLowerCase().includes(search) || emp.employeeId.toLowerCase().includes(search);
      const firmMatch = selectedFirmId === "all" || emp.firmId === selectedFirmId;
      const done = payrollRecords.some(p => p.employeeId === emp.employeeId && p.month === selectedMonth);
      return match && firmMatch && !done;
    }).map(emp => ({ ...emp, metrics: getAttendanceMetricsForMonth(emp.employeeId, selectedMonth) }));
  }, [employees, searchTerm, selectedFirmId, payrollRecords, selectedMonth, attendanceRecords]);

  const paymentTabLists = useMemo(() => {
    const search = searchTerm.toLowerCase();
    const filtered = payrollRecords.filter(p => {
      const emp = employees.find(e => e.employeeId === p.employeeId);
      const match = p.employeeName.toLowerCase().includes(search) || p.employeeId.toLowerCase().includes(search);
      const firmMatch = selectedFirmId === "all" || emp?.firmId === selectedFirmId;
      return match && firmMatch;
    });
    const pending = filtered.filter(p => (p.netPayable - (p.salaryPaidAmount || 0)) > 0);
    return { pending };
  }, [payrollRecords, searchTerm, selectedFirmId, employees]);

  const advanceSalaryData = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return employees.filter(emp => {
      const match = emp.name.toLowerCase().includes(search) || emp.employeeId.toLowerCase().includes(search);
      const firmMatch = selectedFirmId === "all" || emp.firmId === selectedFirmId;
      return match && firmMatch;
    }).map(emp => {
      const empVouchers = vouchers.filter(v => v.employeeId === emp.id && v.status === 'PAID');
      const totalAdv = empVouchers.reduce((sum, v) => sum + v.amount, 0);
      const totalRecovered = payrollRecords
        .filter(p => p.employeeId === emp.employeeId)
        .reduce((sum, p) => sum + (p.advanceRecovery || 0), 0);
      return {
        ...emp,
        totalAdvance: totalAdv,
        totalRecovered: totalRecovered,
        remainingBalance: Math.max(0, totalAdv - totalRecovered)
      };
    }).sort((a, b) => b.remainingBalance - a.remainingBalance);
  }, [employees, vouchers, payrollRecords, searchTerm, selectedFirmId]);

  if (!isMounted) return null;

  if (adjustLeaveEmp) {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="rounded-3xl border-none shadow-2xl overflow-hidden bg-white flex flex-col min-h-[calc(100vh-140px)]">
          <div className="p-8 bg-slate-900 text-white shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center"><Calculator className="w-7 h-7 text-primary" /></div>
              <div><h2 className="text-2xl font-black">{adjustLeaveEmp.name}</h2><p className="text-slate-400 font-bold text-xs uppercase tracking-widest">{adjustLeaveEmp.department} / {adjustLeaveEmp.designation}</p></div>
            </div>
            <div className="flex gap-4">
              <div className="px-6 py-2 bg-white/5 rounded-xl border border-white/10 text-center"><p className="text-[9px] font-black text-primary uppercase">Month</p><p className="text-sm font-black">{selectedMonth}</p></div>
              <div className="px-6 py-2 bg-white/5 rounded-xl border border-white/10 text-center"><p className="text-[9px] font-black text-slate-400 uppercase">Working Days</p><p className="text-sm font-black">26</p></div>
            </div>
          </div>
          <ScrollArea className="flex-1 bg-white">
            <div className="p-10 space-y-12">
               <Table className="border border-slate-100 rounded-2xl">
                  <TableHeader className="bg-slate-50"><TableRow><TableHead className="py-5 px-8 font-black uppercase text-[11px]">Adjustment Type</TableHead><TableHead className="text-center font-black uppercase text-[11px]">Days</TableHead><TableHead className="text-right pr-8 font-black uppercase text-[11px]">Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                     <TableRow><TableCell className="py-6 px-8 font-bold">Attendance Working Day</TableCell><TableCell className="text-center font-black text-xl">{adjustmentState.present}</TableCell><TableCell className="text-right pr-8"><Button variant="outline" className="rounded-xl" onClick={() => setIsAdjustingBalance(true)}>Adjust</Button></TableCell></TableRow>
                     <TableRow><TableCell className="py-6 px-8 font-bold">Working on Holiday</TableCell><TableCell className="text-center font-black text-xl">{adjustmentState.holidayWork}</TableCell><TableCell className="text-right pr-8"><div className="flex justify-end gap-3"><Button className="bg-emerald-600" onClick={() => setAdjustmentState(p => ({...p, holidayPaid: p.holidayWork, earningDays: p.present + p.balanceUsed + p.holidayWork}))}>Pay</Button><Button variant="outline" onClick={() => setAdjustmentState(p => ({...p, holidayBanked: p.holidayWork, earningDays: p.present + p.balanceUsed}))}>Advance Leave</Button></div></TableCell></TableRow>
                     <TableRow><TableCell className="py-6 px-8 font-bold">Absent</TableCell><TableCell className="text-center font-black text-xl text-rose-600">{adjustmentState.absent}</TableCell><TableCell className="text-right pr-8">—</TableCell></TableRow>
                  </TableBody>
               </Table>
               <div className="p-8 bg-slate-50 rounded-3xl border flex justify-between items-center"><p className="text-[10px] font-black uppercase text-slate-400">Final Earning Days Preview</p><p className="text-4xl font-black">{adjustmentState.earningDays} Days</p></div>
            </div>
          </ScrollArea>
          <div className="p-4 bg-slate-50 border-t flex justify-end gap-4"><Button variant="ghost" onClick={() => setAdjustLeaveEmp(null)}>Cancel</Button><Button className="bg-primary px-10 h-12 font-black" onClick={() => { setAdjustedEmployees(prev => ({...prev, [adjustLeaveEmp.id]: {adjusted: true, earningDays: adjustmentState.earningDays, balanceUsed: adjustmentState.balanceUsed, balanceAdded: adjustmentState.holidayBanked}})); setAdjustLeaveEmp(null); }}>Finalize Adjustments</Button></div>
        </div>
        <Dialog open={isAdjustingBalance} onOpenChange={setIsAdjustingBalance}><DialogContent><div className="p-10 space-y-4 text-center"><h3 className="font-black text-xl">Adjust Leave Balance</h3><p className="text-xs text-muted-foreground">Available Balance: {adjustLeaveEmp.advanceLeaveBalance || 0} Days</p><Input type="number" className="text-center h-14 text-2xl font-black" value={adjustmentState.balanceUsed} onChange={(e) => { const v = parseFloat(e.target.value) || 0; setAdjustmentState(p => ({...p, balanceUsed: v, earningDays: p.present + v + p.holidayPaid})); }} /><Button className="w-full h-12 font-black" onClick={() => setIsAdjustingBalance(false)}>Post Adjustment</Button></div></DialogContent></Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 font-calibri print:hidden">
        <div><h1 className="text-2xl font-bold">Payroll Management</h1><p className="text-muted-foreground">Centralized alerts and processing for staff earnings.</p></div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-xl bg-slate-100 p-1 rounded-xl h-12">
            <TabsTrigger value="generate">Generate Salary</TabsTrigger>
            <TabsTrigger value="payment">Salary Payment</TabsTrigger>
            <TabsTrigger value="advance">Advance Salary</TabsTrigger>
          </TabsList>
          
          <TabsContent value="generate" className="mt-8 space-y-6">
            <Card className="border-none shadow-sm"><CardHeader className="bg-slate-50 border-b flex flex-row items-center gap-4"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search staff..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div><Select value={selectedMonth} onValueChange={setSelectedMonth}><SelectTrigger className="w-40 font-bold"><SelectValue /></SelectTrigger><SelectContent>{PAYROLL_MONTHS_12M_GEN.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></CardHeader>
            <CardContent className="p-0"><Table className="min-w-[1200px]"><TableHeader className="bg-slate-50"><TableRow><TableHead className="font-bold">Employee Name / ID</TableHead><TableHead className="font-bold">Dept / Designation</TableHead><TableHead className="font-bold">Month</TableHead><TableHead className="font-bold text-right">Monthly CTC</TableHead><TableHead className="text-right font-bold pr-6">Actions</TableHead></TableRow></TableHeader>
            <TableBody>{pendingGenerationEmployees.map((emp: any) => { const adj = adjustedEmployees[emp.id]; return (
              <TableRow key={emp.id} className="hover:bg-slate-50/50"><TableCell><div className="flex flex-col"><span className="font-bold uppercase text-sm">{emp.name}</span><span className="text-xs font-mono text-primary font-black">{emp.employeeId}</span></div></TableCell><TableCell><div className="text-sm font-medium">{emp.department}</div><div className="text-[10px] text-muted-foreground uppercase">{emp.designation}</div></TableCell><TableCell><Badge variant="outline" className="font-bold">{selectedMonth}</Badge></TableCell><TableCell className="text-right font-bold">{formatCurrency(emp.salary.monthlyCTC)}</TableCell><TableCell className="text-right pr-6"><div className="flex justify-end gap-2"><Button variant="outline" size="sm" className={cn(adj?.adjusted && "bg-emerald-50 text-emerald-700")} onClick={() => { setAdjustmentState({present: emp.metrics.presents, absent: 26 - emp.metrics.presents, holidayWork: emp.metrics.holidayWork, holidayBanked: 0, holidayPaid: 0, balanceUsed: 0, remainingBalance: emp.advanceLeaveBalance || 0, earningDays: emp.metrics.presents, isPaidAction: false, isBankedAction: false}); setAdjustLeaveEmp(emp); }}>Adjust Leave</Button><Button size="sm" className="font-black bg-primary" disabled={!adj?.adjusted} onClick={() => router.push(`/dashboard/payroll/generate/${emp.id}?month=${selectedMonth}&earningDays=${adj.earningDays}`)}>Generate</Button></div></TableCell></TableRow>
            );})}</TableBody></Table></CardContent></Card>
          </TabsContent>
          
          <TabsContent value="payment" className="mt-8 space-y-6">
            <Card className="border-none shadow-sm"><CardHeader className="bg-slate-50 border-b flex flex-row items-center gap-4"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search slips..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div></CardHeader>
            <CardContent className="p-0"><Table><TableHeader className="bg-slate-50"><TableRow><TableHead className="font-bold">Slip No</TableHead><TableHead className="font-bold">Employee Name</TableHead><TableHead className="font-bold text-center">Month</TableHead><TableHead className="font-bold text-right">Net Payable</TableHead><TableHead className="text-right font-bold pr-6">Actions</TableHead></TableRow></TableHeader>
            <TableBody>{paymentTabLists.pending.map((p) => (<TableRow key={p.id} className="hover:bg-slate-50/50"><TableCell className="font-mono font-bold text-blue-600">{p.slipNo}</TableCell><TableCell className="font-bold uppercase text-sm">{p.employeeName}</TableCell><TableCell className="text-center"><Badge variant="secondary">{p.month}</Badge></TableCell><TableCell className="text-right font-black">{formatCurrency(p.netPayable)}</TableCell><TableCell className="text-right pr-6"><Button variant="ghost" size="icon" onClick={() => { setPaySalaryRec(p); setPaymentAmount(p.netPayable - p.salaryPaidAmount); }}><CreditCard className="w-4 h-4" /></Button></TableCell></TableRow>))}</TableBody></Table></CardContent></Card>
          </TabsContent>

          <TabsContent value="advance" className="mt-8 space-y-6">
            <Card className="border-none shadow-sm">
              <CardHeader className="bg-slate-50 border-b flex flex-row items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-black">Advance Salary Ledger</CardTitle>
                    <CardDescription className="text-xs">Tracking advance payments and recoveries.</CardDescription>
                  </div>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search employee..." className="pl-10 h-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="w-full">
                  <Table className="min-w-[1000px]">
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="font-black text-[11px] uppercase tracking-widest px-6">Employee Name / ID</TableHead>
                        <TableHead className="font-black text-[11px] uppercase tracking-widest text-right">Total Advance Given</TableHead>
                        <TableHead className="font-black text-[11px] uppercase tracking-widest text-right">Total Recovered</TableHead>
                        <TableHead className="font-black text-[11px] uppercase tracking-widest text-right pr-6">Remaining Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {advanceSalaryData.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-center py-20 text-muted-foreground">No records found.</TableCell></TableRow>
                      ) : (
                        advanceSalaryData.map((emp) => (
                          <TableRow key={emp.id} className="hover:bg-slate-50/50">
                            <TableCell className="px-6">
                              <div className="flex flex-col">
                                <span className="font-bold uppercase text-sm">{emp.name}</span>
                                <span className="text-[10px] font-mono text-primary font-black uppercase">{emp.employeeId}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-bold text-slate-600">{formatCurrency(emp.totalAdvance)}</TableCell>
                            <TableCell className="text-right font-bold text-emerald-600">{formatCurrency(emp.totalRecovered)}</TableCell>
                            <TableCell className="text-right pr-6">
                              <Badge className={cn("font-black text-sm px-4", emp.remainingBalance > 0 ? "bg-rose-50 text-rose-700 border-rose-100" : "bg-emerald-50 text-emerald-700 border-emerald-100")}>
                                {formatCurrency(emp.remainingBalance)}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        <Dialog open={!!paySalaryRec} onOpenChange={(o) => !o && setPaySalaryRec(null)}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle className="flex items-center gap-2"><CreditCard className="w-5 h-5 text-primary" /> Record Disbursement</DialogTitle></DialogHeader><div className="p-8 space-y-6"><div className="bg-slate-50 p-4 rounded-xl border flex justify-between items-center"><span className="text-[10px] font-black text-slate-400 uppercase">Amount Due</span><span className="text-lg font-black text-rose-600">{formatCurrency(paymentAmount)}</span></div><Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="h-11 font-bold" /><Button onClick={handlePostPayment} className="w-full h-12 font-black bg-primary">Confirm Pay</Button></div></DialogContent></Dialog>
    </div>
  );
}