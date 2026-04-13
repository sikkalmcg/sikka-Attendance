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

// Helper to calculate hours between two time strings
function calculateHours(inTime: string | null, outTime: string | null): number {
  if (!inTime || !outTime) return 0;
  try {
    const dummyDate = "2024-01-01 ";
    const start = new Date(dummyDate + inTime.replace(/(AM|PM)/, " $1"));
    const end = new Date(dummyDate + outTime.replace(/(AM|PM)/, " $1"));
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
  // Rule: If employee Hours under 2:00 then Half day
  if (hours < 2.0) return 'HALF_DAY';
  if (hours < ATTENDANCE_RULES.PRESENT_THRESHOLD) return 'HALF_DAY';
  return 'PRESENT';
}

interface AttendanceRecordWithMeta {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  inTime: string | null;
  outTime: string | null;
  hours: number;
  status: 'PRESENT' | 'ABSENT' | 'HALF_DAY';
  attendanceType: 'OFFICE' | 'WFH' | 'FIELD';
  inLat: number;
  inLng: number;
  inAddress: string;
  outLat: number;
  outLng: number;
  outAddress: string;
  approved: boolean;
  remark?: string;
}

const INITIAL_MOCK_DATA: AttendanceRecordWithMeta[] = Array.from({ length: 45 }).map((_, i) => {
  const inTime = i % 15 === 0 ? null : "09:00 AM";
  const outTime = i % 15 === 0 ? null : (i % 8 === 0 ? "10:30 AM" : "06:00 PM"); // i % 8 creates some < 2hr logs
  const hours = calculateHours(inTime, outTime);
  const status = determineStatus(hours);
  
  return {
    id: `rec-${i}`,
    employeeId: `S100${10 + i}`,
    employeeName: ["Ravi Kumar", "Anita Singh", "Deepak Verma", "Sunil Sharma", "Meena Devi"][i % 5],
    date: "2024-08-20",
    inTime,
    outTime,
    hours,
    status,
    attendanceType: i % 4 === 0 ? 'WFH' : 'OFFICE',
    inLat: 28.5355 + (Math.random() - 0.5) * 0.01,
    inLng: 77.2639 + (Math.random() - 0.5) * 0.01,
    inAddress: "Okhla Industrial Estate, Phase III, New Delhi",
    outLat: 28.5355 + (Math.random() - 0.5) * 0.01,
    outLng: 77.2639 + (Math.random() - 0.5) * 0.01,
    outAddress: "Okhla Industrial Estate, Phase III, New Delhi",
    approved: i < 15,
    remark: i === 20 ? "Late entry due to rain" : ""
  };
});

export default function ApprovalsPage() {
  const [records, setRecords] = useState<AttendanceRecordWithMeta[]>(INITIAL_MOCK_DATA);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("pending");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 20;

  // Dialog States
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [isMapDialogOpen, setIsMapDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecordWithMeta | null>(null);
  const [editTimes, setEditTimes] = useState({ in: "", out: "" });
  const [rejectRemark, setRejectRemark] = useState("");

  const { toast } = useToast();

  const filteredRecords = useMemo(() => {
    return records.filter(rec => {
      const matchesSearch = 
        rec.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rec.employeeId.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTab = activeTab === "approved" ? rec.approved : !rec.approved;
      return matchesSearch && matchesTab;
    });
  }, [records, searchTerm, activeTab]);

  const totalPages = Math.ceil(filteredRecords.length / rowsPerPage);
  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const handleApprove = (id: string) => {
    setRecords(prev => prev.map(r => r.id === id ? { ...r, approved: true } : r));
    toast({ title: "Approved", description: "Record moved to approved list." });
  };

  const handleRestore = (id: string) => {
    setRecords(prev => prev.map(r => r.id === id ? { ...r, approved: false } : r));
    toast({ title: "Restored", description: "Record moved back to pending list." });
  };

  const handleEditClick = (rec: AttendanceRecordWithMeta) => {
    setSelectedRecord(rec);
    setEditTimes({ in: rec.inTime || "", out: rec.outTime || "" });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!selectedRecord) return;
    const newHours = calculateHours(editTimes.in, editTimes.out);
    const newStatus = determineStatus(newHours);
    
    setRecords(prev => prev.map(r => 
      r.id === selectedRecord.id 
        ? { 
            ...r, 
            inTime: editTimes.in, 
            outTime: editTimes.out, 
            hours: newHours,
            status: newStatus 
          } 
        : r
    ));
    setIsEditDialogOpen(false);
    toast({ title: "Updated", description: `Attendance updated. New Status: ${newStatus}` });
  };

  const handleRejectClick = (rec: AttendanceRecordWithMeta) => {
    setSelectedRecord(rec);
    setRejectRemark("");
    setIsRejectDialogOpen(true);
  };

  const handleConfirmReject = () => {
    if (!selectedRecord || !rejectRemark.trim()) {
      toast({ variant: "destructive", title: "Remark Required", description: "Please provide a reason for rejection." });
      return;
    }
    setRecords(prev => prev.map(r => 
      r.id === selectedRecord.id ? { ...r, remark: rejectRemark } : r
    ));
    setIsRejectDialogOpen(false);
    toast({ title: "Rejected", description: "Remark added to pending record." });
  };

  const handleShowMap = (rec: AttendanceRecordWithMeta) => {
    setSelectedRecord(rec);
    setIsMapDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Attendance Approvals</h1>
          <p className="text-muted-foreground">Verify and finalize employee attendance logs.</p>
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <p className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * rowsPerPage + 1} to {Math.min(currentPage * rowsPerPage, filteredRecords.length)} of {filteredRecords.length}
          </p>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="icon" 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">Page {currentPage} of {totalPages}</span>
            <Button 
              variant="outline" 
              size="icon" 
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => prev + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Attendance Times</DialogTitle>
            <DialogDescription>Adjust IN and OUT times for {selectedRecord?.employeeName}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="inTime">IN Time</Label>
                <Input 
                  id="inTime" 
                  value={editTimes.in} 
                  onChange={(e) => setEditTimes(prev => ({ ...prev, in: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="outTime">OUT Time</Label>
                <Input 
                  id="outTime" 
                  value={editTimes.out} 
                  onChange={(e) => setEditTimes(prev => ({ ...prev, out: e.target.value }))}
                />
              </div>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-500" />
                <p className="text-xs text-slate-600 font-bold">Automatic Classification Rules:</p>
              </div>
              <ul className="text-[10px] text-slate-500 list-disc pl-5 space-y-1">
                <li>Hours &lt; 2:00 → <strong>Half Day</strong></li>
                <li>Hours between 2:00 and 4:30 → <strong>Half Day</strong></li>
                <li>Hours &gt; 4:30 → <strong>Present</strong></li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-rose-600">Reject Log</DialogTitle>
            <DialogDescription>Please provide a mandatory remark for why this record is being rejected.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Label>Rejection Remark</Label>
            <Textarea 
              placeholder="e.g., Incorrect punch out time, GPS mismatch..." 
              value={rejectRemark}
              onChange={(e) => setRejectRemark(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleConfirmReject}>Confirm Rejection</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Map/GPS Dialog */}
      <Dialog open={isMapDialogOpen} onOpenChange={setIsMapDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>GPS Verification Details</DialogTitle>
            <DialogDescription>Full location history for {selectedRecord?.employeeName} on {selectedRecord?.date}.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            <div className="space-y-4 border rounded-xl p-4 bg-slate-50/50">
              <div className="flex items-center gap-2 text-primary">
                <CheckCircle2 className="w-4 h-4" />
                <h4 className="font-bold text-sm uppercase tracking-wider">Punch IN Location</h4>
              </div>
              <div className="aspect-square bg-slate-100 rounded-lg flex flex-col items-center justify-center border border-slate-200">
                <MapPin className="w-8 h-8 text-primary/40 mb-2" />
                <p className="text-[10px] font-mono text-slate-500">{selectedRecord?.inLat.toFixed(6)}, {selectedRecord?.inLng.toFixed(6)}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground font-bold">Address</Label>
                <p className="text-xs font-medium leading-relaxed">{selectedRecord?.inAddress}</p>
              </div>
            </div>

            <div className="space-y-4 border rounded-xl p-4 bg-slate-50/50">
              <div className="flex items-center gap-2 text-rose-600">
                <XCircle className="w-4 h-4" />
                <h4 className="font-bold text-sm uppercase tracking-wider">Punch OUT Location</h4>
              </div>
              <div className="aspect-square bg-slate-100 rounded-lg flex flex-col items-center justify-center border border-slate-200">
                <MapPin className="w-8 h-8 text-rose-600/40 mb-2" />
                <p className="text-[10px] font-mono text-slate-500">{selectedRecord?.outLat.toFixed(6)}, {selectedRecord?.outLng.toFixed(6)}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground font-bold">Address</Label>
                <p className="text-xs font-medium leading-relaxed">{selectedRecord?.outAddress}</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button className="w-full" onClick={() => setIsMapDialogOpen(false)}>Close Verification</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
