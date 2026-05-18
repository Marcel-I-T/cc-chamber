import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { shortId, basename } from '@/lib/utils';

const PROJECT_COLORS = [
  '#a78bfa', // accent purple
  '#7aa2ff', // blue
  '#65d99d', // green
  '#f5b961', // yellow
  '#f06b6b', // red
  '#67e8f9', // cyan
  '#c084fc', // magenta
  '#fb923c', // orange
] as const;

export interface Project {
  id: string;
  name: string;
  path: string;
  color: string;
  collapsed: boolean;
  createdAt: number;
}

interface ProjectsStore {
  projects: Project[];
  activeProjectId: string | null;

  addProject: (path: string, name?: string) => Project;
  removeProject: (id: string) => void;
  renameProject: (id: string, name: string) => void;
  toggleCollapsed: (id: string) => void;
  setActive: (id: string) => void;
  findByPath: (path: string) => Project | undefined;
  reorder: (fromIndex: number, toIndex: number) => void;
}

function normalizePath(p: string) {
  if (!p) return '';
  return p.replace(/\\/g, '/').replace(/\/+$/, '') || '/';
}

export const useProjectsStore = create<ProjectsStore>()(
  persist(
    (set, get) => ({
      projects: [],
      activeProjectId: null,

      addProject: (path, name) => {
        const np = normalizePath(path);
        const existing = get().projects.find((p) => p.path === np);
        if (existing) {
          set({ activeProjectId: existing.id });
          return existing;
        }
        const project: Project = {
          id: shortId(),
          name: name?.trim() || basename(np) || np,
          path: np,
          color: PROJECT_COLORS[get().projects.length % PROJECT_COLORS.length],
          collapsed: false,
          createdAt: Date.now(),
        };
        set((s) => ({
          projects: [...s.projects, project],
          activeProjectId: project.id,
        }));
        return project;
      },

      removeProject: (id) => {
        set((s) => {
          const next = s.projects.filter((p) => p.id !== id);
          let activeProjectId = s.activeProjectId;
          if (activeProjectId === id) {
            activeProjectId = next.length ? next[next.length - 1].id : null;
          }
          return { projects: next, activeProjectId };
        });
      },

      renameProject: (id, name) => {
        set((s) => ({
          projects: s.projects.map((p) => (p.id === id ? { ...p, name } : p)),
        }));
      },

      toggleCollapsed: (id) => {
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id ? { ...p, collapsed: !p.collapsed } : p
          ),
        }));
      },

      setActive: (id) => set({ activeProjectId: id }),

      findByPath: (path) => {
        const np = normalizePath(path);
        return get().projects.find((p) => p.path === np);
      },

      reorder: (fromIndex, toIndex) => {
        set((s) => {
          const next = [...s.projects];
          const [moved] = next.splice(fromIndex, 1);
          next.splice(toIndex, 0, moved);
          return { projects: next };
        });
      },
    }),
    {
      name: 'ckaude-projects',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        projects: state.projects,
        activeProjectId: state.activeProjectId,
      }),
    }
  )
);
