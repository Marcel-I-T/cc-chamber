import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pty from 'node-pty';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = process.env.CC_CHAMBER_DEV === '1' || !app.isPackaged;

app.setName('cc-chamber');

if (!app.requestSingleInstanceLock()) {
  app.exit(0);
  process.exit(0);
}

/**
 * Per session we keep:
 *   - proc        : the live IPty
 *   - buffer      : a ring-buffer of recent stdout bytes so a freshly reloaded
 *                   renderer can replay the terminal screen as it was
 *   - senderId    : the webContents id we forward output to (stable across Cmd+R)
 * The buffer is capped so long-running TUIs don't grow it unbounded.
 */
const sessions = new Map();
const MAX_REPLAY_BYTES = 256 * 1024; // 256 KB per session — enough to redraw alt-screen

/**
 * Mirror claude code's folder-name encoding for ~/.claude/projects/. Every
 * non [A-Za-z0-9-] character becomes a single dash. Slashes, underscores,
 * spaces and dots all collapse the same way.
 *
 *   /Users/marcel/projects/Julis_style → -Users-marcel-projects-Julis-style
 *   /Users/marcel/Burko-Clone/Burkowski → -Users-marcel-Burko-Clone-Burkowski
 */
function encodeClaudeProjectPath(cwd) {
  return cwd.replace(/[^a-zA-Z0-9-]/g, '-');
}

function resolveClaudeBinary() {
  const candidates = [
    process.env.CC_CHAMBER_CLAUDE_BIN,
    path.join(os.homedir(), '.claude', 'local', 'claude'),
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude',
  ].filter(Boolean);
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {}
  }
  return 'claude';
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0d0d10',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 14 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Surface renderer errors in main-process console (helpful when the
  // window is blank because the React tree crashed before mount).
  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('[renderer] gone:', details);
  });
  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error(`[renderer] did-fail-load ${code} ${desc} url=${url}`);
  });
  win.webContents.on('console-message', (_e, level, msg, line, src) => {
    const tag = ['log', 'warn', 'error', 'info'][level] || 'log';
    console.log(`[renderer ${tag}] ${msg} (${src}:${line})`);
  });
  win.webContents.on('preload-error', (_e, preloadPath, err) => {
    console.error(`[preload-error] ${preloadPath}:`, err);
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  return win;
}

function buildEnv() {
  const env = { ...process.env };

  // Strip Electron / Node helper vars that confuse downstream CLIs.
  // These get inherited from the renderer-host process and Node tools
  // (claude is bundled with Node) may mis-detect a headless runtime.
  const DROP = [
    'ELECTRON_RUN_AS_NODE',
    'ELECTRON_NO_ASAR',
    'ELECTRON_NO_ATTACH_CONSOLE',
    'NODE_OPTIONS',
    'NODE_ENV',
    'CHROME_DESKTOP',
    'ORIGINAL_XDG_CURRENT_DESKTOP',
    'GTK_MODULES',
  ];
  for (const k of DROP) delete env[k];

  const extra = [
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
    path.join(os.homedir(), '.claude', 'local'),
  ];
  const parts = (env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const p of extra) if (!parts.includes(p)) parts.unshift(p);
  env.PATH = parts.join(path.delimiter);
  env.TERM = 'xterm-256color';
  env.COLORTERM = 'truecolor';
  env.FORCE_COLOR = '1';
  // Tell claude it's a real interactive terminal.
  env.CI = '';
  return env;
}

/**
 * Try to reattach to an existing PTY by sessionId. Returns the replay buffer
 * so the freshly mounted xterm can re-render the screen exactly as it was.
 * If no PTY exists, returns `{ok:true, exists:false}` and the renderer
 * should fall through to pty:spawn.
 */
ipcMain.handle('pty:attach', (event, { sessionId } = {}) => {
  if (!sessionId) return { ok: false, error: 'sessionId required' };
  const entry = sessions.get(sessionId);
  if (!entry) return { ok: true, exists: false };

  // Update the receiver — this matters when Electron decides to reuse the
  // same webContents but assigns it a slightly different id (rare).
  entry.senderId = event.sender.id;

  const replay = entry.buffer.join('');
  return {
    ok: true,
    exists: true,
    pid: entry.proc.pid,
    bin: entry.bin,
    args: entry.args,
    replay,
  };
});

ipcMain.handle('pty:spawn', (event, opts) => {
  const {
    sessionId,
    cwd,
    skipPermissions,
    mode,
    resume,
    resumeSessionId,
    cols: requestedCols,
    rows: requestedRows,
  } = opts || {};

  // We expect callers to have tried pty:attach first. If a PTY for this id
  // already exists, return it without respawning — preserves the live shell
  // across renderer reloads.
  if (sessions.has(sessionId)) {
    const entry = sessions.get(sessionId);
    entry.senderId = event.sender.id;
    return {
      ok: true,
      pid: entry.proc.pid,
      bin: entry.bin,
      args: entry.args,
      reattached: true,
      replay: entry.buffer.join(''),
    };
  }

  const useClaude = mode !== 'shell';
  const bin = useClaude ? resolveClaudeBinary() : (process.env.SHELL || '/bin/zsh');
  const args = useClaude
    ? [
        ...(resumeSessionId
          ? ['--resume', resumeSessionId]
          : resume
          ? ['--continue']
          : []),
        ...(skipPermissions ? ['--dangerously-skip-permissions'] : []),
      ]
    : ['-l'];

  // Default to a comfortable size if the renderer didn't measure yet.
  const startCols = Math.max(40, Math.min(requestedCols || 120, 500));
  const startRows = Math.max(10, Math.min(requestedRows || 32, 200));

  let proc;
  try {
    proc = pty.spawn(bin, args, {
      name: 'xterm-256color',
      cols: startCols,
      rows: startRows,
      cwd: cwd && fs.existsSync(cwd) ? cwd : os.homedir(),
      env: buildEnv(),
    });
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }

  const channel = `pty:data:${sessionId}`;
  const exitChannel = `pty:exit:${sessionId}`;

  const entry = {
    proc,
    bin,
    args,
    buffer: [],
    bufferBytes: 0,
    senderId: event.sender.id,
  };
  sessions.set(sessionId, entry);

  proc.onData((data) => {
    const current = sessions.get(sessionId);
    if (!current || current.proc !== proc) return;

    // Append to ring buffer (cap total bytes)
    current.buffer.push(data);
    current.bufferBytes += data.length;
    while (current.bufferBytes > MAX_REPLAY_BYTES && current.buffer.length > 1) {
      current.bufferBytes -= current.buffer[0].length;
      current.buffer.shift();
    }

    const wc = BrowserWindow.fromId(current.senderId)?.webContents ?? event.sender;
    if (wc && !wc.isDestroyed()) wc.send(channel, data);
  });
  proc.onExit(({ exitCode, signal }) => {
    const current = sessions.get(sessionId);
    if (!current || current.proc !== proc) return;
    const wc = BrowserWindow.fromId(current.senderId)?.webContents ?? event.sender;
    if (wc && !wc.isDestroyed()) wc.send(exitChannel, { exitCode, signal });
    sessions.delete(sessionId);
  });

  return { ok: true, pid: proc.pid, bin, args };
});

ipcMain.handle('pty:write', (_e, { sessionId, data }) => {
  const entry = sessions.get(sessionId);
  if (!entry) return { ok: false, error: 'no-session' };
  entry.proc.write(data);
  return { ok: true };
});

ipcMain.handle('pty:resize', (_e, { sessionId, cols, rows }) => {
  const entry = sessions.get(sessionId);
  if (!entry) return { ok: false };
  try {
    entry.proc.resize(Math.max(1, cols | 0), Math.max(1, rows | 0));
  } catch {}
  return { ok: true };
});

ipcMain.handle('pty:kill', (_e, { sessionId }) => {
  const entry = sessions.get(sessionId);
  if (!entry) return { ok: false };
  try { entry.proc.kill(); } catch {}
  sessions.delete(sessionId);
  return { ok: true };
});

ipcMain.handle('fs:pickDirectory', async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const res = await dialog.showOpenDialog(win, {
    properties: ['openDirectory', 'createDirectory'],
  });
  if (res.canceled || !res.filePaths.length) return null;
  return res.filePaths[0];
});

ipcMain.handle('fs:pickFiles', async (e, opts = {}) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const props = ['openFile'];
  if (opts.multi) props.push('multiSelections');
  if (opts.defaultPath && !fs.existsSync(opts.defaultPath)) {
    delete opts.defaultPath;
  }
  const res = await dialog.showOpenDialog(win, {
    properties: props,
    defaultPath: opts.defaultPath,
    filters: opts.filters,
  });
  if (res.canceled || !res.filePaths.length) return [];
  return res.filePaths;
});

const HIDDEN_DIRS = new Set([
  'node_modules',
  '.next',
  '.turbo',
  '.cache',
  'dist',
  'build',
  'release',
  '.DS_Store',
]);

ipcMain.handle('fs:list', async (_e, { dirPath }) => {
  try {
    const stat = await fsp.stat(dirPath);
    if (!stat.isDirectory()) return { ok: false, error: 'not-a-directory' };
    const entries = await fsp.readdir(dirPath, { withFileTypes: true });
    const items = entries
      .filter((d) => !HIDDEN_DIRS.has(d.name))
      .map((d) => {
        const full = path.join(dirPath, d.name);
        const isDir = d.isDirectory();
        const isHidden = d.name.startsWith('.');
        let size;
        try {
          if (!isDir) size = fs.statSync(full).size;
        } catch {}
        return {
          name: d.name,
          path: full,
          type: isDir ? 'dir' : d.isSymbolicLink() ? 'link' : 'file',
          hidden: isHidden,
          size,
        };
      })
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
        if (a.hidden !== b.hidden) return a.hidden ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });
    return { ok: true, items };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle('app:homedir', () => os.homedir());
ipcMain.handle('app:claudeBin', () => resolveClaudeBinary());

ipcMain.handle('fs:readFile', async (_e, { filePath } = {}) => {
  try {
    if (!filePath) return { ok: false, error: 'filePath required' };
    const stat = await fsp.stat(filePath);
    if (!stat.isFile()) return { ok: false, error: 'not-a-file' };
    if (stat.size > 5 * 1024 * 1024) {
      return { ok: false, error: 'file-too-large', size: stat.size };
    }
    const raw = await fsp.readFile(filePath);
    // Cheap binary heuristic: NUL byte in the first 8 KB.
    const head = raw.subarray(0, Math.min(raw.length, 8192));
    if (head.includes(0)) {
      return { ok: false, error: 'binary', size: stat.size };
    }
    return {
      ok: true,
      content: raw.toString('utf8'),
      size: stat.size,
      mtimeMs: stat.mtimeMs,
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('fs:writeFile', async (_e, { filePath, content } = {}) => {
  try {
    if (!filePath) return { ok: false, error: 'filePath required' };
    await fsp.writeFile(filePath, content, 'utf8');
    const stat = await fsp.stat(filePath);
    return { ok: true, size: stat.size, mtimeMs: stat.mtimeMs };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// List all on-disk claude sessions for a given cwd. Returns metadata only —
// session id, mtime, message count, optional ai-generated title, first user
// prompt. Used by the sidebar to show resumable conversations.
ipcMain.handle('claude:listSessions', async (_e, { cwd } = {}) => {
  try {
    if (!cwd) return { ok: false, error: 'cwd required' };
    const encoded = encodeClaudeProjectPath(cwd);
    const dir = path.join(os.homedir(), '.claude', 'projects', encoded);
    if (!fs.existsSync(dir)) return { ok: true, sessions: [] };

    const entries = (await fsp.readdir(dir, { withFileTypes: true })).filter(
      (d) => d.isFile() && d.name.endsWith('.jsonl'),
    );

    const sessions = await Promise.all(
      entries.map(async (d) => {
        const file = path.join(dir, d.name);
        const stat = await fsp.stat(file);
        const sessionId = d.name.replace(/\.jsonl$/, '');

        // Read just enough lines to find a title + first user message.
        // Files can be huge (MB), so don't slurp everything.
        let title = null;
        let firstUserPrompt = null;
        let messageCount = 0;
        try {
          const raw = await fsp.readFile(file, 'utf8');
          for (const line of raw.split('\n')) {
            if (!line.trim()) continue;
            let entry;
            try {
              entry = JSON.parse(line);
            } catch {
              continue;
            }
            if (entry.type === 'ai-title' && entry.aiTitle && !title) {
              title = entry.aiTitle;
            }
            if (entry.type === 'user' && !firstUserPrompt) {
              const msg = entry.message;
              let text = '';
              if (typeof msg?.content === 'string') text = msg.content;
              else if (Array.isArray(msg?.content)) {
                text = msg.content
                  .filter((b) => b.type === 'text')
                  .map((b) => b.text || '')
                  .join(' ');
              }
              text = text.trim();
              // Skip "tool_result" pseudo-user-messages
              if (text && text.length > 1 && !text.startsWith('[{')) {
                firstUserPrompt = text.slice(0, 200);
              }
            }
            if (entry.type === 'user' || entry.type === 'assistant') {
              messageCount += 1;
            }
          }
        } catch {}

        return {
          sessionId,
          mtime: stat.mtimeMs,
          size: stat.size,
          title,
          firstUserPrompt,
          messageCount,
        };
      }),
    );

    sessions.sort((a, b) => b.mtime - a.mtime);
    return { ok: true, sessions };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// Read a claude code session log from disk. Each TUI conversation is stored
// as JSONL under ~/.claude/projects/<encoded-cwd>/<session-id>.jsonl. We use
// this to show the live terminal session as formatted chat bubbles.
ipcMain.handle('claude:readSession', async (_e, opts) => {
  try {
    const { cwd, sessionId } = opts || {};
    if (!cwd) return { ok: false, error: 'cwd required' };

    const encoded = encodeClaudeProjectPath(cwd);
    const projectsDir = path.join(os.homedir(), '.claude', 'projects', encoded);
    if (!fs.existsSync(projectsDir)) {
      return { ok: true, sessionId: null, messages: [], available: false };
    }

    let targetFile;
    if (sessionId) {
      targetFile = path.join(projectsDir, `${sessionId}.jsonl`);
      if (!fs.existsSync(targetFile)) {
        return { ok: false, error: `session ${sessionId} not found` };
      }
    } else {
      // pick most recently modified
      const entries = (await fsp.readdir(projectsDir, { withFileTypes: true }))
        .filter((d) => d.isFile() && d.name.endsWith('.jsonl'));
      if (entries.length === 0) {
        return { ok: true, sessionId: null, messages: [], available: false };
      }
      const stats = await Promise.all(
        entries.map(async (d) => ({
          name: d.name,
          mtime: (await fsp.stat(path.join(projectsDir, d.name))).mtimeMs,
        })),
      );
      stats.sort((a, b) => b.mtime - a.mtime);
      targetFile = path.join(projectsDir, stats[0].name);
    }

    const raw = await fsp.readFile(targetFile, 'utf8');
    const lines = raw.split('\n').filter((l) => l.trim().length > 0);
    const messages = [];
    let resolvedSessionId = null;

    for (const line of lines) {
      let entry;
      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }
      if (entry.sessionId && !resolvedSessionId) resolvedSessionId = entry.sessionId;
      if (entry.type !== 'user' && entry.type !== 'assistant') continue;

      const msg = entry.message;
      if (!msg) continue;

      // Normalise content to a structured array of blocks
      let blocks = [];
      if (typeof msg.content === 'string') {
        blocks = [{ type: 'text', text: msg.content }];
      } else if (Array.isArray(msg.content)) {
        blocks = msg.content.map((b) => {
          if (b.type === 'text') return { type: 'text', text: b.text ?? '' };
          if (b.type === 'thinking') return { type: 'thinking', text: b.thinking ?? '' };
          if (b.type === 'tool_use') {
            return {
              type: 'tool_use',
              name: b.name ?? 'tool',
              input: b.input ?? {},
              id: b.id,
            };
          }
          if (b.type === 'tool_result') {
            let text = '';
            if (typeof b.content === 'string') text = b.content;
            else if (Array.isArray(b.content)) {
              text = b.content
                .filter((c) => c.type === 'text')
                .map((c) => c.text)
                .join('\n');
            }
            return {
              type: 'tool_result',
              toolUseId: b.tool_use_id,
              text,
              isError: !!b.is_error,
            };
          }
          if (b.type === 'image') return { type: 'image', source: 'attached' };
          return { type: 'text', text: JSON.stringify(b).slice(0, 200) };
        });
      }

      messages.push({
        id: entry.uuid ?? String(messages.length),
        role: entry.type, // 'user' | 'assistant'
        blocks,
        ts: entry.timestamp ? new Date(entry.timestamp).getTime() : 0,
      });
    }

    if (!resolvedSessionId) {
      // fallback: filename without extension
      const base = path.basename(targetFile, '.jsonl');
      if (/^[a-f0-9-]{36}$/i.test(base)) resolvedSessionId = base;
    }

    return {
      ok: true,
      sessionId: resolvedSessionId,
      messages,
      available: true,
      sourceFile: targetFile,
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// Headless claude run for the chat mode. Spawns `claude -p ... --output-format json`,
// optionally with --resume to keep multi-turn context.
ipcMain.handle('claude:run', async (_e, opts) => {
  const {
    message,
    cwd,
    sessionId,
    model,
    skipPermissions,
  } = opts || {};
  if (!message || typeof message !== 'string') {
    return { ok: false, error: 'empty-message' };
  }

  const bin = resolveClaudeBinary();
  const args = ['-p', message, '--output-format', 'json'];
  if (sessionId) args.push('--resume', sessionId);
  if (model && model !== 'default') args.push('--model', model);
  if (skipPermissions) args.push('--dangerously-skip-permissions');

  const child = spawn(bin, args, {
    cwd: cwd && fs.existsSync(cwd) ? cwd : os.homedir(),
    env: buildEnv(),
    shell: false,
  });

  let stdout = '';
  let stderr = '';
  let exited = false;

  child.stdout.on('data', (b) => {
    stdout += b.toString('utf8');
  });
  child.stderr.on('data', (b) => {
    stderr += b.toString('utf8');
  });

  return await new Promise((resolve) => {
    child.on('error', (err) => {
      if (exited) return;
      exited = true;
      resolve({ ok: false, error: err.message, stdout, stderr });
    });
    child.on('exit', (code, signal) => {
      if (exited) return;
      exited = true;
      // Try to parse a JSON object from stdout. claude -p --output-format json
      // returns either a single JSON object or a stream — we accept both.
      let parsed = null;
      try {
        const trimmed = stdout.trim();
        if (trimmed.startsWith('{')) {
          parsed = JSON.parse(trimmed);
        } else if (trimmed.includes('\n{')) {
          // ndjson — pick the last object that has a "result" or "text"
          const lines = trimmed.split('\n').filter((l) => l.startsWith('{'));
          for (let i = lines.length - 1; i >= 0; i--) {
            try {
              const obj = JSON.parse(lines[i]);
              parsed = obj;
              break;
            } catch {}
          }
        }
      } catch {}
      resolve({
        ok: code === 0,
        code,
        signal,
        stdout,
        stderr,
        parsed,
      });
    });
  });
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  for (const [id, proc] of sessions) {
    try { proc.kill(); } catch {}
    sessions.delete(id);
  }
  if (process.platform !== 'darwin') app.quit();
});
