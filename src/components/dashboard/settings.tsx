"use client";

import { useEffect, useState } from "react";
import { SectionHeader, ChartCard } from "@/components/dashboard/shared";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useApp } from "@/store/app";
import { api } from "@/lib/api";

export function SettingsView() {
  const { activeProjectId, user, projects } = useApp();
  const activeProject = projects.find((p) => p.id === activeProjectId) ?? projects[0];

  const [embedInfo, setEmbedInfo] = useState<{ coverage: number; model: string; neural: boolean; withEmbedding: number; processed: number } | null>(null);

  useEffect(() => {
    if (!activeProjectId) return;
    api.embedStatus(activeProjectId).then((res) => {
      setEmbedInfo({ coverage: res.coverage, model: res.model, neural: res.neural, withEmbedding: res.withEmbedding, processed: res.processed });
    }).catch(() => {});
  }, [activeProjectId]);

  return (
    <div className="space-y-6">
      <SectionHeader title="Settings" description="View project configuration and AI analysis properties." />

      <div className="space-y-4">
        <ChartCard title="Project details" subtitle="Overview of the active workspace (Read-only)">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="project-name-input">Project name</Label>
              <Input
                id="project-name-input"
                value={activeProject?.name ?? "Blinkit Review Discovery Enginer"}
                disabled
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project-owner-input">Owner</Label>
              <Input id="project-owner-input" defaultValue={user?.email ?? "pm@reviewpulse.dev"} disabled />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="project-desc-input">Description</Label>
              <Input
                id="project-desc-input"
                value={activeProject?.description ?? "AI-powered product discovery case study for Blinkit."}
                disabled
              />
            </div>
          </div>
        </ChartCard>

        <ChartCard title="AI processing" subtitle="How reviews are analyzed">
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>LLM model</span>
              <code className="rounded bg-secondary/60 px-2 py-0.5 text-xs text-foreground">Hugging Face (Qwen/Qwen2.5-Coder-32B-Instruct)</code>
            </div>
            <div className="flex items-center justify-between">
              <span>Analysis batch size</span>
              <span className="text-foreground">8 reviews / request</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Embedding model</span>
              <code className="rounded bg-secondary/60 px-2 py-0.5 text-xs text-foreground">{embedInfo?.model ?? "all-MiniLM-L6-v2"}</code>
              {embedInfo?.neural && <span className="rp-bg-positive rounded px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">NEURAL</span>}
            </div>
            <div className="flex items-center justify-between">
              <span>Vector dimensions</span>
              <span className="text-foreground">384</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Embedding coverage</span>
              <span className="text-foreground">{embedInfo ? `${embedInfo.withEmbedding}/${embedInfo.processed} (${embedInfo.coverage}%)` : "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Storage</span>
              <span className="text-foreground">pgvector (PostgreSQL)</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Fallback on LLM error</span>
              <span className="text-foreground">Heuristic rule-based analyzer</span>
            </div>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
