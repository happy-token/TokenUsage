# TokenUsage (ClaudeInsight)

A desktop app for visualizing and optimizing your [Claude Code](https://claude.ai/code) token spending. Reads the local JSONL session logs that Claude Code writes, stores them in SQLite, and presents cost/cache/activity analytics in a native Electron window.

## Features

- **Overview dashboard** — KPI strip (total spend, sessions, cache hit rate, active projects) with daily activity bars and per-project cost bars
- **Project drill-down** — per-session timeline, activity breakdown by type (feature, debugging, refactoring, etc.), model usage, and git branch info
- **Optimize health** — per-project health score (A–F) with actionable waste findings and one-click fix copy
- **Cache ROI** — gross savings, write cost, and net ROI from Claude's prompt cache
- **Tool & shell stats** — top tools used and shell commands by category
- **System tray** — live today's cost and 7-day totals without opening the main window
- **i18n** — English / 中文 toggle
- **Theme** — dark / light

## Tech stack

| Layer | Technology |
|---|---|
| Shell | Electron 30 |
| Renderer | React 18 + TypeScript |
| Build | electron-vite + Vite 5 |
| Storage | better-sqlite3 (local, no server) |
| File watch | chokidar |
| Packaging | electron-builder |

## Requirements

- Node.js 20+
- macOS (primary), Windows, or Linux

## Getting started

```bash
# Install dependencies (also compiles native SQLite addon)
npm install

# Start in development mode
npm run dev
```

The app automatically finds Claude Code session logs at `~/.claude/projects/**/*.jsonl` and begins parsing them. No configuration required.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Electron + Vite dev server with HMR |
| `npm run build` | Production build |
| `npm run package` | Build + package distributable (`.dmg`, `.exe`, `.AppImage`) |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:watch` | Watch mode |
| `npm run test:e2e` | Playwright end-to-end tests |
| `npm run typecheck` | TypeScript type check without emitting |

## Project structure

```
src/
├── main/           # Electron main process
│   ├── index.ts    # App bootstrap, window, tray
│   ├── db.ts       # SQLite schema & migrations
│   ├── parser.ts   # JSONL → session/turn model + cost calc
│   ├── watcher.ts  # chokidar file watcher
│   ├── classifier.ts  # Activity type classification
│   ├── optimize.ts    # Health scoring & waste findings
│   ├── ipc.ts      # IPC handler registry
│   └── store.ts    # In-memory tray stats cache
├── preload/
│   └── index.ts    # Context bridge (exposes window.claudeInsight)
└── renderer/
    └── src/
        ├── App.tsx             # Root component + routing
        ├── pages/
        │   ├── Overview.tsx    # Global dashboard
        │   ├── ProjectDetail.tsx
        │   └── Settings.tsx
        ├── components/
        │   ├── Sidebar.tsx
        │   └── AppLogo.tsx
        ├── contexts/
        │   ├── ThemeContext.tsx
        │   └── I18nContext.tsx
        └── types.ts            # Renderer-side shared types
```

## Model pricing

Cost is computed locally from token counts using these rates (USD per 1M tokens):

| Model | Input | Output | Cache read | Cache write |
|---|---|---|---|---|
| claude-opus-4-7 / 4-6 | $15 | $75 | $1.5 | $18.75 |
| claude-sonnet-4-6 | $3 | $15 | $0.3 | $3.75 |
| claude-haiku-4-5 | $0.8 | $4 | $0.08 | $1.00 |

If a session already includes a `costUSD` field in the JSONL, that value is used directly.

## Data & privacy

All data stays on your machine. Nothing is sent to any server. The SQLite database is stored in Electron's [app data directory](https://www.electronjs.org/docs/latest/api/app#appgetpathname).
