"use client";

import { useEffect } from "react";
import { useApp } from "@/store/app";
import { api } from "@/lib/api";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Landing } from "@/components/landing/Landing";
import { AuthView } from "@/components/auth/AuthView";

export default function Home() {
  const { view, authReady, setAuth } = useApp();

  // On first load: check the session (which returns the demo user + project)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const me = await api.me();
        if (!alive) return;
        setAuth({ user: me.user, projects: me.projects });
      } catch {
        if (alive) setAuth({ user: null, projects: [] });
      }
    })();
    return () => {
      alive = false;
    };
  }, [setAuth]);

  // Loading state while the session check is in flight.
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

  // Render components conditionally based on active view state
  if (view === "landing") {
    return <Landing />;
  }
  if (view === "login") {
    return <AuthView mode="login" />;
  }
  if (view === "register") {
    return <AuthView mode="register" />;
  }

  return <DashboardShell />;
}

