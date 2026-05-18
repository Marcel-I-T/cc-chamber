#!/usr/bin/env node
/**
 * cc-chamber — desktop launcher for Claude Code
 *
 * Auto-builds the UI on first run if dist/ is missing, then spawns Electron
 * pointing at the project root. Use --dev to skip the build step and run
 * the live Vite+Electron dev pipeline instead.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), '..');
const distIndex = path.join(root, 'dist', 'index.html');
const pkgPath = path.join(root, 'package.json');
const flags = new Set(process.argv.slice(2));

if (flags.has('--help') || flags.has('-h')) {
  console.log(
    [
      'cc-chamber — Claude Code desktop wrapper',
      '',
      'Usage:',
      '  cc-chamber            launch (auto-builds UI if needed)',
      '  cc-chamber --dev      run Vite + Electron dev (HMR)',
      '  cc-chamber --build    rebuild UI bundle without launching',
      '  cc-chamber --version  print version',
      '',
    ].join('\n'),
  );
  process.exit(0);
}

if (flags.has('--version') || flags.has('-v')) {
  const pkg = JSON.parse(await import('node:fs/promises').then((m) => m.readFile(pkgPath, 'utf8')));
  console.log(pkg.version);
  process.exit(0);
}

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { stdio: 'inherit', cwd: root, ...opts });
}

if (flags.has('--build')) {
  const r = run('npm', ['run', 'build']);
  process.exit(r.status ?? 1);
}

if (flags.has('--dev')) {
  const r = run('npm', ['run', 'dev']);
  process.exit(r.status ?? 1);
}

// Default flow: ensure native PTY is built, then bundle, then launch.
const ptyBinary = path.join(root, 'node_modules', 'node-pty', 'build', 'Release', 'pty.node');
if (!existsSync(ptyBinary)) {
  console.log('[cc-chamber] building native PTY…');
  const r = run('npm', ['run', 'rebuild']);
  if (r.status !== 0) {
    console.error('[cc-chamber] PTY build failed.');
    process.exit(r.status ?? 1);
  }
}

if (!existsSync(distIndex)) {
  console.log('[cc-chamber] building UI…');
  const r = run('npm', ['run', 'build']);
  if (r.status !== 0) {
    console.error('[cc-chamber] UI build failed.');
    process.exit(r.status ?? 1);
  }
}

// Launch Electron pointing at the packaged dist/.
const electronPathMod = await import('electron');
const electronExe = electronPathMod.default || electronPathMod;
const child = spawn(electronExe, [root], {
  stdio: 'inherit',
  cwd: root,
  env: process.env,
});
child.on('exit', (code) => process.exit(code ?? 0));
