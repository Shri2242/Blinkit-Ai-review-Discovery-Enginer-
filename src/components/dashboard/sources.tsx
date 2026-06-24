"use client";

/**
 * SourcesView — dashboard view for ReviewPulse.
 *
 * Two tabs:
 *   1. Automated Sources — quick presets, "Add source" modal with per-type
 *      config fields, source cards (run/pause/delete + collapsible run history),
 *      and a "Run All Enabled" action.
 *   2. Manual Upload — paste CSV/JSON, see insert/skip/error breakdown, kick
 *      off AI analysis, plus a CSV format guide and an in-session upload log.
 *
 * All data is fetched from the ReviewPulse API (`@/lib/api`). Enable/disable
 * and delete are optimistic (no PATCH/DELETE endpoint exposed in the API
 * client); a toast explains they are local-only for the demo.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Database,
  Upload,
  Play,
  Pause,
  Trash2,
  Plus,
  FileText,
  FileJson,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  History,
  Zap,
  ChevronDown,
  ChevronRight,
  Sparkles,
} from "lucide-react";

import {
  SectionHeader,
  ChartCard,
  LoadingBlock,
  EmptyState,
  SourceIcon,
} from "@/components/dashboard/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useApp } from "@/store/app";
import { cn } from "@/lib/utils";
import { api, SOURCE_LABELS } from "@/lib/api";
import type { CollectorSource } from "@/lib/types";

/* ============================================================= *
 * Static definitions
 * ============================================================= */

type SourceTypeKey = "google_play" | "app_store" | "reddit" | "twitter";

interface ConfigField {
  key: string;
  label: string;
  placeholder?: string;
  defaultValue: string;
}

/** Per-source-type config fields rendered in the "Add source" modal. */
const SOURCE_FIELD_DEFS: Record<SourceTypeKey, ConfigField[]> = {
  google_play: [
    { key: "appId", label: "App ID", placeholder: "com.spotify.music", defaultValue: "com.spotify.music" },
    { key: "lang", label: "Language", placeholder: "en", defaultValue: "en" },
  ],
  app_store: [
    { key: "appId", label: "App ID", placeholder: "324684580", defaultValue: "324684580" },
    { key: "country", label: "Country", placeholder: "us", defaultValue: "us" },
  ],
  reddit: [
    { key: "subreddit", label: "Subreddit", placeholder: "spotify", defaultValue: "spotify" },
    { key: "sort", label: "Sort", placeholder: "new", defaultValue: "new" },
  ],
  twitter: [
    { key: "query", label: "Query", placeholder: "spotify app", defaultValue: "spotify app" },
    { key: "limit", label: "Limit", placeholder: "50", defaultValue: "50" },
  ],
};

interface Preset {
  label: string;
  description: string;
  sourceType: SourceTypeKey;
  name: string;
  config: Record<string, string>;
}

/** Quick preset cards shown at the top of the Automated Sources tab. */
const PRESETS: Preset[] = [
  {
    label: "Spotify · Google Play",
    description: "Pull newest reviews from the Spotify Android app on Google Play.",
    sourceType: "google_play",
    name: "Spotify — Google Play Reviews",
    config: { appId: "com.spotify.music", lang: "en", sort: "newest" },
  },
  {
    label: "Spotify · App Store",
    description: "Pull newest reviews from the Spotify iOS app on the App Store.",
    sourceType: "app_store",
    name: "Spotify — App Store Reviews",
    config: { appId: "324684580", country: "us" },
  },
  {
    label: "r/spotify · Reddit",
    description: "Crawl newest posts and top comments from the r/spotify subreddit.",
    sourceType: "reddit",
    name: "r/spotify — Reddit Posts",
    config: { subreddit: "spotify", sort: "new" },
  },
];

const DEFAULT_SCHEDULE = "0 9 * * *";

/** 6-row sample CSV that successfully ingests via /api/ingest. */
const SAMPLE_CSV = `text,rating,source,author,title,source_review_id
"Spotify keeps removing songs from my Discover Weekly — please stop doing this!",2,google_play,jane_doe42,Discover Weekly keeps deleting songs,gp_demo_1001
"The new UI is so confusing — I can't find my library anymore. Bring back the old layout!",1,app_store,music_lover_88,Bring back the old library UI,as_demo_2002
"I love the AI DJ feature — finally discovered 3 new artists this week!",5,reddit,u/beatsfanatic,,rd_demo_3003
"Crashes every time I try to play a downloaded playlist offline. Used to work fine last month.",1,google_play,mike_runner,Offline downloads crash on play,gp_demo_1004
"Can we get a way to filter Discover Weekly by genre? That would be amazing.",4,app_store,synthwave_kid,Genre filter for Discover Weekly,as_demo_2005
"Why does Spotify Wrapped show wrong stats this year? My top artist is wrong.",2,twitter,@wrappedconfused,,tw_demo_4006`;

/* ============================================================= *
 * Helpers
 * ============================================================= */

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "never";
  const diff = Date.now() - then;
  const sec = Math.floor(diff / 1000);
  if (sec < 0) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

interface StatusStyle {
  dot: string;
  label: string;
  className: string;
}

function statusStyle(status: string | null | undefined): StatusStyle {
  switch (status) {
    case "success":
      return { dot: "bg-emerald-400", label: "Success", className: "rp-bg-positive" };
    case "partial":
      return { dot: "bg-amber-400", label: "Partial", className: "rp-bg-mixed" };
    case "failed":
      return { dot: "bg-red-400", label: "Failed", className: "rp-bg-negative" };
    default:
      return { dot: "bg-muted-foreground/50", label: "Never run", className: "bg-secondary/60 text-muted-foreground" };
  }
}

function formatDuration(ms: number): string {
  if (!ms || ms < 1) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/* ============================================================= *
 * Main view
 * ============================================================= */

export function SourcesView() {
  const { toast } = useToast();
  const activeProjectId = useApp((s) => s.activeProjectId);
  const [sources, setSources] = useState<CollectorSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [preset, setPreset] = useState<Preset | null>(null);
  const [runningAll, setRunningAll] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const data = await api.sources(activeProjectId);
      setSources(data.sources);
    } catch (e) {
      toast({
        title: "Failed to load sources",
        variant: "destructive",
        description: e instanceof Error ? e.message : "",
      });
    } finally {
      setLoading(false);
    }
  }, [toast, activeProjectId]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh, activeProjectId]);

  useEffect(() => {
    const handler = () => {
      refresh();
    };
    window.addEventListener("rp-refresh", handler);
    return () => {
      window.removeEventListener("rp-refresh", handler);
    };
  }, [refresh, activeProjectId]);

  const enabledCount = sources.filter((s) => s.enabled).length;
  const totalCollected = sources.reduce((acc, s) => acc + s.totalCollected, 0);

  const lastActivity = useMemo(() => {
    const ts = sources
      .filter((s) => s.lastRunAt)
      .map((s) => new Date(s.lastRunAt as string).getTime())
      .sort((a, b) => b - a)[0];
    return ts ? relativeTime(new Date(ts).toISOString()) : "never";
  }, [sources]);

  /* ---- modal openers ---- */
  const openAddBlank = () => {
    setPreset(null);
    setAddOpen(true);
  };

  const openAddPreset = (p: Preset) => {
    setPreset(p);
    setAddOpen(true);
  };

  /* ---- per-source actions ---- */
  const runOne = async (source: CollectorSource) => {
    setRunningId(source.id);
    try {
      const r = await api.collect(source.id, activeProjectId);
      const res = r.results?.[0];
      if (res?.error) {
        toast({
          title: `Run failed · ${source.name}`,
          variant: "destructive",
          description: res.error,
        });
      } else if (res) {
        toast({
          title: `Run complete · ${source.name}`,
          description: `Fetched ${res.fetched ?? 0} · ${res.new ?? 0} new · ${res.duplicate ?? 0} duplicate.`,
        });
      }
      await refresh();
    } catch (e) {
      toast({
        title: `Run failed · ${source.name}`,
        variant: "destructive",
        description: e instanceof Error ? e.message : "",
      });
    } finally {
      setRunningId(null);
    }
  };

  const runAll = async () => {
    setRunningAll(true);
    try {
      const r = await api.collect(undefined, activeProjectId);
      const fetched = r.results.reduce((a, x) => a + (x.fetched ?? 0), 0);
      const newCount = r.results.reduce((a, x) => a + (x.new ?? 0), 0);
      const dup = r.results.reduce((a, x) => a + (x.duplicate ?? 0), 0);
      const errorCount = r.results.filter((x) => x.error).length;
      if (errorCount > 0) {
        toast({
          title: `Run complete · ${errorCount} error${errorCount > 1 ? "s" : ""}`,
          description: `${newCount} new / ${fetched} fetched / ${dup} duplicate. ${errorCount} source(s) failed.`,
          variant: "destructive",
        });
      } else {
        const totalNew = r.totalNew ?? 0;
        const analyzed = r.analysis?.processed ?? 0;
        toast({
          title: "Pull Complete",
          description: `Pulled ${totalNew} new reviews and analyzed ${analyzed}. Dashboard updated.`,
        });
        window.dispatchEvent(new Event("rp-refresh"));
      }
      await refresh();
    } catch (e) {
      toast({
        title: "Run all failed",
        variant: "destructive",
        description: e instanceof Error ? e.message : "",
      });
    } finally {
      setRunningAll(false);
    }
  };

  const handlePullNewReviews = async () => {
    setPulling(true);
    try {
      const r = await api.collect(undefined, activeProjectId);
      const totalNew = r.totalNew ?? 0;
      const analyzed = r.analysis?.processed ?? 0;
      toast({
        title: "Pull Complete",
        description: `Pulled ${totalNew} new reviews and analyzed ${analyzed}. Dashboard updated.`,
      });
      window.dispatchEvent(new Event("rp-refresh"));
      await refresh();
    } catch (e) {
      toast({
        title: "Failed to pull reviews",
        variant: "destructive",
        description: e instanceof Error ? e.message : "An unexpected error occurred",
      });
    } finally {
      setPulling(false);
    }
  };

  // Pause/enable and delete are optimistic — the API client does not expose
  // PATCH/DELETE endpoints, so these are local UI state for the demo.
  const toggleEnabled = (source: CollectorSource) => {
    setSources((prev) =>
      prev.map((s) => (s.id === source.id ? { ...s, enabled: !s.enabled } : s)),
    );
    toast({
      title: source.enabled ? `Paused · ${source.name}` : `Enabled · ${source.name}`,
      description: source.enabled
        ? "Collector paused. It will be skipped by 'Run All Enabled' and the daily schedule."
        : "Collector enabled. It will be picked up by the daily schedule.",
    });
  };

  const deleteSource = (source: CollectorSource) => {
    setSources((prev) => prev.filter((s) => s.id !== source.id));
    toast({
      title: `Deleted · ${source.name}`,
      description: "Collector removed from this project (demo: local-only).",
    });
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Sources"
        description="Connect automated collectors or upload reviews manually. Collected reviews are deduplicated and queued for AI analysis."
      />

      <Tabs defaultValue="auto">
        <TabsList className="bg-card">
          <TabsTrigger value="auto" className="gap-1.5">
            <Database className="h-3.5 w-3.5" /> Automated Sources
          </TabsTrigger>
          <TabsTrigger value="manual" className="gap-1.5">
            <Upload className="h-3.5 w-3.5" /> Manual Upload
          </TabsTrigger>
        </TabsList>

        {/* ==================== TAB 1: Automated ==================== */}
        <TabsContent value="auto" className="mt-4 space-y-6">
          {/* Prominent Pull Reviews Banner */}
          <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-5">
            <div className="absolute right-0 top-0 -mr-6 -mt-6 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                  <h4 className="font-heading text-sm font-semibold text-foreground">Sync review feeds</h4>
                </div>
                <p className="text-xs text-muted-foreground max-w-xl">
                  Pull latest reviews from Google Play, App Store, and Reddit, and automatically process them with Hugging Face AI.
                </p>
              </div>
              <Button
                onClick={handlePullNewReviews}
                disabled={pulling}
                className="relative overflow-hidden bg-primary hover:bg-primary/90 text-white gap-2 font-medium shadow-md shadow-primary/25 shrink-0 self-start sm:self-center"
              >
                {pulling ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Pulling & Analyzing…</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    <span>Pull New Reviews Now</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* summary strip */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryTile label="Collectors" value={sources.length} icon={<Database className="h-3.5 w-3.5" />} />
            <SummaryTile label="Enabled" value={enabledCount} accent="green" icon={<Play className="h-3.5 w-3.5" />} />
            <SummaryTile label="Total collected" value={totalCollected} accent="blue" icon={<Zap className="h-3.5 w-3.5" />} />
            <SummaryTile label="Last activity" value={lastActivity} accent="amber" icon={<Clock className="h-3.5 w-3.5" />} />
          </div>

          {/* preset cards row */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-heading text-sm font-semibold text-foreground">Quick presets</h3>
              <p className="text-xs text-muted-foreground">One-click setup for Spotify collectors.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {PRESETS.map((p) => (
                <button key={p.label} type="button" onClick={() => openAddPreset(p)} className="group text-left">
                  <Card className="rp-card-hover h-full border-border/60 bg-card p-4 transition hover:border-[var(--rp-medium)]/70">
                    <div className="flex items-center gap-2.5">
                      <span className="rp-bg-medium inline-flex h-9 w-9 items-center justify-center rounded-lg text-foreground">
                        <SourceIcon source={p.sourceType} className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{p.label}</p>
                        <p className="text-[11px] text-muted-foreground">{SOURCE_LABELS[p.sourceType]}</p>
                      </div>
                      <Plus className="ml-auto h-4 w-4 text-muted-foreground transition group-hover:text-foreground" />
                    </div>
                    <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>
                  </Card>
                </button>
              ))}
            </div>
          </div>

          {/* actions bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-heading text-sm font-semibold text-foreground">Configured sources</h3>
              <p className="text-xs text-muted-foreground">
                {enabledCount} of {sources.length} enabled · runs daily on schedule.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={runAll} disabled={runningAll || enabledCount === 0}>
                <RefreshCw className={cn("h-3.5 w-3.5", runningAll && "animate-spin")} />
                {runningAll ? "Running…" : "Run All Enabled"}
              </Button>
              <Button size="sm" className="gap-1.5" onClick={openAddBlank}>
                <Plus className="h-3.5 w-3.5" /> Add Source
              </Button>
            </div>
          </div>

          {/* sources grid */}
          {loading ? (
            <LoadingBlock label="Loading sources…" />
          ) : sources.length === 0 ? (
            <EmptyState
              icon={<Database className="h-8 w-8" />}
              title="No collector sources yet"
              description="Add one manually or pick a preset above to start pulling in fresh reviews."
              action={
                <Button size="sm" className="gap-1.5" onClick={openAddBlank}>
                  <Plus className="h-3.5 w-3.5" /> Add your first source
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {sources.map((s) => (
                <SourceCard
                  key={s.id}
                  source={s}
                  running={runningId === s.id}
                  expanded={expandedId === s.id}
                  onToggleExpand={() => setExpandedId((id) => (id === s.id ? null : s.id))}
                  onRun={() => runOne(s)}
                  onToggleEnabled={() => toggleEnabled(s)}
                  onDelete={() => deleteSource(s)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ==================== TAB 2: Manual Upload ==================== */}
        <TabsContent value="manual" className="mt-4 space-y-6">
          <ManualUpload />
        </TabsContent>
      </Tabs>

      {/* add source modal */}
      <AddSourceDialog
        open={addOpen}
        preset={preset}
        onOpenChange={setAddOpen}
        onCreated={() => {
          setAddOpen(false);
          refresh();
        }}
      />
    </div>
  );
}

/* ============================================================= *
 * Sub-components
 * ============================================================= */

function SummaryTile({
  label,
  value,
  icon,
  accent = "blue",
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  accent?: "blue" | "green" | "amber";
}) {
  const cls = accent === "green" ? "rp-bg-positive" : accent === "amber" ? "rp-bg-mixed" : "rp-bg-medium";
  return (
    <Card className="border-border/60 bg-card p-3">
      <div className="flex items-center gap-2">
        <span className={cn("inline-flex h-7 w-7 items-center justify-center rounded-md", cls)}>{icon}</span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <p className="mt-2 font-heading text-lg font-semibold capitalize text-foreground">{value}</p>
    </Card>
  );
}

function SourceCard({
  source,
  running,
  expanded,
  onToggleExpand,
  onRun,
  onToggleEnabled,
  onDelete,
}: {
  source: CollectorSource;
  running: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onRun: () => void;
  onToggleEnabled: () => void;
  onDelete: () => void;
}) {
  const st = statusStyle(source.lastRunStatus);
  const lastLog = source.recentLogs?.[0] ?? null;
  const logs = source.recentLogs ?? [];

  return (
    <Card className="flex flex-col border-border/60 bg-card p-5">
      {/* header */}
      <div className="flex items-start gap-3">
        <span className="rp-bg-medium inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-foreground">
          <SourceIcon source={source.sourceType} className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-sm font-semibold text-foreground">{source.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="border-border/70 bg-secondary/40 text-[10px] font-medium text-foreground/80">
              {SOURCE_LABELS[source.sourceType] ?? source.sourceType}
            </Badge>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                source.enabled ? "rp-bg-positive" : "bg-secondary/60 text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  source.enabled ? "bg-emerald-400" : "bg-muted-foreground/60",
                )}
              />
              {source.enabled ? "Enabled" : "Paused"}
            </span>
          </div>
        </div>
      </div>

      {/* last run panel */}
      <div className="mt-4 space-y-2 rounded-lg border border-border/50 bg-secondary/20 p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Last run</span>
          <span className="text-foreground/80">{relativeTime(source.lastRunAt)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase",
              st.className,
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} />
            {st.label}
          </span>
          {lastLog ? (
            <span className="text-[11px] text-muted-foreground">
              {lastLog.reviewsNew} new / {lastLog.reviewsFetched} fetched · {lastLog.reviewsDuplicate} dup
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground">No runs yet</span>
          )}
        </div>
        {source.errorMessage ? (
          <p className="text-[11px] text-red-400/90">{source.errorMessage}</p>
        ) : null}
      </div>

      {/* meta grid */}
      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-muted-foreground">Total collected</p>
          <p className="font-heading text-base font-semibold text-foreground">{source.totalCollected}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Schedule</p>
          <p className="font-mono text-[11px] text-foreground/90">{source.schedule}</p>
        </div>
      </div>

      {/* actions */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="default" className="gap-1.5" onClick={onRun} disabled={running}>
          <Play className={cn("h-3.5 w-3.5", running && "animate-pulse")} />
          {running ? "Running…" : "Run Now"}
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={onToggleEnabled}>
          {source.enabled ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          {source.enabled ? "Pause" : "Enable"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto gap-1.5 text-muted-foreground hover:text-red-400"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </Button>
      </div>

      {/* recent runs (collapsible) */}
      {logs.length > 0 ? (
        <div className="mt-3 border-t border-border/50 pt-3">
          <button
            type="button"
            onClick={onToggleExpand}
            className="flex w-full items-center gap-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
          >
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            <History className="h-3.5 w-3.5" /> Recent runs ({logs.length})
          </button>
          {expanded ? (
            <div className="mt-2">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/40 hover:bg-transparent">
                    <TableHead className="h-7 text-[10px] uppercase text-muted-foreground">Status</TableHead>
                    <TableHead className="h-7 text-[10px] uppercase text-muted-foreground">Fetched</TableHead>
                    <TableHead className="h-7 text-[10px] uppercase text-muted-foreground">New</TableHead>
                    <TableHead className="h-7 text-[10px] uppercase text-muted-foreground">Dup</TableHead>
                    <TableHead className="h-7 text-[10px] uppercase text-muted-foreground">Time</TableHead>
                    <TableHead className="h-7 text-[10px] uppercase text-muted-foreground">When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => {
                    const ls = statusStyle(log.status);
                    return (
                      <TableRow key={log.id} className="border-border/30">
                        <TableCell>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                              ls.className,
                            )}
                          >
                            {ls.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs">{log.reviewsFetched}</TableCell>
                        <TableCell className="text-xs text-emerald-400">{log.reviewsNew}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{log.reviewsDuplicate}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDuration(log.durationMs)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{relativeTime(log.startedAt)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

/* ----------------------- Add source dialog ----------------------- */

function AddSourceDialog({
  open,
  preset,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  preset: Preset | null;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const activeProjectId = useApp((s) => s.activeProjectId);
  const [sourceType, setSourceType] = useState<SourceTypeKey>("google_play");
  const [name, setName] = useState("");
  const [config, setConfig] = useState<Record<string, string>>({});
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE);
  const [creating, setCreating] = useState(false);

  // When the dialog opens, hydrate from preset (or reset to blank defaults).
  useEffect(() => {
    if (!open) return;
    if (preset) {
      setSourceType(preset.sourceType);
      setName(preset.name);
      setConfig({ ...preset.config });
      setSchedule(DEFAULT_SCHEDULE);
    } else {
      setSourceType("google_play");
      setName("");
      setConfig(buildDefaults("google_play"));
      setSchedule(DEFAULT_SCHEDULE);
    }
  }, [open, preset]);

  // When the source type changes (and no preset is active), re-seed config
  // defaults for the newly-chosen type.
  useEffect(() => {
    if (!open || preset) return;
    setConfig(buildDefaults(sourceType));
  }, [sourceType, open]);

  const fields = SOURCE_FIELD_DEFS[sourceType];

  const create = async () => {
    if (!name.trim()) {
      toast({ title: "Name required", variant: "destructive", description: "Give this collector a name." });
      return;
    }
    setCreating(true);
    try {
      await api.createSource({
        sourceType,
        name: name.trim(),
        config,
        schedule: schedule.trim() || DEFAULT_SCHEDULE,
      }, activeProjectId);
      toast({
        title: "Source created",
        description: `${name.trim()} is now collecting reviews.`,
      });
      onCreated();
    } catch (e) {
      toast({
        title: "Failed to create source",
        variant: "destructive",
        description: e instanceof Error ? e.message : "",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-border/60 bg-popover">
        <DialogHeader>
          <DialogTitle>{preset ? "Add preset collector" : "Add collector source"}</DialogTitle>
          <DialogDescription>
            Configure a new automated collector. Reviews are deduplicated by <code className="font-mono text-[11px]">source_review_id</code>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* source type */}
          <div className="space-y-1.5">
            <Label>Source type</Label>
            <Select value={sourceType} onValueChange={(v) => setSourceType(v as SourceTypeKey)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pick a source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="google_play">Google Play</SelectItem>
                <SelectItem value="app_store">App Store</SelectItem>
                <SelectItem value="reddit">Reddit</SelectItem>
                <SelectItem value="twitter">Twitter / X</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* name */}
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Spotify — Google Play Reviews"
            />
          </div>

          {/* dynamic config fields */}
          <div className="grid grid-cols-2 gap-3">
            {fields.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label>{f.label}</Label>
                <Input
                  value={config[f.key] ?? ""}
                  onChange={(e) => setConfig((c) => ({ ...c, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                />
              </div>
            ))}
          </div>

          {/* schedule */}
          <div className="space-y-1.5">
            <Label>Schedule (cron)</Label>
            <Input
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              className="font-mono text-xs"
              placeholder="0 9 * * *"
            />
            <p className="text-[11px] text-muted-foreground">
              Defaults to daily at 09:00 UTC. Standard 5-field cron syntax.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={create} disabled={creating} className="gap-2">
            <Plus className="h-4 w-4" /> {creating ? "Creating…" : "Create source"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function buildDefaults(type: SourceTypeKey): Record<string, string> {
  const next: Record<string, string> = {};
  for (const f of SOURCE_FIELD_DEFS[type]) next[f.key] = f.defaultValue;
  return next;
}

/* ----------------------- Manual upload tab ----------------------- */

interface UploadHistoryEntry {
  id: string;
  timestamp: string;
  format: "csv" | "json";
  totalRows: number;
  inserted: number;
  skipped: number;
  errors: number;
}

interface UploadResult {
  inserted: number;
  skipped: number;
  errors: number;
  errorSamples: string[];
  totalRows: number;
}

function ManualUpload() {
  const { toast } = useToast();
  const activeProjectId = useApp((s) => s.activeProjectId);
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [content, setContent] = useState("");
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [history, setHistory] = useState<UploadHistoryEntry[]>([]);

  const loadSample = () => {
    setFormat("csv");
    setContent(SAMPLE_CSV);
    setResult(null);
  };

  const upload = async () => {
    if (!content.trim()) {
      toast({
        title: "Nothing to upload",
        variant: "destructive",
        description: "Paste some CSV or JSON first.",
      });
      return;
    }
    setUploading(true);
    try {
      const r = await api.ingest(content, format, activeProjectId);
      const res: UploadResult = {
        inserted: r.inserted,
        skipped: r.skipped,
        errors: r.errors,
        errorSamples: r.errorSamples ?? [],
        totalRows: r.totalRows,
      };
      setResult(res);
      setHistory((h) => [
        {
          id: `up_${Date.now()}`,
          timestamp: new Date().toISOString(),
          format,
          totalRows: res.totalRows,
          inserted: res.inserted,
          skipped: res.skipped,
          errors: res.errors,
        },
        ...h,
      ]);
      toast({
        title: res.errors > 0 ? "Upload completed with errors" : "Upload complete",
        description: `${res.inserted} inserted · ${res.skipped} skipped · ${res.errors} errors.`,
        variant: res.errors > 0 ? "destructive" : "default",
      });
    } catch (e) {
      toast({
        title: "Upload failed",
        variant: "destructive",
        description: e instanceof Error ? e.message : "",
      });
    } finally {
      setUploading(false);
    }
  };

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const r = await api.analyze(500, activeProjectId);
      toast({
        title: "AI analysis queued",
        description: r.message ?? `Processed ${r.processed} new reviews.`,
      });
    } catch (e) {
      toast({
        title: "AI analysis failed",
        variant: "destructive",
        description: e instanceof Error ? e.message : "",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const ok = result !== null && result.errors === 0;

  return (
    <div className="space-y-6">
      {/* upload area */}
      <ChartCard
        title="Manual upload"
        subtitle="Paste raw CSV or JSON reviews. They are deduplicated against existing reviews and queued for AI analysis."
        action={
          <Button variant="outline" size="sm" className="gap-1.5" onClick={loadSample}>
            <FileText className="h-3.5 w-3.5" /> Load sample CSV
          </Button>
        }
      >
        <div className="space-y-3">
          {/* format toggle */}
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Format</Label>
            <div className="inline-flex rounded-md border border-border/60 bg-secondary/30 p-0.5">
              <button
                type="button"
                onClick={() => setFormat("csv")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition",
                  format === "csv" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <FileText className="h-3 w-3" /> CSV
              </button>
              <button
                type="button"
                onClick={() => setFormat("json")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition",
                  format === "json" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <FileJson className="h-3 w-3" /> JSON
              </button>
            </div>
          </div>

          {/* dropzone + textarea */}
          <div className="rounded-lg border border-dashed border-border/70 bg-card/40 p-3">
            <div className="mb-2 flex items-center justify-center gap-2 py-2 text-muted-foreground">
              <Upload className="h-4 w-4" />
              <span className="text-xs">Drag &amp; drop a CSV or JSON file, or paste below</span>
            </div>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={
                format === "csv"
                  ? "text,rating,source,author,title,source_review_id\n\"Great app!\",5,google_play,user1,Title here,rev_001"
                  : '[\n  { "text": "Great app!", "rating": 5, "source": "google_play", "author": "user1", "title": "Title here", "source_review_id": "rev_001" }\n]'
              }
              className="min-h-[180px] resize-y font-mono text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">
              {content
                ? `${content.split("\n").length} line(s) · ~${content.length} chars`
                : "Empty — load sample or paste."}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setContent("");
                  setResult(null);
                }}
                disabled={!content && !result}
              >
                Clear
              </Button>
              <Button size="sm" className="gap-1.5" onClick={upload} disabled={uploading || !content.trim()}>
                <Upload className="h-3.5 w-3.5" /> {uploading ? "Uploading…" : "Upload"}
              </Button>
            </div>
          </div>
        </div>
      </ChartCard>

      {/* result panel */}
      {result ? (
        <Card
          className={cn(
            "border-border/60 bg-card p-5",
            ok ? "border-emerald-500/30" : "border-amber-500/30",
          )}
        >
          <div className="flex items-start gap-3">
            {ok ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            )}
            <div className="flex-1">
              <p className="font-heading text-sm font-semibold text-foreground">
                {ok ? "Upload succeeded" : "Upload completed with issues"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Parsed {result.totalRows} row(s) from your {format.toUpperCase()} payload.
              </p>

              <div className="mt-3 grid grid-cols-3 gap-3">
                <ResultStat label="Inserted" value={result.inserted} accent="green" />
                <ResultStat label="Skipped (dup)" value={result.skipped} accent="amber" />
                <ResultStat label="Errors" value={result.errors} accent="red" />
              </div>

              {result.errorSamples.length > 0 ? (
                <div className="mt-3">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Error samples
                  </p>
                  <ScrollArea className="mt-1.5 max-h-32 rounded-md border border-border/40 bg-secondary/20 p-2">
                    <ul className="space-y-1 text-[11px] text-red-300/90">
                      {result.errorSamples.slice(0, 10).map((s, i) => (
                        <li key={i} className="font-mono leading-relaxed">• {s}</li>
                      ))}
                    </ul>
                  </ScrollArea>
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={runAnalysis}
                  disabled={analyzing || result.inserted === 0}
                >
                  <Sparkles className="h-3.5 w-3.5" /> {analyzing ? "Analyzing…" : "Run AI Analysis"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setContent("")}>
                  Upload more
                </Button>
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      {/* CSV format guide */}
      <ChartCard title="CSV format guide" subtitle="Expected columns when uploading CSV reviews.">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {["text", "rating", "source", "author", "title", "source_review_id"].map((c) => (
              <Badge
                key={c}
                variant="outline"
                className="border-border/70 bg-secondary/40 font-mono text-[11px] text-foreground/80"
              >
                {c}
              </Badge>
            ))}
          </div>
          <Table>
            <TableHeader>
              <TableRow className="border-border/40 hover:bg-transparent">
                <TableHead className="h-8 text-[10px] uppercase text-muted-foreground">Column</TableHead>
                <TableHead className="h-8 text-[10px] uppercase text-muted-foreground">Required</TableHead>
                <TableHead className="h-8 text-[10px] uppercase text-muted-foreground">Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(
                [
                  ["text", "Yes", "The review body. Wrap in quotes to escape commas."],
                  ["rating", "Yes", "Integer from 1 to 5."],
                  ["source", "Yes", "One of: google_play, app_store, reddit, twitter, csv_upload."],
                  ["author", "Yes", "Author handle or display name."],
                  ["title", "No", "Review title. Leave empty for Twitter / some Reddit posts."],
                  ["source_review_id", "Yes", "Unique ID from the upstream source — used for dedup."],
                ] as const
              ).map(([col, req, desc]) => (
                <TableRow key={col} className="border-border/30">
                  <TableCell className="font-mono text-xs text-foreground/90">{col}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{req}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{desc}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="rounded-md border border-border/40 bg-secondary/20 p-3">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Example row
            </p>
            <code className="block whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-foreground/80">
              {`"Discover Weekly keeps surfacing the same 20 songs",2,google_play,jane_doe42,Playlist fatigue,gp_12345`}
            </code>
          </div>
        </div>
      </ChartCard>

      {/* upload history */}
      <ChartCard title="Upload history" subtitle="In-session record of manual uploads.">
        {history.length === 0 ? (
          <EmptyState title="No uploads yet" description="Your manual uploads will appear here." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border/40 hover:bg-transparent">
                <TableHead className="h-8 text-[10px] uppercase text-muted-foreground">When</TableHead>
                <TableHead className="h-8 text-[10px] uppercase text-muted-foreground">Format</TableHead>
                <TableHead className="h-8 text-[10px] uppercase text-muted-foreground">Rows</TableHead>
                <TableHead className="h-8 text-[10px] uppercase text-muted-foreground">Inserted</TableHead>
                <TableHead className="h-8 text-[10px] uppercase text-muted-foreground">Skipped</TableHead>
                <TableHead className="h-8 text-[10px] uppercase text-muted-foreground">Errors</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((h) => (
                <TableRow key={h.id} className="border-border/30">
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(h.timestamp).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="border-border/70 bg-secondary/40 text-[10px] font-mono uppercase"
                    >
                      {h.format}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{h.totalRows}</TableCell>
                  <TableCell className="text-xs text-emerald-400">{h.inserted}</TableCell>
                  <TableCell className="text-xs text-amber-400">{h.skipped}</TableCell>
                  <TableCell className="text-xs text-red-400">{h.errors}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ChartCard>
    </div>
  );
}

function ResultStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "green" | "amber" | "red";
}) {
  const cls = accent === "green" ? "rp-bg-positive" : accent === "amber" ? "rp-bg-mixed" : "rp-bg-negative";
  const color =
    accent === "green" ? "text-emerald-400" : accent === "amber" ? "text-amber-400" : "text-red-400";
  return (
    <div className="rounded-md border border-border/50 bg-secondary/20 p-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-heading text-2xl font-semibold", color)}>{value}</p>
      <span className={cn("mt-1 block h-1 w-full rounded-full", cls)} />
    </div>
  );
}
