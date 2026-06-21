"use client";

import { create } from "zustand";
import type { AuthUser, AuthProject } from "@/lib/api";

export type ViewKey =
  | "landing"
  | "login"
  | "register"
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

  // Auth state
  user: AuthUser | null;
  projects: AuthProject[];
  activeProjectId: string | null;
  authReady: boolean; // true once we've checked the session on load
  setAuth: (data: { user: AuthUser | null; projects: AuthProject[] }) => void;
  setActiveProject: (id: string | null) => void;
  clearAuth: () => void;

  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

export const useApp = create<AppState>((set) => ({
  view: "landing",
  setView: (view) => set({ view }),

  user: null,
  projects: [],
  activeProjectId: null,
  authReady: false,
  setAuth: ({ user, projects }) =>
    set({
      user,
      projects,
      activeProjectId: projects[0]?.id ?? null,
      authReady: true,
    }),
  setActiveProject: (activeProjectId) => set({ activeProjectId }),
  clearAuth: () => set({ user: null, projects: [], activeProjectId: null, view: "landing" }),

  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  searchQuery: "",
  setSearchQuery: (searchQuery) => set({ searchQuery }),
}));
