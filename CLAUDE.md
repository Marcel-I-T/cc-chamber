# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`ckaude` is an Electron desktop wrapper around the **Claude Code CLI**. It is _not_ a chat UI — it hosts a real PTY (`node-pty`) rendered into `xterm.js` so the Claude Code TUI runs unmodified. The renderer is React + Vite + Tailwind, with Zustand for state. The README is in German; code, comments, and identifiers are English.

## Commands

```bash
npm install               # also runs `rebuild` via postinstall
npm run rebuild           # rebuild node-pty against Electron's Node ABI (hardcoded: target=33.4.11, arch=arm64)
npm run dev               # vite (5173) + electron, in parallel via concurrently
npm run build             # tsc -b && vite build  (produces dist/ — required before packaging)
npm run build:app         # build + electron-builder → release/ckaude-*.dmg (macOS only)
```

There is **no test runner, linter, or formatter** configured. `tsc -b` (via `npm run build`) is the only static check.

If `node-pty` errors with `NODE_MODULE_VERSION` mismatch after an `npm install`, rerun `npm run rebuild`. The script is pinned to Electron 33 / arm64 — adjust the env vars in `package.json` if you bump Electron or target a different arch.

## Architecture

Two processes, one IPC contract — keep them in sync.

### Main process — `electron/main.mjs`

Owns PTYs and filesystem. Holds a `Map<sessionId, IPty>` keyed by renderer-generated session IDs. Exposes IPC handlers:

- `pty:spawn` — resolves the Claude binary via `resolveClaudeBinary()` (checks `CKAUDE_CLAUDE_BIN`, `~/.claude/local/claude`, `/usr/local/bin/claude`, `/opt/homebrew/bin/claude`, then falls back to `claude` on PATH). When `mode === 'shell'`, spawns `$SHELL -l` instead. The `--dangerously-skip-permissions` flag is added only when `skipPermissions` is true.
- `pty:write` / `pty:resize` / `pty:kill` — operate on the map.
- `fs:pickDirectory`, `fs:list`, `app:homedir`, `app:claudeBin` — directory picker and listing for the Files view.

`buildEnv()` strips inherited Electron/Node helper vars (`ELECTRON_RUN_AS_NODE`, `NODE_OPTIONS`, `NODE_ENV`, etc.) before spawning — Claude is itself a Node app and gets confused by these. It also prepends common bin dirs to `PATH` and forces `TERM=xterm-256color` + `CI=''` so Claude treats the PTY as interactive. **Preserve these env adjustments** when changing spawn logic; their absence has historically caused blank/headless behavior.

PTY data is sent on per-session channels (`pty:data:${sessionId}`, `pty:exit:${sessionId}`) — the renderer subscribes _before_ calling `spawn` so output from fast-exiting processes isn't lost (see `TerminalPane.tsx`).

### Preload — `electron/preload.mjs`

`contextIsolation: true`, `nodeIntegration: false`. The only renderer-visible surface is `window.api.{pty,fs,app}`. Its TypeScript shape lives in `src/types/api.d.ts` — update both files together when adding IPC.

### Renderer — `src/`

Three Zustand stores, all in `src/stores/`:

- `useProjectsStore` — projects (a project = a directory). Persisted to `localStorage` (`ckaude-projects`). `ensureProjectForPath` deduplicates by normalized path.
- `useSessionStore` — terminal sessions, scoped to a `projectId`. Persisted (`ckaude-sessions`) but `partialize` resets `status`/`pid`/`exitCode` on rehydrate, since live PTYs don't survive a renderer reload.
- `useUIStore` — transient UI (sidebars, active tab). Not persisted.

`MainLayout` is the Open-Chamber-style frame: Header / Sidebar / Main / RightSidebar / BottomDock + BottomComposer. The Main area switches between `TerminalView`, `FilesView`, `SettingsView`.

`TerminalPane` is the key component. One xterm instance per `Session`, kept mounted across tab switches (visibility toggled via CSS) so PTY scrollback survives. It calls `fit.fit()` on resize via `ResizeObserver` and on activation. The `[session.id, session.cwd]` effect dependency is intentional — changing cwd respawns.

### Path alias

`@/*` → `src/*` (configured in both `tsconfig.json` and `vite.config.ts` — keep both in sync).

## Conventions

- **Project goal is MVP parity with the README's feature list**: terminal, multi-session, skip-permissions toggle, cwd picker, context panel. File tree / Git sidebar / diff viewer are placeholders — don't expand scope without being asked.
- Electron source uses `.mjs` (the package is `"type": "module"`); renderer source is `.tsx`/`.ts`.
- Tailwind theme defines semantic tokens (`bg`, `bg-subtle`, `bg-panel`, `border`, `fg`, `fg-muted`, `accent`, `ok`/`warn`/`err`) — use these instead of raw hex.
- Persisted store names (`ckaude-sessions`, `ckaude-projects`) are user-visible state; if you change a store's shape, handle the migration in the `persist` config rather than breaking existing installs.
