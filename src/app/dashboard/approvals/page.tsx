
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
  RotateCcw,
  Clock,
  FileSpreadsheet,
  ChevronRight,
  ChevronLeft,
  X,
  AlertTriangle
} from "lucide-react";
import { cn, formatDate, getWorkingHoursColor, formatMinutesToHHMM, formatHoursToHHMM } from "@/lib/utils";
import { useData } from "@/context/data-context";
import { AttendanceRecord, LeaveRequest } from "@/lib/types";
import { parseISO, format, subDays, isBefore, addDays, addHours, isSunday } from "date-fns";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

const ITEMS_PER_PAGE = 15;
const PROJECT_START_DATE_STR = "2026-04-01";

export default function ApprovalsPage() {
  const { attendanceRecords, leaveRequests, employees, updateRecord, addRecord, currentUser, holidays } = useData();
  const [isMounted, setIsMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("pending");
  const [pendingType, setPendingType] = useState("attendance");
  const [historyType, setHistoryType] = useState("attendance");
  const [currentPage, setCurrentPage] = useState(1);

  // Attendance Reject/Edit/Restore States
  const [selectedAttendance, setSelectedAttendance] = useState<any>(null);
  const [isAttendanceEditOpen, setIsAttendanceEditOpen] = useState(false);
  const [isAttendanceRejectOpen, setIsAttendanceRejectOpen] = useState(false);
  const [attendanceEditData, setAttendanceEditData] = useState({ date: "", inTime: "", outTime: "" });
  const [attendanceRejectReason, setAttendanceRejectReason] = useState("");
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);
  const [attendanceToRestore, setAttendanceToRestore] = useState<any>(null);

  // Leave States
  const [selectedLeave, setSelectedLeave] = useState<any>(null);
  const [isLeaveRejectOpen, setIsLeaveRejectOpen] = useState(false);
  const [leaveRejectReason, setLeaveRejectReason] = useState("");

  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [viewMode, pendingType, historyType]);

  const getPriorityStatus = (dateStr: string, record: any) => {
    const isSun = isSunday(parseISO(dateStr));
    const holiday = (holidays || []).find(h => h.date === dateStr);
    
    if (record) {
      if (holiday) return "Present on Holiday";
      if (isSun) return "Present on Weekly Off";
      return record.status;
    } else {
      if (holiday) return `Holiday (${holiday.name})`;
      if (isSun) return "Weekly Off";
      return "Absent";
    }
  };

  const pendingAttendanceList = useMemo(() => {
    if (!isMounted) return [];
    const search = searchTerm.toLowerCase();
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const now = new Date();

    const actualPending = (attendanceRecords || [])
      .filter(rec => !rec.approved && !rec.remark && rec.date >= PROJECT_START_DATE_STR)
      .map(rec => {
        const emp = employees.find(e => e.employeeId === rec.employeeId);
        const displayStatus = getPriorityStatus(rec.date, rec);
        let processedRec = { ...rec, dept: emp?.department || "N/A", desig: emp?.designation || "N/A", displayStatus };
        
        if (!rec.outTime) {
          const inDT = new Date(`${rec.inDate || rec.date}T${rec.inTime}`);
          const diffHours = (now.getTime() - inDT.getTime()) / (1000 * 60 * 60);
          if (diffHours >= 16) {
            const autoOutDT = addHours(inDT, 16);
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
          const displayStatus = getPriorityStatus(todayStr, null);
          missingRecords.push({ 
            id: `v-abs-${emp.employeeId}-${todayStr}`, 
            employeeId: emp.employeeId, 
            employeeName: emp.name, 
            date: todayStr, 
            status: 'ABSENT', 
            displayStatus,
            attendanceType: 'ABSENT', 
            approved: false, 
            dept: emp.department, 
            desig: emp.designation, 
            isVirtual: true, 
            hours: 0,
            unapprovedOutDuration: 0 
          });
        }
      });
    }

    return [...actualPending, ...missingRecords]
      .filter(rec => (rec.employeeName || "").toLowerCase().includes(search) || (rec.employeeId || "").toLowerCase().includes(search))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [attendanceRecords, employees, searchTerm, isMounted, holidays]);

  const historyAttendanceList = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return (attendanceRecords || [])
      .filter(rec => (rec.approved || !!rec.remark) && rec.date >= PROJECT_START_DATE_STR)
      .map(rec => {
        const emp = employees.find(e => e.employeeId === rec.employeeId);
        const displayStatus = getPriorityStatus(rec.date, rec);
        return { ...rec, dept: emp?.department || "N/A", desig: emp?.designation || "N/A", displayStatus };
      })
      .filter(rec => (rec.employeeName || "").toLowerCase().includes(search) || (rec.employeeId || "").toLowerCase().includes(search))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [attendanceRecords, employees, searchTerm, holidays]);

  const currentData = useMemo(() => {
    const list = viewMode === 'pending' ? (pendingType === 'attendance' ? pendingAttendanceList : leaveRequests.filter(l => l.status === 'UNDER_PROCESS')) : (historyType === 'attendance' ? historyAttendanceList : leaveRequests.filter(l => l.status !== 'UNDER_PROCESS'));
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return { items: list.slice(start, start + ITEMS_PER_PAGE), total: list.length, totalPages: Math.ceil(list.length / ITEMS_PER_PAGE) };
  }, [viewMode, pendingType, historyType, pendingAttendanceList, historyAttendanceList, leaveRequests, currentPage]);

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

  const handlePostAttendanceEdit = () => {
    if (!selectedAttendance || isProcessing) return;
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
      if (selectedAttendance.isVirtual) {
        addRecord('attendance', { employeeId: selectedAttendance.employeeId, employeeName: selectedAttendance.employeeName, date: attendanceEditData.date, inDate: attendanceEditData.date, outDate: effectiveOutDate, status: finalHours >= 1.0 ? 'PRESENT' : 'ABSENT', attendanceType: 'FIELD', inTime: attendanceEditData.inTime, outTime: attendanceEditData.outTime, hours: finalHours, approved: false, address: 'Manual Entry', unapprovedOutDuration: 0 });
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
      const approver = currentUser?.fullName || "HR_ADMIN";
      if (selectedAttendance.isVirtual) {
        addRecord('attendance', { employeeId: selectedAttendance.employeeId, employeeName: selectedAttendance.employeeName, date: selectedAttendance.date, inDate: selectedAttendance.date, status: 'ABSENT', attendanceType: 'FIELD', remark: attendanceRejectReason, approved: false, unapprovedOutDuration: 0, approvedBy: approver });
      } else {
        updateRecord('attendance', selectedAttendance.id, { approved: false, remark: attendanceRejectReason, status: 'ABSENT', approvedBy: approver });
      }
      toast({ variant: "destructive", title: "Log Rejected" });
      setIsAttendanceRejectOpen(false);
      setAttendanceRejectReason("");
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
        <Tabs value={viewMode} onValueChange={setViewMode} className="w-full md:w-auto"><TabsList className="grid w-full grid-cols-2 bg-slate-100 h-10 p-1 rounded-xl w-[240px]"><TabsTrigger value="pending" className="text-xs font-black">Pending</TabsTrigger><TabsTrigger value="history" className="text-xs font-black">History</TabsTrigger></TabsList></Tabs>
      </div>

      <Tabs value={viewMode === 'pending' ? pendingType : historyType} onValueChange={viewMode === 'pending' ? setPendingType : setHistoryType} className="w-full">
        <TabsList className="bg-slate-50 border p-1 h-9 rounded-lg w-fit mb-4">
          <TabsTrigger value="attendance" className="text-[10px] font-black uppercase px-6 h-7">Attendance</TabsTrigger>
          <TabsTrigger value="leave" className="text-[10px] font-black uppercase px-6 h-7">Leave Requests</TabsTrigger>
        </TabsList>

        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <ScrollArea className="w-full">
              <Table className="min-w-[1200px]">
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500 py-4 px-6">Employee/ID</TableHead>
                    <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">Dept / Desig</TableHead>
                    <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">Date/Time</TableHead>
                    <TableHead className="font-bold text-[11px] uppercase tracking-widest text-center">Work Hour</TableHead>
                    <TableHead className="font-bold text-[11px] uppercase tracking-widest text-center">Status</TableHead>
                    <TableHead className="text-right font-bold text-[11px] uppercase tracking-widest text-slate-500 pr-6">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentData.items.map((rec: any) => (
                    <TableRow key={rec.id} className={cn("hover:bg-slate-50/50", rec.autoCheckout && "bg-amber-50/20")}>
                      <TableCell className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold uppercase text-slate-700 text-sm">{rec.employeeName}</span>
                          <span className="text-[10px] font-mono font-black text-primary uppercase">{rec.employeeId}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-600">{rec.dept || rec.department}</span>
                          <span className="text-[10px] text-muted-foreground uppercase">{rec.desig || rec.designation}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-slate-400 uppercase">{formatDate(rec.inDate || rec.date)}</span>
                          <span className="text-xs font-mono font-bold">{rec.inTime || "--:--"} - {rec.outTime || "--:--"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={cn("font-black text-xs px-3", getWorkingHoursColor(rec.hours))}>
                          {formatHoursToHHMM(rec.hours)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={cn("text-[9px] font-black uppercase px-3", rec.displayStatus?.includes("Present") ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700")}>
                          {rec.displayStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex justify-end gap-1">
                          {viewMode === 'pending' ? (
                            <>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600" onClick={() => { setSelectedAttendance(rec); setIsAttendanceRejectOpen(true); }}><XCircle className="w-3.5 h-3.5" /></Button>
                              <Button size="sm" className="h-8 font-black text-[10px] uppercase bg-emerald-600" onClick={() => handleApproveAttendance(rec)}>Approve</Button>
                            </>
                          ) : (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-primary" onClick={() => { setAttendanceToRestore(rec); setIsRestoreConfirmOpen(true); }}><RotateCcw className="w-3.5 h-3.5" /></Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </CardContent>
        </Card>
      </Tabs>

      <Dialog open={isAttendanceRejectOpen} onOpenChange={setIsAttendanceRejectOpen}>
        <DialogContent className="p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="p-6 bg-rose-600 text-white"><DialogTitle>Reject Attendance Log</DialogTitle></DialogHeader>
          <div className="p-8 space-y-4">
            <Label className="font-bold">Rejection Reason *</Label>
            <Textarea placeholder="Reason for rejection..." value={attendanceRejectReason} onChange={(e) => setAttendanceRejectReason(e.target.value)} className="min-h-[120px]" />
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t gap-3"><Button variant="ghost" onClick={() => setIsAttendanceRejectOpen(false)}>Cancel</Button><Button variant="destructive" onClick={handlePostAttendanceReject} disabled={!attendanceRejectReason.trim() || isProcessing}>Confirm Rejection</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
