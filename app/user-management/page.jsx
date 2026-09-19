'use client';

import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import Modal from '@/components/common/Modal';
import Toast from '@/components/common/Toast';
import {
  ShieldCheck,
  UserPlus,
  Search,
  Key,
  Edit2,
  Trash2,
  CheckCircle2,
  Lock,
  Eye,
  EyeOff,
  Building2,
  Layers,
} from 'lucide-react';

const AVAILABLE_PERMISSIONS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'plant', label: 'Plant' },
  { id: 'approval', label: 'Approval' },
  { id: 'report', label: 'Report' },
  { id: 'employee', label: 'Employee' },
  { id: 'user-management', label: 'User Management' },
];

export default function UserManagementPage() {
  const [users, setUsers] = useState([]);
  const [plantsList, setPlantsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);

  // User Add/Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    userId: '',
    fullName: '',
    username: '',
    password: '',
    confirmPassword: '',
    role: 'User',
    status: 'Active',
    permissions: ['dashboard'],
    plantIds: ['*'],
  });
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  // Password Reset Modal
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [targetUser, setTargetUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  const safeParseJson = async (res) => {
    if (!res) return null;
    try {
      const text = await res.text();
      if (!text) return null;
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    } catch {
      return null;
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await safeParseJson(res);
        if (data) setUsers(data.users || []);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlants = async () => {
    try {
      const res = await fetch('/api/plants?all=true');
      if (res.ok) {
        const data = await safeParseJson(res);
        if (data) setPlantsList(data.plants || []);
      }
    } catch (err) {
      console.error('Failed to fetch plants:', err);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchPlants();
  }, []);

  const openCreateModal = () => {
    setEditingUser(null);
    setFormData({
      userId: `USR-${String(users.length + 1).padStart(3, '0')}`,
      fullName: '',
      username: '',
      password: '',
      confirmPassword: '',
      role: 'User',
      status: 'Active',
      permissions: ['dashboard', 'approval', 'report', 'employee'],
      plantIds: ['*'],
    });
    setShowPassword(false);
    setModalOpen(true);
  };

  const openEditModal = (u) => {
    setEditingUser(u);
    const userPlantIds = Array.isArray(u.plantIds) && u.plantIds.length > 0 ? u.plantIds : ['*'];
    setFormData({
      userId: u.userId,
      fullName: u.fullName || '',
      username: u.username || '',
      password: '',
      confirmPassword: '',
      role: u.role || 'User',
      status: u.status || 'Active',
      permissions: Array.isArray(u.permissions) && u.permissions.length > 0 ? u.permissions : ['dashboard'],
      plantIds: userPlantIds,
    });
    setShowPassword(false);
    setModalOpen(true);
  };

  const handleTogglePermission = (permId) => {
    setFormData((prev) => {
      const exists = prev.permissions.includes(permId);
      const updated = exists
        ? prev.permissions.filter((p) => p !== permId)
        : [...prev.permissions, permId];
      return { ...prev, permissions: updated };
    });
  };

  const isAllPlantsSelected =
    formData.plantIds.includes('*') ||
    formData.plantIds.includes('ALL') ||
    formData.plantIds.includes('all') ||
    formData.plantIds.includes('All Plants');

  const handleToggleAllPlants = () => {
    setFormData((prev) => {
      if (isAllPlantsSelected) {
        return { ...prev, plantIds: [] };
      } else {
        return { ...prev, plantIds: ['*'] };
      }
    });
  };

  const handleTogglePlant = (plantNameOrId) => {
    setFormData((prev) => {
      let current = [...prev.plantIds];
      if (isAllPlantsSelected) {
        // Expand All Plants to individual plants
        current = plantsList.map((p) => p.plantName || p.plantId);
      }
      current = current.filter((id) => id !== '*' && id !== 'ALL' && id !== 'all' && id !== 'All Plants');

      if (current.includes(plantNameOrId)) {
        current = current.filter((id) => id !== plantNameOrId);
      } else {
        current.push(plantNameOrId);
        // If all plants selected individually, switch to All Plants indicator
        if (plantsList.length > 0 && current.length >= plantsList.length) {
          current = ['*'];
        }
      }
      return { ...prev, plantIds: current };
    });
  };

  const isPlantChecked = (plant) => {
    if (isAllPlantsSelected) return true;
    const nameMatch = plant.plantName && formData.plantIds.includes(plant.plantName);
    const idMatch = plant.plantId && formData.plantIds.includes(plant.plantId);
    const mongoIdMatch = plant._id && formData.plantIds.includes(plant._id);
    return Boolean(nameMatch || idMatch || mongoIdMatch);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();

    if (!formData.fullName.trim()) {
      setToast({ type: 'error', message: 'Full Name is required.' });
      return;
    }

    if (!formData.username.trim()) {
      setToast({ type: 'error', message: 'Username is required.' });
      return;
    }

    if (!editingUser) {
      if (!formData.password) {
        setToast({ type: 'error', message: 'Password is required.' });
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setToast({ type: 'error', message: 'Password and Confirm Password do not match.' });
        return;
      }
    } else {
      if (formData.password && formData.password !== formData.confirmPassword) {
        setToast({ type: 'error', message: 'Password and Confirm Password do not match.' });
        return;
      }
    }

    if (formData.permissions.length === 0) {
      setToast({ type: 'error', message: 'Please select at least one page in Access Pages.' });
      return;
    }

    if (formData.plantIds.length === 0) {
      setToast({ type: 'error', message: 'Please select at least one plant in Access Plant (or All Plants).' });
      return;
    }

    setSaving(true);

    try {
      const targetId = editingUser?._id || editingUser?.id || editingUser?.userId;
      const url = editingUser ? `/api/users/${targetId}` : '/api/users';
      const method = editingUser ? 'PUT' : 'POST';

      const payload = {
        fullName: formData.fullName.trim(),
        username: formData.username.trim().toLowerCase(),
        role: formData.role,
        status: formData.status,
        permissions: formData.permissions,
        plantIds: formData.plantIds,
      };

      if (!editingUser) {
        payload.userId = formData.userId;
        payload.password = formData.password;
      } else if (formData.password) {
        payload.password = formData.password;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = (await safeParseJson(res)) || {};

      if (!res.ok) {
        setToast({ type: 'error', message: data.error || `Failed to save user (${res.status}).` });
        setSaving(false);
        return;
      }

      setToast({
        type: 'success',
        message: editingUser ? 'User updated successfully.' : 'User created successfully.',
      });
      setModalOpen(false);
      setEditingUser(null);

      // Immediately display in table without manual refresh
      if (editingUser) {
        setUsers((prev) =>
          prev.map((u) => {
            const uKey = u._id || u.id || u.userId;
            return uKey === targetId ? { ...u, ...data.user } : u;
          })
        );
      } else if (data.user) {
        setUsers((prev) => [data.user, ...prev]);
      }

      await fetchUsers();
    } catch (err) {
      console.error('Save user error:', err);
      setToast({ type: 'error', message: 'Network error saving user.' });
    } finally {
      setSaving(false);
    }
  };

  const openResetModal = (u) => {
    setTargetUser(u);
    setNewPassword('');
    setConfirmNewPassword('');
    setResetModalOpen(true);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword !== confirmNewPassword) {
      setToast({ type: 'error', message: 'Passwords do not match.' });
      return;
    }

    setResetting(true);
    try {
      const res = await fetch(`/api/users/${targetUser._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      });

      if (res.ok) {
        setToast({ type: 'success', message: `Password for @${targetUser.username} has been changed.` });
        setResetModalOpen(false);
      } else {
        const data = (await safeParseJson(res)) || {};
        setToast({ type: 'error', message: data.error || `Failed to change password (${res.status}).` });
      }
    } catch {
      setToast({ type: 'error', message: 'Error updating password.' });
    } finally {
      setResetting(false);
    }
  };

  const handleDeleteUser = async (id, username) => {
    if (username === 'ajaysomra') {
      alert('The primary administrator account cannot be deleted.');
      return;
    }
    if (!confirm(`Are you sure you want to delete user "${username}"?`)) return;

    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setToast({ type: 'success', message: 'User deleted successfully.' });
        setUsers((prev) => prev.filter((item) => (item._id || item.id || item.userId) !== id && item.username !== username));
        await fetchUsers();
      } else {
        const data = (await safeParseJson(res)) || {};
        setToast({ type: 'error', message: data.error || `Delete failed (${res.status}).` });
      }
    } catch {
      setToast({ type: 'error', message: 'Failed to delete user.' });
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.fullName?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      u.userId?.toLowerCase().includes(q)
    );
  });

  return (
    <AppLayout requiredPermission="user-management">
      <Toast toast={toast} onClose={() => setToast(null)} />

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 mb-1.5 border border-blue-100">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Security & User Control</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              User Management
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Create system users, configure granular Access Pages, and control plant-level data permissions
            </p>
          </div>

          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add User</span>
          </button>
        </div>

        {/* Search */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center gap-3">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users by name, username, or User ID..."
            className="w-full text-sm bg-transparent border-none outline-hidden text-slate-800 placeholder:text-slate-400 font-medium"
          />
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3.5">User ID</th>
                  <th className="px-5 py-3.5">Full Name</th>
                  <th className="px-5 py-3.5">Username</th>
                  <th className="px-5 py-3.5">Access Pages</th>
                  <th className="px-5 py-3.5">Access Plant</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-slate-400 font-medium">
                      Loading user accounts...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-slate-400 font-medium">
                      No matching system users found.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u, idx) => {
                    const isAll =
                      u.role === 'Admin' ||
                      u.plantIds?.includes('*') ||
                      u.plantIds?.includes('ALL') ||
                      u.plantIds?.includes('all') ||
                      u.plantIds?.includes('All Plants');

                    return (
                      <tr key={u._id || u.userId || `user-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-3.5 font-mono font-bold text-xs text-blue-600 whitespace-nowrap">
                          {u.userId}
                        </td>
                        <td className="px-5 py-3.5 font-semibold text-slate-900 whitespace-nowrap">
                          {u.fullName}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs text-slate-700 whitespace-nowrap">
                          @{u.username}
                        </td>
                        <td className="px-5 py-3.5">
                          {u.role === 'Admin' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 text-[11px] font-bold">
                              All Pages (Admin)
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {u.permissions?.map((p, pIdx) => (
                                <span
                                  key={`${u._id || idx}-perm-${p}-${pIdx}`}
                                  className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-semibold capitalize whitespace-nowrap"
                                >
                                  {p}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          {isAll ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold whitespace-nowrap">
                              <Building2 className="w-3 h-3" />
                              <span>All Plants</span>
                            </span>
                          ) : u.plantIds && u.plantIds.length > 0 ? (
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {u.plantIds.map((pName, pIdx) => (
                                <span
                                  key={`${u._id || idx}-plant-${pName}-${pIdx}`}
                                  className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-semibold whitespace-nowrap"
                                >
                                  {pName}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[11px] text-rose-500 font-semibold italic">
                              No Plant Access
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              u.status === 'Active'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}
                          >
                            {u.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openResetModal(u)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
                              title="Reset Password"
                            >
                              <Key className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openEditModal(u)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                              title="Edit User"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {u.username !== 'ajaysomra' && (
                              <button
                                onClick={() => handleDeleteUser(u._id || u.id || u.userId, u.username)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Delete User"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add / Edit User Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingUser(null);
        }}
        title={editingUser ? `Edit User: ${editingUser.fullName} (@${editingUser.username})` : 'Add User'}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSaveUser} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Full Name *
              </label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                required
                placeholder="e.g. Neeraj Sharma"
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Username *
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/\s+/g, '') })}
                required
                placeholder="e.g. neeraj"
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 text-slate-800 font-mono font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Password Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                {editingUser ? 'New Password (Optional)' : 'Password *'}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required={!editingUser}
                  placeholder={editingUser ? 'Leave blank to keep current' : 'Enter secure password'}
                  className="w-full pl-3.5 pr-9 py-2 text-xs rounded-xl border border-slate-300 text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                {editingUser ? 'Confirm New Password' : 'Confirm Password *'}
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required={!editingUser || Boolean(formData.password)}
                placeholder={editingUser ? 'Leave blank if not changing' : 'Confirm password'}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Access Pages */}
          <div className="pt-1">
            <label className="block text-xs font-bold text-slate-800 uppercase mb-1.5 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span>Access Pages (Allowed Application Pages) *</span>
            </label>
            <p className="text-[11px] text-slate-500 mb-2">
              Only selected pages will be accessible after login. Direct URL access to unselected pages will be blocked.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
              {AVAILABLE_PERMISSIONS.map((perm) => (
                <label
                  key={perm.id}
                  className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-white text-xs font-medium text-slate-700 hover:text-slate-900 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={formData.permissions.includes(perm.id)}
                    onChange={() => handleTogglePermission(perm.id)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span>{perm.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Access Plant */}
          <div className="pt-1">
            <label className="block text-xs font-bold text-slate-800 uppercase mb-1.5 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Access Plant (Plant-Level Data Security) *</span>
            </label>
            <p className="text-[11px] text-slate-500 mb-2">
              The user will strictly only be able to view, search, edit, and export records for authorized plants.
            </p>
            <div className="space-y-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
              {/* All Plants toggle */}
              <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200/80 text-xs font-bold text-slate-800 cursor-pointer hover:border-emerald-300 transition-colors">
                <input
                  type="checkbox"
                  checked={isAllPlantsSelected}
                  onChange={handleToggleAllPlants}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <span>All Plants (Full access to all current and future plants)</span>
              </label>

              {/* Individual plants */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                {plantsList.map((p) => {
                  const pName = p.plantName || p.name;
                  const isChecked = isPlantChecked(p);

                  return (
                    <label
                      key={p._id || p.plantId}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-white text-xs font-medium text-slate-700 hover:text-slate-900 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleTogglePlant(pName)}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span>{pName}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer Buttons: Create / Update and Cancel */}
          <div className="pt-3 flex justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setModalOpen(false);
                setEditingUser(null);
              }}
              className="py-2.5 px-5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="py-2.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all cursor-pointer"
            >
              {saving ? 'Saving...' : editingUser ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        isOpen={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        title={`Change Password for @${targetUser?.username}`}
      >
        <form onSubmit={handleResetPassword} className="space-y-4">
          <p className="text-xs text-slate-500">
            Set a new secure password for <strong>{targetUser?.fullName}</strong>.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              New Password *
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              placeholder="Enter new password"
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Confirm New Password *
            </label>
            <input
              type="password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              required
              placeholder="Confirm new password"
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          <div className="pt-3 flex justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setResetModalOpen(false)}
              className="py-2.5 px-5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={resetting}
              className="py-2.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all cursor-pointer"
            >
              {resetting ? 'Updating...' : 'Set New Password'}
            </button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
