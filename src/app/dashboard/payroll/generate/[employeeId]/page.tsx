
"use client";

import { useState, useMemo, useEffect, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent, 
  CardDescription
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Calculator, 
  PlusCircle, 
  Info,
  ArrowDownCircle,
  ChevronLeft
} from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import { useData } from "@/context/data-context";
import { useToast } from "@/hooks/use-toast";
import { PayrollRecord } from "@/lib/types";
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function GenerateSalaryPage({ params }: { params: Promise<{ employeeId: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resolvedParams = use(params);
  const employeeId = resolvedParams.employeeId;
  const selectedMonth = searchParams.get("month") || "";

  const { employees, attendanceRecords, payrollRecords, setPayrollRecords, vouchers } = useData();
  const { toast } = useToast();

  const [isProcessing, setIsProcessing] = useState(false);
  const [incentivePct, setIncentivePct] = useState(0);
  const [advanceRecovery, setAdvanceRecovery] = useState(0);
  const [slipNo, setSlipNo] = useState("");
  const [slipDate, setSlipDate] = useState(new Date().toISOString().split('T')[0]);

  const employee = useMemo(() => employees.find(e => e.id === employeeId), [employees, employeeId]);

  // Auto-generate Slip No
  useEffect(() => {
    if (payrollRecords.length >= 0) {
      const generateNextSlipNo = () => {
        const silRecords = payrollRecords.filter(p => p.slipNo?.startsWith('SIL'));
        if (silRecords.length === 0) return 'SIL00001';
        
        const numbers = silRecords.map(p => {
          const numPart = p.slipNo?.replace('SIL', '') || "0";
          return parseInt(numPart) || 0;
        });
        
        const max = Math.max(...numbers);
        return `SIL${(max + 1).toString().padStart(5, '0')}`;
      };
      setSlipNo(generateNextSlipNo());
    }
  }, [payrollRecords]);

  const advanceBalance = useMemo(() => {
    if (!employee) return 0;
    const empVouchers = vouchers.filter(v => v.employeeId === employee.id && v.status === 'PAID');
    const totalAdv = empVouchers.reduce((sum, v) => sum + v.amount, 0);
    const totalRecovered = payrollRecords
      .filter(p => p.employeeId === employee.employeeId)
      .reduce((sum, p) => sum + (p.advanceRecovery || 0), 0);
    return Math.max(0, totalAdv - totalRecovered);
  }, [employee, vouchers, payrollRecords]);

  // Set default deduction to full advance balance
  useEffect(() => {
    setAdvanceRecovery(advanceBalance);
  }, [advanceBalance]);

  const currentSummary = useMemo(() => {
    if (!employee) return null;
    const records = attendanceRecords.filter(r => r.employeeId === employee.employeeId || r.employeeId === "emp-mock");
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
  }, [employee, attendanceRecords]);

  const estimatedFinalNet = useMemo(() => {
    if (!employee || !currentSummary) return 0;
    
    const earningDays = currentSummary.attendance;
    const basic = employee.salary.basic;
    const incentiveAmt = Math.round(basic * (incentivePct / 100));
    
    const baseNetPayable = earningDays > 0 
      ? Math.round((employee.salary.netSalary / currentSummary.totalDays) * earningDays)
      : 0;
      
    const holidayWorkingAmt = Math.round((employee.salary.netSalary / currentSummary.totalDays) * currentSummary.holidayWork);
    
    const final = baseNetPayable + incentiveAmt + holidayWorkingAmt - advanceRecovery;
    return Math.max(0, final);
  }, [employee, currentSummary, incentivePct, advanceRecovery]);

  const handlePostSalary = () => {
    if (!employee || isProcessing || !currentSummary) return;
    
    if (payrollRecords.some(p => p.slipNo === slipNo)) {
      toast({ variant: "destructive", title: "Duplicate Slip No", description: `Salary slip number ${slipNo} already exists.` });
      return;
    }

    setIsProcessing(true);
    try {
      const basic = employee.salary.basic;
      const incentiveAmt = Math.round(basic * (incentivePct / 100));
      const holidayWorkingAmt = Math.round((employee.salary.netSalary / currentSummary.totalDays) * currentSummary.holidayWork);

      const newPayrollRecord: PayrollRecord = {
        id: Math.random().toString(36).substr(2, 9),
        employeeId: employee.employeeId,
        employeeName: employee.name,
        month: selectedMonth,
        attendance: currentSummary.attendance,
        absent: currentSummary.absent,
        adjustLeave: 0,
        totalEarningDays: currentSummary.attendance,
        incentivePct: incentivePct,
        incentiveAmt: incentiveAmt,
        holidayWorkDays: currentSummary.holidayWork,
        holidayWorkAmt: holidayWorkingAmt,
        advanceRecovery: advanceRecovery,
        netPayable: estimatedFinalNet,
        status: 'DRAFT',
        createdAt: new Date().toISOString(),
        slipNo: slipNo,
        slipDate: slipDate
      };

      setPayrollRecords(prev => [...prev, newPayrollRecord]);
      toast({ title: "Salary Generated", description: `Payroll entry created for ${employee.name}` });
      router.push("/dashboard/payroll");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!employee) return <div>Employee not found.</div>;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] -m-6">
      {/* Header - Reduced padding by 40% */}
      <div className="p-4 border-b bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <Calculator className="text-primary w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Generate Salary • {selectedMonth}</h1>
            <p className="text-xs text-muted-foreground">{employee.name} ({employee.employeeId})</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="p-2 bg-slate-50 border rounded-xl flex items-center gap-4 shadow-sm">
            <div className="space-y-0.5">
              <Label className="text-[9px] uppercase font-black text-slate-400 px-1">Salary Slip No</Label>
              <Input 
                value={slipNo} 
                readOnly
                className="h-8 w-32 font-mono font-bold text-xs bg-slate-100 border-slate-200"
              />
            </div>
            <div className="space-y-0.5">
              <Label className="text-[9px] uppercase font-black text-slate-400 px-1">Slip Dated</Label>
              <Input 
                type="date"
                value={slipDate} 
                onChange={(e) => setSlipDate(e.target.value)} 
                className="h-8 w-40 font-bold text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <ScrollArea className="flex-1 bg-slate-50/30">
        <div className="max-w-7xl mx-auto p-6 lg:p-10 space-y-10">
          {/* Stats Row - 6 Columns */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatBox label="ATTENDANCE" value={currentSummary?.attendance || 0} color="text-slate-900" />
            <StatBox label="ABSENT" value={currentSummary?.absent || 0} color="text-rose-600" />
            <StatBox label="ADJUST LEAVE" value="+0" color="text-primary" />
            <StatBox label="HOLIDAY WORK" value={currentSummary?.holidayWork || 0} color="text-amber-600" />
            <StatBox label="TOTAL EARNING DAYS" value={currentSummary?.attendance || 0} color="text-primary font-black" />
            <StatBox label="ADV. BALANCE" value={formatCurrency(advanceBalance - advanceRecovery)} color="text-rose-500" symbol="₹" />
          </div>

          {/* Earnings & Adjustments Section */}
          <div className="space-y-6">
            <h4 className="text-sm font-bold flex items-center gap-2 border-b pb-3">
              <PlusCircle className="w-4 h-4 text-primary" /> Earnings & Adjustments
            </h4>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4">
                <Label className="text-xs font-bold text-slate-700">Incentive %</Label>
                <div className="flex items-center gap-4">
                  <Input 
                    type="number" 
                    className="h-12 text-lg font-bold bg-slate-50 border-slate-200" 
                    placeholder="0"
                    value={incentivePct}
                    onChange={(e) => setIncentivePct(parseFloat(e.target.value) || 0)}
                  />
                  <div className="h-12 flex items-center px-4 bg-emerald-50 text-emerald-700 rounded-xl font-black text-xs whitespace-nowrap border border-emerald-100">
                    + {formatCurrency(Math.round(employee.salary.basic * (incentivePct / 100)))}
                  </div>
                </div>
              </div>

              <div className="p-6 bg-rose-50/30 rounded-2xl space-y-4 border-2 border-dashed border-rose-200">
                <Label className="text-xs font-bold text-rose-900 flex items-center gap-2">
                  <ArrowDownCircle className="w-4 h-4" /> Deduction Advance Salary (INR)
                </Label>
                <Input 
                  type="number" 
                  className="h-12 text-lg font-bold bg-white border-rose-200 focus-visible:ring-rose-500" 
                  placeholder="0"
                  value={advanceRecovery}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    if (val <= advanceBalance) {
                      setAdvanceRecovery(val);
                    } else {
                      toast({ 
                        variant: "destructive", 
                        title: "Limit Exceeded", 
                        description: `Cannot deduct more than available advance (${formatCurrency(advanceBalance)}).` 
                      });
                    }
                  }}
                />
              </div>

              <div className="p-6 bg-amber-50/20 rounded-2xl space-y-4 border-2 border-dashed border-amber-200 lg:col-span-2">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-bold text-amber-900">Holiday Work Pay</Label>
                  <Badge className="bg-amber-500 text-[10px] font-bold px-2 py-0.5 rounded-full">{currentSummary?.holidayWork || 0} Days</Badge>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1 h-12 flex items-center px-4 bg-white/70 border-2 border-amber-100 rounded-xl font-black text-lg">
                    {formatCurrency(Math.round((employee.salary.netSalary / 30) * (currentSummary?.holidayWork || 0)))}
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="p-2 cursor-help rounded-full bg-amber-100 hover:bg-amber-200 transition-colors">
                          <Info className="w-5 h-5 text-amber-600" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="bg-slate-900 text-white p-3 text-xs">
                        <p className="font-bold mb-1">Calculation Logic:</p>
                        <p className="text-slate-400">(Net Salary / 30) * Holiday Days</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Footer - Reduced padding by 40% */}
      <div className="px-6 py-4 bg-slate-900 text-white flex flex-col sm:flex-row justify-between items-center gap-6 border-t border-slate-800">
        <div className="flex gap-10 items-center mr-auto">
          <div className="space-y-1">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Monthly CTC (Profile)</p>
            <p className="text-xl font-bold">{formatCurrency(employee.salary.monthlyCTC)}</p>
          </div>
          <div className="border-l border-slate-700 h-10" />
          <div className="space-y-1">
            <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Estimated Net Payable</p>
            <p className="text-3xl font-black text-emerald-400 tracking-tight">{formatCurrency(estimatedFinalNet)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            className="h-12 px-8 font-bold bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white rounded-xl"
            onClick={() => router.back()}
          >
            Discard
          </Button>
          <Button 
            className="h-12 px-12 bg-emerald-600 hover:bg-emerald-700 font-black text-lg shadow-xl shadow-emerald-900/40 rounded-xl transition-all active:scale-95" 
            onClick={handlePostSalary} 
            disabled={isProcessing}
          >
            {isProcessing ? "Processing..." : "Finalize & Post Salary"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, color, symbol }: { label: string, value: string | number, color: string, symbol?: string }) {
  return (
    <div className="bg-white p-4 rounded-2xl text-center border border-slate-200 shadow-sm transition-all hover:shadow-md hover:border-primary/20">
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <div className={cn("text-lg font-bold flex items-center justify-center gap-0.5", color)}>
        {symbol && <span className="text-sm opacity-70">{symbol}</span>}
        {value}
      </div>
    </div>
  );
}
