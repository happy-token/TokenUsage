# Roadmap

This document outlines the planned development trajectory for TokenUsage. Priorities and timelines may shift based on community feedback and maintainer bandwidth. Items marked `[?]` are under consideration and need community input.

---

## Short-Term (v0.2 – v0.3)

These items are actively being worked on or queued for the next few releases.

### Core Experience

- [ ] **Insights Page** — rule-based suggestions surfaced from session patterns (e.g., "you spend 40% of time debugging — consider writing more tests first")
- [ ] **Export to CSV/JSON** — allow users to export cost and usage data for external analysis
- [ ] **Screenshots** — add app screenshots to README and create a `/screenshots` directory

### Data & Accuracy

- [ ] **Multi-account support** — detect and separate sessions across different Claude accounts on the same machine
- [ ] **Custom model pricing** — UI to add or override pricing in `models.json` without editing the file manually
- [ ] **Partial session handling** — gracefully handle incomplete or still-being-written JSONL files

### UX Polish

- [ ] **Keyboard shortcuts** — `Cmd/Ctrl+F` for search, `Cmd/Ctrl+,` for settings
- [ ] **Window position/state persistence** — remember window size and position between launches
- [ ] **Loading skeleton fidelity** — tighter skeleton-to-content match to reduce perceived layout shift
- [ ] **Error boundary pages** — graceful error recovery with "retry" and "report" actions

---

## Mid-Term (v0.4 – v0.6)

These are planned features that require more significant design and implementation effort.

### Analytics & Visualization

- [ ] **Interactive charts** — replace static bar charts with zoomable/pannable time-series (echarts or recharts)
- [ ] **Project comparison view** — side-by-side cost and efficiency comparison across projects
- [ ] **Team aggregate view** [?] — optionally merge stats across multiple machines for team-level insights (opt-in, local-network only)
- [ ] **Trend prediction** — simple linear projection of monthly spend based on historical data

### Optimization Engine v2

- [ ] **Custom waste detector rules** — let users define their own waste patterns (glob patterns + thresholds)
- [ ] **Auto-fix suggestions** — for certain waste types (e.g., oversized CLAUDE.md), offer a diff view with proposed changes
- [ ] **Historical health trends** — track health score over time per project, not just current snapshot
- [ ] **Cost-saving impact tracker** — show cumulative savings from applied optimizations

### Integration

- [ ] **System notifications** — optional daily/weekly summary pushed to macOS Notification Center / Windows toast
- [ ] **CLI companion** — `tokenusage` CLI for quick stats without opening the GUI: `tokenusage today`, `tokenusage project my-project`
- [ ] **CI/CD cost tracking** [?] — parse Claude Code usage in GitHub Actions / CI environments

### Community Infrastructure

- [ ] **Official Discord server** — moderated community with support channels and contributor discussion
- [ ] **Telegram group** — for Asian/EU community and quick announcements
- [ ] **WeChat group** — for Chinese-speaking users
- [ ] **GitHub Discussions** — enable and seed with FAQ content

---

## Long-Term (v0.7 – v1.0+)

These are ambitious features that define the v1 vision. Subject to change based on community direction.

### Platform & Distribution

- [ ] **Auto-update** — leverage `electron-updater` (already a dependency) for seamless in-app updates
- [ ] **Signed Windows builds** — acquire and configure a Windows code signing certificate
- [ ] **Homebrew cask** — distribute macOS builds via `brew install --cask tokenusage`
- [ ] **winget / Chocolatey** — Windows package manager distribution
- [ ] **Linux Flatpak / Snap** — broader Linux distribution beyond AppImage

### Advanced Analytics

- [ ] **Custom dashboards** — drag-and-drop dashboard builder for personalized views
- [ ] **Alert rules** — user-configurable thresholds: "notify me when weekly spend exceeds $X"
- [ ] **Model migration calculator** — "if I switch from Opus to Sonnet for these tasks, I'd save $Y/month"
- [ ] **Prompt efficiency scoring** — flag prompts with high token-to-output ratios as candidates for optimization

### Multi-Provider Support [?]

- [ ] **GitHub Copilot** — parse Copilot usage data if accessible locally
- [ ] **Cursor / Windsurf** — support other AI coding tools with local session logs
- [ ] **OpenAI / ChatGPT** — API usage analysis for non-Claude models (requires user-provided API key for cost data)

### Ecosystem

- [ ] **Plugin system** — community-contributed waste detectors, chart types, and data exporters
- [ ] **Theme marketplace** — user-created themes beyond the built-in dark/light
- [ ] **Localization contributions** — community-translated i18n for Japanese, Korean, Spanish, etc.
- [ ] **Public API** — local REST endpoint (`localhost:PORT`) for scripting and dashboard integrations (e.g., Raycast extension)

---

## Completed

- [x] v0.1.0 — Initial release: file watcher, SQLite storage, JSONL parser, cost computation
- [x] v0.1.1 — i18n (EN/ZH), dark/light theme, system tray, Mac packaging, tray stats, project detail page, delete flows, session activity classification, optimize health engine (9 detectors), cache ROI

---

## Contributing to the Roadmap

Have an idea? We'd love to hear it!

1. Check [open issues](https://github.com/happy-token/TokenUsage/issues) and [discussions](https://github.com/happy-token/TokenUsage/discussions) to see if it's already proposed
2. If not, open a [feature request](https://github.com/happy-token/TokenUsage/issues/new?template=feature_request.md) with the `enhancement` label
3. For larger ideas, start a [GitHub Discussion](https://github.com/happy-token/TokenUsage/discussions) to gather community feedback before creating a detailed proposal

Roadmap items marked `[?]` are ideas we're especially eager to get community feedback on — if any of those resonate, please let us know!

---

<p align="center">
  <sub>Last updated: 2025-05-05 · Version: 0.1.1</sub>
</p>
