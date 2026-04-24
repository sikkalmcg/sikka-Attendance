"use client";

import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
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
  CheckCircle2,
  Briefcase,
  Info,
  ShieldCheck,
  FileText,
  Navigation,
  FileX
} from "lucide-react";
import { formatCurrency, numberToIndianWords, cn, formatDate } from "@/lib/utils";
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
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";

const PROJECT_START_DATE_STR = "2026-04-01";
const PROJECT_START_DATE = new Date(2026, 3, 1);
const ROWS_PER_PAGE = 15;

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
  const { employees, firms, vouchers, addRecord, updateRecord, currentUser } = useData();
  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState("create");
  const [searchTerm, setSearchTerm] = useState("");
  const [voucherDate, setVoucherDate] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("Advance Salary");
  const { toast } = useToast();

  const [pendingPage, setPendingPage] = useState(1);
  const [payablePage, setPayablePage] = useState(1);
  const [paidPage, setPaidPage] = useState(1);
  const [rejectedPage, setRejectedPage] = useState(1);

  const [paidFromMonth, setPaidFromMonth] = useState("");
  const [paidToMonth, setPaidToMonth] = useState("");

  const [previewVoucher, setPreviewVoucher] = useState<Voucher | null>(null);
  const [printVoucher, setPrintVoucher] = useState<Voucher | null>(null);
  const [voucherToReject, setVoucherToReject] = useState<Voucher | null>(null);
  const [rejectionRemark, setRejectionRemark] = useState("");
  const [isPayDialogOpen, setIsPayDialogOpen] = useState(false);
  const [voucherToPay, setVoucherToPay] = useState<Voucher | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState("");
  const [payMode, setPayMode] = useState<'CASH' | 'BANKING'>('BANKING');
  const [payRef, setPayRef] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const today = new Date().toISOString().split('T')[0];
    setVoucherDate(today < PROJECT_START_DATE_STR ? PROJECT_START_DATE_STR : today);
    const initialMonth = VOUCHER_MONTHS[0] || "";
    setPaidFromMonth(initialMonth);
    setPaidToMonth(initialMonth);
    setPayDate(today < PROJECT_START_DATE_STR ? PROJECT_START_DATE_STR : today);
  }, []);

  // PRINT TRIGGER EFFECT
  useEffect(() => {
    if (printVoucher) {
      const timer = setTimeout(() => {
        window.print();
        setPrintVoucher(null);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [printVoucher]);

  const voucherNo = useMemo(() => {
    if (!voucherDate) return "SIL-XXXXXX-XXXXX";
    const d = new Date(voucherDate);
    if (isNaN(d.getTime())) return "SIL-XXXXXX-XXXXX";
    const fyFullPrefix = `SIL-${d.getFullYear()}${((d.getFullYear() + 1) % 100).toString().padStart(2, '0')}-`;
    const sameFY = (vouchers || []).filter(v => v.voucherNo.startsWith(fyFullPrefix));
    const nextSerial = sameFY.length > 0 ? Math.max(...sameFY.map(v => parseInt(v.voucherNo.split('-')[2]) || 0)) + 1 : 1;
    return `${fyFullPrefix}${nextSerial.toString().padStart(5, '0')}`;
  }, [voucherDate, vouchers]);

  const filteredPendingVouchers = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return (vouchers || []).filter(v => 
      v.status === 'PENDING' && 
      v.date >= PROJECT_START_DATE_STR && 
      (v.voucherNo.toLowerCase().includes(search) || employees.find(e => e.id === v.employeeId)?.name.toLowerCase().includes(search))
    ).reverse();
  }, [vouchers, searchTerm, employees]);

  const rejectedVouchersList = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return (vouchers || []).filter(v => 
      v.status === 'REJECTED' && 
      v.date >= PROJECT_START_DATE_STR && 
      (v.voucherNo.toLowerCase().includes(search) || employees.find(e => e.id === v.employeeId)?.name.toLowerCase().includes(search))
    ).reverse();
  }, [vouchers, searchTerm, employees]);

  const voucherRecoveryLedger = useMemo(() => {
    return (vouchers || []).filter(v => (v.status === 'APPROVED' || v.status === 'PAID') && v.date >= PROJECT_START_DATE_STR).reverse();
  }, [vouchers]);

  const paymentTabLists = useMemo(() => {
    const search = searchTerm.toLowerCase();
    const all = voucherRecoveryLedger.filter(v => v.voucherNo.toLowerCase().includes(search) || employees.find(e => e.id === v.employeeId)?.name.toLowerCase().includes(search));
    const pending = all.filter(v => v.status === 'APPROVED');
    const monthOrder = [...VOUCHER_MONTHS].reverse();
    const fromIdx = monthOrder.indexOf(paidFromMonth);
    const toIdx = monthOrder.indexOf(paidToMonth);
    const paid = all.filter(v => {
      if (v.status !== 'PAID') return false;
      const d = parseISO(v.date);
      const monthKey = `${d.toLocaleString('en-US', { month: 'short' })}-${d.getFullYear().toString().slice(-2)}`;
      const mIdx = monthOrder.indexOf(monthKey);
      return fromIdx !== -1 && toIdx !== -1 && mIdx >= fromIdx && mIdx <= toIdx;
    });
    return { pending, paid };
  }, [voucherRecoveryLedger, searchTerm, employees, paidFromMonth, paidToMonth]);

  const paginatedPending = useMemo(() => filteredPendingVouchers.slice((pendingPage - 1) * ROWS_PER_PAGE, pendingPage * ROWS_PER_PAGE), [filteredPendingVouchers, pendingPage]);
  const paginatedPayable = useMemo(() => paymentTabLists.pending.slice((payablePage - 1) * ROWS_PER_PAGE, payablePage * ROWS_PER_PAGE), [paymentTabLists.pending, payablePage]);
  const paginatedPaid = useMemo(() => paymentTabLists.paid.slice((paidPage - 1) * ROWS_PER_PAGE, paidPage * ROWS_PER_PAGE), [paymentTabLists.paid, paidPage]);
  const paginatedRejected = useMemo(() => rejectedVouchersList.slice((rejectedPage - 1) * ROWS_PER_PAGE, rejectedPage * ROWS_PER_PAGE), [rejectedVouchersList, rejectedPage]);

  const totalPagesPending = Math.ceil(filteredPendingVouchers.length / ROWS_PER_PAGE);
  const totalPagesPayable = Math.ceil(paymentTabLists.pending.length / ROWS_PER_PAGE);
  const totalPagesPaid = Math.ceil(paymentTabLists.paid.length / ROWS_PER_PAGE);
  const totalPagesRejected = Math.ceil(rejectedVouchersList.length / ROWS_PER_PAGE);

  const handleExportPaidHistory = () => {
    if (paymentTabLists.paid.length === 0) {
      toast({ variant: "destructive", title: "No Data", description: "No records found to export." });
      return;
    }

    const headers = [
      "Voucher No", 
      "Voucher Date", 
      "Employee Name", 
      "Employee ID",
      "Department", 
      "Designation", 
      "Amount", 
      "Paid Type", 
      "Paid Date", 
      "Ref. No", 
      "Purpose",
      "Created By",
      "Approved By"
    ];

    const csvRows = [
      headers.join(","),
      ...paymentTabLists.paid.map(v => {
        const emp = employees.find(e => e.id === v.employeeId);
        return [
          `"${v.voucherNo}"`,
          `"${formatDate(v.date)}"`,
          `"${emp?.name || ''}"`,
          `"${emp?.employeeId || ''}"`,
          `"${emp?.department || ''}"`,
          `"${emp?.designation || ''}"`,
          v.amount,
          `"${v.paymentMode || ''}"`,
          `"${formatDate(v.paidDate || '')}"`,
          `"${v.paymentReference || ''}"`,
          `"${v.purpose}"`,
          `"${v.createdByName || ''}"`,
          `"${v.approvedByName || ''}"`
        ].join(",");
      })
    ];

    const blob = new Blob([csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Voucher_Paid_History_${paidFromMonth}_to_${paidToMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Export Success" });
  };

  const StandardPaginationFooter = ({ current, total, onPageChange }: any) => (
    <CardFooter className="bg-slate-50 border-t flex flex-col sm:flex-row items-center justify-between p-4 gap-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={current === 1} onClick={() => onPageChange(current - 1)} className="font-bold h-9"><ChevronLeft className="w-4 h-4 mr-1" /> Previous</Button>
        <Button variant="outline" size="sm" disabled={current === total || total === 0} onClick={() => onPageChange(current + 1)} className="font-bold h-9">Next <ChevronRight className="w-4 h-4 ml-1" /></Button>
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

  const handleCreateVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeId || !amount || !purpose) {
      toast({ variant: "destructive", title: "Missing Fields", description: "Please complete all mandatory fields." });
      return;
    }
    const emp = employees.find(e => e.id === selectedEmployeeId);
    const creator = currentUser?.fullName || "Admin";
    
    const newV = { 
      voucherNo, 
      employeeId: selectedEmployeeId, 
      date: voucherDate, 
      amount: parseFloat(amount), 
      purpose, 
      status: "PENDING", 
      createdByName: creator 
    };
    addRecord('vouchers', newV);

    addRecord('notifications', {
      message: `Voucher Generated: ${emp?.name}, ₹${amount}, By: ${creator}`,
      timestamp: format(new Date(), "yyyy-MM-dd HH:mm:ss"),
      read: false,
      type: 'VOUCHER_GENERATED',
      employeeId: emp?.employeeId
    });

    toast({ title: "Voucher Created" });
    setAmount("");
    setPurpose("Advance Salary");
    setActiveTab("approve");
  };

  const handleApproveVoucher = (v: Voucher) => {
    const emp = employees.find(e => e.id === v.employeeId);
    const approver = currentUser?.fullName || "Manager";
    updateRecord('vouchers', v.id, { status: 'APPROVED', approvedByName: approver });

    addRecord('notifications', {
      message: `Voucher Approved: ${emp?.name}, ₹${v.amount}, By: ${approver}`,
      timestamp: format(new Date(), "yyyy-MM-dd HH:mm:ss"),
      read: false,
      type: 'VOUCHER_APPROVED',
      employeeId: emp?.employeeId
    });
    toast({ title: "Voucher Approved" });
  };

  const handleRejectVoucher = () => {
    if (!voucherToReject || !rejectionRemark.trim()) {
      toast({ variant: "destructive", title: "Remark Required", description: "Please specify why this voucher is being rejected." });
      return;
    }

    const emp = employees.find(e => e.id === voucherToReject.employeeId);
    const rejector = currentUser?.fullName || "Manager";
    updateRecord('vouchers', voucherToReject.id, { 
      status: 'REJECTED', 
      rejectedByName: rejector,
      rejectionRemark: rejectionRemark 
    });

    addRecord('notifications', {
      message: `Voucher Rejected: ${emp?.name}, ₹${voucherToReject.amount}, Reason: ${rejectionRemark}`,
      timestamp: format(new Date(), "yyyy-MM-dd HH:mm:ss"),
      read: false,
      type: 'VOUCHER_REJECTED',
      employeeId: emp?.employeeId
    });

    toast({ variant: "destructive", title: "Voucher Rejected" });
    setVoucherToReject(null);
    setRejectionRemark("");
  };

  const handleOpenPayDialog = (v: Voucher) => {
    setVoucherToPay(v);
    setPayAmount(v.amount.toString());
    setIsPayDialogOpen(true);
  };

  const handlePostPay = () => {
    if (!voucherToPay || !payAmount || isProcessing) return;
    setIsProcessing(true);
    try {
      const emp = employees.find(e => e.id === voucherToPay.employeeId);
      updateRecord('vouchers', voucherToPay.id, {
        status: 'PAID',
        paymentMode: payMode,
        paymentReference: payMode === 'BANKING' ? payRef : '',
        paidDate: payDate
      });

      addRecord('notifications', {
        message: `Voucher Paid: ${emp?.name}, ₹${voucherToPay.amount}`,
        timestamp: format(new Date(), "yyyy-MM-dd HH:mm:ss"),
        read: false,
        type: 'VOUCHER_PAID',
        employeeId: emp?.employeeId
      });

      toast({ title: "Payment Successful" });
      setIsPayDialogOpen(false);
      setVoucherToPay(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVoucherClick = (v: Voucher) => {
    setPreviewVoucher(v);
  };

  if (!isMounted) return null;

  if (previewVoucher) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm sticky top-0 z-30 gap-4">
          <div className="flex items-center gap-3">
             <Button variant="ghost" size="icon" onClick={() => setPreviewVoucher(null)} className="h-10 w-10 rounded-full hover:bg-slate-100">
                <ChevronLeft className="w-6 h-6 text-slate-600" />
             </Button>
             <div>
                <h1 className="text-sm font-black text-slate-900 uppercase tracking-widest leading-none">{previewVoucher.voucherNo}</h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Official Voucher Preview</p>
             </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
             <Button variant="outline" onClick={() => setPreviewVoucher(null)} className="flex-1 sm:flex-none font-bold rounded-xl h-11 border-slate-200 px-6">
                <X className="w-4 h-4 mr-2" /> Close Preview
             </Button>
             <Button onClick={() => setPrintVoucher(previewVoucher)} className="flex-1 sm:flex-none bg-primary hover:bg-primary/90 font-black h-11 px-10 rounded-xl shadow-lg shadow-primary/20">
                <Printer className="w-4 h-4 mr-2" /> Print Document
             </Button>
          </div>
        </div>

        <div className="flex justify-center pb-20">
          <div className="bg-white shadow-2xl rounded-sm ring-1 ring-slate-200 overflow-hidden w-full max-w-[210mm] min-h-[297mm]">
             <VoucherDocumentContent voucher={previewVoucher} employees={employees} firms={firms} />
          </div>
        </div>

        {isMounted && printVoucher && createPortal(
          <div className="print-only">
            <VoucherDocumentContent voucher={printVoucher} employees={employees} firms={firms} isPrintMode={true} />
          </div>,
          document.body
        )}
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6 print:hidden">
        <div>
          <h1 className="text-2xl font-bold">Advance Voucher System</h1>
          <p className="text-muted-foreground">Manage employee advance payments (Since April-2026).</p>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <ScrollArea className="w-full">
            <TabsList className="flex w-full sm:inline-flex sm:grid sm:grid-cols-3 mb-8 bg-slate-100 p-1 rounded-xl h-12 min-w-[360px]">
              <TabsTrigger value="create" className="flex-1 sm:flex-none font-semibold">Create Voucher</TabsTrigger>
              <TabsTrigger value="approve" className="flex-1 sm:flex-none font-semibold">Approve Voucher</TabsTrigger>
              <TabsTrigger value="payment" className="flex-1 sm:flex-none font-semibold">Voucher Payments</TabsTrigger>
            </TabsList>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
          
          <TabsContent value="create">
            <Card className="w-full sm:max-w-4xl mx-auto shadow-xl border-none overflow-hidden">
              <CardHeader className="bg-slate-50 border-b flex flex-row items-center justify-between p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg">Generate New Voucher</CardTitle>
                <Badge variant="outline" className="font-black bg-white text-[10px] sm:text-xs">{voucherNo}</Badge>
              </CardHeader>
              <form onSubmit={handleCreateVoucher}>
                <CardContent className="p-4 sm:p-8 space-y-6 sm:space-y-8">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
                    <div className="space-y-2">
                      <Label className="font-bold text-xs">Voucher Number</Label>
                      <Input value={voucherNo} disabled className="h-11 sm:h-12 font-bold bg-slate-50 text-sm" />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bold text-xs">Date *</Label>
                      <Input type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} className="h-11 sm:h-12 text-sm" min={PROJECT_START_DATE_STR} />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bold text-xs">Select Employee *</Label>
                      <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                        <SelectTrigger className="h-11 sm:h-12 text-sm">
                          <SelectValue placeholder="Select Employee" />
                        </SelectTrigger>
                        <SelectContent>
                          {employees.map(emp => (
                            <SelectItem key={emp.id} value={emp.id} className="text-sm">
                              {emp.name} ({emp.employeeId})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bold text-xs">Amount (INR) *</Label>
                      <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-11 sm:h-12 text-sm" placeholder="Enter amount" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold text-xs">Purpose *</Label>
                    <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} className="h-11 sm:h-12 text-sm" placeholder="Specify reason for advance..." />
                  </div>
                </CardContent>
                <CardFooter className="bg-slate-50 border-t flex justify-end p-4 sm:p-6">
                  <Button className="w-full sm:w-auto sm:px-12 h-11 sm:h-12 font-bold shadow-lg shadow-primary/20" type="submit">Send for Approval</Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>

          <TabsContent value="approve" className="space-y-12">
            <Card className="shadow-sm border-slate-200 overflow-hidden">
              <CardHeader className="bg-slate-50/50 p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between border-b gap-4">
                <CardTitle className="text-sm sm:text-lg">Pending Approvals ({filteredPendingVouchers.length})</CardTitle>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search pending..." className="pl-10 h-10 bg-white text-xs sm:text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="w-full">
                  <Table className="min-w-[800px]">
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="font-bold">Voucher No</TableHead>
                        <TableHead className="font-bold">Name</TableHead>
                        <TableHead className="font-bold text-center">Dept / Desig</TableHead>
                        <TableHead className="font-bold">Date</TableHead>
                        <TableHead className="font-bold text-right">Amount</TableHead>
                        <TableHead className="font-bold text-right pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedPending.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-20 text-muted-foreground font-medium">No pending vouchers found.</TableCell></TableRow>
                      ) : (
                        paginatedPending.map(v => {
                          const emp = employees.find(e => e.id === v.employeeId);
                          return (
                            <TableRow key={v.id} className="hover:bg-slate-50/50 transition-colors">
                              <TableCell className="font-mono font-bold text-blue-600 cursor-pointer hover:underline" onClick={() => handleVoucherClick(v)}>{v.voucherNo}</TableCell>
                              <TableCell className="font-bold uppercase text-slate-700 text-xs sm:text-sm">{emp?.name}</TableCell>
                              <TableCell>
                                <div className="flex flex-col text-center">
                                  <span className="text-[10px] font-bold text-slate-600">{emp?.department}</span>
                                  <span className="text-[8px] text-muted-foreground uppercase">{emp?.designation}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-xs sm:text-sm font-medium">{formatDate(v.date)}</TableCell>
                              <TableCell className="text-right font-black text-slate-900 text-xs sm:text-sm">{formatCurrency(v.amount)}</TableCell>
                              <TableCell className="text-right pr-6">
                                <div className="flex justify-end gap-2">
                                  <Button size="sm" variant="outline" className="text-rose-600 border-rose-200 hover:bg-rose-50 font-bold h-8 text-[10px] sm:text-xs" onClick={() => setVoucherToReject(v)}>Reject</Button>
                                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 font-bold h-8 px-4 sm:px-6 shadow-sm text-[10px] sm:text-xs" onClick={() => handleApproveVoucher(v)}>Approve</Button>
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
              {totalPagesPending > 1 && <StandardPaginationFooter current={pendingPage} total={totalPagesPending} onPageChange={setPendingPage} />}
            </Card>

            {/* Rejected Voucher History */}
            <div className="space-y-6">
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center border border-rose-100">
                    <FileX className="w-5 h-5 text-rose-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Rejected Voucher History</h2>
                    <p className="text-xs text-muted-foreground">Log of all declined advance requests.</p>
                  </div>
                </div>

                <Card className="shadow-sm border-slate-200 overflow-hidden">
                  <CardContent className="p-0">
                    <ScrollArea className="w-full">
                      <Table className="min-w-[1500px]">
                        <TableHeader className="bg-slate-50">
                          <TableRow>
                            <TableHead className="font-bold">Voucher No</TableHead>
                            <TableHead className="font-bold">Voucher Date</TableHead>
                            <TableHead className="font-bold">Employee Name/ID</TableHead>
                            <TableHead className="font-bold">Department/Designation</TableHead>
                            <TableHead className="font-bold text-right">Amount</TableHead>
                            <TableHead className="font-bold">Purpose</TableHead>
                            <TableHead className="font-bold">Create By</TableHead>
                            <TableHead className="font-bold">Reject By</TableHead>
                            <TableHead className="font-bold pr-6">Reject Remark</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedRejected.length === 0 ? (
                            <TableRow><TableCell colSpan={9} className="text-center py-20 text-muted-foreground font-medium">No rejected records found.</TableCell></TableRow>
                          ) : (
                            paginatedRejected.map(v => {
                              const emp = employees.find(e => e.id === v.employeeId);
                              return (
                                <TableRow key={v.id} className="hover:bg-slate-50/50">
                                  <TableCell className="font-mono font-bold text-blue-600 cursor-pointer hover:underline" onClick={() => handleVoucherClick(v)}>{v.voucherNo}</TableCell>
                                  <TableCell className="text-xs font-medium">{formatDate(v.date)}</TableCell>
                                  <TableCell className="font-bold uppercase text-slate-700 text-xs">
                                    <div className="flex flex-col">
                                      <span>{emp?.name}</span>
                                      <span className="text-[10px] text-primary font-mono">{emp?.employeeId}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-xs text-slate-600">
                                    <div className="flex flex-col">
                                      <span>{emp?.department}</span>
                                      <span className="text-[10px] text-muted-foreground">{emp?.designation}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right font-black text-rose-600 text-xs">{formatCurrency(v.amount)}</TableCell>
                                  <TableCell className="text-xs text-muted-foreground">{v.purpose}</TableCell>
                                  <TableCell className="text-xs font-bold text-slate-600">{v.createdByName || '---'}</TableCell>
                                  <TableCell className="text-xs font-bold text-slate-600">{v.rejectedByName || '---'}</TableCell>
                                  <TableCell className="text-xs font-medium text-rose-600 italic pr-6">{v.rejectionRemark || '---'}</TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                      <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                  </CardContent>
                  {totalPagesRejected > 1 && <StandardPaginationFooter current={rejectedPage} total={totalPagesRejected} onPageChange={setRejectedPage} />}
                </Card>
            </div>
          </TabsContent>

          <TabsContent value="payment" className="space-y-12">
            <Card className="shadow-sm border-slate-200 overflow-hidden">
              <CardHeader className="bg-slate-50/50 p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between border-b gap-4">
                <CardTitle className="text-sm sm:text-lg">Ready for Payment ({paymentTabLists.pending.length})</CardTitle>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search payable..." className="pl-10 h-10 bg-white text-xs sm:text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="w-full">
                  <Table className="min-w-[800px]">
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="font-bold">Voucher No</TableHead>
                        <TableHead className="font-bold">Name</TableHead>
                        <TableHead className="font-bold text-center">Dept / Desig</TableHead>
                        <TableHead className="font-bold">Date</TableHead>
                        <TableHead className="font-bold text-right">Amount</TableHead>
                        <TableHead className="font-bold text-right pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedPayable.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-20 text-muted-foreground">No approved vouchers awaiting payment.</TableCell></TableRow>
                      ) : (
                        paginatedPayable.map(v => {
                          const emp = employees.find(e => e.id === v.employeeId);
                          return (
                            <TableRow key={v.id} className="hover:bg-slate-50/50 transition-colors">
                              <TableCell className="font-mono font-bold text-blue-600 cursor-pointer hover:underline" onClick={() => handleVoucherClick(v)}>{v.voucherNo}</TableCell>
                              <TableCell className="font-bold uppercase text-slate-700 text-xs sm:text-sm">{emp?.name}</TableCell>
                              <TableCell>
                                <div className="flex flex-col text-center">
                                  <span className="text-[10px] font-bold text-slate-600">{emp?.department}</span>
                                  <span className="text-[8px] text-muted-foreground uppercase">{emp?.designation}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-xs sm:text-sm font-medium">{formatDate(v.date)}</TableCell>
                              <TableCell className="text-right font-black text-slate-900 text-xs sm:text-sm">{formatCurrency(v.amount)}</TableCell>
                              <TableCell className="text-right pr-6">
                                <Button size="sm" className="font-bold px-4 sm:px-6 bg-slate-900 shadow-sm h-8 text-[10px] sm:text-xs" onClick={() => handleOpenPayDialog(v)}>Process Pay</Button>
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
              {totalPagesPayable > 1 && <StandardPaginationFooter current={payablePage} total={totalPagesPayable} onPageChange={setPayablePage} />}
            </Card>

            {/* Paid History Section */}
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center border border-emerald-100">
                    <History className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Paid History</h2>
                    <p className="text-xs text-muted-foreground">Historical ledger of disbursed vouchers.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                   <Button variant="outline" size="sm" onClick={handleExportPaidHistory} className="h-9 gap-2 font-bold text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                      <FileSpreadsheet className="w-4 h-4" /> Export Excel
                   </Button>
                   <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm">
                      <Filter className="w-3.5 h-3.5 text-slate-400" />
                      <Select value={paidFromMonth} onValueChange={setPaidFromMonth}>
                        <SelectTrigger className="h-7 border-none bg-transparent text-[10px] font-bold p-0 focus:ring-0 w-24"><SelectValue /></SelectTrigger>
                        <SelectContent>{VOUCHER_MONTHS.map(m => <SelectItem key={m} value={m} className="text-[10px]">{m}</SelectItem>)}</SelectContent>
                      </Select>
                      <span className="text-slate-300 text-[10px]">to</span>
                      <Select value={paidToMonth} onValueChange={setPaidToMonth}>
                        <SelectTrigger className="h-7 border-none bg-transparent text-[10px] font-bold p-0 focus:ring-0 w-24"><SelectValue /></SelectTrigger>
                        <SelectContent>{VOUCHER_MONTHS.map(m => <SelectItem key={m} value={m} className="text-[10px]">{m}</SelectItem>)}</SelectContent>
                      </Select>
                   </div>
                </div>
              </div>

              <Card className="shadow-sm border-slate-200 overflow-hidden">
                <CardContent className="p-0">
                  <ScrollArea className="w-full">
                    <Table className="min-w-[1600px]">
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="font-bold">Voucher No</TableHead>
                          <TableHead className="font-bold">Voucher Date</TableHead>
                          <TableHead className="font-bold">Employee Name</TableHead>
                          <TableHead className="font-bold">Department</TableHead>
                          <TableHead className="font-bold">Designation</TableHead>
                          <TableHead className="font-bold text-right">Amount</TableHead>
                          <TableHead className="font-bold text-center">Paid Type</TableHead>
                          <TableHead className="font-bold">Paid Date</TableHead>
                          <TableHead className="font-bold">Ref. No.</TableHead>
                          <TableHead className="font-bold">Purpose</TableHead>
                          <TableHead className="font-bold">Created By</TableHead>
                          <TableHead className="font-bold pr-6">Approved By</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedPaid.length === 0 ? (
                          <TableRow><TableCell colSpan={12} className="text-center py-20 text-muted-foreground font-medium">No paid vouchers found for the selected criteria.</TableCell></TableRow>
                        ) : (
                          paginatedPaid.map(v => {
                            const emp = employees.find(e => e.id === v.employeeId);
                            return (
                              <TableRow key={v.id} className="hover:bg-slate-50/50 transition-colors">
                                <TableCell className="font-mono font-bold text-blue-600 cursor-pointer hover:underline" onClick={() => handleVoucherClick(v)}>{v.voucherNo}</TableCell>
                                <TableCell className="text-xs font-medium">{formatDate(v.date)}</TableCell>
                                <TableCell className="font-bold uppercase text-slate-700 text-xs">{emp?.name}</TableCell>
                                <TableCell className="text-xs text-slate-600">{emp?.department}</TableCell>
                                <TableCell className="text-xs text-slate-600">{emp?.designation}</TableCell>
                                <TableCell className="text-right font-black text-slate-900 text-xs">{formatCurrency(v.amount)}</TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="outline" className={cn("text-[9px] font-black uppercase px-2", v.paymentMode === 'BANKING' ? "bg-blue-50 text-blue-700 border-blue-100" : "bg-orange-50 text-orange-700 border-orange-100")}>
                                    {v.paymentMode || "---"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs font-bold text-emerald-600">{formatDate(v.paidDate || '')}</TableCell>
                                <TableCell className="text-xs font-mono font-medium">{v.paymentReference || "---"}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">{v.purpose}</TableCell>
                                <TableCell className="text-xs font-bold text-slate-600">{v.createdByName || '---'}</TableCell>
                                <TableCell className="text-xs font-bold text-slate-600 pr-6">{v.approvedByName || '---'}</TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </CardContent>
                {totalPagesPaid > 1 && <StandardPaginationFooter current={paidPage} total={totalPagesPaid} onPageChange={setPaidPage} />}
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!voucherToReject} onOpenChange={(o) => { if (!o) { setVoucherToReject(null); setRejectionRemark(""); } }}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-rose-600 flex items-center gap-2">
              <XCircle className="w-5 h-5" /> Reject Voucher
            </DialogTitle>
            <DialogDescription>Please provide a valid reason for declining this request.</DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <div className="space-y-2">
              <Label className="font-bold text-xs uppercase text-slate-500">Rejection Remark *</Label>
              <Textarea 
                placeholder="e.g. Documentation incomplete, Amount exceeds limit..."
                value={rejectionRemark}
                onChange={(e) => setRejectionRemark(e.target.value)}
                className="min-h-[100px] bg-slate-50 border-slate-200"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => { setVoucherToReject(null); setRejectionRemark(""); }} className="rounded-xl font-bold">Cancel</Button>
            <Button 
              className="bg-rose-600 hover:bg-rose-700 font-bold px-8 rounded-xl" 
              onClick={handleRejectVoucher}
              disabled={!rejectionRemark.trim()}
            >
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPayDialogOpen} onOpenChange={setIsPayDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md rounded-2xl p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-4 sm:p-6 bg-slate-900 text-white shrink-0">
            <DialogTitle className="flex items-center gap-2 font-black text-lg sm:text-xl"><CreditCard className="w-5 h-5 text-primary" /> Process Disbursement</DialogTitle>
            <p className="text-[9px] sm:text-[10px] text-primary font-black uppercase tracking-widest mt-1">Final Payment Settlement</p>
          </DialogHeader>
          <div className="p-6 sm:p-8 space-y-6">
            <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-100 grid grid-cols-2 gap-4 shadow-inner">
              <div><p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-tighter">Voucher ID</p><p className="text-xs sm:text-sm font-black text-slate-700">{voucherToPay?.voucherNo}</p></div>
              <div><p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-tighter text-right">Amount Due</p><p className="text-xs sm:text-sm font-black text-rose-600 text-right">{formatCurrency(voucherToPay?.amount || 0)}</p></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[9px] sm:text-[10px] font-black uppercase text-slate-500">Pay Mode</Label>
                <Select value={payMode} onValueChange={(v: any) => setPayMode(v)}>
                  <SelectTrigger className="h-11 sm:h-12 font-bold text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BANKING" className="text-sm">Banking Transfer</SelectItem>
                    <SelectItem value="CASH" className="text-sm">Petty Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[9px] sm:text-[10px] font-black uppercase text-slate-500">Pay Date</Label>
                <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className="h-11 sm:h-12 font-bold text-sm" min={PROJECT_START_DATE_STR} />
              </div>
            </div>
            {payMode === 'BANKING' && (
              <div className="space-y-2">
                <Label className="text-[9px] sm:text-[10px] font-black uppercase text-slate-500">Reference No / Txn ID</Label>
                <Input placeholder="Enter Banking Txn ID or Chq No" value={payRef} onChange={(e) => setPayRef(e.target.value)} className="h-11 sm:h-12 font-bold text-sm" />
              </div>
            )}
          </div>
          <DialogFooter className="p-4 sm:p-6 bg-slate-50 border-t gap-3 flex-row">
            <Button variant="ghost" onClick={() => setIsPayDialogOpen(false)} className="flex-1 h-11 sm:h-12 rounded-xl font-bold text-xs sm:text-sm">Cancel</Button>
            <Button onClick={handlePostPay} disabled={isProcessing} className="flex-1 bg-primary hover:bg-primary/90 rounded-xl font-black h-11 sm:h-12 shadow-xl text-xs sm:text-sm">Confirm Pay</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}

export function VoucherDocumentContent({ voucher, employees, firms, isPrintMode = false }: { voucher: Voucher, employees: any[], firms: any[], isPrintMode?: boolean }) {
  const emp = employees.find(e => e.id === voucher.employeeId);
  const firm = firms.find(f => f.id === emp?.firmId);
  return (
    <div className={cn("font-calibri text-slate-900 bg-white min-h-[297mm] flex flex-col mx-auto relative", isPrintMode ? "p-6" : "p-6 sm:p-12", !isPrintMode && "max-w-4xl")}>
      {voucher.status === 'REJECTED' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden select-none opacity-[0.08] z-0">
          <span className="text-[120px] font-black uppercase tracking-[0.2em] -rotate-45 border-[20px] border-rose-600 text-rose-600 px-10 py-5 rounded-[40px]">
            REJECTED
          </span>
        </div>
      )}
      
      <div className="relative mb-6 min-h-[70px] z-10">
        <div className="absolute left-0 top-0">
          {firm?.logo ? (
            <img src={firm.logo} alt="Logo" className="w-12 h-12 sm:w-14 sm:h-14 object-contain" />
          ) : (
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-900 rounded-lg flex items-center justify-center">
              <span className="text-white text-lg sm:text-xl font-black">S</span>
            </div>
          )}
        </div>
        <div className="text-center">
          <h1 className="text-xl sm:text-2xl font-black uppercase tracking-[0.3em] border-b-2 border-slate-900 inline-block pb-1 leading-tight">Payment Voucher</h1>
          <p className="text-[9px] sm:text-[10px] font-black text-slate-400 mt-1 uppercase tracking-[0.4em]">Advance Disbursement</p>
        </div>
      </div>

      <div className="flex justify-between items-start mb-6 z-10">
        <div className="space-y-1">
          <h2 className="text-base sm:text-lg font-black uppercase leading-tight tracking-tight">{firm?.name || "SIKKA INDUSTRIES & LOGISTICS"}</h2>
          <p className="text-[8px] sm:text-[9px] font-bold text-slate-500 uppercase leading-relaxed max-w-[320px]">{firm?.registeredAddress}</p>
          <div className="flex gap-4 sm:gap-6 text-[8px] sm:text-[9px] font-black uppercase pt-1.5">
            <div><span className="text-slate-400 text-[7px] sm:text-[8px] block">GSTIN</span><span className="font-mono">{firm?.gstin || "---"}</span></div>
            <div><span className="text-slate-400 text-[7px] sm:text-[8px] block">PAN</span><span className="font-mono">{firm?.pan || "---"}</span></div>
          </div>
        </div>
        <div className="flex flex-col items-end pt-0">
          <div className="w-full max-w-[280px] space-y-1.5">
            <div className="flex justify-between border-b border-slate-100 pb-1 gap-8">
              <span className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Voucher No.</span>
              <span className="text-xs sm:text-sm font-black font-mono text-primary">{voucher.voucherNo}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-1 gap-8">
              <span className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Date</span>
              <span className="text-xs sm:text-sm font-black">{formatDate(voucher.date)}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-1 gap-8">
              <span className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Created By</span>
              <span className="text-[9px] sm:text-[10px] font-bold uppercase">{voucher.createdByName || "System Admin"}</span>
            </div>
            {voucher.status === 'REJECTED' ? (
              <div className="flex justify-between border-b border-rose-100 pb-1 gap-8">
                <span className="text-[8px] sm:text-[9px] font-black text-rose-400 uppercase tracking-widest whitespace-nowrap">Rejected By</span>
                <span className="text-[9px] sm:text-[10px] font-bold uppercase text-rose-600">{voucher.rejectedByName || "Admin"}</span>
              </div>
            ) : (
              <div className="flex justify-between border-b border-slate-100 pb-1 gap-8">
                <span className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Approved By</span>
                <span className="text-[9px] sm:text-[10px] font-bold uppercase">{voucher.approvedByName || "Authorized Manager"}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mb-6 z-10">
        <h3 className="text-[8px] sm:text-[9px] font-black uppercase text-slate-400 tracking-widest mb-2 flex items-center gap-2"><UserIcon className="w-3 h-3" /> Employee / Receiver Information</h3>
        <div className="border border-slate-900 rounded-lg overflow-hidden">
          <table className="w-full text-left text-xs sm:text-sm border-collapse table-fixed">
            <tbody>
              <tr>
                <th className="p-3 border-r border-b border-slate-900 bg-slate-50 w-[15%] uppercase text-[8px] sm:text-[9px] font-black whitespace-nowrap">Employee ID</th>
                <td className="p-3 border-r border-b border-slate-900 font-black font-mono text-primary w-[35%]">{emp?.employeeId || "---"}</td>
                <th className="p-3 border-r border-b border-slate-900 bg-slate-50 uppercase text-[8px] sm:text-[9px] font-black whitespace-nowrap w-[15%]">Full Name</th>
                <td className="p-3 border-b border-slate-900 font-black uppercase w-[35%]">{emp?.name || "---"}</td>
              </tr>
              <tr>
                <th className="p-3 border-r border-slate-900 bg-slate-50 uppercase text-[8px] sm:text-[9px] font-black whitespace-nowrap">Dept / Desig</th>
                <td className="p-3 border-r border-slate-900 font-bold uppercase leading-snug">{emp?.department} / {emp?.designation}</td>
                <th className="p-3 border-r border-slate-900 bg-slate-50 uppercase text-[8px] sm:text-[9px] font-black whitespace-nowrap">Aadhaar Number</th>
                <td className="p-3 font-mono font-bold tracking-widest">{emp?.aadhaar || "---"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="mb-6 z-10">
        <h3 className="text-[8px] sm:text-[9px] font-black uppercase text-slate-400 tracking-widest mb-2 flex items-center gap-2"><CreditCard className="w-3 h-3" /> Transaction Summary</h3>
        <div className="border border-slate-900 rounded-lg overflow-hidden">
          <table className="w-full text-left text-xs sm:text-sm border-collapse table-fixed">
            <tbody>
              <tr>
                <th className="p-3 border-r border-b border-slate-900 bg-slate-50 w-[18%] uppercase text-[8px] sm:text-[9px] font-black whitespace-nowrap">Amount (₹)</th>
                <td className="p-3 border-b border-slate-900 w-[82%]"><div className="text-lg sm:text-xl font-black text-slate-900 py-0.5">{formatCurrency(voucher.amount)}</div></td>
              </tr>
              <tr>
                <th className="p-3 border-r border-b border-slate-900 bg-slate-50 uppercase text-[8px] sm:text-[9px] font-black whitespace-nowrap">In Words</th>
                <td className="p-3 border-b border-slate-900 font-bold italic text-slate-700 text-[10px] sm:text-sm leading-snug">{numberToIndianWords(voucher.amount)}</td>
              </tr>
              <tr>
                <th className="p-3 border-r border-slate-900 bg-slate-50 uppercase text-[8px] sm:text-[9px] font-black whitespace-nowrap">Purpose</th>
                <td className="p-3 font-black uppercase tracking-widest text-primary text-[10px] sm:text-sm">Advance Salary</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {voucher.status === 'REJECTED' && (
        <div className="mb-6 z-10">
           <h3 className="text-[8px] sm:text-[9px] font-black uppercase text-rose-400 tracking-widest mb-2 flex items-center gap-2"><AlertTriangle className="w-3 h-3" /> Rejection Remark</h3>
           <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
             <p className="text-xs font-bold text-rose-700 italic">"{voucher.rejectionRemark}"</p>
           </div>
        </div>
      )}

      <div className="mb-8 space-y-6 z-10 flex-1">
        <div className="p-4 sm:p-5 bg-slate-50 border border-slate-200 rounded-xl">
          <h4 className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest mb-3 border-b border-slate-300 pb-1.5">Declaration / Terms of Recovery</h4>
          <div className="space-y-3 text-[10px] sm:text-xs font-medium leading-relaxed text-slate-600 text-justify">
            <p>The above-mentioned amount is being paid as an advance against the employee’s future salary and shall be adjusted/deducted from the upcoming salary payments, as per company policy or mutual agreement.</p>
            <p className="font-bold text-slate-900 underline">The employee hereby agrees and acknowledges that:</p>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>The advance amount will be recovered from salary in full or in installments.</li>
              <li>In case of resignation, termination, or separation from the company, the outstanding advance (if any) shall be recoverable from final settlement dues.</li>
              <li>The company reserves the right to deduct the balance amount from any payable dues.</li>
            </ul>
            <p className="pt-1.5 italic text-[9px] sm:text-[10px] font-bold">This voucher is issued for record and accounting purposes.</p>
          </div>
        </div>
      </div>

      <div className="mt-auto flex justify-between items-end pb-12 px-10 z-10 w-full shrink-0">
        <div className="text-center space-y-3">
          <div className="w-48 sm:w-56 h-14 border-b-2 border-slate-900 border-dashed" />
          <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-800">Receiver Signature</p>
        </div>
        <div className="text-center space-y-3">
          <div className="w-48 sm:w-56 h-14 border-b-2 border-slate-900 border-dashed" />
          <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-800">Authorized Signatory</p>
        </div>
      </div>
    </div>
  );
}
