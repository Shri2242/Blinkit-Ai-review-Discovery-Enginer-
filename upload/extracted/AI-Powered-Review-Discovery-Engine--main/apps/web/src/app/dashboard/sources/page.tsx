'use client';

import {
  Database,
  Plus,
  Play,
  Pause,
  Trash2,
  RefreshCw,
  Upload,
  FileSpreadsheet,
  FileJson,
  CheckCircle2,
  XCircle,
  Clock,
  Apple,
  MessageCircle,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { useEffect, useState, useCallback, type FormEvent, type DragEvent } from 'react';
import toast from 'react-hot-toast';

import api from '@/lib/api';
import { useProjectStore } from '@/store/project';

interface SourceType {
  type: string;
  label: string;
  configFields: Array<{ name: string; label: string; placeholder: string; required: boolean }>;
}

interface CollectorSource {
  id: string;
  project_id: string;
  source_type: string;
  name: string;
  config: Record<string, unknown>;
  enabled: boolean;
  schedule: string;
  last_run_at: string | null;
  last_run_status: string | null;
  last_run_count: number;
  total_collected: number;
  error_message: string | null;
  created_at: string;
}

interface CollectionLog {
  id: string;
  status: string;
  reviews_fetched: number;
  reviews_new: number;
  reviews_duplicate: number;
  duration_ms: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

interface UploadBatch {
  id: string;
  filename: string;
  total_rows: number;
  successful_rows: number;
  failed_rows: number;
  status: string;
  created_at: string;
}

const SOURCE_ICONS: Record<string, typeof Database> = {
  google_play: Play,
  app_store: Apple,
  reddit: MessageCircle,
  twitter: ExternalLink,
};

const PRESETS = [
  {
    label: 'Spotify Google Play',
    sourceType: 'google_play' as const,
    name: 'Spotify - Google Play Store',
    config: { appId: 'com.spotify.music', lang: 'en', country: 'us', maxReviews: 200 },
  },
  {
    label: 'Spotify App Store',
    sourceType: 'app_store' as const,
    name: 'Spotify - Apple App Store',
    config: { appId: '324684580', country: 'us', maxReviews: 200 },
  },
  {
    label: 'r/spotify Reddit',
    sourceType: 'reddit' as const,
    name: 'r/spotify Discussions',
    config: {
      subreddit: 'spotify',
      queries: ['recommendations', 'discover weekly', 'new music', 'repetitive songs', 'algorithm'],
      maxPosts: 100,
    },
  },
];

export default function SourcesPage() {
  const { currentProject } = useProjectStore();
  const [activeTab, setActiveTab] = useState<'automated' | 'manual'>('automated');
  const [sources, setSources] = useState<CollectorSource[]>([]);
  const [sourceTypes, setSourceTypes] = useState<SourceType[]>([]);
  const [batches, setBatches] = useState<UploadBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState<string | null>(null);
  const [logs, setLogs] = useState<CollectionLog[]>([]);
  const [runningSource, setRunningSource] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Add source form state
  const [formSourceType, setFormSourceType] = useState('');
  const [formName, setFormName] = useState('');
  const [formConfig, setFormConfig] = useState<Record<string, string>>({});

  const projectId = currentProject?.id;

  const fetchData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [sourcesRes, typesRes, batchesRes] = await Promise.all([
        api.get(`/projects/${projectId}/collectors`),
        api.get(`/projects/${projectId}/collectors/types`),
        api.get(`/projects/${projectId}/ingestion/batches`),
      ]);
      setSources(sourcesRes.data.data || []);
      setSourceTypes(typesRes.data.data?.sources || []);
      setBatches(batchesRes.data.data || []);
    } catch (err) {
      console.error('Failed to fetch sources data', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddSource = async (e: FormEvent) => {
    e.preventDefault();
    if (!projectId || !formSourceType || !formName) return;

    // Parse config: convert comma-separated queries to arrays
    const config: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(formConfig)) {
      if (key === 'queries' && typeof value === 'string') {
        config[key] = value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      } else if (key === 'maxReviews' || key === 'maxPosts' || key === 'maxTweets') {
        config[key] = parseInt(value) || 200;
      } else {
        config[key] = value;
      }
    }

    try {
      await api.post(`/projects/${projectId}/collectors`, {
        sourceType: formSourceType,
        name: formName,
        config,
      });
      toast.success('Source added successfully');
      setShowAddModal(false);
      setFormSourceType('');
      setFormName('');
      setFormConfig({});
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add source';
      toast.error(msg);
    }
  };

  const handlePreset = (preset: (typeof PRESETS)[number]) => {
    setFormSourceType(preset.sourceType);
    setFormName(preset.name);
    const configStr: Record<string, string> = {};
    for (const [key, value] of Object.entries(preset.config)) {
      configStr[key] = Array.isArray(value) ? value.join(', ') : String(value);
    }
    setFormConfig(configStr);
    setShowAddModal(true);
  };

  const handleRun = async (sourceId: string) => {
    if (!projectId) return;
    setRunningSource(sourceId);
    try {
      const res = await api.post(`/projects/${projectId}/collectors/${sourceId}/run`);
      const data = res.data.data;
      toast.success(`Collected: ${data.inserted} new, ${data.duplicates} duplicates`);
      fetchData();
    } catch {
      toast.error('Collection failed');
    } finally {
      setRunningSource(null);
    }
  };

  const handleRunAll = async () => {
    if (!projectId) return;
    try {
      await api.post(`/projects/${projectId}/collectors/run-all`);
      toast.success('Collection started for all sources');
      setTimeout(fetchData, 5000);
    } catch {
      toast.error('Failed to start collection');
    }
  };

  const handleToggle = async (sourceId: string, enabled: boolean) => {
    if (!projectId) return;
    try {
      await api.patch(`/projects/${projectId}/collectors/${sourceId}/toggle`, { enabled });
      fetchData();
    } catch {
      toast.error('Failed to toggle source');
    }
  };

  const handleDelete = async (sourceId: string) => {
    if (!projectId) return;
    if (!confirm('Delete this source? This cannot be undone.')) return;
    try {
      await api.delete(`/projects/${projectId}/collectors/${sourceId}`);
      toast.success('Source deleted');
      fetchData();
    } catch {
      toast.error('Failed to delete source');
    }
  };

  const handleViewLogs = async (sourceId: string) => {
    if (!projectId) return;
    if (expandedLogs === sourceId) {
      setExpandedLogs(null);
      return;
    }
    try {
      const res = await api.get(`/projects/${projectId}/collectors/${sourceId}/logs`);
      setLogs(res.data.data || []);
      setExpandedLogs(sourceId);
    } catch {
      toast.error('Failed to load logs');
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!projectId) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post(`/projects/${projectId}/ingestion/ingest`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const data = res.data.data;
      toast.success(`Uploaded: ${data.inserted || data.successful_rows} records added`);
      fetchData();
    } catch (err: unknown) {
      toast.error('File upload failed');
      console.error(err);
    } finally {
      setUploading(false);
      setDragOver(false);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  if (!projectId) {
    return <div className="p-8 text-center text-slate-400">Select a project first</div>;
  }

  if (loading && sources.length === 0) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-fade-in">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight font-display mb-2">
            Data Sources
          </h1>
          <p className="text-slate-400">
            Manage where your reviews and feedback are collected from.
          </p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('automated')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
              activeTab === 'automated'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Automated Connectors
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
              activeTab === 'manual' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Manual Upload
          </button>
        </div>
      </div>

      {activeTab === 'automated' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-slate-900 border border-slate-800 p-4 rounded-2xl">
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <Clock className="w-5 h-5 text-brand-400" />
              <span>
                Automated collection runs daily at 10:00 AM IST (4:30 AM UTC) via GitHub Actions.
              </span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleRunAll}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-medium transition"
              >
                <RefreshCw className="w-4 h-4" /> Run All Now
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-sm font-medium transition shadow-lg shadow-brand-500/20"
              >
                <Plus className="w-4 h-4" /> Add Source
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {sources.map((source) => {
              const Icon = SOURCE_ICONS[source.source_type] || Database;
              const isRunning = runningSource === source.id;

              return (
                <div
                  key={source.id}
                  className="bg-slate-900 border border-slate-800 rounded-3xl p-6 transition hover:border-slate-700 group"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center bg-slate-800 ${source.enabled ? 'text-brand-400' : 'text-slate-500'}`}
                      >
                        <Icon className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white">{source.name}</h3>
                        <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-wider font-semibold">
                          <span>
                            {sourceTypes.find((t) => t.type === source.source_type)?.label ||
                              source.source_type}
                          </span>
                          <span>•</span>
                          <span className={source.enabled ? 'text-green-400' : 'text-slate-500'}>
                            {source.enabled ? 'Active' : 'Paused'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleToggle(source.id, !source.enabled)}
                        className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl"
                        title={source.enabled ? 'Pause' : 'Resume'}
                      >
                        {source.enabled ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(source.id)}
                        className="p-2 text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-500/20 rounded-xl"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-slate-950 rounded-xl p-3 border border-slate-800/50">
                      <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                        Total Collected
                      </div>
                      <div className="text-xl font-display font-semibold text-white">
                        {source.total_collected.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-slate-950 rounded-xl p-3 border border-slate-800/50">
                      <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                        Last Run
                      </div>
                      <div className="text-sm font-medium text-slate-200">
                        {source.last_run_at
                          ? new Date(source.last_run_at).toLocaleDateString()
                          : 'Never'}
                        {source.last_run_status && (
                          <span
                            className={`ml-2 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                              source.last_run_status === 'success'
                                ? 'bg-green-500/10 text-green-400'
                                : source.last_run_status === 'failed'
                                  ? 'bg-rose-500/10 text-rose-400'
                                  : 'bg-yellow-500/10 text-yellow-400'
                            }`}
                          >
                            {source.last_run_status}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleRun(source.id)}
                      disabled={isRunning || !source.enabled}
                      className="flex-1 py-2.5 rounded-xl bg-brand-600/10 hover:bg-brand-600/20 disabled:opacity-50 text-brand-400 text-sm font-semibold transition flex items-center justify-center gap-2"
                    >
                      {isRunning ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      {isRunning ? 'Running...' : 'Run Collector Now'}
                    </button>
                    <button
                      onClick={() => handleViewLogs(source.id)}
                      className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold transition"
                    >
                      Logs
                    </button>
                  </div>

                  {expandedLogs === source.id && (
                    <div className="mt-4 pt-4 border-t border-slate-800 animate-fade-in">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                        Recent Runs
                      </h4>
                      <div className="space-y-2">
                        {logs.length === 0 ? (
                          <div className="text-sm text-slate-500 italic">No logs available</div>
                        ) : (
                          logs.map((log) => (
                            <div
                              key={log.id}
                              className="text-xs flex items-center justify-between bg-slate-950 p-2 rounded-lg border border-slate-800/50"
                            >
                              <span className="text-slate-400">
                                {new Date(log.started_at).toLocaleString()}
                              </span>
                              <div className="flex items-center gap-3">
                                <span className="text-slate-300">Found {log.reviews_fetched}</span>
                                <span className="text-brand-400">+{log.reviews_new}</span>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                                    log.status === 'success'
                                      ? 'bg-green-500/10 text-green-400'
                                      : log.status === 'failed'
                                        ? 'bg-rose-500/10 text-rose-400'
                                        : 'bg-slate-500/10 text-slate-400'
                                  }`}
                                >
                                  {log.status}
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {sources.length === 0 && (
            <div className="text-center py-20 border-2 border-dashed border-slate-800 rounded-3xl">
              <Database className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-white mb-2">No data sources yet</h3>
              <p className="text-slate-400 max-w-md mx-auto mb-6">
                Add a source like Google Play or Reddit to automatically collect user reviews daily.
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-6 py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-semibold transition"
              >
                Add Your First Source
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'manual' && (
        <div className="space-y-8">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`border-2 border-dashed rounded-3xl p-12 text-center transition-all duration-300 ${
              dragOver
                ? 'border-brand-500 bg-brand-500/5'
                : 'border-slate-700 bg-slate-900/50 hover:border-slate-500 hover:bg-slate-800/50'
            }`}
          >
            <div className="w-16 h-16 bg-brand-600/20 text-brand-400 rounded-full flex items-center justify-center mx-auto mb-6">
              {uploading ? (
                <Loader2 className="w-8 h-8 animate-spin" />
              ) : (
                <Upload className="w-8 h-8" />
              )}
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Upload Data File</h3>
            <p className="text-slate-400 mb-6 max-w-md mx-auto">
              Upload raw reviews from a CSV or JSON file. We'll automatically process and extract
              sentiments.
            </p>
            <label className="cursor-pointer inline-flex items-center gap-2 px-6 py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-semibold transition shadow-lg shadow-brand-500/20">
              <input
                type="file"
                className="hidden"
                accept=".csv,.json"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
                }}
                disabled={uploading}
              />
              {uploading ? 'Uploading...' : 'Select CSV or JSON'}
            </label>
            <div className="mt-4 flex items-center justify-center gap-6 text-sm text-slate-500">
              <span className="flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4" /> CSV Supported
              </span>
              <span className="flex items-center gap-1.5">
                <FileJson className="w-4 h-4" /> JSON Supported
              </span>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold text-white mb-4">Upload History</h3>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950 text-slate-400 uppercase text-xs tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Date</th>
                    <th className="px-6 py-4 font-semibold">File</th>
                    <th className="px-6 py-4 font-semibold">Rows</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {batches.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-slate-500 italic">
                        No previous uploads
                      </td>
                    </tr>
                  ) : (
                    batches.map((batch) => (
                      <tr key={batch.id} className="hover:bg-slate-800/50 transition">
                        <td className="px-6 py-4 whitespace-nowrap">
                          {new Date(batch.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 flex items-center gap-2">
                          <FileSpreadsheet className="w-4 h-4 text-slate-500" /> {batch.filename}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-white font-medium">{batch.successful_rows}</span>
                          <span className="text-slate-500 text-xs ml-1">/ {batch.total_rows}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
                              batch.status === 'completed'
                                ? 'bg-green-500/10 text-green-400'
                                : batch.status === 'failed'
                                  ? 'bg-rose-500/10 text-rose-400'
                                  : 'bg-yellow-500/10 text-yellow-400'
                            }`}
                          >
                            {batch.status === 'completed' ? (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            ) : batch.status === 'failed' ? (
                              <XCircle className="w-3.5 h-3.5" />
                            ) : (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            )}
                            {batch.status}
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
      )}

      {/* Add Source Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden my-8">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950">
              <h2 className="text-xl font-bold text-white">Add Data Source</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              {!formSourceType ? (
                <div>
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">
                    Quick Presets
                  </h3>
                  <div className="grid grid-cols-3 gap-3 mb-8">
                    {PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        onClick={() => handlePreset(preset)}
                        className="text-left p-4 rounded-xl border border-slate-700 bg-slate-800/50 hover:bg-slate-800 hover:border-brand-500 transition group"
                      >
                        <div className="font-semibold text-sm text-slate-200 group-hover:text-brand-400 mb-1">
                          {preset.label}
                        </div>
                        <div className="text-xs text-slate-500">{preset.sourceType}</div>
                      </button>
                    ))}
                  </div>

                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">
                    Select Source Type
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {sourceTypes.map((st) => {
                      const Icon = SOURCE_ICONS[st.type] || Database;
                      return (
                        <button
                          key={st.type}
                          onClick={() => setFormSourceType(st.type)}
                          className="flex flex-col items-center gap-3 p-4 border border-slate-700 rounded-2xl hover:border-brand-500 hover:bg-brand-500/5 transition"
                        >
                          <Icon className="w-8 h-8 text-slate-400" />
                          <span className="font-semibold text-sm text-slate-200">{st.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <form onSubmit={handleAddSource} className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Display Name
                    </label>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g. App Store - US"
                      className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white focus:border-brand-500 focus:outline-none transition"
                    />
                  </div>

                  {sourceTypes
                    .find((t) => t.type === formSourceType)
                    ?.configFields.map((field) => (
                      <div key={field.name}>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                          {field.label}{' '}
                          {field.required && <span className="text-brand-400">*</span>}
                        </label>
                        <input
                          type="text"
                          required={field.required}
                          value={formConfig[field.name] || ''}
                          onChange={(e) =>
                            setFormConfig({ ...formConfig, [field.name]: e.target.value })
                          }
                          placeholder={field.placeholder}
                          className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white focus:border-brand-500 focus:outline-none transition text-sm"
                        />
                      </div>
                    ))}

                  <div className="flex gap-3 pt-4 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setFormSourceType('')}
                      className="px-5 py-3 rounded-xl font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
                    >
                      Back
                    </button>
                    <div className="flex-1"></div>
                    <button
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      className="px-5 py-3 rounded-xl font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-3 rounded-xl font-semibold text-white bg-brand-600 hover:bg-brand-500 transition shadow-lg shadow-brand-500/20"
                    >
                      Save Source
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
