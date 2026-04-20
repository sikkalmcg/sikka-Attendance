
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
  FileText
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
  const { employees, firms, vouchers, addRecord, updateRecord } = useData();
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
    return (vouchers || []).filter(v => 
      v.status === 'PENDING' && 
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

  if (!isMounted) return null;

  return (
    <TooltipProvider>
      <div className="space-y-6 print:hidden">
        <div>
          <h1 className="text-2xl font-bold">Advance Voucher System</h1>
          <p className="text-muted-foreground">Manage employee advance payments and authorized disbursements.</p>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-xl grid-cols-3 mb-8 bg-slate-100 p-1 rounded-xl h-12">
            <TabsTrigger value="create" className="font-semibold">Create Voucher</TabsTrigger>
            <TabsTrigger value="approve" className="font-semibold">Approve Voucher</TabsTrigger>
            <TabsTrigger value="payment" className="font-semibold">Voucher Payments</TabsTrigger>
          </TabsList>
          
          <TabsContent value="create">
            <Card className="max-w-4xl mx-auto shadow-xl border-none overflow-hidden">
              <CardHeader className="bg-slate-50 border-b flex flex-row items-center justify-between">
                <CardTitle>Generate New Voucher</CardTitle>
                <Badge variant="outline" className="font-black bg-white">{voucherNo}</Badge>
              </CardHeader>
              <form onSubmit={handleCreateVoucher}>
                <CardContent className="p-8 space-y-8">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <Label className="font-bold">Voucher Number</Label>
                      <Input value={voucherNo} disabled className="h-12 font-bold bg-slate-50" />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bold">Date *</Label>
                      <Input type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} className="h-12" min={PROJECT_START_DATE_STR} />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bold">Select Employee *</Label>
                      <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder="Select Employee" />
                        </SelectTrigger>
                        <SelectContent>
                          {employees.map(emp => (
                            <SelectItem key={emp.id} value={emp.id}>
                              {emp.name} ({emp.employeeId})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bold">Amount (INR) *</Label>
                      <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-12" placeholder="Enter amount" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold">Purpose *</Label>
                    <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} className="h-12" placeholder="Specify reason for advance..." />
                  </div>
                </CardContent>
                <CardFooter className="bg-slate-50 border-t flex justify-end p-6">
                  <Button className="px-12 h-12 font-bold shadow-lg shadow-primary/20" type="submit">Send for Approval</Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>

          <TabsContent value="approve">
            <Card className="shadow-sm border-slate-200 overflow-hidden">
              <CardHeader className="bg-slate-50/50 p-6 flex flex-row items-center justify-between border-b">
                <CardTitle className="text-lg">Pending Approvals ({filteredPendingVouchers.length})</CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search pending..." className="pl-10 h-10 bg-white" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="font-bold">Voucher No</TableHead>
                      <TableHead className="font-bold">Name</TableHead>
                      <TableHead className="font-bold">Dept / Desig</TableHead>
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
                            <TableCell className="font-mono font-bold text-primary cursor-pointer hover:underline" onClick={() => {setPreviewVoucher(v); setIsPreviewOpen(true);}}>{v.voucherNo}</TableCell>
                            <TableCell className="font-bold uppercase text-slate-700">{emp?.name}</TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-slate-600">{emp?.department}</span>
                                <span className="text-[10px] text-muted-foreground uppercase">{emp?.designation}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm font-medium">{v.date}</TableCell>
                            <TableCell className="text-right font-black text-slate-900">{formatCurrency(v.amount)}</TableCell>
                            <TableCell className="text-right pr-6">
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="outline" className="text-rose-600 border-rose-200 hover:bg-rose-50 font-bold" onClick={() => setVoucherToReject(v.id)}>Reject</Button>
                                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 font-bold h-8 px-6 shadow-sm" onClick={() => updateRecord('vouchers', v.id, { status: 'APPROVED' })}>Approve</Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
              {totalPagesPending > 1 && <StandardPaginationFooter current={pendingPage} total={totalPagesPending} onPageChange={setPendingPage} />}
            </Card>
          </TabsContent>

          <TabsContent value="payment" className="space-y-12">
            <Card className="shadow-sm border-slate-200 overflow-hidden">
              <CardHeader className="bg-slate-50/50 p-6 flex flex-row items-center justify-between border-b">
                <CardTitle className="text-lg">Ready for Payment ({paymentTabLists.pending.length})</CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search payable..." className="pl-10 h-10 bg-white" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="font-bold">Voucher No</TableHead>
                      <TableHead className="font-bold">Name</TableHead>
                      <TableHead className="font-bold">Dept / Desig</TableHead>
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
                            <TableCell className="font-mono font-bold text-primary cursor-pointer hover:underline" onClick={() => {setPreviewVoucher(v); setIsPreviewOpen(true);}}>{v.voucherNo}</TableCell>
                            <TableCell className="font-bold uppercase text-slate-700">{emp?.name}</TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-slate-600">{emp?.department}</span>
                                <span className="text-[10px] text-muted-foreground uppercase">{emp?.designation}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm font-medium">{v.date}</TableCell>
                            <TableCell className="text-right font-black text-slate-900">{formatCurrency(v.amount)}</TableCell>
                            <TableCell className="text-right pr-6">
                              <Button size="sm" className="font-bold px-6 bg-slate-900 shadow-sm" onClick={() => handleOpenPayDialog(v)}>Process Pay</Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
              {totalPagesPayable > 1 && <StandardPaginationFooter current={payablePage} total={totalPagesPayable} onPageChange={setPayablePage} />}
            </Card>

            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-black uppercase text-slate-700 flex items-center gap-2"><History className="w-4 h-4 text-primary" /> Paid Vouchers (History)</h3>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1 rounded-xl shadow-sm">
                    <Filter className="w-3 h-3 text-slate-400" />
                    <Select value={paidFromMonth} onValueChange={(v) => {setPaidFromMonth(v); if (paidToMonth < v) setPaidToMonth(v);}}>
                      <SelectTrigger className="h-7 w-24 border-none p-0 text-[10px] font-bold focus:ring-0"><SelectValue /></SelectTrigger>
                      <SelectContent>{VOUCHER_MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                    <span className="text-[10px] text-slate-300 font-bold">TO</span>
                    <Select value={paidToMonth} onValueChange={(v) => {if (v >= paidFromMonth) setPaidToMonth(v);}}>
                      <SelectTrigger className="h-7 w-24 border-none p-0 text-[10px] font-bold focus:ring-0"><SelectValue /></SelectTrigger>
                      <SelectContent>{VOUCHER_MONTHS.filter(m => {
                        const mOrder = [...VOUCHER_MONTHS].reverse();
                        return mOrder.indexOf(m) >= mOrder.indexOf(paidFromMonth);
                      }).map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Button variant="outline" size="sm" className="h-9 border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-bold gap-2" onClick={() => {}}>
                    <FileSpreadsheet className="w-4 h-4" /> Export Excel
                  </Button>
                </div>
              </div>
              <Card className="border-none shadow-sm overflow-hidden bg-slate-50/30">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-slate-100/50">
                      <TableRow>
                        <TableHead className="font-bold">Voucher No</TableHead>
                        <TableHead className="font-bold">Name</TableHead>
                        <TableHead className="font-bold">Dept / Desig</TableHead>
                        <TableHead className="font-bold text-center">Settled Date</TableHead>
                        <TableHead className="font-bold text-right">Amount</TableHead>
                        <TableHead className="font-bold text-right pr-6">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedPaid.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-20 text-muted-foreground italic">No historical records in this range.</TableCell></TableRow>
                      ) : (
                        paginatedPaid.map(v => {
                          const emp = employees.find(e => e.id === v.employeeId);
                          return (
                            <TableRow key={v.id} className="hover:bg-white/50 transition-colors">
                              <TableCell className="font-mono font-bold text-slate-600 cursor-pointer hover:underline" onClick={() => {setPreviewVoucher(v); setIsPreviewOpen(true);}}>{v.voucherNo}</TableCell>
                              <TableCell className="font-bold uppercase text-slate-600">{emp?.name}</TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="text-xs font-medium text-slate-500">{emp?.department}</span>
                                  <span className="text-[10px] text-muted-foreground uppercase">{emp?.designation}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-slate-500 text-center text-sm font-medium">{v.paidDate || v.date}</TableCell>
                              <TableCell className="text-right font-black text-emerald-600">{formatCurrency(v.amount)}</TableCell>
                              <TableCell className="text-right pr-6">
                                <div className="flex justify-end items-center gap-2">
                                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none uppercase text-[9px] font-black tracking-widest px-3">Settle-Paid</Badge>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400" onClick={() => handleDownloadAndPrint(v)}><Printer className="w-3.5 h-3.5" /></Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
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
        <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <DialogTitle className="flex items-center gap-2 font-black text-xl"><CreditCard className="w-5 h-5 text-primary" /> Process Disbursement</DialogTitle>
            <p className="text-[10px] text-primary font-black uppercase tracking-widest mt-1">Final Payment Settlement</p>
          </DialogHeader>
          <div className="p-8 space-y-6">
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 grid grid-cols-2 gap-4 shadow-inner">
              <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Voucher ID</p><p className="text-sm font-black text-slate-700">{voucherToPay?.voucherNo}</p></div>
              <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter text-right">Amount Due</p><p className="text-sm font-black text-rose-600 text-right">{formatCurrency(voucherToPay?.amount || 0)}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-500">Pay Mode</Label>
                <Select value={payMode} onValueChange={(v: any) => setPayMode(v)}>
                  <SelectTrigger className="h-12 font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BANKING">Banking Transfer</SelectItem>
                    <SelectItem value="CASH">Petty Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-500">Pay Date</Label>
                <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className="h-12 font-bold" min={PROJECT_START_DATE_STR} />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-500">Reference No / Txn ID</Label>
              <Input placeholder="Enter Banking Txn ID or Chq No" value={payRef} onChange={(e) => setPayRef(e.target.value)} className="h-12 font-bold" />
            </div>
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t gap-3">
            <Button variant="ghost" onClick={() => setIsPayDialogOpen(false)} className="flex-1 h-12 rounded-xl font-bold">Cancel</Button>
            <Button onClick={handlePostPay} disabled={isProcessing} className="flex-1 bg-primary hover:bg-primary/90 rounded-xl font-black h-12 shadow-xl shadow-primary/20">Confirm Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Voucher Preview Modal - India Compliant Design */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[95vh] p-0 overflow-hidden rounded-3xl border-none shadow-2xl">
          <ScrollArea className="h-full bg-white">
            {previewVoucher && <VoucherDocumentContent voucher={previewVoucher} employees={employees} firms={firms} />}
            <div className="p-8 bg-slate-50 border-t flex flex-col sm:flex-row justify-between items-center gap-4 print:hidden">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-slate-400" />
                <p className="text-[10px] font-bold text-slate-400 uppercase">Document Generated via SikkaTrack Portal</p>
              </div>
              <div className="flex gap-3 w-full sm:w-auto">
                <Button variant="ghost" onClick={() => setIsPreviewOpen(false)} className="flex-1 sm:flex-none rounded-xl font-bold h-11 px-8">Close</Button>
                <Button className="flex-1 sm:flex-none bg-primary hover:bg-primary/90 rounded-xl font-black h-11 px-10 gap-2 shadow-lg shadow-primary/20" onClick={() => handleDownloadAndPrint(previewVoucher!)}>
                  <Printer className="w-4 h-4" /> Print Voucher
                </Button>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Reject Alert */}
      <AlertDialog open={!!voucherToReject} onOpenChange={(o) => !o && setVoucherToReject(null)}>
        <AlertDialogContent className="rounded-2xl border-none shadow-2xl">
          <AlertDialogHeader>
            <div className="mx-auto w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-rose-500" />
            </div>
            <AlertDialogTitle className="text-center text-2xl font-black">Confirm Rejection</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-slate-500 font-medium">
              Are you sure you want to decline this advance request? This action will move the voucher to <strong>CANCELLED</strong> status and inform the applicant.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center gap-3 pt-6">
            <AlertDialogCancel className="rounded-xl font-bold px-8 h-12">Keep Pending</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-600 hover:bg-rose-700 rounded-xl font-black px-10 h-12 shadow-lg shadow-rose-100" onClick={() => {updateRecord('vouchers', voucherToReject!, {status: 'CANCELLED'}); setVoucherToReject(null); toast({title: "Voucher Cancelled"});}}>Confirm Reject</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Print Portal */}
      {isMounted && printVoucher && createPortal(
        <div className="print-only">
          <VoucherDocumentContent voucher={printVoucher} employees={employees} firms={firms} isPrintMode={true} />
        </div>,
        document.body
      )}
    </TooltipProvider>
  );
}

/**
 * Formal Voucher Document Component - India Compliant
 */
function VoucherDocumentContent({ voucher, employees, firms, isPrintMode = false }: { voucher: Voucher, employees: any[], firms: any[], isPrintMode?: boolean }) {
  const emp = employees.find(e => e.id === voucher.employeeId);
  const firm = firms.find(f => f.id === emp?.firmId);

  return (
    <div className={cn(
      "font-calibri text-slate-900 bg-white",
      isPrintMode ? "p-0" : "p-12"
    )}>
      {/* 1. Top Center Title Section */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-black uppercase tracking-[0.25em] border-b-4 border-slate-900 inline-block pb-1">Voucher</h1>
        <p className="text-sm font-bold text-slate-500 mt-2 uppercase tracking-widest">Payment Voucher / Advance Disbursement</p>
      </div>

      {/* 2. Header Section */}
      <div className="grid grid-cols-2 gap-10 border-b-2 border-slate-200 pb-8 mb-8">
        {/* Left Side: Firm Details */}
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            {firm?.logo ? (
              <img src={firm.logo} alt="Logo" className="w-16 h-16 object-contain" />
            ) : (
              <div className="w-16 h-16 bg-slate-900 rounded-lg flex items-center justify-center">
                <span className="text-white text-3xl font-black">S</span>
              </div>
            )}
            <div>
              <h2 className="text-xl font-black uppercase leading-tight">{firm?.name || "SIKKA INDUSTRIES & LOGISTICS"}</h2>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter max-w-[280px]">{firm?.registeredAddress}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-[11px] font-black uppercase">
            <div className="bg-slate-50 px-3 py-1.5 rounded border border-slate-100">
              <span className="text-slate-400 block text-[9px] mb-0.5">GSTIN</span>
              <span className="font-mono">{firm?.gstin || "---"}</span>
            </div>
            <div className="bg-slate-50 px-3 py-1.5 rounded border border-slate-100">
              <span className="text-slate-400 block text-[9px] mb-0.5">PAN</span>
              <span className="font-mono">{firm?.pan || "---"}</span>
            </div>
          </div>
        </div>

        {/* Right Side: Voucher Metadata */}
        <div className="flex flex-col justify-end items-end space-y-3">
          <div className="text-right w-full max-w-[240px]">
            <div className="flex justify-between border-b border-slate-100 py-1">
              <span className="text-[10px] font-black text-slate-400 uppercase">Voucher No</span>
              <span className="text-sm font-black font-mono">{voucher.voucherNo}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 py-1">
              <span className="text-[10px] font-black text-slate-400 uppercase">Date</span>
              <span className="text-sm font-black">{voucher.date}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 py-1">
              <span className="text-[10px] font-black text-slate-400 uppercase">Created By</span>
              <span className="text-xs font-bold uppercase">{voucher.createdByName || "System"}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 py-1">
              <span className="text-[10px] font-black text-slate-400 uppercase">Approved By</span>
              <span className="text-xs font-bold uppercase">{voucher.approvedByName || "Authorized Admin"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Employee / Receiver Details */}
      <div className="mb-10">
        <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3 flex items-center gap-2">
          <UserIcon className="w-3 h-3" /> Receiver / Employee Information
        </h3>
        <div className="border-2 border-slate-900 rounded-xl overflow-hidden grid grid-cols-2 md:grid-cols-4">
          <div className="p-4 border-r-2 border-b-2 md:border-b-0 border-slate-900 bg-slate-50/50">
            <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Employee ID</span>
            <span className="text-sm font-black font-mono text-primary">{emp?.employeeId || "---"}</span>
          </div>
          <div className="p-4 border-r-2 border-b-2 md:border-b-0 border-slate-900">
            <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Full Name</span>
            <span className="text-sm font-black uppercase">{emp?.name || "---"}</span>
          </div>
          <div className="p-4 border-r-2 border-slate-900 bg-slate-50/50">
            <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Department</span>
            <span className="text-sm font-black uppercase">{emp?.department || "---"}</span>
          </div>
          <div className="p-4">
            <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Designation</span>
            <span className="text-sm font-black uppercase truncate">{emp?.designation || "---"}</span>
          </div>
        </div>
        {emp?.aadhaar && (
           <p className="text-[8px] font-bold text-slate-400 uppercase mt-2 text-right tracking-widest italic">
             Identity Verified via Aadhaar: **** **** {emp.aadhaar.slice(-4)}
           </p>
        )}
      </div>

      {/* 4. Transaction Details */}
      <div className="space-y-8 mb-16">
        <div>
          <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Amount Authorized</h3>
          <div className="flex items-stretch gap-4">
            <div className="bg-slate-900 text-white px-8 py-4 rounded-xl flex items-center justify-center min-w-[220px]">
              <span className="text-4xl font-black">{formatCurrency(voucher.amount)}</span>
            </div>
            <div className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-xl p-4 flex flex-col justify-center">
              <span className="text-[9px] font-black text-slate-400 uppercase mb-1">Amount in Words</span>
              <span className="text-sm font-bold italic text-slate-700 leading-tight">
                {numberToIndianWords(voucher.amount)}
              </span>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Purpose of Payment / Description</h3>
          <div className="border-2 border-slate-900 p-6 rounded-2xl bg-white min-h-[120px] relative">
            <p className="text-lg font-medium italic text-slate-600 leading-relaxed">"{voucher.purpose}"</p>
            <div className="absolute top-4 right-6 opacity-5">
              <FileText className="w-16 h-16" />
            </div>
          </div>
        </div>
      </div>

      {/* 5. Footer Section: Signatures */}
      <div className="grid grid-cols-2 gap-20 px-10 mb-16">
        <div className="text-center pt-10 border-t-2 border-dashed border-slate-300 space-y-2">
          <p className="text-xs font-black uppercase tracking-widest text-slate-800">Receiver's Signature</p>
          <p className="text-[10px] font-bold text-slate-400 italic">(Signed upon receipt of funds)</p>
        </div>
        <div className="text-center pt-10 border-t-2 border-dashed border-slate-300 space-y-2">
          <p className="text-xs font-black uppercase tracking-widest text-slate-800">Authorized Signatory</p>
          <p className="text-[10px] font-bold text-slate-400 italic">(For {firm?.name || "The Organization"})</p>
        </div>
      </div>

      {/* 6. Legal Note (India Context) */}
      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
        <div className="flex gap-4 items-start">
          <ShieldCheck className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
          <p className="text-[9px] leading-relaxed text-slate-500 font-medium text-justify">
            <strong>COMPLIANCE NOTE:</strong> This voucher is issued for internal accounting purposes and complies with applicable provisions of the 
            <strong> Income Tax Act, 1961</strong> and <strong>Goods and Services Tax Act, 2017</strong>. All transactions recorded herein are subject 
            to periodic audit and management verification. Any fraudulent claims or unauthorized use of this document will result in strict disciplinary 
            and legal action. Aadhaar details, if recorded for verification, are handled in accordance with applicable data protection and privacy 
            regulations of the Government of India.
          </p>
        </div>
      </div>

      {/* 7. Footer Metadata */}
      <div className="mt-8 flex justify-between items-center text-[8px] font-black uppercase text-slate-300 tracking-[0.3em]">
        <span>Digitally Authenticated</span>
        <span>SikkaTrack HRMS Enterprise Node</span>
        <span>Original Document</span>
      </div>
    </div>
  );
}

