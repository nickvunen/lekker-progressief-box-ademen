import { useState, useRef, useCallback, useEffect } from 'react';

export type CO2Phase = 'rest' | 'hold';

// Fixed rest schedule in seconds: 2:30 down to 1:00 in 15s steps
const REST_SCHEDULE_S = [150, 135, 120, 105, 90, 75, 60];

interface Round {
  restMs: number;
  holdMs: number;
}

interface TimerState {
  isRunning: boolean;
  phase: CO2Phase;
  phaseLabel: string;
  countdown: string;
  roundInfo: string;
}

interface Internals {
  rounds: Round[];
  roundIndex: number;
  phaseIndex: number; // 0 = rest, 1 = hold
  phaseStartTime: number;
  finishing: boolean;
}

const INITIAL_STATE: TimerState = {
  isRunning: false,
  phase: 'rest',
  phaseLabel: '',
  countdown: '',
  roundInfo: '',
};

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m > 0) return `${m}:${s.toString().padStart(2, '0')}`;
  return `${s}`;
}

export function useCO2Timer(
  holdSeconds: number,
  onPhaseChange?: (phase: CO2Phase) => void,
  onComplete?: () => void,
) {
  const [state, setState] = useState<TimerState>(INITIAL_STATE);

  const rafRef = useRef<number | null>(null);
  const holdRef = useRef(holdSeconds);
  const onPhaseChangeRef = useRef(onPhaseChange);
  const onCompleteRef = useRef(onComplete);
  const loopRef = useRef<FrameRequestCallback | null>(null);
  const internals = useRef<Internals>({
    rounds: [],
    roundIndex: 0,
    phaseIndex: 0,
    phaseStartTime: 0,
    finishing: false,
  });

  useEffect(() => {
    holdRef.current = holdSeconds;
  }, [holdSeconds]);
  useEffect(() => {
    onPhaseChangeRef.current = onPhaseChange;
  }, [onPhaseChange]);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const cancelLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => {
    loopRef.current = (now: number) => {
      const s = internals.current;
      const round = s.rounds[s.roundIndex];
      const phaseDuration = s.phaseIndex === 0 ? round.restMs : round.holdMs;
      const elapsed = now - s.phaseStartTime;
      const remaining = phaseDuration - elapsed;

      if (remaining <= 0) {
        // Advance phase
        if (s.phaseIndex === 0) {
          // Rest done → start hold
          s.phaseIndex = 1;
          s.phaseStartTime = now;
          onPhaseChangeRef.current?.('hold');
          setState({
            isRunning: true,
            phase: 'hold',
            phaseLabel: 'Hold breath',
            countdown: formatCountdown(round.holdMs),
            roundInfo: `Round ${s.roundIndex + 1} of ${s.rounds.length}`,
          });
        } else {
          // Hold done → check if last round
          if (s.roundIndex >= s.rounds.length - 1) {
            // Session complete
            cancelLoop();
            setState(INITIAL_STATE);
            onCompleteRef.current?.();
            return;
          }
          // Advance to next round, start rest
          s.roundIndex += 1;
          s.phaseIndex = 0;
          s.phaseStartTime = now;
          const nextRound = s.rounds[s.roundIndex];
          onPhaseChangeRef.current?.('rest');
          setState({
            isRunning: true,
            phase: 'rest',
            phaseLabel: 'Breathe normally',
            countdown: formatCountdown(nextRound.restMs),
            roundInfo: `Round ${s.roundIndex + 1} of ${s.rounds.length}`,
          });
        }
      } else {
        // Mid-phase update
        setState((prev) => ({
          ...prev,
          countdown: formatCountdown(remaining),
        }));
      }

      rafRef.current = requestAnimationFrame(loopRef.current!);
    };
  }, [cancelLoop]);

  const start = useCallback(() => {
    const rounds: Round[] = REST_SCHEDULE_S.map((restS) => ({
      restMs: restS * 1000,
      holdMs: holdRef.current * 1000,
    }));

    const now = performance.now();
    internals.current = {
      rounds,
      roundIndex: 0,
      phaseIndex: 0,
      phaseStartTime: now,
      finishing: false,
    };

    setState({
      isRunning: true,
      phase: 'rest',
      phaseLabel: 'Breathe normally',
      countdown: formatCountdown(rounds[0].restMs),
      roundInfo: `Round 1 of ${rounds.length}`,
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

  return { ...state, start, stop, totalRounds: REST_SCHEDULE_S.length };
}
