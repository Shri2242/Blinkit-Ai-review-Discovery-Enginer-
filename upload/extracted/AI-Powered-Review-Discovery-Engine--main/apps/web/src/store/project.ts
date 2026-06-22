import { create } from 'zustand';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
  user_role?: string;
  member_count?: number;
  review_count?: number;
}

interface ProjectState {
  currentProject: Project | null;
  projects: Project[];
  setProject: (project: Project | null) => void;
  fetchProjects: () => Promise<void>;
  clear: () => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  currentProject: null,
  projects: [],

  setProject: (project) => {
    set({ currentProject: project });
    if (project) {
      localStorage.setItem('currentProjectId', project.id);
    } else {
      localStorage.removeItem('currentProjectId');
    }
  },

  fetchProjects: async () => {
    const { default: api } = await import('@/lib/api');
    const res = await api.get('/projects');
    const projects = res.data.data as Project[];

    set({ projects });

    if (projects.length > 0) {
      const savedId =
        typeof window !== 'undefined' ? localStorage.getItem('currentProjectId') : null;
      const matchedProject = projects.find((p) => p.id === savedId);

      if (matchedProject) {
        set({ currentProject: matchedProject });
      } else {
        const defaultProj = projects[0] || null;
        set({ currentProject: defaultProj });
        if (defaultProj) {
          localStorage.setItem('currentProjectId', defaultProj.id);
        }
      }
    } else {
      set({ currentProject: null });
      localStorage.removeItem('currentProjectId');
    }
  },

  clear: () => {
    set({ currentProject: null, projects: [] });
    if (typeof window !== 'undefined') {
      localStorage.removeItem('currentProjectId');
    }
  },
}));
