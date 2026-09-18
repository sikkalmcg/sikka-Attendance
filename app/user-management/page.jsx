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
  });
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  // Password Reset Modal
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [targetUser, setTargetUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
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
      permissions: ['dashboard'],
    });
    setModalOpen(true);
  };

  const openEditModal = (u) => {
    setEditingUser(u);
    setFormData({
      userId: u.userId,
      fullName: u.fullName,
      username: u.username,
      password: '',
      confirmPassword: '',
      role: u.role,
      status: u.status,
      permissions: u.permissions || ['dashboard'],
    });
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

  const handleSaveUser = async (e) => {
    e.preventDefault();

    if (!editingUser) {
      if (!formData.password || formData.password !== formData.confirmPassword) {
        setToast({ type: 'error', message: 'Passwords do not match.' });
        return;
      }
    }

    setSaving(true);

    try {
      const url = editingUser ? `/api/users/${editingUser._id}` : '/api/users';
      const method = editingUser ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setToast({ type: 'error', message: data.error || 'Failed to save system user.' });
        setSaving(false);
        return;
      }

      setToast({
        type: 'success',
        message: editingUser ? 'User updated successfully.' : 'System User created successfully.',
      });
      setModalOpen(false);
      fetchUsers();
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
        setToast({ type: 'success', message: `Password for ${targetUser.username} has been changed.` });
        setResetModalOpen(false);
      } else {
        const data = await res.json();
        setToast({ type: 'error', message: data.error || 'Failed to change password.' });
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
        fetchUsers();
      } else {
        const data = await res.json();
        setToast({ type: 'error', message: data.error || 'Delete failed.' });
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
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">User Management</h1>
            <p className="text-sm text-slate-500 mt-1">
              Create system users, configure granular page access permissions, and manage passwords
            </p>
          </div>

          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md shadow-blue-600/20 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add System User</span>
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
            className="w-full text-sm bg-transparent border-none outline-hidden text-slate-800 placeholder-slate-400"
          />
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200/70">
                <tr>
                  <th className="px-6 py-4">User ID</th>
                  <th className="px-6 py-4">Full Name</th>
                  <th className="px-6 py-4">Username</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Assigned Page Permissions</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                      Loading user accounts...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-slate-400">
                      No matching system users found.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u, idx) => (
                    <tr key={u._id || u.userId || `user-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-xs text-blue-600">
                        {u.userId}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-900">{u.fullName}</td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-700">@{u.username}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            u.role === 'Admin'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200/60'
                              : 'bg-blue-50 text-blue-700 border border-blue-200/60'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {u.role === 'Admin' ? (
                          <span className="text-xs font-semibold text-emerald-600">Full System Access</span>
                        ) : (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {u.permissions?.map((p, pIdx) => (
                              <span
                                key={`${u._id || idx}-perm-${p}-${pIdx}`}
                                className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-medium"
                              >
                                {p}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            u.status === 'Active'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
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
                            title="Edit Permissions"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {u.username !== 'ajaysomra' && (
                            <button
                              onClick={() => handleDeleteUser(u._id, u.username)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Delete User"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add / Edit System User Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingUser ? `Edit User: ${editingUser.username}` : 'Add New System User'}
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSaveUser} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">
                User ID *
              </label>
              <input
                type="text"
                value={formData.userId}
                onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                disabled={!!editingUser}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden disabled:bg-slate-100 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">
                Role *
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                <option value="User">User</option>
                <option value="Admin">Admin</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">
              Full Name *
            </label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">
              Username *
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase() })}
              disabled={!!editingUser}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden disabled:bg-slate-100 font-mono"
            />
          </div>

          {!editingUser && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">
                  Password *
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">
                  Confirm Password *
                </label>
                <input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>
          )}

          {/* Page Access Permissions */}
          {formData.role !== 'Admin' && (
            <div className="pt-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">
                Page Access Permissions (User Access Control)
              </label>
              <div className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/70">
                {AVAILABLE_PERMISSIONS.map((perm) => (
                  <label
                    key={perm.id}
                    className="flex items-center gap-2.5 text-xs text-slate-700 hover:text-slate-900 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={formData.permissions.includes(perm.id)}
                      onChange={() => handleTogglePermission(perm.id)}
                      className="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>{perm.label}</span>
                  </label>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400">
                🔒 Mark Attendance is strictly an Employee-only attendance function and cannot be assigned to system users.
              </p>

            </div>
          )}

          <div className="pt-3 flex justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="py-2.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md shadow-blue-600/20 transition-all cursor-pointer"
            >
              {saving ? 'Saving...' : editingUser ? 'Update User' : 'Create User'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Reset Password Modal (Admin can change passwords here) */}
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
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">
              New Password *
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">
              Confirm New Password *
            </label>
            <input
              type="password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          <div className="pt-3 flex justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setResetModalOpen(false)}
              className="py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={resetting}
              className="py-2.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md shadow-blue-600/20 transition-all cursor-pointer"
            >
              {resetting ? 'Updating...' : 'Set New Password'}
            </button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
