'use client';

import { format } from 'date-fns';
import { Key, Plus, Trash2, Copy, Check, EyeOff, Loader2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import api from '@/lib/api';
import { Project } from '@/store/project';

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  created_at: string;
}

interface ApiKeysTabProps {
  project: Project;
}

export default function ApiKeysTab({ project }: ApiKeysTabProps) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(false);

  // Key creation state
  const [keyName, setKeyName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['read']);
  const [generating, setGenerating] = useState(false);

  // Newly created key display state
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchKeys = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/projects/${project.id}/api-keys`);
      setKeys(res.data.data || []);
    } catch (error) {
      console.error('Failed to fetch API keys:', error);
      toast.error('Could not load API keys');
    } finally {
      setLoading(true);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, [project.id]);

  const handleScopeToggle = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim()) {
      toast.error('API key name is required');
      return;
    }
    if (selectedScopes.length === 0) {
      toast.error('Please select at least one scope');
      return;
    }

    setGenerating(true);
    setNewlyCreatedKey(null);
    setCopied(false);
    try {
      const res = await api.post(`/projects/${project.id}/api-keys`, {
        name: keyName.trim(),
        scopes: selectedScopes,
      });

      const data = res.data.data;
      setNewlyCreatedKey(data.key);
      setKeyName('');
      setSelectedScopes(['read']);
      toast.success('API Key generated successfully');

      // Refresh list
      fetchKeys();
    } catch (error) {
      console.error('Failed to create key:', error);
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      const errMsg = err.response?.data?.error?.message || 'Failed to generate API key';
      toast.error(errMsg);
    } finally {
      setGenerating(false);
    }
  };

  const handleRevokeKey = async (keyId: string, name: string) => {
    if (
      !window.confirm(
        `Are you sure you want to revoke the API key "${name}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      await api.delete(`/projects/${project.id}/api-keys/${keyId}`);
      toast.success(`API Key "${name}" revoked`);
      // Update local state directly
      setKeys((prev) => prev.filter((k) => k.id !== keyId));
    } catch (error) {
      console.error('Failed to revoke key:', error);
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      const errMsg = err.response?.data?.error?.message || 'Failed to revoke API key';
      toast.error(errMsg);
    }
  };

  const handleCopyKey = () => {
    if (!newlyCreatedKey) return;
    navigator.clipboard.writeText(newlyCreatedKey);
    setCopied(true);
    toast.success('API key copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-slate-200">API Keys</h2>
        <p className="text-xs text-slate-500 mt-1">
          Generate API keys to integrate external tools and automate ingest scripts.
        </p>
      </div>

      {/* Warning Raw Key Display Banner */}
      {newlyCreatedKey && (
        <div className="p-5 rounded-2xl border border-amber-500/20 bg-amber-500/5 text-amber-300 max-w-2xl space-y-3">
          <div className="flex items-center gap-2">
            <EyeOff size={18} className="text-amber-400 shrink-0" />
            <h3 className="text-sm font-bold text-amber-200">Save your API Key</h3>
          </div>
          <p className="text-xs leading-relaxed text-amber-300/80">
            Please copy this key now. For security reasons, it cannot be displayed again after you
            navigate away or close this banner.
          </p>
          <div className="flex items-center gap-2 mt-2 bg-slate-950/80 border border-slate-800 p-3 rounded-xl">
            <code className="text-xs font-mono select-all text-slate-200 break-all flex-1">
              {newlyCreatedKey}
            </code>
            <button
              onClick={handleCopyKey}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 transition"
              title="Copy to clipboard"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
          <div className="text-right">
            <button
              onClick={() => setNewlyCreatedKey(null)}
              className="text-[10px] font-bold underline hover:text-amber-200 transition"
            >
              Done, I have saved it safely
            </button>
          </div>
        </div>
      )}

      {/* Generate API Key Form */}
      <div className="p-5 rounded-2xl border border-slate-900 bg-slate-950/40 max-w-2xl">
        <h3 className="text-sm font-bold text-slate-300 mb-3.5 flex items-center gap-2">
          <Key size={16} className="text-indigo-400" />
          <span>Generate Developer Token</span>
        </h3>
        <form onSubmit={handleCreateKey} className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="keyName" className="text-xs font-bold text-slate-500">
              Key Description / Label
            </label>
            <input
              id="keyName"
              type="text"
              placeholder="e.g. Ingestion Script, Prod Webhook"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              required
              disabled={generating}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950/60 text-slate-100 text-sm focus:outline-none focus:border-indigo-500/80 transition disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold text-slate-500">Select Scopes</span>
            <div className="flex flex-wrap gap-4 pt-1">
              {['read', 'write', 'admin'].map((scope) => (
                <label
                  key={scope}
                  className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer select-none group"
                >
                  <input
                    type="checkbox"
                    checked={selectedScopes.includes(scope)}
                    onChange={() => handleScopeToggle(scope)}
                    disabled={generating}
                    className="h-4.5 w-4.5 rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-950 transition cursor-pointer"
                  />
                  <span className="capitalize group-hover:text-slate-200">{scope}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={generating || !keyName.trim()}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-semibold text-sm transition"
            >
              {generating ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  <Plus size={16} />
                  <span>Generate Key</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Active API Keys List Table */}
      <div className="border border-slate-900 bg-slate-950/20 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="text-indigo-500 animate-spin" size={24} />
          </div>
        ) : keys.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm italic">
            No active API keys found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-900 bg-slate-950/45 text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">
                  <th className="px-6 py-3.5">Name</th>
                  <th className="px-6 py-3.5">Key Prefix</th>
                  <th className="px-6 py-3.5">Scopes</th>
                  <th className="px-6 py-3.5">Last Used</th>
                  <th className="px-6 py-3.5">Created Date</th>
                  <th className="px-6 py-3.5 text-right">Revoke</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/50">
                {keys.map((k) => {
                  const createdDate = new Date(k.created_at);
                  const formattedCreated = isNaN(createdDate.getTime())
                    ? 'N/A'
                    : format(createdDate, 'MMM d, yyyy');

                  const lastUsedDate = k.last_used_at ? new Date(k.last_used_at) : null;
                  const formattedLastUsed = lastUsedDate
                    ? isNaN(lastUsedDate.getTime())
                      ? 'N/A'
                      : format(lastUsedDate, 'MMM d, yyyy HH:mm')
                    : 'Never';

                  return (
                    <tr key={k.id} className="hover:bg-slate-900/10 transition">
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-slate-200">{k.name}</span>
                      </td>

                      <td className="px-6 py-4">
                        <code className="text-xs font-mono text-slate-400 select-all">
                          {k.key_prefix}
                        </code>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {k.scopes.map((scope) => (
                            <span
                              key={scope}
                              className="text-[9px] font-extrabold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700 px-1.5 py-0.5 rounded"
                            >
                              {scope}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-xs text-slate-400">{formattedLastUsed}</td>

                      <td className="px-6 py-4 text-xs text-slate-400">{formattedCreated}</td>

                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleRevokeKey(k.id, k.name)}
                          className="p-2 rounded-lg text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition"
                          title="Revoke API key"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
