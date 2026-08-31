"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableRow, 
  TableHead, 
  TableCell 
} from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
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
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  RefreshCw
} from "lucide-react";
import { useData } from "@/context/data-context";
import { formatDate, formatDateTime, cn } from "@/lib/utils";
import { format, parseISO, isValid } from "date-fns";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { Employee } from "@/lib/types";

const PAGE_SIZE = 15;

export default function ActivityPage() {
  const { employees = [], verifiedUser, refreshData } = useData();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<string>("notifications");
  const [isMounted, setIsMounted] = useState(false);

  // ═════════════════════════════════════════════════════════════
  // 1. NOTIFICATIONS TAB (Server-Side Pagination)
  // ═════════════════════════════════════════════════════════════
  const [notifItems, setNotifItems] = useState<any[]>([]);
  const [notifPage, setNotifPage] = useState<number>(1);
  const [notifTotal, setNotifTotal] = useState<number>(0);
  const [notifTotalPages, setNotifTotalPages] = useState<number>(1);
  const [notifSearchTerm, setNotifSearchTerm] = useState<string>("");
  const [notifLoading, setNotifLoading] = useState<boolean>(false);
  const [jumpNotifPage, setJumpNotifPage] = useState<string>("1");

  // Send Notification Modal states
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>([]);
  const [empModalSearch, setEmpModalSearch] = useState("");
  const [titleText, setTitleText] = useState("Message from Admin");
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);

  // ═════════════════════════════════════════════════════════════
  // 2. DEVICE REGISTRY TAB (Server-Side Pagination)
  // ═════════════════════════════════════════════════════════════
  const [deviceItems, setDeviceItems] = useState<any[]>([]);
  const [devicePage, setDevicePage] = useState<number>(1);
  const [deviceTotal, setDeviceTotal] = useState<number>(0);
  const [deviceTotalPages, setDeviceTotalPages] = useState<number>(1);
  const [deviceSearchTerm, setDeviceSearchTerm] = useState<string>("");
  const [deviceLoading, setDeviceLoading] = useState<boolean>(false);
  const [jumpDevicePage, setJumpDevicePage] = useState<string>("1");
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [copiedTokenEndpoint, setCopiedTokenEndpoint] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Fetch paginated notifications from server
  const fetchNotifications = useCallback(async (page: number, search: string) => {
    setNotifLoading(true);
    try {
      const url = `/api/activity/notifications?page=${page}&limit=${PAGE_SIZE}&search=${encodeURIComponent(search)}`;
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setNotifItems(json.data || []);
        setNotifTotal(json.pagination?.total || 0);
        setNotifTotalPages(json.pagination?.totalPages || 1);
        setNotifPage(json.pagination?.page || page);
        setJumpNotifPage(String(json.pagination?.page || page));
      }
    } catch (e) {
      console.warn("Failed to fetch notifications:", e);
    } finally {
      setNotifLoading(false);
    }
  }, []);

  // Fetch paginated device registry from server
  const fetchDevices = useCallback(async (page: number, search: string) => {
    setDeviceLoading(true);
    try {
      const url = `/api/device-registry?page=${page}&limit=${PAGE_SIZE}&search=${encodeURIComponent(search)}`;
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setDeviceItems(json.data || []);
        setDeviceTotal(json.pagination?.total || 0);
        setDeviceTotalPages(json.pagination?.totalPages || 1);
        setDevicePage(json.pagination?.page || page);
        setJumpDevicePage(String(json.pagination?.page || page));
      }
    } catch (e) {
      console.warn("Failed to fetch device registry:", e);
    } finally {
      setDeviceLoading(false);
    }
  }, []);

  // Debounced search for Notifications
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchNotifications(1, notifSearchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [notifSearchTerm, fetchNotifications]);

  // Debounced search for Devices
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDevices(1, deviceSearchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [deviceSearchTerm, fetchDevices]);

  // Real-time Event Listener to automatically refresh without manual page reload
  useEffect(() => {
    const handleRealtime = (e: any) => {
      const detail = e?.detail;
      if (detail?.type === "notification_created" || detail?.type === "data_mutation") {
        fetchNotifications(notifPage, notifSearchTerm);
      }
      if (detail?.type === "device_registered" || detail?.type === "data_mutation") {
        fetchDevices(devicePage, deviceSearchTerm);
      }
    };

    window.addEventListener("sikka:realtime-event", handleRealtime);
    window.addEventListener("sikka:push-received", () => fetchNotifications(notifPage, notifSearchTerm));

    return () => {
      window.removeEventListener("sikka:realtime-event", handleRealtime);
    };
  }, [notifPage, notifSearchTerm, devicePage, deviceSearchTerm, fetchNotifications, fetchDevices]);

  // Jump page handlers
  const handleJumpNotifPage = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(jumpNotifPage, 10);
    if (!isNaN(p) && p >= 1 && p <= notifTotalPages) {
      fetchNotifications(p, notifSearchTerm);
    } else {
      setJumpNotifPage(String(notifPage));
    }
  };

  const handleJumpDevicePage = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(jumpDevicePage, 10);
    if (!isNaN(p) && p >= 1 && p <= deviceTotalPages) {
      fetchDevices(p, deviceSearchTerm);
    } else {
      setJumpDevicePage(String(devicePage));
    }
  };

  // Copy FCM / Subscription Reference to clipboard
  const handleCopyTokenRef = (tokenRef: string) => {
    if (!tokenRef) return;
    navigator.clipboard.writeText(tokenRef);
    setCopiedTokenEndpoint(tokenRef);
    toast({ title: "Copied to Clipboard", description: "Subscription Reference copied." });
    setTimeout(() => setCopiedTokenEndpoint(null), 2000);
  };

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

  // Format Date & Time as 24-hour format: "29-Aug-2026 10:30"
  const formatNotificationDateTime = (timeStr: string | undefined): string => {
    if (!timeStr) return "N/A";
    const clean = String(timeStr).trim();
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

      toast({
        title: "Notification Sent",
        description: data.message || `Notification sent successfully to ${uniqueSelectedIds.length} employee(s).`
      });

      handleCloseModal();
      fetchNotifications(1, notifSearchTerm);
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
    if (!emp) return [];
    if (emp.deviceHistory && Array.isArray(emp.deviceHistory)) {
      return [...emp.deviceHistory].reverse();
    }
    return [
      {
        id: "curr",
        from: emp.lastActiveAt || emp.lastTokenUpdated || new Date().toISOString(),
        to: "Present",
        deviceName: emp.deviceName || "Web Node",
        deviceId: emp.deviceId || emp.token || "Active Node",
      }
    ];
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
          {/* Top Bar with Search & Send Notification Button */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="relative flex-1 max-w-md w-full">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Search by employee, message, title, type..." 
                className="pl-10 h-10 bg-slate-50 border-slate-200 rounded-xl text-sm focus-visible:ring-primary/20" 
                value={notifSearchTerm}
                onChange={(e) => setNotifSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => fetchNotifications(notifPage, notifSearchTerm)}
                disabled={notifLoading}
                className="h-10 px-3.5 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100 gap-1.5 text-xs font-bold"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", notifLoading && "animate-spin")} /> Refresh
              </Button>
              <Button
                type="button"
                onClick={() => setIsSendModalOpen(true)}
                className="h-10 px-5 rounded-xl font-black text-xs uppercase tracking-wider bg-slate-900 text-white hover:bg-primary transition-all shadow-md hover:shadow-lg flex items-center gap-2"
              >
                <Send className="w-4 h-4" /> Send Notification
              </Button>
            </div>
          </div>

          {/* Notification History Table */}
          <Card className="border-slate-200 shadow-xl overflow-hidden rounded-2xl bg-white">
            <CardHeader className="bg-slate-50/80 border-b p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <History className="w-4 h-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900">Notification History</CardTitle>
                    <p className="text-xs text-slate-500 mt-0.5">Server-side paginated log of all employee notifications (15 per page)</p>
                  </div>
                </div>
                <Badge variant="outline" className="font-mono text-xs font-bold bg-white border-slate-200 text-slate-700 px-3 py-1">
                  {notifTotal} Total Record{notifTotal === 1 ? '' : 's'}
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
                    {notifLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-16 text-slate-400">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
                          <p className="text-xs font-bold uppercase tracking-wider">Loading notification records...</p>
                        </TableCell>
                      </TableRow>
                    ) : notifItems.length === 0 ? (
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
                      notifItems.map((notif: any, index: number) => {
                        const notifId = notif.id || notif._id || `notif_${index}`;
                        const rawEmpId = notif.employeeId || notif.employee_id || '';
                        const displayName = notif.employeeName || rawEmpId || "Selected Employee";
                        const displayEmpId = rawEmpId || "EMP";
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

                            {/* 2. Notification Type Column */}
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

                            {/* 5. Source Column */}
                            <TableCell className="py-4">
                              {getSourceBadge(notif)}
                            </TableCell>

                            {/* 6. Delivery Status Column */}
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

                            {/* 7. Read Status Column */}
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

            {/* SERVER-SIDE PAGINATION FOOTER CONTROLS */}
            <CardFooter className="bg-slate-50 border-t p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-500 font-medium">
                Showing {notifItems.length > 0 ? (notifPage - 1) * PAGE_SIZE + 1 : 0} to{" "}
                {Math.min(notifPage * PAGE_SIZE, notifTotal)} of {notifTotal} notifications
              </div>

              <div className="flex items-center gap-3">
                {/* Previous Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchNotifications(notifPage - 1, notifSearchTerm)}
                  disabled={notifPage <= 1 || notifLoading}
                  className="h-9 px-3 rounded-xl font-bold text-xs border-slate-200 gap-1.5"
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </Button>

                {/* Page Jump Input / Indicator */}
                <form onSubmit={handleJumpNotifPage} className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-600 font-medium">Page</span>
                  <Input
                    type="number"
                    min={1}
                    max={notifTotalPages}
                    value={jumpNotifPage}
                    onChange={(e) => setJumpNotifPage(e.target.value)}
                    className="h-9 w-14 text-center text-xs font-bold bg-white rounded-xl border-slate-200 px-1"
                  />
                  <span className="text-xs text-slate-600 font-medium">of {notifTotalPages}</span>
                </form>

                {/* Next Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchNotifications(notifPage + 1, notifSearchTerm)}
                  disabled={notifPage >= notifTotalPages || notifLoading}
                  className="h-9 px-3 rounded-xl font-bold text-xs border-slate-200 gap-1.5"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* ========================================================= */}
        {/* TAB 2: DEVICE REGISTRY & HARDWARE ACTIVITY                */}
        {/* ========================================================= */}
        <TabsContent value="devices" className="space-y-6 m-0">
          <Card className="border-slate-200 shadow-xl overflow-hidden rounded-2xl bg-white">
            <CardHeader className="bg-slate-50 border-b p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="relative max-w-md w-full">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search by name, ID, hardware, or endpoint..." 
                  className="pl-10 h-10 bg-white border-slate-200 rounded-xl" 
                  value={deviceSearchTerm}
                  onChange={(e) => setDeviceSearchTerm(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fetchDevices(devicePage, deviceSearchTerm)}
                  disabled={deviceLoading}
                  className="h-10 px-3.5 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100 gap-1.5 text-xs font-bold"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", deviceLoading && "animate-spin")} /> Refresh
                </Button>
                <Badge variant="outline" className="font-mono text-xs font-bold bg-white border-slate-200 text-slate-700 px-3 py-1">
                  {deviceTotal} Registered Device{deviceTotal === 1 ? '' : 's'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="w-full">
                <Table className="min-w-[1350px]">
                  <TableHeader className="bg-slate-50/50">
                    <TableRow>
                      <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-500 py-5 px-6">Employee Name / ID</TableHead>
                      <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-500">Role / Department / Designation</TableHead>
                      <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-500">Device Name & Platform</TableHead>
                      <TableHead className="font-black uppercase text-[10px] tracking-widest text-primary">Current Device ID</TableHead>
                      <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-700">FCM Token / Subscription Ref</TableHead>
                      <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-500">Permission / Status</TableHead>
                      <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-500">Last Active / Updated</TableHead>
                      <TableHead className="text-right font-black uppercase text-[10px] tracking-widest text-slate-500 pr-6">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deviceLoading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-16 text-slate-400">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
                          <p className="text-xs font-bold uppercase tracking-wider">Loading device registry records...</p>
                        </TableCell>
                      </TableRow>
                    ) : deviceItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-20 text-muted-foreground font-bold">
                          No active hardware or registered device records found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      deviceItems.map((dev: any) => {
                        const subEndpoint = dev.pushSubscription?.endpoint || dev.subscription?.endpoint || dev.token || "";
                        const hasPushSub = Boolean(dev.pushSubscription?.endpoint || dev.subscription?.endpoint);
                        const isCopied = copiedTokenEndpoint === subEndpoint && subEndpoint.length > 0;

                        return (
                          <TableRow key={dev.id || dev._id} className="hover:bg-slate-50/50 transition-colors">
                            {/* 1. Employee Name / ID */}
                            <TableCell className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-900 uppercase text-sm">
                                  {dev.employeeName || dev.employeeId || "Employee"}
                                </span>
                                <span className="text-[10px] font-mono text-primary font-black uppercase tracking-tighter">
                                  {dev.employeeId}
                                </span>
                              </div>
                            </TableCell>

                            {/* 2. Role / Department / Designation */}
                            <TableCell>
                              <div className="flex flex-col">
                                <div className="flex items-center gap-1.5">
                                  <Badge className="bg-slate-100 text-slate-800 border-none font-bold text-[9px] uppercase px-1.5 py-0.5">
                                    {dev.role || "EMPLOYEE"}
                                  </Badge>
                                  <span className="text-xs font-bold text-slate-700">{dev.department || "General"}</span>
                                </div>
                                <span className="text-[10px] text-muted-foreground uppercase font-medium mt-0.5">
                                  {dev.designation || "Staff"}
                                </span>
                              </div>
                            </TableCell>

                            {/* 3. Device Name & Platform */}
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <MonitorSmartphone className="w-3.5 h-3.5 text-slate-400" />
                                <div className="flex flex-col">
                                  <span className="text-xs font-bold text-slate-700 uppercase">
                                    {dev.deviceName || "Authorized Web Node"}
                                  </span>
                                  <span className="text-[9px] text-slate-400 uppercase font-mono">
                                    {dev.platform || "web"}
                                  </span>
                                </div>
                              </div>
                            </TableCell>

                            {/* 4. Current Device ID */}
                            <TableCell>
                              <Badge variant="outline" className="font-mono text-[10px] font-black uppercase bg-white border-primary/20 text-primary px-3 py-1 shadow-sm">
                                {dev.deviceId || "NOT_SYNCED"}
                              </Badge>
                            </TableCell>

                            {/* 5. FCM Token / Subscription Ref Column */}
                            <TableCell>
                              {subEndpoint ? (
                                <div className="flex items-center gap-2">
                                  <div className="flex flex-col max-w-[220px]">
                                    {hasPushSub && (
                                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] font-bold uppercase w-fit px-1.5 py-0.2 mb-0.5">
                                        Web-Push Active
                                      </Badge>
                                    )}
                                    <span 
                                      className="font-mono text-[10px] text-slate-600 truncate bg-slate-100 px-2 py-0.5 rounded border border-slate-200 cursor-pointer"
                                      title={subEndpoint}
                                      onClick={() => handleCopyTokenRef(subEndpoint)}
                                    >
                                      {subEndpoint.length > 25 ? `${subEndpoint.substring(0, 12)}...${subEndpoint.substring(subEndpoint.length - 10)}` : subEndpoint}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyTokenRef(subEndpoint)}
                                    className="p-1 rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-200 transition-colors"
                                    title="Copy reference"
                                  >
                                    {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                              ) : (
                                <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-200">
                                  No Active Push Ref
                                </Badge>
                              )}
                            </TableCell>

                            {/* 6. Permission / Status */}
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <Badge className={cn(
                                  "font-bold text-[9px] uppercase px-1.5 py-0.2 w-fit",
                                  dev.notificationPermission === 'granted' ? "bg-emerald-100 text-emerald-800" : (dev.notificationPermission === 'denied' ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-700")
                                )}>
                                  Perm: {dev.notificationPermission || 'granted'}
                                </Badge>
                                <Badge className={cn(
                                  "font-bold text-[9px] uppercase px-1.5 py-0.2 w-fit",
                                  dev.deviceStatus === 'ACTIVE' || dev.isActive !== false ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-slate-100 text-slate-500"
                                )}>
                                  Status: {dev.deviceStatus || 'ACTIVE'}
                                </Badge>
                              </div>
                            </TableCell>

                            {/* 7. Last Active / Updated */}
                            <TableCell>
                              <div className="flex items-center gap-1.5 text-xs text-slate-600 font-mono">
                                <Clock className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                                <span>{formatNotificationDateTime(dev.lastActiveAt || dev.lastTokenUpdated || dev.updatedAt)}</span>
                              </div>
                            </TableCell>

                            {/* 8. Action */}
                            <TableCell className="text-right pr-6">
                              <Button 
                                variant="secondary" 
                                size="sm" 
                                className="h-9 gap-2 font-black text-[10px] uppercase bg-slate-900 text-white hover:bg-primary transition-all rounded-xl"
                                onClick={() => setSelectedEmployee(dev)}
                              >
                                <History className="w-3.5 h-3.5" /> History
                              </Button>
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

            {/* SERVER-SIDE PAGINATION FOOTER CONTROLS */}
            <CardFooter className="bg-slate-50 border-t p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-500 font-medium">
                Showing {deviceItems.length > 0 ? (devicePage - 1) * PAGE_SIZE + 1 : 0} to{" "}
                {Math.min(devicePage * PAGE_SIZE, deviceTotal)} of {deviceTotal} registered devices
              </div>

              <div className="flex items-center gap-3">
                {/* Previous Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchDevices(devicePage - 1, deviceSearchTerm)}
                  disabled={devicePage <= 1 || deviceLoading}
                  className="h-9 px-3 rounded-xl font-bold text-xs border-slate-200 gap-1.5"
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </Button>

                {/* Page Jump Input / Indicator */}
                <form onSubmit={handleJumpDevicePage} className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-600 font-medium">Page</span>
                  <Input
                    type="number"
                    min={1}
                    max={deviceTotalPages}
                    value={jumpDevicePage}
                    onChange={(e) => setJumpDevicePage(e.target.value)}
                    className="h-9 w-14 text-center text-xs font-bold bg-white rounded-xl border-slate-200 px-1"
                  />
                  <span className="text-xs text-slate-600 font-medium">of {deviceTotalPages}</span>
                </form>

                {/* Next Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchDevices(devicePage + 1, deviceSearchTerm)}
                  disabled={devicePage >= deviceTotalPages || deviceLoading}
                  className="h-9 px-3 rounded-xl font-bold text-xs border-slate-200 gap-1.5"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </CardFooter>
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

            {/* 2. NOTIFICATION TITLE */}
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

      {/* Hardware Audit Trail Dialog */}
      <Dialog open={!!selectedEmployee} onOpenChange={(o) => !o && setSelectedEmployee(null)}>
        <DialogContent className="sm:max-w-4xl p-0 overflow-hidden border-none shadow-2xl rounded-3xl bg-white">
          <DialogHeader className="bg-slate-900 text-white p-8 space-y-4 shrink-0">
             <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center border border-primary/30">
                   <ShieldCheck className="w-8 h-8 text-primary" />
                </div>
                <div className="flex-1">
                   <DialogTitle className="text-2xl font-black uppercase tracking-tight">{selectedEmployee?.employeeName || selectedEmployee?.name}</DialogTitle>
                   <p className="text-[11px] font-bold text-primary uppercase tracking-[0.2em] mt-1">Hardware Audit Trail & Session Logs</p>
                </div>
             </div>
             <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 pt-4 border-t border-white/10">
                <div>
                   <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Employee Code</Label>
                   <p className="text-sm font-mono font-bold mt-0.5">{selectedEmployee?.employeeId || "N/A"}</p>
                </div>
                <div>
                   <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Department & Role</Label>
                   <p className="text-sm font-bold mt-0.5">{selectedEmployee?.department || "General"} ({selectedEmployee?.role || "EMPLOYEE"})</p>
                </div>
                <div className="hidden sm:block">
                   <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">System Status</Label>
                   <Badge className="bg-primary hover:bg-primary text-[10px] font-black uppercase block w-fit mt-0.5">{selectedEmployee?.deviceStatus || "ACTIVE"}</Badge>
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
                         getActualHistory(selectedEmployee).map((log: any, idx: number) => (
                           <TableRow key={log.id || idx} className="hover:bg-slate-50 transition-colors">
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
