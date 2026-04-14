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
  Factory, 
  ShieldCheck, 
  FileCheck, 
  Users,
  AlertTriangle,
  Printer,
  Eye,
  Download,
  X,
  User as UserIcon,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet
} from "lucide-react";
import { formatCurrency, numberToIndianWords, cn } from "@/lib/utils";
import { useData } from "@/context/data-context";
import { Voucher } from "@/lib/types";
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
  DialogDescription
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function VouchersPage() {
  const { employees, firms, plants, vouchers, setVouchers } = useData();
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

  // Selected Employee Details
  const selectedEmployee = useMemo(() => 
    employees.find(e => e.id === selectedEmployeeId), 
  [employees, selectedEmployeeId]);

  const associatedFirm = useMemo(() => 
    firms.find(f => f.id === selectedEmployee?.firmId), 
  [firms, selectedEmployee]);

  const associatedUnit = useMemo(() => 
    plants.find(p => p.id === selectedEmployee?.unitId), 
  [plants, selectedEmployee]);

  // Dynamic FY Sequential Voucher Number Calculation
  const voucherNo = useMemo(() => {
    if (!voucherDate) return "SIL-XXXXXX-XXXXX";
    const d = new Date(voucherDate);
    if (isNaN(d.getTime())) return "SIL-XXXXXX-XXXXX";
    
    // Indian Financial Year: April to March
    const month = d.getMonth(); // 0-11
    const year = d.getFullYear();
    const startYear = month < 3 ? year - 1 : year;
    const endYear = startYear + 1;
    const fyPrefix = `${startYear}${(endYear % 100).toString().padStart(2, '0')}`;
    const fyFullPrefix = `SIL-${fyPrefix}-`;

    // Filter existing vouchers for this specific FY to find the next serial
    const sameFYVouchers = vouchers.filter(v => v.voucherNo.startsWith(fyFullPrefix));
    
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

  // Filtering Logic based on tabs
  const filteredPendingVouchers = useMemo(() => {
    return vouchers.filter(v => v.status === 'PENDING').filter(v => {
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
    return vouchers.filter(v => v.status === 'APPROVED' || v.status === 'PAID').filter(v => {
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
      toast({ 
        variant: "destructive", 
        title: "Mandatory Fields Missing", 
        description: "Please select an employee and enter both amount and purpose." 
      });
      return;
    }

    const newVoucher: Voucher = {
      id: Math.random().toString(36).substr(2, 9),
      voucherNo: voucherNo, 
      employeeId: selectedEmployeeId,
      date: voucherDate,
      amount: parseFloat(amount),
      purpose: purpose,
      status: "PENDING",
      createdByName: currentUser?.fullName || "Admin"
    };

    setVouchers(prev => [...prev, newVoucher]);
    toast({ title: "Voucher Created", description: `Voucher #${voucherNo} generated.` });
    
    setSelectedEmployeeId("");
    setAmount("");
    setPurpose("");
    setActiveTab("approve");
  };

  const handleApproveVoucher = (id: string) => {
    setVouchers(prev => prev.map(v => v.id === id ? { 
      ...v, 
      status: 'APPROVED', 
      approvedByName: currentUser?.fullName || "Admin" 
    } : v));
    toast({ title: "Voucher Approved", description: "Voucher moved to payments list." });
  };

  const handleRejectConfirm = () => {
    if (!voucherToReject) return;
    setVouchers(prev => prev.filter(v => v.id !== voucherToReject));
    toast({ variant: "destructive", title: "Voucher Rejected", description: "Voucher removed." });
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
    setVouchers(prev => prev.map(v => v.id === voucherToPay.id ? { 
      ...v, 
      status: 'PAID',
      date: payDate, // Update to payment date
      amount: parseFloat(payAmount) // Update to actual paid amount if changed
    } : v));
    toast({ title: "Voucher Paid", description: "Payment recorded successfully." });
    setIsPayDialogOpen(false);
    setVoucherToPay(null);
  };

  const handleOpenPreview = (v: Voucher) => {
    setPreviewVoucher(v);
    setIsPreviewOpen(true);
  };

  const handleExportExcel = (type: 'PENDING' | 'PAYMENT') => {
    const data = type === 'PENDING' ? filteredPendingVouchers : filteredPayableVouchers;
    if (data.length === 0) {
      toast({ variant: "destructive", title: "No Data", description: "No records found to export." });
      return;
    }

    const headers = ["Voucher No", "Date", "Employee ID", "Employee Name", "Dept", "Desig", "Amount", "Purpose", "Created By", "Approved By", "Status"];
    const csvContent = [
      headers.join(","),
      ...data.map(v => {
        const emp = employees.find(e => e.id === v.employeeId);
        return [
          v.voucherNo,
          v.date,
          emp?.employeeId || "",
          `"${emp?.name || ""}"`,
          `"${emp?.department || ""}"`,
          `"${emp?.designation || ""}"`,
          v.amount,
          `"${v.purpose}"`,
          `"${v.createdByName || "Admin"}"`,
          `"${v.approvedByName || "--"}"`,
          v.status
        ].join(",");
      })
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Vouchers_${type}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Export Success", description: "CSV file downloaded." });
  };

  if (!isMounted) return null;

  return (
    <div className="space-y-6 print:hidden">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Advance Voucher System</h1>
          <p className="text-muted-foreground">Manage employee advance payments and recovery.</p>
        </div>
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
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Wallet className="text-primary w-5 h-5" />
                </div>
                <CardTitle>Generate New Voucher</CardTitle>
              </div>
              <div className="flex items-center gap-2 px-4 py-1.5 bg-white border border-slate-200 rounded-full shadow-sm">
                <UserIcon className="w-3.5 h-3.5 text-primary" />
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Voucher Create by:</span>
                <span className="text-xs font-bold text-primary">{currentUser?.fullName || "Loading..."}</span>
              </div>
            </CardHeader>
            <form onSubmit={handleCreateVoucher}>
              <CardContent className="p-8 space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <Label className="font-bold">Voucher Number (Auto Serial)</Label>
                    <Input value={voucherNo} disabled className="bg-slate-100 font-mono font-bold h-12 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold">Date *</Label>
                    <Input 
                      type="date" 
                      value={voucherDate} 
                      onChange={(e) => setVoucherDate(e.target.value)}
                      className="h-12 bg-white"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="font-bold">Select Employee *</Label>
                    <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId} required>
                      <SelectTrigger className="h-12 bg-white">
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
                    <Label className="font-bold text-emerald-600">Advance Amount (INR) *</Label>
                    <Input 
                      type="number" 
                      placeholder="Enter amount" 
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="h-12 bg-white font-bold"
                      required 
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                      <Building2 className="w-3 h-3" /> Associated Firm (Auto)
                    </Label>
                    <Input 
                      value={associatedFirm?.name || "Select Employee First"} 
                      disabled 
                      className="h-12 bg-slate-50 border-slate-200 italic text-slate-500" 
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                      <Factory className="w-3 h-3" /> Working Unit (Auto)
                    </Label>
                    <Input 
                      value={associatedUnit?.name || "Select Employee First"} 
                      disabled 
                      className="h-12 bg-slate-50 border-slate-200 italic text-slate-500" 
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                      <Users className="w-3 h-3" /> Department (Auto)
                    </Label>
                    <Input 
                      value={selectedEmployee?.department || "Select Employee First"} 
                      disabled 
                      className="h-12 bg-slate-50 border-slate-200 italic text-slate-500" 
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                      <ShieldCheck className="w-3 h-3" /> Designation (Auto)
                    </Label>
                    <Input 
                      value={selectedEmployee?.designation || "Select Employee First"} 
                      disabled 
                      className="h-12 bg-slate-50 border-slate-200 italic text-slate-500" 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="font-bold">Purpose of Advance *</Label>
                  <Input 
                    placeholder="e.g. Personal Emergency, Medical, Travel Advance..." 
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    className="h-12 bg-white"
                    required 
                  />
                </div>
              </CardContent>
              <CardFooter className="bg-slate-50 border-t border-slate-100 rounded-b-xl flex justify-end gap-3 p-6">
                <Button variant="outline" type="button" className="h-12 px-8" onClick={() => setActiveTab("approve")}>Cancel</Button>
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
                    <Input 
                      placeholder="Search pending vouchers..." 
                      className="pl-10 h-10 bg-white"
                      value={searchTerm}
                      onChange={(e) => { setSearchTerm(e.target.value); setPendingPage(1); }}
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="font-bold">Voucher No</TableHead>
                    <TableHead className="font-bold">Employee Name</TableHead>
                    <TableHead className="font-bold">Dept / Desig</TableHead>
                    <TableHead className="font-bold">Firm / Unit</TableHead>
                    <TableHead className="font-bold">Date</TableHead>
                    <TableHead className="font-bold">Amount</TableHead>
                    <TableHead className="font-bold">Created By</TableHead>
                    <TableHead className="text-right font-bold pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedPending.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                        No vouchers pending approval.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedPending.map((v) => {
                      const emp = employees.find(e => e.id === v.employeeId);
                      const firm = firms.find(f => f.id === emp?.firmId);
                      const unit = plants.find(p => p.id === emp?.unitId);
                      
                      return (
                        <TableRow key={v.id} className="hover:bg-slate-50/50">
                          <TableCell 
                            className="font-mono font-bold text-primary cursor-pointer hover:underline"
                            onClick={() => handleOpenPreview(v)}
                          >
                            {v.voucherNo}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-bold">{emp?.name || "Unknown"}</span>
                              <span className="text-[10px] text-muted-foreground font-mono">{emp?.employeeId}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-xs font-medium">{emp?.department || "N/A"}</span>
                              <span className="text-[10px] text-muted-foreground">{emp?.designation || "N/A"}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-xs font-medium">{firm?.name || "N/A"}</span>
                              <span className="text-[10px] text-muted-foreground">{unit?.name || "N/A"}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{v.date}</TableCell>
                          <TableCell className="font-bold text-emerald-600">{formatCurrency(v.amount)}</TableCell>
                          <TableCell className="text-xs font-bold text-slate-500">{v.createdByName || "Admin"}</TableCell>
                          <TableCell className="text-right pr-6">
                            <div className="flex justify-end gap-2">
                              <Button 
                                size="sm" 
                                className="bg-emerald-600 hover:bg-emerald-700 h-8 text-xs font-bold"
                                onClick={() => handleApproveVoucher(v.id)}
                              >
                                <CheckCircle className="w-3 h-3 mr-1" /> Approve
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="text-rose-600 hover:bg-rose-50 h-8 text-xs font-bold"
                                onClick={() => setVoucherToReject(v.id)}
                              >
                                <XCircle className="w-3 h-3 mr-1" /> Reject
                              </Button>
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
                <div className="text-xs font-bold text-muted-foreground">
                  Showing {((pendingPage - 1) * rowsPerPage) + 1} - {Math.min(pendingPage * rowsPerPage, filteredPendingVouchers.length)} of {filteredPendingVouchers.length}
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={pendingPage === 1}
                    onClick={() => setPendingPage(p => p - 1)}
                    className="h-8 rounded-lg font-bold"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                  </Button>
                  <div className="text-xs font-black px-4 bg-white h-8 flex items-center rounded-lg border border-slate-200 shadow-sm">
                    Page {pendingPage} of {totalPendingPages}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={pendingPage === totalPendingPages}
                    onClick={() => setPendingPage(p => p + 1)}
                    className="h-8 rounded-lg font-bold"
                  >
                    Next <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
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
                  <CardTitle className="text-lg">Approved Vouchers for Payment</CardTitle>
                </div>
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="sm" className="h-10 gap-2" onClick={() => handleExportExcel('PAYMENT')}>
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Export Excel
                  </Button>
                  <div className="relative w-80">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search voucher, employee or unit..." 
                      className="pl-10 h-10 bg-white"
                      value={searchTerm}
                      onChange={(e) => { setSearchTerm(e.target.value); setPaymentPage(1); }}
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="font-bold">Voucher No</TableHead>
                    <TableHead className="font-bold">Employee Name</TableHead>
                    <TableHead className="font-bold">Dept / Desig</TableHead>
                    <TableHead className="font-bold">Firm / Unit</TableHead>
                    <TableHead className="font-bold">Date</TableHead>
                    <TableHead className="font-bold">Amount</TableHead>
                    <TableHead className="font-bold">Created By</TableHead>
                    <TableHead className="font-bold">Approved By</TableHead>
                    <TableHead className="font-bold">Status</TableHead>
                    <TableHead className="text-right font-bold pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedPayable.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                        No approved vouchers ready for payment.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedPayable.map((v) => {
                      const emp = employees.find(e => e.id === v.employeeId);
                      const firm = firms.find(f => f.id === emp?.firmId);
                      const unit = plants.find(p => p.id === emp?.unitId);
                      
                      return (
                        <TableRow key={v.id} className="hover:bg-slate-50/50">
                          <TableCell 
                            className="font-mono font-bold text-primary cursor-pointer hover:underline"
                            onClick={() => handleOpenPreview(v)}
                          >
                            {v.voucherNo}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-bold">{emp?.name || "Unknown"}</span>
                              <span className="text-[10px] text-muted-foreground font-mono">{emp?.employeeId}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-xs font-medium">{emp?.department || "N/A"}</span>
                              <span className="text-[10px] text-muted-foreground">{emp?.designation || "N/A"}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-xs font-medium">{firm?.name || "N/A"}</span>
                              <span className="text-[10px] text-muted-foreground">{unit?.name || "N/A"}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{v.date}</TableCell>
                          <TableCell className="font-bold text-emerald-600">{formatCurrency(v.amount)}</TableCell>
                          <TableCell className="text-xs font-bold text-slate-500">{v.createdByName || "Admin"}</TableCell>
                          <TableCell className="text-xs font-bold text-primary">{v.approvedByName || "--"}</TableCell>
                          <TableCell>
                            <Badge variant={v.status === "PAID" ? "default" : "secondary"} className={cn(
                              "text-[10px] font-bold px-2 py-0.5",
                              v.status === "PAID" && "bg-emerald-600",
                              v.status === "APPROVED" && "bg-blue-500 text-white border-none"
                            )}>
                              {v.status === "PAID" ? <CheckCircle className="w-3 h-3 mr-1" /> : <ShieldCheck className="w-3 h-3 mr-1" />}
                              {v.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            <div className="flex justify-end gap-2">
                              {v.status === "APPROVED" ? (
                                <>
                                  <Button 
                                    size="sm" 
                                    className="bg-emerald-600 hover:bg-emerald-700 h-8 text-xs font-bold"
                                    onClick={() => handleOpenPayDialog(v)}
                                  >
                                    <CreditCard className="w-3 h-3 mr-1" /> Pay
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    className="text-rose-600 hover:bg-rose-50 h-8 text-xs font-bold"
                                    onClick={() => setVoucherToReject(v.id)}
                                  >
                                    <XCircle className="w-3 h-3 mr-1" /> Reject
                                  </Button>
                                </>
                              ) : (
                                <Button size="sm" variant="outline" className="h-8 text-xs font-bold gap-1" onClick={() => handleOpenPreview(v)}>
                                  <Printer className="w-3 h-3" /> Print
                                </Button>
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
                <div className="text-xs font-bold text-muted-foreground">
                  Showing {((paymentPage - 1) * rowsPerPage) + 1} - {Math.min(paymentPage * rowsPerPage, filteredPayableVouchers.length)} of {filteredPayableVouchers.length}
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={paymentPage === 1}
                    onClick={() => setPaymentPage(p => p - 1)}
                    className="h-8 rounded-lg font-bold"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                  </Button>
                  <div className="text-xs font-black px-4 bg-white h-8 flex items-center rounded-lg border border-slate-200 shadow-sm">
                    Page {paymentPage} of {totalPaymentPages}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={paymentPage === totalPaymentPages}
                    onClick={() => setPaymentPage(p => p + 1)}
                    className="h-8 rounded-lg font-bold"
                  >
                    Next <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </CardFooter>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Rejection Confirmation Alert */}
      <AlertDialog open={!!voucherToReject} onOpenChange={(o) => !o && setVoucherToReject(null)}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-rose-600" />
            </div>
            <AlertDialogTitle className="text-center">Reject & Remove Voucher?</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Are you sure you want to reject this request? The voucher will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center gap-3">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRejectConfirm}
              className="bg-rose-600 hover:bg-rose-700 font-bold"
            >
              Confirm Rejection
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment Confirmation Dialog */}
      <Dialog open={isPayDialogOpen} onOpenChange={setIsPayDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="flex flex-col gap-1">
              <span className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Process Payment</span>
              <span className="text-xl font-bold text-slate-900">
                {employees.find(e => e.id === voucherToPay?.employeeId)?.name}
              </span>
              <span className="text-xs font-mono font-bold text-primary">{voucherToPay?.voucherNo}</span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-6 space-y-6">
            <div className="space-y-2">
              <Label className="font-bold text-slate-700">Paid Amount (INR)</Label>
              <Input 
                type="number" 
                value={payAmount} 
                onChange={(e) => setPayAmount(e.target.value)}
                className="h-12 bg-white font-bold text-lg border-emerald-200 focus-visible:ring-emerald-500"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-slate-700">Payment Date</Label>
              <Input 
                type="date" 
                value={payDate} 
                onChange={(e) => setPayDate(e.target.value)}
                className="h-12 bg-white font-bold"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 border-t pt-4">
            <Button variant="outline" onClick={() => setIsPayDialogOpen(false)} className="h-11 px-6 font-bold">
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmPayment}
              className="bg-emerald-600 hover:bg-emerald-700 h-11 px-10 font-bold shadow-lg shadow-emerald-100"
            >
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Voucher Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 border-b bg-slate-50 flex flex-row items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              <DialogTitle className="text-xl font-bold">Voucher Preview</DialogTitle>
            </div>
            <div className="flex items-center gap-4 pr-10">
              <Button className="bg-primary hover:bg-primary/90 font-bold gap-2 px-6 h-10 shadow-lg shadow-primary/20" onClick={() => window.print()}>
                <Download className="w-4 h-4" /> Download PDF
              </Button>
            </div>
          </DialogHeader>
          <ScrollArea className="flex-1 bg-slate-100 p-8 custom-scrollbar">
            <div className="max-w-[210mm] mx-auto bg-white shadow-2xl p-10 min-h-[297mm]">
              {previewVoucher && (
                <AdvanceVoucherContent 
                  voucher={previewVoucher} 
                  employees={employees} 
                  firms={firms} 
                  plants={plants} 
                />
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Hidden Print Component (For window.print()) */}
      {previewVoucher && (
        <div className="hidden print:block">
          <AdvanceVoucherPrint 
            voucher={previewVoucher} 
            employees={employees} 
            firms={firms} 
            plants={plants} 
          />
        </div>
      )}
    </div>
  );
}

/**
 * Shared Content Component for Preview and Print
 */
function AdvanceVoucherContent({ voucher, employees, firms, plants }: any) {
  const emp = employees.find((e: any) => e.id === voucher.employeeId);
  const firm = firms.find((f: any) => f.id === emp?.firmId);
  const plant = plants.find((p: any) => p.id === emp?.unitId);

  return (
    <div className="font-serif text-slate-900 space-y-10">
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
            {firm?.gstin && <p className="text-xs font-bold mt-1 uppercase">GSTIN: {firm.gstin}</p>}
          </div>
        </div>
        <div className="text-right space-y-1">
          <div className="flex justify-end gap-2 text-sm"><span className="font-bold text-slate-500">Voucher No:</span><span className="font-mono font-bold">{voucher.voucherNo}</span></div>
          <div className="flex justify-end gap-2 text-sm"><span className="font-bold text-slate-500">Voucher Date:</span><span className="font-bold">{voucher.date}</span></div>
          <div className="flex flex-col items-end gap-1 pt-4">
            <div className="flex justify-end gap-2 text-[10px]"><span className="font-black text-slate-400 uppercase tracking-widest">CREATED BY:</span><span className="font-bold text-primary">{voucher.createdByName || "Admin"}</span></div>
            <div className="flex justify-end gap-2 text-[10px]"><span className="font-black text-slate-400 uppercase tracking-widest">APPROVED BY:</span><span className="font-bold text-emerald-600">{voucher.approvedByName || "--"}</span></div>
          </div>
        </div>
      </div>

      {/* Title */}
      <div className="text-center py-4 bg-slate-100 border-y-2 border-slate-900">
        <h2 className="text-xl font-black uppercase tracking-[0.25em]">Advance Payment Voucher</h2>
      </div>

      {/* Employee Details */}
      <div className="grid grid-cols-2 border-2 border-slate-900">
        <DetailCell label="Employee ID" value={emp?.employeeId} />
        <DetailCell label="Employee Name" value={emp?.name} />
        <DetailCell label="Department" value={emp?.department} />
        <DetailCell label="Designation" value={emp?.designation} />
      </div>

      {/* Advance Details */}
      <div className="space-y-6">
        <div className="grid grid-cols-1 border-2 border-slate-900">
          <div className="p-4 border-b-2 border-slate-900 flex items-center justify-between">
            <span className="font-black uppercase text-sm">Advance Amount (In Figures)</span>
            <span className="text-2xl font-black">{formatCurrency(voucher.amount)}</span>
          </div>
          <div className="p-4 bg-slate-50 flex items-start gap-4">
            <span className="font-black uppercase text-xs w-48 shrink-0">Amount in Words:</span>
            <span className="text-sm font-bold italic underline decoration-dotted">{numberToIndianWords(voucher.amount)}</span>
          </div>
          <div className="p-4 border-t-2 border-slate-900 flex items-start gap-4">
            <span className="font-black uppercase text-xs w-48 shrink-0">Purpose:</span>
            <span className="text-sm font-medium">{voucher.purpose}</span>
          </div>
        </div>
      </div>

      {/* Declaration */}
      <div className="p-6 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl italic text-sm text-center leading-relaxed">
        "Received the above-mentioned advance amount for official/personal purpose and agree to adjust the same against future salary/payments."
      </div>

      {/* Footer / Signatures */}
      <div className="flex justify-between items-end pt-24">
        <div className="text-center space-y-3">
          <div className="w-64 border-b-2 border-slate-900" />
          <p className="text-sm font-black uppercase tracking-tighter">Receiver Signature (Employee)</p>
        </div>
        <div className="text-center space-y-3">
           <div className="w-16 h-16 border-2 border-slate-200 rounded-lg mx-auto flex items-center justify-center opacity-20"><span className="text-[8px] font-bold">Stamp Here</span></div>
          <div className="w-64 border-b-2 border-slate-900" />
          <p className="text-sm font-black uppercase tracking-tighter">Authorized Signatory</p>
        </div>
      </div>

      {/* End Note */}
      <div className="pt-10 border-t border-slate-100 text-center">
        <p className="text-[10px] text-slate-400 font-bold italic uppercase tracking-wider">
          👉 This is a system-generated Advance Payment Voucher and is considered an original document.
        </p>
      </div>
    </div>
  );
}

function AdvanceVoucherPrint({ voucher, employees, firms, plants }: any) {
  return (
    <div className="fixed inset-0 bg-white z-[999] p-[1cm]">
      <div className="w-full max-w-[210mm] mx-auto border-4 border-slate-900 p-10 min-h-[297mm]">
        <AdvanceVoucherContent 
          voucher={voucher} 
          employees={employees} 
          firms={firms} 
          plants={plants} 
        />
      </div>
    </div>
  );
}

function DetailCell({ label, value }: { label: string, value: any }) {
  return (
    <div className="flex items-center p-4 border border-slate-900">
      <span className="text-[10px] font-black uppercase text-slate-500 w-36 shrink-0">{label}:</span>
      <span className="text-sm font-bold text-slate-900 uppercase">{value}</span>
    </div>
  );
}
