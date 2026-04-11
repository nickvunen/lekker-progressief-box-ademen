import { useRef, useCallback } from 'react';

// Web Audio API context — starts suspended on iOS until resumed by a user gesture.
const ctx = new (
  window.AudioContext ??
  (
    window as unknown as {
      webkitAudioContext: typeof AudioContext;
    }
  ).webkitAudioContext
)();

type BufferKey =
  | 'gong-in'
  | 'gong-out'
  | 'gong-finish'
  | 'breathe-in'
  | 'hold'
  | 'breathe-out'
  | 'ending';

const buffers = new Map<BufferKey, AudioBuffer>();

// Fetch raw bytes eagerly — no AudioContext needed, always works.
const rawFetches = new Map<BufferKey, Promise<ArrayBuffer>>();

function prefetch(key: BufferKey, src: string) {
  rawFetches.set(
    key,
    fetch(src)
      .then((r) => r.arrayBuffer())
      .catch(() => new ArrayBuffer(0)),
  );
}

prefetch('gong-in', '/gong_start.wav');
prefetch('gong-out', '/gong_end.wav');
prefetch('gong-finish', '/gong_finish.mp3');
prefetch('breathe-in', '/breathing-in.mp3');
prefetch('hold', '/hold.mp3');
prefetch('breathe-out', '/breathing-out.mp3');
prefetch('ending', '/ending.mp3');

// Decode all fetched buffers. Context must be running before calling this.
let decoding: Promise<void> | null = null;

async function decodeAll(): Promise<void> {
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

// Re-resume if iOS suspends the context when the app goes to background.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && ctx.state === 'suspended') {
    ctx.resume();
  }
});

// Tracks the currently playing stoppable source (Flow/CO₂ sounds only).
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

/** Play a gong sound freely — no stopping, no overlap tracking (~1.7s gongs). */
function playFree(key: BufferKey) {
  const buffer = buffers.get(key);
  if (!buffer) return;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start(0);
}

/** Stop whatever is playing, then play a new sound (for 16s Flow/CO₂ sounds). */
function playStoppable(key: BufferKey) {
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

export function useGong() {
  const enabledRef = useRef(false);

  const setEnabled = useCallback((enabled: boolean) => {
    enabledRef.current = enabled;
  }, []);

  /**
   * Golden-standard iOS unlock sequence. Call from a button click handler.
   *
   * 1. await ctx.resume()        — waits until context is truly running
   * 2. Play a 1-frame silent buffer — mandatory extra unlock for some iOS versions
   * 3. Decode all audio files    — safe now that context is running
   *
   * Wrapped in try/catch so a failure never blocks the timer from starting.
   */
  const warmUp = useCallback(async () => {
    try {
      // Step 1: resume (must be called synchronously within the user gesture —
      // calling an async function from a click handler satisfies this on all browsers)
      if (ctx.state !== 'running') await ctx.resume();

      // Step 2: play a 1-frame silent buffer — the iOS "unlock" trick
      const silentBuf = ctx.createBuffer(1, 1, ctx.sampleRate);
      const unlock = ctx.createBufferSource();
      unlock.buffer = silentBuf;
      unlock.connect(ctx.destination);
      unlock.start(0);

      // Step 3: decode all audio now that context is confirmed running
      if (!decoding) decoding = decodeAll();
      await decoding;
    } catch {
      // Audio failed — timer will still start, just silently
      decoding = null; // reset so next attempt can retry
    }
  }, []);

  // Progressive Box sounds (free-playing gong)
  const playIn = useCallback(() => {
    if (!enabledRef.current) return;
    playFree('gong-in');
  }, []);

  const playOut = useCallback(() => {
    if (!enabledRef.current) return;
    playFree('gong-out');
  }, []);

  const playFinish = useCallback(() => {
    if (!enabledRef.current) return;
    playFree('gong-finish');
  }, []);

  // Flow + CO₂ sounds (stoppable on phase change)
  const playBreatheIn = useCallback(() => {
    if (!enabledRef.current) return;
    playStoppable('breathe-in');
  }, []);

  const playHold = useCallback(() => {
    if (!enabledRef.current) return;
    playStoppable('hold');
  }, []);

  const playBreatheOut = useCallback(() => {
    if (!enabledRef.current) return;
    playStoppable('breathe-out');
  }, []);

  const playEnding = useCallback(() => {
    if (!enabledRef.current) return;
    playStoppable('ending');
  }, []);

  const stopCurrentSound = useCallback(() => {
    stopCurrent();
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
