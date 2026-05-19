<div align="center">

<img src="./assets/logo-wordmark.svg" alt="cc-chamber" width="520" />

**A clean desktop room for [Claude Code](https://docs.claude.com/en/docs/claude-code) — terminal, markdown chat, file browser, sessions per project.**

[![Latest release](https://img.shields.io/github/v/release/Marcel-I-T/cc-chamber?style=flat-square&label=Release&color=a78bfa)](https://github.com/Marcel-I-T/cc-chamber/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-a78bfa.svg?style=flat-square)](./LICENSE)
[![Platform: macOS](https://img.shields.io/badge/macOS-arm64-15151a?style=flat-square&logo=apple)](https://github.com/Marcel-I-T/cc-chamber)
[![Electron 42](https://img.shields.io/badge/Electron-42-2a2a33?style=flat-square&logo=electron)](https://www.electronjs.org)
[![React 19](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react&logoColor=15151a)](https://react.dev)
[![Vite 8](https://img.shields.io/badge/Vite-8-646cff?style=flat-square&logo=vite&logoColor=white)](https://vite.dev)
[![Tailwind 4](https://img.shields.io/badge/Tailwind-4-38bdf8?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

</div>

---

> ⚠️ **Unofficial.** Not affiliated with, endorsed by, or sponsored by Anthropic
> or the Open Chamber project. "Claude" and "Claude Code" are trademarks of
> Anthropic, PBC. Open Chamber / OpenCode belong to their respective authors.
> This project just wraps the official `claude` CLI for personal, local use —
> no Anthropic code or binaries are redistributed.

---

## Why

The [`claude` CLI](https://docs.claude.com/en/docs/claude-code) is great in the terminal, but eventually you want:

- A persistent **sessions list** per project — not "which tab was that one again?"
- A **file tree** that survives session switches
- A **markdown chat view** for when you want responses to read like docs, not a TUI
- A toggle for **`--dangerously-skip-permissions`** that doesn't need editing your shell history

`cc-chamber` is a thin Electron shell around the official `claude` binary that gives you that, while letting `claude` do everything it normally does. You stay on your own subscription, your sessions stay on your machine, and you can drop back to the raw TUI any time.

## ✨ Features

| | |
|---|---|
| 🏠 **Projects → Sessions** | Sidebar lists projects (= directories), each with its own session list. Collapsible, renameable, color-tagged. |
| 💬 **Terminal ⇄ Chat toggle** | Per session, flip between full `claude` TUI and a markdown chat view that mirrors the same conversation from disk. |
| 📁 **File browser** | Right sidebar with type-colored icons, lazy-loaded subfolders, search. |
| 🎨 **Bottom composer** | Model picker (Default / Sonnet / Opus), Plan/Build mode, slash commands. |
| 🔐 **Skip-perms toggle** | `--dangerously-skip-permissions` as a per-session toggle. |
| 💾 **Persistent everything** | Projects, sessions, chat threads survive refresh and app restart. Terminal sessions resume with `--continue`, chats with `--resume <session-id>`. |
| ⚡ **Two-spawn modes** | Long-running PTY for TUI, headless `claude -p --output-format json` for chat. |
| 🪟 **OC-style layout** | Header / Sidebar / Main / RightSidebar / BottomDock — proven structure, customised for terminal-first workflow. |

## 🚀 Install

### Recommended: build from source

This is the cleanest path — no macOS Gatekeeper warnings, works on any Mac (arm64 or Intel), trivial to update:

```bash
# Prerequisites: Node.js 20+ and the official `claude` CLI signed in
git clone https://github.com/Marcel-I-T/cc-chamber.git
cd cc-chamber
npm install         # installs deps + compiles the native PTY
npm link            # makes `cc-chamber` available globally
cc-chamber          # auto-builds the UI on first run, then launches
```

To update later: `cd cc-chamber && git pull && npm install`.

The first launch builds the UI bundle (~1 s with Vite 8 / Rolldown) and rebuilds `node-pty` for the local Electron — all subsequent starts are instant.

### Alternative: DMG download

A pre-built DMG is available on the [releases page](https://github.com/Marcel-I-T/cc-chamber/releases/latest) for Apple Silicon Macs. **One-time setup is needed** because the build is ad-hoc signed but not yet Apple-notarized — macOS Gatekeeper will block it the first time.

After moving `cc-chamber.app` to `/Applications/`, do **one** of:

- **System Settings → Privacy & Security**, scroll down to "Security", click "**Open Anyway**" next to the cc-chamber notice (Touch ID / password to confirm).
- Or in Terminal: `xattr -dr com.apple.quarantine /Applications/cc-chamber.app`

From then on it opens normally from Spotlight or Finder. Subsequent updates only need the same step if you delete and re-download — installing over the existing app preserves the trust decision.

The DMG includes both the app bundle and the precompiled native PTY, so you don't need Node.js for this path.

### Daily usage

```
cc-chamber              launch (auto-builds UI if needed)
cc-chamber --dev        Vite + Electron with HMR (for hacking on the code)
cc-chamber --build      rebuild the UI bundle without launching
cc-chamber --version    print version
cc-chamber --help       show this list
```

## 🧠 How it works

```
                          ┌──────────────────────────────────┐
   (your subscription)    │  Electron renderer (React + TS)  │
                          │ ────────────────────────────────  │
                          │  Sidebar  │  Terminal  │ Files    │
                          │           │   or Chat  │          │
                          └────┬─────────────┬─────────┬──────┘
                               │ IPC         │ IPC     │ IPC
                          ┌────▼──────┐ ┌────▼─────┐ ┌─▼──────┐
                          │ node-pty  │ │  claude  │ │ fs.list │
                          │  spawn    │ │  -p ...  │ │         │
                          │ claude    │ │  --json  │ │         │
                          └───────────┘ └──────────┘ └────────┘
                                │             │
                                └──────┬──────┘
                                       ▼
                                 your Claude
                                 subscription
```

- **Terminal mode** spawns `claude [--dangerously-skip-permissions] [--continue]` in a real PTY via `node-pty`. xterm.js renders. Full TUI fidelity (Plan mode, slash commands, etc).
- **Chat mode** reads claude's own session log (`~/.claude/projects/<encoded-cwd>/<uuid>.jsonl`) and renders it as markdown bubbles — collapsible tool calls, syntax-highlighted code blocks, expandable "thinking" blocks. Sending from the composer calls `claude -p "<message>" --output-format json --resume <session-id>`, so chat and terminal share the same conversation.

## 🗂 Architecture

```
cc-chamber/
├── bin/
│   └── cc-chamber.mjs           CLI launcher (auto-build + Electron spawn)
├── electron/
│   ├── main.mjs                 IPC handlers (pty:*, fs:*, claude:run, claude:readSession)
│   └── preload.mjs              contextBridge → window.api
├── src/
│   ├── App.tsx
│   ├── components/
│   │   ├── layout/              MainLayout, Header, Sidebar, RightSidebar,
│   │   │                        BottomDock, BottomComposer
│   │   ├── terminal/            TerminalPane (xterm.js + node-pty)
│   │   ├── chat/                ChatView, ChatMessage, MirrorMessage
│   │   ├── files/               FileTree (lazy, type-colored icons)
│   │   └── views/               TerminalView, SettingsView, EmptyHero
│   ├── stores/                  Zustand stores with persist middleware:
│   │                            useProjectsStore, useSessionStore,
│   │                            useChatStore, useUIStore
│   ├── lib/                     utils, fileIcons
│   └── types/api.d.ts
└── assets/
    ├── logo-mark.svg
    ├── logo-wordmark.svg
    └── favicon.svg
```

## ⚙️ Environment

| Variable | Effect |
|---|---|
| `CC_CHAMBER_CLAUDE_BIN` | Override the path to the `claude` binary |
| `CC_CHAMBER_DEV` | Force dev mode (Vite at localhost:5173) |

## 🛡 Security model

- **Local-only.** No network listener, no auth layer. Wrapping with a VPN/SSH tunnel is your job if you want remote access.
- **One user, one machine.** Hosting a shared instance would route everyone's prompts through your subscription — violates Anthropic's terms and is intentionally not supported.
- **`--dangerously-skip-permissions` is opt-in per session.** When on, the agent runs without confirmation; only use it in isolated worktrees.

## 🗺 Roadmap

- [ ] Apple-notarized DMG (zero Gatekeeper friction)
- [ ] Git tab in the right sidebar (branches, status, diffs)
- [ ] Inline file viewer (click a file in the tree → open in main area)
- [ ] Linux / Windows builds
- [ ] First-class Plan/Build indicator that follows claude's actual state
- [ ] Search across chat history
- [ ] Theme customization

## 🛠 Building a DMG (maintainers)

A maintainer needs a paid Apple Developer Program account + `Developer ID Application` certificate in their Keychain. Then:

```bash
cp .env.example .env
# Fill in APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID
npm run build:app                 # signed + notarized + stapled
```

For a quick ad-hoc-signed local build (no Apple account needed, Gatekeeper warning on first open):

```bash
npm run build:app:adhoc
```

## 🤝 Contributing

PRs welcome. The codebase is intentionally small — start by reading `MainLayout.tsx` and `electron/main.mjs`. Run `cc-chamber --dev` for hot reload while hacking.

## Trademarks & attribution

- **Claude™** and **Claude Code™** are trademarks of **Anthropic, PBC**. cc-chamber is an independent, unofficial project. We do not redistribute Anthropic's CLI, models, or any proprietary code — users install the official `claude` CLI themselves.
- **Open Chamber** / **OpenCode** belong to their authors and are referenced for visual and structural inspiration. No code is copied.
- All bundled npm dependencies are MIT / Apache / ISC licensed.

## License

[MIT](./LICENSE) © 2026 Marcel-I-T
