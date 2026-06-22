'use client';

import { Bug, Check, Lightbulb, Search, Trash2, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

export interface FilterState {
  search: string;
  sentiment: string;
  theme: string;
  priority: string;
  source: string;
  isBug: boolean;
  isFeatureRequest: boolean;
  sortBy: 'newest' | 'oldest' | 'priority' | 'rating';
}

interface FilterBarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  filterOptions: { themes: string[]; sources: string[] };
  totalCount: number;
  filteredCount: number;
}

export default function FilterBar({
  filters,
  onChange,
  filterOptions,
  totalCount,
  filteredCount,
}: FilterBarProps) {
  const [localSearch, setLocalSearch] = useState(filters.search);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (filters.search !== localSearch) {
        onChange({ ...filters, search: localSearch });
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [localSearch, onChange, filters]);

  useEffect(() => {
    setLocalSearch(filters.search);
  }, [filters.search]);

  const handleSelectChange = (key: keyof FilterState, value: string) => {
    onChange({ ...filters, [key]: value });
  };

  const handleToggleChange = (key: 'isBug' | 'isFeatureRequest') => {
    onChange({ ...filters, [key]: !filters[key] });
  };

  const handleClearAll = () => {
    onChange({
      search: '',
      sentiment: '',
      theme: '',
      priority: '',
      source: '',
      isBug: false,
      isFeatureRequest: false,
      sortBy: 'newest',
    });
  };

  const removeFilter = (key: keyof FilterState) => {
    if (key === 'isBug' || key === 'isFeatureRequest') {
      onChange({ ...filters, [key]: false });
    } else if (key === 'sortBy') {
      onChange({ ...filters, sortBy: 'newest' });
    } else {
      onChange({ ...filters, [key]: '' });
    }
  };

  const formatSourceLabel = (src: string) => {
    if (src === 'app_store' || src === 'appstore') return 'App Store';
    if (src === 'google_play' || src === 'playstore') return 'Google Play';
    return src.replace('_', ' ');
  };

  const activePills: Array<{ key: keyof FilterState; label: string }> = [];
  if (filters.search) activePills.push({ key: 'search', label: `Search: "${filters.search}"` });
  if (filters.sentiment)
    activePills.push({ key: 'sentiment', label: `Sentiment: ${filters.sentiment}` });
  if (filters.theme) activePills.push({ key: 'theme', label: `Theme: ${filters.theme}` });
  if (filters.priority)
    activePills.push({ key: 'priority', label: `Priority: ${filters.priority}` });
  if (filters.source)
    activePills.push({ key: 'source', label: `Source: ${formatSourceLabel(filters.source)}` });
  if (filters.isBug) activePills.push({ key: 'isBug', label: 'Bugs Only' });
  if (filters.isFeatureRequest)
    activePills.push({ key: 'isFeatureRequest', label: 'Features Only' });

  return (
    <div className="space-y-4">
      <div className="glass-card rounded-2xl border border-slate-900 bg-slate-900/10 p-5 shadow-lg relative overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          <div className="relative md:col-span-4">
            <span className="absolute inset-y-0 left-3 flex items-center text-slate-500">
              <Search size={16} />
            </span>
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-900 rounded-xl pl-9 pr-4 py-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition text-sm"
              placeholder="Search customer reviews..."
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:col-span-8 gap-3">
            <div>
              <select
                value={filters.sentiment}
                onChange={(e) => handleSelectChange('sentiment', e.target.value)}
                className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3 py-2.5 text-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 transition capitalize"
              >
                <option value="">Sentiment: All</option>
                <option value="positive">Positive</option>
                <option value="negative">Negative</option>
                <option value="neutral">Neutral</option>
                <option value="mixed">Mixed</option>
              </select>
            </div>

            <div>
              <select
                value={filters.theme}
                onChange={(e) => handleSelectChange('theme', e.target.value)}
                className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3 py-2.5 text-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 transition capitalize"
              >
                <option value="">Theme: All</option>
                {filterOptions.themes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={filters.priority}
                onChange={(e) => handleSelectChange('priority', e.target.value)}
                className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3 py-2.5 text-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 transition capitalize"
              >
                <option value="">Priority: All</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div>
              <select
                value={filters.source}
                onChange={(e) => handleSelectChange('source', e.target.value)}
                className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3 py-2.5 text-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 transition capitalize"
              >
                <option value="">Source: All</option>
                {filterOptions.sources.map((s) => (
                  <option key={s} value={s}>
                    {formatSourceLabel(s)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 mt-4 pt-4 border-t border-slate-900/60">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => handleToggleChange('isBug')}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-xs font-bold transition duration-200',
                filters.isBug
                  ? 'bg-red-500/10 text-red-400 border-red-500/20'
                  : 'bg-transparent text-slate-500 border-slate-900 hover:border-slate-800'
              )}
            >
              <Bug size={14} />
              <span>Bugs Only</span>
              {filters.isBug && <Check size={12} className="ml-1" />}
            </button>

            <button
              onClick={() => handleToggleChange('isFeatureRequest')}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-xs font-bold transition duration-200',
                filters.isFeatureRequest
                  ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                  : 'bg-transparent text-slate-500 border-slate-900 hover:border-slate-800'
              )}
            >
              <Lightbulb size={14} />
              <span>Features Only</span>
              {filters.isFeatureRequest && <Check size={12} className="ml-1" />}
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-slate-500">Sort By</span>
              <select
                value={filters.sortBy}
                onChange={(e) => handleSelectChange('sortBy', e.target.value)}
                className="bg-slate-950 border border-slate-900 rounded-xl px-3 py-2 text-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="priority">Priority Order</option>
                <option value="rating">Rating (Low First)</option>
              </select>
            </div>

            {activePills.length > 0 && (
              <button
                onClick={handleClearAll}
                className="flex items-center gap-1 text-slate-500 hover:text-red-400 transition text-xs font-bold px-2 py-2"
              >
                <Trash2 size={13} />
                <span>Clear Filters</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {activePills.map((pill) => (
            <div
              key={pill.key}
              onClick={() => removeFilter(pill.key)}
              className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 px-3 py-1 rounded-full cursor-pointer hover:text-white transition"
            >
              <span>{pill.label}</span>
              <X size={12} className="text-slate-500 hover:text-white transition" />
            </div>
          ))}
        </div>

        <div className="text-slate-500 font-medium">
          Showing <span className="text-slate-300 font-bold">{filteredCount}</span> of{' '}
          <span className="text-slate-300 font-bold">{totalCount}</span> reviews
        </div>
      </div>
    </div>
  );
}
