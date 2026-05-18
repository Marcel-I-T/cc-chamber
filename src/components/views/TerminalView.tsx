import { Plus, FolderPlus } from 'lucide-react';
import { useSessionStore, type Session } from '@/stores/useSessionStore';
import { useProjectsStore } from '@/stores/useProjectsStore';
import { TerminalPane } from '@/components/terminal/TerminalPane';
import { EmptyHero } from './EmptyHero';

const HINTS = [
  'Add type definitions...',
  'Refactor this module...',
  'Fix the failing tests...',
  'Document the API...',
  'Implement /undo and /redo',
  'Build a CLI for...',
];

export function TerminalView() {
  const sessions = useSessionStore((s) => s.sessions);
  const activeId = useSessionStore((s) => s.activeId);
  const create = useSessionStore((s) => s.create);
  const defaultSkip = useSessionStore((s) => s.defaultSkipPermissions);

  const projects = useProjectsStore((s) => s.projects);
  const activeProjectId = useProjectsStore((s) => s.activeProjectId);
  const addProject = useProjectsStore((s) => s.addProject);
  const activeProject = projects.find((p) => p.id === activeProjectId);

  async function handleAddProject() {
    const dir = await window.api.fs.pickDirectory();
    if (!dir) return;
    addProject(dir);
  }

  function handleNewSession() {
    if (!activeProject) return;
    create({
      projectId: activeProject.id,
      cwd: activeProject.path,
      mode: 'claude',
      skipPermissions: defaultSkip,
    });
  }

  if (projects.length === 0) {
    return (
      <div className="relative flex h-full flex-col items-center justify-center">
        <EmptyHero hint="Pick a folder to get started…" />
        <button
          onClick={handleAddProject}
          className="absolute bottom-10 inline-flex items-center gap-1.5 rounded-md border border-border bg-bg-elevated px-3 py-1.5 text-[12px] text-fg hover:bg-bg-panel"
        >
          <FolderPlus size={13} /> Add project
        </button>
      </div>
    );
  }

  if (sessions.length === 0) {
    const hint = HINTS[Math.floor(Math.random() * HINTS.length)];
    return (
      <div className="relative flex h-full flex-col items-center justify-center">
        <EmptyHero hint={hint} />
        <button
          onClick={handleNewSession}
          className="absolute bottom-10 inline-flex items-center gap-1.5 rounded-md border border-border bg-bg-elevated px-3 py-1.5 text-[12px] text-fg hover:bg-bg-panel"
        >
          <Plus size={13} /> New session in {activeProject?.name}
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-bg">
      {sessions.map((s) => (
        <TerminalPane key={s.id} session={s} isActive={s.id === activeId} />
      ))}
    </div>
  );
}

export type { Session };
