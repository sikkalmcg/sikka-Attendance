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
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { 
  Search, 
  MoreHorizontal, 
  UserPlus, 
  TrendingUp, 
  Pencil,
  Eye,
  CheckCircle,
  XCircle
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator 
} from "@/components/ui/dropdown-menu";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Employee, SalaryStructure } from "@/lib/types";

const MOCK_EMPLOYEES: Employee[] = [
  { 
    id: "1", 
    employeeId: "S10001", 
    name: "Ravi Kumar", 
    aadhaar: "1234 5678 9012",
    department: "Production", 
    designation: "Engineer", 
    mobile: "9988776655", 
    pan: "ABCDE1234F",
    joinDate: "2023-01-15",
    plantId: "plant-1",
    salary: { basic: 15000, hra: 7500, da: 5000, allowance: 7500, monthlyCTC: 35000 },
    active: true 
  },
  { 
    id: "2", 
    employeeId: "S10002", 
    name: "Anita Singh", 
    aadhaar: "4321 8765 0987",
    department: "HR", 
    designation: "Manager", 
    mobile: "8877665544", 
    pan: "FGHIJ5678K",
    joinDate: "2022-05-20",
    plantId: "plant-1",
    salary: { basic: 25000, hra: 12500, da: 10000, allowance: 7500, monthlyCTC: 55000 },
    active: true 
  },
];

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>(MOCK_EMPLOYEES);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  // Modal States
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [salaryRevision, setSalaryRevision] = useState<Employee | null>(null);
  const [revisionData, setRevisionData] = useState<SalaryStructure>({ basic: 0, hra: 0, da: 0, allowance: 0, monthlyCTC: 0 });

  const filtered = employees.filter(emp => 
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    emp.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.aadhaar.includes(searchTerm)
  );

  const handleEditClick = (emp: Employee) => setEditEmployee(emp);
  
  const handleIncreaseSalary = (emp: Employee) => {
    setSalaryRevision(emp);
    setRevisionData(emp.salary);
  };

  const calculateRevision = (field: keyof SalaryStructure, value: string) => {
    const val = parseFloat(value) || 0;
    const newData = { ...revisionData, [field]: val };
    newData.monthlyCTC = newData.basic + newData.hra + newData.da + newData.allowance;
    setRevisionData(newData);
  };

  const postSalaryUpdate = () => {
    if (!salaryRevision) return;
    setEmployees(prev => prev.map(e => e.id === salaryRevision.id ? { ...e, salary: revisionData } : e));
    setSalaryRevision(null);
    toast({ title: "Salary Updated", description: "The new salary structure has been posted to payroll." });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Employee Directory</h1>
          <p className="text-muted-foreground">Manage workforce, salary revisions, and profiles.</p>
        </div>
        <Button className="font-bold shadow-lg shadow-primary/20">
          <UserPlus className="w-4 h-4 mr-2" />
          Add Employee
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
                <TableHead className="text-right font-bold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((emp) => (
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
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEditClick(emp)}>
                        <Pencil className="w-4 h-4 text-slate-500" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem onClick={() => handleIncreaseSalary(emp)}>
                            <TrendingUp className="w-4 h-4 mr-2 text-emerald-600" /> Increase Salary
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Eye className="w-4 h-4 mr-2" /> View Salary Record
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className={emp.active ? "text-rose-600" : "text-emerald-600"}>
                            {emp.active ? <><XCircle className="w-4 h-4 mr-2" /> Deactivate</> : <><CheckCircle className="w-4 h-4 mr-2" /> Activate</>}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Salary Increase Modal */}
      <Dialog open={!!salaryRevision} onOpenChange={() => setSalaryRevision(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Salary Revision - {salaryRevision?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-6 py-4">
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase text-muted-foreground">Current Structure</h4>
              <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="flex justify-between text-sm"><span>Basic</span> <span>{formatCurrency(salaryRevision?.salary.basic || 0)}</span></div>
                <div className="flex justify-between text-sm"><span>HRA</span> <span>{formatCurrency(salaryRevision?.salary.hra || 0)}</span></div>
                <div className="flex justify-between text-sm"><span>DA</span> <span>{formatCurrency(salaryRevision?.salary.da || 0)}</span></div>
                <div className="flex justify-between text-sm"><span>Allowances</span> <span>{formatCurrency(salaryRevision?.salary.allowance || 0)}</span></div>
                <div className="pt-2 mt-2 border-t font-bold flex justify-between"><span>Total CTC</span> <span>{formatCurrency(salaryRevision?.salary.monthlyCTC || 0)}</span></div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase text-muted-foreground">Revised Structure</h4>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 items-center">
                  <Label>Basic</Label>
                  <Input type="number" value={revisionData.basic} onChange={(e) => calculateRevision('basic', e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-2 items-center">
                  <Label>HRA</Label>
                  <Input type="number" value={revisionData.hra} onChange={(e) => calculateRevision('hra', e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-2 items-center">
                  <Label>DA</Label>
                  <Input type="number" value={revisionData.da} onChange={(e) => calculateRevision('da', e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-2 items-center">
                  <Label>Allowances</Label>
                  <Input type="number" value={revisionData.allowance} onChange={(e) => calculateRevision('allowance', e.target.value)} />
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-emerald-700 uppercase">New Monthly CTC</p>
              <h3 className="text-xl font-bold text-emerald-900">{formatCurrency(revisionData.monthlyCTC)}</h3>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-emerald-700 uppercase">Increase %</p>
              <h3 className="text-xl font-bold text-emerald-900">
                {salaryRevision ? (((revisionData.monthlyCTC - salaryRevision.salary.monthlyCTC) / salaryRevision.salary.monthlyCTC) * 100).toFixed(1) : 0}%
              </h3>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSalaryRevision(null)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={postSalaryUpdate}>Post Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Employee Modal */}
      <Dialog open={!!editEmployee} onOpenChange={() => setEditEmployee(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Employee Profile</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input defaultValue={editEmployee?.name} />
            </div>
            <div className="space-y-2">
              <Label>Aadhaar Number</Label>
              <Input defaultValue={editEmployee?.aadhaar} />
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Input defaultValue={editEmployee?.department} />
            </div>
            <div className="space-y-2">
              <Label>Designation</Label>
              <Input defaultValue={editEmployee?.designation} />
            </div>
            <div className="space-y-2">
              <Label>Join Date</Label>
              <Input type="date" defaultValue={editEmployee?.joinDate} />
            </div>
            <div className="space-y-2">
              <Label>Mobile Number</Label>
              <Input defaultValue={editEmployee?.mobile} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEmployee(null)}>Cancel</Button>
            <Button onClick={() => setEditEmployee(null)}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
