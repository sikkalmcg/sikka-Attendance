"use client";

import { useState, useMemo, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { differenceInCalendarDays, format, isBefore, startOfToday, parseISO } from "date-fns";
import { useData } from "@/context/data-context";
import { formatDate } from "@/lib/utils";

function MarkAttendancePage() {
  // यह आपके मौजूदा "Mark Attendance" कंपोनेंट के लिए एक प्लेसहोल्डर है।
  return (
    <Card>
      <CardHeader><CardTitle>Mark Attendance</CardTitle></CardHeader>
      <CardContent>
        <p>आपकी मौजूदा अटेंडेंस मार्किंग UI यहाँ रहेगी।</p>
        {/* प्लेसहोल्डर बटन */}
        <Button className="mt-4">Mark In/Out</Button>
      </CardContent>
    </Card>
  )
}

function LeaveRequestForm() {
  const [open, setOpen] = useState(false);
  const { addRecord, verifiedUser, leaveRequests } = useData();
  const { toast } = useToast();
  const [purpose, setPurpose] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [remark, setRemark] = useState("");

  const totalDays = fromDate && toDate && !isBefore(new Date(toDate), new Date(fromDate))
    ? differenceInCalendarDays(new Date(toDate), new Date(fromDate)) + 1
    : 0;

  const handleRemarkChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const words = e.target.value.split(/\s+/).filter(Boolean);
    if (words.length <= 20) {
      setRemark(e.target.value);
    } else {
      toast({
        variant: "destructive",
        title: "Word Limit Exceeded",
        description: "Remark cannot exceed 20 words.",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const today = startOfToday();
    if (!purpose || !fromDate || !toDate) {
      toast({ variant: "destructive", title: "Incomplete Form", description: "Please fill all required fields." });
      return;
    }
    if (isBefore(new Date(fromDate), today)) {
      toast({ variant: "destructive", title: "Invalid Date", description: "From date cannot be in the past." });
      return;
    }
    if (isBefore(new Date(toDate), new Date(fromDate))) {
      toast({ variant: "destructive", title: "Invalid Date Range", description: "To Date cannot be before From Date." });
      return;
    }

    const hasDuplicate = (leaveRequests || []).some(req => 
      req.employeeId === verifiedUser?.employeeId &&
      req.status !== 'REJECTED' &&
      (new Date(fromDate) <= new Date(req.toDate) && new Date(toDate) >= new Date(req.fromDate))
    );

    if (hasDuplicate) {
      toast({ variant: "destructive", title: "Duplicate Request", description: "A leave request for these dates already exists." });
      return;
    }

    try {
      await addRecord('leaveRequests', {
        employeeId: verifiedUser?.employeeId,
        firmId: verifiedUser?.firmId,
        employeeName: (verifiedUser as any)?.fullName || (verifiedUser as any)?.name || "",
        department: verifiedUser?.department,
        designation: verifiedUser?.designation,
        purpose,
        fromDate,
        toDate,
        days: totalDays,
        remark,
        status: 'UNDER_PROCESS',
      });
      toast({ title: "Leave Request Submitted", description: "Your request has been sent for approval." });
      setOpen(false); // Close dialog on success
      setPurpose("");
      setFromDate("");
      setToDate("");
      setRemark("");
    } catch (error) {
      toast({ variant: "destructive", title: "Submission Failed", description: "Could not submit your leave request." });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Leave Request</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>New Leave Request</DialogTitle>
          <DialogDescription>Fill in the details below to submit a leave request.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2"><Label htmlFor="purpose">Leave Purpose</Label><Input id="purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} required /></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2"><Label htmlFor="fromDate">From Date</Label><Input id="fromDate" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} required /></div>
              <div className="space-y-2"><Label htmlFor="toDate">To Date</Label><Input id="toDate" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} required /></div>
              <div className="space-y-2"><Label>Total Days</Label><Input value={totalDays > 0 ? totalDays : ""} disabled readOnly /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="remark">Remark (Optional, 20 words max)</Label><Textarea id="remark" value={remark} onChange={handleRemarkChange} /></div>
          </div>
          <DialogFooter><Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit">Submit</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EmployeeLeaveHistory() {
  const { leaveRequests = [], verifiedUser, employees = [] } = useData();

  const approverMap = useMemo(() => new Map(employees.map(e => [e.id, (e as any).fullName || (e as any).name])), [employees]);

  const userLeaveRequests = useMemo(() => {
    return (leaveRequests || [])
      .filter(req => req.employeeId === verifiedUser?.employeeId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [leaveRequests, verifiedUser]);

  return (
    <Card>
      <CardHeader><CardTitle>Leave Approval History</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Leave Type</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Approved/Rejected By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {userLeaveRequests.map(req => (
              <TableRow key={req.id}>
                <TableCell>{req.purpose}</TableCell>
                <TableCell>{formatDate(req.fromDate)}</TableCell>
                <TableCell>{formatDate(req.toDate)}</TableCell>
                <TableCell>{req.days}</TableCell>
                <TableCell>
                  <Badge variant={ req.status === 'APPROVED' ? 'default' : req.status === 'REJECTED' ? 'destructive' : 'secondary' }>{req.status}</Badge>
                </TableCell>
                <TableCell>{approverMap.get((req as any).processedByUserId || (req as any).processedByUserld) || (req as any).processedByUserId || '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function EmployeeDashboardPage() {
  return (
    <div className="space-y-8 p-4 md:p-8">
      {/* Mark Attendance सेक्शन */}
      <div className="relative">
        <MarkAttendancePage />
        {/* Leave Request बटन को Mark Attendance कार्ड के ऊपर दाईं ओर रखा गया है */}
        <div className="absolute top-6 right-6">
          <LeaveRequestForm />
        </div>
      </div>

      {/* Leave History सेक्शन */}
      <EmployeeLeaveHistory />
    </div>
  );
}