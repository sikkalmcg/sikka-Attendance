"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent, 
  CardDescription
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
  ShieldCheck
} from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import { useData } from "@/context/data-context";
import { useToast } from "@/hooks/use-toast";
import { Employee, PayrollRecord, SalaryPaymentRecord, StatutoryPaymentRecord } from "@/lib/types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

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
  const { employees, setEmployees, attendanceRecords, payrollRecords, setPayrollRecords, vouchers, firms, plants } = useData();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("generate");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(PAYROLL_MONTHS[1]);
  const [selectedFirmId, setSelectedFirmId] = useState("all");
  const [isProcessing, setIsProcessing] = useState(false);

  // Dialog States
  const [paySalaryRec, setPaySalaryRec] = useState<PayrollRecord | null>(null);
  const [payPFRec, setPayPFRec] = useState<PayrollRecord | null>(null);
  const [payESICRec, setPayESICRec] = useState<PayrollRecord | null>(null);
  const [printRec, setPrintRec] = useState<PayrollRecord | null>(null);

  // Form States for Payments
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentType, setPaymentType] = useState<'BANKING' | 'CASH' | 'CHEQUE'>('BANKING');
  const [paymentRef, setPaymentRef] = useState("");

  const [pfEmpAmt, setPfEmpAmt] = useState(0);
  const [pfExAmt, setPfExAmt] = useState(0);
  const [esicEmpAmt, setEsicEmpAmt] = useState(0);
  const [esicExAmt, setEsicExAmt] = useState(0);

  const [adjustedEmployees, setAdjustedEmployees] = useState<Record<string, boolean>>({});
  const [adjustLeaveEmp, setAdjustLeaveEmp] = useState<Employee | null>(null);
  const [viewLeaveHistoryEmp, setViewLeaveHistoryEmp] = useState<Employee | null>(null);
  const [advanceLeaveValue, setAdvanceLeaveValue] = useState(0);

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

  const isSalaryGenerated = (empId: string) => {
    return payrollRecords.some(p => p.employeeId === empId && p.month === selectedMonth);
  };

  const getAttendanceSummary = (empId: string) => {
    const records = attendanceRecords.filter(r => r.employeeId === empId || r.employeeId === "emp-mock");
    const presents = records.filter(r => r.status === 'PRESENT').length;
    const halfDays = records.filter(r => r.status === 'HALF_DAY').length;
    const holidays = records.filter(r => r.status === 'HOLIDAY').length;
    
    const effectiveAttendance = presents + (halfDays * 0.5);
    const totalDaysInMonth = 30;
    const absent = totalDaysInMonth - effectiveAttendance - holidays;

    return {
      attendance: effectiveAttendance,
      absent: Math.max(0, absent),
      holidayWork: holidays,
      totalDays: totalDaysInMonth
    };
  };

  const handleAdjustLeave = () => {
    if (!adjustLeaveEmp || isProcessing) return;
    if (advanceLeaveValue > (adjustLeaveEmp.advanceLeaveBalance || 0)) {
      toast({ variant: "destructive", title: "Invalid Amount", description: "Adjustment exceeds available balance." });
      return;
    }

    setIsProcessing(true);
    try {
      setEmployees(prev => prev.map(e => {
        if (e.id === adjustLeaveEmp.id) {
          return { ...e, advanceLeaveBalance: (e.advanceLeaveBalance || 0) - advanceLeaveValue };
        }
        return e;
      }));
      
      setAdjustedEmployees(prev => ({ ...prev, [adjustLeaveEmp.id]: true }));
      toast({ title: "Leave Adjusted", description: `${advanceLeaveValue} days added to earning days.` });
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

      setPayrollRecords(prev => prev.map(r => {
        if (r.id === paySalaryRec.id) {
          const newPaid = r.salaryPaidAmount + paymentAmount;
          return {
            ...r,
            salaryPaidAmount: newPaid,
            salaryPaidDate: paymentDate,
            salaryHistory: [...(r.salaryHistory || []), historyEntry],
            status: newPaid >= r.netPayable ? 'PAID' : 'FINALIZED'
          };
        }
        return r;
      }));

      toast({ title: "Payment Recorded", description: `Successfully paid ${formatCurrency(paymentAmount)}` });
      setPaySalaryRec(null);
      setPaymentRef("");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePostPF = () => {
    if (!payPFRec || isProcessing) return;
    setIsProcessing(true);
    try {
      const historyEntry: StatutoryPaymentRecord = {
        employeeAmt: pfEmpAmt,
        employerAmt: pfExAmt,
        date: paymentDate,
        reference: paymentRef
      };

      setPayrollRecords(prev => prev.map(r => {
        if (r.id === payPFRec.id) {
          return {
            ...r,
            pfPaidAmountEmployee: r.pfPaidAmountEmployee + pfEmpAmt,
            pfPaidAmountEmployer: r.pfPaidAmountEmployer + pfExAmt,
            pfPaidDate: paymentDate,
            pfHistory: [...(r.pfHistory || []), historyEntry]
          };
        }
        return r;
      }));

      toast({ title: "PF Payment Recorded" });
      setPayPFRec(null);
      setPaymentRef("");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePostESIC = () => {
    if (!payESICRec || isProcessing) return;
    setIsProcessing(true);
    try {
      const historyEntry: StatutoryPaymentRecord = {
        employeeAmt: esicEmpAmt,
        employerAmt: esicExAmt,
        date: paymentDate,
        reference: paymentRef
      };

      setPayrollRecords(prev => prev.map(r => {
        if (r.id === payESICRec.id) {
          return {
            ...r,
            esicPaidAmountEmployee: r.esicPaidAmountEmployee + esicEmpAmt,
            esicPaidAmountEmployer: r.esicPaidAmountEmployer + esicExAmt,
            esicPaidDate: paymentDate,
            esicHistory: [...(r.esicHistory || []), historyEntry]
          };
        }
        return r;
      }));

      toast({ title: "ESIC Payment Recorded" });
      setPayESICRec(null);
      setPaymentRef("");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrint = (rec: PayrollRecord) => {
    setPrintRec(rec);
    setTimeout(() => {
      window.print();
    }, 500);
  };

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
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-bold">Firm / Unit</TableHead>
                    <TableHead className="font-bold">Employee Name / ID</TableHead>
                    <TableHead className="font-bold">Aadhaar No</TableHead>
                    <TableHead className="font-bold">Dept / Designation</TableHead>
                    <TableHead className="font-bold">Month</TableHead>
                    <TableHead className="font-bold text-right">Monthly CTC</TableHead>
                    <TableHead className="text-right font-bold">Actions</TableHead>
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
                        <TableCell className="text-right">
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
                              onClick={() => !generated && setAdjustLeaveEmp(emp)}
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
                                        isAdjusted && !generated ? "bg-primary" : "bg-slate-200 text-slate-400 cursor-not-allowed"
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
                                {generated && (
                                  <TooltipContent>
                                    <p className="text-xs">Salary record already exists</p>
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
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500" />
                  <span className="text-xs font-medium text-muted-foreground">Unpaid</span>
                  <div className="w-3 h-3 rounded-full bg-amber-500 ml-2" />
                  <span className="text-xs font-medium text-muted-foreground">Partial</span>
                  <div className="w-3 h-3 rounded-full bg-emerald-500 ml-2" />
                  <span className="text-xs font-medium text-muted-foreground">Paid</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="w-full">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="font-bold whitespace-nowrap">Firm / Unit</TableHead>
                      <TableHead className="font-bold whitespace-nowrap">Slip No / Date</TableHead>
                      <TableHead className="font-bold whitespace-nowrap">Employee Name / ID</TableHead>
                      <TableHead className="font-bold whitespace-nowrap">Dept / Desig</TableHead>
                      <TableHead className="font-bold text-center">Month</TableHead>
                      <TableHead className="font-bold text-center">Days</TableHead>
                      <TableHead className="font-bold text-right">Net Payable</TableHead>
                      <TableHead className="font-bold text-right">Sal. Paid</TableHead>
                      <TableHead className="font-bold text-center">Sal. Paid Date</TableHead>
                      <TableHead className="font-bold text-right">PF (Emp+Ex)</TableHead>
                      <TableHead className="font-bold text-right">PF Paid</TableHead>
                      <TableHead className="font-bold text-right">ESIC (Emp+Ex)</TableHead>
                      <TableHead className="font-bold text-right">ESIC Paid</TableHead>
                      <TableHead className="text-right font-bold pr-6">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {finalizedSalaries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={14} className="text-center py-20 text-muted-foreground">No finalized salaries found.</TableCell>
                      </TableRow>
                    ) : (
                      finalizedSalaries.map((p) => {
                        const emp = employees.find(e => e.employeeId === p.employeeId);
                        const firm = firms.find(f => f.id === emp?.firmId);
                        const plant = plants.find(pl => pl.id === emp?.unitId);
                        
                        return (
                          <TableRow key={p.id} className="hover:bg-slate-50/50">
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="text-xs font-bold leading-tight">{firm?.name || "--"}</span>
                                <span className="text-[10px] text-muted-foreground">{plant?.name || "--"}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="text-xs font-mono font-bold text-primary">{p.slipNo}</span>
                                <span className="text-[10px] text-muted-foreground">{p.slipDate}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-bold text-sm">{p.employeeName}</span>
                                <span className="text-[10px] font-mono text-muted-foreground">{p.employeeId}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold">{emp?.department || "--"}</span>
                                <span className="text-[9px] text-muted-foreground">{emp?.designation || "--"}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center"><Badge variant="outline" className="text-[10px]">{p.month}</Badge></TableCell>
                            <TableCell className="text-center font-bold text-xs">{p.totalEarningDays}</TableCell>
                            <TableCell className="text-right font-bold text-slate-900">{formatCurrency(p.netPayable)}</TableCell>
                            <TableCell className="text-right">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className={cn(
                                      "font-black text-sm cursor-help",
                                      p.salaryPaidAmount >= p.netPayable ? "text-emerald-600" : p.salaryPaidAmount > 0 ? "text-amber-600" : "text-rose-600"
                                    )}>
                                      {formatCurrency(p.salaryPaidAmount)}
                                    </span>
                                  </TooltipTrigger>
                                  {p.salaryHistory?.length > 0 && (
                                    <TooltipContent className="p-0 overflow-hidden border-none shadow-xl">
                                      <div className="bg-slate-900 text-white p-3 space-y-2">
                                        <p className="text-[10px] font-black uppercase tracking-widest border-b border-white/10 pb-1">Payment History</p>
                                        {p.salaryHistory.map((h, i) => (
                                          <div key={i} className="flex justify-between gap-6 text-[10px]">
                                            <span>{h.date} • {h.type}</span>
                                            <span className="font-bold">{formatCurrency(h.amount)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </TooltipContent>
                                  )}
                                </Tooltip>
                              </TooltipProvider>
                            </TableCell>
                            <TableCell className="text-center text-[10px]">{p.salaryPaidDate || "--"}</TableCell>
                            <TableCell className="text-right text-xs font-medium">{formatCurrency(p.pfAmountEmployee + p.pfAmountEmployer)}</TableCell>
                            <TableCell className="text-right">
                               <span className={cn(
                                 "text-xs font-bold",
                                 (p.pfPaidAmountEmployee + p.pfPaidAmountEmployer) >= (p.pfAmountEmployee + p.pfAmountEmployer) ? "text-emerald-600" : "text-rose-500"
                               )}>
                                 {formatCurrency(p.pfPaidAmountEmployee + p.pfPaidAmountEmployer)}
                               </span>
                            </TableCell>
                            <TableCell className="text-right text-xs font-medium">{formatCurrency(p.esicAmountEmployee + p.esicAmountEmployer)}</TableCell>
                            <TableCell className="text-right">
                               <span className={cn(
                                 "text-xs font-bold",
                                 (p.esicPaidAmountEmployee + p.esicPaidAmountEmployer) >= (p.esicAmountEmployee + p.esicAmountEmployer) ? "text-emerald-600" : "text-rose-500"
                               )}>
                                 {formatCurrency(p.esicPaidAmountEmployee + p.esicPaidAmountEmployer)}
                               </span>
                            </TableCell>
                            <TableCell className="text-right pr-6">
                              <div className="flex justify-end gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-primary" 
                                  onClick={() => {
                                    setPaySalaryRec(p);
                                    setPaymentAmount(p.netPayable - p.salaryPaidAmount);
                                  }}
                                  disabled={p.salaryPaidAmount >= p.netPayable}
                                >
                                  <CreditCard className="w-4 h-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-emerald-600"
                                  onClick={() => {
                                    setPayPFRec(p);
                                    setPfEmpAmt(p.pfAmountEmployee - p.pfPaidAmountEmployee);
                                    setPfExAmt(p.pfAmountEmployer - p.pfPaidAmountEmployer);
                                  }}
                                  disabled={(p.pfPaidAmountEmployee + p.pfPaidAmountEmployer) >= (p.pfAmountEmployee + p.pfAmountEmployer)}
                                >
                                  <ShieldCheck className="w-4 h-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-blue-600"
                                  onClick={() => {
                                    setPayESICRec(p);
                                    setEsicEmpAmt(p.esicAmountEmployee - p.esicPaidAmountEmployee);
                                    setEsicExAmt(p.esicAmountEmployer - p.esicPaidAmountEmployer);
                                  }}
                                  disabled={(p.esicPaidAmountEmployee + p.esicPaidAmountEmployer) >= (p.esicAmountEmployee + p.esicAmountEmployer)}
                                >
                                  <Building2 className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500" onClick={() => handlePrint(p)}>
                                  <Printer className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Advance Salary and Leave tabs remain as is... */}
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
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-bold">Voucher No</TableHead>
                    <TableHead className="font-bold">Voucher Date</TableHead>
                    <TableHead className="font-bold">Employee Name</TableHead>
                    <TableHead className="font-bold">Dept / Desig</TableHead>
                    <TableHead className="text-right font-bold">Adv. Amount</TableHead>
                    <TableHead className="text-right font-bold">Paid Amount</TableHead>
                    <TableHead className="text-right font-bold">Deduction Advance Salary</TableHead>
                    <TableHead className="text-center font-bold">Slip No</TableHead>
                    <TableHead className="text-center font-bold">Sal. Month</TableHead>
                    <TableHead className="text-right font-bold">Remaining</TableHead>
                    <TableHead className="text-center font-bold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paidVouchers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-20 text-muted-foreground">
                        No paid advance salary records found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paidVouchers.map(v => {
                      const emp = employees.find(e => e.id === v.employeeId);
                      const recoveries = payrollRecords.filter(p => p.employeeId === (emp?.employeeId || v.employeeId));
                      const totalRecovered = recoveries.reduce((sum, p) => sum + (p.advanceRecovery || 0), 0);
                      const remaining = v.amount - totalRecovered;
                      const lastRecovery = recoveries[recoveries.length - 1];

                      return (
                        <TableRow key={v.id} className="hover:bg-slate-50/50">
                          <TableCell className="font-mono font-bold text-primary">{v.voucherNo}</TableCell>
                          <TableCell className="text-sm">{v.date}</TableCell>
                          <TableCell className="font-bold">{emp?.name || v.employeeId}</TableCell>
                          <TableCell className="text-xs">
                            <div className="flex flex-col">
                              <span>{emp?.department || "--"}</span>
                              <span className="text-muted-foreground">{emp?.designation || "--"}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-bold">{formatCurrency(v.amount)}</TableCell>
                          <TableCell className="text-right font-bold text-emerald-600">{formatCurrency(v.amount)}</TableCell>
                          <TableCell className="text-right font-bold text-rose-600">{formatCurrency(totalRecovered)}</TableCell>
                          <TableCell className="text-center font-mono text-[10px]">{lastRecovery ? lastRecovery.slipNo : "--"}</TableCell>
                          <TableCell className="text-center font-bold text-xs">{lastRecovery ? lastRecovery.month : "--"}</TableCell>
                          <TableCell className="text-right font-black text-primary">{formatCurrency(Math.max(0, remaining))}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={remaining <= 0 ? "default" : "outline"} className={cn(
                              "text-[10px] font-black",
                              remaining <= 0 ? "bg-emerald-600" : "text-amber-600 border-amber-200 bg-amber-50"
                            )}>
                              {remaining <= 0 ? "COMPLETE" : "PENDING DEDUCTION"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leave" className="mt-8 space-y-6">
          <Card className="border-none shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-bold">Employee Name</TableHead>
                    <TableHead className="font-bold">Employee ID</TableHead>
                    <TableHead className="font-bold">Department</TableHead>
                    <TableHead className="font-bold">Designation</TableHead>
                    <TableHead className="font-bold text-center">Available Balance</TableHead>
                    <TableHead className="text-right font-bold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map(emp => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-bold">{emp.name}</TableCell>
                      <TableCell className="font-mono text-xs">{emp.employeeId}</TableCell>
                      <TableCell>{emp.department}</TableCell>
                      <TableCell>{emp.designation}</TableCell>
                      <TableCell className="text-center font-black text-primary">{emp.advanceLeaveBalance || 0} Days</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="font-bold gap-2" onClick={() => setViewLeaveHistoryEmp(emp)}>
                          <History className="w-4 h-4" /> View History
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Pay Salary Dialog */}
      <Dialog open={!!paySalaryRec} onOpenChange={(o) => !o && setPaySalaryRec(null)}>
        <DialogContent className="sm:max-w-2xl">
          {paySalaryRec && (
            <>
              <DialogHeader>
                <DialogTitle>Pay Salary</DialogTitle>
                <DialogDescription>
                  {paySalaryRec.employeeName} ({paySalaryRec.employeeId}) • {paySalaryRec.month}
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-6 py-4">
                <div className="space-y-2">
                  <Label>Salary Paid Amount</Label>
                  <Input 
                    type="number" 
                    value={paymentAmount} 
                    onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  />
                  <p className="text-[10px] text-muted-foreground font-bold">
                    Remaining: {formatCurrency(paySalaryRec.netPayable - paySalaryRec.salaryPaidAmount - paymentAmount)}
                  </p>
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
                  <Input placeholder="TXN ID / CHQ NO" value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} />
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

      {/* Pay PF Dialog */}
      <Dialog open={!!payPFRec} onOpenChange={(o) => !o && setPayPFRec(null)}>
        <DialogContent className="sm:max-w-2xl">
          {payPFRec && (
            <>
              <DialogHeader>
                <DialogTitle>Pay PF (Provident Fund)</DialogTitle>
                <DialogDescription>
                  {payPFRec.employeeName} • PF No: {employees.find(e => e.employeeId === payPFRec.employeeId)?.pfNumber || "N/A"}
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-6 py-4">
                <div className="space-y-2">
                  <Label>Employee PF Amount</Label>
                  <Input type="number" value={pfEmpAmt} onChange={(e) => setPfEmpAmt(parseFloat(e.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                  <Label>Employer PF Amount</Label>
                  <Input type="number" value={pfExAmt} onChange={(e) => setPfExAmt(parseFloat(e.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                  <Label>Paid Date</Label>
                  <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Reference Number</Label>
                  <Input value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPayPFRec(null)}>Cancel</Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold" onClick={handlePostPF}>Record PF Payment</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Pay ESIC Dialog */}
      <Dialog open={!!payESICRec} onOpenChange={(o) => !o && setPayESICRec(null)}>
        <DialogContent className="sm:max-w-2xl">
          {payESICRec && (
            <>
              <DialogHeader>
                <DialogTitle>Pay ESIC</DialogTitle>
                <DialogDescription>
                  {payESICRec.employeeName} • ESIC No: {employees.find(e => e.employeeId === payESICRec.employeeId)?.esicNumber || "N/A"}
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-6 py-4">
                <div className="space-y-2">
                  <Label>Employee ESIC Amount</Label>
                  <Input type="number" value={esicEmpAmt} onChange={(e) => setEsicEmpAmt(parseFloat(e.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                  <Label>Employer ESIC Amount</Label>
                  <Input type="number" value={esicExAmt} onChange={(e) => setEsicExAmt(parseFloat(e.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                  <Label>Paid Date</Label>
                  <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Reference Number</Label>
                  <Input value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPayESICRec(null)}>Cancel</Button>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white font-bold" onClick={handlePostESIC}>Record ESIC Payment</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Leave and history modals remain as is... */}
      <Dialog open={!!adjustLeaveEmp} onOpenChange={(open) => !open && setAdjustLeaveEmp(null)}>
        <DialogContent className="sm:max-w-3xl">
          {adjustLeaveEmp && (
            <>
              <DialogHeader>
                <div className="flex justify-between items-start border-b pb-4">
                  <div>
                    <DialogTitle className="text-xl font-bold">{adjustLeaveEmp.name} ({adjustLeaveEmp.employeeId})</DialogTitle>
                    <DialogDescription>{adjustLeaveEmp.department} / {adjustLeaveEmp.designation} • {selectedMonth}</DialogDescription>
                  </div>
                  <div className="text-right bg-primary/5 p-3 rounded-xl border border-primary/10">
                    <p className="text-[10px] font-black uppercase text-primary tracking-widest">Available Balance</p>
                    <p className="text-2xl font-black text-primary">{adjustLeaveEmp.advanceLeaveBalance || 0} Days</p>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-8 py-6">
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { label: "Working Days", val: getAttendanceSummary(adjustLeaveEmp.employeeId).attendance, color: "text-emerald-600" },
                    { label: "Absent", val: getAttendanceSummary(adjustLeaveEmp.employeeId).absent, color: "text-rose-600" },
                    { label: "Holiday Attendance", val: getAttendanceSummary(adjustLeaveEmp.employeeId).holidayWork, color: "text-amber-600" },
                    { label: "Total Earning Days", val: getAttendanceSummary(adjustLeaveEmp.employeeId).attendance, color: "text-primary font-black" }
                  ].map((stat, i) => (
                    <div key={i} className="bg-slate-50 p-4 rounded-2xl text-center border border-slate-100 shadow-sm">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">{stat.label}</p>
                      <p className={cn("text-xl font-bold mt-1", stat.color)}>{stat.val}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="p-6 bg-slate-900 text-white rounded-3xl space-y-4 shadow-xl">
                    <h4 className="text-sm font-bold flex items-center gap-2"><CalendarClock className="w-4 h-4 text-primary" /> Adjust Leave</h4>
                    <div className="space-y-4 pt-2">
                       <div className="space-y-2">
                          <Label className="text-slate-400">Advance Leave to Use</Label>
                          <Input 
                            type="number" 
                            className="bg-slate-800 border-slate-700 text-white" 
                            value={advanceLeaveValue}
                            onChange={(e) => setAdvanceLeaveValue(parseInt(e.target.value) || 0)}
                          />
                          <p className="text-[10px] text-rose-400 font-bold">Max allowed: {adjustLeaveEmp.advanceLeaveBalance || 0} days</p>
                       </div>
                       <div className="flex flex-col gap-2">
                          <div className="flex gap-2">
                            <Button className="flex-1 bg-primary font-bold" onClick={handleAdjustLeave} disabled={isProcessing}>Add Leave</Button>
                            <Button className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold border-none" onClick={() => setAdjustedEmployees(prev => ({ ...prev, [adjustLeaveEmp.id]: true }))}>Not Required</Button>
                          </div>
                       </div>
                    </div>
                  </div>
                  <div className="p-6 border-2 border-dashed border-slate-200 rounded-3xl space-y-4">
                    <h4 className="text-sm font-bold flex items-center gap-2"><PlusCircle className="w-4 h-4 text-emerald-600" /> Convert Holiday Work</h4>
                    <div className="space-y-4 pt-2">
                       <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                          <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Selected Month Holiday Work</p>
                          <p className="text-2xl font-black text-emerald-900">{getAttendanceSummary(adjustLeaveEmp.employeeId).holidayWork} Days</p>
                       </div>
                       <Button variant="outline" className="w-full border-emerald-200 text-emerald-700 hover:bg-emerald-50 h-12 font-bold" onClick={() => {
                          setEmployees(prev => prev.map(e => e.id === adjustLeaveEmp.id ? { ...e, advanceLeaveBalance: (e.advanceLeaveBalance || 0) + getAttendanceSummary(adjustLeaveEmp.employeeId).holidayWork } : e));
                          setAdjustedEmployees(prev => ({ ...prev, [adjustLeaveEmp.id]: true }));
                          toast({ title: "Balance Updated" });
                          setAdjustLeaveEmp(null);
                       }}>
                         Add to Advance Leave Balance
                       </Button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Printable Salary Slip (Hidden until triggered) */}
      {printRec && (
        <SalarySlip printRec={printRec} employees={employees} firms={firms} plants={plants} />
      )}
    </div>
  );
}

function SalarySlip({ printRec, employees, firms, plants }: any) {
  const emp = employees.find((e: any) => e.employeeId === printRec.employeeId);
  const firm = firms.find((f: any) => f.id === emp?.firmId);
  const plant = plants.find((p: any) => p.id === emp?.unitId);

  return (
    <div className="fixed inset-0 bg-white z-[999] p-10 font-serif text-slate-900 hidden print:block overflow-auto">
      <div className="max-w-4xl mx-auto border-4 border-slate-900 p-8 space-y-8">
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6">
          <div className="flex items-center gap-4">
            {firm?.logo && <img src={firm.logo} alt="Logo" className="w-16 h-16 object-contain" />}
            <div>
              <h1 className="text-2xl font-black uppercase">{firm?.name || "Sikka Industries Ltd."}</h1>
              <p className="text-sm font-medium">{plant?.name || "Okhla Unit 1"}</p>
              <p className="text-xs text-slate-500 italic">{plant?.address || "Phase III, Okhla, New Delhi"}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold">Slip No: <span className="font-mono">{printRec.slipNo}</span></p>
            <p className="text-sm font-bold">Slip Date: {printRec.slipDate}</p>
          </div>
        </div>

        <div className="text-center py-2 bg-slate-900 text-white rounded">
          <h2 className="text-lg font-black uppercase tracking-widest">Salary Slip for {printRec.month}</h2>
        </div>

        {/* Employee Details */}
        <div className="grid grid-cols-2 gap-px bg-slate-900 border border-slate-900">
          <DetailRow label="Employee ID" value={printRec.employeeId} />
          <DetailRow label="Employee Name" value={printRec.employeeName} />
          <DetailRow label="Father Name" value={emp?.fatherName || "N/A"} />
          <DetailRow label="Join Date" value={emp?.joinDate || "N/A"} />
          <DetailRow label="Department" value={emp?.department || "N/A"} />
          <DetailRow label="Designation" value={emp?.designation || "N/A"} />
          <DetailRow label="PF Number" value={emp?.pfNumber || "N/A"} />
          <DetailRow label="ESIC Number" value={emp?.esicNumber || "N/A"} />
        </div>

        {/* Salary Structure */}
        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="font-bold border-b-2 border-slate-900 pb-1">Earnings Structure</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span>Basic Salary</span><span>{formatCurrency(emp?.salary.basic || 0)}</span></div>
              <div className="flex justify-between"><span>HRA</span><span>{formatCurrency(emp?.salary.hra || 0)}</span></div>
              <div className="flex justify-between"><span>Other Allowance</span><span>{formatCurrency(emp?.salary.allowance || 0)}</span></div>
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="font-bold border-b-2 border-slate-900 pb-1">Statutory Compliance</h3>
            {emp?.isGovComplianceEnabled ? (
              <div className="space-y-3">
                <div className="p-2 bg-slate-50 border rounded space-y-1 text-[10px]">
                  <p className="font-black border-b border-slate-200 pb-0.5 mb-1 uppercase">Employee Contribution</p>
                  <div className="flex justify-between"><span>PF Amount</span><span>{formatCurrency(printRec.pfAmountEmployee)}</span></div>
                  <div className="flex justify-between"><span>ESIC Amount</span><span>{formatCurrency(printRec.esicAmountEmployee)}</span></div>
                </div>
                <div className="p-2 bg-slate-50 border rounded space-y-1 text-[10px]">
                  <p className="font-black border-b border-slate-200 pb-0.5 mb-1 uppercase">Employer Contribution</p>
                  <div className="flex justify-between"><span>PF Amount</span><span>{formatCurrency(printRec.pfAmountEmployer)}</span></div>
                  <div className="flex justify-between"><span>ESIC Amount</span><span>{formatCurrency(printRec.esicAmountEmployer)}</span></div>
                </div>
              </div>
            ) : (
              <p className="text-xs italic text-slate-500">Not Applicable</p>
            )}
          </div>
        </div>

        {/* Summary */}
        <div className="bg-slate-50 p-6 border-2 border-slate-900 rounded-xl grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-[10px] font-black uppercase text-slate-500">Earning Days</p>
            <p className="text-xl font-bold">{printRec.totalEarningDays}</p>
          </div>
          <div className="text-center border-x-2 border-slate-200">
            <p className="text-[10px] font-black uppercase text-primary">Net Pay for Month</p>
            <p className="text-2xl font-black text-primary">{formatCurrency(printRec.netPayable)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-black uppercase text-slate-500">Monthly CTC</p>
            <p className="text-xl font-bold">{formatCurrency(emp?.salary.monthlyCTC || 0)}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-end pt-12">
          <div className="space-y-1">
             <div className="w-48 border-b-2 border-slate-900" />
             <p className="text-xs font-bold text-center">Authorized Signature</p>
          </div>
          <div className="text-right">
             <p className="text-[9px] text-slate-400 italic">This is a system-generated salary slip and is considered an original document.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string, value: any }) {
  return (
    <div className="flex items-center bg-white p-2">
      <span className="text-[10px] font-black uppercase text-slate-400 w-32 shrink-0">{label}:</span>
      <span className="text-xs font-bold text-slate-900">{value}</span>
    </div>
  );
}
