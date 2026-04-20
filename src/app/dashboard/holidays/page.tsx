
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
  CalendarCheck,
  Pencil,
  Trash2,
  AlertTriangle
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
  isBefore,
  startOfMonth
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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const PROJECT_START_DATE = new Date(2026, 3, 1); // April 1, 2026

export default function HolidaysPage() {
  const { toast } = useToast();
  const { plants, holidays, addRecord, updateRecord, deleteRecord, setRecord } = useData();
  
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date() < PROJECT_START_DATE ? PROJECT_START_DATE : new Date());
  const [isMounted, setIsMounted] = useState(false);
  
  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [targetDate, setTargetDate] = useState<Date | null>(null);
  const [holidayName, setHolidayName] = useState("");
  const [selectedPlantIds, setSelectedPlantIds] = useState<string[]>([]);
  const [editingHolidayId, setEditingHolidayId] = useState<string | null>(null);

  // Delete Alert State
  const [holidayToDelete, setHolidayToDelete] = useState<Holiday | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Auto-generate Sundays for current year - Optimized to prevent infinite loop
  useEffect(() => {
    if (!isMounted || plants.length === 0) return;
    
    const year = currentMonth.getFullYear();
    const start = startOfYear(new Date(year, 0, 1));
    const end = endOfYear(new Date(year, 11, 31));
    const days = eachDayOfInterval({ start, end });
    
    const allPlantIds = plants.map(p => p.id);
    
    days
      .filter(d => isSunday(d) && !isBefore(d, PROJECT_START_DATE))
      .forEach(d => {
        const dateStr = format(d, "yyyy-MM-dd");
        const id = `sun-${dateStr}`;
        if (!holidays.some(h => h.date === dateStr)) {
          setRecord('holidays', id, {
            id,
            date: dateStr,
            name: "Weekly Off",
            type: "WEEKLY_OFF",
            auto: true,
            plantIds: allPlantIds
          });
        }
      });
  }, [plants.length, currentMonth.getFullYear(), holidays.length, isMounted]);

  const handleDayClick = (date: Date) => {
    // RESTRICTION: No holidays before project start
    if (isBefore(date, PROJECT_START_DATE)) {
      toast({ variant: "destructive", title: "Access Denied", description: "Project boundary is April-2026." });
      return;
    }

    if (isSunday(date)) {
      toast({ title: "Weekly Off", description: "Sundays are automatically marked as Weekly Off." });
      return;
    }
    const dateStr = format(date, "yyyy-MM-dd");
    const existing = holidays.find(h => h.date === dateStr && !h.auto);
    
    setTargetDate(date);
    if (existing) {
      setEditingHolidayId(existing.id);
      setHolidayName(existing.name);
      setSelectedPlantIds(existing.plantIds || plants.map(p => p.id));
    } else {
      setEditingHolidayId(null);
      setHolidayName("");
      setSelectedPlantIds(plants.map(p => p.id));
    }
    setIsDialogOpen(true);
  };

  const handleEditHoliday = (h: Holiday) => {
    setTargetDate(parseISO(h.date));
    setEditingHolidayId(h.id);
    setHolidayName(h.name);
    setSelectedPlantIds(h.plantIds || plants.map(p => p.id));
    setIsDialogOpen(true);
  };

  const handlePostHoliday = () => {
    if (!targetDate) return;
    if (!holidayName.trim()) {
      toast({ variant: "destructive", title: "Missing Name", description: "Please enter a holiday name." });
      return;
    }

    const dateStr = format(targetDate, "yyyy-MM-dd");
    
    if (editingHolidayId) {
      updateRecord('holidays', editingHolidayId, { 
        name: holidayName, 
        plantIds: selectedPlantIds 
      });
      toast({ title: "Holiday Updated" });
    } else {
      const newHoliday = {
        date: dateStr,
        name: holidayName,
        type: 'FESTIVAL',
        plantIds: selectedPlantIds,
        auto: false
      };
      addRecord('holidays', newHoliday);
      toast({ title: "Holiday Posted", description: `${holidayName} scheduled.` });
    }

    setIsDialogOpen(false);
  };

  const handleDeleteHoliday = () => {
    if (!holidayToDelete) return;
    deleteRecord('holidays', holidayToDelete.id);
    setHolidayToDelete(null);
    toast({ variant: "destructive", title: "Holiday Deleted", description: "The festival record has been removed." });
  };

  const togglePlant = (plantId: string) => {
    setSelectedPlantIds(prev => 
      prev.includes(plantId) 
        ? prev.filter(id => id !== plantId) 
        : [...prev, plantId]
    );
  };

  const monthlyData = useMemo(() => {
    if (!isMounted) return { custom: [], weeklyOffs: [], total: 0 };
    const currentItems = holidays.filter(h => isSameMonth(parseISO(h.date), currentMonth));
    return {
      custom: currentItems.filter(h => !h.auto),
      weeklyOffs: currentItems.filter(h => h.auto),
      total: currentItems.length
    };
  }, [holidays, currentMonth, isMounted]);

  if (!isMounted) return null;

  return (
    <TooltipProvider>
      <div className="space-y-6 max-w-7xl mx-auto pb-12 px-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
              <CalendarCheck className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Holiday Calendar {format(currentMonth, 'yyyy')}</h1>
              <p className="text-muted-foreground">Manage organization schedule (April-2026 onwards).</p>
            </div>
          </div>
        </div>

        <Card className="shadow-2xl border-none overflow-hidden bg-white">
          <CardContent className="p-0 lg:p-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              <div className="lg:col-span-7 flex justify-center p-6 lg:p-0">
                <div className="w-full max-w-md">
                  <Calendar
                    mode="single"
                    onDayClick={handleDayClick}
                    month={currentMonth}
                    onMonthChange={(m) => {
                      if (!isBefore(startOfMonth(m), startOfMonth(PROJECT_START_DATE))) {
                        setCurrentMonth(m);
                      } else {
                        setCurrentMonth(PROJECT_START_DATE);
                      }
                    }}
                    className="rounded-3xl border-2 border-slate-100 p-8 bg-white shadow-xl w-full"
                    modifiers={{
                      sunday: (date) => isSunday(date),
                      holiday: (date) => holidays.some(h => isSameDay(parseISO(h.date), date) && !h.auto),
                      autoWeekly: (date) => holidays.some(h => isSameDay(parseISO(h.date), date) && h.auto),
                      restricted: (date) => isBefore(date, PROJECT_START_DATE)
                    }}
                    modifiersClassNames={{
                      sunday: "text-rose-500 font-black",
                      holiday: "bg-primary text-white hover:bg-primary/90 rounded-2xl font-bold",
                      autoWeekly: "bg-slate-50 text-slate-400 cursor-help rounded-xl",
                      restricted: "opacity-20 pointer-events-none grayscale"
                    }}
                  />
                </div>
              </div>

              <div className="lg:col-span-5 flex flex-col h-full border-t lg:border-t-0 lg:border-l border-slate-100 p-6 lg:pl-10">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                    <Clock className="w-6 h-6 text-primary" /> {format(currentMonth, 'MMMM')} Holidays
                  </h3>
                  <Badge variant="outline" className="font-black px-4 py-1 rounded-full bg-slate-50">{monthlyData.total} Days</Badge>
                </div>

                <ScrollArea className="flex-1 max-h-[600px] pr-4">
                  <div className="space-y-10">
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
                          <div key={h.id} className="p-5 rounded-2xl border-2 border-primary/20 bg-white shadow-sm flex items-center justify-between group transition-all hover:shadow-md relative overflow-hidden">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                <PartyPopper className="w-5 h-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-black text-sm text-slate-900 uppercase tracking-tight">{h.name}</p>
                                <p className="text-xs text-muted-foreground font-bold">{format(parseISO(h.date), 'dd MMM (EEEE)')}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 mr-2">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-primary" onClick={() => handleEditHoliday(h)}>
                                      <Pencil className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Edit Holiday</TooltipContent>
                                </Tooltip>
                                
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-rose-500" onClick={() => setHolidayToDelete(h)}>
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Remove Festival</TooltipContent>
                                </Tooltip>
                              </div>
                              <Badge className="bg-primary hover:bg-primary font-black text-[9px] uppercase shrink-0">Festival</Badge>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

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
              </div>
            </div>
          </CardContent>
        </Card>

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
                  placeholder="e.g. Diwali, Holi..." 
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
                  {plants.map((plant) => (
                    <div key={plant.id} className="flex items-center space-x-3">
                      <Checkbox id={plant.id} checked={selectedPlantIds.includes(plant.id)} onCheckedChange={() => togglePlant(plant.id)} />
                      <label htmlFor={plant.id} className="text-sm font-medium leading-none cursor-pointer">{plant.name}</label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter className="gap-3 sm:gap-0 mt-2">
              <Button variant="ghost" className="h-12 rounded-2xl font-bold" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button className="bg-primary px-10 h-12 rounded-2xl font-black shadow-lg shadow-primary/20" onClick={handlePostHoliday}>
                {editingHolidayId ? "Update" : "Confirm"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!holidayToDelete} onOpenChange={(open) => !open && setHolidayToDelete(null)}>
          <AlertDialogContent className="sm:max-w-md">
            <AlertDialogHeader>
              <div className="mx-auto w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6 text-rose-600" />
              </div>
              <AlertDialogTitle className="text-center text-xl">Confirm Removal</AlertDialogTitle>
              <AlertDialogDescription className="text-center pt-2">
                Are you sure you want to remove <strong>{holidayToDelete?.name}</strong>?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="sm:justify-center gap-3 pt-6">
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteHoliday} className="bg-rose-600 hover:bg-rose-700 font-bold">Confirm</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
