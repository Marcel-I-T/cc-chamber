import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Detects when preload bindings are present but main-process IPC handlers
 * are missing — typically happens when only the renderer was hot-reloaded
 * but main.mjs needs a full Electron restart. Renders a sticky banner.
 */
export function IpcHealthBanner() {
  const [missing, setMissing] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const probes: { name: string; fn: () => Promise<unknown> }[] = [
        { name: 'fs:list', fn: () => window.api?.fs?.list?.(getCwd()) },
        // claude:run we can't safely probe without spawning claude — skip.
      ];
      const out: string[] = [];
      for (const p of probes) {
        try {
          if (!p.fn) {
            out.push(`${p.name} (preload missing)`);
            continue;
          }
          const res = await p.fn();
          // ipcRenderer.invoke rejects with "No handler registered" if the
          // main process never wired it up.
          if (res === undefined) out.push(`${p.name} (no response)`);
        } catch (err) {
          const m = err instanceof Error ? err.message : String(err);
          if (m.includes('No handler') || m.includes('not available')) {
            out.push(p.name);
          }
        }
      }
      if (cancelled) return;
      setMissing(out);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!missing || missing.length === 0) return null;

  return (
    <div className="flex items-center gap-2 border-b border-warn/40 bg-warn/10 px-3 py-1.5 text-[11px] text-warn">
      <AlertTriangle size={12} />
      <span>
        Some Electron IPC handlers are missing ({missing.join(', ')}). Restart with{' '}
        <kbd className="rounded border border-warn/40 bg-bg-elevated px-1 font-mono">
          Ctrl+C
        </kbd>{' '}
        then{' '}
        <kbd className="rounded border border-warn/40 bg-bg-elevated px-1 font-mono">
          npm run dev
        </kbd>{' '}
        — Vite HMR doesn't reload <code className="font-mono">electron/main.mjs</code>.
      </span>
    </div>
  );
}

function getCwd() {
  // probe with home dir-ish path that always exists
  return '/';
}
