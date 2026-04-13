
"use client";

import { useState, useMemo, useEffect } from "react";
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent, 
  CardDescription,
  CardFooter
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
  DialogFooter,
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
  Info,
  Wallet,
  CheckCircle2,
  AlertCircle,
  Ban
} from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import { useData } from "@/context/data-context";
import { useToast } from "@/hooks/use-toast";
import { Employee, AttendanceRecord, PayrollRecord, Voucher } from "@/lib/types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Helper to generate MMM-YY month options
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
  const { employees, setEmployees, attendanceRecords, payrollRecords, setPayrollRecords, vouchers } = useData();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("generate");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(PAYROLL_MONTHS[1]); // Default to previous month
  const [isProcessing, setIsProcessing] = useState(false);

  // Tracking for mandatory Adjust Leave step
  const [adjustedEmployees, setAdjustedEmployees] = useState<Record<string, boolean>>({});

  // Modals
  const [adjustLeaveEmp, setAdjustLeaveEmp] = useState<Employee | null>(null);
  const [generateSalaryEmp, setGenerateSalaryEmp] = useState<Employee | null>(null);
  const [advanceLeaveValue, setAdvanceLeaveValue] = useState(0);

  // Salary Gen State
  const [incentivePct, setIncentivePct] = useState(0);

  // Reset adjustment tracking when month changes
  useEffect(() => {
    setAdjustedEmployees({});
  }, [selectedMonth]);

  const filteredEmployees = useMemo(() => {
    return (employees || []).filter(emp => {
      const search = searchTerm.toLowerCase();
      return (
        emp.name.toLowerCase().includes(search) ||
        emp.employeeId.toLowerCase().includes(search) ||
        emp.aadhaar.includes(search)
      );
    });
  }, [employees, searchTerm]);

  const paidVouchers = useMemo(() => {
    return vouchers.filter(v => v.status === 'PAID').reverse();
  }, [vouchers]);

  // Check if salary is already generated for an employee in selected month
  const isSalaryGenerated = (empId: string) => {
    return payrollRecords.some(p => p.employeeId === empId && p.month === selectedMonth);
  };

  // Attendance Logic for Selected Employee and Month
  const getAttendanceSummary = (empId: string) => {
    const records = attendanceRecords.filter(r => r.employeeId === empId || r.employeeId === "emp-mock");
    const presents = records.filter(r => r.status === 'PRESENT').length;
    const halfDays = records.filter(r => r.status === 'HALF_DAY').length;
    const holidays = records.filter(r => r.status === 'HOLIDAY').length;
    
    // Rule: 2 Half Days = 1 Present Day
    const effectiveAttendance = presents + (halfDays * 0.5);
    const totalDaysInMonth = 30; // Mock month length
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
      
      // Mark as adjusted to unlock Generate Salary
      setAdjustedEmployees(prev => ({ ...prev, [adjustLeaveEmp.id]: true }));
      
      toast({ title: "Leave Adjusted", description: `${advanceLeaveValue} days added to earning days.` });
      setAdjustLeaveEmp(null);
      setAdvanceLeaveValue(0);
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
      
      // Mark as adjusted to unlock Generate Salary
      setAdjustedEmployees(prev => ({ ...prev, [adjustLeaveEmp.id]: true }));
      
      toast({ title: "Balance Updated", description: `${summary.holidayWork} days added to Advance Leave Balance.` });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePostSalary = () => {
    if (!generateSalaryEmp || isProcessing) return;
    const summary = getAttendanceSummary(generateSalaryEmp.employeeId);
    const earningDays = summary.attendance + advanceLeaveValue;
    
    const basic = generateSalaryEmp.salary.basic;
    const incentiveAmt = Math.round(basic * (incentivePct / 100));
    const holidayWorkingAmt = Math.round((generateSalaryEmp.salary.netSalary / 30) * summary.holidayWork);
    
    const finalNet = generateSalaryEmp.salary.netSalary + incentiveAmt + holidayWorkingAmt;

    const newPayrollRecord: PayrollRecord = {
      id: Math.random().toString(36).substr(2, 9),
      employeeId: generateSalaryEmp.employeeId,
      employeeName: generateSalaryEmp.name,
      month: selectedMonth,
      attendance: summary.attendance,
      absent: summary.absent,
      adjustLeave: advanceLeaveValue,
      totalEarningDays: earningDays,
      incentivePct: incentivePct,
      incentiveAmt: incentiveAmt,
      holidayWorkDays: summary.holidayWork,
      holidayWorkAmt: holidayWorkingAmt,
      netPayable: finalNet,
      status: 'DRAFT',
      createdAt: new Date().toISOString()
    };

    setPayrollRecords(prev => [...prev, newPayrollRecord]);
    toast({ title: "Salary Generated", description: `Payroll entry created for ${generateSalaryEmp.name}` });
    setGenerateSalaryEmp(null);
    setIncentivePct(0);
    setAdvanceLeaveValue(0); // Reset after use
  };

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
              <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search by Employee Name / ID / Aadhaar..." 
                    className="pl-10 h-10 bg-white"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-full md:w-48 bg-white h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYROLL_MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
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
                    
                    return (
                      <TableRow key={emp.id} className="hover:bg-slate-50/50">
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
                                      onClick={() => isAdjusted && !generated && setGenerateSalaryEmp(emp)}
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

        <TabsContent value="advance" className="mt-8 space-y-6">
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-100 p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-50 rounded-lg"><Wallet className="w-5 h-5 text-emerald-600" /></div>
                <div>
                  <CardTitle className="text-lg font-bold">Paid Advance Ledger</CardTitle>
                  <CardDescription>Track cash advances paid via vouchers.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-bold">Voucher No</TableHead>
                    <TableHead className="font-bold">Employee Name</TableHead>
                    <TableHead className="font-bold">Date Paid</TableHead>
                    <TableHead className="font-bold">Purpose</TableHead>
                    <TableHead className="text-right font-bold">Amount</TableHead>
                    <TableHead className="text-center font-bold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paidVouchers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-20 text-muted-foreground">
                        No paid advance salary records found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paidVouchers.map(v => {
                      const emp = employees.find(e => e.id === v.employeeId);
                      return (
                        <TableRow key={v.id} className="hover:bg-slate-50/50">
                          <TableCell className="font-mono font-bold text-primary">{v.voucherNo}</TableCell>
                          <TableCell className="font-bold">{emp?.name || v.employeeId}</TableCell>
                          <TableCell className="text-sm">{v.date}</TableCell>
                          <TableCell className="text-sm italic">{v.purpose}</TableCell>
                          <TableCell className="text-right font-black text-emerald-600">{formatCurrency(v.amount)}</TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-emerald-600 border-none font-bold">PAID</Badge>
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
             <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-bold">Employee Name</TableHead>
                  <TableHead className="font-bold">Department</TableHead>
                  <TableHead className="font-bold text-center">Available Balance</TableHead>
                  <TableHead className="text-right font-bold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map(emp => (
                  <TableRow key={emp.id}>
                    <TableCell className="font-bold">{emp.name}</TableCell>
                    <TableCell>{emp.department}</TableCell>
                    <TableCell className="text-center font-black text-primary">{emp.advanceLeaveBalance || 0} Days</TableCell>
                    <TableCell className="text-right">
                       <Button variant="ghost" size="sm" className="font-bold gap-2">
                         <History className="w-4 h-4" /> View History
                       </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
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
                            <Button variant="outline" className="flex-1 border-slate-700 text-white hover:bg-slate-800" onClick={handleMarkNotRequired}>Not Required</Button>
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

      {/* Generate Salary Dialog */}
      <Dialog open={!!generateSalaryEmp} onOpenChange={(open) => !open && setGenerateSalaryEmp(null)}>
        <DialogContent className="sm:max-w-4xl">
          {generateSalaryEmp && (
            <>
              <DialogHeader className="border-b pb-4">
                 <div className="flex items-center gap-4">
                   <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center"><Calculator className="text-primary" /></div>
                   <div>
                     <DialogTitle className="text-xl font-bold">Generate Salary • {selectedMonth}</DialogTitle>
                     <DialogDescription>{generateSalaryEmp.name} ({generateSalaryEmp.employeeId})</DialogDescription>
                   </div>
                 </div>
              </DialogHeader>

              <div className="space-y-8 py-6">
                <div className="grid grid-cols-4 gap-4 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                  <div className="text-center border-r">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Attendance</p>
                    <p className="text-lg font-bold">{getAttendanceSummary(generateSalaryEmp.employeeId).attendance}</p>
                  </div>
                  <div className="text-center border-r">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Absent</p>
                    <p className="text-lg font-bold text-rose-600">{getAttendanceSummary(generateSalaryEmp.employeeId).absent}</p>
                  </div>
                  <div className="text-center border-r">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Adjust Leave</p>
                    <p className="text-lg font-bold text-primary">+{advanceLeaveValue}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Total Earning Days</p>
                    <p className="text-xl font-black text-primary">{getAttendanceSummary(generateSalaryEmp.employeeId).attendance + advanceLeaveValue}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <h4 className="text-sm font-bold border-b pb-2 flex items-center gap-2">
                       <PlusCircle className="w-4 h-4 text-primary" /> Earnings & Adjustments
                    </h4>
                    <div className="space-y-4">
                       <div className="p-4 bg-slate-50 rounded-2xl space-y-2">
                          <Label className="text-xs font-bold">Incentive %</Label>
                          <div className="flex items-center gap-3">
                            <Input 
                              type="number" 
                              className="bg-white h-10 font-bold" 
                              placeholder="0"
                              value={incentivePct}
                              onChange={(e) => setIncentivePct(parseFloat(e.target.value) || 0)}
                            />
                            <div className="bg-emerald-100 text-emerald-700 px-3 py-2 rounded-lg font-bold text-xs whitespace-nowrap">
                              +{formatCurrency(Math.round(generateSalaryEmp.salary.basic * (incentivePct / 100)))}
                            </div>
                          </div>
                       </div>

                       <div className="p-4 bg-amber-50 rounded-2xl space-y-2 border border-amber-100">
                          <div className="flex justify-between items-center">
                            <Label className="text-xs font-bold text-amber-900">Holiday Work Pay</Label>
                            <Badge className="bg-amber-500 text-[10px]">{getAttendanceSummary(generateSalaryEmp.employeeId).holidayWork} Days</Badge>
                          </div>
                          <div className="flex items-center gap-3">
                            <Input 
                              className="bg-white/50 h-10 font-bold border-amber-200" 
                              value={formatCurrency(Math.round((generateSalaryEmp.salary.netSalary / 30) * getAttendanceSummary(generateSalaryEmp.employeeId).holidayWork))}
                              readOnly
                            />
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="w-5 h-5 text-amber-400 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent className="bg-slate-900 text-white">
                                   <p className="text-xs">Formula: (Net Salary / 30) * Holiday Days</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                       </div>
                    </div>
                  </div>

                  <div className="bg-slate-900 text-white rounded-3xl p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                      <Calculator size={120} />
                    </div>
                    <div className="space-y-6">
                       <div className="space-y-1">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Monthly CTC (Profile)</p>
                          <p className="text-2xl font-bold">{formatCurrency(generateSalaryEmp.salary.monthlyCTC)}</p>
                       </div>
                       <div className="h-px bg-slate-800" />
                       <div className="space-y-2">
                          <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Estimated Net Payable</p>
                          <h2 className="text-4xl font-black text-emerald-300">
                            {formatCurrency(
                              generateSalaryEmp.salary.netSalary + 
                              Math.round(generateSalaryEmp.salary.basic * (incentivePct / 100)) +
                              Math.round((generateSalaryEmp.salary.netSalary / 30) * getAttendanceSummary(generateSalaryEmp.employeeId).holidayWork)
                            )}
                          </h2>
                          <div className="flex items-center gap-2 text-xs text-slate-400 pt-2">
                             <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                             Statutory deductions (PF/ESIC) applied as per profile.
                          </div>
                       </div>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="border-t pt-6">
                 <Button variant="outline" className="h-12 px-8 font-bold" onClick={() => setGenerateSalaryEmp(null)}>Discard</Button>
                 <Button className="h-12 px-12 bg-emerald-600 hover:bg-emerald-700 font-bold text-lg" onClick={handlePostSalary} disabled={isProcessing}>
                    Finalize & Post Salary
                 </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
