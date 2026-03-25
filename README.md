# Progressive Box Breathing

A minimal web app for progressive box breathing exercises. Start at 3 seconds per phase and gradually increase the duration as you build your breath capacity.

## What is progressive box breathing?

Box breathing uses four equal phases:

1. **Breathe In** - inhale slowly
2. **Hold** - hold your breath
3. **Breathe Out** - exhale slowly
4. **Hold** - hold again

One cycle of all four phases is one **round**. In this app, you start at 3 seconds per phase. After a configurable number of rounds, the duration increases by 1 second (to 4s, then 5s, 6s, etc.) and continues until you stop.

## Usage

- Set the number of rounds before the duration increments (default: 2)
- Press **Start** to begin
- Press **Stop** to end the session

## Development

```bash
npm install
npm run dev
```

## Scripts

| Command           | Description                   |
| ----------------- | ----------------------------- |
| `npm run dev`     | Start development server      |
| `npm run build`   | Type-check and build for prod |
| `npm run preview` | Preview production build      |
| `npm run lint`    | Run ESLint                    |
| `npm run format`  | Format code with Prettier     |

## Tech stack

- React 19 + TypeScript
- Vite
- ESLint + Prettier
- Husky + lint-staged (pre-commit hooks)
