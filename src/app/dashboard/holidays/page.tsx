"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  CalendarDays,
  Sun,
  ShieldCheck,
  Building2,
  X
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
import { Holiday, Plant } from "@/lib/types";
import { useData } from "@/context/data-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

const CURRENT_YEAR = 2025;

export default function HolidaysPage() {
  const { toast } = useToast();
  const { plants } = useData();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  
  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [targetDate, setTargetDate] = useState<Date | null>(null);
  const [holidayName, setHolidayName] = useState("");
  const [selectedPlantIds, setSelectedPlantIds] = useState<string[]>([]);

  // Initialize with Sundays of the year
  useEffect(() => {
    const savedHolidays = localStorage.getItem('app_holidays');
    if (savedHolidays) {
      setHolidays(JSON.parse(savedHolidays));
      return;
    }

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
        auto: true,
        plantIds: plants.map(p => p.id) // Default all plants for weekly off
      }));
    
    setHolidays(sundays);
  }, [plants]);

  useEffect(() => {
    if (holidays.length > 0) {
      localStorage.setItem('app_holidays', JSON.stringify(holidays));
    }
  }, [holidays]);

  const handleDayClick = (date: Date) => {
    // Prevent selecting dates outside current year
    if (date.getFullYear() !== CURRENT_YEAR) return;

    const dateStr = format(date, "yyyy-MM-dd");
    const existing = holidays.find(h => h.date === dateStr && !h.auto);
    
    setTargetDate(date);
    setHolidayName(existing?.name || "");
    setSelectedPlantIds(existing?.plantIds || []);
    setIsDialogOpen(true);
  };

  const handlePostHoliday = () => {
    if (!targetDate) return;
    if (!holidayName.trim()) {
      toast({ variant: "destructive", title: "Missing Name", description: "Please enter a holiday name." });
      return;
    }

    const dateStr = format(targetDate, "yyyy-MM-dd");
    const newHoliday: Holiday = {
      id: Math.random().toString(36).substr(2, 9),
      date: dateStr,
      name: holidayName,
      type: 'FESTIVAL',
      plantIds: selectedPlantIds,
      auto: false
    };

    setHolidays(prev => {
      // Priority: Festival overrides any existing holiday (including auto weekly off)
      const filtered = prev.filter(h => h.date !== dateStr);
      return [...filtered, newHoliday];
    });

    setIsDialogOpen(false);
    toast({ title: "Holiday Posted", description: `${holidayName} scheduled for ${format(targetDate, "dd-MMM-yyyy")}` });
  };

  const togglePlant = (plantId: string) => {
    setSelectedPlantIds(prev => 
      prev.includes(plantId) 
        ? prev.filter(id => id !== plantId) 
        : [...prev, plantId]
    );
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight text-center sm:text-left">Holiday Management</h1>
          <p className="text-muted-foreground text-center sm:text-left">Click a date to schedule festivals or company holidays.</p>
        </div>
      </div>

      <Card className="shadow-xl border-slate-200 overflow-hidden bg-white">
        <CardHeader className="bg-slate-50 border-b border-slate-100 p-8 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
              <CalendarDays className="w-7 h-7 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">Holiday Calendar {CURRENT_YEAR}</CardTitle>
              <CardDescription>Select a date to manage location-specific holidays.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-10">
          <div className="flex justify-center">
            <Calendar
              mode="single"
              onDayClick={handleDayClick}
              className="rounded-3xl border-2 border-slate-100 p-4 sm:p-10 bg-white shadow-inner max-w-full"
              initialFocus
              defaultMonth={new Date(CURRENT_YEAR, 0)}
              modifiers={{
                sunday: (date) => isSunday(date),
                holiday: (date) => holidays.some(h => isSameDay(parseISO(h.date), date) && !h.auto),
                autoWeekly: (date) => holidays.some(h => isSameDay(parseISO(h.date), date) && h.auto)
              }}
              modifiersClassNames={{
                sunday: "text-rose-500 font-black",
                holiday: "bg-primary text-white hover:bg-primary/90 rounded-2xl font-bold",
                autoWeekly: "bg-slate-50 text-slate-400 cursor-help"
              }}
              components={{
                DayContent: ({ date }) => {
                  const dateStr = format(date, "yyyy-MM-dd");
                  const holiday = holidays.find(h => h.date === dateStr);
                  
                  return (
                    <div className="flex flex-col items-center justify-center h-full w-full relative group">
                      <span className="z-10">{date.getDate()}</span>
                      {holiday && (
                        <div className="hidden sm:flex flex-col items-center absolute -bottom-1 w-full overflow-hidden text-[8px] leading-tight px-1 text-center pointer-events-none">
                          <span className={cn(
                            "truncate w-full font-bold",
                            holiday.auto ? "text-slate-300" : "text-primary-foreground"
                          )}>
                            {holiday.name}
                          </span>
                          {!holiday.auto && holiday.plantIds && holiday.plantIds.length > 0 && (
                            <span className="truncate w-full text-white/70">
                              {holiday.plantIds.length === plants.length ? "All Plants" : `${holiday.plantIds.length} Plants`}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                }
              }}
            />
          </div>

          <div className="flex flex-wrap justify-center gap-8 pt-10 border-t mt-10">
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
              <div className="w-3 h-3 rounded-full bg-primary" /> Festival / Holiday
            </div>
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
              <div className="w-3 h-3 rounded-full bg-slate-50 border" /> Weekly Off
            </div>
            <div className="flex items-center gap-2 text-[10px] font-black text-rose-500 uppercase tracking-widest">
              <Sun className="w-3 h-3" /> Sunday
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Holiday Post Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary" />
              {targetDate ? format(targetDate, "dd-MMM-yyyy") : "Select Date"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label className="font-bold">Holiday Name</Label>
              <Input 
                placeholder="e.g. Diwali, Holi, Anniversary..." 
                value={holidayName} 
                onChange={(e) => setHolidayName(e.target.value)}
                className="h-12"
              />
            </div>

            <div className="space-y-3">
              <Label className="font-bold flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" /> Applicable Plants
              </Label>
              <Card className="border-slate-100 shadow-none">
                <ScrollArea className="h-[200px] p-4">
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2 pb-2 border-b">
                      <Checkbox 
                        id="select-all" 
                        checked={selectedPlantIds.length === plants.length}
                        onCheckedChange={(checked) => {
                          setSelectedPlantIds(checked ? plants.map(p => p.id) : []);
                        }}
                      />
                      <label htmlFor="select-all" className="text-sm font-bold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        Select All Plants
                      </label>
                    </div>
                    {plants.map((plant) => (
                      <div key={plant.id} className="flex items-center space-x-3">
                        <Checkbox 
                          id={plant.id} 
                          checked={selectedPlantIds.includes(plant.id)}
                          onCheckedChange={() => togglePlant(plant.id)}
                        />
                        <div className="grid gap-1 leading-none">
                          <label htmlFor={plant.id} className="text-sm font-medium leading-none">
                            {plant.name}
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </Card>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button className="bg-primary px-8 font-bold" onClick={handlePostHoliday}>Post Holiday</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
