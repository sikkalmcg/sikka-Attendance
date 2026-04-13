"use client";

import { useEffect, useState, useMemo } from "react";
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
  Clock
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DataProvider, useData } from "@/context/data-context";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

function HeaderActions() {
  const { notifications, setNotifications } = useData();
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);
  const latestNotifications = useMemo(() => notifications.slice(0, 10), [notifications]);

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    router.push("/login");
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
              <Button variant="ghost" className="text-[10px] font-black uppercase tracking-widest text-primary h-8 w-full hover:bg-primary/5" onClick={() => setNotifications([])}>
                Clear All Logs
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      <div className="flex items-center gap-3 pl-2">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-bold leading-none">{user.fullName}</p>
          <p className="text-xs text-muted-foreground mt-1 capitalize">{user.role?.replace(/_/g, " ")}</p>
        </div>
        <Avatar className="h-10 w-10 border-2 border-slate-100 shadow-sm transition-transform hover:scale-105">
          <AvatarImage src={`https://picsum.photos/seed/${user.username}/40/40`} />
          <AvatarFallback className="bg-primary/10 text-primary font-black">{user.fullName?.[0]}</AvatarFallback>
        </Avatar>
      </div>
    </div>
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

  const handleLogout = () => {
    localStorage.removeItem("user");
    router.push("/login");
  };

  if (!user) return null;

  const menuItems = [
    { title: "Dashboard", icon: LayoutDashboard, path: "/dashboard", roles: ["SUPER_ADMIN", "ADMIN", "HR", "EMPLOYEE"] },
    { title: "Mark Attendance", icon: UserCheck, path: "/dashboard/attendance", roles: ["EMPLOYEE", "SUPER_ADMIN"] },
    { title: "Approvals", icon: FileText, path: "/dashboard/approvals", roles: ["SUPER_ADMIN", "ADMIN", "HR"] },
    { title: "Employees", icon: Users, path: "/dashboard/employees", roles: ["SUPER_ADMIN", "ADMIN", "HR"] },
    { title: "Payroll", icon: CreditCard, path: "/dashboard/payroll", roles: ["SUPER_ADMIN", "ADMIN", "HR"] },
    { title: "Vouchers", icon: FileText, path: "/dashboard/vouchers", roles: ["SUPER_ADMIN", "ADMIN", "HR", "EMPLOYEE"] },
    { title: "Holidays", icon: Calendar, path: "/dashboard/holidays", roles: ["SUPER_ADMIN", "ADMIN", "HR"] },
    { title: "Reports", icon: BarChart3, path: "/dashboard/reports", roles: ["SUPER_ADMIN", "ADMIN", "HR"] },
    { title: "Plants & Firms", icon: Factory, path: "/dashboard/settings/firms", roles: ["SUPER_ADMIN", "ADMIN"] },
    { title: "Users", icon: Settings, path: "/dashboard/settings/users", roles: ["SUPER_ADMIN"] },
  ];

  const filteredMenu = menuItems.filter(item => item.roles.includes(user.role));

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
        <Button variant="ghost" className="w-full justify-start text-rose-600 font-bold hover:bg-rose-50 hover:text-rose-700 group-data-[collapsible=icon]:p-2" onClick={handleLogout}>
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

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
