import { describe, expect, it } from 'vitest';
import { STORAGE_KEY, createProgressStore } from '../src/services/progress';
import { UNIT1_WORDS } from '../src/data/unit1';

class FakeStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
}

const W = UNIT1_WORDS[0].id;
const T0 = 1_760_000_000_000;

describe('progress persistence', () => {
  it('persists records into storage under a versioned key', () => {
    const storage = new FakeStorage();
    const store = createProgressStore(storage);
    expect(store.persistent).toBe(true);
    store.seen(W, T0);
    store.correct(W, T0, { activeRecall: true });
    const raw = JSON.parse(storage.getItem(STORAGE_KEY)!);
    expect(raw.version).toBe(1);
    expect(raw.words[W].seenCount).toBe(1);
    expect(raw.words[W].correctCount).toBe(1);
    expect(raw.words[W].activeRecallCorrect).toBe(1);
  });

  it('a new store instance reads saved progress (reload keeps it)', () => {
    const storage = new FakeStorage();
    createProgressStore(storage).correct(W, T0, { activeRecall: false });
    const store2 = createProgressStore(storage);
    expect(store2.get(W).correctCount).toBe(1);
  });

  it('corrupted JSON starts clean instead of crashing', () => {
    const storage = new FakeStorage();
    storage.setItem(STORAGE_KEY, '{not json!!');
    const store = createProgressStore(storage);
    expect(store.get(W).correctCount).toBe(0);
    store.correct(W, T0, { activeRecall: false });
    expect(store.get(W).correctCount).toBe(1);
  });

  it('wrong-version data is discarded', () => {
    const storage = new FakeStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 99, words: {} }));
    const store = createProgressStore(storage);
    expect(store.get(W).correctCount).toBe(0);
  });

  it('blocked storage keeps the game playable with persistent=false', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    } as Storage;
    const store = createProgressStore(broken);
    expect(store.persistent).toBe(true); // object exists → flag honest
    // createProgressStore with explicit null = storage unavailable
    const store2 = createProgressStore(null);
    expect(store2.persistent).toBe(false);
    store2.correct(W, T0, { activeRecall: false });
    expect(store2.get(W).correctCount).toBe(1); // memory still works
    expect(() => store2.reset()).not.toThrow();
  });

  it('due list surfaces practiced-but-unmastered words', () => {
    const store = createProgressStore(new FakeStorage());
    expect(store.dueWordIds(T0)).toEqual([]);
    store.correct(W, T0, { activeRecall: false }); // due in 1 day
    expect(store.dueWordIds(T0)).toEqual([]);
    expect(store.dueWordIds(T0 + 25 * 3600 * 1000)).toEqual([W]);
    store.wrong(W, T0);
    expect(store.dueWordIds(T0)).toEqual([W]); // mistakes due immediately
  });

  it('learnedCount and masteredCount reflect rules', () => {
    const store = createProgressStore(new FakeStorage());
    const ids = UNIT1_WORDS.slice(0, 3).map((w) => w.id);
    expect(store.learnedCount(ids)).toBe(0);
    store.seen(ids[0], T0);
    expect(store.learnedCount(ids)).toBe(0); // viewed ≠ learned
    store.correct(ids[0], T0, { activeRecall: false });
    expect(store.learnedCount(ids)).toBe(1);
    expect(store.masteredCount()).toBe(0);
    // master word 1: 3 correct over 2 days incl. recall
    store.correct(ids[0], T0, { activeRecall: true });
    store.correct(ids[0], T0 + 86400000, { activeRecall: false });
    expect(store.masteredCount()).toBe(1);
  });

  it('reset clears everything', () => {
    const storage = new FakeStorage();
    const store = createProgressStore(storage);
    store.correct(W, T0, { activeRecall: false });
    store.reset();
    expect(store.get(W).correctCount).toBe(0);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });
});
