"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Plus, Factory, Building2, MapPin, Upload, Trash2, PlusCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Firm, Plant, FirmUnit } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

export default function FirmsAndPlantsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("plants");

  // Mock State
  const [firms, setFirms] = useState<Firm[]>([
    { 
      id: "1", 
      name: "Sikka Industries Ltd.", 
      gstin: "07AAAAA0000A1Z5", 
      pan: "AAAAA0000A", 
      pfNo: "DL/CPM/0012345", 
      esicNo: "11000123450011001",
      units: [{ id: "u1", name: "Main HQ", address: "Okhla Ph III, Delhi" }]
    },
  ]);

  const [plants, setPlants] = useState<Plant[]>([
    { id: "1", name: "Okhla Phase III Plant", lat: 28.5355, lng: 77.2639, radius: 700 },
    { id: "2", name: "Gurgaon Sector 18", lat: 28.4595, lng: 77.0266, radius: 700 },
  ]);

  const [unitDraft, setUnitDraft] = useState<Partial<FirmUnit>>({ name: '', address: '' });
  const [activeUnits, setActiveUnits] = useState<FirmUnit[]>([]);

  const addUnitToDraft = () => {
    if (!unitDraft.name || !unitDraft.address) {
      toast({ variant: "destructive", title: "Error", description: "Unit Name and Address are required." });
      return;
    }
    setActiveUnits([...activeUnits, { id: Math.random().toString(), name: unitDraft.name, address: unitDraft.address }]);
    setUnitDraft({ name: '', address: '' });
    toast({ title: "Unit Added", description: "Address added to the firm setup." });
  };

  const removeUnit = (id: string) => {
    setActiveUnits(prev => prev.filter(u => u.id !== id));
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Admin Panel - Infrastructure</h1>
          <p className="text-muted-foreground">Configure Plants, Geofences, and Legal Firm entities.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-8 bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="plants" className="font-bold rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm h-10">Plant Management</TabsTrigger>
          <TabsTrigger value="firms" className="font-bold rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm h-10">Firm Registration</TabsTrigger>
        </TabsList>

        <TabsContent value="plants">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Card className="lg:col-span-4 border-slate-200 shadow-sm rounded-2xl">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Factory className="w-5 h-5 text-primary" /> Define New Plant
                </CardTitle>
                <CardDescription>Establish GPS coordinates for geofencing.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Plant Name</Label>
                  <Input placeholder="e.g., Okhla Industrial Unit 3" />
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label>Location Latitude</Label>
                    <Input placeholder="e.g., 28.5355" />
                  </div>
                  <div className="space-y-2">
                    <Label>Location Longitude</Label>
                    <Input placeholder="e.g., 77.2639" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Radius (Fixed at 700m)</Label>
                  <Input value="700" disabled className="bg-slate-50 font-bold" />
                </div>
                <Button className="w-full font-bold h-11 rounded-xl">Register Plant</Button>
              </CardContent>
            </Card>

            <Card className="lg:col-span-8 border-slate-200 shadow-sm rounded-2xl overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-bold">Plant Name</TableHead>
                    <TableHead className="font-bold">Coordinates (Lat, Lng)</TableHead>
                    <TableHead className="font-bold">Radius</TableHead>
                    <TableHead className="text-right font-bold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plants.map(p => (
                    <TableRow key={p.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-bold">{p.name}</TableCell>
                      <TableCell className="font-mono text-xs">{p.lat}, {p.lng}</TableCell>
                      <TableCell>{p.radius}m</TableCell>
                      <TableCell className="text-right">
                        <Badge className="bg-emerald-600">Active</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="firms">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Card className="lg:col-span-5 border-slate-200 shadow-sm rounded-2xl">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" /> Firm Registration Form
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Logo Upload Mock */}
                <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-3xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer group">
                  <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Upload className="w-8 h-8 text-slate-400" />
                  </div>
                  <span className="text-sm font-bold text-slate-600">Upload Firm Logo</span>
                  <p className="text-[10px] text-muted-foreground mt-1">PNG, JPG (Max 2MB)</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Firm Legal Name</Label>
                    <Input placeholder="Enter full registered name" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Firm GSTIN</Label>
                      <Input placeholder="15-digit GST" />
                    </div>
                    <div className="space-y-2">
                      <Label>PAN Number</Label>
                      <Input placeholder="10-digit PAN" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>PF Number</Label>
                      <Input placeholder="DL/CPM/..." />
                    </div>
                    <div className="space-y-2">
                      <Label>ESIC Number</Label>
                      <Input placeholder="ESIC Code" />
                    </div>
                  </div>
                </div>
                
                {/* Unit Management */}
                <div className="pt-6 border-t space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest">Office Units / Addresses</h4>
                    <Badge variant="outline" className="text-[10px]">{activeUnits.length} Added</Badge>
                  </div>
                  <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div className="space-y-2">
                      <Input 
                        placeholder="Unit Name (e.g., Regional HQ)" 
                        className="bg-white"
                        value={unitDraft.name} 
                        onChange={(e) => setUnitDraft({...unitDraft, name: e.target.value})} 
                      />
                      <Input 
                        placeholder="Full Unit Address" 
                        className="bg-white"
                        value={unitDraft.address} 
                        onChange={(e) => setUnitDraft({...unitDraft, address: e.target.value})} 
                      />
                    </div>
                    <Button variant="secondary" size="sm" className="w-full gap-2 font-bold" onClick={addUnitToDraft}>
                      <PlusCircle className="w-4 h-4" /> Add Unit Address
                    </Button>
                  </div>
                  
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {activeUnits.map(u => (
                      <div key={u.id} className="flex justify-between items-center bg-white p-3 rounded-xl text-xs border border-slate-100 shadow-sm">
                        <div className="flex-1 mr-4">
                          <p className="font-bold text-slate-900">{u.name}</p>
                          <p className="text-muted-foreground line-clamp-1">{u.address}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:bg-rose-50" onClick={() => removeUnit(u.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <Button className="w-full font-bold h-12 rounded-2xl shadow-lg shadow-primary/20">Finalize Firm Configuration</Button>
              </CardContent>
            </Card>

            <Card className="lg:col-span-7 border-slate-200 shadow-sm rounded-2xl overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-bold">Firm Entity</TableHead>
                    <TableHead className="font-bold">Tax / ID Details</TableHead>
                    <TableHead className="font-bold">Operating Units</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {firms.map(f => (
                    <TableRow key={f.id} className="hover:bg-slate-50/50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center font-bold text-slate-400">S</div>
                          <span className="font-bold">{f.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs space-y-1">
                        <p><span className="text-muted-foreground font-medium uppercase text-[9px]">GST:</span> {f.gstin}</p>
                        <p><span className="text-muted-foreground font-medium uppercase text-[9px]">PF:</span> {f.pfNo}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {f.units.map(u => (
                            <Badge key={u.id} variant="secondary" className="text-[9px] bg-slate-100 border-none px-2 py-0">
                              {u.name}
                            </Badge>
                          ))}
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
    </div>
  );
}
