# openclauder

Strukturierter Desktop-Wrapper für **Claude Code**, im Style von [Open Chamber](https://github.com/openchamber/openchamber) — aber statt einer eigenen Chat-Engine bist du direkt an deiner bestehenden Claude-Code-Subscription dran, in zwei Modi:

- **Terminal-Modus** — die echte `claude` TUI in einer xterm.js-Pane via PTY
- **Chat-Modus** — formatierte Markdown-Antworten, headless via `claude -p`, mit Session-Resume für Multi-Turn

## Features

- 🗂 **Projects + Sessions** Sidebar links (collapsible Projekt-Sektionen, Sessions pro Projekt)
- 📁 **File-Browser** rechts mit Type-coloured Icons, Lazy-Loading, Search
- 💬 **Terminal/Chat Toggle** pro Session — Markdown-Antworten oder volle TUI
- 🔐 **Skip-Permissions Toggle** für `--dangerously-skip-permissions`
- 🎨 **Bottom Composer** mit Model-Picker (Default/Sonnet/Opus), Plan/Build-Mode, Slash-Commands
- 💾 **Persistenz** — Projekte, Sessions, Chat-Threads überleben Refresh und App-Restart. Sessions starten mit `--continue` neu, Chats mit `--resume <session-id>`
- ⚡ **Empty-State** mit 3D-Cube + rotierenden Placeholder-Hints

## Voraussetzungen

- macOS (Linux/Windows untested — PTY-Build sollte aber laufen)
- Node.js 20+
- Claude Code CLI installiert ([install guide](https://docs.claude.com/en/docs/claude-code))
- Aktive Claude-Subscription (Pro/Team/Enterprise)

## Install

```bash
git clone https://github.com/Marcel-I-T/openclauder.git
cd openclauder
npm install         # installiert deps und kompiliert PTY für Electron
npm link            # macht `openclauder` global verfügbar
```

## Starten

```bash
openclauder         # erste Ausführung: baut UI, dann startet Electron
openclauder --dev   # Vite + Electron mit Hot Module Reload für Hacking
openclauder --build # nur UI-Bundle bauen, nicht starten
```

## Build-Distribution (DMG)

```bash
npm run build:app
# Output: release/openclauder-*.dmg
```

## Architektur

```
openclauder/
├── bin/
│   └── openclauder.mjs      CLI launcher (auto-build + electron spawn)
├── electron/
│   ├── main.mjs             Hauptprozess + IPC (PTY, fs, claude:run)
│   └── preload.mjs          contextBridge → window.api
├── src/
│   ├── App.tsx
│   ├── components/
│   │   ├── layout/          MainLayout, Header, Sidebar, RightSidebar,
│   │   │                    BottomDock, BottomComposer
│   │   ├── terminal/        TerminalPane (xterm.js + node-pty)
│   │   ├── chat/            ChatView, ChatMessage (Markdown bubbles)
│   │   ├── files/           FileTree (mit type-colored icons)
│   │   └── views/           TerminalView, SettingsView, EmptyHero
│   ├── stores/              useProjectsStore, useSessionStore,
│   │                        useChatStore, useUIStore (Zustand + persist)
│   ├── lib/                 utils, fileIcons
│   └── types/api.d.ts
└── package.json
```

## Modi im Detail

### Terminal-Modus

Spawned `claude [--dangerously-skip-permissions] [--continue]` in einem echten PTY (`node-pty`). xterm.js rendert die TUI inkl. Plan-Mode, Slash-Commands etc. Beim App-Restart wird die Session automatisch mit `--continue` resumed.

### Chat-Modus

Pro Send: spawnt headless `claude -p "<msg>" --output-format json [--resume <session-id>] [--model X]`. Response wird als JSON geparst, in eine Markdown-Bubble gerendert (Tables, Code-Blocks, GFM). `session_id` wird gespeichert für Folge-Messages → echtes Multi-Turn-Gespräch das auch App-Restart überlebt.

## Persistenz

Alle Daten in `localStorage` (per Browser/Electron-Profil):

- `ckaude-projects` — Projekt-Liste
- `ckaude-sessions` — Session-Metadata (PIDs/Status werden beim Persist gestrippt)
- `ckaude-chat` — Chat-Threads inkl. `claudeSessionId` pro Thread

Beim Reload werden Sessions mit `resumeOnRespawn: true` markiert, der nächste PTY-Spawn nutzt `--continue`.

## Environment

- `CKAUDE_CLAUDE_BIN=/path/to/claude` — Pfad zur Claude-Binary überschreiben
- `CKAUDE_DEV=1` — Dev-Modus erzwingen

## Sicherheit

- `--dangerously-skip-permissions` Toggle ist pro Session — der Agent darf dann ohne Rückfrage Dateien ändern, Befehle ausführen, etc. Nur in isolierter `cwd` benutzen.
- Die App ist **lokal-only** — kein Netzwerk-Listener, kein Auth-Layer. Wenn du auf einem Server exposen willst, brauchst du eigenen Auth/Tunnel davor.
- Multi-User: jeder Nutzer braucht eigene Installation + eigene Claude-Subscription. Ein gemeinsamer openclauder-Server würde alle Sessions auf dem Host-User-Account laufen lassen.

## Mitwirken

Privates Repo — Issues und PRs nach Absprache.

## Lizenz

MIT.
