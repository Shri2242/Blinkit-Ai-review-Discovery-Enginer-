"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/store/app";
import { api } from "@/lib/api";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Landing } from "@/components/landing/Landing";
import { AuthView } from "@/components/auth/AuthView";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Database, RefreshCw } from "lucide-react";

function SetupDemoDataView() {
  const { setAuth } = useApp();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSetup = async () => {
    setLoading(true);
    try {
      const res = await api.setup();
      toast({
        title: "Database Initialized",
        description: "Demo project and 50 reviews successfully seeded.",
      });
      // Fetch user session to refresh the store
      const me = await api.me();
      setAuth({ user: me.user, projects: me.projects });
    } catch (err) {
      toast({
        title: "Setup failed",
        description: err instanceof Error ? err.message : "Failed to run setup",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="rp-hero-grid absolute inset-0 pointer-events-none opacity-40" />
      <div className="rp-grid-lines absolute inset-0 opacity-20 pointer-events-none" />
      <div className="w-full max-w-md space-y-8 relative z-10">
        <div className="flex flex-col items-center text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-6 shadow-inner ring-1 ring-primary/20">
            <Database className="h-8 w-8" />
          </div>
          <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground">
            Database Initialization
          </h2>
          <p className="mt-3 text-sm text-muted-foreground max-w-sm">
            Your database is currently empty. Initialize ReviewPulse with a default admin user, a demo project, and 50 pre-analyzed Blinkit quick-commerce reviews.
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-border/60 bg-card/60 p-6 shadow-xl backdrop-blur-sm space-y-6">
          <div className="rounded-lg bg-secondary/50 p-4 border border-border/30">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">What's included:</h4>
            <ul className="text-xs text-muted-foreground space-y-2">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span>Default admin account (pm@reviewpulse.dev)</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span>Blinkit Review Discovery Engine project workspace</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span>50 sample reviews categorized with AI tags</span>
              </li>
            </ul>
          </div>

          <Button
            onClick={handleSetup}
            disabled={loading}
            className="w-full h-11 text-sm bg-primary text-white hover:bg-primary/90 font-medium rounded-xl gap-2 shadow-lg hover:shadow-primary/20 transition-all duration-200"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Initializing..." : "Initialize Demo Database"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { view, authReady, setAuth, projects } = useApp();

  // On first load: check the session (which returns the demo user + project)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let me = await api.me();
        if (!me.user) {
          // Log in automatically as a unique guest user to get isolated workspace
          const guestRes = await api.guest();
          if (guestRes.ok) {
            me = await api.me();
          }
        }
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

  // If projects list is empty and we want to view the app, show the Setup view
  if (projects.length === 0) {
    return <SetupDemoDataView />;
  }

  return <DashboardShell />;
}

