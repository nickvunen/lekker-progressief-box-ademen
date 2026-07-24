import { useState, useRef, useCallback, useEffect } from 'react';

interface TimerState {
  isRunning: boolean;
  countdown: string;
  info: string;
}

interface Internals {
  totalMs: number;
  intervalMs: number; // 0 = no interval bell
  startTime: number;
  nextIntervalMs: number; // next bell offset from start
}

const INITIAL_STATE: TimerState = {
  isRunning: false,
  countdown: '',
  info: '',
};

function formatMMSS(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Plain meditation countdown. Fires `onInterval` at each interval boundary
 * (strictly between start and end — the start bells and end gong are the
 * caller's job) and `onComplete` when the full duration elapses.
 */
export function useMeditationTimer(
  totalMinutes: number,
  intervalMinutes: number,
  onInterval?: () => void,
  onComplete?: () => void,
) {
  const [state, setState] = useState<TimerState>(INITIAL_STATE);

  const rafRef = useRef<number | null>(null);
  const loopRef = useRef<FrameRequestCallback | null>(null);
  const totalRef = useRef(totalMinutes);
  const intervalRef = useRef(intervalMinutes);
  const onIntervalRef = useRef(onInterval);
  const onCompleteRef = useRef(onComplete);
  const internals = useRef<Internals>({
    totalMs: 0,
    intervalMs: 0,
    startTime: 0,
    nextIntervalMs: 0,
  });

  useEffect(() => {
    totalRef.current = totalMinutes;
  }, [totalMinutes]);
  useEffect(() => {
    intervalRef.current = intervalMinutes;
  }, [intervalMinutes]);
  useEffect(() => {
    onIntervalRef.current = onInterval;
  }, [onInterval]);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const cancelLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const infoText = useCallback(
    (intervalMs: number, totalMs: number): string => {
      const total = formatMMSS(totalMs);
      if (intervalMs <= 0) return `${total} session`;
      return `${total} · bell every ${formatMMSS(intervalMs)}`;
    },
    [],
  );

  useEffect(() => {
    loopRef.current = (now: number) => {
      const s = internals.current;
      const elapsed = now - s.startTime;
      const remaining = s.totalMs - elapsed;

      if (remaining <= 0) {
        cancelLoop();
        setState(INITIAL_STATE);
        onCompleteRef.current?.();
        return;
      }

      // Fire any interval bells whose boundary has passed (skip the final
      // boundary — the end gong covers it).
      if (s.intervalMs > 0) {
        while (s.nextIntervalMs < s.totalMs && elapsed >= s.nextIntervalMs) {
          onIntervalRef.current?.();
          s.nextIntervalMs += s.intervalMs;
        }
      }

      setState((prev) => ({ ...prev, countdown: formatMMSS(remaining) }));
      rafRef.current = requestAnimationFrame(loopRef.current!);
    };
  }, [cancelLoop]);

  const start = useCallback(() => {
    const totalMs = totalRef.current * 60_000;
    const intervalMs = intervalRef.current * 60_000;
    const now = performance.now();
    internals.current = {
      totalMs,
      intervalMs,
      startTime: now,
      nextIntervalMs: intervalMs, // first bell one interval in
    };

    setState({
      isRunning: true,
      countdown: formatMMSS(totalMs),
      info: infoText(intervalMs, totalMs),
    });

    cancelLoop();
    rafRef.current = requestAnimationFrame(loopRef.current!);
  }, [cancelLoop, infoText]);

  const stop = useCallback(() => {
    cancelLoop();
    setState(INITIAL_STATE);
  }, [cancelLoop]);

  useEffect(() => cancelLoop, [cancelLoop]);

  return { ...state, start, stop };
}
