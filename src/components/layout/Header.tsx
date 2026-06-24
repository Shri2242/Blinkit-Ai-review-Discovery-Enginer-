"use client";

import { useState, useRef, useEffect } from "react";
import { useApp, type ViewKey } from "@/store/app";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Search, Github, ChevronDown, Check, Plus, Loader2, ExternalLink, Trash2 } from "lucide-react";
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
  const { view, setView, projects, activeProjectId, setActiveProject, setAuth } = useApp();
  const { toast } = useToast();
  const meta = VIEW_TITLES[view] ?? VIEW_TITLES.overview;
  const [projOpen, setProjOpen] = useState(false);
  const [newProjOpen, setNewProjOpen] = useState(false);
  const [projName, setProjName] = useState("");
  const [projDesc, setProjDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const projRef = useRef<HTMLDivElement>(null);

  const handleDeleteProject = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this project? All associated data will be lost.")) return;
    
    setDeletingId(id);
    try {
      await api.deleteProject(id);
      const me = await api.me();
      setAuth({ user: me.user, projects: me.projects });
      
      if (activeProjectId === id) {
        const nextP = me.projects[0];
        if (nextP) {
          setActiveProject(nextP.id);
          window.dispatchEvent(new Event("rp-refresh"));
          setView("overview");
        } else {
          setActiveProject(null);
          window.dispatchEvent(new Event("rp-refresh"));
        }
      }
      toast({ title: "Project deleted" });
    } catch (err) {
      toast({ title: "Failed to delete project", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

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
      if (newP) {
        setActiveProject(newP.id);
        window.dispatchEvent(new Event("rp-refresh"));
        setView("overview");
      }
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
      if (projRef.current && !projRef.current.contains(e.target as Node)) setProjOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? projects[0];

  return (
    <header className="relative z-50 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border/60 bg-background/80 px-5 backdrop-blur">
      <div className="flex items-center gap-3">
        <div>
          <p className="text-[11px] text-muted-foreground">{meta.crumb}</p>
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-base font-semibold text-foreground">{meta.title}</h2>
            <span className="rounded bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">Demo Mode</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-2 rounded-md border border-border/60 bg-secondary/40 px-3 py-1.5 text-xs text-muted-foreground md:flex">
          <Search className="h-3.5 w-3.5" />
          <span>Search reviews…</span>
          <kbd className="ml-2 rounded border border-border/60 bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">⌘K</kbd>
        </div>

        {/* Project selector */}
        {projects.length > 0 ? (
          <div className="relative" ref={projRef}>
            <button
              onClick={() => setProjOpen((v) => !v)}
              className="flex items-center gap-2 rounded-md border border-border/60 bg-secondary/40 px-3 py-1.5 text-xs hover:bg-secondary/60"
            >
              <span className="max-w-[140px] truncate font-medium text-foreground">{activeProject?.name ?? "Project"}</span>
              <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium uppercase text-primary">Demo</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
            {projOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 min-w-[240px] flex flex-col max-h-[300px] rounded-md border border-border/60 bg-popover p-1 shadow-xl">
                <p className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">Your projects</p>
                <div className="flex-1 overflow-y-auto overflow-x-hidden">
                  {projects.map((p) => (
                    <div
                      key={p.id}
                      className="group flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-secondary/60 cursor-pointer"
                      onClick={() => {
                        setActiveProject(p.id);
                        window.dispatchEvent(new Event("rp-refresh"));
                        setProjOpen(false);
                      }}
                    >
                      <span className="truncate text-foreground max-w-[120px]">{p.name}</span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[9px] uppercase text-primary">Admin</span>
                        {p.id === activeProjectId && <Check className="h-3 w-3 text-primary" />}
                        <button
                          onClick={(e) => handleDeleteProject(e, p.id)}
                          disabled={deletingId === p.id}
                          className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                          title="Delete project"
                        >
                          {deletingId === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
                <div className="my-1 border-t border-border/60 shrink-0" />
                <button
                  onClick={() => { setNewProjOpen(true); setProjOpen(false); }}
                  className="flex shrink-0 w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs font-medium text-primary hover:bg-primary/10"
                >
                  <Plus className="h-3.5 w-3.5" /> New project
                </button>
              </div>
            )}
          </div>
        ) : (
          <Button
            onClick={() => setNewProjOpen(true)}
            className="flex items-center gap-1.5 text-xs h-8 bg-primary text-white hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            Create Project
          </Button>
        )}

        <button
          onClick={() => setView("landing")}
          className="hidden h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary/60 hover:text-foreground sm:flex"
          aria-label="Landing"
          title="Go to homepage"
        >
          <ExternalLink className="h-4 w-4" />
        </button>

        <a
          href="https://github.com/Shri2242/Ai-Review-Discovery-Engine"
          target="_blank"
          rel="noreferrer"
          className="hidden h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary/60 hover:text-foreground sm:flex"
          aria-label="GitHub"
        >
          <Github className="h-4 w-4" />
        </a>

        {/* User menu removed for demo mode (everyone is anonymous demo user) */}
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
