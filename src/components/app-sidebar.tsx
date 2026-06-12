"use client";

import * as React from "react";
import Cookies from "js-cookie";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  Users,
  UserCheck,
  CreditCard,
  FileText,
  Calendar,
  BarChart3,
  Activity,
  Factory,
  Settings,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"; // image_a3499b.png ki primitive file use ho rahi h

const navigationItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["SUPER_ADMIN", "ADMIN", "HR"] },
  { name: "Mark Attendance", href: "/dashboard/attendance", icon: UserCheck, roles: ["EMPLOYEE", "SUPER_ADMIN", "ADMIN", "HR"] },
  { name: "Approvals", href: "/dashboard/approvals", icon: CheckSquare, roles: ["SUPER_ADMIN", "ADMIN", "HR"] },
  { name: "Employees", href: "/dashboard/employees", icon: Users, roles: ["SUPER_ADMIN", "ADMIN", "HR"] },
  { name: "Payroll", href: "/dashboard/payroll", icon: CreditCard, roles: ["SUPER_ADMIN", "ADMIN", "HR"] },
  { name: "Vouchers", href: "/dashboard/vouchers", icon: FileText, roles: ["SUPER_ADMIN", "ADMIN", "HR"] },
  { name: "Holidays", href: "/dashboard/holidays", icon: Calendar, roles: ["SUPER_ADMIN", "ADMIN", "HR", "EMPLOYEE"] },
  { name: "Reports", href: "/dashboard/reports", icon: BarChart3, roles: ["SUPER_ADMIN", "ADMIN", "HR"] },
  { name: "Activity", href: "/dashboard/activity", icon: Activity, roles: ["SUPER_ADMIN", "ADMIN", "HR"] },
  { name: "Plants & Firms", href: "/dashboard/plants", icon: Factory, roles: ["SUPER_ADMIN", "ADMIN"] },
  { name: "Users", href: "/dashboard/users", icon: Settings, roles: ["SUPER_ADMIN", "ADMIN"] },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const [userRole, setUserRole] = React.useState<string>("EMPLOYEE");

  React.useEffect(() => {
    const session = Cookies.get("sikka_session");
    if (session) {
      try {
        const parsed = JSON.parse(session);
        if (parsed?.role) {
          setUserRole(parsed.role.toUpperCase());
        }
      } catch (e) {
        console.error("Failed to parse session cookie:", e);
      }
    }
  }, []);

  const allowedMenu = navigationItems.filter((item) =>
    item.roles.includes(userRole)
  );

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <div className="flex flex-col gap-1">
          <span className="font-bold text-lg text-sidebar-foreground tracking-tight">
            Sikka HRMS
          </span>
          <span className="w-fit text-[9px] bg-sky-50 text-sky-600 px-1.5 py-0.5 rounded font-black uppercase tracking-wider">
            {userRole} Mode
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {allowedMenu.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                return (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.name}
                    >
                      <a href={item.href} className="flex items-center gap-3">
                        <Icon className={isActive ? "text-sky-600" : ""} />
                        <span>{item.name}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}