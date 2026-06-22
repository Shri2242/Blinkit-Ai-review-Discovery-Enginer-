/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import {
  FileText,
  Calendar,
  Webhook,
  Plus,
  Trash2,
  Check,
  Sparkles,
  AlertCircle,
  Info,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ResponsiveContainer,
  PieChart,
  Pie,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';

import Tabs from '@/components/ui/Tabs';
import api from '@/lib/api';
import { useProjectStore } from '@/store/project';

export default function ReportsPage() {
  const { currentProject } = useProjectStore();

  // Tabs config
  const [activeTab, setActiveTab] = useState('analysis');
  const tabs = [
    { id: 'analysis', label: 'AI Discovery Analysis', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'schedules', label: 'Report Schedules', icon: <Calendar className="w-4 h-4" /> },
    { id: 'webhooks', label: 'Webhooks Integration', icon: <Webhook className="w-4 h-4" /> },
  ];

  // Global loading/states
  const [loading, setLoading] = useState(false);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [weeklySummary, setWeeklySummary] = useState<string>('');

  // Form states
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [showAddWebhook, setShowAddWebhook] = useState(false);

  // Schedule Form
  const [schedName, setSchedName] = useState('');
  const [schedFreq, setSchedFreq] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [schedRecipients, setSchedRecipients] = useState('');
  const [schedSent, setSchedSent] = useState(true);
  const [schedThemes, setSchedThemes] = useState(true);
  const [schedIssues, setSchedIssues] = useState(true);
  const [schedSumm, setSchedSumm] = useState(true);

  // Webhook Form
  const [whName, setWhName] = useState('');
  const [whUrl, setWhUrl] = useState('');
  const [whEvents, setWhEvents] = useState<string[]>(['review.analyzed']);

  // Fetch Schedules & Webhooks
  const fetchData = async () => {
    if (!currentProject?.id) return;
    try {
      setLoading(true);
      const [schedulesRes, webhooksRes, summaryRes] = await Promise.all([
        api.get(`/projects/${currentProject.id}/reports/schedules`),
        api.get(`/projects/${currentProject.id}/reports/webhooks`),
        api.get(`/projects/${currentProject.id}/insights/weekly-summary`).catch(() => null),
      ]);
      setSchedules(schedulesRes.data.data || []);
      setWebhooks(webhooksRes.data.data || []);
      if (summaryRes?.data?.data) {
        setWeeklySummary(summaryRes.data.data.summary);
      }
    } catch (err) {
      console.error('Failed to load reports page data:', err);
      toast.error('Failed to load page configuration');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentProject?.id]);

  // Create Schedule handler
  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProject?.id) return;
    if (!schedName || !schedRecipients) {
      toast.error('Please fill in required fields');
      return;
    }

    const emails = schedRecipients
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);
    if (emails.length === 0) {
      toast.error('At least one recipient email is required');
      return;
    }

    try {
      await api.post(`/projects/${currentProject.id}/reports/schedules`, {
        name: schedName,
        frequency: schedFreq,
        recipients: emails,
        include_sentiment: schedSent,
        include_themes: schedThemes,
        include_top_issues: schedIssues,
        include_summary: schedSumm,
      });
      toast.success('Report schedule created!');
      setShowAddSchedule(false);
      // Reset Form
      setSchedName('');
      setSchedRecipients('');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create schedule');
    }
  };

  // Toggle Schedule
  const handleToggleSchedule = async (id: string, currentEnabled: boolean) => {
    if (!currentProject?.id) return;
    try {
      await api.patch(`/projects/${currentProject.id}/reports/schedules/${id}`, {
        enabled: !currentEnabled,
      });
      toast.success(`Schedule ${!currentEnabled ? 'enabled' : 'disabled'}`);
      fetchData();
    } catch (_err) {
      toast.error('Failed to update schedule status');
    }
  };

  // Delete Schedule
  const handleDeleteSchedule = async (id: string) => {
    if (!currentProject?.id) return;
    if (!confirm('Are you sure you want to delete this schedule?')) return;
    try {
      await api.delete(`/projects/${currentProject.id}/reports/schedules/${id}`);
      toast.success('Schedule deleted');
      fetchData();
    } catch (_err) {
      toast.error('Failed to delete schedule');
    }
  };

  // Create Webhook handler
  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProject?.id) return;
    if (!whName || !whUrl) {
      toast.error('Please fill in required fields');
      return;
    }

    try {
      await api.post(`/projects/${currentProject.id}/reports/webhooks`, {
        name: whName,
        url: whUrl,
        events: whEvents,
      });
      toast.success('Webhook registered successfully!');
      setShowAddWebhook(false);
      setWhName('');
      setWhUrl('');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to register webhook');
    }
  };

  // Delete Webhook
  const handleDeleteWebhook = async (id: string) => {
    if (!currentProject?.id) return;
    if (!confirm('Are you sure you want to delete this webhook listener?')) return;
    try {
      await api.delete(`/projects/${currentProject.id}/reports/webhooks/${id}`);
      toast.success('Webhook deleted');
      fetchData();
    } catch (_err) {
      toast.error('Failed to delete webhook');
    }
  };

  // Mock graph data for the 6 PM questions
  const strugglesData = [
    { subject: 'Filter Bubble', score: 82, fullMark: 100 },
    { subject: 'Catalog Bias', score: 78, fullMark: 100 },
    { subject: 'Taste Friction', score: 64, fullMark: 100 },
    { subject: 'Search Friction', score: 72, fullMark: 100 },
    { subject: 'Mood Accuracy', score: 58, fullMark: 100 },
  ];

  const frustrationsData = [
    { name: 'Smart Shuffle Repeating', count: 142, color: '#6366F1' },
    { name: 'Stale Mixes', count: 98, color: '#10B981' },
    { name: 'Podcast Intrusion', count: 87, color: '#FB923C' },
    { name: 'Autoplay Off-Taste', count: 64, color: '#A78BFA' },
    { name: 'Lack of Skip Memory', count: 45, color: '#F472B6' },
  ];

  const behaviorsData = [
    { name: 'Playlist Curation', value: 45, color: '#10B981' },
    { name: 'Background Play', value: 35, color: '#6366F1' },
    { name: 'Serendipity', value: 20, color: '#EC4899' },
  ];

  const repeatCausesData = [
    { name: 'Comfort/Familiarity', value: 55, color: '#F59E0B' },
    { name: 'Search Friction', value: 30, color: '#8B5CF6' },
    { name: 'Autoplay Skips', value: 15, color: '#EF4444' },
  ];

  if (!currentProject) {
    return (
      <div className="flex h-[50vh] items-center justify-center text-slate-400">
        Select a project to view discovery intelligence reports
      </div>
    );
  }

  if (loading && schedules.length === 0 && webhooks.length === 0) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2 font-display">
            Product Discovery Reports
          </h1>
          <p className="text-slate-400">
            AI-Powered insights answering strategic recommendations & music discovery questions.
          </p>
        </div>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'analysis' && (
        <div className="space-y-6">
          {/* Executive Weekly Summary */}
          {weeklySummary && (
            <div className="bg-gradient-to-r from-indigo-950/40 to-slate-900 border border-indigo-500/20 rounded-xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
              <div className="flex items-center gap-2 text-indigo-400 font-semibold mb-3">
                <Sparkles className="w-5 h-5 animate-pulse" />
                <h3 className="font-display">AI Executive Report Summary</h3>
              </div>
              <div className="prose prose-invert max-w-none text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                {weeklySummary}
              </div>
            </div>
          )}

          {/* Grid for Questions 1 & 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Q1: Why do users struggle to discover new music? */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl shadow-black/20 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-bold text-white font-display">
                    1. Why Users Struggle to Discover
                  </h3>
                  <span className="text-xs text-slate-500 font-semibold px-2 py-1 bg-slate-800/80 rounded-md">
                    Radar Breakdown
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-6">
                  Cross-dimensional metrics demonstrating how interface friction and algorithmic
                  biases impact discovery behavior.
                </p>
              </div>

              <div className="h-[280px] w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={strugglesData}>
                    <PolarGrid stroke="#334155" />
                    <PolarAngleAxis dataKey="subject" stroke="#94A3B8" fontSize={11} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#475569" fontSize={10} />
                    <Radar
                      name="Discovery Friction"
                      dataKey="score"
                      stroke="#6366F1"
                      fill="#6366F1"
                      fillOpacity={0.3}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#FFF',
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 bg-slate-950/40 p-3 rounded-lg border border-slate-800/60 text-xs text-slate-300 flex items-start gap-2">
                <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <p>
                  The <strong>Filter Bubble</strong> (82%) is the leading inhibitor, caused by
                  algorithms reinforcing past listen weights rather than branching out.
                </p>
              </div>
            </div>

            {/* Q2: What are the most common frustrations with recommendations? */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl shadow-black/20 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-bold text-white font-display">
                    2. Common Recommendation Frustrations
                  </h3>
                  <span className="text-xs text-slate-500 font-semibold px-2 py-1 bg-slate-800/80 rounded-md">
                    Total Complaints
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-6">
                  Volume of negative user sentiment mentions grouped by recommendation features.
                </p>
              </div>

              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={frustrationsData}
                    layout="vertical"
                    margin={{ left: 10, right: 30, top: 10 }}
                  >
                    <XAxis
                      type="number"
                      stroke="#64748B"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      stroke="#94A3B8"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      width={120}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#FFF',
                      }}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16}>
                      {frustrationsData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 bg-slate-950/40 p-3 rounded-lg border border-slate-800/60 text-xs text-slate-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <p>
                  <strong>Smart Shuffle repeating</strong> has the highest user complaints (142),
                  followed by users annoyed at <strong>Podcast content intrusion</strong> in music
                  feeds.
                </p>
              </div>
            </div>
          </div>

          {/* Grid for Questions 3 & 4 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Q3: What listening behaviors are users trying to achieve? */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl shadow-black/20 flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold text-white mb-2 font-display">
                  3. Targeted Listening Behaviors
                </h3>
                <p className="text-xs text-slate-400 mb-6">
                  Ideal user intent breakdown, revealing user preference for customized vs automated
                  listening experiences.
                </p>
              </div>

              <div className="h-[240px] w-full flex items-center justify-center relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={behaviorsData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={4}
                    >
                      {behaviorsData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => `${value}%`}
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#FFF',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-white">100%</span>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    User Intent
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-[10px] text-slate-400 mt-4 border-t border-slate-800 pt-4">
                {behaviorsData.map((b, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <span
                      className="w-2.5 h-2.5 rounded-full mb-1"
                      style={{ backgroundColor: b.color }}
                    />
                    <span className="font-semibold text-white">{b.value}%</span>
                    <span>{b.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Q4: What causes users to repeatedly listen to the same content? */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl shadow-black/20 flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold text-white mb-2 font-display">
                  4. Root Causes of Repetitive Listening
                </h3>
                <p className="text-xs text-slate-400 mb-6">
                  Analysis of why active listeners end up recycling playlists instead of engaging in
                  discovery paths.
                </p>
              </div>

              <div className="h-[240px] w-full flex items-center justify-center relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={repeatCausesData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={4}
                    >
                      {repeatCausesData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => `${value}%`}
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#FFF',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-white">55%</span>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    Comfort Bias
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-[10px] text-slate-400 mt-4 border-t border-slate-800 pt-4">
                {repeatCausesData.map((b, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <span
                      className="w-2.5 h-2.5 rounded-full mb-1"
                      style={{ backgroundColor: b.color }}
                    />
                    <span className="font-semibold text-white">{b.value}%</span>
                    <span className="line-clamp-1">{b.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Grid for Questions 5 & 6 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Q5: Which user segments experience different discovery challenges? */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl shadow-black/20 flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold text-white mb-2 font-display">
                  5. User Segments Discovery Challenges
                </h3>
                <p className="text-xs text-slate-400 mb-6">
                  Breakdown of specific listener profiles and their primary experience friction.
                </p>
              </div>

              <div className="space-y-4">
                {/* Segment 1 */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 flex items-start gap-4 hover:border-indigo-500/30 transition-all duration-200">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold text-sm">
                    CL
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Casual Listeners (35% volume)</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Struggles with high auto-skip fatigue. Wants zero-effort, high-quality
                      personalized background music without active playlist curation.
                    </p>
                  </div>
                </div>

                {/* Segment 2 */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 flex items-start gap-4 hover:border-indigo-500/30 transition-all duration-200">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold text-sm">
                    AC
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Active Curators (45% volume)</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Frustrated that smart shuffle features insert off-theme pop tracks into niche
                      hand-crafted playlists. Craves granular filters & exclusions.
                    </p>
                  </div>
                </div>

                {/* Segment 3 */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 flex items-start gap-4 hover:border-indigo-500/30 transition-all duration-200">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pink-500/10 text-pink-400 border border-pink-500/20 font-bold text-sm">
                    NE
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Niche Explorers (20% volume)</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Annoyed by mainstream algorithm bias. Demands deep cuts, local independent
                      underground scenes, and emerging artist boosters.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Q6: What unmet needs emerge consistently across reviews? */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl shadow-black/20 flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold text-white mb-2 font-display">
                  6. Key Unmet Discovery Needs
                </h3>
                <p className="text-xs text-slate-400 mb-6">
                  AI-extracted feature requirements consistently raised across forums & reviews.
                </p>
              </div>

              <div className="space-y-3">
                {/* Need 1 */}
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/10">
                      <Check className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-white">Algorithm Taste Reset Button</h4>
                      <p className="text-[10px] text-slate-500">
                        Enable users to clear recent weights or lock current taste profiles
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-bold">
                    High Priority
                  </span>
                </div>

                {/* Need 2 */}
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/10">
                      <Check className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-white">Discovery Intensity Sliders</h4>
                      <p className="text-[10px] text-slate-500">
                        Fine-tune novelty score (Mainstream hits vs underground gems)
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-bold">
                    High Priority
                  </span>
                </div>

                {/* Need 3 */}
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/10">
                      <Check className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-white">Genre & Artist Blacklist</h4>
                      <p className="text-[10px] text-slate-500">
                        Hard exclusions for autoplay, radio mixes and smart recommendations
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 font-bold">
                    Medium Priority
                  </span>
                </div>

                {/* Need 4 */}
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/10">
                      <Check className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-white">
                        Strict Mode Toggle for Playlists
                      </h4>
                      <p className="text-[10px] text-slate-500">
                        Never mix autogenerated recommendations inside custom playlists
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 font-bold">
                    Medium Priority
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'schedules' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-white font-display">Scheduled Email Reports</h3>
              <p className="text-sm text-slate-400">
                Automate discovery insights delivery to product and research stakeholders.
              </p>
            </div>
            <button
              onClick={() => setShowAddSchedule(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule Report</span>
            </button>
          </div>

          {/* Schedule Form Modal Overlay */}
          {showAddSchedule && (
            <div className="fixed inset-0 z-55 flex items-center justify-center p-4">
              <div
                className="absolute inset-0 bg-slate-950/65 backdrop-blur-sm"
                onClick={() => setShowAddSchedule(false)}
              />
              <form
                onSubmit={handleCreateSchedule}
                className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4"
              >
                <h3 className="text-lg font-bold text-white font-display">
                  Schedule Automated Report
                </h3>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400">Schedule Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Weekly Product Management Summary"
                    value={schedName}
                    onChange={(e) => setSchedName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400">Frequency</label>
                    <select
                      value={schedFreq}
                      onChange={(e) => setSchedFreq(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors font-semibold"
                    >
                      <option className="bg-slate-900" value="daily">
                        Daily
                      </option>
                      <option className="bg-slate-900" value="weekly">
                        Weekly
                      </option>
                      <option className="bg-slate-900" value="monthly">
                        Monthly
                      </option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400">
                      Recipients (comma separated)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="pm@company.com, leads@company.com"
                      value={schedRecipients}
                      onChange={(e) => setSchedRecipients(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <label className="text-xs font-semibold text-slate-400 block mb-1">
                    Include Modules
                  </label>
                  <div className="grid grid-cols-2 gap-3 text-sm text-slate-300 font-medium">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={schedSent}
                        onChange={(e) => setSchedSent(e.target.checked)}
                        className="rounded border-slate-850 bg-slate-950 text-indigo-600 focus:ring-0 w-4 h-4"
                      />
                      <span>Sentiment Trends</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={schedThemes}
                        onChange={(e) => setSchedThemes(e.target.checked)}
                        className="rounded border-slate-850 bg-slate-950 text-indigo-600 focus:ring-0 w-4 h-4"
                      />
                      <span>Thematic Analysis</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={schedIssues}
                        onChange={(e) => setSchedIssues(e.target.checked)}
                        className="rounded border-slate-850 bg-slate-950 text-indigo-600 focus:ring-0 w-4 h-4"
                      />
                      <span>Top Customer Issues</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={schedSumm}
                        onChange={(e) => setSchedSumm(e.target.checked)}
                        className="rounded border-slate-850 bg-slate-950 text-indigo-600 focus:ring-0 w-4 h-4"
                      />
                      <span>AI Insights Summary</span>
                    </label>
                  </div>
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddSchedule(false)}
                    className="px-4 py-2 text-sm font-semibold rounded-xl border border-slate-800 bg-slate-905 text-slate-300 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg transition-colors"
                  >
                    Create Schedule
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* List existing schedules */}
          {schedules.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center flex flex-col items-center justify-center">
              <Calendar className="w-12 h-12 text-slate-600 mb-3" />
              <h4 className="text-white font-semibold mb-1">No scheduled reports</h4>
              <p className="text-sm text-slate-400 max-w-sm">
                Create automation rules to receive structured summaries of discovery feedback
                delivered to your inbox.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {schedules.map((s) => (
                <div
                  key={s.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-md flex justify-between items-start"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-400" />
                      <h4 className="text-sm font-bold text-white">{s.name}</h4>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="px-2 py-0.5 bg-slate-800 rounded font-semibold text-slate-300 capitalize">
                        {s.frequency}
                      </span>
                      <span className="text-slate-500">Recipients:</span>
                      <span className="text-slate-400 line-clamp-1 max-w-[200px]">
                        {s.recipients.join(', ')}
                      </span>
                    </div>
                    {s.last_sent_at && (
                      <p className="text-[10px] text-slate-500">
                        Last sent: {new Date(s.last_sent_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleToggleSchedule(s.id, s.enabled)}
                      className={`text-xs px-2.5 py-1 rounded font-bold transition-all border ${
                        s.enabled
                          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                          : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      {s.enabled ? 'Active' : 'Disabled'}
                    </button>
                    <button
                      onClick={() => handleDeleteSchedule(s.id)}
                      className="p-1.5 rounded-lg border border-slate-850 hover:border-red-500/30 text-slate-400 hover:text-red-400 bg-slate-900/50 hover:bg-red-500/5 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'webhooks' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-white font-display">Webhook Subscriptions</h3>
              <p className="text-sm text-slate-400">
                Stream real-time discovery events, spikes and reports straight to other services
                (Slack, Discord, internal APIs).
              </p>
            </div>
            <button
              onClick={() => setShowAddWebhook(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Webhook</span>
            </button>
          </div>

          {/* Webhook Form Modal Overlay */}
          {showAddWebhook && (
            <div className="fixed inset-0 z-55 flex items-center justify-center p-4">
              <div
                className="absolute inset-0 bg-slate-950/65 backdrop-blur-sm"
                onClick={() => setShowAddWebhook(false)}
              />
              <form
                onSubmit={handleCreateWebhook}
                className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4"
              >
                <h3 className="text-lg font-bold text-white font-display">
                  Register Webhook Endpoint
                </h3>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400">Webhook Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Slack Channel Integration"
                    value={whName}
                    onChange={(e) => setWhName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400">Payload URL</label>
                  <input
                    type="url"
                    required
                    placeholder="https://hooks.slack.com/services/..."
                    value={whUrl}
                    onChange={(e) => setWhUrl(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                <div className="space-y-2 pt-2">
                  <label className="text-xs font-semibold text-slate-400 block mb-1">
                    Select Trigger Events
                  </label>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 font-medium">
                    {[
                      { id: 'review.ingested', label: 'Review Ingested' },
                      { id: 'review.analyzed', label: 'Review Analyzed' },
                      { id: 'sentiment.negative_spike', label: 'Negative Spike Alert' },
                      { id: 'report.generated', label: 'Report Generated' },
                      { id: 'issue.critical', label: 'Critical Issue Found' },
                    ].map((evt) => {
                      const isChecked = whEvents.includes(evt.id);
                      return (
                        <label key={evt.id} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setWhEvents([...whEvents, evt.id]);
                              } else {
                                setWhEvents(whEvents.filter((x) => x !== evt.id));
                              }
                            }}
                            className="rounded border-slate-850 bg-slate-950 text-indigo-600 focus:ring-0 w-4 h-4"
                          />
                          <span>{evt.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddWebhook(false)}
                    className="px-4 py-2 text-sm font-semibold rounded-xl border border-slate-800 bg-slate-905 text-slate-300 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg transition-colors"
                  >
                    Add Endpoint
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* List Webhooks */}
          {webhooks.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center flex flex-col items-center justify-center">
              <Webhook className="w-12 h-12 text-slate-600 mb-3" />
              <h4 className="text-white font-semibold mb-1">No webhook endpoints configured</h4>
              <p className="text-sm text-slate-400 max-w-sm">
                Connect third-party messaging channels or endpoints to trigger actions instantly
                when discovery feedback is analyzed.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {webhooks.map((w) => (
                <div
                  key={w.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-md flex justify-between items-center"
                >
                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-white">{w.name}</h4>
                    <p className="text-xs text-indigo-400 font-mono select-all truncate max-w-[300px] md:max-w-[500px]">
                      {w.url}
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {w.events.map((evt: string) => (
                        <span
                          key={evt}
                          className="text-[10px] px-2 py-0.5 bg-slate-950 border border-slate-850 rounded text-slate-400 uppercase font-semibold"
                        >
                          {evt.replace('.', ': ')}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteWebhook(w.id)}
                    className="p-2 rounded-xl border border-slate-800 hover:border-red-500/30 text-slate-400 hover:text-red-400 bg-slate-900/50 hover:bg-red-500/5 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
