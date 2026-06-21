"use client";

import { create } from "zustand";

export type ViewKey =
  | "landing"
  | "overview"
  | "reviews"
  | "sources"
  | "segments"
  | "insights"
  | "chat"
  | "reports"
  | "team"
  | "settings";

interface AppState {
  view: ViewKey;
  setView: (v: ViewKey) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  searchQuery: string; // global semantic search (reviews page)
  setSearchQuery: (q: string) => void;
}

export const useApp = create<AppState>((set) => ({
  view: "landing",
  setView: (view) => set({ view }),
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  searchQuery: "",
  setSearchQuery: (searchQuery) => set({ searchQuery }),
}));
