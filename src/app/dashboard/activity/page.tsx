
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
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter
} from "@/components/ui/dialog";
import { 
  Search, 
  Smartphone, 
  History, 
  User as UserIcon,
  ShieldCheck,
  Calendar,
  Clock,
  ArrowRightCircle,
  SmartphoneNfc,
  CheckCircle2,
  MonitorSmartphone
} from "lucide-react";
import { useData } from "@/context/data-context";
import { formatDate, cn } from "@/lib/utils";
import { format, subDays, subMonths, eachDayOfInterval, isSameDay } from "date-fns";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";

export default function ActivityPage() {
  const { employees } = useData();
  const [searchTerm, setSearchTerm] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const filteredEmployees = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return (employees || [])
      .filter(emp => emp.active)
      .filter(emp => 
        (emp.name || "").toLowerCase().includes(search) || 
        (emp.employeeId || "").toLowerCase().includes(search) || 
        (emp.deviceId || "").toLowerCase().includes(search) ||
        (emp.deviceName || "").toLowerCase().includes(search)
      );
  }, [employees, searchTerm]);

  // Generate 90-day history for the dialog
  const generateHistory = (emp: any) => {
    if (!emp) return [];
    const today = new Date();
    
    // For demo purposes, we simulate random device login periods in last 90 days
    return [
      { 
        id: "h1", 
        from: format(subDays(today, 2), "dd-MMM-yyyy"), 
        to: "Present", 
        deviceName: emp.deviceName || "Authorized Web Node",
        deviceId: emp.deviceId || "DEV-UNSYNCED" 
      },
      { 
        id: "h2", 
        from: format(subDays(today, 15), "dd-MMM-yyyy"), 
        to: format(subDays(today, 3), "dd-MMM-yyyy"), 
        deviceName: "Mobile Terminal",
        deviceId: emp.deviceId || "DEV-UNSYNCED" 
      },
      { 
        id: "h3", 
        from: format(subDays(today, 45), "dd-MMM-yyyy"), 
        to: format(subDays(today, 16), "dd-MMM-yyyy"), 
        deviceName: "Old Legacy Device",
        deviceId: "OLD-HARDWARE-3342" 
      }
    ];
  };

  if (!isMounted) return null;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
             <SmartphoneNfc className="w-8 h-8 text-primary" /> Activity Center
          </h1>
          <p className="text-muted-foreground text-sm font-medium mt-1 uppercase tracking-widest">Employee Security & Device Registry</p>
        </div>
      </div>

      <Card className="border-slate-200 shadow-xl overflow-hidden rounded-2xl">
        <CardHeader className="bg-slate-50 border-b p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by name, ID or hardware..." 
              className="pl-10 h-10 bg-white" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="w-full">
            <Table className="min-w-[1200px]">
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-500 py-5 px-6">Employee Name / ID</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-500">Department / Designation</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-500">Device Name</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-primary">Current Device ID</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-500">Active From Date</TableHead>
                  <TableHead className="text-right font-black uppercase text-[10px] tracking-widest text-slate-500 pr-6">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-20 text-muted-foreground font-bold">No active hardware records found.</TableCell></TableRow>
                ) : (
                  filteredEmployees.map((emp) => (
                    <TableRow key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 uppercase text-sm">{emp.name}</span>
                          <span className="text-[10px] font-mono text-primary font-black uppercase tracking-tighter">{emp.employeeId}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-700">{emp.department}</span>
                          <span className="text-[10px] text-muted-foreground uppercase font-medium">{emp.designation}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                           <MonitorSmartphone className="w-3.5 h-3.5 text-slate-400" />
                           <span className="text-xs font-bold text-slate-600 uppercase">{emp.deviceName || "Authorized Web Node"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-[10px] font-black uppercase bg-white border-primary/20 text-primary px-3 py-1 shadow-sm">
                          {emp.deviceId || "NOT_SYNCED"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                           <Calendar className="w-3.5 h-3.5 text-slate-300" />
                           <span className="text-xs font-bold text-slate-600 uppercase">{formatDate(emp.joinDate)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          className="h-9 gap-2 font-black text-[10px] uppercase bg-slate-900 text-white hover:bg-primary transition-all rounded-xl"
                          onClick={() => setSelectedEmployee(emp)}
                        >
                          <History className="w-3.5 h-3.5" /> History
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={!!selectedEmployee} onOpenChange={(o) => !o && setSelectedEmployee(null)}>
        <DialogContent className="sm:max-w-4xl p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
          <DialogHeader className="bg-slate-900 text-white p-8 space-y-4 shrink-0">
             <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center border border-primary/30">
                   <ShieldCheck className="w-8 h-8 text-primary" />
                </div>
                <div className="flex-1">
                   <DialogTitle className="text-2xl font-black uppercase tracking-tight">{selectedEmployee?.name}</DialogTitle>
                   <p className="text-[11px] font-bold text-primary uppercase tracking-[0.2em] mt-1">Hardware Audit Trail & Session Logs</p>
                </div>
             </div>
             <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 pt-4 border-t border-white/10">
                <div>
                   <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Aadhar Reference</Label>
                   <p className="text-sm font-mono font-bold mt-0.5">{selectedEmployee?.aadhaar}</p>
                </div>
                <div>
                   <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Mobile Contact</Label>
                   <p className="text-sm font-bold mt-0.5">{selectedEmployee?.mobile}</p>
                </div>
                <div className="hidden sm:block">
                   <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">System Role</Label>
                   <Badge className="bg-primary hover:bg-primary text-[10px] font-black uppercase block w-fit mt-0.5">EMPLOYEE</Badge>
                </div>
             </div>
          </DialogHeader>

          <div className="p-8 bg-slate-50/50">
             <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                   <Clock className="w-4 h-4" /> Activity Log (Last 90 Days)
                </h3>
                <Badge variant="outline" className="font-bold text-[10px] border-slate-200">System Records Only</Badge>
             </div>

             <Card className="border-slate-200 shadow-sm overflow-hidden rounded-2xl">
                <Table>
                   <TableHeader className="bg-white">
                      <TableRow>
                         <TableHead className="font-black text-[10px] uppercase tracking-tighter">From Date</TableHead>
                         <TableHead className="font-black text-[10px] uppercase tracking-tighter">To Date</TableHead>
                         <TableHead className="font-black text-[10px] uppercase tracking-tighter">Device Name</TableHead>
                         <TableHead className="font-black text-[10px] uppercase tracking-tighter">Device ID Login</TableHead>
                         <TableHead className="font-black text-[10px] uppercase tracking-tighter text-right">Status</TableHead>
                      </TableRow>
                   </TableHeader>
                   <TableBody>
                      {generateHistory(selectedEmployee).map((log) => (
                         <TableRow key={log.id} className="hover:bg-slate-50 transition-colors">
                            <TableCell className="font-bold text-slate-700 text-xs py-4">{log.from}</TableCell>
                            <TableCell className="font-bold text-slate-700 text-xs py-4">
                               {log.to === "Present" ? (
                                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none font-black text-[9px] px-2 uppercase">Active Now</Badge>
                               ) : log.to}
                            </TableCell>
                            <TableCell className="font-bold text-slate-500 text-[10px] uppercase">
                               {log.deviceName}
                            </TableCell>
                            <TableCell>
                               <div className="flex items-center gap-2">
                                  <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                                  <span className="text-xs font-mono font-bold text-slate-500">{log.deviceId}</span>
                               </div>
                            </TableCell>
                            <TableCell className="text-right">
                               <CheckCircle2 className={cn("w-4 h-4 ml-auto", log.to === "Present" ? "text-emerald-500" : "text-slate-300")} />
                            </TableCell>
                         </TableRow>
                      ))}
                   </TableBody>
                </Table>
             </Card>
          </div>

          <DialogFooter className="p-6 bg-white border-t flex items-center justify-between">
             <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                Verified Infrastructure Node
             </div>
             <Button onClick={() => setSelectedEmployee(null)} className="h-11 px-8 rounded-xl font-black bg-slate-900 hover:bg-primary transition-all">Close History</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
