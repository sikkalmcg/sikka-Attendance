"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  CalendarDays,
  Sun,
  ShieldCheck
} from "lucide-react";
import { 
  format, 
  eachDayOfInterval, 
  startOfYear, 
  endOfYear, 
  isSunday, 
  parseISO, 
  isSameDay 
} from "date-fns";
import { cn } from "@/lib/utils";
import { Holiday } from "@/lib/types";

const CURRENT_YEAR = 2025;

export default function HolidaysPage() {
  const { toast } = useToast();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [festivalName, setFestivalName] = useState("");
  const [holidayType, setHolidayType] = useState<string>("FESTIVAL");
  const [selectedDates, setSelectedDates] = useState<Date[] | undefined>([]);

  // Initialize with Sundays of the year
  useEffect(() => {
    const start = startOfYear(new Date(CURRENT_YEAR, 0, 1));
    const end = endOfYear(new Date(CURRENT_YEAR, 11, 31));
    const days = eachDayOfInterval({ start, end });
    
    const sundays: Holiday[] = days
      .filter(d => isSunday(d))
      .map(d => ({
        id: `sun-${format(d, "yyyy-MM-dd")}`,
        date: format(d, "yyyy-MM-dd"),
        name: "Weekly Off",
        type: "WEEKLY_OFF",
        auto: true
      }));
    
    setHolidays(sundays);
  }, []);

  const handleAddHolidays = () => {
    if (!festivalName.trim()) {
      toast({ 
        variant: "destructive", 
        title: "Missing Name", 
        description: "Please enter a festival or holiday name." 
      });
      return;
    }
    if (!selectedDates || selectedDates.length === 0) {
      toast({ 
        variant: "destructive", 
        title: "No Dates", 
        description: "Please select at least one date from the calendar." 
      });
      return;
    }

    const updatedHolidays = [...holidays];
    let addedCount = 0;
    let conflictFound = false;

    for (const dateObj of selectedDates) {
      const dateStr = format(dateObj, "yyyy-MM-dd");
      
      const existingIndex = updatedHolidays.findIndex(h => h.date === dateStr);
      
      if (existingIndex !== -1) {
        const existing = updatedHolidays[existingIndex];
        // If it's a manual holiday (not auto Weekly Off), don't allow duplicate
        if (!existing.auto) {
           conflictFound = true;
           continue;
        }
        
        // Priority Rule: Festival overrides Auto Weekly Off
        updatedHolidays[existingIndex] = {
          id: Math.random().toString(36).substr(2, 9),
          date: dateStr,
          name: festivalName,
          type: holidayType as any,
          auto: false
        };
      } else {
        updatedHolidays.push({
          id: Math.random().toString(36).substr(2, 9),
          date: dateStr,
          name: festivalName,
          type: holidayType as any,
          auto: false
        });
      }
      addedCount++;
    }

    if (conflictFound) {
      toast({ 
        variant: "destructive", 
        title: "Holiday Conflict", 
        description: "Some dates already have manual holidays scheduled." 
      });
    }

    if (addedCount > 0) {
      setHolidays(updatedHolidays);
      setFestivalName("");
      setSelectedDates([]);
      toast({ title: "Holidays Registered", description: `${addedCount} date(s) updated in the calendar.` });
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Holiday Management</h1>
          <p className="text-muted-foreground">Schedule festivals and manage plant-wide weekly offs.</p>
        </div>
      </div>

      <Card className="shadow-xl border-slate-200 overflow-hidden">
        <CardHeader className="bg-slate-50 border-b border-slate-100 p-8 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
              <Plus className="w-8 h-8 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">Add Festival / Holidays</CardTitle>
              <CardDescription>Setup company holidays and festival schedules for {CURRENT_YEAR}.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-10">
          <div className="flex flex-col items-center space-y-12 max-w-4xl mx-auto">
            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <Label className="text-sm font-bold text-slate-700">Festival / Holiday Name</Label>
                <Input 
                  placeholder="e.g. Diwali, Holi, Republic Day..." 
                  className="h-14 text-lg bg-slate-50 border-slate-200 focus:bg-white transition-all"
                  value={festivalName}
                  onChange={(e) => setFestivalName(e.target.value)}
                />
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-bold text-slate-700">Holiday Type</Label>
                <Select value={holidayType} onValueChange={setHolidayType}>
                  <SelectTrigger className="h-14 bg-slate-50 border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FESTIVAL">Festival</SelectItem>
                    <SelectItem value="NATIONAL_HOLIDAY">National Holiday</SelectItem>
                    <SelectItem value="COMPANY_HOLIDAY">Company Holiday</SelectItem>
                    <SelectItem value="WEEKLY_OFF">Weekly Off</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="w-full space-y-4">
              <Label className="text-sm font-bold text-slate-700 flex items-center justify-center gap-2 mb-2">
                <CalendarDays className="w-5 h-5 text-primary" /> Select Holiday Dates
              </Label>
              <div className="border-2 border-slate-100 rounded-[2.5rem] p-10 bg-white shadow-inner flex justify-center">
                <Calendar
                  mode="multiple"
                  selected={selectedDates}
                  onSelect={setSelectedDates}
                  className="rounded-md"
                  initialFocus
                  defaultMonth={new Date(CURRENT_YEAR, 0)}
                  modifiers={{
                    sunday: (date) => isSunday(date),
                    holiday: (date) => holidays.some(h => isSameDay(parseISO(h.date), date) && !h.auto),
                    autoWeekly: (date) => holidays.some(h => isSameDay(parseISO(h.date), date) && h.auto)
                  }}
                  modifiersClassNames={{
                    sunday: "text-rose-500 font-black",
                    holiday: "bg-primary text-white hover:bg-primary/90 rounded-full font-bold",
                    autoWeekly: "bg-slate-100 text-slate-400 cursor-help"
                  }}
                />
              </div>
              <div className="flex flex-wrap justify-center gap-8 pt-6">
                <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  <div className="w-3 h-3 rounded-full bg-primary" /> Festival
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  <div className="w-3 h-3 rounded-full bg-slate-100" /> Weekly Off
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black text-rose-500 uppercase tracking-widest">
                  <Sun className="w-3 h-3" /> Sunday
                </div>
              </div>
            </div>

            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
              <div className="p-6 bg-blue-50/50 rounded-3xl border border-blue-100/50 space-y-3">
                <div className="flex items-center gap-2 text-primary">
                  <ShieldCheck className="w-4 h-4" />
                  <span className="text-xs font-black uppercase tracking-widest">Automation Rules</span>
                </div>
                <div className="text-xs text-slate-600 space-y-2 font-medium leading-relaxed">
                  <p>• <span className="text-rose-600 font-bold">Sundays</span> are auto-marked as Weekly Off.</p>
                  <p>• Adding a <span className="text-primary font-bold">Festival</span> on Sunday overrides auto-off.</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 justify-center">
                <Button 
                  className="w-full h-14 font-bold bg-primary shadow-lg shadow-primary/20 rounded-2xl text-lg" 
                  onClick={handleAddHolidays}
                >
                  Confirm & Add Holidays
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full h-12 font-bold rounded-xl text-slate-500" 
                  onClick={() => { setFestivalName(""); setSelectedDates([]); }}
                >
                  Clear Selection
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
