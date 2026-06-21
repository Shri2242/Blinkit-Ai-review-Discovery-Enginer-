"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  MessageSquare,
  Sparkles,
  Bug,
  Lightbulb,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import {
  StatCard,
  ChartCard,
  SectionHeader,
  LoadingBlock,
  EmptyState,
} from "@/components/dashboard/shared";
import { api, SOURCE_LABELS, themeLabel } from "@/lib/api";
import type { Stats } from "@/lib/types";
import { useApp } from "@/store/app";
import { useToast } from "@/hooks/use-toast";

/* ---------------- Shared chart styling ---------------- */
const SOURCE_PALETTE = [
  "var(--rp-medium)",
  "var(--rp-positive)",
  "var(--rp-mixed)",
  "var(--rp-high)",
  "var(--rp-negative)",
  "var(--rp-neutral)",
];

const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
};
const labelStyle = { color: "var(--foreground)" };
const itemStyle = { color: "var(--foreground)" };

export function OverviewView() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const setView = useApp((s) => s.setView);
  const { toast } = useToast();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await api.stats();
        if (alive) setStats(data);
      } catch (e) {
        if (alive) {
          toast({
            title: "Failed to load overview",
            description: e instanceof Error ? e.message : "Unknown error",
            variant: "destructive",
          });
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [toast]);

  /* 14-day spark (totals) + week-over-week delta for the headline card */
  const { spark14, totalDelta } = useMemo(() => {
    const trend = stats?.sentimentTrend ?? [];
    const spark = trend.slice(-14).map((d) => d.total);
    const last7 = trend.slice(-7).reduce((a, d) => a + d.total, 0);
    const prev7 = trend.slice(-14, -7).reduce((a, d) => a + d.total, 0);
    const delta = prev7 > 0 ? Math.round(((last7 - prev7) / prev7) * 100) : 0;
    return { spark14: spark, totalDelta: delta };
  }, [stats]);

  /* Sentiment trend — date formatted as MM-DD for the X axis */
  const trendData = useMemo(
    () =>
      (stats?.sentimentTrend ?? []).map((d) => ({
        date: d.date.slice(5),
        positive: d.positive,
        negative: d.negative,
        neutral: d.neutral,
        mixed: d.mixed,
      })),
    [stats],
  );

  /* Top 10 themes by count, formatted with human labels */
  const themeData = useMemo(
    () =>
      (stats?.byTheme ?? [])
        .slice()
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .map((t) => ({ label: themeLabel(t.theme), count: t.count })),
    [stats],
  );

  /* Sources sorted by count, with display labels */
  const sourceData = useMemo(
    () =>
      (stats?.bySource ?? [])
        .slice()
        .sort((a, b) => b.count - a.count)
        .map((s) => ({
          source: s.source,
          label: SOURCE_LABELS[s.source] ?? s.source,
          count: s.count,
        })),
    [stats],
  );
  const sourceTotal = useMemo(
    () => sourceData.reduce((a, s) => a + s.count, 0),
    [sourceData],
  );

  /* Priorities in canonical order, capitalized */
  const priorityData = useMemo(() => {
    const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return (stats?.byPriority ?? [])
      .slice()
      .sort((a, b) => (order[a.priority] ?? 99) - (order[b.priority] ?? 99))
      .map((p) => ({
        priority: p.priority[0].toUpperCase() + p.priority.slice(1),
        count: p.count,
      }));
  }, [stats]);

  /* Top 6 issues + max for relative bar scaling */
  const topIssues = useMemo(() => {
    const arr = (stats?.topIssues ?? [])
      .slice()
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
    const max = arr.length > 0 ? arr[0].count : 1;
    return { arr, max };
  }, [stats]);

  /* ---------------- Loading / empty states ---------------- */
  if (loading) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="Overview"
          description="Real-time analysis of Spotify music-discovery feedback across all sources."
        />
        <LoadingBlock label="Loading overview…" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="Overview"
          description="Real-time analysis of Spotify music-discovery feedback across all sources."
        />
        <EmptyState
          icon={<AlertTriangle className="h-8 w-8" />}
          title="No data available"
          description="Seed the database to populate the overview dashboard."
        />
      </div>
    );
  }

  /* ---------------- Render ---------------- */
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Overview"
        description="Real-time analysis of Spotify music-discovery feedback across all sources."
      />

      {/* 1. Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Reviews"
          value={stats.totals.total.toLocaleString()}
          icon={<MessageSquare className="h-4 w-4" />}
          accent="blue"
          delta={totalDelta}
          deltaLabel="vs last week"
          spark={spark14}
        />
        <StatCard
          label="AI Processed"
          value={stats.totals.processed.toLocaleString()}
          icon={<Sparkles className="h-4 w-4" />}
          accent="green"
          spark={spark14}
        />
        <StatCard
          label="Bugs Found"
          value={stats.totals.bugs.toLocaleString()}
          icon={<Bug className="h-4 w-4" />}
          accent="red"
          spark={spark14}
        />
        <StatCard
          label="Feature Requests"
          value={stats.totals.features.toLocaleString()}
          icon={<Lightbulb className="h-4 w-4" />}
          accent="amber"
          spark={spark14}
        />
      </div>

      {/* 2. Big charts: sentiment trend + theme distribution */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard
          title="Sentiment Trend"
          subtitle="Last 30 days, stacked by sentiment"
          className="lg:col-span-2"
        >
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={trendData}
                margin={{ top: 8, right: 12, left: -12, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="grad-positive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--rp-positive)" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="var(--rp-positive)" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="grad-negative" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--rp-negative)" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="var(--rp-negative)" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="grad-neutral" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--rp-neutral)" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="var(--rp-neutral)" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="grad-mixed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--rp-mixed)" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="var(--rp-mixed)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={16}
                />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={32}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={labelStyle}
                  itemStyle={itemStyle}
                  cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} iconType="circle" />
                <Area
                  type="monotone"
                  dataKey="positive"
                  name="Positive"
                  stackId="a"
                  stroke="var(--rp-positive)"
                  fill="url(#grad-positive)"
                  strokeWidth={1.5}
                />
                <Area
                  type="monotone"
                  dataKey="negative"
                  name="Negative"
                  stackId="a"
                  stroke="var(--rp-negative)"
                  fill="url(#grad-negative)"
                  strokeWidth={1.5}
                />
                <Area
                  type="monotone"
                  dataKey="neutral"
                  name="Neutral"
                  stackId="a"
                  stroke="var(--rp-neutral)"
                  fill="url(#grad-neutral)"
                  strokeWidth={1.5}
                />
                <Area
                  type="monotone"
                  dataKey="mixed"
                  name="Mixed"
                  stackId="a"
                  stroke="var(--rp-mixed)"
                  fill="url(#grad-mixed)"
                  strokeWidth={1.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title="Theme Distribution"
          subtitle="Top themes by review count"
          className="lg:col-span-1"
        >
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={themeData}
                margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  width={110}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={labelStyle}
                  itemStyle={itemStyle}
                  cursor={{ fill: "var(--secondary)", opacity: 0.3 }}
                />
                <Bar
                  dataKey="count"
                  name="Reviews"
                  fill="var(--rp-medium)"
                  radius={[0, 4, 4, 0]}
                  maxBarSize={18}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* 3. Three panels: source donut + priority radar + top issues */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Source breakdown donut */}
        <ChartCard title="Source Breakdown" subtitle="Reviews by collection source">
          <div className="relative h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={labelStyle}
                  itemStyle={itemStyle}
                />
                <Pie
                  data={sourceData}
                  dataKey="count"
                  nameKey="label"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={2}
                  stroke="none"
                >
                  {sourceData.map((s, i) => (
                    <Cell
                      key={s.source}
                      fill={SOURCE_PALETTE[i % SOURCE_PALETTE.length]}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            {/* Center total label */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-heading text-2xl font-semibold text-foreground">
                {sourceTotal.toLocaleString()}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                reviews
              </span>
            </div>
          </div>
          {/* Custom legend with counts */}
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
            {sourceData.map((s, i) => (
              <div
                key={s.source}
                className="flex items-center gap-2 text-xs"
                title={`${s.label}: ${s.count}`}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: SOURCE_PALETTE[i % SOURCE_PALETTE.length] }}
                />
                <span className="truncate text-muted-foreground">{s.label}</span>
                <span className="ml-auto font-mono text-foreground/80">{s.count}</span>
              </div>
            ))}
            {sourceData.length === 0 && (
              <p className="col-span-2 py-4 text-center text-xs text-muted-foreground">
                No source data.
              </p>
            )}
          </div>
        </ChartCard>

        {/* Priority radar */}
        <ChartCard title="Priority Radar" subtitle="Issue distribution by priority">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={priorityData} outerRadius="70%">
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis
                  dataKey="priority"
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                />
                <PolarRadiusAxis
                  stroke="var(--muted-foreground)"
                  fontSize={10}
                  tick={false}
                  axisLine={false}
                />
                <Radar
                  dataKey="count"
                  name="Reviews"
                  stroke="var(--rp-medium)"
                  fill="var(--rp-medium)"
                  fillOpacity={0.35}
                  strokeWidth={1.5}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={labelStyle}
                  itemStyle={itemStyle}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Top issues */}
        <ChartCard
          title="Top Issues"
          subtitle="Ranked by review count"
          action={
            <button
              onClick={() => setView("reviews")}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              View all
              <ArrowRight className="h-3 w-3" />
            </button>
          }
        >
          <div className="space-y-1">
            {topIssues.arr.map((issue, i) => {
              const pct =
                topIssues.max > 0 ? (issue.count / topIssues.max) * 100 : 0;
              return (
                <button
                  key={`${issue.theme}-${i}`}
                  onClick={() => setView("reviews")}
                  className="group flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-secondary/50"
                >
                  <span className="w-5 shrink-0 font-mono text-xs text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-medium text-foreground">
                        {themeLabel(issue.theme)}
                      </span>
                      <span className="shrink-0 rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-foreground/80">
                        {issue.count}
                      </span>
                    </div>
                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-secondary/60">
                      <div
                        className="h-full rounded-full bg-[var(--rp-medium)] transition-all group-hover:bg-[var(--rp-high)]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
            {topIssues.arr.length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No issues detected.
              </p>
            )}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
