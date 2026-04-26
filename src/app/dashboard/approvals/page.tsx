
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
  FileCheck
} from "lucide-react";
import { cn, formatDate, getWorkingHoursColor, formatMinutesToHHMM, formatHoursToHHMM } from "@/lib/utils";
import { useData } from "@/context/data-context";
import { parseISO, format, addHours, isSunday } from "date-fns";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

const ITEMS_PER_PAGE = 15;
const PROJECT_START_DATE_STR = "2026-04-01";

export default function ApprovalsPage() {
  const { attendanceRecords, leaveRequests, employees, updateRecord, addRecord, verifiedUser, holidays, plants } = useData();
  const [isMounted, setIsMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("pending");
  const [pendingType, setPendingType] = useState("attendance");
  const [historyType, setHistoryType] = useState("attendance");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedPlantFilter, setSelectedPlantFilter] = useState<string>("ALL_ASSIGNED");

  // Attendance Reject/Edit/Restore States
  const [selectedAttendance, setSelectedAttendance] = useState<any>(null);
  const [isAttendanceRejectOpen, setIsAttendanceRejectOpen] = useState(false);
  const [attendanceRejectReason, setAttendanceRejectReason] = useState("");
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);
  const [attendanceToRestore, setAttendanceToRestore] = useState<any>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [viewMode, pendingType, historyType, selectedPlantFilter]);

  // PLANT-WISE ACCESS LOGIC
  const userAssignedPlantIds = useMemo(() => {
    if (!verifiedUser || verifiedUser.role === 'SUPER_ADMIN') return null;
    return verifiedUser.plantIds || [];
  }, [verifiedUser]);

  const authorizedPlants = useMemo(() => {
    if (!userAssignedPlantIds) return plants;
    return plants.filter(p => userAssignedPlantIds.includes(p.id));
  }, [userAssignedPlantIds, plants]);

  const authorizedPlantNames = useMemo(() => {
    return authorizedPlants.map(p => p.name);
  }, [authorizedPlants]);

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

  const filteredAttendance = useMemo(() => {
    if (!isMounted) return [];
    const now = new Date();
    const todayStr = format(new Date(), "yyyy-MM-dd");

    // 1. Process Actual Logs
    const actual = (attendanceRecords || []).map(rec => {
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

    // 2. Generate Missing Records (Absent)
    const missing: any[] = [];
    if (todayStr >= PROJECT_START_DATE_STR) {
      employees.filter(e => e.active).forEach(emp => {
        const hasRecord = attendanceRecords.some(r => r.employeeId === emp.employeeId && r.date === todayStr);
        if (!hasRecord) {
          const displayStatus = getPriorityStatus(todayStr, null);
          missing.push({ 
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

    const all = [...actual, ...missing].filter(rec => rec.date >= PROJECT_START_DATE_STR);

    // 3. Apply Security Scoping (Plant-wise)
    return all.filter(rec => {
      // Super admin sees everything
      if (!userAssignedPlantIds) return true;

      // For actual logs, check the IN plant name
      if (!rec.isVirtual) {
        return authorizedPlantNames.includes(rec.inPlant);
      }

      // For virtual records (Absent), check if any of the employee's registered plants match user's access
      const emp = employees.find(e => e.employeeId === rec.employeeId);
      const empPlantIds = emp?.unitIds || [];
      return empPlantIds.some(id => userAssignedPlantIds.includes(id));
    });
  }, [attendanceRecords, employees, isMounted, holidays, userAssignedPlantIds, authorizedPlantNames]);

  // Further filter for the Search and UI Plant Filter
  const listAttendance = useMemo(() => {
    let list = filteredAttendance;

    if (selectedPlantFilter !== "ALL_ASSIGNED") {
      list = list.filter(rec => {
        if (!rec.isVirtual) return rec.inPlant === selectedPlantFilter;
        const emp = employees.find(e => e.employeeId === rec.employeeId);
        const targetPlant = plants.find(p => p.name === selectedPlantFilter);
        return emp?.unitIds?.includes(targetPlant?.id || "");
      });
    }

    const search = searchTerm.toLowerCase();
    return list.filter(rec => 
      (rec.employeeName || "").toLowerCase().includes(search) || 
      (rec.employeeId || "").toLowerCase().includes(search)
    );
  }, [filteredAttendance, searchTerm, selectedPlantFilter, employees, plants]);

  const pendingAttendanceList = useMemo(() => {
    return listAttendance.filter(rec => !rec.approved && !rec.remark).sort((a, b) => b.date.localeCompare(a.date));
  }, [listAttendance]);

  const historyAttendanceList = useMemo(() => {
    return listAttendance.filter(rec => rec.approved || !!rec.remark).sort((a, b) => b.date.localeCompare(a.date));
  }, [listAttendance]);

  // LEAVE APPROVAL ACCESS
  const filteredLeaveRequests = useMemo(() => {
    const list = userAssignedPlantIds 
      ? leaveRequests.filter(req => {
          const emp = employees.find(e => e.employeeId === req.employeeId);
          const empPlantIds = emp?.unitIds || [];
          return empPlantIds.some(id => userAssignedPlantIds.includes(id));
        })
      : leaveRequests;

    const search = searchTerm.toLowerCase();
    return list.filter(l => 
      (l.employeeName || "").toLowerCase().includes(search) || 
      (l.employeeId || "").toLowerCase().includes(search)
    );
  }, [leaveRequests, employees, userAssignedPlantIds, searchTerm]);

  const currentData = useMemo(() => {
    const isLeave = (viewMode === 'pending' ? pendingType : historyType) === 'leave';
    const list = viewMode === 'pending' 
      ? (pendingType === 'attendance' ? pendingAttendanceList : filteredLeaveRequests.filter(l => l.status === 'UNDER_PROCESS')) 
      : (historyType === 'attendance' ? historyAttendanceList : filteredLeaveRequests.filter(l => l.status !== 'UNDER_PROCESS'));
    
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return { 
      items: list.slice(start, start + ITEMS_PER_PAGE), 
      total: list.length, 
      totalPages: Math.ceil(list.length / ITEMS_PER_PAGE),
      isLeaveView: isLeave
    };
  }, [viewMode, pendingType, historyType, pendingAttendanceList, historyAttendanceList, filteredLeaveRequests, currentPage]);

  const handleApproveAttendance = (rec: any) => {
    if (isProcessing) return;
    
    // Final Security Validation
    if (userAssignedPlantIds && !rec.isVirtual && !authorizedPlantNames.includes(rec.inPlant)) {
      toast({ variant: "destructive", title: "Unauthorized", description: "Plant Access Denied." });
      return;
    }

    setIsProcessing(true);
    try {
      const approverName = verifiedUser?.fullName || "HR_ADMIN";
      if (rec.isVirtual) {
        addRecord('attendance', { employeeId: rec.employeeId, employeeName: rec.employeeName, date: rec.date, inDate: rec.date, status: 'ABSENT', attendanceType: 'FIELD', approved: true, approvedBy: approverName, hours: 0, inTime: null, outTime: null, address: 'System Generated Absence', unapprovedOutDuration: 0 });
      } else {
        updateRecord('attendance', rec.id, { approved: true, remark: "", approvedBy: approverName, ...(rec.autoCheckout && { outTime: rec.outTime, outDate: rec.outDate, hours: 8, status: 'PRESENT' }) });
      }
      toast({ title: "Attendance Approved" });
    } finally { setIsProcessing(false); }
  };

  const handlePostAttendanceReject = () => {
    if (!selectedAttendance || !attendanceRejectReason.trim() || isProcessing) return;
    
    // Final Security Validation
    if (userAssignedPlantIds && !selectedAttendance.isVirtual && !authorizedPlantNames.includes(selectedAttendance.inPlant)) {
      toast({ variant: "destructive", title: "Unauthorized", description: "Plant Access Denied." });
      return;
    }

    setIsProcessing(true);
    try {
      const approver = verifiedUser?.fullName || "HR_ADMIN";
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

  const handleApproveLeave = (leave: any) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      updateRecord('leaveRequests', leave.id, { status: 'APPROVED', approvedBy: verifiedUser?.fullName || "Manager" });
      toast({ title: "Leave Request Approved" });
    } finally { setIsProcessing(false); }
  };

  const handleRejectLeave = (leave: any) => {
    const reason = prompt("Enter rejection reason:");
    if (!reason) return;

    setIsProcessing(true);
    try {
      updateRecord('leaveRequests', leave.id, { status: 'REJECTED', rejectReason: reason, approvedBy: verifiedUser?.fullName || "Manager" });
      toast({ variant: "destructive", title: "Leave Request Rejected" });
    } finally { setIsProcessing(false); }
  };

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
        {userAssignedPlantIds && authorizedPlants.length > 0 && (
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
            {currentData.isLeaveView ? (
              <ScrollArea className="w-full">
                <Table className="min-w-[1500px]">
                  <TableHeader className="bg-slate-50/50">
                    <TableRow>
                      <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500 py-4 px-6">Employee / ID</TableHead>
                      <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">Dept / Designation</TableHead>
                      <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">Leave Type</TableHead>
                      <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">From Date</TableHead>
                      <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">To Date</TableHead>
                      <TableHead className="font-bold text-[11px] uppercase tracking-widest text-center">Leave Days</TableHead>
                      <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">Approved By</TableHead>
                      <TableHead className="font-bold text-[11px] uppercase tracking-widest text-center">Status</TableHead>
                      <TableHead className="text-right font-bold text-[11px] uppercase tracking-widest text-slate-500 pr-6">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentData.items.map((l: any) => (
                      <TableRow key={l.id} className="hover:bg-slate-50/50 transition-colors">
                        <TableCell className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold uppercase text-slate-700 text-sm">{l.employeeName}</span>
                            <span className="text-[10px] font-mono font-black text-primary uppercase">{l.employeeId}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                           <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-700">{l.department}</span>
                              <span className="text-[9px] text-muted-foreground uppercase font-medium">{l.designation}</span>
                           </div>
                        </TableCell>
                        <TableCell>
                           <Badge variant="outline" className={cn("text-[9px] font-black uppercase px-2.5", l.leaveType === 'DAYS' ? "bg-blue-50 text-blue-700" : "bg-orange-50 text-orange-700")}>
                             {l.leaveType === 'DAYS' ? 'Full Days' : 'Half Day'}
                           </Badge>
                        </TableCell>
                        <TableCell><span className="text-xs font-bold text-slate-600">{formatDate(l.fromDate)}</span></TableCell>
                        <TableCell><span className="text-xs font-bold text-slate-600">{formatDate(l.toDate)}</span></TableCell>
                        <TableCell className="text-center">
                           <Badge variant="secondary" className="font-black text-xs px-3">{l.days}</Badge>
                        </TableCell>
                        <TableCell>
                           <div className="flex items-center gap-1.5">
                              <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">{l.approvedBy || "--"}</span>
                           </div>
                        </TableCell>
                        <TableCell className="text-center">
                           <Badge className={cn("text-[9px] font-black uppercase px-2.5", l.status === 'APPROVED' ? "bg-emerald-100 text-emerald-700" : l.status === 'REJECTED' ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700")}>
                              {l.status?.replace('_', ' ')}
                           </Badge>
                        </TableCell>
                        <TableCell className="text-right pr-6">
                           <div className="flex justify-end gap-2">
                              {viewMode === 'pending' ? (
                                <>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600" onClick={() => handleRejectLeave(l)}><XCircle className="w-3.5 h-3.5" /></Button>
                                  <Button size="sm" className="h-8 font-black text-[10px] uppercase bg-emerald-600" onClick={() => handleApproveLeave(l)}>Approve</Button>
                                </>
                              ) : (
                                <Badge variant="outline" className="text-[9px] font-black uppercase text-slate-400">Finalized</Badge>
                              )}
                           </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            ) : (
              <ScrollArea className="w-full">
                <Table className="min-w-[2000px]">
                  <TableHeader className="bg-slate-50/50">
                    <TableRow>
                      <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500 py-4 px-6">Employee/ID</TableHead>
                      <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">Dept / Designation</TableHead>
                      <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">In Plant</TableHead>
                      <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">Out Plant</TableHead>
                      <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">Date/Time</TableHead>
                      <TableHead className="font-bold text-[11px] uppercase tracking-widest text-center">Out Hour</TableHead>
                      <TableHead className="font-bold text-[11px] uppercase tracking-widest text-center">Work Hour</TableHead>
                      <TableHead className="font-bold text-[11px] uppercase tracking-widest text-center">Status</TableHead>
                      <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">Approved By</TableHead>
                      <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">IN / Out Location</TableHead>
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
                            <span className="text-[10px] text-muted-foreground uppercase font-medium">{rec.desig || rec.designation}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-bold text-slate-700">{rec.inPlant || "--"}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-bold text-slate-700">{rec.outPlant || "--"}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-400 uppercase">{formatDate(rec.inDate || rec.date)}</span>
                            <span className="text-xs font-mono font-bold">{rec.inTime || "--:--"} - {rec.outTime || "--:--"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-xs font-mono font-bold text-rose-600">{formatMinutesToHHMM(rec.unapprovedOutDuration || 0)}</span>
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
                        <TableCell>
                           <div className="flex items-center gap-1.5">
                              <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">{rec.approvedBy || "--"}</span>
                           </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col max-w-[300px]">
                            <span className="text-[10px] font-bold text-slate-500 truncate" title={rec.address}><MapPin className="w-2.5 h-2.5 inline mr-1" />{rec.address || "N/A"}</span>
                            <span className="text-[10px] font-bold text-slate-400 truncate" title={rec.addressOut}><Navigation className="w-2.5 h-2.5 inline mr-1" />{rec.addressOut || "N/A"}</span>
                          </div>
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
            )}
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
