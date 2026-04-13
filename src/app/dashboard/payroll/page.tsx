"use client";

import { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, Calculator, Download, Search, CheckCircle2, Info } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { STATUTORY_RATES } from "@/lib/constants";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const MOCK_PAYROLL_DATA = [
  { id: "1", employeeId: "S10001", name: "Ravi Kumar", baseSalary: 35000, presentDays: 24, halfDays: 4, totalDays: 31 },
  { id: "2", employeeId: "S10002", name: "Anita Singh", baseSalary: 55000, presentDays: 31, halfDays: 0, totalDays: 31 },
  { id: "3", employeeId: "S10004", name: "Sunil Sharma", baseSalary: 18000, presentDays: 20, halfDays: 8, totalDays: 31 },
];

export default function PayrollPage() {
  const [month, setMonth] = useState("08");
  const [year, setYear] = useState("2024");
  const [searchTerm, setSearchTerm] = useState("");

  const payrollRecords = useMemo(() => {
    return MOCK_PAYROLL_DATA.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.employeeId.toLowerCase().includes(searchTerm.toLowerCase())
    ).map(p => {
      // Rule: Two Half Days = One Present Day
      const payableDays = p.presentDays + (p.halfDays * 0.5);
      
      const perDay = p.baseSalary / p.totalDays;
      const gross = Math.round(perDay * payableDays);
      const pf = Math.round(gross * STATUTORY_RATES.PF_EMPLOYEE_RATE);
      const esic = Math.round(gross * STATUTORY_RATES.ESIC_EMPLOYEE_RATE);
      const net = gross - pf - esic;
      
      return { ...p, payableDays, gross, pf, esic, net };
    });
  }, [searchTerm]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Payroll Processor</h1>
          <p className="text-muted-foreground">Calculate salaries, statutory deductions, and generate payslips.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="font-bold">
            <Download className="w-4 h-4 mr-2" /> Export Bank Statement
          </Button>
          <Button className="font-bold shadow-lg shadow-primary/20">
            <Calculator className="w-4 h-4 mr-2" /> Finalize Payroll
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-900 text-white">
          <CardContent className="p-6">
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Total Net Payable</p>
            <h3 className="text-2xl font-bold mt-2">{formatCurrency(payrollRecords.reduce((acc, r) => acc + r.net, 0))}</h3>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">PF Liability</p>
            <h3 className="text-2xl font-bold mt-2">{formatCurrency(payrollRecords.reduce((acc, r) => acc + r.pf, 0))}</h3>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">ESIC Liability</p>
            <h3 className="text-2xl font-bold mt-2">{formatCurrency(payrollRecords.reduce((acc, r) => acc + r.esic, 0))}</h3>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Employees</p>
            <h3 className="text-2xl font-bold mt-2">{payrollRecords.length}</h3>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search employee..." 
                className="pl-10 h-10 bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="w-[120px] bg-white">
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="07">July</SelectItem>
                  <SelectItem value="08">August</SelectItem>
                  <SelectItem value="09">September</SelectItem>
                </SelectContent>
              </Select>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="w-[100px] bg-white">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="font-bold">Employee</TableHead>
                <TableHead className="font-bold text-center">
                  <div className="flex items-center justify-center gap-1">
                    Payable Days
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Rule: 2 Half Days = 1 Present Day</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </TableHead>
                <TableHead className="font-bold">Gross Salary</TableHead>
                <TableHead className="font-bold text-rose-600">PF Ded.</TableHead>
                <TableHead className="font-bold text-rose-600">ESIC Ded.</TableHead>
                <TableHead className="font-bold text-emerald-600">Net Payable</TableHead>
                <TableHead className="text-right font-bold">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payrollRecords.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-bold">{r.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-primary">{r.employeeId}</span>
                        <span className="text-[10px] text-muted-foreground">(P: {r.presentDays}, H: {r.halfDays})</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-bold">
                    {r.payableDays}
                    <span className="text-muted-foreground font-normal text-xs ml-1">/ {r.totalDays}</span>
                  </TableCell>
                  <TableCell className="font-semibold">{formatCurrency(r.gross)}</TableCell>
                  <TableCell className="text-rose-600 text-xs font-bold">{formatCurrency(r.pf)}</TableCell>
                  <TableCell className="text-rose-600 text-xs font-bold">{formatCurrency(r.esic)}</TableCell>
                  <TableCell className="text-emerald-600 font-bold">{formatCurrency(r.net)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className="gap-1 border-slate-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Computed
                    </Badge>
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
