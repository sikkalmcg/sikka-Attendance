
"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  UserPlus, 
  Search, 
  ShieldCheck, 
  ShieldAlert, 
  Shield, 
  MoreVertical,
  Key
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MOCK_USERS = [
  { id: "1", name: "Ajay Somra", username: "ajaysomra", role: "SUPER_ADMIN", status: "Active" },
  { id: "2", name: "Mayank Sharma", username: "mayank.hr", role: "HR", status: "Active" },
  { id: "3", name: "Rahul Gupta", username: "rahul.admin", role: "ADMIN", status: "Active" },
];

export default function UserManagementPage() {
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-muted-foreground">Control system access and assign administrative roles.</p>
        </div>
        <Button className="font-bold shadow-lg shadow-primary/20">
          <UserPlus className="w-4 h-4 mr-2" />
          Create Admin User
        </Button>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by name or username..." 
                className="pl-10 h-10 bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select defaultValue="all">
              <SelectTrigger className="w-[180px] bg-white">
                <SelectValue placeholder="Filter by Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
                <SelectItem value="HR">HR</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="font-bold">Full Name</TableHead>
                <TableHead className="font-bold">Username</TableHead>
                <TableHead className="font-bold">Role</TableHead>
                <TableHead className="font-bold">Permissions</TableHead>
                <TableHead className="font-bold">Status</TableHead>
                <TableHead className="text-right font-bold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_USERS.map((user) => (
                <TableRow key={user.id} className="hover:bg-slate-50/50">
                  <TableCell className="font-bold">{user.name}</TableCell>
                  <TableCell className="font-mono text-primary">{user.username}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {user.role === "SUPER_ADMIN" ? (
                        <ShieldAlert className="w-4 h-4 text-rose-500" />
                      ) : user.role === "ADMIN" ? (
                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Shield className="w-4 h-4 text-blue-500" />
                      )}
                      <span className="text-xs font-bold uppercase tracking-tight">{user.role.replace(/_/g, " ")}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline" className="text-[10px] py-0">Attendance</Badge>
                      <Badge variant="outline" className="text-[10px] py-0">Payroll</Badge>
                      {user.role.includes("ADMIN") && <Badge variant="outline" className="text-[10px] py-0">Users</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className="bg-emerald-600">Active</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Key className="w-4 h-4 mr-2" /> Reset Password
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-rose-600">
                          Deactivate User
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
