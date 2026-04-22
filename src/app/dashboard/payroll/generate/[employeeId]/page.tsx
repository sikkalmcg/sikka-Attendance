
"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
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
  ChevronLeft,
  AlertCircle,
  Lock
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
import { parseISO, isValid, isBefore, startOfMonth, format } from "date-fns";

const PROJECT_START_DATE = new Date(2026, 3, 1);

export default function GenerateSalaryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const employeeId = params?.employeeId as string;
  const selectedMonth = searchParams.get("month") || "";
  const queryEarningDays = searchParams.get("earningDays");
  const queryAdjustLeave = searchParams.get("adjustLeave");
  const queryAddedLeave = searchParams.get("addedLeave");

  const { employees, attendanceRecords, payrollRecords, vouchers, addRecord } = useData();
  const { toast } = useToast();

  const [isProcessing, setIsProcessing] = useState(false);
  const [incentivePct, setIncentivePct] = useState(0);
  const [advanceRecovery, setAdvanceRecovery] = useState(0);
  const [slipNo, setSlipNo] = useState("");
  const [slipDate, setSlipDate] = useState("");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    setSlipDate(new Date().toISOString().split('T')[0]);
  }, []);

  const isGenerationAllowed = useMemo(() => {
    if (!selectedMonth) return false;
    const allowedOptions = [];
    const date = new Date();
    for (let i = 0; i <= 12; i++) {
      const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
      if (isBefore(d, startOfMonth(PROJECT_START_DATE))) break;
      const mmm = d.toLocaleString('en-US', { month: 'short' });
      const yy = d.getFullYear().toString().slice(-2);
      allowedOptions.push(`${mmm}-${yy}`);
    }
    return allowedOptions.includes(selectedMonth);
  }, [selectedMonth]);

  useEffect(() => {
    if (isMounted && !isGenerationAllowed) {
      toast({ variant: "destructive", title: "Access Denied" });
      router.push("/dashboard/payroll");
    }
  }, [isMounted, isGenerationAllowed, router, toast]);

  const employee = useMemo(() => employees.find(e => e.id === employeeId), [employees, employeeId]);

  useEffect(() => {
    if (isMounted) {
      const generateNextSlipNo = () => {
        const silRecords = payrollRecords.filter(p => p.slipNo?.startsWith('SIL'));
        if (silRecords.length === 0) return 'SIL00001';
        const numbers = silRecords.map(p => parseInt(p.slipNo?.replace('SIL', '') || "0") || 0);
        return `SIL${(Math.max(...numbers) + 1).toString().padStart(5, '0')}`;
      };
      setSlipNo(generateNextSlipNo());
    }
  }, [payrollRecords, isMounted]);

  const advanceBalance = useMemo(() => {
    if (!employee) return 0;
    const empVouchers = vouchers.filter(v => v.employeeId === employee.id && v.status === 'PAID');
    const totalAdv = empVouchers.reduce((sum, v) => sum + v.amount, 0);
    const totalRecovered = payrollRecords
      .filter(p => p.employeeId === employee.employeeId)
      .reduce((sum, p) => sum + (p.advanceRecovery || 0), 0);
    return Math.max(0, totalAdv - totalRecovered);
  }, [employee, vouchers, payrollRecords]);

  useEffect(() => {
    if (isMounted) setAdvanceRecovery(advanceBalance);
  }, [advanceBalance, isMounted]);

  const currentSummary = useMemo(() => {
    if (!employee || !selectedMonth) return null;
    if (queryEarningDays !== null) {
      const eDays = parseFloat(queryEarningDays);
      return { attendance: eDays, absent: Math.max(0, 26 - eDays), holidayWork: 0, totalDays: 30 };
    }
    return null;
  }, [employee, queryEarningDays, selectedMonth]);

  const netPayBeforeDeduction = useMemo(() => {
    if (!employee || !currentSummary) return 0;
    const basic = employee.salary.basic;
    const incentiveAmt = Math.round(basic * (incentivePct / 100));
    const baseNetPayable = currentSummary.attendance > 0 
      ? Math.round((employee.salary.netSalary / 30) * currentSummary.attendance)
      : 0;
    return baseNetPayable + incentiveAmt;
  }, [employee, currentSummary, incentivePct]);

  const estimatedFinalNet = useMemo(() => Math.max(0, netPayBeforeDeduction - advanceRecovery), [netPayBeforeDeduction, advanceRecovery]);

  const handlePostSalary = () => {
    if (!employee || isProcessing || !currentSummary) return;
    setIsProcessing(true);
    try {
      const basic = employee.salary.basic;
      const incentiveAmt = Math.round(basic * (incentivePct / 100));
      const newRecord: any = {
        employeeId: employee.employeeId,
        employeeName: employee.name,
        month: selectedMonth,
        attendance: currentSummary.attendance,
        absent: currentSummary.absent,
        totalEarningDays: currentSummary.attendance,
        incentivePct: incentivePct,
        incentiveAmt: incentiveAmt,
        advanceRecovery: advanceRecovery,
        netPayable: estimatedFinalNet,
        status: 'FINALIZED',
        slipNo: slipNo,
        slipDate: slipDate,
        createdAt: new Date().toISOString(),
        salaryPaidAmount: 0,
        salaryHistory: []
      };
      addRecord('payroll', newRecord);

      // REQUIREMENT: Salary Generated: Employee Name, Month
      addRecord('notifications', {
        message: `Salary Slip Generated: ${employee.name} (${selectedMonth})`,
        timestamp: format(new Date(), "yyyy-MM-dd HH:mm:ss"),
        read: false,
        type: 'SALARY_GENERATED',
        employeeId: employee.employeeId
      });

      toast({ title: "Salary Generated" });
      router.push("/dashboard/payroll");
    } finally { setIsProcessing(false); }
  };

  if (!isMounted || !employee) return null;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] -m-6">
      <div className="p-4 border-b bg-white flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full"><ChevronLeft className="w-5 h-5" /></Button>
        <div><h1 className="text-lg font-bold">Generate Salary • {selectedMonth}</h1><p className="text-xs text-muted-foreground">{employee.name} ({employee.employeeId})</p></div>
      </div>
      <ScrollArea className="flex-1 bg-slate-50/30">
        <div className="max-w-7xl mx-auto p-10 space-y-10">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
             <StatBox label="EARNING DAYS" value={currentSummary?.attendance || 0} color="text-slate-900" />
             <StatBox label="ABSENT" value={currentSummary?.absent || 0} color="text-rose-600" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
             <div className="p-6 bg-white border border-slate-200 rounded-2xl"><Label className="font-bold text-xs uppercase text-slate-500">Incentive %</Label><Input type="number" value={incentivePct} onChange={(e) => setIncentivePct(parseFloat(e.target.value) || 0)} className="h-12 font-bold text-lg mt-2" /></div>
             <div className="p-6 bg-white border border-slate-200 rounded-2xl"><Label className="font-bold text-xs uppercase text-slate-500">Advance Recovery (INR)</Label><Input type="number" value={advanceRecovery} onChange={(e) => setAdvanceRecovery(parseFloat(e.target.value) || 0)} className="h-12 font-bold text-lg mt-2" /></div>
          </div>
        </div>
      </ScrollArea>
      <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center border-t border-slate-800">
        <div><p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Final Net Payable</p><p className="text-3xl font-black text-emerald-400">{formatCurrency(estimatedFinalNet)}</p></div>
        <Button className="h-12 px-12 font-black bg-emerald-600 hover:bg-emerald-700" onClick={handlePostSalary} disabled={isProcessing}>Finalize & Post Salary</Button>
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: any) {
  return (<div className="bg-white p-4 rounded-2xl text-center border border-slate-200 shadow-sm"><p className="text-[9px] font-black text-slate-400 uppercase mb-1 tracking-widest">{label}</p><div className={cn("text-lg font-black", color)}>{value}</div></div>);
}
