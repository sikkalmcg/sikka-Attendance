
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
  CheckCircle2, 
  XCircle, 
  RotateCcw,
  Clock,
  MapPin,
  Navigation,
  Filter,
  ShieldCheck,
  Building2,
  UserCheck,
  CalendarDays,
  Briefcase,
  FileCheck,
  Pencil,
  Download,
  ArrowRightCircle,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  MessageSquare
} from "lucide-react";
import { cn, formatDate, getWorkingHoursColor, formatMinutesToHHMM, formatHoursToHHMM } from "@/lib/utils";
import { useData } from "@/context/data-context";
import { parseISO, format, addHours, isSunday, isBefore, startOfMonth, eachDayOfInterval, subDays, isValid } from "date-fns";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

const ITEMS_PER_PAGE = 15;
const PROJECT_START_DATE_STR = "2026-04-01";
const MIN_PRESENT_HOURS = 2.0;

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

export default function ApprovalsPage() {
  const { attendanceRecords, leaveRequests, employees, updateRecord, addRecord, verifiedUser, holidays, plants } = useData();
  const [isMounted, setIsMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("pending");
  const [selectedPlantFilter, setSelectedPlantFilter] = useState<string>("ALL_ASSIGNED");

  // History Controls
  const [historyMonthFilter, setHistoryMonthFilter] = useState("");
  const [pendingPage, setPendingPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);

  // Attendance Reject/Edit/Restore States
  const [selectedAttendance, setSelectedAttendance] = useState<any>(null);
  const [isAttendanceRejectOpen, setIsAttendanceRejectOpen] = useState(false);
  const [attendanceRejectReason, setAttendanceRejectReason] = useState("");
  
  // Manual Edit State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editData, setEditData] = useState({ inTime: "", outTime: "", remark: "" });

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
  }, [viewMode, selectedPlantFilter, historyMonthFilter]);

  const userAssignedPlantIds = useMemo(() => {
    if (!verifiedUser || verifiedUser.role === 'SUPER_ADMIN') return null;
    return verifiedUser.plantIds || [];
  }, [verifiedUser]);

  const authorizedPlants = useMemo(() => {
    if (!userAssignedPlantIds) return plants;
    return plants.filter(p => userAssignedPlantIds.includes(p.id));
  }, [userAssignedPlantIds, plants]);

  const authorizedPlantNames = useMemo(() => new Set(authorizedPlants.map(p => p.name)), [authorizedPlants]);

  const holidaySet = useMemo(() => {
    return new Set(holidays.map(h => h.date));
  }, [holidays]);

  const getCalculatedStatus = (dateStr: string, record: any) => {
    const isHoliday = holidaySet.has(dateStr) || isSunday(parseISO(dateStr));
    const hours = record?.hours || 0;
    const isPresent = hours >= MIN_PRESENT_HOURS;
    const type = record?.attendanceType;
    
    let typeLabel = "";
    if (type === 'FIELD') typeLabel = " – Field";
    else if (type === 'WFH') typeLabel = " – Work at Home";

    if (isPresent) {
      if (isHoliday) return `Present on Holiday${typeLabel}`;
      return `Present${typeLabel}`;
    } else {
      if (isHoliday) return "Holiday";
      return "Absent";
    }
  };

  const allAttendanceList = useMemo(() => {
    if (!isMounted) return [];
    const now = new Date();

    const actual = (attendanceRecords || []).map(rec => {
      const emp = employees.find(e => e.employeeId === rec.employeeId);
      let processedRec = { ...rec, dept: emp?.department || "N/A", desig: emp?.designation || "N/A" };
      
      if (!rec.outTime && rec.inTime && rec.inTime.trim() !== "") {
        const inDT = new Date(`${rec.inDate || rec.date}T${rec.inTime}`);
        if (isValid(inDT) && (now.getTime() - inDT.getTime()) / (1000 * 60 * 60) >= 16) {
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
      
      processedRec.displayStatus = getCalculatedStatus(rec.date, processedRec);
      return processedRec;
    });

    const missing: any[] = [];
    const yesterday = subDays(now, 1);
    const startDate = parseISO(PROJECT_START_DATE_STR);
    
    // Performance Optimization: Use a Set for record lookups
    const existingRecordsKeySet = new Set(attendanceRecords.map(r => `${r.employeeId}:${r.date}`));

    if (isBefore(startDate, now)) {
      const intervalDates = eachDayOfInterval({ 
        start: startDate, 
        end: yesterday 
      });
      
      const activeEmployees = employees.filter(e => e.active);
      
      activeEmployees.forEach(emp => {
        intervalDates.forEach(date => {
          const dStr = format(date, "yyyy-MM-dd");
          const key = `${emp.employeeId}:${dStr}`;
          
          if (!existingRecordsKeySet.has(key)) {
            const displayStatus = getCalculatedStatus(dStr, null);
            missing.push({ 
              id: `v-abs-${emp.employeeId}-${dStr}`, 
              employeeId: emp.employeeId, 
              employeeName: emp.name, 
              date: dStr, 
              status: displayStatus === 'Holiday' ? 'HOLIDAY' : 'ABSENT', 
              displayStatus, 
              attendanceType: 'ABSENT', 
              approved: false, 
              dept: emp.department, 
              desig: emp.designation, 
              isVirtual: true, 
              hours: 0, 
              unapprovedOutDuration: 0,
              inTime: null,
              outTime: null,
              remark: null
            });
          }
        });
      });
    }

    let filtered = [...actual, ...missing].filter(rec => rec.date >= PROJECT_START_DATE_STR);

    if (userAssignedPlantIds) {
      filtered = filtered.filter(rec => {
        if (!rec.isVirtual) return authorizedPlantNames.has(rec.inPlant);
        const emp = employees.find(e => e.employeeId === rec.employeeId);
        return (emp?.unitIds || []).some(id => userAssignedPlantIds.includes(id));
      });
    }

    if (selectedPlantFilter !== "ALL_ASSIGNED") {
      filtered = filtered.filter(rec => {
        if (!rec.isVirtual) return rec.inPlant === selectedPlantFilter;
        const emp = employees.find(e => e.employeeId === rec.employeeId);
        const targetPlant = plants.find(p => p.name === selectedPlantFilter);
        return (emp?.unitIds || []).includes(targetPlant?.id || "");
      });
    }

    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      filtered = filtered.filter(rec => 
        (rec.employeeName || "").toLowerCase().includes(s) || 
        (rec.employeeId || "").toLowerCase().includes(s)
      );
    }

    return filtered;
  }, [attendanceRecords, employees, isMounted, holidaySet, userAssignedPlantIds, authorizedPlantNames, selectedPlantFilter, searchTerm, plants]);

  const pendingAttendanceList = useMemo(() => {
    return allAttendanceList.filter(rec => !rec.approved && !rec.remark && (rec.isVirtual || rec.outTime))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [allAttendanceList]);

  const historyAttendanceList = useMemo(() => {
    return allAttendanceList.filter(rec => {
      if (!rec.approved && !rec.remark) return false;
      if (!historyMonthFilter || historyMonthFilter === 'all') return true;
      const d = parseISO(rec.date);
      const mmm = d.toLocaleString('en-US', { month: 'short' });
      const yy = d.getFullYear().toString().slice(-2);
      return `${mmm}-${yy}` === historyMonthFilter;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [allAttendanceList, historyMonthFilter]);

  const currentData = useMemo(() => {
    const list = viewMode === 'pending' ? pendingAttendanceList : historyAttendanceList;
    const page = viewMode === 'pending' ? pendingPage : historyPage;
    const start = (page - 1) * ITEMS_PER_PAGE;
    return { items: list.slice(start, start + ITEMS_PER_PAGE), total: list.length, totalPages: Math.ceil(list.length / ITEMS_PER_PAGE) };
  }, [viewMode, pendingAttendanceList, historyAttendanceList, pendingPage, historyPage]);

  const handleApproveAttendance = (rec: any) => {
    // Optimization: One-click responsiveness by making it immediate
    const approverName = verifiedUser?.fullName || "HR_ADMIN";
    
    if (rec.isVirtual) {
      addRecord('attendance', { 
        employeeId: rec.employeeId, 
        employeeName: rec.employeeName, 
        date: rec.date, 
        inDate: rec.date, 
        status: rec.displayStatus.includes('Holiday') ? 'HOLIDAY' : 'ABSENT', 
        attendanceType: 'FIELD', 
        approved: true, 
        approvedBy: approverName, 
        hours: 0, 
        inTime: null, 
        outTime: null, 
        address: 'System Generated Absence', 
        unapprovedOutDuration: 0 
      });
    } else {
      updateRecord('attendance', rec.id, { 
        approved: true, 
        approvedBy: approverName, 
        ...(rec.autoCheckout && { outTime: rec.outTime, outDate: rec.outDate, hours: 8 }) 
      });
    }
    toast({ title: "Attendance Approved" });
  };

  const handlePostAttendanceReject = () => {
    if (!selectedAttendance || !attendanceRejectReason.trim() || isProcessing) return;
    setIsProcessing(true);
    try {
      const approver = verifiedUser?.fullName || "HR_ADMIN";
      if (selectedAttendance.isVirtual) {
        addRecord('attendance', { 
          employeeId: selectedAttendance.employeeId, 
          employeeName: selectedAttendance.employeeName, 
          date: selectedAttendance.date, 
          inDate: selectedAttendance.date, 
          status: 'ABSENT', 
          attendanceType: 'FIELD', 
          remark: attendanceRejectReason, 
          approved: false, 
          unapprovedOutDuration: 0, 
          approvedBy: approver 
        });
      } else {
        updateRecord('attendance', selectedAttendance.id, { 
          approved: false, 
          remark: attendanceRejectReason, 
          status: 'ABSENT', 
          approvedBy: approver 
        });
      }
      toast({ variant: "destructive", title: "Log Rejected" });
      setIsAttendanceRejectOpen(false);
      setAttendanceRejectReason("");
    } finally { setIsProcessing(false); }
  };

  const handleManualEdit = () => {
    if (!selectedAttendance || !editData.remark.trim() || isProcessing) return;
    setIsProcessing(true);
    try {
      const inDT = new Date(`${selectedAttendance.inDate || selectedAttendance.date}T${editData.inTime}`);
      const outDT = new Date(`${selectedAttendance.outDate || selectedAttendance.date}T${editData.outTime}`);
      let hours = 0;
      if (isValid(inDT) && isValid(outDT)) {
        hours = parseFloat(((outDT.getTime() - inDT.getTime()) / (1000 * 60 * 60)).toFixed(2));
      }
      updateRecord('attendance', selectedAttendance.id, { 
        inTime: editData.inTime, 
        outTime: editData.outTime, 
        hours, 
        status: hours >= MIN_PRESENT_HOURS ? 'PRESENT' : 'ABSENT',
        remark: `Edited: ${editData.remark}`,
        editedBy: verifiedUser?.fullName || "Admin"
      });
      toast({ title: "Record Updated" });
      setIsEditModalOpen(false);
      setEditData({ inTime: "", outTime: "", remark: "" });
    } finally { setIsProcessing(false); }
  };

  const handleExportHistory = () => {
    if (historyAttendanceList.length === 0) {
      toast({ variant: "destructive", title: "No Data", description: "No records found for the selected month." });
      return;
    }
    const headers = ["Employee ID", "Name", "Date", "In Plant", "Out Plant", "In Time", "Out Time", "Work Hours", "Status", "Remark", "Approved By", "Location IN", "Location OUT"];
    const csv = [
      headers.join(","),
      ...historyAttendanceList.map(r => [
        `"${r.employeeId}"`, `"${r.employeeName}"`, `"${formatDate(r.date)}"`, `"${r.inPlant || ''}"`, `"${r.outPlant || ''}"`, `"${r.inTime || ''}"`, `"${r.outTime || ''}"`, r.hours, `"${r.displayStatus}"`, `"${r.remark || ''}"`, `"${r.approvedBy || ''}"`, `"${r.address || ''}"`, `"${r.addressOut || ''}"`
      ].join(","))
    ].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })));
    link.setAttribute("download", `Attendance_History_${historyMonthFilter}.csv`);
    link.click();
    toast({ title: "Export Success" });
  };

  function StandardPaginationFooter({ current, total, onPageChange }: any) {
    return (
      <CardFooter className="bg-slate-50 border-t flex flex-col sm:flex-row items-center justify-between p-4 gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={current === 1} onClick={() => onPageChange(current - 1)} className="font-bold h-9"><ChevronLeft className="w-4 h-4 mr-1" /> Prev</Button>
          <Button variant="outline" size="sm" disabled={current === total || total === 0} onClick={() => onPageChange(current + 1)} className="font-bold h-9">Next <ChevronRight className="w-4 h-4 ml-1" /></Button>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Page {current} of {total || 1}</span>
          <div className="flex items-center gap-2 border-l pl-4 border-slate-200">
            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Jump To</Label>
            <div className="flex gap-1">
              <Input type="number" className="w-14 h-9 text-center font-bold" value={current} onChange={(e) => { const p = parseInt(e.target.value); if (p >= 1 && p <= total) onPageChange(p); }} />
              <div className="w-9 h-9 bg-slate-900 rounded-lg flex items-center justify-center text-white"><ArrowRightCircle className="w-4 h-4" /></div>
            </div>
          </div>
        </div>
      </CardFooter>
    );
  }

  if (!isMounted) return null;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Organizational Approvals</h1>
          <div className="flex items-center gap-2 mt-1">
             <ShieldCheck className="w-4 h-4 text-emerald-600" />
             <p className="text-muted-foreground text-sm font-medium">Facility Scoped Oversight System</p>
          </div>
        </div>
        {authorizedPlants.length > 0 && (
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
        )}
      </div>

      <div className="flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Global search by Name or ID..." className="pl-10 h-10 bg-white" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
        <Tabs value={viewMode} onValueChange={setViewMode} className="w-full md:w-auto"><TabsList className="grid w-full grid-cols-2 bg-slate-100 h-10 p-1 rounded-xl w-[240px]"><TabsTrigger value="pending" className="text-xs font-black">Pending</TabsTrigger><TabsTrigger value="history" className="text-xs font-black">History</TabsTrigger></TabsList></Tabs>
      </div>

      {viewMode === 'history' && (
        <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
           <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <Label className="text-[10px] font-black uppercase text-slate-400">Analysis Month</Label>
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
           <Button onClick={handleExportHistory} variant="outline" className="h-10 font-bold border-emerald-200 text-emerald-700 hover:bg-emerald-50 gap-2 px-6">
              <FileSpreadsheet className="w-4 h-4" /> Export Filtered History
           </Button>
        </div>
      )}

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <ScrollArea className="w-full">
            <Table className="min-w-[2400px]">
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500 py-4 px-6">Employee/ID</TableHead>
                  <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">Dept / Designation</TableHead>
                  <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">In Plant</TableHead>
                  <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">Out Plant</TableHead>
                  <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">In Date & Time</TableHead>
                  <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">Out Date / Time</TableHead>
                  <TableHead className="font-bold text-[11px] uppercase tracking-widest text-center">Out Hour</TableHead>
                  <TableHead className="font-bold text-[11px] uppercase tracking-widest text-center">Work Hour</TableHead>
                  <TableHead className="font-bold text-[11px] uppercase tracking-widest text-center">Status</TableHead>
                  <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">Remark</TableHead>
                  {viewMode === 'history' && <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">Approved By</TableHead>}
                  <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">IN / Out Location</TableHead>
                  <TableHead className="text-right font-bold text-[11px] uppercase tracking-widest text-slate-500 pr-6">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentData.items.length === 0 ? (
                  <TableRow><TableCell colSpan={viewMode === 'history' ? 13 : 12} className="text-center py-20 text-muted-foreground font-bold italic">No records matching your criteria.</TableCell></TableRow>
                ) : (
                  currentData.items.map((rec: any) => (
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
                          <span className="text-[10px] text-muted-foreground uppercase font-medium">{rec.desig || rec.designation}</span>
                        </div>
                      </TableCell>
                      <TableCell><span className="text-xs font-bold text-slate-700">{rec.inPlant || "--"}</span></TableCell>
                      <TableCell><span className="text-xs font-bold text-slate-700">{rec.outPlant || "--"}</span></TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-slate-400 uppercase">{formatDate(rec.inDate || rec.date)}</span>
                          <span className="text-xs font-mono font-bold">{rec.inTime || "--:--"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-slate-400 uppercase">{formatDate(rec.outDate || rec.date)}</span>
                          <span className={cn("text-xs font-mono font-bold", rec.autoCheckout && "text-rose-600")}>{rec.outTime || "--:--"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center"><span className="text-xs font-mono font-bold text-rose-600">{formatMinutesToHHMM(rec.unapprovedOutDuration || 0)}</span></TableCell>
                      <TableCell className="text-center"><Badge variant="outline" className={cn("font-black text-xs px-3", getWorkingHoursColor(rec.hours))}>{formatHoursToHHMM(rec.hours)}</Badge></TableCell>
                      <TableCell className="text-center">
                        <Badge className={cn(
                          "text-[9px] font-black uppercase px-3", 
                          (rec.displayStatus?.includes("Present") && !rec.displayStatus?.includes("Absent")) ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"
                        )}>
                          {rec.displayStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 max-w-[200px]">
                           <MessageSquare className="w-3 h-3 text-slate-400 shrink-0" />
                           <span className="text-[10px] font-medium text-slate-500 italic truncate block" title={rec.remark || "No remark provided"}>
                              {rec.remark || "--"}
                           </span>
                        </div>
                      </TableCell>
                      {viewMode === 'history' && (
                        <TableCell>
                           <div className="flex items-center gap-1.5">
                              <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">{rec.approvedBy || "--"}</span>
                           </div>
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex flex-col max-w-[400px]">
                          <span className="text-[10px] font-bold text-slate-500 truncate" title={rec.address}><MapPin className="w-2.5 h-2.5 inline mr-1" />{rec.address || "N/A"}</span>
                          <span className="text-[10px] font-bold text-slate-400 truncate" title={rec.addressOut}><Navigation className="w-2.5 h-2.5 inline mr-1" />{rec.addressOut || "N/A"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex justify-end gap-1">
                          {viewMode === 'pending' ? (
                            <>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500" onClick={() => { setSelectedAttendance(rec); setEditData({ inTime: rec.inTime || "", outTime: rec.outTime || "", remark: "" }); setIsEditModalOpen(true); }}><Pencil className="w-3.5 h-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600" onClick={() => { setSelectedAttendance(rec); setIsAttendanceRejectOpen(true); }}><XCircle className="w-3.5 h-3.5" /></Button>
                              <Button size="sm" className="h-8 font-black text-[10px] uppercase bg-emerald-600" onClick={() => handleApproveAttendance(rec)}>Approve</Button>
                            </>
                          ) : (
                            <Badge variant="outline" className="text-[9px] font-black uppercase text-slate-400">Finalized</Badge>
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
        <StandardPaginationFooter current={viewMode === 'pending' ? pendingPage : historyPage} total={currentData.totalPages} onPageChange={viewMode === 'pending' ? setPendingPage : setHistoryPage} />
      </Card>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
             <DialogTitle className="flex items-center gap-2"><Pencil className="w-5 h-5 text-primary" /> Edit Shift Boundary</DialogTitle>
             <p className="text-[10px] text-primary font-black uppercase mt-2">{selectedAttendance?.employeeName} • {formatDate(selectedAttendance?.date)}</p>
          </DialogHeader>
          <div className="p-8 space-y-6">
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-500">IN Time</Label><Input type="time" value={editData.inTime} onChange={(e) => setEditData({...editData, inTime: e.target.value})} className="h-12 font-bold" /></div>
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-500">OUT Time</Label><Input type="time" value={editData.outTime} onChange={(e) => setEditData({...editData, outTime: e.target.value})} className="h-12 font-bold" /></div>
             </div>
             <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-500">Audit Remark * (Mandatory)</Label><Textarea placeholder="Reason for manual adjustment..." value={editData.remark} onChange={(e) => setEditData({...editData, remark: e.target.value})} className="min-h-[100px] bg-slate-50" /></div>
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t gap-3 flex-row">
             <Button variant="ghost" onClick={() => setIsEditModalOpen(false)} className="flex-1 rounded-xl font-bold">Cancel</Button>
             <Button className="flex-1 bg-primary font-black rounded-xl" onClick={handleManualEdit} disabled={!editData.remark.trim() || isProcessing}>Save Adjustment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
