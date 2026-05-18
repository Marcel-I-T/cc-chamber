export interface SpawnOpts {
  sessionId: string;
  cwd?: string;
  skipPermissions?: boolean;
  mode?: 'claude' | 'shell';
  resume?: boolean;
}

export interface SpawnResult {
  ok: boolean;
  pid?: number;
  bin?: string;
  args?: string[];
  error?: string;
}

export interface FsEntry {
  name: string;
  path: string;
  type: 'dir' | 'file' | 'link';
  hidden: boolean;
  size?: number;
}

declare global {
  interface Window {
    api: {
      pty: {
        spawn: (opts: SpawnOpts) => Promise<SpawnResult>;
        write: (sessionId: string, data: string) => Promise<{ ok: boolean }>;
        resize: (sessionId: string, cols: number, rows: number) => Promise<{ ok: boolean }>;
        kill: (sessionId: string) => Promise<{ ok: boolean }>;
        onData: (sessionId: string, handler: (data: string) => void) => () => void;
        onExit: (
          sessionId: string,
          handler: (info: { exitCode: number; signal?: number }) => void
        ) => () => void;
      };
      fs: {
        pickDirectory: () => Promise<string | null>;
        list: (dirPath: string) => Promise<{
          ok: boolean;
          items?: FsEntry[];
          error?: string;
        }>;
      };
      app: {
        homedir: () => Promise<string>;
        claudeBin: () => Promise<string>;
      };
      claude: {
        run: (opts: {
          message: string;
          cwd: string;
          sessionId?: string;
          model?: 'default' | 'sonnet' | 'opus';
          skipPermissions?: boolean;
        }) => Promise<{
          ok: boolean;
          code?: number;
          signal?: number;
          stdout?: string;
          stderr?: string;
          parsed?: ClaudeRunResult | null;
          error?: string;
        }>;
      };
    };
  }
}

export interface ClaudeRunResult {
  type?: string;
  subtype?: string;
  result?: string;
  session_id?: string;
  duration_ms?: number;
  total_cost_usd?: number;
  is_error?: boolean;
  num_turns?: number;
}

export {};
