"use client";

import { useState } from "react";
import { SectionHeader, ChartCard } from "@/components/dashboard/shared";
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
import { UserPlus, Mail, Crown, Eye, ShieldCheck, MoreHorizontal } from "lucide-react";

interface Member {
  id: string;
  name: string;
  email: string;
  role: "admin" | "analyst" | "viewer";
  addedAt: string;
}

const INITIAL: Member[] = [
  { id: "1", name: "You (PM)", email: "pm@reviewpulse.dev", role: "admin", addedAt: "2026-05-01" },
  { id: "2", name: "Aisha Rahman", email: "aisha@reviewpulse.dev", role: "analyst", addedAt: "2026-05-04" },
  { id: "3", name: "Marco Bianchi", email: "marco@reviewpulse.dev", role: "analyst", addedAt: "2026-05-09" },
  { id: "4", name: "Lena Vogel", email: "lena@reviewpulse.dev", role: "viewer", addedAt: "2026-05-12" },
];

const ROLE_STYLE: Record<Member["role"], { label: string; cls: string; icon: typeof Crown }> = {
  admin: { label: "Admin", cls: "rp-bg-critical", icon: Crown },
  analyst: { label: "Analyst", cls: "rp-bg-medium", icon: ShieldCheck },
  viewer: { label: "Viewer", cls: "rp-bg-neutral", icon: Eye },
};

export function TeamView() {
  const [members, setMembers] = useState<Member[]>(INITIAL);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Member["role"]>("analyst");
  const { toast } = useToast();

  const invite = () => {
    if (!email.trim() || !name.trim()) {
      toast({ title: "Name and email are required", variant: "destructive" });
      return;
    }
    const m: Member = {
      id: `m_${Date.now()}`,
      name: name.trim(),
      email: email.trim(),
      role,
      addedAt: new Date().toISOString().slice(0, 10),
    };
    setMembers((prev) => [...prev, m]);
    toast({ title: `Invitation sent to ${m.email}`, description: `Role: ${ROLE_STYLE[role].label}` });
    setEmail("");
    setName("");
    setRole("analyst");
    setOpen(false);
  };

  const removeMember = (id: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== id));
    toast({ title: "Member removed" });
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Team"
        description="Manage who has access to this project and their role. RBAC: admin (manage), analyst (edit), viewer (read)."
        action={
          <Button onClick={() => setOpen(true)} className="gap-2">
            <UserPlus className="h-4 w-4" /> Invite Member
          </Button>
        }
      />

      <ChartCard title="Members" subtitle={`${members.length} member${members.length === 1 ? "" : "s"} with access`}>
        <ul className="divide-y divide-border/60">
          {members.map((m) => {
            const r = ROLE_STYLE[m.role];
            const Icon = r.icon;
            return (
              <li key={m.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-emerald-500/80 text-xs font-semibold text-white">
                    {m.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{m.name}</p>
                    <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      {m.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase ${r.cls}`}>
                    <Icon className="h-3 w-3" />
                    {r.label}
                  </span>
                  <span className="hidden text-xs text-muted-foreground sm:inline">{m.addedAt}</span>
                  {m.id !== "1" && (
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-red-400" onClick={() => removeMember(m.id)}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
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
              They'll receive an email invitation to join this project with the role you choose.
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
