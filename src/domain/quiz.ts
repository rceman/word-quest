import type { LessonId, WordEntry } from '../data/unit1';
import { getWord, UNIT1_WORDS } from '../data/unit1';

export function lessonPoolFor(lesson: LessonId): readonly WordEntry[] {
  return UNIT1_WORDS.filter((w) => w.lesson === lesson);
}

export type QuestionKind = 'translate' | 'picture' | 'spell';

export interface TranslateQuestion {
  kind: 'translate';
  wordId: string;
  /** Shuffled Latvian options; exactly one matches the word. */
  options: { wordId: string; lv: string }[];
  correctOptionIndex: number;
}

export interface PictureQuestion {
  kind: 'picture';
  wordId: string;
  /** Shuffled candidate words rendered as illustrations/swatches. */
  options: WordEntry[];
  correctOptionIndex: number;
}

export interface Tile {
  /** Unique per tile so repeated letters (classroom, playground) work. */
  key: string;
  letter: string;
}

export interface SpellQuestion {
  kind: 'spell';
  wordId: string;
  /** Scrambled letter tiles incl. decoys; child builds the English word. */
  tiles: Tile[];
}

export type Question = TranslateQuestion | PictureQuestion | SpellQuestion;

export type Rng = () => number;

/** Fisher–Yates with injectable randomness (tests pass a seeded rng). */
export function shuffled<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Pick `count` distinct distractors from the same lesson, excluding the
 * target word. Returns fewer only if the lesson is too small.
 */
export function pickDistractors(
  target: WordEntry,
  pool: readonly WordEntry[],
  count: number,
  rng: Rng = Math.random,
): WordEntry[] {
  const others = pool.filter((w) => w.id !== target.id);
  return shuffled(others, rng).slice(0, Math.min(count, others.length));
}

/** Mode A — choose the Latvian translation of an English word. */
export function makeTranslateQuestion(
  target: WordEntry,
  lessonPool: readonly WordEntry[],
  rng: Rng = Math.random,
): TranslateQuestion {
  const distractors = pickDistractors(target, lessonPool, 3, rng);
  const options = shuffled(
    [target, ...distractors].map((w) => ({ wordId: w.id, lv: w.lv })),
    rng,
  );
  return {
    kind: 'translate',
    wordId: target.id,
    options,
    correctOptionIndex: options.findIndex((o) => o.wordId === target.id),
  };
}

/** Mode B — find the picture/swatch matching an English prompt. */
export function makePictureQuestion(
  target: WordEntry,
  lessonPool: readonly WordEntry[],
  rng: Rng = Math.random,
): PictureQuestion {
  const distractors = pickDistractors(target, lessonPool, 3, rng);
  const options = shuffled([target, ...distractors], rng);
  return {
    kind: 'picture',
    wordId: target.id,
    options,
    correctOptionIndex: options.findIndex((o) => o.id === target.id),
  };
}

const DECOY_LETTERS = 'abcdefghijklmnopqrstuvwxyz';

function decoyCount(wordLength: number): number {
  if (wordLength <= 3) return 1;
  if (wordLength <= 6) return 2;
  return 3;
}

/**
 * Mode C — scrambled English letter tiles for a Latvian word.
 * Tiles carry the word's exact letters plus a few decoys, and are
 * re-shuffled if they accidentally show the answer in order.
 */
export function makeSpellQuestion(
  target: WordEntry,
  rng: Rng = Math.random,
): SpellQuestion {
  const letters = target.en.toLowerCase().split('');
  const decoys: string[] = [];
  const wanted = decoyCount(letters.length);
  while (decoys.length < wanted) {
    const c = DECOY_LETTERS[Math.floor(rng() * DECOY_LETTERS.length)];
    decoys.push(c);
  }
  let tiles = shuffled([...letters, ...decoys], rng).map((letter, i) => ({
    key: `t${i}-${letter}`,
    letter,
  }));
  // Never present the answer already assembled.
  const assembled = tiles.map((t) => t.letter).join('');
  if (assembled === target.en.toLowerCase()) {
    [tiles[0], tiles[1]] = [tiles[1], tiles[0]];
  }
  return { kind: 'spell', wordId: target.id, tiles };
}

/**
 * A lesson session asks about every word twice: once spelling (so active
 * recall toward mastery is always possible) and once translate or picture
 * alternating. Order is shuffled.
 */
export function buildLessonQuestions(
  words: readonly WordEntry[],
  lessonPool: readonly WordEntry[],
  rng: Rng = Math.random,
): Question[] {
  const questions: Question[] = [];
  words.forEach((w, i) => {
    questions.push(makeSpellQuestion(w, rng));
    questions.push(
      i % 2 === 0
        ? makeTranslateQuestion(w, lessonPool, rng)
        : makePictureQuestion(w, lessonPool, rng),
    );
  });
  return shuffled(questions, rng);
}

/**
 * Review sessions (Atkārtot) cover each due word once, mixing all three
 * modes so spelling still gets practiced.
 */
export function buildReviewQuestions(
  words: readonly WordEntry[],
  poolByLesson: (lesson: LessonId) => readonly WordEntry[],
  rng: Rng = Math.random,
): Question[] {
  const kinds: QuestionKind[] = ['translate', 'picture', 'spell'];
  const questions = words.map((w, i) => {
    const kind = kinds[i % kinds.length];
    const pool = poolByLesson(w.lesson);
    if (kind === 'translate') return makeTranslateQuestion(w, pool, rng);
    if (kind === 'picture') return makePictureQuestion(w, pool, rng);
    return makeSpellQuestion(w, rng);
  });
  return shuffled(questions, rng);
}

// ------------------------------------------------------------------
// Session flow — explicit state so scoring happens exactly once per
// question and retries are scheduled without infinite loops.
// ------------------------------------------------------------------

export interface SessionPlan {
  /** Mode the session was started in. */
  kind: 'lesson' | 'review' | 'retry';
  queue: Question[];
  /** wordId → times it has been re-queued this session. */
  retriesUsed: Record<string, number>;
  index: number;
  correctWordIds: string[];
  wrongWordIds: string[];
  answeredCurrent: boolean;
}

export const MAX_RETRIES_PER_WORD = 2;
const RETRY_GAP_MIN = 2;
const RETRY_GAP_MAX = 3;

export function createSession(
  kind: SessionPlan['kind'],
  questions: Question[],
): SessionPlan {
  return {
    kind,
    queue: [...questions],
    retriesUsed: {},
    index: 0,
    correctWordIds: [],
    wrongWordIds: [],
    answeredCurrent: false,
  };
}

export function currentQuestion(s: SessionPlan): Question | null {
  return s.queue[s.index] ?? null;
}

export interface AnswerOutcome {
  correct: boolean;
  wordId: string;
}

/**
 * Score the current question exactly once. Callers must check
 * `answeredCurrent` first — repeat calls for the same question return null.
 */
export function markAnswered(s: SessionPlan, correct: boolean, rng: Rng = Math.random): AnswerOutcome | null {
  const q = currentQuestion(s);
  if (!q || s.answeredCurrent) return null;
  s.answeredCurrent = true;
  if (correct) {
    if (!s.correctWordIds.includes(q.wordId)) s.correctWordIds.push(q.wordId);
  } else {
    if (!s.wrongWordIds.includes(q.wordId)) s.wrongWordIds.push(q.wordId);
    scheduleRetry(s, q, rng);
  }
  return { correct, wordId: q.wordId };
}

/**
 * Re-queue a missed word 2–3 questions later within the same session,
 * capped by MAX_RETRIES_PER_WORD so sessions always terminate.
 */
function scheduleRetry(s: SessionPlan, q: Question, rng: Rng): void {
  const used = s.retriesUsed[q.wordId] ?? 0;
  if (used >= MAX_RETRIES_PER_WORD) return;
  s.retriesUsed[q.wordId] = used + 1;
  const gap = RETRY_GAP_MIN + Math.floor(rng() * (RETRY_GAP_MAX - RETRY_GAP_MIN + 1));
  let insertAt = s.index + 1 + gap;
  if (insertAt >= s.queue.length) insertAt = s.queue.length;
  // Regenerate the question so choices/letters are reshuffled on retry.
  const word = getWord(q.wordId);
  const pool = lessonPoolFor(word.lesson);
  const retry: Question =
    q.kind === 'spell'
      ? makeSpellQuestion(word, rng)
      : q.kind === 'translate'
        ? makeTranslateQuestion(word, pool, rng)
        : makePictureQuestion(word, pool, rng);
  s.queue.splice(insertAt, 0, retry);
}

/** Advance to the next question; false when the session is finished. */
export function advance(s: SessionPlan): boolean {
  s.index += 1;
  s.answeredCurrent = false;
  return s.index < s.queue.length;
}

// ------------------------------------------------------------------
// Letter-tile input reducer — used by the spell UI and tests.
// ------------------------------------------------------------------

export interface TileInput {
  /** Tile keys currently placed, in order. */
  placed: string[];
}

export function placeTile(input: TileInput, tile: Tile): TileInput {
  if (input.placed.includes(tile.key)) return input;
  return { placed: [...input.placed, tile.key] };
}

export function removeLastTile(input: TileInput): TileInput {
  return { placed: input.placed.slice(0, -1) };
}

export function removeTile(input: TileInput, tile: Tile): TileInput {
  const i = input.placed.indexOf(tile.key);
  if (i === -1) return input;
  return { placed: [...input.placed.slice(0, i), ...input.placed.slice(i + 1)] };
}

export function resetTiles(): TileInput {
  return { placed: [] };
}

export function tilesToWord(input: TileInput, tiles: Tile[]): string {
  const byKey = new Map(tiles.map((t) => [t.key, t.letter]));
  return input.placed.map((k) => byKey.get(k) ?? '').join('');
}

/** Case-insensitive exact spelling check. */
export function spellingIsCorrect(attempt: string, target: string): boolean {
  return attempt.trim().toLowerCase() === target.trim().toLowerCase();
}
