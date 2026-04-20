
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
import { parseISO, format, isValid } from "date-fns";

const generatePayrollMonths = (count = 120, includeCurrent = true) => {
  const options = [];
  const date = new Date();
  const startOffset = includeCurrent ? 0 : 1;
  for (let i = startOffset; i < count + startOffset; i++) {
    const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
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

  // Paid History Filters
  const [historyFromMonth, setHistoryFromMonth] = useState("");
  const [historyToMonth, setHistoryToMonth] = useState("");

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
  const [viewLeaveHistoryEmployee, setViewLeaveHistoryEmployee] = useState<Employee | null>(null);
  
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
    monthHolidays: 4,
    autoAddedLeave: 0
  });

  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentType, setPaymentType] = useState<'BANKING' | 'CASH' | 'CHEQUE'>('BANKING');
  const [paymentRef, setPaymentRef] = useState("");

  const [pfPaidEmp, setPfPaidEmp] = useState(0);
  const [pfPaidEx, setPfPaidEx] = useState(0);
  const [esicPaidEmp, setEsicPaidEmp] = useState(0);
  const [esicPaidEx, setEsicPaidEx] = useState(0);

  const [adjustedEmployees, setAdjustedEmployees] = useState<Record<string, { adjusted: boolean, earningDays: number, balanceUsed: number, balanceAdded: number }>>({});

  useEffect(() => {
    setIsMounted(true);
    const prevMonth = PAYROLL_MONTHS_6M_GEN[0];
    setSelectedMonth(prevMonth);
    setHistoryFromMonth(prevMonth);
    setHistoryToMonth(prevMonth);
    setPaymentDate(new Date().toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    setAdjustedEmployees({});
  }, [selectedMonth]);

  const isGenerationAllowed = useMemo(() => {
    if (!selectedMonth) return false;
    return PAYROLL_MONTHS_6M_GEN.includes(selectedMonth);
  }, [selectedMonth]);

  const getAttendanceMetricsForMonth = (empId: string, monthStr: string) => {
    if (!monthStr) return { presents: 0, holidayWork: 0 };
    const [mmm, yy] = monthStr.split('-');
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const mIndex = monthNames.indexOf(mmm);
    const year = 2000 + parseInt(yy);
    
    const monthlyAttendance = attendanceRecords.filter(r => {
      if (r.employeeId !== empId) return false;
      if (!r.approved) return false;
      const d = parseISO(r.date);
      if (!isValid(d)) return false;
      return d.getMonth() === mIndex && d.getFullYear() === year;
    });

    const holidayWork = monthlyAttendance.filter(r => r.inPlant === 'Holiday Work' || r.status === 'HOLIDAY').length;
    const presents = monthlyAttendance.filter(r => ['PRESENT', 'FIELD', 'WFH'].includes(r.status) && r.inPlant !== 'Holiday Work').length;
    const halfDays = monthlyAttendance.filter(r => r.status === 'HALF_DAY' && r.inPlant !== 'Holiday Work').length;

    return {
      presents: presents + (halfDays * 0.5),
      holidayWork
    };
  };

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
    }).map(emp => {
      const metrics = getAttendanceMetricsForMonth(emp.employeeId, selectedMonth);
      return { ...emp, metrics };
    });
  }, [employees, searchTerm, selectedFirmId, payrollRecords, selectedMonth, isGenerationAllowed, attendanceRecords]);

  const paymentTabLists = useMemo(() => {
    const sorted = [...payrollRecords].sort((a, b) => {
      const dateCompare = (b.slipDate || "").localeCompare(a.slipDate || "");
      if (dateCompare !== 0) return dateCompare;
      return (b.slipNo || "").localeCompare(a.slipNo || "");
    });

    const filtered = sorted.filter(p => {
      const emp = employees.find(e => e.employeeId === p.employeeId);
      const search = searchTerm.toLowerCase();
      const matchesSearch = p.employeeName.toLowerCase().includes(search) || p.employeeId.toLowerCase().includes(search) || (p.slipNo || "").toLowerCase().includes(search);
      const matchesFirm = selectedFirmId === "all" || emp?.firmId === selectedFirmId;
      return matchesSearch && matchesFirm;
    });

    const pending: PayrollRecord[] = [];
    const paid: PayrollRecord[] = [];

    const monthOrder = [...PAYROLL_MONTHS_10Y].reverse(); 
    const fromIdx = monthOrder.indexOf(historyFromMonth);
    const toIdx = monthOrder.indexOf(historyToMonth);

    filtered.forEach(p => {
      const remainingSalary = p.netPayable - (p.salaryPaidAmount || 0);
      const remainingPF = (p.pfAmountEmployee + p.pfAmountEmployer) - ((p.pfPaidAmountEmployee || 0) + (p.pfPaidAmountEmployer || 0));
      const remainingESIC = (p.esicAmountEmployee + p.esicAmountEmployer) - ((p.esicPaidAmountEmployee || 0) + (p.esicPaidAmountEmployer || 0));
      
      const isFullyPaid = remainingSalary <= 0 && remainingPF <= 0 && remainingESIC <= 0;
      
      if (isFullyPaid) {
        const pMonthIdx = monthOrder.indexOf(p.month);
        if (fromIdx !== -1 && toIdx !== -1 && pMonthIdx >= fromIdx && pMonthIdx <= toIdx) {
          paid.push(p);
        }
      } else {
        if (selectedMonth === "" || p.month === selectedMonth) {
          pending.push(p);
        }
      }
    });

    return { pending, paid };
  }, [payrollRecords, searchTerm, selectedFirmId, employees, selectedMonth, historyFromMonth, historyToMonth]);

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
      
      const empPayroll = payrollRecords
        .filter(p => p.employeeId === employee.employeeId)
        .sort((a, b) => (a.slipDate || "").localeCompare(b.slipDate || ""));

      let slipPool = empPayroll.map(p => ({...p, remainingPool: p.advanceRecovery || 0}));

      const voucherBreakdown = empVouchers.map(v => {
        let recoveredForThisVoucher = 0;
        let lastSlipNo = "--";
        let lastSlipDate = "--";
        let lastSlipMonth = "--";
        let remToRecover = v.amount;

        for (let slip of slipPool) {
          if (remToRecover <= 0) break;
          if (slip.remainingPool > 0) {
            const take = Math.min(remToRecover, slip.remainingPool);
            slip.remainingPool -= take;
            remToRecover -= take;
            recoveredForThisVoucher += take;
            lastSlipNo = slip.slipNo || "--";
            lastSlipDate = slip.slipDate || "--";
            lastSlipMonth = slip.month || "--";
          }
        }

        return { 
          ...v, 
          recovered: recoveredForThisVoucher, 
          remaining: v.amount - recoveredForThisVoucher,
          slipNo: lastSlipNo,
          slipDate: lastSlipDate,
          slipMonth: lastSlipMonth
        };
      });

      const totalAdv = empVouchers.reduce((sum, v) => sum + v.amount, 0);
      const totalRecovery = empPayroll.reduce((sum, p) => sum + (p.advanceRecovery || 0), 0);

      return { 
        id: employee.id, 
        emp: employee, 
        totalAdvAmount: totalAdv, 
        totalRecoveryAmount: totalRecovery, 
        totalRemainingAmount: Math.max(0, totalAdv - totalRecovery), 
        vouchers: voucherBreakdown 
      };
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
    const metrics = getAttendanceMetricsForMonth(emp.employeeId, selectedMonth);
    
    const workingDaysCount = 26;
    let initialPresent = metrics.presents;
    let initialHolidayWork = metrics.holidayWork;
    let initialAbsent = Math.max(0, workingDaysCount - initialPresent);

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
      remainingBalance: (emp.advanceLeaveBalance || 0), // Removed +1 as per rule
      earningDays: initialPresent,
      monthWorkingDays: workingDaysCount,
      monthHolidays: 4,
      autoAddedLeave: 0
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
      holidayBanked: prev.holidayBanked + hw,
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
      absent: Math.max(0, prev.monthWorkingDays - (prev.present + prev.holidayWork)),
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
          earningDays: adjustmentState.earningDays,
          balanceUsed: adjustmentState.balanceUsed,
          balanceAdded: adjustmentState.holidayBanked 
        } 
      }));
      
      toast({ title: "Finalized", description: `Review complete. Earning Days set to ${adjustmentState.earningDays}` });
      setAdjustLeaveEmp(null);
    } finally { 
      setIsProcessing(false); 
    }
  };

  const handleApplyMonthlyCredits = () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      employees.forEach(emp => {
        const currentBalance = emp.advanceLeaveBalance || 0;
        updateRecord('employees', emp.id, { advanceLeaveBalance: currentBalance + 1 });
      });
      
      addRecord('notifications', {
        message: `System Wide Action: +1 Monthly Approved Leave credit applied to all staff.`,
        timestamp: format(new Date(), "yyyy-MM-dd HH:mm:ss"),
        read: false
      });

      toast({ title: "Credits Applied", description: "All employees have received +1 Approved Leave credit." });
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
    if (!p) return;
    const originalTitle = document.title;
    document.title = p.slipNo || "Salary_Slip";
    setPrintSlip(p);
    toast({ title: "Quick Print", description: "Preparing Salary Slip for A4 export..." });
    
    setTimeout(() => {
      window.focus();
      window.print();
      document.title = originalTitle;
      setTimeout(() => setPrintSlip(null), 1000);
    }, 500);
  };

  const handleViewSlip = (p: PayrollRecord) => {
    setPreviewSlip(p);
  };

  const handleExportPaidHistory = () => {
    const list = paymentTabLists.paid;
    if (list.length === 0) {
      toast({ variant: "destructive", title: "No Data", description: "No records found to export." });
      return;
    }

    const monthOrder = [...PAYROLL_MONTHS_10Y].reverse();
    if (monthOrder.indexOf(historyToMonth) < monthOrder.indexOf(historyFromMonth)) {
      toast({ variant: "destructive", title: "Range Error", description: "To Month cannot be earlier than From Month." });
      return;
    }

    const headers = [
      "Slip No", "Slip Date", "Employee ID", "Employee Name", "Month", 
      "Net Payable", "Settled Amount", "Settled Date", 
      "PF Employee", "PF Employer", "PF Paid Total",
      "ESIC Employee", "ESIC Employer", "ESIC Paid Total"
    ];

    const csvRows = [
      headers.join(","),
      ...list.map(p => [
        `"${p.slipNo}"`, 
        `"${p.slipDate || ''}"`,
        `"${p.employeeId}"`, 
        `"${p.employeeName}"`, 
        `"${p.month}"`,
        p.netPayable, 
        p.salaryPaidAmount, 
        `"${p.salaryPaidDate || ''}"`,
        p.pfAmountEmployee,
        p.pfAmountEmployer,
        (p.pfPaidAmountEmployee || 0) + (p.pfPaidAmountEmployer || 0),
        p.esicAmountEmployee,
        p.esicAmountEmployer,
        (p.esicPaidAmountEmployee || 0) + (p.esicPaidAmountEmployer || 0)
      ].join(","))
    ];

    const blob = new Blob([csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Paid_History_${historyFromMonth}_to_${historyToMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Report Downloaded", description: "Excel export for Paid History is complete." });
  };

  const leaveHistoryData = useMemo(() => {
    if (!viewLeaveHistoryEmployee) return [];
    
    const relevantPayroll = payrollRecords
      .filter(p => p.employeeId === viewLeaveHistoryEmployee.employeeId && ((p.adjustLeave || 0) > 0 || (p.addedLeave || 0) > 0))
      .sort((a, b) => {
        return a.month.localeCompare(b.month);
      });

    let currentBalance = 0; 
    return relevantPayroll.map(p => {
      const [mmm, yy] = p.month.split('-');
      const formattedMonth = `${mmm}-20${yy}`;
      const added = p.addedLeave || 0;
      const adjusted = p.adjustLeave || 0;
      currentBalance = currentBalance + added - adjusted;
      
      return {
        month: formattedMonth,
        addLeave: added,
        adjustLeave: adjusted,
        remainingLeave: Math.max(0, currentBalance),
        employeeName: p.employeeName,
        department: viewLeaveHistoryEmployee.department,
        designation: viewLeaveHistoryEmployee.designation
      };
    }).reverse(); 
  }, [viewLeaveHistoryEmployee, payrollRecords]);

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
                      <SelectContent>{PAYROLL_MONTHS_6M_GEN.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
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
                        For security and compliance, you can only generate salaries for the past six months, excluding the current month.
                      </p>
                    </div>
                  </div>
                ) : (
                  <ScrollArea className="w-full" tabIndex={0}>
                    <Table className="min-w-[1300px]">
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
                          <TableRow><TableCell colSpan={7} className="text-center py-20 text-muted-foreground">No pending generation for {selectedMonth}.</TableCell></TableRow>
                        ) : (
                          pendingGenerationEmployees.map((emp: any) => {
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
                                    <Button size="sm" className={cn("text-xs font-bold gap-1", isAdjusted ? "bg-primary text-white" : "bg-slate-200 text-slate-400 cursor-not-allowed")} onClick={(e) => { e.stopPropagation(); if(isAdjusted) router.push(`/dashboard/payroll/generate/${emp.id}?month=${selectedMonth}&earningDays=${adjData.earningDays}&adjustLeave=${adjData.balanceUsed}&addedLeave=${adjData.balanceAdded}`); }} disabled={!isAdjusted || isProcessing}><Calculator className="w-3 h-3" /> Generate Salary</Button>
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

          <TabsContent value="payment" className="mt-8 space-y-8">
            <Card className="border-none shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50 border-b p-6">
                <div className="flex flex-col lg:flex-row items-center gap-4">
                  <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search pending payments..." className="pl-10 h-10 bg-white" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  </div>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="w-full sm:w-40 bg-white h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Pending</SelectItem>
                      {PAYROLL_MONTHS_10Y.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
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
                      {paymentTabLists.pending.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-16 text-muted-foreground font-medium">No pending payments for current filters.</TableCell></TableRow>
                      ) : (
                        paymentTabLists.pending.map((p) => {
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
                                        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setPayESICRec(p); setEsicPaidEmp(p.esicAmountEmployee - (p.esicPaidAmountEmployee || 0)); setEsicPaidEx(p.esicAmountEmployer - (p.esicAmountEmployer || 0)); }} disabled={remainingESIC <= 0}>Pay ESIC</DropdownMenuItem>
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

            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-1">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-100 rounded-lg">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Paid History</h3>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                  <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1 rounded-xl shadow-sm">
                    <Label className="text-[9px] font-black uppercase text-slate-400">From</Label>
                    <Select value={historyFromMonth} onValueChange={(val) => {
                      setHistoryFromMonth(val);
                      const monthOrder = [...PAYROLL_MONTHS_10Y].reverse();
                      if (monthOrder.indexOf(historyToMonth) < monthOrder.indexOf(val)) {
                        setHistoryToMonth(val);
                      }
                    }}>
                      <SelectTrigger className="h-7 w-28 border-none bg-transparent text-[10px] font-bold p-0 focus:ring-0"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PAYROLL_MONTHS_10Y.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <div className="w-px h-4 bg-slate-200" />
                    <Label className="text-[9px] font-black uppercase text-slate-400">To</Label>
                    <Select value={historyToMonth} onValueChange={(val) => {
                      const monthOrder = [...PAYROLL_MONTHS_10Y].reverse();
                      if (monthOrder.indexOf(val) < monthOrder.indexOf(historyFromMonth)) {
                        toast({ variant: "destructive", title: "Range Error", description: "To Month cannot be earlier than From Month." });
                        return;
                      }
                      setHistoryToMonth(val);
                    }}>
                      <SelectTrigger className="h-7 w-28 border-none bg-transparent text-[10px] font-bold p-0 focus:ring-0"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PAYROLL_MONTHS_10Y.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-9 gap-2 font-bold text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    onClick={handleExportPaidHistory}
                  >
                    <FileSpreadsheet className="w-4 h-4" /> Export Excel
                  </Button>
                </div>
              </div>
              
              <Card className="border-none shadow-sm overflow-hidden bg-slate-50/30">
                <CardContent className="p-0">
                  <ScrollArea className="w-full" tabIndex={0}>
                    <Table className="min-w-[1300px]">
                      <TableHeader className="bg-slate-100/50">
                        <TableRow>
                          <TableHead className="font-bold">Slip Details</TableHead>
                          <TableHead className="font-bold">Employee Name / ID</TableHead>
                          <TableHead className="font-bold">Month</TableHead>
                          <TableHead className="font-bold text-right">Net Payable</TableHead>
                          <TableHead className="font-bold text-right">Settled Amount</TableHead>
                          <TableHead className="font-bold text-center">Settled Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paymentTabLists.paid.length === 0 ? (
                          <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground text-xs font-medium">No historical settled records found for selected range.</TableCell></TableRow>
                        ) : (
                          paymentTabLists.paid.map((p) => (
                            <TableRow key={p.id} className="hover:bg-white/50 transition-colors opacity-80 hover:opacity-100">
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="font-mono font-bold text-slate-600 cursor-pointer hover:underline" onClick={() => handleViewSlip(p)}>{p.slipNo}</span>
                                  <span className="text-[10px] text-slate-400">{p.slipDate ? format(parseISO(p.slipDate), 'dd-MMM-yyyy') : "--"}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="font-bold uppercase text-slate-600">{p.employeeName}</span>
                                  <span className="text-xs font-mono text-slate-400">{p.employeeId}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center"><Badge variant="outline" className="bg-white text-slate-400 font-bold">{p.month}</Badge></TableCell>
                              <TableCell className="text-right font-bold text-slate-500">{formatCurrency(p.netPayable)}</TableCell>
                              <TableCell className="text-right font-black text-emerald-600">{formatCurrency(p.salaryPaidAmount)}</TableCell>
                              <TableCell className="text-center">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                                  {p.salaryPaidDate ? format(parseISO(p.salaryPaidDate), 'dd-MMM-yyyy') : "--"}
                                </span>
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
            </div>
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
              <CardHeader className="bg-slate-50 border-b p-6 flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg"><CheckCircle2 className="w-5 h-5 text-primary" /></div>
                  <div>
                    <CardTitle className="text-lg font-bold">Advance Leave Portal</CardTitle>
                    <CardDescription>Monitor leave balances and process monthly organizational credits.</CardDescription>
                  </div>
                </div>
                <Button className="font-black gap-2 bg-primary" onClick={handleApplyMonthlyCredits} disabled={isProcessing}>
                  <PlusCircle className="w-4 h-4" /> Process Monthly Credits (+1)
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="w-full" tabIndex={0}>
                  <Table className="min-w-[1000px]">
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="font-bold px-6">Employee Name</TableHead>
                        <TableHead className="font-bold">Department / Designation</TableHead>
                        <TableHead className="font-bold text-center">Available Balance</TableHead>
                        <TableHead className="text-right font-bold pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employees.map(emp => (
                        <TableRow key={emp.id} className="hover:bg-slate-50/50">
                          <TableCell className="px-6"><div className="flex flex-col"><span className="font-bold uppercase">{emp.name}</span><span className="text-[10px] font-mono text-slate-400">{emp.employeeId}</span></div></TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-600">{emp.department}</span>
                              <span className="text-[10px] text-muted-foreground uppercase tracking-tight">{emp.designation}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-black text-primary">{emp.advanceLeaveBalance || 0} Days</TableCell>
                          <TableCell className="text-right pr-6">
                            <Button variant="ghost" size="sm" className="font-bold gap-2 text-primary hover:bg-primary/5" onClick={() => setViewLeaveHistoryEmployee(emp)}>
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
      </div>

      {/* Advance Salary Detailed View Dialog */}
      <Dialog open={!!viewAdvanceEmployee} onOpenChange={(o) => { if (!o) setViewAdvanceEmployee(null); }}>
        <DialogContent className="sm:max-w-4xl p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
          {viewAdvanceEmployee && (
            <div className="flex flex-col max-h-[90vh]">
              <DialogHeader className="py-1 px-6 bg-white border-b shrink-0 flex flex-row items-center justify-between">
                <div className="flex gap-2 items-center">
                  <div className="w-8 h-8 bg-emerald-50 rounded-xl flex items-center justify-center">
                    <Wallet className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <DialogTitle className="text-base font-black text-slate-900 leading-tight">
                      {viewAdvanceEmployee.emp.name}
                    </DialogTitle>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-0.5">
                      {viewAdvanceEmployee.emp.employeeId} • {viewAdvanceEmployee.emp.department} / {viewAdvanceEmployee.emp.designation}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Outstanding</p>
                  <Badge className="text-xs px-2 py-0.5 bg-rose-500 rounded-lg">{formatCurrency(viewAdvanceEmployee.totalRemainingAmount)}</Badge>
                </div>
              </DialogHeader>

              <div className="flex-1 overflow-hidden bg-slate-50/30">
                <ScrollArea className="h-full w-full custom-blue-scrollbar" tabIndex={0}>
                  <div className="p-4">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <Table className="min-w-[800px]">
                        <TableHeader className="bg-slate-50 sticky top-0 z-10">
                          <TableRow>
                            <TableHead className="font-black text-[9px] uppercase tracking-widest px-2 h-8 whitespace-nowrap">Voucher No</TableHead>
                            <TableHead className="font-black text-[9px] uppercase tracking-widest px-2 h-8 whitespace-nowrap">Date</TableHead>
                            <TableHead className="font-black text-[9px] uppercase tracking-widest px-2 text-right h-8 whitespace-nowrap">Amount</TableHead>
                            <TableHead className="font-black text-[9px] uppercase tracking-widest px-2 h-8 whitespace-nowrap">Slip No</TableHead>
                            <TableHead className="font-black text-[9px] uppercase tracking-widest px-2 h-8 whitespace-nowrap">Month</TableHead>
                            <TableHead className="font-black text-[9px] uppercase tracking-widest px-2 text-right text-primary h-8 whitespace-nowrap">Adjusted</TableHead>
                            <TableHead className="font-black text-[9px] uppercase tracking-widest px-2 text-right pr-4 text-rose-600 h-8 whitespace-nowrap">Remaining</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {viewAdvanceEmployee.vouchers.map((v: any, idx: number) => (
                            <TableRow key={idx} className="hover:bg-slate-50/50 transition-colors">
                              <TableCell className="px-2 py-1.5 font-mono font-black text-primary text-[10px] whitespace-nowrap">{v.voucherNo}</TableCell>
                              <TableCell className="px-2 py-1.5 text-[10px] font-medium text-slate-500 whitespace-nowrap">{v.date ? format(parseISO(v.date), 'dd-MMM-yy') : "--"}</TableCell>
                              <TableCell className="px-2 py-1.5 text-right font-bold text-slate-900 text-xs whitespace-nowrap">{formatCurrency(v.amount)}</TableCell>
                              <TableCell className="px-2 py-1.5 font-mono font-bold text-slate-600 text-[9px] whitespace-nowrap">{v.slipNo}</TableCell>
                              <TableCell className="px-2 py-1.5 whitespace-nowrap">
                                <Badge variant="outline" className="text-[8px] font-black uppercase bg-slate-50 px-1.5 h-4">{v.slipMonth}</Badge>
                              </TableCell>
                              <TableCell className="px-2 py-1.5 text-right font-black text-primary text-[10px] whitespace-nowrap">{formatCurrency(v.recovered)}</TableCell>
                              <TableCell className="px-2 py-1.5 text-right pr-4 font-black text-rose-600 text-[10px] whitespace-nowrap">{formatCurrency(v.remaining)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                  <ScrollBar orientation="horizontal" className="h-2" />
                </ScrollArea>
              </div>

              <div className="py-0.5 px-6 bg-white border-t flex justify-end shrink-0">
                <Button variant="ghost" className="h-6 px-4 font-bold text-slate-400 hover:bg-slate-50 rounded-lg text-[10px]" onClick={() => setViewAdvanceEmployee(null)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Advance Leave History Dialog */}
      <Dialog open={!!viewLeaveHistoryEmployee} onOpenChange={(o) => { if (!o) setViewLeaveHistoryEmployee(null); }}>
        <DialogContent className="sm:max-w-5xl p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
          {viewLeaveHistoryEmployee && (
            <div className="flex flex-col max-h-[90vh]">
              <DialogHeader className="py-1 px-6 bg-white border-b shrink-0 flex flex-row items-center justify-between">
                <div className="flex gap-2 items-center">
                  <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center">
                    <History className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <DialogTitle className="text-base font-black text-slate-900 leading-tight">
                      {viewLeaveHistoryEmployee.name}
                    </DialogTitle>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-0.5">
                      {viewLeaveHistoryEmployee.employeeId} • {viewLeaveHistoryEmployee.department} / {viewLeaveHistoryEmployee.designation}
                    </p>
                  </div>
                </div>
              </DialogHeader>

              <div className="flex-1 overflow-hidden bg-slate-50/30">
                <ScrollArea className="h-full w-full custom-blue-scrollbar" tabIndex={0}>
                  <div className="p-4">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <Table className="min-w-[800px]">
                        <TableHeader className="bg-slate-50 sticky top-0 z-10">
                          <TableRow>
                            <TableHead className="font-black text-[9px] uppercase tracking-widest px-4 h-8 whitespace-nowrap">Month</TableHead>
                            <TableHead className="font-black text-[9px] uppercase tracking-widest text-center h-8 whitespace-nowrap">Add Leave</TableHead>
                            <TableHead className="font-black text-[9px] uppercase tracking-widest text-center h-8 whitespace-nowrap">Adjust Leave</TableHead>
                            <TableHead className="font-black text-[9px] uppercase tracking-widest text-center h-8 text-primary bg-primary/5 whitespace-nowrap">Remaining Leave</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {leaveHistoryData.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center py-12 text-muted-foreground font-medium italic text-xs">No leave adjustments recorded yet.</TableCell>
                            </TableRow>
                          ) : (
                            leaveHistoryData.map((row, idx) => (
                              <TableRow key={idx} className="hover:bg-slate-50/50 transition-colors">
                                <TableCell className="px-4 py-2 font-bold text-slate-700 text-[10px] whitespace-nowrap">{row.month}</TableCell>
                                <TableCell className="text-center whitespace-nowrap">
                                  <Badge variant="outline" className={cn("font-black px-2 h-4 text-[9px]", row.addLeave > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "text-slate-300")}>
                                    {row.addLeave > 0 ? `+${row.addLeave}` : "0"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center whitespace-nowrap">
                                  <Badge variant="outline" className={cn("font-black px-2 h-4 text-[9px]", row.adjustLeave > 0 ? "bg-rose-50 text-rose-700 border-rose-200" : "text-slate-300")}>
                                    {row.adjustLeave > 0 ? `-${row.adjustLeave}` : "0"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center font-black text-primary bg-primary/5 text-sm whitespace-nowrap">
                                  {row.remainingLeave} Days
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                  <ScrollBar orientation="horizontal" className="h-2" />
                </ScrollArea>
              </div>

              <div className="py-0.5 px-6 bg-white border-t flex justify-end shrink-0">
                <Button variant="ghost" className="h-6 px-4 font-bold text-slate-400 hover:bg-slate-50 rounded-lg text-[10px]" onClick={() => setViewLeaveHistoryEmployee(null)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Adjust Leave Dialog */}
      <Dialog open={!!adjustLeaveEmp} onOpenChange={(o) => { if (!o) setAdjustLeaveEmp(null); }}>
        <DialogContent className="sm:max-w-4xl p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
          {adjustLeaveEmp && (
            <div className="flex flex-col max-h-[90vh]">
              <DialogHeader className="py-1 px-6 bg-white border-b shrink-0 flex flex-row items-center justify-between">
                <div className="flex gap-2 items-center">
                  <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <DialogTitle className="text-base font-black text-slate-900 leading-tight">
                      {adjustLeaveEmp.name}
                    </DialogTitle>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-0.5">
                      {adjustLeaveEmp.employeeId} • {adjustLeaveEmp.department} / {adjustLeaveEmp.designation}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Remaining Balance</p>
                  <Badge className="text-xs px-2 py-0.5 bg-emerald-500 hover:bg-emerald-600 rounded-lg">{adjustmentState.remainingBalance} Days</Badge>
                </div>
              </DialogHeader>

              <div className="grid grid-cols-3 gap-0 border-b bg-slate-50/50 shrink-0">
                <div className="py-1.5 px-6 border-r border-slate-200/60 text-center">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Salary Month</p>
                  <p className="text-xs font-black text-slate-700">{selectedMonth}</p>
                </div>
                <div className="py-1.5 px-6 border-r border-slate-200/60 text-center">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Working Days</p>
                  <p className="text-xs font-black text-slate-700">{adjustmentState.monthWorkingDays} Days</p>
                </div>
                <div className="py-1.5 px-6 text-center">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Holidays</p>
                  <p className="text-xs font-black text-slate-700">{adjustmentState.monthHolidays} Days</p>
                </div>
              </div>

              <div className="flex-1 p-4 overflow-y-auto bg-slate-50/30">
                <div className="space-y-4">
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="font-black text-[9px] uppercase tracking-widest px-4 h-8">Metric</TableHead>
                          <TableHead className="font-black text-[9px] uppercase tracking-widest text-center h-8">Days</TableHead>
                          <TableHead className="font-black text-[9px] uppercase tracking-widest text-right pr-4 h-8">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="px-4 py-2 font-bold text-slate-700 text-xs">Present on Working Days</TableCell>
                          <TableCell className="text-center font-black text-emerald-600 text-sm">{adjustmentState.present}</TableCell>
                          <TableCell className="text-right pr-4">
                            {adjustmentState.present < adjustmentState.monthWorkingDays && (
                              <Button variant="outline" size="sm" className="font-bold text-[9px] gap-1 h-7 px-2 rounded-lg" onClick={handleOpenSubAdjustment}>
                                <PlusCircle className="w-3 h-3 text-primary" /> Adjust Leave
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                        
                        <TableRow className={cn(adjustmentState.holidayWork > 0 ? "bg-amber-50/30" : "")}>
                          <TableCell className={cn("px-4 py-2 font-bold text-xs", adjustmentState.holidayWork > 0 ? "text-amber-700" : "text-slate-700")}>Working on Holiday</TableCell>
                          <TableCell className={cn("text-center font-black text-sm", adjustmentState.holidayWork > 0 ? "text-amber-600" : "text-slate-400")}>{adjustmentState.holidayWork}</TableCell>
                          <TableCell className="text-right pr-4">
                            {adjustmentState.holidayWork > 0 && (
                              <div className="flex justify-end gap-1.5">
                                <Button variant="secondary" size="sm" className="font-bold text-[8px] uppercase bg-white border border-slate-200 h-6 px-1.5" onClick={handleBankHolidayWork}>Add in Adv. Leave</Button>
                                <Button variant="secondary" size="sm" className="font-bold text-[8px] uppercase bg-amber-500 hover:bg-amber-600 text-white h-6 px-1.5" onClick={handlePayHolidayWork}>Pay Holiday Work</Button>
                              </div>
                            )}
                            {adjustmentState.holidayWork <= 0 && "---"}
                          </TableCell>
                        </TableRow>

                        <TableRow>
                          <TableCell className="px-4 py-2 font-bold text-slate-700 text-xs">Total Absent</TableCell>
                          <TableCell className="text-center font-black text-rose-500 text-sm">{adjustmentState.absent}</TableCell>
                          <TableCell className="text-right pr-4">---</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  <div className="p-3 bg-slate-900 rounded-xl flex items-center justify-between shadow-md">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                        <Calculator className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-[8px] font-black text-emerald-400/60 uppercase tracking-widest leading-none mb-0.5">Total Earning Days</p>
                        <h3 className="text-xl font-black text-white leading-none">{adjustmentState.earningDays}</h3>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-1 px-6 bg-white border-t flex justify-end gap-2 shrink-0">
                <Button variant="ghost" className="h-8 px-6 font-bold text-rose-500 hover:bg-rose-50 rounded-lg text-xs" onClick={() => setAdjustLeaveEmp(null)}>Cancel</Button>
                <Button className="h-8 px-10 bg-primary hover:bg-primary/90 font-black rounded-lg shadow-sm text-xs" onClick={handlePostAdjustment} disabled={isProcessing}>
                  {isProcessing ? "Finalizing..." : "Post Adjustment"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Disburse Salary Dialog */}
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

      {/* Disburse PF Dialog */}
      <Dialog open={!!payPFRec} onOpenChange={(o) => { if (!o) setPayPFRec(null); }}>
        <DialogContent className="sm:max-w-md">
          {payPFRec && (
            <>
              <DialogHeader>
                <DialogTitle>Disburse PF Contribution</DialogTitle>
                <DialogDescription>Record PF payment for {payPFRec.employeeName} ({payPFRec.month})</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Employee PF (INR)</Label>
                    <Input type="number" value={pfPaidEmp} onChange={(e) => setPfPaidEmp(parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Employer PF (INR)</Label>
                    <Input type="number" value={pfPaidEx} onChange={(e) => setPfPaidEx(parseFloat(e.target.value) || 0)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Payment Date</Label>
                  <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Ref No (Challan / Trans ID)</Label>
                  <Input placeholder="Enter reference..." value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPayPFRec(null)}>Cancel</Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700 font-bold px-8" onClick={handlePostPFPayment} disabled={isProcessing}>Confirm PF Payment</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Disburse ESIC Dialog */}
      <Dialog open={!!payESICRec} onOpenChange={(o) => { if (!o) setPayESICRec(null); }}>
        <DialogContent className="sm:max-w-md">
          {payESICRec && (
            <>
              <DialogHeader>
                <DialogTitle>Disburse ESIC Contribution</DialogTitle>
                <DialogDescription>Record ESIC payment for {payESICRec.employeeName} ({payESICRec.month})</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Employee ESIC (INR)</Label>
                    <Input type="number" value={esicPaidEmp} onChange={(e) => setEsicPaidEmp(parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Employer ESIC (INR)</Label>
                    <Input type="number" value={esicPaidEx} onChange={(e) => setEsicPaidEx(parseFloat(e.target.value) || 0)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Payment Date</Label>
                  <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Ref No (Challan / Trans ID)</Label>
                  <Input placeholder="Enter reference..." value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPayESICRec(null)}>Cancel</Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700 font-bold px-8" onClick={handlePostESICPayment} disabled={isProcessing}>Confirm ESIC Payment</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Sub-Adjustment Dialog for Leave Adjustment */}
      <Dialog open={isSubAdjustmentOpen} onOpenChange={setIsSubAdjustmentOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black flex items-center gap-2"><MinusCircle className="w-5 h-5 text-rose-500" /> Adjust From Advance Leave</DialogTitle>
            <DialogDescription>How many days would you like to take from the employee's advance balance?</DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Available Balance</Label>
              <div className="h-12 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center px-4 font-black text-emerald-700">{adjustmentState.remainingBalance} Days</div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Adjust Days *</Label>
              <Input 
                type="number" 
                value={subAdjustmentValue} 
                onChange={(e) => setSubAdjustmentValue(parseFloat(e.target.value) || 0)} 
                className="h-14 font-black text-xl bg-slate-50 border-slate-200 rounded-xl focus-visible:ring-primary"
                max={adjustmentState.remainingBalance}
                min={0}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setIsSubAdjustmentOpen(false)} className="rounded-xl font-bold">Cancel</Button>
            <Button onClick={handleSaveSubAdjustment} className="bg-primary rounded-xl font-black px-8">Confirm Adjustment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Salary Slip Dialog */}
      <Dialog open={!!previewSlip} onOpenChange={(o) => { if (!o) setPreviewSlip(null); }}>
        <DialogContent className="sm:max-w-5xl h-[95vh] flex flex-col p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
          <DialogHeader className="p-6 border-b bg-white flex flex-row items-center justify-between shrink-0 z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <DialogTitle className="text-xl font-black text-slate-900 tracking-tight">Salary Slip Preview</DialogTitle>
            </div>
            <div className="flex items-center gap-3 mr-8">
              <Button 
                className="bg-primary hover:bg-primary/90 font-black gap-2 px-8 h-12 rounded-xl shadow-lg shadow-primary/20" 
                onClick={() => handleDownloadAndPrint(previewSlip!)}
              >
                <Download className="w-5 h-5" /> Download PDF
              </Button>
              <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 hover:bg-slate-100" onClick={() => setPreviewSlip(null)}>
                <X className="h-5 h-5" />
              </Button>
            </div>
          </DialogHeader>
          
          <ScrollArea className="flex-1 bg-slate-50/50 p-4 sm:p-10 custom-blue-scrollbar">
            <div className="max-w-[210mm] mx-auto bg-white shadow-2xl p-8 min-h-[297mm] border-2 border-slate-200 rounded-sm">
              {previewSlip && <SalarySlipContent payroll={previewSlip} employees={employees} firms={firms} plants={plants} />}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {isMounted && printSlip && createPortal(
        <div className="print-only">
          <SalarySlipContent payroll={printSlip} employees={employees} firms={firms} plants={plants} />
        </div>,
        document.body
      )}
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
       <div className="text-center border-b-2 border-slate-900 pb-4">
         <h1 className="text-2xl font-black uppercase tracking-tight">{firm?.name || "SIKKA INDUSTRIES & LOGISTICS"}</h1>
         <p className="text-xs font-bold text-slate-500 italic">{firm?.registeredAddress}</p>
         <h2 className="text-lg font-black mt-2 underline decoration-1 underline-offset-4">PAYSLIP FOR THE MONTH OF {fullMonth.toUpperCase()}</h2>
       </div>
       
       <div className="grid grid-cols-2 border-x-2 border-b-2 border-slate-900 text-sm">
         <SlipRow label="Employee ID" value={payroll.employeeId} />
         <SlipRow label="Employee Name" value={payroll.employeeName} />
         <SlipRow label="Department" value={emp?.department} />
         <SlipRow label="Designation" value={emp?.designation} />
         <SlipRow label="Aadhaar No" value={emp?.aadhaar} />
         <SlipRow label="Monthly CTC" value={formatCurrency(emp?.salary?.monthlyCTC || 0)} />
       </div>

       <div className="grid grid-cols-2 mt-8 border-2 border-slate-900 font-bold">
         <div className="border-r-2 border-slate-900 p-2 bg-slate-50 text-center uppercase tracking-widest text-xs">Earnings</div>
         <div className="p-2 bg-slate-50 text-center uppercase tracking-widest text-xs">Deductions / Adjustments</div>
       </div>

       <div className="grid grid-cols-2 border-x-2 border-b-2 border-slate-900">
         <div className="border-r-2 border-slate-900">
           <SlipRow label="Basic Salary" value={formatCurrency(emp?.salary?.basic || 0)} />
           <SlipRow label="HRA" value={formatCurrency(emp?.salary?.hra || 0)} />
           <SlipRow label="Incentive" value={formatCurrency(payroll.incentiveAmt || 0)} />
           <SlipRow label="Holiday Work" value={formatCurrency(payroll.holidayWorkAmt || 0)} />
           <SlipRow label="Earning Days" value={payroll.totalEarningDays} />
         </div>
         <div>
           <SlipRow label="Advance Recovery" value={formatCurrency(payroll.advanceRecovery || 0)} />
           <SlipRow label="Absent Days" value={payroll.absent} />
         </div>
       </div>

       <div className="bg-slate-900 text-white p-4 flex justify-between items-center mt-10">
         <span className="font-black uppercase tracking-[0.2em] text-[10px]">Total Net Payable (Earning Days: {payroll.totalEarningDays})</span>
         <span className="text-3xl font-black">{formatCurrency(payroll.netPayable)}</span>
       </div>
       
       <div className="mt-4 p-2 bg-slate-50 border border-slate-200 italic text-xs">
         <strong>In Words:</strong> {numberToIndianWords(payroll.netPayable)}
       </div>

       <div className="mt-8 p-4 bg-slate-50 border border-slate-100 rounded-xl text-center">
         <p className="text-[10px] font-bold text-slate-500 italic">
           Note: This is an auto-generated monthly salary slip of the employee and is considered a valid original document.
         </p>
       </div>

       <div className="flex justify-between items-end mt-24 px-10">
          <div className="text-center space-y-2">
            <div className="w-48 border-b-2 border-slate-900" />
            <p className="text-[10px] font-black uppercase">Employee Signature</p>
          </div>
          <div className="text-center space-y-2">
            <div className="w-48 border-b-2 border-slate-900" />
            <p className="text-[10px] font-black uppercase tracking-widest">Authorized Signatory</p>
          </div>
       </div>
    </div>
  );
}

function SlipRow({ label, value }: { label: string, value: any }) {
  return (
    <div className="flex justify-between border-b border-slate-200 p-2 px-4 last:border-b-0">
      <span className="font-bold text-[11px] text-slate-500 uppercase">{label}</span>
      <span className="font-black text-xs">{value || "---"}</span>
    </div>
  );
}
