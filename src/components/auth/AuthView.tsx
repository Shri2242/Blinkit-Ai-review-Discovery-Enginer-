"use client";

import { useState } from "react";
import { useApp } from "@/store/app";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Activity, ArrowLeft, Loader2, Lock, Mail, User, Eye, EyeOff, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const PASSWORD_RULES = [
  { test: (p: string) => p.length >= 8, label: "At least 8 characters" },
  { test: (p: string) => /[A-Z]/.test(p), label: "One uppercase letter" },
  { test: (p: string) => /[a-z]/.test(p), label: "One lowercase letter" },
  { test: (p: string) => /\d/.test(p), label: "One number" },
  { test: (p: string) => /[^A-Za-z0-9]/.test(p), label: "One special character" },
];

export function AuthView({ mode: initialMode }: { mode: "login" | "register" }) {
  const { setAuth, setView } = useApp();
  const { toast } = useToast();
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "register") {
        const failed = PASSWORD_RULES.find((r) => !r.test(password));
        if (failed) {
          toast({ title: "Password requirement missing", description: failed.label, variant: "destructive" });
          setLoading(false);
          return;
        }
        await api.register({ name, email, password });
      } else {
        await api.login({ email, password });
      }
      const me = await api.me();
      setAuth({ user: me.user, projects: me.projects });
      toast({ title: mode === "register" ? "Account created" : "Welcome back", description: me.user?.email });
      setView("overview");
    } catch (err) {
      toast({
        title: mode === "register" ? "Registration failed" : "Login failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = () => {
    setEmail("pm@reviewpulse.dev");
    setPassword("ReviewPulse123!");
    setMode("login");
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="rp-hero-grid absolute inset-0" />
      <div className="rp-grid-lines absolute inset-0 opacity-30" />

      <div className="relative w-full max-w-md">
        <button
          onClick={() => setView("landing")}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to home
        </button>

        <div className="rounded-2xl border border-border/60 bg-card p-7 shadow-2xl">
          <div className="mb-6 flex items-center gap-2.5">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-emerald-500">
              <Activity className="h-4 w-4 text-white" />
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            </div>
            <div className="leading-none">
              <p className="font-heading text-base font-semibold">ReviewPulse</p>
              <p className="text-[10px] text-muted-foreground">AI Review Discovery</p>
            </div>
          </div>

          <h1 className="font-heading text-xl font-semibold tracking-tight">
            {mode === "login" ? "Sign in to your account" : "Create your account"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "login"
              ? "Enter your credentials to access the dashboard."
              : "Start analyzing user reviews with AI in minutes."}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "register" && (
              <div className="space-y-1.5">
                <Label htmlFor="auth-name">Full name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="auth-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Doe"
                    className="pl-9"
                    required
                    autoComplete="name"
                  />
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="auth-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="pl-9"
                  required
                  autoComplete="email"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="auth-pw">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="auth-pw"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-9 pr-10"
                  required
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {mode === "register" && (
                <ul className="mt-2 grid grid-cols-1 gap-1 text-[11px] text-muted-foreground sm:grid-cols-2">
                  {PASSWORD_RULES.map((r) => {
                    const ok = r.test(password);
                    return (
                      <li key={r.label} className={cn("flex items-center gap-1.5", ok && "text-emerald-400")}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", ok ? "bg-emerald-400" : "bg-muted-foreground/40")} />
                        {r.label}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <Button type="submit" disabled={loading} className="w-full gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <div className="mt-5 flex items-center gap-2">
            <div className="h-px flex-1 bg-border/60" />
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border/60" />
          </div>

          <button
            onClick={fillDemo}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary/20"
          >
            <Sparkles className="h-4 w-4" />
            Continue with demo account
          </button>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            {mode === "login" ? "Don't have an account? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
              className="font-medium text-primary hover:underline"
            >
              {mode === "login" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>

        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          Demo login: <code className="font-mono">pm@reviewpulse.dev</code> / <code className="font-mono">ReviewPulse123!</code>
        </p>
      </div>
    </div>
  );
}
