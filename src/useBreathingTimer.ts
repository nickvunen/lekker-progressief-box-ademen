import { useState, useRef, useCallback, useEffect } from 'react';

export type Phase = 'breathe-in' | 'hold-in' | 'breathe-out' | 'hold-out';

const PHASES: Phase[] = ['breathe-in', 'hold-in', 'breathe-out', 'hold-out'];

const PHASE_LABELS: Record<Phase, string> = {
  'breathe-in': 'Breathe In',
  'hold-in': 'Hold',
  'breathe-out': 'Breathe Out',
  'hold-out': 'Hold',
};

interface TimerState {
  isRunning: boolean;
  phase: Phase;
  phaseLabel: string;
  secondsLeft: number;
  currentDuration: number;
  roundInSet: number;
}

export function useBreathingTimer(
  roundsPerIncrement: number,
  onPhaseChange?: () => void,
) {
  const [state, setState] = useState<TimerState>({
    isRunning: false,
    phase: 'breathe-in',
    phaseLabel: 'Breathe In',
    secondsLeft: 3,
    currentDuration: 3,
    roundInSet: 1,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef({
    phaseIndex: 0,
    secondsLeft: 3,
    currentDuration: 3,
    roundInSet: 1,
  });

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const tick = useCallback(() => {
    const s = stateRef.current;
    s.secondsLeft -= 1;

    if (s.secondsLeft <= 0) {
      s.phaseIndex += 1;

      // Completed all 4 phases = 1 round
      if (s.phaseIndex >= 4) {
        s.phaseIndex = 0;
        s.roundInSet += 1;

        // Check if we need to increment duration
        if (s.roundInSet > roundsPerIncrement) {
          s.currentDuration += 1;
          s.roundInSet = 1;
        }
      }

      s.secondsLeft = s.currentDuration;
      onPhaseChange?.();
    }

    const phase = PHASES[s.phaseIndex];
    setState({
      isRunning: true,
      phase,
      phaseLabel: PHASE_LABELS[phase],
      secondsLeft: s.secondsLeft,
      currentDuration: s.currentDuration,
      roundInSet: s.roundInSet,
    });
  }, [roundsPerIncrement, onPhaseChange]);

  const start = useCallback(() => {
    stateRef.current = {
      phaseIndex: 0,
      secondsLeft: 3,
      currentDuration: 3,
      roundInSet: 1,
    };

    setState({
      isRunning: true,
      phase: 'breathe-in',
      phaseLabel: 'Breathe In',
      secondsLeft: 3,
      currentDuration: 3,
      roundInSet: 1,
    });

    clearTimer();
    intervalRef.current = setInterval(tick, 1000);
  }, [tick, clearTimer]);

  const stop = useCallback(() => {
    clearTimer();
    setState({
      isRunning: false,
      phase: 'breathe-in',
      phaseLabel: 'Breathe In',
      secondsLeft: 3,
      currentDuration: 3,
      roundInSet: 1,
    });
    stateRef.current = {
      phaseIndex: 0,
      secondsLeft: 3,
      currentDuration: 3,
      roundInSet: 1,
    };
  }, [clearTimer]);

  useEffect(() => {
    return clearTimer;
  }, [clearTimer]);

  return { ...state, start, stop };
}
