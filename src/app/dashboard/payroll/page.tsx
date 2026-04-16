
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
  Info
} from "lucide-react";
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
    
    const presentOnWorking = relevantAttendance.filter(r => r.status === 'PRESENT' && r.inPlant !== 'Holiday Work').length;
    const holidayPres = relevantAttendance.filter(r => r.inPlant === 'Holiday Work' || r.status === 'HOLIDAY').length; 
    
    const workingDaysCount = 26;
    let initialPresent = presentOnWorking;
    let initialHolidayWork = holidayPres;
    let initialAbsent = Math.max(0, workingDaysCount - initialPresent);

    // Auto Adjustment logic per requirements
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
    if (!adjustLeaveEmp || isProcessing) return;
    setIsProcessing(true);
    try {
      updateRecord('employees', adjustLeaveEmp.id, { 
        advanceLeaveBalance: adjustmentState.remainingBalance 
      });
      
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
                                    <Button variant="outline" size="sm" className={cn("text-xs font-bold gap-1", isAdjusted ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "hover:bg-primary/5")} onClick={(e) => { e.stopPropagation(); openAdjustmentDialog(emp); }} disabled={isProcessing}><CalendarClock className="w-3 h-3" /> {isAdjusted ? "Reviewed" : "Adjust Leave"}</Button>
                                    <Button size="sm" className={cn("text-xs font-bold gap-1", isAdjusted ? "bg-primary text-white" : "bg-slate-200 text-slate-400 cursor-not-allowed")} onClick={(e) => { e.stopPropagation(); if(isAdjusted) router.push(`/dashboard/payroll/generate/${emp.id}?month=${selectedMonth}&earningDays=${adjData.earningDays}`); }} disabled={!isAdjusted || isProcessing}><Calculator className="w-3 h-3" /> Generate Salary</Button>
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
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="w-full" tabIndex={0}>
                  <Table className="min-w-[1300px]">
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="font-bold">Slip Details</TableHead>
                        <TableHead className="font-bold">Employee Name / ID</TableHead>
                        <TableHead className="font-bold">Month</TableHead>
                        <TableHead className="font-bold text-right">Net Payable</TableHead>
                        <TableHead className="font-bold text-right">Salary Paid</TableHead>
                        <TableHead className="font-bold text-center">Paid Date</TableHead>
                        <TableHead className="text-right font-bold pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {finalizedSalaries.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-20 text-muted-foreground">No finalized salaries found.</TableCell></TableRow>
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
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" disabled={!hasUnpaid || isProcessing}><CreditCard className="w-4 h-4 text-primary" /></Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="w-48">
                                        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setPaySalaryRec(p); setPaymentAmount(remainingSalary); }} disabled={remainingSalary <= 0}>Pay Salary</DropdownMenuItem>
                                        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setPayPFRec(p); setPfPaidEmp(p.pfAmountEmployee - (p.pfPaidAmountEmployee || 0)); setPfPaidEx(p.pfAmountEmployer - (p.pfPaidAmountEmployer || 0)); }} disabled={remainingPF <= 0}>Pay PF</DropdownMenuItem>
                                        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setPayESICRec(p); setEsicPaidEmp(p.esicAmountEmployee - (p.esicPaidAmountEmployee || 0)); setEsicPaidEx(p.esicAmountEmployer - (p.esicPaidAmountEmployer || 0)); }} disabled={remainingESIC <= 0}>Pay ESIC</DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  ) : (
                                    <Button variant="ghost" size="icon" disabled={remainingSalary <= 0 || isProcessing} onClick={(e) => { e.stopPropagation(); setPaySalaryRec(p); setPaymentAmount(remainingSalary); }}><CreditCard className="w-4 h-4 text-primary" /></Button>
                                  )}
                                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDownloadAndPrint(p); }} disabled={isProcessing}><Download className="w-4 h-4 text-slate-500" /></Button>
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
                              <Button variant="outline" size="sm" className="font-bold h-8" onClick={(e) => { e.stopPropagation(); setViewAdvanceEmployee(item); }}>View</Button>
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
                            <Button variant="ghost" size="sm" className="font-bold gap-2"><History className="w-4 h-4" /> View History</Button>
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
      </div>

      {/* Adjust Leave Dialog */}
      <Dialog open={!!adjustLeaveEmp} onOpenChange={(o) => { if (!o) setAdjustLeaveEmp(null); }}>
        <DialogContent className="sm:max-w-4xl p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
          {adjustLeaveEmp && (
            <div className="flex flex-col max-h-[90vh]">
              {/* Header Box - Reduced height by 20% */}
              <div className="p-6 bg-white border-b shrink-0">
                <div className="flex justify-between items-start">
                  <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                      <User className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-slate-900 leading-tight">{adjustLeaveEmp.name}</h2>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{adjustLeaveEmp.employeeId} • {adjustLeaveEmp.department}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Remaining Advance Leave</p>
                    <Badge className="text-lg px-4 py-1 bg-emerald-500 hover:bg-emerald-600 rounded-lg">{adjustmentState.remainingBalance} Days</Badge>
                  </div>
                </div>
              </div>

              {/* Salary Info Boxes - Reduced height by 40% (py-5) */}
              <div className="grid grid-cols-3 gap-0 border-b bg-slate-50/50 shrink-0">
                <div className="py-5 px-8 border-r border-slate-200/60 text-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Salary Month</p>
                  <p className="text-base font-black text-slate-700">{selectedMonth}</p>
                </div>
                <div className="py-5 px-8 border-r border-slate-200/60 text-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Working Days</p>
                  <p className="text-base font-black text-slate-700">{adjustmentState.monthWorkingDays} Days</p>
                </div>
                <div className="py-5 px-8 text-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Holidays</p>
                  <p className="text-base font-black text-slate-700">{adjustmentState.monthHolidays} Days</p>
                </div>
              </div>

              <div className="flex-1 p-8 overflow-y-auto bg-slate-50/30">
                <div className="space-y-8">
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="font-black text-[10px] uppercase tracking-widest px-6">Metric</TableHead>
                          <TableHead className="font-black text-[10px] uppercase tracking-widest text-center">Days</TableHead>
                          <TableHead className="font-black text-[10px] uppercase tracking-widest text-right pr-6">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="px-6 py-4 font-bold text-slate-700">Present on Working Days</TableCell>
                          <TableCell className="text-center font-black text-emerald-600 text-lg">{adjustmentState.present}</TableCell>
                          <TableCell className="text-right pr-6">
                            {adjustmentState.present < adjustmentState.monthWorkingDays && (
                              <Button variant="outline" size="sm" className="font-bold text-xs gap-2 h-9 px-4 rounded-lg" onClick={handleOpenSubAdjustment}>
                                <PlusCircle className="w-4 h-4 text-primary" /> Adjust Leave
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="px-6 py-4 font-bold text-slate-700">Total Absent</TableCell>
                          <TableCell className="text-center font-black text-rose-500 text-lg">{adjustmentState.absent}</TableCell>
                          <TableCell className="text-right pr-6">---</TableCell>
                        </TableRow>
                        {adjustmentState.holidayWork > 0 && (
                          <TableRow className="bg-amber-50/30">
                            <TableCell className="px-6 py-4 font-bold text-amber-700">Present on Holidays (Holiday Work)</TableCell>
                            <TableCell className="text-center font-black text-amber-600 text-lg">{adjustmentState.holidayWork}</TableCell>
                            <TableCell className="text-right pr-6">
                              <div className="flex justify-end gap-2">
                                <Button variant="secondary" size="sm" className="font-bold text-[10px] uppercase bg-white border border-slate-200 h-8 px-3" onClick={handleBankHolidayWork}>Add in Adv. Leave</Button>
                                <Button variant="secondary" size="sm" className="font-bold text-[10px] uppercase bg-amber-500 hover:bg-amber-600 text-white h-8 px-3" onClick={handlePayHolidayWork}>Pay Holiday Work</Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="p-6 bg-slate-900 rounded-2xl flex items-center justify-between shadow-xl">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                        <Calculator className="w-6 h-6 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-emerald-400/60 uppercase tracking-widest leading-none mb-1.5">Total Earning Days</p>
                        <h3 className="text-3xl font-black text-white leading-none">{adjustmentState.earningDays}</h3>
                      </div>
                    </div>
                    <div className="text-right text-white/40 text-[10px] font-bold uppercase tracking-widest max-w-[200px]">
                      Attendance recalculated based on working days and applied adjustments.
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Box - Reduced height by 25% (p-6) */}
              <div className="p-6 bg-white border-t flex justify-end gap-4 shrink-0">
                <Button variant="ghost" className="h-12 px-10 font-bold text-rose-500 hover:bg-rose-50 rounded-xl" onClick={() => setAdjustLeaveEmp(null)}>Cancel</Button>
                <Button className="h-12 px-16 bg-primary hover:bg-primary/90 font-black rounded-xl shadow-lg shadow-primary/20 text-lg" onClick={handlePostAdjustment} disabled={isProcessing}>
                  {isProcessing ? "Finalizing..." : "Post Adjustment"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Sub Adjustment Dialog */}
      <Dialog open={isSubAdjustmentOpen} onOpenChange={setIsSubAdjustmentOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-primary" /> Adjust from Leave Balance
            </DialogTitle>
            <DialogDescription>Convert stored leave balance into paid attendance.</DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-6">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
              <span className="text-sm font-bold text-slate-600">Available Balance</span>
              <Badge className="bg-emerald-500 text-base py-1 px-3">{adjustmentState.remainingBalance} Days</Badge>
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-slate-700">Days to Adjust</Label>
              <Input 
                type="number" 
                value={subAdjustmentValue} 
                onChange={(e) => setSubAdjustmentValue(Math.max(0, parseFloat(e.target.value) || 0))}
                className="h-12 bg-white font-black text-lg focus:ring-primary"
              />
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">Max limit: {Math.min(adjustmentState.remainingBalance, adjustmentState.monthWorkingDays - adjustmentState.present)} days</p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 border-t pt-4">
            <Button variant="ghost" onClick={() => setIsSubAdjustmentOpen(false)} className="rounded-xl font-bold">Cancel</Button>
            <Button className="bg-primary rounded-xl font-bold px-8" onClick={handleSaveSubAdjustment}>Apply Adjustment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Salary Payment Dialog */}
      <Dialog open={!!paySalaryRec} onOpenChange={(o) => { if (!o) setPaySalaryRec(null); }}>
        <DialogContent className="sm:max-w-md">
          {paySalaryRec && (
            <>
              <DialogHeader>
                <DialogTitle>Disburse Salary</DialogTitle>
                <DialogDescription>Record final payout for {paySalaryRec.employeeName} ({paySalaryRec.month})</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Amount (INR)</Label>
                  <Input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)} className="h-12 font-bold text-lg text-emerald-600" />
                </div>
                <div className="space-y-2">
                  <Label>Payment Date</Label>
                  <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Mode</Label>
                  <Select value={paymentType} onValueChange={(v: any) => setPaymentType(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BANKING">Banking Transfer</SelectItem>
                      <SelectItem value="CASH">Cash Payment</SelectItem>
                      <SelectItem value="CHEQUE">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ref No (UTR / Trans ID)</Label>
                  <Input placeholder="Enter reference..." value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPaySalaryRec(null)}>Cancel</Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700 font-bold px-8" onClick={handlePostPayment} disabled={isProcessing}>Confirm Payment</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
