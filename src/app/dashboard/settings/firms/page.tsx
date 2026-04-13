"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Factory, Building2, Upload, Trash2, PlusCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Firm, Plant, FirmUnit } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

export default function FirmsAndPlantsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("plants");

  const [firms, setFirms] = useState<Firm[]>([
    { id: "1", name: "Sikka Industries Ltd.", gstin: "07AAAAA0000A1Z5", pan: "AAAAA0000A", pfNo: "DL/CPM/123", esicNo: "11000123", units: [] }
  ]);
  const [plants] = useState<Plant[]>([
    { id: "1", name: "Okhla Phase III Plant", lat: 28.5355, lng: 77.2639, radius: 700 }
  ]);

  const [units, setUnits] = useState<FirmUnit[]>([]);
  const [unitDraft, setUnitDraft] = useState({ name: '', address: '' });

  const addUnit = () => {
    if (!unitDraft.name || !unitDraft.address) return;
    setUnits([...units, { id: Date.now().toString(), ...unitDraft }]);
    setUnitDraft({ name: '', address: '' });
  };

  return (
    <div className="space-y-6 pb-12">
      <h1 className="text-2xl font-bold">Infrastructure Setup</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-8 bg-slate-100 p-1">
          <TabsTrigger value="plants">Plants & Geofence</TabsTrigger>
          <TabsTrigger value="firms">Firm Registration</TabsTrigger>
        </TabsList>

        <TabsContent value="plants">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Card className="lg:col-span-4 border-slate-200">
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Factory className="w-5 h-5" /> New Plant</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2"><Label>Plant Name</Label><Input placeholder="Okhla Unit 3" /></div>
                <div className="space-y-2"><Label>Latitude</Label><Input placeholder="28.5355" /></div>
                <div className="space-y-2"><Label>Longitude</Label><Input placeholder="77.2639" /></div>
                <div className="space-y-2"><Label>Radius</Label><Input value="700" disabled className="bg-slate-50" /></div>
                <Button className="w-full font-bold h-11">Register Plant</Button>
              </CardContent>
            </Card>
            <Card className="lg:col-span-8 overflow-hidden">
              <Table><TableHeader className="bg-slate-50"><TableRow><TableHead>Plant Name</TableHead><TableHead>Coordinates</TableHead><TableHead className="text-right">Status</TableHead></TableRow></TableHeader>
                <TableBody>{plants.map(p => <TableRow key={p.id}><TableCell className="font-bold">{p.name}</TableCell><TableCell className="text-xs font-mono">{p.lat}, {p.lng}</TableCell><TableCell className="text-right"><Badge className="bg-emerald-600">Active (700m)</Badge></TableCell></TableRow>)}</TableBody>
              </Table>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="firms">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Card className="lg:col-span-5">
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Building2 className="w-5 h-5" /> Firm Details</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-3xl bg-slate-50 hover:bg-slate-100 cursor-pointer"><Upload className="w-8 h-8 text-slate-400" /><span className="text-sm font-bold">Upload Logo</span></div>
                <div className="space-y-4">
                  <div className="space-y-2"><Label>Legal Name</Label><Input /></div>
                  <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>GSTIN</Label><Input /></div><div className="space-y-2"><Label>PAN</Label><Input /></div></div>
                  <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>PF Number</Label><Input /></div><div className="space-y-2"><Label>ESIC Number</Label><Input /></div></div>
                </div>
                <div className="pt-4 border-t space-y-4">
                  <h4 className="text-xs font-black uppercase text-slate-400">Unit Addresses</h4>
                  <div className="space-y-2 bg-slate-50 p-3 rounded-xl">
                    <Input placeholder="Unit Name" value={unitDraft.name} onChange={(e) => setUnitDraft({...unitDraft, name: e.target.value})} />
                    <Input placeholder="Address" value={unitDraft.address} onChange={(e) => setUnitDraft({...unitDraft, address: e.target.value})} />
                    <Button variant="secondary" size="sm" className="w-full gap-2" onClick={addUnit}><PlusCircle className="w-4 h-4" /> Add Unit</Button>
                  </div>
                  {units.map(u => <div key={u.id} className="flex justify-between items-center p-2 bg-white rounded border text-xs"><div><p className="font-bold">{u.name}</p><p className="text-muted-foreground">{u.address}</p></div><Button variant="ghost" size="icon" className="text-rose-500" onClick={() => setUnits(units.filter(x => x.id !== u.id))}><Trash2 className="w-4 h-4" /></Button></div>)}
                </div>
                <Button className="w-full font-bold h-12">Finalize Configuration</Button>
              </CardContent>
            </Card>
            <Card className="lg:col-span-7 overflow-hidden">
              <Table><TableHeader className="bg-slate-50"><TableRow><TableHead>Firm Entity</TableHead><TableHead>Tax Details</TableHead></TableRow></TableHeader>
                <TableBody>{firms.map(f => <TableRow key={f.id}><TableCell className="font-bold">{f.name}</TableCell><TableCell className="text-xs space-y-1"><p>GST: {f.gstin}</p><p>PF: {f.pfNo}</p></TableCell></TableRow>)}</TableBody>
              </Table>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
