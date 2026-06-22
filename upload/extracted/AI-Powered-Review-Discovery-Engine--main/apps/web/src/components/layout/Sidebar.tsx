'use client';

import {
  LayoutDashboard,
  MessageSquare,
  TrendingUp,
  Bot,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  ChevronDown,
  Plus,
  X,
  Database,
  Upload,
  Sparkles,
  Users,
  FileText,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useState } from 'react';
import { toast } from 'react-hot-toast';

import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { useProjectStore, Project } from '@/store/project';

const navItems = [
  {
    label: 'Dashboard',
    href: '/dashboard' as Route,
    icon: LayoutDashboard,
    description: 'Overview & metrics',
  },
  {
    label: 'Reviews',
    href: '/dashboard/reviews' as Route,
    icon: MessageSquare,
    description: 'Explore feedback',
  },
  {
    label: 'Sources',
    href: '/dashboard/sources' as Route,
    icon: Database,
    description: 'Data collection',
  },
  {
    label: 'Insights',
    href: '/dashboard/insights' as Route,
    icon: TrendingUp,
    description: 'Trends & analysis',
  },
  { label: 'AI Chat', href: '/dashboard/chat' as Route, icon: Bot, description: 'Ask anything' },
  {
    label: 'Reports',
    href: '/dashboard/reports' as Route,
    icon: FileText,
    description: 'Scheduled reports',
  },
  {
    label: 'Segments',
    href: '/dashboard/segments' as Route,
    icon: Users,
    description: 'User analysis',
  },
  {
    label: 'Team',
    href: '/dashboard/team' as Route,
    icon: Users,
    description: 'Manage team members',
  },
  {
    label: 'Settings',
    href: '/dashboard/settings' as Route,
    icon: Settings,
    description: 'Project config',
  },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { currentProject, projects, setProject, fetchProjects } = useProjectStore();
  const { theme, setTheme } = useTheme();

  const handleProjectSelect = (project: Project) => {
    setProject(project);
    setIsDropdownOpen(false);
  };

  const handleCreateProject = async () => {
    if (!projectName.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await api.post('/projects', { name: projectName, description: projectDesc });
      const newProject = res.data.data;
      setProject(newProject);
      await fetchProjects();
      setIsCreateModalOpen(false);
      setProjectName('');
      setProjectDesc('');
      toast.success('Project created');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(error.response?.data?.error?.message || 'Failed to create project');
    } finally {
      setIsSubmitting(false);
    }
  };

  const cycleTheme = () => {
    if (theme === 'system') setTheme('light');
    else if (theme === 'light') setTheme('dark');
    else setTheme('system');
  };

  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;

  return (
    <>
      <aside
        className={`
          flex flex-col h-screen bg-[var(--sidebar)] border-r border-slate-200 dark:border-slate-800
          transition-all duration-300 ease-in-out z-40
          ${collapsed ? 'w-[72px]' : 'w-[260px]'}
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 h-16 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 shrink-0 shadow-lg shadow-brand-500/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          {!collapsed && (
            <div className="animate-fade-in min-w-0">
              <h1 className="text-sm font-bold text-[var(--foreground)] tracking-tight font-display truncate">
                ReviewPulse
              </h1>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest truncate">
                Intelligence
              </p>
            </div>
          )}
        </div>

        {/* Project Selector */}
        {!collapsed && (
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 transition text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5">
                    Active Project
                  </div>
                  <div className="text-sm font-semibold truncate">
                    {currentProject?.name || 'No Project Selected'}
                  </div>
                </div>
                <ChevronDown
                  size={14}
                  className={`text-slate-400 transition-transform shrink-0 ${isDropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isDropdownOpen && (
                <div className="absolute left-0 right-0 mt-2 z-50 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl py-1 max-h-60 overflow-y-auto">
                  {projects.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-slate-400 italic">No projects found</div>
                  ) : (
                    projects.map((proj) => (
                      <button
                        key={proj.id}
                        onClick={() => handleProjectSelect(proj)}
                        className={`w-full px-4 py-2 text-left text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800 ${
                          currentProject?.id === proj.id
                            ? 'text-brand-600 dark:text-brand-400 font-bold bg-brand-50 dark:bg-brand-900/20'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {proj.name}
                      </button>
                    ))
                  )}
                  <div className="border-t border-slate-200 dark:border-slate-800 p-1">
                    <button
                      onClick={() => {
                        setIsCreateModalOpen(true);
                        setIsDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition"
                    >
                      <Plus size={14} /> Create Project
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer group
                  ${
                    isActive
                      ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <div
                    className={`flex items-center justify-center w-9 h-9 rounded-xl shrink-0 transition-all
                    ${isActive ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'}
                  `}
                  >
                    <Icon className="w-[18px] h-[18px]" />
                  </div>
                  {!collapsed && (
                    <div className="min-w-0">
                      <span className="block truncate">{item.label}</span>
                      {isActive && (
                        <p className="text-[10px] text-brand-500 mt-0.5 truncate">
                          {item.description}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Upload CTA */}
        {!collapsed && currentProject && (
          <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 shrink-0">
            <Link href={'/dashboard/sources' as Route}>
              <div className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 text-xs font-semibold cursor-pointer hover:bg-brand-100 dark:hover:bg-brand-900/30 transition">
                <Upload className="w-3.5 h-3.5" /> Upload Reviews
              </div>
            </Link>
          </div>
        )}

        {/* User & Controls */}
        <div className="px-3 py-3 border-t border-slate-200 dark:border-slate-800 space-y-2 shrink-0">
          {/* Theme toggle */}
          <button
            onClick={cycleTheme}
            className="w-full flex items-center justify-center gap-2 px-2 py-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-xs font-medium"
            title={`Theme: ${theme}`}
          >
            <ThemeIcon className="w-3.5 h-3.5" />
            {!collapsed && (
              <span>{theme === 'system' ? 'System' : theme === 'dark' ? 'Dark' : 'Light'}</span>
            )}
          </button>

          {/* User info */}
          <div className="flex items-center gap-3 px-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white text-xs font-bold shrink-0 shadow">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {user?.name}
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                  {user?.email}
                </p>
              </div>
            )}
            {!collapsed && (
              <button
                onClick={logout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition shrink-0"
                title="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Collapse */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center py-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </aside>

      {/* Create Project Modal */}
      {isCreateModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4"
          onClick={() => setIsCreateModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Create New Project
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Create a workspace project to analyze reviews.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Project Name
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g. Spotify Mobile App"
                  className="input"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={projectDesc}
                  onChange={(e) => setProjectDesc(e.target.value)}
                  placeholder="Analyze recommendations..."
                  className="input"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setIsCreateModalOpen(false)} className="btn-outline flex-1">
                  Cancel
                </button>
                <button
                  onClick={handleCreateProject}
                  disabled={isSubmitting}
                  className="btn flex-1"
                >
                  {isSubmitting ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
