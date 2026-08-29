"use client";

import { useState, useMemo, useEffect } from "react";
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableRow, 
  TableHead, 
  TableCell 
} from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Tabs, 
  TabsList, 
  TabsTrigger, 
  TabsContent 
} from "@/components/ui/tabs";
import { 
  Search, 
  Smartphone, 
  History, 
  User as UserIcon,
  ShieldCheck, 
  Calendar, 
  Clock, 
  SmartphoneNfc, 
  CheckCircle2, 
  MonitorSmartphone,
  Bell,
  Send,
  Users,
  X,
  MessageSquare,
  AlertCircle,
  CheckCheck
} from "lucide-react";
import { useData } from "@/context/data-context";
import { formatDate, formatDateTime, cn } from "@/lib/utils";
import { format, parseISO, isValid } from "date-fns";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { AppNotification, Employee } from "@/lib/types";

export default function ActivityPage() {
  const { employees = [], notifications = [], addRecord, refreshData, verifiedUser } = useData();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<string>("notifications");
  const [isMounted, setIsMounted] = useState(false);

  // Hardware / Device Activity states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);

  // Notification Tab states
  const [notifSearchTerm, setNotifSearchTerm] = useState("");
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>([]);
  const [empModalSearch, setEmpModalSearch] = useState("");
  const [titleText, setTitleText] = useState("Message from Admin");
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Filtered active employees for device registry
  const filteredEmployees = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return (employees || [])
      .filter(emp => emp.active !== false)
      .filter(emp => 
        (emp.name || `${emp.firstName || ''} ${emp.lastName || ''}`).toLowerCase().includes(search) || 
        (emp.employeeId || "").toLowerCase().includes(search) || 
        (emp.deviceId || "").toLowerCase().includes(search) ||
        (emp.deviceName || "").toLowerCase().includes(search)
      );
  }, [employees, searchTerm]);

  // Active employees list for notification modal selection
  const activeEmployees = useMemo(() => {
    return (employees || []).filter(emp => emp.active !== false);
  }, [employees]);

  // Filtered employees inside the Send Notification modal
  const modalFilteredEmployees = useMemo(() => {
    const q = empModalSearch.toLowerCase().trim();
    if (!q) return activeEmployees;
    return activeEmployees.filter(emp => {
      const name = (emp.name || `${emp.firstName || ''} ${emp.lastName || ''}`).toLowerCase();
      const code = (emp.employeeId || "").toLowerCase();
      const dept = (emp.department || "").toLowerCase();
      return name.includes(q) || code.includes(q) || dept.includes(q);
    });
  }, [activeEmployees, empModalSearch]);

  // Live word counter calculation (Max 100 words)
  const wordCount = useMemo(() => {
    const clean = messageText.trim();
    if (!clean) return 0;
    return clean.split(/\s+/).filter(Boolean).length;
  }, [messageText]);

  const isWordCountExceeded = wordCount > 100;

  // Notification History: sort newest first
  const notificationHistory = useMemo(() => {
    return [...(notifications || [])].sort((a: any, b: any) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (timeA && timeB && timeA !== timeB) return timeB - timeA;
      return String(b.timestamp || "").localeCompare(String(a.timestamp || ""));
    });
  }, [notifications]);

  // Filtered Notification History for search
  const filteredNotificationHistory = useMemo(() => {
    const q = notifSearchTerm.toLowerCase().trim();
    if (!q) return notificationHistory;
    return notificationHistory.filter((n: any) => {
      const empName = String(n.employeeName || "").toLowerCase();
      const empId = String(n.employeeId || n.employee_id || "").toLowerCase();
      const msg = String(n.message || "").toLowerCase();
      const title = String(n.title || "").toLowerCase();
      const type = String(n.type || n.notificationType || n.notification_type || "").toLowerCase();
      const source = String(n.source || "").toLowerCase();
      const sender = String(n.senderUser || n.senderUserName || "").toLowerCase();
      const time = String(n.timestamp || n.notificationDateTime || "").toLowerCase();
      return (
        empName.includes(q) ||
        empId.includes(q) ||
        msg.includes(q) ||
        title.includes(q) ||
        type.includes(q) ||
        source.includes(q) ||
        sender.includes(q) ||
        time.includes(q)
      );
    });
  }, [notificationHistory, notifSearchTerm]);

  // Format Date & Time as 24-hour format: "29-Aug-2026 10:30"
  const formatNotificationDateTime = (timeStr: string | undefined): string => {
    if (!timeStr) return "N/A";
    const clean = String(timeStr).trim();
    // If already in "dd-MMM-yyyy HH:mm" or "dd-MMM-yyyy hh:mm a" format, return as is
    if (/^\d{2}-[A-Za-z]{3}-\d{4}/.test(clean)) {
      return clean;
    }
    try {
      const parsed = parseISO(clean);
      if (isValid(parsed)) {
        return format(parsed, "dd-MMM-yyyy HH:mm");
      }
      const d = new Date(clean);
      if (!isNaN(d.getTime())) {
        return format(d, "dd-MMM-yyyy HH:mm");
      }
    } catch {}
    return clean;
  };

  const getNotificationTypeBadge = (notif: any) => {
    const rawType = String(notif.notification_type || notif.notificationType || notif.type || '').toUpperCase();
    switch (rawType) {
      case 'DAY_MARK_IN_REMINDER':
      case 'DAY_IN_REMINDER':
        return (
          <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-bold text-[10px] uppercase px-2 py-0.5 shadow-none">
            Day Mark IN
          </Badge>
        );
      case 'DAY_MARK_OUT_REMINDER':
      case 'DAY_OUT_REMINDER':
        return (
          <Badge className="bg-orange-100 text-orange-900 border-orange-300 font-bold text-[10px] uppercase px-2 py-0.5 shadow-none">
            Day Mark OUT
          </Badge>
        );
      case 'NIGHT_MARK_IN_REMINDER':
      case 'NIGHT_IN_REMINDER':
        return (
          <Badge className="bg-indigo-100 text-indigo-900 border-indigo-300 font-bold text-[10px] uppercase px-2 py-0.5 shadow-none">
            Night Mark IN
          </Badge>
        );
      case 'NIGHT_MARK_OUT_REMINDER':
      case 'NIGHT_OUT_REMINDER':
        return (
          <Badge className="bg-purple-100 text-purple-900 border-purple-300 font-bold text-[10px] uppercase px-2 py-0.5 shadow-none">
            Night Mark OUT
          </Badge>
        );
      case 'ACTIVITY_MESSAGE':
      case 'CUSTOM_NOTIFICATION':
      default:
        return (
          <Badge className="bg-blue-100 text-blue-900 border-blue-300 font-bold text-[10px] uppercase px-2 py-0.5 shadow-none">
            Activity Message
          </Badge>
        );
    }
  };

  const getSourceBadge = (notif: any) => {
    const rawSource = String(notif.source || (notif.type?.includes('REMINDER') ? 'SYSTEM_SCHEDULER' : 'ACTIVITY_PAGE')).toUpperCase();
    if (rawSource === 'SYSTEM_SCHEDULER') {
      return (
        <Badge variant="outline" className="font-bold text-[10px] uppercase bg-slate-50 border-slate-300 text-slate-700 px-2 py-0.5">
          Scheduler
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="font-bold text-[10px] uppercase bg-purple-50 border-purple-300 text-purple-800 px-2 py-0.5">
        Activity Page
      </Badge>
    );
  };

  // Toggle individual employee selection
  const handleToggleEmployee = (empId: string) => {
    setSelectedEmpIds(prev => 
      prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]
    );
  };

  // Select all / Deselect all
  const handleSelectAll = () => {
    if (selectedEmpIds.length === modalFilteredEmployees.length) {
      setSelectedEmpIds([]);
    } else {
      const allIds = modalFilteredEmployees.map(e => e.employeeId || e.id);
      setSelectedEmpIds(Array.from(new Set([...selectedEmpIds, ...allIds])));
    }
  };

  // Remove individual chip
  const handleRemoveChip = (empId: string) => {
    setSelectedEmpIds(prev => prev.filter(id => id !== empId));
  };

  // Reset and close modal
  const handleCloseModal = () => {
    setIsSendModalOpen(false);
    setSelectedEmpIds([]);
    setTitleText("Message from Admin");
    setMessageText("");
    setEmpModalSearch("");
    setIsSending(false);
  };

  // Send Notification Handler
  const handleSendNotification = async () => {
    // 1. Validation
    if (selectedEmpIds.length === 0) {
      toast({
        variant: "destructive",
        title: "Employee Required",
        description: "Please select at least one employee to send the notification."
      });
      return;
    }

    if (!messageText.trim()) {
      toast({
        variant: "destructive",
        title: "Message Required",
        description: "Please enter a notification message."
      });
      return;
    }

    if (isWordCountExceeded) {
      toast({
        variant: "destructive",
        title: "Word Limit Exceeded",
        description: `Your message contains ${wordCount} words. Maximum allowed length is 100 words.`
      });
      return;
    }

    setIsSending(true);

    try {
      const senderName = verifiedUser?.fullName || (verifiedUser as any)?.name || verifiedUser?.username || "Admin";
      const senderId = verifiedUser?.id || "ADMIN";

      // Deduplicate selected IDs
      const uniqueSelectedIds = Array.from(new Set(selectedEmpIds));

      const res = await fetch("/api/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeIds: uniqueSelectedIds,
          title: titleText.trim() || "Message from Admin",
          message: messageText.trim(),
          senderUserId: senderId,
          senderUserName: senderName,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to send notification");
      }

      // Success feedback & cleanup
      toast({
        title: "Notification Sent",
        description: data.message || `Notification sent successfully to ${uniqueSelectedIds.length} employee(s).`
      });

      handleCloseModal();
      await refreshData();
    } catch (error: any) {
      console.error("Error sending notification:", error);
      toast({
        variant: "destructive",
        title: "Failed to Send",
        description: error?.message || "An error occurred while sending the notification."
      });
    } finally {
      setIsSending(false);
    }
  };

  // Read actual history for device dialog
  const getActualHistory = (emp: any) => {
    if (!emp || !emp.deviceHistory) return [];
    return [...emp.deviceHistory].reverse();
  };

  if (!isMounted) return null;

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
             <SmartphoneNfc className="w-8 h-8 text-primary" /> Activity Center
          </h1>
          <p className="text-muted-foreground text-sm font-medium mt-1 uppercase tracking-widest">
            Employee Security, Device Registry & Broadcast Notifications
          </p>
        </div>
      </div>

      {/* Tabs Layout */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-slate-100 p-1 rounded-2xl h-12 inline-flex border border-slate-200 shadow-sm">
          <TabsTrigger 
            value="notifications" 
            className="rounded-xl px-5 h-10 font-bold text-xs uppercase tracking-wider flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-md transition-all"
          >
            <Bell className="w-4 h-4 text-primary" /> Notification
          </TabsTrigger>
          <TabsTrigger 
            value="devices" 
            className="rounded-xl px-5 h-10 font-bold text-xs uppercase tracking-wider flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-md transition-all"
          >
            <Smartphone className="w-4 h-4 text-slate-500" /> Device Registry
          </TabsTrigger>
        </TabsList>

        {/* ========================================================= */}
        {/* TAB 1: NOTIFICATIONS (Send Notification & History)        */}
        {/* ========================================================= */}
        <TabsContent value="notifications" className="space-y-6 m-0">
          {/* Top Bar with Send Notification Button */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="relative flex-1 max-w-md w-full">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Search by employee, message, title, type, or date..." 
                className="pl-10 h-10 bg-slate-50 border-slate-200 rounded-xl text-sm focus-visible:ring-primary/20" 
                value={notifSearchTerm}
                onChange={(e) => setNotifSearchTerm(e.target.value)}
              />
            </div>

            {/* SEND NOTIFICATION BUTTON */}
            <Button
              type="button"
              onClick={() => setIsSendModalOpen(true)}
              className="h-10 px-5 rounded-xl font-black text-xs uppercase tracking-wider bg-slate-900 text-white hover:bg-primary transition-all shadow-md hover:shadow-lg flex items-center gap-2"
            >
              <Send className="w-4 h-4" /> Send Notification
            </Button>
          </div>

          {/* Notification History Table (Section 24) */}
          <Card className="border-slate-200 shadow-xl overflow-hidden rounded-2xl bg-white">
            <CardHeader className="bg-slate-50/80 border-b p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <History className="w-4 h-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900">Notification History</CardTitle>
                    <p className="text-xs text-slate-500 mt-0.5">Individual log of all employee notifications & attendance reminders (Newest first)</p>
                  </div>
                </div>
                <Badge variant="outline" className="font-mono text-xs font-bold bg-white border-slate-200 text-slate-700 px-3 py-1">
                  {filteredNotificationHistory.length} Record{filteredNotificationHistory.length === 1 ? '' : 's'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="w-full">
                <Table className="min-w-[1250px]">
                  <TableHeader className="bg-slate-50/50">
                    <TableRow>
                      <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-500 py-4 px-6 w-[200px]">
                        Employee
                      </TableHead>
                      <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-500 w-[140px]">
                        Notification Type
                      </TableHead>
                      <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-500">
                        Message
                      </TableHead>
                      <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-500 w-[170px]">
                        Date & Time
                      </TableHead>
                      <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-500 w-[120px]">
                        Source
                      </TableHead>
                      <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-500 w-[110px]">
                        Delivery
                      </TableHead>
                      <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-500 text-right pr-6 w-[100px]">
                        Read Status
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredNotificationHistory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-20 text-slate-400">
                          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                            <Bell className="w-6 h-6 text-slate-300" />
                          </div>
                          <p className="text-sm font-bold text-slate-600">No notification history found.</p>
                          <p className="text-xs text-slate-400 mt-1">Click &ldquo;Send Notification&rdquo; above to broadcast an update.</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredNotificationHistory.map((notif: any, index: number) => {
                        const notifId = notif.id || notif._id || `notif_${index}`;
                        const rawEmpId = notif.employeeId || notif.employee_id || '';
                        const empObj = employees.find(
                          e => e.employeeId === rawEmpId || e.id === rawEmpId
                        );
                        const displayName = notif.employeeName || empObj?.name || `${empObj?.firstName || ''} ${empObj?.lastName || ''}`.trim() || rawEmpId || "Selected Employee";
                        const displayEmpId = rawEmpId || empObj?.employeeId || "EMP";
                        const isRead = Boolean(notif.isRead || notif.read || notif.readStatus === 'READ' || notif.read_status === 'READ');
                        const isOpened = Boolean(notif.openedAt || notif.opened_at || notif.readStatus === 'OPENED' || notif.read_status === 'OPENED');
                        const pushDelivered = Boolean(
                          notif.pushSent || 
                          notif.deliveryStatus === 'DELIVERED' || 
                          notif.delivery_status === 'DELIVERED' || 
                          notif.delivery_status === 'sent' || 
                          notif.status === 'sent'
                        );

                        return (
                          <TableRow key={notifId} className="hover:bg-slate-50/60 transition-colors">
                            {/* 1. Employee Column */}
                            <TableCell className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-900 text-sm">{displayName}</span>
                                <span className="text-[10px] font-mono font-bold text-primary uppercase tracking-tight">
                                  {displayEmpId}
                                </span>
                              </div>
                            </TableCell>

                            {/* 2. Notification Type Column (Section 24) */}
                            <TableCell className="py-4">
                              {getNotificationTypeBadge(notif)}
                            </TableCell>

                            {/* 3. Message Column */}
                            <TableCell className="py-4">
                              <div className="space-y-0.5 max-w-xl">
                                {notif.title && (
                                  <p className="text-xs font-bold text-slate-900 leading-tight">
                                    {notif.title}
                                  </p>
                                )}
                                <p className="text-xs text-slate-700 leading-relaxed font-medium whitespace-pre-line">
                                  {notif.message}
                                </p>
                              </div>
                            </TableCell>

                            {/* 4. Date & Time Column (24-hour format) */}
                            <TableCell className="py-4 font-mono text-xs font-semibold text-slate-700">
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>{formatNotificationDateTime(notif.notificationDateTime || notif.timestamp || notif.createdAt || notif.sentAt)}</span>
                              </div>
                            </TableCell>

                            {/* 5. Source Column (Section 24) */}
                            <TableCell className="py-4">
                              {getSourceBadge(notif)}
                            </TableCell>

                            {/* 6. Delivery Status Column (Section 24) */}
                            <TableCell className="py-4">
                              {pushDelivered ? (
                                <Badge className="bg-emerald-100 text-emerald-800 border-none font-bold text-[10px] px-2 py-0.5">
                                  Delivered
                                </Badge>
                              ) : (
                                <Badge className="bg-slate-100 text-slate-700 border-none font-bold text-[10px] px-2 py-0.5">
                                  Saved
                                </Badge>
                              )}
                            </TableCell>

                            {/* 7. Read Status Column (Section 24) */}
                            <TableCell className="text-right pr-6 py-4">
                              {isOpened || isRead ? (
                                <Badge className="bg-blue-100 text-blue-800 border-none font-bold text-[10px] px-2 py-0.5">
                                  {isOpened ? 'Opened' : 'Read'}
                                </Badge>
                              ) : (
                                <Badge className="bg-amber-50 text-amber-700 border border-amber-200 font-bold text-[10px] px-2 py-0.5">
                                  Unread
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================= */}
        {/* TAB 2: DEVICE REGISTRY & HARDWARE ACTIVITY                */}
        {/* ========================================================= */}
        <TabsContent value="devices" className="space-y-6 m-0">
          <Card className="border-slate-200 shadow-xl overflow-hidden rounded-2xl bg-white">
            <CardHeader className="bg-slate-50 border-b p-4">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search by name, ID or hardware..." 
                  className="pl-10 h-10 bg-white border-slate-200 rounded-xl" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="w-full">
                <Table className="min-w-[1200px]">
                  <TableHeader className="bg-slate-50/50">
                    <TableRow>
                      <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-500 py-5 px-6">Employee Name / ID</TableHead>
                      <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-500">Department / Designation</TableHead>
                      <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-500">Device Name</TableHead>
                      <TableHead className="font-black uppercase text-[10px] tracking-widest text-primary">Current Device ID</TableHead>
                      <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-500">Active From Date</TableHead>
                      <TableHead className="text-right font-black uppercase text-[10px] tracking-widest text-slate-500 pr-6">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEmployees.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-20 text-muted-foreground font-bold">No active hardware records found.</TableCell></TableRow>
                    ) : (
                      filteredEmployees.map((emp) => (
                        <TableRow key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                          <TableCell className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-900 uppercase text-sm">{emp.name}</span>
                              <span className="text-[10px] font-mono text-primary font-black uppercase tracking-tighter">{emp.employeeId}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-700">{emp.department}</span>
                              <span className="text-[10px] text-muted-foreground uppercase font-medium">{emp.designation}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                               <MonitorSmartphone className="w-3.5 h-3.5 text-slate-400" />
                               <span className="text-xs font-bold text-slate-600 uppercase">{emp.deviceName || "Authorized Web Node"}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono text-[10px] font-black uppercase bg-white border-primary/20 text-primary px-3 py-1 shadow-sm">
                              {emp.deviceId || "NOT_SYNCED"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                               <Calendar className="w-3.5 h-3.5 text-slate-300" />
                               <span className="text-xs font-bold text-slate-600 uppercase">{formatDate(emp.joinDate)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            <Button 
                              variant="secondary" 
                              size="sm" 
                              className="h-9 gap-2 font-black text-[10px] uppercase bg-slate-900 text-white hover:bg-primary transition-all rounded-xl"
                              onClick={() => setSelectedEmployee(emp)}
                            >
                              <History className="w-3.5 h-3.5" /> History
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ========================================================= */}
      {/* SEND NOTIFICATION MODAL / DIALOG                          */}
      {/* ========================================================= */}
      <Dialog open={isSendModalOpen} onOpenChange={(open) => !open && handleCloseModal()}>
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden border-none shadow-2xl rounded-3xl bg-white max-h-[90vh] flex flex-col">
          <DialogHeader className="bg-slate-900 text-white p-6 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30 text-primary">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black uppercase tracking-tight">Send Notification</DialogTitle>
                <DialogDescription className="text-xs text-slate-300 font-medium mt-0.5">
                  Broadcast notification to selected employee devices and accounts
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-5 overflow-y-auto flex-1 bg-slate-50/50">
            {/* 1. EMPLOYEE SELECTION */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-primary" /> Select Employee(s) <span className="text-rose-500">*</span>
                </Label>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  {selectedEmpIds.length === modalFilteredEmployees.length && modalFilteredEmployees.length > 0
                    ? "Deselect All"
                    : `Select All (${modalFilteredEmployees.length})`}
                </button>
              </div>

              {/* Selected Chips Area */}
              {selectedEmpIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5 p-2 bg-white rounded-xl border border-slate-200 max-h-24 overflow-y-auto">
                  {selectedEmpIds.map(id => {
                    const emp = activeEmployees.find(e => e.employeeId === id || e.id === id);
                    const name = emp ? (emp.name || `${emp.firstName || ''} ${emp.lastName || ''}`.trim()) : id;
                    return (
                      <Badge
                        key={id}
                        variant="secondary"
                        className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium pl-2.5 pr-1.5 py-1 rounded-lg flex items-center gap-1.5"
                      >
                        <span>{name}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveChip(id)}
                          className="hover:bg-slate-300 rounded-full p-0.5 text-slate-500 hover:text-slate-900"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}

              {/* Search input for employee list */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="Search by name, ID, or department..."
                  value={empModalSearch}
                  onChange={(e) => setEmpModalSearch(e.target.value)}
                  className="pl-9 h-9 text-xs bg-white rounded-xl border-slate-200"
                />
              </div>

              {/* Scrollable Checkbox List of Employees */}
              <div className="border border-slate-200 rounded-xl bg-white max-h-48 overflow-y-auto divide-y divide-slate-100">
                {modalFilteredEmployees.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">No matching employees found.</div>
                ) : (
                  modalFilteredEmployees.map(emp => {
                    const empId = emp.employeeId || emp.id;
                    const isSelected = selectedEmpIds.includes(empId);
                    const fullName = emp.name || `${emp.firstName || ''} ${emp.lastName || ''}`.trim();

                    return (
                      <div
                        key={emp.id}
                        onClick={() => handleToggleEmployee(empId)}
                        className={cn(
                          "flex items-center gap-3 px-3.5 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors",
                          isSelected && "bg-primary/5"
                        )}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleToggleEmployee(empId)}
                          className="rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 truncate">{fullName}</span>
                            <span className="text-[10px] font-mono text-primary font-bold">{emp.employeeId}</span>
                          </div>
                          <p className="text-[10px] text-slate-500 truncate">
                            {emp.department || "General"} {emp.designation ? `• ${emp.designation}` : ""}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Selected: <span className="font-bold text-slate-900">{selectedEmpIds.length}</span> of {activeEmployees.length} active employees
              </p>
            </div>

            {/* 2. NOTIFICATION TITLE (Section 3) */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-primary" /> Notification Title <span className="text-slate-400 font-normal">(Optional)</span>
              </Label>
              <Input
                placeholder="Enter notification title (e.g. Message from Admin / Team Notice)"
                value={titleText}
                onChange={(e) => setTitleText(e.target.value)}
                className="bg-white rounded-xl text-sm border-slate-200 focus-visible:ring-primary/20"
              />
            </div>

            {/* 3. NOTIFICATION MESSAGE */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-primary" /> Message <span className="text-rose-500">*</span>
                </Label>
                {/* Live Word Counter */}
                <span className={cn(
                  "text-xs font-mono font-bold",
                  isWordCountExceeded ? "text-rose-600 font-black" : (wordCount > 80 ? "text-amber-600" : "text-slate-500")
                )}>
                  {wordCount} / 100 Words
                </span>
              </div>

              <Textarea
                placeholder="Type your notification message here... (e.g. Please report to the warehouse office for the team briefing.)"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                rows={4}
                className={cn(
                  "bg-white rounded-xl text-sm border-slate-200 resize-none focus-visible:ring-primary/20",
                  isWordCountExceeded && "border-rose-500 focus-visible:ring-rose-500/20"
                )}
              />

              {isWordCountExceeded && (
                <div className="flex items-center gap-1.5 text-xs text-rose-600 font-semibold mt-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Message exceeds maximum limit of 100 words. Please shorten your message.</span>
                </div>
              )}
            </div>
          </div>

          {/* FOOTER BUTTONS: [ Send ] [ Cancel ] */}
          <DialogFooter className="p-4 sm:p-5 bg-white border-t flex items-center justify-end gap-3 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseModal}
              disabled={isSending}
              className="h-10 px-5 rounded-xl font-bold text-xs uppercase tracking-wider border-slate-200 hover:bg-slate-100"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSendNotification}
              disabled={isSending || selectedEmpIds.length === 0 || !messageText.trim() || isWordCountExceeded}
              className="h-10 px-6 rounded-xl font-black text-xs uppercase tracking-wider bg-slate-900 text-white hover:bg-primary transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
            >
              {isSending ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" /> Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" /> Send
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hardware Audit Trail Dialog (Existing) */}
      <Dialog open={!!selectedEmployee} onOpenChange={(o) => !o && setSelectedEmployee(null)}>
        <DialogContent className="sm:max-w-4xl p-0 overflow-hidden border-none shadow-2xl rounded-3xl bg-white">
          <DialogHeader className="bg-slate-900 text-white p-8 space-y-4 shrink-0">
             <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center border border-primary/30">
                   <ShieldCheck className="w-8 h-8 text-primary" />
                </div>
                <div className="flex-1">
                   <DialogTitle className="text-2xl font-black uppercase tracking-tight">{selectedEmployee?.name}</DialogTitle>
                   <p className="text-[11px] font-bold text-primary uppercase tracking-[0.2em] mt-1">Hardware Audit Trail & Session Logs</p>
                </div>
             </div>
             <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 pt-4 border-t border-white/10">
                <div>
                   <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Aadhaar Reference</Label>
                   <p className="text-sm font-mono font-bold mt-0.5">{selectedEmployee?.aadhaar || selectedEmployee?.aadhaarNumber || "N/A"}</p>
                </div>
                <div>
                   <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Mobile Contact</Label>
                   <p className="text-sm font-bold mt-0.5">{selectedEmployee?.mobile || selectedEmployee?.mobileNumber || "N/A"}</p>
                </div>
                <div className="hidden sm:block">
                   <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">System Role</Label>
                   <Badge className="bg-primary hover:bg-primary text-[10px] font-black uppercase block w-fit mt-0.5">EMPLOYEE</Badge>
                </div>
             </div>
          </DialogHeader>

          <div className="p-8 bg-slate-50/50">
             <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                   <Clock className="w-4 h-4" /> Activity Log (Actual Login Records)
                </h3>
                <Badge variant="outline" className="font-bold text-[10px] border-slate-200">System Records Only</Badge>
             </div>

             <Card className="border-slate-200 shadow-sm overflow-hidden rounded-2xl bg-white">
                <Table>
                   <TableHeader className="bg-white">
                      <TableRow>
                         <TableHead className="font-black text-[10px] uppercase tracking-tighter">From Date & Time</TableHead>
                         <TableHead className="font-black text-[10px] uppercase tracking-tighter">To Date & Time</TableHead>
                         <TableHead className="font-black text-[10px] uppercase tracking-tighter">Device Name</TableHead>
                         <TableHead className="font-black text-[10px] uppercase tracking-tighter">Device ID Login</TableHead>
                         <TableHead className="font-black text-[10px] uppercase tracking-tighter text-right">Status</TableHead>
                      </TableRow>
                   </TableHeader>
                   <TableBody>
                      {getActualHistory(selectedEmployee).length === 0 ? (
                         <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground font-bold italic">No hardware transition records found.</TableCell></TableRow>
                      ) : (
                         getActualHistory(selectedEmployee).map((log) => (
                           <TableRow key={log.id} className="hover:bg-slate-50 transition-colors">
                              <TableCell className="font-bold text-slate-700 text-xs py-4">{formatDateTime(log.from)}</TableCell>
                              <TableCell className="font-bold text-slate-700 text-xs py-4">
                                 {log.to === "Present" ? (
                                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none font-black text-[9px] px-2 uppercase">Active Now</Badge>
                                 ) : formatDateTime(log.to)}
                              </TableCell>
                              <TableCell className="font-bold text-slate-500 text-[10px] uppercase">
                                 {log.deviceName}
                              </TableCell>
                              <TableCell>
                                 <div className="flex items-center gap-2">
                                    <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                                    <span className="text-xs font-mono font-bold text-slate-500">{log.deviceId}</span>
                                 </div>
                              </TableCell>
                              <TableCell className="text-right">
                                 <CheckCircle2 className={cn("w-4 h-4 ml-auto", log.to === "Present" ? "text-emerald-500" : "text-slate-300")} />
                              </TableCell>
                           </TableRow>
                         ))
                      )}
                   </TableBody>
                </Table>
             </Card>
          </div>

          <DialogFooter className="p-6 bg-white border-t flex items-center justify-between">
             <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                Verified Infrastructure Node
             </div>
             <Button onClick={() => setSelectedEmployee(null)} className="h-11 px-8 rounded-xl font-black bg-slate-900 hover:bg-primary transition-all">Close History</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
