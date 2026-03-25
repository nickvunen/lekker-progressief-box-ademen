import { useRef, useCallback } from 'react';

const audio = new Audio('/gong.mp3');

export function useGong() {
  const enabledRef = useRef(false);

  const setEnabled = useCallback((enabled: boolean) => {
    enabledRef.current = enabled;
  }, []);

  const play = useCallback(() => {
    if (!enabledRef.current) return;

    // Reset and play — allows overlapping with quick restarts
    audio.currentTime = 0;
    audio.play();
  }, []);

  return { play, setEnabled, enabledRef };
}
