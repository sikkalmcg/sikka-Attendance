
"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  DialogDescription, 
  DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, 
  Calculator, 
  CreditCard, 
  History, 
  CheckCircle2,
  Building2,
  Printer,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Download,
  X,
  Lock,
  ArrowRightCircle,
  PlusCircle,
  ArrowUpRight,
  Info,
  Briefcase,
  CalendarClock,
  Wallet,
  CalendarDays,
  Eye,
  Factory,
  AlertCircle,
  Banknote
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCurrency, numberToIndianWords, cn, formatDate } from "@/lib/utils";
import { useData } from "@/context/data-context";
import { useToast } from "@/hooks/use-toast";
import { Employee, PayrollRecord, SalaryPaymentRecord, Firm, AdvanceLeaveHistoryEntry } from "@/lib/types";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { parseISO, isBefore, startOfMonth, isValid, format, isSunday, eachDayOfInterval, startOfDay } from "date-fns";

const PROJECT_START_DATE = new Date(2026, 3, 1);
const ITEMS_PER_PAGE = 15;

const generatePayrollMonths = (count = 120, includeCurrent = true) => {
  const options = [];
  const date = new Date();
  const startOffset = includeCurrent ? 0 : 1;
  for (let i = startOffset; i < count + (includeCurrent ? 0 : startOffset); i++) {
    const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
    if (isBefore(d, startOfMonth(PROJECT_START_DATE))) break;
    const mmm = d.toLocaleString('en-US', { month: 'short' });
    const yy = d.getFullYear().toString().slice(-2);
    options.push(`${mmm}-${yy}`);
  }
  return options;
};

const PAYROLL_MONTHS_12M_GEN = generatePayrollMonths(13, true);

export default function PayrollPage() {
  const router = useRouter();
  const { employees, attendanceRecords, payrollRecords, vouchers, firms, plants, updateRecord, addRecord, verifiedUser, holidays, leaveRequests } = useData();
  const { toast } = useToast();

  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState("generate");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedPlantId, setSelectedPlantId] = useState("all");
  const [isProcessing, setIsProcessing] = useState(false);

  const [paySalaryRec, setPaySalaryRec] = useState<PayrollRecord | null>(null);
  const [adjustLeaveEmp, setAdjustLeaveEmp] = useState<Employee | null>(null);
  const [viewVouchersEmp, setViewVouchersEmp] = useState<Employee | null>(null);
  const [viewHistoryEmp, setViewHistoryEmp] = useState<Employee | null>(null);
  
  const [isAdjustingBalance, setIsAdjustingBalance] = useState(false);
  const [isBankingHolidayWork, setIsBankingHolidayWork] = useState(false);
  const [isPayingHolidayWork, setIsPayingHolidayWork] = useState(false);
  
  const [adjustmentState, setAdjustmentState] = useState({
    present: 0, 
    absent: 0, 
    absentDates: [] as string[], 
    absentOnLeave: 0,
    absentOnLeaveDates: [] as string[],
    holidayWork: 0, 
    actualHolidayWorked: 0, 
    holidayBanked: 0, 
    holidayPaid: 0, 
    balanceUsed: 0, 
    remainingBalance: 0, 
    totalDays: 0,
    totalWeeklyOff: 0,
    totalHolidays: 0,
    totalWorkingDays: 0
  });

  const [tempAdjustValue, setTempAdjustValue] = useState("");
  const [tempBankValue, setTempBankValue] = useState("");
  const [tempPayValue, setTempPayValue] = useState("");

  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentType, setPaymentType] = useState<'BANKING' | 'CASH' | 'CHEQUE'>('BANKING');
  const [paymentRef, setPaymentRef] = useState("");

  const [adjustedEmployees, setAdjustedEmployees] = useState<Record<string, any>>({});

  useEffect(() => {
    setIsMounted(true);
    const initialMonth = PAYROLL_MONTHS_12M_GEN[0] || "";
    setSelectedMonth(initialMonth);
    setPaymentDate(new Date().toISOString().split('T')[0]);
  }, []);

  const userAssignedPlantIds = useMemo(() => {
    if (!verifiedUser || verifiedUser.role === 'SUPER_ADMIN') return null;
    return verifiedUser.plantIds || [];
  }, [verifiedUser]);

  const authorizedPlants = useMemo(() => {
    if (!userAssignedPlantIds) return plants;
    return plants.filter(p => userAssignedPlantIds.includes(p.id));
  }, [userAssignedPlantIds, plants]);

  const approvedLeavesMap = useMemo(() => {
    const map = new Map<string, boolean>();
    leaveRequests.filter(l => l.status === 'APPROVED').forEach(l => {
      const start = startOfDay(parseISO(l.fromDate));
      const end = startOfDay(parseISO(l.toDate));
      if (!isValid(start) || !isValid(end)) return;
      eachDayOfInterval({ start, end }).forEach(d => {
        map.set(`${l.employeeId}:${format(d, 'yyyy-MM-dd')}`, true);
      });
    });
    return map;
  }, [leaveRequests]);

  const handlePostPayment = () => {
    if (!paySalaryRec || isProcessing) return;
    setIsProcessing(true);
    try {
      const historyEntry: SalaryPaymentRecord = { amount: paymentAmount, date: paymentDate, type: paymentType, reference: paymentRef };
      const newPaid = (paySalaryRec.salaryPaidAmount || 0) + paymentAmount;
      updateRecord('payroll', paySalaryRec.id, { 
        salaryPaidAmount: newPaid, 
        salaryPaidDate: paymentDate, 
        salaryHistory: [...(paySalaryRec.salaryHistory || []), historyEntry], 
        status: newPaid >= paySalaryRec.netPayable ? 'PAID' : 'FINALIZED' 
      });

      if (newPaid >= paySalaryRec.netPayable) {
        addRecord('notifications', {
          message: `Salary Disbursed: ${paySalaryRec.employeeName} (${paySalaryRec.month})`,
          timestamp: format(new Date(), "yyyy-MM-dd HH:mm:ss"),
          read: false,
          type: 'SALARY_PAID',
          employeeId: paySalaryRec.employeeId
        });
      }

      toast({ title: "Payment Recorded" });
      setPaySalaryRec(null);
    } finally { setIsProcessing(false); }
  };

  const getAttendanceMetricsForMonth = (emp: Employee, monthStr: string) => {
    if (!monthStr || monthStr === 'all') return { workedStandard: 0, holidayWork: 0, absents: 0, absentDates: [], absentOnLeave: 0, absentOnLeaveDates: [], totalDays: 0, weeklyOffs: 0, holidays: 0, workingDays: 0 };
    const empId = emp.employeeId;
    const [mmm, yy] = monthStr.split('-');
    const mIndex = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(mmm);
    const year = 2000 + parseInt(yy);
    
    const startDate = new Date(year, mIndex, 1);
    const endDate = new Date(year, mIndex + 1, 0);
    const totalDays = endDate.getDate();
    const dateRange = eachDayOfInterval({ start: startDate, end: endDate });

    let workedStandard = 0;
    let workedSpecial = 0;
    let absentStandard = 0;
    let absentOnLeaveCount = 0;
    let weeklyOffs = 0;
    let holidaysCount = 0;
    const absentDates: string[] = [];
    const absentOnLeaveDates: string[] = [];

    dateRange.forEach(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const isSun = isSunday(date);
      const customHoliday = holidays.find(h => h.date === dateStr && !h.auto);
      const isApprovedLeave = approvedLeavesMap.has(`${empId}:${dateStr}`);
      const record = attendanceRecords.find(r => r.employeeId === empId && r.date === dateStr && r.approved);

      if (isSun) weeklyOffs++;
      else if (customHoliday) holidaysCount++;

      if (isSun || customHoliday) {
        if (record && record.inTime) {
          workedSpecial += (record.status === 'HALF_DAY' ? 0.5 : 1);
        }
      } else {
        if (record && record.inTime) {
          workedStandard += (record.status === 'HALF_DAY' ? 0.5 : 1);
        } else if (isApprovedLeave) {
          absentOnLeaveCount++;
          absentOnLeaveDates.push(dateStr);
        } else {
          absentStandard++;
          absentDates.push(dateStr);
        }
      }
    });

    const alreadyBanked = (emp.advanceLeaveHistory || [])
      .filter(h => h.type === 'ADD' && h.earnedMonth === monthStr.toUpperCase())
      .reduce((sum, h) => sum + (h.earnedDays || 0), 0);

    return { 
      workedStandard, 
      holidayWork: Math.max(0, workedSpecial - alreadyBanked), 
      absents: absentStandard, 
      absentDates,
      absentOnLeave: absentOnLeaveCount,
      absentOnLeaveDates,
      totalDays,
      weeklyOffs,
      holidays: holidaysCount,
      workingDays: totalDays - weeklyOffs - holidaysCount
    };
  };

  const pendingGenerationEmployees = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return employees.filter(emp => {
      if (userAssignedPlantIds) {
        const hasAccess = (emp.unitIds || []).some(id => userAssignedPlantIds.includes(id)) || userAssignedPlantIds.includes(emp.unitId);
        if (!hasAccess) return false;
      }
      
      const match = emp.name.toLowerCase().includes(search) || emp.employeeId.toLowerCase().includes(search);
      const plantMatch = selectedPlantId === "all" || (emp.unitIds || []).includes(selectedPlantId);
      const done = payrollRecords.some(p => p.employeeId === emp.employeeId && p.month === selectedMonth);
      return match && plantMatch && !done;
    }).map(emp => ({ ...emp, metrics: getAttendanceMetricsForMonth(emp, selectedMonth) }));
  }, [employees, searchTerm, selectedPlantId, payrollRecords, selectedMonth, attendanceRecords, userAssignedPlantIds, holidays, approvedLeavesMap]);

  const paymentTabLists = useMemo(() => {
    const search = searchTerm.toLowerCase();
    const filtered = payrollRecords.filter(p => {
      const emp = employees.find(e => e.employeeId === p.employeeId);
      if (userAssignedPlantIds && emp) {
        const hasAccess = (emp.unitIds || []).some(id => userAssignedPlantIds.includes(id)) || userAssignedPlantIds.includes(emp.unitId);
        if (!hasAccess) return false;
      }

      const match = p.employeeName.toLowerCase().includes(search) || p.employeeId.toLowerCase().includes(search);
      const plantMatch = selectedPlantId === "all" || (emp?.unitIds || []).includes(selectedPlantId);
      return match && plantMatch;
    });
    const pending = filtered.filter(p => (p.netPayable - (p.salaryPaidAmount || 0)) > 0);
    return { pending };
  }, [payrollRecords, searchTerm, selectedPlantId, employees, userAssignedPlantIds]);

  const advanceSalaryData = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return employees.filter(emp => {
      if (userAssignedPlantIds) {
        const hasAccess = (emp.unitIds || []).some(id => userAssignedPlantIds.includes(id)) || userAssignedPlantIds.includes(emp.unitId);
        if (!hasAccess) return false;
      }

      const match = emp.name.toLowerCase().includes(search) || emp.employeeId.toLowerCase().includes(search);
      const plantMatch = selectedPlantId === "all" || (emp.unitIds || []).includes(selectedPlantId);
      return match && plantMatch;
    }).map(emp => {
      const empVouchers = vouchers.filter(v => v.employeeId === emp.id && v.status === 'PAID');
      const totalAdv = empVouchers.reduce((sum, v) => sum + v.amount, 0);
      const totalRecovered = payrollRecords
        .filter(p => p.employeeId === emp.employeeId)
        .reduce((sum, p) => sum + (p.advanceRecovery || 0), 0);
      return {
        ...emp,
        totalAdvance: totalAdv,
        totalRecovered: totalRecovered,
        remainingBalance: Math.max(0, totalAdv - totalRecovered)
      };
    }).sort((a, b) => b.remainingBalance - a.remainingBalance);
  }, [employees, vouchers, payrollRecords, searchTerm, selectedPlantId, userAssignedPlantIds]);

  const advanceLeaveData = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return employees.filter(emp => {
      if (userAssignedPlantIds) {
        const hasAccess = (emp.unitIds || []).some(id => userAssignedPlantIds.includes(id)) || userAssignedPlantIds.includes(emp.unitId);
        if (!hasAccess) return false;
      }

      const match = emp.name.toLowerCase().includes(search) || emp.employeeId.toLowerCase().includes(search);
      const plantMatch = selectedPlantId === "all" || (emp.unitIds || []).includes(selectedPlantId);
      return match && plantMatch;
    }).map(emp => {
      return {
        ...emp,
        currentBalance: emp.advanceLeaveBalance || 0
      };
    }).sort((a, b) => b.currentBalance - a.currentBalance);
  }, [employees, searchTerm, selectedPlantId, userAssignedPlantIds]);

  const isAdjustmentReadyToFinalize = useMemo(() => {
    if (!adjustLeaveEmp) return true;
    return adjustmentState.holidayWork === 0;
  }, [adjustmentState.holidayWork, adjustLeaveEmp]);

  const handleSavePayHolidayWork = () => {
    const val = parseFloat(tempPayValue) || 0;
    if (val > adjustmentState.holidayWork) {
      toast({ variant: "destructive", title: "Validation Error", description: "Value cannot exceed available attendance." });
      return;
    }
    setAdjustmentState(p => ({
      ...p,
      present: p.present + val,
      holidayPaid: p.holidayPaid + val,
      holidayWork: p.holidayWork - val
    }));
    setIsPayingHolidayWork(false);
    setTempPayValue("");
    toast({ title: "Holiday Work moved to Pay" });
  };

  const handleSaveBankHolidayWork = () => {
    const val = parseFloat(tempBankValue) || 0;
    if (val > adjustmentState.holidayWork) {
      toast({ variant: "destructive", title: "Validation Error", description: "Value cannot exceed available attendance." });
      return;
    }

    if (adjustLeaveEmp) {
      const dbEmp = employees.find(e => e.id === adjustLeaveEmp.id);
      const currentBalance = dbEmp?.advanceLeaveBalance || 0;
      const currentHistory = dbEmp?.advanceLeaveHistory || [];
      
      const newHistoryEntry: AdvanceLeaveHistoryEntry = {
        id: "ALH-" + Date.now(),
        type: 'ADD',
        earnedMonth: selectedMonth.toUpperCase(),
        earnedDays: val,
        adjustedMonth: null,
        adjustedDays: 0,
        balanceAfter: currentBalance + val,
        timestamp: new Date().toISOString()
      };

      updateRecord('employees', adjustLeaveEmp.id, { 
        advanceLeaveBalance: currentBalance + val,
        advanceLeaveHistory: [...currentHistory, newHistoryEntry]
      });
    }

    setAdjustmentState(p => ({
      ...p,
      holidayBanked: p.holidayBanked + val,
      holidayWork: p.holidayWork - val,
      remainingBalance: p.remainingBalance + val
    }));
    setIsBankingHolidayWork(false);
    setTempBankValue("");
    toast({ title: "Holiday Work Banked to Leave Ledger" });
  };

  const handleSaveAdjustLeave = () => {
    const val = parseFloat(tempAdjustValue) || 0;
    if (val > adjustmentState.remainingBalance) {
      toast({ variant: "destructive", title: "Validation Error", description: "Value cannot exceed available leave balance." });
      return;
    }

    if (adjustLeaveEmp) {
      const dbEmp = employees.find(e => e.id === adjustLeaveEmp.id);
      const currentBalance = dbEmp?.advanceLeaveBalance || 0;
      const currentHistory = [...(dbEmp?.advanceLeaveHistory || [])];
      
      const newHistoryEntry: AdvanceLeaveHistoryEntry = {
        id: "ALH-" + Date.now(),
        type: 'ADJUST',
        earnedMonth: '---', 
        earnedDays: 0,
        adjustedMonth: selectedMonth.toUpperCase(),
        adjustedDays: val,
        balanceAfter: currentBalance - val,
        timestamp: new Date().toISOString()
      };

      updateRecord('employees', adjustLeaveEmp.id, { 
        advanceLeaveBalance: currentBalance - val,
        advanceLeaveHistory: [...currentHistory, newHistoryEntry]
      });
    }

    setAdjustmentState(p => ({
      ...p,
      present: p.present + val,
      absent: Math.max(0, p.absent - val),
      balanceUsed: p.balanceUsed + val,
      remainingBalance: p.remainingBalance - val
    }));
    setIsAdjustingBalance(false);
    setTempAdjustValue("");
    toast({ title: "Leave Adjusted from Ledger" });
  };

  if (!isMounted) return null;

  if (adjustLeaveEmp) {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="rounded-3xl border-none shadow-2xl overflow-hidden bg-white flex flex-col min-h-[calc(100vh-140px)]">
          <div className="p-8 bg-slate-900 text-white shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center"><Calculator className="w-7 h-7 text-primary" /></div>
                <div>
                   <h2 className="text-2xl font-black uppercase">{adjustLeaveEmp.name}</h2>
                   <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">{adjustLeaveEmp.department} / {adjustLeaveEmp.designation}</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="px-6 py-2 bg-white/5 rounded-xl border border-white/10 text-center">
                   <p className="text-[9px] font-black text-primary uppercase">Month</p>
                   <p className="text-sm font-black">{selectedMonth}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Working Days</p>
                 <p className="text-xl font-black">{adjustmentState.totalWorkingDays}</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Weekly Off</p>
                 <p className="text-xl font-black">{adjustmentState.totalWeeklyOff}</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Holidays</p>
                 <p className="text-xl font-black">{adjustmentState.totalHolidays}</p>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-center">
                 <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1">Total Days In Month</p>
                 <p className="text-xl font-black text-emerald-400">{adjustmentState.totalDays}</p>
              </div>
            </div>
          </div>

          <ScrollArea className="flex-1 bg-white">
            <div className="p-10 space-y-12">
               <Table className="border border-slate-100 rounded-2xl">
                  <TableHeader className="bg-slate-50">
                     <TableRow>
                        <TableHead className="py-5 px-8 font-black uppercase text-[11px]">Adjustment Type</TableHead>
                        <TableHead className="text-center font-black uppercase text-[11px]">Days</TableHead>
                        <TableHead className="text-right pr-8 font-black uppercase text-[11px]">Actions</TableHead>
                     </TableRow>
                  </TableHeader>
                  <TableBody>
                     <TableRow>
                        <TableCell className="py-6 px-8 font-bold">Attendance Working Day</TableCell>
                        <TableCell className="text-center font-black text-xl">{adjustmentState.present}</TableCell>
                        <TableCell className="text-right pr-8">
                           <Button variant="outline" className="rounded-xl font-black text-[10px] uppercase h-9 border-slate-200" onClick={() => setIsAdjustingBalance(true)}>Adjust</Button>
                        </TableCell>
                     </TableRow>
                     <TableRow>
                        <TableCell className="py-6 px-8 font-bold">Working on Holiday/Weekly Off</TableCell>
                        <TableCell className="text-center font-black text-xl text-primary">{adjustmentState.holidayWork}</TableCell>
                        <TableCell className="text-right pr-8">
                           <div className="flex justify-end gap-3">
                              <Button 
                                variant="outline"
                                className="h-9 font-black text-[10px] uppercase px-6 bg-slate-50 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 transition-all" 
                                onClick={() => {
                                  setTempPayValue(adjustmentState.holidayWork.toString());
                                  setIsPayingHolidayWork(true);
                                }}
                                disabled={adjustmentState.holidayWork === 0}
                              >
                                Pay
                              </Button>
                              <Button 
                                variant="outline" 
                                className="h-9 font-black text-[10px] uppercase px-4 border-slate-200" 
                                onClick={() => {
                                  setTempBankValue(adjustmentState.holidayWork.toString());
                                  setIsBankingHolidayWork(true);
                                }}
                                disabled={adjustmentState.holidayWork === 0}
                              >
                                Advance Leave
                              </Button>
                           </div>
                        </TableCell>
                     </TableRow>
                     <TableRow>
                        <TableCell className="py-6 px-8 font-bold">Absent on Leave</TableCell>
                        <TableCell className="text-center font-black text-xl text-purple-600">{adjustmentState.absentOnLeave}</TableCell>
                        <TableCell className="text-right pr-8">—</TableCell>
                     </TableRow>
                     <TableRow>
                        <TableCell className="py-6 px-8 font-bold">Absent</TableCell>
                        <TableCell className="text-center font-black text-xl text-rose-600">{adjustmentState.absent}</TableCell>
                        <TableCell className="text-right pr-8">—</TableCell>
                     </TableRow>
                  </TableBody>
               </Table>
               
               <div className="p-10 bg-slate-50 rounded-[2rem] border-2 border-slate-100 flex justify-between items-center shadow-inner">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Final Earning Days Preview</p>
                    <p className="text-xs font-bold text-slate-400 uppercase">
                      WORKED STANDARD ({adjustmentState.present - adjustmentState.holidayPaid - adjustmentState.balanceUsed}) 
                      + LEAVE ADJUSTMENT ({adjustmentState.balanceUsed}) 
                      + HOLIDAY PAY ({adjustmentState.holidayPaid})
                    </p>
                  </div>
                  <p className="text-5xl font-black tracking-tighter text-slate-900">
                    {adjustmentState.present} <span className="text-xl font-bold text-slate-400">Days</span>
                  </p>
               </div>
            </div>
          </ScrollArea>
          
          <div className="p-6 bg-slate-50 border-t flex justify-between items-center">
            <div className="flex items-center gap-2">
               {isAdjustmentReadyToFinalize ? (
                 <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 uppercase font-black text-[10px] py-1.5 px-4 rounded-full">✓ Month Balance Verified</Badge>
               ) : (
                 <Badge className="bg-rose-50 text-rose-700 border-rose-100 uppercase font-black text-[10px] py-1.5 px-4 rounded-full">⚠️ Holiday work Adjustment Pending</Badge>
               )}
            </div>
            <div className="flex gap-4">
              <Button variant="ghost" className="font-bold h-12 px-8 rounded-xl" onClick={() => setAdjustLeaveEmp(null)}>Cancel</Button>
              <Button 
                className="bg-primary px-12 h-12 font-black rounded-xl shadow-xl shadow-primary/20" 
                disabled={!isAdjustmentReadyToFinalize}
                onClick={() => { 
                  setAdjustedEmployees(prev => ({
                    ...prev, 
                    [adjustLeaveEmp.id]: {
                      adjusted: true, 
                      earningDays: adjustmentState.present, 
                      balanceUsed: adjustmentState.balanceUsed, 
                      balanceAdded: adjustmentState.holidayBanked
                    }
                  })); 
                  setAdjustLeaveEmp(null); 
                }}
              >
                Finalize Adjustments
              </Button>
            </div>
          </div>
        </div>

        <Dialog open={isAdjustingBalance} onOpenChange={setIsAdjustingBalance}>
          <DialogContent className="sm:max-w-md rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
            <DialogHeader className="p-8 bg-slate-900 text-white shrink-0">
               <DialogTitle className="text-xl font-black uppercase">Adjust Attendance</DialogTitle>
               <div className="mt-4 pt-4 border-t border-white/10">
                  <p className="text-sm font-black text-primary uppercase">{adjustLeaveEmp.name} • {adjustLeaveEmp.employeeId}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">{selectedMonth}</p>
               </div>
            </DialogHeader>
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                 <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Total Balance Leave</p>
                    <p className="text-xl font-black">{adjustmentState.remainingBalance}</p>
                 </div>
                 <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Absent Days</p>
                    <p className="text-xl font-black text-rose-600">{adjustmentState.absent}</p>
                 </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-500">Days to adjust *</Label>
                <Input 
                  type="number" 
                  step="0.5"
                  className="h-14 text-xl font-black bg-white rounded-xl" 
                  placeholder="Enter adjustment value..."
                  value={tempAdjustValue} 
                  onChange={(e) => setTempAdjustValue(e.target.value)} 
                />
              </div>
            </div>
            <DialogFooter className="p-6 bg-slate-50 border-t flex gap-3">
               <Button variant="ghost" className="flex-1 font-bold h-12 rounded-xl" onClick={() => setIsAdjustingBalance(false)}>Cancel</Button>
               <Button className="flex-1 bg-primary font-black h-12 rounded-xl" onClick={handleSaveAdjustLeave}>Save Adjustment</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isBankingHolidayWork} onOpenChange={setIsBankingHolidayWork}>
          <DialogContent className="sm:max-w-md rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
            <DialogHeader className="p-8 bg-slate-900 text-white shrink-0">
               <DialogTitle className="text-xl font-black uppercase">Holiday Work</DialogTitle>
               <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-2 gap-x-8 gap-y-4">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Employee Name</p>
                    <p className="text-sm font-black text-primary uppercase">{adjustLeaveEmp.name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Month</p>
                    <p className="text-sm font-black text-white uppercase">{selectedMonth}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Attendance on Weekly off/ Holiday</p>
                    <p className="text-xl font-black text-emerald-400">{adjustmentState.holidayWork}</p>
                  </div>
               </div>
            </DialogHeader>
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-500">Add to Advance Leave *</Label>
                <Input 
                  type="number" 
                  step="0.5"
                  className="h-14 text-xl font-black bg-white rounded-xl" 
                  placeholder="Enter days..."
                  value={tempBankValue} 
                  onChange={(e) => setTempBankValue(e.target.value)} 
                />
              </div>
            </div>
            <DialogFooter className="p-6 bg-slate-50 border-t flex gap-3">
               <Button variant="ghost" className="flex-1 font-bold h-12 rounded-xl" onClick={() => setIsBankingHolidayWork(false)}>Cancel</Button>
               <Button className="flex-1 bg-emerald-600 font-black h-12 rounded-xl text-white" onClick={handleSaveBankHolidayWork}>Confirm</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isPayingHolidayWork} onOpenChange={setIsPayingHolidayWork}>
          <DialogContent className="sm:max-w-md rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
            <DialogHeader className="p-8 bg-slate-900 text-white shrink-0">
               <DialogTitle className="text-xl font-black uppercase">Pay Holiday Work</DialogTitle>
               <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Employee Name</p>
                    <p className="text-sm font-black text-primary uppercase">{adjustLeaveEmp.name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Holiday Attendance</p>
                    <p className="text-sm font-black text-white uppercase">{adjustmentState.holidayWork}</p>
                  </div>
               </div>
            </DialogHeader>
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-500">Pay Day *</Label>
                <Input 
                  type="number" 
                  step="0.5"
                  className="h-14 text-xl font-black bg-white rounded-xl" 
                  placeholder="Enter days to pay..."
                  value={tempPayValue} 
                  onChange={(e) => setTempPayValue(e.target.value)} 
                />
              </div>
            </div>
            <DialogFooter className="p-6 bg-slate-50 border-t flex gap-3">
               <Button variant="ghost" className="flex-1 font-bold h-12 rounded-xl" onClick={() => setIsPayingHolidayWork(false)}>Cancel</Button>
               <Button className="flex-1 bg-primary font-black h-12 rounded-xl text-white" onClick={handleSavePayHolidayWork}>Pay</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 font-calibri print:hidden">
        <div><h1 className="text-2xl font-bold">Payroll Management</h1><p className="text-muted-foreground">Centralized alerts and processing for staff earnings.</p></div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 max-w-2xl bg-slate-100 p-1 rounded-xl h-12">
            <TabsTrigger value="generate" className="text-xs font-bold">Generate Salary</TabsTrigger>
            <TabsTrigger value="payment" className="text-xs font-bold">Salary Payment</TabsTrigger>
            <TabsTrigger value="advance" className="text-xs font-bold">Advance Salary</TabsTrigger>
            <TabsTrigger value="advance-leave" className="text-xs font-bold">Advance Leave</TabsTrigger>
          </TabsList>
          
          <TabsContent value="generate" className="mt-8 space-y-6">
            <Card className="border-none shadow-sm">
              <CardHeader className="bg-slate-50 border-b flex flex-col md:flex-row items-center gap-4">
                <div className="relative flex-1 w-full md:w-auto">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search staff..." className="pl-10 h-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <Factory className="w-4 h-4 text-slate-400" />
                  <Select value={selectedPlantId} onValueChange={setSelectedPlantId}>
                    <SelectTrigger className="w-full md:w-56 h-10 font-bold text-xs uppercase bg-white">
                      <SelectValue placeholder="All Plants" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs font-bold uppercase">All Authorized Plants</SelectItem>
                      {authorizedPlants.map(p => (
                        <SelectItem key={p.id} value={p.id} className="text-xs font-bold uppercase">{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-full md:w-40 h-10 font-bold text-xs bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>{PAYROLL_MONTHS_12M_GEN.map(m => <SelectItem key={m} value={m} className="text-xs font-bold">{m}</SelectItem>)}</SelectContent>
                </Select>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="w-full">
                  <Table className="min-w-[1200px]">
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="font-bold px-6">Employee Name / ID</TableHead>
                        <TableHead className="font-bold">Dept / Designation</TableHead>
                        <TableHead className="font-bold">Month</TableHead>
                        <TableHead className="font-bold text-right">Monthly CTC</TableHead>
                        <TableHead className="text-right font-bold pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingGenerationEmployees.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-20 text-muted-foreground font-bold italic">No staff found for selection.</TableCell></TableRow>
                      ) : (
                        pendingGenerationEmployees.map((emp: any) => { 
                          const adj = adjustedEmployees[emp.id]; 
                          return (
                            <TableRow key={emp.id} className="hover:bg-slate-50/50">
                              <TableCell className="px-6 py-4">
                                <div className="flex flex-col">
                                  <span className="font-bold uppercase text-sm">{emp.name}</span>
                                  <span className="text-xs font-mono text-primary font-black">{emp.employeeId}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm font-medium text-slate-700">{emp.department}</div>
                                <div className="text-[10px] text-muted-foreground uppercase">{emp.designation}</div>
                              </TableCell>
                              <TableCell><Badge variant="outline" className="font-bold text-xs">{selectedMonth}</Badge></TableCell>
                              <TableCell className="text-right font-bold text-slate-900">{formatCurrency(emp.salary.monthlyCTC)}</TableCell>
                              <TableCell className="text-right pr-6">
                                <div className="flex justify-end gap-2">
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className={cn("h-8 text-[10px] font-black uppercase rounded-lg", adj?.adjusted && "bg-emerald-50 text-emerald-700 border-emerald-200")} 
                                    onClick={() => { 
                                      const metrics = emp.metrics;
                                      setAdjustmentState({
                                        present: metrics.workedStandard, 
                                        absent: metrics.absents, 
                                        absentDates: metrics.absentDates,
                                        absentOnLeave: metrics.absentOnLeave,
                                        absentOnLeaveDates: metrics.absentOnLeaveDates,
                                        holidayWork: metrics.holidayWork, 
                                        actualHolidayWorked: metrics.holidayWork,
                                        holidayBanked: 0, 
                                        holidayPaid: 0, 
                                        balanceUsed: 0, 
                                        remainingBalance: emp.advanceLeaveBalance || 0, 
                                        totalDays: metrics.totalDays,
                                        totalWeeklyOff: metrics.weeklyOffs,
                                        totalHolidays: metrics.holidays,
                                        totalWorkingDays: metrics.workingDays
                                      }); 
                                      setAdjustLeaveEmp(emp); 
                                    }}
                                  >
                                    Adjust Leave
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    className="h-8 text-[10px] font-black uppercase bg-primary rounded-lg" 
                                    disabled={!adj?.adjusted} 
                                    onClick={() => router.push(`/dashboard/payroll/generate/${emp.id}?month=${selectedMonth}&earningDays=${adj.earningDays}&balanceUsed=${adj.balanceUsed || 0}&balanceAdded=${adj.balanceAdded || 0}`)}
                                  >
                                    Generate
                                  </Button>
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
          
          <TabsContent value="payment" className="mt-8 space-y-6">
            <Card className="border-none shadow-sm">
              <CardHeader className="bg-slate-50 border-b flex flex-col md:flex-row items-center gap-4">
                <div className="relative flex-1 w-full md:w-auto">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search slips..." className="pl-10 h-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <Factory className="w-4 h-4 text-slate-400" />
                  <Select value={selectedPlantId} onValueChange={setSelectedPlantId}>
                    <SelectTrigger className="w-full md:w-56 h-10 font-bold text-xs uppercase bg-white">
                      <SelectValue placeholder="All Plants" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs font-bold uppercase">All Authorized Plants</SelectItem>
                      {authorizedPlants.map(p => (
                        <SelectItem key={p.id} value={p.id} className="text-xs font-bold uppercase">{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="w-full">
                  <Table className="min-w-[1000px]">
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="font-bold px-6">Slip No</TableHead>
                        <TableHead className="font-bold">Employee Name</TableHead>
                        <TableHead className="font-bold text-center">Month</TableHead>
                        <TableHead className="font-bold text-right">Net Payable</TableHead>
                        <TableHead className="text-right font-bold pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paymentTabLists.pending.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-20 text-muted-foreground font-bold italic">No pending payments found.</TableCell></TableRow>
                      ) : (
                        paymentTabLists.pending.map((p) => (
                          <TableRow key={p.id} className="hover:bg-slate-50/50">
                            <TableCell className="px-6 py-4 font-mono font-bold text-blue-600">{p.slipNo}</TableCell>
                            <TableCell className="font-bold uppercase text-sm text-slate-700">{p.employeeName}</TableCell>
                            <TableCell className="text-center"><Badge variant="secondary" className="font-bold">{p.month}</Badge></TableCell>
                            <TableCell className="text-right font-black text-slate-900">{formatCurrency(p.netPayable)}</TableCell>
                            <TableCell className="text-right pr-6">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => { setPaySalaryRec(p); setPaymentAmount(p.netPayable - p.salaryPaidAmount); }}>
                                <CreditCard className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="advance" className="mt-8 space-y-6">
            <Card className="border-none shadow-sm">
              <CardHeader className="bg-slate-50 border-b flex flex-col md:flex-row items-center justify-between p-4 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                    <Wallet className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-black">Advance Salary Ledger</CardTitle>
                    <CardDescription className="text-xs">Tracking advance payments and recoveries.</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-4 w-full md:w-auto">
                  <div className="relative flex-1 md:w-64">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search employee..." className="pl-10 h-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  </div>
                  <Select value={selectedPlantId} onValueChange={setSelectedPlantId}>
                    <SelectTrigger className="w-full md:w-48 h-10 font-bold text-[10px] uppercase bg-white">
                      <SelectValue placeholder="Filter Plant" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs font-bold uppercase">All Plants</SelectItem>
                      {authorizedPlants.map(p => (
                        <SelectItem key={p.id} value={p.id} className="text-xs font-bold uppercase">{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="w-full">
                  <Table className="min-w-[1200px]">
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="font-black text-[11px] uppercase tracking-widest px-6 py-4">Employee Name / ID</TableHead>
                        <TableHead className="font-black text-[11px] uppercase tracking-widest">Dept / Designation</TableHead>
                        <TableHead className="font-black text-[11px] uppercase tracking-widest text-right">Total Advance Given</TableHead>
                        <TableHead className="font-black text-[11px] uppercase tracking-widest text-right">Total Recovered</TableHead>
                        <TableHead className="font-black text-[11px] uppercase tracking-widest text-right">Remaining Balance</TableHead>
                        <TableHead className="font-black text-[11px] uppercase tracking-widest text-right pr-6">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {advanceSalaryData.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-20 text-muted-foreground font-bold italic">No records found for current filters.</TableCell></TableRow>
                      ) : (
                        advanceSalaryData.map((emp) => (
                          <TableRow key={emp.id} className="hover:bg-slate-50/50">
                            <TableCell className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="font-bold uppercase text-sm text-slate-700">{emp.name}</span>
                                <span className="text-[10px] font-mono text-primary font-black uppercase">{emp.employeeId}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-slate-700">{emp.department}</span>
                                <span className="text-[10px] text-muted-foreground uppercase">{emp.designation}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-bold text-slate-600">{formatCurrency(emp.totalAdvance)}</TableCell>
                            <TableCell className="text-right font-bold text-emerald-600">{formatCurrency(emp.totalRecovered)}</TableCell>
                            <TableCell className="text-right">
                              <Badge className={cn("font-black text-sm px-4", emp.remainingBalance > 0 ? "bg-rose-50 text-rose-700 border-rose-100" : "bg-emerald-50 text-emerald-700 border-emerald-100")}>
                                {formatCurrency(emp.remainingBalance)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right pr-6">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="font-black text-primary text-[10px] uppercase gap-1 hover:bg-primary/5 rounded-lg"
                                onClick={() => setViewVouchersEmp(emp)}
                              >
                                <Eye className="w-3.5 h-3.5" /> View Details
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="advance-leave" className="mt-8 space-y-6">
            <Card className="border-none shadow-sm">
              <CardHeader className="bg-slate-50 border-b flex flex-col md:flex-row items-center justify-between p-4 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
                    <CalendarClock className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-black">Advance Leave Ledger</CardTitle>
                    <CardDescription className="text-xs">Holiday/Sunday work banking summary.</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-4 w-full md:w-auto">
                  <div className="relative flex-1 md:w-64">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search employee..." className="pl-10 h-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  </div>
                  <Select value={selectedPlantId} onValueChange={setSelectedPlantId}>
                    <SelectTrigger className="w-full md:w-48 h-10 font-bold text-[10px] uppercase bg-white">
                      <SelectValue placeholder="Filter Plant" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs font-bold uppercase">All Plants</SelectItem>
                      {authorizedPlants.map(p => (
                        <SelectItem key={p.id} value={p.id} className="text-xs font-bold uppercase">{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="w-full">
                  <Table className="min-w-[1000px]">
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="font-black text-[11px] uppercase tracking-widest px-6 py-4">Employee Name / ID</TableHead>
                        <TableHead className="font-black text-[11px] uppercase tracking-widest">Dept / Designation</TableHead>
                        <TableHead className="font-black text-[11px] uppercase tracking-widest text-right pr-6">Current Balance (Days)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {advanceLeaveData.length === 0 ? (
                        <TableRow><TableCell colSpan={3} className="text-center py-20 text-muted-foreground font-bold italic">No leave records found for selection.</TableCell></TableRow>
                      ) : (
                        advanceLeaveData.map((emp) => (
                          <TableRow key={emp.id} className="hover:bg-slate-50/50">
                            <TableCell className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="font-bold uppercase text-sm text-slate-700">{emp.name}</span>
                                <span className="text-[10px] font-mono text-primary font-black uppercase">{emp.employeeId}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-slate-700">{emp.department}</span>
                                <span className="text-[10px] text-muted-foreground uppercase">{emp.designation}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right pr-6">
                              <button onClick={() => setViewHistoryEmp(emp)}>
                                <Badge className={cn(
                                  "font-black text-sm px-5 py-1 rounded-lg cursor-pointer hover:scale-105 transition-transform",
                                  emp.currentBalance > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-slate-50 text-slate-400 border-slate-100"
                                )}>
                                  {emp.currentBalance} Day(s)
                                </Badge>
                              </button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Advance History Dialog */}
        <Dialog open={!!viewVouchersEmp} onOpenChange={(o) => !o && setViewVouchersEmp(null)}>
          <DialogContent className="sm:max-w-4xl p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
            <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
              <DialogTitle className="flex items-center gap-3 text-xl font-black">
                <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center shrink-0">
                  <Wallet className="w-6 h-6 text-primary" />
                </div>
                {viewVouchersEmp?.name} - Advance History
              </DialogTitle>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 ml-13">Voucher Audit Trail</p>
            </DialogHeader>
            <div className="p-6 bg-white">
              <ScrollArea className="h-[50vh] pr-4">
                <Table className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="font-black text-[10px] uppercase py-3">Date</TableHead>
                      <TableHead className="font-black text-[10px] uppercase">Voucher No</TableHead>
                      <TableHead className="text-right font-black text-[10px] uppercase">Amount</TableHead>
                      <TableHead className="font-black text-[10px] uppercase">Purpose</TableHead>
                      <TableHead className="font-black text-[10px] uppercase text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vouchers.filter(v => v.employeeId === viewVouchersEmp?.id).length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground font-bold">No voucher records found.</TableCell></TableRow>
                    ) : (
                      vouchers.filter(v => v.employeeId === viewVouchersEmp?.id).map(v => (
                        <TableRow key={v.id} className="hover:bg-slate-50/50">
                          <TableCell className="text-xs font-bold text-slate-500 py-4">{formatDate(v.date)}</TableCell>
                          <TableCell className="font-mono font-black text-xs text-blue-600">{v.voucherNo}</TableCell>
                          <TableCell className="text-right font-black text-slate-900">{formatCurrency(v.amount)}</TableCell>
                          <TableCell className="text-xs text-slate-600 font-medium">{v.purpose}</TableCell>
                          <TableCell className="text-center">
                            <Badge className={cn(
                              "text-[9px] font-black uppercase px-2 py-0.5 rounded-full",
                              v.status === 'PAID' ? "bg-emerald-50 text-emerald-700" :
                              v.status === 'PENDING' ? "bg-amber-50 text-amber-600" :
                              v.status === 'APPROVED' ? "bg-blue-50 text-blue-700" :
                              "bg-slate-100 text-slate-600"
                            )}>
                              {v.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
            <DialogFooter className="p-4 bg-slate-50 border-t">
              <Button onClick={() => setViewVouchersEmp(null)} className="h-10 rounded-xl font-bold bg-slate-900 px-8 text-white hover:bg-slate-800">Close Trail</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Advance Leave History Dialog */}
        <Dialog open={!!viewHistoryEmp} onOpenChange={(o) => !o && setViewHistoryEmp(null)}>
          <DialogContent className="sm:max-w-4xl p-0 overflow-hidden border-none shadow-2xl rounded-[2rem]">
            <DialogHeader className="p-8 bg-slate-900 text-white shrink-0">
               <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center border border-primary/30">
                     <CalendarClock className="w-8 h-8 text-primary" />
                  </div>
                  <div className="flex-1">
                     <DialogTitle className="text-2xl font-black uppercase tracking-tight">{viewHistoryEmp?.name}</DialogTitle>
                     <p className="text-[11px] font-bold text-primary uppercase tracking-[0.2em] mt-1">Advance Leave Audit Ledger (FIFO)</p>
                  </div>
               </div>
            </DialogHeader>

            <div className="p-8 bg-slate-50/50">
               <div className="bg-white border border-slate-200 shadow-sm overflow-hidden rounded-2xl">
                  <ScrollArea className="max-h-[50vh]">
                     <Table>
                        <TableHeader className="bg-slate-50 sticky top-0 z-10">
                           <TableRow>
                              <TableHead className="font-black text-[10px] uppercase tracking-tighter py-5 px-6">Month (Earned)</TableHead>
                              <TableHead className="font-black text-[10px] uppercase tracking-tighter text-center">Add Leave</TableHead>
                              <TableHead className="font-black text-[10px] uppercase tracking-tighter">Month (Adjusted)</TableHead>
                              <TableHead className="font-black text-[10px] uppercase tracking-tighter text-center">Adjust Leave</TableHead>
                              <TableHead className="font-black text-[10px] uppercase tracking-tighter text-right pr-6">Current Balance</TableHead>
                           </TableRow>
                        </TableHeader>
                        <TableBody>
                           {(!viewHistoryEmp?.advanceLeaveHistory || viewHistoryEmp.advanceLeaveHistory.length === 0) ? (
                              <TableRow><TableCell colSpan={5} className="text-center py-20 text-muted-foreground font-bold italic">No leave history found.</TableCell></TableRow>
                           ) : (
                              [...viewHistoryEmp.advanceLeaveHistory].reverse().map((log) => (
                                <TableRow key={log.id} className="hover:bg-slate-50 transition-colors">
                                   <TableCell className="font-black text-slate-900 text-xs py-5 px-6">{log.earnedMonth || "---"}</TableCell>
                                   <TableCell className="text-center">
                                      {log.earnedDays > 0 ? (
                                        <Badge className="bg-emerald-50 text-emerald-700 font-black border-none">+{log.earnedDays}</Badge>
                                      ) : "---"}
                                   </TableCell>
                                   <TableCell className="font-black text-slate-500 text-xs">{log.adjustedMonth || "---"}</TableCell>
                                   <TableCell className="text-center">
                                      {log.adjustedDays > 0 ? (
                                        <Badge className="bg-rose-50 text-rose-700 font-black border-none">-{log.adjustedDays}</Badge>
                                      ) : "---"}
                                   </TableCell>
                                   <TableCell className="text-right pr-6">
                                      <span className="font-black text-slate-900">{log.balanceAfter} Day(s)</span>
                                   </TableCell>
                                </TableRow>
                              ))
                           )}
                        </TableBody>
                     </Table>
                     <ScrollBar orientation="horizontal" />
                  </ScrollArea>
               </div>
            </div>

            <DialogFooter className="p-6 bg-white border-t flex items-center justify-between">
               <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  Verified Leave Ledger
               </div>
               <Button onClick={() => setViewHistoryEmp(null)} className="h-11 px-8 rounded-xl font-black bg-slate-900 hover:bg-primary transition-all">Close History</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!paySalaryRec} onOpenChange={(o) => !o && setPaySalaryRec(null)}>
          <DialogContent className="sm:max-w-md rounded-2xl overflow-hidden p-0 border-none shadow-2xl">
            <DialogHeader className="p-6 bg-slate-900 text-white">
              <DialogTitle className="flex items-center gap-2 font-black">
                <CreditCard className="w-5 h-5 text-primary" /> Record Disbursement
              </DialogTitle>
              <p className="text-[10px] text-primary font-black uppercase tracking-widest mt-1">Finalizing salary payout for {paySalaryRec?.employeeName}</p>
            </DialogHeader>
            <div className="p-8 space-y-6">
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex justify-between items-center shadow-inner">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount Due</span>
                <span className="text-2xl font-black text-emerald-600">{formatCurrency(paymentAmount)}</span>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Payment Date</Label>
                <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="h-12 font-bold rounded-xl border-slate-200" />
              </div>
              <Button onClick={handlePostPayment} className="w-full h-14 font-black bg-primary text-lg rounded-xl shadow-lg shadow-primary/20" disabled={isProcessing}>
                {isProcessing ? "Finalizing..." : "Confirm & Pay Salary"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
    </div>
  );
}

const getAttendanceMetricsForMonth = (emp: Employee, monthStr: string, holidays: any[], attendanceRecords: any[], approvedLeavesMap: Map<string, boolean>) => {
  if (!monthStr || monthStr === 'all') return { workedStandard: 0, holidayWork: 0, absents: 0, absentDates: [], absentOnLeave: 0, absentOnLeaveDates: [], totalDays: 0, weeklyOffs: 0, holidays: 0, workingDays: 0 };
  const empId = emp.employeeId;
  const [mmm, yy] = monthStr.split('-');
  const mIndex = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(mmm);
  const year = 2000 + parseInt(yy);
  
  const startDate = new Date(year, mIndex, 1);
  const endDate = new Date(year, mIndex + 1, 0);
  const totalDays = endDate.getDate();
  const dateRange = eachDayOfInterval({ start: startDate, end: endDate });

  let workedStandard = 0;
  let workedSpecial = 0;
  let absentStandard = 0;
  let absentOnLeaveCount = 0;
  let weeklyOffs = 0;
  let holidaysCount = 0;
  const absentDates: string[] = [];
  const absentOnLeaveDates: string[] = [];

  dateRange.forEach(date => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const isSun = isSunday(date);
    const customHoliday = holidays.find(h => h.date === dateStr && !h.auto);
    const isApprovedLeave = approvedLeavesMap.has(`${empId}:${dateStr}`);
    const record = attendanceRecords.find(r => r.employeeId === empId && r.date === dateStr && r.approved);

    if (isSun) weeklyOffs++;
    else if (customHoliday) holidaysCount++;

    if (isSun || customHoliday) {
      if (record && record.inTime) {
        workedSpecial += (record.status === 'HALF_DAY' ? 0.5 : 1);
      }
    } else {
      if (record && record.inTime) {
        workedStandard += (record.status === 'HALF_DAY' ? 0.5 : 1);
      } else if (isApprovedLeave) {
        absentOnLeaveCount++;
        absentOnLeaveDates.push(dateStr);
      } else {
        absentStandard++;
        absentDates.push(dateStr);
      }
    }
  });

  const alreadyBanked = (emp.advanceLeaveHistory || [])
    .filter(h => h.type === 'ADD' && h.earnedMonth === monthStr.toUpperCase())
    .reduce((sum, h) => sum + (h.earnedDays || 0), 0);

  return { 
    workedStandard, 
    holidayWork: Math.max(0, workedSpecial - alreadyBanked), 
    absents: absentStandard, 
    absentDates,
    absentOnLeave: absentOnLeaveCount,
    absentOnLeaveDates,
    totalDays,
    weeklyOffs,
    holidays: holidaysCount,
    workingDays: totalDays - weeklyOffs - holidaysCount
  };
};

export function VoucherDocumentContent({ voucher, employees, firms, plants, isPrintMode = false }: any) { 
  const employee = employees.find((e: any) => e.id === voucher.employeeId);
  const firm = firms.find((f: any) => f.id === (employee?.firmId || voucher.firmId));
  const amountInWords = numberToIndianWords(voucher.amount);

  return (
    <div className={cn(
      "w-[210mm] min-h-[297mm] bg-white p-[15mm] flex flex-col font-calibri text-slate-900",
      !isPrintMode && "shadow-2xl mx-auto border border-slate-200"
    )}>
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
          <div className="border-2 border-slate-900 px-4 py-1.5 bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
            <h1 className="text-base font-black tracking-tighter uppercase">PAYMENT VOUCHER</h1>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-end space-y-4 text-right pt-2">
           <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Voucher Number</p>
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

      <div className="mb-14">
        <div className="flex items-center gap-3 mb-4">
           <div className="h-6 w-1.5 bg-slate-900 rounded-full" />
           <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Voucher Details</h3>
        </div>
        <table className="w-full border-collapse border-2 border-slate-900 text-left">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="border-2 border-slate-900 p-1 text-[10px] font-black uppercase tracking-widest w-2/3">Description / Purpose</th>
              <th className="border-2 border-slate-900 p-1 text-[10px] font-black uppercase tracking-widest text-right w-1/3">Amount (INR)</th>
            </tr>
          </thead>
          <tbody>
            <tr className="h-10">
              <td className="border-2 border-slate-900 p-1.5 align-top">
                 <p className="font-black text-slate-800 text-lg uppercase leading-tight tracking-tight">{voucher.purpose}</p>
                 <p className="text-[10px] font-bold text-slate-400 mt-2 italic uppercase">Authorized Advance Payment</p>
              </td>
              <td className="border-2 border-slate-900 p-1.5 align-top text-right bg-slate-50/50">
                 <p className="text-4xl font-black text-slate-900 tracking-tighter">{formatCurrency(voucher.amount)}</p>
              </td>
            </tr>
            <tr className="bg-slate-100/50">
              <td colSpan={2} className="border-2 border-slate-900 p-1.5">
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

      <div className="mt-16 text-center border-t border-slate-50 pt-6">
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.4em] leading-none mb-2">
          Sikka HRMS
        </p>
        <p className="text-[8px] font-medium text-slate-300 uppercase tracking-widest">
          This voucher is generated digitally and it is valid as an original document.
        </p>
      </div>
    </div>
  );
}

const handleSaveAdjustLeave = () => {
    const val = parseFloat(tempAdjustValue) || 0;
    if (val > adjustmentState.remainingBalance) {
      toast({ variant: "destructive", title: "Validation Error", description: "Value cannot exceed available leave balance." });
      return;
    }

    if (adjustLeaveEmp) {
      const dbEmp = employees.find(e => e.id === adjustLeaveEmp.id);
      const currentBalance = dbEmp?.advanceLeaveBalance || 0;
      const currentHistory = [...(dbEmp?.advanceLeaveHistory || [])];
      
      const newHistoryEntry: AdvanceLeaveHistoryEntry = {
        id: "ALH-" + Date.now(),
        type: 'ADJUST',
        earnedMonth: '---', 
        earnedDays: 0,
        adjustedMonth: selectedMonth.toUpperCase(),
        adjustedDays: val,
        balanceAfter: currentBalance - val,
        timestamp: new Date().toISOString()
      };

      updateRecord('employees', adjustLeaveEmp.id, { 
        advanceLeaveBalance: currentBalance - val,
        advanceLeaveHistory: [...currentHistory, newHistoryEntry]
      });
    }

    setAdjustmentState(p => ({
      ...p,
      present: p.present + val,
      absent: Math.max(0, p.absent - val),
      balanceUsed: p.balanceUsed + val,
      remainingBalance: p.remainingBalance - val
    }));
    setIsAdjustingBalance(false);
    setTempAdjustValue("");
    toast({ title: "Leave Adjusted from Ledger" });
  };
