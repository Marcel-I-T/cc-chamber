import { useSessionStore } from '@/stores/useSessionStore';
import { cn } from '@/lib/utils';

const statusColor = {
  idle: 'bg-fg-subtle',
  running: 'bg-ok',
  exited: 'bg-fg-muted',
  error: 'bg-err',
} as const;

export function BottomDock() {
  const activeId = useSessionStore((s) => s.activeId);
  const sessions = useSessionStore((s) => s.sessions);
  const active = sessions.find((s) => s.id === activeId);

  return (
    <div className="flex h-7 shrink-0 items-center gap-3 border-t border-border bg-bg-subtle px-3 text-[11px] text-fg-muted">
      {active ? (
        <>
          <div className="flex items-center gap-1.5">
            <span className={cn('h-2 w-2 rounded-full', statusColor[active.status])} />
            <span className="capitalize">{active.status}</span>
          </div>
          <span className="text-fg-subtle">·</span>
          <span>{active.mode === 'claude' ? 'claude' : 'shell'}</span>
          {active.skipPermissions && (
            <>
              <span className="text-fg-subtle">·</span>
              <span className="text-warn">--dangerously-skip-permissions</span>
            </>
          )}
          <span className="ml-auto truncate font-mono text-[10.5px] text-fg-subtle">
            {active.cwd}
          </span>
        </>
      ) : (
        <span>no session</span>
      )}
    </div>
  );
}
