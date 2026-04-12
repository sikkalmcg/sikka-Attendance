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
import { Wallet, Plus, CreditCard, Search, XCircle, CheckCircle, Clock } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

const MOCK_VOUCHERS = [
  { id: "1", voucherNo: "20242500001", employee: "Ravi Kumar", amount: 5000, status: "PAID", date: "2024-08-01", paidDate: "2024-08-02" },
  { id: "2", voucherNo: "20242500002", employee: "Anita Singh", amount: 12000, status: "PENDING", date: "2024-08-05" },
];

export default function VouchersPage() {
  const [activeTab, setActiveTab] = useState("create");
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().split('T')[0]);
  const { toast } = useToast();

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
    return `${fyPrefix}00001`;
  }, [voucherDate]);

  const handleCreateVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    toast({ title: "Voucher Created", description: `Voucher #${voucherNo} has been generated.` });
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
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-8">
          <TabsTrigger value="create" className="font-semibold">Create Voucher</TabsTrigger>
          <TabsTrigger value="payment" className="font-semibold">Voucher Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="create">
          <Card className="max-w-3xl mx-auto shadow-xl border-none">
            <CardHeader className="bg-slate-50 border-b border-slate-100 rounded-t-xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Wallet className="text-primary w-5 h-5" />
                </div>
                <CardTitle>Generate New Voucher</CardTitle>
              </div>
            </CardHeader>
            <form onSubmit={handleCreateVoucher}>
              <CardContent className="p-8 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Voucher Number</Label>
                    <Input value={voucherNo} disabled className="bg-slate-100 font-mono font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input 
                      type="date" 
                      value={voucherDate} 
                      onChange={(e) => setVoucherDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Employee</Label>
                    <Select defaultValue="e1">
                      <SelectTrigger>
                        <SelectValue placeholder="Select Employee" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="e1">Ravi Kumar (S10001)</SelectItem>
                        <SelectItem value="e2">Anita Singh (S10002)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Advance Amount (INR)</Label>
                    <Input type="number" placeholder="Enter amount" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Purpose of Advance</Label>
                  <Input placeholder="Enter reason for advance" required />
                </div>
              </CardContent>
              <CardFooter className="bg-slate-50 border-t border-slate-100 rounded-b-xl flex justify-end gap-3 p-6">
                <Button variant="outline" type="button" onClick={() => setActiveTab("payment")}>Cancel</Button>
                <Button className="px-8 font-bold shadow-lg shadow-primary/20">Create Voucher</Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        <TabsContent value="payment">
          <Card className="shadow-sm border-slate-200 overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Recent Vouchers</CardTitle>
                <div className="relative w-72">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search voucher or employee..." className="pl-10 h-10 bg-white" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="font-bold">Voucher No</TableHead>
                    <TableHead className="font-bold">Employee</TableHead>
                    <TableHead className="font-bold">Date</TableHead>
                    <TableHead className="font-bold">Amount</TableHead>
                    <TableHead className="font-bold">Status</TableHead>
                    <TableHead className="text-right font-bold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MOCK_VOUCHERS.map((v) => (
                    <TableRow key={v.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-mono font-bold">{v.voucherNo}</TableCell>
                      <TableCell className="font-semibold">{v.employee}</TableCell>
                      <TableCell>{v.date}</TableCell>
                      <TableCell className="font-bold">{formatCurrency(v.amount)}</TableCell>
                      <TableCell>
                        <Badge variant={v.status === "PAID" ? "default" : "secondary"} className={v.status === "PAID" ? "bg-emerald-600" : "bg-amber-500 text-white border-none"}>
                          {v.status === "PAID" ? <CheckCircle className="w-3 h-3 mr-1" /> : <Clock className="w-3 h-3 mr-1" />}
                          {v.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {v.status === "PENDING" ? (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                              <CreditCard className="w-4 h-4 mr-1" /> Pay
                            </Button>
                            <Button size="sm" variant="ghost" className="text-rose-600 hover:text-rose-700 hover:bg-rose-50">
                              <XCircle className="w-4 h-4 mr-1" /> Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" disabled>View Details</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}