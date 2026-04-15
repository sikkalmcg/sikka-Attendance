
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
  MinusCircle
} from "lucide-react";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCurrency, numberToIndianWords, cn } from "@/lib/utils";
import { useData } from "@/context/data-context";
import { useToast } from "@/hooks/use-toast";
import { Employee, PayrollRecord, SalaryPaymentRecord, StatutoryPaymentRecord, Firm } from "@/lib/types";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { parseISO, format } from "date-fns";

const generatePayrollMonths = () => {
  const options = [];
  const date = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
    const mmm = d.toLocaleString('en-US', { month: 'short' });
    const yy = d.getFullYear().toString().slice(-2);
    options.push(`${mmm}-${yy}`);
  }
  return options;
};

const PAYROLL_MONTHS = generatePayrollMonths();

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

  const [advancePage, setAdvancePage] = useState(1);
  const rowsPerPageAdvance = 15;

  const [paySalaryRec, setPaySalaryRec] = useState<PayrollRecord | null>(null);
  const [payPFRec, setPayPFRec] = useState<PayrollRecord | null>(null);
  const [payESICRec, setPayESICRec] = useState<PayrollRecord | null>(null);
  const [adjustLeaveEmp, setAdjustLeaveEmp] = useState<Employee | null>(null);
  const [isSubAdjustmentOpen, setIsSubAdjustmentOpen] = useState(false);
  const [subAdjustmentValue, setSubAdjustmentValue] = useState(0);
  
  const [previewSlip, setPreviewSlip] = useState<PayrollRecord | null>(null);
  const [printSlip, setPrintSlip] = useState<PayrollRecord | null>(null);
  const [viewAdvanceEmployee, setViewAdvanceEmployee] = useState<{emp: Employee, vouchers: any[]} | null>(null);
  
  const [adjustmentState, setAdjustmentState] = useState({
    present: 0,
    absent: 0,
    holidayWork: 0,
    holidayBanked: 0,
    holidayPaid: 0,
    balanceUsed: 0,
    remainingBalance: 0,
    earningDays: 0,
    monthWorkingDays: 26,
    monthHolidays: 4
  });

  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentType, setPaymentType] = useState<'BANKING' | 'CASH' | 'CHEQUE'>('BANKING');
  const [paymentRef, setPaymentRef] = useState("");

  const [pfPaidEmp, setPfPaidEmp] = useState(0);
  const [pfPaidEx, setPfPaidEx] = useState(0);
  const [esicPaidEmp, setEsicPaidEmp] = useState(0);
  const [esicPaidEx, setEsicPaidEx] = useState(0);

  const [adjustedEmployees, setAdjustedEmployees] = useState<Record<string, { adjusted: boolean, earningDays: number }>>({});

  useEffect(() => {
    setIsMounted(true);
    setSelectedMonth(PAYROLL_MONTHS[0]);
    setPaymentDate(new Date().toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    setAdjustedEmployees({});
  }, [selectedMonth]);

  const isGenerationAllowed = useMemo(() => {
    if (!selectedMonth) return false;
    const allowedWindow = PAYROLL_MONTHS.slice(0, 4);
    return allowedWindow.includes(selectedMonth);
  }, [selectedMonth]);

  const pendingGenerationEmployees = useMemo(() => {
    if (!isGenerationAllowed) return [];
    const sorted = [...(employees || [])].sort((a, b) => (b.id || "").localeCompare(a.id || ""));
    return sorted.filter(emp => {
      const search = searchTerm.toLowerCase();
      const matchesSearch = (
        emp.name.toLowerCase().includes(search) ||
        emp.employeeId.toLowerCase().includes(search) ||
        emp.aadhaar.includes(search)
      );
      const matchesFirm = selectedFirmId === "all" || emp.firmId === selectedFirmId;
      const alreadyGenerated = payrollRecords.some(p => p.employeeId === emp.employeeId && p.month === selectedMonth);
      return matchesSearch && matchesFirm && !alreadyGenerated;
    });
  }, [employees, searchTerm, selectedFirmId, payrollRecords, selectedMonth, isGenerationAllowed]);

  const finalizedSalaries = useMemo(() => {
    const sorted = [...payrollRecords].sort((a, b) => {
      const dateCompare = (b.slipDate || "").localeCompare(a.slipDate || "");
      if (dateCompare !== 0) return dateCompare;
      return (b.slipNo || "").localeCompare(a.slipNo || "");
    });
    return sorted.filter(p => {
      const emp = employees.find(e => e.employeeId === p.employeeId);
      const search = searchTerm.toLowerCase();
      const matchesSearch = p.employeeName.toLowerCase().includes(search) || p.employeeId.toLowerCase().includes(search) || (p.slipNo || "").toLowerCase().includes(search);
      const matchesFirm = selectedFirmId === "all" || emp?.firmId === selectedFirmId;
      const matchesMonth = selectedMonth === "" || p.month === selectedMonth;
      return matchesSearch && matchesFirm && matchesMonth;
    });
  }, [payrollRecords, searchTerm, selectedFirmId, employees, selectedMonth]);

  const advanceLedgerData = useMemo(() => {
    if (!isMounted) return [];
    const paidVouchers = (vouchers || []).filter(v => v.status === 'PAID');
    const empIdsWithAdvance = Array.from(new Set(paidVouchers.map(v => v.employeeId)));
    const ledger = empIdsWithAdvance.map(empId => {
      const employee = employees.find(e => e.id === empId);
      if (!employee) return null;
      const empVouchers = paidVouchers
        .filter(v => v.employeeId === empId)
        .sort((a, b) => a.date.localeCompare(b.date));
      const totalRecovery = payrollRecords
        .filter(p => p.employeeId === employee.employeeId)
        .reduce((sum, p) => sum + (p.advanceRecovery || 0), 0);
      let remainingRecoveryPool = totalRecovery;
      const voucherBreakdown = empVouchers.map(v => {
        const recoveryForThis = Math.min(v.amount, remainingRecoveryPool);
        remainingRecoveryPool -= recoveryForThis;
        return { ...v, recovered: recoveryForThis, remaining: v.amount - recoveryForThis };
      });
      const totalAdv = empVouchers.reduce((sum, v) => sum + v.amount, 0);
      return { id: employee.id, emp: employee, totalAdvAmount: totalAdv, totalRecoveryAmount: totalRecovery, totalRemainingAmount: Math.max(0, totalAdv - totalRecovery), vouchers: voucherBreakdown };
    }).filter(Boolean).sort((a, b) => (b!.id || "").localeCompare(a!.id || ""));
    return (ledger as any[]).filter(item => {
      const search = searchTerm.toLowerCase();
      return (item.emp.name.toLowerCase().includes(search) || item.emp.employeeId.toLowerCase().includes(search));
    });
  }, [vouchers, payrollRecords, employees, searchTerm, isMounted]);

  const paginatedAdvanceLedger = useMemo(() => {
    const start = (advancePage - 1) * rowsPerPageAdvance;
    return advanceLedgerData.slice(start, start + rowsPerPageAdvance);
  }, [advanceLedgerData, advancePage]);

  const totalAdvancePages = Math.ceil(advanceLedgerData.length / rowsPerPageAdvance);

  const openAdjustmentDialog = (emp: Employee) => {
    const relevantAttendance = attendanceRecords.filter(r => r.employeeId === emp.employeeId);
    
    // Logic: Standard month is 26 Working Days + 4 Holidays = 30 Total
    // Holiday work is attendance marked on a holiday or with "Holiday Work" designation
    const presentOnWorking = relevantAttendance.filter(r => r.status === 'PRESENT' && r.inPlant !== 'Holiday Work').length;
    const holidayPres = relevantAttendance.filter(r => r.inPlant === 'Holiday Work' || r.status === 'HOLIDAY').length; 
    
    const workingDaysCount = 26;
    let initialPresent = presentOnWorking;
    let initialHolidayWork = holidayPres;
    let initialAbsent = Math.max(0, workingDaysCount - initialPresent);

    // AUTO LOGIC: If present < 26 and holiday work exists, shift holiday work to present
    if (initialPresent < workingDaysCount && initialHolidayWork > 0) {
      const needed = workingDaysCount - initialPresent;
      const shift = Math.min(needed, initialHolidayWork);
      initialPresent += shift;
      initialHolidayWork -= shift;
      initialAbsent = Math.max(0, workingDaysCount - initialPresent);
    }

    setAdjustmentState({
      present: initialPresent,
      absent: initialAbsent,
      holidayWork: initialHolidayWork,
      holidayBanked: 0,
      holidayPaid: 0,
      balanceUsed: 0,
      remainingBalance: emp.advanceLeaveBalance || 0,
      earningDays: initialPresent,
      monthWorkingDays: workingDaysCount,
      monthHolidays: 4
    });
    setAdjustLeaveEmp(emp);
  };

  const handlePayHolidayWork = () => {
    setAdjustmentState(prev => ({
      ...prev,
      present: prev.present + prev.holidayWork,
      earningDays: prev.present + prev.holidayWork,
      absent: Math.max(0, prev.monthWorkingDays - (prev.present + prev.holidayWork)),
      holidayWork: 0
    }));
    toast({ title: "Updated", description: "Holiday work converted to paid working days." });
  };

  const handleBankHolidayWork = () => {
    const hw = adjustmentState.holidayWork;
    setAdjustmentState(prev => ({
      ...prev,
      holidayWork: 0,
      holidayBanked: hw,
      remainingBalance: prev.remainingBalance + hw
    }));
    toast({ title: "Banked", description: `${hw} day(s) added to Advance Leave balance.` });
  };

  const handleOpenSubAdjustment = () => {
    setSubAdjustmentValue(0);
    setIsSubAdjustmentOpen(true);
  };

  const handleSaveSubAdjustment = () => {
    if (subAdjustmentValue > adjustmentState.remainingBalance) {
      toast({ variant: "destructive", title: "Over Limit", description: "Cannot adjust more than available balance." });
      return;
    }
    
    const maxNeeded = adjustmentState.monthWorkingDays - adjustmentState.present;
    const finalVal = Math.min(subAdjustmentValue, maxNeeded);

    setAdjustmentState(prev => ({
      ...prev,
      present: prev.present + finalVal,
      earningDays: prev.present + finalVal,
      absent: Math.max(0, prev.monthWorkingDays - (prev.present + finalVal)),
      balanceUsed: prev.balanceUsed + finalVal,
      remainingBalance: prev.remainingBalance - finalVal
    }));

    setIsSubAdjustmentOpen(false);
    toast({ title: "Leave Adjusted", description: `${finalVal} day(s) taken from balance.` });
  };

  const handlePostAdjustment = () => {
    if (!adjustLeaveEmp) return;
    setIsProcessing(true);
    try {
      // Update employee's permanent leave balance
      updateRecord('employees', adjustLeaveEmp.id, { 
        advanceLeaveBalance: adjustmentState.remainingBalance 
      });
      
      // Mark as adjusted for this session
      setAdjustedEmployees(prev => ({ 
        ...prev, 
        [adjustLeaveEmp.id]: { 
          adjusted: true, 
          earningDays: adjustmentState.earningDays 
        } 
      }));
      
      toast({ title: "Finalized", description: `Review complete. Earning Days set to ${adjustmentState.earningDays}` });
      setAdjustLeaveEmp(null);
    } finally { 
      setIsProcessing(false); 
    }
  };

  const handlePostPayment = () => {
    if (!paySalaryRec || isProcessing) return;
    const remaining = paySalaryRec.netPayable - paySalaryRec.salaryPaidAmount;
    if (paymentAmount <= 0 || paymentAmount > remaining) {
      toast({ variant: "destructive", title: "Invalid Amount", description: `Amount must be between 1 and ${formatCurrency(remaining)}` });
      return;
    }
    setIsProcessing(true);
    try {
      const historyEntry: SalaryPaymentRecord = { amount: paymentAmount, date: paymentDate, type: paymentType, reference: paymentRef };
      const newPaid = paySalaryRec.salaryPaidAmount + paymentAmount;
      updateRecord('payroll', paySalaryRec.id, { salaryPaidAmount: newPaid, salaryPaidDate: paymentDate, salaryHistory: [...(paySalaryRec.salaryHistory || []), historyEntry], status: newPaid >= paySalaryRec.netPayable ? 'PAID' : 'FINALIZED' });
      
      addRecord('notifications', {
        message: `Salary Paid: ${formatCurrency(paymentAmount)} to ${paySalaryRec.employeeName} (${paySalaryRec.month})`,
        timestamp: format(new Date(), "yyyy-MM-dd HH:mm:ss"),
        read: false
      });

      toast({ title: "Payment Recorded", description: `Successfully paid ${formatCurrency(paymentAmount)}` });
      setPaySalaryRec(null);
      setPaymentRef("");
    } finally { setIsProcessing(false); }
  };

  const handlePostPFPayment = () => {
    if (!payPFRec || isProcessing) return;
    setIsProcessing(true);
    try {
      const historyEntry: StatutoryPaymentRecord = { employeeAmt: pfPaidEmp, employerAmt: pfPaidEx, date: paymentDate, reference: paymentRef };
      updateRecord('payroll', payPFRec.id, {
        pfPaidAmountEmployee: payPFRec.pfPaidAmountEmployee + pfPaidEmp,
        pfPaidAmountEmployer: payPFRec.pfPaidAmountEmployer + pfPaidEx,
        pfPaidDate: paymentDate,
        pfHistory: [...(payPFRec.pfHistory || []), historyEntry]
      });
      addRecord('notifications', {
        message: `Statutory: PF Payment recorded for ${payPFRec.employeeName} (${payPFRec.month})`,
        timestamp: format(new Date(), "yyyy-MM-dd HH:mm:ss"),
        read: false
      });
      toast({ title: "PF Payment Recorded" });
      setPayPFRec(null);
      setPaymentRef("");
    } finally { setIsProcessing(false); }
  };

  const handlePostESICPayment = () => {
    if (!payESICRec || isProcessing) return;
    setIsProcessing(true);
    try {
      const historyEntry: StatutoryPaymentRecord = { employeeAmt: esicPaidEmp, employerAmt: esicPaidEx, date: paymentDate, reference: paymentRef };
      updateRecord('payroll', payESICRec.id, {
        esicPaidAmountEmployee: payESICRec.esicPaidAmountEmployee + esicPaidEmp,
        esicAmountEmployer: payESICRec.esicAmountEmployer + esicPaidEx,
        esicPaidDate: paymentDate,
        esicHistory: [...(payESICRec.esicHistory || []), historyEntry]
      });
      addRecord('notifications', {
        message: `Statutory: ESIC Payment recorded for ${payESICRec.employeeName} (${payESICRec.month})`,
        timestamp: format(new Date(), "yyyy-MM-dd HH:mm:ss"),
        read: false
      });
      toast({ title: "ESIC Payment Recorded" });
      setPayESICRec(null);
      setPaymentRef("");
    } finally { setIsProcessing(false); }
  };

  const handleDownloadAndPrint = (p: PayrollRecord) => {
    const originalTitle = document.title;
    document.title = p.slipNo || "Salary_Slip";
    setPrintSlip(p);
    toast({ title: "Generating PDF", description: "Applying high-fidelity render for A4 export..." });
    setTimeout(() => {
      window.print();
      document.title = originalTitle;
      setPrintSlip(null);
    }, 1200);
  };

  const handleViewSlip = (p: PayrollRecord) => {
    setPreviewSlip(p);
  };

  if (!isMounted) return null;

  return (
    <div className="relative">
      <div className="space-y-8 pb-12 print:hidden font-calibri">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">Payroll Management</h1>
            <p className="text-muted-foreground">Comprehensive system for earnings, payments and leave adjustment.</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 max-w-2xl bg-slate-100 p-1 rounded-xl h-12">
            <TabsTrigger value="generate" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm font-semibold">Generate Salary</TabsTrigger>
            <TabsTrigger value="payment" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm font-semibold">Salary Payment</TabsTrigger>
            <TabsTrigger value="advance" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm font-semibold">Advance Salary</TabsTrigger>
            <TabsTrigger value="leave" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm font-semibold">Advance Leave</TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="mt-8 space-y-6">
            <Card className="border-none shadow-sm">
              <CardHeader className="bg-slate-50 border-b border-slate-100 px-6 py-4 rounded-t-xl">
                <div className="flex flex-col lg:flex-row items-center gap-4">
                  <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search..." className="pl-10 h-10 bg-white" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
                    <Select value={selectedFirmId} onValueChange={setSelectedFirmId}>
                      <SelectTrigger className="w-full sm:w-48 bg-white h-10"><SelectValue placeholder="All Firms" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Firms</SelectItem>
                        {firms.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                      <SelectTrigger className="w-full sm:w-40 bg-white h-10"><SelectValue /></SelectTrigger>
                      <SelectContent>{PAYROLL_MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {!isGenerationAllowed ? (
                  <div className="flex flex-col items-center justify-center py-24 space-y-4 px-6 text-center">
                    <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center border border-amber-100 shadow-inner">
                      <AlertTriangle className="w-8 h-8 text-amber-600" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-lg font-black text-slate-900 tracking-tight">Generation Restricted</h3>
                      <p className="text-sm text-slate-500 font-medium max-w-sm">
                        For security and compliance, you can only generate salaries for the current month and the previous three months.
                      </p>
                    </div>
                    <Button variant="outline" className="mt-4 font-bold border-slate-200" onClick={() => setSelectedMonth(PAYROLL_MONTHS[0])}>
                      Switch to Current Month
                    </Button>
                  </div>
                ) : (
                  <ScrollArea className="w-full" tabIndex={0}>
                    <Table className="min-w-[1200px]">
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="font-bold">Firm / Unit</TableHead>
                          <TableHead className="font-bold">Employee Name / ID</TableHead>
                          <TableHead className="font-bold">Aadhaar No</TableHead>
                          <TableHead className="font-bold">Dept / Designation</TableHead>
                          <TableHead className="font-bold">Month</TableHead>
                          <TableHead className="font-bold text-right">Monthly CTC</TableHead>
                          <TableHead className="text-right font-bold pr-6">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingGenerationEmployees.length === 0 ? (
                          <TableRow><TableCell colSpan={7} className="text-center py-20 text-muted-foreground">All salaries for {selectedMonth} have been generated.</TableCell></TableRow>
                        ) : (
                          pendingGenerationEmployees.map((emp) => {
                            const adjData = adjustedEmployees[emp.id];
                            const isAdjusted = adjData?.adjusted;
                            const firm = firms.find(f => f.id === emp.firmId);
                            const plant = plants.find(p => p.id === emp.unitId);
                            return (
                              <TableRow key={emp.id} className="hover:bg-slate-50/50">
                                <TableCell>
                                  <div className="flex flex-col">
                                    <span className="text-xs font-bold leading-tight">{firm?.name || "--"}</span>
                                    <span className="text-[10px] text-muted-foreground">{plant?.name || "--"}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-col">
                                    <span className="font-bold uppercase">{emp.name}</span>
                                    <span className="text-xs font-mono text-primary">{emp.employeeId}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs font-mono">{emp.aadhaar}</TableCell>
                                <TableCell>
                                  <div className="flex flex-col">
                                    <span className="text-sm font-medium">{emp.department}</span>
                                    <span className="text-xs text-muted-foreground">{emp.designation}</span>
                                  </div>
                                </TableCell>
                                <TableCell><Badge variant="outline" className="font-bold bg-white">{selectedMonth}</Badge></TableCell>
                                <TableCell className="text-right font-bold text-emerald-600">{formatCurrency(emp.salary.monthlyCTC)}</TableCell>
                                <TableCell className="text-right pr-6">
                                  <div className="flex justify-end gap-2">
                                    <Tooltip><TooltipTrigger asChild>
                                      <Button variant="outline" size="sm" className={cn("text-xs font-bold gap-1", isAdjusted ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "hover:bg-primary/5")} onClick={() => openAdjustmentDialog(emp)}><CalendarClock className="w-3 h-3" /> {isAdjusted ? "Reviewed" : "Adjust Leave"}</Button>
                                    </TooltipTrigger><TooltipContent>Review & Adjust Attendance</TooltipContent></Tooltip>
                                    <Tooltip><TooltipTrigger asChild>
                                      <Button size="sm" className={cn("text-xs font-bold gap-1", isAdjusted ? "bg-primary text-white" : "bg-slate-200 text-slate-400 cursor-not-allowed")} onClick={() => isAdjusted && router.push(`/dashboard/payroll/generate/${emp.id}?month=${selectedMonth}&earningDays=${adjData.earningDays}`)} disabled={!isAdjusted}><Calculator className="w-3 h-3" /> Generate Salary</Button>
                                    </TooltipTrigger><TooltipContent>{isAdjusted ? "Proceed" : "Review first"}</TooltipContent></Tooltip>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payment" className="mt-8 space-y-6">
            <Card className="border-none shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50 border-b p-6">
                <div className="flex flex-col lg:flex-row items-center gap-4">
                  <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search..." className="pl-10 h-10 bg-white" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
                    <Select value={selectedFirmId} onValueChange={setSelectedFirmId}>
                      <SelectTrigger className="w-full sm:w-48 bg-white h-10"><SelectValue placeholder="All Firms" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Firms</SelectItem>
                        {firms.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                      <SelectTrigger className="w-full sm:w-40 bg-white h-10"><SelectValue /></SelectTrigger>
                      <SelectContent>{PAYROLL_MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="w-full" tabIndex={0}>
                  <Table className="min-w-[1300px]">
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="font-bold">Slip Details</TableHead>
                        <TableHead className="font-bold">Employee Name / ID</TableHead>
                        <TableHead className="font-bold">Dept / Designation</TableHead>
                        <TableHead className="font-bold">Month</TableHead>
                        <TableHead className="font-bold text-right">Net Payable</TableHead>
                        <TableHead className="font-bold text-right">Salary Paid</TableHead>
                        <TableHead className="font-bold text-center">Paid Date</TableHead>
                        <TableHead className="text-right font-bold pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {finalizedSalaries.length === 0 ? (
                        <TableRow><TableCell colSpan={8} className="text-center py-20 text-muted-foreground">No finalized salaries found.</TableCell></TableRow>
                      ) : (
                        finalizedSalaries.map((p) => {
                          const emp = employees.find(e => e.employeeId === p.employeeId);
                          const remainingSalary = p.netPayable - (p.salaryPaidAmount || 0);
                          const remainingPF = (p.pfAmountEmployee + p.pfAmountEmployer) - ((p.pfPaidAmountEmployee || 0) + (p.pfPaidAmountEmployer || 0));
                          const remainingESIC = (p.esicAmountEmployee + p.esicAmountEmployer) - ((p.esicPaidAmountEmployee || 0) + (p.esicPaidAmountEmployer || 0));
                          const hasUnpaid = remainingSalary > 0 || remainingPF > 0 || remainingESIC > 0;

                          return (
                            <TableRow key={p.id} className="hover:bg-slate-50/50">
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="font-mono font-bold text-primary cursor-pointer hover:underline" onClick={() => handleViewSlip(p)}>{p.slipNo}</span>
                                  <span className="text-[10px] text-slate-400">{p.slipDate ? format(parseISO(p.slipDate), 'dd-MMM-yyyy') : "--"}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="font-bold uppercase">{p.employeeName}</span>
                                  <span className="text-xs font-mono text-slate-400">{p.employeeId}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium">{emp?.department || "--"}</span>
                                  <span className="text-xs text-muted-foreground">{emp?.designation || "--"}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center"><Badge variant="secondary" className="bg-slate-100 text-slate-600 font-bold">{p.month}</Badge></TableCell>
                              <TableCell className="text-right font-bold">{formatCurrency(p.netPayable)}</TableCell>
                              <TableCell className="text-right font-bold text-emerald-600">{formatCurrency(p.salaryPaidAmount)}</TableCell>
                              <TableCell className="text-center">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                                  {p.salaryPaidDate ? format(parseISO(p.salaryPaidDate), 'dd-MMM-yyyy') : "--"}
                                </span>
                              </TableCell>
                              <TableCell className="text-right pr-6">
                                <div className="flex justify-end gap-1">
                                  {emp?.isGovComplianceEnabled ? (
                                    <DropdownMenu>
                                      <Tooltip><TooltipTrigger asChild>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="icon" disabled={!hasUnpaid}><CreditCard className="w-4 h-4 text-primary" /></Button>
                                        </DropdownMenuTrigger>
                                      </TooltipTrigger><TooltipContent>Process Payments</TooltipContent></Tooltip>
                                      <DropdownMenuContent align="end" className="w-48">
                                        <DropdownMenuItem disabled={remainingSalary <= 0} onClick={() => { setPaySalaryRec(p); setPaymentAmount(remainingSalary); }}>Pay Salary</DropdownMenuItem>
                                        <DropdownMenuItem disabled={remainingPF <= 0} onClick={() => { setPayPFRec(p); setPfPaidEmp(p.pfAmountEmployee - (p.pfPaidAmountEmployee || 0)); setPfPaidEx(p.pfAmountEmployer - (p.pfPaidAmountEmployer || 0)); }}>Pay PF</DropdownMenuItem>
                                        <DropdownMenuItem disabled={remainingESIC <= 0} onClick={() => { setPayESICRec(p); setEsicPaidEmp(p.esicAmountEmployee - (p.esicPaidAmountEmployee || 0)); setEsicPaidEx(p.esicAmountEmployer - (p.esicAmountEmployer || 0)); }}>Pay ESIC</DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  ) : (
                                    <Tooltip><TooltipTrigger asChild>
                                      <Button variant="ghost" size="icon" disabled={remainingSalary <= 0} onClick={() => { setPaySalaryRec(p); setPaymentAmount(remainingSalary); }}><CreditCard className="w-4 h-4 text-primary" /></Button>
                                    </TooltipTrigger><TooltipContent>Pay Salary</TooltipContent></Tooltip>
                                  )}
                                  <Tooltip><TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" onClick={() => handleDownloadAndPrint(p)}><Download className="w-4 h-4 text-slate-500" /></Button>
                                  </TooltipTrigger><TooltipContent>Quick Download (PDF)</TooltipContent></Tooltip>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="advance">
            <Card className="border-none shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50 border-b p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-50 rounded-lg"><Wallet className="w-5 h-5 text-emerald-600" /></div>
                  <div>
                    <CardTitle className="text-lg font-bold">Advance Salary Ledger</CardTitle>
                    <CardDescription>Track recoveries and sequential voucher-wise adjustment (FIFO).</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="w-full" tabIndex={0}>
                  <Table className="min-w-[1200px]">
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="font-bold">Employee Name / ID</TableHead>
                        <TableHead className="font-bold">Department</TableHead>
                        <TableHead className="font-bold">Designation</TableHead>
                        <TableHead className="text-right font-bold">Total Advanced</TableHead>
                        <TableHead className="text-right font-bold text-primary">Recovered</TableHead>
                        <TableHead className="text-right font-bold text-rose-600">Remaining</TableHead>
                        <TableHead className="text-right font-bold pr-6">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedAdvanceLedger.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-20 text-muted-foreground">No advance records.</TableCell></TableRow>
                      ) : (
                        paginatedAdvanceLedger.map(item => (
                          <TableRow key={item.id} className="hover:bg-slate-50/50">
                            <TableCell><div className="flex flex-col"><span className="font-bold uppercase">{item.emp.name}</span><span className="text-[10px] font-mono text-primary">{item.emp.employeeId}</span></div></TableCell>
                            <TableCell className="text-sm font-medium">{item.emp.department}</TableCell>
                            <TableCell className="text-sm text-slate-600">{item.emp.designation}</TableCell>
                            <TableCell className="text-right font-bold">{formatCurrency(item.totalAdvAmount)}</TableCell>
                            <TableCell className="text-right font-bold text-primary">{formatCurrency(item.totalRecoveryAmount)}</TableCell>
                            <TableCell className="text-right font-black text-rose-600">{formatCurrency(item.totalRemainingAmount)}</TableCell>
                            <TableCell className="text-right pr-6">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="outline" size="sm" className="font-bold h-8" onClick={() => setViewAdvanceEmployee(item)}>View</Button>
                                </TooltipTrigger>
                                <TooltipContent>Detailed Voucher Audit</TooltipContent>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leave">
            <Card className="border-none shadow-sm overflow-hidden">
              <CardContent className="p-0">
                <ScrollArea className="w-full" tabIndex={0}>
                  <Table className="min-w-[1000px]">
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="font-bold">Employee Name</TableHead>
                        <TableHead className="font-bold text-center">Available Balance</TableHead>
                        <TableHead className="text-right font-bold pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employees.map(emp => (
                        <TableRow key={emp.id} className="hover:bg-slate-50/50">
                          <TableCell><div className="flex flex-col"><span className="font-bold uppercase">{emp.name}</span><span className="text-[10px] font-mono text-slate-400">{emp.employeeId}</span></div></TableCell>
                          <TableCell className="text-center font-black text-primary">{emp.advanceLeaveBalance || 0} Days</TableCell>
                          <TableCell className="text-right pr-6">
                            <Tooltip><TooltipTrigger asChild>
                              <Button variant="ghost" size="sm" className="font-bold gap-2"><History className="w-4 h-4" /> View History</Button>
                            </TooltipTrigger><TooltipContent>View Leave Accrual History</TooltipContent></Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Adjust Leave Main Dialog */}
        <Dialog open={!!adjustLeaveEmp} onOpenChange={(o) => !o && setAdjustLeaveEmp(null)}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
            {adjustLeaveEmp && (
              <>
                <DialogHeader className="p-6 border-b bg-slate-50 flex flex-row justify-between items-start shrink-0">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
                      <CalendarClock className="w-8 h-8 text-white" />
                    </div>
                    <div className="space-y-0.5">
                      <DialogTitle className="text-2xl font-black text-slate-900 uppercase">
                        {adjustLeaveEmp.name}
                      </DialogTitle>
                      <div className="flex items-center gap-3 text-xs font-bold text-slate-500">
                        <span className="font-mono text-primary bg-primary/5 px-2 py-0.5 rounded">ID: {adjustLeaveEmp.employeeId}</span>
                        <span>•</span>
                        <span>{adjustLeaveEmp.department} / {adjustLeaveEmp.designation}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none">Remaining Adv. Leave</p>
                    <p className={cn(
                      "text-3xl font-black leading-none mt-2",
                      adjustmentState.remainingBalance > 0 ? "text-emerald-600" : "text-slate-300"
                    )}>{adjustmentState.remainingBalance} Days</p>
                  </div>
                </DialogHeader>

                <div className="py-5 bg-white border-b flex justify-around items-center shrink-0">
                  <div className="text-center">
                    <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Salary Month</p>
                    <p className="font-bold text-slate-700">{selectedMonth}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Working Days</p>
                    <p className="font-bold text-slate-700">{adjustmentState.monthWorkingDays} Days</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Month Holidays</p>
                    <p className="font-bold text-slate-700">{adjustmentState.monthHolidays} Days</p>
                  </div>
                </div>

                <div className="flex-1 overflow-auto p-8 space-y-8">
                  <div className="border rounded-2xl overflow-hidden shadow-sm">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="font-black text-[10px] uppercase">Attendance Segment</TableHead>
                          <TableHead className="font-black text-[10px] uppercase text-center">Count</TableHead>
                          <TableHead className="font-black text-[10px] uppercase text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-bold">Total Present on Working Days</TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-emerald-100 text-emerald-700 font-black text-sm px-4">{adjustmentState.present} Days</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {adjustmentState.present < adjustmentState.monthWorkingDays && adjustmentState.remainingBalance > 0 && (
                              <Button variant="outline" size="sm" className="h-8 text-[10px] font-black uppercase gap-2 hover:bg-primary hover:text-white" onClick={handleOpenSubAdjustment}>
                                <PlusCircle className="w-3 h-3" /> Adjust Leave
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-bold">Total Absent</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="border-rose-200 text-rose-600 bg-rose-50 font-black text-sm px-4">{adjustmentState.absent} Days</Badge>
                          </TableCell>
                          <TableCell className="text-right"></TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-bold">Present on Holidays (Holiday Work)</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="border-amber-200 text-amber-600 bg-amber-50 font-black text-sm px-4">{adjustmentState.holidayWork} Days</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {adjustmentState.holidayWork > 0 && (
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="outline" className="h-8 text-[10px] font-black uppercase gap-2" onClick={handlePayHolidayWork}>Pay Work</Button>
                                <Button size="sm" variant="outline" className="h-8 text-[10px] font-black uppercase gap-2 border-emerald-200 text-emerald-600 hover:bg-emerald-50" onClick={handleBankHolidayWork}>Add to Balance</Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  <div className="bg-slate-50 p-6 rounded-2xl border-2 border-dashed border-slate-200 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Reconciled Monthly Earning Days</p>
                      <p className="text-xs font-bold text-slate-500 mt-1 italic">Calculated based on attendance + adjustments</p>
                    </div>
                    <div className="text-right">
                      <p className="text-4xl font-black text-primary">{adjustmentState.earningDays}</p>
                      <p className="text-[9px] font-black uppercase text-primary/60">Days</p>
                    </div>
                  </div>
                </div>

                <DialogFooter className="p-6 bg-slate-900 border-t flex flex-row items-center justify-between shrink-0">
                  <Button variant="ghost" className="text-slate-400 hover:text-white hover:bg-slate-800 h-12 px-8 font-bold" onClick={() => setAdjustLeaveEmp(null)}>
                    Cancel
                  </Button>
                  <Button className="bg-primary hover:bg-primary/90 h-12 px-16 font-black rounded-xl text-lg shadow-2xl shadow-primary/30" onClick={handlePostAdjustment}>
                    Post Adjustment
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Sub-Dialog for Leave Balance Adjustment */}
        <Dialog open={isSubAdjustmentOpen} onOpenChange={setIsSubAdjustmentOpen}>
          <DialogContent className="sm:max-w-md rounded-2xl shadow-2xl border-none">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-black text-xl">
                <MinusCircle className="w-5 h-5 text-primary" /> Adjust from Balance
              </DialogTitle>
              <DialogDescription className="font-bold">
                {adjustLeaveEmp?.name} • Balance: {adjustmentState.remainingBalance} Days
              </DialogDescription>
            </DialogHeader>
            <div className="py-8 space-y-4 text-center">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Days to Adjust</Label>
              <div className="flex items-center justify-center gap-6">
                <Button variant="outline" size="icon" className="h-12 w-12 rounded-full border-2" onClick={() => setSubAdjustmentValue(v => Math.max(0, v - 1))}>
                  <MinusCircle className="w-6 h-6" />
                </Button>
                <span className="text-5xl font-black text-slate-900 w-20">{subAdjustmentValue}</span>
                <Button variant="outline" size="icon" className="h-12 w-12 rounded-full border-2" onClick={() => setSubAdjustmentValue(v => Math.min(adjustmentState.remainingBalance, v + 1))}>
                  <PlusCircle className="w-6 h-6" />
                </Button>
              </div>
              <p className="text-[10px] font-bold text-rose-500 uppercase tracking-tight mt-4">Note: This will be deducted from employee's future leave pool.</p>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setIsSubAdjustmentOpen(false)} className="rounded-xl font-bold">Cancel</Button>
              <Button className="bg-primary rounded-xl font-black px-10 shadow-lg shadow-primary/20" onClick={handleSaveSubAdjustment}>Confirm & Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!paySalaryRec} onOpenChange={(o) => !o && setPaySalaryRec(null)}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
            {paySalaryRec && (
              <>
                <DialogHeader className="p-6 border-b bg-slate-50 flex flex-row justify-between items-start shrink-0">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <CreditCard className="w-5 h-5 text-primary" />
                      <span className="text-xs font-black uppercase text-slate-400 tracking-widest">Process Salary Payment</span>
                    </div>
                    <DialogTitle className="text-2xl font-black text-slate-900 uppercase">{paySalaryRec.employeeName}</DialogTitle>
                    <div className="flex flex-wrap gap-4 mt-2 text-xs font-bold text-slate-500">
                      <span className="bg-white px-2 py-1 rounded shadow-sm border">ID: {paySalaryRec.employeeId}</span>
                      <span>•</span>
                      <span className="bg-white px-2 py-1 rounded shadow-sm border">SLIP: {paySalaryRec.slipNo}</span>
                      <span>•</span>
                      <span className="bg-white px-2 py-1 rounded shadow-sm border">MONTH: {paySalaryRec.month}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase text-slate-400">Total Earning</p>
                    <p className="text-2xl font-black text-primary">{formatCurrency(paySalaryRec.netPayable)}</p>
                  </div>
                </DialogHeader>

                <ScrollArea className="flex-1 bg-white">
                  <div className="p-8 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                      <div className="space-y-6">
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Paid Amount (INR)</Label>
                            <div className="relative">
                              <Input 
                                type="number" 
                                value={paymentAmount} 
                                onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)} 
                                className="h-14 text-xl font-black text-emerald-600 pl-10"
                              />
                              <Banknote className="absolute left-3 top-4 w-5 h-5 text-slate-300" />
                            </div>
                            <div className="flex justify-between items-center px-1">
                              <p className="text-[10px] font-bold text-slate-400">Remaining: {formatCurrency(paySalaryRec.netPayable - (paySalaryRec.salaryPaidAmount || 0) - paymentAmount)}</p>
                              {paySalaryRec.salaryHistory && paySalaryRec.salaryHistory.length > 0 && (
                                <Badge variant="secondary" className="bg-primary/5 text-primary text-[9px] font-black uppercase">Multi-Payment Enabled</Badge>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-[10px] font-black uppercase text-slate-500">Payment Mode</Label>
                              <Select value={paymentType} onValueChange={(v: any) => setPaymentType(v)}>
                                <SelectTrigger className="h-12 font-bold"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="BANKING">Banking</SelectItem>
                                  <SelectItem value="CASH">Cash</SelectItem>
                                  <SelectItem value="CHEQUE">Cheque</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[10px] font-black uppercase text-slate-500">Payment Date</Label>
                              <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="h-12 font-bold" />
                            </div>
                          </div>

                          {paymentType !== 'CASH' && (
                            <div className="space-y-2">
                              <Label className="text-[10px] font-black uppercase text-slate-500">Reference Number</Label>
                              <Input placeholder="UTR / Trans ID" value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} className="h-12 font-mono" />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2">
                          <History className="w-3.5 h-3.5" /> Payment History Ledger
                        </h4>
                        <div className="border rounded-xl overflow-hidden shadow-sm">
                          <Table>
                            <TableHeader className="bg-slate-50">
                              <TableRow>
                                <TableHead className="text-[9px] font-black uppercase">Date</TableHead>
                                <TableHead className="text-[9px] font-black uppercase">Amount</TableHead>
                                <TableHead className="text-[9px] font-black uppercase">Mode</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {!paySalaryRec.salaryHistory || paySalaryRec.salaryHistory.length === 0 ? (
                                <TableRow><TableCell colSpan={3} className="text-center py-8 text-[10px] text-slate-400 italic">No previous payments recorded.</TableCell></TableRow>
                              ) : (
                                paySalaryRec.salaryHistory.map((h, i) => (
                                  <TableRow key={i}>
                                    <TableCell className="text-[10px] font-bold">{h.date}</TableCell>
                                    <TableCell className="text-[10px] font-black text-emerald-600">{formatCurrency(h.amount)}</TableCell>
                                    <TableCell className="text-[10px] font-bold">{h.type}</TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </div>
                  </div>
                </ScrollArea>

                <DialogFooter className="p-6 bg-slate-900 shrink-0 border-t flex items-center justify-between">
                  <div className="text-left">
                    <p className="text-[9px] font-black uppercase text-emerald-400">Net Payable</p>
                    <p className="text-xl font-black text-white">{formatCurrency(paySalaryRec.netPayable - (paySalaryRec.salaryPaidAmount || 0))}</p>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="ghost" className="text-slate-400 hover:text-white" onClick={() => setPaySalaryRec(null)}>Cancel</Button>
                    <Button className="bg-primary hover:bg-primary/90 px-10 h-12 rounded-xl font-black shadow-xl" onClick={handlePostPayment} disabled={isProcessing}>
                      {isProcessing ? "Processing..." : "Post Payment"}
                    </Button>
                  </div>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={!!previewSlip} onOpenChange={(o) => !o && setPreviewSlip(null)}>
          <DialogContent className="sm:max-w-5xl h-[95vh] flex flex-col p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
            <DialogHeader className="p-6 border-b bg-white flex flex-row items-center justify-between shrink-0 z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><FileText className="w-5 h-5 text-primary" /></div>
                <DialogTitle className="text-xl font-black text-slate-900 tracking-tight">Payroll Slip Preview</DialogTitle>
              </div>
              <div className="flex items-center gap-3 mr-8">
                <Button className="bg-primary hover:bg-primary/90 font-black gap-2 px-8 h-12 rounded-xl shadow-lg shadow-primary/20" onClick={() => handleDownloadAndPrint(previewSlip!)}><Printer className="w-5 h-5" /> Print / Save as PDF</Button>
                <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 hover:bg-slate-100" onClick={() => setPreviewSlip(null)}><X className="h-5 h-5" /></Button>
              </div>
            </DialogHeader>
            <ScrollArea className="flex-1 bg-slate-50/50 p-4 sm:p-10 custom-blue-scrollbar">
              <div className="max-w-[210mm] mx-auto bg-white shadow-2xl p-8 sm:p-12 min-h-[297mm] border-4 border-slate-900 rounded-sm">
                {previewSlip && (
                  <SalarySlipView 
                    record={previewSlip} 
                    employee={employees.find(e => e.employeeId === previewSlip.employeeId)}
                    firm={firms.find(f => f.id === employees.find(e => e.employeeId === previewSlip.employeeId)?.firmId)}
                  />
                )}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>

      {isMounted && printSlip && createPortal(
        <div className="print-only">
          <SalarySlipView 
            record={printSlip} 
            employee={employees.find(e => e.employeeId === printSlip.employeeId)}
            firm={firms.find(f => f.id === employees.find(e => e.employeeId === printSlip.employeeId)?.firmId)}
          />
        </div>,
        document.body
      )}

      <Dialog open={!!viewAdvanceEmployee} onOpenChange={(o) => !o && setViewAdvanceEmployee(null)}>
        <DialogContent className="sm:max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
          {viewAdvanceEmployee && (
            <>
              <DialogHeader className="p-8 border-b bg-slate-50 flex flex-row justify-between items-start shrink-0">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-900/20">
                    <Wallet className="w-8 h-8 text-white" />
                  </div>
                  <div className="space-y-0.5">
                    <DialogTitle className="text-xl font-black text-slate-900 uppercase">
                      {viewAdvanceEmployee.emp.name}
                    </DialogTitle>
                    <div className="flex items-center gap-3 text-xs font-bold text-slate-500">
                      <span className="font-mono text-primary bg-primary/5 px-2 py-0.5 rounded">ID: {viewAdvanceEmployee.emp.employeeId}</span>
                      <span>•</span>
                      <span>{viewAdvanceEmployee.emp.department}</span>
                      <span>/</span>
                      <span>{viewAdvanceEmployee.emp.designation}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Active Advance Bal.</p>
                  <p className="text-3xl font-black text-rose-600 leading-none mt-1">{formatCurrency(viewAdvanceEmployee.totalRemainingAmount)}</p>
                </div>
              </DialogHeader>

              <ScrollArea className="flex-1 p-8 bg-white" tabIndex={0}>
                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatBox label="Total Advanced" value={formatCurrency(viewAdvanceEmployee.totalAdvAmount)} color="text-slate-900" />
                    <StatBox label="Total Recovered" value={formatCurrency(viewAdvanceEmployee.totalRecoveryAmount)} color="text-emerald-600" />
                    <StatBox label="Outstanding" value={formatCurrency(viewAdvanceEmployee.totalRemainingAmount)} color="text-rose-600" />
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-xs font-black uppercase text-slate-400 flex items-center gap-2 tracking-widest">
                      <History className="w-4 h-4" /> Sequential Recovery Audit (FIFO)
                    </h4>
                    <div className="border rounded-2xl overflow-hidden shadow-sm">
                      <Table>
                        <TableHeader className="bg-slate-50">
                          <TableRow>
                            <TableHead className="font-bold">Voucher No</TableHead>
                            <TableHead className="font-bold">Paid Date</TableHead>
                            <TableHead className="font-bold text-right">Voucher Amt</TableHead>
                            <TableHead className="font-bold text-right text-emerald-600">Recovered</TableHead>
                            <TableHead className="font-bold text-right text-rose-600">Remaining</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {viewAdvanceEmployee.vouchers.map((v: any) => (
                            <TableRow key={v.id} className="hover:bg-slate-50/50">
                              <TableCell className="font-mono font-bold text-primary">{v.voucherNo}</TableCell>
                              <TableCell className="text-sm font-medium">{format(parseISO(v.date), 'dd-MMM-yyyy')}</TableCell>
                              <TableCell className="text-right font-bold">{formatCurrency(v.amount)}</TableCell>
                              <TableCell className="text-right font-bold text-emerald-600">{formatCurrency(v.recovered)}</TableCell>
                              <TableCell className="text-right font-black text-rose-600">{formatCurrency(v.remaining)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              </ScrollArea>

              <DialogFooter className="p-6 bg-slate-50 border-t">
                <Button variant="outline" className="px-10 h-12 rounded-xl font-bold" onClick={() => setViewAdvanceEmployee(null)}>Close Ledger</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SalarySlipView({ record, employee, firm }: { record: PayrollRecord, employee?: Employee, firm?: Firm }) {
  const basicVal = record.totalEarningDays > 0 ? Math.round((employee?.salary.basic || 0) / 30 * record.totalEarningDays) : 0;
  const hraVal = record.totalEarningDays > 0 ? Math.round((employee?.salary.hra || 0) / 30 * record.totalEarningDays) : 0;
  const allowanceVal = record.totalEarningDays > 0 ? Math.round((employee?.salary.allowance || 0) / 30 * record.totalEarningDays) : 0;

  const earnings = [
    { label: "Total Earnings", value: basicVal + hraVal + allowanceVal },
    { label: "Incentives", value: record.incentiveAmt || 0 },
    { label: "Holiday Work Pay", value: record.holidayWorkAmt || 0 },
  ];

  const deductions = [
    ...(employee?.isGovComplianceEnabled ? [
      { label: "PF Employee Share", value: record.pfAmountEmployee || 0 },
      { label: "ESIC Employee Share", value: record.absent || 0 },
    ] : []),
    { label: "Advance Recovery", value: record.advanceRecovery || 0 },
  ];

  const totalEarnings = earnings.reduce((sum, e) => sum + e.value, 0);
  const totalDeductions = deductions.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="text-slate-900 space-y-8 font-calibri bg-white">
      <div className="flex items-start mb-4 relative">
        <div className="w-24 shrink-0">
          {firm?.logo ? <img src={firm.logo} className="h-16 object-contain" alt="Logo" /> : <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center border-2 border-slate-900"><Building2 className="w-8 h-8 text-slate-400" /></div>}
        </div>
        <div className="flex-1 text-center">
          <h2 className="text-2xl font-black uppercase tracking-[0.2em] underline underline-offset-8 decoration-2 text-slate-900">PAYROLL SLIP - {record.month}</h2>
        </div>
        <div className="w-24 shrink-0" />
      </div>

      <div className="text-center space-y-1">
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900">{firm?.name || "SIKKA INDUSTRIES AND LOGISTICS"}</h1>
        <p className="text-[11px] font-bold text-slate-600 uppercase max-w-2xl mx-auto leading-relaxed">{firm?.registeredAddress || "Address details not available"}</p>
        <div className="flex justify-center flex-wrap gap-x-8 gap-y-1 mt-3 text-[11px] font-black uppercase tracking-widest text-slate-900">
          <span>GSTIN: {firm?.gstin || "---"}</span>
          {firm?.email && <span className="flex items-center gap-1.5"><Mail className="w-3 h-3" /> {firm.email}</span>}
          {firm?.website && <span className="flex items-center gap-1.5"><Globe className="w-3 h-3" /> {firm.website}</span>}
        </div>
      </div>

      <div className="flex justify-end gap-8 text-[10px] font-black uppercase tracking-widest pr-2">
        <div className="flex gap-2"><span className="text-slate-400">Slip Number:</span><span className="text-slate-900">{record.slipNo}</span></div>
        <div className="flex gap-2"><span className="text-slate-400">Slip Date:</span><span className="text-slate-900">{record.slipDate ? format(parseISO(record.slipDate), 'dd-MMM-yyyy') : "---"}</span></div>
      </div>

      <div className="grid grid-cols-2 border-2 border-slate-900 divide-x-2 divide-y-2 divide-slate-900 overflow-hidden">
        <SlipDetailCell label="Employee ID" value={record.employeeId} />
        <SlipDetailCell label="Employee Name" value={record.employeeName} />
        <SlipDetailCell label="Department" value={employee?.department} />
        <SlipDetailCell label="Designation" value={employee?.designation} />
        <SlipDetailCell label="Aadhaar Number" value={employee?.aadhaar} />
        <SlipDetailCell label="Monthly CTC" value={employee?.salary?.monthlyCTC ? formatCurrency(employee.salary.monthlyCTC) : "---"} />
        <SlipDetailCell label="Attendance" value={`${record.totalEarningDays} Days`} />
        <SlipDetailCell label="Leaves/Absent" value={`${record.absent} Days`} />
        {!employee || employee.isGovComplianceEnabled && (
          <><SlipDetailCell label="PF Number" value={employee?.pfNumber || "---"} /><SlipDetailCell label="ESIC Number" value={employee?.esicNumber || "---"} /></>
        )}
      </div>

      <div className="border-2 border-slate-900 overflow-hidden">
        <div className="grid grid-cols-2 bg-slate-900 text-white font-black text-xs uppercase tracking-widest text-center py-2 divide-x-2 divide-white"><div>Monthly Earnings</div><div>Deductions</div></div>
        <div className="grid grid-cols-2 divide-x-2 border-slate-900">
          <div className="divide-y divide-slate-200">{earnings.map((e, i) => (<div key={i} className="flex justify-between px-4 py-2 text-xs"><span className="font-bold text-slate-600">{e.label}</span><span className="font-bold">{formatCurrency(e.value)}</span></div>))}</div>
          <div className="divide-y divide-slate-200">{deductions.map((d, i) => (<div key={i} className="flex justify-between px-4 py-2 text-xs"><span className="font-bold text-slate-600">{d.label}</span><span className="font-bold">{formatCurrency(d.value)}</span></div>))}</div>
        </div>
        <div className="grid grid-cols-2 border-t-2 border-slate-900 bg-slate-50 font-black text-xs uppercase tracking-widest py-3 divide-x-2 divide-slate-900"><div className="flex justify-between px-4"><span>Gross Earnings</span><span>{formatCurrency(totalEarnings)}</span></div><div className="flex justify-between px-4"><span>Total Deductions</span><span>{formatCurrency(totalDeductions)}</span></div></div>
      </div>

      <div className="border-2 border-slate-900 p-6 bg-white text-slate-900 flex justify-between items-center rounded-sm shadow-sm">
        <div className="space-y-1"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">Net Salary Payable</p><p className="text-xs font-bold italic text-slate-500">({numberToIndianWords(record.netPayable)})</p></div>
        <div className="text-4xl font-black text-slate-900">{formatCurrency(record.netPayable)}</div>
      </div>

      <div className="flex justify-between items-end pt-32 px-10"><div className="text-center space-y-4"><div className="w-64 border-b-2 border-slate-900" /><p className="text-[10px] font-black uppercase tracking-widest">Employee Signature</p></div><div className="text-center space-y-4"><div className="w-64 border-b-2 border-slate-900 flex items-center justify-center pb-2"><BadgeCheck className="w-12 h-12 text-emerald-600 opacity-20" /></div><p className="text-[10px] font-black uppercase tracking-widest">Authorized Signatory</p></div></div>
      <div className="text-center pt-10"><p className="text-[8px] font-bold text-slate-300 uppercase tracking-[0.5em]">This is a computer generated document and does not require a physical signature.</p></div>
    </div>
  );
}

function SlipDetailCell({ label, value }: { label: string, value: any }) {
  return (<div className="flex items-start px-4 py-3 bg-white gap-2 font-calibri"><span className="text-[10px] font-black uppercase text-slate-400 w-32 shrink-0 tracking-widest leading-normal">{label}:</span><span className="text-sm font-bold text-slate-900 uppercase leading-normal break-words flex-1">{value || "---"}</span></div>);
}

function StatBox({ label, value, color }: { label: string, value: string | number, color: string }) {
  return (
    <div className="bg-slate-50 p-6 rounded-2xl text-center border border-slate-100 shadow-sm">
      <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">{label}</p>
      <div className={cn("text-xl font-black", color)}>{value}</div>
    </div>
  );
}
