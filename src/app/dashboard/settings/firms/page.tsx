
"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Factory, Building2, Upload, Trash2, PlusCircle, History, Clock, ShieldCheck, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Firm, Plant, FirmUnit } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function FirmsAndPlantsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("plants");

  const [firms, setFirms] = useState<Firm[]>([
    { id: "1", name: "Sikka Industries Ltd.", gstin: "07AAAAA0000A1Z5", pan: "AAAAA0000A", pfNo: "DL/CPM/123", esicNo: "11000123", units: [
      { id: "u1", name: "Okhla Unit 1", address: "Phase III, Okhla" }
    ] }
  ]);
  const [plants] = useState<Plant[]>([
    { id: "1", name: "Okhla Phase III Plant", lat: 28.5355, lng: 77.2639, radius: 700 },
    { id: "2", name: "Gurgaon Unit 2", lat: 28.4595, lng: 77.0266, radius: 700 }
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
    <div className="space-y-10 pb-20 max-w-5xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Infrastructure Setup</h1>
        <p className="text-muted-foreground">Configure your organizational structure, plants, and geofencing.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-10 bg-slate-100 p-1 rounded-xl h-12">
          <TabsTrigger value="plants" className="rounded-lg font-bold data-[state=active]:shadow-sm">Plants & Geofence</TabsTrigger>
          <TabsTrigger value="firms" className="rounded-lg font-bold data-[state=active]:shadow-sm">Firm Registration</TabsTrigger>
        </TabsList>

        {/* Plants Tab */}
        <TabsContent value="plants" className="space-y-12">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b">
              <CardTitle className="text-xl flex items-center gap-2">
                <Factory className="w-6 h-6 text-primary" /> New Plant Registration
              </CardTitle>
              <CardDescription>Setup a new manufacturing or logistics unit with geofencing.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <Label className="font-bold">Plant Name</Label>
                  <Input placeholder="e.g. Okhla Unit 3" className="h-12 bg-white" />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold">Radius (Meters)</Label>
                  <Input value="700" disabled className="h-12 bg-slate-100 font-bold" />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold">Latitude</Label>
                  <Input placeholder="28.5355" className="h-12 bg-white font-mono" />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold">Longitude</Label>
                  <Input placeholder="77.2639" className="h-12 bg-white font-mono" />
                </div>
              </div>
              <div className="flex justify-end pt-4">
                <Button className="px-10 h-12 font-bold bg-primary text-lg rounded-xl shadow-lg shadow-primary/20">
                  Register Plant
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Plant History Footer Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-100">
                <History className="w-5 h-5 text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Plant Registration History</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {plants.map((p, i) => (
                <Card key={p.id} className="border-slate-200 hover:border-emerald-200 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-50 rounded-lg">
                          <Factory className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{p.name}</p>
                          <p className="text-[10px] font-mono text-muted-foreground">ID: PLANT-00{p.id}</p>
                        </div>
                      </div>
                      <Badge className="bg-emerald-600 font-bold">Active</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div>
                        <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-1">Coordinates</p>
                        <p className="text-xs font-mono font-bold text-slate-700">{p.lat}, {p.lng}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-1">Geofence</p>
                        <p className="text-xs font-bold text-slate-700">{p.radius}m Radius</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Firms Tab */}
        <TabsContent value="firms" className="space-y-12">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b">
              <CardTitle className="text-xl flex items-center gap-2">
                <Building2 className="w-6 h-6 text-primary" /> Firm Details & Statutory Setup
              </CardTitle>
              <CardDescription>Setup legal entity and statutory compliance IDs.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-10">
              <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-[2rem] bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer group">
                <Upload className="w-12 h-12 text-slate-400 group-hover:text-primary transition-colors" />
                <span className="text-sm font-bold mt-4 text-slate-500">Upload Entity Logo</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2 md:col-span-2">
                  <Label className="font-bold">Legal Name</Label>
                  <Input className="h-12 bg-white" placeholder="Sikka Industries Ltd." />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold">GSTIN</Label>
                  <Input className="h-12 bg-white uppercase" placeholder="07AAAAA0000A1Z5" />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold">PAN</Label>
                  <Input className="h-12 bg-white uppercase" placeholder="AAAAA0000A" />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold">PF Number</Label>
                  <Input className="h-12 bg-white" placeholder="DL/CPM/123/..." />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold">ESIC Number</Label>
                  <Input className="h-12 bg-white" placeholder="11000123..." />
                </div>
              </div>

              <div className="pt-8 border-t border-slate-100 space-y-6">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  <h4 className="text-sm font-black uppercase text-slate-900 tracking-wider">Add Unit Entities</h4>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Unit Name</Label>
                    <Input placeholder="e.g. Okhla Unit 1" value={unitDraft.name} onChange={(e) => setUnitDraft({...unitDraft, name: e.target.value})} className="bg-white" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Address</Label>
                    <Input placeholder="Full Address" value={unitDraft.address} onChange={(e) => setUnitDraft({...unitDraft, address: e.target.value})} className="bg-white" />
                  </div>
                  <Button variant="secondary" className="md:col-span-2 gap-2 font-bold h-11" onClick={addUnit}>
                    <PlusCircle className="w-4 h-4" /> Add Unit Entity
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {units.map(u => (
                    <div key={u.id} className="flex justify-between items-center p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900">{u.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.address}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="text-rose-500 hover:bg-rose-50" onClick={() => setUnits(units.filter(x => x.id !== u.id))}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button className="px-10 h-12 font-bold bg-slate-900 text-white hover:bg-slate-800 text-lg rounded-xl shadow-xl">
                  Finalize Configuration
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Firm History Footer Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Firm Entity History</h2>
            </div>
            
            <div className="space-y-4">
              {firms.map(f => (
                <Card key={f.id} className="border-slate-200">
                  <CardContent className="p-8">
                    <div className="flex flex-col md:flex-row justify-between gap-6">
                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
                            <Building2 className="w-6 h-6 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-slate-900">{f.name}</h3>
                            <div className="flex gap-2 mt-1">
                              <Badge className="bg-blue-600 text-[10px] font-bold">ACTIVE ENTITY</Badge>
                              <Badge variant="outline" className="text-[10px] font-bold border-blue-200 text-blue-700 bg-blue-50">REG: {f.id}</Badge>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tax Identity</p>
                            <p className="text-xs font-bold mt-1">GSTIN: {f.gstin}</p>
                            <p className="text-xs font-bold">PAN: {f.pan}</p>
                          </div>
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Statutory ID</p>
                            <p className="text-xs font-bold mt-1">PF: {f.pfNo}</p>
                            <p className="text-xs font-bold">ESIC: {f.esicNo}</p>
                          </div>
                        </div>
                      </div>
                      <div className="md:w-64 space-y-3">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Registered Units</p>
                        <div className="space-y-2">
                          {f.units.map(u => (
                            <div key={u.id} className="p-3 bg-slate-50 rounded-xl text-xs border border-slate-100">
                              <p className="font-bold text-slate-700">{u.name}</p>
                              <p className="text-muted-foreground leading-tight text-[10px]">{u.address}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
