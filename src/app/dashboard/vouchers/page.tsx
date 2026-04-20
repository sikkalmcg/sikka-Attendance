
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
      const mIdx = monthOrder.indexOf(`${d.toLocaleString('en-US', { month: 'short' })}-${d.getFullYear().toString().slice(-2)}`);
      return fromIdx !== -1 && toIdx !== -1 && mIdx >= fromIdx && mIdx <= toIdx;
    });
    return { pending, paid };
  }, [voucherRecoveryLedger, searchTerm, employees, paidFromMonth, paidToMonth]);

  const paginatedPending = useMemo(() => filteredPendingVouchers.slice((pendingPage - 1) * ROWS_PER_PAGE, pendingPage * ROWS_PER_PAGE), [filteredPendingVouchers, pendingPage]);
  const paginatedPayable = useMemo(() => paymentTabLists.pending.slice((payablePage - 1) * ROWS_PER_PAGE, payablePage * ROWS_PER_PAGE), [paymentTabLists.pending, payablePage]);
  const paginatedPaid = useMemo(() => paymentTabLists.paid.slice((paidPage - 1) * ROWS_PER_PAGE, paidPage * ROWS_PER_PAGE), [paymentTabLists.paid, paidPage]);

  const StandardPaginationFooter = ({ current, total, onPageChange }: any) => (
    <CardFooter className="bg-slate-50 border-t flex flex-col sm:flex-row items-center justify-between p-4 gap-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={current === 1} onClick={() => onPageChange(current - 1)} className="font-bold h-9"><ChevronLeft className="w-4 h-4 mr-1" /> Previous</Button>
        <Button variant="outline" size="sm" disabled={current === total} onClick={() => onPageChange(current + 1)} className="font-bold h-9">Next <ChevronRight className="w-4 h-4 ml-1" /></Button>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Page {current} of {total}</span>
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
    const newV = { voucherNo, employeeId: selectedEmployeeId, date: voucherDate, amount: parseFloat(amount), purpose, status: "PENDING", createdByName: currentUser?.fullName || "Admin" };
    addRecord('vouchers', newV);
    toast({ title: "Voucher Created" });
    setActiveTab("approve");
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
              <form onSubmit={handleCreateVoucher}><CardContent className="p-8 space-y-8"><div className="grid grid-cols-1 sm:grid-cols-2 gap-8"><div className="space-y-2"><Label className="font-bold">Voucher Number</Label><Input value={voucherNo} disabled className="h-12 font-bold" /></div><div className="space-y-2"><Label className="font-bold">Date *</Label><Input type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} className="h-12" min={PROJECT_START_DATE_STR} /></div><div className="space-y-2"><Label className="font-bold">Select Employee *</Label><Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}><SelectTrigger className="h-12"><SelectValue placeholder="Select Employee" /></SelectTrigger><SelectContent>{employees.map(emp => <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label className="font-bold">Amount (INR) *</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-12" /></div></div><div className="space-y-2"><Label className="font-bold">Purpose *</Label><Input value={purpose} onChange={(e) => setPurpose(e.target.value)} className="h-12" /></div></CardContent><CardFooter className="bg-slate-50 border-t flex justify-end p-6"><Button className="px-12 h-12 font-bold">Create Voucher</Button></CardFooter></form>
            </Card>
          </TabsContent>
          <TabsContent value="approve"><Card className="shadow-sm overflow-hidden"><CardHeader className="bg-slate-50 p-6"><CardTitle>Pending Approvals</CardTitle></CardHeader><CardContent className="p-0"><Table><TableHeader className="bg-slate-50"><TableRow><TableHead className="font-bold">Voucher No</TableHead><TableHead className="font-bold">Name</TableHead><TableHead className="font-bold text-right pr-6">Actions</TableHead></TableRow></TableHeader><TableBody>{paginatedPending.map(v => (
            <TableRow key={v.id} className="hover:bg-slate-50/50"><TableCell className="font-mono font-bold">{v.voucherNo}</TableCell><TableCell className="font-bold">{employees.find(e => e.id === v.employeeId)?.name}</TableCell><TableCell className="text-right pr-6"><Button size="sm" className="bg-emerald-600 h-8" onClick={() => updateRecord('vouchers', v.id, { status: 'APPROVED' })}>Approve</Button></TableCell></TableRow>
          ))}</TableBody></Table></CardContent>{Math.ceil(filteredPendingVouchers.length / ROWS_PER_PAGE) > 1 && <StandardPaginationFooter current={pendingPage} total={Math.ceil(filteredPendingVouchers.length / ROWS_PER_PAGE)} onPageChange={setPendingPage} />}</Card></TabsContent>
          <TabsContent value="payment" className="space-y-12"><Card className="shadow-sm overflow-hidden"><CardHeader className="bg-slate-50 p-6"><CardTitle>Ready for Payment</CardTitle></CardHeader><CardContent className="p-0"><Table><TableHeader className="bg-slate-50"><TableRow><TableHead className="font-bold">Voucher No</TableHead><TableHead className="font-bold">Name</TableHead><TableHead className="font-bold text-right pr-6">Actions</TableHead></TableRow></TableHeader><TableBody>{paginatedPayable.map(v => (
            <TableRow key={v.id} className="hover:bg-slate-50/50"><TableCell className="font-mono font-bold">{v.voucherNo}</TableCell><TableCell className="font-bold">{employees.find(e => e.id === v.employeeId)?.name}</TableCell><TableCell className="text-right pr-6"><Button size="sm" onClick={() => handleOpenPayDialog(v)}>Process Pay</Button></TableCell></TableRow>
          ))}</TableBody></Table></CardContent>{Math.ceil(paymentTabLists.pending.length / ROWS_PER_PAGE) > 1 && <StandardPaginationFooter current={payablePage} total={Math.ceil(paymentTabLists.pending.length / ROWS_PER_PAGE)} onPageChange={setPayablePage} />}</Card>
            <div className="space-y-4"><h3 className="text-sm font-black uppercase text-slate-700">Paid Vouchers (History)</h3><Card className="border-none shadow-sm overflow-hidden bg-slate-50/30"><CardContent className="p-0"><Table><TableHeader className="bg-slate-100/50"><TableRow><TableHead className="font-bold">Voucher No</TableHead><TableHead className="font-bold">Name</TableHead><TableHead className="font-bold text-right pr-6">Amount</TableHead></TableRow></TableHeader><TableBody>{paginatedPaid.map(v => (
              <TableRow key={v.id} className="hover:bg-white/50"><TableCell className="font-mono font-bold">{v.voucherNo}</TableCell><TableCell className="font-bold">{employees.find(e => e.id === v.employeeId)?.name}</TableCell><TableCell className="text-right pr-6 font-bold">{formatCurrency(v.amount)}</TableCell></TableRow>
            ))}</TableBody></Table></CardContent>{Math.ceil(paymentTabLists.paid.length / ROWS_PER_PAGE) > 1 && <StandardPaginationFooter current={paidPage} total={Math.ceil(paymentTabLists.paid.length / ROWS_PER_PAGE)} onPageChange={setPaidPage} />}</Card></div>
          </TabsContent>
        </Tabs>
      </div>
      {/* Modals & Print Content omitted */}
    </TooltipProvider>
  );
}
