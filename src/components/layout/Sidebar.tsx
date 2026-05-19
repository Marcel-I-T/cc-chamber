import { useState } from 'react';
import {
  Plus,
  X,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  Folder,
  FolderOpen,
  Edit2,
  Trash2,
  Terminal as TerminalIcon,
  FolderPlus,
  GitBranch,
  Search,
  ArrowUpDown,
  Archive,
} from 'lucide-react';
import { useProjectsStore, type Project } from '@/stores/useProjectsStore';
import { useSessionStore, type Session } from '@/stores/useSessionStore';
import { PastSessionsList } from '@/components/session/PastSessionsList';
import { cn } from '@/lib/utils';

const statusDot = {
  idle: 'bg-fg-subtle',
  running: 'bg-ok',
  exited: 'bg-fg-muted',
  error: 'bg-err',
} as const;

export function Sidebar() {
  const projects = useProjectsStore((s) => s.projects);
  const addProject = useProjectsStore((s) => s.addProject);

  async function handleAddProject() {
    const dir = await window.api.fs.pickDirectory();
    if (!dir) return;
    addProject(dir);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Top toolbar — quick actions */}
      <div className="flex h-9 items-center gap-0.5 border-b border-border px-2">
        <SidebarToolBtn icon={FolderPlus} title="Add project" onClick={handleAddProject} />
        <SidebarToolBtn icon={GitBranch} title="New worktree (not wired)" disabled />
        <div className="mx-1 h-4 w-px bg-border" />
        <SidebarToolBtn icon={ArrowUpDown} title="Sort" disabled />
        <SidebarToolBtn icon={Search} title="Search sessions" disabled />
        <SidebarToolBtn icon={Archive} title="Show archived" disabled />
      </div>

      <div className="flex-1 overflow-y-auto p-1.5">
        {projects.length === 0 && (
          <div className="px-3 py-8 text-center text-[11.5px] text-fg-subtle">
            No projects yet
            <button
              onClick={handleAddProject}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border bg-bg-elevated px-2.5 py-1 text-[11px] text-fg-muted hover:bg-bg-panel hover:text-fg"
            >
              <Plus size={12} /> Add project
            </button>
          </div>
        )}

        {projects.map((p) => (
          <ProjectSection key={p.id} project={p} />
        ))}
      </div>

      <div className="border-t border-border px-3 py-2 text-[10.5px] text-fg-subtle">
        cc-chamber · claude-code wrapper
      </div>
    </div>
  );
}

function SidebarToolBtn({
  icon: Icon,
  title,
  onClick,
  disabled,
}: {
  icon: typeof Plus;
  title: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex h-6 w-6 items-center justify-center rounded text-fg-subtle hover:bg-bg-elevated hover:text-fg disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-fg-subtle"
    >
      <Icon size={13} />
    </button>
  );
}

function ProjectSection({ project }: { project: Project }) {
  const setActiveProject = useProjectsStore((s) => s.setActive);
  const toggleCollapsed = useProjectsStore((s) => s.toggleCollapsed);
  const removeProject = useProjectsStore((s) => s.removeProject);
  const renameProject = useProjectsStore((s) => s.renameProject);
  const activeProjectId = useProjectsStore((s) => s.activeProjectId);

  const allSessions = useSessionStore((s) => s.sessions);
  const sessions = allSessions.filter((x) => x.projectId === project.id);
  const removeByProject = useSessionStore((s) => s.removeByProject);
  const create = useSessionStore((s) => s.create);
  const defaultSkip = useSessionStore((s) => s.defaultSkipPermissions);

  const [showMenu, setShowMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(project.name);

  const isActive = activeProjectId === project.id;

  function handleNewSession() {
    setActiveProject(project.id);
    create({
      projectId: project.id,
      cwd: project.path,
      skipPermissions: defaultSkip,
      mode: 'claude',
    });
  }

  function commitRename() {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== project.name) {
      renameProject(project.id, trimmed);
    } else {
      setEditName(project.name);
    }
    setEditing(false);
  }

  function handleDelete() {
    if (sessions.length > 0) {
      const ok = confirm(
        `Delete project "${project.name}" and its ${sessions.length} session(s)?`
      );
      if (!ok) return;
    }
    removeByProject(project.id);
    removeProject(project.id);
    setShowMenu(false);
  }

  return (
    <div className="mb-1">
      <div
        className={cn(
          'group flex items-center gap-1 rounded-md px-1.5 py-1.5 text-[12px] transition-colors',
          isActive
            ? 'bg-accent-subtle text-fg'
            : 'text-fg-muted hover:bg-bg-elevated'
        )}
      >
        <button
          onClick={() => toggleCollapsed(project.id)}
          className="flex h-4 w-4 items-center justify-center text-fg-subtle hover:text-fg"
        >
          {project.collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        </button>

        <div
          className="flex h-4 w-4 shrink-0 items-center justify-center"
          style={{ color: project.color }}
        >
          {project.collapsed ? <Folder size={12} /> : <FolderOpen size={12} />}
        </div>

        {editing ? (
          <input
            autoFocus
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') {
                setEditName(project.name);
                setEditing(false);
              }
            }}
            className="flex-1 rounded border border-border bg-bg-elevated px-1 py-0.5 text-[12px] text-fg outline-none focus:border-accent"
          />
        ) : (
          <span
            onClick={() => setActiveProject(project.id)}
            onDoubleClick={() => setEditing(true)}
            className="flex-1 cursor-pointer truncate font-medium"
            title={project.path}
          >
            {project.name}
          </span>
        )}

        {!editing && sessions.length > 0 && (
          <span className="rounded bg-bg px-1 text-[9.5px] text-fg-subtle">
            {sessions.length}
          </span>
        )}

        {!editing && (
          <div className="relative flex opacity-0 transition-opacity group-hover:opacity-100">
            <button
              onClick={handleNewSession}
              className="flex h-5 w-5 items-center justify-center rounded text-fg-subtle hover:bg-bg-panel hover:text-fg"
              title="New session in this project"
            >
              <Plus size={11} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu((v) => !v);
              }}
              className="flex h-5 w-5 items-center justify-center rounded text-fg-subtle hover:bg-bg-panel hover:text-fg"
            >
              <MoreHorizontal size={11} />
            </button>
            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-6 z-20 min-w-[140px] overflow-hidden rounded-md border border-border bg-bg-panel py-1 shadow-xl">
                  <button
                    onClick={() => {
                      setEditing(true);
                      setShowMenu(false);
                    }}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11.5px] text-fg-muted hover:bg-bg-elevated hover:text-fg"
                  >
                    <Edit2 size={11} /> Rename
                  </button>
                  <button
                    onClick={handleDelete}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11.5px] text-err hover:bg-err/10"
                  >
                    <Trash2 size={11} /> Delete project
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {!project.collapsed && (
        <div className="ml-3 mt-0.5 border-l border-border-subtle pl-1.5">
          {sessions.length === 0 ? (
            <div className="px-1.5 py-2 text-[11px] text-fg-subtle">
              No sessions in this workspace yet.
            </div>
          ) : (
            sessions.map((s) => <SessionItem key={s.id} session={s} />)
          )}
          <PastSessionsList projectId={project.id} cwd={project.path} />
        </div>
      )}
    </div>
  );
}

function SessionItem({ session }: { session: Session }) {
  const activeId = useSessionStore((s) => s.activeId);
  const setActive = useSessionStore((s) => s.setActive);
  const remove = useSessionStore((s) => s.remove);
  const setActiveProject = useProjectsStore((s) => s.setActive);
  const isActive = activeId === session.id;

  return (
    <div
      onClick={() => {
        setActiveProject(session.projectId);
        setActive(session.id);
      }}
      className={cn(
        'group flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-[11.5px]',
        isActive
          ? 'bg-accent-subtle text-fg'
          : 'text-fg-muted hover:bg-bg-elevated hover:text-fg'
      )}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', statusDot[session.status])} />
      <TerminalIcon size={10} className="text-fg-subtle" />
      <span className="flex-1 truncate">{session.title}</span>
      {session.skipPermissions && (
        <span className="rounded bg-warn/10 px-1 text-[8.5px] font-semibold uppercase text-warn">
          skip
        </span>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          remove(session.id);
        }}
        className="hidden h-4 w-4 items-center justify-center rounded text-fg-subtle hover:bg-bg-panel hover:text-fg group-hover:flex"
        title="Close session"
      >
        <X size={10} />
      </button>
    </div>
  );
}
