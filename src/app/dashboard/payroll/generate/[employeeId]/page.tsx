
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

  const { employees, attendanceRecords, payrollRecords, vouchers, addRecord } = useData();
  const { toast } = useToast();

  const [isProcessing, setIsProcessing] = useState(false);
  const [incentivePct, setIncentivePct] = useState(0);
  const [advanceRecovery, setAdvanceRecovery] = useState(0);
  const [slipNo, setSlipNo] = useState("");
  const [slipDate, setSlipDate] = useState("");

  useEffect(() => {
    setSlipDate(new Date().toISOString().split('T')[0]);
  }, []);

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

      const earningDays = currentSummary.attendance;
      const totalDays = currentSummary.totalDays;

      // Scale statutory liabilities based on earning days
      const pfEmp = Math.round((employee.salary.employeePF / totalDays) * earningDays);
      const pfEx = Math.round((employee.salary.employerPF / totalDays) * earningDays);
      const esicEmp = Math.round((employee.salary.employeeESIC / totalDays) * earningDays);
      const esicEx = Math.round((employee.salary.employerESIC / totalDays) * earningDays);

      const newPayrollRecord = {
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
        status: 'FINALIZED',
        slipNo: slipNo,
        slipDate: slipDate,

        pfAmountEmployee: pfEmp,
        pfAmountEmployer: pfEx,
        esicAmountEmployee: esicEmp,
        esicAmountEmployer: esicEx,

        salaryPaidAmount: 0,
        salaryHistory: [],
        pfPaidAmountEmployee: 0,
        pfPaidAmountEmployer: 0,
        pfHistory: [],
        esicPaidAmountEmployee: 0,
        esicPaidAmountEmployer: 0,
        esicHistory: []
      };

      addRecord('payroll', newPayrollRecord);
      toast({ title: "Salary Generated", description: `Payroll entry created for ${employee.name}` });
      router.push("/dashboard/payroll");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!employee) return <div>Employee not found.</div>;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] -m-6">
      <div className="p-4 border-b bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold">Generate Salary • {selectedMonth}</h1>
            <p className="text-xs text-muted-foreground">{employee.name} ({employee.employeeId})</p>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 bg-slate-50/30">
        <div className="max-w-7xl mx-auto p-6 lg:p-10 space-y-10">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatBox label="ATTENDANCE" value={currentSummary?.attendance || 0} color="text-slate-900" />
            <StatBox label="ABSENT" value={currentSummary?.absent || 0} color="text-rose-600" />
            <StatBox label="ADV. BALANCE" value={formatCurrency(advanceBalance - advanceRecovery)} color="text-rose-500" symbol="₹" />
          </div>

          <div className="space-y-6">
            <h4 className="text-sm font-bold flex items-center gap-2 border-b pb-3">Earnings & Adjustments</h4>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="p-6 bg-white border border-slate-200 rounded-2xl">
                <Label>Incentive %</Label>
                <Input type="number" value={incentivePct} onChange={(e) => setIncentivePct(parseFloat(e.target.value) || 0)} />
              </div>
              <div className="p-6 bg-rose-50/30 rounded-2xl border-2 border-dashed border-rose-200">
                <Label>Deduction Advance (INR)</Label>
                <Input type="number" value={advanceRecovery} onChange={(e) => setAdvanceRecovery(parseFloat(e.target.value) || 0)} />
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>

      <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center border-t border-slate-800">
        <div className="space-y-1">
          <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Net Payable</p>
          <p className="text-3xl font-black text-emerald-400">{formatCurrency(estimatedFinalNet)}</p>
        </div>
        <Button className="h-12 px-12 bg-emerald-600 hover:bg-emerald-700 font-black" onClick={handlePostSalary} disabled={isProcessing}>
          Finalize & Post Salary
        </Button>
      </div>
    </div>
  );
}

function StatBox({ label, value, color, symbol }: { label: string, value: string | number, color: string, symbol?: string }) {
  return (
    <div className="bg-white p-4 rounded-2xl text-center border border-slate-200">
      <p className="text-[9px] font-black text-slate-400 uppercase mb-1">{label}</p>
      <div className={cn("text-lg font-bold", color)}>{symbol}{value}</div>
    </div>
  );
}
