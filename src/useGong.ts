import { useRef, useCallback } from 'react';

const audioIn = new Audio('/gong_start.wav');
const audioOut = new Audio('/gong_end.wav');
const audioFinish = new Audio('/gong_finish.mp3');

// Keep references to playing nodes so they aren't garbage collected mid-playback
const playing = new Set<HTMLAudioElement>();

function playClone(source: HTMLAudioElement) {
  const a = source.cloneNode() as HTMLAudioElement;
  playing.add(a);
  a.addEventListener('ended', () => playing.delete(a));
  a.play().catch(() => playing.delete(a));
}

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
    playClone(audioIn);
  }, []);

  const playOut = useCallback(() => {
    if (!enabledRef.current) return;
    playClone(audioOut);
  }, []);

  const playFinish = useCallback(() => {
    if (!enabledRef.current) return;
    playClone(audioFinish);
  }, []);

  return { playIn, playOut, playFinish, warmUp, setEnabled, enabledRef };
}
