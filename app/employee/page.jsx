'use client';

import React, { useState, useEffect, useRef } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import Modal from '@/components/common/Modal';
import Toast from '@/components/common/Toast';
import {
  Users,
  UserPlus,
  UploadCloud,
  Download,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  FileSpreadsheet,
  AlertTriangle,
  RefreshCw,
  Eye,
  Shield,
} from 'lucide-react';
import { maskAadhaar } from '@/lib/timezone';

export default function EmployeePage() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [authFilter, setAuthFilter] = useState('');
  const [toast, setToast] = useState(null);

  // Add / Edit Modal
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [formData, setFormData] = useState({
    employeeId: '',
    fullName: '',
    designation: '',
    aadhaarNumber: '',
    mobileNumber: '',
    attendanceAuthorized: true,
    status: 'Active',
  });
  const [saving, setSaving] = useState(false);

  // Bulk Upload Modal
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSummary, setUploadSummary] = useState(null);
  const fileInputRef = useRef(null);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (authFilter) params.set('authorization', authFilter);

      const res = await fetch(`/api/employees?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setEmployees(data.employees || []);
      }
    } catch (err) {
      console.error('Failed to fetch employees:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [statusFilter, authFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchEmployees();
  };

  const openCreateModal = () => {
    setEditingEmployee(null);
    setFormData({
      employeeId: `EMP${String(employees.length + 1).padStart(3, '0')}`,
      fullName: '',
      designation: '',
      aadhaarNumber: '',
      mobileNumber: '',
      attendanceAuthorized: true,
      status: 'Active',
    });
    setEmployeeModalOpen(true);
  };

  const openEditModal = (emp) => {
    setEditingEmployee(emp);
    setFormData({
      employeeId: emp.employeeId,
      fullName: emp.fullName,
      designation: emp.designation,
      aadhaarNumber: emp.aadhaarNumber,
      mobileNumber: emp.mobileNumber,
      attendanceAuthorized: emp.attendanceAuthorized,
      status: emp.status,
    });
    setEmployeeModalOpen(true);
  };

  const handleSaveEmployee = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const url = editingEmployee ? `/api/employees/${editingEmployee._id}` : '/api/employees';
      const method = editingEmployee ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setToast({ type: 'error', message: data.error || 'Failed to save employee.' });
        setSaving(false);
        return;
      }

      setToast({
        type: 'success',
        message: editingEmployee ? 'Employee updated successfully' : 'Employee created successfully',
      });
      setEmployeeModalOpen(false);
      fetchEmployees();
    } catch (err) {
      console.error('Save error:', err);
      setToast({ type: 'error', message: 'Failed to process employee record.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEmployee = async (id, name) => {
    if (!confirm(`Are you sure you want to delete employee "${name}"?`)) return;

    try {
      const res = await fetch(`/api/employees/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setToast({ type: 'success', message: 'Employee deleted.' });
        fetchEmployees();
      } else {
        const data = await res.json();
        setToast({ type: 'error', message: data.error || 'Failed to delete.' });
      }
    } catch {
      setToast({ type: 'error', message: 'Network error deleting employee.' });
    }
  };

  const handleBulkUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      setToast({ type: 'warning', message: 'Please select an Excel (.xlsx) or CSV file first.' });
      return;
    }

    setUploading(true);
    setUploadSummary(null);

    try {
      const form = new FormData();
      form.append('file', uploadFile);

      const res = await fetch('/api/employees/bulk-upload', {
        method: 'POST',
        body: form,
      });

      const data = await res.json();

      if (!res.ok) {
        setToast({ type: 'error', message: data.error || 'Bulk upload failed.' });
        setUploading(false);
        return;
      }

      setUploadSummary(data);
      setToast({
        type: data.summary.failedRecords > 0 ? 'warning' : 'success',
        message: `Import completed: ${data.summary.successfullyImported} added, ${data.summary.failedRecords} issues.`,
      });
      fetchEmployees();
    } catch (err) {
      console.error('Upload error:', err);
      setToast({ type: 'error', message: 'Bulk upload error. Please check file format.' });
    } finally {
      setUploading(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      setToast({ type: 'info', message: 'Preparing employee Excel export...' });
      const res = await fetch('/api/employees/export');
      if (!res.ok) throw new Error('Failed to generate export');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `employee_directory_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setToast({ type: 'success', message: 'Employee records exported successfully.' });
    } catch (e) {
      console.error('Export error:', e);
      setToast({ type: 'error', message: 'Failed to export employee records.' });
    }
  };

  return (
    <AppLayout requiredPermission="employee">
      <Toast toast={toast} onClose={() => setToast(null)} />

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Employee Management</h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage workforce profiles, credentials, Aadhaar security, and attendance authorization
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-2.5">
            <a
              href="/api/employees/template"
              download
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              title="Download Excel template for bulk import"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>Template</span>
            </a>

            <button
              onClick={() => {
                setUploadSummary(null);
                setUploadFile(null);
                setBulkModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <UploadCloud className="w-4 h-4 text-blue-600" />
              <span>Bulk Upload</span>
            </button>

            {/* Section 27: Export Excel */}
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Export Excel</span>
            </button>

            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Employee</span>
            </button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="flex-1 w-full flex items-center gap-2">
            <Search className="w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Employee ID, Full Name, Designation, Mobile..."
              className="w-full text-sm bg-transparent border-none outline-hidden text-slate-800 placeholder-slate-400"
            />
          </form>

          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
            >
              <option value="">All Statuses</option>
              <option value="Active">Active Only</option>
              <option value="Inactive">Inactive Only</option>
            </select>

            <select
              value={authFilter}
              onChange={(e) => setAuthFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
            >
              <option value="">All Authorizations</option>
              <option value="Authorized">Authorized Only</option>
              <option value="Not Authorized">Not Authorized Only</option>
            </select>

            <button
              onClick={fetchEmployees}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Employee Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200/70">
                <tr>
                  <th className="px-6 py-4">Employee ID</th>
                  <th className="px-6 py-4">Full Name</th>
                  <th className="px-6 py-4">Designation</th>
                  <th className="px-6 py-4">Aadhaar (Username)</th>
                  <th className="px-6 py-4">Mobile (Password)</th>
                  <th className="px-6 py-4">Attendance Access</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-slate-400">
                      Loading employee records...
                    </td>
                  </tr>
                ) : employees.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                      No employees match the specified criteria.
                    </td>
                  </tr>
                ) : (
                  employees.map((emp, idx) => (
                    <tr key={emp._id || emp.employeeId || `emp-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-xs text-blue-600">
                        {emp.employeeId}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-900">{emp.fullName}</td>
                      <td className="px-6 py-4 text-slate-600">{emp.designation}</td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-600">
                        {maskAadhaar(emp.aadhaarNumber)}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-600">
                        {emp.mobileNumber}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            emp.attendanceAuthorized
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {emp.attendanceAuthorized ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Authorized</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3" />
                              <span>Not Authorized</span>
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            emp.status === 'Active'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {emp.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(emp)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                            title="Edit Employee"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteEmployee(emp._id, emp.fullName)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete Employee"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {/* Add / Edit Employee Modal */}
      <Modal
        isOpen={employeeModalOpen}
        onClose={() => setEmployeeModalOpen(false)}
        title={editingEmployee ? 'Edit Employee Profile' : 'Add New Employee'}
      >
        <form onSubmit={handleSaveEmployee} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">
                Employee ID *
              </label>
              <input
                type="text"
                value={formData.employeeId}
                onChange={(e) => setFormData({ ...formData, employeeId: e.target.value.toUpperCase() })}
                disabled={!!editingEmployee}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden disabled:bg-slate-100 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">
                Status *
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">
              Employee Full Name *
            </label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              placeholder="e.g. Ramesh Kumar"
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">
              Designation *
            </label>
            <input
              type="text"
              value={formData.designation}
              onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
              placeholder="e.g. Senior Technician"
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">
              Aadhaar Number (Username) *
            </label>
            <input
              type="text"
              maxLength={12}
              pattern="\d{12}"
              value={formData.aadhaarNumber}
              onChange={(e) => setFormData({ ...formData, aadhaarNumber: e.target.value.replace(/\D/g, '') })}
              disabled={!!editingEmployee}
              placeholder="12 digits"
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden disabled:bg-slate-100 font-mono tracking-wider"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Serves as employee login username. Masked in normal listings.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">
              Mobile Number (Password) *
            </label>
            <input
              type="tel"
              maxLength={10}
              pattern="\d{10}"
              value={formData.mobileNumber}
              onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value.replace(/\D/g, '') })}
              placeholder="10 digits"
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Hashed securely with bcrypt. Serves as employee login password.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">
              Attendance Authorization *
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="auth"
                  checked={formData.attendanceAuthorized === true}
                  onChange={() => setFormData({ ...formData, attendanceAuthorized: true })}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span>Authorized to Mark Attendance</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="auth"
                  checked={formData.attendanceAuthorized === false}
                  onChange={() => setFormData({ ...formData, attendanceAuthorized: false })}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span>Not Authorized</span>
              </label>
            </div>
          </div>

          <div className="pt-3 flex justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setEmployeeModalOpen(false)}
              className="py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="py-2.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md shadow-blue-600/20 transition-all cursor-pointer"
            >
              {saving ? 'Saving...' : editingEmployee ? 'Update Profile' : 'Save Employee'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Bulk Upload Modal (Section 18) */}
      <Modal
        isOpen={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        title="Bulk Employee Upload"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-5">
          {/* Download Template Section */}
          <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-blue-900">Download Bulk Upload Template</p>
              <p className="text-xs text-blue-700 mt-0.5">
                Pre-formatted headers for Employee ID, Name, Designation, Aadhaar, Mobile, etc.
              </p>
            </div>
            <div className="flex gap-2">
              <a
                href="/api/employees/template?format=xlsx"
                download
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Excel (.xlsx)</span>
              </a>
              <a
                href="/api/employees/template?format=csv"
                download
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-blue-200 text-blue-800 hover:bg-blue-50 font-semibold text-xs shadow-xs transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV</span>
              </a>
            </div>
          </div>

          {/* File Upload Form */}
          <form onSubmit={handleBulkUpload} className="space-y-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-6 text-center cursor-pointer bg-slate-50/50 hover:bg-blue-50/20 transition-all"
            >
              <UploadCloud className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">
                {uploadFile ? uploadFile.name : 'Click to select CSV or Excel (.xlsx) file'}
              </p>
              <p className="text-xs text-slate-400 mt-1">Maximum file size: 5MB</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="hidden"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setBulkModalOpen(false)}
                className="py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={uploading || !uploadFile}
                className="py-2.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md shadow-blue-600/20 transition-all disabled:opacity-60 cursor-pointer"
              >
                {uploading ? 'Processing File...' : 'Upload & Import'}
              </button>
            </div>
          </form>

          {/* Import Result Summary Card (Section 18) */}
          {uploadSummary && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Import Process Result
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
                <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                  <span className="text-slate-500 block text-[10px]">Total Records</span>
                  <span className="font-extrabold text-sm text-slate-800">
                    {uploadSummary.summary.totalRecords}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span className="text-emerald-600 block text-[10px]">Imported</span>
                  <span className="font-extrabold text-sm text-emerald-700">
                    {uploadSummary.summary.successfullyImported}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200">
                  <span className="text-rose-600 block text-[10px]">Failed</span>
                  <span className="font-extrabold text-sm text-rose-700">
                    {uploadSummary.summary.failedRecords}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                  <span className="text-amber-600 block text-[10px]">Duplicates</span>
                  <span className="font-extrabold text-sm text-amber-700">
                    {uploadSummary.summary.duplicateRecords}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200">
                  <span className="text-purple-600 block text-[10px]">Invalid Format</span>
                  <span className="font-extrabold text-sm text-purple-700">
                    {uploadSummary.summary.invalidRecords}
                  </span>
                </div>
              </div>

              {/* Error Details Log if any */}
              {uploadSummary.errors && uploadSummary.errors.length > 0 && (
                <div className="mt-3">
                  <p className="text-[11px] font-bold text-rose-600 mb-1">Issue Details:</p>
                  <div className="max-h-36 overflow-y-auto bg-white rounded-xl border border-rose-100 p-2 space-y-1 text-[11px] text-slate-700">
                    {uploadSummary.errors.map((err, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-rose-700">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        <span>
                          Row {err.row} ({err.employeeId}): {err.message}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </AppLayout>
  );
}
