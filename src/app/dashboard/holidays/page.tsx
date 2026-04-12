"use client";

import { useState, useMemo } from "react";
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

export default function HolidaysPage() {
  const currentYear = 2025; // Setting to 2025 for actual accurate festival logic
  
  const INITIAL_HOLIDAYS: Holiday[] = useMemo(() => [
    { id: "1", date: `${currentYear}-01-26`, name: "Republic Day", type: "WEEKLY_OFF" }, // Sunday in 2025
    { id: "2", date: `${currentYear}-03-14`, name: "Holi", type: "FESTIVAL" },
    { id: "3", date: `${currentYear}-08-15`, name: "Independence Day", type: "FESTIVAL" },
    { id: "4", date: `${currentYear}-08-09`, name: "Raksha Bandhan", type: "FESTIVAL" },
    { id: "5", date: `${currentYear}-08-16`, name: "Janmashtami", type: "FESTIVAL" },
    { id: "6", date: `${currentYear}-10-02`, name: "Gandhi Jayanti / Dussehra", type: "FESTIVAL" },
    { id: "7", date: `${currentYear}-10-20`, name: "Diwali", type: "FESTIVAL" },
  ].sort((a, b) => a.date.localeCompare(b.date)), [currentYear]);

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

    const newHolidays: Holiday[] = selectedDates.map(date => {
      const isSun = checkIfSunday(date);
      return {
        id: Math.random().toString(36).substr(2, 9),
        date: format(date, "yyyy-MM-dd"),
        name: festivalName,
        type: isSun ? "WEEKLY_OFF" : "FESTIVAL"
      };
    });

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
          <h1 className="text-2xl font-bold text-slate-900">Holiday Management</h1>
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
            <CardDescription>Select one or more dates to mark as holidays for {currentYear}.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="festivalName" className="font-bold">Festival / Holiday Name</Label>
              <Input 
                id="festivalName" 
                placeholder="e.g. Diwali, Holi, Local Fair..." 
                value={festivalName}
                onChange={(e) => setFestivalName(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label className="font-bold">Select Dates</Label>
              <div className="border rounded-xl p-4 bg-white flex justify-center shadow-sm">
                <Calendar
                  mode="multiple"
                  selected={selectedDates}
                  onSelect={setSelectedDates}
                  className="rounded-md"
                  initialFocus
                  defaultMonth={new Date(currentYear, 0)}
                />
              </div>
              <div className="flex items-start gap-2 p-3 bg-blue-50/50 rounded-lg border border-blue-100 mt-2">
                <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-slate-600 leading-normal">
                  You can select multiple dates. Use the navigation arrows to switch months.
                </p>
              </div>
            </div>

            <Button className="w-full font-bold h-11" onClick={handleAddHolidays}>
              Register Holidays
            </Button>
          </CardContent>
        </Card>

        {/* Holiday List */}
        <Card className="lg:col-span-7 shadow-sm border-slate-200 overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <CardTitle className="text-lg">Holiday Calendar {currentYear}</CardTitle>
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
                    <TableCell colSpan={4} className="text-center py-12 text-muted-foreground font-medium">
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
                          <span className="font-medium">{h.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={checkIfSunday(h.date) || h.type === "WEEKLY_OFF" ? "text-amber-600 border-amber-200" : "text-primary border-primary/20"}>
                          {checkIfSunday(h.date) || h.type === "WEEKLY_OFF" ? "Weekly Off" : "Festival"}
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
             <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <Info className="w-4 h-4 text-amber-600" />
             </div>
             <p className="text-xs text-slate-600 leading-relaxed">
               <strong>Note:</strong> Sundays are automatically identified by the attendance system. 
               Any log on Sunday or listed holidays will be marked as "Work on Holiday".
             </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
