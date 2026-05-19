import {
  PanelLeft,
  PanelRight,
  Terminal as TerminalIcon,
  Settings,
  FolderPlus,
  ShieldOff,
  Shield,
  FolderOpen,
  MessageSquare,
} from 'lucide-react';
import { useUIStore, type MainTab } from '@/stores/useUIStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { useProjectsStore } from '@/stores/useProjectsStore';
import { cn } from '@/lib/utils';

export function Header() {
  const isSidebarOpen = useUIStore((s) => s.isSidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const isRightSidebarOpen = useUIStore((s) => s.isRightSidebarOpen);
  const setRightSidebarOpen = useUIStore((s) => s.setRightSidebarOpen);
  const activeMainTab = useUIStore((s) => s.activeMainTab);
  const setActiveMainTab = useUIStore((s) => s.setActiveMainTab);

  const activeId = useSessionStore((s) => s.activeId);
  const sessions = useSessionStore((s) => s.sessions);
  const updateSession = useSessionStore((s) => s.update);
  const setViewMode = useSessionStore((s) => s.setViewMode);
  const active = sessions.find((s) => s.id === activeId);
  const viewMode = active?.viewMode ?? 'terminal';

  const projects = useProjectsStore((s) => s.projects);
  const activeProjectId = useProjectsStore((s) => s.activeProjectId);
  const addProject = useProjectsStore((s) => s.addProject);
  const activeProject = projects.find(
    (p) => p.id === (active?.projectId ?? activeProjectId)
  );

  const tabs: { key: MainTab; label: string; icon: typeof TerminalIcon }[] = [
    { key: 'terminal', label: 'Workspace', icon: TerminalIcon },
    { key: 'settings', label: 'Settings', icon: Settings },
  ];

  async function handleAddProject() {
    const dir = await window.api.fs.pickDirectory();
    if (!dir) return;
    addProject(dir);
  }

  function toggleSkip() {
    if (!active) return;
    // Toggling while running stores the new preference; the change takes
    // effect on the next spawn (close + reopen the session).
    updateSession(active.id, { skipPermissions: !active.skipPermissions });
  }

  return (
    <div className="drag-region flex h-12 shrink-0 items-center gap-1 border-b border-border bg-bg-subtle px-3">
      <div className="w-[70px]" />

      <button
        className="no-drag flex h-7 w-7 items-center justify-center rounded-md text-fg-muted hover:bg-bg-elevated hover:text-fg"
        onClick={() => setSidebarOpen(!isSidebarOpen)}
        title="Toggle sidebar"
      >
        <PanelLeft size={16} />
      </button>

      <div className="mx-2 h-5 w-px bg-border" />

      <div className="no-drag flex items-center gap-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveMainTab(t.key)}
            className={cn(
              'flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium transition-colors',
              activeMainTab === t.key
                ? 'bg-accent-subtle text-accent'
                : 'text-fg-muted hover:bg-bg-elevated hover:text-fg'
            )}
          >
            <t.icon size={13} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="mx-2 h-5 w-px bg-border" />

      {activeProject ? (
        <div className="no-drag flex h-7 max-w-[320px] items-center gap-1.5 rounded-md bg-bg-elevated px-2 text-[12px]">
          <FolderOpen size={12} style={{ color: activeProject.color }} />
          <span className="truncate font-medium text-fg" title={activeProject.path}>
            {activeProject.name}
          </span>
          {active && (
            <>
              <span className="text-fg-subtle">/</span>
              <span className="truncate text-fg-muted">{active.title}</span>
            </>
          )}
        </div>
      ) : (
        <span className="text-[12px] text-fg-subtle">No project</span>
      )}

      <button
        onClick={handleAddProject}
        className="no-drag flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] text-fg-muted hover:bg-bg-elevated hover:text-fg"
        title="Add project"
      >
        <FolderPlus size={13} />
      </button>

      {active && (
        <div className="no-drag ml-3 inline-flex h-7 items-center gap-0 overflow-hidden rounded-md border border-border bg-bg-elevated p-0.5">
          <button
            onClick={() => setViewMode(active.id, 'terminal')}
            className={cn(
              'flex h-6 items-center gap-1.5 rounded-sm px-2 text-[11.5px] font-medium transition-colors',
              viewMode === 'terminal'
                ? 'bg-bg-panel text-fg'
                : 'text-fg-muted hover:text-fg'
            )}
            title="Terminal (TUI) — interactive claude code"
          >
            <TerminalIcon size={11} /> Terminal
          </button>
          <button
            onClick={() => setViewMode(active.id, 'chat')}
            className={cn(
              'flex h-6 items-center gap-1.5 rounded-sm px-2 text-[11.5px] font-medium transition-colors',
              viewMode === 'chat'
                ? 'bg-bg-panel text-fg'
                : 'text-fg-muted hover:text-fg'
            )}
            title="Chat — formatted markdown responses"
          >
            <MessageSquare size={11} /> Chat
          </button>
        </div>
      )}

      <div className="ml-auto flex items-center gap-1">
        <button
          onClick={toggleSkip}
          disabled={!active}
          className={cn(
            'no-drag flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium transition-colors disabled:opacity-50',
            active?.skipPermissions
              ? 'bg-warn/10 text-warn hover:bg-warn/15'
              : 'text-fg-muted hover:bg-bg-elevated hover:text-fg'
          )}
          title={
            active?.status === 'running'
              ? `Skip-perms is ${active.skipPermissions ? 'ON' : 'OFF'} for the live session — toggling applies on the next spawn (close + reopen the session)`
              : active?.skipPermissions
              ? 'Skip permissions ON — claude --dangerously-skip-permissions'
              : 'Skip permissions OFF'
          }
        >
          {active?.skipPermissions ? <ShieldOff size={13} /> : <Shield size={13} />}
          {active?.skipPermissions ? 'Skip perms' : 'Safe'}
        </button>

        <div className="mx-1 h-5 w-px bg-border" />

        <button
          onClick={() => setRightSidebarOpen(!isRightSidebarOpen)}
          className="no-drag flex h-7 w-7 items-center justify-center rounded-md text-fg-muted hover:bg-bg-elevated hover:text-fg"
          title="Toggle context panel"
        >
          <PanelRight size={16} />
        </button>
      </div>
    </div>
  );
}
