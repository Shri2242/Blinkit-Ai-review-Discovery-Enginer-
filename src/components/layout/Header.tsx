"use client";

import { useApp, type ViewKey } from "@/store/app";
import { Bell, Search, Github, Sparkles, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const VIEW_TITLES: Record<ViewKey, { title: string; crumb: string }> = {
  landing: { title: "Home", crumb: "Home" },
  overview: { title: "Overview", crumb: "Dashboard / Overview" },
  reviews: { title: "Reviews", crumb: "Dashboard / Reviews" },
  sources: { title: "Sources", crumb: "Dashboard / Sources" },
  segments: { title: "Segments", crumb: "Dashboard / Segments" },
  insights: { title: "Insights", crumb: "Dashboard / Insights" },
  chat: { title: "AI Chat", crumb: "Dashboard / AI Chat" },
  reports: { title: "Reports", crumb: "Dashboard / Reports" },
  team: { title: "Team", crumb: "Dashboard / Team" },
  settings: { title: "Settings", crumb: "Dashboard / Settings" },
};

export function Header({ onOpenLanding }: { onOpenLanding: () => void }) {
  const { view } = useApp();
  const meta = VIEW_TITLES[view] ?? VIEW_TITLES.overview;

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border/60 bg-background/80 px-5 backdrop-blur">
      <div className="flex items-center gap-3">
        <div>
          <p className="text-[11px] text-muted-foreground">{meta.crumb}</p>
          <h2 className="font-heading text-base font-semibold text-foreground">{meta.title}</h2>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-2 rounded-md border border-border/60 bg-secondary/40 px-3 py-1.5 text-xs text-muted-foreground md:flex">
          <Search className="h-3.5 w-3.5" />
          <span>Search reviews…</span>
          <kbd className="ml-2 rounded border border-border/60 bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">⌘K</kbd>
        </div>

        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground" onClick={onOpenLanding}>
          <ExternalLink className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Landing</span>
        </Button>

        <a
          href="https://github.com"
          target="_blank"
          rel="noreferrer"
          className="hidden h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary/60 hover:text-foreground sm:flex"
          aria-label="GitHub"
        >
          <Github className="h-4 w-4" />
        </a>

        <button className="relative hidden h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary/60 hover:text-foreground sm:flex" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
        </button>

        <div className="flex items-center gap-2 rounded-md border border-border/60 bg-secondary/40 py-1 pl-1 pr-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-primary to-emerald-500 text-xs font-semibold text-white">
            PM
          </div>
          <div className="hidden leading-none sm:block">
            <p className="text-xs font-medium text-foreground">Product Manager</p>
            <p className="text-[10px] text-muted-foreground">Fellowship · 2026</p>
          </div>
        </div>
      </div>
    </header>
  );
}

export function HeaderBadge({ children }: { children: React.ReactNode }) {
  return (
    <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
      <Sparkles className="mr-1 h-3 w-3" />
      {children}
    </Badge>
  );
}
