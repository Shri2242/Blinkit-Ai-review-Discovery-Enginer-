"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  SectionHeader,
  ChartCard,
  LoadingBlock,
  EmptyState,
  SourceBadge,
  RatingStars,
} from "@/components/dashboard/shared";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { api, themeLabel } from "@/lib/api";
import type { Insights } from "@/lib/types";
import { useApp } from "@/store/app";
import { cn } from "@/lib/utils";
import {
  Lightbulb,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ArrowRight,
  Quote,
  Sparkles,
  Bug,
  ChevronRight,
  Flame,
  Target,
  MessageSquare,
  Minus,
} from "lucide-react";

export function InsightsView() {
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const setView = useApp((s) => s.setView);
  const activeProjectId = useApp((s) => s.activeProjectId);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await api.insights(activeProjectId);
        if (alive) setInsights(data);
      } catch (e) {
        console.error(e);
        if (alive) setError(e instanceof Error ? e.message : "Failed to load insights");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [activeProjectId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="Insights"
          description="Auto-generated from the analyzed review corpus. Top issues are ranked by frequency × severity; emerging trends compare this week to last week."
        />
        <LoadingBlock label="Crunching insights…" />
      </div>
    );
  }

  if (error || !insights) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="Insights"
          description="Auto-generated from the analyzed review corpus. Top issues are ranked by frequency × severity; emerging trends compare this week to last week."
        />
        <EmptyState
          icon={<AlertTriangle className="h-8 w-8" />}
          title="Insights unavailable"
          description={error ?? "Seed and analyze reviews to generate insights."}
        />
      </div>
    );
  }

  const ws = insights.weeklySummary;
  const weekDelta =
    ws.totalLastWeek > 0
      ? Math.round(((ws.totalThisWeek - ws.totalLastWeek) / ws.totalLastWeek) * 100)
      : ws.totalThisWeek > 0
        ? 100
        : 0;
  const weekUp = weekDelta > 0;
  const weekDown = weekDelta < 0;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Insights"
        description="Auto-generated from the analyzed review corpus. Top issues are ranked by frequency × severity; emerging trends compare this week to last week."
        action={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-secondary/40 px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            AI-curated · {ws.weekRange}
          </span>
        }
      />

      {/* ---------------- Weekly summary strip ---------------- */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <SummaryTile
          icon={<MessageSquare className="h-4 w-4" />}
          accent="blue"
          label="Total Reviews"
          value={ws.totalReviews.toLocaleString()}
          hint="All-time analyzed"
        />
        <SummaryTile
          icon={
            weekUp ? <TrendingUp className="h-4 w-4" /> : weekDown ? <TrendingDown className="h-4 w-4" /> : <Minus className="h-4 w-4" />
          }
          accent={weekUp ? "green" : weekDown ? "red" : "amber"}
          label="This Week vs Last"
          value={
            <span className="flex items-baseline gap-1.5">
              {ws.totalThisWeek}
              <span className="text-sm font-normal text-muted-foreground">/ {ws.totalLastWeek}</span>
            </span>
          }
          hint={
            <span
              className={cn(
                "inline-flex items-center gap-1 font-medium",
                weekUp ? "text-emerald-400" : weekDown ? "text-red-400" : "text-muted-foreground",
              )}
            >
              {weekUp ? <TrendingUp className="h-3 w-3" /> : weekDown ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
              {weekUp ? "+" : ""}
              {weekDelta}% WoW
            </span>
          }
        />
        <SummaryTile
          icon={<Target className="h-4 w-4" />}
          accent="amber"
          label="Top Theme"
          value={<span className="block truncate text-lg">{themeLabel(ws.topTheme)}</span>}
          hint="Most frequent this week"
        />
        <SummaryTile
          icon={<AlertTriangle className="h-4 w-4" />}
          accent="red"
          label="Negative Share"
          value={<span style={{ color: "var(--rp-negative)" }}>{ws.negativeShare}%</span>}
          hint="Of weekly reviews"
        />
        <SummaryTile
          icon={<Bug className="h-4 w-4" />}
          accent="amber"
          label="Open Bugs"
          value={<span style={{ color: "var(--rp-high)" }}>{ws.bugCount}</span>}
          hint="Flagged as bugs"
        />
      </div>

      {/* ---------------- Three columns ---------------- */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* (a) Top Issues */}
        <ChartCard
          title="Top Issues"
          subtitle="Ranked by frequency × severity"
          action={
            <span className="rp-bg-negative inline-flex h-7 w-7 items-center justify-center rounded-lg">
              <AlertTriangle className="h-4 w-4" />
            </span>
          }
        >
          {insights.topIssues.length === 0 ? (
            <EmptyState
              icon={<AlertTriangle className="h-8 w-8" />}
              title="No top issues yet"
              description="Analyze reviews to surface the top issues ranked by frequency and severity."
            />
          ) : (
            <ol className="space-y-3">
              {insights.topIssues.slice(0, 6).map((issue, i) => (
                <li
                  key={issue.theme}
                  className="rounded-lg border border-border/60 bg-secondary/20 p-3.5 transition-colors hover:bg-secondary/30"
                >
                  <div className="flex items-start gap-3">
                    <span className="font-mono text-2xl font-bold leading-none text-muted-foreground/40">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-heading text-sm font-semibold text-foreground">{themeLabel(issue.theme)}</p>
                        <Badge
                          variant="outline"
                          className="shrink-0 border-border/70 bg-secondary/40 text-[11px] font-medium text-foreground/80"
                        >
                          {issue.count} {issue.count === 1 ? "review" : "reviews"}
                        </Badge>
                      </div>

                      {/* Negative % bar */}
                      <div className="mt-2.5">
                        <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>Negative share</span>
                          <span className="font-medium" style={{ color: "var(--rp-negative)" }}>
                            {issue.negativePct}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(100, Math.max(2, issue.negativePct))}%`,
                              background: "var(--rp-negative)",
                            }}
                          />
                        </div>
                      </div>

                      {/* Severity chips */}
                      {(issue.critical > 0 || issue.high > 0) && (
                        <div className="mt-2.5 flex items-center gap-1.5">
                          {issue.critical > 0 && (
                            <span
                              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground"
                              style={{ background: "var(--rp-critical)" }}
                            >
                              <AlertTriangle className="h-2.5 w-2.5" />
                              {issue.critical} critical
                            </span>
                          )}
                          {issue.high > 0 && (
                            <span
                              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground"
                              style={{ background: "var(--rp-high)" }}
                            >
                              {issue.high} high
                            </span>
                          )}
                          <span className="ml-auto text-[10px] text-muted-foreground">severity {issue.severity.toFixed(1)}</span>
                        </div>
                      )}

                      {/* Sample quotes */}
                      {issue.samples.length > 0 && (
                        <ul className="mt-3 space-y-2.5">
                          {issue.samples.slice(0, 2).map((s, idx) => (
                            <li key={s.id ?? idx} className="flex gap-2">
                              <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                              <div className="min-w-0">
                                <p className="line-clamp-2 text-xs italic leading-relaxed text-foreground/80">“{s.text}”</p>
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                  <RatingStars rating={s.rating} />
                                  <SourceBadge source={s.source} />
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* Explore link */}
                      <button
                        type="button"
                        onClick={() => setView("reviews")}
                        className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-primary transition-colors hover:text-primary/80"
                      >
                        Explore in Reviews
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </ChartCard>

        {/* (b) Emerging Trends */}
        <ChartCard
          title="Emerging Trends"
          subtitle="This week vs last week"
          action={
            <span className="rp-bg-positive inline-flex h-7 w-7 items-center justify-center rounded-lg">
              <TrendingUp className="h-4 w-4" />
            </span>
          }
        >
          {insights.emergingTrends.length === 0 ? (
            <EmptyState
              icon={<TrendingUp className="h-8 w-8" />}
              title="No emerging trends detected this week."
              description="Trends surface when a theme grows meaningfully week-over-week."
            />
          ) : (
            <ul className="space-y-3">
              {insights.emergingTrends.map((t) => {
                const hot = t.growthPct >= 100;
                const maxBar = Math.max(t.thisWeek, t.lastWeek, 1);
                return (
                  <li key={t.theme} className="rounded-lg border border-border/60 bg-secondary/20 p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-heading text-sm font-semibold text-foreground">{themeLabel(t.theme)}</p>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
                          hot ? "text-amber-300" : "text-emerald-400",
                        )}
                      >
                        {hot ? <Flame className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                        +{t.growthPct}%
                      </span>
                    </div>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      This week: <span className="font-medium text-foreground">{t.thisWeek}</span>
                      <span className="mx-1.5 text-muted-foreground/40">·</span>
                      Last week: <span className="font-medium text-foreground/70">{t.lastWeek}</span>
                    </p>

                    {/* Mini bar pair (last week vs this week) */}
                    <div className="mt-3 flex items-end gap-2">
                      <div className="flex-1">
                        <div className="mb-1 text-center text-[10px] text-muted-foreground/70">Last</div>
                        <div className="flex h-12 items-end justify-center rounded-md bg-secondary/40 p-1">
                          <div
                            className="w-full max-w-[24px] rounded-sm bg-muted-foreground/40"
                            style={{ height: `${(t.lastWeek / maxBar) * 100}%`, minHeight: 2 }}
                          />
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 self-center text-muted-foreground/40" />
                      <div className="flex-1">
                        <div className="mb-1 text-center text-[10px] font-medium text-emerald-400/80">This</div>
                        <div className="flex h-12 items-end justify-center rounded-md bg-secondary/40 p-1">
                          <div
                            className="w-full max-w-[24px] rounded-sm transition-all"
                            style={{
                              height: `${(t.thisWeek / maxBar) * 100}%`,
                              minHeight: 4,
                              background: "var(--rp-positive)",
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ChartCard>

        {/* (c) Feature Requests */}
        <ChartCard
          title="Feature Requests"
          subtitle="What users want next"
          action={
            <span className="rp-bg-medium inline-flex h-7 w-7 items-center justify-center rounded-lg">
              <Lightbulb className="h-4 w-4" />
            </span>
          }
        >
          {insights.featureRequests.length === 0 ? (
            <EmptyState
              icon={<Lightbulb className="h-8 w-8" />}
              title="No feature requests yet"
              description="Feature requests appear once reviews are analyzed and tagged as feature requests."
            />
          ) : (
            <ul className="space-y-3">
              {insights.featureRequests.slice(0, 6).map((fr) => (
                <li key={fr.theme} className="rounded-lg border border-border/60 bg-secondary/20 p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-heading text-sm font-semibold text-foreground">{themeLabel(fr.theme)}</p>
                    <Badge
                      variant="outline"
                      className="shrink-0 border-border/70 bg-secondary/40 text-[11px] font-medium text-foreground/80"
                    >
                      {fr.count} {fr.count === 1 ? "request" : "requests"}
                    </Badge>
                  </div>

                  {fr.samples.length > 0 && (
                    <ul className="mt-2.5 space-y-2.5">
                      {fr.samples.slice(0, 2).map((s, idx) => (
                        <li key={idx} className="flex gap-2">
                          <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                          <div className="min-w-0">
                            <p className="line-clamp-2 text-xs italic leading-relaxed text-foreground/80">“{s.text}”</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <RatingStars rating={s.rating} />
                              <SourceBadge source={s.source} />
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  <button
                    type="button"
                    onClick={() => setView("reviews")}
                    className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-primary transition-colors hover:text-primary/80"
                  >
                    Explore in Reviews
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
      </div>

      {/* ---------------- Footer ---------------- */}
      <Separator className="bg-border/40" />
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Sparkles className="h-3 w-3 text-primary/70" />
        Generated from <span className="font-medium text-foreground/80">{insights.totalAnalyzed.toLocaleString()}</span> analyzed reviews.
      </p>
    </div>
  );
}

/* ---------------- Local Summary Tile ---------------- */
function SummaryTile({
  icon,
  label,
  value,
  hint,
  accent = "blue",
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  accent?: "blue" | "green" | "red" | "amber";
}) {
  const accentBg =
    accent === "green"
      ? "rp-bg-positive"
      : accent === "red"
        ? "rp-bg-negative"
        : accent === "amber"
          ? "rp-bg-mixed"
          : "rp-bg-medium";
  return (
    <Card className="rp-card-hover relative overflow-hidden border-border/60 bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-1.5 font-heading text-2xl font-semibold tracking-tight text-foreground">{value}</p>
        </div>
        <span className={cn("inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", accentBg)}>{icon}</span>
      </div>
      {hint && <div className="mt-2 text-[11px] text-muted-foreground">{hint}</div>}
    </Card>
  );
}
