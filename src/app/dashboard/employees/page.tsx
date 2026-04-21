
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { 
  Search, 
  UserPlus, 
  TrendingUp, 
  Pencil,
  History,
  CalendarDays,
  Building2,
  Banknote,
  ShieldCheck,
  ChevronRight,
  User as UserIcon,
  Clock,
  TrendingUp as GrowthIcon,
  TrendingDown as LossIcon,
  Factory,
  FileSpreadsheet,
  ChevronLeft,
  ArrowRightCircle,
  X,
  PlusCircle,
  Info
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCurrency, cn } from "@/lib/utils";
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
  const { employees, firms, plants, addRecord, updateRecord, currentUser } = useData();
  const [isMounted, setIsMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();

  // Modal States
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
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

  const isSuperAdmin = useMemo(() => currentUser?.role === 'SUPER_ADMIN', [currentUser]);

  const filtered = useMemo(() => {
    const sorted = [...(employees || [])].sort((a, b) => {
      const aVal = a.createdAt || a.joinDate || "";
      const bVal = b.createdAt || b.joinDate || "";
      return bVal.localeCompare(aVal);
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

  const handleExportExcel = () => {
    if (employees.length === 0) {
      toast({ variant: "destructive", title: "No Data", description: "No employee records found to export." });
      return;
    }

    const headers = [
      "Employee ID", "Full Name", "Father Name", "Aadhaar Number", "Mobile", "Join Date",
      "Department", "Designation", "Firm Name", "Authorized Units", "Address",
      "Bank Name", "Account Number", "IFSC Code", "Gov Compliance", "PF Number", "ESIC Number",
      "Basic Salary", "HRA", "Allowances", "Gross Salary", "Employee PF", "Employee ESIC",
      "Employer PF", "Employer ESIC", "Net Payable", "Monthly CTC", "Status"
    ];

    const csvRows = [
      headers.join(","),
      ...employees.map(emp => {
        const firm = firms.find(f => f.id === emp.firmId);
        const unitNames = (emp.unitIds || []).map(id => plants.find(p => p.id === id)?.name || id).join(" / ");
        
        return [
          `"${emp.employeeId}"`,
          `"${emp.name}"`,
          `"${emp.fatherName || ""}"`,
          `"${emp.aadhaar}"`,
          `"${emp.mobile}"`,
          `"${emp.joinDate}"`,
          `"${emp.department}"`,
          `"${emp.designation}"`,
          `"${firm?.name || ""}"`,
          `"${unitNames}"`,
          `"${(emp.address || "").replace(/\n/g, " ")}"`,
          `"${emp.bankName || ""}"`,
          `"${emp.accountNo || ""}"`,
          `"${emp.ifscCode || ""}"`,
          `"${emp.isGovComplianceEnabled ? "YES" : "NO"}"`,
          `"${emp.pfNumber || ""}"`,
          `"${emp.esicNumber || ""}"`,
          emp.salary?.basic || 0,
          emp.salary?.hra || 0,
          emp.salary?.allowance || 0,
          emp.salary?.grossSalary || 0,
          emp.salary?.employeePF || 0,
          emp.salary?.employeeESIC || 0,
          emp.salary?.employerPF || 0,
          emp.salary?.employerESIC || 0,
          emp.salary?.netSalary || 0,
          emp.salary?.monthlyCTC || 0,
          `"${emp.active ? "ACTIVE" : "INACTIVE"}"`
        ].join(",");
      })
    ];

    const blob = new Blob([csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Employee_Directory_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({ title: "Export Success", description: "The employee directory has been exported to CSV." });
  };

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

      handleCloseRegistration();
      toast({ title: editEmployee ? "Profile Updated" : "Employee Registered", description: `${empData.name} has been saved.` });
    } catch (e) {
      console.error("Registration error:", e);
      toast({ variant: "destructive", title: "Error", description: "Failed to save employee data." });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCloseRegistration = () => {
    setIsRegistrationOpen(false);
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

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Employee Directory</h1>
          <p className="text-muted-foreground">Manage workforce profiles and statutory payroll compliance.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline"
            className="font-bold border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            onClick={handleExportExcel}
            disabled={isProcessing}
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" /> Export Excel
          </Button>
          <Button 
            className="font-bold shadow-lg shadow-primary/20 bg-primary" 
            onClick={() => {
              setFormData({ ...INITIAL_FORM_DATA });
              setIsRegistrationOpen(true);
            }}
            disabled={isProcessing}
          >
            <UserPlus className="w-4 h-4 mr-2" /> Add Employee
          </Button>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50">
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
          <TooltipProvider>
            <Table>
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
                          <span className="font-bold uppercase">{emp.name}</span>
                          <span className="text-xs font-mono text-primary">{emp.employeeId}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-mono">{emp.aadhaar}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{emp.department}</span>
                          <span className="text-xs text-muted-foreground">{emp.designation}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{emp.joinDate}</TableCell>
                      <TableCell className="text-right font-bold text-emerald-600">
                        {formatCurrency(emp.salary?.monthlyCTC || 0)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "px-2 py-0.5 text-[10px] uppercase font-black",
                            emp.active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
                          )}
                        >
                          {emp.active ? "Active" : "De-active"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex justify-end items-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-slate-500 hover:text-primary"
                                onClick={() => { 
                                  setEditEmployee(emp); 
                                  setFormData({ ...emp }); 
                                  setIsRegistrationOpen(true); 
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
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TooltipProvider>
        </CardContent>
        {totalPages > 1 && <StandardPaginationFooter current={currentPage} total={totalPages} onPageChange={setCurrentPage} />}
      </Card>

      {/* Employee Registration Modal */}
      <Dialog open={isRegistrationOpen} onOpenChange={(o) => !o && handleCloseRegistration()}>
        <DialogContent className="sm:max-w-5xl h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
          <DialogHeader className="p-3 bg-slate-900 text-white shrink-0">
            <DialogTitle className="text-xl font-black flex items-center gap-2">
              <UserPlus className="w-6 h-6 text-primary" /> {editEmployee ? 'Edit Staff Profile' : 'Staff Onboarding'}
            </DialogTitle>
            <DialogDescription className="text-slate-400 font-bold">Comprehensive identity and statutory records.</DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 p-8 bg-slate-50/50">
            <div className="space-y-10 pb-20">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                  <div className="space-y-4">
                    <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-2"><UserIcon className="w-3 h-3" /> Basic Credentials</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-500">Full Name *</Label><Input value={formData.name || ""} onChange={(e) => setFormData(p => ({...p, name: e.target.value.toUpperCase()}))} className="h-11 bg-white font-bold" /></div>
                      <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-500">Father's Name</Label><Input value={formData.fatherName || ""} onChange={(e) => setFormData(p => ({...p, fatherName: e.target.value.toUpperCase()}))} className="h-11 bg-white font-bold" /></div>
                      <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-500">12-Digit Aadhaar *</Label><Input value={formData.aadhaar || ""} onChange={(e) => setFormData(p => ({...p, aadhaar: e.target.value}))} className="h-11 bg-white font-mono" maxLength={14} /></div>
                      <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-500">PAN Number</Label><Input value={formData.pan || ""} onChange={(e) => setFormData(p => ({...p, pan: e.target.value.toUpperCase()}))} className="h-11 bg-white font-mono uppercase" maxLength={10} /></div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-2"><Clock className="w-3 h-3" /> Professional Assignment</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-500">Department</Label>
                        <Select value={formData.department} onValueChange={(v) => setFormData(p => ({...p, department: v, designation: ''}))}>
                          <SelectTrigger className="h-11 bg-white font-bold"><SelectValue placeholder="Select Dept" /></SelectTrigger>
                          <SelectContent>{DEPARTMENTS.map(d => <SelectItem key={d} value={d} className="font-bold">{d}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-500">Designation</Label>
                        <Select value={formData.designation} onValueChange={(v) => setFormData(p => ({...p, designation: v}))}>
                          <SelectTrigger className="h-11 bg-white font-bold"><SelectValue placeholder="Select Desig" /></SelectTrigger>
                          <SelectContent>{(DESIGNATIONS[formData.department!] || []).map(d => <SelectItem key={d} value={d} className="font-bold">{d}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-500">Mobile No (Login Pass)</Label><Input value={formData.mobile || ""} onChange={(e) => setFormData(p => ({...p, mobile: e.target.value}))} className="h-11 bg-white font-bold" /></div>
                      <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-500">Join Date</Label><Input type="date" value={formData.joinDate || ""} onChange={(e) => setFormData(p => ({...p, joinDate: e.target.value}))} className="h-11 bg-white font-bold" /></div>
                    </div>
                  </div>
                </div>

                <div className="space-y-8 bg-slate-100/50 p-6 rounded-2xl border border-slate-200">
                  <div className="space-y-4">
                    <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-2"><Building2 className="w-3 h-3" /> Firm & Unit Mapping</h3>
                    <div className="space-y-4">
                      <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-500">Employer Firm *</Label>
                        <Select value={formData.firmId} onValueChange={(v) => setFormData(p => ({...p, firmId: v, unitIds: []}))}>
                          <SelectTrigger className="h-11 bg-white font-bold"><SelectValue placeholder="Select Firm" /></SelectTrigger>
                          <SelectContent>{firms.map(f => <SelectItem key={f.id} value={f.id} className="font-bold">{f.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-500">Authorized Units *</Label>
                        <div className="bg-white border rounded-xl p-4 space-y-3 max-h-48 overflow-y-auto">
                          {availableUnits.length === 0 ? <p className="text-[10px] text-slate-400 font-bold italic text-center">Select firm first</p> : 
                            availableUnits.map(u => (
                              <div key={u.id} className="flex items-center space-x-3">
                                <Checkbox id={`u-${u.id}`} checked={(formData.unitIds || []).includes(u.id)} onCheckedChange={() => toggleUnit(u.id)} />
                                <label htmlFor={`u-${u.id}`} className="text-xs font-bold text-slate-700 cursor-pointer">{u.name}</label>
                              </div>
                            ))
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-200">
                    <div className="flex items-center justify-between"><Label className="font-black text-xs text-slate-600">Employee Status</Label><Switch checked={formData.active} onCheckedChange={(v) => setFormData(p => ({...p, active: v}))} /></div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase mt-2">{formData.active ? "Account is live & active" : "Account access revoked"}</p>
                  </div>
                </div>
              </div>

              <div className="pt-10 border-t border-slate-200 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase text-slate-900 flex items-center gap-2"><Banknote className="w-5 h-5 text-emerald-600" /> Salary Configuration</h3>
                  <div className="flex items-center gap-3 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100">
                    <Label className="text-xs font-black text-emerald-700 uppercase">Gov. Statutory Compliance</Label>
                    <Switch checked={formData.isGovComplianceEnabled} onCheckedChange={(v) => { setFormData(p => ({...p, isGovComplianceEnabled: v})); updateFormSalary('basic', formData.salary?.basic || 0); }} />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm"><Label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">Basic Salary (Monthly)</Label><Input type="number" value={formData.salary?.basic || ""} onChange={(e) => updateFormSalary('basic', parseFloat(e.target.value) || 0)} className="h-12 text-lg font-black" /></div>
                  <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm"><Label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">HRA (50% Auto)</Label><Input type="number" value={formData.salary?.hra || ""} onChange={(e) => updateFormSalary('hra', parseFloat(e.target.value) || 0)} className="h-12 text-lg font-black" /></div>
                  <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm"><Label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">Special Allowances</Label><Input type="number" value={formData.salary?.allowance || ""} onChange={(e) => updateFormSalary('allowance', parseFloat(e.target.value) || 0)} className="h-12 text-lg font-black" /></div>
                </div>

                <div className="p-5 bg-blue-50 border border-blue-100 rounded-2xl shadow-sm flex justify-between items-center">
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-black uppercase text-blue-400 tracking-widest">Monthly Net Pay</p>
                    <p className="text-[9px] text-blue-500 font-bold">(Basic + HRA + Allowances)</p>
                  </div>
                  <h4 className="text-3xl font-black text-blue-700">{formatCurrency(formData.salary?.grossSalary || 0)}</h4>
                </div>

                {formData.isGovComplianceEnabled && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-6 bg-slate-100/50 rounded-2xl border border-slate-200">
                      <StatutoryInput label="EPF Rate (Emp %)" value={formData.salary?.pfRateEmp || 12} onChange={(v) => updateFormSalary('pfRateEmp', v)} />
                      <StatutoryInput label="ESIC Rate (Emp %)" value={formData.salary?.esicRateEmp || 0.75} onChange={(v) => updateFormSalary('esicRateEmp', v)} />
                      <StatutoryInput label="PF Rate (Ex %)" value={formData.salary?.pfRateEx || 13} onChange={(v) => updateFormSalary('pfRateEx', v)} />
                      <StatutoryInput label="ESIC Rate (Ex %)" value={formData.salary?.esicRateEx || 3.25} onChange={(v) => updateFormSalary('esicRateEx', v)} />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <AmountDisplay label="Employee PF Amount" value={formData.salary?.employeePF || 0} />
                      <AmountDisplay label="Employer PF Amount" value={formData.salary?.employerPF || 0} />
                      <AmountDisplay label="Employee ESIC Amount" value={formData.salary?.employeeESIC || 0} />
                      <AmountDisplay label="Employer ESIC Amount" value={formData.salary?.employerESIC || 0} />
                    </div>
                  </div>
                )}

                <div className="p-6 bg-slate-900 text-white rounded-2xl shadow-xl flex justify-between items-center border-b-4 border-emerald-500">
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Monthly Cost to Company (CTC)</p>
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">Includes Gross + Employer Statutory Contributions</p>
                  </div>
                  <h4 className="text-4xl font-black text-emerald-400 tracking-tighter">{formatCurrency(formData.salary?.monthlyCTC || 0)}</h4>
                </div>
              </div>
            </div>
          </ScrollArea>
          
          <DialogFooter className="p-3 bg-slate-50 border-t gap-3 shrink-0">
            <Button variant="ghost" onClick={handleCloseRegistration} className="rounded-xl font-bold h-10 px-8">Cancel</Button>
            <Button className="bg-primary hover:bg-primary/90 rounded-xl font-black h-10 px-12 shadow-lg shadow-primary/20" onClick={handleRegistrationPost} disabled={isProcessing}>{isProcessing ? "Processing..." : (editEmployee ? "Update Profile" : "Register Employee")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Salary Increment Modal */}
      <Dialog open={!!salaryRevision} onOpenChange={(o) => !o && setSalaryRevision(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="p-6 bg-white border-b shrink-0">
            <DialogTitle className="text-xl font-black flex items-center gap-2 text-slate-900">
              <TrendingUp className="w-6 h-6 text-emerald-600" /> Salary Increment
            </DialogTitle>
            <div className="mt-4 space-y-1">
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Posting revision for</p>
              <h4 className="text-lg font-black text-primary uppercase">{salaryRevision?.name}</h4>
              <p className="text-[10px] font-bold text-slate-400 uppercase">{salaryRevision?.employeeId} • {salaryRevision?.department} / {salaryRevision?.designation}</p>
            </div>
          </DialogHeader>

          <div className="p-8 space-y-6 bg-slate-50/50">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Effective Month</Label>
              <Select value={effectiveMonth} onValueChange={setEffectiveMonth}>
                <SelectTrigger className="h-12 bg-white border-slate-200 font-black shadow-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_OPTIONS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Basic Salary (₹)</Label>
                <Input 
                  type="number" 
                  value={revisionData.basic} 
                  onChange={(e) => {
                    const b = parseFloat(e.target.value) || 0;
                    setRevisionData(calculateSalaryMetrics(b, revisionData.hra, revisionData.allowance, salaryRevision?.isGovComplianceEnabled || false, {pfEmp: revisionData.pfRateEmp, esicEmp: revisionData.esicRateEmp, pfEx: revisionData.pfRateEx, esicEx: revisionData.esicRateEx}));
                  }} 
                  className="h-12 text-lg font-black bg-white shadow-sm" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">HRA (₹)</Label>
                  <Input 
                    type="number" 
                    value={revisionData.hra} 
                    onChange={(e) => {
                      const h = parseFloat(e.target.value) || 0;
                      setRevisionData(calculateSalaryMetrics(revisionData.basic, h, revisionData.allowance, salaryRevision?.isGovComplianceEnabled || false, {pfEmp: revisionData.pfRateEmp, esicEmp: revisionData.esicRateEmp, pfEx: revisionData.pfRateEx, esicEx: revisionData.esicRateEx}));
                    }} 
                    className="h-12 font-bold bg-white shadow-sm" 
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Other Allowance (₹)</Label>
                  <Input 
                    type="number" 
                    value={revisionData.allowance} 
                    onChange={(e) => {
                      const a = parseFloat(e.target.value) || 0;
                      setRevisionData(calculateSalaryMetrics(revisionData.basic, revisionData.hra, a, salaryRevision?.isGovComplianceEnabled || false, {pfEmp: revisionData.pfRateEmp, esicEmp: revisionData.esicRateEmp, pfEx: revisionData.pfRateEx, esicEx: revisionData.esicRateEx}));
                    }} 
                    className="h-12 font-bold bg-white shadow-sm" 
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-900 p-6 rounded-2xl text-white flex justify-between items-center shadow-xl border-b-4 border-emerald-500">
              <div className="space-y-0.5">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">New Monthly CTC</p>
                <h4 className="text-3xl font-black text-emerald-400 tracking-tighter">{formatCurrency(revisionData.monthlyCTC)}</h4>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Hike %</p>
                <h4 className="text-2xl font-black text-white">+ {((revisionData.monthlyCTC - (salaryRevision?.salary.monthlyCTC || 0)) / (salaryRevision?.salary.monthlyCTC || 1) * 100).toFixed(1)}%</h4>
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 bg-white border-t gap-3 shrink-0">
            <Button variant="ghost" onClick={() => setSalaryRevision(null)} className="rounded-xl font-bold h-11 px-8">Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 rounded-xl font-black h-11 px-12 shadow-lg shadow-emerald-100" onClick={handlePostSalaryRevision} disabled={isProcessing}>Post Revision</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Salary Progression Modal */}
      <Dialog open={!!viewHistoryEmployee} onOpenChange={(o) => !o && setViewHistoryEmployee(null)}>
        <DialogContent className="sm:max-w-3xl rounded-2xl p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <DialogTitle className="text-xl font-black flex items-center gap-2">
              <History className="w-6 h-6 text-primary" /> Salary Progression
            </DialogTitle>
            <div className="mt-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="space-y-1">
                <h4 className="text-lg font-black text-primary uppercase leading-tight">{viewHistoryEmployee?.name}</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{viewHistoryEmployee?.employeeId} • {viewHistoryEmployee?.department} / {viewHistoryEmployee?.designation}</p>
              </div>
              <Badge className="bg-primary/20 text-primary border-none font-black text-[10px] uppercase px-3 py-1">Career Ledger</Badge>
            </div>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh] bg-white">
            <div className="p-0">
              <Table>
                <TableHeader className="bg-slate-50 sticky top-0 z-10 border-b">
                  <TableRow>
                    <TableHead className="font-black text-[10px] uppercase tracking-widest px-6 py-4">From Month</TableHead>
                    <TableHead className="font-black text-[10px] uppercase tracking-widest py-4">To Month</TableHead>
                    <TableHead className="font-black text-[10px] uppercase tracking-widest text-right py-4">Monthly CTC (₹)</TableHead>
                    <TableHead className="font-black text-[10px] uppercase tracking-widest text-right pr-8 py-4">Increase (%)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewHistoryEmployee?.salaryHistory && [...viewHistoryEmployee.salaryHistory].reverse().map((entry, idx, arr) => {
                    const nextEntry = arr[idx + 1];
                    const hike = nextEntry ? (((entry.monthlyCTC - nextEntry.monthlyCTC) / nextEntry.monthlyCTC) * 100).toFixed(1) : "0.0";
                    return (
                      <TableRow key={idx} className="hover:bg-slate-50 transition-colors">
                        <TableCell className="px-6 py-5 font-bold text-slate-700">{entry.fromMonth}</TableCell>
                        <TableCell className="py-5">
                          <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-tighter px-3", entry.toMonth === 'Present' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-500")}>
                            {entry.toMonth}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right py-5">
                          <span className="font-black text-slate-900">{formatCurrency(entry.monthlyCTC)}</span>
                        </TableCell>
                        <TableCell className="text-right pr-8 py-5">
                          {nextEntry ? (
                            <div className="flex items-center justify-end gap-1.5 text-emerald-600 font-black text-xs">
                              <GrowthIcon className="w-3 h-3" />
                              {hike}%
                            </div>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Join Sal.</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>

          <div className="p-4 bg-slate-50 border-t flex justify-end shrink-0">
            <Button variant="ghost" onClick={() => setViewHistoryEmployee(null)} className="font-black text-xs uppercase tracking-widest h-10 px-8 rounded-xl">Close Progression</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatutoryInput({ label, value, onChange }: { label: string, value: number, onChange: (v: number) => void }) {
  return (
    <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-500">{label}</Label><Input type="number" step="0.01" value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} className="h-10 bg-white font-mono font-bold" /></div>
  );
}

function AmountDisplay({ label, value }: { label: string, value: number }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
      <p className="text-[9px] font-black uppercase text-slate-400 mb-1 tracking-tighter">{label}</p>
      <p className="text-sm font-black text-slate-700">{formatCurrency(value)}</p>
    </div>
  );
}

function StandardPaginationFooter({ current, total, onPageChange }: { current: number, total: number, onPageChange: (p: number) => void }) {
  return (
    <CardFooter className="bg-slate-50 border-t flex flex-col sm:flex-row items-center justify-between p-4 gap-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={current === 1} onClick={() => onPageChange(current - 1)} className="font-bold h-9"><ChevronLeft className="w-4 h-4 mr-1" /> Previous</Button>
        <Button variant="outline" size="sm" disabled={current === total || total === 0} onClick={() => onPageChange(current + 1)} className="font-bold h-9">Next <ChevronRight className="w-4 h-4 ml-1" /></Button>
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
