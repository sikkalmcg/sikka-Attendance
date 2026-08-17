"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useData } from "@/context/data-context";
import { format, getDaysInMonth, startOfMonth, isAfter, subMonths } from "date-fns";
import { Download, Filter, Printer, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

const ROWS_PAGE_SIZES = [50, 100, 250, 500] as const;
const PROJECT_START_DATE_STR = "2026-04-01";

type LedgerRow = {
  employeeId: string;
  employeeName: string;
  department: string;
  designation: string;
  session?: string;
  isDayTotal?: boolean;
  date: string;
  inPlant: string;
  inDateTime: string;
  outDateTime: string;
  workingHours: string;
  inLocation: string;
  outLocation: string;
  outPlant: string;
  attendanceStatus: string;
  approvalStatus: string;
  approvedBy: string;
  remarks: string;
};

type SortBy = "employeeId" | "employeeName" | "department" | "attendanceStatus";
type SortDir = "asc" | "desc";

function getISTNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
}

function yyyyMMdd(d: Date) {
  return format(d, "yyyy-MM-dd");
}

const approvalBadgeClasses = (status: string) => {
  switch (status) {
    case "Approved": return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "Rejected": return "bg-rose-50 text-rose-700 border-rose-200";
    case "Pending": return "bg-amber-50 text-amber-700 border-amber-200";
    default: return "bg-slate-50 text-slate-700 border-slate-200";
  }
};

const attendanceBadgeClasses = (status: string) => {
  switch (status) {
    case "Present": return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "Absent": return "bg-rose-50 text-rose-700 border-rose-200";
    case "Leave": return "bg-purple-50 text-purple-700 border-purple-200";
    case "Present on Holiday":
    case "Present on Weekly Off": return "bg-amber-50 text-amber-700 border-amber-200";
    case "Holiday":
    case "Weekly Off": return "bg-slate-50 text-slate-700 border-slate-200";
    default: return "bg-slate-50 text-slate-700 border-slate-200";
  }
};

function getWorkingHoursColorClass(hoursStr: string) {
  if (!hoursStr || hoursStr === "--" || hoursStr === "00:00") {
    return "text-slate-400 font-medium";
  }
  const [hrs, mins] = hoursStr.split(":").map(Number);
  const totalHours = hrs + (mins || 0) / 60;
  if (totalHours < 8.0) {
    return "text-rose-600 bg-rose-50/60 px-2 py-0.5 rounded-md font-black border border-rose-100";
  }
  return "text-emerald-600 bg-emerald-50/60 px-2 py-0.5 rounded-md font-black border border-emerald-100";
}

export default function AttendanceHistoryLedgerPage() {
  const { employees = [], plants = [], verifiedUser } = useData();
  const { toast } = useToast();

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [plant, setPlant] = useState("all");
  const [employeeId, setEmployeeId] = useState("");
  const [department, setDepartment] = useState("ALL");
  const [designation, setDesignation] = useState("ALL");
  const [attendanceStatus, setAttendanceStatus] = useState("ALL_ATTENDANCE");
  const [processedBy, setProcessedBy] = useState("");
  const [search, setSearch] = useState("all");
  const [sortBy, setSortBy] = useState<SortBy>("employeeId");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof ROWS_PAGE_SIZES)[number] | "ALL">(100);
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const userAssignedPlantIds = useMemo(() => {
    if (!verifiedUser) return [];
    if (verifiedUser.role === "SUPER_ADMIN") return null;
    return verifiedUser.plantIds || [];
  }, [verifiedUser]);

  const authorizedPlants = useMemo(() => {
    if (!userAssignedPlantIds) return plants;
    return (plants || []).filter((p: any) => userAssignedPlantIds.includes(p.id || p._id));
  }, [plants, userAssignedPlantIds]);

  useEffect(() => {
    const now = getISTNow();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const floor = new Date(PROJECT_START_DATE_STR + "T00:00:00.000Z");
    const startClamped = start < floor ? floor : start;
    setFromDate(yyyyMMdd(startClamped));
    setToDate(yyyyMMdd(now));
  }, []);

  const requestUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("fromDate", fromDate);
    params.set("toDate", toDate);
    params.set("page", String(page));
    if (pageSize === "ALL") params.set("pageSize", "ALL");
    else params.set("pageSize", String(pageSize));
    params.set("sortBy", sortBy);
    params.set("sortDir", sortDir);

    params.set("plant", plant);
    if (employeeId) params.set("employeeId", employeeId);
    if (department && department !== "ALL") params.set("department", department);
    if (designation && designation !== "ALL") params.set("designation", designation);
    if (attendanceStatus && attendanceStatus !== "ALL_ATTENDANCE") params.set("attendanceStatus", attendanceStatus);
    if (processedBy) params.set("processedBy", processedBy);
    
    if (search && search !== "all") params.set("search", search);

    return `/api/reports/attendance-history-ledger?${params.toString()}`;
  }, [
    fromDate,
    toDate,
    page,
    pageSize,
    sortBy,
    sortDir,
    plant,
    employeeId,
    department,
    designation,
    attendanceStatus,
    processedBy,
    search,
  ]);

  useEffect(() => {
    if (!fromDate || !toDate) return;
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      try {
        const res = await fetch(requestUrl);
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error || "Failed to load report");
        }
        if (!cancelled) {
          setRows(json.rows || []);
          setMeta(json.meta || null);
        }
      } catch (e: any) {
        if (!cancelled) {
          toast({ variant: "destructive", title: "Report load failed", description: e?.message || String(e) });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [requestUrl, toast]);

  const onToggleSort = (next: SortBy) => {
    if (sortBy === next) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(next);
      setSortDir("asc");
    }
    setPage(1);
  };

  const exportReport = async (format: "csv" | "excel" | "pdf") => {
    const params = new URLSearchParams();
    params.set("fromDate", fromDate);
    params.set("toDate", toDate);
    params.set("export", "true");
    params.set("format", format);

    params.set("page", String(page));
    params.set("pageSize", "ALL");

    params.set("sortBy", sortBy);
    params.set("sortDir", sortDir);

    params.set("plant", plant);
    if (employeeId) params.set("employeeId", employeeId);
    if (department && department !== "ALL") params.set("department", department);
    if (designation && designation !== "ALL") params.set("designation", designation);
    if (attendanceStatus && attendanceStatus !== "ALL_ATTENDANCE") params.set("attendanceStatus", attendanceStatus);
    if (processedBy) params.set("processedBy", processedBy);
    if (search && search !== "all") params.set("search", search);

    if (format === "csv" || format === "excel") {
const columnOrder = [
        'employeeId',
        'employeeName',
        'department',
        'designation',
        'session',
        'inPlant',
        'inDateTime',
        'outDateTime',
        'workingHours',
        'inLocation',
        'outLocation',
        'outPlant',
        'attendanceStatus',
        'approvalStatus',
        'approvedBy',
        'remarks',
      ].join(",");
      params.set("columns", columnOrder);
    }

    const url = `/api/reports/attendance-history-ledger?${params.toString()}`;
    window.open(url, "_blank");
  };

  const printReport = async () => {
    const params = new URLSearchParams();
    params.set("fromDate", fromDate);
    params.set("toDate", toDate);
    params.set("print", "true");

    params.set("page", String(page));
    params.set("pageSize", "ALL");
    params.set("sortBy", sortBy);
    params.set("sortDir", sortDir);

    params.set("plant", plant);
    if (employeeId) params.set("employeeId", employeeId);
    if (department && department !== "ALL") params.set("department", department);
    if (designation && designation !== "ALL") params.set("designation", designation);
    if (attendanceStatus && attendanceStatus !== "ALL_ATTENDANCE") params.set("attendanceStatus", attendanceStatus);
    if (processedBy) params.set("processedBy", processedBy);
    if (search && search !== "all") params.set("search", search);

    const res = await fetch(`/api/reports/attendance-history-ledger?${params.toString()}`);
    const json = await res.json();
    if (!res.ok) {
      toast({ variant: "destructive", title: "Print failed", description: json?.error || "" });
      return;
    }

    const metaData = json?.meta;
    const rowsData: LedgerRow[] = json?.rows || [];

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast({ variant: "destructive", title: "Popup blocked", description: "Allow popups to print" });
      return;
    }

    const filtersSummary = [
      plant !== "all" ? `Plant: ${plant}` : null,
      employeeId ? `Employee ID: ${employeeId}` : null,
      department !== "ALL" ? `Department: ${department}` : null,
      designation !== "ALL" ? `Designation: ${designation}` : null,
      attendanceStatus !== "ALL_ATTENDANCE" ? `Status: ${attendanceStatus}` : null,
      processedBy ? `Processed By: ${processedBy}` : null,
      search !== "all" ? `Search: ${search}` : null,
    ]
      .filter(Boolean)
      .join(" | ");

    printWindow.document.write(`
      <html>
        <head>
          <title>Attendance History Ledger</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; }
            h1 { margin: 0 0 6px 0; font-size: 18px; }
            .meta { font-size: 12px; color: #555; margin-bottom: 14px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { border: 1px solid #ddd; padding: 6px; white-space: nowrap; }
            th { background: #f6f6f6; }
            .badgePresent { background:#eaf7ef;color:#0f7a2c; font-weight:700; padding:2px 6px; border-radius:6px; }
            .badgeAbsent { background:#fdecec;color:#b42318; font-weight:700; padding:2px 6px; border-radius:6px; }
            .badgeHoliday { background:#f1f3f5;color:#343a40; font-weight:700; padding:2px 6px; border-radius:6px; }
            .badgePending { background:#fff7d6;color:#8a5b00; font-weight:700; padding:2px 6px; border-radius:6px; }
            @media print { .noPrint { display:none; } }
          </style>
        </head>
        <body>
          <div class="meta">
            <div><b>Company:</b> Sikka</div>
            <div><b>Report:</b> Attendance History Ledger</div>
            <div><b>Filters:</b> ${filtersSummary || "(none)"}</div>
            <div><b>Generated:</b> ${new Date(metaData?.generatedAt || Date.now()).toLocaleString()}</div>
            <div><b>Total Records:</b> ${metaData?.totalRecords ?? rowsData.length}</div>
          </div>
          <h1>Attendance History Ledger</h1>
          <table>
            <thead>
              <tr>
                <th>Employee ID</th>
                <th>Employee Name</th>
                <th>Department / Designation</th>
                <th>Session</th>
                <th>In Plant</th>
                <th>In Date & Time</th>
                <th>Out Date & Time</th>
                <th>Working Hours</th>
                <th>In Location</th>
                <th>Out Location</th>
                <th>Out Plant</th>
                <th>Attendance Status</th>
                <th>Approval Status</th>
                <th>Approved By</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              ${rowsData
                .map((r) => {
                  const cls =
                    r.attendanceStatus === "Present"
                      ? "badgePresent"
                      : r.attendanceStatus === "Absent"
                        ? "badgeAbsent"
                        : r.attendanceStatus === "Holiday" || r.attendanceStatus === "Weekly Off"
                          ? "badgeHoliday"
                          : "badgePending";
                  return `
                    <tr>
                      <td>${r.employeeId}</td>
                      <td>${r.employeeName}</td>
                      <td>${r.department} / ${r.designation}</td>
                      <td><strong>${r.isDayTotal ? 'Day Total' : (r.session || '1')}</strong></td>
                      <td>${r.inPlant || '--'}</td>
                      <td>${r.inDateTime}</td>
                      <td>${r.outDateTime}</td>
                      <td>${r.workingHours}</td>
                      <td>${r.inLocation || "--"}</td>
                      <td>${r.outLocation || "--"}</td>
                      <td>${r.outPlant || '--'}</td>
                      <td><span class="${cls}">${r.attendanceStatus}</span></td>
                      <td>${r.approvalStatus}</td>
                      <td>${r.approvedBy}</td>
                      <td>${r.remarks}</td>
                    </tr>`;
                })
                .join("")}
            </tbody>
          </table>
          <div class="noPrint" style="margin-top:14px;">
            <button onclick="window.print()">Print</button>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  const uniqueDepartments = useMemo(() => {
    const set = new Set<string>();
    for (const e of employees) if (e.department) set.add(e.department);
    return Array.from(set).sort();
  }, [employees]);

  const uniqueDesignations = useMemo(() => {
    const set = new Set<string>();
    for (const e of employees) if (e.designation) set.add(e.designation);
    return Array.from(set).sort();
  }, [employees]);

  const allowedEmployees = useMemo(() => {
    if (!verifiedUser) return [];
    if (verifiedUser.role === "SUPER_ADMIN") return employees;
    const allowed = verifiedUser.plantIds || [];
    return (employees || []).filter((e: any) => {
      return (e.unitIds || []).some((id: string) => allowed.includes(id)) || allowed.includes(e.unitId);
    });
  }, [employees, verifiedUser]);

  const attendanceStatusOptions: string[] = [
    "ALL_ATTENDANCE", 
    "Present",
    "Absent",
    "Holiday",
    "Weekly Off",
    "Present on Holiday",
    "Present on Weekly Off",
  ];
  attendanceStatusOptions.push("Leave");

  return (
    <div className="space-y-8 pb-20 px-4 max-w-7xl mx-auto">
      <div className="flex justify-between items-center border-b pb-5">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">Reports → Attendance History Ledger</h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">
            One record per employee per calendar day (server-side pagination)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => exportReport("csv")} className="bg-emerald-600 hover:bg-emerald-700 h-11 px-4 font-black gap-2 uppercase text-xs tracking-wider rounded-xl shadow-lg shadow-emerald-600/10 text-white">
            <Download className="w-4 h-4" /> Export CSV
          </Button>

          <Button onClick={printReport} className="bg-slate-900 hover:bg-slate-800 h-11 px-6 font-black gap-2 uppercase text-xs tracking-wider rounded-xl shadow-lg text-white">
            <Printer className="w-4 h-4" /> Print
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-xl rounded-2xl bg-white p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-primary" />
          <h2 className="font-black uppercase text-sm tracking-wider">Report Parameters</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">From Date</label>
            <Input type="date" value={fromDate} onChange={(e) => (setFromDate(e.target.value), setPage(1))} className="h-12 font-bold rounded-xl border-slate-200 bg-slate-50 text-slate-700" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">To Date</label>
            <Input type="date" value={toDate} onChange={(e) => (setToDate(e.target.value), setPage(1))} className="h-12 font-bold rounded-xl border-slate-200 bg-slate-50 text-slate-700" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Scope Filter by Plant</label>
            <Select value={plant} onValueChange={(v) => (setPlant(v), setPage(1))}>
              <SelectTrigger className="h-12 bg-slate-50 border border-slate-200 font-bold rounded-xl text-xs uppercase text-slate-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border border-slate-200 bg-white shadow-xl">
                <SelectItem value="all" className="font-bold text-xs uppercase">
                  All Authorized Plants
                </SelectItem>
                {authorizedPlants.map((p: any) => (
                  <SelectItem key={p.id || p._id} value={p.id || p._id} className="font-bold text-xs uppercase">
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Search (Employee Name)</label>
            <div>
              <Select
                value={search}
                onValueChange={(v) => {
                  setSearch(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-12 bg-slate-50 border border-slate-200 font-bold rounded-xl text-xs uppercase text-slate-700">
                  <SelectValue placeholder="Select employee..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl border border-slate-200 bg-white shadow-xl">
                  <SelectItem value="all" className="font-bold text-xs uppercase">
                    All Employees
                  </SelectItem>

                  <div className="max-h-64 overflow-auto">
                    {allowedEmployees
                      .filter((e: any) => (e?.name || "").trim())
                      .sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)))
                      .map((e: any) => (
                        <SelectItem
                          key={e.id || e._id || e.employeeId}
                          value={e.name}
                          className="font-bold text-xs uppercase"
                        >
                          {e.name}
                        </SelectItem>
                      ))}
                  </div>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Employee ID (exact)</label>
            <Input value={employeeId} onChange={(e) => (setEmployeeId(e.target.value), setPage(1))} placeholder="e.g. EMP001" className="h-12 font-bold rounded-xl border-slate-200 bg-slate-50 text-slate-700" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Department</label>
            <Select value={department} onValueChange={(v) => (setDepartment(v), setPage(1))}>
              <SelectTrigger className="h-12 bg-slate-50 border border-slate-200 font-bold rounded-xl text-xs uppercase text-slate-700">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border border-slate-200 bg-white shadow-xl">
                <SelectItem value="ALL" className="font-bold text-xs uppercase">All</SelectItem>
                {uniqueDepartments.map((d) => (
                  <SelectItem key={d} value={d} className="font-bold text-xs uppercase">
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Designation</label>
            <Select value={designation} onValueChange={(v) => (setDesignation(v), setPage(1))}>
              <SelectTrigger className="h-12 bg-slate-50 border border-slate-200 font-bold rounded-xl text-xs uppercase text-slate-700">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border border-slate-200 bg-white shadow-xl">
                <SelectItem value="ALL" className="font-bold text-xs uppercase">All</SelectItem>
                {uniqueDesignations.map((d) => (
                  <SelectItem key={d} value={d} className="font-bold text-xs uppercase">
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Attendance Status</label>
            <Select value={attendanceStatus} onValueChange={(v) => (setAttendanceStatus(v), setPage(1))}>
              <SelectTrigger className="h-12 bg-slate-50 border border-slate-200 font-bold rounded-xl text-xs uppercase text-slate-700">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border border-slate-200 bg-white shadow-xl">
                {attendanceStatusOptions.map((s) => (
                  <SelectItem
                    key={s}
                    value={s}
                    className="font-bold text-xs uppercase"
                  >
                    {s === "ALL_ATTENDANCE" ? "All" : s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Processed By</label>
            <Input value={processedBy} onChange={(e) => (setProcessedBy(e.target.value), setPage(1))} placeholder="e.g. HR/ADMIN/Name" className="h-12 font-bold rounded-xl border-slate-200 bg-slate-50 text-slate-700" />
          </div>
        </div>
      </Card>

      <Card className="border-none shadow-2xl overflow-hidden rounded-2xl bg-white">
        <CardHeader className="bg-slate-900 text-white flex flex-row items-center justify-between p-6 shrink-0">
          <div>
            <CardTitle className="uppercase font-black tracking-tight text-lg">Attendance History Ledger</CardTitle>
            <p className="text-[10px] text-primary font-black uppercase tracking-widest mt-1">
              {fromDate} → {toDate}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={String(pageSize)} onValueChange={(v) => (setPageSize(v as any), setPage(1))}>
              <SelectTrigger className="h-10 bg-white/10 border-white/20 rounded-xl w-[160px] text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border border-slate-200 bg-white shadow-xl">
                {ROWS_PAGE_SIZES.map((s) => (
                  <SelectItem key={s} value={String(s)} className="font-bold text-xs uppercase">
                    {s} Records
                  </SelectItem>
                ))}
                <SelectItem value="ALL" className="font-bold text-xs uppercase">
                  All Records
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <ScrollArea className="w-full">
            <Table className="min-w-[1400px]">
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-black text-[10px] uppercase tracking-widest py-4 px-4 text-slate-500">#</TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-widest py-4 px-4 cursor-pointer text-slate-500" onClick={() => onToggleSort("employeeId")}>
                    Employee ID <ArrowUpDown className="inline-block w-3 h-3 ml-2 text-slate-400" />
                  </TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-widest py-4 px-4 cursor-pointer text-slate-500" onClick={() => onToggleSort("employeeName")}>
                    Employee Name <ArrowUpDown className="inline-block w-3 h-3 ml-2 text-slate-400" />
                  </TableHead>
<TableHead className="font-black text-[10px] uppercase tracking-widest py-4 px-4 text-slate-500">Department / Designation</TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-widest py-4 px-4 text-slate-500">Session</TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-widest py-4 px-4 text-slate-500">In Plant</TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-widest py-4 px-4 text-slate-500">In Date & Time</TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-widest py-4 px-4 text-slate-500">Out Date & Time</TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-widest py-4 px-4 text-primary">Working Hours</TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-widest py-4 px-4 text-slate-500">In Location</TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-widest py-4 px-4 text-slate-500">Out Location</TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-widest py-4 px-4 text-slate-500">Out Plant</TableHead>

                  <TableHead className="font-black text-[10px] uppercase tracking-widest py-4 px-4 cursor-pointer text-slate-500" onClick={() => onToggleSort("attendanceStatus")}>
                    Attendance Status <ArrowUpDown className="inline-block w-3 h-3 ml-2 text-slate-400" />
                  </TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-widest py-4 px-4 text-slate-500">Approval Status</TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-widest py-4 px-4 text-slate-500">Approved By</TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-widest py-4 px-4 text-slate-500">Remarks</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={15} className="text-center py-20 text-slate-400 font-bold">
                      Loading Report Data...
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={15} className="text-center py-20 text-slate-400 font-bold italic">
                      No records found for the current selection.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r, idx) => {
                    const rowIndex = meta?.pageSize === "ALL" ? idx + 1 : idx + 1 + (meta?.page - 1) * Number(meta?.pageSize || pageSize === "ALL" ? 0 : pageSize);
                    return (
                      <TableRow key={`${r.employeeId}:${r.date}:${idx}`} className="hover:bg-slate-50/50 transition-colors">
                        <TableCell className="px-4 py-3 text-xs font-bold text-slate-700">{rowIndex}</TableCell>
                        <TableCell className="px-4 py-3 text-xs font-bold text-slate-700">{r.employeeId}</TableCell>
                        <TableCell className="px-4 py-3 text-xs font-bold text-slate-700">{r.employeeName}</TableCell>
<TableCell className="px-4 py-3 text-xs font-bold text-slate-700 max-w-[200px] truncate">{r.department} / {r.designation}</TableCell>
                        <TableCell className={cn("px-4 py-3 text-xs font-black", r.isDayTotal ? "text-primary uppercase" : "text-slate-600")}>
                          {r.isDayTotal ? "Day Total" : (r.session || "1")}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-xs font-medium text-slate-500">{r.inPlant || "--"}</TableCell>
                        <TableCell className="px-4 py-3 text-xs font-bold text-slate-600 whitespace-nowrap">{r.inDateTime}</TableCell>
                        <TableCell className="px-4 py-3 text-xs font-bold text-slate-600 whitespace-nowrap">{r.outDateTime}</TableCell>
                        
                        <TableCell className="px-4 py-3 whitespace-nowrap">
                          <span className={cn("font-mono text-xs shadow-none", getWorkingHoursColorClass(r.workingHours))}>
                            {r.workingHours}
                          </span>
                        </TableCell>
                        
                        <TableCell className="px-4 py-3 text-xs font-medium text-slate-500 max-w-[200px] truncate" title={r.inLocation}>{r.inLocation}</TableCell>
                        <TableCell className="px-4 py-3 text-xs font-medium text-slate-500 max-w-[200px] truncate" title={r.outLocation}>{r.outLocation}</TableCell>
                        <TableCell className="px-4 py-3 text-xs font-bold text-slate-500">{r.outPlant || "--"}</TableCell>

                        <TableCell className="px-4 py-3">
                          <Badge className={cn("font-black text-[10px] px-2 py-1 border shadow-none whitespace-nowrap", attendanceBadgeClasses(r.attendanceStatus))}>
                            {r.attendanceStatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <Badge className={cn("font-black text-[10px] px-2 py-1 border shadow-none whitespace-nowrap", approvalBadgeClasses(r.approvalStatus))}>{r.approvalStatus}</Badge>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-xs font-bold text-slate-700 whitespace-nowrap">{r.approvedBy}</TableCell>
                        <TableCell className="px-4 py-3 text-xs font-medium text-slate-500 whitespace-nowrap">{r.remarks}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardContent>

        <CardFooter className="bg-slate-50 border-t flex items-center justify-between p-4">
          <div className="text-xs font-black text-slate-500 uppercase tracking-widest">
            Total Employees: {meta?.totalEmployees ?? 0} | Total Records: {meta?.totalRecords ?? 0}
          </div>
          {pageSize !== "ALL" && (
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="font-bold h-9">
                Prev
              </Button>
              <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Page {meta?.page ?? page}</span>
              <Button variant="outline" size="sm" disabled={meta?.totalPages ? page >= meta.totalPages : rows.length < 1} onClick={() => setPage((p) => p + 1)} className="font-bold h-9">
                Next
              </Button>
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}