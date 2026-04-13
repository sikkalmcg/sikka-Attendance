"use client";

import { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
  Key,
  Pencil,
  Trash2,
  AlertTriangle,
  Lock
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
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
import { useData } from "@/context/data-context";
import { useToast } from "@/hooks/use-toast";
import { User, Role } from "@/lib/types";
import { APP_PERMISSIONS } from "@/lib/constants";

const INITIAL_USER_STATE: Partial<User> = {
  fullName: "",
  username: "",
  password: "",
  role: "HR",
  permissions: [],
  status: "Active"
};

export default function UserManagementPage() {
  const { users, setUsers } = useData();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  // State
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userToAction, setUserToAction] = useState<User | null>(null);
  const [formData, setFormData] = useState<Partial<User>>(INITIAL_USER_STATE);
  const [newPassword, setNewPassword] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const filteredUsers = useMemo(() => {
    return (users || []).filter(u => {
      const nameMatch = u.fullName.toLowerCase().includes(searchTerm.toLowerCase());
      const userMatch = u.username.toLowerCase().includes(searchTerm.toLowerCase());
      const roleMatch = roleFilter === "all" || u.role === roleFilter;
      return (nameMatch || userMatch) && roleMatch;
    });
  }, [users, searchTerm, roleFilter]);

  const handleOpenModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({ ...user });
    } else {
      setEditingUser(null);
      setFormData(INITIAL_USER_STATE);
    }
    setIsUserModalOpen(true);
  };

  const handleSaveUser = () => {
    if (!formData.fullName || !formData.username) {
      toast({ variant: "destructive", title: "Missing Fields", description: "Full Name and Username are required." });
      return;
    }

    setIsProcessing(true);
    try {
      if (editingUser) {
        setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, ...formData } as User : u));
        toast({ title: "User Updated", description: `${formData.fullName}'s profile has been updated.` });
      } else {
        const newUser: User = {
          id: Math.random().toString(36).substr(2, 9),
          fullName: formData.fullName!,
          username: formData.username!,
          password: formData.password || "Password@123",
          role: (formData.role as Role) || "HR",
          permissions: formData.permissions || [],
          status: "Active"
        };
        setUsers(prev => [...prev, newUser]);
        toast({ title: "User Created", description: `${newUser.fullName} has been added to the system.` });
      }
      setIsUserModalOpen(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteUser = () => {
    if (!userToAction) return;
    setIsProcessing(true);
    try {
      setUsers(prev => prev.filter(u => u.id !== userToAction.id));
      toast({ title: "User Removed", description: "The administrative account has been deleted." });
      setIsDeleteAlertOpen(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetPassword = () => {
    if (!userToAction || !newPassword) return;
    setIsProcessing(true);
    try {
      setUsers(prev => prev.map(u => u.id === userToAction.id ? { ...u, password: newPassword } : u));
      toast({ title: "Password Reset", description: `Credentials updated for ${userToAction.username}.` });
      setIsResetPasswordOpen(false);
      setNewPassword("");
    } finally {
      setIsProcessing(false);
    }
  };

  const togglePermission = (perm: string) => {
    setFormData(prev => {
      const current = prev.permissions || [];
      const updated = current.includes(perm) 
        ? current.filter(p => p !== perm) 
        : [...current, perm];
      return { ...prev, permissions: updated };
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-muted-foreground">Control system access and assign administrative roles.</p>
        </div>
        <Button className="font-bold shadow-lg shadow-primary/20 bg-primary" onClick={() => handleOpenModal()}>
          <UserPlus className="w-4 h-4 mr-2" />
          Create User
        </Button>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by name or username..." 
                className="pl-10 h-10 bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full md:w-[180px] bg-white">
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
                <TableHead className="text-right font-bold pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No administrative users found.</TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id} className="hover:bg-slate-50/50">
                    <TableCell className="font-bold">{user.fullName}</TableCell>
                    <TableCell className="font-mono text-primary text-xs">{user.username}</TableCell>
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
                        {user.permissions.map(p => (
                          <Badge key={p} variant="outline" className="text-[10px] py-0">{p}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={user.status === 'Active' ? 'bg-emerald-600' : 'bg-slate-400'}>{user.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => handleOpenModal(user)}>
                            <Pencil className="w-4 h-4 mr-2" /> Edit Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setUserToAction(user); setIsResetPasswordOpen(true); }}>
                            <Key className="w-4 h-4 mr-2" /> Reset Password
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-rose-600"
                            onClick={() => { setUserToAction(user); setIsDeleteAlertOpen(true); }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Remove User
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* User Create/Edit Dialog */}
      <Dialog open={isUserModalOpen} onOpenChange={setIsUserModalOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              {editingUser ? "Edit System User" : "Create New Administrative User"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-6 py-4">
            <div className="space-y-2">
              <Label className="font-bold">Full Name *</Label>
              <Input 
                placeholder="e.g. John Doe" 
                value={formData.fullName || ""} 
                onChange={(e) => setFormData(p => ({...p, fullName: e.target.value}))}
              />
            </div>
            <div className="space-y-2">
              <Label className="font-bold">Username *</Label>
              <Input 
                placeholder="john.doe" 
                value={formData.username || ""} 
                onChange={(e) => setFormData(p => ({...p, username: e.target.value.toLowerCase()}))}
              />
            </div>
            {!editingUser && (
              <div className="space-y-2">
                <Label className="font-bold">Password *</Label>
                <Input 
                  type="password"
                  placeholder="********" 
                  value={formData.password || ""} 
                  onChange={(e) => setFormData(p => ({...p, password: e.target.value}))}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label className="font-bold">System Role</Label>
              <Select value={formData.role} onValueChange={(v: Role) => setFormData(p => ({...p, role: v}))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="HR">HR</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 space-y-3">
              <Label className="font-bold">Select Page Permissions</Label>
              <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                {APP_PERMISSIONS.map(perm => (
                  <div key={perm} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`perm-${perm}`} 
                      checked={formData.permissions?.includes(perm)}
                      onCheckedChange={() => togglePermission(perm)}
                    />
                    <label htmlFor={`perm-${perm}`} className="text-sm font-medium leading-none cursor-pointer">
                      {perm}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUserModalOpen(false)}>Cancel</Button>
            <Button className="bg-primary px-8 font-bold" onClick={handleSaveUser} disabled={isProcessing}>
              {isProcessing ? "Saving..." : editingUser ? "Update User" : "Post User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={isResetPasswordOpen} onOpenChange={setIsResetPasswordOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-primary" /> Reset Password
            </DialogTitle>
            <DialogDescription>Set a new password for <strong>{userToAction?.username}</strong>.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>New Secure Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  type="password" 
                  className="pl-10" 
                  placeholder="Enter new password" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResetPasswordOpen(false)}>Cancel</Button>
            <Button className="bg-primary font-bold" onClick={handleResetPassword} disabled={isProcessing}>
              Update Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-rose-600" />
            </div>
            <AlertDialogTitle className="text-center">Confirm Removal</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Are you sure you want to remove <strong>{userToAction?.fullName}</strong>? This user will lose all access to the system immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center gap-3">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteUser}
              className="bg-rose-600 hover:bg-rose-700 font-bold"
              disabled={isProcessing}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
