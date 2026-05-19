import { useEffect, useRef, useState } from 'react';
import {
  Send,
  ChevronDown,
  ChevronUp,
  Plus,
  Maximize2,
  Sparkles,
  Hammer,
  Shield,
  ShieldOff,
  Slash,
  Trash2,
  Settings2,
  HelpCircle,
  RefreshCcw,
  FileText,
  Layers,
  Folder,
  GitBranch,
  Bot,
} from 'lucide-react';
import { useSessionStore } from '@/stores/useSessionStore';
import { useProjectsStore } from '@/stores/useProjectsStore';
import { useChatStore } from '@/stores/useChatStore';
import { cn } from '@/lib/utils';

type Model = 'default' | 'sonnet' | 'opus';
type Mode = 'plan' | 'build';

const MODELS: { key: Model; label: string }[] = [
  { key: 'default', label: 'Default' },
  { key: 'sonnet', label: 'Sonnet' },
  { key: 'opus', label: 'Opus' },
];

const SLASH_COMMANDS = [
  { cmd: 'clear', label: 'Clear context', icon: Trash2 },
  { cmd: 'compact', label: 'Compact history', icon: Layers },
  { cmd: 'init', label: 'Init project (CLAUDE.md)', icon: FileText },
  { cmd: 'permissions', label: 'Permissions', icon: Settings2 },
  { cmd: 'help', label: 'Help', icon: HelpCircle },
  { cmd: 'doctor', label: 'Doctor', icon: RefreshCcw },
] as const;

export function BottomComposer() {
  const activeId = useSessionStore((s) => s.activeId);
  const sessions = useSessionStore((s) => s.sessions);
  const updateSession = useSessionStore((s) => s.update);
  const active = sessions.find((s) => s.id === activeId);
  const viewMode = active?.viewMode ?? 'terminal';

  const appendMessage = useChatStore((s) => s.appendMessage);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const setClaudeSessionId = useChatStore((s) => s.setClaudeSessionId);
  const thread = useChatStore((s) => (active ? s.threads[active.id] : undefined));

  const projects = useProjectsStore((s) => s.projects);
  const activeProjectId = useProjectsStore((s) => s.activeProjectId);
  const project = projects.find(
    (p) => p.id === (active?.projectId ?? activeProjectId)
  );

  const [text, setText] = useState('');
  const [model, setModel] = useState<Model>('default');
  const [mode, setMode] = useState<Mode>('build');
  const [modelOpen, setModelOpen] = useState(false);
  const [slashOpen, setSlashOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // For chat mode we just need an active session — no PTY required.
  const canSend =
    !!active &&
    text.trim().length > 0 &&
    (viewMode === 'chat' || active.status === 'running');
  const disabled =
    !active || (viewMode !== 'chat' && active.status !== 'running');

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const max = fullscreen ? 600 : 200;
    el.style.height = Math.min(el.scrollHeight, max) + 'px';
  }, [text, fullscreen]);

  async function writeToPty(data: string) {
    if (!active) return;
    await window.api.pty.write(active.id, data);
  }

  function insertIntoTextarea(snippet: string) {
    const el = textareaRef.current;
    if (!el) {
      setText((t) => (t ? t + ' ' + snippet : snippet));
      return;
    }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const before = text.slice(0, start);
    const after = text.slice(end);
    // Add a space before snippet if needed, and after if more text follows.
    const needsLeadSpace = before.length > 0 && !/\s$/.test(before);
    const needsTrailSpace = after.length > 0 && !/^\s/.test(after);
    const insert =
      (needsLeadSpace ? ' ' : '') + snippet + (needsTrailSpace ? ' ' : '');
    const next = before + insert + after;
    setText(next);
    // Restore caret after the inserted snippet, on next tick (after React updates value).
    requestAnimationFrame(() => {
      const pos = (before + insert).length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  async function handleAttach() {
    if (!window.api?.fs?.pickFiles) return;
    const defaultPath = active?.cwd;
    const files = await window.api.fs.pickFiles({ multi: true, defaultPath });
    if (!files?.length) return;
    // Quote any path that contains whitespace so claude's tools can resolve it.
    const snippet = files
      .map((p) => (/\s/.test(p) ? `"${p}"` : p))
      .join(' ');
    insertIntoTextarea(snippet);
  }

  async function handleSend() {
    if (!canSend || !active) return;
    const value = text;
    setText('');

    if (viewMode === 'chat') {
      await sendChat(value);
    } else {
      await writeToPty(value + '\r');
    }
  }

  async function sendChat(value: string) {
    if (!active) return;
    appendMessage(active.id, { role: 'user', content: value });
    const pending = appendMessage(active.id, {
      role: 'assistant',
      content: '',
      pending: true,
    });

    if (!window.api?.claude?.run) {
      updateMessage(active.id, pending.id, {
        pending: false,
        error: 'claude:run IPC not available — restart Electron (Ctrl+C, then `npm run dev`)',
      });
      return;
    }

    let res;
    try {
      res = await window.api.claude.run({
        message: value,
        cwd: active.cwd,
        sessionId: thread?.claudeSessionId,
        model,
        skipPermissions: active.skipPermissions,
      });
    } catch (err) {
      updateMessage(active.id, pending.id, {
        pending: false,
        error: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    if (!res.ok) {
      updateMessage(active.id, pending.id, {
        pending: false,
        error: res.error ?? `claude exited with code ${res.code}`,
        content: (res.stderr || res.stdout || '').slice(0, 2000),
      });
      return;
    }

    const parsed = res.parsed;
    const content =
      parsed?.result?.toString() ??
      res.stdout?.trim() ??
      '(no response)';

    updateMessage(active.id, pending.id, {
      pending: false,
      content,
      durationMs: parsed?.duration_ms,
      costUsd: parsed?.total_cost_usd,
      error: parsed?.is_error ? 'claude reported is_error=true' : undefined,
    });

    if (parsed?.session_id) {
      setClaudeSessionId(active.id, parsed.session_id);
    }
  }

  async function pickModel(m: Model) {
    setModel(m);
    setModelOpen(false);
    if (!active) return;
    await writeToPty(`/model ${m}\r`);
  }

  async function togglePlanBuild() {
    setMode((prev) => (prev === 'plan' ? 'build' : 'plan'));
    await writeToPty('\x1b[Z'); // Shift+Tab toggles plan/build mode in claude
  }

  function toggleSkipPerms() {
    if (!active) return;
    // Toggling while a terminal session is running just stores the new
    // preference; it takes effect on the next spawn (close + reopen).
    // In chat mode every send is a fresh spawn, so it applies immediately.
    updateSession(active.id, { skipPermissions: !active.skipPermissions });
  }

  async function runSlash(cmd: string) {
    setSlashOpen(false);
    await writeToPty(`/${cmd}\r`);
  }

  function onTextareaKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="shrink-0 border-t border-border bg-bg-subtle">
      {/* Top row: project context + branch */}
      <div className="flex items-center gap-2 px-3 pt-2 text-[11px] text-fg-muted">
        <button
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-bg-elevated hover:text-fg"
          title={project?.path}
        >
          <Folder size={11} style={{ color: project?.color }} />
          <span className="truncate font-medium">{project?.name ?? 'No project'}</span>
          <ChevronDown size={9} className="text-fg-subtle" />
        </button>
        <span className="text-fg-subtle">·</span>
        <button
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-bg-elevated hover:text-fg"
          title="Git branch (not yet wired)"
        >
          <GitBranch size={11} />
          <span>main</span>
          <ChevronDown size={9} className="text-fg-subtle" />
        </button>
        <div className="ml-auto text-[10px] text-fg-subtle">
          {viewMode === 'chat'
            ? thread?.claudeSessionId
              ? `resuming · ${thread.claudeSessionId.slice(0, 8)}`
              : 'fresh chat'
            : active?.status === 'running'
            ? 'connected'
            : active?.status === 'exited'
            ? 'session exited'
            : active?.status === 'error'
            ? 'error'
            : 'idle'}
        </div>
      </div>

      {/* Textarea */}
      <div className="px-3 pt-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onTextareaKey}
          disabled={disabled}
          placeholder={
            !active
              ? 'No active session'
              : viewMode === 'chat'
              ? 'Message claude…  (Enter to send · Shift+Enter for newline)'
              : active.status !== 'running'
              ? `Session ${active.status} — start a new session to chat`
              : 'Message claude…  (Enter to send · Shift+Enter for newline)'
          }
          rows={1}
          className={cn(
            'block w-full resize-none rounded-md border border-border bg-bg-elevated px-3 py-2 font-sans text-[13px] leading-[1.45] text-fg outline-none placeholder:italic placeholder:text-fg-subtle focus:border-accent disabled:opacity-50'
          )}
          style={{ minHeight: 36 }}
        />
      </div>

      {/* Bottom action row */}
      <div className="flex items-center gap-1 px-3 pb-2 pt-2">
        <IconBtn
          title="Attach files — inserts the absolute paths into the message"
          icon={Plus}
          onClick={handleAttach}
          disabled={!active}
        />
        <IconBtn
          title={fullscreen ? 'Shrink composer' : 'Expand composer'}
          icon={Maximize2}
          onClick={() => setFullscreen((v) => !v)}
        />

        {/* Plan/Build (terminal mode only — TUI keybinding) */}
        {viewMode === 'terminal' && (
        <button
          onClick={togglePlanBuild}
          disabled={disabled}
          className={cn(
            'flex h-6 items-center gap-1 rounded-md border px-2 text-[11px] font-medium disabled:opacity-50',
            mode === 'plan'
              ? 'border-accent/40 bg-accent/10 text-accent'
              : 'border-border bg-bg-elevated text-fg-muted hover:bg-bg-panel hover:text-fg'
          )}
          title={`Toggle ${mode === 'plan' ? 'Build' : 'Plan'} mode (Shift+Tab in TUI)`}
        >
          {mode === 'plan' ? <Sparkles size={11} /> : <Hammer size={11} />}
          {mode === 'plan' ? 'Plan' : 'Build'}
        </button>
        )}

        {/* Skip perms — pre-spawn in terminal mode, per-call in chat */}
        <button
          onClick={toggleSkipPerms}
          disabled={!active}
          className={cn(
            'flex h-6 items-center gap-1 rounded-md border px-2 text-[11px] font-medium disabled:opacity-50',
            active?.skipPermissions
              ? 'border-warn/40 bg-warn/10 text-warn'
              : 'border-border bg-bg-elevated text-fg-muted hover:bg-bg-panel hover:text-fg'
          )}
          title={
            viewMode === 'chat'
              ? 'Toggle --dangerously-skip-permissions (applies to next chat send)'
              : active?.status === 'running'
              ? 'Toggle --dangerously-skip-permissions — takes effect on next spawn (close + reopen the session)'
              : 'Toggle --dangerously-skip-permissions for new spawns'
          }
        >
          {active?.skipPermissions ? <ShieldOff size={11} /> : <Shield size={11} />}
          {active?.skipPermissions ? 'Skip' : 'Safe'}
        </button>

        {/* Slash menu — only useful in terminal mode */}
        {viewMode === 'terminal' && (
        <div className="relative">
          <button
            onClick={() => setSlashOpen((v) => !v)}
            disabled={disabled}
            className={cn(
              'flex h-6 items-center gap-1 rounded-md border border-border bg-bg-elevated px-2 text-[11px] font-medium text-fg-muted hover:bg-bg-panel hover:text-fg disabled:opacity-50',
              slashOpen && 'bg-bg-panel'
            )}
            title="Slash commands"
          >
            <Slash size={10} />
            <ChevronUp size={10} />
          </button>
          {slashOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setSlashOpen(false)} />
              <div className="absolute bottom-7 left-0 z-20 min-w-[210px] overflow-hidden rounded-md border border-border bg-bg-panel py-1 shadow-xl">
                {SLASH_COMMANDS.map((c) => (
                  <button
                    key={c.cmd}
                    onClick={() => runSlash(c.cmd)}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11.5px] text-fg-muted hover:bg-bg-elevated hover:text-fg"
                  >
                    <c.icon size={11} className="text-fg-subtle" />
                    <span className="flex-1">{c.label}</span>
                    <span className="font-mono text-[10px] text-fg-subtle">/{c.cmd}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        )}

        <div className="ml-auto flex items-center gap-1">
          {/* Model / Agent selector */}
          <div className="relative">
            <button
              onClick={() => setModelOpen((v) => !v)}
              disabled={disabled}
              className={cn(
                'flex h-7 items-center gap-1.5 rounded-md border border-border bg-bg-elevated px-2.5 text-[11.5px] font-medium text-fg hover:bg-bg-panel disabled:opacity-50',
                modelOpen && 'bg-bg-panel'
              )}
              title="Switch model"
            >
              <Bot size={12} className="text-accent" />
              {MODELS.find((m) => m.key === model)?.label}
              <ChevronUp size={10} className="text-fg-subtle" />
            </button>
            {modelOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setModelOpen(false)} />
                <div className="absolute bottom-8 right-0 z-20 min-w-[150px] overflow-hidden rounded-md border border-border bg-bg-panel py-1 shadow-xl">
                  {MODELS.map((m) => (
                    <button
                      key={m.key}
                      onClick={() => pickModel(m.key)}
                      className={cn(
                        'flex w-full items-center justify-between px-2.5 py-1.5 text-left text-[11.5px] hover:bg-bg-elevated',
                        m.key === model ? 'text-accent' : 'text-fg-muted'
                      )}
                    >
                      {m.label}
                      {m.key === model && <span className="text-[9px]">●</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button
            onClick={handleSend}
            disabled={!canSend}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
              canSend
                ? 'bg-accent text-bg hover:bg-accent-hover'
                : 'bg-bg-elevated text-fg-subtle'
            )}
            title="Send (Enter)"
          >
            <Send size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

function IconBtn({
  title,
  icon: Icon,
  onClick,
  disabled,
}: {
  title: string;
  icon: typeof Plus;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex h-6 w-6 items-center justify-center rounded-md text-fg-subtle hover:bg-bg-elevated hover:text-fg disabled:opacity-40"
    >
      <Icon size={12} />
    </button>
  );
}
