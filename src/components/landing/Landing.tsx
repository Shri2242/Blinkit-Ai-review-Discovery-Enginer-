"use client";

import { useApp } from "@/store/app";
import { Button } from "@/components/ui/button";
import {
  Activity,
  ArrowRight,
  Bot,
  Database,
  FileBarChart,
  Lightbulb,
  MessageSquare,
  Search,
  Sparkles,
  Users,
  Zap,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";

const FEATURES = [
  {
    icon: Database,
    title: "Multi-source collection",
    desc: "Auto-ingest reviews from Google Play, App Store, Reddit, and Twitter. Or upload your own CSV/JSON.",
    accent: "rp-bg-medium",
  },
  {
    icon: Sparkles,
    title: "AI analysis at scale",
    desc: "Every review is tagged with sentiment, theme, priority, key phrases, and bug/feature flags — batched through an LLM.",
    accent: "rp-bg-positive",
  },
  {
    icon: Search,
    title: "Semantic RAG search",
    desc: "Ask natural-language questions and get answers grounded in real review excerpts with cited sources.",
    accent: "rp-bg-mixed",
  },
  {
    icon: Users,
    title: "6-dimension segmentation",
    desc: "Slice by rating bracket, source, sentiment, theme — and cross-segment theme × rating, theme × source.",
    accent: "rp-bg-high",
  },
  {
    icon: Lightbulb,
    title: "Auto-generated insights",
    desc: "Top issues, emerging week-over-week trends, and ranked feature requests — computed continuously.",
    accent: "rp-bg-negative",
  },
  {
    icon: FileBarChart,
    title: "Decision-ready reports",
    desc: "Weekly summaries that connect user pain points to the discovery metric your growth team owns.",
    accent: "rp-bg-medium",
  },
];

const STEPS = [
  {
    n: "01",
    icon: Database,
    title: "Collect",
    desc: "Connect automated collectors or drop a CSV. Reviews land in one normalized table with content-hash dedup.",
  },
  {
    n: "02",
    icon: Sparkles,
    title: "Analyze",
    desc: "The AI processor batches reviews through a structured prompt and writes sentiment, theme, priority, and key phrases back to each row.",
  },
  {
    n: "03",
    icon: TrendingUp,
    title: "Decide",
    desc: "Read insights, chat with your reviews, and ship the discovery fix your users have been asking for.",
  },
];

const STATS = [
  { value: "50+", label: "Reviews analyzed" },
  { value: "4", label: "Sources connected" },
  { value: "6", label: "Segment dimensions" },
  { value: "0", label: "Manual tagging hours" },
];

export function Landing() {
  const setView = useApp((s) => s.setView);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-emerald-500">
              <Activity className="h-4 w-4 text-white" />
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            </div>
            <span className="font-heading text-base font-semibold">ReviewPulse</span>
          </div>
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#how" className="hover:text-foreground">How it works</a>
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#pipeline" className="hover:text-foreground">Pipeline</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setView("overview")}>
              Sign in
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => setView("overview")}>
              Get Started <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="rp-hero-grid absolute inset-0" />
        <div className="rp-grid-lines absolute inset-0 opacity-40" />
        <div className="relative mx-auto max-w-7xl px-6 py-24 md:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3 w-3" />
              PM Fellowship · Graduation Project · June 2026
            </div>
            <h1 className="font-heading text-4xl font-bold leading-[1.1] tracking-tight md:text-6xl">
              Turn user reviews into <span className="rp-gradient-text">product decisions</span>.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground md:text-lg">
              ReviewPulse analyzes thousands of app-store, Reddit, and social-media reviews with AI — surfacing
              the discovery pain points your users actually have, with cited sources you can trust.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" className="gap-2" onClick={() => setView("overview")}>
                Explore the live demo <ArrowRight className="h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" className="gap-2 border-border/60" onClick={() => setView("chat")}>
                <Bot className="h-4 w-4" /> Try AI Chat
              </Button>
            </div>

            {/* Stats strip */}
            <div className="mx-auto mt-14 grid max-w-2xl grid-cols-2 gap-4 sm:grid-cols-4">
              {STATS.map((s) => (
                <div key={s.label} className="rounded-xl border border-border/60 bg-card/60 p-4">
                  <p className="font-heading text-2xl font-bold text-foreground">{s.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-t border-border/40 bg-card/20">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="mb-12 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">How it works</p>
            <h2 className="mt-2 font-heading text-3xl font-bold tracking-tight md:text-4xl">
              Collect → Analyze → Decide
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
              From raw review text to a shippable discovery fix in three automated steps.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.n} className="rp-card-hover relative overflow-hidden rounded-2xl border border-border/60 bg-card p-6">
                  <div className="absolute -right-4 -top-4 font-heading text-7xl font-bold text-foreground/5">{step.n}</div>
                  <div className="rp-bg-medium mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-heading text-lg font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{step.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-border/40">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="mb-12 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Capabilities</p>
            <h2 className="mt-2 font-heading text-3xl font-bold tracking-tight md:text-4xl">
              Everything a growth PM needs to ship discovery.
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Built end-to-end: ingestion, AI analysis, semantic search, segmentation, insights, and reporting.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="rp-card-hover rounded-2xl border border-border/60 bg-card p-6">
                  <div className={`${f.accent} mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-heading text-base font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pipeline strip */}
      <section id="pipeline" className="border-t border-border/40 bg-card/20">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="grid gap-10 md:grid-cols-2 md:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Daily pipeline</p>
              <h2 className="mt-2 font-heading text-3xl font-bold tracking-tight md:text-4xl">
                Runs on a schedule, even while you sleep.
              </h2>
              <p className="mt-3 text-sm text-muted-foreground">
                A GitHub Actions workflow runs every day at 10:00 AM IST: collect fresh reviews, run AI analysis
                on unprocessed rows, and regenerate embeddings so semantic search stays current.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  "Collectors for Google Play, App Store, Reddit, Twitter",
                  "Batched LLM analysis (15 reviews per call)",
                  "Local 384-dim embeddings (zero GPU cost)",
                  "Keyword + semantic RAG with cited sources",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2.5 text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-7">
                <Button className="gap-2" onClick={() => setView("overview")}>
                  Open the dashboard <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background p-5 font-mono text-xs leading-relaxed">
              <div className="mb-3 flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
                <span className="ml-2 text-muted-foreground">daily-pipeline.yml</span>
              </div>
              <pre className="rp-scroll overflow-x-auto text-muted-foreground">
{`name: daily-collection
on:
  schedule:
    - cron: "30 4 * * *"   # 10:00 AM IST
  workflow_dispatch:

jobs:
  pipeline:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @review-engine/database build
      - run: pnpm --filter @review-engine/ai build
      - run: node scripts/daily-pipeline.ts
        env:
          DATABASE_URL: \${{ secrets.DATABASE_URL }}
          DEEPSEEK_API_KEY: \${{ secrets.DEEPSEEK_API_KEY }}`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/40">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/15 via-card to-emerald-500/10 p-10 text-center md:p-16">
            <div className="rp-grid-lines absolute inset-0 opacity-30" />
            <div className="relative">
              <Zap className="mx-auto mb-4 h-8 w-8 text-primary" />
              <h2 className="font-heading text-3xl font-bold tracking-tight md:text-4xl">
                Stop reading reviews one at a time.
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground md:text-base">
                The demo is pre-loaded with 50 real-world-style Spotify discovery reviews. Click through the
                dashboard, ask the AI Chat a question, and watch it cite its sources.
              </p>
              <div className="mt-7 flex justify-center">
                <Button size="lg" className="gap-2" onClick={() => setView("overview")}>
                  Launch dashboard <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-background">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground md:flex-row">
          <div className="flex items-center gap-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-primary to-emerald-500">
              <Activity className="h-3 w-3 text-white" />
            </div>
            <span>ReviewPulse · PM Fellowship graduation project</span>
          </div>
          <div className="flex items-center gap-5">
            <span>Built with Next.js · Prisma · z-ai-web-dev-sdk</span>
            <MessageSquare className="h-4 w-4" />
          </div>
        </div>
      </footer>
    </div>
  );
}
