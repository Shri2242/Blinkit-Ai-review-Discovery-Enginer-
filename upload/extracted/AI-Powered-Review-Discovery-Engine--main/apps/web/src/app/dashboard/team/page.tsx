'use client';
import { Users } from 'lucide-react';

import { useProjectStore } from '@/store/project';

export default function TeamPage() {
  const { currentProject } = useProjectStore();
  if (!currentProject)
    return (
      <div className="flex h-[60vh] items-center justify-center text-slate-500">
        Select a project
      </div>
    );
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="page-title">Team</h1>
        <p className="page-subtitle">Manage team access for {currentProject.name}</p>
      </div>
      <div className="card flex flex-col items-center justify-center py-16 text-center">
        <Users size={32} className="text-slate-300 dark:text-slate-600 mb-3" />
        <p className="text-sm text-slate-500">Team management coming soon.</p>
      </div>
    </div>
  );
}
