import { useRef, useCallback } from 'react';

// Web Audio API context — once resumed via a user gesture, stays unlocked indefinitely.
// This is the reliable solution for iOS Safari, which silently revokes HTMLAudioElement
// playback permission after a while.
const ctx = new (
  window.AudioContext ??
  (
    window as unknown as {
      webkitAudioContext: typeof AudioContext;
    }
  ).webkitAudioContext
)();

type BufferKey = 'in' | 'out' | 'finish';

const buffers = new Map<BufferKey, AudioBuffer>();

async function loadBuffer(key: BufferKey, src: string) {
  const res = await fetch(src);
  const raw = await res.arrayBuffer();
  const buffer = await ctx.decodeAudioData(raw);
  buffers.set(key, buffer);
}

loadBuffer('in', '/gong_start.wav');
loadBuffer('out', '/gong_end.wav');
loadBuffer('finish', '/gong_finish.mp3');

// Re-resume if iOS suspends the context when the app briefly goes to background
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && ctx.state === 'suspended') {
    ctx.resume();
  }
});

function playBuffer(key: BufferKey) {
  const buffer = buffers.get(key);
  if (!buffer) return;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start(0);
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

  const playIn = useCallback(() => {
    if (!enabledRef.current) return;
    playBuffer('in');
  }, []);

  const playOut = useCallback(() => {
    if (!enabledRef.current) return;
    playBuffer('out');
  }, []);

  const playFinish = useCallback(() => {
    if (!enabledRef.current) return;
    playBuffer('finish');
  }, []);

  return { playIn, playOut, playFinish, warmUp, setEnabled, enabledRef };
}
