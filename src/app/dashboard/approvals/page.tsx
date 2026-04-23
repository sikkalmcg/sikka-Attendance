
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
import { parseISO, format, subDays, isBefore, addDays, addHours } from "date-fns";
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
          missingRecords.push({ 
            id: `v-abs-${emp.employeeId}-${todayStr}`, 
            employeeId: emp.employeeId, 
            employeeName: emp.name, 
            date: todayStr, 
            status: 'ABSENT', 
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
    if (attendanceEditData.date < PROJECT_START_DATE_STR) { toast({ variant: "destructive", title: "Invalid Date" }); return; }
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

  const handleRestoreAttendance = () => {
    if (!attendanceToRestore || isProcessing) return;
    setIsProcessing(true);
    try {
      updateRecord('attendance', attendanceToRestore.id, { approved: false, remark: "" });
      toast({ title: "Record Restored", description: "Log moved to Pending section." });
      setIsRestoreConfirmOpen(false);
      setAttendanceToRestore(null);
    } finally { setIsProcessing(false); }
  };

  const handleApproveLeave = (leave: any) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      updateRecord('leaveRequests', leave.id, { status: 'APPROVED', approvedBy: currentUser?.fullName || "HR_ADMIN" });
      toast({ title: "Leave Approved" });
    } finally { setIsProcessing(false); }
  };

  const handlePostLeaveReject = () => {
    if (!selectedLeave || !leaveRejectReason.trim() || isProcessing) return;
    setIsProcessing(true);
    try {
      updateRecord('leaveRequests', selectedLeave.id, { status: 'REJECTED', rejectReason: leaveRejectReason, approvedBy: currentUser?.fullName || "HR_ADMIN" });
      toast({ variant: "destructive", title: "Leave Rejected" });
      setIsLeaveRejectOpen(false);
      setLeaveRejectReason("");
    } finally { setIsProcessing(false); }
  };

  if (!isMounted) return null;

  const currentTab = viewMode === 'pending' ? pendingType : historyType;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div><h1 className="text-2xl font-black text-slate-900 tracking-tight">Organizational Approvals</h1><p className="text-muted-foreground text-sm">Verify logs and manage employee leaves (Since April-2026).</p></div>
      </div>
      <div className="flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search by ID or Name..." className="pl-10 h-10 bg-white" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
        <Tabs value={viewMode} onValueChange={setViewMode} className="w-full md:w-auto"><TabsList className="grid w-full grid-cols-2 bg-slate-100 h-10 p-1 rounded-xl w-[240px]"><TabsTrigger value="pending" className="text-xs font-black">Pending</TabsTrigger><TabsTrigger value="history" className="text-xs font-black">History</TabsTrigger></TabsList></Tabs>
      </div>

      <Tabs value={currentTab} onValueChange={viewMode === 'pending' ? setPendingType : setHistoryType} className="w-full">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
          <TabsList className="bg-slate-50 border p-1 h-9 rounded-lg w-fit">
            <TabsTrigger value="attendance" className="text-[10px] font-black uppercase px-6 h-7">Attendance {viewMode === 'pending' && `(${pendingAttendanceList.length})`}</TabsTrigger>
            <TabsTrigger value="leave" className="text-[10px] font-black uppercase px-6 h-7">Leave Requests {viewMode === 'pending' && `(${pendingLeavesList.length})`}</TabsTrigger>
          </TabsList>
          {viewMode === 'history' && (<Button variant="outline" size="sm" className="h-9 gap-2 font-bold text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"><FileSpreadsheet className="w-4 h-4" /> Export Excel</Button>)}
        </div>

        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <ScrollArea className="w-full">
              <Table className="min-w-[1200px]">
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500 py-4 px-6">Employee/ID</TableHead>
                    <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">Dept / Desig</TableHead>
                    <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">{currentTab === 'leave' ? 'From Date' : 'IN Date Time'}</TableHead>
                    <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">{currentTab === 'leave' ? 'To Date' : 'OUT Date Time'}</TableHead>
                    
                    {currentTab === 'attendance' && (
                      <>
                        <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">IN Plant</TableHead>
                        <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">OUT Plant</TableHead>
                        <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500 text-center">Out Hour</TableHead>
                      </>
                    )}

                    <TableHead className="font-bold text-[11px] uppercase tracking-widest text-center">{currentTab === 'leave' ? 'Days' : 'Working Hour'}</TableHead>
                    <TableHead className="font-bold text-[11px] uppercase tracking-widest text-center">Type</TableHead>
                    <TableHead className="font-bold text-[11px] uppercase tracking-widest text-center">Status</TableHead>
                    
                    {!(viewMode === 'history' && currentTab === 'leave') && (
                      <TableHead className="text-right font-bold text-[11px] uppercase tracking-widest text-slate-500 pr-6">Action</TableHead>
                    )}
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
                          <span className="text-[10px] font-black text-slate-400 uppercase">{formatDate(rec.inDate || rec.date || rec.fromDate)}</span>
                          <span className="text-xs font-mono font-bold">{rec.inTime || "--:--"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-slate-400 uppercase">{formatDate(rec.outDate || rec.date || rec.toDate)}</span>
                          <span className={cn("text-xs font-mono font-bold", rec.autoCheckout && "text-rose-600")}>{rec.outTime || (rec.isVirtual ? "--:--" : "Shift In-Progress")}</span>
                        </div>
                      </TableCell>

                      {currentTab === 'attendance' && (
                        <>
                          <TableCell><span className="text-xs font-bold text-slate-600">{rec.inPlant || "--"}</span></TableCell>
                          <TableCell><span className="text-xs font-bold text-slate-600">{rec.outPlant || "--"}</span></TableCell>
                          <TableCell className="text-center"><span className="text-xs font-mono font-bold text-rose-600">{formatMinutesToHHMM(rec.unapprovedOutDuration || 0)}</span></TableCell>
                        </>
                      )}

                      <TableCell className="text-center">
                        <Badge variant="outline" className={cn("font-black text-xs px-3", getWorkingHoursColor(rec.hours))}>
                          {rec.leaveType ? `${rec.days}d` : formatHoursToHHMM(rec.hours)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center"><Badge variant="outline" className="font-black text-[9px] uppercase">{rec.attendanceType || "LEAVE"}</Badge></TableCell>
                      <TableCell className="text-center">
                        <Badge className={cn("text-[9px] font-black uppercase px-3", rec.status === 'PRESENT' || rec.status === 'APPROVED' ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700")}>
                          {rec.autoCheckout ? "AUTO_OUT" : rec.status}
                        </Badge>
                      </TableCell>
                      
                      {!(viewMode === 'history' && currentTab === 'leave') && (
                        <TableCell className="text-right pr-6">
                          <div className="flex justify-end gap-1">
                            {viewMode === 'pending' ? (
                              <>
                                {currentTab === 'attendance' && (
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenAttendanceEdit(rec)}><Pencil className="w-3.5 h-3.5" /></Button>
                                )}
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-rose-600 hover:bg-rose-50" 
                                  onClick={() => {
                                    if (currentTab === 'attendance') { setSelectedAttendance(rec); setIsAttendanceRejectOpen(true); }
                                    else { setSelectedLeave(rec); setIsLeaveRejectOpen(true); }
                                  }}
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  className="h-8 font-black text-[10px] uppercase px-4 bg-emerald-600" 
                                  onClick={() => currentTab === 'attendance' ? handleApproveAttendance(rec) : handleApproveLeave(rec)} 
                                  disabled={isProcessing || (currentTab === 'attendance' && !rec.outTime && rec.status !== 'ABSENT')}
                                >
                                  Approve
                                </Button>
                              </>
                            ) : (
                              currentTab === 'attendance' && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-primary" onClick={() => { setAttendanceToRestore(rec); setIsRestoreConfirmOpen(true); }}>
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </Button>
                              )
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </CardContent>
        </Card>
      </Tabs>

      {/* Attendance Edit Dialog */}
      <Dialog open={isAttendanceEditOpen} onOpenChange={setIsAttendanceEditOpen}>
        <DialogContent className="p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="p-6 bg-slate-900 text-white">
            <DialogTitle>Edit Attendance Log</DialogTitle>
          </DialogHeader>
          <div className="p-8 space-y-6">
            <div className="space-y-2"><Label>Date</Label><Input type="date" value={attendanceEditData.date} onChange={(e) => setAttendanceEditData(p => ({...p, date: e.target.value}))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>IN</Label><Input type="time" value={attendanceEditData.inTime} onChange={(e) => setAttendanceEditData(p => ({...p, inTime: e.target.value}))} /></div>
              <div><Label>OUT</Label><Input type="time" value={attendanceEditData.outTime} onChange={(e) => setAttendanceEditData(p => ({...p, outTime: e.target.value}))} /></div>
            </div>
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t gap-3">
            <Button variant="ghost" onClick={() => setIsAttendanceEditOpen(false)}>Cancel</Button>
            <Button onClick={handlePostAttendanceEdit} disabled={isProcessing}>Save Adjustments</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attendance Reject Reason Dialog */}
      <Dialog open={isAttendanceRejectOpen} onOpenChange={setIsAttendanceRejectOpen}>
        <DialogContent className="p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="p-6 bg-rose-600 text-white">
            <DialogTitle>Reject Attendance Log</DialogTitle>
            <DialogDescription className="text-rose-100">Reason is mandatory before rejection.</DialogDescription>
          </DialogHeader>
          <div className="p-8 space-y-4">
            <Label className="font-bold">Rejection Reason *</Label>
            <Textarea 
              placeholder="e.g. IN location mismatched, Shift not completed..." 
              value={attendanceRejectReason} 
              onChange={(e) => setAttendanceRejectReason(e.target.value)} 
              className="min-h-[120px]"
            />
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t gap-3">
            <Button variant="ghost" onClick={() => setIsAttendanceRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handlePostAttendanceReject} disabled={!attendanceRejectReason.trim() || isProcessing}>Confirm Rejection</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave Reject Reason Dialog */}
      <Dialog open={isLeaveRejectOpen} onOpenChange={setIsLeaveRejectOpen}>
        <DialogContent className="p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="p-6 bg-rose-600 text-white">
            <DialogTitle>Reject Leave Request</DialogTitle>
            <DialogDescription className="text-rose-100">Please provide a reason for the employee.</DialogDescription>
          </DialogHeader>
          <div className="p-8 space-y-4">
            <Label className="font-bold">Rejection Reason *</Label>
            <Textarea 
              placeholder="e.g. Shortage of staff on requested dates..." 
              value={leaveRejectReason} 
              onChange={(e) => setLeaveRejectReason(e.target.value)} 
              className="min-h-[120px]"
            />
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t gap-3">
            <Button variant="ghost" onClick={() => setIsLeaveRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handlePostLeaveReject} disabled={!leaveRejectReason.trim() || isProcessing}>Reject Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Confirmation */}
      <AlertDialog open={isRestoreConfirmOpen} onOpenChange={setIsRestoreConfirmOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <RotateCcw className="w-6 h-6 text-primary" />
            </div>
            <AlertDialogTitle className="text-center text-xl font-black">Restore Attendance?</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              This record will be moved back to the **Pending** section for re-approval. Any existing remarks will be cleared.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center gap-3 pt-4">
            <AlertDialogCancel className="font-bold rounded-xl h-11 px-8">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreAttendance} className="bg-primary hover:bg-primary/90 font-black rounded-xl h-11 px-8">Confirm Restore</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
