"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { 
  FileBarChart2, 
  FileText, 
  Download, 
  X, 
  Building2, 
  ChevronLeft, 
  ChevronRight, 
  Filter, 
  Clock,
  Factory
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableRow, 
  TableHead, 
  TableCell 
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, subDays, isAfter, eachDayOfInterval, isSunday, startOfDay, isValid, addHours, parseISO } from "date-fns";
import { useData } from "@/context/data-context";
import { formatCurrency, cn, formatDate, formatHoursToHHMM, isEmployeeActiveOnDate, parseDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type ReportType = "ATTENDANCE" | "PAYROLL";
const PROJECT_START_DATE_STR = "2026-04-01";
const ROWS_PER_PAGE = 15;

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

export default function ReportsPage() {
  const { employees = [], attendanceRecords = [], payrollRecords = [], plants = [], firms = [], verifiedUser, holidays = [], leaveRequests = [] } = useData();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeReport, setActiveReport] = useState<ReportType | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedFirmIds, setSelectedFirmIds] = useState<string[]>([]);
  const [selectedPlantId, setSelectedPlantId] = useState("all");
  const [viewData, setViewData] = useState<any[] | null>(null);
  const [viewType, setViewType] = useState<ReportType | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const end = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const floor = parseISO(PROJECT_START_DATE_STR);
    const start = isAfter(subDays(end, 90), floor) ? subDays(end, 90) : floor;
    setFromDate(format(start, "yyyy-MM-dd"));
    setToDate(format(end, "yyyy-MM-dd"));
    if (firms?.length) setSelectedFirmIds(firms.map(f => f.id));
  }, [firms]);

  const userAssignedPlantIds = useMemo(() => {
    if (!verifiedUser || verifiedUser.role === 'SUPER_ADMIN') return null;
    return verifiedUser.plantIds || [];
  }, [verifiedUser]);

  const authorizedPlants = useMemo(() => {
    if (!userAssignedPlantIds) return plants;
    return plants.filter(p => userAssignedPlantIds.includes(p.id));
  }, [userAssignedPlantIds, plants]);

  const paginatedData = useMemo(() => {
    if (!viewData) return [];
    return viewData.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);
  }, [viewData, currentPage]);

  const totalPages = viewData ? Math.ceil(viewData.length / ROWS_PER_PAGE) : 0;

  const processReportData = (typeOverride?: ReportType) => {
    const type = typeOverride || activeReport;
    if (!type) return [];
    
    const start = startOfDay(parseISO(fromDate));
    const end = startOfDay(parseISO(toDate));

    if (type === "ATTENDANCE") {
      const allReportData: any[] = [];
      const dateRange = eachDayOfInterval({ start, end });
      
      const recordMap = new Map<string, any>();
      (attendanceRecords || []).forEach(r => {
        recordMap.set(`${r.employeeId}:${r.date}`, r);
      });

      const approvedLeavesMap = new Map<string, any>();
      (leaveRequests || []).filter(l => l.status === 'APPROVED' || l.status === 'Approved').forEach(l => {
        const lStart = startOfDay(parseISO(l.fromDate));
        const lEnd = startOfDay(parseISO(l.toDate));
        if (!isValid(lStart) || !isValid(lEnd)) return;
        eachDayOfInterval({ start: lStart, end: lEnd }).forEach(d => {
          approvedLeavesMap.set(`${l.employeeId}:${format(d, 'yyyy-MM-dd')}`, l);
        });
      });

      const targetEmployees = (employees || []).filter(emp => {
        if (userAssignedPlantIds) {
          const hasAccess = (emp.unitIds || []).some(id => userAssignedPlantIds.includes(id)) || userAssignedPlantIds.includes(emp.unitId);
          if (!hasAccess) return false;
        }
        return (!emp.firmId || selectedFirmIds.length === 0 || selectedFirmIds.includes(emp.firmId));
      });

      targetEmployees.forEach(emp => {
        if (selectedPlantId !== "all") {
          const empAtPlant = emp.unitIds?.includes(selectedPlantId) || emp.unitId === selectedPlantId;
          if (!empAtPlant) return;
        }

        dateRange.forEach(date => {
          const dateStr = format(date, 'yyyy-MM-dd');
          if (!isEmployeeActiveOnDate(emp, dateStr)) return;

          const r = recordMap.get(`${emp.employeeId}:${dateStr}`);
          
          let displayStatus = "";
          let inDateTime = formatDate(dateStr);
          let outDateTime = "--";
          let inLocation = "Location Not Available";
          let outLocation = "Location Not Available";
          let inPlant = "--";
          let workingHour = "00:00";
          let markingRemark = "--";
          let isApprovedStatus = "Pending";
          
          const isSun = isSunday(date);
          const customHoliday = (holidays || []).find(h => h.date === dateStr && !h.auto);
          const leave = approvedLeavesMap.get(`${emp.employeeId}:${dateStr}`);

          // FIXED LOGIC: Fills report data for both approved history and raw live present logs matching date intervals
          if (r) {
            isApprovedStatus = (r.approved === true || r.approved === "true") ? "Approved" : "Pending";
            markingRemark = r.remark || "--";
            inPlant = r.inPlant || "Salt Plant";

            if (r.inTime) {
              inDateTime = `${formatDate(r.inDate || r.date)} ${r.inTime || ""}`;
              inLocation = formatLocation(r.address, r.lat, r.lng);
              
              if (r.autoCheckout) {
                const inDT = parseDateTime(r.inDate || r.date, r.inTime || "");
                if (inDT && isValid(inDT)) {
                  const autoOutDT = addHours(inDT, 16);
                  outDateTime = `${formatDate(format(autoOutDT, "yyyy-MM-dd"))} ${format(autoOutDT, "HH:mm")}`;
                }
                workingHour = "16:00";
                if (!r.remark) markingRemark = "System Auto-Logged OUT (16h Limit Threshold reached)";
              } else {
                outDateTime = r.outTime ? `${formatDate(r.outDate || r.date)} ${r.outTime}` : "--";
                outLocation = formatLocation(r.addressOut, r.latOut, r.lngOut);
                workingHour = formatHoursToHHMM(r.hours || 0);
              }

              if (isSun) displayStatus = "Present on Weekly Off";
              else if (customHoliday) displayStatus = "Present on Holiday";
              else displayStatus = "Present";
            } else {
              if (leave) {
                displayStatus = "Absent on Leave";
                isApprovedStatus = "Approved";
                markingRemark = `Leave: ${leave.purpose}`;
              } else if (isSun) {
                displayStatus = "Weekly Off";
                isApprovedStatus = "System Link";
              } else if (customHoliday) {
                displayStatus = "Holiday";
                isApprovedStatus = "System Link";
              } else {
                displayStatus = r.status === 'PRESENT' ? 'Present' : 'Absent';
              }
              workingHour = formatHoursToHHMM(r.hours || 0);
            }
          } else {
            if (leave) {
              displayStatus = "Absent on Leave";
              isApprovedStatus = "Approved";
              markingRemark = `Leave: ${leave.purpose}`;
            } else if (isSun) {
              displayStatus = "Weekly Off";
              isApprovedStatus = "System Link";
            } else if (customHoliday) {
              displayStatus = "Holiday";
              isApprovedStatus = "System Link";
            } else {
              displayStatus = "Absent";
              isApprovedStatus = "Unmarked";
            }
          }

          allReportData.push({
            "Employee ID": emp.employeeId,
            "Employee Name": emp.firstName ? `${emp.firstName} ${emp.lastName || ''}`.trim() : emp.name,
            "In date time": inDateTime,
            "In Plant": inPlant,
            "Out Date time": outDateTime,
            "In Location": inLocation,
            "Out Location": outLocation,
            "Working Hour": workingHour,
            "Status": displayStatus,
            "Approval": isApprovedStatus,
            "Remark": markingRemark
          });
        });
      });

      return allReportData.sort((a, b) => b["In date time"].localeCompare(a["In date time"]));
    }

    return (payrollRecords || [])
      .filter(p => {
        const emp = employees.find(e => e.employeeId === p.employeeId);
        if (userAssignedPlantIds) {
          const hasAccess = (emp?.unitIds || []).some(id => userAssignedPlantIds.includes(id)) || userAssignedPlantIds.includes(emp?.unitId);
          if (!hasAccess) return false;
        }
        if (selectedPlantId !== "all") {
          const empAtPlant = emp?.unitIds?.includes(selectedPlantId) || emp?.unitId === selectedPlantId;
          if (!empAtPlant) return false;
        }
        return emp ? (!emp.firmId || selectedFirmIds.length === 0 || selectedFirmIds.includes(emp.firmId)) : true;
      })
      .map(p => {
        const emp = employees.find(e => e.employeeId === p.employeeId);
        const firm = firms.find(f => f.id === emp?.firmId);
        const lastPayment = p.salaryHistory?.[p.salaryHistory.length - 1];
        
        return {
          "Firm": firm?.name || "N/A",
          "Employee ID": p.employeeId,
          "Employee Name": p.employeeName,
          "Salary Slip No.": p.slipNo || "N/A",
          "Date": p.slipDate || formatDate(p.createdAt),
          "Payroll Month": p.month,
          "Working Day": p.totalEarningDays || 0,
          "Absent": p.absent || 0,
          "Monthly CTC": formatCurrency(emp?.salary?.monthlyCTC || 0),
          "Advance Deduction": formatCurrency(p.advanceRecovery || 0),
          "Net Payable Salary": formatCurrency(p.netPayable || 0),
          "Paid Amount": formatCurrency(p.salaryPaidAmount || 0),
          "Paid Date": p.salaryPaidDate || "---",
          "Banking Reference": lastPayment?.reference || "---"
        };
      });
  };

  const handleExport = (typeOverride?: ReportType) => {
    const data = processReportData(typeOverride);
    if (!data.length) { toast({ variant: "destructive", title: "No Data Scopes Finalized" }); return; }
    const csv = [Object.keys(data[0]).join(","), ...data.map(r => Object.values(r).map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })));
    link.setAttribute("download", `Sikka_${typeOverride || viewType}_Report_${fromDate}_to_${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isMounted) return null;

  return (
    <div className="space-y-8 pb-20 px-4 max-w-7xl mx-auto">
      <div className="flex justify-between items-center border-b pb-5">
        <div>
          <h1 className="text-3xl font-black uppercase flex items-center gap-3">Analytics & Reports</h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">Compile Audited Shift Records and History Ledgers</p>
        </div>
        {viewData && (
          <Button variant="ghost" onClick={() => { setViewData(null); setViewType(null); }} className="gap-2 font-black text-xs uppercase text-slate-500 hover:bg-slate-100 rounded-xl px-4 h-10 border">
            <X className="w-4 h-4" /> Reset View
          </Button>
        )}
      </div>

      {!viewData ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card className="p-10 cursor-pointer hover:shadow-xl transition-all group rounded-[2rem] bg-white border border-slate-100 shadow-sm" onClick={() => { setActiveReport("ATTENDANCE"); setIsDialogOpen(true); }}>
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-primary group-hover:text-white transition-colors shadow-inner">
              <FileBarChart2 className="w-8 h-8 text-primary group-hover:text-white" />
            </div>
            <h3 className="text-xl font-black uppercase tracking-tight text-slate-800">Attendance Export</h3>
            <p className="text-sm font-semibold text-slate-400 mt-2 leading-relaxed">Scoped history ledger data streams mapping the facility compliance records.</p>
          </Card>
          <Card className="p-10 cursor-pointer hover:shadow-xl transition-all group rounded-[2rem] bg-white border border-slate-100 shadow-sm" onClick={() => { setActiveReport("PAYROLL"); setIsDialogOpen(true); }}>
            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-emerald-600 group-hover:text-white transition-colors shadow-inner">
              <FileText className="w-8 h-8 text-emerald-600 group-hover:text-white" />
            </div>
            <h3 className="text-xl font-black uppercase tracking-tight text-slate-800">Payroll Summary</h3>
            <p className="text-sm font-semibold text-slate-400 mt-2 leading-relaxed">Consolidated monthly disbursements arrays logs and transaction referential ledgers.</p>
          </Card>
        </div>
      ) : (
        <Card className="border-none shadow-2xl overflow-hidden rounded-2xl bg-white">
          <CardHeader className="bg-slate-900 text-white flex flex-row items-center justify-between p-6 shrink-0">
            <div>
              <CardTitle className="uppercase font-black tracking-tight text-lg">{viewType} History Ledger Preview</CardTitle>
              <p className="text-[10px] text-primary font-black uppercase tracking-widest mt-1">Filter Period: {formatDate(fromDate)} to {formatDate(toDate)}</p>
            </div>
            <Button onClick={() => handleExport(viewType!)} className="bg-emerald-600 hover:bg-emerald-700 h-11 px-8 font-black gap-2 uppercase text-xs tracking-wider rounded-xl shadow-lg shadow-emerald-600/10"><Download className="w-4 h-4" /> Export CSV Sheet</Button>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="w-full">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    {viewData[0] && Object.keys(viewData[0]).map(h => (
                      <TableHead key={h} className="font-black text-[10px] uppercase tracking-widest py-4 px-6 text-slate-500 whitespace-nowrap">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.length === 0 ? (
                    <TableRow><TableCell colSpan={viewData[0] ? Object.keys(viewData[0]).length : 1} className="text-center py-20 text-slate-400 font-bold italic text-xs uppercase bg-slate-50/30">No matching finalized records found.</TableCell></TableRow>
                  ) : (
                    paginatedData.map((row, idx) => (
                      <TableRow key={idx} className="hover:bg-slate-50/50 transition-colors">
                        {Object.values(row).map((val: any, i) => (
                          <TableCell key={i} className="px-6 py-4 text-xs font-bold text-slate-700 whitespace-nowrap">
                            {val?.toString() === "Approved" ? (
                              <Badge className="bg-emerald-50 text-emerald-700 shadow-none border-none font-black text-[9px] uppercase">{val}</Badge>
                            ) : val?.toString() === "Pending" ? (
                              <Badge className="bg-amber-50 text-amber-700 shadow-none border-none font-black text-[9px] uppercase">{val}</Badge>
                            ) : val?.toString().includes("Hrs") || val?.toString().includes("₹") ? (
                              <span className="font-mono font-black text-slate-900">{val}</span>
                            ) : (
                              val
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <ScrollBar orientation="horizontal"/>
            </ScrollArea>
          </CardContent>
          {totalPages > 1 && (
            <CardFooter className="bg-slate-50 border-t flex items-center justify-between p-4">
              <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="font-bold h-9"><ChevronLeft className="w-4 h-4 mr-1" /> Prev</Button>
              <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Page {currentPage} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="font-bold h-9">Next <ChevronRight className="w-4 h-4 ml-1" /></Button>
            </CardFooter>
          )}
        </Card>
      )}

      {/* PARAMETERS DIALOG BOX */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl border-none shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <DialogTitle className="flex items-center gap-2 font-black uppercase text-sm tracking-wider">
              <Filter className="w-5 h-5 text-primary" /> Report Parameters Setup
            </DialogTitle>
          </DialogHeader>
          
          <div className="p-8 space-y-6 bg-white">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">From Date Range</Label>
                <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="h-12 font-bold rounded-xl border-slate-200 bg-slate-50" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">To Date Range</Label>
                <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="h-12 font-bold rounded-xl border-slate-200 bg-slate-50" />
              </div>
            </div>

            <div className="space-y-2 flex flex-col">
              <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-1.5 mb-1"><Building2 className="w-3.5 h-3.5 text-primary" /> Scope Filter By Plant Facility</Label>
              <Select value={selectedPlantId} onValueChange={setSelectedPlantId}>
                <SelectTrigger className="h-12 w-full bg-slate-50 border border-slate-200 font-bold rounded-xl text-xs uppercase focus:ring-0 shadow-none px-4 flex items-center justify-between">
                  <SelectValue placeholder="All Authorized Plants" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border border-slate-200 bg-white shadow-xl max-h-[250px] overflow-y-auto z-[9999]">
                  <SelectItem value="all" className="font-bold text-xs uppercase py-2 cursor-pointer hover:bg-slate-50 transition-colors">All Authorized Plants</SelectItem>
                  {authorizedPlants.map(p => (
                    <SelectItem key={p.id} value={p.id} className="font-bold text-xs uppercase py-2 cursor-pointer hover:bg-slate-50 transition-colors">{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="p-6 bg-slate-50 border-t flex flex-row gap-3">
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="flex-1 font-black rounded-xl h-12 uppercase text-xs">Cancel</Button>
            <Button 
              onClick={() => { 
                setCurrentPage(1);
                const compiledData = processReportData();
                setViewData(compiledData); 
                setViewType(activeReport); 
                setIsDialogOpen(false); 
                if(compiledData.length > 0) {
                  toast({ title: "Report view generated successfully." });
                } else {
                  toast({ variant: "destructive", title: "No Records", description: "No entries matched month selection parameters." });
                }
              }} 
              className="flex-1 bg-primary hover:bg-primary/90 text-white font-black h-12 rounded-xl shadow-lg shadow-primary/20 uppercase text-xs tracking-wider"
            >
              Generate View
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}