"use client";

import { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { 
  Factory, 
  Building2, 
  Upload, 
  Trash2, 
  PlusCircle, 
  History, 
  ShieldCheck, 
  MapPin, 
  Pencil,
  AlertTriangle
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Firm, Plant, FirmUnit } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useData } from "@/context/data-context";

export default function FirmsAndPlantsPage() {
  const { firms, setFirms, plants, setPlants } = useData();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("plants");

  // Plant Form State
  const [plantDraft, setPlantDraft] = useState<Partial<Plant>>({ radius: 700 });
  const [editingPlantId, setEditingPlantId] = useState<string | null>(null);
  const [plantToRemove, setPlantToRemove] = useState<Plant | null>(null);

  // Firm Form State
  const [firmDraft, setFirmDraft] = useState<Partial<Firm>>({ units: [] });
  const [unitDraft, setUnitDraft] = useState({ name: '', address: '' });
  const [isProcessing, setIsProcessing] = useState(false);

  const handleRegisterPlant = () => {
    if (!plantDraft.name || !plantDraft.lat || !plantDraft.lng || !plantDraft.firmId) {
      toast({ variant: "destructive", title: "Missing Fields", description: "Please fill all required plant details." });
      return;
    }

    setIsProcessing(true);
    try {
      if (editingPlantId) {
        setPlants(prev => prev.map(p => p.id === editingPlantId ? { ...p, ...plantDraft } as Plant : p));
        toast({ title: "Plant Updated", description: `${plantDraft.name} configuration saved.` });
      } else {
        const newPlant: Plant = {
          id: Math.random().toString(36).substr(2, 9),
          name: plantDraft.name!,
          lat: Number(plantDraft.lat),
          lng: Number(plantDraft.lng),
          radius: Number(plantDraft.radius),
          firmId: plantDraft.firmId!,
          active: true
        };
        setPlants(prev => [...prev, newPlant]);
        toast({ title: "Plant Registered", description: `${newPlant.name} is now live for geofencing.` });
      }
      setPlantDraft({ radius: 700 });
      setEditingPlantId(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemovePlant = () => {
    if (!plantToRemove) return;
    setPlants(prev => prev.filter(p => p.id !== plantToRemove.id));
    setPlantToRemove(null);
    toast({ title: "Plant Removed", description: "The infrastructure node has been deleted." });
  };

  const addUnit = () => {
    if (!unitDraft.name || !unitDraft.address) return;
    setFirmDraft(prev => ({
      ...prev,
      units: [...(prev.units || []), { id: Date.now().toString(), ...unitDraft }]
    }));
    setUnitDraft({ name: '', address: '' });
  };

  const handleRegisterFirm = () => {
    if (!firmDraft.name || !firmDraft.gstin) {
      toast({ variant: "destructive", title: "Validation Error", description: "Firm name and GSTIN are required." });
      return;
    }
    const newFirm: Firm = {
      id: Math.random().toString(36).substr(2, 9),
      name: firmDraft.name!,
      gstin: firmDraft.gstin!,
      pan: firmDraft.pan || '',
      pfNo: firmDraft.pfNo || '',
      esicNo: firmDraft.esicNo || '',
      units: firmDraft.units || []
    };
    setFirms(prev => [...prev, newFirm]);
    setFirmDraft({ units: [] });
    toast({ title: "Firm Registered", description: `${newFirm.name} added to repository.` });
  };

  return (
    <div className="space-y-10 pb-20 max-w-6xl mx-auto">
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
                <Factory className="w-6 h-6 text-primary" /> {editingPlantId ? 'Edit Plant' : 'New Plant Registration'}
              </CardTitle>
              <CardDescription>Setup a new manufacturing or logistics unit with geofencing.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div className="space-y-2">
                  <Label className="font-bold">Associated Firm *</Label>
                  <Select value={plantDraft.firmId} onValueChange={(v) => setPlantDraft(p => ({...p, firmId: v}))}>
                    <SelectTrigger className="h-12 bg-white">
                      <SelectValue placeholder="Select Firm" />
                    </SelectTrigger>
                    <SelectContent>
                      {firms.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-bold">Plant Name *</Label>
                  <Input 
                    placeholder="e.g. Okhla Unit 3" 
                    className="h-12 bg-white" 
                    value={plantDraft.name || ''} 
                    onChange={(e) => setPlantDraft(p => ({...p, name: e.target.value}))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold">Radius (Meters)</Label>
                  <Input value={plantDraft.radius} disabled className="h-12 bg-slate-100 font-bold" />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold">Latitude *</Label>
                  <Input 
                    placeholder="28.5355" 
                    className="h-12 bg-white font-mono" 
                    type="number" 
                    step="any"
                    value={plantDraft.lat || ''} 
                    onChange={(e) => setPlantDraft(p => ({...p, lat: Number(e.target.value)}))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold">Longitude *</Label>
                  <Input 
                    placeholder="77.2639" 
                    className="h-12 bg-white font-mono" 
                    type="number" 
                    step="any"
                    value={plantDraft.lng || ''} 
                    onChange={(e) => setPlantDraft(p => ({...p, lng: Number(e.target.value)}))}
                  />
                </div>
              </div>
              <div className="flex justify-end pt-4 gap-3">
                {editingPlantId && <Button variant="ghost" onClick={() => {setEditingPlantId(null); setPlantDraft({radius: 700});}}>Cancel</Button>}
                <Button className="px-10 h-12 font-bold bg-primary text-lg rounded-xl shadow-lg shadow-primary/20" onClick={handleRegisterPlant}>
                  {editingPlantId ? 'Update Plant' : 'Register Plant'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-100">
                <History className="w-5 h-5 text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Plant Registration History</h2>
            </div>
            
            <Card className="border-slate-200 overflow-hidden shadow-sm">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-bold">Firm Name</TableHead>
                    <TableHead className="font-bold">Plant Name</TableHead>
                    <TableHead className="font-bold">Radius (Meters)</TableHead>
                    <TableHead className="font-bold">Location (Lat, Lng)</TableHead>
                    <TableHead className="font-bold text-center">Status</TableHead>
                    <TableHead className="text-right font-bold pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plants.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No plants registered yet.</TableCell>
                    </TableRow>
                  ) : (
                    plants.map((p) => (
                      <TableRow key={p.id} className="hover:bg-slate-50/50">
                        <TableCell className="font-medium">{firms.find(f => f.id === p.firmId)?.name || 'Unknown Firm'}</TableCell>
                        <TableCell className="font-bold">{p.name}</TableCell>
                        <TableCell>{p.radius}m</TableCell>
                        <TableCell className="font-mono text-xs">{p.lat.toFixed(4)}, {p.lng.toFixed(4)}</TableCell>
                        <TableCell className="text-center">
                          <Badge className={p.active ? "bg-emerald-600" : "bg-slate-400"}>{p.active ? "Active" : "Inactive"}</Badge>
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <div className="flex justify-end gap-2">
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500" onClick={() => {setEditingPlantId(p.id); setPlantDraft(p);}}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50" onClick={() => setPlantToRemove(p)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2 md:col-span-2">
                  <Label className="font-bold">Legal Name *</Label>
                  <Input 
                    className="h-12 bg-white" 
                    placeholder="Sikka Industries Ltd." 
                    value={firmDraft.name || ''} 
                    onChange={(e) => setFirmDraft(p => ({...p, name: e.target.value}))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold">GSTIN *</Label>
                  <Input 
                    className="h-12 bg-white uppercase" 
                    placeholder="07AAAAA0000A1Z5" 
                    value={firmDraft.gstin || ''} 
                    onChange={(e) => setFirmDraft(p => ({...p, gstin: e.target.value.toUpperCase()}))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold">PAN</Label>
                  <Input 
                    className="h-12 bg-white uppercase" 
                    placeholder="AAAAA0000A" 
                    value={firmDraft.pan || ''} 
                    onChange={(e) => setFirmDraft(p => ({...p, pan: e.target.value.toUpperCase()}))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold">PF Number</Label>
                  <Input 
                    className="h-12 bg-white" 
                    placeholder="DL/CPM/123/..." 
                    value={firmDraft.pfNo || ''} 
                    onChange={(e) => setFirmDraft(p => ({...p, pfNo: e.target.value}))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold">ESIC Number</Label>
                  <Input 
                    className="h-12 bg-white" 
                    placeholder="11000123..." 
                    value={firmDraft.esicNo || ''} 
                    onChange={(e) => setFirmDraft(p => ({...p, esicNo: e.target.value}))}
                  />
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
                  {(firmDraft.units || []).map(u => (
                    <div key={u.id} className="flex justify-between items-center p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900">{u.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.address}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="text-rose-500 hover:bg-rose-50" onClick={() => setFirmDraft(p => ({...p, units: (p.units || []).filter(x => x.id !== u.id)}))}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button className="px-10 h-12 font-bold bg-slate-900 text-white hover:bg-slate-800 text-lg rounded-xl shadow-xl" onClick={handleRegisterFirm}>
                  Finalize Firm Configuration
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Registered Firm History</h2>
            </div>
            
            <div className="space-y-4">
              {firms.map(f => (
                <Card key={f.id} className="border-slate-200">
                  <CardContent className="p-8">
                    <div className="flex flex-col md:flex-row justify-between gap-6">
                      <div className="space-y-4 flex-1">
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

      {/* Remove Plant Confirmation Dialog */}
      <AlertDialog open={!!plantToRemove} onOpenChange={(open) => !open && setPlantToRemove(null)}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-rose-600" />
            </div>
            <AlertDialogTitle className="text-center text-xl">Confirm Plant Removal</AlertDialogTitle>
            <AlertDialogDescription className="text-center pt-2">
              Are you sure you want to remove <strong>{plantToRemove?.name}</strong>? This action cannot be undone and will affect geofencing attendance for this location.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center gap-3 pt-6">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRemovePlant}
              className="bg-rose-600 hover:bg-rose-700 font-bold"
            >
              Confirm Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
