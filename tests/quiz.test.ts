import { describe, expect, it } from 'vitest';
import { LESSONS, UNIT1_WORDS } from '../src/data/unit1';
import {
  MAX_RETRIES_PER_WORD,
  advance,
  buildLessonQuestions,
  buildReviewQuestions,
  createSession,
  currentQuestion,
  lessonPoolFor,
  makePictureQuestion,
  makeSpellQuestion,
  makeTranslateQuestion,
  markAnswered,
  placeTile,
  removeLastTile,
  removeTile,
  resetTiles,
  shuffled,
  spellingIsCorrect,
  tilesToWord,
  type Rng,
  type Tile,
} from '../src/domain/quiz';

/** Deterministic seeded RNG (mulberry32) for repeatable tests. */
function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ALL_SEEDS = [1, 7, 42, 1337, 2026];

describe('mode A — Izvēlies tulkojumu', () => {
  it('always offers 4 distinct options incl. exactly one correct', () => {
    for (const seed of ALL_SEEDS) {
      for (const lesson of LESSONS) {
        for (const w of lesson.words) {
          const q = makeTranslateQuestion(w, lesson.words, seeded(seed));
          expect(q.options).toHaveLength(4);
          const ids = q.options.map((o) => o.wordId);
          expect(new Set(ids).size).toBe(4);
          expect(ids.filter((id) => id === w.id)).toHaveLength(1);
          expect(q.options[q.correctOptionIndex].wordId).toBe(w.id);
          expect(q.options[q.correctOptionIndex].lv).toBe(w.lv);
          // distractors come from the same lesson
          for (const o of q.options) {
            expect(lesson.words.some((lw) => lw.id === o.wordId)).toBe(true);
          }
        }
      }
    }
  });
});

describe('mode B — Atrodi attēlu', () => {
  it('offers 4 distinct same-lesson illustrations', () => {
    for (const seed of ALL_SEEDS) {
      for (const lesson of LESSONS) {
        for (const w of lesson.words) {
          const q = makePictureQuestion(w, lesson.words, seeded(seed));
          expect(q.options).toHaveLength(4);
          expect(new Set(q.options.map((o) => o.id)).size).toBe(4);
          expect(q.options[q.correctOptionIndex].id).toBe(w.id);
          for (const o of q.options) {
            expect(lesson.words.some((lw) => lw.id === o.id)).toBe(true);
          }
        }
      }
    }
  });
});

describe('mode C — Saliec vārdu', () => {
  it('tiles contain the exact word letters plus decoys', () => {
    for (const w of UNIT1_WORDS) {
      const q = makeSpellQuestion(w, seeded(99));
      const letters = q.tiles.map((t) => t.letter);
      for (const ch of w.en.toLowerCase()) {
        const count = letters.filter((l) => l === ch).length;
        const needed = w.en.toLowerCase().split('').filter((c) => c === ch).length;
        expect(count, `${w.en} letter ${ch}`).toBeGreaterThanOrEqual(needed);
      }
      expect(q.tiles.length).toBeGreaterThan(w.en.length); // decoys present
      // never pre-assembled
      expect(q.tiles.map((t) => t.letter).join('')).not.toBe(w.en.toLowerCase());
      // unique tile keys (repeated letters are separate tiles)
      expect(new Set(q.tiles.map((t) => t.key)).size).toBe(q.tiles.length);
    }
  });

  it('supports repeated letters, undo, remove, reset', () => {
    const tiles: Tile[] = [
      { key: 'a-c', letter: 'c' },
      { key: 'b-l', letter: 'l' },
      { key: 'c-a', letter: 'a' },
      { key: 'd-s1', letter: 's' },
      { key: 'e-s2', letter: 's' },
    ];
    let input = resetTiles();
    input = placeTile(input, tiles[0]);
    input = placeTile(input, tiles[3]);
    input = placeTile(input, tiles[4]); // two s tiles — both allowed
    input = placeTile(input, tiles[3]); // same tile twice — ignored
    expect(tilesToWord(input, tiles)).toBe('css');
    input = removeLastTile(input);
    expect(tilesToWord(input, tiles)).toBe('cs');
    input = removeTile(input, tiles[3]);
    expect(tilesToWord(input, tiles)).toBe('c');
    input = resetTiles();
    expect(input.placed).toHaveLength(0);
  });

  it('validates spelling case-insensitively and exactly', () => {
    expect(spellingIsCorrect('CLASSROOM', 'classroom')).toBe(true);
    expect(spellingIsCorrect(' ClassRoom ', 'classroom')).toBe(true);
    expect(spellingIsCorrect('clasroom', 'classroom')).toBe(false);
    expect(spellingIsCorrect('classroome', 'classroom')).toBe(false);
    expect(spellingIsCorrect('grey', 'gray')).toBe(false);
  });
});

describe('session flow', () => {
  it('buildLessonQuestions covers every word twice (incl. one spelling)', () => {
    for (const lesson of LESSONS) {
      const qs = buildLessonQuestions(lesson.words, lessonPoolFor(lesson.id), seeded(5));
      for (const w of lesson.words) {
        const forWord = qs.filter((q) => q.wordId === w.id);
        expect(forWord.length, w.id).toBe(2);
        expect(forWord.some((q) => q.kind === 'spell')).toBe(true);
      }
      expect(qs.length).toBe(lesson.words.length * 2);
    }
  });

  it('buildReviewQuestions covers each due word once', () => {
    const words = UNIT1_WORDS.slice(0, 5);
    const qs = buildReviewQuestions(words, lessonPoolFor, seeded(3));
    expect(new Set(qs.map((q) => q.wordId)).size).toBe(5);
    expect(qs).toHaveLength(5);
  });

  it('scores each question exactly once', () => {
    const lesson = LESSONS[0];
    const s = createSession(
      'lesson',
      buildLessonQuestions(lesson.words, lessonPoolFor(lesson.id), seeded(2)),
    );
    const first = currentQuestion(s)!;
    expect(markAnswered(s, true)).toEqual({ correct: true, wordId: first.wordId });
    expect(markAnswered(s, true)).toBeNull(); // double tap cannot re-score
    expect(markAnswered(s, false)).toBeNull();
    expect(s.correctWordIds).toEqual([first.wordId]);
  });

  it('re-queues missed words later, capped at MAX_RETRIES_PER_WORD', () => {
    const lesson = LESSONS[2]; // 4 words, 8 questions
    const rng = seeded(11);
    const s = createSession('lesson', buildLessonQuestions(lesson.words, lessonPoolFor(lesson.id), rng));
    const firstId = currentQuestion(s)!.wordId;
    const original = new Set(s.queue);
    const before = s.queue.length;
    markAnswered(s, false, rng);
    expect(s.queue.length).toBe(before + 1);
    // the regenerated retry lands 2–4 positions ahead — find it by identity
    const retryIndex = s.queue.findIndex((q, i) => i > s.index && !original.has(q));
    expect(retryIndex).toBeGreaterThanOrEqual(s.index + 3);
    expect(s.queue[retryIndex].wordId).toBe(firstId);
    // answer wrong until retry cap is exhausted → queue stops growing
    let guard = 0;
    while (guard++ < 50 && s.index < s.queue.length) {
      markAnswered(s, false, rng);
      advance(s);
    }
    expect(s.retriesUsed[firstId]).toBeLessThanOrEqual(MAX_RETRIES_PER_WORD);
    expect(s.index).toBeGreaterThan(0);
  });

  it('shuffled is a permutation and deterministic under a seed', () => {
    const items = [1, 2, 3, 4, 5, 6];
    expect(shuffled(items, seeded(1))).toEqual(shuffled(items, seeded(1)));
    expect(shuffled(items, seeded(1)).sort()).toEqual(items);
  });
});
