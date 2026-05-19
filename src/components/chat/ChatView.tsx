import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, Trash2, Eye, MessageSquarePlus } from 'lucide-react';
import { useSessionStore, type Session } from '@/stores/useSessionStore';
import { useChatStore } from '@/stores/useChatStore';
import { ChatMessageItem } from './ChatMessage';
import { MirrorMessage } from './MirrorMessage';
import { EmptyHero } from '@/components/views/EmptyHero';
import type { TuiMessage } from '@/types/api';
import { cn } from '@/lib/utils';

interface Props {
  session: Session;
}

type ChatSource = 'live' | 'mirror';

export function ChatView({ session }: Props) {
  const thread = useChatStore((s) => s.threads[session.id]);
  const clear = useChatStore((s) => s.clearThread);
  const setClaudeSessionId = useChatStore((s) => s.setClaudeSessionId);

  // Mirror state — TUI session JSONL from disk
  const [mirror, setMirror] = useState<TuiMessage[]>([]);
  const [mirrorSessionId, setMirrorSessionId] = useState<string | null>(null);
  const [mirrorAvailable, setMirrorAvailable] = useState(false);
  const [mirrorLoading, setMirrorLoading] = useState(false);
  const [mirrorError, setMirrorError] = useState<string | null>(null);

  // Default to mirror if a TUI session exists, else live
  const [source, setSource] = useState<ChatSource>('mirror');

  const scrollerRef = useRef<HTMLDivElement>(null);
  const liveMessages = thread?.messages ?? [];

  const loadMirror = useCallback(async () => {
    if (!window.api?.claude?.readSession) {
      setMirrorError('claude:readSession IPC not available — restart Electron');
      return;
    }
    setMirrorLoading(true);
    setMirrorError(null);
    try {
      const res = await window.api.claude.readSession({ cwd: session.cwd });
      if (res.ok) {
        setMirror(res.messages ?? []);
        setMirrorSessionId(res.sessionId ?? null);
        setMirrorAvailable(!!res.available);
        // wire the resolved session id back into the chat store so follow-up
        // live chat continues the SAME claude conversation
        if (res.sessionId && (!thread?.claudeSessionId || thread.claudeSessionId !== res.sessionId)) {
          setClaudeSessionId(session.id, res.sessionId);
        }
      } else {
        setMirrorError(res.error ?? 'failed to read session');
        setMirrorAvailable(false);
      }
    } catch (err) {
      setMirrorError(err instanceof Error ? err.message : String(err));
    } finally {
      setMirrorLoading(false);
    }
  }, [session.cwd, session.id, thread?.claudeSessionId, setClaudeSessionId]);

  useEffect(() => {
    loadMirror();
  }, [loadMirror]);

  // Auto-refresh mirror periodically — picks up new turns from the TUI live.
  useEffect(() => {
    if (source !== 'mirror') return;
    const t = window.setInterval(loadMirror, 4000);
    return () => window.clearInterval(t);
  }, [source, loadMirror]);

  // Auto-scroll on content change
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [
    source,
    source === 'live' ? liveMessages.length : mirror.length,
    source === 'live' ? liveMessages[liveMessages.length - 1]?.content : mirror[mirror.length - 1]?.id,
  ]);

  // If both have content, prefer mirror as default — TUI is canonical source
  useEffect(() => {
    if (mirrorAvailable && mirror.length > 0 && liveMessages.length === 0 && source === 'live') {
      setSource('mirror');
    }
  }, [mirrorAvailable, mirror.length, liveMessages.length, source]);

  const currentCount =
    source === 'mirror' ? mirror.length : liveMessages.length;

  return (
    <div className="flex h-full w-full flex-col bg-bg">
      {/* Thread header */}
      <div className="flex h-9 items-center gap-2 border-b border-border bg-bg-subtle px-3 text-[11px] text-fg-muted">
        <div className="inline-flex h-6 items-center overflow-hidden rounded-md border border-border bg-bg-elevated p-0.5">
          <button
            onClick={() => setSource('mirror')}
            className={cn(
              'flex h-5 items-center gap-1 rounded-sm px-2 text-[10.5px] font-medium transition-colors',
              source === 'mirror'
                ? 'bg-bg-panel text-fg'
                : 'text-fg-muted hover:text-fg',
            )}
            title="Show the live TUI session, formatted"
          >
            <Eye size={10} /> TUI mirror
            {mirrorAvailable && <span className="ml-0.5 text-fg-subtle">· {mirror.length}</span>}
          </button>
          <button
            onClick={() => setSource('live')}
            className={cn(
              'flex h-5 items-center gap-1 rounded-sm px-2 text-[10.5px] font-medium transition-colors',
              source === 'live'
                ? 'bg-bg-panel text-fg'
                : 'text-fg-muted hover:text-fg',
            )}
            title="Show messages sent from this composer only"
          >
            <MessageSquarePlus size={10} /> Composer
            {liveMessages.length > 0 && <span className="ml-0.5 text-fg-subtle">· {liveMessages.length}</span>}
          </button>
        </div>

        <span className="text-fg-subtle">·</span>
        <span className="truncate">{session.title}</span>
        {mirrorSessionId && (
          <span
            className="font-mono text-[10px] text-fg-subtle"
            title={`claude session ${mirrorSessionId}`}
          >
            · {mirrorSessionId.slice(0, 8)}
          </span>
        )}

        <div className="ml-auto flex items-center gap-0.5">
          <button
            onClick={loadMirror}
            disabled={mirrorLoading}
            className="flex h-6 w-6 items-center justify-center rounded text-fg-subtle hover:bg-bg-elevated hover:text-fg disabled:opacity-50"
            title="Refresh from disk"
          >
            <RefreshCw size={11} className={mirrorLoading ? 'animate-spin' : ''} />
          </button>
          {source === 'live' && liveMessages.length > 0 && (
            <button
              onClick={() => {
                if (confirm('Clear composer messages? (Live composer-only history)')) {
                  clear(session.id);
                }
              }}
              className="flex h-6 items-center gap-1 rounded px-1.5 text-[10.5px] text-fg-subtle hover:bg-bg-elevated hover:text-fg"
              title="Clear composer messages"
            >
              <Trash2 size={10} /> Clear
            </button>
          )}
        </div>
      </div>

      {mirrorError && source === 'mirror' && (
        <div className="border-b border-err/40 bg-err/10 px-3 py-1.5 text-[11px] text-err">
          {mirrorError}
        </div>
      )}

      <div ref={scrollerRef} className="min-h-0 flex-1 overflow-y-auto">
        {currentCount === 0 ? (
          <div className="flex h-full items-center justify-center">
            <EmptyHero
              hint={
                source === 'mirror'
                  ? mirrorLoading
                    ? 'reading session…'
                    : 'No TUI session yet — switch to Terminal, run a prompt, come back.'
                  : 'Type below to start a composer-only chat.'
              }
            />
          </div>
        ) : (
          <div className="mx-auto max-w-3xl px-5 py-6">
            {source === 'mirror'
              ? mirror.map((m) => <MirrorMessage key={m.id} message={m} />)
              : liveMessages.map((m) => <ChatMessageItem key={m.id} message={m} />)}
          </div>
        )}
      </div>
    </div>
  );
}
