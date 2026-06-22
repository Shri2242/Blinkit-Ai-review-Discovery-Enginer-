'use client';
import { BarChart3, PieChart, Target, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';

import api from '@/lib/api';
import { useProjectStore } from '@/store/project';

export default function SegmentsPage() {
  const { currentProject } = useProjectStore();
  const [data, setData] = useState<any>(null);
  const [themeByRating, setThemeByRating] = useState<any[]>([]);
  const [themeBySource, setThemeBySource] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentProject?.id) return;
    setLoading(true);
    api
      .get(`/projects/${currentProject.id}/segments/summary`)
      .then((r) => setData(r.data.data))
      .catch(() => {});
    api
      .get(`/projects/${currentProject.id}/segments/theme-by-rating`)
      .then((r) => setThemeByRating(r.data.data || []))
      .catch(() => {});
    api
      .get(`/projects/${currentProject.id}/segments/theme-by-source`)
      .then((r) => setThemeBySource(r.data.data || []))
      .catch(() => {});
    setTimeout(() => setLoading(false), 500);
  }, [currentProject?.id]);

  if (!currentProject)
    return (
      <div className="flex h-[60vh] items-center justify-center text-slate-500">
        Select a project to view segments
      </div>
    );
  if (loading)
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
      </div>
    );
  if (!data)
    return (
      <div className="flex h-[60vh] items-center justify-center text-slate-500">
        No segment data
      </div>
    );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="page-title">User Segments</h1>
        <p className="page-subtitle">Cross-dimensional analysis of user feedback.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rating */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-brand-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Rating Brackets</h2>
          </div>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="table-header">
                <th className="pb-2">Segment</th>
                <th className="pb-2">Total</th>
                <th className="pb-2">+ / –</th>
                <th className="pb-2">Bugs</th>
              </tr>
            </thead>
            <tbody>
              {data.byRating?.length ? (
                data.byRating.map((row: any, i: number) => (
                  <tr key={i} className="table-row">
                    <td className="table-cell font-medium">{row.segment}</td>
                    <td className="table-cell">{row.total}</td>
                    <td className="table-cell">
                      <span className="text-emerald-500">{row.positive ?? 0}</span> /{' '}
                      <span className="text-red-500">{row.negative ?? 0}</span>
                    </td>
                    <td className="table-cell text-amber-500">{row.bugs ?? 0}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-400">
                    No data
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Source */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-5 h-5 text-brand-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Platform Segments</h2>
          </div>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="table-header">
                <th className="pb-2">Platform</th>
                <th className="pb-2">Total</th>
                <th className="pb-2">Avg Rating</th>
                <th className="pb-2">Features</th>
              </tr>
            </thead>
            <tbody>
              {data.bySource?.length ? (
                data.bySource.map((row: any, i: number) => (
                  <tr key={i} className="table-row">
                    <td className="table-cell font-medium capitalize">{row.segment}</td>
                    <td className="table-cell">{row.total}</td>
                    <td className="table-cell">{row.avg_rating?.toFixed(2) || '-'}</td>
                    <td className="table-cell text-brand-500">{row.feature_requests ?? 0}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-400">
                    No data
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-brand-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Themes × Rating</h2>
          </div>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="table-header">
                <th className="pb-2">Theme</th>
                <th className="pb-2">Bracket</th>
                <th className="pb-2">Mentions</th>
                <th className="pb-2">Neg</th>
              </tr>
            </thead>
            <tbody>
              {themeByRating.length ? (
                themeByRating.slice(0, 15).map((row: any, i: number) => (
                  <tr key={i} className="table-row">
                    <td className="table-cell font-medium capitalize">{row.segment}</td>
                    <td
                      className={`table-cell capitalize ${row.rating_bracket === 'low' ? 'text-red-500' : row.rating_bracket === 'high' ? 'text-emerald-500' : 'text-amber-500'}`}
                    >
                      {row.rating_bracket}
                    </td>
                    <td className="table-cell">{row.total}</td>
                    <td className="table-cell">{row.negative_count}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-400">
                    No data
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-brand-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Themes × Platform</h2>
          </div>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="table-header">
                <th className="pb-2">Theme</th>
                <th className="pb-2">Platform</th>
                <th className="pb-2">Mentions</th>
                <th className="pb-2">Avg Rating</th>
              </tr>
            </thead>
            <tbody>
              {themeBySource.length ? (
                themeBySource.slice(0, 15).map((row: any, i: number) => (
                  <tr key={i} className="table-row">
                    <td className="table-cell font-medium capitalize">{row.segment}</td>
                    <td className="table-cell capitalize">{row.source}</td>
                    <td className="table-cell">{row.total}</td>
                    <td className="table-cell">{row.avg_rating?.toFixed(2) || '-'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-400">
                    No data
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
