"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SourceBadge, RatingStars } from "@/components/dashboard/shared";
import { api } from "@/lib/api";
import type { ChatSource } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Bot,
  User,
  Send,
  Sparkles,
  Quote,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Lightbulb,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";

/* ---------------- Types ---------------- */

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  loading?: boolean;
  error?: boolean;
}

/* ---------------- Suggested prompts ---------------- */

const SUGGESTED_PROMPTS: { icon: typeof Lightbulb; label: string; prompt: string }[] = [
  { icon: Lightbulb, label: "Discovery struggles", prompt: "Why do users struggle to discover new music?" },
  { icon: AlertTriangle, label: "Recommendation frustrations", prompt: "What are the most common frustrations with recommendations?" },
  { icon: TrendingUp, label: "Listening behaviors", prompt: "Which listening behaviors are users trying to achieve?" },
  { icon: MessageSquare, label: "Repeat listening", prompt: "What causes users to repeatedly listen to the same content?" },
  { icon: Sparkles, label: "Unmet needs", prompt: "What unmet needs emerge consistently across reviews?" },
  { icon: Quote, label: "Source comparison", prompt: "Compare complaints from App Store vs Reddit users." },
];

/* ---------------- Inline citation chip ---------------- */

function CitationChip({ n, onClick }: { n: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Jump to source ${n}`}
      className="rp-bg-medium mx-0.5 inline-flex h-[18px] min-w-[18px] -translate-y-px items-center justify-center rounded px-1 align-middle text-[10px] font-semibold transition hover:brightness-125"
    >
      {n}
    </button>
  );
}

/**
 * Render an assistant answer, promoting inline `[n]` markers into clickable
 * citation chips when a handler is supplied (i.e. when the message has sources).
 */
function renderAnswer(text: string, onCitation?: (n: number) => void): ReactNode[] {
  const parts = text.split(/(\[\d+\])/g);
  return parts.map((part, i) => {
    const m = part.match(/^\[(\d+)\]$/);
    if (m) {
      const n = Number(m[1]);
      if (onCitation) {
        return <CitationChip key={i} n={n} onClick={() => onCitation(n)} />;
      }
      return (
        <span
          key={i}
          className="rp-bg-medium mx-0.5 inline-flex h-[18px] min-w-[18px] -translate-y-px items-center justify-center rounded px-1 align-middle text-[10px] font-semibold"
        >
          {n}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

/* ---------------- Typing indicator ---------------- */

function TypingIndicator() {
  return (
    <span className="inline-flex items-center gap-1.5 py-1.5" aria-label="Assistant is typing">
      <span className="rp-typing-dot" />
      <span className="rp-typing-dot" />
      <span className="rp-typing-dot" />
    </span>
  );
}

/* ---------------- Single citation row ---------------- */

function CitationRow({ source, index }: { source: ChatSource; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const scorePct = Math.round(source.score * 100);
  const isLong = source.text.length > 140;
  return (
    <li className="rounded-lg border border-border/60 bg-secondary/20 p-3 transition hover:border-border">
      <div className="flex items-start gap-2.5">
        <span className="rp-bg-medium mt-0.5 inline-flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded px-1 text-[11px] font-semibold">
          {index}
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn("text-xs leading-relaxed text-foreground/90", !expanded && "line-clamp-2")}>
            &ldquo;{source.text}&rdquo;
          </p>
          {isLong && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 text-[10px] font-medium text-primary hover:underline"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground/80">{source.author || "Anonymous"}</span>
            <SourceBadge source={source.source} />
            <RatingStars rating={source.rating} />
            <span className="rp-bg-positive rounded-md px-1.5 py-0.5 text-[10px] font-semibold">
              {scorePct}% match
            </span>
          </div>
        </div>
      </div>
    </li>
  );
}

/* ---------------- Assistant message bubble (owns sources-open state) ---------------- */

function AssistantMessage({ message }: { message: ChatMessage }) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const sourcesRef = useRef<HTMLDivElement | null>(null);
  const hasSources = !!message.sources && message.sources.length > 0;

  // Scroll to + briefly highlight the cited source row whenever highlightIndex changes.
  useEffect(() => {
    if (highlightIndex == null) return;
    const id = window.setTimeout(() => {
      const ol = sourcesRef.current?.querySelector("ol");
      const li = ol?.children[highlightIndex - 1] as HTMLElement | undefined;
      if (!li) return;
      li.scrollIntoView({ behavior: "smooth", block: "center" });
      li.classList.add("ring-2", "ring-primary/50");
      window.setTimeout(() => li.classList.remove("ring-2", "ring-primary/50"), 1200);
    }, 60);
    return () => window.clearTimeout(id);
  }, [highlightIndex]);

  const handleCitation = useCallback((n: number) => {
    setSourcesOpen(true);
    setHighlightIndex(n);
  }, []);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Bot className="h-4 w-4" />
        </div>
        <div
          className={cn(
            "max-w-[85%] rounded-xl border border-border/60 bg-card px-4 py-3 text-sm",
            message.error && "border-red-500/40 bg-red-500/10",
          )}
        >
          {message.loading ? (
            <TypingIndicator />
          ) : (
            <div className="whitespace-pre-wrap leading-relaxed text-foreground/90">
              {renderAnswer(message.content, hasSources ? handleCitation : undefined)}
            </div>
          )}
        </div>
      </div>

      {hasSources && !message.loading && (
        <div ref={sourcesRef} className="ml-11 max-w-[85%]">
          <button
            type="button"
            onClick={() => setSourcesOpen((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
          >
            {sourcesOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            <Quote className="h-3.5 w-3.5" />
            {sourcesOpen ? "Hide" : "Show"} {message.sources!.length} source
            {message.sources!.length === 1 ? "" : "s"}
          </button>
          {sourcesOpen && (
            <ol className="mt-2 space-y-2">
              {message.sources!.map((s, i) => (
                <CitationRow key={`${s.reviewId}-${i}`} source={s} index={i + 1} />
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------- Main view ---------------- */

export function ChatView() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [reviewCount, setReviewCount] = useState<number | null>(null);
  const { toast } = useToast();
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-scroll to the newest message.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  // Auto-grow the textarea up to ~120px.
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, [input]);

  const send = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || sending) return;

      const userMsg: ChatMessage = { id: `u_${Date.now()}`, role: "user", content: q };
      const aiId = `a_${Date.now()}`;
      const aiMsg: ChatMessage = { id: aiId, role: "assistant", content: "", loading: true };
      setMessages((prev) => [...prev, userMsg, aiMsg]);
      setInput("");
      setSending(true);

      try {
        const res = await api.chat(q);
        setReviewCount(res.reviewCount);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiId
              ? { ...m, content: res.answer, sources: res.sources, loading: false }
              : m,
          ),
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        toast({
          title: "Chat request failed",
          description: msg,
          variant: "destructive",
        });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiId
              ? {
                  ...m,
                  content: `Sorry — I couldn't process that request.\n\n${msg}`,
                  loading: false,
                  error: true,
                }
              : m,
          ),
        );
      } finally {
        setSending(false);
      }
    },
    [sending, toast],
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <div className="flex h-[calc(100vh-180px)] min-h-[480px] flex-col">
      {/* Compact header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground">AI Chat</h1>
            <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
              Ask questions about your reviews. Answers are grounded in real review excerpts with cited sources.
            </p>
          </div>
        </div>
        <Badge variant="outline" className="gap-1.5 border-border/60 bg-card">
          <Sparkles className="h-3 w-3 text-primary" />
          {reviewCount !== null ? `${reviewCount} reviews indexed` : "Ready"}
        </Badge>
      </div>

      {/* Messages (scrollable) */}
      <div className="rp-scroll mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <div className="flex min-h-full flex-col items-center justify-center py-6 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Sparkles className="h-7 w-7" />
            </div>
            <h2 className="font-heading text-lg font-semibold text-foreground">
              Ask anything about your reviews
            </h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Pick a starting point below or type your own question. Every answer cites the reviews it&apos;s based on.
            </p>
            <div className="mt-6 grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {SUGGESTED_PROMPTS.map((p) => {
                const Icon = p.icon;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => send(p.prompt)}
                    disabled={sending}
                    className="rp-card-hover group flex flex-col items-start gap-2 rounded-xl border border-border/60 bg-card p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="rp-bg-medium inline-flex h-7 w-7 items-center justify-center rounded-md">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {p.label}
                    </span>
                    <span className="text-sm text-foreground/90 group-hover:text-foreground">
                      {p.prompt}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <>
            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="flex justify-end gap-3">
                  <div className="max-w-[85%] rounded-xl border border-primary/30 bg-primary/15 px-4 py-3 text-sm text-primary">
                    <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
                  </div>
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                    <User className="h-4 w-4" />
                  </div>
                </div>
              ) : (
                <AssistantMessage key={m.id} message={m} />
              ),
            )}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Sticky input bar */}
      <div className="mt-4 border-t border-border/60 pt-4">
        <div className="flex items-end gap-2 rounded-xl border border-border/60 bg-card p-2 transition focus-within:border-primary/50">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Ask about your reviews…  (Enter to send, Shift+Enter for newline)"
            aria-label="Chat message"
            className="rp-scroll max-h-[120px] min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <Button
            type="button"
            size="sm"
            onClick={() => send(input)}
            disabled={sending || !input.trim()}
            className="gap-1.5"
          >
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">{sending ? "Sending…" : "Send"}</span>
          </Button>
        </div>
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          Answers cite real review excerpts. Always verify against the source reviews for product decisions.
        </p>
      </div>
    </div>
  );
}
