import { useRef, useCallback } from 'react';

const audioIn = new Audio('/gong_start.wav');
const audioOut = new Audio('/gong_end.wav');
const audioFinish = new Audio('/gong_finish.mp3');

export function useGong() {
  const enabledRef = useRef(false);

  const setEnabled = useCallback((enabled: boolean) => {
    enabledRef.current = enabled;
  }, []);

  /** Call from a user-gesture handler to unlock audio on mobile browsers. */
  const warmUp = useCallback(() => {
    for (const a of [audioIn, audioOut, audioFinish]) {
      a.muted = true;
      a.play()
        .then(() => {
          a.pause();
          a.muted = false;
          a.currentTime = 0;
        })
        .catch(() => {
          a.muted = false;
        });
    }
  }, []);

  const playIn = useCallback(() => {
    if (!enabledRef.current) return;
    const a = audioIn.cloneNode() as HTMLAudioElement;
    a.play().catch(() => {});
  }, []);

  const playOut = useCallback(() => {
    if (!enabledRef.current) return;
    const a = audioOut.cloneNode() as HTMLAudioElement;
    a.play().catch(() => {});
  }, []);

  const playFinish = useCallback(() => {
    if (!enabledRef.current) return;
    const a = audioFinish.cloneNode() as HTMLAudioElement;
    a.play().catch(() => {});
  }, []);

  return { playIn, playOut, playFinish, warmUp, setEnabled, enabledRef };
}
