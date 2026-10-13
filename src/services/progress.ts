import {
  emptyProgress,
  isDue,
  recordCorrect,
  recordSeen,
  recordWrong,
  type WordProgress,
} from '../domain/repetition';
import { UNIT1_WORDS } from '../data/unit1';

export const STORAGE_KEY = 'wordquest-progress-v1';
export const STORAGE_VERSION = 1;

interface ProgressFile {
  version: number;
  words: Record<string, WordProgress>;
}

export interface ProgressStore {
  /** false when localStorage is blocked — game still runs on memory only. */
  persistent: boolean;
  get(wordId: string): WordProgress;
  seen(wordId: string, now?: number): void;
  correct(wordId: string, now: number, opts: { activeRecall: boolean }): void;
  wrong(wordId: string, now?: number): void;
  /** Due (non-mastered, scheduled) words across all lessons. */
  dueWordIds(now: number): string[];
  /** Words answered correctly at least once, per lesson counting. */
  learnedCount(wordIds: readonly string[]): number;
  masteredCount(): number;
  reset(): void;
}

function migrate(raw: unknown): ProgressFile | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const f = raw as Partial<ProgressFile>;
  if (f.version !== STORAGE_VERSION || typeof f.words !== 'object' || f.words === null) {
    return null;
  }
  const words: Record<string, WordProgress> = {};
  for (const w of UNIT1_WORDS) {
    const p = (f.words as Record<string, WordProgress>)[w.id];
    if (p && typeof p === 'object' && typeof p.wordId === 'string') {
      words[w.id] = { ...emptyProgress(w.id), ...p, wordId: w.id };
    }
  }
  return { version: STORAGE_VERSION, words };
}

function safeLocalStorage(): Storage | null {
  try {
    const s = globalThis.localStorage;
    if (!s) return null;
    const probe = '__wq_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export function createProgressStore(storage?: Storage | null): ProgressStore {
  const backend = storage === undefined ? safeLocalStorage() : storage;
  let file: ProgressFile = { version: STORAGE_VERSION, words: {} };

  if (backend) {
    try {
      const raw = backend.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = migrate(JSON.parse(raw));
        if (parsed) file = parsed;
        // Corrupted or old-version data → start clean, never crash.
      }
    } catch {
      file = { version: STORAGE_VERSION, words: {} };
    }
  }

  function persist(): void {
    if (!backend) return;
    try {
      backend.setItem(STORAGE_KEY, JSON.stringify(file));
    } catch {
      // Quota/serialization failure — keep playing without persistence.
    }
  }

  function get(wordId: string): WordProgress {
    return file.words[wordId] ?? emptyProgress(wordId);
  }

  function put(p: WordProgress): void {
    file.words[p.wordId] = p;
    persist();
  }

  return {
    persistent: backend !== null,
    get,
    seen(wordId, now = Date.now()) {
      put(recordSeen(get(wordId), now));
    },
    correct(wordId, now, opts) {
      put(recordCorrect(get(wordId), now, opts));
    },
    wrong(wordId, now = Date.now()) {
      put(recordWrong(get(wordId), now));
    },
    dueWordIds(now) {
      return UNIT1_WORDS.filter((w) => isDue(get(w.id), now)).map((w) => w.id);
    },
    learnedCount(wordIds) {
      return wordIds.filter((id) => get(id).correctCount > 0).length;
    },
    masteredCount() {
      return UNIT1_WORDS.filter((w) => get(w.id).mastered).length;
    },
    reset() {
      file = { version: STORAGE_VERSION, words: {} };
      if (backend) {
        try {
          backend.removeItem(STORAGE_KEY);
        } catch {
          /* ignore */
        }
      }
    },
  };
}
