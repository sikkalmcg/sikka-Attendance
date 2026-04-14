
"use client";

import { useState, useMemo, useEffect } from "react";
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
  FileSpreadsheet
} from "lucide-react";
import { formatCurrency, numberToIndianWords, cn } from "@/lib/utils";
import { useData } from "@/context/data-context";
import { Voucher } from "@/lib/types";
import { format, parseISO } from "date-fns";
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
import { ScrollArea } from "@/components/ui/scroll-area";

export default function VouchersPage() {
  const { employees, firms, plants, vouchers, addRecord, updateRecord, deleteRecord } = useData();
  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState("create");
  const [searchTerm, setSearchTerm] = useState("");
  const [voucherDate, setVoucherDate] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const { toast } = useToast();

  // Pagination State
  const [pendingPage, setPendingPage] = useState(1);
  const [paymentPage, setPaymentPage] = useState(1);
  const rowsPerPage = 15;

  // State for Preview and Print
  const [previewVoucher, setPreviewVoucher] = useState<Voucher | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // State for Rejection Confirmation
  const [voucherToReject, setVoucherToReject] = useState<string | null>(null);

  // State for Payment Dialog
  const [isPayDialogOpen, setIsPayDialogOpen] = useState(false);
  const [voucherToPay, setVoucherToPay] = useState<Voucher | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState("");

  useEffect(() => {
    setIsMounted(true);
    setVoucherDate(new Date().toISOString().split('T')[0]);
    const savedUser = localStorage.getItem("user");
    if (savedUser) setCurrentUser(JSON.parse(savedUser));
  }, []);

  // Dynamic FY Sequential Voucher Number Calculation
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

  // Filtering Logic
  const filteredPendingVouchers = useMemo(() => {
    return (vouchers || []).filter(v => v.status === 'PENDING').filter(v => {
      const emp = employees.find(e => e.id === v.employeeId);
      const search = searchTerm.toLowerCase();
      return (
        v.voucherNo.toLowerCase().includes(search) ||
        (emp?.name || "").toLowerCase().includes(search) ||
        (emp?.employeeId || "").toLowerCase().includes(search)
      );
    }).reverse();
  }, [vouchers, searchTerm, employees]);

  const filteredPayableVouchers = useMemo(() => {
    return (vouchers || []).filter(v => v.status === 'APPROVED' || v.status === 'PAID').filter(v => {
      const emp = employees.find(e => e.id === v.employeeId);
      const search = searchTerm.toLowerCase();
      return (
        v.voucherNo.toLowerCase().includes(search) ||
        (emp?.name || "").toLowerCase().includes(search) ||
        (emp?.employeeId || "").toLowerCase().includes(search)
      );
    }).reverse();
  }, [vouchers, searchTerm, employees]);

  // Paginated Data
  const paginatedPending = useMemo(() => {
    const start = (pendingPage - 1) * rowsPerPage;
    return filteredPendingVouchers.slice(start, start + rowsPerPage);
  }, [filteredPendingVouchers, pendingPage]);

  const paginatedPayable = useMemo(() => {
    const start = (paymentPage - 1) * rowsPerPage;
    return filteredPayableVouchers.slice(start, start + rowsPerPage);
  }, [filteredPayableVouchers, paymentPage]);

  const totalPendingPages = Math.ceil(filteredPendingVouchers.length / rowsPerPage);
  const totalPaymentPages = Math.ceil(filteredPayableVouchers.length / rowsPerPage);

  const handleCreateVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeId || !amount || !purpose) {
      toast({ variant: "destructive", title: "Missing Fields", description: "Mandatory fields required." });
      return;
    }

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
    toast({ title: "Voucher Created", description: `Voucher #${voucherNo} generated.` });
    setSelectedEmployeeId("");
    setAmount("");
    setPurpose("");
    setActiveTab("approve");
  };

  const handleApproveVoucher = (id: string) => {
    updateRecord('vouchers', id, { 
      status: 'APPROVED', 
      approvedByName: currentUser?.fullName || "Admin" 
    });
    toast({ title: "Voucher Approved" });
  };

  const handleRejectConfirm = () => {
    if (!voucherToReject) return;
    deleteRecord('vouchers', voucherToReject);
    toast({ variant: "destructive", title: "Voucher Rejected" });
    setVoucherToReject(null);
  };

  const handleOpenPayDialog = (v: Voucher) => {
    setVoucherToPay(v);
    setPayAmount(v.amount.toString());
    setPayDate(new Date().toISOString().split('T')[0]);
    setIsPayDialogOpen(true);
  };

  const handleConfirmPayment = () => {
    if (!voucherToPay) return;
    updateRecord('vouchers', voucherToPay.id, { 
      status: 'PAID',
      date: payDate,
      amount: parseFloat(payAmount)
    });
    toast({ title: "Payment Recorded" });
    setIsPayDialogOpen(false);
    setVoucherToPay(null);
  };

  const handleExportExcel = (type: 'PENDING' | 'PAYMENT') => {
    const data = type === 'PENDING' ? filteredPendingVouchers : filteredPayableVouchers;
    if (data.length === 0) return;
    const headers = ["Voucher No", "Date", "Employee Name", "Amount", "Purpose", "Created By", "Approved By", "Status"];
    const csvContent = [
      headers.join(","),
      ...data.map(v => {
        const emp = employees.find(e => e.id === v.employeeId);
        return [
          v.voucherNo, v.date, `"${emp?.name || ""}"`, v.amount, `"${v.purpose}"`,
          `"${v.createdByName || ""}"`, `"${v.approvedByName || "--"}"`, v.status
        ].join(",");
      })
    ].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Vouchers_${type}_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
  };

  if (!isMounted) return null;

  return (
    <div className="space-y-6 print:hidden">
      <div>
        <h1 className="text-2xl font-bold">Advance Voucher System</h1>
        <p className="text-muted-foreground">Manage employee advance payments, approvals, and recovery ledger.</p>
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
                    <Input type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} className="h-12 bg-white" required />
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
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="sm" className="h-10 gap-2" onClick={() => handleExportExcel('PENDING')}>
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Export Excel
                  </Button>
                  <div className="relative w-80">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search..." className="pl-10 h-10 bg-white" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setPendingPage(1); }} />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="font-bold">Voucher No</TableHead>
                    <TableHead className="font-bold">Employee Name</TableHead>
                    <TableHead className="font-bold">Date</TableHead>
                    <TableHead className="font-bold">Amount</TableHead>
                    <TableHead className="font-bold text-primary">Created By</TableHead>
                    <TableHead className="text-right font-bold pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedPending.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No pending vouchers.</TableCell></TableRow>
                  ) : (
                    paginatedPending.map((v) => {
                      const emp = employees.find(e => e.id === v.employeeId);
                      return (
                        <TableRow key={v.id} className="hover:bg-slate-50/50">
                          <TableCell className="font-mono font-bold text-primary cursor-pointer hover:underline" onClick={() => { setPreviewVoucher(v); setIsPreviewOpen(true); }}>{v.voucherNo}</TableCell>
                          <TableCell className="font-bold">{emp?.name || "..."}</TableCell>
                          <TableCell className="text-sm">{v.date}</TableCell>
                          <TableCell className="font-bold text-emerald-600">{formatCurrency(v.amount)}</TableCell>
                          <TableCell className="text-xs font-bold text-primary">{v.createdByName}</TableCell>
                          <TableCell className="text-right pr-6">
                            <div className="flex justify-end gap-2">
                              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-8 text-xs" onClick={() => handleApproveVoucher(v.id)}><CheckCircle className="w-3 h-3 mr-1" /> Approve</Button>
                              <Button size="sm" variant="ghost" className="text-rose-600 h-8 text-xs" onClick={() => setVoucherToReject(v.id)}><XCircle className="w-3 h-3 mr-1" /> Reject</Button>
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
                <div className="text-xs font-bold text-muted-foreground">Showing {((pendingPage - 1) * rowsPerPage) + 1} - {Math.min(pendingPage * rowsPerPage, filteredPendingVouchers.length)} of {filteredPendingVouchers.length}</div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={pendingPage === 1} onClick={() => setPendingPage(p => p - 1)}><ChevronLeft className="w-4 h-4 mr-1" /> Previous</Button>
                  <div className="text-xs font-black px-4 bg-white h-8 flex items-center rounded-lg border">Page {pendingPage} of {totalPendingPages}</div>
                  <Button variant="outline" size="sm" disabled={pendingPage === totalPendingPages} onClick={() => setPendingPage(p => p + 1)}>Next <ChevronRight className="w-4 h-4 ml-1" /></Button>
                </div>
              </CardFooter>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="payment">
          <Card className="shadow-sm border-slate-200 overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-50 rounded-lg"><CreditCard className="w-5 h-5 text-emerald-600" /></div>
                  <CardTitle className="text-lg">Voucher Payments</CardTitle>
                </div>
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="sm" className="h-10 gap-2" onClick={() => handleExportExcel('PAYMENT')}>
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Export Excel
                  </Button>
                  <div className="relative w-80">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search..." className="pl-10 h-10 bg-white" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setPaymentPage(1); }} />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="font-bold">Voucher No</TableHead>
                    <TableHead className="font-bold">Employee Name</TableHead>
                    <TableHead className="font-bold">Amount</TableHead>
                    <TableHead className="font-bold text-primary">Created By</TableHead>
                    <TableHead className="font-bold text-emerald-600">Approved By</TableHead>
                    <TableHead className="font-bold">Status</TableHead>
                    <TableHead className="text-right font-bold pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedPayable.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No vouchers for payment.</TableCell></TableRow>
                  ) : (
                    paginatedPayable.map((v) => {
                      const emp = employees.find(e => e.id === v.employeeId);
                      return (
                        <TableRow key={v.id} className="hover:bg-slate-50/50">
                          <TableCell className="font-mono font-bold text-primary cursor-pointer hover:underline" onClick={() => { setPreviewVoucher(v); setIsPreviewOpen(true); }}>{v.voucherNo}</TableCell>
                          <TableCell className="font-bold">{emp?.name || "..."}</TableCell>
                          <TableCell className="font-bold text-emerald-600">{formatCurrency(v.amount)}</TableCell>
                          <TableCell className="text-xs font-bold text-primary">{v.createdByName}</TableCell>
                          <TableCell className="text-xs font-bold text-emerald-600">{v.approvedByName || "--"}</TableCell>
                          <TableCell>
                            <Badge variant={v.status === "PAID" ? "default" : "secondary"} className={cn(v.status === "PAID" ? "bg-emerald-600" : "bg-blue-500 text-white border-none")}>
                              {v.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            <div className="flex justify-end gap-2">
                              {v.status === "APPROVED" ? (
                                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-8 text-xs" onClick={() => handleOpenPayDialog(v)}><CreditCard className="w-3 h-3 mr-1" /> Pay</Button>
                              ) : (
                                <Button size="sm" variant="outline" className="h-8 text-xs font-bold" onClick={() => { setPreviewVoucher(v); setIsPreviewOpen(true); }}><Printer className="w-3 h-3 mr-1" /> Print</Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
            {totalPaymentPages > 1 && (
              <CardFooter className="bg-slate-50 border-t flex items-center justify-between p-4">
                <div className="text-xs font-bold text-muted-foreground">Showing {((paymentPage - 1) * rowsPerPage) + 1} - {Math.min(paymentPage * rowsPerPage, filteredPayableVouchers.length)} of {filteredPayableVouchers.length}</div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={paymentPage === 1} onClick={() => setPaymentPage(p => p - 1)}><ChevronLeft className="w-4 h-4 mr-1" /> Previous</Button>
                  <div className="text-xs font-black px-4 bg-white h-8 flex items-center rounded-lg border">Page {paymentPage} of {totalPaymentPages}</div>
                  <Button variant="outline" size="sm" disabled={paymentPage === totalPaymentPages} onClick={() => setPaymentPage(p => p + 1)}>Next <ChevronRight className="w-4 h-4 ml-1" /></Button>
                </div>
              </CardFooter>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Reject Alert */}
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

      {/* Pay Dialog */}
      <Dialog open={isPayDialogOpen} onOpenChange={setIsPayDialogOpen}>
        <DialogContent className="sm:max-w-md">
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
          <div className="py-8 space-y-6">
            <div className="space-y-2">
              <Label className="font-black text-xs uppercase text-slate-500 tracking-wider">Paid Amount (INR)</Label>
              <Input 
                type="number" 
                value={payAmount} 
                onChange={(e) => setPayAmount(e.target.value)} 
                className="h-14 bg-slate-50 border-slate-200 font-black text-xl text-emerald-600 focus-visible:ring-emerald-500" 
              />
            </div>
            <div className="space-y-2">
              <Label className="font-black text-xs uppercase text-slate-500 tracking-wider">Payment Date</Label>
              <Input 
                type="date" 
                value={payDate} 
                onChange={(e) => setPayDate(e.target.value)} 
                className="h-14 bg-slate-50 border-slate-200 font-bold" 
              />
            </div>
          </div>
          <DialogFooter className="gap-2 border-t pt-6">
            <Button variant="ghost" onClick={() => setIsPayDialogOpen(false)} className="rounded-xl font-bold">Cancel</Button>
            <Button 
              onClick={handleConfirmPayment} 
              className="h-12 px-8 bg-emerald-600 hover:bg-emerald-700 font-black rounded-xl shadow-lg shadow-emerald-100"
            >
              Confirm & Mark Paid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="sm:max-w-5xl h-[95vh] flex flex-col p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
          <DialogHeader className="p-6 border-b bg-white flex flex-row items-center justify-between shrink-0 z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Eye className="w-5 h-5 text-primary" />
              </div>
              <DialogTitle className="text-xl font-black text-slate-900 tracking-tight">Voucher Preview</DialogTitle>
            </div>
            <Button 
              className="bg-primary hover:bg-primary/90 font-black gap-2 px-8 h-12 rounded-xl shadow-lg shadow-primary/20 mr-8" 
              onClick={() => window.print()}
            >
              <Download className="w-5 h-5" /> Download PDF
            </Button>
          </DialogHeader>
          
          <ScrollArea className="flex-1 bg-slate-50/50 p-4 sm:p-10 custom-blue-scrollbar">
            <div className="max-w-[210mm] mx-auto bg-white shadow-2xl p-8 sm:p-16 min-h-[297mm] border-4 border-slate-900 rounded-sm">
              {previewVoucher && <AdvanceVoucherContent voucher={previewVoucher} employees={employees} firms={firms} plants={plants} />}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Hidden Print Container */}
      {previewVoucher && (
        <div className="hidden print:block print-only">
          <AdvanceVoucherPrint voucher={previewVoucher} employees={employees} firms={firms} plants={plants} />
        </div>
      )}
    </div>
  );
}

function AdvanceVoucherContent({ voucher, employees, firms, plants }: any) {
  const emp = employees.find((e: any) => e.id === voucher.employeeId);
  const firm = firms.find((f: any) => f.id === emp?.firmId);
  const plant = plants.find((p: any) => p.id === emp?.unitId);
  const formattedDate = voucher.date ? format(parseISO(voucher.date), 'dd-MMM-yyyy') : "---";

  return (
    <div className="font-serif text-slate-900 space-y-12">
      {/* Document Header */}
      <div className="flex justify-between items-start border-b-4 border-slate-900 pb-10">
        <div className="flex items-center gap-8">
          <div className="w-32 h-32 border-2 border-slate-200 flex items-center justify-center p-2 rounded-xl bg-white shadow-sm overflow-hidden">
            {firm?.logo ? (
              <img src={firm.logo} className="max-h-full max-w-full object-contain" alt="logo" />
            ) : (
              <Building2 className="w-16 h-16 text-slate-300" />
            )}
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-black uppercase leading-none tracking-tight">{firm?.name || "SIKKA INDUSTRIES AND LOGISTICS"}</h1>
            <p className="text-lg font-bold text-slate-700 uppercase">{plant?.name || "Corporate Unit"}</p>
            <div className="space-y-0.5">
              <p className="text-sm text-slate-500 font-medium italic max-w-md">{plant?.address || "Address details not available"}</p>
              <p className="text-xs font-black text-slate-900 flex gap-2">
                <span className="text-slate-400 uppercase tracking-widest">GSTIN:</span> {firm?.gstin || "---"}
              </p>
            </div>
          </div>
        </div>
        
        <div className="text-right space-y-4 pt-2">
          <div className="space-y-1">
            <div className="flex justify-end gap-3 text-sm">
              <span className="font-bold text-slate-500 uppercase tracking-widest text-[10px]">Voucher No:</span>
              <span className="font-mono font-black text-slate-900 text-lg">{voucher.voucherNo}</span>
            </div>
            <div className="flex justify-end gap-3 text-sm">
              <span className="font-bold text-slate-500 uppercase tracking-widest text-[10px]">Date:</span>
              <span className="font-black text-slate-900 text-lg">{formattedDate}</span>
            </div>
          </div>
          
          <div className="space-y-1 pt-4 border-t border-slate-100">
            <div className="flex justify-end gap-3 text-[10px]">
              <span className="font-black text-slate-400 uppercase tracking-widest">CREATED BY:</span>
              <span className="font-bold text-primary uppercase">{voucher.createdByName || "SYSTEM"}</span>
            </div>
            <div className="flex justify-end gap-3 text-[10px]">
              <span className="font-black text-slate-400 uppercase tracking-widest">APPROVED BY:</span>
              <span className="font-bold text-emerald-600 uppercase">{voucher.approvedByName || "--"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Document Title */}
      <div className="text-center py-6 bg-slate-50 border-y-2 border-slate-900">
        <h2 className="text-2xl font-black uppercase tracking-[0.4em] text-slate-900">Advance Payment Voucher</h2>
      </div>

      {/* Employee Grid */}
      <div className="grid grid-cols-2 border-2 border-slate-900 divide-x-2 divide-y-2 divide-slate-900">
        <DetailCell label="Employee ID" value={emp?.employeeId} />
        <DetailCell label="Employee Name" value={emp?.name} />
        <DetailCell label="Department" value={emp?.department} />
        <DetailCell label="Designation" value={emp?.designation} />
        <DetailCell label="Aadhar Number" value={emp?.aadhaar} />
        <DetailCell label="Mobile Number" value={emp?.mobile} />
      </div>

      {/* Payment Details */}
      <div className="grid grid-cols-1 border-2 border-slate-900 mt-10">
        <div className="p-6 border-b-2 border-slate-900 flex items-center justify-between bg-white">
          <span className="font-black uppercase text-sm tracking-widest">Amount (In Figures)</span>
          <span className="text-4xl font-black text-slate-900">{formatCurrency(voucher.amount)}</span>
        </div>
        <div className="p-6 bg-slate-50 flex items-start gap-6 border-b-2 border-slate-900">
          <span className="font-black uppercase text-[10px] w-48 shrink-0 text-slate-500 pt-1 tracking-widest">Amount in Words:</span>
          <span className="text-lg font-bold italic underline decoration-slate-300 underline-offset-8 leading-relaxed">
            {numberToIndianWords(voucher.amount)}
          </span>
        </div>
        <div className="p-6 flex items-start gap-6 bg-white">
          <span className="font-black uppercase text-[10px] w-48 shrink-0 text-slate-500 pt-1 tracking-widest">Purpose:</span>
          <span className="text-lg font-medium text-slate-800 leading-relaxed">{voucher.purpose}</span>
        </div>
      </div>

      {/* Declaration */}
      <div className="p-8 bg-slate-50 border-2 border-dashed border-slate-300 rounded-3xl italic text-sm text-center leading-relaxed text-slate-600 mt-10">
        "I hereby acknowledge the receipt of the above-mentioned advance amount and agree that the same will be recovered/adjusted from my future salary/dues as per the organization's policy."
      </div>

      {/* Signatures */}
      <div className="flex justify-between items-end pt-32 px-10">
        <div className="text-center space-y-4">
          <div className="w-72 border-b-2 border-slate-900" />
          <p className="text-xs font-black uppercase tracking-widest text-slate-900">Receiver Signature</p>
        </div>
        <div className="text-center space-y-4">
          <div className="w-72 border-b-2 border-slate-900" />
          <p className="text-xs font-black uppercase tracking-widest text-slate-900">Authorized Signatory</p>
        </div>
      </div>
      
      {/* Footer Branding */}
      <div className="pt-20 text-center">
        <p className="text-[9px] font-black uppercase tracking-[0.5em] text-slate-300 italic">© Sikka Industries & Logistics – Internal Secure Document</p>
      </div>
    </div>
  );
}

function AdvanceVoucherPrint({ voucher, employees, firms, plants }: any) {
  return (
    <div className="w-full max-w-[210mm] mx-auto p-16 min-h-[297mm] bg-white">
      <AdvanceVoucherContent voucher={voucher} employees={employees} firms={firms} plants={plants} />
    </div>
  );
}

function DetailCell({ label, value }: { label: string, value: any }) {
  return (
    <div className="flex items-center p-6 bg-white">
      <span className="text-[10px] font-black uppercase text-slate-400 w-40 shrink-0 tracking-widest">{label}:</span>
      <span className="text-base font-black text-slate-900 uppercase tracking-tight">{value || "---"}</span>
    </div>
  );
}
