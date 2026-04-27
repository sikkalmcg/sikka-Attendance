
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
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Search, 
  CheckCircle2, 
  XCircle, 
  Pencil,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  ArrowRightCircle,
  FileCheck
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { useData } from "@/context/data-context";
import { parseISO, format, differenceInDays, isValid } from "date-fns";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

const ITEMS_PER_PAGE = 15;

export default function LeaveApprovalPage() {
  const { leaveRequests, updateRecord, verifiedUser } = useData();
  const { toast } = useToast();
  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState("pending");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Pagination
  const [pendingPage, setPendingPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);

  // Dialog states
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<any>(null);
  const [editData, setEditData] = useState({ fromDate: "", toDate: "" });
  const [rejectReason, setRejectReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setPendingPage(1);
    setHistoryPage(1);
  }, [activeTab, searchTerm]);

  const filteredLeaves = useMemo(() => {
    if (!isMounted) return [];
    const search = searchTerm.toLowerCase();
    return (leaveRequests || []).filter(req => {
      const matchesSearch = 
        req.employeeName.toLowerCase().includes(search) ||
        req.department.toLowerCase().includes(search) ||
        req.designation.toLowerCase().includes(search) ||
        req.plantName.toLowerCase().includes(search) ||
        req.purpose.toLowerCase().includes(search);
      
      if (activeTab === 'pending') {
        return matchesSearch && req.status === 'UNDER_PROCESS';
      } else {
        return matchesSearch && (req.status === 'APPROVED' || req.status === 'REJECTED');
      }
    }).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  }, [leaveRequests, searchTerm, activeTab, isMounted]);

  const currentData = useMemo(() => {
    const page = activeTab === 'pending' ? pendingPage : historyPage;
    const start = (page - 1) * ITEMS_PER_PAGE;
    return {
      items: filteredLeaves.slice(start, start + ITEMS_PER_PAGE),
      total: filteredLeaves.length,
      totalPages: Math.ceil(filteredLeaves.length / ITEMS_PER_PAGE)
    };
  }, [filteredLeaves, activeTab, pendingPage, historyPage]);

  const handleApprove = (req: any) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      updateRecord('leaveRequests', req.id, {
        status: 'APPROVED',
        approvedBy: verifiedUser?.fullName || "HR_ADMIN"
      });
      toast({ title: "Leave Request Approved" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = () => {
    if (!selectedLeave || !rejectReason.trim() || isProcessing) return;
    setIsProcessing(true);
    try {
      updateRecord('leaveRequests', selectedLeave.id, {
        status: 'REJECTED',
        rejectReason: rejectReason,
        approvedBy: verifiedUser?.fullName || "HR_ADMIN"
      });
      toast({ variant: "destructive", title: "Leave Request Rejected" });
      setIsRejectOpen(false);
      setRejectReason("");
      setSelectedLeave(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEdit = () => {
    if (!selectedLeave || isProcessing) return;
    const start = parseISO(editData.fromDate);
    const end = parseISO(editData.toDate);
    if (!isValid(start) || !isValid(end) || end < start) {
      toast({ variant: "destructive", title: "Invalid Dates", description: "Ensure 'To Date' is after 'From Date'." });
      return;
    }
    
    setIsProcessing(true);
    try {
      const days = differenceInDays(end, start) + 1;
      updateRecord('leaveRequests', selectedLeave.id, {
        fromDate: editData.fromDate,
        toDate: editData.toDate,
        days: days
      });
      toast({ title: "Request Dates Updated" });
      setIsEditOpen(false);
      setSelectedLeave(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExport = () => {
    if (filteredLeaves.length === 0) {
      toast({ variant: "destructive", title: "No Data to Export" });
      return;
    }
    const headers = ["Employee Name", "Department", "Designation", "Plant", "From Date", "To Date", "Leave Days", "Purpose", "Status", "Approved By"];
    const csv = [
      headers.join(","),
      ...filteredLeaves.map(r => [
        `"${r.employeeName}"`,
        `"${r.department}"`,
        `"${r.designation}"`,
        `"${r.plantName}"`,
        `"${formatDate(r.fromDate)}"`,
        `"${formatDate(r.toDate)}"`,
        r.days,
        `"${r.purpose}"`,
        `"${r.status}"`,
        `"${r.approvedBy || ''}"`
      ].join(","))
    ].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })));
    link.setAttribute("download", `Leave_History_Export.csv`);
    link.click();
    toast({ title: "Export Success" });
  };

  const calculateDays = (from: string, to: string) => {
    const start = parseISO(from);
    const end = parseISO(to);
    if (isValid(start) && isValid(end) && end >= start) {
      return differenceInDays(end, start) + 1;
    }
    return 0;
  };

  function StandardPaginationFooter({ current, total, onPageChange }: any) {
    return (
      <CardFooter className="bg-slate-50 border-t flex flex-col sm:flex-row items-center justify-between p-4 gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={current === 1} onClick={() => onPageChange(current - 1)} className="font-bold h-9">
            <ChevronLeft className="w-4 h-4 mr-1" /> Previous
          </Button>
          <Button variant="outline" size="sm" disabled={current === total || total === 0} onClick={() => onPageChange(current + 1)} className="font-bold h-9">
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
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
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          <FileCheck className="w-7 h-7 text-primary" /> Leave Approval Dashboard
        </h1>
        <p className="text-muted-foreground text-sm font-medium mt-1">Sikka Industries Workforce Absence Management</p>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Global search by name, department, plant or purpose..." 
            className="pl-10 h-10 bg-white" 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
          />
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
          <TabsList className="grid w-full grid-cols-2 bg-slate-100 h-10 p-1 rounded-xl w-[240px]">
            <TabsTrigger value="pending" className="text-xs font-black">Pending</TabsTrigger>
            <TabsTrigger value="history" className="text-xs font-black">History</TabsTrigger>
          </TabsList>
        </Tabs>
        {activeTab === 'history' && (
          <Button onClick={handleExport} variant="outline" className="h-10 font-bold border-emerald-200 text-emerald-700 hover:bg-emerald-50 gap-2 px-6">
            <FileSpreadsheet className="w-4 h-4" /> Export Excel Option
          </Button>
        )}
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <ScrollArea className="w-full">
            <Table className="min-w-[1500px]">
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500 py-4 px-6">Employee Name</TableHead>
                  <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">Department</TableHead>
                  <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">Designation</TableHead>
                  <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">Plant</TableHead>
                  <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">From Date</TableHead>
                  <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">To Date</TableHead>
                  <TableHead className="font-bold text-[11px] uppercase tracking-widest text-center">Leave Days</TableHead>
                  <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">Purpose</TableHead>
                  {activeTab === 'history' && <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500">Approved By</TableHead>}
                  <TableHead className="text-right font-bold text-[11px] uppercase tracking-widest text-slate-500 pr-6">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentData.items.length === 0 ? (
                  <TableRow><TableCell colSpan={activeTab === 'history' ? 10 : 9} className="text-center py-20 text-muted-foreground font-bold italic">No records found matching criteria.</TableCell></TableRow>
                ) : (
                  currentData.items.map((req: any) => (
                    <TableRow key={req.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-black text-slate-900 uppercase text-xs sm:text-sm">{req.employeeName}</span>
                          <span className="text-[10px] font-mono text-primary font-bold uppercase">{req.employeeId}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-bold text-slate-600">{req.department}</TableCell>
                      <TableCell className="text-[10px] text-muted-foreground uppercase font-medium">{req.designation}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px] font-black uppercase bg-white border-slate-200">{req.plantName || "---"}</Badge></TableCell>
                      <TableCell className="text-xs font-bold text-slate-700">{formatDate(req.fromDate)}</TableCell>
                      <TableCell className="text-xs font-bold text-slate-700">{formatDate(req.toDate)}</TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-primary/10 text-primary border-none font-black text-xs px-3">{req.days}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs font-medium text-slate-500" title={req.purpose}>{req.purpose}</TableCell>
                      {activeTab === 'history' && (
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-600 uppercase tracking-tight">{req.approvedBy || "---"}</span>
                          </div>
                        </TableCell>
                      )}
                      <TableCell className="text-right pr-6">
                        <div className="flex justify-end gap-1">
                          {activeTab === 'pending' ? (
                            <>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500" onClick={() => { setSelectedLeave(req); setEditData({ fromDate: req.fromDate, toDate: req.toDate }); setIsEditOpen(true); }}><Pencil className="w-3.5 h-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600" onClick={() => { setSelectedLeave(req); setIsRejectOpen(true); }}><XCircle className="w-3.5 h-3.5" /></Button>
                              <Button size="sm" className="h-8 font-black text-[10px] uppercase bg-emerald-600" onClick={() => handleApprove(req)}>Approve</Button>
                            </>
                          ) : (
                            <Badge className={cn(
                              "text-[9px] font-black uppercase px-3 py-1", 
                              req.status === 'APPROVED' ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                            )}>
                              {req.status}
                            </Badge>
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
        <StandardPaginationFooter current={activeTab === 'pending' ? pendingPage : historyPage} total={currentData.totalPages} onPageChange={activeTab === 'pending' ? setPendingPage : setHistoryPage} />
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <DialogTitle className="flex items-center gap-2"><Pencil className="w-5 h-5 text-primary" /> Edit Leave Schedule</DialogTitle>
            <p className="text-[10px] text-primary font-black uppercase mt-1">{selectedLeave?.employeeName} • {selectedLeave?.employeeId}</p>
          </DialogHeader>
          <div className="p-8 space-y-8">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-500">Adjust From Date</Label>
                <Input type="date" value={editData.fromDate} onChange={(e) => setEditData({...editData, fromDate: e.target.value})} className="h-12 font-bold" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-500">Adjust To Date</Label>
                <Input type="date" value={editData.toDate} onChange={(e) => setEditData({...editData, toDate: e.target.value})} className="h-12 font-bold" />
              </div>
            </div>
            
            <div className="p-5 bg-primary/5 rounded-2xl border-2 border-primary/10 flex justify-between items-center">
              <div className="space-y-0.5">
                <p className="text-[10px] font-black text-primary uppercase tracking-widest">Recalculated Duration</p>
                <p className="text-3xl font-black text-slate-900 leading-none">{calculateDays(editData.fromDate, editData.toDate)} Days</p>
              </div>
              <ArrowRightCircle className="w-8 h-8 text-primary/30" />
            </div>
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t flex gap-2">
            <Button variant="ghost" onClick={() => setIsEditOpen(false)} className="flex-1 font-bold h-12 rounded-xl">Cancel</Button>
            <Button className="flex-1 bg-primary font-black h-12 rounded-xl" onClick={handleEdit} disabled={isProcessing}>Update Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 bg-rose-600 text-white shrink-0">
            <DialogTitle className="flex items-center gap-2"><XCircle className="w-5 h-5" /> Deny Leave Request</DialogTitle>
          </DialogHeader>
          <div className="p-8 space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-500">Rejection Reason * (Mandatory)</Label>
              <Textarea 
                placeholder="Specify exact reason for rejection..." 
                value={rejectReason} 
                onChange={(e) => setRejectReason(e.target.value)} 
                className="min-h-[120px] bg-slate-50 border-slate-200" 
              />
            </div>
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t flex gap-2">
            <Button variant="ghost" onClick={() => setIsRejectOpen(false)} className="flex-1 font-bold h-12 rounded-xl">Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectReason.trim() || isProcessing} className="flex-1 font-black h-12 rounded-xl">Confirm Rejection</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
