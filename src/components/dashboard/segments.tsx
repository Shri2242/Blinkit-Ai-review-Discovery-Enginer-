"use client";

import { useEffect, useState } from "react";
import {
  SectionHeader,
  ChartCard,
  LoadingBlock,
  EmptyState,
  SourceIcon,
} from "@/components/dashboard/shared";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { api, SOURCE_LABELS, themeLabel, sentimentColor } from "@/lib/api";
import type { Segments } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Layers, Grid3x3, Star, Bug, Lightbulb } from "lucide-react";

/* ============================================================
   Helpers
   ============================================================ */

const SENTIMENT_LEGEND: { key: string; label: string }[] = [
  { key: "positive", label: "Positive" },
  { key: "negative", label: "Negative" },
  { key: "neutral", label: "Neutral" },
  { key: "mixed", label: "Mixed" },
];

const PRIORITY_LEGEND: { cls: string; label: string }[] = [
  { cls: "rp-bg-critical", label: "Critical" },
  { cls: "rp-bg-high", label: "High" },
  { cls: "rp-bg-medium", label: "Medium" },
  { cls: "rp-bg-low", label: "Low" },
];

function sentimentBgClass(s: string): string {
  switch (s) {
    case "positive":
      return "rp-bg-positive";
    case "negative":
      return "rp-bg-negative";
    case "neutral":
      return "rp-bg-neutral";
    case "mixed":
      return "rp-bg-mixed";
    default:
      return "rp-bg-neutral";
  }
}

/** Horizontal stacked bar showing the sentiment mix for a row. */
function SentimentStackBar({
  positive,
  negative,
  neutral,
  mixed,
  className,
}: {
  positive: number;
  negative: number;
  neutral: number;
  mixed: number;
  className?: string;
}) {
  const total = positive + negative + neutral + mixed;
  if (total === 0) {
    return (
      <div
        className={cn(
          "h-2 w-full rounded-full bg-secondary/50",
          className,
        )}
        title="No sentiment data"
      />
    );
  }
  const segs = [
    { v: positive, color: "var(--rp-positive)", label: "Positive" },
    { v: negative, color: "var(--rp-negative)", label: "Negative" },
    { v: neutral, color: "var(--rp-neutral)", label: "Neutral" },
    { v: mixed, color: "var(--rp-mixed)", label: "Mixed" },
  ];
  return (
    <div
      className={cn(
        "flex h-2 w-full overflow-hidden rounded-full bg-secondary/40",
        className,
      )}
      title={`+${positive} · −${negative} · ~${neutral} · ◳${mixed}`}
    >
      {segs.map(
        (s, i) =>
          s.v > 0 && (
            <div
              key={i}
              style={{
                width: `${(s.v / total) * 100}%`,
                backgroundColor: s.color,
              }}
            />
          ),
      )}
    </div>
  );
}

/** Compact colored chips for the priority breakdown. */
function PriorityChips({
  critical,
  high,
  medium,
  low,
}: {
  critical: number;
  high: number;
  medium: number;
  low: number;
}) {
  const chips = [
    { v: critical, label: "C", cls: "rp-bg-critical", title: "Critical" },
    { v: high, label: "H", cls: "rp-bg-high", title: "High" },
    { v: medium, label: "M", cls: "rp-bg-medium", title: "Medium" },
    { v: low, label: "L", cls: "rp-bg-low", title: "Low" },
  ];
  const allZero = chips.every((c) => c.v === 0);
  if (allZero) {
    return <span className="text-xs text-muted-foreground/40">—</span>;
  }
  return (
    <div className="flex flex-wrap items-center gap-1">
      {chips.map((c, i) => (
        <span
          key={i}
          className={cn(
            "inline-flex min-w-[1.5rem] items-center justify-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
            c.cls,
            c.v === 0 && "opacity-40",
          )}
          title={`${c.title}: ${c.v}`}
        >
          <span className="opacity-70">{c.label}</span>
          {c.v}
        </span>
      ))}
    </div>
  );
}

/** Heatmap cell — blue intensity scales with count relative to table max. */
function HeatmapCell({ count, max }: { count: number; max: number }) {
  const intensity = max > 0 ? 0.1 + (count / max) * 0.5 : 0;
  return (
    <TableCell
      className="text-center tabular-nums"
      style={{
        backgroundColor:
          count > 0 ? `rgba(59, 130, 246, ${intensity.toFixed(3)})` : undefined,
      }}
    >
      {count > 0 ? (
        <span className="font-medium text-foreground">{count}</span>
      ) : (
        <span className="text-muted-foreground/30">·</span>
      )}
    </TableCell>
  );
}

function SentimentLegend() {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
      {SENTIMENT_LEGEND.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1">
          <span
            className="h-2 w-2 rounded-sm"
            style={{ backgroundColor: sentimentColor(s.key) }}
          />
          {s.label}
        </span>
      ))}
    </div>
  );
}

function PriorityLegend() {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
      {PRIORITY_LEGEND.map((p) => (
        <span key={p.label} className="inline-flex items-center gap-1">
          <span className={cn("h-2 w-2 rounded-sm", p.cls)} />
          {p.label}
        </span>
      ))}
    </div>
  );
}

function HeatmapLegend() {
  return (
    <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
      <span>Fewer</span>
      <div
        className="h-2 w-20 rounded-full"
        style={{
          background:
            "linear-gradient(to right, rgba(59,130,246,0.1), rgba(59,130,246,0.6))",
        }}
      />
      <span>More</span>
    </div>
  );
}

const thBase =
  "h-9 px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground";
const ROW_BORDER = "border-border/40 hover:bg-secondary/20";

/* ============================================================
   View
   ============================================================ */

export function SegmentsView() {
  const [data, setData] = useState<Segments | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await api.segments();
        if (alive) setData(d);
      } catch (e) {
        if (alive)
          setError(e instanceof Error ? e.message : "Failed to load segments");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="Segments"
          description="Slice the review corpus six ways to find where discovery pain points concentrate. Cross-segments reveal which themes show up in 1-star vs 5-star reviews and across platforms."
        />
        <LoadingBlock label="Loading segments…" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="Segments"
          description="Slice the review corpus six ways to find where discovery pain points concentrate. Cross-segments reveal which themes show up in 1-star vs 5-star reviews and across platforms."
        />
        <EmptyState
          icon={<Grid3x3 className="h-8 w-8" />}
          title="No segment data yet"
          description={
            error
              ? `Failed to load: ${error}`
              : "Seed the database to populate the six segmentation dimensions."
          }
        />
      </div>
    );
  }

  /* ----- Derived values ----- */
  const byRatingRows = data.byRating;
  const bySourceRows = [...data.bySource].sort((a, b) => b.count - a.count);
  const bySentimentRows = data.bySentiment;
  const byThemeRows = [...data.byTheme]
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  const ratingCols: { key: "1-2" | "3" | "4-5"; label: string }[] = [
    { key: "1-2", label: "Low (1-2★)" },
    { key: "3", label: "Mid (3★)" },
    { key: "4-5", label: "High (4-5★)" },
  ];
  const themeByRatingRows = data.themeByRating.slice(0, 10);
  const tbrMax = Math.max(
    1,
    ...themeByRatingRows.flatMap((r) =>
      ratingCols.map((c) => (r[c.key] as number) || 0),
    ),
  );

  const themeBySourceRows = data.themeBySource.slice(0, 10);
  const SOURCE_ORDER = ["google_play", "app_store", "reddit", "twitter"];
  const sourceCols = SOURCE_ORDER.filter((s) =>
    themeBySourceRows.some(
      (r) => Number((r as Record<string, unknown>)[s]) > 0,
    ),
  );
  const tbsMax = Math.max(
    1,
    ...themeBySourceRows.flatMap((r) =>
      sourceCols.map((s) => Number((r as Record<string, unknown>)[s]) || 0),
    ),
  );

  const isEmpty = data.total === 0;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Segments"
        description="Slice the review corpus six ways to find where discovery pain points concentrate. Cross-segments reveal which themes show up in 1-star vs 5-star reviews and across platforms."
        action={
          <Badge
            variant="outline"
            className="gap-1.5 border-border/60 bg-card px-2.5 py-1 text-xs"
          >
            <Layers className="h-3.5 w-3.5 text-primary" />
            {data.total} reviews · 6 dimensions
          </Badge>
        }
      />

      {isEmpty ? (
        <EmptyState
          icon={<Grid3x3 className="h-8 w-8" />}
          title="No processed reviews"
          description="Run analysis on collected reviews to populate the segmentation tables."
        />
      ) : (
        <>
          {/* ---------- Primary segment tables ---------- */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* a. By Rating Bracket */}
            <ChartCard
              title="By Rating Bracket"
              subtitle="Low ratings carry most bugs — check if 1-2★ reviews drive the negative mix."
            >
              <Table>
                <TableHeader>
                  <TableRow className="border-border/60 hover:bg-transparent">
                    <TableHead className={thBase}>Bracket</TableHead>
                    <TableHead className={cn(thBase, "text-right")}>
                      Count
                    </TableHead>
                    <TableHead className={cn(thBase, "min-w-[150px]")}>
                      Sentiment mix
                    </TableHead>
                    <TableHead className={cn(thBase, "text-right")}>
                      <span className="inline-flex items-center gap-1">
                        <Bug className="h-3 w-3" /> Bugs
                      </span>
                    </TableHead>
                    <TableHead className={cn(thBase, "text-right")}>
                      <span className="inline-flex items-center gap-1">
                        <Lightbulb className="h-3 w-3" /> Feat.
                      </span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byRatingRows.map((r) => (
                    <TableRow key={r.label} className={ROW_BORDER}>
                      <TableCell className="font-medium text-foreground">
                        {r.label}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {r.count}
                      </TableCell>
                      <TableCell>
                        <SentimentStackBar
                          positive={r.positive}
                          negative={r.negative}
                          neutral={r.neutral}
                          mixed={r.mixed}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        {r.bugs > 0 ? (
                          <span className="rp-bg-negative inline-flex min-w-[1.75rem] justify-center rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums">
                            {r.bugs}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">·</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.features > 0 ? (
                          <span className="rp-bg-medium inline-flex min-w-[1.75rem] justify-center rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums">
                            {r.features}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">·</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <SentimentLegend />
            </ChartCard>

            {/* b. By Source Platform */}
            <ChartCard
              title="By Source Platform"
              subtitle="Compare volume and sentiment across platforms — Reddit and Twitter skew harsher."
            >
              <Table>
                <TableHeader>
                  <TableRow className="border-border/60 hover:bg-transparent">
                    <TableHead className={thBase}>Source</TableHead>
                    <TableHead className={cn(thBase, "text-right")}>
                      Reviews
                    </TableHead>
                    <TableHead className={cn(thBase, "text-right")}>
                      Avg
                    </TableHead>
                    <TableHead className={cn(thBase, "min-w-[150px]")}>
                      Sentiment mix
                    </TableHead>
                    <TableHead className={cn(thBase, "text-right")}>
                      Neg %
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bySourceRows.map((r) => {
                    const negPct =
                      r.count > 0
                        ? Math.round((r.negative / r.count) * 100)
                        : 0;
                    return (
                      <TableRow key={r.source} className={ROW_BORDER}>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                            <SourceIcon source={r.source} />
                            {SOURCE_LABELS[r.source] ?? r.source}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {r.count}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="inline-flex items-center justify-end gap-1 tabular-nums text-foreground">
                            {r.avgRating.toFixed(1)}
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          </span>
                        </TableCell>
                        <TableCell>
                          <SentimentStackBar
                            positive={r.positive}
                            negative={r.negative}
                            neutral={r.neutral}
                            mixed={r.mixed}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={cn(
                              "font-semibold tabular-nums",
                              negPct >= 50
                                ? "text-red-400"
                                : negPct >= 25
                                  ? "text-amber-400"
                                  : "text-muted-foreground",
                            )}
                          >
                            {negPct}%
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <SentimentLegend />
            </ChartCard>

            {/* c. By Sentiment */}
            <ChartCard
              title="By Sentiment"
              subtitle="Negative reviews hold the critical bugs; mixed reviews often hide feature requests."
            >
              <Table>
                <TableHeader>
                  <TableRow className="border-border/60 hover:bg-transparent">
                    <TableHead className={thBase}>Sentiment</TableHead>
                    <TableHead className={cn(thBase, "text-right")}>
                      Count
                    </TableHead>
                    <TableHead className={cn(thBase, "text-right")}>
                      Bugs
                    </TableHead>
                    <TableHead className={cn(thBase, "text-right")}>
                      Feat.
                    </TableHead>
                    <TableHead className={thBase}>Priority breakdown</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bySentimentRows.map((r) => (
                    <TableRow key={r.sentiment} className={ROW_BORDER}>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize",
                            sentimentBgClass(r.sentiment),
                          )}
                        >
                          {r.sentiment}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {r.count}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.bugs > 0 ? (
                          <span className="rp-bg-negative inline-flex min-w-[1.5rem] justify-center rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums">
                            {r.bugs}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">·</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.features > 0 ? (
                          <span className="rp-bg-medium inline-flex min-w-[1.5rem] justify-center rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums">
                            {r.features}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">·</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <PriorityChips
                          critical={r.critical}
                          high={r.high}
                          medium={r.medium}
                          low={r.low}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PriorityLegend />
            </ChartCard>

            {/* d. By Theme */}
            <ChartCard
              title="By Theme"
              subtitle="Top 12 themes by volume — watch negative % and critical priority counts."
            >
              <Table>
                <TableHeader>
                  <TableRow className="border-border/60 hover:bg-transparent">
                    <TableHead className={thBase}>Theme</TableHead>
                    <TableHead className={cn(thBase, "text-right")}>
                      Count
                    </TableHead>
                    <TableHead className={cn(thBase, "text-right")}>
                      Neg %
                    </TableHead>
                    <TableHead className={thBase}>Priority breakdown</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byThemeRows.map((r) => {
                    const negPct =
                      r.count > 0
                        ? Math.round((r.negative / r.count) * 100)
                        : 0;
                    return (
                      <TableRow key={r.theme} className={ROW_BORDER}>
                        <TableCell className="font-medium text-foreground">
                          {themeLabel(r.theme)}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {r.count}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={cn(
                              "font-semibold tabular-nums",
                              negPct >= 50
                                ? "text-red-400"
                                : negPct >= 25
                                  ? "text-amber-400"
                                  : "text-muted-foreground",
                            )}
                          >
                            {negPct}%
                          </span>
                        </TableCell>
                        <TableCell>
                          <PriorityChips
                            critical={r.critical}
                            high={r.high}
                            medium={r.medium}
                            low={r.low}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <PriorityLegend />
            </ChartCard>
          </div>

          {/* ---------- Cross-segment heatmaps ---------- */}
          <div className="flex items-center gap-2 pt-2">
            <Layers className="h-4 w-4 text-primary" />
            <h2 className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Cross-segment heatmaps
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* e. Theme × Rating */}
            <ChartCard
              title="Theme × Rating"
              subtitle="Which themes cluster in negative vs positive reviews."
            >
              <Table>
                <TableHeader>
                  <TableRow className="border-border/60 hover:bg-transparent">
                    <TableHead className={thBase}>Theme</TableHead>
                    {ratingCols.map((c) => (
                      <TableHead
                        key={c.key}
                        className={cn(thBase, "text-center")}
                      >
                        {c.label}
                      </TableHead>
                    ))}
                    <TableHead className={cn(thBase, "text-center")}>
                      Total
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {themeByRatingRows.map((r) => {
                    const total = ratingCols.reduce(
                      (sum, c) => sum + ((r[c.key] as number) || 0),
                      0,
                    );
                    return (
                      <TableRow key={r.theme} className={ROW_BORDER}>
                        <TableCell className="font-medium text-foreground">
                          {themeLabel(r.theme)}
                        </TableCell>
                        {ratingCols.map((c) => (
                          <HeatmapCell
                            key={c.key}
                            count={(r[c.key] as number) || 0}
                            max={tbrMax}
                          />
                        ))}
                        <TableCell className="text-center font-semibold tabular-nums text-foreground">
                          {total}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <HeatmapLegend />
            </ChartCard>

            {/* f. Theme × Source */}
            <ChartCard
              title="Theme × Source"
              subtitle="Do different platforms surface different complaints?"
            >
              <Table>
                <TableHeader>
                  <TableRow className="border-border/60 hover:bg-transparent">
                    <TableHead className={thBase}>Theme</TableHead>
                    {sourceCols.map((s) => (
                      <TableHead
                        key={s}
                        className={cn(thBase, "text-center")}
                      >
                        <span className="inline-flex items-center gap-1">
                          <SourceIcon source={s} />
                          {SOURCE_LABELS[s] ?? s}
                        </span>
                      </TableHead>
                    ))}
                    <TableHead className={cn(thBase, "text-center")}>
                      Total
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {themeBySourceRows.map((r) => {
                    const total = sourceCols.reduce(
                      (sum, s) =>
                        sum + (Number((r as Record<string, unknown>)[s]) || 0),
                      0,
                    );
                    return (
                      <TableRow key={r.theme} className={ROW_BORDER}>
                        <TableCell className="font-medium text-foreground">
                          {themeLabel(r.theme)}
                        </TableCell>
                        {sourceCols.map((s) => (
                          <HeatmapCell
                            key={s}
                            count={
                              Number(
                                (r as Record<string, unknown>)[s],
                              ) || 0
                            }
                            max={tbsMax}
                          />
                        ))}
                        <TableCell className="text-center font-semibold tabular-nums text-foreground">
                          {total}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <HeatmapLegend />
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}
