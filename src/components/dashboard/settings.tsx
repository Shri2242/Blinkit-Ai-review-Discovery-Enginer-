"use client";

import { useEffect, useState, useCallback } from "react";
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
import { Key, Plus, Copy, Trash2, AlertTriangle, RefreshCw, Database, Check } from "lucide-react";

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
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
  const { toast } = useToast();
  const { setView, activeProjectId, user } = useApp();

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

  useEffect(() => {
    loadKeys();
    loadEmbed();
  }, [loadKeys, loadEmbed]);

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

  return (
    <div className="space-y-6">
      <SectionHeader title="Settings" description="Manage project configuration, API keys, and danger-zone actions." />

      <Tabs defaultValue="general">
        <TabsList className="bg-card">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="apikeys">API Keys</TabsTrigger>
          <TabsTrigger value="danger">Danger Zone</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4 space-y-4">
          <ChartCard title="Project details" subtitle="Shown across the dashboard">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Project name</Label>
                <Input defaultValue="Spotify — Music Discovery" />
              </div>
              <div className="space-y-1.5">
                <Label>Owner</Label>
                <Input defaultValue={user?.email ?? "pm@reviewpulse.dev"} disabled />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Description</Label>
                <Input defaultValue="Growth team initiative: analyze user feedback to increase meaningful music discovery." />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button>Save changes</Button>
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

        <TabsContent value="danger" className="mt-4">
          <ChartCard title="Danger zone" subtitle="Irreversible actions. Proceed with caution.">
            <div className="space-y-4">
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
                <Button variant="outline" className="gap-2 border-red-500/40 text-red-300 hover:bg-red-500/10" disabled>
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
    </div>
  );
}
