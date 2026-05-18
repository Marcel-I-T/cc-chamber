import { useEffect, useState } from 'react';
import { useSessionStore } from '@/stores/useSessionStore';
import { useProjectsStore } from '@/stores/useProjectsStore';

export function SettingsView() {
  const defaultSkip = useSessionStore((s) => s.defaultSkipPermissions);
  const setDefaultSkip = useSessionStore((s) => s.setDefaultSkipPermissions);
  const projects = useProjectsStore((s) => s.projects);
  const sessions = useSessionStore((s) => s.sessions);

  const [claudeBin, setClaudeBin] = useState('');
  useEffect(() => {
    window.api.app.claudeBin().then(setClaudeBin);
  }, []);

  return (
    <div className="mx-auto h-full max-w-2xl overflow-y-auto px-6 py-8">
      <h1 className="mb-6 text-[18px] font-semibold">Settings</h1>

      <Section title="Defaults for new sessions">
        <Row
          label="Skip permissions by default"
          hint="Adds --dangerously-skip-permissions when spawning claude. Dangerous — agent can run anything without asking."
        >
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={defaultSkip}
              onChange={(e) => setDefaultSkip(e.target.checked)}
              className="h-4 w-4 accent-[#a78bfa]"
            />
            <span className="text-[12px] text-fg-muted">Enabled</span>
          </label>
        </Row>
      </Section>

      <Section title="Workspace">
        <Row label="Projects">
          <div className="text-[12px] text-fg-muted">
            {projects.length} project{projects.length === 1 ? '' : 's'} · {sessions.length} session
            {sessions.length === 1 ? '' : 's'} total
          </div>
        </Row>
      </Section>

      <Section title="Environment">
        <Row label="Claude binary">
          <div className="font-mono text-[12px] text-fg-muted">{claudeBin || '—'}</div>
        </Row>
        <Row
          label="Override binary"
          hint="Set CC_CHAMBER_CLAUDE_BIN env var before launching cc-chamber to use a custom path."
        >
          <div className="font-mono text-[11px] text-fg-subtle">
            export CC_CHAMBER_CLAUDE_BIN=/path/to/claude
          </div>
        </Row>
      </Section>

      <Section title="About">
        <div className="text-[12px] text-fg-muted">
          cc-chamber — strukturierter Desktop-Wrapper für Claude Code, im Style von Open Chamber.
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
        {title}
      </h2>
      <div className="space-y-4 rounded-lg border border-border bg-bg-subtle p-4">
        {children}
      </div>
    </section>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-[12px] font-medium text-fg">{label}</div>
      {children}
      {hint && <div className="text-[11px] text-fg-subtle">{hint}</div>}
    </div>
  );
}
