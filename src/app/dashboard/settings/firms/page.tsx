
"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Plus, Factory, Building2, MapPin, ShieldCheck, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function FirmsAndPlantsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("firms");

  const [firms, setFirms] = useState([
    { id: "1", name: "Sikka Industries Ltd.", gstin: "07AAAAA0000A1Z5", pan: "AAAAA0000A", pfNo: "DL/CPM/0012345", esicNo: "11000123450011001" },
  ]);

  const [plants, setPlants] = useState([
    { id: "1", name: "Okhla Phase III Plant", lat: 28.5355, lng: 77.2639, radius: 700 },
    { id: "2", name: "Gurgaon Sector 18", lat: 28.4595, lng: 77.0266, radius: 500 },
  ]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Plants & Firms</h1>
          <p className="text-muted-foreground">Manage your organizational structure and statutory details.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-8">
          <TabsTrigger value="firms" className="font-semibold">Firms (Legal Entities)</TabsTrigger>
          <TabsTrigger value="plants" className="font-semibold">Plants (Locations)</TabsTrigger>
        </TabsList>

        <TabsContent value="firms">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1 shadow-sm border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" />
                  Register New Firm
                </CardTitle>
                <CardDescription>Add a new legal entity with GST and statutory numbers.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Firm Name</Label>
                  <Input placeholder="e.g. Sikka Logistics Pvt Ltd" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>GSTIN</Label>
                    <Input placeholder="15 digits" />
                  </div>
                  <div className="space-y-2">
                    <Label>PAN</Label>
                    <Input placeholder="10 digits" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>PF Code</Label>
                  <Input placeholder="Region/Office/Code" />
                </div>
                <div className="space-y-2">
                  <Label>ESIC Number</Label>
                  <Input placeholder="17 digits" />
                </div>
                <Button className="w-full font-bold">Add Firm</Button>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2 shadow-sm border-slate-200 overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b">
                <CardTitle className="text-lg">Registered Firms</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Firm Name</TableHead>
                      <TableHead>GSTIN / PAN</TableHead>
                      <TableHead>Statutory ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {firms.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell className="font-bold">{f.name}</TableCell>
                        <TableCell>
                          <div className="text-xs space-y-1">
                            <p><span className="text-muted-foreground">GST:</span> {f.gstin}</p>
                            <p><span className="text-muted-foreground">PAN:</span> {f.pan}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs space-y-1">
                            <p><span className="text-muted-foreground">PF:</span> {f.pfNo}</p>
                            <p><span className="text-muted-foreground">ESIC:</span> {f.esicNo}</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="plants">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1 shadow-sm border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Factory className="w-5 h-5 text-primary" />
                  Define New Plant
                </CardTitle>
                <CardDescription>Setup GPS geofencing for attendance verification.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Plant Name</Label>
                  <Input placeholder="e.g. Noida Warehouse" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Latitude</Label>
                    <Input placeholder="e.g. 28.1234" />
                  </div>
                  <div className="space-y-2">
                    <Label>Longitude</Label>
                    <Input placeholder="e.g. 77.1234" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Validation Radius (Meters)</Label>
                  <Input type="number" defaultValue="700" />
                </div>
                <Button className="w-full font-bold">Save Plant</Button>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2 shadow-sm border-slate-200 overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b">
                <CardTitle className="text-lg">Plant Locations</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Plant Name</TableHead>
                      <TableHead>GPS Coordinates</TableHead>
                      <TableHead>Radius</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plants.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-bold">{p.name}</TableCell>
                        <TableCell className="font-mono text-xs">{p.lat}, {p.lng}</TableCell>
                        <TableCell>{p.radius}m</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="text-primary h-8 gap-1">
                            <MapPin className="w-3 h-3" /> View Map
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
