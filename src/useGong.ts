import { useRef, useCallback } from 'react';

// iOS WebKit detection — all browsers on iOS use WebKit regardless of name,
// and all share the same Web Audio API activation token issues.
const isIOS =
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

type SoundKey =
  | 'gong-in'
  | 'gong-out'
  | 'gong-finish'
  | 'breathe-in'
  | 'hold'
  | 'breathe-out'
  | 'ending';

const SRCS: Record<SoundKey, string> = {
  'gong-in': '/gong_start.wav',
  'gong-out': '/gong_end.wav',
  'gong-finish': '/gong_finish.mp3',
  'breathe-in': '/breathing-in.mp3',
  hold: '/hold.mp3',
  'breathe-out': '/breathing-out.mp3',
  ending: '/ending.mp3',
};

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

function htmlUnlock() {
  if (!htmlAudio) return;
  for (const audio of Object.values(htmlAudio)) {
    audio.muted = true;
    audio
      .play()
      .then(() => {
        audio.pause();
        audio.muted = false;
        audio.currentTime = 0;
      })
      .catch(() => {
        audio.muted = false;
      });
  }
}

function htmlPlayFree(key: SoundKey) {
  const audio = htmlAudio?.[key];
  if (!audio) return;
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

function htmlPlayStoppable(key: SoundKey) {
  if (htmlCurrentStoppable) {
    htmlCurrentStoppable.pause();
    htmlCurrentStoppable.currentTime = 0;
  }
  const audio = htmlAudio?.[key];
  if (!audio) return;
  audio.currentTime = 0;
  audio.play().catch(() => {});
  htmlCurrentStoppable = audio;
}

function htmlStopCurrent() {
  if (htmlCurrentStoppable) {
    htmlCurrentStoppable.pause();
    htmlCurrentStoppable.currentTime = 0;
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
  prefetch('gong-in', SRCS['gong-in']);
  prefetch('gong-out', SRCS['gong-out']);
  prefetch('gong-finish', SRCS['gong-finish']);
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

function stopCurrent() {
  if (currentSource) {
    try {
      currentSource.stop();
    } catch {
      // already ended
    }
    currentSource = null;
  }
}

function playFree(key: SoundKey) {
  if (!ctx) return;
  const buffer = buffers.get(key);
  if (!buffer) return;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start(0);
}

function playStoppable(key: SoundKey) {
  if (!ctx) return;
  stopCurrent();
  const buffer = buffers.get(key);
  if (!buffer) return;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.addEventListener('ended', () => {
    if (currentSource === source) currentSource = null;
  });
  source.start(0);
  currentSource = source;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGong() {
  const enabledRef = useRef(false);

  const setEnabled = useCallback((enabled: boolean) => {
    enabledRef.current = enabled;
  }, []);

  const warmUp = useCallback(async () => {
    if (isIOS) {
      // htmlUnlock must run before any await — it calls audio.play() synchronously
      // within the user gesture chain, which is what iOS requires.
      htmlUnlock();
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

  const playIn = useCallback(() => {
    if (!enabledRef.current) return;
    if (isIOS) htmlPlayFree('gong-in');
    else playFree('gong-in');
  }, []);

  const playOut = useCallback(() => {
    if (!enabledRef.current) return;
    if (isIOS) htmlPlayFree('gong-out');
    else playFree('gong-out');
  }, []);

  const playFinish = useCallback(() => {
    if (!enabledRef.current) return;
    if (isIOS) htmlPlayFree('gong-finish');
    else playFree('gong-finish');
  }, []);

  const playBreatheIn = useCallback(() => {
    if (!enabledRef.current) return;
    if (isIOS) htmlPlayStoppable('breathe-in');
    else playStoppable('breathe-in');
  }, []);

  const playHold = useCallback(() => {
    if (!enabledRef.current) return;
    if (isIOS) htmlPlayStoppable('hold');
    else playStoppable('hold');
  }, []);

  const playBreatheOut = useCallback(() => {
    if (!enabledRef.current) return;
    if (isIOS) htmlPlayStoppable('breathe-out');
    else playStoppable('breathe-out');
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

  return {
    playIn,
    playOut,
    playFinish,
    playBreatheIn,
    playHold,
    playBreatheOut,
    playEnding,
    stopCurrentSound,
    warmUp,
    setEnabled,
    enabledRef,
  };
}
