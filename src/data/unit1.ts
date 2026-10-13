export type LessonId = 1 | 3 | 5;

export interface WordEntry {
  /** Canonical stable id used by progress storage. */
  id: string;
  lesson: LessonId;
  /** English target word — displayed to the child. */
  en: string;
  /** Latvian translation. */
  lv: string;
  /** Illustration asset name inside src/assets/words (object/scene words only). */
  asset?: string;
  /** Swatch hex for color words (rendered with a text label — never color alone). */
  color?: string;
  /** Readable foreground for the swatch label. */
  colorLabelFill?: string;
}

/**
 * Unit 1 vocabulary — the single canonical source.
 * Order inside each lesson is fixed by the spec and must not change.
 */
export const UNIT1_WORDS: readonly WordEntry[] = [
  // Lesson 1 · Klases priekšmeti
  { id: 'l1-bin', lesson: 1, en: 'bin', lv: 'atkritumu tvertne', asset: 'bin' },
  { id: 'l1-board', lesson: 1, en: 'board', lv: 'tāfele', asset: 'board' },
  { id: 'l1-chair', lesson: 1, en: 'chair', lv: 'krēsls', asset: 'chair' },
  { id: 'l1-clock', lesson: 1, en: 'clock', lv: 'pulkstenis', asset: 'clock' },
  { id: 'l1-cupboard', lesson: 1, en: 'cupboard', lv: 'skapis', asset: 'cupboard' },
  { id: 'l1-desk', lesson: 1, en: 'desk', lv: 'skolas sols', asset: 'desk' },
  { id: 'l1-door', lesson: 1, en: 'door', lv: 'durvis', asset: 'door' },
  { id: 'l1-window', lesson: 1, en: 'window', lv: 'logs', asset: 'window' },
  // Lesson 3 · Krāsas
  { id: 'l3-black', lesson: 3, en: 'black', lv: 'melns', color: '#2b2b33', colorLabelFill: '#ffffff' },
  { id: 'l3-blue', lesson: 3, en: 'blue', lv: 'zils', color: '#2563eb', colorLabelFill: '#ffffff' },
  { id: 'l3-brown', lesson: 3, en: 'brown', lv: 'brūns', color: '#8a5a2b', colorLabelFill: '#ffffff' },
  { id: 'l3-green', lesson: 3, en: 'green', lv: 'zaļš', color: '#1f9d4d', colorLabelFill: '#ffffff' },
  { id: 'l3-grey', lesson: 3, en: 'grey', lv: 'pelēks', color: '#8d929b', colorLabelFill: '#ffffff' },
  { id: 'l3-orange', lesson: 3, en: 'orange', lv: 'oranžs', color: '#f08c1d', colorLabelFill: '#3a2200' },
  { id: 'l3-pink', lesson: 3, en: 'pink', lv: 'rozā', color: '#f27fb1', colorLabelFill: '#571734' },
  { id: 'l3-purple', lesson: 3, en: 'purple', lv: 'violets', color: '#8b5cf6', colorLabelFill: '#ffffff' },
  { id: 'l3-red', lesson: 3, en: 'red', lv: 'sarkans', color: '#e5484d', colorLabelFill: '#ffffff' },
  { id: 'l3-white', lesson: 3, en: 'white', lv: 'balts', color: '#f6f7f9', colorLabelFill: '#4b5563' },
  { id: 'l3-yellow', lesson: 3, en: 'yellow', lv: 'dzeltens', color: '#f7d038', colorLabelFill: '#5c4400' },
  // Lesson 5 · Skola
  { id: 'l5-classroom', lesson: 5, en: 'classroom', lv: 'klases telpa', asset: 'classroom' },
  { id: 'l5-playground', lesson: 5, en: 'playground', lv: 'rotaļu laukums', asset: 'playground' },
  { id: 'l5-student', lesson: 5, en: 'student', lv: 'skolēns', asset: 'student' },
  { id: 'l5-teacher', lesson: 5, en: 'teacher', lv: 'skolotājs', asset: 'teacher' },
];

export interface LessonInfo {
  id: LessonId;
  /** Latvian title shown on the lesson card. */
  titleLv: string;
  words: readonly WordEntry[];
}

export const LESSONS: readonly LessonInfo[] = [
  { id: 1, titleLv: 'Klases priekšmeti', words: UNIT1_WORDS.filter((w) => w.lesson === 1) },
  { id: 3, titleLv: 'Krāsas', words: UNIT1_WORDS.filter((w) => w.lesson === 3) },
  { id: 5, titleLv: 'Skola', words: UNIT1_WORDS.filter((w) => w.lesson === 5) },
];

const byId = new Map(UNIT1_WORDS.map((w) => [w.id, w]));

export function getWord(id: string): WordEntry {
  const w = byId.get(id);
  if (!w) throw new Error(`Unknown word id: ${id}`);
  return w;
}
