# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Single-page React 19 + Vite + TypeScript PWA. No backend, no tests, no monorepo. Deployed to Vercel (`.vercel/`). UI copy is English; repo name and some commit messages are Dutch — don't "fix" that.

`AGENTS.md` covers the same ground for other agents; keep the two in sync if you change architecture facts.

## Commands

| What               | Command                                       |
| ------------------ | --------------------------------------------- |
| Dev server         | `npm run dev`                                 |
| Typecheck + build  | `npm run build` (runs `tsc -b && vite build`) |
| Typecheck only     | `npx tsc -b`                                  |
| Lint               | `npm run lint`                                |
| Format             | `npm run format` / `npm run format:check`     |
| Preview prod build | `npm run preview`                             |

There is **no test runner and no test files** — don't invent `npm test`. Husky pre-commit runs `lint-staged` (eslint --fix + prettier on `*.{ts,tsx}`, prettier on `json|css|md|html`), so commits auto-fix and re-stage.

## Architecture

- `src/main.tsx` — root; registers `/sw.js`.
- `src/App.tsx` (~1200 lines) — **all UI**. Segmented tab control over five modes: `flow-breathing`, `progressive-box`, `co2-table`, `breath-journey`, `meditation` (left-to-right order lives in `TAB_ORDER`, which also drives the sliding active indicator). Active tab and every setting persist through `usePersistedState`.
- One self-contained timer hook per mode: `useBreathingTimer.ts` (progressive box), `useFlowBreathingTimer.ts`, `useCO2Timer.ts`, `useMeditationTimer.ts`. Breath Journey is not a timer — it's a plain `<audio>` element with a progress bar in `App.tsx`.
- `useGong.ts` — audio. **Non-obvious iOS handling, see below.**
- `useWakeLock.ts` — screen wake lock, silently noops if unsupported.
- `usePersistedState.ts` — `useState` + `localStorage`.
- `streak.ts` — pure daily-streak date logic (no side effects; persistence lives in `App.tsx`).

### Timer hook contract

All timers use `requestAnimationFrame` + `performance.now()` (never `setInterval`) so they survive tab throttling and stay accurate. Keep that pattern.

They fire `onPhaseChange(phase, duration)` **before** their own `setState`, so React state is stale at that moment — always use the callback's `duration` argument, never read `timer.currentDuration` from App state.

### localStorage keys

Changing a key silently discards the user's saved setting.

`activeTab`, `soundLevel` (`off|low|medium|high`), `displayMode` (`numbers|bubble`), `prepSeconds`, `musicEnabled`, `progressiveBox.roundsPerIncrement`, `flow.{breatheIn,holdIn,breatheOut,holdOut,totalMinutes,customPreset}`, `co2.holdSeconds`, `meditation.{minutes,intervalMinutes}`, `streak.{count,lastDate}`.

### Streak

`advanceStreak(lastDate, count, today)`: same day → unchanged, yesterday → +1, otherwise → reset to 1. Dates are **local** calendar days, not UTC. Endless modes (Progressive Box) only qualify if the exercise ran ≥ `MIN_SESSION_MS` (60 s), measured from `exerciseStartRef` which is set after prep ends, not at button press.

## iOS audio — read before editing `useGong.ts`

iOS WebKit (all iOS browsers, plus touch MacBooks per the detection) takes an `HTMLAudioElement` path; everything else uses Web Audio API. The unlock works because `htmlStartUnlocks()` calls `play()` on every audio element **synchronously within the user gesture**.

- Never add `await` (or anything async) before those `play()` calls.
- `preWarm` is wired to the Start button's `onPointerDown` so unlock begins during the gesture; `handleStart` then `await`s only the priority key. Preserve that split.
- Sounds split into "free" (overlapping gongs) and "stoppable" (stateful narration tracks). `stopCurrentSound` only affects the stoppable slot.
- Stoppable plays (`playBreatheIn` / `playHold` / `playBreatheOut`) take an optional `fadeSeconds`: a **linear** supplementary gain ramp to silence layered on the source's baked-in exponential decay, so the bell ends with the count instead of getting chopped. **Do not switch this to an exponential ramp** — compounding kills the bell character on short phases. All cue mp3s are exactly 16.032 s, so fades clamp at `SOURCE_MAX_SECONDS`.
- iOS volume feature-detects on the first fade attempt (`audio.volume = 0.5` write+readback). If iOS locks volume at 1.0 the whole session falls back to un-faded playback — keep that a silent fallback, not an error.

Audio lives in `public/` and is loaded by absolute URL (`/ending.mp3`, `/breathing-in.mp3`, …) — never `import` it from `src/`. `SRCS` in `useGong.ts` maps `SoundKey` to file, and several keys deliberately point at the same file (meditation's opening/interval/closing bells all reuse `/ending.mp3`).

`public/background-music.mp3` and `public/breath-journey.mp3` are standalone `<audio>` elements in `App.tsx`, **not** part of the `useGong` unlock list. Music is iOS-unlocked by calling `play()` synchronously at the top of `handleStart`, before any `await`. Any new standalone audio element must follow the same pattern.

`public/sw.js` has a hardcoded `PRECACHE_URLS` (`/`, `/gong.mp3`, `/favicon.svg`, `/icon-192.png`, `/NeulisAlt-Light.ttf`); runtime cache picks up the rest. To make a new sound work offline on first load, add it there **and** bump `CACHE_NAME`.

## Styling

Design tokens are CSS custom properties on `:root` in `src/index.css` (`--bg`, `--surface`, `--ink`, `--ink-muted`, `--accent`, `--accent-deep`, `--accent-glow`, `--line`) — warm editorial palette; use the variables, don't hardcode colors. `src/App.css` holds everything else, including the SVG countdown ring (`.ring*`).

Layout is top-anchored, not vertically centered: centering made the nav bar jump when switching to a tab with different content height. `body`/`#root` are `100dvh` with `overflow: hidden` — the app never scrolls.

Brand font `Neulis Alt` is self-hosted from `public/NeulisAlt-Light.ttf`.

## TypeScript / lint quirks

`tsconfig.app.json` enables `strict`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, and `erasableSyntaxOnly`. Type-only imports **must** use `import type { ... }`, and enum-like runtime TS syntax is banned — use union types plus `as const` objects (`TITLES`, `SOUND_LABELS`, `PREP_CYCLE`).

## Repo hygiene

Loose files at the repo root are local artifacts and must stay untracked: `Lekker Ademen Ademreis (MASTER).wav`, the brand-guide PDF, and stray `breathing-in.mp3` / `hold.mp3` / `ending.mp3` duplicates of files already in `public/`. Don't `git add` them. `dist/` and `.vercel/` are gitignored.
