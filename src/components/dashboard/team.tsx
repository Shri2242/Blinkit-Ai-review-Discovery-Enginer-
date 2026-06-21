"use client";

import { useEffect, useState, useCallback } from "react";
import { useApp } from "@/store/app";
import { api } from "@/lib/api";
import { SectionHeader, ChartCard, LoadingBlock, EmptyState } from "@/components/dashboard/shared";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Mail, Crown, Eye, ShieldCheck, Trash2, RefreshCw } from "lucide-react";

interface Member {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: "admin" | "analyst" | "viewer";
  addedAt: string;
}

const ROLE_STYLE: Record<Member["role"], { label: string; cls: string; icon: typeof Crown }> = {
  admin: { label: "Admin", cls: "rp-bg-critical", icon: Crown },
  analyst: { label: "Analyst", cls: "rp-bg-medium", icon: ShieldCheck },
  viewer: { label: "Viewer", cls: "rp-bg-neutral", icon: Eye },
};

export function TeamView() {
  const { activeProjectId, user } = useApp();
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Member["role"]>("analyst");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listMembers(activeProjectId);
      setMembers(data.members as Member[]);
    } catch (e) {
      toast({ title: "Failed to load team", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [activeProjectId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const invite = async () => {
    if (!email.trim() || !name.trim()) {
      toast({ title: "Name and email are required", variant: "destructive" });
      return;
    }
    try {
      const res = await api.inviteMember({ email: email.trim(), name: name.trim(), role }, activeProjectId);
      setMembers((prev) => [...prev, { id: res.member.id, userId: res.member.userId, name: res.member.name, email: res.member.email, role: res.member.role as Member["role"], addedAt: new Date().toISOString() }]);
      toast({ title: `Invited ${res.member.email}`, description: `Role: ${ROLE_STYLE[role].label}` });
      setEmail("");
      setName("");
      setRole("analyst");
      setOpen(false);
    } catch (e) {
      toast({ title: "Invite failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const changeRole = async (userId: string, newRole: Member["role"]) => {
    try {
      await api.updateMemberRole(userId, newRole, activeProjectId);
      setMembers((prev) => prev.map((m) => (m.userId === userId ? { ...m, role: newRole } : m)));
      toast({ title: "Role updated" });
    } catch (e) {
      toast({ title: "Update failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const removeMember = async (userId: string) => {
    try {
      await api.removeMember(userId, activeProjectId);
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
      toast({ title: "Member removed" });
    } catch (e) {
      toast({ title: "Remove failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Team"
        description="Manage who has access to this project and their role. RBAC: admin (manage), analyst (edit), viewer (read)."
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={load}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            <Button onClick={() => setOpen(true)} className="gap-2">
              <UserPlus className="h-4 w-4" /> Invite Member
            </Button>
          </div>
        }
      />

      <ChartCard title="Members" subtitle={`${members.length} member${members.length === 1 ? "" : "s"} with access`}>
        {loading ? (
          <LoadingBlock label="Loading members…" />
        ) : members.length === 0 ? (
          <EmptyState title="No members" description="Invite team members to collaborate." />
        ) : (
          <ul className="divide-y divide-border/60">
            {members.map((m) => {
              const r = ROLE_STYLE[m.role];
              const Icon = r.icon;
              const isSelf = m.userId === user?.id;
              return (
                <li key={m.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-emerald-500/80 text-xs font-semibold text-white">
                      {m.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {m.name} {isSelf && <span className="text-[10px] text-muted-foreground">(you)</span>}
                      </p>
                      <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        {m.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={m.role} onValueChange={(v) => changeRole(m.userId, v as Member["role"])}>
                      <SelectTrigger className="h-8 w-[110px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="analyst">Analyst</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className={`hidden items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase sm:inline-flex ${r.cls}`}>
                      <Icon className="h-3 w-3" />
                      {r.label}
                    </span>
                    {!isSelf && (
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-red-400" onClick={() => removeMember(m.userId)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </ChartCard>

      <ChartCard title="Roles & permissions" subtitle="RBAC matrix for this project">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Capability</th>
                <th className="pb-2 px-4 text-center font-medium">Admin</th>
                <th className="pb-2 px-4 text-center font-medium">Analyst</th>
                <th className="pb-2 px-4 text-center font-medium">Viewer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {[
                { cap: "View dashboard & reviews", admin: true, analyst: true, viewer: true },
                { cap: "Upload reviews (CSV/JSON)", admin: true, analyst: true, viewer: false },
                { cap: "Run collectors", admin: true, analyst: true, viewer: false },
                { cap: "Manage collector sources", admin: true, analyst: false, viewer: false },
                { cap: "Invite / remove members", admin: true, analyst: false, viewer: false },
                { cap: "Delete project", admin: true, analyst: false, viewer: false },
              ].map((row) => (
                <tr key={row.cap}>
                  <td className="py-2.5 pr-4 text-foreground">{row.cap}</td>
                  <td className="py-2.5 px-4 text-center">{row.admin ? "✓" : "—"}</td>
                  <td className="py-2.5 px-4 text-center">{row.analyst ? "✓" : "—"}</td>
                  <td className="py-2.5 px-4 text-center">{row.viewer ? "✓" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-border/60 bg-popover">
          <DialogHeader>
            <DialogTitle>Invite a team member</DialogTitle>
            <DialogDescription>
              They'll be added to this project with the role you choose. (In production an email invite with a token would be sent.)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="invite-name">Full name</Label>
              <Input id="invite-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@company.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Member["role"])}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin — full access</SelectItem>
                  <SelectItem value="analyst">Analyst — edit & run</SelectItem>
                  <SelectItem value="viewer">Viewer — read only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={invite} className="gap-2"><UserPlus className="h-4 w-4" /> Send invite</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
