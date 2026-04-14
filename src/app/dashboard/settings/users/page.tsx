
"use client";

import { useState, useMemo, useEffect } from "react";
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
  Lock,
  Eye,
  EyeOff,
  Check,
  X,
  SearchIcon
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
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
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

const INITIAL_USER_STATE: Partial<User> = {
  fullName: "",
  username: "",
  password: "",
  role: "HR",
  permissions: ["Dashboard"],
  status: "Active"
};

export default function UserManagementPage() {
  const { users, addRecord, updateRecord, deleteRecord } = useData();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [permissionSearch, setPermissionSearch] = useState("");
  const [isMounted, setIsMounted] = useState(false);

  // Modal States
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userToAction, setUserToAction] = useState<User | null>(null);
  const [formData, setFormData] = useState<Partial<User>>(INITIAL_USER_STATE);
  const [showPassword, setShowPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const filteredUsers = useMemo(() => {
    return (users || []).filter(u => {
      const nameMatch = u.fullName.toLowerCase().includes(searchTerm.toLowerCase());
      const userMatch = u.username.toLowerCase().includes(searchTerm.toLowerCase());
      return nameMatch || userMatch;
    });
  }, [users, searchTerm]);

  const filteredPermissions = useMemo(() => {
    return APP_PERMISSIONS.filter(p => p.toLowerCase().includes(permissionSearch.toLowerCase()));
  }, [permissionSearch]);

  const passwordStrength = useMemo(() => {
    const p = formData.password || "";
    if (!p) return { score: 0, label: "None", color: "bg-slate-200" };
    
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if ((p.match(/[0-9]/g) || []).length >= 3) score++;
    if (/[@#$%&]/.test(p)) score++;

    if (score <= 1) return { score, label: "Weak", color: "bg-rose-500" };
    if (score <= 3) return { score, label: "Medium", color: "bg-amber-500" };
    return { score, label: "Strong", color: "bg-emerald-500" };
  }, [formData.password]);

  const handleOpenModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({ ...user });
    } else {
      setEditingUser(null);
      setFormData({ ...INITIAL_USER_STATE });
    }
    setShowPassword(false);
    setIsUserModalOpen(true);
  };

  const validateUserForm = () => {
    const { fullName, username, password, permissions } = formData;

    // Name Validation
    if (!fullName || !/^[a-zA-Z\s]+$/.test(fullName) || fullName.length < 3) {
      toast({ variant: "destructive", title: "Invalid Name", description: "Alphabets and spaces only (min 3 chars)." });
      return false;
    }

    // Username Validation
    if (!username || username.length < 5 || /\s/.test(username) || !/^[a-z0-9]+$/.test(username)) {
      toast({ variant: "destructive", title: "Invalid Username", description: "Min 5 chars, lowercase and numbers only, no spaces." });
      return false;
    }

    // Uniqueness Check
    const exists = users.find(u => u.username === username && u.id !== editingUser?.id);
    if (exists) {
      toast({ variant: "destructive", title: "Duplicate Username", description: "This username is already taken." });
      return false;
    }

    // Password Validation (only for new users)
    if (!editingUser) {
      if (!password || password.length < 8 || password.length > 16) {
        toast({ variant: "destructive", title: "Invalid Password", description: "Password must be 8-16 characters." });
        return false;
      }
      if (!/[A-Z]/.test(password)) {
        toast({ variant: "destructive", title: "Security Requirement", description: "At least 1 uppercase letter required." });
        return false;
      }
      if ((password.match(/[0-9]/g) || []).length < 3) {
        toast({ variant: "destructive", title: "Security Requirement", description: "At least 3 numeric digits required." });
        return false;
      }
      if (!/[@#$%&]/.test(password)) {
        toast({ variant: "destructive", title: "Security Requirement", description: "At least 1 special character (@, #, $, %, &) required." });
        return false;
      }
    }

    return true;
  };

  const handleSaveUser = () => {
    if (!validateUserForm()) return;

    setIsProcessing(true);
    try {
      const userData = {
        fullName: formData.fullName!,
        username: formData.username!,
        role: (formData.role as Role) || "HR",
        permissions: formData.permissions || ["Dashboard"],
        status: "Active"
      };

      if (editingUser) {
        updateRecord('users', editingUser.id, userData);
        toast({ title: "User Updated", description: "Profile permissions saved successfully." });
      } else {
        addRecord('users', { ...userData, password: formData.password });
        toast({ title: "User Created", description: `${userData.fullName} added with controlled access.` });
      }
      setIsUserModalOpen(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const togglePermission = (perm: string) => {
    const current = formData.permissions || [];
    const updated = current.includes(perm) 
      ? current.filter(p => p !== perm) 
      : [...current, perm];
    setFormData(p => ({ ...p, permissions: updated }));
  };

  const selectAllPermissions = () => {
    setFormData(p => ({ ...p, permissions: ["Dashboard", ...APP_PERMISSIONS] }));
  };

  const clearAllPermissions = () => {
    setFormData(p => ({ ...p, permissions: ["Dashboard"] }));
  };

  if (!isMounted) return null;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Access Control Center</h1>
          <p className="text-muted-foreground">Provision secure user accounts with page-level restrictions.</p>
        </div>
        <Button className="font-bold shadow-lg shadow-primary/20 bg-primary" onClick={() => handleOpenModal()}>
          <UserPlus className="w-4 h-4 mr-2" />
          Create Security User
        </Button>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search administrators..." className="pl-10 h-10 bg-white" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
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
                <TableHead className="text-right font-bold pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id} className="hover:bg-slate-50/50">
                  <TableCell className="font-bold">{user.fullName}</TableCell>
                  <TableCell className="font-mono text-primary text-xs tracking-tight">{user.username}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] uppercase font-black bg-white border-slate-200">
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {user.permissions?.slice(0, 3).map(p => (
                        <Badge key={p} variant="secondary" className="text-[9px] bg-slate-100 border-none font-bold">{p}</Badge>
                      ))}
                      {(user.permissions?.length || 0) > 3 && (
                        <Badge variant="secondary" className="text-[9px] bg-primary/5 text-primary border-none font-bold">+{user.permissions!.length - 3} more</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4 text-slate-400" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => handleOpenModal(user)} className="font-semibold"><Pencil className="w-4 h-4 mr-2" /> Edit Permissions</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setUserToAction(user); setIsResetPasswordOpen(true); }} className="font-semibold"><Key className="w-4 h-4 mr-2" /> Change Password</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-rose-600 font-bold" onClick={() => { setUserToAction(user); setIsDeleteAlertOpen(true); }} disabled={user.role === 'SUPER_ADMIN'}><Trash2 className="w-4 h-4 mr-2" /> Deactivate User</DropdownMenuItem>
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
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="text-xl font-black flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-primary" />
              {editingUser ? `Edit Access: ${editingUser.fullName}` : "Create New Managed User"}
            </DialogTitle>
            <DialogDescription>Define identity and assign modular page permissions.</DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1 p-6">
            <div className="space-y-8">
              {/* Identity Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase text-slate-400">Full Name *</Label>
                  <Input 
                    value={formData.fullName || ""} 
                    onChange={(e) => setFormData(p => ({...p, fullName: e.target.value}))} 
                    placeholder="Enter official name"
                    className="h-11 bg-slate-50 border-slate-200 font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase text-slate-400">Username *</Label>
                  <Input 
                    value={formData.username || ""} 
                    onChange={(e) => setFormData(p => ({...p, username: e.target.value.toLowerCase().replace(/\s/g, '')}))} 
                    disabled={editingUser?.role === 'SUPER_ADMIN'} 
                    placeholder="e.g. john.doe"
                    className="h-11 bg-slate-50 border-slate-200 font-mono"
                  />
                </div>
                
                {!editingUser && (
                  <div className="md:col-span-2 space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase text-slate-400">Secure Password *</Label>
                      <div className="relative">
                        <Input 
                          type={showPassword ? "text" : "password"}
                          value={formData.password || ""} 
                          onChange={(e) => setFormData(p => ({...p, password: e.target.value}))} 
                          placeholder="8-16 chars, 1 Upper, 3 Digits, 1 Special"
                          className="h-11 bg-slate-50 border-slate-200 font-mono pr-10"
                        />
                        <button 
                          className="absolute right-3 top-3 text-slate-400 hover:text-primary transition-colors"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                    
                    {/* Password Strength Indicator */}
                    <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-black uppercase text-slate-400">Strength Indicator</span>
                        <span className={cn("text-[10px] font-black uppercase", passwordStrength.label === 'Strong' ? "text-emerald-600" : passwordStrength.label === 'Medium' ? "text-amber-600" : "text-rose-600")}>
                          {passwordStrength.label}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden flex gap-1">
                        <div className={cn("h-full transition-all duration-500", passwordStrength.score >= 1 ? passwordStrength.color : "bg-transparent")} style={{ width: '25%' }} />
                        <div className={cn("h-full transition-all duration-500", passwordStrength.score >= 2 ? passwordStrength.color : "bg-transparent")} style={{ width: '25%' }} />
                        <div className={cn("h-full transition-all duration-500", passwordStrength.score >= 3 ? passwordStrength.color : "bg-transparent")} style={{ width: '25%' }} />
                        <div className={cn("h-full transition-all duration-500", passwordStrength.score >= 4 ? passwordStrength.color : "bg-transparent")} style={{ width: '25%' }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Permissions Section */}
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">Assign Page Access</h3>
                    <p className="text-[10px] text-muted-foreground font-bold">Select the modules this user can view and interact with.</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="h-8 text-[10px] font-black uppercase tracking-tighter" onClick={selectAllPermissions}>Select All</Button>
                    <Button variant="ghost" size="sm" className="h-8 text-[10px] font-black uppercase tracking-tighter text-rose-500" onClick={clearAllPermissions}>Clear</Button>
                  </div>
                </div>

                <div className="relative">
                  <SearchIcon className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input 
                    placeholder="Search modules..." 
                    className="pl-10 h-10 bg-slate-50 border-slate-200 rounded-lg text-sm"
                    value={permissionSearch}
                    onChange={(e) => setPermissionSearch(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {filteredPermissions.map(perm => {
                    const isSelected = formData.permissions?.includes(perm);
                    return (
                      <div 
                        key={perm}
                        onClick={() => togglePermission(perm)}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-xl border-2 transition-all cursor-pointer",
                          isSelected 
                            ? "bg-primary/5 border-primary text-primary" 
                            : "bg-white border-slate-100 text-slate-500 hover:border-slate-200"
                        )}
                      >
                        <span className="text-xs font-bold">{perm}</span>
                        {isSelected ? (
                          <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center text-white">
                            <Check className="w-3 h-3" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 bg-slate-50 border border-slate-200 rounded-full" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="p-6 bg-slate-50 border-t">
            <Button variant="ghost" onClick={() => setIsUserModalOpen(false)} className="rounded-xl font-bold h-12 px-8">Cancel</Button>
            <Button 
              onClick={handleSaveUser} 
              disabled={isProcessing}
              className="bg-primary rounded-xl font-black h-12 px-12 shadow-lg shadow-primary/20"
            >
              {isProcessing ? "Processing..." : editingUser ? "Save Changes" : "Create Secure User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={isResetPasswordOpen} onOpenChange={setIsResetPasswordOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Credentials</DialogTitle>
            <DialogDescription>Reset password for {userToAction?.username}</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>New Secure Password</Label>
              <Input 
                type="password"
                placeholder="Enter new password"
                className="h-11 bg-slate-50"
                value={formData.password || ""}
                onChange={(e) => setFormData(p => ({...p, password: e.target.value}))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsResetPasswordOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveUser} disabled={isProcessing}>Update Password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
              Confirm User Deactivation
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{userToAction?.fullName}</strong>? They will lose all access to assigned pages immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (userToAction) {
                  deleteRecord('users', userToAction.id);
                  toast({ title: "User Deactivated" });
                  setIsDeleteAlertOpen(false);
                }
              }} 
              className="bg-rose-600 hover:bg-rose-700"
            >
              Confirm Deactivation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
