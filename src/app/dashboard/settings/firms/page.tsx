"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Plus, Factory, Building2, MapPin, ShieldCheck, Upload, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Firm, Plant, FirmUnit } from "@/lib/types";

export default function FirmsAndPlantsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("plants");

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

  const [unitAddress, setUnitAddress] = useState<Partial<FirmUnit>>({ name: '', address: '' });
  const [currentUnits, setCurrentUnits] = useState<FirmUnit[]>([]);

  const addUnitToDraft = () => {
    if (!unitAddress.name || !unitAddress.address) return;
    setCurrentUnits([...currentUnits, { id: Math.random().toString(), name: unitAddress.name, address: unitAddress.address }]);
    setUnitAddress({ name: '', address: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Organization & Infrastructure</h1>
          <p className="text-muted-foreground">Configure Plants, geofences, and legal entity details.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-8">
          <TabsTrigger value="plants" className="font-semibold">Plant Management</TabsTrigger>
          <TabsTrigger value="firms" className="font-semibold">Firm & Units</TabsTrigger>
        </TabsList>

        <TabsContent value="plants">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1 border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Factory className="w-5 h-5 text-primary" /> Define Plant
                </CardTitle>
                <CardDescription>Register GPS coordinates for attendance radius.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2"><Label>Plant Name</Label><Input placeholder="Okhla Factory..." /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Latitude</Label><Input placeholder="28.xxx" /></div>
                  <div className="space-y-2"><Label>Longitude</Label><Input placeholder="77.xxx" /></div>
                </div>
                <div className="space-y-2"><Label>Geofence Radius (Meters)</Label><Input type="number" defaultValue="700" /></div>
                <Button className="w-full font-bold">Register Plant</Button>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2 border-slate-200 overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50"><TableRow>
                  <TableHead>Plant Name</TableHead>
                  <TableHead>Coordinates</TableHead>
                  <TableHead>Radius</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {plants.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-bold">{p.name}</TableCell>
                      <TableCell className="font-mono text-xs">{p.lat}, {p.lng}</TableCell>
                      <TableCell>{p.radius}m</TableCell>
                      <TableCell className="text-right"><Badge className="bg-emerald-600">Active</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="firms">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Card className="lg:col-span-5 border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" /> Firm Registration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4 p-4 border-2 border-dashed rounded-xl justify-center cursor-pointer hover:bg-slate-50 transition-colors">
                  <Upload className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm font-medium">Upload Firm Logo</span>
                </div>
                <div className="space-y-2"><Label>Firm Legal Name</Label><Input /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>GSTIN</Label><Input /></div>
                  <div className="space-y-2"><Label>PAN</Label><Input /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>PF No.</Label><Input /></div>
                  <div className="space-y-2"><Label>ESIC No.</Label><Input /></div>
                </div>
                
                <div className="pt-4 border-t space-y-4">
                  <h4 className="text-sm font-bold text-muted-foreground uppercase">Add Units</h4>
                  <div className="space-y-2">
                    <Input placeholder="Unit Name" value={unitAddress.name} onChange={(e) => setUnitAddress({...unitAddress, name: e.target.value})} />
                    <Input placeholder="Full Address" value={unitAddress.address} onChange={(e) => setUnitAddress({...unitAddress, address: e.target.value})} />
                    <Button variant="outline" size="sm" className="w-full" onClick={addUnitToDraft}>Add Unit to Firm</Button>
                  </div>
                  <div className="space-y-2">
                    {currentUnits.map(u => (
                      <div key={u.id} className="flex justify-between items-center bg-slate-50 p-2 rounded text-xs border">
                        <div><p className="font-bold">{u.name}</p><p className="text-muted-foreground">{u.address}</p></div>
                        <Button variant="ghost" size="icon" className="h-6 w-6"><Trash2 className="w-3 h-3 text-rose-600" /></Button>
                      </div>
                    ))}
                  </div>
                </div>
                <Button className="w-full font-bold">Finalize Firm Setup</Button>
              </CardContent>
            </Card>

            <Card className="lg:col-span-7 border-slate-200">
              <Table>
                <TableHeader className="bg-slate-50"><TableRow>
                  <TableHead>Firm</TableHead>
                  <TableHead>Tax Details</TableHead>
                  <TableHead>Units</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {firms.map(f => (
                    <TableRow key={f.id}>
                      <TableCell className="font-bold">{f.name}</TableCell>
                      <TableCell className="text-xs space-y-1">
                        <p><span className="text-muted-foreground">GST:</span> {f.gstin}</p>
                        <p><span className="text-muted-foreground">PAN:</span> {f.pan}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {f.units.map(u => <Badge key={u.id} variant="secondary" className="text-[9px]">{u.name}</Badge>)}
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
