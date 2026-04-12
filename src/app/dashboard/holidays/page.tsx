"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableRow, 
  TableHead, 
  TableCell 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Trash2, 
  Info,
  PartyPopper,
  Sun
} from "lucide-react";
import { format } from "date-fns";
import { checkIfSunday, formatDate } from "@/lib/utils";

interface Holiday {
  id: string;
  date: string;
  name: string;
  type: "FESTIVAL" | "WEEKLY_OFF";
}

const INITIAL_HOLIDAYS: Holiday[] = [
  { id: "1", date: "2024-01-26", name: "Republic Day", type: "FESTIVAL" },
  { id: "2", date: "2024-08-15", name: "Independence Day", type: "FESTIVAL" },
  { id: "3", date: "2024-10-02", name: "Gandhi Jayanti", type: "FESTIVAL" },
  { id: "4", date: "2024-11-01", name: "Diwali", type: "FESTIVAL" },
];

export default function HolidaysPage() {
  const [holidays, setHolidays] = useState<Holiday[]>(INITIAL_HOLIDAYS);
  const [selectedDates, setSelectedDates] = useState<Date[] | undefined>([]);
  const [festivalName, setFestivalName] = useState("");
  const { toast } = useToast();

  const handleAddHolidays = () => {
    if (!festivalName.trim() || !selectedDates?.length) {
      toast({ 
        variant: "destructive", 
        title: "Missing Info", 
        description: "Please enter a festival name and select at least one date." 
      });
      return;
    }

    const newHolidays: Holiday[] = selectedDates.map(date => ({
      id: Math.random().toString(36).substr(2, 9),
      date: format(date, "yyyy-MM-dd"),
      name: festivalName,
      type: "FESTIVAL"
    }));

    setHolidays(prev => [...prev, ...newHolidays].sort((a, b) => a.date.localeCompare(b.date)));
    setFestivalName("");
    setSelectedDates([]);
    toast({ title: "Holidays Added", description: `${newHolidays.length} holiday(s) registered successfully.` });
  };

  const removeHoliday = (id: string) => {
    setHolidays(prev => prev.filter(h => h.id !== id));
    toast({ title: "Removed", description: "Holiday removed from the list." });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Holiday Management</h1>
          <p className="text-muted-foreground">Schedule festivals and manage plant-wide weekly offs.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Configuration Panel */}
        <Card className="lg:col-span-5 shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              Add Festival / Holidays
            </CardTitle>
            <CardDescription>Select one or more dates to mark as holidays.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="festivalName">Festival / Holiday Name</Label>
              <Input 
                id="festivalName" 
                placeholder="e.g. Diwali, Holi, Local Fair..." 
                value={festivalName}
                onChange={(e) => setFestivalName(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Select Dates</Label>
              <div className="border rounded-xl p-2 bg-slate-50/50 flex justify-center">
                <Calendar
                  mode="multiple"
                  selected={selectedDates}
                  onSelect={setSelectedDates}
                  className="rounded-md border-none"
                />
              </div>
              <p className="text-[10px] text-muted-foreground italic flex items-center gap-1">
                <Info className="w-3 h-3" /> Tip: You can select multiple consecutive dates for longer breaks.
              </p>
            </div>

            <Button className="w-full font-bold" onClick={handleAddHolidays}>
              Register Holidays
            </Button>
          </CardContent>
        </Card>

        {/* Holiday List */}
        <Card className="lg:col-span-7 shadow-sm border-slate-200 overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <CardTitle className="text-lg">Holiday Calendar 2024</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-bold">Date</TableHead>
                  <TableHead className="font-bold">Holiday Name</TableHead>
                  <TableHead className="font-bold">Type</TableHead>
                  <TableHead className="text-right font-bold">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holidays.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                      No holidays scheduled yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  holidays.map((h) => (
                    <TableRow key={h.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-medium">{formatDate(h.date)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {checkIfSunday(h.date) ? <Sun className="w-4 h-4 text-amber-500" /> : <PartyPopper className="w-4 h-4 text-primary" />}
                          {h.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={checkIfSunday(h.date) ? "text-amber-600 border-amber-200" : "text-primary border-primary/20"}>
                          {h.type === "FESTIVAL" ? "Festival" : "Sunday"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                          onClick={() => removeHoliday(h.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                <Info className="w-4 h-4 text-amber-600" />
             </div>
             <p className="text-xs text-slate-600 leading-relaxed">
               <strong>Note:</strong> Sundays are automatically identified by the attendance system. 
               Registering them here is optional but helpful for planning.
             </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
