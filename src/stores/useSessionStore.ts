import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { shortId } from '@/lib/utils';

export type SessionStatus = 'idle' | 'running' | 'exited' | 'error';
export type SessionMode = 'claude' | 'shell';
export type ViewMode = 'terminal' | 'chat';

export interface Session {
  id: string;
  projectId: string;
  title: string;
  cwd: string;
  mode: SessionMode;
  viewMode: ViewMode;
  skipPermissions: boolean;
  status: SessionStatus;
  pid?: number;
  exitCode?: number;
  /** When true, the next PTY spawn for this session uses `--continue` to
   *  pick up the most recent claude conversation in this cwd. Set
   *  automatically after the first successful spawn. */
  resumeOnRespawn?: boolean;
  createdAt: number;
  lastActiveAt: number;
}

interface SessionStore {
  sessions: Session[];
  activeId: string | null;
  defaultSkipPermissions: boolean;

  setDefaultSkipPermissions: (v: boolean) => void;

  create: (opts: {
    projectId: string;
    cwd: string;
    mode?: SessionMode;
    viewMode?: ViewMode;
    skipPermissions?: boolean;
    title?: string;
  }) => Session;
  setViewMode: (id: string, mode: ViewMode) => void;

  remove: (id: string) => void;
  removeByProject: (projectId: string) => void;
  setActive: (id: string) => void;
  update: (id: string, patch: Partial<Session>) => void;
  rename: (id: string, title: string) => void;
  sessionsForProject: (projectId: string) => Session[];
}

export const useSessionStore = create<SessionStore>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeId: null,
      defaultSkipPermissions: false,

      setDefaultSkipPermissions: (v) => set({ defaultSkipPermissions: v }),

      create: ({ projectId, cwd, mode, viewMode, skipPermissions, title }) => {
        const existingForProject = get().sessions.filter(
          (s) => s.projectId === projectId
        );
        const session: Session = {
          id: shortId(),
          projectId,
          title: title ?? `Session ${existingForProject.length + 1}`,
          cwd,
          mode: mode ?? 'claude',
          viewMode: viewMode ?? 'terminal',
          skipPermissions: skipPermissions ?? get().defaultSkipPermissions,
          status: 'idle',
          createdAt: Date.now(),
          lastActiveAt: Date.now(),
        };
        set((s) => ({
          sessions: [...s.sessions, session],
          activeId: session.id,
        }));
        return session;
      },

      setViewMode: (id, viewMode) =>
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === id ? { ...s, viewMode } : s
          ),
        })),

      remove: (id) => {
        set((s) => {
          const next = s.sessions.filter((x) => x.id !== id);
          let activeId = s.activeId;
          if (activeId === id) {
            activeId = next.length ? next[next.length - 1].id : null;
          }
          return { sessions: next, activeId };
        });
      },

      removeByProject: (projectId) => {
        set((s) => {
          const next = s.sessions.filter((x) => x.projectId !== projectId);
          let activeId = s.activeId;
          const wasActive = s.sessions.find((x) => x.id === activeId);
          if (wasActive?.projectId === projectId) {
            activeId = next.length ? next[next.length - 1].id : null;
          }
          return { sessions: next, activeId };
        });
      },

      setActive: (id) => {
        set((s) => ({
          activeId: id,
          sessions: s.sessions.map((x) =>
            x.id === id ? { ...x, lastActiveAt: Date.now() } : x
          ),
        }));
      },

      update: (id, patch) =>
        set((state) => ({
          sessions: state.sessions.map((s) => (s.id === id ? { ...s, ...patch } : s)),
        })),

      rename: (id, title) =>
        set((state) => ({
          sessions: state.sessions.map((s) => (s.id === id ? { ...s, title } : s)),
        })),

      sessionsForProject: (projectId) =>
        get().sessions.filter((s) => s.projectId === projectId),
    }),
    {
      name: 'ckaude-sessions',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sessions: state.sessions.map((s) => ({
          ...s,
          // ensure new fields backfill cleanly when reading older payloads
          viewMode: (s as Session).viewMode ?? 'terminal',
          status: 'idle' as const,
          pid: undefined,
          exitCode: undefined,
          // mark all persisted sessions to resume on next spawn
          resumeOnRespawn: true,
        })),
        activeId: state.activeId,
        defaultSkipPermissions: state.defaultSkipPermissions,
      }),
    }
  )
);
