"use client";

import { useEffect } from "react";
import { useApp } from "@/store/app";
import { Landing } from "@/components/landing/Landing";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

export default function Home() {
  const { view } = useApp();

  // Ensure the database is seeded on first dashboard load (silent no-op if already seeded).
  useEffect(() => {
    if (view !== "landing") {
      fetch("/api/seed", { method: "GET" })
        .then((r) => r.json())
        .then((data) => {
          if (!data?.seeded) {
            return fetch("/api/seed", { method: "POST" }).then((r) => r.json());
          }
          return null;
        })
        .catch(() => null);
    }
  }, [view]);

  if (view === "landing") return <Landing />;
  return <DashboardShell />;
}
