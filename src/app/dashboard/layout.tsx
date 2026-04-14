"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
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
  Users, 
  Calendar, 
  FileText, 
  Settings, 
  LogOut, 
  Bell,
  Factory,
  CreditCard,
  BarChart3,
  CheckCircle2,
  Clock,
  User as UserIcon,
  Camera,
  Upload
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DataProvider, useData } from "@/context/data-context";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

function HeaderActions() {
  const { notifications, updateRecord, deleteRecord } = useData();
  const [user, setUser] = useState<any>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);
  const latestNotifications = useMemo(() => [...notifications].reverse().slice(0, 10), [notifications]);

  const markAllRead = () => {
    notifications.forEach(n => {
      if (!n.read) {
        updateRecord('notifications', n.id, { read: true });
      }
    });
  };

  const handleClearLogs = () => {
    notifications.forEach(n => {
      deleteRecord('notifications', n.id);
    });
    toast({ title: "Logs Cleared", description: "All notifications have been removed." });
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    router.push("/login");
  };

  const handleSaveProfile = (updatedUser: any) => {
    setUser(updatedUser);
    localStorage.setItem("user", JSON.stringify(updatedUser));
  };

  if (!user) return null;

  return (
    <div className="flex items-center gap-5">
      <Popover onOpenChange={(open) => open && markAllRead()}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-xl bg-slate-50 border hover:bg-slate-100 transition-all">
            <Bell className="w-5 h-5 text-slate-500" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-black rounded-full border-2 border-white flex items-center justify-center animate-bounce shadow-sm">
                {unreadCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0 overflow-hidden rounded-2xl shadow-2xl border-none mt-2" align="end">
          <div className="bg-primary p-4 text-white flex items-center justify-between">
            <div>
              <h3 className="font-black text-sm uppercase tracking-widest">Notifications</h3>
              <p className="text-[10px] text-white/70 font-bold">Latest activity logs</p>
            </div>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="bg-white/20 text-white border-none font-bold text-[10px]">
                {unreadCount} New
              </Badge>
            )}
          </div>
          <ScrollArea className="max-h-[400px]">
            {latestNotifications.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                  <Bell className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-xs text-muted-foreground font-bold">No notifications yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {latestNotifications.map((n) => (
                  <div key={n.id} className={cn(
                    "p-4 flex gap-3 items-start hover:bg-slate-50 transition-colors",
                    !n.read && "bg-primary/5"
                  )}>
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm",
                      n.message.includes("marked IN") ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                    )}>
                      {n.message.includes("marked IN") ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-700 leading-relaxed">{n.message}</p>
                      <p className="text-[10px] text-muted-foreground font-medium">{n.timestamp}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          {latestNotifications.length > 0 && (
            <div className="p-3 bg-slate-50 border-t text-center">
              <Button 
                variant="ghost" 
                className="text-[10px] font-black uppercase tracking-widest text-primary h-8 w-full hover:bg-primary/5" 
                onClick={handleClearLogs}
              >
                Clear All Logs
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className="flex items-center gap-3 pl-2 cursor-pointer group hover:bg-slate-50 p-1 rounded-xl transition-colors">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-slate-900 leading-none">{user.fullName}</p>
              <p className="text-[10px] font-black text-primary mt-1.5 uppercase tracking-wider leading-none">{user.role?.replace(/_/g, " ")}</p>
            </div>
            <Avatar className="h-10 w-10 border border-slate-200 shadow-sm transition-transform group-hover:scale-105">
              <AvatarImage src={user.avatar || `https://picsum.photos/seed/${user.username}/40/40`} />
              <AvatarFallback className="bg-slate-100 text-slate-400 font-bold">{user.fullName?.[0]}</AvatarFallback>
            </Avatar>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 mt-2 rounded-xl shadow-xl">
          <DropdownMenuLabel className="font-bold text-xs uppercase tracking-widest text-slate-400">My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2 cursor-pointer py-2.5 font-semibold" onClick={() => setIsSettingsOpen(true)}>
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
        user={user} 
        onSave={handleSaveProfile}
      />
    </div>
  );
}

function ProfileSettingsDialog({ isOpen, onOpenChange, user, onSave }: { isOpen: boolean, onOpenChange: (o: boolean) => void, user: any, onSave: (u: any) => void }) {
  const [name, setName] = useState(user.fullName);
  const [avatar, setAvatar] = useState(user.avatar || "");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

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

  const handleSave = () => {
    if (!name.trim()) {
      toast({ variant: "destructive", title: "Name required", description: "Please enter your full name." });
      return;
    }
    onSave({ ...user, fullName: name, avatar });
    onOpenChange(false);
    toast({ title: "Profile Updated", description: "Your settings have been saved successfully." });
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
              />
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-xs uppercase text-slate-500 tracking-wider">Username (Read-only)</Label>
              <Input value={user.username} disabled className="h-12 bg-slate-100 border-slate-200 rounded-xl font-mono text-xs italic" />
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl font-bold">Cancel</Button>
          <Button className="bg-primary rounded-xl font-bold px-8 shadow-lg shadow-primary/20" onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  if (!user) return null;

  const menuItems = [
    { title: "Dashboard", icon: LayoutDashboard, path: "/dashboard", roles: ["SUPER_ADMIN", "ADMIN", "HR", "EMPLOYEE"], permission: "Dashboard" },
    { title: "Mark Attendance", icon: UserCheck, path: "/dashboard/attendance", roles: ["EMPLOYEE", "SUPER_ADMIN"], permission: "Attendance" },
    { title: "Approvals", icon: FileText, path: "/dashboard/approvals", roles: ["SUPER_ADMIN", "ADMIN", "HR"], permission: "Approvals" },
    { title: "Employees", icon: Users, path: "/dashboard/employees", roles: ["SUPER_ADMIN", "ADMIN", "HR"], permission: "Employees" },
    { title: "Payroll", icon: CreditCard, path: "/dashboard/payroll", roles: ["SUPER_ADMIN", "ADMIN", "HR"], permission: "Payroll" },
    { title: "Vouchers", icon: FileText, path: "/dashboard/vouchers", roles: ["SUPER_ADMIN", "ADMIN", "HR", "EMPLOYEE"], permission: "Vouchers" },
    { title: "Holidays", icon: Calendar, path: "/dashboard/holidays", roles: ["SUPER_ADMIN", "ADMIN", "HR"], permission: "Holidays" },
    { title: "Reports", icon: BarChart3, path: "/dashboard/reports", roles: ["SUPER_ADMIN", "ADMIN", "HR"], permission: "Reports" },
    { title: "Plants & Firms", icon: Factory, path: "/dashboard/settings/firms", roles: ["SUPER_ADMIN", "ADMIN"], permission: "Settings" },
    { title: "Users", icon: Settings, path: "/dashboard/settings/users", roles: ["SUPER_ADMIN"], permission: "Users" },
  ];

  const filteredMenu = menuItems.filter(item => {
    const hasRole = item.roles.includes(user.role);
    // Super Admin sees everything. Others need explicit permission strings matching the item.permission
    const hasPermission = user.role === 'SUPER_ADMIN' || item.permission === 'Dashboard' || user.permissions?.includes(item.permission);
    return hasRole && hasPermission;
  });

  return (
    <>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/30">
            <span className="text-white font-bold text-lg">S</span>
          </div>
          <span className="font-black text-lg tracking-tighter group-data-[collapsible=icon]:hidden">Sikka HR</span>
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

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (!savedUser) {
      router.push("/login");
    }
  }, [router]);

  return (
    <DataProvider>
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

            <main className="flex-1 p-6 overflow-y-auto bg-slate-50/50">
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
    </DataProvider>
  );
}
