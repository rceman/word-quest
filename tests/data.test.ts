import { describe, expect, it } from 'vitest';
import { LESSONS, UNIT1_WORDS, getWord } from '../src/data/unit1';

describe('Unit 1 vocabulary data', () => {
  it('contains exactly 23 unique entries', () => {
    expect(UNIT1_WORDS).toHaveLength(23);
    expect(new Set(UNIT1_WORDS.map((w) => w.id)).size).toBe(23);
    expect(new Set(UNIT1_WORDS.map((w) => w.en)).size).toBe(23);
  });

  it('splits into lessons 8 / 11 / 4 in spec order', () => {
    expect(LESSONS.map((l) => l.words.length)).toEqual([8, 11, 4]);
    expect(LESSONS.map((l) => l.id)).toEqual([1, 3, 5]);
    expect(LESSONS[0].words.map((w) => w.en)).toEqual([
      'bin',
      'board',
      'chair',
      'clock',
      'cupboard',
      'desk',
      'door',
      'window',
    ]);
    expect(LESSONS[1].words.map((w) => w.en)).toEqual([
      'black',
      'blue',
      'brown',
      'green',
      'grey',
      'orange',
      'pink',
      'purple',
      'red',
      'white',
      'yellow',
    ]);
    expect(LESSONS[2].words.map((w) => w.en)).toEqual([
      'classroom',
      'playground',
      'student',
      'teacher',
    ]);
  });

  it('uses exact English spellings and Latvian diacritics', () => {
    const expected: Record<string, string> = {
      bin: 'atkritumu tvertne',
      board: 'tāfele',
      chair: 'krēsls',
      clock: 'pulkstenis',
      cupboard: 'skapis',
      desk: 'skolas sols',
      door: 'durvis',
      window: 'logs',
      black: 'melns',
      blue: 'zils',
      brown: 'brūns',
      green: 'zaļš',
      grey: 'pelēks',
      orange: 'oranžs',
      pink: 'rozā',
      purple: 'violets',
      red: 'sarkans',
      white: 'balts',
      yellow: 'dzeltens',
      classroom: 'klases telpa',
      playground: 'rotaļu laukums',
      student: 'skolēns',
      teacher: 'skolotājs',
    };
    for (const w of UNIT1_WORDS) {
      expect(w.lv, `${w.en} translation`).toBe(expected[w.en]);
    }
    // British spelling, not 'gray'.
    expect(UNIT1_WORDS.some((w) => w.en === 'grey')).toBe(true);
    expect(UNIT1_WORDS.some((w) => w.en === 'gray')).toBe(false);
  });

  it('every word has an illustration source (asset or swatch+label colors)', () => {
    for (const w of UNIT1_WORDS) {
      const hasArt = Boolean(w.asset) || (Boolean(w.color) && Boolean(w.colorLabelFill));
      expect(hasArt, w.id).toBe(true);
    }
  });

  it('getWord resolves canonical ids', () => {
    expect(getWord('l1-bin').en).toBe('bin');
    expect(() => getWord('nope')).toThrow();
  });
});
