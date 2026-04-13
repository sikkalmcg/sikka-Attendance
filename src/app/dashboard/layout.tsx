
"use client";

import { useEffect, useState } from "react";
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
  BarChart3
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DataProvider } from "@/context/data-context";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (!savedUser) {
      router.push("/login");
    } else {
      setUser(JSON.parse(savedUser));
    }
  }, [router]);

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
    <DataProvider>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-background">
          <Sidebar className="border-r border-slate-200">
            <SidebarHeader className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">S</span>
                </div>
                <span className="font-bold text-lg tracking-tight">Sikka HR</span>
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
                      <span className="font-medium">{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarContent>
            <SidebarFooter className="p-4">
              <Button variant="ghost" className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={handleLogout}>
                <LogOut className="w-5 h-5 mr-3" />
                <span className="font-medium">Logout</span>
              </Button>
            </SidebarFooter>
          </Sidebar>

          <SidebarInset className="flex flex-col flex-1">
            <header className="h-16 border-b border-slate-200 flex items-center justify-between px-6 bg-white sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <SidebarTrigger />
                <Separator orientation="vertical" className="h-6" />
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  {pathname.split("/").pop()?.replace(/-/g, " ") || "Overview"}
                </h2>
              </div>
              
              <div className="flex items-center gap-5">
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="w-5 h-5 text-slate-500" />
                  <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
                </Button>
                <div className="flex items-center gap-3 pl-2">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-bold leading-none">{user.fullName}</p>
                    <p className="text-xs text-muted-foreground mt-1 capitalize">{user.role.replace(/_/g, " ")}</p>
                  </div>
                  <Avatar className="h-9 w-9 border-2 border-slate-100 shadow-sm">
                    <AvatarImage src={`https://picsum.photos/seed/${user.username}/40/40`} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold">{user.fullName?.[0]}</AvatarFallback>
                  </Avatar>
                </div>
              </div>
            </header>

            <main className="flex-1 p-6 overflow-auto">
              <div className="max-w-7xl mx-auto space-y-6">
                {children}
              </div>
            </main>
            
            <footer className="h-12 border-t border-slate-100 flex items-center justify-center px-6 bg-slate-50 text-xs text-muted-foreground">
              © Sikka Industries & Logistics – Version 1.0
            </footer>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </DataProvider>
  );
}
