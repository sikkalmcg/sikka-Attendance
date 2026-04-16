
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
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
  History,
  AlertTriangle,
  ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useData } from "@/context/data-context";
import { AttendanceRecord, LeaveRequest } from "@/lib/types";
import { differenceInDays, parseISO, format } from "date-fns";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

export default function ApprovalsPage() {
  const { attendanceRecords, leaveRequests, employees, updateRecord, addRecord } = useData();
  const [isMounted, setIsMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("pending");
  const [pendingType, setPendingType] = useState("attendance");
  const [historyType, setHistoryType] = useState("attendance");

  // Dialog States - Leave
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);
  const [isLeaveApproveOpen, setIsLeaveApproveOpen] = useState(false);
  const [isLeaveRejectOpen, setIsLeaveRejectOpen] = useState(false);
  const [leaveEditDates, setLeaveEditDates] = useState({ from: "", to: "" });
  const [leaveRejectReason, setLeaveRejectReason] = useState("");

  // Dialog States - Attendance
  const [selectedAttendance, setSelectedAttendance] = useState<AttendanceRecord | null>(null);
  const [isAttendanceEditOpen, setIsAttendanceEditOpen] = useState(false);
  const [isAttendanceRejectOpen, setIsAttendanceRejectOpen] = useState(false);
  const [attendanceEditData, setAttendanceEditData] = useState({ date: "", inTime: "", outTime: "" });
  const [attendanceRejectReason, setAttendanceRejectReason] = useState("");

  // Restore State
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);
  const [attendanceToRestore, setAttendanceToRestore] = useState<AttendanceRecord | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Filtered Data Sets
  const pendingAttendance = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return (attendanceRecords || [])
      .filter(rec => !rec.approved && !rec.remark)
      .map(rec => {
        const emp = (employees || []).find(e => e.employeeId === rec.employeeId);
        return {
          ...rec,
          dept: emp?.department || "N/A",
          desig: emp?.designation || "N/A"
        };
      })
      .filter(rec => (rec.employeeName || "").toLowerCase().includes(search) || (rec.employeeId || "").toLowerCase().includes(search))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [attendanceRecords, employees, searchTerm]);

  const pendingLeaves = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return (leaveRequests || [])
      .filter(l => l.status === 'UNDER_PROCESS')
      .filter(l => (l.employeeName || "").toLowerCase().includes(search) || (l.employeeId || "").toLowerCase().includes(search))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [leaveRequests, searchTerm]);

  const historyAttendance = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return (attendanceRecords || [])
      .filter(rec => rec.approved)
      .map(rec => {
        const emp = (employees || []).find(e => e.employeeId === rec.employeeId);
        return {
          ...rec,
          dept: emp?.department || "N/A",
          desig: emp?.designation || "N/A"
        };
      })
      .filter(rec => (rec.employeeName || "").toLowerCase().includes(search) || (rec.employeeId || "").toLowerCase().includes(search))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [attendanceRecords, employees, searchTerm]);

  const historyLeaves = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return (leaveRequests || [])
      .filter(l => l.status !== 'UNDER_PROCESS')
      .filter(l => (l.employeeName || "").toLowerCase().includes(search) || (l.employeeId || "").toLowerCase().includes(search))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [leaveRequests, searchTerm]);

  // Attendance Actions
  const handleApproveAttendance = (id: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      updateRecord('attendance', id, { approved: true, remark: "" });
      toast({ title: "Attendance Approved" });
    } finally { setIsProcessing(false); }
  };

  const handleOpenAttendanceEdit = (rec: AttendanceRecord) => {
    setSelectedAttendance(rec);
    setAttendanceEditData({
      date: rec.date,
      inTime: rec.inTime || "",
      outTime: rec.outTime || ""
    });
    setIsAttendanceEditOpen(true);
  };

  const handlePostAttendanceEdit = () => {
    if (!selectedAttendance || isProcessing) return;
    setIsProcessing(true);
    try {
      // Calculate Hours
      let finalHours = 0;
      if (attendanceEditData.inTime && attendanceEditData.outTime) {
        const inDT = new Date(`${attendanceEditData.date}T${attendanceEditData.inTime}`);
        const outDT = new Date(`${attendanceEditData.date}T${attendanceEditData.outTime}`);
        const diff = (outDT.getTime() - inDT.getTime()) / (1000 * 60 * 60);
        finalHours = parseFloat(diff.toFixed(2));
      }

      updateRecord('attendance', selectedAttendance.id, {
        date: attendanceEditData.date,
        inTime: attendanceEditData.inTime,
        outTime: attendanceEditData.outTime,
        hours: finalHours
      });
      toast({ title: "Record Updated", description: "Attendance timings adjusted successfully." });
      setIsAttendanceEditOpen(false);
    } finally { setIsProcessing(false); }
  };

  const handleOpenAttendanceReject = (rec: any) => {
    setSelectedAttendance(rec);
    setAttendanceRejectReason("");
    setIsAttendanceRejectOpen(true);
  };

  const handlePostAttendanceReject = () => {
    if (!selectedAttendance || !attendanceRejectReason.trim() || isProcessing) {
      toast({ variant: "destructive", title: "Reason Required" });
      return;
    }
    setIsProcessing(true);
    try {
      updateRecord('attendance', selectedAttendance.id, {
        approved: false,
        remark: attendanceRejectReason,
        status: 'ABSENT' 
      });
      toast({ variant: "destructive", title: "Log Rejected", description: "Reason recorded in audit history." });
      setIsAttendanceRejectOpen(false);
    } finally { setIsProcessing(false); }
  };

  // Restore Action
  const handleOpenRestoreConfirm = (rec: AttendanceRecord) => {
    setAttendanceToRestore(rec);
    setIsRestoreConfirmOpen(true);
  };

  const handleConfirmRestore = () => {
    if (!attendanceToRestore || isProcessing) return;
    setIsProcessing(true);
    try {
      updateRecord('attendance', attendanceToRestore.id, { 
        approved: false, 
        remark: "" 
      });
      toast({ title: "Record Restored", description: "Record moved back to pending list." });
      setIsRestoreConfirmOpen(false);
    } finally { setIsProcessing(false); }
  };

  // Leave Actions
  const handleOpenLeaveApprove = (l: LeaveRequest) => {
    setSelectedLeave(l);
    setLeaveEditDates({ from: l.fromDate, to: l.toDate });
    setIsLeaveApproveOpen(true);
  };

  const handlePostLeaveApprove = () => {
    if (!selectedLeave || isProcessing) return;
    setIsProcessing(true);
    try {
      const days = differenceInDays(parseISO(leaveEditDates.to), parseISO(leaveEditDates.from)) + 1;
      updateRecord('leaveRequests', selectedLeave.id, {
        status: 'APPROVED',
        fromDate: leaveEditDates.from,
        toDate: leaveEditDates.to,
        days: days
      });
      addRecord('notifications', {
        message: `Leave Approved: ${selectedLeave.employeeName} (${days} days)`,
        timestamp: format(new Date(), "yyyy-MM-dd HH:mm:ss"),
        read: false
      });
      toast({ title: "Leave Approved" });
      setIsLeaveApproveOpen(false);
    } finally { setIsProcessing(false); }
  };

  const handleOpenLeaveReject = (l: LeaveRequest) => {
    setSelectedLeave(l);
    setLeaveRejectReason("");
    setIsLeaveRejectOpen(true);
  };

  const handlePostLeaveReject = () => {
    if (!selectedLeave || !leaveRejectReason.trim() || isProcessing) {
      toast({ variant: "destructive", title: "Reason Required" });
      return;
    }
    setIsProcessing(true);
    try {
      updateRecord('leaveRequests', selectedLeave.id, {
        status: 'REJECTED',
        rejectReason: leaveRejectReason
      });
      addRecord('notifications', {
        message: `Leave Rejected: ${selectedLeave.employeeName}`,
        timestamp: format(new Date(), "yyyy-MM-dd HH:mm:ss"),
        read: false
      });
      toast({ variant: "destructive", title: "Request Declined" });
      setIsLeaveRejectOpen(false);
    } finally { setIsProcessing(false); }
  };

  if (!isMounted) return null;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Organizational Approvals</h1>
          <p className="text-muted-foreground text-sm">Verify live attendance logs and manage employee leave cycles.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by ID or Name..." 
            className="pl-10 h-10 bg-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Tabs value={viewMode} onValueChange={setViewMode} className="w-full md:w-auto">
          <TabsList className="grid w-full grid-cols-2 bg-slate-100 h-10 p-1 rounded-xl w-[240px]">
            <TabsTrigger value="pending" className="text-xs font-black data-[state=active]:bg-white data-[state=active]:shadow-sm">Pending</TabsTrigger>
            <TabsTrigger value="history" className="text-xs font-black data-[state=active]:bg-white data-[state=active]:shadow-sm">History</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {viewMode === 'pending' ? (
        <div className="space-y-6">
          <Tabs value={pendingType} onValueChange={setPendingType} className="w-full">
            <div className="flex items-center gap-4 mb-4">
              <TabsList className="bg-slate-50 border p-1 h-9 rounded-lg">
                <TabsTrigger value="attendance" className="text-[10px] font-black uppercase tracking-widest px-6 h-7">
                  Attendance ({pendingAttendance.length})
                </TabsTrigger>
                <TabsTrigger value="leave" className="text-[10px] font-black uppercase tracking-widest px-6 h-7">
                  Leave Requests ({pendingLeaves.length})
                </TabsTrigger>
              </TabsList>
              <div className="h-px flex-1 bg-slate-100" />
            </div>

            <TabsContent value="attendance">
              <Card className="border-slate-200 shadow-sm overflow-hidden">
                <CardContent className="p-0">
                  <ScrollArea className="w-full">
                    <Table className="min-w-[1400px]">
                      <TableHeader className="bg-slate-50/50">
                        <TableRow>
                          <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500 py-4 px-6">Employee/ID</TableHead>
                          <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">Dept / Desig</TableHead>
                          <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">IN Date Time</TableHead>
                          <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">OUT Date Time</TableHead>
                          <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500 text-center">Working Hour</TableHead>
                          <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500 text-center">Type</TableHead>
                          <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">GPS Audit</TableHead>
                          <TableHead className="text-right font-bold text-[11px] uppercase tracking-widest text-slate-500 pr-6">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingAttendance.length === 0 ? (
                          <TableRow><TableCell colSpan={8} className="text-center py-20 text-muted-foreground font-medium">No pending attendance logs found.</TableCell></TableRow>
                        ) : (
                          pendingAttendance.map((rec: any) => (
                            <TableRow key={rec.id} className="hover:bg-slate-50/50 transition-colors">
                              <TableCell className="px-6 py-4">
                                <div className="flex flex-col">
                                  <span className="font-bold uppercase text-slate-700 text-sm leading-tight">{rec.employeeName}</span>
                                  <span className="text-[10px] font-mono font-black text-primary uppercase">{rec.employeeId}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="text-xs font-bold text-slate-600 leading-tight">{rec.dept}</span>
                                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">{rec.desig}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{rec.date}</span>
                                  <span className="text-xs font-mono font-bold text-slate-900">{rec.inTime || "--:--"}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{rec.date}</span>
                                  <span className={cn("text-xs font-mono font-bold", rec.outTime ? "text-rose-500" : "text-slate-300 italic")}>{rec.outTime || "--:--"}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="secondary" className="font-black text-xs px-3 bg-slate-100 text-slate-700">{rec.hours}h</Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline" className="font-black text-[9px] uppercase tracking-widest border-slate-200">{rec.attendanceType}</Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-1.5">
                                    <MapPin className="w-3 h-3 text-emerald-500 shrink-0" />
                                    <span className="text-[10px] font-bold text-slate-600 truncate max-w-[180px]" title={rec.address || "N/A"}>
                                      {rec.address || "No IN Location"}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                                    <span className="text-[10px] font-bold text-slate-600 truncate max-w-[180px]" title={rec.addressOut || "N/A"}>
                                      {rec.addressOut || (rec.outTime ? "Location pending" : "Shift In-Progress")}
                                    </span>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-right pr-6">
                                <div className="flex justify-end items-center gap-1">
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-slate-400 hover:text-primary" 
                                    onClick={() => handleOpenAttendanceEdit(rec)}
                                    disabled={isProcessing}
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    className={cn(
                                      "h-8 font-black text-[10px] uppercase px-4 shadow-sm",
                                      rec.outTime 
                                        ? "bg-emerald-600 hover:bg-emerald-700 text-white" 
                                        : "bg-slate-200 text-slate-400 cursor-not-allowed hover:bg-slate-200"
                                    )}
                                    onClick={() => rec.outTime && handleApproveAttendance(rec.id)} 
                                    disabled={isProcessing || !rec.outTime}
                                  >
                                    {rec.outTime ? "Approve" : "Locked"}
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="ghost"
                                    className="text-rose-600 hover:bg-rose-50 h-8 font-black text-[10px] uppercase px-4" 
                                    onClick={() => handleOpenAttendanceReject(rec)} 
                                    disabled={isProcessing}
                                  >
                                    Reject
                                  </Button>
                                </div>
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

            <TabsContent value="leave">
              <Card className="border-slate-200 shadow-sm overflow-hidden">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-slate-50/50">
                      <TableRow>
                        <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500 py-4 px-6">Employee Name / ID</TableHead>
                        <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">Dept / Designation</TableHead>
                        <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">From Date</TableHead>
                        <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">To Date</TableHead>
                        <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500 text-center">Days</TableHead>
                        <TableHead className="text-right font-bold text-[11px] uppercase tracking-widest text-slate-500 pr-6">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingLeaves.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-20 text-muted-foreground font-medium">No pending leave applications.</TableCell></TableRow>
                      ) : (
                        pendingLeaves.map((l) => (
                          <TableRow key={l.id} className="hover:bg-slate-50/50 transition-colors">
                            <TableCell className="px-6">
                              <div className="flex flex-col">
                                <span className="font-bold uppercase text-slate-700">{l.employeeName}</span>
                                <span className="text-[10px] font-mono text-slate-400 font-bold">{l.employeeId}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                               <div className="flex flex-col">
                                <span className="text-xs font-bold text-slate-600">{l.department}</span>
                                <span className="text-[10px] text-muted-foreground uppercase font-medium">{l.designation}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm font-bold text-primary">{l.fromDate}</TableCell>
                            <TableCell className="text-sm font-bold text-rose-500">{l.toDate}</TableCell>
                            <TableCell className="text-center font-black text-slate-700">{l.days}</TableCell>
                            <TableCell className="text-right pr-6">
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="outline" className="h-8 font-black text-[10px] uppercase border-rose-200 text-rose-600 hover:bg-rose-50" onClick={() => handleOpenLeaveReject(l)} disabled={isProcessing}>Reject</Button>
                                <Button size="sm" className="h-8 font-black text-[10px] uppercase bg-primary shadow-sm" onClick={() => handleOpenLeaveApprove(l)} disabled={isProcessing}>Approve</Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      ) : (
        <div className="space-y-6">
          <Tabs value={historyType} onValueChange={setHistoryType} className="w-full">
            <div className="flex items-center gap-4 mb-4">
              <TabsList className="bg-slate-50 border p-1 h-9 rounded-lg">
                <TabsTrigger value="attendance" className="text-[10px] font-black uppercase tracking-widest px-6 h-7">Attendance History</TabsTrigger>
                <TabsTrigger value="leave" className="text-[10px] font-black uppercase tracking-widest px-6 h-7">Leave History</TabsTrigger>
              </TabsList>
              <div className="h-px flex-1 bg-slate-100" />
            </div>

            <TabsContent value="attendance">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-100 shadow-sm">
                    <UserCheck className="w-5 h-5 text-emerald-600" />
                  </div>
                  <h3 className="font-black text-sm uppercase tracking-[0.2em] text-slate-500">Approved Attendance Records</h3>
                </div>
                <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
                  <CardContent className="p-0">
                    <ScrollArea className="w-full">
                      <Table className="min-w-[1400px]">
                        <TableHeader className="bg-slate-50/50 border-b">
                          <TableRow>
                            <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500 py-4 px-6">Employee/ID</TableHead>
                            <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">Dept / Desig</TableHead>
                            <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">IN Date Time</TableHead>
                            <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">OUT Date Time</TableHead>
                            <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500 text-center">Working Hour</TableHead>
                            <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500 text-center">Type</TableHead>
                            <TableHead className="font-bold text-[11px] uppercase tracking-widest text-center">Status</TableHead>
                            <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">Approved by</TableHead>
                            <TableHead className="text-right font-bold text-[11px] uppercase tracking-widest text-slate-500 pr-6">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {historyAttendance.length === 0 ? (
                            <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">No approved records found.</TableCell></TableRow>
                          ) : (
                            historyAttendance.map((rec: any) => (
                              <TableRow key={rec.id} className="hover:bg-slate-50/30">
                                <TableCell className="px-6 py-4">
                                  <div className="flex flex-col">
                                    <span className="font-bold uppercase text-slate-700 text-sm leading-tight">{rec.employeeName}</span>
                                    <span className="text-[10px] font-mono font-black text-primary uppercase">{rec.employeeId}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-col">
                                    <span className="text-xs font-bold text-slate-600 leading-tight">{rec.dept}</span>
                                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">{rec.desig}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{rec.date}</span>
                                    <span className="text-xs font-mono font-bold text-slate-900">{rec.inTime || "--:--"}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{rec.date}</span>
                                    <span className="text-xs font-mono font-bold text-rose-500">{rec.outTime || "--:--"}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="secondary" className="font-black text-xs px-3 bg-slate-100 text-slate-700">{rec.hours}h</Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="outline" className="font-black text-[9px] uppercase tracking-widest border-slate-200">{rec.attendanceType}</Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge className="bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase tracking-widest border-none px-3">Approved</Badge>
                                </TableCell>
                                <TableCell>
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">HR_ADMIN</span>
                                </TableCell>
                                <TableCell className="text-right pr-6">
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-8 font-black text-[10px] uppercase border-primary text-primary hover:bg-primary/5 gap-1.5"
                                    onClick={() => handleOpenRestoreConfirm(rec)}
                                    disabled={isProcessing}
                                  >
                                    <RotateCcw className="w-3 h-3" /> Restore
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
              </div>
            </TabsContent>

            <TabsContent value="leave">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100 shadow-sm">
                    <CalendarDays className="w-5 h-5 text-blue-600" />
                  </div>
                  <h3 className="font-black text-sm uppercase tracking-[0.2em] text-slate-500">Processed Leave Applications</h3>
                </div>
                <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
                  <CardContent className="p-0">
                    <ScrollArea className="w-full">
                      <Table>
                        <TableHeader className="bg-slate-50/50 border-b">
                          <TableRow>
                            <TableHead className="font-bold text-[10px] uppercase tracking-widest text-slate-400 py-4 px-6">Employee</TableHead>
                            <TableHead className="font-bold text-[10px] uppercase tracking-widest text-slate-400">Range</TableHead>
                            <TableHead className="font-bold text-[10px] uppercase tracking-widest text-center">Days</TableHead>
                            <TableHead className="font-bold text-[10px] uppercase tracking-widest">Purpose</TableHead>
                            <TableHead className="text-right font-bold text-[10px] uppercase tracking-widest text-slate-400 pr-6">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {historyLeaves.length === 0 ? (
                            <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">No historical applications found.</TableCell></TableRow>
                          ) : (
                            historyLeaves.map((l) => (
                              <TableRow key={l.id} className="hover:bg-slate-50/30">
                                <TableCell className="px-6 py-4">
                                  <div className="flex flex-col">
                                    <span className="font-bold uppercase text-slate-700 text-sm">{l.employeeName}</span>
                                    <span className="text-[10px] font-mono text-slate-400 font-bold">{l.employeeId}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-col">
                                    <span className="text-xs font-bold text-slate-600">{l.fromDate}</span>
                                    <span className="text-xs font-bold text-slate-400">{l.toDate}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center font-black text-slate-700">{l.days}</TableCell>
                                <TableCell className="max-w-xs truncate text-[11px] font-medium text-slate-500 italic">
                                  "{l.purpose}"
                                </TableCell>
                                <TableCell className="text-right pr-6">
                                  <div className="flex flex-col items-end gap-1">
                                    <Badge className={cn("text-[9px] font-black uppercase tracking-widest px-3 py-0.5 border-none", l.status === 'APPROVED' ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")}>
                                      {l.status}
                                    </Badge>
                                    {l.status === 'REJECTED' && l.rejectReason && (
                                      <span className="text-[8px] font-bold text-rose-400 max-w-[1200px] truncate">R: {l.rejectReason}</span>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={isRestoreConfirmOpen} onOpenChange={setIsRestoreConfirmOpen}>
        <AlertDialogContent className="rounded-2xl border-none shadow-2xl">
          <AlertDialogHeader>
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
              <RotateCcw className="w-8 h-8 text-primary" />
            </div>
            <AlertDialogTitle className="text-center text-2xl font-black">Confirm Record Restoration</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-slate-500 font-medium pt-2">
              This action will move the attendance log for <strong>{attendanceToRestore?.employeeName} ({attendanceToRestore?.employeeId})</strong> on <strong>{attendanceToRestore?.date}</strong> back to the pending list for re-approval.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center gap-3 pt-8 pb-4">
            <AlertDialogCancel className="rounded-xl font-bold h-12 px-8">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => { e.preventDefault(); handleConfirmRestore(); }} 
              disabled={isProcessing}
              className="bg-primary hover:bg-primary/90 rounded-xl font-black h-12 px-8 shadow-lg shadow-primary/20"
            >
              {isProcessing ? "Restoring..." : "Restore Record"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Attendance Edit Dialog */}
      <Dialog open={isAttendanceEditOpen} onOpenChange={setIsAttendanceEditOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <DialogTitle className="text-xl font-black flex items-center gap-2">
              <Pencil className="w-5 h-5 text-primary" /> Edit Attendance Log
            </DialogTitle>
            <div className="mt-4">
              <p className="text-xs font-bold text-primary uppercase tracking-widest">{selectedAttendance?.employeeName} ({selectedAttendance?.employeeId})</p>
            </div>
          </DialogHeader>
          <div className="p-8 space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Attendance Date</Label>
              <Input 
                type="date" 
                value={attendanceEditData.date} 
                onChange={(e) => setAttendanceEditData(p => ({...p, date: e.target.value}))} 
                className="h-12 bg-slate-50 font-bold" 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">IN Time</Label>
                <Input 
                  type="time" 
                  value={attendanceEditData.inTime} 
                  onChange={(e) => setAttendanceEditData(p => ({...p, inTime: e.target.value}))} 
                  className="h-12 bg-slate-50 font-bold" 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">OUT Time</Label>
                <Input 
                  type="time" 
                  value={attendanceEditData.outTime} 
                  onChange={(e) => setAttendanceEditData(p => ({...p, outTime: e.target.value}))} 
                  className="h-12 bg-slate-50 font-bold" 
                />
              </div>
            </div>
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t flex gap-3">
            <Button variant="ghost" className="flex-1 h-12 rounded-xl font-bold" onClick={() => setIsAttendanceEditOpen(false)}>Cancel</Button>
            <Button className="flex-1 h-12 rounded-xl font-black bg-primary shadow-lg shadow-primary/20" onClick={handlePostAttendanceEdit} disabled={isProcessing}>Save Adjustments</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attendance Reject Dialog */}
      <Dialog open={isAttendanceRejectOpen} onOpenChange={setIsAttendanceRejectOpen}>
        <DialogContent className="sm:max-w-2xl rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="p-6 bg-rose-600 text-white shrink-0">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <DialogTitle className="text-xl font-black flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-100" /> Reject Attendance Log
                </DialogTitle>
                <p className="text-xs font-bold text-rose-100 uppercase tracking-widest">{selectedAttendance?.employeeName} ({selectedAttendance?.employeeId})</p>
              </div>
            </div>
          </DialogHeader>
          
          <div className="p-0 border-b bg-slate-50 flex divide-x">
             <div className="flex-1 p-4 text-center">
               <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Dept / Desig</p>
               <p className="text-[11px] font-bold text-slate-700">{(selectedAttendance as any)?.dept} / {(selectedAttendance as any)?.desig}</p>
             </div>
             <div className="flex-1 p-4 text-center">
               <p className="text-[9px] font-black text-slate-400 uppercase mb-1">IN Date Time</p>
               <p className="text-[11px] font-bold text-slate-700">{selectedAttendance?.date} {selectedAttendance?.inTime}</p>
             </div>
             <div className="flex-1 p-4 text-center">
               <p className="text-[9px] font-black text-slate-400 uppercase mb-1">OUT Date Time</p>
               <p className="text-[11px] font-bold text-rose-600">{selectedAttendance?.date} {selectedAttendance?.outTime}</p>
             </div>
             <div className="flex-1 p-4 text-center">
               <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Working / Type</p>
               <p className="text-[11px] font-bold text-slate-700">{selectedAttendance?.hours}h / {selectedAttendance?.attendanceType}</p>
             </div>
          </div>

          <div className="p-8 space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Rejection Reason *</Label>
              <Textarea 
                placeholder="Specify why this log is being declined (e.g. Invalid geofence entry, time mismatch)..." 
                value={attendanceRejectReason} 
                onChange={(e) => setAttendanceRejectReason(e.target.value)}
                className="min-h-[120px] bg-slate-50 font-medium focus-visible:ring-rose-500 border-slate-200"
              />
            </div>
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t flex gap-3">
            <Button variant="ghost" className="flex-1 h-12 rounded-xl font-bold" onClick={() => setIsAttendanceRejectOpen(false)}>Cancel</Button>
            <Button className="flex-1 h-12 rounded-xl font-black bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-900/10" onClick={handlePostAttendanceReject} disabled={isProcessing}>Reject Log</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave Approval Dialog */}
      <Dialog open={isLeaveApproveOpen} onOpenChange={setIsLeaveApproveOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <DialogTitle className="text-xl font-black">Approve Leave Application</DialogTitle>
            <div className="mt-4">
              <p className="text-xs font-bold text-primary uppercase tracking-widest">{selectedLeave?.employeeName} ({selectedLeave?.employeeId})</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">{selectedLeave?.department} / {selectedLeave?.designation}</p>
            </div>
          </DialogHeader>
          <div className="p-8 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-500">From Date</Label>
                <Input type="date" value={leaveEditDates.from} onChange={(e) => setLeaveEditDates(p => ({...p, from: e.target.value}))} className="h-12 bg-slate-50 font-bold" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-500">To Date</Label>
                <Input type="date" value={leaveEditDates.to} onChange={(e) => setLeaveEditDates(p => ({...p, to: e.target.value}))} className="h-12 bg-slate-50 font-bold" />
              </div>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
               <Label className="text-[10px] font-black uppercase text-slate-400 block mb-2">Employee Purpose:</Label>
               <p className="text-sm font-medium italic text-slate-600">"{selectedLeave?.purpose}"</p>
            </div>
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t flex gap-3">
            <Button variant="ghost" className="flex-1 h-12 rounded-xl font-bold" onClick={() => setIsLeaveApproveOpen(false)}>Cancel</Button>
            <Button className="flex-1 h-12 rounded-xl font-black bg-primary shadow-lg shadow-primary/20" onClick={handlePostLeaveApprove} disabled={isProcessing}>Approve Leave</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave Reject Dialog */}
      <Dialog open={isLeaveRejectOpen} onOpenChange={setIsLeaveRejectOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="p-6 bg-rose-600 text-white shrink-0">
            <DialogTitle className="text-xl font-black">Reject Leave Application</DialogTitle>
            <p className="text-xs font-bold text-rose-100 uppercase mt-2">{selectedLeave?.employeeName} ({selectedLeave?.employeeId})</p>
          </DialogHeader>
          <div className="p-8 space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-500">Rejection Reason *</Label>
              <Textarea 
                placeholder="Enter reason for declining request..." 
                value={leaveRejectReason} 
                onChange={(e) => setLeaveRejectReason(e.target.value)}
                className="min-h-[120px] bg-slate-50 font-bold"
              />
            </div>
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t flex gap-3">
            <Button variant="ghost" className="flex-1 h-12 rounded-xl font-bold" onClick={() => setIsLeaveRejectOpen(false)}>Cancel</Button>
            <Button className="flex-1 h-12 rounded-xl font-black bg-primary" onClick={handlePostLeaveReject} disabled={isProcessing}>Post Rejection</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
