
"use client";

import { useState, useMemo, useEffect } from "react";
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableRow, 
  TableHead, 
  TableCell 
} from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  Search, 
  CheckCircle2, 
  XCircle, 
  Pencil, 
  MapPin, 
  RotateCcw,
  Clock,
  Building2,
  CalendarDays,
  UserCheck,
  FileText,
  Info,
  ChevronRight,
  ChevronLeft,
  History,
  AlertTriangle,
  ArrowRight,
  Download,
  FileSpreadsheet,
  X,
  Filter,
  ArrowRightCircle
} from "lucide-react";
import { cn, formatDate, getWorkingHoursColor, formatMinutesToHHMM, formatHoursToHHMM } from "@/lib/utils";
import { useData } from "@/context/data-context";
import { AttendanceRecord, LeaveRequest } from "@/lib/types";
import { differenceInDays, parseISO, format, isWithinInterval, startOfDay, endOfDay, subDays, isValid, isBefore, addDays, addHours } from "date-fns";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

const ITEMS_PER_PAGE = 15;
const PROJECT_START_DATE_STR = "2026-04-01";

export default function ApprovalsPage() {
  const { attendanceRecords, leaveRequests, employees, updateRecord, addRecord, currentUser } = useData();
  const [isMounted, setIsMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("pending");
  const [pendingType, setPendingType] = useState("attendance");
  const [historyType, setHistoryType] = useState("attendance");
  const [currentPage, setCurrentPage] = useState(1);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);
  const [isLeaveApproveOpen, setIsLeaveApproveOpen] = useState(false);
  const [isLeaveRejectOpen, setIsLeaveRejectOpen] = useState(false);
  const [leaveEditDates, setLeaveEditDates] = useState({ from: "", to: "" });
  const [leaveRejectReason, setLeaveRejectReason] = useState("");
  const [selectedAttendance, setSelectedAttendance] = useState<AttendanceRecord | null>(null);
  const [isAttendanceEditOpen, setIsAttendanceEditOpen] = useState(false);
  const [isAttendanceRejectOpen, setIsAttendanceRejectOpen] = useState(false);
  const [attendanceEditData, setAttendanceEditData] = useState({ date: "", inTime: "", outTime: "" });
  const [attendanceRejectReason, setAttendanceRejectReason] = useState("");
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);
  const [attendanceToRestore, setAttendanceToRestore] = useState<AttendanceRecord | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setIsMounted(true);
    const today = new Date();
    const floorDate = parseISO(PROJECT_START_DATE_STR);
    const thirtyDaysAgo = subDays(today, 30);
    setFromDate(format(isBefore(thirtyDaysAgo, floorDate) ? floorDate : thirtyDaysAgo, "yyyy-MM-dd"));
    setToDate(format(today, "yyyy-MM-dd"));
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [viewMode, pendingType, historyType, fromDate, toDate]);

  const pendingAttendanceList = useMemo(() => {
    if (!isMounted) return [];
    const search = searchTerm.toLowerCase();
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const now = new Date();

    const actualPending = (attendanceRecords || [])
      .filter(rec => !rec.approved && !rec.remark && rec.date >= PROJECT_START_DATE_STR)
      .map(rec => {
        const emp = employees.find(e => e.employeeId === rec.employeeId);
        let processedRec = { ...rec, dept: emp?.department || "N/A", desig: emp?.designation || "N/A" };
        
        // VIRTUAL AUTO-OUT: If shift is > 16 hours, treat it as closed for display
        if (!rec.outTime) {
          const inDT = new Date(`${rec.inDate || rec.date}T${rec.inTime}`);
          const diffHours = (now.getTime() - inDT.getTime()) / (1000 * 60 * 60);
          if (diffHours >= 16) {
            const autoOutDT = addHours(inDT, 8);
            processedRec = {
              ...processedRec,
              outTime: format(autoOutDT, "HH:mm"),
              outDate: format(autoOutDT, "yyyy-MM-dd"),
              hours: 8,
              autoCheckout: true
            };
          }
        }
        return processedRec;
      });

    const missingRecords: any[] = [];
    if (todayStr >= PROJECT_START_DATE_STR) {
      (employees || []).filter(e => e.active).forEach(emp => {
        const hasRecord = (attendanceRecords || []).some(r => r.employeeId === emp.employeeId && r.date === todayStr);
        if (!hasRecord) {
          missingRecords.push({ id: `virtual-absent-${emp.employeeId}-${todayStr}`, employeeId: emp.employeeId, employeeName: emp.name, date: todayStr, inTime: null, outTime: null, hours: 0, status: 'ABSENT', attendanceType: 'ABSENT', approved: false, dept: emp.department, desig: emp.designation, isVirtual: true, unapprovedOutDuration: 0 });
        }
      });
    }

    return [...actualPending, ...missingRecords]
      .filter(rec => (rec.employeeName || "").toLowerCase().includes(search) || (rec.employeeId || "").toLowerCase().includes(search))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [attendanceRecords, employees, searchTerm, isMounted]);

  const pendingLeavesList = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return (leaveRequests || [])
      .filter(l => l.status === 'UNDER_PROCESS' && l.fromDate >= PROJECT_START_DATE_STR)
      .filter(l => (l.employeeName || "").toLowerCase().includes(search) || (l.employeeId || "").toLowerCase().includes(search))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [leaveRequests, searchTerm]);

  const historyAttendanceList = useMemo(() => {
    const search = searchTerm.toLowerCase();
    let list = (attendanceRecords || [])
      .filter(rec => (rec.approved || !!rec.remark) && rec.date >= PROJECT_START_DATE_STR)
      .map(rec => {
        const emp = employees.find(e => e.employeeId === rec.employeeId);
        return { ...rec, dept: emp?.department || "N/A", desig: emp?.designation || "N/A" };
      })
      .filter(rec => (rec.employeeName || "").toLowerCase().includes(search) || (rec.employeeId || "").toLowerCase().includes(search));
    if (fromDate) list = list.filter(r => r.date >= fromDate);
    if (toDate) list = list.filter(r => r.date <= toDate);
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [attendanceRecords, employees, searchTerm, fromDate, toDate]);

  const historyLeavesList = useMemo(() => {
    const search = searchTerm.toLowerCase();
    let list = (leaveRequests || [])
      .filter(l => l.status !== 'UNDER_PROCESS' && l.fromDate >= PROJECT_START_DATE_STR)
      .filter(l => (l.employeeName || "").toLowerCase().includes(search) || (l.employeeId || "").toLowerCase().includes(search));
    if (fromDate) list = list.filter(l => l.fromDate >= fromDate);
    if (toDate) list = list.filter(l => l.toDate <= toDate);
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [leaveRequests, searchTerm, fromDate, toDate]);

  const currentData = useMemo(() => {
    const list = viewMode === 'pending' ? (pendingType === 'attendance' ? pendingAttendanceList : pendingLeavesList) : (historyType === 'attendance' ? historyAttendanceList : historyLeavesList);
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return { items: list.slice(start, start + ITEMS_PER_PAGE), total: list.length, totalPages: Math.ceil(list.length / ITEMS_PER_PAGE) };
  }, [viewMode, pendingType, historyType, pendingAttendanceList, pendingLeavesList, historyAttendanceList, historyLeavesList, currentPage]);

  const handleApproveAttendance = (rec: any) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const approverName = currentUser?.fullName || "HR_ADMIN";
      if (rec.isVirtual) {
        addRecord('attendance', { employeeId: rec.employeeId, employeeName: rec.employeeName, date: rec.date, inDate: rec.date, status: 'ABSENT', attendanceType: 'FIELD', approved: true, approvedBy: approverName, hours: 0, inTime: null, outTime: null, address: 'System Generated Absence', unapprovedOutDuration: 0 });
      } else {
        updateRecord('attendance', rec.id, { approved: true, remark: "", approvedBy: approverName, ...(rec.autoCheckout && { outTime: rec.outTime, outDate: rec.outDate, hours: 8, status: 'PRESENT' }) });
      }
      toast({ title: "Attendance Approved" });
    } finally { setIsProcessing(false); }
  };

  const handleOpenAttendanceEdit = (rec: any) => {
    setSelectedAttendance(rec);
    setAttendanceEditData({ date: rec.date, inTime: rec.inTime || "", outTime: rec.outTime || "" });
    setIsAttendanceEditOpen(true);
  };

  const handlePostAttendanceEdit = () => {
    if (!selectedAttendance || isProcessing) return;
    if (attendanceEditData.date < PROJECT_START_DATE_STR) { toast({ variant: "destructive", title: "Invalid Date", description: `Cannot record data before ${PROJECT_START_DATE_STR}.` }); return; }
    setIsProcessing(true);
    try {
      let finalHours = 0;
      let effectiveOutDate = attendanceEditData.date;
      if (attendanceEditData.inTime && attendanceEditData.outTime) {
        const inDT = new Date(`${attendanceEditData.date}T${attendanceEditData.inTime}`);
        let outDT = new Date(`${attendanceEditData.date}T${attendanceEditData.outTime}`);
        if (outDT < inDT) { outDT = addDays(outDT, 1); effectiveOutDate = format(outDT, "yyyy-MM-dd"); }
        finalHours = parseFloat(((outDT.getTime() - inDT.getTime()) / (1000 * 60 * 60)).toFixed(2));
      }
      if (isNaN(finalHours)) finalHours = 0;
      if ((selectedAttendance as any).isVirtual) {
        addRecord('attendance', { employeeId: selectedAttendance.employeeId, employeeName: selectedAttendance.employeeName, date: attendanceEditData.date, inDate: attendanceEditData.date, outDate: effectiveOutDate, status: finalHours >= 1.0 ? 'PRESENT' : 'ABSENT', attendanceType: 'FIELD', inTime: attendanceEditData.inTime, outTime: attendanceEditData.outTime, hours: finalHours, approved: false, address: 'Manual Admin Entry', unapprovedOutDuration: 0 });
      } else {
        updateRecord('attendance', selectedAttendance.id, { date: attendanceEditData.date, inDate: attendanceEditData.date, outDate: effectiveOutDate, inTime: attendanceEditData.inTime, outTime: attendanceEditData.outTime, hours: finalHours, status: finalHours >= 1.0 ? 'PRESENT' : 'ABSENT' });
      }
      toast({ title: "Record Updated" });
      setIsAttendanceEditOpen(false);
    } finally { setIsProcessing(false); }
  };

  const handlePostAttendanceReject = () => {
    if (!selectedAttendance || !attendanceRejectReason.trim() || isProcessing) return;
    setIsProcessing(true);
    try {
      if ((selectedAttendance as any).isVirtual) {
        addRecord('attendance', { employeeId: selectedAttendance.employeeId, employeeName: selectedAttendance.employeeName, date: selectedAttendance.date, inDate: selectedAttendance.date, status: 'ABSENT', attendanceType: 'FIELD', remark: attendanceRejectReason, approved: false, unapprovedOutDuration: 0, approvedBy: currentUser?.fullName || "HR_ADMIN" });
      } else {
        updateRecord('attendance', selectedAttendance.id, { approved: false, remark: attendanceRejectReason, status: 'ABSENT', approvedBy: currentUser?.fullName || "HR_ADMIN" });
      }
      toast({ variant: "destructive", title: "Log Rejected" });
      setIsAttendanceRejectOpen(false);
    } finally { setIsProcessing(false); }
  };

  if (!isMounted) return null;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div><h1 className="text-2xl font-black text-slate-900 tracking-tight">Organizational Approvals</h1><p className="text-muted-foreground text-sm">Verify logs and manage employee leaves (Since April-2026).</p></div>
      </div>
      <div className="flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search by ID or Name..." className="pl-10 h-10 bg-white" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
        <Tabs value={viewMode} onValueChange={setViewMode} className="w-full md:w-auto"><TabsList className="grid w-full grid-cols-2 bg-slate-100 h-10 p-1 rounded-xl w-[240px]"><TabsTrigger value="pending" className="text-xs font-black data-[state=active]:bg-white data-[state=active]:shadow-sm">Pending</TabsTrigger><TabsTrigger value="history" className="text-xs font-black data-[state=active]:bg-white data-[state=active]:shadow-sm">History</TabsTrigger></TabsList></Tabs>
      </div>
      <div className="space-y-6">
        <Tabs value={viewMode === 'pending' ? pendingType : historyType} onValueChange={viewMode === 'pending' ? setPendingType : setHistoryType} className="w-full">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4"><TabsList className="bg-slate-50 border p-1 h-9 rounded-lg w-fit"><TabsTrigger value="attendance" className="text-[10px] font-black uppercase tracking-widest px-6 h-7">Attendance {viewMode === 'pending' && `(${pendingAttendanceList.length})`}</TabsTrigger><TabsTrigger value="leave" className="text-[10px] font-black uppercase tracking-widest px-6 h-7">Leave Requests {viewMode === 'pending' && `(${pendingLeavesList.length})`}</TabsTrigger></TabsList>{viewMode === 'history' && (<Button variant="outline" size="sm" className="h-9 gap-2 font-bold text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"><FileSpreadsheet className="w-4 h-4" /> Export Excel</Button>)}</div>
          </div>
          <Card className="border-slate-200 shadow-sm overflow-hidden"><CardContent className="p-0"><ScrollArea className="w-full"><Table className="min-w-[1600px]"><TableHeader className="bg-slate-50/50"><TableRow><TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500 py-4 px-6">Employee/ID</TableHead><TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">Dept / Desig</TableHead><TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">{pendingType === 'leave' || historyType === 'leave' ? 'From Date' : 'IN Date Time'}</TableHead><TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">{pendingType === 'leave' || historyType === 'leave' ? 'To Date' : 'OUT Date Time'}</TableHead>
          {pendingType === 'attendance' && (<><TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">IN Plant</TableHead><TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">OUT Plant</TableHead><TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500 text-center">Out Hour</TableHead></>)}
          <TableHead className="font-bold text-[11px] uppercase tracking-widest text-center">{pendingType === 'leave' || historyType === 'leave' ? 'Days' : 'Working Hour'}</TableHead><TableHead className="font-bold text-[11px] uppercase tracking-widest text-center">Type</TableHead><TableHead className="font-bold text-[11px] uppercase tracking-widest text-center">Status</TableHead><TableHead className="text-right font-bold text-[11px] uppercase tracking-widest text-slate-500 pr-6">Action</TableHead></TableRow></TableHeader>
          <TableBody>{currentData.items.map((rec: any) => (<TableRow key={rec.id} className={cn("hover:bg-slate-50/50", rec.autoCheckout && "bg-amber-50/20")}><TableCell className="px-6 py-4"><div className="flex flex-col"><span className="font-bold uppercase text-slate-700 text-sm">{rec.employeeName}</span><span className="text-[10px] font-mono font-black text-primary uppercase">{rec.employeeId}</span></div></TableCell><TableCell><div className="flex flex-col"><span className="text-xs font-bold text-slate-600">{rec.dept}</span><span className="text-[10px] text-muted-foreground uppercase">{rec.desig}</span></div></TableCell>
          <TableCell><div className="flex flex-col"><span className="text-[10px] font-black text-slate-400 uppercase">{formatDate(rec.inDate || rec.date || rec.fromDate)}</span><span className="text-xs font-mono font-bold">{rec.inTime || "--:--"}</span></div></TableCell>
          <TableCell><div className="flex flex-col"><span className="text-[10px] font-black text-slate-400 uppercase">{formatDate(rec.outDate || rec.date || rec.toDate)}</span><span className={cn("text-xs font-mono font-bold", rec.autoCheckout && "text-rose-600")}>{rec.outTime || (rec.isVirtual ? "--:--" : "Shift In-Progress")}</span></div></TableCell>
          {pendingType === 'attendance' && (<><TableCell><span className="text-xs font-bold text-slate-600">{rec.inPlant || "--"}</span></TableCell><TableCell><span className="text-xs font-bold text-slate-600">{rec.outPlant || "--"}</span></TableCell><TableCell className="text-center"><span className="text-xs font-mono font-bold text-rose-600">{formatMinutesToHHMM(rec.unapprovedOutDuration || 0)}</span></TableCell></>)}
          <TableCell className="text-center"><Badge variant="outline" className={cn("font-black text-xs px-3", getWorkingHoursColor(rec.hours))}>{rec.leaveType ? `${rec.days}d` : formatHoursToHHMM(rec.hours)}</Badge></TableCell><TableCell className="text-center"><Badge variant="outline" className="font-black text-[9px] uppercase">{rec.attendanceType || "LEAVE"}</Badge></TableCell><TableCell className="text-center"><Badge className={cn("text-[9px] font-black uppercase px-3", rec.status === 'PRESENT' ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700")}>{rec.autoCheckout ? "AUTO_OUT" : rec.status}</Badge></TableCell>
          <TableCell className="text-right pr-6"><div className="flex justify-end gap-1">{viewMode === 'pending' && (<><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenAttendanceEdit(rec)}><Pencil className="w-3.5 h-3.5" /></Button><Button size="sm" className="h-8 font-black text-[10px] uppercase px-4 bg-emerald-600" onClick={() => handleApproveAttendance(rec)} disabled={isProcessing || (!rec.outTime && rec.status !== 'ABSENT')}>Approve</Button></>)}</div></TableCell></TableRow>))}</TableBody></Table><ScrollBar orientation="horizontal" /></ScrollArea></CardContent></Card>
        </Tabs>
      </div>
      <Dialog open={isAttendanceEditOpen} onOpenChange={setIsAttendanceEditOpen}><DialogContent className="p-0 overflow-hidden rounded-2xl"><DialogHeader className="p-6 bg-slate-900 text-white"><DialogTitle>Edit Attendance Log</DialogTitle></DialogHeader><div className="p-8 space-y-6"><div className="space-y-2"><Label>Date</Label><Input type="date" value={attendanceEditData.date} onChange={(e) => setAttendanceEditData(p => ({...p, date: e.target.value}))} /></div><div className="grid grid-cols-2 gap-4"><div><Label>IN</Label><Input type="time" value={attendanceEditData.inTime} onChange={(e) => setAttendanceEditData(p => ({...p, inTime: e.target.value}))} /></div><div><Label>OUT</Label><Input type="time" value={attendanceEditData.outTime} onChange={(e) => setAttendanceEditData(p => ({...p, outTime: e.target.value}))} /></div></div></div><DialogFooter className="p-6 bg-slate-50 border-t gap-3"><Button variant="ghost" onClick={() => setIsAttendanceEditOpen(false)}>Cancel</Button><Button onClick={handlePostAttendanceEdit} disabled={isProcessing}>Save Adjustments</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
