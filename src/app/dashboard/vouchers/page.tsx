
"use client";

import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Wallet, 
  CreditCard, 
  Search, 
  XCircle, 
  CheckCircle, 
  Building2, 
  FileCheck, 
  AlertTriangle,
  Printer,
  Eye,
  Download,
  User as UserIcon,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  X,
  History,
  ArrowRightCircle,
  Filter,
  CheckCircle2
} from "lucide-react";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCurrency, numberToIndianWords, cn } from "@/lib/utils";
import { useData } from "@/context/data-context";
import { Voucher } from "@/lib/types";
import { format, parseISO, isBefore, startOfMonth } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

const PROJECT_START_DATE_STR = "2026-04-01";
const PROJECT_START_DATE = new Date(2026, 3, 1);

const generateVoucherMonths = () => {
  const options = [];
  const date = new Date();
  
  for (let i = 0; i < 120; i++) {
    const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
    if (isBefore(d, startOfMonth(PROJECT_START_DATE))) break;
    
    const mmm = d.toLocaleString('en-US', { month: 'short' });
    const yy = d.getFullYear().toString().slice(-2);
    options.push(`${mmm}-${yy}`);
  }
  return options;
};

const VOUCHER_MONTHS = generateVoucherMonths();

export default function VouchersPage() {
  const { employees, firms, plants, vouchers, payrollRecords, addRecord, updateRecord, deleteRecord } = useData();
  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState("create");
  const [searchTerm, setSearchTerm] = useState("");
  const [voucherDate, setVoucherDate] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const { toast } = useToast();

  const [pendingPage, setPendingPage] = useState(1);
  const [payablePage, setPayablePage] = useState(1);
  const [paidPage, setPaidPage] = useState(1);
  const rowsPerPage = 10;

  const [paidFromMonth, setPaidFromMonth] = useState("");
  const [paidToMonth, setPaidToMonth] = useState("");

  const [previewVoucher, setPreviewVoucher] = useState<Voucher | null>(null);
  const [printVoucher, setPrintVoucher] = useState<Voucher | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const [voucherToReject, setVoucherToReject] = useState<string | null>(null);

  const [isPayDialogOpen, setIsPayDialogOpen] = useState(false);
  const [voucherToPay, setVoucherToPay] = useState<Voucher | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState("");
  const [payMode, setPayMode] = useState<'CASH' | 'BANKING'>('BANKING');
  const [payRef, setPayRef] = useState("");

  useEffect(() => {
    setIsMounted(true);
    const today = new Date().toISOString().split('T')[0];
    setVoucherDate(today < PROJECT_START_DATE_STR ? PROJECT_START_DATE_STR : today);
    const savedUser = localStorage.getItem("user");
    if (savedUser) setCurrentUser(JSON.parse(savedUser));
    
    const initialMonth = VOUCHER_MONTHS[0] || "";
    setPaidFromMonth(initialMonth);
    setPaidToMonth(initialMonth);
  }, []);

  const voucherNo = useMemo(() => {
    if (!voucherDate) return "SIL-XXXXXX-XXXXX";
    const d = new Date(voucherDate);
    if (isNaN(d.getTime())) return "SIL-XXXXXX-XXXXX";
    const month = d.getMonth();
    const year = d.getFullYear();
    const startYear = month < 3 ? year - 1 : year;
    const endYear = startYear + 1;
    const fyPrefix = `${startYear}${(endYear % 100).toString().padStart(2, '0')}`;
    const fyFullPrefix = `SIL-${fyPrefix}-`;
    const sameFYVouchers = (vouchers || []).filter(v => v.voucherNo.startsWith(fyFullPrefix));
    let nextSerial = 1;
    if (sameFYVouchers.length > 0) {
      const serials = sameFYVouchers.map(v => {
        const parts = v.voucherNo.split('-');
        return parts.length === 3 ? parseInt(parts[2]) || 0 : 0;
      });
      nextSerial = Math.max(...serials) + 1;
    }
    return `${fyFullPrefix}${nextSerial.toString().padStart(5, '0')}`;
  }, [voucherDate, vouchers]);

  const filteredPendingVouchers = useMemo(() => {
    return (vouchers || [])
      .filter(v => v.status === 'PENDING' && v.date >= PROJECT_START_DATE_STR)
      .filter(v => {
        const emp = employees.find(e => e.id === v.employeeId);
        const search = searchTerm.toLowerCase();
        return (
          v.voucherNo.toLowerCase().includes(search) ||
          (emp?.name || "").toLowerCase().includes(search) ||
          (emp?.employeeId || "").toLowerCase().includes(search)
        );
      }).reverse();
  }, [vouchers, searchTerm, employees]);

  const voucherRecoveryLedger = useMemo(() => {
    if (!isMounted) return [];
    
    const recoveryMap: Record<string, any> = {};
    const empIds = Array.from(new Set(vouchers.map(v => v.employeeId)));

    empIds.forEach(empId => {
      const empVouchers = [...vouchers]
        .filter(v => v.employeeId === empId && v.status === 'PAID')
        .sort((a,b) => a.date.localeCompare(b.date));
      
      const empObj = employees.find(e => e.id === empId);
      const empPayroll = payrollRecords
        .filter(p => p.employeeId === empObj?.employeeId)
        .sort((a, b) => (a.slipDate || "").localeCompare(b.slipDate || ""));

      let slipPool = empPayroll.map(p => ({...p, remainingPool: p.advanceRecovery || 0}));

      empVouchers.forEach(v => {
        let recoveredAmt = 0;
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
            recoveredAmt += take;
            lastSlipNo = slip.slipNo || "--";
            lastSlipDate = slip.slipDate || "--";
            lastSlipMonth = slip.month || "--";
          }
        }

        recoveryMap[v.id] = {
          recovered: recoveredAmt,
          remaining: v.amount - recoveredAmt,
          slipNo: lastSlipNo,
          slipDate: lastSlipDate,
          slipMonth: lastSlipMonth
        };
      });
    });

    return (vouchers || [])
      .filter(v => (v.status === 'APPROVED' || v.status === 'PAID') && v.date >= PROJECT_START_DATE_STR)
      .map(v => ({
        ...v,
        recovery: recoveryMap[v.id] || { recovered: 0, remaining: v.amount, slipNo: "--", slipDate: "--", slipMonth: "--" }
      }));
  }, [vouchers, payrollRecords, employees, isMounted]);

  const paymentTabLists = useMemo(() => {
    const search = searchTerm.toLowerCase();
    
    const allRelevant = voucherRecoveryLedger.filter(v => {
      const emp = employees.find(e => e.id === v.employeeId);
      return (
        v.voucherNo.toLowerCase().includes(search) ||
        (emp?.name || "").toLowerCase().includes(search) ||
        (emp?.employeeId || "").toLowerCase().includes(search)
      );
    }).reverse();

    const pending = allRelevant.filter(v => v.status === 'APPROVED');
    
    // Paid History Filtering
    const monthOrder = [...VOUCHER_MONTHS].reverse();
    const fromIdx = monthOrder.indexOf(paidFromMonth);
    const toIdx = monthOrder.indexOf(paidToMonth);

    const paid = allRelevant.filter(v => {
      if (v.status !== 'PAID') return false;
      const d = parseISO(v.date);
      const mmm = d.toLocaleString('en-US', { month: 'short' });
      const yy = d.getFullYear().toString().slice(-2);
      const voucherMonth = `${mmm}-${yy}`;
      const vIdx = monthOrder.indexOf(voucherMonth);
      
      return fromIdx !== -1 && toIdx !== -1 && vIdx >= fromIdx && vIdx <= toIdx;
    });

    return { pending, paid };
  }, [voucherRecoveryLedger, searchTerm, employees, paidFromMonth, paidToMonth]);

  const paginatedPending = useMemo(() => {
    const start = (pendingPage - 1) * rowsPerPage;
    return filteredPendingVouchers.slice(start, start + rowsPerPage);
  }, [filteredPendingVouchers, pendingPage]);

  const paginatedPayable = useMemo(() => {
    const start = (payablePage - 1) * rowsPerPage;
    return paymentTabLists.pending.slice(start, start + rowsPerPage);
  }, [paymentTabLists.pending, payablePage]);

  const paginatedPaid = useMemo(() => {
    const start = (paidPage - 1) * rowsPerPage;
    return paymentTabLists.paid.slice(start, start + rowsPerPage);
  }, [paymentTabLists.paid, paidPage]);

  const totalPendingPages = Math.ceil(filteredPendingVouchers.length / rowsPerPage);
  const totalPayablePages = Math.ceil(paymentTabLists.pending.length / rowsPerPage);
  const totalPaidPages = Math.ceil(paymentTabLists.paid.length / rowsPerPage);

  const handleCreateVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeId || !amount || !purpose) {
      toast({ variant: "destructive", title: "Missing Fields", description: "Mandatory fields required." });
      return;
    }
    
    if (voucherDate < PROJECT_START_DATE_STR) {
      toast({ variant: "destructive", title: "Invalid Date", description: `Project boundary is ${PROJECT_START_DATE_STR}.` });
      return;
    }

    const emp = employees.find(e => e.id === selectedEmployeeId);
    const newVoucher = {
      voucherNo: voucherNo, 
      employeeId: selectedEmployeeId,
      date: voucherDate,
      amount: parseFloat(amount),
      purpose: purpose,
      status: "PENDING",
      createdByName: currentUser?.fullName || "Admin"
    };
    addRecord('vouchers', newVoucher);
    addRecord('notifications', {
      message: `Voucher Created: ${voucherNo} for ${emp?.name} (${formatCurrency(parseFloat(amount))})`,
      timestamp: format(new Date(), "yyyy-MM-dd HH:mm:ss"),
      read: false
    });
    toast({ title: "Voucher Created", description: `Voucher #${voucherNo} generated.` });
    setSelectedEmployeeId("");
    setAmount("");
    setPurpose("");
    setActiveTab("approve");
  };

  const handleApproveVoucher = (v: Voucher) => {
    updateRecord('vouchers', v.id, { 
      status: 'APPROVED', 
      approvedByName: currentUser?.fullName || "Admin" 
    });
    addRecord('notifications', {
      message: `Voucher Approved: ${v.voucherNo} by ${currentUser?.fullName || "Admin"}`,
      timestamp: format(new Date(), "yyyy-MM-dd HH:mm:ss"),
      read: false
    });
    toast({ title: "Voucher Approved" });
  };

  const handleRejectConfirm = () => {
    if (!voucherToReject) return;
    const v = vouchers.find(x => x.id === voucherToReject);
    deleteRecord('vouchers', voucherToReject);
    if (v) {
      addRecord('notifications', {
        message: `Voucher Rejected: ${v.voucherNo} by ${currentUser?.fullName || "Admin"}`,
        timestamp: format(new Date(), "yyyy-MM-dd HH:mm:ss"),
        read: false
      });
    }
    toast({ variant: "destructive", title: "Voucher Rejected" });
    setVoucherToReject(null);
  };

  const handleOpenPayDialog = (v: Voucher) => {
    setVoucherToPay(v);
    setPayAmount(v.amount.toString());
    setPayDate(new Date().toISOString().split('T')[0]);
    setPayMode('BANKING');
    setPayRef("");
    setIsPayDialogOpen(true);
  };

  const handleConfirmPayment = () => {
    if (!voucherToPay) return;
    updateRecord('vouchers', voucherToPay.id, { 
      status: 'PAID',
      date: payDate,
      amount: parseFloat(payAmount),
      paymentMode: payMode,
      paymentReference: payMode === 'BANKING' ? payRef : ""
    });
    addRecord('notifications', {
      message: `Voucher Paid: ${voucherToPay.voucherNo} (${formatCurrency(parseFloat(payAmount))}) via ${payMode}`,
      timestamp: format(new Date(), "yyyy-MM-dd HH:mm:ss"),
      read: false
    });
    toast({ title: "Payment Recorded" });
    setIsPayDialogOpen(false);
    setVoucherToPay(null);
  };

  const handleDownloadPDF = (v: Voucher) => {
    if (!v) return;
    const originalTitle = document.title;
    document.title = v.voucherNo || "Voucher_Slip";
    setPrintVoucher(v);
    toast({ title: "Document Ready", description: "Preparing Voucher for A4 Print..." });
    
    setTimeout(() => {
      window.focus();
      window.print();
      document.title = originalTitle;
      setTimeout(() => setPrintVoucher(null), 1000);
    }, 500);
  };

  const handleExportPaidExcel = () => {
    const data = paymentTabLists.paid;
    if (data.length === 0) {
      toast({ variant: "destructive", title: "No Data", description: "No paid records for selected range." });
      return;
    }

    const headers = [
      "Voucher No", "Employee Name", "Employee ID", "Date", "Amount",
      "Recovery Amt", "Balance", "Recovery Slip", "Slip Date", "Slip Month",
      "Payment Mode", "Reference"
    ];

    const csvRows = [
      headers.join(","),
      ...data.map(v => {
        const emp = employees.find(e => e.id === v.employeeId);
        return [
          `"${v.voucherNo}"`, `"${emp?.name}"`, `"${emp?.employeeId}"`, `"${v.date}"`, v.amount,
          v.recovery.recovered, v.recovery.remaining, `"${v.recovery.slipNo}"`, `"${v.recovery.slipDate}"`, `"${v.recovery.slipMonth}"`,
          `"${v.paymentMode || ''}"`, `"${v.paymentReference || ''}"`
        ].join(",");
      })
    ];

    const blob = new Blob([csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Paid_Vouchers_${paidFromMonth}_to_${paidToMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Export Success" });
  };

  if (!isMounted) return null;

  return (
    <TooltipProvider>
      <div className="space-y-6 print:hidden">
        <div>
          <h1 className="text-2xl font-bold">Advance Voucher System</h1>
          <p className="text-muted-foreground">Manage employee advance payments (Since April-2026).</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-xl grid-cols-3 mb-8 bg-slate-100 p-1 rounded-xl h-12">
            <TabsTrigger value="create" className="font-semibold rounded-lg">Create Voucher</TabsTrigger>
            <TabsTrigger value="approve" className="font-semibold rounded-lg">Approve Voucher</TabsTrigger>
            <TabsTrigger value="payment" className="font-semibold rounded-lg">Voucher Payments</TabsTrigger>
          </TabsList>

          <TabsContent value="create">
            <Card className="max-w-4xl mx-auto shadow-xl border-none">
              <CardHeader className="bg-slate-50 border-b border-slate-100 rounded-t-xl flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg"><Wallet className="text-primary w-5 h-5" /></div>
                  <CardTitle>Generate New Voucher</CardTitle>
                </div>
                <div className="flex items-center gap-2 px-4 py-1.5 bg-white border border-slate-200 rounded-full shadow-sm">
                  <UserIcon className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Voucher Create by:</span>
                  <span className="text-xs font-bold text-primary">{currentUser?.fullName || "..."}</span>
                </div>
              </CardHeader>
              <form onSubmit={handleCreateVoucher}>
                <CardContent className="p-8 space-y-8">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <Label className="font-bold">Voucher Number</Label>
                      <Input value={voucherNo} disabled className="bg-slate-100 font-mono font-bold h-12 text-primary" />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bold">Date *</Label>
                      <Input type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} className="h-12 bg-white" min={PROJECT_START_DATE_STR} required />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bold">Select Employee *</Label>
                      <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId} required>
                        <SelectTrigger className="h-12 bg-white"><SelectValue placeholder="Select Employee" /></SelectTrigger>
                        <SelectContent>
                          {employees.map(emp => (
                            <SelectItem key={emp.id} value={emp.id}>{emp.name} ({emp.employeeId})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bold text-emerald-600">Advance Amount (INR) *</Label>
                      <Input type="number" placeholder="Enter amount" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-12 bg-white font-bold" required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold">Purpose of Advance *</Label>
                    <Input placeholder="Reason for advance..." value={purpose} onChange={(e) => setPurpose(e.target.value)} className="h-12 bg-white" required />
                  </div>
                </CardContent>
                <CardFooter className="bg-slate-50 border-t border-slate-100 rounded-b-xl flex justify-end gap-3 p-6">
                  <Button variant="outline" type="button" onClick={() => setActiveTab("approve")}>Cancel</Button>
                  <Button className="px-12 h-12 font-bold shadow-lg shadow-primary/20 bg-primary">Create Voucher</Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>

          <TabsContent value="approve">
            <Card className="shadow-sm border-slate-200 overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-50 rounded-lg"><FileCheck className="w-5 h-5 text-amber-600" /></div>
                    <CardTitle className="text-lg">Pending Approvals</CardTitle>
                  </div>
                  <div className="relative w-80">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search..." className="pl-10 h-10 bg-white" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setPendingPage(1); }} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="font-bold">Voucher No</TableHead>
                      <TableHead className="font-bold">Employee Name</TableHead>
                      <TableHead className="font-bold">Dept / Designation</TableHead>
                      <TableHead className="font-bold">Date</TableHead>
                      <TableHead className="font-bold">Amount</TableHead>
                      <TableHead className="text-right font-bold pr-6">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedPending.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No pending requests found.</TableCell></TableRow>
                    ) : (
                      paginatedPending.map((v) => {
                        const emp = employees.find(e => e.id === v.employeeId);
                        return (
                          <TableRow key={v.id} className="hover:bg-slate-50/50">
                            <TableCell className="font-mono font-bold text-primary">{v.voucherNo}</TableCell>
                            <TableCell className="font-bold uppercase">{emp?.name || "..."}</TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-slate-600">{emp?.department || "--"}</span>
                                <span className="text-[10px] text-muted-foreground uppercase">{emp?.designation || "--"}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">{v.date ? format(parseISO(v.date), 'dd-MMM-yyyy') : "--"}</TableCell>
                            <TableCell className="font-bold text-emerald-600">{formatCurrency(v.amount)}</TableCell>
                            <TableCell className="text-right pr-6">
                              <div className="flex justify-end gap-2">
                                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-8 font-bold" onClick={() => handleApproveVoucher(v)}>Approve</Button>
                                <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50 h-8 font-bold" onClick={() => setVoucherToReject(v.id)}>Reject</Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
              {totalPendingPages > 1 && (
                <CardFooter className="bg-slate-50 border-t flex items-center justify-between p-4">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={pendingPage === 1} onClick={() => setPendingPage(p => p - 1)}><ChevronLeft className="w-4 h-4" /> Previous</Button>
                    <Button variant="outline" size="sm" disabled={pendingPage === totalPendingPages} onClick={() => setPendingPage(p => p + 1)}>Next <ChevronRight className="w-4 h-4" /></Button>
                  </div>
                  <span className="text-xs font-bold text-muted-foreground">Page {pendingPage} of {totalPendingPages}</span>
                </CardFooter>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="payment" className="space-y-12">
            <Card className="shadow-sm border-slate-200 overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg"><CreditCard className="w-5 h-5 text-primary" /></div>
                    <CardTitle className="text-lg">Ready for Payment (Approved)</CardTitle>
                  </div>
                  <div className="relative w-80">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search..." className="pl-10 h-10 bg-white" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setPayablePage(1); }} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="w-full">
                  <Table className="min-w-[1300px]">
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="font-bold">Voucher No</TableHead>
                        <TableHead className="font-bold">Employee Name</TableHead>
                        <TableHead className="font-bold">Date</TableHead>
                        <TableHead className="font-bold text-right">Amount</TableHead>
                        <TableHead className="text-right font-bold pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedPayable.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground font-medium">No approved vouchers pending payment.</TableCell></TableRow>
                      ) : (
                        paginatedPayable.map((v) => {
                          const emp = employees.find(e => e.id === v.employeeId);
                          return (
                            <TableRow key={v.id} className="hover:bg-slate-50/50">
                              <TableCell className="font-mono font-bold text-primary cursor-pointer hover:underline" onClick={() => { setPreviewVoucher(v); setIsPreviewOpen(true); }}>{v.voucherNo}</TableCell>
                              <TableCell className="font-bold uppercase">{emp?.name || "..."}</TableCell>
                              <TableCell className="text-sm">{v.date ? format(parseISO(v.date), 'dd-MMM-yyyy') : "--"}</TableCell>
                              <TableCell className="text-right font-bold text-emerald-600">{formatCurrency(v.amount)}</TableCell>
                              <TableCell className="text-right pr-6">
                                <div className="flex justify-end gap-2">
                                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-8 font-bold" onClick={() => handleOpenPayDialog(v)}>Process Pay</Button>
                                  <Button size="sm" variant="outline" className="h-8 font-bold gap-1.5" onClick={() => handleDownloadPDF(v)}><Download className="w-3.5 h-3.5" /> PDF</Button>
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
              {totalPayablePages > 1 && (
                <CardFooter className="bg-slate-50 border-t flex items-center justify-between p-4">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={payablePage === 1} onClick={() => setPayablePage(p => p - 1)}><ChevronLeft className="w-4 h-4" /> Previous</Button>
                    <Button variant="outline" size="sm" disabled={payablePage === totalPayablePages} onClick={() => setPayablePage(p => p + 1)}>Next <ChevronRight className="w-4 h-4" /></Button>
                  </div>
                  <span className="text-xs font-bold text-muted-foreground">Page {payablePage} of {totalPayablePages}</span>
                </CardFooter>
              )}
            </Card>

            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-1">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-100 rounded-lg">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Paid Vouchers (History)</h3>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                  <div className="flex items-center gap-1 bg-white border border-slate-200 px-3 py-1 rounded-xl shadow-sm">
                    <Label className="text-[9px] font-black uppercase text-slate-400">FROM</Label>
                    <Select value={paidFromMonth} onValueChange={(val) => {
                      setPaidFromMonth(val);
                      const monthOrder = [...VOUCHER_MONTHS].reverse();
                      if (monthOrder.indexOf(paidToMonth) < monthOrder.indexOf(val)) setPaidToMonth(val);
                    }}>
                      <SelectTrigger className="h-7 w-24 border-none bg-transparent text-[10px] font-bold p-0 focus:ring-0 shadow-none"><SelectValue /></SelectTrigger>
                      <SelectContent>{VOUCHER_MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                    <div className="w-px h-4 bg-slate-200 mx-1" />
                    <Label className="text-[9px] font-black uppercase text-slate-400">TO</Label>
                    <Select value={paidToMonth} onValueChange={(val) => {
                      const monthOrder = [...VOUCHER_MONTHS].reverse();
                      if (monthOrder.indexOf(val) < monthOrder.indexOf(paidFromMonth)) {
                        toast({ variant: "destructive", title: "Range Error", description: "To Month cannot be earlier than From Month." });
                        return;
                      }
                      setPaidToMonth(val);
                    }}>
                      <SelectTrigger className="h-7 w-24 border-none bg-transparent text-[10px] font-bold p-0 focus:ring-0 shadow-none"><SelectValue /></SelectTrigger>
                      <SelectContent>{VOUCHER_MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Button variant="outline" size="sm" className="h-9 gap-2 font-bold text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={handleExportPaidExcel}>
                    <FileSpreadsheet className="w-4 h-4" /> Export Excel
                  </Button>
                </div>
              </div>

              <Card className="border-none shadow-sm overflow-hidden bg-slate-50/30">
                <CardContent className="p-0">
                  <ScrollArea className="w-full">
                    <Table className="min-w-[1800px]">
                      <TableHeader className="bg-slate-100/50">
                        <TableRow>
                          <TableHead className="font-bold">Voucher No</TableHead>
                          <TableHead className="font-bold">Employee Name</TableHead>
                          <TableHead className="font-bold">Voucher Date</TableHead>
                          <TableHead className="font-bold text-right">Amount</TableHead>
                          <TableHead className="font-bold text-right text-primary">Recovered</TableHead>
                          <TableHead className="font-bold text-right text-rose-600">Remaining</TableHead>
                          <TableHead className="font-bold">Recovery Slip</TableHead>
                          <TableHead className="font-bold">Payment Mode</TableHead>
                          <TableHead className="font-bold">Reference</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedPaid.length === 0 ? (
                          <TableRow><TableCell colSpan={9} className="text-center py-16 text-muted-foreground italic">No settled vouchers for the selected range.</TableCell></TableRow>
                        ) : (
                          paginatedPaid.map((v) => {
                            const emp = employees.find(e => e.id === v.employeeId);
                            return (
                              <TableRow key={v.id} className="hover:bg-white/50 transition-colors opacity-90 hover:opacity-100">
                                <TableCell className="font-mono font-bold text-slate-600 cursor-pointer hover:underline" onClick={() => { setPreviewVoucher(v); setIsPreviewOpen(true); }}>{v.voucherNo}</TableCell>
                                <TableCell className="font-bold uppercase text-slate-600">{emp?.name}</TableCell>
                                <TableCell className="text-xs">{v.date ? format(parseISO(v.date), 'dd-MMM-yyyy') : "--"}</TableCell>
                                <TableCell className="text-right font-bold">{formatCurrency(v.amount)}</TableCell>
                                <TableCell className="text-right font-black text-primary">{formatCurrency(v.recovery.recovered)}</TableCell>
                                <TableCell className="text-right font-black text-rose-600">{formatCurrency(v.recovery.remaining)}</TableCell>
                                <TableCell>
                                  <div className="flex flex-col">
                                    <span className="text-[10px] font-mono font-black text-slate-500">{v.recovery.slipNo}</span>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase">{v.recovery.slipMonth}</span>
                                  </div>
                                </TableCell>
                                <TableCell><Badge variant="outline" className="text-[10px] font-bold uppercase">{v.paymentMode || "---"}</Badge></TableCell>
                                <TableCell className="font-mono text-[10px] text-slate-400">{v.paymentReference || "---"}</TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </CardContent>
                {totalPaidPages > 1 && (
                  <CardFooter className="bg-slate-50 border-t flex flex-col sm:flex-row items-center justify-between p-4 gap-4">
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" disabled={paidPage === 1} onClick={() => setPaidPage(p => p - 1)} className="font-bold h-9">
                        <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                      </Button>
                      <Button variant="outline" size="sm" disabled={paidPage === totalPaidPages} onClick={() => setPaidPage(p => p + 1)} className="font-bold h-9">
                        Next <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-black text-slate-500 uppercase tracking-widest">
                        Page {paidPage} of {totalPaidPages}
                      </span>
                      <div className="flex items-center gap-2 border-l pl-4 border-slate-200">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Jump To</Label>
                        <div className="flex gap-1">
                          <Input 
                            type="number" 
                            className="w-14 h-9 text-center font-bold" 
                            value={paidPage} 
                            onChange={(e) => {
                              const p = parseInt(e.target.value);
                              if (p >= 1 && p <= totalPaidPages) setPaidPage(p);
                            }} 
                          />
                          <div className="w-9 h-9 bg-slate-900 rounded-lg flex items-center justify-center text-white">
                            <ArrowRightCircle className="w-4 h-4" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardFooter>
                )}
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <AlertDialog open={!!voucherToReject} onOpenChange={(o) => !o && setVoucherToReject(null)}>
          <AlertDialogContent className="sm:max-w-md">
            <AlertDialogHeader>
              <div className="mx-auto w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center mb-4"><AlertTriangle className="w-6 h-6 text-rose-600" /></div>
              <AlertDialogTitle className="text-center">Reject Voucher?</AlertDialogTitle>
              <AlertDialogDescription className="text-center">This action will remove the voucher request permanently.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="sm:justify-center gap-3">
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleRejectConfirm} className="bg-rose-600 hover:bg-rose-700 font-bold">Confirm Rejection</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={isPayDialogOpen} onOpenChange={setIsPayDialogOpen}>
          <DialogContent className="sm:max-w-4xl">
            <DialogHeader className="border-b pb-4">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Process Payment</span>
                <DialogTitle className="text-xl font-black text-slate-900">
                  {employees.find(e => e.id === voucherToPay?.employeeId)?.name}
                </DialogTitle>
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-primary bg-primary/5 px-2 py-1 rounded w-fit">
                  <CreditCard className="w-3 h-3" /> {voucherToPay?.voucherNo}
                </div>
              </div>
            </DialogHeader>
            <div className="py-4 divide-y divide-slate-100">
              <div className="grid grid-cols-2">
                <div className="p-6 space-y-2 border-r border-slate-100">
                  <Label className="font-black text-[10px] uppercase text-slate-500 tracking-wider">Paid Amount (INR)</Label>
                  <Input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="h-12 bg-white border-slate-200 font-black text-lg text-emerald-600" />
                </div>
                <div className="p-6 space-y-2">
                  <Label className="font-black text-[10px] uppercase text-slate-500 tracking-wider">Payment Date</Label>
                  <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className="h-12 bg-white border-slate-200 font-bold" min={PROJECT_START_DATE_STR} />
                </div>
              </div>
              <div className="grid grid-cols-2">
                <div className="p-6 space-y-2 border-r border-slate-100">
                  <Label className="font-black text-[10px] uppercase text-slate-500 tracking-wider">Payment Mode</Label>
                  <Select value={payMode} onValueChange={(v: any) => setPayMode(v)}>
                    <SelectTrigger className="h-12 bg-white border-slate-200 font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASH">Cash</SelectItem>
                      <SelectItem value="BANKING">Banking</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="p-6 space-y-2">
                  <Label className={cn("font-black text-[10px] uppercase text-slate-500 tracking-wider", payMode !== 'BANKING' && "opacity-30")}>Reference Number</Label>
                  <Input placeholder={payMode === 'BANKING' ? "UTR / Trans ID" : "N/A"} disabled={payMode !== 'BANKING'} value={payRef} onChange={(e) => setPayRef(e.target.value)} className="h-12 bg-white border-slate-200 font-bold" />
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2 border-t pt-4">
              <Button variant="ghost" onClick={() => setIsPayDialogOpen(false)} className="rounded-xl font-bold h-11">Cancel</Button>
              <Button onClick={handleConfirmPayment} className="h-11 px-8 bg-emerald-600 hover:bg-emerald-700 font-black rounded-xl">Confirm & Mark Paid</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogContent className="sm:max-w-5xl h-[95vh] flex flex-col p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
            <DialogHeader className="p-6 border-b bg-white flex flex-row items-center justify-between shrink-0 z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Eye className="w-5 h-5 text-primary" /></div>
                <DialogTitle className="text-xl font-black text-slate-900 tracking-tight">Voucher Preview</DialogTitle>
              </div>
              <div className="flex items-center gap-3 mr-8">
                <Button className="bg-primary hover:bg-primary/90 font-black gap-2 px-8 h-12 rounded-xl" onClick={() => handleDownloadPDF(previewVoucher!)}><Download className="w-5 h-5" /> Download PDF</Button>
                <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 hover:bg-slate-100" onClick={() => setIsPreviewOpen(false)}><X className="h-5 h-5" /></Button>
              </div>
            </DialogHeader>
            <ScrollArea className="flex-1 bg-slate-50/50 p-4 sm:p-10 custom-blue-scrollbar">
              <div className="max-w-[210mm] mx-auto bg-white shadow-2xl p-8 min-h-[297mm] border-4 border-slate-900 rounded-sm">
                {previewVoucher && <AdvanceVoucherContent voucher={previewVoucher} employees={employees} firms={firms} plants={plants} />}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>

      {isMounted && printVoucher && createPortal(
        <div className="print-only">
          <AdvanceVoucherContent voucher={printVoucher} employees={employees} firms={firms} plants={plants} />
        </div>,
        document.body
      )}
    </TooltipProvider>
  );
}

function AdvanceVoucherContent({ voucher, employees, firms, plants }: any) {
  const emp = employees.find((e: any) => e.id === voucher.employeeId);
  const firm = firms.find((f: any) => f.id === emp?.firmId);
  const formattedDate = voucher.date ? format(parseISO(voucher.date), 'dd-MMM-yyyy') : "---";

  return (
    <div className="font-serif text-slate-900 space-y-6 bg-white">
      <div className="text-center">
        <h2 className="text-xl font-black uppercase tracking-[0.3em] underline decoration-2 underline-offset-8">Advance Payment Voucher</h2>
      </div>

      <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mt-4">
        <div className="flex items-start gap-6">
          <div className="w-14 h-14 border-2 border-slate-200 flex items-center justify-center p-1 rounded-xl bg-white shadow-sm overflow-hidden shrink-0 mt-1">
            {firm?.logo ? (
              <img src={firm.logo} className="max-h-full max-w-full object-contain" alt="logo" />
            ) : (
              <Building2 className="w-8 h-8 text-slate-300" />
            )}
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-black uppercase leading-tight tracking-tight">{firm?.name || "SIKKA INDUSTRIES AND LOGISTICS"}</h1>
            <div className="space-y-0.5">
              <p className="text-[10px] text-slate-500 font-bold italic max-w-md">{firm?.registeredAddress || "Address details not available"}</p>
              <p className="text-[10px] font-black text-slate-900 flex gap-2">
                <span className="text-slate-400 uppercase tracking-widest">GSTIN:</span> {firm?.gstin || "---"}
              </p>
            </div>
          </div>
        </div>
        
        <div className="text-right space-y-2 pt-1">
          <div className="space-y-1">
            <div className="flex justify-end gap-3 text-sm items-baseline">
              <span className="font-bold text-slate-500 uppercase tracking-widest text-[9px] whitespace-nowrap">VOUCHER NO:</span>
              <span className="font-mono font-black text-slate-900 text-base leading-none whitespace-nowrap">{voucher.voucherNo}</span>
            </div>
            <div className="flex justify-end gap-3 text-sm items-baseline">
              <span className="font-black text-slate-900 text-base leading-none whitespace-nowrap">{formattedDate}</span>
            </div>
          </div>
          <div className="space-y-1 pt-2 border-t border-slate-100">
            <div className="flex justify-end gap-3 text-[9px] items-baseline">
              <span className="font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">CREATED BY:</span>
              <span className="font-bold text-primary uppercase leading-none whitespace-nowrap">{voucher.createdByName || "SYSTEM"}</span>
            </div>
            <div className="flex justify-end gap-3 text-[9px] items-baseline">
              <span className="font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">APPROVED BY:</span>
              <span className="font-bold text-emerald-600 uppercase leading-none whitespace-nowrap">{voucher.approvedByName || "--"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 border-2 border-slate-900 divide-x-2 divide-y-2 divide-slate-900 mt-4">
        <DetailCell label="Employee ID" value={emp?.employeeId} />
        <DetailCell label="Employee Name" value={emp?.name} />
        <DetailCell label="Department" value={emp?.department} />
        <DetailCell label="Designation" value={emp?.designation} />
        <DetailCell label="Aadhar Number" value={emp?.aadhaar} />
        <DetailCell label="Mobile Number" value={emp?.mobile} />
      </div>

      <div className="grid grid-cols-1 border-2 border-slate-900 mt-6">
        <div className="p-3 border-b-2 border-slate-900 flex items-center justify-between bg-white">
          <span className="font-black uppercase text-xs tracking-widest">Amount (In Figures)</span>
          <span className="text-3xl font-black text-slate-900">{formatCurrency(voucher.amount)}</span>
        </div>
        <div className="p-2 bg-slate-50 flex items-start gap-6 border-b-2 border-slate-900">
          <span className="font-black uppercase text-[9px] w-40 shrink-0 text-slate-500 pt-1 tracking-widest">Amount in Words:</span>
          <span className="text-base font-bold italic underline decoration-slate-300 underline-offset-4 leading-relaxed">{numberToIndianWords(voucher.amount)}</span>
        </div>
        <div className="p-2 flex items-start gap-6 bg-white border-b-2 border-slate-900">
          <span className="font-black uppercase text-[9px] w-40 shrink-0 text-slate-500 pt-1 tracking-widest">Purpose:</span>
          <span className="text-base font-medium text-slate-800 leading-relaxed">{voucher.purpose}</span>
        </div>
        <div className="grid grid-cols-2 divide-x-2 divide-slate-900">
          <div className="p-2 flex items-center gap-6 bg-slate-50">
            <span className="font-black uppercase text-[9px] w-32 shrink-0 text-slate-500 tracking-widest">Payment Mode:</span>
            <span className="text-sm font-black text-slate-900 uppercase">{voucher.paymentMode || "---"}</span>
          </div>
          <div className="p-2 flex items-center gap-6 bg-slate-50">
            <span className="font-black uppercase text-[9px] w-32 shrink-0 text-slate-500 tracking-widest">Ref Number:</span>
            <span className="text-sm font-mono font-bold text-slate-900">{voucher.paymentReference || "---"}</span>
          </div>
        </div>
      </div>

      <div className="p-5 bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl italic text-[11px] text-center leading-relaxed text-slate-600 mt-4">
        "I hereby acknowledge receipt of the aforementioned advance amount and expressly agree and undertake that the same shall be duly recovered and/or adjusted against my future salary, wages, or any other dues payable to me, in accordance with the applicable policies, rules, and regulations of the organization."
      </div>

      <div className="flex justify-between items-end pt-16 px-10">
        <div className="text-center space-y-2"><div className="w-64 border-b-2 border-slate-900" /><p className="text-[10px] font-black uppercase tracking-widest text-slate-900">Receiver Signature</p></div>
        <div className="text-center space-y-2"><div className="w-64 border-b-2 border-slate-900" /><p className="text-[10px] font-black uppercase tracking-widest text-slate-900">Authorized Signatory</p></div>
      </div>
      <div className="pt-8 text-center"><p className="text-[8px] font-black uppercase tracking-[0.5em] text-slate-300 italic">© Sikka Industries & Logistics – Internal Secure Document</p></div>
    </div>
  );
}

function DetailCell({ label, value }: { label: string, value: any }) {
  return (
    <div className="flex items-center p-2 bg-white">
      <span className="text-[9px] font-black uppercase text-slate-400 w-36 shrink-0 tracking-widest whitespace-nowrap">{label}:</span>
      <span className="text-sm font-black text-slate-900 uppercase tracking-tight leading-none">{value || "---"}</span>
    </div>
  );
}
