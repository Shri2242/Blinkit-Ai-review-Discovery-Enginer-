"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Sparkles,
  Send,
  Bot,
  X,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Quote,
  Filter,
} from "lucide-react";

import {
  SectionHeader,
  LoadingBlock,
  EmptyState,
  SentimentBadge,
  PriorityBadge,
  SourceBadge,
  ThemeBadge,
  RatingStars,
  ReviewMarkers,
} from "@/components/dashboard/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { api, sentimentColor, SOURCE_LABELS, themeLabel } from "@/lib/api";
import type { Review, Sentiment, Priority, SourceType, ChatSource } from "@/lib/types";
import { useApp } from "@/store/app";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/* ---------------- Constants ---------------- */

const SENTIMENT_OPTIONS: Sentiment[] = ["positive", "negative", "neutral", "mixed"];
const SOURCE_OPTIONS: SourceType[] = ["google_play", "app_store", "reddit", "twitter", "csv_upload"];
const PRIORITY_OPTIONS: Priority[] = ["critical", "high", "medium", "low"];
const THEME_OPTIONS = [
  "music_discovery",
  "recommendation_quality",
  "playlist_fatigue",
  "playback_bug",
  "ui_ux",
  "search",
  "offline_mode",
  "pricing",
  "social_features",
  "audio_quality",
];

/* ---------------- Filters state ---------------- */

interface Filters {
  sentiment: string; // "all" or a sentiment
  source: string; // "all" or a source
  theme: string; // "all" or a theme
  priority: string; // "all" or a priority
  rating: string; // "all" or "1".."5"
  isBug: boolean;
  isFeatureRequest: boolean;
}

const DEFAULT_FILTERS: Filters = {
  sentiment: "all",
  source: "all",
  theme: "all",
  priority: "all",
  rating: "all",
  isBug: false,
  isFeatureRequest: false,
};

function countActiveFilters(f: Filters): number {
  let n = 0;
  if (f.sentiment !== "all") n++;
  if (f.source !== "all") n++;
  if (f.theme !== "all") n++;
  if (f.priority !== "all") n++;
  if (f.rating !== "all") n++;
  if (f.isBug) n++;
  if (f.isFeatureRequest) n++;
  return n;
}

function filtersToParams(f: Filters) {
  return {
    sentiment: f.sentiment === "all" ? undefined : f.sentiment,
    source: f.source === "all" ? undefined : f.source,
    theme: f.theme === "all" ? undefined : f.theme,
    priority: f.priority === "all" ? undefined : f.priority,
    rating: f.rating === "all" ? undefined : f.rating,
    isBug: f.isBug ? true : undefined,
    isFeatureRequest: f.isFeatureRequest ? true : undefined,
    limit: 100,
  };
}

/* ---------------- Helpers ---------------- */

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Math.max(0, Date.now() - then);
  const MIN = 60_000;
  const HOUR = 3_600_000;
  const DAY = 86_400_000;
  if (diff < MIN) return "just now";
  if (diff < HOUR) return `${Math.floor(diff / MIN)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  const days = Math.floor(diff / DAY);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

/* ---------------- Citation item (inside AI answer) ---------------- */

function CitationItem({ source, index }: { source: ChatSource; index: number }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-md border border-border/60 bg-card/40">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-start gap-2 px-3 py-2 text-left"
      >
        {expanded ? (
          <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground">#{index + 1}</span>
            <span className="text-xs font-medium text-foreground/90">{source.author}</span>
            <SourceBadge source={source.source} />
            <RatingStars rating={source.rating} />
            <Badge
              variant="outline"
              className="ml-auto border-primary/40 bg-primary/10 text-[10px] font-semibold text-primary"
            >
              {Math.round(source.score * 100)}% match
            </Badge>
          </div>
          <p
            className={cn(
              "mt-1.5 text-xs leading-relaxed text-muted-foreground",
              !expanded && "line-clamp-1",
            )}
          >
            {source.text}
          </p>
        </div>
      </button>
    </div>
  );
}

/* ---------------- AI Answer card ---------------- */

function AIAnswerCard({
  asking,
  question,
  answer,
  sources,
  reviewCount,
  onClear,
  onToggleCited,
  showCitedOnly,
  citingActive,
}: {
  asking: boolean;
  question: string;
  answer: string | null;
  sources: ChatSource[];
  reviewCount: number;
  onClear: () => void;
  onToggleCited: () => void;
  showCitedOnly: boolean;
  citingActive: boolean;
}) {
  return (
    <Card className="border-primary/30 bg-primary/5 p-5">
      {/* Header row */}
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Bot className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-heading text-sm font-semibold text-foreground">AI Synthesis</p>
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-[10px] font-medium text-primary">
              <Sparkles className="mr-1 h-2.5 w-2.5" />
              Semantic answer
            </Badge>
            {reviewCount > 0 && (
              <span className="text-[11px] text-muted-foreground">
                grounded in {reviewCount} analyzed reviews
              </span>
            )}
          </div>
          {/* Question echo */}
          <div className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
            <Quote className="mt-0.5 h-3 w-3 shrink-0 opacity-60" />
            <span className="italic">{question}</span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          onClick={onClear}
          aria-label="Clear AI answer"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Body: typing indicator or answer */}
      <div className="mt-4 pl-11">
        {asking ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="rp-typing-dot" />
            <span className="rp-typing-dot" />
            <span className="rp-typing-dot" />
            <span className="ml-1">Searching reviews…</span>
          </div>
        ) : answer ? (
          <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">{answer}</p>
        ) : null}

        {/* Citations */}
        {!asking && sources.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Cited reviews ({sources.length})
              </p>
              <Button
                variant={showCitedOnly ? "default" : "outline"}
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={onToggleCited}
                disabled={citingActive && !showCitedOnly ? false : false}
              >
                <Filter className="h-3 w-3" />
                {showCitedOnly ? "Showing cited only" : "Show only cited"}
              </Button>
            </div>
            <div className="space-y-1.5">
              {sources.map((s, i) => (
                <CitationItem key={`${s.reviewId}-${i}`} source={s} index={i} />
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

/* ---------------- Review card ---------------- */

function ReviewCard({ review, highlighted }: { review: Review; highlighted?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const sColor = sentimentColor(review.sentiment);
  const longText = (review.text?.length ?? 0) > 200;

  return (
    <Card
      onClick={() => setExpanded((e) => !e)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setExpanded((e) => !e);
        }
      }}
      className={cn(
        "rp-card-hover cursor-pointer border-border/60 bg-card p-4 transition-colors",
        highlighted && "ring-1 ring-primary/40",
      )}
      style={{ borderLeftColor: sColor, borderLeftWidth: 3 }}
    >
      {/* Top row: source · author · date · stars */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <SourceBadge source={review.source} />
        <span className="font-medium text-foreground/80">{review.author || "Anonymous"}</span>
        <span className="opacity-50">·</span>
        <span>{timeAgo(review.reviewDate)}</span>
        <span className="ml-auto">
          <RatingStars rating={review.rating} />
        </span>
      </div>

      {/* Title */}
      {review.title && (
        <h4 className="mt-2 font-heading text-sm font-semibold text-foreground">{review.title}</h4>
      )}

      {/* Text */}
      {review.text && (
        <p
          className={cn(
            "mt-1.5 text-sm leading-relaxed text-foreground/90",
            !expanded && "line-clamp-3",
          )}
        >
          {review.text}
        </p>
      )}
      {longText && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((e) => !e);
          }}
          className="mt-1 text-xs font-medium text-primary hover:underline"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}

      {/* AI analysis row */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/40 pt-3">
        <SentimentBadge sentiment={review.sentiment} score={review.sentimentScore} />
        <PriorityBadge priority={review.priority} />
        <ThemeBadge theme={review.theme} />
        <ReviewMarkers isBug={review.isBug} isFeature={review.isFeatureRequest} />
        {review.summary && (
          <p className="w-full text-xs italic leading-relaxed text-muted-foreground">
            “{review.summary}”
          </p>
        )}
      </div>

      {/* Key phrases */}
      {review.keyPhrases && review.keyPhrases.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {(expanded ? review.keyPhrases : review.keyPhrases.slice(0, 5)).map((p, i) => (
            <span
              key={`${p}-${i}`}
              className="rounded border border-border/60 bg-secondary/30 px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              {p}
            </span>
          ))}
          {!expanded && review.keyPhrases.length > 5 && (
            <span className="py-0.5 text-[10px] text-muted-foreground">
              +{review.keyPhrases.length - 5} more
            </span>
          )}
        </div>
      )}
    </Card>
  );
}

/* ---------------- Filters panel ---------------- */

function FiltersPanel({
  filters,
  onChange,
  onClear,
  activeCount,
}: {
  filters: Filters;
  onChange: (next: Filters) => void;
  onClear: () => void;
  activeCount: number;
}) {
  const update = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    onChange({ ...filters, [key]: value });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-heading text-sm font-semibold text-foreground">Filters</h3>
          {activeCount > 0 && (
            <Badge
              variant="outline"
              className="border-primary/40 bg-primary/10 text-[10px] font-semibold text-primary"
            >
              {activeCount} active
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={onClear}
          disabled={activeCount === 0}
        >
          Clear
        </Button>
      </div>

      <Separator />

      {/* Sentiment */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Sentiment
        </label>
        <Select value={filters.sentiment} onValueChange={(v) => update("sentiment", v)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All sentiments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sentiments</SelectItem>
            {SENTIMENT_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                <span className="capitalize">{s}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Source */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Source
        </label>
        <Select value={filters.source} onValueChange={(v) => update("source", v)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            {SOURCE_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {SOURCE_LABELS[s] ?? s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Theme */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Theme
        </label>
        <Select value={filters.theme} onValueChange={(v) => update("theme", v)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All themes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All themes</SelectItem>
            {THEME_OPTIONS.map((t) => (
              <SelectItem key={t} value={t}>
                {themeLabel(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Priority */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Priority
        </label>
        <Select value={filters.priority} onValueChange={(v) => update("priority", v)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All priorities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {PRIORITY_OPTIONS.map((p) => (
              <SelectItem key={p} value={p}>
                <span className="capitalize">{p}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Rating */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Rating
        </label>
        <Select value={filters.rating} onValueChange={(v) => update("rating", v)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All ratings" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ratings</SelectItem>
            {[5, 4, 3, 2, 1].map((r) => (
              <SelectItem key={r} value={String(r)}>
                {r} {r === 1 ? "star" : "stars"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Toggles */}
      <div className="space-y-2.5">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Flags
        </label>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground/90">
          <Checkbox
            checked={filters.isBug}
            onCheckedChange={(v) => update("isBug", v === true)}
          />
          Bugs only
        </label>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground/90">
          <Checkbox
            checked={filters.isFeatureRequest}
            onCheckedChange={(v) => update("isFeatureRequest", v === true)}
          />
          Feature requests only
        </label>
      </div>
    </div>
  );
}

/* ---------------- Main view ---------------- */

export function ReviewsView() {
  const { searchQuery, setSearchQuery } = useApp();
  const { toast } = useToast();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  // AI semantic search
  const [question, setQuestion] = useState(searchQuery || "");
  const [asking, setAsking] = useState(false);
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiSources, setAiSources] = useState<ChatSource[]>([]);
  const [aiQuestion, setAiQuestion] = useState<string>("");
  const [aiReviewCount, setAiReviewCount] = useState(0);
  const [citedIds, setCitedIds] = useState<Set<string>>(new Set());
  const [showCitedOnly, setShowCitedOnly] = useState(false);

  // Mobile filters dialog
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  /* Fetch reviews whenever filters change */
  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .reviews(filtersToParams(filters))
      .then((data) => {
        if (!alive) return;
        setReviews(data.reviews);
        setTotal(data.total);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        const msg = e instanceof Error ? e.message : String(e);
        toast({
          title: "Failed to load reviews",
          description: msg,
          variant: "destructive",
        });
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [filters]);

  const askAI = useCallback(
    async (q: string) => {
      const trimmed = q.trim();
      if (!trimmed) return;
      setAsking(true);
      setAiAnswer(null);
      setAiSources([]);
      setShowCitedOnly(false);
      try {
        const res = await api.chat(trimmed);
        setAiAnswer(res.answer);
        setAiSources(res.sources);
        setAiQuestion(trimmed);
        setAiReviewCount(res.reviewCount);
        setCitedIds(new Set(res.sources.map((s) => s.reviewId)));
        setSearchQuery(trimmed);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        toast({
          title: "AI search failed",
          description: msg,
          variant: "destructive",
        });
      } finally {
        setAsking(false);
      }
    },
    [toast, setSearchQuery],
  );

  /* If a global search query arrives from another view, run the ask once. */
  useEffect(() => {
    if (searchQuery && searchQuery !== aiQuestion && !asking) {
      setQuestion(searchQuery);
      void askAI(searchQuery);
    }
  }, [searchQuery]);

  const clearAI = useCallback(() => {
    setAiAnswer(null);
    setAiSources([]);
    setAiQuestion("");
    setQuestion("");
    setShowCitedOnly(false);
    setCitedIds(new Set());
    setSearchQuery("");
  }, [setSearchQuery]);

  const handleFilterChange = useCallback((next: Filters) => {
    setFilters(next);
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const visibleReviews = useMemo(() => {
    if (showCitedOnly && citedIds.size > 0) {
      return reviews.filter((r) => citedIds.has(r.id));
    }
    return reviews;
  }, [reviews, showCitedOnly, citedIds]);

  const activeCount = countActiveFilters(filters);
  const aiCardVisible = asking || aiAnswer !== null;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Reviews"
        description="Every review, AI-tagged with sentiment, theme, and priority. Ask a question to search semantically."
      />

      {/* Semantic search bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void askAI(question);
        }}
        className="flex items-center gap-2 rounded-xl border border-border/60 bg-card p-2 shadow-sm"
      >
        <span className="ml-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Sparkles className="h-4 w-4" />
        </span>
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask anything: “Why are users frustrated with discovery?”"
          className="h-10 flex-1 border-0 bg-transparent px-2 text-sm shadow-none focus-visible:ring-0"
          aria-label="Ask AI a question about your reviews"
        />
        {question && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground"
            onClick={() => setQuestion("")}
            aria-label="Clear question"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        <Button type="submit" disabled={asking || !question.trim()} className="gap-1.5">
          <Send className="h-4 w-4" />
          <span className="hidden sm:inline">Ask AI</span>
        </Button>
      </form>

      {/* AI answer card */}
      {aiCardVisible && (
        <AIAnswerCard
          asking={asking}
          question={aiQuestion || question}
          answer={aiAnswer}
          sources={aiSources}
          reviewCount={aiReviewCount}
          onClear={clearAI}
          onToggleCited={() => setShowCitedOnly((s) => !s)}
          showCitedOnly={showCitedOnly}
          citingActive={citedIds.size > 0}
        />
      )}

      {/* Main layout: filters sidebar + review list */}
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* Desktop filter sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-4 rounded-xl border border-border/60 bg-card p-4">
            <FiltersPanel
              filters={filters}
              onChange={handleFilterChange}
              onClear={handleClearFilters}
              activeCount={activeCount}
            />
          </div>
        </aside>

        {/* Review list column */}
        <div className="min-w-0 space-y-4">
          {/* Mobile filters trigger */}
          <div className="flex items-center justify-between lg:hidden">
            <Dialog open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <SlidersHorizontal className="h-4 w-4" />
                  Filters
                  {activeCount > 0 && (
                    <Badge
                      variant="outline"
                      className="ml-1 border-primary/40 bg-primary/10 text-[10px] font-semibold text-primary"
                    >
                      {activeCount}
                    </Badge>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>Filter reviews</DialogTitle>
                </DialogHeader>
                <div className="max-h-[70vh] overflow-y-auto rp-scroll pr-1">
                  <FiltersPanel
                    filters={filters}
                    onChange={(next) => {
                      handleFilterChange(next);
                    }}
                    onClear={handleClearFilters}
                    activeCount={activeCount}
                  />
                </div>
                <div className="mt-2 flex justify-end">
                  <Button size="sm" onClick={() => setMobileFiltersOpen(false)}>
                    Done
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <p className="text-xs text-muted-foreground">
              {showCitedOnly ? "Cited only" : "All reviews"}
            </p>
          </div>

          {/* Count bar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Showing{" "}
              <span className="font-semibold text-foreground">{visibleReviews.length}</span>
              {" "}of{" "}
              <span className="font-semibold text-foreground">{total}</span>
              {" "}reviews
              {activeCount > 0 && (
                <Button
                  variant="link"
                  size="sm"
                  className="ml-2 h-auto p-0 text-xs text-primary"
                  onClick={handleClearFilters}
                >
                  clear filters
                </Button>
              )}
            </p>
            {showCitedOnly && citedIds.size > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={() => setShowCitedOnly(false)}
              >
                <X className="h-3 w-3" />
                Exit cited-only view
              </Button>
            )}
          </div>

          {/* Loading / empty / list */}
          {loading ? (
            <LoadingBlock label="Loading reviews…" />
          ) : visibleReviews.length === 0 ? (
            <EmptyState
              icon={<MessageSquare className="h-8 w-8" />}
              title="No reviews match your filters"
              description={
                activeCount > 0
                  ? "Try widening your filters or clearing them to see all reviews."
                  : "Seed the database to load reviews for analysis."
              }
              action={
                activeCount > 0 ? (
                  <Button variant="outline" size="sm" onClick={handleClearFilters}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="space-y-3">
              {visibleReviews.map((r) => (
                <ReviewCard
                  key={r.id}
                  review={r}
                  highlighted={showCitedOnly && citedIds.has(r.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
