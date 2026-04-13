"use client";

import { useState, useMemo } from "react";
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
  User,
  Info,
  AlertTriangle
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
import { Employee, SalaryStructure, Firm, SalaryHistoryEntry } from "@/lib/types";
import { DEPARTMENTS, DESIGNATIONS } from "@/lib/constants";

const MOCK_FIRMS: Firm[] = [
  { 
    id: "f1", 
    name: "Sikka Industries Ltd.", 
    gstin: "07AAAAA0000A1Z5", 
    pan: "AAAAA0000A", 
    pfNo: "DL/CPM/123", 
    esicNo: "11000123", 
    units: [
      { id: "u1", name: "Okhla Unit 1", address: "Phase III, Okhla" },
      { id: "u2", name: "Gurgaon Unit 2", address: "Sector 18, Gurgaon" }
    ] 
  }
];

const MOCK_EMPLOYEES: Employee[] = [
  { 
    id: "1", 
    employeeId: "EMP-S0001", 
    name: "Ravi Kumar", 
    fatherName: "Mr. Ramesh Kumar",
    aadhaar: "1234 5678 9012",
    pan: "ABCDE1234F",
    mobile: "9988776655", 
    address: "New Delhi, India",
    department: "Production", 
    designation: "Engineer", 
    joinDate: "2023-01-15",
    firmId: "f1",
    unitId: "u1",
    bankName: "HDFC Bank",
    accountNo: "50100123456789",
    ifscCode: "HDFC0000123",
    isGovComplianceEnabled: true,
    pfNumber: "DL/CPM/123/001",
    esicNumber: "11000123001",
    salary: { 
      basic: 15000, 
      hra: 7500, 
      da: 0, 
      allowance: 7500, 
      grossSalary: 30000,
      employeePF: 1800,
      employeeESIC: 113,
      employerPF: 1950,
      employerESIC: 488,
      netSalary: 28087,
      monthlyCTC: 32438,
      pfRateEmp: 12,
      esicRateEmp: 0.75,
      pfRateEx: 13,
      esicRateEx: 3.25
    },
    salaryHistory: [
      { fromMonth: "Jan-2023", toMonth: "Present", monthlyCTC: 32438 }
    ],
    active: true 
  }
];

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
  const [mmm, yyyy] = formatted.split('-');
  return new Date(Date.parse(`${mmm} 1, ${yyyy}`));
};

const formatToMMM_YYYY = (date: Date) => {
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
  firmId: "f1",
  isGovComplianceEnabled: true,
  salary: INITIAL_SALARY_STRUCTURE,
  salaryHistory: []
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>(MOCK_EMPLOYEES);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [salaryRevision, setSalaryRevision] = useState<Employee | null>(null);
  const [viewHistoryEmployee, setViewHistoryEmployee] = useState<Employee | null>(null);
  const [employeeToToggle, setEmployeeToToggle] = useState<Employee | null>(null);
  const [isToggleConfirmOpen, setIsToggleConfirmOpen] = useState(false);
  
  const [formData, setFormData] = useState<Partial<Employee>>(INITIAL_FORM_DATA);
  const [revisionData, setRevisionData] = useState<SalaryStructure>(INITIAL_SALARY_STRUCTURE);
  const [effectiveMonth, setEffectiveMonth] = useState<string>(MONTH_OPTIONS[1]);

  const filtered = employees.filter(emp => 
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    emp.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.aadhaar.includes(searchTerm)
  );

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
      const s = prev.salary || INITIAL_SALARY_STRUCTURE;
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

  const handleRegistrationPost = () => {
    if (!formData.name || !formData.aadhaar || formData.aadhaar.replace(/\s/g, '').length !== 12) {
      toast({ variant: "destructive", title: "Validation Error", description: "Name and 12-digit Aadhaar are mandatory." });
      return;
    }

    const joinDateObj = new Date(formData.joinDate || Date.now());
    const joinMonthStr = formatToMMM_YYYY(joinDateObj);

    const newEmp: Employee = {
      ...(formData as Employee),
      id: editEmployee ? editEmployee.id : Math.random().toString(36).substr(2, 9),
      employeeId: editEmployee ? editEmployee.employeeId : `EMP-S${(employees.length + 1).toString().padStart(4, '0')}`,
      salaryHistory: editEmployee ? (formData.salaryHistory || []) : [
        { fromMonth: joinMonthStr, toMonth: "Present", monthlyCTC: formData.salary?.monthlyCTC || 0 }
      ],
      active: editEmployee ? (formData.active ?? true) : true
    };

    setEmployees(prev => {
      if (editEmployee) return prev.map(e => e.id === editEmployee.id ? newEmp : e);
      return [...prev, newEmp];
    });

    setIsRegistrationOpen(false);
    setEditEmployee(null);
    setFormData(INITIAL_FORM_DATA);
    toast({ title: editEmployee ? "Profile Updated" : "Employee Registered", description: `${newEmp.name} has been saved.` });
  };

  const handlePostSalaryRevision = () => {
    if (!salaryRevision) return;

    setEmployees(prev => prev.map(emp => {
      if (emp.id !== salaryRevision.id) return emp;

      const history = [...emp.salaryHistory];
      const newEffectiveDate = getMonthFromMMM_YYYY(effectiveMonth);
      
      if (history.length > 0) {
        const lastEntry = history[history.length - 1];
        const prevMonthDate = new Date(newEffectiveDate);
        prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
        lastEntry.toMonth = formatToMMM_YYYY(prevMonthDate);
      }

      history.push({
        fromMonth: effectiveMonth,
        toMonth: "Present",
        monthlyCTC: revisionData.monthlyCTC
      });

      return {
        ...emp,
        salary: revisionData,
        salaryHistory: history
      };
    }));

    setSalaryRevision(null);
    toast({ title: "Salary Revision Posted", description: `Updated for ${salaryRevision.name}` });
  };

  const handleToggleStatus = () => {
    if (!employeeToToggle) return;
    
    setEmployees(prev => prev.map(emp => 
      emp.id === employeeToToggle.id ? { ...emp, active: !emp.active } : emp
    ));
    
    toast({ 
      title: employeeToToggle.active ? "Employee Deactivated" : "Employee Activated",
      description: `${employeeToToggle.name} status updated successfully.`
    });
    
    setIsToggleConfirmOpen(false);
    setEmployeeToToggle(null);
  };

  const increasePct = useMemo(() => {
    if (!salaryRevision || salaryRevision.salary.monthlyCTC === 0) return "0.0";
    const diff = revisionData.monthlyCTC - salaryRevision.salary.monthlyCTC;
    const pct = (diff / salaryRevision.salary.monthlyCTC) * 100;
    return isNaN(pct) ? "0.0" : pct.toFixed(1);
  }, [salaryRevision, revisionData.monthlyCTC]);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Employee Directory</h1>
          <p className="text-muted-foreground">Manage workforce profiles and statutory payroll compliance.</p>
        </div>
        <Button className="font-bold shadow-lg shadow-primary/20" onClick={() => setIsRegistrationOpen(true)}>
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
                <TableHead className="text-right font-bold">Actions</TableHead>
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
                        <span className="font-bold">{emp.name}</span>
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
                      {formatCurrency(emp.salary.monthlyCTC)}
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
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setEditEmployee(emp); setFormData(emp); setIsRegistrationOpen(true); }} title="Edit Profile">
                          <Pencil className="w-4 h-4 text-slate-500" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem onClick={() => { setSalaryRevision(emp); setRevisionData(emp.salary); }}>
                              <TrendingUp className="w-4 h-4 mr-2 text-emerald-600" /> Increase Salary
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setViewHistoryEmployee(emp)}>
                              <History className="w-4 h-4 mr-2" /> View Salary Record
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className={emp.active ? "text-rose-600" : "text-emerald-600"}
                              onClick={() => {
                                setEmployeeToToggle(emp);
                                setIsToggleConfirmOpen(true);
                              }}
                            >
                              {emp.active ? <><XCircle className="w-4 h-4 mr-2" /> Deactivate</> : <><CheckCircle className="w-4 h-4 mr-2" /> Activate</>}
                            </DropdownMenuItem>
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
      <Dialog open={isRegistrationOpen} onOpenChange={(open) => { 
        if (!open) {
          setIsRegistrationOpen(false);
          setEditEmployee(null); 
          setFormData(INITIAL_FORM_DATA); 
        }
      }}>
        <DialogContent className="sm:max-w-5xl h-[90vh] flex flex-col p-0 overflow-hidden">
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
                    <Select value={formData.firmId} onValueChange={(v) => setFormData(prev => ({...prev, firmId: v, unitId: undefined}))}>
                      <SelectTrigger><SelectValue placeholder="Select Firm" /></SelectTrigger>
                      <SelectContent>{MOCK_FIRMS.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Unit / Plant</Label>
                    <Select value={formData.unitId} onValueChange={(v) => setFormData(prev => ({...prev, unitId: v}))}>
                      <SelectTrigger><SelectValue placeholder="Select Unit" /></SelectTrigger>
                      <SelectContent>
                        {MOCK_FIRMS.find(f => f.id === formData.firmId)?.units.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Employee ID</Label>
                    <Input value={editEmployee ? editEmployee.employeeId : `EMP-S${(employees.length + 1).toString().padStart(4, '0')}`} disabled className="bg-slate-100 font-mono font-bold" />
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
                    <Label>PAN Number</Label>
                    <Input placeholder="AAAAA9999A" className="uppercase" value={formData.pan || ''} onChange={(e) => setFormData(prev => ({...prev, pan: e.target.value.toUpperCase()}))} />
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
                        {formData.department && DESIGNATIONS[formData.department].map(des => <SelectItem key={des} value={des}>{des}</SelectItem>)}
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
                          const s = prev.salary || INITIAL_SALARY_STRUCTURE;
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
                        <h5 className="text-xs font-bold text-emerald-800 flex items-center gap-2"><User className="w-3 h-3" /> Employee Contribution</h5>
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
              <Button variant="ghost" className="text-white hover:bg-slate-800" onClick={() => {
                setIsRegistrationOpen(false);
                setEditEmployee(null);
                setFormData(INITIAL_FORM_DATA);
              }}>Cancel</Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700 px-8" onClick={handleRegistrationPost}>Post Employee</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Salary Revision Modal */}
      <Dialog open={!!salaryRevision} onOpenChange={(open) => { if (!open) setSalaryRevision(null); }}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Salary Revision - {salaryRevision?.name}</DialogTitle>
            <DialogDescription>Adjust components and post updates to payroll.</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: "Basic", val: salaryRevision?.salary.basic },
                { label: "HRA", val: salaryRevision?.salary.hra },
                { label: "Allowance", val: salaryRevision?.salary.allowance },
                { label: "Current CTC", val: salaryRevision?.salary.monthlyCTC, highlight: true },
              ].map((item, i) => (
                <div key={i} className={cn(
                  "p-3 rounded-lg border text-center",
                  item.highlight ? "bg-primary/5 border-primary/20" : "bg-slate-50 border-slate-100"
                )}>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">{item.label}</p>
                  <p className={cn("text-sm font-bold", item.highlight && "text-primary")}>{formatCurrency(item.val || 0)}</p>
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
                      setRevisionData(prev => calculateSalaryMetrics(b, Math.round(b * 0.5), prev.allowance, salaryRevision?.isGovComplianceEnabled || false, { pfEmp: prev.pfRateEmp, esicEmp: prev.esicRateEmp, pfEx: prev.pfRateEx, esicEx: prev.esicRateEx }));
                    }} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 items-center">
                    <Label>HRA</Label>
                    <Input type="number" value={revisionData.hra} onChange={(e) => {
                      const h = parseFloat(e.target.value) || 0;
                      setRevisionData(prev => calculateSalaryMetrics(prev.basic, h, prev.allowance, salaryRevision?.isGovComplianceEnabled || false, { pfEmp: prev.pfRateEmp, esicEmp: prev.esicRateEmp, pfEx: prev.pfRateEx, esicEx: prev.esicRateEx }));
                    }} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 items-center">
                    <Label>Other Allowance</Label>
                    <Input type="number" value={revisionData.allowance} onChange={(e) => {
                      const a = parseFloat(e.target.value) || 0;
                      setRevisionData(prev => calculateSalaryMetrics(prev.basic, prev.hra, a, salaryRevision?.isGovComplianceEnabled || false, { pfEmp: prev.pfRateEmp, esicEmp: prev.esicRateEmp, pfEx: prev.pfRateEx, esicEx: prev.esicRateEx }));
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
                      <h3 className="text-3xl font-bold text-emerald-900">{formatCurrency(revisionData.monthlyCTC)}</h3>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Increase %</p>
                      <h3 className="text-3xl font-bold text-emerald-900">
                        {increasePct}%
                      </h3>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Previous CTC</span><span>{formatCurrency(salaryRevision?.salary.monthlyCTC || 0)}</span></div>
                    <div className="flex justify-between font-bold text-emerald-700"><span>Net Increment</span><span>+{formatCurrency(revisionData.monthlyCTC - (salaryRevision?.salary.monthlyCTC || 0))}</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="bg-slate-50 -m-6 mt-2 p-6 rounded-b-lg border-t">
            <Button variant="outline" onClick={() => setSalaryRevision(null)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 px-8" onClick={handlePostSalaryRevision}>Post Update</Button>
          </DialogFooter>
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
                    <p className="font-bold text-slate-700">{viewHistoryEmployee ? formatToMMM_YYYY(new Date(viewHistoryEmployee.joinDate)) : '---'}</p>
                  </div>
                </div>
              </DialogHeader>

              <ScrollArea className="flex-1 p-6">
                <div className="space-y-6">
                  {/* Top Summary Card */}
                  <Card className="border-none bg-slate-900 text-white shadow-lg">
                    <CardContent className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Basic Salary</p>
                        <p className="text-lg font-bold">{formatCurrency(viewHistoryEmployee.salary.basic || 0)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">HRA</p>
                        <p className="text-lg font-bold">{formatCurrency(viewHistoryEmployee.salary.hra || 0)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Other Allowance</p>
                        <p className="text-lg font-bold">{formatCurrency(viewHistoryEmployee.salary.allowance || 0)}</p>
                      </div>
                      <div className="space-y-1 border-l border-slate-700 pl-4">
                        <p className="text-[10px] font-bold text-emerald-400 uppercase">Current Monthly CTC</p>
                        <p className="text-xl font-bold text-emerald-300">{formatCurrency(viewHistoryEmployee.salary.monthlyCTC || 0)}</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* History Table */}
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
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {!viewHistoryEmployee.salaryHistory || viewHistoryEmployee.salaryHistory.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                No history records found.
                              </TableCell>
                            </TableRow>
                          ) : (
                            [...viewHistoryEmployee.salaryHistory].reverse().map((entry, idx) => (
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
                              </TableRow>
                            ))
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
            <AlertDialogCancel className="mt-0">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleToggleStatus}
              className={employeeToToggle?.active ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"}
            >
              Confirm {employeeToToggle?.active ? "Deactivate" : "Activate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
