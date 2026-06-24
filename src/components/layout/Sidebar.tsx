"use client";

import { useApp, type ViewKey } from "@/store/app";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  MessageSquare,
  Database,
  Users,
  Lightbulb,
  Bot,
  FileBarChart,
  Users2,
  Settings,
  Activity,
  ChevronLeft,
  Upload,
} from "lucide-react";

interface NavItem {
  key: ViewKey;
  label: string;
  icon: typeof LayoutDashboard;
  group: "main" | "tools";
}

const NAV: NavItem[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard, group: "main" },
  { key: "reviews", label: "Reviews", icon: MessageSquare, group: "main" },
  { key: "sources", label: "Sources", icon: Database, group: "main" },
  { key: "segments", label: "Segments", icon: Users, group: "main" },
  { key: "insights", label: "Insights", icon: Lightbulb, group: "main" },
  { key: "chat", label: "AI Chat", icon: Bot, group: "tools" },
  { key: "reports", label: "Reports", icon: FileBarChart, group: "tools" },
  { key: "team", label: "Team", icon: Users2, group: "tools" },
  { key: "settings", label: "Settings", icon: Settings, group: "tools" },
];

export function Sidebar() {
  const { view, setView, sidebarCollapsed, toggleSidebar, projects, activeProjectId } = useApp();
  const collapsed = sidebarCollapsed;

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? projects[0];
  const projectName = activeProject?.name ?? "Project";

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-border/60 bg-sidebar transition-[width] duration-200",
        collapsed ? "w-[68px]" : "w-[244px]",
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 border-b border-border/60 px-4">
        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-emerald-500">
          <Activity className="h-4 w-4 text-white" />
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
        </div>
        {!collapsed && (
          <div className="flex flex-col leading-none">
            <span className="font-heading text-sm font-semibold text-sidebar-foreground">ReviewPulse</span>
            <span className="text-[10px] text-muted-foreground">AI Review Discovery</span>
          </div>
        )}
      </div>

      {/* Project selector */}
      {!collapsed && (
        <div className="border-b border-border/60 px-3 py-3">
          <div className="rounded-lg border border-border/60 bg-secondary/40 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Active project</p>
            <p className="mt-0.5 truncate text-xs font-medium text-foreground">{projectName}</p>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="rp-scroll flex-1 overflow-y-auto px-2 py-3">
        {(["main", "tools"] as const).map((group) => (
          <div key={group} className="mb-4">
            {!collapsed && (
              <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {group === "main" ? "Analyze" : "Workspace"}
              </p>
            )}
            <ul className="space-y-0.5">
              {NAV.filter((n) => n.group === group).map((item) => {
                const Icon = item.icon;
                const active = view === item.key;
                return (
                  <li key={item.key}>
                    <button
                      onClick={() => setView(item.key)}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "group relative flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-primary"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                        collapsed && "justify-center px-2",
                      )}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-sidebar-primary" />
                      )}
                      <Icon className={cn("h-4 w-4 shrink-0", active && "text-sidebar-primary")} />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Upload button + collapse toggle */}
      <div className="border-t border-border/60 p-3">
        <button
          onClick={() => setView("sources")}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90",
            collapsed && "px-2",
          )}
        >
          <Upload className="h-3.5 w-3.5" />
          {!collapsed && "Upload Reviews"}
        </button>
        <button
          onClick={toggleSidebar}
          className="mt-2 flex w-full items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
        >
          <ChevronLeft className={cn("h-3.5 w-3.5 transition-transform", collapsed && "rotate-180")} />
          {!collapsed && "Collapse"}
        </button>
      </div>
    </aside>
  );
}
