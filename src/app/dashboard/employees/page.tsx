
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Search, 
  MoreHorizontal, 
  UserPlus, 
  TrendingUp, 
  Pencil,
  CheckCircle,
  XCircle,
  History,
  CalendarDays,
  Building2,
  Banknote,
  ShieldCheck,
  ChevronRight,
  User as UserIcon,
  AlertTriangle,
  Clock,
  TrendingUp as GrowthIcon,
  TrendingDown as LossIcon,
  Factory
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator 
} from "@/components/ui/dropdown-menu";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCurrency, cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Employee, SalaryStructure, Firm } from "@/lib/types";
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
  const { toast } = useToast();

  const isSuperAdmin = useMemo(() => currentUser?.role === 'SUPER_ADMIN', [currentUser]);

  // Modal States
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [salaryRevision, setSalaryRevision] = useState<Employee | null>(null);
  const [viewHistoryEmployee, setViewHistoryEmployee] = useState<Employee | null>(null);
  const [employeeToToggle, setEmployeeToToggle] = useState<Employee | null>(null);
  const [isToggleConfirmOpen, setIsToggleConfirmOpen] = useState(false);
  
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
      eesic = Math.round(basic * (rates.esicEmp / 100));
      eresic = Math.round(basic * (rates.esicEx / 100));
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
      const s = prev.salary || { ...INITIAL_SALARY_STRUCTURE };
      const newBasic = field === 'basic' ? val : s.basic;
      const newHra = field === 'hra' ? val : (field === 'basic' ? Math.round(val * 0.5) : s.hra);
      const newAllowance = field === 'allowance' ? val : s.allowance;
      
      const newRates = {
        pfEmp: field === 'pfRateEmp' ? val : s.pfRateEmp,
        esicEmp: field === 'esicRateEmp' ? val : s.esicRateEmp,
        pfEx: field === 'pfRateEx' ? val : s.pfRateEx,
        esicRateEx: field === 'esicRateEx' ? val : s.esicRateEx,
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
        active: editEmployee ? (formData.active ?? true) : true
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
    setIsProcessing(false); // Safety reset
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

  const handleToggleStatus = async () => {
    if (!employeeToToggle || isProcessing) return;
    if (!isSuperAdmin) {
      toast({ variant: "destructive", title: "Restricted", description: "Only Super Admin can deactivate employees." });
      return;
    }
    setIsProcessing(true);
    
    try {
      updateRecord('employees', employeeToToggle.id, { active: !employeeToToggle.active });
      
      toast({ 
        title: employeeToToggle.active ? "Employee Deactivated" : "Employee Activated",
        description: `${employeeToToggle.name} status updated successfully.`
      });
      
    } catch (e) {
      console.error("Toggle error:", e);
      toast({ variant: "destructive", title: "Error", description: "Status toggle failed." });
    } finally {
      setIsToggleConfirmOpen(false);
      setEmployeeToToggle(null);
      setIsProcessing(false);
    }
  };

  const increasePct = useMemo(() => {
    if (!salaryRevision || !salaryRevision.salary || (salaryRevision.salary.monthlyCTC || 0) === 0) return "0.0";
    const diff = (revisionData.monthlyCTC || 0) - (salaryRevision.salary.monthlyCTC || 0);
    const pct = (diff / salaryRevision.salary.monthlyCTC) * 100;
    return isNaN(pct) || !isFinite(pct) ? "0.0" : pct.toFixed(1);
  }, [salaryRevision, revisionData.monthlyCTC]);

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
        <Button 
          className="font-bold shadow-lg shadow-primary/20" 
          onClick={() => {
            setFormData({ ...INITIAL_FORM_DATA });
            setIsRegistrationOpen(true);
          }}
          disabled={isProcessing}
        >
          <UserPlus className="w-4 h-4 mr-2" /> Add Employee
        </Button>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by name, ID, or Aadhaar..." 
              className="pl-10 h-10 bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
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
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No employees found.</TableCell>
                </TableRow>
              ) : (
                filtered.map((emp) => (
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
                      <div className="flex justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={(e) => { 
                            e.stopPropagation();
                            setEditEmployee(emp); 
                            setFormData({ ...emp }); 
                            setIsRegistrationOpen(true); 
                          }}
                          disabled={isProcessing}
                        >
                          <Pencil className="w-4 h-4 text-slate-500" />
                        </Button>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={isProcessing}>
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem onSelect={(e) => { 
                              e.preventDefault();
                              setSalaryRevision(emp); 
                              setRevisionData({ ...emp.salary }); 
                            }}>
                              <TrendingUp className="w-4 h-4 mr-2 text-emerald-600" /> Increase Salary
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={(e) => { 
                              e.preventDefault();
                              setViewHistoryEmployee(emp); 
                            }}>
                              <History className="w-4 h-4 mr-2" /> View Salary Record
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {isSuperAdmin && (
                              <DropdownMenuItem 
                                className={emp.active ? "text-rose-600 font-bold" : "text-emerald-600 font-bold"}
                                onSelect={(e) => {
                                  e.preventDefault();
                                  setEmployeeToToggle(emp);
                                  setIsToggleConfirmOpen(true);
                                }}
                              >
                                {emp.active ? <><XCircle className="w-4 h-4 mr-2" /> Deactivate</> : <><CheckCircle className="w-4 h-4 mr-2" /> Activate</>}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Registration Modal */}
      <Dialog open={isRegistrationOpen} onOpenChange={(open) => { if (!open) handleCloseRegistration(); }}>
        <DialogContent className="sm:max-w-5xl h-[90vh] flex flex-col p-0 overflow-hidden">
          {isRegistrationOpen && (
            <>
              <DialogHeader className="p-6 pb-2">
                <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                  <ShieldCheck className="w-6 h-6 text-primary" />
                  {editEmployee ? "Edit Employee Profile" : "New Employee Registration"}
                </DialogTitle>
                <DialogDescription>Fill all mandatory fields to generate system ID and payroll record.</DialogDescription>
              </DialogHeader>
              
              <ScrollArea className="flex-1 px-6">
                <div className="space-y-8 pb-8">
                  <div className="space-y-4 pt-4">
                    <h4 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                      <Building2 className="w-4 h-4" /> 1. Basic Details
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <Label>Firm Name</Label>
                        <Select value={formData.firmId} onValueChange={(v) => setFormData(prev => ({...prev, firmId: v, unitIds: []}))}>
                          <SelectTrigger><SelectValue placeholder="Select Firm" /></SelectTrigger>
                          <SelectContent>
                            {firms.map(f => (
                              <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">Authorized Unit(s) / Plant(s) *</Label>
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 max-h-40 overflow-y-auto space-y-2">
                          {!formData.firmId ? (
                             <p className="text-[10px] text-muted-foreground uppercase font-bold text-center py-4">Select Firm First</p>
                          ) : availableUnits.length === 0 ? (
                             <p className="text-[10px] text-muted-foreground uppercase font-bold text-center py-4">No Units Defined</p>
                          ) : (
                            availableUnits.map(u => (
                              <div key={u.id} className="flex items-center gap-3 bg-white p-2 rounded-lg border border-slate-100">
                                <Checkbox 
                                  id={`unit-${u.id}`} 
                                  checked={(formData.unitIds || []).includes(u.id)}
                                  onCheckedChange={() => toggleUnit(u.id)}
                                />
                                <Label htmlFor={`unit-${u.id}`} className="text-xs font-bold cursor-pointer flex-1">{u.name}</Label>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Employee ID</Label>
                        <Input value={editEmployee ? editEmployee.employeeId : "AUTO-GEN"} disabled className="bg-slate-100 font-mono font-bold" />
                      </div>
                      <div className="space-y-2">
                        <Label>Employee Name *</Label>
                        <Input placeholder="Enter full name" value={formData.name || ''} onChange={(e) => setFormData(prev => ({...prev, name: e.target.value}))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Father Name</Label>
                        <Input placeholder="Enter father's name" value={formData.fatherName || ''} onChange={(e) => setFormData(prev => ({...prev, fatherName: e.target.value}))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Mobile Number *</Label>
                        <Input placeholder="10-digit mobile" value={formData.mobile || ''} onChange={(e) => setFormData(prev => ({...prev, mobile: e.target.value}))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Aadhaar Number *</Label>
                        <Input placeholder="12-digit number" value={formData.aadhaar || ''} onChange={(e) => setFormData(prev => ({...prev, aadhaar: e.target.value}))} maxLength={12} />
                      </div>
                      <div className="space-y-2">
                        <Label>Joining Date *</Label>
                        <Input type="date" value={formData.joinDate || ''} onChange={(e) => setFormData(prev => ({...prev, joinDate: e.target.value}))} />
                      </div>
                      <div className="space-y-2 md:col-span-3">
                        <Label>Residential Address</Label>
                        <Textarea placeholder="Full address with pincode" value={formData.address || ''} onChange={(e) => setFormData(prev => ({...prev, address: e.target.value}))} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                      <ChevronRight className="w-4 h-4" /> 2. Dept & Designation
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label>Department</Label>
                        <Select value={formData.department} onValueChange={(v) => setFormData(prev => ({...prev, department: v, designation: undefined}))}>
                          <SelectTrigger><SelectValue placeholder="Select Dept" /></SelectTrigger>
                          <SelectContent>{DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Designation</Label>
                        <Select value={formData.designation} onValueChange={(v) => setFormData(prev => ({...prev, designation: v}))}>
                          <SelectTrigger><SelectValue placeholder="Select Designation" /></SelectTrigger>
                          <SelectContent>
                            {formData.department && (DESIGNATIONS[formData.department] || []).map(des => <SelectItem key={des} value={des}>{des}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                      <Banknote className="w-4 h-4" /> 3. Salary Structure
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <Label>Basic Salary *</Label>
                        <Input type="number" value={formData.salary?.basic || ''} onChange={(e) => updateFormSalary('basic', parseFloat(e.target.value) || 0)} />
                      </div>
                      <div className="space-y-2">
                        <Label>HRA (Editable)</Label>
                        <Input type="number" value={formData.salary?.hra || ''} onChange={(e) => updateFormSalary('hra', parseFloat(e.target.value) || 0)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Other Allowance</Label>
                        <Input type="number" value={formData.salary?.allowance || ''} onChange={(e) => updateFormSalary('allowance', parseFloat(e.target.value) || 0)} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                      <Banknote className="w-4 h-4" /> 4. Banking Details
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <Label>Bank Name</Label>
                        <Input placeholder="e.g. HDFC, SBI" value={formData.bankName || ''} onChange={(e) => setFormData(prev => ({...prev, bankName: e.target.value}))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Account Number</Label>
                        <Input type="number" placeholder="Enter account number" value={formData.accountNo || ''} onChange={(e) => setFormData(prev => ({...prev, accountNo: e.target.value}))} />
                      </div>
                      <div className="space-y-2">
                        <Label>IFSC Code</Label>
                        <Input placeholder="HDFC0001234" className="uppercase" value={formData.ifscCode || ''} onChange={(e) => setFormData(prev => ({...prev, ifscCode: e.target.value.toUpperCase()}))} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4" /> 5. Gov. Compliance (PF/ESIC)
                      </h4>
                      <div className="flex items-center space-x-2">
                        <Label htmlFor="compliance-toggle">Applicable</Label>
                        <Switch 
                          id="compliance-toggle" 
                          checked={formData.isGovComplianceEnabled} 
                          onCheckedChange={(c) => {
                            setFormData(prev => {
                              const s = prev.salary || { ...INITIAL_SALARY_STRUCTURE };
                              return { 
                                ...prev, 
                                isGovComplianceEnabled: c,
                                salary: calculateSalaryMetrics(s.basic, s.hra, s.allowance, c, { 
                                  pfEmp: s.pfRateEmp, esicEmp: s.esicRateEmp, pfEx: s.pfRateEx, esicEx: s.esicRateEx 
                                })
                              };
                            });
                          }} 
                        />
                      </div>
                    </div>
                    {formData.isGovComplianceEnabled && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                          <div className="space-y-2">
                            <Label>PF Account Number</Label>
                            <Input value={formData.pfNumber || ''} onChange={(e) => setFormData(prev => ({...prev, pfNumber: e.target.value}))} />
                          </div>
                          <div className="space-y-2">
                            <Label>ESIC Account Number</Label>
                            <Input value={formData.esicNumber || ''} onChange={(e) => setFormData(prev => ({...prev, esicNumber: e.target.value}))} />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 space-y-4">
                            <h5 className="text-xs font-bold text-emerald-800 flex items-center gap-2"><UserIcon className="w-3 h-3" /> Employee Contribution</h5>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-[10px] text-emerald-600 font-bold uppercase">PF %</Label>
                                <Input 
                                  type="number" 
                                  className="h-8 text-xs bg-white" 
                                  value={formData.salary?.pfRateEmp || 12} 
                                  onChange={(e) => updateFormSalary('pfRateEmp', parseFloat(e.target.value) || 0)}
                                />
                                <p className="text-sm font-bold">{formatCurrency(formData.salary?.employeePF || 0)}</p>
                              </div>
                              <div className="space-y-2">
                                <Label className="text-[10px] text-emerald-600 font-bold uppercase">ESIC %</Label>
                                <Input 
                                  type="number" 
                                  className="h-8 text-xs bg-white" 
                                  value={formData.salary?.esicRateEmp || 0.75} 
                                  onChange={(e) => updateFormSalary('esicRateEmp', parseFloat(e.target.value) || 0)}
                                />
                                <p className="text-sm font-bold">{formatCurrency(formData.salary?.employeeESIC || 0)}</p>
                              </div>
                            </div>
                          </div>

                          <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 space-y-4">
                            <h5 className="text-xs font-bold text-blue-800 flex items-center gap-2"><Building2 className="w-3 h-3" /> Employer Contribution</h5>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-[10px] text-blue-600 font-bold uppercase">PF %</Label>
                                <Input 
                                  type="number" 
                                  className="h-8 text-xs bg-white" 
                                  value={formData.salary?.pfRateEx || 13} 
                                  onChange={(e) => updateFormSalary('pfRateEx', parseFloat(e.target.value) || 0)}
                                />
                                <p className="text-sm font-bold">{formatCurrency(formData.salary?.employerPF || 0)}</p>
                              </div>
                              <div className="space-y-2">
                                <Label className="text-[10px] text-blue-600 font-bold uppercase">ESIC %</Label>
                                <Input 
                                  type="number" 
                                  className="h-8 text-xs bg-white" 
                                  value={formData.salary?.esicRateEx || 3.25} 
                                  onChange={(e) => updateFormSalary('esicRateEx', parseFloat(e.target.value) || 0)}
                                />
                                <p className="text-sm font-bold">{formatCurrency(formData.salary?.employerESIC || 0)}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>

              <div className="bg-slate-900 text-white p-6 grid grid-cols-2 md:grid-cols-4 gap-4 flex-shrink-0">
                <div className="text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gross Salary</p>
                  <p className="text-xl font-bold">{formatCurrency(formData.salary?.grossSalary || 0)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">Net Payable</p>
                  <p className="text-xl font-bold text-rose-300">{formatCurrency(formData.salary?.netSalary || 0)}</p>
                </div>
                <div className="text-center border-l border-slate-700">
                  <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Monthly CTC</p>
                  <p className="text-xl font-bold text-emerald-300">{formatCurrency(formData.salary?.monthlyCTC || 0)}</p>
                </div>
                <div className="flex items-center justify-end gap-3 pr-4">
                  <Button variant="ghost" className="text-white hover:bg-slate-800" onClick={handleCloseRegistration}>Cancel</Button>
                  <Button className="bg-emerald-600 hover:bg-emerald-700 px-8" onClick={handleRegistrationPost} disabled={isProcessing}>
                    {isProcessing ? "Posting..." : "Post Employee"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Salary Revision Modal */}
      <Dialog open={!!salaryRevision} onOpenChange={(open) => { if (!open) setSalaryRevision(null); }}>
        <DialogContent className="sm:max-w-4xl">
          {salaryRevision && (
            <>
              <DialogHeader>
                <DialogTitle>Salary Revision - {salaryRevision.name}</DialogTitle>
                <DialogDescription>Adjust components and post updates to payroll.</DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6 py-4">
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { label: "Basic", val: salaryRevision.salary?.basic || 0 },
                    { label: "HRA", val: salaryRevision.salary?.hra || 0 },
                    { label: "Allowance", val: salaryRevision.salary?.allowance || 0 },
                    { label: "Current CTC", val: salaryRevision.salary?.monthlyCTC || 0, highlight: true },
                  ].map((item, i) => (
                    <div key={i} className={cn(
                      "p-3 rounded-lg border text-center",
                      item.highlight ? "bg-primary/5 border-primary/20" : "bg-slate-50 border-slate-100"
                    )}>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">{item.label}</p>
                      <p className={cn("text-sm font-bold", item.highlight && "text-primary")}>{formatCurrency(item.val)}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold flex items-center gap-2 border-b pb-2">
                      <TrendingUp className="w-4 h-4 text-emerald-600" /> Revised Structure
                    </h4>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2 items-center">
                        <Label>Basic Salary</Label>
                        <Input type="number" value={revisionData.basic} onChange={(e) => {
                          const b = parseFloat(e.target.value) || 0;
                          setRevisionData(prev => calculateSalaryMetrics(b, Math.round(b * 0.5), prev.allowance, !!salaryRevision.isGovComplianceEnabled, { pfEmp: prev.pfRateEmp, esicEmp: prev.esicRateEmp, pfEx: prev.pfRateEx, esicEx: prev.esicRateEx }));
                        }} />
                      </div>
                      <div className="grid grid-cols-2 gap-2 items-center">
                        <Label>HRA</Label>
                        <Input type="number" value={revisionData.hra} onChange={(e) => {
                          const h = parseFloat(e.target.value) || 0;
                          setRevisionData(prev => calculateSalaryMetrics(prev.basic, h, prev.allowance, !!salaryRevision.isGovComplianceEnabled, { pfEmp: prev.pfRateEmp, esicEmp: prev.esicRateEmp, pfEx: prev.pfRateEx, esicEx: prev.esicRateEx }));
                        }} />
                      </div>
                      <div className="grid grid-cols-2 gap-2 items-center">
                        <Label>Other Allowance</Label>
                        <Input type="number" value={revisionData.allowance} onChange={(e) => {
                          const a = parseFloat(e.target.value) || 0;
                          setRevisionData(prev => calculateSalaryMetrics(prev.basic, prev.hra, a, !!salaryRevision.isGovComplianceEnabled, { pfEmp: prev.pfRateEmp, esicEmp: prev.esicRateEmp, pfEx: prev.pfRateEx, esicEx: prev.esicRateEx }));
                        }} />
                      </div>
                      
                      <div className="pt-4 border-t mt-4 space-y-2">
                        <Label className="flex items-center gap-2 text-primary">
                          <CalendarDays className="w-4 h-4" /> Effect from Month
                        </Label>
                        <Select value={effectiveMonth} onValueChange={setEffectiveMonth}>
                          <SelectTrigger className="w-full bg-slate-50 font-medium">
                            <SelectValue placeholder="Select Month" />
                          </SelectTrigger>
                          <SelectContent>
                            {MONTH_OPTIONS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-bold border-b pb-2">Calculation Summary</h4>
                    <div className="space-y-2 bg-emerald-50/50 p-6 rounded-2xl border border-emerald-100 h-full flex flex-col justify-center">
                      <div className="flex justify-between items-end border-b border-emerald-100 pb-4 mb-4">
                        <div>
                          <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">New Monthly CTC</p>
                          <h3 className="text-3xl font-bold text-emerald-900">{formatCurrency(revisionData.monthlyCTC || 0)}</h3>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Increase %</p>
                          <h3 className="text-3xl font-bold text-emerald-900">
                            {increasePct}%
                          </h3>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-muted-foreground">Previous CTC</span><span>{formatCurrency(salaryRevision.salary?.monthlyCTC || 0)}</span></div>
                        <div className="flex justify-between font-bold text-emerald-700"><span>Net Increment</span><span>+{formatCurrency((revisionData.monthlyCTC || 0) - (salaryRevision.salary?.monthlyCTC || 0))}</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="bg-slate-50 -m-6 mt-2 p-6 rounded-b-lg border-t">
                <Button variant="outline" onClick={() => setSalaryRevision(null)} disabled={isProcessing}>Cancel</Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700 px-8" onClick={handlePostSalaryRevision} disabled={isProcessing}>
                  {isProcessing ? "Posting..." : "Post Update"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Salary History Modal */}
      <Dialog open={!!viewHistoryEmployee} onOpenChange={(open) => { if (!open) setViewHistoryEmployee(null); }}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          {viewHistoryEmployee && (
            <>
              <DialogHeader className="p-6 border-b bg-slate-50/50">
                <div className="flex justify-between items-start">
                  <div>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                      <History className="w-5 h-5 text-primary" />
                      Salary Record: {viewHistoryEmployee.name}
                    </DialogTitle>
                    <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground font-medium">
                      <span className="bg-primary/10 text-primary px-2 py-0.5 rounded font-mono">{viewHistoryEmployee.employeeId}</span>
                      <span>•</span>
                      <span>{viewHistoryEmployee.department} / {viewHistoryEmployee.designation}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Join Month</p>
                    <p className="font-bold text-slate-700">{formatToMMM_YYYY(new Date(viewHistoryEmployee.joinDate))}</p>
                  </div>
                </div>
              </DialogHeader>

              <ScrollArea className="flex-1 p-6">
                <div className="space-y-6">
                  <Card className="border-none bg-slate-900 text-white shadow-lg">
                    <CardContent className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Basic Salary</p>
                        <p className="text-lg font-bold">{formatCurrency(viewHistoryEmployee.salary?.basic || 0)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">HRA</p>
                        <p className="text-lg font-bold">{formatCurrency(viewHistoryEmployee.salary?.hra || 0)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Other Allowance</p>
                        <p className="text-lg font-bold">{formatCurrency(viewHistoryEmployee.salary?.allowance || 0)}</p>
                      </div>
                      <div className="space-y-1 border-l border-slate-700 pl-4">
                        <p className="text-[10px] font-bold text-emerald-400 uppercase">Current Monthly CTC</p>
                        <p className="text-xl font-bold text-emerald-300">{formatCurrency(viewHistoryEmployee.salary?.monthlyCTC || 0)}</p>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="space-y-4">
                    <h4 className="font-bold text-sm flex items-center gap-2 text-slate-700">
                      <History className="w-4 h-4" /> Salary History Timeline
                    </h4>
                    <div className="border rounded-xl overflow-hidden shadow-sm">
                      <Table>
                        <TableHeader className="bg-slate-50">
                          <TableRow>
                            <TableHead className="font-bold">From Month</TableHead>
                            <TableHead className="font-bold">To Month</TableHead>
                            <TableHead className="font-bold text-right">Monthly CTC</TableHead>
                            <TableHead className="font-bold text-center">Growth %</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {!viewHistoryEmployee.salaryHistory || viewHistoryEmployee.salaryHistory.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                No history records found.
                              </TableCell>
                            </TableRow>
                          ) : (
                            [...viewHistoryEmployee.salaryHistory].reverse().map((entry, idx, arr) => {
                              const prevEntry = arr[idx + 1];
                              let growthLabel: string | null = null;
                              let pctValue = 0;
                              
                              if (prevEntry) {
                                const diff = entry.monthlyCTC - prevEntry.monthlyCTC;
                                pctValue = (diff / prevEntry.monthlyCTC) * 100;
                                const isPos = pctValue >= 0;
                                growthLabel = `${isPos ? '+' : ''}${pctValue.toFixed(1)}%`;
                              } else {
                                growthLabel = "STARTING";
                              }

                              return (
                                <TableRow key={idx} className="hover:bg-slate-50/50">
                                  <TableCell className="font-medium">{entry.fromMonth}</TableCell>
                                  <TableCell>
                                    {entry.toMonth === "Present" ? (
                                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">Present</Badge>
                                    ) : (
                                      entry.toMonth
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right font-bold text-primary">
                                    {formatCurrency(entry.monthlyCTC)}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge 
                                      variant="outline" 
                                      className={cn(
                                        "font-black text-[10px] px-2 py-0 h-6 uppercase",
                                        growthLabel === "STARTING" ? "text-slate-400 bg-slate-50 border-slate-200" : 
                                        pctValue >= 0 ? "text-emerald-600 bg-emerald-50 border-emerald-200" : "text-rose-600 bg-rose-50 border-rose-200"
                                      )}
                                    >
                                      {growthLabel === "STARTING" ? null : (pctValue >= 0 ? <GrowthIcon className="w-2.5 h-3 mr-1" /> : <LossIcon className="w-2.5 h-3 mr-1" />)}
                                      {growthLabel}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              </ScrollArea>
              
              <div className="p-4 bg-slate-50 border-t flex justify-end">
                <Button variant="outline" onClick={() => setViewHistoryEmployee(null)}>Close Record</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Toggle Status Confirmation Dialog */}
      <AlertDialog open={isToggleConfirmOpen} onOpenChange={setIsToggleConfirmOpen}>
        <AlertDialogContent className="sm:max-w-md">
          {isToggleConfirmOpen && (
            <>
              <AlertDialogHeader>
                <div className="mx-auto w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center mb-4">
                  <AlertTriangle className="w-6 h-6 text-rose-600" />
                </div>
                <AlertDialogTitle className="text-center text-xl">
                  Confirm {employeeToToggle?.active ? "Deactivation" : "Activation"}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-center pt-2">
                  Are you sure you want to {employeeToToggle?.active ? "deactivate" : "activate"} <strong>{employeeToToggle?.name}</strong>?
                  {employeeToToggle?.active ? 
                    " This user will lose immediate access to the login portal." : 
                    " This user will regain access to mark attendance and view records."
                  }
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="sm:justify-center gap-3 pt-6">
                <AlertDialogCancel 
                  className="mt-0" 
                  onClick={() => { 
                    setIsToggleConfirmOpen(false); 
                    setEmployeeToToggle(null); 
                  }}
                  disabled={isProcessing}
                >
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction 
                  onClick={(e) => { e.preventDefault(); handleToggleStatus(); }}
                  disabled={isProcessing}
                  className={employeeToToggle?.active ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"}
                >
                  {isProcessing ? "Processing..." : `Confirm ${employeeToToggle?.active ? "Deactivate" : "Activate"}`}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
