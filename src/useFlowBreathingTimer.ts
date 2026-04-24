import { useState, useRef, useCallback, useEffect } from 'react';
import type { Phase } from './useBreathingTimer';

const PHASE_LABELS: Record<Phase, string> = {
  'breathe-in': 'Breathe In',
  'hold-in': 'Hold',
  'breathe-out': 'Breathe Out',
  'hold-out': 'Hold',
};

export interface FlowSettings {
  breatheIn: number;
  holdIn: number;
  breatheOut: number;
  holdOut: number;
  totalMinutes: number;
}

interface ActivePhase {
  phase: Phase;
  duration: number; // milliseconds
}

interface TimerState {
  isRunning: boolean;
  phase: Phase;
  phaseLabel: string;
  displayTime: string;
  remainingTime: string;
  currentDuration: number; // seconds, duration of the current phase
}

const INITIAL_STATE: TimerState = {
  isRunning: false,
  phase: 'breathe-in',
  phaseLabel: 'Breathe In',
  displayTime: '',
  remainingTime: '',
  currentDuration: 0,
};

// Show ".5" only during the initial half-second of a phase that starts with one;
// after that count down in whole seconds.
function formatDisplay(remainingMs: number, phaseDurationMs: number): string {
  const fullSeconds = Math.floor(phaseDurationMs / 1000);
  const phaseStartsWithHalf = phaseDurationMs % 1000 === 500;
  if (phaseStartsWithHalf && remainingMs > fullSeconds * 1000) {
    return `${fullSeconds}.5`;
  }
  return `${Math.ceil(remainingMs / 1000)}`;
}

function buildPhaseList(settings: FlowSettings): ActivePhase[] {
  const phases: ActivePhase[] = [];
  if (settings.breatheIn > 0)
    phases.push({ phase: 'breathe-in', duration: settings.breatheIn * 1000 });
  if (settings.holdIn > 0)
    phases.push({ phase: 'hold-in', duration: settings.holdIn * 1000 });
  if (settings.breatheOut > 0)
    phases.push({ phase: 'breathe-out', duration: settings.breatheOut * 1000 });
  if (settings.holdOut > 0)
    phases.push({ phase: 'hold-out', duration: settings.holdOut * 1000 });
  return phases;
}

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')} remaining`;
}

export function useFlowBreathingTimer(
  settings: FlowSettings,
  onPhaseChange?: (phase: Phase, duration: number) => void,
  onComplete?: () => void,
) {
  const [state, setState] = useState<TimerState>(INITIAL_STATE);

  const rafRef = useRef<number | null>(null);
  const settingsRef = useRef(settings);
  const onPhaseChangeRef = useRef(onPhaseChange);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  useEffect(() => {
    onPhaseChangeRef.current = onPhaseChange;
  }, [onPhaseChange]);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Mutable internal state used by the rAF loop
  const internals = useRef({
    phases: [] as ActivePhase[],
    phaseIndex: 0,
    phaseStartTime: 0,
    totalStartTime: 0,
    totalDurationMs: 0,
    finishing: false,
  });

  const cancelLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const loopRef = useRef<FrameRequestCallback | null>(null);

  useEffect(() => {
    loopRef.current = (now: number) => {
      const s = internals.current;
      const currentPhase = s.phases[s.phaseIndex];
      const elapsed = now - s.phaseStartTime;
      const remainingInPhase = currentPhase.duration - elapsed;

      if (remainingInPhase <= 0) {
        // Phase complete — check if we should stop or advance
        const totalElapsed = now - s.totalStartTime;
        if (totalElapsed >= s.totalDurationMs) {
          s.finishing = true;
        }

        // If finishing and we just completed breathe-out, stop
        if (s.finishing && currentPhase.phase === 'breathe-out') {
          cancelLoop();
          setState(INITIAL_STATE);
          onCompleteRef.current?.();
          return;
        }

        // Advance to next phase
        let nextIndex = (s.phaseIndex + 1) % s.phases.length;

        // If finishing, skip hold-out (go straight to next cycle or stop)
        if (s.finishing && s.phases[nextIndex]?.phase === 'hold-out') {
          nextIndex = (nextIndex + 1) % s.phases.length;
        }

        s.phaseIndex = nextIndex;
        s.phaseStartTime = now;

        const nextPhase = s.phases[s.phaseIndex];
        onPhaseChangeRef.current?.(nextPhase.phase, nextPhase.duration / 1000);

        const totalRemaining = s.finishing
          ? 0
          : s.totalDurationMs - (now - s.totalStartTime);

        setState({
          isRunning: true,
          phase: nextPhase.phase,
          phaseLabel: PHASE_LABELS[nextPhase.phase],
          displayTime: formatDisplay(nextPhase.duration, nextPhase.duration),
          remainingTime: formatRemaining(totalRemaining),
          currentDuration: nextPhase.duration / 1000,
        });
      } else {
        // Mid-phase update
        const totalRemaining = s.finishing
          ? 0
          : s.totalDurationMs - (now - s.totalStartTime);

        setState({
          isRunning: true,
          phase: currentPhase.phase,
          phaseLabel: PHASE_LABELS[currentPhase.phase],
          displayTime: formatDisplay(remainingInPhase, currentPhase.duration),
          remainingTime: formatRemaining(totalRemaining),
          currentDuration: currentPhase.duration / 1000,
        });
      }

      rafRef.current = requestAnimationFrame(loopRef.current!);
    };
  }, [cancelLoop]);

  const start = useCallback(() => {
    const s = settingsRef.current;
    const phases = buildPhaseList(s);
    if (phases.length === 0) return;

    const now = performance.now();
    internals.current = {
      phases,
      phaseIndex: 0,
      phaseStartTime: now,
      totalStartTime: now,
      totalDurationMs: s.totalMinutes * 60 * 1000,
      finishing: false,
    };

    const firstPhase = phases[0];
    setState({
      isRunning: true,
      phase: firstPhase.phase,
      phaseLabel: PHASE_LABELS[firstPhase.phase],
      displayTime: formatDisplay(firstPhase.duration, firstPhase.duration),
      remainingTime: formatRemaining(s.totalMinutes * 60 * 1000),
      currentDuration: firstPhase.duration / 1000,
    });

    cancelLoop();
    rafRef.current = requestAnimationFrame(loopRef.current!);
  }, [cancelLoop]);

  const stop = useCallback(() => {
    cancelLoop();
    setState(INITIAL_STATE);
  }, [cancelLoop]);

  useEffect(() => {
    return cancelLoop;
  }, [cancelLoop]);

  return { ...state, start, stop };
}
