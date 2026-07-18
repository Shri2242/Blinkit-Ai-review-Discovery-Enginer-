"use client";

import { useEffect, useState, useCallback, type ReactNode } from "react";
import { SectionHeader, ChartCard } from "@/components/dashboard/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useApp } from "@/store/app";
import { api } from "@/lib/api";
import { Key, Plus, Copy, Trash2, AlertTriangle, RefreshCw, Database, Check, Bot, Boxes, Chrome, Phone, type LucideIcon } from "lucide-react";

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

type EnvStatus = Awaited<ReturnType<typeof api.envStatus>>;

const PROD_ENV_VARS_BLOCK = `DATABASE_URL=postgresql://user:pass@host:5432/dbname?sslmode=require
JWT_SECRET=<32+ char random string>
DEEPSEEK_API_KEY=sk-...  (optional, falls back to z-ai SDK)
GOOGLE_CLIENT_ID=...  (optional)
GOOGLE_CLIENT_SECRET=...  (optional)
TWILIO_ACCOUNT_SID=...  (optional)
TWILIO_AUTH_TOKEN=...  (optional)
NEXT_PUBLIC_APP_URL=https://your-domain.com`;

function ProdStatusRow({ icon: Icon, name, configured, children }: {
  icon: LucideIcon;
  name: string;
  configured: boolean;
  children: ReactNode;
}) {
  return (
    <li className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="flex min-w-0 items-start gap-3">
        <div className="rp-bg-medium flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-foreground">{name}</p>
            {configured ? (
              <span className="rp-bg-positive rounded px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">Configured</span>
            ) : (
              <span className="rp-bg-mixed rounded px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">Not configured</span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">{children}</div>
        </div>
      </div>
    </li>
  );
}

export function SettingsView() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [keysLoading, setKeysLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reseeding, setReseeding] = useState(false);
  const [embedInfo, setEmbedInfo] = useState<{ coverage: number; model: string; neural: boolean; withEmbedding: number; processed: number } | null>(null);
  const [envStatus, setEnvStatus] = useState<EnvStatus | null>(null);
  const [envLoading, setEnvLoading] = useState(true);
  const [clearReviewsOpen, setClearReviewsOpen] = useState(false);
  const [clearingReviews, setClearingReviews] = useState(false);
  const [envCopied, setEnvCopied] = useState(false);
  const { toast } = useToast();
  const { setView, activeProjectId, user, projects, setAuth, setActiveProject } = useApp();

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? projects[0];

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [savingProject, setSavingProject] = useState(false);
  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);

  useEffect(() => {
    if (activeProject) {
      setName(activeProject.name);
      setDescription(activeProject.description ?? "");
    }
  }, [activeProject]);

  const saveProjectDetails = async () => {
    if (!name.trim()) {
      toast({ title: "Project name is required", variant: "destructive" });
      return;
    }
    setSavingProject(true);
    try {
      await api.updateProject(activeProjectId!, { name: name.trim(), description: description.trim() || null });
      const me = await api.me();
      setAuth({ user: me.user, projects: me.projects });
      toast({ title: "Project updated" });
    } catch (e) {
      toast({ title: "Failed to update project", variant: "destructive", description: e instanceof Error ? e.message : "" });
    } finally {
      setSavingProject(false);
    }
  };

  const handleDeleteProject = async () => {
    setDeletingProject(true);
    try {
      await api.deleteProject(activeProjectId!);
      toast({ title: "Project deleted" });
      const me = await api.me();
      setAuth({ user: me.user, projects: me.projects });
      const nextP = me.projects[0];
      setActiveProject(nextP ? nextP.id : null);
      setView("overview");
      setDeleteProjectOpen(false);
    } catch (e) {
      toast({ title: "Failed to delete project", variant: "destructive", description: e instanceof Error ? e.message : "" });
    } finally {
      setDeletingProject(false);
    }
  };

  const loadKeys = useCallback(async () => {
    setKeysLoading(true);
    try {
      const res = await api.listApiKeys();
      setKeys(res.keys as ApiKey[]);
    } catch (e) {
      toast({ title: "Failed to load API keys", variant: "destructive", description: e instanceof Error ? e.message : "" });
    } finally {
      setKeysLoading(false);
    }
  }, [toast]);

  const loadEmbed = useCallback(async () => {
    try {
      const res = await api.embedStatus(activeProjectId);
      setEmbedInfo({ coverage: res.coverage, model: res.model, neural: res.neural, withEmbedding: res.withEmbedding, processed: res.processed });
    } catch {
      /* ignore */
    }
  }, [activeProjectId]);

  const loadEnvStatus = useCallback(async () => {
    setEnvLoading(true);
    try {
      const res = await api.envStatus();
      setEnvStatus(res);
    } catch {
      /* ignore */
    } finally {
      setEnvLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKeys();
    loadEmbed();
    loadEnvStatus();
  }, [loadKeys, loadEmbed, loadEnvStatus, activeProjectId]);

  useEffect(() => {
    const handler = () => {
      loadKeys();
      loadEmbed();
      loadEnvStatus();
    };
    window.addEventListener("rp-refresh", handler);
    return () => {
      window.removeEventListener("rp-refresh", handler);
    };
  }, [loadKeys, loadEmbed, loadEnvStatus, activeProjectId]);

  const generateKey = async () => {
    if (!newKeyName.trim()) return;
    try {
      const res = await api.createApiKey(newKeyName.trim());
      setRawKey(res.key.raw);
      setKeys((prev) => [{ id: res.key.id, name: res.key.name, prefix: res.key.prefix, createdAt: res.key.createdAt, lastUsedAt: null }, ...prev]);
      toast({ title: "API key created", description: "Copy it now — the raw value is shown only once." });
      setNewKeyName("");
      setOpen(false);
    } catch (e) {
      toast({ title: "Failed to create key", variant: "destructive", description: e instanceof Error ? e.message : "" });
    }
  };

  const revokeKey = async (id: string) => {
    try {
      await api.revokeApiKey(id);
      setKeys((prev) => prev.filter((k) => k.id !== id));
      toast({ title: "API key revoked" });
    } catch (e) {
      toast({ title: "Revoke failed", variant: "destructive", description: e instanceof Error ? e.message : "" });
    }
  };

  const copyRaw = () => {
    if (!rawKey) return;
    navigator.clipboard?.writeText(rawKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const reseed = async () => {
    setReseeding(true);
    try {
      const r = await api.seed();
      toast({ title: "Database reseeded", description: `${r.reviewsInserted} reviews, ${r.sourcesInserted} sources.` });
      setDeleteOpen(false);
      setView("overview");
    } catch (e) {
      toast({ title: "Reseed failed", variant: "destructive", description: e instanceof Error ? e.message : "" });
    } finally {
      setReseeding(false);
    }
  };

  const clearReviews = async () => {
    setClearingReviews(true);
    try {
      const r = await api.clearReviews(activeProjectId);
      toast({ title: "Reviews cleared", description: `${r.deleted} reviews deleted. Sources preserved.` });
      setClearReviewsOpen(false);
      setView("overview");
    } catch (e) {
      toast({ title: "Clear failed", variant: "destructive", description: e instanceof Error ? e.message : "" });
    } finally {
      setClearingReviews(false);
    }
  };

  const copyEnvVars = () => {
    navigator.clipboard?.writeText(PROD_ENV_VARS_BLOCK);
    setEnvCopied(true);
    setTimeout(() => setEnvCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Settings" description="Manage project configuration, API keys, and danger-zone actions." />

      <Tabs defaultValue="general">
        <TabsList className="bg-card">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="apikeys">API Keys</TabsTrigger>
          <TabsTrigger value="prod">Production Setup</TabsTrigger>
          <TabsTrigger value="danger">Danger Zone</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4 space-y-4">
          <ChartCard title="Project details" subtitle="Shown across the dashboard">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="project-name-input">Project name</Label>
                <Input
                  id="project-name-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Blinkit Review Discovery Enginer"
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
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this project analyzing?"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={saveProjectDetails} disabled={savingProject}>
                {savingProject ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </ChartCard>

          <ChartCard title="AI processing" subtitle="How reviews are analyzed">
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>LLM model</span>
                <code className="rounded bg-secondary/60 px-2 py-0.5 text-xs text-foreground">z-ai-web-dev-sdk (DeepSeek-equivalent)</code>
              </div>
              <div className="flex items-center justify-between">
                <span>Analysis batch size</span>
                <span className="text-foreground">8 reviews / request</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Embedding model</span>
                <code className="rounded bg-secondary/60 px-2 py-0.5 text-xs text-foreground">{embedInfo?.model ?? "xenova/all-MiniLM-L6-v2"}</code>
                {embedInfo?.neural && <span className="rp-bg-positive rounded px-1.5 py-0.5 text-[10px] font-semibold">NEURAL</span>}
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
                <span className="text-foreground">JSON vector + cosine similarity (SQLite). Portable to pgvector VECTOR(384).</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Fallback on LLM error</span>
                <span className="text-foreground">Heuristic rule-based analyzer</span>
              </div>
            </div>
          </ChartCard>
        </TabsContent>

        <TabsContent value="apikeys" className="mt-4">
          <ChartCard
            title="API keys"
            subtitle="Keys are SHA-256 hashed in storage. The raw value is shown only once at creation."
            action={
              <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Generate New Key
              </Button>
            }
          >
            {keysLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Loading keys…</div>
            ) : keys.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No API keys yet. Generate one to access the API programmatically.</div>
            ) : (
              <ul className="divide-y divide-border/60">
                {keys.map((k) => (
                  <li key={k.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="rp-bg-medium flex h-9 w-9 items-center justify-center rounded-lg">
                        <Key className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{k.name}</p>
                        <p className="font-mono text-xs text-muted-foreground">{k.prefix}…</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="hidden sm:inline">Created {k.createdAt.slice(0, 10)}</span>
                      <span className="hidden md:inline">{k.lastUsedAt ? `Used ${new Date(k.lastUsedAt).toLocaleDateString()}` : "Never used"}</span>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-red-400" onClick={() => revokeKey(k.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </ChartCard>
        </TabsContent>

        <TabsContent value="prod" className="mt-4 space-y-4">
          <ChartCard title="Production setup" subtitle="Live environment status. Each row checks a production dependency.">
            {envLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Checking environment…</div>
            ) : !envStatus ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Failed to load environment status.</div>
            ) : (
              <ul className="divide-y divide-border/60">
                <ProdStatusRow icon={Database} name="Database" configured={envStatus.database.configured}>
                  <p>
                    Provider: <code className="font-mono">{envStatus.database.provider}</code>. Production: {envStatus.database.isProduction ? "yes" : "no"}.
                  </p>
                  {envStatus.database.provider === "sqlite" && (
                    <p className="mt-1">
                      Using SQLite (sandbox). For production, set <code className="font-mono">DATABASE_URL</code> to a PostgreSQL connection string with pgvector enabled (Neon, Supabase, or Railway).
                    </p>
                  )}
                </ProdStatusRow>
                <ProdStatusRow icon={Key} name="JWT Secret" configured={envStatus.jwtSecret.configured}>
                  {envStatus.jwtSecret.configured
                    ? "JWT signing secret is set."
                    : "Using insecure dev default — set JWT_SECRET to a 32+ char random string in production."}
                </ProdStatusRow>
                <ProdStatusRow icon={Bot} name="AI Provider (DeepSeek)" configured={envStatus.ai.deepseek.configured}>
                  {envStatus.ai.deepseek.configured ? (
                    <>DeepSeek API active. Base URL: <code className="font-mono">{envStatus.ai.deepseek.baseUrl}</code></>
                  ) : (
                    "Using z-ai-web-dev-sdk fallback. Set DEEPSEEK_API_KEY to use real DeepSeek (deepseek-chat model). Get a key at https://platform.deepseek.com"
                  )}
                </ProdStatusRow>
                <ProdStatusRow icon={Boxes} name="Embeddings" configured>
                  xenova/all-MiniLM-L6-v2 (local, 384-dim, $0 cost)
                </ProdStatusRow>
                <ProdStatusRow icon={Chrome} name="Google OAuth" configured={envStatus.auth.google.configured}>
                  {envStatus.auth.google.configured
                    ? "Google OAuth credentials configured."
                    : "Not configured. Set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET. Create credentials at https://console.cloud.google.com/apis/credentials"}
                </ProdStatusRow>
                <ProdStatusRow icon={Phone} name="Phone SMS (Twilio)" configured={envStatus.auth.twilio.configured}>
                  {envStatus.auth.twilio.configured
                    ? "Twilio credentials configured for SMS OTP."
                    : "Not configured. Set TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN for real SMS OTP. Without these, phone auth runs in dev mode (code shown in UI)."}
                </ProdStatusRow>
                <ProdStatusRow icon={Database} name="Redis" configured={envStatus.redis.configured}>
                  {envStatus.redis.configured
                    ? "Redis configured for rate-limit storage."
                    : "Not configured (optional). Used for rate-limit storage in multi-instance deployments."}
                </ProdStatusRow>
              </ul>
            )}
          </ChartCard>

          <ChartCard
            title="Required for production"
            subtitle="Copy these env vars into your .env or deployment config."
            action={
              <Button size="sm" variant="outline" className="gap-1.5" onClick={copyEnvVars}>
                {envCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                {envCopied ? "Copied" : "Copy"}
              </Button>
            }
          >
            <pre className="rp-scroll overflow-x-auto rounded-md border border-border/60 bg-secondary/40 p-3 font-mono text-xs text-foreground">{PROD_ENV_VARS_BLOCK}</pre>
          </ChartCard>
        </TabsContent>

        <TabsContent value="danger" className="mt-4">
          <ChartCard title="Danger zone" subtitle="Irreversible actions. Proceed with caution.">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/5 p-4">
                <div className="flex items-start gap-3">
                  <Trash2 className="mt-0.5 h-5 w-5 text-red-400" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Clear all reviews</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Deletes every stored review for this project. Sources, projects, and API keys are preserved. Useful if reviews persist after deleting sources.
                    </p>
                  </div>
                </div>
                <Button variant="outline" className="gap-2 border-red-500/40 text-red-300 hover:bg-red-500/10" onClick={() => setClearReviewsOpen(true)}>
                  <Trash2 className="h-4 w-4" /> Clear reviews
                </Button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-400" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Reseed demo data</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Wipes ALL reviews, sources, and logs, then re-inserts the 50 demo reviews + 4 sources.
                    </p>
                  </div>
                </div>
                <Button variant="outline" className="gap-2 border-amber-500/40 text-amber-300 hover:bg-amber-500/10" onClick={() => setDeleteOpen(true)}>
                  <RefreshCw className="h-4 w-4" /> Reseed
                </Button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/5 p-4">
                <div className="flex items-start gap-3">
                  <Trash2 className="mt-0.5 h-5 w-5 text-red-400" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Delete project</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Permanently deletes this project and all associated data.
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="gap-2 border-red-500/40 text-red-300 hover:bg-red-500/10"
                  onClick={() => setDeleteProjectOpen(true)}
                >
                  <Trash2 className="h-4 w-4" /> Delete project
                </Button>
              </div>
            </div>
          </ChartCard>
        </TabsContent>
      </Tabs>

      {/* Generate key modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-border/60 bg-popover">
          <DialogHeader>
            <DialogTitle>Generate new API key</DialogTitle>
            <DialogDescription>Give your key a name so you remember where it's used.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label htmlFor="key-name">Key name</Label>
            <Input id="key-name" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="e.g. Production ingestion" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={generateKey} className="gap-2"><Key className="h-4 w-4" /> Generate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Raw key reveal (shown once after creation) */}
      <Dialog open={!!rawKey} onOpenChange={(o) => { if (!o) setRawKey(null); }}>
        <DialogContent className="border-border/60 bg-popover">
          <DialogHeader>
            <DialogTitle>API key created</DialogTitle>
            <DialogDescription>
              Copy this key now. For security, only a SHA-256 hash is stored — the raw value will never be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <div className="flex items-center gap-2 rounded-md border border-border/60 bg-secondary/40 p-2">
              <code className="rp-scroll flex-1 overflow-x-auto font-mono text-xs text-foreground">{rawKey}</code>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={copyRaw}>
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setRawKey(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reseed confirm */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="border-border/60 bg-popover">
          <DialogHeader>
            <DialogTitle>Reseed the database?</DialogTitle>
            <DialogDescription>
              This will permanently wipe all current reviews, sources, and logs, and replace them with the 50-review demo dataset. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button onClick={reseed} disabled={reseeding} className="gap-2">
              <Database className="h-4 w-4" />
              {reseeding ? "Reseeding…" : "Yes, reseed"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear reviews confirm */}
      <Dialog open={clearReviewsOpen} onOpenChange={setClearReviewsOpen}>
        <DialogContent className="border-border/60 bg-popover">
          <DialogHeader>
            <DialogTitle>Clear all reviews?</DialogTitle>
            <DialogDescription>
              This permanently deletes all reviews for the current project. Sources, projects, and API keys are kept. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setClearReviewsOpen(false)}>Cancel</Button>
            <Button onClick={clearReviews} disabled={clearingReviews} variant="outline" className="gap-2 border-red-500/40 text-red-300 hover:bg-red-500/10">
              <Trash2 className="h-4 w-4" />
              {clearingReviews ? "Clearing…" : "Yes, clear reviews"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Delete project confirm */}
      <Dialog open={deleteProjectOpen} onOpenChange={setDeleteProjectOpen}>
        <DialogContent className="border-border/60 bg-popover">
          <DialogHeader>
            <DialogTitle>Delete this project?</DialogTitle>
            <DialogDescription>
              This will permanently delete the project <strong className="text-foreground">{activeProject?.name}</strong> and all associated reviews, sources, and settings. This action is irreversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteProjectOpen(false)}>Cancel</Button>
            <Button onClick={handleDeleteProject} disabled={deletingProject} variant="destructive" className="gap-2 bg-red-600 hover:bg-red-700 text-white border-0">
              <Trash2 className="h-4 w-4" />
              {deletingProject ? "Deleting…" : "Yes, delete project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
