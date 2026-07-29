import { useRef, useCallback } from 'react';

// iOS WebKit detection — all browsers on iOS use WebKit regardless of name,
// and all share the same Web Audio API activation token issues.
const isIOS =
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export type SoundKey = 'breathe-in' | 'hold' | 'breathe-out' | 'ending';

// Meditation's three bells reuse these same recordings (see playStart /
// playMid / playFinish below) rather than getting keys of their own — the
// gong_*.wav / gong_finish.mp3 samples were rejected as harsh, and giving
// meditation its own keys would mean a second set of HTMLAudioElements
// loading identical 512 kB files on the iOS path.
const SRCS: Record<SoundKey, string> = {
  'breathe-in': '/breathing-in.mp3',
  hold: '/hold.mp3',
  'breathe-out': '/breathing-out.mp3',
  ending: '/ending.mp3',
};

// All cue mp3s (breathing-in / hold / breathing-out / ending) are exactly
// 16.032s with a baked-in exponential decay. A supplementary fade longer
// than the source is pointless, so any fade duration is clamped to this.
const SOURCE_MAX_SECONDS = 16;

// Base playback level for every cue (0–1). Mutable —
// App.tsx drives this via setVolume based on the user's soundLevel pill.
// The fade envelope ramps from this level down to silence.
let cueVolume = 0.65;

// ─── HTMLAudioElement path (iOS) ──────────────────────────────────────────────
// HTML5 audio has 10+ years of reliable iOS support. We use it here because
// Web Audio API activation tokens expire through async chains on iOS WebKit,
// making ctx.resume() unreliable no matter how early it's called.

const htmlAudio = isIOS
  ? (Object.fromEntries(
      Object.entries(SRCS).map(([k, src]) => [k, new Audio(src)]),
    ) as Record<SoundKey, HTMLAudioElement>)
  : null;

let htmlCurrentStoppable: HTMLAudioElement | null = null;
let htmlFadeRaf: number | null = null;

// iOS historically ignored programmatic `audio.volume`. We assume it works
// until a write+readback disagrees, in which case we disable volume fades
// and fall back to the un-faded behaviour for the rest of the session.
let htmlVolumeSupported = true;

function htmlCancelFade() {
  if (htmlFadeRaf !== null) {
    cancelAnimationFrame(htmlFadeRaf);
    htmlFadeRaf = null;
  }
}

function htmlStartFade(audio: HTMLAudioElement, fadeSeconds: number) {
  htmlCancelFade();
  if (!htmlVolumeSupported) return;
  // Linear ramp on top of the source's baked-in exponential decay — see
  // the Audio notes in AGENTS.md before changing the curve.
  const durMs = Math.min(fadeSeconds, SOURCE_MAX_SECONDS) * 1000;
  if (durMs <= 0) return;
  const startTime = performance.now();
  audio.volume = cueVolume;
  // Detect iOS locking the volume at 1.0: if the write we just made didn't
  // stick, we know fades won't work on this device → disable and bail.
  audio.volume = 0.5;
  if (Math.abs(audio.volume - 0.5) > 0.01) {
    htmlVolumeSupported = false;
    audio.volume = 1;
    return;
  }
  audio.volume = cueVolume;
  const step = (now: number) => {
    const t = (now - startTime) / durMs;
    if (t >= 1) {
      audio.volume = 0;
      htmlFadeRaf = null;
      return;
    }
    audio.volume = cueVolume * (1 - t);
    htmlFadeRaf = requestAnimationFrame(step);
  };
  htmlFadeRaf = requestAnimationFrame(step);
}

// Per-key unlock promises — populated synchronously by htmlStartUnlocks()
const unlockDone = new Map<SoundKey, Promise<void>>();

// Start all unlock plays synchronously so they all fall within the iOS user
// gesture activation chain. Must NOT have any await before the play() calls.
// Guard: once started, don't start again — elements stay unlocked.
function htmlStartUnlocks() {
  if (!htmlAudio || unlockDone.size > 0) return;
  for (const [key, audio] of Object.entries(htmlAudio) as [
    SoundKey,
    HTMLAudioElement,
  ][]) {
    unlockDone.set(
      key,
      new Promise<void>((resolve) => {
        audio.muted = true;
        audio
          .play()
          .then(() => {
            audio.pause();
            audio.muted = false;
            audio.currentTime = 0;
            resolve();
          })
          .catch(() => {
            audio.muted = false;
            resolve();
          });
      }),
    );
  }
}

function htmlPlayStoppable(key: SoundKey, fadeSeconds?: number) {
  htmlCancelFade();
  if (htmlCurrentStoppable) {
    htmlCurrentStoppable.pause();
    htmlCurrentStoppable.currentTime = 0;
    htmlCurrentStoppable.volume = 1;
  }
  const audio = htmlAudio?.[key];
  if (!audio) return;
  audio.currentTime = 0;
  audio.volume = cueVolume;
  audio.play().catch(() => {});
  htmlCurrentStoppable = audio;
  if (fadeSeconds && fadeSeconds > 0) {
    htmlStartFade(audio, fadeSeconds);
  }
}

function htmlStopCurrent() {
  htmlCancelFade();
  if (htmlCurrentStoppable) {
    htmlCurrentStoppable.pause();
    htmlCurrentStoppable.currentTime = 0;
    htmlCurrentStoppable.volume = 1;
    htmlCurrentStoppable = null;
  }
}

// ─── Web Audio API path (Android, Desktop) ────────────────────────────────────

const ctx = isIOS
  ? null
  : new (
      window.AudioContext ??
      (
        window as unknown as {
          webkitAudioContext: typeof AudioContext;
        }
      ).webkitAudioContext
    )();

const buffers = new Map<SoundKey, AudioBuffer>();

const rawFetches = new Map<SoundKey, Promise<ArrayBuffer>>();

function prefetch(key: SoundKey, src: string) {
  rawFetches.set(
    key,
    fetch(src)
      .then((r) => r.arrayBuffer())
      .catch(() => new ArrayBuffer(0)),
  );
}

if (!isIOS) {
  prefetch('breathe-in', SRCS['breathe-in']);
  prefetch('hold', SRCS['hold']);
  prefetch('breathe-out', SRCS['breathe-out']);
  prefetch('ending', SRCS['ending']);
}

let decoding: Promise<void> | null = null;

async function decodeAll(): Promise<void> {
  if (!ctx) return;
  await Promise.all(
    [...rawFetches.entries()]
      .filter(([key]) => !buffers.has(key))
      .map(async ([key, rawPromise]) => {
        try {
          const raw = await rawPromise;
          if (raw.byteLength === 0) return;
          const buffer = await ctx.decodeAudioData(raw);
          buffers.set(key, buffer);
        } catch {
          // skip — this sound just won't play
        }
      }),
  );
}

function earlyUnlock() {
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();
}
document.addEventListener('touchstart', earlyUnlock, { passive: true });
document.addEventListener('mousedown', earlyUnlock);

document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.visibilityState === 'visible' && ctx.state === 'suspended') {
    ctx.resume();
  }
});

let currentSource: AudioBufferSourceNode | null = null;
let currentGain: GainNode | null = null;

function stopCurrent() {
  if (currentSource) {
    try {
      currentSource.stop();
    } catch {
      // already ended
    }
    currentSource = null;
  }
  if (currentGain) {
    try {
      currentGain.gain.cancelScheduledValues(ctx?.currentTime ?? 0);
    } catch {
      // ignore
    }
    currentGain = null;
  }
}

function playStoppable(key: SoundKey, fadeSeconds?: number) {
  if (!ctx) return;
  stopCurrent();
  const buffer = buffers.get(key);
  if (!buffer) return;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(cueVolume, now);
  if (fadeSeconds && fadeSeconds > 0) {
    const durSeconds = Math.min(fadeSeconds, SOURCE_MAX_SECONDS);
    // Linear supplementary ramp on top of the source's baked-in exponential
    // decay — see the Audio notes in AGENTS.md before changing the curve.
    gain.gain.linearRampToValueAtTime(0.0001, now + durSeconds);
  }
  source.connect(gain).connect(ctx.destination);
  source.addEventListener('ended', () => {
    if (currentSource === source) {
      currentSource = null;
      currentGain = null;
    }
  });
  source.start(0);
  currentSource = source;
  currentGain = gain;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGong() {
  const enabledRef = useRef(false);

  const setEnabled = useCallback((enabled: boolean) => {
    enabledRef.current = enabled;
  }, []);

  // Updates the base playback level used by subsequent play calls.
  // In-flight sounds keep their current level (cleaner handoff than
  // retroactively mutating running Web Audio gain nodes or HTMLAudio volume).
  const setVolume = useCallback((volume: number) => {
    cueVolume = Math.max(0, Math.min(1, volume));
  }, []);

  const warmUp = useCallback(async (priorityKey?: SoundKey) => {
    if (isIOS) {
      // All play() calls happen synchronously here (gesture chain intact).
      // We then await only the specific element we're about to play first —
      // the other 6 finish unlocking in the background, eliminating the delay.
      htmlStartUnlocks();
      await (priorityKey
        ? unlockDone.get(priorityKey)
        : Promise.all(unlockDone.values()));
      return;
    }
    try {
      if (ctx && ctx.state !== 'running') await ctx.resume();
      if (ctx) {
        const silentBuf = ctx.createBuffer(1, 1, ctx.sampleRate);
        const unlock = ctx.createBufferSource();
        unlock.buffer = silentBuf;
        unlock.connect(ctx.destination);
        unlock.start(0);
      }
      if (!decoding) decoding = decodeAll();
      await decoding;
    } catch {
      decoding = null;
    }
  }, []);

  // Meditation bells — the opening, interval and closing cues. They ring the
  // breathing recordings (in / hold / out), unfaded so the full 16 s decay
  // plays out, and on the stoppable slot so Stop silences a ringing bell.
  const playStart = useCallback(() => {
    if (!enabledRef.current) return;
    if (isIOS) htmlPlayStoppable('breathe-in');
    else playStoppable('breathe-in');
  }, []);

  const playMid = useCallback(() => {
    if (!enabledRef.current) return;
    if (isIOS) htmlPlayStoppable('hold');
    else playStoppable('hold');
  }, []);

  const playFinish = useCallback(() => {
    if (!enabledRef.current) return;
    if (isIOS) htmlPlayStoppable('breathe-out');
    else playStoppable('breathe-out');
  }, []);

  const playBreatheIn = useCallback((fadeSeconds?: number) => {
    if (!enabledRef.current) return;
    if (isIOS) htmlPlayStoppable('breathe-in', fadeSeconds);
    else playStoppable('breathe-in', fadeSeconds);
  }, []);

  const playHold = useCallback((fadeSeconds?: number) => {
    if (!enabledRef.current) return;
    if (isIOS) htmlPlayStoppable('hold', fadeSeconds);
    else playStoppable('hold', fadeSeconds);
  }, []);

  const playBreatheOut = useCallback((fadeSeconds?: number) => {
    if (!enabledRef.current) return;
    if (isIOS) htmlPlayStoppable('breathe-out', fadeSeconds);
    else playStoppable('breathe-out', fadeSeconds);
  }, []);

  const playEnding = useCallback(() => {
    if (!enabledRef.current) return;
    if (isIOS) htmlPlayStoppable('ending');
    else playStoppable('ending');
  }, []);

  const stopCurrentSound = useCallback(() => {
    if (isIOS) htmlStopCurrent();
    else stopCurrent();
  }, []);

  // Call this on pointerdown/touchstart of the Start button so unlocks begin
  // while the finger is still down. By the time click fires, they're done.
  const preWarm = useCallback(() => {
    if (isIOS) htmlStartUnlocks();
  }, []);

  return {
    playStart,
    playMid,
    playFinish,
    playBreatheIn,
    playHold,
    playBreatheOut,
    playEnding,
    stopCurrentSound,
    warmUp,
    preWarm,
    setEnabled,
    setVolume,
    enabledRef,
  };
}
