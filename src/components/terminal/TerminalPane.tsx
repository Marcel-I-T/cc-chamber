import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { useSessionStore, type Session } from '@/stores/useSessionStore';
import { cn } from '@/lib/utils';

const THEME = {
  background: '#0d0d10',
  foreground: '#e8e8ec',
  cursor: '#a78bfa',
  cursorAccent: '#0d0d10',
  selectionBackground: '#3a2f5c',
  black: '#1a1a20',
  red: '#f06b6b',
  green: '#65d99d',
  yellow: '#f5b961',
  blue: '#7aa2ff',
  magenta: '#c084fc',
  cyan: '#67e8f9',
  white: '#e8e8ec',
  brightBlack: '#3a3a45',
  brightRed: '#ff8a8a',
  brightGreen: '#86efac',
  brightYellow: '#fcd34d',
  brightBlue: '#93c5fd',
  brightMagenta: '#d8b4fe',
  brightCyan: '#a5f3fc',
  brightWhite: '#ffffff',
};

interface Props {
  session: Session;
  isActive: boolean;
}

export function TerminalPane({ session, isActive }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const update = useSessionStore((s) => s.update);

  // Init xterm once
  useEffect(() => {
    if (!containerRef.current || termRef.current) return;

    // Menlo first: macOS-built-in so the cell metrics are correct on first
    // render. Without that, xterm.fit() can return wrong cols/rows and ink
    // (claude's TUI engine) positions choice prompts off-screen.
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: 'Menlo, "SF Mono", "JetBrains Mono", Monaco, "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.2,
      letterSpacing: 0,
      allowProposedApi: true,
      theme: THEME,
      scrollback: 5000,
      convertEol: false,
      cursorStyle: 'block',
    });
    const fit = new FitAddon();
    const links = new WebLinksAddon();
    term.loadAddon(fit);
    term.loadAddon(links);
    term.open(containerRef.current);

    termRef.current = term;
    fitRef.current = fit;

    requestAnimationFrame(() => {
      try { fit.fit(); } catch {}
    });

    const ro = new ResizeObserver(() => {
      try { fit.fit(); } catch {}
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, []);

  // Spawn PTY + wire events
  useEffect(() => {
    if (!termRef.current) return;
    if (!session.cwd) return; // wait until cwd is set

    const term = termRef.current;
    const sessionId = session.id;
    let cancelled = false;

    let offData: (() => void) | null = null;
    let offExit: (() => void) | null = null;
    let inputDisposable: { dispose: () => void } | null = null;
    let resizeDisposable: { dispose: () => void } | null = null;

    (async () => {
      // Defensive: if preload didn't load for some reason, surface that
      // instead of throwing on a null `window.api` (which would silently
      // unmount this pane via React's error boundary up the tree).
      if (!window.api?.pty) {
        term.write(
          '\x1b[31m[cc-chamber] preload bridge unavailable — restart Electron with `Ctrl+C && npm run dev`.\x1b[0m\r\n',
        );
        update(sessionId, { status: 'error' });
        return;
      }

      // Subscribe BEFORE spawn so we never miss output if the process exits fast.
      offData = window.api.pty.onData(sessionId, (data) => {
        term.write(data);
      });
      offExit = window.api.pty.onExit(sessionId, ({ exitCode }) => {
        const hint =
          exitCode === 127
            ? ' (command not found — check claude binary path in Settings)'
            : exitCode === 126
            ? ' (permission denied)'
            : exitCode !== 0
            ? ' — try in a terminal: see what the error is'
            : '';
        term.write(
          `\r\n\x1b[33m[cc-chamber] process exited (${exitCode})${hint}\x1b[0m\r\n`
        );
        update(sessionId, { status: 'exited', exitCode });
      });

      // First try to reattach to a live PTY (e.g. after a Cmd+R renderer
      // reload). If it exists, replay the buffered output so the screen
      // looks exactly as it did before the reload — no claude restart.
      let reattached = false;
      let resInfo = null;

      if (window.api?.pty?.attach) {
        const att = await window.api.pty.attach(sessionId);
        if (att.ok && att.exists) {
          term.write(att.replay ?? '');
          reattached = true;
          resInfo = { bin: att.bin, args: att.args, pid: att.pid };
        }
      }

      if (!reattached) {
        // Make sure xterm has its real size before we spawn. claude's TUI
        // captures the dimensions at startup and uses them to lay out
        // prompts; spawning at the default 80x24 and resizing afterwards
        // leaves ink overlays sized to the small grid and they render
        // off-screen.
        try {
          fitRef.current?.fit();
        } catch {}

        const initialCols = Math.max(term.cols, 80);
        const initialRows = Math.max(term.rows, 24);

        const res = await window.api.pty.spawn({
          sessionId,
          cwd: session.cwd,
          skipPermissions: session.skipPermissions,
          mode: session.mode,
          resume: session.resumeOnRespawn,
          resumeSessionId: session.resumeSessionId,
          cols: initialCols,
          rows: initialRows,
        });

        if (cancelled) return;

        if (!res.ok) {
          term.write(`\r\n\x1b[31m[cc-chamber] failed to spawn: ${res.error}\x1b[0m\r\n`);
          update(sessionId, { status: 'error' });
          return;
        }

        if (res.reattached && res.replay) {
          term.write(res.replay);
        } else {
          const cmdLine = `${res.bin}${res.args?.length ? ' ' + res.args.join(' ') : ''}`;
          term.write(
            `\x1b[2m[cc-chamber] $ ${cmdLine}\r\n[cc-chamber] cwd: ${session.cwd}\r\n[cc-chamber] pid: ${res.pid}\x1b[0m\r\n`,
          );
        }

        // Mark for future reloads + clear one-shot resume id.
        update(sessionId, { resumeOnRespawn: true, resumeSessionId: undefined });
        resInfo = { bin: res.bin, args: res.args, pid: res.pid };
      }

      update(sessionId, { status: 'running', pid: resInfo?.pid });

      inputDisposable = term.onData((data) => {
        window.api.pty.write(sessionId, data);
      });
      resizeDisposable = term.onResize(({ cols, rows }) => {
        window.api.pty.resize(sessionId, cols, rows);
      });

      // Push current size to the (possibly long-lived) PTY so it has the
      // right ioctl after the renderer reattaches.
      window.api.pty.resize(sessionId, term.cols, term.rows);
    })();

    return () => {
      cancelled = true;
      offData?.();
      offExit?.();
      inputDisposable?.dispose();
      resizeDisposable?.dispose();
      // Intentionally NOT killing the PTY here. Renderer unmount can happen
      // on Cmd+R reloads where we want the shell to survive — the next mount
      // calls pty:attach and replays the buffered output. Explicit "close
      // session" actions in the sidebar call window.api.pty.kill() directly.
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id, session.cwd]);

  // Refit + focus when activated
  useEffect(() => {
    if (!isActive) return;
    const t = setTimeout(() => {
      try { fitRef.current?.fit(); } catch {}
      termRef.current?.focus();
    }, 0);
    return () => clearTimeout(t);
  }, [isActive]);

  return (
    <div
      className={cn(
        'absolute inset-0 h-full w-full',
        isActive ? 'visible z-10' : 'invisible z-0'
      )}
      onMouseDown={() => termRef.current?.focus()}
    >
      <div
        ref={containerRef}
        tabIndex={0}
        onFocus={() => termRef.current?.focus()}
        className="h-full w-full outline-none"
      />
    </div>
  );
}
