"use client";

import { useEffect } from "react";
import { useApp } from "@/store/app";
import { api } from "@/lib/api";
import { Landing } from "@/components/landing/Landing";
import { AuthView } from "@/components/auth/AuthView";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

export default function Home() {
  const { view, user, authReady, setAuth, setView } = useApp();

  // On first load: check the session. If none, ensure the DB is seeded (so the
  // demo login works) — seeding also creates the default admin user.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const me = await api.me();
        if (!alive) return;
        if (me.user) {
          setAuth({ user: me.user, projects: me.projects });
        } else {
          // Not logged in — make sure the demo user/project exist.
          const status = await api.seedStatus();
          if (!status.seeded) {
            await api.seed();
          }
          setAuth({ user: null, projects: [] });
        }
      } catch {
        if (alive) setAuth({ user: null, projects: [] });
      }
    })();
    return () => {
      alive = false;
    };
  }, [setAuth]);

  // While the session check is in flight, render a minimal loader (avoids
  // flashing the landing page's "Sign in" CTA for authed users).
  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="rp-typing-dot" />
          <span className="rp-typing-dot" />
          <span className="rp-typing-dot" />
          <span className="ml-2">Loading ReviewPulse…</span>
        </div>
      </div>
    );
  }

  if (view === "landing" && !user) return <Landing />;
  if (view === "login") return <AuthView mode="login" />;
  if (view === "register") return <AuthView mode="register" />;
  if (!user) {
    // Any dashboard view requested without auth → show login.
    return <AuthView mode="login" />;
  }
  return <DashboardShell />;
}
