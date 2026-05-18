import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { shortId } from '@/lib/utils';

export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  ts: number;
  pending?: boolean;
  error?: string;
  durationMs?: number;
  costUsd?: number;
}

export interface ChatThread {
  /** Our own session id — matches Session.id when paired */
  ownerId: string;
  /** Claude's session_id, used for --resume on follow-up turns */
  claudeSessionId?: string;
  messages: ChatMessage[];
}

interface ChatStore {
  threads: Record<string, ChatThread>;

  getThread: (ownerId: string) => ChatThread;
  appendMessage: (ownerId: string, msg: Omit<ChatMessage, 'id' | 'ts'>) => ChatMessage;
  updateMessage: (ownerId: string, msgId: string, patch: Partial<ChatMessage>) => void;
  setClaudeSessionId: (ownerId: string, id: string) => void;
  clearThread: (ownerId: string) => void;
  removeThread: (ownerId: string) => void;
}

function ensureThread(threads: Record<string, ChatThread>, ownerId: string): ChatThread {
  return threads[ownerId] ?? { ownerId, messages: [] };
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      threads: {},

      getThread: (ownerId) => ensureThread(get().threads, ownerId),

      appendMessage: (ownerId, msg) => {
        const message: ChatMessage = {
          id: shortId(),
          ts: Date.now(),
          ...msg,
        };
        set((s) => {
          const cur = ensureThread(s.threads, ownerId);
          return {
            threads: {
              ...s.threads,
              [ownerId]: { ...cur, messages: [...cur.messages, message] },
            },
          };
        });
        return message;
      },

      updateMessage: (ownerId, msgId, patch) => {
        set((s) => {
          const cur = s.threads[ownerId];
          if (!cur) return s;
          return {
            threads: {
              ...s.threads,
              [ownerId]: {
                ...cur,
                messages: cur.messages.map((m) =>
                  m.id === msgId ? { ...m, ...patch } : m
                ),
              },
            },
          };
        });
      },

      setClaudeSessionId: (ownerId, id) => {
        set((s) => {
          const cur = ensureThread(s.threads, ownerId);
          return {
            threads: {
              ...s.threads,
              [ownerId]: { ...cur, claudeSessionId: id },
            },
          };
        });
      },

      clearThread: (ownerId) => {
        set((s) => ({
          threads: {
            ...s.threads,
            [ownerId]: { ownerId, messages: [] },
          },
        }));
      },

      removeThread: (ownerId) => {
        set((s) => {
          const next = { ...s.threads };
          delete next[ownerId];
          return { threads: next };
        });
      },
    }),
    {
      name: 'ckaude-chat',
      storage: createJSONStorage(() => localStorage),
      // strip the transient "pending" flag on persist so reload won't think
      // a half-sent turn is still in flight
      partialize: (state) => ({
        threads: Object.fromEntries(
          Object.entries(state.threads).map(([k, t]) => [
            k,
            {
              ...t,
              messages: t.messages.map((m) =>
                m.pending ? { ...m, pending: false, error: m.error ?? 'interrupted' } : m
              ),
            },
          ])
        ),
      }),
    }
  )
);
