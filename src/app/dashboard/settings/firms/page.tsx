
"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { 
  Factory, 
  Building2, 
  Trash2, 
  PlusCircle, 
  History, 
  ShieldCheck, 
  MapPin, 
  Pencil,
  AlertTriangle,
  Loader2,
  Upload,
  X
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
import { Firm, Plant } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { useData } from "@/context/data-context";

export default function FirmsAndPlantsPage() {
  const { firms, setFirms, plants, setPlants } = useData();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("plants");
  const [isMounted, setIsMounted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Plant Form State
  const [plantDraft, setPlantDraft] = useState<Partial<Plant>>({ radius: 700 });
  const [editingPlantId, setEditingPlantId] = useState<string | null>(null);
  const [plantToRemove, setPlantToRemove] = useState<Plant | null>(null);

  // Firm Form State
  const [firmDraft, setFirmDraft] = useState<Partial<Firm>>({ units: [] });
  const [editingFirmId, setEditingFirmId] = useState<string | null>(null);
  const [firmToRemove, setFirmToRemove] = useState<Firm | null>(null);
  const [unitDraft, setUnitDraft] = useState({ name: '', address: '' });
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500 * 1024) {
      toast({
        variant: "destructive",
        title: "File too large",
        description: "Logo must be under 500KB."
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFirmDraft(prev => ({ ...prev, logo: reader.result as string }));
    };
    reader.onerror = () => {
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: "Could not read the image file."
      });
    };
    reader.readAsDataURL(file);
  };

  const handleRegisterPlant = () => {
    const isNameValid = !!plantDraft.name?.trim();
    const isFirmValid = !!plantDraft.firmId;
    const isLatValid = plantDraft.lat !== undefined && !isNaN(Number(plantDraft.lat));
    const isLngValid = plantDraft.lng !== undefined && !isNaN(Number(plantDraft.lng));

    if (!isNameValid || !isFirmValid || !isLatValid || !isLngValid) {
      toast({ 
        variant: "destructive", 
        title: "Missing Fields", 
        description: "Please fill all required plant details (Name, Firm, and Coordinates)." 
      });
      return;
    }

    setIsProcessing(true);
    try {
      if (editingPlantId) {
        setPlants(prev => prev.map(p => p.id === editingPlantId ? { ...p, ...plantDraft } as Plant : p));
        toast({ title: "Plant Updated", description: `${plantDraft.name} configuration saved.` });
        setEditingPlantId(null);
        setPlantDraft({ radius: 700 });
      } else {
        const newPlant: Plant = {
          id: Math.random().toString(36).substr(2, 9),
          name: plantDraft.name!,
          lat: Number(plantDraft.lat),
          lng: Number(plantDraft.lng),
          radius: Number(plantDraft.radius || 700),
          firmId: plantDraft.firmId!,
          active: true
        };
        setPlants(prev => [...prev, newPlant]);
        toast({ title: "Plant Registered", description: `${newPlant.name} is now live for geofencing.` });
        setPlantDraft({ 
          radius: 700, 
          firmId: plantDraft.firmId 
        });
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Registration Error", description: "Failed to save plant data." });
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
    if (!unitDraft.name.trim() || !unitDraft.address.trim()) {
      toast({ 
        variant: "destructive", 
        title: "Incomplete Unit", 
        description: "Both Unit Name and Address are required." 
      });
      return;
    }
    setFirmDraft(prev => ({
      ...prev,
      units: [...(prev.units || []), { id: Date.now().toString(), name: unitDraft.name, address: unitDraft.address }]
    }));
    setUnitDraft({ name: '', address: '' });
  };

  const handleRegisterFirm = () => {
    if (!firmDraft.name?.trim() || !firmDraft.gstin?.trim()) {
      toast({ variant: "destructive", title: "Validation Error", description: "Firm name and GSTIN are required." });
      return;
    }

    if (!firmDraft.units || firmDraft.units.length === 0) {
      toast({ variant: "destructive", title: "Missing Units", description: "At least one Unit Entity is mandatory." });
      return;
    }

    setIsProcessing(true);
    try {
      if (editingFirmId) {
        setFirms(prev => prev.map(f => f.id === editingFirmId ? { ...f, ...firmDraft } as Firm : f));
        toast({ title: "Firm Updated", description: `${firmDraft.name} record updated.` });
      } else {
        const newFirm: Firm = {
          id: Math.random().toString(36).substr(2, 9),
          name: firmDraft.name!,
          logo: firmDraft.logo,
          gstin: firmDraft.gstin!,
          pan: firmDraft.pan || '',
          pfNo: firmDraft.pfNo || '',
          esicNo: firmDraft.esicNo || '',
          bankName: firmDraft.bankName || '',
          accountNo: firmDraft.accountNo || '',
          ifscCode: firmDraft.ifscCode || '',
          units: firmDraft.units || []
        };
        setFirms(prev => [...prev, newFirm]);
        toast({ title: "Firm Registered", description: `${newFirm.name} added to repository.` });
      }
      setFirmDraft({ units: [] });
      setEditingFirmId(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveFirm = () => {
    if (!firmToRemove) return;
    setFirms(prev => prev.filter(f => f.id !== firmToRemove.id));
    setFirmToRemove(null);
    toast({ title: "Firm Removed", description: "The legal entity record has been deleted." });
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  if (!isMounted) return null;

  return (
    <div className="space-y-10 pb-20 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Infrastructure Setup</h1>
        <p className="text-muted-foreground">Configure your organizational structure, plants, and geofencing.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-10 bg-slate-100 p-1 rounded-xl h-12">
          <TabsTrigger value="plants" className="rounded-lg font-bold data-[state=active]:shadow-sm">Plants & Geofence</TabsTrigger>
          <TabsTrigger value="firms" className="rounded-lg font-bold data-[state=active]:shadow-sm">Firm Registration</TabsTrigger>
        </TabsList>

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
                  <Select 
                    value={plantDraft.firmId} 
                    onValueChange={(v) => setPlantDraft(p => ({...p, firmId: v}))}
                  >
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
                  <Label className="font-bold text-slate-400">Radius (Meters)</Label>
                  <Input value={plantDraft.radius || 700} disabled className="h-12 bg-slate-50 font-bold" />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold">Latitude *</Label>
                  <Input 
                    placeholder="28.5355" 
                    className="h-12 bg-white font-mono" 
                    type="number" 
                    step="any"
                    value={plantDraft.lat !== undefined ? plantDraft.lat : ''} 
                    onChange={(e) => {
                      const val = e.target.value === '' ? undefined : Number(e.target.value);
                      setPlantDraft(p => ({...p, lat: val}));
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold">Longitude *</Label>
                  <Input 
                    placeholder="77.2639" 
                    className="h-12 bg-white font-mono" 
                    type="number" 
                    step="any"
                    value={plantDraft.lng !== undefined ? plantDraft.lng : ''} 
                    onChange={(e) => {
                      const val = e.target.value === '' ? undefined : Number(e.target.value);
                      setPlantDraft(p => ({...p, lng: val}));
                    }}
                  />
                </div>
              </div>
              <div className="flex justify-end pt-4 gap-3">
                {editingPlantId && (
                  <Button variant="ghost" onClick={() => {
                    setEditingPlantId(null); 
                    setPlantDraft({ radius: 700 });
                  }}>
                    Cancel
                  </Button>
                )}
                <Button 
                  className="px-10 h-12 font-bold bg-primary text-lg rounded-xl shadow-lg shadow-primary/20" 
                  onClick={handleRegisterPlant}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Processing...</>
                  ) : (
                    editingPlantId ? 'Update Plant' : 'Register Plant'
                  )}
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
                    <TableHead className="font-bold text-center">Radius</TableHead>
                    <TableHead className="font-bold">Location (Lat, Lng)</TableHead>
                    <TableHead className="text-right font-bold pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plants.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">No plants registered yet.</TableCell>
                    </TableRow>
                  ) : (
                    plants.map((p) => (
                      <TableRow key={p.id} className="hover:bg-slate-50/50">
                        <TableCell className="font-medium">{firms.find(f => f.id === p.firmId)?.name || 'Unknown Firm'}</TableCell>
                        <TableCell className="font-bold">{p.name}</TableCell>
                        <TableCell className="text-center">{p.radius}m</TableCell>
                        <TableCell className="font-mono text-xs">{p.lat.toFixed(4)}, {p.lng.toFixed(4)}</TableCell>
                        <TableCell className="text-right pr-6">
                          <div className="flex justify-end gap-2">
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500" onClick={() => {
                              setEditingPlantId(p.id); 
                              setPlantDraft(p); 
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}>
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

        <TabsContent value="firms" className="space-y-12">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b">
              <CardTitle className="text-xl flex items-center gap-2">
                <Building2 className="w-6 h-6 text-primary" /> {editingFirmId ? 'Edit Firm Details' : 'Firm Details & Statutory Setup'}
              </CardTitle>
              <CardDescription>Setup legal entity and statutory compliance IDs.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-10">
              <div className="flex flex-col md:flex-row gap-8 items-start">
                <div className="space-y-2 w-full md:w-1/4">
                  <Label className="font-bold">Firm Logo</Label>
                  <div 
                    className="relative group cursor-pointer"
                    onClick={() => !firmDraft.logo && triggerFileUpload()}
                  >
                    <div className="w-full aspect-square bg-slate-100 rounded-2xl border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden transition-colors hover:bg-slate-200/50">
                      {firmDraft.logo ? (
                        <div className="relative w-full h-full">
                          <img src={firmDraft.logo} alt="Logo Preview" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Button 
                              type="button"
                              variant="destructive" 
                              size="sm" 
                              className="h-8 gap-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                setFirmDraft(prev => ({...prev, logo: undefined}));
                                if (fileInputRef.current) fileInputRef.current.value = "";
                              }}
                            >
                              <X className="w-3 h-3" /> Remove
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-slate-400 p-4 text-center">
                          <Upload className="w-8 h-8" />
                          <span className="text-xs font-medium">Upload (Max 500KB)</span>
                        </div>
                      )}
                    </div>
                    <input 
                      ref={fileInputRef}
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleLogoUpload}
                    />
                  </div>
                </div>

                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
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
                  <div className="space-y-2">
                    <Label className="font-bold">Bank Name</Label>
                    <Input 
                      className="h-12 bg-white" 
                      placeholder="e.g. HDFC Bank" 
                      value={firmDraft.bankName || ''} 
                      onChange={(e) => setFirmDraft(p => ({...p, bankName: e.target.value}))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold">Account Number</Label>
                    <Input 
                      className="h-12 bg-white" 
                      placeholder="Enter bank account number" 
                      value={firmDraft.accountNo || ''} 
                      onChange={(e) => setFirmDraft(p => ({...p, accountNo: e.target.value}))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold">IFSC Code</Label>
                    <Input 
                      className="h-12 bg-white uppercase" 
                      placeholder="HDFC0001234" 
                      value={firmDraft.ifscCode || ''} 
                      onChange={(e) => setFirmDraft(p => ({...p, ifscCode: e.target.value.toUpperCase()}))}
                    />
                  </div>
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
                  <Button variant="secondary" type="button" className="md:col-span-2 gap-2 font-bold h-11" onClick={addUnit}>
                    <PlusCircle className="w-4 h-4" /> Add Unit Entity
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(firmDraft.units || []).map((u, idx) => (
                    <div key={u.id || idx} className="flex justify-between items-center p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900">{u.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.address}</p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        type="button"
                        className="text-rose-500 hover:bg-rose-50 disabled:opacity-30 disabled:cursor-not-allowed" 
                        disabled={(firmDraft.units || []).length <= 1}
                        onClick={() => setFirmDraft(p => ({...p, units: (p.units || []).filter(x => x.id !== u.id)}))}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-4 gap-3">
                {editingFirmId && <Button variant="ghost" type="button" onClick={() => {setEditingFirmId(null); setFirmDraft({units: []});}}>Cancel</Button>}
                <Button className="px-10 h-12 font-bold bg-slate-900 text-white hover:bg-slate-800 text-lg rounded-xl shadow-xl" onClick={handleRegisterFirm} disabled={isProcessing}>
                  {isProcessing ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Finalizing...</> : editingFirmId ? 'Update Firm Details' : 'Finalize Firm Configuration'}
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
            
            <Card className="border-slate-200 overflow-hidden shadow-sm">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-bold">Firm Logo / Name</TableHead>
                    <TableHead className="font-bold">Units Name</TableHead>
                    <TableHead className="font-bold">GSTIN</TableHead>
                    <TableHead className="font-bold">PF Number</TableHead>
                    <TableHead className="font-bold">ESIC Number</TableHead>
                    <TableHead className="font-bold">Bank Name</TableHead>
                    <TableHead className="text-right font-bold pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {firms.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No firms registered yet.</TableCell>
                    </TableRow>
                  ) : (
                    firms.map((f) => (
                      <TableRow key={f.id} className="hover:bg-slate-50/50">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center overflow-hidden border border-blue-100">
                              {f.logo ? (
                                <img src={f.logo} alt={f.name} className="w-full h-full object-cover" />
                              ) : (
                                <Building2 className="w-5 h-5 text-blue-600" />
                              )}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-bold leading-tight">{f.name}</span>
                              <span className="text-[10px] text-muted-foreground font-mono">ID: {f.id}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {f.units.length > 0 ? f.units.map(u => (
                              <Badge key={u.id} variant="secondary" className="text-[10px] bg-slate-100 text-slate-600 border-none font-medium">
                                {u.name}
                              </Badge>
                            )) : <span className="text-xs text-muted-foreground">No Units</span>}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{f.gstin}</TableCell>
                        <TableCell className="font-mono text-xs">{f.pfNo || 'N/A'}</TableCell>
                        <TableCell className="font-mono text-xs">{f.esicNo || 'N/A'}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-xs font-bold">{f.bankName || 'N/A'}</span>
                            <span className="text-[10px] text-muted-foreground">{f.ifscCode}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <div className="flex justify-end gap-2">
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500" onClick={() => {setEditingFirmId(f.id); setFirmDraft(f); window.scrollTo({ top: 0, behavior: 'smooth' });}}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50" onClick={() => setFirmToRemove(f)}>
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

      {/* Remove Firm Confirmation Dialog */}
      <AlertDialog open={!!firmToRemove} onOpenChange={(open) => !open && setFirmToRemove(null)}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-rose-600" />
            </div>
            <AlertDialogTitle className="text-center text-xl">Confirm Firm Removal</AlertDialogTitle>
            <AlertDialogDescription className="text-center pt-2">
              Are you sure you want to remove <strong>{firmToRemove?.name}</strong>? This will permanently delete the statutory and banking record for this legal entity.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center gap-3 pt-6">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRemoveFirm}
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
