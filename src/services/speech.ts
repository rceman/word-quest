/**
 * English pronunciation via the OS speechSynthesis — best effort only.
 * iOS Safari serves voices asynchronously and may have none offline, so
 * callers must treat speech as optional and keep quizzes fully usable.
 */

export interface SpeechService {
  available: boolean;
  enabled: boolean;
  setEnabled(on: boolean): void;
  /** Speak an English word/phrase. Must be called from a user gesture. */
  speak(text: string): void;
  stop(): void;
}

let voicesCache: SpeechSynthesisVoice[] = [];

function pickEnglishVoice(): SpeechSynthesisVoice | null {
  const voices = voicesCache;
  const prefer =
    voices.find((v) => v.lang === 'en-GB') ||
    voices.find((v) => v.lang.startsWith('en-GB')) ||
    voices.find((v) => v.lang === 'en-US') ||
    voices.find((v) => v.lang.toLowerCase().startsWith('en'));
  return prefer ?? null;
}

export function createSpeechService(): SpeechService {
  const synth = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null;

  if (synth) {
    const refresh = () => {
      voicesCache = synth.getVoices();
    };
    refresh();
    // iOS/Safari populate voices asynchronously.
    synth.addEventListener?.('voiceschanged', refresh);
  }

  const svc: SpeechService = {
    available: synth !== null && typeof SpeechSynthesisUtterance !== 'undefined',
    enabled: true,
    setEnabled(on: boolean) {
      svc.enabled = on;
      if (!on) svc.stop();
    },
    speak(text: string) {
      if (!synth || !svc.enabled) return;
      try {
        synth.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'en-GB';
        const voice = pickEnglishVoice();
        if (voice) u.voice = voice;
        u.rate = 0.85;
        u.pitch = 1.05;
        synth.speak(u);
      } catch {
        // Speech is best-effort; never let it break a quiz.
      }
    },
    stop() {
      try {
        synth?.cancel();
      } catch {
        /* ignore */
      }
    },
  };
  return svc;
}
