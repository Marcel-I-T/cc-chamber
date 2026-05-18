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
const isDev = process.env.CKAUDE_DEV === '1' || !app.isPackaged;

app.setName('ckaude');

if (!app.requestSingleInstanceLock()) {
  app.exit(0);
  process.exit(0);
}

const sessions = new Map();

function resolveClaudeBinary() {
  const candidates = [
    process.env.CKAUDE_CLAUDE_BIN,
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
      preload: path.join(__dirname, 'preload.mjs'),
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

ipcMain.handle('pty:spawn', (event, { sessionId, cwd, skipPermissions, mode, resume }) => {
  if (sessions.has(sessionId)) {
    return { ok: false, error: 'session-exists' };
  }

  const useClaude = mode !== 'shell';
  const bin = useClaude ? resolveClaudeBinary() : (process.env.SHELL || '/bin/zsh');
  const args = useClaude
    ? [
        ...(resume ? ['--continue'] : []),
        ...(skipPermissions ? ['--dangerously-skip-permissions'] : []),
      ]
    : ['-l'];

  let proc;
  try {
    proc = pty.spawn(bin, args, {
      name: 'xterm-256color',
      cols: 100,
      rows: 30,
      cwd: cwd && fs.existsSync(cwd) ? cwd : os.homedir(),
      env: buildEnv(),
    });
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }

  const senderId = event.sender.id;
  const channel = `pty:data:${sessionId}`;
  const exitChannel = `pty:exit:${sessionId}`;

  proc.onData((data) => {
    const wc = BrowserWindow.fromId(senderId)?.webContents ?? event.sender;
    if (wc && !wc.isDestroyed()) wc.send(channel, data);
  });
  proc.onExit(({ exitCode, signal }) => {
    const wc = BrowserWindow.fromId(senderId)?.webContents ?? event.sender;
    if (wc && !wc.isDestroyed()) wc.send(exitChannel, { exitCode, signal });
    sessions.delete(sessionId);
  });

  sessions.set(sessionId, proc);
  return { ok: true, pid: proc.pid, bin, args };
});

ipcMain.handle('pty:write', (_e, { sessionId, data }) => {
  const proc = sessions.get(sessionId);
  if (!proc) return { ok: false, error: 'no-session' };
  proc.write(data);
  return { ok: true };
});

ipcMain.handle('pty:resize', (_e, { sessionId, cols, rows }) => {
  const proc = sessions.get(sessionId);
  if (!proc) return { ok: false };
  try {
    proc.resize(Math.max(1, cols | 0), Math.max(1, rows | 0));
  } catch {}
  return { ok: true };
});

ipcMain.handle('pty:kill', (_e, { sessionId }) => {
  const proc = sessions.get(sessionId);
  if (!proc) return { ok: false };
  try { proc.kill(); } catch {}
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
