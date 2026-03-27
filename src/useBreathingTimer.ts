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

interface InternalState {
  phaseIndex: number;
  secondsLeft: number;
  currentDuration: number;
  roundInSet: number;
}

const INITIAL_INTERNAL: InternalState = {
  phaseIndex: 0,
  secondsLeft: 3,
  currentDuration: 3,
  roundInSet: 1,
};

const INITIAL_STATE: TimerState = {
  isRunning: false,
  phase: 'breathe-in',
  phaseLabel: 'Breathe In',
  secondsLeft: 3,
  currentDuration: 3,
  roundInSet: 1,
};

export function useBreathingTimer(
  roundsPerIncrement: number,
  onPhaseChange?: (phase: Phase) => void,
) {
  const [state, setState] = useState<TimerState>(INITIAL_STATE);

  const rafRef = useRef<number | null>(null);
  const nextTickRef = useRef<number>(0);
  const stateRef = useRef<InternalState>({ ...INITIAL_INTERNAL });
  const roundsRef = useRef(roundsPerIncrement);
  const onPhaseChangeRef = useRef(onPhaseChange);
  const loopRef = useRef<FrameRequestCallback | null>(null);

  // Keep refs in sync so the rAF loop always reads fresh values
  useEffect(() => {
    roundsRef.current = roundsPerIncrement;
  }, [roundsPerIncrement]);

  useEffect(() => {
    onPhaseChangeRef.current = onPhaseChange;
  }, [onPhaseChange]);

  const cancelLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
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
        if (s.roundInSet > roundsRef.current) {
          s.currentDuration += 1;
          s.roundInSet = 1;
        }
      }

      s.secondsLeft = s.currentDuration;
      onPhaseChangeRef.current?.(PHASES[s.phaseIndex]);
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
  }, []);

  useEffect(() => {
    loopRef.current = (now: number) => {
      // Process every elapsed second (catches up if tab was throttled)
      while (nextTickRef.current <= now) {
        tick();
        nextTickRef.current += 1000;
      }
      rafRef.current = requestAnimationFrame(loopRef.current!);
    };
  }, [tick]);

  const start = useCallback(() => {
    stateRef.current = { ...INITIAL_INTERNAL };
    setState({ ...INITIAL_STATE, isRunning: true });

    cancelLoop();
    // First tick fires 1 s from now
    nextTickRef.current = performance.now() + 1000;
    rafRef.current = requestAnimationFrame(loopRef.current!);
  }, [cancelLoop]);

  const stop = useCallback(() => {
    cancelLoop();
    setState(INITIAL_STATE);
    stateRef.current = { ...INITIAL_INTERNAL };
  }, [cancelLoop]);

  useEffect(() => {
    return cancelLoop;
  }, [cancelLoop]);

  return { ...state, start, stop };
}
