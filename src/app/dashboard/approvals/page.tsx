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
  Download
} from "lucide-react";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ATTENDANCE_RULES } from "@/lib/constants";
import { useData } from "@/context/data-context";
import { AttendanceRecord } from "@/lib/types";
import { differenceInDays, parseISO } from "date-fns";

// Helper to calculate hours between two 24h time strings (HH:mm)
function calculateHours(inTime: string | null, outTime: string | null): number {
  if (!inTime || !outTime) return 0;
  try {
    const dummyDate = "2024-01-01 ";
    const start = new Date(dummyDate + inTime);
    const end = new Date(dummyDate + outTime);
    const diffMs = end.getTime() - start.getTime();
    if (isNaN(diffMs) || diffMs < 0) return 0;
    return parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
  } catch (e) {
    return 0;
  }
}

// Helper to determine status based on hours
function determineStatus(hours: number): 'PRESENT' | 'ABSENT' | 'HALF_DAY' {
  if (hours <= 0) return 'ABSENT';
  if (hours > ATTENDANCE_RULES.PRESENT_THRESHOLD) return 'PRESENT';
  return 'HALF_DAY';
}

export default function ApprovalsPage() {
  const { attendanceRecords, updateRecord } = useData();
  const [isMounted, setIsMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("pending");
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

  const { toast } = useToast();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const filteredRecords = useMemo(() => {
    // SORT FIRST: Latest entry first based on date and inTime
    const sorted = [...(attendanceRecords || [])].sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return (b.inTime || "").localeCompare(a.inTime || "");
    });

    return sorted.filter(rec => {
      const name = (rec.employeeName || "").toLowerCase();
      const id = (rec.employeeId || "").toLowerCase();
      const matchesSearch = name.includes(searchTerm.toLowerCase()) || id.includes(searchTerm.toLowerCase());
      
      // LOGIC:
      // 1. Pending: Not approved AND no remark (HR hasn't rejected it yet)
      // 2. Approved: Only approved records
      if (activeTab === "pending") {
        return matchesSearch && !rec.approved && (!rec.remark || rec.remark === "");
      } else {
        return matchesSearch && rec.approved;
      }
    });
  }, [attendanceRecords, searchTerm, activeTab]);

  const totalPages = Math.ceil(filteredRecords.length / rowsPerPage);
  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const handleApprove = (id: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      // CLEAR remark when approving so it moves from "Inbox" to "Approved"
      updateRecord('attendance', id, { approved: true, remark: "" });
      toast({ title: "Approved", description: "Record moved to approved list." });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestore = (id: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      updateRecord('attendance', id, { approved: false, remark: "" });
      toast({ title: "Restored", description: "Record moved back to pending list." });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEditClick = (rec: AttendanceRecord) => {
    setSelectedRecord(rec);
    setEditTimes({ in: rec.inTime || "", out: rec.outTime || "" });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!selectedRecord || isProcessing) return;
    setIsProcessing(true);
    try {
      const newHours = calculateHours(editTimes.in, editTimes.out);
      const newStatus = determineStatus(newHours);
      
      updateRecord('attendance', selectedRecord.id, { 
        inTime: editTimes.in, 
        outTime: editTimes.out, 
        hours: newHours,
        status: newStatus as any
      });
      setIsEditDialogOpen(false);
      toast({ title: "Updated", description: `Attendance updated. New Status: ${newStatus}` });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectClick = (rec: AttendanceRecord) => {
    setSelectedRecord(rec);
    setRejectRemark("");
    setIsRejectDialogOpen(true);
  };

  const handleConfirmReject = () => {
    if (!selectedRecord || isProcessing) return;
    if (!rejectRemark.trim()) {
      toast({ variant: "destructive", title: "Remark Required", description: "Please provide a reason for rejection." });
      return;
    }
    
    setIsProcessing(true);
    try {
      // By setting a remark and keeping approved: false, it disappears from "Pending" tab
      updateRecord('attendance', selectedRecord.id, { 
        remark: rejectRemark,
        rejectionCount: (selectedRecord.rejectionCount || 0) + 1,
        approved: false
      });
      setIsRejectDialogOpen(false);
      toast({ title: "Rejected", description: "Record removed from pending and sent back to employee." });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleShowVerify = (rec: AttendanceRecord) => {
    setSelectedRecord(rec);
    setIsVerifyDialogOpen(true);
  };

  const handleExportExcel = () => {
    if (filteredRecords.length === 0) {
      toast({ variant: "destructive", title: "No Data", description: "No records to export in the current selection." });
      return;
    }

    // Removed Latitude and Longitude columns as requested
    const headers = [
      "Employee Name", "Employee ID", "Date", "In Time", "Out Time", 
      "Hours", "Status", "Attendance Type", "In Location", "Out Location",
      "In Plant", "Out Plant"
    ];

    const csvRows = [
      headers.join(","),
      ...filteredRecords.map(rec => [
        `"${rec.employeeName}"`,
        `"${rec.employeeId}"`,
        `"${rec.date}"`,
        `"${rec.inTime || '--:--'}"`,
        `"${rec.outTime || '--:--'}"`,
        `"${rec.hours}"`,
        `"${rec.status}"`,
        `"${rec.attendanceType}"`,
        `"${(rec.address || '').replace(/"/g, '""')}"`,
        `"${(rec.addressOut || '').replace(/"/g, '""')}"`,
        `"${rec.inPlant || ''}"`,
        `"${rec.outPlant || ''}"`
      ].join(","))
    ];

    const blob = new Blob([csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Approved_Attendance_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({ title: "Export Success", description: "The attendance data has been exported." });
  };

  if (!isMounted) return null;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">Attendance Approvals</h1>
            <p className="text-muted-foreground">Verify and finalize employee attendance logs (24h Format).</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by Employee ID or Name..." 
              className="pl-10 h-10 bg-white"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            {activeTab === "approved" && (
              <Button 
                variant="outline" 
                className="gap-2 font-bold h-10 bg-white border-slate-200 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-all"
                onClick={handleExportExcel}
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Export Excel
              </Button>
            )}
            <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setCurrentPage(1); }} className="w-full md:w-auto">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="approved">Approved</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-bold">Employee</TableHead>
                  <TableHead className="font-bold">IN Date Time</TableHead>
                  <TableHead className="font-bold">OUT Date Time</TableHead>
                  <TableHead className="font-bold text-center">Hours</TableHead>
                  <TableHead className="font-bold">GPS</TableHead>
                  <TableHead className="font-bold">Type</TableHead>
                  <TableHead className="font-bold">Status</TableHead>
                  <TableHead className="text-right font-bold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      No records found in this category.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedRecords.map((rec) => {
                    const isOldRecord = differenceInDays(new Date(), parseISO(rec.date)) > 45;
                    
                    return (
                      <TableRow key={rec.id} className="hover:bg-slate-50/50">
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-bold">{rec.employeeName}</span>
                            <span className="text-xs font-mono text-primary">{rec.employeeId}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{rec.date}</span>
                            <span className="text-xs font-mono font-bold text-primary">{rec.inTime || "--:--"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{rec.date}</span>
                            <span className="text-xs font-mono font-bold text-rose-500">{rec.outTime || "--:--"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1 font-bold">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {rec.hours}h
                          </div>
                        </TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="secondary" 
                                size="sm" 
                                className="text-xs h-8 gap-1 bg-cyan-100 text-cyan-700 hover:bg-cyan-200"
                                onClick={() => handleShowVerify(rec)}
                              >
                                <MapPin className="w-3 h-3" />
                                Verify
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Audit GPS Coordinates</TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-tight py-0">
                            {rec.attendanceType === 'WFH' ? (
                              <div className="flex items-center gap-1">
                                <Home className="w-3 h-3" /> WFH
                              </div>
                            ) : rec.attendanceType === 'OFFICE' ? (
                              <div className="flex items-center gap-1">
                                <Building2 className="w-3 h-3" /> Office
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" /> Field
                              </div>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-[10px] uppercase font-bold px-2 py-0 h-5",
                              rec.status === 'PRESENT' ? "text-emerald-600 border-emerald-200 bg-emerald-50" :
                              rec.status === 'HALF_DAY' ? "text-amber-600 border-amber-200 bg-amber-50" :
                              "text-rose-600 border-rose-200 bg-rose-50"
                            )}
                          >
                            {(rec.status || "").replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {activeTab === "pending" ? (
                              <>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button size="sm" variant="outline" onClick={() => handleEditClick(rec)} disabled={isProcessing}>
                                      <Pencil className="w-3 h-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Edit Times</TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button size="sm" variant="outline" className="text-rose-600 hover:bg-rose-50" onClick={() => handleRejectClick(rec)} disabled={isProcessing}>
                                      <XCircle className="w-3 h-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Reject Log</TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="inline-block">
                                      <Button 
                                        size="sm" 
                                        className={cn(
                                          "bg-emerald-600 hover:bg-emerald-700",
                                          !rec.outTime && "opacity-50 cursor-not-allowed"
                                        )}
                                        onClick={() => rec.outTime && handleApprove(rec.id)} 
                                        disabled={isProcessing || !rec.outTime}
                                      >
                                        <CheckCircle2 className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>{!rec.outTime ? "Out Time Required to Approve" : "Approve Attendance"}</TooltipContent>
                                </Tooltip>
                              </>
                            ) : (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="gap-1" 
                                    onClick={() => handleRestore(rec.id)} 
                                    disabled={isProcessing || isOldRecord}
                                  >
                                    <RotateCcw className="w-3 h-3" /> Restore
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {isOldRecord 
                                    ? "Restore disabled (Older than 45 days)" 
                                    : "Move back to pending"}
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        
        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Attendance Times</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label>In Time (HH:mm)</Label>
                <Input type="time" value={editTimes.in} onChange={(e) => setEditTimes(prev => ({...prev, in: e.target.value}))} />
              </div>
              <div className="space-y-2">
                <Label>Out Time (HH:mm)</Label>
                <Input type="time" value={editTimes.out} onChange={(e) => setEditTimes(prev => ({...prev, out: e.target.value}))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveEdit} disabled={isProcessing}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reject Dialog */}
        <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Record</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Label>Rejection Remark</Label>
              <Textarea placeholder="Enter reason for rejection..." value={rejectRemark} onChange={(e) => setRejectRemark(e.target.value)} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleConfirmReject} disabled={isProcessing}>Reject Record</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* GPS Verification Dialog */}
        <Dialog open={isVerifyDialogOpen} onOpenChange={setIsVerifyDialogOpen}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-cyan-600" />
                Location Verification
              </DialogTitle>
              <DialogDescription>GPS audit for {selectedRecord?.employeeName}</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6">
              {/* Check-In Location */}
              <div className="space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase tracking-widest">
                  <Navigation className="w-3 h-3" /> Check-In
                </div>
                <div className="space-y-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground font-black uppercase">Address</Label>
                    <p className="text-sm font-bold text-slate-700">{selectedRecord?.address || "No address recorded"}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground font-black uppercase">Latitude</Label>
                      <p className="text-xs font-mono font-medium">{selectedRecord?.lat?.toFixed(6) || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground font-black uppercase">Longitude</Label>
                      <p className="text-xs font-mono font-medium">{selectedRecord?.lng?.toFixed(6) || "N/A"}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Check-Out Location */}
              <div className="space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-2 text-rose-500 font-bold text-xs uppercase tracking-widest">
                  <Navigation className="w-3 h-3" /> Check-Out
                </div>
                <div className="space-y-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground font-black uppercase">Address</Label>
                    <p className="text-sm font-bold text-slate-700">{selectedRecord?.addressOut || "No address recorded"}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground font-black uppercase">Latitude</Label>
                      <p className="text-xs font-mono font-medium">{selectedRecord?.latOut?.toFixed(6) || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground font-black uppercase">Longitude</Label>
                      <p className="text-xs font-mono font-medium">{selectedRecord?.lngOut?.toFixed(6) || "N/A"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex gap-3 items-start">
              <Info className="w-5 h-5 text-blue-500 mt-0.5" />
              <div className="text-xs text-blue-700 leading-relaxed">
                <p className="font-bold mb-1">Audit Tip</p>
                Verify that coordinates are within the expected 700m geofence radius of the detected plant ({selectedRecord?.inPlant || "Field"}).
              </div>
            </div>
            <DialogFooter>
              <Button className="w-full h-12 rounded-xl font-bold bg-slate-900" onClick={() => setIsVerifyDialogOpen(false)}>Close Audit</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
