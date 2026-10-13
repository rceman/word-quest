import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import LetterTiles from '../src/components/LetterTiles.vue';
import WordArt from '../src/components/WordArt.vue';
import { makeSpellQuestion } from '../src/domain/quiz';
import { UNIT1_WORDS, getWord } from '../src/data/unit1';

const CLASSROOM = getWord('l5-classroom');
const spellQ = makeSpellQuestion(CLASSROOM, () => 0.42);

describe('LetterTiles component', () => {
  it('places tiles into the answer and supports undo/reset', async () => {
    const wrapper = mount(LetterTiles, {
      props: { question: spellQ, targetLength: CLASSROOM.en.length, locked: false },
    });
    const trayTiles = wrapper.findAll('.tile-tray .tile');
    // place the full target-length worth of tiles
    for (let i = 0; i < CLASSROOM.en.length; i++) {
      await trayTiles[i].trigger('click');
    }
    expect(wrapper.findAll('.spell-answer .tile')).toHaveLength(CLASSROOM.en.length);
    // tray tiles become disabled once used
    expect((trayTiles[0].element as HTMLButtonElement).disabled).toBe(true);
    // undo removes one
    await wrapper.findAll('.spell-tools .btn')[0].trigger('click');
    expect(wrapper.findAll('.spell-answer .tile')).toHaveLength(CLASSROOM.en.length - 1);
    // reset clears all
    await wrapper.findAll('.spell-tools .btn')[1].trigger('click');
    expect(wrapper.findAll('.spell-answer .tile')).toHaveLength(0);
  });

  it('emits submit with the assembled word when Pārbaudīt is pressed', async () => {
    const wrapper = mount(LetterTiles, {
      props: { question: spellQ, targetLength: CLASSROOM.en.length, locked: false },
    });
    const byLetter = new Map<string, HTMLElement>();
    wrapper.findAll('.tile-tray .tile').forEach((t) => {
      const key = t.text();
      if (!byLetter.has(key)) byLetter.set(key, t.element as HTMLElement);
    });
    // click tiles that spell "classroom" — need per-tile tracking because of repeats
    const used = new Set<Element>();
    const tiles = wrapper.findAll('.tile-tray .tile');
    for (const ch of CLASSROOM.en) {
      const tile = tiles.find(
        (t) => t.text() === ch && !used.has(t.element),
      );
      expect(tile, `tile for ${ch}`).toBeTruthy();
      used.add(tile!.element);
      await tile!.trigger('click');
    }
    const submit = wrapper.findAll('.spell-tools .btn').at(-1)!;
    expect((submit.element as HTMLButtonElement).disabled).toBe(false);
    await submit.trigger('click');
    expect(wrapper.emitted('submit')?.[0]).toEqual(['classroom']);
  });

  it('locked state disables all interaction', async () => {
    const wrapper = mount(LetterTiles, {
      props: { question: spellQ, targetLength: 3, locked: true },
    });
    for (const b of wrapper.findAll('button')) {
      expect((b.element as HTMLButtonElement).disabled).toBe(true);
    }
  });
});

describe('WordArt component', () => {
  it('renders an <img> for asset words with a Latvian accessible name', () => {
    const wrapper = mount(WordArt, { props: { word: getWord('l1-desk') } });
    const img = wrapper.find('img');
    expect(img.exists()).toBe(true);
    expect(img.attributes('alt')).toBe('skolas sols');
    expect(img.attributes('src')).toContain('desk');
  });

  it('renders a labelled swatch (never color alone) for color words', () => {
    const wrapper = mount(WordArt, { props: { word: getWord('l3-red') } });
    const svg = wrapper.find('svg');
    expect(svg.exists()).toBe(true);
    expect(wrapper.text()).toContain('sarkans');
    expect(svg.attributes('aria-label')).toContain('sarkans');
    expect(svg.attributes('aria-label')).toContain('red');
  });
});

describe('language policy — no Russian or third languages in app UI', () => {
  it('no Cyrillic characters anywhere in src/', () => {
    const sources = import.meta.glob('../src/**/*.{ts,vue,css}', {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>;
    const cyrillic = /[Ѐ-ӿ]/;
    for (const [f, text] of Object.entries(sources)) {
      expect(cyrillic.test(text), `Cyrillic found in ${f}`).toBe(false);
    }
  });

  it('vocabulary data contains only English + Latvian', () => {
    const cyrillic = /[Ѐ-ӿ]/;
    for (const w of UNIT1_WORDS) {
      expect(cyrillic.test(w.en)).toBe(false);
      expect(cyrillic.test(w.lv)).toBe(false);
    }
    // English words are pure a-z (kids' tile alphabet)
    for (const w of UNIT1_WORDS) {
      expect(/^[a-z]+$/.test(w.en), w.en).toBe(true);
    }
  });
});
