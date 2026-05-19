import { useEffect, useRef, useState } from 'react';
import {
  X,
  Save,
  RefreshCw,
  AlertTriangle,
  Lock,
  Unlock,
} from 'lucide-react';
import { iconFor } from '@/lib/fileIcons';
import { basename, cn } from '@/lib/utils';

interface Props {
  filePath: string;
  onClose: () => void;
}

export function FileEditor({ filePath, onClose }: Props) {
  const [content, setContent] = useState<string | null>(null);
  const [original, setOriginal] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [readOnly, setReadOnly] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const dirty = content !== null && content !== original;
  const name = basename(filePath);
  const { Icon, color } = iconFor(name, false);

  async function load() {
    if (!window.api?.fs?.readFile) return;
    setLoading(true);
    setError(null);
    try {
      const res = await window.api.fs.readFile(filePath);
      if (res.ok && res.content !== undefined) {
        setContent(res.content);
        setOriginal(res.content);
      } else {
        setError(res.error ?? 'failed to read');
        setContent(null);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setReadOnly(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filePath]);

  async function save() {
    if (content === null) return;
    if (!window.api?.fs?.writeFile) return;
    setSaving(true);
    setError(null);
    try {
      const res = await window.api.fs.writeFile(filePath, content);
      if (res.ok) {
        setOriginal(content);
      } else {
        setError(res.error ?? 'failed to write');
      }
    } finally {
      setSaving(false);
    }
  }

  // Cmd/Ctrl+S to save
  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      if (!readOnly && dirty && !saving) save();
    }
    // Tab inserts two spaces instead of switching focus
    if (e.key === 'Tab' && !readOnly) {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const next = content!.slice(0, start) + '  ' + content!.slice(end);
      setContent(next);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 2;
      });
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-9 items-center gap-1.5 border-b border-border bg-bg-subtle px-2 text-[11.5px]">
        <Icon size={12} className={color} />
        <span className="truncate font-medium text-fg" title={filePath}>
          {name}
        </span>
        {dirty && (
          <span className="rounded bg-warn/15 px-1 text-[9px] font-semibold uppercase tracking-wide text-warn">
            unsaved
          </span>
        )}
        <div className="ml-auto flex items-center gap-0.5">
          <button
            onClick={() => setReadOnly((r) => !r)}
            disabled={!!error || content === null}
            className={cn(
              'flex h-6 items-center gap-1 rounded px-1.5 text-[10.5px] disabled:opacity-50',
              readOnly
                ? 'text-fg-muted hover:bg-bg-elevated hover:text-fg'
                : 'bg-accent/10 text-accent hover:bg-accent/15',
            )}
            title={readOnly ? 'Enable editing' : 'Lock (read-only)'}
          >
            {readOnly ? <Lock size={10} /> : <Unlock size={10} />}
            {readOnly ? 'View' : 'Edit'}
          </button>
          <button
            onClick={save}
            disabled={readOnly || !dirty || saving}
            className={cn(
              'flex h-6 items-center gap-1 rounded px-1.5 text-[10.5px] disabled:opacity-40',
              dirty && !readOnly
                ? 'bg-accent text-bg hover:bg-accent-hover'
                : 'text-fg-muted hover:bg-bg-elevated hover:text-fg',
            )}
            title="Save (⌘S)"
          >
            <Save size={10} />
            Save
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="flex h-6 w-6 items-center justify-center rounded text-fg-subtle hover:bg-bg-elevated hover:text-fg disabled:opacity-50"
            title="Reload from disk"
          >
            <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded text-fg-subtle hover:bg-bg-elevated hover:text-fg"
            title="Close editor"
          >
            <X size={11} />
          </button>
        </div>
      </div>

      {/* Path */}
      <div className="border-b border-border px-2 py-1 font-mono text-[10px] text-fg-subtle">
        {filePath}
      </div>

      {/* Body */}
      <div className="relative min-h-0 flex-1">
        {error && (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-[12px] text-err">
            <AlertTriangle size={20} />
            <div>{error}</div>
            {error === 'binary' && (
              <div className="text-fg-subtle">This file looks binary — not displayed.</div>
            )}
            {error === 'file-too-large' && (
              <div className="text-fg-subtle">File exceeds 5 MB — not loaded.</div>
            )}
          </div>
        )}
        {!error && content === null && loading && (
          <div className="flex h-full items-center justify-center text-[11px] text-fg-subtle">
            loading…
          </div>
        )}
        {content !== null && !error && (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={onKeyDown}
            readOnly={readOnly}
            spellCheck={false}
            className={cn(
              'absolute inset-0 h-full w-full resize-none bg-bg p-3 font-mono text-[12px] leading-[1.5] text-fg outline-none',
              readOnly && 'cursor-default text-fg-muted',
            )}
          />
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border bg-bg-subtle px-2 py-1 text-[10px] text-fg-subtle">
        {content !== null
          ? `${content.length.toLocaleString()} chars · ${content.split('\n').length} lines${
              readOnly ? ' · read-only' : ''
            }${dirty ? ' · ⌘S to save' : ''}`
          : ''}
      </div>
    </div>
  );
}
