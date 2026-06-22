'use client';

import { format } from 'date-fns';
import { Save, Calendar, Users2 } from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'react-hot-toast';

import api from '@/lib/api';
import { useProjectStore, Project } from '@/store/project';

interface ProjectInfoTabProps {
  project: Project;
}

export default function ProjectInfoTab({ project }: ProjectInfoTabProps) {
  const { setProject, fetchProjects } = useProjectStore();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Project name is required');
      return;
    }

    setSaving(true);
    try {
      const res = await api.patch(`/projects/${project.id}`, {
        name: name.trim(),
        description: description.trim() || null,
      });

      const updatedProject = res.data.data;

      // Update local store
      setProject({
        ...project,
        name: updatedProject.name,
        description: updatedProject.description,
      });

      // Fetch all projects to refresh sidebar list
      await fetchProjects();
      toast.success('Project details updated successfully');
    } catch (error) {
      console.error('Failed to update project:', error);
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      const errMsg = err.response?.data?.error?.message || 'Failed to update project';
      toast.error(errMsg);
    } finally {
      setSaving(false);
    }
  };

  const createdDate = new Date(project.created_at);
  const formattedDate = isNaN(createdDate.getTime()) ? 'N/A' : format(createdDate, 'MMMM d, yyyy');

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-lg font-bold text-slate-200">Project Information</h2>
        <p className="text-xs text-slate-500 mt-1">
          Manage your project name and public description details.
        </p>
      </div>

      <div className="space-y-4">
        {/* Name input */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="projectName" className="text-xs font-bold text-slate-400">
            Project Name
          </label>
          <input
            id="projectName"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={saving}
            className="px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950/60 text-slate-100 text-sm focus:outline-none focus:border-indigo-500/80 transition disabled:opacity-60 disabled:cursor-not-allowed"
            placeholder="Enter project name"
            required
          />
        </div>

        {/* Description input */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="projectDesc" className="text-xs font-bold text-slate-400">
            Description
          </label>
          <textarea
            id="projectDesc"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={saving}
            className="px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950/60 text-slate-100 text-sm focus:outline-none focus:border-indigo-500/80 transition resize-none disabled:opacity-60 disabled:cursor-not-allowed"
            placeholder="Optional project description..."
          />
        </div>

        {/* Read-only stats grid */}
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="flex items-center gap-3 p-4 rounded-xl border border-slate-900 bg-slate-950/40">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Calendar size={18} />
            </div>
            <div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                Created On
              </div>
              <div className="text-xs font-semibold text-slate-300 mt-0.5">{formattedDate}</div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 rounded-xl border border-slate-900 bg-slate-950/40">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Users2 size={18} />
            </div>
            <div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                Team Size
              </div>
              <div className="text-xs font-semibold text-slate-300 mt-0.5">
                {project.member_count ?? 1} members
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-2 border-t border-slate-900">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition disabled:bg-slate-850 disabled:text-slate-500 disabled:cursor-not-allowed shadow-md shadow-indigo-950/20"
        >
          <Save size={16} />
          <span>{saving ? 'Saving...' : 'Save Changes'}</span>
        </button>
      </div>
    </form>
  );
}
