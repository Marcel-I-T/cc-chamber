import { useState } from 'react';
import { GitBranch, Files, Search, Plus, RefreshCw } from 'lucide-react';
import { useProjectsStore } from '@/stores/useProjectsStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { FileTree } from '@/components/files/FileTree';
import { cn } from '@/lib/utils';

type Tab = 'git' | 'files';

export function RightSidebar() {
  const activeId = useSessionStore((s) => s.activeId);
  const sessions = useSessionStore((s) => s.sessions);
  const active = sessions.find((s) => s.id === activeId);

  const projects = useProjectsStore((s) => s.projects);
  const activeProjectId = useProjectsStore((s) => s.activeProjectId);
  const project = projects.find(
    (p) => p.id === (active?.projectId ?? activeProjectId)
  );

  const [tab, setTab] = useState<Tab>('files');
  const [filter, setFilter] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="flex h-full flex-col">
      {/* Tab header */}
      <div className="flex h-9 items-center gap-0.5 border-b border-border px-2">
        <TabBtn
          icon={GitBranch}
          label="git"
          active={tab === 'git'}
          onClick={() => setTab('git')}
        />
        <TabBtn
          icon={Files}
          label="files"
          active={tab === 'files'}
          onClick={() => setTab('files')}
        />
        <div className="ml-auto flex items-center gap-0.5">
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            title="Refresh"
            className="flex h-6 w-6 items-center justify-center rounded text-fg-subtle hover:bg-bg-elevated hover:text-fg"
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {tab === 'files' && (
        <>
          {/* Search bar */}
          <div className="flex items-center gap-1.5 border-b border-border px-2 py-2">
            <div className="flex h-7 flex-1 items-center gap-1.5 rounded-md border border-border bg-bg-elevated px-2">
              <Search size={11} className="text-fg-subtle" />
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search files..."
                className="flex-1 bg-transparent text-[11.5px] text-fg outline-none placeholder:text-fg-subtle"
              />
            </div>
            <button
              title="New file (not wired)"
              className="flex h-7 w-7 items-center justify-center rounded text-fg-subtle hover:bg-bg-elevated hover:text-fg"
              disabled
            >
              <Plus size={12} />
            </button>
          </div>

          {/* Tree */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {project ? (
              <FileTree key={`${project.id}-${refreshKey}`} rootPath={project.path} filter={filter} />
            ) : (
              <div className="px-3 py-6 text-center text-[11px] text-fg-subtle">
                No project selected
              </div>
            )}
          </div>

          {/* Footer: project path */}
          <div className="border-t border-border px-2 py-1.5 font-mono text-[10px] text-fg-subtle">
            {project?.path}
          </div>
        </>
      )}

      {tab === 'git' && (
        <div className="flex min-h-0 flex-1 flex-col">
          {active ? (
            <div className="flex-1 overflow-y-auto p-3 text-[12px]">
              <dl className="space-y-3">
                <Row label="Session" value={active.title} />
                <Row label="Status" value={active.status} />
                <Row label="PID" value={active.pid?.toString() ?? '—'} />
                <Row label="CWD" value={active.cwd || '—'} mono />
                <Row
                  label="Permissions"
                  value={active.skipPermissions ? 'skip (dangerous)' : 'safe'}
                />
                {active.exitCode !== undefined && (
                  <Row label="Exit" value={String(active.exitCode)} />
                )}
              </dl>
              <div className="mt-6 rounded-md border border-border bg-bg-elevated p-3 text-[11px] text-fg-subtle">
                Git integration (branches, commits, diffs) comes in a follow-up — for now
                this tab shows session info.
              </div>
            </div>
          ) : (
            <div className="p-3 text-[11px] text-fg-subtle">No active session</div>
          )}
        </div>
      )}
    </div>
  );
}

function TabBtn({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof GitBranch;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11.5px] font-medium transition-colors',
        active
          ? 'bg-bg-elevated text-fg'
          : 'text-fg-muted hover:bg-bg-elevated hover:text-fg'
      )}
    >
      <Icon size={12} />
      {label}
    </button>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">
        {label}
      </dt>
      <dd className={mono ? 'font-mono text-[11.5px] text-fg break-all' : 'text-fg'}>
        {value}
      </dd>
    </div>
  );
}
