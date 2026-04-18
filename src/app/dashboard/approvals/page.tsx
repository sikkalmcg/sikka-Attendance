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
import { cn, formatDate, getWorkingHoursColor, formatMinutesToHHMM } from "@/lib/utils";
import { useData } from "@/context/data-context";
import { AttendanceRecord, LeaveRequest } from "@/lib/types";
import { differenceInDays, parseISO, format, isWithinInterval, startOfDay, endOfDay, subDays } from "date-fns";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

const ITEMS_PER_PAGE = 15;

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
    const thirtyDaysAgo = subDays(today, 30);
    setFromDate(format(thirtyDaysAgo, "yyyy-MM-dd"));
    setToDate(format(today, "yyyy-MM-dd"));
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [viewMode, pendingType, historyType, fromDate, toDate]);

  const pendingAttendanceList = useMemo(() => {
    if (!isMounted) return [];
    const search = searchTerm.toLowerCase();
    const todayStr = format(new Date(), "yyyy-MM-dd");

    const actualPending = (attendanceRecords || [])
      .filter(rec => !rec.approved && !rec.remark)
      .map(rec => {
        const emp = (employees || []).find(e => e.employeeId === rec.employeeId);
        return {
          ...rec,
          dept: emp?.department || "N/A",
          desig: emp?.designation || "N/A"
        };
      });

    const missingRecords: any[] = [];
    (employees || []).filter(e => e.active).forEach(emp => {
      const hasRecord = (attendanceRecords || []).some(r => r.employeeId === emp.employeeId && r.date === todayStr);
      if (!hasRecord) {
        missingRecords.push({
          id: `virtual-absent-${emp.employeeId}-${todayStr}`,
          employeeId: emp.employeeId,
          employeeName: emp.name,
          date: todayStr,
          inTime: null,
          outTime: null,
          hours: 0,
          status: 'ABSENT',
          attendanceType: 'ABSENT',
          address: 'N/A',
          approved: false,
          dept: emp.department,
          desig: emp.designation,
          isVirtual: true,
          unapprovedOutDuration: 0
        });
      }
    });

    return [...actualPending, ...missingRecords]
      .filter(rec => (rec.employeeName || "").toLowerCase().includes(search) || (rec.employeeId || "").toLowerCase().includes(search))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [attendanceRecords, employees, searchTerm, isMounted]);

  const pendingLeavesList = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return (leaveRequests || [])
      .filter(l => l.status === 'UNDER_PROCESS')
      .filter(l => (l.employeeName || "").toLowerCase().includes(search) || (l.employeeId || "").toLowerCase().includes(search))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [leaveRequests, searchTerm]);

  const historyAttendanceList = useMemo(() => {
    const search = searchTerm.toLowerCase();
    let list = (attendanceRecords || [])
      .filter(rec => rec.approved)
      .map(rec => {
        const emp = (employees || []).find(e => e.employeeId === rec.employeeId);
        return {
          ...rec,
          dept: emp?.department || "N/A",
          desig: emp?.designation || "N/A"
        };
      })
      .filter(rec => (rec.employeeName || "").toLowerCase().includes(search) || (rec.employeeId || "").toLowerCase().includes(search));

    if (fromDate) list = list.filter(r => r.date >= fromDate);
    if (toDate) list = list.filter(r => r.date <= toDate);

    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [attendanceRecords, employees, searchTerm, fromDate, toDate]);

  const historyLeavesList = useMemo(() => {
    const search = searchTerm.toLowerCase();
    let list = (leaveRequests || [])
      .filter(l => l.status !== 'UNDER_PROCESS')
      .filter(l => (l.employeeName || "").toLowerCase().includes(search) || (l.employeeId || "").toLowerCase().includes(search));

    if (fromDate) list = list.filter(l => l.fromDate >= fromDate);
    if (toDate) list = list.filter(l => l.toDate <= toDate);

    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [leaveRequests, searchTerm, fromDate, toDate]);

  const currentData = useMemo(() => {
    const list = viewMode === 'pending' 
      ? (pendingType === 'attendance' ? pendingAttendanceList : pendingLeavesList)
      : (historyType === 'attendance' ? historyAttendanceList : historyLeavesList);
    
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return {
      items: list.slice(start, start + ITEMS_PER_PAGE),
      total: list.length,
      totalPages: Math.ceil(list.length / ITEMS_PER_PAGE)
    };
  }, [viewMode, pendingType, historyType, pendingAttendanceList, pendingLeavesList, historyAttendanceList, historyLeavesList, currentPage]);

  const handleApproveAttendance = (rec: any) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const approverName = currentUser?.fullName || "HR_ADMIN";
      if (rec.isVirtual) {
        const newRec: Partial<AttendanceRecord> = {
          employeeId: rec.employeeId,
          employeeName: rec.employeeName,
          date: rec.date,
          status: 'ABSENT',
          attendanceType: 'FIELD',
          approved: true,
          approvedBy: approverName,
          hours: 0,
          inTime: null,
          outTime: null,
          address: 'System Generated Absence',
          unapprovedOutDuration: 0
        };
        addRecord('attendance', newRec);
      } else {
        updateRecord('attendance', rec.id, { approved: true, remark: "", approvedBy: approverName });
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
    setIsProcessing(true);
    try {
      let finalHours = 0;
      if (attendanceEditData.inTime && attendanceEditData.outTime) {
        const inDT = new Date(`${attendanceEditData.date}T${attendanceEditData.inTime}`);
        const outDT = new Date(`${attendanceEditData.date}T${attendanceEditData.outTime}`);
        const diff = (outDT.getTime() - inDT.getTime()) / (1000 * 60 * 60);
        finalHours = parseFloat(diff.toFixed(2));
      }
      if ((selectedAttendance as any).isVirtual) {
        addRecord('attendance', {
          employeeId: selectedAttendance.employeeId,
          employeeName: selectedAttendance.employeeName,
          date: attendanceEditData.date,
          status: 'PRESENT',
          attendanceType: 'FIELD',
          inTime: attendanceEditData.inTime,
          outTime: attendanceEditData.outTime,
          hours: finalHours,
          approved: false,
          address: 'Manual Admin Entry',
          unapprovedOutDuration: 0
        });
      } else {
        updateRecord('attendance', selectedAttendance.id, {
          date: attendanceEditData.date,
          inTime: attendanceEditData.inTime,
          outTime: attendanceEditData.outTime,
          hours: finalHours
        });
      }
      toast({ title: "Record Updated" });
      setIsAttendanceEditOpen(false);
    } finally { setIsProcessing(false); }
  };

  const handleOpenAttendanceReject = (rec: any) => {
    setSelectedAttendance(rec);
    setAttendanceRejectReason("");
    setIsAttendanceRejectOpen(true);
  };

  const handlePostAttendanceReject = () => {
    if (!selectedAttendance || !attendanceRejectReason.trim() || isProcessing) return;
    setIsProcessing(true);
    try {
      if ((selectedAttendance as any).isVirtual) {
        addRecord('attendance', {
          employeeId: selectedAttendance.employeeId,
          employeeName: selectedAttendance.employeeName,
          date: selectedAttendance.date,
          status: 'ABSENT',
          attendanceType: 'FIELD',
          remark: attendanceRejectReason,
          approved: false,
          unapprovedOutDuration: 0
        });
      } else {
        updateRecord('attendance', selectedAttendance.id, { approved: false, remark: attendanceRejectReason, status: 'ABSENT' });
      }
      toast({ variant: "destructive", title: "Log Rejected" });
      setIsAttendanceRejectOpen(false);
    } finally { setIsProcessing(false); }
  };

  const handleConfirmRestore = () => {
    if (!attendanceToRestore || isProcessing) return;
    setIsProcessing(true);
    try {
      updateRecord('attendance', attendanceToRestore.id, { approved: false, remark: "", approvedBy: null });
      toast({ title: "Record Restored" });
      setIsRestoreConfirmOpen(false);
    } finally { setIsProcessing(false); }
  };

  const handlePostLeaveApprove = () => {
    if (!selectedLeave || isProcessing) return;
    setIsProcessing(true);
    try {
      const approverName = currentUser?.fullName || "HR_ADMIN";
      const days = differenceInDays(parseISO(leaveEditDates.to), parseISO(leaveEditDates.from)) + 1;
      
      // Update Leave Request Status
      updateRecord('leaveRequests', selectedLeave.id, {
        status: 'APPROVED',
        fromDate: leaveEditDates.from,
        toDate: leaveEditDates.to,
        days,
        approvedBy: approverName
      });

      // Special Logic for Half Day: Automatically add 4 hours to attendance
      if (selectedLeave.leaveType === 'HALF_DAY') {
        const leaveDate = selectedLeave.fromDate;
        const existingAttendance = attendanceRecords.find(r => r.employeeId === selectedLeave.employeeId && r.date === leaveDate);
        
        if (existingAttendance) {
          // Add 4 hours to existing attendance
          updateRecord('attendance', existingAttendance.id, {
            hours: (existingAttendance.hours || 0) + 4,
            status: 'PRESENT',
            approved: true,
            approvedBy: approverName
          });
        } else {
          // Create new attendance record for the half day
          addRecord('attendance', {
            employeeId: selectedLeave.employeeId,
            employeeName: selectedLeave.employeeName,
            date: leaveDate,
            status: 'PRESENT',
            attendanceType: 'FIELD',
            hours: 4,
            approved: true,
            approvedBy: approverName,
            address: 'Approved Half Day Leave',
            unapprovedOutDuration: 0
          });
        }
      }

      toast({ title: "Leave Approved" });
      setIsLeaveApproveOpen(false);
    } finally { setIsProcessing(false); }
  };

  const handlePostLeaveReject = () => {
    if (!selectedLeave || !leaveRejectReason.trim() || isProcessing) return;
    setIsProcessing(true);
    try {
      updateRecord('leaveRequests', selectedLeave.id, {
        status: 'REJECTED',
        rejectReason: leaveRejectReason,
        approvedBy: currentUser?.fullName || "HR_ADMIN"
      });
      toast({ variant: "destructive", title: "Request Declined" });
      setIsLeaveRejectOpen(false);
    } finally { setIsProcessing(false); }
  };

  const resetFilters = () => {
    const today = new Date();
    const thirtyDaysAgo = subDays(today, 30);
    setFromDate(format(thirtyDaysAgo, "yyyy-MM-dd"));
    setToDate(format(today, "yyyy-MM-dd"));
    setSearchTerm("");
  };

  const handleExportHistory = () => {
    const list = historyType === 'attendance' ? historyAttendanceList : historyLeavesList;
    if (list.length === 0) {
      toast({ variant: "destructive", title: "No Data", description: "No records found to export." });
      return;
    }

    const headers = historyType === 'attendance' 
      ? ["Employee Name", "Employee ID", "Dept", "Desig", "Date", "In Time", "Out Time", "Out Hour", "Hours", "Type", "Status", "In Address", "Out Address", "Action By"]
      : ["Employee Name", "Employee ID", "Dept", "Desig", "From Date", "To Date", "Days", "Status", "Purpose", "Action By"];

    const csvRows = [
      headers.join(","),
      ...list.map(rec => {
        if (historyType === 'attendance') {
          return [
            `"${rec.employeeName}"`, `"${rec.employeeId}"`, `"${rec.dept}"`, `"${rec.desig}"`, `"${formatDate(rec.date)}"`, `"${rec.inTime || ''}"`, `"${rec.outTime || ''}"`, `"${formatMinutesToHHMM(rec.unapprovedOutDuration || 0)}"`, rec.hours, `"${rec.attendanceType}"`, `"${rec.status}"`, `"${rec.address || ''}"`, `"${rec.addressOut || ''}"`, `"${rec.approvedBy || ''}"`
          ].join(",");
        } else {
          return [
            `"${rec.employeeName}"`, `"${rec.employeeId}"`, `"${rec.department}"`, `"${rec.designation}"`, `"${formatDate(rec.fromDate)}"`, `"${formatDate(rec.toDate)}"`, rec.days, `"${rec.status}"`, `"${rec.purpose}"`, `"${rec.approvedBy || ''}"`
          ].join(",");
        }
      })
    ];

    const blob = new Blob([csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${historyType}_Report_${fromDate}_to_${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Export Success" });
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

      <div className="space-y-6">
        <Tabs 
          value={viewMode === 'pending' ? pendingType : historyType} 
          onValueChange={viewMode === 'pending' ? setPendingType : setHistoryType} 
          className="w-full"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <TabsList className="bg-slate-50 border p-1 h-9 rounded-lg w-fit">
                <TabsTrigger value="attendance" className="text-[10px] font-black uppercase tracking-widest px-6 h-7">
                  Attendance {viewMode === 'pending' && `(${pendingAttendanceList.length})`}
                </TabsTrigger>
                <TabsTrigger value="leave" className="text-[10px] font-black uppercase tracking-widest px-6 h-7">
                  Leave Requests {viewMode === 'pending' && `(${pendingLeavesList.length})`}
                </TabsTrigger>
              </TabsList>
              {viewMode === 'history' && (
                <Button variant="outline" size="sm" onClick={handleExportHistory} className="h-9 gap-2 font-bold text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                  <FileSpreadsheet className="w-4 h-4" /> Export Excel
                </Button>
              )}
            </div>

            {viewMode === 'history' && (
              <div className="flex wrap items-center gap-2">
                <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1 rounded-lg shadow-sm">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <Input 
                    type="date" 
                    value={fromDate} 
                    max={toDate || undefined}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (toDate && val > toDate) {
                        toast({ variant: "destructive", title: "Validation Error", description: "From Date cannot be greater than To Date" });
                        return;
                      }
                      setFromDate(val);
                    }} 
                    className="h-7 w-32 border-none bg-transparent text-[10px] font-bold p-0 focus-visible:ring-0" 
                  />
                  <span className="text-slate-300 text-[10px]">to</span>
                  <Input 
                    type="date" 
                    value={toDate} 
                    min={fromDate || undefined}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (fromDate && val < fromDate) {
                        toast({ variant: "destructive", title: "Validation Error", description: "From Date cannot be greater than To Date" });
                        return;
                      }
                      setToDate(val);
                    }} 
                    className="h-7 w-32 border-none bg-transparent text-[10px] font-bold p-0 focus-visible:ring-0" 
                  />
                </div>
                <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 text-rose-500 hover:bg-rose-50 font-black text-[10px] uppercase gap-1">
                  <X className="w-3 h-3" /> Reset
                </Button>
              </div>
            )}
          </div>

          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <ScrollArea className="w-full">
                <Table className="min-w-[1400px]">
                  <TableHeader className="bg-slate-50/50">
                    <TableRow>
                      <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500 py-4 px-6">Employee/ID</TableHead>
                      <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">Dept / Desig</TableHead>
                      <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">
                        {viewMode === 'pending' || (viewMode === 'history' && historyType === 'attendance') ? 'IN Date Time' : 'From Date'}
                      </TableHead>
                      <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">
                        {viewMode === 'pending' || (viewMode === 'history' && historyType === 'attendance') ? 'OUT Date Time' : 'To Date'}
                      </TableHead>
                      {((viewMode === 'pending' && pendingType === 'attendance') || (viewMode === 'history' && historyType === 'attendance')) && (
                        <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500 text-center">Out Hour</TableHead>
                      )}
                      <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500 text-center">
                        {currentData.items[0]?.days !== undefined ? 'Days' : 'Working Hour'}
                      </TableHead>
                      <TableHead className="font-bold text-[11px] uppercase tracking-widest text-center">Type/Status</TableHead>
                      {currentData.items[0]?.address !== undefined && <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">GPS Audit</TableHead>}
                      {viewMode === 'history' && <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">Action By</TableHead>}
                      <TableHead className="text-right font-bold text-[11px] uppercase tracking-widest text-slate-500 pr-6">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentData.items.length === 0 ? (
                      <TableRow><TableCell colSpan={12} className="text-center py-20 text-muted-foreground font-medium">No records found matching current filters.</TableCell></TableRow>
                    ) : (
                      currentData.items.map((rec: any) => (
                        <TableRow key={rec.id} className={cn("hover:bg-slate-50/50 transition-colors", rec.isVirtual && "bg-rose-50/30")}>
                          <TableCell className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="font-bold uppercase text-slate-700 text-sm leading-tight">{rec.employeeName}</span>
                              <span className="text-[10px] font-mono font-black text-primary uppercase">{rec.employeeId}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-600 leading-tight">{rec.dept || rec.department}</span>
                              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">{rec.desig || rec.designation}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{formatDate(rec.date || rec.fromDate)}</span>
                              <span className={cn("text-xs font-mono font-bold", !rec.inTime && rec.status === 'PRESENT' && "text-rose-500 italic")}>{rec.inTime || "--:--"}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{formatDate(rec.date || rec.toDate)}</span>
                              <span className={cn("text-xs font-mono font-bold", rec.outTime ? "text-rose-500" : "text-slate-300 italic")}>{rec.outTime || "--:--"}</span>
                            </div>
                          </TableCell>
                          {((viewMode === 'pending' && pendingType === 'attendance') || (viewMode === 'history' && historyType === 'attendance')) && (
                            <TableCell className="text-center">
                              <span className="text-xs font-mono font-bold text-rose-600">
                                {formatMinutesToHHMM(rec.unapprovedOutDuration || 0)}
                              </span>
                            </TableCell>
                          )}
                          <TableCell className="text-center">
                            <Badge variant="outline" className={cn("font-black text-xs px-3", rec.days === undefined ? getWorkingHoursColor(rec.hours) : "bg-slate-100 text-slate-700")}>
                              {rec.days !== undefined ? `${rec.days}d` : `${rec.hours}h`}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "font-black text-[9px] uppercase tracking-widest border-slate-200 px-3",
                                (rec.status === 'APPROVED' || rec.approved) ? "bg-emerald-50 text-emerald-700" :
                                rec.status === 'REJECTED' ? "bg-rose-50 text-rose-700" : "bg-white"
                              )}
                            >
                              {rec.attendanceType || rec.status}
                            </Badge>
                          </TableCell>
                          {rec.address !== undefined && (
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5">
                                  <MapPin className={cn("w-3 h-3 shrink-0", rec.address === 'N/A' ? "text-slate-300" : "text-emerald-500")} />
                                  <span className="text-[10px] font-bold text-slate-600 truncate max-w-[180px]" title={rec.address}>{rec.address || "N/A"}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <MapPin className={cn("w-3 h-3 shrink-0", rec.outTime ? "text-rose-500" : "text-slate-300")} />
                                  <span className="text-[10px] font-bold text-slate-600 truncate max-w-[180px]" title={rec.addressOut}>{rec.addressOut || (rec.outTime ? "Location pending" : (rec.isVirtual ? "N/A" : "Shift In-Progress"))}</span>
                                </div>
                              </div>
                            </TableCell>
                          )}
                          {(viewMode === 'history') && (
                            <TableCell>
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">{rec.approvedBy || "---"}</span>
                            </TableCell>
                          )}
                          <TableCell className="text-right pr-6">
                            <div className="flex justify-end items-center gap-1">
                              {viewMode === 'pending' ? (
                                pendingType === 'attendance' ? (
                                  <>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-primary" onClick={() => handleOpenAttendanceEdit(rec)} disabled={isProcessing}><Pencil className="w-3.5 h-3.5" /></Button>
                                    <Button size="sm" className={cn("h-8 font-black text-[10px] uppercase px-4 shadow-sm", (rec.outTime || rec.status === 'ABSENT') ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-slate-200 text-slate-400 cursor-not-allowed")} onClick={() => (rec.outTime || rec.status === 'ABSENT') && handleApproveAttendance(rec)} disabled={isProcessing || (!rec.outTime && rec.status !== 'ABSENT')}>{(rec.outTime || rec.status === 'ABSENT') ? "Approve" : "Locked"}</Button>
                                    <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50 h-8 font-black text-[10px] uppercase px-4" onClick={() => handleOpenAttendanceReject(rec)} disabled={isProcessing}>Reject</Button>
                                  </>
                                ) : (
                                  <>
                                    <Button size="sm" variant="outline" className="h-8 font-black text-[10px] uppercase border-rose-200 text-rose-600 hover:bg-rose-50" onClick={() => { setSelectedLeave(rec); setLeaveRejectReason(""); setIsLeaveRejectOpen(true); }} disabled={isProcessing}>Reject</Button>
                                    <Button size="sm" className="h-8 font-black text-[10px] uppercase bg-primary shadow-sm" onClick={() => { setSelectedLeave(rec); setLeaveEditDates({ from: rec.fromDate, to: rec.toDate }); setIsLeaveApproveOpen(true); }} disabled={isProcessing}>Approve</Button>
                                  </>
                                )
                              ) : (
                                historyType === 'attendance' ? (
                                  <Button variant="outline" size="sm" className="h-8 font-black text-[10px] uppercase border-primary text-primary hover:bg-primary/5 gap-1.5" onClick={() => { setAttendanceToRestore(rec); setIsRestoreConfirmOpen(true); }} disabled={isProcessing}><RotateCcw className="w-3 h-3" /> Restore</Button>
                                ) : (
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">---</span>
                                )
                              )}
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
            {currentData.totalPages > 1 && (
              <CardFooter className="bg-slate-50 border-t flex flex-col sm:flex-row items-center justify-between p-4 gap-4">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="font-bold h-9">
                    <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                  </Button>
                  <Button variant="outline" size="sm" disabled={currentPage === currentData.totalPages} onClick={() => setCurrentPage(p => p + 1)} className="font-bold h-9">
                    Next <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs font-black text-slate-500 uppercase tracking-widest">
                    Page {currentPage} of {currentData.totalPages}
                  </span>
                  <div className="flex items-center gap-2 border-l pl-4 border-slate-200">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Jump To</Label>
                    <div className="flex gap-1">
                      <Input 
                        type="number" 
                        className="w-14 h-9 text-center font-bold" 
                        value={currentPage} 
                        onChange={(e) => {
                          const p = parseInt(e.target.value);
                          if (p >= 1 && p <= currentData.totalPages) setCurrentPage(p);
                        }} 
                      />
                      <div className="w-9 h-9 bg-slate-900 rounded-lg flex items-center justify-center text-white">
                        <ArrowRightCircle className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </div>
              </CardFooter>
            )}
          </Card>
        </Tabs>
      </div>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={isRestoreConfirmOpen} onOpenChange={setIsRestoreConfirmOpen}>
        <AlertDialogContent className="rounded-2xl border-none shadow-2xl">
          <AlertDialogHeader>
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4"><RotateCcw className="w-8 h-8 text-primary" /></div>
            <AlertDialogTitle className="text-center text-2xl font-black">Confirm Record Restoration</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-slate-500 font-medium pt-2">
              This action will move the attendance log for <strong>{attendanceToRestore?.employeeName}</strong> back to the pending list for re-approval.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center gap-3 pt-8 pb-4">
            <AlertDialogCancel className="rounded-xl font-bold h-12 px-8">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); handleConfirmRestore(); }} disabled={isProcessing} className="bg-primary hover:bg-primary/90 rounded-xl font-black h-12 px-8 shadow-lg shadow-primary/20">
              {isProcessing ? "Restoring..." : "Restore Record"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Attendance Edit Dialog */}
      <Dialog open={isAttendanceEditOpen} onOpenChange={setIsAttendanceEditOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <DialogTitle className="text-xl font-black flex items-center gap-2"><Pencil className="w-5 h-5 text-primary" /> Edit Attendance Log</DialogTitle>
            <p className="text-xs font-bold text-primary uppercase tracking-widest mt-2">{selectedAttendance?.employeeName} ({selectedAttendance?.employeeId})</p>
          </DialogHeader>
          <div className="p-8 space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Attendance Date</Label>
              <Input type="date" value={attendanceEditData.date} onChange={(e) => setAttendanceEditData(p => ({...p, date: e.target.value}))} className="h-12 bg-slate-50 font-bold" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">IN Time</Label>
                <Input type="time" value={attendanceEditData.inTime} onChange={(e) => setAttendanceEditData(p => ({...p, inTime: e.target.value}))} className="h-12 bg-slate-50 font-bold" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">OUT Time</Label>
                <Input type="time" value={attendanceEditData.outTime} onChange={(e) => setAttendanceEditData(p => ({...p, outTime: e.target.value}))} className="h-12 bg-slate-50 font-bold" />
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
            <DialogTitle className="text-xl font-black flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-rose-100" /> Reject Attendance Log</DialogTitle>
            <p className="text-xs font-bold text-rose-100 uppercase tracking-widest mt-2">{selectedAttendance?.employeeName} ({selectedAttendance?.employeeId})</p>
          </DialogHeader>
          <div className="p-8 space-y-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase">IN Time</p>
                <p className="text-xs font-bold">{selectedAttendance?.date} {selectedAttendance?.inTime || "--:--"}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase">OUT Time</p>
                <p className="text-xs font-bold">{selectedAttendance?.date} {selectedAttendance?.outTime || "--:--"}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase">Working Hours</p>
                <p className="text-xs font-bold">{selectedAttendance?.hours}h</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Rejection Reason *</Label>
              <Textarea placeholder="Specify why this log is being declined..." value={attendanceRejectReason} onChange={(e) => setAttendanceRejectReason(e.target.value)} className="min-h-[120px] bg-slate-50 font-medium focus-visible:ring-rose-500 border-slate-200" />
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
            <p className="text-xs font-bold text-primary uppercase mt-2">{selectedLeave?.employeeName} ({selectedLeave?.employeeId})</p>
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
            <p className="text-sm font-medium italic text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-200">"{selectedLeave?.purpose}"</p>
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
              <Textarea placeholder="Enter reason for declining request..." value={leaveRejectReason} onChange={(e) => setLeaveRejectReason(e.target.value)} className="min-h-[120px] bg-slate-50 font-bold" />
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
