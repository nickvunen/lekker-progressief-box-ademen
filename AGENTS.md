# AGENTS.md

Single-page React 19 + Vite + TypeScript PWA. No backend, no tests, no
monorepo. Deployed to Vercel (see `.vercel/`). UI is English; repo and some
commit messages are Dutch — don't "fix" that.

## Commands

| What               | Command                                       |
| ------------------ | --------------------------------------------- |
| Dev server         | `npm run dev`                                 |
| Typecheck + build  | `npm run build` (runs `tsc -b && vite build`) |
| Typecheck only     | `npx tsc -b`                                  |
| Lint               | `npm run lint`                                |
| Format             | `npm run format` / `npm run format:check`     |
| Preview prod build | `npm run preview`                             |

There is **no test runner and no test files**. Don't invent `npm test`.
Husky pre-commit runs `lint-staged` (eslint --fix + prettier on `*.{ts,tsx}`,
prettier on `json|css|md|html`) — your commits will auto-fix and re-stage.

## Architecture

- `src/main.tsx` — root, registers `/sw.js`.
- `src/App.tsx` — all UI; tab switcher over four modes:
  `progressive-box`, `flow-breathing`, `co2-table`, `breath-journey`.
  Active tab + all settings persist via `usePersistedState`.
- Per-mode timer hooks, each self-contained: `useBreathingTimer.ts`
  (progressive box), `useFlowBreathingTimer.ts`, `useCO2Timer.ts`.
  Timers use `requestAnimationFrame` + `performance.now()` (not
  `setInterval`) so they survive tab throttling and stay accurate — keep
  that pattern if you modify them.
- `useGong.ts` — audio playback, **has non-obvious iOS handling, see below**.
- `useWakeLock.ts` — screen wake lock (silently noops if unsupported).
- `usePersistedState.ts` — `useState` + `localStorage`. Existing keys in
  use: `activeTab`, `soundEnabled`, `progressiveBox.roundsPerIncrement`,
  `flow.{breatheIn,holdIn,breatheOut,holdOut,totalMinutes}`,
  `co2.holdSeconds`. Changing a key silently loses user settings.

## iOS audio — read before editing `useGong.ts`

iOS WebKit (including all iOS browsers and touch-MacBooks per the detection)
goes down an `HTMLAudioElement` path; everything else uses Web Audio API.
The iOS unlock works because `htmlStartUnlocks()` calls `play()` on every
audio element **synchronously within the user gesture**. Rules:

- Do not add `await` (or anything async) before those `play()` calls.
- `preWarm` is deliberately wired to `onPointerDown` of the Start button so
  unlock begins during the gesture; `handleStart` then `await`s only the
  priority key. Preserve that split.
- Sounds split into "free" (overlapping gongs) and "stoppable" (stateful
  narration tracks). `stopCurrentSound` only affects the stoppable slot.

Audio files live in `public/` and are loaded by absolute URL (`/gong.mp3`,
`/breathing-in.mp3`, etc.) — don't `import` them from `src/`.

`public/background-music.mp3` is a separate looping bed track controlled by
a standalone `<audio>` element in `App.tsx`, **not** part of the `useGong`
unlock list. It's iOS-unlocked by calling `play()` synchronously at the top
of `handleStart` (before any `await`). If you add another standalone audio
element, follow the same pattern.

`public/sw.js` has a hardcoded `PRECACHE_URLS` list that only caches
`/`, `/gong.mp3`, `/favicon.svg`, `/icon-192.png`. Runtime cache picks up
the rest. If you add a sound that must work offline on first load, add it
to `PRECACHE_URLS` and bump `CACHE_NAME`.

## TypeScript / lint quirks

`tsconfig.app.json` enables `strict`, `noUnusedLocals`,
`noUnusedParameters`, `verbatimModuleSyntax`, and `erasableSyntaxOnly`.
Type-only imports **must** use `import type { ... }` (see existing files),
and enum-like runtime TS syntax is disallowed — use union types + `as const`
objects like `PHASE_LABELS`.

## Repo hygiene

Several loose files at the repo root are local artifacts and should stay
untracked: `warnings_*.json`, `Lekker Ademen Ademreis (MASTER).wav`, and
stray `breathing-in.mp3` / `hold.mp3` / etc. duplicates of files already in
`public/`. Don't `git add` them. `dist/` and `.vercel/` are gitignored.
