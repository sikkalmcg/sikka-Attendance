
"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Factory, Building2, Upload, Trash2, PlusCircle, History, Clock, ShieldCheck } from "lucide-react";
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
    toast({ title: "Unit Added", description: "Unit has been added to the firm draft." });
  };

  return (
    <div className="space-y-10 pb-20">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Infrastructure Setup</h1>
          <p className="text-muted-foreground">Configure your organizational structure, plants, and geofencing.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-8 bg-slate-100 p-1 rounded-xl h-12">
          <TabsTrigger value="plants" className="rounded-lg font-bold data-[state=active]:shadow-sm">Plants & Geofence</TabsTrigger>
          <TabsTrigger value="firms" className="rounded-lg font-bold data-[state=active]:shadow-sm">Firm Registration</TabsTrigger>
        </TabsList>

        <TabsContent value="plants" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Card className="lg:col-span-4 border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Factory className="w-5 h-5 text-primary" /> New Plant
                </CardTitle>
                <CardDescription>Register a new manufacturing or logistics unit.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Plant Name</Label>
                  <Input placeholder="Okhla Unit 3" className="bg-white" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Latitude</Label>
                    <Input placeholder="28.5355" className="bg-white font-mono" />
                  </div>
                  <div className="space-y-2">
                    <Label>Longitude</Label>
                    <Input placeholder="77.2639" className="bg-white font-mono" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Radius (Meters)</Label>
                  <Input value="700" disabled className="bg-slate-50 font-bold" />
                </div>
                <Button className="w-full font-bold h-11 bg-primary">Register Plant</Button>
              </CardContent>
            </Card>
            
            <Card className="lg:col-span-8 overflow-hidden border-slate-200 shadow-sm">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-bold">Plant Name</TableHead>
                    <TableHead className="font-bold">Coordinates</TableHead>
                    <TableHead className="font-bold text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plants.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-12 text-muted-foreground">No plants registered yet.</TableCell>
                    </TableRow>
                  ) : (
                    plants.map(p => (
                      <TableRow key={p.id} className="hover:bg-slate-50/50">
                        <TableCell className="font-bold">{p.name}</TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">{p.lat}, {p.lng}</TableCell>
                        <TableCell className="text-right">
                          <Badge className="bg-emerald-600 border-none font-bold">Active ({p.radius}m)</Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="firms" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Card className="lg:col-span-5 border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" /> Firm Details
                </CardTitle>
                <CardDescription>Setup legal entity and statutory compliance IDs.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-3xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer group">
                  <Upload className="w-10 h-10 text-slate-400 group-hover:text-primary transition-colors" />
                  <span className="text-sm font-bold mt-2">Upload Entity Logo</span>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Legal Name</Label>
                    <Input className="bg-white" placeholder="Sikka Industries Ltd." />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>GSTIN</Label>
                      <Input className="bg-white uppercase" placeholder="07AAAAA0000A1Z5" />
                    </div>
                    <div className="space-y-2">
                      <Label>PAN</Label>
                      <Input className="bg-white uppercase" placeholder="AAAAA0000A" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>PF Number</Label>
                      <Input className="bg-white" placeholder="DL/CPM/..." />
                    </div>
                    <div className="space-y-2">
                      <Label>ESIC Number</Label>
                      <Input className="bg-white" placeholder="11000..." />
                    </div>
                  </div>
                </div>
                <div className="pt-6 border-t border-slate-100 space-y-4">
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Unit Addresses</h4>
                  <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <Input placeholder="Unit Name (e.g. Unit 1)" value={unitDraft.name} onChange={(e) => setUnitDraft({...unitDraft, name: e.target.value})} className="bg-white" />
                    <Input placeholder="Full Address" value={unitDraft.address} onChange={(e) => setUnitDraft({...unitDraft, address: e.target.value})} className="bg-white" />
                    <Button variant="secondary" size="sm" className="w-full gap-2 font-bold" onClick={addUnit}>
                      <PlusCircle className="w-4 h-4" /> Add Unit Entity
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {units.map(u => (
                      <div key={u.id} className="flex justify-between items-center p-3 bg-white rounded-xl border border-slate-100 shadow-sm text-xs">
                        <div>
                          <p className="font-bold">{u.name}</p>
                          <p className="text-muted-foreground leading-tight">{u.address}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="text-rose-500 hover:bg-rose-50" onClick={() => setUnits(units.filter(x => x.id !== u.id))}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
                <Button className="w-full font-bold h-12 bg-slate-900 text-white hover:bg-slate-800">Finalize Configuration</Button>
              </CardContent>
            </Card>

            <Card className="lg:col-span-7 overflow-hidden border-slate-200 shadow-sm">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-bold">Firm Entity</TableHead>
                    <TableHead className="font-bold">Tax & Statutory Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {firms.map(f => (
                    <TableRow key={f.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-bold align-top pt-4">{f.name}</TableCell>
                      <TableCell className="text-xs space-y-2 py-4">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-100">GSTIN: {f.gstin}</Badge>
                            <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-700">PAN: {f.pan}</Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-100">PF: {f.pfNo}</Badge>
                            <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-100">ESIC: {f.esicNo}</Badge>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Infrastructure History Section at the bottom */}
      <div className="pt-12 border-t border-slate-200">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <History className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Infrastructure History & Audit</h2>
            <p className="text-xs text-muted-foreground">Historical records of organizational entity changes.</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Plant History */}
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-600" /> Recent Plant Registrations
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {plants.map((p, i) => (
                  <div key={p.id} className="flex items-start gap-4 p-5 hover:bg-slate-50 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0 border border-emerald-100">
                      <Factory className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-sm font-bold truncate pr-2">{p.name}</p>
                        <Badge variant="secondary" className="text-[9px] font-black uppercase tracking-tighter bg-slate-100">PLANT-{p.id.slice(0, 2)}</Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1 mb-2">
                        <Clock className="w-3 h-3" /> Registered on: {i === 0 ? "12-Jan-2024" : "Today"}
                      </p>
                      <div className="bg-slate-100 p-2 rounded-lg flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold text-slate-600 uppercase">Geofence Verified</span>
                        <span className="text-[10px] font-mono text-primary font-bold">{p.lat.toFixed(4)}, {p.lng.toFixed(4)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Firm History */}
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600" /> Firm Entity Log
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {firms.map((f, i) => (
                  <div key={f.id} className="flex items-start gap-4 p-5 hover:bg-slate-50 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 border border-blue-100">
                      <Building2 className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-sm font-bold truncate pr-2">{f.name}</p>
                        <Badge className="bg-blue-600 text-[9px] font-bold uppercase tracking-tighter">Verified Entity</Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1 mb-3">
                        <Clock className="w-3 h-3" /> Active Since: {i === 0 ? "01-Apr-2023" : "Today"}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-slate-50 border border-slate-100 p-1.5 rounded-lg text-center">
                          <p className="text-[9px] font-black uppercase text-slate-400">GSTIN Status</p>
                          <p className="text-[10px] font-bold text-emerald-600">Active</p>
                        </div>
                        <div className="bg-slate-50 border border-slate-100 p-1.5 rounded-lg text-center">
                          <p className="text-[9px] font-black uppercase text-slate-400">Statutory</p>
                          <p className="text-[10px] font-bold text-emerald-600">Compliant</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
