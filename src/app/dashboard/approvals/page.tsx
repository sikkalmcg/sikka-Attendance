"use client";

import { differenceInCalendarDays } from "date-fns";
import { useState, useMemo, useEffect } from "react";
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableRow, 
  TableHead, 
  TableCell 
} from "@/components/ui/table";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  XCircle, 
  RotateCcw,
  Building2,
  Pencil,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  UserCheck,
  AlertCircle,
  CheckSquare,
  CalendarDays,
  LogOut,
  Eye,
  MapPin
} from "lucide-react";
import { cn, formatDate, formatHoursToHHMM, isEmployeeActiveOnDate } from "@/lib/utils";
import { useData } from "@/context/data-context";
import { parseISO, format, addHours, isSunday, isBefore, startOfMonth, eachDayOfInterval, isValid, startOfDay, endOfMonth, startOfToday } from "date-fns";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

const ITEMS_PER_PAGE = 15;
const LEAVE_ITEMS_PER_PAGE = 10;
const PROJECT_START_DATE_STR = "2026-04-01";

interface AttendanceItem {
  id: string;
  _id?: string;
  employeeId: string;
  employeeName: string;
  date: string;
  inDate?: string;
  outDate?: string;
  inTime: string | null;
  outTime: string | null;
  hours: number;
  status: string;
  attendanceType: string;
  approved: boolean | string;
  inPlant?: string;
  remark?: string | null;
  address?: string;
  addressOut?: string;
  lat?: number;
  lng?: number;
  latOut?: number;
  lngOut?: number;
  isVirtual?: boolean;
  dept?: string;
  desig?: string;
  leaveType?: string;
  leaveStatus?: string;
  workingHourDisplay?: string;
  autoCheckout?: boolean;
  autoOut?: boolean;
  displayStatus: string;
  approvedBy?: string | null;
  editedBy?: string | null;
  approvalActionDate?: string | null;
}

interface LeaveRequestItem {
  id: string;
  employeeId: string;
  employeeName: string;
  department?: string;
  designation?: string;
  purpose: string;
  fromDate: string;
  toDate: string;
  days: number;
  remark?: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'UNDER_PROCESS' | 'APPROVED' | 'REJECTED';
  processedByUserId?: string;
  processedAt?: string;
}

function StandardPaginationFooter({ current, total, onPageChange }: { current: number, total: number, onPageChange: (p: number) => void }) {
  if (total <= 1) return null;
  return (
    <CardFooter className="bg-slate-50 border-t flex items-center justify-between p-4">
      <Button variant="outline" size="sm" disabled={current === 1} onClick={() => onPageChange(current - 1)} className="font-bold h-9"><ChevronLeft className="w-4 h-4 mr-1" /> Prev</Button>
      <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Page {current} of {total}</span>
      <Button variant="outline" size="sm" disabled={current === total} onClick={() => onPageChange(current + 1)} className="font-bold h-9">Next <ChevronRight className="w-4 h-4 ml-1" /></Button>
    </CardFooter>
  );
}

export default function ApprovalsPage() {
  const contextData = useData();
  const { attendanceRecords = [], employees = [], updateRecord, addRecord, refreshData, verifiedUser, holidays = [], plants = [], leaveRequests = [] } = contextData;
  
  const updateLeaveRequest = (contextData as any).updateLeaveRequest || (contextData as any).updateRecord;

  const [isMounted, setIsMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("attendance"); // attendance, leaves, exits
  const [selectedPlantFilter, setSelectedPlantFilter] = useState<string>("ALL");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("ALL");
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>("");

  const [historyMonthFilter, setHistoryMonthFilter] = useState("");
  const [pendingPage, setPendingPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [attendanceView, setAttendanceView] = useState("pending"); // pending, history
  const [leaveView, setLeaveView] = useState("pending"); // pending, history

  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());
  const [isBulkApproveConfirmOpen, setIsBulkApproveConfirmOpen] = useState(false);

  const [selectedAttendance, setSelectedAttendance] = useState<AttendanceItem | null>(null);
  const [isApproveConfirmOpen, setIsApproveConfirmOpen] = useState(false);
  const [isAttendanceRejectOpen, setIsAttendanceRejectOpen] = useState(false);
  const [attendanceRejectReason, setAttendanceRejectReason] = useState("");

  const [selectedLeaveRequest, setSelectedLeaveRequest] = useState<LeaveRequestItem | null>(null);
  const [isLeaveApproveOpen, setIsLeaveApproveOpen] = useState(false);
  const [isLeaveRejectOpen, setIsLeaveRejectOpen] = useState(false);
  const [leaveRejectReason, setLeaveRejectReason] = useState("");
  const [editLeaveData, setEditLeaveData] = useState<{ fromDate: string, toDate: string, days?: number }>({ fromDate: "", toDate: "" });
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editData, setEditData] = useState({ 
    plant: "", 
    inDate: "", 
    inTime: "", 
    outDate: "", 
    outTime: "", 
    remark: "" 
  });

  // Exit Tracking State
  const [selectedExitEvent, setSelectedExitEvent] = useState<any>(null);
  const [isExitDetailsOpen, setIsExitDetailsOpen] = useState(false);

  const [localApprovals, setLocalApprovals] = useState<Record<string, boolean>>({});
  const [localEdits, setLocalEdits] = useState<Record<string, Partial<AttendanceItem>>>({});

  const { toast } = useToast();
  const filterMonths = useMemo(() => {
    const options = [];
    const date = new Date();
    for (let i = -6; i < 12; i++) {
      const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
      if (isBefore(d, startOfMonth(parseISO(PROJECT_START_DATE_STR)))) continue;
      const mmm = d.toLocaleString('en-US', { month: 'short' });
      const yy = d.getFullYear().toString().slice(-2);
      options.push(`${mmm}-${yy}`);
    }
    return options;
  }, []);

  useEffect(() => {
    setIsMounted(true);
    const now = new Date();
    const mmm = now.toLocaleString('en-US', { month: 'short' });
    const yy = now.getFullYear().toString().slice(-2);
    setHistoryMonthFilter(`${mmm}-${yy}`);
  }, []);

  useEffect(() => {
    setSelectedDateFilter("");
    setSelectedStatusFilter("ALL");
    setSelectedRecordIds(new Set());
    setSearchTerm("");
  }, [viewMode]);

  useEffect(() => {
    setPendingPage(1);
    setHistoryPage(1);
    setSelectedRecordIds(new Set());
  }, [attendanceView, selectedPlantFilter, selectedStatusFilter, historyMonthFilter, searchTerm, selectedDateFilter]);

  const userAssignedPlantIds = useMemo(() => {
    if (!verifiedUser || verifiedUser.role === 'SUPER_ADMIN') return null;
    return verifiedUser.plantIds || [];
  }, [verifiedUser]);

  const authorizedPlants = useMemo(() => {
    if (!userAssignedPlantIds) return plants;
    return plants.filter(p => userAssignedPlantIds.includes(p.id));
  }, [userAssignedPlantIds, plants]);

  const approvedLeavesMap = useMemo(() => {
    const map = new Map<string, any>();
    if (!leaveRequests) return map;
    leaveRequests.filter(l => {
      const statusStr = String(l.status).toUpperCase();
      return statusStr === 'APPROVED';
    }).forEach(l => {
      const start = startOfDay(parseISO(l.fromDate));
      const end = startOfDay(parseISO(l.toDate));
      if (!isValid(start) || !isValid(end)) return;
      eachDayOfInterval({ start, end }).forEach(d => {
        map.set(`${l.employeeId}:${format(d, 'yyyy-MM-dd')}`, l);
      });
    });
    return map;
  }, [leaveRequests]);

  const getCalculatedStatus = (dateStr: string, record: any, empId: string) => {
    const isSun = isSunday(parseISO(dateStr));
    const customHoliday = (holidays || []).find(h => h.date === dateStr && !h.auto);
    const approvedLeave = approvedLeavesMap.get(`${empId}:${dateStr}`);

    if (record && record.inTime) {
      if (isSun) return "Present on Weekly Off";
      if (customHoliday) return "Present on Holiday";
      return "Present";
    }

    if (approvedLeave) return "Absent on Leave";
    if (isSun) return "Weekly Off";
    if (customHoliday) return "Holiday";
    
    return "Absent";
  };

  const allAttendanceList = useMemo(() => {
    if (!isMounted) return [];
    const now = new Date();
    const employeeMap = new Map((employees || []).map(e => [e.employeeId, e]));
    
    const actual = (attendanceRecords || []).filter(rec => {
      const emp = employeeMap.get(rec.employeeId);
      if (!emp) return false;
      if (!isEmployeeActiveOnDate(emp, rec.date)) return false;
      if (!userAssignedPlantIds) return true;
      return (emp.unitIds || []).some(id => userAssignedPlantIds.includes(id)) || userAssignedPlantIds.includes(emp.unitId);
    }).map(rec => {
      const emp = employeeMap.get(rec.employeeId);
      const leave = approvedLeavesMap.get(`${rec.employeeId}:${rec.date}`);
      const recId = rec.id || (rec as any)._id || `${rec.employeeId}:${rec.date}`;
      
      const currentApprovalState = localApprovals[recId] !== undefined ? localApprovals[recId] : rec.approved;
      const cachedEdit = localEdits[recId] || {};

      let processedRec: any = { 
        ...rec, 
        dept: emp?.department || "N/A", 
        desig: emp?.designation || "N/A",
        inDate: rec.inDate || rec.date,
        outDate: rec.outDate || rec.date,
        leaveType: leave ? leave.purpose : "-",
        leaveStatus: leave ? "Approved" : "-",
        workingHourDisplay: formatHoursToHHMM(rec.hours || 0),
        approved: currentApprovalState === true || String(currentApprovalState) === "true",
        ...cachedEdit
      };
      
      if (cachedEdit.hours !== undefined) {
        processedRec.workingHourDisplay = formatHoursToHHMM(cachedEdit.hours);
      }
      
      if (!processedRec.outTime && processedRec.inTime && processedRec.inTime.trim() !== "") {
        const inDT = parseISO(processedRec.inDateTime || `${processedRec.inDate}T${processedRec.inTime}:00`);
        if (inDT && isValid(inDT)) {
          const diffHours = (now.getTime() - inDT.getTime()) / (1000 * 60 * 60);
          if (diffHours >= 16) {
             processedRec.autoCheckout = true;
             processedRec.hours = 16.0;
             processedRec.workingHourDisplay = "16:00";
          }
        }
      }
      
      processedRec.displayStatus = getCalculatedStatus(processedRec.date, processedRec, processedRec.employeeId);
      return processedRec as AttendanceItem;
    });

    const missing: AttendanceItem[] = [];
    const projectStartDate = parseISO(PROJECT_START_DATE_STR);
    const handledRecordsKeySet = new Set(actual.map(r => `${r.employeeId}:${r.date}`));

    if (isBefore(projectStartDate, now)) {
      let generationEndDate = now;
      if (historyMonthFilter && historyMonthFilter !== 'all') {
         const [mmm, yy] = historyMonthFilter.split('-');
         const filterDate = parseISO(`20${yy}-${mmm}-01`);
         const lastDayOfFilterMonth = endOfMonth(filterDate);
         generationEndDate = isBefore(lastDayOfFilterMonth, now) ? lastDayOfFilterMonth : now;
      }

      const intervalDates = eachDayOfInterval({ 
        start: projectStartDate, 
        end: generationEndDate
      }).map(d => format(d, "yyyy-MM-dd"));
      
      (employees || []).forEach(emp => {
        if (userAssignedPlantIds) {
          const hasAccess = (emp.unitIds || []).some(id => userAssignedPlantIds.includes(id)) || userAssignedPlantIds.includes(emp.unitId);
          if (!hasAccess) return;
        }

        intervalDates.forEach(dStr => {
          if (!isEmployeeActiveOnDate(emp, dStr)) return;
          const key = `${emp.employeeId}:${dStr}`;
          const virtualKey = `v-abs-${emp.employeeId}-${dStr}`;
          
          if (!handledRecordsKeySet.has(key)) {
            const currentApprovalState = localApprovals[virtualKey] !== undefined ? localApprovals[virtualKey] : false;
            const cachedEdit = localEdits[virtualKey] || {};
            const displayStatus = getCalculatedStatus(dStr, null, emp.employeeId);
            const leave = approvedLeavesMap.get(`${emp.employeeId}:${dStr}`);
            
            let virtualItem: any = { 
              id: virtualKey, 
              employeeId: emp.employeeId, 
              employeeName: emp.firstName ? `${emp.firstName} ${emp.lastName || ''}`.trim() : emp.name, 
              date: dStr, 
              status: 'ABSENT', 
              displayStatus, 
              attendanceType: 'ABSENT', 
              approved: currentApprovalState, 
              dept: emp.department || "Operations", 
              desig: emp.designation || "Staff", 
              isVirtual: true, 
              hours: 0, 
              workingHourDisplay: "00:00",
              inTime: null,
              outTime: null,
              remark: null,
              leaveType: leave ? leave.purpose : "-",
              leaveStatus: leave ? "Approved" : "-",
              ...cachedEdit
            };

            if (cachedEdit.hours !== undefined) {
              virtualItem.workingHourDisplay = formatHoursToHHMM(cachedEdit.hours);
            }

            missing.push(virtualItem as AttendanceItem);
          }
        });
      });
    }

    let combined = [...actual, ...missing];

    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      combined = combined.filter(rec => 
        (rec.employeeName || "").toLowerCase().includes(s) || 
        (rec.employeeId || "").toLowerCase().includes(s)
      );
    }

    if (selectedDateFilter) {
      combined = combined.filter(rec => rec.date === selectedDateFilter);
    }

    if (selectedPlantFilter !== "ALL") {
      combined = combined.filter(rec => {
        if (!rec.isVirtual) return rec.inPlant === selectedPlantFilter;
        const emp = employeeMap.get(rec.employeeId);
        const targetPlant = plants.find(p => p.name === selectedPlantFilter);
        return (emp?.unitIds || []).includes(targetPlant?.id || (targetPlant as any)?._id || "");
      });
    }

    return combined;
  }, [attendanceRecords, employees, isMounted, holidays, userAssignedPlantIds, selectedPlantFilter, searchTerm, selectedDateFilter, plants, approvedLeavesMap, historyMonthFilter, localApprovals, localEdits]);

  const pendingAttendanceList = useMemo(() => {
    return allAttendanceList.filter(rec => {
      const matchesApproval = !rec.approved;
      const matchesStatus = selectedStatusFilter === "ALL" ? true : rec.displayStatus === selectedStatusFilter;
      return matchesApproval && matchesStatus;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [allAttendanceList, selectedStatusFilter]);

  const historyAttendanceList = useMemo(() => {
    return allAttendanceList.filter(rec => {
      const matchesApproval = rec.approved;
      if (!matchesApproval) return false;
      
      if (historyMonthFilter && historyMonthFilter !== 'all') {
        const [mmm, yy] = historyMonthFilter.toLowerCase().split('-');
        const shortMonths = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
        const targetMonthIdx = shortMonths.indexOf(mmm);
        const targetYear = 2000 + parseInt(yy);
        
        const recDate = parseISO(rec.date);
        return recDate.getMonth() === targetMonthIdx && recDate.getFullYear() === targetYear;
      }
      return true;
    }).sort((a, b) => b.date.localeCompare(a.date) || a.employeeName.localeCompare(b.employeeName));
  }, [allAttendanceList, historyMonthFilter]);

  const allPlantExitHistory = useMemo(() => {
    const exits: any[] = [];
    const employeeMap = new Map((employees || []).map(e => [e.employeeId, e]));

    (attendanceRecords || []).forEach((record: any) => {
      const emp = employeeMap.get(record.employeeId);
      if (userAssignedPlantIds) {
        const hasAccess = (emp?.unitIds || []).some(id => userAssignedPlantIds.includes(id)) || userAssignedPlantIds.includes(emp?.unitId || "");
        if (!hasAccess) return;
      }

      if (record.exitEvents && Array.isArray(record.exitEvents)) {
        record.exitEvents.forEach((event: any) => {
          exits.push({
            ...event,
            employeeId: record.employeeId,
            employeeName: record.employeeName,
            date: record.date,
            inTime: record.inTime,
            outTime: record.outTime,
            plantName: record.inPlant || "Salt Plant",
            attendanceId: record.id || record._id
          });
        });
      }
    });

    let filteredExits = exits;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      filteredExits = filteredExits.filter(e => 
        (e.employeeName || "").toLowerCase().includes(s) || 
        (e.employeeId || "").toLowerCase().includes(s)
      );
    }
    if (selectedPlantFilter !== "ALL") {
      filteredExits = filteredExits.filter(e => e.plantName === selectedPlantFilter);
    }
    if (selectedDateFilter) {
      filteredExits = filteredExits.filter(e => e.date === selectedDateFilter);
    }

    return filteredExits.sort((a, b) => b.exitTime.localeCompare(a.exitTime));
  }, [attendanceRecords, employees, userAssignedPlantIds, searchTerm, selectedPlantFilter, selectedDateFilter]);

  const currentData = useMemo(() => {
    const list = attendanceView === 'pending' ? pendingAttendanceList : historyAttendanceList;
    const page = attendanceView === 'pending' ? pendingPage : historyPage;
    const start = (page - 1) * ITEMS_PER_PAGE;
    return { 
      items: list.slice(start, start + ITEMS_PER_PAGE), 
      total: list.length, 
      totalPages: Math.ceil(list.length / ITEMS_PER_PAGE) 
    };
  }, [pendingAttendanceList, historyAttendanceList, pendingPage, historyPage, attendanceView]);

  const handleOpenApproveConfirmation = (rec: AttendanceItem) => {
    setSelectedAttendance(rec);
    setIsApproveConfirmOpen(true);
  };

  const handleConfirmApproval = async () => {
    if (!selectedAttendance) return;
    
    const rec = selectedAttendance;
    const recId = rec.id || (rec as any)._id || `${rec.employeeId}:${rec.date}`;
    const approverName = verifiedUser?.fullName || "HR_ADMIN";

    setIsApproveConfirmOpen(false);
    setLocalApprovals(prev => ({ ...prev, [recId]: true }));
    toast({ title: "Attendance approved successfully and moved to History." });

    const runApprovalTask = async () => {
      try {
        let finalOutTime = rec.outTime;
        let finalOutDate = rec.outDate || rec.date;
        let finalHours = rec.hours || 0;

        if (!rec.isVirtual && rec.autoCheckout && !rec.outTime) {
          const inDT = parseISO(`${rec.inDate || rec.date}T${rec.inTime || "00:00"}:00`);
          if (inDT && isValid(inDT)) {
            const autoOutDT = addHours(inDT, 16);
            finalOutTime = format(autoOutDT, "HH:mm");
            finalOutDate = format(autoOutDT, "yyyy-MM-dd");
            finalHours = 16.0;
          }
        }

        const finalRemarks = (rec.autoCheckout && !rec.remark) ? "System Auto-Logged OUT (16h Limit Threshold reached)" : rec.remark;

        if (rec.isVirtual) {
          await addRecord('attendance', {
            employeeId: rec.employeeId,
            employeeName: rec.employeeName,
            date: rec.date,
            status: 'ABSENT',
            attendanceType: rec.attendanceType || 'ABSENT',
            approved: true,
            approvedBy: approverName,
            remark: finalRemarks || "Approved as Absent",
          });
        } else {
          const finalDbId = rec.id || (rec as any)._id;
          await updateRecord('attendance', finalDbId, {
            outTime: finalOutTime || null,
            outDate: finalOutDate || null,
            hours: finalHours,
            approved: true,
            approvedBy: approverName,
            remark: finalRemarks,
          });
        }
      } catch (e) {
        setLocalApprovals(prev => ({ ...prev, [recId]: false }));
      } finally {
        setSelectedAttendance(null);
      }
    };

    runApprovalTask();
  };

  const toggleRecordSelection = (id: string) => {
    const newSet = new Set(selectedRecordIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedRecordIds(newSet);
  };

  const toggleAllSelection = () => {
    const selectableItems = currentData.items.filter((r: any) => r.isVirtual || (r.inTime && (r.outTime || r.autoCheckout)));
    const allSelected = selectableItems.every((r: any) => selectedRecordIds.has(r.id || (r as any)._id || `${r.employeeId}:${r.date}`));
    
    if (allSelected && selectableItems.length > 0) {
      setSelectedRecordIds(new Set());
    } else {
      const newSet = new Set<string>();
      selectableItems.forEach((r: any) => {
        newSet.add(r.id || (r as any)._id || `${r.employeeId}:${r.date}`);
      });
      setSelectedRecordIds(newSet);
    }
  };

  const handleBulkApprove = async () => {
    setIsBulkApproveConfirmOpen(false);
    const approverName = verifiedUser?.fullName || "HR_ADMIN";
    
    const recordsToApprove = pendingAttendanceList.filter(r => {
      const rId = r.id || (r as any)._id || `${r.employeeId}:${r.date}`;
      return selectedRecordIds.has(rId);
    });

    const newApprovals = { ...localApprovals };
    recordsToApprove.forEach(r => {
      const rId = r.id || (r as any)._id || `${r.employeeId}:${r.date}`;
      newApprovals[rId] = true;
    });
    setLocalApprovals(newApprovals);
    setSelectedRecordIds(new Set());
    toast({ title: `Bulk approved ${recordsToApprove.length} records successfully.` });

    const runBulkTask = async () => {
      const promises = recordsToApprove.map(async (rec) => {
        try {
          let finalOutTime = rec.outTime;
          let finalOutDate = rec.outDate || rec.date;
          let finalHours = rec.hours || 0;

          if (!rec.isVirtual && rec.autoCheckout && !rec.outTime) {
            const inDT = parseISO(`${rec.inDate || rec.date}T${rec.inTime || "00:00"}:00`);
            if (inDT && isValid(inDT)) {
              const autoOutDT = addHours(inDT, 16);
              finalOutTime = format(autoOutDT, "HH:mm");
              finalOutDate = format(autoOutDT, "yyyy-MM-dd");
              finalHours = 16.0;
            }
          }

          const finalRemarks = (rec.autoCheckout && !rec.remark) ? "System Auto-Logged OUT (16h Limit Threshold reached)" : rec.remark;

          if (rec.isVirtual) {
            await addRecord('attendance', {
              employeeId: rec.employeeId,
              employeeName: rec.employeeName,
              date: rec.date,
              status: 'ABSENT',
              attendanceType: rec.attendanceType || 'ABSENT',
              approved: true,
              approvedBy: approverName,
              remark: finalRemarks || "Approved as Absent",
            }, true);
          } else {
            const finalDbId = rec.id || (rec as any)._id;
            await updateRecord('attendance', finalDbId, {
              outTime: finalOutTime || null,
              outDate: finalOutDate || null,
              hours: finalHours,
              approved: true,
              approvedBy: approverName,
              remark: finalRemarks,
            }, true);
          }
        } catch (e) {
          console.error("Bulk approve failed for", rec.id || (rec as any)._id, e);
        }
      });
      await Promise.all(promises);
      await refreshData();
    };

    runBulkTask();
  };

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

  const handleOpenEditModal = (rec: AttendanceItem) => {
    setSelectedAttendance(rec);
    setEditData({
      plant: rec.inPlant || "Salt Plant",
      inDate: rec.inDate || rec.date,
      inTime: rec.inTime || "",
      outDate: rec.outDate || rec.date,
      outTime: rec.outTime || "",
      remark: ""
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateAttendance = async () => {
    if (!selectedAttendance) return;

    if (!editData.plant || !editData.inDate || !editData.inTime || !editData.outDate || !editData.outTime || !editData.remark.trim()) {
      toast({ variant: "destructive", title: "Incomplete Form", description: "All fields including modification remarks are mandatory." });
      return;
    }

    if (editData.remark.trim().length < 3) {
      toast({ variant: "destructive", title: "Invalid Remark", description: "Please enter a valid descriptive adjustment audit remark." });
      return;
    }

    const recId = selectedAttendance.id || (selectedAttendance as any)._id || `${selectedAttendance.employeeId}:${selectedAttendance.date}`;
    const inDT = parseISO(`${editData.inDate}T${editData.inTime}:00`);
    const outDT = parseISO(`${editData.outDate}T${editData.outTime}:00`);

    if (!isValid(inDT) || !isValid(outDT)) {
      toast({ variant: "destructive", title: "Invalid Timestamps", description: "Provided date or time formatting strings broken." });
      return;
    }

    if (isBefore(outDT, inDT)) {
      toast({ 
        variant: "destructive", 
        title: "Chronology Error", 
        description: "OUT session checkpoint cannot exist before the IN session checkpoint." 
      });
      return;
    }

    let calculatedHours = (outDT.getTime() - inDT.getTime()) / (1000 * 60 * 60);
    
    if (calculatedHours <= 0) {
      toast({ 
        variant: "destructive", 
        title: "Zero Duration Conflict", 
        description: "OUT time must be later than IN time to calculate valid shift sessions." 
      });
      return;
    }

    setIsEditModalOpen(false);

    setLocalEdits(prev => ({
      ...prev,
      [recId]: {
        inPlant: editData.plant,
        inDate: editData.inDate,
        inTime: editData.inTime,
        outDate: editData.outDate,
        outTime: editData.outTime,
        hours: calculatedHours,
        remark: editData.remark
      }
    }));
    
    toast({ title: "Attendance Entry Verified & Updated" });

    const commitSilentUpdate = async () => {
      try {
        const modifierName = verifiedUser?.fullName || "HR_ADMIN";
        const finalDbId = selectedAttendance.id && !selectedAttendance.id.startsWith('v-') ? selectedAttendance.id : ((selectedAttendance as any)._id || '');

        if (selectedAttendance.isVirtual) {
          await addRecord('attendance', {
            inPlant: editData.plant,
            inDate: editData.inDate,
            inTime: editData.inTime,
            outDate: editData.outDate,
            outTime: editData.outTime,
            hours: calculatedHours,
            remark: editData.remark,
            employeeId: selectedAttendance.employeeId,
            employeeName: selectedAttendance.employeeName,
            date: selectedAttendance.date,
            status: 'PRESENT',
            attendanceType: 'OFFICE',
            approved: false,
            address: 'Manually Created Log',
            unapprovedOutDuration: 0
          });
        } else {
          await updateRecord('attendance', finalDbId, {
            inPlant: editData.plant,
            inDate: editData.inDate,
            inTime: editData.inTime,
            outDate: editData.outDate,
            outTime: editData.outTime,
            hours: calculatedHours,
            remark: editData.remark,
            editedBy: modifierName,
            editedAt: new Date().toISOString()
          });
        }
      } catch (e) {
        setLocalEdits(prev => {
          const fresh = { ...prev };
          delete fresh[recId];
          return fresh;
        });
      }
    };

    setTimeout(commitSilentUpdate, 0);
    setSelectedAttendance(null);
  };

  const handlePostAttendanceReject = async () => {
    if (!selectedAttendance || !attendanceRejectReason.trim()) return;
    setIsAttendanceRejectOpen(false);
    const rec = selectedAttendance;

    const recId = rec.id || (rec as any)._id || `${rec.employeeId}:${rec.date}`;
    const approver = verifiedUser?.fullName || "HR_ADMIN";

    setLocalApprovals(prev => ({ ...prev, [recId]: true }));
    setLocalEdits(prev => ({
      ...prev,
      [recId]: {
        inTime: null,
        outTime: null,
        hours: 0,
        workingHourDisplay: "00:00",
        displayStatus: "Absent",
        remark: attendanceRejectReason
      }
    }));
    
    toast({ title: "Log Rejected Successfully", description: "Record has been invalidated and moved to History Queue." });

    const runSilentRejection = async () => {
      try {
        if (rec.isVirtual) {
          await addRecord('attendance', {
            employeeId: rec.employeeId,
            employeeName: rec.employeeName,
            date: rec.date,
            status: 'REJECTED',
            attendanceType: 'ABSENT',
            approved: true,
            approvedBy: approver,
            remark: attendanceRejectReason,
          });
        } else {
          const finalDbId = rec.id || (rec as any)._id;
          await updateRecord('attendance', finalDbId, {
            status: 'REJECTED',
            hours: 0,
            attendanceType: 'ABSENT',
            approved: true,
            approvedBy: approver,
            remark: attendanceRejectReason,
          });
        }
      } catch (e) {
        setLocalApprovals(prev => ({ ...prev, [recId]: false }));
        setLocalEdits(prev => {
          const fresh = { ...prev };
          delete fresh[recId];
          return fresh;
        });
        toast({ variant: "destructive", title: "Action Failed", description: "Rejection failed to sync." });
      }
    };

    setTimeout(runSilentRejection, 0);
    setAttendanceRejectReason("");
    setSelectedAttendance(null);
  };

  const handleRestoreAttendance = (rec: AttendanceItem) => {
    if (rec.isVirtual) return; 
    const recId = rec.id || (rec as any)._id || '';

    setLocalApprovals(prev => ({ ...prev, [recId]: false }));
    toast({ title: "Record Restored", description: "Moved back to Pending queue." });

    const runRestoreTask = async () => {
      try {
        const finalDbId = rec.id || (rec as any)._id;
        await updateRecord('attendance', finalDbId, {
          approved: false,
          approvedBy: null,
          editedBy: null
        });
      } catch (e) {
        setLocalApprovals(prev => ({ ...prev, [recId]: true }));
      }
    };

    runRestoreTask();
  };

  const handleOpenExitDetails = (event: any) => {
    setSelectedExitEvent(event);
    setIsExitDetailsOpen(true);
  };

  // --- Leave Management Handlers ---

  const pendingLeaveRequests = useMemo(() => {
    return (leaveRequests || []).filter(l => {
      const status = String(l.status).toUpperCase();
      return status === 'PENDING' || status === 'UNDER_PROCESS';
    }) as LeaveRequestItem[];
  }, [leaveRequests]);

  const approvedLeaveRequests = useMemo(() => {
    return (leaveRequests || []).filter(l => {
      const status = String(l.status).toUpperCase();
      return status === 'APPROVED';
    }) as LeaveRequestItem[];
  }, [leaveRequests]);

  const handleOpenLeaveApprove = (leave: LeaveRequestItem) => {
    setSelectedLeaveRequest(leave);
    setEditLeaveData({ fromDate: leave.fromDate, toDate: leave.toDate });
    setIsLeaveApproveOpen(true);
  };

  const handleConfirmLeaveApproval = async () => {
    if (!selectedLeaveRequest || !updateLeaveRequest) return;
  
    const days = differenceInCalendarDays(new Date(editLeaveData.toDate), new Date(editLeaveData.fromDate)) + 1;
  
    await updateLeaveRequest('leaveRequests', selectedLeaveRequest.id, {
      status: "APPROVED",
      fromDate: editLeaveData.fromDate,
      toDate: editLeaveData.toDate,
      days,
      processedByUserId: verifiedUser?.fullName || "HR_ADMIN",
      processedAt: new Date().toISOString(),
    });

    toast({ title: "Leave Approved", description: "The leave request has been approved." });
    setIsLeaveApproveOpen(false);
    setSelectedLeaveRequest(null);
  };

  const handleOpenLeaveReject = (leave: LeaveRequestItem) => {
    setSelectedLeaveRequest(leave);
    setIsLeaveRejectOpen(true);
  };

  const handleConfirmLeaveReject = async () => {
    if (!selectedLeaveRequest || !leaveRejectReason.trim() || !updateLeaveRequest) {
      toast({ variant: "destructive", title: "Reason Required", description: "Please provide a reason for rejection." });
      return;
    }

    await updateLeaveRequest('leaveRequests', selectedLeaveRequest.id, {
      status: "REJECTED",
      remark: leaveRejectReason, 
      processedByUserId: verifiedUser?.fullName || "HR_ADMIN",
      processedAt: new Date().toISOString(),
    } as any);

    toast({ title: "Leave Rejected", description: "The leave request has been rejected." });
    setIsLeaveRejectOpen(false);
    setSelectedLeaveRequest(null);
    setLeaveRejectReason("");
  };

  return (
    <div className="space-y-8 pb-12 px-4 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Staff Attendance Approvals</h1>
          <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider mt-1">Multi-Facility Compliance Oversight & Session Ledger</p>
        </div>
        <div className="flex items-center gap-3">
          {viewMode === 'attendance' && attendanceView === 'pending' && (
            <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border shadow-sm">
              <Select value={selectedStatusFilter} onValueChange={setSelectedStatusFilter}>
                <SelectTrigger className="h-8 w-[180px] border-none font-black text-xs uppercase focus:ring-0 shadow-none bg-transparent">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="font-bold text-xs uppercase">All Status</SelectItem>
                  <SelectItem value="Present" className="font-bold text-xs uppercase">Present</SelectItem>
                  <SelectItem value="Absent on Leave" className="font-bold text-xs uppercase">Absent on Leave</SelectItem>
                  <SelectItem value="Absent" className="font-bold text-xs uppercase">Absent</SelectItem>
                  <SelectItem value="Weekly Off" className="font-bold text-xs uppercase">Weekly Off</SelectItem>
                  <SelectItem value="Holiday" className="font-bold text-xs uppercase">Holiday</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {(viewMode === 'attendance' || viewMode === 'exits') && <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border shadow-sm">
             <Input 
               type="date" 
               className="h-8 border-none text-xs font-black uppercase focus:ring-0 shadow-none bg-transparent w-[130px]" 
               value={selectedDateFilter} 
               onChange={(e) => setSelectedDateFilter(e.target.value)} 
             />
             {selectedDateFilter && (
               <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-slate-600" onClick={() => setSelectedDateFilter("")}>
                 <XCircle className="w-4 h-4" />
               </Button>
             )}
          </div>}
          <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border shadow-sm">
             <Building2 className="w-4 h-4 text-primary ml-2" />
             <Select value={selectedPlantFilter} onValueChange={setSelectedPlantFilter}>
                <SelectTrigger className="h-8 w-[200px] border-none font-black text-xs uppercase focus:ring-0 shadow-none bg-transparent" id="plant-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="font-bold text-xs uppercase">All Assigned Plants</SelectItem>
                  {(authorizedPlants || []).map(p => (
                    <SelectItem key={p.id} value={p.name} className="font-bold text-xs uppercase">{p.name}</SelectItem>
                  ))}
                </SelectContent>
             </Select>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search by name or Employee ID..." className="pl-10 h-10 bg-white shadow-sm rounded-xl" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
        <Tabs value={viewMode} onValueChange={setViewMode} className="w-full md:w-auto">
          <TabsList className="grid w-full grid-cols-3 bg-slate-100 h-10 p-1 rounded-xl w-[450px]">
            <TabsTrigger value="attendance" className="text-xs font-black uppercase">Attendance</TabsTrigger>
            <TabsTrigger value="leaves" className="text-xs font-black uppercase">Leave Requests</TabsTrigger>
            <TabsTrigger value="exits" className="text-xs font-black uppercase">Facility Exits</TabsTrigger>
          </TabsList>
        </Tabs>

        {viewMode === 'attendance' && attendanceView === 'pending' && selectedRecordIds.size > 0 && (
          <Button 
            onClick={() => setIsBulkApproveConfirmOpen(true)}
            className="h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase rounded-xl shadow-md px-5"
          >
            <CheckSquare className="w-4 h-4 mr-2" /> Bulk Approve ({selectedRecordIds.size})
          </Button>
        )}
      </div>

      {viewMode === 'attendance' && (
        <>
          <Tabs value={attendanceView} onValueChange={setAttendanceView} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-slate-100 h-10 p-1 rounded-xl w-[260px]">
              <TabsTrigger value="pending" className="text-xs font-black uppercase">Pending Logs</TabsTrigger>
              <TabsTrigger value="history" className="text-xs font-black uppercase">History Queue</TabsTrigger>
            </TabsList>
          </Tabs>

          {attendanceView === 'history' && (
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl border shadow-sm">
              <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border">
                <Select value={historyMonthFilter} onValueChange={setHistoryMonthFilter}>
                  <SelectTrigger className="h-7 w-[140px] font-black text-xs uppercase bg-transparent border-none shadow-none focus:ring-0">
                      <SelectValue placeholder="Select Month" />
                  </SelectTrigger>
                  <SelectContent>
                      <SelectItem value="all" className="font-bold text-xs">All History</SelectItem>
                      {filterMonths.map(m => <SelectItem key={m} value={m} className="font-bold text-xs">{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" className="h-10 font-black text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50 gap-2 px-6 rounded-xl uppercase tracking-wider">
                <FileSpreadsheet className="w-4 h-4" /> Export Ledger csv
              </Button>
            </div>
          )}
        </>
      )}

      {viewMode === 'leaves' && (
         <Tabs value={leaveView} onValueChange={setLeaveView} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-slate-100 h-10 p-1 rounded-xl w-[260px]">
              <TabsTrigger value="pending" className="text-xs font-black uppercase">Pending Requests</TabsTrigger>
              <TabsTrigger value="history" className="text-xs font-black uppercase">Leave History</TabsTrigger>
            </TabsList>
          </Tabs>
      )}

      {viewMode === 'leaves' && leaveView === 'pending' && (
        <Card className="border-slate-200 shadow-sm overflow-hidden rounded-2xl bg-white">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Leave Type</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Remark</TableHead>
                  <TableHead className="text-right pr-6">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingLeaveRequests.map((leave: any) => {
                  // Strict Check: Kya leave ki 'To Date' aaj se purani ho chuki hai?
                  const isLeavePastThreshold = leave.toDate ? isBefore(startOfDay(parseISO(leave.toDate)), startOfToday()) : false;

                  return (
                    <TableRow key={leave.id}>
                      <TableCell>
                        <div className="font-bold">{leave.employeeName}</div>
                        <div className="text-xs text-muted-foreground">{leave.employeeId}</div>
                      </TableCell>
                      <TableCell>{leave.department}</TableCell>
                      <TableCell>{leave.purpose}</TableCell>
                      <TableCell>{formatDate(leave.fromDate)}</TableCell>
                      <TableCell>{formatDate(leave.toDate)}</TableCell>
                      <TableCell>{leave.days}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{leave.remark || '-'}</TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="outline" className="h-8 text-rose-600 border-rose-200 hover:bg-rose-50" onClick={() => handleOpenLeaveReject(leave)}>Reject</Button>
                          <Button 
                            size="sm" 
                            className={cn("h-8 bg-emerald-600 hover:bg-emerald-700", isLeavePastThreshold && "opacity-40 hover:bg-emerald-600 cursor-not-allowed")} 
                            onClick={() => !isLeavePastThreshold && handleOpenLeaveApprove(leave)}
                            disabled={isLeavePastThreshold}
                            title={isLeavePastThreshold ? "Leave date purani ho chuki hai, ise ab approve nahi kiya ja sakta." : "Approve leave"}
                          >
                            {isLeavePastThreshold ? "Expired" : "Approve"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                 {pendingLeaveRequests.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                      No pending leave requests.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {viewMode === 'attendance' && (
      <Card className="border-slate-200 shadow-sm overflow-hidden rounded-2xl bg-white">
        <CardContent className="p-0">
          <ScrollArea className="w-full">
            <Table className="min-w-[2000px]">
              <TableHeader className="bg-slate-50">
                <TableRow>
                  {attendanceView === 'pending' && (
                    <TableHead className="w-12 text-center px-4">
                      <input 
                        type="checkbox" 
                        className="rounded border-slate-300 w-4 h-4 cursor-pointer accent-emerald-600"
                        checked={currentData.items.length > 0 && currentData.items.filter((r: any) => r.isVirtual || (r.inTime && (r.outTime || r.autoCheckout))).every((r: any) => selectedRecordIds.has(r.id || (r as any)._id || `${r.employeeId}:${r.date}`))}
                        onChange={toggleAllSelection}
                      />
                    </TableHead>
                  )}
                  <TableHead className="font-black text-[11px] uppercase tracking-widest text-slate-500 py-4 px-6">Employee Name</TableHead>
                  <TableHead className="font-black text-[11px] uppercase tracking-widest text-slate-500">Date</TableHead>
                  <TableHead className="font-black text-[11px] uppercase tracking-widest text-slate-500">Attendance Status</TableHead>
                  <TableHead className="font-black text-[11px] uppercase tracking-widest text-slate-500">Plant Facility</TableHead>
                  <TableHead className="font-black text-[11px] uppercase tracking-widest text-slate-500">In Date Time</TableHead>
                  <TableHead className="font-black text-[11px] uppercase tracking-widest text-slate-500">Out Date Time</TableHead> 
                  <TableHead className="font-black text-[11px] uppercase tracking-widest text-primary">Working Hours</TableHead>
                  {attendanceView === 'history' && <TableHead className="font-black text-[11px] uppercase tracking-widest text-slate-500">Auto Close</TableHead>}
                  <TableHead className="font-black text-[11px] uppercase tracking-widest text-slate-500">Captured Address</TableHead>
                  <TableHead className="font-black text-[11px] uppercase tracking-widest text-slate-500">Adjustment Audit Remark</TableHead>
                  {attendanceView === 'history' && <TableHead className="font-black text-[11px] uppercase tracking-widest text-slate-500">Processed By</TableHead>}
                  <TableHead className={cn("text-right font-black text-[11px] uppercase tracking-widest text-slate-500", attendanceView === 'history' ? "pr-10" : "pr-6")}>Action Matrix</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentData.items.length === 0 ? (
                  <TableRow><TableCell colSpan={attendanceView === 'history' ? 12 : 11} className="text-center py-20 text-muted-foreground font-bold italic">No logs matched criteria constraints bounds.</TableCell></TableRow>
                ) : (
                  currentData.items.map((rec: any) => {
                    const canApprove = rec.isVirtual || (rec.inTime && (rec.outTime || rec.autoCheckout));
                    const inDisplay = rec.inTime ? `${formatDate(rec.inDate || rec.date)} ${rec.inTime}` : "--";
                    
                    let outDisplay = "--";
                    if (rec.outTime) {
                      outDisplay = `${formatDate(rec.outDate || rec.date)} ${rec.outTime}`;
                    } else if (rec.autoCheckout && rec.inTime) {
                      const inDT = parseISO(`${rec.inDate || rec.date}T${rec.inTime}:00`);
                      if (inDT && isValid(inDT)) {
                        const autoOutDT = addHours(inDT, 16);
                        outDisplay = `${formatDate(format(autoOutDT, "yyyy-MM-dd"))} ${format(autoOutDT, "HH:mm")}`;
                      }
                    }

                    const mergedAddress = rec.address || formatLocation(rec.address, rec.lat, rec.lng);

                    return (
                      <TableRow key={rec.id || (rec as any)._id || `${rec.employeeId}:${rec.date}`} className={cn("hover:bg-slate-50/50 transition-colors", rec.autoCheckout && "bg-amber-50/10")}>
                        {attendanceView === 'pending' && (
                          <TableCell className="text-center px-4">
                            <input 
                              type="checkbox" 
                              className="rounded border-slate-300 w-4 h-4 cursor-pointer accent-emerald-600 disabled:opacity-50"
                              disabled={!canApprove}
                              checked={selectedRecordIds.has(rec.id || (rec as any)._id || `${rec.employeeId}:${rec.date}`)}
                              onChange={() => toggleRecordSelection(rec.id || (rec as any)._id || `${rec.employeeId}:${rec.date}`)}
                            />
                          </TableCell>
                        )}
                        <TableCell className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-black text-slate-900 uppercase text-xs sm:text-sm">{rec.employeeName}</span>
                            <span className="text-[10px] font-mono text-primary font-bold uppercase">{rec.employeeId}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-bold text-slate-700">{formatDate(rec.date)}</TableCell>
                        <TableCell>
                          <Badge className={cn(
                            "text-[9px] font-black uppercase px-3 py-1 shadow-none", 
                            (rec.displayStatus === 'Present' || rec.displayStatus.includes('Present')) && "bg-emerald-50 text-emerald-700 border-none",
                            rec.displayStatus === 'Absent' && "bg-rose-50 text-rose-700 border-none",
                            rec.displayStatus === 'Absent on Leave' && "bg-purple-50 text-purple-700 border-none",
                            (rec.displayStatus === 'Weekly Off' || rec.displayStatus === 'Holiday') && "bg-slate-50 text-slate-400 border-slate-200"
                          )}>
                            {rec.displayStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] font-black uppercase bg-white border-slate-200">
                            {rec.inPlant || "Salt Plant"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-bold text-slate-600 whitespace-nowrap">{inDisplay}</TableCell>
                        <TableCell className="text-xs font-bold text-slate-600 whitespace-nowrap">{outDisplay}</TableCell>
                        <TableCell className="text-xs font-black text-slate-999 font-mono">{rec.workingHourDisplay || "00:00"}</TableCell>
                        {attendanceView === 'history' && (
                          <TableCell>
                             <Badge variant={rec.autoCheckout || rec.autoOut ? "destructive" : "outline"} className="text-[9px] font-black uppercase">
                                {rec.autoCheckout || rec.autoOut ? "YES" : "NO"}
                             </Badge>
                          </TableCell>
                        )}
                        <TableCell className="text-[10px] font-medium text-slate-500 max-w-[250px] truncate leading-tight" title={mergedAddress}>{mergedAddress}</TableCell> 
                        <TableCell className="text-xs font-medium text-slate-600 max-w-[200px] truncate">{rec.remark || "-"}</TableCell>
                        {attendanceView === 'history' && (
                          <TableCell className="text-[10px] font-bold text-slate-600 uppercase font-mono">
                            {rec.approvedBy || rec.editedBy || "SYSTEM LOG"}
                          </TableCell>
                        )}
                        <TableCell className={cn("text-right", attendanceView === 'history' ? "pr-10" : "pr-6")}>
                          <div className="flex justify-end items-center gap-1.5">
                            {attendanceView === 'pending' ? (
                              <>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => handleOpenEditModal(rec)}><Pencil className="w-3.5 h-3.5" /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:bg-rose-50" onClick={() => { setSelectedAttendance(rec); setIsAttendanceRejectOpen(true); }}><XCircle className="w-3.5 h-3.5" /></Button>
                                <Button 
                                  size="sm" 
                                  className="h-8 font-black text-[10px] uppercase bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-600/10 rounded-lg px-4" 
                                  onClick={() => handleOpenApproveConfirmation(rec)}
                                  disabled={!canApprove}
                                >
                                  Approve
                                </Button>
                              </>
                            ) : (
                              !rec.isVirtual && (
                                <Button variant="secondary" size="sm" className="h-8 gap-2 font-black text-[10px] uppercase bg-slate-900 text-white hover:bg-primary transition-all rounded-lg" onClick={() => handleRestoreAttendance(rec)}>
                                  <RotateCcw className="w-3 h-3" /> Restore
                                </Button>
                              )
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardContent>
        <StandardPaginationFooter current={attendanceView === 'pending' ? pendingPage : historyPage} total={currentData.totalPages} onPageChange={attendanceView === 'pending' ? setPendingPage : setHistoryPage} />
      </Card>
      )}

      {/* --- EMPLOYEE PLANT EXIT HISTORY SECTION --- */}
      {viewMode === 'exits' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-rose-600 bg-rose-50/50 p-4 rounded-2xl border border-rose-100 shadow-sm">
            <LogOut className="w-5 h-5 shrink-0" />
            <span className="text-xs font-black uppercase tracking-wider text-rose-800">Geofence Compliance Monitoring: Real-time logs for off-perimeter coordinate traversal.</span>
          </div>
          <Card className="border-slate-200 shadow-sm overflow-hidden rounded-2xl bg-white">
            <CardContent className="p-0">
              <ScrollArea className="w-full">
                <Table className="min-w-[1200px]">
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="font-black text-[10px] uppercase tracking-wider py-4 px-6 text-slate-500">Employee</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-wider text-slate-500">Attendance Date</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-wider text-slate-500">Plant</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-wider text-slate-500">Mark IN</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-wider text-slate-500">Mark OUT</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-wider text-rose-600">Exit Time</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-wider text-emerald-600">Return Time</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-wider text-slate-500">Outside Duration</TableHead>
                      <TableHead className="text-right font-black text-[10px] uppercase tracking-wider pr-6 text-slate-500">Action Matrix</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allPlantExitHistory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-20 text-muted-foreground font-bold uppercase tracking-wider italic">
                          No Geofence Exit violations logged for the current filter scope bounds.
                        </TableCell>
                      </TableRow>
                    ) : (
                      allPlantExitHistory.map((event: any, index: number) => (
                        <TableRow key={index} className="hover:bg-slate-50/50 transition-colors">
                          <TableCell className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="font-black text-slate-800 uppercase text-xs">{event.employeeName}</span>
                              <span className="text-[10px] font-mono font-bold text-primary">{event.employeeId}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs font-bold text-slate-600">{formatDate(event.date)}</TableCell>
                          <TableCell className="text-xs font-black text-slate-700 uppercase">{event.plantName}</TableCell>
                          <TableCell className="text-xs font-medium text-slate-500">{event.inTime || "--:--"}</TableCell>
                          <TableCell className="text-xs font-medium text-slate-500">{event.outTime || "--:--"}</TableCell>
                          <TableCell className="text-xs font-extrabold text-rose-600">{event.exitTime.split(" ")[1] || event.exitTime}</TableCell>
                          <TableCell className="text-xs font-extrabold text-emerald-600">{event.returnTime ? event.returnTime.split(" ")[1] : "Still Outside"}</TableCell>
                          <TableCell className="text-xs font-black text-slate-800 font-mono">{event.outsideDuration || "--"}</TableCell>
                          <TableCell className="text-right pr-6">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-8 rounded-lg font-black text-[10px] uppercase border-primary/20 text-primary hover:bg-primary/5 flex items-center gap-1.5 ml-auto"
                              onClick={() => handleOpenExitDetails(event)}
                            >
                              <Eye className="w-3.5 h-3.5" /> View Details
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
        </div>
      )}

      {/* --- MODALS --- */}

      {/* VIEW DETAILS: GEOFENCE LOCATION TRAJECTORY DIALOG */}
      <Dialog open={isExitDetailsOpen} onOpenChange={setIsExitDetailsOpen}>
        <DialogContent className="sm:max-w-2xl rounded-[2.5rem] overflow-hidden p-0 border-none shadow-2xl animate-in fade-in duration-200">
          <DialogHeader className="p-8 bg-slate-900 text-white shrink-0">
            <DialogTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-tight">
              <MapPin className="w-6 h-6 text-primary" /> Exit Trajectory Logs
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400 font-bold uppercase tracking-wider">
              Recorded outside boundary logs for {selectedExitEvent?.employeeName} ({selectedExitEvent?.employeeId})
            </DialogDescription>
          </DialogHeader>
          <div className="p-8">
            <ScrollArea className="h-[320px] rounded-xl border border-slate-100 p-2 bg-slate-50/50">
              <Table>
                <TableHeader className="bg-slate-100 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="font-black uppercase text-[10px] tracking-wider text-slate-500 py-3">Date & Time</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-wider text-slate-500">Full Address</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-wider text-slate-500">Latitude</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-wider text-slate-500">Longitude</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-wider text-rose-600 text-right pr-4">Distance from Plant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedExitEvent?.locationHistory && selectedExitEvent.locationHistory.length > 0 ? (
                    selectedExitEvent.locationHistory.map((loc: any, idx: number) => (
                      <TableRow key={idx} className="bg-white hover:bg-slate-50 transition-colors">
                        <TableCell className="text-xs font-bold text-slate-700 whitespace-nowrap">{loc.time}</TableCell>
                        <TableCell className="text-xs text-slate-600 max-w-[220px] break-words font-medium leading-relaxed" title={loc.address}>{loc.address}</TableCell>
                        <TableCell className="text-xs font-mono text-slate-500 font-semibold">{loc.lat?.toFixed(5) || "0.00"}</TableCell>
                        <TableCell className="text-xs font-mono text-slate-500 font-semibold">{loc.lng?.toFixed(5) || "0.00"}</TableCell>
                        <TableCell className="text-xs font-black text-rose-600 text-right pr-4 font-mono">{loc.distance !== undefined ? `${loc.distance} m` : "Unresolved"}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10 text-xs text-slate-400 font-bold uppercase tracking-wider">
                        No historical perimeter violations coordinate blocks captured.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t">
            <Button className="w-full h-12 font-black bg-slate-800 hover:bg-slate-900 text-white rounded-xl uppercase tracking-widest text-xs shadow-md" onClick={() => setIsExitDetailsOpen(false)}>
              CLOSE LEDGER VIEWER
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* LEAVE APPROVE MODAL */}
      <Dialog open={isLeaveApproveOpen} onOpenChange={setIsLeaveApproveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Leave Request</DialogTitle>
            <DialogDescription>
              Review and confirm the leave details for {selectedLeaveRequest?.employeeName}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div><strong>Employee:</strong> {selectedLeaveRequest?.employeeName} ({selectedLeaveRequest?.employeeId})</div>
            <div><strong>Department:</strong> {selectedLeaveRequest?.department}</div>
            <div><strong>Leave Type:</strong> {selectedLeaveRequest?.purpose}</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="leaveFromDate">From Date</Label>
                <Input id="leaveFromDate" type="date" value={editLeaveData.fromDate} onChange={(e) => setEditLeaveData(prev => ({...prev, fromDate: e.target.value}))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="leaveToDate">To Date</Label>
                <Input id="leaveToDate" type="date" value={editLeaveData.toDate} onChange={(e) => setEditLeaveData(prev => ({...prev, toDate: e.target.value}))} />
              </div>
            </div>
             <div><strong>Total Days:</strong> {editLeaveData.fromDate && editLeaveData.toDate ? differenceInCalendarDays(new Date(editLeaveData.toDate), new Date(editLeaveData.fromDate)) + 1 : selectedLeaveRequest?.days}</div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsLeaveApproveOpen(false)}>Cancel</Button>
            <Button onClick={handleConfirmLeaveApproval}>Confirm Approve</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* LEAVE REJECT MODAL */}
      <Dialog open={isLeaveRejectOpen} onOpenChange={setIsLeaveRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Leave Request</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="leaveRejectReason">Rejection Reason (Mandatory)</Label>
            <Textarea id="leaveRejectReason" value={leaveRejectReason} onChange={(e) => setLeaveRejectReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsLeaveRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleConfirmLeaveReject} disabled={!leaveRejectReason.trim()}>Confirm Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CONFIRM APPROVAL MODAL */}
      <Dialog open={isApproveConfirmOpen} onOpenChange={setIsApproveConfirmOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-0 overflow-hidden border-none shadow-2xl animate-in fade-in duration-300">
          <DialogHeader className="p-6 bg-slate-900 text-white flex flex-row items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30">
              <UserCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-md font-black uppercase tracking-tight">Confirm Approval</DialogTitle>
              <DialogDescription className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Verify session compliance logs</DialogDescription>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-4 bg-white text-xs font-bold text-slate-700">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3 shadow-inner">
              <div className="grid grid-cols-[110px_1fr] gap-2 items-baseline">
                <span className="text-slate-400 text-[10px] uppercase tracking-wider">Employee Name:</span>
                <span className="text-slate-900 uppercase text-sm font-black">{selectedAttendance?.employeeName}</span>
              </div>
              <div className="grid grid-cols-[110px_1fr] gap-2 items-baseline pt-2 border-t border-slate-200/50">
                <span className="text-slate-400 text-[10px] uppercase tracking-wider">Employee ID:</span>
                <span className="text-primary font-mono text-xs font-extrabold uppercase">{selectedAttendance?.employeeId}</span>
              </div>
              <div className="grid grid-cols-[110px_1fr] gap-2 items-baseline pt-2 border-t border-slate-200/50">
                <span className="text-slate-400 text-[10px] uppercase tracking-wider">Shift Date:</span>
                <span className="text-slate-800">{selectedAttendance ? formatDate(selectedAttendance.date) : ""}</span>
              </div>
              <div className="grid grid-cols-[110px_1fr] gap-2 items-baseline pt-2 border-t border-slate-200/50">
                <span className="text-slate-400 text-[10px] uppercase tracking-wider">Mark IN Time:</span>
                <span className="text-slate-800 font-mono">{selectedAttendance?.inTime || "--:--"}</span>
              </div>
              <div className="grid grid-cols-[110px_1fr] gap-2 items-baseline pt-2 border-t border-slate-200/50">
                <span className="text-slate-400 text-[10px] uppercase tracking-wider">Mark OUT Time:</span>
                <span className="text-slate-800 font-mono">
                  {selectedAttendance?.outTime || (selectedAttendance?.autoCheckout ? "16:00 (Auto Limit)" : "--:--")}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 bg-slate-50 border-t flex flex-row gap-3">
            <Button variant="ghost" className="flex-1 h-11 font-black rounded-xl text-slate-500 uppercase text-xs" onClick={() => setIsApproveConfirmOpen(false)}>Cancel</Button>
            <Button className="flex-1 h-11 font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl uppercase text-xs shadow-lg shadow-emerald-600/10" onClick={handleConfirmApproval}>
              Confirm Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* BULK APPROVE CONFIRMATION MODAL */}
      <Dialog open={isBulkApproveConfirmOpen} onOpenChange={setIsBulkApproveConfirmOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-0 overflow-hidden border-none shadow-2xl animate-in fade-in duration-300">
          <DialogHeader className="p-6 bg-slate-900 text-white flex flex-row items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30">
              <UserCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-md font-black uppercase tracking-tight">Bulk Approve Logs</DialogTitle>
              <DialogDescription className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Approve {selectedRecordIds.size} selected session(s)</DialogDescription>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-4 bg-white text-xs font-bold text-slate-700 text-center">
            <p className="text-sm">Are you sure you want to successfully approve all <span className="text-emerald-600 text-xl font-black">{selectedRecordIds.size}</span> selected records? They will automatically be moved to the History Queue.</p>
          </div>

          <DialogFooter className="p-4 bg-slate-50 border-t flex flex-row gap-3">
            <Button variant="ghost" className="flex-1 h-11 font-black rounded-xl text-slate-500 uppercase text-xs" onClick={() => setIsBulkApproveConfirmOpen(false)}>Cancel</Button>
            <Button className="flex-1 h-11 font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl uppercase text-xs shadow-lg shadow-emerald-600/10" onClick={handleBulkApprove}>
              Confirm Bulk Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* REJECT MODAL */}
      <Dialog open={isAttendanceRejectOpen} onOpenChange={setIsAttendanceRejectOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
             <DialogTitle className="flex items-center gap-2 text-md font-black uppercase">
                <AlertCircle className="w-5 h-5 text-rose-500" /> Reject Attendance Entry
             </DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-4 bg-white">
             <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Rejection Reason * (Mandatory)</Label>
             <Textarea placeholder="Specify exact correction discrepancy details for record rejection..." value={attendanceRejectReason} onChange={(e) => setAttendanceRejectReason(e.target.value)} className="min-h-[100px] border-slate-200 bg-slate-50 rounded-xl font-medium" />
          </div>
          <DialogFooter className="p-4 bg-slate-50 border-t flex flex-row gap-3">
             <Button variant="ghost" onClick={() => { setIsAttendanceRejectOpen(false); setSelectedAttendance(null); }} className="flex-1 rounded-xl font-bold h-11 uppercase text-xs">Cancel</Button>
             <Button onClick={handlePostAttendanceReject} disabled={!attendanceRejectReason.trim()} className="flex-1 bg-rose-600 hover:bg-rose-700 font-black text-white rounded-xl h-11 uppercase text-xs shadow-lg shadow-rose-600/10">Reject Entry</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT MODAL */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 bg-slate-900 text-white flex flex-row items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30">
              <Pencil className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-md font-black uppercase tracking-tight">Edit Attendance Record</DialogTitle>
              <DialogDescription className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Modify session details manually</DialogDescription>
            </div>
          </DialogHeader>
          
          <div className="p-6 space-y-4 bg-white max-h-[60vh] overflow-y-auto">
             <div className="space-y-2 flex flex-col">
               <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Plant Facility</Label>
               <Select value={editData.plant} onValueChange={(v) => setEditData(prev => ({ ...prev, plant: v }))}>
                  <SelectTrigger className="h-10 border-slate-200 font-bold bg-slate-50 rounded-xl focus:ring-0 shadow-none text-xs">
                    <SelectValue placeholder="Select Plant" />
                  </SelectTrigger>
                  <SelectContent>
                    {authorizedPlants.map(p => (
                      <SelectItem key={p.id} value={p.name} className="font-bold text-xs uppercase">{p.name}</SelectItem>
                    ))}
                  </SelectContent>
               </Select>
             </div>
             
             <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">IN Date</Label>
                 <Input type="date" value={editData.inDate} onChange={(e) => setEditData(prev => ({ ...prev, inDate: e.target.value }))} className="h-10 border-slate-200 bg-slate-50 rounded-xl text-xs font-bold" />
               </div>
               <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">IN Time</Label>
                 <Input type="time" value={editData.inTime} onChange={(e) => setEditData(prev => ({ ...prev, inTime: e.target.value }))} className="h-10 border-slate-200 bg-slate-50 rounded-xl text-xs font-bold" />
               </div>
             </div>

             <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">OUT Date</Label>
                 <Input type="date" value={editData.outDate} onChange={(e) => setEditData(prev => ({ ...prev, outDate: e.target.value }))} className="h-10 border-slate-200 bg-slate-50 rounded-xl text-xs font-bold" />
               </div>
               <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">OUT Time</Label>
                 <Input type="time" value={editData.outTime} onChange={(e) => setEditData(prev => ({ ...prev, outTime: e.target.value }))} className="h-10 border-slate-200 bg-slate-50 rounded-xl text-xs font-bold" />
               </div>
             </div>

             <div className="space-y-2 flex flex-col">
               <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Remark / Reason *</Label>
               <Textarea placeholder="Explain reason for manual modification..." value={editData.remark} onChange={(e) => setEditData(prev => ({ ...prev, remark: e.target.value }))} className="min-h-[80px] border-slate-200 bg-slate-50 rounded-xl font-medium text-xs" />
             </div>
          </div>
          
          <div className="p-4 bg-slate-50 border-t flex flex-row gap-3">
             <Button variant="ghost" onClick={() => { setIsEditModalOpen(false); setSelectedAttendance(null); }} className="flex-1 rounded-xl font-bold h-11 uppercase text-xs">Cancel</Button>
             <Button onClick={handleUpdateAttendance} className="flex-1 bg-primary hover:bg-primary/90 font-black text-white rounded-xl h-11 uppercase text-xs shadow-lg shadow-primary/10">Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}