import { User, Sparkles, AlertTriangle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/stores/useChatStore';

interface Props {
  message: ChatMessage;
}

export function ChatMessageItem({ message }: Props) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  return (
    <div
      className={cn(
        'group mb-5 flex gap-3',
        isUser && 'flex-row-reverse'
      )}
    >
      <div
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
          isUser
            ? 'bg-bg-elevated text-fg-muted'
            : isSystem
            ? 'bg-warn/10 text-warn'
            : 'bg-accent/15 text-accent'
        )}
      >
        {isUser ? (
          <User size={13} />
        ) : isSystem ? (
          <AlertTriangle size={13} />
        ) : (
          <Sparkles size={13} />
        )}
      </div>

      <div
        className={cn(
          'min-w-0 max-w-[80%] rounded-lg px-3.5 py-2.5 text-[13px] leading-[1.55]',
          isUser
            ? 'bg-accent/10 text-fg'
            : isSystem
            ? 'border border-warn/30 bg-warn/5 text-fg-muted'
            : 'bg-bg-subtle text-fg'
        )}
      >
        {message.pending ? (
          <div className="flex items-center gap-2 text-fg-subtle">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent [animation-delay:120ms]" />
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent [animation-delay:240ms]" />
            <span className="ml-1 text-[11px]">thinking…</span>
          </div>
        ) : message.error ? (
          <div className="space-y-1">
            <div className="text-err">⚠ {message.error}</div>
            {message.content && (
              <div className="font-mono text-[11px] text-fg-subtle">{message.content}</div>
            )}
          </div>
        ) : isUser ? (
          // User messages: preserve newlines exactly, no markdown rendering
          <div className="whitespace-pre-wrap font-sans">{message.content}</div>
        ) : (
          <div className="ckaude-md">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>
        )}

        {!isUser && !message.pending && !message.error && (message.durationMs || message.costUsd !== undefined) && (
          <div className="mt-2 flex items-center gap-2 border-t border-border/50 pt-1.5 text-[10px] text-fg-subtle">
            {message.durationMs !== undefined && (
              <span>{(message.durationMs / 1000).toFixed(1)}s</span>
            )}
            {message.costUsd !== undefined && (
              <span>${message.costUsd.toFixed(4)}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
