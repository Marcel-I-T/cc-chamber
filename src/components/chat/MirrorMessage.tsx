import { useState } from 'react';
import {
  User,
  Sparkles,
  ChevronRight,
  ChevronDown,
  Wrench,
  CheckCircle2,
  AlertCircle,
  Brain,
  ImageIcon,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ClaudeBlock, TuiMessage } from '@/types/api';
import { cn } from '@/lib/utils';

interface Props {
  message: TuiMessage;
}

export function MirrorMessage({ message }: Props) {
  const isUser = message.role === 'user';
  // Filter blocks: skip tool_result that is mid-conversation (these are
  // claude's responses to its own tool_use blocks — they pair up).
  const blocks = message.blocks;

  // If a user message contains ONLY tool_result blocks, it's an internal
  // tool-output turn from claude; render compact instead of as user speech.
  const onlyToolResults =
    isUser && blocks.length > 0 && blocks.every((b) => b.type === 'tool_result');

  return (
    <div
      className={cn(
        'group mb-5 flex gap-3',
        isUser && !onlyToolResults && 'flex-row-reverse',
      )}
    >
      <div
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
          onlyToolResults
            ? 'bg-ok/10 text-ok'
            : isUser
            ? 'bg-bg-elevated text-fg-muted'
            : 'bg-accent/15 text-accent',
        )}
      >
        {onlyToolResults ? (
          <CheckCircle2 size={13} />
        ) : isUser ? (
          <User size={13} />
        ) : (
          <Sparkles size={13} />
        )}
      </div>

      <div
        className={cn(
          'min-w-0 max-w-[88%] rounded-lg px-3.5 py-2.5 text-[13px] leading-[1.55]',
          isUser && !onlyToolResults
            ? 'bg-accent/10 text-fg'
            : onlyToolResults
            ? 'bg-bg-subtle text-fg-muted'
            : 'bg-bg-subtle text-fg',
        )}
      >
        {blocks.map((b, i) => (
          <BlockRenderer key={i} block={b} isUserMessage={isUser} />
        ))}
      </div>
    </div>
  );
}

function BlockRenderer({
  block,
  isUserMessage,
}: {
  block: ClaudeBlock;
  isUserMessage: boolean;
}) {
  if (block.type === 'text') {
    if (!block.text.trim()) return null;
    if (isUserMessage) {
      return (
        <div className="whitespace-pre-wrap font-sans">{block.text}</div>
      );
    }
    return (
      <div className="ckaude-md">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{block.text}</ReactMarkdown>
      </div>
    );
  }

  if (block.type === 'thinking') {
    return <ThinkingBlock text={block.text} />;
  }

  if (block.type === 'tool_use') {
    return <ToolUseBlock name={block.name} input={block.input} />;
  }

  if (block.type === 'tool_result') {
    return <ToolResultBlock text={block.text} isError={block.isError} />;
  }

  if (block.type === 'image') {
    return (
      <div className="my-1 inline-flex items-center gap-1.5 rounded border border-border bg-bg-elevated px-2 py-1 text-[11px] text-fg-muted">
        <ImageIcon size={11} /> image attachment
      </div>
    );
  }

  return null;
}

function ThinkingBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  if (!text.trim()) return null;
  return (
    <div className="my-1.5 rounded-md border border-border bg-bg-elevated/50">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-2.5 py-1 text-left text-[11px] text-fg-muted hover:text-fg"
      >
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        <Brain size={11} />
        <span className="italic">claude was thinking</span>
      </button>
      {open && (
        <div className="border-t border-border px-2.5 py-1.5 font-mono text-[11px] italic text-fg-muted whitespace-pre-wrap">
          {text}
        </div>
      )}
    </div>
  );
}

function ToolUseBlock({ name, input }: { name: string; input: unknown }) {
  const [open, setOpen] = useState(false);
  const summary = summariseToolInput(name, input);
  return (
    <div className="my-1.5 rounded-md border border-border bg-bg-elevated/60">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-2.5 py-1 text-left text-[11.5px] text-fg-muted hover:text-fg"
      >
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        <Wrench size={11} className="text-accent" />
        <span className="font-mono font-medium text-fg">{name}</span>
        {summary && <span className="truncate text-fg-subtle">· {summary}</span>}
      </button>
      {open && (
        <pre className="overflow-x-auto border-t border-border px-2.5 py-1.5 font-mono text-[11px] text-fg-muted">
          {JSON.stringify(input, null, 2)}
        </pre>
      )}
    </div>
  );
}

function ToolResultBlock({
  text,
  isError,
}: {
  text: string;
  isError?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const preview = text.split('\n')[0]?.slice(0, 120) ?? '';
  return (
    <div
      className={cn(
        'my-1 rounded-md border',
        isError ? 'border-err/40 bg-err/5' : 'border-border bg-bg-elevated/40',
      )}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center gap-1.5 px-2.5 py-1 text-left text-[11px]',
          isError ? 'text-err' : 'text-fg-muted hover:text-fg',
        )}
      >
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        {isError ? <AlertCircle size={11} /> : <CheckCircle2 size={11} />}
        <span className="truncate">{preview || 'tool result'}</span>
      </button>
      {open && (
        <pre className="overflow-x-auto border-t border-border px-2.5 py-1.5 font-mono text-[11px] text-fg-muted whitespace-pre-wrap">
          {text}
        </pre>
      )}
    </div>
  );
}

function summariseToolInput(name: string, input: unknown): string {
  if (!input || typeof input !== 'object') return '';
  const obj = input as Record<string, unknown>;
  switch (name) {
    case 'Read':
    case 'read_file':
      return typeof obj.file_path === 'string' ? obj.file_path : '';
    case 'Edit':
    case 'MultiEdit':
    case 'Write':
      return typeof obj.file_path === 'string' ? obj.file_path : '';
    case 'Bash':
      return typeof obj.command === 'string'
        ? obj.command.slice(0, 80)
        : typeof obj.description === 'string'
        ? obj.description
        : '';
    case 'Glob':
      return typeof obj.pattern === 'string' ? obj.pattern : '';
    case 'Grep':
      return typeof obj.pattern === 'string' ? obj.pattern : '';
    default: {
      const firstStr = Object.values(obj).find((v) => typeof v === 'string');
      return typeof firstStr === 'string' ? firstStr.slice(0, 80) : '';
    }
  }
}
