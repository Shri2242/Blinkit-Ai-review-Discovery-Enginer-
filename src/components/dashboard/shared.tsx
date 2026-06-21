"use client";

import { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Bug, Lightbulb, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { SOURCE_LABELS } from "@/lib/api";
import type { Sentiment, Priority } from "@/lib/types";

/* ---------------- Source icon ---------------- */
export function SourceIcon({ source, className }: { source: string; className?: string }) {
  // Inline SVG marks for each source.
  const common = cn("h-3.5 w-3.5", className);
  switch (source) {
    case "google_play":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="currentColor" aria-hidden>
          <path d="M3.6 2.4 13.2 12 3.6 21.6c-.4-.2-.6-.6-.6-1.1V3.5c0-.5.2-.9.6-1.1Zm10.5 10.1 2.6 2.6-9.2 5.3 6.6-7.9Zm0-1L7.5 3.6l9.2 5.3-2.6 2.6Zm.9.5 3-3 4.1 2.4c.7.4.7 1.4 0 1.8l-4.1 2.4-3-3Z" />
        </svg>
      );
    case "app_store":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="currentColor" aria-hidden>
          <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-4.2 14.5H6.3l3.6-6.3 1.4 2.4-3.5 5.9Zm8.6 0H8.7l1.2-2.1h5.5l1 2.1Zm.3 0-3.5-5.9 1.4-2.4 3.6 6.3-1.5 2Zm-4.5-7.7 1.2-2.1c.2-.4.7-.5 1.1-.3.4.2.5.7.3 1.1l-.3.5-1.4 2.4-.9-1.6Z" />
        </svg>
      );
    case "reddit":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="currentColor" aria-hidden>
          <path d="M22 12a2 2 0 0 0-3.4-1.4c-1.3-.9-3.1-1.5-5-1.6l.9-4 2.8.6a1.4 1.4 0 1 0 .2-1l-3.2-.7c-.2 0-.4.1-.5.3l-1 4.5c-1.9.1-3.7.6-5 1.6A2 2 0 0 0 4 12c0 .8.5 1.4 1.1 1.8 0 .2 0 .4.1.6 0 2.6 3 4.7 6.8 4.7s6.8-2.1 6.8-4.7c0-.2 0-.4.1-.6.6-.4 1.1-1 1.1-1.8ZM8.5 13a1 1 0 1 1 2 0 1 1 0 0 1-2 0Zm5.8 3.1c-.7.7-2.1.7-2.3.7s-1.6 0-2.3-.7a.3.3 0 0 1 .4-.4c.4.4 1.3.5 1.9.5s1.5-.1 1.9-.5a.3.3 0 0 1 .4.4ZM13.5 13a1 1 0 1 1 2 0 1 1 0 0 1-2 0Z" />
        </svg>
      );
    case "twitter":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="currentColor" aria-hidden>
          <path d="M18.2 3h3.3l-7.2 8.3L23 21h-6.6l-5.2-6.8L5.3 21H2l7.7-8.8L1.5 3h6.8l4.7 6.2L18.2 3Zm-1.2 16h1.8L7.1 4.9H5.2L17 19Z" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className={common} fill="currentColor" aria-hidden>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm2 16H8v-2h8v2Zm0-4H8v-2h8v2Zm-3-5V3.5L18.5 9H13Z" />
        </svg>
      );
  }
}

export function SourceBadge({ source, className }: { source: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground",
        className,
      )}
    >
      <SourceIcon source={source} />
      {SOURCE_LABELS[source] ?? source}
    </span>
  );
}

/* ---------------- Sentiment badge ---------------- */
export function SentimentBadge({ sentiment, score }: { sentiment: Sentiment | null; score?: number | null }) {
  if (!sentiment) return <span className="text-xs text-muted-foreground">—</span>;
  const cls =
    sentiment === "positive" ? "rp-bg-positive"
    : sentiment === "negative" ? "rp-bg-negative"
    : sentiment === "mixed" ? "rp-bg-mixed"
    : "rp-bg-neutral";
  const label = sentiment[0].toUpperCase() + sentiment.slice(1);
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium capitalize", cls)}>
      {label}
      {typeof score === "number" && (
        <span className="opacity-60">{Math.round(score * 100)}%</span>
      )}
    </span>
  );
}

/* ---------------- Priority badge ---------------- */
export function PriorityBadge({ priority }: { priority: Priority | null }) {
  if (!priority) return null;
  const cls =
    priority === "critical" ? "rp-bg-critical"
    : priority === "high" ? "rp-bg-high"
    : priority === "medium" ? "rp-bg-medium"
    : "rp-bg-low";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide", cls)}>
      {priority}
    </span>
  );
}

/* ---------------- Rating stars ---------------- */
export function RatingStars({ rating, size = 12 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          style={{ width: size, height: size }}
          className={i <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}
        />
      ))}
    </span>
  );
}

/* ---------------- Theme badge ---------------- */
export function ThemeBadge({ theme }: { theme: string | null }) {
  if (!theme) return null;
  const label = theme.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <Badge variant="outline" className="border-border/70 bg-secondary/40 text-[10px] font-medium text-foreground/80">
      {label}
    </Badge>
  );
}

/* ---------------- Stat card ---------------- */
export function StatCard({
  label,
  value,
  icon,
  delta,
  deltaLabel,
  accent = "blue",
  spark,
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  delta?: number; // percentage change, can be negative
  deltaLabel?: string;
  accent?: "blue" | "green" | "red" | "amber";
  spark?: number[];
}) {
  const accentBg =
    accent === "green" ? "rp-bg-positive"
    : accent === "red" ? "rp-bg-negative"
    : accent === "amber" ? "rp-bg-mixed"
    : "rp-bg-medium";
  return (
    <Card className="rp-card-hover relative overflow-hidden border-border/60 bg-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-2 font-heading text-3xl font-semibold tracking-tight text-foreground">{value}</p>
        </div>
        <span className={cn("inline-flex h-9 w-9 items-center justify-center rounded-lg", accentBg)}>
          {icon}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between">
        {typeof delta === "number" ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs font-medium",
              delta > 0 ? "text-emerald-400" : delta < 0 ? "text-red-400" : "text-muted-foreground",
            )}
          >
            {delta > 0 ? <TrendingUp className="h-3 w-3" /> : delta < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            {delta > 0 ? "+" : ""}
            {delta}%
            {deltaLabel && <span className="text-muted-foreground">{deltaLabel}</span>}
          </span>
        ) : (
          <span />
        )}
        {spark && spark.length > 1 && <Sparkline data={spark} accent={accent} />}
      </div>
    </Card>
  );
}

/* ---------------- Sparkline ---------------- */
export function Sparkline({ data, accent = "blue", width = 72, height = 22 }: { data: number[]; accent?: "blue" | "green" | "red" | "amber"; width?: number; height?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const points = data.map((d, i) => `${i * step},${height - ((d - min) / range) * height}`).join(" ");
  const color =
    accent === "green" ? "var(--rp-positive)"
    : accent === "red" ? "var(--rp-negative)"
    : accent === "amber" ? "var(--rp-mixed)"
    : "var(--rp-medium)";
  return (
    <svg width={width} height={height} className="opacity-80" aria-hidden>
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------------- Chart card wrapper ---------------- */
export function ChartCard({
  title,
  subtitle,
  children,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("border-border/60 bg-card p-5", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-sm font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

/* ---------------- Section header ---------------- */
export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/* ---------------- Empty / loading state ---------------- */
export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
      <div className="flex items-center gap-2">
        <span className="rp-typing-dot" />
        <span className="rp-typing-dot" />
        <span className="rp-typing-dot" />
        <span className="ml-2">{label}</span>
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/60 bg-card/30 px-6 py-12 text-center">
      {icon && <div className="mb-3 text-muted-foreground">{icon}</div>}
      <p className="font-heading text-sm font-semibold text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ---------------- Bug / Feature inline markers ---------------- */
export function ReviewMarkers({ isBug, isFeature }: { isBug: boolean; isFeature: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      {isBug && (
        <span className="rp-bg-negative inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase">
          <Bug className="h-2.5 w-2.5" /> Bug
        </span>
      )}
      {isFeature && (
        <span className="rp-bg-medium inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase">
          <Lightbulb className="h-2.5 w-2.5" /> Request
        </span>
      )}
    </span>
  );
}
