
"use client";

import { useState, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Wallet, Plus, CreditCard, Search, XCircle, CheckCircle, Clock, Building2, Factory } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useData } from "@/context/data-context";

export default function VouchersPage() {
  const { employees, firms, plants, vouchers, setVouchers } = useData();
  const [activeTab, setActiveTab] = useState("create");
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const { toast } = useToast();

  // Selected Employee Details
  const selectedEmployee = useMemo(() => 
    employees.find(e => e.id === selectedEmployeeId), 
  [employees, selectedEmployeeId]);

  const associatedFirm = useMemo(() => 
    firms.find(f => f.id === selectedEmployee?.firmId), 
  [firms, selectedEmployee]);

  const associatedUnit = useMemo(() => 
    plants.find(p => p.id === selectedEmployee?.unitId), 
  [plants, selectedEmployee]);

  // Dynamic FY Calculation based on Indian Financial Year (Apr-Mar)
  const voucherNo = useMemo(() => {
    const d = new Date(voucherDate);
    if (isNaN(d.getTime())) return "--------";
    
    const month = d.getMonth(); // 0-indexed (3 is April)
    const year = d.getFullYear();
    
    const startYear = month < 3 ? year - 1 : year;
    const endYear = startYear + 1;
    const fyPrefix = `${startYear}${(endYear % 100).toString().padStart(2, '0')}`;
    
    // Concatenate with a mock serial number for display
    return `${fyPrefix}${Math.floor(10000 + Math.random() * 90000)}`;
  }, [voucherDate]);

  const handleCreateVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedEmployeeId || !amount || !purpose) {
      toast({ 
        variant: "destructive", 
        title: "Mandatory Fields Missing", 
        description: "Please select an employee and enter both amount and purpose." 
      });
      return;
    }

    const newVoucher = {
      id: Math.random().toString(36).substr(2, 9),
      voucherNo: voucherNo,
      employeeId: selectedEmployeeId,
      employeeName: selectedEmployee?.name || "Unknown",
      firmName: associatedFirm?.name || "N/A",
      unitName: associatedUnit?.name || "N/A",
      date: voucherDate,
      amount: parseFloat(amount),
      purpose: purpose,
      status: "PENDING" as const
    };

    // In a real app we'd add to context, here we simulate it
    toast({ title: "Voucher Created", description: `Voucher #${voucherNo} has been generated.` });
    
    // Reset fields
    setSelectedEmployeeId("");
    setAmount("");
    setPurpose("");
    setActiveTab("payment");
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Advance Voucher System</h1>
          <p className="text-muted-foreground">Manage employee advance payments and recovery.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-8 bg-slate-100 p-1 rounded-xl h-12">
          <TabsTrigger value="create" className="font-semibold rounded-lg">Create Voucher</TabsTrigger>
          <TabsTrigger value="payment" className="font-semibold rounded-lg">Voucher Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="create">
          <Card className="max-w-4xl mx-auto shadow-xl border-none">
            <CardHeader className="bg-slate-50 border-b border-slate-100 rounded-t-xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Wallet className="text-primary w-5 h-5" />
                </div>
                <CardTitle>Generate New Voucher</CardTitle>
              </div>
            </CardHeader>
            <form onSubmit={handleCreateVoucher}>
              <CardContent className="p-8 space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <Label className="font-bold">Voucher Number</Label>
                    <Input value={voucherNo} disabled className="bg-slate-100 font-mono font-bold h-12" />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold">Date *</Label>
                    <Input 
                      type="date" 
                      value={voucherDate} 
                      onChange={(e) => setVoucherDate(e.target.value)}
                      className="h-12 bg-white"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="font-bold">Select Employee *</Label>
                    <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId} required>
                      <SelectTrigger className="h-12 bg-white">
                        <SelectValue placeholder="Select Employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map(emp => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.name} ({emp.employeeId})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="font-bold text-emerald-600">Advance Amount (INR) *</Label>
                    <Input 
                      type="number" 
                      placeholder="Enter amount" 
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="h-12 bg-white font-bold"
                      required 
                    />
                  </div>

                  {/* Auto-populated Fields */}
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                      <Building2 className="w-3 h-3" /> Associated Firm (Auto)
                    </Label>
                    <Input 
                      value={associatedFirm?.name || "Select Employee First"} 
                      disabled 
                      className="h-12 bg-slate-50 border-slate-200 italic text-slate-500" 
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                      <Factory className="w-3 h-3" /> Working Unit (Auto)
                    </Label>
                    <Input 
                      value={associatedUnit?.name || "Select Employee First"} 
                      disabled 
                      className="h-12 bg-slate-50 border-slate-200 italic text-slate-500" 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="font-bold">Purpose of Advance *</Label>
                  <Input 
                    placeholder="e.g. Personal Emergency, Medical, Travel Advance..." 
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    className="h-12 bg-white"
                    required 
                  />
                </div>
              </CardContent>
              <CardFooter className="bg-slate-50 border-t border-slate-100 rounded-b-xl flex justify-end gap-3 p-6">
                <Button variant="outline" type="button" className="h-12 px-8" onClick={() => setActiveTab("payment")}>Cancel</Button>
                <Button className="px-12 h-12 font-bold shadow-lg shadow-primary/20 bg-primary">Create Voucher</Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        <TabsContent value="payment">
          <Card className="shadow-sm border-slate-200 overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-50 rounded-lg"><CreditCard className="w-5 h-5 text-emerald-600" /></div>
                  <CardTitle className="text-lg">Recent Advance Vouchers</CardTitle>
                </div>
                <div className="relative w-80">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search voucher, employee or unit..." className="pl-10 h-10 bg-white" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="font-bold">Voucher No</TableHead>
                    <TableHead className="font-bold">Employee Name</TableHead>
                    <TableHead className="font-bold">Firm / Unit</TableHead>
                    <TableHead className="font-bold">Date</TableHead>
                    <TableHead className="font-bold">Amount</TableHead>
                    <TableHead className="font-bold">Status</TableHead>
                    <TableHead className="text-right font-bold pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* We map actual context vouchers if they existed, here using mock for display */}
                  {vouchers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                        No vouchers recorded for the current period.
                      </TableCell>
                    </TableRow>
                  ) : (
                    vouchers.map((v) => {
                      const emp = employees.find(e => e.id === v.employeeId);
                      const firm = firms.find(f => f.id === emp?.firmId);
                      const unit = plants.find(p => p.id === emp?.unitId);
                      
                      return (
                        <TableRow key={v.id} className="hover:bg-slate-50/50">
                          <TableCell className="font-mono font-bold text-primary">{v.voucherNo}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-bold">{emp?.name || "Unknown"}</span>
                              <span className="text-[10px] text-muted-foreground font-mono">{emp?.employeeId}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-xs font-medium">{firm?.name || "N/A"}</span>
                              <span className="text-[10px] text-muted-foreground">{unit?.name || "N/A"}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{v.date}</TableCell>
                          <TableCell className="font-bold text-emerald-600">{formatCurrency(v.amount)}</TableCell>
                          <TableCell>
                            <Badge variant={v.status === "PAID" ? "default" : "secondary"} className={cn(
                              "text-[10px] font-bold px-2 py-0.5",
                              v.status === "PAID" ? "bg-emerald-600" : "bg-amber-500 text-white border-none"
                            )}>
                              {v.status === "PAID" ? <CheckCircle className="w-3 h-3 mr-1" /> : <Clock className="w-3 h-3 mr-1" />}
                              {v.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            {v.status === "PENDING" ? (
                              <div className="flex justify-end gap-2">
                                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-8 text-xs">
                                  <CreditCard className="w-3 h-3 mr-1" /> Pay
                                </Button>
                                <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50 h-8 text-xs">
                                  <XCircle className="w-3 h-3 mr-1" /> Cancel
                                </Button>
                              </div>
                            ) : (
                              <Button size="sm" variant="outline" className="h-8 text-xs">View Details</Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
