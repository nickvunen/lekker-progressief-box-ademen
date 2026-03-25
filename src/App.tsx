import { useState, useCallback } from 'react';
import { useBreathingTimer } from './useBreathingTimer';
import { useGong } from './useGong';
import { useWakeLock } from './useWakeLock';
import './App.css';

const isInstalled = window.matchMedia('(display-mode: standalone)').matches;

function App() {
  const [roundsPerIncrement, setRoundsPerIncrement] = useState(2);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const gong = useGong();
  const wakeLock = useWakeLock();

  const handlePhaseChange = useCallback(() => {
    gong.play();
  }, [gong]);

  const timer = useBreathingTimer(roundsPerIncrement, handlePhaseChange);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    gong.setEnabled(next);
  };

  return (
    <div className="app">
      <h1 className="title">Progressive Box Breathing</h1>

      {!timer.isRunning && !isInstalled && (
        <p className="install-hint">
          Install as app: tap <strong>Share &rarr; Add to Home Screen</strong>{' '}
          (iOS) or <strong>Menu &rarr; Install App</strong> (Android/Desktop)
        </p>
      )}

      {!timer.isRunning ? (
        <>
          <div className="settings">
            <label>Rounds before increment</label>
            <div className="rounds-selector">
              <button
                onClick={() => setRoundsPerIncrement((r) => Math.max(1, r - 1))}
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

          <button
            className={`sound-toggle ${soundEnabled ? 'sound-on' : ''}`}
            onClick={toggleSound}
            aria-label={soundEnabled ? 'Disable sound' : 'Enable sound'}
          >
            {soundEnabled ? '🔔 Sound on' : '🔕 Sound off'}
          </button>

          <div className="controls">
            <button
              className="btn btn-start"
              onClick={() => {
                timer.start();
                wakeLock.request();
              }}
            >
              Start
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="timer-display">
            <div className="phase-label phase-enter" key={timer.phase}>
              {timer.phaseLabel}
            </div>
            <div className="countdown">{timer.secondsLeft}</div>
            <div className="info">
              {timer.currentDuration}s &middot; round {timer.roundInSet}/
              {roundsPerIncrement}
            </div>
          </div>

          <div className="controls">
            <button
              className="btn btn-stop"
              onClick={() => {
                timer.stop();
                wakeLock.release();
              }}
            >
              Stop
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
