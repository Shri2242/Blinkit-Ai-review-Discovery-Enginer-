'use client';
import { TrendingUp, BarChart3 } from 'lucide-react';
import { useEffect, useState } from 'react';

import api from '@/lib/api';
import { useProjectStore } from '@/store/project';

export default function InsightsPage() {
  const { currentProject } = useProjectStore();
  const [issues, setIssues] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentProject?.id) {
      setLoading(false);
      return;
    }
    Promise.all([
      api.get(`/projects/${currentProject.id}/insights/top-issues?limit=10`),
      api.get(`/projects/${currentProject.id}/insights/sources`),
    ])
      .then(([iRes, sRes]) => {
        setIssues(iRes.data.data || []);
        setSources(sRes.data.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [currentProject?.id]);

  if (!currentProject)
    return (
      <div className="flex h-[60vh] items-center justify-center text-slate-500">
        Select a project
      </div>
    );
  if (loading)
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
      </div>
    );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="page-title">Insights</h1>
        <p className="page-subtitle">Top issues and source breakdown for {currentProject.name}</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-brand-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Top Issues</h2>
          </div>
          <div className="space-y-3">
            {issues.length ? (
              issues.map((item: any, i: number) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      {item.issue || item.theme || item.title}
                    </p>
                    <p className="text-xs text-slate-500">{item.count || item.total} mentions</p>
                  </div>
                  <span
                    className={`badge ${(item.sentiment || item.priority) === 'negative' ? 'badge-red' : 'badge-green'}`}
                  >
                    {item.sentiment || item.priority || 'info'}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">No issues found</p>
            )}
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-brand-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">By Source</h2>
          </div>
          <div className="space-y-3">
            {sources.length ? (
              sources.map((item: any, i: number) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0"
                >
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200 capitalize">
                    {item.source || item.segment}
                  </p>
                  <span className="text-sm text-slate-500">{item.count || item.total} reviews</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">No source data</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
