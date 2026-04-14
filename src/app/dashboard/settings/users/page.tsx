
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
  const { users, addRecord, updateRecord, deleteRecord } = useData();
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
      const userData = {
        fullName: formData.fullName!,
        username: formData.username!,
        role: (formData.role as Role) || "HR",
        permissions: formData.permissions || [],
        status: "Active"
      };

      if (editingUser) {
        updateRecord('users', editingUser.id, userData);
        toast({ title: "User Updated", description: `${formData.fullName}'s profile has been updated.` });
      } else {
        addRecord('users', { ...userData, password: formData.password || "Password@123" });
        toast({ title: "User Created", description: `${userData.fullName} has been added to the system.` });
      }
      setIsUserModalOpen(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteUser = () => {
    if (!userToAction) return;
    if (userToAction.role === 'SUPER_ADMIN') {
      toast({ variant: "destructive", title: "Action Denied", description: "The Super Admin account cannot be deleted." });
      setIsDeleteAlertOpen(false);
      return;
    }

    setIsProcessing(true);
    try {
      deleteRecord('users', userToAction.id);
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
      updateRecord('users', userToAction.id, { password: newPassword });
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
              <Input placeholder="Search..." className="pl-10 h-10 bg-white" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="font-bold">Full Name</TableHead>
                <TableHead className="font-bold">Username</TableHead>
                <TableHead className="font-bold">Role</TableHead>
                <TableHead className="font-bold">Status</TableHead>
                <TableHead className="text-right font-bold pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-bold">{user.fullName}</TableCell>
                  <TableCell className="font-mono text-primary text-xs">{user.username}</TableCell>
                  <TableCell><span className="text-xs font-bold uppercase tracking-tight">{user.role}</span></TableCell>
                  <TableCell><Badge className={user.status === 'Active' ? 'bg-emerald-600' : 'bg-slate-400'}>{user.status}</Badge></TableCell>
                  <TableCell className="text-right pr-6">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => handleOpenModal(user)}><Pencil className="w-4 h-4 mr-2" /> Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setUserToAction(user); setIsResetPasswordOpen(true); }}><Key className="w-4 h-4 mr-2" /> Password</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-rose-600" onClick={() => { setUserToAction(user); setIsDeleteAlertOpen(true); }} disabled={user.role === 'SUPER_ADMIN'}><Trash2 className="w-4 h-4 mr-2" /> Remove</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isUserModalOpen} onOpenChange={setIsUserModalOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>{editingUser ? "Edit User" : "Create User"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-6 py-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={formData.fullName || ""} onChange={(e) => setFormData(p => ({...p, fullName: e.target.value}))} />
            </div>
            <div className="space-y-2">
              <Label>Username</Label>
              <Input value={formData.username || ""} onChange={(e) => setFormData(p => ({...p, username: e.target.value.toLowerCase()}))} disabled={editingUser?.role === 'SUPER_ADMIN'} />
            </div>
          </div>
          <DialogFooter><Button onClick={handleSaveUser} disabled={isProcessing}>Save User</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Remove User?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteUser} className="bg-rose-600">Remove</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
