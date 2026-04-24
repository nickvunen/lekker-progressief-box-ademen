# Lekker Ademen

A minimal breathing-exercise PWA — four modes, tap toggles, and nothing in the way.

## Modes

- **Box** — progressive box breathing: equal in / hold / out / hold phases. Starts at 3 s per phase and adds a second every _N_ rounds.
- **Flow** — free-form breathing cycle with custom durations for each phase and a total session time.
- **CO₂** — diver-style breath-hold training. Alternates rest and hold across seven rounds; rest shortens each round (2:30 → 1:00) to build CO₂ tolerance.
- **Journey** — a short guided breath-journey audio track with a progress bar.

## Options

Each toggle sits as a pill above the Start button and persists in `localStorage`.

- **🔔 Sound** — phase cue sounds (on / off).
- **🔢 Numbers / 🫧 Bubble** — number countdown or an animated breathing bubble that grows on the in-breath and shrinks on the out-breath (Box and Flow).
- **⏱ Prep** — cycles through `10 s → 20 s → 30 s → off`. Runs a "Get ready" countdown before the exercise starts.
- **🎵 Music** — looping background bed track at low volume throughout the session.

Phase cue sounds fade to silence over the current phase duration, so the bell rings for the length of the count instead of getting chopped.

Installable as an app (PWA) — iOS via **Share → Add to Home Screen**, Android/Desktop via **Menu → Install App**. The screen wake lock keeps the display on during sessions.

## Safety

The CO₂ mode shows an on-screen warning, but it bears repeating: **never practise breath-holds alone or in or near water.** Hypoxic blackout can occur without warning.

## Development

```bash
npm install
npm run dev
```

Further workflow and architecture notes for contributors (including AI assistants) live in [`AGENTS.md`](./AGENTS.md).

## Scripts

| Command           | Description                  |
| ----------------- | ---------------------------- |
| `npm run dev`     | Start the Vite dev server    |
| `npm run build`   | Typecheck (`tsc -b`) + build |
| `npm run preview` | Preview the production build |
| `npm run lint`    | Run ESLint                   |
| `npm run format`  | Format with Prettier         |

## Tech stack

- React 19 + TypeScript
- Vite
- ESLint + Prettier
- Husky + lint-staged pre-commit hooks
- Web Audio API with an HTMLAudioElement fallback for iOS
- Service worker for offline-capable PWA
