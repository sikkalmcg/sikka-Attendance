"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent, 
  CardDescription
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
  DialogDescription
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, 
  Calculator, 
  CalendarClock, 
  CreditCard, 
  PlusCircle, 
  History, 
  Wallet,
  CheckCircle2,
  CalendarDays,
  ArrowDownCircle,
  Building2
} from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import { useData } from "@/context/data-context";
import { useToast } from "@/hooks/use-toast";
import { Employee, PayrollRecord } from "@/lib/types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";

const generatePayrollMonths = () => {
  const options = [];
  const date = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
    const mmm = d.toLocaleString('en-US', { month: 'short' });
    const yy = d.getFullYear().toString().slice(-2);
    options.push(`${mmm}-${yy}`);
  }
  return options;
};

const PAYROLL_MONTHS = generatePayrollMonths();

export default function PayrollPage() {
  const router = useRouter();
  const { employees, setEmployees, attendanceRecords, payrollRecords, vouchers, firms, plants } = useData();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("generate");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(PAYROLL_MONTHS[1]);
  const [selectedFirmId, setSelectedFirmId] = useState("all");
  const [isProcessing, setIsProcessing] = useState(false);

  const [adjustedEmployees, setAdjustedEmployees] = useState<Record<string, boolean>>({});
  const [adjustLeaveEmp, setAdjustLeaveEmp] = useState<Employee | null>(null);
  const [viewLeaveHistoryEmp, setViewLeaveHistoryEmp] = useState<Employee | null>(null);
  const [advanceLeaveValue, setAdvanceLeaveValue] = useState(0);

  useEffect(() => {
    setAdjustedEmployees({});
  }, [selectedMonth]);

  const filteredEmployees = useMemo(() => {
    return (employees || []).filter(emp => {
      const search = searchTerm.toLowerCase();
      const matchesSearch = (
        emp.name.toLowerCase().includes(search) ||
        emp.employeeId.toLowerCase().includes(search) ||
        emp.aadhaar.includes(search)
      );
      const matchesFirm = selectedFirmId === "all" || emp.firmId === selectedFirmId;
      return matchesSearch && matchesFirm;
    });
  }, [employees, searchTerm, selectedFirmId]);

  const paidVouchers = useMemo(() => {
    return vouchers.filter(v => v.status === 'PAID').reverse();
  }, [vouchers]);

  const isSalaryGenerated = (empId: string) => {
    return payrollRecords.some(p => p.employeeId === empId && p.month === selectedMonth);
  };

  const getAttendanceSummary = (empId: string) => {
    const records = attendanceRecords.filter(r => r.employeeId === empId || r.employeeId === "emp-mock");
    const presents = records.filter(r => r.status === 'PRESENT').length;
    const halfDays = records.filter(r => r.status === 'HALF_DAY').length;
    const holidays = records.filter(r => r.status === 'HOLIDAY').length;
    
    const effectiveAttendance = presents + (halfDays * 0.5);
    const totalDaysInMonth = 30;
    const absent = totalDaysInMonth - effectiveAttendance - holidays;

    return {
      attendance: effectiveAttendance,
      absent: Math.max(0, absent),
      holidayWork: holidays,
      totalDays: totalDaysInMonth
    };
  };

  const handleAdjustLeave = () => {
    if (!adjustLeaveEmp || isProcessing) return;
    if (advanceLeaveValue > (adjustLeaveEmp.advanceLeaveBalance || 0)) {
      toast({ variant: "destructive", title: "Invalid Amount", description: "Adjustment exceeds available balance." });
      return;
    }

    setIsProcessing(true);
    try {
      setEmployees(prev => prev.map(e => {
        if (e.id === adjustLeaveEmp.id) {
          return { ...e, advanceLeaveBalance: (e.advanceLeaveBalance || 0) - advanceLeaveValue };
        }
        return e;
      }));
      
      setAdjustedEmployees(prev => ({ ...prev, [adjustLeaveEmp.id]: true }));
      toast({ title: "Leave Adjusted", description: `${advanceLeaveValue} days added to earning days.` });
      setAdjustLeaveEmp(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMarkNotRequired = () => {
    if (!adjustLeaveEmp) return;
    setAdjustedEmployees(prev => ({ ...prev, [adjustLeaveEmp.id]: true }));
    toast({ title: "Review Complete", description: "Marked as not required. Salary generation unlocked." });
    setAdjustLeaveEmp(null);
  };

  const handleAddToAdvanceLeave = () => {
    if (!adjustLeaveEmp || isProcessing) return;
    const summary = getAttendanceSummary(adjustLeaveEmp.employeeId);
    
    setIsProcessing(true);
    try {
      setEmployees(prev => prev.map(e => {
        if (e.id === adjustLeaveEmp.id) {
          return { ...e, advanceLeaveBalance: (e.advanceLeaveBalance || 0) + summary.holidayWork };
        }
        return e;
      }));
      
      setAdjustedEmployees(prev => ({ ...prev, [adjustLeaveEmp.id]: true }));
      toast({ title: "Balance Updated", description: `${summary.holidayWork} days added to Advance Leave Balance.` });
    } finally {
      setIsProcessing(false);
    }
  };

  const leaveHistoryData = useMemo(() => {
    if (!viewLeaveHistoryEmp) return [];
    let runningBalance = viewLeaveHistoryEmp.advanceLeaveBalance || 0;
    const records = payrollRecords
      .filter(p => p.employeeId === viewLeaveHistoryEmp.employeeId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return records.map(p => ({
      month: p.month,
      holidayWork: p.holidayWorkDays,
      adjust: p.adjustLeave,
      balance: runningBalance
    }));
  }, [viewLeaveHistoryEmp, payrollRecords]);

  return (
    <div className="space-y-8 pb-12">
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
                  <Input 
                    placeholder="Search by Employee Name / ID / Aadhaar..." 
                    className="pl-10 h-10 bg-white"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
                  <Select value={selectedFirmId} onValueChange={setSelectedFirmId}>
                    <SelectTrigger className="w-full sm:w-48 bg-white h-10">
                      <SelectValue placeholder="Filter by Firm" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Firms</SelectItem>
                      {firms.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="w-full sm:w-40 bg-white h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYROLL_MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-bold">Firm / Unit</TableHead>
                    <TableHead className="font-bold">Employee Name / ID</TableHead>
                    <TableHead className="font-bold">Aadhaar No</TableHead>
                    <TableHead className="font-bold">Dept / Designation</TableHead>
                    <TableHead className="font-bold">Month</TableHead>
                    <TableHead className="font-bold text-right">Monthly CTC</TableHead>
                    <TableHead className="text-right font-bold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((emp) => {
                    const isAdjusted = adjustedEmployees[emp.id];
                    const generated = isSalaryGenerated(emp.employeeId);
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
                            <span className="font-bold">{emp.name}</span>
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
                        <TableCell>
                          <Badge variant="outline" className="font-bold bg-white">{selectedMonth}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-bold text-emerald-600">
                          {formatCurrency(emp.salary.monthlyCTC)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              disabled={generated}
                              className={cn(
                                "text-xs font-bold gap-1 border-primary/20",
                                isAdjusted ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "hover:bg-primary/5",
                                generated && "opacity-50 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200"
                              )}
                              onClick={() => !generated && setAdjustLeaveEmp(emp)}
                            >
                              <CalendarClock className="w-3 h-3" /> 
                              {generated ? "Locked" : isAdjusted ? "Reviewed" : "Adjust Leave"}
                            </Button>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="inline-block">
                                    <Button 
                                      size="sm" 
                                      className={cn(
                                        "text-xs font-bold gap-1",
                                        isAdjusted && !generated ? "bg-primary" : "bg-slate-200 text-slate-400 cursor-not-allowed"
                                      )}
                                      onClick={() => {
                                        if (isAdjusted && !generated) {
                                          router.push(`/dashboard/payroll/generate/${emp.id}?month=${selectedMonth}`);
                                        }
                                      }}
                                      disabled={!isAdjusted || generated}
                                    >
                                      {generated ? <CheckCircle2 className="w-3 h-3" /> : <Calculator className="w-3 h-3" />}
                                      {generated ? "Generated" : "Generate Salary"}
                                    </Button>
                                  </div>
                                </TooltipTrigger>
                                {!isAdjusted && !generated && (
                                  <TooltipContent>
                                    <p className="text-xs">Review leave before generating salary</p>
                                  </TooltipContent>
                                )}
                                {generated && (
                                  <TooltipContent>
                                    <p className="text-xs">Salary record already exists</p>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payment">
          <div className="flex items-center justify-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
            <div className="text-center space-y-3">
              <div className="mx-auto w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center"><CreditCard className="text-slate-400" /></div>
              <h3 className="font-bold text-slate-500">No Finalized Salaries</h3>
              <p className="text-sm text-muted-foreground">Generate and finalize payroll to track payments here.</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="advance">
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-100 p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-50 rounded-lg"><Wallet className="w-5 h-5 text-emerald-600" /></div>
                <div>
                  <CardTitle className="text-lg font-bold">Paid Advance Salary Ledger</CardTitle>
                  <CardDescription>Track cash advances, salary deductions, and recovery status.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-bold">Voucher No</TableHead>
                    <TableHead className="font-bold">Voucher Date</TableHead>
                    <TableHead className="font-bold">Employee Name</TableHead>
                    <TableHead className="font-bold">Dept / Desig</TableHead>
                    <TableHead className="text-right font-bold">Adv. Amount</TableHead>
                    <TableHead className="text-right font-bold">Paid Amount</TableHead>
                    <TableHead className="text-right font-bold">Deduction Advance Salary</TableHead>
                    <TableHead className="text-center font-bold">Slip No</TableHead>
                    <TableHead className="text-center font-bold">Sal. Month</TableHead>
                    <TableHead className="text-right font-bold">Remaining</TableHead>
                    <TableHead className="text-center font-bold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paidVouchers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-20 text-muted-foreground">
                        No paid advance salary records found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paidVouchers.map(v => {
                      const emp = employees.find(e => e.id === v.employeeId);
                      const recoveries = payrollRecords.filter(p => p.employeeId === (emp?.employeeId || v.employeeId));
                      const totalRecovered = recoveries.reduce((sum, p) => sum + (p.advanceRecovery || 0), 0);
                      const remaining = v.amount - totalRecovered;
                      const lastRecovery = recoveries[recoveries.length - 1];

                      return (
                        <TableRow key={v.id} className="hover:bg-slate-50/50">
                          <TableCell className="font-mono font-bold text-primary">{v.voucherNo}</TableCell>
                          <TableCell className="text-sm">{v.date}</TableCell>
                          <TableCell className="font-bold">{emp?.name || v.employeeId}</TableCell>
                          <TableCell className="text-xs">
                            <div className="flex flex-col">
                              <span>{emp?.department || "--"}</span>
                              <span className="text-muted-foreground">{emp?.designation || "--"}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-bold">{formatCurrency(v.amount)}</TableCell>
                          <TableCell className="text-right font-bold text-emerald-600">{formatCurrency(v.amount)}</TableCell>
                          <TableCell className="text-right font-bold text-rose-600">{formatCurrency(totalRecovered)}</TableCell>
                          <TableCell className="text-center font-mono text-[10px]">{lastRecovery ? lastRecovery.slipNo : "--"}</TableCell>
                          <TableCell className="text-center font-bold text-xs">{lastRecovery ? lastRecovery.month : "--"}</TableCell>
                          <TableCell className="text-right font-black text-primary">{formatCurrency(Math.max(0, remaining))}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={remaining <= 0 ? "default" : "outline"} className={cn(
                              "text-[10px] font-black",
                              remaining <= 0 ? "bg-emerald-600" : "text-amber-600 border-amber-200 bg-amber-50"
                            )}>
                              {remaining <= 0 ? "COMPLETE" : "PENDING DEDUCTION"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leave" className="mt-8 space-y-6">
          <Card className="border-none shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-bold">Employee Name</TableHead>
                    <TableHead className="font-bold">Employee ID</TableHead>
                    <TableHead className="font-bold">Department</TableHead>
                    <TableHead className="font-bold">Designation</TableHead>
                    <TableHead className="font-bold text-center">Available Balance</TableHead>
                    <TableHead className="text-right font-bold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map(emp => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-bold">{emp.name}</TableCell>
                      <TableCell className="font-mono text-xs">{emp.employeeId}</TableCell>
                      <TableCell>{emp.department}</TableCell>
                      <TableCell>{emp.designation}</TableCell>
                      <TableCell className="text-center font-black text-primary">{emp.advanceLeaveBalance || 0} Days</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="font-bold gap-2" onClick={() => setViewLeaveHistoryEmp(emp)}>
                          <History className="w-4 h-4" /> View History
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Adjust Leave Dialog */}
      <Dialog open={!!adjustLeaveEmp} onOpenChange={(open) => !open && setAdjustLeaveEmp(null)}>
        <DialogContent className="sm:max-w-3xl">
          {adjustLeaveEmp && (
            <>
              <DialogHeader>
                <div className="flex justify-between items-start border-b pb-4">
                  <div>
                    <DialogTitle className="text-xl font-bold">{adjustLeaveEmp.name} ({adjustLeaveEmp.employeeId})</DialogTitle>
                    <DialogDescription>{adjustLeaveEmp.department} / {adjustLeaveEmp.designation} • {selectedMonth}</DialogDescription>
                  </div>
                  <div className="text-right bg-primary/5 p-3 rounded-xl border border-primary/10">
                    <p className="text-[10px] font-black uppercase text-primary tracking-widest">Available Balance</p>
                    <p className="text-2xl font-black text-primary">{adjustLeaveEmp.advanceLeaveBalance || 0} Days</p>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-8 py-6">
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { label: "Working Days", val: getAttendanceSummary(adjustLeaveEmp.employeeId).attendance, color: "text-emerald-600" },
                    { label: "Absent", val: getAttendanceSummary(adjustLeaveEmp.employeeId).absent, color: "text-rose-600" },
                    { label: "Holiday Attendance", val: getAttendanceSummary(adjustLeaveEmp.employeeId).holidayWork, color: "text-amber-600" },
                    { label: "Total Earning Days", val: getAttendanceSummary(adjustLeaveEmp.employeeId).attendance, color: "text-primary font-black" }
                  ].map((stat, i) => (
                    <div key={i} className="bg-slate-50 p-4 rounded-2xl text-center border border-slate-100 shadow-sm">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">{stat.label}</p>
                      <p className={cn("text-xl font-bold mt-1", stat.color)}>{stat.val}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="p-6 bg-slate-900 text-white rounded-3xl space-y-4 shadow-xl">
                    <h4 className="text-sm font-bold flex items-center gap-2"><CalendarClock className="w-4 h-4 text-primary" /> Adjust Leave</h4>
                    <div className="space-y-4 pt-2">
                       <div className="space-y-2">
                          <Label className="text-slate-400">Advance Leave to Use</Label>
                          <Input 
                            type="number" 
                            className="bg-slate-800 border-slate-700 text-white" 
                            value={advanceLeaveValue}
                            onChange={(e) => setAdvanceLeaveValue(parseInt(e.target.value) || 0)}
                          />
                          <p className="text-[10px] text-rose-400 font-bold">Max allowed: {adjustLeaveEmp.advanceLeaveBalance || 0} days</p>
                       </div>
                       <div className="flex flex-col gap-2">
                          <div className="flex gap-2">
                            <Button className="flex-1 bg-primary font-bold" onClick={handleAdjustLeave} disabled={isProcessing}>Add Leave</Button>
                            <Button className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold border-none" onClick={handleMarkNotRequired}>Not Required</Button>
                          </div>
                          <Button variant="ghost" className="w-full text-slate-400 hover:text-white" onClick={() => setAdjustLeaveEmp(null)}>Cancel</Button>
                       </div>
                    </div>
                  </div>

                  <div className="p-6 border-2 border-dashed border-slate-200 rounded-3xl space-y-4">
                    <h4 className="text-sm font-bold flex items-center gap-2"><PlusCircle className="w-4 h-4 text-emerald-600" /> Convert Holiday Work</h4>
                    <div className="space-y-4 pt-2">
                       <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                          <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Selected Month Holiday Work</p>
                          <p className="text-2xl font-black text-emerald-900">{getAttendanceSummary(adjustLeaveEmp.employeeId).holidayWork} Days</p>
                       </div>
                       <Button variant="outline" className="w-full border-emerald-200 text-emerald-700 hover:bg-emerald-50 h-12 font-bold" onClick={handleAddToAdvanceLeave} disabled={isProcessing}>
                         Add to Advance Leave Balance
                       </Button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* View Leave History Dialog */}
      <Dialog open={!!viewLeaveHistoryEmp} onOpenChange={(open) => !open && setViewLeaveHistoryEmp(null)}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          {viewLeaveHistoryEmp && (
            <>
              <DialogHeader className="p-6 border-b bg-slate-50/50">
                <div className="flex justify-between items-start">
                  <div>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                      <History className="w-5 h-5 text-primary" />
                      Advance Leave History
                    </DialogTitle>
                    <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground font-medium">
                      <span className="bg-primary/10 text-primary px-2 py-0.5 rounded font-mono font-bold">{viewLeaveHistoryEmp.name} ({viewLeaveHistoryEmp.employeeId})</span>
                      <span>•</span>
                      <span>{viewLeaveHistoryEmp.department} / {viewLeaveHistoryEmp.designation}</span>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <ScrollArea className="flex-1 p-6">
                <div className="space-y-4">
                  <div className="border rounded-xl overflow-hidden shadow-sm">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="font-bold">Month (MMM-YY)</TableHead>
                          <TableHead className="font-bold text-center">Working Holiday Days</TableHead>
                          <TableHead className="font-bold text-center">Adjust</TableHead>
                          <TableHead className="font-bold text-right">Available Balance Days</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {leaveHistoryData.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-12 text-muted-foreground font-medium">
                              No leave adjustment history found for this employee.
                            </TableCell>
                          </TableRow>
                        ) : (
                          leaveHistoryData.map((row, idx) => (
                            <TableRow key={idx} className="hover:bg-slate-50/50">
                              <TableCell className="font-bold">{row.month}</TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                                  +{row.holidayWork}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">
                                  -{row.adjust}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-black text-primary">
                                {row.balance} Days
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </ScrollArea>

              <div className="p-6 border-t bg-slate-900 text-white flex justify-between items-center">
                <div>
                   <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total Remaining Balance</p>
                   <p className="text-2xl font-black text-emerald-400">{viewLeaveHistoryEmp.advanceLeaveBalance || 0} Days</p>
                </div>
                <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20" onClick={() => setViewLeaveHistoryEmp(null)}>
                  Close History
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
