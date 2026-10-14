import { describe, expect, it } from 'vitest';
import {
  DAY_MS,
  MASTERY_MIN_CORRECT,
  dayNumber,
  emptyProgress,
  isDue,
  isMastered,
  recordCorrect,
  recordSeen,
  recordWrong,
} from '../src/domain/repetition';

const T0 = 1_760_000_000_000; // fixed instant for deterministic tests

describe('spaced repetition', () => {
  it('viewing a card marks exposure, never mastery', () => {
    const p = recordSeen(emptyProgress('w'), T0);
    expect(p.seenCount).toBe(1);
    expect(p.correctCount).toBe(0);
    expect(p.mastered).toBe(false);
    expect(isDue(p, T0 + 1)).toBe(false); // seen but never quizzed → not due
  });

  it('schedules reviews on a 1 → 3 → 7 day ladder', () => {
    let p = emptyProgress('w');
    p = recordCorrect(p, T0, { activeRecall: false });
    expect(p.nextReviewAt).toBe(T0 + 1 * DAY_MS);
    p = recordCorrect(p, T0 + DAY_MS, { activeRecall: false });
    expect(p.nextReviewAt).toBe(T0 + DAY_MS + 3 * DAY_MS);
    p = recordCorrect(p, T0 + 4 * DAY_MS, { activeRecall: false });
    expect(p.nextReviewAt).toBe(T0 + 4 * DAY_MS + 7 * DAY_MS);
    // ladder saturates at 7 days
    p = recordCorrect(p, T0 + 20 * DAY_MS, { activeRecall: false });
    expect(p.nextReviewAt).toBe(T0 + 20 * DAY_MS + 7 * DAY_MS);
  });

  it('a wrong answer resets the ladder and makes the word due', () => {
    let p = recordCorrect(emptyProgress('w'), T0, { activeRecall: false });
    p = recordCorrect(p, T0 + DAY_MS, { activeRecall: false });
    p = recordWrong(p, T0 + 2 * DAY_MS);
    expect(p.reviewStep).toBe(0);
    expect(p.nextReviewAt).toBeLessThanOrEqual(T0 + 2 * DAY_MS);
    expect(isDue(p, T0 + 2 * DAY_MS)).toBe(true);
    // next correct goes back to the 1-day step
    p = recordCorrect(p, T0 + 3 * DAY_MS, { activeRecall: false });
    expect(p.nextReviewAt).toBe(T0 + 3 * DAY_MS + DAY_MS);
  });

  it('mastery needs 3 correct on ≥2 distinct days incl. active recall', () => {
    let p = emptyProgress('w');
    // 3 correct on the SAME day (incl. recall) → not mastered
    p = recordCorrect(p, T0, { activeRecall: true });
    p = recordCorrect(p, T0 + 1000, { activeRecall: false });
    p = recordCorrect(p, T0 + 2000, { activeRecall: false });
    expect(p.correctCount).toBe(3);
    expect(p.mastered).toBe(false);

    // 3rd correct on a SECOND day without recall → still not mastered
    p = emptyProgress('w');
    p = recordCorrect(p, T0, { activeRecall: false });
    p = recordCorrect(p, T0, { activeRecall: false });
    p = recordCorrect(p, T0 + DAY_MS, { activeRecall: false });
    expect(p.mastered).toBe(false);

    // active-recall correct on the second day → mastered
    p = recordCorrect(p, T0 + DAY_MS + 1000, { activeRecall: true });
    expect(p.correctCount).toBe(4);
    expect(p.mastered).toBe(true);
    expect(isMastered(p)).toBe(true);
  });

  it('correctDays stores distinct UTC days only', () => {
    let p = recordCorrect(emptyProgress('w'), T0, { activeRecall: false });
    p = recordCorrect(p, T0 + 60_000, { activeRecall: false });
    expect(p.correctDays).toEqual([dayNumber(T0)]);
    p = recordCorrect(p, T0 + DAY_MS, { activeRecall: false });
    expect(p.correctDays).toHaveLength(2);
  });

  it('mastered words are not due', () => {
    let p = emptyProgress('w');
    for (let i = 0; i < MASTERY_MIN_CORRECT; i++) {
      p = recordCorrect(p, T0 + i * DAY_MS, { activeRecall: i === 0 });
    }
    expect(p.mastered).toBe(true);
    expect(isDue(p, T0 + 100 * DAY_MS)).toBe(false);
  });
});
