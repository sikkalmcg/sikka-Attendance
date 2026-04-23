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
  ArrowLeft,
  ShieldCheck,
  CreditCard,
  Factory
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

const ITEMS_PER_PAGE = 15;

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
  firstName: "",
  lastName: "",
  employeeId: "",
  aadhaar: "",
  pan: "",
  mobile: "",
  address: "",
  department: "",
  designation: "",
  bankName: "",
  accountNo: "",
  ifscCode: "",
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

  const [view, setView] = useState<'list' | 'form'>('list');
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [salaryRevision, setSalaryRevision] = useState<Employee | null>(null);
  const [viewHistoryEmployee, setViewHistoryEmployee] = useState<Employee | null>(null);
  
  const [formData, setFormData] = useState<Partial<Employee>>({ ...INITIAL_FORM_DATA });
  const [revisionData, setRevisionData] = useState<SalaryStructure>({ ...INITIAL_SALARY_STRUCTURE });
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // INTELLIGENT AUTO-ID PREFIX DETECTION
  useEffect(() => {
    if (view === 'form' && !editEmployee && isMounted) {
      const generateNextId = () => {
        // Detect existing prefix (Default to SIL if none found)
        let prefix = "SIL";
        if (employees.length > 0) {
          const lastId = employees[employees.length - 1].employeeId || "";
          const match = lastId.match(/^([A-Za-z-]+)/);
          if (match) prefix = match[1];
        }

        const numericIds = employees
          .filter(e => e.employeeId?.startsWith(prefix))
          .map(e => {
            const numPart = e.employeeId.replace(prefix, "");
            return parseInt(numPart);
          })
          .filter(n => !isNaN(n));

        const maxId = numericIds.length > 0 ? Math.max(...numericIds) : 0;
        const nextId = (maxId + 1).toString().padStart(5, '0');
        return `${prefix}${nextId}`;
      };

      setFormData(prev => ({ ...prev, employeeId: generateNextId() }));
    }
  }, [view, editEmployee, employees, isMounted]);

  const filtered = useMemo(() => {
    // A-Z SEQUENTIAL SORTING
    const sorted = [...(employees || [])].sort((a, b) => {
      const nameA = (a.name || `${a.firstName} ${a.lastName}`).toLowerCase().trim();
      const nameB = (b.name || `${b.firstName} ${b.lastName}`).toLowerCase().trim();
      return nameA.localeCompare(nameB);
    });

    return sorted.filter(emp => {
      const search = searchTerm.toLowerCase();
      const fullName = (emp.name || `${emp.firstName} ${emp.lastName}`).toLowerCase();
      return (
        fullName.includes(search) || 
        emp.employeeId?.toLowerCase().includes(search) || 
        emp.aadhaar?.includes(search)
      );
    });
  }, [employees, searchTerm]);

  const paginatedEmployees = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);

  const handleExportEmployees = () => {
    if (filtered.length === 0) {
      toast({ variant: "destructive", title: "No Data", description: "No employee records found to export." });
      return;
    }

    const headers = [
      "Employee ID",
      "First Name",
      "Last Name",
      "Father Name",
      "Aadhaar Number",
      "PAN Number",
      "Mobile No",
      "Join Date",
      "Address",
      "Employer Firm",
      "Department",
      "Designation",
      "Bank Name",
      "Account Number",
      "IFSC Code",
      "Statutory Compliance",
      "PF Number",
      "ESIC Number",
      "Basic Salary",
      "HRA",
      "DA",
      "Allowance",
      "Gross Salary",
      "Net Payable",
      "Monthly CTC",
      "PF Emp Rate %",
      "PF Ex Rate %",
      "ESIC Emp Rate %",
      "ESIC Ex Rate %",
      "Status"
    ];

    const csvRows = [
      headers.join(","),
      ...filtered.map(emp => {
        const firmName = firms.find(f => f.id === emp.firmId)?.name || "N/A";
        return [
          `"${emp.employeeId}"`,
          `"${emp.firstName}"`,
          `"${emp.lastName || ''}"`,
          `"${emp.fatherName || ''}"`,
          `"${emp.aadhaar}"`,
          `"${emp.pan || ''}"`,
          `"${emp.mobile || ''}"`,
          `"${emp.joinDate || ''}"`,
          `"${emp.address || ''}"`,
          `"${firmName}"`,
          `"${emp.department}"`,
          `"${emp.designation}"`,
          `"${emp.bankName || ''}"`,
          `"${emp.accountNo || ''}"`,
          `"${emp.ifscCode || ''}"`,
          `"${emp.isGovComplianceEnabled ? 'Enabled' : 'Disabled'}"`,
          `"${emp.pfNumber || ''}"`,
          `"${emp.esicNumber || ''}"`,
          emp.salary?.basic || 0,
          emp.salary?.hra || 0,
          emp.salary?.da || 0,
          emp.salary?.allowance || 0,
          emp.salary?.grossSalary || 0,
          emp.salary?.netSalary || 0,
          emp.salary?.monthlyCTC || 0,
          emp.salary?.pfRateEmp || 12,
          emp.salary?.pfRateEx || 13,
          emp.salary?.esicRateEmp || 0.75,
          emp.salary?.esicRateEx || 3.25,
          `"${emp.active ? 'Active' : 'Inactive'}"`
        ].join(",");
      })
    ];

    const blob = new Blob([csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Employee_Directory_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Export Success", description: "Complete directory has been downloaded." });
  };

  const calculateFullSalary = (s: SalaryStructure, compliance: boolean) => {
    const gross = (Number(s.basic) || 0) + (Number(s.hra) || 0) + (Number(s.da) || 0) + (Number(s.allowance) || 0);
    let epf = 0, eesic = 0, erpf = 0, eresic = 0;

    if (compliance) {
      epf = Math.round(Number(s.basic) * (Number(s.pfRateEmp) / 100));
      erpf = Math.round(Number(s.basic) * (Number(s.pfRateEx) / 100));
      eesic = Math.round(gross * (Number(s.esicRateEmp) / 100));
      eresic = Math.round(gross * (Number(s.esicRateEx) / 100));
    }

    return {
      ...s,
      grossSalary: gross,
      employeePF: epf,
      employeeESIC: eesic,
      employerPF: erpf,
      employerESIC: eresic,
      netSalary: gross - epf - eesic,
      monthlyCTC: gross + erpf + eresic
    };
  };

  const updateFormSalary = (field: string, val: any) => {
    setFormData(prev => {
      const updatedSalary = { ...prev.salary, [field]: val } as SalaryStructure;
      return {
        ...prev,
        salary: calculateFullSalary(updatedSalary, prev.isGovComplianceEnabled || false)
      };
    });
  };

  const validate = () => {
    const { firstName, employeeId, aadhaar, department, salary, accountNo, ifscCode, pan } = formData;
    
    if (!employeeId || !firstName || !aadhaar || !department || !salary?.basic) {
      toast({ variant: "destructive", title: "Missing Mandatory Fields", description: "Emp ID, First Name, Aadhaar, Dept, and Basic Salary are required." });
      return false;
    }

    if (aadhaar.replace(/\s/g, '').length !== 12 || isNaN(Number(aadhaar.replace(/\s/g, '')))) {
      toast({ variant: "destructive", title: "Invalid Aadhaar", description: "Aadhaar must be a 12-digit numeric value." });
      return false;
    }

    const aadhaarExists = employees.find(e => e.aadhaar === aadhaar && e.id !== editEmployee?.id);
    if (aadhaarExists) {
      toast({ variant: "destructive", title: "Duplicate Aadhaar", description: "This Aadhaar number is already registered." });
      return false;
    }

    const idExists = employees.find(e => e.employeeId === employeeId && e.id !== editEmployee?.id);
    if (idExists) {
      toast({ variant: "destructive", title: "Duplicate ID", description: "This Employee ID is already assigned to another staff member." });
      return false;
    }

    if (pan && pan.length > 0 && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan.toUpperCase())) {
      toast({ variant: "destructive", title: "Invalid PAN Format", description: "PAN must follow standard format (e.g., ABCDE1234F)." });
      return false;
    }

    if (pan) {
      const panExists = employees.find(e => e.pan?.toUpperCase() === pan.toUpperCase() && e.id !== editEmployee?.id);
      if (panExists) {
        toast({ variant: "destructive", title: "Duplicate PAN", description: "This PAN number is already registered." });
        return false;
      }
    }

    if (accountNo && isNaN(Number(accountNo))) {
      toast({ variant: "destructive", title: "Invalid Bank Account", description: "Account number must be numeric." });
      return false;
    }

    if (ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode.toUpperCase())) {
      toast({ variant: "destructive", title: "Invalid IFSC", description: "Please enter a valid Bank IFSC code." });
      return false;
    }

    return true;
  };

  const handlePost = async () => {
    if (isProcessing || !validate()) return;
    setIsProcessing(true);
    
    try {
      const finalData = {
        ...formData,
        name: `${formData.firstName || ""} ${formData.lastName || ""}`.trim(),
        firstName: (formData.firstName || "").toUpperCase(),
        lastName: (formData.lastName || "").toUpperCase(),
        pan: formData.pan?.toUpperCase() || "",
        ifscCode: formData.ifscCode?.toUpperCase() || "",
      };

      if (editEmployee) {
        updateRecord('employees', editEmployee.id, finalData);
        toast({ title: "Profile Updated" });
      } else {
        addRecord('employees', finalData);
        toast({ title: "Employee Registered" });
      }
      handleClose();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setView('list');
    setEditEmployee(null);
    setFormData({ ...INITIAL_FORM_DATA });
  };

  if (!isMounted) return null;

  if (view === 'form') {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="rounded-3xl border-none shadow-2xl overflow-hidden bg-white flex flex-col min-h-[calc(100vh-140px)]">
          <div className="p-8 bg-slate-900 text-white shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center">
                <UserPlus className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-black">{editEmployee ? 'Update Profile' : 'Staff Onboarding'}</h2>
                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Enterprise Identity & Compliance Management</p>
              </div>
            </div>
            {formData.employeeId && (
              <Badge className="bg-primary/20 text-primary border-none px-4 py-1.5 font-black text-xs tracking-widest">{formData.employeeId}</Badge>
            )}
          </div>

          <ScrollArea className="flex-1 bg-white">
            <div className="p-10 space-y-12 pb-32">
              {/* SECTION 1: IDENTITY */}
              <div className="space-y-8">
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] flex items-center gap-3 border-b pb-4">
                  <span className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">1</span> Identity Records
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-8">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">Employee ID * (Auto)</Label>
                    <Input 
                      value={formData.employeeId || ""} 
                      readOnly
                      className="h-12 bg-slate-100 font-black border-slate-200 text-primary cursor-not-allowed select-none focus-visible:ring-0" 
                      placeholder="Generating..." 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">First Name *</Label>
                    <Input value={formData.firstName || ""} onChange={(e) => setFormData(p => ({...p, firstName: e.target.value}))} className="h-12 bg-slate-50 font-bold border-slate-200" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">Last Name</Label>
                    <Input value={formData.lastName || ""} onChange={(e) => setFormData(p => ({...p, lastName: e.target.value}))} className="h-12 bg-slate-50 font-bold border-slate-200" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">Father Name</Label>
                    <Input value={formData.fatherName || ""} onChange={(e) => setFormData(p => ({...p, fatherName: e.target.value}))} className="h-12 bg-slate-50 font-bold border-slate-200" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">Aadhaar Number * (12 Digit)</Label>
                    <Input value={formData.aadhaar || ""} onChange={(e) => setFormData(p => ({...p, aadhaar: e.target.value}))} className="h-12 bg-slate-50 font-mono text-sm" maxLength={12} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">PAN Number</Label>
                    <Input value={formData.pan || ""} onChange={(e) => setFormData(p => ({...p, pan: e.target.value.toUpperCase()}))} className="h-12 bg-slate-50 font-mono uppercase" maxLength={10} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">Mobile No</Label>
                    <Input value={formData.mobile || ""} onChange={(e) => setFormData(p => ({...p, mobile: e.target.value}))} className="h-12 bg-slate-50 font-bold" />
                  </div>
                  <div className="space-y-2 md:col-span-2 lg:col-span-1">
                    <Label className="text-[10px] font-black uppercase text-slate-500">Join Date</Label>
                    <Input type="date" value={formData.joinDate || ""} onChange={(e) => setFormData(p => ({...p, joinDate: e.target.value}))} className="h-12 bg-slate-50 font-bold" />
                  </div>
                  <div className="space-y-2 md:col-span-3">
                    <Label className="text-[10px] font-black uppercase text-slate-500">Address</Label>
                    <Input value={formData.address || ""} onChange={(e) => setFormData(p => ({...p, address: e.target.value}))} className="h-12 bg-slate-50 font-medium" />
                  </div>
                </div>
              </div>

              {/* SECTION 2: PROFESSIONAL */}
              <div className="space-y-8">
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] flex items-center gap-3 border-b pb-4">
                  <span className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">2</span> Professional Assignment
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">Employer Firm *</Label>
                    <Select value={formData.firmId} onValueChange={(v) => setFormData(p => ({...p, firmId: v}))}>
                      <SelectTrigger className="h-12 bg-slate-50 font-bold shadow-sm"><SelectValue placeholder="Select Firm" /></SelectTrigger>
                      <SelectContent>{firms.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">Department *</Label>
                    <Select value={formData.department} onValueChange={(v) => setFormData(p => ({...p, department: v, designation: ''}))}>
                      <SelectTrigger className="h-12 bg-slate-50 font-bold shadow-sm"><SelectValue placeholder="Select Dept" /></SelectTrigger>
                      <SelectContent>{DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">Designation</Label>
                    <Select value={formData.designation} onValueChange={(v) => setFormData(p => ({...p, designation: v}))}>
                      <SelectTrigger className="h-12 bg-slate-50 font-bold shadow-sm"><SelectValue placeholder="Select Desig" /></SelectTrigger>
                      <SelectContent>{(DESIGNATIONS[formData.department!] || []).map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 h-12 mt-6">
                    <Label className="text-[10px] font-black uppercase text-slate-600">Active Status</Label>
                    <Switch checked={formData.active} onCheckedChange={(v) => setFormData(p => ({...p, active: v}))} />
                  </div>
                </div>
              </div>

              {/* SECTION 3: BANKING */}
              <div className="space-y-8">
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] flex items-center gap-3 border-b pb-4">
                  <span className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">3</span> Banking Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">Bank Name</Label>
                    <Input value={formData.bankName || ""} onChange={(e) => setFormData(p => ({...p, bankName: e.target.value}))} className="h-12 bg-slate-50 font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">Account Number (Numeric Only)</Label>
                    <Input value={formData.accountNo || ""} onChange={(e) => setFormData(p => ({...p, accountNo: e.target.value.replace(/[^0-9]/g, '')}))} className="h-12 bg-slate-50 font-mono font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">IFSC Code</Label>
                    <Input value={formData.ifscCode || ""} onChange={(e) => setFormData(p => ({...p, ifscCode: e.target.value.toUpperCase()}))} className="h-12 bg-slate-50 font-mono font-bold uppercase" />
                  </div>
                </div>
              </div>

              {/* SECTION 4: SALARY STRUCTURE */}
              <div className="space-y-8">
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] flex items-center gap-3 border-b pb-4">
                  <span className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">4</span> Salary Structure
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">Basic Salary *</Label>
                    <Input type="number" value={formData.salary?.basic || ""} onChange={(e) => updateFormSalary('basic', e.target.value)} className="h-12 bg-emerald-50/30 border-emerald-100 font-black text-emerald-700" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">HRA</Label>
                    <Input type="number" value={formData.salary?.hra || ""} onChange={(e) => updateFormSalary('hra', e.target.value)} className="h-12 bg-slate-50 font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">DA (Dearness Allowance)</Label>
                    <Input type="number" value={formData.salary?.da || ""} onChange={(e) => updateFormSalary('da', e.target.value)} className="h-12 bg-slate-50 font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">Other Allowance</Label>
                    <Input type="number" value={formData.salary?.allowance || ""} onChange={(e) => updateFormSalary('allowance', e.target.value)} className="h-12 bg-slate-50 font-bold" />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-6 bg-slate-900 rounded-3xl text-white shadow-xl">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Monthly Gross Salary</p>
                    <p className="text-3xl font-black text-primary">{formatCurrency(formData.salary?.grossSalary || 0)}</p>
                  </div>
                  <div className="p-6 bg-slate-900 rounded-3xl text-white shadow-xl border-b-4 border-primary">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Monthly Net Payable</p>
                    <p className="text-3xl font-black text-emerald-400">{formatCurrency(formData.salary?.netSalary || 0)}</p>
                  </div>
                  <div className="p-6 bg-slate-900 rounded-3xl text-white shadow-xl">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Monthly CTC (Cost to Co.)</p>
                    <p className="text-3xl font-black text-white">{formatCurrency(formData.salary?.monthlyCTC || 0)}</p>
                  </div>
                </div>
              </div>

              {/* SECTION 5: COMPLIANCE */}
              <div className="space-y-8">
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] flex items-center gap-3 border-b pb-4">
                  <span className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">5</span> Compliance (PF & ESIC)
                </h3>
                <div className="flex items-center gap-4 mb-6">
                  <Label className="text-xs font-bold text-slate-600">Enable Statutory Deductions</Label>
                  <Switch checked={formData.isGovComplianceEnabled} onCheckedChange={(v) => { setFormData(p => ({...p, isGovComplianceEnabled: v})); updateFormSalary('basic', formData.salary?.basic || 0); }} />
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  {/* PF Section */}
                  <div className="p-8 rounded-3xl bg-blue-50/50 border border-blue-100 space-y-6">
                    <div className="flex items-center gap-2 mb-2"><ShieldCheck className="w-5 h-5 text-blue-600" /><h4 className="text-sm font-black text-blue-900 uppercase">Provident Fund (PF)</h4></div>
                    <div className="space-y-2"><Label className="text-[9px] font-bold text-blue-600 uppercase">PF Number</Label><Input value={formData.pfNumber || ""} onChange={(e) => setFormData(p => ({...p, pfNumber: e.target.value.toUpperCase()}))} className="bg-white border-blue-100 font-bold" /></div>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2"><Label className="text-[9px] font-bold text-slate-500 uppercase">Employee PF %</Label><Input type="number" value={formData.salary?.pfRateEmp} onChange={(e) => updateFormSalary('pfRateEmp', e.target.value)} className="bg-white" /></div>
                      <div className="space-y-2"><Label className="text-[9px] font-bold text-slate-500 uppercase">Employee PF Amt</Label><div className="h-10 px-3 flex items-center bg-white rounded-md border border-slate-100 font-black text-slate-700">{formatCurrency(formData.salary?.employeePF || 0)}</div></div>
                      <div className="space-y-2"><Label className="text-[9px] font-bold text-slate-500 uppercase">Employer PF %</Label><Input type="number" value={formData.salary?.pfRateEx} onChange={(e) => updateFormSalary('pfRateEx', e.target.value)} className="bg-white" /></div>
                      <div className="space-y-2"><Label className="text-[9px] font-bold text-slate-500 uppercase">Employer PF Amt</Label><div className="h-10 px-3 flex items-center bg-white rounded-md border border-slate-100 font-black text-slate-700">{formatCurrency(formData.salary?.employerPF || 0)}</div></div>
                    </div>
                  </div>
                  
                  {/* ESIC Section */}
                  <div className="p-8 rounded-3xl bg-orange-50/50 border border-orange-100 space-y-6">
                    <div className="flex items-center gap-2 mb-2"><CreditCard className="w-5 h-5 text-orange-600" /><h4 className="text-sm font-black text-orange-900 uppercase">ESIC Contribution</h4></div>
                    <div className="space-y-2"><Label className="text-[9px] font-bold text-orange-600 uppercase">ESIC Number</Label><Input value={formData.esicNumber || ""} onChange={(e) => setFormData(p => ({...p, esicNumber: e.target.value.toUpperCase()}))} className="bg-white border-orange-100 font-bold" /></div>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2"><Label className="text-[9px] font-bold text-slate-500 uppercase">Employee ESIC %</Label><Input type="number" step="any" value={formData.salary?.esicRateEmp} onChange={(e) => updateFormSalary('esicRateEmp', e.target.value)} className="bg-white" /></div>
                      <div className="space-y-2"><Label className="text-[9px] font-bold text-slate-500 uppercase">Employee ESIC Amt</Label><div className="h-10 px-3 flex items-center bg-white rounded-md border border-slate-100 font-black text-slate-700">{formatCurrency(formData.salary?.employeeESIC || 0)}</div></div>
                      <div className="space-y-2"><Label className="text-[9px] font-bold text-slate-500 uppercase">Employer ESIC %</Label><Input type="number" step="any" value={formData.salary?.esicRateEx} onChange={(e) => updateFormSalary('esicRateEx', e.target.value)} className="bg-white" /></div>
                      <div className="space-y-2"><Label className="text-[9px] font-bold text-slate-500 uppercase">Employer ESIC Amt</Label><div className="h-10 px-3 flex items-center bg-white rounded-md border border-slate-100 font-black text-slate-700">{formatCurrency(formData.salary?.employerESIC || 0)}</div></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
          
          <div className="p-4 bg-slate-50 border-t flex justify-end items-center gap-4 shrink-0 z-20">
            <Button variant="ghost" onClick={handleClose} className="rounded-xl font-black text-[11px] uppercase tracking-widest px-10 h-12 text-slate-600 hover:bg-slate-200">Cancel</Button>
            <Button className="bg-primary hover:bg-primary/90 rounded-xl font-black text-[11px] uppercase tracking-widest px-12 h-12 shadow-xl shadow-primary/20" onClick={handlePost} disabled={isProcessing}>
              {isProcessing ? "Finalizing Entry..." : (editEmployee ? "Update Profile" : "Onboard Staff")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div><h1 className="text-2xl font-bold">Employee Directory</h1><p className="text-muted-foreground">Comprehensive registry for identity, banking, and statutory compliance.</p></div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleExportEmployees} className="font-bold border-emerald-200 text-emerald-700 hover:bg-emerald-50 h-11 px-6 gap-2">
            <FileSpreadsheet className="w-5 h-5" /> Export Excel
          </Button>
          <Button className="font-bold shadow-lg shadow-primary/20 bg-primary h-11 px-8" onClick={() => { setFormData({ ...INITIAL_FORM_DATA }); setView('form'); }} disabled={isProcessing}><UserPlus className="w-5 h-5 mr-2" /> Add New Staff</Button>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 p-4">
          <div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search by name, ID, or Aadhaar..." className="pl-10 h-10 bg-white" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} /></div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="w-full">
            <Table className="min-w-[1200px]">
              <TableHeader className="bg-slate-50"><TableRow><TableHead className="font-bold px-6">Name / Employee ID</TableHead><TableHead className="font-bold">Aadhaar (ID)</TableHead><TableHead className="font-bold">Dept / Designation</TableHead><TableHead className="font-bold">Mobile</TableHead><TableHead className="font-bold text-right">Monthly CTC</TableHead><TableHead className="font-bold text-center">Status</TableHead><TableHead className="text-right font-bold pr-6">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {paginatedEmployees.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No records found matching your search.</TableCell></TableRow>
                ) : (
                  paginatedEmployees.map((emp) => (
                    <TableRow key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="px-6">
                        <div className="flex flex-col">
                          <span className="font-black text-slate-900 uppercase text-xs sm:text-sm">{emp.name || `${emp.firstName} ${emp.lastName}`}</span>
                          <span className="text-[10px] font-mono text-primary font-black uppercase tracking-tight">{emp.employeeId}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-mono font-medium">{emp.aadhaar}</TableCell>
                      <TableCell><div className="flex flex-col"><span className="text-xs font-bold text-slate-700">{emp.department}</span><span className="text-[9px] text-muted-foreground uppercase">{emp.designation}</span></div></TableCell>
                      <TableCell className="text-xs font-bold">{emp.mobile || "---"}</TableCell>
                      <TableCell className="text-right font-black text-slate-900 text-xs sm:text-sm">{formatCurrency(emp.salary?.monthlyCTC || 0)}</TableCell>
                      <TableCell className="text-center"><Badge variant="outline" className={cn("px-3 py-0.5 text-[9px] uppercase font-black", emp.active ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>{emp.active ? "Active" : "De-active"}</Badge></TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex justify-end items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-primary" onClick={() => { setEditEmployee(emp); setFormData({ ...emp }); setView('form'); }}><Pencil className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600" onClick={() => { setSalaryRevision(emp); setRevisionData({ ...emp.salary }); }}><TrendingUp className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400" onClick={() => setViewHistoryEmployee(emp)}><History className="w-4 h-4" /></Button>
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

      {/* Salary Revision Dialog */}
      <Dialog open={!!salaryRevision} onOpenChange={(o) => !o && setSalaryRevision(null)}>
        <DialogContent className="sm:max-w-xl rounded-2xl p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
             <DialogTitle className="text-xl font-black flex items-center gap-3"><TrendingUp className="w-6 h-6 text-primary" /> Salary Revision</DialogTitle>
             <p className="text-[10px] text-primary font-black uppercase mt-2">{salaryRevision?.firstName} {salaryRevision?.lastName} • {salaryRevision?.employeeId}</p>
          </DialogHeader>
          <div className="p-8 space-y-6">
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-500">Basic Salary</Label><Input type="number" value={revisionData.basic} onChange={(e) => setRevisionData(calculateFullSalary({...revisionData, basic: Number(e.target.value)}, salaryRevision?.isGovComplianceEnabled || false))} className="font-black text-lg h-12" /></div>
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-500">HRA</Label><Input type="number" value={revisionData.hra} onChange={(e) => setRevisionData(calculateFullSalary({...revisionData, hra: Number(e.target.value)}, salaryRevision?.isGovComplianceEnabled || false))} className="font-bold h-12" /></div>
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-500">DA</Label><Input type="number" value={revisionData.da} onChange={(e) => setRevisionData(calculateFullSalary({...revisionData, da: Number(e.target.value)}, salaryRevision?.isGovComplianceEnabled || false))} className="font-bold h-12" /></div>
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-500">Allowance</Label><Input type="number" value={revisionData.allowance} onChange={(e) => setRevisionData(calculateFullSalary({...revisionData, allowance: Number(e.target.value)}, salaryRevision?.isGovComplianceEnabled || false))} className="font-bold h-12" /></div>
             </div>
             <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center shadow-inner">
                <div><p className="text-[9px] font-black uppercase text-slate-400">New Net Salary</p><p className="text-2xl font-black text-emerald-600">{formatCurrency(revisionData.netSalary)}</p></div>
                <div className="text-right"><p className="text-[9px] font-black uppercase text-slate-400">Monthly CTC</p><p className="text-2xl font-black text-slate-900">{formatCurrency(revisionData.monthlyCTC)}</p></div>
             </div>
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t gap-3">
             <Button variant="ghost" onClick={() => setSalaryRevision(null)} className="flex-1 rounded-xl font-bold">Cancel</Button>
             <Button className="flex-1 bg-primary font-black rounded-xl" onClick={async () => { updateRecord('employees', salaryRevision!.id, { salary: revisionData }); setSalaryRevision(null); toast({title: "Salary Updated"}); }} disabled={isProcessing}>Post Revision</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Career Ledger Dialog */}
      <Dialog open={!!viewHistoryEmployee} onOpenChange={(o) => !o && setViewHistoryEmployee(null)}>
        <DialogContent className="sm:max-w-3xl rounded-2xl p-0 overflow-hidden border-none shadow-2xl">
           <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
              <DialogTitle className="text-xl font-black flex items-center gap-3"><History className="w-6 h-6 text-primary" /> Career Ledger</DialogTitle>
              <p className="text-[10px] text-primary font-black uppercase mt-2">{viewHistoryEmployee?.firstName} {viewHistoryEmployee?.lastName} • Profile Record</p>
           </DialogHeader>
           <div className="p-8">
              <Table className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                 <TableHeader className="bg-slate-50"><TableRow><TableHead className="font-black text-[10px] uppercase">Effective Range</TableHead><TableHead className="font-black text-[10px] uppercase text-right">Monthly CTC</TableHead></TableRow></TableHeader>
                 <TableBody>{(viewHistoryEmployee?.salaryHistory || []).map((h, i) => (<TableRow key={i}><TableCell className="font-bold text-xs">{h.fromMonth} - {h.toMonth}</TableCell><TableCell className="text-right font-black text-slate-700">{formatCurrency(h.monthlyCTC)}</TableCell></TableRow>))}</TableBody>
              </Table>
           </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StandardPaginationFooter({ current, total, onPageChange }: { current: number, total: number, onPageChange: (p: number) => void }) {
  return (
    <CardFooter className="bg-slate-50 border-t flex flex-col sm:flex-row items-center justify-between p-4 gap-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={current === 1} onClick={() => onPageChange(current - 1)} className="font-bold h-9"><ChevronLeft className="w-4 h-4 mr-1" /> Prev</Button>
        <Button variant="outline" size="sm" disabled={current === total || total === 0} onClick={() => onPageChange(current + 1)} className="font-bold h-9">Next <ChevronRight className="w-4 h-4 ml-1" /></Button>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Page {current} of {total || 1}</span>
        <div className="flex items-center gap-2 border-l pl-4 border-slate-200">
          <Label className="text-[8px] font-black uppercase text-slate-400 tracking-tighter">Jump</Label>
          <div className="flex gap-1">
            <Input type="number" className="w-14 h-8 text-center font-bold text-xs" value={current} onChange={(e) => { const p = parseInt(e.target.value); if (p >= 1 && p <= total) onPageChange(p); }} />
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white"><ArrowRightCircle className="w-3.5 h-3.5" /></div>
          </div>
        </div>
      </div>
    </CardFooter>
  );
}
