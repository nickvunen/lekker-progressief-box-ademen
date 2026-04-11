import { useCallback, useState, useRef } from 'react';
import { useBreathingTimer } from './useBreathingTimer';
import type { Phase } from './useBreathingTimer';
import { useFlowBreathingTimer } from './useFlowBreathingTimer';
import type { FlowSettings } from './useFlowBreathingTimer';
import { useCO2Timer } from './useCO2Timer';
import type { CO2Phase } from './useCO2Timer';
import { useGong } from './useGong';
import { useWakeLock } from './useWakeLock';
import { usePersistedState } from './usePersistedState';
import './App.css';

type Tab =
  | 'progressive-box'
  | 'flow-breathing'
  | 'co2-table'
  | 'breath-journey';

const isInstalled = window.matchMedia('(display-mode: standalone)').matches;

const TITLES: Record<Tab, string> = {
  'progressive-box': 'Progressive Box Breathing',
  'flow-breathing': 'Flow Breathing',
  'co2-table': 'CO₂ Table',
  'breath-journey': 'Breath Journey',
};

const DESCRIPTIONS: Record<Tab, string> = {
  'progressive-box':
    'Breathe in, hold, breathe out, hold — all equal length. After a set number of rounds, the duration increases by one second.',
  'flow-breathing':
    'A free-form breathing cycle with custom durations for each phase. Set your rhythm and total session time.',
  'co2-table':
    'Diver training: alternate between rest and breath-holds. Rest periods shorten each round to build CO₂ tolerance.',
  'breath-journey':
    'Take a short breath journey to deeply relax and connect with yourself.',
};

function formatTime(secs: number) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function App() {
  const [activeTab, setActiveTab] = usePersistedState<Tab>(
    'activeTab',
    'progressive-box',
  );
  const [roundsPerIncrement, setRoundsPerIncrement] = usePersistedState(
    'progressiveBox.roundsPerIncrement',
    2,
  );
  const [soundEnabled, setSoundEnabled] = usePersistedState(
    'soundEnabled',
    false,
  );

  // Flow settings
  const [breatheIn, setBreatheIn] = usePersistedState('flow.breatheIn', 5.5);
  const [holdIn, setHoldIn] = usePersistedState('flow.holdIn', 0);
  const [breatheOut, setBreatheOut] = usePersistedState('flow.breatheOut', 5.5);
  const [holdOut, setHoldOut] = usePersistedState('flow.holdOut', 0);
  const [totalMinutes, setTotalMinutes] = usePersistedState(
    'flow.totalMinutes',
    5,
  );

  // CO2 settings
  const [co2Hold, setCo2Hold] = usePersistedState('co2.holdSeconds', 20);

  // Breath Journey player state
  const [journeyPlaying, setJourneyPlaying] = useState(false);
  const [journeyCurrentTime, setJourneyCurrentTime] = useState(0);
  const [journeyDuration, setJourneyDuration] = useState(0);
  const journeyAudioRef = useRef<HTMLAudioElement>(null);

  const flowSettings: FlowSettings = {
    breatheIn,
    holdIn,
    breatheOut,
    holdOut,
    totalMinutes,
  };

  const gong = useGong();
  const wakeLock = useWakeLock();

  // Progressive Box — old gong sounds, unchanged
  const handleBoxPhaseChange = useCallback(
    (phase: Phase) => {
      if (phase === 'breathe-in' || phase === 'hold-in') {
        gong.playIn();
      } else {
        gong.playOut();
      }
    },
    [gong],
  );

  // Flow — new stoppable sounds
  const handleFlowPhaseChange = useCallback(
    (phase: Phase) => {
      if (phase === 'breathe-in') {
        gong.playBreatheIn();
      } else if (phase === 'hold-in' || phase === 'hold-out') {
        gong.playHold();
      } else {
        gong.playBreatheOut();
      }
    },
    [gong],
  );

  // CO₂ — new stoppable sounds
  const handleCO2PhaseChange = useCallback(
    (phase: CO2Phase) => {
      if (phase === 'hold') {
        gong.playHold();
      } else {
        gong.playEnding();
      }
    },
    [gong],
  );

  const handleComplete = useCallback(() => {
    gong.playEnding();
  }, [gong]);

  const boxTimer = useBreathingTimer(roundsPerIncrement, handleBoxPhaseChange);
  const flowTimer = useFlowBreathingTimer(
    flowSettings,
    handleFlowPhaseChange,
    handleComplete,
  );
  const co2Timer = useCO2Timer(co2Hold, handleCO2PhaseChange, handleComplete);

  const isRunning =
    boxTimer.isRunning || flowTimer.isRunning || co2Timer.isRunning;

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    gong.setEnabled(next);
  };

  // Sync gong enabled state on mount
  gong.setEnabled(soundEnabled);

  const handleTabChange = (tab: Tab) => {
    if (activeTab === 'breath-journey' && journeyAudioRef.current) {
      journeyAudioRef.current.pause();
      journeyAudioRef.current.currentTime = 0;
      setJourneyCurrentTime(0);
    }
    setActiveTab(tab);
  };

  const handleStart = async () => {
    await gong.warmUp();
    if (activeTab === 'progressive-box') {
      boxTimer.start();
      gong.playIn();
    } else if (activeTab === 'flow-breathing') {
      flowTimer.start();
      gong.playBreatheIn();
    } else {
      co2Timer.start();
      gong.playEnding(); // CO₂ starts with the rest phase
    }
    wakeLock.request();
  };

  const handleStop = () => {
    boxTimer.stop();
    flowTimer.stop();
    co2Timer.stop();
    gong.stopCurrentSound();
    wakeLock.release();
  };

  const handleJourneyToggle = () => {
    const audio = journeyAudioRef.current;
    if (!audio) return;
    if (journeyPlaying) {
      audio.pause();
    } else {
      audio.play();
      wakeLock.request();
    }
  };

  return (
    <div className="app">
      {!isRunning && (
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'progressive-box' ? 'tab-active' : ''}`}
            onClick={() => handleTabChange('progressive-box')}
          >
            Box
          </button>
          <button
            className={`tab ${activeTab === 'flow-breathing' ? 'tab-active' : ''}`}
            onClick={() => handleTabChange('flow-breathing')}
          >
            Flow
          </button>
          <button
            className={`tab ${activeTab === 'co2-table' ? 'tab-active' : ''}`}
            onClick={() => handleTabChange('co2-table')}
          >
            CO₂
          </button>
          <button
            className={`tab ${activeTab === 'breath-journey' ? 'tab-active' : ''}`}
            onClick={() => handleTabChange('breath-journey')}
          >
            Journey
          </button>
        </div>
      )}

      <h1 className="title">{TITLES[activeTab]}</h1>

      {(!isRunning || activeTab === 'breath-journey') && (
        <p className="description">{DESCRIPTIONS[activeTab]}</p>
      )}

      {activeTab === 'breath-journey' ? (
        <div className="journey-player">
          <audio
            ref={journeyAudioRef}
            src="/breath-journey.mp3"
            onPlay={() => setJourneyPlaying(true)}
            onPause={() => {
              setJourneyPlaying(false);
              wakeLock.release();
            }}
            onEnded={() => {
              setJourneyPlaying(false);
              setJourneyCurrentTime(0);
              if (journeyAudioRef.current)
                journeyAudioRef.current.currentTime = 0;
              wakeLock.release();
            }}
            onTimeUpdate={(e) =>
              setJourneyCurrentTime((e.target as HTMLAudioElement).currentTime)
            }
            onLoadedMetadata={(e) =>
              setJourneyDuration((e.target as HTMLAudioElement).duration)
            }
          />
          <button
            className="journey-play-btn"
            onClick={handleJourneyToggle}
            aria-label={journeyPlaying ? 'Pause journey' : 'Play journey'}
          >
            {journeyPlaying ? '⏸' : '▶'}
          </button>
          <div className="journey-progress-container">
            <input
              type="range"
              className="journey-progress"
              min={0}
              max={journeyDuration || 100}
              step={0.1}
              value={journeyCurrentTime}
              style={
                {
                  '--progress': journeyDuration
                    ? journeyCurrentTime / journeyDuration
                    : 0,
                } as React.CSSProperties
              }
              onChange={(e) => {
                const t = Number(e.target.value);
                if (journeyAudioRef.current)
                  journeyAudioRef.current.currentTime = t;
                setJourneyCurrentTime(t);
              }}
            />
            <div className="journey-time">
              <span>{formatTime(journeyCurrentTime)}</span>
              <span>
                {journeyDuration ? formatTime(journeyDuration) : '--:--'}
              </span>
            </div>
          </div>
        </div>
      ) : !isRunning ? (
        <>
          {activeTab === 'progressive-box' && (
            <div className="settings">
              <label>Rounds before increment</label>
              <div className="rounds-selector">
                <button
                  onClick={() =>
                    setRoundsPerIncrement((r) => Math.max(1, r - 1))
                  }
                  aria-label="Decrease rounds"
                >
                  &minus;
                </button>
                <span className="rounds-value">{roundsPerIncrement}</span>
                <button
                  onClick={() => setRoundsPerIncrement((r) => r + 1)}
                  aria-label="Increase rounds"
                >
                  +
                </button>
              </div>
            </div>
          )}

          {activeTab === 'flow-breathing' && (
            <div className="settings">
              <FlowSetting
                label="In breath"
                value={breatheIn}
                min={0.5}
                onChange={setBreatheIn}
                unit="s"
              />
              <FlowSetting
                label="Hold in"
                value={holdIn}
                min={0}
                onChange={setHoldIn}
                unit="s"
              />
              <FlowSetting
                label="Out breath"
                value={breatheOut}
                min={0.5}
                onChange={setBreatheOut}
                unit="s"
              />
              <FlowSetting
                label="Hold out"
                value={holdOut}
                min={0}
                onChange={setHoldOut}
                unit="s"
              />
              <FlowSetting
                label="Total time"
                value={totalMinutes}
                min={0.5}
                onChange={setTotalMinutes}
                unit="min"
              />
            </div>
          )}

          {activeTab === 'co2-table' && (
            <div className="settings">
              <div className="flow-setting">
                <label>Hold duration</label>
                <div className="rounds-selector">
                  <button
                    className="btn-jump"
                    onClick={() => setCo2Hold((v) => Math.max(5, v - 10))}
                    aria-label="Decrease hold by 10"
                  >
                    &minus;10
                  </button>
                  <button
                    onClick={() => setCo2Hold((v) => Math.max(5, v - 1))}
                    aria-label="Decrease hold"
                  >
                    &minus;
                  </button>
                  <span className="rounds-value">{co2Hold}s</span>
                  <button
                    onClick={() => setCo2Hold((v) => v + 1)}
                    aria-label="Increase hold"
                  >
                    +
                  </button>
                  <button
                    className="btn-jump"
                    onClick={() => setCo2Hold((v) => v + 10)}
                    aria-label="Increase hold by 10"
                  >
                    +10
                  </button>
                </div>
              </div>
              <p className="co2-schedule">
                Rest: 2:30 &rarr; 2:15 &rarr; 2:00 &rarr; 1:45 &rarr; 1:30
                &rarr; 1:15 &rarr; 1:00 &middot; 7 rounds
              </p>
              <div className="disclaimer">
                ⚠️ Never practice breath-holds alone or in/near water. Hypoxic
                blackout can occur without warning.
              </div>
            </div>
          )}

          <div className="actions">
            <button
              className={`sound-toggle ${soundEnabled ? 'sound-on' : ''}`}
              onClick={toggleSound}
              aria-label={soundEnabled ? 'Disable sound' : 'Enable sound'}
            >
              {soundEnabled ? '🔔 Sound on' : '🔕 Sound off'}
            </button>

            <div className="controls">
              <button className="btn btn-start" onClick={handleStart}>
                Start
              </button>
            </div>
          </div>

          {!isInstalled && (
            <p className="install-hint">
              Install as app: tap{' '}
              <strong>Share &rarr; Add to Home Screen</strong> (iOS) or{' '}
              <strong>Menu &rarr; Install App</strong> (Android/Desktop)
            </p>
          )}
        </>
      ) : (
        <>
          {activeTab === 'progressive-box' && (
            <div className="timer-display">
              <div className="phase-label phase-enter" key={boxTimer.phase}>
                {boxTimer.phaseLabel}
              </div>
              <div
                className="countdown countdown-tick"
                key={boxTimer.secondsLeft}
              >
                {boxTimer.secondsLeft}
              </div>
              <div className="info">
                {boxTimer.currentDuration}s &middot; round {boxTimer.roundInSet}
                /{roundsPerIncrement}
              </div>
            </div>
          )}

          {activeTab === 'flow-breathing' && (
            <div className="timer-display">
              <div className="phase-label phase-enter" key={flowTimer.phase}>
                {flowTimer.phaseLabel}
              </div>
              <div className="countdown-wrapper">
                <div
                  className={`countdown countdown-tick ${flowTimer.displayTime.includes('.') ? 'countdown-half' : ''}`}
                  key={flowTimer.displayTime}
                >
                  {flowTimer.displayTime}
                </div>
              </div>
              <div className="info">{flowTimer.remainingTime}</div>
            </div>
          )}

          {activeTab === 'co2-table' && (
            <div className="timer-display">
              <div
                className="phase-label phase-enter"
                key={co2Timer.phase + co2Timer.roundInfo}
              >
                {co2Timer.phaseLabel}
              </div>
              <div
                className="countdown countdown-tick"
                key={co2Timer.countdown}
              >
                {co2Timer.countdown}
              </div>
              <div className="info">{co2Timer.roundInfo}</div>
            </div>
          )}

          <div className="controls">
            <button className="btn btn-stop" onClick={handleStop}>
              Stop
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function FlowSetting({
  label,
  value,
  min,
  onChange,
  unit,
}: {
  label: string;
  value: number;
  min: number;
  onChange: (val: number | ((prev: number) => number)) => void;
  unit: string;
}) {
  const display =
    value % 1 === 0 ? `${value}${unit}` : `${value.toFixed(1)}${unit}`;

  return (
    <div className="flow-setting">
      <label>{label}</label>
      <div className="rounds-selector">
        <button
          onClick={() => onChange((v) => Math.max(min, +(v - 0.5).toFixed(1)))}
          aria-label={`Decrease ${label}`}
        >
          &minus;
        </button>
        <span className="rounds-value">{display}</span>
        <button
          onClick={() => onChange((v) => +(v + 0.5).toFixed(1))}
          aria-label={`Increase ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

export default App;
