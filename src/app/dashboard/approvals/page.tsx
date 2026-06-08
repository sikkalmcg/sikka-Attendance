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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  Search, 
  XCircle, 
  RotateCcw,
  MapPin,
  Navigation,
  Filter,
  ShieldCheck,
  Building2,
  UserCheck,
  Pencil,
  ArrowRightCircle,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  MessageSquare,
  UserX,
  CheckCircle,
  Clock,
  AlertCircle,
  ClipboardList,
  CheckCircle2,
  Factory
} from "lucide-react";
import { cn, formatDate, getWorkingHoursColor, formatMinutesToHHMM, formatHoursToHHMM, parseDateTime, isEmployeeActiveOnDate } from "@/lib/utils";
import { useData } from "@/context/data-context";
import { parseISO, format, addHours, isSunday, isBefore, startOfMonth, eachDayOfInterval, subDays, isValid, differenceInMinutes, isWithinInterval, startOfDay, endOfMonth, isSameDay } from "date-fns";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

const ITEMS_PER_PAGE = 15;
const PROJECT_START_DATE_STR = "2026-04-01";

const generateFilterMonths = () => {
  const options = [];
  const date = new Date();
  for (let i = -6; i < 12; i++) {
    const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
    if (isBefore(d, startOfMonth(parseISO(PROJECT_START_DATE_STR)))) continue;
    const mmm = d.toLocaleString('en-US', { month: 'short' });
    const yy = d.getFullYear().toString().slice(-2);
    options.push(`${mmm}-${yy}`);
  }
  return options;
};

// Helper for location display priority (Street + City + State or Coordinates)
const formatLocation = (address?: string, lat?: number, lng?: number) => {
  if (address && address !== "Location Not Available" && address.trim() !== "") {
    const isCoordinateString = /^-?\d+\.\d+, -?\d+\.\d+$/.test(address);
    if (!isCoordinateString) return address;
  }
  
  if (lat !== undefined && lng !== undefined && lat !== 0 && lng !== 0) {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }
  
  return address || "Location Not Available";
};

export default function ApprovalsPage() {
  const { attendanceRecords, employees, updateRecord, addRecord, verifiedUser, holidays, plants, leaveRequests } = useData();
  const [isMounted, setIsMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("pending");
  const [selectedPlantFilter, setSelectedPlantFilter] = useState<string>("ALL_ASSIGNED");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("ALL");

  const [historyMonthFilter, setHistoryMonthFilter] = useState("");
  const [pendingPage, setPendingPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);

  // Modals
  const [selectedAttendance, setSelectedAttendance] = useState<any>(null);
  const [isApproveConfirmOpen, setIsApproveConfirmOpen] = useState(false);
  const [isAttendanceRejectOpen, setIsAttendanceRejectOpen] = useState(false);
  const [attendanceRejectReason, setAttendanceRejectReason] = useState("");
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editData, setEditData] = useState({ 
    plant: "", 
    inDate: "", 
    inTime: "", 
    outDate: "", 
    outTime: "", 
    remark: "" 
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const filterMonths = useMemo(() => generateFilterMonths(), []);

  useEffect(() => {
    setIsMounted(true);
    const now = new Date();
    const mmm = now.toLocaleString('en-US', { month: 'short' });
    const yy = now.getFullYear().toString().slice(-2);
    setHistoryMonthFilter(`${mmm}-${yy}`);
  }, []);

  useEffect(() => {
    setPendingPage(1);
    setHistoryPage(1);
  }, [viewMode, selectedPlantFilter, selectedStatusFilter, historyMonthFilter, searchTerm]);

  const userAssignedPlantIds = useMemo(() => {
    if (!verifiedUser || verifiedUser.role === 'SUPER_ADMIN') return null;
    return verifiedUser.plantIds || [];
  }, [verifiedUser]);

  const authorizedPlants = useMemo(() => {
    if (!userAssignedPlantIds) return plants;
    return plants.filter(p => userAssignedPlantIds.includes(p.id));
  }, [userAssignedPlantIds, plants]);

  const approvedLeavesMap = useMemo(() => {
    const map = new Map<string, any>();
    leaveRequests.filter(l => l.status === 'APPROVED').forEach(l => {
      const start = startOfDay(parseISO(l.fromDate));
      const end = startOfDay(parseISO(l.toDate));
      if (!isValid(start) || !isValid(end)) return;
      eachDayOfInterval({ start, end }).forEach(d => {
        map.set(`${l.employeeId}:${format(d, 'yyyy-MM-dd')}`, l);
      });
    });
    return map;
  }, [leaveRequests]);

  const getCalculatedStatus = (dateStr: string, record: any, empId: string) => {
    const isSun = isSunday(parseISO(dateStr));
    const customHoliday = holidays.find(h => h.date === dateStr && !h.auto);
    const approvedLeave = approvedLeavesMap.get(`${empId}:${dateStr}`);

    if (record && record.inTime) {
      if (isSun) return "Present on Weekly Off";
      if (customHoliday) return "Present on Holiday";
      return "Present";
    }

    if (approvedLeave) return "Absent on Leave";
    if (isSun) return "Weekly Off";
    if (customHoliday) return "Holiday";
    
    return "Absent";
  };

  const allAttendanceList = useMemo(() => {
    if (!isMounted) return [];
    const now = new Date();
    const employeeMap = new Map(employees.map(e => [e.employeeId, e]));
    
    const actual = (attendanceRecords || []).filter(rec => {
      const emp = employeeMap.get(rec.employeeId);
      if (!emp) return false;
      
      if (!isEmployeeActiveOnDate(emp, rec.date)) return false;

      if (!userAssignedPlantIds) return true;
      return (emp.unitIds || []).some(id => userAssignedPlantIds.includes(id)) || userAssignedPlantIds.includes(emp.unitId);
    }).map(rec => {
      const emp = employeeMap.get(rec.employeeId);
      const leave = approvedLeavesMap.get(`${rec.employeeId}:${rec.date}`);
      
      let processedRec = { 
        ...rec, 
        dept: emp?.department || "N/A", 
        desig: emp?.designation || "N/A",
        inDate: rec.inDate || rec.date,
        outDate: rec.outDate || rec.date,
        leaveType: leave ? leave.purpose : "-",
        leaveStatus: leave ? "Approved" : "-",
        workingHourDisplay: formatHoursToHHMM(rec.hours)
      };
      
      if (!rec.outTime && rec.inTime && rec.inTime.trim() !== "") {
        const inDT = parseDateTime(processedRec.inDate, rec.inTime);
        if (inDT && isValid(inDT)) {
          const diffHours = (now.getTime() - inDT.getTime()) / (1000 * 60 * 60);
          if (diffHours >= 16) {
             processedRec.autoCheckout = true;
             processedRec.hours = 16.0;
             processedRec.workingHourDisplay = "16:00";
          }
        }
      }
      
      processedRec.displayStatus = getCalculatedStatus(rec.date, processedRec, rec.employeeId);
      return processedRec;
    });

    const missing: any[] = [];
    const projectStartDate = parseISO(PROJECT_START_DATE_STR);
    
    const handledRecordsKeySet = new Set(
      actual.map(r => `${r.employeeId}:${r.date}`)
    );

    if (isBefore(projectStartDate, now)) {
      let generationEndDate = now;
      if (historyMonthFilter && historyMonthFilter !== 'all') {
         const [mmm, yy] = historyMonthFilter.split('-');
         const filterDate = parseISO(`20${yy}-${mmm}-01`);
         const lastDayOfFilterMonth = endOfMonth(filterDate);
         generationEndDate = isBefore(lastDayOfFilterMonth, now) ? lastDayOfFilterMonth : now;
      }

      const intervalDates = eachDayOfInterval({ 
        start: projectStartDate, 
        end: generationEndDate
      }).map(d => format(d, "yyyy-MM-dd"));
      
      employees.forEach(emp => {
        if (userAssignedPlantIds) {
          const hasAccess = (emp.unitIds || []).some(id => userAssignedPlantIds.includes(id)) || userAssignedPlantIds.includes(emp.unitId);
          if (!hasAccess) return;
        }

        intervalDates.forEach(dStr => {
          if (!isEmployeeActiveOnDate(emp, dStr)) return;

          const key = `${emp.employeeId}:${dStr}`;
          if (!handledRecordsKeySet.has(key)) {
            const displayStatus = getCalculatedStatus(dStr, null, emp.employeeId);
            const leave = approvedLeavesMap.get(`${emp.employeeId}:${dStr}`);
            
            missing.push({ 
              id: `v-abs-${emp.employeeId}-${dStr}`, 
              employeeId: emp.employeeId, 
              employeeName: emp.name, 
              date: dStr, 
              status: 'ABSENT', 
              displayStatus, 
              attendanceType: 'ABSENT', 
              approved: false, 
              dept: emp.department, 
              desig: emp.designation, 
              isVirtual: true, 
              hours: 0, 
              workingHourDisplay: "00:00",
              unapprovedOutDuration: 0,
              inTime: null,
              outTime: null,
              remark: null,
              leaveType: leave ? leave.purpose : "-",
              leaveStatus: leave ? "Approved" : "-"
            });
          }
        });
      });
    }

    let combined = [...actual, ...missing];

    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      combined = combined.filter(rec => 
        (rec.employeeName || "").toLowerCase().includes(s) || 
        (rec.employeeId || "").toLowerCase().includes(s)
      );
    }

    if (selectedPlantFilter !== "ALL_ASSIGNED") {
      combined = combined.filter(rec => {
        if (!rec.isVirtual) return rec.inPlant === selectedPlantFilter;
        const emp = employeeMap.get(rec.employeeId);
        const targetPlant = plants.find(p => p.name === selectedPlantFilter);
        return (emp?.unitIds || []).includes(targetPlant?.id || "");
      });
    }

    return combined;
  }, [attendanceRecords, employees, isMounted, holidays, userAssignedPlantIds, selectedPlantFilter, searchTerm, plants, approvedLeavesMap, historyMonthFilter]);

  const pendingAttendanceList = useMemo(() => {
    let list = allAttendanceList.filter(rec => !rec.approved);
    
    if (selectedStatusFilter !== "ALL") {
      list = list.filter(rec => rec.displayStatus === selectedStatusFilter);
    }
    
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [allAttendanceList, selectedStatusFilter]);

  const historyAttendanceList = useMemo(() => {
    return allAttendanceList.filter(rec => rec.approved)
      .sort((a, b) => b.date.localeCompare(a.date) || a.employeeName.localeCompare(b.employeeName));
  }, [allAttendanceList]);

  const currentData = useMemo(() => {
    const list = viewMode === 'pending' ? pendingAttendanceList : historyAttendanceList;
    const page = viewMode === 'pending' ? pendingPage : historyPage;
    const start = (page - 1) * ITEMS_PER_PAGE;
    return { 
      items: list.slice(start, start + ITEMS_PER_PAGE), 
      total: list.length, 
      totalPages: Math.ceil(list.length / ITEMS_PER_PAGE) 
    };
  }, [viewMode, pendingAttendanceList, historyAttendanceList, pendingPage, historyPage]);

  const handleOpenApproveConfirmation = (rec: any) => {
    setSelectedAttendance(rec);
    setIsApproveConfirmOpen(true);
  };

  const handleConfirmApproval = async () => {
    if (!selectedAttendance || isProcessing) return;
    setIsProcessing(true);
    
    try {
      const rec = selectedAttendance;
      const approverName = verifiedUser?.fullName || "HR_ADMIN";
      const nowIso = new Date().toISOString();

      if (rec.isVirtual) {
        addRecord('attendance', { 
          employeeId: rec.employeeId, 
          employeeName: rec.employeeName, 
          date: rec.date, 
          inDate: rec.date, 
          status: rec.status, 
          attendanceType: rec.attendanceType, 
          approved: true, 
          approvedBy: approverName, 
          approvalActionDate: nowIso,
          hours: 0, 
          inTime: null, 
          outTime: null, 
          address: 'System Generated Log', 
          unapprovedOutDuration: 0 
        });
      } else {
        let finalOutTime = rec.outTime;
        let finalOutDate = rec.outDate || rec.date;
        let finalHours = rec.hours || 0;

        if (rec.autoCheckout && !rec.outTime) {
          const inDT = parseDateTime(rec.inDate || rec.date, rec.inTime || "");
          if (inDT && isValid(inDT)) {
            const autoOutDT = addHours(inDT, 16);
            finalOutTime = format(autoOutDT, "HH:mm");
            finalOutDate = format(autoOutDT, "yyyy-MM-dd");
            finalHours = 16.0;
          }
        }

        updateRecord('attendance', rec.id, { 
          approved: true, 
          approvedBy: approverName, 
          approvalActionDate: nowIso,
          outTime: finalOutTime || null,
          outDate: finalOutDate || null,
          hours: finalHours,
          ...(rec.autoCheckout && !rec.remark && { remark: "System Auto-Logged OUT (16h Limit Threshold reached)" })
        });
      }
      toast({ title: "Attendance approved successfully and moved to History." });
      setIsApproveConfirmOpen(false);
      setSelectedAttendance(null);
    } catch (e) {
      toast({ variant: "destructive", title: "Unable to approve attendance. Please try again." });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenEditModal = (rec: any) => {
    setSelectedAttendance(rec);
    setEditData({
      plant: rec.inPlant || "",
      inDate: rec.inDate || rec.date,
      inTime: rec.inTime || "",
      outDate: rec.outDate || rec.date,
      outTime: rec.outTime || "",
      remark: ""
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateAttendance = async () => {
    if (!selectedAttendance || isProcessing) return;

    if (!editData.plant || !editData.inDate || !editData.inTime || !editData.outDate || !editData.outTime || !editData.remark.trim()) {
      toast({ variant: "destructive", title: "Incomplete Form", description: "All fields including Remark are mandatory." });
      return;
    }

    const inDT = parseDateTime(editData.inDate, editData.inTime);
    const outDT = parseDateTime(editData.outDate, editData.outTime);

    if (!inDT || !outDT || !isValid(inDT) || !isValid(outDT)) {
      toast({ variant: "destructive", title: "Invalid Date Format" });
      return;
    }

    if (outDT <= inDT) {
      toast({ variant: "destructive", title: "Timeline Conflict", description: "Out Date & Time must be after In Date & Time." });
      return;
    }

    const diffMs = outDT.getTime() - inDT.getTime();
    const diffHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));

    if (isNaN(diffHours)) {
      toast({ variant: "destructive", title: "Calculation Error", description: "Could not calculate working hours." });
      return;
    }

    setIsProcessing(true);
    try {
      const modifierName = verifiedUser?.fullName || "HR_ADMIN";
      const updatePayload: any = {
        inPlant: editData.plant,
        inDate: editData.inDate,
        inTime: editData.inTime,
        outDate: editData.outDate,
        outTime: editData.outTime,
        hours: diffHours,
        remark: editData.remark,
        editedBy: modifierName,
        editedAt: new Date().toISOString(),
        ...(!selectedAttendance.originalInTime && {
          originalInTime: selectedAttendance.inTime || null,
          originalOutTime: selectedAttendance.outTime || null,
          originalInDate: selectedAttendance.inDate || selectedAttendance.date || null,
          originalOutDate: selectedAttendance.outDate || selectedAttendance.date || null,
          originalPlant: selectedAttendance.inPlant || null
        })
      };

      if (selectedAttendance.isVirtual) {
        addRecord('attendance', {
          ...updatePayload,
          employeeId: selectedAttendance.employeeId,
          employeeName: selectedAttendance.employeeName,
          date: selectedAttendance.date,
          status: diffHours >= 2.0 ? 'PRESENT' : 'ABSENT',
          attendanceType: 'OFFICE',
          approved: false,
          address: 'Manually Created Log',
          unapprovedOutDuration: 0
        });
      } else {
        updateRecord('attendance', selectedAttendance.id, updatePayload);
      }

      toast({ title: "Attendance Entry Updated", description: "Record modified with audit trail." });
      setIsEditModalOpen(false);
      setSelectedAttendance(null);
    } catch (e) {
      console.error("Update failed", e);
      toast({ variant: "destructive", title: "Error", description: "Failed to update record." });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePostAttendanceReject = () => {
    if (!selectedAttendance || !attendanceRejectReason.trim() || isProcessing) return;
    setIsProcessing(true);
    try {
      const approver = verifiedUser?.fullName || "HR_ADMIN";
      const nowIso = new Date().toISOString();

      if (selectedAttendance.isVirtual) {
        addRecord('attendance', { 
          employeeId: selectedAttendance.employeeId, 
          employeeName: selectedAttendance.employeeName, 
          date: selectedAttendance.date, 
          inDate: selectedAttendance.date, 
          status: 'ABSENT', 
          attendanceType: 'ABSENT', 
          remark: attendanceRejectReason, 
          approved: false, 
          unapprovedOutDuration: 0, 
          approvedBy: approver,
          approvalActionDate: nowIso
        });
      } else {
        updateRecord('attendance', selectedAttendance.id, { 
          approved: false, 
          remark: attendanceRejectReason, 
          status: 'ABSENT', 
          approvedBy: approver,
          approvalActionDate: nowIso
        });
      }
      toast({ variant: "destructive", title: "Log Rejected" });
      setIsAttendanceRejectOpen(false);
      setAttendanceRejectReason("");
      setSelectedAttendance(null);
    } finally { setIsProcessing(false); }
  };

  const handleRestoreAttendance = (rec: any) => {
    if (rec.isVirtual) return; 
    updateRecord('attendance', rec.id, { 
      approved: false, 
      remark: null, 
      approvedBy: null,
      editedBy: null,
      approvalActionDate: null 
    });
    toast({ title: "Record Restored", description: "Moved back to Pending queue." });
  };

  function StandardPaginationFooter({ current, total, onPageChange }: any) {
    return (
      <CardFooter className="bg-slate-50 border-t flex flex-col sm:flex-row items-center justify-between p-4 gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={current === 1} onClick={() => onPageChange(current - 1)} className="font-bold h-9"><ChevronLeft className="w-4 h-4 mr-1" /> Prev</Button>
          <Button variant="outline" size="sm" disabled={current === total || total === 0} onClick={() => onPageChange(current + 1)} className="font-bold h-9">Next <ChevronRight className="w-4 h-4 ml-1" /></Button>
        </div>
        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Page {current} of {total || 1}</span>
      </CardFooter>
    );
  }

  if (!isMounted) return null;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Staff Attendance Approvals</h1>
          <p className="text-muted-foreground text-sm font-medium mt-1">Multi-Facility Compliance Oversight</p>
        </div>
        <div className="flex items-center gap-4">
          {viewMode === 'pending' && (
            <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border shadow-sm border-slate-200">
              <Filter className="w-4 h-4 text-primary ml-2" />
              <Select value={selectedStatusFilter} onValueChange={setSelectedStatusFilter}>
                <SelectTrigger className="h-9 w-[200px] border-none font-black text-xs uppercase focus:ring-0">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="font-bold text-xs uppercase">All Status</SelectItem>
                  <SelectItem value="Present" className="font-bold text-xs uppercase">Present</SelectItem>
                  <SelectItem value="Absent on Leave" className="font-bold text-xs uppercase">Absent on Leave</SelectItem>
                  <SelectItem value="Absent" className="font-bold text-xs uppercase">Absent</SelectItem>
                  <SelectItem value="Weekly Off" className="font-bold text-xs uppercase">Weekly Off</SelectItem>
                  <SelectItem value="Holiday" className="font-bold text-xs uppercase">Holiday</SelectItem>
                  <SelectItem value="Present on Weekly Off" className="font-bold text-xs uppercase">Present on Weekly Off</SelectItem>
                  <SelectItem value="Present on Holiday" className="font-bold text-xs uppercase">Present on Holiday</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border shadow-sm border-slate-200">
             <Building2 className="w-4 h-4 text-primary ml-2" />
             <Select value={selectedPlantFilter} onValueChange={setSelectedPlantFilter}>
                <SelectTrigger className="h-9 w-[220px] border-none font-black text-xs uppercase focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL_ASSIGNED" className="font-bold text-xs uppercase">All Assigned Plants</SelectItem>
                  {authorizedPlants.map(p => (
                    <SelectItem key={p.id} value={p.name} className="font-bold text-xs uppercase">{p.name}</SelectItem>
                  ))}
                </SelectContent>
             </Select>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search by name or ID..." className="pl-10 h-10 bg-white" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v)} className="w-full md:w-auto"><TabsList className="grid w-full grid-cols-2 bg-slate-100 h-10 p-1 rounded-xl w-[240px]"><TabsTrigger value="pending" className="text-xs font-black">Pending Session</TabsTrigger><TabsTrigger value="history" className="text-xs font-black">History</TabsTrigger></TabsList></Tabs>
        </div>
      </div>

      {viewMode === 'history' && (
        <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
           <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <Select value={historyMonthFilter} onValueChange={setHistoryMonthFilter}>
                   <SelectTrigger className="h-9 w-[150px] font-black text-xs uppercase bg-slate-50 border-slate-200">
                      <SelectValue placeholder="Select Month" />
                   </SelectTrigger>
                   <SelectContent>
                      <SelectItem value="all" className="font-bold text-xs">All History</SelectItem>
                      {filterMonths.map(m => <SelectItem key={m} value={m} className="font-bold text-xs">{m}</SelectItem>)}
                   </SelectContent>
                </Select>
              </div>
           </div>
           <Button onClick={() => {}} variant="outline" className="h-10 font-bold border-emerald-200 text-emerald-700 hover:bg-emerald-50 gap-2 px-6">
              <FileSpreadsheet className="w-4 h-4" /> Export History
           </Button>
        </div>
      )}

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <ScrollArea className="w-full">
            <Table className="min-w-[2200px]">
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500 py-4 px-6">Employee Name</TableHead>
                  <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">Date</TableHead>
                  <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">Attendance Status</TableHead>
                  <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">Plant</TableHead>
                  <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">In Date time</TableHead>
                  <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">Out Date time</TableHead>
                  <TableHead className="font-bold text-[11px] uppercase tracking-widest text-primary">Working Hour</TableHead>
                  {viewMode === 'history' && <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">Auto Out</TableHead>}
                  <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">In Location</TableHead>
                  <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">Out Location</TableHead>
                  <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">Leave Type</TableHead>
                  <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">Leave Status</TableHead>
                  <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">Remark</TableHead>
                  {viewMode === 'history' && <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">Approved By</TableHead>}
                  <TableHead className={cn("text-right font-bold text-[11px] uppercase tracking-widest text-slate-500", viewMode === 'history' ? "pr-10" : "pr-6")}>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentData.items.length === 0 ? (
                  <TableRow><TableCell colSpan={viewMode === 'history' ? 15 : 13} className="text-center py-20 text-muted-foreground font-bold italic">No records found.</TableCell></TableRow>
                ) : (
                  currentData.items.map((rec: any) => {
                    const canApprove = rec.isVirtual || (rec.inTime && (rec.outTime || rec.autoCheckout));
                    
                    const inDisplay = rec.inTime ? `${formatDate(rec.inDate || rec.date)} ${rec.inTime}` : "--";
                    let outDisplay = "--";
                    if (rec.outTime) {
                      outDisplay = `${formatDate(rec.outDate || rec.date)} ${rec.outTime}`;
                    } else if (rec.autoCheckout && rec.inTime) {
                      const inDT = parseDateTime(rec.inDate || rec.date, rec.inTime);
                      if (inDT && isValid(inDT)) {
                        const autoOutDT = addHours(inDT, 16);
                        outDisplay = `${formatDate(format(autoOutDT, "yyyy-MM-dd"))} ${format(autoOutDT, "HH:mm")}`;
                      }
                    }

                    const inLocationDisplay = formatLocation(rec.address, rec.lat, rec.lng);
                    const outLocationDisplay = formatLocation(rec.addressOut, rec.latOut, rec.lngOut);

                    return (
                    <TableRow key={rec.id} className={cn("hover:bg-slate-50/50", rec.autoCheckout && "bg-amber-50/20")}>
                      <TableCell className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-black text-slate-900 uppercase text-xs sm:text-sm">{rec.employeeName}</span>
                          <span className="text-[10px] font-mono text-primary font-bold uppercase">{rec.employeeId}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-bold text-slate-700">{formatDate(rec.date)}</TableCell>
                      <TableCell>
                        <Badge className={cn(
                          "text-[9px] font-black uppercase px-3 py-1 transition-all duration-300", 
                          rec.displayStatus === 'Present' && "bg-emerald-50 text-emerald-700 border-none shadow-sm",
                          rec.displayStatus === 'Absent' && "bg-rose-500 text-white border-none shadow-sm",
                          rec.displayStatus === 'Absent on Leave' && "bg-purple-500 text-white border-none shadow-sm",
                          rec.displayStatus === 'Present on Weekly Off' && "bg-gradient-to-r from-sky-200 to-emerald-500 text-white border-none shadow-sm",
                          rec.displayStatus === 'Present on Holiday' && "bg-gradient-to-r from-sky-200 to-emerald-500 text-white border-none shadow-sm",
                          (rec.displayStatus === 'Weekly Off' || rec.displayStatus === 'Holiday') && "bg-transparent text-slate-400 border-slate-200 shadow-none font-bold"
                        )}>
                          {rec.displayStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-black uppercase bg-white border-slate-200">
                          {rec.inPlant || rec.remark || "--"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-bold text-slate-600 whitespace-nowrap">{inDisplay}</TableCell>
                      <TableCell className="text-xs font-bold text-slate-600 whitespace-nowrap">{outDisplay}</TableCell>
                      <TableCell className="text-xs font-black text-slate-900">{rec.workingHourDisplay || "--"}</TableCell>
                      {viewMode === 'history' && (
                        <TableCell>
                           <Badge variant={rec.autoCheckout || rec.autoOut ? "destructive" : "outline"} className="text-[9px] font-black uppercase">
                              {rec.autoCheckout || rec.autoOut ? "YES" : "NO"}
                           </Badge>
                        </TableCell>
                      )}
                      <TableCell className="text-[10px] font-medium text-slate-500 max-w-[200px] truncate leading-tight" title={inLocationDisplay}>{inLocationDisplay}</TableCell>
                      <TableCell className="text-[10px] font-medium text-slate-500 max-w-[200px] truncate leading-tight" title={outLocationDisplay}>{outLocationDisplay}</TableCell>
                      <TableCell className="text-xs font-medium text-slate-500">{rec.leaveType}</TableCell>
                      <TableCell>
                        {rec.leaveStatus !== '-' ? (
                          <Badge variant="outline" className="text-[9px] font-black uppercase border-emerald-200 bg-emerald-50 text-emerald-700">
                             {rec.leaveStatus}
                          </Badge>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-slate-600 max-w-[200px] truncate">{rec.remark || "-"}</TableCell>
                      {viewMode === 'history' && (
                        <TableCell>
                           <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">
                                {rec.approvedBy || rec.editedBy || "SYSTEM"}
                              </span>
                           </div>
                        </TableCell>
                      )}
                      <TableCell className={cn("text-right", viewMode === 'history' ? "pr-10" : "pr-6")}>
                        <div className="flex justify-end gap-1">
                          {viewMode === 'pending' ? (
                            <>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-slate-500" 
                                onClick={() => handleOpenEditModal(rec)}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600" onClick={() => { setSelectedAttendance(rec); setIsAttendanceRejectOpen(true); }}><XCircle className="w-3.5 h-3.5" /></Button>
                              <Button 
                                size="sm" 
                                className="h-8 font-black text-[10px] uppercase bg-emerald-600 text-white disabled:bg-slate-200 disabled:text-slate-400" 
                                onClick={() => handleOpenApproveConfirmation(rec)}
                                disabled={!canApprove}
                              >
                                Approve
                              </Button>
                            </>
                          ) : (
                            !rec.isVirtual && (
                              <Button 
                                variant="secondary" 
                                size="sm" 
                                className="h-8 gap-2 font-black text-[10px] uppercase bg-slate-900 text-white hover:bg-primary transition-all rounded-lg"
                                onClick={() => handleRestoreAttendance(rec)}
                              >
                                <RotateCcw className="w-3 h-3" /> Restore
                              </Button>
                            )
                          )}
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
        <StandardPaginationFooter current={viewMode === 'pending' ? pendingPage : historyPage} total={currentData.totalPages} onPageChange={viewMode === 'pending' ? setPendingPage : setHistoryPage} />
      </Card>

      {/* Edit Attendance Entry Dialog */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-2xl rounded-2xl p-0 overflow-hidden border-none shadow-2xl">
           <DialogHeader className="p-8 bg-slate-900 text-white shrink-0">
              <DialogTitle className="flex items-center gap-3 text-xl font-black uppercase">
                 <Pencil className="w-6 h-6 text-primary" /> Edit Attendance Entry
              </DialogTitle>
              <div className="mt-4 pt-4 border-t border-white/10">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Target Employee</p>
                 <p className="text-xl font-black text-primary uppercase">{selectedAttendance?.employeeName}</p>
              </div>
           </DialogHeader>

           <div className="p-8 space-y-8 bg-white">
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Assigned Plant *</Label>
                 <Select value={editData.plant} onValueChange={(v) => setEditData({...editData, plant: v})}>
                    <SelectTrigger className="h-12 border-slate-200 rounded-xl font-bold">
                       <SelectValue placeholder="Choose Plant" />
                    </SelectTrigger>
                    <SelectContent>
                       {authorizedPlants.map(p => (
                         <SelectItem key={p.id} value={p.name} className="font-bold">{p.name}</SelectItem>
                       ))}
                    </SelectContent>
                 </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                 <div className="space-y-4">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-1.5"><Clock className="w-3 h-3" /> In Date *</Label>
                       <Input type="date" value={editData.inDate} onChange={(e) => setEditData({...editData, inDate: e.target.value})} className="h-12 border-slate-200 rounded-xl font-bold" />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-1.5"><Clock className="w-3 h-3" /> In Time *</Label>
                       <Input type="time" value={editData.inTime} onChange={(e) => setEditData({...editData, inTime: e.target.value})} className="h-12 border-slate-200 rounded-xl font-bold" />
                    </div>
                 </div>

                 <div className="space-y-4">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-1.5"><Clock className="w-3 h-3" /> Out Date *</Label>
                       <Input type="date" value={editData.outDate} onChange={(e) => setEditData({...editData, outDate: e.target.value})} className="h-12 border-slate-200 rounded-xl font-bold" />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-1.5"><Clock className="w-3 h-3" /> Out Time *</Label>
                       <Input type="time" value={editData.outTime} onChange={(e) => setEditData({...editData, outTime: e.target.value})} className="h-12 border-slate-200 rounded-xl font-bold" />
                    </div>
                 </div>
              </div>

              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Adjustment Remark * (Mandatory)</Label>
                 <Textarea 
                    placeholder="Specify the reason for manual timestamp adjustment..." 
                    value={editData.remark} 
                    onChange={(e) => setEditData({...editData, remark: e.target.value})} 
                    className="min-h-[100px] border-slate-200 rounded-xl bg-slate-50"
                 />
              </div>
           </div>

           <DialogFooter className="p-6 bg-slate-50 border-t flex flex-row gap-3">
              <Button variant="destructive" onClick={() => setIsEditModalOpen(false)} className="flex-1 rounded-xl font-bold h-12 uppercase text-xs">
                 Cancel
              </Button>
              <Button 
                onClick={handleUpdateAttendance} 
                disabled={isProcessing}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 font-black rounded-xl h-12 shadow-lg shadow-emerald-900/10 uppercase text-xs"
              >
                 {isProcessing ? "Updating..." : "Update Record"}
              </Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
