"use client";

import { useApp } from "@/store/app";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { OverviewView } from "@/components/dashboard/overview";
import { ReviewsView } from "@/components/dashboard/reviews";
import { SourcesView } from "@/components/dashboard/sources";
import { SegmentsView } from "@/components/dashboard/segments";
import { InsightsView } from "@/components/dashboard/insights";
import { ChatView } from "@/components/dashboard/chat";
import { ReportsView } from "@/components/dashboard/reports";
import { TeamView } from "@/components/dashboard/team";
import { SettingsView } from "@/components/dashboard/settings";

export function DashboardShell() {
  const { view, setView } = useApp();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header onOpenLanding={() => setView("landing")} />
        <main className="rp-scroll flex-1 overflow-y-auto">
          <div className="rp-fade-in mx-auto max-w-7xl px-5 py-6 md:px-8 md:py-8">
            {view === "overview" && <OverviewView />}
            {view === "reviews" && <ReviewsView />}
            {view === "sources" && <SourcesView />}
            {view === "segments" && <SegmentsView />}
            {view === "insights" && <InsightsView />}
            {view === "chat" && <ChatView />}
            {view === "reports" && <ReportsView />}
            {view === "team" && <TeamView />}
            {view === "settings" && <SettingsView />}
          </div>
        </main>
      </div>
    </div>
  );
}
