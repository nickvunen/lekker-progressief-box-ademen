import { useRef, useCallback } from 'react';

const audio = new Audio('/gong.mp3');

export function useGong() {
  const enabledRef = useRef(false);

  const setEnabled = useCallback((enabled: boolean) => {
    enabledRef.current = enabled;
  }, []);

  /** Call from a user-gesture handler to unlock audio on mobile browsers. */
  const warmUp = useCallback(() => {
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
  }, []);

  const play = useCallback(() => {
    if (!enabledRef.current) return;

    // Reset and play — allows overlapping with quick restarts
    audio.currentTime = 0;
    audio.play().catch(() => {
      // Autoplay blocked — nothing we can do
    });
  }, []);

  return { play, warmUp, setEnabled, enabledRef };
}
