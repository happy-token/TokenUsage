# TokenUsage

<p align="center">
  <strong>📊 Visualize & Optimize Your Claude Code Token Spending</strong>
</p>

<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" /></a>
  <a href="https://github.com/happy-token/TokenUsage/releases"><img src="https://img.shields.io/github/v/release/happy-token/TokenUsage" alt="Release" /></a>
  <a href="./CONTRIBUTING.md"><img src="https://img.shields.io/badge/contributions-welcome-brightgreen.svg" alt="Contributions" /></a>
</p>

<p align="center">
  English · <a href="./README_CN.md">中文</a>
</p>

---

TokenUsage is a **free, open-source desktop app** that reads your [Claude Code](https://claude.ai/code) session logs and turns them into actionable cost analytics, cache optimization insights, and activity breakdowns — all in a native Electron window, with all data staying local.

## ✨ Features

- **Overview Dashboard** — KPI strip (total spend, sessions, cache hit rate, active projects) with daily activity bars and per-project cost bars
- **Project Drill-Down** — per-session timeline, activity type breakdown (feature, debugging, refactoring, etc.), model usage, git branch tracking
- **Optimization Health Score** — per-project health grade (A–F) with actionable waste findings and one-click fix copy, covering 9 waste detectors
- **Cache ROI** — gross savings, write cost, and net ROI from Claude's prompt cache
- **Tool & Shell Stats** — top tools used and shell commands by category
- **Session Activity Classification** — auto-classifies each session into 10 activity types (feature, debugging, refactoring, testing, git, build-deploy, exploration, planning, brainstorming, conversation)
- **System Tray** — live today's cost and 7-day stats without opening the main window
- **i18n** — English / 中文 toggle
- **Theme** — dark / light with persistent preference

## 📸 Screenshots

<p align="center">
  <em>Screenshots coming soon. In the meantime, clone and run <code>pnpm run dev</code> to see it live.</em>
</p>

## 🚀 Tech Stack

| Layer | Technology |
|---|---|
| Shell | Electron 30 |
| Renderer | React 18 + TypeScript |
| Build | electron-vite + Vite 5 |
| Storage | better-sqlite3 (local, no server) |
| File watch | chokidar |
| Packaging | electron-builder |

## 📋 Requirements

- **Node.js** 20+
- **pnpm** 9+
- **macOS** (primary target), Windows, or Linux

## ⚡ Getting Started

```bash
# Clone the repo
git clone https://github.com/happy-token/TokenUsage.git
cd TokenUsage

# Install dependencies (also compiles native SQLite addon)
pnpm install

# Start in development mode
pnpm run dev
```

The app automatically discovers Claude Code session logs at `~/.claude/projects/**/*.jsonl` and begins parsing them. No configuration required.

## 📦 Installation

Download the latest release from the [Releases](https://github.com/happy-token/TokenUsage/releases) page:

| Platform | Package |
|---|---|
| **macOS** | `.dmg` |
| **Windows** | `.exe` (NSIS installer) |
| **Linux** | `.AppImage` |

## 📖 Scripts

| Command | Description |
|---|---|
| `pnpm run dev` | Start Electron + Vite dev server with HMR |
| `pnpm run build` | Production build |
| `pnpm run package` | Build + package distributable (`.dmg`, `.exe`, `.AppImage`) |
| `pnpm test` | Run unit tests (Vitest) |
| `pnpm run test:watch` | Watch mode |
| `pnpm run test:e2e` | Playwright end-to-end tests |
| `pnpm run typecheck` | TypeScript type check without emitting |

## 📁 Project Structure

```
TokenUsage/
├── src/
│   ├── main/            # Electron main process
│   │   ├── index.ts     # App bootstrap, window, system tray
│   │   ├── db.ts        # SQLite schema & migrations
│   │   ├── parser.ts    # JSONL → session/turn model + cost calc
│   │   ├── watcher.ts   # chokidar file watcher
│   │   ├── classifier.ts  # Activity type classification
│   │   ├── optimize.ts  # Health scoring & waste findings
│   │   ├── ipc.ts       # IPC handler registry
│   │   └── store.ts     # Query & tray stats cache
│   ├── preload/
│   │   └── index.ts     # Context bridge (exposes window.tokenUsage)
│   └── renderer/
│       └── src/
│           ├── App.tsx          # Root component + routing
│           ├── pages/           # Overview, ProjectDetail, Settings, Sessions
│           ├── components/      # Sidebar, AppLogo
│           ├── contexts/        # ThemeContext, I18nContext
│           └── types.ts         # Renderer-side shared types
├── tests/                # Unit tests + JSONL fixtures
├── resources/            # Icons, models.json pricing table
├── scripts/              # Build, notarization, release helpers
└── .github/workflows/    # CI + release pipelines
```

## 💰 Model Pricing

Cost is computed locally from token counts using these rates (USD per 1M tokens):

| Model | Input | Output | Cache Read | Cache Write |
|---|---|---|---|---|
| claude-opus-4-7 / 4-6 | $15 | $75 | $1.5 | $18.75 |
| claude-sonnet-4-6 | $3 | $15 | $0.3 | $3.75 |
| claude-haiku-4-5 | $0.8 | $4 | $0.08 | $1.00 |

If a session already includes a `costUSD` field in the JSONL, that value is used directly. Model pricing is configured in `resources/models.json`.

## 🔒 Data & Privacy

**All data stays on your machine.** Nothing is sent to any server. The SQLite database is stored in Electron's [app data directory](https://www.electronjs.org/docs/latest/api/app#appgetpathname). No telemetry, no tracking, no analytics — just local files.

## 🙋 FAQ

<details>
<summary><strong>How does TokenUsage get my Claude Code data?</strong></summary>
<br />
Claude Code writes session logs as <code>.jsonl</code> files in <code>~/.claude/projects/</code>. TokenUsage watches this directory, parses new entries, and stores them in a local SQLite database. The data never leaves your machine.
</details>

<details>
<summary><strong>Do I need an internet connection?</strong></summary>
<br />
No. TokenUsage works entirely offline. Only the model pricing in <code>resources/models.json</code> is bundled statically — you can update it manually if pricing changes.
</details>

<details>
<summary><strong>How accurate is the cost tracking?</strong></summary>
<br />
TokenUsage uses two strategies: (1) if Claude Code includes a <code>costUSD</code> field, that value is used directly; (2) otherwise, cost is computed locally from token counts using the official Anthropic pricing rates. Cache write costs and read savings are also factored in.
</details>

<details>
<summary><strong>How does the health score work?</strong></summary>
<br />
The optimization engine runs 9 waste detectors (e.g., reading <code>node_modules/</code>, duplicate file reads, oversized CLAUDE.md). Each finding impacts the score based on severity. Grade: A (90+), B (75+), C (55+), D (30+), F (<30). Results are cached for 1 hour.
</details>

<details>
<summary><strong>Can I contribute pricing for a new model?</strong></summary>
<br />
Yes! See <a href="./CONTRIBUTING.md#adding-a-new-model">CONTRIBUTING.md</a>. Add a new entry to <code>resources/models.json</code> with the canonical model ID and per-token pricing, then submit a PR.
</details>

<details>
<summary><strong>Can I delete sessions or projects from the app?</strong></summary>
<br />
Yes. You can delete individual sessions from the project detail view, and entire projects (with all their sessions) are also deletable. Note: this only removes data from the TokenUsage database — your original <code>.jsonl</code> files are untouched.
</details>

<details>
<summary><strong>Which platforms are supported?</strong></summary>
<br />
macOS (Intel + Apple Silicon), Windows (x64), and Linux (x64 AppImage). macOS is the primary development target.
</details>

<details>
<summary><strong>Does TokenUsage work with the Claude API directly?</strong></summary>
<br />
No — TokenUsage is designed specifically for Claude Code's session logs. For direct API usage, your API dashboard on console.anthropic.com provides cost analytics.
</details>

## 🗺 Roadmap

See [ROADMAP.md](./ROADMAP.md) for the full project roadmap, including planned features and long-term goals.

## 👥 Community & Support

We'd love to hear from you! Here's how to connect:

| Channel | Link | Best For |
|---|---|---|
| **GitHub Issues** | [Issues](https://github.com/happy-token/TokenUsage/issues) | Bug reports, feature requests |
| **GitHub Discussions** | [Discussions](https://github.com/happy-token/TokenUsage/discussions) | Q&A, ideas, community chat |
| **Discord** | _Coming soon_ | Real-time chat, developer collaboration |
| **Telegram** | _Coming soon_ | Community updates, quick questions |
| **WeChat (微信)** | _Coming soon_ | Chinese-speaking user community |

> **Community platform recommendation:** Discord is the standard for international developer tools (think VS Code, Electron, React communities). Telegram is very popular in Asia, Eastern Europe, and the crypto/tech crowd. WeChat is essential for the Chinese developer ecosystem. We recommend joining whichever platform you're most comfortable with — we'll share announcements across all channels.

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for:

- Development setup
- How to add new models
- Pull request guidelines
- Code review expectations

This project follows the [Contributor Covenant Code of Conduct](./CODE_OF_CONDUCT.md).

## 📄 License

MIT © [happy-token](https://github.com/happy-token)

---

<p align="center">
  <sub>Built with ❤️ for the Claude Code community. If you find TokenUsage useful, please consider <a href="https://github.com/happy-token/TokenUsage">giving it a star ⭐</a> on GitHub!</sub>
</p>
