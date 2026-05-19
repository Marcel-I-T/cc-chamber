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

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: 'JetBrains Mono, SF Mono, Menlo, monospace',
      fontSize: 13,
      lineHeight: 1.2,
      letterSpacing: 0,
      allowProposedApi: true,
      theme: THEME,
      scrollback: 5000,
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

      // Make sure xterm has its real size before we spawn. claude's TUI
      // captures the dimensions at startup and uses them to lay out prompts;
      // spawning at the default 80x24 and resizing afterwards leaves some
      // ink overlays sized to the small grid and they render off-screen.
      try {
        fitRef.current?.fit();
      } catch {}

      const initialCols = Math.max(term.cols, 80);
      const initialRows = Math.max(term.rows, 24);

      // Now spawn the PTY. Any output is already wired up.
      const res = await window.api.pty.spawn({
        sessionId,
        cwd: session.cwd,
        skipPermissions: session.skipPermissions,
        mode: session.mode,
        resume: session.resumeOnRespawn,
        cols: initialCols,
        rows: initialRows,
      });

      if (cancelled) return;

      if (!res.ok) {
        term.write(`\r\n\x1b[31m[cc-chamber] failed to spawn: ${res.error}\x1b[0m\r\n`);
        update(sessionId, { status: 'error' });
        return;
      }

      // After any successful spawn, mark the session to resume on subsequent
      // ones — that way the next reload picks up the conversation.
      update(sessionId, { resumeOnRespawn: true });

      const cmdLine = `${res.bin}${res.args?.length ? ' ' + res.args.join(' ') : ''}`;
      term.write(
        `\x1b[2m[cc-chamber] $ ${cmdLine}\r\n[cc-chamber] cwd: ${session.cwd}\r\n[cc-chamber] pid: ${res.pid}\x1b[0m\r\n`
      );

      update(sessionId, { status: 'running', pid: res.pid });

      inputDisposable = term.onData((data) => {
        window.api.pty.write(sessionId, data);
      });
      resizeDisposable = term.onResize(({ cols, rows }) => {
        window.api.pty.resize(sessionId, cols, rows);
      });

      // Send initial size
      window.api.pty.resize(sessionId, term.cols, term.rows);
    })();

    return () => {
      cancelled = true;
      offData?.();
      offExit?.();
      inputDisposable?.dispose();
      resizeDisposable?.dispose();
      window.api.pty.kill(sessionId).catch(() => {});
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
