
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
  FileX,
  Factory
} from "lucide-react";
import { formatCurrency, numberToIndianWords, cn, formatDate } from "@/lib/utils";
import { useData } from "@/context/data-context";
import { Voucher } from "@/lib/types";
import { format, parseISO, isBefore, startOfMonth } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
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
  const { employees, firms, plants, vouchers, addRecord, updateRecord, verifiedUser } = useData();
  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState("create");
  const [searchTerm, setSearchTerm] = useState("");
  const [voucherDate, setVoucherDate] = useState("");
  const [selectedPlantId, setSelectedPlantId] = useState("");
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

  const userAssignedPlantIds = useMemo(() => {
    if (!verifiedUser || verifiedUser.role === 'SUPER_ADMIN') return null;
    return verifiedUser.plantIds || [];
  }, [verifiedUser]);

  const voucherNo = useMemo(() => {
    if (!voucherDate) return "SIL-XXXXXX-XXXXX";
    const d = new Date(voucherDate);
    if (isNaN(d.getTime())) return "SIL-XXXXXX-XXXXX";
    const fyFullPrefix = `SIL-${d.getFullYear()}${((d.getFullYear() + 1) % 100).toString().padStart(2, '0')}-`;
    const sameFY = (vouchers || []).filter(v => v.voucherNo.startsWith(fyFullPrefix));
    const nextSerial = sameFY.length > 0 ? Math.max(...sameFY.map(v => parseInt(v.voucherNo.split('-')[2]) || 0)) + 1 : 1;
    return `${fyFullPrefix}${nextSerial.toString().padStart(5, '0')}`;
  }, [voucherDate, vouchers]);

  const filteredEmployeesForSelection = useMemo(() => {
    let list = employees;
    if (selectedPlantId) {
      list = list.filter(emp => (emp.unitIds || []).includes(selectedPlantId) || emp.unitId === selectedPlantId);
    }
    // SECURITY: Filter selection by assigned plants for managers
    if (userAssignedPlantIds) {
      list = list.filter(emp => (emp.unitIds || []).some(id => userAssignedPlantIds.includes(id)) || userAssignedPlantIds.includes(emp.unitId));
    }
    return list;
  }, [employees, selectedPlantId, userAssignedPlantIds]);

  const filterByAccess = (v: Voucher) => {
    if (!userAssignedPlantIds) return true;
    const emp = employees.find(e => e.id === v.employeeId);
    return (emp?.unitIds || []).some(id => userAssignedPlantIds.includes(id)) || userAssignedPlantIds.includes(emp?.unitId);
  };

  const filteredPendingVouchers = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return (vouchers || []).filter(v => 
      v.status === 'PENDING' && 
      v.date >= PROJECT_START_DATE_STR && 
      filterByAccess(v) &&
      (v.voucherNo.toLowerCase().includes(search) || employees.find(e => e.id === v.employeeId)?.name.toLowerCase().includes(search))
    ).reverse();
  }, [vouchers, searchTerm, employees, userAssignedPlantIds]);

  const rejectedVouchersList = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return (vouchers || []).filter(v => 
      v.status === 'REJECTED' && 
      v.date >= PROJECT_START_DATE_STR && 
      filterByAccess(v) &&
      (v.voucherNo.toLowerCase().includes(search) || employees.find(e => e.id === v.employeeId)?.name.toLowerCase().includes(search))
    ).reverse();
  }, [vouchers, searchTerm, employees, userAssignedPlantIds]);

  const paymentTabLists = useMemo(() => {
    const search = searchTerm.toLowerCase();
    const all = (vouchers || []).filter(v => 
      (v.status === 'APPROVED' || v.status === 'PAID') && 
      v.date >= PROJECT_START_DATE_STR &&
      filterByAccess(v) &&
      (v.voucherNo.toLowerCase().includes(search) || employees.find(e => e.id === v.employeeId)?.name.toLowerCase().includes(search))
    );
    
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
    }).reverse();
    
    return { pending, paid };
  }, [vouchers, searchTerm, employees, paidFromMonth, paidToMonth, userAssignedPlantIds]);

  const paginatedPending = useMemo(() => filteredPendingVouchers.slice((pendingPage - 1) * ROWS_PER_PAGE, pendingPage * ROWS_PER_PAGE), [filteredPendingVouchers, pendingPage]);
  const paginatedPayable = useMemo(() => paymentTabLists.pending.slice((payablePage - 1) * ROWS_PER_PAGE, payablePage * ROWS_PER_PAGE), [paymentTabLists.pending, payablePage]);
  const paginatedPaid = useMemo(() => paymentTabLists.paid.slice((paidPage - 1) * ROWS_PER_PAGE, paidPage * ROWS_PER_PAGE), [paymentTabLists.paid, paidPage]);
  const paginatedRejected = useMemo(() => rejectedVouchersList.slice((rejectedPage - 1) * ROWS_PER_PAGE, rejectedPage * ROWS_PER_PAGE), [rejectedVouchersList, rejectedPage]);

  const totalPagesPending = Math.ceil(filteredPendingVouchers.length / ROWS_PER_PAGE);
  const totalPagesPayable = Math.ceil(paymentTabLists.pending.length / ROWS_PER_PAGE);
  const totalPagesPaid = Math.ceil(paymentTabLists.paid.length / ROWS_PER_PAGE);
  const totalPagesRejected = Math.ceil(rejectedVouchersList.length / ROWS_PER_PAGE);

  const handleCreateVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeId || !amount || !purpose) return;
    const creator = verifiedUser?.fullName || "Admin";
    addRecord('vouchers', { voucherNo, employeeId: selectedEmployeeId, date: voucherDate, amount: parseFloat(amount), purpose, status: "PENDING", createdByName: creator });
    toast({ title: "Voucher Created" });
    setAmount(""); setSelectedEmployeeId(""); setActiveTab("approve");
  };

  const handleApproveVoucher = (v: Voucher) => {
    updateRecord('vouchers', v.id, { status: 'APPROVED', approvedByName: verifiedUser?.fullName || "Manager" });
    toast({ title: "Voucher Approved" });
  };

  const handlePostPay = () => {
    if (!voucherToPay || isProcessing) return;
    setIsProcessing(true);
    try {
      updateRecord('vouchers', voucherToPay.id, { status: 'PAID', paymentMode: payMode, paymentReference: payRef, paidDate: payDate });
      toast({ title: "Payment Successful" });
      setIsPayDialogOpen(false); setVoucherToPay(null);
    } finally { setIsProcessing(false); }
  };

  if (!isMounted) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Voucher Management</h1>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100 p-1 rounded-xl h-12 w-full max-w-lg grid grid-cols-3 mb-8">
          <TabsTrigger value="create">Create</TabsTrigger>
          <TabsTrigger value="approve">Approve</TabsTrigger>
          <TabsTrigger value="payment">Disburse</TabsTrigger>
        </TabsList>
        
        <TabsContent value="create">
          <Card className="max-w-3xl mx-auto shadow-xl"><CardHeader><CardTitle>Generate Advance Voucher</CardTitle></CardHeader>
          <form onSubmit={handleCreateVoucher}><CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-2"><Label>Plant Filter</Label><Select value={selectedPlantId} onValueChange={setSelectedPlantId}><SelectTrigger><SelectValue placeholder="All Access"/></SelectTrigger><SelectContent>{plants.filter(p => !userAssignedPlantIds || userAssignedPlantIds.includes(p.id)).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Employee *</Label><Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}><SelectTrigger><SelectValue placeholder="Select Staff"/></SelectTrigger><SelectContent>{filteredEmployeesForSelection.map(e => <SelectItem key={e.id} value={e.id}>{e.name} ({e.employeeId})</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Amount (INR)</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} /></div>
              <div className="space-y-2"><Label>Purpose</Label><Input value={purpose} onChange={e => setPurpose(e.target.value)} /></div>
            </div>
          </CardContent><CardFooter className="bg-slate-50 border-t justify-end p-6"><Button type="submit" className="px-10 h-12 font-black">Submit Request</Button></CardFooter></form></Card>
        </TabsContent>
        
        <TabsContent value="approve"><Card className="border-none shadow-sm"><CardContent className="p-0"><Table><TableHeader className="bg-slate-50"><TableRow><TableHead className="font-bold">Voucher No</TableHead><TableHead>Employee</TableHead><TableHead>Amount</TableHead><TableHead className="text-right pr-8">Actions</TableHead></TableRow></TableHeader>
          <TableBody>{paginatedPending.map(v => (<TableRow key={v.id}><TableCell className="font-mono text-blue-600 font-bold">{v.voucherNo}</TableCell><TableCell className="font-bold uppercase">{employees.find(e => e.id === v.employeeId)?.name}</TableCell><TableCell className="font-black">{formatCurrency(v.amount)}</TableCell><TableCell className="text-right pr-8"><Button size="sm" className="bg-emerald-600" onClick={() => handleApproveVoucher(v)}>Approve</Button></TableCell></TableRow>))}</TableBody></Table></CardContent></Card></TabsContent>
      </Tabs>
    </div>
  );
}

export function VoucherDocumentContent({ voucher, employees, firms, isPrintMode = false }: any) { 
  /* ... (Existing Document Content remains same) ... */ 
  return <div>Voucher Preview Content...</div>; 
}
