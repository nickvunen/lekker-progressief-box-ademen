import { useRef, useCallback } from 'react';

// Web Audio API context — once resumed via a user gesture, stays unlocked indefinitely.
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

async function loadBuffer(key: BufferKey, src: string) {
  const res = await fetch(src);
  const raw = await res.arrayBuffer();
  const buffer = await ctx.decodeAudioData(raw);
  buffers.set(key, buffer);
}

// Gong sounds (Progressive Box)
loadBuffer('gong-in', '/gong_start.wav');
loadBuffer('gong-out', '/gong_end.wav');
loadBuffer('gong-finish', '/gong_finish.mp3');

// New sounds (Flow + CO₂)
loadBuffer('breathe-in', '/breathing-in.mp3');
loadBuffer('hold', '/hold.mp3');
loadBuffer('breathe-out', '/breathing-out.mp3');
loadBuffer('ending', '/ending.mp3');

// Re-resume if iOS suspends the context when the app briefly goes to background
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && ctx.state === 'suspended') {
    ctx.resume();
  }
});

// Tracks the currently playing stoppable source (Flow/CO₂ sounds only)
let currentSource: AudioBufferSourceNode | null = null;

function stopCurrent() {
  if (currentSource) {
    try {
      currentSource.stop();
    } catch {
      // source may have already ended
    }
    currentSource = null;
  }
}

/** Play a gong sound freely — no stopping, no overlap tracking (short sounds, ~1.7s). */
function playFree(key: BufferKey) {
  const buffer = buffers.get(key);
  if (!buffer) return;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start(0);
}

/** Play a sound and stop whatever was playing before (for 16s Flow/CO₂ sounds). */
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

  /** Call from a user-gesture handler to unlock audio on iOS. */
  const warmUp = useCallback(() => {
    if (ctx.state === 'suspended') {
      ctx.resume();
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
