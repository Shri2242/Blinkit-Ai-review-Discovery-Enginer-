"use client";

import { useState } from "react";
import { useApp } from "@/store/app";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Activity, ArrowLeft, Loader2, Lock, Mail, User, Eye, EyeOff, Sparkles, Phone, ArrowRight, MessageSquare, KeyRound, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

const PASSWORD_RULES = [
  { test: (p: string) => p.length >= 8, label: "At least 8 characters" },
  { test: (p: string) => /[A-Z]/.test(p), label: "One uppercase letter" },
  { test: (p: string) => /[a-z]/.test(p), label: "One lowercase letter" },
  { test: (p: string) => /\d/.test(p), label: "One number" },
  { test: (p: string) => /[^A-Za-z0-9]/.test(p), label: "One special character" },
];

type Method = "email" | "phone";

export function AuthView({ mode: initialMode }: { mode: "login" | "register" }) {
  const { setAuth, setView } = useApp();
  const { toast } = useToast();
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [method, setMethod] = useState<Method>("email");

  // Email form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  // Phone form state
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [phoneLoading, setPhoneLoading] = useState(false);

  // First-run setup state
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);

  const submitEmail = async (e: React.FormEvent) => {
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

  const continueAsGuest = async () => {
    setLoading(true);
    try {
      await api.guest();
      const me = await api.me();
      setAuth({ user: me.user, projects: me.projects });
      toast({ title: "Signed in as guest", description: "You have read-only (viewer) access." });
      setView("overview");
    } catch (err) {
      toast({ title: "Guest sign-in failed", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      const status = await api.googleStatus();
      if (status.configured) {
        // Real Google OAuth — the GET route redirects to Google.
        window.location.href = "/api/auth/google";
      } else {
        toast({
          title: "Google OAuth not configured",
          description: "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars to enable real Google sign-in. See Settings → Production Setup.",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Could not reach Google OAuth endpoint", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const sendOtp = async () => {
    if (!phone.trim()) {
      toast({ title: "Phone number required", variant: "destructive" });
      return;
    }
    setPhoneLoading(true);
    try {
      const res = await api.phoneSend(phone.trim());
      setOtpSent(true);
      if (res.devCode) {
        setDevCode(res.devCode);
        toast({ title: "Dev mode OTP", description: `Your code is ${res.devCode} (real SMS requires Twilio env vars).` });
      } else {
        toast({ title: "OTP sent", description: "Check your phone for the 6-digit code." });
      }
    } catch (err) {
      toast({ title: "Failed to send OTP", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setPhoneLoading(false);
    }
  };

  const verifyOtp = async () => {
    setPhoneLoading(true);
    try {
      await api.phoneVerify(phone.trim(), otp.trim());
      const me = await api.me();
      setAuth({ user: me.user, projects: me.projects });
      toast({ title: "Signed in", description: me.user?.email });
      setView("overview");
    } catch (err) {
      toast({ title: "Verification failed", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setPhoneLoading(false);
    }
  };

  // First-run: if no users exist, show a "Run first-run setup" button.
  const checkSetup = async () => {
    try {
      const s = await api.setupStatus();
      setNeedsSetup(s.needsSetup);
    } catch {
      setNeedsSetup(false);
    }
  };
  // Check once on mount.
  if (needsSetup === null) {
    checkSetup();
  }

  const runSetup = async () => {
    setLoading(true);
    try {
      await api.setup();
      const me = await api.me();
      setAuth({ user: me.user, projects: me.projects });
      toast({ title: "Setup complete", description: "Default admin account created. You're signed in." });
      setView("overview");
    } catch (err) {
      toast({ title: "Setup failed", description: err instanceof Error ? err.message : "", variant: "destructive" });
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
            {mode === "login" ? "Choose a sign-in method below." : "Choose email or phone to register."}
          </p>

          {/* Method tabs */}
          <div className="mt-5 grid grid-cols-2 gap-1 rounded-lg border border-border/60 bg-secondary/30 p-1">
            <button
              onClick={() => setMethod("email")}
              className={cn("flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition", method === "email" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              <Mail className="h-3.5 w-3.5" /> Email
            </button>
            <button
              onClick={() => setMethod("phone")}
              className={cn("flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition", method === "phone" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              <Smartphone className="h-3.5 w-3.5" /> Phone
            </button>
          </div>

          {/* Email form */}
          {method === "email" && (
            <form onSubmit={submitEmail} className="mt-5 space-y-4">
              {mode === "register" && (
                <div className="space-y-1.5">
                  <Label htmlFor="auth-name">Full name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="auth-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" className="pl-9" required autoComplete="name" />
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="auth-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="auth-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className="pl-9" required autoComplete="email" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="auth-pw">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="auth-pw" type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="pl-9 pr-10" required autoComplete={mode === "login" ? "current-password" : "new-password"} />
                  <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
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
          )}

          {/* Phone form */}
          {method === "phone" && (
            <div className="mt-5 space-y-4">
              {!otpSent ? (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="auth-phone">Phone number</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="auth-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+14155551234" className="pl-9" />
                    </div>
                    <p className="text-[11px] text-muted-foreground">Enter your number in E.164 format. A 6-digit code will be sent.</p>
                  </div>
                  <Button onClick={sendOtp} disabled={phoneLoading} className="w-full gap-2">
                    {phoneLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                    Send code
                  </Button>
                </>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="auth-otp">6-digit code</Label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="auth-otp" inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} placeholder="123456" className="pl-9 text-center text-lg tracking-[0.5em]" />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Code sent to {phone}.{" "}
                      <button type="button" onClick={() => { setOtpSent(false); setOtp(""); setDevCode(null); }} className="text-primary hover:underline">Change number</button>
                    </p>
                    {devCode && (
                      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
                        <strong>Dev mode:</strong> Your code is <code className="font-mono">{devCode}</code>. Set <code>TWILIO_ACCOUNT_SID</code> + <code>TWILIO_AUTH_TOKEN</code> for real SMS.
                      </div>
                    )}
                  </div>
                  <Button onClick={verifyOtp} disabled={phoneLoading || otp.length !== 6} className="w-full gap-2">
                    {phoneLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Verify &amp; sign in
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Divider */}
          <div className="mt-5 flex items-center gap-2">
            <div className="h-px flex-1 bg-border/60" />
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">or continue with</span>
            <div className="h-px flex-1 bg-border/60" />
          </div>

          {/* Social buttons */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={signInWithGoogle}
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded-md border border-border/60 bg-secondary/40 px-3 py-2 text-sm font-medium text-foreground transition hover:bg-secondary/60 disabled:opacity-50"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62Z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
              </svg>
              Google
            </button>
            <button
              onClick={continueAsGuest}
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded-md border border-border/60 bg-secondary/40 px-3 py-2 text-sm font-medium text-foreground transition hover:bg-secondary/60 disabled:opacity-50"
            >
              <User className="h-4 w-4" /> Guest
            </button>
          </div>

          {/* First-run setup */}
          {needsSetup && mode === "login" && (
            <div className="mt-5 rounded-md border border-primary/30 bg-primary/5 p-3 text-center">
              <p className="text-xs text-muted-foreground">No accounts exist yet.</p>
              <button onClick={runSetup} disabled={loading} className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Run first-run setup (creates demo admin + 50 reviews)
              </button>
            </div>
          )}

          {/* Email mode toggle */}
          <p className="mt-5 text-center text-sm text-muted-foreground">
            {mode === "login" ? "Don't have an account? " : "Already have an account? "}
            <button type="button" onClick={() => setMode(mode === "login" ? "register" : "login")} className="font-medium text-primary hover:underline">
              {mode === "login" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>

        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          Demo login: <button onClick={fillDemo} className="font-mono text-primary hover:underline">pm@reviewpulse.dev</button> / <button onClick={fillDemo} className="font-mono text-primary hover:underline">ReviewPulse123!</button>
        </p>
      </div>
    </div>
  );
}
