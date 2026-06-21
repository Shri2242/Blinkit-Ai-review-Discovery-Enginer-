"use client";

import { useState, useRef, useEffect } from "react";
import { useApp, type ViewKey } from "@/store/app";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Bell, Search, Github, ExternalLink, LogOut, ChevronDown, Check, User as UserIcon, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const VIEW_TITLES: Record<ViewKey, { title: string; crumb: string }> = {
  landing: { title: "Home", crumb: "Home" },
  login: { title: "Sign in", crumb: "Auth / Sign in" },
  register: { title: "Sign up", crumb: "Auth / Sign up" },
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
  const { view, user, projects, activeProjectId, setActiveProject, clearAuth, setView, setAuth } = useApp();
  const { toast } = useToast();
  const meta = VIEW_TITLES[view] ?? VIEW_TITLES.overview;
  const [menuOpen, setMenuOpen] = useState(false);
  const [projOpen, setProjOpen] = useState(false);
  const [newProjOpen, setNewProjOpen] = useState(false);
  const [projName, setProjName] = useState("");
  const [projDesc, setProjDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const projRef = useRef<HTMLDivElement>(null);

  const createProject = async () => {
    if (!projName.trim()) {
      toast({ title: "Project name required", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      await api.createProject({ name: projName.trim(), description: projDesc.trim() || undefined });
      // Refresh projects + user session.
      const me = await api.me();
      setAuth({ user: me.user, projects: me.projects });
      const newP = me.projects[me.projects.length - 1];
      if (newP) setActiveProject(newP.id);
      toast({ title: "Project created", description: projName.trim() });
      setProjName("");
      setProjDesc("");
      setNewProjOpen(false);
      setProjOpen(false);
    } catch (err) {
      toast({ title: "Failed to create project", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
      if (projRef.current && !projRef.current.contains(e.target as Node)) setProjOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    clearAuth();
    setView("landing");
  };

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? projects[0];
  const initials = user?.name?.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase() ?? "U";

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

        {/* Project selector */}
        {projects.length > 0 && (
          <div className="relative" ref={projRef}>
            <button
              onClick={() => setProjOpen((v) => !v)}
              className="flex items-center gap-2 rounded-md border border-border/60 bg-secondary/40 px-3 py-1.5 text-xs hover:bg-secondary/60"
            >
              <span className="max-w-[140px] truncate font-medium text-foreground">{activeProject?.name ?? "Project"}</span>
              <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium uppercase text-primary">{activeProject?.role}</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
            {projOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 min-w-[220px] rounded-md border border-border/60 bg-popover p-1 shadow-xl">
                <p className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">Your projects</p>
                {projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setActiveProject(p.id);
                      setProjOpen(false);
                    }}
                    className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-secondary/60"
                  >
                    <span className="truncate text-foreground">{p.name}</span>
                    <span className="flex items-center gap-1.5">
                      <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[9px] uppercase text-primary">{p.role}</span>
                      {p.id === activeProjectId && <Check className="h-3 w-3 text-primary" />}
                    </span>
                  </button>
                ))}
                <div className="my-1 border-t border-border/60" />
                <button
                  onClick={() => { setNewProjOpen(true); setProjOpen(false); }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs font-medium text-primary hover:bg-primary/10"
                >
                  <Plus className="h-3.5 w-3.5" /> New project
                </button>
              </div>
            )}
          </div>
        )}

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

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-md border border-border/60 bg-secondary/40 py-1 pl-1 pr-2 hover:bg-secondary/60"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-primary to-emerald-500 text-xs font-semibold text-white">
              {initials}
            </div>
            <div className="hidden leading-none sm:block">
              <p className="max-w-[120px] truncate text-xs font-medium text-foreground">{user?.name ?? "User"}</p>
              <p className="max-w-[120px] truncate text-[10px] text-muted-foreground">{user?.email}</p>
            </div>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 min-w-[200px] rounded-md border border-border/60 bg-popover p-1 shadow-xl">
              <div className="border-b border-border/60 px-2 py-2">
                <p className="text-xs font-medium text-foreground">{user?.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{user?.email}</p>
              </div>
              <button
                onClick={() => {
                  setView("settings");
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-foreground hover:bg-secondary/60"
              >
                <UserIcon className="h-3.5 w-3.5" /> Settings
              </button>
              <button
                onClick={logout}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-red-400 hover:bg-red-500/10"
              >
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Create Project modal */}
      <Dialog open={newProjOpen} onOpenChange={setNewProjOpen}>
        <DialogContent className="border-border/60 bg-popover">
          <DialogHeader>
            <DialogTitle>Create a new project</DialogTitle>
            <DialogDescription>
              Projects are isolated workspaces. Each has its own reviews, sources, team, and API keys. You'll be the admin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="proj-name">Project name</Label>
              <Input id="proj-name" value={projName} onChange={(e) => setProjName(e.target.value)} placeholder="e.g. Spotify — Podcast Discovery" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proj-desc">Description (optional)</Label>
              <Input id="proj-desc" value={projDesc} onChange={(e) => setProjDesc(e.target.value)} placeholder="What is this project analyzing?" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewProjOpen(false)}>Cancel</Button>
            <Button onClick={createProject} disabled={creating} className="gap-2">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
