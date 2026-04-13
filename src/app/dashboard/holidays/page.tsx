
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
  ChevronRight
} from "lucide-react";
import { 
  format, 
  eachDayOfInterval, 
  startOfYear, 
  endOfYear, 
  isSunday, 
  parseISO, 
  isSameDay,
  isSameMonth,
  startOfMonth,
  endOfMonth
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

  // Initialize with Sundays of the year
  useEffect(() => {
    const savedHolidays = localStorage.getItem('app_holidays');
    if (savedHolidays) {
      setHolidays(JSON.parse(savedHolidays));
      return;
    }

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
    
    setHolidays(sundays);
  }, [plants, currentMonth]);

  useEffect(() => {
    if (holidays.length > 0) {
      localStorage.setItem('app_holidays', JSON.stringify(holidays));
    }
  }, [holidays]);

  const handleDayClick = (date: Date) => {
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

  // Filter holidays for the currently viewed month
  const monthlyHolidays = useMemo(() => {
    return holidays.filter(h => isSameMonth(parseISO(h.date), currentMonth));
  }, [holidays, currentMonth]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 px-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Holiday Management</h1>
          <p className="text-muted-foreground">Manage festivals, weekly offs, and plant-specific holidays.</p>
        </div>
      </div>

      <Card className="shadow-2xl border-none overflow-hidden bg-white">
        <CardHeader className="bg-slate-50 border-b border-slate-100 p-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
              <CalendarDays className="w-7 h-7 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">Holiday Calendar {format(currentMonth, 'yyyy')}</CardTitle>
              <CardDescription>Click any date to schedule a custom holiday.</CardDescription>
            </div>
          </div>
        </CardHeader>
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
                  className="rounded-3xl border-2 border-slate-100 p-6 bg-white shadow-xl w-full"
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
                  components={{
                    DayContent: ({ date }) => {
                      return (
                        <div className="flex flex-col items-center justify-center h-full w-full relative">
                          <span className="z-10 text-sm font-semibold">{date.getDate()}</span>
                        </div>
                      );
                    }
                  }}
                />
                
                <div className="flex flex-wrap justify-center gap-6 pt-8">
                  <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    <div className="w-3 h-3 rounded-full bg-primary" /> Festival
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

            {/* Right Column: Monthly List */}
            <div className="lg:col-span-5 flex flex-col h-full border-t lg:border-t-0 lg:border-l border-slate-100 p-6 lg:pl-10">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" /> {format(currentMonth, 'MMMM')} Holidays
                </h3>
                <Badge variant="outline" className="font-black px-3">{monthlyHolidays.length} Days</Badge>
              </div>

              <ScrollArea className="flex-1 max-h-[500px] pr-4">
                <div className="space-y-4">
                  {monthlyHolidays.length === 0 ? (
                    <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                      <p className="text-slate-400 font-medium">No holidays for this month.</p>
                    </div>
                  ) : (
                    monthlyHolidays.map((h) => (
                      <div 
                        key={h.id} 
                        className={cn(
                          "group p-5 rounded-2xl border flex items-center justify-between transition-all hover:shadow-md",
                          h.auto ? "bg-slate-50 border-slate-100" : "bg-white border-primary/20 shadow-sm"
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center shadow-inner",
                            h.auto ? "bg-slate-200" : "bg-primary/10"
                          )}>
                            {h.auto ? (
                              <Sun className="w-5 h-5 text-slate-500" />
                            ) : (
                              <PartyPopper className="w-5 h-5 text-primary" />
                            )}
                          </div>
                          <div>
                            <p className="font-black text-sm text-slate-900 uppercase tracking-tight">{h.name}</p>
                            <p className="text-xs text-muted-foreground font-bold">{format(parseISO(h.date), 'dd MMM yyyy (EEEE)')}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant={h.auto ? "outline" : "default"} className="text-[10px] font-black">
                            {h.auto ? "WEEKLY OFF" : "FESTIVAL"}
                          </Badge>
                          {!h.auto && h.plantIds && (
                            <span className="text-[9px] font-bold text-muted-foreground">
                              {h.plantIds.length === plants.length ? "All Plants" : `${h.plantIds.length} Plants`}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
              
              {!isSameMonth(currentMonth, new Date()) && (
                <Button 
                  variant="ghost" 
                  className="mt-6 w-full text-primary font-bold gap-2"
                  onClick={() => setCurrentMonth(new Date())}
                >
                  Return to Current Month <ChevronRight className="w-4 h-4" />
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
