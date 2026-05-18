import { useEffect, useRef } from 'react';
import { useSessionStore, type Session } from '@/stores/useSessionStore';
import { useChatStore } from '@/stores/useChatStore';
import { ChatMessageItem } from './ChatMessage';
import { EmptyHero } from '@/components/views/EmptyHero';
import { Trash2 } from 'lucide-react';

interface Props {
  session: Session;
}

export function ChatView({ session }: Props) {
  const thread = useChatStore((s) => s.threads[session.id]);
  const clear = useChatStore((s) => s.clearThread);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const messages = thread?.messages ?? [];

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, messages[messages.length - 1]?.content]);

  return (
    <div className="flex h-full w-full flex-col bg-bg">
      {/* Thread header */}
      <div className="flex h-8 items-center justify-between border-b border-border bg-bg-subtle px-3 text-[11px] text-fg-muted">
        <div className="flex items-center gap-2">
          <span>Chat · {session.title}</span>
          {thread?.claudeSessionId && (
            <span
              className="font-mono text-[10px] text-fg-subtle"
              title={`Resuming claude session ${thread.claudeSessionId}`}
            >
              · {thread.claudeSessionId.slice(0, 8)}
            </span>
          )}
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => {
              if (confirm('Clear this chat thread? Messages are deleted, claude context kept.')) {
                clear(session.id);
              }
            }}
            className="flex h-6 items-center gap-1 rounded px-1.5 hover:bg-bg-elevated hover:text-fg"
            title="Clear messages"
          >
            <Trash2 size={11} /> Clear
          </button>
        )}
      </div>

      <div ref={scrollerRef} className="min-h-0 flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <EmptyHero hint="Send a message to start the conversation…" />
          </div>
        ) : (
          <div className="mx-auto max-w-3xl px-5 py-6">
            {messages.map((m) => (
              <ChatMessageItem key={m.id} message={m} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
