
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
  Home,
  Navigation,
  Info,
  FileSpreadsheet,
  Download,
  CalendarDays,
  UserCheck,
  FileText
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ATTENDANCE_RULES } from "@/lib/constants";
import { useData } from "@/context/data-context";
import { AttendanceRecord, LeaveRequest } from "@/lib/types";
import { differenceInDays, parseISO, format } from "date-fns";

export default function ApprovalsPage() {
  const { attendanceRecords, leaveRequests, updateRecord, addRecord } = useData();
  const [isMounted, setIsMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("attendance");
  const [subTab, setSubTab] = useState("pending");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 20;

  // Dialog States
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [isVerifyDialogOpen, setIsVerifyDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [editTimes, setEditTimes] = useState({ in: "", out: "" });
  const [rejectRemark, setRejectRemark] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Leave Dialog States
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);
  const [isLeaveApproveOpen, setIsLeaveApproveOpen] = useState(false);
  const [isLeaveRejectOpen, setIsLeaveRejectOpen] = useState(false);
  const [leaveEditDates, setLeaveEditDates] = useState({ from: "", to: "" });
  const [leaveRejectReason, setLeaveRejectReason] = useState("");

  const { toast } = useToast();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const filteredAttendance = useMemo(() => {
    const sorted = [...(attendanceRecords || [])].sort((a, b) => b.date.localeCompare(a.date));
    return sorted.filter(rec => {
      const name = (rec.employeeName || "").toLowerCase();
      const id = (rec.employeeId || "").toLowerCase();
      const matchesSearch = name.includes(searchTerm.toLowerCase()) || id.includes(searchTerm.toLowerCase());
      if (subTab === "pending") return matchesSearch && !rec.approved && (!rec.remark);
      return matchesSearch && rec.approved;
    });
  }, [attendanceRecords, searchTerm, subTab]);

  const filteredLeaves = useMemo(() => {
    const sorted = [...(leaveRequests || [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return sorted.filter(l => {
      const name = (l.employeeName || "").toLowerCase();
      const id = (l.employeeId || "").toLowerCase();
      const matchesSearch = name.includes(searchTerm.toLowerCase()) || id.includes(searchTerm.toLowerCase());
      if (subTab === "pending") return matchesSearch && l.status === 'UNDER_PROCESS';
      return matchesSearch && l.status !== 'UNDER_PROCESS';
    });
  }, [leaveRequests, searchTerm, subTab]);

  const handleApproveAttendance = (id: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      updateRecord('attendance', id, { approved: true, remark: "" });
      toast({ title: "Approved" });
    } finally { setIsProcessing(false); }
  };

  // Leave Logic
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
      toast({ title: "Leave Approved", description: `Duration updated to ${days} day(s).` });
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Organizational Approvals</h1>
          <p className="text-muted-foreground">Verify attendance logs and employee leave requests.</p>
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
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSubTab("pending"); }} className="w-full md:w-auto">
          <TabsList className="grid w-full grid-cols-2 bg-slate-100">
            <TabsTrigger value="attendance" className="font-bold gap-2"><UserCheck className="w-4 h-4" /> Attendance</TabsTrigger>
            <TabsTrigger value="leave" className="font-bold gap-2"><CalendarDays className="w-4 h-4" /> Leave Request</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex justify-end">
        <Tabs value={subTab} onValueChange={setSubTab} className="w-full md:w-auto">
          <TabsList className="grid w-full grid-cols-2 h-9">
            <TabsTrigger value="pending" className="text-xs">Pending</TabsTrigger>
            <TabsTrigger value="approved" className="text-xs">History</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {activeTab === 'attendance' ? (
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-bold">Employee</TableHead>
                  <TableHead className="font-bold">Date</TableHead>
                  <TableHead className="font-bold">IN / OUT</TableHead>
                  <TableHead className="font-bold text-center">Hours</TableHead>
                  <TableHead className="font-bold">Status</TableHead>
                  <TableHead className="text-right font-bold pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAttendance.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No records found.</TableCell></TableRow>
                ) : (
                  filteredAttendance.map((rec) => (
                    <TableRow key={rec.id} className="hover:bg-slate-50/50">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold uppercase">{rec.employeeName}</span>
                          <span className="text-xs font-mono text-primary">{rec.employeeId}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm font-medium">{rec.date}</TableCell>
                      <TableCell>
                        <span className="font-mono text-xs font-bold text-primary">{rec.inTime || "--:--"}</span>
                        <span className="mx-2 text-slate-300">/</span>
                        <span className="font-mono text-xs font-bold text-rose-500">{rec.outTime || "--:--"}</span>
                      </TableCell>
                      <TableCell className="text-center font-bold text-xs">{rec.hours}h</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-[9px] font-black uppercase px-3 py-0.5", rec.approved ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600")}>
                          {rec.approved ? "Approved" : "Pending"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        {subTab === 'pending' && (
                          <div className="flex justify-end gap-2">
                             <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-8 font-bold" onClick={() => handleApproveAttendance(rec.id)} disabled={isProcessing}>Approve</Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-bold">Employee Name / ID</TableHead>
                  <TableHead className="font-bold">Dept / Designation</TableHead>
                  <TableHead className="font-bold">From Date</TableHead>
                  <TableHead className="font-bold">To Date</TableHead>
                  <TableHead className="font-bold text-center">Days</TableHead>
                  <TableHead className="text-right font-bold pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeaves.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No leave applications.</TableCell></TableRow>
                ) : (
                  filteredLeaves.map((l) => (
                    <TableRow key={l.id} className="hover:bg-slate-50/50">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold uppercase">{l.employeeName}</span>
                          <span className="text-xs font-mono text-slate-400">{l.employeeId}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                         <div className="flex flex-col">
                          <span className="text-sm font-medium leading-tight">{l.department}</span>
                          <span className="text-[10px] text-muted-foreground">{l.designation}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm font-bold text-primary">{l.fromDate}</TableCell>
                      <TableCell className="text-sm font-bold text-rose-500">{l.toDate}</TableCell>
                      <TableCell className="text-center font-black text-slate-700">{l.days}</TableCell>
                      <TableCell className="text-right pr-6">
                        {l.status === 'UNDER_PROCESS' ? (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" className="h-8 font-bold border-rose-200 text-rose-600 hover:bg-rose-50" onClick={() => handleOpenLeaveReject(l)} disabled={isProcessing}>Reject</Button>
                            <Button size="sm" className="h-8 font-bold bg-primary shadow-sm" onClick={() => handleOpenLeaveApprove(l)} disabled={isProcessing}>Approve</Button>
                          </div>
                        ) : (
                          <Badge className={cn("text-[9px] font-black uppercase px-4 py-1", l.status === 'APPROVED' ? "bg-emerald-600" : "bg-rose-600")}>
                            {l.status}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
