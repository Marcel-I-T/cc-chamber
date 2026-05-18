import { useEffect, useState } from 'react';
import { ChevronRight, ChevronDown, RefreshCw } from 'lucide-react';
import type { FsEntry } from '@/types/api';
import { iconFor } from '@/lib/fileIcons';
import { cn } from '@/lib/utils';

interface FileTreeProps {
  rootPath: string;
  filter: string;
}

export function FileTree({ rootPath, filter }: FileTreeProps) {
  const [items, setItems] = useState<FsEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      if (!window.api?.fs?.list) {
        throw new Error(
          'fs:list IPC not available — restart Electron (Ctrl+C then `npm run dev`)'
        );
      }
      const res = await window.api.fs.list(rootPath);
      if (res.ok) {
        setItems(res.items ?? []);
      } else {
        setError(res.error ?? 'failed to list');
        setItems([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setExpanded(new Set());
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootPath]);

  if (!rootPath) {
    return (
      <div className="px-3 py-6 text-center text-[11px] text-fg-subtle">
        No project selected
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-3 py-3 text-[11px] text-err">
        Failed to read directory: <span className="font-mono">{error}</span>
        <button
          onClick={refresh}
          className="mt-2 inline-flex items-center gap-1 rounded border border-border bg-bg-elevated px-2 py-1 text-fg-muted hover:bg-bg-panel"
        >
          <RefreshCw size={10} /> Retry
        </button>
      </div>
    );
  }

  if (items === null) {
    return <div className="px-3 py-3 text-[11px] text-fg-subtle">Loading…</div>;
  }

  return (
    <div className="select-text overflow-y-auto py-1">
      {items.map((entry) => (
        <Node
          key={entry.path}
          entry={entry}
          depth={0}
          expanded={expanded}
          setExpanded={setExpanded}
          filter={filter}
        />
      ))}
      {items.length === 0 && (
        <div className="px-3 py-3 text-[11px] text-fg-subtle">Empty directory</div>
      )}
      {loading && (
        <div className="px-3 py-1 text-[10px] text-fg-subtle">refreshing…</div>
      )}
    </div>
  );
}

interface NodeProps {
  entry: FsEntry;
  depth: number;
  expanded: Set<string>;
  setExpanded: (next: Set<string>) => void;
  filter: string;
}

function Node({ entry, depth, expanded, setExpanded, filter }: NodeProps) {
  const isDir = entry.type === 'dir';
  const isOpen = isDir && expanded.has(entry.path);
  const [children, setChildren] = useState<FsEntry[] | null>(null);
  const [childErr, setChildErr] = useState<string | null>(null);
  const matches = !filter || entry.name.toLowerCase().includes(filter.toLowerCase());

  useEffect(() => {
    if (!isOpen) return;
    if (children !== null) return;
    let cancelled = false;
    (async () => {
      try {
        if (!window.api?.fs?.list) {
          setChildErr('fs:list IPC missing — restart Electron');
          setChildren([]);
          return;
        }
        const res = await window.api.fs.list(entry.path);
        if (cancelled) return;
        if (res.ok) setChildren(res.items ?? []);
        else {
          setChildErr(res.error ?? 'failed');
          setChildren([]);
        }
      } catch (err) {
        if (cancelled) return;
        setChildErr(err instanceof Error ? err.message : String(err));
        setChildren([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, entry.path, children]);

  function toggle() {
    if (!isDir) return;
    const next = new Set(expanded);
    if (next.has(entry.path)) next.delete(entry.path);
    else next.add(entry.path);
    setExpanded(next);
  }

  const { Icon, color } = iconFor(entry.name, isDir);

  if (!matches && !isOpen) return null;

  return (
    <div>
      <div
        onClick={toggle}
        className={cn(
          'group flex cursor-pointer items-center gap-1.5 py-0.5 pr-2 text-[12px] hover:bg-bg-elevated',
          entry.hidden ? 'text-fg-muted' : 'text-fg'
        )}
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        <span className="flex h-3.5 w-3.5 items-center justify-center text-fg-subtle">
          {isDir ? (
            isOpen ? (
              <ChevronDown size={11} />
            ) : (
              <ChevronRight size={11} />
            )
          ) : null}
        </span>
        <Icon size={13} className={color} />
        <span className="flex-1 truncate">{entry.name}</span>
      </div>
      {isOpen && (
        <div>
          {childErr && (
            <div
              className="text-[10px] text-err"
              style={{ paddingLeft: 8 + (depth + 1) * 12 }}
            >
              {childErr}
            </div>
          )}
          {children?.map((c) => (
            <Node
              key={c.path}
              entry={c}
              depth={depth + 1}
              expanded={expanded}
              setExpanded={setExpanded}
              filter={filter}
            />
          ))}
          {children && children.length === 0 && (
            <div
              className="py-0.5 text-[10.5px] text-fg-subtle"
              style={{ paddingLeft: 8 + (depth + 1) * 12 }}
            >
              empty
            </div>
          )}
        </div>
      )}
    </div>
  );
}
