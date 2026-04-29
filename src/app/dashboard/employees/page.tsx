
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
  Factory,
  ChevronDown,
  Check
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
  const { employees, firms, plants, addRecord, updateRecord, verifiedUser } = useData();
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
  const [isPlantPopoverOpen, setIsPlantPopoverOpen] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const userAssignedPlantIds = useMemo(() => {
    if (!verifiedUser || verifiedUser.role === 'SUPER_ADMIN') return null;
    return verifiedUser.plantIds || [];
  }, [verifiedUser]);

  const filtered = useMemo(() => {
    let sorted = [...(employees || [])];
    
    // SECURITY: Filter employee list based on assigned plants for managers
    if (userAssignedPlantIds) {
      sorted = sorted.filter(emp => 
        (emp.unitIds || []).some(id => userAssignedPlantIds.includes(id)) || 
        userAssignedPlantIds.includes(emp.unitId)
      );
    }

    sorted.sort((a, b) => {
      const nameA = (a.name || `${a.firstName} ${a.lastName}`).toLowerCase().trim();
      const nameB = (b.name || `${b.firstName} ${b.lastName}`).toLowerCase().trim();
      return nameA.localeCompare(nameB);
    });

    const search = searchTerm.toLowerCase();
    return sorted.filter(emp => {
      const fullName = (emp.name || `${emp.firstName} ${emp.lastName}`).toLowerCase();
      return fullName.includes(search) || emp.employeeId?.toLowerCase().includes(search) || emp.aadhaar?.includes(search);
    });
  }, [employees, searchTerm, userAssignedPlantIds]);

  const paginatedEmployees = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);

  const calculateFullSalary = (s: SalaryStructure, compliance: boolean) => {
    const gross = (Number(s.basic) || 0) + (Number(s.hra) || 0) + (Number(s.da) || 0) + (Number(s.allowance) || 0);
    let epf = 0, eesic = 0, erpf = 0, eresic = 0;
    if (compliance) {
      epf = Math.round(Number(s.basic) * (Number(s.pfRateEmp) / 100));
      erpf = Math.round(Number(s.basic) * (Number(s.pfRateEx) / 100));
      eesic = Math.round(gross * (Number(s.esicRateEmp) / 100));
      eresic = Math.round(gross * (Number(s.esicRateEx) / 100));
    }
    return { ...s, grossSalary: gross, employeePF: epf, employeeESIC: eesic, employerPF: erpf, employerESIC: eresic, netSalary: gross - epf - eesic, monthlyCTC: gross + erpf + eresic };
  };

  const updateFormSalary = (field: string, val: any) => {
    setFormData(prev => {
      const updatedSalary = { ...prev.salary, [field]: val } as SalaryStructure;
      return { ...prev, salary: calculateFullSalary(updatedSalary, prev.isGovComplianceEnabled || false) };
    });
  };

  const togglePlantSelection = (plantId: string) => {
    setFormData(prev => {
      const current = prev.unitIds || [];
      const updated = current.includes(plantId) ? current.filter(id => id !== plantId) : [...current, plantId];
      return { ...prev, unitIds: updated };
    });
  };

  const handlePost = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const finalData = { ...formData, name: `${formData.firstName || ""} ${formData.lastName || ""}`.trim() };
      if (editEmployee) {
        updateRecord('employees', editEmployee.id, finalData);
      } else {
        addRecord('employees', finalData);
      }
      setView('list');
      setEditEmployee(null);
      setFormData({ ...INITIAL_FORM_DATA });
      toast({ title: editEmployee ? "Profile Updated" : "Employee Registered" });
    } finally { setIsProcessing(false); }
  };

  if (!isMounted) return null;

  if (view === 'form') {
    const availablePlants = plants.filter(p => p.firmId === formData.firmId);
    const selectedPlantNames = (formData.unitIds || []).map(id => plants.find(p => p.id === id)?.name).filter(Boolean);

    return (
      <div className="space-y-8 pb-32">
        <Card className="rounded-3xl shadow-xl overflow-hidden border-none">
          <CardHeader className="bg-slate-900 text-white p-8">
            <CardTitle>{editEmployee ? 'Edit Profile' : 'New Staff Registration'}</CardTitle>
          </CardHeader>
          <CardContent className="p-10 space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="space-y-2"><Label>Employee ID *</Label><Input value={formData.employeeId} onChange={e => setFormData(p => ({...p, employeeId: e.target.value}))} className="h-12 font-bold" /></div>
              <div className="space-y-2"><Label>First Name *</Label><Input value={formData.firstName} onChange={e => setFormData(p => ({...p, firstName: e.target.value}))} className="h-12 font-bold" /></div>
              <div className="space-y-2"><Label>Aadhaar *</Label><Input value={formData.aadhaar} onChange={e => setFormData(p => ({...p, aadhaar: e.target.value}))} maxLength={12} className="h-12 font-mono" /></div>
              <div className="space-y-2"><Label>Firm *</Label><Select value={formData.firmId} onValueChange={v => setFormData(p => ({...p, firmId: v, unitIds: []}))}><SelectTrigger className="h-12"><SelectValue placeholder="Select Firm" /></SelectTrigger><SelectContent>{firms.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="space-y-2">
              <Label>Assigned Plants * (Multi-Select)</Label>
              <Popover open={isPlantPopoverOpen} onOpenChange={setIsPlantPopoverOpen}>
                <PopoverTrigger asChild><Button variant="outline" className="h-12 w-full justify-between font-bold">{selectedPlantNames.length > 0 ? `${selectedPlantNames.length} Plants Selected` : "Select Plant(s)"}</Button></PopoverTrigger>
                <PopoverContent className="w-[300px] p-2 rounded-xl" align="start"><ScrollArea className="h-[200px]">{availablePlants.map(p => (
                  <div key={p.id} className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-lg cursor-pointer" onClick={() => togglePlantSelection(p.id)}>
                    <Checkbox checked={formData.unitIds?.includes(p.id)} /> <span className="text-sm font-bold">{p.name}</span>
                  </div>
                ))}</ScrollArea></PopoverContent>
              </Popover>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 pt-8 border-t">
               <div className="space-y-2"><Label>Basic Salary</Label><Input type="number" value={formData.salary?.basic} onChange={e => updateFormSalary('basic', e.target.value)} className="h-12" /></div>
               <div className="space-y-2"><Label>HRA</Label><Input type="number" value={formData.salary?.hra} onChange={e => updateFormSalary('hra', e.target.value)} className="h-12" /></div>
            </div>
          </CardContent>
          <CardFooter className="p-8 bg-slate-50 border-t flex justify-end gap-4">
             <Button variant="ghost" onClick={() => setView('list')}>Cancel</Button>
             <Button className="px-12 h-12 font-black" onClick={handlePost} disabled={isProcessing}>{isProcessing ? "Saving..." : "Register Employee"}</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Employee Registry</h1>
        <Button className="bg-primary" onClick={() => { setFormData({ ...INITIAL_FORM_DATA }); setView('form'); }}>Add Staff</Button>
      </div>

      <Card className="border-slate-200 overflow-hidden">
        <CardHeader className="bg-slate-50/50"><div className="relative max-w-md"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><Input placeholder="Search name or ID..." className="pl-10 h-10" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div></CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="w-full">
            <Table className="min-w-[1200px]">
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-bold px-6">Name / ID</TableHead>
                  <TableHead className="font-bold">Assigned Plants</TableHead>
                  <TableHead className="font-bold">Aadhaar</TableHead>
                  <TableHead className="font-bold">Dept/Desig</TableHead>
                  <TableHead className="font-bold text-right">Net Payable</TableHead>
                  <TableHead className="text-right pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedEmployees.map(emp => (
                  <TableRow key={emp.id} className="hover:bg-slate-50/50">
                    <TableCell className="px-6 font-bold">{emp.name}<p className="text-[10px] text-primary font-mono">{emp.employeeId}</p></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(emp.unitIds || []).slice(0, 1).map(id => <Badge key={id} variant="outline" className="text-[9px]">{plants.find(p => p.id === id)?.name || '---'}</Badge>)}
                        {(emp.unitIds?.length || 0) > 1 && <Badge variant="secondary" className="text-[9px]">+{emp.unitIds!.length - 1} more</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-mono">{emp.aadhaar}</TableCell>
                    <TableCell className="text-xs">{emp.department}<p className="text-[10px] text-muted-foreground uppercase">{emp.designation}</p></TableCell>
                    <TableCell className="text-right font-black text-emerald-600">{formatCurrency(emp.salary?.netSalary || 0)}</TableCell>
                    <TableCell className="text-right pr-6"><Button variant="ghost" size="icon" onClick={() => { setEditEmployee(emp); setFormData(emp); setView('form'); }}><Pencil className="w-4 h-4"/></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardContent>
        <StandardPaginationFooter current={currentPage} total={totalPages} onPageChange={setCurrentPage} />
      </Card>
    </div>
  );
}

function StandardPaginationFooter({ current, total, onPageChange }: any) {
  return (
    <CardFooter className="bg-slate-50 border-t flex items-center justify-between p-4">
      <Button variant="outline" size="sm" disabled={current === 1} onClick={() => onPageChange(current - 1)}>Prev</Button>
      <span className="text-xs font-bold text-slate-500">Page {current} of {total || 1}</span>
      <Button variant="outline" size="sm" disabled={current === total || total === 0} onClick={() => onPageChange(current + 1)}>Next</Button>
    </CardFooter>
  );
}
