/**
 * Deterministic spaced-repetition model for Word Quest v1.
 *
 * Pure functions only — no Date.now() inside. Callers inject `now`
 * (unix ms) so every rule is testable.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Interval ladder after a correct quiz answer, in days. */
export const REVIEW_STEPS_DAYS = [1, 3, 7] as const;

/** Correct answers needed across ≥2 distinct days to master a word. */
export const MASTERY_MIN_CORRECT = 3;
export const MASTERY_MIN_DISTINCT_DAYS = 2;

export interface WordProgress {
  wordId: string;
  seenCount: number;
  correctCount: number;
  wrongCount: number;
  /** Distinct calendar days (UTC) with at least one correct quiz answer. */
  correctDays: number[];
  /** Correct answers earned in active recall (letter-tile spelling). */
  activeRecallCorrect: number;
  lastPracticedAt: number;
  /** Unix ms when the word is due for review; <= now means due. */
  nextReviewAt: number;
  /** Position on REVIEW_STEPS_DAYS ladder (0..2). */
  reviewStep: number;
  mastered: boolean;
}

export function emptyProgress(wordId: string): WordProgress {
  return {
    wordId,
    seenCount: 0,
    correctCount: 0,
    wrongCount: 0,
    correctDays: [],
    activeRecallCorrect: 0,
    lastPracticedAt: 0,
    nextReviewAt: 0,
    reviewStep: 0,
    mastered: false,
  };
}

/** UTC calendar day number (floored) — deterministic across timezones. */
export function dayNumber(now: number): number {
  return Math.floor(now / DAY_MS);
}

/** Viewing a flashcard marks exposure, never mastery. */
export function recordSeen(p: WordProgress, now: number): WordProgress {
  return { ...p, seenCount: p.seenCount + 1, lastPracticedAt: now };
}

export function nextIntervalDays(step: number): number {
  const clamped = Math.max(0, Math.min(step, REVIEW_STEPS_DAYS.length - 1));
  return REVIEW_STEPS_DAYS[clamped];
}

/**
 * Correct quiz answer: advance the 1→3→7 day ladder, record the calendar
 * day, and re-evaluate mastery.
 */
export function recordCorrect(
  p: WordProgress,
  now: number,
  opts: { activeRecall: boolean },
): WordProgress {
  // Interval comes from the CURRENT ladder position (1d → 3d → 7d),
  // then the position advances for the next review.
  const nextReviewAt = now + nextIntervalDays(p.reviewStep) * DAY_MS;
  const step = Math.min(p.reviewStep + 1, REVIEW_STEPS_DAYS.length - 1);
  const today = dayNumber(now);
  const correctDays = p.correctDays.includes(today)
    ? p.correctDays
    : [...p.correctDays, today];
  const next: WordProgress = {
    ...p,
    correctCount: p.correctCount + 1,
    correctDays,
    activeRecallCorrect: p.activeRecallCorrect + (opts.activeRecall ? 1 : 0),
    lastPracticedAt: now,
    nextReviewAt,
    reviewStep: step,
  };
  return { ...next, mastered: isMastered(next) };
}

/**
 * Wrong answer: the interval resets to the bottom of the ladder and the
 * word is due again no later than the next visit/day.
 */
export function recordWrong(p: WordProgress, now: number): WordProgress {
  const next: WordProgress = {
    ...p,
    wrongCount: p.wrongCount + 1,
    lastPracticedAt: now,
    reviewStep: 0,
    // Due again the same day (next open of Atkārtot / next session).
    nextReviewAt: now,
  };
  return { ...next, mastered: isMastered(next) };
}

/**
 * Mastery requires ≥3 correct quiz answers on ≥2 distinct calendar days
 * and at least one correct active-recall (spelling) answer.
 */
export function isMastered(p: WordProgress): boolean {
  return (
    p.correctCount >= MASTERY_MIN_CORRECT &&
    p.correctDays.length >= MASTERY_MIN_DISTINCT_DAYS &&
    p.activeRecallCorrect >= 1
  );
}

export function isDue(p: WordProgress, now: number): boolean {
  return !p.mastered && p.nextReviewAt <= now && p.correctCount + p.wrongCount > 0;
}
