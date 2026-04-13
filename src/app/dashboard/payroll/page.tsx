
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
  ChevronRight
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
  const [payPFRec, setPayPFRec] = useState<PayrollRecord | null>(null);
  const [payESICRec, setPayESICRec] = useState<PayrollRecord | null>(null);
  const [printRec, setPrintRec] = useState<PayrollRecord | null>(null);
  const [printVoucherRec, setPrintVoucherRec] = useState<PayrollRecord | null>(null);

  // Form States for Payments
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentDate, setPaymentDate] = useState("");
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

  const handlePrintVoucher = (rec: PayrollRecord) => {
    setPrintVoucherRec(rec);
    setTimeout(() => {
      window.print();
    }, 500);
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
                <Table className="min-w-[1800px]">
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="font-bold whitespace-nowrap">Firm / Unit</TableHead>
                      <TableHead className="font-bold whitespace-nowrap">Slip No / Date</TableHead>
                      <TableHead className="font-bold whitespace-nowrap">Employee Name / ID</TableHead>
                      <TableHead className="font-bold whitespace-nowrap">Dept / Desig</TableHead>
                      <TableHead className="font-bold text-center">Month</TableHead>
                      <TableHead className="font-bold text-center">Days</TableHead>
                      <TableHead className="font-bold text-right">Net Payable Amount</TableHead>
                      <TableHead className="font-bold text-right">Salary Paid Amount</TableHead>
                      <TableHead className="font-bold text-center">Salary Paid Date</TableHead>
                      <TableHead className="font-bold text-right">PF Amount (Emp+Ex)</TableHead>
                      <TableHead className="font-bold text-right">PF Paid Amount</TableHead>
                      <TableHead className="font-bold text-center">PF Paid Date</TableHead>
                      <TableHead className="font-bold text-right">ESIC Amount (Emp+Ex)</TableHead>
                      <TableHead className="font-bold text-right">ESIC Paid Amount</TableHead>
                      <TableHead className="font-bold text-center">ESIC Paid Date</TableHead>
                      <TableHead className="text-right font-bold pr-6">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {finalizedSalaries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={16} className="text-center py-20 text-muted-foreground">No finalized salaries found.</TableCell>
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
                            <TableCell className="text-center text-[10px]">{p.pfPaidDate || "--"}</TableCell>
                            <TableCell className="text-right text-xs font-medium">{formatCurrency(p.esicAmountEmployee + p.esicAmountEmployer)}</TableCell>
                            <TableCell className="text-right">
                               <span className={cn(
                                 "text-xs font-bold",
                                 (p.esicPaidAmountEmployee + p.esicPaidAmountEmployer) >= (p.esicAmountEmployee + p.esicAmountEmployer) ? "text-emerald-600" : "text-rose-500"
                               )}>
                                 {formatCurrency(p.esicPaidAmountEmployee + p.esicPaidAmountEmployer)}
                               </span>
                            </TableCell>
                            <TableCell className="text-center text-[10px]">{p.esicPaidDate || "--"}</TableCell>
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
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500" onClick={() => handlePrint(p)}>
                                        <Printer className="w-4 h-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Print Salary Slip</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => handlePrintVoucher(p)}>
                                        <FileText className="w-4 h-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Print Payment Voucher</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
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
                    {paginatedPaidVouchers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center py-20 text-muted-foreground">
                          No paid advance salary records found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedPaidVouchers.map(v => {
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
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </CardContent>
            {totalAdvancePages > 1 && (
              <CardFooter className="bg-slate-50 border-t flex items-center justify-between p-4">
                <div className="text-xs font-bold text-muted-foreground">
                  Showing {((advancePage - 1) * rowsPerPageAdvance) + 1} - {Math.min(advancePage * rowsPerPageAdvance, paidVouchers.length)} of {paidVouchers.length}
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={advancePage === 1}
                    onClick={() => setAdvancePage(p => p - 1)}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                  </Button>
                  <div className="text-xs font-black px-4">Page {advancePage} of {totalAdvancePages}</div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={advancePage === totalAdvancePages}
                    onClick={() => setAdvancePage(p => p + 1)}
                  >
                    Next <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </CardFooter>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="leave" className="mt-8 space-y-6">
          <Card className="border-none shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <ScrollArea className="w-full">
                <Table className="min-w-[1000px]">
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="font-bold">Employee Name</TableHead>
                      <TableHead className="font-bold">Employee ID</TableHead>
                      <TableHead className="font-bold">Department</TableHead>
                      <TableHead className="font-bold">Designation</TableHead>
                      <TableHead className="font-bold text-center">Available Balance</TableHead>
                      <TableHead className="text-right font-bold pr-6">Actions</TableHead>
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
                        <TableCell className="text-right pr-6">
                          <Button variant="ghost" size="sm" className="font-bold gap-2" onClick={() => setViewLeaveHistoryEmp(emp)}>
                            <History className="w-4 h-4" /> View History
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
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

      {/* Printable Salary Slip */}
      {printRec && (
        <SalarySlip printRec={printRec} employees={employees} firms={firms} plants={plants} />
      )}

      {/* Printable Salary Payment Voucher */}
      {printVoucherRec && (
        <SalaryVoucherPrint payroll={printVoucherRec} employees={employees} firms={firms} plants={plants} />
      )}
    </div>
  );
}

function SalaryVoucherPrint({ payroll, employees, firms, plants }: any) {
  const emp = employees.find((e: any) => e.employeeId === payroll.employeeId);
  const firm = firms.find((f: any) => f.id === emp?.firmId);
  const plant = plants.find((p: any) => p.id === emp?.unitId);
  const lastPayment = payroll.salaryHistory?.[payroll.salaryHistory.length - 1];

  return (
    <div className="fixed inset-0 bg-white z-[999] font-serif text-slate-900 hidden print:block overflow-auto p-[1cm]">
      <div className="w-full max-w-[210mm] mx-auto border-4 border-slate-900 p-10 space-y-10 min-h-[297mm]">
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 border flex items-center justify-center">
              {firm?.logo ? <img src={firm.logo} className="max-h-full max-w-full" alt="logo" /> : <Building2 className="w-12 h-12 opacity-20" />}
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight">{firm?.name}</h1>
              <p className="text-sm font-bold text-slate-700">{plant?.name}</p>
              <p className="text-xs text-slate-500 italic max-w-xs">{plant?.address}</p>
            </div>
          </div>
          <div className="text-right space-y-1">
            <div className="flex justify-end gap-2 text-sm"><span className="font-bold text-slate-500">Voucher No:</span><span className="font-mono font-bold">{payroll.slipNo?.replace('SIL', 'VCH-SAL')}</span></div>
            <div className="flex justify-end gap-2 text-sm"><span className="font-bold text-slate-500">Date:</span><span className="font-bold">{payroll.salaryPaidDate || payroll.slipDate}</span></div>
          </div>
        </div>

        {/* Title */}
        <div className="text-center py-4 bg-slate-100 border-y-2 border-slate-900">
          <h2 className="text-xl font-black uppercase tracking-[0.25em]">Salary Payment Voucher</h2>
        </div>

        {/* Employee Identity */}
        <div className="grid grid-cols-2 border-2 border-slate-900">
          <DetailCell label="Employee ID" value={payroll.employeeId} />
          <DetailCell label="Employee Name" value={payroll.employeeName} />
          <DetailCell label="Department" value={emp?.department} />
          <DetailCell label="Designation" value={emp?.designation} />
          <DetailCell label="Salary Month" value={payroll.month} />
          <DetailCell label="Payment Date" value={payroll.salaryPaidDate} />
        </div>

        {/* Payment Details */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 border-2 border-slate-900">
            <div className="p-4 border-b-2 border-slate-900 flex items-center justify-between">
              <span className="font-black uppercase text-sm">Net Salary Paid (In Figures)</span>
              <span className="text-2xl font-black">{formatCurrency(payroll.salaryPaidAmount)}</span>
            </div>
            <div className="p-4 bg-slate-50 border-b-2 border-slate-900 flex items-start gap-4">
              <span className="font-black uppercase text-xs w-48 shrink-0">Amount in Words:</span>
              <span className="text-sm font-bold italic underline decoration-dotted">{numberToIndianWords(payroll.salaryPaidAmount)}</span>
            </div>
            <div className="grid grid-cols-2">
              <div className="p-4 border-r-2 border-slate-900 flex items-center gap-4">
                <span className="font-black uppercase text-xs">Payment Mode:</span>
                <span className="text-sm font-bold">{lastPayment?.type || 'BANKING'}</span>
              </div>
              <div className="p-4 flex items-center gap-4">
                <span className="font-black uppercase text-xs">Ref/Chq No:</span>
                <span className="text-sm font-mono font-bold">{lastPayment?.reference || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Compliance Summary */}
        <div className="p-6 border-2 border-slate-900 space-y-4">
          <h3 className="font-black text-xs uppercase border-b pb-2">Compliance Deductions Applied</h3>
          <div className="grid grid-cols-2 gap-10 text-sm">
            <div className="flex justify-between"><span>Employee PF Deduction:</span><span className="font-bold">{formatCurrency(payroll.pfAmountEmployee)}</span></div>
            <div className="flex justify-between"><span>Employee ESIC Deduction:</span><span className="font-bold">{formatCurrency(payroll.esicAmountEmployee)}</span></div>
          </div>
        </div>

        {/* Declaration */}
        <div className="p-6 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl italic text-sm text-center leading-relaxed">
          "Received the salary amount for the above-mentioned period in full/partial settlement."
        </div>

        {/* Footer */}
        <div className="flex justify-between items-end pt-24">
          <div className="text-center space-y-3">
            <div className="w-64 border-b-2 border-slate-900" />
            <p className="text-sm font-black uppercase tracking-tighter">Receiver Signature (Employee)</p>
          </div>
          <div className="text-center space-y-3">
             <div className="w-16 h-16 border-2 border-slate-200 rounded-lg mx-auto flex items-center justify-center opacity-20"><span className="text-[8px] font-bold">Stamp Here</span></div>
            <div className="w-64 border-b-2 border-slate-900" />
            <p className="text-sm font-black uppercase tracking-tighter">Authorized Signature</p>
          </div>
        </div>

        {/* End Note */}
        <div className="mt-auto pt-10 border-t border-slate-100 text-center">
          <p className="text-[10px] text-slate-400 font-bold italic uppercase tracking-wider">
            👉 This is a system-generated Salary Payment Voucher and is considered an original document.
          </p>
        </div>
      </div>
    </div>
  );
}

function SalarySlip({ printRec, employees, firms, plants }: any) {
  const emp = employees.find((e: any) => e.employeeId === printRec.employeeId);
  const firm = firms.find((f: any) => f.id === emp?.firmId);
  const plant = plants.find((p: any) => p.id === emp?.unitId);

  return (
    <div className="fixed inset-0 bg-white z-[999] font-serif text-slate-900 hidden print:block overflow-auto p-[1cm]">
      <div className="w-full max-w-[210mm] mx-auto border-4 border-slate-900 p-8 space-y-8 min-h-[297mm]">
        {/* 1. Top Header Section */}
        <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 bg-slate-50 rounded-lg flex items-center justify-center overflow-hidden border">
              {firm?.logo ? (
                <img src={firm.logo} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <Building2 className="w-10 h-10 text-slate-300" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase leading-tight">{firm?.name || "Sikka Industries Ltd."}</h1>
              <p className="text-sm font-bold text-slate-700">{plant?.name || "Okhla Unit 1"}</p>
              <p className="text-xs text-slate-500 italic max-w-xs">{plant?.address || "Phase III, Okhla, New Delhi"}</p>
            </div>
          </div>
          <div className="text-right space-y-1">
            <div className="flex justify-end gap-2 text-sm">
              <span className="font-bold text-slate-500">Slip No:</span>
              <span className="font-mono font-bold text-slate-900">{printRec.slipNo}</span>
            </div>
            <div className="flex justify-end gap-2 text-sm">
              <span className="font-bold text-slate-500">Slip Date:</span>
              <span className="font-bold text-slate-900">{printRec.slipDate}</span>
            </div>
          </div>
        </div>

        {/* 2. Title Section */}
        <div className="text-center py-3 bg-slate-900 text-white rounded shadow-sm">
          <h2 className="text-xl font-black uppercase tracking-[0.2em]">Salary Slip for the Month of {printRec.month}</h2>
        </div>

        {/* 3. Employee Identity Details (Table Format) */}
        <div className="grid grid-cols-2 border-2 border-slate-900">
          <DetailCell label="Employee ID" value={printRec.employeeId} />
          <DetailCell label="Employee Name" value={printRec.employeeName} />
          <DetailCell label="Father Name" value={emp?.fatherName || "N/A"} />
          <DetailCell label="Joining Date" value={emp?.joinDate || "N/A"} />
          <DetailCell label="Department" value={emp?.department || "N/A"} />
          <DetailCell label="Designation" value={emp?.designation || "N/A"} />
          <DetailCell label="PF Account Number" value={emp?.pfNumber || "N/A"} />
          <DetailCell label="ESIC Number" value={emp?.esicNumber || "N/A"} />
        </div>

        {/* 4 & 5. Salary Structure & Compliance Section */}
        <div className="grid grid-cols-2 gap-8 pt-4">
          <div className="space-y-4">
            <h3 className="font-black text-sm uppercase tracking-wider border-b-2 border-slate-900 pb-1">4. Salary Structure</h3>
            <div className="space-y-2 text-sm font-medium">
              <div className="flex justify-between border-b border-slate-100 pb-1">
                <span className="text-slate-500 uppercase text-[10px]">Basic Salary</span>
                <span className="font-bold">{formatCurrency(emp?.salary.basic || 0)}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1">
                <span className="text-slate-500 uppercase text-[10px]">HRA (House Rent Allowance)</span>
                <span className="font-bold">{formatCurrency(emp?.salary.hra || 0)}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1">
                <span className="text-slate-500 uppercase text-[10px]">Other Allowance</span>
                <span className="font-bold">{formatCurrency(emp?.salary.allowance || 0)}</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-black text-sm uppercase tracking-wider border-b-2 border-slate-900 pb-1">5. Compliance Section</h3>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Status:</span>
              <Badge variant="outline" className="rounded-none font-black text-[10px] uppercase py-0 px-2 border-slate-900">
                {emp?.isGovComplianceEnabled ? "Applicable" : "Not Applicable"}
              </Badge>
            </div>
            
            {emp?.isGovComplianceEnabled ? (
              <div className="grid grid-cols-1 gap-4">
                <div className="p-3 bg-slate-50 border border-slate-200 space-y-2">
                  <p className="text-[9px] font-black text-slate-400 border-b border-slate-200 pb-1 uppercase">Employee Contribution</p>
                  <div className="flex justify-between text-xs"><span>PF Amount</span><span className="font-bold">{formatCurrency(printRec.pfAmountEmployee)}</span></div>
                  <div className="flex justify-between text-xs"><span>ESIC Amount</span><span className="font-bold">{formatCurrency(printRec.esicAmountEmployee)}</span></div>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 space-y-2">
                  <p className="text-[9px] font-black text-slate-400 border-b border-slate-200 pb-1 uppercase">Employer Contribution</p>
                  <div className="flex justify-between text-xs"><span>PF Amount</span><span className="font-bold">{formatCurrency(printRec.pfAmountEmployer)}</span></div>
                  <div className="flex justify-between text-xs"><span>ESIC Amount</span><span className="font-bold">{formatCurrency(printRec.esicAmountEmployer)}</span></div>
                </div>
              </div>
            ) : (
              <div className="p-10 border border-dashed border-slate-200 flex items-center justify-center italic text-xs text-slate-400">
                Statutory deductions not applicable for this profile.
              </div>
            )}
          </div>
        </div>

        {/* 6. Salary Summary Section */}
        <div className="bg-slate-900 text-white p-6 grid grid-cols-3 gap-6 rounded-lg shadow-md mt-6">
          <div className="text-center border-r border-slate-700 pr-6">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Earning Days</p>
            <p className="text-2xl font-black">{printRec.totalEarningDays}</p>
          </div>
          <div className="text-center border-r border-slate-700 px-6">
            <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1">Net Pay for the Month</p>
            <p className="text-3xl font-black text-emerald-400 tracking-tight">{formatCurrency(printRec.netPayable)}</p>
          </div>
          <div className="text-center pl-6">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Monthly CTC</p>
            <p className="text-2xl font-black text-slate-200">{formatCurrency(emp?.salary.monthlyCTC || 0)}</p>
          </div>
        </div>

        {/* 7. Footer Section */}
        <div className="flex justify-between items-end pt-20">
          <div className="space-y-2 text-center">
            <div className="w-56 border-b-2 border-slate-900 mb-2" />
            <p className="text-sm font-black uppercase tracking-tighter">Authorized Signature</p>
          </div>
          <div className="max-w-[300px] text-right">
             <div className="w-16 h-16 border-2 border-slate-100 rounded-lg ml-auto mb-2 flex items-center justify-center opacity-30">
                <span className="text-[8px] font-bold text-center uppercase leading-tight">Digital<br/>Seal</span>
             </div>
          </div>
        </div>

        {/* 8. End Note */}
        <div className="mt-auto pt-10 border-t border-slate-100 text-center">
          <p className="text-[10px] text-slate-400 font-bold italic uppercase tracking-wider">
            👉 This is a system-generated salary slip and is considered an original document.
          </p>
        </div>
      </div>
    </div>
  );
}

function DetailCell({ label, value }: { label: string, value: any }) {
  return (
    <div className="flex items-center p-3 border border-slate-900">
      <span className="text-[10px] font-black uppercase text-slate-500 w-36 shrink-0 tracking-tighter">{label}:</span>
      <span className="text-xs font-bold text-slate-900 uppercase truncate">{value}</span>
    </div>
  );
}
