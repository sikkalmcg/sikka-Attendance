"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import { 
  SidebarProvider, 
  Sidebar, 
  SidebarContent, 
  SidebarHeader, 
  SidebarMenu, 
  SidebarMenuItem, 
  SidebarMenuButton, 
  SidebarTrigger,
  SidebarInset,
  SidebarFooter
} from "@/components/ui/sidebar";
import { 
  LayoutDashboard, 
  UserCheck, 
  Users as UsersIcon, 
  Calendar, 
  FileText, 
  Settings, 
  LogOut, 
  Factory, 
  CreditCard, 
  BarChart3, 
  Clock, 
  User as UserIcon, 
  Camera, 
  ShieldAlert, 
  ArrowLeft, 
  Smartphone,
  Bell,
  CheckCheck,
  Trash2
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DataProvider, useData } from "@/context/data-context";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import Cookies from 'js-cookie';
import { format } from "date-fns";
import { registerNativeUser, updateNativeBadgeCount, logoutNativeUser, setAppBadge, clearAppBadge, requestAppNotificationPermission } from "@/lib/android-bridge";

function NotificationBell() {
  const { notifications = [], updateRecord, deleteRecord, refreshData, verifiedUser } = useData();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const isEmployee = String(verifiedUser?.role || '').toUpperCase() === 'EMPLOYEE';

  // Gather all unique identifiers for the currently logged-in user
  const userIdentifiers = useMemo(() => {
    if (!verifiedUser) return [];
    return [
      verifiedUser.employeeId,
      verifiedUser.username,
      verifiedUser.id,
      (verifiedUser as any)._id,
      (verifiedUser as any).aadhaar,
      (verifiedUser as any).aadhaarNumber,
      verifiedUser.mobile,
      (verifiedUser as any).mobileNumber
    ]
      .filter(Boolean)
      .map(id => String(id).trim().toUpperCase());
  }, [verifiedUser]);

  // Strict employee filtering:
  // - Employees see their own notifications + global announcements
  // - Admin / HR / Super Admin see system/admin notifications, but NEVER see employee Mark IN / Mark OUT notifications
  const userNotifications = useMemo(() => {
    return (notifications || []).filter((n: any) => {
      if (!n) return false;
      const targetEmpId = String(n.employeeId || '').trim().toUpperCase();
      const notifType = String(n.type || '').toUpperCase();
      const isEmployeeOnlyNotif = ['MARK_IN', 'MARK_OUT', 'AUTO_OUT', 'SHIFT_REMINDER'].includes(notifType);

      if (isEmployee) {
        // If notification has a specific employeeId, it MUST match one of this employee's identifiers
        if (targetEmpId && targetEmpId !== "GLOBAL" && targetEmpId !== "ALL" && targetEmpId !== "N/A") {
          return userIdentifiers.includes(targetEmpId);
        }
        // General/broadcast notification
        return true;
      } else {
        // For Admin / HR / Super Admin:
        // Strictly exclude employee Mark IN / Mark OUT / Shift Reminders
        if (isEmployeeOnlyNotif) {
          if (targetEmpId && targetEmpId !== "GLOBAL" && targetEmpId !== "ALL") {
            return userIdentifiers.includes(targetEmpId);
          }
          return false;
        }

        // For other system notifications: show if targeted to admin or global
        if (targetEmpId && targetEmpId !== "GLOBAL" && targetEmpId !== "ALL" && targetEmpId !== "N/A") {
          return userIdentifiers.includes(targetEmpId) || ['SUPER_ADMIN', 'ADMIN'].includes(String(verifiedUser?.role || '').toUpperCase());
        }
        return true;
      }
    }).sort((a: any, b: any) => {
      return (b.timestamp || "").localeCompare(a.timestamp || "");
    });
  }, [notifications, userIdentifiers, isEmployee, verifiedUser?.role]);

  // Red badge reflects UNREAD notifications only
  const unreadCount = useMemo(() => {
    return userNotifications.filter((n: any) => !n.read).length;
  }, [userNotifications]);

  // Sync with native Android badge count and Web PWA badge
  useEffect(() => {
    setAppBadge(unreadCount);
  }, [unreadCount]);

  // Format count: 1 to 9 as exact number, 10 or more as "9+"
  const badgeLabel = unreadCount > 9 ? "9+" : String(unreadCount);

  const handleNotificationClick = async (notif: any) => {
    const notifId = notif.id || notif._id;
    if (!notif.read && notifId) {
      await updateRecord('notifications', notifId, { read: true }, true);
    }
    setIsOpen(false);
    
    // Contextual routing based on notification payload
    if (notif.type === 'SALARY_PAID' || notif.message?.toLowerCase().includes('salary')) {
      router.push('/dashboard/payroll');
    } else if (notif.type === 'LEAVE_APPROVAL' || notif.message?.toLowerCase().includes('leave')) {
      router.push('/dashboard/approvals');
    } else {
      router.push('/dashboard/attendance');
    }
  };

  const handleMarkSingleAsRead = async (e: React.MouseEvent, notif: any) => {
    e.stopPropagation();
    const notifId = notif.id || notif._id;
    if (!notif.read && notifId) {
      await updateRecord('notifications', notifId, { read: true }, true);
    }
  };

  const handleMarkAllAsRead = async () => {
    const unread = userNotifications.filter((n: any) => !n.read);
    for (const notif of unread) {
      const notifId = notif.id || notif._id;
      if (notifId) {
        await updateRecord('notifications', notifId, { read: true }, true);
      }
    }
    await refreshData();
  };

  const handleDeleteSingle = async (e: React.MouseEvent, notif: any) => {
    e.stopPropagation();
    const notifId = notif.id || notif._id;
    if (notifId) {
      await deleteRecord('notifications', notifId, true);
    }
  };

  const handleClearAll = async () => {
    for (const notif of userNotifications) {
      const notifId = notif.id || notif._id;
      if (notifId) {
        await deleteRecord('notifications', notifId, true);
      }
    }
    await refreshData();
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
          className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:scale-95 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <Bell className="w-5 h-5 text-slate-700 hover:text-slate-900 transition-colors" />
          
          {/* Small Red Circular Badge with White Bold Unread Count */}
          {unreadCount > 0 && (
            <span
              className={cn(
                "absolute -top-0.5 -right-0.5 flex items-center justify-center",
                "bg-red-600 text-white font-bold leading-none select-none",
                "rounded-full ring-2 ring-white shadow-sm pointer-events-none",
                "transition-all duration-200 transform animate-in zoom-in-75",
                unreadCount > 9
                  ? "h-[18px] min-w-[20px] px-1 text-[9px]"
                  : "h-[18px] w-[18px] text-[10px]"
              )}
              title={`${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`}
            >
              {badgeLabel}
            </span>
          )}
        </button>
      </PopoverTrigger>
      
      <PopoverContent align="end" className="w-80 sm:w-96 p-0 rounded-2xl shadow-2xl border-slate-200 bg-white overflow-hidden z-50">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/80 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-sm text-slate-800">Notifications</span>
              {unreadCount > 0 && (
                <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-600 border border-red-100">
                  {unreadCount} unread
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                title="Mark all as read"
                className="text-[11px] font-bold text-primary hover:text-primary/80 transition-colors flex items-center gap-1 bg-primary/5 hover:bg-primary/10 px-2 py-1 rounded-lg"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Read all
              </button>
            )}
            {userNotifications.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                title="Clear all notifications"
                className="text-[11px] font-bold text-slate-500 hover:text-rose-600 transition-colors flex items-center gap-1 bg-slate-100 hover:bg-rose-50 px-2 py-1 rounded-lg"
              >
                <Trash2 className="w-3 h-3 text-rose-500" /> Clear all
              </button>
            )}
          </div>
        </div>

        <ScrollArea className="max-h-[380px]">
          {userNotifications.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-2.5">
                <Bell className="w-6 h-6 text-slate-300" />
              </div>
              <p className="text-xs font-bold text-slate-600">No notifications yet</p>
              <p className="text-[11px] text-slate-400 mt-0.5">We'll alert you when there are updates.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {userNotifications.map((notif: any) => {
                const notifId = notif.id || notif._id || notif.dedupeKey;
                const isUnread = !notif.read;
                return (
                  <div
                    key={notifId || Math.random()}
                    onClick={() => handleNotificationClick(notif)}
                    className={cn(
                      "p-3.5 transition-colors cursor-pointer text-left hover:bg-slate-50 flex items-start gap-3 group relative",
                      isUnread ? "bg-red-50/20" : "bg-white"
                    )}
                  >
                    {/* Unread Red Dot Indicator */}
                    <div className={cn(
                      "w-2 h-2 rounded-full mt-1.5 shrink-0 transition-colors",
                      isUnread ? "bg-red-500 shadow-sm" : "bg-slate-200"
                    )} />
                    
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className={cn(
                        "text-xs leading-relaxed transition-colors",
                        isUnread ? "font-bold text-slate-900" : "font-medium text-slate-600"
                      )}>
                        {notif.message}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{notif.timestamp ? (notif.timestamp.includes("-") ? notif.timestamp.substring(0, 16) : notif.timestamp) : "Recent"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {isUnread && (
                            <button
                              type="button"
                              onClick={(e) => handleMarkSingleAsRead(e, notif)}
                              title="Mark as read"
                              className="text-[10px] font-bold text-slate-500 hover:text-primary flex items-center gap-0.5 hover:underline"
                            >
                              Mark read
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => handleDeleteSingle(e, notif)}
                            title="Delete notification"
                            className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <div className="p-2.5 border-t border-slate-100 bg-slate-50 text-center">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs font-bold text-primary h-8 hover:bg-primary/5 rounded-xl"
            onClick={() => {
              setIsOpen(false);
              router.push('/dashboard/attendance');
            }}
          >
            Go to Mark Attendance
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function HeaderActions() {
  const { verifiedUser } = useData();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const router = useRouter();

  const handleLogout = () => {
    logoutNativeUser();
    Cookies.remove('sikka_session', { path: '/' });
    localStorage.removeItem("user");
    router.push("/login");
  };

  const handleSaveProfile = (updatedUser: any) => {
    const sessionData = JSON.stringify(updatedUser);
    Cookies.set('sikka_session', sessionData, { expires: 365, path: '/' });
    localStorage.setItem("user", sessionData);
  };

  if (!verifiedUser) return null;

  return (
    <div className="flex items-center gap-3 sm:gap-5">
      <NotificationBell />
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className="flex items-center gap-3 pl-2 cursor-pointer group hover:bg-slate-50 p-1 rounded-xl transition-colors">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-slate-900 leading-none">{verifiedUser.fullName}</p>
              <p className="text-[10px] font-black text-primary mt-1.5 uppercase tracking-wider leading-none">{verifiedUser.role?.replace(/_/g, " ")}</p>
            </div>
            <Avatar className="h-10 w-10 border border-slate-200 shadow-sm transition-transform group-hover:scale-105">
              <AvatarImage src={verifiedUser.avatar || `https://picsum.photos/seed/${verifiedUser.username}/40/40`} />
              <AvatarFallback className="bg-slate-100 text-slate-400 font-bold">{verifiedUser.fullName?.[0]}</AvatarFallback>
            </Avatar>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 mt-2 rounded-xl shadow-xl">
          <DropdownMenuLabel className="font-bold text-xs uppercase tracking-widest text-slate-400">My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2 cursor-pointer py-2.5 font-semibold" onSelect={(e) => { e.preventDefault(); setIsSettingsOpen(true); }}>
            <Settings className="w-4 h-4 text-slate-500" /> Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2 cursor-pointer py-2.5 font-semibold text-rose-600 focus:text-rose-600 focus:bg-rose-50" onClick={handleLogout}>
            <LogOut className="w-4 h-4" /> Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ProfileSettingsDialog 
        isOpen={isSettingsOpen} 
        onOpenChange={setIsSettingsOpen} 
        user={verifiedUser} 
        onSave={handleSaveProfile}
      />
    </div>
  );
}

function ProfileSettingsDialog({ isOpen, onOpenChange, user, onSave }: { isOpen: boolean, onOpenChange: (o: boolean) => void, user: any, onSave: (u: any) => void }) {
  const { updateRecord, employees } = useData();
  const [name, setName] = useState(user.fullName);
  const [avatar, setAvatar] = useState(user.avatar || "");
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    setName(user.fullName);
    setAvatar(user.avatar || "");
  }, [user]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 200 * 1024) {
        toast({ variant: "destructive", title: "File too large", description: "Profile photo must be under 200 KB." });
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ variant: "destructive", title: "Name required", description: "Please enter your full name." });
      return;
    }

    setIsProcessing(true);
    try {
      if (user.role !== 'SUPER_ADMIN' && user.role !== 'EMPLOYEE' && user.id) {
        updateRecord('users', user.id, { fullName: name, avatar: avatar });
      }

      if (user.role === 'EMPLOYEE') {
        const loginIdent = user.username?.replace(/\s/g, '');
        const dbEmp = employees.find(e => {
          const empAadhaar = e.aadhaar?.replace(/\s/g, '');
          const empMobile = e.mobile?.replace(/\s/g, '');
          return empAadhaar === loginIdent || empMobile === loginIdent;
        });
        if (dbEmp) {
          updateRecord('employees', dbEmp.id, { avatar: avatar });
        }
      }

      onSave({ ...user, fullName: name, avatar });
      onOpenChange(false);
      toast({ title: "Profile Updated", description: "Your settings have been saved successfully." });
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Failed to update profile record." });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-primary" /> Profile Settings
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-8 py-6">
          <div className="flex flex-col items-center gap-4">
            <div className="relative group">
              <Avatar className="h-24 w-24 border-4 border-white shadow-xl">
                <AvatarImage src={avatar || `https://picsum.photos/seed/${user.username}/96/96`} />
                <AvatarFallback className="text-2xl font-black bg-slate-100">{name?.[0]}</AvatarFallback>
              </Avatar>
              <Button 
                size="icon" 
                variant="secondary" 
                className="absolute bottom-0 right-0 h-8 w-8 rounded-full shadow-lg border-2 border-white bg-primary text-white hover:bg-primary/90"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
              >
                <Camera className="w-4 h-4" />
              </Button>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Max Size: 200 KB</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="font-bold text-xs uppercase text-slate-500 tracking-wider">Full Name</Label>
              <Input 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                className="h-12 bg-slate-50 border-slate-200 rounded-xl font-bold"
                placeholder="Enter your name"
                disabled={user.role === 'EMPLOYEE' || isProcessing}
              />
              {user.role === 'EMPLOYEE' && (
                <p className="text-[9px] font-bold text-slate-400 uppercase">Verified via Employee Directory</p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-xs uppercase text-slate-500 tracking-wider">Username (Read-only)</Label>
              <Input value={user.username} disabled className="h-12 bg-slate-100 border-slate-200 rounded-xl font-mono text-xs italic" />
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl font-bold">Cancel</Button>
          <Button className="bg-primary rounded-xl font-bold px-8 shadow-lg shadow-primary/20" onClick={handleSave} disabled={isProcessing}>
            {isProcessing ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { verifiedUser } = useData();

  if (!verifiedUser) return null;

  // FIXED: "Leave Approvals" entry list has been fully removed from the menu schema array
  const menuItems = [
    { title: "Dashboard", icon: LayoutDashboard, path: "/dashboard", roles: ["SUPER_ADMIN", "ADMIN", "HR"], permission: "Dashboard" },
    { title: "Mark Attendance", icon: UserCheck, path: "/dashboard/attendance", roles: ["EMPLOYEE", "SUPER_ADMIN", "ADMIN", "HR"], permission: "Attendance" },
    { title: "Approvals", icon: FileText, path: "/dashboard/approvals", roles: ["SUPER_ADMIN", "ADMIN", "HR"], permission: "Approvals" },
    { title: "Employees", icon: UsersIcon, path: "/dashboard/employees", roles: ["SUPER_ADMIN", "ADMIN", "HR"], permission: "Employees" },
    { title: "Payroll", icon: CreditCard, path: "/dashboard/payroll", roles: ["SUPER_ADMIN", "ADMIN", "HR"], permission: "Payroll" },
    { title: "Vouchers", icon: FileText, path: "/dashboard/vouchers", roles: ["SUPER_ADMIN", "ADMIN", "HR"], permission: "Vouchers" },
    { title: "Holidays", icon: Calendar, path: "/dashboard/holidays", roles: ["SUPER_ADMIN", "ADMIN", "HR"], permission: "Holidays" },
    { title: "Reports", icon: BarChart3, path: "/dashboard/reports", roles: ["SUPER_ADMIN", "ADMIN", "HR"], permission: "Reports" },
    { title: "Activity", icon: Smartphone, path: "/dashboard/activity", roles: ["SUPER_ADMIN", "ADMIN", "HR"], permission: "Activity" },
    { title: "Plants & Firms", icon: Factory, path: "/dashboard/settings/firms", roles: ["SUPER_ADMIN", "ADMIN"], permission: "Settings" },
    { title: "Users", icon: Settings, path: "/dashboard/settings/users", roles: ["SUPER_ADMIN"], permission: "Users" },
  ];

  const filteredMenu = menuItems.filter(item => {
    const isSuperAdmin = verifiedUser.role === 'SUPER_ADMIN';
    const hasRole = item.roles.includes(verifiedUser.role);
    const hasPermission = isSuperAdmin || item.permission === 'Dashboard' || verifiedUser.permissions?.includes(item.permission);
    return hasRole && hasPermission;
  });

  return (
    <>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/30">
            <span className="text-white font-bold text-lg">S</span>
          </div>
          <span className="font-black text-lg tracking-tighter group-data-[collapsible=icon]:hidden">Sikka HRMS</span>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-2">
        <SidebarMenu>
          {filteredMenu.map((item) => (
            <SidebarMenuItem key={item.path}>
              <SidebarMenuButton 
                isActive={pathname === item.path}
                onClick={() => router.push(item.path)}
                tooltip={item.title}
                className="h-11 px-3"
              >
                <item.icon className="w-5 h-5 mr-3" />
                <span className="font-bold group-data-[collapsible=icon]:hidden">{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <Button variant="ghost" className="w-full justify-start text-rose-600 font-bold hover:bg-rose-50 hover:text-rose-700 group-data-[collapsible=icon]:p-2" onClick={() => {
          logoutNativeUser();
          clearAppBadge();
          Cookies.remove('sikka_session', { path: '/' });
          localStorage.removeItem("user");
          router.push("/login");
        }}>
          <LogOut className="w-5 h-5 mr-3 group-data-[collapsible=icon]:mr-0" />
          <span className="font-bold group-data-[collapsible=icon]:hidden">Logout</span>
        </Button>
      </SidebarFooter>
    </>
  );
}

function AuthorizedContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { verifiedUser, isLoading, employees, users, refreshData } = useData();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [maxWaitExceeded, setMaxWaitExceeded] = useState(false);

  const logoUrl = "https://sikkaenterprises.com/assets/images/Capture13.51191245_std.JPG";

  // Periodic automated shift reminder evaluation
  useEffect(() => {
    if (!verifiedUser) return;
    
    const checkShiftReminders = async () => {
      try {
        const res = await fetch('/api/notifications/shift-reminders', { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          if (data?.newRemindersCount > 0) {
            await refreshData();
          }
        }
      } catch (err) {
        console.error("Shift reminder check error:", err);
      }
    };

    // Trigger on mount
    checkShiftReminders();

    // Check periodically every 60 seconds
    const interval = setInterval(checkShiftReminders, 60 * 1000);
    return () => clearInterval(interval);
  }, [verifiedUser, refreshData]);

  // Register active user credentials with Android Native Bridge & request notification permission
  useEffect(() => {
    if (verifiedUser) {
      const empId = verifiedUser.employeeId || verifiedUser.username || verifiedUser.id || '';
      registerNativeUser(empId, verifiedUser.role || 'EMPLOYEE', verifiedUser.fullName || (verifiedUser as any).name || '');
      requestAppNotificationPermission();
    }
  }, [verifiedUser]);

  // Spec: Validation Gateway runs for max 2 seconds, after which it opens
  useEffect(() => {
    const timer = setTimeout(() => {
      setMaxWaitExceeded(true);
      setIsAuthorized((prev) => (prev === null ? true : prev));
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isLoading || !verifiedUser) return;

    const handleLogout = () => {
      logoutNativeUser();
      Cookies.remove('sikka_session', { path: '/' });
      if (typeof window !== 'undefined') {
        localStorage.removeItem("user");
      }
      router.push("/login");
    };

    const userRole = String(verifiedUser.role || '').toUpperCase();
    if (userRole === 'EMPLOYEE') {
      const loginIdent = String(verifiedUser.username || verifiedUser.employeeId || '').replace(/\s/g, '');
      const dbEmp = employees.find(e => {
        const empAadhaar = String((e as any).aadhaarNumber || e.aadhaar || '').replace(/\s/g, '');
        const empMobile = String((e as any).mobileNumber || e.mobile || '').replace(/\s/g, '');
        const empId = String(e.employeeId || e.id || '').replace(/\s/g, '');
        return empAadhaar === loginIdent || empMobile === loginIdent || empId === loginIdent;
      });
      if (dbEmp && (dbEmp.active === false || (dbEmp as any).isActive === false || (dbEmp.sessionId && verifiedUser.sessionId && dbEmp.sessionId !== verifiedUser.sessionId))) {
        handleLogout();
      }
    } else {
      const dbUser = users.find(u => u.id === verifiedUser.id);
      if (dbUser && (dbUser.status === 'Inactive' || (dbUser.sessionId && verifiedUser.sessionId && dbUser.sessionId !== verifiedUser.sessionId))) {
        handleLogout();
      }
    }
  }, [verifiedUser, isLoading, employees, users, router]);

  useEffect(() => {
    if (isLoading) return;

    if (!verifiedUser) {
      router.push("/login");
      return;
    }

    const userRole = String(verifiedUser.role || '').toUpperCase();

    // Mark Attendance is accessible by all authenticated roles (Employee, HR, Admin, Super Admin)
    if (pathname === '/dashboard/attendance') {
      setIsAuthorized(true);
      return;
    }

    // Employees navigating anywhere other than /dashboard/attendance get redirected to Mark Attendance
    if (userRole === 'EMPLOYEE') {
      setIsAuthorized(true);
      router.push("/dashboard/attendance");
      return;
    }

    const menuPermissions: Record<string, string> = {
      "/dashboard": "Dashboard",
      "/dashboard/attendance": "Attendance",
      "/dashboard/approvals": "Approvals",
      "/dashboard/employees": "Employees",
      "/dashboard/payroll": "Payroll",
      "/dashboard/vouchers": "Vouchers",
      "/dashboard/holidays": "Holidays",
      "/dashboard/reports": "Reports",
      "/dashboard/activity": "Activity",
      "/dashboard/settings/firms": "Settings",
      "/dashboard/settings/users": "Users"
    };

    const requiredPermission = menuPermissions[pathname];
    const isSuperAdmin = userRole === 'SUPER_ADMIN';
    
    if (isSuperAdmin) {
      setIsAuthorized(true);
    } else if (requiredPermission) {
      const hasPerm = (verifiedUser.permissions || []).includes(requiredPermission) || requiredPermission === "Dashboard";
      setIsAuthorized(hasPerm);
    } else {
      setIsAuthorized(true); 
    }
  }, [verifiedUser, isLoading, pathname, router]);

  if ((isLoading || isAuthorized === null) && !maxWaitExceeded) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-5">
          <div className="relative flex items-center justify-center w-28 h-28">
            {/* Outer Rotating Cyber Accent Ring */}
            <div className="absolute inset-0 rounded-full border-2 border-dashed border-[#C59D2E]/40 animate-gateway-spin-slow" />
            
            {/* Middle Reverse Rotating Ring */}
            <div className="absolute inset-2 rounded-full border border-blue-500/20 animate-gateway-spin-reverse" />

            {/* Radar Sonar Ping Waves */}
            <div className="absolute inset-0 rounded-full bg-[#C59D2E]/10 animate-gateway-radar-ping" />

            {/* Animated Sikka Logo Container with Pulse Glow */}
            <div className="relative w-20 h-20 rounded-2xl bg-white shadow-xl overflow-hidden p-1 border-2 border-[#C59D2E] animate-gateway-pulse-glow flex items-center justify-center">
              <Image
                src={logoUrl}
                alt="Sikka Logo"
                width={72}
                height={72}
                className="w-full h-full object-cover rounded-xl"
                priority
              />
            </div>
          </div>

          <div className="text-center space-y-1">
            <p className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center justify-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              Validating Gateway...
            </p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Sikka Enterprises & Logistics
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isAuthorized === false) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 p-6">
        <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center mb-6 shadow-xl border border-rose-100">
          <ShieldAlert className="w-10 h-10 text-rose-500" />
        </div>
        <h1 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Access Denied</h1>
        <p className="text-slate-500 font-medium text-center max-w-sm mb-8">
          You do not have the required permissions to view this administrative module.
        </p>
        <Button 
          className="bg-primary px-8 h-12 rounded-xl font-bold shadow-lg shadow-primary/20 gap-2"
          onClick={() => router.push(String(verifiedUser?.role).toUpperCase() === 'EMPLOYEE' ? "/dashboard/attendance" : "/dashboard")}
        >
          <ArrowLeft className="w-4 h-4" /> Go Back Home
        </Button>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background overflow-hidden">
        <Sidebar collapsible="icon" className="border-r border-slate-200">
          <SidebarNav />
        </Sidebar>

        <SidebarInset className="flex flex-col flex-1 h-screen overflow-hidden">
          <header className="h-16 border-b border-slate-200 flex items-center justify-between px-6 bg-white shrink-0 z-20">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <Separator orientation="vertical" className="h-6" />
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
                {pathname.split("/").pop()?.replace(/-/g, " ") || "Overview"}
              </h2>
            </div>
            
            <HeaderActions />
          </header>

          <main 
            className="flex-1 p-6 overflow-y-auto bg-slate-50/50 outline-none focus-visible:ring-1 focus-visible:ring-primary/10"
            tabIndex={0}
            role="main"
          >
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </main>
          
          <footer className="h-12 border-t border-slate-100 flex items-center justify-center px-6 bg-white text-[10px] font-black uppercase tracking-widest text-slate-400 shrink-0">
            © Sikka Industries & Logistics – Version 1.0
          </footer>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <DataProvider>
        <AuthorizedContent>
          {children}
        </AuthorizedContent>
      </DataProvider>
    </TooltipProvider>
  );
}