
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
  CalendarDays,
  Sun,
  Building2,
  Clock,
  PartyPopper,
  ChevronRight,
  CalendarCheck
} from "lucide-react";
import { 
  format, 
  eachDayOfInterval, 
  startOfYear, 
  endOfYear, 
  isSunday, 
  parseISO, 
  isSameDay,
  isSameMonth
} from "date-fns";
import { cn } from "@/lib/utils";
import { Holiday } from "@/lib/types";
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

export default function HolidaysPage() {
  const { toast } = useToast();
  const { plants } = useData();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  
  // Track currently viewed month in calendar
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  
  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [targetDate, setTargetDate] = useState<Date | null>(null);
  const [holidayName, setHolidayName] = useState("");
  const [selectedPlantIds, setSelectedPlantIds] = useState<string[]>([]);

  // Load existing holidays and generate Sundays for current year
  useEffect(() => {
    const savedHolidays = localStorage.getItem('app_holidays');
    let baseHolidays: Holiday[] = savedHolidays ? JSON.parse(savedHolidays) : [];

    // Filter out old auto-generated Sundays to regenerate for current year if needed
    baseHolidays = baseHolidays.filter(h => !h.auto);

    const year = currentMonth.getFullYear();
    const start = startOfYear(new Date(year, 0, 1));
    const end = endOfYear(new Date(year, 11, 31));
    const days = eachDayOfInterval({ start, end });
    
    const sundays: Holiday[] = days
      .filter(d => isSunday(d))
      .map(d => ({
        id: `sun-${format(d, "yyyy-MM-dd")}`,
        date: format(d, "yyyy-MM-dd"),
        name: "Weekly Off",
        type: "WEEKLY_OFF",
        auto: true,
        plantIds: plants.map(p => p.id) 
      }));
    
    // Combine saved custom holidays with fresh Sundays
    setHolidays([...baseHolidays, ...sundays].sort((a, b) => a.date.localeCompare(b.date)));
  }, [plants, currentMonth.getFullYear()]);

  // Persist only custom holidays to localStorage
  useEffect(() => {
    if (holidays.length > 0) {
      const customOnly = holidays.filter(h => !h.auto);
      localStorage.setItem('app_holidays', JSON.stringify(customOnly));
    }
  }, [holidays]);

  const handleDayClick = (date: Date) => {
    if (isSunday(date)) {
      toast({ title: "Weekly Off", description: "Sundays are automatically marked as Weekly Off." });
      return;
    }
    const dateStr = format(date, "yyyy-MM-dd");
    const existing = holidays.find(h => h.date === dateStr && !h.auto);
    
    setTargetDate(date);
    setHolidayName(existing?.name || "");
    setSelectedPlantIds(existing?.plantIds || plants.map(p => p.id));
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
      const filtered = prev.filter(h => h.date !== dateStr);
      return [...filtered, newHoliday].sort((a, b) => a.date.localeCompare(b.date));
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

  // Grouped monthly holidays
  const monthlyData = useMemo(() => {
    const currentItems = holidays.filter(h => isSameMonth(parseISO(h.date), currentMonth));
    return {
      custom: currentItems.filter(h => !h.auto),
      weeklyOffs: currentItems.filter(h => h.auto),
      total: currentItems.length
    };
  }, [holidays, currentMonth]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 px-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
            <CalendarCheck className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Holiday Calendar {format(currentMonth, 'yyyy')}</h1>
            <p className="text-muted-foreground">Click any date to schedule a custom holiday.</p>
          </div>
        </div>
      </div>

      <Card className="shadow-2xl border-none overflow-hidden bg-white">
        <CardContent className="p-0 lg:p-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            
            {/* Left Column: Calendar */}
            <div className="lg:col-span-7 flex justify-center p-6 lg:p-0">
              <div className="w-full max-w-md">
                <Calendar
                  mode="single"
                  onDayClick={handleDayClick}
                  month={currentMonth}
                  onMonthChange={setCurrentMonth}
                  className="rounded-3xl border-2 border-slate-100 p-8 bg-white shadow-xl w-full"
                  modifiers={{
                    sunday: (date) => isSunday(date),
                    holiday: (date) => holidays.some(h => isSameDay(parseISO(h.date), date) && !h.auto),
                    autoWeekly: (date) => holidays.some(h => isSameDay(parseISO(h.date), date) && h.auto)
                  }}
                  modifiersClassNames={{
                    sunday: "text-rose-500 font-black",
                    holiday: "bg-primary text-white hover:bg-primary/90 rounded-2xl font-bold",
                    autoWeekly: "bg-slate-50 text-slate-400 cursor-help rounded-xl"
                  }}
                />
                
                <div className="flex flex-wrap justify-center gap-6 pt-10">
                  <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    <div className="w-3 h-3 rounded-full bg-primary" /> Custom Holiday
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    <div className="w-3 h-3 rounded-full bg-slate-50 border" /> Weekly Off
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-black text-rose-500 uppercase tracking-widest">
                    <Sun className="w-3 h-3" /> Sunday
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Holiday List Separated */}
            <div className="lg:col-span-5 flex flex-col h-full border-t lg:border-t-0 lg:border-l border-slate-100 p-6 lg:pl-10">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                  <Clock className="w-6 h-6 text-primary" /> {format(currentMonth, 'MMMM')} Holidays
                </h3>
                <Badge variant="outline" className="font-black px-4 py-1 rounded-full bg-slate-50">{monthlyData.total} Days</Badge>
              </div>

              <ScrollArea className="flex-1 max-h-[600px] pr-4">
                <div className="space-y-10">
                  {/* Custom Holidays Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <PartyPopper className="w-4 h-4 text-primary" />
                      <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest">Festivals & Events</h4>
                    </div>
                    {monthlyData.custom.length === 0 ? (
                      <div className="p-8 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 text-center">
                        <p className="text-slate-400 text-xs font-bold">No custom festivals added.</p>
                      </div>
                    ) : (
                      monthlyData.custom.map((h) => (
                        <div key={h.id} className="p-5 rounded-2xl border-2 border-primary/20 bg-white shadow-sm flex items-center justify-between group transition-all hover:shadow-md">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                              <PartyPopper className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-black text-sm text-slate-900 uppercase tracking-tight">{h.name}</p>
                              <p className="text-xs text-muted-foreground font-bold">{format(parseISO(h.date), 'dd MMM (EEEE)')}</p>
                            </div>
                          </div>
                          <Badge className="bg-primary hover:bg-primary font-black text-[9px] uppercase">Festival</Badge>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Weekly Offs Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Sun className="w-4 h-4 text-slate-400" />
                      <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest">Weekly Offs (Sundays)</h4>
                    </div>
                    <div className="space-y-2">
                      {monthlyData.weeklyOffs.map((h) => (
                        <div key={h.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Sun className="w-4 h-4 text-slate-300" />
                            <span className="text-sm font-bold text-slate-600">{format(parseISO(h.date), 'dd MMM yyyy')}</span>
                          </div>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Weekly Off</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>
              
              {!isSameMonth(currentMonth, new Date()) && (
                <Button 
                  variant="ghost" 
                  className="mt-10 w-full text-primary font-black gap-2 hover:bg-primary/5 h-12 rounded-2xl"
                  onClick={() => setCurrentMonth(new Date())}
                >
                  Go to Current Month <ChevronRight className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Holiday Post Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black flex items-center gap-3 text-slate-900">
              <CalendarDays className="w-6 h-6 text-primary" />
              {targetDate ? format(targetDate, "dd MMM yyyy") : "Select Date"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-6">
            <div className="space-y-2">
              <Label className="font-black text-slate-700">Festival Name</Label>
              <Input 
                placeholder="e.g. Diwali, Holi, Corporate Event..." 
                value={holidayName} 
                onChange={(e) => setHolidayName(e.target.value)}
                className="h-14 bg-slate-50 border-slate-200 rounded-2xl px-6 font-medium focus-visible:ring-primary"
              />
            </div>

            <div className="space-y-4">
              <Label className="font-black flex items-center gap-2 text-slate-700">
                <Building2 className="w-4 h-4 text-primary" /> Plant Eligibility
              </Label>
              <div className="p-4 bg-slate-50 rounded-2xl border-2 border-slate-100 max-h-48 overflow-auto space-y-3">
                <div className="flex items-center space-x-3 pb-2 border-b border-slate-200">
                  <Checkbox 
                    id="select-all" 
                    checked={selectedPlantIds.length === plants.length}
                    onCheckedChange={(checked) => {
                      setSelectedPlantIds(checked ? plants.map(p => p.id) : []);
                    }}
                  />
                  <label htmlFor="select-all" className="text-sm font-black leading-none cursor-pointer">
                    All Manufacturing Units
                  </label>
                </div>
                {plants.map((plant) => (
                  <div key={plant.id} className="flex items-center space-x-3">
                    <Checkbox 
                      id={plant.id} 
                      checked={selectedPlantIds.includes(plant.id)}
                      onCheckedChange={() => togglePlant(plant.id)}
                    />
                    <label htmlFor={plant.id} className="text-sm font-medium leading-none cursor-pointer">
                      {plant.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-3 sm:gap-0 mt-2">
            <Button variant="ghost" className="h-12 rounded-2xl font-bold" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button className="bg-primary px-10 h-12 rounded-2xl font-black shadow-lg shadow-primary/20" onClick={handlePostHoliday}>Confirm Holiday</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

