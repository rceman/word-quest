/**
 * Tiny Web-Audio synth used by the music studio.
 * Every instrument is synthesized on the fly — no audio files, so the
 * studio keeps working fully offline.
 */

export interface SoundDef {
  id: string;
  label: string;
  icon: string;
  /** 'word' rows speak instead of playing a synth note. */
  kind?: 'word' | 'letter';
}

export interface TrackGroup {
  id: string;
  title: string;
  rows: SoundDef[];
}

export const TRACK_GROUPS: TrackGroup[] = [
  {
    id: 'drums',
    title: '🥁 Bungu',
    rows: [
      { id: 'kick', label: 'Bum', icon: '🥁' },
      { id: 'snare', label: 'Tak', icon: '🪘' },
      { id: 'hihat', label: 'Ts', icon: '🔔' },
      { id: 'clap', label: 'Plak', icon: '👏' },
    ],
  },
  {
    id: 'bass',
    title: '🎸 Bass',
    rows: [
      { id: 'bass-c', label: 'C', icon: '🎸' },
      { id: 'bass-e', label: 'E', icon: '🎸' },
      { id: 'bass-g', label: 'G', icon: '🎸' },
      { id: 'bass-a', label: 'A', icon: '🎸' },
    ],
  },
  {
    id: 'pad',
    title: '🌌 Sintez',
    rows: [
      { id: 'pad-c', label: 'C', icon: '🌌' },
      { id: 'pad-e', label: 'E', icon: '🌌' },
      { id: 'pad-g', label: 'G', icon: '🌌' },
      { id: 'pad-a', label: 'A', icon: '🌌' },
    ],
  },
  {
    id: 'melody',
    title: '🎵 Melodija',
    rows: [
      { id: 'mel-c', label: 'C', icon: '🎵' },
      { id: 'mel-d', label: 'D', icon: '🎵' },
      { id: 'mel-e', label: 'E', icon: '🎵' },
      { id: 'mel-g', label: 'G', icon: '🎵' },
      { id: 'mel-a', label: 'A', icon: '🎵' },
      { id: 'mel-c2', label: 'Ĉ', icon: '🎵' },
    ],
  },
  {
    id: 'fx',
    title: '✨ Skaņas',
    rows: [
      { id: 'fx-bubble', label: 'Burb', icon: '🫧' },
      { id: 'fx-zap', label: 'Zap', icon: '⚡' },
      { id: 'fx-coin', label: 'Coin', icon: '🪙' },
      { id: 'fx-boing', label: 'Boing', icon: '🌀' },
      { id: 'fx-whoosh', label: 'Všš', icon: '💨' },
      { id: 'fx-pop', label: 'Pop', icon: '🍿' },
    ],
  },
  {
    id: 'words',
    title: '🗣️ Vārdi',
    rows: [
      { id: 'word-rand', label: 'Vārds', icon: '🗣️', kind: 'word' },
      { id: 'letter-rand', label: 'Burts', icon: '🔤', kind: 'letter' },
    ],
  },
];

export const STEP_COUNT = 8;
export const NOTE_C2 = 65.41;
const SEMI = Math.pow(2, 1 / 12);

function freq(stepsAboveC: number, base: number): number {
  return base * Math.pow(SEMI, stepsAboveC);
}

const NOTE_MAP: Record<string, number> = {
  'bass-c': freq(0, NOTE_C2),
  'bass-e': freq(4, NOTE_C2),
  'bass-g': freq(7, NOTE_C2),
  'bass-a': freq(9, NOTE_C2),
  'pad-c': freq(0, NOTE_C2 * 4),
  'pad-e': freq(4, NOTE_C2 * 4),
  'pad-g': freq(7, NOTE_C2 * 4),
  'pad-a': freq(9, NOTE_C2 * 4),
  'mel-c': freq(0, NOTE_C2 * 8),
  'mel-d': freq(2, NOTE_C2 * 8),
  'mel-e': freq(4, NOTE_C2 * 8),
  'mel-g': freq(7, NOTE_C2 * 8),
  'mel-a': freq(9, NOTE_C2 * 8),
  'mel-c2': freq(12, NOTE_C2 * 8),
};

type Ctx = AudioContext;

function env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function osc(ctx: Ctx, type: OscillatorType, f: number, t: number, dur: number, peak = 0.5, dest: AudioNode = ctx.destination): void {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  env(g, t, peak, 0.005, dur);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.1);
}

function noiseBuf(ctx: Ctx): AudioBuffer {
  const len = ctx.sampleRate;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

let sharedNoise: AudioBuffer | null = null;

function noise(ctx: Ctx, t: number, dur: number, peak: number, filterFreq: number, type: BiquadFilterType = 'highpass', dest: AudioNode = ctx.destination): void {
  if (!sharedNoise) sharedNoise = noiseBuf(ctx);
  const src = ctx.createBufferSource();
  src.buffer = sharedNoise;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = filterFreq;
  const g = ctx.createGain();
  env(g, t, peak, 0.003, dur);
  src.connect(f).connect(g).connect(dest);
  src.start(t, Math.random());
  src.stop(t + dur + 0.1);
}

export function playSound(ctx: Ctx, id: string, t: number, stepDur: number, vol = 1, semis = 0): void {
  const out = ctx.createGain();
  out.gain.setValueAtTime(vol, t);
  out.connect(ctx.destination);
  const m = Math.pow(SEMI, semis);
  switch (id) {
    case 'kick': {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(160 * m, t);
      o.frequency.exponentialRampToValueAtTime(45 * m, t + 0.12);
      env(g, t, 0.9, 0.002, 0.22);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.3);
      return;
    }
    case 'snare':
      noise(ctx, t, 0.12, 0.5, 1800, 'highpass', out);
      osc(ctx, 'triangle', 190 * m, t, 0.08, 0.35, out);
      return;
    case 'hihat':
      noise(ctx, t, 0.04, 0.3, 7000, 'highpass', out);
      return;
    case 'clap':
      noise(ctx, t, 0.03, 0.4, 2500, 'highpass', out);
      noise(ctx, t + 0.03, 0.03, 0.4, 2500, 'highpass', out);
      noise(ctx, t + 0.06, 0.12, 0.45, 2500, 'highpass', out);
      return;
    case 'fx-bubble': {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(300 * m, t);
      o.frequency.exponentialRampToValueAtTime(950 * m, t + 0.12);
      env(g, t, 0.45, 0.01, 0.15);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.3);
      return;
    }
    case 'fx-zap': {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(900 * m, t);
      o.frequency.exponentialRampToValueAtTime(90 * m, t + 0.18);
      env(g, t, 0.35, 0.005, 0.2);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.3);
      return;
    }
    case 'fx-coin':
      osc(ctx, 'sine', 988 * m, t, 0.06, 0.4, out);
      osc(ctx, 'sine', 1319 * m, t + 0.07, 0.18, 0.4, out);
      return;
    case 'fx-boing': {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(180 * m, t);
      lfo.frequency.setValueAtTime(28, t);
      lg.gain.setValueAtTime(60, t);
      lfo.connect(lg).connect(o.frequency);
      env(g, t, 0.45, 0.005, 0.3);
      o.connect(g).connect(out);
      o.start(t);
      lfo.start(t);
      o.stop(t + 0.4);
      lfo.stop(t + 0.4);
      return;
    }
    case 'fx-whoosh': {
      if (!sharedNoise) sharedNoise = noiseBuf(ctx);
      const src = ctx.createBufferSource();
      src.buffer = sharedNoise;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.setValueAtTime(400, t);
      f.frequency.exponentialRampToValueAtTime(3000, t + 0.25);
      f.Q.value = 2;
      const g = ctx.createGain();
      env(g, t, 0.4, 0.02, 0.28);
      src.connect(f).connect(g).connect(out);
      src.start(t, Math.random());
      src.stop(t + 0.4);
      return;
    }
    case 'fx-pop':
      osc(ctx, 'sine', 520 * m, t, 0.05, 0.5, out);
      noise(ctx, t, 0.03, 0.25, 4000, 'highpass', out);
      return;
    default:
      break;
  }

  const base = NOTE_MAP[id];
  if (base === undefined) return;
  const f = base * m;

  if (id.startsWith('bass-')) {
    osc(ctx, 'triangle', f, t, Math.min(stepDur * 0.9, 0.4), 0.55, out);
    osc(ctx, 'sine', f / 2, t, 0.2, 0.3, out);
  } else if (id.startsWith('pad-')) {
    const dur = stepDur * 2.2;
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const g = ctx.createGain();
    const flt = ctx.createBiquadFilter();
    o1.type = 'sawtooth';
    o2.type = 'sawtooth';
    o1.frequency.value = f;
    o2.frequency.value = f * 1.005;
    flt.type = 'lowpass';
    flt.frequency.value = 900;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.22, t + stepDur * 0.5);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o1.connect(flt);
    o2.connect(flt);
    flt.connect(g).connect(out);
    o1.start(t);
    o2.start(t);
    o1.stop(t + dur + 0.1);
    o2.stop(t + dur + 0.1);
  } else if (id.startsWith('mel-')) {
    osc(ctx, 'sine', f, t, 0.35, 0.5, out);
    osc(ctx, 'sine', f * 2, t, 0.15, 0.15, out);
  }
}
