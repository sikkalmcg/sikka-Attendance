
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
  Factory,
  Banknote
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
    if (userAssignedPlantIds) {
      list = list.filter(emp => (emp.unitIds || []).some(id => userAssignedPlantIds.includes(id)) || userAssignedPlantIds.includes(emp.unitId));
    }
    return list;
  }, [employees, selectedPlantId, userAssignedPlantIds]);

  const filterByAccess = (v: Voucher) => {
    if (!userAssignedPlantIds) return true;
    const emp = employees.find(e => e.id === v.employeeId);
    if (!emp) return false;
    return (emp.unitIds || []).some(id => userAssignedPlantIds.includes(id)) || userAssignedPlantIds.includes(emp.unitId);
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

  const handleRejectVoucher = () => {
    if (!voucherToReject || !rejectionRemark.trim() || isProcessing) return;
    setIsProcessing(true);
    try {
      updateRecord('vouchers', voucherToReject.id, { status: 'REJECTED', rejectionRemark, rejectedByName: verifiedUser?.fullName || "Manager" });
      toast({ variant: "destructive", title: "Voucher Rejected" });
      setVoucherToReject(null);
      setRejectionRemark("");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePostPay = () => {
    if (!voucherToPay || isProcessing) return;
    setIsProcessing(true);
    try {
      updateRecord('vouchers', voucherToPay.id, { 
        status: 'PAID', 
        paymentMode: payMode, 
        paymentReference: payRef, 
        paidDate: payDate 
      });
      toast({ title: "Payment Successful" });
      setIsPayDialogOpen(false); 
      setVoucherToPay(null);
    } finally { setIsProcessing(false); }
  };

  const handleVoucherClick = (v: Voucher) => {
    window.open(`/dashboard/vouchers/view/${v.id}`, '_blank');
  };

  if (!isMounted) return null;

  const getEmpData = (id: string) => employees.find(e => e.id === id);

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Voucher Management</h1>
        <p className="text-muted-foreground text-sm font-medium uppercase tracking-widest mt-1">Managed Advance Ledger & Disbursements</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-slate-100 p-1 rounded-xl h-12 w-full max-w-lg grid grid-cols-4 mb-8">
          <TabsTrigger value="create" className="font-bold text-xs">Create</TabsTrigger>
          <TabsTrigger value="approve" className="font-bold text-xs">Approve</TabsTrigger>
          <TabsTrigger value="payment" className="font-bold text-xs">Disburse</TabsTrigger>
          <TabsTrigger value="history" className="font-bold text-xs">History</TabsTrigger>
        </TabsList>
        
        <TabsContent value="create">
          <Card className="max-w-3xl mx-auto shadow-2xl border-none overflow-hidden rounded-3xl">
            <div className="h-2 bg-primary" />
            <CardHeader className="p-8">
              <CardTitle className="text-2xl font-black flex items-center gap-3">
                 <Wallet className="w-8 h-8 text-primary" /> Generate Advance Voucher
              </CardTitle>
            </CardHeader>
            <form onSubmit={handleCreateVoucher}>
              <CardContent className="px-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">Voucher Reference</Label>
                    <Input value={voucherNo} disabled className="h-12 bg-slate-50 font-mono font-black border-slate-200" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">Facility Filter</Label>
                    <Select value={selectedPlantId} onValueChange={setSelectedPlantId}>
                      <SelectTrigger className="h-12 bg-white"><SelectValue placeholder="All Authorized Plants"/></SelectTrigger>
                      <SelectContent>
                        {plants.filter(p => !userAssignedPlantIds || userAssignedPlantIds.includes(p.id)).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">Employee *</Label>
                    <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                      <SelectTrigger className="h-12 bg-white"><SelectValue placeholder="Select Staff Member"/></SelectTrigger>
                      <SelectContent>
                        {filteredEmployeesForSelection.map(e => <SelectItem key={e.id} value={e.id} className="font-bold">{e.name} ({e.employeeId})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">Amount (INR) *</Label>
                    <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="h-12 text-lg font-black text-emerald-600" placeholder="0.00" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">Advance Purpose *</Label>
                    <Input value={purpose} onChange={e => setPurpose(e.target.value)} className="h-12" />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="bg-slate-50 border-t justify-end p-8">
                <Button type="submit" className="px-12 h-14 font-black bg-slate-900 text-white hover:bg-primary transition-all rounded-xl shadow-xl shadow-slate-200">
                  Submit Advance Request
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>
        
        <TabsContent value="approve">
          <Card className="border-slate-200 shadow-sm overflow-hidden rounded-2xl">
            <CardHeader className="bg-slate-50/50 border-b p-4">
               <div className="relative max-w-md"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"/><Input placeholder="Search vouchers..." className="pl-10 h-10" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/></div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="w-full">
                <Table className="min-w-[1400px]">
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest px-6 py-4">Voucher No</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest">Voucher Date</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-primary">Created By</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest">Employee Name</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest">Department</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest">Designation</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest">Purpose</TableHead>
                      <TableHead className="text-right font-black text-[10px] uppercase tracking-widest">Amount</TableHead>
                      <TableHead className="text-right pr-8 font-black text-[10px] uppercase tracking-widest">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPendingVouchers.length === 0 ? (
                      <TableRow><TableCell colSpan={9} className="text-center py-20 text-muted-foreground font-bold italic">No pending approvals.</TableCell></TableRow>
                    ) : (
                      filteredPendingVouchers.map(v => {
                        const emp = getEmpData(v.employeeId);
                        return (
                          <TableRow key={v.id} className="hover:bg-slate-50/50">
                            <TableCell className="px-6 py-4 font-mono text-blue-600 font-bold">
                              <button onClick={() => handleVoucherClick(v)} className="hover:underline text-left">{v.voucherNo}</button>
                            </TableCell>
                            <TableCell className="text-xs font-bold text-slate-500">{formatDate(v.date)}</TableCell>
                            <TableCell className="text-[10px] font-bold text-primary uppercase">{v.createdByName || "---"}</TableCell>
                            <TableCell className="font-black text-slate-900 uppercase text-xs">{emp?.name || "N/A"}</TableCell>
                            <TableCell className="text-xs font-bold text-slate-600">{emp?.department || "N/A"}</TableCell>
                            <TableCell className="text-[10px] text-muted-foreground font-medium uppercase">{emp?.designation || "N/A"}</TableCell>
                            <TableCell className="text-xs font-medium text-slate-500 max-w-[200px] truncate">{v.purpose}</TableCell>
                            <TableCell className="text-right font-black text-emerald-600">{formatCurrency(v.amount)}</TableCell>
                            <TableCell className="text-right pr-8">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500" onClick={() => setVoucherToReject(v)}>
                                   <XCircle className="w-4 h-4" />
                                </Button>
                                <Button size="sm" className="h-8 bg-emerald-600 text-white font-black text-[10px] uppercase rounded-lg" onClick={() => handleApproveVoucher(v)}>Approve</Button>
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

        <TabsContent value="payment">
          <Card className="border-slate-200 shadow-sm overflow-hidden rounded-2xl">
            <CardHeader className="bg-slate-50/50 border-b p-4">
               <div className="relative max-w-md"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"/><Input placeholder="Search for payment..." className="pl-10 h-10" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/></div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="w-full">
                <Table className="min-w-[1700px]">
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest px-6 py-4">Voucher No</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest">Voucher Date</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-primary">Created By</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-emerald-600">Approved By</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest">Employee Name</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest">Department</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest">Designation</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest">Purpose</TableHead>
                      <TableHead className="text-right font-black text-[10px] uppercase tracking-widest">Amount</TableHead>
                      <TableHead className="text-right pr-8 font-black text-[10px] uppercase tracking-widest">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentTabLists.pending.length === 0 ? (
                      <TableRow><TableCell colSpan={10} className="text-center py-20 text-muted-foreground font-bold italic">No vouchers awaiting disbursement.</TableCell></TableRow>
                    ) : (
                      paymentTabLists.pending.map(v => {
                        const emp = getEmpData(v.employeeId);
                        return (
                          <TableRow key={v.id} className="hover:bg-slate-50/50">
                            <TableCell className="px-6 py-4 font-mono text-blue-600 font-bold">
                              <button onClick={() => handleVoucherClick(v)} className="hover:underline text-left">{v.voucherNo}</button>
                            </TableCell>
                            <TableCell className="text-xs font-bold text-slate-500">{formatDate(v.date)}</TableCell>
                            <TableCell className="text-[10px] font-bold text-primary uppercase">{v.createdByName || "---"}</TableCell>
                            <TableCell className="text-[10px] font-bold text-emerald-600 uppercase">{v.approvedByName || "---"}</TableCell>
                            <TableCell className="font-black text-slate-900 uppercase text-xs">{emp?.name || "N/A"}</TableCell>
                            <TableCell className="text-xs font-bold text-slate-600">{emp?.department || "N/A"}</TableCell>
                            <TableCell className="text-[10px] text-muted-foreground font-medium uppercase">{emp?.designation || "N/A"}</TableCell>
                            <TableCell className="text-xs font-medium text-slate-500 max-w-[200px] truncate">{v.purpose}</TableCell>
                            <TableCell className="text-right font-black text-emerald-600">{formatCurrency(v.amount)}</TableCell>
                            <TableCell className="text-right pr-8">
                               <Button size="sm" className="h-8 bg-primary text-white font-black text-[10px] uppercase rounded-lg gap-2" onClick={() => { setVoucherToPay(v); setPayAmount(v.amount.toString()); setIsPayDialogOpen(true); }}>
                                 <Banknote className="w-3.5 h-3.5" /> Pay
                               </Button>
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

        <TabsContent value="history">
          <Card className="border-slate-200 shadow-sm overflow-hidden rounded-2xl">
            <CardHeader className="bg-slate-50/50 border-b flex justify-between items-center p-4">
               <CardTitle className="text-sm font-black uppercase text-slate-400">Payment Audit Trail</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
               <ScrollArea className="w-full">
                  <Table className="min-w-[1400px]">
                     <TableHeader className="bg-slate-50">
                        <TableRow>
                           <TableHead className="font-black text-[10px] px-6 py-4 uppercase">Voucher Number</TableHead>
                           <TableHead className="font-black text-[10px] uppercase">Date</TableHead>
                           <TableHead className="font-black text-[10px] uppercase text-primary">Created By</TableHead>
                           <TableHead className="font-black text-[10px] uppercase text-emerald-600">Approved By</TableHead>
                           <TableHead className="font-black text-[10px] uppercase">Staff Name</TableHead>
                           <TableHead className="font-black text-[10px] uppercase text-right">Amount</TableHead>
                           <TableHead className="font-black text-[10px] uppercase">Paid Date</TableHead>
                           <TableHead className="font-black text-[10px] uppercase">Mode</TableHead>
                           <TableHead className="font-black text-[10px] uppercase text-center">Status</TableHead>
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {paymentTabLists.paid.length === 0 ? (
                           <TableRow><TableCell colSpan={9} className="text-center py-20 text-muted-foreground font-bold">No history available.</TableCell></TableRow>
                        ) : (
                           paymentTabLists.paid.map(v => (
                              <TableRow key={v.id}>
                                 <TableCell className="px-6 py-4 font-mono text-xs font-bold text-slate-500">
                                    <button onClick={() => handleVoucherClick(v)} className="hover:underline text-left">{v.voucherNo}</button>
                                 </TableCell>
                                 <TableCell className="text-xs font-bold text-slate-500">{formatDate(v.date)}</TableCell>
                                 <TableCell className="text-[10px] font-bold text-primary uppercase">{v.createdByName || "---"}</TableCell>
                                 <TableCell className="text-[10px] font-bold text-emerald-600 uppercase">{v.approvedByName || "---"}</TableCell>
                                 <TableCell className="font-bold uppercase text-xs">{getEmpData(v.employeeId)?.name}</TableCell>
                                 <TableCell className="text-right font-black text-emerald-600">{formatCurrency(v.amount)}</TableCell>
                                 <TableCell className="text-xs font-bold text-slate-400">{formatDate(v.paidDate || v.date)}</TableCell>
                                 <TableCell className="text-[10px] font-black uppercase text-slate-500">{v.paymentMode}</TableCell>
                                 <TableCell className="text-center"><Badge className="bg-emerald-50 text-emerald-700 text-[10px] uppercase border-none">Disbursed</Badge></TableCell>
                              </TableRow>
                           ))
                        )}
                     </TableBody>
                  </Table>
               </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Pay Disbursement Dialog */}
      <Dialog open={isPayDialogOpen} onOpenChange={setIsPayDialogOpen}>
         <DialogContent className="sm:max-w-md rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
            <DialogHeader className="p-8 bg-slate-900 text-white shrink-0">
               <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
                  <Banknote className="w-7 h-7 text-primary" /> Disburse Payment
               </DialogTitle>
               <div className="mt-4 pt-4 border-t border-white/10">
                  <p className="text-lg font-black text-primary uppercase">{getEmpData(voucherToPay?.employeeId || "")?.name}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                     {getEmpData(voucherToPay?.employeeId || "")?.department} / {getEmpData(voucherToPay?.employeeId || "")?.designation}
                  </p>
               </div>
            </DialogHeader>
            <div className="p-8 space-y-6 bg-slate-50/50">
               <div className="p-6 bg-white rounded-2xl border-2 border-primary/10 shadow-sm flex flex-col items-center">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Approved Voucher Amount</span>
                  <span className="text-4xl font-black text-emerald-600">{formatCurrency(voucherToPay?.amount || 0)}</span>
               </div>

               <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-500">Payment Mode</Label>
                     <Select value={payMode} onValueChange={(v: any) => setPayMode(v)}>
                        <SelectTrigger className="h-12 bg-white font-bold"><SelectValue /></SelectTrigger>
                        <SelectContent>
                           <SelectItem value="BANKING" className="font-bold">Banking / Transfer</SelectItem>
                           <SelectItem value="CASH" className="font-bold">Petty Cash</SelectItem>
                        </SelectContent>
                     </Select>
                  </div>

                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-500">Payment Date</Label>
                     <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className="h-12 bg-white font-bold" />
                  </div>

                  {payMode === 'BANKING' && (
                     <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                        <Label className="text-[10px] font-black uppercase text-slate-500">Reference / UTR Number *</Label>
                        <Input placeholder="Enter transaction ID..." value={payRef} onChange={(e) => setPayRef(e.target.value)} className="h-12 bg-white font-mono font-bold" />
                     </div>
                  )}
               </div>
            </div>
            <DialogFooter className="p-6 bg-white border-t flex flex-col gap-3">
               <Button className="w-full h-14 font-black bg-emerald-600 hover:bg-emerald-700 text-white text-lg rounded-2xl shadow-xl shadow-emerald-100" onClick={handlePostPay} disabled={isProcessing || (payMode === 'BANKING' && !payRef.trim())}>
                  Confirm & Release Funds
               </Button>
               <Button variant="ghost" className="w-full h-10 font-bold text-slate-400" onClick={() => setIsPayDialogOpen(false)}>Cancel</Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>

      {/* Reject Voucher Dialog */}
      <Dialog open={!!voucherToReject} onOpenChange={(o) => !o && setVoucherToReject(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="p-6 bg-rose-600 text-white shrink-0">
             <DialogTitle className="flex items-center gap-2"><XCircle className="w-6 h-6" /> Reject Advance Request</DialogTitle>
          </DialogHeader>
          <div className="p-8 space-y-4">
             <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Rejection Reason *</Label>
             <Textarea placeholder="Specify reason for denial..." value={rejectionRemark} onChange={(e) => setRejectionRemark(e.target.value)} className="min-h-[120px] bg-slate-50" />
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t flex gap-2">
             <Button variant="ghost" onClick={() => setVoucherToReject(null)} className="flex-1 rounded-xl font-bold">Cancel</Button>
             <Button variant="destructive" onClick={handleRejectVoucher} disabled={!rejectionRemark.trim() || isProcessing} className="flex-1 font-black rounded-xl">Confirm Rejection</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function VoucherDocumentContent({ voucher, employees, firms, plants, isPrintMode = false }: any) { 
  const employee = employees.find((e: any) => e.id === voucher.employeeId);
  const firm = firms.find((f: any) => f.id === (employee?.firmId || voucher.firmId));
  const amountInWords = numberToIndianWords(voucher.amount);

  return (
    <div className={cn(
      "w-[210mm] min-h-[297mm] bg-white p-[15mm] flex flex-col font-calibri text-slate-900",
      !isPrintMode && "shadow-2xl mx-auto border border-slate-200"
    )}>
      {/* Top Header */}
      <div className="flex justify-between items-start border-b-4 border-slate-900 pb-8 mb-10">
        <div className="flex-1 space-y-4">
          {firm?.logo ? (
            <div className="w-32 h-20 relative">
              <img src={firm.logo} alt="Firm Logo" className="object-contain w-full h-full object-left" />
            </div>
          ) : (
            <div className="w-32 h-20 bg-slate-100 flex items-center justify-center rounded-lg border-2 border-dashed border-slate-200">
               <Building2 className="w-8 h-8 text-slate-300" />
            </div>
          )}
          <div className="space-y-1">
            <h2 className="text-2xl font-black uppercase text-slate-900 leading-tight">{firm?.name}</h2>
            <p className="text-[11px] font-bold text-slate-600 uppercase max-w-[300px] leading-relaxed">{firm?.registeredAddress}</p>
            <div className="flex flex-col gap-0.5 text-[11px] font-black uppercase text-slate-500 mt-2">
               <span>GSTIN: {firm?.gstin}</span>
               <span>PAN: {firm?.pan}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 text-center flex flex-col items-center pt-10">
          <div className="border-4 border-slate-900 px-8 py-3 bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <h1 className="text-3xl font-black tracking-tighter uppercase">PAYMENT VOUCHER</h1>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-end space-y-4 text-right pt-2">
           <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Voucher Name</p>
              <p className="text-xl font-black font-mono text-blue-600">{voucher.voucherNo}</p>
           </div>
           <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Voucher Date</p>
              <p className="text-sm font-black">{formatDate(voucher.date)}</p>
           </div>
           <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Created By</p>
              <p className="text-[11px] font-bold uppercase">{voucher.createdByName || "SYSTEM"}</p>
           </div>
           {voucher.approvedByName && (
             <div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Approved By</p>
                <p className="text-[11px] font-bold uppercase text-emerald-600">{voucher.approvedByName}</p>
             </div>
           )}
        </div>
      </div>

      {/* Employee Identity Section */}
      <div className="mb-12">
        <div className="flex items-center gap-3 mb-4">
           <div className="h-6 w-1.5 bg-slate-900 rounded-full" />
           <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Employee Identity</h3>
        </div>
        <table className="w-full border-collapse border-2 border-slate-900 text-left">
          <tbody>
            <tr>
              <th className="border-2 border-slate-900 p-4 w-1/4 bg-slate-50 text-[10px] font-black uppercase text-slate-500">Employee Name / ID</th>
              <td className="border-2 border-slate-900 p-4 w-1/4 font-black uppercase text-sm">{employee?.name} / {employee?.employeeId}</td>
              <th className="border-2 border-slate-900 p-4 w-1/4 bg-slate-50 text-[10px] font-black uppercase text-slate-500">Plant Location</th>
              <td className="border-2 border-slate-900 p-4 w-1/4 font-bold uppercase text-xs">
                {employee?.unitIds?.map((id:string) => plants.find((p:any) => p.id === id)?.name).filter(Boolean).join(", ") || "UNASSIGNED"}
              </td>
            </tr>
            <tr>
              <th className="border-2 border-slate-900 p-4 bg-slate-50 text-[10px] font-black uppercase text-slate-500">Department / Designation</th>
              <td className="border-2 border-slate-900 p-4 font-bold uppercase text-xs leading-tight">
                {employee?.department} <br/> <span className="text-[10px] text-slate-400">{employee?.designation}</span>
              </td>
              <th className="border-2 border-slate-900 p-4 bg-slate-50 text-[10px] font-black uppercase text-slate-500">Aadhar Number</th>
              <td className="border-2 border-slate-900 p-4 font-mono font-bold text-sm tracking-widest">{employee?.aadhaar}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Voucher Details Section */}
      <div className="mb-14">
        <div className="flex items-center gap-3 mb-4">
           <div className="h-6 w-1.5 bg-slate-900 rounded-full" />
           <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Voucher Details</h3>
        </div>
        <table className="w-full border-collapse border-2 border-slate-900 text-left">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="border-2 border-slate-900 p-4 text-[10px] font-black uppercase tracking-widest w-2/3">Description / Purpose</th>
              <th className="border-2 border-slate-900 p-4 text-[10px] font-black uppercase tracking-widest text-right w-1/3">Amount (INR)</th>
            </tr>
          </thead>
          <tbody>
            <tr className="h-32">
              <td className="border-2 border-slate-900 p-6 align-top">
                 <p className="font-black text-slate-800 text-lg uppercase leading-tight tracking-tight">{voucher.purpose}</p>
                 <p className="text-[10px] font-bold text-slate-400 mt-2 italic uppercase">Authorized Advance Payment</p>
              </td>
              <td className="border-2 border-slate-900 p-6 align-top text-right bg-slate-50/50">
                 <p className="text-4xl font-black text-slate-900 tracking-tighter">{formatCurrency(voucher.amount)}</p>
              </td>
            </tr>
            <tr className="bg-slate-100/50">
              <td colSpan={2} className="border-2 border-slate-900 p-6">
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Amount in Words</span>
                  <span className="text-lg font-black uppercase tracking-tight italic decoration-slate-300 underline underline-offset-8 leading-tight">
                    {amountInWords}
                  </span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Terms & Conditions Section */}
      <div className="mb-24 space-y-3 px-2">
        <div className="flex items-center gap-2">
           <Info className="w-3.5 h-3.5 text-slate-400" />
           <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Terms & Conditions</h4>
        </div>
        <p className="text-[10px] font-bold text-slate-500 italic leading-relaxed text-justify">
          Advance payment issued to employee shall be recovered in favor of the firm as per company policy, either through salary adjustment or direct reimbursement. 
          By accepting this payment, the employee agrees to the deduction of this amount from their future payroll cycles.
        </p>
      </div>

      {/* Signature Section */}
      <div className="mt-auto grid grid-cols-2 gap-24 pt-16 border-t border-slate-100">
        <div className="flex flex-col items-center gap-6">
          <div className="w-full h-[1px] bg-slate-200" />
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">Receiver Signature</p>
        </div>
        <div className="flex flex-col items-center gap-6">
          <div className="w-full h-[1px] bg-slate-200" />
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">Authorized Signature</p>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="mt-16 text-center border-t border-slate-50 pt-6">
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.4em] leading-none mb-2">
          Sikka Industries & Logistics HRMS
        </p>
        <p className="text-[8px] font-medium text-slate-300 uppercase tracking-widest">
          This voucher is generated digitally and it is valid as an original document.
        </p>
      </div>
    </div>
  );
}
