"use client";

import { useEffect, useState } from "react";
import { SectionHeader, ChartCard, LoadingBlock, EmptyState } from "@/components/dashboard/shared";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { Insights } from "@/lib/types";
import { FileBarChart, Download, FileText, Calendar } from "lucide-react";

interface Report {
  id: string;
  title: string;
  period: string;
  generatedAt: string;
  highlights: string[];
}

export function ReportsView() {
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<Report[]>([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await api.insights();
        if (alive) setInsights(data);
      } catch (e) {
        console.error(e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const generateWeekly = () => {
    if (!insights) return;
    setGenerating(true);
    const ws = insights.weeklySummary;
    const id = `rpt_${Date.now()}`;
    const report: Report = {
      id,
      title: `Weekly Discovery Report — ${ws.weekRange}`,
      period: ws.weekRange,
      generatedAt: new Date().toISOString(),
      highlights: [
        `${ws.totalReviews} reviews analyzed (${ws.totalThisWeek} this week vs ${ws.totalLastWeek} last week).`,
        `Top theme: ${ws.topTheme} — ${ws.negativeShare}% of reviews are negative.`,
        `${ws.bugCount} bugs reported. ${insights.featureRequests.length} distinct feature-request themes.`,
        `Emerging trends: ${insights.emergingTrends.slice(0, 3).map((t) => t.theme).join(", ") || "none detected"}.`,
      ],
    };
    setTimeout(() => {
      setReports((r) => [report, ...r]);
      setGenerating(false);
    }, 700);
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Reports"
        description="Generate weekly discovery reports summarizing the AI analysis, top issues, and emerging trends."
        action={
          <Button onClick={generateWeekly} disabled={generating || loading || !insights} className="gap-2">
            <FileText className="h-4 w-4" />
            {generating ? "Generating…" : "Generate Weekly Report"}
          </Button>
        }
      />

      {loading ? (
        <LoadingBlock label="Loading insights…" />
      ) : !insights ? (
        <EmptyState title="No data available" description="Seed the database to generate reports." />
      ) : (
        <>
          {/* Weekly summary tiles */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ChartCard title="Total Reviews" subtitle="All-time analyzed">
              <p className="font-heading text-3xl font-bold">{insights.weeklySummary.totalReviews}</p>
            </ChartCard>
            <ChartCard title="This Week" subtitle="Reviews in the last 7 days">
              <p className="font-heading text-3xl font-bold">{insights.weeklySummary.totalThisWeek}</p>
            </ChartCard>
            <ChartCard title="Negative Share" subtitle="Share of negative sentiment">
              <p className="font-heading text-3xl font-bold text-red-400">{insights.weeklySummary.negativeShare}%</p>
            </ChartCard>
            <ChartCard title="Open Bugs" subtitle="Reviews flagged as bugs">
              <p className="font-heading text-3xl font-bold text-amber-400">{insights.weeklySummary.bugCount}</p>
            </ChartCard>
          </div>

          {/* Generated reports list */}
          <ChartCard title="Generated reports" subtitle="Locally generated for this session">
            {reports.length === 0 ? (
              <EmptyState
                icon={<FileBarChart className="h-8 w-8" />}
                title="No reports yet"
                description="Click 'Generate Weekly Report' above to create a snapshot of this week's discovery insights."
              />
            ) : (
              <ul className="space-y-3">
                {reports.map((r) => (
                  <li key={r.id} className="rounded-lg border border-border/60 bg-secondary/30 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary" />
                          <p className="font-heading text-sm font-semibold text-foreground">{r.title}</p>
                        </div>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          Generated {new Date(r.generatedAt).toLocaleString()}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
                        <Download className="h-3.5 w-3.5" /> Export
                      </Button>
                    </div>
                    <ul className="mt-3 space-y-1.5">
                      {r.highlights.map((h, i) => (
                        <li key={i} className="text-xs text-muted-foreground">
                          • {h}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </ChartCard>
        </>
      )}
    </div>
  );
}
