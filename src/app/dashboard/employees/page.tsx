"use client";

import { useState } from "react";
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
import { 
  Plus, 
  Search, 
  MoreHorizontal, 
  UserPlus, 
  TrendingUp, 
  ArrowDownCircle,
  Pencil,
  Users
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator 
} from "@/components/ui/dropdown-menu";
import { formatCurrency } from "@/lib/utils";

const MOCK_EMPLOYEES = [
  { id: "1", employeeId: "S10001", name: "Ravi Kumar", dept: "Production", role: "Engineer", mobile: "9988776655", aadhaar: "1234 5678 9012", salary: 35000, status: "Active" },
  { id: "2", employeeId: "S10002", name: "Anita Singh", dept: "HR", role: "Manager", mobile: "8877665544", aadhaar: "4321 8765 0987", salary: 55000, status: "Active" },
  { id: "3", employeeId: "S10003", name: "Deepak Verma", dept: "Logistics", role: "Driver", mobile: "7766554433", aadhaar: "9876 5432 1098", salary: 22000, status: "Inactive" },
  { id: "4", employeeId: "S10004", name: "Sunil Sharma", dept: "Production", role: "Helper", mobile: "6655443322", aadhaar: "1111 2222 3333", salary: 18000, status: "Active" },
];

export default function EmployeesPage() {
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = MOCK_EMPLOYEES.filter(emp => 
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    emp.employeeId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Employee Directory</h1>
          <p className="text-muted-foreground">Manage and monitor your workforce across all plants.</p>
        </div>
        <Button className="font-bold shadow-lg shadow-primary/20">
          <UserPlus className="w-4 h-4 mr-2" />
          Add Employee
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-primary text-primary-foreground">
          <CardContent className="p-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm opacity-80 font-medium">Active Headcount</p>
                <h3 className="text-3xl font-bold mt-1">452</h3>
              </div>
              <Users className="w-10 h-10 opacity-20" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-slate-200">
          <CardContent className="p-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Monthly Attrition</p>
                <h3 className="text-3xl font-bold mt-1 text-rose-600">2.4%</h3>
              </div>
              <TrendingUp className="w-10 h-10 text-rose-100" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-slate-200">
          <CardContent className="p-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Avg. Tenure</p>
                <h3 className="text-3xl font-bold mt-1 text-emerald-600">3.2 Years</h3>
              </div>
              <ArrowDownCircle className="w-10 h-10 text-emerald-100" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by name, ID, or Aadhaar..." 
                className="pl-10 h-10 bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="outline" className="h-10">Filters</Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="font-bold">Employee ID</TableHead>
                <TableHead className="font-bold">Name</TableHead>
                <TableHead className="font-bold">Department</TableHead>
                <TableHead className="font-bold">Aadhaar</TableHead>
                <TableHead className="font-bold">Gross Salary</TableHead>
                <TableHead className="font-bold">Status</TableHead>
                <TableHead className="text-right font-bold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((emp) => (
                <TableRow key={emp.id} className="hover:bg-slate-50/50">
                  <TableCell className="font-mono font-bold text-primary">{emp.employeeId}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-bold">{emp.name}</span>
                      <span className="text-xs text-muted-foreground">{emp.role}</span>
                    </div>
                  </TableCell>
                  <TableCell>{emp.dept}</TableCell>
                  <TableCell className="text-xs font-mono">{emp.aadhaar}</TableCell>
                  <TableCell className="font-semibold">{formatCurrency(emp.salary)}</TableCell>
                  <TableCell>
                    <Badge variant={emp.status === "Active" ? "default" : "secondary"} className={emp.status === "Active" ? "bg-emerald-600" : ""}>
                      {emp.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem>
                          <Pencil className="w-4 h-4 mr-2" /> Edit Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <TrendingUp className="w-4 h-4 mr-2" /> Increase Salary
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-rose-600">
                          Deactivate
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
