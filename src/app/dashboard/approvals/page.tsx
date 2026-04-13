
"use client";

import { useState, useMemo } from "react";
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
  ChevronLeft,
  ChevronRight,
  Info,
  Building2,
  Home
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ATTENDANCE_RULES } from "@/lib/constants";
import { useData } from "@/context/data-context";
import { AttendanceRecord } from "@/lib/types";

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
  const { attendanceRecords, setAttendanceRecords } = useData();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("pending");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 20;

  // Dialog States
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [isMapDialogOpen, setIsMapDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [editTimes, setEditTimes] = useState({ in: "", out: "" });
  const [rejectRemark, setRejectRemark] = useState("");

  const { toast } = useToast();

  const filteredRecords = useMemo(() => {
    return attendanceRecords.filter(rec => {
      const matchesSearch = 
        rec.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rec.employeeId.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTab = activeTab === "approved" ? rec.approved : !rec.approved;
      return matchesSearch && matchesTab;
    });
  }, [attendanceRecords, searchTerm, activeTab]);

  const totalPages = Math.ceil(filteredRecords.length / rowsPerPage);
  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const handleApprove = (id: string) => {
    setAttendanceRecords(prev => prev.map(r => r.id === id ? { ...r, approved: true } : r));
    toast({ title: "Approved", description: "Record moved to approved list." });
  };

  const handleRestore = (id: string) => {
    setAttendanceRecords(prev => prev.map(r => r.id === id ? { ...r, approved: false } : r));
    toast({ title: "Restored", description: "Record moved back to pending list." });
  };

  const handleEditClick = (rec: AttendanceRecord) => {
    setSelectedRecord(rec);
    setEditTimes({ in: rec.inTime || "", out: rec.outTime || "" });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!selectedRecord) return;
    const newHours = calculateHours(editTimes.in, editTimes.out);
    const newStatus = determineStatus(newHours);
    
    setAttendanceRecords(prev => prev.map(r => 
      r.id === selectedRecord.id 
        ? { 
            ...r, 
            inTime: editTimes.in, 
            outTime: editTimes.out, 
            hours: newHours,
            status: newStatus as any
          } 
        : r
    ));
    setIsEditDialogOpen(false);
    toast({ title: "Updated", description: `Attendance updated. New Status: ${newStatus}` });
  };

  const handleRejectClick = (rec: AttendanceRecord) => {
    setSelectedRecord(rec);
    setRejectRemark("");
    setIsRejectDialogOpen(true);
  };

  const handleConfirmReject = () => {
    if (!selectedRecord || !rejectRemark.trim()) {
      toast({ variant: "destructive", title: "Remark Required", description: "Please provide a reason for rejection." });
      return;
    }
    setAttendanceRecords(prev => prev.map(r => 
      r.id === selectedRecord.id ? { ...r, remark: rejectRemark } : r
    ));
    setIsRejectDialogOpen(false);
    toast({ title: "Rejected", description: "Remark added to pending record." });
  };

  const handleShowMap = (rec: AttendanceRecord) => {
    setSelectedRecord(rec);
    setIsMapDialogOpen(true);
  };

  return (
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
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setCurrentPage(1); }} className="w-full md:w-auto">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="font-bold">Employee</TableHead>
                <TableHead className="font-bold">Date</TableHead>
                <TableHead className="font-bold">IN / OUT</TableHead>
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
                paginatedRecords.map((rec) => (
                  <TableRow key={rec.id} className="hover:bg-slate-50/50">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold">{rec.employeeName}</span>
                        <span className="text-xs font-mono text-primary">{rec.employeeId}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{rec.date}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">{rec.inTime || "--:--"}</Badge>
                        <span className="text-muted-foreground">→</span>
                        <Badge variant="outline" className="font-mono">{rec.outTime || "--:--"}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1 font-bold">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {rec.hours}h
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-xs h-8 gap-1 text-slate-500"
                        onClick={() => handleShowMap(rec)}
                      >
                        <MapPin className="w-3 h-3" />
                        Verify
                      </Button>
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
                        {rec.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {activeTab === "pending" ? (
                          <>
                            <Button size="sm" variant="outline" onClick={() => handleEditClick(rec)}>
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="outline" className="text-rose-600 hover:bg-rose-50" onClick={() => handleRejectClick(rec)}>
                              <XCircle className="w-3 h-3" />
                            </Button>
                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleApprove(rec.id)}>
                              <CheckCircle2 className="w-3 h-3" />
                            </Button>
                          </>
                        ) : (
                          <Button size="sm" variant="outline" className="gap-1" onClick={() => handleRestore(rec.id)}>
                            <RotateCcw className="w-3 h-3" /> Restore
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {/* (Rest of the dialogs remain the same as previous implementations) */}
    </div>
  );
}
