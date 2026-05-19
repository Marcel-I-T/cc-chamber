export interface SpawnOpts {
  sessionId: string;
  cwd?: string;
  skipPermissions?: boolean;
  mode?: 'claude' | 'shell';
  resume?: boolean;
  resumeSessionId?: string;
  cols?: number;
  rows?: number;
}

export interface SpawnResult {
  ok: boolean;
  pid?: number;
  bin?: string;
  args?: string[];
  error?: string;
  reattached?: boolean;
  replay?: string;
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
        attach: (sessionId: string) => Promise<{
          ok: boolean;
          exists?: boolean;
          pid?: number;
          bin?: string;
          args?: string[];
          replay?: string;
          error?: string;
        }>;
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
        readSession: (opts: {
          cwd: string;
          sessionId?: string;
        }) => Promise<{
          ok: boolean;
          sessionId?: string | null;
          messages?: TuiMessage[];
          available?: boolean;
          sourceFile?: string;
          error?: string;
        }>;
        listSessions: (opts: { cwd: string }) => Promise<{
          ok: boolean;
          sessions?: PastSession[];
          error?: string;
        }>;
      };
    };
  }
}

export type ClaudeBlock =
  | { type: 'text'; text: string }
  | { type: 'thinking'; text: string }
  | { type: 'tool_use'; name: string; input: unknown; id?: string }
  | {
      type: 'tool_result';
      toolUseId?: string;
      text: string;
      isError?: boolean;
    }
  | { type: 'image'; source: string };

export interface PastSession {
  sessionId: string;
  mtime: number;
  size: number;
  title: string | null;
  firstUserPrompt: string | null;
  messageCount: number;
}

export interface TuiMessage {
  id: string;
  role: 'user' | 'assistant';
  blocks: ClaudeBlock[];
  ts: number;
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
