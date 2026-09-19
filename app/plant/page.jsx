'use client';

import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import Modal from '@/components/common/Modal';
import Toast from '@/components/common/Toast';
import {
  Factory,
  Plus,
  Search,
  MapPin,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Compass,
} from 'lucide-react';

export default function PlantPage() {
  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlant, setEditingPlant] = useState(null);
  const [formData, setFormData] = useState({
    plantId: '',
    plantName: '',
    location: '',
    latitude: '',
    longitude: '',
    radiusMeters: 200,
    status: 'Active',
  });
  const [saving, setSaving] = useState(false);

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

  const fetchPlants = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/plants');
      if (res.ok) {
        const data = await safeParseJson(res);
        if (data) setPlants(data.plants || []);
      }
    } catch (err) {
      console.error('Failed to fetch plants:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlants();
  }, []);

  const openCreateModal = () => {
    setEditingPlant(null);
    setFormData({
      plantId: `PLANT-${String(plants.length + 1).padStart(3, '0')}`,
      plantName: '',
      location: '',
      latitude: '',
      longitude: '',
      radiusMeters: 200,
      status: 'Active',
    });
    setModalOpen(true);
  };

  const openEditModal = (plant) => {
    setEditingPlant(plant);
    setFormData({
      plantId: plant.plantId,
      plantName: plant.plantName,
      location: plant.location,
      latitude: plant.latitude,
      longitude: plant.longitude,
      radiusMeters: plant.radiusMeters,
      status: plant.status,
    });
    setModalOpen(true);
  };

  const handleSavePlant = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const url = editingPlant ? `/api/plants/${editingPlant._id}` : '/api/plants';
      const method = editingPlant ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = (await safeParseJson(res)) || {};

      if (!res.ok) {
        setToast({ type: 'error', message: data.error || `Failed to save plant (${res.status}).` });
        setSaving(false);
        return;
      }

      setToast({
        type: 'success',
        message: editingPlant ? 'Plant updated successfully' : 'New Plant added successfully',
      });
      setModalOpen(false);
      fetchPlants();
    } catch (err) {
      console.error('Save plant error:', err);
      setToast({ type: 'error', message: 'Failed to process request.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlant = async (id, name) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    try {
      const res = await fetch(`/api/plants/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setToast({ type: 'success', message: 'Plant removed successfully.' });
        fetchPlants();
      } else {
        const data = (await safeParseJson(res)) || {};
        setToast({ type: 'error', message: data.error || `Failed to delete plant (${res.status}).` });
      }
    } catch {
      setToast({ type: 'error', message: 'Network error deleting plant.' });
    }
  };

  const filteredPlants = plants.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.plantName?.toLowerCase().includes(q) ||
      p.plantId?.toLowerCase().includes(q) ||
      p.location?.toLowerCase().includes(q)
    );
  });

  return (
    <AppLayout requiredPermission="plant">
      <Toast toast={toast} onClose={() => setToast(null)} />

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Plant Management</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Configure authorized manufacturing plants, GPS coordinates, and geofence radii
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm shadow-md shadow-blue-600/20 transition-all cursor-pointer w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Plant</span>
          </button>
        </div>

        {/* Search */}
        <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/80 shadow-xs flex items-center gap-3">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search plant by name, ID, or location..."
            className="w-full text-sm bg-transparent border-none outline-hidden text-slate-800 placeholder-slate-400"
          />
        </div>

        {/* Plants List / Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 min-w-[700px]">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200/70">
                <tr>
                  <th className="px-6 py-4">Plant ID</th>
                  <th className="px-6 py-4">Plant Name</th>
                  <th className="px-6 py-4">Location</th>
                  <th className="px-6 py-4">Coordinates (Lat, Lng)</th>
                  <th className="px-6 py-4">Allowed Radius</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                      Loading plants...
                    </td>
                  </tr>
                ) : filteredPlants.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-slate-400">
                      No matching plants found.
                    </td>
                  </tr>
                ) : (
                  filteredPlants.map((plant, idx) => (
                    <tr key={plant._id || plant.plantId || `plant-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-xs text-blue-600">
                        {plant.plantId}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-900">{plant.plantName}</td>
                      <td className="px-6 py-4 text-slate-600 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{plant.location}</span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-600">
                        {plant.latitude.toFixed(5)}, {plant.longitude.toFixed(5)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-xs">
                          <Compass className="w-3 h-3" />
                          {plant.radiusMeters} Meters
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            plant.status === 'Active'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {plant.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(plant)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                            title="Edit Plant"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeletePlant(plant._id, plant.plantName)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete Plant"
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

      {/* Add / Edit Plant Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingPlant ? 'Edit Plant Details' : 'Add New Manufacturing Plant'}
      >
        <form onSubmit={handleSavePlant} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">
                Plant ID *
              </label>
              <input
                type="text"
                value={formData.plantId}
                onChange={(e) => setFormData({ ...formData, plantId: e.target.value.toUpperCase() })}
                disabled={!!editingPlant}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden disabled:bg-slate-100 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">
                Status
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
              Plant Name *
            </label>
            <input
              type="text"
              value={formData.plantName}
              onChange={(e) => setFormData({ ...formData, plantName: e.target.value })}
              placeholder="e.g. Sikka Industries Plant"
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">
              Location / City *
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g. Ghaziabad, Uttar Pradesh"
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">
                Latitude *
              </label>
              <input
                type="number"
                step="any"
                value={formData.latitude}
                onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                placeholder="28.6692"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">
                Longitude *
              </label>
              <input
                type="number"
                step="any"
                value={formData.longitude}
                onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                placeholder="77.4538"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">
              Allowed Radius in Meters *
            </label>
            <input
              type="number"
              min="10"
              max="50000"
              value={formData.radiusMeters}
              onChange={(e) => setFormData({ ...formData, radiusMeters: Number(e.target.value) })}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Employees can mark attendance only within this perimeter (e.g. 200m).
            </p>
          </div>

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
              {saving ? 'Saving...' : editingPlant ? 'Update Plant' : 'Create Plant'}
            </button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
