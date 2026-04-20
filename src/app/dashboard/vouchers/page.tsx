
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

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
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const today = new Date().toISOString().split('T')[0];
    setVoucherDate(today < PROJECT_START_DATE_STR ? PROJECT_START_DATE_STR : today);
    const savedUser = localStorage.getItem("user");
    if (savedUser) setCurrentUser(JSON.parse(savedUser));
    const initialMonth = VOUCHER_MONTHS[0] || "";
    setPaidFromMonth(initialMonth);
    setPaidToMonth(initialMonth);
    setPayDate(today < PROJECT_START_DATE_STR ? PROJECT_START_DATE_STR : today);
  }, []);

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
    return (vouchers || []).filter(v => v.status === 'PENDING' && v.date >= PROJECT_START_DATE_STR && (v.voucherNo.toLowerCase().includes(search) || employees.find(e => e.id === v.employeeId)?.name.toLowerCase().includes(search))).reverse();
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

  const totalPagesPending = Math.ceil(filteredPendingVouchers.length / ROWS_PER_PAGE);
  const totalPagesPayable = Math.ceil(paymentTabLists.pending.length / ROWS_PER_PAGE);
  const totalPagesPaid = Math.ceil(paymentTabLists.paid.length / ROWS_PER_PAGE);

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
    const newV = { voucherNo, employeeId: selectedEmployeeId, date: voucherDate, amount: parseFloat(amount), purpose, status: "PENDING", createdByName: currentUser?.fullName || "Admin" };
    addRecord('vouchers', newV);
    toast({ title: "Voucher Created", description: "Voucher has been sent for approval." });
    setAmount("");
    setPurpose("");
    setActiveTab("approve");
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
      updateRecord('vouchers', voucherToPay.id, {
        status: 'PAID',
        paymentMode: payMode,
        paymentReference: payRef,
        paidDate: payDate,
        approvedByName: currentUser?.fullName || "Accountant"
      });
      toast({ title: "Payment Successful", description: `Voucher ${voucherToPay.voucherNo} has been settled.` });
      setIsPayDialogOpen(false);
      setVoucherToPay(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadAndPrint = (v: Voucher) => {
    setPrintVoucher(v);
    setTimeout(() => {
      window.print();
      setPrintVoucher(null);
    }, 500);
  };

  const handleExportPaid = () => {
    const data = paymentTabLists.paid;
    if (data.length === 0) {
      toast({ variant: "destructive", title: "No Data", description: "No paid vouchers in selected range." });
      return;
    }
    const headers = ["Voucher No", "Employee Name", "Date", "Purpose", "Amount", "Status", "Payment Mode", "Reference"];
    const rows = [
      headers.join(","),
      ...data.map(v => {
        const emp = employees.find(e => e.id === v.employeeId);
        return [`"${v.voucherNo}"`, `"${emp?.name || ''}"`, `"${v.date}"`, `"${v.purpose}"`, v.amount, `"${v.status}"`, `"${v.paymentMode || ''}"`, `"${v.paymentReference || ''}"`].join(",");
      })
    ];
    const blob = new Blob([rows.join("\n")], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", `Paid_Vouchers_${paidFromMonth}_to_${paidToMonth}.csv`);
    link.click();
  };

  if (!isMounted) return null;

  return (
    <TooltipProvider>
      <div className="space-y-6 print:hidden">
        <div><h1 className="text-2xl font-bold">Advance Voucher System</h1><p className="text-muted-foreground">Manage employee advance payments (Since April-2026).</p></div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-xl grid-cols-3 mb-8 bg-slate-100 p-1 rounded-xl h-12">
            <TabsTrigger value="create" className="font-semibold">Create Voucher</TabsTrigger>
            <TabsTrigger value="approve" className="font-semibold">Approve Voucher</TabsTrigger>
            <TabsTrigger value="payment" className="font-semibold">Voucher Payments</TabsTrigger>
          </TabsList>
          
          <TabsContent value="create">
            <Card className="max-w-4xl mx-auto shadow-xl border-none">
              <CardHeader className="bg-slate-50 border-b flex flex-row items-center justify-between"><CardTitle>Generate New Voucher</CardTitle></CardHeader>
              <form onSubmit={handleCreateVoucher}><CardContent className="p-8 space-y-8"><div className="grid grid-cols-1 sm:grid-cols-2 gap-8"><div className="space-y-2"><Label className="font-bold">Voucher Number</Label><Input value={voucherNo} disabled className="h-12 font-bold" /></div><div className="space-y-2"><Label className="font-bold">Date *</Label><Input type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} className="h-12" min={PROJECT_START_DATE_STR} /></div><div className="space-y-2"><Label className="font-bold">Select Employee *</Label><Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}><SelectTrigger className="h-12"><SelectValue placeholder="Select Employee" /></SelectTrigger><SelectContent>{employees.map(emp => <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label className="font-bold">Amount (INR) *</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-12" /></div></div><div className="space-y-2"><Label className="font-bold">Purpose *</Label><Input value={purpose} onChange={(e) => setPurpose(e.target.value)} className="h-12" /></div></CardContent><CardFooter className="bg-slate-50 border-t flex justify-end p-6"><Button className="px-12 h-12 font-bold" type="submit">Create Voucher</Button></CardFooter></form>
            </Card>
          </TabsContent>

          <TabsContent value="approve">
            <Card className="shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50 p-6 flex flex-row items-center justify-between">
                <CardTitle>Pending Approvals ({filteredPendingVouchers.length})</CardTitle>
                <div className="relative w-64"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search pending..." className="pl-10 h-10 bg-white" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="font-bold">Voucher No</TableHead>
                      <TableHead className="font-bold">Name</TableHead>
                      <TableHead className="font-bold">Date</TableHead>
                      <TableHead className="font-bold text-right">Amount</TableHead>
                      <TableHead className="font-bold text-right pr-6">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedPending.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">No pending vouchers found.</TableCell></TableRow>
                    ) : (
                      paginatedPending.map(v => (
                        <TableRow key={v.id} className="hover:bg-slate-50/50">
                          <TableCell className="font-mono font-bold text-primary cursor-pointer" onClick={() => {setPreviewVoucher(v); setIsPreviewOpen(true);}}>{v.voucherNo}</TableCell>
                          <TableCell className="font-bold uppercase">{employees.find(e => e.id === v.employeeId)?.name}</TableCell>
                          <TableCell>{v.date}</TableCell>
                          <TableCell className="text-right font-bold">{formatCurrency(v.amount)}</TableCell>
                          <TableCell className="text-right pr-6">
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="outline" className="text-rose-600 border-rose-200 hover:bg-rose-50" onClick={() => setVoucherToReject(v.id)}>Reject</Button>
                              <Button size="sm" className="bg-emerald-600 h-8" onClick={() => updateRecord('vouchers', v.id, { status: 'APPROVED' })}>Approve</Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
              {totalPagesPending > 1 && <StandardPaginationFooter current={pendingPage} total={totalPagesPending} onPageChange={setPendingPage} />}
            </Card>
          </TabsContent>

          <TabsContent value="payment" className="space-y-12">
            <Card className="shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50 p-6 flex flex-row items-center justify-between">
                <CardTitle>Ready for Payment ({paymentTabLists.pending.length})</CardTitle>
                <div className="relative w-64"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search payable..." className="pl-10 h-10 bg-white" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="font-bold">Voucher No</TableHead>
                      <TableHead className="font-bold">Name</TableHead>
                      <TableHead className="font-bold">Date</TableHead>
                      <TableHead className="font-bold text-right">Amount</TableHead>
                      <TableHead className="font-bold text-right pr-6">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedPayable.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">No approved vouchers awaiting payment.</TableCell></TableRow>
                    ) : (
                      paginatedPayable.map(v => (
                        <TableRow key={v.id} className="hover:bg-slate-50/50">
                          <TableCell className="font-mono font-bold text-primary cursor-pointer" onClick={() => {setPreviewVoucher(v); setIsPreviewOpen(true);}}>{v.voucherNo}</TableCell>
                          <TableCell className="font-bold uppercase">{employees.find(e => e.id === v.employeeId)?.name}</TableCell>
                          <TableCell>{v.date}</TableCell>
                          <TableCell className="text-right font-bold">{formatCurrency(v.amount)}</TableCell>
                          <TableCell className="text-right pr-6"><Button size="sm" onClick={() => handleOpenPayDialog(v)}>Process Pay</Button></TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
              {totalPagesPayable > 1 && <StandardPaginationFooter current={payablePage} total={totalPagesPayable} onPageChange={setPayablePage} />}
            </Card>

            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-black uppercase text-slate-700 flex items-center gap-2"><History className="w-4 h-4" /> Paid Vouchers (History)</h3>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1 rounded-xl shadow-sm">
                    <Filter className="w-3 h-3 text-slate-400" />
                    <Select value={paidFromMonth} onValueChange={(v) => {setPaidFromMonth(v); if (paidToMonth < v) setPaidToMonth(v);}}>
                      <SelectTrigger className="h-7 w-24 border-none p-0 text-[10px] font-bold"><SelectValue /></SelectTrigger>
                      <SelectContent>{VOUCHER_MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                    <span className="text-[10px] text-slate-300">TO</span>
                    <Select value={paidToMonth} onValueChange={(v) => {if (v >= paidFromMonth) setPaidToMonth(v);}}>
                      <SelectTrigger className="h-7 w-24 border-none p-0 text-[10px] font-bold"><SelectValue /></SelectTrigger>
                      <SelectContent>{VOUCHER_MONTHS.filter(m => m >= paidFromMonth).map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Button variant="outline" size="sm" className="h-9 border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-bold" onClick={handleExportPaid}><FileSpreadsheet className="w-4 h-4 mr-2" /> Export Excel</Button>
                </div>
              </div>
              <Card className="border-none shadow-sm overflow-hidden bg-slate-50/30">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-slate-100/50">
                      <TableRow>
                        <TableHead className="font-bold">Voucher No</TableHead>
                        <TableHead className="font-bold">Name</TableHead>
                        <TableHead className="font-bold">Settled Date</TableHead>
                        <TableHead className="font-bold text-right">Amount</TableHead>
                        <TableHead className="font-bold text-right pr-6">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedPaid.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground italic">No historical records in this range.</TableCell></TableRow>
                      ) : (
                        paginatedPaid.map(v => (
                          <TableRow key={v.id} className="hover:bg-white/50">
                            <TableCell className="font-mono font-bold text-slate-600 cursor-pointer" onClick={() => {setPreviewVoucher(v); setIsPreviewOpen(true);}}>{v.voucherNo}</TableCell>
                            <TableCell className="font-bold uppercase text-slate-600">{employees.find(e => e.id === v.employeeId)?.name}</TableCell>
                            <TableCell className="text-slate-500">{v.paidDate || v.date}</TableCell>
                            <TableCell className="text-right font-black text-emerald-600">{formatCurrency(v.amount)}</TableCell>
                            <TableCell className="text-right pr-6"><Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 uppercase text-[9px] font-black tracking-widest">Settle-Paid</Badge></TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
                {totalPagesPaid > 1 && <StandardPaginationFooter current={paidPage} total={totalPagesPaid} onPageChange={setPaidPage} />}
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Pay Dialog */}
      <Dialog open={isPayDialogOpen} onOpenChange={setIsPayDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <DialogTitle className="flex items-center gap-2"><CreditCard className="w-5 h-5 text-primary" /> Process Voucher Payment</DialogTitle>
          </DialogHeader>
          <div className="p-8 space-y-6">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 grid grid-cols-2 gap-4">
              <div><p className="text-[10px] font-black text-slate-400 uppercase">Voucher ID</p><p className="text-sm font-bold">{voucherToPay?.voucherNo}</p></div>
              <div><p className="text-[10px] font-black text-slate-400 uppercase">Amount Due</p><p className="text-sm font-black text-rose-600">{formatCurrency(voucherToPay?.amount || 0)}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Pay Mode</Label><Select value={payMode} onValueChange={(v: any) => setPayMode(v)}><SelectTrigger className="h-12 font-bold"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="BANKING">Banking Transfer</SelectItem><SelectItem value="CASH">Petty Cash</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Pay Date</Label><Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className="h-12 font-bold" min={PROJECT_START_DATE_STR} /></div>
            </div>
            <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Reference No / ID</Label><Input placeholder="Txn ID or Chq No" value={payRef} onChange={(e) => setPayRef(e.target.value)} className="h-12 font-bold" /></div>
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t gap-3"><Button variant="ghost" onClick={() => setIsPayDialogOpen(false)} className="rounded-xl font-bold">Cancel</Button><Button onClick={handlePostPay} disabled={isProcessing} className="bg-primary rounded-xl font-black px-10 shadow-lg shadow-primary/20">Finalize Payment</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Voucher Preview Modal */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] p-0 overflow-hidden rounded-2xl">
          <ScrollArea className="h-full">
            <div className="p-10 bg-white space-y-8">
              <div className="flex justify-between items-start border-b-2 border-slate-100 pb-6">
                <div><h3 className="text-xl font-black text-primary">Sikka Voucher</h3><p className="text-xs text-muted-foreground mt-1">Official Payment Authorization</p></div>
                <Badge variant="outline" className="px-4 py-1 font-black text-lg">{previewVoucher?.status}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-y-6 text-sm">
                <div><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Voucher Number</p><p className="font-bold">{previewVoucher?.voucherNo}</p></div>
                <div><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Authorization Date</p><p className="font-bold">{previewVoucher?.date}</p></div>
                <div className="col-span-2 border-y py-4 border-slate-50"><p className="text-[10px] font-black text-slate-400 uppercase mb-2">Employee Details</p><div className="flex items-center gap-3"><div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center"><UserIcon className="w-5 h-5 text-slate-400" /></div><div><p className="font-black uppercase">{employees.find(e => e.id === previewVoucher?.employeeId)?.name}</p><p className="text-[10px] text-muted-foreground font-mono">{employees.find(e => e.id === previewVoucher?.employeeId)?.employeeId}</p></div></div></div>
                <div className="col-span-2"><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Stated Purpose</p><p className="font-medium italic text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100">"{previewVoucher?.purpose}"</p></div>
              </div>
              <div className="bg-slate-900 text-white p-6 rounded-3xl flex justify-between items-center shadow-xl">
                <div><p className="text-[10px] font-black uppercase text-white/50 tracking-widest">Amount Authorized</p><p className="text-sm font-bold text-primary mt-1">{numberToIndianWords(previewVoucher?.amount || 0)}</p></div>
                <p className="text-3xl font-black">{formatCurrency(previewVoucher?.amount || 0)}</p>
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t flex justify-end gap-3"><Button variant="ghost" onClick={() => setIsPreviewOpen(false)}>Close Preview</Button><Button className="bg-primary px-8 gap-2 font-bold" onClick={() => handleDownloadAndPrint(previewVoucher!)}><Printer className="w-4 h-4" /> Print Document</Button></div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Reject Alert */}
      <AlertDialog open={!!voucherToReject} onOpenChange={(o) => !o && setVoucherToReject(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="text-rose-500" /> Confirm Rejection</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to decline this advance request? This action will move the voucher to cancelled status.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Keep Pending</AlertDialogCancel><AlertDialogAction className="bg-rose-600 hover:bg-rose-700" onClick={() => {updateRecord('vouchers', voucherToReject!, {status: 'CANCELLED'}); setVoucherToReject(null); toast({title: "Voucher Cancelled"});}}>Confirm Reject</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Print Portal */}
      {isMounted && printVoucher && createPortal(
        <div className="print-only p-10 bg-white font-calibri">
          <div className="text-center border-b-2 border-slate-900 pb-4 mb-8">
            <h1 className="text-2xl font-black uppercase tracking-tight">SIKKA INDUSTRIES & LOGISTICS</h1>
            <h2 className="text-lg font-black mt-2 underline">ADVANCE PAYMENT VOUCHER</h2>
          </div>
          <div className="grid grid-cols-2 gap-10 text-sm mb-10">
            <div className="space-y-4">
              <div className="flex justify-between border-b pb-2"><span className="font-bold">Voucher No:</span> <span className="font-mono">{printVoucher.voucherNo}</span></div>
              <div className="flex justify-between border-b pb-2"><span className="font-bold">Date:</span> <span>{printVoucher.date}</span></div>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between border-b pb-2"><span className="font-bold">Name:</span> <span className="uppercase">{employees.find(e => e.id === printVoucher.employeeId)?.name}</span></div>
              <div className="flex justify-between border-b pb-2"><span className="font-bold">Emp ID:</span> <span className="font-mono">{employees.find(e => e.id === printVoucher.employeeId)?.employeeId}</span></div>
            </div>
          </div>
          <div className="border-2 border-slate-900 p-6 mb-10 bg-slate-50">
            <p className="text-[10px] font-black uppercase text-slate-500 mb-2">Purpose of Advance</p>
            <p className="text-lg font-bold italic">"{printVoucher.purpose}"</p>
          </div>
          <div className="flex justify-between items-center bg-slate-900 text-white p-6 rounded-sm mb-6">
            <span className="font-black uppercase tracking-widest text-xs">Total Amount (In Words: {numberToIndianWords(printVoucher.amount)})</span>
            <span className="text-3xl font-black">{formatCurrency(printVoucher.amount)}</span>
          </div>
          <div className="mt-20 grid grid-cols-3 gap-10 text-center">
            <div className="pt-4 border-t-2 border-slate-900"><p className="text-[10px] font-black uppercase">Recipient Signature</p></div>
            <div className="pt-4 border-t-2 border-slate-900"><p className="text-[10px] font-black uppercase">Prepared By</p></div>
            <div className="pt-4 border-t-2 border-slate-900"><p className="text-[10px] font-black uppercase">Authorized Signatory</p></div>
          </div>
        </div>,
        document.body
      )}
    </TooltipProvider>
  );
}
