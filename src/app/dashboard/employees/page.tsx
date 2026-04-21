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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  Search, 
  UserPlus, 
  TrendingUp, 
  Pencil,
  History,
  Building2,
  Banknote,
  ChevronRight,
  User as UserIcon,
  Clock,
  TrendingUp as GrowthIcon,
  FileSpreadsheet,
  ChevronLeft,
  ArrowRightCircle,
  X,
  PlusCircle,
  ArrowLeft
} from "lucide-react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { formatCurrency, cn, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Employee, SalaryStructure } from "@/lib/types";
import { DEPARTMENTS, DESIGNATIONS } from "@/lib/constants";
import { useData } from "@/context/data-context";

const generateMonthOptions = () => {
  const options = [];
  const date = new Date();
  date.setDate(1); 
  for (let i = -1; i < 12; i++) {
    const d = new Date(date.getFullYear(), date.getMonth() + i, 1);
    const mmm = d.toLocaleString('en-US', { month: 'short' });
    const yyyy = d.getFullYear();
    options.push(`${mmm}-${yyyy}`);
  }
  return options;
};

const MONTH_OPTIONS = generateMonthOptions();
const ITEMS_PER_PAGE = 15;

const getMonthFromMMM_YYYY = (formatted: string) => {
  if (!formatted || !formatted.includes('-')) return new Date();
  const [mmm, yyyy] = formatted.split('-');
  const months: Record<string, number> = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 };
  const monthIdx = months[mmm] !== undefined ? months[mmm] : 0;
  return new Date(parseInt(yyyy) || new Date().getFullYear(), monthIdx, 1);
};

const formatToMMM_YYYY = (date: Date) => {
  if (!date || isNaN(date.getTime())) return "Jan-2024";
  const mmm = date.toLocaleString('en-US', { month: 'short' });
  const yyyy = date.getFullYear();
  return `${mmm}-${yyyy}`;
};

const INITIAL_SALARY_STRUCTURE: SalaryStructure = { 
  basic: 0, 
  hra: 0, 
  da: 0, 
  allowance: 0, 
  grossSalary: 0, 
  employeePF: 0, 
  employeeESIC: 0, 
  employerPF: 0, 
  employerESIC: 0, 
  netSalary: 0, 
  monthlyCTC: 0,
  pfRateEmp: 12,
  esicRateEmp: 0.75,
  pfRateEx: 13,
  esicRateEx: 3.25
};

const INITIAL_FORM_DATA: Partial<Employee> = {
  isGovComplianceEnabled: true,
  salary: { ...INITIAL_SALARY_STRUCTURE },
  salaryHistory: [],
  unitIds: [],
  active: true
};

export default function EmployeesPage() {
  const { employees, firms, addRecord, updateRecord, currentUser } = useData();
  const [isMounted, setIsMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();

  // Navigation View State
  const [view, setView] = useState<'list' | 'form'>('list');

  // Modal/Form States
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [salaryRevision, setSalaryRevision] = useState<Employee | null>(null);
  const [viewHistoryEmployee, setViewHistoryEmployee] = useState<Employee | null>(null);
  
  // Form States
  const [formData, setFormData] = useState<Partial<Employee>>({ ...INITIAL_FORM_DATA });
  const [revisionData, setRevisionData] = useState<SalaryStructure>({ ...INITIAL_SALARY_STRUCTURE });
  const [effectiveMonth, setEffectiveMonth] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    setEffectiveMonth(MONTH_OPTIONS[1]);
  }, []);

  const filtered = useMemo(() => {
    const sorted = [...(employees || [])].sort((a, b) => {
      const nameA = (a.name || "").toLowerCase();
      const nameB = (b.name || "").toLowerCase();
      return nameA.localeCompare(nameB);
    });

    return sorted.filter(emp => {
      if (!emp) return false;
      const name = (emp.name || "").toLowerCase();
      const id = (emp.employeeId || "").toLowerCase();
      const aadhaar = (emp.aadhaar || "");
      const search = searchTerm.toLowerCase();
      return name.includes(search) || id.includes(search) || aadhaar.includes(search);
    });
  }, [employees, searchTerm]);

  const paginatedEmployees = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);

  const calculateSalaryMetrics = (
    basic: number, 
    hra: number, 
    allowance: number, 
    compliance: boolean,
    rates: { pfEmp: number, esicEmp: number, pfEx: number, esicEx: number }
  ) => {
    const gross = basic + hra + allowance;
    let epf = 0, eesic = 0, erpf = 0, eresic = 0;

    if (compliance) {
      epf = Math.round(basic * (rates.pfEmp / 100));
      erpf = Math.round(basic * (rates.pfEx / 100));
      eesic = Math.round(gross * (rates.esicEmp / 100));
      eresic = Math.round(gross * (rates.esicEx / 100));
    }

    return {
      basic,
      hra,
      da: 0,
      allowance,
      grossSalary: gross,
      employeePF: epf,
      employeeESIC: eesic,
      employerPF: erpf,
      employerESIC: eresic,
      netSalary: gross - epf - eesic,
      monthlyCTC: gross + erpf + eresic,
      pfRateEmp: rates.pfEmp,
      esicRateEmp: rates.esicEmp,
      pfRateEx: rates.pfEx,
      esicRateEx: rates.esicEx
    };
  };

  const updateFormSalary = (field: string, val: number) => {
    setFormData(prev => {
      const s = { ...INITIAL_SALARY_STRUCTURE, ...(prev.salary || {}) };
      const newBasic = field === 'basic' ? val : s.basic;
      const newHra = field === 'hra' ? val : (field === 'basic' ? Math.round(val * 0.5) : s.hra);
      const newAllowance = field === 'allowance' ? val : s.allowance;
      
      const newRates = {
        pfEmp: field === 'pfRateEmp' ? val : s.pfRateEmp,
        esicEmp: field === 'esicRateEmp' ? val : s.esicRateEmp,
        pfEx: field === 'pfRateEx' ? val : s.pfRateEx,
        esicEx: field === 'esicRateEx' ? val : s.esicRateEx,
      };
      
      return {
        ...prev,
        salary: calculateSalaryMetrics(newBasic, newHra, newAllowance, prev.isGovComplianceEnabled || false, newRates)
      };
    });
  };

  const handleRegistrationPost = async () => {
    if (isProcessing) return;

    if (!formData.name || !formData.aadhaar || (formData.aadhaar || "").replace(/\s/g, '').length !== 12) {
      toast({ variant: "destructive", title: "Validation Error", description: "Name and 12-digit Aadhaar are mandatory." });
      return;
    }

    if (!formData.firmId || !formData.unitIds || formData.unitIds.length === 0) {
      toast({ variant: "destructive", title: "Validation Error", description: "Firm and at least one Unit selection are mandatory." });
      return;
    }

    setIsProcessing(true);
    
    try {
      const joinDateObj = new Date(formData.joinDate || Date.now());
      const joinMonthStr = formatToMMM_YYYY(joinDateObj);

      const getNextId = () => {
        if (editEmployee) return editEmployee.employeeId;
        const nums = employees.map(e => {
          const parts = (e.employeeId || "").split('S');
          return parts.length > 1 ? parseInt(parts[1]) || 0 : 0;
        });
        const max = nums.length > 0 ? Math.max(...nums) : 0;
        return `EMP-S${(max + 1).toString().padStart(4, '0')}`;
      };

      const nextEmpId = getNextId();

      const empData = {
        ...formData,
        employeeId: nextEmpId,
        salaryHistory: editEmployee ? (formData.salaryHistory || []) : [
          { fromMonth: joinMonthStr, toMonth: "Present", monthlyCTC: formData.salary?.monthlyCTC || 0 }
        ],
        active: formData.active ?? true
      };

      if (editEmployee) {
        updateRecord('employees', editEmployee.id, empData);
      } else {
        addRecord('employees', empData);
      }

      handleCloseForm();
      toast({ title: editEmployee ? "Profile Updated" : "Employee Registered", description: `${empData.name} has been saved.` });
    } catch (e) {
      console.error("Registration error:", e);
      toast({ variant: "destructive", title: "Error", description: "Failed to save employee data." });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCloseForm = () => {
    setView('list');
    setEditEmployee(null);
    setFormData({ ...INITIAL_FORM_DATA });
    setIsProcessing(false);
  };

  const toggleUnit = (id: string) => {
    setFormData(prev => {
      const current = prev.unitIds || [];
      const updated = current.includes(id) 
        ? current.filter(x => x !== id) 
        : [...current, id];
      return { ...prev, unitIds: updated };
    });
  };

  const handlePostSalaryRevision = async () => {
    if (!salaryRevision || isProcessing) return;
    setIsProcessing(true);

    try {
      const history = salaryRevision.salaryHistory ? [...salaryRevision.salaryHistory] : [];
      const newEffectiveDate = getMonthFromMMM_YYYY(effectiveMonth);
      
      if (history.length > 0) {
        const lastEntry = { ...history[history.length - 1] };
        const prevMonthDate = new Date(newEffectiveDate);
        prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
        lastEntry.toMonth = formatToMMM_YYYY(prevMonthDate);
        history[history.length - 1] = lastEntry;
      }

      history.push({
        fromMonth: effectiveMonth,
        toMonth: "Present",
        monthlyCTC: revisionData.monthlyCTC
      });

      updateRecord('employees', salaryRevision.id, {
        salary: { ...revisionData },
        salaryHistory: history
      });

      setSalaryRevision(null);
      toast({ title: "Salary Revision Posted", description: `Updated for ${salaryRevision.name}` });
    } catch (e) {
      console.error("Revision error:", e);
      toast({ variant: "destructive", title: "Error", description: "Failed to post salary revision." });
    } finally {
      setIsProcessing(false);
    }
  };

  const availableUnits = useMemo(() => {
    if (!formData.firmId) return [];
    const firm = (firms || []).find(f => f.id === formData.firmId);
    return firm?.units || [];
  }, [formData.firmId, firms]);

  if (!isMounted) return null;

  if (view === 'form') {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="rounded-2xl border-none shadow-2xl overflow-hidden bg-white flex flex-col min-h-[calc(100vh-140px)]">
          {/* Header */}
          <div className="p-6 bg-slate-900 text-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <UserPlus className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-black">Staff Onboarding</h2>
                <p className="text-slate-400 font-bold text-xs">Identity and statutory records.</p>
              </div>
            </div>
          </div>

          {/* Form Content */}
          <ScrollArea className="flex-1 bg-white">
            <div className="p-8 space-y-12 pb-24">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                {/* Left Columns: Basic & Professional */}
                <div className="lg:col-span-8 space-y-10">
                  <div className="space-y-6">
                    <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                      <UserIcon className="w-3.5 h-3.5" /> Basic Credentials
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-500">Full Name *</Label>
                        <Input value={formData.name || ""} onChange={(e) => setFormData(p => ({...p, name: e.target.value.toUpperCase()}))} className="h-12 bg-slate-50 font-bold text-sm border-slate-200" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-500">Father's Name</Label>
                        <Input value={formData.fatherName || ""} onChange={(e) => setFormData(p => ({...p, fatherName: e.target.value.toUpperCase()}))} className="h-12 bg-slate-50 font-bold text-sm border-slate-200" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-500">12-Digit Aadhaar *</Label>
                        <Input value={formData.aadhaar || ""} onChange={(e) => setFormData(p => ({...p, aadhaar: e.target.value}))} className="h-12 bg-slate-50 font-mono text-sm border-slate-200" maxLength={14} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-500">PAN Number</Label>
                        <Input value={formData.pan || ""} onChange={(e) => setFormData(p => ({...p, pan: e.target.value.toUpperCase()}))} className="h-12 bg-slate-50 font-mono uppercase text-sm border-slate-200" maxLength={10} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5" /> Professional Assignment
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-500">Department</Label>
                        <Select value={formData.department} onValueChange={(v) => setFormData(p => ({...p, department: v, designation: ''}))}>
                          <SelectTrigger className="h-12 bg-slate-50 font-bold text-sm border-slate-200">
                            <SelectValue placeholder="Select Dept" />
                          </SelectTrigger>
                          <SelectContent>
                            {DEPARTMENTS.map(d => <SelectItem key={d} value={d} className="font-bold">{d}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-500">Designation</Label>
                        <Select value={formData.designation} onValueChange={(v) => setFormData(p => ({...p, designation: v}))}>
                          <SelectTrigger className="h-12 bg-slate-50 font-bold text-sm border-slate-200">
                            <SelectValue placeholder="Select Desig" />
                          </SelectTrigger>
                          <SelectContent>
                            {(DESIGNATIONS[formData.department!] || []).map(d => <SelectItem key={d} value={d} className="font-bold">{d}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-500">Mobile (Password)</Label>
                        <Input value={formData.mobile || ""} onChange={(e) => setFormData(p => ({...p, mobile: e.target.value}))} className="h-12 bg-slate-50 font-bold text-sm border-slate-200" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-500">Join Date</Label>
                        <Input type="date" value={formData.joinDate || ""} onChange={(e) => setFormData(p => ({...p, joinDate: e.target.value}))} className="h-12 bg-slate-50 font-bold text-sm border-slate-200" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Mapping & Status */}
                <div className="lg:col-span-4 space-y-6">
                  <div className="bg-slate-50/50 p-6 rounded-3xl border-2 border-slate-100 shadow-sm h-full">
                    <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2 mb-6">
                      <Building2 className="w-3.5 h-3.5" /> Firm & Unit Mapping
                    </h3>
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-500">Employer Firm *</Label>
                        <Select value={formData.firmId} onValueChange={(v) => setFormData(p => ({...p, firmId: v, unitIds: []}))}>
                          <SelectTrigger className="h-12 bg-white font-bold text-sm border-slate-200">
                            <SelectValue placeholder="Select Firm" />
                          </SelectTrigger>
                          <SelectContent>
                            {firms.map(f => <SelectItem key={f.id} value={f.id} className="font-bold">{f.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase text-slate-500">Authorized Units *</Label>
                        <div className="bg-white border-2 border-slate-100 rounded-2xl p-4 space-y-3 max-h-56 overflow-y-auto custom-blue-scrollbar shadow-inner">
                          {availableUnits.length === 0 ? (
                            <p className="text-[10px] text-slate-400 font-bold italic text-center py-4">Select firm first</p>
                          ) : (
                            availableUnits.map(u => (
                              <div key={u.id} className="flex items-center space-x-3 p-1">
                                <Checkbox id={`u-${u.id}`} checked={(formData.unitIds || []).includes(u.id)} onCheckedChange={() => toggleUnit(u.id)} className="h-5 w-5" />
                                <label htmlFor={`u-${u.id}`} className="text-xs font-bold text-slate-700 cursor-pointer">{u.name}</label>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                      <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                        <Label className="font-black text-[10px] uppercase text-slate-600">Employee Status</Label>
                        <Switch checked={formData.active} onCheckedChange={(v) => setFormData(p => ({...p, active: v}))} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Salary Section (Included for complete form context) */}
              <div className="pt-10 border-t border-slate-200 space-y-8">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase text-slate-900 flex items-center gap-2">
                    <Banknote className="w-5 h-5 text-emerald-600" /> Salary Configuration
                  </h3>
                  <div className="flex items-center gap-3 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100">
                    <Label className="text-[10px] font-black text-emerald-700 uppercase">Gov. Compliance</Label>
                    <Switch checked={formData.isGovComplianceEnabled} onCheckedChange={(v) => { setFormData(p => ({...p, isGovComplianceEnabled: v})); updateFormSalary('basic', formData.salary?.basic || 0); }} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl shadow-sm">
                    <Label className="text-[9px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Basic Salary</Label>
                    <Input type="number" value={formData.salary?.basic || ""} onChange={(e) => updateFormSalary('basic', parseFloat(e.target.value) || 0)} className="h-12 text-lg font-black bg-white" />
                  </div>
                  <div className="p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl shadow-sm">
                    <Label className="text-[9px] font-black uppercase text-slate-400 mb-2 block tracking-widest">HRA (50% Auto)</Label>
                    <Input type="number" value={formData.salary?.hra || ""} onChange={(e) => updateFormSalary('hra', parseFloat(e.target.value) || 0)} className="h-12 text-lg font-black bg-white" />
                  </div>
                  <div className="p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl shadow-sm">
                    <Label className="text-[9px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Other Allowances</Label>
                    <Input type="number" value={formData.salary?.allowance || ""} onChange={(e) => updateFormSalary('allowance', parseFloat(e.target.value) || 0)} className="h-12 text-lg font-black bg-white" />
                  </div>
                </div>

                <div className="p-8 bg-slate-900 text-white rounded-3xl shadow-xl flex flex-col md:flex-row justify-between items-center border-b-8 border-emerald-500 gap-6">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase text-emerald-400 tracking-[0.3em]">Monthly Cost to Company (CTC)</p>
                    <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">Calculated including Employer PF & ESIC contributions</p>
                  </div>
                  <h4 className="text-3xl md:text-5xl font-black text-emerald-400 tracking-tighter">{formatCurrency(formData.salary?.monthlyCTC || 0)}</h4>
                </div>
              </div>
            </div>
          </ScrollArea>
          
          {/* Footer */}
          <div className="p-4 bg-slate-50 border-t flex justify-end items-center gap-4 shrink-0">
            <Button variant="ghost" onClick={handleCloseForm} className="rounded-xl font-black text-[11px] uppercase tracking-widest px-10 h-12 text-slate-600 hover:bg-slate-200">Cancel</Button>
            <Button className="bg-primary hover:bg-primary/90 rounded-xl font-black text-[11px] uppercase tracking-widest px-12 h-12 shadow-xl shadow-primary/20" onClick={handleRegistrationPost} disabled={isProcessing}>
              {isProcessing ? "Processing..." : (editEmployee ? "Save Adjustments" : "Onboard Staff")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Employee Directory</h1>
          <p className="text-muted-foreground">Manage workforce profiles and statutory payroll compliance.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button 
            className="flex-1 sm:flex-none font-bold shadow-lg shadow-primary/20 bg-primary" 
            onClick={() => {
              setFormData({ ...INITIAL_FORM_DATA });
              setView('form');
            }}
            disabled={isProcessing}
          >
            <UserPlus className="w-4 h-4 mr-2" /> Add Staff
          </Button>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 p-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by name, ID, or Aadhaar..." 
              className="pl-10 h-10 bg-white"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="w-full">
            <Table className="min-w-[1000px]">
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-bold">Employee Name / ID</TableHead>
                  <TableHead className="font-bold">Aadhaar</TableHead>
                  <TableHead className="font-bold">Dept / Designation</TableHead>
                  <TableHead className="font-bold">Join Date</TableHead>
                  <TableHead className="font-bold text-right">Monthly CTC</TableHead>
                  <TableHead className="font-bold text-center">Status</TableHead>
                  <TableHead className="text-right font-bold pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No employees found.</TableCell>
                  </TableRow>
                ) : (
                  paginatedEmployees.map((emp) => (
                    <TableRow key={emp.id} className="hover:bg-slate-50/50">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold uppercase text-xs sm:text-sm">{emp.name}</span>
                          <span className="text-[10px] font-mono text-primary">{emp.employeeId}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-mono">{emp.aadhaar}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs sm:text-sm font-medium">{emp.department}</span>
                          <span className="text-[10px] text-muted-foreground">{emp.designation}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm">{formatDate(emp.joinDate)}</TableCell>
                      <TableCell className="text-right font-bold text-emerald-600 text-xs sm:text-sm">
                        {formatCurrency(emp.salary?.monthlyCTC || 0)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "px-2 py-0.5 text-[9px] sm:text-[10px] uppercase font-black",
                            emp.active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
                          )}
                        >
                          {emp.active ? "Active" : "De-active"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex justify-end items-center gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-slate-500 hover:text-primary"
                                  onClick={() => { 
                                    setEditEmployee(emp); 
                                    setFormData({ ...emp }); 
                                    setView('form'); 
                                  }}
                                  disabled={isProcessing}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit Profile</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-emerald-600 hover:text-emerald-700"
                                  onClick={() => { 
                                    setSalaryRevision(emp); 
                                    setRevisionData({ ...emp.salary }); 
                                  }}
                                  disabled={isProcessing}
                                >
                                  <TrendingUp className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Increase Salary</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-slate-500 hover:text-primary"
                                  onClick={() => { 
                                    setViewHistoryEmployee(emp); 
                                  }}
                                  disabled={isProcessing}
                                >
                                  <History className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>View Salary Record</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
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
        {totalPages > 1 && <StandardPaginationFooter current={currentPage} total={totalPages} onPageChange={setCurrentPage} />}
      </Card>

      {/* Salary Increment Modal - RESPONSIVE TABLE FORMAT */}
      <Dialog open={!!salaryRevision} onOpenChange={(o) => !o && setSalaryRevision(null)}>
        <DialogContent className="w-[95vw] sm:max-w-lg rounded-2xl p-0 overflow-hidden border-none shadow-2xl flex flex-col max-h-[90vh]">
          <DialogHeader className="p-4 sm:p-6 bg-white border-b shrink-0">
            <DialogTitle className="text-lg sm:text-xl font-black flex items-center gap-2 text-slate-900">
              <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" /> Salary Increment
            </DialogTitle>
            <div className="mt-4 space-y-1">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">POSTING REVISION FOR</p>
              <h4 className="text-base sm:text-lg font-black text-primary uppercase leading-tight">{salaryRevision?.name}</h4>
              <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase">{salaryRevision?.employeeId} • {salaryRevision?.department} / {salaryRevision?.designation}</p>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 bg-slate-50/50 custom-blue-scrollbar">
            <div className="p-4 sm:p-8 space-y-6 sm:space-y-8">
              <div className="space-y-2">
                <Label className="text-[9px] sm:text-[10px] font-black uppercase text-slate-500 tracking-widest">Effective Month</Label>
                <Select value={effectiveMonth} onValueChange={setEffectiveMonth}>
                  <SelectTrigger className="h-11 sm:h-12 bg-white border-slate-200 font-black shadow-sm text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_OPTIONS.map(m => <SelectItem key={m} value={m} className="text-sm font-bold">{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="font-black text-[9px] uppercase tracking-widest text-slate-500 py-3">Salary Component</TableHead>
                      <TableHead className="font-black text-[9px] uppercase tracking-widest text-slate-500 text-right py-3">Monthly Amount (₹)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="hover:bg-slate-50/50">
                      <TableCell className="font-bold text-slate-700 py-4 text-xs sm:text-sm">Basic Salary (₹)</TableCell>
                      <TableCell className="py-2">
                        <Input 
                          type="number" 
                          value={revisionData.basic} 
                          onChange={(e) => {
                            const b = parseFloat(e.target.value) || 0;
                            const newHra = Math.round(b * 0.5);
                            setRevisionData(calculateSalaryMetrics(b, newHra, revisionData.allowance, salaryRevision?.isGovComplianceEnabled || false, {pfEmp: revisionData.pfRateEmp, esicEmp: revisionData.esicRateEmp, pfEx: revisionData.pfRateEx, esicEx: revisionData.esicRateEx}));
                          }} 
                          className="h-9 sm:h-10 text-right font-black border-none focus-visible:ring-0 focus-visible:bg-slate-50 text-sm sm:text-base" 
                        />
                      </TableCell>
                    </TableRow>
                    <TableRow className="hover:bg-slate-50/50">
                      <TableCell className="font-bold text-slate-700 py-4 text-xs sm:text-sm">HRA (₹)</TableCell>
                      <TableCell className="py-2">
                        <Input 
                          type="number" 
                          value={revisionData.hra} 
                          onChange={(e) => {
                            const h = parseFloat(e.target.value) || 0;
                            setRevisionData(calculateSalaryMetrics(revisionData.basic, h, revisionData.allowance, salaryRevision?.isGovComplianceEnabled || false, {pfEmp: revisionData.pfRateEmp, esicEmp: revisionData.esicRateEmp, pfEx: revisionData.pfRateEx, esicEx: revisionData.esicRateEx}));
                          }} 
                          className="h-9 sm:h-10 text-right font-black border-none focus-visible:ring-0 focus-visible:bg-slate-50 text-sm sm:text-base" 
                        />
                      </TableCell>
                    </TableRow>
                    <TableRow className="hover:bg-slate-50/50">
                      <TableCell className="font-bold text-slate-700 py-4 text-xs sm:text-sm">Other Allowance (₹)</TableCell>
                      <TableCell className="py-2">
                        <Input 
                          type="number" 
                          value={revisionData.allowance} 
                          onChange={(e) => {
                            const a = parseFloat(e.target.value) || 0;
                            setRevisionData(calculateSalaryMetrics(revisionData.basic, revisionData.hra, a, salaryRevision?.isGovComplianceEnabled || false, {pfEmp: revisionData.pfRateEmp, esicEmp: revisionData.esicRateEmp, pfEx: revisionData.pfRateEx, esicEx: revisionData.esicRateEx}));
                          }} 
                          className="h-9 sm:h-10 text-right font-black border-none focus-visible:ring-0 focus-visible:bg-slate-50 text-sm sm:text-base" 
                        />
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <div className="bg-slate-900 p-4 sm:p-6 rounded-2xl text-white flex justify-between items-center shadow-xl border-b-4 border-emerald-500">
                <div className="space-y-0.5">
                  <p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">New Monthly CTC</p>
                  <h4 className="text-xl sm:text-3xl font-black text-emerald-400 tracking-tighter">{formatCurrency(revisionData.monthlyCTC)}</h4>
                </div>
                <div className="text-right">
                  <p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Hike %</p>
                  <h4 className="text-lg sm:text-2xl font-black text-white">+ {((revisionData.monthlyCTC - (salaryRevision?.salary.monthlyCTC || 0)) / (salaryRevision?.salary.monthlyCTC || 1) * 100).toFixed(1)}%</h4>
                </div>
              </div>
            </div>
            <ScrollBar orientation="vertical" />
          </ScrollArea>

          <DialogFooter className="p-3 sm:p-4 bg-white border-t gap-3 shrink-0">
            <Button variant="ghost" onClick={() => setSalaryRevision(null)} className="rounded-xl font-bold h-10 sm:h-11 px-6 sm:px-8 text-xs">Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 rounded-xl font-black h-10 sm:h-11 px-8 sm:px-12 shadow-lg text-xs" onClick={handlePostSalaryRevision} disabled={isProcessing}>Post Revision</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Salary Progression Modal - RESPONSIVE TABLE */}
      <Dialog open={!!viewHistoryEmployee} onOpenChange={(o) => !o && setViewHistoryEmployee(null)}>
        <DialogContent className="w-[95vw] sm:max-w-3xl rounded-2xl p-0 overflow-hidden border-none shadow-2xl flex flex-col max-h-[90vh]">
          <DialogHeader className="p-4 sm:p-6 bg-slate-900 text-white shrink-0">
            <DialogTitle className="text-lg sm:text-xl font-black flex items-center gap-2">
              <History className="w-5 h-5 sm:w-6 sm:h-6 text-primary" /> Salary Progression
            </DialogTitle>
            <div className="mt-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="space-y-1">
                <h4 className="text-base sm:text-lg font-black text-primary uppercase leading-tight">{viewHistoryEmployee?.name}</h4>
                <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest">{viewHistoryEmployee?.employeeId} • {viewHistoryEmployee?.department} / {viewHistoryEmployee?.designation}</p>
              </div>
              <Badge className="bg-primary/20 text-primary border-none font-black text-[9px] uppercase px-3 py-1 w-fit">Career Ledger</Badge>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 bg-white custom-blue-scrollbar">
            <div className="min-w-[600px]">
              <Table>
                <TableHeader className="bg-slate-50 sticky top-0 z-10 border-b">
                  <TableRow>
                    <TableHead className="font-black text-[9px] uppercase tracking-widest px-6 py-4">From Month</TableHead>
                    <TableHead className="font-black text-[9px] uppercase tracking-widest py-4">To Month</TableHead>
                    <TableHead className="font-black text-[9px] uppercase tracking-widest text-right py-4">Monthly CTC (₹)</TableHead>
                    <TableHead className="font-black text-[9px] uppercase tracking-widest text-right pr-8 py-4">Increase (%)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewHistoryEmployee?.salaryHistory && [...viewHistoryEmployee.salaryHistory].reverse().map((entry, idx, arr) => {
                    const nextEntry = arr[idx + 1];
                    const hike = nextEntry ? (((entry.monthlyCTC - nextEntry.monthlyCTC) / nextEntry.monthlyCTC) * 100).toFixed(1) : "0.0";
                    return (
                      <TableRow key={idx} className="hover:bg-slate-50 transition-colors">
                        <TableCell className="px-6 py-5 font-bold text-slate-700 text-xs sm:text-sm">{entry.fromMonth}</TableCell>
                        <TableCell className="py-5">
                          <Badge variant="outline" className={cn("text-[8px] sm:text-[9px] font-black uppercase tracking-tighter px-3", entry.toMonth === 'Present' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-500")}>
                            {entry.toMonth}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right py-5">
                          <span className="font-black text-slate-900 text-xs sm:text-sm">{formatCurrency(entry.monthlyCTC)}</span>
                        </TableCell>
                        <TableCell className="text-right pr-8 py-5">
                          {nextEntry ? (
                            <div className="flex items-center justify-end gap-1.5 text-emerald-600 font-black text-[10px] sm:text-xs">
                              <GrowthIcon className="w-3 h-3" />
                              {hike}%
                            </div>
                          ) : (
                            <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-widest">Join Salary</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <ScrollBar orientation="horizontal" />
            <ScrollBar orientation="vertical" />
          </ScrollArea>

          <div className="p-3 sm:p-4 bg-slate-50 border-t flex justify-end shrink-0">
            <Button variant="ghost" onClick={() => setViewHistoryEmployee(null)} className="font-black text-[10px] uppercase tracking-widest h-9 px-6 sm:px-8 rounded-xl text-slate-500">Close Ledger</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StandardPaginationFooter({ current, total, onPageChange }: { current: number, total: number, onPageChange: (p: number) => void }) {
  return (
    <CardFooter className="bg-slate-50 border-t flex flex-col sm:flex-row items-center justify-between p-3 sm:p-4 gap-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={current === 1} onClick={() => onPageChange(current - 1)} className="font-bold h-8 sm:h-9 text-xs"><ChevronLeft className="w-4 h-4 mr-1" /> Prev</Button>
        <Button variant="outline" size="sm" disabled={current === total || total === 0} onClick={() => onPageChange(current + 1)} className="font-bold h-8 sm:h-9 text-xs">Next <ChevronRight className="w-4 h-4 ml-1" /></Button>
      </div>
      <div className="flex items-center gap-3 sm:gap-4">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Page {current} of {total || 1}</span>
        <div className="flex items-center gap-2 border-l pl-4 border-slate-200">
          <Label className="text-[8px] font-black uppercase text-slate-400 tracking-tighter">Jump</Label>
          <div className="flex gap-1">
            <Input 
              type="number" 
              className="w-14 h-8 text-center font-bold text-xs" 
              value={current} 
              onChange={(e) => { 
                const p = parseInt(e.target.value); 
                if (p >= 1 && p <= total) onPageChange(p); 
              }} 
            />
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white">
              <ArrowRightCircle className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </div>
    </CardFooter>
  );
}
