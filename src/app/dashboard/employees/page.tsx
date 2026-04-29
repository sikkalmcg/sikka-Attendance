"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
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
  Pencil,
  Building2,
  ChevronRight,
  ChevronLeft,
  X,
  Factory,
  IdCard,
  Briefcase,
  Banknote,
  ShieldCheck,
  CreditCard,
  User as UserIcon,
  Phone,
  MapPin,
  Loader2,
  CheckCircle2
} from "lucide-react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, cn, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Employee, SalaryStructure } from "@/lib/types";
import { DEPARTMENTS, DESIGNATIONS, STATUTORY_RATES } from "@/lib/constants";
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
  pfRateEmp: STATUTORY_RATES.PF_EMPLOYEE_RATE,
  esicRateEmp: STATUTORY_RATES.ESIC_EMPLOYEE_RATE,
  pfRateEx: STATUTORY_RATES.PF_EMPLOYER_RATE,
  esicRateEx: STATUTORY_RATES.ESIC_EMPLOYER_RATE
};

const INITIAL_FORM_DATA: Partial<Employee> = {
  firstName: "",
  lastName: "",
  fatherName: "",
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
  pfNumber: "",
  esicNumber: "",
  isGovComplianceEnabled: true,
  salary: { ...INITIAL_SALARY_STRUCTURE },
  salaryHistory: [],
  unitIds: [],
  active: true
};

export default function EmployeesPage() {
  const { employees, firms, plants, addRecord, updateRecord, verifiedUser } = useData();
  const [isMounted, setIsMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedPlantFilter, setSelectedPlantFilter] = useState("all");
  const { toast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState<Partial<Employee>>({ ...INITIAL_FORM_DATA });
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlantPopoverOpen, setIsPlantPopoverOpen] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const generateAutoId = useCallback(() => {
    if (!employees || employees.length === 0) return "EMP-S0001";
    
    const numericIds = employees
      .map(e => {
        const id = e.employeeId || "";
        const match = id.match(/\d+/);
        return match ? parseInt(match[0]) : 0;
      })
      .filter(n => !isNaN(n) && n > 0);
      
    const nextVal = numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1;
    return `EMP-S${nextVal.toString().padStart(4, "0")}`;
  }, [employees]);

  const userAssignedPlantIds = useMemo(() => {
    if (!verifiedUser || verifiedUser.role === 'SUPER_ADMIN') return null;
    return verifiedUser.plantIds || [];
  }, [verifiedUser]);

  const authorizedPlants = useMemo(() => {
    if (!userAssignedPlantIds) return plants;
    return plants.filter(p => userAssignedPlantIds.includes(p.id));
  }, [userAssignedPlantIds, plants]);

  const filtered = useMemo(() => {
    let sorted = [...(employees || [])];
    
    if (userAssignedPlantIds) {
      sorted = sorted.filter(emp => 
        (emp.unitIds || []).some(id => userAssignedPlantIds.includes(id)) || 
        userAssignedPlantIds.includes(emp.unitId)
      );
    }

    if (selectedPlantFilter !== "all") {
      sorted = sorted.filter(emp => (emp.unitIds || []).includes(selectedPlantFilter));
    }

    sorted.sort((a, b) => {
      const nameA = (a.name || `${a.firstName} ${a.lastName}`).toLowerCase().trim();
      const nameB = (b.name || `${b.firstName} ${b.lastName}`).toLowerCase().trim();
      return nameA.localeCompare(nameB);
    });

    const search = searchTerm.toLowerCase();
    return sorted.filter(emp => {
      const fullName = (emp.name || `${emp.firstName} ${emp.lastName}`).toLowerCase();
      return fullName.includes(search) || 
             emp.employeeId?.toLowerCase().includes(search) || 
             emp.aadhaar?.includes(search) ||
             emp.pan?.toLowerCase().includes(search);
    });
  }, [employees, searchTerm, userAssignedPlantIds, selectedPlantFilter]);

  const paginatedEmployees = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);

  const calculateFullSalary = (s: SalaryStructure, isComplianceEnabled: boolean) => {
    const gross = (Number(s.basic) || 0) + (Number(s.hra) || 0) + (Number(s.da) || 0) + (Number(s.allowance) || 0);
    
    // PF & ESIC Calculations - Set to 0 if Not Applicable
    const epf = isComplianceEnabled ? Math.round(Number(s.basic) * (Number(s.pfRateEmp) / 100)) : 0;
    const erpf = isComplianceEnabled ? Math.round(Number(s.basic) * (Number(s.pfRateEx) / 100)) : 0;
    const eesic = isComplianceEnabled ? Math.round(gross * (Number(s.esicRateEmp) / 100)) : 0;
    const eresic = isComplianceEnabled ? Math.round(gross * (Number(s.esicRateEx) / 100)) : 0;
    
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
      return { ...prev, salary: calculateFullSalary(updatedSalary, !!prev.isGovComplianceEnabled) };
    });
  };

  const toggleComplianceStatus = (enabled: boolean) => {
    setFormData(prev => {
      const updatedSalary = calculateFullSalary(prev.salary as SalaryStructure, enabled);
      return { ...prev, isGovComplianceEnabled: enabled, salary: updatedSalary };
    });
  };

  const togglePlantSelection = (plantId: string) => {
    setFormData(prev => {
      const current = prev.unitIds || [];
      const updated = current.includes(plantId) 
        ? current.filter(id => id !== plantId) 
        : [...current, plantId];
      return { ...prev, unitIds: updated };
    });
  };

  const handlePost = async () => {
    if (isProcessing) return;

    const { firstName, employeeId, aadhaar, department, salary, pan, accountNo, ifscCode, unitIds } = formData;
    
    if (!employeeId || !firstName || !aadhaar || !department || !salary?.basic || (unitIds?.length || 0) === 0) {
      toast({ variant: "destructive", title: "Mandatory Fields Missing", description: "Identity (ID, Name, Aadhaar), Profession (Plant, Dept) and Basic Salary are required." });
      return;
    }

    if (!/^\d{12}$/.test(aadhaar)) {
      toast({ variant: "destructive", title: "Invalid Aadhaar", description: "Aadhaar must be exactly 12 numeric digits." });
      return;
    }

    if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan.toUpperCase())) {
      toast({ variant: "destructive", title: "Invalid PAN", description: "PAN format must be ABCDE1234F." });
      return;
    }

    if (accountNo && !/^\d+$/.test(accountNo)) {
      toast({ variant: "destructive", title: "Invalid Account", description: "Bank Account Number must be numeric only." });
      return;
    }

    if (ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode.toUpperCase())) {
      toast({ variant: "destructive", title: "Invalid IFSC", description: "IFSC must follow bank format (e.g. HDFC0001234)." });
      return;
    }

    const duplicateAadhaar = employees.find(e => e.aadhaar === aadhaar && e.id !== editEmployee?.id);
    if (duplicateAadhaar) {
      toast({ variant: "destructive", title: "Duplicate Aadhaar", description: "An employee with this Aadhaar number already exists." });
      return;
    }

    if (pan) {
      const duplicatePan = employees.find(e => e.pan?.toLowerCase() === pan.toLowerCase() && e.id !== editEmployee?.id);
      if (duplicatePan) {
        toast({ variant: "destructive", title: "Duplicate PAN", description: "An employee with this PAN number already exists." });
        return;
      }
    }

    setIsProcessing(true);
    try {
      const finalData = { 
        ...formData, 
        name: `${formData.firstName || ""} ${formData.lastName || ""}`.trim(),
        pan: formData.pan?.toUpperCase(),
        ifscCode: formData.ifscCode?.toUpperCase()
      };
      
      if (editEmployee) {
        updateRecord('employees', editEmployee.id, finalData);
      } else {
        addRecord('employees', finalData);
      }
      
      setIsModalOpen(false);
      setEditEmployee(null);
      setFormData({ ...INITIAL_FORM_DATA });
      toast({ title: editEmployee ? "Profile Updated" : "Employee Registered" });
    } finally { setIsProcessing(false); }
  };

  const openNewEmployeeModal = () => {
    const newId = generateAutoId();
    setEditEmployee(null);
    setFormData({ ...INITIAL_FORM_DATA, employeeId: newId, firmId: firms[0]?.id });
    setIsModalOpen(true);
  };

  const openEditModal = (emp: Employee) => {
    setEditEmployee(emp);
    setFormData({ ...emp });
    setIsModalOpen(true);
  };

  if (!isMounted) return null;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Workforce Directory</h1>
          <p className="text-muted-foreground text-sm font-medium uppercase tracking-widest mt-1">Managed Staff Registry</p>
        </div>
        <Button className="bg-primary font-black shadow-xl shadow-primary/20 h-12 px-8 rounded-xl" onClick={openNewEmployeeModal}>
          <UserPlus className="w-5 h-5 mr-2" /> Register New Staff
        </Button>
      </div>

      <Card className="border-slate-200 overflow-hidden shadow-xl rounded-2xl">
        <CardHeader className="bg-slate-50 border-b flex flex-col md:flex-row items-center gap-4 p-4">
          <div className="relative flex-1 w-full md:w-auto">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400"/>
            <Input placeholder="Search name, ID, Aadhaar or PAN..." className="pl-10 h-11 bg-white rounded-xl" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <Factory className="w-4 h-4 text-slate-400" />
            <Select value={selectedPlantFilter} onValueChange={setSelectedPlantFilter}>
              <SelectTrigger className="w-full md:w-64 h-11 font-black text-[10px] uppercase bg-white rounded-xl">
                <SelectValue placeholder="All Plants" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs font-bold uppercase">All Authorized Plants</SelectItem>
                {authorizedPlants.map(p => (
                  <SelectItem key={p.id} value={p.id} className="text-xs font-bold uppercase">{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="w-full">
            <Table className="min-w-[1200px]">
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="font-black px-6 py-5 text-[11px] uppercase tracking-widest text-slate-500">Name / ID</TableHead>
                  <TableHead className="font-black text-[11px] uppercase tracking-widest text-slate-500">Facility Allocation</TableHead>
                  <TableHead className="font-black text-[11px] uppercase tracking-widest text-slate-500">Identity (Aadhaar/PAN)</TableHead>
                  <TableHead className="font-black text-[11px] uppercase tracking-widest text-slate-500">Dept / Desig</TableHead>
                  <TableHead className="font-black text-right text-[11px] uppercase tracking-widest text-slate-500">Net Take-Home</TableHead>
                  <TableHead className="text-right pr-6 font-black text-[11px] uppercase tracking-widest text-slate-500">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedEmployees.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-24 text-muted-foreground font-bold italic">No records found matching criteria.</TableCell></TableRow>
                ) : (
                  paginatedEmployees.map(emp => (
                    <TableRow key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className="font-black text-slate-900 uppercase text-sm">{emp.name}</span>
                          <span className="text-[10px] text-primary font-mono font-black uppercase tracking-tight">{emp.employeeId}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5 max-w-[250px]">
                          {(emp.unitIds || []).length === 0 ? (
                            <span className="text-[10px] text-slate-400 font-bold italic">Unassigned</span>
                          ) : (
                            (emp.unitIds || []).map(id => {
                              const plantName = plants.find(p => p.id === id)?.name;
                              return plantName ? (
                                <Badge key={id} variant="outline" className="text-[9px] font-black uppercase border-primary/20 text-primary bg-primary/5 px-2 py-0.5">
                                  {plantName}
                                </Badge>
                              ) : null;
                            })
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs font-mono font-bold text-slate-700">{emp.aadhaar}</span>
                          <span className="text-[10px] font-mono font-medium text-muted-foreground uppercase">{emp.pan || "PAN_NOT_GIVEN"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-700 uppercase tracking-tight">{emp.department}</span>
                          <span className="text-[10px] text-muted-foreground uppercase font-medium">{emp.designation}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-black text-emerald-600 text-sm">{formatCurrency(emp.salary?.netSalary || 0)}</span>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-9 w-9 text-slate-400 hover:text-primary transition-all hover:bg-white hover:shadow-sm"
                          onClick={() => openEditModal(emp)}
                        >
                          <Pencil className="w-4 h-4"/>
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
        <CardFooter className="bg-slate-50 border-t flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="font-bold h-9">
              <ChevronLeft className="w-4 h-4 mr-1" /> Previous
            </Button>
            <Button variant="outline" size="sm" disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(p => p + 1)} className="font-bold h-9">
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Page {currentPage} of {totalPages || 1}</span>
        </CardFooter>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-5xl h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
          <DialogHeader className="p-8 bg-slate-900 text-white shrink-0">
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center">
                  <UserIcon className="w-7 h-7 text-primary" />
               </div>
               <div>
                 <DialogTitle className="text-2xl font-black uppercase tracking-tight">{editEmployee ? 'Update Staff Profile' : 'New Staff Registration'}</DialogTitle>
                 <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mt-1">Organizational Identity & Payroll Mapping</p>
               </div>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 bg-slate-50/50">
            <div className="p-10 space-y-12 pb-24">
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-2">
                  <IdCard className="w-5 h-5 text-primary" />
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">1. Personnel Identity</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">Employee ID *</Label>
                    <Input value={formData.employeeId} disabled className="h-12 font-black bg-slate-100 border-slate-200" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">First Name *</Label>
                    <Input value={formData.firstName} onChange={e => setFormData(p => ({...p, firstName: e.target.value}))} className="h-12 font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">Last Name</Label>
                    <Input value={formData.lastName} onChange={e => setFormData(p => ({...p, lastName: e.target.value}))} className="h-12 font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">Father's Name</Label>
                    <Input value={formData.fatherName} onChange={e => setFormData(p => ({...p, fatherName: e.target.value}))} className="h-12 font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">Aadhaar Number * (12 Digits)</Label>
                    <Input value={formData.aadhaar} onChange={e => setFormData(p => ({...p, aadhaar: e.target.value.replace(/\D/g, '')}))} maxLength={12} className="h-12 font-mono font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">PAN Number (ABCDE1234F)</Label>
                    <Input value={formData.pan} onChange={e => setFormData(p => ({...p, pan: e.target.value.toUpperCase()}))} maxLength={10} className="h-12 font-mono font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">Mobile No</Label>
                    <Input value={formData.mobile} onChange={e => setFormData(p => ({...p, mobile: e.target.value.replace(/\D/g, '')}))} maxLength={10} className="h-12 font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">Join Date</Label>
                    <Input type="date" value={formData.joinDate} onChange={e => setFormData(p => ({...p, joinDate: e.target.value}))} className="h-12 font-bold" />
                  </div>
                  <div className="space-y-2 md:col-span-2 lg:col-span-4">
                    <Label className="text-[10px] font-black uppercase text-slate-500">Residential Address</Label>
                    <Input value={formData.address} onChange={e => setFormData(p => ({...p, address: e.target.value}))} className="h-12 font-bold" />
                  </div>
                </div>
              </div>

              <div className="space-y-6 pt-6 border-t border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <Briefcase className="w-5 h-5 text-primary" />
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">2. Professional Assignment</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">Employer Firm *</Label>
                    <Select value={formData.firmId} onValueChange={v => setFormData(p => ({...p, firmId: v, unitIds: []}))}>
                      <SelectTrigger className="h-12 font-bold"><SelectValue placeholder="Select Firm" /></SelectTrigger>
                      <SelectContent>{firms.map(f => <SelectItem key={f.id} value={f.id} className="font-bold">{f.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">Assigned Plant(s) *</Label>
                    <Popover open={isPlantPopoverOpen} onOpenChange={setIsPlantPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="h-12 w-full justify-between font-bold rounded-lg border-slate-200">
                          {(formData.unitIds?.length || 0) > 0 ? `${formData.unitIds?.length} Plants Selected` : "Select Facility Access"}
                          <ChevronRight className="w-4 h-4 ml-2 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[320px] p-2 rounded-2xl shadow-2xl" align="start">
                        <ScrollArea className="h-[250px] pr-2">
                          <div className="space-y-1">
                            {plants.filter(p => p.firmId === formData.firmId).map(p => {
                              const isChecked = formData.unitIds?.includes(p.id);
                              return (
                                <div 
                                  key={p.id} 
                                  className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors" 
                                  onClick={(e) => {
                                    e.preventDefault();
                                    togglePlantSelection(p.id);
                                  }}
                                >
                                  <Checkbox 
                                    checked={isChecked} 
                                    onCheckedChange={() => {}} // Controlled by row click
                                    className="rounded-md pointer-events-none" 
                                  />
                                  <div className="flex-1">
                                    <p className="text-sm font-black text-slate-900">{p.name}</p>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">Infrastructure Node</p>
                                  </div>
                                </div>
                              );
                            })}
                            {plants.filter(p => p.firmId === formData.firmId).length === 0 && (
                              <p className="p-4 text-center text-xs font-bold text-slate-400 italic">No plants found for selected firm.</p>
                            )}
                          </div>
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">Department *</Label>
                    <Select value={formData.department} onValueChange={v => setFormData(p => ({...p, department: v, designation: ""}))}>
                      <SelectTrigger className="h-12 font-bold"><SelectValue placeholder="Choose Department" /></SelectTrigger>
                      <SelectContent>{DEPARTMENTS.map(d => <SelectItem key={d} value={d} className="font-bold">{d}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">Designation</Label>
                    <Select value={formData.designation} onValueChange={v => setFormData(p => ({...p, designation: v}))} disabled={!formData.department}>
                      <SelectTrigger className="h-12 font-bold"><SelectValue placeholder="Choose Designation" /></SelectTrigger>
                      <SelectContent>{(DESIGNATIONS[formData.department!] || []).map(d => <SelectItem key={d} value={d} className="font-bold">{d}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="space-y-6 pt-6 border-t border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <Banknote className="w-5 h-5 text-primary" />
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">3. Disbursement Credentials</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">Bank Name</Label>
                    <Input value={formData.bankName} onChange={e => setFormData(p => ({...p, bankName: e.target.value}))} placeholder="e.g. HDFC Bank" className="h-12 font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">Account Number (Numeric Only)</Label>
                    <Input value={formData.accountNo} onChange={e => setFormData(p => ({...p, accountNo: e.target.value.replace(/\D/g, '')}))} className="h-12 font-mono font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">IFSC Code (e.g. HDFC0001234)</Label>
                    <Input value={formData.ifscCode} onChange={e => setFormData(p => ({...p, ifscCode: e.target.value.toUpperCase()}))} maxLength={11} className="h-12 font-mono font-bold" />
                  </div>
                </div>
              </div>

              <div className="space-y-6 pt-6 border-t border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard className="w-5 h-5 text-primary" />
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">4. Monthly Salary Structure</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">Basic Salary *</Label>
                    <Input type="number" value={formData.salary?.basic} onChange={e => updateFormSalary('basic', e.target.value)} className="h-12 font-black text-lg bg-emerald-50/30 border-emerald-100" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">HRA</Label>
                    <Input type="number" value={formData.salary?.hra} onChange={e => updateFormSalary('hra', e.target.value)} className="h-12 font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">DA</Label>
                    <Input type="number" value={formData.salary?.da} onChange={e => updateFormSalary('da', e.target.value)} className="h-12 font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">Other Allowance</Label>
                    <Input type="number" value={formData.salary?.allowance} onChange={e => updateFormSalary('allowance', e.target.value)} className="h-12 font-bold" />
                  </div>
                </div>
                
                <div className="p-8 bg-slate-900 rounded-[2rem] text-white flex flex-col md:flex-row justify-between items-center gap-8 shadow-2xl">
                   <div className="text-center md:text-left">
                     <p className="text-[10px] font-black uppercase text-primary tracking-[0.2em] mb-1">Estimated Monthly CTC</p>
                     <p className="text-4xl font-black text-white">{formatCurrency(formData.salary?.monthlyCTC || 0)}</p>
                   </div>
                   <Separator orientation="vertical" className="h-12 bg-white/10 hidden md:block" />
                   <div className="text-center md:text-left">
                     <p className="text-[10px] font-black uppercase text-emerald-400 tracking-[0.2em] mb-1">Net Take-Home (Payable)</p>
                     <p className="text-4xl font-black text-emerald-400">{formatCurrency(formData.salary?.netSalary || 0)}</p>
                   </div>
                   <div className="px-8 py-3 bg-white/5 rounded-2xl border border-white/10 text-center">
                      <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Gross Salary</p>
                      <p className="text-xl font-bold">{formatCurrency(formData.salary?.grossSalary || 0)}</p>
                   </div>
                </div>
              </div>

              <div className="space-y-6 pt-6 border-t border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-primary" />
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">5. Statutory Compliance (PF/ESIC)</h3>
                  </div>
                  <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className={cn(
                        "h-9 px-6 text-[10px] font-black uppercase rounded-lg transition-all",
                        formData.isGovComplianceEnabled ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                      )}
                      onClick={() => toggleComplianceStatus(true)}
                    >
                      <CheckCircle2 className={cn("w-3.5 h-3.5 mr-2", formData.isGovComplianceEnabled ? "text-emerald-500" : "text-slate-300")} />
                      Applicable
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className={cn(
                        "h-9 px-6 text-[10px] font-black uppercase rounded-lg transition-all",
                        !formData.isGovComplianceEnabled ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                      )}
                      onClick={() => toggleComplianceStatus(false)}
                    >
                      <X className={cn("w-3.5 h-3.5 mr-2", !formData.isGovComplianceEnabled ? "text-rose-500" : "text-slate-300")} />
                      Not Applicable
                    </Button>
                  </div>
                </div>

                <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 transition-opacity", !formData.isGovComplianceEnabled && "opacity-50 pointer-events-none")}>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">PF Number</Label>
                    <Input value={formData.pfNumber} onChange={e => setFormData(p => ({...p, pfNumber: e.target.value}))} className="h-12 font-mono" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">ESIC Number</Label>
                    <Input value={formData.esicNumber} onChange={e => setFormData(p => ({...p, esicNumber: e.target.value}))} className="h-12 font-mono" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">Emp PF %</Label>
                    <Input type="number" step="0.01" value={formData.salary?.pfRateEmp} onChange={e => updateFormSalary('pfRateEmp', e.target.value)} className="h-12 font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">EPF Amount (Auto)</Label>
                    <Input value={formatCurrency(formData.salary?.employeePF || 0)} disabled className="h-12 font-black bg-slate-50 text-slate-400" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">Ex PF %</Label>
                    <Input type="number" step="0.01" value={formData.salary?.pfRateEx} onChange={e => updateFormSalary('pfRateEx', e.target.value)} className="h-12 font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">Ex PF Amount (Auto)</Label>
                    <Input value={formatCurrency(formData.salary?.employerPF || 0)} disabled className="h-12 font-black bg-slate-50 text-slate-400" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">Emp ESIC %</Label>
                    <Input type="number" step="0.01" value={formData.salary?.esicRateEmp} onChange={e => updateFormSalary('esicRateEmp', e.target.value)} className="h-12 font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500">Ex ESIC %</Label>
                    <Input type="number" step="0.01" value={formData.salary?.esicRateEx} onChange={e => updateFormSalary('esicRateEx', e.target.value)} className="h-12 font-bold" />
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="p-6 bg-white border-t shrink-0 flex items-center justify-between gap-4">
             <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="px-8 h-12 rounded-xl font-bold">Cancel</Button>
             <Button className="px-12 h-12 font-black bg-slate-900 text-white hover:bg-primary transition-all rounded-xl shadow-xl shadow-slate-200" onClick={handlePost} disabled={isProcessing}>
               {isProcessing ? (
                 <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Processing...</>
               ) : (
                 editEmployee ? "Update Profile" : "Register Employee"
               )}
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
