'use client';
import { Save } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

import api from '@/lib/api';
import { useProjectStore } from '@/store/project';

export default function SettingsPage() {
  const { currentProject } = useProjectStore();
  const [name, setName] = useState(currentProject?.name || '');
  const [desc, setDesc] = useState(currentProject?.description || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!currentProject) return;
    setSaving(true);
    try {
      await api.patch(`/projects/${currentProject.id}`, { name, description: desc });
      toast.success('Settings saved');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (!currentProject)
    return (
      <div className="flex h-[60vh] items-center justify-center text-slate-500">
        Select a project
      </div>
    );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Manage {currentProject.name}</p>
      </div>
      <div className="card space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
            Project Name
          </label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
            Description
          </label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className="input min-h-[80px]"
            rows={3}
          />
        </div>
        <button onClick={handleSave} disabled={saving} className="btn">
          <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
