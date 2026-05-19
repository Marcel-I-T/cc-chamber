import { useEffect, useState } from 'react';
import { ChevronRight, ChevronDown, History, RefreshCw } from 'lucide-react';
import type { PastSession } from '@/types/api';
import { useSessionStore } from '@/stores/useSessionStore';
import { useProjectsStore } from '@/stores/useProjectsStore';
import { cn } from '@/lib/utils';

interface Props {
  projectId: string;
  cwd: string;
}

const MAX_VISIBLE_COLLAPSED = 4;

export function PastSessionsList({ projectId, cwd }: Props) {
  const [sessions, setSessions] = useState<PastSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const create = useSessionStore((s) => s.create);
  const defaultSkip = useSessionStore((s) => s.defaultSkipPermissions);
  const setActiveProject = useProjectsStore((s) => s.setActive);

  async function load() {
    if (!window.api?.claude?.listSessions) return;
    setLoading(true);
    try {
      const res = await window.api.claude.listSessions({ cwd });
      if (res.ok) setSessions(res.sessions ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open && sessions.length === 0) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function resumeSession(s: PastSession) {
    setActiveProject(projectId);
    const title =
      s.title?.trim() ||
      s.firstUserPrompt?.trim().slice(0, 60) ||
      `Resumed ${s.sessionId.slice(0, 8)}`;
    create({
      projectId,
      cwd,
      mode: 'claude',
      skipPermissions: defaultSkip,
      title: `↻ ${title}`,
    });
    // The create() above sets the new session active. Now patch in the
    // resumeSessionId so the spawn passes --resume <id>.
    const newSessionId = useSessionStore.getState().activeId;
    if (newSessionId) {
      useSessionStore.getState().update(newSessionId, {
        resumeSessionId: s.sessionId,
      });
    }
  }

  const visible = showAll ? sessions : sessions.slice(0, MAX_VISIBLE_COLLAPSED);

  return (
    <div className="mt-1">
      <div className="group flex items-center gap-1 px-1.5 py-1 text-[10.5px] uppercase tracking-wide text-fg-subtle">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1 hover:text-fg"
          title="Past claude sessions in this folder"
        >
          {open ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
          <History size={9} />
          Past
          {sessions.length > 0 && (
            <span className="ml-0.5 normal-case text-fg-subtle">· {sessions.length}</span>
          )}
        </button>
        {open && (
          <button
            onClick={load}
            disabled={loading}
            className="ml-auto flex h-4 w-4 items-center justify-center rounded text-fg-subtle opacity-0 hover:bg-bg-elevated hover:text-fg group-hover:opacity-100 disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={9} className={loading ? 'animate-spin' : ''} />
          </button>
        )}
      </div>

      {open && (
        <div>
          {loading && sessions.length === 0 && (
            <div className="px-2 py-1 text-[10.5px] text-fg-subtle">loading…</div>
          )}
          {!loading && sessions.length === 0 && (
            <div className="px-2 py-1 text-[10.5px] text-fg-subtle">
              No past sessions
            </div>
          )}
          {visible.map((s) => (
            <PastSessionRow key={s.sessionId} summary={s} onResume={resumeSession} />
          ))}
          {sessions.length > MAX_VISIBLE_COLLAPSED && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="block w-full px-2 py-1 text-left text-[10px] text-fg-subtle hover:text-fg"
            >
              {showAll
                ? '× show fewer'
                : `+ show ${sessions.length - MAX_VISIBLE_COLLAPSED} more`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function PastSessionRow({
  summary,
  onResume,
}: {
  summary: PastSession;
  onResume: (s: PastSession) => void;
}) {
  const title =
    summary.title ||
    summary.firstUserPrompt ||
    summary.sessionId.slice(0, 8);
  const subtitle = relativeTime(summary.mtime);

  return (
    <button
      onClick={() => onResume(summary)}
      className={cn(
        'group block w-full rounded-md px-1.5 py-1 text-left text-[11px] text-fg-muted hover:bg-bg-elevated hover:text-fg',
      )}
      title={`${summary.sessionId} · ${summary.messageCount} messages`}
    >
      <div className="truncate text-fg">{title}</div>
      <div className="truncate text-[9.5px] text-fg-subtle">
        {subtitle} · {summary.messageCount} msgs
      </div>
    </button>
  );
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  const date = new Date(ts);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
