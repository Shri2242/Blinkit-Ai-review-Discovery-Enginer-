'use client';

import {
  TrendingUp,
  MessageSquare,
  AlertTriangle,
  Lightbulb,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import api from '@/lib/api';
import { useProjectStore } from '@/store/project';

export default function DashboardPage() {
  const { currentProject } = useProjectStore();
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentProject?.id) {
      setLoading(false);
      return;
    }
    api
      .get(`/projects/${currentProject.id}/insights/overview`)
      .then((r) => setOverview(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [currentProject?.id]);

  if (!currentProject) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
          <TrendingUp className="w-8 h-8 text-slate-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">No Project Selected</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Select a project from the sidebar to view analytics.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-28 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const stats = overview?.data || overview || {};

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Overview of {currentProject.name}</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Reviews
            </span>
            <MessageSquare className="w-4 h-4 text-brand-500" />
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white">
            {stats.totalReviews ?? 0}
          </div>
          <div className="flex items-center gap-1 mt-2 text-xs text-emerald-600">
            <ArrowUp className="w-3 h-3" /> {stats.processedReviews ?? 0} analyzed
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Bugs Found
            </span>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white">
            {stats.bugCount ?? 0}
          </div>
          <div className="text-xs text-slate-500 mt-2">
            {stats.featureRequestCount ?? 0} feature requests
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Sentiment
            </span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-emerald-600">
              {stats.sentimentBreakdown?.positive ?? 0}
            </span>
            <span className="text-sm text-slate-500 mb-1">positive</span>
          </div>
          <div className="flex items-center gap-1 mt-2 text-xs text-red-500">
            <ArrowDown className="w-3 h-3" /> {stats.sentimentBreakdown?.negative ?? 0} negative
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Critical Issues
            </span>
            <Lightbulb className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white">
            {stats.priorityBreakdown?.critical ?? 0}
          </div>
          <div className="text-xs text-slate-500 mt-2">
            {stats.priorityBreakdown?.high ?? 0} high priority
          </div>
        </div>
      </div>

      {/* Sentiment Distribution */}
      {stats.sentimentBreakdown && (
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
            Sentiment Distribution
          </h3>
          <div className="flex gap-2 h-3 rounded-full overflow-hidden">
            {Object.entries(stats.sentimentBreakdown).map(([key, val]: [string, unknown]) => {
              const total = Object.values(stats.sentimentBreakdown).reduce(
                (a: number, b: unknown) => a + (b as number),
                0
              );
              const pct = total > 0 ? ((val as number) / total) * 100 : 0;
              const colors: Record<string, string> = {
                positive: 'bg-emerald-500',
                negative: 'bg-red-500',
                neutral: 'bg-slate-400',
                mixed: 'bg-amber-500',
              };
              return (
                <div
                  key={key}
                  className={`${colors[key] || 'bg-slate-300'}`}
                  style={{ width: `${pct}%` }}
                  title={`${key}: ${val}`}
                />
              );
            })}
          </div>
          <div className="flex gap-4 mt-3 text-xs text-slate-500">
            {Object.entries(stats.sentimentBreakdown).map(([key, val]) => (
              <span key={key} className="capitalize">
                {key}: {val as number}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
