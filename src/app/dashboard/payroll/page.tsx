
"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  CalendarClock, 
  CreditCard, 
  PlusCircle, 
  History, 
  Wallet,
  CheckCircle2,
  CalendarDays,
  ArrowDownCircle,
  Building2,
  Printer,
  Info,
  Banknote,
  ShieldCheck,
  FileText,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  User,
  AlertTriangle,
  FileCheck,
  X
} from "lucide-react";
import { formatCurrency, numberToIndianWords, cn } from "@/lib/utils";
import { useData } from "@/context/data-context";
import { useToast } from "@/hooks/use-toast";
import { Employee, PayrollRecord, SalaryPaymentRecord, StatutoryPaymentRecord } from "@/lib/types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { parseISO, isSameMonth } from "date-fns";

const generatePayrollMonths = () => {
  const options = [];
  const date = new Date();
  for (let i = 0; i < 6; i++) {
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
  const { employees, attendanceRecords, payrollRecords, vouchers, firms, plants, updateRecord, holidays } = useData();
  const { toast } = useToast();

  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState("generate");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedFirmId, setSelectedFirmId] = useState("all");
  const [isProcessing, setIsProcessing] = useState(false);

  // Pagination for Advance Salary tab
  const [advancePage, setAdvancePage] = useState(1);
  const rowsPerPageAdvance = 15;

  // Dialog States
  const [paySalaryRec, setPaySalaryRec] = useState<PayrollRecord | null>(null);
  const [adjustLeaveEmp, setAdjustLeaveEmp] = useState<Employee | null>(null);
  
  // Adjustment Calculation State
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

  const [isSubAdjustmentOpen, setIsSubAdjustmentOpen] = useState(false);
  const [subAdjValue, setSubAdjValue] = useState(0);

  // Form States for Payments
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentType, setPaymentType] = useState<'BANKING' | 'CASH' | 'CHEQUE'>('BANKING');
  const [paymentRef, setPaymentRef] = useState("");

  const [adjustedEmployees, setAdjustedEmployees] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setIsMounted(true);
    setSelectedMonth(PAYROLL_MONTHS[1]);
    setPaymentDate(new Date().toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    setAdjustedEmployees({});
  }, [selectedMonth]);

  const filteredEmployees = useMemo(() => {
    return (employees || []).filter(emp => {
      const search = searchTerm.toLowerCase();
      const matchesSearch = (
        emp.name.toLowerCase().includes(search) ||
        emp.employeeId.toLowerCase().includes(search) ||
        emp.aadhaar.includes(search)
      );
      const matchesFirm = selectedFirmId === "all" || emp.firmId === selectedFirmId;
      return matchesSearch && matchesFirm;
    });
  }, [employees, searchTerm, selectedFirmId]);

  const finalizedSalaries = useMemo(() => {
    return payrollRecords.filter(p => {
      const emp = employees.find(e => e.employeeId === p.employeeId);
      const search = searchTerm.toLowerCase();
      const matchesSearch = p.employeeName.toLowerCase().includes(search) || p.employeeId.toLowerCase().includes(search) || (p.slipNo || "").toLowerCase().includes(search);
      const matchesFirm = selectedFirmId === "all" || emp?.firmId === selectedFirmId;
      return matchesSearch && matchesFirm;
    }).reverse();
  }, [payrollRecords, searchTerm, selectedFirmId, employees]);

  const paidVouchers = useMemo(() => {
    return vouchers.filter(v => v.status === 'PAID').reverse();
  }, [vouchers]);

  const paginatedPaidVouchers = useMemo(() => {
    const start = (advancePage - 1) * rowsPerPageAdvance;
    return paidVouchers.slice(start, start + rowsPerPageAdvance);
  }, [paidVouchers, advancePage]);

  const totalAdvancePages = Math.ceil(paidVouchers.length / rowsPerPageAdvance);

  const isSalaryGenerated = (empId: string) => {
    return payrollRecords.some(p => p.employeeId === empId && p.month === selectedMonth);
  };

  // Logic to handle opening Adjust Leave dialog
  const openAdjustmentDialog = (emp: Employee) => {
    const relevantAttendance = attendanceRecords.filter(r => r.employeeId === emp.employeeId);
    
    // Simplistic Calculation for Demo
    // In production, this would use exact date checking against the holiday calendar
    const presentOnWorking = relevantAttendance.filter(r => r.status === 'PRESENT').length;
    const holidayPres = relevantAttendance.filter(r => r.status === 'PRESENT' && r.inPlant === 'Holiday Work').length || 0; 
    
    const workingDaysCount = 26;
    const holidayCount = 4;
    
    const initialPresent = Math.max(0, presentOnWorking - holidayPres);
    const initialAbsent = Math.max(0, workingDaysCount - initialPresent);

    let state = {
      present: initialPresent,
      absent: initialAbsent,
      holidayWork: holidayPres,
      holidayBanked: 0,
      holidayPaid: 0,
      balanceUsed: 0,
      remainingBalance: emp.advanceLeaveBalance || 0,
      earningDays: initialPresent,
      monthWorkingDays: workingDaysCount,
      monthHolidays: holidayCount
    };

    // Auto Logic: If Present < Working Days AND Holiday Work exists -> Move to Present
    if (state.present < state.monthWorkingDays && state.holidayWork > 0) {
      const needed = state.monthWorkingDays - state.present;
      const canMove = Math.min(needed, state.holidayWork);
      state.present += canMove;
      state.holidayWork -= canMove;
      state.absent -= canMove;
      state.earningDays = state.present;
    }

    setAdjustmentState(state);
    setAdjustLeaveEmp(emp);
  };

  const handlePayHoliday = () => {
    setAdjustmentState(prev => ({
      ...prev,
      holidayPaid: prev.holidayPaid + prev.holidayWork,
      earningDays: prev.earningDays + prev.holidayWork,
      holidayWork: 0
    }));
  };

  const handleBankHoliday = () => {
    setAdjustmentState(prev => ({
      ...prev,
      holidayBanked: prev.holidayBanked + prev.holidayWork,
      remainingBalance: prev.remainingBalance + prev.holidayWork,
      holidayWork: 0
    }));
  };

  const handleSaveSubAdjustment = () => {
    if (subAdjValue > adjustmentState.remainingBalance) {
      toast({ variant: "destructive", title: "Limit Exceeded", description: "Insufficient balance." });
      return;
    }
    
    setAdjustmentState(prev => ({
      ...prev,
      present: prev.present + subAdjValue,
      absent: prev.absent - subAdjValue,
      balanceUsed: prev.balanceUsed + subAdjValue,
      remainingBalance: prev.remainingBalance - subAdjValue,
      earningDays: prev.present + subAdjValue
    }));
    setIsSubAdjustmentOpen(false);
    setSubAdjValue(0);
  };

  const handlePostAdjustment = () => {
    if (!adjustLeaveEmp) return;
    setIsProcessing(true);
    try {
      // Sync back to Employee Advance Leave balance
      updateRecord('employees', adjustLeaveEmp.id, { 
        advanceLeaveBalance: adjustmentState.remainingBalance 
      });
      
      setAdjustedEmployees(prev => ({ ...prev, [adjustLeaveEmp.id]: true }));
      toast({ title: "Finalized", description: `Earning Days set to ${adjustmentState.earningDays} for ${adjustLeaveEmp.name}` });
      setAdjustLeaveEmp(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePostPayment = () => {
    if (!paySalaryRec || isProcessing) return;
    if (paymentAmount <= 0) {
      toast({ variant: "destructive", title: "Error", description: "Payment amount must be greater than 0." });
      return;
    }

    setIsProcessing(true);
    try {
      const historyEntry: SalaryPaymentRecord = {
        amount: paymentAmount,
        date: paymentDate,
        type: paymentType,
        reference: paymentRef
      };

      const newPaid = paySalaryRec.salaryPaidAmount + paymentAmount;
      updateRecord('payroll', paySalaryRec.id, {
        salaryPaidAmount: newPaid,
        salaryPaidDate: paymentDate,
        salaryHistory: [...(paySalaryRec.salaryHistory || []), historyEntry],
        status: newPaid >= paySalaryRec.netPayable ? 'PAID' : 'FINALIZED'
      });

      toast({ title: "Payment Recorded", description: `Successfully paid ${formatCurrency(paymentAmount)}` });
      setPaySalaryRec(null);
      setPaymentRef("");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrint = (rec: PayrollRecord) => {
    toast({ title: "Opening Print...", description: "Formatting salary slip for export." });
  };

  if (!isMounted) return null;

  return (
    <div className="space-y-8 pb-12 print:hidden">
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
                  <Input 
                    placeholder="Search by Employee Name / ID / Aadhaar..." 
                    className="pl-10 h-10 bg-white"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
                  <Select value={selectedFirmId} onValueChange={setSelectedFirmId}>
                    <SelectTrigger className="w-full sm:w-48 bg-white h-10">
                      <SelectValue placeholder="Filter by Firm" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Firms</SelectItem>
                      {firms.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="w-full sm:w-40 bg-white h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYROLL_MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="w-full">
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
                    {filteredEmployees.map((emp) => {
                      const isAdjusted = adjustedEmployees[emp.id];
                      const generated = isSalaryGenerated(emp.employeeId);
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
                              <span className="font-bold">{emp.name}</span>
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
                          <TableCell>
                            <Badge variant="outline" className="font-bold bg-white">{selectedMonth}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-bold text-emerald-600">
                            {formatCurrency(emp.salary.monthlyCTC)}
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            <div className="flex justify-end gap-2">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                disabled={generated}
                                className={cn(
                                  "text-xs font-bold gap-1 border-primary/20",
                                  isAdjusted ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "hover:bg-primary/5",
                                  generated && "opacity-50 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200"
                                )}
                                onClick={() => !generated && openAdjustmentDialog(emp)}
                              >
                                <CalendarClock className="w-3 h-3" /> 
                                {generated ? "Locked" : isAdjusted ? "Reviewed" : "Adjust Leave"}
                              </Button>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="inline-block">
                                      <Button 
                                        size="sm" 
                                        className={cn(
                                          "text-xs font-bold gap-1",
                                          isAdjusted && !generated ? "bg-primary text-white" : "bg-slate-200 text-slate-400 cursor-not-allowed"
                                        )}
                                        onClick={() => {
                                          if (isAdjusted && !generated) {
                                            router.push(`/dashboard/payroll/generate/${emp.id}?month=${selectedMonth}`);
                                          }
                                        }}
                                        disabled={!isAdjusted || generated}
                                      >
                                        {generated ? <CheckCircle2 className="w-3 h-3" /> : <Calculator className="w-3 h-3" />}
                                        {generated ? "Generated" : "Generate Salary"}
                                      </Button>
                                    </div>
                                  </TooltipTrigger>
                                  {!isAdjusted && !generated && (
                                    <TooltipContent>
                                      <p className="text-xs">Review leave before generating salary</p>
                                    </TooltipContent>
                                  )}
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payment" className="mt-8 space-y-6">
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50 border-b p-6">
              <div className="flex flex-col lg:flex-row items-center gap-4">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search by Slip No, Name or ID..." 
                    className="pl-10 h-10 bg-white"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="w-full">
                <Table className="min-w-[1200px]">
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="font-bold">Firm / Unit</TableHead>
                      <TableHead className="font-bold">Slip No / Date</TableHead>
                      <TableHead className="font-bold">Employee Name / ID</TableHead>
                      <TableHead className="font-bold">Month</TableHead>
                      <TableHead className="font-bold text-right">Net Payable</TableHead>
                      <TableHead className="font-bold text-right">Salary Paid</TableHead>
                      <TableHead className="text-right font-bold pr-6">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {finalizedSalaries.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-20 text-muted-foreground">No finalized salaries found.</TableCell></TableRow>
                    ) : (
                      finalizedSalaries.map((p) => (
                        <TableRow key={p.id} className="hover:bg-slate-50/50">
                          <TableCell>
                            {firms.find(f => f.id === employees.find(e => e.employeeId === p.employeeId)?.firmId)?.name}
                          </TableCell>
                          <TableCell><span className="font-mono font-bold text-primary">{p.slipNo}</span></TableCell>
                          <TableCell>{p.employeeName} ({p.employeeId})</TableCell>
                          <TableCell className="text-center">{p.month}</TableCell>
                          <TableCell className="text-right font-bold">{formatCurrency(p.netPayable)}</TableCell>
                          <TableCell className="text-right font-bold">{formatCurrency(p.salaryPaidAmount)}</TableCell>
                          <TableCell className="text-right pr-6">
                            <div className="flex justify-end gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-primary" 
                                onClick={() => { setPaySalaryRec(p); setPaymentAmount(p.netPayable - p.salaryPaidAmount); }}
                                disabled={p.salaryPaidAmount >= p.netPayable}
                              >
                                <CreditCard className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500" onClick={() => handlePrint(p)}>
                                <Printer className="w-4 h-4" />
                              </Button>
                            </div>
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

        <TabsContent value="advance">
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-100 p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-50 rounded-lg"><Wallet className="w-5 h-5 text-emerald-600" /></div>
                <div>
                  <CardTitle className="text-lg font-bold">Paid Advance Salary Ledger</CardTitle>
                  <CardDescription>Track cash advances, salary deductions, and recovery status.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="w-full">
                <Table className="min-w-[1200px]">
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="font-bold">Voucher No</TableHead>
                      <TableHead className="font-bold">Employee Name</TableHead>
                      <TableHead className="text-right font-bold">Adv. Amount</TableHead>
                      <TableHead className="text-right font-bold">Paid Amount</TableHead>
                      <TableHead className="text-right font-bold">Remaining</TableHead>
                      <TableHead className="text-center font-bold">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedPaidVouchers.map(v => {
                      const emp = employees.find(e => e.id === v.employeeId);
                      const recoveries = payrollRecords.filter(p => p.employeeId === (emp?.employeeId || v.employeeId));
                      const totalRecovered = recoveries.reduce((sum, p) => sum + (p.advanceRecovery || 0), 0);
                      const remaining = v.amount - totalRecovered;
                      return (
                        <TableRow key={v.id}>
                          <TableCell className="font-mono font-bold text-primary">{v.voucherNo}</TableCell>
                          <TableCell className="font-bold">{emp?.name || v.employeeId}</TableCell>
                          <TableCell className="text-right">{formatCurrency(v.amount)}</TableCell>
                          <TableCell className="text-right text-emerald-600">{formatCurrency(v.amount)}</TableCell>
                          <TableCell className="text-right font-black">{formatCurrency(Math.max(0, remaining))}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={remaining <= 0 ? "default" : "outline"} className={cn(remaining <= 0 ? "bg-emerald-600" : "text-amber-600 border-amber-200 bg-amber-50")}>
                              {remaining <= 0 ? "COMPLETE" : "PENDING"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leave">
          <Card className="border-none shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <ScrollArea className="w-full">
                <Table className="min-w-[1000px]">
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="font-bold">Employee Name</TableHead>
                      <TableHead className="font-bold">Employee ID</TableHead>
                      <TableHead className="font-bold text-center">Available Balance</TableHead>
                      <TableHead className="text-right font-bold pr-6">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map(emp => (
                      <TableRow key={emp.id}>
                        <TableCell className="font-bold">{emp.name}</TableCell>
                        <TableCell className="font-mono text-xs">{emp.employeeId}</TableCell>
                        <TableCell className="text-center font-black text-primary">{emp.advanceLeaveBalance || 0} Days</TableCell>
                        <TableCell className="text-right pr-6">
                          <Button variant="ghost" size="sm" className="font-bold gap-2">
                            <History className="w-4 h-4" /> View History
                          </Button>
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

      {/* Main Adjust Leave Dialog */}
      <Dialog open={!!adjustLeaveEmp} onOpenChange={(o) => !o && setAdjustLeaveEmp(null)}>
        <DialogContent className="sm:max-w-4xl p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
          {adjustLeaveEmp && (
            <>
              <DialogHeader className="p-8 pb-6 bg-white border-b">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <DialogTitle className="text-2xl font-black flex items-center gap-3 text-slate-900">
                      <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                        <CalendarClock className="w-6 h-6 text-primary" />
                      </div>
                      Adjust Attendance: {adjustLeaveEmp.name}
                    </DialogTitle>
                    <div className="flex items-center gap-3 text-sm text-slate-500 font-bold ml-12">
                      <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] font-mono">{adjustLeaveEmp.employeeId}</span>
                      <span>•</span>
                      <span>{adjustLeaveEmp.department} / {adjustLeaveEmp.designation}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Available Advance Leave</p>
                    <Badge className="bg-emerald-500 h-8 px-4 font-black text-sm rounded-lg shadow-lg shadow-emerald-100">
                      {adjustmentState.remainingBalance} Days
                    </Badge>
                  </div>
                </div>
              </DialogHeader>

              <div className="bg-slate-50/50 p-8 space-y-8">
                {/* Meta Summary */}
                <div className="grid grid-cols-3 gap-6">
                  <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Salary Month</p>
                    <p className="text-lg font-black text-primary">{selectedMonth}</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Working Days</p>
                    <p className="text-lg font-black text-slate-700">{adjustmentState.monthWorkingDays}</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Holidays</p>
                    <p className="text-lg font-black text-slate-700">{adjustmentState.monthHolidays}</p>
                  </div>
                </div>

                {/* Adjust Table */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="font-black text-[10px] uppercase tracking-widest">Category</TableHead>
                        <TableHead className="font-black text-[10px] uppercase tracking-widest text-center">Current Status</TableHead>
                        <TableHead className="font-black text-[10px] uppercase tracking-widest text-right pr-8">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-bold py-6">Present on Working Days</TableCell>
                        <TableCell className="text-center">
                          <span className="text-xl font-black text-emerald-600">{adjustmentState.present}</span>
                          <span className="text-xs text-slate-400 font-bold ml-1">/ {adjustmentState.monthWorkingDays}</span>
                        </TableCell>
                        <TableCell className="text-right pr-8">
                          {adjustmentState.present < adjustmentState.monthWorkingDays && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="font-black text-[10px] uppercase tracking-widest h-8 px-4 border-primary/30 text-primary hover:bg-primary/5"
                              onClick={() => setIsSubAdjustmentOpen(true)}
                            >
                              Adjust from Balance
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-bold py-6">Total Absent</TableCell>
                        <TableCell className="text-center font-black text-xl text-rose-500">{adjustmentState.absent}</TableCell>
                        <TableCell className="text-right pr-8">--</TableCell>
                      </TableRow>
                      <TableRow className="bg-blue-50/30">
                        <TableCell className="font-bold py-6 flex items-center gap-2">
                          Present on Holidays
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger><Info className="w-3.5 h-3.5 text-slate-400" /></TooltipTrigger>
                              <TooltipContent>Attendance recorded on Sundays or Official Holidays</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell className="text-center font-black text-xl text-blue-600">{adjustmentState.holidayWork}</TableCell>
                        <TableCell className="text-right pr-8">
                          {adjustmentState.holidayWork > 0 && (
                            <div className="flex justify-end gap-2">
                              <Button 
                                size="sm" 
                                className="bg-emerald-600 hover:bg-emerald-700 font-bold text-[10px] uppercase tracking-tighter"
                                onClick={handlePayHoliday}
                              >
                                Pay Holiday Work
                              </Button>
                              <Button 
                                size="sm" 
                                variant="secondary" 
                                className="font-bold text-[10px] uppercase tracking-tighter"
                                onClick={handleBankHoliday}
                              >
                                Add in Advance Leave
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

              <DialogFooter className="p-8 bg-slate-900 border-t shrink-0 flex items-center justify-between">
                <div className="text-white text-left">
                  <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Calculated Earning Days</p>
                  <p className="text-3xl font-black text-white">{adjustmentState.earningDays} <span className="text-xs font-bold text-slate-400">Total</span></p>
                </div>
                <div className="flex gap-4">
                  <Button 
                    variant="ghost" 
                    className="text-slate-400 hover:text-white hover:bg-slate-800 font-bold h-12 rounded-xl px-8"
                    onClick={() => setAdjustLeaveEmp(null)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    className="bg-primary hover:bg-primary/90 font-black h-12 rounded-xl px-12 shadow-xl shadow-primary/20"
                    onClick={handlePostAdjustment}
                    disabled={isProcessing}
                  >
                    {isProcessing ? "Saving..." : "Post & Finalize"}
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Sub-Adjustment Balance Picker */}
      <Dialog open={isSubAdjustmentOpen} onOpenChange={setIsSubAdjustmentOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Use Banked Leave</DialogTitle>
            <DialogDescription>
              Adjust missing days from {adjustLeaveEmp?.name}'s balance.
            </DialogDescription>
          </DialogHeader>
          <div className="py-8 space-y-6">
            <div className="bg-slate-50 p-6 rounded-2xl border border-dashed border-slate-200 text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Available Balance</p>
              <p className="text-4xl font-black text-emerald-600">{adjustmentState.remainingBalance} Days</p>
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-xs">Days to Adjust</Label>
              <Input 
                type="number" 
                className="h-12 bg-slate-50 border-slate-200 font-bold text-lg" 
                value={subAdjValue} 
                max={Math.min(adjustmentState.absent, adjustmentState.remainingBalance)}
                onChange={(e) => setSubAdjValue(Math.min(parseInt(e.target.value) || 0, adjustmentState.remainingBalance))}
              />
              <p className="text-[10px] text-muted-foreground italic">Cannot exceed absent days ({adjustmentState.absent}) or balance.</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" className="rounded-xl font-bold" onClick={() => setIsSubAdjustmentOpen(false)}>Cancel</Button>
            <Button className="bg-primary rounded-xl font-black px-8" onClick={handleSaveSubAdjustment}>Confirm Adjustment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pay Salary Dialog */}
      <Dialog open={!!paySalaryRec} onOpenChange={(o) => !o && setPaySalaryRec(null)}>
        <DialogContent className="sm:max-w-2xl">
          {paySalaryRec && (
            <>
              <DialogHeader>
                <DialogTitle>Pay Salary</DialogTitle>
                <DialogDescription>{paySalaryRec.employeeName} • {paySalaryRec.month}</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-6 py-4">
                <div className="space-y-2">
                  <Label>Salary Paid Amount</Label>
                  <Input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                  <Label>Paid Date</Label>
                  <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Payment Type</Label>
                  <Select value={paymentType} onValueChange={(v: any) => setPaymentType(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BANKING">Banking</SelectItem>
                      <SelectItem value="CASH">Cash</SelectItem>
                      <SelectItem value="CHEQUE">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Reference Number</Label>
                  <Input value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPaySalaryRec(null)}>Cancel</Button>
                <Button className="bg-primary font-bold" onClick={handlePostPayment}>Record Payment</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
