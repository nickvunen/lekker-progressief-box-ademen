import { useCallback } from 'react';
import { useBreathingTimer } from './useBreathingTimer';
import type { Phase } from './useBreathingTimer';
import { useFlowBreathingTimer } from './useFlowBreathingTimer';
import type { FlowSettings } from './useFlowBreathingTimer';
import { useGong } from './useGong';
import { useWakeLock } from './useWakeLock';
import { usePersistedState } from './usePersistedState';
import './App.css';

type Tab = 'progressive-box' | 'flow-breathing';

const isInstalled = window.matchMedia('(display-mode: standalone)').matches;

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

  const flowSettings: FlowSettings = {
    breatheIn,
    holdIn,
    breatheOut,
    holdOut,
    totalMinutes,
  };

  const gong = useGong();
  const wakeLock = useWakeLock();

  const handlePhaseChange = useCallback(
    (phase: Phase) => {
      if (phase === 'breathe-in' || phase === 'hold-in') {
        gong.playIn();
      } else {
        gong.playOut();
      }
    },
    [gong],
  );

  const handleFlowComplete = useCallback(() => {
    gong.playFinish();
  }, [gong]);

  const boxTimer = useBreathingTimer(roundsPerIncrement, handlePhaseChange);
  const flowTimer = useFlowBreathingTimer(
    flowSettings,
    handlePhaseChange,
    handleFlowComplete,
  );

  const isRunning = boxTimer.isRunning || flowTimer.isRunning;

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    gong.setEnabled(next);
  };

  // Sync gong enabled state on mount
  gong.setEnabled(soundEnabled);

  const handleStart = () => {
    gong.warmUp();
    // Small delay so warmUp unlocks audio before the first gong
    setTimeout(() => gong.playIn(), 50);
    if (activeTab === 'progressive-box') {
      boxTimer.start();
    } else {
      flowTimer.start();
    }
    wakeLock.request();
  };

  const handleStop = () => {
    boxTimer.stop();
    flowTimer.stop();
    wakeLock.release();
  };

  return (
    <div className="app">
      {!isRunning && (
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'progressive-box' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('progressive-box')}
          >
            Progressive Box
          </button>
          <button
            className={`tab ${activeTab === 'flow-breathing' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('flow-breathing')}
          >
            Flow Breathing
          </button>
        </div>
      )}

      <h1 className="title">
        {activeTab === 'progressive-box'
          ? 'Progressive Box Breathing'
          : 'Flow Breathing'}
      </h1>

      {!isRunning && (
        <p className="description">
          {activeTab === 'progressive-box'
            ? 'Breathe in, hold, breathe out, hold — all equal length. After a set number of rounds, the duration increases by one second.'
            : 'A free-form breathing cycle with custom durations for each phase. Set your rhythm and total session time.'}
        </p>
      )}

      {!isRunning ? (
        <>
          {activeTab === 'progressive-box' ? (
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
          ) : (
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
          {activeTab === 'progressive-box' ? (
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
          ) : (
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
